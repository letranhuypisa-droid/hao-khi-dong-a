// tests/b17-content.test.mjs — nội dung chữ Chương B17 Tây Kết (đợt A3): thẻ Sử quán, Quiz chương, luật nhạy cảm của canon (B17.sensitivity,
// X19.dignity, H30.notes). Phần chữ trong trận chỉ ĐỌC các tệp trận (data/battle-b17.js, battle/director-b17.js, battles/b17.js, sim/b17.js,
// data/comic-b17.js): lấy mọi chuỗi ký tự trong mã (bỏ chú thích) rồi soát từ cấm.
//   node game/tests/b17-content.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CARDS, CARD_BY_ID, QUIZ_B17 } from "../js/data/suquan-b17.js";
import { CARD_GROUPS, CARDS as CARDS_B15 } from "../js/data/suquan-b15.js";
import { CARDS as CARDS_B16 } from "../js/data/suquan-b16.js";
import { CARDS as CARDS_B20 } from "../js/data/suquan-b20.js";
import { COMIC_B17 } from "../js/data/comic-b17.js";
import * as D from "../js/data/battle-b17.js";
import { lintQuiz, optionOrder, battleUnlockKeys } from "../js/meta/chapter.js";

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log("  ok  " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + e.message); }
}
const LABELS = ["Chính sử", "Tương truyền", "Hư cấu"];
const src = (f) => readFileSync(new URL("../js/" + f, import.meta.url), "utf8");

// Chuỗi ký tự trong một tệp JS: '…', "…", `…` (phần chữ của template, biểu thức ${…} lexer đệ quy), bỏ chú thích // và /* */, bỏ qua regex
// literal (đoán theo ký tự có nghĩa đứng trước dấu /). Đủ cho mã của game (không cần trình phân tích JS đầy đủ).
export function stringsIn(code) {
  const out = [];
  let i = 0, prev = "";
  const REGEX_BEFORE = "(,=:[!&|?{};+-*%<>~^";
  function lex(stopAtBrace) {
    let depth = 0;
    while (i < code.length) {
      const c = code[i], n = code[i + 1];
      if (c === "/" && n === "/") { while (i < code.length && code[i] !== "\n") i++; continue; }
      if (c === "/" && n === "*") { i = code.indexOf("*/", i + 2); i = i < 0 ? code.length : i + 2; continue; }
      if (c === "'" || c === '"') {
        let s = ""; i++;
        while (i < code.length && code[i] !== c) { if (code[i] === "\\") { s += code[i + 1]; i += 2; } else s += code[i++]; }
        i++; out.push(s); prev = "a"; continue;
      }
      if (c === "`") {
        let s = ""; i++;
        while (i < code.length && code[i] !== "`") {
          if (code[i] === "\\") { s += code[i + 1]; i += 2; }
          else if (code[i] === "$" && code[i + 1] === "{") { i += 2; s += "…"; lex(true); }
          else s += code[i++];
        }
        i++; out.push(s); prev = "a"; continue;
      }
      if (c === "/" && (prev === "" || REGEX_BEFORE.includes(prev) || /(return|typeof|case)$/.test(code.slice(Math.max(0, i - 8), i).trimEnd()))) {
        i++; let cls = false;
        while (i < code.length && (code[i] !== "/" || cls)) { if (code[i] === "\\") i++; else if (code[i] === "[") cls = true; else if (code[i] === "]") cls = false; i++; }
        i++; while (/[a-z]/i.test(code[i] || "")) i++;
        prev = "a"; continue;
      }
      if (stopAtBrace) {
        if (c === "{") depth++;
        if (c === "}") { if (depth === 0) { i++; return; } depth--; }
      }
      if (!/\s/.test(c)) prev = c;
      i++;
    }
  }
  lex(false);
  return out;
}

// mọi chuỗi trong một giá trị dữ liệu (đi sâu vào mảng, đối tượng)
const deep = (v, out = []) => {
  if (typeof v === "string") out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => deep(x, out));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => deep(x, out));
  return out;
};

const cardTexts = () => CARDS.flatMap((c) => [c.title, c.hint, ...c.body]);
const quizTexts = () => QUIZ_B17.flatMap((q) => [q.q.vi, q.why.vi, ...q.options]);
// chữ hiện trong trận: dữ liệu trận (PHASES, tip, HISTORY_NOTES, KE_SACH, BOSS_B17…), chuỗi trong mã đạo diễn / định nghĩa trận / luật, comic Chương
const battleTexts = () => [
  ...deep(Object.values(D)),
  ...["battle/director-b17.js", "battles/b17.js", "sim/b17.js"].flatMap((f) => stringsIn(src(f))),
  ...deep(COMIC_B17.panels),
];

console.log("Thẻ Sử quán B17 (12.11)");
t("ít nhất 8 thẻ; chương B17, nhóm hợp lệ, nhãn hợp lệ, review draft, panels rỗng, có nguồn", () => {
  assert.ok(CARDS.length >= 8, `${CARDS.length} thẻ`);
  const groups = new Set(CARD_GROUPS.map((g) => g.id));
  for (const c of CARDS) {
    assert.equal(c.chapter, "B17", c.id); assert.equal(c.review, "draft", c.id);
    assert.ok(LABELS.includes(c.label), c.id + " " + c.label); assert.ok(groups.has(c.group), c.id + " " + c.group);
    assert.deepEqual(c.panels, [], c.id);
    assert.ok(c.title && c.hint && c.body.length >= 2 && c.body.every((b) => typeof b === "string" && b.length > 20), c.id);
    assert.ok(c.src.length && c.src.every((s) => typeof s === "string" && s.length > 8), c.id + " nguồn");
  }
  assert.equal(Object.keys(CARD_BY_ID).length, CARDS.length);
});
t("id thẻ B17 không trùng thẻ Chương khác (save.cards dùng chung một bảng id)", () => {
  const ids = new Set([...CARDS_B15, ...CARDS_B16, ...CARDS_B20].map((c) => c.id));
  for (const c of CARDS) assert.ok(!ids.has(c.id), c.id);
});
t("khóa mở hợp lệ (chapterOpen, battleStart, bossMet, keSach:<Kế Sách>, firstWin, firstQuiz); Phục kích bãi lau có thẻ; mỗi khóa trận đều mở ít nhất một thẻ", () => {
  const keys = new Set(["chapterOpen", "battleStart", "bossMet", "firstWin", "firstQuiz", ...D.KS_ORDER.map((k) => "keSach:" + k)]);
  for (const c of CARDS) assert.ok(keys.has(c.unlock), c.id + " " + c.unlock);
  assert.ok(CARDS.some((c) => c.unlock === "keSach:phucKich"));
  for (const k of ["chapterOpen", "battleStart", "bossMet", "firstWin", "firstQuiz"]) assert.ok(CARDS.some((c) => c.unlock === k), k);
  // B17 theo luật B20: thẻ Kế Sách chỉ mở khi thành công
  assert.ok(battleUnlockKeys({ battle: "B17", won: true, bossMet: true, keSachList: [{ id: "phucKich", state: "thanhcong" }] }).includes("keSach:phucKich"));
});
t("đủ đề tài của kế hoạch A3: Tây Kết, Toa Đô (sử Nguyên, Tương Mẫn), áo ngự, Nguyễn Khoái + Thánh Dực, Hưng Đạo vương, Ô Mã Nhi, Yết Kiêu + Dã Tượng, ai giết Toa Đô, hỏi kế 1287", () => {
  const has = (id, ...words) => { const c = CARD_BY_ID[id]; assert.ok(c, id); const s = c.body.join(" "); for (const w of words) assert.ok(s.includes(w), `${id}: ${w}`); return c; };
  has("B17-tran", "Tây Kết", "Toa Đô", "Hư cấu");
  has("X19-b17", "Sử nhà Nguyên chép ông tử trận trong lúc rút quân", "Tương Mẫn");
  has("B17-aongu", "áo ngự", "khâm liệm");
  has("H40", "Thánh Dực", "không ghi");
  has("H31-b17", "tài liệu hiện đại");
  has("X20-b17", "vượt biển");
  assert.equal(has("B17-giatuong", "Yết Kiêu", "Dã Tượng").label, "Tương truyền");
  has("B17-aigiet", "sử không ghi", "không gán công");
  const hk = has("B17-hoike", "1287", "Hư cấu về bối cảnh"); assert.equal(hk.label, "Hư cấu");
});

console.log("\nQuiz chương B17 (22.6)");
t("qua lintQuiz với thẻ B17 (không comic); 10–15 câu", () => {
  assert.deepEqual(lintQuiz(QUIZ_B17, { panels: {}, cards: CARD_BY_ID }), []);
  assert.ok(QUIZ_B17.length >= 10 && QUIZ_B17.length <= 15, `${QUIZ_B17.length} câu`);
});
t("mọi câu: chapter B17, review draft, nhãn, nguồn, giải thích, seenRef chỉ là thẻ B17, không gắn khung; đủ 4 dạng câu", () => {
  for (const q of QUIZ_B17) {
    assert.equal(q.chapter, "B17", q.id); assert.equal(q.review, "draft", q.id); assert.equal(q.panel, null, q.id);
    assert.ok(LABELS.includes(q.label), q.id);
    assert.ok(Array.isArray(q.src) && q.src.length && q.src.every((s) => typeof s === "string" && s.length > 8), `${q.id}: nguồn`);
    assert.ok(q.why.vi.length > 20, q.id);
    assert.ok(q.seenRef.length && q.seenRef.every((r) => r.startsWith("card:") && CARD_BY_ID[r.slice(5)]), q.id);
  }
  const types = new Set(QUIZ_B17.map((q) => q.type));
  for (const ty of ["mcq4", "truefalse", "timeline", "whoSaid"]) assert.ok(types.has(ty), ty);
});
t("đúng/sai giữ thứ tự Đúng, Sai", () => {
  for (const q of QUIZ_B17.filter((x) => x.type === "truefalse")) assert.deepEqual(optionOrder(q, Math.random), [0, 1]);
});

console.log("\nLuật nhạy cảm (canon B17.sensitivity, X19.dignity, H30.notes)");
const BEHEAD = /thủ cấp|chém đầu|bêu đầu|đầu lâu/i;
const SLUR = /(^|[^\p{L}])thát(?![\p{L}])/iu;           // chữ "Thát" (Thát Đát, khẩu hiệu thích trên tay 1285); "thất", "thoát" không khớp
t("bộ lấy chuỗi trong mã: có chữ trong trận, không lấy chú thích (chú thích được nhắc luật; chỉ chuỗi hiện ra mới bị soát)", () => {
  const s = stringsIn("// thủ cấp\nconst a = 'x' /* chém đầu */ + \"y\"; f(`TOA ĐÔ ${n > 1 ? `A${k}` : \"B\"} Z`, /'\"/g, 4 / 2);");
  assert.deepEqual(s, ["x", "y", "A…", "B", "TOA ĐÔ … Z"]);
  const dir = stringsIn(src("battle/director-b17.js"));
  assert.ok(dir.length > 40 && dir.some((x) => x.includes("Toa Đô")), dir.length);
});
t("chữ trong trận (dữ liệu trận, đạo diễn, định nghĩa trận, luật, comic) không có cảnh chém đầu, \"thủ cấp\"", () => {
  const all = battleTexts();
  assert.ok(all.length > 60, `${all.length} chuỗi`);
  for (const s of all) assert.ok(!BEHEAD.test(s), s);
});
t("khẩu hiệu thích trên tay năm 1285 (chứa từ miệt thị): không ở chữ trong trận, không ở Quiz; ở Sử quán chỉ một thẻ, kèm giải nghĩa trung tính", () => {
  for (const s of battleTexts()) assert.ok(!SLUR.test(s), s);
  for (const s of quizTexts()) assert.ok(!SLUR.test(s), s);
  const hits = CARDS.filter((c) => [c.title, c.hint, ...c.body].some((s) => SLUR.test(s)));
  assert.deepEqual(hits.map((c) => c.id), ["B17-thichchu"]);
  const c = hits[0];
  assert.equal(c.label, "Chính sử"); assert.equal(c.group, "benle");
  assert.ok(!SLUR.test(c.title) && !SLUR.test(c.hint), "không đặt lên tiêu đề, gợi ý");
  assert.ok(c.body.some((b) => /khinh miệt|miệt thị/.test(b)) && c.body.some((b) => /không dùng .*khẩu hiệu/.test(b)), "giải nghĩa + không làm khẩu hiệu");
  assert.ok(!QUIZ_B17.some((q) => q.seenRef.includes("card:" + c.id)), "không câu Quiz nào dựa vào thẻ này");
});
t("thẻ, Quiz B17 cũng không \"thủ cấp\", không cảnh chém đầu", () => {
  for (const s of [...cardTexts(), ...quizTexts()]) assert.ok(!BEHEAD.test(s), s);
});
t("không gán công giết Toa Đô cho ai: câu nào nêu tên người cùng việc giết Toa Đô đều kèm lời phủ định", () => {
  const NAMES = /Nguyễn Khoái|Hưng Đạo|Trần Quốc Tuấn|Dã Tượng|Yết Kiêu|Nhân Tông|Quốc Toản|Quang Khải|Chiêu Thành/;
  const KILL = /(giết|bắn chết|bắn hạ|chém|hạ sát|hạ)( được)?( nguyên soái)? Toa Đô|Toa Đô (bị|do) .{0,30}(giết|bắn|chém)/i;
  const NEG = /không|chưa|chỉ chép chung/;
  for (const s of [...cardTexts(), ...quizTexts(), ...battleTexts()]) if (NAMES.test(s) && KILL.test(s)) assert.ok(NEG.test(s), s);
  // không có phương án Quiz nào là "người giết Toa Đô"
  for (const q of QUIZ_B17) assert.ok(!/giết Toa Đô|bắn chết Toa Đô/.test(q.q.vi) || q.type === "truefalse", q.id);
});
t("tướng địch có danh dự: thẻ và Quiz gọi \"quân Nguyên\", không \"giặc\", \"bọn\", \"lũ\"", () => {
  for (const s of [...cardTexts(), ...quizTexts()]) assert.ok(!/(^|[^\p{L}])(giặc|bọn|lũ)(?![\p{L}])/iu.test(s), s);
  assert.ok(CARD_BY_ID["B17-aongu"].body.some((b) => b.includes("danh dự")));
});

console.log(`\n${pass} đạt, ${fail} trượt`);
process.exit(fail ? 1 : 0);
