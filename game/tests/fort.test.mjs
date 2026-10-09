// tests/fort.test.mjs — đồn có tường và hai cổng (Cứ Điểm "don" ở B15): lính đồn trú hết xuyên cọc chạy ra ngoài, chỉ ra vào qua cổng trước (tây) và cổng sau (đông).
// (1) battle/fort.js (thuần): bố cục, vật va chạm cho ground.js collide (tường chặn, cổng lọt), fortRoute dẫn một bước đi qua cổng / vòng qua góc, đếm trong / ngoài (garrison.js).
// (2) Crowd thật trong Node: quân đồn trú sinh trong tường, đuổi tướng đứng ngoài thì ra bằng cổng; tướng đứng trong đồn thì chỉ ở trong; sĩ quan trấn thủ (BigUnit) cũng vậy.
//   node game/tests/fort.test.mjs
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const threeUrl = pathToFileURL(join(here, "../vendor/three/three.module.js")).href;
registerHooks({ resolve: (s, c, next) => (s === "three" ? { url: threeUrl, shortCircuit: true } : next(s, c)) });

globalThis.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => new Proxy({}, { get: (o, k) => (k in o ? o[k] : () => ({ width: 0 })), set: (o, k, v) => ((o[k] = v), true) }) }) };

const F = await import("../js/battle/fort.js");
const G = await import("../js/battle/ground.js");
const { classifyGarrison } = await import("../js/battle/garrison.js");
const { FORT, BASES, FRONTS, lineToX, BASE_RING } = await import("../js/data/battle-b15.js");
const B15 = (await import("../js/battles/b15.js")).default;

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log("  ok  " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + (e.stack || e.message).split("\n").slice(0, 4).join("\n       ")); }
}

// A1 như data/battle-b15.js: mặt trận A, lineX 0,30 → x = 60 + 0,30 × 500 = 210, z = −75
const A1 = BASES.find((b) => b.id === "A1"), fa = FRONTS[A1.front], cx = lineToX(fa, A1.lineX), cz = fa.laneZ;
const L = F.fortLayout("A1", cx, cz, FORT.don), forts = [L];
const world = { colliders: F.fortColliders(L), gates: {} };

// một lính (bán kính 0,4) đi thẳng tới đích mỗi bước 1/60 s, tốc độ v, va chạm như crowd.js; route: có theo fortRoute không
function walk(from, to, { route = true, v = 3, r = 0.4, maxSteps = 6000 } = {}) {
  let [x, z] = from, steps = 0, inGate = false;
  const path = [[x, z]];
  for (; steps < maxSteps; steps++) {
    if (Math.hypot(to[0] - x, to[1] - z) < 0.6) break;
    const w = route ? F.fortRoute(forts, x, z, to[0], to[1]) : null, tx = w ? w.x : to[0], tz = w ? w.z : to[1];
    const d = Math.hypot(tx - x, tz - z) || 1e-6, k = Math.min(1, d / (v / 60));
    [x, z] = G.collide(world, x + (tx - x) / d * v / 60 * k, z + (tz - z) / d * v / 60 * k, r, {});
    if (steps % 6 === 0) path.push([x, z]);
  }
  return { x, z, steps, ok: Math.hypot(to[0] - x, to[1] - z) < 0.6, path };
}
const crossesWall = (path) => {                       // một vòng giữa hai điểm liên tiếp có đi từ trong ra ngoài (hoặc ngược) không qua cổng
  let bad = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    if (F.insideFort(L, a[0], a[1]) === F.insideFort(L, b[0], b[1])) continue;
    const g = L.gates.find((q) => Math.abs(q.x - (a[0] + b[0]) / 2) < L.wall + 0.8);
    if (!g || Math.abs((a[1] + b[1]) / 2 - L.cz) > L.gate / 2) bad++;
  }
  return bad;
};

console.log("Bố cục");
t("tâm đồn A1 (210, −75): tường hình chữ nhật tim (cx ± 13,4, cz ± 11,9), hai cổng trên tim đường — trước phía tây, sau phía đông", () => {
  assert.ok(Math.abs(cx - 210) < 1e-9 && Math.abs(cz + 75) < 1e-9);
  assert.ok(Math.abs(L.wx - 13.4) < 1e-9 && Math.abs(L.wz - 11.9) < 1e-9);
  assert.deepEqual(L.gates.map((g) => [g.side, g.x, g.z]), [[-1, cx - L.wx, cz], [1, cx + L.wx, cz]]);
  assert.equal(L.segs.length, 6);
});
t("vòng chiếm (bán kính BASE_RING.don) lọt trong tường với chỗ chừa cho lính", () => {
  assert.ok(BASE_RING.don + 1 <= FORT.don.hh && BASE_RING.don + 1 <= FORT.don.hw);
});
t("tường khớp quanh cổng: hai đoạn tường mỗi phía tây / đông kết thúc cách tim cổng đúng nửa bề rộng cổng", () => {
  for (const s of L.segs.filter((q) => q.side === "W" || q.side === "E")) {
    const near = Math.min(Math.abs(s.z0 - cz), Math.abs(s.z1 - cz));
    assert.ok(Math.abs(near - L.gate / 2) < 1e-9);
  }
});

console.log("Va chạm (ground.js collide)");
t("lính đi thẳng từ giữa đồn ra bắc, nam, tây, đông (không trúng cổng): bị tường chặn, không ra khỏi tường", () => {
  for (const [to, inside] of [[[cx, cz - 40], (p) => p[1] > cz - L.wz], [[cx, cz + 40], (p) => p[1] < cz + L.wz], [[cx - 40, cz + 8], (p) => p[0] > cx - L.wx], [[cx + 40, cz - 8], (p) => p[0] < cx + L.wx]]) {
    const from = to[0] === cx ? [cx, cz] : [cx, to[1]], r = walk(from, to, { route: false, maxSteps: 1500 });
    assert.ok(inside([r.x, r.z]), `ra khỏi tường ở ${r.x.toFixed(2)}, ${r.z.toFixed(2)}`);
  }
});
t("đi dọc tim đường qua cả hai cổng: từ 30 m phía tây tới 30 m phía đông", () => {
  const r = walk([cx - 30, cz], [cx + 30, cz], { route: false });
  assert.ok(r.ok, `kẹt ở ${r.x.toFixed(2)}, ${r.z.toFixed(2)}`);
});
t("cổng lọt lính (bán kính 0,4) lệch tim tới 2 m; tướng / sĩ quan (bán kính 0,5 / 0,7) lọt thẳng tim", () => {
  assert.ok(walk([cx - 20, cz + 2], [cx + 20, cz + 2], { route: false }).ok);
  for (const r of [0.5, 0.7]) assert.ok(walk([cx - 20, cz], [cx + 20, cz], { route: false, r }).ok, `bán kính ${r}`);
});
t("điểm bị đẩy từ trong tường ra phía nào thì ra phía đó (tường dày 1,8 m): không nhảy sang bên kia", () => {
  const [x, z] = G.collide(world, cx, cz - L.wz + 0.3, 0.4, {});
  assert.ok(z > cz - L.wz, "đứng ở mặt trong, bị đẩy vào trong");
  const [x2, z2] = G.collide(world, cx, cz - L.wz - 0.3, 0.4, {});
  assert.ok(z2 < cz - L.wz, "đứng ở mặt ngoài, bị đẩy ra ngoài");
});

console.log("Đường đi qua cổng (fortRoute)");
t("hai điểm cùng trong đồn, hoặc đường thẳng không chạm đồn: không cần điểm trung gian", () => {
  assert.equal(F.fortRoute(forts, cx - 5, cz - 3, cx + 8, cz + 6), null);
  assert.equal(F.fortRoute(forts, cx - 60, cz - 40, cx + 60, cz - 40), null);
  assert.equal(F.fortRoute(forts, cx - 60, cz - 40, cx - 20, cz - 30), null);
  assert.equal(F.fortRoute(null, 0, 0, 10, 10), null);
});
t("trong → ngoài: tới điểm đón trong cổng rồi bước ra; tới đích ngoài chỉ ra bằng cổng, không xuyên tường", () => {
  for (const to of [[cx, cz - 40], [cx - 35, cz + 5], [cx + 40, cz + 20], [cx + 5, cz + 30]]) {
    const r = walk([cx + 4, cz - 7], to);
    assert.ok(r.ok, `không tới được ${to}: kẹt ${r.x.toFixed(1)}, ${r.z.toFixed(1)}`);
    assert.equal(crossesWall(r.path), 0, "qua tường ngoài cổng");
  }
});
t("ngoài → trong: từ phía bắc, nam, tây, đông tới giữa đồn, góc đồn: vào bằng cổng", () => {
  for (const from of [[cx, cz - 40], [cx, cz + 40], [cx - 40, cz - 25], [cx + 40, cz + 25], [cx - 20, cz - 20]]) {
    for (const to of [[cx, cz], [cx - 9, cz - 8], [cx + 9, cz + 8]]) {
      const r = walk(from, to);
      assert.ok(r.ok, `từ ${from} tới ${to}: kẹt ${r.x.toFixed(1)}, ${r.z.toFixed(1)}`);
      assert.equal(crossesWall(r.path), 0);
    }
  }
});
t("ngoài → ngoài bên kia đồn (đường thẳng xuyên đồn): đi qua đồn bằng hai cổng hoặc vòng qua góc, không kẹt", () => {
  for (const [from, to] of [[[cx - 40, cz], [cx + 40, cz]], [[cx - 40, cz + 6], [cx + 40, cz - 6]], [[cx - 30, cz - 30], [cx + 30, cz + 30]], [[cx, cz - 35], [cx, cz + 35]], [[cx + 35, cz - 20], [cx - 35, cz + 20]]]) {
    const r = walk(from, to);
    assert.ok(r.ok, `từ ${from} tới ${to}: kẹt ${r.x.toFixed(1)}, ${r.z.toFixed(1)} sau ${r.steps} bước`);
    assert.equal(crossesWall(r.path), 0);
    assert.ok(r.steps < 3500, `${r.steps} bước (> 58 s ở 3 m/s) vòng quá xa`);
  }
});
t("không có fortRoute thì lính trong đồn đuổi tướng ngoài tường kẹt ở tường (bằng chứng cần điểm trung gian)", () => {
  const r = walk([cx, cz - 6], [cx, cz - 40], { route: false, maxSteps: 3000 });
  assert.ok(!r.ok && F.insideFort(L, r.x, r.z));
});
t("chống rung ở mép hành lang cổng: đi ngang trước cổng mà tới điểm bất kỳ trong đồn chỉ tốn ≤ 1,6 lần đường chim bay + 20 m", () => {
  for (const from of [[cx - 22, cz - 10], [cx - 22, cz + 10], [cx + 22, cz - 10], [cx + 22, cz + 10]]) {
    const to = [cx + (from[0] > cx ? -4 : 4), cz], r = walk(from, to), line = Math.hypot(to[0] - from[0], to[1] - from[1]);
    assert.ok(r.ok && r.steps / 60 * 3 < line * 1.6 + 20, `đường ${(r.steps / 60 * 3).toFixed(1)} m so với ${line.toFixed(1)} m`);
  }
});

console.log("Đếm trong / ngoài với đồn (garrison.js)");
t("fort: trong tường tính trong (nới 2 m cho lính đứng ở cổng); góc đồn xa tâm 17,9 m vẫn trong, vòng tròn r + 3 thì tính ngoài", () => {
  const base = { x: cx, z: cz, r: BASE_RING.don }, corner = { x: cx + 12, z: cz + 10.5 }, gate = { x: cx - L.wx - 1.5, z: cz }, far = { x: cx - L.wx - 6, z: cz + 2 };
  const circle = classifyGarrison(base, [corner, gate, far]), fort = classifyGarrison(base, [corner, gate, far], { fort: L });
  assert.deepEqual([circle.inside, circle.outside], [0, 3]);
  assert.deepEqual([fort.inside, fort.outside], [2, 1]);
  assert.ok(Math.abs(fort.nearest.over - 6) < 1e-9 && fort.nearest.soldier === far);
});
t("nudgeOut: chỗ đứng của lính diễn lọt trong đồn bị đẩy ra mép phía tây (quân ta) hoặc phía đông (địch); chỗ ngoài giữ nguyên", () => {
  const w = F.nudgeOut(forts, cx + 2, cz + 3, -1, 0.5), e = F.nudgeOut(forts, cx - 5, cz - 4, 1, 0);
  assert.ok(w[0] < L.bound.x0 && Math.abs(w[1] - (cz + 3)) < 1e-9);
  assert.ok(e[0] > L.bound.x1);
  assert.deepEqual(F.nudgeOut(forts, cx - 60, cz, -1, 0.3), [cx - 60, cz]);
});

console.log("Crowd thật (Node): quân đồn trú trong đồn có tường");
const { Crowd } = await import("../js/battle/crowd.js");
const { makeRng } = await import("../js/core/rng.js");
const { DIFFICULTY, GARRISON, AI } = await import("../js/data/tuning.js");
const THREE = await import(threeUrl);

function fworld({ withForts = true } = {}) {
  const hero = { x: cx - 30, z: cz, y: 0, alive: true, hp: 1e6, maxHp: 1e6, state: "free", yaw: Math.PI / 2, giap: 50, move: "N1", st: 0, dur: 1, swingId: 0, hits: 0, receiveHit() { this.hits++; } };
  const w = { colliders: F.fortColliders(L), gates: {}, bases: {} };
  if (withForts) { w.forts = forts; w.fortById = { A1: L }; }
  const ctx = { R: 1, rng: makeRng(7), diff: DIFFICULTY[1], hero, units: [], clock: 0, openGates: {}, world: w, fx: null, audio: null };
  ctx.crowd = new Crowd(new THREE.Scene(), ctx);
  return { ctx, hero, crowd: ctx.crowd };
}
const anchor = { x: cx, z: cz, r: BASE_RING.don, hard: BASE_RING.don + GARRISON.hardLeash };
const spawnIn = (crowd, n, o = {}) => {
  const list = [];
  for (let i = 0; i < n; i++) {
    const ang = i * 2.399, rr = 2 + (i * 5.3) % 7.5;
    list.push(crowd.spawn({ side: "dich", unit: "KHIEN_NG", kit: "NG_DAO", role: "garrison", src: "A1", x: cx + Math.cos(ang) * rr, z: cz + Math.sin(ang) * rr, anchor: { ...anchor }, ...o }));
  }
  return list;
};
// chạy sec giây (30 bước/giây), mỗi bước đo: số lần đi từ trong ra ngoài (hoặc ngược) không qua cổng; số lần qua cổng
function watch(ctx, crowd, list, sec, each) {
  const prev = new Map(list.map((a) => [a, F.insideFort(L, a.x, a.z)])), r = { viol: 0, exits: 0, enters: 0, maxOut: 0 };
  const last = new Map(list.map((a) => [a, [a.x, a.z]]));
  for (let i = 0; i < Math.round(sec * 30); i++) {
    ctx.clock += 1 / 30; crowd.update(1 / 30);
    let out = 0;
    for (const a of list) {
      if (a.state === "dead") continue;
      const ins = F.insideFort(L, a.x, a.z), p = last.get(a);
      if (ins !== prev.get(a)) {
        const g = L.gates.find((q) => Math.abs(q.x - (a.x + p[0]) / 2) < L.wall + 0.9);
        if (!g || Math.abs((a.z + p[1]) / 2 - L.cz) > L.gate / 2 + 0.2) r.viol++; else if (ins) r.enters++; else r.exits++;
        prev.set(a, ins);
      }
      last.set(a, [a.x, a.z]);
      if (!ins) out++;
    }
    r.maxOut = Math.max(r.maxOut, out);
    each?.(i);
  }
  return r;
}

t("tướng đứng sát ngoài tường phía bắc (cách cổng tây 16 m): quân đồn trú đuổi bằng cổng — có ra, không có lính nào xuyên tường", () => {
  const { ctx, hero, crowd } = fworld(); hero.x = cx - 8; hero.z = cz - 15.5;
  const list = spawnIn(crowd, 14), r = watch(ctx, crowd, list, 40);
  assert.equal(r.viol, 0, "xuyên tường " + r.viol + " lần");
  assert.ok(r.exits >= 1, "có lính ra bằng cổng (tiền đề): " + r.exits);
  for (const a of list) assert.ok(Math.hypot(a.x - cx, a.z - cz) <= anchor.hard + 1e-6, "vượt dây cứng");
});
t("đối chứng: có tường mà không có đường đi qua cổng (world.forts thiếu) thì cùng cảnh lính dồn vào tường bắc, không ai ra", () => {
  const { ctx, hero, crowd } = fworld({ withForts: false }); hero.x = cx - 8; hero.z = cz - 15.5;
  const list = spawnIn(crowd, 14), r = watch(ctx, crowd, list, 40);
  assert.equal(r.exits + r.enters, 0, "không có fortRoute thì không ai tìm ra cổng");
  const stuck = list.filter((a) => a.z < cz - L.wz + L.wall + 1.2 && F.insideFort(L, a.x, a.z)).length;
  assert.ok(stuck >= 2, `lính dồn vào tường bắc ${stuck}`);
});
t("tướng đứng trong đồn: quân đồn trú ở lại trong tường suốt 30 s", () => {
  const { ctx, hero, crowd } = fworld(); hero.x = cx - 6; hero.z = cz - 2;
  const list = spawnIn(crowd, 14), r = watch(ctx, crowd, list, 30);
  assert.equal(r.viol, 0); assert.equal(r.exits, 0, "lính ra ngoài tường: " + r.exits); assert.equal(r.maxOut, 0);
});
t("tướng đứng ngay ngoài tường tây (cách cổng 8 m): lính trong đồn sát tường không đánh xuyên tường — chỉ ra bằng cổng rồi mới đánh (lính cầm thương tầm 2,5 m)", () => {
  const { ctx, hero, crowd } = fworld(); hero.x = cx - L.wx - L.wall - 0.9; hero.z = cz - 8;
  const list = spawnIn(crowd, 6, { kit: "NG_GIAO" });
  for (const a of list) { a.x = cx - L.wx + L.wall + 0.6; a.z = cz - 8 + (list.indexOf(a) - 3) * 0.7; }
  let inside = 0, strikes = 0;
  const orig = crowd.strike.bind(crowd);
  crowd.strike = (a) => { strikes++; if (F.insideFort(L, a.x, a.z)) inside++; orig(a); };
  const r = watch(ctx, crowd, list, 14);
  assert.equal(inside, 0, "đánh từ trong tường xuyên ra " + inside + " lần");
  assert.equal(r.viol, 0);
  assert.ok(strikes >= 3 && r.exits >= 3, "lính ra bằng cổng rồi đánh (tiền đề): " + strikes + " nhát, " + r.exits + " lượt ra");
});
t("bỏ chạy (vỡ trận) khi đang ở ngoài tường: lính đồn trú rút về đồn bằng cổng, không đứng kẹt ngoài tường", () => {
  const { ctx, hero, crowd } = fworld(); hero.x = cx - 40; hero.z = cz - 18;
  const list = spawnIn(crowd, 3);
  list.forEach((a, i) => { a.x = cx - L.wx - 5 - i; a.z = cz - 12 - i; });                // ngoài góc tây bắc
  crowd.rout(a0x(list), a0z(list), AI.rout.officerR);
  const r = watch(ctx, crowd, list, 8);
  assert.equal(r.viol, 0);
  for (const a of list) assert.ok(F.insideFort(L, a.x, a.z) || Math.abs(a.z - cz) < L.gate, `lính ${a.id} ở ${a.x.toFixed(1)}, ${a.z.toFixed(1)}`);
});
function a0x(l) { return l[0].x; }
function a0z(l) { return l[0].z; }

console.log("Director: quân đồn trú sinh trong tường, đếm theo tường, lính diễn tránh tường");
const { Director } = await import("../js/battle/director.js");
const { createSim } = await import("../js/sim/front.js");
const { ENEMY_MIX } = await import("../js/data/battle-b15.js");
function dworld() {
  const { ctx, hero, crowd } = fworld();
  Object.assign(ctx, { hk: { tpc: false }, troops: { N: 200, r: 0.35 }, stats: { legionMult: 1, guardBase: 8, mods: { capSpeed: 0 } }, battle: { id: "B15" } });
  const sim = createSim({ fronts: FRONTS, bases: BASES, enemyMix: ENEMY_MIX, R: 1, earthworks: false });
  sim.bases.A1.keeperAlive = false; sim.heroFront = "A"; ctx.sim = sim;
  const wb = {}; for (const b of BASES) wb[b.id] = { x: lineToX(b.front ? FRONTS[b.front] : { x0: 0, x1: 0 }, b.lineX ?? 0), z: b.front ? FRONTS[b.front].laneZ : 0, r: BASE_RING[b.type] };
  Object.assign(ctx.world, { bases: wb, setBaseProgress: () => {}, setBaseOwner: () => {} });
  const d = Object.create(Director.prototype);
  Object.assign(d, { ctx, phase: 0, keepers: {}, capT: {}, capPause: 0, zoneT: 0, time: 0, swingQ: new Map(), qBucket: 10, ko: 0, koMs: 0 }); ctx.director = d;
  return { ctx, hero, crowd, d, sim, wb };
}
t("garrison sinh mới ở A1: mọi lính xuất hiện trong tường (không phải r + 3 = 13 m của vòng cọc: góc đồn 17,9 m, nhưng vòng 13 m cắt ra ngoài cạnh bắc / nam)", () => {
  const { ctx, hero, crowd, d } = dworld(); hero.x = cx - 20; hero.z = cz;
  d.updateZone(0.3);
  const gs = crowd.agents.filter((a) => a.role === "garrison" && a.src === "A1");
  assert.ok(gs.length >= 10, "có lính đồn trú sinh ra: " + gs.length);
  for (const a of gs) assert.ok(F.insideFort(L, a.x, a.z), `lính ở ${a.x.toFixed(1)}, ${a.z.toFixed(1)} ngoài tường`);
});
t("thẻ nhiệm vụ đếm lính ngoài đồn theo tường: lính đứng cách tường 8 m là 'ngoài đồn', lính ở góc đồn là trong", () => {
  const { ctx, hero, crowd, d } = dworld(); hero.x = cx - 40; hero.z = cz;
  const mk = (x, z) => crowd.spawn({ side: "dich", unit: "KHIEN_NG", role: "garrison", src: "A1", x, z, anchor: { ...anchor } });
  mk(cx + 12, cz + 10.5); mk(cx - 12, cz - 10.5); mk(cx, cz); mk(cx - L.wx - 8, cz + 1);
  d.updateBases(0.1);
  assert.match(d.baseHint, /còn \d+ · 1 ngoài đồn$/, d.baseHint);
});
t("lính diễn ở tuyến (tuyến A đứng ngay tại đồn): không ai có chỗ đứng trong hộp tường đồn", () => {
  const { ctx, d, sim } = dworld(); sim.fronts.A.x = (cx - FRONTS.A.x0) / (FRONTS.A.x1 - FRONTS.A.x0);
  d.fillActors(true);
  const acts = ctx.crowd.agents.filter((a) => a.role === "actor" && a.front === "A");
  assert.ok(acts.length >= 20, "có lính diễn: " + acts.length);
  for (const a of acts) assert.ok(!F.insideFort(L, a.sx, a.sz, L.wall + 1.2), `chỗ đứng ${a.sx.toFixed(1)}, ${a.sz.toFixed(1)} lẫn vào đồn`);
});

t("camBoxes (camera tránh tường): sáu đoạn tường + bốn chân tháp, mọi điểm tường nằm trong hộp, hai cổng và lòng đồn để trống", () => {
  const boxes = F.fortCamBoxes(L);
  assert.equal(boxes.length, 10);
  const inBox = (x, z) => boxes.some((b) => !b.gate && x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1);
  for (const s of L.segs) for (const k of [0, 0.25, 0.5, 0.75, 1]) assert.ok(inBox(s.x0 + (s.x1 - s.x0) * k, s.z0 + (s.z1 - s.z0) * k), `tường ${s.side} k=${k}`);
  for (const [x, z] of L.corners) assert.ok(inBox(x, z), "chân tháp");
  for (const g of L.gates) for (let dz = -L.gate / 2 + 0.05; dz <= L.gate / 2 - 0.05; dz += 0.5) assert.ok(!inBox(g.x, g.z + dz), `lối cổng ${g.id} dz=${dz.toFixed(2)}`);
  for (let dx = -10; dx <= 10; dx += 2.5) for (let dz = -9; dz <= 9; dz += 3) assert.ok(!inBox(cx + dx, cz + dz), `lòng đồn ${dx}, ${dz}`);     // chừa góc: chân tháp rộng 4 m lấn vào trong
});
t("camBoxes của B15 gồm hộp đồn khi world.forts có, không có thì như cũ (nhiệm vụ Tự do)", () => {
  const n0 = B15.camBoxes({ gates: {} }).length, n1 = B15.camBoxes({ gates: {}, forts: [L, F.fortLayout("B1", cx, -cz, FORT.don)] }).length;
  assert.equal(n1 - n0, 20);
});

console.log(`\n${pass} đạt, ${fail} trượt`);
process.exit(fail ? 1 : 0);
