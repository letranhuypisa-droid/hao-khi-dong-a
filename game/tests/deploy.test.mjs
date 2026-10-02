// tests/deploy.test.mjs — thư mục deploy Netlify (đợt 11b): bộ dựng chỉ chép phần game chạy cần, bộ kiểm bắt tên file sai hoa/thường hoặc thiếu
// (Netlify chạy Linux, phân biệt hoa/thường; Windows thì không nên lỗi kiểu này chạy tốt ở máy rồi hỏng khi deploy), netlify.toml khớp với script.
// Chạy trong Node:  node hao-khi-viet/game/tests/deploy.test.mjs
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDeploy, checkDeploy, INCLUDE, EXCLUDE, OUT_DIR_NAME } from "../tools/build-netlify.mjs";

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log("  ok  " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + (e.stack || e.message)); }
}
const GAME = fileURLToPath(new URL("..", import.meta.url)), REPO = fileURLToPath(new URL("../..", import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), "hk-deploy-"));
process.on("exit", () => { try { rmSync(tmp, { recursive: true, force: true }); } catch (_) { /* thư mục tạm, bỏ qua */ } });

console.log("Bộ dựng thư mục deploy");
const OUT = join(tmp, "site");
const built = buildDeploy(GAME, OUT);
t("chỉ chép phần game chạy cần (index.html, css, js, assets, vendor) cộng tệp _redirects do bộ dựng viết", () => {
  assert.deepEqual(readdirSync(OUT).sort(), [...INCLUDE, "_redirects"].sort());
  assert.ok(built.files > 100 && built.bytes > 1e6, JSON.stringify(built));
});
t("_redirects: đường /game/ cũ chuyển 301 về gốc — nằm TRONG thư mục dựng nên dùng được cả khi Netlify tự xây lẫn khi kéo thả (kéo thả không đọc netlify.toml)", () => {
  const rules = readFileSync(join(OUT, "_redirects"), "utf8").split(/\r?\n/).map((l) => l.trim().split(/\s+/)).filter((r) => r[0] && !r[0].startsWith("#"));
  assert.deepEqual(rules, [["/game", "/", "301"], ["/game/*", "/:splat", "301"]]);
});
t("không kèm công cụ lập trình viên, kiểm thử, tài liệu, trang lab", () => {
  for (const f of EXCLUDE) assert.ok(!existsSync(join(OUT, f)), f);
  for (const f of ["tests", "tools", "README.md", "lab.html", "hud-lab.html", "lab-b20.html", "story-lab.html", "assets/SOURCES.md"]) assert.ok(!existsSync(join(OUT, f)), f);
});
t("vẫn giữ những gì game cần: main.js, three, giấy phép của three (MIT bắt giữ lại), nhạc, icon", () => {
  for (const f of ["js/main.js", "vendor/three/three.module.js", "vendor/three/three.core.js", "vendor/three/LICENSE", "assets/music/hub.m4a", "assets/icons/n.webp", "css/game.css"]) assert.ok(existsSync(join(OUT, f)), f);
});
t("mọi tệp trong EXCLUDE có thật ở game/ (khỏi ghi tên tệp đã đổi mà bộ lọc không còn tác dụng)", () => {
  for (const f of EXCLUDE) assert.ok(existsSync(join(GAME, f)), f + " không còn ở game/");
});
t("dựng lại vào thư mục đã có thì xóa cái cũ, không để tệp thừa", () => {
  const out2 = join(tmp, "site2"); buildDeploy(GAME, out2);
  writeStray(out2); const again = buildDeploy(GAME, out2);
  assert.ok(!existsSync(join(out2, "tep-thua.txt"))); assert.equal(again.files, built.files);
});
function writeStray(dir) { cpSync(join(GAME, "index.html"), join(dir, "tep-thua.txt")); }
t("từ chối khi thư mục đích trùng hoặc chứa thư mục nguồn (khỏi xóa nhầm game/ hay cả kho)", () => {
  assert.throws(() => buildDeploy(GAME, GAME), /trùng|chứa/);
  assert.throws(() => buildDeploy(GAME, REPO), /trùng|chứa/);
  assert.ok(existsSync(join(GAME, "index.html")) && existsSync(join(GAME, "js/main.js")));
});

console.log("\nBộ kiểm tên file (hoa/thường, thiếu)");
const ok = checkDeploy(OUT);
t("game thật qua bộ kiểm: không thiếu, không sai hoa/thường, và đã đối chiếu đủ loại", () => {
  assert.deepEqual(ok.problems, []);
  for (const k of ["import", "html", "css", "sfx", "music", "fx", "comic", "icon"]) assert.ok(ok.checked[k] > 0, k + " không được đối chiếu cái nào");
});
t("bắt tên file sai hoa/thường và file thiếu (đổi thử trên bản sao)", () => {
  const bad = join(tmp, "mut"); cpSync(OUT, bad, { recursive: true });
  const swap = (a, b) => { renameSync(join(bad, a), join(bad, a + ".tmp")); renameSync(join(bad, a + ".tmp"), join(bad, b)); };
  swap("js/battle/hud.js", "js/battle/Hud.js");                 // import "./hud.js" sẽ hỏng trên Linux
  swap("assets/fx/ring.webp", "assets/fx/Ring.webp");           // tên fx
  rmSync(join(bad, "assets/icons/ult.webp"));                   // icon thiếu
  rmSync(join(bad, "assets/comic/B15/O1.avif"));                // khung comic thiếu một định dạng
  const r = checkDeploy(bad), by = (e) => r.problems.filter((p) => p.error === e);
  assert.ok(by("SAI HOA/THƯỜNG").some((p) => p.path === "js/battle/hud.js" && p.alt === "js/battle/Hud.js"), JSON.stringify(r.problems));
  assert.ok(by("SAI HOA/THƯỜNG").some((p) => p.path === "assets/fx/ring.webp"), JSON.stringify(r.problems));
  assert.ok(by("THIẾU").some((p) => p.path === "assets/icons/ult.webp"), JSON.stringify(r.problems));
  assert.ok(by("THIẾU").some((p) => p.path === "assets/comic/B15/O1.avif"), JSON.stringify(r.problems));
  assert.ok(r.problems.every((p) => p.kind && p.from), "mỗi vấn đề nói rõ loại và nơi xin");
});
t("gốc site không có index.html thì báo ngay (đó chính là lỗi 'Page not found' ở gốc khi xuất bản cả kho)", () => {
  const bad = join(tmp, "mut2"); cpSync(OUT, bad, { recursive: true });
  rmSync(join(bad, "index.html"));
  const r = checkDeploy(bad);
  assert.ok(r.problems.some((p) => p.error === "THIẾU" && p.path === "index.html"), JSON.stringify(r.problems.slice(0, 3)));
});
t("trang xin css / js mà thiếu thì báo", () => {
  const bad = join(tmp, "mut3"); cpSync(OUT, bad, { recursive: true });
  rmSync(join(bad, "css/b20.css")); rmSync(join(bad, "vendor/three/three.core.js"));
  const r = checkDeploy(bad);
  assert.ok(r.problems.some((p) => p.path === "css/b20.css" && p.kind === "html"), JSON.stringify(r.problems.slice(0, 3)));
  assert.ok(r.problems.some((p) => p.path === "vendor/three/three.core.js" && p.kind === "import"), JSON.stringify(r.problems.slice(0, 3)));
});
t("một bảng tên không đọc được (đổi cách viết) thì bộ kiểm BÁO chứ không im lặng bỏ qua", () => {
  const bad = join(tmp, "mut4"); cpSync(OUT, bad, { recursive: true });
  writeFileSync(join(bad, "js/battle/audio.js"), "// đã viết lại, không còn bảng SFX_FILES\n");
  const r = checkDeploy(bad);
  assert.ok(r.problems.some((p) => p.error === "KHÔNG ĐỌC ĐƯỢC" && p.kind === "sfx"), JSON.stringify(r.problems.slice(0, 3)));
});

console.log("\nCấu hình Netlify khớp với script");
const toml = readFileSync(join(REPO, "netlify.toml"), "utf8");
t("netlify.toml: chạy đúng script dựng, xuất bản đúng thư mục script tạo ra", () => {
  assert.match(toml, /command\s*=\s*"node game\/tools\/build-netlify\.mjs"/);
  assert.match(toml, new RegExp('publish\\s*=\\s*"' + OUT_DIR_NAME + '"'));
});
t("netlify.toml không khai báo chuyển hướng (một nguồn duy nhất là _redirects trong thư mục dựng, khỏi hai nơi lệch nhau)", () => {
  assert.ok(!/\[\[redirects\]\]/.test(toml), "bỏ [[redirects]] khỏi netlify.toml: đã có _redirects");
});
t(".gitignore: thư mục deploy do script dựng không bị commit", () => {
  const gi = readFileSync(join(REPO, ".gitignore"), "utf8").split(/\r?\n/).map((l) => l.trim());
  assert.ok(gi.includes(OUT_DIR_NAME + "/"), gi.join("|"));
});

console.log("\n" + pass + " đạt, " + fail + " trượt");
process.exit(fail ? 1 : 0);
