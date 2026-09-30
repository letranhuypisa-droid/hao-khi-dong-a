// battle/scenery-b20.js — cảnh khúc sông Bạch Đằng (B20): cột đá vôi hai bờ và đảo đá ở cửa sông, rừng ven sông,
// sú vẹt trên bãi bùn triều (rễ chống lộ khi nước ròng), lau sậy dọc mép triều cao, ba bãi cọc (M1–M3) với bè cỏ
// ngụy trang neo dây, hai bến phục binh, hai tháp canh, bản doanh Hưng Đạo vương trên gò bờ bắc, phao gỗ chặn luồng
// ở x 840 (ẩn tới pha 2), núi đá vôi xa và mây.
//
// Nguồn: canon B20 mapNotes (Chính sử + khảo cổ: cọc gỗ lớn vạt nhọn, không bịt sắt, đường kính 10–30 cm, dài
// 1,5–3 m; bè cỏ ngụy trang neo dây, chặt dây bè trôi đi là Hư cấu). Bố cục, số lượng, kích thước, màu là Hư cấu /
// ĐỀ XUẤT BẢN THỬ. Hình học sông lấy từ data/river-b20.js + data/terrain-b20.js (không chép công thức).
//
// Phần xếp chỗ (layoutB20, stakeLayout, pierLayout…) thuần số, không dùng three: tests/scenery-b20.test.mjs kiểm
// cọc nằm trong bãi và trên bãi cạn, không gì đặt vào lòng sâu (trừ đảo đá ngoài luồng), va chạm không chắn luồng.
//
// Ngân sách (hợp đồng §6, ĐỀ XUẤT BẢN THỬ): ≤ ~30 lượt vẽ, ≤ ~120 nghìn tam giác. Mỗi loại là một InstancedMesh hoặc
// một lưới gộp; đồ động (bè, dây, phao, phao chặn luồng) là InstancedMesh cập nhật ma trận mỗi khung (vài chục cái).

import * as THREE from "three";
import { PAL, merge, part, lambert } from "./models.js";
import { makeRng } from "../core/rng.js";
import { TIDE, TIDE_Y, zc, hw, bedHeight, waterDist, TRIBS, tribHalfW, tribPoint, HQ_PAD, BOUNDS, CLAMP, vnoise, waveY, tribAt } from "../data/terrain-b20.js";
import { STAKE_FIELDS } from "../data/river-b20.js";
import { MAP } from "../data/battle-b20.js";
import { box, cyl, cone, ico, blade, unit, spanM, rod, bar, placeParts, colorByY, makeInst, solidAdder, groveGeo, reedGeo, rockGeo,
  tintTrees, karstGeo, addSkyKit, flagBatch } from "./kit.js";

const sstep = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

// ---- hằng số (ĐỀ XUẤT BẢN THỬ trừ chỗ ghi nguồn) --------------------------------------------------------------------
export const SCN = {
  seed: 1288,
  fairwayMax: 78,               // nửa luồng tàu phải để trống ở cửa sông (đảo đá chỉ đứng ngoài)
  // cọc: canon đường kính 10–30 cm, dài 1,5–3 m (Chính sử + khảo cổ); đỉnh cao hơn đáy 1,8–2,6 m (hợp đồng §6)
  stakes: { per: 300, bury: 0.45, top: [1.8, 2.6], r: [0.05, 0.15], lean: 0.15, leanUp: 0.05, broken: 0.1, inset: 0.9, rowDx: 2.4, colDz: 2.1 },
  raft: { w: 10, d: 6, drift: 1.1, pull: 0.08, spin: 0.05, life: 30, fade: 8 },
  pierDeckY: 2.3, pierW: 2.6,
  boom: { bow: 7, log: 5.2, gap: 0.45, raise: 2.5 },
  counts: { karstBank: 46, islets: 30, trees: 300, mangroves: 190, reeds: 800, rocks: 130 },
};

// Nửa bề rộng luồng tàu phải để trống: cả lòng sông ở thượng, trung lưu; ≤ 78 m ở cửa sông loe (đảo đá đứng ngoài).
export const fairwayHW = (x) => Math.min(hw(x), SCN.fairwayMax);

// ---- cọc -------------------------------------------------------------------------------------------------------------
// Xếp ~300 cọc trong bãi f (70 × 60 m quanh tâm dòng): hàng ngang dòng cách 2,4 m, cọc cách 2,1 m, lệch ngẫu nhiên,
// thưa dày theo nhiễu (từng cụm như dấu khảo cổ). Mỗi cọc: chân (x, z), đáy bed, đỉnh top (y thật, sau khi nghiêng),
// góc nghiêng rx, rz (±0,15; ngả nhẹ về thượng lưu — mũi đón thuyền xuôi ra biển, ĐỀ XUẤT BẢN THỬ), bán kính r, dài L
// (tính cả phần chôn), gãy hay không.
export function stakeLayout(f, seed = SCN.seed, h = bedHeight) {
  const S = SCN.stakes, rng = makeRng(seed * 31 + f.x), out = [];
  const hx = f.along / 2 - S.inset, hz = f.across / 2 - S.inset;
  const cand = [];
  for (let dx = -hx; dx <= hx; dx += S.rowDx) for (let dz = -hz; dz <= hz; dz += S.colDz) cand.push([dx, dz]);
  // nhiễu cụm: giữ chỗ nào nhiễu cao trước, đủ S.per thì thôi
  const sc = cand.map(([dx, dz]) => vnoise((f.x + dx) / 9 + 4.1, dz / 8 - 2.3) + 0.35 * rng.next());
  const ord = cand.map((_, i) => i).sort((a, b) => sc[b] - sc[a]);
  for (let k = 0; k < ord.length && out.length < S.per; k++) {
    const [dx0, dz0] = cand[ord[k]];
    const dx = Math.max(-hx, Math.min(hx, dx0 + rng.range(-0.8, 0.8))), x = f.x + dx;
    const dz = Math.max(-hz, Math.min(hz, dz0 + rng.range(-0.7, 0.7))), z = zc(x) + dz;
    const bed = h(x, z), topH = rng.range(S.top[0], S.top[1]);
    const rx = rng.range(-S.lean, S.lean), rz = Math.max(-S.lean, Math.min(S.lean, S.leanUp + rng.range(-S.lean, S.lean)));
    const cx = Math.cos(rx), czr = Math.cos(rz), L = (topH + S.bury) / (czr * cx);
    // Euler XYZ (three.js), ry = 0: trục cọc (0, 1, 0) → (−sin rz, cos rz · cos rx, cos rz · sin rx)
    const ux = -Math.sin(rz), uy = czr * cx, uz = czr * Math.sin(rx);
    const y0 = bed - S.bury;
    out.push({ x, z, bed, y0, L, rx, rz, r: rng.range(S.r[0], S.r[1]) * (rng.chance(0.2) ? 1.25 : 1), broken: rng.chance(S.broken),
      top: { x: x + ux * L, y: y0 + uy * L, z: z + uz * L }, topH, tint: rng.range(0.82, 1.08) });
  }
  return out;
}

// ---- bến, tháp canh, bản doanh, phao chặn luồng ------------------------------------------------------------------------
// Bến: gốc = điểm đất gần nút bến nhất (đáy ≥ +2,1: đỉnh bờ), đầu = điểm nước gần nút nhất có đáy ≤ −2,0 (còn nước khi
// triều ròng −1,6), cầu chạy thẳng gốc → đầu + 3 m. Nút P_N (bankPoint(400, −1, 6)) nằm trong cửa sông Chanh: cầu mọc
// từ bờ tây cửa lạch ra nút.
export function pierLayout(p, h = bedHeight) {
  let root = null, tip = null, dr = 1e9, dt = 1e9;
  for (let dx = -60; dx <= 60; dx += 1) for (let dz = -60; dz <= 60; dz += 1) {
    const x = p.x + dx, z = p.z + dz, d = Math.hypot(dx, dz); if (d > 60) continue;
    const y = h(x, z);
    if (y >= 2.1 && d < dr) { dr = d; root = { x, z }; }
    if (y <= -2.0 && d < dt) { dt = d; tip = { x, z }; }
  }
  const L0 = Math.hypot(tip.x - root.x, tip.z - root.z), ux = (tip.x - root.x) / L0, uz = (tip.z - root.z) / L0, len = L0 + 3;
  return { id: p.id, side: p.side, node: { x: p.x, z: p.z }, x0: root.x, z0: root.z, x1: root.x + ux * len, z1: root.z + uz * len,
    dir: { x: ux, z: uz }, len, y: SCN.pierDeckY, w: SCN.pierW, head: { w: 6, d: 4 } };
}
export const towerLayout = (t) => ({ id: t.id, x: t.x, z: t.z, side: t.side });          // thang dựng phía đất (side)
// Phao chặn luồng (Nguyễn Khoái, pha 2): dãy gỗ nối dây ngang sông ở x 840, cong võng về hạ lưu. Đầu nam neo cọc +
// tời trên bờ; đầu bắc neo cụm cọc đóng ở mép lòng. Bờ bắc x 820–855 là cửa sông Giá: đầu bắc dời xuôi dòng tới chỗ
// ra khỏi cửa lạch (≥ 3 m ngoài lòng lạch) — lạch để ngỏ cho thuyền phục ta.
export function boomLayout(h = bedHeight) {
  const B = SCN.boom, X = MAP.khoaiBoom?.x ?? 840, zS = zc(X) + hw(X) + 7;
  let xN = X;
  for (let dx = 0; dx <= 60; dx++) { const x = X + dx, tr = tribAt(x, zc(x) - hw(x) + 2); xN = x; if (!tr || tr.ad > tr.hw + 3) break; }
  const zN = zc(xN) - hw(xN) + 2;
  const P = (u) => { const q = 2 * u - 1; return { x: xN + (X - xN) * u + B.bow * (1 - q * q), z: zN + (zS - zN) * u }; };
  let arc = 0; for (let k = 0; k < 24; k++) { const a = P(k / 24), c = P((k + 1) / 24); arc += Math.hypot(c.x - a.x, c.z - a.z); }
  const logs = [], n = Math.ceil(arc / (B.log + B.gap * 0.3));                // khúc gỗ gần khít nhau, dây nối qua khe
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n, p = P(u), a = P(u - 0.01), b = P(u + 0.01);
    logs.push({ x: p.x, z: p.z, yaw: Math.atan2(-(b.z - a.z), b.x - a.x), ground: h(p.x, p.z) });   // trục x cục bộ của khúc gỗ dọc theo dãy
  }
  let zs = zS + 9; while (h(X, zs) < 2.1 && zs < zS + 30) zs += 1;          // cọc neo nam: trên đỉnh bờ
  return { x: X, xN, zN, zS, logs, anchorN: { x: xN + 1.5, z: zN - 1.5 }, anchorS: { x: X, z: zs } };
}
// Bản doanh: gò HQ_PAD (terrain-b20), cổng hướng ra sông (+z).
export const hqLayout = () => ({ x: HQ_PAD.x, z: HQ_PAD.z, y: HQ_PAD.y, r: HQ_PAD.r, palR: 19, gate: Math.PI / 2, gateHalf: 0.3 });

// ---- xếp chỗ toàn cảnh (thuần, có cache) -----------------------------------------------------------------------------------
const segD = (x, z, a, b) => {
  const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz;
  let t = L2 ? ((x - a.x) * dx + (z - a.z) * dz) / L2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(x - a.x - dx * t, z - a.z - dz * t);
};
// Lấy tối đa n phần tử rải đều (xáo tất định rồi cắt): vòng quét lưới dừng sớm sẽ dồn hết về phía tây bản đồ.
const thin = (arr, n, rng) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rng.next() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } arr.length = Math.min(arr.length, n); return arr; };
const CACHE = new Map();
export function layoutB20(seed = SCN.seed) {
  if (CACHE.has(seed)) return CACHE.get(seed);
  const h = bedHeight, rng = makeRng(seed), C = SCN.counts;
  const piers = (MAP.piers || []).map((p) => pierLayout(p, h));
  const towers = (MAP.towers || []).map(towerLayout);
  const hq = hqLayout(), boom = boomLayout(h);
  const stakes = {}; for (const f of STAKE_FIELDS) stakes[f.id] = stakeLayout(f, seed, h);

  // vùng phải để trống (đường đi, chỗ dựng): gò bản doanh, dải cầu bến, chân tháp, neo phao
  const zones = [
    ...piers.map((p) => ({ a: { x: p.x0 - p.dir.x * 8, z: p.z0 - p.dir.z * 8 }, b: { x: p.x1, z: p.z1 }, r: 4 })),
    ...towers.map((t) => ({ a: t, b: t, r: 6 })),
    { a: hq, b: hq, r: hq.r + 12 },
    { a: boom.anchorN, b: boom.anchorN, r: 5 }, { a: boom.anchorS, b: boom.anchorS, r: 6 },
  ];
  const keep = (x, z, pad = 0) => zones.some((q) => segD(x, z, q.a, q.b) < q.r + pad);
  const inB = (x, z, m = 0) => x > BOUNDS.minX + m && x < BOUNDS.maxX - m && z > BOUNDS.minZ + m && z < BOUNDS.maxZ - m;

  // -- cột đá vôi. kind A: cột mảnh; B: khối hai đỉnh; C: đảo đá có hàm ếch ngấn nước. r: bán kính chân (m), sy: tỉ lệ đứng.
  const karst = [];
  const free = (x, z, r) => karst.every((k) => Math.hypot(k.x - x, k.z - z) > (k.r + r) * 0.95);
  const bankOk = (x, z, r, wd) => inB(x, z, r * 0.4) && !keep(x, z, r + 20) && Math.hypot(x - hq.x, z - hq.z) > 55 + r && free(x, z, r)
    && waterDist(x, z) > wd && [0, 1, 2, 3, 4, 5].every((k) => waterDist(x + Math.cos(k * 1.05) * r, z + Math.sin(k * 1.05) * r) > 3);
  const addK = (x, z, r, kind, sy) => karst.push({ x, z, r, kind, sy: r * sy, ry: rng.range(0, 6.28), islet: kind === "C", tint: rng.range(0.9, 1.06) });
  // (1) hai cột canh mỗi cửa lạch — thuyền phục lao ra từ khe đá (canon Tuyệt Kỹ ult: "khe đảo đá vôi")
  for (const tr of TRIBS) for (const sgn of [-1, 1]) {
    const r = rng.range(8, 13);
    search: for (let s = 36; s <= 124; s += 8) for (let off = 16; off <= 64; off += 4) {       // gần cửa lạch nhất
      const p = tribPoint(tr, s, sgn * (tribHalfW(tr, s / tr.len) + off + r));
      if (bankOk(p.x, p.z, r, r * 0.8 + 6)) { addK(p.x, p.z, r, "A", rng.range(0.95, 1.3)); break search; }
    }
  }
  // (2) vách đá sau lưng bản doanh
  for (const [dx, dz, r] of [[-62, -92, 15], [58, -84, 13], [4, -128, 18]]) { const x = hq.x + dx, z = hq.z + dz; if (bankOk(x, z, r, r + 30)) addK(x, z, r, dz < -110 ? "B" : "A", 1.1); }
  // (3) rải hai bờ: thành cụm theo nhiễu, dày hơn ở hạ lưu (gần vịnh)
  for (let tries = 0; tries < 4000 && karst.length < C.karstBank + 8; tries++) {
    const x = rng.range(-200, 1320), side = rng.chance(0.5) ? -1 : 1, off = rng.range(38, 260), z = zc(x) + side * (hw(x) + off);
    const r = rng.range(7, 16) * (0.8 + 0.4 * sstep(300, 1100, x));
    const cl = vnoise(x / 160 + 7.7, z / 140 - 1.9) + 0.25 * sstep(400, 1100, x);
    if (cl < 0.5 || !bankOk(x, z, r, r + 22)) continue;
    addK(x, z, r, rng.chance(0.25) ? "B" : "A", rng.range(0.85, 1.3));
  }
  // (4) đảo đá cửa sông: ngoài luồng (≥ fairwayHW + r + 8), to trước, nhỏ sau
  const nBank = karst.length;
  for (let tries = 0; tries < 4000 && karst.length < nBank + C.islets; tries++) {
    const big = karst.length - nBank < 10, x = rng.range(975, 1316), z = rng.range(-296, 296), r = big ? rng.range(9, 16) : rng.range(3, 8);
    if (Math.abs(z - zc(x)) < fairwayHW(x) + r + 8 || !inB(x, z, r * 0.3) || !free(x, z, r + 4) || keep(x, z, r + 10)) continue;
    addK(x, z, r, "C", big ? rng.range(1.1, 1.6) : rng.range(0.9, 1.6));
  }
  const inK = (x, z, pad = 0) => karst.some((k) => Math.hypot(k.x - x, k.z - z) < k.r * 1.05 + pad);

  // -- rừng ven sông (khóm cây), dốc vừa phải, sau dải sú vẹt / lau
  const slope = (x, z) => Math.max(Math.abs(h(x + 2, z) - h(x - 2, z)), Math.abs(h(x, z + 2) - h(x, z - 2))) / 4;
  const trees = [];
  for (let gx = -196; gx < 1320; gx += 7) for (let gz = -296; gz < 300; gz += 7) {
    const x = gx + rng.range(-3, 3), z = gz + rng.range(-3, 3);
    if (!inB(x, z, 3)) continue;
    const wd = waterDist(x, z); if (wd < 15) continue;
    const y = h(x, z); if (y < 2.6) continue;
    const n = vnoise(x / 45 + 3, z / 45 - 7), thr = wd < 60 ? 0.36 : wd < 140 ? 0.58 : 0.74;         // dày sát sông, thưa trên đồi
    if (n < thr || slope(x, z) > 0.9 || keep(x, z, 3) || inK(x, z, 2)) continue;
    trees.push({ x, z, s: rng.range(1.1, 1.75), ry: rng.range(0, 6.28) });
  }
  thin(trees, C.trees, rng);
  // -- sú vẹt: bãi bùn triều (đáy −0,7 … +1,5): rễ chống ngập khi triều cao, lộ khi nước ròng
  const mangroves = [];
  for (let gx = -198; gx < 1320; gx += 3.4) for (let gz = -298; gz < 300; gz += 3.4) {
    const x = gx + rng.range(-1.4, 1.4), z = gz + rng.range(-1.4, 1.4), wd = waterDist(x, z);
    if (wd < -14 || wd > 6 || !inB(x, z, 2)) continue;
    const y = h(x, z); if (y < -0.7 || y > 1.5) continue;
    if (vnoise(x / 24 + 1.3, z / 24 + 8.1) < 0.56 || rng.next() < 0.35 || keep(x, z, 3) || inK(x, z)) continue;
    const s = rng.range(0.85, 1.3), sy = Math.max(s * rng.range(0.85, 1.15), (1.75 - y) / 2.6);
    mangroves.push({ x, z, y, s, sy, ry: rng.range(0, 6.28) });
  }
  thin(mangroves, C.mangroves, rng);
  // -- lau sậy: dọc mép triều cao (đáy +1,1 … +3,0)
  const reeds = [];
  for (let gx = -198; gx < 1320; gx += 2.6) for (let gz = -298; gz < 300; gz += 2.6) {
    const x = gx + rng.range(-1.1, 1.1), z = gz + rng.range(-1.1, 1.1), wd = waterDist(x, z);
    if (wd < -4 || wd > 9 || !inB(x, z, 1)) continue;
    const y = h(x, z); if (y < 1.1 || y > 3.0) continue;
    if (vnoise(x / 17 - 4.2, z / 17 + 2.6) < 0.45 || rng.next() < 0.3 || keep(x, z, 1.5) || inK(x, z)) continue;
    reeds.push({ x, z, s: rng.range(0.8, 1.3), sy: rng.range(0.8, 1.35), ry: rng.range(0, 6.28), c: rng.next() });
  }
  thin(reeds, C.reeds, rng);
  // -- đá tảng: dưới chân cột đá trên bờ, và rải trên dải bờ
  const rocks = [];
  for (const k of karst) {
    if (k.islet) continue;                                                          // chân đảo đá chìm dưới nước: không cần
    for (let i = 0; i < 3 && rocks.length < C.rocks; i++) {
      const a = rng.range(0, 6.28), d = k.r * rng.range(1.02, 1.35), x = k.x + Math.cos(a) * d, z = k.z + Math.sin(a) * d;
      if (!inB(x, z, 1) || keep(x, z, 1) || waterDist(x, z) < 2) continue;
      rocks.push({ x, z, s: rng.range(0.8, 2.6), ry: rng.range(0, 6.28) });
    }
  }
  for (let tries = 0; tries < 3000 && rocks.length < C.rocks; tries++) {
    const x = rng.range(-190, 1310), side = rng.chance(0.5) ? -1 : 1, z = zc(x) + side * (hw(x) + rng.range(12, 40));
    if (!inB(x, z, 2) || waterDist(x, z) < 2 || keep(x, z, 2) || inK(x, z, 1)) continue;
    rocks.push({ x, z, s: rng.range(0.25, 0.9), ry: rng.range(0, 6.28) });
  }
  const L = { seed, piers, towers, hq, boom, stakes, karst, trees, mangroves, reeds, rocks, zones, keep };
  CACHE.set(seed, L);
  return L;
}

// ---- hình khối riêng của B20 -------------------------------------------------------------------------------------------
const WOOD = 0x6b4a2b, WOOD_D = 0x4a3524, BAMBOO = 0xb09a5a, BAMBOO_D = 0x8e7c48, THATCH = 0x9c8452, THATCH_D = 0x7f6a40, ROPE = 0x3e3226;
// Cọc: trụ 5 cạnh hở, 2 tầng (dải ướt rêu sẫm ở dưới, gỗ sáng dần lên), mũi vạt nhọn gỗ mới — 25 tam giác. Gãy: thân
// ngắn hơn, đầu tưa ba dăm. Đơn vị cao 1 (y 0 → 1), bán kính 1: instance co (r, L, r).
function stakeGeo(broken) {
  const top = broken ? 0.9 : 0.84;
  const g = [part(new THREE.CylinderGeometry(1, 1, top, 5, 2, true).translate(0, top / 2, 0), 0xffffff)];
  if (!broken) g.push(part(new THREE.ConeGeometry(1, 1 - top, 5, 1, true).translate(0, top + (1 - top) / 2, 0), 0xffffff));
  else for (let k = 0; k < 3; k++) g.push(part(new THREE.ConeGeometry(0.35, 0.1, 3, 1, true), 0xffffff, { x: Math.cos(k * 2.1) * 0.5, y: top + 0.04, z: Math.sin(k * 2.1) * 0.5, rx: Math.sin(k * 2.1) * 0.3, rz: -Math.cos(k * 2.1) * 0.3 }));
  const c = new THREE.Color(), D = new THREE.Color(0x2c2820), M = new THREE.Color(0x4a4230), W = new THREE.Color(0x7a5c3c), T = new THREE.Color(0xa2825a);
  return colorByY(merge(g), (y) => y > top + 0.001 ? (broken ? 0xb39565 : T.getHex()) : y < 0.1 ? D.getHex() : y < top - 0.01 ? M.getHex() : W.getHex());
}
// Sú vẹt (đước): thân ngắn, 4 rễ chống cong xuống bùn, hai khối tán dẹt — ~96 tam giác. Gốc y 0 = mặt bùn.
function mangroveGeo() {
  const g = [], ROOT = 0x6b5a45, BARK = 0x5a4a38;
  rod(g, BARK, 0, 0.9, 0, 0.12, 3.0, 0.05, 0.13, { sides: 4 });
  for (let k = 0; k < 4; k++) {
    const a = k * 1.5708 + 0.3, y0 = 0.9 + (k % 3) * 0.28, r1 = 0.75 + (k % 2) * 0.2, r2 = 1.25 + (k % 3) * 0.18;
    const mx = Math.cos(a) * r1, mz = Math.sin(a) * r1, my = y0 * 0.62, ex = Math.cos(a) * r2, ez = Math.sin(a) * r2;
    rod(g, ROOT, Math.cos(a) * 0.08, y0, Math.sin(a) * 0.08, mx, my, mz, 0.055, { sides: 3 });
    rod(g, ROOT, mx, my, mz, ex, -0.25, ez, 0.05, { sides: 3 });
  }
  g.push(part(ico(1.55, 0), 0x3f5a2e, { y: 3.3, sy: 0.62 }), part(ico(1.15, 0), 0x4d6a34, { x: 0.55, y: 3.85, z: -0.35, sy: 0.66 }));
  return merge(g);
}
// Bè cỏ ngụy trang 10 × 6 m: bảy cây tre dọc, hai đòn ngang, phủ cỏ rác, lau khô — gốc ở mặt nước.
function raftGeo() {
  const g = [], W = SCN.raft.w, D = SCN.raft.d;
  for (let i = 0; i < 7; i++) { const z = -D / 2 + 0.45 + i * (D - 0.9) / 6; rod(g, i % 2 ? BAMBOO : BAMBOO_D, -W / 2, 0.02, z, W / 2, 0.06, z + 0.1, 0.19, { sides: 6 }); }
  for (const x of [-3.6, 0, 3.6]) bar(g, WOOD_D, x, 0.22, -D / 2, x, 0.22, D / 2, 0.2, 0.16);
  const GR = [0x7d7a3e, 0x8e8646, 0x6a6c36, 0xa0904f, 0x5d6634];
  for (let i = 0; i < 12; i++) {
    const x = -W / 2 + 0.8 + (i % 4) * (W - 1.6) / 3 + ((i * 37) % 7 - 3) * 0.12, z = -D / 2 + 1.1 + Math.floor(i / 4) * (D - 2.2) / 2 + ((i * 53) % 5 - 2) * 0.15;
    g.push(part(ico(1.25 + (i % 3) * 0.15, 0), GR[i % GR.length], { x, y: 0.35, z, sx: 1.3, sy: 0.38, ry: i * 0.7 }));
  }
  for (let i = 0; i < 9; i++) g.push(part(blade(0.09, 1.3), 0xb8a468, { x: -4 + i, y: 0.8, z: ((i * 29) % 5 - 2) * 0.9, rz: ((i % 3) - 1) * 0.35, rx: ((i % 2) - 0.5) * 0.4 }));
  return merge(g);
}
// Phao đánh dấu của đội dò luồng Nguyên (mốc cọc "lộ"): phao gỗ, sào, cờ đuôi nheo chàm — gốc ở mặt nước.
function buoyGeo() {
  const g = [part(cyl(0.45, 0.35, 0.5, 7), 0x6a5a40, { y: 0.1 }), part(cyl(0.06, 0.07, 3.4, 5), PAL.then, { y: 1.9 })];
  const pen = new THREE.BufferGeometry();
  pen.setAttribute("position", new THREE.Float32BufferAttribute([0, 3.5, 0, 0, 2.7, 0, 1.6, 3.2, 0, 0, 3.5, 0, 1.6, 3.2, 0, 0, 2.7, 0], 3));
  pen.computeVertexNormals();
  g.push(part(pen, PAL.cham), part(box(0.14, 0.12, 0.14), PAL.xam, { y: 3.55 }));
  return merge(g);
}
// Khúc gỗ phao chặn luồng: thân gỗ dài 5,2 m nằm dọc trục x cục bộ, đai dây hai đầu, dây chạy trên lưng — gốc tại tâm.
function boomLogGeo() {
  const g = [], L = SCN.boom.log;
  rod(g, 0x5e4630, -L / 2, 0, 0, L / 2, 0, 0.02, 0.34, { sides: 7, cap: true });
  for (const x of [-L / 2 + 0.35, L / 2 - 0.35]) g.push(part(new THREE.CylinderGeometry(0.37, 0.37, 0.16, 7, 1, true), ROPE, { x, rz: Math.PI / 2 }));
  bar(g, ROPE, -L / 2 - 0.3, 0.3, 0, L / 2 + 0.3, 0.3, 0, 0.07, 0.07);
  return merge(g);
}

// Lều quân Trần (nón bốn mặt như lều B15) và nhà bạt chỉ huy
const tentParts = (col, s = 1) => [part(cone(2.2 * s, 2.4 * s, 4), col, { y: 1.2 * s, ry: Math.PI / 4 }), part(box(0.6 * s, 1.2 * s, 0.05), PAL.then, { y: 0.6 * s, z: 1.45 * s })];
function pavilionParts() {
  const p = [part(box(9.4, 0.35, 7.2), WOOD, { y: 0.17 })];
  for (const x of [-4.2, -1.4, 1.4, 4.2]) for (const z of [-3.1, 3.1]) p.push(part(cyl(0.14, 0.16, 3.4, 6), PAL.sonDam, { x, y: 2.0, z }));
  p.push(part(box(10.2, 0.25, 8.0), PAL.then, { y: 3.8 }));
  p.push(part(box(10.6, 0.3, 4.6), PAL.son, { y: 4.55, z: 1.95, rx: 0.42 }), part(box(10.6, 0.3, 4.6), PAL.son, { y: 4.55, z: -1.95, rx: -0.42 }));
  p.push(part(box(10.8, 0.24, 0.35), PAL.vang, { y: 5.45 }));
  p.push(part(box(9.4, 2.6, 0.08), PAL.vai, { y: 1.65, z: -3.2 }));                       // vách vải sau
  p.push(part(box(2.4, 0.9, 1.2), PAL.son, { y: 0.8, z: -1.2 }), part(box(2.5, 0.1, 1.3), PAL.vang, { y: 1.28, z: -1.2 }));   // án thư
  p.push(part(box(0.9, 1.1, 0.8), PAL.then, { y: 0.9, z: -2.4 }));                         // ghế
  return p;
}
function drumParts() {
  return [part(cyl(0.95, 0.9, 0.95, 12), 0x6a5a3a, { y: 1.55, rx: 0 }), part(cyl(1.0, 1.0, 0.08, 12), 0x8f7a4a, { y: 2.06 }),
    part(ico(0.25, 0), PAL.vang, { y: 2.12, sy: 0.2 }), part(box(0.12, 1.1, 0.12), WOOD, { x: -0.8, y: 0.55 }), part(box(0.12, 1.1, 0.12), WOOD, { x: 0.8, y: 0.55 }),
    part(box(1.9, 0.12, 0.2), WOOD, { y: 1.05 })];
}
// Giá vũ khí: hai trụ, đòn ngang, 5 ngọn giáo dựng nghiêng
function rackParts() {
  const p = [part(box(0.12, 1.6, 0.12), WOOD, { x: -1.1, y: 0.8 }), part(box(0.12, 1.6, 0.12), WOOD, { x: 1.1, y: 0.8 }), part(box(2.4, 0.1, 0.1), WOOD, { y: 1.45 })];
  for (let k = 0; k < 5; k++) p.push(part(cyl(0.025, 0.025, 2.8, 4), PAL.go, { x: -0.9 + k * 0.45, y: 1.35, z: 0.25, rx: -0.18 }), part(cone(0.06, 0.28, 4), PAL.sat, { x: -0.9 + k * 0.45, y: 2.78, z: 0.5, rx: -0.18 }));
  return p;
}
// Chòi tranh mở bốn phía (bến, chân tháp)
function hutParts(s = 1) {
  const p = [];
  for (const [dx, dz] of [[-1.5, -1.1], [1.5, -1.1], [-1.5, 1.1], [1.5, 1.1]]) p.push(part(cyl(0.09, 0.11, 2.3 * s, 5), BAMBOO_D, { x: dx * s, y: 1.15 * s, z: dz * s }));
  p.push(part(box(3.8 * s, 0.14, 2.4 * s), THATCH, { y: 2.55 * s, z: 0.7 * s, rx: 0.5 }), part(box(3.8 * s, 0.14, 2.4 * s), THATCH_D, { y: 2.55 * s, z: -0.7 * s, rx: -0.5 }));
  p.push(part(box(3.9 * s, 0.16, 0.22), THATCH_D, { y: 3.05 * s }));
  return p;
}

// ---- dựng cảnh ---------------------------------------------------------------------------------------------------------
// addSceneryB20(scene, world, { shadows, mat, terrain, rng, groundY, seed }):
//   world: { colliders:[], … } (world-b20). Gắn world.boom = { show(), hide(), visible, x }.
//   terrain, rng: nhận cho khớp hợp đồng §6 nhưng không cần — hình học lấy thẳng từ terrain-b20.js, xếp chỗ tất định
//   theo seed (cảnh không xê dịch khi trận đổi chuỗi ngẫu nhiên).
//   groundY (hoặc world.groundY): độ cao đúng mặt lưới địa hình đang vẽ để đồ không lơ lửng; mặc định bedHeight.
// Trả { stakes:{ setState, setTide, state, layout }, rafts:{ drift, update }, boom, piers, towers, hq, layout,
//       update(dt, t, tideY), dispose(), info() }.
export function addSceneryB20(scene, world, { shadows = true, mat = lambert(), groundY = null, seed = SCN.seed } = {}) {
  const LO = layoutB20(seed), gy = groundY || world.groundY || bedHeight, rng = makeRng(seed + 7);
  const inst = makeInst(scene, mat, shadows), solid = solidAdder(world), objs = [], geos = [], mats = [];
  const track = (o) => { objs.push(o); return o; };
  const minG = (x, z, r, n = 8) => { let m = gy(x, z); for (let k = 0; k < n; k++) m = Math.min(m, gy(x + Math.cos(k * 6.283 / n) * r, z + Math.sin(k * 6.283 / n) * r)); return m; };
  const statics = [];
  const flags = [];                                   // { x, y, z, w, h, yaw, cell } — cell 0 "陳", 1 cờ lệnh

  // -- cột đá vôi: ba InstancedMesh (A cột mảnh, B hai đỉnh, C đảo đá có hàm ếch)
  const KG = { A: karstGeo({ seed: 11, h: 3.4 }), B: karstGeo({ seed: 23, h: 2.3, twin: true }), C: karstGeo({ seed: 37, h: 3.0, notch: true }) };
  const KI = {};
  for (const kind of ["A", "B", "C"]) { geos.push(KG[kind]); KI[kind] = track(inst(KG[kind], LO.karst.filter((k) => k.kind === kind).length, { cast: true })); KI[kind].name = "karst-" + kind; }
  for (const k of LO.karst) {
    const y = k.islet ? 0.2 - 0.2 * k.sy : minG(k.x, k.z, k.r * 0.85) - 0.6;
    KI[k.kind].put(k.x, y, k.z, k.ry, k.r, k.sy, new THREE.Color().setScalar(k.tint).getHex());
    const C = CLAMP;
    if (k.x > C.x0 - k.r && k.x < C.x1 + k.r && k.z > C.z0 - k.r && k.z < C.z1 + k.r) solid(k.x, k.z, k.r * 0.92);
  }

  // -- rừng ven sông
  const grove = groveGeo(); geos.push(grove);
  const trees = track(inst(grove, LO.trees.length, { cast: true })); trees.name = "trees";
  for (const t of LO.trees) trees.put(t.x, minG(t.x, t.z, 1.2, 4) - 0.15, t.z, t.ry, t.s, t.s * rng.range(0.9, 1.15));
  tintTrees(trees, rng);

  // -- sú vẹt, lau sậy, đá tảng
  const mg = mangroveGeo(); geos.push(mg);
  const mang = track(inst(mg, LO.mangroves.length, { cast: true })); mang.name = "mangroves";
  for (const m of LO.mangroves) mang.put(m.x, gy(m.x, m.z) - 0.05, m.z, m.ry, m.s, m.sy, new THREE.Color().setHSL(0.26 + rng.range(-0.03, 0.03), 0.3, 0.55 + rng.range(-0.1, 0.1)).getHex());
  const rg = reedGeo(4, 1.7); geos.push(rg);
  const reeds = track(inst(rg, LO.reeds.length)); reeds.name = "reeds";
  for (const r of LO.reeds) reeds.put(r.x, gy(r.x, r.z) - 0.1, r.z, r.ry, r.s, r.sy, new THREE.Color().setHSL(0.13 + r.c * 0.06, 0.35 + r.c * 0.15, 0.36 + (1 - r.c) * 0.14).getHex());
  const rk = rockGeo(); geos.push(rk);
  const rocks = track(inst(rk, LO.rocks.length, { cast: true })); rocks.name = "rocks";
  const ROCK = [0x9a968a, 0x857f70, 0xa39f92, 0x77736a];
  for (const r of LO.rocks) { rocks.put(r.x, gy(r.x, r.z) + r.s * 0.12, r.z, r.ry, r.s, r.s * rng.range(0.6, 1.0), rng.pick(ROCK), rng.range(-0.2, 0.2), rng.range(-0.2, 0.2)); if (r.s > 1.8) solid(r.x, r.z, r.s * 0.8); }

  // -- ba bãi cọc: hai InstancedMesh (cọc nguyên, cọc gãy) cho cả ba bãi
  const sgW = stakeGeo(false), sgB = stakeGeo(true); geos.push(sgW, sgB);
  const all = STAKE_FIELDS.flatMap((f) => LO.stakes[f.id]);
  const stW = track(inst(sgW, all.filter((s) => !s.broken).length, { cast: true })); stW.name = "stakes";
  const stB = track(inst(sgB, all.filter((s) => s.broken).length, { cast: true })); stB.name = "stakes-broken";
  let maxTop = -9;
  for (const s of all) { (s.broken ? stB : stW).put(s.x, s.y0, s.z, 0, s.r, s.L, new THREE.Color().setScalar(s.tint).getHex(), s.rx, s.rz); maxTop = Math.max(maxTop, s.top.y); }

  // -- bè cỏ + dây neo (dây nối góc bè với đỉnh bốn cọc quanh bè), phao đánh dấu mốc lộ
  const rfg = raftGeo(); geos.push(rfg);
  const raftIM = track(inst(rfg, STAKE_FIELDS.length, { cast: true })); raftIM.name = "rafts";
  const ropeIM = track(inst(unit("o3"), STAKE_FIELDS.length * 4 + 2)); ropeIM.name = "ropes";
  const buoyG = buoyGeo(); geos.push(buoyG);
  const buoyIM = track(inst(buoyG, STAKE_FIELDS.length)); buoyIM.name = "buoys";
  const RW = SCN.raft.w / 2 - 0.4, RD = SCN.raft.d / 2 - 0.3, CORN = [[-RW, -RD], [RW, -RD], [RW, RD], [-RW, RD]];
  const rafts = STAKE_FIELDS.map((f, i) => {
    const x = f.x, z = zc(f.x), stk = LO.stakes[f.id];
    const anchors = CORN.map(([cx, cz]) => {                                  // cọc gần điểm chéo ngoài góc bè ~8 m
      const tx = x + cx * 1.9, tz = z + cz * 2.4;
      let best = stk[0], bd = 1e9; for (const s of stk) { const d = Math.hypot(s.x - tx, s.z - tz); if (!s.broken && d < bd) { bd = d; best = s; } }
      return best.top;
    });
    raftIM.put(x, 0, z); ropeIM.put(0, -50, 0, 0, 0);
    for (let k = 1; k < 4; k++) ropeIM.put(0, -50, 0, 0, 0);
    buoyIM.put(0, -50, 0, 0, 0);
    return { id: f.id, i, x0: x, z0: z, x, z, yaw: 0, t: 0, drifting: false, gone: false, anchors, state: "hidden" };
  });
  ropeIM.put(0, -50, 0, 0, 0); ropeIM.put(0, -50, 0, 0, 0);                   // hai dây đầu phao chặn luồng
  ropeIM.count = ropeIM.max; raftIM.frustumCulled = ropeIM.frustumCulled = buoyIM.frustumCulled = false;

  // -- phao chặn luồng x 840 (ẩn tới pha 2): InstancedMesh khúc gỗ, mỗi khúc nổi theo con nước (không chìm vào bùn)
  const B = LO.boom, blg = boomLogGeo(); geos.push(blg);
  const boomIM = track(inst(blg, B.logs.length, { cast: true })); boomIM.name = "boom"; boomIM.frustumCulled = false;
  for (const l of B.logs) boomIM.put(l.x, 0, l.z, l.yaw);
  boomIM.visible = false;
  // neo: đầu nam hai cọc + tời trên bờ, đầu bắc cụm ba cọc đóng ở mép lòng (luôn hiện: chỗ chuẩn bị sẵn)
  {
    const S = B.anchorS, ys = gy(S.x, S.z), N = B.anchorN, yn = gy(N.x, N.z);
    for (const [dx, dz] of [[-1.2, 0], [1.2, 0]]) rod(statics, WOOD_D, S.x + dx, ys - 0.5, S.z + dz, S.x + dx, ys + 1.6, S.z + dz, 0.16, { sides: 6, cap: true });
    statics.push(part(cyl(0.3, 0.3, 2.2, 8), WOOD, { x: S.x, y: ys + 1.1, z: S.z, rz: Math.PI / 2 }), part(cyl(0.34, 0.34, 0.5, 8), ROPE, { x: S.x, y: ys + 1.1, z: S.z, rz: Math.PI / 2 }));
    for (const a of [0.2, 1.3, 2.6, 3.9, 5.0]) bar(statics, WOOD_D, S.x, ys + 1.1, S.z, S.x, ys + 1.1 + Math.sin(a) * 1.0, S.z + Math.cos(a) * 1.0, 0.08, 0.08);
    for (const [dx, dz, hh] of [[0, 0, 4.4], [0.9, 0.6, 3.9], [-0.7, 0.8, 3.6]]) rod(statics, WOOD_D, N.x + dx, yn - 1, N.z + dz, N.x + dx * 1.3, TIDE.high + hh - 2.2, N.z + dz * 1.3, 0.2, { sides: 6, cap: true });
    statics.push(part(cyl(0.34, 0.34, 0.5, 6), ROPE, { x: N.x, y: TIDE.high + 1.2, z: N.z }));
  }
  const boomEnds = [{ x: B.anchorN.x, y: TIDE.high + 1.3, z: B.anchorN.z }, { x: B.anchorS.x, y: gy(B.anchorS.x, B.anchorS.z) + 1.1, z: B.anchorS.z }];
  let boomT = -1;
  const boom = {
    x: B.x, visible: false, layout: B,
    show() { if (boom.visible) return; boom.visible = boomIM.visible = true; boomT = 0; },
    hide() { boom.visible = boomIM.visible = false; boomT = -1; },
  };
  world.boom = boom;

  // -- bến phục binh: cầu ván trên cọc, đầu bến chữ T, cọc buộc thuyền, thang xuống nước ròng, chòi, giá mái chèo, cờ
  for (const p of LO.piers) {
    const ux = p.dir.x, uz = p.dir.z, nx = -uz, nz = ux, Y = p.y, hwid = p.w / 2;
    const at = (s, l) => ({ x: p.x0 + ux * s + nx * l, z: p.z0 + uz * s + nz * l });
    const yaw = Math.atan2(-uz, ux);
    for (let s = 0.5; s < p.len; s += 1.0) { const a = at(s, -hwid), b = at(s, hwid); bar(statics, (Math.round(s) % 3) ? WOOD : 0x7a5a3a, a.x, Y, a.z, b.x, Y, b.z, 0.9, 0.1, 0); }
    for (const l of [-hwid + 0.3, hwid - 0.3]) { const a = at(0, l), b = at(p.len, l); bar(statics, WOOD_D, a.x, Y - 0.16, a.z, b.x, Y - 0.16, b.z, 0.2, 0.2); }
    for (let s = 1.2; s <= p.len + 0.01; s += 2.5) for (const l of [-hwid, hwid]) { const q = at(s, l); rod(statics, WOOD_D, q.x, gy(q.x, q.z) - 0.6, q.z, q.x, Y + 0.35, q.z, 0.13, { sides: 5, cap: true }); }
    // đầu bến chữ T
    const hd = p.head;
    for (let l = -hd.w / 2 + 0.45; l < hd.w / 2; l += 0.9) { const a = at(p.len - hd.d, l), b = at(p.len, l); bar(statics, WOOD, a.x, Y + 0.01, a.z, b.x, Y + 0.01, b.z, 0.85, 0.1, 0); }
    for (const [s, l] of [[p.len - 0.3, -hd.w / 2 + 0.3], [p.len - 0.3, hd.w / 2 - 0.3], [p.len - hd.d + 0.3, -hd.w / 2 + 0.3], [p.len - hd.d + 0.3, hd.w / 2 - 0.3]]) {
      const q = at(s, l); rod(statics, WOOD_D, q.x, gy(q.x, q.z) - 0.6, q.z, q.x, Y + 0.9, q.z, 0.16, { sides: 6, cap: true });
      statics.push(part(cyl(0.2, 0.2, 0.14, 6), ROPE, { x: q.x, y: Y + 0.55, z: q.z }));
    }
    { const a = at(p.len + 0.1, 0.9), b = at(p.len + 0.1, -0.9), ga = gy(a.x, a.z) - 0.3;          // thang xuống lúc nước ròng
      for (const q of [a, b]) bar(statics, WOOD_D, q.x, ga, q.z, q.x, Y + 0.05, q.z, 0.1, 0.1);
      for (let y = ga + 0.4; y < Y; y += 0.45) bar(statics, WOOD, a.x, y, a.z, b.x, y, b.z, 0.08, 0.08); }
    // chòi tranh, giá mái chèo, thúng, cờ trên cột ở gốc bến
    const hut = at(-6, p.w + 3.2), hy = minG(hut.x, hut.z, 2.2, 6);
    statics.push(placeParts(hutParts(1), hut.x, hy, hut.z, yaw + Math.PI / 2)); solid(hut.x, hut.z, 2.1);
    const rk2 = at(-3.5, -(p.w + 2.2)), ry2 = gy(rk2.x, rk2.z);
    statics.push(placeParts([part(box(0.1, 1.4, 0.1), WOOD, { x: -0.9, y: 0.7 }), part(box(0.1, 1.4, 0.1), WOOD, { x: 0.9, y: 0.7 }), part(box(2.0, 0.08, 0.08), WOOD, { y: 1.3 }),
      ...[0, 1, 2, 3].map((k) => part(box(0.12, 2.6, 0.04), 0x8a6a44, { x: -0.6 + k * 0.4, y: 1.1, z: 0.18, rx: -0.2 }))], rk2.x, ry2, rk2.z, yaw));
    for (const [s, l] of [[-2, 2.4], [-2.6, 3.3]]) { const q = at(s, l); statics.push(part(cyl(0.7, 0.5, 0.45, 8), 0x8c7a52, { x: q.x, y: gy(q.x, q.z) + 0.2, z: q.z, rz: 0.2 })); }
    const fp = at(-1, -(hwid + 1.2)), fy = gy(fp.x, fp.z);
    rod(statics, PAL.then, fp.x, fy - 0.3, fp.z, fp.x, fy + 7.2, fp.z, 0.08, { sides: 5 });
    flags.push({ x: fp.x, y: fy + 7.0, z: fp.z, w: 1.1, h: 2.4, yaw: yaw + Math.PI / 2, cell: 0 });
  }

  // -- tháp canh tre gỗ: bốn chân choãi, giằng chéo, sàn, lan can, mái tranh, thang phía đất, cờ
  for (const t of LO.towers) {
    const y = minG(t.x, t.z, 2.2, 6) - 0.2, H = 8.2, S = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    const towardLand = t.side;                                                   // bờ bắc (−1): đất ở −z
    for (const [a, b] of S) rod(statics, BAMBOO_D, t.x + a * 1.75, y - 0.3, t.z + b * 1.75, t.x + a * 1.12, y + H + 1.5, t.z + b * 1.12, 0.12, { sides: 5 });
    for (const lv of [2.6, 5.4]) for (let k = 0; k < 4; k++) {
      const [a0, b0] = S[k], [a1, b1] = S[(k + 1) % 4], r0 = 1.75 - 0.6 * (lv - 1.4) / H, r1 = 1.75 - 0.6 * (lv + 1.4) / H;
      bar(statics, BAMBOO, t.x + a0 * r0, y + lv - 1.4, t.z + b0 * r0, t.x + a1 * r1, y + lv + 1.4, t.z + b1 * r1, 0.07, 0.07);
      bar(statics, BAMBOO, t.x + a1 * r0, y + lv - 1.4, t.z + b1 * r0, t.x + a0 * r1, y + lv + 1.4, t.z + b0 * r1, 0.07, 0.07);
    }
    statics.push(part(box(3.3, 0.2, 3.3), WOOD, { x: t.x, y: y + H, z: t.z }));
    for (let k = 0; k < 4; k++) { const [a0, b0] = S[k], [a1, b1] = S[(k + 1) % 4]; bar(statics, BAMBOO, t.x + a0 * 1.55, y + H + 1.0, t.z + b0 * 1.55, t.x + a1 * 1.55, y + H + 1.0, t.z + b1 * 1.55, 0.08, 0.08); }
    statics.push(part(cone(2.7, 1.7, 4), THATCH, { x: t.x, y: y + H + 2.3, z: t.z, ry: Math.PI / 4 }));
    // thang phía đất
    const lz = t.z + towardLand * 2.9;
    for (const dx of [-0.35, 0.35]) bar(statics, BAMBOO_D, t.x + dx, y - 0.2, lz, t.x + dx, y + H + 0.1, t.z + towardLand * 1.6, 0.08, 0.08);
    for (let k = 1; k < 18; k++) { const q = k / 18, zz = lz + (t.z + towardLand * 1.6 - lz) * q; bar(statics, BAMBOO, t.x - 0.35, y + q * H, zz, t.x + 0.35, y + q * H, zz, 0.05, 0.05); }
    // chòi dưới chân, trống báo trên sàn, cờ
    const hx = t.x + 6, hz = t.z + towardLand * 4, hy = minG(hx, hz, 2, 6);
    statics.push(placeParts(hutParts(0.9), hx, hy, hz, 0)); solid(hx, hz, 1.9);
    statics.push(part(cyl(0.4, 0.4, 0.6, 8), 0x8a5a3a, { x: t.x + 0.8, y: y + H + 0.45, z: t.z + 0.6, rz: Math.PI / 2 }));
    rod(statics, PAL.then, t.x - 1.2, y + H, t.z - 1.2, t.x - 1.2, y + H + 4.6, t.z - 1.2, 0.06, { sides: 5 });
    flags.push({ x: t.x - 1.2, y: y + H + 4.5, z: t.z - 1.2, w: 0.9, h: 1.9, yaw: Math.PI * 0.75, cell: 0 });
    solid(t.x, t.z, 2.2);
  }

  // -- bản doanh Hưng Đạo vương: rào cọc tròn (cổng hướng sông), nhà bạt chỉ huy, lều, trống, giá vũ khí, cờ "陳",
  //    cờ lệnh (đỏ trơn viền vàng — không có chữ "Sát Thát")
  {
    const Q = LO.hq, Y = gy(Q.x, Q.z), n = Math.floor((2 * Math.PI * Q.palR) / 0.8);
    const gateDiff = (a) => Math.abs(Math.atan2(Math.sin(a - Q.gate), Math.cos(a - Q.gate)));
    let run = [];                                                                 // va chạm rào: đoạn nối mỗi 3 cọc
    const closeArc = () => { for (let k = 0; k + 1 < run.length; k += 3) { const p0 = run[k], p1 = run[Math.min(k + 3, run.length - 1)]; world.colliders.push({ x0: p0.x, z0: p0.z, x1: p1.x, z1: p1.z, r: 0.5 }); } run = []; };
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      if (gateDiff(a) < Q.gateHalf) { closeArc(); continue; }
      const x = Q.x + Math.cos(a) * Q.palR, z = Q.z + Math.sin(a) * Q.palR, y = gy(x, z), hh = 2.2 + (i % 3) * 0.2;
      if (i < n) rod(statics, i % 4 ? WOOD : WOOD_D, x, y - 0.4, z, x, y + hh, z, 0.12, { sides: 5, tip: 0.35, tipCol: 0x9c7c52 });
      run.push({ x, z });
      if (i % 2 === 0 && i < n) { const a2 = ((i + 2) / n) * Math.PI * 2; if (gateDiff(a2) >= Q.gateHalf) { const x2 = Q.x + Math.cos(a2) * Q.palR, z2 = Q.z + Math.sin(a2) * Q.palR; bar(statics, WOOD_D, x, y + 1.2, z, x2, gy(x2, z2) + 1.2, z2, 0.1, 0.08); } }
    }
    closeArc();
    // cổng: hai cột cao, xà ngang
    const gx = Math.cos(Q.gate), gz = Math.sin(Q.gate), tx = -gz, tz = gx, gw = Math.sin(Q.gateHalf) * Q.palR;
    const g0 = { x: Q.x + gx * Q.palR + tx * gw, z: Q.z + gz * Q.palR + tz * gw }, g1 = { x: Q.x + gx * Q.palR - tx * gw, z: Q.z + gz * Q.palR - tz * gw };
    for (const g of [g0, g1]) { const y = gy(g.x, g.z); rod(statics, PAL.sonDam, g.x, y - 0.4, g.z, g.x, y + 5.2, g.z, 0.2, { sides: 6, cap: true }); flags.push({ x: g.x, y: y + 7.6, z: g.z, w: 1.2, h: 2.6, yaw: Math.atan2(-gz, gx) + (g === g0 ? -1.2 : 1.2), cell: 0 }); rod(statics, PAL.then, g.x, y + 5.2, g.z, g.x, y + 7.8, g.z, 0.07, { sides: 5 }); }
    { const y0 = gy(g0.x, g0.z) + 4.6, y1 = gy(g1.x, g1.z) + 4.6; bar(statics, PAL.son, g0.x, y0, g0.z, g1.x, y1, g1.z, 0.35, 0.3); bar(statics, PAL.vang, g0.x, y0 + 0.22, g0.z, g1.x, y1 + 0.22, g1.z, 0.4, 0.08); }
    // nhà bạt chỉ huy quay mặt ra cổng
    const fy = Math.atan2(gx, gz);                                                // yaw để +z cục bộ hướng ra cổng
    statics.push(placeParts(pavilionParts(), Q.x - gx * 4, Y, Q.z - gz * 4, fy)); solid(Q.x - gx * 4, Q.z - gz * 4, 4.6);
    // cờ lệnh cao trước nhà bạt
    const cf = { x: Q.x + gx * 3 + tx * 3.2, z: Q.z + gz * 3 + tz * 3.2 };
    rod(statics, PAL.then, cf.x, Y - 0.3, cf.z, cf.x, Y + 12.5, cf.z, 0.1, { sides: 6 }); statics.push(part(ico(0.22, 0), PAL.vang, { x: cf.x, y: Y + 12.6, z: cf.z }));
    flags.push({ x: cf.x, y: Y + 12.2, z: cf.z, w: 2.0, h: 4.2, yaw: Math.atan2(-gz, gx) + Math.PI * 0.5, cell: 1 });
    // cờ "陳" góc sau
    for (const s of [-1, 1]) { const a = Q.gate + Math.PI + s * 0.75, x = Q.x + Math.cos(a) * (Q.palR - 1.5), z = Q.z + Math.sin(a) * (Q.palR - 1.5), y = gy(x, z);
      rod(statics, PAL.then, x, y - 0.3, z, x, y + 8.4, z, 0.08, { sides: 5 }); flags.push({ x, y: y + 8.2, z, w: 1.2, h: 2.6, yaw: a + Math.PI * 0.5, cell: 0 }); }
    // lều quanh (chừa đường cổng → nhà bạt)
    const TC = [PAL.son, PAL.vai, PAL.sonDam, PAL.vai, 0xc9b98f, PAL.son];
    [[-2.2, 11.5], [-1.5, 12.5], [-0.8, 13], [0.8, 13], [1.5, 12.5], [2.2, 11.5]].forEach(([da, r], i) => {
      const a = Q.gate + Math.PI + da * 0.62, x = Q.x + Math.cos(a) * r, z = Q.z + Math.sin(a) * r;
      statics.push(placeParts(tentParts(TC[i], 1.05), x, gy(x, z), z, Math.atan2(Q.x - x, Q.z - z))); solid(x, z, 2.3);
    });
    // trống trận, giá vũ khí hai bên đường vào
    const dp = { x: Q.x + gx * 11 - tx * 5, z: Q.z + gz * 11 - tz * 5 };
    statics.push(placeParts(drumParts(), dp.x, gy(dp.x, dp.z), dp.z, fy)); solid(dp.x, dp.z, 1.3);
    for (const s of [1, -1]) { const q = { x: Q.x + gx * 8 + tx * 6 * s, z: Q.z + gz * 8 + tz * 6 * s }; statics.push(placeParts(rackParts(), q.x, gy(q.x, q.z), q.z, fy + Math.PI / 2)); }
    for (let k = 0; k < 5; k++) { const a = Q.gate + Math.PI + (k - 2) * 0.3, x = Q.x + Math.cos(a) * 16.5, z = Q.z + Math.sin(a) * 16.5; statics.push(part(box(0.9, 0.7, 0.9), 0x7a6040, { x, y: gy(x, z) + 0.35, z, ry: k }), part(box(0.95, 0.08, 0.95), PAL.then, { x, y: gy(x, z) + 0.72, z, ry: k })); }
  }

  // -- lưới gộp tĩnh (bến, tháp, bản doanh, neo phao)
  let staticMesh = null;
  if (statics.length) { const g = merge(statics); geos.push(g); staticMesh = track(new THREE.Mesh(g, mat)); staticMesh.name = "b20-statics"; staticMesh.castShadow = shadows; staticMesh.receiveShadow = true; scene.add(staticMesh); }
  const fb = flagBatch(scene, [{ bg: "#9b2d20", fg: "#f1d98a", text: "陳" }, { bg: "#a3281c", fg: "#c9a14a", text: "", border: 12, inner: true }], flags);
  track(fb.mesh);

  // -- núi đá vôi xa (ngoài sương), mây. Bắc, nam: dãy núi đá dốc; tây: núi đất xa; đông: đảo đá ngoài vịnh (Hạ Long).
  const sky = addSkyKit(scene, makeRng(seed + 99), [
    [560, -700, 26, 900, 60, 150, 0x5a6670, { radMul: [0.38, 0.62], shape: "karst", spreadZ: 90 }],
    [560, 700, 26, 900, 55, 140, 0x5a6670, { radMul: [0.38, 0.62], shape: "karst", spreadZ: 90 }],
    [-720, 0, 10, 360, 40, 90, 0x5a6560, { radMul: [1.6, 2.4] }],
    [1750, 0, 44, 480, 18, 70, 0x76828a, { radMul: [0.34, 0.55], shape: "karst", spreadZ: 560, sink: 4 }],
  ], { x0: -700, span: 2600, z: 700, n: 12, y0: 170, y1: 260 }, { x0: BOUNDS.minX, x1: BOUNDS.maxX, z0: BOUNDS.minZ, z1: BOUNDS.maxZ, pad: 40 });
  objs.push(sky.hills, sky.clouds);

  for (const o of [KI.A, KI.B, KI.C, trees, mang, reeds, rocks, stW, stB, raftIM, ropeIM, buoyIM, boomIM]) o.done();

  // ---- trạng thái động ------------------------------------------------------------------------------------------------
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler();
  let tideY = TIDE_Y(100), tNow = 0;
  const stakeVis = () => {
    // cọc ngập sâu (đỉnh dưới mặt nước > 0,35 m): nước che gần hết (alpha theo độ sâu tới đáy) — tắt hẳn cho đỡ lượt vẽ
    const vis = tideY < maxTop + 0.35;
    stW.visible = stB.visible = vis;
    stW.castShadow = stB.castShadow = shadows && tideY < maxTop - 0.4;
  };
  const setTide = (pct) => { tideY = TIDE_Y(pct); stakeVis(); };
  const drift = (id) => { const r = rafts.find((q) => q.id === id); if (r && !r.drifting && !r.gone) { r.drifting = true; r.t = 0; } };
  const states = {};
  for (const f of STAKE_FIELDS) states[f.id] = "hidden";
  const setState = (id, s) => {
    const r = rafts.find((q) => q.id === id); if (!r) return;
    states[id] = s;
    if (s === "active") drift(id);
    if (s === "hidden") { r.drifting = false; r.gone = false; r.x = r.x0; r.z = r.z0; r.yaw = 0; r.t = 0; }
  };
  const placeRaft = (r, ty, t) => {
    const R = SCN.raft, fade = r.drifting ? 1 - sstep(R.life - R.fade, R.life, r.t) : 1;
    const y = Math.max(ty, gy(r.x, r.z) + 0.15) + waveY(r.x, r.z, t, ty - gy(r.x, r.z)) * 0.8 - (1 - fade) * 0.6;
    _m.compose(_v.set(r.x, y, r.z), _q.setFromEuler(_e.set(0.02 * Math.sin(t * 0.9 + r.i), r.yaw, 0.03 * Math.sin(t * 1.1 + r.i * 2))), _s.setScalar(Math.max(1e-4, fade)));
    raftIM.setMatrixAt(r.i, _m);
    // dây neo: góc bè → đỉnh cọc; cắt (bè trôi) thì giấu
    for (let k = 0; k < 4; k++) {
      if (r.drifting || r.gone) { _m.makeScale(0, 0, 0); ropeIM.setMatrixAt(r.i * 4 + k, _m); continue; }
      const [cx, cz] = CORN[k], c = Math.cos(r.yaw), sn = Math.sin(r.yaw), px = r.x + cx * c + cz * sn, pz = r.z - cx * sn + cz * c, A = r.anchors[k];
      ropeIM.setMatrixAt(r.i * 4 + k, spanM(px, y + 0.1, pz, A.x, A.y, A.z, 0.035, 0.035));
    }
    // phao đánh dấu mốc lộ: cạnh thượng lưu bãi
    const bx = r.x0 - 26, bz = r.z0 + 9, by = Math.max(ty, gy(bx, bz)) + waveY(bx, bz, t) * 0.7;
    _m.compose(_v.set(bx, by, bz), _q.setFromEuler(_e.set(0.05 * Math.sin(t * 1.3 + r.i), r.i * 1.7, 0.06 * Math.sin(t * 1.7 + r.i))), _s.setScalar(states[r.id] === "exposed" ? 1 : 0));
    buoyIM.setMatrixAt(r.i, _m);
  };
  const updateRafts = (dt, ty) => {
    const R = SCN.raft;
    for (const r of rafts) {
      if (r.drifting && !r.gone) {
        r.t += dt; r.x += R.drift * dt; r.z += (zc(r.x) - r.z) * R.pull * dt; r.yaw += R.spin * dt * (r.i % 2 ? 1 : -1);
        if (r.t >= R.life) r.gone = true;
      }
      placeRaft(r, ty, tNow);
    }
    raftIM.instanceMatrix.needsUpdate = ropeIM.instanceMatrix.needsUpdate = buoyIM.instanceMatrix.needsUpdate = true;
  };
  const updateBoom = (dt, ty, t) => {
    if (!boom.visible) { for (const k of [12, 13]) { _m.makeScale(0, 0, 0); ropeIM.setMatrixAt(k, _m); } return; }
    if (boomT >= 0) boomT = Math.min(SCN.boom.raise, boomT + dt);
    const rise = boomT < 0 ? 1 : sstep(0, SCN.boom.raise, boomT);
    B.logs.forEach((l, i) => {
      const y = Math.max(ty + waveY(l.x, l.z, t, ty - l.ground) * 0.7, l.ground + 0.3) - (1 - rise) * 1.4;
      _m.compose(_v.set(l.x, y, l.z), _q.setFromEuler(_e.set(0.04 * Math.sin(t * 1.2 + i * 0.7), l.yaw, 0.03 * Math.sin(t + i))), _s.setScalar(1));
      boomIM.setMatrixAt(i, _m);
    });
    boomIM.instanceMatrix.needsUpdate = true;
    const first = B.logs[0], last = B.logs[B.logs.length - 1], L2 = SCN.boom.log / 2;
    const ends = [[boomEnds[0], first, -1], [boomEnds[1], last, 1]];
    ends.forEach(([E, l, sgn], k) => {
      const y = Math.max(ty, l.ground + 0.3) - (1 - rise) * 1.4 + 0.3, ex = l.x, ez = l.z + sgn * L2;
      ropeIM.setMatrixAt(12 + k, spanM(ex, y, ez, E.x, E.y, E.z, 0.05, 0.05));
    });
  };
  const update = (dt, t, ty = tideY) => {
    tNow = t;
    if (ty !== tideY) { tideY = ty; stakeVis(); }
    updateRafts(dt, ty);
    updateBoom(dt, ty, t);
    ropeIM.instanceMatrix.needsUpdate = true;
    sky.update(t); fb.update(t);
  };
  stakeVis(); update(0, 0, tideY);

  const info = () => {
    let tris = 0, draws = 0;
    const count = (o) => { if (!o.visible) return; const g = o.geometry, n = (g.index ? g.index.count : g.attributes.position.count) / 3; tris += n * (o.isInstancedMesh ? o.count : 1); draws++; };
    for (const o of objs) count(o);
    return { draws, tris: Math.round(tris), colliders: world.colliders.length, karst: LO.karst.length, trees: LO.trees.length, mangroves: LO.mangroves.length, reeds: LO.reeds.length, rocks: LO.rocks.length, stakes: all.length };
  };
  const dispose = () => {
    for (const o of objs) scene.remove(o);
    for (const g of geos) g.dispose();
    for (const m of mats) m.dispose();
    fb.dispose(); sky.dispose();
    if (world.boom === boom) delete world.boom;
  };
  return {
    stakes: { setState, setTide, state: states, layout: LO.stakes, maxTop },
    rafts: { drift, update: (dt, ty) => updateRafts(dt, ty ?? tideY), list: rafts },
    boom, piers: LO.piers, towers: LO.towers, hq: LO.hq, layout: LO,
    update, dispose, info, setTide,
  };
}
