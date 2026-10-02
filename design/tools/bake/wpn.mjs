// design/tools/bake/wpn.mjs — vũ khí, đạo cụ cầm tay: lưới Meshy → khung chuẩn, kích thước thật (m, theo design/glb-prompts.md).
//
// Khung chuẩn (game/js/battle/glb.js xoay tiếp theo chỗ gắn: tay rig tướng, cẳng tay lính đám đông):
//   blade    (đao, kiếm, giáo, đại đao, chùy) gốc ở chỗ nắm, trục cán từ đuôi ra mũi theo +Z, bề rộng lưỡi theo ±Y (đại đao: phía
//            có lưỡi là +Y), bề dày theo X. Meshy dựng đứng mũi lên (+Y).
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
  return { mesh: packMesh({ pos: V, nor, uv: g.uv, idx: g.idx }), raw: { pos: V, nor, uv: g.uv, idx: g.idx }, image: g.image, tris: g.tris, trisBefore: g.trisBefore,
    meta: { kind: "wpn", type: c.type, lo: out.lo.map((x) => +x.toFixed(3)), hi: out.hi.map((x) => +x.toFixed(3)) } };
}
