// tests/wc01.test.mjs — kiểm thử phần thuần của lớp WC01 Đại kiếm và H31 (đợt 9, nền móng B20).
//   node hao-khi-viet/game/tests/wc01.test.mjs
import assert from "node:assert/strict";
import { armIK, armFK } from "../js/battle/ik.js";
import * as A from "../js/battle/anim.js";
import { HERO_ANIM_WC01, POSES_WC01, GUARD, BLOCK } from "../js/battle/anim-wc01.js";
import { MOVES_WC01, CHAIN_N, HEAVY_MOVES, MOVE_INFO_WC01 } from "../js/data/moves-wc01.js";
import { WEAPON_CLASSES, WC01, WC03, poisePerMv, chargeMult, chargeLevel } from "../js/data/weapon-classes.js";
import { HEROES, deriveStats, kiLucBarsAt, SKILLS } from "../js/data/heroes.js";
import { HERO, MOVES, POISE_PER_MV } from "../js/data/tuning.js";
import { MOVE_INFO } from "../js/data/moves-info.js";

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log("  ok  " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + e.message); }
}
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ""} ${a} ≉ ${b} (±${tol})`);
// PRNG cố định cho các phép thử ngẫu nhiên
let seed = 12345;
const rnd = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; };

console.log("armIK (ik.js)");
t("cổ tay tới đúng đích trong tầm với (sai số < 1e-9)", () => {
  let worst = 0;
  for (let i = 0; i < 500; i++) {
    const d = 0.2 + rnd() * 0.48, th = rnd() * Math.PI, ph = rnd() * 2 * Math.PI;
    const tx = d * Math.sin(th) * Math.cos(ph), ty = d * Math.cos(th), tz = d * Math.sin(th) * Math.sin(ph);
    const o = armIK(tx, ty, tz, rnd() - 0.5, rnd() - 0.5, rnd() - 0.5, 0.34, 0.36);
    const f = armFK(...o, 0.34, 0.36);
    worst = Math.max(worst, Math.hypot(f[3] - tx, f[4] - ty, f[5] - tz));
  }
  assert.ok(worst < 1e-9, `sai số ${worst}`);
});
t("khuỷu lệch về phía pole, gập đúng chiều (elx ≤ 0), dài cánh tay giữ nguyên", () => {
  for (let i = 0; i < 300; i++) {
    const tx = rnd() - 0.5, ty = rnd() - 0.8, tz = rnd() * 0.6, d = Math.hypot(tx, ty, tz);
    if (d < 0.15 || d > 0.68) continue;
    const p = [rnd() - 0.5, rnd() - 0.5, rnd() - 0.5];
    const o = armIK(tx, ty, tz, ...p, 0.34, 0.36), f = armFK(...o, 0.34, 0.36);
    assert.ok(o[3] <= 1e-12, `elx ${o[3]}`);
    near(Math.hypot(f[0], f[1], f[2]), 0.34, 1e-9, "dài cánh tay");
    const u = [tx / d, ty / d, tz / d], pd = p[0] * u[0] + p[1] * u[1] + p[2] * u[2];
    const side = f[0] * (p[0] - pd * u[0]) + f[1] * (p[1] - pd * u[1]) + f[2] * (p[2] - pd * u[2]);
    assert.ok(side >= -1e-9, "khuỷu ngược phía pole");
  }
});
t("ngoài tầm với: tay duỗi thẳng về phía đích; đích ngay dưới vai: tay buông thẳng", () => {
  const o = armIK(0.3, -1.2, 0.4, -1, 0, 0, 0.34, 0.36), f = armFK(...o, 0.34, 0.36), d = Math.hypot(0.3, -1.2, 0.4);
  near(Math.hypot(f[3], f[4], f[5]), 0.7, 1e-3, "duỗi hết");
  near((f[3] * 0.3 - f[4] * 1.2 + f[5] * 0.4) / (0.7 * d), 1, 1e-3, "hướng");
  const r = armIK(0, -0.6999, 0, -1, 0, 0, 0.34, 0.36);
  near(r[0], 0, 0.05); near(r[3], 0, 0.1);
});
t("pole suy biến (song song hướng đích) không ra NaN", () => {
  const o = armIK(0, -0.5, 0, 0, -1, 0, 0.34, 0.36);
  assert.ok(o.every(Number.isFinite), o.join(","));
});

console.log("Lớp vũ khí, bộ đòn WC01");
t("hệ số lớp khớp systems §4.4; Phá Thế/MV: WC03 = 14 (POISE_PER_MV B15), WC01 = 30", () => {
  assert.equal(WC01.mv, 1.35); assert.equal(WC01.speed, 0.75); assert.equal(WC01.poise, 1.5); assert.equal(WC01.rangeN, 3.5);
  near(WC01.mv * WC01.speed, 1.0, 0.02);
  near(poisePerMv(WC03), POISE_PER_MV, 1e-9); near(poisePerMv(WC01), 30, 1e-9);
  assert.equal(WEAPON_CLASSES.WC14.traits.backstab, 2);
});
t("DPS chuỗi N của WC01 ≈ 1,62 MV/s (±10%)", () => {
  const mv = CHAIN_N.reduce((s, k) => s + MOVES_WC01[k].mv, 0), dur = CHAIN_N.reduce((s, k) => s + MOVES_WC01[k].dur, 0);
  near(mv / dur, 1.62, 0.162, "MV/s");
  near(mv / dur, 1.6, 0.16, "MV/s so chuẩn §2.2");
});
t("Phá Thế chuỗi N ≈ 48/s (§2.4 Đại kiếm)", () => {
  const mv = CHAIN_N.reduce((s, k) => s + MOVES_WC01[k].mv, 0), dur = CHAIN_N.reduce((s, k) => s + MOVES_WC01[k].dur, 0);
  near(poisePerMv(WC01) * mv / dur, 48, 4.8);
});
t("MV = bảng chuẩn §4.2 × 1,35 (N, C, lướt, Đòn Quyết)", () => {
  const std = { N1: 0.8, N2: 0.8, N3: 0.9, N4: 1.0, N5: 1.1, N6: 1.6, C1: 1.8, C2: 1.2, C3: 0.5, C4: 3.0, C5: 3.2, C6: 4.5, DN: 1.0, DC: 2.0, DQ: 8.0 };
  for (const k in std) near(MOVES_WC01[k].mv, std[k] * 1.35, 0.011, k);
});
t("mọi đòn đủ trường, cờ là boolean, hits tăng dần trong (0,1)", () => {
  const shapes = new Set(["cone", "ring", "line"]);
  assert.deepEqual(Object.keys(MOVES_WC01).sort(), Object.keys(MOVES).sort(), "cùng bộ khoá với WC03");
  for (const [k, m] of Object.entries(MOVES_WC01)) {
    for (const f of ["mv", "dur", "stop", "range"]) assert.ok(Number.isFinite(m[f]) && m[f] > 0, `${k}.${f}`);
    assert.ok(shapes.has(m.shape), `${k}.shape`);
    if (m.shape === "cone") assert.ok(m.arc > 0 && m.arc <= 360, `${k}.arc`);
    if (m.shape === "line") assert.ok(m.width > 0 && m.dash > 0, `${k}.width/dash`);
    assert.ok(Array.isArray(m.hits) && m.hits.length >= 1, `${k}.hits`);
    m.hits.forEach((h, i) => { assert.ok(h > 0 && h < 1, `${k}.hits[${i}] = ${h}`); if (i) assert.ok(h > m.hits[i - 1], `${k}.hits tăng`); });
    for (const f of ["heavy", "heavyTell", "slam", "ringFx", "kiai", "mirrorArc", "charge", "endsChain"]) assert.equal(typeof m[f], "boolean", `${k}.${f}`);
    assert.ok(m.armorPen >= 0 && m.armorPen < 1, `${k}.armorPen`);
    assert.ok(Array.isArray(m.armor) && m.armor[0] >= 0 && m.armor[1] <= 1 && m.armor[0] < m.armor[1], `${k}.armor`);
    assert.ok(m.armor[0] < m.hits[0], `${k}: siêu giáp phải bắt đầu trước nhát trúng đầu`);
    if (m.charge) assert.ok(m.chargeU > 0 && m.chargeU < m.hits[0], `${k}.chargeU`);
  }
  assert.equal(MOVES_WC01.C6.armorPen, 0.3); assert.ok(MOVES_WC01.N6.endsChain);
  assert.deepEqual(["C1", "C4", "C6"], Object.keys(MOVES_WC01).filter((k) => MOVES_WC01[k].charge));
  assert.ok(HEAVY_MOVES.has("C1") && HEAVY_MOVES.has("DQ") && !HEAVY_MOVES.has("N1"));
});
t("tụ lực: ×1 / ×1,3 / ×1,7 ở mốc 0,4 s / 0,8 s", () => {
  assert.equal(chargeMult(WC01, 0.2), 1); assert.equal(chargeMult(WC01, 0.5), 1.3); assert.equal(chargeMult(WC01, 1.0), 1.7);
  assert.equal(chargeLevel(WC01, 0.85), 2); assert.equal(chargeMult(WC03, 5), 1);
});
t("MOVE_INFO_WC01 cùng khoá HUD với MOVE_INFO, icon có sẵn", () => {
  for (const k of ["N", "C1", "C2", "C3", "C4", "C5", "C6", "D", "DQ", "CT", "skill", "ult"]) {
    assert.ok(MOVE_INFO_WC01[k]?.name, k);
    assert.ok(MOVE_INFO[k] && Object.values(MOVE_INFO).some((x) => x.icon === MOVE_INFO_WC01[k].icon), `${k} icon`);
  }
});

console.log("Tướng (heroes.js)");
t("deriveStats tái tạo đúng số H35 của tuning.js (140/1600/50/6,75/1,15, Thống Suất 3)", () => {
  const d = deriveStats(HERO.stats);
  assert.equal(d.cong1, HERO.cong1); assert.equal(d.hp1, HERO.hp1); assert.equal(d.giap1, HERO.giap1);
  assert.equal(d.move, HERO.move); assert.equal(d.atkSpeed, HERO.atkSpeed);
  assert.equal(d.aura, HERO.aura); assert.equal(d.auraAtk, HERO.auraAtk); assert.equal(d.skMult, HERO.skMult);
  assert.equal(d.cmdCd, HERO.cmdCd); assert.equal(d.bodyguards, HERO.bodyguards);
  assert.deepEqual([d.cong1, d.hp1, d.giap1, d.move, d.atkSpeed], [140, 1600, 50, 6.75, 1.15]);
});
t("H31: số cấp 1 = deriveStats(canon 5/4/2/3/5)", () => {
  const h = HEROES.H31, d = deriveStats(h.stats);
  for (const k of ["cong1", "hp1", "giap1", "move", "atkSpeed", "rangeMul", "aura", "auraAtk", "skMult", "cmdCd", "bodyguards"]) assert.equal(h[k], d[k], k);
  assert.deepEqual([h.cong1, h.hp1, h.giap1, h.move, h.atkSpeed, h.aura, h.skMult, h.cmdCd, h.bodyguards], [160, 2000, 70, 6.0, 1.0, 20, 1.4, 0.84, 14]);
  const sum = Object.values(h.stats).reduce((a, b) => a + b, 0);
  assert.ok(sum >= 15 && sum <= 19, `tổng ${sum}`);
  assert.equal(h.cls, "WC01"); assert.equal(h.rig, "H31");
});
t("H31 cùng DPS tướng với H35 (Công × 1,6 × tốc đánh, ±2%)", () => {
  near(HEROES.H31.cong1 * 1.6 * HEROES.H31.atkSpeed / (HERO.cong1 * 1.6 * HERO.atkSpeed), 1, 0.02);
});
t("Khí Lực: 2 → 3 (cấp 12) → 4 (cấp 25); H31 ở B20 (cấp 25) có 4 vạch", () => {
  assert.equal(kiLucBarsAt(1), 2); assert.equal(kiLucBarsAt(11), 2); assert.equal(kiLucBarsAt(12), 3); assert.equal(kiLucBarsAt(25), 4);
  assert.equal(HEROES.H31.kiLucBars, kiLucBarsAt(25));
});
t("kỹ năng H31 có đủ dữ liệu; Tuyệt Kỹ tổng MV 16 (thường), 35 (Hào Khí)", () => {
  for (const id of Object.values(HEROES.H31.skills)) assert.ok(SKILLS[id], id);
  const u = SKILLS.bachDang;
  near(u.chops.reduce((s, c) => s + c.mv, 0), 16, 1e-9); near(u.tpc.chops.reduce((s, c) => s + c.mv, 0), u.tpc.mvTotal, 1e-9);
  assert.ok(u.chops.every((c) => c.t < u.clip)); assert.equal(u.invuln, 12); assert.equal(u.r, 15); assert.equal(u.tpc.r, 25);
  assert.deepEqual([SKILLS.hichTuongSi.channel, SKILLS.hichTuongSi.siKhi, SKILLS.hichTuongSi.allyAtk, SKILLS.hichTuongSi.cd], [3, 15, 0.10, 40]);
  assert.deepEqual([SKILLS.binhThu.mark, SKILLS.binhThu.dmgPct, SKILLS.binhThu.cd], [20, 0.40, 35]);
  assert.equal(HEROES.H34.wip, true); assert.equal(HEROES.H38.wip, true);
});

console.log("Hoạt ảnh WC01 (anim-wc01.js)");
const US = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
t("mọi đòn, mọi khung: đủ kênh, số hữu hạn, grip trong [0,1]", () => {
  const keys = Object.keys(A.zeroPose());
  for (const [k, f] of Object.entries(HERO_ANIM_WC01)) for (const u of US) {
    const p = f(u);
    for (const c of keys) assert.ok(Number.isFinite(p[c]), `${k}(${u}).${c}`);
    assert.ok(p.grip >= 0 && p.grip <= 1, `${k}(${u}).grip = ${p.grip}`);
  }
  for (const k of Object.keys(MOVES_WC01)) assert.ok(HERO_ANIM_WC01[k], `thiếu hoạt ảnh ${k}`);
});
t("đòn hai tay: grip = 1 suốt các đòn N, C, lướt, Đòn Quyết, phản đòn", () => {
  for (const k of Object.keys(MOVES_WC01)) for (const u of US) assert.equal(HERO_ANIM_WC01[k](u).grip, 1, `${k}(${u})`);
});
t("buông tay trái khi chỉ gươm, đọc hịch, kết Tuyệt Kỹ; chạy vác gươm", () => {
  assert.equal(HERO_ANIM_WC01.hich(0.5).grip, 0); assert.equal(HERO_ANIM_WC01.binhThu(0.5).grip, 0); assert.equal(HERO_ANIM_WC01.ult(1).grip, 0);
  assert.equal(POSES_WC01.run(1.3, 1, 0.8).grip, 0); assert.equal(GUARD.grip, 1); assert.equal(BLOCK.grip, 1);
});
t("khung giữ tụ lực: cổ tay phải giơ cao quá vai (≥ 0,35 trên khớp vai, khung thân trên)", () => {
  const off = Math.atan2(0.02, 0.36), L2 = Math.hypot(0.36, 0.02);
  for (const k of ["C1", "C4", "C6"]) {
    const p = POSES_WC01.charge(k), f = armFK(p.shRx, p.shRy, p.shRz, p.elRx - off, 0.34, L2);
    assert.ok(f[4] > 0.35, `${k}: cổ tay cao ${f[4].toFixed(2)}`);
  }
  const g = armFK(GUARD.shRx, GUARD.shRy, GUARD.shRz, GUARD.elRx - off, 0.34, L2);
  assert.ok(g[4] < 0, "thế thủ: tay dưới vai");
});
t("không nhảy góc vai giữa hai khung liền (bước u 0,01 lệch < 1,2 rad, trừ spin)", () => {
  for (const [k, f] of Object.entries(HERO_ANIM_WC01)) {
    let prev = f(0);
    for (let i = 1; i <= 100; i++) {
      const p = f(i / 100);
      for (const c of ["shRx", "shRy", "shRz", "elRx", "handRx"]) assert.ok(Math.abs(p[c] - prev[c]) < 1.2, `${k} u=${i / 100} ${c}: ${prev[c]} → ${p[c]}`);
      prev = p;
    }
  }
});
t("blendPose không thêm kênh grip cho tư thế song đao (B15 giữ nguyên)", () => {
  const p = A.blendPose(A.idle(0.3), A.slash(0.4), 0.5);
  assert.ok(!("grip" in p));
  near(A.blendPose(GUARD, A.knockdown(1), 0.25).grip, 0.75, 1e-12);
});

console.log(`\n${pass} đạt, ${fail} trượt`);
if (fail) process.exit(1);
