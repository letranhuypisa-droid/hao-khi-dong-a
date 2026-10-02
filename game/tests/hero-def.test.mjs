// tests/hero-def.test.mjs — lõi tướng theo HEROES (đợt 9, pha C): H35 dựng từ def giữ nguyên HERO / MOVES / luật cũ theo tên
// đòn, cờ đòn WC01, toán tụ lực, cửa sổ siêu giáp, dữ liệu kỹ năng; rồi dựng lớp Hero thật (three qua module hook) với ctx
// giả để chạy tụ lực, siêu giáp, Hịch Tướng Sĩ bị ngắt, Binh Thư đánh dấu, Tuyệt Kỹ Bạch Đằng Quyết Chiến.
//   node hao-khi-viet/game/tests/hero-def.test.mjs
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const threeUrl = pathToFileURL(join(here, "../vendor/three/three.module.js")).href;
registerHooks({ resolve: (s, c, next) => (s === "three" ? { url: threeUrl, shortCircuit: true } : next(s, c)) });
// models.js vẽ chữ trên cờ bằng canvas 2D: thay bằng canvas giả (không cần hình, chỉ cần dựng được rig)
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => new Proxy({}, { get: (o, k) => (k in o ? o[k] : () => ({ width: 0 })), set: (o, k, v) => ((o[k] = v), true) }) }) };

const { HERO, MOVES, POISE_PER_MV, heSoGiap } = await import("../js/data/tuning.js");
const { HEROES, SKILLS, MOVESETS, CHAINS, movesetOf, moveFlags, deriveStats, kiLucBarsAt } = await import("../js/data/heroes.js");
const { MOVES_WC01, MOVE_INFO_WC01 } = await import("../js/data/moves-wc01.js");
const { WEAPON_CLASSES, chargeMult, chargeLevel, poisePerMv } = await import("../js/data/weapon-classes.js");
const { MOVE_INFO, moveInfoOf, nextHeavy } = await import("../js/data/moves-info.js");
const P = await import("../js/meta/progress.js");
const { Hero } = await import("../js/battle/hero.js");
const { SKILL_IMPL } = await import("../js/battle/hero-skills.js");
const { ANIMS } = await import("../js/battle/hero-anim.js");
const THREE = await import("three");

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log("  ok  " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + (e.stack || e.message).split("\n").slice(0, 3).join("\n       ")); }
}
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ""} ${a} ≉ ${b} (±${tol})`);

// ---- dữ liệu ------------------------------------------------------------------------------------------------------
console.log("H35 dựng từ def = HERO / MOVES cũ");
t("HEROES.H35 mang đủ số của HERO", () => { for (const k in HERO) assert.deepEqual(HEROES.H35[k], HERO[k], k); });
t("bảng đòn H35 là CHÍNH đối tượng MOVES; chuỗi N1–N6", () => {
  assert.equal(movesetOf(HEROES.H35), MOVES); assert.equal(MOVESETS.WC03, MOVES);
  assert.deepEqual(CHAINS.WC03, ["N1", "N2", "N3", "N4", "N5", "N6"]);
});
t("Phá Thế mỗi MV: WC03 = POISE_PER_MV (14), WC01 = 30", () => { near(poisePerMv(WEAPON_CLASSES.WC03), POISE_PER_MV, 1e-9); assert.equal(poisePerMv(WEAPON_CLASSES.WC01), 30); });
// Luật cũ của hero.js (trước đợt 9, theo tên đòn / MV) — cờ suy ra phải trùng từng đòn của WC03.
const OLD_HEAVY_MOVES = new Set(["N6", "C1", "C2", "C3", "C4", "C5", "C6", "DC", "DQ"]);
const legacy = (key, m) => {
  const heavy = m.mv >= 2 || key === "DQ";
  return {
    heavy, heavyTell: OLD_HEAVY_MOVES.has(key),
    whooshHeavy: m.mv > 2 || key === "N6" || key[0] === "C" || key === "DC",
    kiai: (key[0] === "C" && key !== "CT") || key === "DQ" || key === "N6", kiaiP: key === "DQ" ? 1 : 0.4,
    slam: key === "C1" || key === "C4" || key === "C6" || key === "DQ",
    slamSound: (key === "C1" || key === "C4" || key === "C6" || key === "DQ") && key !== "C1",
    ringFx: m.shape === "ring" && (heavy || key === "N6"),
    chainN: key[0] === "N" && key !== "N6", endsChain: key === "N6",
    resetChain: key[0] === "C" || key === "DQ" || key === "CT", isC: key[0] === "C" || key === "DC",
    finisher: key === "DQ", big: key === "DQ" || key === "CT",
  };
};
t("cờ đòn H35 suy ra = luật tên đòn / MV cũ (mọi đòn WC03)", () => {
  for (const k in MOVES) {
    const F = moveFlags(k, MOVES[k]), L = legacy(k, MOVES[k]);
    for (const f in L) assert.equal(F[f], L[f], `${k}.${f}`);
    assert.equal(F.charge, false, k); assert.equal(F.armor, null, k); assert.equal(F.armorPen, 0, k); assert.equal(F.hold, null, k);
  }
});
t("moveFlags không sửa bảng đòn (MOVES giữ nguyên khoá)", () => {
  assert.deepEqual(Object.keys(MOVES.N1).sort(), ["arc", "dur", "hits", "mv", "range", "shape", "step", "stop"]);
});

console.log("Cờ WC01 (H31)");
const FW = Object.fromEntries(Object.keys(MOVES_WC01).map((k) => [k, moveFlags(k, MOVES_WC01[k])]));
t("cờ tường minh được giữ: N6 kết chuỗi, N1–N5 nối được", () => {
  for (const k of ["N1", "N2", "N3", "N4", "N5"]) { assert.equal(FW[k].chainN, true, k); assert.equal(FW[k].heavy, false, k); }
  assert.equal(FW.N6.chainN, false); assert.equal(FW.N6.endsChain, true); assert.equal(FW.N6.heavy, true); assert.equal(FW.N6.ringFx, true);
});
t("tụ lực đúng C1, C4, C6; chargeU trong cửa sổ siêu giáp và trước nhát trúng", () => {
  const ch = Object.keys(FW).filter((k) => FW[k].charge).sort();
  assert.deepEqual(ch, ["C1", "C4", "C6"]);
  for (const k of ch) {
    const F = FW[k], m = MOVES_WC01[k];
    assert.ok(F.chargeU >= F.armor[0] && F.chargeU <= F.armor[1], k);
    assert.ok(F.chargeU < m.hits[0], k);
  }
});
t("mọi đòn WC01 có cửa sổ siêu giáp chứa nhát trúng đầu", () => {
  for (const k in FW) {
    const a = FW[k].armor, h = MOVES_WC01[k].hits[0];
    assert.ok(a && a[0] >= 0 && a[1] <= 1 && a[0] < a[1], k);
    assert.ok(h >= a[0] && h <= a[1], `${k} trúng ${h} ngoài [${a}]`);
  }
});
t("bổ đất của đại kiếm có tiếng chấn (kể cả C1); C6 bỏ qua 30% giáp; C3 giữ tới 8 nhát", () => {
  assert.equal(FW.C1.slamSound, true); assert.equal(FW.N3.slam, true);
  assert.equal(FW.C6.armorPen, 0.3); assert.equal(FW.C3.hold.maxHits, 8);
  assert.equal(FW.CT.resetChain, true); assert.equal(FW.DQ.finisher, true);
});
t("lính né đòn nặng WC01 = heavyTell của bảng (thay HEAVY_MOVES)", () => {
  const tell = Object.keys(FW).filter((k) => FW[k].heavyTell).sort();
  assert.deepEqual(tell, ["C1", "C2", "C3", "C4", "C5", "C6", "DC", "DQ", "N6"]);
});

console.log("Toán tụ lực (WC01)");
const W1 = WEAPON_CLASSES.WC01;
t("cấp 1 → 2 ở 0,4 s → 3 ở 0,8 s; MV ×1 / 1,3 / 1,7", () => {
  assert.equal(chargeLevel(W1, 0), 0); assert.equal(chargeLevel(W1, 0.39), 0); assert.equal(chargeLevel(W1, 0.4), 1);
  assert.equal(chargeLevel(W1, 0.79), 1); assert.equal(chargeLevel(W1, 0.8), 2); assert.equal(chargeLevel(W1, 5), 2);
  assert.equal(chargeMult(W1, 0.1), 1); assert.equal(chargeMult(W1, 0.5), 1.3); assert.equal(chargeMult(W1, 1.2), 1.7);
  assert.equal(chargeMult(WEAPON_CLASSES.WC03, 2), 1); assert.equal(chargeLevel(WEAPON_CLASSES.WC03, 2), 0);
});
t("tụ lực có lời so với chém chuỗi N trong thời gian giữ (MV thêm ≥ giây giữ × DPS chuỗi N)", () => {
  const ks = CHAINS.WC01, dps = ks.reduce((s, k) => s + MOVES_WC01[k].mv, 0) / ks.reduce((s, k) => s + MOVES_WC01[k].dur, 0);
  for (const k of ["C1", "C4", "C6"]) for (const [held, mult] of [[0.4, 1.3], [0.8, 1.7]]) {
    assert.ok(MOVES_WC01[k].mv * (mult - 1) >= held * dps, `${k} giữ ${held}s: +${(MOVES_WC01[k].mv * (mult - 1)).toFixed(2)} < ${(held * dps).toFixed(2)}`);
  }
});

console.log("Kỹ năng, Tuyệt Kỹ (dữ liệu)");
t("mọi kỹ năng có hiện thực trong hero-skills.js (H35, H31)", () => {
  for (const id of ["H35", "H31"]) {
    const S = HEROES[id].skills;
    for (const s of ["sk1", "sk2", "ult"]) if (S[s]) { const I = SKILL_IMPL[S[s]]; assert.ok(I && I.start && I.update && (s === "ult" || I.hud), `${id}.${s} = ${S[s]}`); }
  }
  assert.equal(SKILL_IMPL.ultBopNat, SKILL_IMPL.bopNat); assert.equal(SKILL_IMPL.ultBachDang, SKILL_IMPL.bachDang);
});
t("Bạch Đằng Quyết Chiến: 3 nhát tăng dần trong clip, tổng MV 16 (TPC 35), nhát 3 phá khiên; khớp khung bổ của hoạt ảnh", () => {
  const B = SKILLS.bachDang;
  for (const set of [B.chops, B.tpc.chops]) {
    assert.equal(set.length, 3);
    for (let i = 1; i < 3; i++) assert.ok(set[i].t > set[i - 1].t && set[i].mv >= set[i - 1].mv);
    assert.ok(set[2].breakShields && set[2].t < B.clip);
  }
  near(B.chops.reduce((s, c) => s + c.mv, 0), 16, 1e-9); near(B.tpc.chops.reduce((s, c) => s + c.mv, 0), B.tpc.mvTotal, 1e-9);
  assert.ok(B.invuln > B.clip && B.cost === 100 && B.r === 15 && B.tpc.r === 25);
  // khung bổ (SLAM) của anim-wc01 ult ở u ≈ 0,2 / 0,45 / 0,73: tay phải thấp nhất gần mốc nhát bổ
  const ult = ANIMS.WC01.ult;
  for (const c of B.chops) {
    const u = c.t / B.clip, lo = ult(u).torsoX;
    assert.ok(lo > 0.4, `nhát ${c.t}s: người chưa gập xuống (torsoX ${lo.toFixed(2)})`);
  }
});
t("Hịch Tướng Sĩ, Binh Thư: số theo systems §4.1 (không phải canon)", () => {
  const H = SKILLS.hichTuongSi, B = SKILLS.binhThu;
  assert.equal(H.channel, 3); assert.equal(H.siKhi, 15); assert.equal(H.allyAtk, 0.1); assert.equal(H.dur, 20); assert.equal(H.cd, 40);
  assert.equal(B.mark, 20); assert.equal(B.dmgPct, 0.4); assert.equal(B.cd, 35);
});
t("bảng tên đòn theo tướng: H35 = MOVE_INFO; H31 đè đại kiếm + ô skill2", () => {
  assert.equal(moveInfoOf(HEROES.H35), MOVE_INFO); assert.equal(moveInfoOf("H35"), MOVE_INFO);
  const I = moveInfoOf(HEROES.H31);
  assert.equal(I.C1.name, MOVE_INFO_WC01.C1.name); assert.equal(I.skill2.name, "Binh Thư Yếu Lược"); assert.equal(I.dodge, MOVE_INFO.dodge);
});

console.log("Chỉ số (progress.heroStats)");
t("H35 mặc định như cũ (không thêm trường)", () => {
  const s = P.newSave(); s.hero.level = 7;
  const a = P.heroStats(s, 10), b = P.heroStats(s, 10, "H35");
  assert.deepEqual(a, b);
  assert.equal(a.cong, Math.round(HERO.cong1 * (1 + 0.1 * (8 - 1)) * Math.max(1, 1 + 0.015 * 9 - 0.1)));
  assert.equal(a.kiBars, undefined); assert.equal(a.heroId, undefined);
});
t("H31 bản B20: cấp 25 đặt sẵn, 4 vạch Khí Lực, binh khí E(R), nội tại Tiết Chế", () => {
  const s = P.newSave(), st = P.heroStats(s, 25, "H31", { level: 25 });
  assert.equal(st.level, 25); assert.equal(st.kiBars, 4); assert.equal(st.kiBars, kiLucBarsAt(25));
  near(st.weaponMult, 1 + 0.015 * 24, 1e-9);
  assert.equal(st.cong, Math.round(160 * 3.4 * st.weaponMult)); assert.equal(st.hp, Math.round(2000 * 3.4)); assert.equal(st.giap, Math.round(70 * 3.4));
  assert.equal(st.mods.ksWindow, 0.15); assert.equal(st.mods.ksEffect, 0.15); assert.equal(st.mods.atkPct, 0);
  assert.equal(P.heroStats(s, 3, "H31").level, 25, "không preset (B15 ?debug&hero=H31): cấp VS 25");
  const d = deriveStats(HEROES.H31.stats);
  for (const k of ["cong1", "hp1", "giap1", "move", "atkSpeed", "rangeMul", "aura", "skMult", "cmdCd", "bodyguards"]) assert.equal(HEROES.H31[k], d[k], k);
});
t("bản lưu cũ được thêm save.battles (B20), không mất trường cũ", () => {
  const m = P.migrate({ v: 1, hero: { level: 9, exp: 3, nodes: ["X"] }, ladder: { unlocked: [1, 2], best: { 1: "A" } } });
  assert.deepEqual(m.battles, { B20: { best: null, cleared: false } }); assert.equal(m.hero.level, 9); assert.deepEqual(m.ladder.best, { 1: "A" });
});

// ---- lớp Hero thật với ctx giả -----------------------------------------------------------------------------------------
console.log("Lớp Hero (ctx giả)");
const noop = new Proxy({}, { get: () => () => {} });
function makeRng(seed = 7) { let s = seed >>> 0; const next = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; return { next, chance: (p) => next() < p, range: (a, b) => a + (b - a) * next(), get state() { return s; } }; }
function makeCtx({ agents = [], units = [], director = {} } = {}) {
  const calls = { onUlt: [], onUltEnd: [], onArmyBuff: [], onMark: [], ultQ: [] };
  const ctx = {
    scene: new THREE.Scene(), rng: makeRng(), clock: 0, diff: { revive: 1, dmg: 1 }, hk: { tpc: false }, cam: { yaw: 0 },
    world: { arena: true, gates: {}, colliders: [] }, openGates: {}, units, battle: { heroSpawn: { x: 0, z: 0, yaw: 0 } },
    fx: noop, audio: noop, hud: null, cinematic() {}, hitstop() {}, slowmo() {},
    crowd: {
      agents, hittable: (a) => a.alive && a.hp > 0, rout: () => 0,
      strikeable: (a) => a.alive && a.hp > 0, enlist: () => false,          // đòn của tướng (đợt 15b): lính giả ở đây không có lính diễn
      damage(a, dmg, opt) { if (a.markT > ctx.clock && opt.by !== "enemy") dmg *= a.markMult; a.hp -= dmg; a.hits = (a.hits || 0) + 1; a.lastOpt = opt; if (a.hp <= 0) a.alive = false; return a.hp <= 0; },
    },
    director: {
      onHeroAction() {}, onHeroHit() {}, onRevive() {}, onHeroDead() {}, damageGate() {}, plantFlag() {},
      onUlt(hk, info) { calls.onUlt.push([hk, info]); }, ultQ(q) { calls.ultQ.push(q); }, ...director,
    },
    calls,
  };
  return ctx;
}
const input = (o = {}) => ({ pressed: {}, held: {}, touch: false, block: false, moveX: 0, moveY: 0, ...o });
const DT = 1 / 60;
function run(h, sec, inp = input(), each = null) {
  const n = Math.round(sec / DT);
  for (let i = 0; i < n; i++) { h.ctx.clock += DT; each?.(i); h.intake(inp); h.update(DT, inp); inp.pressed = {}; }
}
const statsFor = (id) => { const s = P.newSave(); return id === "H35" ? P.heroStats(s, 1) : P.heroStats(s, 25, id, { level: 25 }); };
const soldier = (x, z) => ({ x, z, side: "dich", alive: true, hp: 1e6, giap: 20, scale: 1, K: {}, role: "melee" });
const officer = (x, z) => ({ x, z, y: 0, side: "dich", alive: true, dead: 0, retreating: false, isBig: true, radius: 0.8, hp: 1e6, maxHp: 1e6, giap: 60, broken: 0,
  name: "Phó tướng", rig: { scale: 1 }, hitsTaken: 0,
  takeHeroHit(dmg, poise) { const m = (this.markT > ctx0.clock ? this.markMult : 1); this.hp -= dmg * m; this.hitsTaken++; this.lastDmg = dmg * m; return {}; } });
let ctx0 = null;

t("H35 (def mặc định): M = MOVES, 2 vạch Khí Lực, 2 vệt lưỡi đúng điểm cũ, một ô Phá Trận, ô Tuyệt Kỹ như HUD cũ", () => {
  const ctx = makeCtx(), h = new Hero(ctx, statsFor("H35"));
  assert.equal(h.def, HEROES.H35); assert.equal(h.M, MOVES); assert.equal(h.A, ANIMS.WC03); assert.equal(h.poisePerMv, POISE_PER_MV);
  assert.equal(h.kiMax, 200); assert.equal(h.kiBars, 2); assert.equal(h.rangeMul, 1); assert.equal(h.lienHoanOn, true); assert.equal(h.superArmor, false);
  assert.equal(h.trails.length, 2);
  assert.deepEqual(h.trailSrc.map((s) => [s.base.toArray(), s.tip.toArray()]), [[[0, 0.02, 0.32], [0, 0.02, 1.06]], [[0, 0.02, 0.32], [0, 0.02, 1.06]]]);
  assert.equal(h.trailSrc[0].j, h.rig.p.handR); assert.equal(h.trailSrc[1].j, h.rig.p.handL);
  const sl = h.skillSlots();
  assert.equal(sl.length, 1); assert.equal(sl[0].name, "Phá Trận"); assert.equal(sl[0].key, "E"); assert.equal(sl[0].ready, true); assert.equal(sl[0].cd, "");
  h.phaTran.left = 2; h.phaTran.window = 4.2; assert.equal(h.skillSlots()[0].cd, "2 lần · 5s");
  h.ki = 150; assert.deepEqual([h.ultInfo().ready, h.ultInfo().cd, h.ultInfo().name], [true, "1/2", "Bóp Nát Quân Thù"]);
  assert.equal(h.nextHeavyInfo().label, "C1 Phá khiên");
});
t("vòng trúng của kỵ binh (đợt 12a): đòn N1 ở mép tầm trúng cung kỵ mà không trúng bộ binh cùng chỗ; Phá Trận, vòng Tuyệt Kỹ và lướt né cũng vậy", () => {
  const horse = (x, z) => ({ ...soldier(x, z), K: { mounted: true } });
  const swing = (a) => { const ctx = makeCtx({ agents: [a] }), h = new Hero(ctx, statsFor("H35")); h.applyHits("N1", MOVES.N1, true); return a.hits || 0; };
  assert.equal(swing(soldier(0, 4.2)), 0, "bộ binh ở 4,2 m: ngoài 3,4 + 0,4");
  assert.equal(swing(horse(0, 4.2)), 1, "cung kỵ ở 4,2 m: trong 3,4 + 1,0");
  assert.equal(swing(horse(0, 4.6)), 0, "ngoài vòng 1,0 m vẫn không trúng");
  const burst = (a) => { const ctx = makeCtx({ agents: [a] }), h = new Hero(ctx, statsFor("H35")); h.afterimageBurst(0, 0); return a.hits || 0; };
  assert.equal(burst(soldier(0, 3.3)), 0); assert.equal(burst(horse(0, 3.3)), 1, "ảnh lướt né: tầm 3 m + phần cộng của kỵ binh");
});
t("H35: đòn nặng ngắt đòn đang ra; không có tụ lực dù giữ C", () => {
  const ctx = makeCtx({ agents: [soldier(0, 2)] }), h = new Hero(ctx, statsFor("H35"));
  const inp = input({ held: { c: true } }); inp.pressed.c = true;
  run(h, DT, inp); assert.equal(h.state, "attack"); assert.equal(h.move, "C1"); assert.equal(h.charge, null);
  run(h, 0.1, inp); assert.equal(h.chargeLevel, 0);
  h.receiveHit({ dmg: 1, x: 0, z: 3, heavy: true }); assert.equal(h.state, "hit");
});
t("H31: WC01, 4 vạch, 1 vệt lưỡi, hai ô kỹ năng (E Hịch, T Binh Thư), Tuyệt Kỹ Bạch Đằng", () => {
  const ctx = makeCtx(), h = new Hero(ctx, statsFor("H31"), HEROES.H31);
  assert.equal(h.M, MOVES_WC01); assert.equal(h.A, ANIMS.WC01); assert.equal(h.poisePerMv, 30); assert.equal(h.kiMax, 400); assert.equal(h.kiBars, 4);
  assert.equal(h.trails.length, 1); assert.equal(h.rangeMul, 1.05); assert.equal(h.lienHoanOn, false); assert.equal(h.superArmor, true);
  assert.deepEqual(h.skillSlots().map((s) => [s.key, s.name]), [["E", "Hịch Tướng Sĩ"], ["T", "Binh Thư Yếu Lược"]]);
  h.ki = 250; assert.deepEqual([h.ultInfo().name, h.ultInfo().cd], ["Bạch Đằng Quyết Chiến", "2/4"]);
  assert.equal(h.nextHeavyInfo().label, "C1 Phá Sơn");
});
t("H31 tụ lực C1: dừng ở khung gồng, cấp 3 sau 0,8 s, thả ra MV ×1,7 + hất tung", () => {
  const a = soldier(0, 3), ctx = makeCtx({ agents: [a] }), h = new Hero(ctx, statsFor("H31"), HEROES.H31);
  const inp = input({ held: { c: true } }); inp.pressed.c = true;
  run(h, DT, inp); assert.equal(h.move, "C1"); assert.ok(h.charge);
  run(h, 0.5, inp);
  const uc = MOVES_WC01.C1.chargeU;
  near(h.st / h.dur, uc, 1e-9, "u đứng ở chargeU");
  assert.equal(h.chargeLevel, 1 + chargeLevel(W1, h.charge.t));
  run(h, 0.8, inp); assert.equal(h.chargeLevel, 3); assert.equal(a.hits || 0, 0, "chưa chém khi đang gồng");
  // giáp khi đang gồng: đòn nặng không ngắt
  h.receiveHit({ dmg: 1, x: 0, z: 3, heavy: true }); assert.equal(h.state, "attack");
  inp.held.c = false; run(h, DT, inp);
  assert.equal(h.chargeLv, 3); near(h.chargeMul, 1.7, 1e-9); assert.equal(h.chargeLevel, 0);
  run(h, 1.2, inp);
  assert.equal(a.hits, 1); assert.equal(a.lastOpt.launch, true); assert.equal(a.lastOpt.knock, MOVES_WC01.C1.knock + 2);
});
t("H31 bấm C thả ngay: không tụ lực, MV ×1; tự tung ở 1,2 s nếu giữ mãi", () => {
  const ctx = makeCtx({ agents: [soldier(0, 3)] }), h = new Hero(ctx, statsFor("H31"), HEROES.H31);
  const inp = input(); inp.pressed.c = true; run(h, 0.5, inp); assert.equal(h.chargeMul, 1); assert.equal(h.charge, null);
  const ctx2 = makeCtx({ agents: [soldier(0, 3)] }), h2 = new Hero(ctx2, statsFor("H31"), HEROES.H31);
  const inp2 = input({ held: { c: true } }); inp2.pressed.c = true;
  run(h2, 1.8, inp2); assert.equal(h2.charge, null); near(h2.chargeMul, 1.7, 1e-9); assert.ok(h2.st / h2.dur > MOVES_WC01.C1.chargeU);
});
t("H31 siêu giáp: trong cửa sổ armor đòn nặng / hất ngã không ngắt; đòn viền đỏ vẫn ngắt; ngoài cửa sổ thì ngắt", () => {
  const mk = () => { const ctx = makeCtx({ agents: [soldier(0, 3)] }), h = new Hero(ctx, statsFor("H31"), HEROES.H31); const inp = input(); inp.pressed.n = true; run(h, DT, inp); return h; };
  let h = mk(); run(h, 0.25); assert.ok(h.inArmor()); h.receiveHit({ dmg: 1, x: 0, z: 3, heavy: true, knockdown: true }); assert.equal(h.state, "attack");
  h = mk(); run(h, 0.25); h.receiveHit({ dmg: 1, x: 0, z: 3, red: true }); assert.equal(h.state, "down");
  h = mk(); assert.ok(!h.inArmor()); h.receiveHit({ dmg: 1, x: 0, z: 3, heavy: true }); assert.equal(h.state, "hit");
});
t("C6 bỏ qua 30% giáp; tầm × Tầm (1,05)", () => {
  const ctx = makeCtx(), h = new Hero(ctx, statsFor("H31"), HEROES.H31);
  ctx.rng = { next: () => 0.5, chance: () => false };
  const d0 = h.damageTo(100, 1, false), d1 = h.damageTo(100, 1, false, null, 0.3);
  near(d1 / d0, heSoGiap(70, 25) / heSoGiap(100, 25), 1e-9);
});
t("Hịch Tướng Sĩ: đọc 3 s rồi gọi director.onArmyBuff; bị hất ngã thì ngắt, hồi còn ≤ 8 s", () => {
  const buffs = [], ctx = makeCtx({ director: { onArmyBuff: (i) => buffs.push(i) } }), h = new Hero(ctx, statsFor("H31"), HEROES.H31);
  const inp = input(); inp.pressed.skill = true; run(h, DT, inp);
  assert.equal(h.state, "skill"); assert.equal(h.skillSlots()[0].ready, false);
  h.receiveHit({ dmg: 1, x: 0, z: 3 }); assert.equal(h.state, "skill", "đòn thường không ngắt");
  run(h, 3.05);
  assert.equal(h.state, "free"); assert.equal(buffs.length, 1);
  assert.deepEqual([buffs[0].skAll, buffs[0].congPct, buffs[0].sec], [15, 0.1, 20]);
  const h2 = new Hero(makeCtx(), statsFor("H31"), HEROES.H31); const i2 = input(); i2.pressed.skill = true; run(h2, 0.5, i2);
  h2.receiveHit({ dmg: 1, x: 0, z: 3, knockdown: true }); assert.equal(h2.state, "down"); assert.ok(h2.skillCd.hichTuongSi <= 8);
});
t("Hịch dự phòng (director B15 không có onArmyBuff): +15 Sĩ Khí quân ta mọi mặt trận", () => {
  const ctx = makeCtx(); ctx.sim = { fronts: { A: { sk: { ta: 50, dich: 50 } }, B: { sk: { ta: 95, dich: 40 } } } };
  const h = new Hero(ctx, statsFor("H31"), HEROES.H31); const inp = input(); inp.pressed.skill = true; run(h, 3.1, inp);
  assert.deepEqual([ctx.sim.fronts.A.sk.ta, ctx.sim.fronts.B.sk.ta, ctx.sim.fronts.A.sk.dich], [65, 100, 50]);
});
t("Binh Thư: đánh dấu sĩ quan gần nhất 20 s (markT, markMult 1,4), director.onMark; đòn lên mục tiêu +40%", () => {
  const marks = [], u = officer(0, 8), ctx = ctx0 = makeCtx({ units: [u], director: { onMark: (t, i) => marks.push([t, i]) } });
  const h = new Hero(ctx, statsFor("H31"), HEROES.H31);
  const inp = input(); inp.pressed.skill2 = true; run(h, 1.0, inp);
  assert.equal(h.state, "free"); assert.equal(marks.length, 1); assert.equal(marks[0][0], u);
  near(u.markMult, 1.4, 1e-9); near(u.markT - ctx.clock, 20 - (1.0 - 0.35 * SKILLS.binhThu.castSec), 0.05);
  assert.equal(h.skillSlots()[1].ready, false);
  u.takeHeroHit(100, 0); near(u.lastDmg, 140, 1e-9);
  ctx.clock = u.markT + 0.01; u.takeHeroHit(100, 0); near(u.lastDmg, 100, 1e-9);
  // không có mục tiêu: không tốn hồi chiêu
  const h2 = new Hero(makeCtx(), statsFor("H31"), HEROES.H31); const i2 = input(); i2.pressed.skill2 = true; run(h2, DT, i2);
  assert.equal(h2.state, "free"); assert.equal(h2.skillReady(2), true);
});
t("Bạch Đằng Quyết Chiến: tốn 100 Khí Lực, 3 nhát sóng chấn r 15 (lính trong vòng trúng 3 lần, ngoài vòng không), nhát 3 hất tung, onUltEnd", () => {
  const ends = [], near1 = soldier(0, 8), far = soldier(0, 30), u = officer(0, 6);
  const ctx = ctx0 = makeCtx({ agents: [near1, far], units: [u], director: { onUltEnd: (i) => ends.push(i) } });
  const h = new Hero(ctx, statsFor("H31"), HEROES.H31); h.ki = 400;
  const inp = input(); inp.pressed.ult = true; run(h, DT, inp);
  assert.equal(h.state, "ult"); assert.equal(h.ki, 300); near(h.invuln, 12, 0.02);
  assert.equal(ctx.calls.onUlt.length, 1); assert.equal(ctx.calls.onUlt[0][1].id, "bachDang");
  assert.equal(h.receiveHit({ dmg: 1, x: 0, z: 1, red: true }), "immune");
  run(h, 1.0); assert.equal(near1.hits, 1);
  run(h, 3.5);
  assert.equal(h.state, "free"); assert.equal(near1.hits, 3); assert.equal(far.hits || 0, 0);
  assert.equal(near1.lastOpt.launch, true); assert.ok(near1.lastOpt.knock >= 5);
  assert.equal(u.hitsTaken, 3);
  assert.equal(ends.length, 1); assert.deepEqual([ends[0].order, ends[0].siKhi, ends[0].qCost, ends[0].tpc], ["tiencong", 15, 20, false]);
  assert.ok(h.invuln > 7 && h.invuln < 8);
});
t("Bạch Đằng: trần sát thương Tuyệt Kỹ lên đơn vị lớn (ultBigDamage bigCap 35%) giữ cả khi có dấu Binh Thư", () => {
  const u = officer(0, 5); u.hp = u.maxHp = 3000; u.giap = 0; u.markT = 1e9; u.markMult = 1.4;
  const ctx = ctx0 = makeCtx({ units: [u] });
  const h = new Hero(ctx, statsFor("H31"), HEROES.H31); h.ki = 400;
  const inp = input(); inp.pressed.ult = true; run(h, 4.6, inp);
  assert.ok(3000 - u.hp <= 0.35 * 3000 + 1e-6, `mất ${3000 - u.hp}`);
});
t("Tuyệt Kỹ H35 (Bóp Nát) vẫn qua ultImpl: 24 đòn trong 4,2 s, cắm cờ", () => {
  let flags = 0; const ctx = makeCtx({ agents: [soldier(0, 2)], director: { plantFlag: () => flags++ } });
  const h = new Hero(ctx, statsFor("H35")); h.ki = 200;
  const inp = input(); inp.pressed.ult = true; run(h, 4.3, inp);
  assert.equal(h.ultHits, 24); assert.equal(flags, 1); assert.deepEqual(ctx.calls.ultQ, [20]);
});
t("nextHeavy theo cờ: H31 đang N5 → C6 (cấp 25), đang N6 → C1", () => {
  const h = new Hero(makeCtx({ agents: [soldier(0, 3)] }), statsFor("H31"), HEROES.H31);
  h.state = "attack"; h.move = "N5"; h.chain = 5; assert.equal(nextHeavy(h), "C6");
  h.move = "N6"; h.chain = 6; h.chainGrace = 0; assert.equal(nextHeavy(h), "C1");
});

console.log(`\n${pass} đạt, ${fail} lỗi`);
if (fail) process.exit(1);
