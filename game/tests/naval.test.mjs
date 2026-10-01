// tests/naval.test.mjs — lớp thủy chiến B20 (battle/naval.js, đợt 9 pha D1): chở người trên boong theo toạ độ cục bộ (không trôi
// dù người chỉ đi mỗi 3 bước — review P2-1), thứ tự ưu tiên Tương tác, đò chuyển (5–8 s, 8 m/s, đường uốn qua tâm dòng khi cắt
// đất khô), chọn thuyền mắc cạn xác định, va chạm (lan can, cửa, ván bắc, nước sâu, thân thuyền), ván dốc xuống bùn, lưu / nạp.
// Dựng Naval trên THREE.Scene với thế giới giả (không WebGL, không cảnh B20).
//   node hao-khi-viet/game/tests/naval.test.mjs
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const threeUrl = pathToFileURL(join(here, "../vendor/three/three.module.js")).href;
registerHooks({ resolve: (s, c, next) => (s === "three" ? { url: threeUrl, shortCircuit: true } : next(s, c)) });
// FleetRenderer vẽ chữ cờ bằng canvas 2D: canvas giả
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => new Proxy({}, { get: (o, k) => (k in o ? o[k] : () => ({ width: 0 })), set: (o, k, v) => ((o[k] = v), true) }) }) };

const THREE = await import("three");
const { Naval, NAV, ferryTiming, ferryPath, sortInteract, INTERACT_ORDER, strandSelect } = await import("../js/battle/naval.js");
const { DeckSet, Deck } = await import("../js/battle/deck.js");
const { HULLS, BOAT } = await import("../js/battle/boats.js");
const { WADE_MAX } = await import("../js/data/terrain-b20.js");

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log("  ok  " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + (e.stack || e.message).split("\n").slice(0, 3).join("\n       ")); }
}
const _w = {};
const near = (a, b, eps, msg = "") => assert.ok(Math.abs(a - b) <= eps, `${msg} ${a} ≠ ${b} (±${eps})`);

// Thế giới giả: sông thẳng dọc x, lòng sâu −4 ở |z| < 40, bãi cạn −2,1 ở 40 ≤ z < 60, bờ +2 ở z ≥ 60 (và z ≤ −60)
function fakeWorld(tideY = 1.0) {
  const groundY = (x, z) => { const a = Math.abs(z); return a < 40 ? -4 : a < 60 ? -2.1 : 2; };
  return { decks: new DeckSet(), tideY, groundY, pierDecks: [], scenery: null };
}
function fakeCtx() {
  const agents = [];
  return { scene: new THREE.Scene(), clock: 0, units: [], fx: null, hud: null,
    crowd: { agents, hittable: (a) => a.alive !== false && a.state !== "dead", kill() {}, release(a) { a.role = "free"; } },
    hero: { x: 0, z: 0, y: 0, yaw: 0, alive: true, state: "free", hp: 100, maxHp: 100, invuln: 0 } };
}
function build(tide) { const ctx = fakeCtx(), world = fakeWorld(tide), nav = new Naval(ctx, world, { cap: 8, shadows: false }); return { ctx, world, nav }; }

console.log("Chở theo boong (toạ độ cục bộ)");
t("người đứng yên trên thuyền đang chạy, quay: toạ độ cục bộ không đổi sau 600 bước", () => {
  const { nav } = build();
  const path = []; for (let k = 0; k <= 12; k++) path.push({ x: k * 20, z: 12 * Math.sin(k * 0.7) });
  const b = nav.addBoat({ type: "light", side: "ta", id: "a", path, speed: 6 });
  const o = { x: 0, z: 0, yaw: 0.3 }; b.deck.toWorld(0.4, 2.0, _w); o.x = _w.x; o.z = _w.z; nav.board(o, b.deck);
  const rel = o.yaw - b.deck.yaw, yaw0 = b.deck.yaw, wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  for (let k = 0; k < 600; k++) nav.update(1 / 60);
  const L = b.deck.toLocal(o.x, o.z, {});
  near(L.x, 0.4, 1e-9, "lx"); near(L.z, 2.0, 1e-9, "lz"); near(wrap(o.yaw - b.deck.yaw - rel), 0, 1e-9, "hướng theo thuyền");
  assert.ok(Math.abs(wrap(b.deck.yaw - yaw0)) > 0.2, "thuyền đã quay");
  assert.ok(b.s > 50, "thuyền đã chạy");
});
t("người chỉ bước mỗi 3 bước (lính xa): vẫn không trôi khỏi boong; bước đi được cộng đúng", () => {
  const { nav } = build();
  const b = nav.addBoat({ type: "escort", side: "dich", id: "e", path: [{ x: 0, z: 0 }, { x: 60, z: 30 }, { x: 140, z: -10 }], speed: 5 });
  const o = { x: 0, z: 0 }; b.deck.toWorld(0, -3, _w); o.x = _w.x; o.z = _w.z; nav.board(o, b.deck);
  for (let k = 0; k < 300; k++) {
    if (k % 3 === 0) { const f = b.deck.toWorld(0, 0.02, {}), g = b.deck.toWorld(0, 0, {}); o.x += f.x - g.x; o.z += f.z - g.z; }  // 2 cm về mũi mỗi 3 bước
    nav.update(1 / 60);
  }
  const L = b.deck.toLocal(o.x, o.z, {});
  near(L.x, 0, 1e-6, "lx"); near(L.z, -3 + 100 * 0.02, 1e-6, "lz = −3 + 100 bước × 2 cm");
});
t("điểm neo theo boong: chỗ đứng gốc (sx, sz) của lính, nhà (home) của đơn vị lớn đi theo thuyền", () => {
  const { nav } = build();
  const b = nav.addBoat({ type: "junk", side: "dich", id: "j", path: [{ x: 0, z: 0 }, { x: 100, z: 0 }], speed: 5 });
  const a = { K: {}, role: "garrison", x: 0, z: 0, sx: 0, sz: 0 }; b.deck.toWorld(1, 3, _w); a.x = a.sx = _w.x; a.z = a.sz = _w.z; nav.board(a, b.deck);
  const u = { isBig: true, alive: true, x: _w.x, z: _w.z, home: { x: _w.x, z: _w.z }, post: { x: 0, z: 0 } }; nav.board(u, b.deck);
  for (let k = 0; k < 120; k++) nav.update(1 / 60);
  const Ls = b.deck.toLocal(a.sx, a.sz, {}), Lh = b.deck.toLocal(u.home.x, u.home.z, {});
  near(Ls.x, 1, 1e-6); near(Ls.z, 3, 1e-6); near(Lh.x, 1, 1e-6); near(Lh.z, 3, 1e-6);
});

console.log("Tương tác");
t("thứ tự: chiếm thuyền → lên boong → mở mốc → gọi đò", () => {
  const list = [{ kind: "ferry" }, { kind: "marker" }, { kind: "capture" }, { kind: "board" }];
  assert.deepEqual(sortInteract(list).map((i) => i.kind), INTERACT_ORDER);
});
t("trên boong thuyền địch: trấn thủ ngã + ≤ 2 lính địch thì 'capture' đứng đầu (3 s); còn 3 lính thì không", () => {
  const { nav, ctx } = build();
  const b = nav.addBoat({ type: "escort", side: "dich", id: "E", path: [{ x: 0, z: 0 }, { x: 10, z: 0 }], speed: 0 });
  const h = ctx.hero; b.deck.toWorld(0, 0, _w); h.x = _w.x; h.z = _w.z; nav.board(h, b.deck);
  const crew = [0, 1, 2].map((i) => { const a = { K: {}, side: "dich", role: "garrison", alive: true, state: "move", x: 0, z: 0 }; b.deck.toWorld(-1 + i, 2, _w); a.x = _w.x; a.z = _w.z; nav.board(a, b.deck); ctx.crowd.agents.push(a); return a; });
  b.officer = { alive: true, dead: 0 };
  assert.ok(!nav.interactables(h).some((i) => i.kind === "capture"), "trấn thủ còn");
  b.officer.alive = false;
  assert.ok(!nav.interactables(h).some((i) => i.kind === "capture"), "còn 3 lính");
  crew[0].state = "dead";
  const it = nav.interactables(h);
  assert.equal(it[0].kind, "capture"); assert.equal(it[0].hold, NAV.hold.capture); assert.equal(it[0].hold, 3);
  // giữ 3 s: chiếm
  let r; for (let k = 0; k < 190; k++) r = nav.interactStep(h, true, 1 / 60);
  assert.ok(b.captured && b.side === "ta" && b.flag === "陳", "đã chiếm, cờ 陳");
});
t("lên boong: boong khác trong 4 m (1 s); ván bắc nối nhau thì không nhắc; thả phím / trúng đòn nặng thì đếm lại", () => {
  const { nav, ctx } = build();
  const a = nav.addBoat({ type: "light", side: "ta", id: "A", path: [{ x: 0, z: 0 }, { x: 0, z: 10 }], speed: 0 });
  const b = nav.addBoat({ type: "escort", side: "dich", id: "B", path: [{ x: 5.8, z: 0 }, { x: 5.8, z: 10 }], speed: 0 });
  const h = ctx.hero; a.deck.toWorld(0.6, 0, _w); h.x = _w.x; h.z = _w.z; nav.board(h, a.deck);
  let it = nav.interactables(h); assert.equal(it[0].kind, "board"); assert.equal(it[0].hold, 1); assert.equal(it[0].deck, b.deck);
  nav.interactStep(h, true, 0.5); let r = nav.interactStep(h, false, 1 / 60); assert.equal(r.p, 0, "thả phím");
  nav.interactStep(h, true, 0.5); h.lastHardHit = ctx.clock = 1; r = nav.interactStep(h, true, 0.1); assert.equal(r.p, 0, "trúng đòn nặng");
  const L = nav.grapple(a, b); it = nav.interactables(h);
  assert.ok(!it.some((i) => i.kind === "board" && i.deck === b.deck), "có ván bắc thì đi bộ qua");
  nav.release(L);
});
t("gọi đò: trên thuyền ta / có nước ≥ 0,3 m trong 3 m; trên bãi khô thì không", () => {
  const { nav, ctx } = build(-3.0);          // triều thấp: bãi cạn z 40–60 khô (−2,1 > −3)
  const h = ctx.hero; h.x = 0; h.z = 50; assert.ok(!nav.interactables(h).some((i) => i.kind === "ferry"), "khô");
  h.z = 37.5; assert.ok(nav.interactables(h).some((i) => i.kind === "ferry"), "sát mép nước sâu");
});

console.log("Đò chuyển");
t("thời gian 5–8 s ở 8 m/s: gần thì chậm lại (5 s), xa thì nhanh lên (8 s)", () => {
  assert.deepEqual(ferryTiming(20), { T: 5, speed: 4 });
  assert.deepEqual(ferryTiming(40), { T: 5, speed: 8 });
  near(ferryTiming(56).T, 7, 1e-12); near(ferryTiming(56).speed, 8, 1e-12);
  assert.deepEqual(ferryTiming(160), { T: 8, speed: 20 });
  for (const L of [1, 7, 33, 64, 65, 999]) { const f = ferryTiming(L); assert.ok(f.T >= 5 && f.T <= 8); near(f.T * f.speed, L, 1e-9); }
});
t("đường đò: thẳng khi không cắt đất khô; cắt đất thì uốn qua tâm dòng", () => {
  assert.equal(ferryPath({ x: 0, z: 0 }, { x: 100, z: 0 }).length, 2);
  const P = ferryPath({ x: 0, z: 30 }, { x: 100, z: 30 }, (x, z) => z > 20 && x > 30 && x < 70, (x) => 0);
  assert.equal(P.length, 3); assert.deepEqual(P[1], { x: 50, z: 0 });
});
t("chuyến đò: tướng leo sang đò → ride (không đánh) → tới nơi leo lên boong đích; đò tự đi, gỡ sau NAV.ferry.leave", () => {
  const { nav, ctx } = build();
  const a = nav.addBoat({ type: "lead", side: "ta", id: "A", path: [{ x: 0, z: -5 }, { x: 0, z: 5 }], speed: 0 });
  const b = nav.addBoat({ type: "escort", side: "ta", id: "B", path: [{ x: 60, z: -5 }, { x: 60, z: 5 }], speed: 0 });
  const h = ctx.hero; a.deck.toWorld(0, 0, _w); h.x = _w.x; h.z = _w.z; nav.board(h, a.deck);
  const dests = nav.ferryDestinations(h); assert.equal(dests[0].id, "B");
  const f = nav.ferry(h, "B"); assert.ok(f && f.T >= 5 && f.T <= 8);
  assert.equal(h.state, "climb");
  let rode = false, sec = 0;
  for (; sec < 20 && !f.done; sec += 1 / 60) { nav.update(1 / 60); if (h.state === "ride") rode = true; if (h.state === "climb" || h.state === "ride") { /* tướng không tự đổi trạng thái trong bài thử */ } }
  assert.ok(rode, "có đi đò"); assert.ok(f.done, "xong chuyến"); assert.equal(h.deck, b.deck, "đã lên boong đích"); assert.equal(h.state, "free");
  assert.ok(sec < f.T + 2.5, `mất ${sec.toFixed(1)} s`);
  for (let k = 0; k < 60 * (NAV.ferry.leave + 1); k++) nav.update(1 / 60);
  assert.ok(!nav.boats.some((q) => q.isFerry), "đò đã gỡ");
});

console.log("Mắc cạn");
t("chọn thuyền mắc: share 1 → tất cả; 0,5 → nửa (làm tròn lên), luôn có id giữ, không phụ thuộc thứ tự", () => {
  const ids = ["J1", "J2", "J3", "J4", "J5", "FS", "PT", "J6"];
  assert.deepEqual(strandSelect(ids, 1), [...ids].sort());
  const h = strandSelect(ids, 0.5, ["FS", "PT"]);
  assert.equal(h.length, 4); assert.ok(h.includes("FS") && h.includes("PT"));
  assert.deepEqual(strandSelect([...ids].reverse(), 0.5, ["PT", "FS"]), h, "xác định");
  assert.deepEqual(strandSelect(["A"], 0.5, []), ["A"]);
});
t("thuyền mắc cạn bắc ván dốc bên mạn thấp: chân ván chạm bùn, dốc ≤ ~37°; đi được từ bùn lên boong", () => {
  const { nav, world } = build(-1.6);
  const b = nav.addBoat({ type: "junk", side: "dich", id: "J", path: [{ x: 0, z: 50 }, { x: 10, z: 50 }], speed: 0 });
  b.strand(); for (let k = 0; k < 300; k++) nav.update(1 / 60);
  assert.equal(b.state, "stranded"); assert.ok(b.ramp, "có ván dốc");
  const R = b.ramp, foot = b.deck.toWorld(R.xe, R.lz, {}, b.deck.rects.indexOf(R.rect)), top = b.deck.toWorld(R.x0, R.lz, {}, b.deck.rects.indexOf(R.rect));
  near(foot.y, world.groundY(foot.x, foot.z) + 0.06, 0.03, "chân ván trên bùn");
  assert.ok((top.y - foot.y) / Math.hypot(top.x - foot.x, top.z - foot.z) <= 0.8, "dốc");
  // từ bùn bước vào chân ván → lên boong
  const o = { x: foot.x, z: foot.z };
  const p = b.deck.toWorld(R.xe - R.sg * 0.5, R.lz, {}); nav.collideExtra(p.x, p.z, 0.4, o);
  assert.equal(o.deck, b.deck, "bước lên ván");
});
t("mắc cọc (catch) rồi strand: chưa nghiêng khi mắc, nghiêng 8–12° khi nằm cạn", () => {
  const { nav } = build(-0.5);
  const b = nav.addBoat({ type: "escort", side: "dich", id: "C", path: [{ x: 0, z: 50 }, { x: 99, z: 50 }], speed: 3 });
  b.catch(); for (let k = 0; k < 120; k++) nav.update(1 / 60);
  assert.equal(b.state, "caught"); assert.ok(b.tilt < 0.03); assert.ok(b.speed < 0.01);
  b.strand(); for (let k = 0; k < 300; k++) nav.update(1 / 60);
  const deg = b.tilt * 180 / Math.PI; assert.ok(deg >= 8 && deg <= 12, `${deg.toFixed(1)}°`);
});

console.log("Va chạm");
t("trên boong: lan can giữ lại; ra cửa mạn mà ngoài là nước sâu thì vẫn giữ; sang ván bắc thì đổi boong", () => {
  const { nav } = build();
  const a = nav.addBoat({ type: "light", side: "ta", id: "A", path: [{ x: 0, z: 0 }, { x: 0, z: 10 }], speed: 0 });
  const b = nav.addBoat({ type: "escort", side: "dich", id: "B", path: [{ x: 7, z: 0 }, { x: 7, z: 10 }], speed: 0 });
  const o = { x: 0, z: 0, yaw: 0 }; nav.board(o, a.deck);
  let r = nav.collideExtra(-3, 0, 0.4, o); assert.ok(r && r[0] > -1.0, `giữ ở mạn: ${r}`);
  r = nav.collideExtra(-1.6, 0, 0.4, o); assert.ok(r && Math.abs(r[0]) < 1.0, "cửa mạn trên nước sâu: vẫn giữ");
  const L = nav.grapple(a, b); nav.update(0);
  const mid = L.plank.toWorld(0, L.len / 2, {});
  nav.collideExtra(mid.x, mid.z, 0.4, o); assert.equal(o.deck, L.plank, "lên ván bắc");
  const far = b.deck.toWorld(-1.2, 0, {}); nav.collideExtra(far.x, far.z, 0.4, o); assert.equal(o.deck, b.deck, "sang thuyền kia");
});
t("dưới đất: nước sâu hơn WADE_MAX thì đẩy về chỗ lội được gần nhất; thân thuyền đẩy ra", () => {
  const { nav, world } = build(-1.0);                 // mép lội: z = 40 (−2,1 vs −1: sâu 1,1 > 0,9 ⇒ bãi z ≥ 40 cũng sâu? −1 − (−2,1) = 1,1)
  world.tideY = -1.5;                                  // bãi cạn sâu 0,6: lội được; lòng sâu 2,5: không
  const o = {};
  let r = nav.collideExtra(0, 39.2, 0.4, o); assert.ok(r && Math.abs(r[1]) >= 40 - 1e-9 && world.tideY - world.groundY(r[0], r[1]) <= WADE_MAX, `đẩy ${r}`);
  assert.equal(nav.collideExtra(0, 45, 0.4, o), null, "lội được: để yên");
  const b = nav.addBoat({ type: "junk", side: "dich", id: "J", path: [{ x: 0, z: 50 }, { x: 10, z: 50 }], speed: 0 });
  r = nav.collideExtra(b.x + 0.5, b.z + 1, 0.4, o); assert.ok(r && Math.hypot(r[0] - b.x, r[1] - b.z) >= HULLS.junk.beam / 2 + 0.4 - 1e-6, "ra khỏi thân");
});

console.log("Lưu / nạp");
t("snapshot → restore: cùng thuyền, vị trí, trạng thái, ván bắc", () => {
  const { nav } = build(-1.6);
  const a = nav.addBoat({ type: "lead", side: "ta", id: "A", path: [{ x: 0, z: 0 }, { x: 80, z: 0 }], speed: 4 });
  const b = nav.addBoat({ type: "escort", side: "dich", id: "B", flag: "元" }); b.x = 0; b.z = 6; b.yaw = 0; nav.grapple(a, b);
  const j = nav.addBoat({ type: "junk", side: "dich", id: "J", path: [{ x: 0, z: 50 }, { x: 10, z: 50 }], speed: 0 }); j.strand();
  for (let k = 0; k < 400; k++) nav.update(1 / 60);
  const S = JSON.parse(JSON.stringify(nav.snapshot()));
  const before = nav.boats.map((q) => [q.id, q.state, +q.x.toFixed(4), +q.z.toFixed(4)]);
  nav.restore(S);
  const after = nav.boats.map((q) => [q.id, q.state, +q.x.toFixed(4), +q.z.toFixed(4)]);
  assert.deepEqual(after, before); assert.equal(nav.links.length, 1); assert.ok(nav.byId.get("J").ramp, "ván dốc dựng lại");
});
t("Deck.heightAt(pad) không nới trước (review P1-1): boong dưới kỳ hạm sát cầu thang = 3,0", () => {
  const d = new Deck(HULLS.flagship.deck).setPose(0, 0, 0, 0);
  near(d.heightAt(-1.45, -5, 0.4), 3.0, 1e-9); assert.ok(d.heightAt(0, -5, 0.4) > 3.1, "trên cầu thang vẫn là mặt thang");
});

console.log(`\n${pass} đạt, ${fail} trượt`);
if (fail) process.exit(1);
