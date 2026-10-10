// battle/ground.js — độ cao mặt đất và vùng cảnh của bản đồ Hàm Tử, tách khỏi world.js để không
// phụ thuộc three (kiểm thử được trong Node). world.js xuất lại mọi tên ở đây nên các module cũ
// vẫn import heightAt… từ "./world.js" như trước.
//
// Nhiều trận (đợt 9, lõi): địa hình mặc định là Hàm Tử (và sân Võ trường qua setTerrain). Trận khác đặt địa hình của
// nó bằng setBattleTerrain(T), boong thuyền bằng setDecks(deckSet), mặt nước bằng setWaterLevel(fn). heightAt, collide,
// mudAt, waterDist là binding sống (export let): đặt địa hình thì THAY HÀM, không thêm phép thử vào lời gọi — khi T,
// boong, nước đều null thì mọi hàm là đúng hàm của B15 như trước (không đổi một bit).

import { MAP, FRONTS, VILLAGE } from "../data/battle-b15.js";
import { LANE_TERRAIN } from "../data/terrain-b15.js";

const FRONT_LIST = Object.values(FRONTS);           // heightAt gọi hàng nghìn lần mỗi khung: không cấp phát mảng mỗi lần
export const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

function waterDistB15(x, z) { return Math.min(z - MAP.riverNorthZ, MAP.riverEastX - x); }
export let waterDist = waterDistB15;          // binding sống: trận khác đổi qua setBattleTerrain

// ---- nhiễu giá trị có seed (màu đất, rải đạo cụ) ------------------------------------------------
const hash2 = (i, j) => { let h = Math.imul(i, 374761393) + Math.imul(j, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
export function vnoise(x, z) {
  const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash2(i, j), b = hash2(i + 1, j), c = hash2(i, j + 1), d = hash2(i + 1, j + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export const fbm = (x, z) => 0.55 * vnoise(x, z) + 0.3 * vnoise(x * 2.1 + 17, z * 2.1 - 9) + 0.15 * vnoise(x * 4.3 - 5, z * 4.3 + 31);

// ---- vùng cảnh của bản đồ Hàm Tử (Hư cấu, chỉ để nhìn; không đổi bố cục chơi) -------------------
// Ruộng lúa bậc thềm ở dải nam quanh làng; gò đá giữa hai mặt trận; đất cháy quanh trại Nguyên.
export const ZONES = {
  paddy: { x0: 88, x1: 440, z0: 114, z1: 198, plotW: 16, plotD: 11 },
  knolls: [{ x: 228, z: -2, r: 26, h: 4.2 }, { x: 338, z: 8, r: 22, h: 3.4 }, { x: 160, z: -18, r: 17, h: 2.6 }, { x: 420, z: -14, r: 15, h: 2.2 }],
  scorch: { x0: 380, x1: 462 },
};
// Ô ruộng tại (x, z): null nếu ngoài vùng ruộng. kind: 0 ngập nước, 1 mạ non, 2 lúa chín, 3 gốc rạ.
export function paddyAt(x, z) {
  const Z = ZONES.paddy;
  if (x < Z.x0 || x > Z.x1 || z < Z.z0 || z > Z.z1) return null;
  if (Math.hypot(x - VILLAGE.x, z - VILLAGE.z) < VILLAGE.r + 8) return null;
  const i = Math.floor((x - Z.x0) / Z.plotW), j = Math.floor((z - Z.z0) / Z.plotD);
  // vụ lúa đi theo mảng (nhiễu thưa theo ô) chứ không ngẫu nhiên từng ô; lác đác ô lệch vụ
  const n = vnoise(i * 0.42 + 3.7, j * 0.55 - 1.3) * 0.85 + hash2(i + 101, j + 57) * 0.15;
  return { i, j, kind: n < 0.36 ? 0 : n < 0.58 ? 1 : n < 0.8 ? 2 : 3, x0: Z.x0 + i * Z.plotW, z0: Z.z0 + j * Z.plotD };
}
// 0..1: mức "trong vùng ruộng" (mép mềm 8 m) — dùng để san phẳng địa hình.
function paddyK(x, z) {
  const Z = ZONES.paddy;
  const k = smooth(Z.x0 - 8, Z.x0, x) * smooth(Z.x1 + 8, Z.x1, x) * smooth(Z.z0 - 8, Z.z0, z);
  return k * smooth(VILLAGE.r + 2, VILLAGE.r + 10, Math.hypot(x - VILLAGE.x, z - VILLAGE.z));
}

// ---- lũy, hào, hố, gò trên hai làn đánh (data/terrain-b15.js) -------------------------------------
// Mỗi công trình dài (lũy, hào) là một đoạn thẳng a → b; độ cao theo khoảng cách tới đoạn (đầu đoạn
// tròn), đoạn vỡ (gaps) hạ dần về mặt đất trong RAMP m. Hố có gờ đất hất lên quanh miệng. Tra theo lưới
// ô CELL m để heightAt không phải duyệt mọi công trình (hàm này gọi hàng nghìn lần mỗi khung).
const RAMP = 2.0, CELL = 16, LOOK_PAD = 4;
const PIT_FLOOR = 0.4, PIT_LIP = 0.2;                  // hố: đáy phẳng tới 0,4·r; gờ miệng cao 0,2·d
const LIN = [], PITS = [], MOUNDS = [];
for (const [kind, list] of [["berm", LANE_TERRAIN.berms], ["ditch", LANE_TERRAIN.ditches]]) for (const f of list) {
  const dx = f.b[0] - f.a[0], dz = f.b[1] - f.a[1], L2 = dx * dx + dz * dz, len = Math.sqrt(L2);
  const reach = kind === "berm" ? f.crest + f.slope : f.bottom + f.slope;
  LIN.push({ ...f, type: kind, ax: f.a[0], az: f.a[1], dx, dz, L2, len, reach, e: RAMP / len });
}
for (const p of LANE_TERRAIN.pits) PITS.push({ ...p, type: "pit", reach: p.r * 1.5 });
for (const m of LANE_TERRAIN.mounds) MOUNDS.push({ ...m, type: "mound", reach: m.r });
export const TERRAIN_FEATURES = [...LIN, ...PITS, ...MOUNDS];

const GX0 = 96, GZ0 = -208, GW = Math.ceil((496 - GX0) / CELL), GH = Math.ceil((208 - GZ0) / CELL);
const GRID = Array.from({ length: GW * GH }, () => []);
for (const f of TERRAIN_FEATURES) {
  let x0, x1, z0, z1;
  if (f.ax !== undefined) { x0 = Math.min(f.a[0], f.b[0]); x1 = Math.max(f.a[0], f.b[0]); z0 = Math.min(f.a[1], f.b[1]); z1 = Math.max(f.a[1], f.b[1]); }
  else { x0 = x1 = f.x; z0 = z1 = f.z; }
  const pad = f.reach + LOOK_PAD;                 // rộng hơn chân công trình: featureLook tô màu cả lối mòn, gờ đất ngoài chân
  for (let i = Math.max(0, Math.floor((x0 - pad - GX0) / CELL)); i <= Math.min(GW - 1, Math.floor((x1 + pad - GX0) / CELL)); i++)
    for (let j = Math.max(0, Math.floor((z0 - pad - GZ0) / CELL)); j <= Math.min(GH - 1, Math.floor((z1 + pad - GZ0) / CELL)); j++) GRID[j * GW + i].push(f);
}
const cellAt = (x, z) => {
  const i = Math.floor((x - GX0) / CELL), j = Math.floor((z - GZ0) / CELL);
  return i < 0 || j < 0 || i >= GW || j >= GH ? null : GRID[j * GW + i];
};
// tham số t dọc đoạn và khoảng cách tới đoạn
const _seg = { t: 0, d: 0 };
function seg(f, x, z) {
  let t = ((x - f.ax) * f.dx + (z - f.az) * f.dz) / f.L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
  _seg.t = t; _seg.d = Math.hypot(x - f.ax - f.dx * t, z - f.az - f.dz * t);
  return _seg;
}
// 1 ở giữa đoạn vỡ, 0 ở phần còn nguyên
function gapMask(f, t) {
  let m = 0;
  for (const [g0, g1] of f.gaps) if (t > g0 && t < g1) m = Math.max(m, smooth(g0, g0 + f.e, t) * smooth(g1, g1 - f.e, t));
  return m;
}

// Bật khi lưới địa hình đã đủ mịn để vẽ các công trình này (world.js, hạng mục làn đánh). Bật/tắt thì bỏ
// mặt lưới đã vẽ (MESH, xem heightAt): lưới cũ không còn khớp hàm độ cao mới.
let LANE_FEATURES = false;
export function setLaneFeatures(on) { LANE_FEATURES = !!on; MESH = null; }
export const laneFeaturesOn = () => LANE_FEATURES;

// Độ cao cộng thêm của lũy, hào, hố, gò tại (x, z) (m, âm = trũng xuống).
export function featureHeight(x, z) {
  if (!LANE_FEATURES) return 0;
  const cell = cellAt(x, z); if (!cell || !cell.length) return 0;
  let h = 0;
  for (const f of cell) {
    if (f.type === "berm") {
      const s = seg(f, x, z); if (s.d >= f.reach) continue;
      const wear = 0.9 + 0.1 * vnoise(s.t * f.len * 0.4, f.ax * 0.1);        // đỉnh lũy mòn không đều
      h += f.h * wear * (1 - smooth(f.crest, f.reach, s.d)) * (1 - gapMask(f, s.t));
    } else if (f.type === "ditch") {
      const s = seg(f, x, z); if (s.d >= f.reach) continue;
      h -= f.depth * (1 - smooth(f.bottom, f.reach, s.d)) * (1 - gapMask(f, s.t));
    } else if (f.type === "pit") {
      // lòng hố hình chảo đáy rộng, vách dốc nhất sát miệng (~50°) để gờ phía gần che bớt lòng hố khi nhìn
      // nghiêng (lưới 1,25 m chỉ có 2–3 vòng đỉnh trong hố: vách thoải đều thì ra kim tự tháp ngược, dễ đọc thành
      // ụ nổi); gờ đất hất lên quanh miệng 0,2·d
      const r = Math.hypot(x - f.x, z - f.z) / f.r; if (r >= 1.5) continue;
      h += -f.d * (1 - smooth(PIT_FLOOR, 1, r)) + PIT_LIP * f.d * smooth(0.7, 1, r) * (1 - smooth(1, 1.5, r));
    } else {
      const r = Math.hypot(x - f.x, z - f.z) / f.r; if (r >= 1) continue;
      h += f.h * (1 - smooth(0.2, 1, r));
    }
  }
  return h;
}

// Mức bùn lầy 0..1 tại (x, z): lòng hố ngập, hố đất, đáy hào. Dùng cho tốc chạy (hạng mục làn đánh).
// Binding sống: trận có địa hình riêng thì mudAt = T.mud (hoặc 0).
export let mudAt = mudB15;
function mudB15(x, z) {
  if (!LANE_FEATURES) return 0;
  const cell = cellAt(x, z); if (!cell || !cell.length) return 0;
  let m = 0;
  for (const f of cell) {
    if (f.type === "pit") {
      const r = Math.hypot(x - f.x, z - f.z) / f.r; if (r >= 0.75) continue;
      m = Math.max(m, (f.kind === "ngap" ? 1 : f.kind === "dat" ? 0.6 : 0.45) * smooth(0.75, 0.45, r));
    } else if (f.type === "ditch") {
      const s = seg(f, x, z); if (s.d >= f.bottom + 0.4) continue;
      m = Math.max(m, (f.kind === "hao_thanh" ? 0.9 : 0.75) * smooth(f.bottom + 0.4, f.bottom - 0.2, s.d) * (1 - gapMask(f, s.t)));
    }
  }
  return m;
}

// Công trình gần (x, z) nhất trong khoảng pad m quanh chân nó, hoặc null — để rải đạo cụ tránh lũy, hố.
export function featureNear(x, z, pad = 0) {
  if (!LANE_FEATURES) return null;
  const cell = cellAt(x, z); if (!cell) return null;
  let best = null, bd = Infinity;
  for (const f of cell) {
    let d;
    if (f.ax !== undefined) { const s = seg(f, x, z); d = s.d - f.reach; if (gapMask(f, s.t) > 0.99) continue; }
    else d = Math.hypot(x - f.x, z - f.z) - f.reach;
    if (d < pad && d < bd) { bd = d; best = f; }
  }
  return best;
}

// Dáng công trình tại (x, z) để tô màu đất (world.js). Trả một đối tượng dùng lại (không cấp phát):
//   bank 0..1 độ cao tương đối trên lũy (1 ở mặt đỉnh), crest 0..1 mặt đỉnh bị giẫm, luy 1 nếu là lũy Nguyên,
//   sink 0..1 độ trũng tương đối trong hào/hố (1 ở đáy), rim 0..1 đất hất lên mép hào, lip 0..1 gờ đất đào
//   hất quanh miệng hố, gap 0..1 lối vỡ/lối đắp và vệt mòn hai đầu lối (người đi qua), mound 0..1 trên gò,
//   pit loại hố có lòng sâu nhất tại đây (null nếu không trong hố), pd độ sâu hố đó (m).
const LOOK = { bank: 0, crest: 0, luy: 0, sink: 0, rim: 0, lip: 0, gap: 0, mound: 0, pit: null, pd: 0 };
export function featureLook(x, z) {
  const L = LOOK; L.bank = L.crest = L.luy = L.sink = L.rim = L.lip = L.gap = L.mound = L.pd = 0; L.pit = null;
  if (!LANE_FEATURES) return L;
  const cell = cellAt(x, z); if (!cell) return L;
  for (const f of cell) {
    if (f.type === "berm" || f.type === "ditch") {
      const s = seg(f, x, z); if (s.d >= f.reach + LOOK_PAD) continue;
      const g = gapMask(f, s.t), keep = 1 - g;
      L.gap = Math.max(L.gap, g * smooth(f.reach + LOOK_PAD, f.reach, s.d));
      if (f.type === "berm") {
        if (s.d < f.reach) {
          const k = (1 - smooth(f.crest, f.reach, s.d)) * keep;
          if (k > L.bank) { L.bank = k; L.luy = f.kind === "luy_nguyen" ? 1 : 0; }
          L.crest = Math.max(L.crest, smooth(f.crest + 0.35, f.crest - 0.2, s.d) * keep);
        }
      } else {
        if (s.d < f.reach) L.sink = Math.max(L.sink, (1 - smooth(f.bottom, f.reach, s.d)) * keep);
        // hào mới đào trước lũy: đất hất lên mép (phía ngoài chân mái), đứt quãng; hào thành cũ bờ cỏ, không có
        if (f.kind !== "hao_thanh") L.rim = Math.max(L.rim, smooth(f.reach - 0.4, f.reach + 0.2, s.d) * smooth(f.reach + 1.8, f.reach + 0.6, s.d) * keep * (0.45 + 0.4 * vnoise(s.t * f.len * 0.5, 7.3)));
      }
    } else if (f.type === "pit") {
      const r = Math.hypot(x - f.x, z - f.z) / f.r; if (r >= 1.9) continue;
      if (r < 1) { const k = 1 - smooth(PIT_FLOOR, 1, r); if (k > L.sink) { L.sink = k; L.pit = f.kind; L.pd = f.d; } }
      L.lip = Math.max(L.lip, smooth(0.78, 1.0, r) * (1 - smooth(1.15, 1.7, r)) * (0.75 + 0.25 * vnoise(Math.atan2(z - f.z, x - f.x) * 2.2, f.x)));
    } else {
      const r = Math.hypot(x - f.x, z - f.z) / f.r; if (r < 1) L.mound = Math.max(L.mound, 1 - smooth(0.2, 1, r));
    }
  }
  return L;
}

// Võ trường dùng mặt đất phẳng; bản đồ Hàm Tử dùng địa hình. Mọi module import heightAt nên
// đổi địa hình bằng setTerrain() trước khi dựng cảnh.
let TERRAIN = "map";
// Chọn địa hình dựng sẵn ("map" Hàm Tử, "arena" Võ trường); luôn bỏ địa hình / boong / nước của trận khác (buildWorld,
// buildArena gọi hàm này trước tiên nên trận trước có vỡ giữa chừng cũng không để lại địa hình B20 cho Võ trường).
export function setTerrain(t) { TERRAIN = t; MESH = null; if (BT || DECKS || WATER || OV) { BT = null; DECKS = null; WATER = null; OV = null; rebind(); } }
export const ARENA_R = 46;

// Độ cao mặt đất mọi module dùng (chân tướng/lính qua IK, đạo cụ, camera). Khi đã dựng lưới mịn (bật công
// trình, laneGridData) thì trả ĐÚNG mặt tam giác đang vẽ: lưới mịn lệch hàm giải tích tới ~0,27 m trên mái
// lũy/hào, ~0,2 m trong hố nên chân, đạo cụ, camera lơ lửng hoặc lún. Chưa dựng lưới, tắt công trình (bản đồ
// mặc định lưới 5 m), ngoài lưới, Võ trường: hàm giải tích như cũ.
function heightB15(x, z) {
  if (TERRAIN === "arena") return arenaHeight(x, z);
  return MESH !== null ? meshAt(MESH, x, z) : mapHeight(x, z, true);
}
export let heightAt = heightB15;              // binding sống: setBattleTerrain / setDecks thay hàm
// Hàm giải tích (lũy, hào, hố tính liền mạch): dựng lưới địa hình từ đây, không từ heightAt.
export function analyticHeightAt(x, z) { if (BT) return (BT.exact || BT.height)(x, z); return TERRAIN === "arena" ? arenaHeight(x, z) : mapHeight(x, z, true); }
// Mặt đất trước khi đắp lũy, đào hào/hố (cùng dốc chân tường thành như heightAt): mức nước hào, hố ngập.
export function bareHeightAt(x, z) { if (BT) return (BT.bare || BT.height)(x, z); return TERRAIN === "arena" ? arenaHeight(x, z) : mapHeight(x, z, false); }

// ---- địa hình của trận khác, boong thuyền, mặt nước (đợt 9 lõi) ----------------------------------------------------
// T = { id, height(x, z), bare?(x, z), exact?(x, z), mud?(x, z), waterDist?(x, z), clamp: { x0, x1, z0, z1 },
//       collideExtra?(x, z, r, o) → [x, z] mới | null } — o là vật đang di chuyển (tướng, lính, sĩ quan; có thể thiếu).
// deckSet: { heightAt(x, z) → y | NaN } (deck.js DeckSet) — heightAt tra boong trước, NaN thì mặt đất.
// Nước: fn(x?, z?) → cao độ mặt nước (m); waterLevel() = −Infinity khi chưa đặt (B15: mọi max(…, waterLevel()) giữ nguyên).
let BT = null, DECKS = null, WATER = null, BT_COL = null;
export function setBattleTerrain(T) {
  BT = T || null; MESH = null;
  if (BT) {
    LANE_FEATURES = false;                                              // lũy, hào, hố là của Hàm Tử
    const C = BT.clamp;
    BT_COL = { x0: C.x0 - 16, z0: C.z0 - 16, nx: Math.ceil((C.x1 - C.x0 + 32) / COL_CELL), nz: Math.ceil((C.z1 - C.z0 + 32) / COL_CELL) };
  }
  rebind();
}
export function setDecks(deckSet) { DECKS = deckSet || null; rebind(); }
// Lớp phủ trên địa hình đang dùng (B17 Tây Kết, dựng trên đất Hàm Tử: bùn đầm, gò thấp) — tùy chọn: O = { mud?(x, z) → 0..1, dh?(x, z) → m,
// mounds?: [{ x, z, r, h }] }. heightAt cộng dh, mudAt lấy max(bùn cũ, mud), perchNear (terrain-rules.js) xét thêm mounds. null (mặc định):
// heightAt, mudAt là đúng hàm cũ (B15 không đổi một bit). setTerrain (buildWorld, buildArena) và runBattle (lúc vào, lúc rời trận) bỏ lớp phủ.
let OV = null;
export function setOverlay(O) { OV = O || null; rebind(); }
export const overlay = () => OV;
export function setWaterLevel(fn) { WATER = fn || null; }
export const battleTerrain = () => BT;
export const decksOn = () => DECKS;
export function waterLevel(x, z) { return WATER !== null ? WATER(x, z) : -Infinity; }
// Mặt người, đồ đứng được: đất, boong hoặc mặt nước (cái nào cao hơn).
export function surfaceY(x, z) { const h = heightAt(x, z), w = waterLevel(x, z); return h > w ? h : w; }
function rebind() {
  let base = BT ? BT.height : heightB15;
  if (OV && OV.dh) { const b0 = base, f = OV.dh; base = (x, z) => b0(x, z) + f(x, z); }
  if (DECKS) { const D = DECKS, b1 = base; heightAt = (x, z) => { const y = D.heightAt(x, z); return y === y ? y : b1(x, z); }; }
  else heightAt = base;
  const T = BT;
  mudAt = T ? (T.mud ? (x, z) => T.mud(x, z) : () => 0) : mudB15;
  if (OV && OV.mud) { const m0 = mudAt, f = OV.mud; mudAt = (x, z) => { const a = m0(x, z), b = f(x, z); return a > b ? a : b; }; }
  waterDist = T ? (T.waterDist || (() => 999)) : waterDistB15;
  collide = T ? collideBT : collideB15;
}
const arenaHeight = (x, z) => 0.3 + (Math.hypot(x, z) > ARENA_R + 4 ? Math.min(6, (Math.hypot(x, z) - ARENA_R - 4) * 0.4) : 0);

function mapHeight(x, z, feat) {
  let h = 1.3 * Math.sin(x * 0.021 + 1.3) * Math.cos(z * 0.017) + 0.8 * Math.sin(x * 0.047 + z * 0.031) + 0.5 * Math.cos(z * 0.06 - x * 0.013);
  h += 2.2 * smooth(40, 0, x) + 1.5 * smooth(-150, -200, -Math.abs(z) - 50);   // gò phía tây và hai mép
  for (const f of FRONT_LIST) h *= 1 - 0.75 * smooth(20, 6, Math.abs(z - f.laneZ));
  h *= 1 - 0.8 * smooth(30, 10, Math.hypot(x - 34, z));                        // bản doanh
  // trong Hàm Tử quan. Lưới 5 m cũ vuốt bậc ở x = 458 thành dốc 455 → 460; lưới mịn (bật công trình) sẽ lộ
  // bậc thành vách ngay sau hào thành, nên khi bật thì dốc thật 456 → 460 (cùng dáng lưới cũ)
  if (LANE_FEATURES) h *= 1 - 0.75 * smooth(MAP.fortWallX - 6, MAP.fortWallX - 2, x);
  else if (x > MAP.fortWallX - 4) h *= 0.25;
  for (const k of ZONES.knolls) h += k.h * smooth(k.r, k.r * 0.2, Math.hypot(x - k.x, z - k.z));
  h = Math.max(h, -0.2) + 0.9;
  const pk = paddyK(x, z);
  if (pk > 0) h += (1.05 + 0.18 * Math.floor((z - ZONES.paddy.z0) / (ZONES.paddy.plotD * 2)) - h) * pk;   // ruộng bậc thềm
  if (feat) h += featureHeight(x, z);                                           // lũy, hào, hố, gò trên làn đánh
  const d = waterDistB15(x, z);
  if (d < 14) h = h * smooth(-2, 14, d) + (d < 0 ? Math.max(-3.2, d * 0.35) : 0.25) * (1 - smooth(-2, 14, d));
  return h;
}

// ---- lưới địa hình không đều (chỉ khi bật công trình làn đánh; world.js dựng BufferGeometry từ đây) --------
// Lưới chữ nhật đủ hàng đủ cột (mọi cột chạy suốt mọi hàng) nên không có đỉnh chữ T, không nứt. Cột dày
// nơi có công trình theo x (ụ ta, gò, bãi giằng co + lũy Nguyên, hào thành và dốc chân tường), hàng dày trên
// hai hành lang làn và hai đầu hào thành, hàng 2,5 m giữa hai làn (ô 1,15 × 5 m trước tường thành thành dải
// màu sọc); ngoài đó đúng mạng 5 m cũ (x = −80 + 5k, z = −280 + 5k), riêng lòng sông ngoài mép bắc và mép đông
// (đáy phẳng dưới nước) thưa 10 m để dành tam giác. Mỗi mục: [đầu, cuối, bước mong muốn] (bước thật chia đều).
const GRID_X = [[-80, 120, 5], [120, 130, 2.5], [130, 150, 1.25], [150, 175, 2.5], [175, 200, 1.25], [200, 225, 2.5],
  [225, 289, 1.25], [289, 307, 0.6], [307, 335, 1.25], [335, 445, 3], [445, 460, 1.15], [460, 470, 2.5], [470, 610, 5], [610, 680, 10]];
const GRID_Z = [[-280, -190, 10], [-190, -170, 5], [-170, -160, 1.25], [-160, -110, 5], [-110, -40, 1.25], [-40, 40, 2.5],
  [40, 110, 1.25], [110, 140, 5], [140, 150, 1.25], [150, 280, 5]];
function gridAxis(spans) {
  const a = [spans[0][0]];
  for (const [s0, s1, st] of spans) { const n = Math.max(1, Math.round((s1 - s0) / st)); for (let k = 1; k <= n; k++) a.push(s0 + (s1 - s0) * k / n); }
  return Float64Array.from(a);
}
// chỉ số ô chứa v trên trục (tìm nhị phân); -1 nếu ngoài lưới
function axisCell(a, v) {
  if (v < a[0] || v > a[a.length - 1]) return -1;
  let lo = 0, hi = a.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (a[m] <= v) lo = m; else hi = m; }
  return lo;
}

// Mặt lưới đã vẽ cho heightAt: trục, độ cao đỉnh, đường chéo từng ô, nghịch đảo bề rộng ô, bảng tra ô theo
// bước LUT_STEP (nhỏ hơn bước lưới nhỏ nhất 0,6 m nên từ ô tra được chỉ dò tới trước tối đa một ô), mảng mịn
// quanh hố (patchOf: ô thô → số mảng, −1 nếu không). null: chưa dựng hoặc đã bỏ (setLaneFeatures, setTerrain).
const LUT_STEP = 0.5, LUT_INV = 1 / LUT_STEP;
let MESH = null;
function axisLut(a) {
  const n = Math.floor((a[a.length - 1] - a[0]) * LUT_INV) + 1, lut = new Int32Array(n);
  for (let k = 0; k < n; k++) lut[k] = Math.min(a.length - 2, axisCell(a, a[0] + k * LUT_STEP));
  return lut;
}
// độ cao trên một ô: đỉnh a ở chỉ số o của H (nx đỉnh mỗi hàng), u, v ∈ [0, 1] trong ô, dg đường chéo của ô
function cellY(H, nx, o, dg, u, v) {
  const a = H[o], d = H[o + 1], b = H[o + nx], c = H[o + nx + 1];
  if (dg) return v >= u ? a + (c - b) * u + (b - a) * v : a + (d - a) * u + (c - d) * v;   // (a b c) (a c d)
  return u + v <= 1 ? a + (d - a) * u + (b - a) * v : c + (b - c) * (1 - u) + (d - c) * (1 - v);   // (a b d) (b c d)
}
// độ cao đúng tam giác đã vẽ tại (x, z): tra ô, nội suy trên tam giác (cùng đường chéo như lưới, ô mịn nếu trong
// mảng quanh hố); ngoài lưới thì hàm giải tích. Không cấp phát, không chia (nghịch đảo bề rộng ô tính sẵn).
function meshAt(M, x, z) {
  if (!(x >= M.xa && x <= M.xb && z >= M.za && z <= M.zb)) return mapHeight(x, z, true);
  const xs = M.xs, zs = M.zs, qx = M.qx, qz = M.qz;
  let i = M.lx[((x - M.xa) * LUT_INV) | 0], j = M.lz[((z - M.za) * LUT_INV) | 0];
  while (i < qx - 1 && xs[i + 1] <= x) i++;
  while (j < qz - 1 && zs[j + 1] <= z) j++;
  const u = (x - xs[i]) * M.iwx[i], v = (z - zs[j]) * M.iwz[j], cell = j * qx + i, p = M.patchOf[cell];
  if (p < 0) return cellY(M.H, qx + 1, j * (qx + 1) + i, M.diag[cell], u, v);
  // ô thô trong mảng mịn: chia đều nu × nv ô mịn
  const P = M.patches[p], li = i - P.i0, lj = j - P.j0, nu = P.nu[li], nv = P.nv[lj];
  let a = (u * nu) | 0, b = (v * nv) | 0; if (a >= nu) a = nu - 1; if (b >= nv) b = nv - 1;
  const fi = P.su[li] + a, fj = P.sv[lj] + b;
  return cellY(P.H, P.nx, fj * P.nx + fi, P.diag[fj * (P.nx - 1) + fi], u * nu - a, v * nv - b);
}

// Hố tròn trên lưới 1,25 m chỉ có 2–3 vòng đỉnh: thành hình thoi, nhìn nghiêng thì góc xa của thoi nhô thành
// chóp "∧" như đỉnh kim tự tháp (ảo giác mặt lõm), hố đọc thành ụ nổi. Mỗi hố một mảng mịn: các ô thô phủ tới
// PATCH_R·r quanh tâm hố chia đều thành ô ~PATCH_STEP m (chia từng ô thô nên mép mảng nằm trên cạnh ô thô). Đỉnh
// mịn trên mép mảng lấy nội suy thẳng theo cạnh ô thô kề bên (mặt liền, không hở chữ T); đỉnh trong mảng theo hàm
// giải tích. Thêm ~0,8 nghìn tam giác mỗi hố.
const PATCH_R = 1.3, PATCH_STEP = 0.42;

// Dữ liệu lưới: xs, zs (trục), H (độ cao đỉnh), diag (đường chéo từng ô), patches (số mảng mịn), pos (tam giác
// rời, 9 số mỗi tam giác, xếp theo ô thô; ô thô trong mảng là các ô mịn của nó), meshY(x, z) độ cao đúng mặt tam
// giác đã vẽ, forTris duyệt tam giác trong một hình chữ nhật. Gọi khi đã setLaneFeatures(true). Dựng xong thì
// heightAt theo lưới này (MESH). Lưới dựng từ analyticHeightAt, không từ heightAt.
export function laneGridData() {
  const xs = gridAxis(GRID_X), zs = gridAxis(GRID_Z), NX = xs.length, NZ = zs.length, QX = NX - 1, QZ = NZ - 1;
  const H = new Float32Array(NX * NZ);
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) H[j * NX + i] = analyticHeightAt(xs[i], zs[j]);
  // Mỗi ô chọn đường chéo sát mặt thật hơn ở tâm ô (hố tròn hơn, sống lũy bớt răng cưa); lệch dưới 2 cm thì
  // giữ chéo b–d như PlaneGeometry để đất phẳng vẫn một kiểu mặt như lưới 5 m. a (x0, z0), b (x0, z1), c (x1, z1), d (x1, z0).
  const pickDiag = (x0, x1, z0, z1, a, b, c, d) => {
    const hc = analyticHeightAt((x0 + x1) / 2, (z0 + z1) / 2);
    return Math.abs(hc - (a + c) / 2) + 0.02 < Math.abs(hc - (b + d) / 2) ? 1 : 0;
  };
  const diag = new Uint8Array(QX * QZ);
  for (let j = 0; j < QZ; j++) for (let i = 0; i < QX; i++)
    diag[j * QX + i] = pickDiag(xs[i], xs[i + 1], zs[j], zs[j + 1], H[j * NX + i], H[(j + 1) * NX + i], H[(j + 1) * NX + i + 1], H[j * NX + i + 1]);
  const inv = (a) => { const w = new Float64Array(a.length - 1); for (let k = 0; k < w.length; k++) w[k] = 1 / (a[k + 1] - a[k]); return w; };
  const patchOf = new Int16Array(QX * QZ).fill(-1), patches = [];
  const M = { xs, zs, H, diag, qx: QX, qz: QZ, xa: xs[0], xb: xs[NX - 1], za: zs[0], zb: zs[NZ - 1], iwx: inv(xs), iwz: inv(zs),
    lx: axisLut(xs), lz: axisLut(zs), patchOf, patches };

  // ---- mảng mịn quanh hố
  // trục mịn trên các ô thô k0..k1: n số ô mịn mỗi ô thô, s chỉ số đỉnh mịn đầu của ô thô, a toạ độ
  const sub = (ax, k0, k1) => {
    const n = new Int32Array(k1 - k0 + 1), s = new Int32Array(k1 - k0 + 1), pts = [ax[k0]];
    for (let k = k0; k <= k1; k++) {
      const w = ax[k + 1] - ax[k], m = Math.max(1, Math.round(w / PATCH_STEP));
      n[k - k0] = m; s[k - k0] = pts.length - 1;
      for (let q = 1; q <= m; q++) pts.push(q === m ? ax[k + 1] : ax[k] + w * q / m);
    }
    return { n, s, a: Float64Array.from(pts) };
  };
  for (const f of PITS) {
    const e = f.r * PATCH_R, i0 = axisCell(xs, f.x - e), i1 = axisCell(xs, f.x + e), j0 = axisCell(zs, f.z - e), j1 = axisCell(zs, f.z + e);
    if (i0 < 0 || i1 < 0 || j0 < 0 || j1 < 0 || i1 >= QX || j1 >= QZ) continue;
    let taken = false;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (patchOf[j * QX + i] >= 0) taken = true;
    if (taken) continue;                                                        // hai hố chồng mảng: hố sau giữ lưới thô
    const SX = sub(xs, i0, i1), SZ = sub(zs, j0, j1), fx = SX.a, fz = SZ.a, fnx = fx.length, fnz = fz.length;
    const FH = new Float32Array(fnx * fnz), fd = new Uint8Array((fnx - 1) * (fnz - 1));
    // mép mảng: meshAt khi các ô này chưa gắn mảng = nội suy thẳng theo cạnh ô thô (cạnh chung với ô ngoài mảng)
    for (let b = 0; b < fnz; b++) for (let a = 0; a < fnx; a++)
      FH[b * fnx + a] = a === 0 || b === 0 || a === fnx - 1 || b === fnz - 1 ? meshAt(M, fx[a], fz[b]) : analyticHeightAt(fx[a], fz[b]);
    for (let b = 0; b < fnz - 1; b++) for (let a = 0; a < fnx - 1; a++)
      fd[b * (fnx - 1) + a] = pickDiag(fx[a], fx[a + 1], fz[b], fz[b + 1], FH[b * fnx + a], FH[(b + 1) * fnx + a], FH[(b + 1) * fnx + a + 1], FH[b * fnx + a + 1]);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) patchOf[j * QX + i] = patches.length;
    patches.push({ i0, j0, nu: SX.n, nv: SZ.n, su: SX.s, sv: SZ.s, fx, fz, H: FH, nx: fnx, diag: fd });
  }

  // ---- tam giác theo từng ô thô (ô trong mảng: các ô mịn của nó); start[ô] = chỉ số tam giác đầu của ô
  const start = new Int32Array(QX * QZ + 1);
  for (let j = 0, c = 0; j < QZ; j++) for (let i = 0; i < QX; i++, c++) {
    const p = patchOf[c], P = patches[p];
    start[c + 1] = start[c] + (p < 0 ? 2 : 2 * P.nu[i - P.i0] * P.nv[j - P.j0]);
  }
  const tris = start[QX * QZ], pos = new Float32Array(tris * 9);
  let o = 0;
  const put = (x, y, z) => { pos[o++] = x; pos[o++] = y; pos[o++] = z; };
  // mặt quay lên (+y) như PlaneGeometry xoay −90° quanh x
  const quad = (x0, x1, z0, z1, a, b, c, d, alt) => {
    if (alt) { put(x0, a, z0); put(x0, b, z1); put(x1, c, z1); put(x0, a, z0); put(x1, c, z1); put(x1, d, z0); }   // (a b c) (a c d)
    else { put(x0, a, z0); put(x0, b, z1); put(x1, d, z0); put(x0, b, z1); put(x1, c, z1); put(x1, d, z0); }       // (a b d) (b c d)
  };
  for (let j = 0, c = 0; j < QZ; j++) for (let i = 0; i < QX; i++, c++) {
    const p = patchOf[c];
    if (p < 0) { quad(xs[i], xs[i + 1], zs[j], zs[j + 1], H[j * NX + i], H[(j + 1) * NX + i], H[(j + 1) * NX + i + 1], H[j * NX + i + 1], diag[c]); continue; }
    const P = patches[p], li = i - P.i0, lj = j - P.j0, nx = P.nx, F = P.H;
    for (let b = P.sv[lj]; b < P.sv[lj] + P.nv[lj]; b++) for (let a = P.su[li]; a < P.su[li] + P.nu[li]; a++)
      quad(P.fx[a], P.fx[a + 1], P.fz[b], P.fz[b + 1], F[b * nx + a], F[(b + 1) * nx + a], F[(b + 1) * nx + a + 1], F[b * nx + a + 1], P.diag[b * (nx - 1) + a]);
  }

  if (LANE_FEATURES && TERRAIN === "map") MESH = M;              // từ đây heightAt = mặt tam giác đang vẽ
  const meshY = (x, z) => meshAt(M, x, z);
  // fn(pos, chỉ số số đầu của tam giác) cho mọi tam giác của các ô chạm [x0, x1] × [z0, z1]
  const forTris = (x0, x1, z0, z1, fn) => {
    const i0 = Math.max(0, axisCell(xs, Math.max(x0, xs[0]))), i1 = axisCell(xs, Math.min(x1, xs[NX - 1]));
    const j0 = Math.max(0, axisCell(zs, Math.max(z0, zs[0]))), j1 = axisCell(zs, Math.min(z1, zs[NZ - 1]));
    for (let j = j0; j <= Math.min(j1, QZ - 1); j++) for (let i = i0; i <= Math.min(i1, QX - 1); i++) {
      const c = j * QX + i;
      for (let t = start[c]; t < start[c + 1]; t++) fn(pos, t * 9);
    }
  };
  return { xs, zs, NX, NZ, H, diag, pos, tris, patches: patches.length, meshY, forTris };
}

// ---- nước trong hố ngập và đáy hào thành ------------------------------------------------------------------
// Cắt chính các tam giác đất đã vẽ theo mặt nước: phần nằm dưới mức nước thành mặt nước ở đúng mức đó. Mép
// nước trùng đường giao với vách hố/hào (vách che mép, không có đĩa nước lơ lửng hay chìm), không trùng mặt
// với bùn (nước cao hơn đáy 0,4–0,5 m). Trả { pos (tam giác rời), body (mỗi đỉnh: 0 hố ngập, 1 hào thành) }.
export const MOAT_FILL = 0.4, PIT_FILL = 0.45;           // nước sâu so với đáy: hào 0,4 m; hố ngập 45% độ sâu
export function laneWaterData(grid) {
  const P = [], B = [], bodies = [];
  for (const f of TERRAIN_FEATURES) {
    if (f.type === "pit" && f.kind === "ngap") {
      const lv = bareHeightAt(f.x, f.z) - f.d * (1 - PIT_FILL);
      bodies.push({ x0: f.x - f.r, x1: f.x + f.r, z0: f.z - f.r, z1: f.z + f.r, level: () => lv, id: 0 });
    } else if (f.kind === "hao_thanh") {
      // mức nước theo mặt đất tại điểm gần nhất trên tim hào (hai đầu hào giữ mức của đầu mút)
      const level = (x, z) => { let t = ((x - f.ax) * f.dx + (z - f.az) * f.dz) / f.L2; t = t < 0 ? 0 : t > 1 ? 1 : t; return bareHeightAt(f.ax + f.dx * t, f.az + f.dz * t) - f.depth + MOAT_FILL; };
      bodies.push({ x0: Math.min(f.a[0], f.b[0]) - f.reach, x1: Math.max(f.a[0], f.b[0]) + f.reach, z0: Math.min(f.a[1], f.b[1]) - f.reach, z1: Math.max(f.a[1], f.b[1]) + f.reach, level, id: 1 });
    }
  }
  const vx = [0, 0, 0], vz = [0, 0, 0], vf = [0, 0, 0], vl = [0, 0, 0], poly = [];
  for (const b of bodies) grid.forTris(b.x0, b.x1, b.z0, b.z1, (pos, q) => {
    let under = 0;
    for (let k = 0; k < 3; k++) {
      const x = pos[q + k * 3], y = pos[q + k * 3 + 1], z = pos[q + k * 3 + 2];
      vx[k] = x; vz[k] = z; vl[k] = b.level(x, z); vf[k] = y - vl[k]; if (vf[k] < 0) under++;
    }
    if (!under) return;
    poly.length = 0;                                    // cắt Sutherland–Hodgman theo f = đất − mức nước < 0, giữ chiều quay
    for (let k = 0; k < 3; k++) {
      const n = (k + 1) % 3;
      if (vf[k] < 0) poly.push(vx[k], vl[k], vz[k]);
      if ((vf[k] < 0) !== (vf[n] < 0)) {
        const t = vf[k] / (vf[k] - vf[n]);
        poly.push(vx[k] + (vx[n] - vx[k]) * t, vl[k] + (vl[n] - vl[k]) * t, vz[k] + (vz[n] - vz[k]) * t);
      }
    }
    for (let k = 3; k + 3 < poly.length; k += 3) {
      P.push(poly[0], poly[1], poly[2], poly[k], poly[k + 1], poly[k + 2], poly[k + 3], poly[k + 4], poly[k + 5]);
      B.push(b.id, b.id, b.id);
    }
  });
  return { pos: Float32Array.from(P), body: Uint8Array.from(B) };
}

// ---- va chạm: lưới ô tra nhanh ------------------------------------------------------------------------
// collide() chạy cho mọi lính mỗi bước 1/60 s; duyệt cả world.colliders (vài trăm vật) là phí. Lưới đều
// COL_CELL m: mỗi ô giữ chỉ số (theo thứ tự gốc) những vật có hộp bao đoạn nới rộng r + COL_R + COL_MOVE chạm
// ô. Tra ô chứa điểm gốc p0 rồi xét các vật đó theo đúng thứ tự gốc. Kết quả y hệt duyệt cả mảng:
//   vật không có trong ô ⇒ p0 ngoài hộp nới ⇒ |p0 − đoạn| > r + COL_R + COL_MOVE; chừng nào điểm còn cách p0
//   ≤ COL_MOVE thì |p − đoạn| > r + radius (radius ≤ COL_R) ⇒ vật đó không đẩy ⇒ bỏ qua không đổi gì.
// Điểm bị đẩy xa p0 hơn COL_MOVE (hiếm), radius > COL_R hoặc điểm ngoài lưới thì duyệt cả mảng như cũ.
// Lưới dựng lại khi số vật đổi (module khác push thêm sau buildWorld) hoặc mảng bị thay; ai dời vật đã có
// thì đặt world.colGrid = null.
const COL_CELL = 8, COL_R = 1.0, COL_MOVE = 3, COL_X0 = -48, COL_Z0 = -248, COL_NX = 92, COL_NZ = 62;
const COL_B15 = { x0: COL_X0, z0: COL_Z0, nx: COL_NX, nz: COL_NZ };   // khung lưới Hàm Tử; trận khác theo clamp của T
const NO_COL = new Int32Array(0);
function colliderGrid(world, S = COL_B15) {
  const cs = world.colliders, NX = S.nx, cells = Array.from({ length: NX * S.nz }, () => []);
  for (let k = 0; k < cs.length; k++) {
    const c = cs[k], e = c.r + COL_R + COL_MOVE + 0.05;
    const i0 = Math.max(0, Math.floor((Math.min(c.x0, c.x1) - e - S.x0) / COL_CELL)), i1 = Math.min(NX - 1, Math.floor((Math.max(c.x0, c.x1) + e - S.x0) / COL_CELL));
    const j0 = Math.max(0, Math.floor((Math.min(c.z0, c.z1) - e - S.z0) / COL_CELL)), j1 = Math.min(S.nz - 1, Math.floor((Math.max(c.z0, c.z1) + e - S.z0) / COL_CELL));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) cells[j * NX + i].push(k);
  }
  return (world.colGrid = { arr: cs, n: cs.length, spec: S, cells: cells.map((a) => (a.length ? Int32Array.from(a) : NO_COL)) });
}
// đẩy (x, z) ra khỏi một vật (đoạn thẳng có bề dày); kết quả ở _cx, _cz, trả true nếu có đẩy
let _cx = 0, _cz = 0;
function pushOut(c, x, z, radius) {
  const dx = c.x1 - c.x0, dz = c.z1 - c.z0, L2 = dx * dx + dz * dz;
  let t = ((x - c.x0) * dx + (z - c.z0) * dz) / L2; t = Math.max(0, Math.min(1, t));
  const px = c.x0 + dx * t, pz = c.z0 + dz * t;
  const ox = x - px, oz = z - pz, d = Math.hypot(ox, oz), min = c.r + radius;
  if (d < min && d > 1e-6) { _cx = px + (ox / d) * min; _cz = pz + (oz / d) * min; return true; }
  return false;
}

// Đẩy một điểm ra khỏi tường (đoạn thẳng có bề dày). Cổng đóng coi như tường. world: { arena?, colliders,
// gates } — thuần, không three (world.js xuất lại hàm này). Tham số thứ 6 (o, vật đang di chuyển) chỉ địa hình của trận
// khác dùng (T.collideExtra: lan can boong, nước sâu, thân thuyền). Binding sống: setBattleTerrain đổi sang collideBT.
export let collide = collideB15;
function collideB15(world, x, z, radius, openGates) {
  if (world.arena) {
    const d = Math.hypot(x, z), max = ARENA_R - radius;
    return d > max ? [x / d * max, z / d * max] : [x, z];
  }
  const cs = world.colliders;
  let g = world.colGrid;
  if (!g || g.arr !== cs || g.n !== cs.length || g.spec !== COL_B15) g = colliderGrid(world);
  const ci = Math.floor((x - COL_X0) / COL_CELL), cj = Math.floor((z - COL_Z0) / COL_CELL);
  let fast = radius <= COL_R && ci >= 0 && cj >= 0 && ci < COL_NX && cj < COL_NZ;
  if (fast) {
    const list = g.cells[cj * COL_NX + ci];
    let px = x, pz = z;
    for (let q = 0; q < list.length; q++) {
      if (!pushOut(cs[list[q]], px, pz, radius)) continue;
      px = _cx; pz = _cz;
      if ((px - x) * (px - x) + (pz - z) * (pz - z) > COL_MOVE * COL_MOVE) { fast = false; break; }
    }
    if (fast) { x = px; z = pz; }
  }
  if (!fast) for (const c of cs) if (pushOut(c, x, z, radius)) { x = _cx; z = _cz; }
  for (const id in world.gates) {
    const gt = world.gates[id];
    if (openGates[id]) continue;
    if (Math.abs(z - gt.z) < 5 && Math.abs(x - gt.x) < 1.6 + radius) x = x < gt.x ? gt.x - 1.6 - radius : gt.x + 1.6 + radius;
  }
  x = Math.max(4, Math.min(MAP.riverEastX + 3, x));
  z = Math.max(MAP.riverNorthZ - 3, Math.min(196, z));
  return [x, z];
}

// Va chạm trên địa hình của trận khác: như collideB15 (vật, cổng) với lưới theo clamp của T, rồi T.collideExtra, rồi kẹp
// trong T.clamp.
function collideBT(world, x, z, radius, openGates, o) {
  if (world.arena) {
    const d = Math.hypot(x, z), max = ARENA_R - radius;
    return d > max ? [x / d * max, z / d * max] : [x, z];
  }
  const T = BT, S = BT_COL, cs = world.colliders;
  let g = world.colGrid;
  if (!g || g.arr !== cs || g.n !== cs.length || g.spec !== S) g = colliderGrid(world, S);
  const ci = Math.floor((x - S.x0) / COL_CELL), cj = Math.floor((z - S.z0) / COL_CELL);
  let fast = radius <= COL_R && ci >= 0 && cj >= 0 && ci < S.nx && cj < S.nz;
  if (fast) {
    const list = g.cells[cj * S.nx + ci];
    let px = x, pz = z;
    for (let q = 0; q < list.length; q++) {
      if (!pushOut(cs[list[q]], px, pz, radius)) continue;
      px = _cx; pz = _cz;
      if ((px - x) * (px - x) + (pz - z) * (pz - z) > COL_MOVE * COL_MOVE) { fast = false; break; }
    }
    if (fast) { x = px; z = pz; }
  }
  if (!fast) for (const c of cs) if (pushOut(c, x, z, radius)) { x = _cx; z = _cz; }
  for (const id in world.gates) {
    const gt = world.gates[id];
    if (openGates?.[id]) continue;
    if (Math.abs(z - gt.z) < 5 && Math.abs(x - gt.x) < 1.6 + radius) x = x < gt.x ? gt.x - 1.6 - radius : gt.x + 1.6 + radius;
  }
  if (T.collideExtra) { const r = T.collideExtra(x, z, radius, o); if (r) { x = r[0]; z = r[1]; } }
  const C = T.clamp;
  x = Math.max(C.x0, Math.min(C.x1, x));
  z = Math.max(C.z0, Math.min(C.z1, z));
  return [x, z];
}
