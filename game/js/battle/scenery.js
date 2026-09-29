// battle/scenery.js — cảnh phụ cho bản đồ Hàm Tử: ruộng lúa bậc thềm, lũy tre, gò đá, cỏ hoa,
// bến gỗ và thuyền nan, dấu vết chiến trận, núi xa, mây. Toàn bộ là Hư cấu để bản đồ có nhiều
// vùng nhận ra được; không đổi bố cục chơi (làn đường, Cứ Điểm, hành lang xuất quân).
//
// Giữ trần draw call (15.7): mỗi loại đạo cụ là một lưới gộp hoặc một InstancedMesh. Đạo cụ nhỏ
// không đổ bóng. Tre và đá tảng có va chạm (điểm tròn trong world.colliders).

import * as THREE from "three";
import { PAL, merge, part, lambert } from "./models.js";
import { heightAt, waterDist, ZONES, paddyAt, vnoise, fbm } from "./world.js";
import { MAP, FRONTS, VILLAGE, KE_SACH } from "../data/battle-b15.js";
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

export function addScenery(scene, world, { shadows, mat }) {
  const rng = makeRng(4417);
  const inst = (geo, n, { cast = false, material = mat } = {}) => {
    const im = new THREE.InstancedMesh(geo, material, n);
    im.castShadow = cast && shadows; im.receiveShadow = true; im.count = 0; scene.add(im);
    im.put = (x, y, z, ry = 0, s = 1, sy = s, color = null, rx = 0, rz = 0) => {
      if (im.count >= n) return false;
      _m.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(s, sy, s));
      im.setMatrixAt(im.count, _m);
      if (color !== null) { if (!im.instanceColor) im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3).fill(1), 3); im.setColorAt(im.count, _c.set(color)); }
      im.count++; return true;
    };
    return im;
  };
  const solid = (x, z, r) => world.colliders.push({ x0: x, z0: z, x1: x + 0.01, z1: z, r });
  const statics = [];

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
    if (busy(x, z, 6) || waterDist(x, z) < 10 || paddyAt(x, z) || Math.hypot(x - VILLAGE.x, z - VILLAGE.z) < VILLAGE.r + 12) continue;
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
      rocks.put(x, heightAt(x, z) + s * 0.15, z, rng.range(0, 6.28), s, s * rng.range(0.6, 1.1), rng.pick(ROCK), rng.range(-0.2, 0.2), rng.range(-0.2, 0.2));
      if (big) solid(x, z, s * 0.85);
    }
  }
  for (let k = 0; k < 700 && rocks.count < 260; k++) {     // đá lẻ khắp bãi, sỏi ven đường
    const x = rng.range(-20, 600), z = rng.range(-190, 199);
    if (waterDist(x, z) < 2 || paddyAt(x, z) || x > MAP.fortWallX - 2) continue;
    const s = rng.range(0.15, 0.55);
    rocks.put(x, heightAt(x, z) + s * 0.1, z, rng.range(0, 6.28), s, s * 0.7, rng.pick(ROCK));
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
    if (road || (Math.abs(x - 60) < 5 && Math.abs(z) < 80) || Math.hypot(x - 34, z) < 18) continue;
    const n = fbm(x * 0.03, z * 0.03), y = heightAt(x, z) - 0.05;
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
  const spears = inst(spearStuck, 180);
  const arrowTuft = merge([0, 1, 2, 3, 4].map((k) => part(cyl(0.012, 0.012, 0.8, 3), PAL.go, { x: Math.cos(k * 1.3) * 0.18, y: 0.35, z: Math.sin(k * 1.3) * 0.18, rx: Math.sin(k * 1.3) * 0.3, rz: Math.cos(k * 1.3) * 0.3 })));
  const arrows = inst(arrowTuft, 220);
  const shieldGeo = merge([part(cyl(0.36, 0.36, 0.05, 9), 0xffffff, {}), part(cyl(0.09, 0.09, 0.08, 6), PAL.sat, { y: 0.03 })]);
  const shields = inst(shieldGeo, 120);
  for (let k = 0; k < 3000 && (spears.count < 180 || shields.count < 120 || arrows.count < 220); k++) {
    const f = rng.pick(Object.values(FRONTS)), x = rng.range(150, 460), z = f.laneZ + rng.range(-26, 26);
    if (Math.abs(z - f.laneZ) < 3) continue;
    const y = heightAt(x, z), r = rng.next();
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
  for (const [x, z, ry, b] of [[262, -102, 0.6, 1], [318, 44, -0.4, 1], [205, 104, 1.2, 0], [376, -46, 2.1, 1], [145, -112, -0.8, 0], [420, 108, 0.3, 1]]) cart(x, z, ry, b);
  // trại Nguyên ngoài thành: hòm, thùng, cọc buộc ngựa, lều cháy trơ khung, đống lửa tàn
  const S = ZONES.scorch;
  for (let k = 0; k < 60; k++) {
    const x = rng.range(S.x0 + 6, S.x1 - 6), z = rng.range(-150, 150);
    if (busy(x, z, -12) && Math.abs(z) > 20) continue;
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
  // cọc buộc ngựa dọc đường vào cổng
  for (const zz of [-60, 60]) for (let t = 0; t < 6; t++) statics.push(part(box(0.14, 1.2, 0.14), PAL.go, { x: 440 + t * 3, y: heightAt(440 + t * 3, zz) + 0.6, z: zz }), part(box(3, 0.1, 0.1), PAL.go, { x: 441.5 + t * 3, y: heightAt(441.5 + t * 3, zz) + 1.05, z: zz }));

  // ---- cây đa đầu làng (mốc nhận đường), cau trong làng -------------------------------------------
  const banyan = (x, z) => {
    const y = heightAt(x, z), g = [part(cyl(0.9, 1.4, 5, 7), 0x6a5238, { y: 2.5 })];
    for (let k = 0; k < 7; k++) g.push(part(cyl(0.05, 0.05, 4, 3), 0x5a4630, { x: Math.cos(k) * 2.4, y: 2.8, z: Math.sin(k) * 2.4 }));
    for (let k = 0; k < 6; k++) g.push(part(ico(3.2, 0), k % 2 ? 0x46602e : 0x55703a, { x: Math.cos(k * 1.05) * 3.2, y: 6.6 + (k % 3) * 0.6, z: Math.sin(k * 1.05) * 3.2, sy: 0.7 }));
    g.push(part(ico(3.6, 0), 0x4c6632, { y: 8.2, sy: 0.75 }));
    const m = merge(g); m.translate(x, y - 0.1, z); statics.push(m); solid(x, z, 1.6);
  };
  banyan(VILLAGE.x - 6, VILLAGE.z - VILLAGE.r - 9);
  const arecaGeo = merge([part(cyl(0.1, 0.13, 9, 5), 0x9a8a6a, { y: 4.5 }), ...[0, 1, 2, 3, 4, 5].map((k) => part(box(0.4, 0.05, 2.2), 0x5f7f32, { y: 9, ry: k * 1.05, rx: 0.5, z: 0 }))]);
  const areca = inst(arecaGeo, 30, { cast: true });
  for (let k = 0; k < 30; k++) {
    const a = rng.range(0, 6.28), r = rng.range(4, VILLAGE.r - 2), x = VILLAGE.x + Math.cos(a) * r, z = VILLAGE.z + Math.sin(a) * r;
    if (KE_SACH.muiTenThu.bundles.some((b) => Math.hypot(b.x - x, b.z - z) < 3)) continue;
    areca.put(x, heightAt(x, z) - 0.1, z, rng.range(0, 6.28), rng.range(0.8, 1.15));
  }

  // ---- núi xa và mây (ngoài sương: màu đã pha sẵn khói xa) ---------------------------------------------
  const far = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
  const hills = [];
  const HORIZ = new THREE.Color(0xe8c894);
  const ridge = (cx, cz, n, spread, hMin, hMax, tone) => {
    for (let k = 0; k < n; k++) {
      const x = cx + rng.range(-spread, spread), z = cz + rng.range(-spread * 0.3, spread * 0.3), h = rng.range(hMin, hMax);
      const base = new THREE.Color(tone).lerp(HORIZ, rng.range(0.12, 0.3));
      const g = new THREE.ConeGeometry(h * rng.range(2.2, 3.4), h, rng.int(5, 7)).toNonIndexed();
      const pos = g.attributes.position, cols = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) { const k2 = pos.getY(i) / h + 0.5; _c.copy(base).multiplyScalar(0.85 + 0.25 * k2); cols.set([_c.r, _c.g, _c.b], i * 3); }
      g.setAttribute("color", new THREE.BufferAttribute(cols, 3)); g.translate(x, h / 2 - 8, z);
      g.deleteAttribute("uv"); hills.push(g);
    }
  };
  ridge(300, 820, 18, 800, 40, 95, 0x5a6670);       // dãy núi phía nam
  ridge(-620, 0, 10, 300, 35, 80, 0x5a6560);        // gò đồi phía tây
  ridge(300, -760, 12, 800, 20, 50, 0x6a7478);      // bờ bắc sông Hồng, xa mờ
  ridge(1050, 0, 8, 420, 30, 70, 0x6a7478);         // phía đông
  const hm = new THREE.Mesh(merge(hills.map((g) => { g.setAttribute("normal", g.attributes.normal || new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3), 3)); return g; })), far);
  scene.add(hm);
  const cloudGeo = merge([part(ico(14, 1), 0xf4ead6, { sy: 0.45 }), part(ico(10, 1), 0xefe2c8, { x: 13, y: -1, sy: 0.45 }), part(ico(9, 1), 0xf8f0e0, { x: -12, y: -2, z: 4, sy: 0.4 })]);
  const clouds = new THREE.InstancedMesh(cloudGeo, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, transparent: true, opacity: 0.85 }), 14);
  const cl = [];
  for (let k = 0; k < 14; k++) cl.push({ x: rng.range(-500, 1100), y: rng.range(150, 230), z: rng.range(-600, 600), s: rng.range(0.8, 1.8), v: rng.range(1.5, 3.5) });
  scene.add(clouds);
  world.animated.push((t) => {
    cl.forEach((c, i) => {
      const x = -500 + ((c.x + t * c.v + 500) % 1600);
      _m.compose(_v.set(x, c.y, c.z), _q.identity(), _s.set(c.s, c.s, c.s)); clouds.setMatrixAt(i, _m);
    });
    clouds.instanceMatrix.needsUpdate = true;
  });

  if (statics.length) { const m = new THREE.Mesh(merge(statics), mat); m.castShadow = shadows; m.receiveShadow = true; scene.add(m); }
  for (const im of [rice, bamboo, rocks, tufts, flowers, spears, arrows, shields, areca]) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
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
