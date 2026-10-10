// design/tools/bake/io.mjs — đọc GLB Meshy (đã nén ở design/glb/), giảm lưới, ghi định dạng nhẹ .hkm cho game.
//
// .hkm (Hào Khí Model): "HKM1" · u32 độ dài JSON · JSON (utf8, đệm tới bội 4) · các khối nhị phân (mỗi khối bắt đầu ở bội 4).
// JSON: { v: 1, meshes: { tên: { count, index: khối, attrs: { position, normal, uv, skinIndex, skinWeight, … } } }, … }
// mỗi khối: { o: vị trí byte tính từ đầu vùng nhị phân, n: số phần tử, t: "f32" | "i8n" | "u16n" | "u8" | "u8n" | "u16" | "u32",
// s: số thành phần }. game/js/battle/glb.js đọc ngược lại thành BufferGeometry.

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { weld as gtWeld, simplify, dedup, prune } from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

// Đọc GLB, giảm còn ~tris tam giác (nếu nhiều hơn), trả mảng gộp mọi primitive (một vật liệu) + ảnh texture màu.
export async function readGLB(file, tris = Infinity) {
  const doc = await io.read(file);
  const count = () => doc.getRoot().listMeshes().reduce((n, m) => n + m.listPrimitives().reduce((k, p) => k + (p.getIndices()?.getCount() ?? p.getAttribute("POSITION").getCount()) / 3, 0), 0);
  const before = count();
  if (before > tris * 1.05) {
    await MeshoptSimplifier.ready;
    await doc.transform(gtWeld(), simplify({ simplifier: MeshoptSimplifier, ratio: tris / before, error: 0.1, lockBorder: false }), dedup(), prune());
  }
  const pos = [], uv = [], idx = [];
  let image = null;
  // Mỗi lưới theo ma trận thế giới của node chứa nó (Hunyuan3D lưu lưới trục Z lên kèm phép quay 90° trong node; Meshy ma trận đơn vị: bỏ qua, giữ nguyên số liệu).
  const parts = [];
  for (const n of doc.getRoot().listNodes()) { const m = n.getMesh(); if (m) for (const p of m.listPrimitives()) parts.push([p, n.getWorldMatrix()]); }
  if (!parts.length) for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) parts.push([p, null]);
  const isId = (M) => !M || M.every((v, i) => Math.abs(v - (i % 5 === 0 ? 1 : 0)) < 1e-9);
  for (const [p, M] of parts) {
    const P = p.getAttribute("POSITION").getArray(), T = p.getAttribute("TEXCOORD_0")?.getArray(), base = pos.length / 3;
    if (isId(M)) for (let i = 0; i < P.length; i++) pos.push(P[i]);
    else for (let i = 0; i < P.length; i += 3) {
      const x = P[i], y = P[i + 1], z = P[i + 2];
      pos.push(M[0] * x + M[4] * y + M[8] * z + M[12], M[1] * x + M[5] * y + M[9] * z + M[13], M[2] * x + M[6] * y + M[10] * z + M[14]);
    }
    for (let i = 0; i < P.length / 3; i++) uv.push(T ? T[i * 2] : 0, T ? T[i * 2 + 1] : 0);
    const I = p.getIndices()?.getArray() ?? Uint32Array.from({ length: P.length / 3 }, (_, i) => i);
    for (const i of I) idx.push(i + base);
    const tex = p.getMaterial()?.getBaseColorTexture();
    if (tex && !image) image = tex.getImage();
  }
  return { pos: new Float32Array(pos), uv: new Float32Array(uv), idx: new Uint32Array(idx), image, trisBefore: before, tris: idx.length / 3 };
}

// Pháp tuyến mượt tính trên lưới đã hàn theo vị trí (đường may UV không thành gờ sáng tối).
export function smoothNormals(pos, idx) {
  const key = new Map(), id = new Int32Array(pos.length / 3);
  for (let v = 0; v < id.length; v++) {
    const k = `${Math.round(pos[v * 3] * 1e4)},${Math.round(pos[v * 3 + 1] * 1e4)},${Math.round(pos[v * 3 + 2] * 1e4)}`;
    let g = key.get(k); if (g === undefined) { g = key.size; key.set(k, g); } id[v] = g;
  }
  const acc = new Float64Array(key.size * 3);
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2];
    const ux = pos[b * 3] - pos[a * 3], uy = pos[b * 3 + 1] - pos[a * 3 + 1], uz = pos[b * 3 + 2] - pos[a * 3 + 2];
    const vx = pos[c * 3] - pos[a * 3], vy = pos[c * 3 + 1] - pos[a * 3 + 1], vz = pos[c * 3 + 2] - pos[a * 3 + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;          // độ dài ∝ diện tích: mặt lớn nặng hơn
    for (const v of [a, b, c]) { const g = id[v] * 3; acc[g] += nx; acc[g + 1] += ny; acc[g + 2] += nz; }
  }
  const out = new Float32Array(pos.length);
  for (let v = 0; v < id.length; v++) {
    const g = id[v] * 3, L = Math.hypot(acc[g], acc[g + 1], acc[g + 2]) || 1;
    out[v * 3] = acc[g] / L; out[v * 3 + 1] = acc[g + 1] / L; out[v * 3 + 2] = acc[g + 2] / L;
  }
  return out;
}

// Ảnh texture → WebP cạnh size (vuông), hoặc ghép atlas: parts = [{ image, x, y, w, h }] trên nền w × h.
export async function writeTexture(file, image, size, quality = 82) {
  mkdirSync(dirname(file), { recursive: true });
  await sharp(Buffer.from(image)).resize(size, size, { fit: "fill" }).webp({ quality }).toFile(file);
}
// ảnh nhúng trong GLB → điểm ảnh thô { data, w, h, ch } (lấy mẫu màu, nướng lại texture)
export async function rawImage(image) {
  const { data, info } = await sharp(Buffer.from(image)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height, ch: info.channels };
}
// ảnh RGB thô { data, w, h } (texture nướng của lính đám đông, rebake.mjs), thu nhỏ cho vừa max × max (UV chuẩn hoá nên giữ đúng)
export async function writeRaw(file, img, max = 512, quality = 82) {
  mkdirSync(dirname(file), { recursive: true });
  await sharp(Buffer.from(img.data), { raw: { width: img.w, height: img.h, channels: 3 } }).resize(max, max, { fit: "inside", withoutEnlargement: true }).webp({ quality }).toFile(file);
}

// ---- ghi .hkm ----------------------------------------------------------------------------------------------------------------
const TYPES = {
  f32: [Float32Array, 4], i8n: [Int8Array, 1], u16n: [Uint16Array, 2], u8: [Uint8Array, 1], u8n: [Uint8Array, 1], u16: [Uint16Array, 2], u32: [Uint32Array, 4],
};
export function packMesh(m) {
  // m: { pos, nor, uv, idx, si?, sw?, extra?: { tên: { a: TypedArray đã đúng kiểu, t, s } } }
  const n = m.pos.length / 3, attrs = {};
  attrs.position = { a: m.pos, t: "f32", s: 3 };
  attrs.normal = { a: Int8Array.from(m.nor, (x) => Math.round(Math.max(-1, Math.min(1, x)) * 127)), t: "i8n", s: 3 };
  if (m.uv) attrs.uv = { a: Uint16Array.from(m.uv, (x) => Math.round(Math.max(0, Math.min(1, x)) * 65535)), t: "u16n", s: 2 };   // môi trường màu phẳng (env.mjs): không UV
  if (m.si) attrs.skinIndex = { a: m.si, t: "u8", s: 4 };
  if (m.sw) attrs.skinWeight = { a: m.sw, t: "u8n", s: 4 };
  for (const [k, v] of Object.entries(m.extra || {})) attrs[k] = v;
  const index = n < 65536 ? { a: Uint16Array.from(m.idx), t: "u16", s: 1 } : { a: Uint32Array.from(m.idx), t: "u32", s: 1 };
  return { count: n, index, attrs };
}
// Trọng số float (4 mỗi đỉnh, tổng 1) → u8 chuẩn hoá, giữ tổng đúng 255.
export function quantWeights(sw) {
  const out = new Uint8Array(sw.length);
  for (let v = 0; v < sw.length; v += 4) {
    const q = [0, 1, 2, 3].map((k) => Math.round(sw[v + k] * 255));
    const d = 255 - q.reduce((a, b) => a + b, 0); let m = 0; for (let k = 1; k < 4; k++) if (sw[v + k] > sw[v + m]) m = k; q[m] += d;
    for (let k = 0; k < 4; k++) out[v + k] = Math.max(0, Math.min(255, q[k]));
  }
  return out;
}
export function writeHKM(file, meta, meshes) {
  const blobs = [], json = { v: 1, ...meta, meshes: {} };
  let off = 0;
  const put = (x) => {
    const [, bytes] = TYPES[x.t];
    const buf = Buffer.from(x.a.buffer, x.a.byteOffset, x.a.length * bytes);
    const o = off; blobs.push(buf); off += buf.length;
    const pad = (4 - (off % 4)) % 4; if (pad) { blobs.push(Buffer.alloc(pad)); off += pad; }
    return { o, n: x.a.length, t: x.t, s: x.s };
  };
  for (const [name, m] of Object.entries(meshes)) {
    const o = { count: m.count, index: put(m.index), attrs: {} };
    for (const [k, a] of Object.entries(m.attrs)) o.attrs[k] = put(a);
    json.meshes[name] = o;
  }
  let js = Buffer.from(JSON.stringify(json), "utf8");
  const jpad = (4 - (js.length % 4)) % 4; if (jpad) js = Buffer.concat([js, Buffer.from(" ".repeat(jpad))]);
  const head = Buffer.alloc(8); head.write("HKM1", 0, "ascii"); head.writeUInt32LE(js.length, 4);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, Buffer.concat([head, js, ...blobs]));
}
