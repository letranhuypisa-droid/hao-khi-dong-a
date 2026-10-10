// battle/anim-wc09.js — hoạt ảnh thủ tục lớp WC09 Cung (H40 Nguyễn Khoái, đợt B17-B1): kéo dây, ngắm, buông; thế cầm cung,
// chạy, đỡ, trúng đòn, né, ngã. Chưa có clip bắn cung (Mixamo là đợt B3) nên mọi tư thế dựng từ khung khoá, hai tay giải IK
// (ik.js armIK) theo đường tên:
//   · thân đứng nghiêng, vai trái hướng về đích (hipsYaw + torsoY ≈ 0,95 rad);
//   · tay phải (kéo dây) tới điểm neo dưới hàm phải ANCHOR (khung thân trên); đường tên đi qua điểm neo theo hướng ngắm;
//   · tay trái (cầm cung) duỗi gần hết tầm (REACH) tới điểm trên đường tên đó, bàn tay quay để cánh cung dựng đứng (trục y bàn
//     tay theo phương thẳng đứng, nghiêng cant rad), lưng cung (+z bàn tay) về phía đích;
//   · draw 0..1 là độ kéo: 0 = tay phải chạm cung (vừa lắp tên), 1 = căng hết; rel 0..1 là đà sau khi buông (tay phải bật ra
//     sau tai).
// Góc ngẩng el (rad): mưa tên C4, C6 bắn vút lên. Tên cầm tay (models.js mui_ten) do hero.js đặt: gốc ở tay phải, mũi chĩa tay trái.
// Quy ước khớp như anim.js; tay 0,34 + 0,36 và vai (±0,3, 0,52) như anim-wc01.js (rig khối; thân GLB dùng thẳng góc khớp — tay
// GLB ngắn hơn thì hai tay gần nhau hơn một chút, tên cầm tay vẫn nối hai bàn tay).
// ĐỀ XUẤT BẢN THỬ: mọi góc, mốc u (chỉnh bằng mắt trong lab.html?view=hero&hero=H40&m=…).

import * as A from "./anim.js";
import { armIK } from "./ik.js";
import { MOVES_WC09 } from "../data/moves-wc09.js";

const { P, keys, blendPose, EASE, seg, clamp01 } = A;

// ---- toán khung (Euler "XYZ" như three: R = Rx·Ry·Rz) — như anim-wc01.js --------------------------------------------------
function rotXYZ(x, y, z) {
  const a = Math.cos(x), b = Math.sin(x), c = Math.cos(y), d = Math.sin(y), e = Math.cos(z), f = Math.sin(z);
  return [c * e, -c * f, d, a * f + b * d * e, a * e - b * d * f, -b * c, b * f - a * d * e, b * e + a * d * f, a * c];   // hàng
}
const mulT = (m, v) => [m[0] * v[0] + m[3] * v[1] + m[6] * v[2], m[1] * v[0] + m[4] * v[1] + m[7] * v[2], m[2] * v[0] + m[5] * v[1] + m[8] * v[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const addv = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.sqrt(dot(a, a)) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

const ARM = { L1: 0.34, L2: Math.hypot(0.36, 0.02), off: Math.atan2(0.02, 0.36) };
const SH = { R: [0.3, 0.52, 0], L: [-0.3, 0.52, 0] };
// hướng khung gốc rig → khung thân trên (bỏ phần dời; chỉ cần hướng)
function dirToTorso(b, v) {
  const Rh = rotXYZ(b.rootX || 0, (b.spin || 0) + (b.hipsYaw || 0), b.rootZ || 0), Rt = rotXYZ(b.torsoX || 0, b.torsoY || 0, b.torsoZ || 0);
  return mulT(Rt, mulT(Rh, v));
}
// Khung cẳng tay theo góc vai YXZ và khuỷu → trục x, y, z (khung thân trên) — như anim-wc01.js elFrame.
function elFrame(sx, sy, sz, ex) {
  const cx = Math.cos(sx), s_x = Math.sin(sx), cy = Math.cos(sy), s_y = Math.sin(sy), cz = Math.cos(sz), s_z = Math.sin(sz);
  const Y = [-cy * s_z + s_y * s_x * cz, cx * cz, s_y * s_z + cy * s_x * cz], Z = [s_y * cx, -s_x, cy * cx], X = cross(Y, Z);
  const c = Math.cos(ex), s = Math.sin(ex);
  const y = [c * Y[0] + s * Z[0], c * Y[1] + s * Z[1], c * Y[2] + s * Z[2]], z = [-s * Y[0] + c * Z[0], -s * Y[1] + c * Z[1], -s * Y[2] + c * Z[2]];
  return { x: X, y, z };
}
const _ik = [0, 0, 0, 0];
// một tay tới cổ tay W (khung thân trên) với khuỷu lệch về pole; D, U (tuỳ chọn): trục +z, +y mong muốn của bàn tay
function arm(side, W, pole, D = null, U = null) {
  const v = sub(W, SH[side]);
  armIK(v[0], v[1], v[2], pole[0], pole[1], pole[2], ARM.L1, ARM.L2, _ik);
  const sx = _ik[0], sy = _ik[1], sz = _ik[2], ex = _ik[3] + ARM.off;
  const o = { ["sh" + side + "x"]: sx, ["sh" + side + "y"]: sy, ["sh" + side + "z"]: sz, ["el" + side + "x"]: ex };
  if (D) {
    const f = elFrame(sx, sy, sz, ex), hx = Math.atan2(-dot(D, f.y), dot(D, f.z));
    let hz = 0;
    if (U) { const c = Math.cos(hx), s = Math.sin(hx), y0 = [c * f.y[0] + s * f.z[0], c * f.y[1] + s * f.z[1], c * f.y[2] + s * f.z[2]]; hz = Math.atan2(-dot(U, f.x), dot(U, y0)); }
    o["hand" + side + "x"] = hx; o["hand" + side + "z"] = hz;
  }
  return o;
}

// ---- dáng bắn ----------------------------------------------------------------------------------------------------------
// Thân: vai trái hướng đích, gối chùng, chân trái trước. ANCHOR: điểm neo dây dưới hàm phải (khung thân trên; khớp cổ ở
// (0, 0,68, 0)); REACH: tay cầm cung duỗi gần hết (0,7 m là duỗi thẳng); NOCK: tay phải lắp tên cách tay cung chừng này m.
const STANCE = { hipsYaw: 0.55, torsoY: 0.4, torsoX: 0.02, hipsY: -0.08, hipLx: -0.34, hipLz: -0.12, kneeLx: 0.32, hipRx: 0.3, hipRz: 0.14,
  kneeRx: 0.24, headX: 0.02 };
const ANCHOR = [0.07, 0.62, 0.13], REACH = 0.66, NOCK = 0.16;
const POLE_L = [-1, -0.35, -0.1], CANT = 0.18;
// o: kênh thân / chân (như STANCE) + el (góc ngẩng), draw, rel, reach (tuỳ chọn), anchor (tuỳ chọn), cant
export function bowPose(o) {
  const b = { ...STANCE, ...o }, el = o.el || 0, draw = o.draw ?? 1, rel = o.rel || 0;
  for (const k of ["el", "draw", "rel", "reach", "anchor", "cant", "hold"]) delete b[k];
  const D = norm(dirToTorso(b, [0, Math.sin(el), Math.cos(el)]));
  const up = norm(dirToTorso(b, [0, 1, 0]));
  // trục cánh cung: thẳng đứng trừ phần dọc theo đường tên, nghiêng cant quanh đường tên (đầu trên ngả ra ngoài, sang phải)
  const u0 = norm(sub(up, [D[0] * dot(up, D), D[1] * dot(up, D), D[2] * dot(up, D)])), side = cross(u0, D), ct = o.cant ?? CANT;
  const U = norm(addv([u0[0] * Math.cos(ct), u0[1] * Math.cos(ct), u0[2] * Math.cos(ct)], side, -Math.sin(ct)));
  const An = o.anchor || ANCHOR, R = o.reach ?? REACH;
  // tay cung: điểm trên đường tên (qua điểm neo, theo D) cách vai trái đúng R
  const v = sub(An, SH.L), bb = dot(v, D), disc = bb * bb - (dot(v, v) - R * R);
  const L = -bb + Math.sqrt(Math.max(0, disc));
  const Bw = addv(An, D, L);
  // tay dây: từ chỗ lắp tên (sát tay cung) về điểm neo theo draw; buông thì bật ra sau tai (ngược đường tên, ra ngoài, lên)
  let W = lerp3(addv(Bw, D, -NOCK), An, EASE.io(clamp01(draw)));
  if (rel > 0) W = addv(addv(addv(W, D, -0.16 * rel), side, 0.05 * rel), up, 0.03 * rel);
  const poleR = norm(addv(addv([-D[0], -D[1], -D[2]], side, 0.5), up, 0.35));
  return P({ ...b, ...arm("L", Bw, POLE_L, D, U), ...arm("R", W, poleR), handRz: 0, handRx: 0.35 });
}

// Thế thủ: cung cầm thấp chếch xuống trước, tên đã lắp, dây chưa kéo
export const GUARD = Object.freeze(bowPose({ el: -0.55, draw: 0.08, hipsYaw: 0.35, torsoY: 0.25, torsoX: 0.08, hipsY: -0.05, kneeLx: 0.24, kneeRx: 0.18 }));
const AIM = Object.freeze(bowPose({ draw: 1 }));                                    // căng hết, ngắm ngang
const NOCKED = Object.freeze(bowPose({ draw: 0.05, el: -0.08 }));                    // vừa lắp tên, cung đã giơ lên
const REL = Object.freeze(bowPose({ draw: 1, rel: 1 }));                             // vừa buông

// Đỡ: giơ cung chắn ngang trước mặt (tay cung ngang trán, tay phải nắm đầu cung)
const BLOCK_RAW = { torsoX: 0.16, hipsYaw: 0.1, torsoY: 0.05, hipsY: -0.2, hipLx: -0.42, hipLz: -0.08, kneeLx: 0.58, hipRx: 0.32, hipRz: 0.1, kneeRx: 0.48, headX: 0.06 };
export const BLOCK = Object.freeze(P({ ...BLOCK_RAW,
  ...arm("L", [-0.12, 0.86, 0.36], [-1, -0.6, 0], dirToTorso(BLOCK_RAW, [0, 0.4, 1]), dirToTorso(BLOCK_RAW, [1, 0.15, 0])),
  ...arm("R", [0.24, 0.8, 0.32], [1, -0.6, -0.2]), handRx: 0.4 }));
export function block() { return BLOCK; }

// Chạy: tay trái cầm cung dọc bên hông (cánh cung chếch về trước, khỏi chạm đất), tay phải vung theo nhịp như run()
const CARRY_L = arm("L", [-0.3, 0.02, 0.12], [-1, 0, -0.4], [0, 0.55, 0.84], [0.2, 0.84, -0.5]);
function carryArms(p, ph, a) {
  for (const k in CARRY_L) p[k] = CARRY_L[k];
  p.shLx += 0.12 * a * Math.sin(ph);                       // cung lắc nhẹ theo bước
  p.shRz = 0.22; p.elRx = -0.75; p.handRx = 0.3;
  return p;
}
export function idle(t) { return A.idle(t, true, GUARD); }
export function run(phase, speed01 = 1, stride = 0.95 * speed01) { return A.run(phase, speed01, stride, carryArms); }
export function hitReact(u) { return A.hitReact(u, GUARD); }
export function dodgeRoll(u) { return A.dodgeRoll(u); }
export function knockdown(u) { return A.knockdown(u); }

// ---- đòn ---------------------------------------------------------------------------------------------------------------
// Một phát bắn: tay phải từ thế trước (khung 0) lên cung, kéo tới căng hết đúng lúc buông hit, bật ra sau, rồi về thế thủ.
// aim: tư thế căng dây (mặc định AIM); rel: tư thế sau buông.
function shotKeys(hit, aim = AIM, rel = REL, start = GUARD, back = GUARD) {
  return [[0, start], [hit * 0.3, NOCKED, "out"], [hit, aim, "io"], [Math.min(0.99, hit + 0.06), rel, "snap"], [1, back, "io"]];
}
const hitOf = (k) => MOVES_WC09[k].hits[0];
const shot = (k, aim, rel) => { const ks = shotKeys(hitOf(k), aim, rel); return (u) => keys(u, ks); };

// N1–N5: phát nhanh; N4, N5 kéo sâu hơn (hạ thấp người); N6 tỏa ba tên: thân quét ngang lúc buông
const AIM_LOW = Object.freeze(bowPose({ draw: 1, hipsY: -0.14, kneeLx: 0.45, kneeRx: 0.34 }));
const REL_LOW = Object.freeze(bowPose({ draw: 1, rel: 1, hipsY: -0.14, kneeLx: 0.45, kneeRx: 0.34 }));
const N6_AIM = Object.freeze(bowPose({ draw: 1, hipsYaw: 0.75, torsoY: 0.4 }));
const N6_SWEEP = Object.freeze(bowPose({ draw: 1, rel: 1, hipsYaw: 0.35, torsoY: 0.4 }));
// C1 tên nặng: người hạ thấp, kéo căng hơn (tay neo lùi sau tai), giữ ở chargeU khi giữ C
const C1_AIM = Object.freeze(bowPose({ draw: 1, anchor: [0.12, 0.64, 0.05], hipsY: -0.16, kneeLx: 0.5, kneeRx: 0.38, torsoX: 0.06 }));
const C1_REL = Object.freeze(bowPose({ draw: 1, rel: 1.4, anchor: [0.12, 0.64, 0.05], hipsY: -0.16, kneeLx: 0.5, kneeRx: 0.38 }));
// C4 / C6 bắn vút lên trời
const SKY = (el, extra = {}) => Object.freeze(bowPose({ draw: 1, el, torsoX: -0.1, ...extra }));
const C4_AIM = SKY(1.05), C4_REL = Object.freeze(bowPose({ draw: 1, rel: 1, el: 1.05, torsoX: -0.1 }));
const C6_AIM = SKY(0.95, { hipsY: -0.14, kneeLx: 0.45, kneeRx: 0.34 }), C6_REL = Object.freeze(bowPose({ draw: 1, rel: 1.3, el: 0.95, torsoX: -0.1, hipsY: -0.14, kneeLx: 0.45, kneeRx: 0.34 }));
// Đòn Quyết: bắn chúc xuống kẻ Vỡ Thế đang quỳ trước mặt
const DQ_AIM = Object.freeze(bowPose({ draw: 1, el: -0.28, hipsY: -0.2, kneeLx: 0.6, kneeRx: 0.5, torsoX: 0.12 }));
const DQ_REL = Object.freeze(bowPose({ draw: 1, rel: 1, el: -0.28, hipsY: -0.2, kneeLx: 0.6, kneeRx: 0.5, torsoX: 0.12 }));

// C2 đạp: co gối phải, đạp thẳng ra trước, rồi nhảy lùi (hero.js lùi m.back m); cung giữ trước ngực
const KICK_UP = Object.freeze({ ...GUARD, torsoX: -0.12, hipsYaw: 0.1, torsoY: 0.1, hipRx: -1.45, kneeRx: 1.9, hipLx: 0.05, kneeLx: 0.2, hipsY: -0.04 });
const KICK_OUT = Object.freeze({ ...GUARD, torsoX: -0.3, hipsYaw: 0.05, torsoY: 0.05, hipRx: -1.55, kneeRx: 0.12, hipLx: 0.12, kneeLx: 0.18, hipsY: 0.02 });
const HOP_BACK = Object.freeze({ ...GUARD, torsoX: 0.25, hipsY: 0.12, hipLx: -0.6, kneeLx: 0.9, hipRx: -0.2, kneeRx: 1.1 });
const C2_K = [[0, GUARD], [0.2, KICK_UP, "out"], [0.35, KICK_OUT, "snap"], [0.55, HOP_BACK, "io"], [1, GUARD, "io"]];
// phản đòn: quất cánh cung ngang (tay trái vung từ phải sang trái) rồi về thế thủ
const WHIP_A = Object.freeze(P({ ...GUARD, torsoY: -0.35, hipsYaw: 0.2, ...arm("L", [0.25, 0.75, 0.42], [-0.5, -1, 0], [0.8, 0.1, 0.6], [0, 1, 0]) }));
const WHIP_B = Object.freeze(P({ ...GUARD, torsoY: 0.65, hipsYaw: 0.55, ...arm("L", [-0.62, 0.72, 0.3], [-0.6, -1, 0], [-0.9, 0.1, 0.4], [0, 1, 0]) }));
const CT_K = [[0, GUARD], [0.2, WHIP_A, "out"], [0.35, WHIP_B, "snap"], [0.6, WHIP_B, "lin"], [1, GUARD, "io"]];

// C3 liên thanh: mỗi nhát là một chu kỳ kéo (từ nửa dây) → căng → buông; giữ C (hero.js) giữ khung trước nhát cuối
function rapid(u) {
  const H = MOVES_WC09.C3.hits;
  if (u < H[0]) return keys(u, [[0, GUARD], [H[0] * 0.4, NOCKED, "out"], [H[0], AIM, "io"]]);
  for (let i = 0; i < H.length; i++) {
    const h0 = H[i], h1 = i + 1 < H.length ? H[i + 1] : 1;
    if (u < h1 || i === H.length - 1) {
      const t = (u - h0) / (h1 - h0);
      if (i === H.length - 1) return keys(u, [[h0, AIM], [Math.min(0.99, h0 + 0.05), REL, "snap"], [1, GUARD, "io"]]);
      return t < 0.3 ? blendPose(AIM, REL, EASE.snap(t / 0.3) * 0.7) : blendPose(REL, AIM, EASE.io((t - 0.3) / 0.7));
    }
  }
  return GUARD;
}
// Lướt N: lộn lùi bắn — ngả người ra sau, nhảy lùi (hero.js lùi m.back m), bắn giữa không, đáp
const DN_AIR = Object.freeze(bowPose({ draw: 1, torsoX: -0.25, hipsY: 0.2, hipLx: -0.7, kneeLx: 1.2, hipRx: -0.3, kneeRx: 1.4 }));
const DN_REL = Object.freeze(bowPose({ draw: 1, rel: 1, torsoX: -0.2, hipsY: 0.1, hipLx: -0.5, kneeLx: 0.9, hipRx: -0.1, kneeRx: 0.9 }));
const DN_K = [[0, GUARD], [0.25, Object.freeze({ ...NOCKED, torsoX: 0.25, hipsY: -0.2, kneeLx: 0.8, kneeRx: 0.8 }), "out"], [0.55, DN_AIR, "io"],
  [0.62, DN_REL, "snap"], [1, GUARD, "io"]];

// ---- kỹ năng H40 (hero-skills.js, đợt B17-B2) -------------------------------------------------------------------------------
// Tên Xuyên Hàng: kéo sâu, buông một lượt năm tên tỏa (rel mạnh); Chặn Dòng: vung tay trái quăng chuỗi phao / cọc ra trước;
// Móc Tên: bắn móc (như tên nặng, buông ở release), rồi kéo dây (tay phải giật ra sau, người ngả).
const XH_K = shotKeys(0.55, C1_AIM, C1_REL);
const THROW_A = Object.freeze(P({ ...GUARD, torsoY: -0.2, torsoX: -0.1, ...arm("L", [-0.45, 0.95, -0.15], [-1, -0.4, 0]) }));
const THROW_B = Object.freeze(P({ ...GUARD, torsoY: 0.5, torsoX: 0.15, ...arm("L", [-0.2, 0.62, 0.62], [-1, -0.6, 0]) }));
const CD_K = [[0, GUARD], [0.3, THROW_A, "out"], [0.5, THROW_B, "snap"], [1, GUARD, "io"]];
const HAUL = Object.freeze(bowPose({ draw: 1, rel: 1.6, torsoX: -0.25, hipsY: -0.2, hipLx: -0.6, kneeLx: 0.65, hipRx: 0.45, kneeRx: 0.3 }));
const MT_K = [[0, GUARD], [0.12, NOCKED, "out"], [0.23, C1_AIM, "io"], [0.27, C1_REL, "snap"], [0.45, HAUL, "out"], [0.8, HAUL, "lin"], [1, GUARD, "io"]];

// ---- bảng đòn (hero-anim.js: ANIMS.WC09) ----------------------------------------------------------------------------------
export const HERO_ANIM_WC09 = {
  N1: shot("N1"), N2: shot("N2"), N3: shot("N3"), N4: shot("N4", AIM_LOW, REL_LOW), N5: shot("N5", AIM_LOW, REL_LOW),
  N6: shot("N6", N6_AIM, N6_SWEEP),
  C1: shot("C1", C1_AIM, C1_REL), C2: (u) => keys(u, C2_K), C3: rapid, C4: shot("C4", C4_AIM, C4_REL), C5: shot("C5", C1_AIM, C1_REL),
  C6: shot("C6", C6_AIM, C6_REL), DN: (u) => keys(u, DN_K), DC: shot("DC", C1_AIM, C1_REL), DQ: shot("DQ", DQ_AIM, DQ_REL),
  CT: (u) => keys(u, CT_K),
  xuyenHang: (u) => keys(u, XH_K), chanDong: (u) => keys(u, CD_K), mocTen: (u) => keys(u, MT_K),
};
// Tư thế ngoài đòn (hero.js POSES.WC09): thế thủ, đỡ, chạy, trúng đòn, né, ngã; aim(el, draw) cho lab / HUD.
export const POSES_WC09 = { guard: GUARD, block: BLOCK, idle, run, hitReact, dodgeRoll, knockdown, aim: AIM };
