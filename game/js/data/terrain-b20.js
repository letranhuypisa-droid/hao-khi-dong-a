// data/terrain-b20.js — địa hình khúc sông Bạch Đằng của B20 (bản thử): lòng sông, bãi cạn khúc cọc, bờ bùn
// triều, dải bờ sú vẹt, rừng và đồi đá vôi hai bên, ba nhánh sông có thuyền phục. Thuần số, không import three,
// chạy được trong Node (tests/terrain-b20.test.mjs).
//
// Hình học gốc (tâm dòng, bề rộng, con nước, khúc cọc, nhánh sông) lấy từ river-b20.js — không chép lại công thức.
// Mọi số dưới đây là ĐỀ XUẤT BẢN THỬ (bố cục Hư cấu, nén từ canon mapNotes).
//
// Mặt cắt ngang (a = |z − zc(x)|, w = hw(x)):
//   a < w        lòng sông: sâu −4,6 giữa dòng dâng lên mép lòng −1,9; khúc cọc x 480–820 là bãi cạn −2,1 ± 0,2
//                (triều cao ngập ~3,5 m thuyền lớn đi qua cọc chìm; triều ròng còn 0,3–0,7 m, lội được, thuyền mắc cạn)
//   w … w+14     bờ bùn triều dâng lên +2,2 (nửa dưới lộ ra khi triều ròng)
//   w+14 …       dải bờ phẳng +2,2..+3,0 rộng 10–30 m (sú vẹt, lau sậy), rồi đồi rừng / đá vôi dâng lên 18–60 m
// Nhánh sông (Chanh, Rút, Giá): lạch đáy −2,6 rộng 2×16 m dài 150 m, hơi cong (khuất tầm nhìn từ sông cái),
// khoét vào đất bằng smooth-min nên bờ lạch liền với bờ sông, không vách.
//
// bedHeight là HÀM ĐỘ CAO DUY NHẤT của B20 (đáy sông lẫn đất liền). heightAt gọi hàng nghìn lần mỗi khung nên
// bedHeight tra bảng 2 m (Float32Array dựng lười ở lần gọi đầu) nội suy Catmull-Rom, không cấp phát; hàm giải tích
// chính xác là bedHeightExact (dựng bảng, kiểm thử). Lệch bảng ↔ giải tích < 0,05 m (kiểm thử).

import { TIDE, TIDE_Y, zc, hw, RIVER, STAKE_FIELDS } from "./river-b20.js";

export { TIDE, TIDE_Y, zc, hw };

export const WADE_MAX = 0.9;                                     // m nước người lội qua được

const sstep = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
// dâng mềm C1, độ cong nhỏ nhất (tăng tốc đều nửa đầu, hãm đều nửa sau): độ cong 4R/W² — nội suy bảng 2 m lệch ít nhất
const ease2 = (t) => t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);
// dốc mềm C1: cong đều ở hai đầu (k), thẳng ở giữa — sườn đồi dài không gắt hơn 1,33·cao/rộng
const RAMP_K = 0.25, RAMP_N = 1 / (1 - RAMP_K);
const ramp = (t) => t <= 0 ? 0 : t >= 1 ? 1 : RAMP_N * (t < RAMP_K ? t * t / (2 * RAMP_K) : t > 1 - RAMP_K ? 1 - RAMP_K - (1 - t) * (1 - t) / (2 * RAMP_K) : t - RAMP_K / 2);
// smooth-min đa thức (k: bề dày chỗ hoà, mét độ cao)
const smin = (a, b, k) => { const h = Math.min(1, Math.max(0, 0.5 + 0.5 * (b - a) / k)); return b + (a - b) * h - k * h * (1 - h); };

// ---- nhiễu giá trị có seed (chép gọn từ ground.js: ground.js nạp dữ liệu B15 lúc import nên không dùng chung) ----
const hash2 = (i, j) => { let h = Math.imul(i, 374761393) + Math.imul(j, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
export function vnoise(x, z) {
  const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash2(i, j), b = hash2(i + 1, j), c = hash2(i, j + 1), d = hash2(i + 1, j + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// ---- hằng số mặt cắt (ĐỀ XUẤT BẢN THỬ) ------------------------------------------------------------------------
const BED_DEEP = RIVER.bedDeep, BED_SHOAL = RIVER.bedShoal, BANK_Y = RIVER.bankY, BANK_W = RIVER.bankW;
const EDGE_Y = -1.9;                 // mép lòng sông (chân bờ bùn): triều ròng −1,6 vẫn ngập 0,3 m
const SHOAL_NOISE = 0.2;             // bãi cạn gợn ±0,2 m (triều ròng sâu 0,3–0,7 m)
const SHOAL_EDGE = 12;               // bãi cạn phẳng tới w − 12 rồi dâng về mép lòng
const STRIP_Y = 0.8;                 // dải bờ +2,2..+3,0
const HILL_A0 = 18, HILL_A1 = 42, HILL_R = 120;                  // đồi 18–60 m, dâng hết trong 120 m sau dải bờ
export const HQ_PAD = { x: 600, z: zc(600) - 125, r: 22, blend: 16, minY: 6 };   // gò bản doanh Hưng Đạo vương (hợp đồng §1)
const HQ_PUSH = 60, HQ_PUSH_R = 170;
// Nhánh sông: đầu lạch bắt đầu trong lòng sông cái (mép − 6 m), uốn lệch ngang tối đa `bend` m
const TRIB_START_IN = 6, TRIB_BANK_W = 18, TRIB_EDGE_Y = -1.9;
const TRIB_BEND = { chanh: 14, rut: -12, gia: 13 };
// Vách thung lũng lạch dốc 0,6 m/m sau bờ bùn. Ngoài TRIB_REACH m tính từ tim lạch mặt cắt lạch đã cao hơn mọi đất liền
// (≤ 2,2 + 0,8 + 60 m) nên bỏ qua được mà không tạo bậc: mọi điều kiện bỏ qua bên dưới đều kéo theo ad > TRIB_REACH.
const TRIB_WALL = 0.6, TRIB_WALL_K = 12;
const TRIB_REACH = 16 + TRIB_BANK_W + TRIB_WALL_K / 2 + (STRIP_Y + HILL_A0 + HILL_A1 + 1.5) / TRIB_WALL;

// Khung từng nhánh (tính sẵn): gốc (x0, z0) ở cửa lạch, hướng (dx, dz), pháp tuyến (nx, nz), dài, nửa rộng, đáy.
export const TRIBS = RIVER.tribs.map((t) => {
  const L = Math.hypot(t.dir.x, t.dir.z), dx = t.dir.x / L, dz = t.dir.z / L;
  return { id: t.id, name: t.name, mouthX: t.mouthX, side: t.side, x0: t.mouthX, z0: zc(t.mouthX) + t.side * (hw(t.mouthX) - TRIB_START_IN),
    dx, dz, nx: -dz, nz: dx, len: t.len, hw: t.hw, bed: t.bed, bend: TRIB_BEND[t.id] ?? 0 };
});
// Độ lệch ngang của tim lạch theo quãng s dọc lạch (0 ở cửa và cuối lạch): lạch cong nên thuyền phục khuất.
// sin² nên phẳng (đạo hàm 0) ở cả cửa lẫn cuối lạch: không gãy khúc khi ra ngoài đoạn [0, len].
export const tribBend = (tr, s) => { const q = Math.sin(Math.PI * Math.min(1, Math.max(0, s / tr.len))); return tr.bend * q * q; };
// Nửa rộng lạch theo t = s/len: 16 m, thắt còn ~7 m ở cuối lạch.
export const tribHalfW = (tr, t) => tr.hw * (1 - 0.4 * sstep(0.7, 1, t));
// Điểm trên tim lạch (cho cảnh, thuyền phục): quãng s, lệch ngang l.
export function tribPoint(tr, s, l = 0) {
  const o = tribBend(tr, s) + l;
  return { x: tr.x0 + tr.dx * s + tr.nx * o, z: tr.z0 + tr.dz * s + tr.nz * o };
}

// Trọng số khúc cọc 0..1 (1 trong x 480–820, hoà dần 40 m ra ngoài hai đầu)
export function inReach(x) {
  const R = RIVER.reach;
  return sstep(R.x0 - R.blend, R.x0, x) * (1 - sstep(R.x1, R.x1 + R.blend, x));
}

// Độ cao mặt cắt sông cái + đất liền tại (x, z) khi đã biết zc(x), hw(x), trọng số khúc cọc (dựng bảng theo cột x).
// kN, kS: hệ số đổi khoảng cách ngang (theo z) ra khoảng cách theo pháp tuyến bờ bắc / nam (bờ xiên khi dòng uốn,
// cửa sông loe) — bờ bùn luôn rộng BANK_W m theo pháp tuyến, không dốc gắt hơn ở chỗ bờ xiên.
function mainCore(x, z, zcx, w, r, kN, kS) {
  const a = Math.abs(z - zcx);
  if (a < w) {
    // lòng sâu: đáy gợn ±0,3 m, dâng từ nửa lòng tới mép
    let y = BED_DEEP + 0.3 * (2 * vnoise(x * 0.025 + 11, z * 0.03 - 7) - 1);
    y += (EDGE_Y - y) * sstep(0.45, 1, a / w);
    if (r > 0) {
      let s = BED_SHOAL + SHOAL_NOISE * (2 * vnoise(x / 14 + 3.1, z / 12 - 8.7) - 1);
      s += (EDGE_Y - s) * sstep(w - SHOAL_EDGE, w, a);
      y += (s - y) * r;
    }
    return y;
  }
  const e = (a - w) * (z > zcx ? kS : kN);
  // dải bờ: +2,2..+3,0, gợn mềm bắt đầu cách mép lòng 10 m (bờ bùn ít cong cho bảng 2 m)
  let land = BANK_Y + STRIP_Y * vnoise(x / 34 + 5.3, z / 30 - 2.1) * sstep(10, 30, e);
  const strip = 10 + 20 * vnoise(x / 70 + 13.7, 3.3 + (z > zcx ? 9 : 0));   // bề rộng dải bờ 10–30 m, hai bờ khác nhau
  // quanh gò bản doanh chân đồi lùi xa 60 m: gò đứng trên thềm thoải nhìn xuống sông, không bị kẹp giữa sườn đồi dốc
  const hx = x - HQ_PAD.x, hz = z - HQ_PAD.z, hd2 = hx * hx + hz * hz;
  const eh = e - BANK_W - strip - (hd2 < HQ_PUSH_R * HQ_PUSH_R ? HQ_PUSH * sstep(HQ_PUSH_R, HQ_PAD.r, Math.sqrt(hd2)) : 0);
  if (eh > 0) {
    const A = HILL_A0 + HILL_A1 * (0.65 * vnoise(x / 300 + 1.7, z / 240 + 4.2) + 0.35 * vnoise(x / 130 - 6.1, z / 115 + 2.9));
    land += A * ramp(eh / HILL_R);
  }
  return EDGE_Y + (land - EDGE_Y) * ease2(e / BANK_W);
}

// Mặt cắt lạch nhánh theo khoảng cách ad tới tim lạch (đã tính đầu lạch bo tròn), nửa rộng tw.
function tribProfile(tr, ad, tw) {
  if (ad < tw) return tr.bed + (TRIB_EDGE_Y - tr.bed) * sstep(0.35, 1, ad / tw);
  const e = ad - tw;
  if (e < TRIB_BANK_W) return TRIB_EDGE_Y + (BANK_Y - TRIB_EDGE_Y) * ease2(e / TRIB_BANK_W);
  const f = e - TRIB_BANK_W;                                           // vách lạch bắt đầu thoải (C1, không gãy ở đỉnh bờ)
  return BANK_Y + TRIB_WALL * (f < TRIB_WALL_K ? f * f / (2 * TRIB_WALL_K) : f - TRIB_WALL_K / 2);
}

function coreNoPad(x, z, zcx, w, r, kN, kS) {
  let y = mainCore(x, z, zcx, w, r, kN, kS);
  for (let k = 0; k < TRIBS.length; k++) {
    const tr = TRIBS[k], px = x - tr.x0, pz = z - tr.z0;
    const s = px * tr.dx + pz * tr.dz;
    if (s < -10 - TRIB_REACH || s > tr.len + TRIB_REACH) continue;
    const l = px * tr.nx + pz * tr.nz - tribBend(tr, s);
    if (l > TRIB_REACH || l < -TRIB_REACH) continue;
    const ex = s > tr.len ? s - tr.len : s < -10 ? -10 - s : 0;       // đầu lạch bo tròn
    const ad = ex > 0 ? Math.sqrt(l * l + ex * ex) : Math.abs(l);
    // bề dày hoà 3 m (cửa lạch chỉ trũng thêm ≤ 0,75 m), dày dần khi lên vách: nếp gấp bờ lạch ↔ bờ sông, vách lạch ↔
    // sườn đồi tròn đều, bảng 2 m sát hàm giải tích
    const p = tribProfile(tr, ad, tribHalfW(tr, s / tr.len));
    y = smin(y, p, 3 + (p > BANK_Y ? 0.12 * (p - BANK_Y) : 0));
  }
  return y;
}
// hệ số pháp tuyến hai bờ tại x (xem mainCore)
function bankK(x) {
  const dz = (zc(x + 0.5) - zc(x - 0.5)), dw = (hw(x + 0.5) - hw(x - 0.5));
  BK[0] = 1 / Math.sqrt(1 + (dz - dw) * (dz - dw)); BK[1] = 1 / Math.sqrt(1 + (dz + dw) * (dz + dw));
  return BK;
}
const BK = new Float64Array(2);
// gò bản doanh: san phẳng ở độ cao ít nhất 6 m (bằng đất tự nhiên nếu chỗ đó đã cao hơn), mép hoà 16 m — không
// lấn xuống bờ bùn (tâm gò cách mép lòng 53 m, bờ bùn rộng 14 m)
HQ_PAD.y = (() => { const x = HQ_PAD.x, k = bankK(x); return Math.max(HQ_PAD.minY, coreNoPad(x, HQ_PAD.z, zc(x), hw(x), inReach(x), k[0], k[1])); })();
function exactCore(x, z, zcx, w, r, kN, kS) {
  const y = coreNoPad(x, z, zcx, w, r, kN, kS), P = HQ_PAD, dx = x - P.x, dz = z - P.z, R = P.r + P.blend;
  if (dx * dx + dz * dz >= R * R) return y;
  return y + (P.y - y) * sstep(R, P.r, Math.sqrt(dx * dx + dz * dz));
}

// Độ cao giải tích chính xác (chậm hơn bảng; dùng dựng bảng và kiểm thử).
export function bedHeightExact(x, z) { const k = bankK(x); return exactCore(x, z, zc(x), hw(x), inReach(x), k[0], k[1]); }

// ---- bảng 2 m trên toàn bản đồ ------------------------------------------------------------------------------------
export const BOUNDS = { minX: -200, maxX: 1320, minZ: -300, maxZ: 300 };
export const CLAMP = { x0: -60, x1: 1240, z0: -240, z1: 240 };
const LUT_STEP = 2, LUT_INV = 1 / LUT_STEP;
const EMPTY = new Float32Array(0);
const LX0 = BOUNDS.minX, LZ0 = BOUNDS.minZ;
const LNX = Math.round((BOUNDS.maxX - BOUNDS.minX) * LUT_INV) + 1, LNZ = Math.round((BOUNDS.maxZ - BOUNDS.minZ) * LUT_INV) + 1;
// Bảng dựng lười ở lần gọi đầu (~0,1–0,2 s): module B20 có thể được nạp sẵn mà không làm chậm B15.
let LUT = EMPTY;
export const LUT_INFO = { step: LUT_STEP, nx: LNX, nz: LNZ, x0: LX0, z0: LZ0, ms: 0, data: null };
function buildLut() {
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  const L = new Float32Array(LNX * LNZ);
  for (let i = 0; i < LNX; i++) {
    const x = LX0 + i * LUT_STEP, zcx = zc(x), w = hw(x), r = inReach(x), k = bankK(x), kN = k[0], kS = k[1];
    for (let j = 0; j < LNZ; j++) L[j * LNX + i] = exactCore(x, LZ0 + j * LUT_STEP, zcx, w, r, kN, kS);
  }
  LUT = L; LUT_INFO.data = L;
  LUT_INFO.ms = (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0;
  return L;
}
export const ensureLut = () => LUT.length === 0 ? buildLut() : LUT;
const LNXm1 = LNX - 1, LNZm1 = LNZ - 1, LNXm2 = LNX - 2, LNZm2 = LNZ - 2;

// Độ cao mặt đất / đáy sông tại (x, z): bảng 2 m nội suy Catmull-Rom hai chiều (16 ô, không cấp phát, ~50 ns);
// lệch hàm giải tích < 0,05 m cả ở nếp gấp cửa lạch (song tuyến lệch tới ~0,09 m). Sát mép bảng / ngoài bản đồ: giải tích.
export function bedHeight(x, z) {
  const fx = (x - LX0) * LUT_INV, fz = (z - LZ0) * LUT_INV;
  if (!(fx >= 1 && fz >= 1 && fx < LNXm2 && fz < LNZm2)) return bedHeightExact(x, z);
  const L = LUT.length === 0 ? buildLut() : LUT;
  const i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, u2 = u * u, u3 = u2 * u, v2 = v * v, v3 = v2 * v;
  const a0 = -0.5 * u3 + u2 - 0.5 * u, a1 = 1.5 * u3 - 2.5 * u2 + 1, a2 = -1.5 * u3 + 2 * u2 + 0.5 * u, a3 = 0.5 * u3 - 0.5 * u2;
  const b0 = -0.5 * v3 + v2 - 0.5 * v, b1 = 1.5 * v3 - 2.5 * v2 + 1, b2 = -1.5 * v3 + 2 * v2 + 0.5 * v, b3 = 0.5 * v3 - 0.5 * v2;
  let o = (j - 1) * LNX + i - 1;
  let h = b0 * (a0 * L[o] + a1 * L[o + 1] + a2 * L[o + 2] + a3 * L[o + 3]); o += LNX;
  h += b1 * (a0 * L[o] + a1 * L[o + 1] + a2 * L[o + 2] + a3 * L[o + 3]); o += LNX;
  h += b2 * (a0 * L[o] + a1 * L[o + 1] + a2 * L[o + 2] + a3 * L[o + 3]); o += LNX;
  return h + b3 * (a0 * L[o] + a1 * L[o + 1] + a2 * L[o + 2] + a3 * L[o + 3]);
}
// Bản song tuyến (4 ô, rẻ hơn ~2 lần, lệch tới ~0,09 m ở nếp gấp): cho việc không cần chính xác (rải cảnh, AI dò xa).
export function bedHeightLin(x, z) {
  const fx = (x - LX0) * LUT_INV, fz = (z - LZ0) * LUT_INV;
  if (!(fx >= 0 && fz >= 0 && fx < LNXm1 && fz < LNZm1)) return bedHeightExact(x, z);
  const T = LUT.length === 0 ? buildLut() : LUT;
  const i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, o = j * LNX + i;
  const a = T[o], b = T[o + 1], c = T[o + LNX], d = T[o + LNX + 1];
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export const depthAt = (x, z, tidePct) => TIDE_Y(tidePct) - bedHeight(x, z);

// ---- vùng nước ----------------------------------------------------------------------------------------------------
// Đường nước triều cao trên bờ bùn (mét tính từ mép lòng sông w): nghịch đảo ease2 tại mức triều cao.
const WL_OFF = (() => { const q = (TIDE.high - EDGE_Y) / (BANK_Y - EDGE_Y); return BANK_W * (q <= 0.5 ? Math.sqrt(q / 2) : 1 - Math.sqrt((1 - q) / 2)); })();
const TWL_OFF = (() => { const q = (TIDE.high - TRIB_EDGE_Y) / (BANK_Y - TRIB_EDGE_Y); return TRIB_BANK_W * (q <= 0.5 ? Math.sqrt(q / 2) : 1 - Math.sqrt((1 - q) / 2)); })();

// Khung lạch gần nhất tại (x, z): { id, t (0 cửa → 1 cuối lạch), d (lệch ngang có dấu, m), ad (khoảng cách tới tim,
// đầu lạch bo tròn), hw (nửa rộng tại đó) } hoặc null nếu xa mọi lạch. Cấp phát một object: không gọi mỗi khung cho mọi lính.
export function tribAt(x, z) {
  let best = null, bestD = 1e9;
  for (const tr of TRIBS) {
    const px = x - tr.x0, pz = z - tr.z0, s = px * tr.dx + pz * tr.dz;
    if (s < -20 || s > tr.len + 30) continue;
    const d = px * tr.nx + pz * tr.nz - tribBend(tr, s), tw = tribHalfW(tr, s / tr.len);
    const ex = s > tr.len ? s - tr.len : 0, ad = Math.hypot(d, ex);
    if (ad > tw + 40 || ad - tw >= bestD) continue;
    bestD = ad - tw; best = { id: tr.id, t: s / tr.len, d, ad, hw: tw };
  }
  return best;
}

// Khoảng cách có dấu (m) tới đường nước triều cao; âm = trong nước. Xấp xỉ theo mặt cắt danh nghĩa (sai < ~1 m).
export function waterDist(x, z) {
  let d = Math.abs(z - zc(x)) - hw(x) - WL_OFF;
  for (const tr of TRIBS) {
    const px = x - tr.x0, pz = z - tr.z0, s = px * tr.dx + pz * tr.dz;
    if (s < -10 || s > tr.len + 60) continue;
    const l = px * tr.nx + pz * tr.nz - tribBend(tr, s), ex = s > tr.len ? s - tr.len : 0;
    const dt = Math.hypot(l, ex) - tribHalfW(tr, Math.min(1, s / tr.len)) - TWL_OFF;
    if (dt < d) d = dt;
  }
  return d;
}
// 1 trong lòng sông cái hoặc lạch nhánh (tới đường nước triều cao), 0 trên bờ; mép mềm 3 m.
export const riverMask = (x, z) => sstep(2, -1, waterDist(x, z));

// Bãi cọc tại (x, z): "M1" | "M2" | "M3" | null (70 m dọc × 60 m ngang quanh tâm dòng).
export function stakeFieldAt(x, z) {
  for (let k = 0; k < STAKE_FIELDS.length; k++) {
    const f = STAKE_FIELDS[k];
    if (Math.abs(x - f.x) <= f.along / 2 && Math.abs(z - zc(x)) <= f.across / 2) return f.id;
  }
  return null;
}

// Độ lầy mặt đất 0..1: bãi bùn triều (dưới mức triều cao, mép mềm 0,6 m); đáy dưới nước cũng là bùn.
// tidePct để dành (bùn mới lộ có thể lầy hơn) — hiện không đổi theo con nước.
export function mudAt(x, z, tidePct) { return sstep(TIDE.high + 0.4, TIDE.high - 0.2, bedHeight(x, z)); }

// ---- sóng mặt nước (dùng chung cho shader nước và dập dềnh thuyền) ----------------------------------------------------
// y = Σ amp·sin(t·w + x·kx + z·kz), nhân hệ số theo độ sâu (sát bờ lặng). Shader water.js sinh GLSL từ bảng này.
export const WAVES = [
  { amp: 0.18, w: 1.1, kx: 0.09, kz: 0.07 },            // sóng chính: đúng sóng sông B15 và boats.js WAVE (thuyền chỉ theo sóng này)
  { amp: 0.05, w: 1.7, kx: -0.05, kz: 0.13 },           // hai gợn phụ nhỏ (≤ 0,08 m, thuyền không cần theo): mặt nước
  { amp: 0.03, w: 2.3, kx: 0.23, kz: -0.17 },           //   lên mặt cắt low poly rõ hơn
];
export const WAVE_DEPTH = [0.1, 2.0];                          // sóng lặng dần khi sâu < 2 m, tắt hẳn ở 0,1 m
export const waveDepthK = (depth) => sstep(WAVE_DEPTH[0], WAVE_DEPTH[1], depth);
export function waveY(x, z, t, depth = 9) {
  let y = 0;
  for (let k = 0; k < WAVES.length; k++) { const W = WAVES[k]; y += W.amp * Math.sin(t * W.w + x * W.kx + z * W.kz); }
  return y * waveDepthK(depth);
}

// ---- lưới địa hình chữ nhật (world-b20 dựng mesh + bảng tra ô) ----------------------------------------------------------
// Mỗi mục [đầu, cuối, bước mong muốn]. z: 2 m trên hai dải bờ bùn (x ≤ 900 bờ nằm trong z −125…−50 và 50…118), 12 m
// giữa lòng, 5 m đất liền và lạch nhánh, 10 m rìa bản đồ. x: 3 m quanh cửa sông Chanh / mốc Khúc cọc, 4 m khúc cọc
// (cửa Rút, Giá), 5 m thượng lưu và cửa sông, 8 m ngoài vùng chơi. ~321 × 141 ô ≈ 90 nghìn tam giác.
export const GRID_SPANS = {
  x: [[-200, -60, 8], [-60, 380, 5], [380, 470, 3], [470, 880, 4], [880, 1240, 5], [1240, 1320, 8]],
  z: [[-300, -230, 10], [-230, -128, 5], [-128, -48, 2], [-48, 48, 12], [48, 120, 2], [120, 230, 5], [230, 300, 10]],
};
// Trục toạ độ từ bảng span (bước thật chia đều trong từng span).
export function gridAxis(spans) {
  const a = [spans[0][0]];
  for (const [s0, s1, st] of spans) { const n = Math.max(1, Math.round((s1 - s0) / st)); for (let k = 1; k <= n; k++) a.push(s0 + (s1 - s0) * k / n); }
  return Float64Array.from(a);
}

export const TERRAIN_B20 = {
  id: "B20",
  height: bedHeight, bare: bedHeight, exact: bedHeightExact,
  mud: mudAt, waterDist, riverMask, depthAt, tideY: TIDE_Y, tide: TIDE, wadeMax: WADE_MAX,
  bounds: { ...BOUNDS }, clamp: { ...CLAMP },
  gridSpans: GRID_SPANS,
  // cho water.js: dải nước sông cái phủ |z − zc| ≤ hw + edge (qua đường nước triều cao cả chỗ bờ xiên ở cửa sông),
  // cộng một dải theo từng lạch
  river: { zc, hw, edge: 18, tribs: TRIBS, tribPoint, tribHalfW },
  waves: WAVES, waveY,
  hq: HQ_PAD,
};
