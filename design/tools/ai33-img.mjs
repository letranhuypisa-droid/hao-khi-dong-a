// Sinh ảnh tham chiếu cho Hunyuan3D (ảnh → 3D) bằng API ai33: gửi /v1i/task/generate-image, chờ xong rồi tải ảnh về
// design/glb/_raw/img/<mã>/ (ngoài git). Khoá API lấy từ biến môi trường AI33_KEY, không ghi vào tệp nào.
// Nguồn prompt: design/hunyuan-prompts.md (tướng, lính: đã có POSE v3 tay nắm đấm) và design/glb-prompts.md (vũ khí, đạo cụ, ngựa, voi,
// thuyền, công trình, cảnh, cây đá, thú; tướng chưa có trong game và dân làng được đổi sang POSE v3 khi ghép).
// Máy chủ xếp hàng rất chậm (23 phút tới hơn 3 giờ mỗi tác vụ), nên mọi tác vụ đã gửi được ghi vào design/glb/_raw/img/tasks.jsonl;
// chạy lại với --collect để nhặt kết quả, không gửi (và không trả credit) lần nữa. Mã đã có tác vụ thì bị bỏ qua, trừ khi có --again.
//   AI33_KEY=… node design/tools/ai33-img.mjs --set weapons,props --price           tổng giá, chưa gửi
//   AI33_KEY=… node design/tools/ai33-img.mjs --set weapons,props --no-collect      gửi
//   AI33_KEY=… node design/tools/ai33-img.mjs --only WPN_giao_dv,ENV_cay_da         gửi vài mã (rồi chờ và tải luôn)
//   AI33_KEY=… node design/tools/ai33-img.mjs --collect                              nhặt mọi tác vụ chưa tải
//   node design/tools/ai33-img.mjs --status                                          xem tác vụ nào còn chờ (không cần khoá)
//   node design/tools/ai33-img.mjs --list                                            mọi mã, nhóm và kế hoạch (tỉ lệ, cỡ, chất lượng, số ảnh)
//   --set <nhóm,…>   weapons props mounts villagers boats buildings scenery nature animals heroes2 | objects (mọi nhóm không phải người) | all
//   --n --res --quality --ratio   ghi đè kế hoạch của nhóm (mặc định: xem --list)
//   --model <id>     mặc định gpt-image-2.5-sunburst (danh sách: GET /v1i/models)
//   --ref <ảnh>      ảnh tham chiếu, trong --extra gọi là @img1 (có thể lặp lại)
//   --extra "<câu>"  nối thêm vào cuối prompt
//   --adopt <task>:<mã>[:<n>]  ghi nhận tác vụ đã gửi trước đó vào tasks.jsonl
//   (máy chủ chỉ cho 20 tác vụ đang chờ cùng lúc: vòng điều khiển tự gửi dần theo chỗ trống và nhặt ảnh xen kẽ; --limit <số> đặt trần, mặc định 19)
//   --par <số>       số lần gửi song song (mặc định 3)
//   --no-collect     chỉ gửi những gì còn chỗ rồi thoát (chạy nhiều bộ nhặt song song sẽ tải trùng ảnh, nên chỉ chạy MỘT lệnh có nhặt)
//   --poll <giây>    chu kỳ hỏi trạng thái (mặc định 45); --max-hours <giờ> thôi chờ sau chừng đó (mặc định 12)
//   --dry            chỉ in prompt và kế hoạch, không gửi
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = "https://api.ai33.pro";
const args = process.argv.slice(2);
const has = (k) => args.includes("--" + k);
const opt = (k, d) => { const i = args.indexOf("--" + k); return i < 0 ? d : args[i + 1]; };
const opts = (k) => args.flatMap((a, i) => (a === "--" + k ? [args[i + 1]] : []));
const list = (k) => (opt(k, "") || "").split(",").filter(Boolean);
const o = {
  only: list("only"), sets: list("set"), model: opt("model", "gpt-image-2.5-sunburst"), refs: opts("ref"), extra: opt("extra", ""),
  force: { n: opt("n"), res: opt("res"), q: opt("quality"), ar: opt("ratio") },
  collect: has("collect"), status: has("status"), adopt: opts("adopt"), poll: +opt("poll", 45), maxHours: +opt("max-hours", 12),
  out: opt("out", fileURLToPath(new URL("../glb/_raw/img", import.meta.url))),
};

// ---- nguồn prompt ---------------------------------------------------------------------------------------------------------------
const rd = (f) => fs.readFileSync(new URL(f, import.meta.url), "utf8").replace(/\r\n/g, "\n");   // tệp có lúc được lưu CRLF
const hun = rd("../hunyuan-prompts.md");
const POSE = hun.match(/## Khối tư thế[^\n]*\n```text\n([^\n]+)\n```/)[1];                       // POSE v3 nguyên văn
const STYLE = "Stylized low-poly game character, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.";
const LEGS = "Robes, skirts and aprons end above the knees and are split at the front and back so both legs stay visible.";
// Model ảnh không có ô Negative (supports_negative_prompt: false), nên chặn bằng câu khẳng định ở cuối prompt.
const TAIL_CHAR = "The whole body is visible from head to feet with a small margin around. Single character only. No weapon, no shield, no cape, no banner, no text, no watermark.";
const TAIL_OBJ = "The whole object is visible and centered with a small margin around it. No extra ornaments, engravings or painted patterns beyond those described. Plain light grey background, even soft studio lighting, no cast shadow, no ground plane, no text, no watermark.";
const VIEW3Q = "Shown in a three-quarter front view with the camera slightly above the object, no perspective distortion.";

const cat = {};                                                                                   // mã → { id, kind, text }
for (const m of hun.matchAll(/^#{2,3} ([A-Za-z0-9_]+) · [^\n]*\n```text\n([^\n]+)\n```/gm)) cat[m[1]] = { id: m[1], kind: "char", text: m[2], group: "characters" };
const GROUP = (id, code) => /^G/.test(id) ? "weapons" : /^(H\d|J[45]|I[45])$/.test(id) ? "props" : /^I[123]$/.test(id) ? "mounts" : /^J[123]$/.test(id) ? "villagers"
  : /^K/.test(id) ? "boats" : /^L/.test(id) ? "buildings" : /^M/.test(id) ? "scenery" : /^N/.test(id) ? "nature" : /^O/.test(id) ? "animals"
  : /^(A([5-9]|1[0-5])|B([7-9]|1[0-3])|C4)$/.test(id) ? "heroes2" : "characters";
for (const part of rd("../glb-prompts.md").split(/^(?=### )/m)) {
  const h = part.match(/^### ([A-Z]\d+) · ([A-Za-z0-9_]+) · /);
  const b = part.match(/PROMPT[^\n]*\n```text\n([\s\S]*?)\n```/);
  if (!h || !b || /_v2$/.test(h[2]) || cat[h[2]]) continue;                                       // mục _v2 là bản làm lại Meshy, bỏ
  const group = GROUP(h[1], h[2]), text = b[1].replace(/\n/g, " ");
  if (group === "characters") continue;                                                           // tướng, lính đã có prompt Hunyuan ở trên
  if (/\bA-pose,/.test(text)) {                                                                   // người: đổi POSE cũ (tay mở) sang POSE v3 (nắm đấm)
    const desc = text.replace(/A-pose,[^.]*?mouth closed\./, "").replace(/Stylized low-poly game asset[^.]*\./, "").replace(/\s+/g, " ").trim();
    cat[h[2]] = { id: h[1], kind: "char", group, text: [desc, group === "villagers" ? "" : LEGS, POSE, STYLE].filter(Boolean).join(" ") };   // dân làng giữ váy, quần như thiết kế
  } else cat[h[2]] = { id: h[1], kind: "obj", group, text };
}

// ---- kế hoạch ảnh: mặc định theo nhóm, ghi đè theo mã ---------------------------------------------------------------------------
const D = {
  weapons: { ar: "1:3", res: "2K", q: "high", n: 2 }, props: { ar: "1:1", res: "1K", q: "high", n: 2 }, mounts: { ar: "3:2", res: "2K", q: "high", n: 2 },
  villagers: { ar: "2:3", res: "2K", q: "high", n: 2 }, heroes2: { ar: "2:3", res: "2K", q: "high", n: 2 }, characters: { ar: "2:3", res: "2K", q: "high", n: 4 },
  boats: { ar: "3:2", res: "2K", q: "high", n: 2 }, buildings: { ar: "4:3", res: "2K", q: "medium", n: 1 }, scenery: { ar: "1:1", res: "1K", q: "medium", n: 1 },
  nature: { ar: "1:1", res: "1K", q: "medium", n: 1 }, animals: { ar: "3:2", res: "2K", q: "high", n: 2 },
};
const S1 = { res: "1K" }, HI = { q: "high", n: 2 }, MED = { q: "medium" };   // khung vuông giá cao: vật đơn giản dùng chất lượng medium
const OV = {
  WPN_khien_tron_ng: { ar: "1:1", ...S1 }, WPN_khien_nhat_dv: { ar: "1:1", ...S1 }, WPN_quat: { ar: "1:1", ...S1, ...MED }, WPN_no: { ar: "3:2", ...S1 },
  WPN_cung_viet: { ar: "1:2" }, WPN_cung_ng: { ar: "1:2" }, WPN_duisat: { ar: "1:2", ...S1 }, WPN_moc_voi: { ar: "1:2", ...S1 },
  PROP_co_lung: { ar: "1:3" }, PROP_cape: { ar: "2:3", ...S1 }, PROP_mui_ten: { ar: "1:3", ...S1 }, PROP_ong_ten: { ar: "1:2", ...S1 }, PROP_banh_voi: { ar: "4:3" },
  PROP_quang_ganh: { ar: "2:1" }, PROP_non_la: MED, PROP_giap_voi: MED, PROP_tay_nai: MED,
  ENV_thung_cau: { ar: "1:1", ...S1, ...MED }, ENV_thuyen_do_luong: { ar: "2:1" }, ENV_thuyen_chien_tran: { ar: "2:1" }, ENV_thuyen_mui: { ar: "2:1" }, ENV_long_thuyen: { ar: "2:1" },
  ENV_cong_ham_tu: HI, ENV_canh_cong: { ar: "2:3" }, ENV_tuong_dat: { ar: "2:1", ...HI }, ENV_rao_coc: { ar: "3:2" }, ENV_thap_canh_nguyen: { ar: "2:3", ...HI },
  ENV_thap_canh_tran: { ar: "2:3", ...HI }, ENV_leu_tron: { ar: "1:1", n: 2 }, ENV_leu_vuong_nguyen: { ar: "1:1" }, ENV_khung_leu_chay: { ar: "1:1" }, ENV_leu_tran: { ar: "1:1" },
  ENV_nha_bat_chi_huy: HI, ENV_cau_tau_nhip: { ar: "2:1" }, ENV_cau_tau_dau: { ar: "3:2" }, ENV_ben_go: { ar: "3:1" }, ENV_lau_trong: { ar: "2:3" }, ENV_mieu: { ar: "1:1" },
  ENV_coc_bach_dang: { ar: "1:2" }, ENV_be_co: { ar: "3:2" }, ENV_go_chan_song: { ar: "3:1" }, ENV_cu_ma: { ar: "2:1" }, ENV_coc_luy_nguyen: { ar: "2:1" },
  ENV_ke_van: { ar: "3:2" }, ENV_coc_tre_tran: { ar: "2:1" }, ENV_rao_tre: { ar: "3:1" }, ENV_gia_binh_khi: { ar: "3:2" }, ENV_gia_cheo: { ar: "3:2" },
  ENV_xe_luong: { ar: "3:2" }, ENV_xe_luong_vo: { ar: "3:2" }, ENV_vac_lua: { ar: "2:3" }, ENV_bia_da: { ar: "1:2" }, ENV_hinh_nom: { ar: "1:2" }, ENV_xac_ngua: { ar: "3:2" },
  ENV_coc_buoc_ngua: { ar: "2:1" }, ENV_luoi_phoi: { ar: "3:2" }, ENV_phao_moc: { ar: "1:2" }, ENV_toi_neo: { ar: "3:2" }, ENV_cot_co: { ar: "1:3" }, ENV_co_duoi_ngua: { ar: "1:3" },
  ENV_coc_troi: { ar: "1:2" }, ENV_bo_ten_thu: { ar: "1:2" },
  ENV_khom_tre: { ar: "2:3" }, ENV_cay_tan_tron: { ar: "4:5" }, ENV_cay_gao: { ar: "2:3" }, ENV_cum_cau: { ar: "1:2" }, ENV_da_c: { ar: "3:2" }, ENV_go_da: { ar: "4:3" },
  ENV_nui_da_a: { ar: "1:2" }, ENV_nui_da_c: { ar: "4:5" }, ENV_day_nui_xa: { ar: "3:1" },
  ENV_co_dung: { ar: "2:3" }, ENV_qua: { ar: "1:1", ...S1, ...MED },
};
const plan = (code) => {
  const c = cat[code], p = { ...D[c.group], ...(OV[code] || {}) }, f = o.force;
  if (f.n) p.n = +f.n; if (f.res) p.res = f.res; if (f.q) p.q = f.q; if (f.ar) p.ar = f.ar;
  return p;
};
const full = (code) => {
  const c = cat[code];
  const tail = c.kind === "char" ? TAIL_CHAR : [c.group !== "weapons" && !/\b(front|back|side|top) view\b/i.test(c.text) ? VIEW3Q : "", TAIL_OBJ].filter(Boolean).join(" ");
  return [c.text, tail, o.extra].filter(Boolean).join(" ");
};
const params = (code) => { const p = plan(code); return { aspect_ratio: p.ar, resolution: p.res, quality: p.q }; };

fs.mkdirSync(o.out, { recursive: true });
const STATE = path.join(o.out, "tasks.jsonl");
const readState = () => (fs.existsSync(STATE) ? fs.readFileSync(STATE, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
const addState = (r) => fs.appendFileSync(STATE, JSON.stringify(r) + "\n");
const pending = () => { const st = readState(), fin = new Set(st.filter((r) => r.kind === "end").map((r) => r.id)); return st.filter((r) => r.kind === "task" && !fin.has(r.id)); };

if (o.status) {
  const st = readState(), ends = Object.fromEntries(st.filter((r) => r.kind === "end").map((r) => [r.id, r]));
  for (const t of st.filter((r) => r.kind === "task")) console.log(t.code.padEnd(26), t.id.slice(0, 8), t.n + " ảnh", t.params.resolution, ends[t.id] ? (ends[t.id].error ? "LỖI " + ends[t.id].error : "xong " + ends[t.id].files.length + " ảnh") : "đang chờ");
  process.exit(0);
}
if (has("list")) {
  for (const [code, c] of Object.entries(cat)) { const p = plan(code); console.log(c.group.padEnd(11), c.id.padEnd(4), code.padEnd(26), `${p.ar} ${p.res} ${p.q} n=${p.n}`); }
  process.exit(0);
}

// mã được chọn: --only và --set (bỏ mã đã có tác vụ, trừ --again)
const SETS = { objects: ["weapons", "props", "mounts", "boats", "buildings", "scenery", "nature", "animals"], all: ["weapons", "props", "mounts", "villagers", "boats", "buildings", "scenery", "nature", "animals", "heroes2"] };
const setNames = o.sets.flatMap((s) => SETS[s] || [s]);
for (const s of setNames) if (!D[s]) { console.error("Nhóm lạ:", s); process.exit(1); }
const picked = [...new Set([...o.only, ...Object.keys(cat).filter((c) => setNames.includes(cat[c].group))])];
for (const c of [...picked, ...o.adopt.map((a) => a.split(":")[1])]) if (!cat[c]) { console.error("Không có prompt cho", c); process.exit(1); }
const PRI = ["characters", "weapons", "props", "mounts", "boats", "buildings", "animals", "scenery", "nature", "villagers", "heroes2"];   // hàng đợi máy chủ chậm: gửi nhóm đang dùng trong game trước
picked.sort((a, b) => PRI.indexOf(cat[a].group) - PRI.indexOf(cat[b].group));
const sent = new Set(readState().filter((r) => r.kind === "task").map((r) => r.code));
const todo = picked.filter((c) => has("again") || !sent.has(c) || o.only.includes(c) && has("again"));
const skipped = picked.filter((c) => !todo.includes(c));
if (skipped.length) console.log(`Bỏ qua ${skipped.length} mã đã có tác vụ (thêm --again để gửi lại): ${skipped.join(" ")}`);
if (!picked.length && !o.collect && !o.adopt.length) { console.log("Mã có prompt:", Object.keys(cat).join(" "), "\nNhóm:", Object.keys(D).join(" ")); process.exit(0); }

const KEY = process.env.AI33_KEY;
if (!KEY && !has("dry")) { console.error("Thiếu biến môi trường AI33_KEY"); process.exit(1); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };

let logged = false;
// retry: "all" = thử lại cả khi 5xx hoặc lỗi mạng (hỏi trạng thái, giá); "429" = chỉ khi bị giới hạn tốc độ (gửi tác vụ: lỗi mơ hồ có thể đã tính tiền)
async function api(p, init = {}, retry = "all", tries = 8) {
  for (let i = 0; ; i++) {
    let r;
    try { r = await fetch(BASE + p, { ...init, headers: { "xi-api-key": KEY, ...(init.headers || {}) } }); }
    catch (e) { if (retry === "all" && i < tries) { await sleep((2 ** Math.min(i, 5) + Math.random()) * 1000); continue; } throw e; }
    if (!logged) { logged = true; console.log(`giới hạn tốc độ: ${r.headers.get("x-ratelimit-limit")}/s, burst ${r.headers.get("x-ratelimit-burst")}, còn ${r.headers.get("x-ratelimit-remaining")} (${r.headers.get("x-ratelimit-scope")})`); }
    const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = { raw: t }; }
    // máy chủ chỉ cho 20 tác vụ đang chờ cùng lúc: báo lên để vòng gửi tự đợi, không thử lại ở đây
    if (r.status === 429 && j.code === "active_task_limit") { const e = new Error(j.message); e.code = "active_task_limit"; throw e; }
    if ((r.status === 429 || (retry === "all" && r.status >= 500)) && i < tries) { await sleep(((+r.headers.get("retry-after") || 2 ** Math.min(i, 5)) + Math.random()) * 1000); continue; }
    if (!r.ok) throw new Error(`${p} → ${r.status} ${t.slice(0, 300)}`);
    return j;
  }
}

async function submit(code) {
  const p = plan(code), fd = new FormData();
  fd.append("prompt", full(code));
  fd.append("model_id", o.model);
  fd.append("generations_count", String(p.n));
  fd.append("model_parameters", JSON.stringify(params(code)));
  for (const f of o.refs) fd.append("assets", new Blob([fs.readFileSync(f)], { type: MIME[path.extname(f).toLowerCase()] || "image/png" }), path.basename(f));
  const j = await api("/v1i/task/generate-image", { method: "POST", body: fd }, "429");
  if (!j.task_id) throw new Error("không có task_id: " + JSON.stringify(j).slice(0, 300));
  addState({ kind: "task", id: j.task_id, code, n: p.n, model: o.model, params: params(code), refs: o.refs, prompt: full(code), at: new Date().toISOString(), credits_left: j.ec_remain_credits });
  console.log(`[${code}] gửi xong, task ${j.task_id.slice(0, 8)}, còn ${j.ec_remain_credits} credit`);
}

// Địa chỉ ảnh kết quả: metadata.result_images[].imageUrl (bản xem trước previewUrl và audio_url trùng ảnh đầu thì bỏ)
function resultUrls(md) {
  if (Array.isArray(md?.result_images) && md.result_images.length) return md.result_images.map((r) => r.imageUrl).filter(Boolean);
  return [];
}

async function download(t, task) {
  const urls = resultUrls(t.metadata);
  const dir = path.join(o.out, task.code); fs.mkdirSync(dir, { recursive: true });
  let k = fs.readdirSync(dir).filter((f) => new RegExp(`^${task.code}-\\d+\\.`).test(f)).length;
  const files = [];
  for (const u of urls) {
    const r = await fetch(u); if (!r.ok) throw new Error(`tải ${u} → ${r.status}`);
    const ext = ((u.split("?")[0].match(/\.(png|jpe?g|webp)$/i) || [])[1] || (r.headers.get("content-type") || "").split("/")[1] || "png").toLowerCase();
    const f = path.join(dir, `${task.code}-${String(++k).padStart(2, "0")}.${ext}`);
    fs.writeFileSync(f, Buffer.from(await r.arrayBuffer())); files.push(path.basename(f));
  }
  return files;
}

const seen = {};
async function collectOnce() {                                                      // một lượt hỏi trạng thái mọi tác vụ chưa xong, tải ảnh những cái đã xong
  for (const task of pending()) {
    let t;
    try { t = await api(`/v1/task/${task.id}`); } catch (e) { console.error(`[${task.code}] hỏi trạng thái lỗi: ${e.message}`); continue; }
    const s = `${t.status} ${t.progress ?? ""}`;
    if (seen[task.id] !== s) { console.log(`${new Date().toLocaleTimeString("vi-VN")} [${task.code}] ${task.id.slice(0, 8)} ${s}`); seen[task.id] = s; }
    if (/^(error|fail|cancel)/i.test(t.status)) { addState({ kind: "end", id: task.id, error: `${t.status} ${t.error_message || ""}`.trim() }); console.error(`[${task.code}] LỖI ${t.status} ${t.error_message || ""}`); }
    else if (/^(done|success|complete)/i.test(t.status)) {
      const files = await download(t, task).catch((e) => { console.error(`[${task.code}] tải lỗi: ${e.message}`); return null; });
      if (!files) continue;                                                         // thử lại ở vòng sau
      addState({ kind: "end", id: task.id, files, credit_cost: t.credit_cost });
      console.log(`[${task.code}] đã tải ${files.length} ảnh: ${files.join(" ")}`);
      if (!files.length) console.log(`[${task.code}] metadata không có result_images:`, Object.keys(t.metadata || {}).join(","));
    }
    await sleep(300);
  }
}

// Số tác vụ đang chờ trên máy chủ (mọi loại, kể cả do phiên khác gửi): máy chủ từ chối từ 20 trở lên (active_task_limit)
async function active() {
  const j = await api("/v1/tasks?page=1&limit=100");
  return (j.data || []).filter((t) => !/^(done|success|complete|error|fail|cancel)/i.test(t.status)).length;
}

// Gửi dần theo chỗ trống của hàng đợi máy chủ, xen kẽ nhặt kết quả; chạy tới khi gửi hết và nhặt hết (hoặc quá --max-hours)
async function pipeline(codes) {
  const queue = [...codes], LIMIT = +opt("limit", 19), par = +opt("par", 3), t0 = Date.now();
  let failed = 0;
  for (;;) {
    if (queue.length) {
      const room = Math.max(0, LIMIT - (await active())), batch = queue.splice(0, room), back = [];
      let i = 0;
      await Promise.all(Array.from({ length: Math.min(par, batch.length) }, async (_, w) => {
        await sleep(w * 500);
        while (i < batch.length) {
          const c = batch[i++];
          try { await submit(c); }
          catch (e) { if (e.code === "active_task_limit") back.push(c); else { failed++; console.error(`[${c}] LỖI gửi (kiểm tra GET /v1/tasks trước khi gửi lại): ${e.message}`); } }
        }
      }));
      queue.unshift(...back);
      if (batch.length && !back.length) console.log(`đã gửi ${batch.length} mã, còn ${queue.length} mã trong hàng chờ gửi`);
    }
    if (has("no-collect")) { if (queue.length) console.log(`Còn ${queue.length} mã chưa gửi (hàng đợi máy chủ đầy): chạy lại không có --no-collect để gửi dần.`); return failed; }
    await collectOnce();
    const left = pending().length;
    if (!queue.length && !left) { console.log("Xong hết."); return failed; }
    if (Date.now() - t0 > o.maxHours * 3600e3) { console.log(`Quá ${o.maxHours} giờ, còn ${left} tác vụ chờ và ${queue.length} mã chưa gửi (chạy lại để tiếp tục).`); return failed; }
    await sleep((queue.length ? Math.min(o.poll, 25) : o.poll) * 1000);
  }
}

if (has("dry")) {
  for (const c of todo) console.log(`--- ${c} (${cat[c].group}) ${JSON.stringify(plan(c))}\n${full(c)}\n`);
  process.exit(0);
}
if (has("price")) {
  let sum = 0, imgs = 0;
  for (const c of todo) {
    const p = plan(c), j = await api("/v1i/task/price", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model_id: o.model, generations_count: p.n, model_parameters: params(c), assets: o.refs.length }) });
    sum += j.credits; imgs += p.n; console.log(c.padEnd(26), `${p.ar} ${p.res} ${p.q} n=${p.n}`.padEnd(22), j.credits);
  }
  console.log(`Tổng: ${todo.length} mã, ${imgs} ảnh, ${sum} credit`);
  process.exit(0);
}
for (const a of o.adopt) {
  const [id, code, n] = a.split(":");
  if (readState().some((r) => r.kind === "task" && r.id === id)) continue;
  addState({ kind: "task", id, code, n: +(n || plan(code).n), model: o.model, params: params(code), refs: o.refs, prompt: full(code), at: new Date().toISOString(), adopted: true });
  console.log(`[${code}] nhận tác vụ ${id.slice(0, 8)}`);
}
if (o.adopt.length && !todo.length && !o.collect) process.exit(0);
const failed = await pipeline(todo);
if (failed) console.error(`${failed} mã gửi lỗi`);
process.exit(failed ? 1 : 0);
