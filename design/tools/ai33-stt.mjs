// Nghe lại giọng đã sinh bằng speech-to-text của ai33 để kiểm xem giọng có đọc đúng lời không (không có tai người thì đây là cách kiểm rẻ nhất).
//   AI33_KEY=… node design/tools/ai33-stt.mjs <tệp.mp3|m4a|wav> […]      in lời nhận dạng của từng tệp (6 credit mỗi tệp)
import fs from "node:fs";
import path from "node:path";
const KEY = process.env.AI33_KEY; if (!KEY) { console.error("Thiếu AI33_KEY"); process.exit(1); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function one(f) {
  const fd = new FormData(); fd.append("file", new Blob([fs.readFileSync(f)]), path.basename(f)); fd.append("tag_audio_events", "false");
  const r = await (await fetch("https://api.ai33.pro/v1/task/speech-to-text", { method: "POST", headers: { "xi-api-key": KEY }, body: fd })).json();
  if (!r.task_id) throw new Error(JSON.stringify(r).slice(0, 200));
  for (let i = 0; i < 100; i++) {
    const t = await (await fetch(`https://api.ai33.pro/v1/task/${r.task_id}`, { headers: { "xi-api-key": KEY } })).json();
    if (/^(error|fail)/i.test(t.status)) throw new Error(t.error_message || t.status);
    if (/^(done|success|complete)/i.test(t.status)) return t;
    await sleep(2500);
  }
  throw new Error("quá hạn");
}
// kết quả nằm ở tệp phụ đề (metadata.srt_url): bỏ số thứ tự và mốc thời gian, chỉ lấy chữ
const srtText = (srt) => srt.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !/^\d+$/.test(l) && !/-->/.test(l)).join(" ");
const files = process.argv.slice(2);
let k = 0;
await Promise.all(Array.from({ length: Math.min(4, files.length) }, async () => {
  while (k < files.length) {
    const f = files[k++];
    try {
      const t = await one(f), m = t.metadata || {};
      const text = m.srt_url ? srtText(await (await fetch(m.srt_url)).text()) : "";
      console.log(path.basename(f, path.extname(f)).padEnd(24), JSON.stringify(text || Object.keys(m)), `(${t.credit_cost} credit)`);
    } catch (e) { console.log(path.basename(f).padEnd(24), "LỖI", e.message); }
  }
}));
