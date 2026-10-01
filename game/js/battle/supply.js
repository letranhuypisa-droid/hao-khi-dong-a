// battle/supply.js — "cửa ngõ" của cánh (đợt 12c): chỗ lính bù xuất quân và kế hoạch bù mỗi nhịp. THUẦN: không three, không rng; tests/supply.test.mjs.
//
// Luật (data/battle-b15.js FRONTS[id].door, sim/front.js supplyOpen): cửa ngõ là doanh trại của cánh. Còn của địch thì lính bù cho tuyến địch xuất hiện
// ở chỗ xuất quân SAU doanh trại rồi hành quân ra tuyến; về tay ta thì không bù nữa. Quân ta, lính thật quanh tướng (vùng chiến đấu) không đổi cách sinh.

import { SUPPLY } from "../data/tuning.js";

// F: FRONTS[id] (laneZ); base: { x, z, r } của cửa ngõ (world.bases[door]). Chỗ xuất quân: giữa làn, sau tâm doanh trại (phía quân địch) r + SUPPLY.behind m.
// lineX (tuỳ chọn): x hiện tại của tuyến — tuyến bị đẩy vượt cửa ngõ thì chỗ xuất quân lùi ra sau tuyến SUPPLY.lineGap m (không mọc sau lưng quân ta).
export function doorSpawnPoint(F, base, lineX = -Infinity) {
  return { x: Math.max(base.x + base.r + SUPPLY.behind, lineX + SUPPLY.lineGap), z: F.laneZ };
}

// Mức Số lính (r của TROOP_LEVELS): trần quân đi đường và nhịp xuất không dưới mức Vừa, mức cao hơn thì tăng theo r; số lính tối thiểu ở tuyến cánh có tướng.
const lvl = (visR) => Math.max(1, visR / SUPPLY.refR);
export const transitCap = (visR) => Math.round(SUPPLY.transitMax * lvl(visR));
export const tickCap = (visR) => Math.round(SUPPLY.perTick * lvl(visR));
export const lineWant = (want, onHeroFront) => (onHeroFront ? Math.max(want, SUPPLY.lineFloor) : want);

// Số lính bù ở nhịp này.
//   open        cửa ngõ còn của địch
//   blocked     tướng đứng sát chỗ xuất quân (< SUPPLY.minDist): chờ, không xuất quân ngay cạnh tướng
//   want        số lính cần ở tuyến;   arrived: số đã ở tuyến (không tính lính đang đi đường);   moving: số đang đi đường;   transitMax, perTick: trần
export function planRefill({ open, blocked, want, arrived, moving, transitMax, perTick }) {
  if (!open || blocked) return 0;
  return Math.max(0, Math.min(want - arrived, transitMax - moving, perTick));
}
