// battle/garrison.js — quân đồn trú (đợt 12b): đếm trong / ngoài vòng Cứ Điểm, chữ nhắc ở thẻ nhiệm vụ, dấu trên bản đồ nhỏ, con gần nhất để chỉ
// đường, dây xích cứng và hướng rút về đồn. THUẦN: không three, không DOM, không rng; tests/garrison.test.mjs. Số ở tuning.js GARRISON.
//
// Vì sao (đo đợt 12): thẻ "Hạ quân đồn trú: còn N" lấy N = max(G còn, lính đang đứng) — G là KHO (A1 110, A2 160) mà ngoài bãi chỉ có ≤ 30 người —
// và chỉ hiện khi tướng đứng TRONG vòng (ẩn ~48% trận đánh A1). Quân tản ra ngoài vòng vì: sĩ quan trấn thủ chết thì cả đám trong 22 m bỏ chạy khỏi
// tướng (units.js → crowd.rout), lính cận chiến đuổi tướng ra khỏi vòng, cung kỵ giữ tầm; mấy con cuối phần lớn là cung kỵ / lực sĩ, hay đứng ngoài
// màn hình. Bản đồ nhỏ vẽ mọi lính bằng chấm 2 × 2 px nên không thấy chúng ở đâu.

import { GARRISON } from "../data/tuning.js";

// base { x, z, r } (world.bases[id]); soldiers [{ x, z }] — lính đồn trú còn đánh được của ĐÚNG Cứ Điểm đó.
// Lính đứng trong r + margin vẫn tính "trong đồn" (quân đồn trú sinh ra trong r + 3 m, director.js, nên đứng sát hàng rào chưa phải đã bỏ đồn).
// → { inside, outside, total, farthest (m vượt mép vòng), nearest { x, z, over, soldier } | null (lính ngoài vòng gần mép nhất) }
export function classifyGarrison(base, soldiers, { margin = GARRISON.ringPad } = {}) {
  let inside = 0, outside = 0, farthest = 0, nearest = null;
  for (const s of soldiers) {
    const over = Math.hypot(s.x - base.x, s.z - base.z) - base.r;
    if (over <= margin) { inside++; continue; }
    outside++;
    if (over > farthest) farthest = over;
    if (!nearest || over < nearest.over) nearest = { x: s.x, z: s.z, over, soldier: s };
  }
  return { inside, outside, total: inside + outside, farthest, nearest };
}

// Chữ ở thẻ nhiệm vụ. N = max(ceil(G), số lính đang đứng) như trước đợt 12; có lính ngoài vòng thì ghi thêm "b ngoài đồn". KHÔNG ghi "a trong đồn": N gồm cả kho G chưa ra
// bãi (A1 140 mà ngoài bãi ≤ 30) nên N không bao giờ bằng a + b và đọc như phép cộng sai (reviewer đo: 47/56 dòng như vậy).
// Còn sĩ quan trấn thủ thì chữ cũ "Hạ <tên> trấn thủ" (số quân hiện sau khi hắn ngã).
export function garrisonHint({ G = 0, keeperAlive = false, keeperName = "sĩ quan", inside = 0, outside = 0 } = {}) {
  if (keeperAlive) return `Hạ ${keeperName} trấn thủ`;
  const n = Math.max(Math.ceil(G), inside + outside);
  if (!outside) return `Hạ quân đồn trú: còn ${n}`;
  return `Hạ quân đồn trú: còn ${n} · ${outside} ngoài đồn`;
}

// Những con cuối của một Cứ Điểm: còn ≤ pointLast người đang đứng VÀ kho G không còn ai ra thêm (floor(G) ≤ số đang đứng). Mỗi con hạ làm G giảm một nên G luôn bằng số
// đang đứng tới con cuối cùng — đòi G < 1 (bản đầu) thì nhãn chỉ đường không bao giờ hiện trong luồng thường.
export const isLast = (G, alive, pointLast = GARRISON.pointLast) => alive > 0 && alive <= pointLast && Math.floor(G) <= alive;

// Lính đồn trú gần tướng nhất (để mũi tên mép màn hình chỉ tới); null nếu hết. Hòa thì lấy người đứng trước trong mảng (ổn định).
export function nearestBlocker(soldiers, hero) {
  let best = null, bd = Infinity;
  for (const s of soldiers) {
    const d2 = (s.x - hero.x) ** 2 + (s.z - hero.z) ** 2;
    if (d2 < bd) { bd = d2; best = s; }
  }
  return best;
}

// Dấu trên bản đồ nhỏ cho lính đồn trú còn đánh được. groups: [{ soldiers, G }] — mỗi Cứ Điểm một nhóm. → [{ x, z, last }]; last (nhấp nháy) = isLast của nhóm đó.
export function garrisonMarks(groups, { pointLast = GARRISON.pointLast } = {}) {
  const out = [];
  for (const g of groups) { const last = isLast(g.G, g.soldiers.length, pointLast); for (const s of g.soldiers) out.push({ x: s.x, z: s.z, last }); }
  return out;
}

// Dây xích cứng: kéo (x, z) về trong vòng tròn tâm neo, bán kính anchor.hard. Chỉ neo có `hard` (quân đồn trú B15) và không phải toán vây tướng
// đồng minh (anchor.target) mới bị cắt; neo của B20 (đoàn thuyền) không có `hard` nên không đổi.
export function leashClamp(x, z, anchor) {
  if (!anchor || !anchor.hard || anchor.target) return [x, z];
  const dx = x - anchor.x, dz = z - anchor.z, d = Math.hypot(dx, dz);
  if (d <= anchor.hard) return [x, z];
  const k = anchor.hard / d;
  return [anchor.x + dx * k, anchor.z + dz * k];
}

// Hướng bỏ chạy (vectơ đơn vị). Mặc định chạy ngược khỏi tướng. Lính đồn trú có dây cứng thì RÚT VỀ ĐỒN (tâm neo) thay vì chạy ra xa: trước
// đợt 12 sĩ quan trấn thủ ngã là cả đám trong 22 m chạy khỏi tướng, kéo ra 29–46 m. Đã vào trong vòng thì đứng (0, 0).
export function fleeDir(soldier, hero) {
  const an = soldier.anchor;
  if (an && an.hard && !an.target) {
    const ox = an.x - soldier.x, oz = an.z - soldier.z, od = Math.hypot(ox, oz);
    return od > (an.r ?? 3) ? [ox / od, oz / od] : [0, 0];
  }
  const hx = hero.x - soldier.x, hz = hero.z - soldier.z, dH = Math.hypot(hx, hz) || 1e-6;
  return [-hx / dH, -hz / dH];
}
