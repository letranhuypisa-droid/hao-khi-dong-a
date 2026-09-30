// tests/b20-content.test.mjs — nội dung meta Chương B20 Bạch Đằng: comic nướng, Hiến kế, thẻ Sử quán, Quiz chương.
//   node hao-khi-viet/game/tests/b20-content.test.mjs
import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { COMIC_B20 } from "../js/data/comic-b20.js";
import { COMIC_B15 } from "../js/data/comic-b15.js";
import { CARDS, CARD_BY_ID, QUIZ_B20 } from "../js/data/suquan-b20.js";
import { CARD_GROUPS } from "../js/data/suquan-b15.js";
import { lintQuiz, optionOrder } from "../js/meta/chapter.js";
import { pagesFor, panelSyllables, readSeconds } from "../js/ui/comic.js";
import { councilErrors, shuffleCards, councilResult, applyCouncil, councilSpeaker } from "../js/ui/council.js";

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log("  ok  " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + e.message); }
}
const root = fileURLToPath(new URL("../", import.meta.url));
const LABELS = ["Chính sử", "Tương truyền", "Hư cấu"];
const lcg = (a) => () => {                         // mulberry32: số đầu đã trải đều (LCG 16807 với seed nhỏ thì không)
  a = (a + 0x6d2b79f5) | 0; let x = Math.imul(a ^ (a >>> 15), 1 | a);
  x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
};
const allIds = [...COMIC_B20.open, ...COMIC_B20.decree, ...COMIC_B20.insert, ...COMIC_B20.close];

console.log("Comic B20 (22.3)");
t("thứ tự đọc: Tình thế O1 O2 O3 O7 → Hiến kế → Chủ soái quyết D1 O4 O5 O6 O8 → kết K1–K6; không khung chèn", () => {
  assert.deepEqual(COMIC_B20.open, ["O1", "O2", "O3", "O7"]);
  assert.deepEqual(COMIC_B20.decree, ["D1", "O4", "O5", "O6", "O8"]);
  assert.deepEqual(COMIC_B20.close, ["K1", "K2", "K3", "K4", "K5", "K6"]);
  assert.deepEqual(COMIC_B20.insert, []);
  for (const id of allIds) assert.ok(COMIC_B20.panels[id], id);
});
t("mọi khung có ảnh AVIF + WebP trên đĩa; tổng AVIF ≤ 3 MB", () => {
  let bytes = 0;
  for (const id of allIds) {
    for (const ext of ["avif", "webp"]) assert.ok(existsSync(root + `assets/comic/B20/${id}.${ext}`), `thiếu ${id}.${ext}`);
    bytes += statSync(root + `assets/comic/B20/${id}.avif`).size;
    const p = COMIC_B20.panels[id]; assert.ok(p.w > 0 && p.h > 0 && Math.max(p.w, p.h) <= 1552, `${id} ${p.w}×${p.h}`);
  }
  assert.ok(bytes <= 3 * 1024 * 1024, `AVIF ${(bytes / 1048576).toFixed(2)} MB`);
  console.log(`       (AVIF ${(bytes / 1048576).toFixed(2)} MB, mở ${COMIC_B20.open.reduce((s, id) => s + readSeconds(COMIC_B20.panels[id]), 0).toFixed(0)} s + quyết ${COMIC_B20.decree.reduce((s, id) => s + readSeconds(COMIC_B20.panels[id]), 0).toFixed(0)} s đọc)`);
});
t("mỗi khung ≤ 35 âm tiết, lời dẫn ≤ 25, ≤ 3 bóng; lời dẫn và bóng có nhãn", () => {
  for (const [id, p] of Object.entries(COMIC_B20.panels)) {
    assert.ok(panelSyllables(p) <= 35, `${id}: ${panelSyllables(p)} âm tiết`);
    if (p.caption) { assert.ok(p.caption.vi.split(/\s+/).length <= 25, `${id}: lời dẫn dài`); assert.ok(LABELS.includes(p.caption.label), id); }
    assert.ok((p.bubbles || []).length <= 3, id);
    for (const b of p.bubbles || []) assert.ok(LABELS.includes(b.label), `${id}: bóng thiếu nhãn`);
  }
});
t("chia trang theo pages, giữ thứ tự đọc từng phần", () => {
  for (const part of ["open", "decree", "close"]) assert.deepEqual(pagesFor(COMIC_B20, COMIC_B20[part]).flat(2), COMIC_B20[part], part);
});
t("comic B15 bản VS không bị đổi dạng khi tổng quát bake-comic (không có decree / council)", () => {
  assert.equal("decree" in COMIC_B15, false); assert.equal("council" in COMIC_B15, false);
  assert.deepEqual(Object.keys(COMIC_B15), ["chapter", "variant", "open", "insert", "close", "pages", "panels", "quiz", "provenance"]);
});

console.log("\nHiến kế (systems §12.6)");
const C = COMIC_B20.council;
t("dữ liệu Hiến kế hợp lệ: 3 thẻ, đúng 1 thẻ lịch sử (Chính sử), 2 thẻ Hư cấu, đủ VI/EN", () => {
  assert.deepEqual(councilErrors(C), []);
  assert.equal(C.cards.filter((k) => k.historical).length, 1);
  assert.equal(C.cards.find((k) => k.historical).label, "Chính sử");
});
t("kiểm dữ liệu bắt lỗi: hai thẻ lịch sử, thẻ lộ \"người xưa\"", () => {
  const two = { ...C, cards: C.cards.map((k) => ({ ...k, historical: true, label: "Chính sử" })) };
  assert.ok(councilErrors(two).some((e) => e.includes("đúng 1")));
  const leak = { ...C, cards: [{ ...C.cards[0], text: { vi: "Cách người xưa đã làm", en: "x" } }, C.cards[1], C.cards[2]] };
  assert.ok(councilErrors(leak).some((e) => e.includes("người xưa")));
});
t("xáo thẻ: hoán vị, xác định theo rng, thẻ lịch sử đứng được ở cả 3 vị trí", () => {
  const pos = new Set();
  for (let s = 1; s < 40; s++) {
    const a = shuffleCards(C.cards, lcg(s));
    assert.deepEqual(a.map((k) => k.id).sort(), ["A", "B", "C"]);
    assert.deepEqual(a, shuffleCards(C.cards, lcg(s)));
    pos.add(a.findIndex((k) => k.historical));
  }
  assert.deepEqual([...pos].sort(), [0, 1, 2]);
  assert.deepEqual(C.cards.map((k) => k.id), ["A", "B", "C"]);           // không đổi dữ liệu gốc
});
t("kết quả: {picked, historical}", () => {
  assert.deepEqual(councilResult(C, "A"), { picked: "A", historical: true });
  assert.deepEqual(councilResult(C, "C"), { picked: "C", historical: false });
  assert.throws(() => councilResult(C, "Z"));
});
t("comic sau Hiến kế: D1 nhận lời đáp của kế đã chọn (Hư cấu) và lệnh Chủ soái quyết (Chính sử); COMIC_B20 giữ nguyên", () => {
  for (const id of ["A", "B", "C"]) {
    const card = C.cards.find((k) => k.id === id), c = applyCouncil(COMIC_B20, id);
    const [reply, decree] = c.panels.D1.bubbles;
    assert.equal(reply.vi, card.reply.vi); assert.equal(reply.en, card.reply.en); assert.equal(reply.label, "Hư cấu");
    assert.equal(decree.vi, C.decree.vi); assert.equal(decree.label, "Chính sử");
    assert.ok(c.panels.D1.bubbles.every((b) => !("from" in b)));
    assert.equal(c.panels.O1, COMIC_B20.panels.O1);
  }
  assert.ok(COMIC_B20.panels.D1.bubbles.every((b) => b.from && !b.vi));
  assert.equal(councilSpeaker(COMIC_B20), "Trần Hưng Đạo");
});

console.log("\nThẻ Sử quán B20 (12.11)");
const KEYS = ["chapterOpen", "battleStart", "bossMet", "firstWin", "firstQuiz", "keSach:nghiBinh", "keSach:kichCoc", "keSach:conNuoc"];
t("mỗi thẻ đúng một nhãn, có nguồn, thân, khóa mở hợp lệ, nhóm có trong CARD_GROUPS, khung có trong comic; review draft", () => {
  assert.ok(CARDS.length >= 8, `${CARDS.length} thẻ`);
  const groups = new Set(CARD_GROUPS.map((g) => g.id));
  for (const c of CARDS) {
    assert.equal(c.chapter, "B20", c.id); assert.equal(c.review, "draft", c.id);
    assert.ok(LABELS.includes(c.label), c.id);
    assert.ok(c.src.length && c.src.every((s) => typeof s === "string" && s.length > 8), `${c.id}: nguồn`);
    assert.ok(c.body.length && c.title && c.hint && KEYS.includes(c.unlock), c.id);
    assert.ok(groups.has(c.group), `${c.id}: nhóm ${c.group}`);
    for (const p of c.panels) assert.ok(COMIC_B20.panels[p], `${c.id}: khung ${p}`);
  }
  assert.equal(new Set(CARDS.map((c) => c.id)).size, CARDS.length);
});
t("đủ các thẻ hợp đồng: bãi cọc, con nước, Ô Mã Nhi, Phàn Tiếp, Hưng Đạo vương, Yết Kiêu (Tương truyền), Đỗ Hành, Nội Bàng", () => {
  for (const id of ["B20-baicoc", "B20-connuoc", "X20", "X24", "H31", "B20-dohanh", "B20-noibang"]) assert.ok(CARD_BY_ID[id], id);
  assert.equal(CARD_BY_ID.H38.label, "Tương truyền");
  for (const k of ["keSach:nghiBinh", "keSach:kichCoc", "keSach:conNuoc"]) assert.ok(CARDS.some((c) => c.unlock === k), k);
});

console.log("\nQuiz chương B20 (22.6)");
t("ngân hàng Quiz B20 qua lintQuiz với khung comic B20 và thẻ B20; 10–15 câu", () => {
  assert.deepEqual(lintQuiz(QUIZ_B20, { panels: COMIC_B20.panels, cards: CARD_BY_ID }), []);
  assert.ok(QUIZ_B20.length >= 10 && QUIZ_B20.length <= 15, `${QUIZ_B20.length} câu`);
});
t("4 câu của comic + câu mới; mọi câu có nhãn, nguồn, giải thích, chapter B20, review draft", () => {
  assert.deepEqual(QUIZ_B20.slice(0, 4).map((q) => q.panel), COMIC_B20.quiz.map((q) => q.panel));
  for (const q of QUIZ_B20) {
    assert.equal(q.chapter, "B20", q.id); assert.equal(q.review, "draft", q.id);
    assert.ok(LABELS.includes(q.label), q.id);
    assert.ok(Array.isArray(q.src) && q.src.length && q.src.every((s) => typeof s === "string" && s.length > 8), `${q.id}: nguồn`);
    assert.ok(q.why.vi.length > 20, q.id);
  }
  const types = new Set(QUIZ_B20.map((q) => q.type));
  for (const ty of ["mcq4", "truefalse", "timeline", "whoSaid"]) assert.ok(types.has(ty), ty);
});
t("đúng/sai giữ thứ tự Đúng, Sai", () => {
  for (const q of QUIZ_B20.filter((x) => x.type === "truefalse")) assert.deepEqual(optionOrder(q, lcg(3)), [0, 1]);
});

console.log("\nLuật nhạy cảm (canon B20.sensitivity)");
const texts = () => [
  ...CARDS.flatMap((c) => [c.title, c.hint, ...c.body]),
  ...QUIZ_B20.flatMap((q) => [q.q.vi, q.why.vi, ...q.options]),
  ...C.cards.flatMap((k) => [k.text.vi, k.reply.vi]), C.decree.vi,
  ...Object.values(COMIC_B20.panels).flatMap((p) => [p.caption?.vi, ...(p.bubbles || []).map((b) => b.vi)]).filter(Boolean),
];
t("không \"Sát Thát\", không bè lửa / hỏa công, không trói hay quỳ tướng bị bắt", () => {
  for (const s of texts()) {
    assert.ok(!/sát thát/i.test(s), s);
    assert.ok(!/bè lửa|hỏa công|hoả công/i.test(s), s);
    assert.ok(!/bị trói|trói ô mã nhi|quỳ gối|quỳ lạy/i.test(s), s);
  }
});
t("\"Đức Thánh Trần\" chỉ ở mục Hậu thế tôn vinh của thẻ Sử quán", () => {
  const hits = texts().filter((s) => /Đức Thánh Trần/.test(s));
  assert.ok(hits.length === 1 && hits[0].startsWith("Hậu thế tôn vinh"), hits.join(" | "));
});
t("cái chết của Ô Mã Nhi (1289) và A Bát Xích chỉ ở thẻ Sử quán, có nguồn", () => {
  const death = /chết đuối|mà chết/;
  for (const q of QUIZ_B20) assert.ok(!death.test(q.q.vi) && !q.options.some((o) => death.test(o)), q.id);
  const cards = CARDS.filter((c) => c.body.some((b) => death.test(b))).map((c) => c.id).sort();
  assert.deepEqual(cards, ["B20-noibang", "X20"]);
  for (const id of cards) assert.ok(CARD_BY_ID[id].src.length >= 2, id);
});

console.log(`\n${pass} đạt, ${fail} trượt`);
process.exit(fail ? 1 : 0);
