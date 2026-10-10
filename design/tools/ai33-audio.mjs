// Sinh hiệu ứng âm thanh và lồng tiếng bằng API ai33 (OpenSpeaker): gửi tác vụ, chờ xong, tải bản MP3 gốc về <out>/<loại>/<tên>.mp3.
// Khoá API lấy từ biến môi trường AI33_KEY, không ghi vào tệp nào. Luôn chạy bằng Node (bash trên Windows làm hỏng dấu tiếng Việt / chữ Hán trong curl).
// Mọi tác vụ đã gửi ghi vào <out>/tasks.jsonl: chạy lại không gửi (không trả credit) lần nữa với tên đã có tác vụ, trừ khi --again.
//   AI33_KEY=… node design/tools/ai33-audio.mjs sfx   design/audio/sfx.json    [--only a,b] [--out dir] [--again] [--dry]
//   AI33_KEY=… node design/tools/ai33-audio.mjs voice <spec.json>              [--only a,b] [--out dir] [--again] [--dry]   (đọc lời bằng TTS; game hiện không dùng lồng tiếng)
//   node design/tools/ai33-audio.mjs voices <nhà cung cấp> <ngôn ngữ> [giới tính]   liệt kê giọng (cần khoá; chỉ đọc, không tốn credit)
// sfx.json:   [{ "name": "oar-1", "text": "…", "dur": 2, "loop": false, "infl": 0.5 }]   (50 credit mỗi giây; dur 0.5–22)
// voice: JSON { "voices": { "H35": "elevenlabs_…" }, "lines": [{ "name": "H35-bopNat-1", "voice": "H35", "text": "…", "speed": 1 }] }
//   (hậu kỳ cắt, chuẩn hoá, nén: game/tools/post-audio-3.py)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = "https://api.ai33.pro";
const [mode, spec, ...rest] = process.argv.slice(2);
const args = [mode, spec, ...rest];
const has = (k) => args.includes("--" + k);
const opt = (k, d) => { const i = args.indexOf("--" + k); return i < 0 ? d : args[i + 1]; };
const KEY = process.env.AI33_KEY;
if (!KEY) { console.error("Thiếu biến môi trường AI33_KEY"); process.exit(1); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(p, init = {}, tries = 6) {
  for (let i = 0; ; i++) {
    let r;
    try { r = await fetch(BASE + p, { ...init, headers: { "xi-api-key": KEY, ...(init.headers || {}) } }); }
    catch (e) { if (i < tries) { await sleep(2 ** i * 700); continue; } throw e; }
    const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = { raw: t }; }
    if ((r.status === 429 || r.status >= 500) && i < tries) { await sleep(((+r.headers.get("retry-after") || 2 ** i) + Math.random()) * 1000); continue; }
    if (!r.ok) throw new Error(`${p} → ${r.status} ${t.slice(0, 300)}`);
    return j;
  }
}

if (mode === "voices") {                                                   // voices <provider> <language> [gender]
  const [prov, lang, gender] = [spec, rest[0], rest[1]];
  const seen = new Map();
  for (let p = 1; p <= 3; p++) {
    const d = await api(`/v3/voices?provider=${prov}&language=${lang}${gender ? "&gender=" + gender : ""}&page_size=100&page=${p}`);
    for (const v of d.data || []) seen.set(v.voice_id, v);
    if (!d.pagination?.has_more) break;
  }
  for (const v of seen.values()) console.log(v.voice_id.padEnd(40), "|", (v.name || "").slice(0, 40).padEnd(40), "|", v.age || "", "|", (v.tags || []).join(",").slice(0, 80));
  process.exit(0);
}
if (!["sfx", "voice"].includes(mode) || !spec) { console.error("Cách dùng: ai33-audio.mjs sfx|voice <spec.json> | voices <provider> <language> [gender]"); process.exit(1); }

const OUT = opt("out", fileURLToPath(new URL("../glb/_raw/audio", import.meta.url)));
const dir = path.join(OUT, mode); fs.mkdirSync(dir, { recursive: true });
const STATE = path.join(OUT, "tasks.jsonl");
const readState = () => (fs.existsSync(STATE) ? fs.readFileSync(STATE, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
const addState = (r) => fs.appendFileSync(STATE, JSON.stringify(r) + "\n");

// voice: tệp JSON { voices, lines }
async function loadSpec() { return JSON.parse(fs.readFileSync(spec, "utf8")); }
const S = await loadSpec();
const only = (opt("only", "") || "").split(",").filter(Boolean);
const jobs = (mode === "sfx" ? S : S.lines).filter((j) => !only.length || only.includes(j.name));
const prior = new Map(readState().filter((r) => r.kind === mode).map((r) => [r.name, r.id]));      // tác vụ đã gửi: lấy lại kết quả, không gửi (không trả tiền) lần nữa
const todo = jobs.filter((j) => has("again") || !fs.existsSync(path.join(dir, j.name + ".mp3")));
console.log(`${jobs.length} mục, ${jobs.length - todo.length} đã có tệp, ${todo.length} cần làm (${todo.filter((j) => !has("again") && prior.has(j.name)).length} đã gửi trước đó, chỉ tải lại)`);

function cost(j) { return mode === "sfx" ? Math.max(50, Math.round((j.dur || 4) * 50)) : [...j.text].length; }
if (has("dry")) { for (const j of todo) console.log(j.name.padEnd(26), String(cost(j)).padStart(5), "|", j.text.slice(0, 90)); console.log("Tổng ≈", todo.reduce((s, j) => s + cost(j), 0), "credit"); process.exit(0); }

async function submit(j) {
  let r;
  if (mode === "sfx") {
    r = await api("/v1/task/sound-effect", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: j.text, duration_seconds: j.dur ?? 3, prompt_influence: j.infl ?? 0.5, loop: !!j.loop, model_id: "eleven_text_to_sound_v2" }) });
  } else {
    const voice = S.voices[j.voice] || j.voice, fd = new FormData();
    fd.append("text", j.text); fd.append("voice_id", voice); fd.append("speed", String(j.speed ?? 1)); fd.append("with_transcript", "false");
    r = await api("/v3/text-to-speech", { method: "POST", body: fd });
  }
  if (!r.task_id) throw new Error("không có task_id: " + JSON.stringify(r).slice(0, 200));
  addState({ kind: mode, name: j.name, id: r.task_id, at: new Date().toISOString(), text: j.text, voice: j.voice, dur: j.dur });
  return r.task_id;
}
async function fetchDone(id, name) {
  for (let i = 0; i < 200; i++) {
    const t = await api(`/v1/task/${id}`);
    if (/^(error|fail|cancel)/i.test(t.status)) throw new Error(`${name}: ${t.status} ${t.error_message || ""}`);
    if (/^(done|success|complete)/i.test(t.status)) {
      const u = t.metadata?.audio_url; if (!u) throw new Error(`${name}: không có audio_url`);
      const r = await fetch(u); if (!r.ok) throw new Error(`${name}: tải ${r.status}`);
      fs.writeFileSync(path.join(dir, name + ".mp3"), Buffer.from(await r.arrayBuffer()));
      return t.credit_cost;
    }
    await sleep(3000);
  }
  throw new Error(`${name}: quá hạn chờ`);
}

// gửi song song vừa phải (tối đa 4), chờ từng việc xong rồi tải
let next = 0, spent = 0, failed = 0;
await Promise.all(Array.from({ length: Math.min(4, todo.length) }, async () => {
  while (next < todo.length) {
    const j = todo[next++];
    try { const id = !has("again") && prior.get(j.name) || await submit(j); const c = await fetchDone(id, j.name); spent += c || 0; console.log(`ok  ${j.name} (${c} credit)`); }
    catch (e) { failed++; console.error(`LỖI ${j.name}: ${e.message}`); }
  }
}));
console.log(`Xong: ${todo.length - failed}/${todo.length}, ${spent} credit${failed ? `, ${failed} lỗi (chạy lại để gửi các mục còn thiếu; kiểm tra GET /v1/tasks trước khi dùng --again)` : ""}`);
process.exit(failed ? 1 : 0);
