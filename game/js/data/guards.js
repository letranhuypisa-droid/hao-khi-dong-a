// data/guards.js — cận vệ của người lính (chế độ Tự do, đợt 15c): số chỗ theo bậc, 5 lớp cận vệ (chỉ số = 50–75% chỉ số người lính lúc
// vào trận, mỗi lớp một chiêu riêng), 4 lệnh của vòng Mệnh Lệnh, luật tự tung chiêu, đội hình Theo ta, đỡ dậy khi gục. Thuần, chỉ import
// data/career.js (kiểm trong Node: tests/guards.test.mjs). Lõi trận ở battle/guard.js, lệnh / gục / đỡ dậy ở battle/director-td.js,
// chiêu mộ / sửa / cho về ở meta/career.js.
//
// Cận vệ và tên, chiêu của họ là Hư cấu. Mọi số ở đây là ĐỀ XUẤT BẢN THỬ — chỉnh sau khi chơi thử.

import { suggestName } from "./career.js";

// ---- số chỗ ---------------------------------------------------------------------------------------------------------------------
// Lính 0 · Tinh nhuệ 1 · Đội trưởng 2 · Phó tướng 3 · Tướng 4 (người dùng chốt: khởi đầu 0, tối đa 4). Cận vệ thay "lính theo" của đợt 14.
export const GUARD_SLOTS = [0, 1, 2, 3, 4];
export const GUARD_MAX = 4;
export const guardSlots = (rankIdx) => GUARD_SLOTS[Math.max(0, Math.min(GUARD_SLOTS.length - 1, rankIdx | 0))] ?? 0;
export const GUARD_NAME_MAX = 24;

// ---- lớp cận vệ -----------------------------------------------------------------------------------------------------------------
// pct: Công / Sinh lực / Giáp = tỉ lệ chỉ số người lính lúc vào trận (đã gồm bậc + quân nhu), luôn trong GUARD_PCT. Tốc chạy bằng người lính
// (để theo kịp), không theo tỉ lệ. Đánh thường: một nhát mỗi `every` giây, hệ số `mv` × Công (như MV của tướng), tầm `reach` (cận chiến) hoặc
// `range` (cung). swing: thời lượng động tác (nhát trúng ở 55%). weapon: kiểu binh khí của rig (battle/models.js). hat: mũ.
// skill: chiêu riêng — tên, hồi (cd, giây), mô tả trên thẻ chiêu mộ; số của chiêu ở các trường còn lại (battle/guard.js đọc).
export const GUARD_PCT = { min: 0.5, max: 0.75 };
export const GUARD_CLASSES = {
  khien: { id: "khien", name: "Khiên thủ", weapon: "dao", shield: true, hat: "mutuong", pct: { cong: 0.5, hp: 0.75, giap: 0.75 },
    reach: 2.2, swing: 0.8, every: 1.55, mv: 1.0,
    text: "Đao ngắn, khiên lớn. Đứng lâu nhất trong đội, kéo địch khỏi bạn.",
    skill: { id: "hoChu", name: "Hộ chủ", cd: 25, dur: 6, r: 8, taken: 0.5,
      text: "Chạy tới cạnh bạn, 6 s kéo lính địch trong 8 m quay sang đánh mình, nhận ít đi một nửa sát thương." } },
  giao: { id: "giao", name: "Giáo thủ", weapon: "giao", hat: "non", pct: { cong: 0.65, hp: 0.6, giap: 0.6 },
    reach: 3.0, swing: 0.75, every: 1.45, mv: 1.1,
    text: "Giáo dài, đâm xa, giữ địch ngoài tầm.",
    skill: { id: "damXuyen", name: "Đâm xuyên", cd: 18, len: 8, width: 2.2, dur: 0.45, mv: 2.0, knock: 6,
      text: "Lao thẳng 8 m, đâm trúng và hất ngã mọi địch trên đường." } },
  cung: { id: "cung", name: "Cung thủ", weapon: "cung", hat: "non", ranged: true, pct: { cong: 0.75, hp: 0.5, giap: 0.5 },
    range: 14, swing: 0.9, every: 1.8, mv: 0.75,
    text: "Bắn từ xa 14 m, yếu khi bị áp sát.",
    skill: { id: "muaTen", name: "Mưa tên", cd: 22, range: 22, r: 6, volleys: 3, gap: 0.6, mv: 0.8,
      text: "Ba loạt tên xuống vòng 6 m quanh mục tiêu cách tới 22 m." } },
  songdao: { id: "songdao", name: "Song đao", weapon: "songdao", hat: "non", pct: { cong: 0.75, hp: 0.55, giap: 0.5 },
    reach: 2.0, swing: 0.5, every: 0.9, mv: 0.65,
    text: "Hai đao nhanh, chém dồn dập, giáp mỏng.",
    skill: { id: "locDao", name: "Lốc đao", cd: 16, dur: 1.2, r: 3, ticks: 4, mv: 0.7,
      text: "Xoay 1,2 s, chém mọi địch trong 3 m quanh mình." } },
  daidao: { id: "daidao", name: "Đại đao", weapon: "dadao", hat: "mutuong", pct: { cong: 0.65, hp: 0.7, giap: 0.6 },
    reach: 2.8, swing: 1.0, every: 1.9, mv: 1.5,
    text: "Đại đao nặng, chậm mà chắc, bào Phá Thế sĩ quan.",
    skill: { id: "phaThe", name: "Phá thế", cd: 20, mv: 2.5, poiseMult: 4, r: 2.6, windup: 0.55,
      text: "Một nhát bổ nặng: trừ mạnh thanh Phá Thế của sĩ quan, hất ngã lính quanh đó." } },
};
export const GUARD_CLASS_ORDER = Object.keys(GUARD_CLASSES);
const clsOf = (id) => GUARD_CLASSES[id] || GUARD_CLASSES.khien;

// Chỉ số trận của một cận vệ: base = chỉ số người lính (meta/career.js soldierStats — cong, hp, giap; move = tốc chạy của người lính).
export function guardStats(base, clsId) {
  const p = clsOf(clsId).pct;
  return { cong: Math.round(base.cong * p.cong), hp: Math.round(base.hp * p.hp), giap: Math.round(base.giap * p.giap), move: base.move };
}

// ---- tạo một cận vệ -------------------------------------------------------------------------------------------------------------
// Lưu ở save.career.guards: { id, name, cls, battles, ko }. Tên trống → tên gợi ý theo seed (cùng kho họ / tên với người lính).
// bỏ ký tự HTML (<, >, &, nháy): tên còn hiện trong tin nhắn trận (innerHTML)
export function cleanName(name) { return String(name ?? "").replace(/[<>&"'`]/g, "").trim().replace(/\s+/g, " ").slice(0, GUARD_NAME_MAX).trim(); }
export function newGuard({ id, name = "", cls = "khien", seed = id * 7919 + 13 } = {}) {
  return { id, name: cleanName(name) || suggestName(seed), cls: GUARD_CLASSES[cls] ? cls : "khien", battles: 0, ko: 0 };
}

// ---- lệnh -----------------------------------------------------------------------------------------------------------------------
// Vòng Mệnh Lệnh của Tự do (phím 1–4 theo thứ tự này). Người nhận: cả đội hoặc từng cận vệ (Z / LB / chạm tên đổi người nhận).
export const GUARD_ORDERS = [
  { k: "xungtran", name: "Xung trận", icon: "tiencong", text: "Đánh địch trong 15 m quanh bạn, ưu tiên mục tiêu bạn đang khóa. Tự tung chiêu khi có dịp." },
  { k: "giucho", name: "Giữ chỗ", icon: "giuvung", text: "Đứng giữ chỗ đang đứng, chỉ đánh ai tới gần." },
  { k: "theota", name: "Theo ta", icon: "theota", text: "Bám quanh bạn, chỉ đánh địch trong 8 m quanh bạn." },
  { k: "tungchieu", name: "Tung chiêu", icon: "skill", text: "Ai có chiêu đã hồi thì tung ngay." },
];
// Tầm của từng lệnh (m): xungtran.r quanh người lính; theota.r quanh người lính (địch sát bạn), chase: không đuổi xa hơn chừng này khỏi chỗ
// đứng; giucho.r quanh chỗ giữ. leash: xa người lính quá chừng này thì bỏ đánh, chạy về; warp: kẹt xa quá chừng này (giây) thì dịch về sau lưng.
// Theo ta 8 m (bản đầu 6 m: đo bằng bot, địch tới sát người lính là đã bị người lính hạ trước khi cận vệ kịp ra tay — cận vệ gần như đứng xem).
export const GUARD_ORDER = { start: "theota", xungtran: { r: 15 }, theota: { r: 8, chase: 10 }, giucho: { r: 5 }, leash: 25, warp: { d: 45, sec: 3 } };

// Đội hình Theo ta: chỗ của cận vệ thứ i (0..3) quanh người lính đang quay mặt yaw (toạ độ lệch so với người lính; +z là hướng yaw 0).
const SLOT = [[-0.75, 2.6], [0.75, 2.6], [-1.6, 3.2], [1.6, 3.2]];       // [góc lệch khỏi sau lưng (rad), bán kính]
export function formationSlot(i, yaw) {
  const [da, r] = SLOT[i % SLOT.length], a = yaw + Math.PI + da;
  return { x: Math.sin(a) * r, z: Math.cos(a) * r };
}

// ---- tự tung chiêu ----------------------------------------------------------------------------------------------------------------
// s: { order, foesNearHero (lính địch trong 6 m quanh người lính), foesNear (trong 3,5 m quanh cận vệ), foesInLine (trên đường đâm 8 m tới
// mục tiêu), cluster (đông nhất trong vòng 6 m quanh một địch cách ≤ 22 m), officerD (m tới sĩ quan địch gần nhất), heroHp (0..1) }.
// Chỉ tự tung khi đang Xung trận; lệnh khác chỉ tung khi người chơi bấm Tung chiêu.
export function wantsSkill(clsId, s) {
  if (s.order !== "xungtran") return false;
  switch (clsId) {
    case "khien": return s.foesNearHero >= 3 || (s.heroHp < 0.5 && s.foesNearHero >= 1);
    case "giao": return s.foesInLine >= 2 || s.officerD <= 6;
    case "cung": return s.cluster >= 3 || s.officerD <= GUARD_CLASSES.cung.skill.range;
    case "songdao": return s.foesNear >= 3;
    case "daidao": return s.officerD <= 4 || s.foesNear >= 2;
    default: return false;
  }
}

// ---- bị đánh --------------------------------------------------------------------------------------------------------------------
// Lính địch chém cận vệ: Công × MV × hệ số giáp × melee (tướng đồng minh B15 là × 0,2 vì Sinh lực rất lớn); tên: Công × MV × 0,85 × arrow ×
// hệ số giáp. Cận vệ không đỡ, không né như người lính nên nhận nhẹ hơn người lính một chút. Bản đầu 0,5 / 0,45 và nhịp đánh nhanh hơn 20%:
// đo bằng bot ở bậc Tướng, lệnh Xung trận, 4 cận vệ tự giữ đồn / hộ tống xe, người lính không phải đánh, không ai gục lần nào — chỉnh lại.
export const GUARD_HIT = { melee: 0.8, arrow: 0.7 };

// ---- gục, đỡ dậy ------------------------------------------------------------------------------------------------------------------
// Hết Sinh lực thì cận vệ gục (không chết hẳn — hết trận ai cũng lành). Người lính đứng trong REVIVE.r m, không có địch trong REVIVE.clear m
// của người gục, đủ REVIVE.sec giây thì đỡ dậy với REVIVE.hpPct Sinh lực; mỗi người một lần mỗi trận. Rời đi thì tiến độ về 0.
export const REVIVE = { sec: 2.5, r: 2.6, clear: 4.5, hpPct: 0.4 };
export function reviveStep(st, dt, { near, blocked }) {
  if (st.used) return { ...st, done: false };
  if (!near) return { ...st, p: 0, done: false };
  if (blocked) return { ...st, done: false };
  const p = Math.min(1, st.p + dt / REVIVE.sec);
  return { ...st, p, done: p >= 1 };
}
