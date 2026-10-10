// battle/glb.js — mô hình 3D nướng sẵn từ GLB Meshy (design/tools/glb-bake.mjs → assets/models/*.hkm + WebP): thân nhân vật gắn
// vào khớp rig tướng (models.js makeRig), vũ khí gắn vào khớp tay, lưới lính đám đông (soldiers.js).
//
// Nạp không đồng bộ, dựng đồng bộ: màn tải của trận gọi preloadModels() (main.js, lab.js); makeRig / Crowd hỏi model(id) — chưa
// có trong đệm (đang tải, lỗi mạng, chạy ngoài trình duyệt) thì trả null và nơi gọi dựng khối hình bằng code như trước.
//
// .hkm: "HKM1" · u32 độ dài JSON · JSON · khối nhị phân (bake/io.mjs). Texture WebP theo quy ước UV glTF (flipY = false).
// Vật tĩnh của cảnh (env/*, design/tools/bake/env.mjs): không texture (trừ vật nhìn gần), màu theo mặt fcol — envPart bung thành lưới gộp được
// với models.js part / merge (cùng vật liệu lambert flatShading màu đỉnh của cảnh).

import * as THREE from "three";
import { driveQuat } from "./rig-helpers.js";

const BASE = new URL("../../assets/models/", import.meta.url);
const CACHE = new Map();           // id → { meta, geos: { tên: BufferGeometry }, tex: Texture }
const PENDING = new Map();         // id → Promise

const TYPES = { f32: Float32Array, i8n: Int8Array, u16n: Uint16Array, u8: Uint8Array, u8n: Uint8Array, u16: Uint16Array, u32: Uint32Array };
export function parseHKM(buf) {
  const dv = new DataView(buf);
  if (String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3)) !== "HKM1") throw new Error("không phải tệp .hkm");
  const jl = dv.getUint32(4, true), meta = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, jl))), base = 8 + jl;
  const view = (c) => new TYPES[c.t](buf, base + c.o, c.n);
  const geos = {};
  for (const [name, m] of Object.entries(meta.meshes)) {
    const g = new THREE.BufferGeometry();
    for (const [k, c] of Object.entries(m.attrs)) {
      if (c.n !== m.count * c.s) { (g.userData.face ||= {})[k] = view(c); continue; }          // thuộc tính theo tam giác (env: fcol)
      g.setAttribute(k, new THREE.BufferAttribute(view(c), c.s, c.t.endsWith("n")));
    }
    g.setIndex(new THREE.BufferAttribute(view(m.index), 1));
    g.computeBoundingSphere();
    geos[name] = g;
  }
  return { meta, geos };
}

async function fetchModel(id, file, texFile) {
  const [buf, tex] = await Promise.all([
    fetch(new URL(file, BASE)).then((r) => { if (!r.ok) throw new Error(`${file}: ${r.status}`); return r.arrayBuffer(); }),
    texFile ? new THREE.TextureLoader().loadAsync(new URL(texFile, BASE).href) : null,       // env màu phẳng: không texture
  ]);
  if (tex) { tex.flipY = false; tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; tex.needsUpdate = true; }
  const m = parseHKM(buf); m.tex = tex;
  CACHE.set(id, m);
  return m;
}

let INDEX = null;
async function index() {
  if (!INDEX) INDEX = fetch(new URL("index.json", BASE)).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
  return INDEX;
}

// Nạp các mô hình (id như "char/H35", "wpn/songdao", "kit/DV_GIAO"; "kit/*", "char/CV_*" là mọi id bắt đầu như vậy); ids = null
// là mọi mô hình trong index. Chờ tối đa timeout ms rồi trả (phần chưa xong vẫn tải tiếp, lần dựng sau sẽ có). Lỗi từng tệp chỉ
// ghi console, không làm hỏng trận.
export async function preloadModels(ids = null, timeout = 15000) {
  if (typeof fetch === "undefined") return;
  const idx = await index();
  const match = (id) => ids.some((p) => (p.endsWith("*") ? id.startsWith(p.slice(0, -1)) : id === p));
  const list = Object.keys(idx).filter((id) => (!ids || match(id)) && !CACHE.has(id));
  const jobs = list.map((id) => {
    if (!PENDING.has(id)) PENDING.set(id, fetchModel(id, idx[id].file, idx[id].tex).catch((e) => { console.warn("mô hình", id, e.message); PENDING.delete(id); }));
    return PENDING.get(id);
  });
  await Promise.race([Promise.all(jobs), new Promise((r) => setTimeout(r, timeout))]);
}

export const model = (id) => CACHE.get(id) || null;
export const hasModel = (id) => CACHE.has(id);
// đưa mô hình đã đọc sẵn vào đệm (kiểm thử, công cụ Node đọc .hkm từ đĩa: fetch không đọc file://); m null: gỡ khỏi đệm
export const putModel = (id, m) => (m ? CACHE.set(id, m) : CACHE.delete(id));

// ---- vật tĩnh của cảnh (env/<mã>) ------------------------------------------------------------------------------------------
// Khung nướng (bake/env.mjs): mét, gốc giữa đáy (thuyền: mặt nước), vật dài dọc +Z. envPart trả BufferGeometry không chỉ số (position,
// normal theo mặt, color tuyến tính theo mặt) đã đặt như models.js part: { x, y, z, rx, ry, rz, s, sx, sy, sz }, lod (0 gần, 1 xa —
// mã không có LOD1 thì dùng LOD0), tint (nhân màu), cut ({ y0, y1 }: chỉ giữ tam giác có trọng tâm trong khoảng — tách buồm khỏi thân).
// Chưa nạp (Node, lỗi mạng) → null: nơi gọi dựng khối code như cũ.
const srgb = new Float32Array(256).map((_, i) => { const c = i / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
const FLAT = new Map();            // "id/lod" → BufferGeometry gốc đã bung
function flatGeo(id, lod) {
  const m = model("env/" + id); if (!m) return null;
  const name = m.geos["lod" + lod] ? "lod" + lod : "lod0", key = id + "/" + name;
  if (FLAT.has(key)) return FLAT.get(key);
  const g = m.geos[name], P = g.attributes.position.array, I = g.index.array, F = g.userData.face.fcol, n = I.length;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), e = new THREE.Vector3();
  for (let t = 0; t < n; t += 3) {
    a.fromArray(P, I[t] * 3); b.fromArray(P, I[t + 1] * 3); c.fromArray(P, I[t + 2] * 3);
    e.crossVectors(b.sub(a), c.sub(a)).normalize();
    for (let k = 0; k < 3; k++) {
      const o = (t + k) * 3; pos.set([P[I[t + k] * 3], P[I[t + k] * 3 + 1], P[I[t + k] * 3 + 2]], o);
      nor[o] = e.x; nor[o + 1] = e.y; nor[o + 2] = e.z;
      col[o] = srgb[F[t]]; col[o + 1] = srgb[F[t + 1]]; col[o + 2] = srgb[F[t + 2]];
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(pos, 3)); out.setAttribute("normal", new THREE.BufferAttribute(nor, 3)); out.setAttribute("color", new THREE.BufferAttribute(col, 3));
  FLAT.set(key, out);
  return out;
}
const _em = new THREE.Matrix4(), _ev = new THREE.Vector3(), _eq = new THREE.Quaternion(), _ee = new THREE.Euler(), _es = new THREE.Vector3();
export function envPart(id, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1, sx = s, sy = s, sz = s, lod = 0, tint = null, cut = null } = {}) {
  const base = flatGeo(id, lod); if (!base) return null;
  let g = base.clone();
  if (cut) {
    const P = g.attributes.position.array, keep = [];
    for (let t = 0; t < P.length; t += 9) { const cy = (P[t + 1] + P[t + 4] + P[t + 7]) / 3; if (cy >= (cut.y0 ?? -Infinity) && cy < (cut.y1 ?? Infinity)) keep.push(t / 9); }
    const out = new THREE.BufferGeometry();
    for (const k of ["position", "normal", "color"]) {
      const A = g.attributes[k].array, B = new Float32Array(keep.length * 9);
      keep.forEach((f, i) => B.set(A.subarray(f * 9, f * 9 + 9), i * 9));
      out.setAttribute(k, new THREE.BufferAttribute(B, 3));
    }
    g = out;
  }
  if (tint != null) {
    const t = new THREE.Color(tint), C = g.attributes.color.array;
    for (let i = 0; i < C.length; i += 3) { C[i] *= t.r; C[i + 1] *= t.g; C[i + 2] *= t.b; }
  }
  g.applyMatrix4(_em.compose(_ev.set(x, y, z), _eq.setFromEuler(_ee.set(rx, ry, rz)), _es.set(sx, sy, sz)));
  g.computeBoundingSphere();
  return g;
}
// hộp bao khung nướng (meta lo / hi) của env/<mã>, null nếu chưa nạp
export const envBounds = (id) => { const m = model("env/" + id); return m ? { lo: m.meta.lo, hi: m.meta.hi } : null; };
// THREE.LOD cho vật đặt riêng lẻ (cổng, tháp đồn, thuyền, cây đa): mỗi khung chỉ vẽ một mức nên không thêm lượt vẽ. Gần: LOD0 (texture nếu mã
// nướng với catalog tex, không thì màu phẳng vật liệu mat), từ far m: LOD1 màu phẳng (mã chỉ một mức thì chỉ một mức). Lưới dùng chung giữa
// các bản (khung nướng, chưa đặt: nơi gọi đặt LOD), đừng sửa. cast: đổ bóng. Chưa nạp → null.
export function envLOD(id, mat, { far = 60, cast = false } = {}) {
  const m = model("env/" + id); if (!m) return null;
  const lod = new THREE.LOD(), near = m.tex ? new THREE.Mesh(m.geos.lod0, new THREE.MeshLambertMaterial({ map: m.tex })) : new THREE.Mesh(flatGeo(id, 0), mat);
  lod.addLevel(near, 0);
  if (m.geos.lod1) lod.addLevel(new THREE.Mesh(flatGeo(id, 1), mat), far);
  for (const l of lod.levels) l.object.castShadow = cast;
  return lod;
}
// lưới có texture (mã nướng với catalog tex) cho vật nhìn gần; không có texture thì màu phẳng
export function envMesh(id, opts = {}) {
  const m = model("env/" + id); if (!m) return null;
  if (!m.tex) { const g = envPart(id, opts); return new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })); }
  return new THREE.Mesh(m.geos.lod0, new THREE.MeshLambertMaterial({ map: m.tex }));
}

// ---- thân nhân vật trên rig khớp nối -----------------------------------------------------------------------------------------
// m.meta.bones: tên xương theo thứ tự chỉ số trong skinIndex — 15 khớp rig rồi xương phụ (đợt 19a A4: spine, neck, clavL/R, twistL/R,
// rig-helpers.js); inv: ma trận gắn nghịch đảo (khung gốc rig) mỗi xương; rest: vị trí nghỉ các khớp mà mô hình cần (vai, khuỷu, cổ
// tay, cổ, bề ngang chân) — makeRig đặt trước khi tạo lưới — và gốc xương phụ trong khung cha; parent, drive: cha, [khớp nguồn, cách
// quay, phần góc] của xương phụ. Tệp nướng cũ không có xương phụ (chỉ 15 khớp) vẫn dựng như trước.
const I4 = new THREE.Matrix4();
const _dq = [0, 0, 0, 0], _hq = new THREE.Quaternion();
// Xương phụ: con của khớp cha, chỉ lưới da GLB dùng (không có trong rig.p — hoạt ảnh, IK, mô phỏng không biết tới). Góc đặt ngay trước
// khi tính ma trận cục bộ: updateMatrix chạy trong scene.updateMatrixWorld lúc vẽ (sau tư thế anim.js, IK rig-motion.js, trước
// skeleton.update của trình vẽ) hoặc khi ai gọi updateWorldMatrix — không cần nơi gọi riêng trong vòng lặp trận / lab. Góc dựng thẳng
// vào ma trận bằng quaternion riêng (this.quaternion để yên ở đơn vị): đặt this.quaternion thì three tính lại rotation Euler mỗi lần —
// bộ dẫn đắt gấp ~2 (đo đợt 19a A4, lab 20 rig GLB, 120 xương phụ: 39 → 22 µs/khung).
class DrivenBone extends THREE.Object3D {
  constructor(src, kind, share) { super(); this.src = src; this.kind = kind; this.share = share; }
  updateMatrix() {
    const q = this.src.quaternion;
    driveQuat(this.kind, this.share, q.x, q.y, q.z, q.w, _dq);
    this.matrix.compose(this.position, _hq.set(_dq[0], _dq[1], _dq[2], _dq[3]), this.scale);
    this.matrixWorldNeedsUpdate = true;
  }
}
function helperBone(p, meta, n) {
  const [src, kind, share] = meta.drive[n], b = new DrivenBone(p[src], kind, share), r = meta.rest[n];
  b.name = n; b.position.set(r[0], r[1], r[2]);
  p[meta.parent[n]].add(b);
  return b;
}
export function applyRest(p, m) {
  const hp = m.meta.parent || {};
  for (const [name, v] of Object.entries(m.meta.rest)) if (p[name] && name !== "hips" && !hp[name]) p[name].position.set(v[0], v[1], v[2]);
}
export function bodyMesh(p, m) {
  const hp = m.meta.parent || {}, bones = m.meta.bones.map((n) => (hp[n] ? helperBone(p, m.meta, n) : p[n]));
  const inv = m.meta.bones.map((_, i) => new THREE.Matrix4().fromArray(m.meta.inv, i * 16));
  const mat = new THREE.MeshLambertMaterial({ map: m.tex });
  const mesh = new THREE.SkinnedMesh(m.geos.body, mat);
  mesh.bind(new THREE.Skeleton(bones, inv), I4);
  mesh.castShadow = true;
  return mesh;
}

// ---- vũ khí ----------------------------------------------------------------------------------------------------------------
// Lưới vũ khí ở khung chuẩn (bake/wpn.mjs): gốc chỗ nắm, cán +Z, bề rộng lưỡi ±Y. place: { p: [x,y,z], r: [rx,ry,rz], s: tỉ lệ,
// mirror: lật gương x (tay trái của song đao) }.
export function weaponMesh(m, place = {}) {
  const mesh = new THREE.Mesh(m.geos.body, new THREE.MeshLambertMaterial({ map: m.tex }));
  const p = place.p || [0, 0, 0], r = place.r || [0, 0, 0], s = place.s ?? 1;
  mesh.position.set(p[0], p[1], p[2]); mesh.rotation.set(r[0], r[1], r[2]);
  mesh.scale.set(place.mirror ? -s : s, s, s);
  mesh.castShadow = true;
  return mesh;
}
