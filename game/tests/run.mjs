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

console.log("Chân bám đất, chuyển động phụ (battle/ik.js)");
{
  const IK = await import("../js/battle/ik.js");
  const L1 = 0.44, L2 = 0.44;
  t("legIK tới đúng điểm trong tầm với, gối gập về trước", () => {
    for (const [ty, tz] of [[-0.8, 0], [-0.6, 0.3], [-0.5, -0.25], [-0.4, 0.1]]) {
      const [th, kn] = IK.legIK(ty, tz, L1, L2), [y, z] = IK.footPos(th, kn, L1, L2);
      near(y, ty, 1e-6, "y"); near(z, tz, 1e-6, "z"); assert.ok(kn >= 0, "gối lật: " + kn);
      assert.ok(IK.footPos(th, 0, L1, 0)[1] >= Math.min(0, tz) - 1e-9 || kn < 1e-6, "gối phải ở trước đường hông–bàn chân");
    }
  });
  t("legIK ngoài tầm với: duỗi thẳng về phía điểm, không NaN", () => {
    const [th, kn] = IK.legIK(-3, 0.5, L1, L2);
    assert.ok(Number.isFinite(th) && Number.isFinite(kn)); assert.ok(kn < 0.1, "kn " + kn);
    near(Math.atan2(-0.5, 3), th, 0.08, "hướng");
    for (const v of IK.legIK(0, 0, L1, L2)) assert.ok(Number.isFinite(v));
  });
  t("legShift: nâng/hạ bàn chân đúng dy, giữ vị trí trước sau", () => {
    const f0 = IK.footPos(-0.3, 0.9, L1, L2);
    for (const dy of [0.15, -0.05, 0.3]) {
      const [th, kn] = IK.legShift(-0.3, 0.9, L1, L2, dy), f1 = IK.footPos(th, kn, L1, L2);
      near(f1[0] - f0[0], dy, 1e-6, "dy"); near(f1[1], f0[1], 1e-6, "z");
    }
  });
  t("pelvisDrop chỉ hạ, không quá maxDrop", () => {
    assert.equal(IK.pelvisDrop(0.2, 0.1, 0.3), 0); near(IK.pelvisDrop(-0.1, 0.2, 0.3), -0.1, 1e-12); near(IK.pelvisDrop(-0.8, 0, 0.3), -0.3, 1e-12);
  });
  t("slopePitch: đế giày song song dốc lên (mũi chân ngóc lên = góc âm)", () => {
    const ground = (x, z) => 0.5 * z;                // dốc lên phía +z
    near(IK.slopePitch(ground, 0, 0, 0, 1), -Math.atan(0.5), 1e-9); near(IK.slopePitch(() => 1, 0, 0, 0, 1), 0, 1e-12);
  });
  t("spring hội tụ về đích, ổn định với dt lớn, đứng yên khi dt = 0", () => {
    const s = new Float32Array(2), k = 120, c = IK.damping(k, 0.5);
    for (let i = 0; i < 300; i++) IK.spring(s, 0, 1, k, c, 1 / 60);
    near(s[0], 1, 1e-3); IK.spring(s, 0, 0, k, c, 0); near(s[0], 1, 1e-3);
    for (let i = 0; i < 20; i++) IK.spring(s, 0, -1, k, c, 0.5);
    assert.ok(Number.isFinite(s[0]) && Math.abs(s[0] + 1) < 0.05, "s " + s[0]);
  });
  t("rope: buông thẳng khi đứng yên, giữ đúng độ dài, văng ngược khi neo chạy", () => {
    const n = 3, seg = 0.1, p = new Float32Array(n * 6);
    for (let i = 0; i < 240; i++) IK.rope(p, n, 0, 2, 0, seg, 1 / 60);
    near(p[(n - 1) * 6 + 1], 2 - n * seg, 1e-3, "treo"); near(p[(n - 1) * 6], 0, 1e-3);
    for (let i = 0; i < 20; i++) IK.rope(p, n, (i + 1) * 0.1, 2, 0, seg, 1 / 60);    // neo chạy +x 6 m/s
    assert.ok(p[(n - 1) * 6] < 2.0, "đuôi phải tụt lại sau neo");
    for (let k = 0; k < n; k++) { const o = k * 6, q = k ? (k - 1) * 6 : -1;
      const px = q < 0 ? 2.0 : p[q], py = q < 0 ? 2 : p[q + 1], pz = q < 0 ? 0 : p[q + 2];
      near(Math.hypot(p[o] - px, p[o + 1] - py, p[o + 2] - pz), seg, 1e-4, "đốt " + k); }
    IK.rope(p, n, 500, 0, 0, seg, 1 / 60); near(p[1], -seg, 1e-6, "neo nhảy xa → đặt lại");
    IK.rope(p, n, 500, 0, 0, seg, 0); assert.ok(p.every(Number.isFinite));
  });
  t("hangAngles dựng lại đúng hướng treo", () => {
    for (const [dx, dy, dz] of [[0, -1, 0], [0.3, -1, 0.2], [-0.2, -0.8, -0.4]]) {
      const [rx, rz] = IK.hangAngles(dx, dy, dz), L = Math.hypot(dx, dy, dz);
      near(Math.sin(rz), dx / L, 1e-9); near(-Math.cos(rz) * Math.cos(rx), dy / L, 1e-9); near(-Math.cos(rz) * Math.sin(rx), dz / L, 1e-9);
    }
  });
}

console.log("Địa hình làn đánh (battle/ground.js, data/terrain-b15.js)");
{
  const G = await import("../js/battle/ground.js");
  const { LANE_TERRAIN } = await import("../js/data/terrain-b15.js");
  const withF = (on, fn) => { G.setLaneFeatures(on); try { return fn(); } finally { G.setLaneFeatures(false); } };
  t("tắt công trình thì heightAt giữ nguyên như trước khi tách module", () => {
    near(G.heightAt(72, -32), withF(false, () => G.heightAt(72, -32)), 0);
    near(G.heightAt(300, -95), 0.70, 0.02, "chân lũy A khi chưa bật");
  });
  t("lũy Nguyên cao ~1,5 m, đoạn vỡ chỗ đường đi về mặt đất", () => {
    const f = LANE_TERRAIN.berms.find((b) => b.id === "LUY_A"), t0 = 0.2, x = f.a[0] + (f.b[0] - f.a[0]) * t0, z = f.a[1] + (f.b[1] - f.a[1]) * t0;
    withF(true, () => { assert.ok(G.featureHeight(x, z) > 1.3, "đỉnh " + G.featureHeight(x, z)); near(G.featureHeight(300, -75), 0, 0.05, "lối vỡ"); });
  });
  t("hào, hố trũng xuống và có bùn; gờ hố nhô lên; ngoài làn không đổi", () => withF(true, () => {
    assert.ok(G.featureHeight(453, 0) < -1.0 && G.mudAt(453, 0) > 0.8, "hào thành");
    near(G.featureHeight(453, -75), 0, 1e-9, "cầu đất trước cổng");
    for (const p of LANE_TERRAIN.pits) {
      assert.ok(G.featureHeight(p.x, p.z) < -0.7 * p.d, "lòng hố"); assert.ok(G.featureHeight(p.x + p.r, p.z) > 0.1 * p.d, "gờ hố");
      assert.ok(G.mudAt(p.x, p.z) >= 0.45, "bùn hố");
    }
    near(G.featureHeight(34, 0), 0, 0); near(G.featureHeight(172, 144), 0, 0); near(G.mudAt(100, -75), 0, 0);
  }));
  t("gò cao hai bên làn, featureNear nhận ra công trình và bỏ qua lối vỡ", () => withF(true, () => {
    for (const m of LANE_TERRAIN.mounds) near(G.featureHeight(m.x, m.z), m.h, 0.05);
    assert.equal(G.featureNear(300, -95, 0.5)?.id, "LUY_A"); assert.equal(G.featureNear(300, -75, 0.2), null);
  }));
  t("công trình không lấn Cứ Điểm, bản doanh, làng, ruộng", () => {
    const rings = BASES.filter((b) => b.front).map((b) => ({ x: 60 + b.lineX * 500, z: FRONTS[b.front].laneZ, r: b.type === "doanh_trai" ? 13 : b.type === "don" ? 10 : 7 }));
    for (const f of G.TERRAIN_FEATURES) {
      const pts = f.ax !== undefined ? [0, 0.25, 0.5, 0.75, 1].map((s) => [f.ax + f.dx * s, f.az + f.dz * s]) : [[f.x, f.z]];
      for (const [x, z] of pts) {
        for (const r of rings) assert.ok(Math.hypot(x - r.x, z - r.z) > r.r + f.reach * 0.5 || f.kind === "hao_thanh", `${f.id || f.type} lấn Cứ Điểm ở ${x},${z}`);
        assert.ok(Math.hypot(x - 34, z) > 40 && !G.paddyAt(x, z), `${f.id || f.type} lấn bản doanh/ruộng`);
      }
    }
  });
}

console.log("Va chạm có lưới tra, lối đi trên làn");
{
  const G = await import("../js/battle/ground.js");
  const { LANE_TERRAIN } = await import("../js/data/terrain-b15.js");
  const { MAP } = await import("../js/data/battle-b15.js");
  // bản quét hết cũ của collide() (trước khi có lưới) — lưới phải cho kết quả trùng từng bit
  const refCollide = (world, x, z, radius, openGates) => {
    for (const c of world.colliders) {
      const dx = c.x1 - c.x0, dz = c.z1 - c.z0, L2 = dx * dx + dz * dz;
      let t = ((x - c.x0) * dx + (z - c.z0) * dz) / L2; t = Math.max(0, Math.min(1, t));
      const px = c.x0 + dx * t, pz = c.z0 + dz * t;
      const ox = x - px, oz = z - pz, d = Math.hypot(ox, oz), min = c.r + radius;
      if (d < min && d > 1e-6) { x = px + (ox / d) * min; z = pz + (oz / d) * min; }
    }
    for (const id in world.gates) {
      const g = world.gates[id];
      if (openGates[id]) continue;
      if (Math.abs(z - g.z) < 5 && Math.abs(x - g.x) < 1.6 + radius) x = x < g.x ? g.x - 1.6 - radius : g.x + 1.6 + radius;
    }
    x = Math.max(4, Math.min(MAP.riverEastX + 3, x)); z = Math.max(MAP.riverNorthZ - 3, Math.min(196, z));
    return [x, z];
  };
  t("collide() có lưới tra trùng khớp bản quét hết (tường, cụm cọc dày, bán kính lớn, thêm va chạm sau)", () => {
    let s = 12345; const rnd = () => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 4294967296);
    const W = MAP.fortWallX, cs = [{ x0: W, z0: -164, x1: W, z1: -80, r: 1.6 }, { x0: W, z0: -70, x1: W, z1: 70, r: 1.6 }, { x0: W, z0: 80, x1: W, z1: 150, r: 1.6 }];
    for (let i = 0; i < 250; i++) { const x = 20 + rnd() * 560, z = -190 + rnd() * 380, seg = rnd() < 0.3; cs.push({ x0: x, z0: z, x1: seg ? x + rnd() * 12 - 6 : x + 0.01, z1: seg ? z + rnd() * 12 - 6 : z, r: 0.3 + rnd() * 1.2 }); }
    for (let i = 0; i < 7; i++) for (let j = 0; j < 6; j++) cs.push({ x0: 250 + i * 1.3, z0: -80 + j * 1.3, x1: 250.01 + i * 1.3, z1: -80 + j * 1.3, r: 0.9 });
    const world = { colliders: cs, gates: { A3: { x: W, z: -75 }, B3: { x: W, z: 75 } } }, open = { A3: false, B3: true };
    let bad = 0;
    for (let k = 0; k < 60000; k++) {
      const near = k % 3 === 0, c = cs[Math.floor(rnd() * cs.length)];
      const x = near ? c.x0 + rnd() * 4 - 2 : rnd() * 600, z = near ? c.z0 + rnd() * 4 - 2 : -200 + rnd() * 400, r = [0.4, 0.5, 0.7, 1.5][k % 4];
      const a = G.collide(world, x, z, r, open), b = refCollide(world, x, z, r, open);
      if (a[0] !== b[0] || a[1] !== b[1]) bad++;
      if (k === 30000) cs.push({ x0: 300, z0: -75, x1: 300.01, z1: -75, r: 1 });
    }
    assert.equal(bad, 0, bad + " lệch");
    const p = G.collide(world, 300.3, -75, 0.4, open); assert.ok(Math.hypot(p[0] - 300, p[1] + 75) >= 1.4 - 1e-9, "va chạm thêm sau phải có hiệu lực");
  });
  const segHit = (ax, az, bx, bz, px, pz) => { const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1e-9; let t = ((px - ax) * dx + (pz - az) * dz) / L2; t = Math.max(0, Math.min(1, t)); return Math.hypot(px - ax - dx * t, pz - az - dz * t); };
  const cumaParts = () => LANE_TERRAIN.fences.filter((f) => f.kind === "cu_ma");
  t("lối trước hai cổng thông: |z − laneZ| ≤ 4, x 430–452 không có cự mã, xác ngựa", () => {
    for (const lz of [-75, 75]) for (let x = 430; x <= 452; x += 0.5) for (let z = lz - 4; z <= lz + 4; z += 0.5) {
      for (const f of cumaParts()) assert.ok(segHit(f.a[0], f.a[1], f.b[0], f.b[1], x, z) > 0.6, `cự mã chắn cổng ở ${x},${z}`);
      for (const h of LANE_TERRAIN.horses) assert.ok(Math.hypot(h.x - x, h.z - z) > 1.0, `xác ngựa chắn cổng ở ${x},${z}`);
    }
  });
  t("lối vỡ chính của lũy Nguyên rộng ≥ 6 m, không vướng cự mã, xác ngựa (từ hào tới sau lũy 5 m)", () => {
    for (const lz of [-75, 75]) for (let x = 292; x <= 306; x += 0.5) for (let z = lz - 3; z <= lz + 3; z += 0.5) {
      for (const f of cumaParts()) assert.ok(segHit(f.a[0], f.a[1], f.b[0], f.b[1], x, z) > 0.6, `cự mã chắn lối vỡ ở ${x},${z}`);
      for (const h of LANE_TERRAIN.horses) assert.ok(Math.hypot(h.x - x, h.z - z) > 1.2, `xác ngựa chắn lối vỡ ở ${x},${z}`);
    }
  });
  t("xác ngựa cách hàng cự mã ≥ 2 m, không nằm giữa lòng hố", () => {
    for (const h of LANE_TERRAIN.horses) {
      for (const f of cumaParts()) assert.ok(segHit(f.a[0], f.a[1], f.b[0], f.b[1], h.x, h.z) >= 2, `ngựa (${h.x},${h.z}) đè cự mã`);
      for (const p of LANE_TERRAIN.pits) assert.ok(Math.hypot(h.x - p.x, h.z - p.z) >= p.r, `ngựa (${h.x},${h.z}) trong hố`);
    }
  });
  t("tắt công trình thì featureHeight, mudAt, featureNear về 0/null (giữ nguyên bản đồ mặc định)", () => {
    G.setLaneFeatures(false);
    assert.equal(G.featureHeight(300, -95), 0); assert.equal(G.mudAt(453, 0), 0); assert.equal(G.featureNear(300, -95, 1), null);
  });
}

// ==== Luật địa hình: chỗ đất cao thấp, bùn, công sự (sim/terrain-rules.js) — BẮT ĐẦU ====================
console.log("Luật địa hình (sim/terrain-rules.js)");
{
  const T = await import("../js/sim/terrain-rules.js");
  const G = await import("../js/battle/ground.js");
  const { TERRAIN } = await import("../js/data/tuning.js");
  const { LANE_TERRAIN } = await import("../js/data/terrain-b15.js");
  const { xToLine } = await import("../js/data/battle-b15.js");
  const withF = (on, fn) => { G.setLaneFeatures(on); try { return fn(); } finally { G.setLaneFeatures(false); } };
  const SL = TERRAIN.slope, HT = TERRAIN.height;
  t("dốc: phẳng/dốc nhỏ ×1; lên dốc chậm dần, sàn ×0,6; xuống dốc nhanh hơn, trần ×1,12", () => {
    assert.equal(T.slopeFactor(0), 1); assert.equal(T.slopeFactor(SL.dead * 0.9), 1); assert.equal(T.slopeFactor(-SL.dead * 0.9), 1);
    near(T.slopeFactor(0.5), 1 - SL.up * (0.5 - SL.dead), 1e-12);
    assert.equal(T.slopeFactor(5), SL.upFloor); assert.equal(T.slopeFactor(-5), SL.downCap);
    let prev = 2; for (let gr = -2; gr <= 2; gr += 0.05) { const f = T.slopeFactor(gr); assert.ok(f <= prev + 1e-12, "không giảm dần ở " + gr); prev = f; }
    near(T.slopeFactor(SL.dead + 1e-9), 1, 1e-6, "liền mạch ở mép vùng phẳng");
  });
  t("speedFactor dò dốc dọc hướng đi (không cần chuẩn hoá hướng), bùn ×(1 − 0,4·mud), sàn chung 0,4", () => {
    const plane = (x) => 0.5 * x, dry = () => 0, wet = () => 1;
    near(T.speedFactor(0, 0, 1, 0, plane, dry), T.slopeFactor(0.5), 1e-12, "lên");
    near(T.speedFactor(0, 0, -3, 0, plane, dry), T.slopeFactor(-0.5), 1e-12, "xuống");
    near(T.speedFactor(0, 0, 0, 0.2, plane, dry), 1, 1e-12, "đi ngang dốc");
    assert.equal(T.speedFactor(0, 0, 0, 0, plane, dry), 1, "đứng yên");
    near(T.speedFactor(0, 0, 0, 1, () => 0, wet), 1 - TERRAIN.mud, 1e-12, "bùn");
    assert.equal(T.speedFactor(0, 0, 1, 0, (x) => 3 * x, wet), TERRAIN.minSpeed, "vách dốc + bùn");
  });
  t("thế đất cao: vùng chết ±0,4 m, +8%/m vượt, trần +20%, sàn −15%, liền mạch; tầm bắn chỉ cộng, trần +25%", () => {
    assert.equal(T.heightDamageMult(0), 1); assert.equal(T.heightDamageMult(HT.dead), 1); assert.equal(T.heightDamageMult(-HT.dead), 1);
    near(T.heightDamageMult(HT.dead + 1), 1 + HT.perM, 1e-12); near(T.heightDamageMult(-HT.dead - 1), 1 - HT.perM, 1e-12);
    near(T.heightDamageMult(HT.dead + 1e-6), 1, 1e-6);
    assert.equal(T.heightDamageMult(50), 1 + HT.cap); assert.equal(T.heightDamageMult(-50), 1 - HT.floor);
    assert.equal(T.rangeMult(-3), 1); assert.equal(T.rangeMult(HT.dead), 1); assert.equal(T.rangeMult(50), 1 + HT.rangeCap);
    near(T.rangeMult(HT.dead + 1), 1 + HT.rangePerM, 1e-12);
  });
  t("trên bản đồ có làn đánh: đứng gò Nguyên (320, −93) đánh xuống lính ở làn +10–15%, lính đánh lên −10–15%", () => withF(true, () => {
    const top = { x: 320, z: -93 }, below = { x: 320, z: -84 };
    const up = T.hitMult(top, below), down = T.hitMult(below, top);
    assert.ok(up > 1.1 && up < 1.15, "trên gò " + up); assert.ok(down < 0.9 && down > 0.85, "dưới gò " + down);
    assert.equal(withF(false, () => T.hitMult({ x: 100, z: -75 }, { x: 103, z: -75 })), 1, "làn phẳng");
  }));
  t("trên bản đồ có làn đánh: leo mái lũy, vách hố chậm; hố ngập, đáy hào có bùn; làn trống giữ nguyên", () => withF(true, () => {
    assert.ok(T.speedFactor(297, -95, 1, 0) <= 0.75, "mái lũy " + T.speedFactor(297, -95, 1, 0));
    assert.ok(T.speedFactor(303, -95, 1, 0) > 1.05, "xuống mái sau lũy");
    assert.ok(T.speedFactor(271, -88, 0, 1) <= 1 - TERRAIN.mud * 0.99, "hố ngập");
    assert.ok(T.speedFactor(453, 0, 0, 1) < 0.7, "hào thành");
    near(T.speedFactor(100, -75, 1, 0), 1, 1e-9, "làn trống");
  }));
  t("vị trí công sự trên tuyến lấy từ data/terrain-b15.js: lũy Nguyên ~0,48, ụ ta A ~0,16, B ~0,35", () => {
    const mid = (id) => { const b = LANE_TERRAIN.berms.find((q) => q.id === id); return (b.a[0] + b.b[0]) / 2; };
    near(T.EARTHWORK_LINES.A.luy, xToLine(FRONTS.A, mid("LUY_A")), 1e-12); near(T.EARTHWORK_LINES.A.luy, 0.48, 0.005);
    near(T.EARTHWORK_LINES.B.luy, 0.48, 0.005); near(T.EARTHWORK_LINES.A.uTa, 0.16, 0.01); near(T.EARTHWORK_LINES.B.uTa, 0.35, 0.005);
  });
  t("earthworkLossMult: chỉ trong dải, lũy chỉ tính khi doanh trại cánh đó còn của địch", () => {
    const F = TERRAIN.front, L = T.EARTHWORK_LINES.A;
    assert.equal(T.earthworkLossMult("dich", "A", L.luy, true), F.luyLoss);
    assert.equal(T.earthworkLossMult("dich", "A", L.luy + F.luyBand[0] - 0.001, true), 1);
    assert.equal(T.earthworkLossMult("dich", "A", L.luy + F.luyBand[1] + 0.001, true), 1);
    assert.equal(T.earthworkLossMult("dich", "A", L.luy, false), 1, "lũy mất người giữ");
    assert.equal(T.earthworkLossMult("ta", "A", L.uTa, true), F.uTaLoss); assert.equal(T.earthworkLossMult("ta", "A", L.uTa + F.uTaBand + 0.001, true), 1);
    assert.equal(T.earthworkLossMult("ta", "A", L.luy, true), 1); assert.equal(T.earthworkLossMult("dich", "A", L.uTa, true), 1);
  });
  const mkE = (ew) => createSim({ fronts: FRONTS, bases: BASES, enemyMix: ENEMY_MIX, R: 1, earthworks: ew });
  t("mô phỏng có công sự: mặc định theo công trình làn đánh; cùng input → trùng khớp tuyệt đối sau 900 tick", () => {
    assert.equal(mk().earthworks, false); assert.equal(withF(true, () => mk().earthworks), true);
    const a = mkE(true), b = mkE(true);
    for (const s of [a, b]) { s.bases.A1.owner = "ta"; s.fronts.A.x = 0.40; }
    for (let i = 0; i < 900; i++) {
      if (i % 20 === 0) for (const s of [a, b]) { s.cooldowns.tiencong = 0; issueOrder(s, "A", "tiencong"); }
      simTick(a); simTick(b);
    }
    assert.deepEqual(snapshot(a), snapshot(b));
  });
  t("tổn thất Nguyên ×0,75 chỉ khi tuyến ở dải trước lũy và doanh trại còn của địch; quân ta ×0,8 ở dải ụ đất", () => {
    const one = (ew, x, front = "A", prep) => { const s = mkE(ew); s.fronts[front].x = x; prep?.(s); simTick(s); return s.fronts[front]; };
    const qd = (f) => totalQ(f, "dich"), qt = (f) => totalQ(f, "ta");
    const L = T.EARTHWORK_LINES.A;
    assert.ok(qd(one(true, L.luy)) > qd(one(false, L.luy)) + 0.05, "trong dải lũy");
    assert.equal(qd(one(true, 0.40)), qd(one(false, 0.40)), "ngoài dải");
    const lost = (s) => { s.bases.A2.owner = "ta"; };
    assert.equal(qd(one(true, L.luy, "A", lost)), qd(one(false, L.luy, "A", lost)), "mất doanh trại A2");
    assert.ok(qt(one(true, L.uTa)) > qt(one(false, L.uTa)) + 0.05, "dải ụ đất A");
    assert.ok(qt(one(true, T.EARTHWORK_LINES.B.uTa, "B")) > qt(one(false, T.EARTHWORK_LINES.B.uTa, "B")) + 0.05, "dải ụ đất B");
    assert.equal(qt(one(true, 0.30)), qt(one(false, 0.30)), "ngoài dải ụ đất");
  });
  t("tuyến qua dải trước lũy Nguyên chậm hơn khi có công sự (Tiến công liên tục, đã chiếm A1)", () => {
    const cross = (ew) => {
      const s = mkE(ew); s.bases.A1.owner = "ta"; s.fronts.A.x = 0.40;
      let tIn = -1;
      for (let i = 0; i < 900; i++) {
        if (i % 20 === 0) { s.cooldowns.tiencong = 0; issueOrder(s, "A", "tiencong"); }
        simTick(s);
        if (tIn < 0 && s.fronts.A.x >= T.EARTHWORK_LINES.A.luy + TERRAIN.front.luyBand[0]) tIn = i;
        if (s.fronts.A.x >= T.EARTHWORK_LINES.A.luy + TERRAIN.front.luyBand[1]) return i - tIn;
      }
      return Infinity;
    };
    const off = cross(false), on = cross(true);
    assert.ok(Number.isFinite(on) && on > off, `qua dải: có ${on} s, không ${off} s`);
    assert.ok(on < off * 1.5, `không được kẹt tuyến: có ${on} s, không ${off} s`);
  });
  t("cung thủ tìm gò: gò trong 14 m, đỉnh cách tướng 7 m tới 0,9 tầm; tắt công trình thì không", () => withF(true, () => {
    assert.equal(T.perchNear(322, -80, 314, -82, 16)?.x, 320);
    assert.equal(T.perchNear(322, -80, 300, -75, 16), null, "đỉnh gò ngoài tầm bắn tới tướng");
    assert.equal(T.perchNear(322, -80, 320, -90, 16), null, "tướng đứng ngay trên gò");
    assert.equal(T.perchNear(200, -75, 214, -80, 16), null, "không có gò gần");
    assert.equal(withF(false, () => T.perchNear(322, -80, 314, -82, 16)), null);
  }));
}
// ==== Luật địa hình — HẾT =======================================================================================

console.log("Hoạt ảnh lính (battle/soldier-motion.js)");
{
  const M = await import("../js/battle/soldier-motion.js");
  const { KITS } = await import("../js/data/tuning.js");
  // Chạy đường ống một lính (sải bước → tư thế → làm mượt → IK, vạt, tua) trên mặt đất cho trước.
  const run = (kit, { v = 0, frames = 300, ground = () => 0, state = {}, dir = 0, cb = null } = {}) => {
    const K = KITS[kit], horse = !!K.mounted, dt = 1 / 60, yaw = Math.PI / 2, mdx = Math.sin(yaw + dir), mdz = Math.cos(yaw + dir);
    const a = { id: 7, kit, K, state: "move", st: 0, windup: 0, windupT: K.windup, atkT: 9, spd: v, walk: 0.3, ready: false, flinch: 0, hitFront: 1, dieT: 0,
      panicT: 0, blockT: 0, evadeT: 0, fleeT: 0, chargeT: 0, scale: K.scale || 1, yaw, x: 0, z: 0, y: 0, role: "zone", ...state };
    const T = new Float32Array(M.NCH), P = new Float32Array(M.NCH), out = new Float64Array(M.BONE_FLOATS);
    for (let f = 0; f < frames; f++) {
      const px = a.x, pz = a.z; a.x += mdx * v * dt; a.z += mdz * v * dt;
      if (a.state === "dead") a.dieT += dt;
      M.advanceStride(a, px, pz, dt); M.poseFor(a, kit, K, f * dt, T);
      if (!f) P.set(T); else M.smoothPose(P, T, 1 - Math.exp(-dt * 18), 1 - Math.exp(-dt * M.legRate(a)));
      const g0 = ground(a.x, a.z);
      M.soldierFrame(a, horse ? "horse" : "human", a.x, g0, a.z, g0, P, dt, ground, true, out);
      cb?.(f, out, a);
    }
    return out;
  };
  // đế giày (khung cổ chân ftL = 10, ftR = 11) → toạ độ thế giới
  const sole = (out, j) => { const o = j * 12, lx = 0, ly = -0.085, lz = 0.05;
    return [out[o] * lx + out[o + 1] * ly + out[o + 2] * lz + out[o + 3], out[o + 4] * lx + out[o + 5] * ly + out[o + 6] * lz + out[o + 7], out[o + 8] * lx + out[o + 9] * ly + out[o + 10] * lz + out[o + 11]]; };
  const slope = (x, z) => 0.22 * z - 0.08 * x;
  t("mọi kiểu lính × trạng thái × mặt dốc: ma trận khớp hữu hạn (15 khớp)", () => {
    assert.equal(M.NJ, 15); assert.equal(M.BONE_FLOATS, 180);
    const states = [{}, { ready: true }, { ready: true, windup: 0.2, windupT: 0.4 }, { ready: true, atkT: 0.1 }, { state: "hit", st: 0.2 }, { state: "launch", st: 0.2 },
      { state: "down", st: 0.6 }, { state: "dead", dieT: 0 }, { blockT: 0.16, ready: true }, { fleeT: 2 }];
    for (const kit of Object.keys(KITS)) for (const s of states) for (const g of [() => 0, slope]) for (const v of [0, 2.5]) {
      const out = run(kit, { v, frames: 90, ground: g, state: s });
      assert.ok(out.every(Number.isFinite), `${kit} ${JSON.stringify(s)} v=${v}`);
    }
  });
  t("bàn chân chống không trượt: đi 1,5 m/s và chạy 3,1 m/s, tốc độ đế chạm đất < 12% tốc độ thân", () => {
    for (const [kit, v] of [["DV_GIAO", 1.5], ["NG_DAO", 3.1], ["DV_NO", 2.2]]) {
      let prev = null, n = 0, sum = 0;
      run(kit, { v, frames: 600, cb: (f, out) => {
        const cur = [sole(out, 10), sole(out, 11)];
        if (prev && f > 240) for (let i = 0; i < 2; i++) if (cur[i][1] < 0.005) { n++; sum += Math.hypot(cur[i][0] - prev[i][0], cur[i][2] - prev[i][2]) * 60 / v; }
        prev = cur;
      } });
      assert.ok(n > 50, kit + " ít khung chạm đất: " + n); assert.ok(sum / n < 0.12, `${kit} trượt ${(100 * sum / n).toFixed(1)}%`);
    }
  });
  t("đứng trên dốc 0,22: IK đặt hai đế giày sát mặt đất (≤ 2 cm)", () => {
    for (const kit of ["DV_GIAO", "NG_DAO", "NG_TANK"]) {
      const out = run(kit, { frames: 120, ground: slope });
      for (const j of [10, 11]) { const [x, y, z] = sole(out, j); assert.ok(Math.abs(y - slope(x, z)) <= 0.02, `${kit} khớp ${j} hở ${(y - slope(x, z)).toFixed(3)} m`); }
    }
  });
  t("tua giáo buông thẳng xuống khi đứng yên (khung tas chĩa xuống dưới)", () => {
    for (const kit of ["DV_GIAO", "NG_GIAO"]) {
      const out = run(kit, { frames: 300 }), o = 14 * 12;
      assert.ok(out[o + 5] > 0.9, `${kit}: trục −y của tua lệch khỏi phương đứng (${out[o + 5].toFixed(2)})`);    // cột y của trục y khung tas
    }
  });
}

console.log("Trời, nắng theo pha (battle/atmosphere.js)");
{
  const A = await import("../js/battle/atmosphere.js");
  t("bốn pha: sương gần < xa, P4 sương gần hơn P1, mặt trời thấp dần P2 > P1 > P3 > P4", () => {
    for (const p of A.ATMO) assert.ok(p.fogNear < p.fogFar, p.id);
    assert.ok(A.ATMO[3].fogFar < A.ATMO[0].fogFar); assert.ok(A.ATMO[1].el > A.ATMO[0].el && A.ATMO[0].el > A.ATMO[2].el && A.ATMO[2].el > A.ATMO[3].el && A.ATMO[3].el < 20);
    assert.equal(A.ATMO[3].smoke / A.ATMO[0].smoke, 3); assert.equal(A.ATMO[0].cols + A.ATMO[1].cols, 0);
  });
  t("sunDir là vectơ đơn vị, đúng hướng; khung bóng co khi nắng thấp; lớp vàng TPC trong [0,16; 0,5]", () => {
    for (const [e, az] of [[13, 168], [52, 80], [90, 0]]) { const d = A.sunDir(e, az); near(Math.hypot(d.x, d.y, d.z), 1, 1e-9); }
    near(A.sunDir(90, 0).y, 1, 1e-9); assert.ok(A.sunDir(30, 90).z > 0 && A.sunDir(30, 180).x < 0);
    assert.equal(A.shadowHalf(60), 45); assert.ok(A.shadowHalf(13) >= 14 && A.shadowHalf(13) < 45);
    for (let s = 0; s < 12; s += 0.25) { const w = A.tpcWeight(s); assert.ok(w <= 0.5 + 1e-12 && w >= 0.16 - 1e-12, "tpc " + s); }
  });
  t("vectơ thông số trộn đúng: đầu, cuối, giữa; màu tuyến tính", () => {
    const a = A.presetVec(A.ATMO[0]), b = A.presetVec(A.ATMO[3]), o = new Float32Array(A.NV);
    A.mixVec(o, a, b, 0); near(o[A.O.fogFar], A.ATMO[0].fogFar, 1e-3); A.mixVec(o, a, b, 1); near(o[A.O.fogFar], A.ATMO[3].fogFar, 1e-3);
    near(A.srgbToLinear(0.5), 0.214, 1e-3); const w = A.hexLin(0xffffff, [0, 0, 0]); near(w[0] + w[1] + w[2], 3, 1e-9);
  });
}

console.log("Icon chiêu, SFX, bảng đòn (đợt 7)");
{
  const { existsSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const root = fileURLToPath(new URL("../", import.meta.url));
  const { MOVE_INFO, nextHeavy } = await import("../js/data/moves-info.js");
  const { SFX_FILES } = await import("../js/battle/audio.js");
  t("mọi icon trong bảng đòn có file assets/icons/*.webp", () => {
    for (const [k, m] of Object.entries(MOVE_INFO)) assert.ok(existsSync(root + `assets/icons/${m.icon}.webp`), `${k}: thiếu ${m.icon}.webp`);
  });
  t("mọi mẫu SFX khai trong audio.js có file (đủ số biến thể), cả hai vòng nền", () => {
    const EXT = { drumroll: "m4a", horn: "m4a", cheer: "m4a", volley: "m4a", gong: "m4a", gatebreak: "m4a" };
    for (const [n, v] of Object.entries(SFX_FILES)) for (let i = 1; i <= v; i++) {
      const f = `${n}${v > 1 ? "-" + i : ""}.${EXT[n] || "wav"}`;
      assert.ok(existsSync(root + "assets/sfx/" + f), "thiếu " + f);
    }
    for (const f of ["ambience.m4a", "fire.m4a"]) assert.ok(existsSync(root + "assets/sfx/" + f), "thiếu " + f);
  });
  t("đòn C kế tiếp theo chuỗi: C1 khi rảnh, N2 đang chém → C3, vừa né → Lướt, sĩ quan Vỡ Thế → Đòn Quyết", () => {
    const cKey = (k) => "C" + Math.min(4, k);
    const h = (o) => ({ state: "free", move: null, chain: 0, chainGrace: 0, postDodge: 0, cKey, findBroken: () => null, ...o });
    assert.equal(nextHeavy(h({})), "C1");
    assert.equal(nextHeavy(h({ state: "attack", move: "N2", chain: 2 })), "C3");
    assert.equal(nextHeavy(h({ chainGrace: 0.2, chain: 5 })), "C4");        // C5 chưa mở thì lùi về C4
    assert.equal(nextHeavy(h({ state: "attack", move: "N6", chain: 6 })), "C1");
    assert.equal(nextHeavy(h({ postDodge: 0.2 })), "D");
    assert.equal(nextHeavy(h({ findBroken: () => ({}) })), "DQ");
  });
}

// ---- đợt 8: comic trong game, thẻ Sử quán, Quiz chương (GDD 22.2, 22.3, 22.6, 12.11) ----------------
{
  console.log("\nComic, Sử quán, Quiz (đợt 8)");
  const { existsSync, statSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const root = fileURLToPath(new URL("../", import.meta.url));
  const { COMIC_B15 } = await import("../js/data/comic-b15.js");
  const { CARDS, CARD_BY_ID, QUIZ_B15 } = await import("../js/data/suquan-b15.js");
  const C = await import("../js/meta/chapter.js");
  const { pagesFor, panelSyllables, readSeconds } = await import("../js/ui/comic.js");
  const { STORY_INSERTS } = await import("../js/data/battle-b15.js");
  const fresh = () => ({ ...P.newSave() });
  const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };

  t("comic B15 bản VS: 6 khung mở ≤ 40 s đọc, 6 khung kết, 1 khung chèn; đủ ảnh AVIF + WebP; tổng AVIF ≤ 3 MB", () => {
    assert.equal(COMIC_B15.variant, "VS");
    assert.equal(COMIC_B15.open.length, 6); assert.equal(COMIC_B15.close.length, 6); assert.deepEqual(COMIC_B15.insert, ["D2"]);
    const openSec = COMIC_B15.open.reduce((s, id) => s + readSeconds(COMIC_B15.panels[id]), 0);
    assert.ok(openSec <= 40, `mở chương ${openSec.toFixed(1)} s`);
    let bytes = 0;
    for (const id of [...COMIC_B15.open, ...COMIC_B15.insert, ...COMIC_B15.close]) {
      for (const ext of ["avif", "webp"]) assert.ok(existsSync(root + `assets/comic/B15/${id}.${ext}`), `thiếu ${id}.${ext}`);
      bytes += statSync(root + `assets/comic/B15/${id}.avif`).size;
    }
    assert.ok(bytes <= 3 * 1024 * 1024, `AVIF ${(bytes / 1048576).toFixed(2)} MB`);
  });
  t("mỗi khung ≤ 35 âm tiết, lời dẫn ≤ 25, ≤ 3 bóng; lời dẫn luôn có nhãn (22.3)", () => {
    for (const [id, p] of Object.entries(COMIC_B15.panels)) {
      assert.ok(panelSyllables(p) <= 35, `${id}: ${panelSyllables(p)} âm tiết`);
      if (p.caption) { assert.ok(p.caption.vi.split(/\s+/).length <= 25, `${id}: lời dẫn dài`); assert.ok(["Chính sử", "Tương truyền", "Hư cấu"].includes(p.caption.label), id); }
      assert.ok((p.bubbles || []).length <= 3, id);
    }
  });
  t("chia trang theo pages của dữ liệu, giữ thứ tự đọc; khung lẻ thành trang riêng", () => {
    const pg = pagesFor(COMIC_B15, COMIC_B15.open);
    assert.deepEqual(pg.flat(2), COMIC_B15.open);
    assert.deepEqual(pagesFor(COMIC_B15, ["D2"]), [[["D2"]]]);
    assert.deepEqual(pagesFor(COMIC_B15, ["K4", "K5", "K6"]), [[["K4", "K5"]], [["K6"]]]);   // trang VS: K4 + K5 cùng hàng
  });
  t("khung chèn giữa trận nằm trong comic và có trường insert", () => {
    for (const id of Object.values(STORY_INSERTS)) { assert.ok(COMIC_B15.panels[id], id); assert.ok(COMIC_B15.panels[id].insert, id); }
  });
  t("ngân hàng Quiz B15 qua kiểm tra pipeline 22.6 (schema, đáp án ở 0, không trùng, khung + seenRef tồn tại, nhãn)", () => {
    const errs = C.lintQuiz(QUIZ_B15, { panels: COMIC_B15.panels, cards: CARD_BY_ID });
    assert.deepEqual(errs, []);
    assert.ok(QUIZ_B15.length >= 10 && QUIZ_B15.length <= 15, `${QUIZ_B15.length} câu (10–15 mỗi Chương)`);
  });
  t("pipeline bắt lỗi: đáp án không ở 0, seenRef duy nhất là thẻ Chuyện bên lề", () => {
    const bad = { ...QUIZ_B15[0], id: "X1", answer: 2 };
    const bl = { ...QUIZ_B15[1], id: "X2", seenRef: ["card:B15-bl-co"] };
    const errs = C.lintQuiz([bad, bl], { panels: COMIC_B15.panels, cards: CARD_BY_ID });
    assert.ok(errs.some((e) => e.startsWith("X1")) && errs.some((e) => e.startsWith("X2")), errs.join("; "));
  });
  t("thẻ Sử quán: mỗi thẻ đúng một nhãn, có nguồn, khóa mở hợp lệ", () => {
    const KEYS = ["chapterOpen", "battleStart", "bossMet", "firstWin", "firstQuiz", "keSach:coAoTong", "keSach:muiTenThu"];
    for (const c of CARDS) {
      assert.ok(["Chính sử", "Tương truyền", "Hư cấu"].includes(c.label), c.id);
      assert.ok(c.src.length && c.body.length && KEYS.includes(c.unlock), c.id);
      for (const p of c.panels) assert.ok(COMIC_B15.panels[p], `${c.id}: khung ${p}`);
    }
  });
  t("mở thẻ theo kết quả trận: gặp Toa Đô, Kế Sách thành hay bại, thắng lần đầu; không mở hai lần", () => {
    const s = fresh();
    const res = { won: true, bossMet: true, keSachList: [{ id: "coAoTong", state: "thatbai" }, { id: "muiTenThu", state: "khoa" }] };
    const got = C.unlockCards(s, "B15", C.battleUnlockKeys(res), 1);
    assert.deepEqual(got.sort(), ["B15-coaotong", "B15-tran", "X19"]);
    assert.deepEqual(C.unlockCards(s, "B15", C.battleUnlockKeys(res), 2), []);
  });
  t("Quiz chỉ rút câu đã gặp (khung đã xem hoặc thẻ đã mở), không hai câu cùng khung, 3–5 câu", () => {
    const s = fresh();
    assert.equal(C.pickQuiz(s, QUIZ_B15, { chapter: "B15", rng: seq(0.3, 0.7, 0.1) }).length, 0);
    C.markSeen(s, "B15", ["O2", "O3"]);
    const a = C.pickQuiz(s, QUIZ_B15, { chapter: "B15", rng: seq(0.3, 0.7, 0.1) });
    assert.ok(a.length >= 1 && a.every((q) => q.seenRef.some((r) => r === "panel:O2" || r === "panel:O3")), a.map((q) => q.id).join());
    assert.equal(new Set(a.map((q) => q.panel)).size, a.length);
    C.markSeen(s, "B15", [...COMIC_B15.open, ...COMIC_B15.close, "D2"]);
    C.unlockCards(s, "B15", ["chapterOpen", "battleStart", "bossMet", "firstWin"]);
    const b = C.pickQuiz(s, QUIZ_B15, { chapter: "B15", rng: seq(0.9, 0.2, 0.5, 0.05) });
    assert.equal(b.length, 4);
    assert.equal(new Set(b.map((q) => q.panel)).size, 4);
  });
  t("ôn ngắt quãng: sai → hỏi lại sau 1 Chương; đúng khi ôn → lại sau 3 Chương rồi rời hàng ôn", () => {
    const s = fresh(), q = QUIZ_B15[0];
    C.completeChapter(s, "B15");                          // xong B15: done = 1
    C.answerQuiz(s, q, false);
    assert.deepEqual(s.quiz.review, [{ id: q.id, due: 2, stage: 1 }]);
    s.quiz.done = 2;                                      // xong Chương kế
    C.markSeen(s, "B15", ["O2"]);
    assert.ok(C.pickQuiz(s, QUIZ_B15, { chapter: "B15", rng: seq(0.5) }).some((x) => x.id === q.id));
    C.answerQuiz(s, q, true);
    assert.deepEqual(s.quiz.review, [{ id: q.id, due: 5, stage: 2 }]);
    s.quiz.done = 5; C.answerQuiz(s, q, true);
    assert.deepEqual(s.quiz.review, []);
    assert.equal(s.quiz.answered[q.id].first, false);
  });
  t("câu sai chưa tới hạn không bị hỏi lại sớm; câu ôn tới hạn của Chương khác vẫn quay lại (tối đa 2)", () => {
    const s = fresh();
    C.markSeen(s, "B15", [...COMIC_B15.open, ...COMIC_B15.close, "D2"]);
    C.completeChapter(s, "B15");
    const wrong = QUIZ_B15.slice(0, 3);
    for (const q of QUIZ_B15) C.answerQuiz(s, q, !wrong.includes(q));
    for (let i = 0; i < 20; i++) {
      const r = C.pickQuiz(s, QUIZ_B15, { chapter: "B15", rng: Math.random });
      assert.ok(!r.some((q) => wrong.includes(q)), "hỏi lại câu sai trước hạn");
    }
    s.quiz.done = 2;                                      // xong Chương kế (B20): câu B15 tới hạn vào Quiz của B20
    const bank = [...QUIZ_B15, { ...QUIZ_B15[3], id: "B20-Q01", chapter: "B20", seenRef: ["card:B15-tran"] }];
    C.unlockCards(s, "B15", ["firstWin"]);
    const r = C.pickQuiz(s, bank, { chapter: "B20", rng: seq(0.2, 0.8, 0.5) });
    assert.equal(r.filter((q) => q.chapter === "B15").length, 2);
    assert.ok(r.some((q) => q.id === "B20-Q01"));
  });
  t("bản lưu cũ đã thắng trận: Chương B15 coi như xong, mở thẻ, Quiz không bị khóa", () => {
    const s = P.migrate({ stats: { battles: 3, wins: 1, tpc: 0, ko: 0, bestTime: null } });
    assert.equal(C.syncLegacy(s), true);
    assert.equal(C.chapterState(s, "B15").cleared, true);
    assert.ok(s.cards["B15-tran"] && s.cards.H35);
    assert.equal(C.syncLegacy(s), false);
    assert.equal(C.syncLegacy(P.migrate({})), false);
  });
  t("đúng/sai giữ thứ tự Đúng, Sai; trắc nghiệm được xáo", () => {
    const tf = QUIZ_B15.find((q) => q.type === "truefalse"), mc = QUIZ_B15.find((q) => q.type === "mcq4");
    assert.deepEqual(C.optionOrder(tf, seq(0.9, 0.1)), [0, 1]);
    assert.notDeepEqual(C.optionOrder(mc, seq(0.1, 0.1, 0.1)), [0, 1, 2, 3]);
  });
  t("bản lưu cũ (chưa có chapters/cards/quiz) nạp được và tạo trạng thái Chương khi cần", () => {
    const old = P.migrate({ hero: { level: 3, exp: 0, nodes: [] } });
    const ch = C.chapterState(old, "B15");
    assert.equal(ch.openSeen, false); assert.deepEqual(ch.seen, []);
  });
}

console.log("\nTổng Phản Công lật Cứ Điểm (sim/front.js triggerTPC)");
{
  // A2 ở lineX 0,55, G0 80 → lật khi G < 40. Mặt trận A là mặt trận đang đứng: tuyến +0,20 khi kích.
  const tpcAt = (x, G) => { const s = mk(); s.fronts.A.x = x; s.bases.A2.G = G; const f = triggerTPC(s, "A", 25); return { s, f }; };
  t("tuyến đang áp sát A2 (0,50), G 30 < 40 → A2 đổi chủ (trước đây xét sau khi đẩy tuyến tới 0,70 nên bỏ sót)", () => {
    const { s, f } = tpcAt(0.5, 30);
    assert.ok(f.includes("A2"), `lật: ${f}`); assert.equal(s.bases.A2.owner, "ta"); assert.equal(s.bases.A2.keeperAlive, false);
  });
  t("tuyến cách A2 0,20 (0,35) được đẩy tới đúng A2 → A2 đổi chủ (như cũ)", () => assert.ok(tpcAt(0.35, 30).f.includes("A2")));
  t("tuyến quét qua A2 nhưng G ≥ 50% → không lật", () => assert.ok(!tpcAt(0.5, 40).f.includes("A2")));
  t("tuyến còn xa A2 (0,20 → 0,40) → không lật", () => assert.ok(!tpcAt(0.2, 10).f.includes("A2")));
  t("cổng không bao giờ bị Tổng Phản Công lật", () => { const s = mk(); s.fronts.A.x = 0.75; s.bases.A3.G = 0; assert.ok(!triggerTPC(s, "A", 25).includes("A3")); });
}

console.log(`\n${pass} đạt, ${fail} trượt`);
process.exit(fail ? 1 : 0);
