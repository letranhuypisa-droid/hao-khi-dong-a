// tests/supply.test.mjs — đợt 12c: "cửa ngõ" của mỗi cánh (doanh trại A2 / B2) là nguồn viện binh của cánh đó.
//   còn của địch → quân mới xuất ra TỪ cửa ngõ rồi hành quân tới tuyến (không còn mọc cạnh tướng); hồi quân, đợt tiếp viện chạy như cũ
//   về tay ta (tướng chiếm, hoặc cánh địch vỡ trận) → hết hồi quân, hết đợt tiếp viện, hết bổ sung lính ở tuyến: quân còn lại chỉ vơi đi
// (1) dữ liệu + sim/front.js (thuần): supplyOpen, hồi quân, đợt tiếp viện; mã băm vàng chứng minh đường mặc định (cửa ngõ chưa đóng) giữ nguyên từng byte
// (2) battle/supply.js (thuần): chỗ xuất quân, kế hoạch bổ sung (trần quân đang đi đường, nhịp, tướng chặn đường)
// (3) Director.fillActors / updateZone trên Crowd thật (Node, không WebGL), crowd.updateActor hành quân
//   node hao-khi-viet/game/tests/supply.test.mjs
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const threeUrl = pathToFileURL(join(here, "../vendor/three/three.module.js")).href;
registerHooks({ resolve: (s, c, next) => (s === "three" ? { url: threeUrl, shortCircuit: true } : next(s, c)) });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => new Proxy({}, { get: (o, k) => (k in o ? o[k] : () => ({ width: 0 })), set: (o, k, v) => ((o[k] = v), true) }) }) };

const B = await import("../js/data/battle-b15.js");
const { createSim, simTick, snapshot, issueOrder, totalQ, supplyOpen } = await import("../js/sim/front.js");
const { SUPPLY, SIM, ZONE } = await import("../js/data/tuning.js");
const { doorSpawnPoint, planRefill, transitCap, tickCap, lineWant } = await import("../js/battle/supply.js");
const { frontRowHTML } = await import("../js/battle/hud.js");

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log("  ok  " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + (e.stack || e.message)); }
}
const mk = (o = {}) => createSim({ fronts: B.FRONTS, bases: B.BASES, enemyMix: B.ENEMY_MIX, R: 1, earthworks: false, ...o });
const run = (st, n) => { for (let i = 0; i < n; i++) simTick(st); };
const capture = (st, id) => { st.bases[id].owner = "ta"; };

console.log("Dữ liệu");
t("mỗi cánh khai cửa ngõ là doanh trại của chính cánh đó, đang của địch", () => {
  assert.equal(B.FRONTS.A.door, "A2"); assert.equal(B.FRONTS.B.door, "B2");
  for (const F of Object.values(B.FRONTS)) {
    const b = B.BASES.find((x) => x.id === F.door);
    assert.ok(b && b.type === "doanh_trai" && b.front === F.id && b.owner === "dich", F.id);
  }
});

console.log("sim/front.js — supplyOpen, hồi quân, đợt tiếp viện");
t("supplyOpen: cánh còn viện binh khi cửa ngõ của địch; về tay ta thì đóng, riêng từng cánh", () => {
  const st = mk();
  assert.equal(supplyOpen(st, "A"), true); assert.equal(supplyOpen(st, "B"), true);
  capture(st, "A2");
  assert.equal(supplyOpen(st, "A"), false); assert.equal(supplyOpen(st, "B"), true);
  capture(st, "B2"); assert.equal(supplyOpen(st, "B"), false);
});
t("supplyOpen: trận không khai cửa ngõ (hoặc id lạ) coi như mở — hành vi cũ", () => {
  const fr = { A: { ...B.FRONTS.A, door: undefined }, B: { ...B.FRONTS.B, door: "ZZ" } };
  const st = mk({ fronts: fr });
  assert.equal(supplyOpen(st, "A"), true); assert.equal(supplyOpen(st, "B"), true);
});
t("hồi quân địch: cửa ngõ mở thì hồi như cũ (Hàm Tử quan + doanh trại = hệ số 2); đóng thì KHÔNG hồi", () => {
  const calm = (st) => { st.fronts.A.q.ta = { GIAO_DV: 0 }; for (const u in st.fronts.A.q.dich) st.fronts.A.q.dich[u] *= 0.5; };   // ta hết quân: địch không tổn thất, chỉ còn hồi quân
  const open = mk(), shut = mk(); capture(shut, "A2"); calm(open); calm(shut);
  const q0 = totalQ(open.fronts.A, "dich"), q1 = totalQ(shut.fronts.A, "dich");
  run(open, 30); run(shut, 30);
  const regen = SIM.REGEN * open.fronts.A.q0.dich * 2 * 30;
  assert.ok(Math.abs(totalQ(open.fronts.A, "dich") - q0 - regen) < 0.5, "mở: +" + (totalQ(open.fronts.A, "dich") - q0).toFixed(2) + " ≈ " + regen.toFixed(2));
  assert.ok(Math.abs(totalQ(shut.fronts.A, "dich") - q1) < 1e-9, "đóng: không hồi");
});
t("đợt tiếp viện +100 mỗi 120 s: cửa ngõ A đóng thì cánh A hết đợt, cánh B (cửa còn mở) vẫn có", () => {
  const st = mk(); capture(st, "A2"); run(st, SIM.enemyReinf.every * 2 + 1);
  assert.equal(st.fronts.A.waves, 0); assert.equal(st.fronts.B.waves, 2);
});
t("đóng cửa ngõ không đụng gì khác của sim: cùng chuỗi tick, riêng cánh B giữ nguyên từng byte với sim chưa đóng cửa A", () => {
  const a = mk(), b = mk(); capture(b, "A2");
  run(a, 200); run(b, 200);
  assert.equal(JSON.stringify(a.fronts.B), JSON.stringify(b.fronts.B));
});
// Mã băm vàng đo lúc BASES còn số cũ của đợt 9 (A1 G 110, cổng 8000, G cổng 30): đợt 12 chỉnh lại các số đó (battle-b15.js) nhưng cách mô phỏng chạy không đổi.
const OLD = B.BASES.map((b) => (b.id === "A1" ? { ...b, G: 110 } : b.type === "cong" ? { ...b, gate: 8000, G: 30 } : b));
const GOLD = { false: ["0bd319ddf0", "9e7550bec4", "7da5dc1da5", "5bd8cd1cb0", "d8cbce9778"], true: ["3830dc861e", "60fd3858f0", "e32af348d9", "571689adc4", "50aa13c678"] };
for (const ew of [false, true]) {
  t(`mã băm vàng (trước đợt 12), earthworks=${ew}: cửa ngõ còn mở thì mô phỏng 600 s y hệt từng byte`, () => {
    const s = mk({ earthworks: ew, bases: OLD }), out = [];
    for (let i = 1; i <= 600; i++) {
      if (i === 40) issueOrder(s, "B", "tiencong"); if (i === 90) issueOrder(s, "A", "tiepvien");
      simTick(s);
      if (i % 120 === 0) out.push(createHash("sha1").update(JSON.stringify(snapshot(s), (k, v) => (k === "door" ? undefined : v))).digest("hex").slice(0, 10));
    }
    assert.deepEqual(out, GOLD[ew]);
  });
}

console.log("battle/supply.js — chỗ xuất quân và kế hoạch bổ sung");
const A2 = { x: 335, z: -75, r: B.BASE_RING.doanh_trai };
t("doorSpawnPoint: sau lưng doanh trại (phía đông) cách tâm r + SUPPLY.behind, giữa làn", () => {
  const S = doorSpawnPoint(B.FRONTS.A, A2);
  assert.ok(Math.abs(S.x - (A2.x + A2.r + SUPPLY.behind)) < 1e-9); assert.equal(S.z, B.FRONTS.A.laneZ);
  assert.ok(S.x > A2.x + A2.r, "ngoài vòng, sau lưng");
});
t("doorSpawnPoint: tuyến bị đẩy vượt cửa ngõ (Tổng Phản Công khi doanh trại còn của địch) thì chỗ xuất quân lùi ra sau tuyến, không mọc phía sau lưng quân ta", () => {
  const base = doorSpawnPoint(B.FRONTS.A, A2, B.lineToX(B.FRONTS.A, 0.2));
  assert.equal(base.x, A2.x + A2.r + SUPPLY.behind, "tuyến ở chỗ thường: không đổi");
  const jumped = doorSpawnPoint(B.FRONTS.A, A2, B.lineToX(B.FRONTS.A, 0.77));
  assert.ok(jumped.x >= B.lineToX(B.FRONTS.A, 0.77) + SUPPLY.lineGap, "sau tuyến " + jumped.x);
});
t("planRefill: số lính cần bù = thiếu ở tuyến, trần quân đang đi đường, nhịp mỗi lần", () => {
  const base = { open: true, blocked: false, want: 50, arrived: 40, moving: 0, transitMax: 36, perTick: 4 };
  assert.equal(planRefill(base), 4, "bị nhịp cắt");
  assert.equal(planRefill({ ...base, arrived: 48 }), 2, "chỉ thiếu 2");
  assert.equal(planRefill({ ...base, moving: 34 }), 2, "trần quân đi đường 36");
  assert.equal(planRefill({ ...base, moving: 36 }), 0);
  assert.equal(planRefill({ ...base, arrived: 55 }), 0, "đã đủ");
});
t("planRefill: cửa đóng hoặc tướng đứng chặn chỗ xuất quân thì không bù", () => {
  const base = { open: true, blocked: false, want: 50, arrived: 10, moving: 0, transitMax: 36, perTick: 4 };
  assert.equal(planRefill({ ...base, open: false }), 0);
  assert.equal(planRefill({ ...base, blocked: true }), 0);
});
t("mức Số lính: trần đi đường và nhịp xuất không thấp hơn mức Vừa (mức Thấp không được cạn viện binh sớm hơn), cao hơn thì tăng theo; Tổng Phản Công (r × 2) cũng vậy", () => {
  assert.equal(transitCap(0.2), SUPPLY.transitMax); assert.equal(transitCap(0.35), SUPPLY.transitMax); assert.ok(transitCap(1.0) > 2.5 * SUPPLY.transitMax);
  assert.equal(tickCap(0.2), SUPPLY.perTick); assert.equal(tickCap(0.35), SUPPLY.perTick); assert.ok(tickCap(1.0) >= 2.5 * SUPPLY.perTick);
  assert.ok(transitCap(0.7) > transitCap(0.35));
});
t("lineWant: cánh có tướng giữ tối thiểu SUPPLY.lineFloor lính ở tuyến ở mọi mức (vùng chiến đấu lấy địch từ tuyến nên mức Thấp không được chỉ còn 17)", () => {
  assert.ok(SUPPLY.lineFloor >= ZONE.enemies);
  assert.equal(lineWant(17, true), SUPPLY.lineFloor); assert.equal(lineWant(17, false), 17); assert.equal(lineWant(120, true), 120);
});
t("số cân bằng: trần quân đi đường không quá nửa tuyến, hành quân nhanh hơn đi bộ nhưng không vượt tướng chạy", () => {
  assert.ok(SUPPLY.transitMax > 0 && SUPPLY.perTick >= 1 && SUPPLY.behind >= 10 && SUPPLY.minDist >= 40);
  assert.ok(SUPPLY.marchMult > 1 && SUPPLY.marchMax > 3.1 && SUPPLY.marchMax <= 7.5, "marchMax " + SUPPLY.marchMax);
});

console.log("Director trên Crowd thật (Node)");
const { Crowd } = await import("../js/battle/crowd.js");
const { Director } = await import("../js/battle/director.js");
const { makeRng } = await import("../js/core/rng.js");
const { DIFFICULTY } = await import("../js/data/tuning.js");
const THREE = await import(threeUrl);

function world(o = {}) {
  const troops = o.troops || { N: 200, r: 0.35 };
  const hero = { x: 150, z: -75, y: 0, alive: true, hp: 1e6, maxHp: 1e6, state: "free", yaw: Math.PI / 2, giap: 50, move: "N1", st: 0, dur: 1, swingId: 0, receiveHit() {}, ...(o.hero || {}) };
  const ctx = { R: 1, rng: makeRng(5), diff: DIFFICULTY[1], hero, units: [], clock: 0, openGates: {}, world: { colliders: [], gates: {}, bases: {} }, fx: null, audio: { play() {} },
    hk: { tpc: false }, troops, stats: { legionMult: 1, guardBase: 8, mods: {} }, battle: { id: "B15" } };
  ctx.crowd = new Crowd(new THREE.Scene(), ctx);
  const sim = mk(); sim.heroFront = "A"; ctx.sim = sim;
  const wb = {}; for (const b of B.BASES) wb[b.id] = { x: B.lineToX(B.FRONTS[b.front] || { x0: 0, x1: 0 }, b.lineX ?? 0), z: b.front ? B.FRONTS[b.front].laneZ : 0, r: B.BASE_RING[b.type] };
  ctx.world.bases = wb; ctx.world.setBaseProgress = () => {}; ctx.world.setBaseOwner = () => {};
  const d = Object.create(Director.prototype);
  Object.assign(d, { ctx, phase: 0, keepers: {}, capT: {}, capPause: 0, zoneT: 0, time: 0, swingQ: new Map(), qBucket: 10, ko: 0, koMs: 0, prevQ: {}, actorLossAcc: {} }); ctx.director = d;
  return { ctx, hero, crowd: ctx.crowd, d, sim, wb };
}
const enemyActors = (crowd, fid) => crowd.agents.filter((a) => a.side === "dich" && a.role === "actor" && a.front === fid);

t("đầu trận (instant): tuyến được dựng đủ tại chỗ như cũ, không ai hành quân", () => {
  const { d, crowd } = world(); d.fillActors(true);
  const act = enemyActors(crowd, "A");
  assert.ok(act.length > 30); assert.ok(act.every((a) => !a.march));
});
t("cửa ngõ mở: lính bổ sung xuất hiện ở chỗ xuất quân sau doanh trại (không mọc cạnh tuyến / cạnh tướng), có cờ hành quân, mỗi nhịp ≤ perTick", () => {
  const { d, crowd, wb } = world(); d.fillActors(true);
  for (const a of enemyActors(crowd, "A").slice(0, 20)) crowd.release(a);        // 20 người ngã / bị chuyển thành lính thật
  const before = new Set(enemyActors(crowd, "A")); d.fillActors(false);
  const news = enemyActors(crowd, "A").filter((a) => !before.has(a));
  assert.equal(news.length, SUPPLY.perTick, "bị nhịp cắt");
  const S = doorSpawnPoint(B.FRONTS.A, wb.A2);
  for (const a of news) { assert.ok(a.march, "hành quân"); assert.ok(Math.hypot(a.x - S.x, a.z - S.z) < 40, `xuất ở ${a.x.toFixed(0)},${a.z.toFixed(0)} cách S ${Math.hypot(a.x - S.x, a.z - S.z).toFixed(0)} m`); assert.ok(a.x > wb.A2.x, "sau doanh trại"); }
});
t("lính đang hành quân không chiếm chỗ của đội hình: đứng chờ ở bãi tập kết sau cùng, hàng đầu không bị giữ chỗ trống suốt đường đi", () => {
  const { d, crowd } = world(); d.fillActors(true);
  for (const a of enemyActors(crowd, "A").slice(0, 20)) crowd.release(a);
  d.fillActors(false);
  const all = enemyActors(crowd, "A"), marching = all.filter((a) => a.march), line = all.filter((a) => !a.march);
  assert.ok(marching.length > 0 && line.length > 0);
  const lineMaxSx = Math.max(...line.map((a) => a.sx));
  for (const a of marching) { assert.equal(a.slot, undefined); assert.equal(a.frontRow, false); assert.ok(a.sx > lineMaxSx, `bãi tập kết sau cùng: ${a.sx.toFixed(1)} > ${lineMaxSx.toFixed(1)}`); }
});
t("lính hành quân không bị sim 'chém ngã' (killActor chỉ chọn hàng đầu đang đứng ở tuyến)", () => {
  const { d, crowd } = world(); d.fillActors(true);
  for (const a of enemyActors(crowd, "A").slice(0, 20)) crowd.release(a);
  d.fillActors(false);
  const marching = enemyActors(crowd, "A").filter((a) => a.march);
  for (let i = 0; i < 60; i++) d.killActor("A", "dich");
  assert.ok(marching.every((a) => a.state !== "dead"));
});
t("trần quân đang đi đường: đủ SUPPLY.transitMax người hành quân thì thôi bổ sung dù tuyến còn thiếu", () => {
  const { d, crowd } = world(); d.fillActors(true);
  for (const a of enemyActors(crowd, "A").slice(0, 45)) crowd.release(a);
  for (let i = 0; i < 40; i++) d.fillActors(false);
  const moving = enemyActors(crowd, "A").filter((a) => a.march).length;
  assert.ok(moving <= SUPPLY.transitMax * 1.001 && moving > SUPPLY.transitMax * 0.7, "đang đi đường " + moving);
});
t("cửa ngõ ĐÓNG (A2 về tay ta): không bổ sung một lính nào ở cánh A; cánh B (cửa còn mở) vẫn bổ sung", () => {
  const { d, crowd, sim } = world(); d.fillActors(true);
  sim.bases.A2.owner = "ta";
  for (const a of enemyActors(crowd, "A").slice(0, 20)) crowd.release(a);
  for (const a of enemyActors(crowd, "B").slice(0, 10)) crowd.release(a);
  const nA = enemyActors(crowd, "A").length, nB = enemyActors(crowd, "B").length;
  for (let i = 0; i < 10; i++) d.fillActors(false);
  assert.equal(enemyActors(crowd, "A").length, nA, "cánh A không thêm");
  assert.ok(enemyActors(crowd, "B").length > nB, "cánh B vẫn thêm");
});
t("cửa ngõ đóng mà dựng lại tuyến tức thì (tải lại điểm lưu): vẫn dựng đủ tại chỗ như cũ", () => {
  const { d, crowd, sim } = world(); sim.bases.A2.owner = "ta"; d.fillActors(true);
  assert.ok(enemyActors(crowd, "A").length > 30);
});
t("lính hành quân là cung kỵ (đi bộ 5,2 m/s × 1,6) vẫn không quá SUPPLY.marchMax — không phóng nhanh hơn tướng chạy", () => {
  const { crowd } = world();
  const a = crowd.spawn({ side: "dich", unit: "CUNGKY_NG", role: "actor", front: "A", x: 400, z: -75, sx: 100, sz: -75 }); a.march = true;
  let maxSp = 0; for (let i = 0; i < 30; i++) { const px = a.x; crowd.updateActor(a, 1 / 30); maxSp = Math.max(maxSp, Math.abs(px - a.x) * 30); }
  assert.ok(a.speed * SUPPLY.marchMult > SUPPLY.marchMax, "tiền đề: nếu không cắt thì vượt (" + (a.speed * SUPPLY.marchMult).toFixed(1) + ")");
  assert.ok(maxSp <= SUPPLY.marchMax + 0.01, "tốc độ " + maxSp.toFixed(2));
});
t("vị trí bãi tập kết của lính hành quân ổn định: một lính khác hết đường / bị bỏ đi không làm cả cột đổi chỗ (trước đây theo thứ tự mảng, 70% lính-giây bị đổi đích)", () => {
  const { d, crowd } = world(); d.fillActors(true);
  for (const a of enemyActors(crowd, "A").slice(0, 30)) crowd.release(a);
  for (let i = 0; i < 6; i++) d.fillActors(false);
  const march = enemyActors(crowd, "A").filter((a) => a.march), before = new Map(march.map((a) => [a, [a.sx, a.sz]]));
  assert.ok(march.length >= 12);
  crowd.release(march[0]); d.fillActors(false);
  for (const a of march.slice(1)) assert.deepEqual([a.sx, a.sz], before.get(a), "lính " + a.id);
});
t("thu bớt: số lính cần ở tuyến giảm (đổi mức Số lính) thì lính đã ở tuyến thừa bị bớt, lính đang hành quân giữ nguyên", () => {
  const { d, crowd, ctx } = world(); d.fillActors(true);
  const B0 = enemyActors(crowd, "B"); for (const a of B0.slice(0, 3)) a.march = true;
  const marching = new Set(B0.slice(0, 3));
  ctx.troops = { N: 100, r: 0.2 }; d.fillActors(false);
  const left = enemyActors(crowd, "B");
  assert.ok(left.filter((a) => !a.march).length <= Math.round((100 - 50) * 0.16), "tuyến B còn " + left.filter((a) => !a.march).length);
  for (const a of marching) assert.ok(left.includes(a), "lính hành quân còn đó");
});
t("tướng đứng sát chỗ xuất quân (< SUPPLY.minDist): chờ, không xuất lính ngay cạnh tướng", () => {
  const { d, crowd, hero, wb } = world(); d.fillActors(true);
  const S = doorSpawnPoint(B.FRONTS.A, wb.A2); hero.x = S.x - 10; hero.z = S.z;
  for (const a of enemyActors(crowd, "A").slice(0, 20)) crowd.release(a);
  const n = enemyActors(crowd, "A").length; d.fillActors(false);
  assert.equal(enemyActors(crowd, "A").length, n);
  hero.x = S.x - SUPPLY.minDist - 5; d.fillActors(false);
  assert.ok(enemyActors(crowd, "A").length > n);
});
t("quân ta (bên không có cửa ngõ) bổ sung như cũ: mọc sau tuyến ta 18 m, không hành quân", () => {
  const { d, crowd } = world(); d.fillActors(true);
  const mine = () => crowd.agents.filter((a) => a.side === "ta" && a.role === "actor" && a.front === "A");
  for (const a of mine().slice(0, 10)) crowd.release(a);
  const n = mine().length; d.fillActors(false);
  assert.ok(mine().length > n); assert.ok(mine().every((a) => !a.march));
});
t("không còn khối quân mọc cạnh tướng: updateZone (bước 3) không sinh địch ở hero.x + 10…22 m nữa", () => {
  const { d, crowd, ctx, hero, sim } = world(); d.fillActors(true);
  for (const a of [...crowd.agents]) if (a.side === "dich" && a.role === "actor") crowd.release(a);            // tuyến trống, Q còn ~1200
  hero.x = 150; hero.z = -75; sim.heroFront = "A";                                                             // sát khối quân (dMass < 22), cách A1 60 m (chưa sinh quân đồn trú)
  d.updateZone(0.3);
  assert.equal(crowd.agents.filter((a) => a.side === "dich" && a.role === "zone").length, 0);
});

t("cánh ta vỡ trận làm doanh trại cửa ngõ về tay địch (cửa mở lại): có báo trên tin nhắn, không chỉ đổi chữ bảng", () => {
  const { d, ctx } = world(); d.hk = () => 0; d.prevQ = { A: { ta: 0, dich: 0 }, B: { ta: 0, dich: 0 } }; d.actorLossAcc = { A: { ta: 0, dich: 0 }, B: { ta: 0, dich: 0 } };
  d.msgs = []; ctx.sim.bases.A2.owner = "dich";
  d.onSimTick([{ type: "baseFlip", id: "A2", owner: "dich", by: "collapse" }]);
  assert.ok(d.msgs.some((m) => /Cửa ngõ A mở lại/.test(m.text)), JSON.stringify(d.msgs.map((m) => m.text)));
  d.msgs = []; d.onSimTick([{ type: "baseFlip", id: "A1", owner: "dich", by: "sim" }]);
  assert.ok(!d.msgs.some((m) => /mở lại/.test(m.text)), "đồn thường mất thì không nói cửa ngõ");
});
t("chiếm doanh trại cửa ngõ: băng chữ + tin nhắn 'hết viện binh' (và không có khi chiếm đồn thường)", () => {
  const { d, ctx } = world(); d.hk = () => 0; d.msgs = []; d.drop = () => {}; d.keSach = { onBaseTaken() {} }; d.main = [false, false, false, false]; d.phase = 3; d.side = {}; d.banner = (t) => (d.banners = (d.banners || []).concat(t));
  ctx.hero.heal = () => {}; ctx.sim.bases.A2.owner = "ta"; d.onBaseTaken("A2", "sim");
  assert.ok(d.banners.some((t) => /CỬA NGÕ A ĐÓNG/.test(t))); assert.ok(d.msgs.some((m) => /hết viện binh/.test(m.text)));
  d.banners = []; d.msgs = []; ctx.sim.bases.A1.owner = "ta"; d.onBaseTaken("A1", "sim");
  assert.ok(!(d.banners || []).some((t) => /CỬA NGÕ/.test(t)));
});
t("cung kỵ thật đang lùi: crowd.update đặt a.kiting (gợi ý Cung kỵ đọc cờ này), và xoá khi bị đánh trúng / choáng (không để cờ cũ)", () => {
  const { ctx, crowd, hero } = world(); hero.x = 200; hero.z = 0;
  const a = crowd.spawn({ side: "dich", unit: "CUNGKY_NG", role: "zone", front: "A", x: 204, z: 0 });
  ctx.clock += 1 / 30; crowd.update(1 / 30); assert.equal(a.kiting, true, "áp sát 4 m (< 8): lùi giữ tầm");
  a.stun = 1; ctx.clock += 1 / 30; crowd.update(1 / 30); assert.equal(a.kiting, false, "choáng: không lùi");
});
console.log("Vùng chiến đấu theo mức Số lính (canon: quyết định #8, kết quả không đổi theo cấu hình)");
function zoneLevel(troops, kps, secs = 40) {
  const { d, ctx, crowd, hero } = world({ troops }); d.fillActors(true); d.hk = () => 0;       // mốc KO cộng Hào Khí: không cần ở đây
  const real = []; let i = 0;
  for (let step = 0; step < secs * 4; step++) {
    ctx.clock += 0.25; crowd.update(0.25); d.zoneT = 0; d.updateZone(0.25);
    if (step % 4 === 3) d.fillActors(false);
    if (step % 4 === 3) for (let k = 0; k < kps; k++) {
      let best = null, bd = 1e9; for (const a of crowd.agents) if (a.side === "dich" && crowd.hittable(a)) { const dd = Math.hypot(a.x - hero.x, a.z - hero.z); if (dd < bd) { bd = dd; best = a; } }
      if (best) crowd.kill(best, { by: "hero", swing: ++i });
    }
    if (step >= 40) real.push(crowd.agents.filter((a) => a.side === "dich" && crowd.hittable(a) && Math.hypot(a.x - hero.x, a.z - hero.z) < 45).length);
  }
  return real.reduce((x, y) => x + y, 0) / real.length;
}
const LEVELS = [["thấp", { N: 100, r: 0.2 }], ["vừa", { N: 200, r: 0.35 }], ["cao", { N: 400, r: 0.6 }], ["rất cao", { N: 800, r: 1.0 }]];
t("hạ 1 lính/s ở đầu tuyến 40 s: địch thật quanh tướng ≥ 22 ở MỌI mức Số lính, và mức Thấp sát mức Vừa (bản trước: Thấp còn ~2)", () => {
  const avg = Object.fromEntries(LEVELS.map(([n, tr]) => [n, zoneLevel(tr, 1)]));
  console.log("       địch thật quanh tướng (trung bình, 1 lính/s):", JSON.stringify(Object.fromEntries(Object.entries(avg).map(([k, v]) => [k, Math.round(v * 10) / 10]))));
  for (const [n, v] of Object.entries(avg)) assert.ok(v >= 22, `mức ${n}: ${v.toFixed(1)}`);
  assert.ok(Math.abs(avg["thấp"] - avg["vừa"]) <= 5, `thấp ${avg["thấp"].toFixed(1)} vs vừa ${avg["vừa"].toFixed(1)}`);
});
console.log("crowd.updateActor — hành quân");
t("lính hành quân đi nhanh hơn đi bộ nhưng không quá SUPPLY.marchMax; tới nơi (≤ SUPPLY.arrive) thì hết cờ và đi bộ như thường", () => {
  const { ctx, crowd } = world();
  const mkA = (march) => { const a = crowd.spawn({ side: "dich", unit: "KHIEN_NG", kit: "NG_DAO", role: "actor", front: "A", x: 400, z: -75, sx: 300, sz: -75 }); a.march = march; return a; };
  const walker = mkA(false), marcher = mkA(true); let maxSp = 0;
  for (let i = 0; i < 30; i++) { const px = marcher.x; crowd.updateActor(marcher, 1 / 30); maxSp = Math.max(maxSp, Math.abs(px - marcher.x) * 30); crowd.updateActor(walker, 1 / 30); }
  assert.ok(marcher.x < walker.x - 1, "đi trước: " + (walker.x - marcher.x).toFixed(1)); assert.ok(maxSp <= SUPPLY.marchMax + 0.01, "tốc độ " + maxSp.toFixed(2));
  marcher.x = 300 + SUPPLY.arrive - 0.5; crowd.updateActor(marcher, 1 / 30); assert.equal(marcher.march, false);
});

console.log("HUD — bảng mặt trận");
t("frontRowHTML ghi cửa ngõ mở / đóng của cánh", () => {
  const st = mk(), f = (id, sim) => frontRowHTML(B.FRONTS[id], sim.fronts[id], sim);
  assert.match(f("A", st), /cửa[^<]*mở/i);
  capture(st, "A2"); assert.match(f("A", st), /cửa[^<]*đóng/i); assert.match(f("B", st), /cửa[^<]*mở/i);
  assert.ok(f("A", st).length < 420, "ngắn gọn để hàng bảng không xuống dòng");
});

console.log(`\n${pass} đạt, ${fail} trượt`);
process.exit(fail ? 1 : 0);
