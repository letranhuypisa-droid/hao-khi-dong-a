// tests/career.test.mjs — chế độ Tự do (đợt 14a): thang bậc người lính, danh tiếng mỗi trận, thăng bậc / không bao giờ rớt bậc,
// tiền thưởng và trang bị, chỉ số người lính, tạo lính. Thuần (data/career.js, meta/career.js). Chạy trong Node:
//   node game/tests/career.test.mjs
import assert from "node:assert/strict";
import { RANKS, rankOf, nextRank, can, UNLOCK, PICKS, KILL_REP, MISSION_MULT, SIDE_REP, LOSE, battleRep, applyRep, GEAR, gearCost, payOf, QUE, suggestName } from "../js/data/career.js";
import { newCareer, soldierStats, soldierDef, recordBattle, buyGear, retire, WEAPONS } from "../js/meta/career.js";
import { heroStats } from "../js/meta/progress.js";
import { guardSlots } from "../js/data/guards.js";
import { newSave } from "../js/meta/progress.js";

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log("  ok  " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + (e.stack || e.message)); }
}

console.log("Thang bậc");
t("5 bậc đúng tên và ngưỡng đã chốt: Lính 0 · Tinh nhuệ 300 · Đội trưởng 1.200 · Phó tướng 3.500 · Tướng 8.000", () => {
  assert.deepEqual(RANKS.map((r) => [r.name, r.rep]), [["Lính", 0], ["Tinh nhuệ", 300], ["Đội trưởng", 1200], ["Phó tướng", 3500], ["Tướng", 8000]]);
});
t("rankOf theo ngưỡng", () => {
  for (const [rep, i] of [[0, 0], [299, 0], [300, 1], [1199, 1], [1200, 2], [3499, 2], [3500, 3], [7999, 3], [8000, 4], [99999, 4]]) assert.equal(rankOf(rep), i, `rep ${rep}`);
});
t("nextRank: còn thiếu bao nhiêu, phần trăm trong bậc; bậc cuối thì null", () => {
  const n = nextRank(750);
  assert.equal(n.i, 2); assert.equal(n.need, 450); assert.ok(Math.abs(n.pct - 0.5) < 1e-9);
  assert.equal(nextRank(8000), null);
});
t("mở theo bậc: Lính chỉ đòn cơ bản; Tinh nhuệ C3–C4 + Đòn Quyết + lệnh cận vệ (đợt 15c); Đội trưởng Phá Thế, Phá Trận; Phó tướng kỹ năng 2 + Kế Sách nhỏ; Tướng Tuyệt Kỹ + Hào Khí", () => {
  assert.equal(can(0, "c34"), false); assert.equal(can(0, "dq"), false); assert.equal(can(0, "skill1"), false);
  assert.equal(can(1, "c34"), true); assert.equal(can(1, "dq"), true); assert.equal(can(0, "squad"), false); assert.equal(can(1, "squad"), true);
  for (const f of ["poise", "skill1"]) { assert.equal(can(2, f), true, f); assert.equal(can(1, f), false, f); }
  for (const f of ["skill2", "keSach"]) { assert.equal(can(3, f), true, f); assert.equal(can(2, f), false, f); }
  for (const f of ["ult", "haoKhi"]) { assert.equal(can(4, f), true, f); assert.equal(can(3, f), false, f); }
  for (const k in UNLOCK) assert.ok(UNLOCK[k] >= 0 && UNLOCK[k] < RANKS.length, k);
});
t("số nhiệm vụ được chọn 1 · 2 · 2 · 3 · 3; cận vệ 0 · 1 · 2 · 3 · 4 (đợt 15c thay lính theo 0 · 0 · 8 · 8 · 16)", () => {
  assert.deepEqual(PICKS, [1, 2, 2, 3, 3]); assert.deepEqual(RANKS.map((_, i) => guardSlots(i)), [0, 1, 2, 3, 4]);
});

console.log("Danh tiếng mỗi trận");
const kills = { thuong: 20, tinhnhue: 2, doitruong: 1 };
t("thắng: nhiệm vụ × hệ số bậc + hạ địch theo bậc địch + 30 mỗi mục phụ", () => {
  const r = battleRep({ won: true, base: 70, rankIdx: 1, kills, side: 1 });
  const want = Math.round(70 * MISSION_MULT[1]) + 20 * KILL_REP.thuong + 2 * KILL_REP.tinhnhue + KILL_REP.doitruong + SIDE_REP;
  assert.equal(r.total, want);
  assert.equal(r.parts.reduce((s, p) => s + p.rep, 0), r.total);
  assert.ok(r.parts.every((p) => p.label && Number.isFinite(p.rep)));
});
t("hạ địch: lính 1, tinh nhuệ 3, đội trưởng 15, phó tướng 40, tướng 100", () => assert.deepEqual(KILL_REP, { thuong: 1, tinhnhue: 3, doitruong: 15, photuong: 40, tuong: 100 }));
t("từ Tinh nhuệ: cận vệ còn đứng cuối trận thì có thêm (tỉ lệ còn đứng)", () => {
  const a = battleRep({ won: true, base: 70, rankIdx: 2, kills: {}, side: 0, guards: { total: 2, alive: 2 } });
  const b = battleRep({ won: true, base: 70, rankIdx: 2, kills: {}, side: 0, guards: { total: 2, alive: 1 } });
  const c = battleRep({ won: true, base: 70, rankIdx: 2, kills: {}, side: 0 });
  assert.ok(a.total > b.total && b.total > c.total);
});
t("thua (gục / hết giờ): không có phần nhiệm vụ, chỉ giữ 25% phần còn lại", () => {
  const w = battleRep({ won: false, base: 70, rankIdx: 1, kills, side: 1 });
  const raw = 20 * KILL_REP.thuong + 2 * KILL_REP.tinhnhue + KILL_REP.doitruong + SIDE_REP;
  assert.equal(w.total, Math.round(raw * LOSE.keep));
  assert.ok(!w.parts.some((p) => p.id === "mission"));
});
t("applyRep: thắng cộng, vượt ngưỡng thì thăng bậc", () => {
  const c = { rep: 280 };
  const r = applyRep(c, { won: true, total: 50 });
  assert.equal(c.rep, 330); assert.equal(r.rankBefore, 0); assert.equal(r.rankAfter, 1); assert.equal(r.promoted, true);
});
t("applyRep: thua thì trừ 3% danh tiếng tích lũy nhưng không bao giờ dưới ngưỡng bậc đang giữ (không rớt bậc)", () => {
  const c = { rep: 1000 };
  const r = applyRep(c, { won: false, total: 10 });
  assert.equal(r.penalty, Math.round(1000 * LOSE.penalty)); assert.equal(c.rep, 1000 + 10 - r.penalty);
  const d = { rep: 1210 };
  applyRep(d, { won: false, total: 0 });
  assert.equal(d.rep, 1200); assert.equal(rankOf(d.rep), 2, "vẫn Đội trưởng");
  for (let i = 0; i < 50; i++) applyRep(d, { won: false, total: 0 });
  assert.equal(rankOf(d.rep), 2);
});
t("nhịp lên bậc (trận trung bình: thắng 3/4 trận, ~1 mục phụ, hạ địch theo bậc): Tinh nhuệ ~3–6 trận, lên Tướng ~35–60 trận", () => {
  const avgKills = [{ thuong: 22 }, { thuong: 24, tinhnhue: 4, doitruong: 1 }, { thuong: 26, tinhnhue: 6, doitruong: 2 }, { thuong: 28, tinhnhue: 8, doitruong: 2, photuong: 1 }, { thuong: 30, tinhnhue: 10, doitruong: 3, photuong: 1, tuong: 0.3 }];
  const c = { rep: 0 }; let n = 0, toTn = 0;
  while (rankOf(c.rep) < 4 && n < 500) {
    const i = rankOf(c.rep); n++;
    const won = n % 4 !== 0;
    applyRep(c, battleRep({ won, base: 72, rankIdx: i, kills: avgKills[i], side: 1, guards: guardSlots(i) ? { total: guardSlots(i), alive: guardSlots(i) * 0.7 } : null }));
    if (!toTn && rankOf(c.rep) >= 1) toTn = n;
  }
  assert.ok(toTn >= 3 && toTn <= 6, `lên Tinh nhuệ sau ${toTn} trận`);
  assert.ok(n >= 35 && n <= 60, `lên Tướng sau ${n} trận`);
});

console.log("Tiền thưởng, trang bị");
t("tiền thưởng = 60% danh tiếng trận thắng, thua không có", () => {
  assert.equal(payOf({ won: true, total: 100 }), 60); assert.equal(payOf({ won: false, total: 40 }), 0);
});
t("giá nâng trang bị 100 · 400 · 900 · 1.600 (tối đa 4 bậc)", () => {
  assert.deepEqual([1, 2, 3, 4].map(gearCost), [100, 400, 900, 1600]); assert.equal(GEAR.max, 4);
});
t("buyGear: đủ tiền thì nâng và trừ tiền, thiếu tiền / đã tối đa thì báo lý do", () => {
  const c = newCareer({ name: "Kiên", que: QUE[0], weapon: "WC03" });
  c.tien = 150;
  let r = buyGear(c, "weapon"); assert.equal(r.ok, true); assert.equal(c.gear.weapon, 1); assert.equal(c.tien, 50);
  r = buyGear(c, "weapon"); assert.equal(r.ok, false); assert.ok(/Cần/.test(r.why));
  c.gear.armor = 4; c.tien = 99999; r = buyGear(c, "armor"); assert.equal(r.ok, false);
});

console.log("Người lính");
t("tạo lính: tên cắt khoảng trắng, trống thì lấy tên gợi ý; quê trong danh sách; binh khí Song đao hoặc Đại đao", () => {
  const c = newCareer({ name: "  Đỗ Văn Kiên  ", que: QUE[2], weapon: "WC01" });
  assert.equal(c.name, "Đỗ Văn Kiên"); assert.equal(c.que, QUE[2]); assert.equal(c.weapon, "WC01");
  assert.equal(c.rep, 0); assert.equal(c.tien, 0); assert.deepEqual(c.gear, { weapon: 0, armor: 0 });
  const d = newCareer({ name: "", que: "Không có", weapon: "XYZ", seed: 7 });
  assert.ok(d.name.length > 3); assert.ok(QUE.includes(d.que)); assert.equal(d.weapon, "WC03");
  assert.deepEqual(Object.keys(WEAPONS), ["WC03", "WC01"]);
});
t("tên gợi ý xác định theo seed, có họ và tên", () => {
  assert.equal(suggestName(42), suggestName(42));
  assert.ok(suggestName(42).split(" ").length >= 3);
});
t("chỉ số lính Lính yếu hơn Trần Quốc Toản cấp 1; mạnh dần theo bậc và trang bị", () => {
  const H = heroStats(newSave(), 1);
  const c = newCareer({ name: "A", que: QUE[0], weapon: "WC03" });
  const s0 = soldierStats(c);
  assert.ok(s0.cong < H.cong && s0.hp < H.hp, `lính ${s0.cong}/${s0.hp} vs tướng ${H.cong}/${H.hp}`);
  c.rep = 1200; const s2 = soldierStats(c);
  c.gear.weapon = 2; c.gear.armor = 2; const s2g = soldierStats(c);
  assert.ok(s2.cong > s0.cong && s2.hp > s0.hp);
  assert.ok(s2g.cong > s2.cong && s2g.hp > s2.hp && s2g.giap > s2.giap);
  assert.equal(s0.level, RANKS[0].level); assert.equal(s2.level, RANKS[2].level);
  assert.ok(s0.mods && typeof s0.mods.atkPct === "number", "đủ mods cho lõi tướng");
  assert.equal(s0.kiBars, 2);
});
t("soldierDef: lớp đòn theo binh khí, kỹ năng mở theo bậc, nhãn Hư cấu", () => {
  const c = newCareer({ name: "Kiên", que: QUE[0], weapon: "WC01" });
  const d = soldierDef(c);
  assert.equal(d.cls, "WC01"); assert.equal(d.weaponLabel, "Hư cấu"); assert.equal(d.name, "Kiên");
  assert.equal(d.rank, 0); assert.ok(d.skills.sk1 && d.skills.ult);
  assert.ok(d.cong1 > 0 && d.kiLucPerBar > 0 && d.move > 0 && d.revive);
});
t("recordBattle: cộng danh tiếng + tiền, ghi sổ 10 trận gần nhất, đếm trận / thắng, báo thăng bậc", () => {
  const save = newSave(); save.career = newCareer({ name: "Kiên", que: QUE[0], weapon: "WC03" });
  save.career.rep = 290;
  const out = recordBattle(save, { won: true, type: "giudon", base: 60, kills: { thuong: 10 }, side: 1, timeSec: 200 });
  assert.equal(out.promoted, true); assert.equal(rankOf(save.career.rep), 1);
  assert.equal(save.career.battles, 1); assert.equal(save.career.wins, 1);
  assert.ok(save.career.tien > 0); assert.equal(save.career.log.length, 1);
  for (let i = 0; i < 15; i++) recordBattle(save, { won: false, type: "danhup", base: 70, kills: {}, side: 0, timeSec: 100 });
  assert.equal(save.career.log.length, 10); assert.equal(save.career.battles, 16);
  assert.equal(save.wallet.tien, newSave().wallet.tien, "không đụng ví của Trần Quốc Toản");
});
t("retire: bỏ lính hiện tại, giữ một dòng trong danh sách lính đã giải ngũ", () => {
  const save = newSave(); save.career = newCareer({ name: "Kiên", que: QUE[0], weapon: "WC03" }); save.career.rep = 1500;
  retire(save);
  assert.equal(save.career, null); assert.equal(save.veterans.length, 1); assert.equal(save.veterans[0].rank, "Đội trưởng");
});

console.log(`\n${pass} đạt, ${fail} trượt`);
process.exit(fail ? 1 : 0);
