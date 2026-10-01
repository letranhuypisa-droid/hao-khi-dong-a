// battle/soldier-motion.js — phần thuần (không import three) của lính instanced.
//
// Ở đây có: kênh tư thế (CH), bộ khớp người/ngựa, tư thế đích theo trạng thái (poseFor), dáng đi đặt
// chân (gait), pha bước theo quãng đi (advanceStride), bộ làm mượt tư thế (smoothPose) và soldierFrame():
// đường ống một lính mỗi khung, dùng chung cho Crowd.render (trận, heightAt) và lab.js (labGround):
//   tư thế đã trộn → bản nháp → xoay tại chỗ (bàn chân đứng giữ chỗ, bước bù) → IK chân bám đất → cổ chân
//   bám dốc (ngựa: nghiêng, nhấc theo dốc) → xác / người nằm xoay theo dốc → lò xo vạt áo → ma trận khớp
//   → tua giáo / đuôi ngựa theo dây treo.
// IK chỉ ghi vào bản nháp, không bao giờ ghi ngược vào a.pose (bộ làm mượt sẽ cộng dồn mỗi khung).
// Ma trận khớp tính thẳng vào mảng affine 3 × 4 theo hàng — đúng định dạng texture của skinnedKit —
// không qua THREE, nên cả đường ống chạy được trong Node (đo trượt chân).
//
// Quy ước góc (khớp nào cũng vậy): x âm = đưa ra trước / giơ lên; tay phải z dương = dang ra ngoài,
// tay trái z âm = dang ra ngoài; cẳng tay x âm = gập khuỷu; cẳng chân x dương = gập gối; cổ chân x
// dương = mũi bàn chân chúi xuống; vạt áo x dương = vạt hất ra sau, z dương = vạt lệch sang +x.
// "Phải" là phía +x của lưới, như rig của tướng.

import { footPos, legIK, legShift, pelvisDrop, contact, slopePitch, spring, damping, rope } from "./ik.js";

const TWO_PI = Math.PI * 2;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ease = (t) => t * t * (3 - 2 * t);
const easeOut = (t) => 1 - (1 - t) * (1 - t);
const smooth = (e0, e1, x) => ease(clamp01((x - e0) / (e1 - e0)));

// ---- kênh tư thế --------------------------------------------------------------------------------
// lkx, rkx: cổ chân; ffx/ffz, fbx/fbz: vạt trước, vạt sau (soldierFrame ghi đè bằng lò xo).
const KEYS = ["pitch", "roll", "lift", "fwd", "hipY", "pelY", "tx", "ty", "tz",
  "lax", "lay", "laz", "lfx", "rax", "ray", "raz", "rfx", "ltx", "ltz", "lsx", "rtx", "rtz", "rsx",
  "lkx", "rkx", "ffx", "ffz", "fbx", "fbz"];
export const NCH = KEYS.length;
export const CH = Object.fromEntries(KEYS.map((k, i) => [k, i]));

// ---- bộ khớp ------------------------------------------------------------------------------------
// [tên, cha, điểm xoay trong khung cha, kênh x, kênh y, kênh z, thứ tự Euler]. Ngựa dùng đúng tên và
// thứ tự khớp như người (JOINT_NAMES lấy từ HUMAN). "tas" không có kênh: ma trận của nó ghi đè theo
// dây treo (tua giáo ở đầu mũi giáo; đuôi ngựa ở mông ngựa).
export const HAND = -0.29;
const HUMAN = [
  ["pelvis", null, [0, 0.9, 0], null, "pelY", null, "YXZ"],
  ["torso", "pelvis", [0, 0.06, 0], "tx", "ty", "tz", "YXZ"],
  ["uaL", "torso", [-0.26, 0.47, 0], "lax", "lay", "laz", "YXZ"],
  ["faL", "uaL", [0, -0.29, 0], "lfx", null, null, "XYZ"],
  ["uaR", "torso", [0.26, 0.47, 0], "rax", "ray", "raz", "YXZ"],
  ["faR", "uaR", [0, -0.29, 0], "rfx", null, null, "XYZ"],
  ["thL", "pelvis", [-0.11, -0.02, 0], "ltx", null, "ltz", "XYZ"],
  ["shL", "thL", [0, -0.44, 0], "lsx", null, null, "XYZ"],
  ["thR", "pelvis", [0.11, -0.02, 0], "rtx", null, "rtz", "XYZ"],
  ["shR", "thR", [0, -0.44, 0], "rsx", null, null, "XYZ"],
  ["ftL", "shL", [0, -0.36, 0], "lkx", null, null, "XYZ"],          // cổ chân trái
  ["ftR", "shR", [0, -0.36, 0], "rkx", null, null, "XYZ"],
  ["flF", "pelvis", [0, -0.02, 0.155], "ffx", null, "ffz", "XYZ"],  // vạt trước, xoay ở eo
  ["flB", "pelvis", [0, -0.02, -0.155], "fbx", null, "fbz", "XYZ"], // vạt sau
  ["tas", "faR", [0, HAND, 0], null, null, null, "XYZ"],            // tua giáo
];
const HORSE = [
  ["pelvis", null, [0, 1.12, 0], null, "pelY", null, "YXZ"],
  ["torso", "pelvis", [0, 0.34, -0.05], "tx", "ty", "tz", "YXZ"],
  ["uaL", "torso", [-0.23, 0.44, 0], "lax", "lay", "laz", "YXZ"],
  ["faL", "uaL", [0, -0.27, 0], "lfx", null, null, "XYZ"],
  ["uaR", "torso", [0.23, 0.44, 0], "rax", "ray", "raz", "YXZ"],
  ["faR", "uaR", [0, -0.27, 0], "rfx", null, null, "XYZ"],
  ["thL", "pelvis", [-0.17, -0.2, 0.5], "ltx", null, null, "XYZ"],     // chân trước trái
  ["shL", "pelvis", [-0.17, -0.2, -0.5], "lsx", null, null, "XYZ"],    // chân sau trái
  ["thR", "pelvis", [0.17, -0.2, 0.5], "rtx", null, null, "XYZ"],      // chân trước phải
  ["shR", "pelvis", [0.17, -0.2, -0.5], "rsx", null, null, "XYZ"],     // chân sau phải
  ["ftL", "shL", [0, -0.9, 0], null, null, null, "XYZ"],               // rỗng
  ["ftR", "shR", [0, -0.9, 0], null, null, null, "XYZ"],               // rỗng
  ["flF", "pelvis", [0, 0.26, -0.18], "ffx", null, "ffz", "XYZ"],      // vạt chăn yên hai bên sườn
  ["flB", "pelvis", [0, 0.26, -0.5], "fbx", null, "fbz", "XYZ"],       // rỗng
  ["tas", "pelvis", [0, 0.13, -0.8], null, null, null, "XYZ"],         // đuôi ngựa
];
export const SKELETONS = { human: HUMAN, horse: HORSE };
export const JOINT_NAMES = HUMAN.map((j) => j[0]);
export const NJ = JOINT_NAMES.length, BONE_FLOATS = NJ * 12;
const JI = Object.fromEntries(JOINT_NAMES.map((j, i) => [j, i]));
const COMPILED = {};
for (const [k, J] of Object.entries(SKELETONS)) {
  J.forEach((j, i) => { if (j[0] !== JOINT_NAMES[i]) throw new Error(`bộ khớp ${k}: khớp ${i} phải là ${JOINT_NAMES[i]}`); });
  COMPILED[k] = J.map(([name, parent, pv, cx, cy, cz, order]) => ({ p: parent ? JI[parent] : -1, px: pv[0], py: pv[1], pz: pv[2],
    cx: cx ? CH[cx] : -1, cy: cy ? CH[cy] : -1, cz: cz ? CH[cz] : -1, yxz: order === "YXZ", hip: name === "pelvis" }));
}

// Chiều dài giáo (m, khung cẳng tay) — soldiers.js dựng lưới giáo theo đúng số này, tua treo ở chân mũi.
export const SPEAR = { DV_GIAO: 2.8, NG_GIAO: 2.6 };

// ---- ma trận khớp (affine 3 × 4 theo hàng) --------------------------------------------------------
// Cùng công thức makeRotationFromEuler của three (thứ tự "YXZ" và "XYZ"), m = 9 số theo hàng.
function rot(yxz, x, y, z, m) {
  const a = x ? Math.cos(x) : 1, b = x ? Math.sin(x) : 0, c = y ? Math.cos(y) : 1, d = y ? Math.sin(y) : 0;
  const e = z ? Math.cos(z) : 1, f = z ? Math.sin(z) : 0;
  if (yxz) {
    const ce = c * e, cf = c * f, de = d * e, df = d * f;
    m[0] = ce + df * b; m[1] = de * b - cf; m[2] = a * d;
    m[3] = a * f; m[4] = a * e; m[5] = -b;
    m[6] = cf * b - de; m[7] = df + ce * b; m[8] = a * c;
  } else {
    const ae = a * e, af = a * f, be = b * e, bf = b * f;
    m[0] = c * e; m[1] = -c * f; m[2] = d;
    m[3] = af + be * d; m[4] = ae - bf * d; m[5] = -b * c;
    m[6] = bf - ae * d; m[7] = be + af * d; m[8] = a * c;
  }
}
const RT = new Float64Array(12), L9 = new Float64Array(9);

// Ma trận thế giới của mọi khúc vào out (NJ × 12 số, lính i ghi ở out[i·BONE_FLOATS] tuỳ nơi gọi).
// Gốc: vị trí, hướng, nhấc/lao tới, rồi ngã quanh bàn chân (pitch, roll), rồi tỉ lệ.
export function jointsInto(skel, x, y, z, yaw, scale, S, out) {
  const J = COMPILED[skel], fw = S[CH.fwd] * scale;
  rot(true, S[CH.pitch], yaw, S[CH.roll], L9);
  RT[0] = L9[0] * scale; RT[1] = L9[1] * scale; RT[2] = L9[2] * scale; RT[3] = x + Math.sin(yaw) * fw;
  RT[4] = L9[3] * scale; RT[5] = L9[4] * scale; RT[6] = L9[5] * scale; RT[7] = y + S[CH.lift] * scale;
  RT[8] = L9[6] * scale; RT[9] = L9[7] * scale; RT[10] = L9[8] * scale; RT[11] = z + Math.cos(yaw) * fw;
  for (let j = 0; j < J.length; j++) {
    const q = J[j];
    rot(q.yxz, q.cx >= 0 ? S[q.cx] : 0, q.cy >= 0 ? S[q.cy] : 0, q.cz >= 0 ? S[q.cz] : 0, L9);
    const P = q.p < 0 ? RT : out, po = q.p < 0 ? 0 : q.p * 12, o = j * 12;
    const ty = q.py + (q.hip ? S[CH.hipY] : 0);
    for (let r = 0; r < 12; r += 4) {
      const a0 = P[po + r], a1 = P[po + r + 1], a2 = P[po + r + 2];
      out[o + r] = a0 * L9[0] + a1 * L9[3] + a2 * L9[6];
      out[o + r + 1] = a0 * L9[1] + a1 * L9[4] + a2 * L9[7];
      out[o + r + 2] = a0 * L9[2] + a1 * L9[5] + a2 * L9[8];
      out[o + r + 3] = a0 * q.px + a1 * ty + a2 * q.pz + P[po + r + 3];
    }
  }
}

// ---- thế đứng, đòn ------------------------------------------------------------------------------
// Thế đứng cầm vũ khí (ready = đang giao chiến). Chỉ ghi các kênh tay/thân; chân do bước chạy lo.
const STANCE = {
  dao: (P, ready) => {
    if (ready) { P.rax = -0.4; P.raz = 0.18; P.rfx = -1.05; P.lax = -0.55; P.laz = -0.12; P.lfx = -0.55; P.ty += 0.12; }
    else { P.rax = -0.05; P.raz = 0.1; P.rfx = -0.45; P.lax = -0.12; P.laz = -0.1; P.lfx = -0.3; }
  },
  giao: (P, ready) => {
    if (ready) { P.rax = 0.05; P.raz = 0.14; P.ray = -0.1; P.rfx = -0.12; P.lax = -0.95; P.laz = 0.38; P.lfx = -0.2; P.ty += 0.32; }
    else { P.rax = -0.08; P.raz = 0.08; P.rfx = -1.45; P.lax = -0.05; P.laz = -0.08; P.lfx = -0.2; }
  },
  cung: (P, ready) => {
    if (ready) { P.lax = -0.7; P.laz = -0.1; P.lfx = -0.35; P.rax = -0.35; P.raz = 0.1; P.rfx = -1.0; P.ty += 0.25; }
    else { P.lax = -0.2; P.laz = -0.1; P.lfx = -0.3; P.rax = 0; P.raz = 0.1; P.rfx = -0.2; }
  },
  chuy: (P) => { P.rax = -0.55; P.raz = 0.22; P.rfx = -2.15; P.lax = -0.25; P.laz = -0.3; P.lfx = -0.7; },
  no: (P, ready) => {
    if (ready) { P.rax = -0.95; P.raz = 0.05; P.rfx = -0.55; P.lax = -1.0; P.laz = 0.42; P.lfx = -0.55; P.ty += 0.1; }
    else { P.rax = -0.05; P.raz = 0.08; P.rfx = -1.45; P.lax = -0.1; P.laz = -0.1; P.lfx = -0.25; }
  },
  ky: (P) => { P.lax = -0.45; P.laz = -0.1; P.lfx = -0.55; P.rax = -0.5; P.raz = 0.1; P.rfx = -0.9; },
};

// Đòn: K1 = đỉnh báo trước, K2 = cuối cú đánh. Báo trước trộn thế đứng → K1 (easeOut), cú đánh
// trộn K1 → K2 trong 0,1 s (easeOut), hồi thế trộn K2 → thế đứng.
const ATTACK = {
  dao: [
    { ty: 0.6, tx: -0.1, rax: -2.7, raz: 0.5, ray: 0.2, rfx: -0.75, lax: -0.75, laz: -0.05, lfx: -0.45, rtx: 0.25, ltx: -0.25, lsx: 0.25 },
    { ty: -0.55, tx: 0.32, rax: -0.3, raz: -0.5, ray: -0.2, rfx: 0.0, lax: -0.15, lfx: -0.25, fwd: 0.28, ltx: -0.55, lsx: 0.45, rtx: 0.3, rsx: 0.2, hipY: -0.09 },
  ],
  giao: [
    { ty: 0.65, tx: -0.06, rax: 0.5, raz: 0.18, rfx: -0.55, lax: -0.55, laz: 0.42, lfx: -0.1, fwd: -0.12, rtx: 0.3, ltx: -0.2 },
    { ty: -0.3, tx: 0.28, rax: -0.5, raz: 0.05, rfx: 0.28, lax: -1.3, laz: 0.2, lfx: 0.0, fwd: 0.5, ltx: -0.65, lsx: 0.35, rtx: 0.4, rsx: 0.15, hipY: -0.1 },
  ],
  cung: [
    { ty: 0.75, lax: -1.57, lay: -0.75, laz: 0, lfx: 0, rax: -1.5, ray: -0.95, raz: 0, rfx: -2.45, tx: -0.02 },
    { ty: 0.75, lax: -1.55, lay: -0.75, lfx: 0, rax: -1.35, ray: -0.2, raz: 0.3, rfx: -1.5, tx: -0.08 },
  ],
  chuy: [
    { rax: -2.95, raz: 0.05, rfx: -0.45, lax: -2.8, laz: 0.35, lfx: -0.55, tx: -0.32, ty: 0.12, hipY: 0.02, rtx: 0.2, ltx: -0.15 },
    { rax: -0.05, raz: -0.12, rfx: 0.15, lax: -0.35, laz: 0.5, lfx: -0.15, tx: 0.6, ty: -0.1, hipY: -0.24, fwd: 0.35, ltx: -0.75, lsx: 0.85, rtx: 0.35, rsx: 0.45 },
  ],
  no: [
    { rax: -1.1, raz: 0.02, rfx: -0.45, lax: -1.12, laz: 0.44, lfx: -0.45, tx: 0.06, ty: 0.15 },
    { rax: -1.35, rfx: -0.45, lax: -1.3, laz: 0.44, lfx: -0.45, tx: -0.14, ty: 0.15, fwd: -0.1 },
  ],
  ky: [
    { ty: 0.85, lax: -1.57, lay: -0.85, lfx: 0, rax: -1.5, ray: -1.0, rfx: -2.45 },
    { ty: 0.85, lax: -1.55, lay: -0.85, lfx: 0, rax: -1.3, ray: -0.3, raz: 0.3, rfx: -1.5 },
  ],
};
export const KIT_WEAPON = { NG_DAO: "dao", NG_GIAO: "giao", NG_CUNG: "cung", NG_TANK: "chuy", NG_KY: "ky", DV_GIAO: "giao", DV_DAO: "dao", DV_NO: "no" };

const P = {};
for (const k of KEYS) P[k] = 0;
const BASE = {};
// Mọi chỗ chạy mỗi lính mỗi khung (reset, legSolve, trộn dáng đi, writeOut) ghi P bằng tên trường cố định: vòng
// P[KEYS[i]] (khoá biến) buộc V8 đóng hộp từng số thực, ~0,5 KB rác mỗi lính mỗi khung. Vòng khoá biến chỉ còn
// ở nhánh đòn (báo trước, đánh, hồi, lao húc) — ít lính cùng lúc.
function reset() {
  P.pitch = 0; P.roll = 0; P.lift = 0; P.fwd = 0; P.hipY = 0; P.pelY = 0; P.tx = 0; P.ty = 0; P.tz = 0;
  P.lax = 0; P.lay = 0; P.laz = 0; P.lfx = 0; P.rax = 0; P.ray = 0; P.raz = 0; P.rfx = 0;
  P.ltx = 0; P.ltz = 0; P.lsx = 0; P.rtx = 0; P.rtz = 0; P.rsx = 0; P.lkx = 0; P.rkx = 0; P.ffx = 0; P.ffz = 0; P.fbx = 0; P.fbz = 0;
}
// Chép P ra mảng tư thế. Thứ tự phải khớp KEYS (kiểm ở dưới, cùng với reset).
function writeOut(o) {
  o[0] = P.pitch; o[1] = P.roll; o[2] = P.lift; o[3] = P.fwd; o[4] = P.hipY; o[5] = P.pelY; o[6] = P.tx; o[7] = P.ty;
  o[8] = P.tz; o[9] = P.lax; o[10] = P.lay; o[11] = P.laz; o[12] = P.lfx; o[13] = P.rax; o[14] = P.ray;
  o[15] = P.raz; o[16] = P.rfx; o[17] = P.ltx; o[18] = P.ltz; o[19] = P.lsx; o[20] = P.rtx; o[21] = P.rtz;
  o[22] = P.rsx; o[23] = P.lkx; o[24] = P.rkx; o[25] = P.ffx; o[26] = P.ffz; o[27] = P.fbx; o[28] = P.fbz;
}
{
  const t = new Float32Array(NCH); KEYS.forEach((k, i) => { P[k] = i + 1; }); writeOut(t); if (t.some((v, i) => v !== i + 1)) throw new Error("writeOut lệch KEYS");
  reset(); if (KEYS.some((k) => P[k] !== 0) || Object.keys(P).length !== NCH) throw new Error("reset lệch KEYS");
}
function mixInto(from, to, t) {
  for (const k in to) P[k] = (k in from ? from[k] : P[k]) + (to[k] - (k in from ? from[k] : P[k])) * t;
}

// Độ vung tay khi chạy theo vũ khí [tay trái, tay phải]: tay cầm thương, nỏ, chùy gần như giữ yên.
const SWING = { dao: [0.25, 0.3], giao: [0.05, 0.02], cung: [0.25, 0.45], chuy: [0.45, 0.08], no: [0.45, 0.06], ky: [0, 0] };

// ---- dáng đi đặt chân (người) ---------------------------------------------------------------------
// Mỗi chân một pha u ∈ [0, 1) (chân phải lệch nửa chu kỳ). Pha chống u < β: bàn chân nằm yên trên đất,
// trong khung thân nó lùi đều một quãng S theo hướng đi. Pha đưa: nhấc lên, vòng về trước theo đường
// Hermite có vận tốc hai đầu khớp pha chống (chạm đất không giật). Góc đùi, gối giải bằng legIK.
// Hông cao theo "compa": chân chống duỗi gần hết cỡ ở hai đầu bước nên hông hạ ở đó, lên cao giữa bước
// như người đi thật; chạy (β < 0,5, có pha bay) thì hông nhún xuống giữa pha chống, bật lên giữa pha bay.
// Chu kỳ C = S / β (đơn vị thân; × scale ra mét). advanceStride() tăng pha theo đúng C nên chân chống
// không trượt. Hướng đi (mx, mz) trong khung thân: lùi thì bàn chân chống trôi ra trước, đi ngang thì
// bước ngắn lại (hai chân không bắt chéo). ĐỀ XUẤT BẢN THỬ: S, β, độ nhấc chân chọn bằng mắt ở lab.
export const LEG = { L1: 0.44, L2: 0.36, SOLE: 0.085, HIP: 0.88, HX: 0.11 };
const REACH = 0.985 * (LEG.L1 + LEG.L2);
const runK = (amp) => smooth(0.55, 0.95, amp);
const stepS = (amp, mx) => Math.min(0.72, 0.3 + 0.75 * amp) * (1 - 0.62 * Math.abs(mx));
// Độ dài một chu kỳ bước (hai bước chân), đơn vị thân. Ngựa: chân dài 0,9, nửa chu kỳ chống móng lùi đều
// 2 × 0,9·sin A → C = 3,6·sin A (xem gallop).
export function cycleLen(amp, mx, horse) {
  if (horse) return 3.6 * Math.sin(horseA(Math.max(0.3, amp)));
  return stepS(amp, mx) / (0.5 - 0.14 * runK(amp));
}

// Quỹ đạo một bàn chân theo pha u: out = [s (vị trí dọc hướng đi, + = phía trước), độ nhấc, tiến độ pha đưa].
// Pha đưa: Hermite từ −S/2 tới +S/2, vận tốc hai đầu m = vận tốc pha chống (tính theo tiến độ w).
function footTraj(u, beta, S, lift, out) {
  if (u < beta) { out[0] = S * (0.5 - u / beta); out[1] = 0; out[2] = 0; return out; }
  const w = (u - beta) / (1 - beta), m = -S * (1 - beta) / beta, w2 = w * w, w3 = w2 * w;
  out[0] = -0.5 * S * (2 * w3 - 3 * w2 + 1) + m * (w3 - 2 * w2 + w) + 0.5 * S * (3 * w2 - 2 * w3) + m * (w3 - w2);
  out[1] = lift * Math.sin(Math.PI * w); out[2] = w;
  return out;
}
// Giải góc đùi, gối, dạng chân, cổ chân cho bàn chân T (khung gốc) khi hông xoay pelY (cos cp, sin sp).
// side −1 = chân trái (ltx, lsx, ltz, lkx), +1 = chân phải.
const IK2 = [0, 0], TL = [0, 0, 0], TR = [0, 0, 0];
function legSolve(T, mx, mz, side, spread, hipH, cp, sp) {
  const fx = side * (LEG.HX + spread) + T[0] * mx, fz = T[0] * mz;
  const lx = fx * cp - fz * sp - side * LEG.HX, lz = fx * sp + fz * cp, ly = -(hipH - LEG.SOLE) + T[1];
  legIK(-Math.sqrt(lx * lx + ly * ly), lz, LEG.L1, LEG.L2, IK2);
  const th = IK2[0], kn = IK2[1], tz = Math.atan2(lx, -ly);
  // cổ chân lúc đưa chân: mũi bớt chúi (bàn chân gần nằm ngang giữa pha đưa); pha chống để soldierFrame lo
  const ak = T[2] > 0 ? -(th + kn) * 0.5 * Math.sin(Math.PI * T[2]) : 0;
  if (side < 0) { P.ltx = th; P.lsx = kn; P.ltz = tz; P.lkx = ak; } else { P.rtx = th; P.rsx = kn; P.rtz = tz; P.rkx = ak; }
}

// sq: vai giữ vuông (thân xoay ngược hết phần hông) — người cầm giáo dài, kẻo mũi giáo quét ngang theo nhịp
function gait(ph, amp, mx, mz, sw, stable, sq) {
  const r = runK(amp), beta = 0.5 - 0.14 * r, S = stepS(amp, mx);
  const lift = 0.06 + 0.12 * amp, spread = 0.025 + 0.05 * Math.abs(mx) + (stable ? 0.06 : 0);
  const R2 = REACH * REACH - spread * spread, he = Math.sqrt(R2 - S * S / 4) + LEG.SOLE;
  // hông: theo chân đang chống (nửa chu kỳ v), hoặc pha bay
  const v = ph / Math.PI - Math.floor(ph / Math.PI);
  let hipH;
  if (v < 2 * beta) {
    const p = v / (2 * beta), s = S * (0.5 - p);
    const walkH = Math.sqrt(R2 - s * s) + LEG.SOLE, runH = he - 0.035 * Math.sin(Math.PI * p);
    hipH = walkH + (runH - walkH) * r;
  } else hipH = he + 0.03 * Math.sin(Math.PI * (v - 2 * beta) / (1 - 2 * beta));
  hipH = Math.min(hipH, LEG.HIP - 0.02) - (stable ? 0.05 : 0);
  const uL = ph / TWO_PI - Math.floor(ph / TWO_PI), uR = uL + 0.5 - (uL >= 0.5 ? 1 : 0);
  footTraj(uL, beta, S, lift, TL); footTraj(uR, beta, S, lift, TR);
  // hông xoay theo chân đang ở trước, vai xoay ngược, tay vung ngược chân
  const k = clamp((TL[0] - TR[0]) * mz / Math.max(0.3, S), -1, 1);      // 1 = chân trái ở trước
  const pl = 0.1 * amp * k, cp = Math.cos(pl), sp = Math.sin(pl);
  legSolve(TL, mx, mz, -1, spread, hipH, cp, sp);
  legSolve(TR, mx, mz, 1, spread, hipH, cp, sp);
  P.hipY = hipH - LEG.HIP;
  // thân xoay CỘNG vào thế đứng (giáo sẵn sàng vặn thân 0,32 rad): gán đè thì mỗi lần bắt đầu/dừng bước mũi
  // giáo quét ngang ~0,6 m và tua lật qua cán
  P.pelY = pl; P.tx = 0.14 * amp * Math.max(-0.4, mz); P.ty += sq ? -pl : -0.16 * amp * k;
  P.lax += sw[0] * amp * k; P.rax -= sw[1] * amp * k;
}
function idleLegs(t, id) {
  const b = Math.sin(t * 1.8 + id) * 0.02;
  P.ltx = -0.14; P.lsx = 0.24; P.rtx = 0.1; P.rsx = 0.18; P.ltz = -0.05; P.rtz = 0.05;
  P.hipY = -0.035 + b * 0.5; P.tx = 0.04 + b; P.lkx = 0; P.rkx = 0; P.pelY = 0;
}
// Ngựa phi: bốn chân một khúc (trước trái, trước phải lệch 0,5; hai chân sau ngược pha). Nửa chu kỳ chống
// (ψ ∈ [−π/2, π/2]) chân quét từ −A tới A sao cho móng lùi ĐỀU (sin θ tuyến tính theo ψ) — khớp tốc độ thân
// khi C = 3,6·sin A (cycleLen); nửa đưa về hình sin. Chân một khúc đi qua điểm thấp nhất cả lúc chống lẫn
// lúc đưa nên mình ngựa bập bênh: chúi mũi khi cặp chân sau đưa qua đáy, ngóc đầu khi cặp chân trước đưa
// qua — móng đang đưa nhấc khỏi đất. Hông hạ/nâng để móng thấp nhất vừa chạm đất (trước đây lún tới 9 cm).
const HOOF_Z = [0.5, 0.5, -0.5, -0.5], HOOF_O = [0, 0.5, Math.PI, Math.PI + 0.5];
const HOOF_TH = new Float64Array(4);         // góc bốn chân [trước trái, trước phải, sau trái, sau phải]
const horseA = (amp) => 0.75 * amp;
function gallop(ph, amp) {
  const A = horseA(amp), sA = Math.sin(A), p = 0.12 * amp * Math.cos(ph + 0.25), cp = Math.cos(p), sp = Math.sin(p);
  let lo = 9;
  for (let i = 0; i < 4; i++) {
    let s = ph + HOOF_O[i] + Math.PI / 2; s = s - TWO_PI * Math.floor(s / TWO_PI) - Math.PI / 2;     // ψ ∈ [−π/2, 3π/2)
    const th = s < Math.PI / 2 ? Math.asin(sA * s / (Math.PI / 2)) : A * Math.sin(s);
    const y = 0.92 - 0.9 * Math.cos(th), z = HOOF_Z[i] - 0.9 * Math.sin(th);
    HOOF_TH[i] = th; lo = Math.min(lo, y * cp - z * sp);
  }
  P.ltx = HOOF_TH[0]; P.rtx = HOOF_TH[1]; P.lsx = HOOF_TH[2]; P.rsx = HOOF_TH[3];
  P.pitch = p; P.hipY = -lo / cp;
  P.tx = -0.1 * amp * Math.sin(ph) + 0.1 * amp;
}
// kênh dáng đi viết ra (ltx ltz lsx rtx rtz rsx lkx rkx hipY pelY tx ty lax rax); lúc gần đứng yên trộn dần
// với thế đứng: saveGait() chép thế đứng ra IDLE trước gait(), blendGait(wg) trộn lại sau
const IDLE = new Float64Array(14);
function saveGait() {
  IDLE[0] = P.ltx; IDLE[1] = P.ltz; IDLE[2] = P.lsx; IDLE[3] = P.rtx; IDLE[4] = P.rtz; IDLE[5] = P.rsx; IDLE[6] = P.lkx;
  IDLE[7] = P.rkx; IDLE[8] = P.hipY; IDLE[9] = P.pelY; IDLE[10] = P.tx; IDLE[11] = P.ty; IDLE[12] = P.lax; IDLE[13] = P.rax;
}
function blendGait(wg) {
  P.ltx = IDLE[0] + (P.ltx - IDLE[0]) * wg; P.ltz = IDLE[1] + (P.ltz - IDLE[1]) * wg; P.lsx = IDLE[2] + (P.lsx - IDLE[2]) * wg;
  P.rtx = IDLE[3] + (P.rtx - IDLE[3]) * wg; P.rtz = IDLE[4] + (P.rtz - IDLE[4]) * wg; P.rsx = IDLE[5] + (P.rsx - IDLE[5]) * wg;
  P.lkx = IDLE[6] + (P.lkx - IDLE[6]) * wg; P.rkx = IDLE[7] + (P.rkx - IDLE[7]) * wg; P.hipY = IDLE[8] + (P.hipY - IDLE[8]) * wg;
  P.pelY = IDLE[9] + (P.pelY - IDLE[9]) * wg; P.tx = IDLE[10] + (P.tx - IDLE[10]) * wg; P.ty = IDLE[11] + (P.ty - IDLE[11]) * wg;
  P.lax = IDLE[12] + (P.lax - IDLE[12]) * wg; P.rax = IDLE[13] + (P.rax - IDLE[13]) * wg;
}

// Dựng tư thế đích của một lính vào out (Float32Array NCH). t: đồng hồ trận.
export function poseFor(a, kit, K, t, out) {
  reset();
  const w = KIT_WEAPON[kit], horse = kit === "NG_KY", id = a.id * 1.37;
  // dáng đi chỉ khi đứng/đi (move) hoặc đang bị đẩy lùi (hit): crowd chỉ cập nhật a.spd trong stride(), nên xác,
  // người bị hất tung, đang nằm còn giữ tốc độ lúc trúng đòn — cổ chân, hông giữ nguyên nhịp chạy cũ
  const amp = a.state === "move" || a.state === "hit" ? Math.min(1, (a.spd || 0) / (horse ? 5 : 3.2)) : 0;
  const ready = a.ready || a.windup > 0 || a.atkT < 0.5;
  STANCE[w](P, ready);
  if (horse) { if (amp > 0.05) gallop(a.walk, amp); else P.hipY = -0.02; }      // đứng: móng chạm đất
  else {
    const wg = smooth(0.03, 0.18, amp);
    if (wg < 1) {
      idleLegs(t, id);
      if (K.stable) { P.ltz -= 0.08; P.rtz += 0.08; P.lsx += 0.12; P.rsx += 0.12; P.hipY -= 0.04; }
    }
    if (wg > 0) {
      if (wg < 1) saveGait();
      const vx0 = a.mvx ?? 0, vz0 = a.mvz ?? 1, ml = Math.sqrt(vx0 * vx0 + vz0 * vz0), mx = ml > 0.2 ? vx0 / ml : 0, mz = ml > 0.2 ? vz0 / ml : 1;
      gait(a.walk, amp, mx, mz, SWING[w], !!K.stable, w === "giao");
      if (wg < 1) blendGait(wg);
    }
  }

  // đòn: báo trước → đánh → hồi (K1 = BASE + A[0], K2 = K1 + A[1], không dựng đối tượng mới mỗi khung)
  const A = ATTACK[w];
  if (a.windup > 0) {
    for (const k of KEYS) BASE[k] = P[k];
    mixInto(BASE, A[0], easeOut(clamp01(1 - a.windup / (a.windupT || K.windup))));
    if (K.heavy) { P.tx -= 0.05 * Math.sin(t * 40); }      // lực sĩ gồng rung trước khi nện
  } else if (a.atkT < 0.5) {
    const A0 = A[0], A1 = A[1];
    if (a.atkT < 0.16) {
      const s = easeOut(clamp01(a.atkT / 0.1));
      for (const k of KEYS) { const k1 = k in A0 ? A0[k] : P[k], k2 = k in A1 ? A1[k] : k1; P[k] = k1 + (k2 - k1) * s; }
    } else {
      const r = ease(clamp01((a.atkT - 0.16) / 0.34));
      for (const k of KEYS) { const b = P[k], k1 = k in A0 ? A0[k] : b, k2 = k in A1 ? A1[k] : k1; P[k] = k2 + (b - k2) * r; }
    }
  }
  if (a.flinch > 0) { const k = a.flinch / 0.18; P.tx -= 0.22 * k; P.hipY -= 0.03 * k; }
  // đỡ khiên: giơ khiên che mặt, hạ trọng tâm, vũ khí thu về
  if (a.blockT > 0) {
    const k = Math.sin(clamp01(a.blockT / 0.32) * Math.PI) ** 0.5;
    P.lax += (-1.35 - P.lax) * k; P.laz += (0.25 - P.laz) * k; P.lfx += (-0.95 - P.lfx) * k;
    P.tx -= 0.12 * k; P.hipY -= 0.08 * k; P.lsx += 0.3 * k; P.rsx += 0.3 * k; P.ty += 0.25 * k;
  }
  // nhảy lùi né đòn gồng của tướng
  if (a.evadeT > 0 && !horse) {
    const k = Math.sin(clamp01(1 - a.evadeT / 0.3) * Math.PI);
    P.tx -= 0.3 * k; P.hipY += -0.12 * k + 0.1 * Math.sin(clamp01(1 - a.evadeT / 0.3) * Math.PI); P.ltx += 0.6 * k; P.lsx += 0.5 * k; P.rtx -= 0.35 * k; P.rsx += 0.6 * k;
    P.lax -= 0.4 * k; P.rax -= 0.3 * k;
  }
  // lao húc (lực sĩ): chạy cúi người, chùy giơ cao
  if (a.chargeT > 0) {
    const K1 = ATTACK[w][0];
    for (const k in K1) if (k[0] === "r" || k[0] === "l") { if (k[1] === "a" || k[1] === "f") P[k] = K1[k]; }
    P.tx = 0.45; P.ty = 0.1;
  }
  // tháo chạy: chạy cúi, hai tay vung loạn, vũ khí buông thõng
  if (a.fleeT > 0 && a.state === "move") {
    P.rax = -2.2 + 0.5 * Math.sin(t * 11 + id); P.lax = -2.0 + 0.5 * Math.cos(t * 10 + id); P.raz = 0.4; P.laz = -0.4; P.rfx = -0.4; P.lfx = -0.4;
    P.tx += 0.2;
  }

  // phản ứng
  const st = a.state;
  if (st === "hit") {
    const k = Math.sin(clamp01(1 - a.st / 0.32) * Math.PI) ** 0.6, d = a.hitFront ?? 1;
    P.tx -= 0.6 * k * d; P.pitch -= 0.12 * k * d; P.hipY -= 0.06 * k;
    P.rax += 0.9 * k; P.lax += 0.9 * k; P.raz += 0.5 * k; P.laz -= 0.5 * k; P.rfx -= 0.3 * k; P.lfx -= 0.3 * k;
    P.ltx += 0.35 * k * d; P.lsx += 0.3 * k; P.rsx += 0.35 * k; P.ty += 0.3 * k * (a.id % 2 ? 1 : -1);
  } else if (st === "launch") {
    const k = clamp01(a.st * 4);
    P.pitch = -Math.min(2.4, a.st * 6.5); P.lift = 0.3 * k;
    P.rax = -2.6; P.lax = -2.4; P.raz = 0.6; P.laz = -0.6; P.rfx = -0.4; P.lfx = -0.4;
    P.ltx = -0.9; P.lsx = 1.2; P.rtx = -0.4; P.rsx = 0.7; P.tx = -0.3;
  } else if (st === "down") {
    const up = clamp01((0.3 - a.st) / 0.3);          // 0,3 s cuối: chống tay đứng dậy
    lying(1 - up, -1); if (up > 0) { P.tx += 0.9 * up; P.lsx += 1.6 * up; P.rsx += 1.6 * up; P.ltx -= 1.0 * up; P.rtx -= 1.0 * up; P.hipY -= 0.4 * up; }
  } else if (st === "dead") {
    dying(a, horse);
  } else if (st === "swim") {
    // bơi (B20: rơi xuống sông thì bơi vào bờ — naval.js): nằm sấp trên mặt nước, hai tay sải luân phiên, chân đạp nước
    const ph = t * 4.2 + id;
    P.pitch = 1.0; P.lift = 0; P.tx = -0.3;
    P.rax = -1.6 - 1.2 * Math.sin(ph); P.lax = -1.6 - 1.2 * Math.sin(ph + Math.PI); P.raz = 0.35; P.laz = -0.35; P.rfx = -0.4; P.lfx = -0.4;
    P.ltx = 0.35 * Math.sin(ph * 1.7); P.rtx = -0.35 * Math.sin(ph * 1.7); P.lsx = 0.3; P.rsx = 0.3;
  }
  // khán giả reo hò: giơ vũ khí, nhún nhảy; lệch pha theo id cho khỏi đồng loạt
  if (a.cheer > 0) {
    const k = Math.min(1, a.cheer * 2), ph = t * 7 + a.id * 1.9;
    P.rax += (-2.7 + 0.35 * Math.sin(ph) - P.rax) * k; P.rfx += (-0.3 - P.rfx) * k; P.raz += (0.3 - P.raz) * k;
    if (a.id % 3) { P.lax += (-2.3 + 0.35 * Math.cos(ph) - P.lax) * k; P.laz += (-0.35 - P.laz) * k; }
    P.hipY += Math.abs(Math.sin(ph)) * 0.12 * k; P.tx -= 0.15 * k;
  } else if (a.role === "spectator") { P.ty += Math.sin(t * 0.7 + a.id) * 0.25; P.tx += 0.05 * Math.sin(t * 1.3 + a.id * 2); }
  if (a.panicT > 0 && st === "move" && a.windup <= 0) { P.rax = -2.5 + 0.3 * Math.sin(t * 9 + id); P.lax = -2.3; P.rfx = -0.3; }
  writeOut(out);
  return out;
}

function lying(k, dir) {
  // dir −1 = nằm ngửa, +1 = nằm sấp. Gốc lưới ở chân nên nhấc lên một chút cho khỏi lún đất.
  P.pitch = 1.48 * dir * k; P.lift = 0.14 * k;
  P.rax = -2.6 * k; P.lax = -2.3 * k; P.raz = 0.7 * k; P.laz = -0.9 * k; P.rfx = -0.3 * k; P.lfx = -0.5 * k;
  P.ltx = -0.2 * k; P.lsx = 0.35 * k; P.rtx = 0.05 * k; P.rsx = 0.1 * k; P.tx = 0.05 * k * -dir; P.hipY = -0.02 * k;
  P.ltz = -0.12 * k; P.rtz = 0.15 * k;
}

// Bốn kiểu ngã theo id: ngửa, sấp, quỵ gối rồi đổ, xoay nghiêng. Ngựa đổ nghiêng.
function dying(a, horse) {
  const T = a.dieT, style = a.launchDeath ? 0 : a.id % 4;
  if (horse) {
    const k = ease(clamp01(T / 0.7));
    P.roll = 1.35 * k * (a.id % 2 ? 1 : -1); P.lift = 0.1 * k; P.ltx = -0.6 * k; P.rtx = 0.4 * k; P.lsx = 0.5 * k; P.rsx = -0.5 * k;
    P.tx = -0.6 * k; P.rax = -2.4 * k; P.lax = -2.0 * k;
    return;
  }
  if (style === 0) { lying(ease(clamp01(T / 0.5)), -1); P.tx -= 0.3 * Math.sin(clamp01(T / 0.5) * Math.PI); }
  else if (style === 1) {
    const b = ease(clamp01(T / 0.16)), f = ease(clamp01((T - 0.12) / 0.45));
    P.lsx += 0.9 * b; P.rsx += 0.7 * b; P.hipY -= 0.18 * b; P.tx += 0.4 * b;
    if (f > 0) { lying(f, 1); P.rax = -2.8 * f; P.lax = -2.6 * f; }
  } else if (style === 2) {
    const kn = ease(clamp01(T / 0.3)), f = ease(clamp01((T - 0.55) / 0.4));
    P.ltx = -1.45 * kn; P.rtx = -1.4 * kn; P.lsx = 2.5 * kn; P.rsx = 2.45 * kn; P.hipY = -0.46 * kn;
    P.tx = 0.35 * kn; P.rax = 0.1; P.lax = 0.1; P.rfx = -0.3; P.lfx = -0.3; P.raz = 0.15; P.laz = -0.15;
    if (f > 0) { P.pitch = 1.1 * f; P.lift = 0.05 * f; P.tx += 0.5 * f; P.rax = -1.6 * f; P.lax = -1.4 * f; }
  } else {
    const k = ease(clamp01(T / 0.55)), s = a.id % 8 < 4 ? 1 : -1;
    P.roll = 1.45 * k * s; P.lift = 0.12 * k; P.ty = 0.6 * k * s; P.tz = -0.3 * k * s;
    P.raz = 1.2 * k; P.laz = -1.2 * k; P.rax = -0.6 * k; P.ltx = -0.5 * k; P.lsx = 0.8 * k; P.rtx = 0.3 * k;
  }
}

// ---- pha bước, làm mượt tư thế ---------------------------------------------------------------------
// Tốc độ thật, hướng đi (khung thân, làm mượt) và pha bước chân lấy từ quãng đã đi: không bước khi bị
// đẩy, khi đứng; chu kỳ khớp dáng đi (cycleLen) nên chân chống không trượt. Ngựa lùi thì chân chạy ngược.
export function advanceStride(a, px, pz, dt) {
  const dx = a.x - px, dz = a.z - pz, moved = Math.sqrt(dx * dx + dz * dz);
  a.spd += (moved / dt - a.spd) * Math.min(1, dt * 10);
  const sy = Math.sin(a.yaw), cy = Math.cos(a.yaw), horse = !!a.K.mounted;
  if (a.mvz === undefined) { a.mvx = 0; a.mvz = 1; }
  if (moved > 1e-6) {
    const k = Math.min(1, dt * 8);
    a.mvx += ((dx * cy - dz * sy) / moved - a.mvx) * k; a.mvz += ((dx * sy + dz * cy) / moved - a.mvz) * k;
  }
  const amp = Math.min(1, a.spd / (horse ? 5 : 3.2)), ml = Math.sqrt(a.mvx * a.mvx + a.mvz * a.mvz);
  const d = moved * TWO_PI / (cycleLen(amp, ml > 0.2 ? a.mvx / ml : 0, horse) * a.scale);
  a.walk += horse && dx * sy + dz * cy < 0 ? -d : d;
}

// Trộn tư thế hiện tại P về đích T. k: hệ số chung của khung (mềm, hoặc "bắt" khi ra đòn/trúng đòn);
// kLeg: hệ số cho kênh chân + hông + chúi mình (nhanh hơn khi đang chạy, để bàn chân chống không bị trễ
// so với thân mà trượt). ty cùng nhịp với pelY: người cầm giáo vặn thân ngược hông (ty = −pelY) — trộn khác
// nhịp thì vai, cây giáo 2 m lắc ±0,07 rad mỗi bước.
const LEGCH = new Uint8Array(NCH);
for (const k of ["hipY", "pelY", "ty", "pitch", "ltx", "ltz", "lsx", "rtx", "rtz", "rsx", "lkx", "rkx"]) LEGCH[CH[k]] = 1;
export function smoothPose(P, T, k, kLeg) {
  for (let c = 0; c < NCH; c++) P[c] += (T[c] - P[c]) * (LEGCH[c] ? kLeg : k);
}
export const legRate = (a) => 18 + 42 * Math.min(1, 4 * (a.spd || 0) / (a.K?.mounted ? 5 : 3.2));

// ---- chuyển động phụ -----------------------------------------------------------------------------
// Vạt áo: lò xo tắt dần. k độ cứng (1/s²), zeta tắt dần, kT phần góc đùi đẩy vạt sau theo, kF vạt trước
// (vạt không lẹm vào đùi; thiếu thì = kT), drag vạt hất ra sau theo vận tốc (rad mỗi m/s, đơn vị thân), acc
// đà khi tăng/giảm tốc, turn đà khi xoay người, lat vạt lệch theo vận tốc ngang. Giáp lá của lực sĩ cứng,
// ít đung đưa. kF = 1: vạt trước đi đúng góc đùi — 0,8 thì khi chạy (đùi −1,1 rad) vạt trễ 0,2 rad, điểm xoay
// ở eo (lệch 0,155 m) không còn che được, ống quần đen lòi ra trước vạt 4 cm.
const flapP = (o) => ({ ...o, kF: o.kF ?? o.kT, c: damping(o.k, o.zeta) });
const CLOTH = flapP({ k: 95, zeta: 0.3, kT: 0.8, kF: 1, drag: 0.1, acc: 0.1, turn: 0.07, lat: 0.06 });
const FLAP = {
  NG_TANK: flapP({ k: 330, zeta: 0.75, kT: 0.85, kF: 1, drag: 0.03, acc: 0.03, turn: 0.02, lat: 0.02 }),
  NG_KY: flapP({ k: 150, zeta: 0.35, kT: 0, drag: 0.06, acc: 0.07, turn: 0.03, lat: 0.04 }),
};
// ĐỀ XUẤT BẢN THỬ: rad vạt trước vểnh thêm khi đùi nằm ngang (quỵ gối lúc chết: ống quần lòi ra trước vạt 7 cm →
// 2 cm; phần còn lại là gốc vạt nằm trong đùi, không tránh được với điểm xoay ở eo)
const FLAP_LAP = 0.25;
// Tua giáo, đuôi ngựa: dây n đốt treo ở điểm neo (khung khớp j) — neo = chân mũi giáo, mông ngựa.
const TAS = {
  DV_GIAO: { j: JI.faR, p: [0, HAND, SPEAR.DV_GIAO - 0.79], n: 3, seg: 0.1, damp: 3.5 },
  NG_GIAO: { j: JI.faR, p: [0, HAND, SPEAR.NG_GIAO - 0.79], n: 3, seg: 0.1, damp: 3.5 },
  NG_KY: { j: JI.pelvis, p: [0, 0.13, -0.8], n: 3, seg: 0.21, damp: 3.4 },
};
const TAS_O = JI.tas * 12;
// tuỳ chọn dây dùng chung (không cấp phát mỗi lần); gán thử một lượt để trường thành số thực, không hằng
// ngay từ đầu — kẻo lần gán đầu trong vòng nóng làm V8 đổi map và bỏ tối ưu soldierFrame
const ROPE = { damp: 2.5, floor: 0.5, reset: false };
ROPE.damp = 1.5; ROPE.floor = -0.5; ROPE.reset = true; ROPE.reset = false;

// Trạng thái mô phỏng của một lính (cấp một lần, lính được tái dùng qua pool thì resetMotion khi spawn). Mọi
// số đều nằm trong mảng typed (đối tượng sm không có trường số bị gán lại → map ổn định, V8 tối ưu được).
//   fl: 4 lò xo vạt [góc, vận tốc] × (trước x, trước z, sau x, sau z);
//   mo: [x, z, vx, vz, yaw, tốc độ quay, đã có mẫu, trọng số IK (−1 = khung đầu, lấy ngay đích),
//        dây treo đang chạy (1) hay phải đặt lại (0)]; rp: dây treo 3 đốt × 6;
//   gc: mẫu đất đã lấy — mỗi bàn chân [x, z, độ cao, góc dốc, yaw lúc lấy dốc], ngựa [x, z, yaw, pitch,
//   roll, hạ]; [10..15] thân nằm (lieOnSlope) [x, z, yaw, hướng, góc dốc dọc, góc dốc ngang]. heightAt
//   đắt (~1 µs) nên bàn chân còn nằm yên (xê dịch < 2,5 cm) thì dùng lại mẫu cũ;
//   tn: xoay tại chỗ (turnFeet) [lệch trái, lệch phải, chân đang bước (−1 = không), tiến độ bước, lệch của chân
//   đang bước kể từ lúc nhấc, yaw khung trước].
function motion(a) {
  if (a.sm) return a.sm;
  const m = a.sm = { fl: new Float32Array(8), mo: new Float64Array(9), rp: new Float32Array(18), gc: new Float64Array(16), tn: new Float64Array(6) };
  resetMotion(a);
  return m;
}
export function resetMotion(a) {
  const m = a.sm; if (!m) return;
  m.fl.fill(NaN); m.mo.fill(0); m.mo[7] = -1; m.rp.fill(0); m.gc.fill(NaN); m.tn.fill(NaN);
}
const near2 = (gc, o, x, z, d) => Math.abs(x - gc[o]) < d && Math.abs(z - gc[o + 1]) < d;

// ---- thân nằm trên dốc (xác, người bị quật ngã) ------------------------------------------------------
// IK tắt khi chết/nằm; lying(), dying() đổ thân quanh bàn chân như trên đất phẳng, nên trên mái lũy, vách hố,
// sườn gò thân nằm ngửa phía dốc lên thì đầu, ngực vùi trong đất (0,4–1 m), phía dốc xuống thì chổng ra giữa
// không. Xoay thêm cả thân theo góc dốc từ bàn chân tới giữa thân và tới đầu (lấy góc lớn hơn: không chỗ nào
// vùi): ngã trước/sau (pitch) thì góc dốc dọc hướng mặt, đổ nghiêng (roll) thì góc dốc sang bên. Trọng số theo
// mức đã ngã (|pitch|, |roll| của tư thế) nên lúc đứng, lúc mới ngã vẫn như cũ. Không cộng dốc ngang vào roll
// cho thân nằm dọc (Euler YXZ: roll quay TRƯỚC pitch, sẽ lắc đầu sang bên).
// ĐỀ XUẤT BẢN THỬ: m (× tỉ lệ) từ bàn chân tới giữa thân, tới đầu; góc xoay thêm tối đa (rad)
const LIE_D1 = 0.8, LIE_D2 = 1.5, LIE_MAX = 0.8;
function lieElev(ground, x, z, g0, dx, dz, sc) {
  const d1 = LIE_D1 * sc, d2 = LIE_D2 * sc;
  const e1 = Math.atan((ground(x + dx * d1, z + dz * d1) - g0) / d1), e2 = Math.atan((ground(x + dx * d2, z + dz * d2) - g0) / d2);
  return clamp(e1 > e2 ? e1 : e2, -LIE_MAX, LIE_MAX);
}
function lieOnSlope(a, gc, S, x, z, g0, sc, sy, cy, ground) {
  const p = S[CH.pitch], r = S[CH.roll];
  const kp = smooth(0.25, 1.1, Math.abs(p)), kr = smooth(0.25, 1.1, Math.abs(r));
  const ky = clamp01(1 - a.y / 0.3);                  // còn đang rơi (hất tung rồi chết) thì chưa
  if ((kp < 1e-3 && kr < 1e-3) || ky < 1e-3) return;
  const sp = p > 0 ? 1 : -1, sr = r > 0 ? 1 : -1, key = sp + 3 * sr;
  if (gc[13] !== key || !near2(gc, 10, x, z, 0.02) || Math.abs(a.yaw - gc[12]) > 0.02) {
    gc[10] = x; gc[11] = z; gc[12] = a.yaw; gc[13] = key;
    // đầu về phía trước (+ hướng mặt) khi pitch > 0; về −x thân (bên trái, phải của lưới là +x) khi roll > 0
    gc[14] = lieElev(ground, x, z, g0, sy * sp, cy * sp, sc);
    gc[15] = lieElev(ground, x, z, g0, -cy * sr, sy * sr, sc);
  }
  // đất dâng về phía đầu (góc e > 0) thì thân bớt ngả; hạ xuống thì ngả thêm
  S[CH.pitch] -= sp * gc[14] * kp * ky;
  S[CH.roll] -= sr * gc[15] * kr * ky;
}

// ---- xoay tại chỗ: bàn chân đứng giữ hướng cũ -----------------------------------------------------------
// Pha bước chỉ tăng theo quãng đi, nên lính đứng xoay người (quay mặt theo tướng, về tuyến) trước đây xoay cả
// hai bàn chân quanh gốc như bàn xoay (180° trượt 0,42 m). Nay mỗi bàn chân nhớ thân đã xoay thêm bao nhiêu
// (f) kể từ lúc nó đặt xuống: bàn chân xoay −f quanh trục đứng qua gốc trong khung hông, giải lại đùi, gối,
// dạng chân (như legSolve) — bàn chân đứng yên trên đất, hông vặn trên hai chân. Lệch quá TURN.start
// (đang xoay) hay TURN.settle (đã thôi xoay) thì bước: nhấc bàn chân lệch nhiều hơn, đặt về đúng thế đứng
// trong TURN.dur giây; chân đang đứng lệch quá TURN.max (xoay rất nhanh) thì bị kéo trượt theo. Chỉ khi chân
// không chạy theo dáng đi (đứng, nhích chậm), lính sống trong LOD gần (trọng số IK w); đang ra đòn, đỡ, né thì
// không bước. Ngựa không dùng. ĐỀ XUẤT BẢN THỬ: ngưỡng, thời gian bước, độ nhấc — chọn bằng đo trượt (Node).
// max 1,3 rad: hai bàn chân về gần một đường trước–sau (thế đứng tấn giữa lúc xoay), chưa bắt chéo
const TURN = { start: 0.3, settle: 0.2, max: 1.3, dur: 0.18, lift: 0.07 };
const wrapPi = (v) => v - TWO_PI * Math.round(v / TWO_PI);
function turnFeet(a, tn, S, yaw, dt, w, om) {
  // tn: [lệch trái, lệch phải (thân đã xoay bao nhiêu so với lúc bàn chân đặt xuống), chân đang bước, tiến độ,
  // tổng lệch của chân đang bước kể từ lúc nhấc, yaw khung trước] — cộng dồn từng khung nên xoay quá π không lật dấu
  if (tn[5] !== tn[5]) { tn[0] = 0; tn[1] = 0; tn[2] = -1; tn[3] = 0; tn[4] = 0; tn[5] = yaw; }
  const amp = a.state === "move" || a.state === "hit" ? Math.min(1, (a.spd || 0) / 3.2) : 0;
  const kt = w * (1 - smooth(0.03, 0.18, amp)), dy = wrapPi(yaw - tn[5]);
  let fL = tn[0] + dy, fR = tn[1] + dy, st = tn[2], s = tn[3];
  tn[5] = yaw;
  if (w < 1e-3) { fL = 0; fR = 0; st = -1; }         // LOD xa, chết, đang bay: chân theo thân luôn
  else if (kt < 0.3) {           // dáng đi lo bàn chân: độ lệch tắt dần, bỏ bước dở
    const k = dt > 0 ? Math.exp(-dt * 15) : 1;
    fL *= k; fR *= k; st = -1;
  } else if (dt > 0) {
    if (st >= 0) {
      tn[4] += dy;
      // xoay nhanh (quay ngoắt theo tướng) thì bước nhanh hơn, kẻo chân đứng bị kéo trượt
      const dur = Math.max(0.08, TURN.dur * Math.min(1, 4 / (Math.abs(om) + 1e-6)));
      if ((s += dt / dur) >= 1) { if (st) fR = 0; else fL = 0; st = -1; }
    }
    if (st < 0 && !(a.windup > 0 || a.atkT < 0.5 || a.blockT > 0 || a.evadeT > 0)) {
      const th = Math.abs(om) > 0.5 ? TURN.start : TURN.settle, aL = Math.abs(fL), aR = Math.abs(fR);
      if (aL > th || aR > th) { st = aR > aL ? 1 : 0; s = 0; tn[4] = st ? fR : fL; }
    }
    if (st >= 0) {                // bàn chân đang bước: độ lệch về 0 theo ease(s), kể cả phần thân còn xoay thêm
      const f = tn[4] * (1 - ease(s));
      if (st) fR = f; else fL = f;
    }
    fL = clamp(fL, -TURN.max, TURN.max); fR = clamp(fR, -TURN.max, TURN.max);   // quá thì chân đứng trượt theo
  }
  tn[0] = fL; tn[1] = fR; tn[2] = st; tn[3] = s;
  if (kt < 1e-3) return;
  for (let side = 0; side < 2; side++) {
    const f = side ? fR : fL, lift = st === side ? TURN.lift * Math.sin(Math.PI * s) : 0;
    if (Math.abs(f) < 1e-4 && lift === 0) continue;
    const thI = side ? CH.rtx : CH.ltx, knI = side ? CH.rsx : CH.lsx, tzI = side ? CH.rtz : CH.ltz;
    footPos(S[thI], S[knI], LEG.L1, LEG.L2, FP);
    // bàn chân trong khung hông (x ngang, z trước; như vòng IK dưới), xoay −f, đổi về so với khớp háng
    const tz = S[tzI], hx = side ? LEG.HX : -LEG.HX, px = hx - FP[0] * Math.sin(tz), pz = FP[1], c = Math.cos(f), sn = Math.sin(f);
    const qx = px * c - pz * sn - hx, qz = px * sn + pz * c, qy = FP[0] * Math.cos(tz) + lift;
    legIK(-Math.sqrt(qx * qx + qy * qy), qz, LEG.L1, LEG.L2, IK2);
    S[thI] += (IK2[0] - S[thI]) * kt; S[knI] += (IK2[1] - S[knI]) * kt; S[tzI] += (Math.atan2(qx, -qy) - S[tzI]) * kt;
  }
}

// ---- một lính, một khung ---------------------------------------------------------------------------
// a: lính (kit, yaw, scale, state, role, y = độ cao trên đất, spd …); x, y, z: gốc (y đã gồm a.y, độ lún
// khi chết); g0: độ cao đất dưới gốc; pose: tư thế đã trộn (chỉ đọc); dt: đồng hồ trận (0 khi hit-stop →
// mô phỏng đứng yên); ground(x, z): hàm độ cao; near: trong LOD gần (IK + mô phỏng; xa thì vạt treo theo
// đích, tua treo thẳng); out: NJ × 12 số affine.
const S = new Float32Array(NCH), FP = [0, 0], LS = [0, 0];
const FW = new Float64Array(4);          // x, z bàn chân trái, phải (thế giới)
const CT = new Float64Array(2);          // mức chạm đất trái, phải
export function soldierFrame(a, skel, x, y, z, g0, pose, dt, ground, near, out) {
  const m = motion(a), sc = a.scale || 1, yaw = a.yaw, horse = skel === "horse";
  const sy = Math.sin(yaw), cy = Math.cos(yaw);
  S.set(pose);

  // ---- vận tốc, gia tốc, tốc độ quay của gốc (đơn vị thân) cho vạt áo ----
  let vf = 0, vl = 0, af = 0, al = 0, om = 0;
  const mo = m.mo, sim = near && dt > 0;
  if (sim) {
    if (!mo[6]) { mo[0] = x; mo[1] = z; mo[2] = mo[3] = 0; mo[4] = yaw; mo[5] = 0; mo[6] = 1; }
    let vx = (x - mo[0]) / dt, vz = (z - mo[1]) / dt;
    if (vx * vx + vz * vz > 400) { vx = mo[2]; vz = mo[3]; }          // dịch chỗ tức thời (pool, lab quay vòng)
    const k = 1 - Math.exp(-dt * 14), nvx = mo[2] + (vx - mo[2]) * k, nvz = mo[3] + (vz - mo[3]) * k;
    const ax = (nvx - mo[2]) / dt, az = (nvz - mo[3]) / dt;
    let dyaw = yaw - mo[4]; dyaw -= TWO_PI * Math.round(dyaw / TWO_PI);
    mo[5] += (dyaw / dt - mo[5]) * k;
    mo[0] = x; mo[1] = z; mo[2] = nvx; mo[3] = nvz; mo[4] = yaw;
    vf = (nvx * sy + nvz * cy) / sc; vl = (nvx * cy - nvz * sy) / sc; af = (ax * sy + az * cy) / sc; al = (ax * cy - az * sy) / sc; om = mo[5];
  } else if (!near) mo[6] = 0;

  // ---- trọng số IK: lính sống, đứng trên đất, trong LOD gần; trộn mượt khi đổi trạng thái ----
  const ok = near && a.y <= 0.02 && a.role !== "spectator" && a.state !== "dead" && a.state !== "launch" && a.state !== "down" && a.state !== "swim";
  if (!near) mo[7] = 0;
  else if (mo[7] < 0) mo[7] = ok ? 1 : 0;
  else if (dt > 0) mo[7] += ((ok ? 1 : 0) - mo[7]) * (1 - Math.exp(-dt * 12));
  const w = mo[7];

  if (!horse) {
    turnFeet(a, m.tn, S, yaw, near ? dt : 0, w, om);
    // ---- chân người: hạ hông, dời bàn chân theo đất, cổ chân bám dốc ----
    const L1 = LEG.L1, L2 = LEG.L2, pl = S[CH.pelY], cp = Math.cos(pl), spl = Math.sin(pl);
    const fw = S[CH.fwd] * sc, rx0 = x + sy * fw, rz0 = z + cy * fw, hipH = LEG.HIP + S[CH.hipY];
    let dyL = 0, dyR = 0;
    for (let side = 0; side < 2; side++) {
      const th = S[side ? CH.rtx : CH.ltx], kn = S[side ? CH.rsx : CH.lsx], tz = S[side ? CH.rtz : CH.ltz];
      footPos(th, kn, L1, L2, FP);
      const sole = hipH + FP[0] - LEG.SOLE, c = contact(sole);
      CT[side] = c;
      if (w > 1e-3) {
        const lx = (side ? LEG.HX : -LEG.HX) - FP[0] * Math.sin(tz), lz = FP[1];
        const rx = lx * cp + lz * spl, rz = -lx * spl + lz * cp;
        const wx = rx0 + (rx * cy + rz * sy) * sc, wz = rz0 + (-rx * sy + rz * cy) * sc;
        FW[side * 2] = wx; FW[side * 2 + 1] = wz;
        // đất dưới bàn chân so với dưới gốc (mẫu cũ nếu bàn chân chưa xê dịch 2,5 cm — cả chân đang nhấc: trước để
        // 15 cm thì trên mái lũy, vách hố (dốc 1–1,4) mẫu cũ sai 15–20 cm, bàn chân hạ xuống lún vào dốc và cổ chân,
        // hông giật răng cưa mỗi 2–3 khung); bàn chân đang chạm đất mà lún thì nhấc lên cho đế sát đất
        const gc = m.gc, o = side * 5;
        if (!near2(gc, o, wx, wz, 0.025)) { gc[o] = wx; gc[o + 1] = wz; gc[o + 2] = ground(wx, wz); gc[o + 3] = NaN; }
        let dy = (gc[o + 2] - g0) / sc + (sole < 0 ? -sole * c : 0);
        if (c * w >= 1e-3) {
          // bàn chân chạm đất nằm nghiêng theo dốc α (vòng cổ chân dưới) → mặt đế dưới cổ chân thấp hơn đất
          // SOLE·(1/cos α − 1) (3,5 cm ở dốc 1, 6 cm ở dốc 1,4): nhấc bù
          if (gc[o + 3] !== gc[o + 3] || Math.abs(yaw - gc[o + 4]) > 0.05) { gc[o + 3] = slopePitch(ground, wx, wz, sy, cy); gc[o + 4] = yaw; }
          dy += LEG.SOLE * (1 / Math.cos(gc[o + 3]) - 1) * c;
        }
        if (side) dyR = dy; else dyL = dy;
      }
    }
    if (w > 1e-3) {
      const D = pelvisDrop(dyL, dyR, 0.35);
      legShift(S[CH.ltx], S[CH.lsx], L1, L2, dyL - D, LS);
      S[CH.ltx] += (LS[0] - S[CH.ltx]) * w; S[CH.lsx] += (LS[1] - S[CH.lsx]) * w;
      legShift(S[CH.rtx], S[CH.rsx], L1, L2, dyR - D, LS);
      S[CH.rtx] += (LS[0] - S[CH.rtx]) * w; S[CH.rsx] += (LS[1] - S[CH.rsx]) * w;
      S[CH.hipY] += D * w;
      // cổ chân: bàn chân chạm đất nằm song song mặt đất (dốc theo hướng mặt); nhấc lên thì giữ góc tư thế
      for (let side = 0; side < 2; side++) {
        const cw = CT[side] * w;
        if (cw < 1e-3) continue;
        const th = side ? CH.rtx : CH.ltx, kn = side ? CH.rsx : CH.lsx, ak = side ? CH.rkx : CH.lkx;
        const gc = m.gc, o = side * 5;
        if (gc[o + 3] !== gc[o + 3] || Math.abs(yaw - gc[o + 4]) > 0.05) { gc[o + 3] = slopePitch(ground, FW[side * 2], FW[side * 2 + 1], sy, cy); gc[o + 4] = yaw; }
        const lvl = gc[o + 3] - S[th] - S[kn] - S[CH.pitch];
        S[ak] += (lvl - S[ak]) * cw;
      }
    }
  } else if (w > 1e-3 || a.state === "dead") {
    // ---- ngựa: chân một khúc, không IK; nghiêng mình theo dốc (trước/sau, trái/phải) và hạ thấp chút.
    // Ngựa chết (đổ nghiêng) vẫn nằm theo dốc dọc, dốc ngang — chỉ bỏ phần nhấc/hạ.
    // Mái lũy, bờ hào dốc 1–1,8, vách hố ~0,9: chúi/ngóc tới 0,75 rad; đất dưới móng trước (sau) còn cao hơn
    // đường mình đã nghiêng (chỗ lõm chân bờ) thì NHẤC cả mình lên thay vì chỉ hạ — trước đây móng trước lún
    // 0,9 m vào mặt lũy. Chân cứng một khúc không bám hết dốc 1,8: còn lún ~0,3 m ở chân mái lũy, và cả con ngựa
    // có lúc bị nhấc hổng 0,2–0,3 m qua chỗ lõm. ĐỀ XUẤT BẢN THỬ: chúi tối đa 0,75 rad, nhấc tối đa 0,6 (đơn vị thân).
    // Bốn mẫu đất dùng lại khi ngựa chưa xê dịch 3 cm, chưa xoay 0,02 rad ----
    const gc = m.gc;
    if (!near2(gc, 0, x, z, 0.03) || Math.abs(yaw - gc[2]) > 0.02) {
      const Lf = 0.6 * sc, Wd = 0.3 * sc;
      const hf = ground(x + sy * Lf, z + cy * Lf), hb = ground(x - sy * Lf, z - cy * Lf);
      const hr = ground(x + cy * Wd, z - sy * Wd), hl = ground(x - cy * Wd, z + sy * Wd);
      const pitch = clamp(-Math.atan((hf - hb) / (2 * Lf)), -0.75, 0.75), roll = clamp(Math.atan((hr - hl) / (2 * Wd)), -0.3, 0.3);
      const sink = 0.08 * Math.min(1, Math.abs(pitch) + Math.abs(roll));
      const drop = Math.min(0, (hf + hb) / 2 - g0, (hr + hl) / 2 - g0) / sc - sink;
      // up: đất ở hai đầu cao hơn đường mình (đã nghiêng) bao nhiêu; lấy max(drop, up) cho liền mạch (không nhảy
      // khi up đổi dấu), đỉnh gò lồi thì chỉ hạ tới khi đầu cao hơn vừa chạm
      const tp = Math.tan(pitch), up = Math.max(hf - (g0 - Lf * tp), hb - (g0 + Lf * tp)) / sc - sink;
      gc[0] = x; gc[1] = z; gc[2] = yaw; gc[3] = pitch; gc[4] = roll; gc[5] = clamp(Math.max(drop, up), -0.3, 0.6);
    }
    const wt = a.state === "dead" ? Math.max(w, ease(clamp01((a.dieT || 0) / 0.5))) : w;
    S[CH.pitch] += gc[3] * wt; S[CH.roll] += gc[4] * wt; S[CH.lift] += gc[5] * w;
  }
  if (!horse && (a.state === "dead" || a.state === "down")) lieOnSlope(a, m.gc, S, x, z, g0, sc, sy, cy, ground);

  // ---- vạt áo (lò xo); ngựa: vạt chăn yên ----
  const F = FLAP[a.kit] || CLOTH, fl = m.fl;
  const pc = Math.abs(S[CH.pitch]) < 0.6 && a.state !== "dead" ? -S[CH.pitch] : 0;     // vạt vẫn rủ xuống khi người ngả
  let xF = F.drag * vf + pc, xB = F.drag * 1.4 * vf + pc, zF = -F.turn * om - F.lat * vl, zB = F.turn * om - F.lat * vl;
  let limF = 9, limB = -9;
  if (!horse) {
    // đùi đưa ra trước đẩy vạt trước; đùi đưa ra sau (và gót đá lên khi gập gối) đẩy vạt sau
    // đùi gần nằm ngang (quỳ, ngồi xổm): điểm xoay vạt nằm dọc theo đùi, vạt phải vểnh lên nằm trên đùi
    const tL = S[CH.ltx], tR = S[CH.rtx], tm = Math.min(tL, tR);
    limF = F.kF * tm + 0.05 - FLAP_LAP * smooth(0.9, 1.4, -tm);
    limB = F.kT * Math.max(tL + 0.3 * Math.max(0, S[CH.lsx] - 0.6), tR + 0.3 * Math.max(0, S[CH.rsx] - 0.6)) - 0.05;
  }
  xF = clamp(Math.min(xF, limF), -1.3, 0.9); xB = clamp(Math.max(xB, limB), -0.9, 1.3);
  zF = clamp(zF, -0.35, 0.35); zB = clamp(zB, -0.35, 0.35);
  if (!near || fl[0] !== fl[0]) { fl[0] = xF; fl[2] = zF; fl[4] = xB; fl[6] = zB; fl[1] = fl[3] = fl[5] = fl[7] = 0; }
  else if (dt > 0) {
    const ia = F.acc * af * dt, il = F.acc * al * dt;    // đà: thân tăng tốc thì vạt tụt lại sau
    fl[1] += ia; fl[5] += ia; fl[3] -= il; fl[7] -= il;
    spring(fl, 0, xF, F.k, F.c, dt); spring(fl, 2, zF, F.k, F.c, dt);
    spring(fl, 4, xB, F.k, F.c, dt); spring(fl, 6, zB, F.k, F.c, dt);
  }
  if (fl[0] > limF) { fl[0] = limF; if (fl[1] > 0) fl[1] *= -0.2; }
  if (fl[4] < limB) { fl[4] = limB; if (fl[5] < 0) fl[5] *= -0.2; }
  S[CH.ffx] = fl[0]; S[CH.ffz] = fl[2]; S[CH.fbx] = fl[4]; S[CH.fbz] = fl[6];

  // ---- ma trận khớp ----
  jointsInto(skel, x, y, z, yaw, sc, S, out);

  // ---- tua giáo / đuôi ngựa: dây treo trong không gian thế giới, khúc "tas" chĩa từ neo tới đuôi dây ----
  const T = TAS[a.kit];
  if (!T) return out;
  const po = T.j * 12, px = T.p[0], py = T.p[1], pz = T.p[2];
  const ax = out[po] * px + out[po + 1] * py + out[po + 2] * pz + out[po + 3];
  const ay = out[po + 4] * px + out[po + 5] * py + out[po + 6] * pz + out[po + 7];
  const az = out[po + 8] * px + out[po + 9] * py + out[po + 10] * pz + out[po + 11];
  let dx = 0, dy = -1, dz = 0;
  if (near) {
    ROPE.damp = T.damp; ROPE.floor = g0 + 0.02; ROPE.reset = mo[8] === 0;
    rope(m.rp, T.n, ax, ay, az, T.seg * sc, dt, ROPE);
    mo[8] = 1;
    const e = (T.n - 1) * 6, ex = m.rp[e] - ax, ey = m.rp[e + 1] - ay, ez = m.rp[e + 2] - az, d = Math.sqrt(ex * ex + ey * ey + ez * ez);
    if (d > 1e-6) { dx = ex / d; dy = ey / d; dz = ez / d; }
  } else mo[8] = 0;
  // quay khúc treo dọc −y về hướng (dx, dy, dz) (Rodrigues, trục (0,−1,0) × d), sau khi xoay theo yaw
  let r00 = 1, r01 = 0, r02 = 0, r10 = 0, r11 = 1, r12 = 0, r20 = 0, r21 = 0, r22 = 1;
  const c = -dy;
  if (c > -0.999) {
    const kx = -dz, kz = dx, f = 1 / (1 + c);
    r00 = 1 - f * kz * kz; r01 = -kz; r02 = f * kx * kz;
    r10 = kz; r11 = 1 - f * (kx * kx + kz * kz); r12 = -kx;
    r20 = f * kx * kz; r21 = kx; r22 = 1 - f * kx * kx;
  } else { r11 = -1; r22 = -1; }
  const o = TAS_O;
  out[o] = (r00 * cy - r02 * sy) * sc; out[o + 1] = r01 * sc; out[o + 2] = (r00 * sy + r02 * cy) * sc; out[o + 3] = ax;
  out[o + 4] = (r10 * cy - r12 * sy) * sc; out[o + 5] = r11 * sc; out[o + 6] = (r10 * sy + r12 * cy) * sc; out[o + 7] = ay;
  out[o + 8] = (r20 * cy - r22 * sy) * sc; out[o + 9] = r21 * sc; out[o + 10] = (r20 * sy + r22 * cy) * sc; out[o + 11] = az;
  return out;
}

// ==== DÂN LÀNG chạy loạn (ambient.js; Hư cấu) — thế mang vác thay cho thế cầm vũ khí ======================
// Chỉ thêm mục mới, không đổi kiểu lính nào. Dân không có trong KITS: ambient.js gọi poseFor với "kit tư thế"
// dưới đây (lưới vẫn là DAN_NAM, DAN_NU, DAN_TRE ở soldiers.js); ready = đang hoảng chạy. Chỉ ghi kênh tay —
// cúi người, ngoái lại, ngồi xổm, chân đứa bé ngồi hông mẹ do ambient.js cộng sau poseFor (dáng đi ghi đè
// tx, ty và kênh chân). Góc tay dò bằng lưới cho bàn tay tới đích ở tư thế gốc (khung thân):
//   ganh — tay phải vịn đòn gánh trước vai (0,13; 0,52; 0,28), tay trái vung; hoảng vẫn giữ đòn;
//   gay  — tay phải chống gậy trước bụng, tay trái chắp sau lưng; hoảng: tay trái che đầu;
//   doi  — tay phải vịn tay nải đội trên đầu; hoảng: hai tay giữ;
//   om   — tay trái ôm tay nải bên hông trái; hoảng: tay phải che đầu;
//   be   — tay trái đỡ con ngồi hông trái; hoảng: tay phải ôm lấy con;
//   tay  — trẻ con tay không / xách bọc (hoảng: ambient.js bật fleeT → tay vung loạn như lính tháo chạy);
//   ngoi — đứa bé được bế: hai tay bám mẹ.
Object.assign(KIT_WEAPON, { DAN_NAM: "ganh", DAN_NAM_GAY: "gay", DAN_NU: "doi", DAN_NU_OM: "om", DAN_NU_BE: "be", DAN_TRE: "tay", DAN_TRE_BE: "ngoi" });
Object.assign(STANCE, {
  ganh: (P) => { P.rax = -0.7; P.ray = -0.4; P.raz = -0.1; P.rfx = -2.0; P.lax = -0.05; P.laz = -0.08; P.lfx = -0.35; },
  gay: (P, ready) => {
    P.rax = -0.12; P.raz = 0.04; P.rfx = -0.7;
    if (ready) { P.lax = -2.2; P.laz = 0.4; P.lfx = -1.2; } else { P.lax = 0.7; P.lay = 0.2; P.laz = 0.4; P.lfx = -0.7; }
  },
  doi: (P, ready) => {
    P.rax = -2.3; P.raz = -0.3; P.rfx = -1.6;
    if (ready) { P.lax = -2.3; P.laz = 0.3; P.lfx = -1.6; } else { P.lax = -0.05; P.laz = -0.08; P.lfx = -0.3; }
  },
  om: (P, ready) => {
    P.lax = -0.35; P.laz = -0.12; P.lfx = -0.45;
    if (ready) { P.rax = -2.2; P.raz = -0.4; P.rfx = -1.2; } else { P.rax = -0.05; P.raz = 0.08; P.rfx = -0.3; }
  },
  be: (P, ready) => {
    P.lax = 0.2; P.laz = 0.2; P.lfx = -1.2;
    if (ready) { P.rax = -0.6; P.ray = -0.8; P.raz = -0.2; P.rfx = -0.6; } else { P.rax = -0.05; P.raz = 0.08; P.rfx = -0.3; }
  },
  tay: (P) => { P.rax = -0.05; P.raz = 0.1; P.rfx = -0.35; P.lax = -0.05; P.laz = -0.1; P.lfx = -0.35; },
  ngoi: (P) => { P.rax = -1.25; P.raz = -0.1; P.rfx = -0.85; P.lax = -1.15; P.laz = 0.1; P.lfx = -0.9; },
});
Object.assign(SWING, { ganh: [0.35, 0], gay: [0, 0.18], doi: [0.3, 0], om: [0, 0.35], be: [0, 0.3], tay: [0.45, 0.45], ngoi: [0, 0] });
// váy đàn bà (vạt DAN_NU dài 0,66–0,68, gấp rưỡi vạt áo lính): đùi đẩy ít hơn, gió cản ít hơn, tắt nhanh hơn —
// thông số vạt áo lính làm tấm váy sau hất ra như đuôi
FLAP.DAN_NU = flapP({ k: 80, zeta: 0.45, kT: 0.6, drag: 0.04, acc: 0.06, turn: 0.05, lat: 0.03 });
