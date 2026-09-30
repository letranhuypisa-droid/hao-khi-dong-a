// battle/world.js — bản đồ Bến Hàm Tử 600 × 400 m (bản xám có một góc art, 21.2).
//
// Địa hình faceted (flat shading), nước phẳng dập dềnh, đạo cụ ghép khối. Mọi thứ tĩnh được
// gộp hoặc instanced để giữ trần draw call (mục 15.7: T2 ≤ 150 draw).

import * as THREE from "three";
import { MAP, FRONTS, BASES, BASE_RING, lineToX, VILLAGE } from "../data/battle-b15.js";
import { PAL, merge, lambert, flagTexture, part } from "./models.js";
import { makeRng } from "../core/rng.js";
import { addScenery, addArenaScenery, tintTrees } from "./scenery.js";

// Độ cao mặt đất, nhiễu, vùng cảnh, lưới địa hình, va chạm nằm ở ground.js (thuần, không three); xuất lại
// để các module cũ vẫn import từ "./world.js".
import { smooth, waterDist, vnoise, fbm, ZONES, paddyAt, setTerrain, ARENA_R, heightAt, bareHeightAt,
  setLaneFeatures, laneFeaturesOn, featureLook, featureNear, mudAt, laneGridData, laneWaterData } from "./ground.js";
export { waterDist, vnoise, fbm, ZONES, paddyAt, setTerrain, ARENA_R, heightAt, collide,
  setLaneFeatures, laneFeaturesOn, featureHeight, featureLook, featureNear, bareHeightAt, mudAt, TERRAIN_FEATURES } from "./ground.js";

// Vật cao, mảnh (cột cờ) có thể lọt vào giữa camera và tướng: camera không va chạm với chúng, nên
// một cột cờ sát ống kính thành dải đen che nửa màn hình. Mỗi khung, vật nào nằm trong hành lang
// camera → tướng (lệch ngang < r + FADE_PAD m) hoặc cách ống kính < FADE_NEAR m thì mờ dần xuống
// FADE_MIN; ra khỏi hành lang thì hiện lại. Mỗi vật có vật liệu riêng (nhân bản khi đăng ký).
const FADE_PAD = 1.1, FADE_NEAR = 6, FADE_MIN = 0.12;
function addFader(world) {
  world.fadeables = [];
  world.addFadeable = (obj, r = 0.3) => {
    const mats = [];
    obj.traverse((o) => { if (o.material) { o.material = o.material.clone(); o.material.transparent = true; mats.push(o.material); } });
    world.fadeables.push({ obj, r, mats, a: 1 });
  };
  const _p = new THREE.Vector3();
  world.fadeOccluders = (cam, tx, tz, dt) => {
    const dx = tx - cam.x, dz = tz - cam.z, L2 = dx * dx + dz * dz || 1e-6, L = Math.sqrt(L2);
    for (const f of world.fadeables) {
      f.obj.getWorldPosition(_p);
      const px = _p.x - cam.x, pz = _p.z - cam.z, t = (px * dx + pz * dz) / L2;
      const perp = Math.abs(px * dz - pz * dx) / L, near = Math.hypot(px, pz) < FADE_NEAR + f.r;
      const block = near || (t > 0 && t < 1 && perp < f.r + FADE_PAD);
      const want = block ? FADE_MIN : 1;
      f.a += (want - f.a) * Math.min(1, dt * (block ? 14 : 5));
      for (const m of f.mats) { m.opacity = f.a; m.depthWrite = f.a > 0.98; }
    }
  };
}

export function buildWorld(scene, { shadows = true } = {}) {
  setTerrain("map");
  // Lũy, hào, hố, gò trên hai làn bật mặc định; URL có "nolanes" thì tắt (so sánh, máy yếu). Phải đặt
  // trước mọi lời gọi heightAt của cảnh này; mọi thứ theo công trình (lưới mịn, nước hố/hào, đạo cụ, luật
  // đất cao thấp) tra laneFeaturesOn().
  setLaneFeatures(!(typeof location !== "undefined" && location.search.includes("nolanes")));
  const lanes = laneFeaturesOn();
  const rng = makeRng(1285);
  const world = { bases: {}, gates: {}, lineFlags: {}, boats: [], torches: [], colliders: [], animated: [] };
  addFader(world);

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
  // Tắt công trình: lưới đều 5 m như cũ (từng đỉnh, từng màu y nguyên). Bật: lưới chữ nhật không đều
  // (laneGrid) mịn trên hai làn và dọc hào thành, cộng nước trong hố ngập và đáy hào (laneWater).
  const tStart = performance.now();
  const grid = lanes ? laneGrid() : null;
  let tg;
  if (grid) tg = grid.geo;
  else {
    tg = new THREE.PlaneGeometry(760, 560, 152, 112).toNonIndexed();
    tg.rotateX(-Math.PI / 2); tg.translate(300, 0, 0);
    const p = tg.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, heightAt(p.getX(i), p.getZ(i)));
  }
  const tGrid = performance.now(), pos = tg.attributes.position, col = new Float32Array(pos.count * 3), pa = pos.array;
  const cLush = new THREE.Color(0x5f7434), cGrass = new THREE.Color(0x76803f), cDry = new THREE.Color(0x9a8f52), cDirt = new THREE.Color(0x8a6d48);
  const cRoad = new THREE.Color(0x9a7b4f), cSand = new THREE.Color(0xcdb483), cMud = new THREE.Color(0x5e4b35), cFort = new THREE.Color(0x8f7a58);
  const cPaddy = [new THREE.Color(0x587a66), new THREE.Color(0x7c9c3e), new THREE.Color(0xb7a043), new THREE.Color(0x8e7a4c)];
  const cRock = new THREE.Color(0x857d6c), cBurnt = new THREE.Color(0x3d3326), cMarsh = new THREE.Color(0x4f6238);
  const c = new THREE.Color(), fronts = Object.values(FRONTS);
  for (let i = 0; i < pos.count; i += 3) {
    const o = i * 3, cx = (pa[o] + pa[o + 3] + pa[o + 6]) / 3, cz = (pa[o + 2] + pa[o + 5] + pa[o + 8]) / 3;
    const d = waterDist(cx, cz);
    // cỏ: ba sắc (tươi, thường, khô) trộn theo nhiễu mượt, lốm đốm đất trống
    const n1 = fbm(cx * 0.018, cz * 0.018), n2 = fbm(cx * 0.05 + 40, cz * 0.05 - 12);
    if (n1 < 0.5) c.copy(cLush).lerp(cGrass, smooth(0.3, 0.5, n1)); else c.copy(cGrass).lerp(cDry, smooth(0.5, 0.72, n1));
    if (n2 > 0.66) c.lerp(cDirt, smooth(0.66, 0.8, n2) * 0.7);
    // gò đá: sườn lộ đá xám
    for (const k of ZONES.knolls) { const kd = Math.hypot(cx - k.x, cz - k.z) / k.r; if (kd < 0.9) c.lerp(cRock, smooth(0.9, 0.35, kd) * (0.45 + 0.4 * n2)); }
    // đầm lầy ven sông phía bắc
    const wd = waterDist(cx, cz);
    if (wd > 5 && wd < 34 && cx < MAP.fortWallX) c.lerp(cMarsh, smooth(34, 12, wd) * 0.6);
    // ruộng: màu từng ô, bờ ruộng hơi sẫm
    const pd = paddyAt(cx, cz);
    if (pd) c.copy(cPaddy[pd.kind]).multiplyScalar(0.95 + 0.1 * vnoise(pd.i * 3.1, pd.j * 2.7));
    // đất cháy quanh trại Nguyên
    const S = ZONES.scorch;
    if (cx > S.x0 && cx < S.x1 && Math.abs(cz) < 150) { const b = fbm(cx * 0.06, cz * 0.06); if (b > 0.55) c.lerp(cBurnt, smooth(0.55, 0.75, b) * smooth(S.x0, S.x0 + 25, cx) * 0.8); }
    let road = 0; for (const f of fronts) road = Math.max(road, smooth(9, 3, Math.abs(cz - f.laneZ)) * (cx > 50 && cx < 470 ? 1 : 0));
    road = Math.max(road, smooth(14, 5, Math.abs(cx - 60)) * (Math.abs(cz) < 80 ? 1 : 0));
    c.lerp(cRoad, road * 0.85);
    if (grid) featureTint(c, cx, cz, n2, cRoad, (pa[o + 1] + pa[o + 4] + pa[o + 7]) / 3);   // lũy, hào, hố, gò, vệt giẫm
    if (cx > MAP.fortWallX) c.lerp(cFort, 0.7);
    if (d < 16) c.lerp(cSand, smooth(16, 5, d));
    if (d < 1.5) c.lerp(cMud, 0.6);
    if (Math.hypot(cx - MAP.beach.x, cz - MAP.beach.z) < MAP.beach.r) c.lerp(cSand, 0.75);
    const shade = 0.92 + 0.08 * ((i * 2654435761) % 97) / 97;
    c.multiplyScalar(shade);
    for (let k = 0; k < 9; k += 3) { col[o + k] = c.r; col[o + k + 1] = c.g; col[o + k + 2] = c.b; }
  }
  tg.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const tCol = performance.now();
  if (grid) tg = addRuts(tg, grid);                                              // vết bánh xe: dải mỏng dán sát mặt lưới
  tg.computeVertexNormals();
  const terrain = new THREE.Mesh(tg, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  terrain.receiveShadow = true;
  scene.add(terrain);
  // groundY: độ cao đúng mặt tam giác đang vẽ (lưới mịn) — đạo cụ đặt sát đất không lơ lửng, không chìm. Dựng
  // lưới xong thì heightAt cũng trả đúng mặt này (ground.js), nên chân tướng/lính, đạo cụ, camera cùng một mặt đất.
  world.groundY = grid ? grid.meshY : heightAt;
  if (grid) { const w = laneWater(grid); if (w) scene.add(w); }
  // số liệu cho kiểm thử/đo: tam giác, thời gian dựng (lưới + độ cao, tô màu, vết bánh xe + nước + pháp tuyến)
  world.terrainInfo = { tris: tg.attributes.position.count / 3, gridTris: grid ? grid.tris : pos.count / 3, ms: Math.round(performance.now() - tStart),
    gridMs: Math.round(tGrid - tStart), colorMs: Math.round(tCol - tGrid), restMs: Math.round(performance.now() - tCol) };

  // ---- nước: lưới thưa, dập dềnh bằng offset đỉnh (không mô phỏng lực nổi, 15.2) -------------
  const wg = new THREE.PlaneGeometry(900, 700, 60, 46); wg.rotateX(-Math.PI / 2); wg.translate(300, 0, 0);
  if (lanes) {
    // mặt sông phủ cả bản đồ dưới đất liền; đáy hố, đáy hào nay xuống dưới 0,5 m nên bỏ các ô nằm sâu trong
    // đất liền (ba đỉnh cách sông > 20 m), kẻo nước sông dập dềnh lộ ra trong lòng hố
    const ix = wg.index.array, wp = wg.attributes.position, keep = [];
    const inland = (k) => { const x = wp.getX(k), z = wp.getZ(k); return x > -70 && x < 670 && z > -270 && z < 270 && waterDist(x, z) > 20; };
    for (let k = 0; k < ix.length; k += 3) if (!(inland(ix[k]) && inland(ix[k + 1]) && inland(ix[k + 2]))) keep.push(ix[k], ix[k + 1], ix[k + 2]);
    wg.setIndex(keep);
  }
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
    world.addFadeable(g, 1.0);          // lá cờ dài 1,8 m chìa ra một bên cột
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
      palisade(x, z, 10, Math.PI); tower(x + 11, z - 12);   // tháp ngoài rào để không che camera tent(x - 3, z + 3, 0.5, PAL.vai, 0.8);
      vis.flag = flagPole(x - 5, z - 5, 8);
    } else if (b.type === "doanh_trai") {
      palisade(x, z, 13, Math.PI); tent(x - 4, z - 5, 0.3, PAL.vai); tent(x + 5, z - 4, -0.4, PAL.vai); tent(x - 3, z + 6, 0.1, PAL.xam); tent(x + 4, z + 5, 0.6, PAL.xam);
      tower(x + 14, z + 14, 7);
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

  // ---- làng ven bãi (Hư cấu, cho Kế Sách "Mũi tên thư") --------------------------------------
  const hut = (x, z, ry, s = 1) => {
    const y = heightAt(x, z);
    for (const [dx, dz] of [[-1.6, -1.2], [1.6, -1.2], [-1.6, 1.2], [1.6, 1.2]]) staticParts.push(P(new THREE.BoxGeometry(0.2, 1.2, 0.2), PAL.go, { x: x + dx * s, y: y + 0.6, z: z + dz * s }));
    staticParts.push(P(new THREE.BoxGeometry(3.6 * s, 1.6 * s, 2.8 * s), 0xa08560, { x, y: y + 1.2 + 0.8 * s, z, ry }));
    staticParts.push(P(new THREE.ConeGeometry(2.9 * s, 1.8 * s, 4), 0x8f7a4a, { x, y: y + 2.9 + 0.9 * s, z, ry: ry + Math.PI / 4, sx: 1.25 }));
  };
  [[-14, -8, 0.3], [0, -14, -0.2], [13, -6, 0.6], [-10, 9, -0.4], [9, 10, 0.1], [22, 4, 0.9]].forEach(([dx, dz, r]) => hut(VILLAGE.x + dx, VILLAGE.z + dz, r, 0.9 + ((dx * 7 + dz) % 3 + 3) % 3 * 0.08));

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
    if (Math.hypot(x - VILLAGE.x, z - VILLAGE.z) < VILLAGE.r) return false;
    if (x > W - 8) return false;
    if (paddyAt(x, z)) return false;
    if (lanes && featureNear(x, z, 2)) return false;         // không mọc cây trong hào thành, trên lũy
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
  const trees = placeInst(treeGeo, 260, clear, [0.8, 1.5]);
  tintTrees(trees, rng);
  placeInst(palmGeo, 60, (x, z) => clear(x, z) && waterDist(x, z) < 40, [0.8, 1.2]);
  addScenery(scene, world, { shadows, mat });
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

// ---- lưới địa hình không đều (chỉ khi bật công trình làn đánh): số liệu thuần ở ground.js --------------------
function laneGrid() {
  const g = laneGridData();
  g.geo = new THREE.BufferGeometry(); g.geo.setAttribute("position", new THREE.BufferAttribute(g.pos, 3));
  return g;
}

// ---- màu công trình trên mặt đất ---------------------------------------------------------------------
// Đất đắp nện vàng nâu (lũy Nguyên mới đắp; ụ ta cũ hơn, cỏ bò lên cao hơn), đỉnh bị giẫm sẫm hơn, cỏ viền
// chân mái lởm chởm theo nhiễu; lòng hào/hố đất sẫm, đáy bùn ướt (theo mudAt); gờ đất hất quanh miệng hố
// và mép hào sáng hơn; màu đường đi xuyên qua lối vỡ; gò khô cỏ hơn; vệt giẫm trong bãi giằng co.
const F_EARTH = new THREE.Color(0x986c45), F_EARTH_OLD = new THREE.Color(0x8a6c4a), F_CREST = new THREE.Color(0x6c4e33);
const F_WALL = new THREE.Color(0x5f4630), F_WET = new THREE.Color(0x362b20), F_CHURN = new THREE.Color(0xa68760);
const F_TRAIL = new THREE.Color(0x7e6446), F_DRY = new THREE.Color(0x9a8f52), F_SPOIL = new THREE.Color(0xb49764);
// Vệt giẫm (Hư cấu): quân hai bên đi vòng hố, dồn về lối vỡ phụ của lũy; polyline [x, z], w nửa bề rộng (m).
const TRAILS = [
  { w: 1.2, pts: [[222, -88], [240, -90], [258, -85], [276, -82.5], [298, -80]] },
  { w: 1.1, pts: [[222, -64], [240, -62.5], [258, -65.5], [272, -61.5], [288, -57.5], [306, -55]] },
  { w: 0.9, pts: [[226, -100], [244, -97], [262, -99], [280, -101]] },
  { w: 1.2, pts: [[222, 64], [244, 62], [262, 63.5], [280, 60], [296, 57], [308, 56]] },
  { w: 1.1, pts: [[222, 88], [240, 89.5], [256, 90], [274, 86.5], [292, 85], [300, 81]] },
  { w: 0.9, pts: [[228, 50], [248, 52], [266, 49], [284, 51]] },
];
function trailAt(x, z) {
  if (x < 220 || x > 310 || Math.abs(Math.abs(z) - 75) > 30) return 0;
  let m = 0;
  for (const t of TRAILS) {
    const p = t.pts;
    for (let k = 0; k < p.length - 1; k++) {
      const ax = p[k][0], az = p[k][1], dx = p[k + 1][0] - ax, dz = p[k + 1][1] - az;
      let s = ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz); s = s < 0 ? 0 : s > 1 ? 1 : s;
      const d = Math.hypot(x - ax - dx * s, z - az - dz * s);
      if (d < t.w) m = Math.max(m, smooth(t.w, t.w * 0.3, d) * smooth(p[0][0], p[0][0] + 10, x) * smooth(p[p.length - 1][0], p[p.length - 1][0] - 8, x));
    }
  }
  return m ? m * (0.35 + 0.65 * smooth(0.25, 0.5, vnoise(x * 0.15 + 3.1, z * 0.4))) : 0;   // đứt quãng
}
// y: độ cao tâm tam giác đang tô (mặt lưới đã vẽ)
function featureTint(c, x, z, n2, cRoad, y) {
  const L = featureLook(x, z);
  if (L.mound > 0) c.lerp(F_DRY, L.mound * 0.35);
  const tr = trailAt(x, z) * (1 - L.sink) * (1 - L.bank);
  if (tr > 0) c.lerp(F_TRAIL, tr * 0.7);
  if (L.gap > 0) c.lerp(cRoad, L.gap * 0.85);
  if (L.rim > 0) c.lerp(F_CHURN, Math.min(1, L.rim) * 0.65);
  if (L.lip > 0) c.lerp(F_SPOIL, Math.min(1, L.lip) * 0.7);       // gờ đất đào quanh miệng hố: sáng rõ quanh lòng tối
  if (L.bank > 0) {
    // lũy Nguyên mới đắp: đất phủ tới chân (chân sau lởm chởm cỏ; chân trước liền vách hào, không để dải cỏ
    // giữa hào và lũy); ụ ta đắp đã lâu: cỏ bò lên gần nửa mái
    const f0 = L.luy ? -0.12 : 0.28;
    c.lerp(L.luy ? F_EARTH : F_EARTH_OLD, smooth(f0, f0 + 0.3, L.bank + (n2 - 0.5) * 0.35));
    if (L.crest > 0) c.lerp(F_CREST, L.crest * 0.7);
  }
  if (L.sink > 0) {
    c.lerp(F_WALL, smooth(0.02, 0.4, L.sink) * 0.9);
    const m = mudAt(x, z); if (m > 0) c.lerp(F_WET, m * 0.9);
    // Che khuất kiểu AO: càng sâu dưới mặt đất tự nhiên càng tối (đáy hố chỉ thấy một khoảnh trời). Tính theo độ
    // sâu thật của tam giác đang vẽ nên vách xa hứng nắng vẫn tối hơn gờ đất sáng quanh miệng: nhìn từ phía nào
    // hố cũng ra lõm, không thành ụ nổi. Hố tính theo tỉ lệ độ sâu hố, tối sớm từ nửa trên vách (lưới thô: vách
    // chỉ 1–2 mặt, mặt sáng tối lệch nhau quá thì lộ dáng kim tự tháp); hào tối nhẹ hơn (dài, hở hai đầu).
    const dep = bareHeightAt(x, z) - y;
    if (dep > 0) c.multiplyScalar(L.pit ? 1 - 0.66 * smooth(0.02, 0.6, dep / L.pd) : 1 - 0.32 * smooth(0.03, 1.0, dep));
  }
}

// ---- vết bánh xe: dải mỏng 0,22 m dán cao 3 cm trên mặt lưới, gộp vào lưới địa hình (không thêm draw) -------
// Hai vết song song cách 1,5 m, uốn nhẹ, đi trên đường qua bãi giằng co vào lối vỡ của lũy; đứt quãng và
// ngắt khi gặp công trình (hố lấn mép đường).
const RUTS = [{ z: -75, o: 2.4, a: 0.9, k: 0.07, p: 1.0 }, { z: -75, o: -3.2, a: 0.7, k: 0.05, p: 3.0 },
  { z: 75, o: -2.0, a: 0.8, k: 0.06, p: 0.4 }, { z: 75, o: 3.4, a: 0.6, k: 0.08, p: 2.2 }];
const RUT_COL = new THREE.Color(0x806243);
function addRuts(tg, grid) {
  const P = [], C = [], W = 0.11, LIFT = 0.03, STEP = 0.8;
  for (const r of RUTS) for (const side of [-0.75, 0.75]) {
    let prev = null;
    for (let x = 226; x <= 306; x += STEP) {
      const zc = (xx) => r.z + r.o + r.a * Math.sin(r.k * xx + r.p) + side;
      const z = zc(x), dzdx = (zc(x + 0.1) - z) / 0.1, n = Math.hypot(1, dzdx), nx = -dzdx / n * W, nz = 1 / n * W;
      const on = !featureNear(x, z, 0.6) && vnoise(x * 0.23 + r.p * 7, side * 0.4 + r.o) > 0.47;
      const cur = on ? [x + nx, grid.meshY(x + nx, z + nz) + LIFT, z + nz, x - nx, grid.meshY(x - nx, z - nz) + LIFT, z - nz] : null;
      if (prev && cur) {
        // l phía +z, r phía −z; (r0 l0 r1) (l0 l1 r1) quay mặt lên như lưới đất (vật liệu một mặt)
        const [lx0, ly0, lz0, rx0, ry0, rz0] = prev, [lx1, ly1, lz1, rx1, ry1, rz1] = cur;
        P.push(rx0, ry0, rz0, lx0, ly0, lz0, rx1, ry1, rz1, lx0, ly0, lz0, lx1, ly1, lz1, rx1, ry1, rz1);
      }
      prev = cur;
    }
  }
  for (let i = 0; i < P.length / 3; i++) C.push(RUT_COL.r, RUT_COL.g, RUT_COL.b);
  const p0 = tg.attributes.position.array, c0 = tg.attributes.color.array;
  const pos = new Float32Array(p0.length + P.length), col = new Float32Array(c0.length + C.length);
  pos.set(p0); pos.set(P, p0.length); col.set(c0); col.set(C, c0.length);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}

// ---- nước trong hố ngập và đáy hào thành (cắt từ tam giác đất, ground.laneWaterData) -------------------------
// Một lưới, vật liệu giống ô ruộng ngập (scenery.js); nước hố ngả đục bùn, nước hào trong hơn (màu đỉnh).
const PIT_TINT = new THREE.Color(0xc9bb96), MOAT_TINT = new THREE.Color(0xe6ecdf);
function laneWater(grid) {
  const { pos, body } = laneWaterData(grid);
  if (!pos.length) return null;
  const col = new Float32Array(pos.length);
  for (let v = 0; v < body.length; v++) { const t = body[v] ? MOAT_TINT : PIT_TINT; col[v * 3] = t.r; col[v * 3 + 1] = t.g; col[v * 3 + 2] = t.b; }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshPhongMaterial({ color: 0x6f9493, specular: 0xf6dfa0, shininess: 80, flatShading: true, transparent: true, opacity: 0.82, vertexColors: true }));
  m.receiveShadow = true;
  return m;
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

// collide(world, x, z, radius, openGates) nay ở ground.js (thuần, có lưới ô tra nhanh), xuất lại ở đầu file.

// ---- Võ trường: sân tập tròn trong Doanh trại (12.9, cấp 3) ---------------------------------------
export function buildArena(scene, { shadows = true } = {}) {
  setTerrain("arena");
  setLaneFeatures(false);                           // sân tập không có lũy, hào (featureNear, mudAt… trả rỗng)
  const rng = makeRng(1287);
  const world = { arena: true, bases: {}, gates: {}, lineFlags: {}, boats: [], colliders: [], animated: [] };
  addFader(world);
  scene.background = new THREE.Color(0xd9b98a);
  scene.fog = new THREE.Fog(0xcfae82, 120, 340);
  const skyGeo = new THREE.SphereGeometry(600, 24, 12), sc = new Float32Array(skyGeo.attributes.position.count * 3);
  const top = new THREE.Color(0x24333a), mid = new THREE.Color(0x9a6a45), hor = new THREE.Color(0xe8c894);
  for (let i = 0; i < skyGeo.attributes.position.count; i++) {
    const y = skyGeo.attributes.position.getY(i) / 600;
    const col = y > 0.25 ? mid.clone().lerp(top, (y - 0.25) / 0.75) : hor.clone().lerp(mid, Math.max(0, y) / 0.25);
    sc.set([col.r, col.g, col.b], i * 3);
  }
  skyGeo.setAttribute("color", new THREE.BufferAttribute(sc, 3));
  // Vòm trời là phông nền: vẽ trước mọi thứ, không ghi độ sâu. Vòm ghi độ sâu thì núi, mây ngoài bán kính 600 m
  // (addArenaScenery → addSky) trượt kiểm tra độ sâu, Võ trường nhìn ngang không thấy núi nào.
  const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.renderOrder = -1; scene.add(sky);
  scene.add(new THREE.HemisphereLight(0xffe6c0, 0x3a3020, 1.15));
  const sun = new THREE.DirectionalLight(0xffd29a, 2.1); sun.position.set(-40, 80, 30); sun.castShadow = shadows;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 10, far: 220 });
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04; scene.add(sun, sun.target); world.sun = sun;

  const P = (geo, color, t = {}) => part(geo, color, t);
  const parts = [];
  // nền: sân cát nện trong, cỏ ngoài, gờ đất quanh
  const ground = new THREE.PlaneGeometry(260, 260, 104, 104).toNonIndexed(); ground.rotateX(-Math.PI / 2);
  const gp = ground.attributes.position, gc = new Float32Array(gp.count * 3);
  for (let i = 0; i < gp.count; i++) gp.setY(i, heightAt(gp.getX(i), gp.getZ(i)));
  const cIn = new THREE.Color(0x8f6d4a), cOut = new THREE.Color(0x6f7a3c), cRim = new THREE.Color(0x5a4230);
  const cLushA = new THREE.Color(0x5c7234), cDryA = new THREE.Color(0x97905a), cPath = new THREE.Color(0x9a7b4f);
  for (let i = 0; i < gp.count; i += 3) {
    const x = (gp.getX(i) + gp.getX(i + 1) + gp.getX(i + 2)) / 3, z = (gp.getZ(i) + gp.getZ(i + 1) + gp.getZ(i + 2)) / 3, d = Math.hypot(x, z);
    let col;
    if (d < ARENA_R) col = cIn.clone();                                          // đất nện sẫm, tách khỏi màu sương
    else {
      const n = fbm(x * 0.03, z * 0.03);
      col = cOut.clone().lerp(n < 0.5 ? cLushA : cDryA, Math.abs(n - 0.5) * 1.6);
      const gate = Math.min(Math.abs(x), Math.abs(z));                         // đường đất từ 4 cổng ra trại
      if (gate < 4.5) col.lerp(cPath, smooth(4.5, 1.5, gate) * 0.85);
    }
    if (d < ARENA_R && ((Math.floor(x / 6) + Math.floor(z / 6)) & 1)) col.multiplyScalar(0.9);
    if (d > ARENA_R - 3 && d < ARENA_R + 1) col.lerp(cRim, 0.6);
    col.multiplyScalar(0.94 + 0.06 * (((i * 2654435761) >>> 0) % 97) / 97);
    for (let k = 0; k < 3; k++) gc.set([col.r, col.g, col.b], (i + k) * 3);
  }
  ground.setAttribute("color", new THREE.BufferAttribute(gc, 3)); ground.computeVertexNormals();
  const gm = new THREE.Mesh(ground, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })); gm.receiveShadow = true; scene.add(gm);
  // vành đất phẳng bên ngoài (gờ đã lên tới 6,3 m) để chân trời không lộ mép lưới 260 m
  const outer = new THREE.RingGeometry(126, 1100, 48, 3); outer.rotateX(-Math.PI / 2); outer.translate(0, 6.27, 0);
  scene.add(new THREE.Mesh(outer, new THREE.MeshLambertMaterial({ color: 0x6b763c })));
  // vòng vẽ vạch sân
  for (const r of [6, 18, 32]) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.4, r, 72), new THREE.MeshBasicMaterial({ color: 0xc9a14a, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.33; scene.add(ring);
  }
  // hàng rào cọc có 4 cửa
  const n = 220;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    if ([0, 1, 2, 3].some((k) => Math.abs(Math.atan2(Math.sin(a - k * Math.PI / 2), Math.cos(a - k * Math.PI / 2))) < 0.07)) continue;
    const x = Math.cos(a) * (ARENA_R + 1), z = Math.sin(a) * (ARENA_R + 1);
    parts.push(P(new THREE.CylinderGeometry(0.13, 0.16, 1.6 + (i % 3) * 0.2, 5), PAL.go, { x, y: heightAt(x, z) + 0.8, z }));
  }
  // cột cờ, giá binh khí, hình nộm rơm, lầu trống
  for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4 + Math.PI / 8, x = Math.cos(a) * (ARENA_R + 5), z = Math.sin(a) * (ARENA_R + 5);
    // cột cờ là lưới riêng (không gộp vào lưới tĩnh) để làm mờ được khi che camera
    const flag = new THREE.Mesh(merge([P(new THREE.CylinderGeometry(0.08, 0.1, 9, 5), PAL.then, { y: 4.5 }),
      P(new THREE.BoxGeometry(0.06, 2.6, 1.6), k % 2 ? PAL.son : PAL.vang, { y: 7.3, z: 0.8 })]), lambert());
    flag.position.set(x, heightAt(x, z) - 0.1, z); flag.castShadow = shadows; scene.add(flag);
    world.addFadeable(flag, 0.9);
  }
  for (let k = 0; k < 6; k++) {
    const a = rng.range(0, 6.28), x = Math.cos(a) * (ARENA_R + 12 + rng.range(0, 10)), z = Math.sin(a) * (ARENA_R + 12 + rng.range(0, 10));
    const y = heightAt(x, z), y2 = heightAt(x + 3, z);
    parts.push(P(new THREE.BoxGeometry(3, 0.2, 0.6), PAL.go, { x, y: y + 1.2, z, ry: a }), P(new THREE.BoxGeometry(0.2, 1.6, 0.6), PAL.go, { x, y: y + 0.5, z, ry: a }));
    parts.push(P(new THREE.CylinderGeometry(0.35, 0.3, 1.5, 6), 0xc8b070, { x: x + 3, y: y2 + 1.0, z }), P(new THREE.SphereGeometry(0.3, 6, 4), 0xc8b070, { x: x + 3, y: y2 + 2.0, z }));
  }
  const tower = (x, z) => {
    const y = heightAt(x, z) - 0.3;
    for (const [dx, dz] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) parts.push(P(new THREE.BoxGeometry(0.25, 7, 0.25), PAL.go, { x: x + dx, y: y + 3.8, z: z + dz }));
    parts.push(P(new THREE.BoxGeometry(4, 0.3, 4), PAL.go, { x, y: y + 7.3, z }), P(new THREE.ConeGeometry(3.4, 2, 4), PAL.son, { x, y: y + 9.3, z, ry: Math.PI / 4 }));
    parts.push(P(new THREE.CylinderGeometry(1, 1, 1.2, 12), PAL.son, { x, y: y + 8.2, z, rz: Math.PI / 2 }));
  };
  tower(-ARENA_R - 8, -ARENA_R + 10); tower(ARENA_R + 8, ARENA_R - 10);
  const m = new THREE.Mesh(merge(parts), lambert()); m.castShadow = shadows; m.receiveShadow = true; scene.add(m);
  // cây quanh sân
  const treeGeo = merge([P(new THREE.CylinderGeometry(0.2, 0.3, 2.6, 5), PAL.nau, { y: 1.3 }), P(new THREE.IcosahedronGeometry(1.7, 0), 0x4f6a32, { y: 3.4 })]);
  const im = new THREE.InstancedMesh(treeGeo, lambert(), 90), mm = new THREE.Matrix4();
  for (let i = 0; i < 90; i++) {
    const a = rng.range(0, 6.28), r = ARENA_R + 26 + rng.range(0, 40), s = rng.range(0.8, 1.5);
    mm.compose(new THREE.Vector3(Math.cos(a) * r, heightAt(Math.cos(a) * r, Math.sin(a) * r) - 0.1, Math.sin(a) * r), new THREE.Quaternion(), new THREE.Vector3(s, s, s));
    im.setMatrixAt(i, mm);
  }
  im.castShadow = shadows; scene.add(im);
  addArenaScenery(scene, world, { shadows, mat: lambert(), R: ARENA_R });
  world.update = (t) => { for (const fn of world.animated) fn(t); };
  world.setBaseOwner = () => {}; world.setBaseProgress = () => {}; world.setLine = () => {}; world.groundY = heightAt;
  world.gatePoints = [0, 1, 2, 3].map((k) => ({ x: Math.cos(k * Math.PI / 2) * (ARENA_R - 2), z: Math.sin(k * Math.PI / 2) * (ARENA_R - 2) }));
  return world;
}
