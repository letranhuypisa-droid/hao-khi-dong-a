// battle/kit.js — bộ dựng hình dùng chung cho cảnh các trận (bản chép từ battle/scenery.js, không dời: scenery.js của
// B15 giữ nguyên để B15 không đổi một điểm ảnh). Khối đơn vị, thanh A → B (rod, bar), lá cờ, InstancedMesh có put(),
// va chạm tròn, cây / lau / đá, núi xa và mây (addSkyKit: có radMul cho núi đá vôi dốc đứng), cột đá vôi (karstGeo),
// lô cờ vải bay trong một lượt vẽ (flagBatch).
//
// Mọi thứ ở đây không đọc dữ liệu trận nào (không import battle-b15/b20): trận nào cũng dùng được.

import * as THREE from "three";
import { merge, part } from "./models.js";

export const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
export const cyl = (rt, rb, h, s = 6) => new THREE.CylinderGeometry(rt, rb, h, s);
export const cone = (r, h, s = 6) => new THREE.ConeGeometry(r, h, s);
export const ico = (r, d = 0) => new THREE.IcosahedronGeometry(r, d);
export const blade = (r, h) => new THREE.ConeGeometry(r, h, 3, 1, true);      // lá cỏ, lau: nón hở đáy, 3 tam giác
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler(), _c = new THREE.Color();

// ---- khối đơn vị: dựng dọc +y từ 0 tới 1, kéo thành thanh giữa hai điểm -------------------------------------------
const _up = new THREE.Vector3(0, 1, 0), _X = new THREE.Vector3(), _Y = new THREE.Vector3(), _Z = new THREE.Vector3(), _T = new THREE.Vector3();
const _M = new THREE.Matrix4();
const UNIT = {};
// "box" hộp; "c5" / "o5" trụ 5 cạnh kín / hở hai đầu; "t5" nón hở đáy (đầu cọc vót)
export const unit = (k) => UNIT[k] || (UNIT[k] = (k === "box" ? box(1, 1, 1) : k[0] === "t" ? new THREE.ConeGeometry(1, 1, +k.slice(1), 1, true)
  : new THREE.CylinderGeometry(1, 1, 1, +k.slice(1), 1, k[0] === "o")).translate(0, 0.5, 0));
// Ma trận đưa khối đơn vị thành thanh A → B: ngang sx (trục x luôn nằm ngang), dày sz; roll xoay quanh trục thanh.
// Trả về ma trận dùng chung (chép ra nếu cần giữ).
export function spanM(ax, ay, az, bx, by, bz, sx, sz, roll = 0) {
  _Y.set(bx - ax, by - ay, bz - az); const L = _Y.length(); _Y.multiplyScalar(1 / L);
  _X.crossVectors(_Y, _up); if (_X.lengthSq() < 1e-8) _X.set(1, 0, 0); _X.normalize();
  _Z.crossVectors(_X, _Y);
  if (roll) { const c = Math.cos(roll), s = Math.sin(roll); _T.copy(_X).multiplyScalar(c).addScaledVector(_Z, s); _Z.multiplyScalar(c).addScaledVector(_X, -s); _X.copy(_T); }
  return _M.makeBasis(_X, _Y, _Z).scale(_s.set(sx, L, sz)).setPosition(ax, ay, az);
}
// Cọc, cán, sào: thân trụ bán kính r từ A tới B; tip > 0 thì vót nhọn đoạn cuối dài tip (màu tipCol)
export function rod(out, col, ax, ay, az, bx, by, bz, r, { sides = 5, tip = 0, tipCol = col, cap = false } = {}) {
  const L = Math.hypot(bx - ax, by - ay, bz - az); if (L < 1e-3) return;
  const k = Math.max(0, L - tip) / L, mx = ax + (bx - ax) * k, my = ay + (by - ay) * k, mz = az + (bz - az) * k;
  if (k > 0.01) out.push(part(unit((cap ? "c" : "o") + sides), col).applyMatrix4(spanM(ax, ay, az, mx, my, mz, r, r)));
  if (tip > 0) out.push(part(unit("t" + sides), tipCol).applyMatrix4(spanM(mx, my, mz, bx, by, bz, r, r)));
}
// Ván, nẹp, thanh rào: hộp A → B rộng w (nằm ngang), dày t
export const bar = (out, col, ax, ay, az, bx, by, bz, w, t, roll = 0) => out.push(part(unit("box"), col).applyMatrix4(spanM(ax, ay, az, bx, by, bz, w, t, roll)));
// Lá cờ phẳng có bề dày (hai mặt đều thấy) từ đa giác [x, y]; gốc ở mép cán, vải rủ theo −y
export function flagShape(pts) {
  const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  return new THREE.ExtrudeGeometry(s, { depth: 0.025, bevelEnabled: false });
}
// Cụm dựng sẵn (mảng part) → một geometry đặt tại (x, y, z), quay ry
export function placeParts(parts, x, y, z, ry = 0) {
  const g = merge(parts);
  return g.applyMatrix4(new THREE.Matrix4().compose(_v.set(x, y, z), _q.setFromEuler(_e.set(0, ry, 0)), _s.set(1, 1, 1)));
}
// Tô màu đỉnh theo độ cao cục bộ: fn(y) → màu hex (geometry không chỉ mục, đã có "color" từ part)
export function colorByY(g, fn) {
  const p = g.attributes.position, c = g.attributes.color;
  for (let i = 0; i < p.count; i++) { _c.set(fn(p.getY(i))); c.setXYZ(i, _c.r, _c.g, _c.b); }
  return g;
}

// ---- InstancedMesh có put() (như scenery.js) ------------------------------------------------------------------------
// cap: số chỗ dùng cho phần rải ngẫu nhiên; put(x, y, z, ry, s, sy, màu, rx, rz) → false khi đầy.
export function makeInst(scene, mat, shadows) {
  return (geo, n, { cast = false, material = mat, cap = n, receive = true } = {}) => {
    const im = new THREE.InstancedMesh(geo, material, Math.max(1, n));
    im.castShadow = cast && shadows; im.receiveShadow = receive; im.count = 0; im.cap = cap; im.max = n; scene.add(im);
    im.put = (x, y, z, ry = 0, s = 1, sy = s, color = null, rx = 0, rz = 0, sz = s) => {
      if (im.count >= im.cap) return false;
      _m.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(s, sy, sz));
      im.setMatrixAt(im.count, _m);
      if (color !== null) { if (!im.instanceColor) im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, n) * 3).fill(1), 3); im.setColorAt(im.count, _c.set(color)); }
      im.count++; return true;
    };
    im.done = () => { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.computeBoundingSphere(); return im; };
    return im;
  };
}
// Va chạm tròn tại (x, z) bán kính r (đoạn suy biến, cùng dạng world.colliders của ground.js)
export const solidAdder = (world) => (x, z, r) => world.colliders.push({ x0: x, z0: z, x1: x + 0.01, z1: z, r });

// ---- cây, lau, đá -------------------------------------------------------------------------------------------------
// Cây tán tròn (như world.js treeGeo): thân nâu, hai khối tán xanh — nhân instanceColor để đa dạng (tintTrees).
export const treeGeo = (P = part) => merge([
  P(new THREE.CylinderGeometry(0.18, 0.28, 2.6, 5), 0x4a3524, { y: 1.3 }),
  P(ico(1.6, 0), 0x4f6a32, { y: 3.4 }),
  P(ico(1.1, 0), 0x5e7a3a, { y: 4.6, x: 0.3 }),
]);
// Khóm cây rừng ven sông: hai thân, ba tán lệch nhau (một chỗ instanced trông như lùm 2–3 cây, ~80 tam giác)
export const groveGeo = () => merge([
  part(new THREE.CylinderGeometry(0.16, 0.26, 3.2, 5, 1, true), 0x4a3524, { y: 1.5 }),
  part(new THREE.CylinderGeometry(0.12, 0.2, 2.4, 5, 1, true), 0x4a3524, { x: 1.9, y: 1.1, z: 0.8, rz: -0.1 }),
  part(ico(1.9, 0), 0x4f6a32, { y: 4.0, sy: 0.85 }),
  part(ico(1.4, 0), 0x5e7a3a, { x: 0.5, y: 5.3, z: -0.3, sy: 0.85 }),
  part(ico(1.5, 0), 0x55713a, { x: 2.0, y: 3.2, z: 0.9, sy: 0.8 }),
]);
// Khóm lau sậy: n lá nón hở (3 tam giác mỗi lá), màu trắng để instanceColor quyết định
export const reedGeo = (n = 4, h = 1.7) => merge(Array.from({ length: n }, (_, k) => part(blade(0.07, h), 0xffffff,
  { x: Math.cos(k * 2.4) * 0.22, y: h / 2, z: Math.sin(k * 2.4) * 0.22, rx: Math.sin(k * 2.4) * 0.16, rz: -Math.cos(k * 2.4) * 0.16, sy: 0.8 + (k % 3) * 0.15 })));
// Tảng đá: khối hai mươi mặt dẹt (màu trắng, instanceColor tô)
export const rockGeo = () => merge([part(ico(1, 0), 0xffffff, { sy: 0.65 })]);
// Màu mẫu nướng (glb.js envPart) nhân lên cho trung bình kênh ≈ k: lưới code của InstancedMesh tô trắng, sắc từng bản do instanceColor; mẫu giữ vân
// của nó (chép từ scenery.js). null → null.
export function whiten(g, k = 0.85) {
  if (!g) return g;
  const C = g.attributes.color.array; let m = 0;
  for (let i = 0; i < C.length; i++) m += C[i];
  m = m / C.length || 1;
  for (let i = 0; i < C.length; i++) C[i] = Math.min(1, C[i] * k / m);
  return g;
}

// Màu thân cây đa dạng cho rừng instanced (xanh đậm, xanh vàng, vài cây ngả vàng, đỏ) — chép từ scenery.js.
export function tintTrees(im, rng) {
  const col = new THREE.Color();
  if (!im.instanceColor) im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, im.max ?? im.count) * 3).fill(1), 3);
  for (let i = 0; i < im.count; i++) {
    const r = rng.next();
    if (r < 0.07) col.setHSL(0.09 + rng.range(0, 0.04), 0.55, 0.55);          // cây ngả vàng
    else if (r < 0.1) col.setHSL(0.02, 0.45, 0.5);                          // gạo đỏ
    else col.setHSL(0.24 + rng.range(-0.05, 0.05), 0.35 + rng.range(0, 0.2), 0.62 + rng.range(-0.12, 0.12));
    im.setColorAt(i, col);
  }
  im.instanceColor.needsUpdate = true;
}

// ---- cột đá vôi (karst) ------------------------------------------------------------------------------------------------
// Mặt tròn xoay gồ ghề bán kính đơn vị: chân chôn sâu (y −1,2), thân dựng đứng tới y ≈ h, vai tròn, đỉnh vòm; notch: hàm
// ếch ngấn nước (khoét vào quanh y 0,08–0,32, mép trên nhô ra như đảo đá Hạ Long). Mặt nằm (pháp tuyến y > 0,5) và
// vòng trên cùng phủ cây xanh, vách đá xám có vệt chảy sẫm theo cột, chân sẫm ướt. Thêm vài bụi cây trên đỉnh, gờ.
// twin: ghép thêm một cột phụ (khối núi hai đỉnh). ~250–300 tam giác (twin ~550). Màu đỉnh đã có sẵn, instanceColor
// (gần trắng) chỉ để chỉnh sắc từng cột.
const KROCK = [0xa7a295, 0x958f82, 0xb3ad9f, 0x87827a], KGREEN = [0x4e6a34, 0x5c7a3c, 0x466030, 0x6a843f];
export function karstGeo({ seed = 1, h = 3.2, segs = 9, notch = false, twin = false } = {}) {
  let a = seed >>> 0;
  const rnd = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const column = (ox, oz, sc, hh) => {
    const prof = [[-1.2, 1.1], [-0.1, 1.0]];
    if (notch) prof.push([0.06, 0.84], [0.2, 0.74], [0.34, 1.04]); else prof.push([0.3, 1.0]);
    // gờ đá giữa vách (một nửa số cột): vòng nhô ra rồi thụt vào — mặt trên gờ phủ cây
    const ledge = rnd() < 0.5, ly = 0.4 + rnd() * 0.25;
    // vách gần dựng đứng tới ~85% rồi mới bo vai, đỉnh bằng gồ ghề (không thành quả trứng)
    if (ledge) prof.push([0.34 * hh, 0.97], [ly * hh, 1.03], [(ly + 0.04) * hh, 0.86], [0.78 * hh, 0.85], [0.9 * hh, 0.75], [0.97 * hh, 0.54], [hh, 0.3]);
    else prof.push([0.34 * hh, 0.97], [0.55 * hh, 0.95], [0.75 * hh, 0.92], [0.88 * hh, 0.83], [0.96 * hh, 0.62], [hh, 0.34]);
    const cols = [], streak = [];
    for (let i = 0; i < segs; i++) streak.push(rnd());
    let lx = 0, lz = 0;
    const lean = [(rnd() - 0.5) * 0.05, (rnd() - 0.5) * 0.05];
    for (let r = 0; r < prof.length; r++) {
      const [y, rad] = prof[r];
      if (y > 0.3) { lx += lean[0] + (rnd() - 0.5) * 0.06; lz += lean[1] + (rnd() - 0.5) * 0.06; }
      const ring = [];
      for (let i = 0; i < segs; i++) {
        const ang = (i + (rnd() - 0.5) * 0.35) / segs * Math.PI * 2, rr = rad * (1 + (rnd() - 0.5) * (y > 0.3 ? 0.34 : 0.12));
        ring.push([ox + (Math.cos(ang) * rr + lx) * sc, y * sc, oz + (Math.sin(ang) * rr + lz) * sc]);
      }
      cols.push(ring);
    }
    const top = [ox + lx * sc, (hh + 0.03 + rnd() * 0.08) * sc, oz + lz * sc];
    return { cols, top, streak, hh: hh * sc };
  };
  const pos = [], col = [];
  const tri = (p, q, r, c) => { pos.push(...p, ...q, ...r); for (let k = 0; k < 3; k++) col.push(c.r, c.g, c.b); };
  const faceCol = (p, q, r, colIdx, C, hh) => {
    const ux = q[0] - p[0], uy = q[1] - p[1], uz = q[2] - p[2], vx = r[0] - p[0], vy = r[1] - p[1], vz = r[2] - p[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, ln = Math.hypot(nx, ny, nz) || 1;
    const y = (p[1] + q[1] + r[1]) / 3, ky = y / hh;
    if (ny / ln > 0.5 || (ky > 0.86 && rnd() < 0.75) || (ky > 0.45 && ny / ln > 0.25 && rnd() < 0.6)) return _c.set(KGREEN[(rnd() * KGREEN.length) | 0]);
    _c.set(KROCK[(rnd() * KROCK.length) | 0]);
    if (C.streak[colIdx] < 0.3) _c.multiplyScalar(0.78);                          // vệt nước chảy sẫm theo cột
    if (y < 0.4) _c.lerp(_c2.set(0x4a463c), 0.55);                              // chân ướt, hàm ếch (y đơn vị bán kính)
    return _c;
  };
  const _c2 = new THREE.Color();
  const build = (C, green) => {
    const R = C.cols, n = segs;
    for (let r = 0; r + 1 < R.length; r++) for (let i = 0; i < n; i++) {
      const a0 = R[r][i], a1 = R[r][(i + 1) % n], b0 = R[r + 1][i], b1 = R[r + 1][(i + 1) % n];
      tri(a0, b0, a1, faceCol(a0, b0, a1, i, C, C.hh).clone()); tri(a1, b0, b1, faceCol(a1, b0, b1, i, C, C.hh).clone());
    }
    const T = R[R.length - 1];
    for (let i = 0; i < n; i++) tri(T[i], C.top, T[(i + 1) % n], _c.set(KGREEN[(rnd() * KGREEN.length) | 0]).clone());
    // bụi cây trên đỉnh, trên vai và một gờ giữa vách
    for (let k = 0; k < green; k++) {
      const ring = k < 3 ? T : R[Math.max(3, Math.floor(R.length * 0.55))], p = ring[(rnd() * n) | 0];
      const g = part(ico(k < 3 ? 0.3 + rnd() * 0.14 : 0.16 + rnd() * 0.06, 0), KGREEN[k % KGREEN.length],
        { x: p[0], y: p[1] + (k < 3 ? 0.02 : 0), z: p[2], sy: 0.7, ry: rnd() * 6 });
      const gp = g.attributes.position.array, gc = g.attributes.color.array;
      for (let j = 0; j < gp.length; j++) { pos.push(gp[j]); col.push(gc[j]); }
    }
  };
  build(column(0, 0, 1, h), 4);
  if (twin) build(column(0.95, 0.35, 0.72, h * 1.35), 3);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

// ---- núi xa và mây (ngoài sương: màu đã pha sẵn khói xa) — bản mở rộng của addSky trong scenery.js --------------------
// ridges: [tâm x, tâm z, số núi, độ trải, cao min, cao max, màu, (tuỳ chọn) {radMul:[a,b], shape, spreadZ, sink}].
//   radMul: bán kính chân = cao × [a, b] (scenery.js: 2,2–3,4 núi đất; đá vôi dốc đứng ~0,35–0,7).
//   shape "cone" (nón như cũ) | "karst" (trụ vai tròn, đỉnh bằng gồ ghề — dáng đảo đá vôi).
// clouds: vùng mây trôi theo trục x ({x0, span, z, n, zc?, y0?, y1?, detail?}). keepOut {x0, x1, z0, z1, pad}: chân núi cách vùng chơi ít nhất pad m.
// extra: { geo, tone } lưới núi dựng sẵn (không chỉ số, có position, normal, color — vd. mẫu nướng ENV_day_nui_xa qua glb.js envPart) gộp thêm vào
// cùng lưới núi xa (không thêm lượt vẽ); tô như núi code: sắc tone theo độ sáng màu mẫu, bóng giả theo pháp tuyến mặt (vật liệu không chiếu sáng),
// trộn về màu chân trời haze.
// Không tự đẩy vào world.animated: trả { hills, clouds, update(t), dispose() } để trận gọi update mỗi khung.
export function addSkyKit(scene, rng, ridges, clouds = { x0: -500, span: 1600, z: 600, n: 14 }, keepOut = null, { horizon = 0xe8c894, extra = [], haze = 0.22 } = {}) {
  const far = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
  const hills = [];
  const HORIZ = new THREE.Color(horizon);
  const ridge = (cx, cz, n, spread, hMin, hMax, tone, o = {}) => {
    const rm = o.radMul || [2.2, 3.4], shape = o.shape || "cone", sz = o.spreadZ ?? spread * 0.3, sink = o.sink ?? 8;
    for (let k = 0; k < n; k++) {
      let x = cx + rng.range(-spread, spread), z = cz + rng.range(-sz, sz);
      const h = rng.range(hMin, hMax);
      const base = new THREE.Color(tone).lerp(HORIZ, rng.range(0.12, 0.3));
      const rad = h * rng.range(rm[0], rm[1]);
      if (keepOut) {                         // đẩy chân núi ra khỏi vùng chơi, theo hướng từ tâm vùng ra ngoài
        const K = keepOut, mx = (K.x0 + K.x1) / 2, mz = (K.z0 + K.z1) / 2;
        let dx = x - mx, dz = z - mz; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
        for (let it = 0; it < 200; it++) {
          const nx = Math.max(K.x0, Math.min(K.x1, x)), nz = Math.max(K.z0, Math.min(K.z1, z));
          const inside = nx === x && nz === z;
          if (!inside && Math.hypot(x - nx, z - nz) >= rad + K.pad) break;
          x += dx * 10; z += dz * 10;
        }
      }
      let g;
      if (shape === "karst") {
        // trụ 7 cạnh, 3 tầng: chân rộng, vai co lại, đỉnh gồ ghề (đỉnh lệch cao thấp) — ~42 tam giác
        const s = rng.int(6, 8);
        g = new THREE.CylinderGeometry(rad * 0.55, rad, h, s, 3, false);
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const y = p.getY(i) / h + 0.5, k = y > 0.99 ? 0.55 + rng.range(-0.1, 0.25) : y > 0.6 ? 1.02 + rng.range(-0.08, 0.1) : 1;
          const bump = y > 0.99 ? rng.range(-0.08, 0.06) * h : 0;
          p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); p.setY(i, p.getY(i) + bump);
        }
        g = g.toNonIndexed();
      } else g = new THREE.ConeGeometry(rad, h, rng.int(5, 7)).toNonIndexed();
      const pos = g.attributes.position, cols = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) { const k2 = pos.getY(i) / h + 0.5; _c.copy(base).multiplyScalar(0.85 + 0.25 * k2); cols.set([_c.r, _c.g, _c.b], i * 3); }
      g.setAttribute("color", new THREE.BufferAttribute(cols, 3)); g.translate(x, h / 2 - sink, z);
      g.deleteAttribute("uv"); g.deleteAttribute("normal"); g.computeVertexNormals(); hills.push(g);
    }
  };
  for (const r of ridges) ridge(...r);
  for (const { geo: g, tone } of extra) {
    if (!g) continue;
    const N = g.attributes.normal.array, C = g.attributes.color.array, T = new THREE.Color(tone);
    for (let i = 0; i < C.length; i += 3) {
      const sh = (0.85 + 0.2 * Math.min(1, 0.3 * C[i] + 0.59 * C[i + 1] + 0.11 * C[i + 2])) * (0.8 + 0.25 * Math.max(0, -0.5 * N[i] + 0.8 * N[i + 1] + 0.33 * N[i + 2]));
      _c.copy(T).multiplyScalar(sh).lerp(HORIZ, haze); C[i] = _c.r; C[i + 1] = _c.g; C[i + 2] = _c.b;
    }
    hills.push(g);
  }
  const hm = new THREE.Mesh(merge(hills), far); hm.name = "far-ridges"; scene.add(hm);
  const cd = clouds.detail ?? 1;                                                  // 0: mây khối thô (60 tam giác)
  const cloudGeo = merge([part(ico(14, cd), 0xf4ead6, { sy: 0.45 }), part(ico(10, cd), 0xefe2c8, { x: 13, y: -1, sy: 0.45 }), part(ico(9, cd), 0xf8f0e0, { x: -12, y: -2, z: 4, sy: 0.4 })]);
  const cm = new THREE.InstancedMesh(cloudGeo, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, transparent: true, opacity: 0.85 }), clouds.n);
  cm.name = "clouds"; cm.frustumCulled = false;
  const cl = [];
  for (let k = 0; k < clouds.n; k++) cl.push({ x: rng.range(clouds.x0, clouds.x0 + clouds.span), y: rng.range(clouds.y0 ?? 150, clouds.y1 ?? 230), z: (clouds.zc ?? 0) + rng.range(-clouds.z, clouds.z), s: rng.range(0.8, 1.8), v: rng.range(1.5, 3.5) });
  scene.add(cm);
  // mây trôi hết dải thì quay về đầu dải: co dần về 0 trong 8% cuối, lớn dần trong 8% đầu (không vụt tắt, vụt hiện)
  const edge = clouds.span * 0.08;
  const update = (t) => {
    for (let i = 0; i < cl.length; i++) {
      const c = cl[i], x = clouds.x0 + ((c.x - clouds.x0 + t * c.v) % clouds.span);
      const s = c.s * Math.min(1, Math.min(x - clouds.x0, clouds.x0 + clouds.span - x) / edge);
      _m.compose(_v.set(x, c.y, c.z), _q.identity(), _s.set(s, s, s)); cm.setMatrixAt(i, _m);
    }
    cm.instanceMatrix.needsUpdate = true;
  };
  update(0);
  const dispose = () => { scene.remove(hm, cm); hm.geometry.dispose(); far.dispose(); cm.geometry.dispose(); cm.material.dispose(); };
  return { hills: hm, clouds: cm, update, dispose };
}

// ---- lô cờ vải: mọi lá cờ một lượt vẽ, bay bằng shader ------------------------------------------------------------------
// cells: mảng ô trên atlas canvas (mỗi ô 128 × 256, cờ dọc): { bg, fg, text } → chữ dọc giữa ô, viền fg. flags: mảng
// { x, y, z, w, h, yaw, cell } — (x, y, z) là điểm treo trên cùng ở mép cán, vải chìa theo hướng yaw (0 = +x), rủ −y.
// Shader dịch đỉnh theo pháp tuyến mặt vải: biên độ tăng theo khoảng cách từ cán (mép cán đứng yên). Không có
// document (Node) thì bỏ chữ, chỉ còn màu nền. Trả { mesh, update(t), dispose() }.
export function flagBatch(scene, cells, flags, { shadows = false } = {}) {
  const CW = 128, CH = 256, n = cells.length;
  let map = null;
  if (typeof document !== "undefined") {
    const c = document.createElement("canvas"); c.width = CW * n; c.height = CH;
    const x = c.getContext("2d");
    cells.forEach((cell, i) => {
      const ox = i * CW;
      x.fillStyle = cell.bg; x.fillRect(ox, 0, CW, CH);
      x.strokeStyle = cell.fg; x.lineWidth = cell.border ?? 8; x.strokeRect(ox + 8, 8, CW - 16, CH - 16);
      if (cell.inner) { x.lineWidth = 2; x.strokeRect(ox + 18, 18, CW - 36, CH - 36); }
      if (cell.text) {
        const chars = [...cell.text], step = (CH - 40) / chars.length;
        x.fillStyle = cell.fg; x.textAlign = "center"; x.textBaseline = "middle"; x.font = `bold ${Math.min(96, step * 0.8)}px serif`;
        chars.forEach((ch, k) => x.fillText(ch, ox + CW / 2, 20 + step * (k + 0.5)));
      }
    });
    map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
  }
  const pos = [], uv = [], wave = [], idx = [];
  const SEG = 5;
  for (const f of flags) {
    const cx = Math.cos(f.yaw), cz = -Math.sin(f.yaw), nx = -cz, nz = cx, u0 = f.cell / n, u1 = (f.cell + 1) / n, base = pos.length / 3;
    const ph = f.x * 0.37 + f.z * 0.23;
    for (let j = 0; j <= 1; j++) for (let i = 0; i <= SEG; i++) {
      const k = i / SEG, y = f.y - j * f.h;
      pos.push(f.x + cx * k * f.w, y, f.z + cz * k * f.w);
      uv.push(u0 + (u1 - u0) * k, 1 - j);
      wave.push(nx, nz, k * f.w, ph);
    }
    for (let i = 0; i < SEG; i++) { const a = base + i, b = a + 1, c = a + SEG + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute("aWave", new THREE.Float32BufferAttribute(wave, 4));
  g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere();
  const mat = new THREE.MeshLambertMaterial({ map, color: map ? 0xffffff : 0x9b2d20, side: THREE.DoubleSide });
  const uTime = { value: 0 };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uFlagTime = uTime;
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nattribute vec4 aWave; uniform float uFlagTime;")
      .replace("#include <begin_vertex>", `#include <begin_vertex>
{ float d = aWave.z, ph = aWave.w;
  float s = sin(uFlagTime * 3.1 + ph - d * 1.9) * 0.16 + sin(uFlagTime * 5.3 + ph * 1.7 - d * 3.1) * 0.05;
  transformed.xz += aWave.xy * s * d;
  transformed.y -= 0.05 * d * d; }`);
  };
  mat.customProgramCacheKey = () => "kit-flag-batch";
  const mesh = new THREE.Mesh(g, mat); mesh.name = "flags"; mesh.castShadow = shadows; mesh.frustumCulled = false; scene.add(mesh);
  return { mesh, update: (t) => { uTime.value = t; }, dispose: () => { scene.remove(mesh); g.dispose(); mat.dispose(); map?.dispose(); } };
}
