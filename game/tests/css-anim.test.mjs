// tests/css-anim.test.mjs — hoạt ảnh CSS lặp vô hạn của HUD trận không bắt trình duyệt vẽ lại mỗi khung (đợt 19c). Hoạt ảnh chỉ đổi opacity /
// transform chạy trên compositor; đổi box-shadow, background, left… thì vẽ lại (left còn tính lại bố cục) mỗi khung suốt lúc chạy — nhắc khóa
// chuột, nhãn chỉ đường hiện gần như cả trận. Nhấp nháy sáng dùng lớp quầng vẽ sẵn (::after / ::before) đổi opacity (@keyframes glow).
// Hub (lobby.css): vệt sáng nút Xuất trận chạy bằng transform (nút mục "hot" của thanh bên còn đổi box-shadow — ảnh 48 px, chỉ ở sảnh).
// Thuần (đọc tệp CSS):
//   node game/tests/css-anim.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const css = (f) => readFileSync(join(here, "../css", f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log("  ok  " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + (e.stack || e.message).split("\n").slice(0, 3).join("\n       ")); }
}

// @keyframes tên → các thuộc tính được đổi
function keyframes(src) {
  const out = {}, re = /@keyframes\s+([\w-]+)\s*\{/g;
  let m;
  while ((m = re.exec(src))) {
    let i = re.lastIndex, depth = 1;
    while (depth > 0 && i < src.length) { if (src[i] === "{") depth++; else if (src[i] === "}") depth--; i++; }
    const body = src.slice(re.lastIndex, i - 1), props = new Set();
    for (const d of body.matchAll(/([a-z-]+)\s*:/g)) props.add(d[1]);
    out[m[1]] = [...props];
  }
  return out;
}
// mọi khai báo animation lặp vô hạn: [bộ chọn, tên keyframes]
function infinite(src) {
  const out = [];
  for (const r of src.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    for (const d of r[2].matchAll(/animation(?:-name)?\s*:\s*([^;]+)/g)) for (const part of d[1].split(",")) {
      if (!/infinite/.test(part)) continue;
      const name = part.trim().split(/\s+/).find((w) => /^[a-z][\w-]*$/i.test(w) && !/^(infinite|alternate|linear|ease|ease-in|ease-out|ease-in-out|both|forwards|reverse)$/.test(w));
      out.push([r[1].trim(), name]);
    }
  }
  return out;
}
const OK = new Set(["opacity", "transform"]);

for (const f of ["game.css", "hud.css", "b20.css"]) {
  t(`${f}: hoạt ảnh lặp vô hạn chỉ đổi opacity / transform`, () => {
    const src = css(f), K = { ...keyframes(css("game.css")), ...keyframes(src) }, bad = [];
    for (const [sel, name] of infinite(src)) {
      const props = K[name];
      if (!props) { bad.push(`${sel}: không thấy @keyframes ${name}`); continue; }
      const rep = props.filter((p) => !OK.has(p));
      if (rep.length) bad.push(`${sel} → ${name} đổi ${rep.join(", ")}`);
    }
    assert.deepEqual(bad, []);
  });
}
t("lobby.css: vệt sáng nút Xuất trận (sheen) chạy bằng transform, không đổi left (tính lại bố cục mỗi khung)", () => assert.deepEqual(keyframes(css("lobby.css")).sheen, ["transform"]));
t("b20.css: không còn --pulse (nhấp nháy do JS ghi vào chuỗi HTML mỗi lần cập nhật)", () => assert.ok(!/--pulse/.test(css("b20.css"))));
t("game.css: lớp quầng nhấp nháy dùng @keyframes glow (opacity)", () => {
  assert.deepEqual(keyframes(css("game.css")).glow, ["opacity"]);
  for (const sel of [".hud-lockhint::after", ".wp-box::after", ".ks.sansang::after", ".hk-bar.ready::after"]) assert.ok(css("game.css").includes(sel), sel);
});

console.log(`\n${pass} đạt, ${fail} trượt`);
process.exit(fail ? 1 : 0);
