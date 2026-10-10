// tests/env.test.mjs — vật môi trường nướng (design/tools/glb-bake.mjs env → assets/models/env/*.hkm, bake/env.mjs):
// (1) mọi tệp đọc được, đủ mức chi tiết, màu theo mặt; kích thước thật và gốc đúng catalog ENV (design/tools/bake/catalog.mjs).
// (2) glb.js envPart: lưới không chỉ số gộp được với models.js merge, tint, cut tách đúng.
// (3) đất Hàm Tử (world.js buildWorld, cả đồn có tường) dựng khi đã nạp mô hình và khi chưa nạp (Node, lỗi mạng) ra cùng vật va chạm,
//     Cứ Điểm, cổng — mô phỏng không phụ thuộc mô hình; khi đã nạp thì thuyền, cây, cổng thật sự dùng mô hình.
// (4) danh sách nạp trước world.js WORLD_ENV, ARENA_ENV, scenery-b20.js B20_ENV khớp các mã mà world.js, scenery.js, director-b16.js,
//     scenery-b20.js, world-b20.js gọi (envPart, envLOD) và boats.js ENV_HULL.
// (5) B20 (world-b20.js buildWorldB20, scenery-b20.js) và Võ trường (world.js buildArena) dựng khi đã nạp / chưa nạp ra cùng vật va chạm, cùng
//     xếp chỗ (rng thế giới rút y hệt), cùng số lưới (không thêm lượt vẽ); khi đã nạp thì tháp canh, bè, cây, khán đài… thật sự dùng mẫu.
// (6) thuyền B20 (boats.js): mẫu K1–K5 thay LOD0 trong TRI_BUDGET, LOD1 / hình thay thế vẫn code; mặt boong mẫu đã nắn nằm đúng độ cao các mặt
//     đi được của HULLS (bắn tia xuống), cầu thang kỳ hạm khớp mặt dốc.
// (7) đợt đặt nốt mẫu chưa dùng (miếu, chòi, chuối, quang gánh… ở làng; cây gạo, ngựa, cọc trói; lũy, ụ, hố chông, xác ngựa, mũ nón rơi; tường đất,
//     rào đồn; nhà bạt, chòi, trống đồng, cột đá vôi, núi xa B20; vạc lửa Võ trường): mọi InstancedMesh (cây, đá, cỏ, giáo, tên, khiên, cột đá vôi…)
//     có cùng số bản, cùng ma trận khi có / không có mô hình — các chuỗi rng của cảnh rút y hệt; đồ thêm (world.envProps) nằm trên đất, không đè
//     đường làn, vòng chiếm, đồn, cổng, điểm Kế Sách, đường sứ giả B17, không xuống nước.
//   node game/tests/env.test.mjs
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync, existsSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const threeUrl = pathToFileURL(join(here, "../vendor/three/three.module.js")).href;
registerHooks({ resolve: (s, c, next) => (s === "three" ? { url: threeUrl, shortCircuit: true } : next(s, c)) });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => new Proxy({}, { get: (o, k) => (k in o ? o[k] : () => ({ width: 0 })), set: (o, k, v) => ((o[k] = v), true) }) }) };

const THREE = await import(threeUrl);
const { parseHKM, putModel, envPart, envBounds, model } = await import("../js/battle/glb.js");
const { merge } = await import("../js/battle/models.js");
const { ENV } = await import("../../design/tools/bake/catalog.mjs");
const W = await import("../js/battle/world.js"), SC = await import("../js/battle/scenery.js");
const { FRONTS, KE_SACH } = await import("../js/data/battle-b15.js"), { ENVOY } = await import("../js/data/battle-b17.js");
const B20 = await import("../js/battle/scenery-b20.js"), WB = await import("../js/battle/world-b20.js"), BT = await import("../js/battle/boats.js");

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log("  ok  " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + (e.stack || e.message).split("\n").slice(0, 4).join("\n       ")); }
}

const MODELS = join(here, "../assets/models"), index = JSON.parse(readFileSync(join(MODELS, "index.json"), "utf8"));
const envIds = Object.keys(index).filter((k) => k.startsWith("env/")).map((k) => k.slice(4));
const load = (id) => { const b = readFileSync(join(MODELS, index["env/" + id].file)); return parseHKM(b.buffer.slice(b.byteOffset, b.byteOffset + b.length)); };
const parsed = Object.fromEntries(envIds.map((id) => [id, load(id)]));

console.log("Tệp nướng");
t(`index có đủ ${Object.keys(ENV).length} mục catalog ENV, không thừa`, () => {
  assert.deepEqual([...envIds].sort(), Object.keys(ENV).sort());
});
t("mỗi tệp: đủ mức chi tiết như index, tam giác ≤ catalog (tris, far), fcol một bộ ba mỗi tam giác, texture có khi catalog tex", () => {
  for (const id of envIds) {
    const m = parsed[id], e = index["env/" + id], c = ENV[id];
    assert.equal(m.meta.kind, "env", id);
    assert.equal(Object.keys(m.geos).length, e.lods.length, id);
    e.lods.forEach((n, k) => {
      const g = m.geos["lod" + k];
      assert.equal(g.index.count / 3, n, `${id} lod${k}`);
      assert.equal(g.userData.face.fcol.length, g.index.count, `${id} lod${k} fcol`);
      assert.ok(n <= [c.tris, c.far][k] * 1.02, `${id} lod${k} ${n} > ${[c.tris, c.far][k]}`);
    });
    assert.equal(!!e.tex, !!c.tex, id);
    if (e.tex) { assert.ok(existsSync(join(MODELS, e.tex)), e.tex); assert.ok(m.geos.lod0.attributes.uv, id + " uv"); }
  }
});
// bake/env.mjs phóng theo lưới gốc đủ chi tiết; giảm lưới làm hộp bao LOD0 (meta lo, hi) hụt chút ở đầu mảnh (lá đước: 11%), không bao giờ to ra
t("kích thước thật theo catalog (h / x / z / d: LOD0 trong 85–102%; spread cộng phần nới), gốc giữa đáy (thuyền: đáy ở −wl)", () => {
  for (const id of envIds) {
    const c = ENV[id], { lo, hi } = parsed[id].meta, size = hi.map((h, k) => h - lo[k]);
    const key = ["h", "x", "z", "d"].find((k) => c[k] != null);
    const got = { h: size[1], x: size[0] - (c.spread ? 2 * (c.spread[1] - c.spread[0]) : 0), z: size[2], d: Math.max(size[0], size[2]) }[key];
    assert.ok(got >= 0.85 * c[key] && got <= 1.02 * c[key] + 0.01, `${id} ${key} ${got.toFixed(3)} ≠ ${c[key]}`);
    assert.ok(Math.abs(lo[1] + (c.wl || 0)) < 0.03 * size[1] + 0.01, `${id} đáy ${lo[1]}`);
    for (const k of [0, 2]) assert.ok(Math.abs(lo[k] + hi[k]) < 0.04 * size[k] + 0.01, `${id} tâm trục ${k}: ${lo[k]} … ${hi[k]}`);
  }
});
t("thuyền dài dọc z (ry đã xoay), xe và bến cũng vậy", () => {
  for (const id of envIds.filter((i) => /thuyen_|xe_luong|ben_go|cu_ma|coc_buoc_ngua/.test(i))) {
    const { lo, hi } = parsed[id].meta;
    assert.ok(hi[2] - lo[2] > hi[0] - lo[0], `${id}: dài theo x`);
  }
});

console.log("envPart");
for (const id of envIds) putModel("env/" + id, parsed[id]);
t("lưới không chỉ số: position, normal, color cùng số đỉnh = 3 × tam giác LOD; màu tuyến tính 0–1; gộp được bằng models.js merge", () => {
  for (const id of ["ENV_cay_tan_tron", "ENV_thuyen_song_nguyen", "ENV_cong_ham_tu"]) {
    for (const lod of [0, 1]) {
      const g = envPart(id, { lod }), n = index["env/" + id].lods[Math.min(lod, index["env/" + id].lods.length - 1)];
      assert.equal(g.index, null);
      for (const k of ["position", "normal", "color"]) assert.equal(g.attributes[k].count, n * 3, `${id} ${k}`);
      const C = g.attributes.color.array; assert.ok(C.every((v) => v >= 0 && v <= 1), id);
    }
  }
  const m = merge([envPart("ENV_hom_go"), envPart("ENV_thung_go", { x: 2 })]);
  assert.equal(m.attributes.position.count, (index["env/ENV_hom_go"].tris + index["env/ENV_thung_go"].tris) * 3);
});
t("đặt (x, y, z, ry, s) như models.js part; tint nhân màu; cut tách hai phần đủ tam giác", () => {
  const a = envPart("ENV_hom_go"), b = envPart("ENV_hom_go", { x: 10, y: 1, s: 2, tint: 0x808080 });
  const box = (g) => new THREE.Box3().setFromBufferAttribute(g.attributes.position);
  const A = box(a), B = box(b);
  assert.ok(Math.abs(B.min.y - 1 - 2 * A.min.y) < 1e-4 && Math.abs((B.max.x - B.min.x) - 2 * (A.max.x - A.min.x)) < 1e-4);
  assert.ok(Math.abs((B.min.x + B.max.x) / 2 - 10 - (A.min.x + A.max.x)) < 1e-3);
  const k = new THREE.Color(0x808080).r;
  assert.ok(Math.abs(b.attributes.color.array[0] - a.attributes.color.array[0] * k) < 1e-6);
  const lo = envPart("ENV_thuyen_song_nguyen", { cut: { y1: 1.9 } }), hi = envPart("ENV_thuyen_song_nguyen", { cut: { y0: 1.9 } });
  assert.equal(lo.attributes.position.count + hi.attributes.position.count, envPart("ENV_thuyen_song_nguyen").attributes.position.count);
  assert.ok(hi.attributes.position.count > 0 && lo.attributes.position.count > hi.attributes.position.count);
});

console.log("Đất Hàm Tử có / không có mô hình");
// dựng lần một khi chưa có mô hình (gỡ khỏi đệm), lần hai khi đã nạp đủ WORLD_ENV
const snap = (w) => JSON.stringify({ col: w.colliders, bases: Object.values(w.bases).map((b) => [b.id, b.x, b.z, b.r]), gates: Object.values(w.gates).map((g) => [g.x, g.z]),
  forts: (w.forts || []).map((L) => [L.cx, L.cz, L.gates.map((g) => [g.x, g.z])]), smokes: w.smokes });
const scenesOff = [false, true].map(() => new THREE.Scene());
const without = (() => {
  const saved = envIds.map((id) => [id, model("env/" + id)]);
  for (const [id] of saved) putModel("env/" + id, undefined);
  const out = [false, true].map((forts, i) => W.buildWorld(scenesOff[i], { shadows: false, forts }));
  for (const [id, m] of saved) putModel("env/" + id, m);
  return out;
})();
// mọi InstancedMesh của cảnh: tên, số bản, ma trận từng bản (làm tròn 1e-4) — vị trí cây, đá, cỏ, lúa, giáo, tên, khiên… đều lấy từ rng của cảnh
// (world.js 1285, scenery.js 4417, dấu chiến trận 9151 / 6203, B20 1288…), nên trùng nhau nghĩa là mọi chuỗi rng rút y hệt khi có / không có mô hình
const imSnap = (scene) => { const out = []; scene.traverse((o) => { if (o.isInstancedMesh) out.push([o.name, o.count, Array.from(o.instanceMatrix.array.subarray(0, o.count * 16), (v) => Math.round(v * 1e4))]); }); return out; };
const scenes = [false, true].map(() => new THREE.Scene()), withM = [false, true].map((forts, i) => W.buildWorld(scenes[i], { shadows: false, forts }));
t("cùng vật va chạm, Cứ Điểm, cổng, đồn, chỗ khói (cả bản đồn có tường và bản vòng cọc)", () => {
  for (const i of [0, 1]) assert.equal(snap(withM[i]), snap(without[i]), i ? "forts" : "vòng cọc");
});
t("cùng rng: mọi InstancedMesh cùng số bản, cùng ma trận (cả hai bản đồn)", () => {
  for (const i of [0, 1]) {
    const a = imSnap(scenes[i]), b = imSnap(scenesOff[i]);
    assert.equal(a.length, b.length);
    a.forEach((x, k) => { assert.equal(x[1], b[k][1], `IM ${k} ${x[0]} số bản`); assert.deepEqual(x[2], b[k][2], `IM ${k} ${x[0]} ma trận`); });
  }
});
t("đã nạp: 7 thuyền sông, 260 cây, nhà cổng dùng mô hình (Node không đọc texture: màu phẳng); chưa nạp: khối code", () => {
  const tris = (m) => (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3;
  const b = withM[1].boats[0];                                                     // THREE.LOD: gần LOD0, xa LOD1
  assert.ok(b.isLOD && b.levels.length === 2);
  assert.deepEqual(b.levels.map((l) => tris(l.object)), index["env/ENV_thuyen_song_nguyen"].lods);
  assert.ok(!without[1].boats[0].isLOD && tris(without[1].boats[0]) !== index["env/ENV_thuyen_song_nguyen"].tris);
  let trees = null; scenes[1].traverse((o) => { if (o.isInstancedMesh && o.count > 200 && tris(o) === index["env/ENV_cay_tan_tron"].lods[1]) trees = o; });
  assert.ok(trees, "InstancedMesh cây dùng LOD1 ENV_cay_tan_tron");
  const gate = Object.values(withM[1].gates)[0];
  let house = null; scenes[1].traverse((o) => { if (o.isLOD && o.levels[0].object.isMesh && tris(o.levels[0].object) === index["env/ENV_cong_ham_tu"].tris && Math.hypot(o.position.x - gate.x, o.position.z - gate.z) < 0.01) house = o; });
  assert.ok(house, "nhà cổng mô hình (LOD) ở chỗ cổng");
});
// đồn có tường (world.js buildFort): cổng, tháp góc là THREE.LOD theo tâm đồn — gần: hai cổng, bốn tháp lưới riêng (tháp mẫu: LOD gần / xa riêng),
// xa: một lưới gộp đúng bằng mức xa của bốn tháp cộng hai cổng, chỉ hiện khi tháp góc nào cũng xa camera hơn ngưỡng mức xa của nó
t("đồn có tường: cổng + tháp góc xa tâm đồn thành một lưới gộp (= mức xa bốn tháp + hai cổng, cùng chỗ), ngưỡng ≥ ngưỡng mức xa của tháp + góc xa nhất; cổng, tháp làm mờ đo từ chỗ của nó", () => {
  const tris = (m) => (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3;
  const box = (o) => { o.updateWorldMatrix(true, false); return new THREE.Box3().setFromBufferAttribute(o.geometry.clone().applyMatrix4(o.matrixWorld).attributes.position); };
  for (const [w, scene] of [[withM[1], scenes[1]], [without[1], scenesOff[1]]]) {
    const lods = []; scene.traverse((o) => { if (o.isLOD && o.levels.length === 2 && o.levels[0].object.isGroup) lods.push(o); });
    assert.equal(lods.length, w.forts.length, "mỗi đồn một LOD");
    for (const lod of lods) {
      const L = w.forts.find((f) => Math.hypot(f.cx - lod.position.x, f.cz - lod.position.z) < 0.01);
      assert.ok(L, "LOD ở tâm đồn");
      const [near, far] = lod.levels.map((l) => l.object), parts = [];
      near.children.forEach((c) => parts.push(c.isLOD ? c.levels[c.levels.length - 1] : { object: c, distance: 0 }));
      assert.equal(near.children.length, 6, "hai cổng, bốn tháp");
      assert.equal(tris(far), parts.reduce((s, p) => s + tris(p.object), 0), "lưới gộp = mức xa của từng vật");
      const B = box(far), U = new THREE.Box3(); for (const p of parts) U.union(box(p.object));
      for (const k of ["min", "max"]) for (const a of ["x", "y", "z"]) assert.ok(Math.abs(B[k][a] - U[k][a]) < 1e-3, `hộp lưới gộp ${k}.${a}`);
      // world.fadeOccluders đo vật từ getWorldPosition: mỗi cổng, mỗi tháp (mẫu hay khối code) đứng đúng chỗ của nó, không ở gốc bản đồ
      const spots = [...L.gates.map((g) => [g.x, g.z]), ...L.corners], at = new Set(), p = new THREE.Vector3();
      for (const c of near.children) {
        c.getWorldPosition(p); const i = spots.findIndex(([x, z]) => Math.hypot(p.x - x, p.z - z) < 0.01);
        assert.ok(i >= 0 && w.fadeables.some((f) => f.obj === c), "cổng / tháp làm mờ đo từ chỗ của nó"); at.add(i);
      }
      assert.equal(at.size, 6, "mỗi cổng, mỗi tháp một chỗ");
      const corner = Math.max(...L.corners.map(([x, z]) => Math.hypot(x - L.cx, z - L.cz)));
      for (const p of parts) assert.ok(lod.levels[1].distance >= p.distance + corner - 1e-6, "lưới gộp hiện khi mọi tháp đã ở mức xa");
    }
  }
});

// đồ thêm (scenery.js VILLAGE_PROPS, WORLD_PROPS, ngựa ở cọc buộc ngựa): không va chạm, nên phải nằm ngoài chỗ lính, tướng, bot đi và đứng
t("đồ thêm (world.envProps): đủ vật, chân ở chỗ đất thấp nhất dưới vật, không lút quá 1,2 m, không xuống nước, không đè đường làn, vòng chiếm, đồn, cổng đồn, điểm Kế Sách, đường sứ giả B17; chưa nạp thì không đặt gì", () => {
  const w = withM[1], P = w.envProps, gy = w.groundY || W.heightAt;
  assert.equal(P.length, SC.VILLAGE_PROPS.length + SC.WORLD_PROPS.length + 4, "làng + ngoài làng + 4 ngựa Nguyên");
  assert.equal(without[1].envProps.length, 0);
  const segD = (q, a, b) => { const dx = b.x - a.x, dz = b.z - a.z, t = Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.z - a.z) * dz) / (dx * dx + dz * dz))); return Math.hypot(q.x - a.x - dx * t, q.z - a.z - dz * t); };
  for (const q of P) {
    const tag = `${q.id} (${q.x.toFixed(1)}, ${q.z.toFixed(1)})`;
    let lo = gy(q.x, q.z);
    for (let k = 0; k < 8; k++) lo = Math.min(lo, gy(q.x + Math.cos(k * 0.785) * q.r * 0.7, q.z + Math.sin(k * 0.785) * q.r * 0.7));
    assert.ok(q.y <= lo + 1e-6 && q.y >= lo - 0.1, tag + ` chân ${q.y.toFixed(2)} / đất ${lo.toFixed(2)}`);
    assert.ok(gy(q.x, q.z) - q.y < 1.2, tag + " lút sâu");
    assert.ok(W.waterDist(q.x, q.z) > q.foot, tag + " nước");
    for (const f of Object.values(FRONTS)) if (q.x > f.x0 - 5 && q.x < f.x1 + 5) assert.ok(Math.abs(q.z - f.laneZ) >= 9 + q.foot, tag + " đường làn " + f.id);
    for (const b of Object.values(w.bases)) if (b.type !== "ban_doanh") assert.ok(Math.hypot(q.x - b.x, q.z - b.z) >= b.r + q.foot, tag + " vòng " + b.id);
    for (const L of w.forts) {
      assert.ok(Math.abs(q.x - L.cx) >= L.wx + 2 + q.foot || Math.abs(q.z - L.cz) >= L.wz + 2 + q.foot, tag + " đồn " + L.id);
      for (const g of L.gates) assert.ok(Math.hypot(q.x - g.x, q.z - g.z) >= L.gate / 2 + 4 + q.foot, tag + " cổng " + g.id);
    }
    for (const k of [...KE_SACH.muiTenThu.bundles, KE_SACH.coAoTong.landing, ...KE_SACH.coAoTong.guards]) assert.ok(Math.hypot(q.x - k.x, q.z - k.z) >= 3 + q.foot, tag + " Kế Sách");
    for (let i = 0; i + 1 < ENVOY.route.length; i++) assert.ok(segD(q, ENVOY.route[i], ENVOY.route[i + 1]) >= 2 + q.foot, tag + " đường sứ giả B17");
  }
});

console.log("Đất B20, Võ trường có / không có mô hình");
// dựng cảnh khi chưa nạp mô hình (gỡ khỏi đệm) rồi khi đã nạp, cùng một hàm
const twice = (build) => {
  const saved = envIds.map((id) => [id, model("env/" + id)]);
  for (const [id] of saved) putModel("env/" + id, undefined);
  BT.disposeHullGeometries();
  const off = build();
  for (const [id, m] of saved) putModel("env/" + id, m);
  BT.disposeHullGeometries();
  return [off, build()];
};
const meshes = (scene) => { const out = []; scene.traverse((o) => { if (o.isMesh && !(o.parent && o.parent.isLOD && o.parent.levels[0].object !== o)) out.push(o); }); return out; };
const triOf = (m) => (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3;
const b20 = twice(() => { const scene = new THREE.Scene(), w = WB.buildWorldB20(scene, { shadows: false }); return { scene, w }; });
t("B20: cùng vật va chạm, xếp chỗ cảnh, bè, phao chặn luồng, boong bến, Cứ Điểm; cùng số lưới, cùng tên lưới", () => {
  const snap = ({ w }) => JSON.stringify({ col: w.colliders, rafts: w.scenery.rafts.list.map((r) => [r.id, r.x0, r.z0, r.anchors]), boom: w.boom.layout,
    stakes: w.scenery.stakes.layout, piers: w.pierDecks.map((d) => d.rects), bases: Object.values(w.bases).map((b) => [b.id, b.x, b.z, b.r]) });
  assert.equal(snap(b20[1]), snap(b20[0]));
  assert.deepEqual(meshes(b20[1].scene).map((m) => m.name || m.type), meshes(b20[0].scene).map((m) => m.name || m.type));
});
// Ngân sách: b20-statics tăng ≤ 1.500 cho tháp canh, đầu bến, tời neo (bù bằng cây mức xa), cộng ≤ 6.500 cho bốn chòi tranh (4 × 1.192) và trống đồng
// bản doanh (1.200) — mẫu làm riêng cho các chỗ đó; nhà bạt chỉ huy là lưới riêng (hq-pavilion, 3.000); cả cảnh lúc dựng (info, triều cao) ≤ 120 nghìn.
t("B20 đã nạp: tháp canh, đầu bến, tời neo, chòi, trống đồng vào b20-statics, nhà bạt mẫu ENV_nha_bat_chi_huy (lưới riêng), bè mẫu ENV_be_co mức xa, cây ENV_lum_cay_ven_song mức xa, cột đá vôi ENV_nui_da_a/b/c mức xa, núi xa ENV_day_nui_xa; tổng cảnh ≤ 120 nghìn tam giác, b20-statics tăng ≤ 8.000", () => {
  const by = (k, n) => meshes(b20[k].scene).find((m) => m.name === n);
  assert.equal(triOf(by(1, "rafts")), index["env/ENV_be_co"].lods[1]);
  assert.equal(triOf(by(1, "trees")), index["env/ENV_lum_cay_ven_song"].lods[1]);
  for (const k of ["A", "B", "C"]) assert.equal(triOf(by(1, "karst-" + k)), index["env/ENV_nui_da_" + k.toLowerCase()].lods[1], "karst-" + k);
  assert.equal(triOf(by(1, "far-ridges")) - triOf(by(0, "far-ridges")), 2 * index["env/ENV_day_nui_xa"].tris, "hai cụm núi xa");
  assert.equal(triOf(by(1, "hq-pavilion")), index["env/ENV_nha_bat_chi_huy"].tris);
  const st = [triOf(by(0, "b20-statics")), triOf(by(1, "b20-statics"))];
  assert.ok(st[1] > st[0] && st[1] - st[0] <= 8000, `b20-statics ${st[0]} → ${st[1]}`);
  const info = b20[1].w.scenery.info();
  assert.ok(info.tris <= 120000, `cảnh B20 ${info.tris}`);
});
t("B20: mọi InstancedMesh (cột đá vôi, cây, sú vẹt, lau, đá, cọc, bè…) cùng số bản, cùng ma trận khi có / không có mô hình", () => {
  const a = imSnap(b20[1].scene), b = imSnap(b20[0].scene);
  assert.equal(a.length, b.length);
  a.forEach((x, k) => { assert.equal(x[1], b[k][1], `${x[0]} số bản`); assert.deepEqual(x[2], b[k][2], `${x[0]} ma trận`); });
});
const arena = twice(() => { const scene = new THREE.Scene(), w = W.buildArena(scene, { shadows: false }); return { scene, w }; });
t("Võ trường: cùng vật va chạm, chỗ khán giả, cổng; cùng số lưới; đã nạp: 10 gian khán đài là THREE.LOD mẫu ENV_khan_dai (gần có texture)", () => {
  const snap = ({ w }) => JSON.stringify({ col: w.colliders, spots: w.spectatorSpots, gates: w.gatePoints });
  assert.equal(snap(arena[1]), snap(arena[0]));
  assert.equal(meshes(arena[1].scene).length, meshes(arena[0].scene).length);
  const lods = []; arena[1].scene.traverse((o) => { if (o.isLOD) lods.push(o); });
  assert.equal(lods.length, 10);
  for (const l of lods) assert.equal(triOf(l.levels[0].object), index["env/ENV_khan_dai"].lods[0]);
  assert.deepEqual(imSnap(arena[1].scene), imSnap(arena[0].scene), "InstancedMesh (cây, cỏ)");
});

console.log("Thuyền B20 (mẫu K1–K5)");
BT.disposeHullGeometries();
t("LOD0 mẫu trong TRI_BUDGET, khác hình code; LOD1 và hình thay thế vẫn là hình code", () => {
  for (const type of Object.keys(BT.HULLS)) {
    const g = BT.hullGeometry(type, 0), code = BT.hullGeometry(type, 0, false), n = g.attributes.position.count / 3;
    assert.ok(n <= (type === "flagship" ? BT.TRI_BUDGET.flagship0 : BT.TRI_BUDGET.lod0), `${type} ${n}`);
    assert.notEqual(g, code); assert.ok(n > code.attributes.position.count / 3, type);
    assert.ok(n >= index["env/" + BT.ENV_HULL[BT.HULLS[type].base || type].id].tris * 0.97, type + ": mẫu bị cắt quá nhiều");
    for (const lod of [1, 2]) assert.equal(BT.hullGeometry(type, lod), BT.hullGeometry(type, lod, false), `${type} LOD${lod}`);
  }
});
// tia thẳng đứng từ trên mặt đi được 0,6 m xuống: chạm mẫu ở đúng độ cao mặt (±0,3 m) — lưới điểm 0,5 m trong mặt, tránh tường cao hơn mặt
// 0,4 m. Đồ trên boong (nắp hầm, thanh ngang, ghế dọc mạn) và mép mũi hẹp hơn mặt code làm trượt vài điểm: cả thân ≥ 85%, mỗi mặt ≥ 60%.
t("mặt boong mẫu đã nắn trùng độ cao các mặt đi được của HULLS (kể cả cầu thang và mặt lầu kỳ hạm)", () => {
  const ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0), rows = [];
  for (const type of Object.keys(BT.HULLS)) {
    const H = BT.HULLS[type], mesh = new THREE.Mesh(BT.hullGeometry(type, 0), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    let all = 0, allOk = 0;
    for (const r of H.deck.rects) {
      let ok = 0, n = 0;
      for (let x = r.x0 + 0.25; x < r.x1; x += 0.5) for (let z = r.z0 + 0.25; z < r.z1; z += 0.5) {
        if (H.deck.walls.some((w) => w.h > r.y + 0.3 && x > w.x0 - 0.4 && x < w.x1 + 0.4 && z > w.z0 - 0.4 && z < w.z1 + 0.4)) continue;
        const y = r.y + (r.sx || 0) * (x - r.x0) + (r.sz || 0) * (z - r.z0);
        ray.set(new THREE.Vector3(x, y + 0.6, z), down); ray.far = 1.2;
        const hit = ray.intersectObject(mesh)[0]; n++;
        if (hit && Math.abs(hit.point.y - y) <= 0.3) ok++;
      }
      assert.ok(n === 0 || ok / n >= 0.6, `${type} mặt y ${r.y} z ${r.z0}…${r.z1}: ${ok}/${n} điểm khớp`);
      all += n; allOk += ok;
    }
    rows.push(`${type} ${Math.round(100 * allOk / all)}%`);
    assert.ok(allOk / all >= 0.85, `${type}: ${allOk}/${all} điểm khớp`);
  }
  console.log("       " + rows.join(" · "));
});

console.log("Danh sách nạp trước");
// mã trong lời gọi envPart / envLOD / envMesh, model("env/<mã>"), và trường id: "<mã>" của danh sách đồ thêm (scenery.js VILLAGE_PROPS, WORLD_PROPS)
const ID = "(?:ENV|MOUNT|PROP)_[A-Za-z_]+";
const callIds = (src) => {
  const used = new Set();
  for (const m of src.matchAll(/env(?:Part|LOD|Mesh)\(([^)]*)\)/g)) for (const id of m[1].matchAll(new RegExp(`"(${ID})"`, "g"))) used.add(id[1]);
  for (const m of src.matchAll(new RegExp(`model\\("env/(${ID})"\\)|\\bid: "(${ID})"`, "g"))) used.add(m[1] || m[2]);
  return used;
};
const srcOf = (f) => readFileSync(join(here, "../js/battle", f), "utf8");
t("WORLD_ENV = các mã mô hình môi trường của world.js, scenery.js (trừ phần Võ trường), director-b16.js, kesach.js; ARENA_ENV = phần Võ trường (buildArena, addArenaScenery); mã nào cũng có trong index", () => {
  const split = (f, fn) => { const s = srcOf(f), i = s.indexOf("export function " + fn + "("); assert.ok(i > 0, fn); return [s.slice(0, i), s.slice(i)]; };
  const [w0, w1] = split("world.js", "buildArena"), [s0, s1] = split("scenery.js", "addArenaScenery");
  const decl = (s) => s.replace(/export const (?:WORLD|ARENA)_ENV = \[[^\]]*\];/g, "");      // bỏ chính hai danh sách khỏi phần quét
  assert.deepEqual([...new Set([...callIds(decl(w0)), ...callIds(s0), ...callIds(srcOf("director-b16.js")), ...callIds(srcOf("kesach.js"))])].sort(), [...W.WORLD_ENV].sort());
  assert.deepEqual([...new Set([...callIds(decl(w1)), ...callIds(s1)])].sort(), [...W.ARENA_ENV].sort());
  for (const id of [...W.WORLD_ENV, ...W.ARENA_ENV]) assert.ok(index["env/" + id], id);
});
t("B20_ENV = các mã trong lời gọi envPart / envLOD của scenery-b20.js, world-b20.js cộng mẫu thuyền boats.js ENV_HULL; mã nào cũng có trong index", () => {
  const used = new Set([...callIds(srcOf("scenery-b20.js")), ...callIds(srcOf("world-b20.js")), ...Object.values(BT.ENV_HULL).map((e) => e.id)]);
  assert.deepEqual([...used].sort(), [...B20.B20_ENV].sort());
  for (const id of B20.B20_ENV) assert.ok(index["env/" + id], id);
});

console.log(`\n${pass} đạt, ${fail} trượt`);
process.exit(fail ? 1 : 0);
