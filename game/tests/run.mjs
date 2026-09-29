// tests/run.mjs — kiểm thử phần thuần (mô phỏng, Hào Khí, tiến triển) trong Node.
//   node hao-khi-viet/game/tests/run.mjs
import assert from "node:assert/strict";
import { heSoGiap, g, E, EXP_NEXT, MOVES, TIERS, HERO, HAO_KHI, UNITS, KITS, KITS_OF, pickKit } from "../js/data/tuning.js";
import { FRONTS, BASES, ENEMY_MIX } from "../js/data/battle-b15.js";
import { createSim, simTick, issueOrder, triggerTPC, totalQ, snapshot } from "../js/sim/front.js";
import { createHaoKhi, gain, tick, activate, tpcReady } from "../js/sim/haokhi.js";
import * as P from "../js/meta/progress.js";

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log("  ok  " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + e.message); }
}
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ""} ${a} ≉ ${b} (±${tol})`);

console.log("Công thức (21.6, 3.12)");
t("lính thường gây ~28 mỗi đòn lên H35 cấp 1", () => near(40 * 1.0 * heSoGiap(50, 1), 28, 0.5));
t("N1 của H35 hạ lính thường sau đúng 2 đòn", () => {
  const d = HERO.cong1 * MOVES.N1.mv * heSoGiap(20, 1);
  assert.ok(d < 120 && 2 * d >= 120, `N1 = ${d}`);
});
t("khiên binh (HP ×1,3, giáp 30) cần 3 đòn N1", () => {
  const d = HERO.cong1 * MOVES.N1.mv * heSoGiap(30, 1), hp = 120 * 1.3;
  assert.ok(2 * d < hp && 3 * d >= hp);
});
t("DPS đơn mục tiêu chuỗi N ở ×1,0 ≈ 1,6 MV/s ±10%", () => {
  const ks = ["N1", "N2", "N3", "N4", "N5", "N6"];
  const mv = ks.reduce((s, k) => s + MOVES[k].mv, 0), dur = ks.reduce((s, k) => s + MOVES[k].dur, 0);
  near(mv / dur, 1.6, 0.16, "MV/s");
});
t("H35 hạ Toa Đô trong 20–25 s (~172/s)", () => {
  const dps = HERO.cong1 * 1.6 * HERO.atkSpeed * heSoGiap(TIERS.tuong.giap, 1);
  const ttk = TIERS.tuong.hp / dps;
  assert.ok(ttk >= 20 && ttk <= 26, `ttk ${ttk.toFixed(1)} s`);
});
t("E(R) khớp 12.7", () => { near(E(10), 1.135, 1e-9); near(E(25), 1.36, 1e-9); near(E(50), 1.735, 1e-9); });
t("EXP_next khớp bảng 12.1", () => { assert.equal(EXP_NEXT(1), 300); assert.equal(EXP_NEXT(10), 5250); assert.equal(EXP_NEXT(35), 61500); });

console.log("Kiểu lính (KITS)");
t("mỗi binh chủng có kiểu lính, tỉ lệ w cộng lại = 1", () => {
  for (const u of Object.keys(UNITS)) {
    assert.ok(KITS_OF[u].length >= 1, u);
    near(KITS_OF[u].reduce((s, k) => s + KITS[k].w, 0), 1, 1e-9, u);
  }
});
t("băm id theo tỉ lệ vàng chia đúng tỉ lệ w (1000 lính khiên binh)", () => {
  const n = {}; for (let id = 1; id <= 1000; id++) { const k = pickKit("KHIEN_NG", (id * 0.6180339887) % 1); n[k] = (n[k] || 0) + 1; }
  for (const k of KITS_OF.KHIEN_NG) near(n[k] / 1000, KITS[k].w, 0.02, k);
});
t("đao thuẫn vẫn là khiên binh chuẩn: 3 đòn N1", () => {
  const K = KITS.NG_DAO, d = HERO.cong1 * MOVES.N1.mv * heSoGiap(30 * K.giap, 1), hp = 120 * 1.3 * K.hp;
  assert.ok(2 * d < hp && 3 * d >= hp);
});
t("lực sĩ trọng giáp cần 7–10 đòn N1, cung thủ chỉ 2", () => {
  const n = (k) => Math.ceil((120 * 1.3 * KITS[k].hp) / (HERO.cong1 * MOVES.N1.mv * heSoGiap(30 * KITS[k].giap, 1)));
  assert.ok(n("NG_TANK") >= 7 && n("NG_TANK") <= 10, `tank ${n("NG_TANK")}`);
  assert.equal(n("NG_CUNG"), 2);
});
t("kiểu bắn xa có tầm, kiểu cận chiến có tầm chém", () => {
  for (const [k, K] of Object.entries(KITS)) assert.ok(K.ranged ? K.range > 0 : K.reach > 0, k);
});

console.log("Mô phỏng mặt trận (4.2)");
const mk = () => createSim({ fronts: FRONTS, bases: BASES, enemyMix: ENEMY_MIX, R: 1 });
t("cùng seed, cùng lệnh → trùng khớp tuyệt đối sau 600 tick", () => {
  const a = mk(), b = mk();
  for (let i = 0; i < 600; i++) {
    if (i === 40) { issueOrder(a, "B", "tiencong"); issueOrder(b, "B", "tiencong"); }
    if (i === 90) { issueOrder(a, "A", "tiepvien"); issueOrder(b, "A", "tiepvien"); }
    simTick(a); simTick(b);
  }
  assert.deepEqual(snapshot(a), snapshot(b));
});
t("bỏ mặc thì quân ta hao dần: sau 10 phút Q ta < Q ta lúc mở", () => {
  const s = mk(); for (let i = 0; i < 600; i++) simTick(s);
  assert.ok(totalQ(s.fronts.A, "ta") < 1000 && totalQ(s.fronts.B, "ta") < 1000);
});
t("tuyến không vượt Cứ Điểm địch còn đứng (A1 ở 0,30)", () => {
  // 400 quân địch: yếu hơn ta nhưng trên ngưỡng sụp đổ cánh 15% (sụp đổ thì được phép mất Cứ Điểm)
  const s = mk(); s.fronts.A.q.dich = { KHIEN_NG: 400, CUNGKY_NG: 0 };
  for (let i = 0; i < 400; i++) {
    simTick(s);
    if (s.bases.A1.owner === "dich") assert.ok(s.fronts.A.x <= 0.27 + 1e-9, `tick ${i}: x = ${s.fronts.A.x}`);
  }
});
t("cổng còn đóng chặn tuyến kể cả khi cánh địch sụp đổ liên tiếp", () => {
  const s = mk(); s.fronts.A.q.dich = { KHIEN_NG: 100, CUNGKY_NG: 0 };
  for (let i = 0; i < 900; i++) simTick(s);
  assert.ok(s.fronts.A.x <= 0.77 + 1e-9, `x = ${s.fronts.A.x}`);
});
t("mô phỏng bào mòn G của Cứ Điểm địch nhưng không tự chiếm (chỉ tướng mới chiếm)", () => {
  const s = mk(); s.bases.A1.keeperAlive = false; s.fronts.A.x = 0.27;
  for (let i = 0; i < 400; i++) { simTick(s); s.fronts.A.x = Math.max(s.fronts.A.x, 0.27); }
  assert.equal(s.bases.A1.G, 0); assert.equal(s.bases.A1.owner, "dich");
});
t("Cứ Điểm của ta ở tuyến bị bào mòn hết G thì mất", () => {
  const s = mk(); s.bases.B1.G = 1; s.fronts.B.x = 0.31;
  let flip = null;
  for (let i = 0; i < 30 && !flip; i++) flip = simTick(s).find((e) => e.type === "baseFlip" && e.id === "B1");
  assert.ok(flip && flip.owner === "dich");
});
t("Tiến công đẩy tuyến nhanh hơn không lệnh", () => {
  const a = mk(), b = mk();
  issueOrder(a, "B", "tiencong");
  for (let i = 0; i < 20; i++) { simTick(a); simTick(b); }
  assert.ok(a.fronts.B.x > b.fronts.B.x);
});
t("Mệnh Lệnh có hồi chiêu; tiếp viện hết lượt thì từ chối", () => {
  const s = mk();
  assert.ok(issueOrder(s, "A", "tiencong").ok);
  assert.equal(issueOrder(s, "B", "tiencong").ok, false);
  assert.ok(issueOrder(s, "A", "tiepvien").ok);
  s.cooldowns.tiepvien = 0; assert.ok(issueOrder(s, "A", "tiepvien").ok);
  s.cooldowns.tiepvien = 0; assert.equal(issueOrder(s, "A", "tiepvien").why, "charges");
});
t("tiếp viện ta tới sau 20 s, +300 Q", () => {
  const s = mk(); const q0 = totalQ(s.fronts.A, "ta");
  issueOrder(s, "A", "tiepvien");
  let got = null;
  for (let i = 0; i < 25 && !got; i++) got = simTick(s).find((e) => e.type === "reinfArrived");
  assert.ok(got && got.amount === 300); assert.ok(totalQ(s.fronts.A, "ta") > q0 + 250);
});
t("Tổng Phản Công: tuyến +0,05 mọi mặt trận, +0,15 thêm ở mặt trận đang đứng", () => {
  const s = mk(); const a = s.fronts.A.x, b = s.fronts.B.x;
  triggerTPC(s, "B", 25);
  near(s.fronts.A.x, a + 0.05, 1e-9); near(s.fronts.B.x, b + 0.20, 1e-9);
  assert.ok(s.fronts.A.sk.ta >= 90);
});

console.log("Hào Khí (5, 21.6)");
t("Trận nhanh nhân nguồn tăng ×1,3, không nhân nguồn giảm", () => {
  const hk = createHaoKhi({ quick: true });
  gain(hk, 10, "x"); near(hk.value, 13, 1e-9);
  gain(hk, -5, "y"); near(hk.value, 8, 1e-9);
});
t("suy giảm sau 45 s không nguồn, không tụt dưới mốc đã đạt", () => {
  const hk = createHaoKhi({ quick: false });
  gain(hk, 27, "x");
  for (let i = 0; i < 200; i++) tick(hk, 1);
  assert.equal(hk.value, 25);
});
t("chạm 100 thì khoá; dư tối đa 30; TPC dài 25 + dư/3 (trần +10)", () => {
  const hk = createHaoKhi({ quick: false });
  gain(hk, 150, "x"); assert.equal(hk.value, 100); assert.equal(hk.overflow, 30);
  for (let i = 0; i < 100; i++) tick(hk, 1); assert.equal(hk.value, 100);
  assert.ok(tpcReady(hk)); assert.equal(activate(hk), 35);
});
t("hết TPC: Hào Khí về 25 + phần kiếm trong lúc TPC", () => {
  const hk = createHaoKhi({ quick: false });
  gain(hk, 100, "x"); activate(hk); gain(hk, 6, "y");
  for (let i = 0; i < 30; i++) tick(hk, 1);
  assert.equal(hk.tpc, false); near(hk.value, 31, 1e-9);
});

console.log("Tiến triển (12)");
t("cấp 1 → 2 cần 300 EXP", () => { const s = P.newSave(); assert.equal(P.addExp(s, 299), 0); assert.equal(P.addExp(s, 1), 1); });
t("cây kỹ năng: tầng 2 cần 1 nút tầng 1 cùng nhánh", () => {
  const s = P.newSave(); s.hero.level = 10;
  assert.equal(P.canBuy(s, "V2a").ok, false);
  assert.ok(P.buyNode(s, "V1a").ok); assert.ok(P.buyNode(s, "V2a").ok);
});
t("nút đỉnh cần cấp 20 và ≥ 15 điểm trong nhánh; R1 chỉ 1 đỉnh", () => {
  const s = P.newSave(); s.hero.level = 35; s.firsts.rankS = { 1: true, 4: true };   // 34 + 2 điểm
  assert.equal(P.canBuy(s, "VD").why, "Cần tiêu 15 điểm trong nhánh");
  for (const id of ["V1a", "V1b", "V2a", "V3a", "V4a", "V4b"]) assert.ok(P.buyNode(s, id).ok, id);
  assert.ok(P.buyNode(s, "VD").ok);
  for (const id of ["M1a", "M1b", "M2a", "M3a", "M4a", "M4b"]) P.buyNode(s, id);
  assert.equal(P.canBuy(s, "MD").why, "R1 chỉ mở 1 nút đỉnh");
});
t("rèn mức n tốn 400n² Tiền + 5n Tinh thiết; tổng +5 = 22.000 Tiền, 75 Tinh thiết", () => {
  const s = P.newSave(); s.camp = 2; s.wallet = { tien: 22000, tt: 75, qc: 0 };
  for (let i = 0; i < 5; i++) assert.ok(P.forge(s).ok);
  assert.deepEqual(s.wallet, { tien: 0, tt: 0, qc: 0 });
  near(P.weaponMult(s.weapon), 1.30, 1e-9);
});
t("hệ số binh khí trần ×1,8", () => { near(P.weaponMult({ tier: 5, forge: 5 }), 1.8, 1e-9); });
t("vào trận R 10 với tướng cấp 1: nâng lên cấp 8, binh khí ≥ E(10) − 0,10", () => {
  const s = P.newSave(); const h = P.heroStats(s, 10);
  assert.equal(h.level, 8); near(h.weaponMult, E(10) - 0.10, 1e-9);
});
t("xếp hạng: Diem 75 là hạng A", () => {
  const r = P.scoreBattle({ missions: 0.8, timeSec: 600, qRatio: 0.75, baseRatio: 0.6, keSach: 1 });
  assert.equal(r.rank, "A");
});
t("thưởng thắng R 7 hạng A: rơi binh khí Tinh lần đầu, mở R 10", () => {
  const s = P.newSave(); s.ladder.unlocked = [1, 4, 7];
  const res = { won: true, R: 7, difficulty: "quansi", rank: "A", rankMult: 1.25, diem: 75, hkRaw: 80, avgSK: 55, bossDefeated: true };
  const rw = P.computeRewards(s, res);
  assert.equal(rw.drops[0].tier, 2); assert.equal(rw.unlockR, 10);
  P.applyRewards(s, res, rw); assert.equal(s.weapon.tier, 2);
  assert.equal(P.computeRewards(s, res).drops.length, 0);
});

console.log("Võ trường (13.5)");
const A = await import("../js/meta/arena.js");
t("Seed tuần: số tuần ISO theo giờ Việt Nam, đổi lúc 0:00 thứ Hai", () => {
  assert.equal(A.isoWeekKey(new Date("2026-09-29T05:00:00Z")), "2026-W40");
  assert.equal(A.isoWeekKey(new Date("2026-10-04T16:59:00Z")), "2026-W40");   // 23:59 CN giờ VN
  assert.equal(A.isoWeekKey(new Date("2026-10-04T17:00:00Z")), "2026-W41");   // 0:00 thứ Hai giờ VN
  assert.equal(A.isoWeekKey(new Date("2027-01-01T12:00:00Z")), "2026-W53");
});
t("cùng seed → cùng bố cục 5 đợt, đợt cuối có Tướng", () => {
  const a = A.makeLayout(4242), b = A.makeLayout(4242);
  assert.deepEqual(a, b); assert.equal(a.waves.length, 5); assert.ok(a.waves[4].officers.includes("tuong"));
  assert.notDeepEqual(A.makeLayout(1), A.makeLayout(2));
});
t("Đua KO: Đồng 150 · Bạc 220 · Vàng 300", () => {
  assert.equal(A.medalFor("duako", 149), null); assert.equal(A.medalFor("duako", 150), "dong");
  assert.equal(A.medalFor("duako", 220), "bac"); assert.equal(A.medalFor("duako", 300), "vang");
});
t("thưởng lần đầu mỗi mức 5/10/15 Tinh thiết, không nhận lại", () => {
  const s = P.newSave();
  const res = { mode: "duako", R: 1, difficulty: "quansi", medal: "bac", durSec: 180, ko: 230 };
  const r1 = A.arenaRewards(s, res); assert.equal(r1.tt, 15); A.applyArena(s, res, r1);
  const r2 = A.arenaRewards(s, res); assert.equal(r2.tt, 0);
  const r3 = A.arenaRewards(s, { ...res, medal: "vang", ko: 310 }); assert.equal(r3.tt, 15);
});
t("chơi lại: hệ số EXP/Tiền = 0,6 × thời lượng ÷ 10 phút, trong [0,1; 0,6]", () => {
  const s = P.newSave(), base = { mode: "duako", R: 1, difficulty: "quansi", medal: "dong" };
  const e180 = A.arenaRewards(s, { ...base, durSec: 180 }).exp, e30 = A.arenaRewards(s, { ...base, durSec: 30 }).exp, e900 = A.arenaRewards(s, { ...base, durSec: 900 }).exp;
  assert.equal(e180, Math.round(600 * 0.18)); assert.equal(e30, Math.round(600 * 0.1)); assert.equal(e900, Math.round(600 * 0.6));
});
t("Vàng Seed tuần ở 4 tuần khác nhau → binh khí Danh", () => {
  const s = P.newSave(); s.arena = { medals: {}, best: {}, goldWeeks: ["2026-W37", "2026-W38", "2026-W39"] };
  const rw = A.arenaRewards(s, { mode: "seedtuan", week: "2026-W40", R: 1, difficulty: "quansi", medal: "vang", durSec: 300 });
  assert.equal(rw.drops[0]?.tier, 4);
});

console.log(`\n${pass} đạt, ${fail} trượt`);
process.exit(fail ? 1 : 0);
