// design/tools/bake/fit-arms.mjs — dò khớp tay cho mô hình A-pose tay thẳng (Hunyuan3D, design/hunyuan-prompts.md, POSE v3): ra vai, khuỷu,
// "hand" (giữa nắm đấm) theo dạng khớp ghi tay của catalog.mjs (fix) — thay cho việc đo lát cắt bằng mắt như H35h. Bộ dò geodesic
// (landmarks.mjs) trượt với tay chữ A áo giáp rộng: giáp vai liền thân nên vai rơi giữa ngực, nên ở đây đo theo mặt cắt ngang.
// Mặt cắt: mỗi 0,01 độ cao, mỗi tam giác cắt mặt phẳng cho một đoạn (x, z); các đoạn một bên (x·dấu > 0,02) nối thành dải x liền nhau
// (nối khe ≤ gap). Dải ngoài cùng là tay khi nó tách khỏi dải kề bên trong bằng một khe. Nắm đấm: độ cao thấp nhất (0,55–1,5) mà dải
// ngoài cùng cách thân ≥ fistGap, nằm ngoài trục ≥ fistIn; tay lên cao tới chỗ khe còn ≥ armGap (nách; trên đó giáp vai dính thân,
// vai không đo được — mẫu X19 còn một giáp vai tách riêng ở 1,35–1,40, bỏ qua vì không liền với tay).
//   "hand": tâm lát cắt ở fistH (0,13) dưới cùng của tay — giữa nắm đấm. Cẳng tay: từ "hand" theo hướng tới tâm lát cắt gần nách (refN lát
//   cuối), dài reach · (1 − elbow). Cánh tay trên: cùng chiều dài còn lại, nhưng đứng hơn cẳng tay (upX, upZ nhân vào bước ngang, bước ra
//   trước: mẫu Hunyuan3D có cánh tay trên gần thẳng đứng, cẳng tay chếch ra ngoài ~38° và về trước ~25–30°; ngoại suy thẳng cả cánh tay
//   đặt vai sau lưng 0,08 so với bộ xương của công cụ rig tự động). Chiều dài tay vai → giữa nắm đấm gần như không đổi giữa các mẫu
//   (reach 0,51: H35h ghi tay 0,52, X19 theo bộ xương rig 0,49) nên vai không cần đo — nó nằm trong giáp vai. upX = upZ = 1: tay thẳng.
// Cổ (fix.neck): vai bộ dò sai thì cổ dò theo vai đó cũng sai (H33h: 0,057 m trên vai, giáp vai lọt vào vùng đầu). Ở đây cổ là chỗ thân hẹp
// nhất (nửa bề ngang dải giữa) trong dải vai + neckBand, lấy mức thấp nhất còn trong neckTol của chỗ hẹp nhất (cổ áo cao che cổ thì mặt hẹp
// hơn cổ — cùng luật landmarks.mjs); ngoài dải 0,06–0,2 trên vai thì đặt 0,133 (0,07 H) trên vai như fitHuman.
// Toạ độ vào: Float32Array xyz đã chuẩn hoá thô (chân y = 0, giữa x = z = 0, cao 1,9 — fitHuman, cùng khung với khớp ghi tay).
// Trái = −x, phải = +x (như catalog fix). Hai tay đo riêng rồi lấy trung bình (soi gương): mẫu AI không đối xứng tuyệt đối.

export const ARM_FIT = { y0: 0.3, y1: 1.8, dy: 0.01, gap: 0.006, minLen: 0.02, nbLen: 0.06, fistY: [0.55, 1.5], fistGap: 0.06, fistIn: 0.18,
  armGap: 0.008, armIn: 0.1, armW: 0.32, holes: 2, fistH: 0.13, fistCenter: 0.065, skip: 0.15, top: 0.02, refN: 5, minLevels: 8,
  reach: 0.51, elbow: 0.5, upX: 0.55, upZ: 0.1, neckBand: [0.0855, 0.19], neckTol: 0.011, neckOk: [0.06, 0.2], neckDef: 0.133, shY: [1.2, 1.7], shX: [0.12, 0.4], sym: 0.06 };

// Mặt cắt ngang tại y0, y0 + dy, … ≤ y1: mỗi mức là danh sách đoạn [x0, z0, x1, z1] (tam giác cắt mặt phẳng).
export function sections(P, idx, y0, y1, dy) {
  const n = Math.floor((y1 - y0) / dy + 1e-9) + 1, lv = Array.from({ length: n }, () => []);
  for (let t = 0; t < idx.length; t += 3) {
    const v = [idx[t] * 3, idx[t + 1] * 3, idx[t + 2] * 3], lo = Math.min(P[v[0] + 1], P[v[1] + 1], P[v[2] + 1]), hi = Math.max(P[v[0] + 1], P[v[1] + 1], P[v[2] + 1]);
    for (let k = Math.max(0, Math.ceil((lo - y0) / dy)); k < n && y0 + k * dy <= hi; k++) {
      const y = y0 + k * dy, s = [];
      for (let e = 0; e < 3; e++) {
        const p = v[e], q = v[(e + 1) % 3], yp = P[p + 1], yq = P[q + 1];
        if ((yp - y) * (yq - y) < 0) { const u = (y - yp) / (yq - yp); s.push(P[p] + (P[q] - P[p]) * u, P[p + 2] + (P[q + 2] - P[p + 2]) * u); }
      }
      if (s.length === 4) lv[k].push(s);
    }
  }
  return lv;
}

// Dải x liền nhau (u = dấu · x) của một mức, từ trong ra ngoài: { lo, hi, zLo, zHi, len } — len: tổng độ dài đoạn (bỏ mảnh vụn < minLen).
export function runsAt(segs, sg, { gap, minLen }) {
  const iv = [];
  for (const [x0, z0, x1, z1] of segs) {
    const a = sg * x0, b = sg * x1;
    if (Math.max(a, b) > 0.02) iv.push({ lo: Math.min(a, b), hi: Math.max(a, b), zLo: Math.min(z0, z1), zHi: Math.max(z0, z1), len: Math.hypot(x1 - x0, z1 - z0) });
  }
  iv.sort((p, q) => p.lo - q.lo);
  const runs = [];
  for (const s of iv) {
    const r = runs[runs.length - 1];
    if (r && s.lo <= r.hi + gap) { r.hi = Math.max(r.hi, s.hi); r.zLo = Math.min(r.zLo, s.zLo); r.zHi = Math.max(r.zHi, s.zHi); r.len += s.len; }
    else runs.push({ ...s });
  }
  return runs.filter((r) => r.len >= minLen);
}

// Một bên (sg −1 trái, +1 phải). lv: mặt cắt (sections). Trả { hand, sh, el, info } trong khung u = sg · x (u > 0 ra ngoài) hoặc ném lỗi.
function armOf(lv, sg, name, p) {
  const A = lv.map((segs) => {
    const runs = runsAt(segs, sg, p), out = runs[runs.length - 1];
    if (!out) return null;
    const nb = runs.slice(0, -1).filter((r) => r.len >= p.nbLen).pop();
    return { ...out, gap: nb ? out.lo - nb.hi : Infinity, w: out.hi - out.lo, u: (out.lo + out.hi) / 2, z: (out.zLo + out.zHi) / 2 };
  });
  const Y = (k) => p.y0 + k * p.dy, side = sg < 0 ? "trái" : "phải";
  const isFist = (a, k) => a && Y(k) >= p.fistY[0] && Y(k) <= p.fistY[1] && a.gap >= p.fistGap && a.lo >= p.fistIn && a.w <= p.armW;
  const isArm = (a) => a && a.gap >= p.armGap && a.lo >= p.armIn && a.w <= p.armW;
  const k0 = A.findIndex((a, k) => isFist(a, k));
  if (k0 < 0) throw new Error(`${name}: tay ${side} không thấy nắm đấm tách khỏi thân (khe ≥ ${p.fistGap}, ngoài trục ≥ ${p.fistIn}, độ cao ${p.fistY.join("–")}) — tay áp thân hay dang quá rộng: ghi khớp tay vào catalog.mjs`);
  let k1 = k0, miss = 0;
  for (let k = k0 + 1; k < A.length && miss <= p.holes; k++) { if (isArm(A[k])) { k1 = k; miss = 0; } else miss++; }
  const nF = Math.round(p.fistH / p.dy), fist = A.slice(k0, k0 + nF + 1).filter(isArm);
  const mean = (L, f) => L.reduce((s, a) => s + f(a), 0) / L.length;
  const yb = Y(k0), hand = [mean(fist, (a) => a.u), yb + p.fistCenter, mean(fist, (a) => a.z)];
  const ka = k0 + Math.round(p.skip / p.dy), kb = k1 - Math.round(p.top / p.dy), top = A.slice(Math.max(ka, kb - p.refN + 1), kb + 1).filter(isArm);
  if (kb - ka + 1 < p.minLevels || !top.length) throw new Error(`${name}: tay ${side} chỉ tách khỏi thân cao ${(Y(k1) - yb).toFixed(2)} (nắm đấm ${yb.toFixed(2)} → nách ${Y(k1).toFixed(2)}), thiếu ${p.minLevels} mặt cắt để dò hướng tay — ghi khớp tay vào catalog.mjs`);
  const C = [mean(top, (a) => a.u), mean(top, (a) => Y(A.indexOf(a))), mean(top, (a) => a.z)];
  const d = [C[0] - hand[0], C[1] - hand[1], C[2] - hand[2]], L = Math.hypot(...d), dir = d.map((x) => x / L);
  const fo = p.reach * (1 - p.elbow), el = hand.map((h, i) => h + dir[i] * fo);
  const up = [dir[0] * p.upX, dir[1], dir[2] * p.upZ], ul = Math.hypot(...up), sh = el.map((e, i) => e + (up[i] / ul) * (p.reach - fo));
  return { hand, sh, el, info: { yb, armTop: Y(k1), ref: C, dir, levels: kb - ka + 1, width: mean(A.slice(ka, kb + 1).filter(isArm), (a) => a.w) } };
}

// Cổ: mức thấp nhất trong dải vai + neckBand mà nửa bề ngang dải giữa (dải trong cùng chạm trục, trung bình hai bên) ≤ chỗ hẹp nhất + neckTol.
function neckOf(lv, shY, p) {
  const prof = [];
  for (let k = 0; k < lv.length; k++) {
    const y = p.y0 + k * p.dy;
    if (y < shY + p.neckBand[0] - 1e-9 || y > shY + p.neckBand[1] + 1e-9) continue;
    const w = [-1, 1].map((sg) => { const r = runsAt(lv[k], sg, p)[0]; return r && r.lo <= 0.05 ? r.hi : Infinity; });
    prof.push([y, (w[0] + w[1]) / 2]);
  }
  const wMin = Math.min(...prof.map((q) => q[1]));
  return isFinite(wMin) ? prof.find((q) => q[1] <= wMin + p.neckTol)[0] : null;
}

// pos, idx: lưới đã chuẩn hoá thô (fitHuman). Trả { fix: { shL, elL, handL, shR, elR, handR, neck } (3 chữ số, như catalog.mjs), info: { L, R }, warnings }.
export function fitArms(pos, idx, { name = "?", prm = {} } = {}) {
  const p = { ...ARM_FIT, ...prm }, lv = sections(pos, idx, p.y0, p.y1, p.dy), warnings = [], R = {}, ok = {};
  for (const sg of [-1, 1]) {
    const sd = sg < 0 ? "L" : "R";
    try { R[sd] = armOf(lv, sg, name, p); } catch (e) { ok[sd] = e; }
  }
  if (!R.L && !R.R) throw ok.L;
  for (const sd of ["L", "R"]) if (!R[sd]) { warnings.push(`${ok[sd].message} — lấy tay kia soi gương`); R[sd] = null; }
  const mean = (a, b) => (a && b ? a.map((x, i) => (x + b[i]) / 2) : a || b);
  const J = {};
  for (const k of ["hand", "sh", "el"]) J[k] = mean(R.L?.[k], R.R?.[k]);
  for (const k of ["hand", "sh", "el"]) {
    const gap = R.L && R.R ? Math.max(...R.L[k].map((x, i) => Math.abs(x - R.R[k][i]))) : 0;
    if (gap > p.sym) warnings.push(`hai tay lệch ${gap.toFixed(3)} ở ${k} (khung thô) — mẫu không đối xứng, đã lấy trung bình`);
  }
  const [shX, shY] = [J.sh[0], J.sh[1]];
  if (!(shY >= p.shY[0] && shY <= p.shY[1])) throw new Error(`${name}: vai dò ở độ cao ${shY.toFixed(3)} ngoài dải ${p.shY.join("–")} — tay dò sai, ghi khớp tay vào catalog.mjs`);
  if (!(shX >= p.shX[0] && shX <= p.shX[1])) throw new Error(`${name}: vai dò cách trục ${shX.toFixed(3)} ngoài dải ${p.shX.join("–")} — tay dò sai, ghi khớp tay vào catalog.mjs`);
  const r3 = (a, sg) => [+(sg * a[0]).toFixed(3), +a[1].toFixed(3), +a[2].toFixed(3)], fix = {};
  for (const [sd, sg] of [["L", -1], ["R", 1]]) { fix["sh" + sd] = r3(J.sh, sg); fix["el" + sd] = r3(J.el, sg); fix["hand" + sd] = r3(J.hand, sg); }
  let neck = neckOf(lv, shY, p);
  if (neck == null || neck - shY < p.neckOk[0] || neck - shY > p.neckOk[1]) { warnings.push(`cổ dò ${neck == null ? "không ra" : (neck - shY).toFixed(3) + " trên vai"}: đặt ${p.neckDef} trên vai`); neck = shY + p.neckDef; }
  fix.neck = +neck.toFixed(3);
  return { fix, info: { L: R.L?.info, R: R.R?.info }, warnings };
}
