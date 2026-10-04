// design/tools/meshy.mjs — tạo GLB bằng Meshy API (Text to 3D) từ đúng prompt trong design/glb-prompts.md.
//
// Key KHÔNG nằm trong repo: đặt biến môi trường MESHY_API_KEY (hoặc MESHY_API_KEY_FILE trỏ tới tệp chứa key).
//
//   cd design/tools && npm i                                  # gltf-transform, sharp, meshoptimizer (chỉ để nén)
//   node design/tools/meshy.mjs list    [--set ...] [--only H35,WPN_songdao] [--prompt] [--hash]
//     --set: thu (cặp thử H35 + song đao), can (40 tệp game đang dùng; mặc định), thieu (game còn dựng bằng code: dân làng,
//     áo Tống, nón lá, quang gánh, tay nải, ống tên, trâu, thú mục O), moi-truong (mã ENV_), lam-lai (mã _v2: làm lại ra tệp
//     mới, không ghi đè tệp cũ), tuong-moi (tướng có tên chưa có GLB: H34, H38, H39, tướng thêm từ design/3d-ref), tat-ca.
//     --hash in mã, băm prompt, độ dài bản API, tam giác mục tiêu và so với manifest (≠ là run sẽ mua lại, ghi đè GLB).
//   node design/tools/meshy.test.mjs                          # kiểm không mạng: đọc tài liệu, bộ chọn, 40 băm cũ không đổi
//   node design/tools/meshy.mjs balance
//   node design/tools/meshy.mjs run     [--set ...] [--only ...] [--model latest] [--model-linh meshy-5] [--model-vk meshy-5]
//                                       [--model-mt meshy-5] [--jobs 3] [--dry] [--stage luoi] [--redo H35,WPN_songdao]
//     --model cho tướng, sĩ quan, người lính Tự do, cận vệ, ngựa; --model-linh cho lính đám đông và dân làng (nhóm C, D, J:
//     hàng trăm người ở xa, lưới chỉ 3k); --model-vk cho vũ khí và đạo cụ; --model-mt cho môi trường (mã ENV_). Hai tuỳ chọn
//     --model-linh, --model-vk mặc định bằng --model; --model-mt mặc định bằng --model-vk.
//     Mẫu đã có lưới thì giữ model của lưới đó; muốn đổi thì --redo.
//     --stage luoi chỉ dựng lưới xám (preview) và tải ảnh lưới; soát xong mới chạy lại không có --stage để tô texture,
//     nên mẫu hỏng chỉ tốn tiền lưới. --redo bỏ kết quả cũ của các mã đó và dựng lại từ đầu.
//   node design/tools/meshy.mjs sheet   <ra.png> [--set ...] [--only ...] [--size 256] [--cols 6]   # ghép ảnh Meshy thành một tờ
//   node design/tools/meshy.mjs post    [--only ...]          # nén lại từ bản gốc đã tải, không tốn credit
//
// Mỗi mẫu: preview (lưới) → refine (texture màu phẳng, không PBR, bỏ sáng in sẵn) → tải GLB gốc vào design/glb/_raw/
// (ngoài git) → nén vào design/glb/<nhóm>/: nhân vật và lính ở nhan-vat/, vũ khí ở vu-khi/, đạo cụ ở dao-cu/,
// ngựa và voi ở thu-cuoi/, môi trường (thuyền, công trình, đạo cụ cảnh, cây, đá) ở moi-truong/. Nén chỉ đổi texture
// sang WebP (1024; H35, H31 và người lính Tự do 2048), đặt gốc dưới chân, và giảm lưới nếu Meshy trả quá dải tam giác
// của bảng mục 1. Không lượng tử hoá lưới: game/js/riglab/autorig.js đọc thẳng position.array kiểu Float32.
// Trạng thái từng mẫu (mã task, số tam giác, dung lượng) ghi ở design/glb/manifest.json, nên chạy lại chỉ làm phần còn thiếu.
// Làm lại một mẫu đã có: thêm dòng mã _v2 (H33_v2 → char_H33_tran-nhat-duat_v2.glb) thay vì sửa prompt cũ — sửa prompt cũ là
// đổi băm, run mặc định sẽ mua lại và ghi đè tệp cũ.

import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

// Chạy như lệnh; meshy.test.mjs nhập tệp này để lấy các hàm đọc tài liệu (import.meta.main = false từ Node 24.2) nên không chạy.
const MAIN = import.meta.main !== false;

// Node chỉ đi qua proxy HTTPS khi bật NODE_USE_ENV_PROXY (Node ≥ 22.21); tự chạy lại với biến này nếu cần.
if (MAIN && process.env.HTTPS_PROXY && !process.env.NODE_USE_ENV_PROXY) {
  const r = spawnSync(process.execPath, process.argv.slice(1), { stdio: "inherit", env: { ...process.env, NODE_USE_ENV_PROXY: "1", NODE_NO_WARNINGS: "1" } });
  process.exit(r.status ?? 1);
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOC = join(ROOT, "design/glb-prompts.md");
const OUT = join(ROOT, "design/glb");
const RAW = join(OUT, "_raw");
const MANIFEST = join(OUT, "manifest.json");
const API = "https://api.meshy.ai/openapi";

const args = process.argv.slice(2);
const cmd = args[0] || "list";
const opt = (k, d) => { const i = args.indexOf("--" + k); return i >= 0 ? args[i + 1] : d; };
const flag = (k) => args.includes("--" + k);

// ---------- đọc tài liệu prompt ----------

const NEG_NV = "weapon, sword, spear, bow, shield, holding, cape, cloak, flag, T-pose, pedestal, base, anime, chibi, cartoon, photorealistic, text, logo, samurai armor, kabuto, Qing dynasty clothing, queue braid, European plate armor, Nguyen dynasty court dress, monster, demon, orc, horns, skull, fangs, grotesque, caricature, evil villain, gore, blood, baked lighting, baked shadows";
const NEG_VK = "hand, person, character, holding, stand, rack, pedestal, base, wall mount, text, letters, runes, glowing, fantasy ornament, anime, chibi, cartoon, katana, European sword, gore, blood, baked lighting, baked shadows";
// Môi trường: không người, không chữ (cờ, biển chữ do code vẽ); giá, bệ, đế có thể là một phần của vật nên không chặn.
const NEG_MT = "person, people, character, crowd, text, letters, calligraphy, logo, anime, chibi, cartoon, photorealistic, modern, glowing, fantasy ornament, gore, blood, baked lighting, baked shadows";

const KIND = { char_: "nhan-vat", unit_: "nhan-vat", wpn_: "vu-khi", prop_: "dao-cu", mount_: "thu-cuoi", env_: "moi-truong" };
const V2 = /_v\d+$/; // mã làm lại: H33_v2, tệp …_v2.glb

function parseRange(s) {
  const m = s.replace(/,/g, ".").match(/([\d.]+)\s*–\s*([\d.]+)\s*(k?)/);
  if (!m) return null;
  const k = m[3] ? 1000 : 1;
  return [Math.round(+m[1] * k), Math.round(+m[2] * k)];
}

// Không cần nặng: tướng 10–20k lấy gần mức dưới, cận vệ lấy giữa, lính đám đông và vũ khí (vốn đã nhẹ) lấy mức trên cho rõ.
function targetTris([lo, hi]) {
  if (hi >= 10000) return Math.round((lo + (hi - lo) * 0.25) / 500) * 500;
  if (hi >= 4000) return Math.round((lo + hi) / 2);
  return hi;
}

// Lỗi trong tài liệu thì ném ngay lúc đọc, trước mọi lệnh (kể cả list), để không gửi gì lên Meshy rồi mới hỏng.
export function loadAssets(md = readFileSync(DOC, "utf8")) {
  md = md.replace(/\r\n?/g, "\n").normalize("NFC"); // cây làm việc CRLF (Windows, core.autocrlf), chữ Việt tổ hợp
  const rows = new Map();
  for (const line of md.split("\n")) {
    const c = line.split("|").map((s) => s.trim());
    if (c.length < 10 || !/^\d+a?$/.test(c[1])) continue;
    const range = parseRange(c[6]);
    if (!range) throw new Error(`${c[2]}: cột tam giác "${c[6]}" phải là lo–hi, gạch nối dài (ví dụ 1–2k, 300–800)`);
    rows.set(c[2], { no: c[1], code: c[2], file: c[3].replace(/`/g, ""), name: c[4], group: c[5], range });
  }
  const secs = new Map();
  const re = /^### ([A-Z]\d+) · (\S+) · (.+)$/gm; // A–J nhân vật, vũ khí, đạo cụ, thú cưỡi; K–P môi trường, thú, làm lại
  const heads = [...md.matchAll(re)];
  heads.forEach((h, i) => {
    const end = i + 1 < heads.length ? heads[i + 1].index : md.length;
    let body = md.slice(h.index, end);
    const next = body.indexOf("\n## ", 1); if (next > 0) body = body.slice(0, next);
    const p = body.match(/PROMPT \(dán thẳng\):\s*```text\n([\s\S]*?)\n```/);
    if (!p) return;
    secs.set(h[2], { sec: h[1], prompt: p[1].trim(), sym: /Symmetry: tắt/.test(body) ? "off" : /Symmetry: bật/.test(body) ? "on" : "auto" });
  });
  // 23a LINH_r2: prompt E2 đổi màu áo (mục E của tài liệu).
  const e2 = secs.get("LINH_r24");
  if (e2) secs.set("LINH_r2", { sec: "E2a", sym: e2.sym, prompt: e2.prompt.replace("Dark red robe", "Brick-red robe").replace("four dark red skirt flaps", "four brick-red skirt flaps") });

  const out = [], files = new Map();
  for (const r of rows.values()) {
    const s = secs.get(r.code);
    if (!s) throw new Error(`thiếu PROMPT cho ${r.code}`);
    const kind = KIND[r.file.match(/^[a-z]+_/)?.[0]];
    if (!kind) throw new Error(`${r.code}: tệp ${r.file} có tiền tố lạ; chỉ nhận ${Object.keys(KIND).join(" ")} (mục 0.5)`);
    if (r.code.startsWith("ENV_") !== (kind === "moi-truong")) throw new Error(`${r.code}: mã ENV_ đi với tệp env_ và ngược lại (${r.file})`);
    const v = r.code.match(V2)?.[0];
    if (v && !r.file.endsWith(v + ".glb")) throw new Error(`${r.code}: tệp làm lại phải là …${v}.glb để không ghi đè tệp cũ (${r.file})`);
    if (files.has(r.file)) throw new Error(`${r.code}: trùng tệp ${r.file} với ${files.get(r.file)}`);
    files.set(r.file, r.code);
    const person = kind === "nhan-vat";
    if (person && !s.prompt.includes("A-pose,")) throw new Error(`${r.code}: prompt người thiếu "A-pose," (khối POSE hoặc POSE v2, mục 2.2), câu chặn vũ khí sẽ không được chèn`);
    const base = r.code.replace(V2, ""); // H33_v2 làm lại H33: giữ quy tắc riêng của mã gốc
    let negative = person || kind === "thu-cuoi" ? NEG_NV : kind === "moi-truong" ? NEG_MT : NEG_VK;
    if (base.startsWith("MOUNT_ngua")) negative += ", rider, person";
    if (base === "MOUNT_voi_chien") negative += ", rider, person, howdah, saddle";
    if (base === "NG_KY") negative += ", horse, saddle, sitting, mounted";
    // Texture 2048 chỉ cho nhân vật người chơi điều khiển, nhìn gần cả trận (hai tướng chơi được, người lính Tự do); còn lại 1024.
    const hero = base === "H35" || base === "H31" || r.group === "E";
    if (base.startsWith("MOUNT_ngua")) s.sym = "on"; // mục 0.2: bật đối xứng cho ngựa
    out.push({ ...r, ...s, kind, negative, person, tris: targetTris(r.range), tex: hero ? 2048 : 1024 });
  }
  return out;
}

// Bản prompt gửi API. API v2 của Meshy bỏ qua negative_prompt, nên các ý chặn quan trọng nhất của khối NEGATIVE
// (mục 2.3) phải nằm ngay trong prompt: nhân vật không mang vũ khí hay bao đao (vũ khí là tệp riêng), không sừng,
// không áo choàng; ai không có mũ trong prompt thì ghi rõ không mũ. Khối STYLE và POSE rút gọn để đủ chỗ trong 600 ký tự.
const STYLE = "Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.";
export const POSE = "A-pose, arms 45° down, open empty hands, fingers slightly apart, feet shoulder-width, facing front, mouth closed.";
// POSE v2 (mục 2.2) chỉ cho mục mới: 40 mẫu đầu ra tay dang gần ngang, khuỷu gập, ngửa bàn tay nên bộ dò khớp rig sai. Mục cũ
// giữ POSE cũ: đổi chữ là đổi băm. Bản API vẫn mở đầu "A-pose," để câu chặn vũ khí chèn đúng chỗ.
export const POSE2 = "A-pose, straight arms 45° down, elbows straight, relaxed open hands, fingers together, feet shoulder-width, facing front, mouth closed.";
export function apiPrompt(a) {
  let p = a.prompt.replace(STYLE, "Stylized low-poly game asset, realistic proportions, flat hand-painted colors, clean silhouette.");
  if (FIX[a.code]) for (const [from, to] of FIX[a.code]) { if (!p.includes(from)) die(`FIX ${a.code}: không thấy "${from}"`); p = p.replace(from, to); }
  if (!a.person) return p;
  p = p.replace(POSE, "A-pose, arms angled down away from the body, open empty hands, feet shoulder-width, facing front.")
    .replace(POSE2, "A-pose, straight arms 45° down, elbows straight, relaxed open hands, fingers together, feet shoulder-width, facing front.");
  const guard = FIX[a.code] ? "Unarmed, empty belt, no scabbard. No cape." :
    ["Unarmed: no sword, scabbard or weapon on the body.", /helmet|hat\b|cap\b/i.test(a.prompt) ? "" : "No helmet.", "No horns, no cape."].filter(Boolean).join(" ");
  return p.replace(/(A-pose,)/, guard + " $1");
}

// Sửa riêng cho bản API sau lần dựng đầu (soát ảnh lưới ngày 2026-10-02): mũ tả chung chung bị dựng thành mũ có sừng
// kiểu samurai hoặc mào tua tủa, nên tả mũ trơn và cụ thể hơn; meshy-5 dựng nỏ thành súng trường, đại đao thành kiếm.
const GOLD_HELM = ["Short gold cylindrical helmet with a tall thin red spike.", "Small smooth round gold helmet with one thin red spike on top, plain, no crest."];
const MONGOL_HELM2 = ["Tall pointed silver-grey steel helmet with brown fur rim.", "Open-face Mongol helmet: tall onion-shaped steel bowl rising to a thin spike, brown fur band, leather neck flap."];
const FIX = {
  H33: [GOLD_HELM], H40: [GOLD_HELM],
  // Lần 2 vẫn ra mũ trụ kín châu Âu (X24) và mũ samurai có mào (OFF_doitruong): tả hình mũ Mông Cổ thật cụ thể.
  X24: [MONGOL_HELM2, ["Blue-grey steel lamellar armor", "Blue-grey steel scale armor"]],
  OFF_doitruong: [MONGOL_HELM2, ["Blue-grey steel lamellar cuirass", "Blue-grey steel scale cuirass"]],
  NG_CUNG: [["Brown fur hat flaring outward, small indigo cone on top.", "Round brown fur hat with an upturned fur brim and a small indigo cloth top."]],
  WPN_no: [["Vietnamese wooden crossbow, 13th century. Straight brown wooden stock 72 cm long, dark brown bow arms 1.1 m wide with slightly swept tips, iron trigger and groove, cream string, no bolt loaded. Floating",
    "Medieval Asian hand crossbow, 13th century, all wood and cord: straight brown wooden stock 72 cm long, dark brown bow 1.1 m wide mounted crosswise at the front end, cream bowstring, simple bronze trigger, no bolt. No scope, no barrel, not a gun. Lying flat, floating"]],
  // Lần 2 (latest) chỉ ra cây gậy: đưa lưỡi lên đầu câu.
  WPN_dadao: [["Long pole glaive, 13th-century East Asia, about 2.6 m long. Plain brown wooden shaft, iron butt cap, gold metal collar, broad single-edged grey steel blade about 75 cm long and 26 cm wide, slightly curved edge, straight back.",
    "Huge curved single-edged steel cleaver blade, 75 cm long and 26 cm wide, fixed on top of a long plain brown wooden pole, gold ring where blade meets pole, iron butt cap; total 2.6 m, like a Chinese guandao."]],
};

// Thứ tự làm theo mục 0.4 của tài liệu; "can" = những tệp game hiện tại cần (mục 1–4, 7–15, 17–41 trừ 23a, 49, 51).
const ORDER = [
  "H35", "WPN_songdao",
  "DV_GIAO", "WPN_giao_dv", "NG_DAO", "WPN_dao_linh", "WPN_khien_tron_ng", "NG_KY", "WPN_cung_ng", "MOUNT_ngua_nguyen", "PROP_mui_ten",
  "NG_GIAO", "WPN_giao_ng", "NG_CUNG", "DV_DAO", "WPN_khien_nhat_dv", "DV_NO", "WPN_no", "NG_TANK", "WPN_chuy",
  "H33", "H40", "WPN_cung_viet", "X19", "WPN_dadao", "OFF_doitruong", "WPN_dao", "OFF_photuong",
  "H31", "WPN_daikiem", "X20", "X24",
  "LINH_r01", "LINH_r24", "CV_khien", "CV_giao", "CV_cung", "CV_songdao", "CV_daidao", "OFF_tuong",
];
// Bộ chọn. can (mặc định của run) giữ đúng 40 mã đã tạo. Các bộ mới tính từ mã và chữ mục, nên tự gồm mục thêm sau.
// thieu = thứ game đang vẽ bằng code mà chưa có GLB: dân làng, áo Tống, nón lá, quang gánh, tay nải, ống tên, trâu, thú mục O.
const THIEU = ["DV_AOTONG", "PROP_non_la", "PROP_quang_ganh", "PROP_tay_nai", "PROP_ong_ten", "MOUNT_trau"];
const byCode = (all, list) => list.map((c) => { const a = all.find((x) => x.code === c); if (!a) throw new Error(`không có mã ${c}`); return a; });
const SETS = {
  thu: (all) => byCode(all, ["H35", "WPN_songdao"]),
  can: (all) => byCode(all, ORDER),
  thieu: (all) => all.filter((a) => !V2.test(a.code) && (a.code.startsWith("DAN_") || THIEU.includes(a.code) || a.sec[0] === "O")),
  "moi-truong": (all) => all.filter((a) => a.code.startsWith("ENV_")),
  "lam-lai": (all) => all.filter((a) => V2.test(a.code)),
  "tuong-moi": (all) => all.filter((a) => /^(H\d+|X\d+|TT)$/.test(a.code) && !ORDER.includes(a.code)),
  "tat-ca": (all) => [...byCode(all, ORDER), ...all.filter((a) => !ORDER.includes(a.code))],
};
export const setOf = (all, name) => (Object.hasOwn(SETS, name) ? SETS[name](all) : undefined);

function pick(all) {
  const only = opt("only");
  if (only) return only.split(",").map((c) => all.find((a) => a.code === c.trim()) || die(`không có mã ${c}`));
  const set = opt("set", "can"), list = setOf(all, set);
  if (!list) die(`--set phải là ${Object.keys(SETS).join(" | ")}`);
  if (!list.length) die(`--set ${set}: tài liệu chưa có mục nào thuộc bộ này`);
  return list;
}

function die(m) { console.error(m); process.exit(2); }

// ---------- Meshy ----------

function apiKey() {
  if (process.env.MESHY_API_KEY) return process.env.MESHY_API_KEY.trim();
  if (process.env.MESHY_API_KEY_FILE) return readFileSync(process.env.MESHY_API_KEY_FILE, "utf8").trim();
  die("thiếu MESHY_API_KEY (hoặc MESHY_API_KEY_FILE)");
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(method, path, body) {
  for (let attempt = 0; ; attempt++) {
    let res;
    try {
      res = await fetch(API + path, { method, headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    } catch (e) {
      if (attempt < 4) { await sleep(2000 * 2 ** attempt); continue; }
      throw new Error(`${method} ${path}: ${e.cause?.message || e.message}`);
    }
    const text = await res.text();
    if (res.status === 429 || res.status >= 500) { if (attempt < 6) { await sleep(5000 * (attempt + 1)); continue; } }
    if (!res.ok) { const err = new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 400)}`); err.status = res.status; err.body = text; throw err; }
    return text ? JSON.parse(text) : {};
  }
}

// Trường tuỳ chọn mà bản API cũ có thể chưa nhận: bị từ chối (400 nêu tên trường) thì bỏ trường đó và gửi lại.
const OPTIONAL = ["pose_mode", "remove_lighting", "negative_prompt", "symmetry_mode", "should_remesh"];
async function create(path, body) {
  const b = { ...body };
  for (;;) {
    try { return (await call("POST", path, b)).result; }
    catch (e) {
      const f = e.status === 400 && OPTIONAL.find((k) => k in b && e.body.includes(k));
      if (!f) throw e;
      console.warn(`  Meshy không nhận "${f}", gửi lại không có trường này`); delete b[f];
    }
  }
}

async function wait(id, label) {
  const t0 = Date.now(); let last = -1;
  for (;;) {
    const t = await call("GET", `/v2/text-to-3d/${id}`);
    if (t.status === "SUCCEEDED") return t;
    if (["FAILED", "CANCELED", "EXPIRED"].includes(t.status)) throw new Error(`${label}: ${t.status} ${t.task_error?.message || ""}`);
    if (t.progress !== last && t.progress % 25 === 0) { console.log(`  ${label} ${t.progress}%`); last = t.progress; }
    if (Date.now() - t0 > 40 * 60e3) throw new Error(`${label}: quá 40 phút`);
    await sleep(8000);
  }
}

async function download(url, file) {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status}`);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, Buffer.from(await res.arrayBuffer()));
      return;
    } catch (e) { if (attempt >= 3) throw new Error(`tải ${file}: ${e.message}`); await sleep(3000 * (attempt + 1)); }
  }
}

const balance = async () => (await call("GET", "/v1/balance")).balance;

// ---------- nén ----------

async function post(a, rawFile) {
  const { NodeIO } = await import("@gltf-transform/core");
  const { ALL_EXTENSIONS } = await import("@gltf-transform/extensions");
  const { dedup, prune, center, textureCompress, weld, simplify, getBounds } = await import("@gltf-transform/functions");
  const sharp = (await import("sharp")).default;
  const { MeshoptSimplifier } = await import("meshoptimizer");
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.read(rawFile);
  const count = () => doc.getRoot().listMeshes().reduce((n, m) => n + m.listPrimitives().reduce((k, p) => k + (p.getIndices()?.getCount() ?? p.getAttribute("POSITION").getCount()) / 3, 0), 0);
  const before = count();
  const [, hi] = a.range;
  if (before > hi * 1.15) {
    await MeshoptSimplifier.ready;
    await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: a.tris / before, error: 0.01 }));
  }
  await doc.transform(dedup(), prune(), center({ pivot: "below" }),
    textureCompress({ encoder: sharp, targetFormat: "webp", resize: [a.tex, a.tex], quality: 88 }));
  const out = join(OUT, a.kind, a.file);
  mkdirSync(dirname(out), { recursive: true });
  await io.write(out, doc);
  const b = getBounds(doc.getRoot().listScenes()[0]);
  const size = b.max.map((v, i) => +(v - b.min[i]).toFixed(3));
  return { tris_raw: before, tris: count(), bytes: statSync(out).size, size_xyz: size, path: `design/glb/${a.kind}/${a.file}` };
}

// ---------- chạy ----------

const readManifest = () => (existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : {});
function saveManifest(m) {
  mkdirSync(OUT, { recursive: true });
  const sorted = Object.fromEntries(Object.entries(m).sort(([a], [b]) => (m[a].no + "").localeCompare(m[b].no + "", undefined, { numeric: true })));
  writeFileSync(MANIFEST, JSON.stringify(sorted, null, 2) + "\n");
}
export const hash = (a) => createHash("sha1").update(apiPrompt(a) + "|" + a.tris + "|" + a.sym).digest("hex").slice(0, 10);

// Theo bảng giá Meshy: lưới 20 credit với model mới nhất (5 với meshy-5 trở về trước), texture 10.
const PREVIEW = (model) => (model === "latest" || model === "meshy-6" ? 20 : 5), REFINE = 10;

async function renderOne(a, man, model, budget, stage) {
  const m = man[a.code] && man[a.code].hash === hash(a) ? man[a.code] : { no: a.no, code: a.code, hash: hash(a), model };
  man[a.code] = m; model = m.model; // texture phải cùng model với lưới
  const raw = join(RAW, `${m.hash}-${a.file}`); // gắn hash prompt: sửa prompt thì không dùng nhầm bản gốc cũ
  if (m.status === "done" && existsSync(join(OUT, a.kind, a.file))) { console.log(`= ${a.code} đã có`); return; }
  if (!existsSync(raw)) {
    if (!m.preview_id) {
      if (!budget.take(PREVIEW(model) + (stage === "luoi" ? 0 : REFINE))) { m.status = "het-credit"; return; }
      m.preview_id = await create("/v2/text-to-3d", {
        mode: "preview", prompt: apiPrompt(a), negative_prompt: a.negative, art_style: "realistic", ai_model: model,
        topology: "triangle", target_polycount: a.tris, should_remesh: true, symmetry_mode: a.sym,
        ...(a.person ? { pose_mode: "a-pose" } : {}),
      });
      m.status = "luoi-dang"; saveManifest(man);
      console.log(`→ ${a.code} lưới ${m.preview_id}`);
    } else if (!m.refine_id && stage !== "luoi" && !budget.take(REFINE)) { m.status = "het-credit"; return; }
    const p = await wait(m.preview_id, `${a.code} lưới`);
    const thumb = raw.replace(/\.glb$/, "-luoi.png");
    if (p.thumbnail_url && !existsSync(thumb)) await download(p.thumbnail_url, thumb).catch(() => {});
    if (stage === "luoi") { m.status = "luoi"; saveManifest(man); console.log(`◐ ${a.code} lưới xong`); return; }
    if (!m.refine_id) {
      m.refine_id = await create("/v2/text-to-3d", { mode: "refine", preview_task_id: m.preview_id, enable_pbr: false, remove_lighting: true, ai_model: model });
      m.status = "texture-dang"; saveManifest(man);
      console.log(`→ ${a.code} texture ${m.refine_id}`);
    }
    const t = await wait(m.refine_id, `${a.code} texture`);
    if (!t.model_urls?.glb) throw new Error(`${a.code}: Meshy không trả GLB`);
    await download(t.model_urls.glb, raw);
    if (t.thumbnail_url) await download(t.thumbnail_url, raw.replace(/\.glb$/, ".png")).catch(() => {});
  }
  Object.assign(m, await post(a, raw), { status: "done", tex: a.tex, target_tris: a.tris });
  delete m.error; saveManifest(man);
  console.log(`✓ ${a.code}: ${m.tris} tam giác (gốc ${m.tris_raw}), ${(m.bytes / 1048576).toFixed(2)} MB → ${m.path}`);
}

// Ghép ảnh Meshy trả về (ảnh texture nếu có, không thì ảnh lưới xám) thành một tờ có nhãn, để soát nhanh.
async function sheet(list, man, out) {
  const sharp = (await import("sharp")).default;
  const S = Number(opt("size", 256)), cols = Number(opt("cols", 6)), tiles = [];
  for (const a of list) {
    const base = join(RAW, `${man[a.code]?.hash}-${a.file}`).replace(/\.glb$/, "");
    const img = [base + ".png", base + "-luoi.png"].find((f) => existsSync(f));
    if (!img) continue;
    const label = Buffer.from(`<svg width="${S}" height="22"><rect width="100%" height="100%" fill="#1d1a17"/><text x="6" y="16" font-family="sans-serif" font-size="14" fill="#f1d98a">${a.code}${img.endsWith("-luoi.png") ? " (lưới)" : ""}</text></svg>`);
    tiles.push(await sharp(img).resize(S, S, { fit: "contain", background: "#e9e5dc" }).flatten({ background: "#e9e5dc" })
      .extend({ bottom: 22, background: "#1d1a17" }).composite([{ input: label, top: S, left: 0 }]).png().toBuffer());
  }
  if (!tiles.length) die("chưa có ảnh nào");
  const rows = Math.ceil(tiles.length / cols);
  await sharp({ create: { width: cols * S, height: rows * (S + 22), channels: 3, background: "#e9e5dc" } })
    .composite(tiles.map((t, i) => ({ input: t, left: (i % cols) * S, top: Math.floor(i / cols) * (S + 22) }))).png().toFile(out);
  console.log(`${tiles.length} ảnh → ${out}`);
}

async function main() {
  const all = loadAssets();
  if (cmd === "list") {
    const list = pick(all);
    if (flag("hash")) {
      // Băm khác manifest = run sẽ coi là mẫu mới: mua lại và ghi đè tệp đã có.
      const man = readManifest(); let had = 0, same = 0;
      for (const a of list) {
        const h = hash(a), m = man[a.code];
        if (m) { had++; if (m.hash === h) same++; }
        console.log(`${a.code.padEnd(22)} ${h}  ${String(apiPrompt(a).length).padStart(3)} ký tự  ${String(a.tris).padStart(6)} tg  ${!m ? "chưa tạo" : m.hash === h ? "= manifest" : `≠ manifest ${m.hash}: run sẽ mua lại, ghi đè ${m.path}`}`);
      }
      console.log(`\n${list.length} mục; ${same}/${had} mã đã có trong manifest giữ nguyên băm`);
      return;
    }
    for (const a of list) console.log(`${a.no.padStart(3)} ${a.code.padEnd(22)} ${a.kind.padEnd(10)} ${String(a.tris).padStart(6)} tg  tex ${a.tex}  sym ${a.sym.padEnd(4)} ${apiPrompt(a).length} ký tự  → ${a.kind}/${a.file}`);
    if (flag("prompt")) for (const a of list) console.log(`\n${a.code}: ${apiPrompt(a)}`);
    return;
  }
  if (cmd === "balance") { console.log(`Credit còn: ${await balance()}`); return; }
  const list = pick(all);
  const man = readManifest();
  if (cmd === "sheet") { await sheet(list, man, resolve(args[1] && !args[1].startsWith("--") ? args[1] : join(RAW, "to-xem.png"))); return; }
  if (cmd === "post") {
    for (const a of list) {
      const raw = join(RAW, `${man[a.code]?.hash}-${a.file}`);
      if (!existsSync(raw)) continue;
      Object.assign(man[a.code] ||= { no: a.no, code: a.code }, await post(a, raw), { status: "done", tex: a.tex, target_tris: a.tris });
      console.log(`✓ ${a.code}: ${man[a.code].tris} tg, ${(man[a.code].bytes / 1048576).toFixed(2)} MB`);
    }
    saveManifest(man); return;
  }
  if (cmd !== "run") die(`lệnh không rõ: ${cmd}`);
  const model = opt("model", "latest"), modelVk = opt("model-vk", model), modelLinh = opt("model-linh", model), modelMt = opt("model-mt", modelVk);
  const modelOf = (a) => (a.kind === "moi-truong" ? modelMt : a.kind === "vu-khi" || a.kind === "dao-cu" ? modelVk : /^[CDJ]$/.test(a.group) && a.person ? modelLinh : model);
  const stage = opt("stage");
  if (stage && stage !== "luoi") die("--stage chỉ nhận luoi");
  for (const c of (opt("redo") || "").split(",").filter(Boolean)) delete man[c.trim()];
  for (const a of list) if (apiPrompt(a).length > 600) die(`${a.code}: prompt ${apiPrompt(a).length} ký tự > 600`);
  const need = list.reduce((n, a) => {
    const m = man[a.code], same = m && m.hash === hash(a);
    if (same && m.status === "done") return n;
    return n + (same && m.preview_id ? 0 : PREVIEW(modelOf(a))) + (stage === "luoi" || (same && m.refine_id) ? 0 : REFINE);
  }, 0);
  if (flag("dry")) { console.log(`${list.length} mẫu, ước tính ${need} credit (${model} / lính ${modelLinh} / vũ khí ${modelVk} / môi trường ${modelMt})`); return; }
  let left = await balance();
  console.log(`Credit còn: ${left}; ${list.length} mẫu, ước tính ${need} credit`);
  const budget = { take: (n) => { if (left < n) return false; left -= n; return true; } };
  const queue = [...list]; const errors = [];
  const worker = async () => {
    for (let a; (a = queue.shift());) {
      try { await renderOne(a, man, modelOf(a), budget, stage); }
      catch (e) { errors.push(`${a.code}: ${e.message}`); console.error(`✗ ${a.code}: ${e.message}`); man[a.code].status = "loi"; man[a.code].error = e.message.slice(0, 300); }
      saveManifest(man);
    }
  };
  await Promise.all(Array.from({ length: Number(opt("jobs", 3)) }, worker));
  const skipped = list.filter((a) => man[a.code]?.status === "het-credit").map((a) => a.code);
  console.log(`\nXong. Credit còn: ${await balance().catch(() => "?")}`);
  if (skipped.length) console.log(`Hết credit, chưa làm: ${skipped.join(", ")}`);
  if (errors.length) { console.log(`Lỗi:\n  ${errors.join("\n  ")}`); process.exitCode = 1; }
}

if (MAIN) main().catch((e) => { console.error(e.message); process.exit(1); });
