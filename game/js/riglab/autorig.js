// riglab/autorig.js — gắn xương tự động cho mô hình người tĩnh (GLB xuất từ Hunyuan3D…) theo đúng bộ khớp rig tướng của game
// (battle/models.js makeRig), để hoạt ảnh thủ tục của game (anim.js applyPose + rig-motion.js) chạy được trên mô hình đó.
//
// Đầu vào: mô hình một người, đứng thẳng, tay chữ A (cách thân ~30–45°), nhìn về một phía (prompt ở design/3d-ref/). Các bước:
//   1. normalize   — gộp toạ độ mọi lưới, xoay cho mặt nhìn +z (quy ước rig game), chân chạm y = 0, cao GAME.height;
//   2. landmarks   — dò khớp bằng lát cắt ngang: nách (lát có 3 cụm: tay trái, thân, tay phải), đầu ngón tay (điểm xa nhất
//                    ngang), cổ (chỗ thân hẹp nhất giữa vai và đỉnh đầu), đáy chậu (hai cụm chân; áo dài che thì theo tỉ lệ rig);
//   3. skeleton    — xương tên như khớp game, tư thế nghỉ tay chân buông thẳng (mọi góc 0 như rig game), tư thế gắn (bind) xoay
//                    tay chân theo mô hình tay chữ A;
//   4. weights     — trọng số da theo khoảng cách tới đoạn xương (nghịch đảo luỹ thừa), chặn tay ăn vào thân, chân trái ăn sang
//                    chân phải; vạt áo giữa hai chân chia thêm cho hông; làm mượt theo lân cận lưới.
// Phần thuần số (không DOM) chạy được trong Node: tests/autorig.test.mjs.
//
// Quy ước rig game: mặt nhìn +z, "L" ở phía −x, "R" ở phía +x, tay chân lúc nghỉ chĩa −y, vai xoay thứ tự YXZ.

import * as THREE from "three";

export const JOINTS = ["hips", "torso", "head", "shL", "elL", "handL", "shR", "elR", "handR", "hipL", "kneeL", "ankleL", "hipR", "kneeR", "ankleR"];
export const PARENT = { hips: null, torso: "hips", head: "torso", shL: "torso", elL: "shL", handL: "elL", shR: "torso", elR: "shR", handR: "elR",
  hipL: "hips", kneeL: "hipL", ankleL: "kneeL", hipR: "hips", kneeR: "hipR", ankleR: "kneeR" };
// Tỉ lệ rig tướng (models.js): hông 0,92, thân +0,04, cổ (khớp đầu) 1,64, vai 1,48 ở ±0,30, cao chừng 1,90 (đơn vị rig, chưa nhân scale).
export const GAME = { height: 1.9, hips: 0.92 };
const R = { hips: 0.484, neck: 0.865, shoulder: 0.79, shoulderX: 0.135, legX: 0.06, ankle: 0.045 };   // tỉ lệ theo chiều cao, khi không dò được

// ---- 1. chuẩn hoá ------------------------------------------------------------------------------------------------------------
// pos: Float32Array xyz (toạ độ thế giới của mọi lưới đã gộp). yaw: xoay thêm quanh y (rad) trước khi đặt. Trả hàm đổi toạ độ
// { apply(x,y,z) → [x,y,z] } và hệ số, để dựng lại hình học từng lưới theo cùng phép đổi.
export function normalize(pos, yaw = 0) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i] * c + pos[i + 2] * s, z = -pos[i] * s + pos[i + 2] * c, y = pos[i + 1];
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z;
  }
  const k = GAME.height / Math.max(1e-6, y1 - y0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const apply = (x, y, z) => [((x * c + z * s) - cx) * k, (y - y0) * k, ((-x * s + z * c) - cz) * k];
  return { apply, scale: k, yaw };
}
export function transformPositions(pos, n) {
  const out = new Float32Array(pos.length);
  for (let i = 0; i < pos.length; i += 3) { const p = n.apply(pos[i], pos[i + 1], pos[i + 2]); out[i] = p[0]; out[i + 1] = p[1]; out[i + 2] = p[2]; }
  return out;
}

// Đoán hướng mặt. Tay chữ A dang theo trục x nên lát ngang ở ngực / bụng có ba cụm theo x (tay trái, thân, tay phải); mô hình
// quay ngang thì ba cụm đó nằm theo z. Thử 0° và 90°, lấy hướng có nhiều lát ba cụm hơn (vũ khí dài, áo choàng không làm lệch
// như đo bề rộng). Trước / sau: bàn chân thò về phía trước mắt cá nhiều hơn gót thò ra sau. Trả góc xoay thêm (rad).
function armSlices(p) {
  const H = GAME.height, gap = 0.022 * H, band = 0.006 * H;
  let n = 0;
  for (let k = 0; k <= 24; k++) {
    const y = (0.5 + (k / 24) * 0.3) * H, cl = slice(p, y - band, y + band, gap);
    if (cl.length < 3) continue;
    const c = central(cl), l = cl[0], r = cl[cl.length - 1];
    if (l !== c && r !== c && l.x1 < c.x0 && r.x0 > c.x1) n++;
  }
  return n;
}
export function guessYaw(pos) {
  const H = GAME.height;
  const a0 = armSlices(transformPositions(pos, normalize(pos, 0))), a1 = armSlices(transformPositions(pos, normalize(pos, Math.PI / 2)));
  let yaw = a1 > a0 ? Math.PI / 2 : 0;
  // bàn chân so với trục ống chân ngay trên nó (không so với chính bàn chân: bàn chân đối xứng quanh tâm của nó)
  const q = transformPositions(pos, normalize(pos, yaw));
  let lo = Infinity, hi = -Infinity, nf = 0, sz = 0, ns = 0;
  for (let i = 0; i < q.length; i += 3) {
    const y = q[i + 1], z = q[i + 2];
    if (y < 0.03 * H) { lo = Math.min(lo, z); hi = Math.max(hi, z); nf++; }
    else if (y > 0.07 * H && y < 0.16 * H && Math.abs(q[i]) < 0.15 * H) { sz += z; ns++; }
  }
  if (nf > 10 && ns > 10) { const axis = sz / ns; if (axis - lo > (hi - axis) * 1.25) yaw += Math.PI; }
  return yaw;
}

// Điểm rải đều trên mặt tam giác (theo diện tích, hạt giống cố định): lát cắt ngang của lưới thưa (khối hộp low poly, lưới đã
// giảm) chỉ có đỉnh ở góc nên nhiều lát rỗng; rải trên mặt thì lát nào cũng có điểm. parts: [{ pos, index }].
export function surfacePoints(parts, count = 60000) {
  const tris = [];
  let total = 0;
  for (const { pos, index } of parts) {
    const nT = index ? index.length / 3 : pos.length / 9;
    for (let t = 0; t < nT; t++) {
      const a = index ? index[t * 3] : t * 3, b = index ? index[t * 3 + 1] : t * 3 + 1, c = index ? index[t * 3 + 2] : t * 3 + 2;
      const ux = pos[b * 3] - pos[a * 3], uy = pos[b * 3 + 1] - pos[a * 3 + 1], uz = pos[b * 3 + 2] - pos[a * 3 + 2];
      const vx = pos[c * 3] - pos[a * 3], vy = pos[c * 3 + 1] - pos[a * 3 + 1], vz = pos[c * 3 + 2] - pos[a * 3 + 2];
      const ar = 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
      if (ar > 0) { total += ar; tris.push([pos, a, b, c, total]); }
    }
  }
  const out = new Float32Array(count * 3);
  let seed = 0x9e3779b9;
  const rnd = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (let i = 0; i < count && tris.length; i++) {
    const r = rnd() * total;
    let lo = 0, hi = tris.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (tris[m][4] < r) lo = m + 1; else hi = m; }
    const [P, a, b, c] = tris[lo];
    let u = rnd(), v = rnd(); if (u + v > 1) { u = 1 - u; v = 1 - v; }
    for (let k = 0; k < 3; k++) out[i * 3 + k] = P[a * 3 + k] + (P[b * 3 + k] - P[a * 3 + k]) * u + (P[c * 3 + k] - P[a * 3 + k]) * v;
  }
  return tris.length ? out : new Float32Array(0);
}

// ---- 2. dò khớp --------------------------------------------------------------------------------------------------------------
// Cụm theo x trong một lát ngang [ylo, yhi]: sắp x, tách ở khe > gap. Mỗi cụm { x0, x1, cx, cz, n }.
function slice(p, ylo, yhi, gap, xlim = Infinity) {
  const pts = [];
  for (let i = 0; i < p.length; i += 3) { const y = p[i + 1]; if (y >= ylo && y <= yhi && Math.abs(p[i]) <= xlim) pts.push([p[i], p[i + 2]]); }
  pts.sort((a, b) => a[0] - b[0]);
  const out = []; let cur = null;
  for (const [x, z] of pts) {
    if (!cur || x - cur.x1 > gap) { cur = { x0: x, x1: x, sx: 0, sz: 0, n: 0 }; out.push(cur); }
    cur.x1 = x; cur.sx += x; cur.sz += z; cur.n++;
  }
  const min = Math.max(3, pts.length * 0.004);
  return out.filter((c) => c.n >= min).map((c) => ({ x0: c.x0, x1: c.x1, cx: c.sx / c.n, cz: c.sz / c.n, n: c.n }));
}
const central = (cl) => cl.find((c) => c.x0 <= 0 && c.x1 >= 0) || cl.slice().sort((a, b) => Math.abs(a.cx) - Math.abs(b.cx))[0];
export { slice as _slice, central as _central };          // cho kiểm thử

// p: toạ độ đã chuẩn hoá. Trả { j: { tên khớp → [x,y,z] }, ends: điểm cuối xương lá (đầu ngón tay, đỉnh đầu, mũi chân),
// torsoHalf(y): nửa bề ngang thân ở độ cao y, warnings: [] }.
export function landmarks(p) {
  const H = GAME.height, gap = 0.022 * H, band = 0.006 * H, warnings = [];
  const ys = []; for (let k = 0; k <= 160; k++) ys.push((k / 160) * H);
  const S = ys.map((y) => ({ y, cl: slice(p, y - band, y + band, gap) }));
  const at = (y) => S.reduce((b, s) => (Math.abs(s.y - y) < Math.abs(b.y - y) ? s : b), S[0]);

  const torsoHalfAt = (y) => { const c = central(at(y).cl); return c ? Math.max(-c.x0, c.x1) : R.shoulderX * H; };
  // đầu ngón tay: điểm xa nhất theo x mỗi bên, trong vùng thân trên (bỏ bàn chân, vũ khí chống đất)
  const tip = { L: null, R: null };
  for (let i = 0; i < p.length; i += 3) {
    const x = p[i], y = p[i + 1]; if (y < 0.28 * H || y > 0.86 * H) continue;
    if (!tip.L || x < tip.L[0]) tip.L = [x, y, p[i + 2]];
    if (!tip.R || x > tip.R[0]) tip.R = [x, y, p[i + 2]];
  }
  // nách: đi từ bàn tay lên, lát cao nhất mà cụm ngoài cùng hai bên còn tách khỏi thân (tay liền từ bàn tay tới nách). Dò từ
  // trên xuống thì nhầm: ở tầm đỉnh vai lát cũng có ba cụm (vai trái, cổ, vai phải).
  const split = (s) => {
    if (s.cl.length < 3) return null;
    const c = central(s.cl), l = s.cl[0], r = s.cl[s.cl.length - 1];
    return l !== c && r !== c && l.x1 < c.x0 && r.x0 > c.x1 ? c : null;
  };
  let armpit = null, miss = 0;
  const y0 = tip.L && tip.R ? Math.max(tip.L[1], tip.R[1]) + 0.02 * H : 0.5 * H;
  for (const s of S) {
    if (s.y < y0 || s.y > 0.86 * H) continue;
    const c = split(s);
    if (c) { armpit = { y: s.y, c }; miss = 0; } else if (armpit && ++miss > 3) break;      // cho hụt ≤ 3 lát (khe khuỷu của mô hình ghép khối)
  }
  let shY, shX, shZ;
  if (armpit) {
    shY = armpit.y + 0.045 * H;
    const c = central(at(armpit.y + 0.01 * H).cl) || armpit.c, half = (c.x1 - c.x0) / 2;
    shZ = c.cz;
    // trục cánh tay: tâm cụm ngoài cùng ở các lát từ nách xuống, khớp một đường thẳng x = a + b·y (mỗi bên), kéo lên tới độ
    // cao vai — khớp vai rơi vào điểm xoay trong bắp vai thay vì mép thân (trước đây thụt vào 0,035 H, vai bị kéo dẹt khi giơ tay)
    const fit = (pick) => {
      let n = 0, sy = 0, sx = 0, syy = 0, sxy = 0;
      for (const s of S) {
        if (s.y > armpit.y - 0.01 * H || s.y < armpit.y - 0.2 * H || s.cl.length < 2) continue;
        const k = pick(s.cl), cc = central(s.cl); if (!k || k === cc) continue;
        n++; sy += s.y; sx += Math.abs(k.cx); syy += s.y * s.y; sxy += s.y * Math.abs(k.cx);
      }
      if (n < 4) return null;
      const b1 = (n * sxy - sy * sx) / (n * syy - sy * sy || 1e-9), a1 = (sx - b1 * sy) / n;
      return a1 + b1 * shY;
    };
    const xs = [fit((cl) => cl[0]), fit((cl) => cl[cl.length - 1])].filter((x) => x != null && isFinite(x));
    const fx = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : half - 0.012 * H;
    shX = Math.max(half * 0.6, Math.min(half + 0.02 * H, fx));
  } else {
    warnings.push("Không thấy nách (tay sát thân?): vai đặt theo tỉ lệ rig — nên sinh lại ảnh tay chữ A rõ hơn.");
    shY = R.shoulder * H; shX = R.shoulderX * H; shZ = central(at(shY).cl)?.cz ?? 0;
  }
  // cổ: bề ngang cụm giữa nhỏ nhất giữa vai và đỉnh đầu
  let neckY = R.neck * H, wMin = Infinity;
  for (const s of S) {
    if (s.y < Math.max(shY + 0.01 * H, 0.8 * H) || s.y > 0.93 * H) continue;
    const c = central(s.cl); if (!c) continue;
    const w = c.x1 - c.x0; if (w < wMin) { wMin = w; neckY = s.y; }
  }
  const neckZ = central(at(neckY).cl)?.cz ?? shZ;
  // chân: đáy chậu = lát cao nhất (từ dưới lên) còn hai cụm sát giữa tách nhau ở x = 0
  let crotch = 0, legs = null;
  for (const s of S) {
    if (s.y < 0.06 * H) continue; if (s.y > 0.6 * H) break;
    const cl = slice(p, s.y - band, s.y + band, gap * 0.5, 0.17 * H);
    const l = cl.filter((c) => c.cx < 0), r = cl.filter((c) => c.cx > 0);
    if (l.length && r.length && l[l.length - 1].x1 < 0 && r[0].x0 > 0) { crotch = s.y; if (!legs && s.y > 0.08 * H) legs = { l: l[l.length - 1], r: r[0] }; }
    else if (crotch) break;
  }
  let hipsY = R.hips * H;
  if (crotch > 0.36 * H) hipsY = Math.min(0.55 * H, Math.max(0.44 * H, crotch + 0.05 * H));
  else warnings.push("Không thấy đáy chậu (áo dài che chân?): hông đặt theo tỉ lệ rig.");
  const torsoZ = central(at(hipsY + 0.05 * H).cl)?.cz ?? 0;
  const legX = legs ? (Math.abs(legs.l.cx) + Math.abs(legs.r.cx)) / 2 : R.legX * H;
  const lz = legs ? { L: legs.l.cz, R: legs.r.cz } : { L: torsoZ, R: torsoZ };

  const j = {}, ends = {};
  j.hips = [0, hipsY, torsoZ];
  j.torso = [0, hipsY + 0.02 * H, torsoZ];
  j.head = [0, neckY, neckZ];
  ends.head = [0, H, neckZ];
  for (const side of ["L", "R"]) {
    const sg = side === "L" ? -1 : 1, t = tip[side];
    const sh = [sg * shX, shY, shZ];
    const tp = t && Math.abs(t[0]) > shX + 0.05 * H ? t : [sg * (shX + 0.22 * H), shY - 0.33 * H, shZ];
    const lerp = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
    j["sh" + side] = sh; j["el" + side] = lerp(sh, tp, 0.43); j["hand" + side] = lerp(sh, tp, 0.77); ends["hand" + side] = tp;
    const ax = sg * legX, az = lz[side];
    j["hip" + side] = [ax * 0.95, hipsY - 0.01 * H, torsoZ];
    j["ankle" + side] = [ax, R.ankle * H, az - 0.01 * H];
    j["knee" + side] = [ax, (hipsY + R.ankle * H) / 2 + 0.01 * H, az + 0.012 * H];
    ends["ankle" + side] = [ax, 0, az + 0.07 * H];
  }
  if (!tip.L || !tip.R || Math.abs(tip.L[0]) < shX + 0.05 * H) warnings.push("Không thấy rõ bàn tay: kiểm tra mô hình có dang tay chữ A không.");
  return { j, ends, torsoHalf: torsoHalfAt, warnings, info: { armpit: armpit?.y ?? null, crotch, neckY, hipsY } };
}

// ---- 3. bộ xương -----------------------------------------------------------------------------------------------------------------
// Tư thế nghỉ = rig game: mọi góc 0, khớp con của tay/chân nằm thẳng dưới khớp cha (−y) đúng độ dài đoạn xương mô hình.
// Tư thế gắn = xoay vai/khuỷu/hông/gối cho đoạn xương trùng tay chân mô hình (tay chữ A). Trả { bones, byName, bind, rest }.
const DOWN = new THREE.Vector3(0, -1, 0);
export function buildSkeleton(lm) {
  const { j } = lm, v = (a) => new THREE.Vector3(a[0], a[1], a[2]);
  const byName = {}, bones = [];
  for (const name of JOINTS) { const b = new THREE.Bone(); b.name = name; byName[name] = b; bones.push(b); }
  for (const name of JOINTS) if (PARENT[name]) byName[PARENT[name]].add(byName[name]);
  const len = (a, b) => v(j[a]).distanceTo(v(j[b]));
  // vị trí nghỉ (khung cha, mọi góc 0)
  const H = byName;
  H.hips.position.copy(v(j.hips));
  H.torso.position.copy(v(j.torso).sub(v(j.hips)));
  H.head.position.copy(v(j.head).sub(v(j.torso)));
  for (const s of ["L", "R"]) {
    H["sh" + s].position.copy(v(j["sh" + s]).sub(v(j.torso)));
    H["el" + s].position.set(0, -len("sh" + s, "el" + s), 0);
    H["hand" + s].position.set(0, -len("el" + s, "hand" + s), 0);
    H["hip" + s].position.copy(v(j["hip" + s]).sub(v(j.hips)));
    H["knee" + s].position.set(0, -len("hip" + s, "knee" + s), 0);
    H["ankle" + s].position.set(0, -len("knee" + s, "ankle" + s), 0);
  }
  for (const b of bones) b.rotation.order = b.name.startsWith("sh") ? "YXZ" : "XYZ";
  const rest = {}; for (const b of bones) rest[b.name] = b.position.clone();
  // góc gắn: đoạn cha → con trùng hướng mô hình (khung cha đã xoay theo góc gắn của nó)
  const aim = (name, child) => {
    const b = H[name], parentQ = new THREE.Quaternion();
    b.parent.updateWorldMatrix(true, false); b.parent.getWorldQuaternion(parentQ);
    const dir = v(j[child]).sub(v(j[name])).normalize().applyQuaternion(parentQ.invert());
    b.quaternion.setFromUnitVectors(DOWN, dir); b.updateWorldMatrix(false, true);
  };
  for (const s of ["L", "R"]) { aim("sh" + s, "el" + s); aim("el" + s, "hand" + s); aim("hip" + s, "knee" + s); aim("knee" + s, "ankle" + s); }
  const bind = {}; for (const b of bones) bind[b.name] = b.quaternion.clone();
  H.hips.updateWorldMatrix(true, true);
  return { bones, byName, bind, rest, root: H.hips };
}

// ---- 4. trọng số da ------------------------------------------------------------------------------------------------------------
// Đoạn xương ảnh hưởng (toạ độ mô hình, tư thế gắn): [tên xương, điểm đầu, điểm cuối, phía (−1 L, +1 R, 0 giữa)].
function segments(lm) {
  const { j, ends } = lm, H = GAME.height, out = [];
  out.push(["hips", [0, j.hips[1] - 0.05 * H, j.hips[2]], [0, j.torso[1] + 0.03 * H, j.torso[2]], 0]);
  out.push(["torso", j.torso, [0, j.head[1] - 0.02 * H, j.head[2]], 0]);
  out.push(["head", j.head, ends.head, 0]);
  for (const s of ["L", "R"]) {
    const sg = s === "L" ? -1 : 1;
    out.push(["sh" + s, j["sh" + s], j["el" + s], sg], ["el" + s, j["el" + s], j["hand" + s], sg], ["hand" + s, j["hand" + s], ends["hand" + s], sg]);
    out.push(["hip" + s, j["hip" + s], j["knee" + s], sg], ["knee" + s, j["knee" + s], j["ankle" + s], sg], ["ankle" + s, j["ankle" + s], ends["ankle" + s], sg]);
  }
  return out;
}
function segDist(px, py, pz, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L2 = dx * dx + dy * dy + dz * dz || 1e-9;
  let t = ((px - a[0]) * dx + (py - a[1]) * dy + (pz - a[2]) * dz) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
  const x = a[0] + dx * t - px, y = a[1] + dy * t - py, z = a[2] + dz * t - pz;
  return Math.sqrt(x * x + y * y + z * z);
}

// p: toạ độ đã chuẩn hoá của MỘT lưới; index: chỉ mục tam giác (có thể null). Trả { skinIndex: Uint16Array(n*4),
// skinWeight: Float32Array(n*4) } với chỉ số xương theo JOINTS.
export function computeWeights(p, index, lm, { power = 5, smooth = 2 } = {}) {
  const H = GAME.height, n = p.length / 3, segs = segments(lm), B = JOINTS.length;
  const bi = segs.map((s) => JOINTS.indexOf(s[0]));
  const W = new Float32Array(n * B), allow = new Uint16Array(n);           // allow: bit k = đỉnh được dùng xương k
  const shY = Math.min(lm.j.shL[1], lm.j.shR[1]), hipsY = lm.j.hips[1], legR = 0.05 * H;
  for (let v = 0; v < n; v++) {
    const x = p[v * 3], y = p[v * 3 + 1], z = p[v * 3 + 2];
    const half = lm.torsoHalf(y), insideTorso = Math.abs(x) < half * 0.92 && y < shY - 0.01 * H;
    let dLeg = Infinity;
    for (let k = 0; k < segs.length; k++) {
      const [name, a, b, side] = segs[k];
      const leg = name.startsWith("hip") || name.startsWith("knee") || name.startsWith("ankle");
      if (side && x * side < (leg ? -0.005 : -0.025) * H) continue;                 // không ăn sang bên kia (chân: chỉ vạt giữa)
      const limb = name.startsWith("sh") || name.startsWith("el") || name.startsWith("hand");
      if (limb && insideTorso) continue;                                              // tay không kéo sườn, bụng
      if (name === "head" && y < lm.j.head[1] - 0.03 * H) continue;
      if (leg && y > hipsY + 0.03 * H) continue;                                      // chân không kéo thân
      const d = segDist(x, y, z, a, b) + 0.004 * H;
      if (leg && (name.startsWith("hip") || name.startsWith("knee"))) dLeg = Math.min(dLeg, d);
      W[v * B + bi[k]] += 1 / Math.pow(d, power);
      allow[v] |= 1 << bi[k];
    }
    allow[v] |= 1;                                                                 // hông luôn được (vạt áo, chỗ nối)
    // vạt áo xa trục chân (áo dài, váy giáp): chia thêm cho hông để không bị xé khi hai chân bước
    if (y < hipsY && dLeg > legR) {
      const k = Math.min(1, (dLeg - legR) / (0.06 * H)), d = Math.max(dLeg, 0.01 * H);
      W[v * B] += (k * 0.8) / Math.pow(d, power);
    }
  }
  // làm mượt theo lân cận (gộp đỉnh trùng vị trí — lưới glTF tách đỉnh ở đường may UV)
  if (smooth > 0 && index) {
    const key = new Map(), id = new Int32Array(n);
    for (let v = 0; v < n; v++) {
      const k = `${Math.round(p[v * 3] * 1e4)},${Math.round(p[v * 3 + 1] * 1e4)},${Math.round(p[v * 3 + 2] * 1e4)}`;
      let g = key.get(k); if (g === undefined) { g = key.size; key.set(k, g); } id[v] = g;
    }
    const G = key.size, nb = Array.from({ length: G }, () => new Set());
    for (let t = 0; t < index.length; t += 3) {
      const a = id[index[t]], b = id[index[t + 1]], c = id[index[t + 2]];
      nb[a].add(b); nb[a].add(c); nb[b].add(a); nb[b].add(c); nb[c].add(a); nb[c].add(b);
    }
    // chuẩn hoá trước khi trộn (trọng số thô chênh nhau nhiều bậc)
    const norm = (A, rows) => { for (let r = 0; r < rows; r++) { let s = 0; for (let k = 0; k < B; k++) s += A[r * B + k]; if (s > 0) for (let k = 0; k < B; k++) A[r * B + k] /= s; } };
    let gW = new Float32Array(G * B), cnt = new Float32Array(G), gA = new Uint16Array(G).fill(0xffff);
    for (let v = 0; v < n; v++) { cnt[id[v]]++; gA[id[v]] &= allow[v]; for (let k = 0; k < B; k++) gW[id[v] * B + k] += W[v * B + k]; }
    for (let g = 0; g < G; g++) for (let k = 0; k < B; k++) gW[g * B + k] /= cnt[g] || 1;
    norm(gW, G);
    for (let it = 0; it < smooth; it++) {
      const nw = new Float32Array(G * B);
      for (let g = 0; g < G; g++) {
        const ns = nb[g], m = ns.size;
        for (let k = 0; k < B; k++) nw[g * B + k] = gW[g * B + k] * 0.5;
        if (!m) { for (let k = 0; k < B; k++) nw[g * B + k] = gW[g * B + k]; continue; }
        for (const o of ns) for (let k = 0; k < B; k++) nw[g * B + k] += (gW[o * B + k] * 0.5) / m;
        for (let k = 0; k < B; k++) if (!(gA[g] & (1 << k))) nw[g * B + k] = 0;      // giữ luật chặn (tay–thân, trái–phải)
      }
      norm(nw, G);
      gW = nw;
    }
    for (let v = 0; v < n; v++) for (let k = 0; k < B; k++) W[v * B + k] = gW[id[v] * B + k];
  }
  // giữ 4 xương nặng nhất mỗi đỉnh, chuẩn hoá
  const skinIndex = new Uint16Array(n * 4), skinWeight = new Float32Array(n * 4);
  for (let v = 0; v < n; v++) {
    const top = [[0, -1], [0, -1], [0, -1], [0, -1]];
    for (let k = 0; k < B; k++) {
      const w = W[v * B + k]; if (w <= top[3][0]) continue;
      top[3] = [w, k]; top.sort((a, b) => b[0] - a[0]);
    }
    let s = 0; for (const [w] of top) s += w;
    for (let q = 0; q < 4; q++) {
      const [w, k] = top[q];
      skinIndex[v * 4 + q] = k < 0 ? 0 : k; skinWeight[v * 4 + q] = s > 0 && k >= 0 ? w / s : q === 0 ? 1 : 0;
    }
  }
  return { skinIndex, skinWeight };
}

// ---- gói lại: từ các lưới tĩnh (đã bake toạ độ thế giới) → nhóm SkinnedMesh + bộ xương ------------------------------------------
// meshes: [{ geometry (BufferGeometry, toạ độ thế giới), material }]. opts.yaw: null = tự đoán. Trả { root, skeleton, bones, byName,
// lm, norm, warnings }.
export function rigMeshes(meshes, opts = {}) {
  const pts = surfacePoints(meshes.map((m) => ({ pos: m.geometry.attributes.position.array, index: m.geometry.index ? m.geometry.index.array : null })));
  const yaw = opts.yaw ?? guessYaw(pts), norm = normalize(pts, yaw);
  const lm = landmarks(transformPositions(pts, norm));
  if (opts.adjust) opts.adjust(lm);
  const sk = buildSkeleton(lm);
  const root = new THREE.Group(); root.name = "rigged";
  root.add(sk.root);
  const skeleton = new THREE.Skeleton(sk.bones);
  for (const m of meshes) {
    const g = m.geometry.clone();
    const p = transformPositions(g.attributes.position.array, norm);
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    g.computeVertexNormals();
    const { skinIndex, skinWeight } = computeWeights(p, g.index ? g.index.array : null, lm, opts.weights);
    g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(skinIndex, 4));
    g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(skinWeight, 4));
    const sm = new THREE.SkinnedMesh(g, m.material);
    sm.name = m.name || "body";
    root.add(sm);
    sm.bind(skeleton, new THREE.Matrix4());
  }
  return { root, skeleton, bones: sk.bones, byName: sk.byName, bind: sk.bind, rest: sk.rest, lm, norm, warnings: lm.warnings };
}
