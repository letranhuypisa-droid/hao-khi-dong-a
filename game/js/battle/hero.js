// battle/hero.js — tướng người chơi, dựng theo HEROES[id] (data/heroes.js): H35 Trần Quốc Toản (WC03 Song đao, mặc định —
// B15 chạy y hệt trước đợt 9), H31 Trần Hưng Đạo (WC01 Đại kiếm). GDD mục 3, Đặc tả 21.6, systems §4.4.
//
// Máy trạng thái: free · attack · dodge · block · hit · down · skill · ult · dead.
// Bộ đệm input 0,15 s. Hủy đòn vào Né ở 30% cuối clip. Đòn thường của lính không ngắt được
// đòn đang ra (giáp đòn) — chỉ đòn nặng, đòn viền đỏ mới ngắt (ĐỀ XUẤT BẢN THỬ).
//
// Theo tướng: this.def (HEROES[id]), this.cls (WEAPON_CLASSES), this.M (bảng đòn: H35 = MOVES của tuning.js, cùng đối tượng),
// this.F (cờ từng đòn, heroes.js moveFlags — H35 suy đúng luật tên đòn / MV cũ), this.A (ANIMS[lớp]), this.P (tư thế ngoài
// đòn theo lớp), rig RIGS[def.rig], vệt lưỡi theo rig.dyn.blades, kỹ năng theo hero-skills.js.
// Lớp WC01 (trait trong weapon-classes.js):
//   · Tụ lực: C1 / C4 / C6 bấm rồi GIỮ C — clip dừng ở khung gồng (chargeU), cấp 1 → 2 (0,4 s) → 3 (0,8 s), tự tung ở 1,2 s;
//     MV × 1 / 1,3 / 1,7, cấp 3 thêm đẩy lùi +2 và hất tung. hero.chargeLevel (0 = không tụ, 1..3) cho HUD.
//   · Siêu giáp: trong cửa sổ m.armor của đòn đang ra, đòn nặng và đòn hất ngã không ngắt (đòn viền đỏ vẫn ngắt — ĐỀ XUẤT).
//   · C3 giữ C: lốc kiếm quay thêm tới hold.maxHits nhát. C6 bỏ qua 30% giáp (armorPen).
//   · Không có Liên hoàn (chỉ WC03).
// Lớp WC09 Cung (đợt B17-B1; H40 — mọi nhánh dưới chỉ chạy khi this.ranged, H35 / H31 y như cũ):
//   · Đòn hình "ray" / "rain" (moves-wc09.js) không trúng tức thì: applyHits → shoot() thả mũi tên bay thật (this.shots, mỗi bước
//     dời sp × dt, trúng người đầu tiên trên đoạn vừa bay rồi xuyên tới pierce người; vẽ bằng crowd.arrows "fx") hay hẹn mưa tên
//     (this.pending, mẫu "đòn hẹn giờ" của guard.js). Trúng: landHit() — cùng phép tính sát thương / Phá Thế / hiệu ứng như applyHits.
//   · Ngắm (§3.3): aimYaw mỗi bước — khoá mục tiêu; PC: hướng camera (tâm màn); cảm ứng / tay cầm: hướng cần, không có thì camera.
//     Tự nhắm aimTarget(): nón ±aimCone quanh hướng ngắm, tới aimRange m, cả lính thường (kể cả lính diễn). Giữ C ở C1 (căng dây):
//     ngắm chính xác — bắn đúng hướng ngắm, không tự nhắm (this.precise); camera dí vai (battle.js), tâm ngắm thu nhỏ (hud.js).
//   · Đi khi bắn (moveShoot): chân bước theo cần × ranged.moveShoot, thân trên giữ thế bắn (anim.js guardStep).
//   · Khí Lực nạp khi địch trong ranged.kiR m (cận chiến 12 m). Tên cầm tay (models.js handArrow) hiện khi đang lắp / kéo dây.
// Thủy chiến B20 (naval.js; B15 không bao giờ vào các nhánh này): trạng thái "ride" (đứng trên đò chuyển: không đánh, không
// đỡ, tên vẫn trúng nhưng không khựng) và "climb" (leo boong 0,8 s: naval.js đặt x, z, climbY; tướng không va chạm, chân
// không bám đất). Tướng trên boong mang this.deck (naval chở theo toạ độ cục bộ); va chạm truyền chính tướng (tham số thứ
// 6 của collide) để lan can boong, nước sâu giữ lại.

import { makeRig, RIGS, handArrow } from "./models.js";
import { RigMotion } from "./rig-motion.js";
import * as A from "./anim.js";
import { heightAt, collide } from "./world.js";
import { HERO, DEFENSE, POISE_PER_MV, C_POISE_MULT, heSoGiap, CRIT_MULT, GATE_MULT, HAO_KHI, IMPACT, hitRadius, hitPad } from "../data/tuning.js";
import { HEROES, SKILLS, CHAINS, movesetOf, moveFlags } from "../data/heroes.js";
import { WEAPON_CLASSES, poisePerMv, chargeMult, chargeLevel } from "../data/weapon-classes.js";
import { moveInfoOf, nextHeavy } from "../data/moves-info.js";
import { turn } from "./crowd.js";
import { speedFactor, hitMult } from "../sim/terrain-rules.js";   // dốc, bùn, thế đất cao (chỉ chạy thường, sát thương)
import { ANIMS } from "./hero-anim.js";
import { POSES_WC01 } from "./anim-wc01.js";
import { POSES_WC09 } from "./anim-wc09.js";
import { SKILL_IMPL } from "./hero-skills.js";
import { BladeTrail } from "./trail.js";
import { inCone } from "./hitshape.js";
import * as THREE from "three";

const _b = new THREE.Vector3(), _t = new THREE.Vector3(), _s = new THREE.Vector3();
const NO_IK = { ik: false };           // đang leo boong: chân không bám đất (rig-motion.js)
// Tự nhắm thấy cả lính diễn phe địch trong chừng này m (đợt 15b, ĐỀ XUẤT BẢN THỬ): đứng trong khối quân Nguyên, người trông gần nhất thường là lính
// diễn — trước đây tự nhắm bỏ qua họ nên tướng quay đi chém người khác; nay nhát chém chạm vào là họ thành lính thật (crowd.enlist).
const AUTO_ACTOR_R = 4;
// Tên của tướng (WC09): bán kính thân tên cộng vào vòng trúng của người; độ cao buông tên (× cỡ rig); hệ số vào cổng (tên không phá
// cổng gỗ như chém) — ĐỀ XUẤT BẢN THỬ.
const ARROW_R = 0.12, ARROW_Y = 1.42, ARROW_GATE = 0.3;
const wrapA = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
// Đoạn bay (x, z) → (x + fx·len, z + fz·len) có cắt vòng tâm (cx, cz) bán kính r không: trả quãng dọc đoạn tới chỗ gần tâm nhất
// (0..len) hoặc −1. Xuất ra cho tests/wc09.test.mjs.
export function segHit(x, z, fx, fz, len, cx, cz, r) {
  const px = cx - x, pz = cz - z, t = Math.max(0, Math.min(len, px * fx + pz * fz));
  const qx = px - fx * t, qz = pz - fz * t;
  return qx * qx + qz * qz <= r * r ? t : -1;
}
// Vẽ ngẫu nhiên không ăn vào ctx.rng (trận tất định): băm số nguyên → 0..1
const hash01 = (n) => { let t = (n * 0x9e3779b1) >>> 0; t ^= t >>> 15; t = Math.imul(t, 0x85ebca6b) >>> 0; t ^= t >>> 13; return (t >>> 0) / 4294967296; };

// Tư thế ngoài đòn theo lớp: WC03 là bộ song đao của anim.js (như cũ), WC01 bộ đại kiếm của anim-wc01.js.
const POSES = {
  WC03: { idle: A.idle, run: A.run, hitReact: A.hitReact, dodgeRoll: A.dodgeRoll, knockdown: A.knockdown, block: A.BLOCK },
  WC01: POSES_WC01,
  WC09: POSES_WC09,
};
// Vệt lưỡi theo vũ khí: màu, tuổi (s), điểm chuôi / mũi dọc trục z của bàn tay. songdao = đúng số cũ của H35 (BLADE_BASE /
// BLADE_TIP 0,32 → 1,06, màu 0xd9b36a, 0,14 s). Vũ khí khác: mũi = điểm đầu của edge trong rig.dyn.blades, chuôi 0,15 m.
const TRAILS = { songdao: { color: 0xd9b36a, life: 0.14, base: 0.32, tip: 1.06 }, daikiem: { color: 0xffc27a, life: 0.2, base: 0.18, tip: 1.3 } };
// Màu tụ lực theo cấp (vàng → cam → son), ĐỀ XUẤT BẢN THỬ
const CHARGE_COL = [0xf1d98a, 0xffa040, 0xff4a2a], CHARGE_RGB = ["241,217,138", "255,160,64", "255,74,42"], ROMAN = ["I", "II", "III"];

export class Hero {
  constructor(ctx, stats, def = HEROES.H35) {
    this.ctx = ctx; this.stats = stats; this.mods = stats.mods;
    this.def = def; this.id = def.id;
    this.cls = WEAPON_CLASSES[def.cls] || WEAPON_CLASSES.WC03;
    this.M = movesetOf(def); this.A = ANIMS[def.anim || def.cls] || ANIMS.WC03; this.P = POSES[this.cls.id] || POSES.WC03;
    this.chainN = CHAINS[def.moves || def.cls] || CHAINS.WC03;
    this.F = {}; for (const k in this.M) this.F[k] = moveFlags(k, this.M[k]);
    this.poisePerMv = this.cls.id === "WC03" ? POISE_PER_MV : poisePerMv(this.cls);
    this.rangeMul = def.rangeMul ?? 1;
    this.lienHoanOn = !!this.cls.traits?.lienHoan; this.chargeTrait = this.cls.traits?.charge || null; this.superArmor = !!this.cls.traits?.superArmor;
    // tầm xa (WC09): hướng ngắm, tên đang bay, việc hẹn giờ (mưa tên). kiR: Khí Lực nạp khi địch trong chừng này m (cận chiến 12 như cũ)
    this.ranged = this.cls.traits?.ranged || null; this.kiR = this.ranged ? this.ranged.kiR : 12;
    this.shots = []; this.pending = []; this.aimYaw = null; this.aimMark = null; this.precise = false; this.aiming = false; this.rangeBonus = 1;
    this.moveInfo = moveInfoOf(def);
    const rigCfg = RIGS[def.rig] || RIGS.hero;
    this.rig = makeRig(rigCfg);
    this.motion = new RigMotion(this.rig);        // chân bám đất, vạt áo, dải khăn, cờ (rig-motion.js)
    ctx.scene.add(this.rig.root);
    // vệt lưỡi: một vệt mỗi lưỡi trong rig.dyn.blades (song đao: tay phải rồi tay trái như cũ), tâm cung là vai cùng bên. Thân GLB
    // (rig.dyn.blade: chắn tay → mũi lưỡi GLB, models.js): cùng đoạn dọc lưỡi như số rig khối (lưỡi khối từ 0,16) — trước đây dùng
    // thẳng số rig khối: vệt, tia lửa tụ lực vượt mũi lưỡi GLB (song đao 0,80, đại kiếm 1,14) 0,16–0,26 m
    const TR = TRAILS[rigCfg.weapon], p = this.rig.p, G = this.rig.glb && this.rig.dyn.blade;
    const onBlade = (z) => (G ? G.guard + ((z - 0.16) / (TR.tip - 0.16)) * (G.tip - G.guard) : z);
    this.trailSrc = this.rig.dyn.blades.map((b) => {
      const tip = TR ? onBlade(TR.tip) : b.pts[2], base = TR ? onBlade(TR.base) : 0.15;
      return { j: b.j, pivot: b.j === p.handL ? p.shL : p.shR, base: new THREE.Vector3(0, TR ? 0.02 * (rigCfg.weapon === "songdao") : b.pts[1], base),
        tip: new THREE.Vector3(0, TR ? 0.02 * (rigCfg.weapon === "songdao") : b.pts[1], tip) };
    });
    this.trails = this.trailSrc.map(() => new BladeTrail(ctx.scene, TR?.color ?? 0xd9b36a, TR?.life ?? 0.14));
    const sp = ctx.battle?.heroSpawn;
    this.x = sp?.x ?? 72; this.z = sp?.z ?? -32; this.yaw = sp?.yaw ?? Math.PI / 2;     // B15: ngoài rào bản doanh, để camera không kẹt vào lều
    // vx/vz: vận tốc thật (m/s) đo mỗi bước — cung địch bắn đón theo đó (crowd.fireArrow). Trước đợt 9 dòng khởi tạo này
    // nằm lọt trong chú thích ở dòng trên, không ai gán vx/vz nên tên địch luôn bắn vào chỗ tướng đang đứng.
    this.vx = 0; this.vz = 0; this.y = 0;
    this.maxHp = stats.hp; this.hp = this.maxHp; this.giap = stats.giap;
    this.kiBars = stats.kiBars ?? def.kiLucBars;
    this.ki = 0; this.kiMax = this.kiBars * def.kiLucPerBar;
    this.revives = ctx.diff.revive; this.alive = true;
    this.state = "free"; this.st = 0; this.move = null; this.chain = 0; this.chainGrace = 0;
    this.buf = null; this.dodgeChain = 0; this.dodgeCd = 0; this.postDodge = 0;
    this.invuln = 0; this.parryAt = -9; this.parryLock = 0; this.blocking = false; this.blockT = 0;
    this.phaTran = { cd: 0, left: 0, window: 0 };   // H35; tướng khác giữ đối tượng rỗng cho mã cũ đọc (HUD, bot)
    this.skillCd = {};                              // hồi chiêu kỹ năng H31… theo id (hero-skills.js)
    this.buffs = { atk: 0, atkT: 0, flag: 0, flagT: 0 };
    this.combo = 0; this.comboT = 0; this.lienHoan = 0; this.lienHoanT = 0;
    this.pose = this.P.idle(0); this.animT = 0; this.runPhase = 0; this.swingId = 0;
    this.lock = null; this.hkUltReady = false;
    this.kiEngaged = 0; this.koHealAcc = 0; this.inTouch = false;
    this.heldC = false; this.charge = null; this.chargeLevel = 0; this.chargeLv = 0; this.chargeMul = 1;
    // kỹ năng theo ô: sk[1], sk[2] (có thể thiếu), ult; skillList: những kỹ năng có tick (đếm hồi chiêu) theo thứ tự ô
    const S = def.skills || {};
    this.sk = { 1: SKILL_IMPL[S.sk1] || null, 2: SKILL_IMPL[S.sk2] || null };
    this.ultImpl = SKILL_IMPL[S.ult] || SKILL_IMPL.bopNat;
    this.skillList = [this.sk[1], this.sk[2], this.ultImpl].filter((s) => s?.tick);
    this.skillActive = null;
    this.passive = SKILL_IMPL[S.passive]?.tick ? SKILL_IMPL[S.passive] : null;      // nội tại có móc chạy (H40 Thánh Dực Dũng Nghĩa)
    this.handArrow = this.ranged ? handArrow(this.rig) : null;                      // tên cầm tay (WC09)
    A.applyPose(this.rig, this.pose);
    this.place(0);
  }

  get atkSpeed() { return this.def.atkSpeed * (1 + this.mods.atkSpeed + 0.04 * this.lienHoan); }
  get parryWindow() { return (this.inTouch ? DEFENSE.parryWindowTouch : DEFENSE.parryWindow) + this.mods.parryWin; }
  get inTPC() { return this.ctx.hk.tpc; }

  // Bộ đệm giữ phím bấm trong lúc đang ra đòn cho tới khi đòn kế được phép (bấm dồn), ngoài ra
  // giữ 0,15 s. swing ghi lại đòn đang ra lúc bấm để biết khi nào hết hạn.
  press(action) { this.buf = { a: action, t: this.ctx.clock, swing: this.state === "attack" ? this.swingId : -1 }; }

  // Nhận phím cạnh MỖI KHUNG HÌNH, kể cả khung không chạy bước mô phỏng nào (hit-stop, màn
  // 120/144 Hz, vòng Mệnh Lệnh ×0,2). Trước đây phím chỉ được đọc ở bước đầu tiên của khung, nên
  // khung 0 bước làm rơi mất phím: bấm dồn khi đang chém trúng (hit-stop) hầu như không ăn.
  intake(inp) {
    if (!this.alive) return;
    const P = inp.pressed;
    if (P.n) this.press("n");
    if (P.c) this.press("c");
    if (P.dodge) this.press("dodge");
    if (P.skill) this.press("skill");
    if (P.skill2 && this.sk[2]) this.press("skill2");
    if (P.ult) this.press("ult");
    if (P.block && this.ctx.clock > this.parryLock) this.parryAt = this.ctx.clock;
  }

  update(dt, inp) {
    const ctx = this.ctx, px = this.x, pz = this.z;
    this.animT += dt; this.inTouch = inp.touch;
    this.heldC = !!inp.held?.c;
    for (const tr of this.trails) tr.update(dt);
    this.invuln = Math.max(0, this.invuln - dt); this.dodgeCd = Math.max(0, this.dodgeCd - dt);
    this.postDodge = Math.max(0, this.postDodge - dt); this.chainGrace = Math.max(0, this.chainGrace - dt);
    for (const s of this.skillList) s.tick(this, dt);      // hồi chiêu kỹ năng (H35: Phá Trận, đúng chỗ cũ)
    for (const k of ["atk", "flag"]) if (this.buffs[k + "T"] > 0) { this.buffs[k + "T"] -= dt; if (this.buffs[k + "T"] <= 0) this.buffs[k] = 0; }
    if (this.lienHoanT > 0) { this.lienHoanT -= dt; if (this.lienHoanT <= 0) this.lienHoan = 0; }
    this.comboT -= dt; if (this.comboT <= 0) this.combo = 0;
    if (this.parryAt > 0 && ctx.clock - this.parryAt > this.parryWindow) { this.parryAt = -9; this.parryLock = ctx.clock + DEFENSE.counterLockout; }
    // phím N/C bấm giữa lúc lộn né được giữ tới khi né xong (ra Lướt chém) — trước đây hết hạn 0,15 s giữa chừng cú né 0,32 s
    if (this.buf && ctx.clock - this.buf.t > DEFENSE.inputBuffer && !(this.state === "attack" && this.buf.swing === this.swingId)
      && !(this.state === "dodge" && (this.buf.a === "n" || this.buf.a === "c"))) this.buf = null;

    // Khí Lực nạp khi giao chiến
    const engaged = this.nearestEnemy(this.kiR) !== null;
    if (engaged) this.kiEngaged = 3; else this.kiEngaged -= dt;
    if (this.kiEngaged > 0 && this.state !== "ult") this.addKi(this.def.kiLucRegen * dt * (this.inTPC ? HAO_KHI.tpc.kiLucRegen : 1));
    if (this.passive) this.passive.tick(this, dt);
    // tướng bị dời xa trong một bước (tải lại checkpoint, vớt khỏi nước): bỏ tên đang bay, mưa tên hẹn giờ, hàng cọc, dây móc của chỗ cũ
    if (this.ranged && this._lx !== undefined && (px - this._lx) ** 2 + (pz - this._lz) ** 2 > 225) this.dropShots();
    if (this.shots.length || this.pending.length) this.updateShots(dt);            // tên đã buông vẫn bay khi tướng gục

    if (!this.alive) { this.vx = this.vz = 0; this.setPose(this.P.knockdown(this.st += dt), 0.3); this.place(dt); return; }

    this.blocking = inp.block;     // phím cạnh đã vào bộ đệm qua intake()

    // hướng input theo camera
    const cy = ctx.cam.yaw, fx = Math.sin(cy), fz = Math.cos(cy);
    const mx = inp.moveX, my = inp.moveY, mag = Math.min(1, Math.hypot(mx, my));
    const wx = fx * my - fz * mx, wz = fz * my + fx * mx;   // phải = (−fz, fx) nhân −mx
    this.inputDir = mag > 0.15 ? Math.atan2(wx, wz) : null;
    this.inputMag = mag;
    if (this.ranged) { this.moveWX = wx; this.moveWZ = wz; this.updateAim(inp); }

    switch (this.state) {
      case "free": this.updateFree(dt, wx, wz, mag); break;
      case "attack": this.updateAttack(dt); break;
      case "dodge": this.updateDodge(dt); break;
      case "block": this.updateBlock(dt, wx, wz, mag); break;
      case "hit": this.st -= dt; this.setPose(this.P.hitReact(1 - this.st / 0.3), 0.5); if (this.st <= 0) this.state = "free"; break;
      case "down": {
        this.st -= dt;
        const dp = A.downPose(this.downT - this.st, this.downT);        // clip: ngã bật lùi, nằm, đứng dậy (anim.js); null = cách cũ
        if (dp) this.setPose(dp, 0.5);
        else this.setPose(this.st > 0.5 ? this.P.knockdown(1) : this.P.idle(this.animT), this.st > 0.5 ? 0.4 : 0.12);
        if (this.st <= 0) this.state = "free";
        break;
      }
      case "skill": this.updateSkill(dt); break;
      case "ult": this.updateUlt(dt); break;
      case "ride": this.setPose(this.P.idle(this.animT), 0.15); break;                    // đò chuyển (naval.js)
      case "climb": this.setPose(A.climb(this.climbU || 0), 0.5); break;                 // leo boong (naval.js)
    }
    if (this.state !== "attack") { this.charge = null; this.chargeLevel = 0; }
    if (this.state !== "climb") [this.x, this.z] = collide(ctx.world, this.x, this.z, 0.5, ctx.openGates, this);
    if (dt > 0) { this.vx = (this.x - px) / dt; this.vz = (this.z - pz) / dt; }
    if (this.ranged) { this._lx = this.x; this._lz = this.z; }
    this.place(dt);
  }

  // ---- trạng thái tự do ------------------------------------------------------------------
  updateFree(dt, wx, wz, mag) {
    if (this.tryActions()) return;
    if (this.blocking) { this.state = "block"; this.blockT = 0; return; }
    if (mag > 0.15) {
      const sp = this.def.move * mag * (this.inTPC ? 1.1 : 1) * speedFactor(this.x, this.z, wx, wz);   // lên dốc, bùn chậm; xuống dốc nhanh
      this.x += (wx / mag) * sp * dt; this.z += (wz / mag) * sp * dt;
      this.yaw = turn(this.yaw, this.lock?.alive ? this.faceLock() : Math.atan2(wx, wz), dt * 12);
      const before = Math.floor(this.runPhase / Math.PI);
      const g = A.gait(sp, this.rig.scale);        // nhịp bước + biên độ đùi khớp tốc độ: chân trụ không trượt
      this.runPhase += dt * g.rate;
      if (mag > 0.6 && Math.floor(this.runPhase / Math.PI) !== before) this.ctx.fx.dust(this.x - Math.sin(this.yaw) * 0.4, this.z - Math.cos(this.yaw) * 0.4, 0.3);   // bụi bước chân
      this.setPose(this.P.run(this.runPhase, mag, g.stride), 0.35);
    } else this.setPose(this.P.idle(this.animT), 0.15);
  }

  tryActions() {
    const b = this.buf; if (!b) return false;
    if (b.a === "dodge") return this.startDodge();
    if (b.a === "skill") return this.startSkill(1);
    if (b.a === "skill2") return this.startSkill(2);
    if (b.a === "ult") return this.startUlt();
    if (b.a === "c") {
      const broken = this.findBroken();
      if (broken) { this.buf = null; this.startMove("DQ", broken); return true; }
      if (this.postDodge > 0) { this.buf = null; this.startMove("DC"); return true; }
      const k = this.chainGrace > 0 ? this.chain + 1 : 1;
      this.buf = null; this.startMove(this.cKey(k)); return true;
    }
    if (b.a === "n") {
      if (this.postDodge > 0) { this.buf = null; this.startMove("DN"); return true; }
      const k = this.chainGrace > 0 && this.chain < this.chainN.length ? this.chain + 1 : 1;
      this.buf = null; this.startMove(this.chainN[k - 1]); this.chain = k; return true;
    }
    return false;
  }

  cKey(k) {
    // C5, C6 là nội dung VS: bản này mở theo cấp tướng (5 và 10). Chưa mở thì lùi về C4.
    let key = "C" + Math.min(6, k);
    while (this.M[key].unlockLv && this.stats.level < this.M[key].unlockLv) key = "C" + (Number(key[1]) - 1);
    return key;
  }

  startMove(key, target = null) {
    const m = this.M[key], F = this.F[key];
    this.state = "attack"; this.move = key; this.st = 0; this.hitIdx = 0; this.swingId++;
    this.moveTarget = target;
    this.dur = m.dur / this.atkSpeed;
    this.chargeMul = 1; this.chargeLv = 0; this.holdN = 0; this.holdT = 0; this.holdSpin = 0;
    this.charge = F.charge && this.chargeTrait ? { on: false, t: 0, lv: 0, fxT: 0 } : null;
    this.ctx.director.onHeroAction?.("move", key);
    if (F.resetChain) this.chain = 0;
    // tự nhắm: xoay về địch gần nhất theo hướng input
    const t = target || (this.lock?.alive && (!this.ranged || this.inAimRange(this.lock)) ? this.lock : this.autoTarget());
    if (t) this.yaw = Math.atan2(t.x - this.x, t.z - this.z);
    else if (this.ranged) this.yaw = this.aimYaw ?? this.yaw;
    else if (this.inputDir !== null) this.yaw = this.inputDir;
    if (this.ranged) { this.shotTarget = t; this.precise = false; this.backLeft = m.back || 0; }
    this.stepLeft = (m.dash || m.step || 0);
    this.ctx.audio.play(F.whooshHeavy ? "whooshHeavy" : "whoosh");
    // tiếng thét khi ra đòn mạnh (không phải lần nào cũng thét cho khỏi nhàm)
    if (F.kiai) { if (this.ctx.rng.chance(F.kiaiP)) this.ctx.audio.play("kiai"); }
  }

  updateAttack(dt) {
    const m = this.M[this.move], F = this.F[this.move];
    if (this.charge && this.updateCharge(dt, F)) return;
    this.st += dt; const u = this.st / this.dur;
    // C3 (WC01) giữ C: lốc kiếm quay thêm ở khung trước nhát cuối, mỗi 0,2 s một nhát, tới hold.maxHits nhát (ĐỀ XUẤT)
    if (F.hold && this.heldC && this.holdN < F.hold.maxHits - m.hits.length && this.hitIdx === m.hits.length - 1 && u >= m.hits[this.hitIdx] - 0.1) {
      const uf = m.hits[this.hitIdx] - 0.1; this.st = uf * this.dur;
      if (this.ranged) {                // C3 cung: mỗi hold.every giây (÷ tốc đánh) kéo dây thêm một chu kỳ rồi buông một tên
        const ev = F.hold.every / this.atkSpeed, H = m.hits, a = H[H.length - 2], b = H[H.length - 1];
        this.holdT += dt; this.walkShoot(dt, m, this.A[this.move](a + (b - a) * Math.min(1, this.holdT / ev)));
        if (this.holdT >= ev) { this.holdT -= ev; this.holdN++; this.applyHits(this.move, m, false); }
        return;
      }
      this.holdT += dt; this.holdSpin += dt * 14.8;
      const p = this.A[this.move](uf); p.spin -= this.holdSpin; this.setPose(p, 0.8);
      if (this.holdT >= 0.2) { this.holdT -= 0.2; this.holdN++; this.applyHits(this.move, m, false); }
      return;
    }
    if (this.ranged) this.walkShoot(dt, m, this.A[this.move](Math.min(1, u)), u);
    else this.setPose(this.A[this.move](Math.min(1, u)), 0.8);
    // bước tới / lao tới
    if (this.stepLeft > 0) {
      const rate = m.dash ? m.dash / (this.dur * 0.45) : (m.step / (this.dur * 0.5));
      const s = Math.min(this.stepLeft, rate * dt);
      const blocked = !m.dash && this.nearestEnemy(1.3, true);
      if (!blocked) { this.x += Math.sin(this.yaw) * s; this.z += Math.cos(this.yaw) * s; }
      this.stepLeft -= s;
    }
    while (this.hitIdx < m.hits.length && u >= m.hits[this.hitIdx]) {
      const last = this.hitIdx === m.hits.length - 1;
      this.applyHits(this.move, m, last);
      this.hitIdx++;
    }
    const lastHit = m.hits[m.hits.length - 1];
    // nối đòn: sau cú trúng cuối, bấm N/C thì ra đòn kế
    if (u > lastHit + 0.05 && this.buf && (this.buf.a === "n" || this.buf.a === "c")) {
      if (F.chainN) { this.chainGrace = 0.01; this.tryChain(); return; }
    }
    if (u >= 0.7 && this.buf?.a === "dodge") { this.state = "free"; this.startDodge(); return; }
    if (u >= 1) {
      this.state = "free";
      if (F.chainN) this.chainGrace = 0.28; else this.chain = 0;
      this.tryActions();
    }
  }

  // Tụ lực (WC01): trả true khi khung này đang giữ gồng (bỏ qua phần còn lại của updateAttack).
  updateCharge(dt, F) {
    const c = this.charge, ctx = this.ctx, T = this.chargeTrait, uc = F.chargeU * this.dur;
    if (!c.on) {
      if (!this.heldC) { this.charge = null; return false; }          // thả C trước khung gồng: đòn thường
      if (this.st + dt < uc) return false;                             // chưa tới khung gồng
      c.on = true; this.st = uc; c.lv = 1; c.fxT = 0;
      ctx.audio.play("whooshHeavy", this.x, this.z);
    }
    c.t += dt;
    const lv = 1 + chargeLevel(this.cls, c.t);
    this.chargeLevel = lv;
    if (lv > c.lv) {                                                   // lên cấp: chớp, rung, vòng sáng, chữ
      c.lv = lv;
      ctx.fx.flash(0.1 + 0.08 * lv, CHARGE_RGB[lv - 1]); ctx.fx.shake(0.08 * lv); ctx.fx.punch(0.8 * lv);
      ctx.fx.ring(this.x, this.z, 2.2 + lv, 0xf1d98a, 0.3);
      ctx.fx.text(this.x, this.z, `${this.ranged ? "Căng dây" : "Tụ lực"} ${ROMAN[lv - 1]}`, lv >= 3 ? "#ff8a5a" : "#f1d98a");
      ctx.audio.play(lv >= 3 ? "finisher" : "parry", this.x, this.z, { gain: 0.6 });
    }
    if (this.ranged) { this.precise = true; this.aiming = true; }        // cung: đang căng dây = ngắm chính xác
    if (!this.heldC || c.t >= T.auto) {                                // tung đòn
      this.chargeMul = chargeMult(this.cls, c.t); this.chargeLv = lv;
      this.charge = null; this.chargeLevel = 0;
      if (lv >= 2) { ctx.fx.flash(0.12 * lv, CHARGE_RGB[lv - 1]); ctx.audio.play("kiai"); }
      return false;
    }
    // giữ khung gồng, xoay người nhắm theo hướng đẩy; vòng sáng co dần dưới chân, tia lửa ở mũi gươm
    if (this.ranged) {                                                 // cung: xoay theo hướng ngắm, đi chậm được
      if (this.aimYaw !== null) this.yaw = turn(this.yaw, this.aimYaw, dt * 14);
      this.walkShoot(dt, this.M[this.move], this.A[this.move](F.chargeU), F.chargeU, 0.5);
    } else {
      this.setPose(this.A[this.move](F.chargeU), 0.5);
      if (this.inputDir !== null) this.yaw = turn(this.yaw, this.inputDir, dt * 5);
    }
    c.fxT -= dt;
    if (c.fxT <= 0) {
      c.fxT = 0.1;
      const col = CHARGE_COL[lv - 1];
      ctx.fx.sprite("ring", this.x, this.y + 0.2, this.z, { size: 3.2 + 0.7 * lv, T: 0.35, grow: 0.3, flat: true, additive: true, color: col, opacity: 0.5 + 0.15 * lv });
      if (lv >= 2 && this.trailSrc.length) {
        const s = this.trailSrc[0]; _t.copy(s.tip); s.j.localToWorld(_t);
        ctx.fx.spark(_t.x, _t.y, _t.z, lv >= 3, col);
      }
    }
    return true;
  }

  tryChain() {
    const b = this.buf; this.buf = null;
    if (b.a === "n") { const k = this.chain + 1; this.chain = k; this.startMove(this.chainN[k - 1]); }
    else { const k = this.chain + 1; this.startMove(this.cKey(k)); }
  }

  // ---- trúng đòn ---------------------------------------------------------------------------
  applyHits(key, m, last) {
    if (this.F[key].ranged) { this.shoot(key, m, last); return; }      // WC09: tên bay thật / mưa tên (không trúng tức thì)
    const ctx = this.ctx, fx = Math.sin(this.yaw), fz = Math.cos(this.yaw), F = this.F[key];
    const reach = m.range * this.rangeMul;
    let hitAny = false, heavy = F.heavy;
    const isC = F.isC;
    const poiseMult = (m.poiseMult || (isC ? C_POISE_MULT : 1)) * (1 + this.mods.poisePct);
    // body: thân LÍNH (hitRadius) — nón chém nới góc theo bề ngang thân. Sĩ quan và cổng giữ luật cũ: bán kính chỉ cộng vào tầm, góc xét theo tâm
    // (nới cho cổng 3,5 m thì nhát chém lính quay lưng đi gần 130° vẫn trừ độ bền cổng).
    const inShape = (tx, tz, rad, body = false) => {
      const dx = tx - this.x, dz = tz - this.z, d = Math.hypot(dx, dz);
      if (m.shape === "ring") return d <= reach + rad;
      // nón: lính tính cả bề ngang thân (rad) ở hai mép nón, không chỉ góc của tâm người (đợt 15b, hitshape.js); rad 0 = luật cũ
      if (m.shape === "cone") return body ? inCone(dx, dz, fx, fz, reach, m.arc, rad) : inCone(dx, dz, fx, fz, reach + rad, m.arc, 0);
      // line: đòn lao — dải từ 0,6 tầm sau lưng (quãng vừa lao qua) tới 0,4 tầm trước mặt
      const px = tx - (this.x - fx * reach * 0.6), pz = tz - (this.z - fz * reach * 0.6);
      const t = px * fx + pz * fz, perp = Math.abs(px * fz - pz * fx);
      return t >= -0.5 && t <= reach + rad && perp <= (m.width || 2) / 2 + rad;
    };
    const mv = m.mv * this.chargeMul, full3 = this.chargeLv >= 3;      // tụ lực cấp 3: đẩy lùi +2, hất tung
    const knock = full3 ? (m.knock || 2.2) + 2 : m.knock, launch = full3 || m.launch;
    let nHit = 0, crit = false, kills = 0;
    // lính — cả lính diễn phe địch: nhát chém chạm vào là thành lính thật rồi nhận đòn (crowd.strikeable / enlist, đợt 15b)
    for (const a of [...ctx.crowd.agents]) {
      if (a.side !== "dich" || !ctx.crowd.strikeable(a)) continue;
      if (!inShape(a.x, a.z, hitRadius(a), true)) continue;      // kỵ binh: vòng trúng lớn hơn (tuning.js HIT_R), khớp thân ngựa
      ctx.crowd.enlist(a);
      const dx = a.x - this.x, dz = a.z - this.z, d = Math.hypot(dx, dz) || 1;
      const dmg = this.damageTo(a.giap, mv, m.crit, a, F.armorPen);
      const stun = isC && this.mods.cStun && ctx.rng.chance(this.mods.cStun) ? 1.5 : 0;
      const died = ctx.crowd.damage(a, dmg, { by: "hero", swing: this.swingId, kx: dx / d, kz: dz / d, knock: knock || 2.2, launch, stun, heavy });
      ctx.fx.impact(a.x - dx / d * 0.25, heightAt(a.x, a.z) + 1.15 * a.scale, a.z - dz / d * 0.25, dx / d, dz / d, { heavy, crit: this.lastCrit, kill: died, full: nHit < 5 });
      crit ||= this.lastCrit; if (died) kills++;
      hitAny = true; nHit++; this.onLanded();
    }
    // đơn vị lớn
    for (const u of ctx.units) {
      if (u.side !== "dich" || !u.alive || u.dead || u.retreating) continue;
      if (F.finisher && u !== this.moveTarget) continue;
      if (!inShape(u.x, u.z, u.radius)) continue;
      const dmg = this.damageTo(u.giap, mv, m.crit, u, F.armorPen);
      const uc = this.lastCrit;
      const r = u.takeHeroHit(dmg, this.poisePerMv * mv * poiseMult, { knock, launch, by: "hero", finisher: F.finisher });
      const ux = u.x - this.x, uz = u.z - this.z, ul = Math.hypot(ux, uz) || 1;
      ctx.fx.impact(u.x - ux / ul * u.radius * 0.6, u.y + 1.6 * u.rig.scale, u.z - uz / ul * u.radius * 0.6, ux / ul, uz / ul, { heavy: true, crit: uc || r.broke, kill: r.killed });
      if (r.broke && this.mods.breakKi) this.addKi(this.mods.breakKi);
      crit ||= uc || !!r.broke; if (r.killed) kills += 3;
      hitAny = true; nHit++; this.onLanded();
    }
    // cổng: Cong × MV × GATE_MULT (4/3), bỏ qua giáp
    for (const id in ctx.world.gates) {
      const gt = ctx.world.gates[id];
      if (ctx.openGates[id] || !inShape(gt.x - 1.6, gt.z, 3.5)) continue;
      ctx.director.damageGate(id, this.effCong() * mv * GATE_MULT);
      ctx.fx.spark(gt.x - 1.8, heightAt(gt.x, gt.z) + 2, gt.z, true);
      hitAny = true;
    }
    // vật chém được của trận (B16: Vương Kỳ) — director.strikeables?() → [{ x, z, r, hit(dmg) }]; B15, B20 không có móc này
    for (const s of ctx.director.strikeables?.() ?? []) {
      if (!inShape(s.x, s.z, s.r)) continue;
      s.hit(this.effCong() * mv * GATE_MULT);
      ctx.fx.spark(s.x, heightAt(s.x, s.z) + 2, s.z, true);
      hitAny = true;
    }
    if (hitAny) {
      // Hit-stop dài hơn bản cũ, cộng thêm theo số người trúng, chí mạng, người ngã — đòn trúng đông "khựng" rõ (IMPACT).
      // Đòn tụ lực (WC01): +30 ms mỗi cấp trên 1, cấp 3 nâng trần thêm 60 ms (ĐỀ XUẤT BẢN THỬ).
      const base = last && m.stopLast ? m.stopLast : m.stop, I = IMPACT, lvx = this.chargeLv > 1 ? this.chargeLv - 1 : 0;
      ctx.hitstop(Math.min(I.stopMax + (full3 ? 60 : 0), base * I.stopMul + Math.min(I.stopCrowdCap, (nHit - 1) * I.stopPerExtra) + (crit ? I.stopCrit : 0) + (kills ? I.stopKill : 0) + lvx * 30));
      ctx.audio.play(heavy ? "hitHeavy" : "hit", null, null, { gain: nHit > 2 ? 1.15 : 1 });
      if (crit) ctx.audio.play("crit");
      if (kills) ctx.audio.play("kill", this.x + fx * 2, this.z + fz * 2);
      // rung + giật camera theo hướng chém + thu FOV; đòn nặng chớp sáng cả màn
      const big = F.big || full3;
      ctx.fx.shake(big ? I.shake.big : heavy ? I.shake.heavy : crit ? I.shake.crit : I.shake.light);
      ctx.fx.kick(fx, fz, big ? I.kick.big : heavy ? I.kick.heavy : I.kick.light);
      ctx.fx.punch(big ? I.fov.big : heavy ? I.fov.heavy : crit ? I.fov.crit : I.fov.light);
      if (big) ctx.fx.flash(0.55); else if (heavy && kills) ctx.fx.flash(0.28); else if (crit) ctx.fx.flash(0.16, "255,200,150");
      if (F.finisher) { ctx.fx.banner("ĐÒN QUYẾT", "#f1d98a"); ctx.slowmo?.(0.45, 0.3); }
    }
    if (F.ringFx) ctx.fx.shockwave(this.x, this.z, m.range);
    // bổ xuống đất: tung bụi ở chỗ lưỡi chạm đất
    if (last && F.slam) {
      if (this.superArmor) this.slamFx(m, F);
      else ctx.fx.dust(this.x + Math.sin(this.yaw) * 1.6, this.z + Math.cos(this.yaw) * 1.6, 1.1);
      if (F.slamSound) { ctx.audio.play("slam", this.x, this.z); ctx.fx.shake(0.3); }
    }
    ctx.fx.slashArc(this, key, m);
  }
  // Đại kiếm bổ đất (WC01): bụi to ở mũi gươm, vòng chấn lan từ chỗ lưỡi chạm, tia lửa; tụ lực cấp cao vòng lớn hơn. Đòn N
  // (N3) chỉ một cụm bụi nhỏ và vòng hẹp — chuỗi N không bị bụi che kín người.
  slamFx(m, F) {
    const ctx = this.ctx, d = Math.min(3, m.range * 0.5), gx = this.x + Math.sin(this.yaw) * d, gz = this.z + Math.cos(this.yaw) * d;
    const lv = this.chargeLv, R = m.shape === "ring" ? m.range : 3 + lv;
    if (!F.heavy) { ctx.fx.dust(gx, gz, 0.8); ctx.fx.ring(gx, gz, 2.5, 0xf1d98a, 0.3); return; }
    ctx.fx.dust(gx, gz, 1.3 + 0.2 * lv);
    for (let i = 0; i < 6; i++) { const a = this.yaw + (i / 6) * Math.PI * 2; ctx.fx.dust(gx + Math.sin(a) * 1.8, gz + Math.cos(a) * 1.8, 0.6); }
    ctx.fx.ring(gx, gz, R, 0xf1d98a, 0.4);
    if (lv >= 2) ctx.fx.ring(gx, gz, R * 1.5, lv >= 3 ? 0xff5a3a : 0xf1d98a, 0.55);
    ctx.fx.spark(gx, heightAt(gx, gz) + 0.3, gz, true);
    ctx.fx.punch(2 + lv);
  }

  // ---- tầm xa (WC09 Cung, đợt B17-B1) ---------------------------------------------------------------------------------------
  // Hướng ngắm mỗi bước: khoá mục tiêu (trong tầm) → hướng tới nó; PC (bàn phím + chuột) → hướng camera = tâm màn; cảm ứng / tay
  // cầm → hướng cần, cần trung tính thì hướng camera (§3.3). aimMark: người tự nhắm sẽ chọn (HUD vẽ dấu), null khi ngắm chính xác.
  updateAim(inp) {
    const ctx = this.ctx, pad = !!ctx.input?.pad;
    this.aiming = this.state === "attack" && !!this.charge?.on;
    if (this.lock?.alive && !this.lock.dead && this.inAimRange(this.lock)) this.aimYaw = this.faceLock();
    else this.aimYaw = !inp.touch && !pad ? ctx.cam.yaw : this.inputDir ?? ctx.cam.yaw;
    const t = this.aimMark = this.aiming ? null : this.aimTarget();
    if (t) this.aimMarkY = t.isBig ? t.y + 1.6 * t.rig.scale : heightAt(t.x, t.z) + 1.2 * (t.scale || 1);
  }
  inAimRange(t) { const r = this.ranged.aimRange * this.rangeBonus + (t.radius || 0); return (t.x - this.x) ** 2 + (t.z - this.z) ** 2 <= r * r; }
  // Tự nhắm tầm xa: nón ±aimCone quanh hướng ngắm, tới aimRange m (× rangeBonus). Điểm = góc lệch (trừ phần thân người che, chuẩn
  // hoá theo nửa nón) + 0,35 × khoảng cách chuẩn hoá − 0,15 nếu là sĩ quan / tướng: người gần tâm ngắm thắng, gần hơn thắng khi lệch như nhau.
  aimTarget(dir = this.aimYaw ?? this.yaw) {
    const R = this.ranged, cone = (R.aimCone * Math.PI) / 180, range = R.aimRange * this.rangeBonus, crowd = this.ctx.crowd;
    let best = null, bs = 1e9;
    const consider = (t, rad, bonus) => {
      const dx = t.x - this.x, dz = t.z - this.z, d = Math.hypot(dx, dz);
      if (d > range + rad || d < 1e-3) return;
      const ang = Math.max(0, Math.abs(wrapA(Math.atan2(dx, dz) - dir)) - Math.atan2(rad, d));
      if (ang > cone) return;
      const s = ang / cone + 0.35 * d / range - bonus;
      if (s < bs) { bs = s; best = t; }
    };
    for (const a of crowd.agents) if (a.side === "dich" && crowd.strikeable(a)) consider(a, hitRadius(a), 0);
    for (const u of this.ctx.units) if (u.side === "dich" && u.alive && !u.dead && !u.retreating) consider(u, u.radius, 0.15);
    return best;
  }
  // Tư thế đòn tầm xa + đi chậm theo cần (đòn có moveShoot, hay lúc căng dây C1): chân bước kiểu thế đỡ (guardStep) theo hướng đi so
  // với mặt, thân trên giữ tư thế đòn. Lùi m.back m (C2 sau cú đạp, DN lộn lùi) ngược hướng mặt.
  walkShoot(dt, m, pose, u = 1, mul = 1) {
    let p = pose;
    const R = this.ranged, mag = this.inputMag || 0;
    if ((m.moveShoot || this.charge?.on) && mag > 0.15 && R.moveShoot > 0) {
      const sp = this.def.move * mag * R.moveShoot * mul * speedFactor(this.x, this.z, this.moveWX, this.moveWZ);
      const vx = (this.moveWX / mag) * sp, vz = (this.moveWZ / mag) * sp;
      this.x += vx * dt; this.z += vz * dt;
      const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw), v = Math.hypot(vx, vz) || 1, g = A.stepGait(v, this.rig.scale);
      this.runPhase += dt * g.rate;
      p = A.guardStep(pose, this.runPhase, (vx * cy - vz * sy) / v, (vx * sy + vz * cy) / v, g.stride);
    }
    if (this.backLeft > 0 && u >= (m.shape === "cone" ? m.hits[0] : 0.05)) {
      const s = Math.min(this.backLeft, (m.back / (this.dur * 0.35)) * dt);
      this.x -= Math.sin(this.yaw) * s; this.z -= Math.cos(this.yaw) * s; this.backLeft -= s;
    }
    this.setPose(p, 0.8);
  }
  // Buông dây (applyHits của đòn tầm xa): mưa tên hẹn giờ, hoặc một / nhiều mũi tên bay thật. Hướng: mục tiêu chọn lúc ra đòn
  // (Đòn Quyết: kẻ Vỡ Thế) nếu còn trong tầm — nhắm vào chỗ nó đang đứng; ngắm chính xác (căng dây C1) → đúng hướng ngắm; còn lại
  // hướng mặt.
  shoot(key, m, last) {
    const ctx = this.ctx, F = this.F[key], mv = m.mv * this.chargeMul;
    if (m.shape === "rain") { this.rain(key, m, mv); return; }
    let yaw = this.yaw;
    const t = this.moveTarget || (this.precise ? null : this.shotTarget);
    if (t && (t.isBig ? t.alive && !t.dead : ctx.crowd.strikeable(t)) && this.inAimRange(t)) yaw = Math.atan2(t.x - this.x, t.z - this.z);
    else if (this.precise && this.aimYaw !== null) yaw = this.aimYaw;
    this.yaw = yaw;
    for (const [da, k] of m.fan || [[0, 1]]) this.fireArrow(key, m, yaw + da, mv * k, F.finisher ? this.moveTarget : null);
    ctx.audio.play(F.heavy ? "crossbow" : "bow", this.x, this.z);
    if (F.heavy) { ctx.fx.kick(-Math.sin(yaw), -Math.cos(yaw), 0.12); ctx.fx.punch(1.2); }
    if (last && this.chargeLv >= 3) ctx.fx.flash(0.12, "255,220,160");
  }
  // Một mũi tên: dữ liệu bay (this.shots) + hình (crowd.arrows "fx": bay theo vận tốc, rơi theo trọng lực — hero.updateShots quyết trúng).
  fireArrow(key, m, yaw, mv, only = null, o = {}) {
    const ctx = this.ctx, fx = Math.sin(yaw), fz = Math.cos(yaw), sp = o.speed ?? m.speed ?? this.ranged.arrowSpeed;
    const range = (o.range ?? m.range) * this.rangeBonus, x0 = this.x + fx * 0.45, z0 = this.z + fz * 0.45;
    const s = { key, m, x: x0, z: z0, fx, fz, sp, left: range, pierce: o.pierce ?? m.pierce ?? 1, n: 0, mv, only, hit: new Set(), fx3: null,
      swing: ++this.swingId, crit: !!m.crit, knock: o.knock ?? m.knock ?? 1.5, launch: !!m.launch, w: (m.width || 0) / 2, pin: o.pin || null };
    this.shots.push(s);
    const ar = ctx.crowd.arrows;
    if (ar && ar.length < 190) {
      const g0 = heightAt(this.x, this.z), y0 = g0 + ARROW_Y * this.rig.scale, T = range / sp;
      // bay thẳng gần như ngang (vồng lên vừa đủ để rơi lại độ cao buông ở cuối tầm), hết tầm thì cắm xuống
      s.fx3 = { x: x0, y: y0, z: z0, vx: fx * sp, vz: fz * sp, vy: 4.9 * T, t: 0, T: T + 0.5, T0: T, src: null, side: "fx", tgt: null, g0, duel: false, heroMult: 0 };
      ar.push(s.fx3);
    }
    return s;
  }
  // Mưa tên: bắn vút lên (hình), delay giây sau tên rơi xuống vòng r (× Tầm) quanh mình hay quanh mục tiêu / điểm ngắm.
  rain(key, m, mv) {
    const ctx = this.ctx, r = m.r * this.rangeMul, sw = ++this.swingId;
    let cx = this.x, cz = this.z;
    if (m.at === "target") {
      const t = this.shotTarget, ok = t && (t.isBig ? t.alive && !t.dead : ctx.crowd.strikeable(t)) && Math.hypot(t.x - this.x, t.z - this.z) <= m.range * this.rangeBonus;
      const d = ok ? 0 : Math.min(m.range, 14);
      cx = ok ? t.x : this.x + Math.sin(this.yaw) * d; cz = ok ? t.z : this.z + Math.cos(this.yaw) * d;
    }
    const ar = ctx.crowd.arrows, g0 = heightAt(this.x, this.z), y0 = g0 + ARROW_Y * this.rig.scale;
    for (let i = 0; i < 8 && ar && ar.length < 180; i++) {          // loạt bắn lên trời
      const a = this.yaw + (hash01(sw * 31 + i) - 0.5) * 0.5;
      ar.push({ x: this.x, y: y0, z: this.z, vx: Math.sin(a) * 4, vz: Math.cos(a) * 4, vy: 26, t: 0, T: 0.55, T0: 0.55, src: null, side: "fx", tgt: null, g0, duel: false, heroMult: 0 });
    }
    ctx.audio.play("bow", this.x, this.z);
    const fall = Math.min(0.45, m.delay * 0.6);
    this.pending.push({ at: ctx.clock + m.delay - fall, fn: () => {          // tên rơi (hình): từ cao 14 m xuống các điểm rải đều trong vòng
      const g = heightAt(cx, cz);
      for (let i = 0; i < 26 && ar && ar.length < 195; i++) {
        const a = hash01(sw * 97 + i) * Math.PI * 2, d = Math.sqrt(hash01(sw * 13 + i * 7)) * r, tx = cx + Math.sin(a) * d, tz = cz + Math.cos(a) * d;
        const sx = tx - Math.sin(this.yaw) * 4, sz = tz - Math.cos(this.yaw) * 4, y = g + 14;
        ar.push({ x: sx, y, z: sz, vx: (tx - sx) / fall, vz: (tz - sz) / fall, vy: (heightAt(tx, tz) - y) / fall + 4.9 * fall, t: 0, T: fall + 0.05, T0: fall,
          src: null, side: "fx", tgt: null, g0: y, duel: false, heroMult: 0 });
      }
    } });
    this.pending.push({ at: ctx.clock + m.delay, fn: () => this.rainHit(key, m, mv, cx, cz, r, sw) });
  }
  rainHit(key, m, mv, cx, cz, r, sw) {
    const ctx = this.ctx, F = this.F[key];
    let n = 0, kills = 0, crit = false;
    for (const a of [...ctx.crowd.agents]) {
      if (a.side !== "dich" || !ctx.crowd.strikeable(a)) continue;
      const dx = a.x - cx, dz = a.z - cz, d = Math.hypot(dx, dz);
      if (d > r + hitPad(a)) continue;
      const k = d || 1, res = this.landHit(a, { key, m, mv, swing: sw, crit: !!m.crit, knock: m.knock, launch: !!m.launch, fx: dx / k, fz: dz / k, rain: true }, n);
      n++; if (res.kill) kills++; crit ||= res.crit;
    }
    for (const u of ctx.units) {
      if (u.side !== "dich" || !u.alive || u.dead || u.retreating) continue;
      const dx = u.x - cx, dz = u.z - cz, d = Math.hypot(dx, dz);
      if (d > r + u.radius) continue;
      const res = this.landHit(u, { key, m, mv, swing: sw, crit: !!m.crit, knock: m.knock, launch: !!m.launch, fx: dx / (d || 1), fz: dz / (d || 1), rain: true }, n);
      n++; if (res.kill) kills++; crit ||= res.crit;
    }
    ctx.fx.ring(cx, cz, r, 0xf1d98a, 0.4); ctx.fx.dust(cx, cz, 0.8);
    if (n) {
      const I = IMPACT;
      ctx.hitstop(Math.min(I.stopMax, m.stop * I.stopMul + Math.min(I.stopCrowdCap, (n - 1) * I.stopPerExtra) + (crit ? I.stopCrit : 0) + (kills ? I.stopKill : 0)));
      ctx.audio.play(F.heavy ? "hitHeavy" : "hit", cx, cz, { gain: n > 2 ? 1.15 : 1 });
      if (kills) ctx.audio.play("kill", cx, cz);
      ctx.fx.shake(F.heavy ? IMPACT.shake.heavy * 0.6 : IMPACT.shake.light);
      if (n >= 5) ctx.fx.text(cx, cz, `${n} quân giặc trúng tên`, "#f1d98a");
    }
  }
  // Mỗi bước: tên bay sp × dt; trúng người đầu tiên trên đoạn vừa bay (lính — cả lính diễn —, sĩ quan, cổng, vật chém được), xuyên
  // tới pierce người; hết tầm thì rơi. Việc hẹn giờ (mưa tên…) tới giờ thì chạy (như guard.js tickPending).
  updateShots(dt) {
    const ctx = this.ctx, crowd = ctx.crowd, cand = this._cand || (this._cand = []);
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i], len = Math.min(s.left, s.sp * dt);
      cand.length = 0;
      if (!s.only) for (const a of crowd.agents) {
        if (a.side !== "dich" || s.hit.has(a) || !crowd.strikeable(a)) continue;
        const t = segHit(s.x, s.z, s.fx, s.fz, len, a.x, a.z, hitRadius(a) + ARROW_R + s.w);
        if (t >= 0) cand.push({ t, o: a, k: 0 });
      }
      for (const u of ctx.units) {
        if (u.side !== "dich" || !u.alive || u.dead || u.retreating || s.hit.has(u) || (s.only && u !== s.only)) continue;
        const t = segHit(s.x, s.z, s.fx, s.fz, len, u.x, u.z, u.radius + ARROW_R + s.w);
        if (t >= 0) cand.push({ t, o: u, k: 1 });
      }
      if (!s.only) {
        for (const id in ctx.world.gates) {
          const gt = ctx.world.gates[id];
          if (ctx.openGates[id] || s.hit.has(gt)) continue;
          const t = segHit(s.x, s.z, s.fx, s.fz, len, gt.x - 1.6, gt.z, 3.5);
          if (t >= 0) cand.push({ t, o: gt, k: 2, id });
        }
        for (const v of ctx.director.strikeables?.() ?? []) {
          if (s.hit.has(v)) continue;
          const t = segHit(s.x, s.z, s.fx, s.fz, len, v.x, v.z, v.r);
          if (t >= 0) cand.push({ t, o: v, k: 3 });
        }
      }
      cand.sort((a, b) => a.t - b.t);
      let stop = false;
      for (const c of cand) {
        s.hit.add(c.o);
        if (c.k === 2) {                                             // cổng: tên cắm vào gỗ (×ARROW_GATE), tên dừng
          ctx.director.damageGate(c.id, this.effCong() * s.mv * GATE_MULT * ARROW_GATE);
          ctx.fx.spark(s.x + s.fx * c.t, heightAt(c.o.x, c.o.z) + 2, s.z + s.fz * c.t, false);
          stop = true; s.t = c.t; break;
        }
        if (c.k === 3) { c.o.hit(this.effCong() * s.mv * GATE_MULT * ARROW_GATE); ctx.fx.spark(c.o.x, heightAt(c.o.x, c.o.z) + 2, c.o.z, false); stop = true; s.t = c.t; break; }
        s.n++;
        const pin = s.pin && s.n === s.pin.at ? s.pin.sec : 0;
        this.landHit(c.o, { key: s.key, m: s.m, mv: s.mv, swing: s.swing, crit: s.crit, knock: s.knock, launch: s.launch, fx: s.fx, fz: s.fz, pin, hook: s.hook }, s.n - 1);
        if (--s.pierce <= 0) { stop = true; s.t = c.t; break; }
      }
      if (stop) {                                                    // tên cắm vào người / cổng: hình dừng ở chỗ trúng
        this.shots.splice(i, 1);
        if (s.fx3) s.fx3.T = 0;
        continue;
      }
      s.x += s.fx * len; s.z += s.fz * len; s.left -= len;
      if (s.left <= 1e-6) this.shots.splice(i, 1);
    }
    const P = this.pending;
    if (P.length) { const now = ctx.clock; for (let i = P.length - 1; i >= 0; i--) if (now >= P[i].at) { const f = P[i].fn; P.splice(i, 1); f(); } }
  }
  // Một mũi tên / mưa tên trúng một người (lính hay đơn vị lớn): cùng phép tính như applyHits (sát thương, Phá Thế, chí mạng, Khí Lực,
  // liên hoàn), hiệu ứng ở chỗ trúng. o: { key, m, mv, swing, crit, knock, launch, fx, fz, pin, rain, hook }; i: thứ tự người trúng của lượt.
  // hook (Móc Tên, hero-skills.js): boss (bậc "tuong") mất SKILLS.mocTen.poiseCut × thanh Phá Thế thay cho Phá Thế theo MV; rồi hook.onHook(t).
  // Trả { kill, crit }.
  landHit(t, o, i = 0) {
    const ctx = this.ctx, F = this.F[o.key] || {}, m = o.m, heavy = !!F.heavy;
    const poiseMult = (m.poiseMult || (F.isC ? C_POISE_MULT : 1)) * (1 + this.mods.poisePct);
    let kill = false, crit = false;
    if (t.isBig) {
      const dmg = this.damageTo(t.giap, o.mv, o.crit, t, m.armorPen || 0); crit = this.lastCrit;
      const pz = o.hook && t.tier === "tuong" && t.poiseMax > 0 ? SKILLS.mocTen.poiseCut * t.poiseMax : this.poisePerMv * o.mv * poiseMult;
      const r = t.takeHeroHit(dmg, pz, { knock: o.knock, launch: o.launch, by: "hero", finisher: F.finisher, arrow: true });
      if (o.pin && t.applyStatus) t.applyStatus("pin", o.pin);
      if (o.hook && !r.killed) o.hook.onHook?.(t);
      ctx.fx.impact(t.x - o.fx * t.radius * 0.6, t.y + 1.6 * t.rig.scale, t.z - o.fz * t.radius * 0.6, o.fx, o.fz, { heavy: true, crit: crit || r.broke, kill: r.killed });
      if (r.broke && this.mods.breakKi) this.addKi(this.mods.breakKi);
      crit ||= !!r.broke; kill = !!r.killed;
      if (F.finisher) { ctx.fx.banner("ĐÒN QUYẾT", "#f1d98a"); ctx.slowmo?.(0.45, 0.3); }
    } else {
      ctx.crowd.enlist(t);                                           // lính diễn trúng tên: thành lính thật rồi nhận đòn (đợt 15b)
      const dmg = this.damageTo(t.giap, o.mv, o.crit, t, m.armorPen || 0); crit = this.lastCrit;
      const stun = o.pin || (F.isC && this.mods.cStun && ctx.rng.chance(this.mods.cStun) ? 1.5 : 0);
      kill = ctx.crowd.damage(t, dmg, { by: "hero", swing: o.swing, kx: o.fx, kz: o.fz, knock: o.knock || 1.5, launch: o.launch, stun, heavy });
      ctx.fx.impact(t.x - o.fx * 0.25, heightAt(t.x, t.z) + 1.15 * t.scale, t.z - o.fz * 0.25, o.fx, o.fz, { heavy, crit, kill, full: i < 4 });
    }
    this.onLanded();
    if (!o.rain) {                                                   // mưa tên tính khựng / tiếng một lần cho cả vòng (rainHit)
      ctx.audio.play(heavy ? "hitHeavy" : "hit", t.x, t.z, { gain: 0.8 });
      if (crit) ctx.audio.play("crit", t.x, t.z);
      if (kill) ctx.audio.play("kill", t.x, t.z);
      // khựng: tên nặng, chí mạng, hạ người (mũi tên thường không khựng — bắn liên tục mà khựng mỗi phát thì giật màn)
      if (heavy || crit || kill) ctx.hitstop(Math.min(IMPACT.stopMax, m.stop * IMPACT.stopMul * (heavy ? 1 : 0.5) + (crit ? IMPACT.stopCrit : 0) + (kill ? IMPACT.stopKill : 0)));
      if (heavy) ctx.fx.shake(IMPACT.shake.crit);
    }
    return { kill, crit };
  }
  dropShots() {
    for (const s of this.shots) if (s.fx3) s.fx3.T = 0;
    this.shots.length = 0; this.pending.length = 0;
    if (this.fence) { this.fence.mesh?.parent?.remove(this.fence.mesh); this.fence = null; }
    if (this.ultS?.rope) { this.ultS.rope.parent?.remove(this.ultS.rope); this.ultS.rope = null; }
  }
  // Tên cầm tay hiện khi: đứng thủ (tên đã lắp), đang kéo dây tới lúc buông, kỹ năng có kéo dây (skill.nock).
  nocked() {
    if (this.state === "free") return (this.inputMag || 0) <= 0.15;
    if (this.state === "block") return false;
    if (this.state === "skill" || this.state === "ult") return !!(this.skillActive || this.ultImpl)?.nock?.(this);
    if (this.state !== "attack" || !this.F[this.move]?.ranged) return false;
    const H = this.M[this.move].hits, i = this.hitIdx, u = this.st / this.dur;
    if (i >= H.length) return false;
    return u > (i > 0 ? H[i - 1] + 0.03 : 0.06);
  }

  // big: đòn vào sĩ quan / Toa Đô — cờ Tuyệt Kỹ là cờ tập hợp quân (đợt 9): không cộng vào đòn của tướng lên đơn vị lớn
  effCong(big = false) {
    let c = this.stats.cong * (1 + this.buffs.atk + (big ? 0 : this.buffs.flag));
    if (this.inTPC) c *= 1 + HAO_KHI.tpc.heroAtk;
    return c;
  }

  // tgt: lính / đơn vị bị đánh — nhân thế đất cao thấp ở cuối (terrain-rules.js hitMult). pen: phần giáp đòn bỏ qua (C6 WC01).
  damageTo(giap, mv, sureCrit, tgt = null, pen = 0) {
    const ctx = this.ctx;
    const g = giap * (1 - this.mods.armorPen - pen);
    let d = this.effCong(!!tgt?.isBig) * mv * heSoGiap(g, this.stats.level);
    this.lastCrit = !!(sureCrit || ctx.rng.chance(this.stats.crit));
    if (this.lastCrit) d *= CRIT_MULT;      // Tổng Phản Công +20% đã nhân trong effCong (trước đợt 9 nhân thêm ×1,2 ở đây)
    return d * (0.95 + 0.1 * ctx.rng.next()) * (tgt ? hitMult(this, tgt) : 1);
  }

  onLanded() {
    this.addKi(0.35);          // kiPct nhân trong addKi (trước đợt 9 nhân hai lần: khắc "+10% Khí Lực" thành +21%)
    this.combo++; this.comboT = 2.2;
    // Liên hoàn (WC03): mỗi 10 đòn trúng liền mạch +4% tốc đánh 6 s, tối đa 3 tầng (ĐỀ XUẤT BẢN THỬ)
    if (this.lienHoanOn && this.combo % this.mods.comboEvery === 0) { this.lienHoan = Math.min(3, this.lienHoan + 1); this.lienHoanT = 6; }
  }

  addKi(v) { this.ki = Math.min(this.kiMax, this.ki + v * (1 + (this.mods.kiPct || 0))); }

  // ---- Né ------------------------------------------------------------------------------------
  startDodge() {
    this.buf = null;
    if (this.dodgeCd > 0) return false;
    this.state = "dodge"; this.st = 0; this.chain = 0;
    this.dodgeYaw = this.inputDir ?? this.yaw + Math.PI;
    this.yaw = this.inputDir ?? this.yaw;
    this.dodgeChain++;
    if (this.dodgeChain >= DEFENSE.dodgeChain) { this.dodgeCd = DEFENSE.dodgeDur + DEFENSE.dodgeRecover; this.dodgeChain = 0; }
    this.dodgeReset = 0.8;
    if (this.mods.afterimage) this.ctx.fx.afterimage(this.x, this.z, () => this.afterimageBurst(this._aiX, this._aiZ));
    this._aiX = this.x; this._aiZ = this.z;
    this.ctx.audio.play("dodge", this.x, this.z);
    this.ctx.director.onHeroAction?.("dodge");
    return true;
  }
  afterimageBurst(x, z) {
    for (const a of this.ctx.crowd.agents) {
      if (a.side !== "dich" || !this.ctx.crowd.strikeable(a) || Math.hypot(a.x - x, a.z - z) > 3 + hitPad(a)) continue;
      this.ctx.crowd.enlist(a);                                    // lính diễn chạm ảnh lướt: thành lính thật (đợt 15b)
      this.ctx.crowd.damage(a, this.damageTo(a.giap, 0.5, false, a), { by: "hero", swing: ++this.swingId, knock: 3 });
    }
  }
  updateDodge(dt) {
    this.st += dt; const u = this.st / DEFENSE.dodgeDur;
    const sp = DEFENSE.dodgeDist / DEFENSE.dodgeDur;
    this.x += Math.sin(this.dodgeYaw) * sp * dt; this.z += Math.cos(this.dodgeYaw) * sp * dt;
    this.setPose(this.P.dodgeRoll(Math.min(1, u)), 0.6);
    if (u >= 1) {
      this.state = "free"; this.postDodge = 0.35;
      if (this.buf && (this.buf.a === "n" || this.buf.a === "c")) this.buf.t = this.ctx.clock;   // phím bấm lúc lộn: làm mới hạn để ra Lướt chém
    }
  }

  // ---- Đỡ ------------------------------------------------------------------------------------
  updateBlock(dt, wx, wz, mag) {
    const walk = mag > 0.15 && this.blocking;
    if (!walk) this.setPose(this.P.block, 0.4);
    if (!this.blocking) { this.state = "free"; return; }
    if (this.buf && (this.buf.a === "dodge" || this.buf.a === "n" || this.buf.a === "c")) { this.state = "free"; this.tryActions(); return; }
    this.blockT += dt;
    if (walk) {
      // đi trong thế đỡ: bước ngắn, nhanh theo hướng đi so với mặt (A.guardStep), bàn chân trụ đứng yên trên đất.
      // Trộn tư thế nhanh (0,8) để nhịp ~4 bước/s không bị trễ pha làm lê chân; 0,2 s đầu trộn chậm cho khỏi giật.
      const vx = wx * 2, vz = wz * 2, sp = Math.hypot(vx, vz), cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
      this.x += vx * dt; this.z += vz * dt;
      const g = A.stepGait(sp, this.rig.scale);
      this.runPhase += dt * g.rate;
      this.setPose(A.guardStep(this.P.block, this.runPhase, (vx * cy - vz * sy) / sp, (vx * sy + vz * cy) / sp, g.stride),
        this.blockT < 0.2 ? 0.4 : 0.8);
    }
    const t = this.lock?.alive ? this.lock : this.nearestEnemy(8);
    if (t) this.yaw = turn(this.yaw, Math.atan2(t.x - this.x, t.z - this.z), dt * 10);
  }

  // ---- nhận đòn -------------------------------------------------------------------------------
  receiveHit(h) {
    const ctx = this.ctx;
    if (!this.alive || this.invuln > 0 || this.state === "ult") return "immune";
    if (ctx.director.heroImmune?.()) return "immune";             // B20: vừa bắt sống tướng Nguyên, chờ chuyển pha / thắng (B15 không có móc này)
    if (this.state === "dodge" && this.st < DEFENSE.dodgeIFrame) { ctx.fx.text(this.x, this.z, "Né", "#e6dcc3"); return "dodged"; }
    const angTo = Math.atan2(h.x - this.x, h.z - this.z);
    let da = angTo - this.yaw; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
    const front = Math.abs(da) <= (DEFENSE.blockArc / 2) * Math.PI / 180;
    const riding = this.state === "ride" || this.state === "climb";     // trên đò / đang leo: không phản, không khựng
    if (h.red && this.parryAt > 0 && ctx.clock - this.parryAt <= this.parryWindow + 0.02 && !riding) {
      this.parryAt = -9;
      ctx.fx.banner("PHẢN ĐÒN", "#f1d98a"); ctx.audio.play("parry", this.x, this.z); ctx.hitstop(120);
      this.yaw = angTo; this.state = "free"; this.startMove("CT", h.src);
      ctx.director.onHeroAction?.("parry");
      if (h.src?.tier === "tuong") ctx.director.onCounterBoss();
      return "parried";
    }
    if (this.state === "block" && front && !h.unblockable) {
      if (!h.red) {
        ctx.fx.spark(this.x + Math.sin(angTo), heightAt(this.x, this.z) + 1.3, this.z + Math.cos(angTo), false, 0xf1d98a);
        ctx.audio.play("block", this.x, this.z);
        this.x -= Math.sin(angTo) * 0.25; this.z -= Math.cos(angTo) * 0.25;
        ctx.director.onHeroAction?.("block");
        return "blocked";
      }
      h.dmg *= 0.6;   // đòn viền đỏ phá đỡ
    }
    this.hp -= h.dmg; this.addKi(2);
    if (h.heavy || h.red) this.lastHardHit = ctx.clock;                 // ngắt giữ phím Tương tác (naval.interactStep)
    ctx.fx.hurt(); ctx.audio.play(h.heavy ? "hurtHeavy" : "hurt");
    ctx.fx.blood(this.x, this.y + 1.2, this.z, -Math.sin(angTo), -Math.cos(angTo), h.heavy ? 0.8 : 0.4);
    if (h.heavy || h.red) { ctx.fx.shake(h.red ? 0.45 : 0.25); ctx.fx.kick(-Math.sin(angTo), -Math.cos(angTo), 0.3); ctx.hitstop(h.red ? 90 : 50); }
    ctx.director.onHeroHit(h);
    if (this.hp <= 0) { this.onZeroHp(); return "hit"; }
    let armored = (this.state === "attack" || this.state === "skill") && !h.heavy && !h.red;
    if (this.state === "skill" && this.skillActive?.armored) armored = this.skillActive.armored(this, h);
    else if (!armored && this.superArmor && this.state === "attack" && !h.red && this.inArmor()) {
      armored = true;                            // siêu giáp đại kiếm: đòn nặng / hất ngã không ngắt nhát đang vung
      ctx.fx.text(this.x, this.z, "Siêu giáp", "#e6c07a");
    }
    if (riding) armored = true;
    if (!armored) {
      if (this.state === "skill") { this.skillActive?.interrupted?.(this, h); this.skillActive = null; }
      if (h.red || h.knockdown) { this.state = "down"; this.st = this.downT = 1.1; this.invuln = Math.max(this.invuln, 1.0); }
      else if (h.heavy || this.state !== "attack") { this.state = "hit"; this.st = 0.3; }
      this.chain = 0;
    }
    return "hit";
  }
  // Đang trong cửa sổ siêu giáp của đòn đang ra (tính cả lúc giữ khung gồng tụ lực).
  inArmor() {
    const a = this.F[this.move]?.armor; if (!a) return false;
    const u = this.st / this.dur;
    return u >= a[0] && u <= a[1];
  }

  onZeroHp() {
    const ctx = this.ctx;
    if (this.revives > 0) {
      this.revives--; this.hp = this.maxHp * this.def.revive.hp; this.invuln = this.def.revive.invuln;
      this.state = "down"; this.st = this.downT = 1.2;
      ctx.fx.banner("GƯỢNG DẬY", "#e6dcc3"); ctx.director.onRevive();
      return;
    }
    this.hp = 0; this.alive = false; this.state = "dead"; this.st = 0;
    ctx.director.onHeroDead();
  }

  // ---- kỹ năng, Tuyệt Kỹ (hero-skills.js) --------------------------------------------------------
  // slot 1: E (H35 Phá Trận · H31 Hịch Tướng Sĩ), slot 2: T (H31 Binh Thư Yếu Lược).
  startSkill(slot = 1) {
    this.buf = null;
    const s = this.sk[slot];
    if (!s) return false;
    const ok = s.start(this);
    if (ok) this.skillActive = s;
    return ok;
  }
  updateSkill(dt) {
    const s = this.skillActive || this.sk[1];
    s.update(this, dt);
    if (this.state !== "skill") this.skillActive = null;
  }
  startUlt() {
    this.buf = null;
    return this.ultImpl.start(this);
  }
  updateUlt(dt) { this.ultImpl.update(this, dt); }

  // ---- cho HUD / director / bot -----------------------------------------------------------------
  // Ô kỹ năng: [{ slot, id, key, name, icon, ready, cd, active }] — H35: đúng một ô Phá Trận như HUD cũ.
  skillSlots() {
    const out = [];
    for (const slot of [1, 2]) {
      const s = this.sk[slot]; if (!s) continue;
      const id = this.def.skills[slot === 1 ? "sk1" : "sk2"], info = this.moveInfo[slot === 1 ? "skill" : "skill2"] || this.moveInfo.skill;
      out.push({ slot, id, key: slot === 1 ? "E" : "T", name: SKILLS[id]?.name ?? info.name, icon: info.icon, ...s.hud(this),
        active: this.state === "skill" && this.skillActive === s });
    }
    return out;
  }
  skillReady(slot = 1) { const s = this.sk[slot]; return !!s && (s.ready ? s.ready(this) : s.hud(this).ready); }
  // Ô Tuyệt Kỹ: { id, name, icon, key, cost, ready, cd } — cd như HUD cũ: "Hào Khí" hoặc "vạch đầy/số vạch".
  ultInfo() {
    const id = this.def.skills?.ult || "bopNat", cost = id === "bopNat" ? HERO.tuyetKy.cost : SKILLS[id]?.cost ?? 100;
    const hk = this.inTPC && this.hkUltReady;
    return { id, name: SKILLS[id]?.name ?? this.moveInfo.ult.name, icon: this.moveInfo.ult.icon, key: "R", cost,
      ready: this.ki >= cost || hk, cd: hk ? "Hào Khí" : `${Math.floor(this.ki / this.def.kiLucPerBar)}/${this.kiBars}` };
  }
  // Đòn C kế tiếp cho ô C: { id (= key), key, icon, name, label, hot, ready, charge } — label như HUD cũ ("C4 Chấn địa", "Lướt C", "ĐÒN QUYẾT").
  nextHeavyInfo() {
    const key = nextHeavy(this), info = this.moveInfo[key];
    return { id: key, key, icon: info.icon, name: info.name, label: key === "D" ? "Lướt C" : key === "DQ" ? "ĐÒN QUYẾT" : `${key} ${info.name}`,
      hot: key === "DQ", ready: key !== "C1", charge: this.chargeLevel };
  }

  // ---- tiện ích -------------------------------------------------------------------------------
  nearestEnemy(maxD, crowdOnly = false) {
    let best = null, bd = maxD * maxD;
    for (const a of this.ctx.crowd.agents) {
      if (a.side !== "dich" || !this.ctx.crowd.hittable(a)) continue;
      const d2 = (a.x - this.x) ** 2 + (a.z - this.z) ** 2; if (d2 < bd) { bd = d2; best = a; }
    }
    if (!crowdOnly) for (const u of this.ctx.units) {
      if (u.side !== "dich" || !u.alive || u.dead || u.retreating) continue;
      const d2 = (u.x - this.x) ** 2 + (u.z - this.z) ** 2; if (d2 < bd) { bd = d2; best = u; }
    }
    return best;
  }
  autoTarget() {
    if (this.ranged) return this.aimTarget();
    let best = null, bs = 1e9;
    const dir = this.inputDir ?? this.yaw;
    const consider = (t, bonus) => {
      const dx = t.x - this.x, dz = t.z - this.z, d = Math.hypot(dx, dz);
      if (d > 6.5) return;
      let da = Math.atan2(dx, dz) - dir; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
      if (Math.abs(da) > 1.2 && d > 2) return;
      const s = d + Math.abs(da) * 2 - bonus; if (s < bs) { bs = s; best = t; }
    };
    const crowd = this.ctx.crowd, R2 = AUTO_ACTOR_R * AUTO_ACTOR_R;
    for (const a of crowd.agents) {
      if (a.side !== "dich") continue;
      if (crowd.hittable(a)) consider(a, 0);
      else if (crowd.strikeable(a) && (a.x - this.x) ** 2 + (a.z - this.z) ** 2 < R2) consider(a, 0);    // lính diễn địch sát tướng (đợt 15b)
    }
    for (const u of this.ctx.units) if (u.side === "dich" && u.alive && !u.dead && !u.retreating) consider(u, 1.5);
    return best;
  }
  findBroken() {
    const R = this.ranged ? 8 : 4.5;                                   // cung: Đòn Quyết bắn sát mặt từ 8 m (ĐỀ XUẤT BẢN THỬ)
    for (const u of this.ctx.units) if (u.side === "dich" && u.broken > 0 && u.alive && !u.dead && Math.hypot(u.x - this.x, u.z - this.z) < R) return u;
    return null;
  }
  faceLock() { return Math.atan2(this.lock.x - this.x, this.lock.z - this.z); }
  toggleLock() {
    if (this.lock) { this.lock = null; return; }
    let best = null, bd = 30 * 30;
    for (const u of this.ctx.units) {
      if (u.side !== "dich" || !u.alive || u.dead || u.retreating) continue;
      const d2 = (u.x - this.x) ** 2 + (u.z - this.z) ** 2; if (d2 < bd) { bd = d2; best = u; }
    }
    this.lock = best;
  }
  heal(frac) { this.hp = Math.min(this.maxHp, this.hp + this.maxHp * frac); }

  setPose(p, k) { this.pose = A.blendPoseQ(this.pose, p, Math.min(1, k)); A.applyPose(this.rig, this.pose); }
  // dt = bước mô phỏng vừa chạy (0 khi dựng lần đầu): chuyển động phụ chỉ chạy theo bước mô phỏng nên
  // hit-stop (0 bước) làm vải, dải khăn đứng yên cùng người.
  place(dt = 0) {
    const climb = this.state === "climb" && this.climbY !== undefined;
    this.y = climb ? this.climbY : heightAt(this.x, this.z);
    const r = this.rig.root; r.position.set(this.x, this.y, this.z); r.rotation.y = this.yaw;
    this.motion.update(dt, this.pose, heightAt, climb ? NO_IK : undefined);
    const vis = this.invuln > 0 && this.state !== "ult" ? (Math.floor(this.animT * 14) % 2 === 0) : true;
    r.visible = vis || !this.alive;
    if (this.handArrow) {                                              // tên cầm tay: gốc ở tay phải, mũi chĩa tay cầm cung
      const on = this.nocked(); this.handArrow.visible = on;
      if (on) { this.rig.p.handL.getWorldPosition(_s); this.handArrow.lookAt(_s); }
    }
    // vệt lưỡi khi ra đòn, lao, Tuyệt Kỹ
    const swinging = this.state === "attack" || this.state === "skill" || this.state === "ult";
    if (swinging) {
      r.updateMatrixWorld(true);
      this.trailSrc.forEach((s, i) => {
        _b.copy(s.base); s.j.localToWorld(_b); _t.copy(s.tip); s.j.localToWorld(_t); s.pivot.getWorldPosition(_s);
        this.trails[i].push(_b, _t, _s);
      });
    } else for (const tr of this.trails) tr.cut();
  }
}
