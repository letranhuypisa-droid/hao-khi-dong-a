// tests/promotion.test.mjs — đợt 12a: lính cưỡi ngựa (Cung kỵ) mà tướng không đánh được.
// (1) battle/promotion.js (thuần): lính diễn (actor, KHÔNG trúng đòn) nào thành lính thật (zone, trúng đòn). Luật cũ: gần nhất trước, trong
//     ZONE.radius, tới trần ZONE.enemies / ZONE.allies. Luật mới: lính địch SÁT tướng (ZONE.nearR) vẫn thành lính thật khi trần đã đầy, tới
//     tối đa ZONE.forcedMax người — không để kẻ đứng cạnh tướng mà chém xuyên qua.
// (2) tuning.js: vòng trúng của kỵ binh lớn hơn bộ binh (hitRadius / hitPad), khớp thân ngựa dài ~2 m quanh điểm lính.
// (3) Director.updateZone trên Crowd thật (Node, không WebGL): cung kỵ diễn đứng cạnh tướng khi vùng chiến đấu đã đủ 30 địch phải thành lính thật.
//   node hao-khi-viet/game/tests/promotion.test.mjs
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const threeUrl = pathToFileURL(join(here, "../vendor/three/three.module.js")).href;
registerHooks({ resolve: (s, c, next) => (s === "three" ? { url: threeUrl, shortCircuit: true } : next(s, c)) });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => new Proxy({}, { get: (o, k) => (k in o ? o[k] : () => ({ width: 0 })), set: (o, k, v) => ((o[k] = v), true) }) }) };

const { pickPromotions } = await import("../js/battle/promotion.js");
const { ZONE, HIT_R, hitRadius, hitPad, KITS } = await import("../js/data/tuning.js");

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log("  ok  " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + (e.stack || e.message)); }
}

const hero = { x: 100, z: 0 };
const act = (id, side, dx, dz = 0, extra = {}) => ({ id, side, x: hero.x + dx, z: hero.z + dz, ...extra });
const ids = (list) => list.map((a) => a.id);
const CAPS = { radius: ZONE.radius, enemies: ZONE.enemies, allies: ZONE.allies };

console.log("pickPromotions — luật cũ giữ nguyên khi không đặt nearR");
t("gần nhất trước, chỉ trong bán kính, đúng trần địch (ZONE.enemies)", () => {
  const actors = [];
  for (let i = 0; i < 40; i++) actors.push(act(i, "dich", 1 + i * 0.5));            // 1 … 20,5 m
  actors.push(act(100, "dich", 26));                                                // ngoài bán kính 25 m
  const r = pickPromotions(actors, hero, { dich: 0, ta: 0 }, CAPS);
  assert.equal(r.promote.length, ZONE.enemies);
  assert.deepEqual(ids(r.promote), Array.from({ length: ZONE.enemies }, (_, i) => i));
  assert.equal(r.forced.length, 0);
  assert.equal(r.blocked.dich, 10);
});
t("bán kính chặt (đúng 25 m thì không thành lính thật), lính đã ngã bị bỏ", () => {
  const r = pickPromotions([act(1, "dich", ZONE.radius), act(2, "dich", 3, 0, { dead: true }), act(3, "dich", 4)], hero, { dich: 0, ta: 0 }, CAPS);
  assert.deepEqual(ids(r.promote), [3]);
});
t("trần đã đầy (đang có 30 địch thật) thì lính diễn địch ngay cạnh tướng vẫn đứng yên — hành vi cũ", () => {
  const r = pickPromotions([act(1, "dich", 2), act(2, "dich", 5)], hero, { dich: ZONE.enemies, ta: 0 }, CAPS);
  assert.equal(r.promote.length, 0); assert.equal(r.blocked.dich, 2);
});
t("trần quân ta riêng (ZONE.allies), không ảnh hưởng quân địch", () => {
  const actors = [act(1, "ta", 3), act(2, "ta", 4), act(3, "dich", 5)];
  const r = pickPromotions(actors, hero, { dich: 0, ta: ZONE.allies }, CAPS);
  assert.deepEqual(ids(r.promote), [3]); assert.equal(r.blocked.ta, 2);
});
t("khoảng cách bằng nhau: giữ thứ tự mảng (sắp ổn định) để vết bot không đổi", () => {
  const r = pickPromotions([act(7, "dich", 5), act(3, "dich", -5), act(9, "dich", 0, 5)], hero, { dich: ZONE.enemies - 2, ta: 0 }, CAPS);
  assert.deepEqual(ids(r.promote), [7, 3]);
});

console.log("pickPromotions — lính sát tướng không được đứng ngoài tầm đánh");
const NEAR = { ...CAPS, nearR: ZONE.nearR, forcedMax: ZONE.forcedMax };
t("trần đầy: cung kỵ diễn trong nearR vẫn thành lính thật (forced), lính xa hơn thì không", () => {
  const horse = act(1, "dich", 4, 0, { mounted: true }), far = act(2, "dich", 15, 0, { mounted: true });
  const r = pickPromotions([horse, far], hero, { dich: ZONE.enemies, ta: 0 }, NEAR);
  assert.deepEqual(ids(r.promote), [1]); assert.deepEqual(ids(r.forced), [1]); assert.equal(r.blocked.dich, 1);
});
t("hạn mức ép ưu tiên kỵ binh: 20 bộ binh ở 2 m, 3 cung kỵ ở 8 m, hạn mức đầy chỗ → cả 3 cung kỵ đều thành lính thật", () => {
  const actors = []; for (let i = 0; i < 40; i++) actors.push(act(i, "dich", 2 + (i % 5) * 0.2, (i % 4) * 0.4));
  actors.push(act(100, "dich", 8, 0, { mounted: true }), act(101, "dich", 8.5, 1, { mounted: true }), act(102, "dich", 7, -2, { K: { mounted: true } }));
  const r = pickPromotions(actors, hero, { dich: ZONE.enemies, ta: 0 }, NEAR);
  assert.equal(r.forced.length, ZONE.forcedMax);
  for (const id of [100, 101, 102]) assert.ok(ids(r.forced).includes(id), "kỵ binh " + id + " phải được ép");
});
t("hạn mức ép còn dư thì sau kỵ binh tới bộ binh gần nhất", () => {
  const actors = [act(1, "dich", 6), act(2, "dich", 2), act(3, "dich", 5, 0, { mounted: true })];
  const r = pickPromotions(actors, hero, { dich: ZONE.enemies, ta: 0 }, NEAR);
  assert.deepEqual(ids(r.forced), [3, 2, 1]);
});
t("không vượt ZONE.forcedMax lính bị ép dù có bao nhiêu lính sát tướng", () => {
  const actors = []; for (let i = 0; i < 40; i++) actors.push(act(i, "dich", 2 + (i % 5) * 0.4, (i % 7) * 0.5));
  const r = pickPromotions(actors, hero, { dich: ZONE.enemies, ta: 0 }, NEAR);
  assert.equal(r.promote.length, ZONE.forcedMax);
  assert.equal(r.forced.length, r.promote.length);
});
t("đang đánh đồn (soft đã tới 36 nhờ quân đồn trú): lính sát tướng vẫn được ép đủ forcedMax — không phụ thuộc số quân đồn trú", () => {
  const actors = []; for (let i = 0; i < 40; i++) actors.push(act(i, "dich", 2 + (i % 5) * 0.4, (i % 7) * 0.5));
  const r = pickPromotions(actors, hero, { dich: ZONE.enemies + 6, ta: 0 }, NEAR);
  assert.equal(r.forced.length, ZONE.forcedMax);
});
t("trần mềm còn chỗ thì lính sát tướng thành lính thật theo luật thường (không tính là forced)", () => {
  const r = pickPromotions([act(1, "dich", 3)], hero, { dich: 10, ta: 0 }, NEAR);
  assert.deepEqual(ids(r.promote), [1]); assert.equal(r.forced.length, 0);
});
t("nearR chỉ áp cho quân địch: quân ta diễn cạnh tướng khi trần ta đầy vẫn đứng yên", () => {
  const r = pickPromotions([act(1, "ta", 2)], hero, { dich: 0, ta: ZONE.allies }, NEAR);
  assert.equal(r.promote.length, 0); assert.equal(r.blocked.ta, 1);
});
t("không ăn vào chuỗi rng: hàm thuần, không đọc Math.random", () => {
  const src = pickPromotions.toString(); assert.ok(!/random/.test(src));
});
t("số cân bằng: nearR phủ tầm đòn xa của tướng (C4 vòng 5 m + bán kính lính); forcedMax đủ cho p90 lính cưỡi sát tướng mà không phình CPU", () => {
  assert.ok(ZONE.nearR >= 8 && ZONE.nearR <= 12, "nearR " + ZONE.nearR);
  assert.ok(ZONE.forcedMax >= 8 && ZONE.forcedMax <= 24, "forcedMax " + ZONE.forcedMax);
});

console.log("Vòng trúng của kỵ binh");
t("bộ binh giữ vòng 0,4 m như cũ, kỵ binh lớn hơn (thân ngựa dài ~2 m quanh điểm lính)", () => {
  assert.equal(HIT_R.foot, 0.4);
  assert.ok(HIT_R.mounted >= 0.9 && HIT_R.mounted <= 1.3, "mounted " + HIT_R.mounted);
  assert.equal(hitRadius({ K: KITS.DV_GIAO }), HIT_R.foot);
  assert.equal(hitRadius({ K: KITS.NG_CUNG }), HIT_R.foot);
  assert.equal(hitRadius({ K: KITS.NG_KY }), HIT_R.mounted);
  assert.equal(hitPad({ K: KITS.NG_DAO }), 0);
  assert.ok(Math.abs(hitPad({ K: KITS.NG_KY }) - (HIT_R.mounted - HIT_R.foot)) < 1e-9);
  assert.equal(hitRadius(null), HIT_R.foot);
});

console.log("Director.updateZone trên Crowd thật (Node)");
const { Crowd } = await import("../js/battle/crowd.js");
const { Director } = await import("../js/battle/director.js");
const { createSim } = await import("../js/sim/front.js");
const { makeRng } = await import("../js/core/rng.js");
const { DIFFICULTY } = await import("../js/data/tuning.js");
const THREE = await import(threeUrl);
const B = await import("../js/data/battle-b15.js");

function zoneWorld() {
  const h = { x: 150, z: -75, y: 0, alive: true, hp: 1000, state: "free", yaw: Math.PI / 2, giap: 50, move: "N1", st: 0, dur: 1, swingId: 0, receiveHit() {} };
  const ctx = { R: 1, rng: makeRng(7), diff: DIFFICULTY[1], hero: h, units: [], clock: 0, openGates: {}, world: { colliders: [], gates: {}, bases: {} }, fx: null, audio: null,
    hk: { tpc: false }, troops: { N: 200, r: 0.35 }, stats: { legionMult: 1, guardBase: 8, mods: {} }, battle: { id: "B15" } };
  ctx.crowd = new Crowd(new THREE.Scene(), ctx);
  const sim = createSim({ fronts: B.FRONTS, bases: B.BASES, enemyMix: B.ENEMY_MIX, R: 1, earthworks: false });
  sim.heroFront = "A"; ctx.sim = sim;
  const wb = {}; for (const b of B.BASES) wb[b.id] = { x: 60 + (b.lineX ?? 0) * 500, z: b.front ? B.FRONTS[b.front].laneZ : 0, r: B.BASE_RING[b.type] };
  ctx.world.bases = wb; ctx.world.setBaseProgress = () => {}; ctx.world.setBaseOwner = () => {};
  const d = Object.create(Director.prototype); Object.assign(d, { ctx, phase: 0, keepers: {}, capT: {}, capPause: 0, zoneT: 0, time: 0, swingQ: new Map(), qBucket: 10, ko: 0, koMs: 0 }); ctx.director = d;
  return { ctx, d, h, crowd: ctx.crowd };
}
const spawnEnemy = (crowd, role, unit, x, z) => crowd.spawn({ side: "dich", unit, role, front: role === "garrison" ? null : "A", x, z });

t("vùng chiến đấu đã đủ 30 địch thật: cung kỵ diễn cách tướng 4 m phải thành lính thật, đánh trúng được", () => {
  const { d, h, crowd } = zoneWorld();
  for (let i = 0; i < ZONE.enemies; i++) spawnEnemy(crowd, "zone", "KHIEN_NG", h.x + 10 + (i % 6) * 2, h.z - 12 + Math.floor(i / 6) * 4);
  const horse = spawnEnemy(crowd, "actor", "CUNGKY_NG", h.x + 4, h.z);
  const farHorse = spawnEnemy(crowd, "actor", "CUNGKY_NG", h.x + 18, h.z);
  assert.ok(horse.K.mounted && !crowd.hittable(horse), "tiền đề: lính diễn không trúng đòn");
  d.updateZone(0.3);
  assert.equal(horse.role, "zone"); assert.ok(crowd.hittable(horse));
  assert.equal(farHorse.role, "actor", "lính xa hơn nearR vẫn là lính diễn khi trần đầy");
  assert.equal(crowd.damage(horse, 1e6, { by: "hero" }), true, "đánh hạ được sau khi thành lính thật");
});
t("trần ép: 50 lính diễn sát tướng, trần đầy → chỉ thêm đúng forcedMax lính thật", () => {
  const { d, h, crowd } = zoneWorld();
  for (let i = 0; i < ZONE.enemies; i++) spawnEnemy(crowd, "zone", "KHIEN_NG", h.x + 10 + (i % 6) * 2, h.z - 12 + Math.floor(i / 6) * 4);
  for (let i = 0; i < 50; i++) spawnEnemy(crowd, "actor", i % 2 ? "CUNGKY_NG" : "KHIEN_NG", h.x + 2 + (i % 5) * 0.4, h.z + (i % 9) - 4);
  d.updateZone(0.3);
  const real = crowd.agents.filter((a) => a.side === "dich" && crowd.hittable(a)).length;
  assert.equal(real, ZONE.enemies + ZONE.forcedMax);
});
t("lính đã bị ép thành thật (forced) tính vào forcedMax nhưng không chiếm chỗ trần mềm", () => {
  const actors = []; for (let i = 0; i < 20; i++) actors.push(act(i, "dich", 2 + i * 0.1));
  const r = pickPromotions(actors, hero, { dich: ZONE.enemies, ta: 0, forced: 10 }, NEAR);
  assert.equal(r.promote.length, ZONE.forcedMax - 10);
  // trần mềm còn 5 chỗ: 5 người đầu thành lính thường (không tính là ép), rồi ép thêm tới khi đủ forcedMax
  const r2 = pickPromotions(actors, hero, { dich: ZONE.enemies - 5, ta: 0, forced: 10 }, NEAR);
  assert.equal(r2.forced.length, ZONE.forcedMax - 10);
  assert.equal(r2.promote.length, 5 + (ZONE.forcedMax - 10));
});
t("nhiều nhịp updateZone liền: số lính bị ép giữ ở ZONE.forcedMax (cờ a.forced được ghi và đọc lại mỗi nhịp)", () => {
  const { d, h, crowd } = zoneWorld();
  for (let i = 0; i < ZONE.enemies; i++) spawnEnemy(crowd, "zone", "KHIEN_NG", h.x + 10 + (i % 6) * 2, h.z - 12 + Math.floor(i / 6) * 4);
  for (let i = 0; i < 80; i++) spawnEnemy(crowd, "actor", i % 2 ? "CUNGKY_NG" : "KHIEN_NG", h.x + 2 + (i % 8) * 0.5, h.z + (i % 9) - 4);
  for (let k = 0; k < 4; k++) { d.zoneT = 0; d.updateZone(0.3); }
  const real = crowd.agents.filter((a) => a.side === "dich" && crowd.hittable(a)).length;
  assert.equal(real, ZONE.enemies + ZONE.forcedMax);
});
t("lính ép Ở XA không chiếm hạn mức (cung kỵ lùi giữ tầm vẫn là lính thật, vẫn mang cờ ép): chỉ lính ép trong ZONE.forcedKeepR mới tính vào forcedMax", () => {
  const { d, h, crowd } = zoneWorld();
  for (let i = 0; i < ZONE.enemies; i++) spawnEnemy(crowd, "zone", "KHIEN_NG", h.x + 10 + (i % 6) * 2, h.z - 12 + Math.floor(i / 6) * 4);
  for (let i = 0; i < ZONE.forcedMax; i++) { const a = spawnEnemy(crowd, "zone", "CUNGKY_NG", h.x + ZONE.forcedKeepR + 4 + i, h.z + 3); a.forced = true; }
  const horse = spawnEnemy(crowd, "actor", "CUNGKY_NG", h.x + 4, h.z);
  d.zoneT = 0; d.updateZone(0.3);
  assert.equal(horse.role, "zone", "bản trước: 20 lính ép ở xa giữ hết hạn mức nên cung kỵ sát tướng vẫn là lính diễn, chém xuyên qua");
  assert.ok(horse.forced);
});
t("lính ép ở GẦN (trong forcedKeepR) vẫn tính: đủ forcedMax thì lính diễn sát tướng thêm không thành thật", () => {
  const { d, h, crowd } = zoneWorld();
  for (let i = 0; i < ZONE.enemies; i++) spawnEnemy(crowd, "zone", "KHIEN_NG", h.x + 10 + (i % 6) * 2, h.z - 12 + Math.floor(i / 6) * 4);
  for (let i = 0; i < ZONE.forcedMax; i++) { const a = spawnEnemy(crowd, "zone", "KHIEN_NG", h.x + 3 + (i % 5) * 0.5, h.z + 2 - Math.floor(i / 5)); a.forced = true; }
  const extra = spawnEnemy(crowd, "actor", "CUNGKY_NG", h.x + 4, h.z);
  d.zoneT = 0; d.updateZone(0.3);
  assert.equal(extra.role, "actor");
});
t("lính diễn thành lính thật giữa nhát chém GIẢ thì bỏ nhát đó (không giáng đòn thật không thẻ, không báo trước)", () => {
  const { d, h, crowd } = zoneWorld();
  const a = spawnEnemy(crowd, "actor", "KHIEN_NG", h.x + 3, h.z); a.windup = 0.3; a.fake = true;
  d.zoneT = 0; d.updateZone(0.3);
  assert.equal(a.role, "zone"); assert.equal(a.windup, 0); assert.equal(a.fake, false);
});
t("lính ép thành thật không làm chậm việc sinh quân đồn trú (chúng không tính vào trần 30 + 6 của updateZone)", () => {
  const { d, h, crowd, ctx } = zoneWorld();
  ctx.sim.bases.A1.keeperAlive = false;
  const A1 = ctx.world.bases.A1; h.x = A1.x + 4; h.z = A1.z;
  for (let i = 0; i < 20; i++) spawnEnemy(crowd, "zone", "KHIEN_NG", h.x + 12 + (i % 5) * 2, h.z - 8 + Math.floor(i / 5) * 4);
  for (let i = 0; i < 12; i++) { const a = spawnEnemy(crowd, "zone", "KHIEN_NG", h.x + 2 + (i % 4) * 0.5, h.z + 4 - Math.floor(i / 4) * 2); a.forced = true; }
  d.updateZone(0.3);
  const gar = crowd.agents.filter((a) => a.role === "garrison").length;
  assert.equal(gar, ZONE.enemies + 6 - 20, "sinh đủ tới trần mềm 36 như khi không có lính ép");
});
t("lính ép thành thật bị trả về lính diễn khi xa tướng > 45 m thì mất cờ forced", () => {
  const { d, h, crowd } = zoneWorld();
  const a = spawnEnemy(crowd, "zone", "CUNGKY_NG", h.x + 60, h.z); a.forced = true;
  d.updateZone(0.3);
  assert.equal(a.role, "actor"); assert.equal(a.forced, false);
});
t("vùng chiến đấu còn thưa: lính diễn trong 25 m thành lính thật như cũ (nearR không đổi gì)", () => {
  const { d, h, crowd } = zoneWorld();
  const a = spawnEnemy(crowd, "actor", "CUNGKY_NG", h.x + 20, h.z), b = spawnEnemy(crowd, "actor", "KHIEN_NG", h.x + 30, h.z);
  d.updateZone(0.3);
  assert.equal(a.role, "zone"); assert.equal(b.role, "actor");
});

console.log(`\n${pass} đạt, ${fail} trượt`);
process.exit(fail ? 1 : 0);
