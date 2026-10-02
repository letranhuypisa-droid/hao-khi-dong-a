// design/tools/meshy.mjs — tạo GLB bằng Meshy API (Text to 3D) từ đúng prompt trong design/glb-prompts.md.
//
// Key KHÔNG nằm trong repo: đặt biến môi trường MESHY_API_KEY (hoặc MESHY_API_KEY_FILE trỏ tới tệp chứa key).
//
//   cd design/tools && npm i                                  # gltf-transform, sharp, meshoptimizer (chỉ để nén)
//   node design/tools/meshy.mjs list    [--set thu|can|tat-ca] [--only H35,WPN_songdao]
//   node design/tools/meshy.mjs balance
//   node design/tools/meshy.mjs run     [--set ...] [--only ...] [--model latest] [--model-vk meshy-5] [--jobs 3] [--dry]
//     --model cho nhân vật, lính, ngựa; --model-vk cho vũ khí và đạo cụ (hình đơn giản, model rẻ hơn vẫn rõ). Mặc định: cùng --model.
//   node design/tools/meshy.mjs post    [--only ...]          # nén lại từ bản gốc đã tải, không tốn credit
//
// Mỗi mẫu: preview (lưới) → refine (texture màu phẳng, không PBR, bỏ sáng in sẵn) → tải GLB gốc vào design/glb/_raw/
// (ngoài git) → nén vào design/glb/<nhóm>/: nhân vật và lính ở nhan-vat/, vũ khí ở vu-khi/, đạo cụ ở dao-cu/,
// ngựa và voi ở thu-cuoi/. Nén chỉ đổi texture sang WebP (1024, tướng và người lính Tự do 2048), đặt gốc dưới chân,
// và giảm lưới nếu Meshy trả quá dải tam giác của bảng mục 1. Không lượng tử hoá lưới: game/js/riglab/autorig.js đọc
// thẳng position.array kiểu Float32.
// Trạng thái từng mẫu (mã task, số tam giác, dung lượng) ghi ở design/glb/manifest.json, nên chạy lại chỉ làm phần còn thiếu.

import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

// Node chỉ đi qua proxy HTTPS khi bật NODE_USE_ENV_PROXY (Node ≥ 22.21); tự chạy lại với biến này nếu cần.
if (process.env.HTTPS_PROXY && !process.env.NODE_USE_ENV_PROXY) {
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

const KIND = { char_: "nhan-vat", unit_: "nhan-vat", wpn_: "vu-khi", prop_: "dao-cu", mount_: "thu-cuoi" };

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

function loadAssets() {
  const md = readFileSync(DOC, "utf8");
  const rows = new Map();
  for (const line of md.split("\n")) {
    const c = line.split("|").map((s) => s.trim());
    if (c.length < 10 || !/^\d+a?$/.test(c[1])) continue;
    rows.set(c[2], { no: c[1], code: c[2], file: c[3].replace(/`/g, ""), name: c[4], group: c[5], range: parseRange(c[6]) });
  }
  const secs = new Map();
  const re = /^### ([A-J]\d+) · (\S+) · (.+)$/gm;
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

  const out = [];
  for (const r of rows.values()) {
    const s = secs.get(r.code);
    if (!s) throw new Error(`thiếu PROMPT cho ${r.code}`);
    const kind = KIND[r.file.match(/^[a-z]+_/)[0]];
    let negative = kind === "nhan-vat" || kind === "thu-cuoi" ? NEG_NV : NEG_VK;
    if (r.code.startsWith("MOUNT_ngua")) negative += ", rider, person";
    if (r.code === "MOUNT_voi_chien") negative += ", rider, person, howdah, saddle";
    if (r.code === "NG_KY") negative += ", horse, saddle, sitting, mounted";
    const hero = r.group === "A" || r.group === "B" || r.group === "E";
    if (r.code.startsWith("MOUNT_ngua")) s.sym = "on"; // mục 0.2: bật đối xứng cho ngựa
    out.push({ ...r, ...s, kind, negative, person: kind === "nhan-vat", tris: targetTris(r.range), tex: hero ? 2048 : 1024 });
  }
  return out;
}

// Thứ tự làm theo mục 0.4 của tài liệu; "can" = những tệp game hiện tại cần (mục 1–4, 7–15, 17–41 trừ 23a, 49, 51).
const ORDER = [
  "H35", "WPN_songdao",
  "DV_GIAO", "WPN_giao_dv", "NG_DAO", "WPN_dao_linh", "WPN_khien_tron_ng", "NG_KY", "WPN_cung_ng", "MOUNT_ngua_nguyen", "PROP_mui_ten",
  "NG_GIAO", "WPN_giao_ng", "NG_CUNG", "DV_DAO", "WPN_khien_nhat_dv", "DV_NO", "WPN_no", "NG_TANK", "WPN_chuy",
  "H33", "H40", "WPN_cung_viet", "X19", "WPN_dadao", "OFF_doitruong", "WPN_dao", "OFF_photuong",
  "H31", "WPN_daikiem", "X20", "X24",
  "LINH_r01", "LINH_r24", "CV_khien", "CV_giao", "CV_cung", "CV_songdao", "CV_daidao", "OFF_tuong",
];
const SETS = { thu: ["H35", "WPN_songdao"], can: ORDER };

function pick(all) {
  const only = opt("only");
  if (only) return only.split(",").map((c) => all.find((a) => a.code === c.trim()) || die(`không có mã ${c}`));
  const set = opt("set", "can");
  if (set === "tat-ca") return [...ORDER.map((c) => all.find((a) => a.code === c)), ...all.filter((a) => !ORDER.includes(a.code))];
  if (!SETS[set]) die(`--set phải là thu | can | tat-ca`);
  return SETS[set].map((c) => all.find((a) => a.code === c));
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
const hash = (a) => createHash("sha1").update(a.prompt + "|" + a.tris + "|" + a.sym).digest("hex").slice(0, 10);

const cost = (model) => (model === "latest" || model === "meshy-6" ? 20 : 5) + 10; // preview + refine, theo bảng giá Meshy

async function renderOne(a, man, model, budget) {
  const m = man[a.code] && man[a.code].hash === hash(a) && man[a.code].model === model ? man[a.code] : { no: a.no, code: a.code, hash: hash(a), model };
  man[a.code] = m;
  const raw = join(RAW, `${m.hash}-${a.file}`); // gắn hash prompt: sửa prompt thì không dùng nhầm bản gốc cũ
  if (m.status === "done" && existsSync(join(OUT, a.kind, a.file))) { console.log(`= ${a.code} đã có`); return; }
  if (!existsSync(raw)) {
    if (!m.preview_id) {
      if (!budget.take(cost(model))) { m.status = "het-credit"; return; }
      m.preview_id = await create("/v2/text-to-3d", {
        mode: "preview", prompt: a.prompt, negative_prompt: a.negative, art_style: "realistic", ai_model: model,
        topology: "triangle", target_polycount: a.tris, should_remesh: true, symmetry_mode: a.sym,
        ...(a.person ? { pose_mode: "a-pose" } : {}),
      });
      saveManifest(man);
    }
    console.log(`→ ${a.code} preview ${m.preview_id}`);
    await wait(m.preview_id, `${a.code} lưới`);
    if (!m.refine_id) {
      m.refine_id = await create("/v2/text-to-3d", { mode: "refine", preview_task_id: m.preview_id, enable_pbr: false, remove_lighting: true, ai_model: model });
      saveManifest(man);
    }
    console.log(`→ ${a.code} refine ${m.refine_id}`);
    const t = await wait(m.refine_id, `${a.code} texture`);
    if (!t.model_urls?.glb) throw new Error(`${a.code}: Meshy không trả GLB`);
    await download(t.model_urls.glb, raw);
    if (t.thumbnail_url) await download(t.thumbnail_url, raw.replace(/\.glb$/, ".png")).catch(() => {});
  }
  Object.assign(m, await post(a, raw), { status: "done", tex: a.tex, target_tris: a.tris });
  saveManifest(man);
  console.log(`✓ ${a.code}: ${m.tris} tam giác (gốc ${m.tris_raw}), ${(m.bytes / 1048576).toFixed(2)} MB → ${m.path}`);
}

async function main() {
  const all = loadAssets();
  if (cmd === "list") {
    for (const a of pick(all)) console.log(`${a.no.padStart(3)} ${a.code.padEnd(20)} ${a.kind.padEnd(9)} ${String(a.tris).padStart(6)} tg  tex ${a.tex}  sym ${a.sym.padEnd(4)} ${a.prompt.length} ký tự  → ${a.kind}/${a.file}`);
    return;
  }
  if (cmd === "balance") { console.log(`Credit còn: ${await balance()}`); return; }
  const list = pick(all);
  const man = readManifest();
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
  const model = opt("model", "latest"), modelVk = opt("model-vk", model);
  const modelOf = (a) => (a.kind === "vu-khi" || a.kind === "dao-cu" ? modelVk : model);
  for (const a of list) if (a.prompt.length > 600) die(`${a.code}: prompt ${a.prompt.length} ký tự > 600`);
  const need = list.reduce((n, a) => n + (man[a.code]?.status === "done" ? 0 : cost(modelOf(a))), 0);
  if (flag("dry")) { console.log(`${list.length} mẫu, ước tính ${need} credit (${model} / vũ khí ${modelVk})`); return; }
  let left = await balance();
  console.log(`Credit còn: ${left}; ${list.length} mẫu, ước tính ${need} credit`);
  const budget = { take: (n) => { if (left < n) return false; left -= n; return true; } };
  const queue = [...list]; const errors = [];
  const worker = async () => {
    for (let a; (a = queue.shift());) {
      try { await renderOne(a, man, modelOf(a), budget); }
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

main().catch((e) => { console.error(e.message); process.exit(1); });
