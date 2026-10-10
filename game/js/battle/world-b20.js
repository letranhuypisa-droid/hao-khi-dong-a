// battle/world-b20.js — thế giới trận B20 Bạch Đằng: địa hình khúc sông (lưới chữ nhật theo TERRAIN_B20.gridSpans, màu
// đỉnh theo dải bùn triều / bãi cát ướt / dải lau / cỏ bờ / nền rừng / đá vôi), nước theo Con nước (water.js), cảnh
// (scenery-b20.js), vành ngoài bản đồ (đất đồi + biển mở phía cửa sông) để chân trời không lộ mép lưới, trời, nắng, sương.
//
// Trả cùng giao diện buildWorld (world.js) mà vòng trận dùng: colliders, bases (+ ring/prog), gates, lineFlags, boats (rỗng —
// hạm đội do director giữ), setBaseOwner, setBaseProgress, setLine, update(t), fadeOccluders, addFadeable, sun, groundY,
// terrainInfo; cộng thêm của B20: water, scenery, setTide(pct), tideY / tidePct, surfaceY, depthAt, decks (DeckSet, gồm
// hai cầu bến), hemi / sky / far (atmosphere.js khỏi phải dò cảnh), addBase (Cứ Điểm động: thuyền mắc cạn), dispose.
//
// Không sửa world.js / ground.js (giai đoạn nền móng): phần làm mờ vật che camera chép lại từ world.js (addFader).
// Mọi số là ĐỀ XUẤT BẢN THỬ; màu theo bảng sơn mài của B15 (world.js, models.js PAL).
//
// Ghi chú cho giai đoạn lõi (B7, đợt 9 nền móng):
//   • Mặt đất là world.groundY = grid.meshY (đúng tam giác đang vẽ), KHÔNG phải bedHeight trơn: lưới 4–12 m lệch hàm trơn tới
//     ~0,5 m ở bờ cửa sông loe / cuối lạch (dải bờ 2 m ≤ 0,1 m). ground.js setBattleTerrain nên lấy world.grid (xs, zs, Y, diag)
//     hoặc world.groundY; bảng đáy của nước (water.js uBed) cũng dựng từ meshY nên mép nước khớp lưới.
//   • Lượt vẽ đo trong lab-b20 (1280 × 720, bóng bật): góc mặc định 52 (lượt chính 44), hạm đội ở khúc cọc triều cao 57,
//     hạm đội mắc cạn triều ròng 58, toàn cảnh 54 — trong trần 80 (hợp đồng §7).
//   • battle.js đặt camera far 1400: núi xa (addSkyKit z ±700, x 1750) cần far ≥ ~2000 khi nhìn từ đầu bản đồ bên kia.
//   • Sương/ánh sáng ở đây là mặc định buổi sáng (như ATMO P1 của B15, sương xa hơn cho bản đồ 1,5 km); B20 cần bảng ATMO
//     6 pha riêng (atmosphere.js tìm vòm trời, núi xa qua world.sky / world.far — đã xuất sẵn).
//   • Vòng Cứ Điểm: HQ không vòng; bến P_N/P_S đặt vòng ở gốc cầu trên đỉnh bờ (nút MAP.piers nằm ngoài nước, xem
//     scenery-b20 pierLayout); mốc cọc M1–M3 nổi theo con nước. Thuyền mắc cạn thành Cứ Điểm động: world.addBase(id,
//     { follow: () => ({ x, z, y0 }) }). Hai cầu bến là boong tĩnh trong world.decks (DeckSet): lớp mặt đất lấy
//     max(groundY, decks.heightAt) sẽ cho người đứng trên ván cầu.

import * as THREE from "three";
import { TERRAIN_B20, TIDE, TIDE_Y, zc, hw, bedHeight, bedHeightExact, gridAxis, vnoise, HQ_PAD, BOUNDS, WAVES, WADE_MAX } from "../data/terrain-b20.js";
import { STAKE_FIELDS } from "../data/river-b20.js";
import { MAP } from "../data/battle-b20.js";
import { lambert } from "./models.js";
import { Water, wetBandMaterialPatch } from "./water.js";
import { addSceneryB20, layoutB20, SCN } from "./scenery-b20.js";
import { Deck, DeckSet } from "./deck.js";

const sstep = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const fbm = (x, z) => 0.5 * vnoise(x, z) + 0.3 * vnoise(x * 2.03 + 17.1, z * 2.03 - 9.4) + 0.2 * vnoise(x * 4.1 - 31.7, z * 4.1 + 5.3);

// ---- hằng số (ĐỀ XUẤT BẢN THỬ) -------------------------------------------------------------------------------------
export const WB20 = {
  chunks: 6,                          // địa hình chia 6 khúc theo x (cắt khung nhìn: nhìn dọc sông thường vẽ 3–5 khúc)
  outer: { x0: -1000, x1: 2440, z0: -1220, z1: 1220, cell: 40 },   // vành ngoài: lưới 40 m (bội của bản đồ để khớp mép)
  plain: { y: 7, amp: 9, dist: 260 }, // vành ngoài hạ dần về đồng bằng thấp gợn đồi (+7..+16 m) trong 260 m: núi đá vôi xa
                                      // (addSkyKit, z ±700, x 1750) mọc lên từ sương, không bị đồi vành ngoài che chân
  seaDeep: -9, seaFlare: 300,          // cửa sông ra biển: đáy sâu dần, lòng loe (m) theo khoảng cách ra ngoài mép đông
  fog: { color: 0xcfae82, near: 170, far: 760 },
  domeR: 1100,                        // vòm trời theo camera (bản đồ 1,5 km: vòm cố định ở gốc sẽ lộ mép)
  ring: { marker: 10, pier: 9 },      // vòng mốc cọc, vòng bến (m)
  groundLift: 0.12, waterLift: 0.32,  // vòng nằm trên mặt đất / trên mặt nước (cao hơn sóng ≤ 0,26 m kẻo sóng che nửa vòng)
};

// ---- lưới địa hình (thuần số: world-b20 và kiểm thử dùng chung) ---------------------------------------------------------
// Lưới chữ nhật không đều từ gridSpans; mỗi ô chọn đường chéo sát hàm độ cao hơn ở tâm ô (bờ bùn xiên theo dòng uốn,
// cửa lạch). meshY(x, z) trả đúng độ cao tam giác đang vẽ (đồ đặt sát đất không lơ lửng, không chìm).
export function buildGrid(terrain = TERRAIN_B20) {
  const xs = gridAxis(terrain.gridSpans.x), zs = gridAxis(terrain.gridSpans.z), NX = xs.length, NZ = zs.length, H = terrain.height;
  const Y = new Float32Array(NX * NZ);
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) Y[j * NX + i] = H(xs[i], zs[j]);
  const diag = new Uint8Array((NX - 1) * (NZ - 1));        // 0: chéo a–c (x0,z0 → x1,z1); 1: chéo b–d
  for (let j = 0; j < NZ - 1; j++) for (let i = 0; i < NX - 1; i++) {
    const a = Y[j * NX + i], d = Y[j * NX + i + 1], b = Y[(j + 1) * NX + i], c = Y[(j + 1) * NX + i + 1];
    const hc = H((xs[i] + xs[i + 1]) / 2, (zs[j] + zs[j + 1]) / 2);
    diag[j * (NX - 1) + i] = Math.abs((b + d) / 2 - hc) < Math.abs((a + c) / 2 - hc) ? 1 : 0;
  }
  // tra ô theo mét: chỉ số cột/hàng ≤ toạ độ, rồi tiến tới đúng ô (bước lưới ≥ 2 m nên ≤ 1 bước)
  const idx = (ax) => { const a0 = Math.floor(ax[0]), n = Math.ceil(ax[ax.length - 1]) - a0 + 1, t = new Int32Array(n); let k = 0;
    for (let m = 0; m < n; m++) { while (k < ax.length - 2 && ax[k + 1] <= a0 + m) k++; t[m] = k; } return { a0, t }; };
  const IX = idx(xs), IZ = idx(zs);
  const cellOf = (ax, I, v) => { let k = I.t[Math.min(I.t.length - 1, Math.max(0, Math.floor(v) - I.a0))]; while (k < ax.length - 2 && ax[k + 1] <= v) k++; return k; };
  const x0 = xs[0], x1 = xs[NX - 1], z0 = zs[0], z1 = zs[NZ - 1];
  function meshY(x, z) {
    if (!(x >= x0 && x <= x1 && z >= z0 && z <= z1)) return H(x, z);
    const i = cellOf(xs, IX, x), j = cellOf(zs, IZ, z);
    const u = (x - xs[i]) / (xs[i + 1] - xs[i]), v = (z - zs[j]) / (zs[j + 1] - zs[j]);
    const a = Y[j * NX + i], d = Y[j * NX + i + 1], b = Y[(j + 1) * NX + i], c = Y[(j + 1) * NX + i + 1];
    if (diag[j * (NX - 1) + i] === 0) return v >= u ? a + (c - b) * u + (b - a) * v : a + (d - a) * u + (c - d) * v;
    return u + v <= 1 ? a + (d - a) * u + (b - a) * v : (d - c + b) + (c - b) * u + (c - d) * v;
  }
  return { xs, zs, NX, NZ, Y, diag, meshY, tris: 2 * (NX - 1) * (NZ - 1) };
}

// Độ cao vành ngoài bản đồ: kẹp về mép bản đồ (sông chảy tiếp về tây, đồi hai bờ nối tiếp), đất dâng dần ra xa; phía đông
// lòng cửa sông loe rộng và sâu dần ra biển. Trong bản đồ: đúng hàm độ cao.
export function outerHeight(x, z) {
  const B = BOUNDS, O = WB20;
  if (x >= B.minX && x <= B.maxX && z >= B.minZ && z <= B.maxZ) return bedHeight(x, z);
  const dxE = Math.max(0, x - B.maxX), cx = Math.min(B.maxX, Math.max(B.minX, x));
  // phía đông: lòng loe — lấy mẫu mép bản đồ ở z co về tâm dòng theo 1 / (1 + dx / flare)
  const zcx = zc(cx), zz = zcx + (z - zcx) / (1 + dxE / O.seaFlare), cz = Math.min(B.maxZ, Math.max(B.minZ, zz));
  const base = bedHeightExact(cx, cz), d = Math.hypot(x - cx, zz - cz);
  const land = sstep(2.2, 8, base), P = O.plain;
  let h = base;
  if (land > 0) h += (P.y + P.amp * vnoise(x / 150 + 3.3, z / 130 - 7.7) - base) * sstep(0, P.dist, d) * land;
  if (base < TIDE.high) h += (O.seaDeep - h) * sstep(0, 260, dxE) * (1 - land);       // biển sâu dần ra xa
  return h;
}

// ---- màu đất ---------------------------------------------------------------------------------------------------------
const C = {
  deep: 0x4f4130, shoal: 0x655139, mudLo: 0x5f4d39, mudHi: 0x7d6849, streak: 0x4a3c2c, silt: 0x86704f,
  wetSand: 0x94805c, sand: 0xab9467, reed: 0x8e8b4d, reedDry: 0x9f9555,
  grass: 0x76803f, lush: 0x5f7434, dry: 0x9a8f52, forest: 0x4c6034, forest2: 0x3d522d, glade: 0x6a7a3c,
  rock: 0x8f887a, rock2: 0xa39d8f, rockDark: 0x6e695e, dirt: 0x8a6d48, path: 0x9a7b4f,
};
for (const k in C) C[k] = new THREE.Color(C[k]);
const _c = new THREE.Color();
// Màu một tam giác: tâm (x, z), độ cao y, pháp tuyến ny, ngữ cảnh ctx { karst[], paths[] } (thuần theo toạ độ).
function groundColor(out, x, z, y, ny, ctx) {
  const n1 = fbm(x * 0.018, z * 0.018), n2 = fbm(x * 0.05 + 40, z * 0.05 - 12);
  if (y < TIDE.high) {
    // lòng sông và bãi bùn triều: sẫm dưới sâu, sáng dần lên mép triều cao; vệt bùn kéo dài theo dòng chảy (dọc x)
    const k = sstep(-4.6, TIDE.high, y);
    out.copy(C.deep).lerp(C.mudLo, sstep(0, 0.45, k)).lerp(C.mudHi, sstep(0.45, 1, k));
    const st = vnoise(x / 11 + 3.7, z / 2.6 - 1.3);
    if (st > 0.6) out.lerp(C.streak, sstep(0.6, 0.82, st) * 0.55);
    else if (st < 0.28) out.lerp(C.silt, sstep(0.28, 0.1, st) * 0.4);
    // bãi cạn khúc cọc: gợn cát bùn ngang dòng (lộ khi triều ròng)
    if (y > -2.6 && y < -1.5) { const rp = Math.sin(x * 0.55 + 2.2 * vnoise(x / 20, z / 20)); out.lerp(rp > 0.35 ? C.silt : C.shoal, 0.25); }
  } else if (y < 2.05) {
    // dải cát ướt ngay trên mép triều cao (bọt sóng để lại), loang theo nhiễu
    out.copy(C.wetSand).lerp(C.sand, sstep(TIDE.high, 2.0, y) * (0.5 + 0.5 * n2));
  } else if (y < 3.3) {
    // dải bờ phẳng: lau sậy vàng xanh, lốm đốm cỏ
    out.copy(C.reed).lerp(C.reedDry, sstep(0.45, 0.75, n2)).lerp(C.grass, sstep(2.4, 3.3, y) * 0.6);
  } else {
    // cỏ bờ → nền rừng dưới tán (sẫm) theo độ cao, trảng cỏ theo nhiễu
    if (n1 < 0.5) out.copy(C.lush).lerp(C.grass, sstep(0.3, 0.5, n1)); else out.copy(C.grass).lerp(C.dry, sstep(0.5, 0.72, n1) * 0.7);
    const fk = sstep(4, 16, y) * (1 - 0.7 * sstep(0.62, 0.78, n2));
    out.lerp(n1 > 0.52 ? C.forest2 : C.forest, fk * 0.85);
    if (fk > 0.5 && n2 > 0.66) out.lerp(C.glade, 0.4);
    // sườn dốc và đỉnh đồi cao: lộ đá vôi xám
    const rk = Math.max(sstep(0.9, 0.7, ny), sstep(34, 60, y) * sstep(0.45, 0.65, n2));
    if (rk > 0) out.lerp(n2 > 0.55 ? C.rock2 : C.rock, rk * 0.85);
  }
  // chân cột đá vôi trên bờ: đá vụn, sẫm ướt ở sát chân
  for (const k of ctx.karst) {
    const dx = x - k.x, dz = z - k.z; if (dx * dx + dz * dz > k.r * k.r * 2.4) continue;
    const d = Math.sqrt(dx * dx + dz * dz) / k.r;
    out.lerp(d < 1.05 ? C.rockDark : C.rock, sstep(1.55, 1.0, d) * 0.75);
  }
  // gò bản doanh (đất nện), lối từ cổng xuống bến sông, gốc cầu bến
  for (const p of ctx.paths) {
    const dx = p.bx - p.ax, dz = p.bz - p.az, L2 = dx * dx + dz * dz;
    let t = L2 ? ((x - p.ax) * dx + (z - p.az) * dz) / L2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const d = Math.hypot(x - p.ax - dx * t, z - p.az - dz * t);
    if (d < p.w) out.lerp(p.col, sstep(p.w, p.w * 0.45, d) * p.k * (0.75 + 0.25 * n2));
  }
  return out;
}

// ---- dựng mesh từ danh sách tam giác (không chỉ mục, màu phẳng mỗi mặt) -------------------------------------------------
function triGeo(pos, col) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals(); g.computeBoundingSphere(); g.computeBoundingBox();
  return g;
}
// Tô màu mọi tam giác của mảng vị trí (ghi thẳng vào col); jitter: xê sáng tối nhẹ từng mặt như B15.
function paint(pos, col, ctx, seed = 0) {
  for (let o = 0; o < pos.length; o += 9) {
    const ax = pos[o], ay = pos[o + 1], az = pos[o + 2], bx = pos[o + 3], by = pos[o + 4], bz = pos[o + 5], cx = pos[o + 6], cy = pos[o + 7], cz = pos[o + 8];
    const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
    const nx = uy * vz - uz * vy, nyy = uz * vx - ux * vz, nz = ux * vy - uy * vx, ny = Math.abs(nyy) / (Math.hypot(nx, nyy, nz) || 1);
    groundColor(_c, (ax + bx + cx) / 3, (az + bz + cz) / 3, (ay + by + cy) / 3, ny, ctx);
    _c.multiplyScalar(0.93 + 0.07 * (((((o / 9) + seed) * 2654435761) >>> 0) % 97) / 97);
    for (let k = 0; k < 9; k += 3) { col[o + k] = _c.r; col[o + k + 1] = _c.g; col[o + k + 2] = _c.b; }
  }
}

// Làm mờ vật che camera — chép từ world.js addFader (world.js không xuất hàm này; không sửa world.js ở giai đoạn nền móng).
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

// =====================================================================================================================
// buildWorldB20(scene, { shadows, tide, seed })
export function buildWorldB20(scene, { shadows = true, tide = 100, seed = SCN.seed } = {}) {
  const T = TERRAIN_B20, tStart = performance.now();
  const world = { id: "B20", bases: {}, gates: {}, lineFlags: {}, boats: [], torches: [], colliders: [], animated: [], terrain: T };
  addFader(world);
  world.tidePct = tide; world.tideY = TIDE_Y(tide);

  // ---- trời, sương, ánh sáng ------------------------------------------------------------------------------------------
  scene.background = new THREE.Color(0xd9b98a);
  scene.fog = new THREE.Fog(WB20.fog.color, WB20.fog.near, WB20.fog.far);
  world.fogBase = { ...WB20.fog };
  const R = WB20.domeR, skyGeo = new THREE.SphereGeometry(R, 24, 12), sc = new Float32Array(skyGeo.attributes.position.count * 3);
  const top = new THREE.Color(0x2f4a58), mid = new THREE.Color(0xa47c56), hor = new THREE.Color(0xecd0a0);
  for (let i = 0; i < skyGeo.attributes.position.count; i++) {
    const y = skyGeo.attributes.position.getY(i) / R;
    const c = y > 0.25 ? mid.clone().lerp(top, (y - 0.25) / 0.75) : hor.clone().lerp(mid, Math.max(0, y) / 0.25);
    sc.set([c.r, c.g, c.b], i * 3);
  }
  skyGeo.setAttribute("color", new THREE.BufferAttribute(sc, 3));
  // Vòm là phông nền: vẽ trước, không ghi độ sâu, luôn đặt tâm ở camera (onBeforeRender) — núi xa, mây ngoài bán kính vẫn hiện
  const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.name = "sky-dome"; sky.renderOrder = -1; sky.frustumCulled = false;
  sky.onBeforeRender = (r, s, cam) => { sky.position.copy(cam.position); sky.updateMatrixWorld(); };
  scene.add(sky); world.sky = sky;
  const hemi = new THREE.HemisphereLight(0xffe8c8, 0x3d3222, 1.12); scene.add(hemi); world.hemi = hemi;
  const sun = new THREE.DirectionalLight(0xffdcaa, 2.2);
  sun.position.set(-60, 90, 50); sun.castShadow = shadows;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 10, far: 300 });
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target); world.sun = sun;

  // ---- địa hình ---------------------------------------------------------------------------------------------------------
  const LO = layoutB20(seed);                                  // xếp chỗ cảnh (thuần, có cache): cột đá, bến, bản doanh → tô đất
  const grid = buildGrid(T), { xs, zs, NX, NZ, Y, diag } = grid;
  world.groundY = grid.meshY;
  world.grid = grid;
  const tGrid = performance.now();
  const hq = LO.hq, gateZ = hq.z + hq.palR, bankZ = zc(hq.x) - hw(hq.x) - 16;
  const ctx = {
    karst: LO.karst.filter((k) => !k.islet),
    paths: [
      { ax: hq.x, az: hq.z, bx: hq.x, bz: hq.z, w: hq.r + 2, col: C.dirt, k: 0.7 },                  // gò bản doanh
      { ax: hq.x, az: gateZ - 4, bx: hq.x + 6, bz: bankZ, w: 2.6, col: C.path, k: 0.8 },              // lối cổng → bờ sông
      ...LO.piers.map((p) => ({ ax: p.x0 - p.dir.x * 14, az: p.z0 - p.dir.z * 14, bx: p.x0, bz: p.z0, w: 3.2, col: C.path, k: 0.8 })),
      ...LO.towers.map((t) => ({ ax: t.x, az: t.z, bx: t.x + 6, bz: t.z + t.side * 4, w: 5, col: C.dirt, k: 0.5 })),
    ],
  };
  const tmat = wetBandMaterialPatch(lambert(), () => world.tideY);
  world.terrainMat = tmat;
  const chunks = [], nChunk = WB20.chunks, colsPer = Math.ceil((NX - 1) / nChunk);
  let tris = 0;
  for (let ch = 0; ch < nChunk; ch++) {
    const i0 = ch * colsPer, i1 = Math.min(NX - 1, i0 + colsPer); if (i1 <= i0) break;
    const pos = new Float32Array((i1 - i0) * (NZ - 1) * 18);
    let o = 0;
    const put = (i, j) => { pos[o++] = xs[i]; pos[o++] = Y[j * NX + i]; pos[o++] = zs[j]; };
    for (let j = 0; j < NZ - 1; j++) for (let i = i0; i < i1; i++) {
      // a (i,j) · b (i,j+1) · c (i+1,j+1) · d (i+1,j): thứ tự đỉnh cho mặt hướng lên (+y)
      if (diag[j * (NX - 1) + i] === 0) { put(i, j); put(i, j + 1); put(i + 1, j + 1); put(i, j); put(i + 1, j + 1); put(i + 1, j); }
      else { put(i, j); put(i, j + 1); put(i + 1, j); put(i, j + 1); put(i + 1, j + 1); put(i + 1, j); }
    }
    const col = new Float32Array(pos.length); paint(pos, col, ctx, ch * 7919);
    const m = new THREE.Mesh(triGeo(pos, col), tmat);
    m.name = "terrain-b20-" + ch; m.receiveShadow = true; scene.add(m); chunks.push(m);
    tris += pos.length / 9;
  }
  const tCol = performance.now();

  // ---- vành ngoài: đất (nối khít mép lưới trong bằng dải "khoá kéo") + biển mở -------------------------------------------
  const outer = buildOuter(xs, zs, grid, ctx);
  const outerLand = new THREE.Mesh(outer.land, tmat); outerLand.name = "terrain-b20-outer"; outerLand.receiveShadow = true; scene.add(outerLand);
  tris += outer.land.attributes.position.count / 3;

  // ---- nước --------------------------------------------------------------------------------------------------------------
  // bảng đáy của nước lấy từ đúng lưới đang vẽ (meshY), không từ hàm trơn: mép nước (discard, bọt) khớp chỗ lưới đất cắt
  // mặt nước — lưới 4–12 m lệch hàm trơn tới ~0,5 m ở bờ bùn ngoài dải 2 m, lệch đó thành lỗ nước / vệt đất khô dưới nước
  const water = new Water(scene, { terrain: { ...T, height: grid.meshY }, shadows });
  water.setTide(tide);
  world.water = water;
  const sea = new THREE.Mesh(outer.sea, seaMaterial(water)); sea.name = "sea-b20"; sea.frustumCulled = false; scene.add(sea);
  world.sea = sea;
  world.terrainInfo = { tris, chunks: chunks.length, outerTris: outer.land.attributes.position.count / 3, seaTris: outer.sea.attributes.position.count / 3,
    waterTris: water.tris, gridTris: grid.tris, ms: 0, gridMs: Math.round(tGrid - tStart), colorMs: Math.round(tCol - tGrid) };

  // ---- cảnh ----------------------------------------------------------------------------------------------------------------
  const mat = lambert();
  const scenery = addSceneryB20(scene, world, { shadows, mat, groundY: grid.meshY, seed });
  scenery.setTide(tide);
  world.scenery = scenery;
  world.far = [scene.getObjectByName("far-ridges")?.material, scene.getObjectByName("clouds")?.material].filter(Boolean);

  // ---- boong: sổ boong cho lớp mặt đất (director thêm boong thuyền); hai cầu bến là boong tĩnh -------------------------
  const decks = world.decks = new DeckSet();
  world.pierDecks = LO.piers.map((p) => {
    const hwid = p.w / 2, hd = p.head, y = p.y + 0.05;          // mặt ván: tấm dày 0,1 tâm ở p.y
    const d = new Deck({
      rects: [{ x0: -hwid, x1: hwid, z0: -1, z1: p.len - hd.d, y }, { x0: -hd.w / 2, x1: hd.w / 2, z0: p.len - hd.d, z1: p.len, y }],
      portals: [{ lx: 0, lz: -1, r: 2.4 }, { lx: 0, lz: p.len, r: 1.2 }],                     // gốc bến lên bờ, thang đầu bến
      walls: [],
    });
    d.setPose(p.x0, 0, p.z0, Math.atan2(p.dir.x, p.dir.z), 0, 0);
    d.pier = p.id; decks.add(d);
    return d;
  });

  // ---- Cứ Điểm / mốc: vòng trên đất hoặc trên mặt nước (mốc cọc theo con nước) ------------------------------------------
  // trong suốt hai mặt mà phẳng: một lượt vẽ (forceSinglePass) — three mặc định vẽ hai lượt (mặt sau, mặt trước) cho vật như thế
  const ringMat = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, side: THREE.DoubleSide, depthWrite: false, forceSinglePass: true });
  world.surfaceY = (x, z) => Math.max(grid.meshY(x, z), world.tideY);
  world.depthAt = (x, z) => world.tideY - grid.meshY(x, z);
  const placeRing = (v) => {
    if (!v.ring) return;
    const p = v.follow ? v.follow() : v, gy = grid.meshY(p.x, p.z);
    const y = (v.water && world.tideY > gy ? world.tideY + WB20.waterLift : gy + WB20.groundLift) + (p.y0 || 0);
    v.ring.position.set(p.x, y, p.z); v.prog.position.set(p.x, y + 0.02, p.z);
    if (v.follow) { v.x = p.x; v.z = p.z; }
  };
  // addBase(id, { x, z, r, type, owner, water, ring = true, follow: () => ({x, z, y0?}) }) — follow: Cứ Điểm động (thuyền)
  world.addBase = (id, o) => {
    const v = { id, x: o.x ?? 0, z: o.z ?? 0, r: o.r ?? 10, type: o.type || "moc", water: !!o.water, follow: o.follow || null, progVal: 0 };
    if (o.ring !== false) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(v.r - 0.35, v.r, 48), ringMat(0xffffff, 0.55));
      ring.rotation.x = -Math.PI / 2; ring.name = "ring-" + id; scene.add(ring); v.ring = ring;
      const prog = new THREE.Mesh(new THREE.RingGeometry(v.r - 1.1, v.r - 0.45, 48, 1, 0, 0.001), ringMat(0xf1d98a, 0.85));
      prog.rotation.x = -Math.PI / 2; prog.name = "prog-" + id; scene.add(prog); v.prog = prog;
      placeRing(v);
    }
    world.bases[id] = v;
    if (o.owner) world.setBaseOwner(id, o.owner);
    return v;
  };
  world.removeBase = (id) => {
    const v = world.bases[id]; if (!v) return;
    for (const m of [v.ring, v.prog]) if (m) { scene.remove(m); m.geometry.dispose(); m.material.dispose(); }
    delete world.bases[id];
  };
  // Màu vòng: ta son, địch chàm, mốc cọc chưa ai giữ tím nhạt (chỉ người chơi thấy — hợp đồng §4d R-world)
  const OWN = { ta: 0xc0392b, dich: 0x3d5a78, none: 0xb89ad8 };
  world.setBaseOwner = (id, owner) => {
    const v = world.bases[id]; if (!v) return;
    v.owner = owner;
    if (v.ring) v.ring.material.color.set(OWN[owner] ?? OWN.none);
  };
  world.setBaseProgress = (id, p) => {
    const v = world.bases[id]; if (!v || !v.prog) return;
    p = Math.max(0, Math.min(1, p));
    if (Math.abs(p - v.progVal) < 0.01) return;
    v.progVal = p; v.prog.geometry.dispose();
    v.prog.geometry = new THREE.RingGeometry(v.r - 1.1, v.r - 0.45, 48, 1, Math.PI / 2, Math.max(0.001, p * Math.PI * 2));
  };
  world.setLine = () => {};                                          // B20 không có tuyến mặt trận
  world.addBase("HQ", { x: hq.x, z: hq.z, r: MAP.hq?.r ?? 16, type: "ban_doanh", owner: "ta", ring: false });
  for (const p of LO.piers) {                                         // vòng bến ở gốc cầu trên đỉnh bờ (nút MAP.piers nằm ngoài nước)
    const q = { x: p.x0 - p.dir.x * 4, z: p.z0 - p.dir.z * 4 };
    world.addBase(p.id, { x: q.x, z: q.z, r: WB20.ring.pier, type: "ben", owner: (MAP.piers.find((m) => m.id === p.id) || {}).owner || "ta" });
  }
  for (const f of STAKE_FIELDS) world.addBase(f.id, { x: f.x, z: zc(f.x), r: WB20.ring.marker, type: "moc", water: true, owner: "none" });

  // ---- con nước, cập nhật mỗi khung ----------------------------------------------------------------------------------
  world.setTide = (pct) => {
    pct = Math.max(0, Math.min(100, pct));
    world.tidePct = pct; world.tideY = TIDE_Y(pct);
    water.setTide(pct); scenery.setTide(pct);
    seaUniforms(water).uTide.value = world.tideY;
    for (const id in world.bases) { const v = world.bases[id]; if (v.water) placeRing(v); }
  };
  let lastT = null;
  world.update = (t) => {
    const dt = lastT === null ? 0 : Math.min(0.25, Math.max(0, t - lastT)); lastT = t;
    water.update(t); seaUniforms(water).uTime.value = t;
    scenery.update(dt, t, world.tideY);
    for (const id in world.bases) { const v = world.bases[id]; if (v.follow) placeRing(v); }
    for (const fn of world.animated) fn(t);
  };
  // Khung bóng đổ quanh (x, z), nửa cạnh half m (battle.js tự đặt mặt trời theo tướng; lab dùng hàm này)
  world.fitShadow = (x, z, half = 45, dir = { x: -0.55, y: 0.72, z: 0.42 }) => {
    const L = Math.hypot(dir.x, dir.y, dir.z), k = Math.max(160, half * 2.5), y0 = world.surfaceY(x, z);
    sun.position.set(x + dir.x / L * k, y0 + dir.y / L * k, z + dir.z / L * k); sun.target.position.set(x, y0, z);
    const sh = sun.shadow.camera;
    if (sh.right !== half) { sh.left = -half; sh.right = half; sh.top = half; sh.bottom = -half; }
    sh.near = 10; sh.far = k + half * 2 + 80; sh.updateProjectionMatrix();
  };
  world.fitShadow(600, zc(600), 45);
  world.info = () => ({ ...world.terrainInfo, scenery: scenery.info(), colliders: world.colliders.length, decks: decks.all.length, bases: Object.keys(world.bases) });
  world.dispose = () => {
    scenery.dispose(); water.dispose();
    for (const m of [...chunks, outerLand, sea, sky]) { scene.remove(m); m.geometry.dispose(); }
    tmat.dispose(); sea.material.dispose(); sky.material.dispose(); mat.dispose();
    for (const id of Object.keys(world.bases)) world.removeBase(id);
    scene.remove(hemi, sun, sun.target);
  };
  world.WADE_MAX = WADE_MAX;
  world.terrainInfo.ms = Math.round(performance.now() - tStart);
  return world;
}

// ---- vành ngoài --------------------------------------------------------------------------------------------------------
// Đất: (1) dải "khoá kéo" rộng một ô 40 m quanh bản đồ nối đường mép lưới trong (đỉnh đúng trục gridSpans) với đường mép
// lưới thô, (2) lưới thô 40 m phủ phần còn lại, bỏ hình chữ nhật bản đồ đã nới một ô. Không hở mép, không chồng lấn.
// Biển: lưới thô 40 m ngoài bản đồ ở chỗ đáy dưới triều cao (ô nằm sát mép bản đồ, khít lưới nước 8 m của water.js).
function buildOuter(xs, zs, grid, ctx) {
  const O = WB20.outer, B = BOUNDS, s = O.cell;
  const P = [];
  const H = (x, z) => (x >= B.minX && x <= B.maxX && z >= B.minZ && z <= B.maxZ ? grid.meshY(x, z) : outerHeight(x, z));
  const tri = (a, b, c) => {
    // quay mặt lên (+y)
    const ux = b[0] - a[0], uz = b[2] - a[2], vx = c[0] - a[0], vz = c[2] - a[2];
    if (uz * vx - ux * vz < 0) P.push(...a, ...c, ...b); else P.push(...a, ...b, ...c);
  };
  const V = (x, z) => [x, H(x, z), z];
  const range = (a, b) => { const out = []; for (let v = a; v <= b + 1e-6; v += s) out.push(v); return out; };
  // khoá kéo: A đường trong (mịn), Bv đường ngoài (thô, dài hơn một ô mỗi đầu); tham số chung theo trục dọc mép
  const zip = (A, Bv) => {
    let i = 0, j = 0;
    while (i < A.length - 1 || j < Bv.length - 1) {
      if (j === Bv.length - 1 || (i < A.length - 1 && A[i + 1].p <= Bv[j + 1].p)) { tri(A[i].v, Bv[j].v, A[i + 1].v); i++; }
      else { tri(A[i].v, Bv[j].v, Bv[j + 1].v); j++; }
    }
  };
  const xo = range(B.minX - s, B.maxX + s), zo = range(B.minZ - s, B.maxZ + s);
  zip([...xs].map((x) => ({ p: x, v: V(x, B.minZ) })), xo.map((x) => ({ p: x, v: V(x, B.minZ - s) })));      // bắc
  zip([...xs].map((x) => ({ p: x, v: V(x, B.maxZ) })), xo.map((x) => ({ p: x, v: V(x, B.maxZ + s) })));      // nam
  zip([...zs].map((z) => ({ p: z, v: V(B.minX, z) })), zo.map((z) => ({ p: z, v: V(B.minX - s, z) })));      // tây
  zip([...zs].map((z) => ({ p: z, v: V(B.maxX, z) })), zo.map((z) => ({ p: z, v: V(B.maxX + s, z) })));      // đông
  // lưới thô
  const X = range(O.x0, O.x1), Z = range(O.z0, O.z1), NX = X.length, NZ = Z.length, HY = new Float32Array(NX * NZ);
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) HY[j * NX + i] = H(X[i], Z[j]);
  const at = (i, j) => [X[i], HY[j * NX + i], Z[j]];
  const inside = (i, j, pad) => X[i] >= B.minX - pad && X[i + 1] <= B.maxX + pad && Z[j] >= B.minZ - pad && Z[j + 1] <= B.maxZ + pad;
  const S = [];
  for (let j = 0; j < NZ - 1; j++) for (let i = 0; i < NX - 1; i++) {
    if (!inside(i, j, s)) { const a = at(i, j), b = at(i, j + 1), c = at(i + 1, j + 1), d = at(i + 1, j); tri(a, b, c); tri(a, c, d); }
    if (!inside(i, j, 0)) {
      const h = Math.min(HY[j * NX + i], HY[j * NX + i + 1], HY[(j + 1) * NX + i], HY[(j + 1) * NX + i + 1]);
      if (h < TIDE.high + 0.5) S.push(X[i], 0, Z[j], X[i], 0, Z[j + 1], X[i + 1], 0, Z[j + 1], X[i], 0, Z[j], X[i + 1], 0, Z[j + 1], X[i + 1], 0, Z[j]);
    }
  }
  const pos = new Float32Array(P), col = new Float32Array(pos.length);
  paint(pos, col, { karst: [], paths: [] }, 31337);
  // xa dần: nhạt về màu sương, rừng xa hơi xanh xám (đỡ lốm đốm dưới sương dày)
  const land = triGeo(pos, col);
  const sea = new THREE.BufferGeometry(); sea.setAttribute("position", new THREE.Float32BufferAttribute(S, 3)); sea.computeVertexNormals();
  return { land, sea };
}

// Biển mở ngoài bản đồ: cùng sóng với nước sông (WAVES), màu sâu, không có bảng đáy (ngoài bản đồ luôn sâu hoặc là đất —
// đất nhô lên che mặt biển). Dùng chung uTime/uTide với nước sông qua seaUniforms.
const SEA = new WeakMap();
function seaUniforms(water) {
  let u = SEA.get(water);
  if (!u) { u = { uTime: { value: 0 }, uTide: { value: water.tideY } }; SEA.set(water, u); }
  return u;
}
function seaMaterial(water) {
  const U = seaUniforms(water);
  const m = new THREE.MeshPhongMaterial({ color: 0x2f5d62, specular: 0xf1d98a, shininess: 60, flatShading: true, transparent: true, opacity: 0.97 });
  const waves = WAVES.map((w) => `${w.amp.toFixed(4)} * sin(uTime * ${w.w.toFixed(4)} + p.x * ${w.kx.toFixed(4)} + p.y * ${w.kz.toFixed(4)})`).join(" + ");
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nuniform float uTime, uTide;")
      .replace("#include <begin_vertex>", `#include <begin_vertex>\n{ vec2 p = (modelMatrix * vec4(position, 1.0)).xz; transformed.y = uTide + (${waves}); }`);
  };
  m.customProgramCacheKey = () => "b20-sea";
  return m;
}
