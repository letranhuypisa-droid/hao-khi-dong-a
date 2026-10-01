// tools/build-netlify.mjs — dựng thư mục deploy Netlify từ game/ rồi KIỂM nó trước khi đưa lên mạng (đợt 11b).
//
//   node game/tools/build-netlify.mjs                     dựng <gốc kho>/netlify-deploy rồi kiểm; netlify.toml gọi lệnh này mỗi lần Netlify xây
//   node game/tools/build-netlify.mjs --check <thư-mục>   chỉ kiểm một thư mục site có sẵn
//
// Vì sao có: Netlify xuất bản đúng thư mục `publish`. Trước đợt 11b kho không có netlify.toml nên Netlify xuất bản CẢ KHO: gốc site trống
// (index.html nằm trong game/ nên "/" báo "Page not found"), và design/, comic/, game/tests, game/tools công khai dù kho GitHub riêng tư.
// Giờ chỉ phần game chạy cần được xuất bản, ở GỐC site.
//
// Bộ kiểm: Netlify chạy Linux (phân biệt hoa/thường), Windows thì không — "./Hud.js" gọi "hud.js" chạy tốt ở máy rồi hỏng khi deploy. Nên mọi tên
// tệp game xin được đối chiếu CHÍNH XÁC từng chữ: mọi import tương đối, tệp trong index.html và url() của css, SFX / nhạc / fx theo bảng tên trong
// code, khung comic (webp + avif) của từng Chương, icon theo bảng dữ liệu. Bộ kiểm đọc chữ trong mã (không nạp module) nên không phụ thuộc phiên bản
// Node; bảng tên nào không đọc được thì BÁO chứ không im lặng bỏ qua. Lỗi thì thoát mã 1: Netlify giữ nguyên bản đang chạy.
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const GAME = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const OUT_DIR_NAME = "netlify-deploy";                     // phải khớp `publish` trong netlify.toml (tests/deploy.test.mjs kiểm)
export const INCLUDE = ["index.html", "css", "js", "assets", "vendor"];   // chạy game cần đúng bấy nhiêu
// Công cụ của lập trình viên, không thuộc màn chơi (trang lab và script riêng của chúng, ghi nguồn tài nguyên)
export const EXCLUDE = ["assets/SOURCES.md", "js/lab.js", "js/hud-lab.js", "js/lab-b20.js", "js/story-lab.js"];

const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const posix = (root, p) => relative(root, p).split(sep).join("/");

// ---- dựng ------------------------------------------------------------------------------------------------------------------------
export function buildDeploy(src = GAME, out = resolve(GAME, "..", OUT_DIR_NAME)) {
  const from = resolve(src), to = resolve(out);
  if (from === to || from.startsWith(to + sep)) throw new Error(`thư mục đích ${to} trùng hoặc chứa thư mục nguồn ${from}: từ chối (sẽ xóa mất nguồn)`);
  if (existsSync(to)) rmSync(to, { recursive: true, force: true });
  mkdirSync(to, { recursive: true });
  const skip = new Set(EXCLUDE);
  for (const name of INCLUDE) cpSync(join(from, name), join(to, name), { recursive: true, filter: (p) => !skip.has(posix(from, p)) });
  const files = walk(to);
  return { out: to, files: files.length, bytes: files.reduce((s, f) => s + statSync(f).size, 0) };
}

// ---- kiểm ------------------------------------------------------------------------------------------------------------------------
const IMPORT = /(?:import|export)\s[^;'"]*?from\s*["'](\.{1,2}\/[^"']+)["']|import\(\s*["'](\.{1,2}\/[^"']+)["']\s*\)|(?:^|\n)\s*import\s+["'](\.{1,2}\/[^"']+)["']/g;
const joinRel = (fromFile, spec) => {
  const out = [];
  for (const s of (dirname(fromFile) === "." ? [] : dirname(fromFile).split("/")).concat(spec.split("/"))) { if (s === "." || s === "") continue; if (s === "..") out.pop(); else out.push(s); }
  return out.join("/");
};

// root: thư mục site (chứa index.html). Trả { files, checked: { loại: số đã đối chiếu }, problems: [{ error, kind, path, alt?, from }] }.
export function checkDeploy(root) {
  const R = resolve(root), files = walk(R).map((p) => posix(R, p));
  const exact = new Set(files), lower = new Map(files.map((f) => [f.toLowerCase(), f]));
  const problems = [], checked = { import: 0, html: 0, css: 0, sfx: 0, music: 0, fx: 0, comic: 0, icon: 0 };
  const need = (rel, kind, from) => {
    checked[kind]++;
    const path = rel.replace(/^\.\//, "").replace(/\/+/g, "/");
    if (exact.has(path)) return;
    const alt = lower.get(path.toLowerCase());
    problems.push(alt ? { error: "SAI HOA/THƯỜNG", kind, path, alt, from } : { error: "THIẾU", kind, path, from });
  };
  const unreadable = (kind, from, why) => problems.push({ error: "KHÔNG ĐỌC ĐƯỢC", kind, path: from, from: "bộ kiểm: " + why });
  const read = (rel) => (exact.has(rel) ? readFileSync(join(R, rel), "utf8") : null);
  const js = files.filter((f) => f.startsWith("js/") && f.endsWith(".js")), jsSrc = new Map(js.map((f) => [f, read(f)]));

  // 1) trang gốc, css, mọi import tương đối trong js/
  need("index.html", "html", "gốc site");
  const html = read("index.html") || "";
  for (const m of html.matchAll(/(?:src|href)="(\.\/[^"]+)"/g)) need(m[1], "html", "index.html");
  for (const m of html.matchAll(/"[A-Za-z0-9_-]+":\s*"(\.\/[^"]+)"/g)) need(m[1], "html", "index.html importmap");
  for (const f of files.filter((x) => x.endsWith(".css"))) for (const m of read(f).matchAll(/url\(\s*["']?(?!data:|https?:)([^)"']+)["']?\s*\)/g)) need(joinRel(f, m[1]), "css", f);
  // cả vendor/ (three.module.js import ./three.core.js: thiếu là game không chạy)
  for (const f of files.filter((x) => x.endsWith(".js") && (x.startsWith("js/") || x.startsWith("vendor/")))) {
    const src = jsSrc.get(f) ?? read(f); let m; IMPORT.lastIndex = 0;
    while ((m = IMPORT.exec(src))) need(joinRel(f, m[1] || m[2] || m[3]), "import", f);
  }

  // 2) âm thanh: bảng SFX_FILES / EXT / LOOPS trong audio.js, nhạc trong music.js
  const evalObj = (src, re) => { const m = re.exec(src || ""); return m ? Function("return (" + m[1] + ")")() : null; };
  const audio = jsSrc.get("js/battle/audio.js"), sfx = evalObj(audio, /export const SFX_FILES = (\{[^}]*\})/), ext = evalObj(audio, /const EXT = (\{[^}]*\})/), loops = evalObj(audio, /const LOOPS = (\{[^}]*\})/);
  if (!sfx || !ext || !loops) unreadable("sfx", "js/battle/audio.js", "không thấy bảng SFX_FILES / EXT / LOOPS");
  else {
    for (const [n, k] of Object.entries(sfx)) for (let v = 1; v <= k; v++) need(`assets/sfx/${n}${k > 1 ? "-" + v : ""}.${ext[n] || "wav"}`, "sfx", "audio.js SFX_FILES");
    for (const f of Object.values(loops)) need(`assets/sfx/${f}`, "sfx", "audio.js LOOPS");
  }
  const tracks = [...(jsSrc.get("js/core/music.js") || "").matchAll(/\.\/assets\/music\/([A-Za-z0-9_-]+\.m4a)/g)];
  if (!tracks.length) unreadable("music", "js/core/music.js", "không thấy đường dẫn nhạc ./assets/music/…"); else for (const m of tracks) need(`assets/music/${m[1]}`, "music", "music.js");

  // 3) fx (danh sách nạp sẵn + tex("tên") rải trong mã), khung comic của từng Chương (dữ liệu JSON thuần sau "export const X = ")
  const fxNames = new Set(), pre = /preloadFx\(\)\s*\{\s*for \(const n of (\[[^\]]*\])/.exec(jsSrc.get("js/battle/fx.js") || "");
  if (pre) for (const n of JSON.parse(pre[1])) fxNames.add(n);
  for (const src of jsSrc.values()) for (const m of src.matchAll(/\btex\("([A-Za-z0-9_-]+)"\)/g)) fxNames.add(m[1]);
  if (!fxNames.size) unreadable("fx", "js/battle/fx.js", "không thấy danh sách preloadFx"); else for (const n of fxNames) need(`assets/fx/${n}.webp`, "fx", "fx.js");
  const comics = js.filter((f) => /^js\/data\/comic-[a-z0-9]+\.js$/.test(f));
  if (!comics.length) unreadable("comic", "js/data/comic-*.js", "không có dữ liệu comic");
  for (const f of comics) {
    let C; try { const s = jsSrc.get(f); C = JSON.parse(s.slice(s.indexOf("{"), s.lastIndexOf("}") + 1)); } catch (e) { unreadable("comic", f, "không phải JSON thuần: " + e.message.slice(0, 60)); continue; }
    for (const id of Object.keys(C.panels || {})) { need(`assets/comic/${C.chapter.id}/${id}.webp`, "comic", f); need(`assets/comic/${C.chapter.id}/${id}.avif`, "comic", f); }
  }

  // 4) icon: icon: "x", ICON("x"), icons: ["a", "b"], nút cảm ứng tb("nút", "x")
  const icons = new Map(), add = (name, from) => { if (!icons.has(name)) icons.set(name, from); };
  for (const [f, src] of jsSrc) {
    for (const m of src.matchAll(/\bicon:\s*"([a-z0-9]+)"/g)) add(m[1], f);
    for (const m of src.matchAll(/\bICON\("([a-z0-9]+)"\)/g)) add(m[1], f);
    for (const m of src.matchAll(/\bicons:\s*\[([^\]]*)\]/g)) for (const q of m[1].matchAll(/"([a-z0-9]+)"/g)) add(q[1], f);
    for (const m of src.matchAll(/\btb\("[A-Za-z0-9]+",\s*"([a-z0-9]+)"/g)) add(m[1], f);
  }
  for (const [name, from] of icons) need(`assets/icons/${name}.webp`, "icon", from);
  return { files: files.length, checked, problems };
}

// ---- dòng lệnh -------------------------------------------------------------------------------------------------------------------
function main() {
  const args = process.argv.slice(2), ci = args.indexOf("--check");
  let root;
  if (ci >= 0) root = resolve(args[ci + 1] || OUT_DIR_NAME);
  else { const b = buildDeploy(); root = b.out; console.log(`Đã dựng ${root}\n  ${b.files} tệp, ${(b.bytes / 1048576).toFixed(1)} MB`); }
  const r = checkDeploy(root);
  console.log(`Đã kiểm ${r.files} tệp; đối chiếu: ` + Object.entries(r.checked).map(([k, v]) => `${k}=${v}`).join(" "));
  if (r.problems.length) {
    console.error(`\n${r.problems.length} VẤN ĐỀ (không đưa lên mạng):`);
    for (const p of r.problems) console.error(`  ${p.error} [${p.kind}] ${p.path}${p.alt ? "  ≠  " + p.alt : ""}  (xin từ ${p.from})`);
    process.exit(1);
  }
  console.log("Không có tên thiếu hoặc sai hoa/thường.");
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) main();
