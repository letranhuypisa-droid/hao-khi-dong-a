// meta/career.js — người lính của chế độ Tự do (đợt 14): tạo lính, chỉ số mang vào trận, định nghĩa tướng cho lõi (battle/hero.js),
// ghi kết quả trận (danh tiếng, tiền thưởng, sổ trận), mua trang bị, giải ngũ. Lưu ở save.career (một lính một lúc) và
// save.veterans (lính đã giải ngũ) — không đụng ví, cấp, cây kỹ năng của Trần Quốc Toản. Thuần (kiểm trong Node: tests/career.test.mjs).

import { g, HERO } from "../data/tuning.js";
import { heroMods } from "./progress.js";
import { RANKS, rankOf, can, battleRep, applyRep, payOf, GEAR, gearCost, QUE, suggestName, SQUAD } from "../data/career.js";

// Binh khí chọn lúc tạo lính: hai bộ đòn có sẵn (Hư cấu). WC01 dùng bộ đòn Đại kiếm, gọi là Đại đao cho hợp người lính.
export const WEAPONS = {
  WC03: { id: "WC03", name: "Song đao", text: "Nhanh, chém liên hoàn; đánh trúng liền mạch thì tăng tốc đánh.", rig: "linh03", moves: "LINH03", atkSpeed: 1.05 },
  WC01: { id: "WC01", name: "Đại đao", text: "Nặng, giữ C để tụ lực; siêu giáp khi vung, phá giáp.", rig: "linh01", moves: "LINH01", atkSpeed: 0.95 },
};
// Chỉ số gốc cấp 1 của người lính (ĐỀ XUẤT BẢN THỬ): yếu hơn Trần Quốc Toản cấp 1 (Công 140, Sinh lực 1.600, Giáp 50).
export const SOLDIER = { cong1: 105, hp1: 1050, giap1: 35, move: 6.4, rankWeapon: 0.06 };

export function newCareer({ name = "", que = "", weapon = "WC03", seed = Date.now() } = {}) {
  const nm = String(name || "").trim().slice(0, 32) || suggestName(seed);
  return {
    v: 1, name: nm, que: QUE.includes(que) ? que : QUE[(seed >>> 0) % QUE.length], weapon: WEAPONS[weapon] ? weapon : "WC03",
    seed: (seed >>> 0) % 1e9, rep: 0, tien: 0, gear: { weapon: 0, armor: 0 }, battles: 0, wins: 0, ko: 0, officers: 0,
    log: [], created: true, introSeen: false,
  };
}

// Chỉ số mang vào trận (hình như progress.heroStats): cấp theo bậc, binh khí theo bậc + Lò của lính, giáp theo trang bị.
export function soldierStats(c) {
  const i = rankOf(c.rep), L = RANKS[i].level;
  const mods = heroMods({ hero: { nodes: [] }, weapon: { khac: [] } });
  const wm = 1 + SOLDIER.rankWeapon * i + GEAR.weaponPct * (c.gear?.weapon || 0);
  const am = 1 + GEAR.armorPct * (c.gear?.armor || 0);
  return {
    heroId: "LINH", level: L, rank: i, floorLifted: false, weaponMult: wm, weaponFloor: false,
    cong: Math.round(SOLDIER.cong1 * g(L) * wm), hp: Math.round(SOLDIER.hp1 * g(L) * am), giap: Math.round(SOLDIER.giap1 * g(L) * am),
    crit: 0.05, mods, kiBars: 2, legionMult: 1 + 0.04 * i, legionSimC: 0, guardLevel: 1,
  };
}

// Định nghĩa "tướng" cho lõi (battle/hero.js đọc như HEROES[id]); bậc nằm ở rank (battle/soldier.js khóa đòn, kỹ năng theo bậc).
export function soldierDef(c) {
  const i = rankOf(c.rep), W = WEAPONS[c.weapon] || WEAPONS.WC03;
  const initials = c.name.split(/\s+/).slice(-2).map((w) => w[0]).join("").toUpperCase();
  return {
    id: "LINH", name: c.name, title: RANKS[i].name, rank: i, soldier: true,
    cls: W.id, weaponClass: W.id, rig: W.rig, anim: W.id, moves: W.moves, portrait: initials || "L",
    cong1: SOLDIER.cong1, hp1: SOLDIER.hp1, giap1: SOLDIER.giap1, move: SOLDIER.move, atkSpeed: W.atkSpeed, rangeMul: 1,
    aura: 12, auraAtk: 0.04, skMult: 1, cmdCd: 1, bodyguards: 0,
    kiLucBars: 2, kiLucSteps: [[1, 2]], kiLucPerBar: HERO.kiLucPerBar, kiLucRegen: HERO.kiLucRegen,
    revive: { ...HERO.revive },
    skills: { sk1: "phaTran", sk2: "hoQuan", ult: "satThat" }, flag: null,
    weaponName: W.name, weaponLabel: "Hư cấu",
  };
}

// Ghi một trận vào lính. res: { won, type, base, kills: { bậc: số }, side (số mục phụ đạt), squad?: { total, alive }, timeSec, ko?, why? }
// → { rep: battleRep, applied: applyRep, pay, promoted, rankBefore, rankAfter }
export function recordBattle(save, res) {
  const c = save.career; if (!c) return null;
  const i = rankOf(c.rep);
  const rep = battleRep({ won: res.won, base: res.base, rankIdx: i, kills: res.kills || {}, side: res.side || 0, squad: res.squad || null });
  const applied = applyRep(c, { won: res.won, total: rep.total });
  const pay = payOf({ won: res.won, total: rep.total });
  c.tien += pay; c.battles++; if (res.won) c.wins++;
  const k = res.kills || {};
  c.ko += Math.round((k.thuong || 0) + (k.tinhnhue || 0)); c.officers += Math.round((k.doitruong || 0) + (k.photuong || 0) + (k.tuong || 0));
  c.log.unshift({ at: res.at || 0, type: res.type, won: !!res.won, rep: applied.gained, pay, rank: RANKS[applied.rankAfter].name, timeSec: Math.round(res.timeSec || 0) });
  c.log = c.log.slice(0, 10);
  return { rep, applied, pay, promoted: applied.promoted, rankBefore: applied.rankBefore, rankAfter: applied.rankAfter };
}

// Mua bậc trang bị kế tiếp (kind: "weapon" | "armor") bằng tiền thưởng của lính.
export function buyGear(c, kind) {
  const lv = c.gear[kind] ?? 0;
  if (lv >= GEAR.max) return { ok: false, why: `${GEAR.names[kind]} đã tốt nhất` };
  const cost = gearCost(lv + 1);
  if (c.tien < cost) return { ok: false, why: `Cần ${cost} tiền thưởng` };
  c.tien -= cost; c.gear[kind] = lv + 1;
  return { ok: true, cost };
}

// Giải ngũ: bỏ lính hiện tại, ghi một dòng vào danh sách lính đã giải ngũ (tối đa 12).
export function retire(save) {
  const c = save.career; if (!c) return;
  (save.veterans ||= []).unshift({ name: c.name, que: c.que, rank: RANKS[rankOf(c.rep)].name, rep: c.rep, battles: c.battles, wins: c.wins, at: Date.now() });
  save.veterans = save.veterans.slice(0, 12);
  save.career = null;
}

// Tiện cho hub / trận: bậc hiện tại, mở gì, lính theo.
export const careerRank = (c) => rankOf(c?.rep || 0);
export const careerCan = (c, f) => can(careerRank(c), f);
export const squadSize = (c) => SQUAD[careerRank(c)];
