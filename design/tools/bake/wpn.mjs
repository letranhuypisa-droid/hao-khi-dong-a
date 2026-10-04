// design/tools/bake/wpn.mjs — vũ khí, đạo cụ cầm tay: lưới Meshy → khung chuẩn, kích thước thật (m, theo design/glb-prompts.md).
//
// Khung chuẩn (game/js/battle/glb.js xoay tiếp theo chỗ gắn: tay rig tướng, cẳng tay lính đám đông):
//   blade    (đao, kiếm, giáo, đại đao, chùy) gốc ở chỗ nắm, trục cán từ đuôi ra mũi theo +Z, bề rộng lưỡi theo ±Y (đại đao: phía
//            có lưỡi là +Y), bề dày theo X. Meshy dựng đứng mũi lên (+Y); catalog flip: mẫu dựng mũi xuống (kiếm, đao, đại đao),
//            grip đo từ đầu trên. catalog head: ghi chân đầu (giáo — chân mũi, đại đao — chân lưỡi) vào meta.head (neo tua).
//   bow      (cung) gốc ở giữa chuôi cầm, hai đầu cánh theo ±Z, dây cung phía +Y.
//   shield   (khiên) gốc ở tâm mặt khiên, mặt có núm nhìn +Z, chiều đứng +Y.
//   crossbow (nỏ) đúng khung cẳng tay lính (soldiers.js W.no): báng dọc Y, đầu cánh nỏ phía −Y, cánh nỏ ngang X, rãnh tên +Z;
//            gốc ở chỗ nắm cách đuôi báng grip m.
//   arrow    (mũi tên) gốc ở đuôi tên, mũi theo +Z.

import * as THREE from "three";
import { readGLB, smoothNormals, packMesh } from "./io.mjs";

// Trục Meshy: X, Y, Z = 0, 1, 2
function bounds(P, sel = null) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < P.length; i += 3) { if (sel && !sel(P[i], P[i + 1], P[i + 2])) continue; for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], P[i + k]); hi[k] = Math.max(hi[k], P[i + k]); } }
  return { lo, hi, size: hi.map((h, k) => h - lo[k]), c: hi.map((h, k) => (h + lo[k]) / 2) };
}
const AX = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
// Ma trận xoay đưa trục Meshy a → u, b → v (u, v là véc-tơ đơn vị khung chuẩn), trục còn lại theo tích có hướng.
function basis(a, u, b, v) {
  const ea = AX[a], eb = AX[b], ec = new THREE.Vector3().crossVectors(ea, eb);
  const src = new THREE.Matrix4().makeBasis(ea, eb, ec), dst = new THREE.Matrix4().makeBasis(u, v, new THREE.Vector3().crossVectors(u, v));
  return dst.multiply(src.invert());
}

export async function bakeWeapon(file, c) {
  const g = await readGLB(file, c.tris ?? Infinity);
  const P = g.pos, b = bounds(P);
  let R, origin, scale;
  const Y = (x, y, z) => new THREE.Vector3(x, y, z);
  if (c.type === "blade") {
    // cán: tâm x, z của phần thấp (20% dưới cùng: chuôi / cán, không lẫn lưỡi lệch một bên)
    const shaft = bounds(P, c.flip ? (x, y) => y > b.hi[1] - 0.2 * b.size[1] : (x, y) => y < b.lo[1] + 0.2 * b.size[1]);
    const wAx = b.size[0] >= b.size[2] ? 0 : 2;                   // trục bề rộng lưỡi
    let sgn = 1;
    if (c.side) {                                                  // lưỡi lệch một bên cán: phía đó là +Y
      const up = bounds(P, c.flip ? (x, y) => y < b.hi[1] - 0.3 * b.size[1] : (x, y) => y > b.lo[1] + 0.3 * b.size[1]);
      sgn = up.c[wAx] >= shaft.c[wAx] ? 1 : -1;
    }
    // flip: mẫu Meshy dựng ngược (đại đao: lưỡi treo ở nửa dưới cán) — lấy đầu dưới làm mũi
    const f = c.flip ? -1 : 1;
    R = basis(1, Y(0, 0, f), wAx, Y(0, sgn, 0));
    scale = c.len / b.size[1];
    origin = Y(0, 0, 0); origin.setComponent(1, c.flip ? b.hi[1] - c.grip / scale : b.lo[1] + c.grip / scale); origin.setComponent(0, shaft.c[0]); origin.setComponent(2, shaft.c[2]);
  } else if (c.type === "bow") {
    // giữa chiều cao: chuôi (nhiều đỉnh) và dây (mảnh) — dây ở phía xa tâm chuôi hơn
    const mid = (x, y) => Math.abs(y - b.c[1]) < 0.06 * b.size[1];
    const m = bounds(P, mid);
    let sx = 0, n = 0; for (let i = 0; i < P.length; i += 3) if (mid(P[i], P[i + 1])) { sx += P[i]; n++; }
    const gx = sx / n, sgn = m.hi[0] - gx > gx - m.lo[0] ? 1 : -1;
    R = basis(1, Y(0, 0, 1), 0, Y(0, sgn, 0));
    scale = c.len / b.size[1];
    origin = Y(gx, b.c[1], b.c[2]);
  } else if (c.type === "shield") {
    // mặt khiên: trục mỏng nhất; núm ở phía các đỉnh giữa mặt khiên lồi xa hơn
    const nAx = b.size.indexOf(Math.min(...b.size)), upAx = nAx === 1 ? 2 : 1;
    const ctr = bounds(P, (x, y, z) => { const p = [x, y, z]; return [0, 1, 2].every((k) => k === nAx || Math.abs(p[k] - b.c[k]) < 0.12 * b.size[k]); });
    const sgn = ctr.hi[nAx] - b.c[nAx] > b.c[nAx] - ctr.lo[nAx] ? 1 : -1;
    const n = Y(0, 0, 0); n.setComponent(nAx, 1);
    R = basis(nAx, Y(0, 0, sgn), upAx, Y(0, 1, 0));
    scale = c.h / b.size[upAx];
    origin = Y(b.c[0], b.c[1], b.c[2]);
  } else if (c.type === "crossbow") {
    // báng theo X (đầu cánh nỏ phía −X), rãnh +Y, cánh nỏ theo Z → khung cẳng tay: X → +Y, Y → +Z
    R = basis(0, Y(0, 1, 0), 1, Y(0, 0, 1));
    scale = c.len / b.size[0];
    origin = Y(b.hi[0] - c.grip / scale, b.c[1], b.c[2]);
  } else if (c.type === "arrow") {
    R = basis(0, Y(0, 0, 1), 1, Y(0, 1, 0));
    scale = c.len / b.size[0];
    origin = Y(b.lo[0], b.c[1], b.c[2]);
  } else throw new Error("loại vũ khí lạ: " + c.type);
  const M = new THREE.Matrix4().makeScale(scale, scale, scale).multiply(R).multiply(new THREE.Matrix4().makeTranslation(-origin.x, -origin.y, -origin.z));
  const V = new Float32Array(P.length), v = new THREE.Vector3();
  for (let i = 0; i < P.length; i += 3) { v.set(P[i], P[i + 1], P[i + 2]).applyMatrix4(M); V[i] = v.x; V[i + 1] = v.y; V[i + 2] = v.z; }
  const out = bounds(V);
  const nor = smoothNormals(V, g.idx);
  const head = c.head ? headBase(V, g.idx) : null;
  return { mesh: packMesh({ pos: V, nor, uv: g.uv, idx: g.idx }), raw: { pos: V, nor, uv: g.uv, idx: g.idx }, image: g.image, tris: g.tris, trisBefore: g.trisBefore,
    meta: { kind: "wpn", type: c.type, lo: out.lo.map((x) => +x.toFixed(3)), hi: out.hi.map((x) => +x.toFixed(3)), ...(head != null ? { head: +head.toFixed(3) } : {}) } };
}

// Chân đầu vũ khí cán dài (catalog head: giáo — chân mũi giáo, đại đao — chân lưỡi), khung chuẩn: mặt cắt r(z) = nửa bề ngang
// max(|x|, |y|) mỗi 1 cm (giao cạnh tam giác với mặt phẳng z); cán = trung vị r nhỏ hơn của hai quãng 0,4 m sau tay … 0,1 m trước
// tay và 0–0,6 m trước tay (lưỡi đại đao bắt đầu ngay trên tay, đuôi giáo có đai); chân đầu = z đầu tiên (từ
// 0,1 m trước tay ra mũi) mà r > 1,5 lần cán suốt ≥ 0,06 m (đĩa chắn tay mỏng của đại đao không tính). Tua treo ở đây (models.js,
// lính đám đông: kit.mjs meta.tas).
export function headBase(V, idx, step = 0.01) {
  let z0 = Infinity, z1 = -Infinity; for (let i = 2; i < V.length; i += 3) { z0 = Math.min(z0, V[i]); z1 = Math.max(z1, V[i]); }
  const K = Math.floor((z1 - z0) / step) + 1, r = new Float64Array(K), z = (k) => z0 + k * step;
  for (let t = 0; t < idx.length; t += 3) for (let e = 0; e < 3; e++) {
    const a = idx[t + e] * 3, b = idx[t + ((e + 1) % 3)] * 3, za = V[a + 2], zb = V[b + 2];
    const put = (k, x, y) => { if (k >= 0 && k < K) r[k] = Math.max(r[k], Math.abs(x), Math.abs(y)); };
    put(Math.round((za - z0) / step), V[a], V[a + 1]);
    if (za === zb) continue;
    for (let k = Math.ceil((Math.min(za, zb) - z0) / step); k <= Math.floor((Math.max(za, zb) - z0) / step); k++) { const u = (z(k) - za) / (zb - za); put(k, V[a] + u * (V[b] - V[a]), V[a + 1] + u * (V[b + 1] - V[a + 1])); }
  }
  const med = (a, b) => { const v = [...r].filter((_, k) => z(k) >= a && z(k) <= b).sort((p, q) => p - q); return v.length ? v[v.length >> 1] : Infinity; };
  const rs = Math.min(med(-0.4, 0.1), med(0, 0.6));
  const run = Math.round(0.06 / step);
  for (let k = 0; k + run < K; k++) {
    if (z(k) < 0.1) continue;
    let ok = true; for (let q = 0; q <= run && ok; q++) ok = r[k + q] > 1.5 * rs;
    if (ok) return z(k);
  }
  return null;
}
