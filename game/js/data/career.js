// data/career.js — chế độ Tự do (đợt 14): thang bậc người lính, danh tiếng mỗi trận, tiền thưởng, trang bị, tên / quê gợi ý.
// Thuần, không import (kiểm trong Node: tests/career.test.mjs). Mọi số là ĐỀ XUẤT BẢN THỬ — chỉnh sau khi chơi thử.
//
// Người lính và chuyện đời lính là Hư cấu. Chữ "Sát Thát" thích lên cánh tay quân Trần năm 1285 là Chính sử (Toàn thư); quê là
// tên lộ / phủ thời Trần chỉ để kể chuyện.

// ---- Thang bậc -----------------------------------------------------------------------------------------------------------
// rep: danh tiếng tích lũy để lên bậc. level: cấp của người lính ở bậc đó (chỉ số × g(level)) và cũng là cấp trận R của giao tranh
// (địch mạnh theo R như B15).
export const RANKS = [
  { id: "linh", name: "Lính", rep: 0, level: 1 },
  { id: "tinhnhue", name: "Tinh nhuệ", rep: 300, level: 4 },
  { id: "doitruong", name: "Đội trưởng", rep: 1200, level: 8 },
  { id: "photuong", name: "Phó tướng", rep: 3500, level: 13 },
  { id: "tuong", name: "Tướng", rep: 8000, level: 19 },
];
export function rankOf(rep) {
  let i = 0;
  for (let k = 0; k < RANKS.length; k++) if (rep >= RANKS[k].rep) i = k;
  return i;
}
// Bậc kế: { i, name, need (còn thiếu), pct (phần đã đi trong bậc hiện tại, 0..1) } — bậc cuối thì null.
export function nextRank(rep) {
  const i = rankOf(rep); if (i >= RANKS.length - 1) return null;
  const a = RANKS[i].rep, b = RANKS[i + 1].rep;
  return { i: i + 1, name: RANKS[i + 1].name, need: b - rep, pct: (rep - a) / (b - a) };
}

// Mở theo bậc (chỉ số bậc tối thiểu). c34: C3–C4 · dq: Đòn Quyết · poise: thanh Phá Thế (đòn nhẹ trừ thanh thay vì làm khựng) ·
// squad: vòng Mệnh Lệnh ra lệnh cho cận vệ (đợt 15c: mở cùng cận vệ đầu tiên; số cận vệ theo bậc ở data/guards.js GUARD_SLOTS — thay "lính
// theo" 8 / 16 người và Gọi tiếp viện của đợt 14) · skill1: Phá Trận · skill2: Hô quân · keSach: Kế Sách nhỏ mỗi trận · ult: Tuyệt Kỹ ·
// haoKhi: Hào Khí, Tổng Phản Công.
export const UNLOCK = { c34: 1, dq: 1, poise: 2, squad: 1, skill1: 2, skill2: 3, keSach: 3, ult: 4, haoKhi: 4 };
export const can = (rankIdx, f) => rankIdx >= (UNLOCK[f] ?? 99);
// mô tả ngắn cho trang binh nghiệp (mở gì ở bậc nào)
export const RANK_PERKS = [
  "Đòn N, C1–C2, Né, Đỡ. Đòn nhẹ của địch cũng ngắt nhát đang vung. Đội trưởng giao nhiệm vụ.",
  "Thêm C3–C4 và Đòn Quyết. Cận vệ thứ nhất: đặt tên, chọn lớp, ra lệnh Xung trận · Giữ chỗ · Theo ta · Tung chiêu. Chọn 1 trong 2 nhiệm vụ. Binh khí tốt hơn.",
  "Thanh Phá Thế: đòn nhẹ trừ vào thanh thay vì làm khựng. Cận vệ thứ hai. Có Phá Trận.",
  "Kỹ năng Hô quân, cận vệ thứ ba và 1 Kế Sách nhỏ mỗi trận (Phục binh). Chọn 1 trong 3 nhiệm vụ.",
  "Tuyệt Kỹ Sát Thát, Hào Khí và Tổng Phản Công, cận vệ thứ tư, trận lớn hơn.",
];
export const PICKS = [1, 2, 2, 3, 3];             // số nhiệm vụ được chọn trên bảng

// ---- Danh tiếng mỗi trận -------------------------------------------------------------------------------------------------
export const KILL_REP = { thuong: 1, tinhnhue: 3, doitruong: 15, photuong: 40, tuong: 100 };
export const MISSION_MULT = [1, 1.5, 2.2, 3, 3.6];  // phần nhiệm vụ × hệ số bậc (nhiệm vụ bậc cao lớn hơn)
export const SIDE_REP = 30;                        // mỗi mục phụ
export const GUARD_REP = 30;                       // cận vệ còn đứng cuối trận: GUARD_REP × hệ số bậc × tỉ lệ còn đứng (đợt 15c; đợt 14 tính lính theo)
export const LOSE = { keep: 0.25, penalty: 0.03 };  // thua: giữ 25% danh tiếng trận, trừ 3% tích lũy (không dưới ngưỡng bậc)
const TIER_NAME = { thuong: "lính", tinhnhue: "tinh nhuệ", doitruong: "đội trưởng", photuong: "phó tướng", tuong: "tướng" };

// r: { won, base (danh tiếng gốc của nhiệm vụ), rankIdx, kills: { bậc địch: số }, side (số mục phụ đạt), guards?: { total, alive } }
// → { total, parts: [{ id, label, rep }] } (thua: các phần đã nhân 25%, không có phần nhiệm vụ).
export function battleRep({ won, base = 0, rankIdx = 0, kills = {}, side = 0, guards = null }) {
  const parts = [];
  if (won) parts.push({ id: "mission", label: "Hoàn thành nhiệm vụ", rep: Math.round(base * MISSION_MULT[rankIdx]) });
  for (const k of Object.keys(KILL_REP)) {
    const n = kills[k] || 0; if (n <= 0) continue;
    parts.push({ id: "kill_" + k, label: `Hạ ${Math.round(n * 10) / 10} ${TIER_NAME[k]}`, rep: Math.round(n * KILL_REP[k]) });
  }
  if (side > 0) parts.push({ id: "side", label: `${side} mục phụ`, rep: side * SIDE_REP });
  if (guards?.total > 0 && rankIdx >= UNLOCK.squad) parts.push({ id: "guards", label: `Cận vệ đứng vững ${Math.round(guards.alive)}/${guards.total}`, rep: Math.round(GUARD_REP * MISSION_MULT[rankIdx] * Math.max(0, Math.min(1, guards.alive / guards.total))) });
  if (!won && parts.length) {                       // thua: tổng = 25% (làm tròn một lần), từng phần chia theo tỉ lệ, phần lớn nhất nhận phần lẻ
    const total = Math.round(parts.reduce((s, p) => s + p.rep, 0) * LOSE.keep);
    for (const p of parts) p.rep = Math.round(p.rep * LOSE.keep);
    const big = parts.reduce((a, p) => (p.rep > a.rep ? p : a), parts[0]);
    big.rep += total - parts.reduce((s, p) => s + p.rep, 0);
  }
  return { total: parts.reduce((s, p) => s + p.rep, 0), parts };
}
// Cộng danh tiếng trận vào lính (career.rep). Thua: trừ 3% danh tiếng tích lũy, nhưng không bao giờ dưới ngưỡng bậc đang giữ.
// → { before, after, gained, penalty, rankBefore, rankAfter, promoted }
export function applyRep(career, b) {
  const before = career.rep || 0, rankBefore = rankOf(before);
  const penalty = b.won ? 0 : Math.round(before * LOSE.penalty);
  career.rep = Math.max(RANKS[rankBefore].rep, before + (b.total || 0) - penalty);
  const rankAfter = rankOf(career.rep);
  return { before, after: career.rep, gained: career.rep - before, penalty, rankBefore, rankAfter, promoted: rankAfter > rankBefore };
}

// ---- Tiền thưởng, trang bị ------------------------------------------------------------------------------------------------
// Tiền thưởng riêng của người lính (không chung ví với Trần Quốc Toản): 60% danh tiếng trận thắng.
export const payOf = (b) => (b.won ? Math.round((b.total || 0) * 0.6) : 0);
// Binh khí / giáp: 4 bậc, mỗi bậc +8% Công (binh khí) hoặc +8% Sinh lực và Giáp (giáp). Giá bậc lv: 100 × lv².
export const GEAR = { max: 4, weaponPct: 0.08, armorPct: 0.08, names: { weapon: "Binh khí", armor: "Giáp" } };
export const gearCost = (lv) => 100 * lv * lv;

// ---- Quê, tên gợi ý ---------------------------------------------------------------------------------------------------------
export const QUE = ["Thiên Trường", "Long Hưng", "Kiến Xương", "Hồng lộ", "Khoái lộ", "Quốc Oai", "Bắc Giang", "Hải Đông", "Trường Yên", "Thanh Hóa", "Nghệ An"];
const HO = ["Nguyễn", "Trần", "Lê", "Phạm", "Đỗ", "Vũ", "Đinh", "Bùi", "Ngô", "Đặng", "Hà", "Lương"];
const DEM = ["Văn", "Đức", "Hữu", "Bá", "Công", "Quang", "Đình", "Xuân"];
const TEN = ["Kiên", "Dũng", "Mạnh", "Hùng", "Tráng", "Thắng", "Lực", "Hổ", "Khải", "Bình", "An", "Cường", "Sơn", "Trung", "Nghĩa", "Tín"];
// Tên gợi ý xác định theo seed (số nguyên): họ + tên đệm + tên.
export function suggestName(seed) {
  let s = (seed >>> 0) || 1;
  const nx = (n) => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s % n; };
  return `${HO[nx(HO.length)]} ${DEM[nx(DEM.length)]} ${TEN[nx(TEN.length)]}`;
}
