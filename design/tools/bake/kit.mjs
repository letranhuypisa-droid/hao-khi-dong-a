// design/tools/bake/kit.mjs — lính đám đông (soldiers.js, vẽ instanced): lưới Meshy + vũ khí → một lưới cho cả kiểu lính, gắn vào
// bộ 15 khúc của soldier-motion.js (HUMAN; kỵ binh: HORSE — ngựa + người cưỡi ngồi), 3 mức chi tiết, một texture.
//
// Lưới nằm ở tư thế nghỉ của bộ khúc (mọi góc 0: tay buông thẳng, chân thẳng), toạ độ khung gốc lính (cao đỉnh đầu ~1,79, tỉ lệ 1).
// Mỗi đỉnh ≤ 2 khúc: aSkin = (khúc 0, khúc 1, trọng số khúc 0 × 255, 0). Shader (glb.js) lấy ma trận thế giới hai khúc từ texture
// khớp như skinnedKit, trừ vị trí nghỉ của khúc (piv) rồi nhân: p = Σ w·M_k·(v − piv_k) — tư thế nghỉ các khúc chỉ có tịnh tiến.
// Chuyển dáng gốc (tay đưa ra trước) về tư thế nghỉ: skinning tuyến tính 15 khớp (human.mjs) từ khung gắn của mô hình sang khung nghỉ
// của bộ khúc (kitBody: tách tam giác cầu trên lưới gốc trước — cẳng tay áp sườn không kéo thành gai), rồi gộp 15 khớp về 15 khúc
// (đầu theo thân, bàn tay theo cẳng tay).
// Mức chi tiết: hàn đỉnh trùng vị trí (bỏ đường may UV của Meshy) rồi giảm lưới tự do (meshopt) tới đúng ngân sách. LOD0 trải UV
// lại và nướng texture riêng từ lưới gốc (rebake.mjs); LOD1–2 tô màu đỉnh lấy từ texture gốc, không dùng texture.
// meta.tas: neo tua giáo (khung cẳng tay cầm giáo) ở chân mũi giáo Meshy — soldiers.js glbKit đặt vào soldier-motion.js TAS.

import * as THREE from "three";
import { readGLB, smoothNormals, rawImage, quantWeights } from "./io.mjs";
import { JOINTS, fitHuman, cutBoxes, bindSkeleton, weights15, topK, splitBridges, boneDist } from "./human.mjs";
import { rebake, weldSimplify } from "./rebake.mjs";
import { SKELETONS, JOINT_NAMES, HAND } from "../../../game/js/battle/soldier-motion.js";

// vị trí nghỉ (thế giới, tỉ lệ 1, gốc ở chân) của mỗi khúc
export function pivots(skel) {
  const J = SKELETONS[skel], out = {};
  for (const [name, parent, p] of J) { const b = parent ? out[parent] : [0, 0, 0]; out[name] = [b[0] + p[0], b[1] + p[1], b[2] + p[2]]; }
  return out;
}
const HP = pivots("human");
// khớp rig → khúc lính
const MAP = { hips: "pelvis", torso: "torso", head: "torso", shL: "uaL", elL: "faL", handL: "faL", shR: "uaR", elR: "faR", handR: "faR",
  hipL: "thL", kneeL: "shL", ankleL: "ftL", hipR: "thR", kneeR: "shR", ankleR: "ftR" };
const CI = Object.fromEntries(JOINT_NAMES.map((n, i) => [n, i]));
// độ cao khớp chân, hông của bộ khúc người (soldier-motion.js HUMAN): hông 0,9; đùi 0,44; cẳng 0,36 (cổ chân 0,08)
const YH = { hips: HP.pelvis[1], torso: HP.torso[1], hipOff: 0.02, thigh: 0.44, shin: 0.36, knee: HP.shL[1], ankle: HP.ftL[1] };
// trọng số (human.mjs weights15) cho lưới lính thô (cạnh ~6 cm): dải vai giữ giữa khớp vai — dời 5 cm về phía tay như nhân vật rig
// thì cả vòng đỉnh bắp tay sang thân / cẳng tay, khúc cánh tay còn 1,7% đỉnh (NG_CUNG; trước 4,2%)
const KIT_W = { so: 0 };

// Dáng gốc → tư thế nghỉ bộ khúc: v' = Σ w_j · R_j · B_j⁻¹ · v. R_j: khung nghỉ của khớp j (thế giới): place[j] là vị trí (khung chỉ
// tịnh tiến) hoặc { p, q } (vị trí + quaternion: chân người cưỡi gập). Tay buông thẳng ở vai bộ khúc, chân ở hông bộ khúc; đầu giữ
// chỗ của mô hình (theo thân).
function restPose(F, W, bind, place) {
  const n = F.V.length / 3, NB = JOINTS.length;
  const M = JOINTS.map((j, k) => {
    const f = place[j], R = Array.isArray(f) ? new THREE.Matrix4().makeTranslation(f[0], f[1], f[2]) : new THREE.Matrix4().compose(new THREE.Vector3(...f.p), f.q, new THREE.Vector3(1, 1, 1));
    return R.multiply(bind.inv[k]);
  });
  const out = new Float32Array(F.V.length), t = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    let x = 0, y = 0, z = 0;
    for (let k = 0; k < NB; k++) {
      const w = W[i * NB + k]; if (w < 1e-4) continue;
      t.set(F.V[i * 3], F.V[i * 3 + 1], F.V[i * 3 + 2]).applyMatrix4(M[k]); x += w * t.x; y += w * t.y; z += w * t.z;
    }
    out[i * 3] = x; out[i * 3 + 1] = y; out[i * 3 + 2] = z;
  }
  return out;
}

// 15 trọng số khớp → ≤ 2 khúc liền nhau (cha – con của bộ khúc skel; map: khớp → tên khúc): cặp (khúc, khúc cha) có tổng trọng số
// lớn nhất, phần khúc khác bỏ. Trước đây lấy hai khúc nặng nhất bất kỳ: gấu áo trộn bàn chân + chậu, cẳng chân + chậu (kéo thành gai
// tới đất khi bước), ngón tay chạm áo trộn cẳng tay + thân. Trả Uint8Array n × 4 (khúc 0, khúc 1, w0·255, 0).
function skin2(W, n, map, skel = "human") {
  const NB = JOINTS.length, out = new Uint8Array(n * 4), acc = new Float32Array(JOINT_NAMES.length);
  const par = SKELETONS[skel].map((j) => (j[1] ? CI[j[1]] : -1));
  for (let v = 0; v < n; v++) {
    acc.fill(0);
    for (let k = 0; k < NB; k++) acc[CI[map[JOINTS[k]]]] += W[v * NB + k];
    let a = 0, b = -1, best = -1;
    for (let c = 0; c < acc.length; c++) {
      if (!(acc[c] > 0)) continue;
      const p = par[c], s = acc[c] + (p >= 0 ? acc[p] : 0);
      if (s > best) { best = s; a = c; b = p >= 0 && acc[p] > 1e-3 ? p : -1; }
    }
    if (b >= 0 && acc[b] > acc[a]) [a, b] = [b, a];
    const wa = acc[a], wb = b >= 0 ? acc[b] : 0, s = wa + wb || 1;
    out[v * 4] = a; out[v * 4 + 1] = b >= 0 ? b : a; out[v * 4 + 2] = Math.round((wa / s) * 255);
  }
  return out;
}

// ---- cây khúc: cặp khúc không được chung tam giác ----------------------------------------------------------------------------------
// Như game/tests/models.test.mjs kit-ke (theo đỉnh) và cau (theo tam giác): cách ≥ 3 khúc, hai chi khác nhau, thân + khúc chi không phải
// gốc chi (thân + cẳng tay). kitTree(skel) → { par (cha mỗi khúc), cau(a, b) }.
const KIT_ROOTS = { human: ["uaL", "uaR", "thL", "thR"], horse: ["uaL", "uaR", "thL", "thR", "shL", "shR"] };
export function kitTree(skel) {
  const par = Object.fromEntries(SKELETONS[skel].map((j) => [j[0], j[1]])), roots = KIT_ROOTS[skel];
  const up = (b) => { const a = [b]; while (par[a[a.length - 1]]) a.push(par[a[a.length - 1]]); return a; };
  const limb = (b) => up(b).find((x) => roots.includes(x)) || "core";
  const cau = (a, b) => {
    if (a === b) return false;
    if (boneDist(a, b, par) >= 3) return true;
    const la = limb(a), lb = limb(b);
    if (la !== "core" && lb !== "core") return la !== lb;
    if (la === "core" && lb === "core") return false;
    return !roots.includes(la === "core" ? b : a);
  };
  return { par, cau };
}
const TREE = { human: kitTree("human"), horse: kitTree("horse") };

// Thân lính bộ (mẫu đã dò khớp F, lưới gốc idx, uv) → tư thế nghỉ bộ khúc: tay buông thẳng ở vai bộ khúc, chân ở hông bộ khúc, đầu giữ
// chỗ của mô hình (theo thân). Tách tam giác cầu trên lưới gốc trước khi đặt tay (splitBridges, cặp khớp cấm theo cây khúc qua MAP):
// đặt tay buông là một tư thế, tam giác nối cẳng tay với thân kéo giãn ngay trong lưới nghỉ — DV_NO (cẳng tay áp sườn, chĩa ra trước)
// trước đây có 84 tam giác giãn 4–36 lần, dài tới 0,55 m: gai đỏ dọc ống tay ở mọi tư thế, phép đo tư thế (so với lưới nghỉ) không
// thấy. Trả { V (nghỉ), S (gốc sau tách), W (15 khớp mỗi đỉnh), idx, uv, cut (số tam giác tách) }.
export const KIT_SH = HP.uaL[1];
export function kitBody(F, idx, uv) {
  const NB = JOINTS.length, W0 = weights15(F, YH, KIT_W), bind = bindSkeleton(F, YH), t = topK(W0, NB, 4);
  const s = splitBridges({ pos: F.V, idx, si: t.idx, sw: quantWeights(t.w) }, JOINTS, undefined, (a, b) => TREE.human.cau(MAP[a], MAP[b]));
  const n = s.src.length, W = new Float32Array(n * NB), uv2 = new Float32Array(n * 2);
  for (let v = 0; v < n; v++) {
    W.set(W0.subarray(s.own[v] * NB, (s.own[v] + 1) * NB), v * NB);
    uv2[v * 2] = uv[s.src[v] * 2]; uv2[v * 2 + 1] = uv[s.src[v] * 2 + 1];
  }
  const place = {
    hips: HP.pelvis, torso: HP.torso, head: [0, F.neckY, 0],
    shL: HP.uaL, elL: HP.faL, handL: [HP.faL[0], HP.faL[1] + HAND, HP.faL[2]],
    shR: HP.uaR, elR: HP.faR, handR: [HP.faR[0], HP.faR[1] + HAND, HP.faR[2]],
    hipL: HP.thL, kneeL: HP.shL, ankleL: HP.ftL, hipR: HP.thR, kneeR: HP.shR, ankleR: HP.ftR,
  };
  return { V: restPose({ ...F, V: s.pos }, W, bind, place), S: s.pos, W, idx: s.idx, uv: uv2, cut: s.cut };
}

// ---- hàn + giảm lưới; màu đỉnh cho mức xa ----------------------------------------------------------------------------------------
// sampleColors: màu texture tại UV mỗi đỉnh (song tuyến). img: { data, w, h, ch } (sharp raw).
// weldLOD: hàn đỉnh trùng vị trí (đường may UV biến mất, màu trung bình nếu có col), giảm lưới tự do còn ~tris tam giác. Trả phần
// lưới { pos, nor, col, skin, idx, uv (0) }. skel ("human" | "horse", phần có trọng số khúc): tách tam giác cầu (human.mjs splitBridges
// theo kitTree — nỏ binh DV_NO cẳng tay áp sườn: tam giác cẳng tay + thân kéo thành gai trắng dọc nỏ khi tay vung; đáy chậu, gấu áo +
// cẳng chân, ngực ngựa giữa hai chân trước). simp (catalog, tuỳ kiểu lính): { w } giảm lưới giữ cả trọng số cẳng tay hai bên (rebake.mjs
// weldSimplify attr, nặng w) — NG_TANK LOD1: gộp cạnh qua dải khuỷu để lại tam giác 0,26 m từ khúc vai xuống cẳng tay, co 17,7 lần khi
// khuỷu gập; giữ trọng số mọi khúc thì LOD xa các kiểu khác xấu hơn (6,3 → 5,6% thay vì 3,4%), nên chỉ cẳng tay, chỉ kiểu cần.
export function sampleColors(uv, img) {
  const n = uv.length / 2, out = new Float32Array(n * 3);
  const px = (x, y, c) => img.data[(Math.min(img.h - 1, Math.max(0, y)) * img.w + Math.min(img.w - 1, Math.max(0, x))) * img.ch + c] / 255;
  for (let i = 0; i < n; i++) {
    const fx = uv[i * 2] * img.w - 0.5, fy = uv[i * 2 + 1] * img.h - 0.5, x0 = Math.floor(fx), y0 = Math.floor(fy), ax = fx - x0, ay = fy - y0;
    for (let c = 0; c < 3; c++) out[i * 3 + c] = (px(x0, y0, c) * (1 - ax) + px(x0 + 1, y0, c) * ax) * (1 - ay) + (px(x0, y0 + 1, c) * (1 - ax) + px(x0 + 1, y0 + 1, c) * ax) * ay;
  }
  return out;
}
export async function weldLOD(part, tris, col = null, skel = null, simp = null) {
  let attr = null;
  if (skel && simp && simp.w > 0) {
    const n = part.pos.length / 3, S = ["faL", "faR"].map((s) => JOINT_NAMES.indexOf(s)), d = new Float32Array(n * 2);
    for (let v = 0; v < n; v++) { const w = part.skin[v * 4 + 2] / 255, a = S.indexOf(part.skin[v * 4]), b = S.indexOf(part.skin[v * 4 + 1]); if (a >= 0) d[v * 2 + a] += w; if (b >= 0) d[v * 2 + b] += 1 - w; }
    attr = { data: d, k: 2, w: simp.w };
  }
  const { pos: P0, idx: I0, src, id } = await weldSimplify(part.pos, part.idx, tris, attr), m = src.length;
  const C = new Float32Array(m * 3), cnt = new Float32Array(m), skin = new Uint8Array(m * 4);
  for (let g = 0; g < m; g++) for (let k = 0; k < 4; k++) skin[g * 4 + k] = part.skin[src[g] * 4 + k];
  if (col) {
    for (let v = 0; v < id.length; v++) { const g = id[v]; cnt[g]++; for (let c = 0; c < 3; c++) C[g * 3 + c] += col[v * 3 + c]; }
    for (let g = 0; g < m; g++) for (let c = 0; c < 3; c++) C[g * 3 + c] /= cnt[g];
  }
  if (!skel) return { pos: P0, nor: smoothNormals(P0, I0), col: C, skin, idx: I0, uv: new Float32Array(m * 2) };
  // tách tam giác cầu: khúc (s0, s1, w0) ↔ (si, sw) 4 thành phần
  const si = new Uint8Array(m * 4), sw = new Uint8Array(m * 4);
  for (let g = 0; g < m; g++) { si[g * 4] = skin[g * 4]; si[g * 4 + 1] = skin[g * 4 + 1]; sw[g * 4] = skin[g * 4 + 2]; sw[g * 4 + 1] = 255 - skin[g * 4 + 2]; }
  const s = splitBridges({ pos: P0, idx: I0, si, sw }, JOINT_NAMES, TREE[skel].par, TREE[skel].cau), n2 = s.src.length;
  const skin2 = new Uint8Array(n2 * 4), col2 = new Float32Array(n2 * 3);
  for (let g = 0; g < n2; g++) { skin2[g * 4] = s.si[g * 4]; skin2[g * 4 + 1] = s.si[g * 4 + 1]; skin2[g * 4 + 2] = s.sw[g * 4]; for (let c = 0; c < 3; c++) col2[g * 3 + c] = C[s.src[g] * 3 + c]; }
  return { pos: s.pos, nor: smoothNormals(s.pos, s.idx), col: col2, skin: skin2, idx: s.idx, uv: new Float32Array(n2 * 2) };
}

const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

// Ghép các phần (mỗi phần: pos, nor, uv (đã đổi sang atlas), skin, idx) thành một lưới, chỉ giữ đỉnh dùng tới.
function assemble(parts, colors = false) {
  const P = [], N = [], U = [], S = [], I = [], C = [];
  for (const q of parts) {
    const remap = new Int32Array(q.pos.length / 3).fill(-1);
    for (const i of q.idx) {
      if (remap[i] < 0) {
        remap[i] = P.length / 3;
        P.push(q.pos[i * 3], q.pos[i * 3 + 1], q.pos[i * 3 + 2]); N.push(q.nor[i * 3], q.nor[i * 3 + 1], q.nor[i * 3 + 2]);
        U.push(q.uv[i * 2], q.uv[i * 2 + 1]); S.push(q.skin[i * 4], q.skin[i * 4 + 1], q.skin[i * 4 + 2], q.skin[i * 4 + 3]);
        if (colors) C.push(q.col[i * 3], q.col[i * 3 + 1], q.col[i * 3 + 2]);
      }
      I.push(remap[i]);
    }
  }
  const n = P.length / 3;
  return {
    count: n,
    index: n < 65536 ? { a: Uint16Array.from(I), t: "u16", s: 1 } : { a: Uint32Array.from(I), t: "u32", s: 1 },
    attrs: {
      position: { a: Float32Array.from(P), t: "f32", s: 3 },
      normal: { a: Int8Array.from(N, (x) => Math.round(Math.max(-1, Math.min(1, x)) * 127)), t: "i8n", s: 3 },
      uv: { a: Uint16Array.from(U, (x) => Math.round(Math.max(0, Math.min(1, x)) * 65535)), t: "u16n", s: 2 },
      aSkin: { a: Uint8Array.from(S), t: "u8", s: 4 },
      // màu đỉnh three.js hiểu là tuyến tính: đổi từ sRGB của texture
      ...(colors ? { color: { a: Uint8Array.from(C, (x) => Math.round(srgbToLinear(Math.max(0, Math.min(1, x))) * 255)), t: "u8n", s: 3 } } : {}),
    },
  };
}

// Vũ khí (raw từ bakeWeapon) đặt vào khung khúc: pos = piv khúc + p + R·s·v; skin = (khúc, khúc, 255).
function placeWeapon(raw, bone, piv, { p = [0, 0, 0], r = [0, 0, 0], s = 1 } = {}) {
  const M = new THREE.Matrix4().compose(new THREE.Vector3(piv[0] + p[0], piv[1] + p[1], piv[2] + p[2]), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), new THREE.Vector3(s, s, s));
  const n = raw.pos.length / 3, pos = new Float32Array(raw.pos.length), nor = new Float32Array(raw.nor.length), skin = new Uint8Array(n * 4);
  const v = new THREE.Vector3(), nm = new THREE.Matrix3().getNormalMatrix(M);
  for (let i = 0; i < n; i++) {
    v.set(raw.pos[i * 3], raw.pos[i * 3 + 1], raw.pos[i * 3 + 2]).applyMatrix4(M); pos.set([v.x, v.y, v.z], i * 3);
    v.set(raw.nor[i * 3], raw.nor[i * 3 + 1], raw.nor[i * 3 + 2]).applyMatrix3(nm).normalize(); nor.set([v.x, v.y, v.z], i * 3);
    skin[i * 4] = CI[bone]; skin[i * 4 + 1] = CI[bone]; skin[i * 4 + 2] = 255;
  }
  return { pos, nor, uv: raw.uv, skin, idx: raw.idx };
}

// Tua giáo / đuôi (khung "tas", treo dọc −y từ neo ở gốc): côn đơn giản một màu (SWATCH). lod: 0 — 6 cạnh, 3 đoạn (36 tam giác);
// 1 — 5 cạnh, 2 đoạn (20); 2 — 3 cạnh, 2 đoạn (12). Trước đây mọi mức đều 36 tam giác: ở LOD2 (~100–145) tua nặng hơn cả cán giáo.
function tassel(colorUV, lod = 0, len = 0.33, r0 = 0.03, r1 = 0.066) {
  const seg = [6, 5, 3][lod], pos = [], nor = [], uv = [], idx = [];
  const rings = lod ? [[0, r0], [-len * 0.75, r1], [-len, 0.005]] : [[0, r0 * 0.9], [-0.06, r0], [-len * 0.75, r1], [-len, 0.005]];
  for (const [y, r] of rings) for (let k = 0; k < seg; k++) { const a = (k / seg) * Math.PI * 2; pos.push(Math.cos(a) * r, y, Math.sin(a) * r); nor.push(Math.cos(a), 0, Math.sin(a)); uv.push(...colorUV); }
  for (let q = 0; q < rings.length - 1; q++) for (let k = 0; k < seg; k++) { const a = q * seg + k, b = q * seg + ((k + 1) % seg), c = a + seg, d = b + seg; idx.push(a, c, b, b, c, d); }
  const n = pos.length / 3, skin = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) { skin[i * 4] = CI.tas; skin[i * 4 + 1] = CI.tas; skin[i * 4 + 2] = 255; }
  return { pos: Float32Array.from(pos), nor: Float32Array.from(nor), uv: Float32Array.from(uv), skin, idx: Uint32Array.from(idx) };
}
// tua làm nguồn nướng (ảnh 1 × 1 màu) và lưới màu đỉnh
const tasselSrc = (name) => ({ ...tassel([0.5, 0.5]), img: { data: Uint8Array.from(SWATCH[name]), w: 1, h: 1, ch: 3 } });
const tasselColor = (name, lod) => { const t = tassel([0, 0], lod), c = SWATCH[name].map((x) => x / 255); return { ...t, col: Float32Array.from({ length: t.pos.length }, (_, i) => c[i % 3]) }; };

export const SWATCH = { son: [0x9b, 0x2d, 0x20], long: [0x5a, 0x46, 0x32] };

// Nối các phần { pos, nor, skin, idx } thành một lưới (đầu vào xatlas).
function concat(parts) {
  let nv = 0, ni = 0; for (const q of parts) { nv += q.pos.length / 3; ni += q.idx.length; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), skin = new Uint8Array(nv * 4), idx = new Uint32Array(ni);
  let ov = 0, oi = 0;
  for (const q of parts) {
    pos.set(q.pos, ov * 3); nor.set(q.nor, ov * 3); skin.set(q.skin, ov * 4);
    for (let i = 0; i < q.idx.length; i++) idx[oi + i] = q.idx[i] + ov;
    ov += q.pos.length / 3; oi += q.idx.length;
  }
  return { pos, nor, skin, idx };
}
// LOD0: hàn + giảm từng phần (tris[k]), nối, trải UV, nướng texture từ các phần gốc (mỗi phần có img). skels[k]: bộ khúc của phần có
// trọng số (thân lính, ngựa, người cưỡi — weldLOD tách tam giác cầu); simp: cách giảm thân lính (phần đầu, weldLOD).
async function nearLOD(parts, tris, res, skels = [], simp = null) {
  const low = [];
  for (let k = 0; k < parts.length; k++) low.push(await weldLOD(parts[k], tris[k], null, skels[k] || null, k ? null : simp));
  const r = await rebake(concat(low), parts, res);
  return { mesh: assemble([r.part]), image: r.image };
}

// ---- người đứng (bộ khúc HUMAN) --------------------------------------------------------------------------------------------
// c: { lods: [tris…], weapons: [{ raw: [raw lod0, lod1, lod2], bone, p, r, s }], tassel: "son" | "long" | null, tasZ }
export async function bakeKit(file, c) {
  const cg = cutBoxes(await readGLB(file, Infinity), c.cut), g = cg.g;
  const F = fitHuman(g.pos, g.idx, { shY: KIT_SH, fix: c.fix, box: cg.bounds, name: c.name, kit: true, shoulder: c.shoulder, fallback: c.fallback });
  const R = kitBody(F, g.idx, g.uv), n = R.V.length / 3;
  const body = { pos: R.V, nor: smoothNormals(R.V, R.idx), uv: R.uv, skin: skin2(R.W, n, MAP), idx: R.idx, img: await rawImage(g.image) };
  const bodyCol = sampleColors(R.uv, body.img);
  const wps = c.weapons.map((w) => ({ ...placeWeapon(w.full, w.bone, HP[w.bone], w), img: w.img }));
  const lods = [];
  const near = await nearLOD([body, ...wps, ...(c.tassel ? [tasselSrc(c.tassel)] : [])], [c.lods[0], ...c.weapons.map((w) => w.wl[0]), Infinity], c.res ?? 512, ["human"], c.simp);
  lods.push(near.mesh);
  for (let L = 1; L < c.lods.length; L++) {
    const parts = [await weldLOD(body, c.lods[L], bodyCol, "human", c.simp)];
    for (let k = 0; k < c.weapons.length; k++) parts.push(await weldLOD(wps[k], c.weapons[k].wl[L], c.weapons[k].col));
    if (c.tassel) parts.push(tasselColor(c.tassel, L));
    lods.push(assemble(parts, true));
  }
  // neo tua giáo (khung cẳng tay cầm giáo): chân mũi giáo đo lúc nướng (wpn.mjs meta.head) — soldier-motion.js TAS dùng thay neo
  // "dài giáo − 0,79" của giáo dựng bằng code (mũi giáo Meshy dài hơn: neo cũ rơi giữa lưỡi)
  const tw = c.tassel ? c.weapons.find((w) => w.head != null) : null;
  return { lods, image: near.image, warnings: F.lm.warnings, how: F.how, cut: cg.cut, split: R.cut, meta: { kind: "kit", skel: "human", piv: JOINT_NAMES.map((j) => (j === "tas" ? [0, 0, 0] : HP[j])),
    ...(tw ? { tas: [tw.p[0], tw.p[1], +(tw.p[2] + tw.head * (tw.s ?? 1)).toFixed(4)] } : {}), arms: F.how, ...(cg.cut ? { cut: cg.cut } : {}) } };
}
export { pivots as kitPivots, placeWeapon, assemble, skin2, restPose, tassel, MAP as KIT_MAP, YH as KIT_Y };

// ---- kỵ binh (bộ khúc HORSE): ngựa + người cưỡi ngồi --------------------------------------------------------------------------
// Ngựa: thân (cả cổ, đầu, yên) theo "pelvis"; bốn chân thL (trước trái), shL (sau trái), thR (trước phải), shR (sau phải), mỗi
// chân một khúc cứng xoay ở hông; đuôi theo "tas" (dây treo, neo ở mông). Người cưỡi: thân, đầu theo "torso", tay theo ua / fa,
// chân ngồi (đùi ra trước, gối gập quanh bụng ngựa) theo "pelvis" của ngựa.
const XP = pivots("horse");
const RIDER_MAP = { ...MAP, hips: "torso", hipL: "pelvis", kneeL: "pelvis", ankleL: "pelvis", hipR: "pelvis", kneeR: "pelvis", ankleR: "pelvis" };
const RIDER_MAP2 = { ...RIDER_MAP, shL: "uaL", elL: "faL", handL: "faL", shR: "uaR", elR: "faR", handR: "faR" };

export async function bakeHorseKit(horseFile, riderFile, c) {
  const { weld, dijkstra } = await import("./landmarks.mjs");
  // ---- ngựa ----
  const h = await readGLB(horseFile, Infinity);
  let P = h.pos;
  const bb = (A) => { const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]; for (let i = 0; i < A.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], A[i + k]); hi[k] = Math.max(hi[k], A[i + k]); } return { lo, hi }; };
  // hướng đầu: điểm cao nhất (tai) nằm về phía đầu theo trục dài
  let b = bb(P);
  const long = b.hi[0] - b.lo[0] > b.hi[2] - b.lo[2] ? 0 : 2;
  let top = 1; for (let i = 0; i < P.length; i += 3) if (P[i + 1] > P[top]) top = i + 1;
  const cL = (b.hi[long] + b.lo[long]) / 2, headSign = P[top - 1 + long] > cL ? 1 : -1;
  // xoay cho đầu về +Z
  const rot = new THREE.Matrix4();
  if (long === 0) rot.makeRotationY(headSign > 0 ? -Math.PI / 2 : Math.PI / 2); else if (headSign < 0) rot.makeRotationY(Math.PI);
  const V0 = new Float32Array(P.length), t = new THREE.Vector3();
  for (let i = 0; i < P.length; i += 3) { t.set(P[i], P[i + 1], P[i + 2]).applyMatrix4(rot); V0[i] = t.x; V0[i + 1] = t.y; V0[i + 2] = t.z; }
  b = bb(V0);
  for (let i = 0; i < V0.length; i += 3) { V0[i] -= (b.hi[0] + b.lo[0]) / 2; V0[i + 1] -= b.lo[1]; V0[i + 2] -= (b.hi[2] + b.lo[2]) / 2; }
  b = bb(V0);
  const Hh = b.hi[1], Lz = b.hi[2] - b.lo[2];
  // cột chân: lát 0,1–0,25 cao, bốn góc phần tư quanh tâm
  const legs = { thL: [0, 0, 0], shL: [0, 0, 0], thR: [0, 0, 0], shR: [0, 0, 0] };
  for (let i = 0; i < V0.length; i += 3) {
    const y = V0[i + 1]; if (y < 0.1 * Hh || y > 0.25 * Hh) continue;
    const k = (V0[i] < 0 ? (V0[i + 2] > 0 ? "thL" : "shL") : (V0[i + 2] > 0 ? "thR" : "shR"));
    legs[k][0] += V0[i]; legs[k][1] += V0[i + 2]; legs[k][2]++;
  }
  for (const k in legs) { const L = legs[k]; if (!L[2]) throw new Error("ngựa: không thấy chân " + k); legs[k] = [L[0] / L[2], L[1] / L[2]]; }
  // bụng: đỉnh thấp nhất giữa thân (giữa hai cặp chân, gần trục)
  const zf = (legs.thL[1] + legs.thR[1]) / 2, zb = (legs.shL[1] + legs.shR[1]) / 2, zc = (zf + zb) / 2;
  let belly = Infinity;
  for (let i = 0; i < V0.length; i += 3) if (Math.abs(V0[i + 2] - zc) < 0.15 * (zf - zb) && Math.abs(V0[i]) < 0.08 * Lz) belly = Math.min(belly, V0[i + 1]);
  // tỉ lệ: bụng → 0,845 (đáy thân ngựa bộ khúc); dài chân trước–sau → 1,0, rộng → 0,34 (kẹp ±20%)
  const s = 0.845 / belly, clamp = (x) => Math.max(0.8, Math.min(1.2, x));
  const sz = clamp(1.0 / ((zf - zb) * s)), sx = clamp(0.34 / (((legs.thR[0] + legs.shR[0]) - (legs.thL[0] + legs.shL[0])) / 2 * s));
  const V = new Float32Array(V0.length);
  for (let i = 0; i < V0.length; i += 3) { V[i] = V0[i] * s * sx; V[i + 1] = V0[i + 1] * s; V[i + 2] = (V0[i + 2] - zc) * s * sz; }
  for (const k in legs) legs[k] = [legs[k][0] * s * sx, (legs[k][1] - zc) * s * sz];
  // đuôi: chóp đuôi = đỉnh sau nhất trong vùng 0,35–1,0 m, hẹp ngang; đoạn đuôi = khoảng cách đo dọc lưới tới chóp < dài đuôi
  const G = weld(V, h.idx);
  let tip = -1;
  for (let v = 0; v < G.n; v++) { const x = G.P[v * 3], y = G.P[v * 3 + 1], z = G.P[v * 3 + 2]; if (y < 0.35 || y > 1.0 || Math.abs(x) > 0.15) continue; if (tip < 0 || z < G.P[tip * 3 + 2]) tip = v; }
  const DT = dijkstra(G, [tip]).dist, tailLen = c.tailLen ?? 0.7;
  let rc = [0, 0, 0, 0];
  for (let v = 0; v < G.n; v++) if (Math.abs(DT[v] - tailLen) < 0.03) { rc[0] += G.P[v * 3]; rc[1] += G.P[v * 3 + 1]; rc[2] += G.P[v * 3 + 2]; rc[3]++; }
  const tailRoot = rc[3] ? [rc[0] / rc[3], rc[1] / rc[3], rc[2] / rc[3]] : [0, 1.2, -0.75];
  // trọng số, dời chân về hông bộ khúc (chỉ tịnh tiến). Dải chân → thân quanh khớp hông chân (0,92: 0,84–1,0; trước đây 0,78–0,98,
  // khớp ở 30% dải); da theo chân giảm dần theo khoảng cách ngang tới cột chân (0,12–0,2): đỉnh bụng gần chân không bị chân kéo xuống
  // khi phi (trước đây cả bụng trong 0,2 m theo chân — mảng tối dưới bụng). Phần dời chân giữ dải cũ 0,78–0,98 (dáng nghỉ không đổi).
  const n = V.length / 3, skin = new Uint8Array(n * 4), VR = new Float32Array(V.length);
  const lin = (x, a, b2) => Math.max(0, Math.min(1, (x - a) / (b2 - a)));
  for (let i = 0; i < n; i++) {
    const x = V[i * 3], y = V[i * 3 + 1], z = V[i * 3 + 2], wi = h.idx ? G.id[i] : i;
    let bone = "pelvis", w = 1, ws = 1, dx = 0, dz = 0;
    const dt = DT[wi];
    if (dt < tailLen + 0.06) { bone = "tas"; w = ws = 1 - lin(dt, tailLen - 0.06, tailLen + 0.06); }
    else if (y < 1.0) {
      let best = null, bd = Infinity;
      for (const k in legs) { const d = Math.hypot(x - legs[k][0], z - legs[k][1]); if (d < bd) { bd = d; best = k; } }
      if (bd < 0.2) { bone = best; w = 1 - lin(y, 0.78, 0.98); ws = (1 - lin(y, 0.84, 1.0)) * (1 - lin(bd, 0.12, 0.2)); dx = XP[best][0] - legs[best][0]; dz = XP[best][2] - legs[best][1]; }
    }
    VR[i * 3] = x + dx * w; VR[i * 3 + 1] = y; VR[i * 3 + 2] = z + dz * w;
    skin[i * 4] = CI[bone]; skin[i * 4 + 1] = CI.pelvis; skin[i * 4 + 2] = Math.round(ws * 255);
  }
  const hnor = smoothNormals(VR, h.idx);
  const horse = { pos: VR, nor: hnor, uv: h.uv, skin, idx: h.idx, img: await rawImage(h.image) };

  // ---- người cưỡi ----
  const cr = cutBoxes(await readGLB(riderFile, Infinity), c.cut), r = cr.g;
  const F = fitHuman(r.pos, r.idx, { shY: HP.uaL[1], fix: c.fix, box: cr.bounds, name: c.name, kit: true, shoulder: c.shoulder, fallback: c.fallback });
  const bind = bindSkeleton(F, YH);
  const W = weights15(F, YH, KIT_W);
  const seat = [0, XP.torso[1] - 0.08, XP.torso[2]];
  const DOWNV = new THREE.Vector3(0, -1, 0);
  const legFrame = (from, to) => ({ p: from, q: new THREE.Quaternion().setFromUnitVectors(DOWNV, new THREE.Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2]).normalize()) });
  const place = {
    hips: seat, torso: XP.torso, head: [0, XP.torso[1] + (F.neckY - YH.torso), XP.torso[2]],
    shL: XP.uaL, elL: XP.faL, handL: [XP.faL[0], XP.faL[1] - 0.27, XP.faL[2]],
    shR: XP.uaR, elR: XP.faR, handR: [XP.faR[0], XP.faR[1] - 0.27, XP.faR[2]],
  };
  for (const [sd, sg] of [["L", -1], ["R", 1]]) {
    const hip = [sg * 0.12, seat[1] - 0.02, seat[2]], knee = [sg * 0.3, seat[1] - 0.2, seat[2] + 0.36], ankle = [sg * 0.31, seat[1] - 0.52, seat[2] + 0.2];
    place["hip" + sd] = legFrame(hip, knee); place["knee" + sd] = legFrame(knee, ankle); place["ankle" + sd] = { p: ankle, q: legFrame(knee, ankle).q };
  }
  const RV = restPose(F, W, bind, place);
  const rskin = skin2(W, RV.length / 3, RIDER_MAP2, "horse");
  const rider = { pos: RV, nor: smoothNormals(RV, r.idx), uv: r.uv, skin: rskin, idx: r.idx, img: await rawImage(r.image) };

  const hCol = sampleColors(h.uv, horse.img), rCol = sampleColors(r.uv, rider.img);
  const wps = c.weapons.map((w) => ({ ...placeWeapon(w.full, w.bone, XP[w.bone], w), img: w.img }));
  const near = await nearLOD([horse, rider, ...wps], [...c.lods[0], ...c.weapons.map((w) => w.wl[0])], c.res ?? 1024, ["horse", "horse"]);
  const lods = [near.mesh];
  for (let L = 1; L < c.lods.length; L++) {
    const [th, tr] = c.lods[L];
    const parts = [await weldLOD(horse, th, hCol, "horse"), await weldLOD(rider, tr, rCol, "horse")];
    for (let k = 0; k < c.weapons.length; k++) parts.push(await weldLOD(wps[k], c.weapons[k].wl[L], c.weapons[k].col));
    lods.push(assemble(parts, true));
  }
  const piv = JOINT_NAMES.map((j) => (j === "tas" ? tailRoot.map((x) => +x.toFixed(4)) : XP[j]));
  return { lods, image: near.image, warnings: F.lm.warnings, how: F.how, meta: { kind: "kit", skel: "horse", piv, arms: F.how }, info: { s, sx, sz, belly, tailRoot, legs } };
}
