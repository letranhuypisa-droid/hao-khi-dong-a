// tests/gatebar.test.mjs — đợt 15a: cổng Hàm Tử quan hiện độ bền. Người chơi: "yêu cầu phải đánh phá cửa để mở, nhưng không hiển thị HP của cửa".
// (1) battle/gatebar.js (thuần): chọn cổng cho ô mục tiêu (vừa bị đánh ≤ 3 s ưu tiên, không thì gần nhất trong 25 m, bỏ cổng đã mở), khóa trước P3
//     kèm câu vì sao, chữ số "7.340 / 11.000" (cùng kiểu n() của main.js), phần trăm làm tròn lên, mục tiêu P3 kèm phần trăm từng cổng
//     (dạng đủ cho máy tính / thẻ mở, dạng ngắn "Phá A3 64% hoặc B3 100%" cho thẻ một dòng của HUD gọn).
// (2) Director trong Node: damageGate ghi lần trúng cả khi cổng còn khóa (khóa thì không trừ, không bật số), mở khóa thì trừ và bật "−N" trên cổng;
//     gateTarget() / goalText() đọc đúng sim, world, openGates.
//   node hao-khi-viet/game/tests/gatebar.test.mjs
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const threeUrl = pathToFileURL(join(here, "../vendor/three/three.module.js")).href;
registerHooks({ resolve: (s, c, next) => (s === "three" ? { url: threeUrl, shortCircuit: true } : next(s, c)) });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => new Proxy({}, { get: (o, k) => (k in o ? o[k] : () => ({ width: 0 })), set: (o, k, v) => ((o[k] = v), true) }) }) };

const { gateTarget, gateGoal, gateGoalShort, gatePct, gateText, GATE_WHY, GATE_PHASE } = await import("../js/battle/gatebar.js");
const { PHASES, BASES, FRONTS, ENEMY_MIX } = await import("../js/data/battle-b15.js");

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log("  ok  " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + (e.stack || e.message)); }
}

// hai cổng như B15: cùng một mặt tường x, cách nhau theo z
const A3 = { id: "A3", name: "A3 · Cổng bắc Hàm Tử quan", x: 470, z: -75, hp: 11000, max: 11000, open: false };
const B3 = { id: "B3", name: "B3 · Cổng nam Hàm Tử quan", x: 470, z: 75, hp: 11000, max: 11000, open: false };
const gates = (a = {}, b = {}) => [{ ...A3, ...a }, { ...B3, ...b }];
const near = (g, d = 6) => ({ x: g.x - d, z: g.z });
const pick = (o) => gateTarget({ phase: 2, now: 100, lastHit: null, ...o });

console.log("Chọn cổng cho ô mục tiêu");
t("cổng chưa mở gần tướng nhất trong 25 m", () => {
  assert.equal(pick({ gates: gates(), hero: near(A3) }).id, "A3");
  assert.equal(pick({ gates: gates(), hero: near(B3, 12) }).id, "B3");
  assert.equal(pick({ gates: gates(), hero: near(A3) }).hit, false, "đứng gần, chưa đánh: hit false");
});
t("xa hơn R thì null; đúng R vẫn chọn; R đổi được", () => {
  assert.equal(pick({ gates: gates(), hero: near(A3, 25.01) }), null);
  assert.equal(pick({ gates: gates(), hero: near(A3, 25) }).id, "A3");
  assert.equal(pick({ gates: gates(), hero: near(A3, 30), R: 40 }).id, "A3");
  assert.equal(pick({ gates: [], hero: near(A3) }), null, "trận không có cổng");
});
t("cổng đã mở không bao giờ chọn — kể cả gần nhất, kể cả vừa bị đánh", () => {
  const gs = gates({ open: true, hp: 0 });
  assert.equal(pick({ gates: gs, hero: near(A3) }), null, "B3 cách 150 m");
  assert.equal(pick({ gates: gs, hero: near(A3), lastHit: { id: "A3", t: 99.5 } }), null);
  const mid = { x: A3.x - 5, z: 0 };                            // giữa hai cổng, cách mỗi cổng ~75 m
  assert.equal(pick({ gates: gates({ open: true }), hero: mid, R: 100 }).id, "B3");
});
t("cổng vừa bị đánh (≤ 3 s) ưu tiên hơn cổng gần hơn, và hiện cả khi tướng đã ra xa", () => {
  const r = pick({ gates: gates(), hero: near(B3, 3), lastHit: { id: "A3", t: 98 } });
  assert.equal(r.id, "A3"); assert.equal(r.hit, true);
  assert.equal(pick({ gates: gates(), hero: { x: 0, z: 0 }, lastHit: { id: "A3", t: 97 } }).id, "A3", "đúng 3 s vẫn hiện");
});
t("hết showHit thì về cổng gần nhất (hit false); lastHit ở tương lai (tải lại điểm lưu lùi giờ trận) không tính", () => {
  const r = pick({ gates: gates(), hero: near(B3, 3), lastHit: { id: "A3", t: 96.9 } });
  assert.equal(r.id, "B3"); assert.equal(r.hit, false);
  assert.equal(pick({ gates: gates(), hero: { x: 0, z: 0 }, lastHit: { id: "A3", t: 96.9 } }), null);
  assert.equal(pick({ gates: gates(), hero: { x: 0, z: 0 }, lastHit: { id: "A3", t: 140 } }), null);
  assert.equal(pick({ gates: gates(), hero: near(B3), lastHit: { id: "A3", t: 99 }, showHit: 0.5 }).id, "B3", "showHit đổi được");
});
t("lastHit trỏ cổng không có trong danh sách: về cổng gần nhất", () => {
  assert.equal(pick({ gates: gates(), hero: near(B3), lastHit: { id: "X9", t: 100 } }).id, "B3");
});

console.log("Khóa theo pha");
t("P1, P2 (phase 0, 1): khóa, why nói phải chiếm A2 trước; P3, P4 (phase 2, 3): mở khóa, why null", () => {
  assert.equal(GATE_PHASE, 2);
  assert.equal(GATE_WHY, "Khóa: chiếm Doanh trại trên bãi (A2) trước");
  for (const phase of [0, 1]) { const r = pick({ gates: gates(), hero: near(A3), phase }); assert.equal(r.locked, true); assert.equal(r.why, GATE_WHY); }
  for (const phase of [2, 3]) { const r = pick({ gates: gates(), hero: near(A3), phase }); assert.equal(r.locked, false); assert.equal(r.why, null); }
});
t("câu khóa khớp câu nhắc của director (chiếm Doanh trại trên bãi (A2)) và mục tiêu P2", () => {
  assert.ok(GATE_WHY.includes(PHASES[1].goal.replace(/^Chiếm /, "")), PHASES[1].goal);
});

console.log("Chữ số và phần trăm");
t("text cùng kiểu n() của main.js (toLocaleString vi-VN): '7.340 / 11.000'; trả đủ trường", () => {
  const r = pick({ gates: gates({ hp: 7340 }), hero: near(A3) });
  assert.equal(r.text, "7.340 / 11.000");
  assert.deepEqual(Object.keys(r).sort(), ["hit", "hp", "id", "locked", "max", "name", "pct", "text", "why"]);
  assert.equal(r.name, A3.name); assert.equal(r.hp, 7340); assert.equal(r.max, 11000); assert.equal(r.pct, 67);
  const n = (v) => Math.round(v).toLocaleString("vi-VN");       // y như main.js
  assert.equal(gateText(12650, 12650), `${n(12650)} / ${n(12650)}`, "R cao: gốc 11000 × S(R)");
});
t("hp lẻ (đòn = Công × MV / 3): số làm tròn LÊN như số máu tướng; 0 thì '0 / …'", () => {
  assert.equal(gateText(7339.2, 11000), "7.340 / 11.000");
  assert.equal(gateText(0.3, 11000), "1 / 11.000", "còn chút độ bền: không hiện 0");
  assert.equal(gateText(0, 11000), "0 / 11.000");
});
t("pct 0..100 làm tròn lên khi > 0: còn 1 độ bền là 1% (không 0%); 0 là 0%; đầy 100%; 7040 là đúng 64 (không nhảy 65 vì sai số dấu phẩy động)", () => {
  assert.equal(gatePct(1, 11000), 1);
  assert.equal(gatePct(0.2, 11000), 1);
  assert.equal(gatePct(0, 11000), 0);
  assert.equal(gatePct(-5, 11000), 0);
  assert.equal(gatePct(11000, 11000), 100);
  assert.equal(gatePct(7040, 11000), 64);
  assert.equal(gatePct(7040.5, 11000), 65);
  assert.equal(gatePct(12000, 11000), 100, "không vượt 100");
  assert.equal(gatePct(5, 0), 0, "max 0: không chia cho 0");
  for (let hp = 1; hp <= 11000; hp += 37) { const p = gatePct(hp, 11000); assert.ok(p >= 1 && p <= 100 && p >= (hp / 11000) * 100 - 1e-9, `${hp} → ${p}`); }
});
t("ô mục tiêu với hp 0 (chưa kịp mở): pct 0, text '0 / 11.000'", () => {
  const r = pick({ gates: gates({ hp: 0 }), hero: near(A3) });
  assert.equal(r.pct, 0); assert.equal(r.text, "0 / 11.000");
});

console.log("Mục tiêu P3 kèm phần trăm");
t("đúng chuỗi goal của PHASES[2]: 'Phá Cổng bắc (A3) 64% hoặc Cổng nam (B3) 100%'", () => {
  assert.equal(PHASES[GATE_PHASE].goal, "Phá Cổng bắc (A3) hoặc Cổng nam (B3)");
  assert.equal(gateGoal(PHASES[2].goal, gates({ hp: 7040 })), "Phá Cổng bắc (A3) 64% hoặc Cổng nam (B3) 100%");
  assert.equal(gateGoal(PHASES[2].goal, gates({ hp: 1 }, { hp: 0.4 })), "Phá Cổng bắc (A3) 1% hoặc Cổng nam (B3) 1%");
});
t("cổng đã mở thì thôi phần trăm; không có cổng thì giữ nguyên chuỗi", () => {
  assert.equal(gateGoal(PHASES[2].goal, gates({ open: true, hp: 0 }, { hp: 5500 })), "Phá Cổng bắc (A3) hoặc Cổng nam (B3) 50%");
  assert.equal(gateGoal(PHASES[2].goal, []), PHASES[2].goal);
  assert.equal(gateGoal("Đánh lui Toa Đô", gates()), "Đánh lui Toa Đô", "chuỗi không nhắc cổng: không đổi");
});
t("HUD gọn (thẻ một dòng, ~200 px cho mục tiêu): dạng ngắn 'Phá A3 64% hoặc B3 100%' — đủ phần trăm cả hai cổng; cổng mở thì bỏ; hết cổng thì null", () => {
  assert.equal(gateGoalShort(gates({ hp: 7040 })), "Phá A3 64% hoặc B3 100%");
  assert.equal(gateGoalShort(gates({ hp: 1 }, { hp: 0.4 })), "Phá A3 1% hoặc B3 1%");
  assert.equal(gateGoalShort(gates({ open: true, hp: 0 }, { hp: 5500 })), "Phá B3 50%");
  assert.equal(gateGoalShort(gates({ open: true }, { open: true })), null);
  assert.equal(gateGoalShort([]), null);
  assert.ok(PHASES[GATE_PHASE].goal.startsWith("Phá "), "cùng động từ với mục tiêu P3");
  const long = gateGoal(PHASES[2].goal, gates({ hp: 7040 })), short = gateGoalShort(gates({ hp: 7040 }));
  assert.ok(short.length <= long.length - 18, `${short.length} so với ${long.length}: ngắn hơn hẳn`);
});

console.log("Director: lần trúng cổng, ô mục tiêu, thẻ nhiệm vụ");
const { Director } = await import("../js/battle/director.js");
const { createSim } = await import("../js/sim/front.js");
function dworld(phase) {
  const sim = createSim({ fronts: FRONTS, bases: BASES, enemyMix: ENEMY_MIX, R: 1, earthworks: false });
  const texts = [], played = [];
  const ctx = {
    sim, hero: { x: 0, z: 0, alive: true }, openGates: { A3: false, B3: false },
    world: { gates: { A3: { x: A3.x, z: A3.z, shake: 0 }, B3: { x: B3.x, z: B3.z, shake: 0 } } },
    fx: { text: (x, z, s, color) => texts.push({ x, z, s, color }) }, audio: { play: (k) => played.push(k) },
  };
  const d = Object.create(Director.prototype);
  Object.assign(d, { ctx, phase, time: 50, msgs: [] }); ctx.director = d;
  return { ctx, d, sim, texts, played };
}
t("còn khóa (P2): không trừ độ bền, không bật số, nhưng ghi lần trúng — ô mục tiêu hiện cổng khóa kèm vì sao dù tướng đứng xa", () => {
  const { ctx, d, sim, texts } = dworld(1);
  const g0 = sim.bases.A3.gate;
  d.damageGate("A3", 500);
  assert.equal(sim.bases.A3.gate, g0); assert.equal(texts.length, 0);
  assert.deepEqual(d.gateHit, { id: "A3", t: 50 });
  assert.equal(d.msgs.length, 1, "câu nhắc cũ vẫn nói (nhát đầu)");
  ctx.hero.x = -500;
  const r = d.gateTarget();
  assert.equal(r.id, "A3"); assert.equal(r.locked, true); assert.equal(r.why, GATE_WHY); assert.equal(r.hit, true);
  assert.equal(r.max, sim.bases.A3.gate0); assert.ok(r.name.includes("Cổng bắc"), r.name);
  d.time = 53.5; assert.equal(d.gateTarget(), null, "quá 3 s, tướng ở xa: không còn");
});
t("mở khóa (P3): trừ độ bền, bật '−N' (làm tròn) trên cổng, ghi lần trúng; ô mục tiêu có số và phần trăm", () => {
  const { ctx, d, sim, texts } = dworld(2);
  const g0 = sim.bases.A3.gate;
  d.damageGate("A3", 123.6);
  assert.ok(Math.abs(sim.bases.A3.gate - (g0 - 123.6)) < 1e-9);
  assert.equal(texts.length, 1); assert.equal(texts[0].s, "−124");
  assert.ok(Math.abs(texts[0].x - A3.x) < 4 && Math.abs(texts[0].z - A3.z) < 4, "chữ nằm ở mặt cổng");
  assert.ok(ctx.world.gates.A3.shake > 0);
  d.time = 51; d.damageGate("A3", 40); assert.equal(texts.length, 2); assert.equal(texts[1].s, "−40");
  assert.deepEqual(d.gateHit, { id: "A3", t: 51 });
  ctx.hero.x = A3.x - 5; ctx.hero.z = A3.z;
  const r = d.gateTarget();
  assert.equal(r.locked, false); assert.equal(r.why, null);
  assert.equal(r.text, gateText(g0 - 163.6, g0)); assert.equal(r.pct, gatePct(g0 - 163.6, g0));
});
t("trúng cổng đã mở / không có: không làm gì", () => {
  const { d, sim, texts } = dworld(2);
  sim.bases.A3.open = true; const g0 = sim.bases.A3.gate;
  d.damageGate("A3", 100); d.damageGate("X9", 100);
  assert.equal(sim.bases.A3.gate, g0); assert.equal(texts.length, 0); assert.equal(d.gateHit, undefined);
});
t("gateTarget() bỏ cổng đã phá (ctx.openGates) dù đứng sát", () => {
  const { ctx, d } = dworld(3);
  ctx.openGates.A3 = true; ctx.hero.x = A3.x - 2; ctx.hero.z = A3.z;
  assert.equal(d.gateTarget(), null);
});
t("goalText(): P3 là mục tiêu kèm phần trăm từng cổng; pha khác null (thẻ dùng PHASES[].goal)", () => {
  const { d, sim } = dworld(2);
  sim.bases.A3.gate = Math.round(sim.bases.A3.gate0 * 0.64);
  assert.equal(d.goalText(), "Phá Cổng bắc (A3) 64% hoặc Cổng nam (B3) 100%");
  for (const p of [0, 1, 3]) { d.phase = p; assert.equal(d.goalText(), null, `phase ${p}`); }
});
t("goalText(true) (HUD gọn, thẻ đang gập): dạng ngắn; hai cổng đều mở thì về dạng đủ; pha khác vẫn null", () => {
  const { ctx, d, sim } = dworld(2);
  sim.bases.A3.gate = Math.round(sim.bases.A3.gate0 * 0.64);
  assert.equal(d.goalText(true), "Phá A3 64% hoặc B3 100%");
  ctx.openGates.A3 = true;
  assert.equal(d.goalText(true), "Phá B3 100%");
  ctx.openGates.B3 = true;
  assert.equal(d.goalText(true), PHASES[2].goal);
  for (const p of [0, 1, 3]) { d.phase = p; assert.equal(d.goalText(true), null, `phase ${p}`); }
});

console.log(`\n${pass} đạt, ${fail} trượt`);
process.exit(fail ? 1 : 0);
