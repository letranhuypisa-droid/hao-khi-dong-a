// tests/promotion.test.mjs — đợt 12a: lính cưỡi ngựa (Cung kỵ) mà tướng không đánh được.
// (1) battle/promotion.js (thuần): lính diễn (actor, KHÔNG trúng đòn) nào thành lính thật (zone, trúng đòn). Luật cũ: gần nhất trước, trong
//     ZONE.radius, tới trần ZONE.enemies / ZONE.allies. Luật mới: lính địch SÁT tướng (ZONE.nearR) vẫn thành lính thật khi trần đã đầy, tới
//     tối đa ZONE.forcedMax người — không để kẻ đứng cạnh tướng mà chém xuyên qua.
// (2) tuning.js: vòng trúng của kỵ binh lớn hơn bộ binh (hitRadius / hitPad), khớp thân ngựa dài ~2 m quanh điểm lính.
// (3) Director.updateZone trên Crowd thật (Node, không WebGL): cung kỵ diễn đứng cạnh tướng khi vùng chiến đấu đã đủ 30 địch phải thành lính thật.
// (4) Đợt 15b: đòn của tướng chạm lính diễn phe địch thì người đó thành lính thật ngay và nhận đòn — enlistActor / enemyActor (thuần), Crowd.strikeable /
//     Crowd.enlist, rồi Hero thật trên Crowd thật: nhát N, nón chém tính bề ngang thân, Phá Trận, Bóp Nát, Bạch Đằng, ảnh lướt né, tự nhắm.
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

// (4) Đợt 15b — đòn CỦA NGƯỜI CHƠI chạm lính diễn phe địch: người đó thành lính thật ngay và nhận đòn. Trước đây còn lọt khi hạn mức ép đầy (đứng sâu
//     trong khối, hàng sau bước lên lấp chỗ), khi Phá Trận lao 9–11 m giữa hai nhịp updateZone, và tự nhắm bỏ qua người trông gần nhất.
console.log("enlistActor / enemyActor (thuần) — đòn tướng chạm lính diễn");
const { enlistActor, enemyActor } = await import("../js/battle/promotion.js");
const actorOf = (extra = {}) => ({ id: 1, role: "actor", side: "dich", alive: true, state: "move", token: true, march: true, forced: false, windup: 0, fake: false, ...extra });
t("lính diễn địch: đổi đúng như nhánh ép của updateZone — zone, bỏ thẻ, hết hành quân, mang cờ forced; trả true", () => {
  const a = actorOf();
  assert.equal(enlistActor(a), true);
  assert.deepEqual([a.role, a.token, a.march, a.forced], ["zone", false, false, true]);
});
t("đang vung nhát chém GIẢ thì bỏ nhát đó (windup 0, fake false); nhát thật không đụng", () => {
  const a = actorOf({ windup: 0.3, fake: true }); enlistActor(a);
  assert.equal(a.windup, 0); assert.equal(a.fake, false);
  const b = actorOf({ windup: 0.3, fake: false }); enlistActor(b);
  assert.equal(b.windup, 0.3);
});
t("lính không phải lính diễn (zone, garrison, squad) thì không đụng, trả false", () => {
  for (const role of ["zone", "garrison", "squad", "guard"]) {
    const a = actorOf({ role, token: true, forced: false }), before = { ...a };
    assert.equal(enlistActor(a), false, role); assert.deepEqual(a, before, role);
  }
});
t("lính diễn phe ta không bao giờ bị đòn của tướng đổi", () => {
  const a = actorOf({ side: "ta" }), before = { ...a };
  assert.equal(enemyActor(a), false); assert.equal(enlistActor(a), false); assert.deepEqual(a, before);
});
t("lính diễn đã ngã (state dead) hoặc đã trả về bể (alive false) thì không đổi", () => {
  for (const extra of [{ state: "dead" }, { alive: false }]) {
    const a = actorOf(extra), before = { ...a };
    assert.equal(enemyActor(a), false); assert.equal(enlistActor(a), false); assert.deepEqual(a, before);
  }
});
t("enemyActor: lính diễn địch còn đứng → true; null / không có trường → false", () => {
  assert.equal(enemyActor(actorOf()), true); assert.equal(enemyActor(null), false); assert.equal(enemyActor({}), false);
});

console.log("Crowd.strikeable / Crowd.enlist (Node)");
t("strikeable = hittable, thêm lính diễn địch còn đứng; lính diễn ta, lính đã ngã thì không", () => {
  const { crowd, h } = zoneWorld();
  const act = spawnEnemy(crowd, "actor", "CUNGKY_NG", h.x + 3, h.z), zone = spawnEnemy(crowd, "zone", "KHIEN_NG", h.x + 4, h.z);
  const ally = crowd.spawn({ side: "ta", unit: "GIAO_DV", role: "actor", front: "A", x: h.x - 3, z: h.z });
  const dead = spawnEnemy(crowd, "actor", "KHIEN_NG", h.x + 5, h.z); dead.state = "dead";
  assert.equal(crowd.hittable(act), false); assert.equal(crowd.strikeable(act), true);
  assert.equal(crowd.strikeable(zone), true); assert.equal(crowd.strikeable(ally), false); assert.equal(crowd.strikeable(dead), false);
});
t("enlist rồi damage: lính diễn thành lính thật, trúng đòn được; enlist lính thật trả false", () => {
  const { crowd, h } = zoneWorld();
  const a = spawnEnemy(crowd, "actor", "CUNGKY_NG", h.x + 3, h.z), z = spawnEnemy(crowd, "zone", "KHIEN_NG", h.x + 4, h.z);
  assert.equal(crowd.damage(a, 1, { by: "hero" }), false); assert.equal(a.hp, a.maxHp, "tiền đề: damage tự bỏ qua lính diễn");
  assert.equal(crowd.enlist(a), true); assert.ok(crowd.hittable(a)); assert.ok(a.forced);
  crowd.damage(a, 1, { by: "hero" }); assert.ok(a.hp < a.maxHp);
  assert.equal(crowd.enlist(z), false); assert.equal(z.forced, false);
});

console.log("Đòn của tướng (Hero thật, Crowd thật) chạm lính diễn địch");
const { Hero } = await import("../js/battle/hero.js");
const { SKILL_IMPL } = await import("../js/battle/hero-skills.js");
const { HEROES } = await import("../js/data/heroes.js");
const { MOVES } = await import("../js/data/tuning.js");
const Prog = await import("../js/meta/progress.js");
const NOOP = new Proxy({}, { get: () => () => {} });
// tướng H35 (hoặc H31) đứng ở (150, -75) quay mặt về +x (yaw π/2), Crowd thật; director chỉ có các móc tướng gọi tới
function strikeWorld(id = "H35") {
  const ctx = { R: 1, rng: makeRng(11), diff: DIFFICULTY[1], units: [], clock: 0, openGates: {}, world: { colliders: [], gates: {}, bases: {} }, fx: NOOP, audio: NOOP,
    hk: { tpc: false }, troops: { N: 200, r: 0.35 }, stats: { legionMult: 1, mods: {} }, battle: { id: "B15", heroSpawn: { x: 150, z: -75, yaw: Math.PI / 2 } },
    scene: new THREE.Scene(), cam: { yaw: 0 }, hud: null, cinematic() {}, hitstop() {}, slowmo() {},
    director: { onHeroAction() {}, onSoldierKilled() {}, damageGate() {}, plantFlag() {}, onUlt() {}, ultQ() {}, onHeroHit() {} } };
  ctx.crowd = new Crowd(ctx.scene, ctx);
  const s = Prog.newSave(), stats = id === "H35" ? Prog.heroStats(s, 1) : Prog.heroStats(s, 25, id, { level: 25 });
  const h = id === "H35" ? new Hero(ctx, stats) : new Hero(ctx, stats, HEROES[id]);
  ctx.hero = h;
  return { ctx, h, crowd: ctx.crowd };
}
const hurt = (a) => a.hp < a.maxHp;
t("N1 chém cung kỵ diễn đứng ngay trước mặt 2 m: thành lính thật và trúng đòn (trước: chém xuyên)", () => {
  const { h, crowd } = strikeWorld();
  const a = spawnEnemy(crowd, "actor", "CUNGKY_NG", h.x + 2, h.z);
  h.applyHits("N1", MOVES.N1, true);
  assert.equal(a.role, "zone"); assert.ok(a.forced); assert.ok(hurt(a), "trúng đòn");
});
t("N1 không đổi lính diễn ngoài tầm, sau lưng, hay lính diễn phe ta trước mặt", () => {
  const { h, crowd } = strikeWorld();
  const far = spawnEnemy(crowd, "actor", "KHIEN_NG", h.x + 6, h.z), back = spawnEnemy(crowd, "actor", "KHIEN_NG", h.x - 2, h.z);
  const ally = crowd.spawn({ side: "ta", unit: "GIAO_DV", role: "actor", front: "A", x: h.x + 2, z: h.z + 0.5 });
  h.applyHits("N1", MOVES.N1, true);
  for (const a of [far, back, ally]) { assert.equal(a.role, "actor"); assert.equal(a.hp, a.maxHp); }
});
t("nón chém tính bề ngang thân: cung kỵ lệch 85° ở 3 m (tâm ngoài nón 150°) vẫn trúng, bộ binh cùng chỗ thì không", () => {
  const { h, crowd } = strikeWorld();
  const ang = h.yaw - 85 * Math.PI / 180;
  const horse = spawnEnemy(crowd, "zone", "CUNGKY_NG", h.x + Math.sin(ang) * 3, h.z + Math.cos(ang) * 3);
  h.applyHits("N1", MOVES.N1, true);
  assert.ok(hurt(horse), "cung kỵ trúng");
  const w2 = strikeWorld(), foot = spawnEnemy(w2.crowd, "zone", "KHIEN_NG", w2.h.x + Math.sin(ang) * 3, w2.h.z + Math.cos(ang) * 3);
  w2.h.applyHits("N1", MOVES.N1, true);
  assert.equal(foot.hp, foot.maxHp, "bộ binh trượt");
});
// Phần nới góc chỉ dành cho thân LÍNH (thiết kế đã duyệt). Cổng (bán kính 3,5 m) và đơn vị lớn (sĩ quan, Toa Đô: u.radius) giữ đúng luật cũ: bán kính
// chỉ cộng vào tầm, góc xét theo tâm — nới cho cổng thì nhát chém lính quay lưng đi gần 130° vẫn trừ độ bền cổng (P3 phá cổng ngắn đi).
const offAt = (h, deg, d) => { const a = h.yaw - deg * Math.PI / 180; return [h.x + Math.sin(a) * d, h.z + Math.cos(a) * d]; };
t("nón chém với cổng giữ luật cũ: tâm cổng lệch 110° ở 2,5 m thì không trừ độ bền; lệch 70° hay thẳng trước ở tầm + 3,5 m thì trừ", () => {
  const reach = MOVES.N1.range;
  for (const [deg, d, want] of [[110, 2.5, false], [-110, 2.5, false], [70, 2.5, true], [0, reach + 3.5 - 0.1, true], [0, reach + 3.5 + 0.1, false]]) {
    const { ctx, h } = strikeWorld(), hits = [];
    const [px, pz] = offAt(h, deg, d);
    ctx.world.gates.g1 = { x: px + 1.6, z: pz };                   // applyHits xét điểm (gt.x − 1,6, gt.z)
    ctx.director.damageGate = (id) => hits.push(id);
    h.applyHits("N1", MOVES.N1, true);
    assert.equal(hits.length > 0, want, `cổng lệch ${deg}° ở ${d.toFixed(1)} m`);
  }
});
t("nón chém với sĩ quan (đơn vị lớn) giữ luật cũ: tâm lệch 85° ở 2 m thì trượt; thẳng trước ở tầm + bán kính thì trúng", () => {
  const reach = MOVES.N1.range;
  for (const [deg, d, want] of [[85, 2, false], [-85, 2, false], [70, 2, true], [0, reach + 1.2 - 0.1, true], [0, reach + 1.2 + 0.1, false]]) {
    const { ctx, h } = strikeWorld();
    const [x, z] = offAt(h, deg, d);
    const u = { side: "dich", alive: true, dead: false, retreating: false, isBig: true, x, z, y: 0, radius: 1.2, giap: 10, rig: { scale: 1 }, hits: 0,
      takeHeroHit() { this.hits++; return { broke: false, killed: false }; } };
    ctx.units.push(u);
    h.applyHits("N1", MOVES.N1, true);
    assert.equal(u.hits > 0, want, `sĩ quan lệch ${deg}° ở ${d.toFixed(1)} m`);
  }
});
t("Phá Trận lao xuyên khối lính diễn: mọi người trên đường lao (2,2 m + bán kính) đều thành lính thật và trúng", () => {
  const { h, crowd } = strikeWorld();
  const line = [3, 6, 9, 12, 15].map((dx, i) => spawnEnemy(crowd, "actor", i % 2 ? "CUNGKY_NG" : "KHIEN_NG", h.x + dx, h.z + (i % 2 ? 1.2 : -0.6)));
  const off = spawnEnemy(crowd, "actor", "KHIEN_NG", h.x + 8, h.z + 5);
  assert.equal(SKILL_IMPL.phaTran.start(h), true);
  for (let i = 0; i < 20 && h.state === "skill"; i++) SKILL_IMPL.phaTran.update(h, 1 / 30);
  for (const a of line) { assert.equal(a.role, "zone", "lính ở " + (a.x - 150).toFixed(0) + " m"); assert.ok(hurt(a)); }
  assert.equal(off.role, "actor", "lính cách đường lao 5 m không bị đổi");
});
t("Tuyệt Kỹ Bóp Nát Quân Thù: lính diễn trong vòng 3,5 m thành lính thật và trúng", () => {
  const { h, crowd } = strikeWorld();
  const a = spawnEnemy(crowd, "actor", "KHIEN_NG", h.x + 2.5, h.z + 1), far = spawnEnemy(crowd, "actor", "KHIEN_NG", h.x + 12, h.z);
  h.ki = 200;
  assert.equal(SKILL_IMPL.bopNat.start(h), true);
  for (let i = 0; i < 30; i++) SKILL_IMPL.bopNat.update(h, 1 / 30);
  assert.equal(a.role, "zone"); assert.ok(hurt(a)); assert.equal(far.role, "actor");
});
t("Tuyệt Kỹ Bạch Đằng (H31): nhát bổ đầu trúng lính diễn trong vòng sóng chấn", () => {
  const { h, crowd } = strikeWorld("H31");
  const a = spawnEnemy(crowd, "actor", "CUNGKY_NG", h.x + 6, h.z + 2);
  h.ki = h.kiMax;
  assert.equal(SKILL_IMPL.bachDang.start(h), true);
  for (let i = 0; i < 40; i++) SKILL_IMPL.bachDang.update(h, 1 / 30);
  assert.equal(a.role, "zone"); assert.ok(hurt(a));
});
t("ảnh lướt né (afterimage): lính diễn trong 3 m thành lính thật và trúng", () => {
  const { h, crowd } = strikeWorld();
  const a = spawnEnemy(crowd, "actor", "KHIEN_NG", h.x + 2, h.z);
  h.afterimageBurst(h.x, h.z);
  assert.equal(a.role, "zone"); assert.ok(hurt(a));
});
t("tự nhắm: lính diễn địch trong 4 m là mục tiêu (trước: không thấy ai, tướng chém theo hướng cũ); ngoài 4 m thì không", () => {
  const { h, crowd } = strikeWorld();
  const a = spawnEnemy(crowd, "actor", "KHIEN_NG", h.x + 2, h.z + 2);
  assert.equal(h.autoTarget(), a);
  const w2 = strikeWorld(); spawnEnemy(w2.crowd, "actor", "KHIEN_NG", w2.h.x + 4.5, w2.h.z);
  assert.equal(w2.h.autoTarget(), null);
  const w3 = strikeWorld(); w3.crowd.spawn({ side: "ta", unit: "GIAO_DV", role: "actor", front: "A", x: w3.h.x + 2, z: w3.h.z });
  assert.equal(w3.h.autoTarget(), null, "lính diễn phe ta không phải mục tiêu");
});
t("nearestEnemy giữ nguyên: chỉ thấy lính trúng đòn được (Khí Lực, bot, Tuyệt Kỹ bước tới)", () => {
  const { h, crowd } = strikeWorld();
  spawnEnemy(crowd, "actor", "KHIEN_NG", h.x + 2, h.z);
  assert.equal(h.nearestEnemy(12), null);
});

console.log(`\n${pass} đạt, ${fail} trượt`);
process.exit(fail ? 1 : 0);
