// tests/scenery-b20.test.mjs — cảnh khúc sông Bạch Đằng (battle/scenery-b20.js, battle/kit.js) trong Node: cọc nằm trong
// bãi và trên bãi cạn, cao đúng khoảng, ló mặt nước dưới ~30% con nước, chìm ở triều cao; không gì đặt vào lòng sâu (trừ
// đảo đá ngoài luồng); va chạm không chắn luồng tàu và lạch nhánh; bến, tháp, bản doanh, phao chặn luồng; dựng cả cảnh
// trên THREE.Scene (không cần WebGL) để đếm lượt vẽ / tam giác; bè trôi và mờ; phao ẩn tới khi show().
//   node hao-khi-viet/game/tests/scenery-b20.test.mjs
// scenery-b20.js import "three": nối tên đó vào vendor/three bằng module hook (Node ≥ 22.15), như tests/deck.test.mjs.
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const threeUrl = pathToFileURL(join(here, "../vendor/three/three.module.js")).href;
registerHooks({ resolve: (s, c, next) => (s === "three" ? { url: threeUrl, shortCircuit: true } : next(s, c)) });

const THREE = await import("three");
const { SCN, fairwayHW, stakeLayout, pierLayout, boomLayout, layoutB20, addSceneryB20 } = await import("../js/battle/scenery-b20.js");
const { karstGeo } = await import("../js/battle/kit.js");
const { TIDE, TIDE_Y, zc, hw, bedHeight, waterDist, stakeFieldAt, TRIBS, tribAt, HQ_PAD, BOUNDS, WADE_MAX } = await import("../js/data/terrain-b20.js");
const { STAKE_FIELDS } = await import("../js/data/river-b20.js");
const { MAP } = await import("../js/data/battle-b20.js");

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log("  ok  " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + e.message); }
}
const L = layoutB20();

console.log("Bãi cọc");
t("mỗi bãi ~300 cọc, chân và đỉnh nằm trong khung 70 × 60 m của đúng mốc", () => {
  for (const f of STAKE_FIELDS) {
    const S = L.stakes[f.id];
    assert.ok(S.length >= 280 && S.length <= 320, `${f.id}: ${S.length} cọc`);
    for (const s of S) {
      assert.equal(stakeFieldAt(s.x, s.z), f.id, `${f.id} chân (${s.x.toFixed(1)}, ${s.z.toFixed(1)})`);
      assert.equal(stakeFieldAt(s.top.x, s.top.z), f.id, `${f.id} đỉnh`);
    }
  }
});
t("cọc đứng trên bãi cạn (đáy −2,6 … −1,6), không ở lòng sâu", () => {
  for (const f of STAKE_FIELDS) for (const s of L.stakes[f.id]) {
    assert.ok(s.bed > -2.6 && s.bed < -1.6, `${f.id} đáy ${s.bed.toFixed(2)}`);
    assert.ok(Math.abs(s.bed - bedHeight(s.x, s.z)) < 1e-9);
  }
});
t("đỉnh cọc = đáy + 1,8 … 2,6 m (sau khi nghiêng); nghiêng ≤ 0,15 rad; bán kính 5–19 cm (đường kính 10–30 cm ±)", () => {
  for (const f of STAKE_FIELDS) for (const s of L.stakes[f.id]) {
    const d = s.top.y - s.bed;
    assert.ok(d >= 1.8 - 1e-6 && d <= 2.6 + 1e-6, `cao ${d.toFixed(3)}`);
    assert.ok(Math.abs(s.rx) <= 0.15 + 1e-9 && Math.abs(s.rz) <= 0.15 + 1e-9);
    assert.ok(s.r >= 0.05 && s.r <= 0.19, `r ${s.r}`);
    assert.ok(s.L >= 1.5 && s.L <= 3.2, `dài ${s.L.toFixed(2)} (canon 1,5–3 m + phần chôn)`);
  }
});
t("triều cao: mọi đỉnh cọc chìm ≥ 0,5 m; dưới 30% con nước: mọi đỉnh ló khỏi mặt nước", () => {
  for (const f of STAKE_FIELDS) for (const s of L.stakes[f.id]) {
    assert.ok(TIDE_Y(100) - s.top.y >= 0.5, `${f.id} đỉnh ${s.top.y.toFixed(2)} chỉ chìm ${(TIDE_Y(100) - s.top.y).toFixed(2)}`);
    assert.ok(s.top.y > TIDE_Y(30), `${f.id} đỉnh ${s.top.y.toFixed(2)} ≤ mặt nước 30%`);
  }
});
t("~10% cọc gãy; cọc không chồng khít nhau (cách ≥ 0,5 m)", () => {
  const all = STAKE_FIELDS.flatMap((f) => L.stakes[f.id]), br = all.filter((s) => s.broken).length / all.length;
  assert.ok(br > 0.06 && br < 0.14, `gãy ${(br * 100).toFixed(1)}%`);
  for (const f of STAKE_FIELDS) { const S = L.stakes[f.id]; for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) assert.ok(Math.hypot(S[i].x - S[j].x, S[i].z - S[j].z) > 0.5, `${f.id} ${i}/${j}`); }
});
t("xếp cọc tất định (cùng seed → cùng kết quả), seed khác → khác", () => {
  const a = JSON.stringify(stakeLayout(STAKE_FIELDS[1])), b = JSON.stringify(stakeLayout(STAKE_FIELDS[1]));
  assert.equal(a, b); assert.notEqual(a, JSON.stringify(stakeLayout(STAKE_FIELDS[1], 7)));
});

console.log("Không đặt vào lòng sâu, không chắn luồng");
t("cây, sú vẹt, lau, đá: không ở chỗ sâu hơn WADE_MAX khi triều ròng", () => {
  const low = TIDE.low - WADE_MAX;
  for (const k of ["trees", "mangroves", "reeds", "rocks"]) for (const o of L[k]) assert.ok(bedHeight(o.x, o.z) > low, `${k} (${o.x.toFixed(0)}, ${o.z.toFixed(0)}) đáy ${bedHeight(o.x, o.z).toFixed(2)}`);
});
t("sú vẹt trong dải bùn triều (đáy −0,7 … +1,5), tán cao hơn triều cao; lau ở mép triều cao (+1,1 … +3,0); cây trên đất (≥ +2,6)", () => {
  for (const m of L.mangroves) { const y = bedHeight(m.x, m.z); assert.ok(y >= -0.7 && y <= 1.5); assert.ok(y + 2.6 * m.sy >= TIDE.high + 0.3, `tán ${(y + 2.6 * m.sy).toFixed(2)}`); }
  for (const r of L.reeds) { const y = bedHeight(r.x, r.z); assert.ok(y >= 1.1 && y <= 3.0); }
  for (const tr of L.trees) assert.ok(bedHeight(tr.x, tr.z) >= 2.6);
});
t("không cây, sú, lau, đá, cột đá bờ nào trong luồng tàu (|z − zc| < fairwayHW) hay trong lạch nhánh", () => {
  for (const k of ["trees", "mangroves", "reeds", "rocks", "karst"]) for (const o of L[k]) {
    const r = o.r ?? 0;
    assert.ok(Math.abs(o.z - zc(o.x)) - r >= fairwayHW(o.x), `${k} (${o.x.toFixed(0)}, ${o.z.toFixed(0)}) trong luồng`);
    const tr = tribAt(o.x, o.z);
    if (k !== "karst" || !o.islet) assert.ok(!tr || tr.ad > tr.hw + r * 0.9, `${k} (${o.x.toFixed(0)}, ${o.z.toFixed(0)}) trong lạch ${tr?.id}`);
  }
});
t("cột đá bờ đứng trên đất (chân không chạm nước triều cao); đảo đá chỉ ở cửa sông x ≥ 975, ngoài luồng ≥ 8 m", () => {
  const bank = L.karst.filter((k) => !k.islet), isl = L.karst.filter((k) => k.islet);
  assert.ok(bank.length >= 40, `cột bờ ${bank.length}`); assert.ok(isl.length >= 15, `đảo đá ${isl.length}`);
  for (const k of bank) assert.ok(waterDist(k.x, k.z) > k.r * 0.8, `(${k.x.toFixed(0)}, ${k.z.toFixed(0)}) r ${k.r.toFixed(1)} wd ${waterDist(k.x, k.z).toFixed(1)}`);
  for (const k of isl) { assert.ok(k.x >= 975); assert.ok(Math.abs(k.z - zc(k.x)) - k.r >= fairwayHW(k.x) + 8 - 1e-9); }
  for (let i = 0; i < L.karst.length; i++) for (let j = i + 1; j < L.karst.length; j++) {
    const a = L.karst[i], b = L.karst[j]; assert.ok(Math.hypot(a.x - b.x, a.z - b.z) > (a.r + b.r) * 0.9, "cột đá chồng nhau");
  }
});
t("mỗi cửa lạch có cột đá canh hai bên (thuyền phục lao ra từ khe đá)", () => {
  for (const tr of TRIBS) {
    const near = L.karst.filter((k) => !k.islet && Math.hypot(k.x - tr.x0, k.z - tr.z0) < 150);
    assert.ok(near.length >= 2, `${tr.id}: ${near.length}`);
  }
});

console.log("Bến, tháp, bản doanh, phao chặn luồng");
t("hai bến: gốc trên đỉnh bờ (≥ +2,1), đầu ở nước còn sâu khi triều ròng, sàn trên mặt triều cao + sóng", () => {
  assert.equal(L.piers.length, 2);
  for (const p of L.piers) {
    assert.ok(bedHeight(p.x0, p.z0) >= 2.1, `${p.id} gốc ${bedHeight(p.x0, p.z0).toFixed(2)}`);
    assert.ok(bedHeight(p.x1, p.z1) < TIDE.low, `${p.id} đầu ${bedHeight(p.x1, p.z1).toFixed(2)}`);
    assert.ok(p.len >= 10 && p.len <= 45, `${p.id} dài ${p.len.toFixed(1)}`);
    assert.ok(p.y > TIDE.high + 0.5);
    const node = MAP.piers.find((q) => q.id === p.id);
    assert.ok(Math.hypot(p.x0 - node.x, p.z0 - node.z) < 35, `${p.id} gốc cách nút ${Math.hypot(p.x0 - node.x, p.z0 - node.z).toFixed(1)} m`);
  }
});
t("tháp canh trên dải bờ khô; bản doanh trên gò HQ_PAD (≥ 6 m)", () => {
  for (const tw of L.towers) { assert.ok(bedHeight(tw.x, tw.z) > TIDE.high + 0.8); assert.ok(waterDist(tw.x, tw.z) > 8); }
  assert.ok(Math.hypot(L.hq.x - MAP.hq.x, L.hq.z - MAP.hq.z) < 1.5);
  assert.ok(bedHeight(L.hq.x, L.hq.z) >= 6 - 1e-6);
});
t("phao chặn luồng x ≈ 840: phủ hết lòng sông cái, cong về hạ lưu, khúc gỗ nối liền, để ngỏ cửa sông Giá", () => {
  const B = boomLayout(), X = MAP.khoaiBoom.x;
  assert.ok(B.zN <= zc(B.xN) - hw(B.xN) + 2.01 && B.zS >= zc(X) + hw(X));
  assert.ok(B.xN >= X && B.xN <= X + 40, `đầu bắc x ${B.xN}`);
  for (const p of [B.anchorN, B.logs[0]]) { const tr = tribAt(p.x, p.z); assert.ok(!tr || tr.ad > tr.hw + 2, `lấn lạch ${tr?.id}`); }
  const mid = B.logs[Math.floor(B.logs.length / 2)], last = B.logs[B.logs.length - 1];
  assert.ok(Math.abs(B.logs[0].x - B.xN) < 2 && Math.abs(last.x - X) < 2, "hai đầu dãy");
  assert.ok(mid.x > (X + B.xN) / 2 + 4, "cong võng về hạ lưu");
  for (let i = 1; i < B.logs.length; i++) assert.ok(Math.hypot(B.logs[i].x - B.logs[i - 1].x, B.logs[i].z - B.logs[i - 1].z) < SCN.boom.log + SCN.boom.gap + 0.3);
  assert.ok(bedHeight(B.anchorS.x, B.anchorS.z) >= 2.1);
});
t("không đặt gì lên đường cầu bến, gò bản doanh, chân tháp", () => {
  for (const k of ["trees", "mangroves", "reeds", "rocks"]) for (const o of L[k]) assert.ok(!L.keep(o.x, o.z), `${k} (${o.x.toFixed(0)}, ${o.z.toFixed(0)})`);
  for (const k of L.karst) assert.ok(!L.keep(k.x, k.z, k.r + 5));
});

console.log("Dựng cảnh (THREE.Scene, không WebGL)");
const scene = new THREE.Scene(), world = { colliders: [] };
const sc = addSceneryB20(scene, world, { shadows: true });
t("ngân sách: ≤ 30 lượt vẽ, ≤ 120 nghìn tam giác (triều cao: cọc tắt; triều ròng: cọc hiện)", () => {
  sc.setTide(100); const hi = sc.info(); sc.setTide(0); const lo = sc.info(); sc.setTide(100);
  console.log(`       triều cao ${hi.draws} lượt / ${hi.tris} tam giác · triều ròng ${lo.draws} lượt / ${lo.tris} tam giác · va chạm ${hi.colliders}`);
  assert.ok(lo.draws <= 30 && hi.draws <= 30); assert.ok(lo.tris <= 120000, `${lo.tris} tam giác`);
  assert.ok(lo.draws > hi.draws, "triều ròng phải thêm lượt vẽ cọc");
});
t("cột đá vôi ~250–350 tam giác (hai đỉnh ≤ 650)", () => {
  const n = (g) => g.attributes.position.count / 3;
  assert.ok(n(karstGeo({ seed: 11, h: 3.4 })) <= 350 && n(karstGeo({ seed: 11, h: 3.4 })) >= 180);
  assert.ok(n(karstGeo({ seed: 37, h: 2.6, notch: true })) <= 380);
  assert.ok(n(karstGeo({ seed: 23, h: 2.3, twin: true })) <= 650);
});
t("va chạm không chắn luồng tàu, lạch nhánh (đảo đá: ngoài luồng); mọi va chạm trong vùng bản đồ", () => {
  assert.ok(world.colliders.length > 40, `${world.colliders.length} va chạm`);
  for (const c of world.colliders) {
    for (const [x, z] of [[c.x0, c.z0], [c.x1, c.z1]]) {
      assert.ok(x > BOUNDS.minX && x < BOUNDS.maxX && z > BOUNDS.minZ && z < BOUNDS.maxZ);
      const off = Math.abs(z - zc(x)) - c.r;
      assert.ok(off >= fairwayHW(x), `va chạm (${x.toFixed(0)}, ${z.toFixed(0)}) r ${c.r.toFixed(1)} lấn luồng ${(fairwayHW(x) - off).toFixed(1)} m`);
      const tr = tribAt(x, z);
      assert.ok(!tr || tr.ad - c.r > tr.hw, `va chạm (${x.toFixed(0)}, ${z.toFixed(0)}) lấn lạch ${tr?.id}`);
    }
  }
});
t("setState: active → bè trôi xuôi, cắt dây, mờ hết sau life s; hidden → bè về chỗ; exposed → phao chàm hiện", () => {
  const r = sc.rafts.list[0], x0 = r.x;
  sc.stakes.setState("M1", "active");
  for (let i = 0; i < 20; i++) sc.update(0.5, i * 0.5, TIDE_Y(70));
  assert.ok(r.drifting && r.x > x0 + 8, `trôi ${(r.x - x0).toFixed(1)} m`);
  for (let i = 0; i < 60; i++) sc.update(0.5, 10 + i * 0.5, TIDE_Y(60));
  assert.ok(r.gone);
  const m = new THREE.Matrix4(), s = new THREE.Vector3(); scene.getObjectByName("rafts").getMatrixAt(0, m); s.setFromMatrixScale(m);
  assert.ok(s.x < 0.01, "bè đã mờ hết");
  sc.stakes.setState("M1", "hidden"); sc.update(0.1, 50, TIDE_Y(60));
  assert.ok(!r.drifting && r.x === x0);
  sc.stakes.setState("M2", "exposed"); sc.update(0.1, 51, TIDE_Y(60));
  scene.getObjectByName("buoys").getMatrixAt(1, m); s.setFromMatrixScale(m); assert.ok(s.x > 0.99, "phao mốc lộ hiện");
  assert.equal(sc.stakes.state.M2, "exposed");
});
t("phao chặn luồng ẩn tới show(); world.boom trỏ đúng; khúc gỗ nổi trên mặt nước, không chìm vào bùn", () => {
  assert.equal(world.boom, sc.boom); assert.equal(scene.getObjectByName("boom").visible, false);
  world.boom.show(); for (let i = 0; i < 10; i++) sc.update(0.5, 60 + i * 0.5, TIDE_Y(0));
  const im = scene.getObjectByName("boom"), m = new THREE.Matrix4(), p = new THREE.Vector3();
  assert.ok(im.visible);
  for (let i = 0; i < im.count; i++) { im.getMatrixAt(i, p.setScalar(0) && m); p.setFromMatrixPosition(m); assert.ok(p.y >= bedHeight(p.x, p.z) + 0.2, `khúc ${i} chìm vào bùn`); }
  world.boom.hide(); assert.equal(im.visible, false);
});
t("dispose gỡ hết khỏi scene", () => { sc.dispose(); assert.equal(scene.children.length, 0, scene.children.map((o) => o.name).join(",")); assert.equal(world.boom, undefined); });

console.log(`\n${pass} đạt, ${fail} trượt`);
if (fail) process.exit(1);
