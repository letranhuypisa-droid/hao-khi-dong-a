// design/tools/bake/landmarks.mjs — dò khớp cho mô hình người Meshy (đứng thẳng, mặt +z, hai tay đưa ra trước, dang chữ A, chữ T).
// Bộ dò cũ (game/js/riglab/autorig.js) cắt lát ngang và giả định tay dang trong mặt phẳng trán: mô hình Meshy đưa tay ra trước,
// khuỷu gập, áo dài che đáy chậu nên lát cắt không thấy nách, không thấy chân. Ở đây dò tay theo khoảng cách đo dọc mặt lưới
// (geodesic, Dijkstra trên lưới đã hàn đỉnh): đầu ngón tay là điểm xa nhất tính từ ngực trong vùng thân trên ngoài trục giữa;
// đường đẳng khoảng cách tính từ đầu ngón (giao mặt lưới với mức d, nội suy trên cạnh) tách thành từng vòng liền, lấy vòng sát
// đường ngắn nhất về ngực (ngón khác, mép ống tay rộng, vạt áo không lẫn vào): tâm vòng là trục tay. Vai: trục tay vào gần trục
// thân, hoặc vòng phình đột ngột (tay nhập thân). Khớp trên trục (armJoints): "hand" ở giữa lòng bàn tay (chỗ cầm vũ khí) cách
// đầu ngón ARM_RULE.hand; khuỷu ở chỗ gập nhất trong các điểm có tỉ lệ cánh tay / cẳng tay hợp lý, không gập rõ thì theo tỉ lệ.
// Kiểm tra độ dài (mét), thay bằng tay đối xứng hay tỉ lệ người, báo lỗi: human.mjs fitHuman. Trước đây cổ tay ở 0,2 quãng đo
// dọc mặt lưới, khuỷu ở chỗ gập nhất trong 0,35–0,7 quãng: tay xoè, ống tay rộng làm tâm vòng dừng ở bàn tay → khuỷu sát cổ tay.
// Cổ: chỗ thân hẹp nhất trong dải 0,045–0,1 H trên vai (dưới mũ: chóp mũ, sừng, mào không lọt vào; trước đây dải 0,72–0,87 H gồm cả
// mũ — khớp đầu 0,29–0,37 m trên vai, mặt và cằm theo thân); chân: tâm ống chân ở lát
// thấp (dưới gấu áo), hông theo tỉ lệ rig.
// Toạ độ vào: Float32Array xyz đã chuẩn hoá (chân y = 0, giữa x = z = 0, cao H). Trả { j, ends, info, warnings, axes }.

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
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const lerp = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];

// ---- khớp tay trên trục (thuần: game/tests/models.test.mjs kiểm) --------------------------------------------------------------
// Đơn vị H (cao chuẩn hoá thô). hand: khớp "hand" cách đầu ngón (≈ 0,11 m thô — giữa lòng bàn tay, chỗ vũ khí gắn); bendArc: nửa
// quãng đo góc gập trên trục; ratio: tỉ lệ cánh tay / cẳng tay (vai → khuỷu / khuỷu → "hand") được nhận; ratio0: tỉ lệ khi
// không thấy chỗ gập rõ (gập < bendMin rad); gập > bendMax là tâm vòng nhảy (ống tay rộng, mép áo), không phải khuỷu.
export const ARM_RULE = { hand: 0.058, bendArc: 0.05, ratio: [0.85, 1.4], ratio0: 1.1, bendMin: 0.3, bendMax: 2.0 };

// rr: trục tay [{ d, c }] từ đầu ngón vào, phần tử cuối là vai; tip: đầu ngón. Trả { sh, el, hand, dSh, dEl, dHand, bend, ratio,
// how: "gập" | "tỉ lệ" } hoặc null (trục quá ngắn). d: khoảng cách đo dọc mặt lưới từ đầu ngón (dải trọng số của human.mjs).
export function armJoints(rr, tip, H = 1.9, R = ARM_RULE) {
  const n = rr.length;
  if (n < 5) return null;
  const sh = rr[n - 1].c;
  let ih = rr.findIndex((r) => len(sub(r.c, tip)) >= R.hand * H);
  if (ih < 0 || ih > n - 4) return null;
  const hand = rr[ih].c, arc = [0];
  for (let k = 1; k < n; k++) arc.push(arc[k - 1] + len(sub(rr[k].c, rr[k - 1].c)));
  const a = R.bendArc * H;
  let best = null, near = null;
  for (let k = ih + 1; k < n - 1; k++) {
    const c = rr[k].c, up = len(sub(sh, c)), fo = len(sub(c, hand)), ratio = up / Math.max(fo, 1e-9);
    if (!near || Math.abs(Math.log(ratio / R.ratio0)) < Math.abs(Math.log(near.ratio / R.ratio0))) near = { k, ratio, bend: 0 };
    if (ratio < R.ratio[0] || ratio > R.ratio[1]) continue;
    let i = k, j = k;
    while (i > 0 && arc[k] - arc[i] < a) i--;
    while (j < n - 1 && arc[j] - arc[k] < a) j++;
    if (arc[k] - arc[i] < 0.5 * a || arc[j] - arc[k] < 0.5 * a) continue;
    const u = sub(c, rr[i].c), w = sub(rr[j].c, c), bend = Math.acos(Math.max(-1, Math.min(1, dot(u, w) / (len(u) * len(w) || 1))));
    if (bend <= R.bendMax && (!best || bend > best.bend)) best = { k, ratio, bend };
  }
  const pick = best && best.bend >= R.bendMin ? { ...best, how: "gập" } : near ? { ...near, bend: best ? best.bend : 0, how: "tỉ lệ" } : null;
  if (!pick) return null;
  return { sh, el: rr[pick.k].c, hand, dSh: rr[n - 1].d, dEl: rr[pick.k].d, dHand: rr[ih].d, bend: pick.bend, ratio: pick.ratio, how: pick.how };
}
// Tỉ lệ khuỷu f = trên / (trên + cẳng) theo đường thẳng vai → khuỷu → "hand".
export function armFrac(A) { const up = len(sub(A.sh, A.el)), fo = len(sub(A.el, A.hand)); return up / (up + fo); }
// Hai tay cùng một bộ xương nên khuỷu cùng tỉ lệ: tỉ lệ chung = trung bình f các tay theo trọng số gập² (bên gập rõ quyết định) cộng
// tỉ lệ người ratio0 (trọng số 0,09 — một tay gập yếu thì kéo nửa đường về tỉ lệ người). As: mảng kết quả armJoints (bỏ null).
export function pairFrac(As, R = ARM_RULE) {
  let sw = 0.09, sf = 0.09 * (R.ratio0 / (1 + R.ratio0));
  for (const A of As) { const w = Math.max(0.05, A.bend) ** 2; sw += w; sf += w * armFrac(A); }
  return sf / sw;
}
// Dời khuỷu tới điểm trục (giữa "hand" và vai) có tỉ lệ gần f nhất. rr: trục như armJoints.
export function moveElbow(rr, A, f) {
  let best = null;
  for (const r of rr) {
    if (r.d <= A.dHand || r.d >= A.dSh) continue;
    const up = len(sub(A.sh, r.c)), fo = len(sub(r.c, A.hand)), g = up / (up + fo);
    if (!best || Math.abs(g - f) < Math.abs(best.g - f)) best = { r, g, ratio: up / Math.max(fo, 1e-9) };
  }
  return best ? { ...A, el: best.r.c, dEl: best.r.d, ratio: best.ratio, how: A.how + " → tỉ lệ chung" } : A;
}

// ---- kiểm tay (mét, sau chuẩn hoá vai) và tay thay thế (thuần) ----------------------------------------------------------------
// Dải hợp lệ (nhân vật rig): cánh tay 0,18–0,40 (cận vệ đại đao CV_daidao đo trên lưới chỉ 0,19: vai trong giáp vai 1,45, khuỷu
// 1,275 khung thô), cẳng tay 0,18–0,34 (mọi rig, cả đại kiếm WC01: tư thế WC01 giải lại theo tay của rig — anim-wc01.js fitArms;
// trước đây rig WC01 được tới 0,37 để giữ tay 0,34 + 0,36), vai |x| 0,12–0,35 đúng phía, hai tay lệch ≤ 25%;
// game/tests/models.test.mjs kiểm đúng các dải này trên tệp nướng. Lính đám đông (ARM_KIT) rộng hơn: tay lính về khúc 0,29 + 0,29
// ở tư thế nghỉ (kit.mjs), độ dài chỉ để bắt khớp dò hỏng.
export const ARM_OK = { up: [0.18, 0.4], fore: [0.18, 0.34], shX: [0.12, 0.35], lr: 0.25 };
export const ARM_KIT = { up: [0.15, 0.42], fore: [0.15, 0.42], shX: [0.12, 0.35], lr: 0.25 };
// a: { sh, el, hand } (khung thô, x tính từ trục cổ ox); s: tỉ lệ ra mét. Trả danh sách lỗi (rỗng = hợp lệ).
export function armProblems(a, side, s, { ox = 0, ok = ARM_OK } = {}) {
  const sg = side === "L" ? -1 : 1, up = len(sub(a.sh, a.el)) * s, fo = len(sub(a.el, a.hand)) * s, x = (a.sh[0] - ox) * s;
  const out = [];
  if (!(up >= ok.up[0] && up <= ok.up[1])) out.push(`cánh tay ${up.toFixed(3)} m`);
  if (!(fo >= ok.fore[0] && fo <= ok.fore[1])) out.push(`cẳng tay ${fo.toFixed(3)} m`);
  if (!(x * sg >= ok.shX[0] && x * sg <= ok.shX[1])) out.push(`vai x ${x.toFixed(3)} m`);
  return out;
}
// Hai tay lệch nhau (tỉ lệ lớn nhất của cánh tay, cẳng tay).
export function armAsym(aL, aR) {
  const d = (p, q) => Math.abs(p - q) / Math.max(p, q, 1e-9);
  return Math.max(d(len(sub(aL.sh, aL.el)), len(sub(aR.sh, aR.el))), d(len(sub(aL.el, aL.hand)), len(sub(aR.el, aR.hand))));
}
// Tay đối xứng qua mặt x = ox.
export const mirrorArm = (a, ox = 0) => Object.fromEntries(Object.entries(a).map(([k, v]) => [k, Array.isArray(v) && v.length === 3 ? [2 * ox - v[0], v[1], v[2]] : v]));
// Trường "khoảng cách từ đầu ngón" cho tay ghi tay (catalog fix) hay tay đối xứng — đo dọc mặt lưới từ đầu ngón dò được thì lan
// sang vạt áo khi tay chạm áo: chiếu mỗi đỉnh lên chuỗi đầu ngón → "hand" → khuỷu → vai, lấy độ dài cung từ đầu ngón tới điểm
// chiếu (qua khỏi vai ≤ 0,06 H thì cộng phần vượt: dải trộn vai – thân); chỉ đỉnh trong ống quanh chuỗi và đúng phía mới thuộc tay,
// còn lại Infinity. Ống lệch: về phía thân (đỉnh ở trong trục tay theo x hơn 0,02 H) bán kính rad · H theo đoạn, các phía khác
// radOut · H (ống tay áo loe rộng — tay buông sát vạt áo thì phía trong hẹp kẻo vơ cả sườn áo). P, n: đỉnh hàn. Trả
// { DF, dHand, dEl, dSh } như geo của landmarks.
export function axialGeo(P, n, chain, side, H = 1.9, rad = [0.035, 0.04, 0.045], ox = 0, radOut = rad) {
  const sg = side === "L" ? -1 : 1, segs = [];
  let acc = 0;
  for (let i = 0; i < 3; i++) { const a = chain[i], b = chain[i + 1], ab = sub(b, a), L = len(ab); segs.push({ a, ab, L, t0: acc, r: rad[i] * H, ro: radOut[i] * H }); acc += L; }
  const DF = new Float64Array(n).fill(Infinity);
  for (let v = 0; v < n; v++) {
    const p = [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]];
    if ((p[0] - ox) * sg < 0.02 * H) continue;
    let best = Infinity, t = Infinity;
    for (let k = 0; k < 3; k++) {
      const g = segs[k], ap = sub(p, g.a), uMax = k === 2 ? 1 + 0.06 * H / g.L : 1;
      const u = Math.max(0, Math.min(uMax, dot(ap, g.ab) / (g.L * g.L))), q = [g.a[0] + g.ab[0] * u, g.a[1] + g.ab[1] * u, g.a[2] + g.ab[2] * u];
      const dd = len(sub(p, q)), r = (q[0] - p[0]) * sg > 0.02 * H ? g.r : g.ro;
      if (dd <= r && dd < best) { best = dd; t = g.t0 + u * g.L; }
    }
    DF[v] = t;
  }
  return { DF, dHand: segs[0].L, dEl: segs[0].L + segs[1].L, dSh: acc };
}

// ---- đường đẳng mức trên lưới ---------------------------------------------------------------------------------------------
// Tam giác (đỉnh hàn) + mã cạnh, dựng một lần.
function triEdges(G, index) {
  const T = [], E = new Map(), EV = [];
  const eid = (u, w) => { const k = u < w ? u * G.n + w : w * G.n + u; let e = E.get(k); if (e === undefined) { e = EV.length / 2; E.set(k, e); EV.push(u, w); } return e; };
  for (let t = 0; t < index.length; t += 3) {
    const a = G.id[index[t]], b = G.id[index[t + 1]], c = G.id[index[t + 2]];
    if (a === b || b === c || c === a) continue;
    T.push(a, b, c, eid(a, b), eid(b, c), eid(c, a));
  }
  return { T: Int32Array.from(T), EV: Int32Array.from(EV), nE: EV.length / 2 };
}
// Đường mức DF = d: mỗi tam giác cắt mức cho một đoạn (hai điểm trên hai cạnh), đoạn chung cạnh nối thành vòng (hợp nhất theo
// cạnh). Trả các vòng { c (tâm, trọng số theo độ dài đoạn), r (bán kính trung bình), L (chu vi), near (gần q nhất) }.
function isoRings(TE, P, DF, d, q, uf) {
  const { T, EV } = TE, segs = [];
  const find = (e) => { while (uf.p[e] !== e) { uf.p[e] = uf.p[uf.p[e]]; e = uf.p[e]; } return e; };
  const touch = (e) => { if (uf.s[e] !== uf.stamp) { uf.s[e] = uf.stamp; uf.p[e] = e; } };
  const cross = (e) => {
    const u = EV[e * 2], w = EV[e * 2 + 1], du = DF[u], dw = DF[w];
    const t = isFinite(du) && isFinite(dw) ? (d - du) / (dw - du) : isFinite(du) ? 0 : 1;
    return lerp([P[u * 3], P[u * 3 + 1], P[u * 3 + 2]], [P[w * 3], P[w * 3 + 1], P[w * 3 + 2]], Math.max(0, Math.min(1, t)));
  };
  uf.stamp++;
  for (let t = 0; t < T.length; t += 6) {
    const s0 = DF[T[t]] > d, s1 = DF[T[t + 1]] > d, s2 = DF[T[t + 2]] > d;
    if (s0 === s1 && s1 === s2) continue;
    const es = []; if (s0 !== s1) es.push(T[t + 3]); if (s1 !== s2) es.push(T[t + 4]); if (s2 !== s0) es.push(T[t + 5]);
    const e1 = es[0], e2 = es[1]; touch(e1); touch(e2);
    const r1 = find(e1), r2 = find(e2); if (r1 !== r2) uf.p[r1] = r2;
    segs.push(e1, e2);
  }
  const comp = new Map(), pts = [];
  for (let i = 0; i < segs.length; i += 2) {
    const p1 = cross(segs[i]), p2 = cross(segs[i + 1]), L = len(sub(p1, p2)), m = lerp(p1, p2, 0.5), r = find(segs[i]);
    let o = comp.get(r); if (!o) { o = { sx: 0, sy: 0, sz: 0, L: 0, near: Infinity, segs: [] }; comp.set(r, o); }
    o.sx += m[0] * L; o.sy += m[1] * L; o.sz += m[2] * L; o.L += L; o.near = Math.min(o.near, len(sub(p1, q)), len(sub(p2, q))); o.segs.push(m, L);
  }
  const out = [];
  for (const o of comp.values()) {
    if (o.L <= 0) continue;
    const c = [o.sx / o.L, o.sy / o.L, o.sz / o.L];
    let r = 0; for (let i = 0; i < o.segs.length; i += 2) r += len(sub(o.segs[i], c)) * o.segs[i + 1];
    out.push({ c, r: r / o.L, L: o.L, near: o.near });
  }
  return out;
}

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
  // đầu ngón: điểm có √(đo dọc mặt lưới × khoảng cách thẳng) tới ngực lớn nhất — góc ống tay rộng rủ xuống, vạt áo, cổ áo lông
  // xa ngực theo mặt lưới nhưng gần theo đường thẳng; đường từ ngực tới phải lên ≥ 0,66 H (qua vai) hoặc điểm ở trên 0,5 H (tay
  // dang ngang thấp: đường men dưới cánh tay không lên tới vai)
  const tip = {}, srcP = at(src);
  for (const side of ["L", "R"]) {
    const sg = side === "L" ? -1 : 1;
    let bv = -1, bd = -1;
    for (let v = 0; v < G.n; v++) {
      const x = P[v * 3] * sg, y = P[v * 3 + 1];
      if (y < 0.3 * H || y > 0.9 * H || x < 0.1 * H || !isFinite(D0[v]) || (pmax[v] < 0.66 * H && y < 0.5 * H)) continue;
      const sc = Math.sqrt(D0[v] * len(sub(at(v), srcP)));
      if (sc > bd) { bd = sc; bv = v; }
    }
    tip[side] = bv;
  }
  // cổ (ước lượng thô, để dò vai): chỗ thân hẹp nhất (|x| lớn nhất của đỉnh có |x| < 0,2 H) trong 0,72–0,87 H; chỉnh lại theo vai ở dưới
  const widthAt = (y, zc) => {
    let w = 0, nz = 0;
    for (let v = 0; v < G.n; v++) { const py = P[v * 3 + 1]; if (Math.abs(py - y) > 0.004 * H) continue; const ax = Math.abs(P[v * 3]); if (ax < 0.2 * H && Math.abs(P[v * 3 + 2] - zc) < 0.15 * H) { w = Math.max(w, ax); nz++; } }
    return nz > 5 ? w : Infinity;
  };
  const zAt = (y) => { let n = 0, z = 0; for (let v = 0; v < G.n; v++) if (Math.abs(P[v * 3 + 1] - y) < 0.01 * H && Math.abs(P[v * 3]) < 0.08 * H) { z += P[v * 3 + 2]; n++; } return n ? z / n : 0; };
  let neckGuess = 0.865 * H, wMin = Infinity;
  for (let y = 0.72 * H; y <= 0.87 * H; y += 0.005 * H) { const w = widthAt(y, 0); if (w < wMin) { wMin = w; neckGuess = y; } }
  const neckZg = zAt(neckGuess);
  const j = {}, ends = {}, info = { arm: {}, geo: {}, rings: {} }, axes = [];
  const TE = triEdges(G, index), uf = { p: new Int32Array(TE.nE), s: new Int32Array(TE.nE), stamp: 0 };
  for (const side of ["L", "R"]) {
    const sg = side === "L" ? -1 : 1, F = tip[side];
    if (F < 0) { warnings.push(`không thấy đầu ngón tay ${side}`); info.arm[side] = { ok: false, why: "không thấy đầu ngón" }; continue; }
    const DF = dijkstra(G, [F]).dist, tipP = at(F);
    // đường ngắn nhất từ đầu ngón về nguồn (ngực): mốc chọn vòng ở mỗi mức
    const path = []; for (let v = F; v >= 0; v = S0.par[v]) path.push(v);
    const pathAt = (d) => { let b = path[0]; for (const v of path) { if (DF[v] <= d) b = v; else break; } return at(b); };
    const step = 0.01 * H, rings = [];
    for (let k = 1; k <= 75; k++) {
      const d = k * step, q = pathAt(d), rs = isoRings(TE, P, DF, d, q, uf);
      let r0 = null; for (const r of rs) if (!r0 || r.near < r0.near) r0 = r;
      rings.push(r0 && r0.near < 0.04 * H ? { d, c: r0.c, r: r0.r, n: rs.length } : null);
    }
    // khúc thiếu vòng (lưới thủng, vòng vỡ vụn) ≤ 8 mức giữa hai vòng có: nội suy thẳng (điểm khuỷu có thể nằm trong khúc đó)
    for (let a = 0; a < rings.length; a++) {
      if (!rings[a] || rings[a + 1]) continue;
      let b = a + 1; while (b < rings.length && !rings[b]) b++;
      if (b >= rings.length || b - a > 9) continue;
      for (let k = a + 1; k < b; k++) { const u = (k - a) / (b - a); rings[k] = { d: (k + 1) * step, c: lerp(rings[a].c, rings[b].c, u), r: rings[a].r + (rings[b].r - rings[a].r) * u, n: 0 }; }
    }
    // vai: vai là chỗ cao nhất của trục tay cạnh thân. Điểm trục ứng viên: quãng ≥ 0,15 H, vòng còn nhỏ (< 0,08 H: chưa nhập
    // thân), |x| 0,06–0,19 H đúng phía, cách trục thân (đường đứng x = 0, z = z cổ) ≤ 0,16 H; vai = ứng viên đầu tiên (đi từ
    // đầu ngón vào) không thấp hơn ứng viên cao nhất quá 0,02 H (khuỷu khép sát người khi đưa tay ra trước thấp hơn thế; tay dang
    // ngang thì trục gần như phẳng, điểm sát đỉnh là chỗ tay vào thân, không phải giữa cánh tay). Không có ứng viên: vòng ngay
    // trước chỗ vòng phình đột ngột (bán kính > 2,2 lần trung vị các vòng trước và > 0,075 H: tay nhập thân).
    const rr = rings.filter(Boolean), axisD = (c) => Math.hypot(c[0], c[2] - neckZg);
    const cand = (r) => r.d > 0.15 * H && r.r < 0.08 * H && r.c[0] * sg >= 0.06 * H && r.c[0] * sg <= 0.19 * H && axisD(r.c) <= 0.16 * H;
    let pitA = -1, pitB = -1, yTop = -Infinity;
    for (const r of rr) if (cand(r)) yTop = Math.max(yTop, r.c[1]);
    for (let k = 0; k < rr.length; k++) if (cand(rr[k]) && rr[k].c[1] >= yTop - 0.02 * H) { pitA = k; break; }
    for (let k = 1; k < rr.length && pitA < 0; k++) {
      if (rr[k].d <= 0.15 * H) continue;
      const prev = rr.slice(0, k).filter((r) => r.d > 0.04 * H).map((r) => r.r).sort((a, b) => a - b);
      if (prev.length < 4) continue;
      const med = prev[prev.length >> 1];
      if (rr[k].r > 2.2 * med && rr[k].r > 0.075 * H) { pitB = k - 1; break; }
    }
    const pit = pitA >= 0 ? pitA : pitB;
    const pitHow = pit < 0 ? "không thấy" : pit === pitA ? "đỉnh trục" : "vòng phình";
    const arm = pit >= 0 ? rr.slice(0, pit + 1) : [];
    const A = arm.length ? armJoints(arm, tipP, H) : null;
    info.rings[side] = rings.map((r) => r ? [+(r.d / H).toFixed(2), +(r.r / H).toFixed(3), +(r.c[0] / H).toFixed(3), +(r.c[1] / H).toFixed(3), +(r.c[2] / H).toFixed(3), r.n] : null);
    ends["hand" + side] = tipP;
    if (!A) { warnings.push(`tay ${side}: trục tay hỏng (vai ${pitHow})`); info.arm[side] = { ok: false, why: `trục tay hỏng (vai ${pitHow})`, tip: tipP, axis: rr.map((r) => r.c) }; continue; }
    // vai hợp lý: |x| 0,06–0,19 H, cao 0,62–0,8 H (mẫu hiện có 0,654–0,763 H; trước đây 0,6–0,85); đầu ngón cách vai ≥ 0,2 H
    const shOk = Math.abs(A.sh[0]) >= 0.06 * H && Math.abs(A.sh[0]) <= 0.19 * H && A.sh[0] * sg > 0 && A.sh[1] >= 0.62 * H && A.sh[1] <= 0.8 * H;
    const tipOk = len(sub(tipP, A.sh)) >= 0.2 * H;
    axes.push(arm.map((r) => r.c));
    info.geo[side] = { DF };
    info.arm[side] = { ok: shOk && tipOk, why: !shOk ? `vai ${side} lệch (${A.sh.map((x) => (x / H).toFixed(2)).join(", ")} H)` : !tipOk ? `đầu ngón ${side} sát vai` : "",
      A, pit: pitHow, tip: tipP, axis: arm.map((r) => r.c), rings: arm };
  }
  // khuỷu hai tay cùng tỉ lệ (pairFrac): tay nào lệch tỉ lệ chung quá 0,05 thì dời khuỷu
  const okArms = ["L", "R"].filter((s) => info.arm[s] && info.arm[s].ok);
  const fStar = pairFrac(okArms.map((s) => info.arm[s].A));
  for (const side of ["L", "R"]) {
    const a = info.arm[side]; if (!a || !a.A) continue;
    if (a.ok && Math.abs(armFrac(a.A) - fStar) > 0.05) a.A = moveElbow(a.rings, a.A, fStar);
    const A = a.A;
    j["sh" + side] = A.sh; j["el" + side] = A.el; j["hand" + side] = A.hand;
    Object.assign(info.geo[side], { dHand: A.dHand, dEl: A.dEl, dSh: A.dSh });
    Object.assign(a, { how: A.how, bend: +A.bend.toFixed(2), ratio: +A.ratio.toFixed(2) });
  }
  info.frac = +fStar.toFixed(3);
  // cổ: chỗ thân hẹp nhất trong dải 0,045–0,1 H trên vai (khớp đầu ở gốc cổ, dưới mũ); cổ áo cao che cổ thì mặt có khi hẹp hơn
  // cổ — lấy điểm thấp nhất có bề ngang trong 0,006 H của chỗ hẹp nhất. Không có vai hợp lý thì giữ ước lượng thô, không cao quá 0,8 H.
  let neckY = Math.min(neckGuess, 0.8 * H);
  const shs = ["L", "R"].filter((s) => info.arm[s] && info.arm[s].ok).map((s) => info.arm[s].A.sh[1]);
  if (shs.length) {
    const shY = shs.reduce((a, b) => a + b, 0) / shs.length, prof = [];
    for (let y = shY + 0.045 * H; y <= shY + 0.1 * H + 1e-9; y += 0.0025 * H) prof.push([y, widthAt(y, neckZg)]);
    const wMin2 = Math.min(...prof.map((p) => p[1]));
    neckY = isFinite(wMin2) ? prof.find((p) => p[1] <= wMin2 + 0.006 * H)[0] : shY + 0.07 * H;
    info.neckWin = [+(shY / H + 0.045).toFixed(3), +(shY / H + 0.1).toFixed(3)];
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
  const neckZ = zAt(neckY);
  j.head = [0, neckY, neckZ]; ends.head = [0, H, neckZ];
  // thân: z theo cổ (thân thẳng)
  j.hips[2] = j.torso[2] = neckZ * 0.5;
  info.neckY = +neckY.toFixed(3); info.neckGuess = +neckGuess.toFixed(3);
  info.weldId = G.id; info.weld = G;
  return { j, ends, info, warnings, axes };
}
