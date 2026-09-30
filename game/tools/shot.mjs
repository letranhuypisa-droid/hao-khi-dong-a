// tools/shot.mjs — chụp màn hình game bằng Chrome headless qua CDP (không cần pane trình duyệt).
//
//   node hao-khi-viet/game/tools/shot.mjs <kịch-bản.mjs> [--port 8942] [--w 1280] [--h 720]
//
// Kịch bản là module export default async (p) => { ... } với p:
//   p.go(path)            mở trang (đường dẫn tính từ gốc repo, vd "/hao-khi-viet/game/?debug")
//   p.eval(js)            chạy biểu thức JS trong trang (có await), trả giá trị JSON
//   p.shot(file)          chụp màn ra file PNG (đường dẫn tuyệt đối hoặc tính từ thư mục hiện tại)
//   p.wait(ms)            chờ giờ thật
//   p.errors              lỗi console / ngoại lệ đã gặp (in ra khi xong)
//
// Ví dụ vào trận rồi tua 5 s:
//   await p.go("/hao-khi-viet/game/?debug");
//   await p.eval(`__start()`); await p.wait(2500);
//   await p.eval(`__hk.advance(5, __bot(__objective), true)`);
//   await p.shot("a.png");
//
// WebGL chạy bằng SwiftShader (phần mềm) nên chậm hơn máy thật nhiều: đừng đo FPS bằng công cụ này.

import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf("--" + k); return i >= 0 ? args[i + 1] : d; };
const script = args.find((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")));
if (!script) { console.error("cần đường dẫn kịch bản"); process.exit(2); }
const PORT = Number(opt("port", process.env.PORT || 8942)), W = Number(opt("w", 1280)), H = Number(opt("h", 720));

const CHROME = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find((p) => existsSync(p));
if (!CHROME) { console.error("không tìm thấy Chrome"); process.exit(2); }

const dir = mkdtempSync(join(tmpdir(), "hk-shot-"));
const chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${dir}`, `--window-size=${W},${H}`,
  "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--no-first-run", "--no-default-browser-check",
  "--autoplay-policy=no-user-gesture-required", "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "about:blank"],
  { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let port = 0;
for (let i = 0; i < 600 && !port; i++) {          // tới 60 s: máy bận (nhiều Chrome headless) mở chậm
  await sleep(100);
  try { port = Number(readFileSync(join(dir, "DevToolsActivePort"), "utf8").split("\n")[0]); } catch (_) {}
}
if (!port) { console.error("Chrome không mở cổng gỡ lỗi"); chrome.kill(); process.exit(2); }
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = targets.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let seq = 0; const pending = new Map(), waiters = [];
const errors = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); return; }
  if (m.method === "Runtime.exceptionThrown") errors.push("ngoại lệ: " + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
  if (m.method === "Runtime.consoleAPICalled" && (m.params.type === "error" || m.params.type === "warning" || m.params.type === "assert"))
    errors.push(`console.${m.params.type}: ` + m.params.args.map((a) => a.value ?? a.description ?? "").join(" "));
  for (let i = waiters.length - 1; i >= 0; i--) if (waiters[i].method === m.method) { waiters[i].res(m.params); waiters.splice(i, 1); }
};
const send = (method, params = {}) => new Promise((res, rej) => { const id = ++seq; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params })); });
const once = (method, ms = 30000) => new Promise((res, rej) => { waiters.push({ method, res }); setTimeout(() => rej(new Error("hết giờ chờ " + method)), ms); });

await send("Page.enable"); await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: false });

const p = {
  errors,
  async go(path) { const load = once("Page.loadEventFired", 60000); await send("Page.navigate", { url: `http://localhost:${PORT}${path}` }); await load; await sleep(300); },
  async eval(js) {
    const r = await send("Runtime.evaluate", { expression: `(async () => (${js}))()`, awaitPromise: true, returnByValue: true, timeout: 600000 });
    if (r.exceptionDetails) throw new Error("eval: " + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    return r.result.value;
  },
  async shot(file) {
    const r = await send("Page.captureScreenshot", { format: "png" });
    const out = resolve(file); writeFileSync(out, Buffer.from(r.data, "base64")); console.log("ảnh: " + out); return out;
  },
  wait: sleep,
};

let code = 0;
try { const mod = await import(pathToFileURL(resolve(script)).href); await mod.default(p); }
catch (e) { console.error("LỖI kịch bản: " + e.message); code = 1; }
if (errors.length) { console.log(`-- ${errors.length} lỗi console:`); for (const e of [...new Set(errors)].slice(0, 30)) console.log("   " + e); }
ws.close(); chrome.kill();
await sleep(300); try { rmSync(dir, { recursive: true, force: true }); } catch (_) {}
process.exit(code);
