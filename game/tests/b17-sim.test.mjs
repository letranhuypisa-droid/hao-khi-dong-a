// tests/b17-sim.test.mjs — luật thuần của B17 Tây Kết (sim/b17.js) và dữ liệu trận (data/battle-b17.js): chọn bãi lau, cánh Toa Đô hành quân (tốc,
// × 0,8 mỗi đồn, đồn ta chặn, trần dừng giao chiến 20 s / hồi 30 s), ba đồn, Kế Sách Phục kích bãi lau (lộ, giữ vững, cửa sổ, G), đứng lại dưới nửa
// Sinh lực, P5, tới cửa sông là thua, chụp / khôi phục, xác định; lớp phủ đầm lầy (bùn, gò); chữ nhạy cảm. Cuối tệp: dựng world B17 thật trong Node
// (như fort.test.mjs) — lớp phủ bật khi dựng, gỡ khi dispose, heightAt / mudAt trở lại đúng hàm của B15. Chạy trong Node:
//   node game/tests/b17-sim.test.mjs
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const threeUrl = pathToFileURL(join(here, "../vendor/three/three.module.js")).href;
registerHooks({ resolve: (s, c, next) => (s === "three" ? { url: threeUrl, shortCircuit: true } : next(s, c)) });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => new Proxy({}, { get: (o, k) => (k in o ? o[k] : () => ({ width: 0 })), set: (o, k, v) => ((o[k] = v), true) }) }) };

const S = await import("../js/sim/b17.js");
const D = await import("../js/data/battle-b17.js");
const { MAP, BASES, FRONTS, lineToX, BASE_RING } = await import("../js/data/battle-b15.js");
const G = await import("../js/battle/ground.js");
const { speedFactor, perchNear } = await import("../js/sim/terrain-rules.js");
const { createB17, tickB17, sideB17, snapshotB17, restoreB17, along, routeS, OUT_S, STOP_S, BED_S, ROUTE_LEN, columnHead } = S;

let pass = 0, fail = 0;
async function t(name, fn) {
  try { await fn(); pass++; console.log("  ok  " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + (e.stack || e.message)); }
}

// đầu vào giả: tướng ở p, địch theo bảng foes [{ x, z }], cờ của director
const inp = (p, { foes = [], alive = true, engaged = false, bossHalf = false, bossDown = false, wingsHold = true, heroToBoss = 999, ksPress = false, pick = null } = {}) => ({
  hero: { x: p.x, z: p.z, alive }, engaged, bossHalf, bossDown, wingsHold, heroToBoss, ksPress, pick,
  foesAt: (x, z, r) => foes.filter((f) => Math.hypot(f.x - x, f.z - z) < r).length,
});
const FAR = { x: 30, z: 150 };                                 // tướng đứng xa mọi vòng, xa Toa Đô
function run(st, sec, I, dt = 0.1) { const ev = []; for (let i = 0; i < Math.round(sec / dt); i++) ev.push(...tickB17(st, typeof I === "function" ? I(st) : I, dt)); return ev; }
const types = (ev) => ev.map((e) => e.type);
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
// đưa trận vào P2 bằng đúng luật
function toP2(st, bed = "W") { run(st, 0.1, inp(FAR, { pick: bed })); assert.equal(st.phase, 1); assert.equal(st.bed, bed); }
// hạ đồn i (đứng trong vòng đủ capSec, không địch)
function takeOutpost(st, i) { const O = D.OUTPOSTS[i]; run(st, O.capSec + 0.2, inp(O)); assert.ok(st.outposts[i].taken, O.id); }

console.log("Dữ liệu B17");
await t("5 pha có goal, tip, par; par = tổng; 3 đồn, 2 bãi lau (mỗi bãi 2 chỗ phục binh, 3 gò); ghi chú sử ≥ 3", () => {
  assert.equal(D.PHASES.length, 5);
  for (const P of D.PHASES) assert.ok(P.goal && P.tip && P.par > 0, P.id);
  assert.equal(D.PAR_B17, D.PHASES.reduce((s, p) => s + p.par, 0));
  assert.equal(D.OUTPOSTS.length, 3); assert.equal(D.BEDS.length, 2);
  for (const B of D.BEDS) { assert.equal(B.wings.length, 2, B.id); assert.equal(B.mounds.length, 3, B.id); }
  assert.ok(D.HISTORY_NOTES.length >= 3 && D.HISTORY_NOTES.every((n) => n.label && n.text));
  assert.deepEqual(D.KS_ORDER, ["phucKich"]); assert.equal(D.KE_SACH.phucKich.hk, 20); assert.equal(D.KE_SACH.phucKich.window, 30);
});
await t("ba đồn trùng đồn A1, doanh trại A2, cổng A3 của world.js (vị trí, vòng chiếm); lộ trình đi qua cả ba", () => {
  for (const O of D.OUTPOSTS) {
    const b = BASES.find((x) => x.id === O.id), f = FRONTS[b.front];
    const x = b.type === "cong" ? MAP.fortWallX : lineToX(f, b.lineX);
    assert.ok(near(O.x, x, 0.01) && near(O.z, f.laneZ, 0.01), O.id);
    assert.equal(O.r, BASE_RING[b.type], O.id);
    const p = along(D.ROUTE, routeS(D.ROUTE, O)); assert.ok(Math.hypot(p.x - O.x, p.z - O.z) < 0.5, O.id + " trên lộ trình");
  }
  assert.ok(OUT_S[0] < OUT_S[1] && OUT_S[1] < OUT_S[2], "thứ tự đồn dọc đường");
  for (let i = 0; i < 3; i++) assert.ok(STOP_S[i] > (i ? OUT_S[i - 1] : 0) && STOP_S[i] < OUT_S[i]);
});
await t("lộ trình, bãi lau, gò, mốc cửa sông ở trên đất; mốc ở góc đông bắc; chỗ phục binh cách đường ≥ 15 m; gò không đè đường", () => {
  for (let s = 0; s <= ROUTE_LEN; s += 5) { const p = along(D.ROUTE, s); assert.ok(G.waterDist(p.x, p.z) > 5, JSON.stringify(p)); }
  assert.ok(D.MOUTH.x > 560 && D.MOUTH.z < -140 && G.waterDist(D.MOUTH.x, D.MOUTH.z) > 3);
  const end = D.ROUTE.at(-1); assert.ok(Math.hypot(end.x - D.MOUTH.x, end.z - D.MOUTH.z) < 1);
  const routeD = (p) => { const q = along(D.ROUTE, routeS(D.ROUTE, p)); return Math.hypot(q.x - p.x, q.z - p.z); };
  for (const B of D.BEDS) {
    assert.ok(BED_S[B.id] != null && BED_S[B.id] > OUT_S[1], B.id + " sau đồn thứ hai");
    for (const w of B.wings) { assert.ok(D.inRect(B, w.x, w.z), B.id + " chỗ phục"); assert.ok(routeD(w) >= 15, B.id + " phục binh sát đường " + routeD(w).toFixed(1)); }
    for (const m of B.mounds) { assert.ok(D.inRect(B, m.x, m.z), B.id + " gò"); assert.ok(routeD(m) >= m.r + 2, B.id + " gò đè đường"); assert.ok(G.waterDist(m.x, m.z) > m.r); }
  }
  assert.ok(BED_S.W < BED_S.E, "bãi tây trước bãi đông");
});

await t("vật đầm (MARSH_PROPS, mẫu ENV): trên đất, cách đường cánh đi ≥ 9 m, không đè chỗ phục binh, gò, đồn; mã có trong assets/models; B17 nạp trước đất Hàm Tử + mã đầm", async () => {
  const { readFileSync } = await import("node:fs");
  const index = JSON.parse(readFileSync(join(here, "../assets/models/index.json"), "utf8"));
  const routeD = (p) => { const q = along(D.ROUTE, routeS(D.ROUTE, p)); return Math.hypot(q.x - p.x, q.z - p.z); };
  for (const p of D.MARSH_PROPS) {
    const k = `${p.id}@${p.x},${p.z}`;
    assert.ok(index["env/" + p.id], k);
    assert.ok(G.waterDist(p.x, p.z) > 4, k + " trên đất");
    assert.ok(routeD(p) >= 9, k + " sát đường " + routeD(p).toFixed(1));
    for (const B of D.BEDS) { for (const w of B.wings) assert.ok(Math.hypot(w.x - p.x, w.z - p.z) > 12, k + " chỗ phục"); for (const m of B.mounds) assert.ok(Math.hypot(m.x - p.x, m.z - p.z) > m.r + 3, k + " gò"); }
    for (const O of D.OUTPOSTS) assert.ok(Math.hypot(O.x - p.x, O.z - p.z) > 25, k + " đồn");
  }
  const { BATTLES } = await import("../js/data/battles.js"), W = await import("../js/battle/world.js");
  assert.deepEqual(await BATTLES.B17.env(), [...W.WORLD_ENV, ...D.ENV_B17]);
});

console.log("Luật B17 (sim/b17.js)");
await t("trạng thái đầu: P1, cánh ở đầu đường, chưa chọn bãi, Kế Sách khả dụng; cửa sổ × ksWin", () => {
  const st = createB17({ ksWin: 0.75 });
  assert.equal(st.phase, 0); assert.equal(st.col.s, 0); assert.equal(st.bed, null); assert.equal(st.col.len, ROUTE_LEN);
  assert.equal(st.ks.phucKich.state, "khadung"); assert.equal(st.ks.phucKich.window, 22.5);
  assert.deepEqual(st.main, [false, false, false]);
});
await t("P1: chọn bãi ở bảng → P2; hết 60 s chưa chọn thì bãi tây (tự động); cánh chưa đi trong P1", () => {
  const a = createB17(); run(a, 30, inp(FAR)); assert.equal(a.phase, 0); assert.equal(a.col.s, 0);
  const ev = run(a, 0.1, inp(FAR, { pick: "E" }));
  assert.deepEqual(types(ev), ["bedPicked", "phase"]); assert.equal(a.bed, "E"); assert.equal(a.bedAuto, false); assert.equal(a.phase, 1);
  const b = createB17(); const ev2 = run(b, D.AMBUSH.pickSec + 0.2, inp(FAR));
  assert.ok(types(ev2).includes("bedPicked")); assert.equal(b.bed, "W"); assert.equal(b.bedAuto, true); assert.equal(b.phase, 1);
});
await t("cánh đi COLUMN.speed m/s; mỗi đồn ta hạ × 0,8 (3 đồn: × 0,512); đồn hạ được ở mọi pha, có nhắc đếm ngược", () => {
  const st = createB17(); toP2(st);
  const s0 = st.col.s; run(st, 10, inp(FAR)); assert.ok(near(st.col.s - s0, D.COLUMN.speed * 10, 1e-6), st.col.s);
  const O = D.OUTPOSTS[0]; tickB17(st, inp(O), 0.1);
  assert.ok(st.prompt && st.prompt.text.includes(O.name) && st.prompt.text.includes("còn"), JSON.stringify(st.prompt));
  run(st, 1, inp(O, { foes: [{ x: O.x + 2, z: O.z }] }));
  assert.ok(st.outposts[0].blockedRing && st.prompt.text.includes("dẹp"));
  for (let i = 0; i < 3; i++) takeOutpost(st, i);
  assert.ok(near(st.col.mult, 0.512, 1e-9)); assert.equal(st.taken, 3); assert.equal(st.main[1], true);
});
await t("hạ đồn trước khi cánh tới: cánh dừng ở chỗ dừng của đồn đúng 15 s (một lần), rồi đi tiếp", () => {
  const st = createB17(); toP2(st); takeOutpost(st, 0);
  const ev = run(st, (STOP_S[0] - st.col.s) / (D.COLUMN.speed * st.col.mult) + 1, inp(FAR));
  assert.ok(types(ev).includes("outpostBlock")); assert.ok(near(st.col.s, STOP_S[0], 1e-6)); assert.equal(st.col.halt, "outpost");
  run(st, D.OUTPOST_BLOCK.sec - 1.5, inp(FAR)); assert.ok(near(st.col.s, STOP_S[0], 1e-6), "còn bị chặn");
  run(st, 1, inp(FAR)); assert.ok(st.col.s > STOP_S[0], "hết 15 s thì đi");
  const ev2 = run(st, 30, inp(FAR)); assert.ok(!types(ev2).includes("outpostBlock"), "chỉ chặn một lần");
});
await t("Toa Đô giao chiến: cánh dừng tối đa 20 s cộng dồn, rồi 30 s đẩy tiếp dù vẫn bị đánh, rồi lại dừng được", () => {
  const st = createB17(); toP2(st); run(st, 5, inp(FAR));
  const s0 = st.col.s;
  const ev = run(st, 19.5, inp(FAR, { engaged: true }));
  assert.ok(types(ev).includes("engage")); assert.ok(near(st.col.s, s0, 1e-9)); assert.equal(st.col.halt, "engage");
  const ev2 = run(st, 1, inp(FAR, { engaged: true }));
  assert.ok(types(ev2).includes("engageEnd")); assert.ok(st.col.s > s0);
  const s1 = st.col.s; run(st, 28, inp(FAR, { engaged: true }));
  assert.ok(near(st.col.s - s1, 28 * D.COLUMN.speed, 0.3), "hồi 30 s: cánh đi đủ tốc");
  run(st, 3, inp(FAR, { engaged: true })); const s2 = st.col.s; run(st, 2, inp(FAR, { engaged: true }));
  assert.ok(near(st.col.s, s2, 1e-9), "hết hồi: lại dừng được");
});
await t("Toa Đô vào bãi đã chọn, tướng ngoài 40 m: P3, cửa sổ 30 s × ksWin; G khi phục binh Giữ vững → thành công, đội hình vỡ, P4", () => {
  const st = createB17({ ksWin: 0.75 }); toP2(st, "W");
  const ev = run(st, BED_S.W / D.COLUMN.speed + 0.5, inp(FAR));
  assert.ok(types(ev).includes("bedEnter") && types(ev).includes("ksOpen")); assert.equal(st.phase, 2);
  assert.equal(st.ks.phucKich.state, "sansang"); assert.ok(st.ks.phucKich.left <= 22.5 && st.ks.phucKich.left > 21);
  const ev2 = run(st, 0.1, inp(FAR, { ksPress: true, wingsHold: true }));
  assert.deepEqual(types(ev2).filter((x) => ["keSach", "stand", "phase"].includes(x)), ["keSach", "stand", "phase"]);
  assert.equal(st.ks.phucKich.state, "thanhcong"); assert.equal(st.col.stood, true); assert.equal(st.col.standWhy, "broken");
  assert.equal(st.col.morale, D.COLUMN.morale - D.KE_SACH.phucKich.morale); assert.equal(st.phase, 3); assert.equal(st.main[0], true);
  assert.ok(st.arena && st.arena.mound && st.arena.mound.bed === "W", JSON.stringify(st.arena));
  const s = st.col.s; run(st, 20, inp(FAR)); assert.equal(st.col.s, s, "đứng lại thì cánh thôi đi");
  const ev3 = run(st, 0.1, inp(FAR, { ksPress: true })); assert.deepEqual(types(ev3), ["ksIdle"], "Kế Sách thành công tối đa một lần");
  assert.deepEqual(sideB17(st), { S_AMBUSH: true });
});
await t("Phục kích thất bại: lộ (tướng trong 40 m lúc Toa Đô vào bãi), cánh không giữ vững, hết cửa sổ; G trước khi mở cửa sổ chỉ nhắc", () => {
  const a = createB17(); toP2(a);
  const e0 = run(a, 5, inp(FAR, { ksPress: true })); assert.ok(types(e0).includes("ksIdle")); assert.equal(a.ks.phucKich.state, "khadung");
  run(a, BED_S.W / D.COLUMN.speed, inp(FAR, { heroToBoss: 30 }));
  assert.equal(a.ks.phucKich.state, "thatbai"); assert.equal(a.ks.phucKich.why, "lo"); assert.equal(a.col.stood, false); assert.equal(a.phase, 2);
  const b = createB17(); toP2(b); run(b, BED_S.W / D.COLUMN.speed + 0.5, inp(FAR));
  run(b, 0.1, inp(FAR, { ksPress: true, wingsHold: false })); assert.equal(b.ks.phucKich.state, "thatbai"); assert.equal(b.ks.phucKich.why, "canh");
  const c = createB17(); toP2(c); run(c, BED_S.W / D.COLUMN.speed + 0.5, inp(FAR)); run(c, 31, inp(FAR));
  assert.equal(c.ks.phucKich.state, "thatbai"); assert.equal(c.ks.phucKich.why, "muon"); assert.deepEqual(sideB17(c), { S_AMBUSH: false });
});
await t("bãi đông: cánh qua bãi tây không mở cửa sổ; vào bãi đông mới mở", () => {
  const st = createB17(); toP2(st, "E");
  run(st, (BED_S.W + 5) / D.COLUMN.speed, inp(FAR)); assert.equal(st.ks.phucKich.state, "khadung"); assert.equal(st.phase, 1);
  run(st, (BED_S.E - BED_S.W) / D.COLUMN.speed, inp(FAR)); assert.equal(st.ks.phucKich.state, "sansang"); assert.equal(st.phase, 2);
});
await t("Toa Đô chạm sàn nửa Sinh lực khi cánh còn đi: đứng lại (P2 → P4 thẳng), lên gò gần nhất; hạ → P5; P5 hết địch (≥ 2 s) hoặc 20 s thì thắng", () => {
  const st = createB17(); toP2(st); run(st, 100, inp(FAR)); assert.equal(st.phase, 1);
  const ev = run(st, 0.1, inp(FAR, { bossHalf: true }));
  assert.ok(types(ev).includes("stand")); assert.equal(st.col.standWhy, "half"); assert.equal(st.phase, 3); assert.equal(st.ks.phucKich.state, "khadung");
  const head = columnHead(st), A = st.arena;
  assert.ok(Math.hypot(A.x - head.x, A.z - head.z) <= D.COLUMN.standSeek);
  run(st, 0.1, inp(FAR, { bossDown: true })); assert.equal(st.phase, 4); assert.equal(st.main[2], true);
  const foe = [{ x: A.x, z: A.z }];
  run(st, 5, inp(FAR, { foes: foe })); assert.equal(st.over, false);
  const ev2 = run(st, 0.2, inp(FAR)); assert.ok(types(ev2).includes("win")); assert.equal(st.won, true);
  const b = createB17(); toP2(b); run(b, 100, inp(FAR)); run(b, 0.1, inp(FAR, { bossHalf: true })); run(b, 0.1, inp(FAR, { bossDown: true }));
  run(b, D.REMNANTS.sec + 0.2, inp(FAR, { foes: [b.arena] })); assert.equal(b.won, true, "giữ đủ 20 s");
});
await t("đầu cánh tới mốc cửa sông là thua; quá giờ là thua; trận kết thúc thì tick không làm gì", () => {
  const st = createB17(); toP2(st);
  const ev = run(st, ROUTE_LEN / D.COLUMN.speed + 2, inp(FAR, { heroToBoss: 30 }));
  assert.ok(types(ev).includes("lose")); assert.equal(st.won, false); assert.ok(st.col.arrived); assert.ok(st.why.includes("cửa sông"));
  assert.deepEqual(tickB17(st, inp(FAR), 1), []);
  const b = createB17({ timeout: 50 }); run(b, 51, inp(FAR, { engaged: true })); assert.equal(b.over, true); assert.equal(b.won, false);
});
await t("chụp / khôi phục giữ trạng thái; hai lượt cùng đầu vào cho cùng sự kiện (xác định)", () => {
  const script = (st) => (st.t < 0.2 ? inp(FAR, { pick: "W" }) : st.t < 40 ? inp(D.OUTPOSTS[0]) : st.t < 90 ? inp(FAR, { engaged: st.t > 60 && st.t < 85 }) : inp(FAR, { ksPress: st.t > 200 && st.t < 200.2 }));
  const a = createB17(), b = createB17();
  const ea = run(a, 260, script), eb = run(b, 260, script);
  assert.deepEqual(ea, eb); assert.deepEqual(a, b);
  const st = createB17(); run(st, 100, script); const snap = snapshotB17(st);
  run(st, 100, script); assert.notDeepEqual(st, snap);
  restoreB17(st, snap); assert.deepEqual(st, snap);
});

await t("Quân Viễn Chinh: cứ 180 s Sĩ Khí cánh −10; về 0 thì đội hình vỡ (đứng lại, như phục kích)", () => {
  const st = createB17(); toP2(st);
  const ev = run(st, D.COLUMN.moraleEvery + 0.05, inp(FAR, { engaged: true }));
  assert.ok(types(ev).includes("moraleDrop")); assert.equal(st.col.morale, D.COLUMN.morale - D.COLUMN.moraleDrop);
  st.col.morale = D.COLUMN.moraleDrop;
  const ev2 = run(st, D.COLUMN.moraleEvery, inp(FAR, { engaged: true }));
  assert.ok(types(ev2).includes("stand")); assert.equal(st.col.standWhy, "morale"); assert.ok(S.routed(st)); assert.equal(st.phase, 3);
});

console.log("Lớp phủ đầm lầy, gò");
await t("bùn: mặt đường A khô, trong bãi lau và dải bờ bắc chậm 25% (bộ) / 50% (kỵ); đỉnh gò khô; ngoài đầm khô", () => {
  assert.equal(S.mudB17(400, -75), 0); assert.equal(S.mudB17(200, 50), 0);
  assert.equal(S.mudB17(400, -90), D.MUD.level); assert.equal(S.mudB17(300, -160), D.MUD.level);
  const m = D.BEDS[0].mounds[0]; assert.equal(S.mudB17(m.x, m.z), 0); assert.ok(near(S.moundDh(m.x, m.z), m.h));
  assert.equal(S.moundDh(400, -75), 0);
  const flat = () => 0, mud = () => D.MUD.level;
  assert.ok(near(speedFactor(0, 0, 1, 0, flat, mud), 0.75, 1e-9)); assert.ok(near(speedFactor(0, 0, 1, 0, flat, mud, true), 0.5, 1e-9));
  assert.ok(near(speedFactor(0, 0, 1, 0, flat, mud, false), speedFactor(0, 0, 1, 0, flat, mud)), "không truyền mounted: như cũ");
});
await t("chữ nhạy cảm (canon B17.sensitivity): dữ liệu trận không có \"thủ cấp\", \"chém đầu\"", () => {
  const all = JSON.stringify([D.PHASES, D.KE_SACH, D.HISTORY_NOTES, D.BOSS_B17, D.OUTPOSTS, D.BEDS, D.SIDE_MISSIONS]).toLowerCase();
  for (const w of ["thủ cấp", "chém đầu"]) assert.ok(!all.includes(w), w);
});

console.log("BigUnit: tùy chọn của B17 (march, fate \"killed\", lastStand); không đặt thì như cũ");
const THREE0 = await import("three");
const { BigUnit } = await import("../js/battle/units.js");
const { makeRng } = await import("../js/core/rng.js");
const { DIFFICULTY } = await import("../js/data/tuning.js");
function bigCtx() {
  const hero = { x: 3, z: 0, alive: true, state: "free", st: 0, dur: 1, giap: 50, hits: [], lock: null, receiveHit(o) { this.hits.push(o); return "hit"; } };
  const calls = [];
  const ctx = { R: 16, rng: makeRng(3), diff: DIFFICULTY[1], hero, units: [], clock: 0, openGates: {}, world: { colliders: [], gates: {} }, scene: new THREE0.Scene(),
    fx: { telegraph() {}, shake() {}, shockwave() {}, dust() {}, banner() {} }, audio: { play() {} }, crowd: { agents: [], hittable: () => false, damage() {}, rout() {} },
    director: { onBossKilled: () => calls.push("killed"), onBossDefeated: () => calls.push("defeated"), onLastStand: () => calls.push("ls"), onOfficerAwake() {}, onBreak() {}, onOfficerKilled() {} } };
  return { ctx, hero, calls };
}
const boss = (ctx, extra = {}) => new BigUnit(ctx, { kind: "boss", side: "dich", tier: "tuong", rigKey: "X19", name: "Toa Đô", x: 0, z: 0, awake: true, ...extra });
const step = (ctx, u, sec) => { for (let i = 0; i < Math.round(sec * 60); i++) { ctx.clock += 1 / 60; u.update(1 / 60); } };
await t("không đặt tùy chọn (B15, B20): tướng Nguyên về 0 Sinh lực thì rút chạy (onBossDefeated); dưới 25% không có Chí Tử Chiến", () => {
  const { ctx, calls } = bigCtx(), u = boss(ctx);
  assert.equal(u.fate, null); assert.equal(u.lastStand, null);
  const c0 = u.cong; u.takeHeroHit(u.maxHp * 0.8, 0); assert.equal(u.lsOn, false); assert.equal(u.cong, c0);
  u.takeHeroHit(u.maxHp, 0);
  assert.equal(u.retreating, true); assert.equal(u.dead, 0); assert.deepEqual(calls, ["defeated"]);
});
await t("fate \"killed\": về 0 Sinh lực thì tử trận (ngã, nằm lại, không rút, không gỡ rig), onBossKilled; không nhận đòn nữa", () => {
  const { ctx, hero, calls } = bigCtx(), u = boss(ctx, { fate: "killed" });
  hero.lock = u;
  const r = u.takeHeroHit(u.maxHp * 2, 0);
  assert.equal(r.killed, true); assert.equal(u.killed, true); assert.ok(u.dead > 0); assert.equal(u.retreating, false); assert.deepEqual(calls, ["killed"]); assert.equal(hero.lock, null);
  step(ctx, u, 6); assert.equal(u.alive, true, "nằm lại, không gỡ sau 3,5 s như sĩ quan");
  assert.deepEqual(u.takeHeroHit(100, 0), {});
});
await t("lastStand (Chí Tử Chiến): dưới 25% bật một lần (Công × 1,3, onLastStand); cứ 8 s bổ đất sóng chấn r 6 m, không đỡ được, rồi về đánh thường", () => {
  const { ctx, hero, calls } = bigCtx(), u = boss(ctx, { fate: "killed", lastStand: D.LAST_STAND });
  const c0 = u.cong;
  u.takeHeroHit(u.maxHp * 0.5, 0); assert.equal(u.lsOn, false);
  u.takeHeroHit(u.maxHp * 0.3, 0); assert.equal(u.lsOn, true); assert.ok(near(u.cong, c0 * 1.3, 1e-6)); assert.deepEqual(calls, ["ls"]);
  u.takeHeroHit(1, 0); assert.deepEqual(calls, ["ls"], "chỉ một lần");
  let slamAt = null;
  for (let i = 0; i < 60 * 10 && slamAt == null; i++) { ctx.clock += 1 / 60; u.update(1 / 60); if (u.slam) slamAt = i / 60; }
  assert.ok(slamAt != null && slamAt >= D.LAST_STAND.first - 0.05 && slamAt <= D.LAST_STAND.first + 4, "cú bổ đầu sau first giây (đồng hồ đứng khi đang vung đòn thường, lùi né): " + slamAt);
  hero.hits.length = 0; step(ctx, u, D.LAST_STAND.tele + 0.4);
  const hit = hero.hits.find((h) => h.unblockable);
  assert.ok(hit && hit.knockdown && hit.dmg > 0, JSON.stringify(hero.hits.map((h) => h.unblockable)));
  step(ctx, u, 0.6); assert.equal(u.slam, null); assert.notEqual(u.state, "ult");
});
await t("march: đi theo điểm của mình trong cánh, không ra đòn dù tướng đứng sát, vẫn nhận đòn; bỏ march thì đánh lại", () => {
  const { ctx, hero } = bigCtx(), u = boss(ctx);
  u.march = { x: 20, z: 0, v: 1.8 };
  step(ctx, u, 3);
  assert.ok(u.x > 3, "đi về phía điểm: " + u.x); assert.equal(hero.hits.length, 0); assert.notEqual(u.state, "atk");
  const hp = u.hp; u.takeHeroHit(500, 0); assert.ok(u.hp < hp, "vẫn nhận đòn");
  u.march = null; hero.x = u.x + 2; hero.z = u.z;
  step(ctx, u, 6); assert.ok(hero.hits.length > 0, "đánh lại khi bỏ march");
});

console.log("World B17 thật (Node): lớp phủ bật khi dựng, gỡ khi dispose");
await t("B17.buildWorld bật lớp phủ (gò cao lên, bùn ở bãi lau), giữ vòng 3 đồn; dispose gỡ: heightAt / mudAt trở lại đúng hàm B15, như chưa vào B17", async () => {
  const THREE = await import("three");
  const B15 = (await import("../js/battles/b15.js")).default, B17 = (await import("../js/battles/b17.js")).default;
  B15.buildWorld(new THREE.Scene(), { shadows: false });
  const h0 = G.heightAt, m0 = G.mudAt, pts = [[382, -89], [400, -90], [300, -160], [210, -75], [520, -120]];
  const snap = () => pts.map(([x, z]) => [G.heightAt(x, z), G.mudAt(x, z)]);
  const before = snap();
  const w = B17.buildWorld(new THREE.Scene(), { shadows: false });
  assert.ok(G.overlay(), "lớp phủ bật");
  const m = D.BEDS[0].mounds[0];
  assert.ok(near(G.heightAt(m.x, m.z) - G.analyticHeightAt(m.x, m.z), m.h, 0.35), "đỉnh gò cao thêm ~h");
  assert.equal(G.mudAt(400, -90), D.MUD.level);
  for (const O of D.OUTPOSTS) assert.ok(w.bases[O.id].ring.visible, O.id);
  assert.equal(w.bases.B2.ring.visible, false);
  assert.ok(w.b17.reeds.count > 1000 && w.b17.mounds.geometry.attributes.position.count > 0);
  // gò hiện cho cung thủ (perchNear): trên đất B17 tìm được gò của bãi lau
  const pm = perchNear(m.x + 5, m.z, m.x + 11, m.z, 16); assert.ok(pm && D.BEDS[0].mounds.includes(pm), JSON.stringify(pm));
  B17.dispose({});
  assert.equal(G.overlay(), null); assert.equal(G.heightAt, h0); assert.equal(G.mudAt, m0);
  assert.deepEqual(snap(), before);
  assert.ok(!D.BEDS[0].mounds.includes(perchNear(m.x + 5, m.z, m.x + 11, m.z, 16)), "gỡ lớp phủ: gò B17 không còn");
  assert.equal(w.b17.marsh, null, "chưa nạp mô hình: không có vật đầm (lau, gò code vẫn có)");
  // đã nạp mẫu ENV đầm và cột cờ (như màn tải): vật đầm gộp một lưới
  const { readFileSync } = await import("node:fs"), { parseHKM, putModel } = await import("../js/battle/glb.js");
  const index = JSON.parse(readFileSync(join(here, "../assets/models/index.json"), "utf8"));
  for (const id of [...D.ENV_B17, "ENV_cot_co"]) { const b = readFileSync(join(here, "../assets/models", index["env/" + id].file)); putModel("env/" + id, parseHKM(b.buffer.slice(b.byteOffset, b.byteOffset + b.length))); }
  const w2 = B17.buildWorld(new THREE.Scene(), { shadows: false });
  assert.ok(w2.b17.marsh && w2.b17.marsh.geometry.attributes.position.count > 1000, "vật đầm từ mẫu");
  B17.dispose({});
  // trận trước vỡ giữa chừng (không dispose): buildWorld của trận sau (setTerrain) cũng gỡ lớp phủ
  B17.buildWorld(new THREE.Scene(), { shadows: false }); assert.ok(G.overlay());
  B15.buildWorld(new THREE.Scene(), { shadows: false });
  assert.equal(G.overlay(), null); assert.equal(G.heightAt, h0); assert.equal(G.mudAt, m0); assert.deepEqual(snap(), before);
});

console.log(`\n${pass} đạt, ${fail} trượt`);
if (fail) process.exitCode = 1;
