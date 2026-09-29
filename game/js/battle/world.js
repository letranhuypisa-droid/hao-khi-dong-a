// battle/world.js — bản đồ Bến Hàm Tử 600 × 400 m (bản xám có một góc art, 21.2).
//
// Địa hình faceted (flat shading), nước phẳng dập dềnh, đạo cụ ghép khối. Mọi thứ tĩnh được
// gộp hoặc instanced để giữ trần draw call (mục 15.7: T2 ≤ 150 draw).

import * as THREE from "three";
import { MAP, FRONTS, BASES, BASE_RING, lineToX } from "../data/battle-b15.js";
import { PAL, merge, lambert, flagTexture } from "./models.js";
import { makeRng } from "../core/rng.js";

const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

export function waterDist(x, z) { return Math.min(z - MAP.riverNorthZ, MAP.riverEastX - x); }

export function heightAt(x, z) {
  let h = 1.3 * Math.sin(x * 0.021 + 1.3) * Math.cos(z * 0.017) + 0.8 * Math.sin(x * 0.047 + z * 0.031) + 0.5 * Math.cos(z * 0.06 - x * 0.013);
  h += 2.2 * smooth(40, 0, x) + 1.5 * smooth(-150, -200, -Math.abs(z) - 50);   // gò phía tây và hai mép
  for (const f of Object.values(FRONTS)) h *= 1 - 0.75 * smooth(20, 6, Math.abs(z - f.laneZ));
  h *= 1 - 0.8 * smooth(30, 10, Math.hypot(x - 34, z));                        // bản doanh
  if (x > MAP.fortWallX - 4) h *= 0.25;                                         // trong Hàm Tử quan
  h = Math.max(h, -0.2) + 0.9;
  const d = waterDist(x, z);
  if (d < 14) h = h * smooth(-2, 14, d) + (d < 0 ? Math.max(-3.2, d * 0.35) : 0.25) * (1 - smooth(-2, 14, d));
  return h;
}

export function buildWorld(scene, { shadows = true } = {}) {
  const rng = makeRng(1285);
  const world = { bases: {}, gates: {}, lineFlags: {}, boats: [], torches: [], colliders: [], animated: [] };

  // ---- trời, sương, ánh sáng ------------------------------------------------------------
  scene.background = new THREE.Color(0xd9b98a);
  scene.fog = new THREE.Fog(0xcfae82, 140, 480);
  const skyGeo = new THREE.SphereGeometry(900, 24, 12);
  const sc = new Float32Array(skyGeo.attributes.position.count * 3);
  const top = new THREE.Color(0x24333a), mid = new THREE.Color(0x9a6a45), hor = new THREE.Color(0xe8c894);
  for (let i = 0; i < skyGeo.attributes.position.count; i++) {
    const y = skyGeo.attributes.position.getY(i) / 900;
    const c = y > 0.25 ? mid.clone().lerp(top, (y - 0.25) / 0.75) : hor.clone().lerp(mid, Math.max(0, y) / 0.25);
    sc.set([c.r, c.g, c.b], i * 3);
  }
  skyGeo.setAttribute("color", new THREE.BufferAttribute(sc, 3));
  scene.add(new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false })));

  const hemi = new THREE.HemisphereLight(0xffe6c0, 0x3a3020, 1.15); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffd29a, 2.1);
  sun.position.set(-60, 90, 50);
  sun.castShadow = shadows;
  sun.shadow.mapSize.set(2048, 2048);
  const sh = sun.shadow.camera; sh.left = -45; sh.right = 45; sh.top = 45; sh.bottom = -45; sh.near = 10; sh.far = 260;
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);
  world.sun = sun;

  // ---- địa hình -------------------------------------------------------------------------
  const tg = new THREE.PlaneGeometry(760, 560, 152, 112).toNonIndexed();
  tg.rotateX(-Math.PI / 2); tg.translate(300, 0, 0);
  const pos = tg.attributes.position, col = new Float32Array(pos.count * 3);
  const cGrass = [new THREE.Color(0x6f7a3c), new THREE.Color(0x7f8744), new THREE.Color(0x66713a)];
  const cRoad = new THREE.Color(0x9a7b4f), cSand = new THREE.Color(0xcdb483), cMud = new THREE.Color(0x5e4b35), cFort = new THREE.Color(0x8f7a58);
  for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  for (let i = 0; i < pos.count; i += 3) {
    let cx = 0, cz = 0, cy = 0;
    for (let k = 0; k < 3; k++) { cx += pos.getX(i + k); cy += pos.getY(i + k); cz += pos.getZ(i + k); }
    cx /= 3; cy /= 3; cz /= 3;
    const d = waterDist(cx, cz);
    const gi = (Math.floor(cx * 0.13) * 7 + Math.floor(cz * 0.11) * 3 + i) % 3;
    let c = cGrass[(gi + 3) % 3].clone();       // % của JS giữ dấu: toạ độ âm cho chỉ số âm
    let road = 0; for (const f of Object.values(FRONTS)) road = Math.max(road, smooth(9, 3, Math.abs(cz - f.laneZ)) * (cx > 50 && cx < 470 ? 1 : 0));
    road = Math.max(road, smooth(14, 5, Math.abs(cx - 60)) * (Math.abs(cz) < 80 ? 1 : 0));
    c.lerp(cRoad, road * 0.85);
    if (cx > MAP.fortWallX) c.lerp(cFort, 0.7);
    if (d < 16) c.lerp(cSand, smooth(16, 5, d));
    if (d < 1.5) c.lerp(cMud, 0.6);
    if (Math.hypot(cx - MAP.beach.x, cz - MAP.beach.z) < MAP.beach.r) c.lerp(cSand, 0.75);
    const shade = 0.92 + 0.08 * ((i * 2654435761) % 97) / 97;
    c.multiplyScalar(shade);
    for (let k = 0; k < 3; k++) col.set([c.r, c.g, c.b], (i + k) * 3);
  }
  tg.setAttribute("color", new THREE.BufferAttribute(col, 3));
  tg.computeVertexNormals();
  const terrain = new THREE.Mesh(tg, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  terrain.receiveShadow = true;
  scene.add(terrain);

  // ---- nước: lưới thưa, dập dềnh bằng offset đỉnh (không mô phỏng lực nổi, 15.2) -------------
  const wg = new THREE.PlaneGeometry(900, 700, 60, 46); wg.rotateX(-Math.PI / 2); wg.translate(300, 0, 0);
  const water = new THREE.Mesh(wg, new THREE.MeshPhongMaterial({ color: 0x2f5d62, specular: 0xf1d98a, shininess: 60, flatShading: true, transparent: true, opacity: 0.88 }));
  water.position.y = 0.35;
  scene.add(water);
  const wBase = Float32Array.from(wg.attributes.position.array);
  world.animated.push((t) => {
    const a = wg.attributes.position.array;
    for (let i = 0; i < a.length; i += 3) a[i + 1] = wBase[i + 1] + 0.18 * Math.sin(t * 1.1 + wBase[i] * 0.09 + wBase[i + 2] * 0.07);
    wg.attributes.position.needsUpdate = true;
  });

  const mat = lambert();
  const addStatic = (geo, cast = true) => { const m = new THREE.Mesh(geo, mat); m.castShadow = cast && shadows; m.receiveShadow = true; scene.add(m); return m; };
  const P = (geo, color, t) => {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(t.x || 0, t.y || 0, t.z || 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(t.rx || 0, t.ry || 0, t.rz || 0)), new THREE.Vector3(t.sx || 1, t.sy || 1, t.sz || 1)));
    const c = new THREE.Color(color), n = g.attributes.position.count, cc = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) cc.set([c.r, c.g, c.b], i * 3);
    g.setAttribute("color", new THREE.BufferAttribute(cc, 3));
    for (const k of Object.keys(g.attributes)) if (!["position", "normal", "color"].includes(k)) g.deleteAttribute(k);
    return g;
  };
  const staticParts = [];

  // hàng rào cọc tròn
  const palisade = (cx, cz, r, gapAng = null, color = PAL.go) => {
    const n = Math.floor((2 * Math.PI * r) / 0.55);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      if (gapAng !== null && Math.abs(Math.atan2(Math.sin(a - gapAng), Math.cos(a - gapAng))) < 0.28) continue;
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, y = heightAt(x, z);
      // cọc thấp 1,5 m: camera thứ ba đứng sau tướng vẫn nhìn qua được khi tướng ở trong vòng chiếm
      staticParts.push(P(new THREE.CylinderGeometry(0.13, 0.16, 1.5 + (i % 3) * 0.15, 5), color, { x, y: y + 0.7, z }));
      staticParts.push(P(new THREE.ConeGeometry(0.13, 0.3, 5), color, { x, y: y + 1.6 + (i % 3) * 0.15, z }));
    }
  };
  const tent = (x, z, ry, color, s = 1) => {
    const y = heightAt(x, z);
    staticParts.push(P(new THREE.ConeGeometry(2.2 * s, 2.4 * s, 4), color, { x, y: y + 1.2 * s, z, ry: ry + Math.PI / 4 }));
    staticParts.push(P(new THREE.BoxGeometry(0.6 * s, 1.2 * s, 0.05), PAL.then, { x: x + Math.sin(ry) * 1.3 * s, y: y + 0.6 * s, z: z + Math.cos(ry) * 1.3 * s, ry }));
  };
  const yurt = (x, z, s = 1) => {
    const y = heightAt(x, z);
    staticParts.push(P(new THREE.CylinderGeometry(2.4 * s, 2.4 * s, 1.8 * s, 9), PAL.xam, { x, y: y + 0.9 * s, z }));
    staticParts.push(P(new THREE.ConeGeometry(2.7 * s, 1.4 * s, 9), 0x8d8f86, { x, y: y + 2.5 * s, z }));
  };
  const tower = (x, z, h = 6) => {
    const y = heightAt(x, z);
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) staticParts.push(P(new THREE.BoxGeometry(0.22, h, 0.22), PAL.go, { x: x + dx, y: y + h / 2, z: z + dz }));
    staticParts.push(P(new THREE.BoxGeometry(2.8, 0.25, 2.8), PAL.go, { x, y: y + h, z }));
    staticParts.push(P(new THREE.ConeGeometry(2.2, 1.4, 4), PAL.nau, { x, y: y + h + 1.6, z, ry: Math.PI / 4 }));
  };
  const flagPole = (x, z, h = 7) => {
    const y = heightAt(x, z);
    const g = new THREE.Group(); g.position.set(x, y, z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, h, 5), mat);
    pole.geometry = P(pole.geometry, PAL.then, {}); pole.position.y = h / 2; g.add(pole);
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.2, 4, 1), new THREE.MeshLambertMaterial({ color: PAL.son, side: THREE.DoubleSide }));
    cloth.position.set(0.95, h - 0.7, 0); g.add(cloth);
    scene.add(g);
    world.animated.push((t) => { cloth.rotation.y = Math.sin(t * 2 + x) * 0.25; });
    return { group: g, cloth };
  };

  // ---- bản doanh ta --------------------------------------------------------------------
  palisade(34, 0, 18, 0);
  tent(24, -7, 0.4, PAL.son, 1.1); tent(22, 8, -0.3, PAL.sonDam, 1.1); tent(38, -10, 0.2, PAL.vai); tent(40, 10, -0.2, PAL.vai); tent(30, 0, 0, PAL.son, 1.4);
  const hqFlag = flagPole(44, -4, 9); hqFlag.cloth.material.map = flagTexture("TRẦN", "#9b2d20", "#f1d98a");
  hqFlag.cloth.material.color.set(0xffffff);

  // ---- Cứ Điểm ----------------------------------------------------------------------------
  for (const b of BASES) {
    const f = b.front ? FRONTS[b.front] : null;
    const x = f ? lineToX(f, b.lineX) : b.x, z = f ? f.laneZ : b.z;
    const vis = { id: b.id, x, z, r: BASE_RING[b.type], type: b.type };
    if (b.type === "don") {
      palisade(x, z, 10, Math.PI); tower(x + 3, z - 4); tent(x - 3, z + 3, 0.5, PAL.vai, 0.8);
      vis.flag = flagPole(x - 5, z - 5, 8);
    } else if (b.type === "doanh_trai") {
      palisade(x, z, 13, Math.PI); tent(x - 4, z - 5, 0.3, PAL.vai); tent(x + 5, z - 4, -0.4, PAL.vai); tent(x - 3, z + 6, 0.1, PAL.xam); tent(x + 4, z + 5, 0.6, PAL.xam);
      tower(x + 8, z + 8, 7);
      vis.flag = flagPole(x, z, 10);
    } else if (b.type === "cong") {
      vis.x = MAP.fortWallX; vis.z = z;
      world.gates[b.id] = buildGate(scene, mat, P, MAP.fortWallX, z, shadows);
      vis.flag = flagPole(MAP.fortWallX + 2, z - 7, 10);
    }
    if (b.type !== "ban_doanh") {
      const ring = new THREE.Mesh(new THREE.RingGeometry(vis.r - 0.35, vis.r, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(vis.x, heightAt(vis.x, vis.z) + 0.12, vis.z);
      scene.add(ring); vis.ring = ring;
      const prog = new THREE.Mesh(new THREE.RingGeometry(vis.r - 1.1, vis.r - 0.45, 48, 1, 0, 0.001), new THREE.MeshBasicMaterial({ color: 0xf1d98a, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
      prog.rotation.x = -Math.PI / 2; prog.position.copy(ring.position); prog.position.y += 0.02;
      scene.add(prog); vis.prog = prog; vis.progVal = 0;
    }
    world.bases[b.id] = vis;
  }

  // ---- Hàm Tử quan: tường tây có hai cổng, tường nam, lều Nguyên bên trong ------------------------
  const wallSeg = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(x1 - x0, z1 - z0);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, y = heightAt(cx, cz);
    staticParts.push(P(new THREE.BoxGeometry(2.6, 4.6, len), 0x7a6a50, { x: cx, y: y + 2.1, z: cz, ry: ang }));
    staticParts.push(P(new THREE.BoxGeometry(3.0, 0.5, len), PAL.go, { x: cx, y: y + 4.5, z: cz, ry: ang }));
    const n = Math.floor(len / 2.2);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
      staticParts.push(P(new THREE.BoxGeometry(0.7, 0.8, 0.7), PAL.go, { x, y: heightAt(x, z) + 5.1, z }));
    }
    world.colliders.push({ x0, z0, x1, z1, r: 1.6 });
  };
  const W = MAP.fortWallX;
  wallSeg(W, MAP.riverNorthZ + 4, W, -80); wallSeg(W, -70, W, 70); wallSeg(W, 80, W, MAP.fortSouthZ);
  wallSeg(W, MAP.fortSouthZ, MAP.riverEastX - 2, MAP.fortSouthZ);
  for (const [x, z] of [[W, MAP.fortSouthZ], [W, 0], [MAP.riverEastX - 4, MAP.fortSouthZ]]) tower(x, z, 8);
  for (let i = 0; i < 9; i++) yurt(485 + (i % 3) * 30 + rng.range(-4, 4), 20 + Math.floor(i / 3) * 38 + rng.range(-4, 4), rng.range(0.9, 1.2));
  const fortFlag = flagPole(560, 40, 12);
  fortFlag.cloth.material.color.set(PAL.cham);

  // thuyền chiến Nguyên trên sông
  for (let i = 0; i < 7; i++) {
    const bx = 470 + i * 26 + rng.range(-6, 6), bz = MAP.riverNorthZ - 14 - rng.range(0, 12);
    const boat = new THREE.Mesh(merge([
      P(new THREE.BoxGeometry(3.4, 1.2, 11), PAL.nau, { y: 0.6 }),
      P(new THREE.BoxGeometry(2.8, 0.9, 3.5), PAL.go, { y: 1.6, z: -3 }),
      P(new THREE.CylinderGeometry(0.12, 0.14, 8, 5), PAL.then, { y: 4.5, z: 0.5 }),
      P(new THREE.BoxGeometry(0.1, 4.2, 3.6), 0xc9b98f, { y: 5.2, z: 0.5 }),
    ]), mat);
    boat.position.set(bx, 0.1, bz); boat.rotation.y = rng.range(-0.3, 0.3) + (i % 2 ? Math.PI : 0);
    boat.castShadow = shadows; scene.add(boat); world.boats.push(boat);
  }
  world.animated.push((t) => world.boats.forEach((b, i) => { b.position.y = 0.1 + 0.2 * Math.sin(t * 0.9 + i); b.rotation.z = 0.04 * Math.sin(t * 0.7 + i * 2); }));

  scene.add(addStatic(merge(staticParts)));

  // ---- cây, lau sậy (instanced) ------------------------------------------------------------
  const treeGeo = merge([
    P(new THREE.CylinderGeometry(0.18, 0.28, 2.6, 5), PAL.nau, { y: 1.3 }),
    P(new THREE.IcosahedronGeometry(1.6, 0), 0x4f6a32, { y: 3.4 }),
    P(new THREE.IcosahedronGeometry(1.1, 0), 0x5e7a3a, { y: 4.6, x: 0.3 }),
  ]);
  const palmGeo = merge([
    P(new THREE.CylinderGeometry(0.12, 0.2, 5.5, 5), 0x7a6040, { y: 2.75, rz: 0.08 }),
    ...[0, 1, 2, 3, 4].map((k) => P(new THREE.BoxGeometry(0.5, 0.06, 2.4), 0x5d7a36, { y: 5.4, ry: k * 1.26, rx: 0.35, z: 0 })),
  ]);
  const clear = (x, z) => {
    if (waterDist(x, z) < 6) return false;
    for (const f of Object.values(FRONTS)) if (Math.abs(z - f.laneZ) < 34 && x > 40 && x < 470) return false;
    if (Math.hypot(x - 34, z) < 26) return false;
    if (x < 130 && Math.abs(z) < 70) return false;          // hành lang xuất quân trước bản doanh
    if (x > W - 8) return false;
    return true;
  };
  const placeInst = (geo, count, filter, scaleRange) => {
    const im = new THREE.InstancedMesh(geo, mat, count); im.castShadow = shadows; im.receiveShadow = true;
    const m = new THREE.Matrix4(); let n = 0, guard = 0;
    while (n < count && guard++ < count * 40) {
      const x = rng.range(-30, 640), z = rng.range(-230, 230);
      if (!filter(x, z)) continue;
      const s = rng.range(...scaleRange);
      m.compose(new THREE.Vector3(x, heightAt(x, z) - 0.1, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rng.range(0, 6.28), 0)), new THREE.Vector3(s, s, s));
      im.setMatrixAt(n++, m);
    }
    im.count = n; scene.add(im); return im;
  };
  placeInst(treeGeo, 260, clear, [0.8, 1.5]);
  placeInst(palmGeo, 60, (x, z) => clear(x, z) && waterDist(x, z) < 40, [0.8, 1.2]);
  const reedGeo = merge([0, 1, 2, 3].map((k) => P(new THREE.ConeGeometry(0.06, 1.6, 3), 0x8f8a4a, { x: (k % 2) * 0.25 - 0.1, z: Math.floor(k / 2) * 0.25 - 0.1, y: 0.8, rz: (k - 1.5) * 0.12 })));
  placeInst(reedGeo, 700, (x, z) => { const d = waterDist(x, z); return d > -2 && d < 7 && !(x > W - 4 && z > MAP.riverNorthZ + 3); }, [0.9, 1.4]);

  // cờ tuyến mặt trận (ta đỏ, địch chàm), di chuyển theo tuyến mô phỏng
  for (const f of Object.values(FRONTS)) {
    const ta = flagPole(0, 0, 6), dich = flagPole(0, 0, 6);
    dich.cloth.material.color.set(PAL.cham);
    world.lineFlags[f.id] = { ta, dich };
  }

  // đuốc ở bản doanh và cổng
  world.update = (t) => { for (const fn of world.animated) fn(t); };
  world.setBaseOwner = (id, owner) => {
    const v = world.bases[id]; if (!v) return;
    const c = owner === "ta" ? 0xc0392b : 0x3d5a78;
    if (v.ring) v.ring.material.color.set(c);
    if (v.flag) { v.flag.cloth.material.color.set(owner === "ta" ? PAL.son : PAL.cham); }
  };
  world.setBaseProgress = (id, p) => {
    const v = world.bases[id]; if (!v || !v.prog) return;
    p = Math.max(0, Math.min(1, p));
    if (Math.abs(p - v.progVal) < 0.01) return;
    v.progVal = p; v.prog.geometry.dispose();
    v.prog.geometry = new THREE.RingGeometry(v.r - 1.1, v.r - 0.45, 48, 1, Math.PI / 2, Math.max(0.001, p * Math.PI * 2));
  };
  world.setLine = (frontId, x) => {
    const f = FRONTS[frontId], wx = lineToX(f, x), fl = world.lineFlags[frontId];
    fl.ta.group.position.set(wx - 5, heightAt(wx - 5, f.laneZ - 14), f.laneZ - 14);
    fl.dich.group.position.set(wx + 5, heightAt(wx + 5, f.laneZ + 14), f.laneZ + 14);
  };
  return world;
}

function buildGate(scene, mat, P, x, z, shadows) {
  const y = heightAt(x, z);
  const house = new THREE.Mesh(merge([
    P(new THREE.BoxGeometry(3.2, 7, 3.2), 0x6d5c45, { x, y: y + 3.5, z: z - 6.2 }),
    P(new THREE.BoxGeometry(3.2, 7, 3.2), 0x6d5c45, { x, y: y + 3.5, z: z + 6.2 }),
    P(new THREE.BoxGeometry(3.6, 1.2, 15.6), PAL.go, { x, y: y + 7.4, z }),
    P(new THREE.ConeGeometry(4.2, 2.2, 4), PAL.nau, { x, y: y + 9.1, z, ry: Math.PI / 4, sz: 2.1 }),
  ]), mat);
  house.castShadow = shadows; scene.add(house);
  const doors = new THREE.Group();
  const leaf = (s) => {
    const m = new THREE.Mesh(merge([
      P(new THREE.BoxGeometry(0.5, 5.4, 4.4), 0x5a3b22, { z: 2.2 * s }),
      ...[1.2, 2.7, 4.2].map((yy) => P(new THREE.BoxGeometry(0.6, 0.18, 4.4), PAL.then, { y: yy - 2.7, z: 2.2 * s })),
    ]), mat);
    m.castShadow = shadows; return m;
  };
  const l = leaf(1), r = leaf(-1);
  const lp = new THREE.Group(); lp.position.set(0, 0, -4.4); lp.add(l);
  const rp = new THREE.Group(); rp.position.set(0, 0, 4.4); rp.add(r);
  doors.add(lp, rp); doors.position.set(x, y + 2.7, z);
  scene.add(doors);
  return { doors, lp, rp, x, z, broken: false, shake: 0 };
}

// Đẩy một điểm ra khỏi tường (đoạn thẳng có bề dày). Cổng đóng coi như tường.
export function collide(world, x, z, radius, openGates) {
  for (const c of world.colliders) {
    const dx = c.x1 - c.x0, dz = c.z1 - c.z0, L2 = dx * dx + dz * dz;
    let t = ((x - c.x0) * dx + (z - c.z0) * dz) / L2; t = Math.max(0, Math.min(1, t));
    const px = c.x0 + dx * t, pz = c.z0 + dz * t;
    const ox = x - px, oz = z - pz, d = Math.hypot(ox, oz), min = c.r + radius;
    if (d < min && d > 1e-6) { x = px + (ox / d) * min; z = pz + (oz / d) * min; }
  }
  for (const id in world.gates) {
    const g = world.gates[id];
    if (openGates[id]) continue;
    if (Math.abs(z - g.z) < 5 && Math.abs(x - g.x) < 1.6 + radius) x = x < g.x ? g.x - 1.6 - radius : g.x + 1.6 + radius;
  }
  x = Math.max(4, Math.min(MAP.riverEastX + 3, x));
  z = Math.max(MAP.riverNorthZ - 3, Math.min(196, z));
  return [x, z];
}
