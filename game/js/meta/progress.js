// meta/progress.js — tiến triển ngoài trận (GDD mục 12). Hàm thuần trên object save,
// không đụng DOM, không đụng storage (save.js lo phần đó), nên kiểm được trong Node.

import { g, E, EXP_NEXT, LEVEL_CAP, HERO, DIFFICULTY, RANKS, MODES } from "../data/tuning.js";
import { NODES, TREE_RULES, WEAPON_TIERS, FORGE, KHAC, LEGION, CAMP, R_LADDER } from "../data/progression.js";
import { HEROES, SKILLS, kiLucBarsAt } from "../data/heroes.js";

export const SAVE_VERSION = 1;

export function newSave() {
  return {
    v: SAVE_VERSION,
    hero: { level: 1, exp: 0, nodes: [] },
    weapon: { tier: 1, forge: 0, khac: [null, null] },
    wallet: { tien: 0, tt: 0, qc: 0 },
    legion: { giao: 1, guard: 1 },
    camp: 1,
    ladder: { unlocked: [1], best: {} },          // R → hạng tốt nhất
    battles: { B20: { best: null, cleared: false } },   // trận ngoài thang R (đợt 9: B20 Bạch Đằng — hạng tốt nhất, đã qua)
    firsts: { tinh: false, bao: false, danh: false, rankS: {} },
    settings: { troops: "vua", difficulty: "quansi", renderScale: 1, shadows: true, volume: 0.7, touch: "auto", hints: true },   // hints: gợi ý lần đầu giữa trận (đợt 11)
    stats: { battles: 0, wins: 0, tpc: 0, ko: 0, bestTime: null },
    hints: {},                                    // gợi ý lần đầu đã xem { id: true } (battle/hints.js ghi thẳng vào đây; nút "Hiện lại gợi ý" xóa)
    log: [],
  };
}

// ---- Cấp và EXP (12.1) ---------------------------------------------------------------------
export function addExp(save, exp) {
  const h = save.hero; const before = h.level;
  h.exp += Math.round(exp);
  while (h.level < LEVEL_CAP && h.exp >= EXP_NEXT(h.level)) { h.exp -= EXP_NEXT(h.level); h.level++; }
  if (h.level >= LEVEL_CAP) h.exp = Math.min(h.exp, EXP_NEXT(LEVEL_CAP) - 1);
  return h.level - before;
}

// ---- Điểm kỹ năng (12.2) --------------------------------------------------------------------
export const bonusPoints = (save) => Object.keys(save.firsts.rankS).length;
export const totalPoints = (save) => save.hero.level - 1 + bonusPoints(save);
export const nodeCost = (n) => (n.apex ? TREE_RULES.apexCost : n.t);
export const spentPoints = (save, branch) =>
  save.hero.nodes.map((id) => NODES.find((n) => n.id === id)).filter((n) => !branch || n.b === branch)
    .reduce((s, n) => s + nodeCost(n), 0);
export const freePoints = (save) => totalPoints(save) - spentPoints(save);

export function canBuy(save, id) {
  const n = NODES.find((x) => x.id === id);
  if (!n) return { ok: false, why: "Không có nút này" };
  if (save.hero.nodes.includes(id)) return { ok: false, why: "Đã học" };
  const owned = save.hero.nodes.map((x) => NODES.find((m) => m.id === x));
  if (n.apex) {
    if (save.hero.level < TREE_RULES.apexMinLevel) return { ok: false, why: `Cần cấp ${TREE_RULES.apexMinLevel}` };
    if (spentPoints(save, n.b) < TREE_RULES.apexMinBranch) return { ok: false, why: `Cần tiêu ${TREE_RULES.apexMinBranch} điểm trong nhánh` };
    if (owned.filter((m) => m.apex).length >= TREE_RULES.maxApex) return { ok: false, why: "R1 chỉ mở 1 nút đỉnh" };
  } else if (n.t > 1 && !owned.some((m) => m.b === n.b && m.t === n.t - 1)) {
    return { ok: false, why: `Cần 1 nút tầng ${n.t - 1} cùng nhánh` };
  }
  if (freePoints(save) < nodeCost(n)) return { ok: false, why: `Cần ${nodeCost(n)} điểm` };
  return { ok: true };
}
export function buyNode(save, id) {
  const c = canBuy(save, id); if (c.ok) save.hero.nodes.push(id); return c;
}
export function respec(save) { save.hero.nodes = []; }   // miễn phí, không giới hạn, tại Trướng soái

// ---- Binh khí (12.7) ---------------------------------------------------------------------
export const tierInfo = (tier) => WEAPON_TIERS[tier - 1];
export const weaponMult = (w) =>
  Math.min(FORGE.capMult, 1 + tierInfo(w.tier).pct + FORGE.atkPerLevel * w.forge);

export function canTierUp(save) {
  const w = save.weapon, next = WEAPON_TIERS[w.tier];
  if (!next || !next.up) return { ok: false, why: next ? `${next.name}: chỉ rơi, không rèn ra` : "Bậc cao nhất" };
  if (save.camp < 2) return { ok: false, why: "Cần Lò rèn (Doanh trại cấp 2)" };
  if (save.wallet.tien < next.up.tien || save.wallet.tt < next.up.tt)
    return { ok: false, why: `Cần ${next.up.tien} Tiền + ${next.up.tt} Tinh thiết` };
  return { ok: true, cost: next.up };
}
export function tierUp(save) {
  const c = canTierUp(save); if (!c.ok) return c;
  save.wallet.tien -= c.cost.tien; save.wallet.tt -= c.cost.tt; save.weapon.tier++;
  return c;
}
export function canForge(save) {
  const w = save.weapon;
  if (save.camp < 2) return { ok: false, why: "Cần Lò rèn (Doanh trại cấp 2)" };
  if (w.forge >= FORGE.maxLevel) return { ok: false, why: "Đã rèn +5" };
  const cost = FORGE.cost(w.forge + 1);
  if (save.wallet.tien < cost.tien || save.wallet.tt < cost.tt) return { ok: false, why: `Cần ${cost.tien} Tiền + ${cost.tt} Tinh thiết`, cost };
  return { ok: true, cost };
}
export function forge(save) {
  const c = canForge(save); if (!c.ok) return c;
  save.wallet.tien -= c.cost.tien; save.wallet.tt -= c.cost.tt; save.weapon.forge++;  // không có tỉ lệ thất bại
  return c;
}
export function setKhac(save, slot, id) {
  const w = save.weapon, slots = tierInfo(w.tier).slots;
  if (save.camp < 2) return { ok: false, why: "Cần Lò rèn" };
  if (slot >= slots) return { ok: false, why: "Binh khí chưa có ô Khắc" };
  if (!KHAC.some((k) => k.id === id)) return { ok: false, why: "Dòng Khắc lạ" };
  if (w.khac.includes(id)) return { ok: false, why: "Mỗi dòng chỉ khắc một lần" };
  const cost = w.khac[slot] ? FORGE.rerollKhac(w.tier) : 0;       // ô trống khắc miễn phí; tẩy thì tốn
  if (save.wallet.tien < cost) return { ok: false, why: `Tẩy Khắc cần ${cost} Tiền` };
  save.wallet.tien -= cost; w.khac[slot] = id;
  return { ok: true, cost };
}
export function smelt(save, n = 1) {
  const cost = FORGE.smelt.tien * n;
  if (save.camp < 2) return { ok: false, why: "Cần Lò rèn" };
  if (save.wallet.tien < cost) return { ok: false, why: `Cần ${cost} Tiền` };
  save.wallet.tien -= cost; save.wallet.tt += FORGE.smelt.tt * n;
  return { ok: true, cost };
}

// ---- Quân đoàn, Doanh trại (12.8, 12.9) ------------------------------------------------------
export function upLegion(save, what) {
  if (save.camp < 2) return { ok: false, why: "Cần Luyện binh trường (Doanh trại cấp 2)" };
  const lv = save.legion[what], max = what === "giao" ? LEGION.unitMax : LEGION.guardMax;
  if (lv >= max) return { ok: false, why: "Cấp tối đa" };
  const cost = what === "giao" ? LEGION.unitCost(lv + 1) : LEGION.guardCost(lv + 1);
  if (save.wallet.qc < cost) return { ok: false, why: `Cần ${cost} Quân công` };
  save.wallet.qc -= cost; save.legion[what]++;
  return { ok: true, cost };
}
export function upCamp(save) {
  if (save.camp >= CAMP.maxLevel) return { ok: false, why: "Cấp tối đa" };
  const cost = CAMP.cost(save.camp + 1);
  if (save.wallet.tien < cost) return { ok: false, why: `Cần ${cost} Tiền` };
  save.wallet.tien -= cost; save.camp++;
  return { ok: true, cost };
}

// ---- Tổng hợp chỉ số mang vào trận ----------------------------------------------------------
export function heroMods(save) {
  const m = {
    atkPct: 0, poisePct: 0, comboEvery: 10, parryWin: 0, breakKi: 0, ultPct: 0, phaTranLen: HERO.phaTran.len,
    afterimage: false, ultRefund: 0, bodyguards: 0, aura: 0, cmdCdMult: 1, reinfAmt: 0, allyHpPct: 0,
    skPer5: 0, holdThu: 0, reinfCharges: 0, tpcExt: 0, hkPct: 0, revealOfficers: false, capSpeed: 0,
    m25: 0.05, hkDecay: 1, hkStart: 0, ksWindow: 0, ksEffect: 0,
    armorPen: 0, crit: 0, koHeal: 0, cStun: 0, atkSpeed: 0, koSk: 0, kiPct: 0,
  };
  for (const id of save.hero.nodes) {
    const n = NODES.find((x) => x.id === id); if (!n || n.inert) continue;
    for (const k in n.fx) {
      if (k === "comboEvery" || k === "phaTranLen" || k === "m25") m[k] = n.fx[k];
      else if (k === "cmdCdMult") m[k] *= n.fx[k];
      else if (k === "hkDecay") m[k] *= n.fx[k];
      else if (typeof n.fx[k] === "boolean") m[k] = n.fx[k];
      else m[k] += n.fx[k];
    }
  }
  for (const id of save.weapon.khac) {
    const k = KHAC.find((x) => x.id === id); if (!k) continue;
    for (const key in k.fx) m[key] += k.fx[key];
  }
  return m;
}

// Chỉ số tướng trong một trận cấp R: cấp nâng tối thiểu R − 2, binh khí nâng tối thiểu E(R) − 0,10
// (Quân giới cấp phát, 12.7). heroId: tướng ra trận (mặc định H35 — nhánh cũ, giữ nguyên từng số). Tướng khác (H31 ở B20):
// chỉ số cấp 1 theo HEROES[id] (deriveStats), cấp = preset.level (B20: 25; không có preset thì HEROES[id].vsLevel — H31: 25,
// dùng khi ?debug&hero=H31 ở B15 — rồi mới tới max(cấp, R − 2) như H35),
// binh khí E(R) (bản VS đặt sẵn, không theo Lò rèn), không nhận cây kỹ năng / khắc của H35 (cây đó là của Toản), cộng nội tại
// (Quốc Công Tiết Chế: ksWindow / ksEffect), số vạch Khí Lực theo cấp (kiLucBarsAt: 2 → 3 ở cấp 12 → 4 ở cấp 25).
export function heroStats(save, R, heroId = "H35", preset = null) {
  if (heroId !== "H35") return otherHeroStats(save, R, heroId, preset);
  const L = Math.max(save.hero.level, R - 2);
  const mods = heroMods(save);
  const wm = Math.max(weaponMult(save.weapon), E(R) - 0.10);
  return {
    level: L, floorLifted: L > save.hero.level, weaponMult: wm, weaponFloor: wm > weaponMult(save.weapon),
    cong: Math.round(HERO.cong1 * g(L) * wm * (1 + mods.atkPct)),
    hp: Math.round(HERO.hp1 * g(L)), giap: Math.round(HERO.giap1 * g(L)),
    crit: Math.min(0.30, 0.05 + mods.crit), mods,
    legionMult: 1 + 0.08 * (save.legion.giao - 1), legionSimC: 0.03 * (save.legion.giao - 1),
    guardLevel: save.legion.guard,
  };
}

function otherHeroStats(save, R, heroId, preset) {
  const D = HEROES[heroId];
  if (!D) throw new Error(`Không có tướng ${heroId}`);
  const L = preset?.level ?? D.vsLevel ?? Math.max(save.hero.level, R - 2);
  const mods = heroMods({ hero: { nodes: [] }, weapon: { khac: [] } });
  const pas = SKILLS[D.skills?.passive];
  if (pas) for (const k of ["ksWindow", "ksEffect"]) if (pas[k]) mods[k] += pas[k];
  const wm = preset?.weaponMult ?? E(R);
  return {
    heroId, level: L, floorLifted: false, weaponMult: wm, weaponFloor: false,
    cong: Math.round(D.cong1 * g(L) * wm * (1 + mods.atkPct)),
    hp: Math.round(D.hp1 * g(L)), giap: Math.round(D.giap1 * g(L)),
    crit: Math.min(0.30, 0.05 + mods.crit), mods,
    kiBars: kiLucBarsAt(L, D.kiLucSteps),
    legionMult: 1 + 0.08 * (save.legion.giao - 1), legionSimC: 0.03 * (save.legion.giao - 1),
    guardLevel: save.legion.guard,
  };
}

// ---- Xếp hạng và phần thưởng (mục 2.3, 12.1, 12.10) ------------------------------------------
// Diem = 35M + 15T + 20Q + 20C + 10K, mỗi thành phần 0..1:
//   M nhiệm vụ (chính + phụ), T thời gian so với par, Q quân ta còn, C Cứ Điểm, K Kế Sách thành công
//   (5.6: "Kế Sách thất bại chỉ mất phần thưởng chưa nhận và điểm K khi xếp hạng").
// par (đợt 9): par riêng của trận (B20: tổng par 6 pha), thiếu thì par của chế độ như B15. kLost: mất trọn thành phần K
// (B20: chỉ 50% hạm đội mắc cạn vì Kích hoạt bãi cọc hoặc Con nước hỏng — riverResult(st).kRank === false, systems §7).
export function scoreBattle({ missions, timeSec, qRatio, baseRatio, keSach = 0, mode = "nhanh", par = MODES[mode].par, kLost = false }) {
  const T = timeSec <= par ? 1 : Math.max(0, 1 - (timeSec - par) / par);
  const K = kLost ? 0 : Math.min(1, keSach);
  const parts = { M: missions, T, Q: Math.min(1, qRatio), C: baseRatio, K };
  const diem = Math.round(35 * parts.M + 15 * parts.T + 20 * parts.Q + 20 * parts.C + 10 * parts.K);
  const rank = RANKS.find((r) => diem >= r.min);
  return { diem, rank: rank.id, rankMult: rank.mult, parts };
}

export function computeRewards(save, res) {
  const diff = DIFFICULTY.find((d) => d.id === res.difficulty) || DIFFICULTY[1];
  const R = res.R, quick = MODES[res.mode || "nhanh"].reward;
  const out = { exp: 0, tien: 0, tt: 0, qc: 0, drops: [], skillPoint: false, unlockR: null };
  if (!res.won) {
    // Thua vẫn giữ một phần EXP (ĐỀ XUẤT BẢN THỬ: 25%), không Tiền, không rơi đồ.
    out.exp = Math.round(2 * EXP_NEXT(R) * 0.8 * diff.reward * quick * 0.25);
    return out;
  }
  out.exp = Math.round(2 * EXP_NEXT(R) * res.rankMult * diff.reward * quick);
  out.tien = Math.round((60 * res.diem * (1 + 0.05 * (R - 1)) * diff.reward) * quick) + (res.chestCoins || 0);
  out.tt = Math.round((2 * (res.bossDefeated ? 1 : 0)) * diff.reward) + (res.extraTT || 0);
  out.qc = Math.round((2 * res.hkRaw + 150 * (res.keSachOk || 0) + 5 * res.avgSK) * diff.qc);   // 12.10
  const aOrBetter = res.rank === "S" || res.rank === "A";
  const f = save.firsts;
  if (aOrBetter && R >= 5 && R <= 14 && !f.tinh && save.weapon.tier < 2) out.drops.push({ kind: "weapon", tier: 2, why: "Lần đầu hạng A ở trận R 5–14" });
  if (aOrBetter && R >= 15 && !f.bao && save.weapon.tier < 3) out.drops.push({ kind: "weapon", tier: 3, why: "Lần đầu hạng A ở trận R ≥ 15" });
  const hard = DIFFICULTY.findIndex((d) => d.id === res.difficulty) >= 2;
  if (hard && res.bossDefeated && !f.danh && save.weapon.tier < 4) out.drops.push({ kind: "weapon", tier: 4, why: "Lần đầu đánh lui Toa Đô ở Tướng quân trở lên" });
  if (res.rank === "S" && !f.rankS[R]) out.skillPoint = true;
  const idx = R_LADDER.indexOf(R);
  if (idx >= 0 && idx + 1 < R_LADDER.length && !save.ladder.unlocked.includes(R_LADDER[idx + 1])) out.unlockR = R_LADDER[idx + 1];
  return out;
}

export function applyRewards(save, res, rw) {
  const lv = addExp(save, rw.exp);
  save.wallet.tien += rw.tien; save.wallet.tt += rw.tt; save.wallet.qc += rw.qc;
  for (const d of rw.drops) {
    if (d.kind !== "weapon") continue;
    if (d.tier > save.weapon.tier) save.weapon.tier = d.tier;       // giữ rèn và Khắc (lưu theo lớp)
    if (d.tier === 2) save.firsts.tinh = true;
    if (d.tier === 3) save.firsts.bao = true;
    if (d.tier === 4) save.firsts.danh = true;
  }
  if (rw.skillPoint) save.firsts.rankS[res.R] = true;
  if (rw.unlockR) save.ladder.unlocked.push(rw.unlockR);
  if (res.won) {
    const prev = save.ladder.best[res.R];
    const order = ["S", "A", "B", "C"];
    if (!prev || order.indexOf(res.rank) < order.indexOf(prev)) save.ladder.best[res.R] = res.rank;
    save.stats.wins++;
    if (!save.stats.bestTime || res.timeSec < save.stats.bestTime) save.stats.bestTime = Math.round(res.timeSec);
  }
  save.stats.battles++; save.stats.tpc += res.tpcCount || 0; save.stats.ko += res.ko || 0;
  save.log.unshift({ at: res.at || 0, R: res.R, won: res.won, rank: res.rank || "-", diem: res.diem || 0, exp: rw.exp, tien: rw.tien });
  save.log = save.log.slice(0, 12);
  return { levelsGained: lv };
}

// ---- Trận ngoài thang R (đợt 9: B20 Bạch Đằng, tướng dựng sẵn) -----------------------------------------
// Chỉ Tiền / Tinh thiết / Quân công (cùng công thức computeRewards ở cấp trận cố định) và thống kê: không EXP (tướng dựng
// sẵn, EXP là của Trần Quốc Toản), không rơi binh khí, không điểm kỹ năng, không mở cấp R. Hạng tốt nhất, thời gian thắng
// nhanh nhất, số lần đánh ghi ở save.battles[id] (không đụng save.ladder / stats.bestTime của B15).
export function computeFixedRewards(save, res) {
  const rw = computeRewards(save, res);
  return Object.assign(rw, { exp: 0, drops: [], skillPoint: false, unlockR: null });
}
const RANK_ORDER = ["S", "A", "B", "C"];
export function applyFixedRewards(save, battleId, res, rw) {
  save.wallet.tien += rw.tien; save.wallet.tt += rw.tt; save.wallet.qc += rw.qc;
  const sb = ((save.battles ||= {})[battleId] ||= { best: null, cleared: false });
  sb.plays = (sb.plays || 0) + 1;
  const newBest = !!(res.won && (!sb.best || RANK_ORDER.indexOf(res.rank) < RANK_ORDER.indexOf(sb.best)));
  if (res.won) {
    if (newBest) sb.best = res.rank;
    if (!sb.bestTime || res.timeSec < sb.bestTime) sb.bestTime = Math.round(res.timeSec);
    sb.cleared = true; save.stats.wins++;
  }
  save.stats.battles++; save.stats.tpc += res.tpcCount || 0; save.stats.ko += res.ko || 0;
  save.log.unshift({ at: res.at || 0, R: res.R, battle: battleId, won: res.won, rank: res.rank || "-", diem: res.diem || 0, exp: 0, tien: rw.tien });
  save.log = save.log.slice(0, 12);
  return { levelsGained: 0, newBest };
}

// Nâng cấp bản lưu cũ (mỗi phiên bản thêm một bước, không xoá trường cũ — 15.10).
export function migrate(raw) {
  const base = newSave();
  if (!raw || typeof raw !== "object") return base;
  const out = { ...base, ...raw };
  for (const k of ["hero", "weapon", "wallet", "legion", "ladder", "firsts", "settings", "stats"]) out[k] = { ...base[k], ...(raw[k] || {}) };
  out.firsts.rankS = { ...(raw.firsts?.rankS || {}) };
  out.battles = { ...base.battles, ...(raw.battles || {}) };      // bản lưu trước đợt 9 chưa có (B20)
  out.hints = { ...(raw.hints || {}) };                           // bản lưu trước đợt 11 chưa có; sao chép để không dùng chung đối tượng với bản gốc
  out.v = SAVE_VERSION;
  return out;
}
