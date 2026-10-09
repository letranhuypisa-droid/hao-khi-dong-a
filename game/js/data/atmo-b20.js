// data/atmo-b20.js — trời, nắng, sương, khói của B20 Bạch Đằng theo 6 pha (Hư cấu, chỉ để nhìn; không đổi luật), cùng
// móc nhạc và nền tiếng của trận. Dạng dữ liệu cho atmosphere.js (ctx.battle.atmo = { presets, tpc, buildSources, sourceWant,
// glowFrom }) — đọc atmosphere.js để biết từng trường (màu hex sRGB, el/az độ, az đo từ đông +x sang nam +z).
//
// Một ngày 9/4/1288 theo con nước (Hư cấu: giờ giấc từng pha là của game):
//   P1 sớm tinh mơ, sương sông lúc triều lên: nắng thấp phía đông, lạnh, sương xám lam dày gần mà núi xa vẫn hiện.
//   P2 sáng trong: nắng trắng, sương tan, nhìn thấu khúc sông 1,5 km tới núi đá vôi.
//   P3 gần trưa: nắng cao, sáng nhất.
//   P4 trưa, hơi nóng bốc: nắng đỉnh đầu, sương vàng mỏng (nước ròng, bùn phơi).
//   P5 xế chiều vàng: nắng thấp phía tây nam, ấm; cột khói giao chiến bắt đầu bốc trên bãi cọc.
//   P6 chiều muộn vàng đỏ: nắng sát chân trời phía tây; nhiều cột khói giao chiến trên khúc sông.
// KHÔNG có thuyền cháy (R-spec §6: không hỏa công ở trận này) — cột khói giao chiến chỉ có khói, không lửa, không tàn lửa.
// Lửa duy nhất là bếp nấu ở bản doanh Hưng Đạo vương (nhỏ, khói mảnh, suốt trận).
//
// Sương: núi đá vôi xa (world-b20 addSkyKit, MeshBasic fog:false, ~1,75 km) không chịu sương — nhuộm qua trường far; sương chỉ
// làm mờ mặt đất/nước. fogFar ≥ 900 m cho mọi pha trừ P1 (sương sớm cố ý dày: thấy rõ đầu hạm đội trong ~150 m, cột đá vôi
// hai bờ thành bóng mờ), camera far 2200 (BattleDef.camFar).
//
// ==== NỐI VÀO BattleDef (D2 gọi trong battles/b20.js) ====
//   import { wireAtmoB20 } from "../data/atmo-b20.js";
//   export const B20 = wireAtmoB20({ id: "B20", …, camFar: 2200 });   // đặt (đè) def.atmo, def.music, def.bed rồi trả lại def;
//                                                                      // muốn nhạc / nền tiếng khác thì gán lại sau khi gọi
// hoặc lấy từng phần: ATMO_B20 (def.atmo), musicB20 (def.music), bedB20 (def.bed).
// atmosphere.js đọc director.phase (0..5) cho bảng pha; nhạc: "boss" ở P6 và trong Tổng Phản Công, còn lại "battle".
// Mọi số là ĐỀ XUẤT BẢN THỬ.

import { ATMO_TPC } from "../battle/atmosphere.js";
import { HQ_PAD, TIDE_Y } from "./terrain-b20.js";
import { STAKE_FIELDS, zc } from "./river-b20.js";

export const ATMO_B20_PRESETS = [
  // P1 sớm tinh mơ, sương sông lúc triều lên (lạnh)
  { id: "P1", sun: 0xffd4ac, sunI: 1.7, el: 14, az: -6, sky: 0xd2dbe2, ground: 0x2f3432, hemiI: 1.18,
    fog: 0xbcc5c7, fogNear: 50, fogFar: 560, bg: 0xc3cccf, top: 0x587286, mid: 0xa9b4b9, hor: 0xe8dcc6,
    exposure: 1.02, far: 0xd4dde2, haze: 0xe9edf0, smoke: 1, cols: 0, embers: 0 },
  // P2 sáng trong
  { id: "P2", sun: 0xfff0d8, sunI: 2.45, el: 32, az: 16, sky: 0xf2eee2, ground: 0x40382a, hemiI: 1.2,
    fog: 0xd4ceb8, fogNear: 220, fogFar: 1150, bg: 0xdad3bb, top: 0x3c6a86, mid: 0xa8b4b0, hor: 0xeee2c4,
    exposure: 1.08, far: 0xf2f2ec, haze: 0xf8f3e8, smoke: 1, cols: 0, embers: 0 },
  // P3 gần trưa
  { id: "P3", sun: 0xfff4e6, sunI: 2.7, el: 52, az: 40, sky: 0xfff2e2, ground: 0x453a2a, hemiI: 1.22,
    fog: 0xdacdb0, fogNear: 240, fogFar: 1200, bg: 0xdfd2b2, top: 0x3a6680, mid: 0xb39c78, hor: 0xf2e0b8,
    exposure: 1.1, far: 0xfff6ea, haze: 0xfaf3e8, smoke: 1, cols: 0, embers: 0 },
  // P4 trưa, hơi nóng bốc (sương mỏng, bùn phơi). Sương ngả xám xanh (trước vàng be: mặt nước cùng màu bãi bùn — review B20)
  { id: "P4", sun: 0xfff0d0, sunI: 2.8, el: 72, az: 85, sky: 0xf2e8d2, ground: 0x4a3c2a, hemiI: 1.25,
    fog: 0xc6c8b4, fogNear: 170, fogFar: 980, bg: 0xcfcdb6, top: 0x4a6a7a, mid: 0xaaa58a, hor: 0xe8dfc4,
    exposure: 1.1, far: 0xf2ead8, haze: 0xeae6da, smoke: 1.2, cols: 0, embers: 0 },
  // P5 xế chiều vàng (cột khói giao chiến bắt đầu)
  { id: "P5", sun: 0xffd08a, sunI: 2.6, el: 36, az: 150, sky: 0xf6d6a6, ground: 0x3e2e20, hemiI: 1.12,
    fog: 0xc2ad90, fogNear: 180, fogFar: 1000, bg: 0xcdb48e, top: 0x34485a, mid: 0xa4825e, hor: 0xeac898,
    exposure: 1.06, far: 0xf6dcb6, haze: 0xe6d4b8, smoke: 1.5, cols: 0.6, embers: 0 },
  // P6 chiều muộn vàng đỏ, nhiều cột khói giao chiến trên khúc sông (không thuyền cháy)
  // (bớt bão hoà đỏ nâu, trời sáng hơn: tướng, boss, boong trước đây cùng một tông — review B20)
  { id: "P6", sun: 0xff9e5a, sunI: 2.7, el: 15, az: 182, sky: 0xe0b49c, ground: 0x362620, hemiI: 1.3,
    fog: 0xa8846c, fogNear: 150, fogFar: 920, bg: 0xb08a72, top: 0x262c44, mid: 0x7e5c4e, hor: 0xe8a070,
    exposure: 1.05, far: 0xf6bca0, haze: 0xc8aa96, smoke: 1.2, cols: 1, embers: 0 },
];

// ---- nguồn khói, lửa -------------------------------------------------------------------------------------------------
// cook: bếp nấu trong/ngoài rào bản doanh (lửa nhỏ, cột khói mảnh, mọi pha). battle: cột khói giao chiến trên khúc cọc (P5–P6),
// fs = 0 → chỉ khói (atmosphere.js bỏ lưỡi lửa khi fs ≤ 0). Chỗ đặt tính theo gò bản doanh (HQ_PAD, cổng hướng +z ra sông;
// lều ở nửa sau −z, nhà bạt giữa, trống/giá vũ khí phía cổng — scenery-b20) và theo mốc cọc (STAKE_FIELDS).
export const COOK_FIRES = [[-10, 2], [10, 1], [-8, 25]];                  // (dx, dz) quanh tâm bản doanh
// Cột khói giao chiến đặt trên hai bờ và cửa nhánh sông (|dz| ≥ 80: cách thân thuyền gần nhất — làn ±36, hộ vệ đậu tới ±55 — trên
// 25 m), màu bụi vàng nhạt: trước đây cột khói sẫm bốc giữa các thân thuyền mắc cạn trông như thuyền cháy (hỏa công — R-spec §6 cấm).
export const BATTLE_SMOKE = [                                             // (x, lệch z khỏi tâm dòng, cao chân cột trên mặt đất)
  ...STAKE_FIELDS.map((f, i) => [f.x + (i - 1) * 8, i === 1 ? 84 : -84, 1.2]),
  [640, 96, 1.2], [470, -92, 1.2], [828, -94, 1.2],
];
export const BATTLE_SMOKE_COL = [0.64, 0.59, 0.5];                        // bụi đất vàng xám nhạt (fx.column: r, g, b)
const COOK_WANT = 0.35;                                                   // cột khói bếp mảnh, nhạt

// world: world-b20 (groundY). Trả mảng nguồn đúng dạng atmosphere.js dùng (kind, id, x, z, y, h, fs, fw, boat, k, acc…).
export function buildSourcesB20(world) {
  const gy = world?.groundY || (() => 0), src = [];
  const add = (kind, id, x, z, y, h, fs, fw) => src.push({ kind, id, x, z, y, h, fs, fw, boat: null, k: 0,
    acc: Math.random(), facc: Math.random() * 0.2, eacc: Math.random() * 0.2 });
  COOK_FIRES.forEach(([dx, dz], i) => { const x = HQ_PAD.x + dx, z = HQ_PAD.z + dz; add("cook", "cook" + i, x, z, gy(x, z), 0.8, 1, 0.8); });
  // cột khói giao chiến: chân cột ở mặt bùn/nước lúc triều ròng (P5–P6 Con nước 0) + h (ngang boong thuyền mắc cạn)
  const lowY = TIDE_Y(0);
  BATTLE_SMOKE.forEach(([x, dz, h], i) => { const z = zc(x) + dz; add("battle", "fight" + i, x, z, Math.max(gy(x, z), lowY), h, 0, 0); src[src.length - 1].col = BATTLE_SMOKE_COL; });
  return src;
}
// Cường độ mong muốn 0..1 (atmosphere.js gọi với phase 0..5, cols của pha đang trộn).
export function sourceWantB20(s, phase, cols) {
  if (s.kind === "cook") return COOK_WANT;
  if (s.kind === "battle") return phase >= 4 ? cols * (s.id === "fight0" || s.id === "fight4" || phase >= 5 ? 1 : 0.6) : 0;
  return 0;
}

// glowFrom 99: không đèn lửa bám nguồn (bếp nhỏ ở xa giao tranh, cột khói không có lửa)
export const ATMO_B20 = { presets: ATMO_B20_PRESETS, tpc: ATMO_TPC, buildSources: buildSourcesB20, sourceWant: sourceWantB20, glowFrom: 99 };

// ---- nhạc, nền tiếng --------------------------------------------------------------------------------------------------
// Nhạc: bài trận boss ở P6 (kỳ hạm, Ô Mã Nhi) và trong Tổng Phản Công; còn lại bài trận.
export const musicB20 = (d, hk) => (hk?.tpc || (d?.phase ?? 0) >= 5 ? "boss" : "battle");
// Nền tiếng: dF = khoảng cách (m) từ tướng tới địch gần nhất đang sống (lính thật, sĩ quan, boss); battle.js cộng thêm số
// lính đang giáp lá cà quanh tướng. fire: tiếng lửa bếp khi đứng trong bản doanh (≤ 40 m), không có lửa nào khác.
export function bedB20(ctx) {
  const h = ctx.hero; let d2 = 140 * 140;
  for (const a of ctx.crowd?.agents || []) {
    if (a.side !== "dich" || a.state === "dead" || a.state === "swim" || a.role === "actor") continue;   // người bơi vào bờ đã rời trận
    const q = (a.x - h.x) ** 2 + (a.z - h.z) ** 2; if (q < d2) d2 = q;
  }
  for (const u of ctx.units || []) {
    if (u.side !== "dich" || !u.alive || u.dead || u.captured) continue;      // tướng đã bị bắt sống không còn là giao tranh
    const q = (u.x - h.x) ** 2 + (u.z - h.z) ** 2; if (q < d2) d2 = q;
  }
  const dHq = Math.hypot(h.x - HQ_PAD.x, h.z - HQ_PAD.z);
  return { dF: Math.sqrt(d2), fire: dHq < 40 ? 0.15 * (1 - dHq / 40) : 0 };
}

// Nối khí quyển + nhạc + nền tiếng vào BattleDef của B20 (đè cả ba trường).
export function wireAtmoB20(def) {
  def.atmo = ATMO_B20; def.music = musicB20; def.bed = bedB20;
  return def;
}
