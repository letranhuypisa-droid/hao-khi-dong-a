// battle/anim.js — hoạt ảnh thủ tục cho rig (chưa có clip nướng; 21.4 S1.9 là việc của AN).
//
// Mỗi hàm trả về một "tư thế" (object góc). applyPose() đặt góc lên khớp, blendPose() trộn hai
// tư thế để chuyển clip mượt. Đòn dựng bằng khung khoá (key): mỗi khung là một tư thế đầy đủ tại
// một mốc u ∈ [0,1], giữa hai khung nội suy theo hàm nhịp của khung đích. Nhịp đòn chém: gồng
// (chậm, easeOut) → chém (rất nhanh) → theo đà (giữ) → hồi thế.
//
// Quy ước: vai xoay theo thứ tự YXZ — sh*x âm = giơ tay ra trước/lên, sh*y = quay cánh tay sang
// ngang (tay phải +y = ra phía +x), sh*z = dang ngang. el*x âm = gập khuỷu. hand*x dương = lật lưỡi
// đao theo trục cẳng tay (1,5 ≈ lưỡi nối dài cánh tay), âm = lưỡi ngửa ra sau. torsoY dương = vai
// phải lùi, vai trái tiến. hip*x âm = đưa chân ra trước; knee*x dương = gập gối. "Phải" = phía +x.

import * as C from "./clips.js";

const K = ["torsoX", "torsoY", "torsoZ", "shLx", "shLy", "shLz", "elLx", "handLx", "handLz",
  "shRx", "shRy", "shRz", "elRx", "handRx", "handRz",
  "hipLx", "hipLz", "hipRx", "hipRz", "kneeLx", "kneeRx", "hipsY", "hipsYaw", "rootX", "rootZ", "spin", "headX"];

export function zeroPose() { const p = {}; for (const k of K) p[k] = 0; return p; }

// spin, rootX là góc quay cả người: trộn theo đường ngắn nhất (mod 2π). Trước đây xoay xong N6 (1,25 vòng),
// C3 (3,5 vòng) hay lộn né (rootX 2π) rồi trộn về 0 thì người quay/lộn ngược lại đủ số vòng trong vài khung.
const TAU = Math.PI * 2;
const wrapPi = (x) => x - TAU * Math.round(x / TAU);
export function blendPose(a, b, t) {
  const p = {};
  for (const k of K) p[k] = (a[k] || 0) + ((b[k] || 0) - (a[k] || 0)) * t;
  const bs = b.spin || 0, br = b.rootX || 0;
  p.spin = bs - wrapPi(bs - (a.spin || 0)) * (1 - t);
  p.rootX = br - wrapPi(br - (a.rootX || 0)) * (1 - t);
  // kênh grip (0..1, tay trái nắm chuôi vũ khí hai tay — rig-motion.js): chỉ có khi một trong hai tư thế có (tư thế song
  // đao của H35 không có kênh này nên kết quả trộn giữ nguyên như cũ); thiếu thì coi là 0
  if (a.grip !== undefined || b.grip !== undefined) p.grip = (a.grip || 0) + ((b.grip || 0) - (a.grip || 0)) * t;
  // thẻ bảng lời giải tay đại kiếm (anim-wc01.js fitArms, thân GLB): tư thế đích mang thẻ (fk đòn, fu mốc) thì kết quả mang thẻ đó
  // và phần trộn fw — lời giải tay phải trộn đúng phần đó. Tư thế không thẻ (mọi lớp khác) không đổi gì.
  if (b.fk !== undefined) { p.fk = b.fk; p.fu = b.fu; p.fw = t; }
  return p;
}

// ---- trộn theo phép quay ----------------------------------------------------------------------------------------------------
// Khớp ba bậc (hông XYZ, thân XYZ, vai YXZ) có nhiều bộ ba góc Euler cho cùng một hướng: (a, b, c) và (a + π, π − b, c + π) với b là góc giữa, cộng bội
// 2π; gần khoá khớp bộ giải Euler của clip nhảy qua lại. Trộn từng góc giữa hai cách viết khác nhau của hai hướng gần nhau cho một hướng ở giữa SAI
// (đã đo: vai cuối clip đại kiếm cách thế thủ 3π, đoạn trộn về thế thủ quét tay qua nhiều vòng). blendPoseQ trộn các khớp này theo phép quay (slerp
// quaternion, đường ngắn nhất) rồi viết lại thành bộ ba góc gần bộ ba đích (t ≥ 0,5) hay nguồn (t < 0,5); kênh khác như blendPose. Dùng khi trộn kết
// quả từng khung (Hero / BigUnit.setPose) và đầu / cuối đòn dựng từ clip; khung khoá viết tay (keys) vẫn trộn góc như cũ.
const qMul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
const qAxis = (axis, ang) => { const s = Math.sin(ang / 2), q = [0, 0, 0, Math.cos(ang / 2)]; q[axis] = s; return q; };
// Euler "XYZ" (R = Rx·Ry·Rz) hay "YXZ" (R = Ry·Rx·Rz) như three → quaternion [x, y, z, w]
function qFromEuler(order, e0, e1, e2) {   // e0, e1, e2 = góc quanh trục thứ nhất, thứ hai, thứ ba của order
  return order === "XYZ" ? qMul(qMul(qAxis(0, e0), qAxis(1, e1)), qAxis(2, e2)) : qMul(qMul(qAxis(1, e0), qAxis(0, e1)), qAxis(2, e2));
}
function eulerFromQ(order, q) {            // trả [góc trục 1, góc giữa, góc trục 3] của order, nhánh chính
  const x = q[0], y = q[1], z = q[2], w = q[3];
  const m12 = 2 * (x * y - z * w), m13 = 2 * (x * z + y * w), m23 = 2 * (y * z - x * w), m11 = 1 - 2 * (y * y + z * z), m33 = 1 - 2 * (x * x + y * y);
  const m21 = 2 * (x * y + z * w), m22 = 1 - 2 * (x * x + z * z), m31 = 2 * (x * z - y * w), m32 = 2 * (y * z + x * w);
  if (order === "XYZ") {
    const c = Math.max(-1, Math.min(1, m13));
    return Math.abs(c) < 0.9999999 ? [Math.atan2(-m23, m33), Math.asin(c), Math.atan2(-m12, m11)] : [Math.atan2(m32, m22), Math.asin(c), 0];
  }
  const c = Math.max(-1, Math.min(1, -m23));            // YXZ: góc giữa là x, trả [y, x, z]
  return Math.abs(c) < 0.9999999 ? [Math.atan2(m13, m33), Math.asin(c), Math.atan2(m21, m22)] : [Math.atan2(-m31, m11), Math.asin(c), 0];
}
// Trộn một khớp: e = [góc 1, giữa, góc 3] của a và b (đúng order); trả bộ ba góc gần ref nhất (bộ chính / thay thế × bội 2π).
function slerpEuler(order, ea, eb, t, ref) {
  const qa = qFromEuler(order, ea[0], ea[1], ea[2]); let qb = qFromEuler(order, eb[0], eb[1], eb[2]);
  let d = qa[0] * qb[0] + qa[1] * qb[1] + qa[2] * qb[2] + qa[3] * qb[3];
  if (d < 0) { qb = qb.map((v) => -v); d = -d; }
  let q;
  if (d > 0.9995) q = qa.map((v, i) => v + (qb[i] - v) * t);
  else { const th = Math.acos(d), s = Math.sin(th), ka = Math.sin((1 - t) * th) / s, kb = Math.sin(t * th) / s; q = qa.map((v, i) => v * ka + qb[i] * kb); }
  const n = Math.hypot(q[0], q[1], q[2], q[3]) || 1; q = q.map((v) => v / n);
  const e = eulerFromQ(order, q), cands = [e, [e[0] + Math.PI, Math.PI - e[1], e[2] + Math.PI]];
  let best = null, bc = Infinity;
  for (const c of cands) {
    const r = [c[0] - TAU * Math.round((c[0] - ref[0]) / TAU), c[1] - TAU * Math.round((c[1] - ref[1]) / TAU), c[2] - TAU * Math.round((c[2] - ref[2]) / TAU)];
    const cost = Math.abs(r[0] - ref[0]) + Math.abs(r[1] - ref[1]) + Math.abs(r[2] - ref[2]);
    if (cost < bc) { bc = cost; best = r; }
  }
  return best;
}
export function blendPoseQ(a, b, t) {
  const p = blendPose(a, b, t);
  if (!(t > 0 && t < 1)) return p;
  const ref = t >= 0.5 ? b : a, g = (o, k) => o[k] || 0;
  // vai (YXZ: góc y, x, z): ghi ngược về kênh sh*x, sh*y, sh*z
  for (const s of ["L", "R"]) {
    const kx = "sh" + s + "x", ky = "sh" + s + "y", kz = "sh" + s + "z";
    const r = slerpEuler("YXZ", [g(a, ky), g(a, kx), g(a, kz)], [g(b, ky), g(b, kx), g(b, kz)], t, [g(ref, ky), g(ref, kx), g(ref, kz)]);
    p[ky] = r[0]; p[kx] = r[1]; p[kz] = r[2];
  }
  // thân (XYZ)
  let r = slerpEuler("XYZ", [g(a, "torsoX"), g(a, "torsoY"), g(a, "torsoZ")], [g(b, "torsoX"), g(b, "torsoY"), g(b, "torsoZ")], t, [g(ref, "torsoX"), g(ref, "torsoY"), g(ref, "torsoZ")]);
  p.torsoX = r[0]; p.torsoY = r[1]; p.torsoZ = r[2];
  // hông (XYZ với góc giữa = spin + hipsYaw); spin giữ như blendPose (đã quấn theo đường ngắn)
  const ya = g(a, "spin") + g(a, "hipsYaw"), yb = g(b, "spin") + g(b, "hipsYaw"), yr = g(ref, "spin") + g(ref, "hipsYaw");
  r = slerpEuler("XYZ", [g(a, "rootX"), ya, g(a, "rootZ")], [g(b, "rootX"), yb, g(b, "rootZ")], t, [g(ref, "rootX"), yr, g(ref, "rootZ")]);
  p.rootX = r[0]; p.rootZ = r[2]; p.hipsYaw = r[1] - p.spin;
  return p;
}

export function applyPose(rig, p) {
  const j = rig.p;
  j.torso.rotation.set(p.torsoX, p.torsoY, p.torsoZ);
  j.shL.rotation.set(p.shLx, p.shLy, p.shLz); j.elL.rotation.x = p.elLx;
  j.shR.rotation.set(p.shRx, p.shRy, p.shRz); j.elR.rotation.x = p.elRx;
  j.handL.rotation.set(p.handLx, 0, p.handLz); j.handR.rotation.set(p.handRx, 0, p.handRz);
  j.hipL.rotation.set(p.hipLx, 0, p.hipLz); j.hipR.rotation.set(p.hipRx, 0, p.hipRz);
  j.kneeL.rotation.x = p.kneeLx; j.kneeR.rotation.x = p.kneeRx;
  j.hips.position.y = 0.92 + p.hipsY; j.hips.rotation.set(p.rootX, p.spin + p.hipsYaw, p.rootZ);
  j.head.rotation.x = p.headX;
}

// ---- nhịp ------------------------------------------------------------------------------------
export const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
export const EASE = {
  lin: (t) => t,
  io: (t) => t * t * (3 - 2 * t),
  out: (t) => 1 - (1 - t) * (1 - t),
  out3: (t) => 1 - (1 - t) ** 3,
  in: (t) => t * t,
  snap: (t) => 1 - (1 - t) ** 4,            // chém: gần như tức thì rồi hãm lại
};
export const seg = (u, a, b) => clamp01((u - a) / (b - a));

// Các hàm dựng dưới đây xuất ra cho bộ đòn lớp khác (anim-wc01.js) dùng chung; hành vi không đổi.
// Dựng tư thế đầy đủ từ phần khác 0.
export function P(o) { const p = zeroPose(); for (const k in o) p[k] = o[k]; return p; }
// Trộn dãy khung khoá [[u, tư thế, nhịp]] tại u.
export function keys(u, ks) {
  if (u <= ks[0][0]) return { ...ks[0][1] };
  for (let i = 1; i < ks.length; i++) {
    const [u1, p1, e = "io"] = ks[i];
    if (u <= u1) { const [u0, p0] = ks[i - 1]; return blendPose(p0, p1, EASE[e](seg(u, u0, u1))); }
  }
  return { ...ks[ks.length - 1][1] };
}
// Cộng thêm (dùng cho thở, xoay tròn chồng lên khung khoá).
export function add(p, o) { for (const k in o) p[k] += o[k]; return p; }
// Lật trái ↔ phải (đòn tay trái dùng lại khung của tay phải).
export function mirror(p) {
  const q = { ...p };
  for (const [a, b] of [["shLx", "shRx"], ["elLx", "elRx"], ["handLx", "handRx"], ["hipLx", "hipRx"], ["kneeLx", "kneeRx"]]) { q[a] = p[b]; q[b] = p[a]; }
  q.shLy = -p.shRy; q.shRy = -p.shLy; q.shLz = -p.shRz; q.shRz = -p.shLz; q.handLz = -p.handRz; q.handRz = -p.handLz;
  q.hipLz = -p.hipRz; q.hipRz = -p.hipLz;
  q.torsoY = -p.torsoY; q.torsoZ = -p.torsoZ; q.hipsYaw = -p.hipsYaw; q.rootZ = -p.rootZ; q.spin = -p.spin;
  return q;
}

// ---- thế thủ, chạy -----------------------------------------------------------------------------
// Song đao: đao phải chếch lên trước, đao trái cầm thấp chĩa xuống; chân trụ lệch, gối chùng.
export const GUARD = P({
  torsoX: 0.1, torsoY: 0.18, hipsYaw: -0.18, hipsY: -0.08,
  shRx: -0.45, shRy: 0.15, shRz: 0.12, elRx: -1.05, handRx: 0.55,
  shLx: 0.05, shLy: -0.1, shLz: -0.28, elLx: -0.75, handLx: 0.95,
  hipLx: -0.38, hipLz: -0.06, kneeLx: 0.42, hipRx: 0.28, hipRz: 0.08, kneeRx: 0.3, headX: -0.05,
});
const RELAX = P({
  torsoX: 0.04, shRx: -0.1, shRz: 0.12, elRx: -0.35, handRx: 0.3, shLx: -0.05, shLz: -0.12, elLx: -0.3, handLx: 0.3,
  hipLx: -0.1, kneeLx: 0.12, hipRx: 0.08, kneeRx: 0.08, hipsY: -0.02,
});

// base: thế đứng của lớp vũ khí khác (anim-wc01.js); bỏ trống = song đao như cũ.
export function idle(t, guard = true, base = null) {
  const b = Math.sin(t * 2.1) * 0.025, s = Math.sin(t * 0.9) * 0.04;
  const p = add({ ...(base || (guard ? GUARD : RELAX)) }, { torsoX: b, hipsY: b * 0.8, shRx: -b, shLx: b, torsoY: s, hipsYaw: -s * 0.5 });
  if (C.clipsReady() && C.has("idle")) C.addDeltaT("idle", t, p, C.LOWER);   // dáng đứng giữ thế thủ của lớp; clip thêm dồn trọng lượng, thở
  return p;
}

// Nhịp chạy khớp tốc độ để bàn chân trụ không trượt: sp (m/s), scale = cỡ rig. Nhịp bước (bước/giây) tăng
// theo tốc độ, giảm theo cỡ người (tướng to bước chậm, ∝ 1/√cỡ như con lắc); biên độ đùi chọn sao cho lúc giữa
// bước trụ bàn chân lùi so với hông nhanh ≈ 1,1 × tốc độ thân (chân hông → đế dài 0,927 × cỡ rig; 1,1 bù phần
// setPose() trộn làm nhỏ biên độ). Trả về { rate: rad/s cho runPhase (2 bước mỗi 2π), stride: biên độ đùi cho
// run() }. Nhịp: H35 hết cần (6,75 m/s) ≈ 2,9 bước/s, đùi ±0,8 rad (trước đây 2,5 bước/s, đùi ±0,93: sải quá dài,
// trông như nhảy vọt); sĩ quan 4,2 m/s ≈ 2,4; Toa Đô ≈ 2,1. Đo (kịch bản): trượt chân trụ ≈ 8% tốc độ thân khi
// chạy hết cần, 11% khi cần 0,3 hay sĩ quan về chỗ.
// Có clip chạy bộ (clips.js): rate là nhịp pha khớp tốc độ chân trụ của clip, và stride mang tốc độ rig v = sp / scale (đơn vị rig / s)
// cho run() chọn / trộn walk – jog; không có clip thì như cũ (stride = biên độ đùi).
// Clip chạy chỉ dùng từ tốc độ rig RUN_CLIP_MIN (m/s ÷ cỡ rig) trở lên: giữa đi bộ (1,06) và chạy nhẹ (5,0) không có clip nào hợp — trộn hai clip khác nhịp thì
// chân trượt 31–39% trên đất (đo 1,5–2 m/s), jog chậm lại thì thành chạy "quay chậm" 1,3 bước/s; bản thủ tục bám đất ở mọi tốc độ (9–15%). stride ≥ RUN_CLIP_MIN
// trong run() nghĩa là chế độ clip (stride mang tốc độ rig); bản thủ tục luôn < 1,05.
export const RUN_CLIP_MIN = 3.6;
const GAIT = { rate: 0, stride: 0 };
export function gait(sp, scale = 1, out = GAIT) {
  if (C.clipsReady() && C.has("jog") && sp / scale >= RUN_CLIP_MIN) { const v = sp / scale; out.rate = C.locoRate(v); out.stride = v; return out; }
  const steps = (RUN.cad0 + RUN.cad1 * sp) / Math.sqrt(scale);
  out.rate = steps * Math.PI;
  out.stride = Math.min(1.05, 1.1 * sp / (out.rate * 0.927 * scale));
  return out;
}

// Chạy: speed01 = độ gắng sức (nghiêng người, vung tay, nhấc gối), stride = biên độ đùi (từ gait()). Mỗi chân một
// pha ψ (phải: phase, trái: phase + π); trụ khi cos ψ > 0 (đùi quét từ trước ra sau theo sin: đúng tốc độ lúc
// giữa bước), đưa khi cos ψ < 0. Cho dáng chạy dứt khoát (ĐỀ XUẤT BẢN THỬ, RUN):
//   · gối gập trong một cửa sổ rộng hơn pha đưa: bắt đầu sớm lead (chân sau co gót ngay khi rời đất, không duỗi
//     thẳng thành thế xoạc chân giữa không trung), kết thúc muộn tail (cẳng chân chỉ duỗi ra ngay trước khi đáp);
//   · đưa gối (drive): nửa sau pha đưa đùi nâng cao thêm trong lúc gối còn gập.
// Hông thấp nhất lúc giữa bước trụ, nhún lên lúc đổi chân (bob). Không hạ hông thêm (h0 < 0): chạy chậm thì bàn
// chân đưa sượt đất, IK ép xuống, lê theo người (đo: trượt 40–60% ở cần 0,3).
export const RUN = { cad0: 1.6, cad1: 0.215, h0: 0.02, bob: 0.05, knee: 1.5, kmin: 0.75,
  lead: 0.6, tail: 0.75, rise: 0.3, fall: 0.62, drive: 0.4 };
const _rl = [0, 0];
const sstep = (e0, e1, x) => { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
function runLeg(psi, stride, kl, drive, out = _rl) {
  const R = RUN, sn = Math.sin(psi), cs = Math.cos(psi);
  const sw = cs < 0 ? cs * cs * (1 - sn) * 0.843 : 0;                      // 0..1, đỉnh ở sin ψ = −1/3 (cuối pha đưa)
  // cửa sổ gập gối: từ ψ = π/2 − lead (chân sau vừa rời đất) tới ψ = 3π/2 + tail (ngay trước khi đáp)
  const a0 = Math.PI / 2 - R.lead, w = psi - a0 - TAU * Math.floor((psi - a0) / TAU), v = w / (Math.PI + R.lead + R.tail);
  out[0] = stride * sn - 0.1 - drive * sw;
  out[1] = 0.15 + (v < 1 ? kl * sstep(0, R.rise, v) * (1 - sstep(R.fall, 1, v)) : 0);
  return out;
}
// arms(p, phase, a): lớp vũ khí khác đặt lại tư thế tay (vd đại kiếm vác vai, anim-wc01.js); bỏ trống = ôm song đao như cũ.
export function run(phase, speed01 = 1, stride = 0.95 * speed01, arms = null) {
  const clip = C.clipsReady() && C.has("jog") && stride >= RUN_CLIP_MIN;
  // clip: khung 0 = chân R chạm đất phía trước; tay vẫn vung theo pha thủ tục (chân R ra trước nhất ở sin = −1), lệch ¼ vòng
  const ph = clip ? phase - Math.PI / 2 : phase;
  const s = Math.sin(ph), c = Math.cos(ph), a = speed01, R = RUN;
  const p = zeroPose();
  p.torsoX = 0.32 * a; p.torsoY = -0.16 * a * s; p.hipsYaw = 0.18 * a * s; p.headX = -0.2 * a;
  p.hipsY = R.h0 + R.bob * a * (1 - c * c);
  if (!clip) {
    const kl = R.knee * Math.max(a, R.kmin), dr = R.drive * a;           // chạy chậm vẫn nhấc gối đủ để chân đưa không lê đất
    runLeg(ph, stride, kl, dr); p.hipRx = _rl[0]; p.kneeRx = _rl[1];
    runLeg(ph + Math.PI, stride, kl, dr); p.hipLx = _rl[0]; p.kneeLx = _rl[1];
  }
  // chạy ôm đao: hai tay ngả ra sau, lưỡi đao kéo theo sau lưng
  // Tay vung ĐỐI BÊN với chân (chân phải ra trước thì tay phải đưa ra sau, vai phải lùi theo torsoY = −0,16·s): trước đây dấu ngược — tay cùng bên chân và
  // ngược chiều vai (đo: tương quan tay phải ↔ chân phải +0,94, tay ↔ vai −1,00) nên người lắc lư kiểu lê bước như thây ma.
  p.shRx = 0.35 * a - 0.55 * a * s; p.shRz = 0.3; p.elRx = -0.55; p.handRx = 1.25;
  p.shLx = 0.35 * a + 0.55 * a * s; p.shLz = -0.3; p.elLx = -0.55; p.handLx = 1.25;
  if (arms) arms(p, ph, a);
  if (clip) { C.locoPose(phase, stride, p, C.LOWER); tameRun(p, stride); }   // hông, thân, đầu, hai chân từ clip; tay giữ tư thế mang vũ khí của lớp
  return p;
}

// Clip chạy là dáng vận động viên: thân ngả 28° (chạy nhẹ; clip nước rút 38° đã bỏ) và vặn vai ±42° / ±32° — quá đà với tướng mang giáp và cờ lưng
// (nhìn từ sau, cờ và hai đao văng ngang; từ cạnh trông như sắp ngã chúi). RUN_STYLE: độ ngả ngực mong muốn (rad) theo tốc độ rig v, hệ số giữ lại
// của vặn thân (torsoY), lắc hông / thân (rootZ, torsoZ), pelvis: hông quay ngược chiều vai bằng chừng này lần góc vai. Giảm độ ngả bằng cách hạ rootX d rad và cộng d vào góc đùi hipLx, hipRx: đùi giữ đúng
// hướng trong không gian (bước chân, IK chân không đổi), chỉ thân trên dựng lên; đầu được bù một phần để mắt vẫn nhìn ngang.
export const RUN_STYLE = { lean: [[3.6, 0.18], [5.0, 0.2], [6.5, 0.26]], twist: 0.3, sway: 0.6, head: 0.6, pelvis: 0.4 };
function tameRun(p, v) {
  const L = RUN_STYLE.lean;
  let want = v <= L[0][0] ? L[0][1] : L[L.length - 1][1];
  for (let i = 1; i < L.length; i++) if (v > L[i - 1][0] && v <= L[i][0]) want = L[i - 1][1] + ((v - L[i - 1][0]) / (L[i][0] - L[i - 1][0])) * (L[i][1] - L[i - 1][1]);
  const d = p.rootX + p.torsoX - want;
  if (d > 0) { p.rootX -= d; p.hipLx += d; p.hipRx += d; p.headX += d * RUN_STYLE.head; }
  p.torsoY *= RUN_STYLE.twist; p.torsoZ *= RUN_STYLE.sway; p.rootZ *= RUN_STYLE.sway;
  p.hipsYaw -= RUN_STYLE.pelvis * p.torsoY;        // hông quay ngược chiều vai (clip gốc: hông gần đứng yên ±1°, vai vặn ±14° — thân trên vặn như cái cột)
}

// Vũ khí cán dài (giáo, đại đao) khi chạy: tay phải dựng cán đứng, hơi ngả sau, thay cho thế "ôm đao" của run()
// (cán dài 2–3 m kéo lê sau lưng thì lưỡi, đuôi cán cắm xuống đất và tua treo lê trên đất).
export function carryLong(p, phase = 0, a = 1) {
  p.shRx = -0.3 + 0.12 * a * Math.sin(phase); p.shRy = 0; p.shRz = 0.3; p.elRx = -1.2; p.handRx = -0.3; p.handRz = 0;
  return p;
}

// ---- đòn chém ---------------------------------------------------------------------------------
// Chém ngang tay phải: gồng xoắn người sang phải, vung lưỡi quét ngang sang trái, bước chân trái tới.
const SLASH_H = [
  [0, GUARD],
  [0.3, P({ torsoX: 0.05, torsoY: 0.75, hipsYaw: 0.2, hipsY: -0.1, shRx: -1.25, shRy: 1.25, shRz: 0.2, elRx: -0.75, handRx: 1.1,
    shLx: -0.9, shLy: -0.5, elLx: -1.0, handLx: 0.6, hipLx: -0.2, kneeLx: 0.3, hipRx: 0.3, kneeRx: 0.3, headX: -0.05 }), "out"],
  [0.42, P({ torsoX: 0.22, torsoY: -0.85, hipsYaw: -0.35, hipsY: -0.18, shRx: -1.45, shRy: -1.05, shRz: 0.1, elRx: -0.05, handRx: 1.45,
    shLx: 0.35, shLy: 0.2, shLz: -0.4, elLx: -0.5, handLx: 1.1, hipLx: -0.75, kneeLx: 0.65, hipRx: 0.45, kneeRx: 0.25, headX: 0.05 }), "snap"],
  [0.62, P({ torsoX: 0.24, torsoY: -1.0, hipsYaw: -0.4, hipsY: -0.19, shRx: -1.3, shRy: -1.3, shRz: 0.05, elRx: -0.15, handRx: 1.4,
    shLx: 0.4, shLy: 0.2, shLz: -0.45, elLx: -0.5, handLx: 1.1, hipLx: -0.78, kneeLx: 0.68, hipRx: 0.46, kneeRx: 0.26 }), "out"],
  [1, GUARD, "io"],
];
// Chém xéo từ dưới hất lên (tay phải).
const SLASH_UP = [
  [0, GUARD],
  [0.28, P({ torsoX: 0.4, torsoY: -0.55, hipsYaw: -0.2, hipsY: -0.26, shRx: -0.25, shRy: -0.9, shRz: -0.2, elRx: -0.3, handRx: 1.3,
    shLx: -0.8, elLx: -1.1, handLx: 0.7, hipLx: -0.5, kneeLx: 0.8, hipRx: 0.35, kneeRx: 0.6 }), "out"],
  [0.4, P({ torsoX: -0.18, torsoY: 0.55, hipsYaw: 0.25, hipsY: -0.02, shRx: -2.55, shRy: 0.7, shRz: 0.25, elRx: -0.1, handRx: 1.35,
    shLx: 0.3, shLz: -0.5, elLx: -0.5, handLx: 1.0, hipLx: -0.6, kneeLx: 0.3, hipRx: 0.2, kneeRx: 0.1, headX: -0.2 }), "snap"],
  [0.6, P({ torsoX: -0.2, torsoY: 0.65, hipsYaw: 0.28, hipsY: -0.03, shRx: -2.7, shRy: 0.85, shRz: 0.3, elRx: -0.15, handRx: 1.3,
    shLx: 0.35, shLz: -0.5, elLx: -0.5, handLx: 1.0, hipLx: -0.62, kneeLx: 0.3, hipRx: 0.22, kneeRx: 0.1, headX: -0.2 }), "out"],
  [1, GUARD, "io"],
];
// Bổ chéo từ trên xuống (tay phải).
const SLASH_DOWN = [
  [0, GUARD],
  [0.3, P({ torsoX: -0.2, torsoY: 0.5, hipsYaw: 0.1, hipsY: -0.04, shRx: -2.85, shRy: 0.45, shRz: 0.15, elRx: -0.7, handRx: 0.35,
    shLx: -0.8, shLy: -0.4, elLx: -1.0, handLx: 0.7, hipLx: -0.2, kneeLx: 0.2, hipRx: 0.2, kneeRx: 0.2, headX: -0.15 }), "out"],
  [0.42, P({ torsoX: 0.45, torsoY: -0.6, hipsYaw: -0.3, hipsY: -0.24, shRx: -0.55, shRy: -0.75, shRz: -0.1, elRx: -0.05, handRx: 1.3,
    shLx: 0.4, shLz: -0.4, elLx: -0.5, handLx: 1.1, hipLx: -0.8, kneeLx: 0.8, hipRx: 0.5, kneeRx: 0.35, headX: 0.1 }), "snap"],
  [0.62, P({ torsoX: 0.5, torsoY: -0.7, hipsYaw: -0.32, hipsY: -0.25, shRx: -0.4, shRy: -0.85, shRz: -0.12, elRx: -0.1, handRx: 1.3,
    shLx: 0.45, shLz: -0.42, elLx: -0.5, handLx: 1.1, hipLx: -0.82, kneeLx: 0.82, hipRx: 0.5, kneeRx: 0.35 }), "out"],
  [1, GUARD, "io"],
];
const SLASHES = [SLASH_H, SLASH_UP, SLASH_DOWN];

// Chém: side = 1 tay phải, −1 tay trái. high 0 = ngang, 0,6 = hất lên, 1 = bổ xuống. u = 0..1. legs = false: đòn tay
// trái mà chân, hông xoay giữ như đòn tay phải (Tuyệt Kỹ nối chém ↔ xoay: thế thủ gốc lệch chân nên bản lật đầu, cuối
// nhát chém đổi chân trong một khung).
const LEG_KEYS = ["hipLx", "hipLz", "hipRx", "hipRz", "kneeLx", "kneeRx", "hipsYaw"];
export function slash(u, side = 1, high = 0, legs = true) {
  const ks = SLASHES[high >= 0.9 ? 2 : high >= 0.45 ? 1 : 0];
  const p = keys(u, ks);
  if (side > 0) return p;
  const q = mirror(p);
  if (!legs) for (const k of LEG_KEYS) q[k] = p[k];
  return q;
}

// Chém kéo hai tay (N5): dang cả hai lưỡi ra sau rồi quét chéo nhau trước ngực.
export function scissor(u) {
  return keys(u, [
    [0, GUARD],
    [0.32, P({ torsoX: -0.12, hipsY: -0.08, shRx: -1.3, shRy: 1.35, elRx: -0.5, handRx: 1.2, shLx: -1.3, shLy: -1.35, elLx: -0.5, handLx: 1.2,
      hipLx: -0.2, kneeLx: 0.25, hipRx: 0.25, kneeRx: 0.25, headX: -0.1 }), "out"],
    [0.45, P({ torsoX: 0.3, hipsY: -0.2, shRx: -1.45, shRy: -0.8, elRx: -0.05, handRx: 1.45, shLx: -1.35, shLy: 0.8, elLx: -0.05, handLx: 1.45,
      hipLx: -0.8, kneeLx: 0.7, hipRx: 0.45, kneeRx: 0.3 }), "snap"],
    [0.65, P({ torsoX: 0.32, hipsY: -0.21, shRx: -1.35, shRy: -1.0, elRx: -0.1, handRx: 1.4, shLx: -1.25, shLy: 1.0, elLx: -0.1, handLx: 1.4,
      hipLx: -0.82, kneeLx: 0.72, hipRx: 0.46, kneeRx: 0.3 }), "out"],
    [1, GUARD, "io"],
  ]);
}

// Hai đao cùng bổ (C1, C4, Đòn Quyết): nhún, bật lên, giơ cao qua đầu, bổ xuống, khuỵu gối tiếp đất. Lúc bổ tay dừng
// gần ngang, mũi hai lưỡi chạm đất ≈ 1,7 m trước mặt (chỗ tung bụi); rig-motion.js gập cổ tay cho mũi dừng ở mặt đất.
// Trước đây tay chúc xuống (shRx −0,35), lưỡi nối dài cánh tay: 0,85 m trong 0,97 m lưỡi cắm xuống đất.
export function doubleChop(u) {
  return keys(u, [
    [0, GUARD],
    [0.18, P({ torsoX: 0.45, hipsY: -0.32, shRx: 0.5, shLx: 0.5, shRz: 0.3, shLz: -0.3, elRx: -0.3, elLx: -0.3, handRx: 0.85, handLx: 0.85,
      hipLx: -0.7, kneeLx: 1.1, hipRx: -0.4, kneeRx: 1.0 }), "out"],
    [0.4, P({ torsoX: -0.4, hipsY: 0.28, shRx: -3.0, shLx: -3.0, shRz: 0.25, shLz: -0.25, elRx: -0.55, elLx: -0.55, handRx: 0.2, handLx: 0.2,
      hipLx: -0.9, kneeLx: 1.3, hipRx: 0.2, kneeRx: 0.9, headX: -0.3 }), "out"],
    [0.52, P({ torsoX: 0.8, hipsY: -0.42, shRx: -1.0, shLx: -1.0, shRz: 0.12, shLz: -0.12, elRx: -0.05, elLx: -0.05, handRx: 1.0, handLx: 1.0,
      hipLx: -1.1, kneeLx: 1.3, hipRx: 0.55, kneeRx: 1.1, headX: 0.25 }), "snap"],
    [0.72, P({ torsoX: 0.78, hipsY: -0.42, shRx: -0.95, shLx: -0.95, shRz: 0.14, shLz: -0.14, elRx: -0.1, elLx: -0.1, handRx: 1.0, handLx: 1.0,
      hipLx: -1.1, kneeLx: 1.3, hipRx: 0.55, kneeRx: 1.1, headX: 0.2 }), "out"],
    [1, GUARD, "io"],
  ]);
}

// Xoay tròn: n vòng, hai lưỡi dang ngang nối dài cánh tay; nhún lên giữa vòng xoay.
export function spin(u, turns = 1) {
  const s = EASE.io(seg(u, 0.12, 0.85)), inn = seg(u, 0, 0.12), out = seg(u, 0.85, 1);
  const w = Math.min(inn, 1 - out);
  const spread = P({ torsoX: 0.28, hipsY: -0.22, shRx: -1.3, shRy: 1.05, shRz: 0.15, elRx: -0.05, handRx: 1.45,
    shLx: -1.3, shLy: -1.05, shLz: -0.15, elLx: -0.05, handLx: 1.45, hipLx: -0.5, kneeLx: 0.6, hipRx: 0.3, kneeRx: 0.55, headX: 0.05 });
  const p = blendPose(GUARD, spread, EASE.out(w));
  p.spin = -s * turns * Math.PI * 2;
  p.hipsY += Math.sin(s * Math.PI) * 0.12 * Math.min(1, turns);
  p.torsoZ = Math.sin(s * Math.PI * 2 * turns) * 0.08;
  return p;
}

// Hất tung (C2): hạ thấp người, lưỡi kéo lê sau, rồi bật cả người lên, hai lưỡi hất lên trời.
export function uppercut(u) {
  return keys(u, [
    [0, GUARD],
    [0.28, P({ torsoX: 0.6, hipsY: -0.42, shRx: 0.8, shLx: 0.8, shRz: 0.35, shLz: -0.35, elRx: -0.2, elLx: -0.2, handRx: 1.4, handLx: 1.4,
      hipLx: -0.95, kneeLx: 1.4, hipRx: 0.2, kneeRx: 1.2, headX: 0.2 }), "out"],
    [0.42, P({ torsoX: -0.35, hipsY: 0.32, shRx: -3.0, shLx: -3.0, shRz: 0.35, shLz: -0.35, elRx: -0.1, elLx: -0.1, handRx: 1.35, handLx: 1.35,
      hipLx: -0.3, kneeLx: 0.2, hipRx: 0.4, kneeRx: 0.9, headX: -0.35 }), "snap"],
    [0.62, P({ torsoX: -0.3, hipsY: 0.24, shRx: -2.9, shLx: -2.9, shRz: 0.4, shLz: -0.4, elRx: -0.15, elLx: -0.15, handRx: 1.3, handLx: 1.3,
      hipLx: -0.35, kneeLx: 0.3, hipRx: 0.35, kneeRx: 0.8, headX: -0.3 }), "out"],
    [1, GUARD, "io"],
  ]);
}

// Lao tới (lướt, C5, Phá Trận): đổ người ra trước, hai lưỡi kéo ngược sau lưng, rồi vung chéo qua trước.
export function dash(u) {
  return keys(u, [
    [0, GUARD],
    [0.18, P({ torsoX: 0.7, hipsY: -0.3, shRx: 1.0, shLx: 1.0, shRz: 0.45, shLz: -0.45, elRx: -0.2, elLx: -0.2, handRx: 1.4, handLx: 1.4,
      hipLx: -1.0, kneeLx: 0.9, hipRx: 0.7, kneeRx: 0.7, headX: -0.3 }), "out"],
    [0.5, P({ torsoX: 0.72, hipsY: -0.3, shRx: 1.1, shLx: 1.1, shRz: 0.5, shLz: -0.5, elRx: -0.15, elLx: -0.15, handRx: 1.45, handLx: 1.45,
      hipLx: -1.05, kneeLx: 0.85, hipRx: 0.75, kneeRx: 0.75, headX: -0.35 }), "lin"],
    [0.62, P({ torsoX: 0.4, hipsY: -0.28, shRx: -1.4, shLx: -1.4, shRy: -0.9, shLy: 0.9, elRx: -0.05, elLx: -0.05, handRx: 1.45, handLx: 1.45,
      hipLx: -0.9, kneeLx: 0.8, hipRx: 0.5, kneeRx: 0.4 }), "snap"],
    [1, GUARD, "io"],
  ]);
}

// Đỡ: bắt chéo hai lưỡi trước mặt, hạ trọng tâm. Trả về hằng dùng chung (đã đóng băng: blendPose chỉ đọc).
export const BLOCK = Object.freeze(P({
  torsoX: 0.18, hipsY: -0.2, shRx: -1.15, shRy: -0.35, shRz: 0.1, elRx: -1.25, handRx: 0.1, handRz: 0.5,
  shLx: -1.15, shLy: 0.35, shLz: -0.1, elLx: -1.25, handLx: 0.1, handLz: -0.5,
  hipLx: -0.4, kneeLx: 0.55, hipRx: 0.3, kneeRx: 0.45, hipLz: -0.08, hipRz: 0.08, headX: 0.05,
}));
export function block() { return BLOCK; }

// Trúng đòn: giật ngửa người, tay văng, lùi nửa bước. base: thế thủ của lớp khác, react: tư thế giật của lớp khác (bỏ trống
// = song đao như cũ).
export const HIT = P({ torsoX: -0.5, torsoY: 0.25, headX: -0.4, hipsY: -0.12, shRx: 0.4, shRz: 0.6, elRx: -0.6, handRx: 0.5,
  shLx: 0.4, shLz: -0.6, elLx: -0.6, handLx: 0.5, hipLx: 0.3, kneeLx: 0.3, hipRx: -0.2, kneeRx: 0.5, rootX: -0.1 });
const HIT_GAIN = 2.2;            // clip Hit_Chest chỉ giật ~8°: khuếch đại cho đòn trúng đọc được trong giao tranh
export function hitReact(u, base = GUARD, react = HIT) {
  if (C.clipsReady() && C.has("hitChest")) {
    // thế thủ của lớp + phần LỆCH của clip giật người (so với tư thế đứng cuối clip; cả thân, chân, tay), vào nhanh, về thế thủ chậm hơn
    const w = Math.max(0, Math.min(1, u / 0.12, (1 - u) / 0.3)) * HIT_GAIN, q = C.sampleU("hitChest", u, {}, C.FULL), n = C.sampleU("hitChest", 1, {}, C.FULL);
    const p = { ...base };
    for (const k in q) p[k] += (q[k] - n[k]) * w;
    return p;
  }
  const k = Math.sin(clamp01(u) * Math.PI) ** 0.7;
  return blendPose(base, react, k);
}

// Né: lộn một vòng về trước, co tròn người. Khớp hông là tâm quay (rootX) nên lúc lộn ngược nâng hông lên (sin² theo
// góc lộn) cho cả khối người lăn quanh bụng, không quanh hông; giữa vòng lộn lật cổ tay cho hai lưỡi nằm dọc cẳng tay
// (cầm ngược) thay vì chĩa ra xa. Trước đây lúc chúc ngược đầu cắm xuống đất 0,55 m, tay 0,36 m, mũi đao 1,5 m.
export function dodgeRoll(u) {
  const r = EASE.io(seg(u, 0.05, 0.9)), k = Math.sin(clamp01(u) * Math.PI), inv = Math.sin(r * Math.PI) ** 2;
  const p = P({ torsoX: 0.9 * k, headX: 0.5 * k, hipsY: -0.52 * k + 0.65 * inv, shRx: -1.2 * k, shLx: -1.2 * k, elRx: -1.4 * k, elLx: -1.4 * k,
    handRx: 1.4 - 2.2 * k, handLx: 1.4 - 2.2 * k, hipLx: -1.5 * k, hipRx: -1.3 * k, kneeLx: 2.0 * k, kneeRx: 1.9 * k });
  p.rootX = r * Math.PI * 2;
  if (C.clipsReady() && C.has("roll")) Object.assign(p, C.sampleU("roll", u, {}, C.FULL));   // lăn từ clip; cổ tay giữ lật lưỡi như trên
  return p;
}

// Ngã ngửa rồi nằm. Chân phải nhấc theo độ ngã (hipRx −0,3·k) cho nằm dọc mặt đất (trước đây 0,1 cố định: nằm thì
// chân chếch cắm xuống đất 0,2 m).
const KNOCK_RATE = 2.2;                  // clip ngã chạy nhanh chừng này lần: ngã xong trong ~0,5 s như kiểu thủ tục
export function knockdown(u) {
  const k = EASE.out(clamp01(u * 2.2));
  const proc = knockdownProc(k);
  if (C.clipsReady() && C.has("death")) Object.assign(proc, C.sampleT("death", u * KNOCK_RATE, {}, C.FULL));
  return proc;
}
// Hero bị đánh ngã (state "down", tổng total giây, đã qua el giây): ngã bật lùi bằng clip knockback (KNOCKBACK_RATE lần nhanh), nằm, rồi GETUP_SEC
// giây cuối đứng dậy bằng clip getUp (nén lại cho vừa). Hai clip nối khít ở tư thế nằm ngửa. null = không có clip, nơi gọi dùng cách cũ.
const KNOCKBACK_RATE = 1.6, GETUP_SEC = 0.55;
export function downPose(el, total) {
  if (!(C.clipsReady() && C.has("knockback") && C.has("getUp") && total > 0 && Number.isFinite(el))) return null;
  const up = Math.min(GETUP_SEC, total * 0.5), tUp = total - up, p = zeroPose();
  if (el < tUp) C.sampleT("knockback", el * KNOCKBACK_RATE, p, C.FULL);
  else C.sampleT("getUp", ((el - tUp) / up) * C.clipDur("getUp"), p, C.FULL);
  p.handRx = p.handLx = 0.6; p.grip = 0;
  return p;
}
function knockdownProc(k) {
  return P({ rootX: -1.45 * k, hipsY: -0.72 * k, torsoX: -0.1 * k, headX: -0.2 * k, shRx: -2.6 * k, shLx: -2.2 * k, shRz: 0.5 * k, shLz: -0.7 * k,
    elRx: -0.3, elLx: -0.5, handRx: 0.6, handLx: 0.6, hipLx: -0.3 * k, kneeLx: 0.6 * k, hipRx: 0.1 - 0.4 * k, kneeRx: 0.2 * k });
}

// Vỡ Thế (sĩ quan, boss hết Phá Thế, 3,5 s chờ Đòn Quyết): t = giây từ lúc vỡ. Loạng choạng ngửa ra (0,2 s đầu) rồi
// khuỵu gối, gục người, đầu cúi, hai tay buông, thở dốc; vũ khí dài chống mũi xuống đất (rig-motion.js gập cổ tay cho
// mũi nằm đúng mặt đất). Thân gần thẳng đứng nên chân vẫn bám đất (IK), vạt áo, áo choàng buông sau lưng. Trước đây
// giữ khung giữa lúc ngã ngửa (knockdown 0,2: nghiêng 57°) cả 3,5 s: chân, vạt sau, áo choàng cắm xuống đất 0,2–0,44 m.
const REEL = P({ rootX: -0.22, hipsY: -0.16, torsoX: -0.35, headX: -0.3, shRx: 0.35, shRz: 0.45, elRx: -0.5, handRx: 0.5,
  shLx: 0.35, shLz: -0.45, elLx: -0.5, handLx: 0.5, hipLx: 0.25, kneeLx: 0.45, hipRx: -0.3, kneeRx: 0.45 });
const SLUMP = P({ rootX: 0.05, hipsY: -0.3, torsoX: 0.5, torsoY: 0.12, headX: 0.45, shRx: 0.05, shRz: 0.2, elRx: -0.35, handRx: 0.85,
  shLx: 0.15, shLz: -0.25, elLx: -0.45, handLx: 0.6, hipLx: -0.55, hipLz: -0.08, kneeLx: 1.0, hipRx: 0.35, hipRz: 0.1, kneeRx: 1.05 });
// style(p, t, w): lớp vũ khí khác đặt lại tay (vd đại kiếm chống mũi gươm xuống đất); bỏ trống = như cũ.
export function stagger(t, long = false, style = null) {
  const p = keys(seg(t, 0.15, 0.7), [[0, REEL], [1, SLUMP, "io"]]);
  const b = Math.sin(t * 4.5), w = seg(t, 0.4, 1);
  if (long) p.handRx = 0.35 + (0.85 - 0.35) * (1 - w);          // cán dài: mũi chống đất phía trước
  if (style) style(p, t, w);
  return add(p, { torsoX: 0.05 * b * w, headX: 0.04 * b * w, shRx: -0.03 * b * w, hipsY: 0.012 * b * w,
    torsoZ: 0.05 * Math.sin(t * 1.6) * w, hipsYaw: 0.04 * Math.sin(t * 1.1) * w });
}

// Đòn nặng hai tay (Toa Đô đại đao, đòn viền đỏ): giơ cao rồi bổ. long = vũ khí cán dài (đại đao, giáo): lúc bổ tay
// dừng cao hơn, lưỡi chếch nông (trước đây cùng khung với đao ngắn: mũi đại đao cắm xuống đất 1,9–2,1 m, cả lưỡi mất
// dưới cỏ; rig-motion.js gập cổ tay cho mũi dừng ở mặt đất).
export function heavyChop(u, windup = 0.55, long = false) {
  const sI = long ? -0.8 : -0.5, hI = long ? 0.75 : 0.95;
  return keys(u, [
    [0, P({ torsoX: 0.1, shRx: -0.6, shLx: -0.6, shRy: -0.3, shLy: 0.5, elRx: -0.9, elLx: -0.9, handRx: 0.4, hipLx: -0.3, kneeLx: 0.3, hipRx: 0.2, kneeRx: 0.2, hipsY: -0.06 })],
    [windup, P({ torsoX: -0.4, torsoY: 0.4, shRx: -2.95, shLx: -2.8, shRy: -0.2, shLy: 0.4, elRx: -0.5, elLx: -0.7, handRx: 0.3,
      hipLx: -0.25, kneeLx: 0.2, hipRx: 0.3, kneeRx: 0.2, hipsY: 0.02, headX: -0.2 }), "out"],
    [windup + 0.12, P({ torsoX: 0.7, torsoY: -0.3, shRx: sI, shLx: sI + 0.05, shRy: -0.25, shLy: 0.45, elRx: -0.05, elLx: -0.1, handRx: hI,
      hipLx: -0.85, kneeLx: 0.9, hipRx: 0.5, kneeRx: 0.45, hipsY: -0.3, headX: 0.2 }), "snap"],
    [1, P({ torsoX: 0.56, torsoY: -0.25, shRx: sI - 0.05, shLx: sI, shRy: -0.25, shLy: 0.45, elRx: -0.1, elLx: -0.1, handRx: hI - 0.05,
      hipLx: -0.8, kneeLx: 0.85, hipRx: 0.45, kneeRx: 0.4, hipsY: -0.26 }), "out"],
  ]);
}

// Quét ngang (đòn thường của sĩ quan): xoắn người lấy đà rồi quét vũ khí dài một vòng trước mặt.
export function sweep(u) {
  return keys(u, [
    [0, P({ torsoX: 0.1, shRx: -0.6, shLx: -0.6, shRy: -0.3, shLy: 0.5, elRx: -0.9, elLx: -0.9, handRx: 0.4, hipLx: -0.3, kneeLx: 0.3, hipRx: 0.2, kneeRx: 0.2, hipsY: -0.06 })],
    [0.4, P({ torsoX: 0.1, torsoY: 1.0, hipsYaw: 0.3, shRx: -1.3, shRy: 1.0, elRx: -0.4, handRx: 1.3, shLx: -1.2, shLy: 0.9, elLx: -0.8,
      hipLx: -0.3, kneeLx: 0.35, hipRx: 0.3, kneeRx: 0.3, hipsY: -0.12 }), "out"],
    [0.55, P({ torsoX: 0.25, torsoY: -1.1, hipsYaw: -0.4, shRx: -1.35, shRy: -1.1, elRx: -0.05, handRx: 1.45, shLx: -1.3, shLy: -0.8, elLx: -0.4,
      hipLx: -0.75, kneeLx: 0.6, hipRx: 0.45, kneeRx: 0.3, hipsY: -0.18 }), "snap"],
    [1, P({ torsoX: 0.2, torsoY: -0.8, hipsYaw: -0.3, shRx: -1.0, shRy: -0.8, elRx: -0.3, handRx: 1.2, shLx: -1.0, shLy: -0.6, elLx: -0.6,
      hipLx: -0.6, kneeLx: 0.5, hipRx: 0.4, kneeRx: 0.3, hipsY: -0.14 }), "io"],
  ]);
}

// Lùi né: nhún sau, bước một chân lùi, vũ khí giữ trước ngực.
export function backstep(u) {
  const k = Math.sin(clamp01(u) * Math.PI);
  return blendPose(GUARD, P({ torsoX: -0.2, hipsY: -0.22, shRx: -0.9, shLx: -0.9, shRy: -0.3, shLy: 0.4, elRx: -1.1, elLx: -1.0, handRx: 0.4,
    hipLx: 0.55, kneeLx: 0.7, hipRx: -0.5, kneeRx: 0.9, headX: 0.1 }), k);
}

// ---- bước thủ thế: đi khi đỡ (tướng), đi ngang thăm dò (sĩ quan) ------------------------------------------
// Thân trên giữ nguyên tư thế base, hai chân bước ngắn theo hướng (dx, dz) trong khung rig (véc-tơ đơn vị: +x phải,
// +z trước). Đặt bàn chân trong không gian rồi giải IK (legTo): pha trụ (STEP.duty chu kỳ) cổ chân nằm đúng mặt
// đất, lùi đều so với hông đúng bằng tốc độ thân nên đứng yên trên đất; pha đưa nhấc lên STEP.clear rồi đưa ra theo
// hướng đi. Tiến/lùi: hai chân lệch nửa chu kỳ như đi thường. Sang ngang: chân phía hướng đi bước trước, chân kia
// bước đuổi theo sau STEP.close chu kỳ (bước trượt thủ thế, hai chân không bắt chéo), đứng rộng thêm STEP.wide; đi
// chéo nội suy giữa hai lệch pha. stride = nửa quãng bàn chân quét trong pha trụ (đơn vị rig, từ stepGait()).
// Trước đây: tướng đi trong thế đỡ 2 m/s mà tư thế đứng yên (trôi trên đất); strafe() của sĩ quan xoay đùi, gập
// gối theo góc — gối gập làm chân ngắn lại, bàn chân tụt vào và lê (trượt ~20%), hai chân bắt chéo nhau ~0,35 m.
// ĐỀ XUẤT BẢN THỬ (STEP): thế đỡ 2 m/s ≈ 4 bước/s, bàn chân quét ±0,33 (rig) quanh chỗ của tư thế đỡ; đo trượt
// chân trụ 10–14% (tướng), ~10% (sĩ quan đi ngang 1,5 m/s).
const GAIT_S = { rate: 0, stride: 0 };
export const STEP = { rate: 13, duty: 0.7, close: 0.18, clear: 0.12, wide: 0.04 };
export function stepGait(sp, scale = 1, out = GAIT_S, rate = STEP.rate) {
  out.rate = rate / Math.sqrt(scale);
  out.stride = Math.min(0.45, Math.PI * STEP.duty * sp / (out.rate * scale));
  return out;
}
// Một chân: ψ pha riêng → [vị trí dọc hướng đi −1..1 (1 = đầu pha trụ, −1 = cuối), mức nhấc 0..1].
const _sl = [0, 0];
function sideStep(psi, out = _sl, D = STEP.duty) {
  const u = psi / TAU - Math.floor(psi / TAU);
  if (u < D) { out[0] = 1 - 2 * u / D; out[1] = 0; }
  else { const v = (u - D) / (1 - D); out[0] = -Math.cos(Math.PI * v); out[1] = Math.sin(Math.PI * v); }
  return out;
}
// Chân rig (như LEG trong models.js): đùi, cẳng, đế giày; khớp hông cao 0,92 − 0,02 so với gốc khi hipsY = 0.
const LEGA = { L1: 0.45, L2: 0.40, sole: 0.08, hip: 0.9 };
const _fk = [0, 0, 0], _lk = [0, 0, 0];
// Cổ chân so với khớp hông (khung hông) theo góc đùi θ, dạng đùi rz (Euler XYZ), gập gối κ → [x, y, z].
function footOf(th, rz, kn, out = _fk) {
  const L = LEGA, P = L.L1 + L.L2 * Math.cos(kn), Q = L.L2 * Math.sin(kn), c = Math.cos(rz), ct = Math.cos(th), st = Math.sin(th);
  out[0] = Math.sin(rz) * P; out[1] = -c * P * ct + Q * st; out[2] = -c * P * st - Q * ct;
  return out;
}
// Ngược lại: góc [θ, rz, κ] đưa cổ chân tới (X, Y, Z); ngoài tầm với thì duỗi hết về phía điểm đó.
function legTo(X, Y, Z, out = _lk) {
  const L = LEGA, dMax = (L.L1 + L.L2) * 0.999, dMin = 0.3;
  let d2 = X * X + Y * Y + Z * Z;
  if (d2 > dMax * dMax || d2 < dMin * dMin) {
    const d = Math.sqrt(d2) || 1e-6, f = (d > dMax ? dMax : dMin) / d;
    X *= f; Y *= f; Z *= f; d2 = X * X + Y * Y + Z * Z;
  }
  const ck = (d2 - L.L1 * L.L1 - L.L2 * L.L2) / (2 * L.L1 * L.L2), kn = Math.acos(ck < -1 ? -1 : ck > 1 ? 1 : ck);
  const P = L.L1 + L.L2 * Math.cos(kn), Q = L.L2 * Math.sin(kn), sx = X / P;
  const rz = Math.asin(sx < -1 ? -1 : sx > 1 ? 1 : sx);
  out[0] = wrapPi(Math.atan2(Z, Y) - Math.atan2(-Q, -Math.cos(rz) * P)); out[1] = rz; out[2] = kn;
  return out;
}
export function guardStep(base, phase, dx, dz, stride) {
  const S = STEP, p = { ...base }, sg = dx < 0 ? -1 : 1, w = dx * dx;
  const off = sg * (Math.PI * (1 - w) + TAU * S.close * w);     // chân trái trễ (dx > 0) hay sớm (dx < 0) so với chân phải
  sideStep(phase, _sl); const xR = _sl[0], uR = _sl[1];
  sideStep(phase - off, _sl); const xL = _sl[0], uL = _sl[1];
  p.hipsY = base.hipsY - 0.015 * (uL + uR); p.torsoZ = base.torsoZ - 0.06 * dx;
  // hướng đi đổi sang khung hông (thế thủ xoay hông), mặt đất dưới khớp hông; đi ngang thì đứng rộng thêm
  const yw = base.spin + base.hipsYaw, cy = Math.cos(yw), sy = Math.sin(yw);
  const hx = dx * cy - dz * sy, hz = dx * sy + dz * cy, y0 = LEGA.sole - LEGA.hip - p.hipsY, wd = S.wide * Math.abs(hx);
  footOf(base.hipLx, base.hipLz, base.kneeLx);
  legTo(_fk[0] - wd + stride * xL * hx, y0 + S.clear * uL, _fk[2] + stride * xL * hz); p.hipLx = _lk[0]; p.hipLz = _lk[1]; p.kneeLx = _lk[2];
  footOf(base.hipRx, base.hipRz, base.kneeRx);
  legTo(_fk[0] + wd + stride * xR * hx, y0 + S.clear * uR, _fk[2] + stride * xR * hz); p.hipRx = _lk[0]; p.hipRz = _lk[1]; p.kneeRx = _lk[2];
  return p;
}

// Sĩ quan đi ngang thăm dò quanh tướng (thế thủ song đao/đại đao giữ nguyên): bước thủ thế sang ngang, nhịp chậm
// hơn thế đỡ của tướng. dir = hướng theo trục x của rig (1 = sang phải), stride từ strafeGait().
export const STRAFE = { rate: 8.5 };
const STRAFE_BASE = { ...GUARD, hipsY: -0.04 };
export function strafeGait(sp, scale = 1, out = GAIT_S) { return stepGait(sp, scale, out, STRAFE.rate); }
export function strafe(phase, dir = 1, stride = 0.3) {
  const p = guardStep(STRAFE_BASE, phase, dir, 0, stride);
  p.torsoY = GUARD.torsoY + 0.05 * Math.sin(phase * 2);
  return p;
}

// Gầm thị uy: ưỡn ngực, giơ vũ khí lên trời, đầu ngửa.
export function roar(u) {
  const k = Math.sin(clamp01(u) * Math.PI) ** 0.6;
  return blendPose(GUARD, P({ torsoX: -0.35, hipsY: -0.12, shRx: -2.8, shRy: 0.2, elRx: -0.3, handRx: 0.1, shLx: -0.3, shLz: -0.9, elLx: -0.6,
    hipLx: -0.4, kneeLx: 0.45, hipRx: 0.35, kneeRx: 0.3, hipLz: -0.12, hipRz: 0.12, headX: -0.45 }), k);
}

// Giương cung bắn (tướng H40): tay trái đẩy cung, tay phải kéo dây về má.
export function shoot(u) {
  const d = EASE.out(seg(u, 0, 0.55)), rel = seg(u, 0.55, 0.7);
  return P({ torsoY: -0.55, hipsYaw: 0.3, shLx: -1.5, shLy: 0.5, elLx: -0.05, shRx: -1.5, shRy: 0.35 + 0.5 * d - 0.6 * rel, shRz: -0.2 * d, elRx: -2.4 * d + 1.0 * rel,
    hipLx: -0.3, kneeLx: 0.3, hipRx: 0.25, kneeRx: 0.2, hipsY: -0.06, headX: 0.05 });
}

export function cheer(t) {
  const p = idle(t, false), b = Math.sin(t * 6) * 0.15;
  p.shRx = -2.9 + b; p.elRx = -0.2; p.handRx = 0.2; p.shLx = -2.5 - b; p.elLx = -0.4; p.headX = -0.3;
  return p;
}

// ---- thủy chiến B20 (naval.js) — chỉ thêm, không đổi tư thế nào cũ ------------------------------------------------------
// Leo boong / leo sang đò (0,8 s, u ∈ [0, 1]): với tay bám mạn, co một gối lên, kéo người lên rồi đứng thẳng. Hông hạ rồi
// nâng (naval.js cộng thêm một cung độ cao, chân không bám đất khi leo).
const CLIMB_REACH = P({ torsoX: 0.45, headX: -0.35, hipsY: -0.3, shRx: -2.55, shRz: 0.15, elRx: -0.35, handRx: 0.2, shLx: -2.45, shLz: -0.15, elLx: -0.4,
  handLx: 0.2, hipLx: -1.35, kneeLx: 1.9, hipRx: 0.15, kneeRx: 0.35 });
const CLIMB_PULL = P({ torsoX: 0.6, headX: -0.15, hipsY: -0.2, shRx: -1.25, shRz: 0.4, elRx: -1.55, handRx: 0.6, shLx: -1.2, shLz: -0.4, elLx: -1.5,
  handLx: 0.6, hipLx: -0.9, kneeLx: 1.3, hipRx: -0.55, kneeRx: 1.5 });
export function climb(u) {
  return keys(clamp01(u), [[0, GUARD], [0.28, CLIMB_REACH, "out"], [0.68, CLIMB_PULL, "io"], [1, GUARD, "io"]]);
}
// Bị bắt sống (Ô Mã Nhi, Phàn Tiếp — hợp đồng B20 / R-spec §6): ĐỨNG THẲNG, hai tay buông tự nhiên, đầu ngẩng, vũ khí đã đặt
// dưới chân (units.js giấu vũ khí trong tay, đặt vũ khí xuống sàn). Không trói, không quỳ, không cúi rạp. t: giây (thở nhẹ).
const CAPTURED = P({ torsoX: -0.04, headX: -0.06, shRx: 0.08, shRz: 0.1, elRx: -0.18, handRx: 0.2, shLx: 0.08, shLz: -0.1, elLx: -0.18, handLx: 0.2,
  hipLx: -0.06, hipLz: -0.05, hipRx: 0.06, hipRz: 0.05, kneeLx: 0.05, kneeRx: 0.05 });
export function captured(t) {
  const b = Math.sin(t * 1.6) * 0.02;
  return add({ ...CAPTURED }, { torsoX: b, hipsY: b * 0.5 - 0.01 });
}
