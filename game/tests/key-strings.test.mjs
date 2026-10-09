// tests/key-strings.test.mjs — chữ hiển thị cho người chơi không được gõ cứng tên phím ("(R)", "bấm F", "Giữ Tab"…): phải viết {tpc}, {Act:cmd}…
// để data/controls.js đổi theo thiết bị (bàn phím, cảm ứng, tay cầm). Quét nội dung các chuỗi trong game/js (bỏ chú thích và mã). Chạy trong Node:
//   node hao-khi-viet/game/tests/key-strings.test.mjs
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log("  ok  " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + (e.stack || e.message)); }
}

const ROOT = fileURLToPath(new URL("../js", import.meta.url));
// Công cụ phát triển, không phải màn chơi; bảng nhãn phím chính nó; sân thử B20 (?sandbox) ghi phím X cứng — sân thử của lập trình viên.
const SKIP = new Set(["debug.js", "lab.js", "lab-b20.js", "hud-lab.js", "story-lab.js", "data/controls.js", "battles/b20.js"]);

const walk = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : p.endsWith(".js") ? [p] : []; });

const NL = String.fromCharCode(10), BS = String.fromCharCode(92), BQ = String.fromCharCode(96);

// Lấy nội dung các chuỗi (nháy đơn, nháy kép, và phần chữ của mẫu có ${…}), bỏ chú thích và regex literal (regex như /[&<>"]/ chứa dấu nháy).
function strings(src) {
  const out = []; let i = 0, line = 1, prev = "";            // prev: ký tự mã khác khoảng trắng gần nhất (nhận ra "/" mở regex)
  const stack = [];                                          // ngăn xếp mẫu: đếm ngoặc nhọn trong ${…}
  // Đọc một chuỗi từ vị trí i. cont: đang đọc tiếp phần chữ của mẫu sau khi đóng một ${…} (không có dấu mở). Trả về false khi gặp ${
  // (ra khỏi chuỗi để quét mã bên trong), true khi chuỗi kết thúc.
  const readStr = (q, cont = false) => {
    let s = "", start = line; if (!cont) i++;
    for (; i < src.length; i++) {
      const c = src[i];
      if (c === NL) line++;
      if (c === BS) { s += src[i + 1] ?? ""; i++; continue; }
      if (q === BQ && c === "$" && src[i + 1] === "{") { out.push({ s, line: start }); stack.push(1); i += 2; return false; }
      if (c === q) { out.push({ s, line: start }); i++; return true; }
      s += c;
    }
    return true;
  };
  while (i < src.length) {
    const c = src[i];
    if (c === NL) { line++; i++; continue; }
    if (c === "/" && src[i + 1] === "/") { while (i < src.length && src[i] !== NL) i++; continue; }
    if (c === "/" && src[i + 1] !== "*" && src[i + 1] !== "/" && (prev === "" || "(,=:[!&|?{};".includes(prev))) {      // regex literal: bỏ tới "/" đóng, bỏ qua [...] và \\x
      i++; let cls = false;
      for (; i < src.length; i++) { const r = src[i]; if (r === BS) i++; else if (r === "[") cls = true; else if (r === "]") cls = false; else if (r === "/" && !cls) break; else if (r === NL) break; }
      i++; while (/[a-z]/.test(src[i] ?? "")) i++; prev = "/"; continue;
    }
    if (c === "/" && src[i + 1] === "*") { i += 2; while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) { if (src[i] === NL) line++; i++; } i += 2; continue; }
    if (stack.length) {
      if (c === "{") stack[stack.length - 1]++;
      else if (c === "}" && --stack[stack.length - 1] === 0) { stack.pop(); i++; readStr(BQ, true); continue; }
    }
    if (c === "'" || c === '"' || c === BQ) { readStr(c); prev = "\""; continue; }
    if (c !== " " && c !== "\t" && c !== "\r") prev = c;
    i++;
  }
  return out;
}

// phím vật lý gán trong game; N và C là tên hai nút đánh nên được viết trong câu mô tả đòn ("giữ C để tụ lực")
const KEY = "(?:Tab|[EFGKQRTXZ])";
const BAD = [
  [new RegExp("(?<![\\wÀ-ỹ])\\(" + KEY + "\\)"), 'tên phím trong ngoặc, vd "(R)" (không tính E(R), S(R): công thức)'],
  [new RegExp("\\b(?:bấm|Bấm|BẤM|giữ|Giữ|GIỮ|nhấn|Nhấn) " + KEY + "(?![\\wÀ-ỹ])"), 'động từ + tên phím, vd "bấm F", "Giữ Tab"'],
  [new RegExp("\\s·\\s" + KEY + "$"), 'tên phím ở cuối băng chữ, vd "· F"'],
  [/<kbd>(?![NC]<)[A-Za-z]<\/kbd>/, "<kbd> một chữ cái (N, C là tên hai nút đánh nên được phép)"],
];

console.log("Chữ phím trong chuỗi hiển thị");
t("bộ quét hiểu chuỗi, bỏ chú thích và mã (kiểm chính nó)", () => {
  const src = ['const a = "Bấm F"; // Giữ Tab', "const b = " + BQ + "x ${f(" + '"y (R)"' + ")} z (G)" + BQ + "; /* (T) */ const c = 'ok';", "R(F) + T(R);"].join(NL);
  assert.deepEqual(strings(src).map((x) => x.s), ["Bấm F", "x ", "y (R)", " z (G)", "ok"]);
});
t("bộ quét bắt đúng kiểu chữ phím cứng và bỏ qua chữ thường gặp", () => {
  const hit = (s) => BAD.some(([re]) => re.test(s));
  for (const s of ["Tuyệt Kỹ đầu tiên (R) là", "bấm F", "Giữ Tab để", "SẴN SÀNG · G", "<kbd>F</kbd>", "Lệnh Kế Sách (G) khi"]) assert.ok(hit(s), s);
  for (const s of ["Giữ Tương tác 3 s", "giữ C để tụ lực", "bấm N liên tiếp", "Giữ Shift", "Mặt trận A (bến trên)", "bấm Lệnh Kế Sách", "binh khí E(R), cấp S(R)", "<kbd>N</kbd> = <kbd>C</kbd>"]) assert.ok(!hit(s), s);
});
t("không còn tên phím gõ cứng trong chuỗi của game/js", () => {
  const found = [];
  for (const f of walk(ROOT)) {
    const rel = relative(ROOT, f).split(sep).join("/");
    if (SKIP.has(rel)) continue;
    for (const { s, line } of strings(readFileSync(f, "utf8"))) {
      for (const [re, why] of BAD) if (re.test(s)) found.push(rel + ":" + line + " — " + why + ': "' + s.slice(0, 90) + '"');
    }
  }
  assert.deepEqual(found, [], "dùng {tpc}, {kesach}, {Act:cmd}… (data/controls.js) thay vì gõ tên phím:\n  " + found.join("\n  "));
});

console.log("\n" + pass + " đạt, " + fail + " trượt");
process.exit(fail ? 1 : 0);
