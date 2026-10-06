// tests/crowd-render.test.mjs — bớt việc CPU mỗi khung của đám lính (đợt 19c, battle/crowd.js): Crowd thật trong Node (không WebGL), camera thật.
// (1) Lính ngoài khung nhìn: không chiếm chỗ vẽ (chỉ số nền các mức liền nhau, hàng texture khớp chỉ phủ lính được vẽ), không tính tư thế / IK;
//     quay lại khung nhìn thì tư thế, lò xo vạt, trọng số IK đặt lại (không giật từ trạng thái cũ).
// (2) IK chân, lò xo vạt, dây tua chỉ cho lính LOD0 — cả kiểu lính thủ tục (không có GLB) cũng có mức theo khoảng cách camera.
// (3) Mức chi tiết có trễ ±2 m: lính đứng quanh ngưỡng không lật mức mỗi khung.
// (4) Không tải buffer thừa: bóng tròn, mũi tên, màu instance rỗng thì không đánh dấu tải; có thì chỉ tải phần đang dùng.
// (5) Lính là đối tượng một kiểu cố định (V8 không chuyển sang dạng từ điển): khai báo mọi trường một chỗ, không thêm trường về sau, dùng lại từ bể
//     vẫn cùng thứ tự trường. Tư thế rig (anim.js zeroPose / blendPose / idle) cũng vậy, số y như cách cũ.
//   node game/tests/crowd-render.test.mjs
import assert from "node:assert/strict";
import v8 from "node:v8";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

v8.setFlagsFromString("--allow-natives-syntax");
const fastProps = new Function("o", "return %HasFastProperties(o)");
const here = dirname(fileURLToPath(import.meta.url));
const threeUrl = pathToFileURL(join(here, "../vendor/three/three.module.js")).href;
registerHooks({ resolve: (s, c, next) => (s === "three" ? { url: threeUrl, shortCircuit: true } : next(s, c)) });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => new Proxy({}, { get: (o, k) => (k in o ? o[k] : () => ({ width: 0 })), set: (o, k, v) => ((o[k] = v), true) }) }) };

const THREE = await import(threeUrl);
const crowdMod = await import("../js/battle/crowd.js");
const { Crowd } = crowdMod;
const { glbKit, BONE_FLOATS, BONE_TEX_W, NJ } = await import("../js/battle/soldiers.js");
const { DIFFICULTY } = await import("../js/data/tuning.js");
const { makeRng } = await import("../js/core/rng.js");
const A = await import("../js/battle/anim.js");

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log("  ok  " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + (e.stack || e.message).split("\n").slice(0, 4).join("\n       ")); }
}

// Camera ở (100, 8, 100) nhìn theo +x; tướng đứng trước camera 10 m (như cần camera 10,5 m của battle.js).
const CX = 100, CZ = 100;
function world({ glb = false } = {}) {
  const hero = { x: CX + 10, z: CZ, y: 0, alive: true, hp: 1e6, maxHp: 1e6, state: "free", yaw: Math.PI / 2, giap: 50, move: "N1", st: 0, dur: 1, swingId: 0, receiveHit() {} };
  const camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.3, 1400);
  camera.position.set(CX, 8, CZ); camera.lookAt(CX + 30, 0, CZ);
  const ctx = { R: 1, rng: makeRng(11), diff: DIFFICULTY[1], hero, units: [], clock: 0, openGates: {}, world: { colliders: [], gates: {}, bases: {} }, fx: null, audio: null, camera };
  const crowd = ctx.crowd = new Crowd(new THREE.Scene(), ctx);
  if (glb) crowd.meshes.NG_DAO = glbKit("NG_DAO", fakeGlb(), 900);       // Node không nạp .hkm: lưới GLB giả, đủ 3 mức
  return { ctx, hero, crowd, camera };
}
function fakeGlb() {
  const g = (vc) => { const b = new THREE.BoxGeometry(0.3, 1.7, 0.3), n = b.attributes.position.count; b.setAttribute("aSkin", new THREE.BufferAttribute(new Float32Array(n * 4), 4)); if (vc) b.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3)); return b; };
  return { meta: { skel: "human", piv: Array.from({ length: NJ }, () => [0, 0, 0]) }, geos: { lod0: g(false), lod1: g(true), lod2: g(true) }, tex: null };
}
const spawnAt = (crowd, x, z, o = {}) => crowd.spawn({ side: "dich", unit: "KHIEN_NG", kit: "NG_DAO", role: "zone", x, z, yaw: -Math.PI / 2, ...o });
// một khung: đồng hồ trận +1/60 rồi vẽ (Crowd.render đọc ctx.clock khi không có ctx.view)
const frame = (ctx, n = 1) => { for (let i = 0; i < n; i++) { ctx.clock += 1 / 60; ctx.crowd.render(); } };
const drawn = (M) => (M.glb ? M.meshes.reduce((s, m) => s + m.count, 0) : M.mesh.count);
const block = (M, i) => Array.from(M.data.subarray(i * BONE_FLOATS, (i + 1) * BONE_FLOATS));

console.log("(1) lính ngoài khung nhìn");
t("lính sau lưng camera không chiếm chỗ vẽ, không có bóng tròn, không tính tư thế", () => {
  const { ctx, crowd } = world();
  const front = [], back = [];
  for (let i = 0; i < 6; i++) { front.push(spawnAt(crowd, CX + 12 + i, CZ + (i - 3))); back.push(spawnAt(crowd, CX - 15 - i, CZ + (i - 3))); }
  frame(ctx);
  assert.equal(drawn(crowd.meshes.NG_DAO), 6, "chỉ 6 lính trước mặt được vẽ");
  assert.equal(crowd.blob.count, 6, "bóng tròn chỉ cho lính được vẽ");
  for (const a of back) assert.equal(a.poseInit, false, "lính khuất chưa tính tư thế");
  for (const a of front) assert.equal(a.poseInit, true);
  // khối khớp của lính được vẽ nằm liền nhau từ chỉ số 0, đúng thứ tự, đúng ma trận của từng người
  front.forEach((a, i) => assert.deepEqual(block(crowd.meshes.NG_DAO, i), Array.from(a.mc), `lính ${i}`));
});
t("GLB: chỉ số nền mỗi mức liền nhau, hàng texture khớp tải đúng số lính được vẽ", () => {
  const { ctx, crowd } = world({ glb: true });
  const want = [];
  for (const d of [8, 10, 12]) want.push(spawnAt(crowd, CX + d, CZ));            // LOD0 (< 18 m)
  for (let i = 0; i < 6; i++) spawnAt(crowd, CX - 20 - i, CZ);                    // khuất: xen giữa trong danh sách
  for (const d of [25, 30]) want.push(spawnAt(crowd, CX + d, CZ + 2));            // LOD1
  for (const d of [60, 70, 80, 90]) want.push(spawnAt(crowd, CX + d, CZ - 3));    // LOD2
  for (let i = 0; i < 4; i++) spawnAt(crowd, CX + 20, CZ + 200 + i * 5);          // ngoài góc nhìn ngang
  frame(ctx);
  const M = crowd.meshes.NG_DAO;
  assert.deepEqual(M.meshes.map((m) => m.count), [3, 2, 4], "số lính mỗi mức");
  assert.deepEqual(M.bases.map((b) => b.value), [0, 3, 5], "chỉ số nền liền nhau");
  assert.equal(M.tex.updateRanges.length, Math.ceil((9 * BONE_FLOATS) / 4 / BONE_TEX_W), "số hàng texture tải");
  // lính mức l thứ j nằm ở chỉ số bases[l] + j trong texture khớp
  const seen = new Set();
  for (const a of want) {
    const i = M.bases[a.lod].value + want.filter((b) => b.lod === a.lod).indexOf(a);
    assert.deepEqual(block(M, i), Array.from(a.mc)); seen.add(i);
  }
  assert.equal(seen.size, 9);
});
t("quay lại khung nhìn: tư thế tính lại từ đầu, lò xo vạt / trọng số IK đặt lại", () => {
  const { ctx, crowd, camera } = world();
  const a = spawnAt(crowd, CX + 12, CZ);
  frame(ctx, 5);
  assert.equal(a.poseInit, true);
  camera.lookAt(CX - 30, 0, CZ);                                                   // quay lưng lại
  frame(ctx, 3);
  assert.equal(a.inView, false, "đánh dấu khuất");
  const mc0 = Array.from(a.mc);
  a.x += 3; frame(ctx, 2);
  assert.deepEqual(Array.from(a.mc), mc0, "khuất: không tính lại ma trận khớp");
  camera.lookAt(CX + 30, 0, CZ);
  a.sm.mo[7] = 0.37;                                                               // trọng số IK cũ dở dang
  frame(ctx);
  assert.equal(a.inView, true);
  assert.equal(a.sm.mo[7], 1, "trọng số IK lấy ngay đích (đặt lại), không trộn tiếp từ 0,37");
  assert.notDeepEqual(Array.from(a.mc), mc0, "tư thế mới ở chỗ mới");
});

console.log("(2) IK chỉ cho LOD0");
t("kiểu lính thủ tục: lính 10 m có IK; lính 25 m (vẫn trong 40 m quanh tướng) không IK, không lò xo, dây tua treo thẳng", () => {
  const { ctx, crowd } = world();
  assert.ok(!crowd.meshes.NG_GIAO.glb, "tiền đề: Node dùng lưới thủ tục");
  const n = spawnAt(crowd, CX + 10, CZ, { kit: "NG_GIAO" }), f = spawnAt(crowd, CX + 25, CZ, { kit: "NG_GIAO" });
  frame(ctx, 10);
  assert.equal(n.lv, 0); assert.equal(f.lv, 1);
  assert.ok(n.sm.mo[7] > 0.99, "LOD0: IK bật");
  assert.equal(f.sm.mo[7], 0, "LOD1: IK tắt");
  assert.equal(n.sm.mo[8], 1, "LOD0: dây tua đang mô phỏng");
  assert.equal(f.sm.mo[8], 0, "LOD1: dây tua không mô phỏng");
});
t("LOD1 về LOD0: IK trộn dần lên (không giật)", () => {
  const { ctx, crowd } = world();
  const a = spawnAt(crowd, CX + 25, CZ);
  frame(ctx, 5); assert.equal(a.sm.mo[7], 0);
  a.x = CX + 12; frame(ctx);
  assert.equal(a.lv, 0);
  assert.ok(a.sm.mo[7] > 0 && a.sm.mo[7] < 0.5, `IK trộn dần, khung đầu ${a.sm.mo[7]}`);
});

console.log("(3) mức chi tiết có trễ");
t("lodLevel: ngưỡng 18 / 40 m, đổi mức khi qua ngưỡng thêm 2 m", () => {
  const L = crowdMod.lodLevel;
  assert.equal(typeof L, "function");
  assert.equal(L(-1, 17.9 ** 2), 0); assert.equal(L(-1, 18.1 ** 2), 1); assert.equal(L(-1, 41 ** 2), 2);
  assert.equal(L(0, 19.9 ** 2), 0); assert.equal(L(0, 20.1 ** 2), 1); assert.equal(L(1, 16.1 ** 2), 1); assert.equal(L(1, 15.9 ** 2), 0);
  assert.equal(L(1, 41.9 ** 2), 1); assert.equal(L(1, 42.1 ** 2), 2); assert.equal(L(2, 38.1 ** 2), 2); assert.equal(L(2, 37.9 ** 2), 1);
  assert.equal(L(0, 60 ** 2), 2, "nhảy hai mức một lần"); assert.equal(L(2, 5 ** 2), 0);
});
t("lính đứng quanh ngưỡng 18 m (±0,6 m mỗi khung) không lật mức — cả GLB lẫn thủ tục", () => {
  for (const glb of [false, true]) {
    const { ctx, crowd } = world({ glb });
    const a = spawnAt(crowd, CX + 17.4, CZ);
    frame(ctx);
    let flips = 0, last = a.lv;
    assert.equal(last, 0, "tiền đề: bắt đầu ở LOD0");
    for (let i = 0; i < 120; i++) { a.x = CX + (i % 2 ? 18.6 : 17.4); frame(ctx); if (a.lv !== last) { flips++; last = a.lv; } }
    assert.equal(flips, 0, `${glb ? "GLB" : "thủ tục"}: lật ${flips} lần`);
    if (glb) assert.equal(a.lod, 0);
  }
});

console.log("(4) không tải buffer thừa");
t("không lính, không tên: bóng tròn, mũi tên, màu instance không đánh dấu tải", () => {
  const { ctx, crowd } = world({ glb: true });
  frame(ctx);
  const v = () => [crowd.blob.instanceMatrix.version, crowd.arrowMesh.instanceMatrix.version, ...crowd.meshes.NG_DAO.colors.map((c) => c.version), crowd.meshes.NG_GIAO.color.version];
  const v0 = v(); frame(ctx, 3);
  assert.deepEqual(v(), v0);
});
t("có lính: chỉ tải phần đang dùng (bóng 16 số mỗi lính, màu 3 số), mức rỗng không tải", () => {
  const { ctx, crowd } = world({ glb: true });
  for (const d of [8, 10]) spawnAt(crowd, CX + d, CZ);
  frame(ctx);
  assert.deepEqual(crowd.blob.instanceMatrix.updateRanges.map((x) => [x.start, x.count]), [[0, 32]]);
  const C = crowd.meshes.NG_DAO.colors;
  assert.deepEqual(C[0].updateRanges.map((x) => [x.start, x.count]), [[0, 6]]);
  const v1 = C[1].version; frame(ctx); assert.equal(C[1].version, v1, "LOD1 rỗng: không tải");
});

console.log("(5) đối tượng một kiểu cố định");
t("lính: không thêm trường sau khi sinh ra, dùng lại từ bể vẫn cùng thứ tự trường, V8 giữ dạng nhanh", () => {
  const { ctx, crowd, hero } = world();
  hero.x = CX + 30; hero.alive = false;                                              // hai phe đánh nhau, tướng đứng ngoài
  let keys0 = null, reused = 0; const all = new Set();
  const mk = (side, x, z, kit) => {
    if (crowd.free.length) reused++;
    const a = crowd.spawn({ side, unit: side === "ta" ? "GIAO_DV" : "KHIEN_NG", kit, role: "zone", x, z });
    keys0 ??= Object.keys(a).join(); assert.equal(Object.keys(a).join(), keys0, "trường lúc sinh ra"); all.add(a); return a;
  };
  for (let i = 0; i < 6; i++) { mk("dich", CX + 14 + (i % 3), CZ + i - 3, i % 2 ? "NG_CUNG" : "NG_DAO"); mk("ta", CX + 10 + (i % 3), CZ + i - 3, i % 2 ? "DV_NO" : "DV_GIAO"); }
  for (let k = 0; k < 2400; k++) {                                                   // 40 s: lính ngã ~12 s, xác về bể sau 2,8 s
    ctx.clock += 1 / 60; crowd.update(1 / 60); crowd.render();
    if (k % 150 === 149) { mk("dich", CX + 16, CZ, "NG_TANK"); mk("ta", CX + 9, CZ, "DV_DAO"); }
  }
  assert.ok(reused > 0, "tiền đề: có lính ngã, về bể, được dùng lại");
  for (const a of all) assert.equal(Object.keys(a).join(), keys0, "không có trường thêm về sau");
  for (const a of all) assert.ok(fastProps(a), "dạng nhanh (không phải từ điển)");
});
t("anim.js: zeroPose / blendPose / idle dạng nhanh, số y như cách cũ (cả kênh grip)", () => {
  const K = Object.keys(A.zeroPose());
  const TAU = Math.PI * 2, wrapPi = (x) => x - TAU * Math.round(x / TAU);
  const oldBlend = (a, b, t) => {                                                  // bản cũ (trước đợt 19c), chép nguyên
    const p = {};
    for (const k of K) p[k] = (a[k] || 0) + ((b[k] || 0) - (a[k] || 0)) * t;
    const bs = b.spin || 0, br = b.rootX || 0;
    p.spin = bs - wrapPi(bs - (a.spin || 0)) * (1 - t);
    p.rootX = br - wrapPi(br - (a.rootX || 0)) * (1 - t);
    if (a.grip !== undefined || b.grip !== undefined) p.grip = (a.grip || 0) + ((b.grip || 0) - (a.grip || 0)) * t;
    return p;
  };
  let s = 3; const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296 - 0.5) * 9;
  for (let n = 0; n < 400; n++) {
    const a = A.zeroPose(), b = A.zeroPose();
    for (const k of K) { a[k] = rnd(); b[k] = rnd(); }
    if (n % 3 === 0) a.grip = Math.abs(rnd()) / 9;
    if (n % 5 === 0) b.grip = Math.abs(rnd()) / 9;
    const tt = (n % 11) / 10, p = A.blendPose(a, b, tt), q = oldBlend(a, b, tt);
    assert.deepEqual(Object.keys(p), Object.keys(q), "cùng trường, cùng thứ tự");
    for (const k of Object.keys(q)) assert.ok(Object.is(p[k], q[k]), `${k}: ${p[k]} ≠ ${q[k]}`);
    assert.ok(fastProps(p), "blendPose dạng nhanh");
  }
  assert.ok(fastProps(A.zeroPose()), "zeroPose dạng nhanh");
  assert.ok(fastProps(A.idle(1.3)), "idle dạng nhanh");
});

console.log(`\n${pass} đạt, ${fail} trượt`);
process.exit(fail ? 1 : 0);
