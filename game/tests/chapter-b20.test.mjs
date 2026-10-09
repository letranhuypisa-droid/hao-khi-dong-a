// tests/chapter-b20.test.mjs — luồng Chương B20 và meta (đợt 9, D5): khóa mở thẻ theo kết quả trận B20 (Kế Sách thành
// công, Ô Mã Nhi xuất hiện, thắng lần đầu), B15 giữ luật cũ; thưởng trận ngoài thang R (chỉ ví, hạng tốt nhất ở
// save.battles.B20); xếp hạng theo par riêng và mất điểm K; phần kết quả B20 (ui/result-b20.js) từ riverResult thật;
// Hiến kế (applyCouncil, councilResult) và danh mục trận. Chạy trong Node:
//   node hao-khi-viet/game/tests/chapter-b20.test.mjs
import assert from "node:assert/strict";
import * as C from "../js/meta/chapter.js";
import * as P from "../js/meta/progress.js";
import { BATTLES, loadChapterMeta } from "../js/data/battles.js";
import { createRiver, riverResult } from "../js/sim/river.js";
import { missionRows, keSachRows, riverRows, resultB20HTML, resultHTML } from "../js/ui/result-b20.js";
import { applyCouncil, councilResult, councilErrors } from "../js/ui/council.js";
import { MODES } from "../js/data/tuning.js";

let pass = 0, fail = 0;
async function t(name, fn) {
  try { await fn(); pass++; console.log("  ok  " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + (e.stack || e.message)); }
}
const M = await loadChapterMeta("B20");
C.registerCards("B20", M.cards);
const fresh = () => ({ chapters: {}, cards: {}, quiz: { done: 0, answered: {}, review: [] } });
const ks = (id, state) => ({ id, state, name: id, word: state, got: 0, hk: 20 });

console.log("Khóa mở thẻ B20 (battleUnlockKeys)");
await t("B20: chỉ Kế Sách thành công mở keSach:<id>; thất bại không mở", () => {
  const keys = C.battleUnlockKeys({ battle: "B20", won: false, keSachList: [ks("nghiBinh", "thanhcong"), ks("kichCoc", "thatbai"), ks("conNuoc", "khoa")] });
  assert.deepEqual(keys, ["keSach:nghiBinh"]);
});
await t("B20: thiếu keSachList thì đọc river.keSach (riverResult)", () => {
  const st = createRiver({ quyetSachOk: true });
  st.ks.kichCoc.state = "thanhcong"; st.ks.conNuoc.state = "thatbai";
  const keys = C.battleUnlockKeys({ battle: "B20", won: true, river: riverResult(st) });
  assert.deepEqual(keys, ["keSach:kichCoc", "firstWin"]);
});
await t("B20: bossMet chỉ khi Ô Mã Nhi (X20) đã ra trận — gặp Phàn Tiếp thôi thì không", () => {
  assert.deepEqual(C.battleUnlockKeys({ battle: "B20", bossMet: true, bossesMet: ["X24"] }), []);
  assert.deepEqual(C.battleUnlockKeys({ battle: "B20", bossMet: false, bossesMet: ["X24", "X20"] }), ["bossMet"]);
  assert.deepEqual(C.battleUnlockKeys({ battle: "B20", bossMet: true }), ["bossMet"]);
});
await t("B15 giữ luật cũ: Kế Sách thành hay bại đều mở, bossMet theo res.bossMet", () => {
  const keys = C.battleUnlockKeys({ won: true, bossMet: true, keSachList: [ks("coAoTong", "thatbai"), ks("muiTenThu", "khoa")] });
  assert.deepEqual(keys, ["bossMet", "keSach:coAoTong", "firstWin"]);
  assert.deepEqual(C.battleUnlockKeys({ battle: "B15", won: false, keSachList: [ks("coAoTong", "thanhcong")] }), ["keSach:coAoTong"]);
});
await t("mở đúng thẻ B20: thắng trọn → Ô Mã Nhi, 3 thẻ Kế Sách, 3 thẻ thắng lần đầu; Quiz lần đầu → thẻ bên lề", () => {
  const s = fresh();
  const res = { battle: "B20", won: true, bossesMet: ["X24", "X20"], keSachList: ["nghiBinh", "kichCoc", "conNuoc"].map((id) => ks(id, "thanhcong")) };
  const got = C.unlockCards(s, "B20", C.battleUnlockKeys(res), 1).sort();
  assert.deepEqual(got, ["B20-baicoc", "B20-connuoc", "B20-dohanh", "B20-nghibinh", "B20-noibang", "B20-tran", "X20"]);
  assert.deepEqual(C.unlockCards(s, "B20", ["firstQuiz"], 2), ["B20-bl-938"]);
  assert.deepEqual(C.unlockCards(s, "B20", C.battleUnlockKeys(res), 3), []);                 // không mở hai lần
});
await t("thẻ Kế Sách B20 ghi đúng điều kiện mở (thành công)", () => {
  for (const id of ["B20-nghibinh", "B20-baicoc", "B20-connuoc"]) assert.match(M.cardById[id].hint, /thành công/, id);
});

console.log("Thưởng, xếp hạng trận ngoài thang R");
const baseRes = { battle: "B20", won: true, R: 25, difficulty: "quansi", mode: "nhanh", timeSec: 700, missions: 0.9, qRatio: 0.8, baseRatio: 0.8,
  keSach: 1, keSachOk: 3, hkRaw: 120, avgSK: 60, bossDefeated: true, tpcCount: 1, ko: 700 };
await t("scoreBattle: par riêng (B20 330 s = PAR_B20) và kLost bỏ trọn điểm K; mặc định như cũ", () => {
  assert.equal(BATTLES.B20.par.nhanh, 330, "par màn kết quả = par HUD (PAR_B20, tổng par các pha)");
  const par = BATTLES.B20.par.nhanh, a = P.scoreBattle({ ...baseRes, timeSec: 700 }), b = P.scoreBattle({ ...baseRes, timeSec: 700, par });
  assert.equal(a.parts.T, Math.max(0, 1 - (700 - MODES.nhanh.par) / MODES.nhanh.par));
  assert.equal(b.parts.T, Math.max(0, 1 - (700 - par) / par)); assert.notEqual(b.parts.T, a.parts.T, "par riêng của B20 khác par chung");
  const k = P.scoreBattle({ ...baseRes, kLost: true });
  assert.equal(k.parts.K, 0); assert.equal(P.scoreBattle(baseRes).diem - k.diem, 10);
});
await t("computeFixedRewards: không EXP, không rơi binh khí, không điểm kỹ năng, không mở R; ví như công thức chung", () => {
  const s = P.newSave(), sc = P.scoreBattle(baseRes), full = { ...baseRes, ...sc };
  const rw = P.computeFixedRewards(s, full), ref = P.computeRewards(s, full);
  assert.equal(rw.exp, 0); assert.deepEqual(rw.drops, []); assert.equal(rw.skillPoint, false); assert.equal(rw.unlockR, null);
  assert.equal(rw.tien, ref.tien); assert.equal(rw.qc, ref.qc); assert.equal(rw.tt, ref.tt);
});
await t("applyFixedRewards: ví + save.battles.B20 (best, bestTime, plays), không đụng cấp / thang R / bestTime B15", () => {
  const s = P.newSave();
  const w = (rank, timeSec, won = true) => { const full = { ...baseRes, won, rank, timeSec, diem: 80 }; return P.applyFixedRewards(s, "B20", full, P.computeFixedRewards(s, full)); };
  assert.equal(w("B", 800).newBest, true);
  assert.equal(w("A", 900).newBest, true);
  assert.equal(w("C", 600).newBest, false);
  w("-", 500, false);
  assert.deepEqual({ ...s.battles.B20 }, { best: "A", cleared: true, plays: 4, bestTime: 600 });
  assert.equal(s.hero.level, 1); assert.equal(s.hero.exp, 0); assert.deepEqual(s.ladder, P.newSave().ladder);
  assert.equal(s.stats.bestTime, null); assert.equal(s.stats.battles, 4); assert.equal(s.stats.wins, 3);
  assert.ok(s.wallet.tien > 0); assert.equal(s.log[0].battle, "B20"); assert.equal(s.log[0].exp, 0);
});

console.log("Màn kết quả B20 (ui/result-b20.js)");
await t("hàng nhiệm vụ: 3 chính (P1, P5, P6 — pha cảnh tua không hiện), 2 phụ; cờ từ res.main / res.side, thiếu thì suy", () => {
  const r = missionRows({ main: [1, 1, 1, 1, 0, 1], side: { S_X24: true }, phaseTimes: [80, 30, 10, 20, 0, 60] });
  assert.deepEqual(r.main.map((m) => m.id), ["P1", "P5", "P6"]); assert.equal(r.side.length, 2); assert.equal(r.mainDone, 2); assert.equal(r.sideDone, 1);
  assert.equal(r.main[0].time, 80); assert.equal(r.main[1].time, null); assert.equal(r.main[2].time, 60);
  const d = missionRows({ mainDone: 2, captured: { X24: true }, river: riverResult(createRiver({})) });
  assert.equal(d.mainDone, 2); assert.equal(d.side.find((m) => m.id === "S_X24").done, true); assert.equal(d.side.find((m) => m.id === "S_RAID").done, false);
});
await t("Kế Sách: 3 dòng theo thứ tự trận từ riverResult thật, chữ trạng thái, lý do thất bại", () => {
  const st = createRiver({}); st.ks.conNuoc.state = "thatbai"; st.ks.conNuoc.why = "Bãi cọc chỉ giữ được một nửa hạm đội.";
  const K = keSachRows({ river: riverResult(st) });
  assert.deepEqual(K.map((k) => k.id), ["nghiBinh", "kichCoc", "conNuoc"]);
  assert.equal(K[2].word, "Thất bại"); assert.equal(K[2].why, "Bãi cọc chỉ giữ được một nửa hạm đội.");
});
await t("khúc sông: hạm đội vào bãi cọc, mắc cạn (mất điểm K), Kế đã định", () => {
  const st = createRiver({ quyetSachOk: true });
  const R = riverRows({ river: riverResult(st) }, { council: { historical: true } });
  assert.deepEqual(R.map((x) => x.k), ["Hạm đội vào bãi cọc", "Hạm đội mắc cạn", "Kế đã định"]);
  assert.match(R[1].v, /mất điểm Kế Sách/);                 // strandShare 0,5 khi chưa có Kế Sách → kRank false
  assert.match(R[2].v, /^có/);
  assert.deepEqual(riverRows({}), []);
});
await t("HTML: không lỗi với kết quả tối thiểu và kết quả đủ; escape chữ; có nhãn Chính sử", () => {
  assert.equal(resultHTML, resultB20HTML);
  const h0 = resultB20HTML({});
  assert.match(h0, /Nhiệm vụ theo con nước/); assert.match(h0, /Không có số liệu khúc sông/);
  const st = createRiver({}); st.ks.nghiBinh.state = "thatbai"; st.ks.nghiBinh.why = "<b>x</b>";
  const h = resultB20HTML({ river: riverResult(st), captured: { X20: true }, mainDone: 3 }, { council: { historical: true } });
  assert.ok(!h.includes("<b>x</b>") && h.includes("&lt;b&gt;x&lt;/b&gt;"));
  assert.match(h, /Kế đã định/); assert.match(h, /Ô Mã Nhi/); assert.match(h, /label cs/);
});

console.log("Hiến kế và danh mục");
await t("council B20 hợp lệ; councilResult; applyCouncil điền lời đáp (Hư cấu) + lệnh, không đổi COMIC_B20", () => {
  const c = M.comic.council;
  assert.deepEqual(councilErrors(c), []);
  const old = c.cards.find((k) => k.historical), other = c.cards.find((k) => !k.historical);
  assert.deepEqual(councilResult(c, old.id), { picked: old.id, historical: true });
  const before = JSON.stringify(M.comic);
  const got = applyCouncil(M.comic, other.id);
  assert.equal(JSON.stringify(M.comic), before);
  const bub = Object.values(got.panels).flatMap((p) => p.bubbles || []);
  assert.ok(bub.some((b) => b.vi === other.reply.vi && b.label === "Hư cấu"));
  assert.ok(bub.some((b) => b.vi === c.decree.vi));
  assert.ok(!bub.some((b) => b.from));
});
await t("danh mục: số Kế Sách theo chế độ, marks() = tên 3 Kế Sách Lớn, resultUI nạp được", async () => {
  assert.deepEqual(BATTLES.B15.keSach, { nhanh: 1, chuan: 2 }); assert.equal(BATTLES.B20.keSach.nhanh, 3);
  assert.deepEqual(await BATTLES.B20.marks(), ["Nghi binh lúc triều lên", "Kích hoạt bãi cọc", "Con nước"]);
  assert.equal((await BATTLES.B20.resultUI()).resultHTML, resultHTML);
  assert.equal(BATTLES.B15.resultUI, undefined); assert.equal(BATTLES.B15.marks, undefined);
});

console.log(`\n${pass} đạt, ${fail} lỗi`);
if (fail) process.exit(1);
