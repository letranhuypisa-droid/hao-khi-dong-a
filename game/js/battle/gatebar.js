// battle/gatebar.js — độ bền cổng Hàm Tử quan trên HUD (đợt 15a): chọn cổng cho ô mục tiêu, chữ số, phần trăm, mục tiêu P3 kèm phần trăm.
// THUẦN: không three, không DOM, không rng; tests/gatebar.test.mjs. Director (director.js gateTarget, goalText) dựng danh sách cổng, hud.js vẽ.
//
// Vì sao: người chơi phàn nàn "yêu cầu phải đánh phá cửa để mở, nhưng không hiển thị HP của cửa nên người chơi sẽ bối rối". Cổng có độ bền
// 11000 × S(R) (data/battle-b15.js, sim/front.js b.gate / b.gate0), đòn tướng trừ dần (hero.js → director.damageGate), mà HUD không hiện gì;
// trước P3 cổng còn khóa (đánh không trừ) và chỉ có một câu nhắc mỗi 20 nhát.

export const GATE_PHASE = 2;                                       // chỉ số pha (0-based) mở khóa cổng: P3 Hàm Tử quan (director.damageGate)
export const GATE_WHY = "Khóa: chiếm Doanh trại trên bãi (A2) trước";

const n = (v) => Math.round(v).toLocaleString("vi-VN");              // y như n() của main.js (hub): 7.340, 11.000

// Phần trăm độ bền còn lại 0..100, làm tròn LÊN khi còn > 0: cổng còn 1 độ bền hiện 1% chứ không 0%. Trừ 1e-9 để số chia hết
// (7040 / 11000 = 64%) không nhảy lên 65 vì sai số dấu phẩy động.
export function gatePct(hp, max) {
  if (!(max > 0) || !(hp > 0)) return 0;
  return Math.min(100, Math.max(1, Math.ceil((hp * 100) / max - 1e-9)));
}

// "7.340 / 11.000". Độ bền lẻ (đòn = Công × MV / 3) làm tròn lên như số máu tướng (hud.js Math.ceil(hero.hp)).
export const gateText = (hp, max) => `${n(Math.ceil(Math.max(0, hp)))} / ${n(max)}`;

// Cổng cho ô mục tiêu. gates [{ id, name, x, z, hp, max, open }]; hero { x, z }; phase: chỉ số pha của director; now: giờ trận;
// lastHit { id, t } | null: lần cuối đòn trúng cổng (ghi cả khi còn khóa). Cổng vừa bị đánh (0 ≤ now − t ≤ showHit, chưa mở) ưu tiên;
// không thì cổng chưa mở gần tướng nhất trong R m. Cổng đã mở không bao giờ chọn. lastHit ở tương lai (tải lại điểm lưu lùi giờ trận) bỏ qua.
// → null | { id, name, hp, max, pct, locked, why, text, hit } — hit: chọn vì vừa bị đánh (hud.js xếp nó trên sĩ quan gần nhất).
export function gateTarget({ gates = [], hero = null, phase = 0, now = 0, lastHit = null, R = 25, showHit = 3 } = {}) {
  let g = null, hit = false;
  const age = lastHit ? now - lastHit.t : -1;
  if (lastHit && age >= 0 && age <= showHit) { g = gates.find((x) => x.id === lastHit.id && !x.open) || null; hit = !!g; }
  if (!g && hero) {
    let bd = Infinity;
    for (const x of gates) {
      if (x.open) continue;
      const d = Math.hypot(x.x - hero.x, x.z - hero.z);
      if (d <= R && d < bd) { bd = d; g = x; }
    }
  }
  if (!g) return null;
  const locked = phase < GATE_PHASE;
  return { id: g.id, name: g.name, hp: g.hp, max: g.max, pct: gatePct(g.hp, g.max), locked, why: locked ? GATE_WHY : null, text: gateText(g.hp, g.max), hit };
}

// Mục tiêu P3 trên thẻ nhiệm vụ kèm phần trăm còn lại của từng cổng chưa mở, chèn sau mã cổng:
// "Phá Cổng bắc (A3) hoặc Cổng nam (B3)" → "Phá Cổng bắc (A3) 64% hoặc Cổng nam (B3) 100%". Cổng đã mở thì thôi phần trăm.
export function gateGoal(goal, gates) {
  let s = goal || "";
  for (const g of gates || []) if (!g.open) s = s.split(`(${g.id})`).join(`(${g.id}) ${gatePct(g.hp, g.max)}%`);
  return s;
}

// Dạng ngắn cho thẻ nhiệm vụ một dòng của HUD gọn (thẻ đang gập): "Phá A3 64% hoặc B3 100%". Dạng đủ cùng tên pha dài ~470 px mà thẻ gọn chỉ
// ~300–370 px, nên bị cắt ngay sau phần trăm A3; dạng ngắn vừa ở 584–900 px (trừ dải ~770–830 px, thẻ chỉ ~300 px). Chạm mở thẻ thì hud.js
// về dạng đủ. Không còn cổng chưa mở → null (dùng dạng đủ).
export function gateGoalShort(gates) {
  const left = (gates || []).filter((g) => !g.open);
  return left.length ? `Phá ${left.map((g) => `${g.id} ${gatePct(g.hp, g.max)}%`).join(" hoặc ")}` : null;
}
