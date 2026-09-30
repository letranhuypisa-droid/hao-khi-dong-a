// tests/deck.test.mjs — boong thuyền (battle/deck.js) và thuyền B20 (battle/boats.js): phép biến đổi, độ cao mặt nghiêng,
// cầu thang, chở theo boong, giữ trong boong, DeckSet, chạy theo đường, mắc cạn, ngân sách tam giác.
//   node hao-khi-viet/game/tests/deck.test.mjs
// boats.js import "three": nối tên đó vào vendor/three bằng module hook (Node ≥ 22.15) để chạy không cần trình duyệt.
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const threeUrl = pathToFileURL(join(here, "../vendor/three/three.module.js")).href;
registerHooks({ resolve: (s, c, next) => (s === "three" ? { url: threeUrl, shortCircuit: true } : next(s, c)) });

const { Deck, DeckSet, DECK_STEP } = await import("../js/battle/deck.js");
const { HULLS, Boat, Track, BOAT, TRI_BUDGET, triCount, innerHalfBeam, waveY } = await import("../js/battle/boats.js");
const { TIDE_Y, RIVER } = await import("../js/data/river-b20.js");
const { waveY: terrainWaveY } = await import("../js/data/terrain-b20.js");

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log("  ok  " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + e.message); }
}
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ""} ${a} ≉ ${b} (±${tol})`);
const deg = (r) => r * 180 / Math.PI;

console.log("Deck: biến đổi cục bộ ↔ thế giới");
t("yaw = π/2: mũi (+z cục bộ) hướng +x thế giới, như hero.yaw", () => {
  const d = new Deck({ rects: [{ x0: -2, x1: 2, z0: -5, z1: 5, y: 1 }] }).setPose(100, 0, 50, Math.PI / 2);
  const w = d.toWorld(0, 4, {});
  near(w.x, 104, 1e-9); near(w.z, 50, 1e-9); near(w.y, 1, 1e-9);
});
t("toLocal(toWorld(p)) = p khi boong nghiêng và quay", () => {
  const d = new Deck({ rects: [{ x0: -3, x1: 3, z0: -10, z1: 10, y: 2.6 }] }).setPose(12, -0.4, -7, 0.8, 0.05, -0.17);
  for (const [lx, lz] of [[0, 0], [2.5, -9], [-2.9, 7], [1, 3]]) {
    const w = d.toWorld(lx, lz, {}), l = d.toLocal(w.x, w.z, {});
    near(l.x, lx, 1e-9); near(l.z, lz, 1e-9); near(l.h, 2.6, 1e-9); assert.equal(l.i, 0); assert.equal(l.d, 0);
  }
});
t("heightAt trên boong nghiêng 10° khớp toWorld; ngoài boong NaN", () => {
  const d = new Deck({ rects: [{ x0: -3, x1: 3, z0: -10, z1: 10, y: 2.6 }] }).setPose(0, 0.3, 0, 0.4, 0, 10 * Math.PI / 180);
  const w = d.toWorld(2, 4, {});
  near(d.heightAt(w.x, w.z), w.y, 1e-9);
  near(w.y, 0.3 + 2.6 * Math.cos(10 * Math.PI / 180) + 2 * Math.sin(10 * Math.PI / 180), 1e-9, "mạn +x nâng lên khi roll > 0");
  assert.ok(Number.isNaN(d.heightAt(50, 50)));
  assert.ok(Number.isNaN(d.heightAt(w.x + 4 * Math.cos(0.4), w.z - 4 * Math.sin(0.4))), "qua mạn 4 m");
});
t("heightAt(pad): chân thò qua mạn 0,3 m vẫn lấy mép boong", () => {
  const d = new Deck({ rects: [{ x0: -1, x1: 1, z0: -4, z1: 4, y: 0.7 }] }).setPose(0, 0, 0, 0);
  assert.ok(Number.isNaN(d.heightAt(1.3, 0))); near(d.heightAt(1.3, 0, 0.4), 0.7, 1e-9);
});
t("cầu thang kỳ hạm: dốc 6,0 → 3,0, nghiêng thì vẫn khớp", () => {
  const d = new Deck(HULLS.flagship.deck).setPose(0, 0, 0, 0);
  near(d.heightAt(0, -6.0), 6.0 - 3 / 8.05 * 0.05, 1e-9); near(d.heightAt(0, 1.99), 3.0 + 3 / 8.05 * 0.01, 1e-9);
  near(d.heightAt(0, -2), 6 - 3 / 8.05 * 4.05, 1e-9);
  near(d.heightAt(0, -10), 6.0, 1e-9, "mặt lầu"); near(d.heightAt(3, 5), 3.0, 1e-9, "boong dưới");
  d.setPose(40, -0.5, 20, 2.2, 0.03, 0.18);
  for (const lz of [-5.5, -2, 1.5]) { const w = d.toWorld(0.4, lz, {}); near(d.heightAt(w.x, w.z), w.y, 1e-9, "z " + lz); }
});

console.log("Deck: chở theo boong (carry)");
t("điểm đứng yên trong hệ boong qua 200 lần đổi tư thế (quay, nhấp nhô, nghiêng)", () => {
  const d = new Deck(HULLS.junk.deck).setPose(0, 0, 0, 0);
  const w0 = d.toWorld(1.2, 3.5, {}), o = { x: w0.x, z: w0.z, yaw: 0.3, dver: d.ver };
  for (let k = 1; k <= 200; k++) {
    const tt = k * 0.05;
    d.setPose(3 * tt, 0.18 * Math.sin(tt * 1.1), 0.5 * tt * tt, 0.2 * tt, 0.02 * Math.sin(tt), 0.04 * Math.sin(0.7 * tt));
    const y = d.carry(o);
    const l = d.toLocal(o.x, o.z, {});
    near(l.x, 1.2, 1e-6, "lx"); near(l.z, 3.5, 1e-6, "lz");
    near(y, d.toWorld(1.2, 3.5, {}).y, 1e-6, "y");
  }
  near(o.yaw, 0.3 + 0.2 * 10 - 2 * Math.PI * Math.round((0.3 + 2) / (2 * Math.PI)), 1e-9, "yaw cộng dồn độ quay của boong");
});
t("carry chỉ chở một lần mỗi setPose (o.dver)", () => {
  const d = new Deck(HULLS.light.deck).setPose(0, 0, 0, 0);
  const o = { x: 0, z: 1, dver: d.ver };
  d.setPose(5, 0, 0, 0); d.carry(o); d.carry(o);
  near(o.x, 5, 1e-9);
});
t("lần setPose đầu không có độ dời (thuyền đặt ở xa gốc)", () => {
  const d = new Deck(HULLS.light.deck).setPose(500, 0, -30, 1);
  const o = { x: 500, z: -30 };
  d.carry(o); near(o.x, 500, 1e-9); near(o.z, -30, 1e-9);
});
t("chở theo khi thuyền đang mắc cạn, nghiêng dần", () => {
  const b = new Boat({ type: "junk", id: "c1", path: [{ x: 0, z: 0 }, { x: 200, z: 0 }], speed: 3 });
  const env = { tideY: 0, t: 0 };
  b.update(0.05, env);
  const w = b.deck.toWorld(-2, 2, {}), o = { x: w.x, z: w.z, dver: b.deck.ver };
  b.strand();
  for (let k = 0; k < 120; k++) { env.t += 0.05; b.update(0.05, env); b.deck.carry(o); }
  const l = b.deck.toLocal(o.x, o.z, {}); near(l.x, -2, 1e-6); near(l.z, 2, 1e-6);
});

console.log("Deck: giữ trong boong (clampInside)");
const junkAt = () => new Deck(HULLS.junk.deck).setPose(20, 0.2, 10, 0.7, 0.01, 0.03);
const localOf = (d, o) => d.toLocal(o.x, o.z, {});
const placeL = (d, lx, lz) => { const w = d.toWorld(lx, lz, {}); return { x: w.x, z: w.z }; };
t("người sát mạn bị đẩy vào trong bán kính", () => {
  const d = junkAt(), o = placeL(d, 2.7, 4);
  assert.equal(d.clampInside(o, 0.4), true);
  near(localOf(d, o).x, 2.8 - 0.4, 1e-6);
});
t("người ngoài mọi mặt kéo về mặt gần nhất; gần cửa thì thả", () => {
  const d = junkAt(), o = placeL(d, 4, 5);
  d.clampInside(o, 0.4); const l = localOf(d, o); near(l.x, 2.4, 1e-6); near(l.z, 5, 1e-6);
  const p = placeL(d, 3.1, 0.3); assert.equal(d.clampInside(p, 0.4), false, "cửa mạn giữa thân");
});
t("tường lầu lái chặn người trên boong; đi qua chỗ nối hai mặt cùng độ cao", () => {
  const d = junkAt(), o = placeL(d, 0.5, -5.8);
  d.clampInside(o, 0.4); near(localOf(d, o).z, -6.2 + 0.4, 1e-6, "vách lầu");
  const q = placeL(d, 1.5, 6.9); assert.equal(d.clampInside(q, 0.4), false, "sang mặt mũi hẹp hơn nhưng 1,5 + 0,4 ≤ 2,15");
  const r = placeL(d, 2.5, 6.9); d.clampInside(r, 0.4); near(localOf(d, r).z, 7.0 - 0.4, 1e-6, "góc mạn chỗ thân hẹp lại");
});
t("kỳ hạm: boong dưới không leo lên mép lầu; chân cầu thang đi lên được; mép lầu không rơi xuống", () => {
  const d = new Deck(HULLS.flagship.deck).setPose(0, 0, 0, 0);
  const a = { x: 3, z: -5.8 }; d.clampInside(a, 0.4); near(a.z, -6.05 + 0.4, 1e-9, "vách lầu (tường) từ boong dưới");
  const b = { x: 1.4, z: -3 }; d.clampInside(b, 0.4); near(b.x, 1.1 + 0.4, 1e-9, "hông cầu thang cao hơn boong dưới > 1 bậc");
  const c = { x: 0.2, z: 1.8 }; assert.equal(d.clampInside(c, 0.4), false, "chân cầu thang ngang boong dưới");
  const e = { x: 0.2, z: 2.3 }; assert.equal(d.clampInside(e, 0.4), false, "từ boong dưới bước vào chân thang");
  const f = { x: 2, z: -6.3 }; d.clampInside(f, 0.4); near(f.z, -6.05 - 0.4, 1e-9, "mép trước mặt lầu (cao 3 m)");
  const g = { x: 0.3, z: -6.3 }; assert.equal(d.clampInside(g, 0.4), false, "đầu cầu thang nối mặt lầu");
  const h = { x: 2.1, z: -14.2 }; d.clampInside(h, 0.4); assert.ok(Math.hypot(h.x - 2.2, h.z + 15) >= 0.2 + 0.4 - 1e-9 || Math.abs(h.x - 2.2) >= 0.6 - 1e-9 || Math.abs(h.z + 15) >= 0.6 - 1e-9, "cột đình");
});
t("mặt đi được của mọi loại nằm trong thân (≤ nửa bề rộng trong mạn)", () => {
  for (const [type, H] of Object.entries(HULLS)) for (const r of H.deck.rects) for (const z of [r.z0, r.z1, (r.z0 + r.z1) / 2]) {
    const w = innerHalfBeam(type, z);
    assert.ok(Math.max(-r.x0, r.x1) <= w + 0.02, `${type} rect z ${z}: ${Math.max(-r.x0, r.x1)} > ${w.toFixed(2)}`);
  }
});

console.log("DeckSet");
t("chọn tối đa 12 boong gần nhất; boong ưu tiên luôn có, xếp trước", () => {
  const set = new DeckSet(), decks = [];
  for (let i = 0; i < 20; i++) decks.push(set.add(new Deck(HULLS.light.deck).setPose(i * 20, 0, 0, 0)));
  const act = set.active(0, 0, 1000);
  assert.equal(act.length, 12); assert.deepEqual(act, decks.slice(0, 12));
  decks[19].priority = 1;
  const act2 = set.active(0, 0, 1000);
  assert.equal(act2.length, 12); assert.equal(act2[0], decks[19]); assert.ok(!act2.includes(decks[11]));
  assert.equal(set.active(0, 0, 30).length, 3, "R 30 m: 0, 20, 40 (mép vòng bao) + ưu tiên");
});
t("heightAt / deckAt: boong cao hơn thắng; ngoài mọi boong NaN / null", () => {
  const set = new DeckSet(), lo = set.add(new Deck(HULLS.light.deck).setPose(0, 0, 0, 0)), hi = set.add(new Deck(HULLS.junk.deck).setPose(0, 0, 8, 0));
  set.active(0, 0);
  near(set.heightAt(0.5, 3), 2.6, 1e-9); assert.equal(set.deckAt(0.5, 3), hi);
  near(set.heightAt(0, -4), 0.7, 1e-9, "chỉ thuyền nhẹ"); assert.equal(set.deckAt(0, -4.2), lo);
  assert.ok(Number.isNaN(set.heightAt(100, 100))); assert.equal(set.deckAt(100, 100), null);
  set.remove(hi); near(set.heightAt(0.5, 3), 0.7, 1e-9);
});

console.log("Track và Boat");
t("đường thẳng: độ dài cung đúng, chạy 5 m/s trong 10 s đi 50 m", () => {
  const tr = new Track([{ x: 0, z: 0 }, { x: 40, z: 0 }, { x: 100, z: 0 }]);
  near(tr.len, 100, 1e-6);
  const b = new Boat({ type: "light", id: "a", path: tr.P, speed: 5 });
  for (let k = 0; k < 200; k++) b.update(0.05, { tideY: 0, t: k * 0.05 });
  near(b.s, 50, 1e-6); near(b.x, 50, 0.05, "điểm chia đều 10/đoạn: sai số < 5 cm"); near(b.z, 0, 1e-6); near(b.yaw, Math.PI / 2, 1e-3);
});
t("đường cong: bước đều theo độ dài cung (sai số dây cung < 0,5%)", () => {
  const path = []; for (let i = 0; i <= 8; i++) path.push({ x: i * 60, z: 40 * Math.sin(i * 0.9) });
  const tr = new Track(path), P = {}, steps = 400, ds = tr.len / steps;
  let sum = 0, prev = tr.at(0, {});
  for (let k = 1; k <= steps; k++) { tr.at(k * ds, P); sum += Math.hypot(P.x - prev.x, P.z - prev.z); prev = { ...P }; near(Math.hypot(P.tx, P.tz), 1, 1e-9); }
  near(sum / tr.len, 1, 0.005);
  const end = tr.at(tr.len, {}); near(end.x, 480, 1e-6); near(end.z, 40 * Math.sin(7.2), 1e-6);
});
t("hết đường thì dừng (hold, arrived); go() chạy tiếp khi có đường mới", () => {
  const b = new Boat({ type: "escort", id: "e", path: [{ x: 0, z: 0 }, { x: 10, z: 0 }], speed: 4 });
  for (let k = 0; k < 100; k++) b.update(0.05, { tideY: 0.5, t: k * 0.05 });
  assert.equal(b.state, "hold"); assert.equal(b.arrived, true); near(b.x, 10, 1e-6);
  b.setPath([{ x: 10, z: 0 }, { x: 10, z: 30 }]); assert.equal(b.state, "sail");
  for (let k = 0; k < 40; k++) b.update(0.05, { tideY: 0.5, t: k * 0.05 });
  near(b.z, 0.5 * BOAT.acc * 4, 0.05, "tăng tốc lại từ 0 trong 2 s");
});
t("nổi ở mặt nước + sóng; tăng tốc về targetSpeed", () => {
  const b = new Boat({ type: "junk", id: "w", path: [{ x: 0, z: 0 }, { x: 300, z: 0 }], speed: 0 });
  b.targetSpeed = 4.4;
  for (let k = 0; k < 40; k++) b.update(0.05, { tideY: 1.4, t: k * 0.05 });
  near(b.speed, Math.min(4.4, BOAT.acc * 2), 1e-9);
  near(b.y, 1.4, 0.2); assert.ok(Math.abs(deg(b.pitch)) < 2 && Math.abs(deg(b.roll)) < 4);
});
t("mắc cạn: settle 4 s rồi stranded, độ nghiêng 8–12° (50 thuyền theo seed)", () => {
  const bed = () => RIVER.bedShoal;
  for (let i = 0; i < 50; i++) {
    const b = new Boat({ type: ["junk", "escort", "flagship", "scout"][i % 4], id: "s" + i, path: [{ x: 500, z: 0 }, { x: 800, z: 0 }], speed: 4.4 });
    const env = { tideY: TIDE_Y(100), t: 0, bedHeight: bed, stakeActive: () => false };
    let settledAt = -1, tSettle = -1;
    for (let k = 0; k < 1200 && b.state !== "stranded"; k++) {
      env.t += 0.05; env.tideY = TIDE_Y(Math.max(0, 100 - env.t * 2)); b.update(0.05, env);
      if (b.state === "settle" && tSettle < 0) tSettle = env.t;
      if (b.state === "stranded") settledAt = env.t;
    }
    assert.equal(b.state, "stranded", b.type);
    near(settledAt - tSettle, BOAT.settle, 0.06, "4 s");
    const T = deg(b.tilt); assert.ok(T >= 8 && T <= 12, `${b.id} nghiêng ${T.toFixed(2)}°`);
    const r0 = b.hull.deck.rects.find((r) => !r.sz), cx = (r0.x0 + r0.x1) / 2, cz = (r0.z0 + r0.z1) / 2;
    const o = b.deck.toWorld(cx, cz, {}), ax = b.deck.toWorld(cx + 1, cz, {}), az = b.deck.toWorld(cx, cz + 1, {});
    const u = [ax.x - o.x, ax.y - o.y, ax.z - o.z], v = [az.x - o.x, az.y - o.y, az.z - o.z], ny = u[2] * v[0] - u[0] * v[2];
    near(deg(Math.acos(Math.abs(ny))), T, 1e-6, "mặt boong nghiêng đúng góc");
    near(b.deck.heightAt(o.x, o.z), o.y, 1e-9);
    assert.ok(b.speed === 0, "đứng yên");
    const x = b.x; for (let k = 0; k < 20; k++) b.update(0.05, env); near(b.x, x, 1e-9, "không trôi");
  }
});
t("mắc sớm trên mốc cọc đã kích hoạt; director đặt state 'caught' cũng lún và nghiêng", () => {
  const env = { tideY: TIDE_Y(40), t: 0, bedHeight: () => -2.1, stakeActive: () => true };
  const b = new Boat({ type: "junk", id: "k", path: [{ x: 0, z: 0 }, { x: 99, z: 0 }], speed: 3 });
  b.update(0.05, env); assert.equal(b.state, "settle", "ky −1,9 ≤ đáy + 0,6");
  const c = new Boat({ type: "light", id: "l", path: [{ x: 0, z: 0 }, { x: 99, z: 0 }], speed: 3 });
  c.state = "caught"; for (let k = 0; k < 90; k++) c.update(0.05, { tideY: 0, t: 0 });
  assert.equal(c.state, "stranded"); near(c.y, 0, 1e-9, "không biết đáy: nằm ở mặt nước");
});
t("chìm: tụt 0,6 m/s rồi ẩn sau 6 s; hullCapsule dọc thân", () => {
  const b = new Boat({ type: "escort", id: "x", path: [{ x: 0, z: 0 }, { x: 0, z: 50 }], speed: 2 });
  b.update(0.05, { tideY: 0 }); const y0 = b.y; b.sink();
  for (let k = 0; k < 20; k++) b.update(0.05, { tideY: 0 });
  near(b.y, y0 - 0.6, 1e-6); assert.equal(b.alive, false);
  for (let k = 0; k < 110; k++) b.update(0.05, { tideY: 0 });
  assert.equal(b.visible, false);
  const c = new Boat({ type: "junk", id: "cap", path: [{ x: 0, z: 0 }, { x: 100, z: 0 }] }).hullCapsule();
  near(c.r, 3.5, 1e-9); near(c.x1 - c.x0, 24 - 7, 1e-9); near(c.z0, 0, 1e-9);
});
t("thuyền nhấp nhô theo đúng hàm sóng của mặt nước (terrain-b20 waveY)", () => {
  assert.equal(waveY, terrainWaveY);
  const b = new Boat({ type: "light", id: "wv", path: [{ x: 0, z: 0 }, { x: 0, z: 100 }] });
  b.update(0.01, { tideY: 0.4, t: 3.2 });
  const s = [[0, 4.8], [0, -4.8], [1.3, 0], [-1.3, 0]].reduce((a, [dx, dz]) => a + terrainWaveY(dx, dz, 3.2), 0) / 4;
  near(b.y, 0.4 + s * 10 / 12, 1e-9);
});

console.log("Ngân sách tam giác (hợp đồng §5)");
const tri = {};
for (const type of Object.keys(HULLS)) tri[type] = [0, 1, 2].map((l) => triCount(type, l));
console.log("       " + Object.entries(tri).map(([k, v]) => `${k} ${v.join("/")}`).join(" · "));
t("LOD0 ≤ 3k (kỳ hạm ≤ 8k), LOD1 ≤ 800, LOD2 ≈ 50", () => {
  for (const [type, [l0, l1, l2]] of Object.entries(tri)) {
    assert.ok(l0 <= (type === "flagship" ? TRI_BUDGET.flagship0 : TRI_BUDGET.lod0), `${type} LOD0 ${l0}`);
    assert.ok(l1 <= TRI_BUDGET.lod1, `${type} LOD1 ${l1}`);
    assert.ok(l2 <= TRI_BUDGET.lod2, `${type} LOD2 ${l2}`);
    assert.ok(l0 > l1 && l1 > l2, `${type} LOD giảm dần`);
  }
});
t("DECK_STEP nhỏ hơn chênh boong dưới / mặt lầu kỳ hạm", () => assert.ok(DECK_STEP < 1 && HULLS.flagship.topY - HULLS.flagship.deckY > 2 * DECK_STEP));

console.log(`\n${pass} đạt, ${fail} trượt`);
process.exit(fail ? 1 : 0);
