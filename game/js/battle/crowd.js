// battle/crowd.js — lính thường: lính diễn (actor) và lính vùng chiến đấu (zone …).
//
// Hai tầng tác tử gần (mục 15.2):
//   - actor: lính diễn đứng theo đội hình ở tuyến mặt trận, chỉ diễn lại kết quả mô phỏng.
//     Không trúng đòn, không gây đòn — trừ đòn của tướng người chơi: chạm vào là thành lính thật ngay (strikeable / enlist, đợt 15b).
//   - zone / garrison / squad / landing / guard / follow: lính thật trong vùng r 25 m quanh
//     tướng người chơi — trúng đòn, gây đòn, KO của chúng trừ Q hoặc G.
// Mỗi binh chủng chia thành vài kiểu lính (KITS: đao, thương, cung, lực sĩ, nỏ…) khác vũ khí, tầm
// đánh và hoạt ảnh. Mỗi kiểu lính là một InstancedMesh skinned (soldiers.js): 15 khúc thân xoay
// được theo khớp, ma trận khớp đọc từ texture, nên lính bước chân, vung đòn, ngã theo nhiều kiểu
// mà cả đám đông chỉ tốn một lượt vẽ cho mỗi kiểu lính. Lính gần tướng (LOD gần) còn có chân bám
// đất, vạt áo đung đưa, tua giáo và đuôi ngựa treo theo trọng lực (soldierFrame, soldier-motion.js).
//
// Thủy chiến (B20, chỉ khi có ctx.naval — B15 không có nên mọi nhánh dưới đây không chạy): lính đứng trên boong (a.deck,
// naval.js chở theo toạ độ cục bộ), độ cao đứng qua naval.standY (boong / đất / mặt nước), đường qua ván bắc / ván dốc
// (naval.route), rơi xuống nước sâu thì bơi vào bờ (trạng thái "swim", không có xác trôi), tên rơi tới mặt nước thì dừng.
//
// Nội suy khi vẽ (đợt 19c, battle/view.js): capture() chụp vị trí, hướng đầu mỗi bước mô phỏng (a.ix …), render() vẽ giữa đó và hiện tại theo
// α (a.rx …), tư thế đích của lính gần nội suy theo giờ vẽ (target). Các trường a.i*, a.r*, a.tp*, a.tc* chỉ để vẽ — mô phỏng không đọc.
//
// Bớt việc CPU mỗi khung (đợt 19c): lính ngoài khung nhìn camera (hình cầu quanh thân + lề) không tư thế, không IK, không chiếm chỗ vẽ;
// mức chi tiết (a.lv, mọi kiểu lính — GLB lẫn thủ tục) theo khoảng cách camera có trễ ±LOD_HYST m; IK chân, lò xo vạt, dây tua chỉ cho
// lính LOD0. Lính là đối tượng một kiểu cố định (class Agent: V8 giữ dạng nhanh, đọc ghi trường trực tiếp). Không tải buffer thừa.

import * as THREE from "three";
import { blobGeometry, lambert, kitOf } from "./models.js";
import { skinnedKit, glbKit, poseFor, soldierFrame, resetMotion, advanceStride, smoothPose, legRate, NCH, BONE_FLOATS, BONE_TEX_W } from "./soldiers.js";
import { model } from "./glb.js";
import { lerpYaw, SNAP_D, STEP, MAX_STEPS } from "./pacing.js";
import { heightAt, collide } from "./world.js";
import { surfaceY, overlay } from "./ground.js";
import { TIERS, UNITS, KITS, AI, MOVES, IMPACT, SUPPLY, pickKit, g, heSoGiap, arrowHeroMult } from "../data/tuning.js";
import { speedFactor, rangeMult, hitMult, heightDamageMult, perchNear } from "../sim/terrain-rules.js";   // dốc, bùn, thế đất cao
import { leashClamp, fleeDir } from "./garrison.js";
import { fortRoute } from "./fort.js";                                                         // dây xích cứng, hướng rút của quân đồn trú (đợt 12b)
import { enemyActor, enlistActor } from "./promotion.js";                                                    // đòn tướng chạm lính diễn địch (đợt 15b)

const KIT_IDS = Object.keys(KITS);
const CAP = 900;                 // mỗi kiểu lính; lính diễn tối đa ~800 + vùng chiến đấu
const TWO_PI = Math.PI * 2;
const HITTABLE = new Set(["zone", "garrison", "squad", "landing", "guard", "follow"]);
const HEAVY_MOVES = new Set(["N6", "C1", "C2", "C3", "C4", "C5", "C6", "DC", "DQ"]);     // đòn đáng né (dự phòng: tướng không có hero.F)
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, "YXZ"), _p = new THREE.Vector3(), _s = new THREE.Vector3();
const _c = new THREE.Color();
const _pose = new Float32Array(NCH);
// Mức chi tiết theo khoảng cách tới camera (mọi kiểu lính): LOD0 < 18 m — tư thế mượt + IK chân, lò xo vạt, dây tua; LOD1 < 40 m — tư thế
// mượt, không IK / vạt / tua; LOD2 xa hơn. Lính GLB (glb.js, soldiers.js glbKit) còn đổi lưới theo mức (design/systems.md §13.3: LOD0 ≤ 600
// tam giác điện thoại, LOD1 ≤ 250, LOD2 ≤ 100). Trễ ±LOD_HYST m: đang ở mức thấp phải ra quá ngưỡng + 2 m mới lên mức xa, đang xa phải vào
// trong ngưỡng − 2 m mới về — trước đây 33–44 lần đổi lưới mỗi giây (lính đứng quanh 18 m nhảy qua lại mỗi khung).
// Tư thế 20 Hz (tính lại mỗi 3 khung, khung khác dời ma trận cũ theo chỗ vẽ) vẫn theo khoảng cách tới TƯỚNG > 40 m (FAR2) như trước đợt 19c —
// theo camera (đứng sau tướng ~9,6 m) thì lính trước mặt tướng 31–40 m cũng thành 20 Hz.
const LOD_D = [18, 40], LOD_HYST = 2, FAR2 = 40 * 40;
const LOD_UP2 = LOD_D.map((d) => (d + LOD_HYST) ** 2), LOD_DN2 = LOD_D.map((d) => (d - LOD_HYST) ** 2), LOD_D2 = LOD_D.map((d) => d * d);
export function lodLevel(prev, d2) {
  let l = 0;
  for (let i = 0; i < LOD_D.length; i++) if (d2 >= (prev < 0 ? LOD_D2[i] : prev <= i ? LOD_UP2[i] : LOD_DN2[i])) l = i + 1;
  return l;
}
const SNAP2 = SNAP_D * SNAP_D;   // dời quá chừng này trong một bước (dùng lại từ bể, dịch chuyển): vẽ ngay chỗ mới, không nội suy
// Khung nhìn: hình cầu quanh thân (tâm cao 0,9 × tỉ lệ, bán kính 1,3 / ngựa 2,2 × tỉ lệ) + lề VIEW_PAD m (giáo chĩa ra, camera quay nhanh).
// Lính lưới không đổ bóng (soldiers.js castShadow = false; bóng tròn đi theo lính) nên ngoài khung là bỏ hẳn.
const VIEW_PAD = 2;
const _fr = new THREE.Frustum(), _pm = new THREE.Matrix4(), PL = new Float64Array(24);
function viewPlanes(cam) {
  cam.updateMatrixWorld();                   // battle.js đặt camera ngay trước crowd.render, renderer.render chưa cập nhật ma trận
  _pm.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
  _fr.setFromProjectionMatrix(_pm);
  for (let i = 0; i < 6; i++) { const p = _fr.planes[i]; PL[i * 4] = p.normal.x; PL[i * 4 + 1] = p.normal.y; PL[i * 4 + 2] = p.normal.z; PL[i * 4 + 3] = p.constant; }
}
function inView(x, y, z, r) {
  for (let i = 0; i < 24; i += 4) if (PL[i] * x + PL[i + 1] * y + PL[i + 2] * z + PL[i + 3] < -r) return false;
  return true;
}

let NEXT_ID = 1;

// Một lính: mọi trường khai báo ở đây, cùng một thứ tự (đợt 19c). spawn() gán lại bằng Object.assign lên trường đã có — không thêm trường về
// sau, không delete — nên V8 giữ một kiểu ẩn, đọc ghi trường trực tiếp. Trước đây `{}` + Object.assign 98 trường + trường thêm dần (lod, mc,
// sm, _ang, evadeX…) làm mọi lính thành đối tượng dạng từ điển: mỗi lần đọc / ghi là tra bảng băm (đo B15 cùng các sửa khác của đợt: crowd.update
// 667 → 256 ms CPU mỗi 20 s trận, kết quả mô phỏng y hệt). Giá trị ở đây chỉ là chỗ giữ (spawn gán đè mọi trường của nó), trừ các trường chỉ có ở vài chỗ — giữ đúng giá trị "chưa có"
// như cũ: undefined (thủy chiến B20, Tự do, khán giả) để mọi phép thử `=== undefined` / `?? x` / `if (a.x)` ra y như trước; _ang, evadeX/Z,
// chargeX/Z, swimT luôn được ghi trước khi đọc nên giữ số 0.
class Agent {
  constructor() {
    this.id = 0; this.alive = false; this.side = ""; this.unit = ""; this.kit = ""; this.K = null; this.tier = ""; this.role = "";
    this.front = null; this.src = null;
    this.x = 0; this.z = 0; this.y = 0; this.vy = 0; this.yaw = 0; this.vx = 0; this.vz = 0;
    this.maxHp = 0; this.cong = 0; this.giap = 0; this.speed = 0;
    this.state = ""; this.st = 0; this.atkCd = 0; this.windup = 0; this.windupT = 0; this.atkT = 0; this.fake = false;
    this.token = false; this.target = null; this.sx = 0; this.sz = 0; this.anchor = null;
    this.flash = 0; this.stun = 0; this.dieT = 0; this.flinch = 0; this.hitFront = 1; this.launchDeath = false; this.bob = 0; this.fakeCd = 0;
    this.walk = 0; this.spd = 0; this.mvx = 0; this.mvz = 1; this.gx = NaN; this.gz = NaN; this.gy = 0; this.ready = false; this.poseInit = false; this.frontRow = false;
    this.slotAng = undefined; this.blockT = 0; this.blockCd = 0; this.evadeT = 0; this.evadedSwing = -1; this.chargeT = 0; this.chargeCd = 0; this.chargeHit = false; this.fleeT = 0;
    this.hitBy = 0; this.scale = 1; this.lvl = 1; this.fading = 0; this.tint = null; this.panicT = 0;
    this.foe = null; this.retT = 0; this.duel = false; this._eng = 0; this.slot = undefined; this.pool = null; this.partner = null;
    this.forced = false; this.kiting = false; this.march = false;
    this.markT = 0; this.markMult = 1; this.tauntT = 0; this.tauntBy = null; this.deck = null; this.boat = null; this._pins = null;
    this.ix = 0; this.iz = 0; this.iy = 0; this.iyaw = 0; this.itk = -1; this.rx = 0; this.rz = 0; this.ry = 0; this.ryaw = 0; this.tc0 = NaN; this.tc1 = NaN;
    // chỉ để vẽ: mức chi tiết có trễ (−1: chưa có), lưới GLB đang dùng, trong khung nhìn, gốc lúc tính a.mc (LOD2 dời ma trận theo chỗ vẽ)
    this.lv = -1; this.lod = 0; this.inView = false; this.mx = 0; this.my = 0; this.mz = 0;
    this.hp = 0;
    this.pose = new Float32Array(NCH); this.tp0 = new Float32Array(NCH); this.tp1 = new Float32Array(NCH); this.mc = new Float32Array(BONE_FLOATS);
    this.sm = null;                                        // trạng thái lò xo / IK (soldier-motion.js motion)
    this._ang = 0; this.evadeX = 0; this.evadeZ = 0; this.chargeX = 0; this.chargeZ = 0; this.swimT = 0;
    this.cheer = undefined;                                // khán giả Võ trường, Tự do
    this.dlx = undefined; this.dlz = undefined; this.dli = undefined; this.dyaw = undefined;      // toạ độ trên boong (naval.js)
    this.escort = undefined; this.flot = undefined; this.vg = undefined; this.scout = undefined; this.squad = undefined;   // toán B20 (director-b20.js)
    this.huntCart = undefined;                             // toán săn xe (director-td.js)
  }
}

export class Crowd {
  constructor(scene, ctx) {
    this.ctx = ctx; this.agents = []; this.free = [];
    this.meshes = {};
    const mat = lambert();
    for (const k of KIT_IDS) {
      const G = model("kit/" + kitOf(k));
      if (G) { const S = glbKit(k, G, CAP); for (const m of S.meshes) scene.add(m); this.meshes[k] = S; continue; }
      const S = skinnedKit(k, CAP, mat);
      // màu instance: chớp trắng khi trúng, ánh đỏ báo đòn, lệch sáng tối từng người
      S.color = S.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 3).fill(1), 3);
      scene.add(S.mesh); this.meshes[k] = S;
    }
    this.frame = 0;
    this.blob = new THREE.InstancedMesh(blobGeometry(), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }), 2200);
    this.blob.frustumCulled = false; this.blob.count = 0; scene.add(this.blob);
    this.arrows = []; this.heroKills = []; this.cheerT = 0;
    const ag = new THREE.CylinderGeometry(0.02, 0.02, 1.1, 3); ag.rotateX(Math.PI / 2);
    this.arrowMesh = new THREE.InstancedMesh(ag, new THREE.MeshBasicMaterial({ color: 0x2a2018 }), 200);
    this.arrowMesh.frustumCulled = false; this.arrowMesh.count = 0; scene.add(this.arrowMesh);
    // mảng dùng lại mỗi bước / mỗi khung (đợt 19c: không cấp phát trong vòng nóng; thứ tự phần tử y như mảng mới cũ)
    this.enemies = []; this.allies = []; this.allyFoes = []; this.slotList = []; this.candE = []; this.candD = [];
    this.counts = {}; this.lodN = {}; this.lodC = {};
    for (const k of KIT_IDS) { this.counts[k] = 0; if (this.meshes[k].glb) { this.lodN[k] = [0, 0, 0]; this.lodC[k] = [0, 0, 0]; } }
  }

  spawn(o) {
    const a = this.free.pop() || new Agent();
    const tier = TIERS[o.tier || "thuong"], U = UNITS[o.unit];
    const R = this.ctx.R;
    const lvl = o.side === "dich" ? g(R) : g(R) * (o.legionMult || 1);
    const hpDiff = o.side === "dich" ? (this.ctx.diff?.hp ?? 1) : 1;     // HP địch × theo độ khó (§10)
    // Kiểu lính chọn theo băm id (dãy tỉ lệ vàng, phủ đều tỉ lệ w) — không ăn vào chuỗi rng của trận.
    const id = NEXT_ID++;
    const kit = o.kit || pickKit(o.unit, (id * 0.6180339887) % 1), K = KITS[kit];
    Object.assign(a, {
      id, alive: true, side: o.side, unit: o.unit, kit, K, tier: o.tier || "thuong", role: o.role || "zone",
      front: o.front ?? null, src: o.src ?? null,
      x: o.x, z: o.z, y: 0, vy: 0, yaw: o.yaw ?? (o.side === "ta" ? Math.PI / 2 : -Math.PI / 2), vx: 0, vz: 0,
      maxHp: tier.hp * U.rel[0] * K.hp * lvl * hpDiff, cong: tier.cong * U.rel[1] * K.cong * lvl, giap: tier.giap * U.rel[2] * K.giap * lvl,
      speed: (o.unit === "CUNGKY_NG" ? 5.2 : 3.1) * K.speed * (0.9 + 0.2 * this.ctx.rng.next()),
      state: "move", st: 0, atkCd: 1 + this.ctx.rng.next() * tier.every, windup: 0, windupT: K.windup, atkT: 9, fake: false,
      token: false, target: null, sx: o.sx ?? o.x, sz: o.sz ?? o.z, anchor: o.anchor || null,
      flash: 0, stun: 0, dieT: 0, flinch: 0, hitFront: 1, launchDeath: false, bob: this.ctx.rng.next() * 6.28, fakeCd: this.ctx.rng.next() * 3,
      walk: this.ctx.rng.next() * TWO_PI, spd: 0, mvx: 0, mvz: 1, gx: NaN, gz: NaN, gy: 0, ready: false, poseInit: false, frontRow: false,
      slotAng: undefined, blockT: 0, blockCd: 0, evadeT: 0, evadedSwing: -1, chargeT: 0, chargeCd: 2 + this.ctx.rng.next() * 4, chargeHit: false, fleeT: 0,
      hitBy: 0, scale: tier.scale * (K.scale || 1), lvl: o.lvl || 1, fading: 0, tint: o.tint || null, panicT: 0,
      foe: null, retT: 0, duel: false, _eng: 0, slot: undefined, pool: null, partner: null,
      forced: false, kiting: false, march: false,           // forced: lính diễn "ép" thành thật vì sát tướng (director.updateZone, promotion.js); kiting: đang lùi giữ tầm (gợi ý Cung kỵ, hints.js); march: lính bù xuất từ cửa ngõ đang hành quân ra tuyến (supply.js, đợt 12c)
      // đặt lại khi dùng lại lính trong bể: dấu Binh Thư (core verify mục 2), boong / thuyền (naval.js)
      markT: 0, markMult: 1, tauntT: 0, tauntBy: null, deck: null, boat: null, _pins: null,
      // bản sao để vẽ (đợt 19c): đầu bước cuối (capture), vị trí / hướng vẽ, giờ của hai đích tư thế (target); itk −1: chưa chụp — vẽ ngay chỗ thật
      ix: 0, iz: 0, iy: 0, iyaw: 0, itk: -1, rx: 0, rz: 0, ry: 0, ryaw: 0, tc0: NaN, tc1: NaN,
      lv: -1, lod: 0, inView: false,                         // mức chi tiết, khung nhìn của lần dùng trước (pool): tính lại từ đầu
    });
    resetMotion(a);                  // lò xo vạt áo, dây tua, trọng số IK của lần dùng trước (pool)
    a.hp = a.maxHp;
    this.agents.push(a);
    return a;
  }

  release(a) {
    a.alive = false; a.role = "free";
    const i = this.agents.indexOf(a);
    if (i >= 0) { this.agents[i] = this.agents[this.agents.length - 1]; this.agents.pop(); }
    this.free.push(a);
  }

  hittable(a) { return a.alive && a.state !== "dead" && HITTABLE.has(a.role); }
  // Đòn của tướng người chơi (hero.js, hero-skills.js — đợt 15b): trúng cả lính diễn phe địch còn đứng, vì họ vẽ y như lính thật. Vòng sát thương gọi
  // enlist(a) NGAY TRƯỚC damage (damage chỉ nhận lính trúng đòn được): lính diễn thành lính thật như lính "ép" của director.updateZone (promotion.js).
  // Quân ta, lính địch, director vẫn dùng hittable.
  strikeable(a) { return this.hittable(a) || enemyActor(a); }
  enlist(a) { return enlistActor(a); }

  // Sát thương vào lính. opt.by: 'hero' | 'ally' | 'enemy'; opt.src: lính ra đòn (để quay lại đánh trả). Trả về true nếu hạ.
  damage(a, dmg, opt = {}) {
    if (!this.hittable(a)) return false;
    // dấu Binh Thư Yếu Lược (hero-skills.js): quân ta đánh lính bị đánh dấu × markMult tới giờ trận markT
    if (a.markT > this.ctx.clock && opt.by !== "enemy") dmg *= a.markMult;
    const kx = opt.kx ?? 0, kz = opt.kz ?? 0;
    const hard = opt.launch || (opt.knock || 2.5) >= 5;
    a.hitFront = kx * Math.sin(a.yaw) + kz * Math.cos(a.yaw) <= 0 ? 1 : -1;   // bị đẩy về sau lưng = trúng trước mặt
    // bị lính phe kia đánh: quay sang đánh trả kẻ đó (lính địch đang giữ thẻ đánh tướng thì thôi)
    const src = opt.src;
    if (src && src.K && src.side !== a.side && this.hittable(src) && !(a.side === "dich" && a.token) && a.foe !== src && (!a.foe || this.ctx.rng.chance(0.5))) {
      a.foe = src; a.retT = Math.max(a.retT, 1.2);
    }
    // đỡ khiên: đòn N của tướng (hoặc nhát của lính) trúng trước mặt, lính không đang gồng đòn, không đang chạy tán loạn
    const pb = opt.by === "hero" ? AI.block[a.kit] || 0 : AI.block[a.kit] ? AI.duel.block : 0;
    if (pb && !hard && a.hitFront > 0 && a.windup <= 0 && a.blockCd <= 0 && a.fleeT <= 0 && this.ctx.rng.chance(pb)) {
      a.hp -= dmg * AI.blockDmg; a.blockT = 0.32; a.blockCd = AI.blockCd; a.flinch = 0.12;
      if (this.nearHero(a, 30)) this.ctx.fx?.spark(a.x - kx * 0.5, heightAt(a.x, a.z) + 1.3 * a.scale, a.z - kz * 0.5, false, 0xf1d98a);
      this.ctx.audio?.play("block", a.x, a.z);
      a.x += kx * 0.25; a.z += kz * 0.25;
      if (a.hp <= 0) { this.kill(a, opt); return true; }
      return false;
    }
    a.hp -= dmg; a.flash = opt.by === "hero" ? 0.16 : 0.1; a.blockT = 0;
    // lính chém lính: tiếng, tia máu nhỏ (chỉ quanh tướng cho đỡ tốn)
    if (opt.by !== "hero" && src && this.nearHero(a, 30)) {
      this.ctx.audio?.play("hitSoft", a.x, a.z);
      this.ctx.fx?.blood?.(a.x, heightAt(a.x, a.z) + 1.2 * a.scale, a.z, kx, kz, 0.5);
    }
    if (opt.stun) a.stun = Math.max(a.stun, opt.stun);
    if (a.hp <= 0) { this.kill(a, opt); return true; }
    // lực sĩ trọng giáp: đòn thường chỉ làm khựng người, không cắt được đòn đang gồng
    if (a.K.stable && !hard) { a.flinch = 0.18; return false; }
    if (opt.launch && !a.K.mounted && !a.K.stable) { a.state = "launch"; a.vy = 6.5; a.st = 0; a.vx = kx * 2; a.vz = kz * 2; a.windup = 0; }
    else if (a.state !== "launch") { a.state = "hit"; a.st = 0.32; a.vx = kx * (opt.knock || 2.5); a.vz = kz * (opt.knock || 2.5); a.windup = 0; }
    return false;
  }

  kill(a, opt = {}) {
    a.launchDeath = a.state === "launch" || !!opt.launch;
    a.state = "dead"; a.dieT = 0; a.hp = 0; a.token = false; a.foe = null;
    // tướng chém ngã: xác văng xa hơn, đòn nặng hất bổng lên (cảm giác đòn chắc tay)
    const kk = opt.by === "hero" ? IMPACT.killKnock : 1;
    a.vx = (opt.kx ?? 0) * (opt.knock || 3) * kk; a.vz = (opt.kz ?? 0) * (opt.knock || 3) * kk;
    if (opt.by === "hero" && !a.K.mounted) a.vy = Math.max(a.vy, opt.heavy || (opt.knock || 0) >= 5 ? IMPACT.killUpHeavy : IMPACT.killUp);
    if (opt.launch) a.vy = Math.max(a.vy, 5);
    a.chargeT = 0; a.fleeT = 0;
    this.ctx.director?.onSoldierKilled(a, opt);
    // tướng chém ngã nhiều người trong chốc lát → lính yếu quanh đó hoảng, bỏ chạy
    if (opt.by === "hero" && a.side === "dich") {
      this.cheerT = Math.min(2.5, this.cheerT + 1.2);                   // khán đài reo hò (Võ trường)
      const t = this.ctx.clock, R = AI.rout, hero = this.ctx.hero;
      this.heroKills.push(t);
      while (this.heroKills.length && t - this.heroKills[0] > R.window) this.heroKills.shift();
      if (this.heroKills.length >= R.kills) {
        this.heroKills.length = 0;
        this.rout(hero.x, hero.z, R.nearR, (e) => e.tier === "thuong" && e.hp < e.maxHp * 0.6);
      }
    }
  }

  // Vỡ trận: lính địch trong bán kính r (trừ lực sĩ trọng giáp) bỏ chạy khỏi tướng vài giây.
  rout(x, z, r, filter = null) {
    const R = AI.rout, rng = this.ctx.rng;
    let n = 0;
    for (const e of this.agents) {
      if (e.side !== "dich" || !this.hittable(e) || e.K.stable || e.fleeT > 0) continue;
      if (Math.hypot(e.x - x, e.z - z) > r || (filter && !filter(e))) continue;
      e.fleeT = rng.range(R.dur[0], R.dur[1]); e.token = false; e.windup = 0; e.chargeT = 0; n++;
    }
    if (n >= 3) this.ctx.fx?.text(x, z, "Quân Nguyên núng thế!", "#f1d98a");
    return n;
  }

  // Lính cận chiến đang vây tướng tự giãn góc với nhau: lính có thẻ tấn công chia đều quanh tướng
  // (có người đánh vào sườn, vào lưng), lính chờ đứng thành vòng ngoài thưa đều thay vì dồn một cục.
  assignSlots(enemies) {
    const hero = this.ctx.hero, list = this.slotList;
    list.length = 0;
    for (const e of enemies) if (e.target === hero && !e.K.ranged && e.fleeT <= 0) { e._ang = Math.atan2(e.x - hero.x, e.z - hero.z); list.push(e); }
    let nTok = 0; for (const e of list) if (e.token) nTok++;
    for (const e of list) {
      const sep = (e.token ? (Math.PI * 2) / Math.max(2, nTok) : 0.55) * AI.slotSep;
      let push = 0;
      for (const o of list) {
        if (o === e || o.token !== e.token) continue;
        const d = wrapA(e._ang - o._ang), ad = Math.abs(d);
        if (ad < sep) push += (d === 0 ? (e.id > o.id ? 1 : -1) : Math.sign(d)) * (sep - ad);
      }
      e.slotAng = e._ang + Math.max(-0.7, Math.min(0.7, push * 0.6));
    }
  }

  // Thân binh, quân theo tướng: ưu tiên kẻ đang đánh tướng; giữ đối thủ cũ trừ khi kẻ mới gần hơn hẳn.
  threatFor(a, enemies, maxD) {
    const hero = this.ctx.hero;
    let best = null, bs = maxD;
    for (const e of enemies) {
      const d = Math.hypot(e.x - a.x, e.z - a.z);
      if (d > maxD || !this.leashOk(a, e)) continue;
      const s = d - (e.token || (e.windup > 0 && e.target === hero) ? 5 : 0) - (e === a.foe ? AI.duel.switchGain : 0) + e._eng * 0.8;
      if (s < bs) { bs = s; best = e; }
    }
    return best;
  }

  nearHero(a, r) { const h = this.ctx.hero; return (a.x - h.x) ** 2 + (a.z - h.z) ** 2 < r * r; }

  // Đối thủ còn đánh được: lính phe kia còn sống trong vùng chiến đấu, hoặc tướng đồng minh còn đứng.
  validFoe(a, f) {
    if (!f) return false;
    if (f.isBig) return f.alive && !f.dead && !f.down && f.side !== a.side;
    return f.side !== a.side && this.hittable(f) && f.fleeT <= 0;
  }

  // Dây xích: quân đồn trú (có anchor) chỉ đánh trong vòng Cứ Điểm + leash m, thân binh / quân theo tướng không đuổi
  // xa tướng quá leash m. Không có dây này thì cung kỵ đồn trú mải đấu với thân binh, hai bên kéo nhau ra xa 20 m, đồn
  // còn lính nên không chiếm được (bot kẹt ở A2).
  leashOk(a, f) {
    const L = AI.duel.leash;
    if (a.anchor && !a.anchor.target) return Math.hypot(f.x - a.anchor.x, f.z - a.anchor.z) <= (a.anchor.r ?? 3) + L;
    if (a.role === "guard" || a.role === "follow") { const h = this.ctx.hero; return Math.hypot(f.x - h.x, f.z - h.z) <= L + 4; }
    return true;
  }

  // Chọn đối thủ giáp lá cà: gần nhất nhưng tránh dồn quá maxOn người vào một lính (_eng: số người đang nhắm nó,
  // đếm lại mỗi khung), giữ đối thủ cũ (switchGain), quân ta ưu tiên kẻ đang đánh tướng người chơi.
  pickFoe(a, list, maxD) {
    const hero = this.ctx.hero, D = AI.duel;
    let best = null, bs = Infinity;
    for (const b of list) {
      const d = Math.hypot(b.x - a.x, b.z - a.z);
      if (d > maxD || !this.leashOk(a, b)) continue;
      const mine = a.foe === b, eng = b._eng - (mine ? 1 : 0);
      if (eng >= (b.isBig ? D.maxOnBig : D.maxOn)) continue;
      let s = d + eng * 1.5 - (mine ? D.switchGain : 0);
      if (a.side === "ta" && (b.token || (b.windup > 0 && b.target === hero))) s -= 3;
      if (b.foe === a) s -= 1.5;                          // đánh người đang đánh mình
      if (s < bs) { bs = s; best = b; }
    }
    if (best !== a.foe) { if (a.foe) a.foe._eng = Math.max(0, a.foe._eng - 1); if (best) best._eng++; }
    return best;
  }

  // ---- AI --------------------------------------------------------------------------------
  update(dt) {
    const ctx = this.ctx, hero = ctx.hero, rng = ctx.rng, nav = ctx.naval, forts = ctx.world?.forts;      // forts: đồn có tường của B15 (fort.js), thiếu thì như cũ
    const ovMud = !!overlay()?.mud;                                      // lớp phủ bùn của trận (ground.js setOverlay — B17), không có: null
    const enemies = this.enemies, allies = this.allies, allyFoes = this.allyFoes;
    enemies.length = 0; allies.length = 0; allyFoes.length = 0;
    for (const a of this.agents) if (this.hittable(a)) (a.side === "dich" ? enemies : allies).push(a);
    // đối thủ của địch: lính ta và tướng đồng minh; đếm lại số người đang nhắm mỗi đối thủ
    for (const a of allies) allyFoes.push(a);
    for (const u of ctx.units) if (u.side === "ta" && u.alive && !u.dead && !u.down) { u._eng = 0; allyFoes.push(u); }     // down: cận vệ Tự do đang gục
    for (const a of enemies) a._eng = 0;
    for (const a of allies) a._eng = 0;
    for (const a of enemies) if (a.foe && this.validFoe(a, a.foe) && this.leashOk(a, a.foe)) a.foe._eng++; else a.foe = null;
    for (const a of allies) if (a.foe && this.validFoe(a, a.foe) && this.leashOk(a, a.foe)) a.foe._eng++; else a.foe = null;
    this.assignTokens(enemies);
    this.assignSlots(enemies);
    // tướng đang gồng đòn nặng (trước cú trúng đầu): lính gần có thể nhảy lùi né
    // cờ đòn theo tướng (hero.F[move].heavyTell, data/heroes.js moveFlags — H35 suy ra đúng bộ HEAVY_MOVES cũ)
    const hm = hero.state === "attack" && (hero.F ? hero.F[hero.move]?.heavyTell : HEAVY_MOVES.has(hero.move)) ? (hero.M || MOVES)[hero.move] : null;
    const heroHeavy = hm && hero.st / hero.dur < hm.hits[0] - 0.08 ? hm : null;

    this.cheerT = Math.max(0, this.cheerT - dt);
    for (let i = this.agents.length - 1; i >= 0; i--) {
      const a = this.agents[i];
      if (a.role === "spectator") { a.cheer = this.cheerT; a.atkT += dt; continue; }
      a.flash = Math.max(0, a.flash - dt); a.bob += dt * 7; a.atkT += dt; a.flinch = Math.max(0, a.flinch - dt);
      a.blockT = Math.max(0, a.blockT - dt); a.blockCd -= dt; a.chargeCd -= dt;
      if (a.panicT > 0) a.panicT -= dt;
      a.kiting = false;                  // đặt lại mỗi khung: các nhánh choáng / trúng đòn / bỏ chạy ở dưới `continue` trước chỗ đặt lại đúng giá trị (gợi ý Cung kỵ đọc cờ này)
      if (a.state === "swim") { nav.swim(a, dt); continue; }          // rơi xuống sông (naval.js): bơi vào bờ
      if (a.state === "dead") {
        a.dieT += dt;
        a.x += a.vx * dt; a.z += a.vz * dt; a.vx *= 0.9; a.vz *= 0.9;
        if (a.vy > 0 || a.y > 0) {
          a.y += a.vy * dt; a.vy -= 16 * dt;
          if (a.y < 0 && nav && nav.land(a)) continue;    // rơi xuống nước sâu: bơi, không để xác trôi
          if (a.y < 0) {                                  // xác rơi chạm đất: bụi, tiếng ngã (chỉ quanh tướng)
            if (a.vy < -4 && this.nearHero(a, 25)) { this.ctx.fx?.dust(a.x, a.z, 0.5); this.ctx.audio?.play("fall", a.x, a.z); }
            a.y = 0; a.vy = 0;
          }
        }
        if (a.dieT > 2.8) this.release(a);
        continue;
      }
      if (a.state === "launch") {
        a.st += dt; a.y += a.vy * dt; a.vy -= 16 * dt; a.x += a.vx * dt; a.z += a.vz * dt;
        if (a.y <= 0 && nav && nav.land(a)) continue;      // rơi xuống nước sâu: bơi vào bờ
        if (a.y <= 0) { a.y = 0; a.state = "down"; a.st = 0.9; a.vx = a.vz = 0; ctx.fx?.dust(a.x, a.z, 0.5); }
        continue;
      }
      if (a.state === "down") { a.st -= dt; if (a.st <= 0) { a.state = "move"; } continue; }
      if (a.state === "hit") {
        a.spd *= 0.8; a.st -= dt; a.x += a.vx * dt; a.z += a.vz * dt; a.vx *= 0.85; a.vz *= 0.85;
        if (a.st <= 0) a.state = "move";
        continue;
      }
      // choáng: đứng im, tốc độ tắt dần như nhánh trúng đòn (bỏ qua stride nên a.spd không tự về 0 — lực sĩ trúng
      // Phá Trận đang chạy thì đứng co một chân giữa bước suốt 1–1,5 s)
      if (a.stun > 0) { a.stun -= dt; a.spd *= Math.exp(-dt * 13); continue; }

      if (a.role === "actor") { this.updateActor(a, dt); continue; }

      const K = a.K, ranged = !!K.ranged, reach = K.reach || 1.7;
      const px = a.x, pz = a.z;
      const hx = hero.x - a.x, hz = hero.z - a.z, dH = Math.hypot(hx, hz) || 1e-6;

      // ---- trạng thái đặc biệt: bỏ chạy, nhảy lùi, lao húc ----
      if (a.fleeT > 0) {
        a.fleeT -= dt; a.target = null; a.token = false; a.ready = false; a.windup = 0;
        // lính thường chạy ngược khỏi tướng; quân đồn trú có dây cứng thì rút VỀ đồn (garrison.js fleeDir): trước đợt 12 sĩ quan trấn thủ ngã là
        // cả đám trong 22 m chạy ra 29–46 m khỏi đồn
        const sp = a.speed * 1.2;
        let [ax, az] = fleeDir(a, hero);
        if ((ax || az) && a.anchor && a.anchor.hard && ctx.world.forts) {          // rút về đồn có tường: ở ngoài thì tới cổng trước, qua cổng (fort.js)
          const w = fortRoute(ctx.world.forts, a.x, a.z, a.anchor.x, a.anchor.z);
          if (w) { const wx = w.x - a.x, wz = w.z - a.z, wl = Math.hypot(wx, wz) || 1; ax = wx / wl; az = wz / wl; }
        }
        a.x += ax * sp * dt; a.z += az * sp * dt; if (ax || az) a.yaw = turn(a.yaw, Math.atan2(ax, az), dt * 8);
        [a.x, a.z] = collide(ctx.world, a.x, a.z, 0.4, ctx.openGates, a); this.leash(a); this.stride(a, px, pz, dt);
        continue;
      }
      if (a.evadeT > 0) {
        a.evadeT -= dt;
        const sp = AI.evadeDist / 0.3;
        a.x += a.evadeX * sp * dt; a.z += a.evadeZ * sp * dt; a.yaw = turn(a.yaw, Math.atan2(hx, hz), dt * 10);
        [a.x, a.z] = collide(ctx.world, a.x, a.z, 0.4, ctx.openGates, a); this.leash(a); a.spd = 0;
        continue;
      }
      if (a.chargeT > 0) {
        a.chargeT -= dt;
        const sp = a.speed * AI.charge.speed;
        a.x += a.chargeX * sp * dt; a.z += a.chargeZ * sp * dt; a.yaw = turn(a.yaw, Math.atan2(a.chargeX, a.chargeZ), dt * 6);
        [a.x, a.z] = collide(ctx.world, a.x, a.z, 0.4, ctx.openGates, a); this.leash(a); this.stride(a, px, pz, dt);
        if (hero.alive && dH <= reach + 0.4) { a.chargeT = 0; a.chargeHit = true; a.windup = a.windupT = 0.22; a.fake = false; a.target = hero; }
        else if (a.chargeT <= 0) a.atkCd = Math.max(a.atkCd, 0.8);
        continue;
      }
      if (heroHeavy && a.side === "dich" && !K.stable && !K.mounted && a.windup <= 0 && a.evadedSwing !== hero.swingId && dH < heroHeavy.range + 1.3) {
        a.evadedSwing = hero.swingId;
        if (rng.chance(AI.evade[a.tier] || 0)) { a.evadeT = 0.3; a.evadeX = -hx / dH; a.evadeZ = -hz / dH; continue; }
      }

      // tầm bắn theo thế đất (terrain-rules.js): đứng cao hơn mục tiêu (của bước trước) thì bắn xa hơn
      const rt = a.target || hero;
      const range = ranged ? K.range * rangeMult(heightAt(a.x, a.z) - heightAt(rt.x, rt.z)) : 0;

      // ---- chọn mục tiêu ----
      // Đối thủ giáp lá cà (a.foe) chọn lại theo nhịp retarget, không mỗi khung: đổi mục tiêu liên tục làm lính chạy
      // qua chạy lại. Mất đối thủ (chết, bỏ chạy) thì tìm ngay.
      let tx, tz, target = null, wantDist = 2.0, slot = false, kiting = false, perch = null, duel = false;
      a.retT -= dt;
      if (a.side === "dich") {
        const aggro = a.role === "garrison" ? 20 : a.role === "squad" ? 14 : 60;
        const heroNear = hero.alive && dH < aggro;
        const siege = a.anchor?.target && a.anchor.target.alive && !a.anchor.target.dead;     // toán vây tướng đồng minh
        // bị cận vệ Khiên thủ khiêu khích (chiêu Hộ chủ, battle/guard.js — chỉ có ở Tự do): đánh người khiêu khích tới hết giờ, bỏ thẻ đánh tướng
        const taunt = a.tauntT > ctx.clock && this.validFoe(a, a.tauntBy) ? a.tauntBy : null;
        if (taunt) { a.foe = taunt; a.token = false; }
        if (!taunt && !(a.token && heroNear) && !siege && (a.retT <= 0 || !a.foe)) {
          a.retT = rng.range(AI.duel.retarget[0], AI.duel.retarget[1]);
          a.foe = this.pickFoe(a, allyFoes, ranged ? range : AI.duel.engageR + (a.foe ? 2 : 0));
        }
        if (a.foe && (taunt || (!(a.token && heroNear) && !siege))) {
          // giáp lá cà với lính ta / tướng đồng minh
          const f = a.foe, fr = f.isBig ? f.radius : 0;
          target = f; tx = f.x; tz = f.z; duel = true;
          wantDist = ranged ? range * 0.6 : reach * 0.85 + fr;
        } else if (heroNear) {
          target = hero; tx = hero.x; tz = hero.z;
          const ring = ranged ? range * 0.7 : a.token ? reach : 4.2 + (a.id % 5) * 0.6 + (reach - 1.7);
          // cung thủ bộ Nguyên ưa gò cao gần đó: lên đỉnh gò đứng bắn xuống, bị áp sát thì lùi ngả về phía gò
          if (ranged && !K.mounted) perch = perchNear(a.x, a.z, hero.x, hero.z, K.range);
          if (ranged && dH < K.range * AI.kite) { kiting = true; wantDist = range * 0.7; }
          else if (!ranged && a.slotAng !== undefined && dH < 14) {
            // tới vị trí vây của mình; lính chờ trôi chậm quanh vòng
            if (!a.token) a.slotAng += (a.id % 2 ? 1 : -1) * 0.12 * dt;
            tx = hero.x + Math.sin(a.slotAng) * ring; tz = hero.z + Math.cos(a.slotAng) * ring; wantDist = 0.3; slot = true;
          } else if (perch) {
            const ang = a.id * 2.39996;               // mỗi người một chỗ quanh đỉnh gò (góc vàng theo id)
            tx = perch.x + Math.sin(ang) * perch.r * 0.22; tz = perch.z + Math.cos(ang) * perch.r * 0.22; wantDist = 0.3; slot = true;
          } else wantDist = ring;
          // lực sĩ có thẻ tấn công, tướng cách 5–11 m: lao húc
          const C = AI.charge;
          if (K.heavy && a.token && a.chargeCd <= 0 && a.windup <= 0 && dH > C.minD && dH < C.maxD) {
            a.chargeT = C.dur; a.chargeCd = C.cd; a.chargeX = hx / dH; a.chargeZ = hz / dH;
            ctx.audio?.play("warn", a.x, a.z); ctx.audio?.play("charge", a.x, a.z); continue;
          }
        } else if (a.anchor) {
          const at = a.anchor.target && a.anchor.target.alive && !a.anchor.target.dead ? a.anchor.target : null;
          target = at; tx = at ? at.x : a.anchor.x; tz = at ? at.z : a.anchor.z; wantDist = a.anchor.r ?? 3;
        } else { tx = a.sx; tz = a.sz; wantDist = 1; }
      } else {
        const guard = a.role === "guard" || a.role === "follow";
        if (a.retT <= 0 || !a.foe) {
          a.retT = rng.range(AI.duel.retarget[0], AI.duel.retarget[1]);
          const nf = guard ? this.threatFor(a, enemies, 9) : this.pickFoe(a, enemies, ranged ? range + 2 : 16);
          if (guard && nf !== a.foe) { if (a.foe) a.foe._eng = Math.max(0, a.foe._eng - 1); if (nf) nf._eng++; }
          a.foe = nf;
        }
        const en = a.foe;
        if (en) { target = en; tx = en.x; tz = en.z; wantDist = ranged ? range * 0.7 : reach * 0.85; duel = !ranged; }
        else if (guard) {
          const k = a.id % 12, ang = hero.yaw + Math.PI + (k - 5.5) * 0.35, rr = a.role === "guard" ? 3 : 5.5;
          tx = hero.x + Math.sin(ang) * rr; tz = hero.z + Math.cos(ang) * rr; wantDist = 0.6;
        } else { tx = a.sx; tz = a.sz; wantDist = 1; }
      }
      a.target = target;
      // thủy chiến: mục tiêu (người thật, không phải chỗ đứng chờ) ở boong khác thì đi qua cửa (ván bắc, ván dốc, gốc cầu bến) —
      // naval.route trả điểm bên kia ngưỡng
      if (nav && target && (a.deck || target.deck)) {
        const w = nav.route(a, target, tx, tz);
        if (w) { tx = w.x; tz = w.z; wantDist = 0.1; duel = false; slot = false; kiting = false; }
      }

      // đồn có tường (fort.js): đường thẳng tới đích bị tường chặn thì đi qua cổng trước / cổng sau (hoặc vòng qua góc) — lính không tìm đường, chỉ đẩy ra khỏi tường
      let routed = false;
      // cung, nỏ trong đồn đã vào tầm thì đứng bắn qua tường, không chạy ra cổng
      if (forts && !(ranged && target && Math.hypot(target.x - a.x, target.z - a.z) <= range + 1)) {
        // đích thật (người đánh) chứ không phải chỗ vây quanh người đó: chỗ vây có thể rơi vào bên kia tường, lính sẽ dồn sát tường rồi đánh xuyên qua
        const w = fortRoute(forts, a.x, a.z, target ? target.x : tx, target ? target.z : tz);
        if (w) { tx = w.x; tz = w.z; wantDist = 0.3; duel = false; slot = false; kiting = false; perch = null; routed = true; }
      }

      // ---- di chuyển ----
      const dx = tx - a.x, dz = tz - a.z, d = Math.hypot(dx, dz) || 1e-6;
      const dT = target === hero ? dH : target ? Math.hypot(target.x - a.x, target.z - a.z) : d;   // khoảng cách tới mục tiêu thật
      a.ready = !!target && dT < (ranged ? range + 4 : 8);
      let mvx = 0, mvz = 0;
      if (routed) a.yaw = turn(a.yaw, Math.atan2(dx, dz), dt * 6);
      else if (target) a.yaw = turn(a.yaw, target === hero ? Math.atan2(hx, hz) : Math.atan2(dx, dz), dt * 8);
      if (a.windup <= 0) {
        if (kiting) {                                                         // cung thủ lùi giữ tầm
          mvx = -hx / dH; mvz = -hz / dH;
          if (perch) {                                                        // gò ở phía lùi thì ngả về gò
            const ox = perch.x - a.x, oz = perch.z - a.z, ol = Math.hypot(ox, oz) || 1;
            if (ox * mvx + oz * mvz > 0) { mvx += ox / ol; mvz += oz / ol; const l = Math.hypot(mvx, mvz) || 1; mvx /= l; mvz /= l; }
          }
        }
        else if (duel) {
          // giáp lá cà: áp tới tầm chém rồi đứng vững mà đánh; thỉnh thoảng nhích ngang nửa bước cho khỏi đứng như tượng
          if (d > wantDist + 0.25) { const k = d > wantDist + 2 ? 1 : 0.55; mvx = dx / d * k; mvz = dz / d * k; }
          else if (d < wantDist - 0.55 && !ranged) { mvx = -dx / d * 0.35; mvz = -dz / d * 0.35; }   // cung không lùi dần (kéo nhau đi xa)
          else if (!ranged && Math.sin(ctx.clock * 0.8 + a.id * 1.7) > 0.85) { const s2 = (a.id % 2 ? 1 : -1) * 0.3; mvx = -dz / d * s2; mvz = dx / d * s2; }
        }
        else if (slot) { const k = Math.min(1, d / 1.2); if (d > wantDist) { mvx = dx / d * k; mvz = dz / d * k; } }
        else if (d > wantDist + 0.4) { mvx = dx / d; mvz = dz / d; if (!target) a.yaw = turn(a.yaw, Math.atan2(dx, dz), dt * 6); }
        else if (d < wantDist - 0.6 && target === hero) { mvx = -dx / d * 0.6; mvz = -dz / d * 0.6; }
        else if (target === hero && !a.token) {        // lượn vòng chậm quanh tướng
          const s2 = (a.id % 2 ? 1 : -1) * 0.2; mvx = -dz / d * s2; mvz = dx / d * s2;
        }
      }
      // Quân đồn trú bắn cung (có anchor, không phải toán vây tướng đồng minh) chỉ đứng bắn, lùi giữ tầm trong vòng Cứ Điểm
      // + AI.kiteLeash m quanh tâm: tới mép thì bỏ phần bước ra ngoài (trượt dọc mép); đang lùi mà bị chặn thì thôi lùi, bắn
      // trả. Trước đây thả diều không giới hạn: kéo tướng ra xa, một con sót lại giữ Cứ Điểm mãi (không chiếm được).
      if (ranged && target === hero && a.anchor && !a.anchor.target) {
        const lim = (a.anchor.r ?? 3) + AI.kiteLeash, ox = a.x - a.anchor.x, oz = a.z - a.anchor.z, od = Math.hypot(ox, oz);
        if (od > lim - 0.5) {
          const nx = ox / od, nz = oz / od, out = mvx * nx + mvz * nz;
          if (out > 0) { mvx -= out * nx; mvz -= out * nz; kiting = false; }
          if (od > lim) { mvx -= nx * 0.6; mvz -= nz * 0.6; }
        }
      }
      a.duel = duel; a.kiting = kiting;
      // tách nhau
      let sx = 0, sz = 0;
      const pool = a.side === "dich" ? enemies : allies;
      for (const b of pool) {
        if (b === a) continue;
        const ox = a.x - b.x, oz = a.z - b.z, o2 = ox * ox + oz * oz;
        if (o2 < 1.1 && o2 > 1e-6) { const o = Math.sqrt(o2); sx += ox / o * (1.05 - o); sz += oz / o * (1.05 - o); }
      }
      if (hero.alive) {
        const ox = a.x - hero.x, oz = a.z - hero.z, o = Math.hypot(ox, oz);
        if (o < 1.1 && o > 1e-6) { sx += ox / o * (1.1 - o) * 2; sz += oz / o * (1.1 - o) * 2; }
      }
      // lên dốc chậm, xuống dốc nhanh, bùn lầy; trận có lớp phủ bùn (B17): kỵ binh chậm gấp đôi trong bùn — B15 không có lớp phủ: lời gọi như cũ
      const tf = mvx !== 0 || mvz !== 0 ? (ovMud ? speedFactor(a.x, a.z, mvx, mvz, undefined, undefined, !!K.mounted) : speedFactor(a.x, a.z, mvx, mvz)) : 1;
      a.x += (mvx * a.speed * tf + sx * 4) * dt; a.z += (mvz * a.speed * tf + sz * 4) * dt;
      [a.x, a.z] = collide(ctx.world, a.x, a.z, 0.4, ctx.openGates, a);
      this.leash(a);
      this.stride(a, px, pz, dt);

      // ---- đánh ----
      a.atkCd -= dt;
      if (a.windup > 0) {
        a.windup -= dt;
        // nhịp nhanh ×every chỉ cho giáp lá cà cận chiến; cung, nỏ giữ nhịp bắn thường
        if (a.windup <= 0) { a.atkT = 0; this.strike(a); a.atkCd = TIERS[a.tier].every * (a.duel && !ranged ? AI.duel.every : 1) * (0.85 + 0.3 * rng.next()); }
      } else if (!kiting) {
        const canHit = (ranged || !routed) && target && (target === hero ? a.token : true) && dT <= (ranged ? range : reach + (duel ? 0.6 : 0.9) + (target.isBig ? target.radius : 0));
        if (canHit && a.atkCd <= 0) { a.windup = a.windupT = K.windup; a.fake = false; }
      }
    }

    this.updateArrows(dt);
  }

  // Dây xích cứng của quân đồn trú (đợt 12b, garrison.js leashClamp, số ở tuning.js GARRISON.hardLeash): neo có `hard` thì lính không rời tâm Cứ Điểm quá
  // bán kính đó, dù đang đuổi tướng, đấu tay đôi hay vỡ trận. Neo không có `hard` (đoàn thuyền B20, toán sự kiện) không đổi.
  leash(a) { if (a.anchor && a.anchor.hard) [a.x, a.z] = leashClamp(a.x, a.z, a.anchor); }

  // Tốc độ thật, hướng đi và pha bước chân lấy từ quãng đã đi (không bước khi bị đẩy, khi đứng); độ dài
  // chu kỳ khớp dáng đi nên bàn chân chống không trượt (soldier-motion.js advanceStride).
  stride(a, px, pz, dt) { advanceStride(a, px, pz, dt); }

  // Lính diễn ở tuyến: đứng đúng chỗ trong đội hình (director.fillActors giữ chỗ cố định, hàng sau bước lên lấp chỗ
  // người ngã). Hàng đầu hai bên ghép cặp theo cột (a.partner) cách nhau ~1,9 m, thay nhau chém — người bị chém giơ
  // khiên đỡ hoặc khựng người. Chỉ là diễn: không trừ máu; ai ngã do mô phỏng 1 Hz quyết (director.killActor).
  updateActor(a, dt) {
    const dx = a.sx - a.x, dz = a.sz - a.z, d = Math.hypot(dx, dz), px = a.x, pz = a.z;
    const K = a.K, face = a.side === "ta" ? Math.PI / 2 : -Math.PI / 2, rng = this.ctx.rng;
    const P = a.partner && a.partner.role === "actor" && a.partner.state !== "dead" && a.partner.alive ? a.partner : null;
    a.ready = a.frontRow || (K.ranged && d <= 0.3);
    if (a.march && d <= SUPPLY.arrive) a.march = false;                   // tới chỗ đứng: hết hành quân, đi bộ như thường
    if (d > 0.3) {
      const sp = Math.min(Math.min(a.speed * (a.march ? SUPPLY.marchMult : 1), a.march ? SUPPLY.marchMax : 1e9) * (d > 3 ? 1 : 0.8), d * 2);
      // đồn, doanh trại có tường (fort.js): lính diễn không va chạm nên tự đi vòng — tuyến dời ngang đồn, lính bù từ doanh trại ra tuyến đều không xuyên tường
      let mx = dx, mz = dz, md = d;
      const forts = this.ctx.world?.forts, w = forts && fortRoute(forts, a.x, a.z, a.sx, a.sz);
      if (w) { mx = w.x - a.x; mz = w.z - a.z; md = Math.hypot(mx, mz) || 1e-6; }
      a.x += mx / md * sp * dt; a.z += mz / md * sp * dt;
      a.yaw = turn(a.yaw, P && d < 2 ? Math.atan2(P.x - a.x, P.z - a.z) : Math.atan2(mx, mz), dt * 5);
    } else {
      a.yaw = turn(a.yaw, P ? Math.atan2(P.x - a.x, P.z - a.z) : face, dt * 4);
      a.fakeCd -= dt;
      // hàng đầu chém đối thủ trước mặt; cung, nỏ ở hàng sau bắn tên cảnh (không trúng ai)
      if (a.fakeCd <= 0 && a.windup <= 0 && P?.windup <= 0 && (a.frontRow || K.ranged)) {
        a.windup = a.windupT = K.windup; a.fake = true;
        a.fakeCd = K.ranged ? 2.5 + rng.next() * 4 : P ? 1.0 + rng.next() * 1.6 : 1.2 + rng.next() * 2.4;
      } else if (a.fakeCd <= 0 && !P && a.windup <= 0 && (a.frontRow || K.ranged)) {
        a.windup = a.windupT = K.windup; a.fake = true; a.fakeCd = 1.2 + rng.next() * 2.4;
      }
    }
    if (a.windup > 0) {
      a.windup -= dt;
      if (a.windup <= 0) {
        a.atkT = 0;
        if (K.ranged && this.arrows.length < 90) {
          const r = 14 + rng.next() * 12, s = rng.next() * 6 - 3;
          this.fireArrow(a, { x: a.x + Math.sin(face) * r + s, z: a.z + Math.cos(face) * r + s }, true);
        } else if (P && Math.hypot(P.x - a.x, P.z - a.z) < 3.4) {
          // đối thủ đỡ (có khiên thì giơ khiên) hoặc khựng người lùi nửa bước
          const kx = (P.x - a.x), kz = (P.z - a.z), l = Math.hypot(kx, kz) || 1, near = this.nearHero(a, 35);
          if (rng.chance(AI.block[P.kit] ? 0.55 : 0.3)) {
            P.blockT = 0.32; P.flinch = 0.08;
            if (near) { this.ctx.audio?.play("block", P.x, P.z); if (rng.chance(0.5)) this.ctx.fx?.spark(P.x - kx / l * 0.5, heightAt(P.x, P.z) + 1.3, P.z - kz / l * 0.5, false, 0xf1d98a); }
          } else {
            P.flinch = 0.18; P.flash = 0.06;
            if (near) { this.ctx.audio?.play("hitSoft", P.x, P.z); this.ctx.fx?.blood?.(P.x, heightAt(P.x, P.z) + 1.2, P.z, kx / l, kz / l, 0.35); }
          }
        }
      }
    }
    this.stride(a, px, pz, dt);
  }

  strike(a) {
    const ctx = this.ctx, t = a.target;
    if (!t) return;
    const tier = TIERS[a.tier];
    // Hoang mang (Kế Sách "Cờ áo Tống"): chính xác −30%
    if (a.panicT > 0 && ctx.rng.next() < 0.3) { if (t === ctx.hero) ctx.fx.text(a.x, a.z, "trượt", "#b0a090"); return; }
    if (a.K.ranged) { this.fireArrow(a, t); return; }
    const dx = t.x - a.x, dz = t.z - a.z, d = Math.hypot(dx, dz);
    if (d > (a.K.reach || 1.7) + 0.9 + (t.isBig ? t.radius : 0)) return;
    // nhát chém có bước dồn tới (nhìn rõ là đang đánh, không vung vào không khí)
    if (d > 1.1) { const l = Math.min(AI.duel.lunge, d - 1.1); a.x += dx / d * l; a.z += dz / d * l; }
    if (a.K.heavy) { ctx.fx?.dust(a.x + Math.sin(a.yaw) * 1.6, a.z + Math.cos(a.yaw) * 1.6, 0.8); if (t === ctx.hero || this.nearHero(a, 12)) ctx.fx?.shake(0.12); }
    if (t !== ctx.hero && this.nearHero(a, 30)) ctx.audio?.play(a.K.heavy ? "swingHeavy" : "swingSoft", a.x, a.z);
    if (t === ctx.hero) {
      const raw = a.cong * tier.mv * heSoGiap(ctx.hero.giap, ctx.R) * ctx.diff.dmg;
      // đòn lực sĩ là đòn nặng: cắt được đòn đang ra của tướng, phải né hoặc đỡ
      ctx.hero.receiveHit({ dmg: raw * (a.chargeHit ? AI.charge.dmg : 1) * (0.95 + 0.1 * ctx.rng.next()) * hitMult(a, ctx.hero), x: a.x, z: a.z, red: false, src: a, heavy: !!a.K.heavy, knockdown: a.chargeHit });
      a.chargeHit = false;
    } else if (t.isBig) {
      // lính đánh tướng đồng minh ×0,2 (ĐỀ XUẤT BẢN THỬ): 24 lính vây Nguyễn Khoái thì ông trụ ~60 s. Cận vệ Tự do (battle/guard.js) đặt
      // t.meleeMult riêng (data/guards.js GUARD_HIT).
      t.receiveHit?.({ dmg: a.cong * tier.mv * heSoGiap(t.giap, ctx.R) * (t.meleeMult ?? 0.2), x: a.x, z: a.z, src: a });
    } else if (t.alive) {
      const dmg = a.cong * tier.mv * heSoGiap(t.giap, ctx.R) * (a.side === "ta" ? 0.8 : 0.6) * hitMult(a, t) * (a.duel ? AI.duel.dmg[a.side] : 1) * this.flagMult(a);
      this.damage(t, dmg, { kx: dx / (d || 1), kz: dz / (d || 1), knock: a.K.heavy ? 3.5 : 1.5, by: a.side === "ta" ? "ally" : "enemy", src: a });
    }
  }

  // Cờ Tuyệt Kỹ (director.plantFlag): lính ta đứng trong bán kính cờ Công +atk. Trước đợt 9 cờ chỉ tăng Công cho tướng người
  // chơi (kể cả đòn vào Toa Đô), không lính nào được — ngược với mô tả "quân ta trong 20 m".
  flagMult(a) {
    const fl = a.side === "ta" ? this.ctx.director?.flags : null;
    if (!fl || !fl.length) return 1;
    for (const f of fl) if (Math.hypot(a.x - f.x, a.z - f.z) < f.r) return 1 + f.atk;
    return 1;
  }

  // fake: tên cảnh của lính diễn — bay thật, không trúng ai, không phát tiếng.
  fireArrow(a, t, fake = false) {
    const nav = this.ctx.naval;
    const g0 = a.deck ? nav.standY(a) : heightAt(a.x, a.z), y0 = g0 + (a.K.mounted ? 2.2 : 1.45) * a.scale;     // người bắn trên boong: chân ở mặt boong
    const tx = t.x + (t.vx || 0) * 0.3, tz = t.z + (t.vz || 0) * 0.3;
    // đích: người trên boong → mặt boong; điểm trên sông (B20) → mặt nước; còn lại mặt đất (B15 như cũ)
    const ty = (t.boatY ?? (t.deck ? (t.K ? nav.standY(t) : t.y) : nav && !t.K && !t.isBig && t !== this.ctx.hero ? nav.surfaceY(tx, tz) : heightAt(tx, tz))) + (fake ? 0 : 1.2);
    const d = Math.hypot(tx - a.x, tz - a.z), T = Math.max(0.35, d / 26);
    // heroMult: tên địch trúng tướng được bao nhiêu (tuning.arrowHeroMult) — nhắm tướng 1, tên lạc (đích trong AI.stray.r m
    // quanh tướng lúc buông) AI.stray.dmg, còn lại 0 (đợt 9; trước đây mọi tên địch bay qua người tướng đều trúng đủ)
    const hero = this.ctx.hero;
    const heroMult = fake || a.side !== "dich" || !hero?.alive ? 0 : arrowHeroMult(t === hero, Math.hypot(t.x - hero.x, t.z - hero.z));
    this.arrows.push({ x: a.x, y: y0, z: a.z, vx: (tx - a.x) / T, vz: (tz - a.z) / T, vy: (ty - y0) / T + 4.9 * T, t: 0, T: T + 0.4, T0: T, src: a,
      side: fake ? "fx" : a.side, tgt: fake ? null : t, g0, duel: !!a.duel, heroMult });     // g0: chân người bắn lúc buông tên (thế đất cao)
    if (!fake) this.ctx.audio?.play(a.kit === "DV_NO" ? "crossbow" : "bow", a.x, a.z);
  }

  updateArrows(dt) {
    const ctx = this.ctx, hero = ctx.hero;
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const r = this.arrows[i];
      r.t += dt; r.x += r.vx * dt; r.z += r.vz * dt; r.y += r.vy * dt; r.vy -= 9.8 * dt;
      // tên dừng ở mặt đất, boong hoặc MẶT NƯỚC (surfaceY; B15 không có nước: đúng heightAt như cũ)
      let done = r.t > r.T || r.y < surfaceY(r.x, r.z);
      // mục tiêu không phải tướng người chơi (thuyền, tướng đồng minh): tính trúng khi tên tới nơi
      if (!done && r.tgt && r.tgt !== hero && r.t >= r.T0) {
        const g = r.tgt, a = r.src;
        if (g.K) {      // lính thường: tính như đòn cận chiến giữa hai đám lính
          const d = Math.hypot(g.x - r.x, g.z - r.z), v = Math.hypot(r.vx, r.vz) || 1;
          // tên bắn trong giáp lá cà cũng nhân hệ số phe (không thì cung kỵ Nguyên — 40% quân — bắn gục quân ta gấp ba lần bị hạ)
          if (d < 1.6 && this.hittable(g)) this.damage(g, a.cong * TIERS[a.tier].mv * heSoGiap(g.giap, ctx.R) * (r.side === "ta" ? 0.8 : 0.6) * heightDamageMult(r.g0 - heightAt(g.x, g.z)) * (r.duel ? AI.duel.dmg[r.side] : 1) * this.flagMult(a),
            { kx: r.vx / v, kz: r.vz / v, knock: 1.2, by: r.side === "ta" ? "ally" : "enemy", src: a });
        } else if (g.alive !== false && Math.hypot(g.x - r.x, g.z - r.z) < 3) g.receiveHit?.({ dmg: a.cong * TIERS[a.tier].mv * 0.85 * (g.arrowMult ?? 0.2), x: a.x, z: a.z, src: a, arrow: true });
        done = true;
      }
      // tên trúng tướng: tên nhắm tướng (đủ sát thương) hoặc tên lạc (× AI.stray.dmg) — heroMult quyết lúc buông (fireArrow)
      if (!done && r.side === "dich" && r.heroMult > 0 && hero.alive && Math.hypot(hero.x - r.x, hero.z - r.z) < 0.9 && Math.abs(r.y - (hero.y + 1.1)) < 1.3) {
        const a = r.src, tier = TIERS[a.tier];
        hero.receiveHit({ dmg: a.cong * tier.mv * 0.85 * heSoGiap(hero.giap, ctx.R) * ctx.diff.dmg * heightDamageMult(r.g0 - hero.y) * r.heroMult,
          x: r.x - r.vx * 0.1, z: r.z - r.vz * 0.1, red: false, src: a, arrow: true });
        done = true;
      }
      if (done) { if (ctx.naval && r.y < ctx.naval.world.tideY + 0.05 && this.nearHero(r, 35)) ctx.naval.splash(r.x, r.z, 0.3); this.arrows.splice(i, 1); }
    }
  }

  // Thẻ tấn công: tối đa N lính cận chiến đánh tướng cùng lúc (21.6: 3 ở Quân sĩ). Lính bắn xa có
  // thẻ riêng = N × AI.rangedTok (ĐỀ XUẤT BẢN THỬ; đợt 9: 0,67 → 0,34) — không có thẻ thì 12 cung kỵ cùng bắn hạ tướng trong 12 s.
  assignTokens(enemies) {
    const hero = this.ctx.hero, N = this.ctx.diff.tokens, NR = Math.max(1, Math.round(N * AI.rangedTok));
    const isR = (e) => !!e.K.ranged;
    let held = 0, heldR = 0;
    for (const e of enemies) {
      if (!e.token) continue;
      const d = Math.hypot(e.x - hero.x, e.z - hero.z);
      if (d > (isR(e) ? 24 : 9) || e.state === "dead" || !hero.alive) e.token = false;
      else if (isR(e)) heldR++; else held++;
    }
    if (!hero.alive) return;
    // lính đang giáp lá cà với quân ta được thẻ sau (xa thêm 5 m): quân ta cầm chân được địch, tướng bớt bị vây
    // Xếp ứng viên theo d2 tăng dần, bằng nhau giữ thứ tự cũ (như sort ổn định của bản cũ). Ứng viên d2 ≥ 22² không bao giờ được thẻ (cung cần
    // < 22², cận chiến < 9²) nên bỏ trước khi xếp — thứ tự phần còn lại y như xếp cả danh sách, thẻ trao y hệt; xếp chèn vào mảng dùng lại
    // (đợt 19c: trước đây filter → map → sort cấp phát mỗi bước).
    const clk = this.ctx.clock, CE = this.candE, CD = this.candD;
    let n = 0;
    for (const e of enemies) {
      if (e.token || e.tauntT > clk) continue;
      const d2 = (e.x - hero.x) ** 2 + (e.z - hero.z) ** 2 + (e.foe ? 25 : 0);
      if (!(d2 < 22 * 22)) continue;
      let j = n++;
      while (j > 0 && CD[j - 1] > d2) { CE[j] = CE[j - 1]; CD[j] = CD[j - 1]; j--; }
      CE[j] = e; CD[j] = d2;
    }
    for (let i = 0; i < n; i++) {
      const e = CE[i], d2 = CD[i];
      if (isR(e)) { if (heldR < NR && d2 < 22 * 22) { e.token = true; heldR++; } }
      else if (held < N && d2 < 81) { e.token = true; held++; }
      if (held >= N && heldR >= NR) break;
    }
    CE.length = 0;
  }

  // ---- vẽ ----------------------------------------------------------------------------------
  // Đầu mỗi bước mô phỏng (battle/view.js capture): vị trí, độ cao bay, hướng trước khi bước chạy — bản sao để vẽ.
  capture(tick) { for (const a of this.agents) { a.ix = a.x; a.iz = a.z; a.iy = a.y; a.iyaw = a.yaw; a.itk = tick; } }

  // Hoạt ảnh chạy theo giờ vẽ (ctx.view.clock: đồng hồ trận lùi (1 − α) bước; không có view thì ctx.clock), nên hit-stop đóng băng cả
  // đám lính (kể cả lò xo vạt áo, dây tua: dtA = 0). Vị trí, hướng vẽ nội suy giữa đầu bước cuối và hiện tại theo α (đợt 19c).
  // Hai lượt (đợt 19c): lượt 1 mọi lính — chỗ vẽ, mức chi tiết có trễ, trong khung nhìn hay không; lính GLB trong khung đếm theo mức (lính cùng
  // mức nằm liền nhau trong texture khớp từ uBase của mức). Lượt 2 chỉ lính trong khung — đúng các lính đã đếm, nên chỉ số nền các mức liền
  // nhau và số hàng texture khớp tải lên phủ đúng số lính được vẽ. Lính khuất giữ nguyên a.mc, không IK; vào lại khung thì tính tư thế từ đầu,
  // đặt lại lò xo vạt, dây tua, trọng số IK (resetMotion) — không giật từ trạng thái cũ.
  render() {
    const V = this.ctx.view, clk = this.ctx.clock, rc = V ? V.clock : clk, al = V ? V.alpha : 1, tk = V ? V.tick : -1;
    const dtA = Math.min(0.1, Math.max(0, rc - (this.lastClock ?? rc))), nav = this.ctx.naval;
    this.lastClock = rc;
    const kSoft = 1 - Math.exp(-dtA * 18), kSnap = 1 - Math.exp(-dtA * 55);
    const counts = this.counts, lodN = this.lodN, lodC = this.lodC, frame = ++this.frame;
    for (const k of KIT_IDS) {
      counts[k] = 0;
      if (this.meshes[k].glb) { (lodN[k] ||= [0, 0, 0]).fill(0); (lodC[k] ||= [0, 0, 0]).fill(0); }
    }
    const camera = this.ctx.camera, cam = camera?.position, hero = this.ctx.hero;
    if (camera) viewPlanes(camera);
    for (const a of this.agents) {
      let x = a.x, z = a.z, y = a.y, yaw = a.yaw;
      if (a.itk === tk && al < 1) {
        const dx = x - a.ix, dz = z - a.iz;
        if (dx * dx + dz * dz <= SNAP2) { x = a.ix + dx * al; z = a.iz + dz * al; y = a.iy + (y - a.iy) * al; yaw = lerpYaw(a.iyaw, yaw, al); }
      }
      a.rx = x; a.rz = z; a.ry = y; a.ryaw = yaw;
      a.lv = lodLevel(a.lv, cam ? (x - cam.x) ** 2 + (z - cam.z) ** 2 : 0);
      // độ cao đất cho hình cầu khung nhìn: mẫu của lần vẽ trước, lấy lại khi đã dời quá 1 m (lính khuất không lấy mỗi khung; lính trong
      // khung lấy đúng ở lượt 2)
      if (!(Math.abs(x - a.gx) + Math.abs(z - a.gz) <= 1)) { a.gy = nav ? nav.standY(a) : heightAt(x, z); a.gx = x; a.gz = z; }
      const sc = a.scale, vis = !camera || inView(x, a.gy + y + 0.9 * sc, z, (a.K.mounted ? 2.2 : 1.3) * sc + VIEW_PAD);
      if (vis && !a.inView) { a.poseInit = false; resetMotion(a); }
      a.inView = vis;
      const M = this.meshes[a.kit];
      if (!M.glb) { a.lod = 0; continue; }
      a.lod = a.lv < M.meshes.length ? a.lv : M.meshes.length - 1;
      if (vis) lodN[a.kit][a.lod]++;
    }
    for (const k in lodN) { const B = this.meshes[k].bases, n = lodN[k]; let o = 0; for (let l = 0; l < B.length; l++) { B[l].value = o; o += n[l]; } }
    let nb = 0;
    for (const a of this.agents) {
      if (!a.inView) continue;
      const M = this.meshes[a.kit];
      let i = counts[a.kit], li = 0;
      if (M.glb) { li = lodC[a.kit][a.lod]; i = M.bases[a.lod].value + li; }
      if (i >= CAP) continue;
      counts[a.kit]++;
      if (M.glb) lodC[a.kit][a.lod]++;
      // đứng yên thì khỏi lấy lại; trên boong (boong chạy, dập dềnh) và đang bơi thì lấy mỗi khung (naval.standY)
      const x = a.rx, z = a.rz;
      if (a.deck || a.gx !== x || a.gz !== z || a.state === "swim") { a.gy = nav ? nav.standY(a) : heightAt(x, z); a.gx = x; a.gz = z; }
      const gy = a.gy;
      const sink = a.state === "dead" && a.dieT > 1.8 ? (a.dieT - 1.8) * 1.0 : 0;
      const lv = a.lv, y = gy + a.ry - sink, mc = a.mc;
      const far = hero ? (x - hero.x) ** 2 + (z - hero.z) ** 2 > FAR2 : lv === 2;      // tư thế 20 Hz
      if (!far || !a.poseInit || (frame + a.id) % 3 === 0) {
        const P = a.pose;
        if (!a.poseInit || far) { poseFor(a, a.kit, a.K, clk, _pose); P.set(_pose); a.poseInit = true; a.tc1 = NaN; }
        else {
          this.target(a, clk, rc, _pose);
          const k = a.atkT < 0.14 || a.state === "hit" ? kSnap : kSoft;
          smoothPose(P, _pose, k, Math.max(k, 1 - Math.exp(-dtA * legRate(a))));
        }
        // tư thế → IK chân (bản nháp) → lò xo vạt → ma trận khớp → tua giáo/đuôi ngựa, thẳng vào a.mc; IK, vạt, tua chỉ ở LOD0
        soldierFrame(a, M.skel, x, y, z, gy, P, dtA, heightAt, lv === 0, mc, a.ryaw);
        a.mx = x; a.my = y; a.mz = z;
      } else if (a.mx !== x || a.my !== y || a.mz !== z) {
        // xa tướng, giữa hai lần tính tư thế: dời cả bộ ma trận theo chỗ vẽ mới (tư thế 20 Hz, vị trí mỗi khung — không giật bước 3 khung)
        const dx = x - a.mx, dy = y - a.my, dz = z - a.mz;
        for (let o = 0; o < BONE_FLOATS; o += 12) { mc[o + 3] += dx; mc[o + 7] += dy; mc[o + 11] += dz; }
        a.mx = x; a.my = y; a.mz = z;
      }
      M.data.set(mc, i * BONE_FLOATS);

      // màu: mỗi lính lệch sáng tối một chút cho đám đông khỏi đúc khuôn; chớp trắng khi trúng
      const k = a.flash > 0 ? 2.6 : 0.9 + 0.2 * ((a.id * 0.377) % 1);
      if (a.tint) _c.setRGB(a.tint[0] * k, a.tint[1] * k, a.tint[2] * k);
      else if (a.tier === "tinhnhue") _c.setRGB(0.8 * k, 0.76 * k, 0.64 * k); else _c.setRGB(k, k, k);
      if (a.panicT > 0 && Math.floor(a.bob) % 2) _c.multiplyScalar(1.35);
      if (a.chargeT > 0) { const f = 0.5 + 0.5 * Math.sin(clk * 34); _c.setRGB(1.7 + 0.6 * f, 0.5, 0.4); }
      else if (a.windup > 0 && !a.fake && a.target === this.ctx.hero) {
        if (a.K.heavy) { const f = 0.5 + 0.5 * Math.sin(clk * 30); _c.setRGB(1.5 + 0.7 * f, 0.55 + 0.2 * f, 0.45); }
        else _c.setRGB(1.5, 0.9, 0.8);
      }
      if (M.glb) M.colors[a.lod].setXYZ(li, _c.r, _c.g, _c.b); else M.color.setXYZ(i, _c.r, _c.g, _c.b);
      if (nb < 2200 && sink < 0.5 && a.state !== "swim") {
        _p.set(x, gy + 0.06, z); _s.setScalar(a.K.mounted ? 1.5 : a.scale);
        _m.compose(_p, _q.identity(), _s); this.blob.setMatrixAt(nb++, _m);
      }
    }
    // Tải lên GPU chỉ phần đang dùng; rỗng thì không đánh dấu tải (addUpdateRange(0, 0) trong WebGL2 là tải CẢ buffer — bóng tròn 2200 ma trận
    // 140 KB, màu mỗi mức 10,8 KB mỗi khung trước đây, kể cả mức không có ai)
    for (const k of KIT_IDS) {
      const M = this.meshes[k], n = counts[k];
      if (M.glb) {
        for (let l = 0; l < M.meshes.length; l++) {
          const c = Math.min(lodC[k][l], Math.max(0, CAP - M.bases[l].value));
          M.meshes[l].count = c;
          if (c > 0) { const C = M.colors[l]; C.clearUpdateRanges(); C.addUpdateRange(0, c * 3); C.needsUpdate = true; }
        }
      } else {
        M.mesh.count = n;
        if (n > 0) { M.color.clearUpdateRanges(); M.color.addUpdateRange(0, n * 3); M.color.needsUpdate = true; }
      }
      if (n > 0) {       // chỉ tải các hàng texture đang dùng (mỗi hàng một lần texSubImage2D)
        const rows = Math.ceil((n * BONE_FLOATS) / 4 / BONE_TEX_W);
        M.tex.clearUpdateRanges();
        for (let r = 0; r < rows; r++) M.tex.addUpdateRange(r * BONE_TEX_W * 4, BONE_TEX_W * 4);
        M.tex.needsUpdate = true;
      }
    }
    this.blob.count = nb;
    if (nb > 0) { const I = this.blob.instanceMatrix; I.clearUpdateRanges(); I.addUpdateRange(0, nb * 16); I.needsUpdate = true; }
    // mũi tên: lùi theo vận tốc về giờ vẽ (bay thẳng trong một bước; tên vừa buông không lùi quá chỗ buông)
    const lag = V ? V.lag : 0;
    let na = 0;
    for (const r of this.arrows) {
      if (na >= 200) break;
      const b = Math.min(lag, r.t);
      _p.set(r.x - r.vx * b, r.y - r.vy * b, r.z - r.vz * b);
      _e.set(-Math.atan2(r.vy, Math.hypot(r.vx, r.vz)), Math.atan2(r.vx, r.vz), 0); _q.setFromEuler(_e);
      _m.compose(_p, _q, _s.setScalar(1)); this.arrowMesh.setMatrixAt(na++, _m);
    }
    this.arrowMesh.count = na;
    if (na > 0) { const I = this.arrowMesh.instanceMatrix; I.clearUpdateRanges(); I.addUpdateRange(0, na * 16); I.needsUpdate = true; }
  }

  // Đích tư thế của lính gần ở giờ vẽ rc vào out: poseFor chỉ chạy khi có bước mới (đồng hồ trận đổi) — đích trước giữ ở a.tp0 (giờ a.tc0),
  // đích mới ở a.tp1 (a.tc1 = clk) — rồi nội suy theo rc: màn 120 Hz, chậm hình thấy bước chân, nhát vung liền mạch, và khung không có bước
  // khỏi tính lại poseFor. Lần đầu, vừa từ xa về, nhảy giờ quá MAX_STEPS bước: lấy đích mới, không nội suy.
  target(a, clk, rc, out) {
    if (a.tc1 !== clk) {
      const T = a.tp0; a.tp0 = a.tp1; a.tp1 = T;
      poseFor(a, a.kit, a.K, clk, a.tp1);
      if (clk > a.tc1 && clk - a.tc1 < (MAX_STEPS + 0.5) * STEP) a.tc0 = a.tc1; else { a.tp0.set(a.tp1); a.tc0 = clk; }
      a.tc1 = clk;
    }
    const T0 = a.tp0, T1 = a.tp1, w = a.tc1 > a.tc0 ? (rc - a.tc0) / (a.tc1 - a.tc0) : 1;
    if (w >= 1) out.set(T1);
    else if (w <= 0) out.set(T0);
    else for (let c = 0; c < NCH; c++) out[c] = T0[c] + (T1[c] - T0[c]) * w;
  }
}

export function turn(cur, target, k) {
  let d = target - cur;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return cur + d * Math.min(1, k);
}
