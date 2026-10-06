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
// trong tầm tay trái. Vật cản (khung thân trên): lưới mặt (headShape, khung đầu quay headX: mũ, mặt, cổ, râu theo đầu), lưới cổ
// (bodyShape up: râu theo thân, cổ, cổ áo trên đường vai), thân (bodyShape sl: lát ngang ngực, bụng, hông dưới đường vai − FIT.bc — lát
// mức lưng, hông quay theo phần góc thân) và mặt đất (mặt phẳng rig-motion.js fitPlane tính theo dốc dưới hông). Hai nắm tay (điểm nắm
// tay trái − FIT.fz … chắn tay) cách mặt ≥ FIT.hh, cách cổ ≥ FIT.uh; gốc lưỡi, lưỡi cách mặt, cổ ≥ FIT.hb (nửa bản lưỡi 0,047 + khe),
// ngoài thân ≥ FIT.bb; đuôi chuôi cách mặt ≥ FIT.hb, cổ ≥ FIT.ub; mút chắn tay ≥ FIT.hg, giữa thanh chắn tay ≥ FIT.hgm, ngón tay phải
// ≥ FIT.hf; lưỡi (cả hai mép gần mũi), đuôi chuôi trên đất ≥ FIT.gr.
// Khung đầu (gọi rời, nhảy chỗ): giải toàn cục như soát lần 2 — nghiêng lưỡi (dựng mũi lên trước, rồi quay ra xa tâm sọ), dời hai nắm
// tay ra (pháp tuyến, rồi dò rìa tầm với), còn sát nhiều thì dựng mũi thêm, lật chắn tay. Gọi liên tục (đợt soát 19a lần 3): lời giải
// trước theo chuyển động của tư thế (hướng lưỡi quay đúng góc mà lưỡi tư thế quay, khung bàn tay theo khung tay tư thế, cổ tay giữ độ
// lệch so với đích), kéo dần về đích (tư thế; chạm thì lời giải toàn cục của khung) FIT.rd, rr, rw mỗi khung 1/60 s rồi đẩy ra khỏi
// vật cản tại chỗ — cổ tay theo pháp tuyến, lưỡi nghiêng quanh trục mômen của các điểm thiếu khe (góc nhỏ nhất, FIT.pd), lật chắn tay
// góc nhỏ nhất — không đổi họ lời giải giữa hai khung; kẹt xa đích thì đi thẳng tới đích, cho thiếu khe tới FIT.tr. Mỗi khung lưỡi,
// lưỡi sắc, cổ tay không đổi hơn tư thế quá FIT.cd, ce, cw, lưỡi thật của bàn tay quá FIT.ca, khuỷu quá lim + FIT.eg (fitArms); khuỷu
// giữ phía của khung trước, đổi phía thì dời dần (armPlane); góc gập theo đất của rig-motion.js đổi ≤ FIT.bk mỗi khung.
// Soát lần 1: chỉ đo lưỡi với quả cầu quanh tâm sọ — lính Tự do LINH_r01 thế C1, C4, DQ, ult hai tay cách mặt 0,5–0,6 cm, chuôi
// 1,8 cm (chuôi trong miệng). Soát lần 2: mút chắn tay chĩa vào miệng 1–2 cm, đuôi chuôi trong râu, C6 lưỡi gập xuống sau vai, khuỷu
// nhảy 0,25–0,36 m, bàn tay lật 180°. Soát lần 3 (phát 60 khung / giây nối đòn): giải rời từng khung đổi họ nghiệm — lưỡi bật 60–89°
// một khung (gồng C1, C6, Đòn Quyết, Tuyệt Kỹ, cuối lộn né), lật bàn tay 180° khi nối đòn; râu, cổ áo theo thân lọt chắn tay, chuôi
// 2,6–3 cm; chuôi, chắn tay lún ngực, bụng 400–540 khung; lộn né gập lưỡi theo đất vào đầu 1,5–1,8 cm.
export const FIT = { k: 0.97, wr: 0.14, sr: 0.12, hm: 0.05, skull: [0, 0.13, 0.03], hh: 0.09, hg: 0.07, hb: 0.07, gz: 0.08, it: 4, cell: 0.006,
  gc: 0.02, gm: 0.16, gs: 0.02, fz: 0.07, nx: 0.15, ts: Math.PI / 12, fd: 0.04, hf: 0.06, hc: 0.02,
  ux: 0.14, uh: 0.09, ub: 0.05, hgm: 0.045, gr: 0.035, fc: 0.02, bc: 0.1, bb: 0.005,
  rd: 0.1, rr: 0.14, rw: 0.015, pd: 0.6, cd: 0.3, ce: 0.4, cw: 0.04, tr: 0.01, ew: 0.04, ed: 0.35, ws: 1.0, ws2: 0.1, bdr: 0.4, rf: 0.01, bk: 0.1, eg: 0.01, ca: 0.28, gf: 3 };
// Lưới mặt của thân GLB (head, neck: chỉ số xương đầu, cổ — −1 nếu không có; pos n × 3 khung gắn, si / sw n × 4; hp khớp đầu ở khung
// gắn, chỉ tịnh tiến): đỉnh có xương nặng nhất là đầu, cộng đỉnh mà đầu + cổ nặng ≥ nửa trong |x| ≤ FIT.nx quanh khớp đầu (cổ, râu, cổ áo
// — râu LINH_r01 theo thân, đuôi chuôi lọt vào râu mà lưới đầu không thấy), trừ khớp đầu — pts (Float32Array, một đỉnh mỗi ô FIT.cell);
// grid: bảng khoảng cách tới đỉnh gần nhất (distGrid: ô FIT.gc, phủ hộp đỉnh ± FIT.gm, ≤ FIT.gm — fitArms tra thay vì duyệt từng đỉnh);
// shell: trung vị khoảng cách tâm sọ (hp + FIT.skull) → các đỉnh theo đầu (dùng khi không có pts). Không đỉnh nào: { shell: 0, pts: null,
// grid: null }.
export function headShape(pos, si, sw, head, hp, neck = -1) {
  const c = add(hp, FIT.skull), d = [], pts = [], seen = new Set();
  for (let v = 0; v < pos.length / 3; v++) {
    let q = 0, wh = 0, wt = 0;
    for (let k = 0; k < 4; k++) { const w = sw[v * 4 + k], b = si[v * 4 + k]; wt += w; if (b === head || b === neck) wh += w; if (w > sw[v * 4 + q]) q = k; }
    const own = si[v * 4 + q] === head, x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
    if (!own && !(neck >= 0 && 2 * wh >= wt && Math.abs(x - hp[0]) <= FIT.nx)) continue;
    const key = `${Math.round(x / FIT.cell)},${Math.round(y / FIT.cell)},${Math.round(z / FIT.cell)}`;
    if (own) d.push(Math.hypot(x - c[0], y - c[1], z - c[2]));
    if (seen.has(key)) continue;
    seen.add(key); pts.push(x - hp[0], y - hp[1], z - hp[2]);
  }
  d.sort((a, b) => a - b);
  const P = pts.length ? Float32Array.from(pts) : null;
  return { shell: d.length ? d[d.length >> 1] : 0, pts: P, grid: P ? distGrid(P, FIT.gm) : null };
}
// Thân GLB ngoài đầu (đợt soát 19a lần 3): names tên xương theo chỉ số, inv ma trận gắn nghịch đảo (n × 16, theo cột). Toạ độ khung
// thân: trừ khớp thân lúc gắn (thân, lưng, hông gắn không quay).
//  · up: bảng khoảng cách tới đỉnh trên đường vai − 0,02, |x − x khớp đầu| < FIT.ux, xương nặng nhất không phải đầu, tay, xương đòn —
//    râu theo thân, cổ, cổ áo (lưới mặt chỉ có đỉnh theo đầu, đầu + cổ ≥ nửa: LINH_r01 93 đỉnh râu lọt chắn tay 2,6 cm);
//  · sl: thân (đỉnh theo thân, lưng, hông, xương đòn từ khớp thân − 0,12 tới đường vai − FIT.bc) cắt thành lát ngang (slices) — bodyAt:
//    lưỡi không xuyên ngực, bụng (C6, Tuyệt Kỹ bật nhảy: tay kẹt dưới cằm, lưỡi theo tư thế quay ra sau xuyên ngực, 46 khung lệch tư thế
//    > 90°). Không lấy đỉnh vai: lát sao lấp chỗ lõm giữa cổ và vai, lưỡi gác vai bị coi là trong thân — kẹt (lệch > 90° 86 khung).
// Thiếu xương thân, đầu, vai: null.
export function bodyShape(pos, si, sw, names, inv) {
  const bp = (nm) => {
    const i = names.indexOf(nm); if (i < 0) return null;
    const b = i * 16, t = [inv[b + 12], inv[b + 13], inv[b + 14]];
    return [0, 1, 2].map((r) => -(inv[b + r * 4] * t[0] + inv[b + r * 4 + 1] * t[1] + inv[b + r * 4 + 2] * t[2]));
  };
  const T0 = bp("torso"), H0 = bp("head"), sL = bp("shL"), sR = bp("shR");
  if (!T0 || !H0 || !sL || !sR) return null;
  const shY = (sL[1] + sR[1]) / 2, head = names.indexOf("head"), PH = { torso: 0, clavL: 0, clavR: 0, spine: 0.5, hips: 1 };
  const arms = new Set(["shL", "elL", "handL", "shR", "elR", "handR", "twistL", "twistR", "clavL", "clavR"].map((n) => names.indexOf(n)));
  const up = [], seen = new Set(), body = [];
  for (let v = 0; v < pos.length / 3; v++) {
    let q = 0; for (let k = 1; k < 4; k++) if (sw[v * 4 + k] > sw[v * 4 + q]) q = k;
    const b = si[v * 4 + q], X = pos[v * 3], Y = pos[v * 3 + 1], x = X - T0[0], y = Y - T0[1], z = pos[v * 3 + 2] - T0[2];
    if (b !== head && !arms.has(b) && Y > shY - 0.02 && Math.abs(X - H0[0]) < FIT.ux) {
      const key = `${Math.round(x / FIT.cell)},${Math.round(y / FIT.cell)},${Math.round(z / FIT.cell)}`;
      if (!seen.has(key)) { seen.add(key); up.push(x, y, z); }
    }
    if (PH[names[b]] === undefined || y < -0.12 || Y > shY - FIT.bc) continue;
    let wp = 0, ws = 0;
    for (let k = 0; k < 4; k++) { const f = PH[names[si[v * 4 + k]]]; if (f !== undefined) { wp += sw[v * 4 + k] * f; ws += sw[v * 4 + k]; } }
    body.push(x, y, z, wp / ws);
  }
  return { up: up.length ? distGrid(Float32Array.from(up), FIT.gm) : null, sl: body.length ? slices(body) : null };
}
// Bảng khoảng cách (ô FIT.gc, phủ hộp P ± m, cắt ở m) tới điểm gần nhất trong P (n × 3): mỗi điểm gieo đúng khoảng cách vào 6 × 6 × 6 ô
// quanh nó, rồi lan "điểm gần nhất" sang 26 ô kề, một lượt quét xuôi một lượt ngược (so với duyệt hết: sai ≤ 1,5 mm trong 10 cm, ≤ 2,5 mm
// tới m — rig-glb.test.mjs; gieo 8 ô thì sai 5–7 mm). Trước đây rải mỗi điểm vào mọi ô trong bán kính m: 65–104 ms lần đầu dựng mỗi rig
// WC01 (soát 19a lần 3).
function distGrid(P, m) {
  const s = FIT.gc, lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], P[i + k]); hi[k] = Math.max(hi[k], P[i + k]); }
  const o = lo.map((x) => x - m), n = lo.map((x, k) => Math.ceil((hi[k] - x + 2 * m) / s) + 1), N = n[0] * n[1] * n[2];
  const d = new Float32Array(N).fill(Infinity), id = new Int32Array(N).fill(-1);
  const put = (j, a, b, e, i) => {
    const x = o[0] + a * s - P[i], y = o[1] + b * s - P[i + 1], z = o[2] + e * s - P[i + 2], t = Math.sqrt(x * x + y * y + z * z);
    if (t < d[j]) { d[j] = t; id[j] = i; }
  };
  for (let i = 0; i < P.length; i += 3) {
    const a0 = Math.floor((P[i] - o[0]) / s), b0 = Math.floor((P[i + 1] - o[1]) / s), e0 = Math.floor((P[i + 2] - o[2]) / s);
    for (let a = Math.max(0, a0 - 2); a <= Math.min(n[0] - 1, a0 + 3); a++) for (let b = Math.max(0, b0 - 2); b <= Math.min(n[1] - 1, b0 + 3); b++)
      for (let e = Math.max(0, e0 - 2); e <= Math.min(n[2] - 1, e0 + 3); e++) put((a * n[1] + b) * n[2] + e, a, b, e, i);
  }
  const ka = [], kb = [], ke = [];
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let e = -1; e <= 1; e++) if (a < 0 || (a === 0 && (b < 0 || (b === 0 && e < 0)))) { ka.push(a); kb.push(b); ke.push(e); }
  for (const sg of [1, -1]) {
    for (let a = sg > 0 ? 0 : n[0] - 1; a >= 0 && a < n[0]; a += sg) for (let b = sg > 0 ? 0 : n[1] - 1; b >= 0 && b < n[1]; b += sg)
      for (let e = sg > 0 ? 0 : n[2] - 1; e >= 0 && e < n[2]; e += sg) {
        const j = (a * n[1] + b) * n[2] + e;
        for (let q = 0; q < 13; q++) {
          const A2 = a + sg * ka[q], B2 = b + sg * kb[q], E2 = e + sg * ke[q];
          if (A2 < 0 || B2 < 0 || E2 < 0 || A2 >= n[0] || B2 >= n[1] || E2 >= n[2]) continue;
          const i = id[(A2 * n[1] + B2) * n[2] + E2];
          if (i >= 0 && i !== id[j]) put(j, a, b, e, i);
        }
      }
  }
  for (let j = 0; j < N; j++) if (d[j] > m) d[j] = m;
  return { o, n, d };
}
// Lát ngang của thân (B: n × 4 — x, y, z khung thân, phần góc thân φ: thân, xương đòn 0, lưng 0,5 — khung lưng quay nửa góc thân —, hông
// 1, theo trọng số da): lát i phủ y0 + i·FIT.fc … + FIT.fc; tâm = giữa hộp (x, z) các đỉnh của lát; r[i·SECT + j] = khoảng cách xa nhất
// tới tâm của các đỉnh theo hướng j (hướng trống: trung bình hai hướng kề có số) — lát hình sao; lv = φ trung bình làm tròn về LV mức.
// (Mỗi xương một mặt trước / sau thì thủng: mặt trước ngực có chỗ theo đòn, chỗ theo lưng.) Đo trên lưới da: 90% đỉnh thân cách mặt lát
// trong −5,5 … +1,5 cm.
const SECT = 32, LV = 5;
function slices(B) {
  const c = FIT.fc;
  let y0 = Infinity, y1 = -Infinity;
  for (let i = 1; i < B.length; i += 4) { y0 = Math.min(y0, B[i]); y1 = Math.max(y1, B[i]); }
  const n = Math.max(1, Math.ceil((y1 - y0) / c + 1e-6)), at = (y) => Math.min(n - 1, Math.floor((y - y0) / c));
  const lo = new Float32Array(2 * n).fill(Infinity), hi = new Float32Array(2 * n).fill(-Infinity), ph = new Float32Array(n), cnt = new Int32Array(n);
  for (let i = 0; i < B.length; i += 4) {
    const s = at(B[i + 1]);
    lo[2 * s] = Math.min(lo[2 * s], B[i]); hi[2 * s] = Math.max(hi[2 * s], B[i]); lo[2 * s + 1] = Math.min(lo[2 * s + 1], B[i + 2]); hi[2 * s + 1] = Math.max(hi[2 * s + 1], B[i + 2]);
    ph[s] += B[i + 3]; cnt[s]++;
  }
  const cx = new Float32Array(n), cz = new Float32Array(n), r = new Float32Array(n * SECT), lv = new Int8Array(n).fill(-1);
  for (let s = 0; s < n; s++) if (cnt[s]) { cx[s] = (lo[2 * s] + hi[2 * s]) / 2; cz[s] = (lo[2 * s + 1] + hi[2 * s + 1]) / 2; lv[s] = Math.round((ph[s] / cnt[s]) * (LV - 1)); }
  for (let i = 0; i < B.length; i += 4) {
    const s = at(B[i + 1]), dx = B[i] - cx[s], dz = B[i + 2] - cz[s], j = Math.floor(((Math.atan2(dz, dx) / TAU) * SECT + SECT) % SECT) % SECT;
    r[s * SECT + j] = Math.max(r[s * SECT + j], Math.hypot(dx, dz));
  }
  for (let s = 0; s < n; s++) for (let pass = 0; pass < SECT && cnt[s]; pass++) {
    let empty = 0;
    for (let j = 0; j < SECT; j++) {
      if (r[s * SECT + j] > 0) continue;
      const a = r[s * SECT + ((j + SECT - 1) % SECT)], b = r[s * SECT + ((j + 1) % SECT)];
      if (a > 0 || b > 0) r[s * SECT + j] = a > 0 && b > 0 ? (a + b) / 2 : Math.max(a, b); else empty++;
    }
    if (!empty) break;
  }
  return { y0, n, cx, cz, r, lv };
}
// khoảng cách (nội suy ba chiều) từ điểm (x, y, z) tới bảng distGrid; ngoài bảng: FIT.gm
function gridAt(G, x, y, z) {
  const s = FIT.gc, fx = (x - G.o[0]) / s, fy = (y - G.o[1]) / s, fz = (z - G.o[2]) / s, n = G.n;
  if (!(fx >= 0 && fy >= 0 && fz >= 0 && fx < n[0] - 1 && fy < n[1] - 1 && fz < n[2] - 1)) return FIT.gm;
  const a = fx | 0, b = fy | 0, e = fz | 0, u = fx - a, v = fy - b, w = fz - e, d = G.d, j = (a * n[1] + b) * n[2] + e, J = n[1] * n[2];
  const c00 = d[j] * (1 - w) + d[j + 1] * w, c01 = d[j + n[2]] * (1 - w) + d[j + n[2] + 1] * w;
  const c10 = d[j + J] * (1 - w) + d[j + J + 1] * w, c11 = d[j + J + n[2]] * (1 - w) + d[j + J + n[2] + 1] * w;
  return (c00 * (1 - v) + c01 * v) * (1 - u) + (c10 * (1 - v) + c11 * v) * u;
}
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scl = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const lin = (a, ka, b, kb) => [a[0] * ka + b[0] * kb, a[1] * ka + b[1] * kb, a[2] * ka + b[2] * kb];
// quay v quanh trục đơn vị k một góc th (Rodrigues)
const rotAx = (v, k, th) => { const c = Math.cos(th), s = Math.sin(th); return add(lin(v, c, cross(k, v), s), scl(k, dot(k, v) * (1 - c))); };
const angOf = (a, b) => Math.atan2(len(cross(a, b)), dot(a, b));
// v vuông góc với đơn vị d, chuẩn hoá (suy biến: giữ v)
const perpN = (v, d) => { const w = sub(v, scl(d, dot(v, d))), l = len(w); return l > 1e-9 ? scl(w, 1 / l) : v; };
// quay v theo phép quay ngắn nhất đưa đơn vị a tới đơn vị b
const swing = (v, a, b) => { const k = cross(a, b), s = len(k); return s > 1e-9 ? rotAx(v, scl(k, 1 / s), Math.atan2(s, dot(a, b))) : v; };
// quay v theo phép quay đưa khung trực chuẩn (a0, b0) tới (a1, b1)
const xfer = (v, a0, b0, a1, b1) => { const c0 = cross(a0, b0), c1 = cross(a1, b1), x = dot(v, a0), y = dot(v, b0), z = dot(v, c0); return add(lin(a1, x, b1, y), scl(c1, z)); };
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

// Số đo tay của rig (P = rig.p: khớp lúc chạy, khung cha), blade = { guard, tip, butt } của gươm (models.js dyn.blade: chắn tay, mũi,
// núm chuôi, mút chắn tay), head = { shell, pts, grid, hand, body } lưới mặt (models.js dyn.head: headShape), ngón tay phải (handPts),
// thân (bodyShape) → số đo cho fitArms; null khi tay trùng số tư thế (rig khối: tư thế giữ nguyên từng số).
export function fitGeo(P, blade = null, head = null) {
  const shell = head ? head.shell : 0;
  const v = (o) => [o.position.x, o.position.y, o.position.z];
  const arm = (s) => { const e = P["el" + s].position, h = P["hand" + s].position; return { L1: Math.hypot(e.x, e.y, e.z), L2: Math.hypot(h.y, h.z), off: Math.atan2(h.z, -h.y) }; };
  const g = { shR: v(P.shR), shL: v(P.shL), R: arm("R"), L: arm("L"), head: v(P.head), blade: blade ? [blade.guard, blade.tip] : [0.16, 1.22],
    butt: blade?.butt ?? -0.32, gp: blade?.gp || null, pts: head?.pts || null, grid: head?.grid || null, hp: head?.hand || null,
    up: head?.body?.up || null, sl: head?.body?.sl || null, sr: Math.max(FIT.sr, shell + FIT.hm), wr: Math.max(FIT.wr, shell) };
  let d = 0;
  for (let k = 0; k < 3; k++) d = Math.max(d, Math.abs(g.shR[k] - SH.R[k]), Math.abs(g.shL[k] - SH.L[k]));
  for (const s of ["R", "L"]) d = Math.max(d, Math.abs(g[s].L1 - ARM.L1), Math.abs(g[s].L2 - ARM.L2), Math.abs(g[s].off - ARM.off));
  return d < 1e-6 ? null : g;
}
const _fk = [0, 0, 0, 0, 0, 0], _ik2 = [0, 0, 0, 0];
const TILT_MAX = Math.PI / 2;
// Ngữ cảnh vật cản của tư thế p: headX (ch, shd), tâm sọ C (khung thân), mặt đất gp = [nx, ny, nz, d] (độ cao trên đất của điểm khung
// thân x = n·x + d; null: không xét), zf: đầu dưới vùng nắm tay dọc cán — nắm hai tay thì tới điểm nắm tay trái − FIT.fz, buông (grip 0:
// Hịch, Binh Thư, chạy vác gươm) chỉ nắm tay phải; phần cán dưới đó tính như đuôi chuôi (nghiêng được, khe FIT.hb).
// rl: LV ma trận (theo hàng) quay phần k / (LV − 1) góc thân (khung thân → khung lát thân mức k; bodyAt).
function fitCtx(p, g, gp) {
  const ch = Math.cos(p.headX || 0), shd = Math.sin(p.headX || 0), K = FIT.skull, gw = Math.min(1, Math.max(0, 2 * (p.grip || 0)));
  const H = { ch, shd, C: add(g.head, [K[0], ch * K[1] - shd * K[2], shd * K[1] + ch * K[2]]), gp, zf: -GRIP * gw - FIT.fz, rl: null };
  if (g.sl) {
    const a = Math.cos((p.torsoX || 0) / 2), b = Math.sin((p.torsoX || 0) / 2), c = Math.cos((p.torsoY || 0) / 2), d = Math.sin((p.torsoY || 0) / 2);
    const e = Math.cos((p.torsoZ || 0) / 2), f = Math.sin((p.torsoZ || 0) / 2);
    // quaternion của Rx·Ry·Rz (như three Euler "XYZ") → trục, góc
    let qx = b * c * e + a * d * f, qy = a * d * e - b * c * f, qz = a * c * f + b * d * e, qw = a * c * e - b * d * f;
    if (qw < 0) { qx = -qx; qy = -qy; qz = -qz; qw = -qw; }
    const s = Math.hypot(qx, qy, qz), th = 2 * Math.atan2(s, qw), [x, y, z] = s > 1e-9 ? [qx / s, qy / s, qz / s] : [1, 0, 0];
    H.rl = [];
    for (let i = 0; i < LV; i++) {
      const tt = (th * i) / (LV - 1), C = Math.cos(tt), S = Math.sin(tt), U = 1 - C;
      H.rl.push([C + x * x * U, x * y * U - z * S, x * z * U + y * S, y * x * U + z * S, C + y * y * U, y * z * U - x * S, z * x * U - y * S, z * y * U + x * S, C + z * z * U]);
    }
  }
  return H;
}
// khoảng cách từ điểm khung thân tới lưới mặt (bảng g.grid, khung khớp đầu: trừ g.head, quay ngược headX)
function headAt(g, H, x, y, z) {
  if (!g.grid) return FIT.gm;
  const vx = x - g.head[0], vy = y - g.head[1], vz = z - g.head[2];
  return gridAt(g.grid, vx, H.ch * vy + H.shd * vz, -H.shd * vy + H.ch * vz);
}
const upAt = (g, x, y, z) => (g.up ? gridAt(g.up, x, y, z) : FIT.gm);
// khe ra ngoài thân (lát g.sl) của điểm khung thân: mỗi mức k, quay điểm về khung mức đó (H.rl), lát chứa độ cao của nó mà cùng mức →
// khoảng cách ngang tới tâm lát trừ bán kính theo hướng (dương ngoài, âm trong thân); nhỏ nhất qua các mức; không lát nào: 9
function bodyAt(g, H, x, y, z) {
  const L = g.sl;
  if (!L || !H.rl) return 9;
  let s = 9;
  for (let k = 0; k < LV; k++) {
    const R = H.rl[k], qy = R[3] * x + R[4] * y + R[5] * z, i = Math.floor((qy - L.y0) / FIT.fc);
    if (i < 0 || i >= L.n || L.lv[i] !== k) continue;
    const dx = R[0] * x + R[1] * y + R[2] * z - L.cx[i], dz = R[6] * x + R[7] * y + R[8] * z - L.cz[i];
    const f = ((Math.atan2(dz, dx) / TAU) * SECT + SECT) % SECT, j = Math.floor(f) % SECT, u = f - Math.floor(f);
    s = Math.min(s, Math.hypot(dx, dz) - (L.r[i * SECT + j] * (1 - u) + L.r[i * SECT + ((j + 1) % SECT)] * u));
  }
  return s;
}
const groundAt = (H, x, y, z) => (H.gp ? H.gp[0] * x + H.gp[1] * y + H.gp[2] * z + H.gp[3] : 9);
// Thiếu khe của điểm (x, y, z) khung thân theo vùng — 0 nắm tay (mặt FIT.hh, cổ uh), 1 gốc lưỡi (mặt + cổ hb, nhân hh / hb cho cùng
// thang với nắm tay), 2 lưỡi (mặt + cổ hb, đất gr, thân bb), 3 đuôi chuôi (mặt hb, cổ ub, đất gr), 4 mút chắn tay (mặt + cổ hg), 5 ngón
// tay (mặt + cổ hf), 6 giữa thanh chắn tay (mặt + cổ hgm). _why: vật cản thiếu nhiều nhất (0 mặt, 1 cổ, 2 thân, 3 đất) — pháp tuyến đẩy
// ra (gradAt). Đuôi chuôi, chắn tay không xét thân: thế thủ của tư thế để núm chuôi trong bụng thân GLB (tay ở rìa tầm với) — đẩy ra
// phải dựng lưỡi thêm ~40° (đổi thiết kế); xét thân ở ngực thì kẹt nhiều hơn (lệch tư thế > 90° 51–207 khung, đo soát lần 3).
let _why = 0;
function defAt(g, H, x, y, z, zone) {
  const dh = headAt(g, H, x, y, z), du = upAt(g, x, y, z), dm = Math.min(dh, du);
  let e, w = dh <= du ? 0 : 1, t;
  if (zone === 0) { e = FIT.hh - dh; w = 0; t = FIT.uh - du; if (t > e) { e = t; w = 1; } }
  else if (zone === 1) e = ((FIT.hb - dm) * FIT.hh) / FIT.hb;
  else if (zone === 3) { e = FIT.hb - dh; w = 0; t = FIT.ub - du; if (t > e) { e = t; w = 1; } }
  else e = (zone === 4 ? FIT.hg : zone === 5 ? FIT.hf : zone === 6 ? FIT.hgm : FIT.hb) - dm;
  if (zone === 2 || zone === 3) { t = FIT.gr - groundAt(H, x, y, z); if (t > e) { e = t; w = 3; } }
  if (zone === 2 && g.sl && H.rl) { t = FIT.bb - bodyAt(g, H, x, y, z); if (t > e) { e = t; w = 2; } }
  _why = w;
  return e;
}
const fieldAt = (g, H, w, x, y, z) => (w === 0 ? headAt(g, H, x, y, z) : w === 1 ? upAt(g, x, y, z) : w === 2 ? bodyAt(g, H, x, y, z) : groundAt(H, x, y, z));
// hướng ra xa vật cản w ở điểm P (khung thân): sai phân trung tâm, đơn vị; lưới mặt mà hướng chĩa vào tâm sọ (điểm đã lọt qua lớp
// đỉnh) thì lấy hướng từ tâm sọ; không ra hướng: null
function gradAt(g, H, w, P) {
  const e = FIT.gc / 2, f = (x, y, z) => fieldAt(g, H, w, P[0] + x, P[1] + y, P[2] + z);
  let n = [f(e, 0, 0) - f(-e, 0, 0), f(0, e, 0) - f(0, -e, 0), f(0, 0, e) - f(0, 0, -e)];
  if (w === 0 && dot(n, sub(P, H.C)) < 0) n = sub(P, H.C);
  const l = len(n);
  return l > 1e-9 ? scl(n, 1 / l) : null;
}
// Mẫu dọc trục gươm (cổ tay W, lưỡi D): fistGap — hai nắm tay (điểm nắm tay trái − FIT.fz … chắn tay) và gốc lưỡi (… chắn tay + FIT.gz):
// phần đi theo cổ tay, nghiêng / lật gươm không đổi được; tiltGap — lưỡi (từ chắn tay + gz) và đuôi chuôi dưới nắm tay trái: phần
// nghiêng gươm quanh cổ tay đổi được. Trả thiếu khe lớn nhất (≥ 1e-4).
function fistGap(g, H, W, D) {
  const z0 = H.zf, z1 = g.blade[0] + FIT.gz, n = Math.ceil((z1 - z0) / FIT.gs);
  let e = 1e-4;
  for (let i = 0; i <= n; i++) {
    const z = z0 + ((z1 - z0) * i) / n;
    e = Math.max(e, defAt(g, H, W[0] + D[0] * z, W[1] + D[1] * z, W[2] + D[2] * z, z < g.blade[0] ? 0 : 1));
  }
  return e;
}
function tiltGap(g, H, W, D, E = null) {
  const z0 = g.blade[0] + FIT.gz, zf = H.zf, nb = Math.ceil((g.blade[1] - z0) / FIT.gs), np = Math.max(1, Math.ceil((zf - g.butt) / FIT.gs));
  let e = 1e-4;
  for (let i = 0; i <= nb; i++) { const z = z0 + ((g.blade[1] - z0) * i) / nb; e = Math.max(e, defAt(g, H, W[0] + D[0] * z, W[1] + D[1] * z, W[2] + D[2] * z, 2)); }
  for (let i = 0; i <= np; i++) { const z = g.butt + ((zf - g.butt) * i) / np; e = Math.max(e, defAt(g, H, W[0] + D[0] * z, W[1] + D[1] * z, W[2] + D[2] * z, 3)); }
  // hai mép lưỡi gần mũi (như điểm fixBlades của gươm GLB, models.js: ±0,065 theo lưỡi sắc, 0,2 dưới mũi) trên đất
  if (E && H.gp) for (const s of [0.065, -0.065]) { const P = add(W, lin(E, s, D, g.blade[1] - 0.2)); e = Math.max(e, FIT.gr - groundAt(H, P[0], P[1], P[2])); }
  return e;
}
// hướng dời cổ tay ra xa vật cản: tổng pháp tuyến (nhân độ thiếu) ở các mẫu nắm tay / gốc lưỡi còn thiếu khe (E: cả các mút chắn tay),
// vuông góc lưỡi; không ra hướng thì từ tâm sọ C. null: không có hướng.
function pushDir(g, H, W, D, C, E = null) {
  const z0 = H.zf, z1 = g.blade[0] + FIT.gz, n = Math.ceil((z1 - z0) / FIT.gs);
  let u = [0, 0, 0];
  const at = (P, zone) => { const e = defAt(g, H, P[0], P[1], P[2], zone); if (e > 1e-4) { const q = gradAt(g, H, _why, P); if (q) u = add(u, scl(q, e)); } };
  for (let i = 0; i <= n; i++) { const z = z0 + ((z1 - z0) * i) / n; at(add(W, scl(D, z)), z < g.blade[0] ? 0 : 1); }
  if (E && g.gp) {
    const X = cross(E, D);
    for (const [k, zone] of [[1, 4], [0.5, 6], [0.75, 6]]) for (let j = 0; j < g.gp.length; j += 3) at(add(W, add(lin(X, g.gp[j] * k, E, g.gp[j + 1] * k), scl(D, g.gp[j + 2]))), zone);
  }
  u = sub(u, scl(D, dot(u, D)));
  if (len(u) < 1e-9) { u = sub(W, C); u = sub(u, scl(D, dot(u, D))); }
  return len(u) < 1e-9 ? null : norm(u);
}
// Giải toàn cục: hai nắm tay / gốc lưỡi sát mặt thì dời cổ tay ra theo pushDir tới khi tầm với kéo lại (không đỡ hơn); còn thiếu thì dò
// rìa tầm với (searchW).
function clearFists(g, H, W, W0, D, gw, C) {
  let f = fistGap(g, H, W, D);
  for (let it = 0; it < FIT.it && f > 1e-4; it++) {
    const u = pushDir(g, H, W, D, C);
    if (!u) break;
    const Wn = reach(add(W, scl(u, f + 2e-3)), D, g, gw), fn = fistGap(g, H, Wn, D);
    if (fn > f - 1e-3) break;
    W = Wn; f = fn;
  }
  return f > 1e-4 ? searchW(g, H, W, W0, D, gw) : W;
}
// Giải tại chỗ: hai nắm tay / gốc lưỡi (E: cả mút chắn tay) sát vật cản thì dời cổ tay theo pushDir — cổ tay ở rìa tầm tay phải (hay điểm
// nắm ở rìa tầm tay trái) thì trượt trên mặt cầu tầm với (bỏ phần hướng ra ngoài cầu; cả hai thì theo tiếp tuyến của đường giao) thay vì
// bị tầm với kéo lại chỗ cũ; tới FIT.it bước, dừng khi không đỡ hơn.
function slideFists(g, H, W, D, E, gw, C) {
  const gap = (Wx) => Math.max(fistGap(g, H, Wx, D), E ? guardGap(g, H, Wx, D, E) : 0);
  let f = gap(W);
  for (let it = 0; it < FIT.it && f > 1e-4; it++) {
    let u = pushDir(g, H, W, D, C, E);
    if (!u) break;
    const a = sub(W, g.shR), la = len(a), n1 = la >= FIT.k * (g.R.L1 + g.R.L2) - 1e-3 ? scl(a, 1 / la) : null;
    const b = sub(sub(W, scl(D, GRIP)), g.shL), lb = len(b), n2 = gw > 0 && lb >= FIT.k * (g.L.L1 + g.L.L2) - 1e-3 ? scl(b, 1 / lb) : null;
    if (n1 && n2 && (dot(u, n1) > 0 || dot(u, n2) > 0)) { const k = cross(n1, n2), lk = len(k); u = lk > 1e-6 ? scl(k, dot(u, k) / (lk * lk)) : [0, 0, 0]; }
    else { if (n1 && dot(u, n1) > 0) u = sub(u, scl(n1, dot(u, n1))); if (n2 && dot(u, n2) > 0) u = sub(u, scl(n2, dot(u, n2))); }
    if (len(u) < 1e-6) break;
    const un = norm(u);
    let Wn = reach(add(W, scl(un, f + 2e-3)), D, g, gw), fn = gap(Wn);
    if (fn > f - 1e-3) break;
    if (fn <= 1e-4) {      // hết chạm: bước ngắn nhất còn hết chạm (chia đôi) — đẩy vừa đủ, cổ tay không giật qua lại giữa các khung
      let lo = 0, hi = f + 2e-3;
      for (let i = 0; i < 5; i++) { const m = (lo + hi) / 2, Wm = reach(add(W, scl(un, m)), D, g, gw); if (gap(Wm) <= 1e-4) { hi = m; Wn = Wm; } else lo = m; }
      fn = gap(Wn);
    }
    W = Wn; f = fn;
  }
  return W;
}
// Hai nắm tay còn sát mặt ở rìa tầm với (dời theo pháp tuyến bị tầm với kéo lại): dò quanh cổ tay W trên mặt phẳng tiếp xúc cầu tầm tay
// phải (RING × 8 hướng, rồi vào tầm với) chỗ đủ khe gần cổ tay của tư thế W0 nhất (thế giơ qua đầu: cao nhất có thể), chia đôi đoạn
// W → chỗ đó tìm mép đủ khe; không chỗ nào đủ khe thì chỗ khe rộng nhất.
const RING = [0.04, 0.08, 0.12, 0.16];
function searchW(g, H, W, W0, D, gw) {
  const n = norm(sub(W, g.shR)), a = norm(cross(n, Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])), b = cross(n, a);
  let best = { W, f: fistGap(g, H, W, D), d: len(sub(W, W0)) };
  for (const r of RING) for (let k = 0; k < 8; k++) {
    const t = (k * Math.PI) / 4, c = reach(add(W, lin(a, r * Math.cos(t), b, r * Math.sin(t))), D, g, gw), f = fistGap(g, H, c, D), d = len(sub(c, W0));
    if (f <= 1e-4 ? best.f > 1e-4 || d < best.d : best.f > 1e-4 && f < best.f - 1e-4) best = { W: c, f, d };
  }
  if (best.f > 1e-4 || best.W === W) return best.W;
  let lo = 0, hi = 1;
  for (let i = 0; i < 5; i++) { const m = (lo + hi) / 2; if (fistGap(g, H, reach(lin(W, 1 - m, best.W, m), D, g, gw), D) > 1e-4) lo = m; else hi = m; }
  return reach(lin(W, 1 - hi, best.W, hi), D, g, gw);
}
// thiếu khe lớn nhất ở các mút chắn tay (g.gp: điểm khung bàn tay — x = E × D, y = E, z = D; chắn tay đối xứng nên E hay −E như nhau),
// giữa thanh chắn tay (nửa, ba phần tư đường từ trục ra mút: cần FIT.hgm — lộn né: mút cách cổ áo 6 cm mà giữa thanh lọt 2 cm) và ở ngón
// tay phải (g.hp, khung bàn tay với lưỡi sắc thật Ee — ngón duỗi theo −y tới 0,13)
function guardGap(g, H, W, D, E, Ee = null) {
  let e = 1e-4;
  const pts = (P, Y, zone, k = 1) => {
    const X = cross(Y, D);
    for (let j = 0; j < P.length; j += 3) {
      const a = P[j] * k, b = P[j + 1] * k, c = P[j + 2];
      e = Math.max(e, defAt(g, H, W[0] + X[0] * a + Y[0] * b + D[0] * c, W[1] + X[1] * a + Y[1] * b + D[1] * c, W[2] + X[2] * a + Y[2] * b + D[2] * c, zone));
    }
  };
  if (g.gp) { pts(g.gp, E, 4); pts(g.gp, E, 6, 0.5); pts(g.gp, E, 6, 0.75); }
  if (g.hp && Ee) pts(g.hp, Ee, 5);
  return e;
}
// Giải toàn cục (khung đầu). Hướng gươm ở cổ tay W: góc nhỏ nhất từ hướng của tư thế D0 (lưỡi sắc E0) cho lưỡi và đuôi chuôi hết chạm
// (tiltGap) — trước trong mặt phẳng đứng của lưỡi, chỉ chiều dựng mũi lên (chiều kia gập lưỡi xuống sau gáy, xuyên lưng), rồi quay quanh
// trục ra xa tâm sọ C (hai chiều); dò từng FIT.ts tới 90°, chia đôi bước cuối; không góc nào hết chạm thì góc thiếu ít nhất. Trả [D, E].
function tiltFrom(g, H, W, D0, E0, C) {
  const e0 = tiltGap(g, H, W, D0);
  if (e0 <= 1e-4) return [D0, E0];
  const p = cross(D0, [0, 1, 0]), q = cross(sub(C, W), D0), groups = [];
  if (len(p) > 0.2) { const k = norm(p); groups.push([rotAx(D0, k, 0.1)[1] < rotAx(D0, scl(k, -1), 0.1)[1] ? scl(k, -1) : k]); }
  if (len(q) > 0.2) { const k = norm(q); groups.push([k, scl(k, -1)]); }
  let fall = { e: e0, k: null, a: 0 };
  for (const grp of groups) {
    let hit = null;
    for (const k of grp) {
      let prev = 0;
      for (let a = FIT.ts; a < TILT_MAX + 1e-6 && (!hit || a < hit.a); a += FIT.ts) {
        const e = tiltGap(g, H, W, rotAx(D0, k, a));
        if (e <= 1e-4) {
          let lo = prev, hi = a;
          for (let i = 0; i < 5; i++) { const mid = (lo + hi) / 2; if (tiltGap(g, H, W, rotAx(D0, k, mid)) > 1e-4) lo = mid; else hi = mid; }
          hit = { k, a: hi };
          break;
        }
        if (e < fall.e - 1e-4) fall = { e, k, a };
        prev = a;
      }
    }
    if (hit) return [rotAx(D0, hit.k, hit.a), rotAx(E0, hit.k, hit.a)];
  }
  return fall.k ? [rotAx(D0, fall.k, fall.a), rotAx(E0, fall.k, fall.a)] : [D0, E0];
}
// Lật gươm quanh trục (E quanh D) góc nhỏ nhất cho các mút chắn tay và ngón tay phải hết chạm (guardGap; eff: E → lưỡi sắc thật của bàn
// tay theo nhánh armTo sẽ chọn): gươm dựng trước mặt thì chắn tay nằm ngang hai bên mặt, ngón tay không duỗi vào mặt. Dò cả hai chiều
// (tới amax, mỗi bước amax / 12; ngón tay không đối xứng), lấy góc nhỏ hơn; không góc nào hết chạm thì góc thiếu ít nhất. Trả E.
function rollFrom(g, H, W, D, E, eff, amax = Math.PI) {
  const gap = (Ec) => guardGap(g, H, W, D, Ec, eff(Ec)), e0 = gap(E), st = amax / 12;
  if (e0 <= 1e-4) return E;
  let fall = { e: e0, a: 0 }, best = null;
  for (const sg of [1, -1]) {
    let prev = 0;
    for (let a = st; a < amax + 1e-6 && (!best || a < best.a); a += st) {
      const e = gap(rotAx(E, D, sg * a));
      if (e <= 1e-4) {
        let lo = prev, hi = a;
        for (let i = 0; i < 5; i++) { const mid = (lo + hi) / 2; if (gap(rotAx(E, D, sg * mid)) > 1e-4) lo = mid; else hi = mid; }
        if (!best || hi < best.a) best = { E: rotAx(E, D, sg * hi), a: hi };
        break;
      }
      if (e < fall.e - 1e-4) fall = { e, a: sg * a };
      prev = a;
    }
  }
  return best ? best.E : fall.a ? rotAx(E, D, fall.a) : E;
}
// Giải tại chỗ (gọi liên tục): lưỡi, đuôi chuôi còn thiếu khe thì nghiêng (D, E) quanh trục mômen của các mẫu thiếu (tổng z · (D × pháp
// tuyến) · thiếu), chiều ngược lại, hay trục dựng mũi lên — mỗi trục góc nhỏ nhất hết chạm tới FIT.pd; lấy giá nhỏ nhất: góc, nhân 3 nếu
// quay ngược chiều kp (chiều tư thế đang quay lưỡi — gươm vướng đầu thì vượt qua đầu chứ không lùi lại: Tuyệt Kỹ nhát 3 lưỡi kẹt sau gáy
// 115° khi tư thế đã bổ ra trước); không trục nào hết chạm thì góc thiếu ít nhất (nếu đỡ hơn). Trả [D, E].
function tiltLocal(g, H, W, D, E, kp = null) {
  const e0 = tiltGap(g, H, W, D, E);
  if (e0 <= 1e-4) return [D, E];
  const z0 = g.blade[0] + FIT.gz, zf = H.zf, nb = Math.ceil((g.blade[1] - z0) / FIT.gs), np = Math.max(1, Math.ceil((zf - g.butt) / FIT.gs));
  let t = [0, 0, 0], eg = 0, eo = 0;
  const acc = (z, zone) => {
    const P = add(W, scl(D, z)), e = defAt(g, H, P[0], P[1], P[2], zone);
    if (e > 1e-4) { if (_why === 3) eg += e; else eo += e; const n = gradAt(g, H, _why, P); if (n) t = add(t, scl(cross(D, n), e * z)); }
  };
  for (let i = 0; i <= nb; i++) acc(z0 + ((g.blade[1] - z0) * i) / nb, 2);
  for (let i = 0; i <= np; i++) acc(g.butt + ((zf - g.butt) * i) / np, 3);
  if (H.gp) for (const s of [0.065, -0.065]) {
    const r = lin(E, s, D, g.blade[1] - 0.2), P = add(W, r), e = FIT.gr - groundAt(H, P[0], P[1], P[2]);
    if (e > 1e-4) { t = add(t, scl(cross(r, H.gp), e)); eg += e; }
  }
  if (eg > eo) kp = null;          // chạm đất là chính: dừng ở đất (lùi lại được), không vòng qua
  if (len(t) < 1e-9) { t = cross(D, sub(add(W, scl(D, 0.5)), H.C)); if (len(t) < 1e-9) return [D, E]; }
  const k = norm(t), st = FIT.pd / 8, up = cross(D, [0, 1, 0]), axes = [k, scl(k, -1)];
  if (len(up) > 0.2) axes.push(norm(up));
  let best = null, fall = { e: e0, k, a: 0 };
  for (const kk of axes) {
    const w = kp ? 1 + 2 * Math.max(0, -dot(kk, kp)) : 1;
    let prev = 0;
    for (let a = st; a < FIT.pd + 1e-6 && (!best || a * w < best.c); a += st) {
      const e = tiltGap(g, H, W, rotAx(D, kk, a), rotAx(E, kk, a));
      if (e <= 1e-4) {
        let lo = prev, hi = a;
        for (let i = 0; i < 5; i++) { const m = (lo + hi) / 2; if (tiltGap(g, H, W, rotAx(D, kk, m), rotAx(E, kk, m)) > 1e-4) lo = m; else hi = m; }
        if (!best || hi * w < best.c) best = { k: kk, a: hi, c: hi * w };
        break;
      }
      if (e < fall.e - 1e-4) fall = { e, k: kk, a };
      prev = a;
    }
  }
  const r = best || fall;
  return r.a ? [rotAx(D, r.k, r.a), rotAx(E, r.k, r.a)] : [D, E];
}
// Bàn tay phải của thân GLB trong khung bàn tay (đỉnh có xương nặng nhất là bàn tay phải hand; inv: ma trận gắn nghịch đảo 4 × 4 theo cột
// của xương đó — khung bàn tay lúc chạy): đỉnh cách trục z (cán gươm) > 0,03 (ngoài nắm tay quanh cán: ngón, đốt tay duỗi theo −y tới
// 0,13), mỗi ô FIT.hc một đỉnh. Không đỉnh: null.
export function handPts(pos, si, sw, hand, inv) {
  const out = [], seen = new Set();
  for (let v = 0; v < pos.length / 3; v++) {
    let q = 0; for (let k = 1; k < 4; k++) if (sw[v * 4 + k] > sw[v * 4 + q]) q = k;
    if (si[v * 4 + q] !== hand) continue;
    const X = pos[v * 3], Y = pos[v * 3 + 1], Z = pos[v * 3 + 2];
    const x = inv[0] * X + inv[4] * Y + inv[8] * Z + inv[12], y = inv[1] * X + inv[5] * Y + inv[9] * Z + inv[13], z = inv[2] * X + inv[6] * Y + inv[10] * Z + inv[14];
    const key = `${Math.round(x / FIT.hc)},${Math.round(y / FIT.hc)},${Math.round(z / FIT.hc)}`;
    if (Math.hypot(x, y) <= 0.03 || seen.has(key)) continue;
    seen.add(key); out.push(x, y, z);
  }
  return out.length ? Float32Array.from(out) : null;
}
// Các mút chắn tay của gươm (lưới vũ khí khung chuẩn bake/wpn.mjs: gốc chỗ nắm, cán +Z, bề rộng ±Y; P: n × 3): đỉnh rộng hơn 0,6 nửa bề
// ngang (chỉ chắn tay rộng thế) ở hai bên ±Y, mỗi bên điểm xa nhất theo Y và hai đầu z — ≤ 8 điểm (mút cong của chắn tay).
export function guardPts(P) {
  let gw = 0; for (let i = 1; i < P.length; i += 3) gw = Math.max(gw, Math.abs(P[i]));
  const out = [];
  for (const sg of [1, -1]) {
    const ids = []; for (let i = 0; i < P.length / 3; i++) if (P[i * 3 + 1] * sg > 0.6 * gw) ids.push(i);
    if (!ids.length) continue;
    const pick = (f) => ids.reduce((a, b) => (f(b) > f(a) ? b : a));
    for (const f of [(i) => P[i * 3 + 1] * sg, (i) => P[i * 3 + 2], (i) => -P[i * 3 + 2], (i) => P[i * 3 + 1] * sg - Math.abs(P[i * 3 + 2]) * 0.3]) {
      const i = pick(f); if (!out.some((q) => q === i)) out.push(i);
    }
  }
  return Float32Array.from(out.slice(0, 16).flatMap((i) => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]));
}
// cổ tay W vào tầm tay phải (rR); nắm hai tay (gw: 0 buông … 1 nắm) thì điểm nắm W − GRIP·D cũng trong tầm tay trái
function reach(W, D, g, gw) {
  const rR = FIT.k * (g.R.L1 + g.R.L2), a = inBall(W, g.shR, rR);
  return gw > 0 ? lin(a, 1 - gw, nearest2(W, g.shR, rR, add(g.shL, scl(D, GRIP)), FIT.k * (g.L.L1 + g.L.L2)), gw) : a;
}
// Gươm của tư thế gặp đất (rig khối qua rig-motion.js fixBlades: gập cổ tay quanh trục x cẳng tay k, điểm thấp nhất trong BEND.pts —
// mũi, hai mép lưỡi gần mũi, núm chuôi của gươm dựng bằng code, models.js — lên BEND.gap trên đất, nghiệm |δ| nhỏ mà cổ tay trong
// [lo, hi], không quá max): góc gập δ; cổ tay W0, lưỡi D0, lưỡi sắc E0, góc cổ tay a0 của tư thế, mặt đất gp (khung thân). Đích của
// fitArms là gươm tư thế sau khi đất chặn — lưỡi tư thế bổ xuống đất 40° mà gươm rig khối dừng ở đất (đổi 6°) thì gươm GLB cũng dừng.
const BEND = { pts: [0, 1.3, 0.065, 1.1, -0.065, 1.1, 0, -0.32], gap: 0.03, lo: -0.5, hi: 1.6, max: 1.0 };
function designBend(W0, D0, E0, k, a0, gp) {
  const n = [gp[0], gp[1], gp[2]], base = dot(n, W0) + gp[3];
  let worst = 0, r = null;
  for (let i = 0; i < 8; i += 2) { const v = lin(E0, BEND.pts[i], D0, BEND.pts[i + 1]), pen = BEND.gap - base - dot(n, v); if (pen > worst) { worst = pen; r = v; } }
  if (!r) return 0;
  const kr = dot(k, r), nk = dot(n, k), A = dot(n, r) - kr * nk, B = dot(n, cross(k, r)), C = kr * nk, R = Math.hypot(A, B);
  if (R < 1e-4) return 0;
  const wrap = (x) => x - TAU * Math.round(x / TAU), cost = (d) => Math.abs(d) + 4 * (Math.max(0, BEND.lo - a0 - d) + Math.max(0, a0 + d - BEND.hi));
  const phi = Math.atan2(B, A), q = (BEND.gap - base - C) / R;
  let dl;
  if (q >= 1) dl = wrap(phi);
  else { const ac = Math.acos(Math.max(-1, q)), d1 = wrap(phi - ac), d2 = wrap(phi + ac); dl = cost(d1) < cost(d2) ? d1 : d2; }
  return Math.max(Math.max(-BEND.max, Math.min(0, BEND.lo - a0)), Math.min(Math.min(BEND.max, Math.max(0, BEND.hi - a0)), dl));
}
// Tư thế p (đã trộn) → o = p với tay phải (shR*, elRx, handRx, handRz) giải theo số đo g (fitGeo). gp: mặt đất trong khung thân (fitCtx;
// rig-motion.js fitPlane) hay null. reset (mặc định khi dt ≤ 0: gọi rời, khung đầu, nhảy chỗ) thì giải toàn cục; không thì theo lời giải
// khung trước (o.__s) — dt = 0 (hit-stop: tư thế đứng yên) không kéo về tư thế, lời giải đứng yên. Không cấp phát o.
export function fitArms(p, g, o = {}, dt = 0, gp = null, reset = !(dt > 0)) {
  Object.assign(o, p);
  // tư thế ở số đo tư thế: cổ tay W, lưỡi D (trục z bàn tay), lưỡi sắc E (trục y), khuỷu (so với vai) — khung thân trên
  const f = elFrame(p.shRx, p.shRy, p.shRz, p.elRx);
  armFK(p.shRx, p.shRy, p.shRz, p.elRx - ARM.off, ARM.L1, ARM.L2, _fk);
  const elP = [_fk[0], _fk[1], _fk[2]], cx = Math.cos(p.handRx), sx = Math.sin(p.handRx), cz = Math.cos(p.handRz), sz = Math.sin(p.handRz);
  const W0 = add(SH.R, [_fk[3], _fk[4], _fk[5]]), gw = Math.min(1, Math.max(0, 2 * (p.grip || 0)));
  let D0 = lin(f.y, -sx, f.z, cx), E0 = lin(f.x, -sz, lin(f.y, cx, f.z, sx), cz);
  // mũi lưỡi tư thế cắm đất: gập như rig khối (fixBlades) — đích là gươm của tư thế sau khi đất chặn; gọi liên tục thì góc gập đổi không
  // quá FIT.bdr mỗi khung (fixBlades bật / tắt gập tới 57° giữa hai khung khi lộn né — gươm GLB đi mượt, đất đã có trong fitArms)
  const H = fitCtx(p, g, gp), S = o.__s, cont = !!(S && !reset), bd0 = gp ? designBend(W0, D0, E0, f.x, p.handRx, gp) : 0;
  const bm = FIT.bdr * Math.max(1, Math.min(3, dt * 60)), bd = cont ? S.bd + Math.max(-bm, Math.min(bm, bd0 - S.bd)) : bd0;
  // gươm tư thế gập đủ (như rig khối thật): giới hạn đổi mỗi khung so với nó
  const Dw = bd0 ? rotAx(D0, f.x, bd0) : D0, Ew = bd0 ? rotAx(E0, f.x, bd0) : E0;
  if (bd) { D0 = rotAx(D0, f.x, bd); E0 = rotAx(E0, f.x, bd); }
  let r;
  if (g.grid && cont) r = fitTrack(g, H, S, W0, D0, E0, elP, gw, p.handRz, Math.min(3, Math.max(0, dt * 60)), angOf(Dw, S.Dw), angOf(Ew, S.Ew));
  else if (g.grid) r = fitSolve(g, H, W0, D0, E0, elP, gw, p.handRz);
  else {
    // không có lưới đầu: tâm sọ (khung đầu) — cổ tay ≥ wr, lưỡi ≥ sr
    let W = W0, D = D0, E = E0;
    const C = H.C;
    for (let it = 0; it < 8; it++) {
      W = reach(W, D, g, gw);
      const rr = sub(C, W), R = len(rr);
      if (R < g.wr) { W = R > 1e-9 ? sub(C, scl(rr, g.wr / R)) : add(C, [0, 0, g.wr]); continue; }
      if (segGap(C, W, D, g.blade[0], g.blade[1]) >= g.sr - 1e-4) break;
      const need = Math.asin(Math.min(1, g.sr / R)) - Math.acos(Math.max(-1, Math.min(1, dot(rr, D) / R)));
      const ax = cross(rr, D), al = len(ax);
      if (need <= 0 || al < 1e-9) break;
      D = rotAx(D, scl(ax, 1 / al), need + 1e-3); E = rotAx(E, scl(ax, 1 / al), need + 1e-3);
    }
    r = { W: reach(W, D, g, gw), D, E, Eref: S && !reset ? S.E : null };
  }
  const lim = cont ? len(sub(elP, S.elP)) * (g.R.L1 / ARM.L1) + FIT.ew * Math.max(1, dt * 60) : Infinity;
  let A = armPlane(g, r.W, r.D, elP, cont ? S.el : null, lim, cont ? S.elT : null);
  // lưỡi thật của bàn tay (khuỷu bị giữ thì cổ tay chỉ gập được gần hướng lưỡi) quay quá tư thế + FIT.ca, hay khuỷu vẫn đi quá lim + FIT.eg
  // (cổ tay, lưỡi cùng đổi làm mặt phẳng tay quay nhanh — lưỡi gần trục vai → cổ tay: N6 LINH_r24 lưỡi lời giải 17° mà lưỡi thật 37°,
  // khuỷu 0,14 m): chỉ đi phần lớn nhất (chia đôi giữa lời giải khung trước và khung này) còn trong hai giới hạn; không có thì giữ
  const bladeOf = (A2) => lin(A2.fr.y, -Math.sin(A2.hx), A2.fr.z, Math.cos(A2.hx));
  const capA = cont && S.Da ? angOf(Dw, S.Dw) + FIT.ca * Math.max(1, Math.min(3, dt * 60)) : Infinity;
  const okA = (A2) => !cont || (len(sub(A2.el, S.el)) <= lim + FIT.eg && (!S.Da || angOf(bladeOf(A2), S.Da) <= capA));
  if (cont && !okA(A)) {
    // cấu hình giữa chừng không được chạm hơn lời giải khung này quá FIT.tr (lộn né: nửa đường giữa hai lời giải lọt mặt 8 cm)
    const gap = (c) => fistGap(g, H, c.W, c.D) + tiltGap(g, H, c.W, c.D, c.E) + guardGap(g, H, c.W, c.D, c.E, c.E), gr = g.grid ? gap(r) + FIT.tr : Infinity;
    let lo = 0, hi = 1, best = null;
    for (let i = 0; i < 6; i++) {
      const t = (lo + hi) / 2, c = mixC({ W: S.W, D: S.D, E: S.E }, r, t, g, gw), Ac = armPlane(g, c.W, c.D, elP, S.el, lim, S.elT);
      if (okA(Ac) && (!g.grid || gap(c) <= gr)) { lo = t; best = { c, Ac }; } else hi = t;
    }
    if (best) { r = { ...r, W: best.c.W, D: best.c.D, E: best.c.E }; A = best.Ac; }
  }
  armTo(o, g, r.W, r.D, r.E, p.handRz, r.Eref, A);
  o.__s = { W: r.W, D: r.D, E: o.__ey, W0, D0, E0, Wt: reach(W0, r.D, g, gw), el: A.el, elT: A.elT, Da: bladeOf(A), elP, det: r.det || 0, wdet: r.wdet || 0, bd, Dw, Ew };
  return o;
}
// Giải toàn cục (soát lần 2): cổ tay của tư thế vào tầm với, hướng gươm tính từ của tư thế ở chỗ đó (tiltFrom); hai nắm tay sát mặt thì
// dời ra (pháp tuyến, tới khi tầm với kéo lại thì dò rìa tầm với — searchW), tính lại hướng gươm; hai lượt (hướng mới đổi chỗ nắm tay
// trái); vẫn sát mặt nhiều (thiếu khe nắm tay > FIT.fd: hướng của tư thế chĩa chuôi về mặt khi tay ở rìa tầm với — H31 khung chuyển C6,
// Tuyệt Kỹ: 3,8 cm) thì dựng mũi thêm từng FIT.ts, lấy góc đầu tiên đủ khe nắm tay và lưỡi, không có thì góc thiếu ít nhất; cuối cùng
// lật chắn tay (nhánh lưỡi sắc gần góc lật của tư thế).
function fitSolve(g, H, W0, D0, E0, elP, gw, hz0) {
  const C = H.C;
  let W = reach(W0, D0, g, gw), D, E;
  [D, E] = tiltFrom(g, H, W, D0, E0, C);
  W = reach(W, D, g, gw);
  for (let round = 0; round < 2; round++) {
    if (fistGap(g, H, W, D) <= 1e-4) break;
    W = clearFists(g, H, W, W0, D, gw, C);
    [D, E] = tiltFrom(g, H, W, D0, E0, C);
    W = reach(W, D, g, gw);
  }
  if (fistGap(g, H, W, D) > FIT.fd) {
    const p0 = cross(D0, [0, 1, 0]);
    if (len(p0) > 0.2) {
      let k = norm(p0);
      if (rotAx(D0, k, 0.1)[1] < rotAx(D0, scl(k, -1), 0.1)[1]) k = scl(k, -1);
      let best = { s: fistGap(g, H, W, D) + tiltGap(g, H, W, D), W, D, E };
      for (let a = FIT.ts; a < TILT_MAX + 1e-6 && best.s > 2e-4 + 1e-6; a += FIT.ts) {
        const Da = rotAx(D0, k, a), Wa = clearFists(g, H, reach(W, Da, g, gw), W0, Da, gw, C), sa = fistGap(g, H, Wa, Da) + tiltGap(g, H, Wa, Da);
        if (sa < best.s - 1e-4) best = { s: sa, W: Wa, D: Da, E: rotAx(E0, k, a) };
      }
      ({ W, D, E } = best);
    }
  }
  W = reach(W, D, g, gw);
  const Ar = armPlane(g, W, D, elP);
  return { W, D, E: rollFrom(g, H, W, D, E, (e) => edgeOf(e, Ar, hz0, null)), Eref: null };
}
// Giải tiếp theo khung trước S (gọi liên tục; fr: số khung 1/60 s đã qua, 0 = hit-stop): (1) mang lời giải trước theo tư thế — hướng
// lưỡi quay theo phép quay ngắn nhất của lưỡi tư thế (đổi không hơn lưỡi tư thế), khung bàn tay theo khung tay tư thế, cổ tay giữ độ lệch
// so với đích (cổ tay tư thế vào tầm với) — rồi đẩy ra khỏi vật cản tại chỗ (settle); vẫn chạm thì lấy phần lớn nhất của bước mang theo
// mà đẩy ra được (gươm bị chặn, như vướng thật); (2) kéo về đích mỗi khung FIT.rd (lưỡi), rr (lật), rw (cổ tay) (× FIT.gf khi lời giải
// chạm hơn đích nhiều) rồi đẩy ra — chạm hơn thì lưỡi về trước, vòng qua bên, chỉ kéo phần không chạm (chia đôi), trượt cổ tay trên mặt
// cầu tầm với; không nhích được mà còn xa đích thì đi thẳng tới đích một bước chấp nhận thiếu khe tới FIT.tr; (3) so với khung trước,
// lưỡi, lưỡi sắc quay không hơn tư thế quá FIT.cd, ce, cổ tay đi không hơn cổ tay tư thế (theo tỉ lệ dài tay) quá cw.
function fitTrack(g, H, S, W0, D0, E0, elP, gw, hz0, fr, dzw, dyw) {
  const gap = (c) => fistGap(g, H, c.W, c.D) + tiltGap(g, H, c.W, c.D, c.E) + guardGap(g, H, c.W, c.D, c.E, c.E);
  const P = { W: S.W, D: S.D, E: S.E }, Dt = norm(swing(S.D, S.D0, D0));
  const T = { W: null, D: Dt, E: perpN(xfer(S.E, S.D0, S.E0, D0, E0), Dt) };
  T.W = reach(add(reach(W0, Dt, g, gw), sub(S.W, S.Wt)), Dt, g, gw);
  const kt = cross(S.D0, D0), kp = len(kt) > 0.02 ? norm(kt) : null, rm = FIT.ce * Math.max(fr, 1);   // chiều tư thế đang quay lưỡi; lật tối đa
  let base = settle(g, H, T, gw, kp, rm), eb = gap(base);
  if (eb > 4e-4) {
    let lo = 0, hi = 1, blk = false;
    const p0 = settle(g, H, P, gw, kp, rm), e0 = gap(p0);
    if (e0 < eb - 1e-4) { base = p0; eb = e0; blk = true; }
    for (let i = 0; i < 5; i++) {
      const t = (lo + hi) / 2, c = settle(g, H, mixC(P, T, t, g, gw), gw, kp, rm), e = gap(c);
      if (e <= Math.max(e0, 4e-4) + 1e-4) { lo = t; if (e < eb - 1e-4 || blk) { base = c; eb = e; blk = true; } } else hi = t;
    }
  }
  let det = 0, wd = 0;
  // đích kéo về: gươm của tư thế (cổ tay vào tầm với) nếu không chạm; chạm thì lời giải toàn cục của khung này (fitSolve: dựng mũi, dời
  // tay lên rìa tầm với — thế giơ qua đầu: tay cao nhất có thể) — tư thế C6 bật nhảy, Tuyệt Kỹ giơ gươm mà đích chạm đầu thì kéo theo
  // tư thế, tay kẹt dưới mặt (giữ gươm ngang ngực)
  let tg = { W: reach(W0, D0, g, gw), D: D0, E: E0 };
  if (fr > 0 && gap(tg) > 4e-4) {
    const G = fitSolve(g, H, W0, D0, E0, elP, gw, hz0), Ee = edgeOf(G.E, armPlane(g, G.W, G.D, elP), hz0, null);
    tg = { W: G.W, D: G.D, E: dot(Ee, base.E) < -0.5 && gap({ W: G.W, D: G.D, E: scl(Ee, -1) }) <= gap({ W: G.W, D: G.D, E: Ee }) + 1e-4 ? scl(Ee, -1) : Ee };
    // lời giải khung này chạm hơn lời giải toàn cục > 2 cm (lộn né: đầu sát đất, tư thế đổi 30–45° mỗi khung — lời giải tụt lại, chuôi
    // vào cổ áo LINH_r01 1,7 cm): kéo về nhanh gấp FIT.gf
    if (eb > gap(tg) + 0.02) tg.f = FIT.gf;
  }
  if (fr > 0) {
    const a0 = angOf(base.D, tg.D), st = Math.min(a0, FIT.rd * fr * (tg.f || 1)), ok = (c, e) => e <= Math.max(eb, 4e-4) + 1e-4 && angOf(c.D, tg.D) < a0 - 0.3 * st;
    const kr = cross(base.D, tg.D), R = relaxC(base, tg, g, gw, fr, 1), Rs = settle(g, H, R, gw, len(kr) > 0.02 ? norm(kr) : kp, rm), er = gap(Rs);
    const Rd = a0 > 1e-3 ? settle(g, H, relaxC(base, tg, g, gw, fr, 1, true), gw, len(kr) > 0.02 ? norm(kr) : kp, rm) : null, ed = Rd ? gap(Rd) : 9;
    let full = false, moved = true;
    if (ok(Rs, er) || (a0 < 1e-3 && er <= Math.max(eb, 4e-4) + 1e-4)) { base = Rs; eb = er; full = true; }
    else if (Rd && ok(Rd, ed)) { base = Rd; eb = ed; }     // lưỡi về trước (cổ tay đứng): dựng gươm rồi mới đưa tay
    else {
      // lưỡi kẹt trước vật cản trên đường về đích: vòng qua bên — quay quanh trục lệch ±30…80° (quanh lưỡi) khỏi trục về thẳng, chiều
      // vòng của khung trước trước (S.det), lấy trục đầu tiên vẫn tới gần đích mà không chạm hơn
      const k0 = len(kr) > 1e-6 ? norm(kr) : null, sg = S.det || 1;
      if (k0 && a0 > 0.2) for (const a of [0.5 * sg, -0.5 * sg, 1.0 * sg, -1.0 * sg, 1.4 * sg, -1.4 * sg]) {
        const k = rotAx(k0, base.D, a), Dc = rotAx(base.D, k, st), c = { W: reach(base.W, Dc, g, gw), D: Dc, E: rotAx(base.E, k, st) }, e = gap(c);
        if (ok(c, e)) { base = c; eb = e; det = Math.sign(a); break; }
      }
      if (!det) {
        let lo = 0, hi = 1;
        for (let i = 0; i < 5; i++) { const t = (lo + hi) / 2, c = relaxC(base, tg, g, gw, fr, t); if (gap(c) <= Math.max(eb, 4e-4) + 1e-4) lo = t; else hi = t; }
        if (lo > 0) { base = relaxC(base, tg, g, gw, fr, lo); eb = gap(base); } else moved = false;
      }
    }
    // cổ tay kẹt xa đích (hai nắm tay vướng mặt, cổ trên đường về — C6 bật nhảy: tay giữ ngang ngực thay vì giơ qua đầu): trượt trên mặt
    // cầu tầm với theo hướng về đích lệch ±30…80° (quanh pháp tuyến cầu), chiều của khung trước trước, bước FIT.rw, lấy hướng đầu tiên tới
    // gần đích mà không chạm hơn
    const Wt = tg.W, dt0 = len(sub(Wt, base.W)), sw = Math.min(dt0, FIT.rw * fr * (tg.f || 1) + 0.12 * dt0);
    if (dt0 > 0.03 && !full) {
      const nr = norm(sub(base.W, g.shR)), u0 = perpN(sub(Wt, base.W), nr), sg = S.wdet || 1;
      for (const a of [0, 0.5 * sg, -0.5 * sg, 1.0 * sg, -1.0 * sg, 1.4 * sg, -1.4 * sg]) {
        const c = { W: reach(add(base.W, scl(rotAx(u0, nr, a), sw)), base.D, g, gw), D: base.D, E: base.E }, e = gap(c);
        if (e <= Math.max(eb, 4e-4) + 1e-4 && len(sub(Wt, c.W)) < dt0 - 0.3 * sw) { base = c; eb = e; wd = Math.sign(a); moved = true; break; }
      }
    }
    // vẫn đứng yên xa đích (kẹt trong hốc: C6, Tuyệt Kỹ bật nhảy, tay dưới cằm, lưỡi theo tư thế quay ra sau — mọi bước đều chạm hơn một
    // chút, đi thẳng tới đích qua được nếu cho thiếu khe ~1 cm): một bước thẳng tới đích (mixC, phần lớn hơn trong hai phần lưỡi FIT.rd,
    // cổ tay rw) rồi đẩy ra, nhận khi thiếu khe ≤ FIT.tr — các khe còn lớn hơn nửa bản lưỡi, nắm tay (lệch tư thế > 90°: 98 → 6 khung)
    if (!moved && (dt0 > 0.05 || a0 > 0.2)) {
      const t = Math.min(1, Math.max(st / Math.max(a0, 1e-6), sw / Math.max(dt0, 1e-6))), c = settle(g, H, mixC(base, tg, t, g, gw), gw, null, rm), e = gap(c);
      if (e <= Math.max(eb, FIT.tr)) { base = c; eb = e; }
    }
  }
  let { W, D, E } = base;
  // giới hạn mỗi khung so với khung trước (theo tư thế + FIT.cd / ce / cw)
  const m = Math.max(fr, 1), aD = angOf(D, S.D), lD = dzw + FIT.cd * m;
  if (aD > lD) { const Dc = rotAx(S.D, norm(cross(S.D, D)), lD); E = perpN(swing(E, D, Dc), Dc); D = Dc; }
  // lưỡi hai mặt sắc: E hay −E như nhau (chắn tay đối xứng) — lấy chiều gần lưỡi sắc khung trước mang theo tư thế (T.E: tư thế lật 119°
  // một khung khi hết Phá Trận thì theo đúng tư thế) rồi mới so lật với khung trước; so với E ngược chiều thì chặn lật 140° xuống 29° giữa
  // chừng, chắn tay vào cổ áo (Đòn Quyết LINH_r01 5,4 cm)
  if (dot(E, T.E) < 0) E = scl(E, -1);
  const aE = angOf(E, S.E), lE = dyw + FIT.ce * m;
  if (aE > lE) {
    const Ep = perpN(S.E, D), ph = Math.atan2(dot(D, cross(Ep, E)), dot(Ep, E));
    let lo = 0, hi = 1;
    for (let i = 0; i < 8; i++) { const t = (lo + hi) / 2; if (angOf(rotAx(Ep, D, ph * t), S.E) > lE) hi = t; else lo = t; }
    E = perpN(rotAx(Ep, D, ph * lo), D);
  }
  const lW = len(sub(W0, S.W0)) * ((g.R.L1 + g.R.L2) / (ARM.L1 + ARM.L2)) + FIT.cw * m, dW = sub(W, S.W), aW = len(dW);
  if (aW > lW) { const Wc = reach(add(S.W, scl(dW, lW / aW)), D, g, gw); if (gap({ W: Wc, D, E }) <= gap({ W, D, E }) + 1e-4) W = Wc; }
  const far = len(sub(tg.W, W)) > 0.03;
  return { W, D, E, Eref: E, det: det || (S.det && angOf(D, D0) > 0.2 ? S.det : 0), wdet: wd || (S.wdet && far ? S.wdet : 0) };
}
// Cấu hình (W, D, E) giữa a (t = 0) và b (t = 1): cổ tay nội suy rồi vào tầm với, lưỡi, lưỡi sắc quay theo phép quay ngắn nhất
function mixC(a, b, t, g, gw) {
  const k = cross(a.D, b.D), s = len(k), th = Math.atan2(s, dot(a.D, b.D)) * t;
  let D = a.D, E = a.E;
  if (s > 1e-9) { D = rotAx(a.D, scl(k, 1 / s), th); E = rotAx(a.E, scl(k, 1 / s), th); }
  const Eb = perpN(b.E, D), ph = Math.atan2(dot(D, cross(E = perpN(E, D), Eb)), dot(E, Eb));
  E = perpN(rotAx(E, D, ph * t), D);
  return { W: reach(lin(a.W, 1 - t, b.W, t), D, g, gw), D, E };
}
// Kéo c về đích tg (phần t của một bước fr khung): lưỡi quay về tg.D tới FIT.rd·fr, lật về tg.E tới rr·fr, cổ tay về tg.W tới rw·fr
// cộng 12% khoảng cách (xa thì về nhanh hơn)
function relaxC(c, tg, g, gw, fr, t, onlyD = false) {
  let D = c.D, E = c.E;
  fr *= tg.f || 1;
  const a = angOf(D, tg.D);
  if (a > 1e-6) { const k = norm(cross(D, tg.D)), s = Math.min(a, FIT.rd * fr) * t; D = rotAx(D, k, s); E = rotAx(E, k, s); }
  const Et = perpN(tg.E, D), ph = Math.atan2(dot(D, cross(E, Et)), dot(E, Et));
  E = perpN(rotAx(E, D, Math.max(-FIT.rr * fr, Math.min(FIT.rr * fr, ph)) * t), D);
  const dw = sub(tg.W, c.W), lw = len(dw), st = onlyD ? 0 : Math.min(lw, FIT.rw * fr + 0.12 * lw) * t;
  return { W: reach(lw > 1e-9 ? add(c.W, scl(dw, st / lw)) : c.W, D, g, gw), D, E };
}
// Đẩy cấu hình c ra khỏi vật cản tại chỗ, ba lượt: hai nắm tay (slideFists), lưỡi / đuôi chuôi nghiêng (tiltLocal), chắn tay / ngón tay lật
// (rollFrom tới 90°), mút chắn tay còn chạm thì dời hai tay — mỗi bước chỉ nhận khi tổng thiếu khe giảm
function settle(g, H, c, gw, kp = null, rmax = Math.PI / 2) {
  let { W, D, E } = c;
  const gap = (W1, D1, E1) => fistGap(g, H, W1, D1) + tiltGap(g, H, W1, D1, E1) + guardGap(g, H, W1, D1, E1, E1);
  let e = gap(W, D, E);
  for (let round = 0; round < 3 && e > 4e-4; round++) {
    const e1 = e;
    if (fistGap(g, H, W, D) > 1e-4) { const Wn = slideFists(g, H, W, D, null, gw, H.C), en = gap(Wn, D, E); if (en < e - 1e-5) { W = Wn; e = en; } }
    if (tiltGap(g, H, W, D, E) > 1e-4) {
      const [Dn, En] = tiltLocal(g, H, W, D, E, kp), Wn = reach(W, Dn, g, gw), en = gap(Wn, Dn, En);
      if (en < e - 1e-5) { W = Wn; D = Dn; E = En; e = en; }
    }
    if (guardGap(g, H, W, D, E, E) > 1e-4) {
      const En = rollFrom(g, H, W, D, E, (x) => x, rmax), en = gap(W, D, En);
      if (en < e - 1e-5) { E = En; e = en; }
      if (guardGap(g, H, W, D, E) > 1e-4) { const Wn = slideFists(g, H, W, D, E, gw, H.C), en2 = gap(Wn, D, E); if (en2 < e - 1e-5) { W = Wn; e = en2; } }
    }
    if (e > e1 - 1e-5) break;
  }
  return { W, D, E };
}
// Sau rig-motion.js fixBlades (cổ tay phải gập thêm cho mũi lưỡi khỏi cắm đất, góc mới hx): giữ lưỡi theo hướng mới, đưa lại cổ tay
// vào tầm với (điểm nắm đổi chỗ theo lưỡi — lính Tự do vai rộng hụt chuôi 1,5–3 cm ở thế bổ đất). q: tư thế đã fitArms. Lưỡi gập theo
// đất mà vào mặt, cổ (thiếu khe lưỡi / đuôi chuôi / nắm tay > FIT.rf hơn lời giải fitArms — lộn né: đầu sát đất, gập lưỡi lên đầu 1,5–1,8
// cm, soát 19a lần 3) thì trả null: giữ lời giải fitArms (đất đã tính trong fitArms theo mặt phẳng gp); force: không xét (rig-motion.js
// đổi dần góc gập giữa góc đã nhận khung trước và góc nhận khung này).
export function refitArms(q, g, hx, o = {}, force = false) {
  const f = elFrame(q.shRx, q.shRy, q.shRz, q.elRx);
  armFK(q.shRx, q.shRy, q.shRz, q.elRx - g.R.off, g.R.L1, g.R.L2, _fk);
  const cx = Math.cos(hx), sx = Math.sin(hx), cz = Math.cos(q.handRz), sz = Math.sin(q.handRz), gw = Math.min(1, Math.max(0, 2 * (q.grip || 0)));
  const D = lin(f.y, -sx, f.z, cx), E = lin(f.x, -sz, lin(f.y, cx, f.z, sx), cz), W = reach(add(g.shR, [_fk[3], _fk[4], _fk[5]]), D, g, gw);
  if (!force && g.grid && q.__s) {
    const H = fitCtx(q, g, null), S = q.__s, bad = (W1, D1) => Math.max(fistGap(g, H, W1, D1), tiltGap(g, H, W1, D1));
    if (bad(W, D) > bad(S.W, S.D) + FIT.rf) return null;
  }
  Object.assign(o, q);
  return armTo(o, g, W, D, E, q.handRz, E, armPlane(g, W, D, [_fk[0], _fk[1], _fk[2]]));
}
// IK tay phải tới cổ tay W, lưỡi D, lưỡi sắc E → o (khuỷu A: armPlane). Lưỡi hai mặt sắc: E hay −E theo edgeOf (Eref: lưỡi sắc thật
// khung trước — giữ chiều; không có thì nhánh góc lật gần hz0 của tư thế); lưỡi sắc thật của bàn tay ghi vào o.__ey.
function armTo(o, g, W, D, E, hz0, Eref, A) {
  const Ee = edgeOf(E, A, hz0, Eref);
  let d = rollOf(Ee, A.fr, A.hx) - hz0; d -= TAU * Math.round(d / TAU);
  o.shRx = A.a0; o.shRy = A.a1; o.shRz = A.a2; o.elRx = A.ex; o.handRx = A.hx; o.handRz = hz0 + d;
  o.__ey = Ee;                                                                            // lưỡi sắc thật của bàn tay (khung sau so theo)
  return o;
}
// Khuỷu tay phải: cổ tay W, lưỡi D → { a0, a1, a2 vai, ex khuỷu, fr khung cẳng tay, hx gập cổ tay, el khuỷu so với vai, elT đích khuỷu }.
// Mặt phẳng tay chứa lưỡi (cổ tay chỉ gập quanh x, lật quanh z): khuỷu ở một trong hai phía của (vai → cổ tay) trong mặt phẳng đó — gọi
// rời: phía gần khuỷu elP của tư thế mà cổ tay gập trong khoảng tự nhiên WRIST (như solveRight; phía kia có khi gập 150–190°, khuỷu nhảy
// 0,1–0,36 m giữa hai khung, đo đợt soát 19a lần 2); gọi liên tục (ep: khuỷu khung trước, et: đích khuỷu khung trước): phía của khung
// trước (gần et — đang dời khuỷu sang phía kia thì giữ phía đó tới hết, không quay lại giữa chừng), chỉ đổi phía khi cổ tay phía này gập
// quá khoảng tự nhiên hơn phía kia FIT.ws — FIT.ws2 khi lưỡi gần trục vai → cổ tay (sin < sin FIT.ed: đổi lúc đó lệch lưỡi ít, khuỷu đi
// dần; chờ tới khi lưỡi xa trục thì khuỷu nhảy nửa vòng — Hịch LINH_r24 0,27 m, C6 H31 0,26 m một khung, soát lần 3); khuỷu mới cách
// khuỷu trước quá lim (lưỡi gần song song cánh tay — mặt phẳng tay quay nửa vòng giữa hai khung: khuỷu nhảy 0,2–0,3 m ở Binh Thư, Hịch,
// cuối Tuyệt Kỹ) thì khuỷu chỉ quay quanh trục vai → cổ tay một cung lim từ chỗ cũ về phía đó, cổ tay gập theo lưỡi gần nhất có thể —
// nhưng lưỡi không lệch quá FIT.ed (lưỡi xa trục cánh tay thì khuỷu phải theo: lệch lưỡi ≈ góc lưỡi–cánh tay × góc khuỷu còn thiếu).
function armPlane(g, W, D, elP, ep = null, lim = Infinity, et = null) {
  const v = sub(W, g.shR), n = cross(v, D), side = len(n) > 1e-6 * len(v) ? norm(cross(n, v)) : null;
  let best = -Infinity, r = null;
  const solve = (pl) => {
    armIK(v[0], v[1], v[2], pl[0], pl[1], pl[2], g.R.L1, g.R.L2, _ik2);
    armFK(_ik2[0], _ik2[1], _ik2[2], _ik2[3], g.R.L1, g.R.L2, _fk);
    const ex = _ik2[3] + g.R.off, f = elFrame(_ik2[0], _ik2[1], _ik2[2], ex), hx = Math.atan2(-dot(D, f.y), dot(D, f.z));
    return { a0: _ik2[0], a1: _ik2[1], a2: _ik2[2], ex, fr: f, hx, el: [_fk[0], _fk[1], _fk[2]] };
  };
  const cs = (side ? [side, scl(side, -1)] : [ep || elP]).map((pl) => { const c = solve(pl); c.pen = Math.max(0, WRIST[0] - c.hx) + Math.max(0, c.hx - WRIST[1]); return c; });
  if (ep) {
    // phía của khung trước; phía hợp tư thế (khuỷu theo elP, cổ tay tự nhiên) mà gần khuỷu trước trong lim thì theo nó luôn — lưỡi gần
    // song song cánh tay hai phía sát nhau, đổi không nhảy
    const ref = et || ep;
    cs.sort((a, b) => len(sub(a.el, ref)) - len(sub(b.el, ref)));
    const sc = (c) => dot(norm(c.el), norm(elP)) - 2 * c.pen, sw = len(cross(norm(v), D)) < Math.sin(FIT.ed) ? FIT.ws2 : FIT.ws;
    r = cs.length > 1 && cs[0].pen > cs[1].pen + sw ? cs[1] : cs[0];
    if (cs.length > 1) { const d = sc(cs[0]) >= sc(cs[1]) ? cs[0] : cs[1]; if (d !== r && len(sub(d.el, ep)) <= lim) r = d; }
  } else for (const c of cs) { const s = dot(norm(c.el), norm(elP)) - 2 * c.pen; if (s > best) { best = s; r = c; } }
  const vh = norm(v), sa = len(cross(vh, D)), elT = r.el;
  if (ep && len(sub(r.el, ep)) > lim) {
    const pe = perpN(ep, vh), pr = perpN(r.el, vh), rc = len(sub(r.el, scl(vh, dot(r.el, vh))));
    const mx = sa > Math.sin(FIT.ed) ? Math.asin(Math.sin(FIT.ed) / sa) : Math.PI;
    const th = Math.atan2(dot(vh, cross(pe, pr)), dot(pe, pr)), a = Math.min(Math.abs(th), Math.max(lim / Math.max(rc, 1e-3), Math.abs(th) - mx));
    if (a < Math.abs(th)) r = solve(rotAx(pe, vh, Math.sign(th) * a));
  }
  r.elT = elT;
  return r;
}
// góc lật bàn tay (quanh z sau khi gập hx quanh x của khung cẳng tay fr) cho trục y bàn tay theo E
const rollOf = (E, fr, hx) => Math.atan2(-dot(E, fr.x), dot(E, lin(fr.y, Math.cos(hx), fr.z, Math.sin(hx))));
// Lưỡi hai mặt sắc: trục y thật của bàn tay là E hay −E — cùng chiều lưỡi sắc khung trước Eref nếu có (không lật qua lại), không thì
// nhánh có góc lật gần hz0 của tư thế (lật ít nhất).
function edgeOf(E, A, hz0, Eref) {
  if (Eref) return dot(E, Eref) < 0 ? scl(E, -1) : E;
  let d = rollOf(E, A.fr, A.hx) - hz0; d -= TAU * Math.round(d / TAU);
  return Math.abs(d) > Math.PI / 2 ? scl(E, -1) : E;
}
