// tests/env.test.mjs — vật môi trường nướng (design/tools/glb-bake.mjs env → assets/models/env/*.hkm, bake/env.mjs):
// (1) mọi tệp đọc được, đủ mức chi tiết, màu theo mặt; kích thước thật và gốc đúng catalog ENV (design/tools/bake/catalog.mjs).
// (2) glb.js envPart: lưới không chỉ số gộp được với models.js merge, tint, cut tách đúng.
// (3) đất Hàm Tử (world.js buildWorld, cả đồn có tường) dựng khi đã nạp mô hình và khi chưa nạp (Node, lỗi mạng) ra cùng vật va chạm,
//     Cứ Điểm, cổng — mô phỏng không phụ thuộc mô hình; khi đã nạp thì thuyền, cây, cổng thật sự dùng mô hình.
// (4) danh sách nạp trước world.js WORLD_ENV khớp các mã mà world.js, scenery.js, director-b16.js gọi (envPart, envLOD).
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
const W = await import("../js/battle/world.js");

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
const without = (() => {
  const saved = envIds.map((id) => [id, model("env/" + id)]);
  for (const [id] of saved) putModel("env/" + id, undefined);
  const out = [false, true].map((forts) => W.buildWorld(new THREE.Scene(), { shadows: false, forts }));
  for (const [id, m] of saved) putModel("env/" + id, m);
  return out;
})();
const scenes = [false, true].map(() => new THREE.Scene()), withM = [false, true].map((forts, i) => W.buildWorld(scenes[i], { shadows: false, forts }));
t("cùng vật va chạm, Cứ Điểm, cổng, đồn, chỗ khói (cả bản đồn có tường và bản vòng cọc)", () => {
  for (const i of [0, 1]) assert.equal(snap(withM[i]), snap(without[i]), i ? "forts" : "vòng cọc");
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
  let house = null; scenes[1].traverse((o) => { if (o.isLOD && tris(o.levels[0].object) === index["env/ENV_cong_ham_tu"].tris && Math.hypot(o.position.x - gate.x, o.position.z - gate.z) < 0.01) house = o; });
  assert.ok(house, "nhà cổng mô hình (LOD) ở chỗ cổng");
});

console.log("Danh sách nạp trước");
t("WORLD_ENV = các mã ENV_ trong lời gọi envPart / envLOD của world.js, scenery.js, director-b16.js; mã nào cũng có trong index", () => {
  const used = new Set();
  for (const f of ["world.js", "scenery.js", "director-b16.js"]) {
    const src = readFileSync(join(here, "../js/battle", f), "utf8");
    for (const m of src.matchAll(/env(?:Part|LOD|Mesh)\(([^)]*)\)/g)) for (const id of m[1].matchAll(/"(ENV_[a-z_]+)"/g)) used.add(id[1]);
  }
  assert.deepEqual([...used].sort(), [...W.WORLD_ENV].sort());
  for (const id of W.WORLD_ENV) assert.ok(index["env/" + id], id);
});

console.log(`\n${pass} đạt, ${fail} trượt`);
process.exit(fail ? 1 : 0);
