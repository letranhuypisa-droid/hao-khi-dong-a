// design/tools/glb-scan.mjs — quét nhanh GLB (chỉ đọc đầu tệp + vài byte đầu ảnh nhúng, không nạp cả tệp): hợp lệ không, số lưới / đỉnh / tam giác, vật liệu, ảnh nhúng (cỡ px, loại),
// hộp bao (m, đã nhân biến đổi nút), xương / clip, phần mở rộng. Dùng để soát lô GLB mới thả vào design/ trước khi nén / đưa vào game.
//   node design/tools/glb-scan.mjs <thư-mục hoặc tệp.glb ...> [--json ra.json] [--match chuỗi]
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const jsonOut = opt("--json"), match = opt("--match");
const inputs = args.length ? args : ["."];
const files = [];
for (const p of inputs) {
  if (fs.statSync(p).isDirectory()) for (const f of fs.readdirSync(p).sort()) { if (/\.glb$/i.test(f) && (!match || f.includes(match))) files.push(path.join(p, f)); }
  else files.push(p);
}

const COMP = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }, NCOMP = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

function imageInfo(fd, j, binStart, img) {
  if (img.bufferView === undefined) return { kind: img.uri?.startsWith("data:") ? "data-uri" : "uri", w: 0, h: 0, bytes: 0 };   // ảnh ngoài / data URI: không đọc
  const bv = j.bufferViews[img.bufferView];
  const buf = Buffer.alloc(Math.min(bv.byteLength, 65536));
  fs.readSync(fd, buf, 0, buf.length, binStart + (bv.byteOffset || 0));
  if (buf.readUInt32BE(0) === 0x89504e47) return { kind: "png", w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), bytes: bv.byteLength };
  if (buf[0] === 0xff && buf[1] === 0xd8) {                       // JPEG: tìm SOF0..SOF2
    for (let i = 2; i + 9 < buf.length;) {
      if (buf[i] !== 0xff) { i++; continue; }
      const m = buf[i + 1], len = buf.readUInt16BE(i + 2);
      if (m >= 0xc0 && m <= 0xc2) return { kind: "jpg", w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5), bytes: bv.byteLength };
      i += 2 + len;
    }
    return { kind: "jpg", w: 0, h: 0, bytes: bv.byteLength };
  }
  return { kind: img.mimeType || "?", w: 0, h: 0, bytes: bv.byteLength };
}

// hợp hộp bao của mọi lưới qua cây nút (tịnh tiến, quay quaternion, tỉ lệ; bỏ qua ma trận nút — hiếm trong Hunyuan / Meshy)
function worldBox(j) {
  const mul = (a, b) => { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
  const local = (n) => {
    if (n.matrix) return n.matrix;
    const [x, y, z, w] = n.rotation || [0, 0, 0, 1], [sx, sy, sz] = n.scale || [1, 1, 1], [tx, ty, tz] = n.translation || [0, 0, 0];
    return [(1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0, 2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
      2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0, tx, ty, tz, 1];
  };
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  const walk = (i, M) => {
    const n = j.nodes[i], W = mul(M, local(n));
    if (n.mesh !== undefined) for (const p of j.meshes[n.mesh].primitives) {
      const a = j.accessors[p.attributes.POSITION]; if (!a.min || !a.max) continue;
      for (let c = 0; c < 8; c++) {
        const v = [c & 1 ? a.max[0] : a.min[0], c & 2 ? a.max[1] : a.min[1], c & 4 ? a.max[2] : a.min[2]];
        for (let k = 0; k < 3; k++) { const q = W[k] * v[0] + W[4 + k] * v[1] + W[8 + k] * v[2] + W[12 + k]; lo[k] = Math.min(lo[k], q); hi[k] = Math.max(hi[k], q); }
      }
    }
    for (const c of n.children || []) walk(c, W);
  };
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  for (const r of j.scenes?.[j.scene || 0]?.nodes || []) walk(r, I);
  return lo[0] === Infinity ? null : { lo, hi, size: hi.map((v, k) => v - lo[k]) };
}

function scan(file) {
  const out = { file: path.basename(file), mb: +(fs.statSync(file).size / 1048576).toFixed(1), ok: false };
  const fd = fs.openSync(file, "r");
  try {
    const head = Buffer.alloc(20); fs.readSync(fd, head, 0, 20, 0);
    if (head.toString("ascii", 0, 4) !== "glTF") { out.err = "không phải GLB"; return out; }
    const total = head.readUInt32LE(8), jl = head.readUInt32LE(12);
    if (total !== fs.statSync(file).size) out.warn = `độ dài khai ${total} ≠ ${fs.statSync(file).size}`;
    const jb = Buffer.alloc(jl); fs.readSync(fd, jb, 0, jl, 20);
    const j = JSON.parse(jb.toString("utf8")), binStart = 20 + jl + 8;
    let verts = 0, tris = 0, prims = 0, noNormal = 0, noUV = 0, noIdx = 0;
    for (const m of j.meshes || []) for (const p of m.primitives) {
      prims++; const pa = j.accessors[p.attributes.POSITION]; verts += pa.count;
      if (p.attributes.NORMAL === undefined) noNormal++; if (p.attributes.TEXCOORD_0 === undefined) noUV++;
      if (p.indices !== undefined) tris += j.accessors[p.indices].count / 3; else { tris += pa.count / 3; noIdx++; }
    }
    const imgs = (j.images || []).map((im) => imageInfo(fd, j, binStart, im));
    const box = worldBox(j);
    Object.assign(out, { ok: true, meshes: (j.meshes || []).length, prims, verts, tris: Math.round(tris), mats: (j.materials || []).length, imgs, skins: (j.skins || []).length, anims: (j.animations || []).length,
      ext: j.extensionsUsed || [], size: box ? box.size.map((v) => +v.toFixed(3)) : null, lo: box ? box.lo.map((v) => +v.toFixed(3)) : null, noNormal, noUV, noIdx,
      tex: [...new Set((j.materials || []).flatMap((m) => ["baseColorTexture", "metallicRoughnessTexture"].filter((k) => m.pbrMetallicRoughness?.[k]).map((k) => k.replace("Texture", "")).concat(m.normalTexture ? ["normal"] : [], m.emissiveTexture ? ["emissive"] : [])))] });
  } catch (e) { out.err = e.message; } finally { fs.closeSync(fd); }
  return out;
}

const rows = files.map(scan);
const fmt = (r) => r.ok
  ? [r.file.padEnd(28), String(r.mb).padStart(5) + "MB", String(r.tris).padStart(8) + "▲", String(r.verts).padStart(8) + "v", `m${r.meshes}/p${r.prims}`.padEnd(8), `mat${r.mats}`, r.imgs.map((i) => `${i.w}×${i.h}${i.kind}`).join("+").padEnd(18),
    r.size ? r.size.map((v) => v.toFixed(2)).join(" × ").padEnd(20) : "—".padEnd(20), r.skins ? `skin${r.skins}` : "", r.anims ? `anim${r.anims}` : "", r.noUV ? `noUV${r.noUV}` : "", r.noNormal ? `noN${r.noNormal}` : "", r.warn || ""].join(" ")
  : `${r.file.padEnd(28)} LỖI: ${r.err}`;
for (const r of rows) console.log(fmt(r));
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(rows, null, 1));
const okRows = rows.filter((r) => r.ok);
console.log(`\n${rows.length} tệp, ${rows.length - okRows.length} lỗi, ${okRows.reduce((s, r) => s + r.mb, 0).toFixed(0)} MB, tổng ${Math.round(okRows.reduce((s, r) => s + r.tris, 0) / 1000)}k tam giác`);
