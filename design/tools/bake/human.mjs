// design/tools/bake/human.mjs — phần dùng chung của nhân vật rig (char.mjs) và lính đám đông (kit.mjs): cắt phần thừa (catalog cut),
// chuẩn hoá mô hình người Meshy theo độ cao vai, dò khớp (landmarks.mjs) rồi kiểm tay (độ dài, hai bên lệch, vai): tay sai thay bằng
// tay kia đối xứng nếu khớp lưới, rồi tỉ lệ người trên trục dò được, không được thì dừng nướng báo lỗi kèm tên mẫu (thêm khớp ghi
// tay vào catalog.mjs). Khung gắn 15 khớp theo dáng tay của mô hình, trọng số da.
//
// 15 khớp theo rig tướng (models.js): hips, torso, head, shL/elL/handL, shR/elR/handR, hipL/kneeL/ankleL, hipR/kneeR/ankleR.
// Khung gắn: thân, chân thẳng đứng (góc 0); vai, khuỷu xoay cho xương trùng hướng tay mô hình (tay đưa ra trước hoặc chữ A), trục x
// (bản lề khuỷu) theo mặt gập khuỷu của mô hình.
// Trọng số: tay theo khoảng cách đo dọc mặt lưới từ đầu ngón (tay đưa ra trước ngực vẫn thuộc về tay, không dính vào ngực) — tay ghi
// tay / đối xứng theo chiếu lên chuỗi xương (axialGeo: đường đo từ đầu ngón dò sai lan sang vạt áo); đầu, thân, hông theo độ cao;
// chân theo bên và độ cao, vạt áo xa trục chân chia thêm cho hông (chân bước không xé áo).

import * as THREE from "three";
import { landmarks, armJoints, armProblems, armAsym, mirrorArm, axialGeo, ARM_RULE, ARM_OK, ARM_KIT } from "./landmarks.mjs";

export const JOINTS = ["hips", "torso", "head", "shL", "elL", "handL", "shR", "elR", "handR", "hipL", "kneeL", "ankleL", "hipR", "kneeR", "ankleR"];
export const PARENT = { hips: null, torso: "hips", head: "torso", shL: "torso", elL: "shL", handL: "elL", shR: "torso", elR: "shR", handR: "elR",
  hipL: "hips", kneeL: "hipL", ankleL: "kneeL", hipR: "hips", kneeR: "hipR", ankleR: "kneeR" };
const DOWN = new THREE.Vector3(0, -1, 0);
export const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);

// Hộp bao [x0, x1, y0, y1, z0, z1] của lưới (khung chuẩn hoá: chân y0 → 0, cao → 1,9, giữa x, z → 0).
export function bounds(pos) {
  const b = [Infinity, -Infinity, Infinity, -Infinity, Infinity, -Infinity];
  for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) { b[k * 2] = Math.min(b[k * 2], pos[i + k]); b[k * 2 + 1] = Math.max(b[k * 2 + 1], pos[i + k]); }
  return b;
}
const normPt = (b, H) => { const k0 = H / (b[3] - b[2]); return (x, y, z) => [(x - (b[0] + b[1]) / 2) * k0, (y - b[2]) * k0, (z - (b[4] + b[5]) / 2) * k0]; };

// Cắt bỏ phần thừa của mẫu Meshy trước khi dò khớp, tính trọng số (catalog cut: sừng mũ, bao đao): xoá tam giác có trọng tâm
// trong một hộp { lo: [x, y, z], hi: [x, y, z] } (khung chuẩn hoá thô cao 1,9 của lưới chưa cắt), bỏ đỉnh không còn dùng.
// g: { pos, uv, idx, … } của readGLB. Trả { g (mới), bounds (hộp bao lưới chưa cắt — giữ khung chuẩn hoá), cut (số tam giác) }.
export function cutBoxes(g, boxes) {
  const b = bounds(g.pos);
  if (!boxes || !boxes.length) return { g, bounds: b, cut: 0 };
  const N = normPt(b, 1.9), P = g.pos, keep = [];
  for (let t = 0; t < g.idx.length; t += 3) {
    const c = [0, 0, 0]; for (let q = 0; q < 3; q++) { const v = g.idx[t + q], p = N(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]); for (let k = 0; k < 3; k++) c[k] += p[k] / 3; }
    if (!boxes.some((x) => c.every((cv, k) => cv >= x.lo[k] && cv <= x.hi[k]))) keep.push(g.idx[t], g.idx[t + 1], g.idx[t + 2]);
  }
  const map = new Int32Array(P.length / 3).fill(-1), pos = [], uv = [], idx = [];
  for (const v of keep) { if (map[v] < 0) { map[v] = pos.length / 3; pos.push(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]); uv.push(g.uv[v * 2], g.uv[v * 2 + 1]); } idx.push(map[v]); }
  return { g: { ...g, pos: Float32Array.from(pos), uv: Float32Array.from(uv), idx: Uint32Array.from(idx) }, bounds: b, cut: (g.idx.length - keep.length) / 3 };
}

// pos: toạ độ gốc Meshy. shY: độ cao vai mong muốn (rig tướng 1,48; lính đám đông 1,43). fix: khớp tay ghi tay (toạ độ chuẩn hoá
// thô, cao 1,9) khi bộ dò sai; box: hộp bao lưới chưa cắt (cutBoxes); name: mã mẫu (báo lỗi); wc01: rig đại kiếm (cẳng tay tới
// 0,37); kit: lính đám đông (dải độ dài rộng hơn, ARM_KIT). Tay: dò (landmarks), kiểm dải (armProblems, hai tay lệch ≤ 25%); tay
// sai thay bằng tay kia đối xứng nếu khớp lưới, rồi tỉ lệ người trên trục dò được, không được thì dừng nướng báo lỗi tên mẫu.
// Trả { V (đã chuẩn hoá), J (khớp, cùng hệ toạ độ), s (tỉ lệ so với chuẩn hoá thô cao 1,9), ox, oz (trục cổ ở khung thô:
// x' = (x − ox)·s), lm, geo (trường khoảng cách tay cho trọng số, mỗi bên), how (cách dựng mỗi tay), neckY, legX: { L, R } }.
export function fitHuman(pos, idx, { shY, fix = null, box = null, name = "?", wc01 = false, kit = false }) {
  const H = 1.9, b = box || bounds(pos), N = normPt(b, H), P = new Float32Array(pos.length);
  for (let i = 0; i < pos.length; i += 3) P.set(N(pos[i], pos[i + 1], pos[i + 2]), i);
  const lm = landmarks(P, idx, H), j = lm.j, info = lm.info, G = info.weld, ox = j.head[0];
  const ok = kit ? ARM_KIT : ARM_OK, foreMax = wc01 ? ARM_OK.foreWC01 : ok.fore[1], RAD = [0.05, 0.04, 0.045], RAD_OUT = [0.07, 0.07, 0.065];
  const arms = {}, geo = {};
  for (const sd of ["L", "R"]) {
    const a = info.arm[sd];
    if (fix && fix["sh" + sd]) arms[sd] = { sh: fix["sh" + sd], el: fix["el" + sd], hand: fix["hand" + sd], how: "ghi tay" };
    else if (a && a.A) { arms[sd] = { sh: a.A.sh, el: a.A.el, hand: a.A.hand, how: a.A.how, bad: a.ok ? null : a.why }; geo[sd] = info.geo[sd]; }
  }
  const scaleOf = () => {
    const ys = ["L", "R"].filter((sd) => arms[sd] && !arms[sd].bad).map((sd) => arms[sd].sh[1]);
    if (!ys.length) throw new Error(`${name}: không dò được vai nào (${lm.warnings.join("; ") || "vai lệch"}) — thêm khớp ghi tay vào catalog.mjs`);
    return shY / (ys.reduce((p, q) => p + q, 0) / ys.length);
  };
  const check = (s) => {
    const pr = {};
    for (const sd of ["L", "R"]) pr[sd] = !arms[sd] ? [`không có trục tay (${info.arm[sd]?.why || "không thấy đầu ngón"})`] : [...(arms[sd].bad ? [arms[sd].bad] : []), ...armProblems(arms[sd], sd, s, { ox, foreMax, ok })];
    if (!pr.L.length && !pr.R.length && armAsym(arms.L, arms.R) > ok.lr) {
      const bend = (sd) => (arms[sd].how === "ghi tay" ? Infinity : info.arm[sd]?.A?.bend ?? 0);
      pr[bend("L") < bend("R") ? "L" : "R"].push(`hai tay lệch ${(armAsym(arms.L, arms.R) * 100).toFixed(0)}%`);
    }
    return pr;
  };
  let s = scaleOf(), pr = check(s);
  for (const sd of ["L", "R"]) {
    if (!pr[sd].length) continue;
    if (arms[sd] && arms[sd].how === "ghi tay") throw new Error(`${name}: khớp ghi tay ${sd} sai (${pr[sd].join(", ")})`);
    const o = sd === "L" ? "R" : "L", a = info.arm[sd], tried = [];
    // (1) tay kia đối xứng — chỉ khi khớp lưới bên này: khuỷu, "hand" cách mặt lưới ≤ 0,05 H, "hand" gần đầu ngón dò được (≤ 0,1 H)
    if (arms[o] && !pr[o].length) {
      const m = mirrorArm({ sh: arms[o].sh, el: arms[o].el, hand: arms[o].hand }, ox);
      const near = (p) => { let d = Infinity; for (let v = 0; v < G.n; v++) d = Math.min(d, Math.hypot(G.P[v * 3] - p[0], G.P[v * 3 + 1] - p[1], G.P[v * 3 + 2] - p[2])); return d; };
      const why = near(m.el) > 0.05 * H ? "khuỷu ngoài lưới" : near(m.hand) > 0.05 * H ? "bàn tay ngoài lưới" : a && a.tip && v3(m.hand).distanceTo(v3(a.tip)) > 0.1 * H ? "xa đầu ngón dò được" : "";
      if (!why) { arms[sd] = { ...m, how: "đối xứng" }; delete geo[sd]; continue; }
      tried.push("đối xứng: " + why);
    }
    // (2) tỉ lệ người trên trục dò được (khuỷu ở tỉ lệ ratio0); vai sai thì lấy vai tay kia đối xứng, cắt trục ở điểm gần vai đó
    if (a && a.rings && a.rings.length >= 5 && a.tip) {
      let rr = a.rings;
      if (arms[o] && !pr[o].length && (a.why || pr[sd].some((p) => p.startsWith("vai")))) {
        const shM = [2 * ox - arms[o].sh[0], arms[o].sh[1], arms[o].sh[2]];
        let k = 0; for (let i = 1; i < rr.length; i++) if (v3(rr[i].c).distanceTo(v3(shM)) < v3(rr[k].c).distanceTo(v3(shM))) k = i;
        rr = [...rr.slice(0, k), { d: rr[k].d, c: shM }];
      }
      const A = armJoints(rr, a.tip, H, { ...ARM_RULE, bendMin: Infinity });
      const p2 = A ? armProblems(A, sd, s, { ox, foreMax, ok }) : ["trục quá ngắn"];
      if (!p2.length) { arms[sd] = { sh: A.sh, el: A.el, hand: A.hand, how: "tỉ lệ người" }; geo[sd] = { DF: info.geo[sd].DF, dHand: A.dHand, dEl: A.dEl, dSh: A.dSh }; continue; }
      tried.push("tỉ lệ người: " + p2.join(", "));
    }
    throw new Error(`${name}: tay ${sd} không dựng được (${pr[sd].join(", ")}${tried.length ? "; " + tried.join("; ") : ""}) — thêm khớp ghi tay vào catalog.mjs`);
  }
  s = scaleOf(); pr = check(s);
  for (const sd of ["L", "R"]) if (pr[sd].length) throw new Error(`${name}: tay ${sd} sau khi thay vẫn sai (${pr[sd].join(", ")})`);
  for (const sd of ["L", "R"]) {
    const A = arms[sd];
    j["sh" + sd] = A.sh; j["el" + sd] = A.el; j["hand" + sd] = A.hand;
    // tay ghi tay / đối xứng: trọng số theo chiếu lên chuỗi xương (đo dọc mặt lưới từ đầu ngón dò được thì lan sang vạt áo)
    // đầu chuỗi: đầu ngón dò được nếu cách "hand" ≤ 0,1 H (bộ dò thấy đúng bàn tay, chỉ vai / khuỷu sai), không thì kéo dài cẳng tay 0,06 H
    if (!geo[sd]) {
      const t0 = info.arm[sd] && info.arm[sd].tip, dir = v3(A.hand).sub(v3(A.el)).normalize().multiplyScalar(0.06 * H);
      const near = t0 && v3(t0).distanceTo(v3(A.hand)) <= 0.1 * H, tip = near ? t0 : [A.hand[0] + dir.x, A.hand[1] + dir.y, A.hand[2] + dir.z];
      geo[sd] = axialGeo(G.P, G.n, [tip, A.hand, A.el, A.sh], sd, H, RAD, ox, RAD_OUT);
      // ngón tay xoè (ngón cái giơ cao) ra ngoài ống quanh bàn tay: đỉnh gần đầu ngón dò được theo mặt lưới (≤ 2,5 lần đầu ngón → "hand")
      // lấy khoảng cách đo dọc mặt lưới
      const gd = near && info.geo[sd] && info.geo[sd].DF, lim = 2.5 * geo[sd].dHand;
      if (gd) for (let v = 0; v < G.n; v++) if (gd[v] <= lim) geo[sd].DF[v] = Math.min(geo[sd].DF[v], gd[v]);
    }
  }
  // cổ: dò theo vai đã chọn (landmarks); vai đổi ở bước thay thế mà cổ ra ngoài 0,05–0,26 m trên vai thì đặt 0,07 H trên vai
  const shYr = (j.shL[1] + j.shR[1]) / 2, hh = (j.head[1] - shYr) * s;
  if (!(hh >= 0.05 && hh <= 0.26)) { lm.warnings.push(`cổ ${hh.toFixed(2)} m trên vai: đặt lại`); j.head[1] = shYr + 0.07 * H; }
  const oz = j.head[2];
  const T = (a) => [(a[0] - ox) * s, a[1] * s, (a[2] - oz) * s];
  const V = new Float32Array(P.length);
  for (let i = 0; i < P.length; i += 3) { const q = T([P[i], P[i + 1], P[i + 2]]); V[i] = q[0]; V[i + 1] = q[1]; V[i + 2] = q[2]; }
  const J = {}; for (const [k, a] of Object.entries(j)) J[k] = T(a);
  const legX = { L: Math.min(-0.07, J.ankleL[0]), R: Math.max(0.07, J.ankleR[0]) };
  return { V, J, s, ox, oz, lm, geo, how: { L: arms.L.how, R: arms.R.how }, neckY: J.head[1], legX };
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
  // Hướng xương tay: −y dọc xương (vai → khuỷu, khuỷu → cổ tay); trục x của vai và khuỷu là pháp tuyến mặt phẳng gập khuỷu của
  // mô hình (tay → khuỷu → vai), +z về phía lòng khuỷu — lúc chạy elLx âm gập khuỷu đúng chiều lòng khuỷu (tay buông: ra trước) như
  // rig khối, và gắn → nghỉ chỉ là duỗi quanh trục x (không xoắn cẳng tay). Trước đây xoay ngắn nhất từ −y (setFromUnitVectors) nên
  // trục bản lề lệch mặt gập 30–88° — khuỷu gập ra ngoài nếp khuỷu. Tay gần thẳng (< 12°) không rõ mặt gập: trục x theo cách xoay
  // ngắn nhất của vai.
  B.hips.updateWorldMatrix(true, true);
  const tq = new THREE.Quaternion(); B.torso.getWorldQuaternion(tq);
  for (const sd of ["L", "R"]) {
    const sh = v3(J["sh" + sd]), el = v3(J["el" + sd]), hd = v3(J["hand" + sd]);
    const u = el.clone().sub(sh).normalize(), f = hd.clone().sub(el).normalize();
    let X = new THREE.Vector3().crossVectors(f, u);
    if (X.length() < Math.sin((12 * Math.PI) / 180)) X = new THREE.Vector3(1, 0, 0).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(DOWN, u));
    const frame = (down) => {
      const Y = down.clone().negate(), x = X.clone().sub(Y.clone().multiplyScalar(X.dot(Y))).normalize(), Z = new THREE.Vector3().crossVectors(x, Y);
      return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, Y, Z));
    };
    const qs = frame(u), qe = frame(f);
    B["sh" + sd].quaternion.copy(tq.clone().invert().multiply(qs));
    B["el" + sd].quaternion.copy(qs.clone().invert().multiply(qe));
  }
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
  const geo = F.geo || lm.info.geo, wid = lm.info.weldId;          // F.geo: tay ghi tay / thay thế có trường riêng (fitHuman)
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
