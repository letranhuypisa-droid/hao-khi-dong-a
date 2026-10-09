// design/tools/serve.mjs — máy chủ tĩnh phục vụ GỐC KHO (để trang trong design/ nạp game/vendor/three và GLB), không cache, thêm hai đường phụ cho công cụ soát GLB:
//   GET  /__list?dir=design            → JSON tên các tệp .glb trong thư mục đó (tương đối gốc kho)
//   POST /__save?name=abc.jpg          → ghi thân yêu cầu vào <saveDir>/abc.jpg (saveDir mặc định design/glb/_raw/sheets, đã ngoài git)
//   node design/tools/serve.mjs [cổng] [saveDir]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PORT = Number(process.argv[2]) || 8950;
const SAVE = path.resolve(process.argv[3] || path.join(ROOT, "design/glb/_raw/sheets"));
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".glb": "model/gltf-binary", ".webp": "image/webp", ".md": "text/plain; charset=utf-8" };

http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname === "/__list") {
    const dir = path.join(ROOT, u.searchParams.get("dir") || "design");
    if (!dir.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    const names = fs.readdirSync(dir).filter((f) => /\.glb$/i.test(f)).sort();
    res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(names));
    return;
  }
  if (u.pathname === "/__save" && req.method === "POST") {
    const name = path.basename(u.searchParams.get("name") || "out.bin");
    fs.mkdirSync(SAVE, { recursive: true });
    const chunks = [];
    req.on("data", (c) => chunks.push(c)).on("end", () => { fs.writeFileSync(path.join(SAVE, name), Buffer.concat(chunks)); res.writeHead(200).end("ok " + path.join(SAVE, name)); });
    return;
  }
  let rel;
  try { rel = decodeURIComponent(u.pathname); } catch { res.writeHead(400).end(); return; }
  const file = path.join(ROOT, rel.endsWith("/") ? rel + "index.html" : rel);
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  fs.stat(file, (e, st) => {
    if (e || !st.isFile()) { res.writeHead(404, { "Cache-Control": "no-store" }).end("404"); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream", "Content-Length": st.size, "Cache-Control": "no-store" });
    fs.createReadStream(file).pipe(res);
  });
}).listen(PORT, () => console.log(`kho: http://localhost:${PORT}/  (gốc ${ROOT}, lưu ảnh ${SAVE})`));
