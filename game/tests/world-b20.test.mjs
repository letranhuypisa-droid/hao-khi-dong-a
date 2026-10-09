// tests/world-b20.test.mjs — thế giới B20 (battle/world-b20.js) dựng trong Node trên THREE.Scene (không WebGL): lưới địa
// hình chữ nhật và meshY khớp đúng tam giác đang vẽ (bắn tia từ trên xuống), vành ngoài không hở mép, không lỗ; giao diện
// giống buildWorld của B15 (world.js) cộng phần B20 (water, scenery, setTide, decks, addBase); vòng mốc cọc nổi theo con
// nước; hai cầu bến là boong tĩnh; ngân sách lượt vẽ / tam giác; dispose gỡ hết.
//   node hao-khi-viet/game/tests/world-b20.test.mjs
// world-b20.js import "three": nối tên đó vào vendor/three bằng module hook (Node ≥ 22.15), như tests/deck.test.mjs.
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const threeUrl = pathToFileURL(join(here, "../vendor/three/three.module.js")).href;
registerHooks({ resolve: (s, c, next) => (s === "three" ? { url: threeUrl, shortCircuit: true } : next(s, c)) });

const THREE = await import("three");
const { buildWorldB20, buildGrid, outerHeight, WB20 } = await import("../js/battle/world-b20.js");
const { TERRAIN_B20, TIDE, TIDE_Y, zc, hw, bedHeight, BOUNDS } = await import("../js/data/terrain-b20.js");
const { STAKE_FIELDS } = await import("../js/data/river-b20.js");

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log("  ok  " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + e.message); }
}
let seed = 20;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const ray = new THREE.Raycaster(), DOWN = new THREE.Vector3(0, -1, 0), O = new THREE.Vector3();
const hitY = (meshes, x, z) => { ray.set(O.set(x, 500, z), DOWN); const h = ray.intersectObjects(meshes, false); return h.length ? h[0].point.y : NaN; };

console.log("Lưới địa hình");
const G = buildGrid(TERRAIN_B20);
t("lưới theo gridSpans ≤ 110 nghìn tam giác; meshY đúng độ cao đỉnh lưới", () => {
  assert.ok(G.tris <= 110000, `${G.tris} tam giác`);
  for (let k = 0; k < 400; k++) {
    const i = Math.floor(rnd() * G.NX), j = Math.floor(rnd() * G.NZ);
    assert.ok(Math.abs(G.meshY(G.xs[i], G.zs[j]) - G.Y[j * G.NX + i]) < 1e-4, `đỉnh (${i}, ${j})`);
  }
});
// Bờ bùn trong dải lưới 2 m (x ≤ 880, hai dải z của gridSpans) lệch ≤ 0,15 m; bờ cửa sông loe và cuối lạch (ô 5 m) lệch tới
// ~0,45 m — nước lấy bảng đáy từ chính lưới vẽ (world-b20) nên mép nước vẫn khớp.
t("meshY lệch hàm độ cao trơn ≤ 0,6 m; bờ bùn trong dải lưới 2 m ≤ 0,15 m", () => {
  let worst = 0, worstBank = 0;
  for (let k = 0; k < 20000; k++) {
    const x = BOUNDS.minX + 1 + rnd() * (BOUNDS.maxX - BOUNDS.minX - 2), z = BOUNDS.minZ + 1 + rnd() * (BOUNDS.maxZ - BOUNDS.minZ - 2);
    const d = Math.abs(G.meshY(x, z) - bedHeight(x, z)), y = bedHeight(x, z);
    worst = Math.max(worst, d);
    if (y > -2 && y < 2.5 && x >= -60 && x <= 880 && ((z >= -128 && z <= -48) || (z >= 48 && z <= 120))) worstBank = Math.max(worstBank, d);
  }
  console.log(`       lệch lớn nhất ${worst.toFixed(3)} m · bờ bùn dải 2 m ${worstBank.toFixed(3)} m`);
  assert.ok(worst <= 0.6 && worstBank <= 0.15, `${worst} / ${worstBank}`);
});

console.log("Dựng thế giới (THREE.Scene, không WebGL)");
const scene = new THREE.Scene();
const t0 = performance.now();
const W = buildWorldB20(scene, { shadows: true, tide: 85 });
console.log(`       dựng ${Math.round(performance.now() - t0)} ms · ${JSON.stringify(W.terrainInfo)}`);
const chunks = scene.children.filter((o) => /^terrain-b20-\d/.test(o.name)), outerLand = scene.getObjectByName("terrain-b20-outer");

t("meshY khớp đúng tam giác đang vẽ (tia bắn từ trên xuống, 400 điểm)", () => {
  for (let k = 0; k < 400; k++) {
    const x = BOUNDS.minX + 0.5 + rnd() * (BOUNDS.maxX - BOUNDS.minX - 1), z = BOUNDS.minZ + 0.5 + rnd() * (BOUNDS.maxZ - BOUNDS.minZ - 1);
    const h = hitY(chunks, x, z);
    assert.ok(h === h, `không trúng lưới ở (${x.toFixed(1)}, ${z.toFixed(1)}) — mặt úp hoặc lỗ`);
    assert.ok(Math.abs(h - W.groundY(x, z)) < 2e-3, `(${x.toFixed(1)}, ${z.toFixed(1)}): lưới ${h.toFixed(3)} ≠ meshY ${W.groundY(x, z).toFixed(3)}`);
  }
});
t("nước lấy bảng đáy từ lưới vẽ (meshY), không từ hàm trơn: mép nước khớp chỗ lưới đất cắt mặt nước", () => {
  const tex = W.water.bedTex, { width: nx, data } = tex.image, step = (BOUNDS.maxX - BOUNDS.minX) / (nx - 1);
  let worst = 0;
  for (let k = 0; k < 3000; k++) {
    const i = Math.floor(rnd() * nx), j = Math.floor(rnd() * tex.image.height), x = BOUNDS.minX + i * step, z = BOUNDS.minZ + j * step;
    const y = W.groundY(x, z); if (y > 3) continue;                              // bờ và lòng sông (half-float chính xác ~1 cm)
    worst = Math.max(worst, Math.abs(THREE.DataUtils.fromHalfFloat(data[j * nx + i]) - y));
  }
  assert.ok(worst < 0.01, `lệch ${worst}`);
});
t("vành ngoài: không lỗ, không hở mép (mọi điểm ngoài bản đồ trúng đất vành ngoài hoặc lưới trong)", () => {
  const O2 = WB20.outer, all = [...chunks, outerLand];
  for (let k = 0; k < 500; k++) {
    // nửa số điểm dồn sát mép bản đồ (dải khoá kéo)
    let x = O2.x0 + 1 + rnd() * (O2.x1 - O2.x0 - 2), z = O2.z0 + 1 + rnd() * (O2.z1 - O2.z0 - 2);
    if (k % 2) { const side = k % 8; if (side < 2) z = BOUNDS.minZ - rnd() * 42; else if (side < 4) z = BOUNDS.maxZ + rnd() * 42; else if (side < 6) x = BOUNDS.minX - rnd() * 42; else x = BOUNDS.maxX + rnd() * 42; }
    const h = hitY(all, x, z);
    assert.ok(h === h, `lỗ ở (${x.toFixed(1)}, ${z.toFixed(1)})`);
  }
});
t("độ cao vành ngoài liền với mép bản đồ; phía tây sông chảy tiếp, phía đông ra biển sâu", () => {
  for (let x = BOUNDS.minX; x <= BOUNDS.maxX; x += 37) for (const z of [BOUNDS.minZ, BOUNDS.maxZ])
    assert.ok(Math.abs(outerHeight(x, z + Math.sign(z) * 0.5) - bedHeight(x, z)) < 0.6, `mép (${x}, ${z})`);
  assert.ok(outerHeight(-600, zc(-200)) < TIDE.low, "sông chảy tiếp về tây");
  assert.ok(outerHeight(2000, zc(1320)) < -6 && outerHeight(1700, zc(1320) + 300) < TIDE.low, "cửa sông loe ra biển");
  assert.ok(outerHeight(600, -900) > 5, "đất liền phía bắc");
});

console.log("Giao diện (như world.js + B20)");
t("đủ trường vòng trận dùng: colliders, bases, gates, lineFlags, boats, sun, groundY, update, fadeOccluders…", () => {
  for (const k of ["colliders", "bases", "gates", "lineFlags", "boats", "torches", "animated", "fadeables"]) assert.ok(W[k] !== undefined, k);
  for (const k of ["setBaseOwner", "setBaseProgress", "setLine", "update", "fadeOccluders", "addFadeable", "groundY", "setTide", "surfaceY", "depthAt", "addBase", "removeBase", "fitShadow", "dispose"])
    assert.equal(typeof W[k], "function", k);
  assert.ok(W.sun.isDirectionalLight && W.hemi.isHemisphereLight && W.sky.isMesh && W.far.length >= 2);
  assert.ok(W.water && W.scenery && W.decks && W.terrainInfo.tris > 50000);
  assert.equal(W.boats.length, 0, "hạm đội do director giữ");
  assert.ok(W.colliders.length > 100, `${W.colliders.length} va chạm`);
  W.fadeOccluders({ x: 600, z: 0 }, 610, 5, 0.016); W.setLine("x", 0);
});
t("Cứ Điểm: bản doanh (không vòng), hai bến, ba mốc cọc; màu chủ; tiến độ; vòng mốc cọc nổi theo con nước", () => {
  assert.deepEqual(Object.keys(W.bases).sort(), ["HQ", "M1", "M2", "M3", "P_N", "P_S"]);
  assert.ok(!W.bases.HQ.ring && W.bases.P_N.ring && W.bases.M2.ring);
  for (const f of STAKE_FIELDS) assert.ok(Math.abs(W.bases[f.id].z - zc(f.x)) < 1e-9);
  W.setTide(100); const y1 = W.bases.M2.ring.position.y; W.setTide(0); const y0 = W.bases.M2.ring.position.y;
  assert.ok(Math.abs(y1 - (TIDE_Y(100) + WB20.waterLift)) < 1e-6, `triều cao ${y1}`);
  assert.ok(y0 < y1 - 1 && y0 >= W.groundY(W.bases.M2.x, W.bases.M2.z), `triều ròng ${y0}`);
  const pn = W.bases.P_N; assert.ok(Math.abs(pn.ring.position.y - W.groundY(pn.x, pn.z) - WB20.groundLift) < 1e-6, "vòng bến trên đất");
  W.setBaseOwner("M1", "ta"); assert.equal(W.bases.M1.ring.material.color.getHex(), 0xc0392b);
  W.setBaseOwner("M1", "dich"); assert.equal(W.bases.M1.ring.material.color.getHex(), 0x3d5a78);
  const g0 = W.bases.P_S.prog.geometry; W.setBaseProgress("P_S", 0.5); assert.notEqual(W.bases.P_S.prog.geometry, g0);
  assert.ok(Math.abs(W.bases.P_S.prog.geometry.parameters.thetaLength - Math.PI) < 1e-9);
  W.setTide(85);
});
t("addBase follow: Cứ Điểm động (thuyền mắc cạn) bám theo vật mỗi update; removeBase gỡ vòng", () => {
  const boat = { x: 650, z: zc(650) };
  const v = W.addBase("S1", { r: 12, water: true, owner: "dich", follow: () => ({ x: boat.x, z: boat.z, y0: 1.5 }) });
  boat.x = 660; W.update(1); W.update(1.1);
  assert.equal(v.x, 660); assert.equal(v.ring.position.x, 660);
  assert.ok(Math.abs(v.ring.position.y - (W.tideY + WB20.waterLift + 1.5)) < 1e-6);
  const n = scene.children.length; W.removeBase("S1"); assert.equal(scene.children.length, n - 2); assert.equal(W.bases.S1, undefined);
});
t("setTide: nước, cảnh, mặt nước surfaceY; update(t) chạy (sóng, bè, phao)", () => {
  W.setTide(30); assert.equal(W.water.tideY, TIDE_Y(30)); assert.equal(W.tideY, TIDE_Y(30));
  const x = 655, z = zc(655); assert.equal(W.surfaceY(x, z), TIDE_Y(30)); assert.ok(W.depthAt(x, z) > 1);
  W.setTide(0); assert.ok(W.depthAt(x, z) < 0.9, "khúc cọc lội được khi triều ròng");
  for (let k = 0; k < 10; k++) W.update(2 + k * 0.1);
  assert.equal(W.water.uniforms.uTime.value, 2.9);
  W.setTide(85);
});
t("hai cầu bến là boong tĩnh trong W.decks: đứng giữa cầu ở mặt ván, ngoài cầu NaN", () => {
  assert.equal(W.pierDecks.length, 2); assert.equal(W.decks.all.length, 2);
  for (const d of W.pierDecks) {
    const p = W.scenery.piers.find((q) => q.id === d.pier), mid = d.toWorld(0, p.len / 2, {});
    assert.ok(Math.abs(d.heightAt(mid.x, mid.z) - (p.y + 0.05)) < 1e-9);
    const off = d.toWorld(4, p.len / 2, {}); assert.ok(Number.isNaN(d.heightAt(off.x, off.z)));
    // đầu cầu ở chỗ còn nước khi triều ròng: ván cao hơn mặt nước triều cao
    const tip = d.toWorld(0, p.len - 0.5, {}); assert.ok(W.groundY(tip.x, tip.z) < TIDE.low && p.y > TIDE.high + 0.5);
  }
});
t("ngân sách: ≤ 45 lượt vẽ (chưa tính hạm đội, bóng), địa hình + vành ngoài ≤ 115 nghìn tam giác", () => {
  let draws = 0, tris = 0;
  scene.traverseVisible((o) => { if (!o.isMesh) return; const g = o.geometry, n = (g.index ? g.index.count : g.attributes.position.count) / 3; draws++; tris += n * (o.isInstancedMesh ? o.count : 1); });
  console.log(`       ${draws} lượt · ${Math.round(tris / 1000)} nghìn tam giác (cả cảnh, không cắt khung nhìn)`);
  assert.ok(draws <= 45, `${draws} lượt`);
  assert.ok(W.terrainInfo.tris <= 115000, `${W.terrainInfo.tris}`);
});
t("dispose gỡ hết khỏi scene", () => { W.dispose(); assert.equal(scene.children.length, 0, scene.children.map((o) => o.name || o.type).join(",")); });

console.log(`\n${pass} đạt, ${fail} trượt`);
if (fail) process.exit(1);
