// battle/rig-motion.js — chuyển động phụ cho rig khớp nối (tướng, sĩ quan, boss, tướng đồng minh):
//   · chân bám đất: IK hai chân (ik.js), hạ hông cho chân phía đất thấp, cổ chân nằm theo dốc khi chạm đất; đế giày theo
//     rig.foot (rig khối: LEG; thân GLB: đế, mũi, gót của lưới — meta.foot);
//   · 4 vạt áo lò xo: nặng theo trọng lực, bị gió/quán tính kéo, bị đùi đẩy (không xuyên chân), xoè khi xoay
//     (gia tốc hướng tâm ∝ ω² của điểm treo);
//   · dây treo (dải khăn, tua giáo, tua đại đao) mô phỏng PBD trong không gian thế giới, dải khăn không xuyên đầu;
//   · lưỡi vũ khí không cắm xuống đất (gập cổ tay vừa đủ);
//   · áo choàng sĩ quan: 3 khúc bản lề (xương, lưới bọc da liền mặt), mỗi khúc một lò xo, khúc dưới trễ theo khúc
//     trên (nâng, bay phần phật khi chạy, rủ khi đứng, uốn cong khi xoay/xoắn người), không xuyên cạp áo, vạt sau,
//     đùi, cẳng chân;
//   · cờ sau lưng tướng: vải xoay quanh cán (lò xo theo tốc độ, gió), nằm ngang khi ngã;
//   · tay trái nắm chuôi vũ khí hai tay (đại kiếm WC01, rig có dyn.grip): IK tay hai khúc tới điểm nắm trên chuôi, theo độ dài
//     tay của rig (thân GLB: khung gắn của mô hình); tay phải của tư thế WC01 (giải cho tay 0,34 + 0,36) giải lại theo số đo tay
//     của rig trước đó (anim-wc01.js fitArms — thân GLB tay ngắn: tay trái với tới chuôi, cả thanh gươm tránh lưới mặt dyn.head; rig khối giữ nguyên).
// Mỗi rig một thể hiện. Gọi update(dt, pose, ground) SAU khi đã đặt root (vị trí, yaw) và tư thế (applyPose):
// dt là bước mô phỏng của Hero.update / BigUnit.update (1/60 s; hit-stop không có bước nào nên vải cũng đứng
// yên), dt = 0 chỉ dựng lại hình, không chạy động lực. pose là tư thế đang trộn (anim.js): chân và hông dựng lại
// từ pose mỗi lượt nên không cộng dồn IK dù lượt trước không gọi applyPose.

import * as THREE from "three";
import * as IK from "./ik.js";
import { LEG } from "./models.js";
import { fitGeo, fitArms, refitArms } from "./anim-wc01.js";

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const TAU = Math.PI * 2, wrap = (x) => x - TAU * Math.round(x / TAU);
const G = 9.8;

// ĐỀ XUẤT BẢN THỬ — hệ số chuyển động phụ (tinh chỉnh bằng mắt trong lab.html)
const K = {
  maxDrop: 0.32,          // hạ hông tối đa (m, nhân cỡ rig)
  maxShift: 0.42,         // dời bàn chân tối đa theo phương đứng (m)
  dropRate: 16,           // lọc hạ hông (1/s)
  flareK: 110, flareZ: 0.42, swayK: 70, swayZ: 0.35,        // vạt áo: lò xo xoè / đưa ngang
  flareMax: 1.3, flareMin: -0.12, swayMax: 0.45,
  drag0: 0.35, drag1: 0.12,                                 // cản gió: a = −v·(drag0 + drag1·|v|)
  legR: 0.105,            // nửa bề dày đùi + khe hở khi xét đùi đẩy vạt (đơn vị rig)
  legSway: 0.35,          // vạt hai bên đưa theo đùi trước/sau
  // áo choàng: khúc i có lò xo capeK × capeKs[i] (khúc dưới mềm hơn, trễ hơn), đích góc của khúc dưới kéo về góc khúc
  // trên theo capeFollow (vải liền: khúc trên vung thì khúc dưới bị kéo theo, chậm một nhịp), lực nâng × capeLift[i]
  // (gấu áo tự do bay cao hơn phần sát lưng), gập giữa hai khúc ≤ capeBend, đưa ngang lệch khúc trên ≤ capeTwist.
  // Trước đây một tấm cứng nên phải chặn quán tính (0,6, 14 m/s²) cho khỏi vểnh thẳng như tấm ván khi xoay; nay áo
  // uốn được nên nới ra.
  capeK: 55, capeZ: 0.45, capeKs: [1, 0.5, 0.3], capeFollow: 0.35, capeLift: [0.7, 1.15, 1.5],
  capeMaxs: [1.2, 1.45, 1.6], capeSway: [0.45, 0.6, 0.75], capeBend: 0.9, capeTwist: 0.35,
  capeFlutter: 0.07, capeInertia: 0.8, capeAccMax: 18,
  flagK: 45, flagZ: 0.25, poleK: 150, poleZ: 0.3,
  flagRest: 0.75,         // vải cờ lúc đứng: xoay quanh cán chếch sau-trái (rad), mặt chữ nhìn chếch về sau-phải
  ropeMaxV: 20,
  bladeMax: 1.0,          // gập cổ tay tối đa để lưỡi vũ khí khỏi cắm đất (rad)
  wristLo: -0.5, wristHi: 1.6,   // góc cổ tay (hand*x) sau khi gập vẫn trong tầm tự nhiên: quá 1,6 lưỡi gập ngược vào người
  jump: 0.8,              // root dời quá chừng này trong một lượt = dịch chuyển tức thời (dời cả dây, xoá vận tốc)
  // tay trái nắm chuôi (gripIK): hướng gợi ý khuỷu trong khung thân (ra ngoài bên trái, chúc xuống, hơi ra sau); trọng số
  // giảm dần khi điểm nắm xa quá tầm với (tỉ lệ khoảng cách / dài tay từ gripFar0 tới gripFar1) — hơi quá tầm (nhát chém
  // nhanh, 1–3 khung) thì tay vẫn duỗi thẳng về phía chuôi thay vì buông về tư thế gốc
  gripPole: [-1, -0.7, -0.25], gripFar0: 1.3, gripFar1: 2.0,
};
const _arm = [0, 0, 0, 0], _e = new THREE.Euler(0, 0, 0, "YXZ");

const _v = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3();
const _f = new THREE.Vector3(), _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3();
const _inv = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const _hm = new THREE.Matrix4(), _cm = new THREE.Matrix4();
const DOWN = new THREE.Vector3(0, -1, 0);
const _ik = [0, 0];
const ROPE_OPT = { damp: 2.2, g: G, floor: -Infinity, maxV: K.ropeMaxV, reset: false };

// Giá của một góc gập cổ tay d (từ góc a0 của pose): |d| cộng phạt nặng phần ra ngoài tầm tự nhiên (fixBlades).
const wristCost = (d, a0) => Math.abs(d) + 4 * (Math.max(0, K.wristLo - a0 - d) + Math.max(0, a0 + d - K.wristHi));

// Góc xoè để mặt vạt f cách điểm chân (ra ngoài qn, sâu qd, ngang t, cách mép treo rho; khung vạt, đơn vị rig) đúng D
// theo phương vuông góc mặt vạt: atan2(qn, qd) + asin(D/ρ) − góc nón (trước đây cộng D theo phương ngang — vạt xoè lớn
// thì khe thật chỉ còn D·cos(góc), cẳng chân sau xuyên). D = bán kính chân + khe + độ lõm của mặt vạt (cung tròn bán
// kính r nở dần xuống gấu) ở chỗ tì: xét ba điểm trên mặt cắt chân lệch ngang δ (vạt lõm vào mạnh nhất ở rìa, chân
// tròn thấp dần về hai bên).
function flapClear(f, qn, qd, t, rho) {
  const r = f.r0 + (f.r1 - f.r0) * Math.min(1, rho / f.h), a = Math.abs(t), rl = K.legR - 0.02;
  let D = 0;
  for (let i = 0; i < 3; i++) {
    const dl = rl * (i === 0 ? 0 : i === 1 ? 0.6 : 0.9), c = Math.min(a + dl, r * 0.76);
    D = Math.max(D, r - Math.sqrt(r * r - c * c) + Math.sqrt(rl * rl - dl * dl));
  }
  D += K.legR - rl;
  return Math.atan2(qn, qd) + Math.asin(Math.min(1, D / Math.max(rho, 1e-3))) - f.cone;
}

// Điểm có vận tốc, gia tốc lọc (tính từ vị trí thế giới giữa hai lượt).
class Tracker {
  constructor() { this.p = new THREE.Vector3(); this.v = new THREE.Vector3(); this.a = new THREE.Vector3(); this._n = new THREE.Vector3(); }
  reset(p) { this.p.copy(p); this.v.set(0, 0, 0); this.a.set(0, 0, 0); }
  step(p, dt) {
    if (!(dt > 0)) return;
    const kv = 1 - Math.exp(-dt * 30), ka = 1 - Math.exp(-dt * 18);
    const n = this._n.subVectors(p, this.p).divideScalar(dt);
    if (n.lengthSq() > 900) n.setLength(30);                 // chặn gai (va chạm đẩy, bước nhảy nhỏ)
    const ax = (n.x - this.v.x) / dt, ay = (n.y - this.v.y) / dt, az = (n.z - this.v.z) / dt;
    this.v.lerp(n, kv);
    this.a.x += (clamp(ax, -120, 120) - this.a.x) * ka; this.a.y += (clamp(ay, -120, 120) - this.a.y) * ka; this.a.z += (clamp(az, -120, 120) - this.a.z) * ka;
    this.p.copy(p);
  }
  // Lực trên một đơn vị khối lượng (thế giới): trọng lực − ki·gia tốc (quán tính) + cản gió. Ghi vào out.
  force(out, ki = 1) {
    const sp = this.v.length(), k = K.drag0 + K.drag1 * sp;
    return out.set(-ki * this.a.x - this.v.x * k, -G - ki * this.a.y - this.v.y * k, -ki * this.a.z - this.v.z * k);
  }
}

export class RigMotion {
  constructor(rig) {
    this.rig = rig; this.s = rig.scale;
    const d = rig.dyn || { flaps: [], ropes: [] };
    this.flaps = d.flaps.map((f) => ({ ...f, cone: Math.atan2(f.r1 - f.r0, f.h), st: new Float32Array(4), tr: new Tracker(),
      n: new THREE.Vector3(Math.sin(f.yaw), 0, Math.cos(f.yaw)), t: new THREE.Vector3(Math.cos(f.yaw), 0, -Math.sin(f.yaw)),
      side: Math.round(Math.sin(f.yaw)) }));
    this.backFlap = this.flaps.find((f) => f.yaw === Math.PI) || null;
    this.ropes = d.ropes;
    // áo choàng: mỗi khúc (xương) một trạng thái lò xo; obs = điểm cản [x, y, z, r] trong khung thân, dựng lại mỗi lượt
    this.cape = d.cape ? { segs: d.cape.joints.map((j, i) => ({ j, h: d.cape.h[i], st: new Float32Array(4) })),
      tr: new Tracker(), obs: new Float32Array(4 * 16), nObs: 0 } : null;
    this.flag = d.flag ? { j: d.flag, cloth: rig.p.flagCloth, st: new Float32Array(4), pole: new Float32Array(4), tr: new Tracker() } : null;
    this.blades = d.blades || [];
    this.grip = d.grip || null;             // { j: khớp cầm vũ khí, local: điểm tay trái nắm (khung khớp đó) }
    const P = rig.p;
    // tay trái theo độ dài tay của rig (gripIK): vai → khuỷu dài L1 (dọc −y), khuỷu → cổ tay dài L2 lệch góc off quanh trục x — rig
    // khối 0,34 và (0, −0,36, 0,02); thân GLB theo khung gắn của mô hình (khớp lúc chạy = khung gắn, models.js applyRest)
    const eL = P.elL.position, hL = P.handL.position;
    this.arm = { L1: Math.hypot(eL.x, eL.y, eL.z), L2: Math.hypot(hL.y, hL.z), off: Math.atan2(hL.z, -hL.y) };
    // tay phải đại kiếm theo số đo tay của rig (anim-wc01.js fitGeo / fitArms; null = rig khối, tư thế dùng thẳng); fq: tư thế đã
    // giải lại (dùng lại mỗi lượt)
    this.fit = this.grip ? fitGeo(P, d.blade, d.head || null) : null; this.fq = {};
    // đế giày (khung cổ chân): rig khối LEG; thân GLB theo lưới (models.js rig.foot từ meta.foot)
    this.foot = rig.foot || LEG;
    this.legs = [
      { hip: P.hipL, knee: P.kneeL, ankle: P.ankleL, key: "L", d: 0, c: 0, pw: 0, pa: 0, roll: 0, rollA: 0, gx: 0, gz: 0, g: 0 },
      { hip: P.hipR, knee: P.kneeR, ankle: P.ankleR, key: "R", d: 0, c: 0, pw: 0, pa: 0, roll: 0, rollA: 0, gx: 0, gz: 0, g: 0 },
    ];
    this.w = 1; this.on = 1; this.drop = 0; this.t = 0; this.init = false;
    this.rootPrev = new THREE.Vector3();
    // Chỉ tính lại ma trận thế giới của các khớp cần cho điểm neo (hông, thân, đầu, tay cầm vũ khí có tua hay có
    // lưỡi), cha trước con — không duyệt cả cây (trình vẽ tự cập nhật phần còn lại trước khi vẽ).
    const need = [P.hips];
    for (const r of this.ropes) need.push(r.j);
    for (const b of this.blades) need.push(b.j);
    if (this.cape || this.flag) need.push(P.torso);
    const chain = [];
    for (const j of need) { const up = []; for (let o = j; o && o !== rig.root; o = o.parent) up.unshift(o); for (const o of up) if (!chain.includes(o)) chain.push(o); }
    this.chain = chain;
  }

  // Dịch chuyển tức thời (dời quân, bước chớp của Tuyệt Kỹ): dời cả dây theo root (giữ dáng dây), xoá vận tốc
  // các điểm theo dõi để vạt áo không giật vì "gia tốc" giả.
  teleport(dx, dy, dz) {
    for (const r of this.ropes) for (let k = 0; k < r.n; k++) { const o = k * 6; r.pts[o] += dx; r.pts[o + 1] += dy; r.pts[o + 2] += dz; }
    this.jumped = true;
  }

  update(dt, pose, ground, o = null) {
    const P = this.rig.p, root = this.rig.root;
    if (!(dt > 0)) dt = 0;
    const first = !this.init, snap = first || !!(o && o.snap);
    this.jumped = false;
    if (!first && root.position.distanceToSquared(this.rootPrev) > K.jump * K.jump) {
      _d.subVectors(root.position, this.rootPrev); this.teleport(_d.x, _d.y, _d.z);
    }
    const fresh = first || this.jumped;          // đặt lại điểm theo dõi vận tốc
    this.t += dt;
    root.updateWorldMatrix(true, false);

    // ---- 1. chân bám đất ----
    this.legIK(dt, pose, ground, snap, !(o && o.ik === false));
    // tay phải đại kiếm theo số đo rig (thân GLB): q = tư thế đã giải lại tay phải — lưỡi, tay trái theo q; dt (0 ở khung đầu, nhảy
    // chỗ): chiều lật chắn tay, chiều lưỡi sắc theo khung trước (this.fq giữ qua các khung) — bàn tay không lật qua lại
    let q = pose;
    if (this.fit) q = this.setArmR(fitArms(pose, this.fit, this.fq, snap ? 0 : dt));
    // ---- 2. ma trận phần trên (hông đã hạ) để lấy điểm neo; lưỡi vũ khí không cắm đất ----
    for (let i = 0; i < this.chain.length; i++) this.chain[i].updateWorldMatrix(false, false);
    if (this.blades.length) this.fixBlades(q, ground);
    // cổ tay phải vừa gập cho lưỡi khỏi cắm đất: giữ hướng lưỡi đó, đưa cổ tay lại vào tầm với (điểm nắm đổi chỗ theo lưỡi)
    if (this.fit && P.handR.rotation.x !== q.handRx) {
      q = this.setArmR(refitArms(q, this.fit, P.handR.rotation.x, this.fq));
      for (let i = 0; i < this.chain.length; i++) this.chain[i].updateWorldMatrix(false, false);
      this.fixBlades(q, ground);
    }
    if (this.grip) this.gripIK(q);             // sau fixBlades: cổ tay phải gập thì chuôi đổi chỗ
    // ---- 3. vạt áo, áo choàng, cờ, dây ----
    this.updateFlaps(dt, first, fresh);
    if (this.cape) this.updateCape(dt, first, fresh);
    if (this.flag) this.updateFlag(dt, first, fresh);
    this.updateRopes(dt, ground, first);

    this.rootPrev.copy(root.position);
    this.init = true;
  }

  // ---- chân ----------------------------------------------------------------------------------
  legIK(dt, pose, ground, snap, on) {
    const P = this.rig.p, root = this.rig.root, s = this.s, FT = this.foot;
    // dựng lại chân, hông theo tư thế gốc (bỏ kết quả IK lượt trước)
    P.hips.position.y = 0.92 + pose.hipsY;
    P.hipL.rotation.set(pose.hipLx, 0, pose.hipLz); P.hipR.rotation.set(pose.hipRx, 0, pose.hipRz);
    P.kneeL.rotation.x = pose.kneeLx; P.kneeR.rotation.x = pose.kneeRx;
    P.ankleL.rotation.set(0, 0, 0); P.ankleR.rotation.set(0, 0, 0);
    // trọng số IK: tắt khi thân nghiêng nhiều (lộn né, ngã, nằm) — theo thẳng độ nghiêng của tư thế (pose đã trộn mượt
    // nên trọng số cũng mượt), chỉ phần bật/tắt IK (o.ik) mới lọc cho khỏi giật. Trước đây lọc cả trọng số 12/s nên
    // trễ ~80 ms: thân đã lộn ngược, đã ngã mà IK còn 40–86% (giả định bàn chân đứng thẳng sai hẳn, bẻ đùi, gối lệch
    // tư thế tới 1,4 rad); lộn xong, gượng dậy đứng thẳng rồi IK mới 0,3–0,7 (bàn chân lún đất 7–12 cm).
    const tilt = Math.acos(clamp(Math.cos(pose.rootX) * Math.cos(pose.rootZ), -1, 1));
    this.on = snap ? (on ? 1 : 0) : this.on + ((on ? 1 : 0) - this.on) * Math.min(1, dt * 12);
    this.w = this.on * (1 - smooth(0.3, 0.75, tilt));
    const w = this.w;
    if (w < 1e-3 && !snap) {
      this.drop += (0 - this.drop) * Math.min(1, dt * K.dropRate);
      P.hips.position.y += this.drop / s;
      if (on) this.liftFeet(ground);
      return;
    }
    const g0 = root.position.y;
    P.hips.updateWorldMatrix(false, false);
    for (let li = 0; li < 2; li++) {
      const L = this.legs[li];
      L.hip.updateWorldMatrix(false, false); L.knee.updateWorldMatrix(false, false); L.ankle.updateWorldMatrix(false, false);
      const m = L.ankle.matrixWorld;
      _a.setFromMatrixPosition(m);
      _v.set(0, -FT.sole, FT.footZ).applyMatrix4(m);          // tâm đế giày
      _f.setFromMatrixColumn(m, 2).normalize();                 // mũi bàn chân
      _x.setFromMatrixColumn(m, 0).normalize();                 // phía phải bàn chân
      const liftA = _v.y - g0, lift = Math.max(0, liftA);
      const c = IK.contact(lift);
      // góc bàn chân (quanh trục ngang của chân) theo hoạt ảnh, góc dốc dưới bàn chân
      L.pa = -Math.asin(clamp(_f.y, -1, 1));
      const hx = Math.hypot(_f.x, _f.z) || 1, slopeP = IK.slopePitch(ground, _v.x, _v.z, _f.x / hx, _f.z / hx, 0.22 * s);
      L.pw = L.pa + (slopeP - L.pa) * c;
      // tâm đế sau khi cổ chân xoay tới góc pw lệch khỏi chỗ cũ theo mũi chân: lấy độ cao đất ở chỗ mới
      const zOff = (-FT.sole * Math.sin(L.pw) + FT.footZ * Math.cos(L.pw)) * s / hx;
      const gF = ground(_a.x + _f.x * zOff, _a.z + _f.z * zOff);
      // nghiêng ngang: đế theo dốc ngang khi chạm đất
      const rx = Math.hypot(_x.x, _x.z) || 1, dd = 0.1 * s;
      const sAcross = (ground(_v.x + _x.x / rx * dd, _v.z + _x.z / rx * dd) - ground(_v.x - _x.x / rx * dd, _v.z - _x.z / rx * dd)) / (2 * dd);
      L.rollA = Math.asin(clamp(_x.y, -1, 1));
      L.roll = (Math.atan(clamp(sAcross, -1.2, 1.2)) - L.rollA) * c;
      // cổ chân phải ở đâu để tâm đế nằm đúng mặt đất + độ nhấc chân của hoạt ảnh
      const dyOff = (-FT.sole * Math.cos(L.pw) - FT.footZ * Math.sin(L.pw)) * s;
      L.d = clamp(gF + lift - dyOff - _a.y, -K.maxShift * s, K.maxShift * s);
      L.c = c; L.gx = _v.x; L.gz = _v.z; L.g = gF;
    }
    const dropT = IK.pelvisDrop(this.legs[0].d, this.legs[1].d, K.maxDrop * s) * w;
    this.drop = snap ? dropT : this.drop + (dropT - this.drop) * Math.min(1, dt * K.dropRate);
    P.hips.position.y = 0.92 + pose.hipsY + this.drop / s;
    const tiltC = Math.max(0.3, Math.cos(tilt));
    for (let li = 0; li < 2; li++) {
      const L = this.legs[li];
      const th0 = L.hip.rotation.x, kn0 = L.knee.rotation.x, rz = L.hip.rotation.z;
      const dy = (L.d - this.drop) / s / (tiltC * Math.max(0.5, Math.cos(rz)));
      IK.legShift(th0, kn0, LEG.L1, LEG.L2, dy, _ik);
      const th = th0 + (_ik[0] - th0) * w, kn = kn0 + (_ik[1] - kn0) * w;
      L.hip.rotation.x = th; L.knee.rotation.x = kn;
      // cổ chân: giữ góc bàn chân theo thế giới (bù phần IK đổi), khi chạm đất thì nằm theo dốc
      L.ankle.rotation.x = clamp(w * (L.pw - L.pa) - (th - th0) - (kn - kn0), -1.0, 1.0);
      L.ankle.rotation.z = clamp(w * L.roll, -0.5, 0.5);
    }
    if (on && w < 0.999) this.liftFeet(ground);
  }

  // Bàn chân không lún đất khi thân nghiêng (lộn né, ngã, nằm, chết, gượng dậy): IK trên tắt dần theo độ nghiêng (nó
  // giả định bàn chân đứng thẳng), phần này chỉ đẩy lên. Lấy góc đế giày thấp nhất dưới mặt đất, dời cổ chân theo
  // phương thẳng đứng của thế giới đổi về mặt phẳng chân (khung hông) rồi giải lại IK hai khúc; cổ chân bù phần đùi,
  // gối đổi (giữ góc bàn chân). Trước đây chân nằm, chân ngã ngửa cắm xuống đất 0,2–0,4 m.
  liftFeet(ground) {
    const P = this.rig.p, s = this.s, FT = this.foot;
    P.hips.updateWorldMatrix(false, false);
    // phương thẳng đứng thế giới trong khung hông = hàng y của ma trận xoay (ma trận thế giới có scale s)
    const e = P.hips.matrixWorld.elements, ny = e[5] / s, nz = e[9] / s, m2 = ny * ny + nz * nz;
    if (m2 < 0.1) return;                 // nằm nghiêng hẳn sang bên: dời trong mặt phẳng chân không nâng được bàn chân
    for (let li = 0; li < 2; li++) {
      const L = this.legs[li];
      L.hip.updateWorldMatrix(false, false); L.knee.updateWorldMatrix(false, false); L.ankle.updateWorldMatrix(false, false);
      let pen = 0;
      for (let c = 0; c < 4; c++) {
        _v.set(c & 1 ? 0.08 : -0.08, -FT.sole, c & 2 ? FT.toe : FT.heel).applyMatrix4(L.ankle.matrixWorld);
        pen = Math.max(pen, ground(_v.x, _v.z) + 0.005 - _v.y);
      }
      if (pen <= 0) continue;
      const d = Math.min(pen, K.maxShift * s) / (s * m2);
      const th0 = L.hip.rotation.x, kn0 = L.knee.rotation.x;
      IK.footPos(th0, kn0, LEG.L1, LEG.L2, _ik);
      IK.legIK(_ik[0] + d * ny, _ik[1] + d * nz, LEG.L1, LEG.L2, _ik);
      L.hip.rotation.x = _ik[0]; L.knee.rotation.x = _ik[1];
      L.ankle.rotation.x = clamp(L.ankle.rotation.x - (_ik[0] - th0) - (_ik[1] - kn0), -1.0, 1.0);
    }
  }

  // ---- lưỡi vũ khí -------------------------------------------------------------------------------
  // Đòn bổ (C1, C4, Đòn Quyết, đòn nặng của sĩ quan), lộn né, đất dốc lên trước mặt đưa mũi vũ khí xuống dưới mặt đất:
  // gập cổ tay (quanh trục x khung cẳng tay, quay quanh cổ tay) vừa đủ để điểm thấp nhất của lưỡi nằm trên mặt đất — lưỡi
  // bổ xuống thì dừng ở mặt đất như chém vào đất. Giải kín: xoay véc-tơ r (cổ tay → điểm) quanh trục a một góc δ thì
  // độ cao là A·cos δ + B·sin δ + C; hai nghiệm biên, lấy nghiệm có |δ| nhỏ mà góc cổ tay sau khi gập còn trong tầm tự
  // nhiên [wristLo, wristHi] (nghiệm kia thường gập lưỡi ngược ra sau, xuyên vào chân mình), không quá bladeMax. Góc cổ
  // tay dựng lại từ pose mỗi lượt (không cộng dồn).
  fixBlades(pose, ground) {
    for (let bi = 0; bi < this.blades.length; bi++) {
      const b = this.blades[bi], j = b.j, pts = b.pts, a0 = pose[b.key];
      j.rotation.x = a0;
      j.updateWorldMatrix(false, false);
      const m = j.matrixWorld;
      let worst = 0, wi = -1;
      for (let k = 0; k < pts.length; k += 3) {
        _v.set(pts[k], pts[k + 1], pts[k + 2]).applyMatrix4(m);
        const pen = ground(_v.x, _v.z) + 0.03 - _v.y;
        if (pen > worst) { worst = pen; wi = k; }
      }
      if (wi < 0) continue;
      _v.set(pts[wi], pts[wi + 1], pts[wi + 2]).applyMatrix4(m);
      _b.setFromMatrixPosition(m);
      _d.subVectors(_v, _b);                                          // r: cổ tay → điểm (thế giới)
      _x.setFromMatrixColumn(j.parent.matrixWorld, 0).normalize();    // trục gập: x của khung cẳng tay
      const ar = _x.dot(_d), A = _d.y - _x.y * ar, B = _x.z * _d.x - _x.x * _d.z, C = _x.y * ar;
      const R = Math.hypot(A, B), T = _v.y + worst - _b.y;            // độ cao cần (so với cổ tay)
      if (R < 1e-4) continue;
      const phi = Math.atan2(B, A), q = (T - C) / R;
      let dl;
      if (q >= 1) dl = wrap(phi);                                     // không với tới: nâng cao nhất có thể
      else {
        const ac = Math.acos(Math.max(-1, q)), d1 = wrap(phi - ac), d2 = wrap(phi + ac);
        dl = wristCost(d1, a0) < wristCost(d2, a0) ? d1 : d2;
      }
      const lo = Math.max(-K.bladeMax, Math.min(0, K.wristLo - a0)), hi = Math.min(K.bladeMax, Math.max(0, K.wristHi - a0));
      j.rotation.x = a0 + clamp(dl, lo, hi);
      j.updateWorldMatrix(false, false);
    }
  }

  // tay phải theo tư thế q (fitArms / refitArms) → khớp; trả q
  setArmR(q) {
    const P = this.rig.p;
    P.shR.rotation.set(q.shRx, q.shRy, q.shRz); P.elR.rotation.x = q.elRx; P.handR.rotation.set(q.handRx, 0, q.handRz);
    return q;
  }

  // ---- tay trái nắm chuôi (vũ khí hai tay) ------------------------------------------------------------
  // Tư thế đại kiếm (anim-wc01.js) chỉ cần đặt tay phải; tay trái giải IK hai khúc (ik.js armIK) cho cổ tay tới điểm nắm
  // trên chuôi (dyn.grip, khung tay phải — đã gồm phần fixBlades gập cổ tay), trộn với tay trái của pose theo kênh grip
  // (0 = buông, vd lúc chỉ gươm một tay, ngã, lộn né) và theo tầm với. Vai trộn bằng quaternion (slerp), khuỷu tuyến tính.
  // Tay trái dựng lại từ pose mỗi lượt nên không cộng dồn. Không xoay bàn tay trái (không có mảnh nào gắn vào nó).
  gripIK(pose) {
    const P = this.rig.p, G = this.grip, w0 = clamp(pose.grip || 0, 0, 1);
    P.shL.rotation.set(pose.shLx, pose.shLy, pose.shLz); P.elL.rotation.x = pose.elLx;
    if (w0 < 1e-3) return;
    _v.copy(G.local).applyMatrix4(G.j.matrixWorld);                     // điểm nắm (thế giới)
    _v.applyMatrix4(_inv.copy(P.torso.matrixWorld).invert());           // về khung thân (đơn vị rig)
    const sh = P.shL.position, tx = _v.x - sh.x, ty = _v.y - sh.y, tz = _v.z - sh.z, pl = K.gripPole;
    const ARM = this.arm;
    IK.armIK(tx, ty, tz, pl[0], pl[1], pl[2], ARM.L1, ARM.L2, _arm);
    const w = w0 * (1 - smooth(K.gripFar0, K.gripFar1, Math.sqrt(tx * tx + ty * ty + tz * tz) / (ARM.L1 + ARM.L2)));
    if (w < 1e-3) return;
    _q.setFromEuler(P.shL.rotation);
    _q2.setFromEuler(_e.set(_arm[0], _arm[1], _arm[2], "YXZ"));
    P.shL.quaternion.copy(_q.slerp(_q2, w));
    P.elL.rotation.x = pose.elLx + (_arm[3] + ARM.off - pose.elLx) * w;
  }

  // ---- vạt áo ------------------------------------------------------------------------------------
  updateFlaps(dt, first, fresh) {
    const P = this.rig.p, hm = P.hips.matrixWorld;
    // trục khung hông (thế giới, đã bỏ scale)
    _x.setFromMatrixColumn(hm, 0).normalize(); _y.setFromMatrixColumn(hm, 1).normalize(); _z.setFromMatrixColumn(hm, 2).normalize();
    const thL = P.hipL.rotation.x, thR = P.hipR.rotation.x, rzL = P.hipL.rotation.z, rzR = P.hipR.rotation.z;
    const knL = P.kneeL.rotation.x, knR = P.kneeR.rotation.x;
    // nằm (ngã ngửa) hay đang lộn: trọng lực kéo vạt xuyên xuống đất → về dáng nghỉ, như bị thân đè
    const up = 1 - smooth(0.25, 0.7, _y.y);
    for (let fi = 0; fi < this.flaps.length; fi++) {
      const f = this.flaps[fi];
      _v.copy(f.j.position).applyMatrix4(hm);
      if (first) f.st[0] = f.st[1] = f.st[2] = f.st[3] = 0;
      if (fresh) f.tr.reset(_v); else f.tr.step(_v, dt);
      f.tr.force(_d);
      // đổi lực về khung mảnh vạt: n ra ngoài, t ngang (trục x của mảnh), y lên
      const nx = _x.x * f.n.x + _z.x * f.n.z, ny = _x.y * f.n.x + _z.y * f.n.z, nz = _x.z * f.n.x + _z.z * f.n.z;
      const tx = _x.x * f.t.x + _z.x * f.t.z, ty = _x.y * f.t.x + _z.y * f.t.z, tz = _x.z * f.t.x + _z.z * f.t.z;
      const Fn = _d.x * nx + _d.y * ny + _d.z * nz, Ft = _d.x * tx + _d.y * ty + _d.z * tz, Fd = -(_d.x * _y.x + _d.y * _y.y + _d.z * _y.z);
      let flareT = Math.atan2(Fn, Math.max(0.05, Fd) + Math.max(0, -Fd) * 0.3);
      let swayT = Math.atan2(Ft, Math.max(1, Fd));
      // vạt hai bên đưa theo đùi cùng phía (đùi ra trước → gấu vạt ra trước)
      if (f.side) swayT += K.legSway * (f.side > 0 ? thR : -thL);
      // chân đẩy vạt: góc xoè tối thiểu để gấu vạt nằm ngoài đùi, cẳng chân
      const need = Math.max(this.legPush(f, -1, thL, rzL, knL), this.legPush(f, 1, thR, rzR, knR));
      flareT = clamp(flareT, K.flareMin, K.flareMax) * (1 - up); swayT = clamp(swayT, -K.swayMax, K.swayMax) * (1 - up);
      if (first || !(dt > 0)) {
        if (first) { f.st[0] = Math.max(flareT, need); f.st[2] = swayT; }
      } else {
        IK.spring(f.st, 0, flareT, K.flareK, IK.damping(K.flareK, K.flareZ), dt);
        IK.spring(f.st, 2, swayT, K.swayK, IK.damping(K.swayK, K.swayZ), dt);
      }
      if (f.st[0] < need) { f.st[0] = need; if (f.st[1] < 0) f.st[1] = 0; }
      if (f.st[0] > K.flareMax) { f.st[0] = K.flareMax; if (f.st[1] > 0) f.st[1] = 0; }
      if (f.st[0] < K.flareMin) { f.st[0] = K.flareMin; if (f.st[1] < 0) f.st[1] = 0; }
      f.st[2] = clamp(f.st[2], -K.swayMax, K.swayMax);
      f.j.rotation.x = -f.st[0]; f.j.rotation.z = f.st[2];
    }
  }

  // Góc xoè tối thiểu của mảnh vạt f để gấu vạt nằm ngoài chân bên sd — đùi và cẳng chân (khung hông, đơn vị rig).
  // Điểm mẫu dọc chân đổi về toạ độ mặt vạt: ρ = khoảng cách tới mép treo trong mặt phẳng (ra ngoài, xuống), t ngang,
  // rồi xoay (t, ρ) theo góc đưa ngang hiện tại của vạt (vạt đưa ngang thì chỗ nó che đổi theo). Điểm vạt với tới
  // (|t| ≤ nửa bề rộng, ρ ≤ dài vạt) đòi góc xoè flapClear(). Chân ra khỏi tầm vạt giữa hai điểm mẫu thì lấy thêm
  // điểm cắt vòng tầm với (nội suy): gấu vạt tì lên chân đúng chỗ đó. Trước đây chỉ xét đùi, bỏ điểm ngoài tầm, không
  // tính góc đưa ngang: khi chạy cẳng chân sau hất lên xuyên gấu vạt sau, cẳng chân trước cắt gấu vạt trước (10–35%
  // khung, sâu tới 9 cm).
  legPush(f, sd, th, rz, kn) {
    const sr = Math.sin(rz), cr = Math.cos(rz), ct = Math.cos(th), stt = Math.sin(th), ck = Math.cos(kn), sk = Math.sin(kn);
    const ux = sr, uy = -cr * ct, uz = -cr * stt;                                        // hướng đùi
    const wx = ck * sr, wy = -ck * cr * ct + sk * stt, wz = -ck * cr * stt - sk * ct;    // hướng cẳng chân (như capeObstacles)
    const ox = 0.12 * sd - f.j.position.x, oy = -0.02 - f.j.position.y, oz = -f.j.position.z;   // khớp hông so với gốc vạt
    const R = (f.r0 + f.r1) * 0.5, half = R * 0.78 + K.legR, reach = f.h + 0.04;
    const cs = Math.cos(f.st[2]), sn = Math.sin(f.st[2]);
    let need = -9, pOk = false, pIn = false, pN = 0, pD = 0, pT = 0, pR = 0;
    for (let k = 1; k <= 9; k++) {
      let qx = ox, qy = oy, qz = oz;
      if (k <= 4) { const t = 0.1125 * k; qx += ux * t; qy += uy * t; qz += uz * t; }                       // đùi tới gối
      else { const t = 0.08 * (k - 4); qx += ux * LEG.L1 + wx * t; qy += uy * LEG.L1 + wy * t; qz += uz * LEG.L1 + wz * t; }  // cẳng chân
      const qd = -qy, qn = qx * f.n.x + qz * f.n.z, q0 = qx * f.t.x + qz * f.t.z;
      const rho = Math.hypot(qn, qd), qt = q0 * cs - rho * sn, rr = q0 * sn + rho * cs;
      const ok = qd > 0.01 && Math.abs(qt) <= half, inn = ok && rr <= reach;
      if (inn) need = Math.max(need, flapClear(f, qn, qd, qt, rho));
      if (ok && pOk && inn !== pIn) {                                 // khúc chân cắt vòng tầm với
        const a = (reach - pR) / (rr - pR), cn = pN + (qn - pN) * a, cd = pD + (qd - pD) * a;
        need = Math.max(need, flapClear(f, cn, cd, pT + (qt - pT) * a, Math.hypot(cn, cd)));
      }
      pOk = ok; pIn = inn; pN = qn; pD = qd; pT = qt; pR = rr;
    }
    return Math.min(need, K.flareMax);
  }

  // ---- áo choàng ---------------------------------------------------------------------------------
  // Mỗi khúc: st = [góc nâng, vận tốc, góc đưa ngang, vận tốc], góc tuyệt đối trong khung thân (0 = buông dọc lưng,
  // nâng dương = gấu ra sau). Khớp khúc i nhận hiệu góc của nó với khúc trên. Lực (trọng lực, quán tính, gió khi chạy)
  // lấy ở một điểm gắn với thân sau lưng; khúc dưới nâng theo lực mạnh hơn (capeLift) nhưng lò xo mềm hơn, và đích bị
  // kéo về góc khúc trên (capeFollow) nên khi thân xoay, xoắn nhanh áo uốn cong, gấu quật theo sau.
  updateCape(dt, first, fresh) {
    const C = this.cape, P = this.rig.p, tm = P.torso.matrixWorld, S = C.segs;
    _x.setFromMatrixColumn(tm, 0).normalize(); _y.setFromMatrixColumn(tm, 1).normalize(); _z.setFromMatrixColumn(tm, 2).normalize();
    _v.set(0, -0.45, 0).add(S[0].j.position).applyMatrix4(tm);        // điểm giữa áo (theo khung thân) để lấy vận tốc
    if (fresh) C.tr.reset(_v); else C.tr.step(_v, dt);
    const al = C.tr.a.length();
    C.tr.force(_d, K.capeInertia * (al > K.capeAccMax ? K.capeAccMax / al : 1));
    const Fb = -_d.dot(_z), Fx = _d.dot(_x), Fd = Math.max(0.5, -_d.dot(_y));
    const lie = 1 - smooth(0.25, 0.7, _y.y);
    this.capeObstacles();
    // bay phần phật theo tốc độ (không đưa vào lò xo: tần số cao hơn nhiều tần số riêng), sóng chạy dọc xuống gấu
    const sp = Math.min(1, C.tr.v.length() / 6), t = this.t;
    let aP = 0, bP = 0;                                               // góc tuyệt đối của khúc trên (thân: 0)
    _cm.identity();                                                   // khung khúc trên → khung thân
    for (let i = 0; i < S.length; i++) {
      const sg = S[i], st = sg.st, j = sg.j;
      _b.copy(j.position).applyMatrix4(_cm);                          // bản lề khúc i trong khung thân
      let liftT = Math.atan2(Fb * K.capeLift[i], Fd), swayT = clamp(Math.atan2(Fx * K.capeLift[i], Fd), -K.capeSway[i], K.capeSway[i]);
      if (i) { liftT += (aP - liftT) * K.capeFollow; swayT += (bP - swayT) * K.capeFollow; }
      const need = this.capeNeed(_b.x, _b.y, _b.z, sg.h, i ? -0.4 : 0.06);
      const lo = Math.max(need, aP - K.capeBend), hi = Math.max(lo, Math.min(K.capeMaxs[i], aP + K.capeBend));
      liftT = clamp(liftT, lo, hi); liftT += (need - liftT) * lie; swayT *= 1 - lie;
      if (first || !(dt > 0)) { if (first) { st[0] = liftT; st[2] = swayT; st[1] = st[3] = 0; } }
      else {
        const k = K.capeK * K.capeKs[i];
        IK.spring(st, 0, liftT, k, IK.damping(k, K.capeZ), dt);
        IK.spring(st, 2, swayT, k * 0.7, IK.damping(k * 0.7, K.capeZ), dt);
      }
      if (st[0] < lo) { st[0] = lo; if (st[1] < 0) st[1] = 0; }
      if (st[0] > hi) { st[0] = hi; if (st[1] > 0) st[1] = 0; }
      // đưa ngang lệch khúc trên ≤ capeTwist (lưới bọc da: lệch quá thì mặt vải ở bản lề xô lệch như bị cắt)
      const tw = i ? K.capeTwist : K.capeSway[0];
      st[2] = clamp(st[2], Math.max(-K.capeSway[i], bP - tw), Math.min(K.capeSway[i], bP + tw));
      const fl = K.capeFlutter * sp * (0.6 + 0.4 * i) * (Math.sin(t * 17.3 - 1.1 * i) + 0.6 * Math.sin(t * 29.1 + 1.3 - 1.7 * i));
      const a = clamp(st[0] + fl, lo, hi + 0.1), b = st[2] + 0.5 * fl;
      j.rotation.x = a - aP; j.rotation.z = b - bP;
      j.updateMatrix();
      _cm.multiply(j.matrix);
      aP = a; bP = b;
    }
  }
  // Góc nâng tối thiểu của khúc treo ở (px, py, pz) (khung thân), dài h, để không cắt điểm cản nào (điểm có bán kính r
  // nằm dưới bản lề, trong tầm với của khúc); floor = góc thấp nhất cho phép khi không vướng gì.
  capeNeed(px, py, pz, h, floor) {
    const o = this.cape.obs;
    let need = floor;
    for (let k = 0; k < this.cape.nObs; k++) {
      const q = k * 4, r = o[q + 3], dy = py - o[q + 1], dz = pz - o[q + 2];       // dz dương: điểm nằm sau bản lề
      if (dy < 0.02 || dy > h + r || Math.abs(o[q] - px) > 0.34 || dy * dy + dz * dz > (h + r) * (h + r)) continue;
      need = Math.max(need, Math.atan2(dz + r, dy));
    }
    return Math.min(need, 1.3);
  }
  putObs(v, r) { const C = this.cape, q = C.nObs * 4; C.obs[q] = v.x; C.obs[q + 1] = v.y; C.obs[q + 2] = v.z; C.obs[q + 3] = r; C.nObs++; }
  // Điểm cản đổi về khung thân: đai lưng, cạp áo, đường giữa vạt sau, đùi, cẳng chân (theo góc khớp sau IK).
  capeObstacles() {
    const P = this.rig.p;
    _inv.copy(P.torso.matrixWorld).invert();
    _hm.multiplyMatrices(_inv, P.hips.matrixWorld);                   // khung hông → khung thân
    this.cape.nObs = 0;
    this.putObs(_b.set(0, 0.1, -0.175), 0.03);                        // đai vàng quanh bụng (khung thân)
    this.putObs(_b.set(0, 0.0, -0.255).applyMatrix4(_hm), 0.03);     // cạp áo (khung hông)
    this.putObs(_b.set(0, 0.1, -0.255).applyMatrix4(_hm), 0.03);
    const back = this.backFlap;
    if (back) {
      back.j.updateMatrix();
      for (let k = 1; k <= 3; k++) {                                  // đường giữa vạt sau: mép trên ở gốc, buông −y, mặt ngoài +z
        const f = k / 3;
        this.putObs(_b.set(0, -back.h * f, (back.r1 - back.r0) * f).applyMatrix4(back.j.matrix).applyMatrix4(_hm), 0.05);
      }
    }
    for (let li = 0; li < 2; li++) {
      const L = this.legs[li], sd = li ? 1 : -1, th = L.hip.rotation.x, rz = L.hip.rotation.z, kn = L.knee.rotation.x;
      const sr = Math.sin(rz), cr = Math.cos(rz), ct = Math.cos(th), stt = Math.sin(th), ck = Math.cos(kn), sk = Math.sin(kn);
      const ux = sr, uy = -cr * ct, uz = -cr * stt;                   // hướng đùi (khung hông), như legPush
      const wx = ck * sr, wy = -ck * cr * ct + sk * stt, wz = -ck * cr * stt - sk * ct;   // hướng cẳng chân
      const hx = 0.12 * sd, hy = -0.02, kx = hx + ux * LEG.L1, ky = hy + uy * LEG.L1, kz = uz * LEG.L1;
      this.putObs(_b.set(hx + ux * 0.25, hy + uy * 0.25, uz * 0.25).applyMatrix4(_hm), 0.1);
      this.putObs(_b.set(kx, ky, kz).applyMatrix4(_hm), 0.1);
      this.putObs(_b.set(kx + wx * 0.2, ky + wy * 0.2, kz + wz * 0.2).applyMatrix4(_hm), 0.1);
      this.putObs(_b.set(kx + wx * LEG.L2, ky + wy * LEG.L2, kz + wz * LEG.L2).applyMatrix4(_hm), 0.1);
    }
  }

  // ---- cờ sau lưng (tướng) ------------------------------------------------------------------------
  // Vải gắn một mép dọc vào cán (models.js: bản lề flagCloth trên trục cán), lò xo xoay quanh trục cán: đứng thì chếch
  // sau-trái (flagRest), chạy thì gió đẩy về thẳng sau lưng, đi ngang, đổi hướng thì quật sang bên. Nằm (ngã ngửa) thì
  // cán nằm sát đất: vải xoay về nằm ngang cạnh người, cán nhấc lên một chút. Trước đây vải là tấm cứng cách cán 0,24 m
  // quay quanh tâm của nó (góc nhìn chéo thấy vải lơ lửng rời cán), nằm thì nửa lá cờ cắm xuống đất.
  updateFlag(dt, first, fresh) {
    const F = this.flag, P = this.rig.p, tm = P.torso.matrixWorld;
    _z.setFromMatrixColumn(tm, 2).normalize(); _x.setFromMatrixColumn(tm, 0).normalize(); _y.setFromMatrixColumn(tm, 1).normalize();
    _v.set(0, 1.0, 0).add(F.j.position).applyMatrix4(tm);
    if (fresh) F.tr.reset(_v); else F.tr.step(_v, dt);
    const vf = F.tr.v.dot(_z), vx = F.tr.v.dot(_x), af = F.tr.a.dot(_z), ax = F.tr.a.dot(_x), t = this.t;
    const lie = 1 - smooth(0.25, 0.7, _y.y);
    // hướng vải (khung cán) = (−sin θ, 0, −cos θ): θ lớn hơn = lệch sang trái. Gió ngược chiều đi: tiến → θ về 0,
    // sang phải (+x) → vải bạt sang trái. Gió nhẹ cho khỏi đứng im.
    let clothT = K.flagRest - clamp(0.11 * vf, -0.7, 0.62) + clamp(0.1 * vx + 0.012 * ax, -0.5, 0.5)
      + 0.07 * Math.sin(t * 1.3) + 0.04 * Math.sin(t * 2.9 + 1);
    if (lie > 0) {
      // góc làm vải nằm ngang: −sin θ·x.y − cos θ·z.y = 0 (hai nghiệm cách π, lấy nghiệm gần góc nghỉ)
      let flat = Math.atan2(-_z.y, _x.y);
      if (Math.abs(wrap(flat - K.flagRest)) > Math.PI / 2) flat = wrap(flat + Math.PI);
      clothT += (flat - clothT) * lie;
    }
    // cán cờ: rung theo gia tốc thân
    const poleX = clamp(-0.012 * af, -0.12, 0.12), poleZ = clamp(0.012 * ax, -0.1, 0.1);
    if (first) { F.st[0] = clothT; F.st[1] = 0; F.pole[0] = poleX; F.pole[2] = poleZ; F.pole[1] = F.pole[3] = 0; }
    else if (dt > 0) {
      IK.spring(F.st, 0, clothT, K.flagK, IK.damping(K.flagK, K.flagZ), dt);
      IK.spring(F.pole, 0, poleX, K.poleK, IK.damping(K.poleK, K.poleZ), dt);
      IK.spring(F.pole, 2, poleZ, K.poleK, IK.damping(K.poleK, K.poleZ), dt);
    }
    const sp = Math.min(1, Math.abs(vf) / 6);
    if (F.cloth) F.cloth.rotation.y = F.st[0] + 0.08 * sp * Math.sin(t * 14.7) * (1 - lie);
    F.j.rotation.x = F.pole[0] + 0.3 * lie; F.j.rotation.z = F.pole[2];
  }

  // ---- dây treo ----------------------------------------------------------------------------------
  // Các đốt dây là xương (Object3D con của root, models.js) của lưới da rig: đặt vị trí, hướng mỗi lượt theo điểm dây.
  updateRopes(dt, ground, first) {
    if (!this.ropes.length) return;
    const root = this.rig.root, s = this.s;
    _inv.copy(root.matrixWorld).invert();
    for (let ri = 0; ri < this.ropes.length; ri++) {
      const r = this.ropes[ri], sg = r.seg * s;
      _a.copy(r.a).applyMatrix4(r.j.matrixWorld);
      // sàn = mặt đất dưới dây nhưng không cao hơn neo: neo ở dưới đất (lưỡi đại đao bổ xuống, đầu lúc lộn né, sĩ quan
      // ngã chết) thì dây ở dưới đất cùng neo, khuất theo. Trước đây kẹp lên mặt đất: tua rời vũ khí nằm trên cỏ, xa neo
      // quá 4 lần dài dây thì IK.rope đặt lại (thả thẳng xuống dưới đất) rồi lượt sau lại kẹp lên — nhấp nháy.
      ROPE_OPT.damp = r.damp; ROPE_OPT.floor = Math.min(ground(_a.x, _a.z) + 0.02, _a.y); ROPE_OPT.reset = first;
      IK.rope(r.pts, r.n, _a.x, _a.y, _a.z, sg, dt, ROPE_OPT);
      if (r.col) this.ropeCollide(r, sg, ROPE_OPT.floor);
      // hướng khớp neo trong khung root (dải khăn dẹt giữ mặt theo đầu): tích quaternion cục bộ từ khớp lên root
      if (r.flat) { _q2.identity(); for (let o = r.j; o !== root; o = o.parent) _q2.premultiply(o.quaternion); }
      _b.copy(_a).applyMatrix4(_inv);
      for (let k = 0; k < r.n; k++) {
        const o = k * 6, m = r.segs[k];
        _v.set(r.pts[o], r.pts[o + 1], r.pts[o + 2]).applyMatrix4(_inv);
        _d.subVectors(_v, _b);
        const L = _d.length();
        if (L > 1e-6) _d.divideScalar(L); else _d.copy(DOWN);
        m.position.copy(_b);
        if (r.flat) {
          _f.copy(_d).applyQuaternion(_q.copy(_q2).invert());
          _q.setFromUnitVectors(DOWN, _f); m.quaternion.multiplyQuaternions(_q2, _q);
        } else m.quaternion.setFromUnitVectors(DOWN, _d);
        if (m.scale.x !== 1) m.scale.setScalar(1);                 // xương dây ẩn (scale 0) tới lượt cập nhật đầu
        _b.copy(_v);
      }
    }
  }

  // Dải khăn không xuyên đầu: cầu va chạm r.col = [x, y, z, bán kính] trong khung khớp neo (đơn vị rig). Đẩy điểm dây ra
  // mặt cầu, bỏ vận tốc hướng vào tâm (khỏi lượt sau lao vào lại rồi rung), kéo lại độ dài đốt tính từ neo; 3 lượt vì
  // kéo độ dài có thể kéo điểm vào lại trong cầu. Trước đây dây chỉ có sàn đất: chém nhanh, xoay, dừng chạy thì dải khăn
  // vắt qua nút buộc, lọt vào giữa đầu (22–51% khung các đòn). Dùng _a (neo, đã đặt ở updateRopes), _v.
  ropeCollide(r, sg, floor) {
    const c = r.col, pts = r.pts, R = c[3] * this.s;
    _v.set(c[0], c[1], c[2]).applyMatrix4(r.j.matrixWorld);
    for (let it = 0; it < 3; it++) {
      let px = _a.x, py = _a.y, pz = _a.z;
      for (let k = 0; k < r.n; k++) {
        const o = k * 6;
        let x = pts[o], y = pts[o + 1], z = pts[o + 2];
        const dx = x - _v.x, dy = y - _v.y, dz = z - _v.z, d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d < R && d > 1e-6) {
          const nx = dx / d, ny = dy / d, nz = dz / d;
          x = _v.x + nx * R; y = _v.y + ny * R; z = _v.z + nz * R;
          const vn = pts[o + 3] * nx + pts[o + 4] * ny + pts[o + 5] * nz;
          if (vn < 0) { pts[o + 3] -= vn * nx; pts[o + 4] -= vn * ny; pts[o + 5] -= vn * nz; }
        }
        const ex = x - px, ey = y - py, ez = z - pz, e = Math.sqrt(ex * ex + ey * ey + ez * ez);
        if (e > 1e-6) { const f = sg / e; x = px + ex * f; y = py + ey * f; z = pz + ez * f; }
        if (y < floor) y = floor;
        pts[o] = x; pts[o + 1] = y; pts[o + 2] = z;
        px = x; py = y; pz = z;
      }
    }
  }
}
