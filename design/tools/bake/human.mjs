// design/tools/bake/human.mjs — phần dùng chung của nhân vật rig (char.mjs) và lính đám đông (kit.mjs): cắt phần thừa (catalog cut),
// chuẩn hoá mô hình người Meshy theo độ cao vai, dò khớp (landmarks.mjs) rồi kiểm tay (độ dài, hai bên lệch, vai, độ cao vai đã xem
// bằng mắt — catalog shoulder): tay sai thay bằng tay kia đối xứng nếu khớp lưới, rồi tỉ lệ người trên trục dò được — chỉ khi catalog
// cho phép (fallback) — không được thì dừng nướng báo lỗi kèm tên mẫu (thêm khớp ghi tay vào catalog.mjs). Khung gắn 15 khớp theo dáng
// tay của mô hình, trọng số da, tách tam giác cầu (lưới dính hai phần xa nhau trên cây xương).
//
// 15 khớp theo rig tướng (models.js): hips, torso, head, shL/elL/handL, shR/elR/handR, hipL/kneeL/ankleL, hipR/kneeR/ankleR.
// Khung gắn: thân, chân thẳng đứng (góc 0); vai, khuỷu xoay cho xương trùng hướng tay mô hình (tay đưa ra trước hoặc chữ A), trục x
// (bản lề khuỷu) theo mặt gập khuỷu của mô hình.
// Trọng số (weights15): trường vùng mềm theo chuỗi xương — tay theo khoảng cách đo dọc mặt lưới từ đầu ngón (tay đưa ra trước ngực
// vẫn thuộc về tay, không dính vào ngực; tay ghi tay / đối xứng theo chiếu lên chuỗi xương — axialGeo), đầu, thân, hông theo độ cao,
// chân theo bên và độ cao, vạt áo xa trục chân dựa hông — rồi làm mượt trên lưới hàn (đỉnh ngoài dải neo yên), chỉ trộn xương kề
// nhau, ≤ 4 xương. Trước đây (đến đợt 19a A2) dải cứng hẹp không làm mượt: 64% đỉnh một xương, eo nhảy bậc, mũi giày theo hông.
// Xương phụ (đợt 19a A4, chỉ nhân vật rig; lính đám đông giữ 15 khớp): lưng, cổ, xương đòn, xoắn cẳng tay (game/js/battle/rig-helpers.js)
// — bindHelpers dựng khung gắn, weights15(…, HB) chia dải eo, cổ, vai, cẳng tay cho chúng trong cùng trường vùng + làm mượt.

import * as THREE from "three";
import { landmarks, armJoints, armProblems, armAsym, mirrorArm, axialGeo, ARM_RULE, ARM_OK, ARM_KIT } from "./landmarks.mjs";
import { HELPERS, HELPER_NAMES, driveQuat } from "../../../game/js/battle/rig-helpers.js";

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
// trong một hộp { lo: [x, y, z], hi: [x, y, z] } (khung chuẩn hoá thô cao 1,9 của lưới chưa cắt) hoặc có đỉnh lọt vào hộp quá CUT_IN
// (đợt 19a soát: chỉ xét trọng tâm thì còn mảnh sừng vụn — H33 7 đỉnh sâu tới 1,9 cm, X19 4 đỉnh tới 4 cm, cạnh 8–12 cm), bỏ đỉnh
// không còn dùng. g: { pos, uv, idx, … } của readGLB. Trả { g (mới), bounds (hộp bao lưới chưa cắt — giữ khung chuẩn hoá), cut (số
// tam giác) }.
const CUT_IN = 0.008;
export function cutBoxes(g, boxes) {
  const b = bounds(g.pos);
  if (!boxes || !boxes.length) return { g, bounds: b, cut: 0 };
  const N = normPt(b, 1.9), P = g.pos, keep = [];
  const inside = (p, d) => boxes.some((x) => p.every((cv, k) => cv >= x.lo[k] + d && cv <= x.hi[k] - d));
  for (let t = 0; t < g.idx.length; t += 3) {
    const c = [0, 0, 0], vs = [];
    for (let q = 0; q < 3; q++) { const v = g.idx[t + q], p = N(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]); vs.push(p); for (let k = 0; k < 3; k++) c[k] += p[k] / 3; }
    if (!inside(c, 0) && !vs.some((p) => inside(p, CUT_IN))) keep.push(g.idx[t], g.idx[t + 1], g.idx[t + 2]);
  }
  const map = new Int32Array(P.length / 3).fill(-1), pos = [], uv = [], idx = [];
  for (const v of keep) { if (map[v] < 0) { map[v] = pos.length / 3; pos.push(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]); uv.push(g.uv[v * 2], g.uv[v * 2 + 1]); } idx.push(map[v]); }
  return { g: { ...g, pos: Float32Array.from(pos), uv: Float32Array.from(uv), idx: Uint32Array.from(idx) }, bounds: b, cut: (g.idx.length - keep.length) / 3 };
}

// pos: toạ độ gốc Meshy. shY: độ cao vai mong muốn (rig tướng 1,48; lính đám đông 1,43). fix: khớp tay ghi tay (toạ độ chuẩn hoá
// thô, cao 1,9) khi bộ dò sai; box: hộp bao lưới chưa cắt (cutBoxes); name: mã mẫu (báo lỗi); kit: lính đám đông (dải độ dài rộng
// hơn, ARM_KIT); shoulder: độ cao vai đã xem bằng mắt (khung thô, catalog.mjs — mẫu không có fix bắt buộc); fallback: cho phép tay
// thay thế (catalog.mjs, sau khi xem bằng mắt). Tay: dò (landmarks), kiểm dải (armProblems, hai tay lệch ≤ 25%); tay sai thay bằng tay
// kia đối xứng nếu khớp lưới, rồi tỉ lệ người trên trục dò được — chỉ khi có cờ fallback (không có thì dừng nướng, báo cách thay dựng
// được); không được thì dừng nướng báo lỗi tên mẫu. Vai dò được (trung bình hai bên) lệch shoulder quá 0,03 thì dừng nướng: bộ dò có
// thể ra một chuỗi tay tự khớp mà sai — DV_NO bỏ khớp ghi tay: vai rơi ở khuỷu (1,237 thay vì 1,37), qua mọi dải độ dài, mô hình phóng
// +10,7%; không dấu hình học nào tách được (đợt 19a soát lại: cột lưới trên vai, đỉnh vùng vai, bề ngang thân trên vai — mẫu đúng có
// giáp vai, cổ áo, mũ rộng trùm cả khoảng của mẫu sai).
// Trả { V (đã chuẩn hoá), J (khớp, cùng hệ toạ độ), s (tỉ lệ so với chuẩn hoá thô cao 1,9), ox, oz (trục cổ ở khung thô:
// x' = (x − ox)·s), lm, geo (trường khoảng cách tay cho trọng số, mỗi bên), how (cách dựng mỗi tay), neckY, legX: { L, R } }.
export function fitHuman(pos, idx, { shY, fix = null, box = null, name = "?", kit = false, shoulder = null, fallback = false }) {
  const H = 1.9, b = box || bounds(pos), N = normPt(b, H), P = new Float32Array(pos.length);
  for (let i = 0; i < pos.length; i += 3) P.set(N(pos[i], pos[i + 1], pos[i + 2]), i);
  const lm = landmarks(P, idx, H), j = lm.j, info = lm.info, G = info.weld, ox = j.head[0];
  const ok = kit ? ARM_KIT : ARM_OK, RAD = [0.05, 0.04, 0.045], RAD_OUT = [0.07, 0.07, 0.065];
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
    for (const sd of ["L", "R"]) pr[sd] = !arms[sd] ? [`không có trục tay (${info.arm[sd]?.why || "không thấy đầu ngón"})`] : [...(arms[sd].bad ? [arms[sd].bad] : []), ...armProblems(arms[sd], sd, s, { ox, ok })];
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
      if (!why && fallback) { arms[sd] = { ...m, how: "đối xứng" }; delete geo[sd]; continue; }
      tried.push("đối xứng: " + (why || "dựng được, cần cờ fallback trong catalog.mjs (xem tay trong lab trước)"));
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
      const p2 = A ? armProblems(A, sd, s, { ox, ok }) : ["trục quá ngắn"];
      if (!p2.length && fallback) { arms[sd] = { sh: A.sh, el: A.el, hand: A.hand, how: "tỉ lệ người" }; geo[sd] = { DF: info.geo[sd].DF, dHand: A.dHand, dEl: A.dEl, dSh: A.dSh }; continue; }
      tried.push("tỉ lệ người: " + (p2.join(", ") || "dựng được, cần cờ fallback trong catalog.mjs (xem tay trong lab trước)"));
    }
    throw new Error(`${name}: tay ${sd} không dựng được (${pr[sd].join(", ")}${tried.length ? "; " + tried.join("; ") : ""}) — thêm khớp ghi tay vào catalog.mjs`);
  }
  s = scaleOf(); pr = check(s);
  for (const sd of ["L", "R"]) if (pr[sd].length) throw new Error(`${name}: tay ${sd} sau khi thay vẫn sai (${pr[sd].join(", ")})`);
  // vai dò (không có khớp ghi tay) phải trùng độ cao vai đã xem bằng mắt (catalog shoulder, khung thô) ±0,03
  if (!fix) {
    const y = (arms.L.sh[1] + arms.R.sh[1]) / 2;
    if (shoulder == null) throw new Error(`${name}: chưa ghi độ cao vai (dò được ${y.toFixed(3)} khung thô) — xem tay trong lab rồi ghi shoulder: ${y.toFixed(3)} vào catalog.mjs`);
    if (Math.abs(y - shoulder) > 0.03) throw new Error(`${name}: vai dò ở ${y.toFixed(3)} ≠ ${shoulder} ghi trong catalog.mjs (khung thô) — tay dò sai (vai rơi ở khuỷu?) hoặc mẫu đã đổi: xem lại tay rồi sửa số / thêm khớp ghi tay`);
  }
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
    } else if (info.arm[sd] && info.arm[sd].tip) {
      // tay dò: đỉnh trong ống hẹp (RAD) quanh bàn tay, cẳng tay (đầu ngón → "hand" → khuỷu) mà đo dọc mặt lưới dài hơn cung theo
      // trục quá 0,15 H — ống tay áo rộng nối từ vai bọc cẳng tay, đường đo vòng qua vai (X19 tay phải: 20 / 26 đỉnh quanh giữa cẳng
      // tay đo được ≥ 0,6 m, theo vai / thân, cẳng tay thò qua tay áo) — lấy cung theo trục, đổi sang thang đo dọc mặt lưới từng đoạn
      const g = geo[sd], ax = axialGeo(G.P, G.n, [info.arm[sd].tip, A.hand, A.el, A.sh], sd, H, RAD, ox, RAD), DF = Float64Array.from(g.DF);
      for (let v = 0; v < G.n; v++) {
        const t = ax.DF[v]; if (!(t <= ax.dEl)) continue;
        const d = t <= ax.dHand ? (t / ax.dHand) * g.dHand : g.dHand + ((t - ax.dHand) / (ax.dEl - ax.dHand)) * (g.dEl - g.dHand);
        if (DF[v] > d + 0.15 * H) DF[v] = d;
      }
      geo[sd] = { ...g, DF };
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

// Xương phụ trên khung gắn (bind: bindSkeleton): cha, khớp nguồn, cách quay, phần góc theo rig-helpers.js HELPERS. Gốc (khung cha):
// lưng ở khớp thân, cổ ở khớp cổ — cùng gốc nên vùng nửa góc nối liền vùng đủ góc (xoắn, gập quanh cùng một điểm); xương đòn ở đầu
// xương ức (x = clavX × x vai, cùng độ cao, độ sâu với vai: tay giơ quá ngang vai thì cơ thang, đầu vai nhấc lên quanh đó); xoắn ở
// giữa cẳng tay (trên trục cẳng tay). Góc gắn = bộ dẫn (driveQuat) áp vào góc gắn cục bộ của khớp nguồn — thân, đầu, bàn tay gắn góc 0
// nên lưng, cổ, xoắn gắn góc 0; xương đòn gắn góc 0 khi tay mô hình (đưa ra trước, chữ A) chưa quá ngang vai (mọi mẫu hiện có). Lúc
// chạy glb.js đặt cùng gốc (meta.rest), cùng bộ dẫn (meta.drive): tư thế gắn → ma trận da đơn vị.
// Trả { names, inv (ma trận gắn nghịch đảo), rest (gốc, khung cha, 4 số lẻ), parent, drive, piv (gốc thế giới khung gắn) }.
export const HELP_PRM = { clavX: 0.15 };
export function bindHelpers(bind, P = {}) {
  const prm = { ...HELP_PRM, ...P }, B = bind.B, r4 = (a) => a.map((x) => +x.toFixed(4));
  const rest = { spine: r4(B.torso.position.toArray()), neck: r4(B.head.position.toArray()) };
  for (const sd of ["L", "R"]) {
    const sh = B["sh" + sd].position;
    rest["clav" + sd] = r4([sh.x * prm.clavX, sh.y, sh.z]);
    rest["twist" + sd] = r4([0, B["hand" + sd].position.y / 2, 0]);
  }
  const o = [0, 0, 0, 0], H = {}, parent = {}, drive = {};
  for (const n of HELPER_NAMES) {
    const h = HELPERS[n], b = new THREE.Bone(), q = B[h.src].quaternion;
    driveQuat(h.kind, h.share, q.x, q.y, q.z, q.w, o);
    b.name = n; b.position.fromArray(rest[n]); b.quaternion.set(o[0], o[1], o[2], o[3]);
    B[h.parent].add(b); H[n] = b; parent[n] = h.parent; drive[n] = [h.src, h.kind, h.share];
  }
  B.hips.updateWorldMatrix(true, true);
  const piv = Object.fromEntries(HELPER_NAMES.map((n) => [n, new THREE.Vector3().setFromMatrixPosition(H[n].matrixWorld).toArray()]));
  return { names: HELPER_NAMES, inv: HELPER_NAMES.map((n) => new THREE.Matrix4().copy(H[n].matrixWorld).invert()), rest, parent, drive, piv };
}

// ---- trọng số da ---------------------------------------------------------------------------------------------------------------
// Nhóm xương được trộn với nhau (mọi cặp trong nhóm kề nhau: game/tests/models.test.mjs khong-ke): thân trên + một vai, tay, hông +
// một đùi, chuỗi chân. Không có thân + đùi (vạt áo xoắn theo thân), hông + gối / bàn chân (vạt áo, mũi giày kéo tới chậu), hai chân.
const JI = Object.fromEntries(JOINTS.map((x, i) => [x, i]));
const CLIQUES = [["hips", "torso", "head", "shL"], ["hips", "torso", "head", "shR"], ["shL", "elL", "handL"], ["shR", "elR", "handR"],
  ["hips", "hipL"], ["hips", "hipR"], ["hipL", "kneeL", "ankleL"], ["hipR", "kneeR", "ankleR"]].map((c) => c.map((b) => JI[b]));
// Có xương phụ (thứ tự xương JOINTS + HELPER_NAMES, như meta.bones): eo hông – lưng – thân, cổ thân – cổ – đầu, vai thân – xương đòn –
// cánh tay (+ cổ), cơ thang thân – xương đòn – cổ – đầu, tay vai – khuỷu – xoắn – bàn tay. Lưng (con của hông) không trộn với vai,
// xương đòn, cổ (cách 3 đốt).
const NAMES_H = [...JOINTS, ...HELPER_NAMES], JH = Object.fromEntries(NAMES_H.map((x, i) => [x, i]));
const CLIQUES_H = [["hips", "spine", "torso"], ["torso", "neck", "head"],
  ...["L", "R"].flatMap((s) => [["torso", "clav" + s, "sh" + s, "neck"], ["torso", "clav" + s, "neck", "head"], ["hips", "torso", "sh" + s],
    ["sh" + s, "el" + s, "twist" + s, "hand" + s], ["hips", "hip" + s], ["hip" + s, "knee" + s, "ankle" + s]])].map((c) => c.map((b) => JH[b]));
// Dải trộn (m; nửa bề rộng, smoothstep): bh cổ tay, be khuỷu, bs vai — so dời dải vai về phía tay (nách, sườn ngực theo thân; bắp vai
// trộn); bn cổ; eo: thân tăng đều (tuyến tính) từ hông + w0 (ngang khớp đùi) tới hông + w1 (giữa ngực) — thân xoắn, gập chia đều như
// cột sống; top hông → đùi dưới đỉnh đùi; kb gối; a0…a1 cổ chân. Vạt áo: cách trục chân (cả đoạn bàn chân) rin…rin + rw thì dựa hông,
// giữa thân (|x| < mid) hẳn theo hông, ra hai bên tới cR (0 hông … 1 đùi); đáy chậu: dưới hông 0,14, sát giữa (|x| < 0,05) theo hông.
// Làm mượt iters lượt, hệ số lam; headRigid: trên cổ chừng này là mũ, tóc (cứng theo đầu); prune: bỏ trọng số nhỏ hơn. Số dải chọn
// theo tỉ lệ tam giác xấu ở 7 + 12 tư thế lab (đợt 19a A3; dải hẹp hơn / rộng hơn chừng ±30% chỉ đổi vài phần trăm).
// Xương phụ (chỉ khi có HB): xương đòn lấy phần thân ở vai, cơ thang — dọc đoạn đầu xương ức → khớp vai u (0 ức … 1 vai) từ cU0 tới
// cU1, trên vai + cY0 … vai + cY1 (nách, sườn ngực dưới đó theo thân), trước / sau vai |Δz| cZ0 … cZ1 thì bớt dần; xoắn lấy phần
// khuỷu của cẳng tay từ dải cổ tay qua đoạn cẳng tay thuần (0 hết dải cổ tay … 1 chạm dải khuỷu) tới tw0, về khuỷu dần tới tw1 — hết
// trước dải khuỷu (trước đây đo theo cả đoạn cổ tay → khuỷu: xoắn lấn vào dải khuỷu, khuỷu trộn vai + khuỷu + xoắn, H31 N1 +12 tam
// giác xấu). Vùng xương đòn chọn theo tam giác xấu ở đợt 19a A4 (rộng hơn / hẹp hơn đều xấu hơn chút ít).
export const WEIGHT_PRM = { bh: 0.05, be: 0.1, bs: 0.08, so: -0.05, bn: 0.1, w0: -0.02, w1: 0.42, top: 0.22, kb: 0.05, a0: -0.01, a1: 0.07,
  rin: 0.075, rw: 0.12, cR: 0.7, mid: 0.1, toeZ: 0.2, heelZ: -0.08, iters: 300, lam: 0.5, headRigid: 0.06, prune: 0.02,
  cU0: 0, cU1: 0.6, cY0: -0.12, cY1: -0.04, cZ0: 0.06, cZ1: 0.14, tw0: 0.35, tw1: 0.85, islands: 1, xc: 0.4, ky: 0, seam: 0 };
const sstep = (x, a, b) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const segDist = (p, a, b) => {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ap = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
  const u = Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / (ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2 || 1)));
  return Math.hypot(ap[0] - u * ab[0], ap[1] - u * ab[1], ap[2] - u * ab[2]);
};
// w (NB) → out: giữ nhóm xương kề nhau (trong mặt nạ) nặng nhất, chuẩn hoá. false: không nhóm nào có trọng số.
function toClique(w, out, oo, mask, NB, CL) {
  let best = -1, bm = 0;
  for (let c = 0; c < CL.length; c++) { let m = 0; for (const b of CL[c]) if (mask & (1 << b)) m += w[b]; if (m > bm) { bm = m; best = c; } }
  if (best < 0) return false;
  for (let b = 0; b < NB; b++) out[oo + b] = 0;
  for (const b of CL[best]) if (mask & (1 << b)) out[oo + b] = w[b] / bm;
  return true;
}

// ---- cầu: tam giác nối hai phần cách ≥ 3 đốt trên cây xương (đợt 19a soát) --------------------------------------------------------
// Số đốt giữa hai xương trên cây 15 khớp + xương phụ (cha theo rig-helpers.js HELPERS); game/tests/models.test.mjs cau kiểm đúng luật này.
export const PAR_ALL = { ...PARENT, ...Object.fromEntries(HELPER_NAMES.map((n) => [n, HELPERS[n].parent])) };
const upOf = (b, par) => { const c = []; for (let x = b; x; x = par[x]) c.push(x); return c; };
export function boneDist(a, b, par = PAR_ALL) { const A = upOf(a, par), B = upOf(b, par); for (let i = 0; i < A.length; i++) { const j = B.indexOf(A[i]); if (j >= 0) return i + j; } return 99; }
// khúc của xương: thân (hông, lưng, thân, cổ, đầu, xương đòn), cánh tay, cẳng tay (khuỷu, xoắn, bàn tay), đùi, cẳng chân (gối, cổ chân)
const SEG = (b) => (/^sh/.test(b) ? b : /^(el|twist|hand)/.test(b) ? "fa" + b.slice(-1) : /^hip[LR]/.test(b) ? b : /^(knee|ankle)/.test(b) ? "sn" + b.slice(-1) : "body");
// Đảo trọng số trên lưới hàn G: mảnh liền của một khúc (theo xương nặng nhất) tách khỏi mảnh lớn nhất của khúc đó, mà quá nửa cạnh mép
// nối hai xương cách ≥ 3 đốt (CV_daidao: 3 + 7 đỉnh cổ tay áo giáp theo thân — ngoài ống quanh chuỗi khớp ghi tay; OFF_tuong: 38–46
// đỉnh vạt tay áo theo lưng / hông bao quanh cẳng tay) — tam giác mép căng thành gai khi tay cử động: mỗi đỉnh đảo lấy trọng số đỉnh
// ngoài (khúc bao quanh nhiều nhất) gần nhất theo đường đi dọc cạnh trong đảo. A: m × NB (sửa tại chỗ), names: tên xương theo cột.
// Trả số đỉnh đã đổi.
function mergeIslands(A, G, NB, names) {
  const m = G.n, dom = new Int32Array(m);
  for (let g = 0; g < m; g++) { let b = 0; for (let k = 1; k < NB; k++) if (A[g * NB + k] > A[g * NB + b]) b = k; dom[g] = b; }
  const seg = Array.from(dom, (b) => SEG(names[b])), comp = new Int32Array(m).fill(-1), comps = [];
  for (let s = 0; s < m; s++) {
    if (comp[s] >= 0) continue;
    const id = comps.length, vs = [s]; comp[s] = id;
    for (let i = 0; i < vs.length; i++) for (const [w] of G.adj[vs[i]]) if (comp[w] < 0 && seg[w] === seg[s]) { comp[w] = id; vs.push(w); }
    comps.push(vs);
  }
  const main = {}; comps.forEach((vs, id) => { const s = seg[vs[0]]; if (main[s] === undefined || vs.length > comps[main[s]].length) main[s] = id; });
  let changed = 0;
  comps.forEach((vs, id) => {
    if (main[seg[vs[0]]] === id) return;
    let edges = 0, far = 0; const nb = {};
    for (const v of vs) for (const [w] of G.adj[v]) if (comp[w] !== id) { edges++; if (boneDist(names[dom[v]], names[dom[w]]) >= 3) far++; nb[seg[w]] = (nb[seg[w]] || 0) + 1; }
    if (!edges || far * 2 < edges) return;
    const to = Object.entries(nb).sort((a, b) => b[1] - a[1])[0][0], inC = new Set(vs), dist = new Map(), from = new Map(), done = new Set();
    for (const v of vs) for (const [w, L] of G.adj[v]) if (!inC.has(w) && seg[w] === to && L < (dist.get(v) ?? Infinity)) { dist.set(v, L); from.set(v, w); }
    for (;;) {
      let v = -1, d = Infinity; for (const [x, dx] of dist) if (!done.has(x) && dx < d) { d = dx; v = x; }
      if (v < 0) break;
      done.add(v);
      for (const [w, L] of G.adj[v]) if (inC.has(w) && !done.has(w) && d + L < (dist.get(w) ?? Infinity)) { dist.set(w, d + L); from.set(w, from.get(v)); }
    }
    for (const v of vs) { const w = from.get(v); if (w === undefined) continue; for (let k = 0; k < NB; k++) A[v * NB + k] = A[w * NB + k]; changed++; }
  });
  return changed;
}
// Tam giác cầu trên lưới cuối (sau giảm lưới): hai đỉnh có xương nặng nhất cách nhau ≥ 3 đốt — lưới Meshy dính hai phần (bàn tay OFF_tuong
// vào vạt áo, ống tay áo rộng X19 vào vạt áo, đáy chậu X20, cẳng tay nỏ binh DV_NO vào sườn): trộn trọng số kiểu nào cũng căng thành
// màng khi hai phần rời nhau. Tách: tam giác thuộc cặp đỉnh hợp nhau (cách < 3 đốt; hai cặp thì cặp xương gần nhau hơn; không cặp nào
// thì đỉnh có xương gần gốc nhất); đỉnh còn lại thay bằng bản sao cùng vị trí mang trọng số đỉnh chủ gần nhất (một bản sao mỗi đỉnh ×
// xương chủ, tam giác cầu liền nhau dùng chung) — tư thế gắn y nguyên, hai phần rời nhau thì hở khe thay vì kéo màng.
// m: { pos, idx, si, sw (u8, 4 mỗi đỉnh) }, names: tên xương theo chỉ số, par: cha mỗi xương (mặc định 15 khớp + xương phụ; lính đám
// đông: cây khúc soldier-motion.js), cau(a, b): hai xương không được chung tam giác (mặc định cách ≥ 3 đốt). Trả { pos, idx, si, sw,
// src (đỉnh mới → đỉnh cũ: vị trí, UV), own (đỉnh mới → đỉnh mang trọng số), cut (số tam giác tách), dups (số đỉnh thêm) }.
export function splitBridges(m, names, par = PAR_ALL, cau = (a, b) => boneDist(a, b, par) >= 3) {
  const n = m.pos.length / 3, dom = new Int32Array(n), depth = (b) => upOf(b, par).length;
  for (let v = 0; v < n; v++) { let q = 0; for (let k = 1; k < 4; k++) if (m.sw[v * 4 + k] > m.sw[v * 4 + q]) q = k; dom[v] = m.si[v * 4 + q]; }
  const D = (a, b) => { const x = names[dom[a]], y = names[dom[b]]; return cau(x, y) ? 3 : Math.min(2, boneDist(x, y, par)); };
  const pos = Array.from(m.pos), si = Array.from(m.si), sw = Array.from(m.sw), src = Array.from({ length: n }, (_, i) => i), wo = src.slice(), idx = Uint32Array.from(m.idx), dup = new Map();
  const d2 = (a, b) => (pos[a * 3] - pos[b * 3]) ** 2 + (pos[a * 3 + 1] - pos[b * 3 + 1]) ** 2 + (pos[a * 3 + 2] - pos[b * 3 + 2]) ** 2;
  let cut = 0;
  for (let t = 0; t < idx.length; t += 3) {
    const v = [idx[t], idx[t + 1], idx[t + 2]], ok = [[0, 1], [1, 2], [2, 0]].filter(([a, b]) => D(v[a], v[b]) < 3);
    if (ok.length === 3) continue;
    cut++;
    ok.sort((p, q) => D(v[p[0]], v[p[1]]) - D(v[q[0]], v[q[1]]));
    const own = ok.length ? ok[0] : [[0, 1, 2].sort((a, b) => depth(names[dom[v[a]]]) - depth(names[dom[v[b]]]))[0]];
    for (let k = 0; k < 3; k++) {
      if (own.includes(k)) continue;
      const a = own.reduce((x, y) => (d2(v[k], v[x]) <= d2(v[k], v[y]) ? x : y)), key = v[k] * 64 + dom[v[a]];
      let nv = dup.get(key);
      if (nv === undefined) {
        nv = pos.length / 3; dup.set(key, nv);
        pos.push(pos[v[k] * 3], pos[v[k] * 3 + 1], pos[v[k] * 3 + 2]); src.push(src[v[k]]); wo.push(v[a]);
        for (let q = 0; q < 4; q++) { si.push(si[v[a] * 4 + q]); sw.push(sw[v[a] * 4 + q]); }
      }
      idx[t + k] = nv;
    }
  }
  return { pos: Float32Array.from(pos), idx, si: Uint8Array.from(si), sw: Uint8Array.from(sw), src: Int32Array.from(src), own: Int32Array.from(wo), cut, dups: dup.size };
}

// Trọng số 15 khớp mỗi đỉnh (Float32Array n × 15, tổng 1, ≤ 4 xương, chỉ xương kề nhau). Y: { hips, hipOff, knee, ankle } độ cao khung
// gắn (khung đã chuẩn hoá); P: thay WEIGHT_PRM. Tính trên lưới hàn của bộ dò (lm.info.weld: đường may UV liền), rồi ra từng đỉnh.
// HB (bindHelpers, nhân vật rig): thêm xương phụ — n × 21 (thứ tự JOINTS + HELPER_NAMES).
// (1) Trường vùng mềm: tay theo khoảng cách đo dọc mặt lưới từ đầu ngón (F.geo: tay ghi tay / thay thế có trường riêng); ngoài tay:
//     đầu, thân, hông theo độ cao — eo liền một dải dài (trước đây dải 12 cm, thân nhảy 0 → 0,35 ở hông + 0,02: thân xoắn thì đai xé
//     ~6 cm); dưới eo toạ độ chuỗi chân c (0 hông, 1 đùi, 2 cẳng, 3 bàn chân) theo độ cao, vạt áo kéo c về phía hông. Khoảng cách tới
//     trục chân tính cả đoạn bàn chân (trước đây đo từ trục đứng: mũi giày thành "vạt áo", theo hông — giày gai). c chỉ trộn hai xương
//     liền nhau: gấu áo ngang cổ chân không bao giờ trộn bàn chân + chậu.
//     Xương phụ: dải eo, cổ chia theo phần góc — phần góc thân (0 hông … 1 thân, tăng đều như trên) thành hai xương liền nhau trong hông
//     (0), lưng (phần góc lưng, ½), thân (1): mỗi đỉnh theo đúng phần góc thân như trước nhưng hai xương trộn chỉ lệch nửa góc (bụng xoắn,
//     gập không thắt); cổ như vậy với thân, cổ, đầu. Xương đòn lấy phần thân ở bắp vai, cơ thang (WEIGHT_PRM cU…, cY…, cZ…); xoắn lấy
//     phần khuỷu ở nửa cẳng tay phía cổ tay, hết trước dải khuỷu (tw0, tw1) — dải cổ tay thành bàn tay + xoắn: bàn tay xoắn 1,8 rad thì
//     cổ tay còn ≥ 0,9 bề dày (trộn thẳng bàn tay + khuỷu: 0,62–0,64).
// (2) Làm mượt trên lưới hàn (Jacobi): đỉnh thuần một xương (ngoài mọi dải) và đỉnh chỉ có đầu / thân / hông (+ lưng, cổ: dải cổ, eo theo
//     độ cao, đã liền — làm mượt kéo eo về phía vùng nối nhiều hơn, thành bậc ở mép trên dải) neo yên; đỉnh khác lấy trung bình láng
//     giềng theo 1 / độ dài cạnh (hai đỉnh gần nhau trọng số gần nhau: tam giác nhỏ, cạnh ngắn không bị kéo giãn — trung bình đều kéo
//     giãn chúng gấp mấy lần), chỉ trên các xương đỉnh đó có từ trường vùng (dải giữ chỗ: tay không lan tới khuỷu, thân không xuống vạt
//     áo), mỗi lượt chiếu về một nhóm xương kề nhau (CLIQUES; có xương phụ: CLIQUES_H). Không làm mượt thì dải smoothstep còn gãy theo
//     lưới: tam giác xấu nhiều gấp ~1,6.
// (3) Mũ, tóc trên cổ cứng theo đầu; bỏ trọng số < prune, chuẩn hoá.
export function weights15(F, Y, P = {}, HB = null) {
  const prm = { ...WEIGHT_PRM, ...P };
  const { V, s, lm, neckY, legX } = F, n = V.length / 3, NB = HB ? NAMES_H.length : JOINTS.length, CL = HB ? CLIQUES_H : CLIQUES, BI = HB ? JH : JI;
  const G = lm.info.weld, wid = lm.info.weldId, geo = F.geo || lm.info.geo, m = G.n;
  const Pm = new Float32Array(m * 3);
  for (let v = 0; v < n; v++) { const g = wid[v]; Pm[g * 3] = V[v * 3]; Pm[g * 3 + 1] = V[v * 3 + 1]; Pm[g * 3 + 2] = V[v * 3 + 2]; }
  const W = new Float32Array(m * NB), isArm = new Uint8Array(m), mask = new Int32Array(m), mid = new Uint8Array(m);
  const hY = Y.hips, yTop = Y.hips - Y.hipOff, kY = Y.knee, aY = Y.ankle, yC = Y.hips - 0.14;
  // trục chân (khung gắn: thẳng đứng ở legX, z theo tâm ống chân thấp) + bàn chân ra trước, gót ra sau
  const LG = {};
  for (const [sd, sg] of [["L", -1], ["R", 1]]) {
    let sz = 0, c = 0;
    for (let g = 0; g < m; g++) { const x = Pm[g * 3], y = Pm[g * 3 + 1]; if (x * sg > 0 && y > 0.15 && y < 0.3 && Math.abs(x - legX[sd]) < 0.12) { sz += Pm[g * 3 + 2]; c++; } }
    const x = legX[sd], z = c ? sz / c : 0;
    LG[sd] = [[x, yTop, z], [x, kY, z], [x, aY, z], [x, 0.03, z + prm.toeZ], [x, 0.03, z + prm.heelZ]];
  }
  const arm = {};
  for (const sd of ["L", "R"]) {
    const g = geo[sd]; if (!g) continue;
    const dH = g.dHand * s, dE = g.dEl * s, dS = g.dSh * s, up = dS - dE, fo = dE - dH;
    // đoạn ngắn: thu cả bốn dải cho cánh tay, cẳng tay còn ≥ 30% thuần một xương (CV_daidao cánh tay 0,19 m: không thu thì không đỉnh
    // nào hẳn theo vai — giữa cánh tay chỉ 0,57 trọng số vai)
    const k = Math.min(1, (0.7 * up) / (prm.be + prm.bs - prm.so), (0.7 * fo) / (prm.bh + prm.be));
    arm[sd] = { DF: g.DF, dH, dE, dS, bh: prm.bh * k, be: prm.be * k, bs: prm.bs * k, so: prm.so * k };
  }
  const bit = (name) => 1 << BI[name];
  // xương phụ: phần góc lưng, cổ (meta.drive); xương đòn: đầu xương ức (gốc, khung gắn) → khớp vai
  const sS = HB && HB.drive.spine[2], sN = HB && HB.drive.neck[2];
  const CV = HB && { L: [HB.piv.clavL, F.J.shL], R: [HB.piv.clavR, F.J.shR] };
  const clavW = (x, y, z) => {
    const [c, sh] = CV[x < 0 ? "L" : "R"], u = (Math.abs(x) - Math.abs(c[0])) / (Math.abs(sh[0]) - Math.abs(c[0]));
    return sstep(u, prm.cU0, prm.cU1) * sstep(y, sh[1] + prm.cY0, sh[1] + prm.cY1) * (1 - sstep(Math.abs(z - sh[2]), prm.cZ0, prm.cZ1));
  };
  // phần thân (k: phần còn lại sau tay) của đỉnh ở (x, y, z) → W[o…]
  const body = (o, x, y, z, k) => {
    const wHd = sstep(y, neckY - prm.bn, neckY + prm.bn), wT = Math.max(0, Math.min(1, (y - hY - prm.w0) / (prm.w1 - prm.w0)));
    let low;
    if (HB) {
      // phần góc đầu wHd → đầu (1) / cổ (sN) / dưới cổ (0), phần góc thân wT → thân (1) / lưng (sS) / hông (0): hai xương liền nhau
      const hH = wHd > sN ? (wHd - sN) / (1 - sN) : 0, hN = wHd > sN ? 1 - hH : wHd / sN, r = wHd > sN ? 0 : k * (1 - hN);
      W[o + BI.head] += k * hH; W[o + BI.neck] += k * hN;
      const tT = wT > sS ? (wT - sS) / (1 - sS) : 0, tS = wT > sS ? 1 - tT : wT / sS, g = tT > 0 ? clavW(x, y, z) : 0;
      W[o + BI.torso] += r * tT * (1 - g); W[o + BI.spine] += r * tS;
      if (g > 0) W[o + BI[x < 0 ? "clavL" : "clavR"]] += r * tT * g;
      low = wT > sS ? 0 : r * (1 - tS);
    } else {
      W[o + BI.head] += k * wHd; W[o + BI.torso] += k * (1 - wHd) * wT;
      low = k * (1 - wHd) * (1 - wT);
    }
    if (low <= 0) return;
    const sd = x < 0 ? "L" : "R", L = LG[sd], p = [x, y, z];
    let c = sstep(y, yTop, yTop - prm.top) + sstep(y, kY + prm.kb, kY - prm.kb) + sstep(y, aY + prm.a1, aY + prm.a0);
    const r = Math.min(segDist(p, L[0], L[1]), segDist(p, L[1], L[2]), segDist(p, L[2], L[3]), segDist(p, L[2], L[4]));
    const rin = prm.rin + 0.03 * sstep(y, 0.3, 0.8), rho = sstep(r, rin, rin + prm.rw);
    c = c * (1 - rho) + Math.min(c, prm.cR * sstep(Math.abs(x), 0, prm.mid)) * rho;
    c -= (1 - sstep(Math.abs(x), 0, 0.05)) * sstep(y, yC - 0.06, yC + 0.04) * Math.min(c, 1);
    // giữa hai chân trên gối (|x| < xc · bề ngang chân): dần theo hông tới đường giữa, neo khi làm mượt — vạt áo, váy lót giữa hai chân
    // không chia đôi theo hai đùi (trước đây làm mượt kéo hai nửa về hai đùi thuần, giáp nhau ở x = 0: H35 chạy, hai chân dang thì dải
    // giữa váy lót sau giãn 15–18 lần). ky: dải bắt đầu dưới gối chừng ấy (váy lót dài quá gối — H35 gấu sau giữa hai chân ở 0,48 m,
    // ngay trên gối, vẫn chia đôi hipL | hipR: chạy giãn 13–16 lần)
    const hc = (1 - sstep(Math.abs(x), 0, prm.xc * Math.abs(legX[sd]))) * sstep(y, kY - prm.ky, kY + 0.1);
    if (hc > 0) { c *= 1 - hc; if (hc > 0.5) mid[o / NB] = 1; }
    const ch = [BI.hips, BI["hip" + sd], BI["knee" + sd], BI["ankle" + sd]], i = Math.min(2, Math.floor(c)), f = c - i;
    W[o + ch[i]] += low * (1 - f); W[o + ch[i + 1]] += low * f;
  };
  for (let g = 0; g < m; g++) {
    const o = g * NB, x = Pm[g * 3], y = Pm[g * 3 + 1], z = Pm[g * 3 + 2];
    let sd = null, d = Infinity;
    for (const q of ["L", "R"]) { const A = arm[q]; if (!A) continue; const dq = A.DF[g] * s; if (dq <= A.dS + A.bs + A.so && dq < d) { d = dq; sd = q; } }
    if (sd) {
      const A = arm[sd], a = sstep(d, A.dH - A.bh, A.dH + A.bh), b = sstep(d, A.dE - A.be, A.dE + A.be), c = sstep(d, A.dS - A.bs + A.so, A.dS + A.bs + A.so);
      W[o + BI["hand" + sd]] += 1 - a; W[o + BI["sh" + sd]] += b - c;
      if (HB) { const e = (a - b) * sstep((d - A.dH - A.bh) / (A.dE - A.be - A.dH - A.bh), prm.tw0, prm.tw1); W[o + BI["el" + sd]] += e; W[o + BI["twist" + sd]] += a - b - e; }
      else W[o + BI["el" + sd]] += a - b;
      if (c > 0) body(o, x, y, z, c);
      isArm[g] = 1;
    } else body(o, x, y, z, 1);
    for (let b = 0; b < NB; b++) if (W[o + b] > 0) mask[g] |= 1 << b;
  }
  // làm mượt (Jacobi): đỉnh thuần một xương, đỉnh chỉ có đầu / thân / hông (+ lưng, cổ, xương đòn: trường liền sẵn) neo yên — xương
  // đòn không neo thì vùng của nó (không đỉnh nào thuần xương đòn khi dải cổ phủ đỉnh vai) tan dần vào thân, cổ quanh đó (CV_songdao
  // vai phải 0,48 → 0,001 sau 300 lượt)
  const free = new Uint8Array(m), BODY = bit("hips") | bit("torso") | bit("head") | (HB ? bit("spine") | bit("neck") | bit("clavL") | bit("clavR") : 0);
  for (let g = 0; g < m; g++) { let mx = 0; for (let b = 0; b < NB; b++) mx = Math.max(mx, W[g * NB + b]); free[g] = mx < 0.999 && (mask[g] & ~BODY) !== 0 && !mid[g] ? 1 : 0; }
  // đường giáp hai vùng thuần khác xương (cùng một nhóm kề nhau: nách thân | vai, thân | đùi): đỉnh hai bên thả ra, được trộn xương bên kia
  // — không thì cả độ lệch dồn vào một hàng cạnh (nách CV_daidao: cạnh 2 cm giãn 10 lần khi giơ tay qua đầu)
  if (prm.seam) {
    const pure = (g) => { for (let b = 0; b < NB; b++) if (W[g * NB + b] >= 0.999) return b; return -1; }, add = [];
    for (let g = 0; g < m; g++) {
      const b1 = pure(g); if (b1 < 0) continue;
      for (const [u] of G.adj[g]) { const b2 = pure(u); if (b2 >= 0 && b2 !== b1 && CL.some((c) => c.includes(b1) && c.includes(b2))) add.push(g, b2); }
    }
    for (let i = 0; i < add.length; i += 2) { mask[add[i]] |= 1 << add[i + 1]; free[add[i]] = 1; }
  }
  let A = W, B = new Float32Array(m * NB);
  const tmp = new Float32Array(NB);
  for (let it = 0; it < prm.iters; it++) {
    for (let g = 0; g < m; g++) {
      const nb = G.adj[g], o = g * NB;
      if (!free[g] || !nb.length) { for (let b = 0; b < NB; b++) B[o + b] = A[o + b]; continue; }
      tmp.fill(0); let ks = 0;
      for (const [u, L] of nb) { const k = 1 / Math.max(L, 1e-4); ks += k; for (let b = 0; b < NB; b++) tmp[b] += k * A[u * NB + b]; }
      for (let b = 0; b < NB; b++) tmp[b] = (1 - prm.lam) * A[o + b] + (prm.lam * tmp[b]) / ks;
      if (!toClique(tmp, B, o, mask[g], NB, CL)) for (let b = 0; b < NB; b++) B[o + b] = A[o + b];
    }
    [A, B] = [B, A];
  }
  if (prm.islands) mergeIslands(A, G, NB, HB ? NAMES_H : JOINTS);
  for (let g = 0; g < m; g++) if (!isArm[g] && Pm[g * 3 + 1] > neckY + prm.headRigid) { const o = g * NB; for (let b = 0; b < NB; b++) A[o + b] = 0; A[o + BI.head] = 1; }
  const out = new Float32Array(n * NB);
  for (let v = 0; v < n; v++) {
    const o = wid[v] * NB; let S = 0;
    for (let b = 0; b < NB; b++) { const w = A[o + b] >= prm.prune ? A[o + b] : 0; out[v * NB + b] = w; S += w; }
    if (S > 0) for (let b = 0; b < NB; b++) out[v * NB + b] /= S; else out[v * NB + BI.torso] = 1;
  }
  return out;
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
