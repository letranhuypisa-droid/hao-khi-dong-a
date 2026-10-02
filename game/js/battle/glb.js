// battle/glb.js — mô hình 3D nướng sẵn từ GLB Meshy (design/tools/glb-bake.mjs → assets/models/*.hkm + WebP): thân nhân vật gắn
// vào khớp rig tướng (models.js makeRig), vũ khí gắn vào khớp tay, lưới lính đám đông (soldiers.js).
//
// Nạp không đồng bộ, dựng đồng bộ: màn tải của trận gọi preloadModels() (main.js, lab.js); makeRig / Crowd hỏi model(id) — chưa
// có trong đệm (đang tải, lỗi mạng, chạy ngoài trình duyệt) thì trả null và nơi gọi dựng khối hình bằng code như trước.
//
// .hkm: "HKM1" · u32 độ dài JSON · JSON · khối nhị phân (bake/io.mjs). Texture WebP theo quy ước UV glTF (flipY = false).

import * as THREE from "three";

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
    for (const [k, c] of Object.entries(m.attrs)) g.setAttribute(k, new THREE.BufferAttribute(view(c), c.s, c.t.endsWith("n")));
    g.setIndex(new THREE.BufferAttribute(view(m.index), 1));
    g.computeBoundingSphere();
    geos[name] = g;
  }
  return { meta, geos };
}

async function fetchModel(id, file, texFile) {
  const [buf, tex] = await Promise.all([
    fetch(new URL(file, BASE)).then((r) => { if (!r.ok) throw new Error(`${file}: ${r.status}`); return r.arrayBuffer(); }),
    new THREE.TextureLoader().loadAsync(new URL(texFile, BASE).href),
  ]);
  tex.flipY = false; tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; tex.needsUpdate = true;
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

// ---- thân nhân vật trên rig khớp nối -----------------------------------------------------------------------------------------
// m.meta.bones: tên khớp theo thứ tự chỉ số xương trong skinIndex; inv: ma trận gắn nghịch đảo (khung gốc rig) mỗi khớp;
// rest: vị trí nghỉ các khớp mà mô hình cần (vai, khuỷu, cổ tay, cổ, bề ngang chân) — makeRig đặt trước khi tạo lưới.
const I4 = new THREE.Matrix4();
export function applyRest(p, m) {
  for (const [name, v] of Object.entries(m.meta.rest)) if (p[name] && name !== "hips") p[name].position.set(v[0], v[1], v[2]);
}
export function bodyMesh(p, m) {
  const bones = m.meta.bones.map((n) => p[n]);
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
