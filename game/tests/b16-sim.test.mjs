// tests/b16-sim.test.mjs — luật thuần của B16 Chương Dương (sim/b16.js) và dữ liệu trận (data/battle-b16.js): làng dân binh, thuyền
// neo, chiếm bến, xe húc, cổng, Thoát Hoan, điện chính, thua theo giờ, chụp / khôi phục, xác định. Chạy trong Node:
//   node game/tests/b16-sim.test.mjs
import assert from "node:assert/strict";
import { createB16, tickB16, damageGateB16, damageBannerB16, bossFloorB16, noteSquadCleared, sideB16, snapshotB16, restoreB16, along, routeLen } from "../js/sim/b16.js";
import * as D from "../js/data/battle-b16.js";
import { MAP, BASES } from "../js/data/battle-b15.js";
import { waterDist } from "../js/battle/ground.js";

let pass = 0, fail = 0;
async function t(name, fn) {
  try { await fn(); pass++; console.log("  ok  " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + (e.stack || e.message)); }
}

// đầu vào giả: tướng đứng ở p, địch theo bảng foes [{ x, z }]
const inp = (p, { foes = [], ramMoving = false, bossDown = false, alive = true, torches = [], landingDef = 0, counterLeft = 0 } = {}) => ({
  hero: { x: p.x, z: p.z, alive }, ramMoving, bossDown, landingDef, counterLeft, torchesAt: (i) => torches[i] || 0,
  foesAt: (x, z, r) => foes.filter((f) => Math.hypot(f.x - x, f.z - z) < r).length,
});
// chạy n giây theo bước 1/10 s, gom sự kiện
function run(st, sec, I, dt = 0.1) { const ev = []; for (let i = 0; i < Math.round(sec / dt); i++) ev.push(...tickB16(st, typeof I === "function" ? I(st) : I, dt)); return ev; }
const types = (ev) => ev.map((e) => e.type);

// đưa trận tới đầu một pha bằng đúng luật (không đặt thẳng trạng thái)
function toPhase(st, k) {
  if (k >= 1) { run(st, 31, inp(D.VILLAGES[0])); run(st, 31, inp(D.VILLAGES[1])); }
  if (k >= 2) { for (const B of D.BOATS) run(st, 2.6, inp(B)); run(st, D.LANDING.capSec + 0.2, inp(D.LANDING)); }
  if (k >= 3) run(st, 400, inp({ x: 0, z: 0 }, { ramMoving: true }));
  if (k >= 4) run(st, 0.1, inp({ x: 0, z: 0 }, { bossDown: true }));
  assert.equal(st.phase, k);
}

console.log("Dữ liệu B16");
await t("3 làng, 12 thuyền, 5 pha có goal và tip, cổng là cổng thật của world.js", () => {
  assert.equal(D.VILLAGES.length, 3); assert.equal(D.BOATS.length, 12); assert.equal(D.PHASES.length, 5);
  for (const P of D.PHASES) { assert.ok(P.goal && P.tip && P.par > 0, P.id); }
  const gateIds = BASES.filter((b) => b.type === "cong").map((b) => b.id);
  assert.ok(gateIds.includes(D.GATE_SOUTH) && gateIds.includes(D.GATE_EAST));
  assert.equal(D.PAR_B16, D.PHASES.reduce((s, p) => s + p.par, 0));
  assert.ok(D.HISTORY_NOTES.length >= 3);
});
await t("làng, bến, xe húc, điện ở trên đất; thuyền ở mép nước, với tới được từ bờ", () => {
  for (const V of D.VILLAGES) assert.ok(waterDist(V.x, V.z) > V.r, V.id);
  assert.ok(waterDist(D.LANDING.x, D.LANDING.z) > D.LANDING.r);
  for (const p of D.RAM.route) assert.ok(waterDist(p.x, p.z) > 5, JSON.stringify(p));
  for (const B of D.BOATS) {
    assert.ok(waterDist(B.x, B.z) < -3 && waterDist(B.x, B.z) > -7, B.id);                 // trong nước (thân 3,4 m không chạm bờ), sát bờ
    assert.ok(MAP.riverNorthZ - 3 - B.z < D.BOAT_RULE.reach, B.id);                        // tướng đứng mép đất (kẹp z ≥ bờ − 3) với tới
    assert.ok(B.x < MAP.fortWallX - 8, B.id);                                              // ngoài tường thành
  }
  // điện, sân Thoát Hoan trong tường; làng, bến ngoài tường
  for (const p of [D.PALACE, D.BOSS_B16.at]) assert.ok(p.x > MAP.fortWallX + 5 && p.x < MAP.riverEastX && p.z > MAP.riverNorthZ && p.z < MAP.fortSouthZ);
  for (const p of [...D.VILLAGES, D.LANDING]) assert.ok(p.x < MAP.fortWallX - 20);
  // đường xe húc tới đúng cổng nam (cổng trên tường tây, z của BASES)
  const g = BASES.find((b) => b.id === D.GATE_SOUTH), end = D.RAM.route.at(-1);
  assert.ok(Math.abs(end.z - 75) < 1 && Math.abs(end.x - MAP.fortWallX) < 8, JSON.stringify({ end, g: g.id }));
});

console.log("Luật B16 (sim/b16.js)");
await t("trạng thái đầu: pha 0, cổng hp gốc × S, chưa xong gì", () => {
  const st = createB16({ S: 2 });
  assert.equal(st.phase, 0); assert.equal(st.villages.length, 3); assert.equal(st.boats.length, 12);
  assert.equal(st.gates.B3.hp, D.GATES.B3.hp * 2); assert.equal(st.gates.A3.hp0, D.GATES.A3.hp * 2);
  assert.deepEqual(st.main, [false, false, false, false, false]);
});
await t("làng tập hợp sau 30 s đứng trong vòng; có địch trong vòng thì đứng yên tiến độ", () => {
  const st = createB16(), V = D.VILLAGES[0];
  let ev = run(st, 15, inp(V, { foes: [{ x: V.x + 2, z: V.z }] }));
  assert.equal(st.villages[0].p, 0); assert.ok(st.villages[0].blocked); assert.match(st.prompt.text, /dẹp/);
  ev = run(st, 29.5, inp(V));
  assert.ok(!st.villages[0].done);
  ev = run(st, 0.6, inp(V));
  assert.ok(st.villages[0].done); assert.deepEqual(types(ev), ["villageRallied"]); assert.equal(st.rallied, 1);
  run(st, 10, inp({ x: V.x + V.r + 1, z: V.z }));                                            // ra ngoài vòng: không gì đổi
  assert.equal(st.rallied, 1);
});
await t("đủ 2 làng thì sang pha 1; làng thứ ba vẫn gọi được tới khi chiếm bến", () => {
  const st = createB16();
  run(st, 31, inp(D.VILLAGES[0]));
  const ev = run(st, 31, inp(D.VILLAGES[1]));
  assert.deepEqual(types(ev), ["villageRallied", "phase"]); assert.equal(st.phase, 1); assert.ok(st.main[0]);
  run(st, 31, inp(D.VILLAGES[2]));
  assert.equal(st.rallied, 3);
});
await t("thuyền: đứng sát 2,5 s thì cháy; địch kề bên thì chặn; thuyền đầu tiên cháy là báo động (lửa)", () => {
  const st = createB16(); toPhase(st, 1);
  const B = D.BOATS[0], bank = { x: B.x, z: -170 };                                       // đứng mép bờ, trong lau sậy
  let ev = run(st, 2, inp(bank, { foes: [{ x: B.x + 4.5, z: B.z + 1 }] }));
  assert.deepEqual(types(ev), []); assert.equal(st.boats[0].p, 0);                         // lính sát thuyền chặn châm lửa, nhưng ngoài tầm thấy trong lau sậy
  ev = run(st, 2.6, inp(bank));
  assert.deepEqual(types(ev), ["boatBurnt", "alarm"]); assert.equal(st.burnt, 1); assert.equal(st.alarmBy, "lua");
});
await t("báo động: bước lên đê; bị thấy ở 14 m ngoài lau sậy, trong lau sậy chỉ 5 m; trước pha 1 không báo động", () => {
  const dyke = { x: (D.DYKE.x0 + D.DYKE.x1) / 2, z: (D.DYKE.z0 + D.DYKE.z1) / 2 };
  const s0 = createB16(); run(s0, 1, inp(dyke)); assert.equal(s0.alarmT, null);
  const s1 = createB16(); toPhase(s1, 1); const ev = run(s1, 0.1, inp(dyke));
  assert.deepEqual(ev, [{ type: "alarm", by: "de" }]);
  const R = D.REEDS[1], reed = { x: (R.x0 + R.x1) / 2, z: (R.z0 + R.z1) / 2 }, foe8 = [{ x: reed.x + 8, z: reed.z }];
  assert.ok(Math.hypot(reed.x - D.LANDING.x, reed.z - D.LANDING.z) < D.ALARM.near);
  const s2 = createB16(); toPhase(s2, 1); run(s2, 3, inp(reed, { foes: foe8 })); assert.equal(s2.alarmT, null);
  const open = { x: D.LANDING.x, z: D.LANDING.z + 12 };
  const s3 = createB16(); toPhase(s3, 1); run(s3, 0.2, inp(open, { foes: [{ x: open.x + 8, z: open.z }] })); assert.equal(s3.alarmBy, "thay");
});
await t("kho quân nhu: đuốc tới sau torchDelay giây kể từ báo động; lính đuốc sát kho burnSec giây thì cháy; chiếm bến thì kho còn lại giữ được", () => {
  const st = createB16(); toPhase(st, 1);
  run(st, 2.6, inp(D.BOATS[0]));
  let ev = run(st, D.DEPOT_RULE.torchDelay + 0.2, inp({ x: 0, z: 0 }, { torches: [1, 0] }));
  assert.ok(types(ev).includes("torches"));
  ev = run(st, D.DEPOT_RULE.burnSec, inp({ x: 0, z: 0 }, { torches: [1, 0] }));
  assert.ok(st.depots[0].burnt && !st.depots[1].burnt); assert.ok(ev.some((e) => e.type === "depotBurnt" && e.id === "K1"));
  for (const B of D.BOATS.slice(1)) run(st, 2.6, inp(B));
  run(st, D.LANDING.capSec + 0.2, inp(D.LANDING));
  assert.deepEqual(st.depots.map((d) => d.saved), [false, true]); assert.equal(sideB16(st).S_DEPOTS, false);
});
await t("phản công bến: bắt đầu `at` giây sau khi chiếm; bỏ trống thì sức giữ về 0 là thua; dẹp hết lính phản công là xong", () => {
  const st = createB16(); toPhase(st, 2);
  let ev = run(st, D.COUNTER.at + 0.1, inp({ x: 0, z: 0 }, { counterLeft: 5 }));
  assert.ok(types(ev).includes("counterStart")); assert.equal(st.counter.state, "run");
  const foes = Array.from({ length: 5 }, (_, i) => ({ x: D.LANDING.x + i, z: D.LANDING.z }));
  run(st, 100 / (D.COUNTER.drainPer * 5) - 2, inp({ x: 0, z: 0 }, { foes, counterLeft: 5 }));
  assert.ok(!st.over && st.counter.keep > 0 && st.counter.keep < 10);                       // 5 lính, bến trống: 0,25 × 5 mỗi giây
  run(st, 3, inp({ x: 0, z: 0 }, { foes, counterLeft: 5 }));
  assert.ok(st.over && !st.won); assert.match(st.why, /Mất bến/); assert.equal(st.counter.state, "lost");
  const s2 = createB16(); toPhase(s2, 2);
  run(s2, D.COUNTER.at + 0.1, inp({ x: 0, z: 0 }, { counterLeft: 5 }));
  run(s2, 10, inp(D.LANDING, { foes: foes.slice(0, 2), counterLeft: 2, landingDef: 6 }));
  assert.equal(s2.counter.keep, 100);
  ev = run(s2, 0.2, inp(D.LANDING, { counterLeft: 0 }));
  assert.deepEqual(ev.filter((e) => e.type === "counterEnd"), [{ type: "counterEnd", ok: true }]); assert.ok(!s2.over);
});
await t("phản công bến: tụt tối đa drainPer × cap mỗi giây — mất bến không dưới 60 s dù đông địch", () => {
  assert.ok(100 / (D.COUNTER.drainPer * D.COUNTER.cap) >= 60);
  const st = createB16(); toPhase(st, 2);
  run(st, D.COUNTER.at + 0.1, inp({ x: 0, z: 0 }, { counterLeft: 30 }));
  const foes = Array.from({ length: 30 }, (_, i) => ({ x: D.LANDING.x + (i % 6), z: D.LANDING.z + Math.floor(i / 6) }));
  run(st, 59, inp({ x: 0, z: 0 }, { foes, counterLeft: 30 }));
  assert.ok(!st.over);
});
await t("Vương Kỳ: chỉ chém được ở pha 3; còn cờ thì Thoát Hoan có sàn 50%; đổ đủ 3 cờ thì hết sàn", () => {
  const st = createB16({ S: 1.5 });
  assert.equal(damageBannerB16(st, 0, 1e6), 0);
  toPhase(st, 3);
  assert.equal(bossFloorB16(st), D.BANNER_RULE.floorPct); assert.equal(st.banners[0].hp0, D.BANNER_RULE.hp * 1.5);
  const ev = [];
  damageBannerB16(st, 0, 1e6, ev); damageBannerB16(st, 1, 1e6, ev);
  assert.equal(bossFloorB16(st), D.BANNER_RULE.floorPct);
  damageBannerB16(st, 1, 1e6, ev);
  damageBannerB16(st, 2, 1e6, ev);
  assert.deepEqual(types(ev), ["bannerDown", "bannerDown", "bannerDown", "bannersAll"]); assert.equal(bossFloorB16(st), 0);
});
await t("Đoạt Giáo: đủ 10 đội bị tước thì nhiệm vụ phụ S_DISARM; dữ liệu đủ đội", () => {
  assert.ok(D.SQUADS.landing + D.SQUADS.sentryPairs >= D.SQUADS.need);
  assert.ok(D.SQUADS.landing * D.SQUADS.size <= D.LANDING.garrison);
  const st = createB16();
  for (let i = 0; i < 9; i++) noteSquadCleared(st, i);
  noteSquadCleared(st, 3);                                                                   // ô đã tước (vd sau khi tải lại điểm lưu): không tính lại
  assert.equal(st.squadsCleared, 9); assert.deepEqual(st.squadsDone, [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(sideB16(st).S_DISARM, false); noteSquadCleared(st, 9); assert.equal(sideB16(st).S_DISARM, true);
  const snap = snapshotB16(st), s2 = createB16(); restoreB16(s2, snap); assert.deepEqual(s2.squadsDone, st.squadsDone);
});
await t("chưa đủ 12 thuyền thì không chiếm được bến; đủ thì đứng trong vòng capSec giây", () => {
  const st = createB16(); toPhase(st, 1);
  run(st, 20, inp(D.LANDING));
  assert.equal(st.landing.p, 0);
  for (const B of D.BOATS) run(st, 2.6, inp(B));
  assert.equal(st.burnt, 12);
  const ev = run(st, D.LANDING.capSec + 0.2, inp(D.LANDING));
  assert.deepEqual(types(ev), ["landingTaken", "keSach", "phase"]); assert.equal(st.phase, 2); assert.ok(st.main[1]);
  assert.equal(ev[0].allVillages, false);                                                   // chỉ 2 làng: Dân binh các lộ hỏng
  assert.deepEqual(ev[1], { type: "keSach", id: "danBinh", ok: false });
});
await t("pha 2: xe húc chỉ đi khi ramMoving, phục kích theo quãng, tới cổng thì húc mở cổng nam → pha 3", () => {
  const st = createB16(); toPhase(st, 2);
  run(st, 10, inp({ x: 0, z: 0 }));
  assert.equal(st.ram.s, 0);
  const ev = run(st, 400, inp({ x: 0, z: 0 }, { ramMoving: true }));
  const ty = types(ev);
  assert.deepEqual(ty.filter((x) => x === "ambush").length, 2);
  assert.ok(ty.indexOf("ramArrived") > ty.lastIndexOf("ambush"));
  assert.ok(ty.includes("gateOpen")); assert.equal(st.phase, 3); assert.ok(st.main[2]);
  assert.ok(st.gates.B3.open);
});
await t("đòn tướng vào cổng chỉ từ pha 2; mở cổng nam bằng đòn cũng sang pha 3", () => {
  const st = createB16(); toPhase(st, 1);
  assert.equal(damageGateB16(st, "B3", 5000), 0);
  for (const B of D.BOATS) run(st, 2.6, inp(B)); run(st, D.LANDING.capSec + 0.2, inp(D.LANDING));
  assert.equal(damageGateB16(st, "B3", 1000), 1000);
  damageGateB16(st, "B3", 1e9);
  const ev = run(st, 0.1, inp({ x: 0, z: 0 }));
  assert.ok(st.gates.B3.open); assert.equal(st.phase, 3); assert.deepEqual(types(ev), ["phase"]);
});
await t("cổng đông tự mòn từ pha 2 (cánh Quang Khải), không thay cổng nam", () => {
  const st = createB16(); toPhase(st, 2);
  const ev = run(st, 1 / D.GATES.A3.wingDps + 1, inp({ x: 0, z: 0 }));
  assert.ok(ev.some((e) => e.type === "gateOpen" && e.id === "A3"));
  assert.equal(st.phase, 2);                                                                  // cổng đông không thay cổng nam
  assert.ok(st.gates.A3.open);
});
await t("pha 3 → 4 khi Thoát Hoan rút; pha 4 chiếm điện thì thắng", () => {
  const st = createB16(); toPhase(st, 4);
  const P = D.PALACE;
  let ev = run(st, 5, inp(P, { foes: [{ x: P.x, z: P.z }] }));
  assert.equal(st.palace.p, 0); assert.ok(!st.over);
  ev = run(st, P.capSec + 0.2, inp(P));
  assert.deepEqual(types(ev), ["win"]); assert.ok(st.over && st.won); assert.deepEqual(st.main, [true, true, true, true, true]);
  assert.deepEqual(tickB16(st, inp(P), 0.1), []);                                            // hết trận: không còn sự kiện
});
await t("quá 30 phút chưa mở cổng nam thì thua; đã mở thì không", () => {
  const st = createB16({ timeout: 100 });
  const ev = run(st, 101, inp({ x: 0, z: 0 }));
  assert.deepEqual(types(ev), ["lose"]); assert.ok(st.over && !st.won);
  const s2 = createB16({ timeout: 2000 }); toPhase(s2, 3); s2.timeout = s2.t + 1;
  run(s2, 5, inp({ x: 0, z: 0 }));
  assert.ok(!s2.over);
});
await t("nhiệm vụ phụ: đủ 3 làng trước khi chiếm bến (allVillagesBeforeLanding), không gục", () => {
  const st = createB16(); toPhase(st, 1); run(st, 31, inp(D.VILLAGES[2]));
  for (const B of D.BOATS) run(st, 2.6, inp(B));
  const ev = run(st, D.LANDING.capSec + 0.2, inp(D.LANDING));
  assert.equal(ev.find((e) => e.type === "landingTaken").allVillages, true); assert.ok(st.allVillagesBeforeLanding);
  assert.equal(st.ks.danBinh.state, "thanhcong");
  assert.deepEqual(sideB16(st), { S_VILLAGES: true, S_DISARM: false, S_DEPOTS: true });
});
await t("Kế Sách Đánh úp bến: báo động mở cửa sổ; đủ 9 thuyền trong cửa sổ thì thành công, cổng nam mất 30%", () => {
  const st = createB16({ ksWin: 0.75 }); toPhase(st, 1);
  assert.equal(st.ks.danhUp.state, "khadung");
  const ev = [];
  for (const B of D.BOATS.slice(0, 9)) ev.push(...run(st, 2.6, inp(B)));
  assert.equal(ev.filter((e) => e.type === "keSach").length, 1);
  assert.deepEqual(ev.find((e) => e.type === "keSach"), { type: "keSach", id: "danhUp", ok: true });
  assert.equal(st.ks.danhUp.state, "thanhcong"); assert.equal(st.ks.danhUp.window, D.KE_SACH.danhUp.window * 0.75);
  assert.equal(st.gates.B3.hp, st.gates.B3.hp0 * (1 - D.KE_SACH.danhUp.gateCut));
});
await t("Kế Sách Đánh úp bến: hết cửa sổ mà chưa đủ 9 thuyền thì hỏng, cổng giữ nguyên", () => {
  const st = createB16(); toPhase(st, 1);
  run(st, 2.6, inp(D.BOATS[0]));
  assert.equal(st.ks.danhUp.state, "sansang");
  const ev = run(st, D.KE_SACH.danhUp.window, inp({ x: 0, z: 0 }));
  assert.deepEqual(types(ev), ["torches", "keSach"]); assert.equal(st.ks.danhUp.state, "thatbai");
  assert.equal(st.gates.B3.hp, st.gates.B3.hp0);
});
await t("chụp / khôi phục giữ nguyên trạng thái, khôi phục rồi chạy tiếp ra đúng như chạy thẳng", () => {
  const a = createB16(); toPhase(a, 1);
  const snap = snapshotB16(a);
  for (const B of D.BOATS.slice(0, 5)) run(a, 2.6, inp(B));
  const after = snapshotB16(a);
  restoreB16(a, snap);
  assert.deepEqual(snapshotB16(a), snap);
  for (const B of D.BOATS.slice(0, 5)) run(a, 2.6, inp(B));
  assert.deepEqual(snapshotB16(a), after);
});
await t("xác định: cùng đầu vào → cùng sự kiện, cùng trạng thái", () => {
  const go = () => { const st = createB16({ S: 1.3 }); const ev = []; toPhase(st, 2); ev.push(...run(st, 60, inp({ x: 1, z: 1 }, { ramMoving: true }))); return { ev, s: snapshotB16(st) }; };
  assert.deepEqual(go(), go());
});
await t("along / routeLen: đầu, giữa, cuối đường xe húc", () => {
  const R = D.RAM.route, L = routeLen(R);
  assert.deepEqual([along(R, 0).x, along(R, 0).z], [R[0].x, R[0].z]);
  const e = along(R, L + 5); assert.ok(e.done); assert.deepEqual([e.x, e.z], [R.at(-1).x, R.at(-1).z]);
  assert.ok(!along(R, L / 2).done);
});

console.log("Nội dung Sử quán, Quiz B16");
await t("Quiz B16 qua lintQuiz; thẻ đủ nhóm, khóa mở hợp lệ; Kế Sách nào cũng có thẻ", async () => {
  const { CARDS, CARD_BY_ID, QUIZ_B16 } = await import("../js/data/suquan-b16.js");
  const { lintQuiz } = await import("../js/meta/chapter.js");
  const { CARD_GROUPS } = await import("../js/data/suquan-b15.js");
  assert.deepEqual(lintQuiz(QUIZ_B16, { panels: {}, cards: CARD_BY_ID }), []);
  assert.ok(CARDS.length >= 8 && QUIZ_B16.length >= 10);
  const groups = new Set(CARD_GROUPS.map((g) => g.id)), keys = new Set(["chapterOpen", "battleStart", "bossMet", "firstWin", "firstQuiz", ...D.KS_ORDER.map((k) => "keSach:" + k)]);
  for (const c of CARDS) { assert.ok(groups.has(c.group), c.id); assert.ok(keys.has(c.unlock), c.id + " " + c.unlock); assert.equal(c.chapter, "B16"); assert.ok(c.src.length); }
  for (const k of D.KS_ORDER) assert.ok(CARDS.some((c) => c.unlock === "keSach:" + k), k);
});
await t("canon B16.sensitivity: câu thơ có chữ 'Hồ' chỉ ở thẻ Sử quán (kèm dịch nghĩa), không ở chữ trong trận", async () => {
  const { readFileSync } = await import("node:fs");
  const { CARDS } = await import("../js/data/suquan-b16.js");
  const tho = CARDS.find((c) => c.id === "B16-tho");
  assert.ok(tho.body.some((b) => b.includes("Cầm Hồ")) && tho.body.some((b) => b.startsWith("Dịch nghĩa")));
  for (const f of ["js/data/battle-b16.js", "js/battle/director-b16.js", "js/battles/b16.js", "js/sim/b16.js", "js/data/comic-b16.js"])
    assert.ok(!/Cầm Hồ|擒胡/.test(readFileSync(new URL("../" + f, import.meta.url), "utf8")), f);
});

console.log(`\n${pass} đạt, ${fail} trượt`);
if (fail) process.exitCode = 1;
