// render.mjs — sinh ảnh cho một chương comic bằng Higgsfield CLI, rồi dựng dữ liệu cho viewer.
//
//   node _tool/render.mjs B15-ham-tu --dry          # liệt kê việc sẽ làm, KHÔNG tiêu credit
//   node _tool/render.mjs B15-ham-tu --dump         # ghi <chương>/PROMPTS.md để sinh TAY trên app
//   node _tool/render.mjs B15-ham-tu                # sinh tờ nhân vật còn thiếu, rồi các khung còn thiếu
//   node _tool/render.mjs B15-ham-tu --only H3,H6   # chỉ vài khung (hoặc ref-TQT cho tờ nhân vật)
//   node _tool/render.mjs B15-ham-tu --data         # chỉ dựng lại comic-data.js (không gọi CLI)
//   (chạy từ thư mục hao-khi-viet/comic)
//
// Bố cục: _shared/bible.json = phong cách, trang phục, nhân vật DÙNG CHUNG mọi chương; _shared/refs/
// = tờ nhân vật dùng chung (Trần Hưng Đạo ở Hàm Tử và ở Bạch Đằng là CÙNG một tờ, nên cùng một mặt).
// <chương>/panels.json = khung, trang, quiz, hiến kế của riêng chương; có thể thêm "characters"
// cho nhân vật chỉ chương đó có.
//
// Thứ tự bắt buộc: tờ nhân vật TRƯỚC, khung SAU; khung có nhân vật gửi kèm tờ của nhân vật đó.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");       // hao-khi-viet/comic
const args = process.argv.slice(2);
const CH = args[0] && !args[0].startsWith("--") ? args[0].replace(/[\\/]+$/, "") : null;   // chương luôn là tham số đầu
if (!CH || !existsSync(join(ROOT, CH, "panels.json"))) {
  console.error("Cách dùng: node _tool/render.mjs <thư mục chương, ví dụ B15-ham-tu> [--dry|--dump|--data|--force|--only A,B]");
  process.exit(1);
}
const DIR = join(ROOT, CH);
const OUT = join(DIR, "renders");
const REFS = join(ROOT, "_shared", "refs");
const B = JSON.parse(readFileSync(join(ROOT, "_shared", "bible.json"), "utf8"));
const P = JSON.parse(readFileSync(join(DIR, "panels.json"), "utf8"));
const C = { ...B, ...P, costume: { ...B.costume, ...(P.costume || {}) }, characters: [...B.characters, ...(P.characters || [])] };
const has = (f) => args.includes(f);
const val = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const ONLY = (val("--only", "") || "").split(",").filter(Boolean);
const BIN = process.env.HIGGSFIELD_BIN || "higgsfield";

// ---- prompt ------------------------------------------------------------------------------
const CHAR = Object.fromEntries(C.characters.map((c) => [c.id, c]));
const ascii = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");
// Trang phục khai báo TƯỜNG MINH ở mỗi khung ("costume": ["daiviet","yuan"]). Bản đầu dò từ khóa
// trong mô tả cảnh và đã hỏng thật: câu "no Yuan soldiers anywhere" chứa chữ "Yuan" nên khối trang
// phục quân Nguyên bị chèn vào → B20/O4 ra lính Nguyên đứng xem dân Việt đẵn gỗ.
function costumeFor(p) {
  if (!Array.isArray(p.costume)) throw new Error(`${p.id}: thiếu trường "costume" trong panels.json`);
  return p.costume.map((k) => {
    if (!C.costume[k]) throw new Error(`${p.id}: không có khối trang phục "${k}" (xem _shared/bible.json)`);
    return C.costume[k];
  }).join(" ");
}
// Biến thể nhân vật: {"id":"TQT82","sheet":"TQT",…} dùng CHUNG tờ ref-TQT.png (cùng mặt) nhưng mô tả
// riêng (ví dụ Quốc Toản năm 1282, chưa có giáp và cờ). Không có "sheet" thì tờ là chính id đó.
const sheetOf = (id) => (CHAR[id] && CHAR[id].sheet) || id;
function panelPrompt(p) {
  for (const id of p.refs) {
    if (!CHAR[id]) throw new Error(`${p.id}: không có nhân vật "${id}" trong bible hoặc chương`);
    if (!CHAR[sheetOf(id)]) throw new Error(`${p.id}: biến thể "${id}" trỏ tới tờ "${sheetOf(id)}" không có trong bible hoặc chương`);
  }
  const who = p.refs.map((id) => `${CHAR[id].desc}.`).join(" ");
  const keep = p.refs.length
    ? ` Use the attached reference sheets: keep ${p.refs.map((id) => ascii(CHAR[id].name)).join(", ")} identical to their references (same face, beard, armor, colors).`
    : "";
  // Không bao giờ nhắc tới chữ/lettering/caption trong prompt, kể cả "chừa chỗ cho chữ": model sẽ tự vẽ
  // ô lời dẫn (B15/D2 v1 ra một ô chữ tiếng Anh sai chính tả) hoặc dải trống (B20/O1 v1, B15/O5, D1 v1).
  return `${C.style} ${p.scene} ${costumeFor(p)}${who ? " Characters: " + who : ""}${keep} One single continuous scene that fills the whole frame edge to edge — not a comic page layout: no inset panels, no borders or panel frames, no caption boxes, no blank boxes or empty bands. Keep the upper part of the scene visually simple (sky, wall, shadow or water). ${C.avoid}`;
}
const charPrompt = (c) => `${C.charSheet} ${c.desc}. ${C.style} ${C.avoid}`;

function existing(dir, id) {
  if (!existsSync(dir)) return null;
  const f = readdirSync(dir).find((n) => n.replace(/\.(png|jpe?g|webp)$/i, "") === id);
  return f ? join(dir, f) : null;
}
const usedRefs = [...new Set(C.panels.flatMap((p) => p.refs.map(sheetOf)))];
const jobs = [
  ...usedRefs.map((id) => ({ id: `ref-${id}`, dir: REFS, aspect: CHAR[id].aspect || "16:9", refs: [], prompt: charPrompt(CHAR[id]) })),
  ...C.panels.map((p) => ({ id: p.id, dir: OUT, aspect: p.aspect, refs: [...new Set(p.refs.map(sheetOf))].map((r) => join(REFS, `ref-${r}.png`)), prompt: panelPrompt(p) })),
].filter((j) => !ONLY.length || ONLY.includes(j.id));

// ---- CLI ---------------------------------------------------------------------------------
function hf(a) {
  // shell:true vì trên Windows `higgsfield` là shim .cmd của npm (giống tools/art-gen.mjs)
  return execFileSync(BIN, a, { encoding: "utf8", maxBuffer: 1 << 24, shell: true }).trim();
}
async function download(url, dir, id) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`tải ảnh hỏng: HTTP ${r.status}`);
  const type = r.headers.get("content-type") || "";
  const ext = /webp/.test(type) ? "webp" : /jpe?g/.test(type) ? "jpg" : "png";
  mkdirSync(dir, { recursive: true });
  const out = join(dir, `${id}.${ext}`);
  writeFileSync(out, Buffer.from(await r.arrayBuffer()));
  return out;
}
async function generate(j) {
  const a = ["generate", "create", C.render.model, "--prompt", JSON.stringify(j.prompt),
             "--aspect_ratio", j.aspect, "--resolution", C.render.resolution, "--wait"];
  for (const r of j.refs) a.push(C.render.refFlag, JSON.stringify(r));
  const url = hf(a).split(/\r?\n/).filter(Boolean).pop();
  if (!/^https?:\/\//.test(url)) throw new Error(`CLI không trả URL: ${url.slice(0, 200)}`);
  return download(url, j.dir, j.id);
}

// ---- dữ liệu cho viewer (_tool/viewer.html?ch=<chương>) — đường dẫn ảnh tính từ _tool/ ------
function writeData() {
  const images = {};
  for (const id of usedRefs) { const f = existing(REFS, `ref-${id}`); if (f) images[`ref-${id}`] = "../_shared/refs/" + f.split(/[\\/]/).pop(); }
  for (const p of C.panels) { const f = existing(OUT, p.id); if (f) images[p.id] = `../${CH}/renders/` + f.split(/[\\/]/).pop(); }
  const data = { ...P, images, prompts: Object.fromEntries(C.panels.map((p) => [p.id, panelPrompt(p)])) };
  writeFileSync(join(DIR, "comic-data.js"), "// Sinh bởi _tool/render.mjs từ panels.json + _shared/bible.json — đừng sửa tay.\nwindow.COMIC = " + JSON.stringify(data, null, 1) + ";\n");
  console.log(`comic-data.js: ${Object.keys(images).length} ảnh đã có / ${usedRefs.length + C.panels.length}`);
}

// ---- chạy --------------------------------------------------------------------------------
if (has("--data")) { writeData(); process.exit(0); }

const todo = jobs.filter((j) => has("--force") || !existing(j.dir, j.id));
console.log(`${CH}: ${jobs.length} ảnh · ${todo.length} chưa có · model ${C.render.model} ${C.render.resolution}`);

if (has("--dry")) {
  for (const j of todo) console.log(`  ${j.id.padEnd(9)} ${j.aspect.padEnd(5)} refs: ${j.refs.map((r) => r.split(/[\\/]/).pop()).join(", ") || "—"}`);
  process.exit(0);
}

if (has("--dump")) {
  let md = `# Phiếu đặt ảnh — comic ${P.chapter.title.vi} (${P.chapter.id})\n\n` +
    `Sinh trên app Higgsfield bằng model **Nano Banana Pro**, độ phân giải **2K**, đúng khung ghi ở mỗi mục.\n` +
    `Tờ nhân vật lưu vào \`_shared/refs/\`, khung lưu vào \`${CH}/renders/\`, đúng TÊN ghi ở mỗi mục.\n` +
    `Xong thì chạy \`node _tool/render.mjs ${CH} --data\` rồi mở \`_tool/viewer.html?ch=${CH}\`.\n\n` +
    `## Ba điều bắt buộc\n\n` +
    `1. **Sinh tờ nhân vật trước.** Tờ đã có trong \`_shared/refs/\` thì dùng lại, không sinh mới — đó là cách giữ cùng một khuôn mặt qua các chương.\n` +
    `2. **Không để AI viết chữ.** Lời dẫn, bóng thoại, chữ trên cờ do viewer và game chèn sau. Ảnh nào có chữ, kể cả chữ Hán, thì sinh lại.\n` +
    `3. **Duyệt trang phục.** Loại ngay ảnh có giáp samurai, áo nhà Thanh, tóc đuôi sam hoặc máu me.\n\n---\n\n`;
  for (const j of todo) {
    md += `## ${j.id}\n\n- khung: **${j.aspect}**\n- lưu thành: \`${j.dir === REFS ? "_shared/refs" : CH + "/renders"}/${j.id}.png\`\n` +
      (j.refs.length ? `- đính kèm tham chiếu: ${j.refs.map((r) => "`_shared/refs/" + r.split(/[\\/]/).pop() + "`").join(", ")}\n` : "") +
      `\n\`\`\`\n${j.prompt}\n\`\`\`\n\n`;
  }
  writeFileSync(join(DIR, "PROMPTS.md"), md);
  console.log(`đã ghi ${todo.length} phiếu → ${CH}/PROMPTS.md`);
  writeData();
  process.exit(0);
}

let ok = 0, fail = 0;
for (const [n, j] of todo.entries()) {
  const tag = `[${n + 1}/${todo.length}] ${j.id}`;
  const missingRef = j.refs.find((r) => !existsSync(r));
  if (missingRef) { fail++; console.error(`${tag} ✗ thiếu tham chiếu ${missingRef.split(/[\\/]/).pop()} — sinh tờ nhân vật trước`); continue; }
  try {
    const out = await generate(j);
    ok++;
    console.log(`${tag} ✓ → ${out.split(/[\\/]/).slice(-2).join("/")}`);
  } catch (e) {
    fail++;
    console.error(`${tag} ✗ ${String(e.message || e).split("\n")[0]}`);
  }
}
writeData();
console.log(`\nxong: ${ok} thành công, ${fail} lỗi. Mở _tool/viewer.html?ch=${CH} để duyệt.`);
