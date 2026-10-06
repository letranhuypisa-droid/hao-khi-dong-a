// battle/anim-wc01.js — hoạt ảnh lớp WC01 Đại kiếm (H31 Trần Hưng Đạo): thế thủ hai tay, đỡ bằng bản gươm, chạy vác gươm
// trên vai, chuỗi N1–N6, đòn C1–C6 (tư thế giữ khi tụ lực ở khung gồng), lướt, Đòn Quyết, phản đòn, Hịch Tướng Sĩ, Binh Thư,
// Tuyệt Kỹ Bạch Đằng Quyết Chiến. Không import three: dựng tư thế thuần như anim.js (dùng chung P, keys, blendPose …).
//
// Cách dựng: mỗi khung khoá ghi phần thân (hông, chân, xoắn người, như anim.js) cộng ĐÍCH của gươm trong "khung thân" —
// gốc ở mặt đất dưới hông, +z trước mặt, +x bên phải, y lên, xoay theo hông nhưng KHÔNG theo spin (gươm quay cùng người khi
// xoay tròn): h = vị trí cổ tay phải (đơn vị rig), d = hướng lưỡi (từ chuôi ra mũi), e (tuỳ chọn) = hướng lưỡi sắc (mặt
// phẳng lưỡi đứng theo e; không ghi = giữ góc lật 0). Lúc nạp module, solve() đổi đích thành góc khớp tay phải bằng IK hai
// khúc (ik.js armIK) với mặt phẳng cánh tay chứa hướng lưỡi (cổ tay rig chỉ gập một trục), rồi đặt sẵn tay trái nắm chuôi
// (0,2 dưới tay phải dọc lưỡi) — rig-motion.js còn giải lại IK tay trái mỗi khung theo kênh grip (1 = hai tay nắm chuôi,
// 0 = tay trái buông: chỉ gươm, vẫy tay đọc hịch, ngã, lộn).
//
// Nhịp đòn nặng: gồng lâu và rộng (hông xoay trước, vai theo sau, trọng tâm dồn về chân sau) → chém rất nhanh ("snap") với
// bước chân trước dẫn hông → theo đà dài (lưỡi đi quá đích, người xoắn hết cỡ, gối khuỵu) → hồi thế chậm. ĐỀ XUẤT BẢN THỬ:
// mọi góc, mốc u (chỉnh bằng mắt trong lab.html?view=hero&hero=H31&m=…).
//
// Tư thế giải cho tay 0,34 + 0,36, vai ±0,3 (rig khối). Thân GLB giữ tay của mô hình (đợt 19a): fitArms (cuối file) giải lại tay
// phải mỗi khung theo số đo đó (rig-motion.js) — rig khối không đổi gì.

import * as A from "./anim.js";
import { armIK, armFK } from "./ik.js";

const { P, keys, blendPose, EASE, seg, clamp01 } = A;

// ---- toán khung (Euler "XYZ" như three: R = Rx·Ry·Rz) --------------------------------------------------------------------
function rotXYZ(x, y, z) {
  const a = Math.cos(x), b = Math.sin(x), c = Math.cos(y), d = Math.sin(y), e = Math.cos(z), f = Math.sin(z);
  return [c * e, -c * f, d, a * f + b * d * e, a * e - b * d * f, -b * c, b * f - a * d * e, b * e + a * d * f, a * c];   // hàng
}
const mulT = (m, v) => [m[0] * v[0] + m[3] * v[1] + m[6] * v[2], m[1] * v[0] + m[4] * v[1] + m[7] * v[2], m[2] * v[0] + m[5] * v[1] + m[8] * v[2]];
const mul = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.sqrt(dot(a, a));
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const TAU = Math.PI * 2;

// Rig (models.js): khớp thân cao 0,04 trên hông (hông 0,92 + hipsY); vai (±0,3, 0,52) trong khung thân; tay 0,34 + cẳng
// (0, −0,36, 0,02); tay trái nắm chuôi ở GRIP dưới tay phải (dyn.grip); hướng khuỷu tay trái như rig-motion.js (gripPole).
const ARM = { L1: 0.34, L2: Math.hypot(0.36, 0.02), off: Math.atan2(0.02, 0.36) };
const SH = { R: [0.3, 0.52, 0], L: [-0.3, 0.52, 0] };
export const GRIP = 0.2;
const POLE_L = [-1, -0.7, -0.25], PREF_R = [1, -0.6, -0.3];
const WRIST = [-0.6, 1.7];                // gập cổ tay tự nhiên (hand*x); ngoài khoảng thì phạt khi chọn phía khuỷu

// Khung thân → khung thân trên (khớp vai): điểm, hướng.
function toTorso(b, p, isDir) {
  const Rh = rotXYZ(b.rootX || 0, b.hipsYaw || 0, b.rootZ || 0), Rt = rotXYZ(b.torsoX || 0, b.torsoY || 0, b.torsoZ || 0);
  let v = isDir ? p : sub(p, [0, 0.92 + (b.hipsY || 0), 0]);
  v = mulT(Rh, v);
  if (!isDir) v = sub(v, [0, 0.04, 0]);
  return mulT(Rt, v);
}
// Khung cánh tay theo góc vai YXZ (cột y, z) và khuỷu → trục y, z của khung cẳng tay.
function elFrame(sx, sy, sz, ex) {
  const cx = Math.cos(sx), s_x = Math.sin(sx), cy = Math.cos(sy), s_y = Math.sin(sy), cz = Math.cos(sz), s_z = Math.sin(sz);
  const Y = [-cy * s_z + s_y * s_x * cz, cx * cz, s_y * s_z + cy * s_x * cz], Z = [s_y * cx, -s_x, cy * cx], X = cross(Y, Z);
  const c = Math.cos(ex), s = Math.sin(ex);
  const y = [c * Y[0] + s * Z[0], c * Y[1] + s * Z[1], c * Y[2] + s * Z[2]], z = [-s * Y[0] + c * Z[0], -s * Y[1] + c * Z[1], -s * Y[2] + c * Z[2]];
  return { x: X, y, z };
}
const _ik = [0, 0, 0, 0];
// Tay phải: cổ tay tới W, lưỡi theo D (khung thân trên). Thử hai phía khuỷu trong mặt phẳng (vai, cổ tay, hướng lưỡi), lấy
// phía có góc cổ tay tự nhiên hơn (ưu tiên khuỷu ra ngoài, chúc xuống). E: hướng lưỡi sắc (tuỳ chọn) → góc lật handRz.
function solveRight(W, D, E) {
  const v = sub(W, SH.R), n = cross(v, D);
  const poles = len(n) < 1e-4 * len(v) ? [PREF_R] : [norm(cross(n, v)), norm(cross(v, n))];
  let best = null;
  for (const pl of poles) {
    armIK(v[0], v[1], v[2], pl[0], pl[1], pl[2], ARM.L1, ARM.L2, _ik);
    const ex = _ik[3] + ARM.off, f = elFrame(_ik[0], _ik[1], _ik[2], ex);
    const hx = Math.atan2(-dot(D, f.y), dot(D, f.z));
    const cost = Math.max(0, WRIST[0] - hx) + Math.max(0, hx - WRIST[1]) - 0.05 * dot(pl, norm(PREF_R));
    if (!best || cost < best.cost) {
      let hz = 0;
      if (E) {   // Rx(hx) rồi Rz(hz): trục y của bàn tay = −sin hz·x0 + cos hz·y0
        const c = Math.cos(hx), s = Math.sin(hx), y0 = [c * f.y[0] + s * f.z[0], c * f.y[1] + s * f.z[1], c * f.y[2] + s * f.z[2]];
        hz = Math.atan2(-dot(E, f.x), dot(E, y0));
        if (hz > Math.PI / 2) hz -= Math.PI; else if (hz < -Math.PI / 2) hz += Math.PI;    // lưỡi hai mặt sắc: lật ít nhất
      }
      best = { cost, shRx: _ik[0], shRy: _ik[1], shRz: _ik[2], elRx: ex, handRx: hx, handRz: hz };
    }
  }
  return best;
}
function solveLeft(G) {
  const v = sub(G, SH.L);
  armIK(v[0], v[1], v[2], POLE_L[0], POLE_L[1], POLE_L[2], ARM.L1, ARM.L2, _ik);
  return { shLx: _ik[0], shLy: _ik[1], shLz: _ik[2], elLx: _ik[3] + ARM.off };
}
// Một khung: phần thân + đích gươm → tư thế đầy đủ (P). o.h, o.d, o.e ở khung thân; o.grip mặc định 1. o.free: tay trái
// không nắm (giữ góc tay trái ghi trong o).
export function solve(o) {
  const b = { ...o }; delete b.h; delete b.d; delete b.e; delete b.free;
  if (b.grip === undefined) b.grip = o.free ? 0 : 1;
  if (!o.h) return P(b);
  const D = norm(toTorso(b, norm(o.d), true)), W = toTorso(b, o.h, false), E = o.e ? norm(toTorso(b, norm(o.e), true)) : null;
  const r = solveRight(W, D, E);
  delete r.cost;
  Object.assign(b, r);
  if (!o.free) Object.assign(b, solveLeft([W[0] - GRIP * D[0], W[1] - GRIP * D[1], W[2] - GRIP * D[2]]), { handLx: 0.3 });
  return P(b);
}
// Dãy khung [[u, tư thế, nhịp]] → dãy cho keys(). Góc vai (Euler YXZ) của mỗi khung chọn trong hai cách viết cùng một
// hướng — (x, y, z) và (π − x, y + π, z + π) — cộng bội 2π, lấy cách gần khung trước nhất: nội suy góc khớp khỏi quay
// cánh tay một vòng vô cớ giữa hai khung.
const wrapNear = (v, ref) => v - TAU * Math.round((v - ref) / TAU);
function track(ks) {
  const out = ks.map(([u, p, e]) => [u, { ...p }, e]);         // bản sao: khung dùng chung (GUARD …) không bị sửa
  for (let i = 1; i < out.length; i++) for (const s of ["R", "L"]) {
    const a = out[i - 1][1], q = out[i][1], kx = "sh" + s + "x", ky = "sh" + s + "y", kz = "sh" + s + "z";
    let best = null;
    for (const [x, y, z] of [[q[kx], q[ky], q[kz]], [Math.PI - q[kx], q[ky] + Math.PI, q[kz] + Math.PI]]) {
      const c = [wrapNear(x, a[kx]), wrapNear(y, a[ky]), wrapNear(z, a[kz])];
      const d = Math.abs(c[0] - a[kx]) + Math.abs(c[1] - a[ky]) + Math.abs(c[2] - a[kz]);
      if (!best || d < best.d) best = { c, d };
    }
    [q[kx], q[ky], q[kz]] = best.c;
  }
  return out;
}
const pose = (o) => Object.freeze(solve(o));
// Giữa nhát bổ (chuôi trước trán, lưỡi dựng chếch ra trước): nội suy góc khớp thẳng từ khung gồng qua đầu sang khung bổ
// thì tay phải văng rộng ra ngoài vai, tay trái rời chuôi (đo: 0,3–0,6 m trong 2–3 khung); khung giữa giữ gươm đi đúng cung
// qua đỉnh đầu. Thân lấy trộn giữa hai khung (t), nhịp "in" tới khung giữa rồi "out" tới khung bổ = nhát bổ tăng tốc.
const CHOP = { h: [0.05, 1.72, 0.45], d: [0.02, 0.85, 0.53], e: [0, -0.53, 0.85] };
const chopMid = (a, b, t = 0.4) => pose({ ...blendPose(a, b, t), ...CHOP });

// ---- thế thủ, đỡ, chạy -------------------------------------------------------------------------------------------------
// Trung đoạn hai tay: chân trái trước, gối chùng, hông xoay trái, vai xoay lại; chuôi trước rốn, mũi gươm chếch lên ngang mắt
// địch. Lưỡi sắc chúc xuống trước.
const LEGS = { hipsY: -0.1, hipLx: -0.42, hipLz: -0.08, kneeLx: 0.5, hipRx: 0.34, hipRz: 0.1, kneeRx: 0.36 };
export const GUARD = pose({ torsoX: 0.12, torsoY: 0.22, hipsYaw: -0.25, ...LEGS, headX: -0.06,
  h: [0.02, 1.02, 0.42], d: [-0.05, 0.5, 0.86], e: [0, -0.85, 0.5] });
// Đỡ: bản gươm chắn chéo trước đầu (chuôi bên trái, mũi chếch lên phải), mặt phẳng lưỡi quay ra trước; hạ trọng tâm.
export const BLOCK = pose({ torsoX: 0.16, torsoY: 0.1, hipsYaw: -0.15, hipsY: -0.2, hipLx: -0.42, hipLz: -0.08, kneeLx: 0.6,
  hipRx: 0.32, hipRz: 0.1, kneeRx: 0.5, headX: 0.05,
  h: [-0.12, 1.28, 0.42], d: [0.72, 0.62, 0.12], e: [0, 0.2, -1] });
// Vác gươm trên vai phải (chạy): tay phải nắm chuôi trước ngực phải, sống lưỡi tựa vai, mũi chếch lên ra sau; tay trái buông
// vung theo nhịp chạy (run() đặt). Tính sẵn trong khung thân trên hơi đổ người như lúc chạy (torsoX 0,3).
const CARRY = solve({ torsoX: 0.3, h: [0.2, 1.22, 0.22], d: [0.12, 0.5, -0.86], e: [0, 1, 0.4], free: true });
function carryArms(p) {
  p.shRx = CARRY.shRx; p.shRy = CARRY.shRy; p.shRz = CARRY.shRz; p.elRx = CARRY.elRx; p.handRx = CARRY.handRx; p.handRz = CARRY.handRz;
  p.grip = 0;
  return p;
}

export function idle(t) { return A.idle(t, true, GUARD); }
export function run(phase, speed01 = 1, stride = 0.95 * speed01) { return A.run(phase, speed01, stride, carryArms); }
export function block() { return BLOCK; }
// Trúng đòn: giật ngửa, gươm bị đánh bật lên (vẫn hai tay nắm).
const HIT = pose({ torsoX: -0.45, torsoY: 0.3, headX: -0.35, hipsY: -0.14, hipLx: 0.25, kneeLx: 0.35, hipRx: -0.15, kneeRx: 0.5, rootX: -0.08,
  h: [0.2, 1.3, 0.25], d: [0.25, 0.9, 0.3] });
export function hitReact(u) { return A.hitReact(u, GUARD, HIT); }
// Lộn né: như song đao nhưng hai tay vẫn nắm chuôi (IK tay trái theo grip).
export function dodgeRoll(u) { const p = A.dodgeRoll(u); p.grip = 1; return p; }
export function knockdown(u) { const p = A.knockdown(u); p.grip = 0; return p; }

// ---- chuỗi N -----------------------------------------------------------------------------------------------------------
// N1 chém xéo từ trên vai phải xuống trái dưới: gồng — hông xoay phải, gươm vắt qua vai phải mũi chúc ra sau; chém — chân
// trái bước tới, hông quật trái, vai theo; theo đà — lưỡi quét xuống sát đất bên trái, người xoắn hết cỡ.
const N1_WIND = pose({ torsoX: -0.1, torsoY: 0.85, hipsYaw: 0.2, hipsY: -0.08, hipLx: -0.3, hipLz: -0.08, kneeLx: 0.35, hipRx: 0.32, hipRz: 0.1, kneeRx: 0.45,
  headX: -0.05, h: [0.38, 1.62, -0.06], d: [0.4, 0.3, -0.87], e: [0.3, 0.9, 0.3] });
const N1_CUT = pose({ torsoX: 0.3, torsoY: -0.4, hipsYaw: -0.3, hipsY: -0.2, hipLx: -0.78, hipLz: -0.06, kneeLx: 0.75, hipRx: 0.5, hipRz: 0.1, kneeRx: 0.3,
  headX: 0.05, h: [0.0, 1.02, 0.6], d: [-0.6, -0.35, 0.72], e: [-0.6, -0.6, -0.3] });
const N1_FOL = pose({ torsoX: 0.42, torsoY: -0.8, hipsYaw: -0.42, hipsY: -0.26, hipLx: -0.82, hipLz: -0.08, kneeLx: 0.85, hipRx: 0.52, hipRz: 0.12, kneeRx: 0.34,
  headX: 0.1, h: [-0.3, 0.86, 0.42], d: [-0.8, -0.45, 0.2], e: [-0.2, -0.8, -0.5] });
const N1_K = track([[0, GUARD], [0.34, N1_WIND, "out"], [0.48, N1_CUT, "snap"], [0.66, N1_FOL, "out"], [1, GUARD, "io"]]);
// N2 chém ngược từ trái dưới hất lên phải: gồng kéo lưỡi ra sau bên trái sát hông, hông xoắn trái; chém quật hông sang phải,
// chân phải trụ; theo đà gươm vút lên cao bên phải.
const N2_WIND = pose({ torsoX: 0.3, torsoY: -0.75, hipsYaw: -0.4, hipsY: -0.22, hipLx: -0.7, hipLz: -0.08, kneeLx: 0.75, hipRx: 0.45, hipRz: 0.1, kneeRx: 0.35,
  h: [-0.4, 0.95, 0.1], d: [-0.55, -0.3, -0.78], e: [0.3, -0.9, 0.2] });
const N2_CUT = pose({ torsoX: 0.05, torsoY: 0.45, hipsYaw: 0.2, hipsY: -0.14, hipLx: -0.55, hipLz: -0.1, kneeLx: 0.5, hipRx: 0.4, hipRz: 0.12, kneeRx: 0.4,
  headX: -0.05, h: [0.28, 1.3, 0.55], d: [0.72, 0.42, 0.55], e: [0.4, 0.8, -0.3] });
const N2_FOL = pose({ torsoX: -0.08, torsoY: 0.8, hipsYaw: 0.3, hipsY: -0.1, hipLx: -0.5, hipLz: -0.1, kneeLx: 0.45, hipRx: 0.38, hipRz: 0.12, kneeRx: 0.4,
  headX: -0.1, h: [0.4, 1.55, 0.18], d: [0.6, 0.62, -0.5], e: [-0.3, 0.6, 0.7] });
const N2_K = track([[0, N1_FOL], [0.3, N2_WIND, "out"], [0.48, N2_CUT, "snap"], [0.66, N2_FOL, "out"], [1, GUARD, "io"]]);
// N3 bổ thẳng qua đầu: nhón lên, ngả người, gươm giơ cao vắt ra sau đầu; bổ xuống, lao gối trước, mũi gươm chạm đất trước mặt.
const N3_WIND = pose({ torsoX: -0.32, torsoY: 0.15, hipsYaw: -0.1, hipsY: 0.02, hipLx: -0.3, hipLz: -0.08, kneeLx: 0.2, hipRx: 0.28, hipRz: 0.08, kneeRx: 0.2,
  headX: -0.25, h: [0.05, 1.95, -0.02], d: [0.02, 0.45, -0.89], e: [0, 1, 0.3] });
const N3_CUT = pose({ torsoX: 0.55, torsoY: 0.05, hipsYaw: -0.12, hipsY: -0.3, hipLx: -0.95, hipLz: -0.06, kneeLx: 0.95, hipRx: 0.55, hipRz: 0.08, kneeRx: 0.55,
  headX: 0.2, h: [0.02, 0.98, 0.66], d: [0, -0.45, 0.89], e: [0, -1, 0.2] });
const N3_FOL = pose({ torsoX: 0.62, torsoY: 0.05, hipsYaw: -0.12, hipsY: -0.34, hipLx: -1.0, hipLz: -0.06, kneeLx: 1.05, hipRx: 0.58, hipRz: 0.08, kneeRx: 0.6,
  headX: 0.25, h: [0.02, 0.8, 0.62], d: [0, -0.62, 0.78], e: [0, -1, 0.2] });
// khung chuyển: từ theo đà N2 (gươm cao bên phải) kéo chuôi về sát đầu rồi mới giơ qua đầu — nội suy góc khớp thẳng từ N2
// sang khung gồng thì tay phải văng rộng ra ngoài, tay trái không với tới chuôi
const N3_MID = pose({ torsoX: -0.2, torsoY: 0.35, hipsYaw: 0.05, hipsY: -0.04, hipLx: -0.4, hipLz: -0.1, kneeLx: 0.3, hipRx: 0.3, hipRz: 0.1, kneeRx: 0.3,
  headX: -0.15, h: [0.18, 1.78, 0.14], d: [0.12, 0.85, -0.5], e: [0, 0.5, 0.85] });
const N3_K = track([[0, N2_FOL], [0.16, N3_MID, "io"], [0.34, N3_WIND, "out"], [0.44, chopMid(N3_WIND, N3_CUT), "in"], [0.5, N3_CUT, "out"], [0.7, N3_FOL, "out"], [1, GUARD, "io"]]);
// N4 quét ngang rộng từ phải sang trái kèm bước: gươm thu về bên hông phải, mũi chĩa ra sau, xoắn người hết cỡ; quét ngang
// ngang thắt lưng một nửa vòng, bước chân trái tới; theo đà mũi gươm vòng ra sau bên trái.
const N4_WIND = pose({ torsoX: 0.12, torsoY: 1.0, hipsYaw: 0.3, hipsY: -0.16, hipLx: -0.35, hipLz: -0.1, kneeLx: 0.5, hipRx: 0.4, hipRz: 0.12, kneeRx: 0.5,
  h: [0.42, 1.1, -0.1], d: [0.4, 0.12, -0.9], e: [0.9, 0, 0.3] });
const N4_CUT = pose({ torsoX: 0.22, torsoY: -0.3, hipsYaw: -0.35, hipsY: -0.24, hipLx: -0.85, hipLz: -0.1, kneeLx: 0.8, hipRx: 0.5, hipRz: 0.14, kneeRx: 0.35,
  h: [0.02, 1.12, 0.62], d: [-0.45, 0.05, 0.89], e: [-0.9, 0, -0.4] });
const N4_FOL = pose({ torsoX: 0.25, torsoY: -1.0, hipsYaw: -0.5, hipsY: -0.26, hipLx: -0.88, hipLz: -0.1, kneeLx: 0.85, hipRx: 0.52, hipRz: 0.14, kneeRx: 0.38,
  h: [-0.38, 1.12, 0.28], d: [-0.92, 0.05, -0.35], e: [-0.3, 0, -0.95] });
const N4_K = track([[0, N3_FOL], [0.34, N4_WIND, "out"], [0.5, N4_CUT, "snap"], [0.7, N4_FOL, "out"], [1, GUARD, "io"]]);
// N5 đâm rồi hất lên: rút gươm về hông phải, mũi chĩa tới, ngả người sau; đâm thẳng hai tay duỗi, lao chân trước; lật cổ tay
// hất lưỡi vút lên (nhát trúng), người bật thẳng.
const N5_WIND = pose({ torsoX: -0.05, torsoY: 0.55, hipsYaw: 0.1, hipsY: -0.16, hipLx: -0.3, hipLz: -0.08, kneeLx: 0.45, hipRx: 0.45, hipRz: 0.1, kneeRx: 0.55,
  h: [0.22, 1.02, 0.02], d: [-0.1, 0.12, 0.99], e: [0, -1, 0] });
const N5_THR = pose({ torsoX: 0.3, torsoY: -0.1, hipsYaw: -0.2, hipsY: -0.26, hipLx: -0.95, hipLz: -0.06, kneeLx: 0.8, hipRx: 0.55, hipRz: 0.1, kneeRx: 0.25,
  h: [0.08, 1.18, 0.72], d: [0, 0.05, 1], e: [0, -1, 0] });
const N5_CUT = pose({ torsoX: -0.1, torsoY: 0.1, hipsYaw: -0.15, hipsY: -0.12, hipLx: -0.8, hipLz: -0.06, kneeLx: 0.55, hipRx: 0.45, hipRz: 0.1, kneeRx: 0.2,
  headX: -0.2, h: [0.08, 1.62, 0.55], d: [0.05, 0.85, 0.52], e: [0, 0.5, -0.85] });
const N5_FOL = pose({ torsoX: -0.2, torsoY: 0.15, hipsYaw: -0.15, hipsY: -0.08, hipLx: -0.75, hipLz: -0.06, kneeLx: 0.45, hipRx: 0.42, hipRz: 0.1, kneeRx: 0.2,
  headX: -0.25, h: [0.08, 1.85, 0.25], d: [0.05, 0.95, -0.3], e: [0, -0.3, -0.95] });
const N5_K = track([[0, N4_FOL], [0.26, N5_WIND, "out"], [0.38, N5_THR, "snap"], [0.44, N5_THR, "lin"], [0.54, N5_CUT, "snap"], [0.72, N5_FOL, "out"], [1, GUARD, "io"]]);
// N6 xoay hai tay một vòng rưỡi: gồng xoắn người sang phải, gươm dang ngang ra sau; xoay, lưỡi nằm ngang ngang ngực dang
// hết tay; hạ trọng tâm dần, dừng gươm chếch xuống trước mặt.
const N6_WIND = pose({ torsoX: 0.18, torsoY: 0.9, hipsYaw: 0.25, hipsY: -0.2, hipLx: -0.45, hipLz: -0.12, kneeLx: 0.6, hipRx: 0.45, hipRz: 0.14, kneeRx: 0.55,
  h: [0.45, 1.12, -0.12], d: [0.55, 0.05, -0.84], e: [0.84, 0, 0.55] });
const N6_SPIN = pose({ torsoX: 0.25, torsoY: -0.2, hipsYaw: 0, hipsY: -0.26, hipLx: -0.55, hipLz: -0.14, kneeLx: 0.65, hipRx: 0.4, hipRz: 0.16, kneeRx: 0.6,
  h: [0.18, 1.2, 0.6], d: [0.95, 0.02, 0.3], e: [0.3, 0, -0.95] });
const N6_END = pose({ torsoX: 0.4, torsoY: -0.35, hipsYaw: -0.2, hipsY: -0.32, hipLx: -0.8, hipLz: -0.12, kneeLx: 0.9, hipRx: 0.55, hipRz: 0.14, kneeRx: 0.5,
  headX: 0.1, h: [-0.1, 0.95, 0.55], d: [-0.35, -0.35, 0.87], e: [-0.9, -0.2, -0.3] });
function N6(u) {
  const s = EASE.io(seg(u, 0.22, 0.78)), p = keys(u, N6_K);
  p.spin = -s * 1.5 * TAU;
  p.hipsY += Math.sin(s * Math.PI) * 0.08;
  return p;
}
const N6_K = track([[0, N5_FOL], [0.22, N6_WIND, "out"], [0.34, N6_SPIN, "io"], [0.7, N6_SPIN, "lin"], [0.84, N6_END, "out"], [1, GUARD, "io"]]);

// ---- đòn C --------------------------------------------------------------------------------------------------------------
// Giơ gươm qua đầu (khung gồng của C1, C4, C6, Đòn Quyết, Tuyệt Kỹ): nhón chân, ưỡn người, lưỡi vắt thẳng ra sau lưng.
const OVERHEAD = pose({ torsoX: -0.38, torsoY: 0.2, hipsYaw: -0.15, hipsY: 0.04, hipLx: -0.35, hipLz: -0.08, kneeLx: 0.2, hipRx: 0.3, hipRz: 0.08, kneeRx: 0.15,
  headX: -0.3, h: [0.06, 2.0, -0.02], d: [0.03, 0.25, -0.97], e: [0, 1, 0.25] });
// Bổ xuống đất (C1, C4, Đòn Quyết): khuỵu gối trước, gập người, mũi gươm cắm đất ≈ 2 m trước mặt.
const SLAM = pose({ torsoX: 0.72, torsoY: 0.05, hipsYaw: -0.12, hipsY: -0.4, hipLx: -1.1, hipLz: -0.06, kneeLx: 1.2, hipRx: 0.6, hipRz: 0.1, kneeRx: 0.9,
  headX: 0.3, h: [0.02, 0.78, 0.7], d: [0, -0.55, 0.84], e: [0, -1, 0.2] });
const SLAM_HOLD = pose({ torsoX: 0.7, torsoY: 0.05, hipsYaw: -0.12, hipsY: -0.42, hipLx: -1.1, hipLz: -0.06, kneeLx: 1.25, hipRx: 0.6, hipRz: 0.1, kneeRx: 0.95,
  headX: 0.25, h: [0.02, 0.72, 0.66], d: [0, -0.62, 0.78], e: [0, -1, 0.2] });
// C1 Phá Sơn: thu thế, giơ gươm qua đầu (khung giữ khi tụ lực, u = 0,3), bổ phá khiên.
const C1_PRE = pose({ torsoX: 0.25, torsoY: 0.3, hipsYaw: -0.2, hipsY: -0.24, hipLx: -0.5, hipLz: -0.08, kneeLx: 0.75, hipRx: 0.4, hipRz: 0.1, kneeRx: 0.6,
  h: [0.15, 1.1, 0.25], d: [0.1, 0.8, -0.55] });
const CHOP_MID = chopMid(OVERHEAD, SLAM);
const C1_K = track([[0, GUARD], [0.14, C1_PRE, "out"], [0.3, OVERHEAD, "out"], [0.42, OVERHEAD, "lin"], [0.5, CHOP_MID, "in"], [0.55, SLAM, "out"], [0.78, SLAM_HOLD, "out"], [1, GUARD, "io"]]);
// C2 Kình Ba: hạ thấp, lưỡi kéo lê sát đất sau bên phải; bật cả người lên, hất gươm vút lên trời.
const C2_LOW = pose({ torsoX: 0.6, torsoY: 0.5, hipsYaw: 0.1, hipsY: -0.44, hipLx: -0.9, hipLz: -0.08, kneeLx: 1.35, hipRx: 0.25, hipRz: 0.12, kneeRx: 1.15,
  headX: 0.15, h: [0.36, 0.72, -0.12], d: [0.3, -0.45, -0.84], e: [0, -0.5, 0.85] });
const C2_UP = pose({ torsoX: -0.3, torsoY: -0.15, hipsYaw: -0.1, hipsY: 0.28, hipLx: -0.35, hipLz: -0.06, kneeLx: 0.25, hipRx: 0.35, hipRz: 0.08, kneeRx: 0.8,
  headX: -0.35, h: [0.08, 1.95, 0.35], d: [0.02, 0.92, 0.38], e: [0, 0.4, -0.9] });
const C2_FOL = pose({ torsoX: -0.32, torsoY: -0.18, hipsYaw: -0.1, hipsY: 0.2, hipLx: -0.38, hipLz: -0.06, kneeLx: 0.3, hipRx: 0.35, hipRz: 0.08, kneeRx: 0.7,
  headX: -0.35, h: [0.08, 2.05, 0.1], d: [0.02, 0.96, -0.25], e: [0, -0.25, -0.96] });
const C2_K = track([[0, GUARD], [0.3, C2_LOW, "out"], [0.46, C2_UP, "snap"], [0.66, C2_FOL, "out"], [1, GUARD, "io"]]);
// C3 Cuồng Lan: xoay liên hồi, lưỡi dang ngang hết tay (như N6 nhưng 3,5 vòng, hông thấp).
function C3(u) {
  const s = EASE.io(seg(u, 0.1, 0.88)), inn = seg(u, 0, 0.1), out = seg(u, 0.88, 1), w = Math.min(inn, 1 - out);
  const p = blendPose(GUARD, C3_SPREAD, EASE.out(w));
  p.spin = -s * 3.5 * TAU;
  p.hipsY += Math.sin(s * Math.PI * 7) * 0.03;
  p.torsoZ = Math.sin(s * Math.PI * 7) * 0.06;
  return p;
}
const C3_SPREAD = pose({ torsoX: 0.28, torsoY: -0.25, hipsYaw: 0, hipsY: -0.28, hipLx: -0.55, hipLz: -0.16, kneeLx: 0.7, hipRx: 0.4, hipRz: 0.16, kneeRx: 0.65,
  h: [0.2, 1.18, 0.58], d: [0.96, -0.05, 0.25], e: [0.25, 0, -0.97] });
// C4 Trảm Giang: xoay một vòng lấy đà (gươm dang ngang), dừng giơ gươm qua đầu (khung giữ khi tụ lực, u = 0,42), bổ đất.
function C4(u) {
  const p = keys(u, C4_K), s = EASE.io(seg(u, 0.06, 0.34));
  p.spin = -s * TAU;
  return p;
}
const C4_K = track([[0, GUARD], [0.08, N6_WIND, "out"], [0.16, C3_SPREAD, "io"], [0.3, C3_SPREAD, "lin"], [0.42, OVERHEAD, "out"], [0.5, OVERHEAD, "lin"],
  [0.56, CHOP_MID, "in"], [0.6, SLAM, "out"], [0.8, SLAM_HOLD, "out"], [1, GUARD, "io"]]);
// C5 Xuyên Trận: đổ người lao tới, gươm ôm sát hông phải mũi chĩa trước; cuối đường lao quét chéo xuyên qua.
const C5_RUSH = pose({ torsoX: 0.65, torsoY: 0.35, hipsYaw: 0, hipsY: -0.3, hipLx: -1.0, hipLz: -0.06, kneeLx: 0.9, hipRx: 0.7, hipRz: 0.08, kneeRx: 0.7,
  headX: -0.35, h: [0.2, 1.0, 0.24], d: [-0.12, 0.1, 0.99], e: [0, -1, 0] });
const C5_K = track([[0, GUARD], [0.16, C5_RUSH, "out"], [0.42, C5_RUSH, "lin"], [0.52, N4_CUT, "snap"], [0.72, N4_FOL, "out"], [1, GUARD, "io"]]);
// C6 Lôi Đình: khuỵu thấp lấy đà, bật nhảy giơ gươm qua đầu (khung giữ khi tụ lực, u = 0,3), rơi xuống bổ đất, vòng chấn.
const C6_CROUCH = pose({ torsoX: 0.55, torsoY: 0.2, hipsYaw: -0.1, hipsY: -0.45, hipLx: -0.8, hipLz: -0.1, kneeLx: 1.4, hipRx: -0.2, hipRz: 0.1, kneeRx: 1.3,
  headX: 0.1, h: [0.2, 0.9, 0.24], d: [0.15, 0.75, -0.64] });
// trên không: hông đã nâng 0,4 nên đích tay cũng nâng theo (khung thân tính từ mặt đất)
const C6_AIR = pose({ torsoX: -0.45, torsoY: 0.15, hipsYaw: -0.1, hipsY: 0.4, hipLx: -0.7, kneeLx: 1.1, hipRx: 0.1, kneeRx: 0.9, headX: -0.3,
  h: [0.05, 2.36, 0.04], d: [0.02, 0.15, -0.99], e: [0, 1, 0.15] });
function C6(u) {
  const p = keys(u, C6_K);
  p.hipsY += Math.sin(clamp01(seg(u, 0.18, 0.6)) * Math.PI) * 0.55;   // bay lên rồi rơi (IK chân tắt dần khi chân rời đất)
  return p;
}
const C6_K = track([[0, GUARD], [0.15, C6_CROUCH, "out"], [0.3, C6_AIR, "out"], [0.48, C6_AIR, "lin"], [0.56, chopMid(C6_AIR, SLAM), "in"], [0.62, SLAM, "out"], [0.82, SLAM_HOLD, "out"], [1, GUARD, "io"]]);

// ---- lướt, Đòn Quyết, phản đòn -------------------------------------------------------------------------------------------
const DN_K = track([[0, GUARD], [0.16, C5_RUSH, "out"], [0.34, C5_RUSH, "lin"], [0.44, N1_CUT, "snap"], [0.66, N1_FOL, "out"], [1, GUARD, "io"]]);
const DC_K = track([[0, GUARD], [0.14, C5_RUSH, "out"], [0.3, N4_WIND, "io"], [0.48, N4_CUT, "snap"], [0.7, N4_FOL, "out"], [1, GUARD, "io"]]);
// Đòn Quyết: giơ cao chậm rãi (dài hơn C1), bổ dứt khoát, giữ lâu.
const DQ_K = track([[0, GUARD], [0.2, C1_PRE, "out"], [0.42, OVERHEAD, "out"], [0.48, OVERHEAD, "lin"], [0.53, CHOP_MID, "in"], [0.56, SLAM, "out"], [0.85, SLAM_HOLD, "out"], [1, GUARD, "io"]]);
// Phản đòn: gạt bằng bản gươm (thế đỡ) rồi chém xéo trả ngay.
const CT_K = track([[0, BLOCK], [0.18, BLOCK, "lin"], [0.26, N1_WIND, "out"], [0.36, N1_CUT, "snap"], [0.58, N1_FOL, "out"], [1, GUARD, "io"]]);

// ---- kỹ năng, Tuyệt Kỹ ---------------------------------------------------------------------------------------------------
// Hịch Tướng Sĩ (3 s, lặp): cắm gươm mũi xuống đất trước mặt, tay phải tì núm chuôi; tay trái giơ cao, người thẳng, đầu
// ngẩng — tay trái vung nhịp theo lời hịch. u = 0..1 trên 3 s.
const HICH = pose({ torsoX: -0.12, torsoY: 0.1, hipsYaw: -0.1, hipsY: -0.04, hipLx: -0.3, hipLz: -0.1, kneeLx: 0.2, hipRx: 0.2, hipRz: 0.1, kneeRx: 0.1,
  headX: -0.28, h: [0.08, 1.3, 0.5], d: [0, -1, 0.06], e: [0, 0, 1], free: true, shLx: -2.7, shLy: 0, shLz: -0.35, elLx: -0.45, handLx: 0.2 });
function hich(u) {
  const inn = EASE.out(seg(u, 0, 0.12)), p = blendPose(GUARD, HICH, inn), t = u * 3;
  const beat = Math.sin(t * Math.PI * 1.6);                        // tay trái vung theo nhịp đọc
  p.shLx += 0.25 * beat * inn; p.elLx += -0.25 * Math.max(0, beat) * inn;
  p.torsoX += 0.03 * Math.sin(t * Math.PI * 1.6 + 0.6) * inn; p.headX += 0.05 * beat * inn;
  return p;
}
// Binh Thư Yếu Lược: một tay giơ gươm chỉ thẳng mục tiêu (tay trái buông, nắm ở hông), rồi về thế.
const POINT = pose({ torsoX: -0.05, torsoY: 0.45, hipsYaw: -0.2, hipsY: -0.08, hipLx: -0.4, hipLz: -0.08, kneeLx: 0.35, hipRx: 0.3, hipRz: 0.1, kneeRx: 0.25,
  headX: -0.08, h: [0.32, 1.48, 0.62], d: [-0.12, 0.12, 0.98], e: [0, -1, 0], free: true, shLx: 0.15, shLy: 0, shLz: -0.3, elLx: -1.4, handLx: 0.3 });
const BT_K = track([[0, GUARD], [0.3, POINT, "out"], [0.8, POINT, "lin"], [1, GUARD, "io"]]);
// Tuyệt Kỹ Bạch Đằng Quyết Chiến (clip 4,4 s): 3 nhát bổ đất ở 0,9 / 2,0 / 3,2 s (u ≈ 0,2 / 0,45 / 0,73), nhát 3 nhảy lên bổ
// mạnh nhất; cuối cùng đứng thẳng, một tay chỉ gươm xuống lòng sông (tư thế khép cảnh). u theo clip (SKILLS.bachDang.clip).
const RIVER = pose({ torsoX: -0.05, torsoY: 0.5, hipsYaw: -0.25, hipsY: -0.06, hipLx: -0.55, hipLz: -0.1, kneeLx: 0.45, hipRx: 0.3, hipRz: 0.12, kneeRx: 0.15,
  headX: 0.1, h: [0.36, 1.35, 0.6], d: [0.05, -0.42, 0.9], e: [0, -0.9, -0.42], free: true, shLx: 0.2, shLy: 0, shLz: -0.45, elLx: -0.4, handLx: 0.2 });
const ULT_K = track([[0, GUARD], [0.1, OVERHEAD, "out"], [0.16, CHOP_MID, "in"], [0.2, SLAM, "out"], [0.27, SLAM_HOLD, "out"], [0.31, C1_PRE, "io"],
  [0.36, OVERHEAD, "out"], [0.41, CHOP_MID, "in"], [0.45, SLAM, "out"],
  [0.52, SLAM_HOLD, "out"], [0.58, C6_CROUCH, "out"], [0.64, C6_AIR, "out"], [0.69, chopMid(C6_AIR, SLAM), "in"], [0.73, SLAM, "out"], [0.8, SLAM_HOLD, "out"], [0.9, RIVER, "io"], [1, RIVER, "lin"]]);
function ult(u) {
  const p = keys(u, ULT_K);
  p.hipsY += Math.sin(clamp01(seg(u, 0.6, 0.72)) * Math.PI) * 0.4;
  return p;
}

// ---- bảng đòn (hero-anim.js: ANIMS.WC01) --------------------------------------------------------------------------------
export const HERO_ANIM_WC01 = {
  N1: (u) => keys(u, N1_K), N2: (u) => keys(u, N2_K), N3: (u) => keys(u, N3_K), N4: (u) => keys(u, N4_K), N5: (u) => keys(u, N5_K), N6,
  C1: (u) => keys(u, C1_K), C2: (u) => keys(u, C2_K), C3, C4, C5: (u) => keys(u, C5_K), C6,
  DN: (u) => keys(u, DN_K), DC: (u) => keys(u, DC_K), DQ: (u) => keys(u, DQ_K), CT: (u) => keys(u, CT_K),
  hich, binhThu: (u) => keys(u, BT_K), ult,
};
// Tư thế ngoài đòn (hero.js sẽ chọn theo lớp): thế thủ, đỡ, chạy, trúng đòn, né, ngã; charge = khung giữ khi tụ lực C.
export const POSES_WC01 = { guard: GUARD, block: BLOCK, idle, run, hitReact, dodgeRoll, knockdown,
  charge: (key) => HERO_ANIM_WC01[key]?.(MOVE_CHARGE_U[key] ?? 0.3) };
const MOVE_CHARGE_U = { C1: 0.3, C4: 0.42, C6: 0.3 };

// ---- tay phải theo số đo của rig (thân GLB, đợt 19a) ---------------------------------------------------------------------
// Tư thế trên giải cho tay 0,34 + 0,36, vai ±0,3 (ARM, SH). Thân GLB giữ tay của mô hình (H31 0,23–0,25 + 0,21–0,22, vai ±0,225;
// lính Tự do LINH_r01 / r24 tay 0,48–0,52, vai ±0,31): đặt thẳng góc khớp của tư thế thì cổ tay phải gần vai hơn đích — tay trái
// không với tới chuôi (đo đợt soát 19a: 12 / 16 đòn hụt tới 0,1), lưỡi giơ qua đầu sượt tâm sọ 2 cm. fitArms giải lại tay phải
// mỗi khung (rig-motion.js, sau tư thế, trước fixBlades / gripIK): hướng lưỡi, lưỡi sắc lấy từ tư thế; cổ tay về điểm gần đích nhất
// trong tầm với (FIT.k tay duỗi: khuỷu còn gập ~28°) — đang nắm hai tay (grip ≥ 0,5) thì điểm nắm (GRIP dưới cổ tay dọc lưỡi) cũng
// trong tầm tay trái; cổ tay sát tâm sọ (< wr = max(FIT.wr, vỏ đầu)) thì đẩy ra; lưỡi gần tâm sọ hơn sr = max(FIT.sr, vỏ đầu +
// FIT.hm) thì nghiêng lưỡi khỏi đầu; mặt phẳng tay chứa lưỡi (cổ tay chỉ gập một trục), phía khuỷu gần khuỷu của tư thế.
// skull: tâm sọ trong khung đầu. Vỏ đầu (headShell, models.js dyn.shell): thân GLB đội mũ to hơn đầu khối — H31 0,157, LINH_r24
// 0,148, LINH_r01 0,119. Giữ sr 0,12 thì lưỡi xuyên mũ H31 ở C1, C4, C6, DQ, ult, N3 (đỉnh mũ cách trục lưỡi 1–6 mm); với vỏ + 0,05
// thì cách 2,5–7,5 cm, đổi lại tay ngắn mũ to không giơ gươm qua vai được: thế C1, C6, DQ, ult thành gươm dựng trước mặt (hướng lưỡi
// lệch tư thế tới 67° ở H31, 81° ở LINH_r01; sr 0,12 đã lệch 23° / 48° vì tay ngắn).
export const FIT = { k: 0.97, wr: 0.14, sr: 0.12, hm: 0.05, skull: [0, 0.13, 0.03] };
// Vỏ đầu của thân GLB: trung vị khoảng cách tâm sọ (khớp đầu hp ở khung gắn + FIT.skull) → đỉnh có xương nặng nhất là đầu (head:
// chỉ số xương); pos (n × 3, khung gắn), si / sw (n × 4: chỉ số, trọng số xương). Trung vị: mũ, tóc quanh sọ — sừng, mào, chóp mũ
// (H31 tới 0,37) chỉ là phần nhỏ. Không đỉnh nào theo đầu: 0.
export function headShell(pos, si, sw, head, hp) {
  const c = add(hp, FIT.skull), d = [];
  for (let v = 0; v < pos.length / 3; v++) {
    let q = 0; for (let k = 1; k < 4; k++) if (sw[v * 4 + k] > sw[v * 4 + q]) q = k;
    if (si[v * 4 + q] === head) d.push(Math.hypot(pos[v * 3] - c[0], pos[v * 3 + 1] - c[1], pos[v * 3 + 2] - c[2]));
  }
  d.sort((a, b) => a - b);
  return d.length ? d[d.length >> 1] : 0;
}
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scl = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const lin = (a, ka, b, kb) => [a[0] * ka + b[0] * kb, a[1] * ka + b[1] * kb, a[2] * ka + b[2] * kb];
// quay v quanh trục đơn vị k một góc th (Rodrigues)
const rotAx = (v, k, th) => { const c = Math.cos(th), s = Math.sin(th); return add(lin(v, c, cross(k, v), s), scl(k, dot(k, v) * (1 - c))); };
const inBall = (p, c, r) => { const d = sub(p, c), L = len(d); return L <= r ? p : add(c, scl(d, r / L)); };
// Điểm gần p nhất trong giao hai quả cầu (c1, r1), (c2, r2); không giao thì điểm giữa hai mặt cầu trên đường nối tâm.
function nearest2(p, c1, r1, c2, r2) {
  const in1 = (q) => len(sub(q, c1)) <= r1 + 1e-9, in2 = (q) => len(sub(q, c2)) <= r2 + 1e-9;
  if (in1(p) && in2(p)) return p;
  const q1 = inBall(p, c1, r1), q2 = inBall(p, c2, r2), ok1 = in2(q1), ok2 = in1(q2);
  if (ok1 || ok2) return ok1 && (!ok2 || len(sub(q1, p)) <= len(sub(q2, p))) ? q1 : q2;
  const u = sub(c2, c1), d = len(u), n = scl(u, 1 / d);
  if (d >= r1 + r2) return add(c1, scl(n, (r1 + d - r2) / 2));
  const a = (d * d + r1 * r1 - r2 * r2) / (2 * d), h = Math.sqrt(Math.max(0, r1 * r1 - a * a)), cc = add(c1, scl(n, a));
  let w = sub(p, cc); w = sub(w, scl(n, dot(w, n)));
  if (len(w) < 1e-9) w = cross(Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 0, 1], n);
  return add(cc, scl(norm(w), h));
}
// khoảng cách từ c tới đoạn a + z·d, z0 ≤ z ≤ z1
const segGap = (c, a, d, z0, z1) => { const z = Math.max(z0, Math.min(z1, dot(sub(c, a), d))); return len(sub(c, add(a, scl(d, z)))); };

// Số đo tay của rig (P = rig.p: khớp lúc chạy, khung cha), blade = { guard, tip } của lưỡi (models.js dyn.blade), shell: vỏ đầu
// (models.js dyn.shell, headShell) → số đo cho fitArms; null khi tay trùng số tư thế (rig khối: tư thế giữ nguyên từng số).
export function fitGeo(P, blade = null, shell = 0) {
  const v = (o) => [o.position.x, o.position.y, o.position.z];
  const arm = (s) => { const e = P["el" + s].position, h = P["hand" + s].position; return { L1: Math.hypot(e.x, e.y, e.z), L2: Math.hypot(h.y, h.z), off: Math.atan2(h.z, -h.y) }; };
  const g = { shR: v(P.shR), shL: v(P.shL), R: arm("R"), L: arm("L"), head: v(P.head), blade: blade ? [blade.guard, blade.tip] : [0.16, 1.22],
    sr: Math.max(FIT.sr, shell + FIT.hm), wr: Math.max(FIT.wr, shell) };
  let d = 0;
  for (let k = 0; k < 3; k++) d = Math.max(d, Math.abs(g.shR[k] - SH.R[k]), Math.abs(g.shL[k] - SH.L[k]));
  for (const s of ["R", "L"]) d = Math.max(d, Math.abs(g[s].L1 - ARM.L1), Math.abs(g[s].L2 - ARM.L2), Math.abs(g[s].off - ARM.off));
  return d < 1e-6 ? null : g;
}
const _fk = [0, 0, 0, 0, 0, 0], _ik2 = [0, 0, 0, 0];
// cổ tay W vào tầm tay phải (rR); nắm hai tay (gw: 0 buông … 1 nắm) thì điểm nắm W − GRIP·D cũng trong tầm tay trái
function reach(W, D, g, gw) {
  const rR = FIT.k * (g.R.L1 + g.R.L2), a = inBall(W, g.shR, rR);
  return gw > 0 ? lin(a, 1 - gw, nearest2(W, g.shR, rR, add(g.shL, scl(D, GRIP)), FIT.k * (g.L.L1 + g.L.L2)), gw) : a;
}
// Tư thế p (đã trộn) → o = p với tay phải (shR*, elRx, handRx, handRz) giải theo số đo g (fitGeo). Không cấp phát o.
export function fitArms(p, g, o = {}) {
  Object.assign(o, p);
  // tư thế ở số đo tư thế: cổ tay W, lưỡi D (trục z bàn tay), lưỡi sắc E (trục y), khuỷu (so với vai) — khung thân trên
  const f = elFrame(p.shRx, p.shRy, p.shRz, p.elRx);
  armFK(p.shRx, p.shRy, p.shRz, p.elRx - ARM.off, ARM.L1, ARM.L2, _fk);
  const elP = [_fk[0], _fk[1], _fk[2]], cx = Math.cos(p.handRx), sx = Math.sin(p.handRx), cz = Math.cos(p.handRz), sz = Math.sin(p.handRz);
  let W = add(SH.R, [_fk[3], _fk[4], _fk[5]]), D = lin(f.y, -sx, f.z, cx), E = lin(f.x, -sz, lin(f.y, cx, f.z, sx), cz);
  const gw = Math.min(1, Math.max(0, 2 * (p.grip || 0)));
  const ch = Math.cos(p.headX || 0), shd = Math.sin(p.headX || 0), K = FIT.skull;
  const C = add(g.head, [K[0], ch * K[1] - shd * K[2], shd * K[1] + ch * K[2]]);
  for (let it = 0; it < 8; it++) {
    W = reach(W, D, g, gw);
    const r = sub(C, W), R = len(r);
    if (R < g.wr) { W = R > 1e-9 ? sub(C, scl(r, g.wr / R)) : add(C, [0, 0, g.wr]); continue; }
    if (segGap(C, W, D, g.blade[0], g.blade[1]) >= g.sr - 1e-4) break;
    const need = Math.asin(Math.min(1, g.sr / R)) - Math.acos(Math.max(-1, Math.min(1, dot(r, D) / R)));
    const ax = cross(r, D), al = len(ax);
    if (need <= 0 || al < 1e-9) break;
    D = rotAx(D, scl(ax, 1 / al), need + 1e-3); E = rotAx(E, scl(ax, 1 / al), need + 1e-3);
  }
  return armTo(o, g, reach(W, D, g, gw), D, E, elP, p.handRz);
}
// Sau rig-motion.js fixBlades (cổ tay phải gập thêm cho mũi lưỡi khỏi cắm đất, góc mới hx): giữ lưỡi theo hướng mới, đưa lại cổ tay
// vào tầm với (điểm nắm đổi chỗ theo lưỡi — lính Tự do vai rộng hụt chuôi 1,5–3 cm ở thế bổ đất). q: tư thế đã fitArms.
export function refitArms(q, g, hx, o = {}) {
  Object.assign(o, q);
  const f = elFrame(q.shRx, q.shRy, q.shRz, q.elRx);
  armFK(q.shRx, q.shRy, q.shRz, q.elRx - g.R.off, g.R.L1, g.R.L2, _fk);
  const cx = Math.cos(hx), sx = Math.sin(hx), cz = Math.cos(q.handRz), sz = Math.sin(q.handRz);
  const D = lin(f.y, -sx, f.z, cx), E = lin(f.x, -sz, lin(f.y, cx, f.z, sx), cz);
  return armTo(o, g, reach(add(g.shR, [_fk[3], _fk[4], _fk[5]]), D, g, Math.min(1, Math.max(0, 2 * (q.grip || 0)))), D, E, [_fk[0], _fk[1], _fk[2]], q.handRz);
}
// IK tay phải tới cổ tay W, lưỡi D, lưỡi sắc E → o. Mặt phẳng tay chứa lưỡi (cổ tay chỉ gập quanh x, lật quanh z): khuỷu ở một trong
// hai phía của (vai → cổ tay) trong mặt phẳng đó, lấy phía gần khuỷu elP (so với vai); góc lật gần hz0.
function armTo(o, g, W, D, E, elP, hz0) {
  const v = sub(W, g.shR), n = cross(v, D), side = len(n) > 1e-6 * len(v) ? norm(cross(n, v)) : null;
  let best = -Infinity, a0 = 0, a1 = 0, a2 = 0, a3 = 0;
  for (const pl of side ? [side, scl(side, -1)] : [elP]) {
    armIK(v[0], v[1], v[2], pl[0], pl[1], pl[2], g.R.L1, g.R.L2, _ik2);
    armFK(_ik2[0], _ik2[1], _ik2[2], _ik2[3], g.R.L1, g.R.L2, _fk);
    const s = dot(norm([_fk[0], _fk[1], _fk[2]]), norm(elP));
    if (s > best) { best = s; a0 = _ik2[0]; a1 = _ik2[1]; a2 = _ik2[2]; a3 = _ik2[3]; }
  }
  const ex = a3 + g.R.off, fr = elFrame(a0, a1, a2, ex), hx = Math.atan2(-dot(D, fr.y), dot(D, fr.z));
  let hz = Math.atan2(-dot(E, fr.x), dot(E, lin(fr.y, Math.cos(hx), fr.z, Math.sin(hx))));
  if (hz - hz0 > Math.PI / 2) hz -= Math.PI; else if (hz - hz0 < -Math.PI / 2) hz += Math.PI;   // lưỡi hai mặt sắc: lật ít nhất
  o.shRx = a0; o.shRy = a1; o.shRz = a2; o.elRx = ex; o.handRx = hx; o.handRz = hz;
  return o;
}
