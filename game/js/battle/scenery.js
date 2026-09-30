// battle/scenery.js — cảnh phụ cho bản đồ Hàm Tử: ruộng lúa bậc thềm, lũy tre, gò đá, cỏ hoa,
// bến gỗ và thuyền nan, dấu vết chiến trận, núi xa, mây. Toàn bộ là Hư cấu để bản đồ có nhiều
// vùng nhận ra được; không đổi bố cục chơi (làn đường, Cứ Điểm, hành lang xuất quân).
//
// Giữ trần draw call (15.7): mỗi loại đạo cụ là một lưới gộp hoặc một InstancedMesh. Đạo cụ nhỏ
// không đổ bóng. Tre và đá tảng có va chạm (điểm tròn trong world.colliders).
//
// Khi bật công trình làn đánh (ground.laneFeaturesOn, cổng "lanes"): dấu chiến trận trên hai làn theo
// data/terrain-b15.js — cọc nhọn, kè ván, cờ rách trên lũy Nguyên, cọc đổ ở chỗ vỡ và dưới hào, cọc ven
// hào thành, cọc tre, sọt đất, khiên nhật trên ụ quân ta, chông trong hố, rào ruộng gãy, cự mã, xác ngựa,
// đồ rơi dày hơn ở bãi giằng co và trước cổng (addLaneProps). Đạo cụ ngẫu nhiên cũ tránh lũy, hào, hố.

import * as THREE from "three";
import { PAL, merge, part, lambert } from "./models.js";
import { heightAt, waterDist, ZONES, paddyAt, vnoise, fbm } from "./world.js";
import { laneFeaturesOn, featureNear, TERRAIN_FEATURES } from "./ground.js";
import { MAP, FRONTS, VILLAGE, KE_SACH } from "../data/battle-b15.js";
import { LANE_TERRAIN } from "../data/terrain-b15.js";
import { makeRng } from "../core/rng.js";

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, s = 6) => new THREE.CylinderGeometry(rt, rb, h, s);
const cone = (r, h, s = 6) => new THREE.ConeGeometry(r, h, s);
const ico = (r, d = 0) => new THREE.IcosahedronGeometry(r, d);
const blade = (r, h) => new THREE.ConeGeometry(r, h, 3, 1, true);      // lá cỏ, khóm lúa: nón hở đáy, 3 tam giác
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler(), _c = new THREE.Color();

// Vùng đánh nhau và đường đi — cảnh lớn không được đặt vào.
function busy(x, z, pad = 0) {
  for (const f of Object.values(FRONTS)) if (Math.abs(z - f.laneZ) < 30 + pad && x > 40 && x < 470) return true;
  if (Math.hypot(x - 34, z) < 26 + pad) return true;
  if (x < 130 && Math.abs(z) < 70) return true;
  if (x > MAP.fortWallX - 8) return true;
  return false;
}

// ---- tra công trình làn đánh (chỉ khi bật; tắt thì mọi hàm dưới trả "không vướng") ------------------------
// Lũy, hào, hố trong khoảng pad m quanh chân. Gò bỏ qua: sườn gò thoải, đá, cỏ, đồ rơi đứng được.
const onWork = (x, z, pad = 0) => { const f = featureNear(x, z, pad); return !!f && f.type !== "mound"; };
const segDist = (c, x, z) => {
  const dx = c.x1 - c.x0, dz = c.z1 - c.z0, L2 = dx * dx + dz * dz;
  let t = L2 ? ((x - c.x0) * dx + (z - c.z0) * dz) / L2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(x - c.x0 - dx * t, z - c.z0 - dz * t);
};
// chỗ đã có xác ngựa, hàng cự mã (đoạn thẳng + bán kính): đá, khóm tre, đồ rơi ngẫu nhiên không đè lên
const laneFootprints = () => [
  ...LANE_TERRAIN.horses.map((h) => ({ x0: h.x, z0: h.z, x1: h.x, z1: h.z, r: 2.2 })),
  ...LANE_TERRAIN.fences.filter((f) => f.kind === "cu_ma").map((f) => ({ x0: f.a[0], z0: f.a[1], x1: f.b[0], z1: f.b[1], r: 1.3 })),
];

// ---- khối đơn vị cho đạo cụ làn đánh: dựng dọc +y từ 0 tới 1, kéo thành thanh giữa hai điểm -------------
const _up = new THREE.Vector3(0, 1, 0), _n = new THREE.Vector3(), _X = new THREE.Vector3(), _Y = new THREE.Vector3(), _Z = new THREE.Vector3(), _T = new THREE.Vector3();
const _M = new THREE.Matrix4(), _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _eo = new THREE.Euler(0, 0, 0, "YXZ");
const UNIT = {};
// "box" hộp; "c5" / "o5" trụ 5 cạnh kín / hở hai đầu; "t5" nón hở đáy (đầu cọc vót)
const unit = (k) => UNIT[k] || (UNIT[k] = (k === "box" ? box(1, 1, 1) : k[0] === "t" ? new THREE.ConeGeometry(1, 1, +k.slice(1), 1, true)
  : new THREE.CylinderGeometry(1, 1, 1, +k.slice(1), 1, k[0] === "o")).translate(0, 0.5, 0));
// Ma trận đưa khối đơn vị thành thanh A → B: ngang sx (trục x luôn nằm ngang), dày sz; roll xoay quanh trục thanh
function spanM(ax, ay, az, bx, by, bz, sx, sz, roll = 0) {
  _Y.set(bx - ax, by - ay, bz - az); const L = _Y.length(); _Y.multiplyScalar(1 / L);
  _X.crossVectors(_Y, _up); if (_X.lengthSq() < 1e-8) _X.set(1, 0, 0); _X.normalize();
  _Z.crossVectors(_X, _Y);
  if (roll) { const c = Math.cos(roll), s = Math.sin(roll); _T.copy(_X).multiplyScalar(c).addScaledVector(_Z, s); _Z.multiplyScalar(c).addScaledVector(_X, -s); _X.copy(_T); }
  return _M.makeBasis(_X, _Y, _Z).scale(_s.set(sx, L, sz)).setPosition(ax, ay, az);
}
// Cọc, cán, sào: thân trụ bán kính r từ A tới B; tip > 0 thì vót nhọn đoạn cuối dài tip (màu tipCol)
function rod(out, col, ax, ay, az, bx, by, bz, r, { sides = 5, tip = 0, tipCol = col, cap = false } = {}) {
  const L = Math.hypot(bx - ax, by - ay, bz - az); if (L < 1e-3) return;
  const k = Math.max(0, L - tip) / L, mx = ax + (bx - ax) * k, my = ay + (by - ay) * k, mz = az + (bz - az) * k;
  if (k > 0.01) out.push(part(unit((cap ? "c" : "o") + sides), col).applyMatrix4(spanM(ax, ay, az, mx, my, mz, r, r)));
  if (tip > 0) out.push(part(unit("t" + sides), tipCol).applyMatrix4(spanM(mx, my, mz, bx, by, bz, r, r)));
}
// Ván, nẹp, thanh rào: hộp A → B rộng w (nằm ngang), dày t
const bar = (out, col, ax, ay, az, bx, by, bz, w, t, roll = 0) => out.push(part(unit("box"), col).applyMatrix4(spanM(ax, ay, az, bx, by, bz, w, t, roll)));
// Lá cờ phẳng có bề dày (hai mặt đều thấy) từ đa giác [x, y]; gốc ở mép cán, vải rủ theo −y
function flagShape(pts) {
  const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  return new THREE.ExtrudeGeometry(s, { depth: 0.025, bevelEnabled: false });
}

export function addScenery(scene, world, { shadows, mat }) {
  const rng = makeRng(4417);
  // cap: số chỗ dùng cho phần rải ngẫu nhiên (giữ y như cũ khi tắt làn đánh); phần dư n − cap dành cho addLaneProps
  const inst = (geo, n, { cast = false, material = mat, cap = n } = {}) => {
    const im = new THREE.InstancedMesh(geo, material, n);
    im.castShadow = cast && shadows; im.receiveShadow = true; im.count = 0; im.cap = cap; im.max = n; scene.add(im);
    im.put = (x, y, z, ry = 0, s = 1, sy = s, color = null, rx = 0, rz = 0) => {
      if (im.count >= im.cap) return false;
      _m.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(s, sy, s));
      im.setMatrixAt(im.count, _m);
      if (color !== null) { if (!im.instanceColor) im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3).fill(1), 3); im.setColorAt(im.count, _c.set(color)); }
      im.count++; return true;
    };
    return im;
  };
  const solid = (x, z, r) => world.colliders.push({ x0: x, z0: z, x1: x + 0.01, z1: z, r });
  const statics = [];
  // Công trình làn đánh (tắt: LANES false, blocked luôn false, gy = heightAt → cảnh y như cũ). gy: độ cao đúng
  // mặt lưới đất đang vẽ (world.groundY) để đồ nhỏ không lơ lửng, không chìm trên lưới mịn quanh lũy, hố.
  const LANES = laneFeaturesOn(), foot = LANES ? laneFootprints() : [];
  const blocked = (x, z, pad = 0) => LANES && (onWork(x, z, pad) || foot.some((c) => segDist(c, x, z) < c.r + pad));
  const gy = LANES && world.groundY ? world.groundY : heightAt;

  // ---- ruộng lúa bậc thềm ----------------------------------------------------------------------
  // Mỗi ô nằm trọn trong vùng phẳng có một mặt riêng (địa hình lưới 5 m không vẽ nổi ô 16 × 11 m);
  // ô ngập nước dùng vật liệu mặt nước; bờ ruộng đắp quanh mỗi ô; mạ, lúa chín mọc theo khóm.
  const Z = ZONES.paddy, flood = [], field = [];
  const rice = inst(merge([0, 1, 2].map((k) => part(blade(0.07, 0.62), 0xffffff, { x: (k - 1) * 0.12, y: 0.3, rz: (k - 1) * 0.25 }))), 5200);
  const RICE_COL = [null, 0x8fb448, 0xd4b24c, 0x9c8656];
  for (let i = 0; i * Z.plotW < Z.x1 - Z.x0; i++) for (let j = 0; j * Z.plotD < Z.z1 - Z.z0; j++) {
    const x0 = Z.x0 + i * Z.plotW, z0 = Z.z0 + j * Z.plotD, x1 = x0 + Z.plotW, z1 = z0 + Z.plotD, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const p = paddyAt(cx, cz);
    if (!p || [[x0, z0], [x1, z0], [x0, z1], [x1, z1]].some(([x, z]) => !paddyAt(x - Math.sign(x - cx) * 0.5, z - Math.sign(z - cz) * 0.5))) continue;
    if (z1 > 196) continue;
    const y = heightAt(cx, cz) + 0.2;
    const g = new THREE.PlaneGeometry(Z.plotW - 0.7, Z.plotD - 0.7); g.rotateX(-Math.PI / 2); g.translate(cx, y, cz);
    if (p.kind === 0) flood.push(g);
    else field.push(part(g, [0x6f913c, 0x6f913c, 0xa48f3a, 0x7d6a45][p.kind], {}));
    // bờ ruộng (4 cạnh)
    statics.push(part(box(Z.plotW + 0.6, 0.34, 0.6), 0x6d6035, { x: cx, y: y + 0.02, z: z0 }), part(box(0.6, 0.34, Z.plotD), 0x6d6035, { x: x0, y: y + 0.02, z: cz }));
    if (p.kind === 0) continue;
    // khóm lúa xếp hàng (cấy theo hàng), lệch nhẹ
    for (let a = 0.9; a < Z.plotW - 0.9; a += 1.35) for (let b = 0.9; b < Z.plotD - 0.9; b += 1.25) {
      if (p.kind === 3 && vnoise(a * 1.7 + i, b * 1.9 + j) < 0.45) continue;
      rice.put(x0 + a + (vnoise(a + i * 7, b) - 0.5) * 0.3, y - 0.05, z0 + b, rng.range(0, 3.14), p.kind === 3 ? 0.55 : 0.9 + rng.range(0, 0.35),
        p.kind === 3 ? 0.4 : p.kind === 2 ? 1.25 : 1, RICE_COL[p.kind]);
    }
  }
  if (field.length) { const m = new THREE.Mesh(merge(field), mat); m.receiveShadow = true; scene.add(m); }
  if (flood.length) {
    const fg = merge(flood.map((g) => part(g, 0xffffff, {})));
    const m = new THREE.Mesh(fg, new THREE.MeshPhongMaterial({ color: 0x6f9493, specular: 0xf6dfa0, shininess: 80, flatShading: true, transparent: true, opacity: 0.82 }));
    m.receiveShadow = true; scene.add(m);
  }

  // ---- lũy tre quanh làng, khóm tre rải rác ------------------------------------------------------
  // thân tre ngả ra ngoài, lá mọc thành chùm từ nửa thân trở lên, ngọn rủ
  const stalk = (x, z, h, lean) => {
    const g = [part(cyl(0.06, 0.08, h, 5), 0x9aa252, { x: x - lean[1] * h * 0.5, y: h / 2, z: z + lean[0] * h * 0.5, rx: lean[0], rz: lean[1] })];
    for (const [f, r, c] of [[0.55, 0.85, 0x5f7f32], [0.76, 1.05, 0x6f8e3a], [0.95, 0.8, 0x86a448]]) {
      g.push(part(ico(r, 0), c, { x: x - lean[1] * h * f * 1.15, y: h * f, z: z + lean[0] * h * f * 1.15, sy: 0.75 }));
    }
    return g;
  };
  const bambooGeo = merge([
    ...stalk(0, 0, 8.5, [0.05, -0.08]), ...stalk(0.5, 0.2, 7.6, [0.16, 0.14]), ...stalk(-0.4, 0.4, 9.2, [-0.1, -0.18]),
    ...stalk(0.2, -0.5, 7, [-0.2, 0.08]), ...stalk(-0.3, -0.3, 8, [0.1, 0.22]), ...stalk(0.7, -0.2, 6.4, [0.02, 0.26]),
    part(ico(1.2, 0), 0x55732e, { y: 1.2, sy: 0.9 }),                  // bụi măng, lá gốc
  ]);
  const bamboo = inst(bambooGeo, 160, { cast: true });
  for (let k = 0; k < 64; k++) {                      // vòng lũy tre, chừa cổng làng hướng bắc (về mặt trận B)
    const a = (k / 64) * Math.PI * 2, gate = Math.abs(Math.atan2(Math.sin(a + Math.PI / 2), Math.cos(a + Math.PI / 2))) < 0.35;
    if (gate) continue;
    const r = VILLAGE.r + 5 + vnoise(k * 0.7, 3) * 4, x = VILLAGE.x + Math.cos(a) * r, z = VILLAGE.z + Math.sin(a) * r;
    if (z > 199) continue;
    bamboo.put(x, heightAt(x, z) - 0.2, z, rng.range(0, 6.28), 0.85 + rng.range(0, 0.4), 0.9 + rng.range(0, 0.35), _c.setHSL(0.2 + rng.range(-0.02, 0.03), 0.4, 0.5 + rng.range(-0.05, 0.08)).getHex());
    if (k % 2 === 0) solid(x, z, 1.3);
  }
  for (let k = 0; k < 400 && bamboo.count < 160; k++) {    // khóm tre dọc bờ ruộng và gò tây
    const x = rng.range(10, 460), z = rng.range(-200, 199);
    if (busy(x, z, 6) || waterDist(x, z) < 10 || paddyAt(x, z) || Math.hypot(x - VILLAGE.x, z - VILLAGE.z) < VILLAGE.r + 12 || blocked(x, z, 2)) continue;
    if (fbm(x * 0.02 + 7, z * 0.02) < 0.62) continue;
    bamboo.put(x, heightAt(x, z) - 0.2, z, rng.range(0, 6.28), 0.8 + rng.range(0, 0.5), 0.9 + rng.range(0, 0.4), 0xd8e0b0);
    solid(x, z, 1.2);
  }

  // ---- gò đá giữa hai mặt trận ---------------------------------------------------------------------
  const rockGeo = merge([part(new THREE.DodecahedronGeometry(1, 0), 0xffffff, { sy: 0.7 })]);
  const rocks = inst(rockGeo, 260, { cast: true });
  const ROCK = [0x9a9384, 0x857d6c, 0xa79f8a, 0x6f6a5e];
  for (const k of ZONES.knolls) {
    const n = Math.round(k.r * 1.6);
    for (let i = 0; i < n; i++) {
      const a = rng.range(0, 6.28), d = Math.sqrt(rng.next()) * k.r * 0.8, x = k.x + Math.cos(a) * d, z = k.z + Math.sin(a) * d;
      const big = i < 4, s = big ? rng.range(1.6, 2.6) : rng.range(0.3, 1.1);
      if (blocked(x, z, big ? 1.5 : 0.2)) continue;
      rocks.put(x, gy(x, z) + s * 0.15, z, rng.range(0, 6.28), s, s * rng.range(0.6, 1.1), rng.pick(ROCK), rng.range(-0.2, 0.2), rng.range(-0.2, 0.2));
      if (big) solid(x, z, s * 0.85);
    }
  }
  for (let k = 0; k < 700 && rocks.count < 260; k++) {     // đá lẻ khắp bãi, sỏi ven đường
    const x = rng.range(-20, 600), z = rng.range(-190, 199);
    if (waterDist(x, z) < 2 || paddyAt(x, z) || x > MAP.fortWallX - 2 || blocked(x, z, 0.2)) continue;
    const s = rng.range(0.15, 0.55);
    rocks.put(x, gy(x, z) + s * 0.1, z, rng.range(0, 6.28), s, s * 0.7, rng.pick(ROCK));
  }

  // ---- cỏ, hoa dại ------------------------------------------------------------------------------
  const tuftGeo = merge([0, 1, 2, 3].map((k) => part(blade(0.1, 0.7), 0xffffff, { x: Math.cos(k * 1.6) * 0.14, y: 0.3, z: Math.sin(k * 1.6) * 0.14, rx: Math.sin(k * 1.6) * 0.35, rz: -Math.cos(k * 1.6) * 0.35 })));
  const tufts = inst(tuftGeo, 3200);
  const flowerGeo = merge([part(blade(0.02, 0.5), 0x5f7a34, { y: 0.25 }), part(new THREE.OctahedronGeometry(0.1, 0), 0xffffff, { y: 0.52 })]);
  const flowers = inst(flowerGeo, 1400);
  const FLOWER = [0xf2ecd8, 0xe8c34a, 0xb86fb0, 0xd9543c, 0xf0f0f0];
  for (let k = 0; k < 16000 && (tufts.count < 3200 || flowers.count < 1400); k++) {
    const x = rng.range(-20, 470), z = rng.range(-196, 199);
    if (waterDist(x, z) < 3 || paddyAt(x, z)) continue;
    let road = false; for (const f of Object.values(FRONTS)) if (Math.abs(z - f.laneZ) < 4 && x > 50) road = true;
    if (road || (Math.abs(x - 60) < 5 && Math.abs(z) < 80) || Math.hypot(x - 34, z) < 18 || blocked(x, z)) continue;
    const n = fbm(x * 0.03, z * 0.03), y = gy(x, z) - 0.05;
    if (n > 0.42 && tufts.count < 3200) tufts.put(x, y, z, rng.range(0, 6.28), rng.range(0.7, 1.4), rng.range(0.7, 1.5), _c.setHSL(0.17 + (n - 0.5) * 0.12, 0.45, 0.33 + rng.range(0, 0.1)).getHex());
    else if (n < 0.4 && vnoise(x * 0.08, z * 0.08) > 0.6 && flowers.count < 1400) {
      const c = FLOWER[Math.floor(vnoise(x * 0.02 + 3, z * 0.02) * FLOWER.length) % FLOWER.length];
      for (let f = 0; f < 3; f++) flowers.put(x + rng.range(-0.8, 0.8), y, z + rng.range(-0.8, 0.8), 0, rng.range(0.8, 1.3), rng.range(0.8, 1.4), c);
    }
  }

  // ---- bến gỗ, thuyền nan ----------------------------------------------------------------------------
  const pier = (x, len, ang = 0) => {
    const zb = MAP.riverNorthZ + 3, y = 0.95;
    for (let t = 0; t < len; t += 1.1) statics.push(part(box(2.4, 0.12, 1.0), t % 3.3 < 1.1 ? 0x7a5a3a : PAL.go, { x: x + Math.sin(ang) * t, y, z: zb - t, ry: ang + (vnoise(t, x) - 0.5) * 0.06 }));
    for (let t = 0; t < len; t += 3.3) for (const s of [-1, 1]) statics.push(part(cyl(0.12, 0.14, 3, 5), 0x4a3524, { x: x + s * 1.1, y: y - 1.0, z: zb - t }));
    return { x, z: zb - len };
  };
  const skiffGeo = merge([
    part(box(1.2, 0.45, 4.2), PAL.nau, { y: 0.22 }), part(cone(0.62, 1.1, 4), PAL.nau, { y: 0.22, z: 2.5, rx: Math.PI / 2, ry: Math.PI / 4, sz: 0.5 }),
    part(cyl(0.9, 0.9, 1.6, 8, 1), 0x8c7a52, { y: 0.75, z: -0.4, rz: Math.PI / 2, sx: 0.8 }),     // mui thuyền đan tre
    part(box(0.05, 0.05, 2.6), PAL.go, { x: 0.5, y: 0.9, z: 1.2, rx: 0.3 }),
  ]);
  const skiffs = [];
  for (const [px, len] of [[120, 9], [214, 12], [318, 8], [402, 10]]) {
    const end = pier(px, len);
    for (let s = 0; s < 2; s++) {
      const b = new THREE.Mesh(skiffGeo, mat); b.castShadow = shadows;
      b.position.set(px + (s ? 2.8 : -2.8), 0.3, end.z + 2 + s * 3); b.rotation.y = (s ? 0.25 : -0.2);
      scene.add(b); skiffs.push(b);
    }
  }
  // thúng câu, lưới phơi trên bờ
  for (const [x, z] of [[160, -158], [270, -157], [372, -159]]) {
    statics.push(part(cyl(0.9, 0.6, 0.5, 8), 0x8c7a52, { x, y: heightAt(x, z) + 0.2, z, rz: 0.4 }));
    statics.push(part(box(0.08, 1.8, 0.08), PAL.go, { x: x + 2, y: heightAt(x + 2, z) + 0.9, z }), part(box(0.08, 1.8, 0.08), PAL.go, { x: x + 5, y: heightAt(x + 5, z) + 0.9, z }),
      part(box(3, 1.2, 0.03), 0x5a5540, { x: x + 3.5, y: heightAt(x + 3.5, z) + 1.1, z }));
  }
  world.animated.push((t) => skiffs.forEach((b, i) => { b.position.y = 0.3 + 0.08 * Math.sin(t * 1.3 + i); b.rotation.z = 0.05 * Math.sin(t + i * 1.7); }));

  // ---- dấu vết chiến trận: giáo gãy, khiên rơi, tên cắm, xe hỏng, trại cháy ---------------------------------
  const spearStuck = merge([part(cyl(0.025, 0.025, 2.2, 4), PAL.go, { y: 1.0 }), part(cone(0.05, 0.25, 4), PAL.sat, { y: 2.2 })]);
  // bật làn đánh: thêm chỗ cho giáo, bó tên, khiên rơi dày hơn ở bãi giằng co và trước cổng (addLaneProps)
  const EXTRA = LANES ? { sp: 110, ar: 170, sh: 70 } : { sp: 0, ar: 0, sh: 0 };
  const spears = inst(spearStuck, 180 + EXTRA.sp, { cap: 180 });
  const arrowTuft = merge([0, 1, 2, 3, 4].map((k) => part(cyl(0.012, 0.012, 0.8, 3), PAL.go, { x: Math.cos(k * 1.3) * 0.18, y: 0.35, z: Math.sin(k * 1.3) * 0.18, rx: Math.sin(k * 1.3) * 0.3, rz: Math.cos(k * 1.3) * 0.3 })));
  const arrows = inst(arrowTuft, 220 + EXTRA.ar, { cap: 220 });
  const shieldGeo = merge([part(cyl(0.36, 0.36, 0.05, 9), 0xffffff, {}), part(cyl(0.09, 0.09, 0.08, 6), PAL.sat, { y: 0.03 })]);
  const shields = inst(shieldGeo, 120 + EXTRA.sh, { cap: 120 });
  for (let k = 0; k < 3000 && (spears.count < 180 || shields.count < 120 || arrows.count < 220); k++) {
    const f = rng.pick(Object.values(FRONTS)), x = rng.range(150, 460), z = f.laneZ + rng.range(-26, 26);
    if (Math.abs(z - f.laneZ) < 3 || blocked(x, z, 0.3)) continue;
    const y = gy(x, z), r = rng.next();
    if (r < 0.35) spears.put(x, y - 0.3, z, rng.range(0, 6.28), 1, 1, null, rng.range(-0.6, 0.6), rng.range(-0.6, 0.6));
    else if (r < 0.62) shields.put(x, y + 0.05, z, rng.range(0, 6.28), rng.range(0.9, 1.1), 1, rng.pick([PAL.nau, PAL.long, PAL.sonDam, 0x5a4a3a]), rng.range(-0.15, 0.15), rng.range(-0.15, 0.15));
    else arrows.put(x, y - 0.1, z, rng.range(0, 6.28), 1, 1, null, rng.range(-0.3, 0.3), rng.range(-0.3, 0.3));
  }
  const cart = (x, z, ry, broken) => {
    const y = heightAt(x, z);
    const g = [part(box(1.6, 0.3, 2.8), PAL.go, { y: 0.8 }), part(box(0.08, 0.5, 2.8), PAL.go, { x: 0.78, y: 1.1 }), part(box(0.08, 0.5, 2.8), PAL.go, { x: -0.78, y: 1.1 }),
      part(box(0.1, 0.1, 2.2), PAL.go, { y: 0.8, z: 2.4 }), part(cyl(0.6, 0.6, 0.12, 8), PAL.nau, { x: 0.9, y: 0.6, rz: Math.PI / 2 })];
    if (!broken) g.push(part(cyl(0.6, 0.6, 0.12, 8), PAL.nau, { x: -0.9, y: 0.6, rz: Math.PI / 2 }), part(box(1.2, 0.6, 1.2), 0xb09a6a, { y: 1.25, z: -0.4 }));
    else g.push(part(cyl(0.6, 0.6, 0.12, 8), PAL.nau, { x: -1.6, y: 0.08, z: 0.8 }));
    const m = merge(g); m.applyMatrix4(new THREE.Matrix4().compose(_v.set(x, y + (broken ? -0.25 : 0), z), _q.setFromEuler(_e.set(0, ry, broken ? -0.28 : 0)), _s.set(1, 1, 1)));
    statics.push(m); solid(x, z, 1.4);
  };
  for (const [x, z, ry, b] of [[262, -102, 0.6, 1], [318, 44, -0.4, 1], [205, 104, 1.2, 0], [376, -46, 2.1, 1], [145, -112, -0.8, 0], [420, 108, 0.3, 1]]) if (!blocked(x, z, 1.8)) cart(x, z, ry, b);
  // trại Nguyên ngoài thành: hòm, thùng, cọc buộc ngựa, lều cháy trơ khung, đống lửa tàn
  const S = ZONES.scorch;
  for (let k = 0; k < 60; k++) {
    const x = rng.range(S.x0 + 6, S.x1 - 6), z = rng.range(-150, 150);
    if ((busy(x, z, -12) && Math.abs(z) > 20) || blocked(x, z, 1.8)) continue;
    const y = heightAt(x, z), r = rng.next();
    if (r < 0.4) statics.push(part(box(0.9, 0.7, 0.9), 0x7a6040, { x, y: y + 0.35, z, ry: rng.range(0, 3) }), part(box(0.95, 0.08, 0.95), PAL.then, { x, y: y + 0.72, z, ry: rng.range(0, 3) }));
    else if (r < 0.7) statics.push(part(cyl(0.38, 0.4, 0.9, 7), 0x6a4a2a, { x, y: y + 0.45, z }), part(cyl(0.41, 0.41, 0.07, 7), PAL.then, { x, y: y + 0.7, z }));
    else if (r < 0.85) {
      for (let s = 0; s < 5; s++) statics.push(part(box(0.1, 2.2, 0.1), 0x2a221a, { x: x + Math.cos(s * 1.25) * 1.6, y: y + 0.9, z: z + Math.sin(s * 1.25) * 1.6, rx: Math.sin(s * 1.25) * 0.5, rz: -Math.cos(s * 1.25) * 0.5 }));
    } else {
      statics.push(part(cyl(0.9, 1.0, 0.12, 8), 0x2a2622, { x, y: y + 0.05, z }));
      for (let s = 0; s < 4; s++) statics.push(part(box(0.12, 0.12, 1.2), 0x3a2a1a, { x, y: y + 0.15, z, ry: s * 0.8 }));
      if (world.smokes) world.smokes.push({ x, z }); else world.smokes = [{ x, z }];
    }
  }
  // cọc buộc ngựa dọc đường vào cổng (bật làn đánh: bỏ cọc rơi vào hào thành, hàng cự mã)
  for (const zz of [-60, 60]) for (let t = 0; t < 6; t++) {
    if (blocked(440 + t * 3, zz, 0.3) || blocked(443 + t * 3, zz, 0.3)) continue;
    statics.push(part(box(0.14, 1.2, 0.14), PAL.go, { x: 440 + t * 3, y: heightAt(440 + t * 3, zz) + 0.6, z: zz }), part(box(3, 0.1, 0.1), PAL.go, { x: 441.5 + t * 3, y: heightAt(441.5 + t * 3, zz) + 1.05, z: zz }));
  }

  // ---- cây đa đầu làng (mốc nhận đường), cau trong làng -------------------------------------------
  // Cây đa đứng ngay trong cổng lũy tre (lối duy nhất vào làng, đường dân tản cư, đường nhặt bó tên Kế Sách); tán
  // ở độ cao 4,4–11 m, xoè 6,8 m quanh gốc, đúng độ cao camera mặc định (~7 m) nên đi qua nửa tây cổng thì camera
  // chui vào tán, màn hình đen lá, mất tướng. Vì vậy cây là lưới riêng (+1 draw) tự mờ như cột cờ, khán đài
  // (world.addFadeable, r 5,5: mờ khi camera cách gốc < 11,5 m hoặc gốc lệch hành lang camera → tướng < 6,6 m).
  const banyan = (x, z) => {
    const y = heightAt(x, z), g = [part(cyl(0.9, 1.4, 5, 7), 0x6a5238, { y: 2.5 })];
    for (let k = 0; k < 7; k++) g.push(part(cyl(0.05, 0.05, 4, 3), 0x5a4630, { x: Math.cos(k) * 2.4, y: 2.8, z: Math.sin(k) * 2.4 }));
    for (let k = 0; k < 6; k++) g.push(part(ico(3.2, 0), k % 2 ? 0x46602e : 0x55703a, { x: Math.cos(k * 1.05) * 3.2, y: 6.6 + (k % 3) * 0.6, z: Math.sin(k * 1.05) * 3.2, sy: 0.7 }));
    g.push(part(ico(3.6, 0), 0x4c6632, { y: 8.2, sy: 0.75 }));
    const m = new THREE.Mesh(merge(g), mat); m.position.set(x, y - 0.1, z); m.castShadow = shadows; m.receiveShadow = true;
    scene.add(m); world.addFadeable(m, 5.5); solid(x, z, 1.6);
  };
  banyan(VILLAGE.x - 6, VILLAGE.z - VILLAGE.r - 9);
  const arecaGeo = merge([part(cyl(0.1, 0.13, 9, 5), 0x9a8a6a, { y: 4.5 }), ...[0, 1, 2, 3, 4, 5].map((k) => part(box(0.4, 0.05, 2.2), 0x5f7f32, { y: 9, ry: k * 1.05, rx: 0.5, z: 0 }))]);
  const areca = inst(arecaGeo, 30, { cast: true });
  for (let k = 0; k < 30; k++) {
    const a = rng.range(0, 6.28), r = rng.range(4, VILLAGE.r - 2), x = VILLAGE.x + Math.cos(a) * r, z = VILLAGE.z + Math.sin(a) * r;
    if (KE_SACH.muiTenThu.bundles.some((b) => Math.hypot(b.x - x, b.z - z) < 3)) continue;
    areca.put(x, heightAt(x, z) - 0.1, z, rng.range(0, 6.28), rng.range(0.8, 1.15));
  }

  // dấu chiến trận trên hai làn (rng riêng: tắt làn đánh thì chuỗi ngẫu nhiên của cảnh cũ không đổi)
  if (LANES) addLaneProps(scene, world, { mat, shadows, spears, arrows, shields, blocked, gy });

  addSky(scene, world, rng, [[300, 820, 18, 800, 40, 95, 0x5a6670], [-620, 0, 10, 300, 35, 80, 0x5a6560],    // nam, tây
    [300, -760, 12, 800, 20, 50, 0x6a7478], [1050, 0, 8, 420, 30, 70, 0x6a7478]],                                 // bắc sông Hồng, đông
    undefined, { x0: -40, x1: 650, z0: -250, z1: 250, pad: 60 });                                                   // chân núi cách mép bản đồ ≥ 60 m

  if (statics.length) { const m = new THREE.Mesh(merge(statics), mat); m.castShadow = shadows; m.receiveShadow = true; scene.add(m); }
  for (const im of [rice, bamboo, rocks, tufts, flowers, spears, arrows, shields, areca]) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
}

// ---- xuyên thấu hành lang camera → tướng (lưới đạo cụ làn đánh) ------------------------------------------------
// Cọc lũy Nguyên (đỉnh ~3 m trên mặt ruộng), cờ trên lũy che tướng khi camera đứng sau lũy. Như cột cờ tự mờ
// (world.addFadeable) nhưng cho cả lưới gộp trong một lượt vẽ: mảnh nằm trong ống quanh đoạn camera → ngực tướng
// (bán kính 1–1,7 m, chừa 1–2,2 m cuối quanh tướng) hoặc sát ống kính (< 2–3,2 m) bị loại theo mẫu chấm, tối đa
// 85%. Bóng đổ giữ nguyên (lượt bóng dùng vật liệu độ sâu riêng). Vị trí camera, tướng lấy qua world.fadeOccluders
// (battle.js gọi mỗi khung trước khi vẽ).
function seeThrough(material, world) {
  const uCam = { value: new THREE.Vector3(0, -1e4, 0) }, uTgt = { value: new THREE.Vector3(0, -1e4, 1) };
  material.onBeforeCompile = (sh) => {
    sh.uniforms.uSeeCam = uCam; sh.uniforms.uSeeTgt = uTgt;
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vSeeW;")
      .replace("#include <project_vertex>", "#include <project_vertex>\n  vSeeW = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vSeeW;\nuniform vec3 uSeeCam, uSeeTgt;")
      .replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>
  {
    vec3 ax = uSeeTgt - uSeeCam; float L = max(length(ax), 1e-3); ax /= L;
    vec3 d = vSeeW - uSeeCam; float t = dot(d, ax), r = length(d - ax * t);
    float k = (1.0 - smoothstep(1.0, 1.7, r)) * step(0.0, t) * (1.0 - smoothstep(L - 2.2, L - 1.0, t));
    k = max(k, 1.0 - smoothstep(2.0, 3.2, length(d)));
    if (k * 0.85 > fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))))) discard;
  }`);
  };
  material.customProgramCacheKey = () => "hk-see-through";
  const prev = world.fadeOccluders, gy = world.groundY || heightAt;
  world.fadeOccluders = (cam, tx, tz, dt) => { prev(cam, tx, tz, dt); uCam.value.copy(cam); uTgt.value.set(tx, gy(tx, tz) + 1.1, tz); };
  return material;
}

// ---- dấu chiến trận trên hai làn đánh (data/terrain-b15.js, toàn bộ Hư cấu) -----------------------------------
// Vật lớn (cọc lũy, kè, cờ, cự mã, rào, xác ngựa, sọt đất, khiên dựng) gộp một lưới có bóng, vật liệu xuyên thấu
// hành lang camera → tướng (+1 draw, +1 lượt bóng); vật nhỏ (tên cắm, cục đất, mũ, cán gãy, rơm, lau) gộp một
// lưới không đổ bóng (+1 draw); giáo cắm, khiên tròn, bó tên dùng chỗ dư của InstancedMesh sẵn có. Mọi thứ đặt
// theo gy (mặt lưới đất đang vẽ), nghiêng theo dốc nơi cần. Va chạm chỉ cho xác ngựa (ngắn, lính trượt vòng qua
// được); cọc lũy, rào ruộng, cự mã không chặn: lính và sĩ quan không tìm đường, đi thẳng tới đích rồi bị đẩy vuông
// góc ra khỏi đoạn va chạm, nên một hàng cự mã dài 7–18 m ghim cả toán lính ở mặt kia (tướng đứng sau hàng thành
// chỗ an toàn), và khe giữa cự mã A x 287 với xác ngựa (284, −84) hẹp hơn tướng, kẹt tướng trên đường P2. Rào để
// thấp, gãy nhiều; cự mã thì tướng, lính đi xuyên khung chông.
function addLaneProps(scene, world, { mat, shadows, spears, arrows, shields, blocked, gy }) {
  const t0 = performance.now(), rng = makeRng(9151), small = [], big = [], inst0 = [spears.count, arrows.count, shields.count];
  for (const im of [spears, arrows, shields]) im.cap = im.max;
  const WOOD = [0x7a5a36, 0x6b4a2b, 0x5e4630, 0x846443], FRESH = 0xb39565, BARK = 0x4e3a26, ROPE = 0x4a3a28;
  // ván kè cũ dầm mưa nắng: nâu xám sẫm hơn đất đắp vàng nâu (ván sáng hơn đất thì dưới nắng thành hàng gạch)
  const PLANK = [0x5c4f3f, 0x534738, 0x655543, 0x4a3f33, 0x6b5b47, 0x574a3b], WICKER = 0xa08d5e, WICKER_D = 0x6f5f3e, CHAM = 0x34485e;
  const WICKER_OLD = 0x655840, LASH = 0x3e3226;                                  // phên kè cũ, nẹp/dây buộc sẫm
  const BAMBOO = [0x9aa252, 0x8e9a4a, 0xa8a860, 0xb3a45e], BAMBOO_TIP = 0xd8cf8e, RAIL = [0xc2ae6c, 0xb09a5a, 0xa89456], POST = [0x9a8a50, 0x8a7a48, 0xa89a5e];
  const CLOD = [0x5e4b35, 0x6d5639, 0x4d3d2b, 0x7a6244], STRAW = [0xb39a5a, 0xa48c50, 0xc2a868], SHAFT = 0x9c8458;
  const FLETCH = [PAL.trung, PAL.trung, 0xb8b0a0, PAL.son];
  const solid = (x0, z0, x1, z1, r) => world.colliders.push({ x0, z0, x1, z1, r });
  const normalAt = (x, z, e = 0.6) => _n.set(gy(x - e, z) - gy(x + e, z), 2 * e, gy(x, z - e) - gy(x, z + e)).normalize();
  // đặt cụm dựng sẵn (gốc ở chân) tại (x, z): quay ry rồi rx, rz cục bộ; nghiêng theo dốc (tilt 0..1); nhấc dy
  const drop = (out, g, x, z, ry, { tilt = 1, dy = 0, rx = 0, rz = 0, s = 1 } = {}) => {
    normalAt(x, z); if (tilt < 1) _n.lerp(_up, 1 - tilt).normalize();
    _qa.setFromUnitVectors(_up, _n).multiply(_qb.setFromEuler(_eo.set(rx, ry, rz)));
    out.push(g.clone().applyMatrix4(_M.compose(_v.set(x, gy(x, z) + dy, z), _qa, _s.set(s, s, s))));
  };
  // tên cắm: gốc (x, y, z) trên mặt vật, (dx, dy, dz) hướng đuôi (đơn vị), mũi ngập 0,12 m; lông đuôi trắng ngà
  const arrow = (out, x, y, z, dx, dy, dz, len = 0.68) => {
    rod(out, SHAFT, x - dx * 0.12, y - dy * 0.12, z - dz * 0.12, x + dx * len, y + dy * len, z + dz * len, 0.013, { sides: 3 });
    bar(out, rng.pick(FLETCH), x + dx * (len - 0.2), y + dy * (len - 0.2), z + dz * (len - 0.2), x + dx * (len - 0.02), y + dy * (len - 0.02), z + dz * (len - 0.02), 0.075, 0.01, rng.range(0, 3.14));
  };
  // dăm gỗ tưa ở đầu cọc gãy
  const splinter = (out, x, y, z) => { for (let i = 0; i < 3; i++) { const a = rng.range(0, 6.28), l = rng.range(0.12, 0.3); bar(out, FRESH, x, y - 0.06, z, x + Math.cos(a) * l * 0.35, y + l, z + Math.sin(a) * l * 0.35, 0.035, 0.02); } };
  // cọc, cán nằm trên đất từ (x, z) theo hướng a dài L (hai đầu bám mặt đất)
  const lying = (out, col, x, z, a, L, r, opts) => { const ex = x + Math.cos(a) * L, ez = z + Math.sin(a) * L; rod(out, col, x, gy(x, z) + r * 0.8, z, ex, gy(ex, ez) + r * 0.8, ez, r, opts); };
  const clodGeo = ico(1, 0);
  const clod = (x, z, s) => small.push(part(clodGeo, rng.pick(CLOD), { x, y: gy(x, z) + s * 0.2, z, sx: s * 1.3, sy: s * 0.65, sz: s, ry: rng.range(0, 3) }));
  // Ván/phên nằm áp mặt đất từ (x0, z0) tới (x1, z1), rộng w (ngang), dày t, nhấc lift: lấy mẫu mặt lưới 7 điểm,
  // bỏ điểm giữa lệch đường thẳng < 1,5 cm (Douglas–Peucker theo độ cao) rồi dựng từng khúc. Ván thẳng một khúc
  // trên mái lũy lồi chìm mất nửa trên, chỉ lộ mẩu dưới chân.
  const HX = new Float64Array(7), HY = new Float64Array(7), HZ = new Float64Array(7), HK = [];
  const hug = (out, col, x0, z0, x1, z1, w, t, lift, roll = 0) => {
    for (let k = 0; k <= 6; k++) { const q = k / 6; HX[k] = x0 + (x1 - x0) * q; HZ[k] = z0 + (z1 - z0) * q; HY[k] = gy(HX[k], HZ[k]) + lift; }
    const dp = (a, b) => {
      let m = -1, md = 0.015;
      for (let k = a + 1; k < b; k++) { const e = Math.abs(HY[k] - HY[a] - (HY[b] - HY[a]) * (k - a) / (b - a)); if (e > md) { md = e; m = k; } }
      if (m < 0) return; dp(a, m); HK.push(m); dp(m, b);
    };
    HK.length = 0; HK.push(0); dp(0, 6); HK.push(6);
    for (let k = 0; k + 1 < HK.length; k++) { const a = HK[k], b = HK[k + 1]; bar(out, col, HX[a], HY[a], HZ[a], HX[b], HY[b], HZ[b], w, t, roll); }
  };
  const rv = makeRng(6203);                                                      // rng riêng cho kè ván, ván rơi

  // ---- khối mẫu ------------------------------------------------------------------------------------
  // khiên nhật son quân Trần (như SHIELD.nhat trong soldiers.js): mặt hướng +z, mép dưới ở gốc
  const nhat = merge([part(box(0.5, 0.74, 0.05), PAL.sonDam, { y: 0.37 }), part(box(0.54, 0.06, 0.07), PAL.then, { y: 0.03 }),
    part(box(0.54, 0.06, 0.07), PAL.then, { y: 0.71 }), part(ico(0.1, 0), PAL.vang, { y: 0.37, z: 0.05 })]);
  // mũ Nguyên (chóp sắt xám, vành lông, khăn chàm che gáy) và nón tre quân Trần; vành ở gốc
  const helmNg = merge([part(cone(0.17, 0.32, 7), PAL.xam, { y: 0.23 }), part(cyl(0.2, 0.21, 0.07, 8), PAL.long, { y: 0.035 }), part(box(0.3, 0.2, 0.05), PAL.cham, { y: -0.02, z: -0.17, rx: -0.4 })]);
  const helmDv = merge([part(cone(0.32, 0.15, 8), PAL.vai, { y: 0.075 }), part(cyl(0.1, 0.12, 0.05, 6), PAL.then, { y: 0.03 })]);
  // sọt đất: sọt tre đan, đai sẫm, miệng đầy đất
  const basket = merge([part(cyl(0.3, 0.2, 0.42, 8), 0xab9661, { y: 0.21 }), part(cyl(0.31, 0.31, 0.04, 8), WICKER_D, { y: 0.41 }),   // sọt tre loe miệng, nẹp vành
    part(cyl(0.255, 0.24, 0.05, 8), WICKER_D, { y: 0.13 }), part(ico(0.27, 0), 0x5e4b35, { y: 0.43, sy: 0.42 })]);                    // đai đáy, đất vun trên miệng
  // khóm lau sậy quanh hố ngập
  const reeds = merge([0, 1, 2, 3, 4].map((k) => part(blade(0.05, 1.2 + (k % 3) * 0.22), k % 2 ? 0x8f8a4a : 0x76843e,
    { x: Math.cos(k * 1.3) * 0.13, y: 0.6 + (k % 3) * 0.11, z: Math.sin(k * 1.3) * 0.13, rx: Math.sin(k * 1.3) * 0.18, rz: -Math.cos(k * 1.3) * 0.18 })));
  // cung sừng nằm phẳng (tay cầm ở gốc, hai đầu cong ngược), ống tên nằm (miệng phía +x, đuôi tên thò ra)
  const bow = (() => {
    const p = [];
    bar(p, PAL.then, -0.09, 0.03, 0, 0.09, 0.03, 0, 0.05, 0.045);
    for (const s of [-1, 1]) { bar(p, PAL.go, 0.08 * s, 0.03, 0, 0.42 * s, 0.03, -0.12, 0.035, 0.03); bar(p, PAL.then, 0.42 * s, 0.03, -0.12, 0.6 * s, 0.03, -0.07, 0.03, 0.03); }
    bar(p, PAL.trung, -0.6, 0.03, -0.07, 0.6, 0.03, -0.07, 0.012, 0.012);
    return merge(p);
  })();
  const quiver = (() => {
    const p = [part(cyl(0.075, 0.065, 0.55, 6), PAL.nau, { y: 0.075, rz: -Math.PI / 2 }), part(cyl(0.082, 0.082, 0.06, 6), PAL.trung, { x: 0.25, y: 0.075, rz: -Math.PI / 2 })];
    for (let k = 0; k < 4; k++) {
      const a = k * 1.6, cy = Math.sin(a), cz = Math.cos(a);
      rod(p, SHAFT, 0.2, 0.075 + cy * 0.035, cz * 0.035, 0.52, 0.09 + cy * 0.06, cz * 0.06, 0.012, { sides: 3 });
      bar(p, PAL.trung, 0.38, 0.085 + cy * 0.05, cz * 0.05, 0.53, 0.09 + cy * 0.06, cz * 0.06, 0.06, 0.01);
    }
    return merge(p);
  })();
  // cờ chàm rách của quân Nguyên (nẹp thép), cờ đuôi nheo son viền vàng của quân Ta: gốc ở mép cán, rủ theo −y
  const torn = merge([part(flagShape([[0, 0], [0.72, 0], [0.72, -0.5], [0.6, -0.66], [0.68, -0.88], [0.47, -0.78], [0.4, -1.02], [0.26, -0.86], [0.12, -1.1], [0, -0.98]]), CHAM, { z: -0.0125 }),
    part(box(0.76, 0.08, 0.04), PAL.thep, { x: 0.36, y: -0.04 }), part(box(0.05, 0.9, 0.04), PAL.thep, { x: 0.025, y: -0.5 })]);
  const pennant = merge([part(flagShape([[0, 0], [1.0, -0.16], [0.7, -0.27], [1.0, -0.4], [0, -0.52]]), PAL.son, { z: -0.0125 }), part(box(0.05, 0.54, 0.04), PAL.vang, { x: 0.025, y: -0.26 })]);
  const bale = merge([part(cyl(0.32, 0.32, 0.8, 7), 0xc2a560, { y: 0.3, rz: Math.PI / 2, sx: 0.95 }), part(cyl(0.33, 0.33, 0.05, 7), ROPE, { x: -0.2, y: 0.3, rz: Math.PI / 2 }), part(cyl(0.33, 0.33, 0.05, 7), ROPE, { x: 0.2, y: 0.3, rz: Math.PI / 2 })]);
  const disk = new THREE.CircleGeometry(0.72, 7).rotateX(-Math.PI / 2);

  // Xác ngựa nằm nghiêng (không máu me): thân trống, cổ và đầu sát đất ngoẹo về phía lưng, bốn chân duỗi cứng.
  // Gốc ở mặt đất dưới giữa thân, +z phía đầu, lưng phía +x, chân chĩa −x. Vải yên theo phe; vài mũi tên cắm sườn.
  const horseGeo = (coat, cloth, trim) => {
    const p = [], sock = new THREE.Color(coat).multiplyScalar(0.55).getHex(), hoof = 0x201a15, mane = 0x2a211b, muzzle = new THREE.Color(coat).lerp(new THREE.Color(0x9a8a7a), 0.55).getHex();
    p.push(part(cyl(0.4, 0.43, 1.35, 8), coat, { y: 0.31, rx: Math.PI / 2, sz: 0.74 }));                           // thân trống (dày 0,64, sâu 0,86 m)
    p.push(part(ico(0.45, 0), coat, { x: 0.04, y: 0.32, z: -0.7, sy: 0.72 }), part(ico(0.4, 0), coat, { x: -0.02, y: 0.3, z: 0.68, sy: 0.74 }));   // mông, vai ngực
    // cổ dày thuôn hai khúc ngoẹo về phía lưng, bờm đen dọc mép cổ; đầu dài nằm sát đất, mõm nhạt màu, dây cương
    p.push(part(box(0.42, 0.3, 0.62), coat, { x: 0.1, y: 0.26, z: 1.13, ry: 0.35 }), part(box(0.34, 0.26, 0.56), coat, { x: 0.36, y: 0.22, z: 1.58, ry: 0.65 }));
    p.push(part(box(0.08, 0.14, 0.62), mane, { x: 0.29, y: 0.3, z: 1.06, ry: 0.35 }), part(box(0.08, 0.12, 0.55), mane, { x: 0.49, y: 0.27, z: 1.48, ry: 0.65 }));
    p.push(part(box(0.3, 0.24, 0.62), coat, { x: 0.72, y: 0.13, z: 1.91, ry: 1.05 }), part(box(0.25, 0.2, 0.22), muzzle, { x: 0.9, y: 0.12, z: 2.02, ry: 1.05 }));
    p.push(part(box(0.32, 0.26, 0.05), PAL.then, { x: 0.8, y: 0.13, z: 1.96, ry: 1.05 }));
    for (const s of [0.08, 0.2]) rod(p, coat, 0.51, s, 1.66, 0.38, s + (s - 0.14) * 0.4, 1.52, 0.06, { sides: 3, tip: 0.12 });   // tai
    // chân duỗi cứng về phía bụng (−x): cặp trên nằm đè, cặp dưới sát đất; bắp màu lông, ống chân sẫm, móng
    for (const [a, b, c, d] of [
      [[-0.25, 0.4, 0.62], [-0.72, 0.38, 0.8], [-1.08, 0.34, 0.88], [-1.23, 0.33, 0.86]],
      [[-0.25, 0.14, 0.55], [-0.7, 0.12, 0.62], [-1.06, 0.1, 0.6], [-1.21, 0.09, 0.58]],
      [[-0.2, 0.42, -0.62], [-0.62, 0.4, -0.92], [-1.0, 0.36, -0.8], [-1.15, 0.35, -0.76]],
      [[-0.2, 0.14, -0.55], [-0.6, 0.12, -0.84], [-0.98, 0.1, -0.72], [-1.13, 0.09, -0.68]]]) {
      bar(p, coat, ...a, ...b, 0.21, 0.19); bar(p, sock, ...b, ...c, 0.12, 0.12); bar(p, hoof, ...c, ...d, 0.16, 0.15);
    }
    p.push(part(ico(0.24, 0), coat, { x: -0.22, y: 0.4, z: -0.66, sy: 0.8 }));                                      // bắp đùi sau
    bar(p, mane, 0.15, 0.36, -1.1, 0.1, 0.12, -1.55, 0.16, 0.1); bar(p, mane, 0.1, 0.06, -1.5, -0.05, 0.03, -2.0, 0.26, 0.05);   // đuôi
    // vải yên phủ sườn trên vắt qua sống lưng (viền màu phe), yên gỗ cao đầu, bàn đạp rơi xuống đất
    p.push(part(box(0.4, 0.05, 0.92), cloth, { x: -0.02, y: 0.615, z: 0.05 }), part(box(0.06, 0.07, 0.94), trim, { x: -0.23, y: 0.6, z: 0.05 }));
    bar(p, cloth, 0.16, 0.6, 0.05, 0.47, 0.3, 0.05, 0.92, 0.05);
    p.push(part(box(0.28, 0.32, 0.55), PAL.nau, { x: 0.55, y: 0.33, z: 0.05 }), part(box(0.14, 0.28, 0.08), PAL.nau, { x: 0.68, y: 0.35, z: 0.31 }), part(box(0.14, 0.24, 0.08), PAL.nau, { x: 0.68, y: 0.35, z: -0.21 }));
    bar(p, PAL.then, 0.55, 0.22, 0.05, 0.98, 0.03, 0.22, 0.04, 0.02); p.push(part(box(0.14, 0.04, 0.12), PAL.sat, { x: 1.02, y: 0.03, z: 0.24 }));
    for (let i = 0, n = rng.int(1, 4); i < n; i++) {                                                                 // tên cắm sườn
      const dx = rng.range(-0.5, 0.5), dz = rng.range(-0.5, 0.5), l = Math.hypot(dx, 1, dz);
      arrow(p, rng.range(-0.25, 0.25), 0.58, rng.range(-0.75, 0.7), dx / l, 1 / l, dz / l);
    }
    return merge(p);
  };

  // ---- lũy, hào (đoạn thẳng a → b; s mét dọc tim từ a, d mét lệch về phía tây) ----------------------------------
  const banner = (x, z, lean, ry) => {
    const y = gy(x, z) - 0.3, h = 3.3, a = rng.range(0, 6.28);
    const tx = x + Math.cos(a) * Math.sin(lean) * h, ty = y + Math.cos(lean) * h, tz = z + Math.sin(a) * Math.sin(lean) * h, k = (h - 0.38) / h;
    rod(big, 0x3a2c20, x, y, z, tx, ty, tz, 0.05, { sides: 5, tip: 0.28, tipCol: PAL.sat });
    big.push(torn.clone().applyMatrix4(_M.compose(_v.set(x + (tx - x) * k, y + (ty - y) * k, z + (tz - z) * k), _qa.setFromEuler(_eo.set(0, ry, rng.range(-0.1, 0.1))), _s.set(1, 1, 1))));
  };
  // cờ đuôi ngựa (tua lông đen rủ dưới đĩa, chĩa ba trên đỉnh) — dáng cờ Mông Cổ nhận ra từ xa
  const tug = (x, z) => {
    const y = gy(x, z) - 0.3, h = 4.0;
    rod(big, 0x3a2c20, x, y, z, x, y + h, z, 0.05, { sides: 5 });
    big.push(part(cyl(0.2, 0.2, 0.06, 8), PAL.xam, { x, y: y + h - 0.2, z }), part(cone(0.26, 0.9, 7), 0x221b16, { x, y: y + h - 0.68, z, rx: Math.PI }),
      part(box(0.34, 0.035, 0.035), PAL.sat, { x, y: y + h + 0.02, z }));
    for (const o of [-0.16, 0, 0.16]) big.push(part(cone(0.035, o ? 0.24 : 0.36, 4), PAL.sat, { x: x + o, y: y + h + (o ? 0.14 : 0.2), z }));
  };

  // Lũy Nguyên: hàng cọc nhọn trên đỉnh ngả về tây, hai nẹp buộc; kè ván / phên đan mái trước; cờ rách, cờ đuôi
  // ngựa; tên cắm mái trước. Chỗ vỡ: gốc cọc gãy hai mép, cọc đổ ngổn ngang, ván kè bong dưới chân, đất lở.
  const LEAN = 0.37;
  function rampart({ f, ux, uz, wx, wz, P, gd }) {
    let k = 0;
    for (let s = 0.35; s < f.len - 0.3; s += 0.4 + rng.range(-0.05, 0.07), k++) {
      const g = gd(s); if (g < 0) continue;
      const edge = g < 2.2; if (edge && rng.chance(0.3)) continue;
      const [x, z] = P(s, -0.25), y = gy(x, z) - 0.3;
      const th = edge ? rng.range(0.4, 1.05) : LEAN - 0.07 + (k % 2) * 0.14 + rng.range(-0.05, 0.05);
      const len = edge && rng.chance(0.45) ? rng.range(0.6, 1.2) : rng.range(1.8, 2.1) + (k % 3 === 0 ? 0.22 : 0);
      const j = edge ? rng.range(-0.35, 0.35) : rng.range(-0.1, 0.1);
      const tx = x + (wx * Math.sin(th) + ux * j) * len, ty = y + Math.cos(th) * len, tz = z + (wz * Math.sin(th) + uz * j) * len;
      if (len < 1.5) { rod(big, rng.pick(WOOD), x, y, z, tx, ty, tz, 0.075, { sides: 5, cap: true }); splinter(big, tx, ty, tz); }
      else rod(big, rng.pick(WOOD), x, y, z, tx, ty, tz, 0.075, { sides: 5, tip: 0.38, tipCol: FRESH });
    }
    // hai nẹp ngang buộc hàng cọc, từng khúc ~3 m bám đỉnh lũy; bỏ gần chỗ vỡ
    for (let s = 0.4; s < f.len - 0.5; s += 3) {
      const e = Math.min(s + 3, f.len - 0.4); if (gd(s) < 2.4 || gd(e) < 2.4 || gd((s + e) / 2) < 2.4) continue;
      const [bx0, bz0] = P(s, -0.25), [bx1, bz1] = P(e, -0.25), y0 = gy(bx0, bz0) - 0.3, y1 = gy(bx1, bz1) - 0.3;
      for (const l of [0.75, 1.45]) {
        const off = -0.25 + l * Math.sin(LEAN), [x0, z0] = P(s, off), [x1, z1] = P(e, off);
        bar(big, ROPE, x0, y0 + l * Math.cos(LEAN), z0, x1, y1 + l * Math.cos(LEAN), z1, 0.07, 0.06);
      }
    }
    // Kè mái trước (phía tây, từ mép đỉnh xuống chân mái liền vách hào), chia khoang dài 1,4–2,4 m không đều:
    // khoang ván 2–5 tấm rộng hẹp khác nhau, xiên lệch, dài ngắn khác nhau (tấm gãy cụt, tấm tuột xuống chân, tấm
    // mất); khoang phên đan cũ mép trên rách, nẹp ngang buộc; khoang bỏ trống lộ đất (ván rơi nằm dưới chân). Cọc
    // giữ chân kè ở ranh khoang, nẹp ngang giữa mái ở vài khoang ván. Mọi tấm áp theo mặt dốc (hug).
    const dTop = f.crest + 0.1, dBot = f.reach - 0.1, dq = (q) => dBot + (dTop - dBot) * q;   // q: 0 chân mái → 1 mép đỉnh
    const stake = (s) => {                                                         // cọc giữ chân kè, ngả vào mái
      const [x, z] = P(s, dBot + rv.range(-0.05, 0.15)), y = gy(x, z) - 0.2, h = rv.range(0.6, 0.95), k = rv.range(0.15, 0.4);
      rod(big, rv.pick(WOOD), x, y, z, x - wx * h * k, y + h, z - wz * h * k, 0.05, { sides: 5, cap: true });
    };
    for (let s = 0.9 + rv.range(0, 0.6); s < f.len - 1.2;) {
      const s0 = s, s1 = Math.min(f.len - 0.8, s + rv.range(1.4, 2.4));
      s = s1 + rv.range(0.02, 0.25);
      if (gd(s0) < 1.3 || gd(s1) < 1.3) continue;
      const kind = rv.next();
      if (kind < 0.18) {                                                           // khoang trống: ván rơi nằm dưới chân
        if (rv.chance(0.6)) { const [x0, z0] = P(rv.range(s0, s1), dBot + rv.range(0.2, 0.9)), a = rv.range(0, 6.28), L = rv.range(0.9, 1.9);
          hug(big, rv.pick(PLANK), x0, z0, x0 + Math.cos(a) * L, z0 + Math.sin(a) * L, rv.range(0.2, 0.3), 0.045, 0.035, rv.range(-0.15, 0.15)); }
        continue;
      }
      if (rv.chance(0.6)) stake(s0 + rv.range(-0.05, 0.05));
      if (kind < 0.34) {                                                           // phên đan cũ, mép trên rách, 2–3 nẹp buộc
        const m = (s0 + s1) / 2, q1 = rv.range(0.62, 0.95), sk = rv.range(-0.12, 0.12), w = s1 - s0 - rv.range(0.05, 0.3);
        const [bx, bz] = P(m, dq(0)), [tx, tz] = P(m + sk, dq(q1));
        hug(big, WICKER_OLD, bx, bz, tx, tz, w, 0.05, 0.05);
        for (const q of [0.2, 0.52, 0.8]) {
          if (q > q1 - 0.08) continue;
          const [ax, az] = P(s0 + 0.12, dq(q)), [cx, cz] = P(s1 - 0.12, dq(q));
          bar(big, LASH, ax, gy(ax, az) + 0.1, az, cx, gy(cx, cz) + 0.1, cz, 0.06, 0.05);
        }
        continue;
      }
      // khoang ván: 2–5 tấm rộng 0,16–0,34 m, khe hở không đều, một vài tấm mất / gãy / tuột
      for (let c = s0 + rv.range(0.05, 0.15); c < s1 - 0.12;) {
        const w = rv.range(0.16, 0.34), cc = c + w / 2; c += w + rv.range(0.02, 0.14);
        if (rv.chance(0.14)) continue;
        let q0 = rv.range(0, 0.1), q1 = rv.chance(0.15) ? rv.range(0.4, 0.72) : rv.range(0.84, 1.0), sk = rv.range(-0.14, 0.14);
        if (rv.chance(0.08)) { const dn = rv.range(0.15, 0.3); q0 -= dn; q1 -= dn; sk *= 2.2; }   // tuột xuống chân
        const [bx, bz] = P(cc, dq(q0)), [tx, tz] = P(cc + sk, dq(q1));
        hug(big, rv.pick(PLANK), bx, bz, tx, tz, w, 0.045, 0.05, rv.range(-0.1, 0.1));
      }
      if (rv.chance(0.4)) {                                                        // nẹp ngang giữa mái
        const q = rv.range(0.35, 0.55), [ax, az] = P(s0 + 0.08, dq(q)), [cx, cz] = P(s1 - 0.08, dq(q));
        bar(big, LASH, ax, gy(ax, az) + 0.1, az, cx, gy(cx, cz) + 0.1, cz, 0.07, 0.06);
      }
    }
    // cờ chàm rách hai bên lối vỡ chính và giữa lũy (một cán xiêu), cờ đuôi ngựa bên kia lối vỡ; mặt cờ quay về tây
    const main = f.gaps.reduce((a, g) => (g[1] - g[0] > a[1] - a[0] ? g : a)), m0 = main[0] * f.len, m1 = main[1] * f.len;
    const face = Math.atan2(wx, wz);
    for (const [s, lean] of [[m0 - 2.4, 0.06], [m1 + 5.5, 0.1], [f.len * 0.12, 0.42], [f.len * 0.94, 0.05]]) if (s > 0.5 && s < f.len - 0.5 && gd(s) > 1) banner(...P(s, -0.75), lean, face + rng.range(-0.35, 0.35));
    if (gd(m1 + 2.6) > 1) tug(...P(m1 + 2.6, -0.8));
    // tên cắm mái trước (bắn từ phía tây, cắm chúc xuống)
    for (let i = 0, n = Math.round(f.len * 0.7); i < n; i++) {
      const s = rng.range(0.5, f.len - 0.5); if (gd(s) < 0.6) continue;
      const [x, z] = P(s, rng.range(f.crest - 0.3, f.reach + 0.8));
      const dx = wx * 0.85 + rng.range(-0.3, 0.3), dy = 0.5 + rng.range(-0.15, 0.3), dz = wz * 0.85 + rng.range(-0.3, 0.3), l = Math.hypot(dx, dy, dz);
      arrow(small, x, gy(x, z), z, dx / l, dy / l, dz / l);
    }
    // chỗ vỡ
    for (const [g0, g1] of f.gaps) {
      const a0 = g0 * f.len, a1 = g1 * f.len;
      for (const [sa, sb] of [[a0, a0 + 1.6], [a1 - 1.6, a1]]) for (let s = sa; s < sb; s += 0.42) {    // gốc cọc gãy hai mép
        if (rng.chance(0.3)) continue;
        const [x, z] = P(s, -0.25 + rng.range(-0.25, 0.25)), y = gy(x, z) - 0.15, len = rng.range(0.25, 0.7), th = rng.range(0, 0.45), a = rng.range(0, 6.28);
        const tx = x + Math.cos(a) * Math.sin(th) * len, ty = y + Math.cos(th) * len, tz = z + Math.sin(a) * Math.sin(th) * len;
        rod(big, rng.pick(WOOD), x, y, z, tx, ty, tz, 0.075, { sides: 5, cap: true }); splinter(big, tx, ty, tz);
      }
      for (let i = 0, n = Math.round((a1 - a0) * 0.8) + 3; i < n; i++) {                              // cọc đổ ngổn ngang
        const [x, z] = P(rng.range(a0 - 1.5, a1 + 1.5), rng.range(-f.reach, f.reach + 1.2));
        const a = Math.atan2(uz, ux) + Math.PI / 2 + rng.range(-1, 1) + (rng.chance(0.5) ? Math.PI : 0);
        lying(big, rng.pick(WOOD), x, z, a, rng.range(1.4, 2.2), 0.075, { sides: 5, tip: 0.38, tipCol: FRESH, cap: true });
      }
      for (let i = 0; i < 4; i++) {                                                                  // ván kè bong nằm dưới chân, vài tấm gãy
        const [x, z] = P(rv.range(a0 - 2, a1 + 2), f.reach + rv.range(0, 1.4)), a = rv.range(0, 6.28), len = rv.chance(0.4) ? rv.range(0.6, 1.1) : rv.range(1.3, 2.1);
        hug(big, rv.pick(PLANK), x, z, x + Math.cos(a) * len, z + Math.sin(a) * len, rv.range(0.18, 0.32), 0.045, 0.035, rv.range(-0.2, 0.2));
      }
      for (let i = 0; i < 10; i++) { const [x, z] = P(rng.range(a0, a1), rng.range(-f.reach, f.reach)); clod(x, z, rng.range(0.12, 0.3)); }   // đất lở
    }
  }
  // Ụ đất quân ta: cọc tre vót chĩa về phía Nguyên (đông), sọt đất trên đỉnh (vài sọt chồng, vài sọt đổ), khiên
  // nhật dựng tựa sườn sau (phía tây, mặt son hướng về quân ta), cờ đuôi nheo son
  function earthwork({ f, ux, uz, wx, wz, P }, flag) {
    for (let s = 0.4; s < f.len - 0.3; s += 0.5 + rng.range(-0.05, 0.08)) {
      if (rng.chance(0.14)) continue;
      const [x, z] = P(s, -(f.crest + 0.3)), y = gy(x, z) - 0.25, th = rng.range(0.5, 0.78), len = rng.range(1.25, 1.7), j = rng.range(-0.12, 0.12);
      rod(big, rng.pick(BAMBOO), x, y, z, x + (-wx * Math.sin(th) + ux * j) * len, y + Math.cos(th) * len, z + (-wz * Math.sin(th) + uz * j) * len, 0.045, { sides: 5, tip: 0.3, tipCol: BAMBOO_TIP });
    }
    for (let s = 0.8; s < f.len - 0.6; s += 1.2) {
      if (rng.chance(0.2)) continue;
      if (rng.chance(0.14)) {                                                     // sọt đổ lăn xuống sườn sau, đất vãi
        const [x, z] = P(s, f.crest + 0.9);
        drop(big, basket, x, z, rng.range(0, 6.28), { rx: 1.5, dy: 0.24, tilt: 0.5 });
        for (let i = 0; i < 4; i++) clod(x + rng.range(-0.6, 0.6), z + rng.range(-0.6, 0.6), rng.range(0.1, 0.2));
        continue;
      }
      const [x, z] = P(s, rng.range(0, 0.3));
      drop(big, basket, x, z, rng.range(0, 6.28), { tilt: 0.6, dy: -0.05 });
      if (rng.chance(0.3)) drop(big, basket, x + rng.range(-0.06, 0.06), z + rng.range(-0.06, 0.06), rng.range(0, 6.28), { tilt: 0.6, dy: 0.44 });
    }
    for (const q of [0.3, 0.72]) {
      const [x0, z0] = P(f.len * q, f.crest + f.slope * 0.45), [x1, z1] = P(f.len * q, f.crest + f.slope * 0.45 + 0.4);
      const slope = Math.atan2(Math.max(0, gy(x0, z0) - gy(x1, z1)), 0.4);      // dốc sườn sau chỗ dựng khiên
      for (let i = 0, n = 3 + (rng.chance(0.5) ? 1 : 0); i < n; i++) {
        const [x, z] = P(f.len * q + rng.range(-0.1, 0.1), f.crest + f.slope * 0.45 + i * 0.1);
        drop(big, nhat, x, z, Math.atan2(wx, wz) + rng.range(-0.15, 0.15), { tilt: 0, rx: -(Math.PI / 2 - slope) + 0.12 + i * 0.07, dy: -0.03 });
      }
    }
    if (flag) {
      const [x, z] = P(f.len * 0.5, 0.2), y = gy(x, z) - 0.3;
      rod(big, PAL.then, x, y, z, x, y + 3.0, z, 0.04, { sides: 5 });
      big.push(part(ico(0.07, 0), PAL.vang, { x, y: y + 3.05, z }));
      big.push(pennant.clone().applyMatrix4(_M.compose(_v.set(x, y + 2.95, z), _qa.setFromEuler(_eo.set(0, Math.atan2(wx, wz) + rng.range(-0.5, 0.5), 0.06)), _s.set(1, 1, 1))));
    }
  }
  // Hào trước lũy: cọc đổ xuống lòng hào hai bên lối đất đắp, một tấm ván bắc tạm sụt xuống đáy mỗi bên lối chính
  function ditch({ f, P, gd }) {
    const main = f.gaps.reduce((a, g) => (g[1] - g[0] > a[1] - a[0] ? g : a));
    for (const g of f.gaps) for (const side of [-1, 1]) {
      const e = (side < 0 ? g[0] : g[1]) * f.len;
      for (let i = 0; i < 4; i++) {
        const s = e + side * rng.range(0.8, 7); if (s < 0.5 || s > f.len - 0.5 || gd(s) < 0.5) continue;
        const [x, z] = P(s, rng.range(-f.bottom, f.bottom));
        lying(big, rng.pick(WOOD), x, z, rng.range(0, 6.28), rng.range(1.3, 2.0), 0.07, { sides: 5, tip: 0.35, tipCol: FRESH, cap: true });
      }
      if (g !== main) continue;
      const s = e + side * rng.range(2, 5); if (gd(s) < 1) continue;
      const [ax, az] = P(s, f.reach + 0.4), [bx, bz] = P(s + rng.range(-0.6, 0.6), rng.range(-0.3, 0.4));
      bar(big, rng.pick(PLANK), ax, gy(ax, az) + 0.05, az, bx, gy(bx, bz) + 0.05, bz, 0.42, 0.06, rng.range(-0.15, 0.15));
    }
  }
  // Hào thành: cọc nhọn mép trong (phía tường) chĩa ra hào, dày gần hai cổng, thưa từng cụm nơi khác
  function moat({ f, ux, uz, wx, wz, P }) {
    for (let s = 2.2; s < f.len - 2.2; s += 0.75) {
      const [, cz] = P(s, 0), gate = Math.min(Math.abs(cz + 75), Math.abs(cz - 75)) < 36;
      if (vnoise(s * 0.2, f.ax * 0.07 + f.az * 0.05) < (gate ? 0.25 : 0.62)) continue;
      const [x, z] = P(s + rng.range(-0.15, 0.15), -(f.bottom + f.slope * 0.75) + rng.range(-0.2, 0.2)), y = gy(x, z) - 0.25;
      const th = rng.range(0.55, 0.85), len = rng.range(1.5, 1.95), j = rng.range(-0.15, 0.15);
      rod(big, rng.pick(WOOD), x, y, z, x + (wx * Math.sin(th) + ux * j) * len, y + Math.cos(th) * len, z + (wz * Math.sin(th) + uz * j) * len, 0.07, { sides: 5, tip: 0.34, tipCol: FRESH });
    }
  }
  let pennants = 0;
  for (const f of TERRAIN_FEATURES) {
    if (f.type !== "berm" && f.type !== "ditch") continue;
    const ux = f.dx / f.len, uz = f.dz / f.len;
    let wx = -uz, wz = ux; if (wx > 0) { wx = -wx; wz = -wz; }                   // w: pháp tuyến ngang về phía tây (phía quân ta tới)
    const P = (s, d) => [f.ax + ux * s + wx * d, f.az + uz * s + wz * d];
    const gd = (s) => {                                                          // khoảng cách tới mép chỗ vỡ gần nhất (âm: trong chỗ vỡ)
      let m = Infinity;
      for (const [g0, g1] of f.gaps) { const s0 = g0 * f.len, s1 = g1 * f.len; m = Math.min(m, s > s0 && s < s1 ? -Math.min(s - s0, s1 - s) : Math.min(Math.abs(s - s0), Math.abs(s - s1))); }
      return m;
    };
    const L = { f, ux, uz, wx, wz, P, gd };
    if (f.kind === "luy_nguyen") rampart(L);
    else if (f.kind === "u_ta") earthwork(L, pennants++ % 2 === 0);
    else if (f.kind === "hao_luy") ditch(L);
    else if (f.kind === "hao_thanh") moat(L);
  }

  // ---- hố: chông tre (hố chông), đất vãi quanh miệng (hố đất), lau sậy và cán giáo gãy (hố ngập) --------------
  const spearHead = (x, z, a, tassel) => {
    const ex = x + Math.cos(a) * 0.6, ez = z + Math.sin(a) * 0.6, y0 = gy(x, z) + 0.03, y1 = gy(ex, ez) + 0.03;
    rod(small, PAL.go, x, y0, z, ex, y1, ez, 0.024, { sides: 4, cap: true });
    const hx = ex + Math.cos(a) * 0.3, hz = ez + Math.sin(a) * 0.3;
    rod(small, PAL.sat, ex, y1, ez, hx, gy(hx, hz) + 0.03, hz, 0.05, { sides: 4, tip: 0.3 });
    small.push(part(ico(0.07, 0), tassel, { x: ex, y: y1 + 0.03, z: ez }));
    splinter(small, x, y0, z);
  };
  for (const p of TERRAIN_FEATURES) {
    if (p.type !== "pit") continue;
    if (p.kind === "chong") {
      for (let i = 0, n = Math.round(p.r * 8); i < n; i++) {
        const a = rng.range(0, 6.28), rr = Math.sqrt(rng.next()) * p.r * 0.66, x = p.x + Math.cos(a) * rr, z = p.z + Math.sin(a) * rr, y = gy(x, z) - 0.12;
        const len = rng.range(0.65, 1.05), b = rng.range(0, 6.28), th = rng.range(0, 0.22), broken = rng.chance(0.12);
        const tx = x + Math.cos(b) * Math.sin(th) * len, ty = y + Math.cos(th) * len * (broken ? 0.6 : 1), tz = z + Math.sin(b) * Math.sin(th) * len;
        rod(big, rng.pick(BAMBOO), x, y, z, tx, ty, tz, 0.042, broken ? { sides: 4, cap: true } : { sides: 4, tip: 0.26, tipCol: BAMBOO_TIP });
      }
      // tấm phên che hố bị giẫm sụt: một mép còn vắt trên miệng, mép kia chúi xuống tì lên đầu chông
      const a = rng.range(0, 6.28), ca = Math.cos(a), sa = Math.sin(a);
      const ex = p.x + ca * p.r * 1.12, ez = p.z + sa * p.r * 1.12, ix = p.x + ca * p.r * 0.3, iz = p.z + sa * p.r * 0.3;
      bar(big, WICKER, ex, gy(ex, ez) + 0.05, ez, ix, gy(ix, iz) + 0.62, iz, 1.3, 0.04, rng.range(-0.25, 0.25));
      const b = a + rng.range(1.8, 2.6), fx = p.x + Math.cos(b) * p.r * 1.25, fz = p.z + Math.sin(b) * p.r * 1.25;
      bar(big, WICKER, fx, gy(fx, fz) + 0.04, fz, fx + Math.cos(b + 1.4) * 1.1, gy(fx + Math.cos(b + 1.4) * 1.1, fz + Math.sin(b + 1.4) * 1.1) + 0.04, fz + Math.sin(b + 1.4) * 1.1, 0.9, 0.04);
    } else if (p.kind === "dat") {
      for (let i = 0; i < 20; i++) { const a = rng.range(0, 6.28), rr = p.r * rng.range(0.85, 1.5); clod(p.x + Math.cos(a) * rr, p.z + Math.sin(a) * rr, rng.range(0.1, 0.3)); }
      const a = rng.range(0, 6.28);
      spearHead(p.x + Math.cos(a) * p.r * 0.4, p.z + Math.sin(a) * p.r * 0.4, a + rng.range(-1, 1), rng.pick([PAL.son, PAL.long]));
    } else {
      for (let c = 0; c < 4; c++) {
        const a0 = rng.range(0, 6.28);
        for (let i = 0; i < 3; i++) {
          const a = a0 + rng.range(-0.28, 0.28), rr = p.r * rng.range(0.95, 1.25);
          drop(small, reeds, p.x + Math.cos(a) * rr, p.z + Math.sin(a) * rr, rng.range(0, 6.28), { tilt: 0.4, dy: -0.05, s: rng.range(0.75, 1.2) });
        }
      }
      // cán giáo gãy chúi xuống nước, mũi giáo văng lên bờ
      const a = rng.range(0, 6.28), x0 = p.x + Math.cos(a) * p.r * 0.35, z0 = p.z + Math.sin(a) * p.r * 0.35, y0 = gy(x0, z0) - 0.1;
      const tx = x0 + Math.cos(a) * 0.75, tz = z0 + Math.sin(a) * 0.75, ty = y0 + 1.05;
      rod(small, PAL.go, x0, y0, z0, tx, ty, tz, 0.028, { sides: 4, cap: true }); splinter(small, tx, ty, tz);
      spearHead(p.x + Math.cos(a + 0.7) * p.r * 1.3, p.z + Math.sin(a + 0.7) * p.r * 1.3, rng.range(0, 6.28), PAL.long);
    }
  }

  // ---- rào ruộng, cự mã ---------------------------------------------------------------------------------------
  const cuma = LANE_TERRAIN.fences.filter((f) => f.kind === "cu_ma").map((f) => ({ x0: f.a[0], z0: f.a[1], x1: f.b[0], z1: f.b[1] }));
  const nearCuMa = (x, z, pad) => cuma.some((c) => segDist(c, x, z) < pad);
  // Rào ruộng: tre chẻ, cột ~2 m, hai thanh ngang; đoạn vỡ bỏ trống (cột đổ nằm, thanh rũ xuống đất); cột xiêu,
  // cột đổ, thanh tuột một đầu rải rác. Dừng trước hàng cự mã. Không va chạm.
  function raoRuong(ax, az, L, ux, uz, inGap) {
    const posts = [];
    for (let s = 0; s <= L + 0.01; s += 2) {
      const ss = Math.min(L, Math.max(0, s + rng.range(-0.25, 0.25))), x = ax + ux * ss, z = az + uz * ss;
      const r = rng.next();
      if (inGap(ss) || nearCuMa(x, z, 1.4) || r < 0.06) {                           // khoảng vỡ / cột đổ
        posts.push(null);
        if ((inGap(ss) && r < 0.55) || r < 0.06) lying(big, rng.pick(POST), x, z, rng.range(0, 6.28), rng.range(0.8, 1.2), 0.045, { sides: 5, cap: true });
        continue;
      }
      const lean = r < 0.18 ? rng.range(0.3, 0.55) : r < 0.4 ? rng.range(0.08, 0.2) : rng.range(0, 0.05);
      const side = rng.chance(0.5) ? 1 : -1, la = rng.range(-0.4, 0.4), nx = -uz * side + ux * la, nz = ux * side + uz * la, nl = Math.hypot(nx, nz);
      const dx = nx / nl * Math.sin(lean), dy = Math.cos(lean), dz = nz / nl * Math.sin(lean), y = gy(x, z) - 0.2, h = rng.range(1.15, 1.35);
      rod(big, rng.pick(POST), x, y, z, x + dx * h, y + dy * h, z + dz * h, 0.045, { sides: 5, cap: true });
      posts.push({ x, y, z, dx, dy, dz });
    }
    const at = (p, h) => [p.x + p.dx * h, p.y + p.dy * h, p.z + p.dz * h];
    const rail = (A, B) => {
      const vx = B[0] - A[0], vy = B[1] - A[1], vz = B[2] - A[2], vl = Math.hypot(vx, vy, vz) || 1, e = 0.12 / vl;
      bar(big, rng.pick(RAIL), A[0] - vx * e, A[1] - vy * e, A[2] - vz * e, B[0] + vx * e, B[1] + vy * e, B[2] + vz * e, 0.035, 0.08);
    };
    for (let i = 0; i + 1 < posts.length; i++) {
      const p0 = posts[i], p1 = posts[i + 1];
      for (const h of [0.62, 1.02]) {                                            // đo từ gốc chôn 0,2 m: thanh cách đất 0,42 và 0,82 m
        if (p0 && p1) {
          if (rng.chance(0.1)) continue;                                           // mất thanh
          const A = at(p0, h), B = at(p1, h);
          if (rng.chance(0.13)) {                                                  // tuột một đầu, rũ xuống đất
            const [hang, o] = rng.chance(0.5) ? [A, p1] : [B, p0], gx = o.x + rng.range(-0.3, 0.3), gz = o.z + rng.range(-0.3, 0.3);
            rail(hang, [gx, gy(gx, gz) + 0.04, gz]);
          } else rail(A, B);
        } else if ((p0 || p1) && rng.chance(0.6)) {                                // thanh gãy thò vào khoảng vỡ, đầu kia chạm đất
          const p = p0 || p1, d = p0 ? 1 : -1, l = rng.range(1.1, 1.7), q = rng.range(-0.4, 0.4);
          const gx = p.x + ux * d * l - uz * q, gz = p.z + uz * d * l + ux * q;
          rail(at(p, h), [gx, gy(gx, gz) + 0.04, gz]);
        }
      }
    }
  }
  // Cự mã (ngựa gỗ chông của quân Nguyên): súc gỗ nằm ngang, cọc vót xuyên chéo thành hình X. Đoạn vỡ (gaps) và
  // đoạn rơi xuống hố: khung xô lệch, đổ nghiêng, gãy bớt cọc, cọc rời nằm quanh. Không có va chạm (xem đầu
  // addLaneProps: lính không tìm đường nên hàng dài ghim cả toán lính).
  const chevalGeo = (Lu, broken) => {
    const p = [], yl = 0.8;
    rod(p, BARK, 0, yl, -Lu / 2, 0, yl, Lu / 2, 0.13, { sides: 6, cap: true });
    let k = 0;
    for (let zz = -Lu / 2 + 0.3; zz <= Lu / 2 - 0.25; zz += 0.6, k++) for (const sg of [-1, 1]) {
      if (broken && rng.chance(0.3)) continue;
      const a = sg * 0.78 + (k % 2 ? 0.08 : -0.08) + rng.range(-0.05, 0.05), half = broken && rng.chance(0.3) ? 0.45 : 1.15, sx = Math.sin(a), cy = Math.cos(a);
      rod(p, rng.pick(WOOD), -sx * 1.15, yl - cy * 1.15, zz, sx * half, yl + cy * half, zz, 0.055, half > 1 ? { sides: 4, tip: 0.32, tipCol: FRESH } : { sides: 4, cap: true });
    }
    return merge(p);
  };
  // đặt khung (gốc ở mặt đất giữa súc gỗ) theo hai đầu súc; roll xoay quanh súc (khung lật nghiêng)
  const placeCheval = (g, x0, y0, z0, x1, y1, z1, roll = 0) => {
    _Z.set(x1 - x0, y1 - y0, z1 - z0).normalize(); _X.crossVectors(_up, _Z).normalize(); _Y.crossVectors(_Z, _X);
    if (roll) { const c = Math.cos(roll), s = Math.sin(roll); _T.copy(_X).multiplyScalar(c).addScaledVector(_Y, s); _Y.multiplyScalar(c).addScaledVector(_X, -s); _X.copy(_T); }
    big.push(g.applyMatrix4(_M.makeBasis(_X, _Y, _Z).setPosition((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)));
  };
  function cuMa(ax, az, L, ux, uz, inGap) {
    const n = Math.max(1, Math.round(L / 3.4)), Lu = L / n;
    for (let k = 0; k < n; k++) {
      const s0 = k * Lu + 0.06, s1 = (k + 1) * Lu - 0.06, x0 = ax + ux * s0, z0 = az + uz * s0, x1 = ax + ux * s1, z1 = az + uz * s1;
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      const pit = TERRAIN_FEATURES.some((p) => p.type === "pit" && Math.hypot(cx - p.x, cz - p.z) < p.r * 1.15);
      if (!inGap((s0 + s1) / 2) && !pit) { placeCheval(chevalGeo(s1 - s0, false), x0, gy(x0, z0), z0, x1, gy(x1, z1), z1); continue; }
      if (pit) { placeCheval(chevalGeo(s1 - s0, true), x0, gy(x0, z0) - 0.15, z0, x1, gy(x1, z1) - 0.15, z1, rng.range(-0.3, 0.3)); continue; }   // chúi xuống hố
      // bị xô về phía đông (quân ta phá hàng), xoay lệch, một đầu sụp; cọc rời nằm quanh
      const yaw = rng.range(-0.7, 0.7), c = Math.cos(yaw), s = Math.sin(yaw), dx = ux * c - uz * s, dz = uz * c + ux * s, half = (s1 - s0) * 0.45;
      const mx = cx + rng.range(0.6, 2.0), mz = cz + rng.range(-0.5, 0.5), px0 = mx - dx * half, pz0 = mz - dz * half, px1 = mx + dx * half, pz1 = mz + dz * half;
      placeCheval(chevalGeo(half * 2, true), px0, gy(px0, pz0) - 0.35, pz0, px1, gy(px1, pz1), pz1, rng.range(-0.5, 0.5));
      for (let i = 0; i < 3; i++) lying(big, rng.pick(WOOD), mx + rng.range(-1.6, 1.6), mz + rng.range(-1.6, 1.6), rng.range(0, 6.28), rng.range(1.2, 2.2), 0.055, { sides: 4, tip: 0.3, tipCol: FRESH, cap: true });
    }
  }
  for (const f of LANE_TERRAIN.fences) {
    const [ax, az] = f.a, [bx, bz] = f.b, L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L;
    const inGap = (s) => f.gaps.some(([g0, g1]) => s > g0 * L && s < g1 * L);
    if (f.kind === "rao_ruong") raoRuong(ax, az, L, ux, uz, inGap); else cuMa(ax, az, L, ux, uz, inGap);
  }

  // ---- xác ngựa (vài con yên son của quân Ta ở bãi giằng co), đồ của kỵ sĩ ngã cạnh con có rider ------------------
  const COAT = [PAL.ngua, 0x7a4a2a, 0x4a3a2e, 0x8a8274, 0x9a7a52, 0x5a4232];          // nâu, hồng, hạt dẻ sẫm, xám, vàng đất
  const NG = [[CHAM, PAL.xam], [PAL.thep, CHAM], [0x3d5a78, PAL.xam], [PAL.long, CHAM]];
  LANE_TERRAIN.horses.forEach((h, i) => {
    const tran = !h.rider && h.x < 275 && i % 2 === 1, [cloth, trim] = tran ? [PAL.son, PAL.vang] : NG[i % NG.length];
    drop(big, horseGeo(COAT[i % COAT.length], cloth, trim), h.x, h.z, h.ry, { dy: -0.05 });
    // va chạm: đoạn dọc thân lệch về phía chân (lx, lz: hướng −x cục bộ; fx, fz: hướng đầu)
    const fx = Math.sin(h.ry), fz = Math.cos(h.ry), lx = -Math.cos(h.ry), lz = Math.sin(h.ry);
    solid(h.x - fx * 0.55 + lx * 0.3, h.z - fz * 0.55 + lz * 0.3, h.x + fx * 0.75 + lx * 0.3, h.z + fz * 0.75 + lz * 0.3, 1.0);
    if (!h.rider) return;
    // mũ, cung, ống tên văng về phía lưng ngựa (vướng hào, cự mã thì sang phía chân), khiên tròn, bó tên
    const at = (b, fw) => {
      let x = h.x - lx * b + fx * fw, z = h.z - lz * b + fz * fw;
      if (onWork(x, z) || nearCuMa(x, z, 1.1)) { x = h.x + lx * (b + 1.4) + fx * fw; z = h.z + lz * (b + 1.4) + fz * fw; }
      return [x, z];
    };
    let [x, z] = at(1.4, 0.8); drop(small, helmNg, x, z, rng.range(0, 6.28), { rz: 1.3, dy: 0.16 });
    [x, z] = at(1.2, -0.6); drop(small, bow, x, z, rng.range(0, 6.28));
    [x, z] = at(1.9, 0.1); drop(small, quiver, x, z, rng.range(0, 6.28));
    [x, z] = at(0.9, -1.8); shields.put(x, gy(x, z) + 0.05, z, rng.range(0, 6.28), 1, 1, rng.pick([PAL.nau, PAL.long]), rng.range(-0.1, 0.1), rng.range(-0.1, 0.1));
    for (let k = 0; k < 2; k++) { [x, z] = at(rng.range(1, 2.4), rng.range(-1.5, 1.5)); arrows.put(x, gy(x, z) - 0.1, z, rng.range(0, 6.28), 1, 1, null, rng.range(-0.3, 0.3), rng.range(-0.3, 0.3)); }
  });

  // ---- đồ rơi dày thêm ở bãi giằng co (x 228–300) và trước cổng (x 404–452) -------------------------------------
  const brokenSpear = (x, z, tassel) => {
    const a = rng.range(0, 6.28);
    spearHead(x, z, a, tassel);
    const b = a + Math.PI + rng.range(-1.2, 1.2), bx = x + Math.cos(b) * 0.4, bz = z + Math.sin(b) * 0.4;
    lying(small, PAL.go, bx, bz, b + rng.range(-0.8, 0.8), rng.range(0.7, 1.2), 0.024, { sides: 4, cap: true });
  };
  const straw = (x, z) => {
    drop(small, part(disk, rng.pick(STRAW), { sx: rng.range(0.7, 1.3), sz: rng.range(0.45, 0.8) }), x, z, rng.range(0, 6.28), { dy: 0.03 });
    for (let i = 0; i < 7; i++) {
      const a = rng.range(0, 6.28), px = x + rng.range(-0.9, 0.9), pz = z + rng.range(-0.6, 0.6), l = rng.range(0.3, 0.6), ex = px + Math.cos(a) * l, ez = pz + Math.sin(a) * l;
      bar(small, rng.pick(STRAW), px, gy(px, pz) + 0.04, pz, ex, gy(ex, ez) + 0.04, ez, 0.03, 0.015);
    }
    if (rng.chance(0.35)) drop(big, bale, x + rng.range(-0.8, 0.8), z + rng.range(-0.8, 0.8), rng.range(0, 6.28), { dy: -0.02, rz: rng.range(-0.1, 0.1) });
  };
  const fallenBanner = (x, z, tran) => {
    const a = rng.range(0, 6.28), L = 3.2;
    if (blocked(x + Math.cos(a) * L, z + Math.sin(a) * L, 0.2)) return;
    lying(small, tran ? PAL.then : PAL.go, x, z, a, L, 0.045, { sides: 5, cap: true });
    const px = -Math.sin(a), pz = Math.cos(a), ca = Math.cos(a), sa = Math.sin(a);
    for (let k = 0; k < 2; k++) {                                                   // lá cờ rũ nằm cạnh đầu cán, nhàu hai mảnh
      const t0 = L - 1.2 + k * 0.56, t1 = t0 + 0.62, o = 0.42 + k * 0.05;
      const x0 = x + ca * t0 + px * o, z0 = z + sa * t0 + pz * o, x1 = x + ca * t1 + px * o, z1 = z + sa * t1 + pz * o;
      bar(small, tran ? PAL.son : CHAM, x0, gy(x0, z0) + 0.03 + k * 0.012, z0, x1, gy(x1, z1) + 0.03 + k * 0.012, z1, 0.76, 0.02, rng.range(-0.08, 0.08));
    }
    const x0 = x + ca * (L - 1.22) + px * 0.06, z0 = z + sa * (L - 1.22) + pz * 0.06, x1 = x + ca * (L - 0.05) + px * 0.06, z1 = z + sa * (L - 0.05) + pz * 0.06;
    bar(small, tran ? PAL.vang : PAL.thep, x0, gy(x0, z0) + 0.05, z0, x1, gy(x1, z1) + 0.05, z1, 0.08, 0.03);
  };
  for (const fr of Object.values(FRONTS)) for (const [x0, x1, k] of [[228, 300, 1], [404, 452, 0.5]]) {
    const lz = fr.laneZ, N = (n) => Math.max(1, Math.round(n * k));
    // bias < 1: dồn về phía đông (chân lũy, trước cổng — nơi tên bắn xuống dày nhất); giữa đường thưa hơn
    const spot = (pad = 0.3, bias = 1) => {
      for (let t = 0; t < 30; t++) {
        const x = x0 + (x1 - x0) * Math.pow(rng.next(), bias), z = lz + rng.range(-22, 22);
        if (Math.abs(z - lz) < 5 && rng.chance(0.6)) continue;
        if (!blocked(x, z, pad)) return [x, z];
      }
      return null;
    };
    const each = (n, fn, pad, bias) => { for (let i = 0; i < N(n); i++) { const p = spot(pad, bias); if (p) fn(p[0], p[1]); } };
    each(50, (x, z) => spears.put(x, gy(x, z) - 0.3, z, rng.range(0, 6.28), 1, 1, null, rng.range(-0.75, 0.75), rng.range(-0.75, 0.75)));
    each(78, (x, z) => arrows.put(x, gy(x, z) - 0.1, z, rng.range(0, 6.28), 1, 1, null, rng.range(-0.35, 0.35), rng.range(-0.35, 0.35)), 0.3, 0.6);
    each(30, (x, z) => shields.put(x, gy(x, z) + 0.04, z, rng.range(0, 6.28), rng.range(0.9, 1.1), 1, rng.pick([PAL.nau, PAL.long, PAL.cham, 0x5a4a3a]), rng.range(-0.12, 0.12), rng.range(-0.12, 0.12)));
    each(14, (x, z) => drop(small, helmNg, x, z, rng.range(0, 6.28), rng.chance(0.55) ? { rz: 1.3, dy: 0.16 } : { dy: -0.02 }));
    each(5, (x, z) => drop(small, helmDv, x, z, rng.range(0, 6.28), rng.chance(0.5) ? { rx: Math.PI, dy: 0.16 } : { rx: 0.35, dy: 0.02 }));
    each(16, (x, z) => brokenSpear(x, z, rng.chance(0.4) ? PAL.son : PAL.long));
    each(5, (x, z) => drop(small, nhat, x, z, rng.range(0, 6.28), { rx: -Math.PI / 2, dy: 0.03 }));
    each(9, (x, z) => straw(x, z), 0.8);
    each(2, (x, z) => fallenBanner(x, z, rng.chance(0.4)), 0.5);
  }

  const bm = new THREE.Mesh(merge(big), seeThrough(lambert(), world)); bm.castShadow = shadows; bm.receiveShadow = true; bm.name = "laneBig"; scene.add(bm);
  const sm = new THREE.Mesh(merge(small), mat); sm.receiveShadow = true; sm.name = "laneSmall"; scene.add(sm);
  let tb = 0, ts = 0;
  for (const g of big) tb += g.attributes.position.count / 3;
  for (const g of small) ts += g.attributes.position.count / 3;
  world.laneProps = { bigTris: tb, smallTris: ts, instances: [spears.count - inst0[0], arrows.count - inst0[1], shields.count - inst0[2]], ms: Math.round(performance.now() - t0) };
}

// Màu thân cây đa dạng cho rừng instanced sẵn có (xanh đậm, xanh vàng, vài cây ngả vàng, đỏ).
export function tintTrees(im, rng) {
  const col = new THREE.Color();
  for (let i = 0; i < im.count; i++) {
    const r = rng.next();
    if (r < 0.07) col.setHSL(0.09 + rng.range(0, 0.04), 0.55, 0.55);          // cây ngả vàng
    else if (r < 0.1) col.setHSL(0.02, 0.45, 0.5);                          // gạo đỏ
    else col.setHSL(0.24 + rng.range(-0.05, 0.05), 0.35 + rng.range(0, 0.2), 0.62 + rng.range(-0.12, 0.12));
    im.setColorAt(i, col);
  }
  im.instanceColor.needsUpdate = true;
}

// ---- núi xa và mây (ngoài sương: màu đã pha sẵn khói xa) ---------------------------------------------
// ridges: [tâm x, tâm z, số núi, độ trải, cao min, cao max, màu]. clouds: vùng mây trôi theo trục x.
// keepOut {x0, x1, z0, z1, pad}: vùng chơi — chân núi (nón bán kính tới ~3,4 × cao) phải cách vùng này ít nhất
// pad m. Không có ràng buộc này thì một nón núi xa có thể đè lên Hàm Tử quan (camera đứng trong lòng núi, màn
// hình phủ một mặt phẳng màu cát): vị trí núi lấy từ chuỗi rng dùng chung với đạo cụ, đổi đạo cụ là núi xê dịch.
export function addSky(scene, world, rng, ridges, clouds = { x0: -500, span: 1600, z: 600, n: 14 }, keepOut = null) {
  const far = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
  const hills = [];
  const HORIZ = new THREE.Color(0xe8c894);
  const ridge = (cx, cz, n, spread, hMin, hMax, tone) => {
    for (let k = 0; k < n; k++) {
      let x = cx + rng.range(-spread, spread), z = cz + rng.range(-spread * 0.3, spread * 0.3);
      const h = rng.range(hMin, hMax);
      const base = new THREE.Color(tone).lerp(HORIZ, rng.range(0.12, 0.3));
      const rad = h * rng.range(2.2, 3.4);
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
      const g = new THREE.ConeGeometry(rad, h, rng.int(5, 7)).toNonIndexed();
      const pos = g.attributes.position, cols = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) { const k2 = pos.getY(i) / h + 0.5; _c.copy(base).multiplyScalar(0.85 + 0.25 * k2); cols.set([_c.r, _c.g, _c.b], i * 3); }
      g.setAttribute("color", new THREE.BufferAttribute(cols, 3)); g.translate(x, h / 2 - 8, z);
      g.deleteAttribute("uv"); hills.push(g);
    }
  };
  for (const r of ridges) ridge(...r);
  scene.add(new THREE.Mesh(merge(hills), far));
  const cloudGeo = merge([part(ico(14, 1), 0xf4ead6, { sy: 0.45 }), part(ico(10, 1), 0xefe2c8, { x: 13, y: -1, sy: 0.45 }), part(ico(9, 1), 0xf8f0e0, { x: -12, y: -2, z: 4, sy: 0.4 })]);
  const cm = new THREE.InstancedMesh(cloudGeo, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, transparent: true, opacity: 0.85 }), clouds.n);
  const cl = [];
  for (let k = 0; k < clouds.n; k++) cl.push({ x: rng.range(clouds.x0, clouds.x0 + clouds.span), y: rng.range(150, 230), z: rng.range(-clouds.z, clouds.z), s: rng.range(0.8, 1.8), v: rng.range(1.5, 3.5) });
  scene.add(cm);
  // mây trôi hết dải thì quay về đầu dải: co dần về 0 trong 8% cuối, lớn dần trong 8% đầu (không vụt tắt, vụt hiện)
  const edge = clouds.span * 0.08;
  world.animated.push((t) => {
    for (let i = 0; i < cl.length; i++) {
      const c = cl[i], x = clouds.x0 + ((c.x - clouds.x0 + t * c.v) % clouds.span);
      const s = c.s * Math.min(1, Math.min(x - clouds.x0, clouds.x0 + clouds.span - x) / edge);
      _m.compose(_v.set(x, c.y, c.z), _q.identity(), _s.set(s, s, s)); cm.setMatrixAt(i, _m);
    }
    cm.instanceMatrix.needsUpdate = true;
  });
}

// ---- Võ trường: doanh trại luyện quân nhà Trần quanh sân đất nện (Hư cấu) ------------------------------
// Khán đài có quân Trần ngồi xem (lính diễn kiểu "khán giả", reo hò khi tướng hạ địch), đài chỉ huy có
// lọng và trống đồng, bia đá "Sát Thát", vạc lửa hai bên mỗi cổng, trường bắn cung, lều trại, đường đất,
// cỏ hoa, núi mây. Khán đài chia từng gian, gian nào che camera thì mờ đi (world.addFadeable).
export function addArenaScenery(scene, world, { shadows, mat, R }) {
  const rng = makeRng(7719);
  const statics = [];
  const at = (a, r) => [Math.cos(a) * r, Math.sin(a) * r];
  const solid = (x, z, r) => world.colliders.push({ x0: x, z0: z, x1: x + 0.01, z1: z, r });
  // ngoài sân đất dốc lên thành gờ: mọi thứ đặt theo heightAt; y0 để hạ chân xuống chỗ thấp nhất của nền
  const place = (geoParts, x, z, ry, y0 = heightAt(x, z)) => { const g = merge(geoParts); g.applyMatrix4(new THREE.Matrix4().compose(_v.set(x, y0, z), _q.setFromEuler(_e.set(0, ry, 0)), _s.set(1, 1, 1))); return g; };
  world.spectatorSpots = [];

  // khán đài: 3 bậc gỗ, mái ngói son trên hàng cột, mỗi gian 6 m quay mặt vào sân
  const bay = (a, r) => {
    const [x, z] = at(a, r), ry = -a - Math.PI / 2;          // mặt gian hướng về tâm sân
    const p = [];
    for (let s = 0; s < 3; s++) p.push(part(box(6, 0.5 + s * 0.6, 1.6), s % 2 ? 0x7a5a3a : PAL.go, { y: 0.25 + s * 0.3, z: -s * 1.6 }));
    for (const dx of [-2.9, 2.9]) for (const dz of [0.6, -4.2]) p.push(part(cyl(0.12, 0.14, 4.6, 6), PAL.sonDam, { x: dx, y: 2.3, z: dz }));
    p.push(part(box(6.8, 0.25, 5.8), PAL.then, { y: 4.65, z: -1.8 }));
    p.push(part(box(7.2, 0.9, 3.4), PAL.son, { y: 5.1, z: -0.4, rx: 0.42 }), part(box(7.2, 0.9, 3.4), PAL.son, { y: 5.1, z: -3.2, rx: -0.42 }));
    p.push(part(box(7.4, 0.2, 0.3), PAL.vang, { y: 5.55, z: -1.8 }));
    const [fx, fz] = at(a, r - 1), y0 = heightAt(fx, fz);       // chân mép trước (thấp nhất)
    const g = new THREE.Mesh(merge(p), mat); g.position.set(x, y0, z); g.rotation.y = ry; g.castShadow = shadows; g.receiveShadow = true;
    scene.add(g); world.addFadeable(g, 3.2);
    for (let s = 0; s < 3; s++) for (let k = 0; k < 4; k++) {
      if (rng.next() < 0.18) continue;
      const lx = -2.2 + k * 1.45 + rng.range(-0.2, 0.2), lz = -s * 1.6;
      const wx = x + Math.cos(ry) * lx + Math.sin(ry) * lz, wz = z - Math.sin(ry) * lx + Math.cos(ry) * lz;
      world.spectatorSpots.push({ x: wx, z: wz, y: y0 + 0.5 + s * 0.6 - heightAt(wx, wz), yaw: Math.atan2(-wx, -wz) });
    }
  };
  for (const [a0, n] of [[Math.PI * 0.75, 5], [Math.PI * 1.75, 5]]) for (let k = 0; k < n; k++) bay(a0 + (k - (n - 1) / 2) * 0.118, R + 12);

  // đài chỉ huy: bệ gỗ cao, lan can, ghế, lọng vàng, trống đồng trên giá, cờ súy
  {
    const a = Math.PI * 0.26, [x, z] = at(a, R + 12), ry = -a - Math.PI / 2;
    const p = [part(box(7, 1.8, 6), PAL.go, { y: 0.9 }), part(box(7.4, 0.2, 6.4), PAL.nau, { y: 1.85 })];
    for (let k = 0; k < 5; k++) p.push(part(box(1.4, 0.3, 0.9), PAL.go, { y: 0.15 + k * 0.35, z: 3.2 + k * 0.5, x: -2.6 }));
    for (const dx of [-3.4, 3.4]) p.push(part(box(0.12, 0.9, 6.2), PAL.sonDam, { x: dx, y: 2.4 }));
    p.push(part(box(1.2, 1.3, 1.0), PAL.son, { y: 2.6, z: -1.6 }), part(box(1.3, 0.2, 1.1), PAL.vang, { y: 3.3, z: -1.6 }));
    p.push(part(cyl(0.05, 0.05, 4, 4), PAL.then, { y: 3.9, z: -1.1 }), part(cone(1.9, 0.9, 10), PAL.vang, { y: 5.9, z: -1.1 }), part(cyl(1.9, 1.9, 0.35, 10), PAL.vang, { y: 5.35, z: -1.1 }));
    p.push(part(cyl(0.95, 0.9, 0.9, 12), 0x6a5a3a, { x: 2.2, y: 2.9, z: 1.2 }), part(cyl(1.0, 1.0, 0.08, 12), 0x8f7a4a, { x: 2.2, y: 3.36, z: 1.2 }), part(ico(0.25, 0), PAL.vang, { x: 2.2, y: 3.42, z: 1.2, sy: 0.2 }));
    for (const dx of [1.4, 3.0]) p.push(part(box(0.1, 1.2, 0.1), PAL.go, { x: dx, y: 2.3, z: 1.2 }));
    statics.push(place(p, x, z, ry, heightAt(...at(a, R + 9)))); solid(x, z, 4.2);
  }

  // bia đá "Sát Thát" (Chính sử: quân Trần thích hai chữ Sát Thát lên cánh tay — bia là Hư cấu)
  {
    const a = Math.PI * 0.4, [x, z] = at(a, R + 9);
    const c = document.createElement("canvas"); c.width = 128; c.height = 256;
    const g2 = c.getContext("2d"); g2.fillStyle = "#8a8474"; g2.fillRect(0, 0, 128, 256);
    g2.strokeStyle = "#5c574b"; g2.lineWidth = 6; g2.strokeRect(8, 8, 112, 240);
    g2.fillStyle = "#3a352c"; g2.font = "bold 84px serif"; g2.textAlign = "center"; g2.textBaseline = "middle";
    g2.fillText("殺", 64, 82); g2.fillText("韃", 64, 180);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.8, 0.45), [0, 0, 0, 0, 1, 1].map((i) => new THREE.MeshLambertMaterial(i ? { map: tex } : { color: 0x8a8474 })));
    const y0 = heightAt(x, z);
    slab.position.set(x, y0 + 1.9, z); slab.rotation.y = Math.atan2(-x, -z); slab.castShadow = shadows; scene.add(slab);
    statics.push(part(box(2.2, 0.5, 1.2), 0x6f6a5c, { x, y: y0 + 0.25, z, ry: Math.atan2(-x, -z) }), part(box(1.7, 0.25, 0.7), 0x6f6a5c, { x, y: y0 + 3.45, z, ry: Math.atan2(-x, -z) }));
    solid(x, z, 1.1);
  }

  // vạc lửa hai bên mỗi cổng: thân đồng, lửa nhảy (nón phát sáng, co giãn theo thời gian)
  const flames = [];
  const flameMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.92, fog: false });
  const flameGeo = merge([part(cone(0.55, 1.5, 6), 0xe2541c, { y: 0.75 }), part(cone(0.36, 1.25, 5), 0xff9a2a, { y: 0.62, x: 0.06 }), part(cone(0.18, 0.8, 5), 0xffd76a, { y: 0.4 })]);
  for (let k = 0; k < 4; k++) for (const s of [-1, 1]) {
    const [x, z] = at(k * Math.PI / 2 + s * 0.095, R + 2.2);
    statics.push(part(cyl(0.12, 0.2, 1.3, 6), PAL.then, { x, y: 0.95, z }), part(cyl(0.7, 0.35, 0.55, 8), 0x7a5a2a, { x, y: 1.85, z }), part(cyl(0.72, 0.72, 0.08, 8), PAL.vang, { x, y: 2.12, z }));
    const f = new THREE.Mesh(flameGeo, flameMat);
    f.position.set(x, 2.15, z); scene.add(f); flames.push(f);
  }
  world.animated.push((t) => flames.forEach((f, i) => {
    const k = 0.85 + 0.2 * Math.sin(t * 11 + i * 1.7) + 0.1 * Math.sin(t * 23 + i);
    f.scale.set(1 + 0.1 * Math.sin(t * 9 + i), k, 1 + 0.1 * Math.cos(t * 8 + i)); f.rotation.y = t * 1.5 + i;
  }));

  // trường bắn cung: vạch bắn, 5 bia rơm vòng đỏ trắng, tên cắm
  {
    const a = Math.PI * 1.25 + 0.55, base = R + 20;
    for (let k = 0; k < 5; k++) {
      const [x, z] = at(a + (k - 2) * 0.07, base + 16), ry = Math.atan2(-Math.cos(a), -Math.sin(a));
      const tg = [part(box(0.12, 2.2, 0.12), PAL.go, { x: -0.6, y: 1.1 }), part(box(0.12, 2.2, 0.12), PAL.go, { x: 0.6, y: 1.1 })];
      [[1.0, 0xe6dcc3], [0.75, PAL.son], [0.5, 0xe6dcc3], [0.25, PAL.son]].forEach(([r, col], i) => tg.push(part(cyl(r, r, 0.1, 14), col, { y: 1.8, z: 0.08 + i * 0.02, rx: Math.PI / 2 })));
      for (let n = 0; n < 3; n++) tg.push(part(cyl(0.012, 0.012, 0.8, 3), PAL.go, { x: rng.range(-0.5, 0.5), y: 1.8 + rng.range(-0.5, 0.5), z: 0.45, rx: Math.PI / 2 + rng.range(-0.2, 0.2) }));
      statics.push(place(tg, x, z, ry + Math.PI));
    }
    for (let k = -3; k <= 3; k++) { const [x, z] = at(a + k * 0.05, base); statics.push(part(box(0.9, 0.06, 0.2), 0xe6dcc3, { x, y: heightAt(x, z) + 0.03, z, ry: -a })); }
  }

  // lều trại quanh sân, giá phơi áo, đống củi
  const tent = (x, z, ry, col) => statics.push(place([
    part(cone(3.2, 3.2, 4), col, { y: 1.6, ry: Math.PI / 4, sx: 1, sz: 1.5 }), part(box(0.1, 3.6, 0.1), PAL.go, { y: 1.8 }),
    part(box(1.2, 1.6, 0.05), PAL.then, { y: 0.8, z: 2.0 }),
  ], x, z, ry));
  for (let k = 0; k < 16; k++) {
    const a = rng.range(0, Math.PI * 2);
    if (Math.abs(Math.sin(2 * a)) < 0.2) continue;                        // chừa đường từ 4 cổng
    const [x, z] = at(a, rng.range(R + 32, R + 60));
    tent(x, z, rng.range(0, 6.28), rng.pick([PAL.vai, PAL.son, PAL.vai, 0xc9b98f])); solid(x, z, 2.4);
    if (k % 3 === 0) { const y = heightAt(x + 4, z + 1); statics.push(part(cyl(0.6, 0.8, 0.5, 7), 0x5a4630, { x: x + 4, y: y + 0.25, z: z + 1 }), part(box(1.6, 0.3, 0.3), 0x6a4a2a, { x: x + 4, y: y + 0.6, z: z + 1, ry: 0.5 })); }
  }

  // cỏ, hoa dại ngoài sân (tránh đường đất từ các cổng)
  const tufts = new THREE.InstancedMesh(merge([0, 1, 2, 3].map((k) => part(blade(0.1, 0.7), 0xffffff, { x: Math.cos(k * 1.6) * 0.14, y: 0.3, z: Math.sin(k * 1.6) * 0.14, rx: Math.sin(k * 1.6) * 0.35, rz: -Math.cos(k * 1.6) * 0.35 }))), mat, 1400);
  let n = 0;
  for (let k = 0; k < 6000 && n < 1400; k++) {
    const a = rng.range(0, 6.28), r = rng.range(R + 3, 125), [x, z] = at(a, r);
    if (Math.abs(Math.sin(2 * a)) * r < 5) continue;
    const f = fbm(x * 0.04, z * 0.04); if (f < 0.4) continue;
    _m.compose(_v.set(x, heightAt(x, z) - 0.05, z), _q.setFromEuler(_e.set(0, rng.range(0, 6.28), 0)), _s.set(1, rng.range(0.7, 1.4), 1));
    tufts.setMatrixAt(n, _m); tufts.setColorAt(n++, _c.setHSL(0.17 + (f - 0.5) * 0.12, 0.45, 0.33 + rng.range(0, 0.1)));
  }
  tufts.count = n; tufts.receiveShadow = true; scene.add(tufts);

  // Núi, mây phải nằm trọn trong tầm nhìn camera Võ trường (mặt phẳng xa 900 m, arena.js; camera cách tâm sân tới
  // ~62 m) nên mọi đỉnh núi, mép mây trong ~800 m quanh tâm. Trước đây dải núi đặt ở 700–720 m, keepOut đẩy ra tới
  // 1.100 m, vòm trời 600 m lại ghi độ sâu: nhìn ngang về nam không thấy núi nào. Dải núi nay co về ×0,72 cả tâm,
  // độ trải, độ cao (góc nhìn từ giữa sân gần như cũ); số núi mỗi dải giữ nguyên nên chuỗi rng của mây không đổi.
  addSky(scene, world, rng, [[0, 505, 14, 505, 32, 72, 0x5a6670], [-520, 0, 10, 290, 25, 61, 0x5a6560], [0, -520, 12, 505, 22, 50, 0x6a7478], [520, 0, 10, 290, 22, 58, 0x6a7478]],
    { x0: -560, span: 1120, z: 480, n: 12 }, { x0: -140, x1: 140, z0: -140, z1: 140, pad: 40 });
  if (statics.length) { const m = new THREE.Mesh(merge(statics), mat); m.castShadow = shadows; m.receiveShadow = true; scene.add(m); }
}
