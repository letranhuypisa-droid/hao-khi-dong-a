// tests/garrison.test.mjs — đợt 12b: quân đồn trú chạy ra ngoài đồn mà người chơi không biết ở đâu.
// (1) battle/garrison.js (thuần): đếm trong / ngoài vòng, chữ nhắc "còn N · a trong đồn · b ngoài đồn", dấu bản đồ nhỏ, con gần nhất để chỉ đường,
//     dây xích cứng và hướng rút về đồn.
// (2) Crowd thật trong Node (không WebGL): lính đồn trú có dây cứng không rời quá GARRISON.hardLeash khỏi vòng — dù đuổi tướng, dù bị vỡ trận
//     (sĩ quan trấn thủ ngã); neo không có dây (B20, toán vây tướng) giữ hành vi cũ.
// (3) Director: thẻ nhiệm vụ hiện ngay khi tướng cách đồn < GARRISON.hintR (không chỉ trong vòng); Director.blockers() chỉ ra con gần nhất khi còn ≤ pointLast.
//   node hao-khi-viet/game/tests/garrison.test.mjs
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const threeUrl = pathToFileURL(join(here, "../vendor/three/three.module.js")).href;
registerHooks({ resolve: (s, c, next) => (s === "three" ? { url: threeUrl, shortCircuit: true } : next(s, c)) });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => new Proxy({}, { get: (o, k) => (k in o ? o[k] : () => ({ width: 0 })), set: (o, k, v) => ((o[k] = v), true) }) }) };

const { classifyGarrison, garrisonHint, nearestBlocker, garrisonMarks, isLast, leashClamp, fleeDir } = await import("../js/battle/garrison.js");
const { GARRISON, AI, KITS, TIERS, DIFFICULTY } = await import("../js/data/tuning.js");
const { BASES, BASE_RING, FRONTS, ENEMY_MIX } = await import("../js/data/battle-b15.js");

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log("  ok  " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + (e.stack || e.message)); }
}

const A1 = { x: 210, z: -75, r: BASE_RING.don };
const at = (d, ang = 0) => ({ x: A1.x + Math.cos(ang) * d, z: A1.z + Math.sin(ang) * d });

console.log("Đếm trong / ngoài vòng");
t("vòng A1 (r 10): lính ở 4, 9,9, 12 m — margin 0 thì 2 trong 1 ngoài, vượt mép 2 m", () => {
  const c = classifyGarrison(A1, [at(4), at(9.9), at(12)], { margin: 0 });
  assert.deepEqual([c.inside, c.outside, c.total], [2, 1, 3]);
  assert.ok(Math.abs(c.farthest - 2) < 1e-9);
  assert.ok(Math.abs(c.nearest.over - 2) < 1e-9);
});
t("mặc định có dung sai GARRISON.ringPad: lính sinh ngay hàng rào (r + 3 m, director.js) chưa tính là bỏ đồn", () => {
  const pad = GARRISON.ringPad;
  assert.equal(pad, 3, "khớp bán kính sinh r + 3 ở director.js");
  const c = classifyGarrison(A1, [at(A1.r + pad - 0.1), at(A1.r + pad + 0.1)]);
  assert.deepEqual([c.inside, c.outside], [1, 1]);
});
t("không ai ngoài vòng: farthest 0, nearest null; không ai cả: tất cả 0", () => {
  const c = classifyGarrison(A1, [at(3), at(8)]);
  assert.equal(c.outside, 0); assert.equal(c.farthest, 0); assert.equal(c.nearest, null);
  assert.deepEqual(classifyGarrison(A1, []), { inside: 0, outside: 0, total: 0, farthest: 0, nearest: null });
});
t("nearest là con ngoài vòng gần mép nhất, và trả lại đúng đối tượng lính", () => {
  const a = at(30), b = at(16), c = at(25);
  const r = classifyGarrison(A1, [a, b, c], { margin: 0 });
  assert.equal(r.nearest.soldier, b); assert.equal(r.outside, 3);
});

console.log("Chữ nhắc ở thẻ nhiệm vụ");
t("không có lính ngoài vòng: đúng chữ cũ của director.js (còn N, N = max(ceil G, lính đang đứng))", () => {
  assert.equal(garrisonHint({ G: 14.2, inside: 9, outside: 0 }), "Hạ quân đồn trú: còn 15");
  assert.equal(garrisonHint({ G: 0.4, inside: 0, outside: 0 }), "Hạ quân đồn trú: còn 1");
  assert.equal(garrisonHint({ G: 110, inside: 30, outside: 0 }), "Hạ quân đồn trú: còn 110", "kho G lớn hơn số lính đang đứng");
  assert.equal(garrisonHint({ G: 0, inside: 3, outside: 0 }), "Hạ quân đồn trú: còn 3", "G đã về 0 mà lính còn đứng");
});
t("có lính ngoài vòng: ghi thêm b ngoài đồn (không ghi 'a trong đồn': N gồm cả kho G chưa ra bãi nên không bao giờ bằng a + b)", () => {
  assert.equal(garrisonHint({ G: 74, inside: 25, outside: 3 }), "Hạ quân đồn trú: còn 74 · 3 ngoài đồn");
  assert.equal(garrisonHint({ G: 0.2, inside: 0, outside: 2 }), "Hạ quân đồn trú: còn 2 · 2 ngoài đồn");
  assert.ok(!/trong đồn/.test(garrisonHint({ G: 140, inside: 3, outside: 4 })));
});
t("còn sĩ quan trấn thủ: chữ cũ 'Hạ <tên> trấn thủ', chưa nói số quân", () => {
  assert.equal(garrisonHint({ G: 110, keeperAlive: true, keeperName: TIERS.doitruong.name, inside: 20, outside: 4 }), "Hạ Đội trưởng trấn thủ");
});

console.log("Chỉ đường tới con cuối");
t("nearestBlocker: gần tướng nhất; rỗng thì null; hòa thì người đứng trước mảng", () => {
  const hero = { x: 0, z: 0 }, a = { x: 10, z: 0 }, b = { x: 0, z: 6 }, c = { x: -6, z: 0 };
  assert.equal(nearestBlocker([a, b], hero), b);
  assert.equal(nearestBlocker([a, c, b], hero), c);
  assert.equal(nearestBlocker([], hero), null);
});
t("isLast: con cuối khi kho G đã cạn (G ≤ số đang đứng) và còn ≤ pointLast người; kho còn thì chưa", () => {
  assert.equal(isLast(0, 1), true); assert.equal(isLast(1, 1), true, "G == số lính đang đứng: không còn ai sẽ ra thêm");
  assert.equal(isLast(3.6, 3), true, "floor(G) = 3 ≤ 3");
  assert.equal(isLast(5, 2), false, "kho còn 5, trên bãi 2: sẽ có người ra thêm");
  assert.equal(isLast(0, 0), false, "hết lính: không còn con nào để chỉ");
  assert.equal(isLast(GARRISON.pointLast, GARRISON.pointLast), true); assert.equal(isLast(GARRISON.pointLast + 1, GARRISON.pointLast + 1), false, "đông hơn pointLast");
});
t("garrisonMarks: nhóm theo Cứ Điểm [{ soldiers, G }]; dấu 'last' (nhấp nháy) chỉ khi nhóm đó là những con cuối", () => {
  const few = Array.from({ length: GARRISON.pointLast }, (_, i) => at(5 + i));
  assert.ok(garrisonMarks([{ soldiers: few, G: 0 }]).every((m) => m.last));
  assert.ok(garrisonMarks([{ soldiers: few, G: 50 }]).every((m) => !m.last), "kho còn nhiều: chưa phải con cuối");
  assert.ok(garrisonMarks([{ soldiers: [...few, at(30)], G: 0 }]).every((m) => !m.last), "đông hơn pointLast");
  assert.deepEqual(garrisonMarks([{ soldiers: [at(5)], G: 1 }])[0], { x: at(5).x, z: at(5).z, last: true });
  assert.equal(garrisonMarks([{ soldiers: [at(5)], G: 0 }, { soldiers: [at(9), at(8)], G: 40 }]).filter((m) => m.last).length, 1, "mỗi nhóm một phán quyết");
});

console.log("Dây xích cứng và rút về đồn");
const anchor = { x: A1.x, z: A1.z, r: A1.r, hard: A1.r + GARRISON.hardLeash };
t("hardLeash lớn hơn hai dây mềm cũ (AI.kiteLeash, AI.duel.leash) để dây mềm vẫn quyết hành vi trong thường lệ", () => {
  assert.ok(GARRISON.hardLeash > AI.kiteLeash && GARRISON.hardLeash > AI.duel.leash);
  assert.ok(GARRISON.hardLeash <= 16, "không để lính đứng xa vòng tới mức không còn là 'quân đồn trú'");
});
t("leashClamp: trong dây thì giữ nguyên, ngoài dây thì kéo về mép tròn bán kính hard theo hướng cũ", () => {
  assert.deepEqual(leashClamp(anchor.x + 5, anchor.z, anchor), [anchor.x + 5, anchor.z]);
  const [x, z] = leashClamp(anchor.x + 60, anchor.z, anchor);
  assert.ok(Math.abs(x - (anchor.x + anchor.hard)) < 1e-9 && z === anchor.z);
  const [x2, z2] = leashClamp(anchor.x + 30, anchor.z + 40, anchor);
  assert.ok(Math.abs(Math.hypot(x2 - anchor.x, z2 - anchor.z) - anchor.hard) < 1e-9);
  assert.ok(Math.abs((z2 - anchor.z) / (x2 - anchor.x) - 40 / 30) < 1e-9, "giữ hướng");
});
t("leashClamp không đụng neo không có dây (B20, thuyền) hay neo của toán vây tướng đồng minh", () => {
  assert.deepEqual(leashClamp(999, 999, { x: 0, z: 0, r: 5 }), [999, 999]);
  assert.deepEqual(leashClamp(999, 999, { x: 0, z: 0, r: 5, hard: 10, target: {} }), [999, 999]);
  assert.deepEqual(leashClamp(999, 999, null), [999, 999]);
});
t("fleeDir: lính thường chạy ngược khỏi tướng; lính đồn trú có dây rút VỀ tâm đồn; đã trong vòng thì đứng", () => {
  const hero = { x: 0, z: 0 };
  const [ax, az] = fleeDir({ x: 3, z: 4, anchor: null }, hero);
  assert.ok(Math.abs(ax - 0.6) < 1e-9 && Math.abs(az - 0.8) < 1e-9);
  const gar = { x: anchor.x + 18, z: anchor.z, anchor };
  const [gx, gz] = fleeDir(gar, { x: anchor.x + 30, z: anchor.z });            // tướng ở xa hơn, bên kia: vẫn về tâm đồn
  assert.ok(gx < -0.99 && Math.abs(gz) < 1e-9);
  assert.deepEqual(fleeDir({ x: anchor.x + 2, z: anchor.z, anchor }, hero), [0, 0]);
  assert.deepEqual(fleeDir({ x: 3, z: 4, anchor: { x: 0, z: 0, r: 5 } }, hero).map((v) => Math.round(v * 10) / 10), [0.6, 0.8], "neo không có dây: như lính thường");
});

console.log("Crowd thật (Node)");
const { Crowd } = await import("../js/battle/crowd.js");
const { makeRng } = await import("../js/core/rng.js");
const THREE = await import(threeUrl);

function world() {
  const hero = { x: A1.x + 35, z: A1.z, y: 0, alive: true, hp: 1e6, maxHp: 1e6, state: "free", yaw: -Math.PI / 2, giap: 50, move: "N1", st: 0, dur: 1, swingId: 0, receiveHit() {} };
  const ctx = { R: 1, rng: makeRng(11), diff: DIFFICULTY[1], hero, units: [], clock: 0, openGates: {}, world: { colliders: [], gates: {}, bases: {} }, fx: null, audio: null };
  ctx.crowd = new Crowd(new THREE.Scene(), ctx);
  return { ctx, hero, crowd: ctx.crowd };
}
const gar = (crowd, d, o = {}) => crowd.spawn({ side: "dich", unit: "KHIEN_NG", kit: "NG_DAO", role: "garrison", src: "A1", x: A1.x + d, z: A1.z, anchor: { ...anchor, ...(o.anchor || {}) }, ...o });
const distTo = (a) => Math.hypot(a.x - anchor.x, a.z - anchor.z);
const run = (ctx, crowd, sec, each) => { for (let i = 0; i < Math.round(sec * 30); i++) { ctx.clock += 1 / 30; crowd.update(1 / 30); each?.(); } };

t("lính cận chiến đồn trú đuổi tướng đứng xa: không vượt dây cứng (trước đợt 12 đuổi theo tới sát tướng)", () => {
  const { ctx, hero, crowd } = world(); hero.x = A1.x + 33;       // cách lính 18 m: trong tầm đuổi (aggro 20) nhưng ngoài dây cứng
  const a = gar(crowd, 15); let max = 0;
  run(ctx, crowd, 10, () => { max = Math.max(max, distTo(a)); });
  assert.ok(max <= anchor.hard + 1e-6, "xa nhất " + max.toFixed(2) + " > " + anchor.hard);
  assert.ok(max > A1.r + 5, "có đuổi ra khỏi vòng (kiểm tiền đề): " + max.toFixed(2));
});
t("dây cứng giữ cả khi lính né lùi (evadeT) và khi lực sĩ lao húc (chargeT) sát mép dây", () => {
  for (const mode of ["evade", "charge"]) {
    const { ctx, hero, crowd } = world(); hero.x = A1.x + 5;
    const a = gar(crowd, anchor.hard - 0.4, { kit: "NG_TANK" });
    if (mode === "evade") { a.evadeT = 0.3; a.evadeX = 1; a.evadeZ = 0; } else { a.chargeT = 0.9; a.chargeX = 1; a.chargeZ = 0; }
    let max = 0; run(ctx, crowd, 0.4, () => { max = Math.max(max, distTo(a)); });
    assert.ok(max <= anchor.hard + 1e-6, mode + ": " + max.toFixed(2));
  }
});
t("neo không có dây (như đoàn thuyền B20): vẫn đuổi tướng như cũ, không bị cắt", () => {
  const { ctx, hero, crowd } = world(); hero.x = A1.x + 33;
  const a = crowd.spawn({ side: "dich", unit: "KHIEN_NG", kit: "NG_DAO", role: "garrison", src: "x", x: A1.x + 15, z: A1.z, anchor: { x: anchor.x, z: anchor.z, r: A1.r } });
  run(ctx, crowd, 10);
  assert.ok(distTo(a) > anchor.hard + 3, "đuổi xa hơn dây: " + distTo(a).toFixed(2));
});
t("vỡ trận (sĩ quan trấn thủ ngã → crowd.rout): lính đồn trú rút về đồn, không chạy ra xa như trước (tướng đứng giữa đồn)", () => {
  const { ctx, hero, crowd } = world(); hero.x = A1.x; hero.z = A1.z;       // chạy ngược khỏi tướng = chạy RA khỏi đồn (hành vi cũ)
  const list = [gar(crowd, 8), gar(crowd, 12), gar(crowd, 16)]; let max = 0, fleeing = 0;
  assert.equal(crowd.rout(A1.x, A1.z, AI.rout.officerR), 3, "tiền đề: cả ba bị vỡ trận");
  run(ctx, crowd, 2.4, () => { for (const a of list) if (a.fleeT > 0) { fleeing++; max = Math.max(max, distTo(a)); } });
  assert.ok(fleeing > 100, "đang bỏ chạy phần lớn thời gian: " + fleeing);
  assert.ok(max <= 16 + 0.05, "không xa hơn chỗ đang đứng: " + max.toFixed(2));
  for (const a of list) assert.ok(distTo(a) < 12, "đang rút về vòng: " + distTo(a).toFixed(2));
});
t("lính thường (không neo) vỡ trận vẫn chạy ngược khỏi tướng", () => {
  const { ctx, hero, crowd } = world(); hero.x = 100; hero.z = 0;
  const a = crowd.spawn({ side: "dich", unit: "KHIEN_NG", kit: "NG_DAO", role: "zone", front: "A", x: 105, z: 0 });
  crowd.rout(100, 0, 22); run(ctx, crowd, 2);
  assert.ok(a.x > 110, "chạy ra xa tướng: " + a.x.toFixed(1));
});

console.log("Director: thẻ nhiệm vụ và con cuối");
const { Director } = await import("../js/battle/director.js");
const { createSim } = await import("../js/sim/front.js");

function dworld() {
  const { ctx, hero, crowd } = world();
  Object.assign(ctx, { hk: { tpc: false }, troops: { N: 200, r: 0.35 }, stats: { legionMult: 1, guardBase: 8, mods: { capSpeed: 0 } }, battle: { id: "B15" } });
  const sim = createSim({ fronts: FRONTS, bases: BASES, enemyMix: ENEMY_MIX, R: 1, earthworks: false });
  sim.bases.A1.keeperAlive = false; sim.heroFront = "A"; ctx.sim = sim;
  const wb = {}; for (const b of BASES) wb[b.id] = { x: 60 + (b.lineX ?? 0) * 500, z: b.front ? FRONTS[b.front].laneZ : 0, r: BASE_RING[b.type] };
  ctx.world.bases = wb; ctx.world.setBaseProgress = () => {}; ctx.world.setBaseOwner = () => {};
  const d = Object.create(Director.prototype);
  Object.assign(d, { ctx, phase: 0, keepers: {}, capT: {}, capPause: 0, zoneT: 0, time: 0, swingQ: new Map(), qBucket: 10, ko: 0, koMs: 0 }); ctx.director = d;
  return { ctx, hero, crowd, d, sim, wb };
}
t("tướng cách đồn 30 m (ngoài vòng, trong GARRISON.hintR) mà còn quân: thẻ có số, và nói còn mấy con ngoài đồn", () => {
  const { ctx, hero, crowd, d, wb } = dworld();
  hero.x = wb.A1.x - 30; hero.z = wb.A1.z;
  const mk = (dd) => crowd.spawn({ side: "dich", unit: "KHIEN_NG", role: "garrison", src: "A1", x: wb.A1.x + dd, z: wb.A1.z, anchor: { x: wb.A1.x, z: wb.A1.z, r: wb.A1.r } });
  for (let i = 0; i < 5; i++) mk(2 + i); mk(20); mk(24);
  d.updateBases(0.1);
  assert.match(d.baseHint, /^Hạ quân đồn trú: còn \d+ · 2 ngoài đồn$/, d.baseHint);
});
t("còn sĩ quan trấn thủ: thẻ nói 'Hạ <sĩ quan> trấn thủ' (chưa nói số quân) dù tướng đứng ngoài vòng", () => {
  const { hero, d, wb, sim } = dworld();
  sim.bases.A1.keeperAlive = true; hero.x = wb.A1.x - 30; hero.z = wb.A1.z;
  d.updateBases(0.1); assert.equal(d.baseHint, "Hạ Đội trưởng trấn thủ");
});
t("tướng ở xa hơn GARRISON.hintR: không có chữ nhắc (thẻ về mục tiêu của pha)", () => {
  const { ctx, hero, d, wb } = dworld();
  hero.x = wb.A1.x - (GARRISON.hintR + 5); hero.z = wb.A1.z;
  d.updateBases(0.1); assert.equal(d.baseHint, null);
});
t("blockers(): còn ≤ pointLast lính đồn trú thì chỉ con gần tướng nhất (kèm tên kiểu lính); đông hơn hoặc hết thì rỗng", () => {
  const { ctx, hero, crowd, d, wb, sim } = dworld();
  hero.x = wb.A1.x; hero.z = wb.A1.z; sim.bases.A1.G = 0;
  const mk = (dd, unit = "KHIEN_NG") => crowd.spawn({ side: "dich", unit, role: "garrison", src: "A1", x: wb.A1.x + dd, z: wb.A1.z, anchor: { x: wb.A1.x, z: wb.A1.z, r: wb.A1.r } });
  const near = mk(8), far = mk(30, "CUNGKY_NG");
  const b = d.blockers();
  assert.equal(b.length, 1); assert.ok(Math.abs(b[0].x - near.x) < 1e-9);
  assert.ok(b[0].label && typeof b[0].y === "number" && b[0].r > 0);
  for (let i = 0; i < GARRISON.pointLast; i++) mk(5 + i);
  assert.deepEqual(d.blockers(), [], "đông hơn pointLast: không chỉ");
  for (const a of [...crowd.agents]) crowd.release(a);
  assert.deepEqual(d.blockers(), []);
});
t("blockers(): kho G còn nhiều hơn số lính đang đứng thì chưa chỉ (sẽ có người ra thêm); G bằng số đang đứng — mỗi lần hạ một con G giảm một — đã là con cuối; Cứ Điểm về tay ta thì thôi", () => {
  const { ctx, hero, crowd, d, wb, sim } = dworld();
  hero.x = wb.A1.x; hero.z = wb.A1.z;
  const mk = (dd) => crowd.spawn({ side: "dich", unit: "KHIEN_NG", role: "garrison", src: "A1", x: wb.A1.x + dd, z: wb.A1.z, anchor: { x: wb.A1.x, z: wb.A1.z, r: wb.A1.r } });
  mk(8);
  sim.bases.A1.G = 3; assert.deepEqual(d.blockers(), [], "kho 3, trên bãi 1");
  sim.bases.A1.G = 1; assert.equal(d.blockers().length, 1, "G = 1 = số đang đứng: con cuối (bản trước đòi G < 1 nên không bao giờ hiện nhãn trong luồng thường)");
  sim.bases.A1.G = 0; assert.equal(d.blockers().length, 1);
  sim.bases.A1.owner = "ta"; assert.deepEqual(d.blockers(), []);
});
t("blockers(): chạy theo đúng luồng thường — hạ từng con bằng onSoldierKilled (G giảm cùng): nhãn hiện khi còn ≤ pointLast con", () => {
  const { ctx, hero, crowd, d, wb, sim } = dworld();
  hero.x = wb.A1.x; hero.z = wb.A1.z; sim.bases.A1.G = 8;
  const list = []; for (let i = 0; i < 8; i++) list.push(crowd.spawn({ side: "dich", unit: "KHIEN_NG", role: "garrison", src: "A1", x: wb.A1.x + 3 + i, z: wb.A1.z, anchor: { x: wb.A1.x, z: wb.A1.z, r: wb.A1.r } }));
  const seen = [];
  for (const a of list) { seen.push(d.blockers().length); crowd.kill(a, { by: "hero", swing: 1 }); }
  assert.deepEqual(seen, [0, 0, 1, 1, 1, 1, 1, 1].slice(0, 8), "8 → 7 con: chưa; từ 6 con trở xuống: có");
});
t("quân đồn trú B15 sinh ra có dây cứng (anchor.hard = vòng + GARRISON.hardLeash)", () => {
  const { ctx, hero, crowd, d, wb } = dworld();
  hero.x = wb.A1.x + 4; hero.z = wb.A1.z; d.updateZone(0.3);
  const gar = crowd.agents.filter((a) => a.role === "garrison" && a.src === "A1");
  assert.ok(gar.length > 5);
  for (const a of gar) assert.equal(a.anchor.hard, wb.A1.r + GARRISON.hardLeash);
});

console.log(`\n${pass} đạt, ${fail} trượt`);
process.exit(fail ? 1 : 0);
