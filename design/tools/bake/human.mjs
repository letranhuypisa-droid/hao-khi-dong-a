// design/tools/bake/human.mjs — phần dùng chung của nhân vật rig (char.mjs) và lính đám đông (kit.mjs): chuẩn hoá mô hình người
// Meshy theo độ cao vai, dò khớp (landmarks.mjs), khung gắn 15 khớp theo dáng tay của mô hình, trọng số da.
//
// 15 khớp theo rig tướng (models.js): hips, torso, head, shL/elL/handL, shR/elR/handR, hipL/kneeL/ankleL, hipR/kneeR/ankleR.
// Khung gắn: thân, chân thẳng đứng (góc 0); vai, khuỷu xoay cho xương trùng hướng tay mô hình (tay đưa ra trước hoặc chữ A).
// Trọng số: tay theo khoảng cách đo dọc mặt lưới từ đầu ngón (tay đưa ra trước ngực vẫn thuộc về tay, không dính vào ngực);
// đầu, thân, hông theo độ cao; chân theo bên và độ cao, vạt áo xa trục chân chia thêm cho hông (chân bước không xé áo).

import * as THREE from "three";
import { landmarks } from "./landmarks.mjs";

export const JOINTS = ["hips", "torso", "head", "shL", "elL", "handL", "shR", "elR", "handR", "hipL", "kneeL", "ankleL", "hipR", "kneeR", "ankleR"];
export const PARENT = { hips: null, torso: "hips", head: "torso", shL: "torso", elL: "shL", handL: "elL", shR: "torso", elR: "shR", handR: "elR",
  hipL: "hips", kneeL: "hipL", ankleL: "kneeL", hipR: "hips", kneeR: "hipR", ankleR: "kneeR" };
const DOWN = new THREE.Vector3(0, -1, 0);
export const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);

// pos: toạ độ gốc Meshy. shY: độ cao vai mong muốn (rig tướng 1,48; lính đám đông 1,43). Trả { V (đã chuẩn hoá), J (khớp, cùng
// hệ toạ độ), s (tỉ lệ so với chuẩn hoá thô cao 1,9), lm, neckY, legX: { L, R } }.
export function fitHuman(pos, idx, { shY, fix = null }) {
  const H = 1.9;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < pos.length; i += 3) { x0 = Math.min(x0, pos[i]); x1 = Math.max(x1, pos[i]); y0 = Math.min(y0, pos[i + 1]); y1 = Math.max(y1, pos[i + 1]); z0 = Math.min(z0, pos[i + 2]); z1 = Math.max(z1, pos[i + 2]); }
  const k0 = H / (y1 - y0), P = new Float32Array(pos.length);
  for (let i = 0; i < pos.length; i += 3) { P[i] = (pos[i] - (x0 + x1) / 2) * k0; P[i + 1] = (pos[i + 1] - y0) * k0; P[i + 2] = (pos[i + 2] - (z0 + z1) / 2) * k0; }
  const lm = landmarks(P, idx, H), j = lm.j;
  if (fix) for (const [k, v] of Object.entries(fix)) j[k] = v;             // khớp ghi tay (toạ độ chuẩn hoá thô, cao 1,9)
  for (const k of ["shL", "shR", "elL", "elR", "handL", "handR"]) if (!j[k]) throw new Error(`thiếu khớp ${k}`);
  const s = shY / ((j.shL[1] + j.shR[1]) / 2), ox = j.head[0], oz = j.head[2];
  const T = (a) => [(a[0] - ox) * s, a[1] * s, (a[2] - oz) * s];
  const V = new Float32Array(P.length);
  for (let i = 0; i < P.length; i += 3) { const q = T([P[i], P[i + 1], P[i + 2]]); V[i] = q[0]; V[i + 1] = q[1]; V[i + 2] = q[2]; }
  const J = {}; for (const [k, a] of Object.entries(j)) J[k] = T(a);
  const legX = { L: Math.min(-0.07, J.ankleL[0]), R: Math.max(0.07, J.ankleR[0]) };
  return { V, J, s, lm, neckY: J.head[1], legX };
}

// Bộ xương gắn (bind) trong khung gốc: hông, thân ở độ cao cho trước (Y.hips, Y.torso), chân thẳng đứng ở bề ngang mô hình với độ
// dài đoạn cho trước (Y.thigh, Y.shin, Y.hipOff), vai/khuỷu/cổ tay ở khớp dò được, xoay theo tay. Trả { B (tên → Bone), inv (mảng
// 15 × 16 ma trận gắn nghịch đảo), restLocal (vị trí khớp trong khung cha, góc 0) }.
export function bindSkeleton(F, Y) {
  const { J, legX, neckY } = F, B = {};
  for (const n of JOINTS) { B[n] = new THREE.Bone(); B[n].name = n; }
  for (const n of JOINTS) if (PARENT[n]) B[PARENT[n]].add(B[n]);
  B.hips.position.set(0, Y.hips, 0); B.torso.position.set(0, Y.torso - Y.hips, 0);
  B.head.position.set(0, neckY - Y.torso, 0);
  for (const sd of ["L", "R"]) {
    const sh = v3(J["sh" + sd]), el = v3(J["el" + sd]), hd = v3(J["hand" + sd]);
    B["sh" + sd].position.set(sh.x, sh.y - Y.torso, sh.z);
    B["el" + sd].position.set(0, -el.distanceTo(sh), 0);
    B["hand" + sd].position.set(0, -hd.distanceTo(el), 0);
    B["hip" + sd].position.set(legX[sd], -Y.hipOff, 0); B["knee" + sd].position.set(0, -Y.thigh, 0); B["ankle" + sd].position.set(0, -Y.shin, 0);
  }
  for (const b of Object.values(B)) b.rotation.order = b.name.startsWith("sh") ? "YXZ" : "XYZ";
  const restLocal = Object.fromEntries(JOINTS.map((n) => [n, B[n].position.toArray()]));
  const aim = (n, target) => {
    const b = B[n], pq = new THREE.Quaternion(), wp = new THREE.Vector3();
    b.parent.updateWorldMatrix(true, false); b.parent.getWorldQuaternion(pq);
    b.updateWorldMatrix(true, false); b.getWorldPosition(wp);
    const dir = v3(target).sub(wp).normalize().applyQuaternion(pq.invert());
    b.quaternion.setFromUnitVectors(DOWN, dir); b.updateWorldMatrix(false, true);
  };
  B.hips.updateWorldMatrix(true, true);
  for (const sd of ["L", "R"]) { aim("sh" + sd, J["el" + sd]); aim("el" + sd, J["hand" + sd]); }
  B.hips.updateWorldMatrix(true, true);
  for (const sd of ["L", "R"]) {
    const w = new THREE.Vector3(); B["hand" + sd].getWorldPosition(w);
    if (w.distanceTo(v3(J["hand" + sd])) > 0.02) throw new Error(`khung gắn tay ${sd} lệch ${w.distanceTo(v3(J["hand" + sd])).toFixed(3)}`);
  }
  const inv = JOINTS.map((n) => new THREE.Matrix4().copy(B[n].matrixWorld).invert());
  return { B, inv, restLocal };
}

// Trọng số 15 khớp mỗi đỉnh (Float32Array n × 15, tổng 1). Y: { hips, ankle, knee } độ cao (khung đã chuẩn hoá).
export function weights15(F, Y) {
  const { V, s, lm, neckY, legX } = F, n = V.length / 3, NB = JOINTS.length;
  const W = new Float32Array(n * NB), JI = Object.fromEntries(JOINTS.map((x, i) => [x, i]));
  const add = (v, name, w) => { if (w > 0) W[v * NB + JI[name]] += w; };
  const lin = (x, a, b) => Math.max(0, Math.min(1, (x - a) / (b - a)));
  const geo = lm.info.geo, wid = lm.info.weldId;
  const bh = 0.02, be = 0.045, bs = 0.06;                     // nửa bề rộng vùng trộn: cổ tay, khuỷu, vai (m)
  const kA = Y.ankle, kK = Y.knee, hY = Y.hips;
  for (let v = 0; v < n; v++) {
    const x = V[v * 3], y = V[v * 3 + 1], z = V[v * 3 + 2];
    let arm = null, best = Infinity;
    for (const sd of ["L", "R"]) {
      const G = geo[sd]; if (!G) continue;
      const d = G.DF[wid[v]] * s; if (d <= G.dSh * s + bs && d < best) { best = d; arm = sd; }
    }
    if (arm) {
      const G = geo[arm], dH = G.dHand * s, dE = G.dEl * s, dS = G.dSh * s, d = best;
      const a = lin(d, dH - bh, dH + bh), b = lin(d, dE - be, dE + be), c = lin(d, dS - bs, dS + bs);
      add(v, "hand" + arm, 1 - a); add(v, "el" + arm, a * (1 - b)); add(v, "sh" + arm, b * (1 - c)); add(v, "torso", c);
      continue;
    }
    const wHead = lin(y, neckY - 0.03, neckY + 0.03);
    if (y > hY + 0.02) {
      const wT = lin(y, hY - 0.02, hY + 0.1);
      add(v, "head", wHead); add(v, "torso", (1 - wHead) * wT); add(v, "hips", (1 - wHead) * (1 - wT));
      continue;
    }
    const wR = lin(x, -0.035, 0.035), wTop = lin(y, hY - 0.16, hY + 0.02);
    for (const [sd, ws] of [["L", 1 - wR], ["R", wR]]) {
      if (ws <= 0) continue;
      const r = Math.hypot(x - legX[sd], z), robe = Math.min(0.75, Math.max(0, (r - 0.1) / 0.12) * 0.75);
      const wAnk = 1 - lin(y, kA, kA + 0.06), wKnee = lin(y, kA, kA + 0.06) * (1 - lin(y, kK - 0.05, kK + 0.05)), wThigh = lin(y, kK - 0.05, kK + 0.05);
      const leg = ws * (1 - robe) * (1 - wTop);
      add(v, "ankle" + sd, leg * wAnk); add(v, "knee" + sd, leg * wKnee); add(v, "hip" + sd, leg * wThigh);
      add(v, "hips", ws - leg);
    }
  }
  for (let v = 0; v < n; v++) {
    let S = 0; for (let b = 0; b < NB; b++) S += W[v * NB + b];
    if (S > 0) for (let b = 0; b < NB; b++) W[v * NB + b] /= S; else W[v * NB + JI.torso] = 1;
  }
  return W;
}

// Giữ k xương nặng nhất mỗi đỉnh (chuẩn hoá lại). Trả { idx: Uint8Array n·k, w: Float32Array n·k }.
export function topK(W, NB, k) {
  const n = W.length / NB, idx = new Uint8Array(n * k), w = new Float32Array(n * k);
  for (let v = 0; v < n; v++) {
    const t = []; for (let b = 0; b < NB; b++) if (W[v * NB + b] > 1e-4) t.push([W[v * NB + b], b]);
    t.sort((a, b) => b[0] - a[0]); t.length = Math.min(k, t.length);
    if (!t.length) t.push([1, 1]);
    const S = t.reduce((a, q) => a + q[0], 0);
    for (let q = 0; q < k; q++) { const e = t[q] || t[0]; idx[v * k + q] = e[1]; w[v * k + q] = t[q] ? e[0] / S : 0; }
  }
  return { idx, w };
}
