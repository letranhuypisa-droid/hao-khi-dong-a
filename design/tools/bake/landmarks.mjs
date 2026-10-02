// design/tools/bake/landmarks.mjs — dò khớp cho mô hình người Meshy (đứng thẳng, mặt +z, hai tay đưa ra trước hoặc dang chữ A).
// Bộ dò cũ (game/js/riglab/autorig.js) cắt lát ngang và giả định tay dang trong mặt phẳng trán: mô hình Meshy đưa tay ra trước,
// khuỷu gập, áo dài che đáy chậu nên lát cắt không thấy nách, không thấy chân. Ở đây dò tay theo khoảng cách đo dọc mặt lưới
// (geodesic, Dijkstra trên lưới đã hàn đỉnh): đầu ngón tay là điểm xa nhất tính từ ngực trong vùng thân trên ngoài trục giữa;
// các vòng đẳng khoảng cách tính từ đầu ngón tay ôm quanh cánh tay, tâm vòng là trục tay; vòng phình đột ngột là chỗ tay nhập
// thân (nách). Chân: tâm ống chân ở lát thấp (dưới gấu áo), hông theo tỉ lệ rig. Cổ: chỗ thân hẹp nhất trên vai.
// Toạ độ vào: Float32Array xyz đã chuẩn hoá (chân y = 0, giữa x = z = 0, cao H). Trả { j, ends, info, warnings }.

export function weld(pos, index, q = 1e4) {
  const key = new Map(), id = new Int32Array(pos.length / 3), P = [];
  for (let v = 0; v < id.length; v++) {
    const k = `${Math.round(pos[v * 3] * q)},${Math.round(pos[v * 3 + 1] * q)},${Math.round(pos[v * 3 + 2] * q)}`;
    let g = key.get(k); if (g === undefined) { g = key.size; key.set(k, g); P.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]); } id[v] = g;
  }
  const n = key.size, nb = Array.from({ length: n }, () => new Map());
  const P3 = new Float32Array(P);
  const d = (a, b) => Math.hypot(P3[a * 3] - P3[b * 3], P3[a * 3 + 1] - P3[b * 3 + 1], P3[a * 3 + 2] - P3[b * 3 + 2]);
  for (let t = 0; t < index.length; t += 3) {
    const a = id[index[t]], b = id[index[t + 1]], c = id[index[t + 2]];
    for (const [u, w] of [[a, b], [b, c], [c, a]]) if (u !== w) { const L = d(u, w); nb[u].set(w, L); nb[w].set(u, L); }
  }
  const adj = nb.map((m) => [...m.entries()]);
  return { P: P3, n, id, adj };
}

// Dijkstra (đống nhị phân) từ các nguồn; trả Float64Array khoảng cách (Float32 làm tròn lệch với số double trong đống → bỏ sót đỉnh), Int32Array cha.
export function dijkstra(G, src) {
  const dist = new Float64Array(G.n).fill(Infinity), par = new Int32Array(G.n).fill(-1);
  const heap = []; const push = (d, v) => { heap.push([d, v]); let i = heap.length - 1; while (i) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  for (const s of src) { dist[s] = 0; push(0, s); }
  while (heap.length) {
    const [d, v] = pop(); if (d > dist[v]) continue;
    for (const [w, L] of G.adj[v]) { const nd = d + L; if (nd < dist[w]) { dist[w] = nd; par[w] = v; push(nd, w); } }
  }
  return { dist, par };
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const lerp = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];

export function landmarks(pos, index, H = 1.9) {
  const G = weld(pos, index), P = G.P, warnings = [];
  const at = (v) => [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]];
  // nguồn: các đỉnh ngực (giữa thân, tầm 0,62 H) — mọi phần nối với thân đều có khoảng cách hữu hạn
  let src = -1, best = Infinity;
  for (let v = 0; v < G.n; v++) { const dd = Math.hypot(P[v * 3], P[v * 3 + 1] - 0.62 * H); if (dd < best) { best = dd; src = v; } }
  const S0 = dijkstra(G, [src]), D0 = S0.dist;
  // độ cao lớn nhất trên đường ngắn nhất từ ngực tới mỗi đỉnh: bàn tay (kể cả buông thấp) thì đường đi lên qua vai rồi mới
  // xuống; vạt áo dài, gấu áo thì đường đi thẳng xuống — loại được dù gấu áo xa ngực hơn đầu ngón
  const order = Array.from({ length: G.n }, (_, i) => i).filter((v) => isFinite(D0[v])).sort((a, b) => D0[a] - D0[b]);
  const pmax = new Float32Array(G.n);
  for (const v of order) pmax[v] = Math.max(P[v * 3 + 1], S0.par[v] >= 0 ? pmax[S0.par[v]] : -Infinity);
  const tip = {};
  for (const side of ["L", "R"]) {
    const sg = side === "L" ? -1 : 1;
    let bv = -1, bd = -1;
    for (let v = 0; v < G.n; v++) {
      const x = P[v * 3] * sg, y = P[v * 3 + 1];
      if (y < 0.3 * H || y > 0.9 * H || x < 0.1 * H || !isFinite(D0[v]) || pmax[v] < 0.66 * H) continue;
      if (D0[v] > bd) { bd = D0[v]; bv = v; }
    }
    tip[side] = bv;
  }
  // cổ: chỗ thân hẹp nhất (|x| lớn nhất của đỉnh có |x| < 0,2 H) trong 0,72–0,87 H (dưới cằm, trên vai; cao hơn là chóp mũ)
  let neckGuess = 0.865 * H, wMin = Infinity;
  for (let y = 0.72 * H; y <= 0.87 * H; y += 0.005 * H) {
    let w = 0, nz = 0;
    for (let v = 0; v < G.n; v++) { const py = P[v * 3 + 1]; if (Math.abs(py - y) > 0.004 * H) continue; const ax = Math.abs(P[v * 3]); if (ax < 0.2 * H && Math.abs(P[v * 3 + 2]) < 0.15 * H) { w = Math.max(w, ax); nz++; } }
    if (nz > 5 && w < wMin) { wMin = w; neckGuess = y; }
  }
  let nzg = 0, zg = 0; for (let v = 0; v < G.n; v++) if (Math.abs(P[v * 3 + 1] - neckGuess) < 0.01 * H && Math.abs(P[v * 3]) < 0.08 * H) { zg += P[v * 3 + 2]; nzg++; }
  const neckZg = nzg ? zg / nzg : 0;
  const j = {}, ends = {}, info = { arm: {} }, axes = [];
  for (const side of ["L", "R"]) {
    const sg = side === "L" ? -1 : 1, F = tip[side];
    if (F < 0) { warnings.push(`không thấy đầu ngón tay ${side}`); continue; }
    const DF = dijkstra(G, [F]).dist;
    // vòng đẳng khoảng cách mỗi 0,01 H: tâm, bán kính trung bình; chỉ lấy đỉnh trong vòng ≤ 0,12 H quanh đỉnh của đường đi
    const step = 0.01 * H, band = 0.006 * H, rings = [];
    // đường ngắn nhất từ đầu ngón tay về nguồn (ngực) — mốc tâm vòng
    const Dsrc = S0; const path = []; for (let v = F; v >= 0; v = Dsrc.par[v]) path.push(v);
    const pathAt = (d) => { let b = path[0]; for (const v of path) { if (DF[v] <= d) b = v; else break; } return at(b); };
    for (let k = 1; k <= 75; k++) {
      const d = k * step, c0 = pathAt(d);
      let n = 0, cx = 0, cy = 0, cz = 0; const pts = [];
      for (let v = 0; v < G.n; v++) {
        if (Math.abs(DF[v] - d) > band) continue;
        const p = at(v); if (len(sub(p, c0)) > 0.12 * H) continue;
        pts.push(p); cx += p[0]; cy += p[1]; cz += p[2]; n++;
      }
      if (n < 3) { rings.push(null); continue; }
      const c = [cx / n, cy / n, cz / n];
      let r = 0; for (const p of pts) r += len(sub(p, c)); r /= n;
      rings.push({ d, c, r, n });
    }
    // vai: đi từ đầu ngón vào, điểm trục tay đầu tiên cách trục thân (đường đứng x = 0, z = z cổ) ≤ 0,14 H mà không thấp hơn cổ quá 0,17 H
    // (khuỷu khép sát người khi đưa tay ra trước thì thấp hơn thế); lấy trục tay tới đó. Không thấy thì lấy điểm
    // trục cao nhất còn ngoài |x| ≥ 0,08 H. Cổ tay: 0,2 quãng trục từ đầu ngón; khuỷu: chỗ gập nhất trong 0,35–0,7 quãng
    // (góc giữa hai đoạn 0,05 H), gập không rõ (< 0,3 rad) thì 0,52 quãng.
    const rr = rings.filter(Boolean), dist2 = (c) => Math.hypot(c[0], c[2] - neckZg);
    let pit = -1;
    for (let k = 0; k < rr.length; k++) { const c = rr[k].c; if (rr[k].d > 0.12 * H && dist2(c) <= 0.14 * H && c[1] >= neckGuess - 0.17 * H) { pit = k; break; } }
    if (pit < 0) { let by = -Infinity; for (let k = 0; k < rr.length; k++) { const c = rr[k].c; if (Math.abs(c[0]) >= 0.08 * H && c[1] > by) { by = c[1]; pit = k; } } warnings.push(`không thấy vai ${side} theo trục thân: lấy điểm trục cao nhất`); }
    const arm = rr.slice(0, pit + 1), Ltot = arm[arm.length - 1].d;
    const ringAt = (d) => arm.reduce((b, r) => (Math.abs(r.d - d) < Math.abs(b.d - d) ? r : b), arm[0]);
    const wrist = ringAt(0.2 * Ltot).c;
    let elbowR = null, bend = 0;
    for (const r of arm) {
      if (r.d < 0.35 * Ltot || r.d > 0.7 * Ltot) continue;
      const a = ringAt(r.d - 0.05 * H).c, b = ringAt(r.d + 0.05 * H).c;
      const u = sub(r.c, a), w = sub(b, r.c), cs = (u[0] * w[0] + u[1] * w[1] + u[2] * w[2]) / (len(u) * len(w) || 1);
      const ang = Math.acos(Math.max(-1, Math.min(1, cs)));
      if (ang > bend) { bend = ang; elbowR = r; }
    }
    if (!elbowR || bend < 0.3) elbowR = ringAt(0.52 * Ltot);
    const elbow = elbowR.c, sh = arm[arm.length - 1].c.slice(), pitR = arm[arm.length - 1], tipP = at(F);
    axes.push(arm.map((r) => r.c));
    j["sh" + side] = sh; j["el" + side] = elbow; j["hand" + side] = wrist; ends["hand" + side] = tipP;
    info.rings = info.rings || {}; info.rings[side] = rings.map((r) => r ? [+(r.d / H).toFixed(2), +(r.r / H).toFixed(3), +(r.c[0] / H).toFixed(2), +(r.c[1] / H).toFixed(2), +(r.c[2] / H).toFixed(2)] : null);
    info.geo = info.geo || {};
    info.geo[side] = { DF, dHand: ringAt(0.2 * Ltot).d, dEl: elbowR.d, dSh: Ltot };
    info.arm[side] = { bend: +bend.toFixed(2), pitD: +(pitR.d / H).toFixed(3), sh: sh.map((x) => +(x / H).toFixed(3)), upper: +len(sub(elbow, sh)).toFixed(3), fore: +len(sub(wrist, elbow)).toFixed(3) };
  }
  // chân: tâm ống chân bên trái / phải ở lát 0,1–0,2 H (dưới gấu áo dài), mắt cá 0,045 H
  const shin = { L: [0, 0, 0, 0], R: [0, 0, 0, 0] };
  for (let v = 0; v < G.n; v++) {
    const y = P[v * 3 + 1]; if (y < 0.1 * H || y > 0.2 * H) continue;
    const s = P[v * 3] < 0 ? shin.L : shin.R; s[0] += P[v * 3]; s[1] += y; s[2] += P[v * 3 + 2]; s[3]++;
  }
  const hipsY = 0.484 * H;
  j.hips = [0, hipsY, 0]; j.torso = [0, hipsY + 0.02 * H, 0];
  for (const side of ["L", "R"]) {
    const s = shin[side], x = s[3] ? s[0] / s[3] : (side === "L" ? -0.06 : 0.06) * H, z = s[3] ? s[2] / s[3] : 0;
    j["hip" + side] = [x * 0.95, hipsY - 0.01 * H, 0];
    j["ankle" + side] = [x, 0.045 * H, z - 0.01 * H];
    j["knee" + side] = [x, (hipsY + 0.045 * H) / 2 + 0.01 * H, z + 0.012 * H];
    ends["ankle" + side] = [x, 0, z + 0.07 * H];
  }
  const neckY = neckGuess;
  let nz = 0, zc = 0; for (let v = 0; v < G.n; v++) if (Math.abs(P[v * 3 + 1] - neckY) < 0.01 * H && Math.abs(P[v * 3]) < 0.08 * H) { zc += P[v * 3 + 2]; nz++; }
  const neckZ = nz ? zc / nz : 0;
  j.head = [0, neckY, neckZ]; ends.head = [0, H, neckZ];
  // thân: z theo cổ (thân thẳng)
  j.hips[2] = j.torso[2] = neckZ * 0.5;
  info.neckY = +neckY.toFixed(3);
  info.weldId = G.id;
  return { j, ends, info, warnings, axes };
}
