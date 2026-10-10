// tests/wc09.test.mjs — lớp WC09 Cung và H40 Nguyễn Khoái (đợt B17-B1): số của lớp, bảng đòn, rồi lõi tướng thật (hero.js, three qua
// module hook, ctx giả như hero-def.test.mjs): DPS chuỗi N ≈ 1,3 MV/s đo bằng lõi (tính cả bay, nối đòn), tên xuyên, trúng trễ theo
// quãng bay, nón tự nhắm ±30° / 25 m (cả lính thường), ngắm chính xác khi căng dây, mưa tên, Khí Lực tầm xa, đi khi bắn; H35 không đổi.
//   node game/tests/wc09.test.mjs
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const threeUrl = pathToFileURL(join(here, "../vendor/three/three.module.js")).href;
registerHooks({ resolve: (s, c, next) => (s === "three" ? { url: threeUrl, shortCircuit: true } : next(s, c)) });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => new Proxy({}, { get: (o, k) => (k in o ? o[k] : () => ({ width: 0 })), set: (o, k, v) => ((o[k] = v), true) }) }) };

const { MOVES } = await import("../js/data/tuning.js");
const { HEROES, moveFlags, deriveStats, CHAINS, movesetOf } = await import("../js/data/heroes.js");
const { MOVES_WC09, MOVE_INFO_WC09, CHAIN_N } = await import("../js/data/moves-wc09.js");
const { WEAPON_CLASSES, WC09, poisePerMv, chargeMult } = await import("../js/data/weapon-classes.js");
const { moveInfoOf, nextHeavy } = await import("../js/data/moves-info.js");
const P = await import("../js/meta/progress.js");
const { Hero, segHit } = await import("../js/battle/hero.js");
const { ANIMS } = await import("../js/battle/hero-anim.js");
const { BigUnit } = await import("../js/battle/units.js");
const { SKILLS } = await import("../js/data/heroes.js");
const { TIERS } = await import("../js/data/tuning.js");
const W9 = await import("../js/battle/anim-wc09.js");
const THREE = await import("three");

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log("  ok  " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + (e.stack || e.message).split("\n").slice(0, 3).join("\n       ")); }
}
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ""} ${a} ≉ ${b} (±${tol})`);

// ---- dữ liệu ------------------------------------------------------------------------------------------------------
console.log("Lớp WC09, bảng đòn");
t("WC09: MV 0,68 · tốc 1,2 · Phá Thế 0,6 · tầm N 25 m (systems §4.4); Phá Thế mỗi MV 12; tầm xa", () => {
  assert.deepEqual([WC09.mv, WC09.speed, WC09.poise, WC09.rangeN], [0.68, 1.2, 0.6, 25]);
  assert.equal(WEAPON_CLASSES.WC09, WC09); assert.equal(poisePerMv(WC09), 12); assert.equal(WC09.ranged, true);
  const R = WC09.traits.ranged; assert.equal(R.aimCone, 30); assert.equal(R.aimRange, 25); assert.ok(R.kiR >= 25);
  near(WC09.mv * WC09.speed, 0.816, 1e-9, "mv × tốc ≈ 0,81 (§4.2 tầm xa)");
});
t("MV bảng đòn = §4.2 × 0,68 (±0,01); C1 tụ (căng dây), C3 giữ, C5 / C6 mở ở cấp 5 / 10", () => {
  const STD = { N1: 0.8, N2: 0.8, N3: 0.9, N4: 1.0, N5: 1.1, N6: 1.6, C1: 1.8, C2: 1.2, C3: 0.5, C4: 3.0, C5: 3.2, C6: 4.5, DN: 1.0, DC: 2.0, DQ: 8.0 };
  for (const k in STD) near(MOVES_WC09[k].mv, STD[k] * 0.68, 0.011, k);
  assert.equal(MOVES_WC09.C3.hits.length, 5); assert.equal(MOVES_WC09.C3.hold.maxHits, 10);
  assert.equal(MOVES_WC09.C1.charge, true); assert.ok(MOVES_WC09.C1.chargeU < MOVES_WC09.C1.hits[0]);
  assert.equal(MOVES_WC09.C5.unlockLv, 5); assert.equal(MOVES_WC09.C6.unlockLv, 10);
  assert.deepEqual(CHAIN_N, ["N1", "N2", "N3", "N4", "N5", "N6"]); assert.equal(CHAINS.WC09, CHAIN_N);
});
t("cờ: đòn bắn = ranged (không trúng tức thì), đạp / phản đòn là cận chiến; lính chỉ né cú đạp", () => {
  for (const k in MOVES_WC09) {
    const F = moveFlags(k, MOVES_WC09[k]);
    assert.equal(F.ranged, MOVES_WC09[k].shape === "ray" || MOVES_WC09[k].shape === "rain", k);
  }
  assert.equal(moveFlags("C2", MOVES_WC09.C2).ranged, false); assert.equal(moveFlags("CT", MOVES_WC09.CT).ranged, false);
  assert.deepEqual(Object.keys(MOVES_WC09).filter((k) => moveFlags(k, MOVES_WC09[k]).heavyTell), ["C2"]);
  for (const k in MOVES) assert.equal(moveFlags(k, MOVES[k]).ranged, false, "WC03 " + k);
});
t("tầm bắn không nhân Tầm của tướng; mọi đòn tên tới ≥ 25 m trừ Đòn Quyết (bắn sát mặt)", () => {
  for (const k in MOVES_WC09) if (MOVES_WC09[k].shape === "ray" && k !== "DQ") assert.ok(MOVES_WC09[k].range >= 25, k);
});
t("anim-wc09: mọi đòn, mọi u cho số hữu hạn; khung buông khác khung căng; ANIMS.WC09 đủ khoá bảng đòn", () => {
  for (const k in MOVES_WC09) assert.ok(ANIMS.WC09[k], k);
  for (const k in ANIMS.WC09) for (let u = 0; u <= 1.0001; u += 0.02) for (const [c, v] of Object.entries(ANIMS.WC09[k](Math.min(1, u)))) if (typeof v === "number") assert.ok(Number.isFinite(v), `${k}@${u.toFixed(2)} ${c}`);
  const h = MOVES_WC09.N1.hits[0], a = ANIMS.WC09.N1(h), b = ANIMS.WC09.N1(Math.min(1, h + 0.06));
  assert.ok(Math.abs(a.elRx - b.elRx) + Math.abs(a.shRy - b.shRy) + Math.abs(a.shRz - b.shRz) > 0.05, "buông dây phải đổi tay phải");
  for (const k of ["guard", "block", "idle", "run", "hitReact", "dodgeRoll", "knockdown"]) assert.ok(W9.POSES_WC09[k] !== undefined, k);
});

console.log("H40 Nguyễn Khoái (data)");
t("H40 = canon (Công 3, Thủ 3, Tốc 3, Tầm 5, Thống Suất 3); số cấp 1 = deriveStats; lớp WC09", () => {
  const H = HEROES.H40, d = deriveStats(H.stats);
  assert.deepEqual(H.stats, { cong: 3, thu: 3, toc: 3, tam: 5, thong: 3 });
  for (const k of ["cong1", "hp1", "giap1", "move", "atkSpeed", "rangeMul", "aura", "skMult", "cmdCd", "bodyguards"]) assert.equal(H[k], d[k], k);
  assert.equal(H.cls, "WC09"); assert.equal(movesetOf(H), MOVES_WC09); assert.equal(H.rig, "H40");
  assert.equal(moveInfoOf(H).C1.name, MOVE_INFO_WC09.C1.name); assert.equal(moveInfoOf("H40").skill.name, "Tên Xuyên Hàng");
});

// ---- lõi thật với ctx giả ------------------------------------------------------------------------------------------------
console.log("Lõi tướng H40 (ctx giả)");
const noop = new Proxy({}, { get: () => () => {} });
function makeRng(seed = 7) { let s = seed >>> 0; const next = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; return { next, chance: (p) => next() < p, range: (a, b) => a + (b - a) * next() }; }
function makeCtx({ agents = [], units = [], camYaw = 0, director = {} } = {}) {
  const ctx = {
    scene: new THREE.Scene(), rng: makeRng(), clock: 0, diff: { revive: 1, dmg: 1 }, hk: { tpc: false }, cam: { yaw: camYaw },
    world: { arena: true, gates: {}, colliders: [] }, openGates: {}, units, battle: { heroSpawn: { x: 0, z: 0, yaw: 0 } },
    fx: noop, audio: noop, hud: null, cinematic() {}, hitstop() {}, slowmo() {},
    crowd: {
      agents, arrows: [], hittable: (a) => a.alive && a.hp > 0, rout: () => 0,
      strikeable: (a) => a.alive && a.hp > 0, enlist: () => false,
      damage(a, dmg, opt) { a.hp -= dmg; a.hits = (a.hits || 0) + 1; a.hitAt = ctx.clock; a.lastOpt = opt; a.dmg = (a.dmg || 0) + dmg; if (a.hp <= 0) a.alive = false; return a.hp <= 0; },
    },
    director: { onHeroAction() {}, onHeroHit() {}, onRevive() {}, onHeroDead() {}, damageGate() {}, plantFlag() {}, onUlt() {}, ultQ() {}, ...director },
  };
  return ctx;
}
const input = (o = {}) => ({ pressed: {}, held: {}, touch: false, block: false, moveX: 0, moveY: 0, ...o });
const DT = 1 / 60;
function run(h, sec, inp = input(), each = null) {
  const n = Math.round(sec / DT);
  for (let i = 0; i < n; i++) { h.ctx.clock += DT; each?.(i, inp); h.intake(inp); h.update(DT, inp); inp.pressed = {}; }
}
const soldier = (x, z) => ({ x, z, side: "dich", alive: true, hp: 1e6, giap: 0, scale: 1, K: {}, role: "melee" });
const dummy = (x, z) => ({ x, z, y: 0, side: "dich", alive: true, dead: 0, retreating: false, isBig: true, radius: 0.8, hp: 1e9, maxHp: 1e9, giap: 0, broken: 0,
  name: "Bù nhìn", rig: { scale: 1 }, hitsTaken: 0, dmg: 0, hitAt: [],
  takeHeroHit(dmg, poise, o) { this.hp -= dmg; this.dmg += dmg; this.hitsTaken++; this.hitAt.push(h0clock()); this.lastO = o; this.poise = (this.poise || 0) + poise; return {}; } });
let curCtx = null; const h0clock = () => curCtx.clock;
const statsH40 = () => { const s = P.newSave(); return { ...P.heroStats(s, 16, "H40"), crit: 0 }; };
function mk(o = {}, def = HEROES.H40) { const ctx = curCtx = makeCtx(o); const h = new Hero(ctx, statsH40(), def); ctx.hero = h; return { ctx, h }; }

t("dựng H40: bảng WC09, ANIMS.WC09, Phá Thế 12/MV, tầm xa, tên cầm tay, không vệt lưỡi; H35 không đổi (kiR 12, không tầm xa)", () => {
  const { h } = mk();
  assert.equal(h.M, MOVES_WC09); assert.equal(h.A, ANIMS.WC09); assert.equal(h.poisePerMv, 12); assert.ok(h.ranged); assert.equal(h.kiR, WC09.traits.ranged.kiR);
  assert.ok(h.handArrow && h.handArrow.parent === h.rig.p.handR); assert.equal(h.trails.length, 0); assert.equal(h.rangeMul, 1.15);
  const s35 = P.heroStats(P.newSave(), 1), h35 = new Hero(makeCtx(), s35);
  assert.equal(h35.ranged, null); assert.equal(h35.kiR, 12); assert.equal(h35.handArrow, null); assert.deepEqual(h35.shots, []);
});
t("segHit: đoạn bay cắt vòng người (trả quãng), trượt thì −1", () => {
  near(segHit(0, 0, 0, 1, 10, 0.3, 5, 0.5), 5, 1e-9); assert.equal(segHit(0, 0, 0, 1, 10, 0.6, 5, 0.5), -1);
  assert.equal(segHit(0, 0, 0, 1, 4, 0, 5, 0.5), -1); near(segHit(0, 0, 0, 1, 4.6, 0, 5, 0.5), 4.6, 1e-9);
});
t("DPS đơn mục tiêu chuỗi N (bấm dồn, Tốc đánh ×1,0, mục tiêu 15 m): ≈ 1,3 MV/s (±10%, §2.2 tầm xa)", () => {
  const u = dummy(0, 15), { ctx, h } = mk({ units: [u] }, { ...HEROES.H40, atkSpeed: 1 });
  ctx.rng = { next: () => 0.5, chance: () => false };
  const inp = input(); run(h, 1.0, inp, (i, p) => { p.pressed.n = true; });     // vào nhịp
  const d0 = u.dmg, t0 = ctx.clock;
  run(h, 30, inp, (i, p) => { p.pressed.n = true; });
  const mvs = (u.dmg - d0) / h.effCong() / (ctx.clock - t0);
  near(mvs, 1.3, 0.13, "MV/s"); console.log("       đo: " + mvs.toFixed(3) + " MV/s");
  assert.ok(h.combo > 0);
});
t("N1 trúng trễ đúng quãng bay (20 m / 40 m/s = 0,5 s sau lúc buông), không trúng lúc buông", () => {
  const a = soldier(0, 20), { ctx, h } = mk({ agents: [a] });
  const inp = input(); inp.pressed.n = true;
  const rel = MOVES_WC09.N1.hits[0] * MOVES_WC09.N1.dur / h.atkSpeed;
  run(h, rel + 0.02, inp);
  assert.equal(h.shots.length, 1, "tên đang bay"); assert.equal(a.hits || 0, 0, "chưa trúng lúc buông");
  assert.equal(ctx.crowd.arrows.length, 1, "có hình mũi tên trong crowd.arrows");
  run(h, 0.5, input());
  assert.equal(a.hits, 1);
  const flight = a.hitAt - rel, want = (20 - 0.45 - 0.4 - 0.12) / WC09.traits.ranged.arrowSpeed;   // từ chỗ buông (0,45 m trước tướng) tới mép vòng trúng
  near(flight, want, 2 * DT + 0.005, "thời gian bay");
  assert.equal(h.shots.length, 0); assert.equal(ctx.crowd.arrows[0].T, 0, "tên cắm: hình dừng");
});
t("mục tiêu chạy khỏi đường tên trước khi tên tới thì trượt", () => {
  const a = soldier(0, 22), { h } = mk({ agents: [a] });
  const inp = input(); inp.pressed.n = true;
  run(h, 0.4, inp);
  assert.equal(h.shots.length, 1); a.x = 3;
  run(h, 0.8, input()); assert.equal(a.hits || 0, 0);
});
t("xuyên: N1 trúng 1 người đầu hàng, C1 (tên nặng) 2, C5 (Xuyên Vân) cả 5; thứ tự gần trước", () => {
  const line = () => [6, 8, 10, 12, 14].map((z) => soldier(0, z));
  const fire = (key, lvl = 25) => {
    const agents = line(), { h } = mk({ agents });
    h.stats.level = lvl; h.startMove(key); run(h, 2.2, input());
    return agents.map((a) => a.hits || 0);
  };
  assert.deepEqual(fire("N1"), [1, 0, 0, 0, 0]);
  assert.deepEqual(fire("C1"), [1, 1, 0, 0, 0]);
  assert.deepEqual(fire("C5"), [1, 1, 1, 1, 1]);
});
t("N6 tỏa 3 tên: tên giữa MV đủ, hai tên bên nửa MV, ba người ở ba hướng đều trúng", () => {
  const A0 = soldier(0, 12), L = soldier(Math.sin(-0.16) * 12, Math.cos(-0.16) * 12), R = soldier(Math.sin(0.16) * 12, Math.cos(0.16) * 12);
  const { ctx, h } = mk({ agents: [A0, L, R] }); ctx.rng = { next: () => 0.5, chance: () => false };
  h.yaw = 0; h.shotTarget = A0; h.startMove("N6"); h.yaw = 0; run(h, 1.4, input());
  assert.deepEqual([A0.hits, L.hits, R.hits], [1, 1, 1]);
  near(L.dmg / A0.dmg, 0.5, 1e-6);
});
t("nón tự nhắm ±30° tới 25 m quanh hướng ngắm (PC: camera), cả lính thường; ngoài nón / ngoài tầm thì bắn thẳng", () => {
  const ang = (deg, d) => soldier(Math.sin(deg * Math.PI / 180) * d, Math.cos(deg * Math.PI / 180) * d);
  { const a = ang(25, 18), { h } = mk({ agents: [a] }); const i = input(); run(h, DT, i); assert.equal(h.aimTarget(), a); i.pressed.n = true; run(h, DT, i); near(h.yaw, 25 * Math.PI / 180, 1e-6); }
  { const a = ang(35, 18), { h } = mk({ agents: [a] }); const i = input(); run(h, DT, i); assert.equal(h.aimTarget(), null); i.pressed.n = true; run(h, DT, i); near(h.yaw, 0, 1e-6); }
  { const a = ang(0, 26.5), { h } = mk({ agents: [a] }); const i = input(); run(h, DT, i); assert.equal(h.aimTarget(), null); }
  // camera quay 90°: hướng ngắm theo camera (tâm màn), người ở 90° được chọn
  { const a = ang(90, 15), { h } = mk({ agents: [a], camYaw: Math.PI / 2 }); const i = input(); run(h, DT, i); near(h.aimYaw, Math.PI / 2, 1e-9); assert.equal(h.aimTarget(), a); }
  // cảm ứng / tay cầm: hướng cần (cần trung tính thì camera)
  { const a = ang(-90, 15), { h } = mk({ agents: [a] }); const i = input({ touch: true, moveX: 1 }); run(h, DT, i); near(h.aimYaw, -Math.PI / 2, 1e-6); assert.equal(h.aimTarget(), a); }
  // người gần tâm ngắm thắng người gần mà lệch
  { const far = ang(2, 20), close = ang(25, 6), { h } = mk({ agents: [far, close] }); run(h, DT, input()); assert.equal(h.aimTarget(), far); }
});
t("giữ C ở C1 = căng dây, ngắm chính xác: tên đi đúng hướng camera, không tự nhắm người lệch 20°; thả ra mới bắn; MV × căng dây", () => {
  const off = soldier(Math.sin(0.35) * 15, Math.cos(0.35) * 15), straight = soldier(0, 24);
  const { ctx, h } = mk({ agents: [off, straight] });
  const inp = input({ held: { c: true } }); inp.pressed.c = true;
  run(h, 1.7, inp);
  assert.equal(h.move, "C1"); assert.ok(h.charge?.on, "đang căng dây"); assert.equal(h.aiming, true); assert.equal(h.aimMark, null);
  assert.equal(h.shots.length, 0, "chưa buông");
  inp.held.c = false; run(h, 1.4, inp);
  assert.equal(off.hits || 0, 0, "không tự nhắm khi ngắm chính xác"); assert.equal(straight.hits, 1);
  near(h.chargeMul, 1.5, 1e-9, "căng hết (cấp 3)");
});
t("mưa tên C4: trúng mọi địch trong 5 m × Tầm quanh mình sau delay; ngoài vòng không", () => {
  const inR = [soldier(3, 2), soldier(-4, -3), soldier(0, 5.5)], out = soldier(0, 7.5);
  const { ctx, h } = mk({ agents: [...inR, out] });
  h.startMove("C4");
  const rel = MOVES_WC09.C4.hits[0] * MOVES_WC09.C4.dur / h.atkSpeed;
  run(h, rel + MOVES_WC09.C4.delay - 0.05, input());
  assert.ok(inR.every((a) => !a.hits), "chưa rơi");
  run(h, 0.1, input());
  assert.deepEqual(inR.map((a) => a.hits), [1, 1, 1]); assert.equal(out.hits || 0, 0);
});
t("Khí Lực tầm xa: địch ở 25 m thì H40 nạp, H35 không", () => {
  const { h } = mk({ agents: [soldier(0, 25)] }); run(h, 2, input()); assert.ok(h.ki > 2, `ki ${h.ki}`);
  const c = makeCtx({ agents: [soldier(0, 25)] }), h35 = new Hero(c, P.heroStats(P.newSave(), 1)); run(h35, 2, input()); assert.equal(h35.ki, 0);
});
t("đi khi bắn: giữ cần trong lúc bắn N thì vẫn đi (chậm hơn chạy), C1 đang căng dây cũng đi chậm", () => {
  const { h } = mk({ agents: [soldier(0, 20)] });
  const inp = input({ moveX: 1 }); run(h, 0.6, inp, (i, p) => { if (i % 10 === 0) p.pressed.n = true; });
  assert.equal(h.state, "attack");
  const x0 = h.x; run(h, 0.3, inp); const v = Math.abs(h.x - x0) / 0.3;
  assert.ok(v > 0.3 * HEROES.H40.move && v < 0.75 * HEROES.H40.move, `tốc khi bắn ${v.toFixed(2)}`);
});
t("Đòn Quyết của cung: bắn từ 8 m vào kẻ Vỡ Thế, tên chỉ trúng kẻ đó (lính chắn đường không đỡ)", () => {
  const u = dummy(0, 7); u.broken = 2; const block = soldier(0, 3);
  const { h } = mk({ units: [u], agents: [block] });
  assert.equal(h.findBroken(), u);
  const inp = input(); inp.pressed.c = true; run(h, 1.2, inp);
  assert.equal(u.hitsTaken, 1); assert.equal(block.hits || 0, 0); assert.equal(u.lastO.finisher, true);
});
t("nextHeavy: H40 cấp 14 (R16) đang N5 → C6; cấp 8 đang N5 → C5 (C6 mở ở cấp 10)", () => {
  const { h } = mk({ agents: [soldier(0, 3)] });
  assert.equal(h.stats.level, 14);
  h.state = "attack"; h.move = "N4"; h.chain = 4; assert.equal(nextHeavy(h), "C5");
  h.move = "N5"; h.chain = 5; assert.equal(nextHeavy(h), "C6");
  h.stats.level = 8; assert.equal(nextHeavy(h), "C5");
});

// ---- B2: kỹ năng H40, trạng thái khống chế của BigUnit ----------------------------------------------------------------------
console.log("Kỹ năng H40 (đợt B17-B2)");
// BigUnit thật (units.js) trong ctx giả: đủ trường cho constructor / update / takeHeroHit
function bigCtx(o) { const c = makeCtx(o); Object.assign(c, { R: 1, diff: { revive: 1, dmg: 1, hp: 1, poise: 1 }, director: { ...c.director, onOfficerAwake() {}, onBreak() {}, onOfficerKilled() {}, onBossDefeated() {} } }); return c; }
const realUnit = (ctx, tier, x, z) => { const u = new BigUnit(ctx, { kind: "officer", side: "dich", tier, name: TIERS[tier].name, x, z, awake: true }); ctx.units.push(u); return u; };
t("BigUnit.applyStatus: ghim đứng yên rồi tự hết; kéo về điểm rồi trói; trong lúc bị giữ không ra đòn mà vẫn nhận đòn; hết thì status = null", () => {
  const ctx = curCtx = bigCtx({}); const hero = new Hero(ctx, statsH40(), HEROES.H40); ctx.hero = hero;
  const u = realUnit(ctx, "photuong", 0, 6);
  assert.equal(u.status, null);
  u.applyStatus("pin", 1.5); const x0 = u.x, z0 = u.z;
  for (let i = 0; i < 60; i++) { ctx.clock += DT; u.update(DT); }
  near(u.x, x0, 1e-9); near(u.z, z0, 1e-9); assert.ok(u.status && u.status.pinT > 0); assert.ok(!["atk", "red", "ult"].includes(u.state));
  const hp0 = u.hp; u.takeHeroHit(100, 0); assert.ok(u.hp < hp0, "vẫn nhận đòn khi bị ghim");
  for (let i = 0; i < 40; i++) { ctx.clock += DT; u.update(DT); }
  assert.equal(u.status, null, "hết ghim");
  const v = realUnit(ctx, "doitruong", 0, 20);
  v.applyStatus("pull", { x: 0, z: 10, sec: 0.9 }); v.applyStatus("bind", 4);
  for (let i = 0; i < 60; i++) { ctx.clock += DT; v.update(DT); }
  near(v.z, 10, 0.05, "kéo tới điểm"); assert.ok(v.status.bindT > 2.5);
  const z1 = v.z; for (let i = 0; i < 180; i++) { ctx.clock += DT; v.update(DT); } near(v.z, z1, 1e-9, "trói: đứng yên");
  for (let i = 0; i < 120; i++) { ctx.clock += DT; v.update(DT); } assert.equal(v.status, null);
});
t("Tên Xuyên Hàng: 5 tên tỏa, mỗi tên xuyên 4 người; người thứ 4 bị ghim 1,5 s (lính: choáng); hồi 12 s", () => {
  const line = [5, 8, 11, 14, 17].map((z) => soldier(0, z)), { h } = mk({ agents: line });
  const inp = input(); inp.pressed.skill = true; run(h, DT, inp);
  assert.equal(h.state, "skill"); assert.equal(h.skillReady(1), false); near(h.skillCd.tenXuyenHang, 12, 0.02);
  run(h, 1.4, input());
  assert.equal(h.state, "free");
  // tên giữa xuyên đúng 4 người (người thứ 5 ở 17 m không trúng); tên hai bên tỏa ±0,1 rad cũng trúng mấy người gần
  const hits = line.map((a) => a.hits || 0);
  assert.equal(hits[4], 0, `hits ${hits}`); assert.equal(hits[3], 1, `hits ${hits}`); assert.ok(hits[0] >= 3, `hits ${hits}`);
  assert.equal(line[3].lastOpt.stun, SKILLS.tenXuyenHang.pin); assert.ok(!line[2].lastOpt.stun);
  assert.deepEqual(h.skillSlots().map((s) => [s.key, s.name]), [["E", "Tên Xuyên Hàng"], ["T", "Chặn Dòng Dụ Địch"]]);
});
t("Tên Xuyên Hàng: sĩ quan đứng thứ 4 trên đường tên bị ghim (BigUnit.applyStatus)", () => {
  const ctx = curCtx = bigCtx({ agents: [5, 8, 11].map((z) => soldier(0, z)) }); const h = new Hero(ctx, statsH40(), HEROES.H40); ctx.hero = h;
  const u = realUnit(ctx, "photuong", 0, 15); u.hp = u.maxHp = 1e6;
  h.yaw = 0; const inp = input(); inp.pressed.skill = true; run(h, DT, inp); h.yaw = 0;
  run(h, 1.2, input());
  assert.ok(u.status?.pinT > 0, "sĩ quan bị ghim");
});
t("Chặn Dòng: hàng cọc 15 m cách 9 m chắn lính địch (đẩy về phía bên kia), hết 15 s thì gỡ; hồi 35 s", () => {
  const a = soldier(0, 9.2), b = soldier(10, 9.1), { ctx, h } = mk({ agents: [a, b] });
  ctx.scene.add = ctx.scene.add.bind(ctx.scene);
  const inp = input(); inp.pressed.skill2 = true; run(h, DT, inp);
  assert.equal(h.state, "skill"); run(h, 0.8, input());
  assert.ok(h.fence, "đã thả hàng cọc"); assert.ok(h.fence.mesh.parent === ctx.scene);
  const S = SKILLS.chanDong; near(Math.hypot(h.fence.cx, h.fence.cz), S.ahead, 0.3);
  assert.ok(a.z >= 9 + S.thick / 2 + 0.4 - 1e-6, `lính bị đẩy ra ngoài dải: z ${a.z}`); near(b.z, 9.1, 1e-9, "ngoài chiều dài 15 m: không chặn");
  a.z = 8.7; run(h, DT, input()); assert.ok(a.z >= 9 + S.thick / 2 + 0.4 - 1e-6 || a.z <= 9 - S.thick / 2 - 0.4 + 1e-6);
  run(h, 15, input()); assert.equal(h.fence, null); assert.ok(h.skillCd.chanDong > 35 - 16.5 && h.skillCd.chanDong < 35 - 15);
});
t("Móc Tên Trói Thuyền: tốn 100 Khí Lực, móc tướng trong 35 m, kéo lại 10 m, trói 4 s; boss mất 50% Phá Thế; không có tướng thì không tốn", () => {
  const ctx = curCtx = bigCtx({}); const h = new Hero(ctx, statsH40(), HEROES.H40); ctx.hero = h;
  h.ki = 100; const inp0 = input(); inp0.pressed.ult = true; run(h, DT, inp0);
  assert.equal(h.state, "free"); assert.equal(h.ki > 99, true, "không có tướng: không tốn Khí Lực");
  const boss = realUnit(ctx, "tuong", 0, 25); boss.poise = boss.poiseMax;
  h.ki = 150; const inp = input(); inp.pressed.ult = true; run(h, DT, inp);
  assert.equal(h.state, "ult"); assert.ok(h.ki < 51 && h.ki > 49); assert.ok(h.invuln > 2);
  run(h, 1.4, input());
  assert.ok(h.ultS.hooked === boss, "móc trúng boss");
  near(boss.poise, boss.poiseMax * 0.5, 1e-6, "mất 50% Phá Thế");
  for (let i = 0; i < 70; i++) { ctx.clock += DT; boss.update(DT); h.update(DT, input()); }
  near(Math.hypot(boss.x - h.x, boss.z - h.z), 25 - SKILLS.mocTen.pull, 0.6, "kéo lại 10 m");
  assert.ok(boss.status.bindT > 2.5, "đang bị trói");
  run(h, 2, input()); assert.equal(h.state, "free"); assert.equal(h.ultS.rope, null);
});
t("Thánh Dực Dũng Nghĩa: trên boong tầm bắn +20% (nón tự nhắm, tầm tên); thuyền địch mắc cạn trong 30 m: +1 Khí Lực/s mỗi thuyền", () => {
  const a = soldier(0, 28), { ctx, h } = mk({ agents: [a] });
  run(h, DT, input()); assert.equal(h.rangeBonus, 1); assert.equal(h.aimTarget(), null);
  h.deck = {}; run(h, DT, input()); near(h.rangeBonus, 1.2, 1e-9); assert.equal(h.aimTarget(), a);
  h.deck = null; ctx.crowd.agents.length = 0;
  ctx.naval = { boats: [{ side: "dich", state: "stranded", x: 10, z: 10 }, { side: "dich", state: "stranded", x: 40, z: 40 }, { side: "ta", state: "stranded", x: 5, z: 5 }] };
  h.ki = 0; h.kiEngaged = -1; run(h, 2, input()); near(h.ki, 2, 0.05);
});

console.log(`\n${pass} đạt, ${fail} lỗi`);
if (fail) process.exit(1);
