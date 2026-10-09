// tools/dev-server.mjs — máy chủ tĩnh cho game khi phát triển: phục vụ thư mục game/ ở gốc, KHÔNG cache (sửa module là thấy ngay, không
// phải làm mới cache trình duyệt), MIME đúng cho .js (ES module), .mjs, .json, .webp, .avif, .m4a, .wav, .hkm, .glb.
//   node game/tools/dev-server.mjs [cổng]      mặc định 8942 → http://localhost:8942/
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.argv[2]) || 8942;
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".webp": "image/webp", ".avif": "image/avif", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml",
  ".m4a": "audio/mp4", ".wav": "audio/wav", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".glb": "model/gltf-binary", ".hkm": "application/octet-stream", ".txt": "text/plain; charset=utf-8" };

http.createServer((req, res) => {
  let rel;
  try { rel = decodeURIComponent(new URL(req.url, "http://x").pathname); } catch { res.writeHead(400).end(); return; }
  let file = path.join(ROOT, rel.endsWith("/") ? rel + "index.html" : rel);
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }       // không thoát khỏi thư mục game
  fs.stat(file, (e, st) => {
    if (e || !st.isFile()) { res.writeHead(404, { "Cache-Control": "no-store" }).end("404"); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream", "Content-Length": st.size, "Cache-Control": "no-store" });
    fs.createReadStream(file).pipe(res);
  });
}).listen(PORT, () => console.log(`game: http://localhost:${PORT}/  (thư mục ${ROOT})`));
