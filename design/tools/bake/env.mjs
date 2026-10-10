// design/tools/bake/env.mjs — vật tĩnh của cảnh (mã ENV_, cùng PROP_, MOUNT_ dùng như đạo cụ đứng yên; design/glb-prompts.md mục H, I, K–N):
// lưới Hunyuan3D (~50 nghìn tam giác, ba ảnh 4096², trục dài nhất chuẩn hoá ~1,2) → kích thước thật, giảm lưới, màu phẳng theo mặt.
//
// Khung: đơn vị mét; gốc giữa đáy (x, z giữa hộp bao, y 0 ở đáy), riêng thuyền gốc ở mớn nước (catalog wl: mét từ đáy lên mớn).
// catalog ry: xoay quanh y (độ) trước khi đo, để vật dài nằm dọc +Z (thuyền: mũi +Z; rào, tường, bến, xe: chiều dài theo Z).
// Phóng đều một tỉ lệ theo một trong: h (chiều cao), x, z (bề rộng, chiều dài sau khi xoay), d (cạnh ngang dài nhất) — cột "Kích thước thật".
//
// Màu: mỗi tam giác của lưới đã giảm lấy màu trung bình texture gốc tại 4 điểm trên mặt (chiếu dọc pháp tuyến xuống lưới gốc như
// rebake.mjs, không có thì điểm gần nhất), ghi fcol (u8n sRGB, một bộ ba mỗi tam giác). Game (battle/glb.js envGeo) bung thành lưới không
// chỉ số, màu đỉnh theo mặt — gộp được vào lưới tĩnh / InstancedMesh vật liệu lambert flatShading đang có của cảnh, không thêm lượt vẽ.
// catalog spread: [x0, x1] nới khoảng giữa |x| ≤ x0 m thành x1 m, hai bên giữ nguyên dáng (lối cổng). catalog tex: vật camera tới gần (cổng Hàm Tử…) còn trải UV lại và nướng một texture cạnh tex (rebake.mjs) cho LOD0.
// Mức chi tiết: tris (LOD0) và far (LOD1, tuỳ chọn: vật rải hàng trăm bản như cây).

import * as THREE from "three";
import { MeshBVH } from "three-mesh-bvh";
import { readGLB, smoothNormals, rawImage, packMesh } from "./io.mjs";
import { rebake, weldSimplify } from "./rebake.mjs";

function bounds(P) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], P[i + k]); hi[k] = Math.max(hi[k], P[i + k]); }
  return { lo, hi, size: hi.map((h, k) => h - lo[k]) };
}
// chỉ giữ đỉnh mà idx dùng tới (weldSimplify trả mọi đỉnh đã hàn)
function compact(pos, idx) {
  const remap = new Int32Array(pos.length / 3).fill(-1), P = [], I = new Uint32Array(idx.length);
  for (let t = 0; t < idx.length; t++) {
    const i = idx[t];
    if (remap[i] < 0) { remap[i] = P.length / 3; P.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); }
    I[t] = remap[i];
  }
  return { pos: Float32Array.from(P), idx: I };
}

// Lấy màu texture gốc tại điểm p (pháp tuyến n) của lưới mới: như shade() của rebake.mjs — giao điểm gần p nhất của đường p ± n·d với lưới
// gốc mà pháp tuyến gốc cùng chiều n, không có thì điểm gần nhất. Trả sRGB 0–255.
function surfaceSampler(src, d) {
  const geo = new THREE.BufferGeometry(), SI = Uint32Array.from(src.idx);           // MeshBVH sắp lại thứ tự tam giác tại chỗ: dùng bản sao
  geo.setAttribute("position", new THREE.BufferAttribute(src.pos, 3)); geo.setIndex(new THREE.BufferAttribute(SI, 1));
  const bvh = new MeshBVH(geo), SP = src.pos, SN = src.nor, SU = src.uv, im = src.img;
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), bc = new THREE.Vector3(), tri = new THREE.Triangle();
  const ray = new THREE.Ray(), hit = {};
  const bary = (f, p) => {
    A.fromArray(SP, SI[f * 3] * 3); B.fromArray(SP, SI[f * 3 + 1] * 3); C.fromArray(SP, SI[f * 3 + 2] * 3);
    tri.set(A, B, C); if (!tri.getBarycoord(p, bc)) bc.set(1 / 3, 1 / 3, 1 / 3);
    return bc;
  };
  const facing = (f, b, n) => {
    let x = 0, y = 0, z = 0;
    for (let k = 0; k < 3; k++) { const v = SI[f * 3 + k] * 3, w = b.getComponent(k); x += SN[v] * w; y += SN[v + 1] * w; z += SN[v + 2] * w; }
    return (x * n.x + y * n.y + z * n.z) / (Math.hypot(x, y, z) || 1);
  };
  const px = (x, y, c) => im.data[(Math.min(im.h - 1, Math.max(0, y)) * im.w + Math.min(im.w - 1, Math.max(0, x))) * im.ch + c];
  return (p, n, out) => {
    ray.origin.copy(p).addScaledVector(n, d); ray.direction.copy(n).negate();
    let face = -1, point = null, best = Infinity;
    for (const h of bvh.raycast(ray, THREE.DoubleSide, 0, 2 * d)) {
      const off = Math.abs(h.distance - d);
      if (off < best && facing(h.faceIndex, bary(h.faceIndex, h.point), n) > 0.1) { best = off; face = h.faceIndex; point = h.point.clone(); }
    }
    if (face < 0) { bvh.closestPointToPoint(p, hit); face = hit.faceIndex; point = hit.point; }
    const a = SI[face * 3], b = SI[face * 3 + 1], c = SI[face * 3 + 2];
    bary(face, point);
    const u = SU[a * 2] * bc.x + SU[b * 2] * bc.y + SU[c * 2] * bc.z, v = SU[a * 2 + 1] * bc.x + SU[b * 2 + 1] * bc.y + SU[c * 2 + 1] * bc.z;
    const fx = u * im.w - 0.5, fy = v * im.h - 0.5, x0 = Math.floor(fx), y0 = Math.floor(fy), ax = fx - x0, ay = fy - y0;
    for (let k = 0; k < 3; k++) out[k] = (px(x0, y0, k) * (1 - ax) + px(x0 + 1, y0, k) * ax) * (1 - ay) + (px(x0, y0 + 1, k) * (1 - ax) + px(x0 + 1, y0 + 1, k) * ax) * ay;
  };
}

// màu mỗi tam giác: trung bình 4 điểm (trọng tâm, ba điểm lệch về ba đỉnh)
const PTS = [[1 / 3, 1 / 3, 1 / 3], [2 / 3, 1 / 6, 1 / 6], [1 / 6, 2 / 3, 1 / 6], [1 / 6, 1 / 6, 2 / 3]];
function faceColors(pos, idx, shade) {
  const out = new Uint8Array(idx.length), A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
  const p = new THREE.Vector3(), n = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), col = [0, 0, 0];
  for (let t = 0; t < idx.length; t += 3) {
    A.fromArray(pos, idx[t] * 3); B.fromArray(pos, idx[t + 1] * 3); C.fromArray(pos, idx[t + 2] * 3);
    n.crossVectors(e1.subVectors(B, A), e2.subVectors(C, A)).normalize();
    const s = [0, 0, 0];
    for (const [a, b, c] of PTS) {
      p.set(0, 0, 0).addScaledVector(A, a).addScaledVector(B, b).addScaledVector(C, c);
      shade(p, n, col); for (let k = 0; k < 3; k++) s[k] += col[k];
    }
    for (let k = 0; k < 3; k++) out[t + k] = Math.round(Math.max(0, Math.min(255, s[k] / PTS.length)));
  }
  return out;
}

export async function bakeEnv(file, c) {
  const g = await readGLB(file), img = await rawImage(g.image);
  // xoay, phóng, đặt gốc
  const R = new THREE.Matrix4().makeRotationY(THREE.MathUtils.degToRad(c.ry || 0)), v = new THREE.Vector3();
  const V = new Float32Array(g.pos.length);
  for (let i = 0; i < V.length; i += 3) { v.set(g.pos[i], g.pos[i + 1], g.pos[i + 2]).applyMatrix4(R); V[i] = v.x; V[i + 1] = v.y; V[i + 2] = v.z; }
  const b0 = bounds(V), key = ["h", "x", "z", "d"].find((k) => c[k] != null);
  if (!key) throw new Error("catalog thiếu kích thước (h, x, z hoặc d)");
  const span = { h: b0.size[1], x: b0.size[0], z: b0.size[2], d: Math.max(b0.size[0], b0.size[2]) }[key], scale = c[key] / span;
  const ox = (b0.lo[0] + b0.hi[0]) / 2, oz = (b0.lo[2] + b0.hi[2]) / 2, oy = b0.lo[1];
  for (let i = 0; i < V.length; i += 3) { V[i] = (V[i] - ox) * scale; V[i + 1] = (V[i + 1] - oy) * scale - (c.wl || 0); V[i + 2] = (V[i + 2] - oz) * scale; }
  if (c.spread) {                                    // [x0, x1]: nới lối giữa |x| ≤ x0 thành x1, hai bên dời ra nguyên khối (cổng: lối mẫu hẹp hơn lối code)
    const [x0, x1] = c.spread;
    for (let i = 0; i < V.length; i += 3) V[i] = Math.abs(V[i]) <= x0 ? V[i] * (x1 / x0) : V[i] + Math.sign(V[i]) * (x1 - x0);
  }
  const N = smoothNormals(V, g.idx), b = bounds(V);
  const diag = Math.hypot(...b.size), shade = surfaceSampler({ pos: V, nor: N, uv: g.uv, idx: g.idx, img }, Math.min(0.6, Math.max(0.03, 0.03 * diag)));

  const lods = [];
  let image = null;
  for (const [k, tris] of [c.tris, c.far].filter(Boolean).entries()) {
    const w = await weldSimplify(V, g.idx, tris);
    let m = compact(w.pos, w.idx);
    m.nor = smoothNormals(m.pos, m.idx);
    if (k === 0 && c.tex) {                                                   // LOD0 có texture: trải UV lại, nướng từ lưới gốc
      const r = await rebake(m, [{ pos: V, nor: N, uv: g.uv, idx: g.idx, img }], c.tex);
      m = { pos: r.part.pos, nor: r.part.nor, uv: r.part.uv, idx: r.part.idx }; image = r.image;
    }
    m.fcol = faceColors(m.pos, m.idx, shade);
    lods.push(m);
  }
  const lb = bounds(lods[0].pos);
  return {
    lods: lods.map((m) => packMesh({ pos: m.pos, nor: m.nor, uv: m.uv, idx: m.idx, extra: { fcol: { a: m.fcol, t: "u8n", s: 3 } } })),
    tris: lods.map((m) => m.idx.length / 3), trisBefore: g.trisBefore, image,
    meta: { kind: "env", scale: +scale.toFixed(4), lo: lb.lo.map((x) => +x.toFixed(3)), hi: lb.hi.map((x) => +x.toFixed(3)) },
  };
}
