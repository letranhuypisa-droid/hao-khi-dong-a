// tests/guards.test.mjs — cận vệ của người lính (chế độ Tự do, đợt 15c): số chỗ theo bậc, lớp cận vệ (chỉ số 50–75% của người lính,
// chiêu riêng), lệnh, luật tự tung chiêu, đỡ dậy, chiêu mộ / sửa / cho về, lưu cũ không hỏng, ghi trận. Thuần (data/guards.js,
// data/career.js, meta/career.js). Chạy trong Node:
//   node game/tests/guards.test.mjs
import assert from "node:assert/strict";
import { GUARD_CLASSES, GUARD_ORDER, GUARD_ORDERS, GUARD_PCT, GUARD_NAME_MAX, guardSlots, guardStats, newGuard, wantsSkill, formationSlot, reviveStep, REVIVE } from "../js/data/guards.js";
import { RANKS, UNLOCK, can, RANK_PERKS, battleRep, MISSION_MULT, GUARD_REP } from "../js/data/career.js";
import { newCareer, soldierStats, soldierDef, recordBattle, recruitGuard, editGuard, dismissGuard, careerGuards, activeGuards } from "../js/meta/career.js";
import { newSave } from "../js/meta/progress.js";

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log("  ok  " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + (e.stack || e.message)); }
}
const career = (rep = 0) => { const c = newCareer({ name: "Kiên", que: "Thiên Trường", weapon: "WC03", seed: 11 }); c.rep = rep; return c; };

console.log("Số chỗ, mở theo bậc");
t("chỗ cận vệ theo bậc: Lính 0 · Tinh nhuệ 1 · Đội trưởng 2 · Phó tướng 3 · Tướng 4", () => {
  assert.deepEqual(RANKS.map((_, i) => guardSlots(i)), [0, 1, 2, 3, 4]);
  assert.equal(guardSlots(99), 4); assert.equal(guardSlots(-1), 0);
});
t("vòng Mệnh Lệnh (ra lệnh cho cận vệ) mở cùng cận vệ đầu tiên: Tinh nhuệ", () => {
  assert.equal(can(0, "squad"), false); assert.equal(can(1, "squad"), true);
  assert.equal(UNLOCK.squad2, undefined, "hết đội lính thứ hai / Gọi tiếp viện");
});
t("mô tả bậc nhắc cận vệ ở mọi bậc có cận vệ, không còn 'lính theo' hay 'Gọi tiếp viện'", () => {
  for (let i = 1; i < RANKS.length; i++) assert.ok(/cận vệ/i.test(RANK_PERKS[i]), `bậc ${i}: ${RANK_PERKS[i]}`);
  for (const p of RANK_PERKS) assert.ok(!/lính đi theo|lính theo|Gọi tiếp viện/.test(p), p);
});

console.log("Lớp cận vệ");
const CLS = Object.values(GUARD_CLASSES);
t("5 lớp: Khiên thủ, Giáo thủ, Cung thủ, Song đao, Đại đao — mỗi lớp một binh khí, một chiêu riêng (tên, hồi > 0, mô tả)", () => {
  assert.deepEqual(CLS.map((c) => c.name), ["Khiên thủ", "Giáo thủ", "Cung thủ", "Song đao", "Đại đao"]);
  const skills = new Set();
  for (const c of CLS) {
    assert.ok(c.weapon && c.text && c.skill?.id && c.skill.name && c.skill.text, c.id);
    assert.ok(c.skill.cd > 0, `${c.id} cd`); skills.add(c.skill.id);
    assert.ok(c.every > 0 && c.mv > 0 && (c.ranged ? c.range > 0 : c.reach > 0), `${c.id} đánh thường`);
  }
  assert.equal(skills.size, CLS.length, "chiêu không trùng");
});
t("chỉ số mỗi lớp nằm trong 50–75% của người lính (Công, Sinh lực, Giáp)", () => {
  assert.deepEqual(GUARD_PCT, { min: 0.5, max: 0.75 });
  for (const c of CLS) for (const k of ["cong", "hp", "giap"]) assert.ok(c.pct[k] >= 0.5 && c.pct[k] <= 0.75, `${c.id}.${k} = ${c.pct[k]}`);
});
t("đúng bảng đã duyệt: Khiên 50/75/75 · Giáo 65/60/60 · Cung 75/50/50 · Song đao 75/55/50 · Đại đao 65/70/60", () => {
  const want = { khien: [0.5, 0.75, 0.75], giao: [0.65, 0.6, 0.6], cung: [0.75, 0.5, 0.5], songdao: [0.75, 0.55, 0.5], daidao: [0.65, 0.7, 0.6] };
  for (const [id, [cg, hp, gp]] of Object.entries(want)) assert.deepEqual(GUARD_CLASSES[id].pct, { cong: cg, hp, giap: gp }, id);
});
t("guardStats = chỉ số người lính lúc vào trận × tỉ lệ lớp (làm tròn); tốc chạy bằng người lính", () => {
  const base = { cong: 200, hp: 2000, giap: 70, move: 6.4 };
  assert.deepEqual(guardStats(base, "khien"), { cong: 100, hp: 1500, giap: 53, move: 6.4 });
  assert.deepEqual(guardStats(base, "cung"), { cong: 150, hp: 1000, giap: 35, move: 6.4 });
  assert.deepEqual(guardStats(base, "khongco"), guardStats(base, "khien"), "lớp lạ → Khiên thủ");
});
t("cận vệ mạnh lên cùng người lính (bậc, quân nhu) — luôn 50–75%", () => {
  const c = career(0), s0 = soldierStats(c), g0 = guardStats(s0, "giao");
  c.rep = 3500; c.gear.weapon = 2; c.gear.armor = 2;
  const s3 = soldierStats(c), g3 = guardStats(s3, "giao");
  assert.ok(g3.cong > g0.cong && g3.hp > g0.hp && g3.giap > g0.giap);
  for (const k of ["cong", "hp", "giap"]) { const r = g3[k] / s3[k]; assert.ok(r >= 0.49 && r <= 0.76, `${k} ${r}`); }
});

console.log("Lệnh");
t("4 lệnh theo phím 1–4: Xung trận · Giữ chỗ · Theo ta · Tung chiêu; mặc định Theo ta", () => {
  assert.deepEqual(GUARD_ORDERS.map((o) => o.k), ["xungtran", "giucho", "theota", "tungchieu"]);
  assert.deepEqual(GUARD_ORDERS.map((o) => o.name), ["Xung trận", "Giữ chỗ", "Theo ta", "Tung chiêu"]);
  for (const o of GUARD_ORDERS) assert.ok(o.icon && o.text, o.k);
  assert.equal(GUARD_ORDER.start, "theota");
});
t("đội hình Theo ta: mỗi cận vệ một chỗ riêng sau lưng / hai bên, cách người lính 2–4 m", () => {
  const pts = [0, 1, 2, 3].map((i) => formationSlot(i, 0));       // người lính quay mặt +z (yaw 0)
  for (const p of pts) { const d = Math.hypot(p.x, p.z); assert.ok(d >= 2 && d <= 4, `d ${d}`); assert.ok(p.z < 0.5, "không đứng chắn trước mặt"); }
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) assert.ok(Math.hypot(pts[i].x - pts[j].x, pts[i].z - pts[j].z) > 1.2, `${i}-${j} quá sát`);
  const r = formationSlot(0, Math.PI / 2);                        // quay sang +x: chỗ đứng xoay theo
  assert.ok(r.x < 0.5);
});

console.log("Tự tung chiêu");
const S0 = { order: "xungtran", foesNearHero: 0, foesNear: 0, foesInLine: 0, cluster: 0, officerD: Infinity, heroHp: 1 };
t("chỉ tự tung khi đang Xung trận; lệnh khác chỉ tung khi bấm Tung chiêu", () => {
  const busy = { ...S0, foesNearHero: 5, foesNear: 5, foesInLine: 4, cluster: 6, officerD: 2, heroHp: 0.2 };
  for (const c of CLS) assert.equal(wantsSkill(c.id, busy), true, c.id);
  for (const o of ["theota", "giucho"]) for (const c of CLS) assert.equal(wantsSkill(c.id, { ...busy, order: o }), false, `${c.id} ${o}`);
  for (const c of CLS) assert.equal(wantsSkill(c.id, S0), false, `${c.id} không có địch`);
});
t("luật từng lớp: Khiên khi người lính bị ≥ 3 địch vây (hoặc máu < 50% và có địch); Giáo khi ≥ 2 địch trên đường đâm hoặc sĩ quan ≤ 6 m; Cung khi cụm ≥ 3 hoặc có sĩ quan trong tầm; Song đao khi ≥ 3 địch sát người; Đại đao khi sĩ quan ≤ 4 m hoặc ≥ 2 địch sát", () => {
  assert.equal(wantsSkill("khien", { ...S0, foesNearHero: 3 }), true); assert.equal(wantsSkill("khien", { ...S0, foesNearHero: 2 }), false);
  assert.equal(wantsSkill("khien", { ...S0, foesNearHero: 1, heroHp: 0.4 }), true);
  assert.equal(wantsSkill("giao", { ...S0, foesInLine: 2 }), true); assert.equal(wantsSkill("giao", { ...S0, foesInLine: 1 }), false);
  assert.equal(wantsSkill("giao", { ...S0, officerD: 5 }), true); assert.equal(wantsSkill("giao", { ...S0, officerD: 7 }), false);
  assert.equal(wantsSkill("cung", { ...S0, cluster: 3 }), true); assert.equal(wantsSkill("cung", { ...S0, cluster: 2 }), false);
  assert.equal(wantsSkill("cung", { ...S0, officerD: 18 }), true); assert.equal(wantsSkill("cung", { ...S0, officerD: 40 }), false);
  assert.equal(wantsSkill("songdao", { ...S0, foesNear: 3 }), true); assert.equal(wantsSkill("songdao", { ...S0, foesNear: 2 }), false);
  assert.equal(wantsSkill("daidao", { ...S0, officerD: 3.5 }), true); assert.equal(wantsSkill("daidao", { ...S0, foesNear: 2 }), true);
  assert.equal(wantsSkill("daidao", { ...S0, foesNear: 1, officerD: 6 }), false);
});

console.log("Gục, đỡ dậy");
t("đứng cạnh cận vệ gục đủ giây (không địch kề bên) thì đỡ dậy với 40% Sinh lực, mỗi người một lần mỗi trận", () => {
  assert.equal(REVIVE.hpPct, 0.4); assert.ok(REVIVE.sec >= 2 && REVIVE.sec <= 3);
  let s = { p: 0, used: false };
  s = reviveStep(s, 1, { near: true, blocked: false }); assert.ok(s.p > 0 && !s.done);
  s = reviveStep(s, REVIVE.sec, { near: true, blocked: false }); assert.equal(s.done, true);
  let b = reviveStep({ p: 0.5, used: false }, 1, { near: true, blocked: true }); assert.equal(b.p, 0.5, "địch kề bên thì dừng");
  b = reviveStep({ p: 0.5, used: false }, 1, { near: false, blocked: false }); assert.equal(b.p, 0, "rời đi thì tụt về 0");
  const u = reviveStep({ p: 0, used: true }, 9, { near: true, blocked: false }); assert.ok(!u.done && u.used, "đã đỡ một lần rồi thì thôi");
});

console.log("Chiêu mộ, sửa, cho về");
t("tạo cận vệ: tên cắt khoảng trắng, tối đa 24 ký tự, trống thì lấy tên gợi ý; lớp lạ → Khiên thủ", () => {
  assert.equal(GUARD_NAME_MAX, 24);
  const g = newGuard({ id: 3, name: "  Trần Văn Hổ  ", cls: "cung" });
  assert.deepEqual({ id: g.id, name: g.name, cls: g.cls, battles: g.battles, ko: g.ko }, { id: 3, name: "Trần Văn Hổ", cls: "cung", battles: 0, ko: 0 });
  assert.equal(newGuard({ id: 1, name: "x".repeat(40), cls: "giao" }).name.length, 24);
  assert.equal(newGuard({ id: 4, name: `<b>Hổ</b> & "Báo"`, cls: "giao" }).name, "bHổ/b Báo", "bỏ ký tự HTML (tên hiện trong tin nhắn trận)");
  const e = newGuard({ id: 2, name: "", cls: "zzz", seed: 5 });
  assert.ok(e.name.split(" ").length >= 2); assert.equal(e.cls, "khien");
});
t("Lính chưa chiêu mộ được; Tinh nhuệ 1 người, người thứ hai báo hết chỗ; Tướng tới 4", () => {
  const c = career(0);
  let r = recruitGuard(c, { name: "A", cls: "khien" }); assert.equal(r.ok, false); assert.ok(/Tinh nhuệ/.test(r.why), r.why);
  c.rep = 300; r = recruitGuard(c, { name: "A", cls: "khien" }); assert.equal(r.ok, true); assert.equal(c.guards.length, 1);
  r = recruitGuard(c, { name: "B", cls: "cung" }); assert.equal(r.ok, false); assert.ok(/chỗ|Đội trưởng/.test(r.why), r.why);
  c.rep = 8000; for (const n of ["B", "C", "D"]) assert.equal(recruitGuard(c, { name: n, cls: "giao" }).ok, true);
  assert.equal(recruitGuard(c, { name: "E", cls: "giao" }).ok, false);
  assert.deepEqual(c.guards.map((g) => g.name), ["A", "B", "C", "D"]);
  assert.equal(new Set(c.guards.map((g) => g.id)).size, 4, "id không trùng");
});
t("sửa tên / đổi lớp không mất số trận; cho về thì trống chỗ, id mới không dùng lại id cũ", () => {
  const c = career(1200);
  const a = recruitGuard(c, { name: "A", cls: "khien" }).guard; a.battles = 5; a.ko = 30;
  assert.equal(editGuard(c, a.id, { name: "  Hổ ", cls: "daidao" }).ok, true);
  assert.deepEqual([a.name, a.cls, a.battles, a.ko], ["Hổ", "daidao", 5, 30]);
  assert.equal(editGuard(c, a.id, { name: "", cls: "songdao" }).guard.name, "Hổ", "tên trống thì giữ tên cũ");
  assert.equal(editGuard(c, 999, { name: "X" }).ok, false);
  const b = recruitGuard(c, { name: "B", cls: "cung" }).guard;
  assert.equal(dismissGuard(c, a.id).ok, true); assert.deepEqual(c.guards.map((g) => g.id), [b.id]);
  const n = recruitGuard(c, { name: "N", cls: "giao" }).guard; assert.ok(n.id !== a.id && n.id !== b.id);
});
t("lưu cũ (đợt 14, chưa có guards) đọc được: 0 cận vệ, chiêu mộ bình thường", () => {
  const c = career(300); delete c.guards; delete c.nextGuardId;
  assert.deepEqual(careerGuards(c), []); assert.deepEqual(activeGuards(c), []);
  assert.equal(recruitGuard(c, { name: "A", cls: "cung" }).ok, true); assert.equal(c.guards.length, 1);
});
t("soldierDef mang số cận vệ (ô Mệnh Lệnh ẩn khi chưa có ai)", () => {
  const c = career(1200); assert.equal(soldierDef(c).guards, 0);
  recruitGuard(c, { name: "A", cls: "khien" }); recruitGuard(c, { name: "B", cls: "cung" });
  assert.equal(soldierDef(c).guards, 2);
});

console.log("Ghi trận, danh tiếng");
t("recordBattle cộng số trận, số địch hạ cho từng cận vệ đã ra trận", () => {
  const save = newSave(); save.career = career(1200);
  const a = recruitGuard(save.career, { name: "A", cls: "khien" }).guard, b = recruitGuard(save.career, { name: "B", cls: "giao" }).guard;
  recordBattle(save, { won: true, type: "giudon", base: 60, kills: {}, side: 0, timeSec: 100, guards: [{ id: a.id, ko: 7, up: true }, { id: b.id, ko: 3, up: false }] });
  assert.deepEqual([a.battles, a.ko, b.battles, b.ko], [1, 7, 1, 3]);
  recordBattle(save, { won: true, type: "giudon", base: 60, kills: {}, side: 0, timeSec: 100 });
  assert.equal(a.battles, 1, "trận không có cận vệ (Đấu tướng) thì không cộng");
});
t("danh tiếng: từ Tinh nhuệ, cận vệ còn đứng cuối trận thì có thêm (tỉ lệ)", () => {
  const a = battleRep({ won: true, base: 70, rankIdx: 1, guards: { total: 1, alive: 1 } });
  const b = battleRep({ won: true, base: 70, rankIdx: 1, guards: { total: 1, alive: 0 } });
  const p = a.parts.find((x) => x.id === "guards");
  assert.ok(p && /Cận vệ đứng vững 1\/1/.test(p.label), p?.label);
  assert.equal(p.rep, Math.round(GUARD_REP * MISSION_MULT[1]));
  assert.ok(a.total > b.total);
  assert.ok(!battleRep({ won: true, base: 70, rankIdx: 0, guards: { total: 1, alive: 1 } }).parts.some((x) => x.id === "guards"), "Lính không có phần này");
});

console.log(`\n${pass} đạt, ${fail} trượt`);
process.exit(fail ? 1 : 0);
