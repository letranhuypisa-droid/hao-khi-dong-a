// meta/arena.js — Võ trường (GDD 13.5, 12.9, 12.12). Hàm thuần, chạy được trong Node.
//
// Ba mục: Luyện tập (bậc địch tự chọn) · Thử thách thời gian (bố cục sinh theo seed) · Seed tuần
// (seed từ số tuần ISO, đổi lúc 0:00 thứ Hai giờ Việt Nam). Thêm thử thách B15 "Đua KO bến Hàm Tử"
// (180 s, chỉ tính KO trong vùng chiến đấu; Đồng 150 · Bạc 220 · Vàng 300).
// Tùy chọn "Đồng bộ cấp": cấp = R, hệ số binh khí = E(R), không Khắc, quân đoàn cấp 3; bảng thời
// gian xếp riêng theo tùy chọn này.

import { makeRng } from "../core/rng.js";
import { TIERS, S, g, E, EXP_NEXT, DIFFICULTY, HERO, heSoGiap } from "../data/tuning.js";
import { WEAPON_TIERS } from "../data/progression.js";
import { DRILL_COUNT } from "../data/tutorial-steps.js";

export const ARENA_MODES = {
  luyentap: { id: "luyentap", name: "Luyện tập", text: "Chọn bậc địch, đánh bao lâu tùy ý. Không thưởng." },
  duako:    { id: "duako", name: "Đua KO bến Hàm Tử", text: "180 s, chỉ tính KO trong vùng chiến đấu.", dur: 180, medals: { dong: 150, bac: 220, vang: 300 } },
  thoigian: { id: "thoigian", name: "Thử thách thời gian", text: "5 đợt địch sinh theo seed. Hạ hết càng nhanh càng tốt." },
  seedtuan: { id: "seedtuan", name: "Seed tuần", text: "Mọi người chơi cùng một bố cục trong tuần. Đổi lúc 0:00 thứ Hai giờ Việt Nam." },
  huanluyen: { id: "huanluyen", name: "Huấn luyện", text: `${DRILL_COUNT} bài tập từng thao tác: di chuyển, chuỗi đòn, né, đỡ, phản đòn, Đòn Quyết, Phá Trận, Tuyệt Kỹ.` },
};
export const MEDALS = [{ id: "vang", name: "Vàng", tt: 15 }, { id: "bac", name: "Bạc", tt: 10 }, { id: "dong", name: "Đồng", tt: 5 }];
const MEDAL_ORDER = ["dong", "bac", "vang"];

// Số tuần ISO theo giờ Việt Nam (UTC+7). Trả về "2026-W40".
export function isoWeekKey(date = new Date()) {
  const vn = new Date(date.getTime() + 7 * 3600 * 1000);          // giờ VN biểu diễn trong trường UTC
  const d = new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate()));
  const day = d.getUTCDay() || 7;                                   // thứ Hai = 1 … Chủ nhật = 7
  d.setUTCDate(d.getUTCDate() + 4 - day);                           // thứ Năm của tuần đó quyết định năm ISO
  const y0 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - y0) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
export function seedFromKey(key) {
  let h = 2166136261;
  for (const ch of key) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// Bố cục 5 đợt theo seed: số lính, tỉ lệ cung kỵ, sĩ quan, vị trí cổng ra; đợt 5 luôn có Tướng.
export function makeLayout(seed) {
  const rng = makeRng(seed);
  const gates = [0, 1, 2, 3].map((i) => i * Math.PI / 2 + rng.range(-0.3, 0.3));
  const waves = [];
  for (let w = 0; w < 5; w++) {
    const officers = [];
    const pool = w < 2 ? ["doitruong"] : w < 4 ? ["doitruong", "photuong"] : ["photuong"];
    const nOff = w === 0 ? 0 : 1 + (rng.next() < 0.35 && w >= 2 ? 1 : 0);
    for (let i = 0; i < nOff; i++) officers.push(rng.pick(pool));
    if (w === 4) officers.push("tuong");
    waves.push({
      soldiers: 14 + w * 5 + rng.int(0, 6), archers: 0.2 + rng.next() * 0.3, elite: 0.05 + w * 0.04,
      officers, gate: rng.int(0, 3), spread: rng.range(0.6, 1.4),
    });
  }
  return { seed, gates, waves };
}

// Ước lượng thời gian hạ hết (s) để đặt mốc Bạc/Vàng — ĐỀ XUẤT BẢN THỬ.
// Sĩ quan: HP ÷ DPS đơn mục tiêu (1,84 MV/s × Công × hệ số giáp); lính: 1,1 KO/s; +6 s mỗi đợt để chạy.
export function estimateTime(layout, stats, R) {
  let t = 0;
  const dps = (giap) => stats.cong * 1.84 * heSoGiap(giap, stats.level);
  for (const w of layout.waves) {
    t += 6 + w.soldiers / 1.1;
    for (const o of w.officers) t += (TIERS[o].hp * S(R)) / dps(TIERS[o].giap * g(R));
  }
  return Math.round(t);
}
// Bot bất tử (không cần né) về đích ở ~0,72 × ước lượng, nên Vàng đặt 0,75 × để người chơi phải đánh gọn.
export function timeMedals(est) { return { dong: Infinity, bac: Math.round(est * 1.05), vang: Math.round(est * 0.75) }; }

export function medalFor(mode, value, thresholds) {
  if (mode === "duako") {
    const m = ARENA_MODES.duako.medals;
    return value >= m.vang ? "vang" : value >= m.bac ? "bac" : value >= m.dong ? "dong" : null;
  }
  if (value == null) return null;                // chưa hạ hết
  return value <= thresholds.vang ? "vang" : value <= thresholds.bac ? "bac" : "dong";
}

// Chỉ số khi bật Đồng bộ cấp.
export function syncSave(save, R) {
  const s = JSON.parse(JSON.stringify(save));
  s.hero.level = Math.max(1, R);
  s.weapon = { tier: 1, forge: 0, khac: [null, null] };
  s.legion = { giao: 3, guard: 3 };
  return s;
}
export const syncWeaponMult = (R) => E(R);

// Phần thưởng (13.5, đề xuất trong GDD):
//   lần đầu đạt mỗi mức ở một nút: 5 / 10 / 15 Tinh thiết;
//   lần đầu Vàng ở Seed tuần của 4 tuần khác nhau: 1 binh khí bậc 4 Danh;
//   chơi lại: EXP, Tiền = công thức trận × 0,6 × (thời lượng ÷ 10 phút), trần ×0,6, sàn ×0,1.
export function arenaRewards(save, res) {
  const out = { exp: 0, tien: 0, tt: 0, drops: [], newMedals: [] };
  if (res.mode === "luyentap" || res.aborted) return out;
  const diff = DIFFICULTY.find((d) => d.id === res.difficulty) || DIFFICULTY[1];
  const node = res.mode === "seedtuan" ? `tuan:${res.week}` : res.mode;
  const had = save.arena?.medals?.[node] || null;
  if (res.medal) {
    for (const m of MEDAL_ORDER.slice(0, MEDAL_ORDER.indexOf(res.medal) + 1)) {
      if (had && MEDAL_ORDER.indexOf(had) >= MEDAL_ORDER.indexOf(m)) continue;
      out.newMedals.push(m); out.tt += MEDALS.find((x) => x.id === m).tt;
    }
  }
  const rank = { vang: [1.5, 90], bac: [1.25, 77], dong: [1.0, 60] }[res.medal] || [0.8, 40];
  const k = Math.max(0.1, Math.min(0.6, 0.6 * res.durSec / 600));
  out.exp = Math.round(2 * EXP_NEXT(res.R) * rank[0] * diff.reward * k);
  out.tien = Math.round(60 * rank[1] * (1 + 0.05 * (res.R - 1)) * diff.reward * k);
  if (res.mode === "seedtuan" && res.medal === "vang") {
    const weeks = new Set(save.arena?.goldWeeks || []); weeks.add(res.week);
    if (weeks.size >= 4 && !save.firsts.danh && save.weapon.tier < 4) out.drops.push({ kind: "weapon", tier: 4, why: "Vàng Seed tuần ở 4 tuần khác nhau" });
  }
  return out;
}

export function applyArena(save, res, rw) {
  save.arena = save.arena || { medals: {}, best: {}, goldWeeks: [] };
  const A = save.arena;
  const node = res.mode === "seedtuan" ? `tuan:${res.week}` : res.mode;
  if (rw.newMedals.length) A.medals[node] = rw.newMedals[rw.newMedals.length - 1];
  if (res.mode === "seedtuan" && res.medal === "vang" && !A.goldWeeks.includes(res.week)) A.goldWeeks.push(res.week);
  for (const d of rw.drops) if (d.kind === "weapon" && d.tier > save.weapon.tier) { save.weapon.tier = d.tier; save.firsts.danh = true; }
  save.wallet.tt += rw.tt; save.wallet.tien += rw.tien;
  // bảng điểm cục bộ, tách theo Đồng bộ cấp
  if (res.mode !== "luyentap" && !res.aborted && (res.mode === "duako" || res.cleared)) {
    const key = `${res.mode === "seedtuan" ? "tuan:" + res.week : res.mode === "thoigian" ? "seed:" + res.seed : "duako"}|${res.sync ? "dongbo" : "tudo"}`;
    const list = A.best[key] || [];
    list.push({ v: res.mode === "duako" ? res.ko : Math.round(res.clearSec * 10) / 10, at: res.at, lv: res.level, R: res.R });
    list.sort((a, b) => (res.mode === "duako" ? b.v - a.v : a.v - b.v));
    A.best[key] = list.slice(0, 5);
  }
  return rw;
}

export const tierNames = () => Object.fromEntries(Object.entries(TIERS).map(([k, v]) => [k, v.name]));
export { WEAPON_TIERS, HERO };
