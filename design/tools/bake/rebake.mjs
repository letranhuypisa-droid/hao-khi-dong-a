// design/tools/bake/rebake.mjs — mức gần (LOD0) của lính đám đông: lưới đã hàn, giảm tự do (kit.mjs weldLOD) được trải UV mới
// bằng xatlas, rồi nướng một texture riêng từ các lưới gốc đầy đủ.
//
// Lý do: Meshy cắt UV thành rất nhiều mảnh nhỏ; giảm lưới mà giữ đường may thì không xuống nổi ngân sách (1,3–5,5 nghìn tam giác),
// gộp qua đường may thì texture loang lổ. Trải UV lại trên lưới đã giảm thì giảm bao nhiêu cũng được, texture vẫn đúng chỗ.
// Mỗi texel: điểm p, pháp tuyến n trên lưới mới → mọi giao điểm của đường thẳng p ± n·d với lưới gốc, chọn giao điểm gần p nhất
// mà pháp tuyến gốc cùng chiều n (mặt trước/sau của khiên, lưỡi đao mỏng, vạt áo chồng lớp không lẫn nhau); không có thì lấy điểm
// gần nhất → UV gốc → màu texture gốc (song tuyến). Texel trống quanh các mảnh được loang màu ra (chống viền khi lọc mipmap).

import * as THREE from "three";
import createXAtlas from "xatlas-wasm";
import { MeshBVH } from "three-mesh-bvh";
import { MeshoptSimplifier } from "meshoptimizer";

let XA = null;

// Hàn đỉnh trùng vị trí (đường may UV của Meshy biến mất) rồi giảm lưới tự do còn ~tris tam giác. Trả { pos, idx, src: đỉnh mới →
// một đỉnh gốc cùng vị trí, id: đỉnh gốc → đỉnh mới }.
export async function weldSimplify(pos, idx, tris) {
  const key = new Map(), id = new Int32Array(pos.length / 3), P = [], src = [];
  for (let v = 0; v < id.length; v++) {
    const k = `${Math.round(pos[v * 3] * 1e4)},${Math.round(pos[v * 3 + 1] * 1e4)},${Math.round(pos[v * 3 + 2] * 1e4)}`;
    let g = key.get(k);
    if (g === undefined) { g = key.size; key.set(k, g); P.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]); src.push(v); }
    id[v] = g;
  }
  const W = Float32Array.from(P), I = Uint32Array.from(idx, (i) => id[i]);
  await MeshoptSimplifier.ready;
  const [out] = I.length / 3 > tris ? MeshoptSimplifier.simplify(I, W, 3, tris * 3, 1.0, []) : [I];
  return { pos: W, idx: out, src: Int32Array.from(src), id };
}

// dst: { pos, nor, skin?, idx } lưới mới (đã hàn); src: [{ pos, nor, uv, idx, img: { data, w, h, ch } }] lưới gốc cùng toạ độ.
// Trả { part: { pos, nor, uv (0–1), skin, idx }, xref: đỉnh ra → đỉnh dst (lấy thêm thuộc tính khác), image: { data (RGB), w, h } }.
export async function rebake(dst, src, res = 512, { d = 0.08 } = {}) {
  XA ||= await createXAtlas();
  const atlas = XA.createAtlas();
  const err = atlas.addMesh({ positions: Float32Array.from(dst.pos), normals: Float32Array.from(dst.nor), indices: Uint32Array.from(dst.idx) });
  if (err) throw new Error("xatlas: " + XA.addMeshErrorString(err));
  atlas.generate({ maxIterations: 2 }, { resolution: res, padding: 2, bilinear: true, bruteForce: true });
  if (atlas.atlasCount !== 1) throw new Error("xatlas: " + atlas.atlasCount + " atlas");
  const W = atlas.width, H = atlas.height, out = atlas.getMesh(0);
  atlas.destroy();
  const n = out.vertexCount, pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), skin = new Uint8Array(n * 4);
  const xref = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const v = out.vertices[i], x = v.xref; xref[i] = x;
    for (let k = 0; k < 3; k++) { pos[i * 3 + k] = dst.pos[x * 3 + k]; nor[i * 3 + k] = dst.nor[x * 3 + k]; }
    if (dst.skin) for (let k = 0; k < 4; k++) skin[i * 4 + k] = dst.skin[x * 4 + k];
    uv[i * 2] = v.uv[0] / W; uv[i * 2 + 1] = v.uv[1] / H;
  }
  const idx = Uint32Array.from(out.indices);

  // ---- lưới gốc gộp + BVH ----
  let nv = 0, nt = 0; for (const s of src) { nv += s.pos.length / 3; nt += s.idx.length / 3; }
  const SP = new Float32Array(nv * 3), SN = new Float32Array(nv * 3), SU = new Float32Array(nv * 2), SI = new Uint32Array(nt * 3), SPart = new Uint8Array(nv);
  let ov = 0, ot = 0;
  src.forEach((s, k) => {
    SP.set(s.pos, ov * 3); SN.set(s.nor, ov * 3); SU.set(s.uv, ov * 2);
    for (let i = 0; i < s.idx.length; i++) SI[ot * 3 + i] = s.idx[i] + ov;
    SPart.fill(k, ov, ov + s.pos.length / 3);             // theo đỉnh: MeshBVH sắp xếp lại thứ tự tam giác (SI) tại chỗ
    ov += s.pos.length / 3; ot += s.idx.length / 3;
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(SP, 3)); geo.setIndex(new THREE.BufferAttribute(SI, 1));
  const bvh = new MeshBVH(geo);

  const img = new Float32Array(W * H * 3), fill = new Uint8Array(W * H);
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), P = new THREE.Vector3(), N = new THREE.Vector3(), bc = new THREE.Vector3();
  const ray = new THREE.Ray(), hit = {}, tri = new THREE.Triangle();
  const sample = (s, u, v, o) => {
    const im = s.img, fx = u * im.w - 0.5, fy = v * im.h - 0.5, x0 = Math.floor(fx), y0 = Math.floor(fy), ax = fx - x0, ay = fy - y0;
    const px = (x, y, c) => im.data[(Math.min(im.h - 1, Math.max(0, y)) * im.w + Math.min(im.w - 1, Math.max(0, x))) * im.ch + c];
    for (let c = 0; c < 3; c++) o[c] = ((px(x0, y0, c) * (1 - ax) + px(x0 + 1, y0, c) * ax) * (1 - ay) + (px(x0, y0 + 1, c) * (1 - ax) + px(x0 + 1, y0 + 1, c) * ax) * ay);
  };
  const col = [0, 0, 0];
  const bary = (face, point) => {
    A.fromArray(SP, SI[face * 3] * 3); B.fromArray(SP, SI[face * 3 + 1] * 3); C.fromArray(SP, SI[face * 3 + 2] * 3);
    tri.set(A, B, C); if (!tri.getBarycoord(point, bc)) bc.set(1 / 3, 1 / 3, 1 / 3);
    return bc;
  };
  const srcNormalDot = (face, b, nrm) => {
    let x = 0, y = 0, z = 0;
    for (let k = 0; k < 3; k++) { const v = SI[face * 3 + k] * 3, w = b.getComponent(k); x += SN[v] * w; y += SN[v + 1] * w; z += SN[v + 2] * w; }
    return (x * nrm.x + y * nrm.y + z * nrm.z) / (Math.hypot(x, y, z) || 1);
  };
  const shade = (p, nrm) => {
    ray.origin.copy(p).addScaledVector(nrm, d); ray.direction.copy(nrm).negate();
    let face = -1, point = null, best = Infinity;
    for (const h of bvh.raycast(ray, THREE.DoubleSide, 0, 2 * d)) {
      const off = Math.abs(h.distance - d);
      if (off < best && srcNormalDot(h.faceIndex, bary(h.faceIndex, h.point), nrm) > 0.1) { best = off; face = h.faceIndex; point = h.point.clone(); }
    }
    if (face < 0) { bvh.closestPointToPoint(p, hit); face = hit.faceIndex; point = hit.point; }
    const a = SI[face * 3], b = SI[face * 3 + 1], c = SI[face * 3 + 2];
    bary(face, point);
    const s = src[SPart[a]];
    sample(s, SU[a * 2] * bc.x + SU[b * 2] * bc.y + SU[c * 2] * bc.z, SU[a * 2 + 1] * bc.x + SU[b * 2 + 1] * bc.y + SU[c * 2 + 1] * bc.z, col);
  };

  // ---- quét từng tam giác trong không gian texel ----
  const ta = new THREE.Vector2(), tb = new THREE.Vector2(), tc = new THREE.Vector2(), q = new THREE.Vector2();
  const Pa = new THREE.Vector3(), Pb = new THREE.Vector3(), Pc = new THREE.Vector3(), Na = new THREE.Vector3(), Nb = new THREE.Vector3(), Nc = new THREE.Vector3();
  for (let t = 0; t < idx.length; t += 3) {
    const [i0, i1, i2] = [idx[t], idx[t + 1], idx[t + 2]];
    ta.set(uv[i0 * 2] * W, uv[i0 * 2 + 1] * H); tb.set(uv[i1 * 2] * W, uv[i1 * 2 + 1] * H); tc.set(uv[i2 * 2] * W, uv[i2 * 2 + 1] * H);
    Pa.fromArray(pos, i0 * 3); Pb.fromArray(pos, i1 * 3); Pc.fromArray(pos, i2 * 3);
    Na.fromArray(nor, i0 * 3); Nb.fromArray(nor, i1 * 3); Nc.fromArray(nor, i2 * 3);
    const den = (tb.y - tc.y) * (ta.x - tc.x) + (tc.x - tb.x) * (ta.y - tc.y);
    if (Math.abs(den) < 1e-12) continue;
    const x0 = Math.max(0, Math.floor(Math.min(ta.x, tb.x, tc.x))), x1 = Math.min(W - 1, Math.ceil(Math.max(ta.x, tb.x, tc.x)));
    const y0 = Math.max(0, Math.floor(Math.min(ta.y, tb.y, tc.y))), y1 = Math.min(H - 1, Math.ceil(Math.max(ta.y, tb.y, tc.y)));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      q.set(x + 0.5, y + 0.5);
      let l0 = ((tb.y - tc.y) * (q.x - tc.x) + (tc.x - tb.x) * (q.y - tc.y)) / den;
      let l1 = ((tc.y - ta.y) * (q.x - tc.x) + (ta.x - tc.x) * (q.y - tc.y)) / den;
      let l2 = 1 - l0 - l1;
      // texel có tâm hơi ra ngoài cạnh (≤ ~0,7 texel) vẫn tô, kẹp về trong tam giác
      const e = 0.7 / Math.sqrt(Math.abs(den));
      if (l0 < -e || l1 < -e || l2 < -e) continue;
      const k = y * W + x, inside = l0 >= 0 && l1 >= 0 && l2 >= 0;
      if (fill[k] === 2 || (fill[k] === 1 && !inside)) continue;
      l0 = Math.max(0, l0); l1 = Math.max(0, l1); l2 = Math.max(0, l2); const S = l0 + l1 + l2; l0 /= S; l1 /= S; l2 /= S;
      P.set(0, 0, 0).addScaledVector(Pa, l0).addScaledVector(Pb, l1).addScaledVector(Pc, l2);
      N.set(0, 0, 0).addScaledVector(Na, l0).addScaledVector(Nb, l1).addScaledVector(Nc, l2).normalize();
      shade(P, N);
      img[k * 3] = col[0]; img[k * 3 + 1] = col[1]; img[k * 3 + 2] = col[2]; fill[k] = inside ? 2 : 1;
    }
  }
  // ---- loang màu ra texel trống ----
  let mean = [0, 0, 0], cnt = 0;
  for (let k = 0; k < W * H; k++) if (fill[k]) { for (let c = 0; c < 3; c++) mean[c] += img[k * 3 + c]; cnt++; }
  mean = mean.map((x) => x / Math.max(1, cnt));
  for (let it = 0; it < 8; it++) {
    const add = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const k = y * W + x; if (fill[k]) continue;
      let r = 0, g = 0, b = 0, m = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const j = yy * W + xx; if (!fill[j]) continue;
        r += img[j * 3]; g += img[j * 3 + 1]; b += img[j * 3 + 2]; m++;
      }
      if (m) add.push([k, r / m, g / m, b / m]);
    }
    for (const [k, r, g, b] of add) { img[k * 3] = r; img[k * 3 + 1] = g; img[k * 3 + 2] = b; fill[k] = 1; }
  }
  const data = new Uint8Array(W * H * 3);
  for (let k = 0; k < W * H; k++) for (let c = 0; c < 3; c++) data[k * 3 + c] = Math.round(fill[k] ? img[k * 3 + c] : mean[c]);
  return { part: { pos, nor, uv, skin, idx }, xref, image: { data, w: W, h: H } };
}
