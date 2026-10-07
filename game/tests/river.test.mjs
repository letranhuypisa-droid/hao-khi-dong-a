// tests/river.test.mjs — luật sông B20 (sim/river.js) và dữ liệu B20 (data/battle-b20.js).
//   node hao-khi-viet/game/tests/river.test.mjs
// Luật hiện hành (đợt 20): pha 1 là MỘT lệnh "Ra khiêu chiến" (đoàn thuyền nhẹ tự lái); pha 2–4 là cảnh tua tự chạy (hạm đội vào
// bãi cọc, nước rút, cọc nhô, thuyền Nguyên mắc cọc); người chơi chỉ làm việc ở pha 1 và pha 5–6 (boss).
import assert from "node:assert/strict";
import { createRiver, riverTick, setPhase, tidePct, tideAt, secondsTo, order, launch, provoke, strandShare, riverResult, snapshotRiver } from "../js/sim/river.js";
import * as B20 from "../js/data/battle-b20.js";
import * as GEO from "../js/data/river-b20.js";
import { createHaoKhi, gain, tick as hkTick } from "../js/sim/haokhi.js";

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log("  ok  " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + e.message); }
}
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ""} ${a} ≉ ${b} (±${tol})`);
const ticks = (st, n, ev = []) => { for (let i = 0; i < n; i++) riverTick(st, ev); return ev; };
const has = (ev, type, pred = () => true) => ev.some((e) => e.type === type && pred(e));
const hkSum = (ev) => ev.reduce((s, e) => s + (e.type === "hk" ? e.amount : 0), 0);
// Đưa sim tới đầu pha i nhanh, coi như mồi nhử thành công (nghiBinh) hay hỏng.
function at(i, { baited = true, ...opts } = {}) {
  const st = createRiver({ mode: "nhanh", ...opts });
  if (baited && i > 0) { st.ks.nghiBinh.state = "thanhcong"; st.ks.nghiBinh.got = 20; st.fleet.reachShare = B20.KE_SACH.nghiBinh.effect.reachShare; }
  for (let p = 1; p <= i; p++) setPhase(st, p);
  return st;
}
// Chạy pha 1 tới khi đổi pha (event khucCoc) hay hết maxS giây; ev nhận mọi sự kiện.
function runP1(st, ev = [], maxS = 400) {
  launch(st, ev);
  for (let s = 0; s < maxS; s++) { riverTick(st, ev); if (has(ev, "khucCoc")) break; }
  return ev;
}

console.log("Dữ liệu B20");
t("RIVER/TIDE/STAKES lấy từ river-b20.js (một nguồn)", () => {
  assert.equal(B20.RIVER.zc, GEO.zc); assert.equal(B20.RIVER.hw, GEO.hw);
  assert.deepEqual(B20.RIVER.reach, GEO.RIVER.reach); assert.equal(B20.RIVER.tribs, GEO.RIVER.tribs);
  assert.equal(B20.TIDE.low, GEO.TIDE.low); assert.equal(B20.TIDE.high, GEO.TIDE.high); assert.equal(B20.TIDE_Y, GEO.TIDE_Y);
  assert.deepEqual(B20.STAKES.map((s) => [s.id, s.x]), GEO.STAKE_FIELDS.map((s) => [s.id, s.x]));
  for (const s of B20.STAKES) near(s.z, GEO.zc(s.x), 1e-9);
});
t("MAP: khúc cọc 470, cửa sông 1180, bản doanh bờ bắc, bến/tháp hai bờ", () => {
  assert.equal(B20.MAP.khucCoc, 470); assert.equal(B20.MAP.exitX, 1180);
  assert.equal(B20.MAP.hq.x, 600); near(B20.MAP.hq.z, GEO.zc(600) - 125, 0.5);
  const [pn, ps] = B20.MAP.piers;
  assert.ok(pn.id === "P_N" && pn.x === 400 && pn.z < GEO.zc(400) - GEO.hw(400));
  assert.ok(ps.id === "P_S" && ps.x === 700 && ps.z > GEO.zc(700) + GEO.hw(700));
  assert.ok(B20.MAP.towers[0].z < 0 && B20.MAP.towers[1].z > 0);
});
t("PHASES 6 pha, tên theo canon; pha 2–4 là cảnh tua (auto), pha 1, 5, 6 là việc của người chơi; mỗi pha có mục tiêu và gợi ý", () => {
  assert.equal(B20.PHASES.length, 6);
  assert.deepEqual(B20.PHASES.map((p) => p.id), ["P1", "P2", "P3", "P4", "P5", "P6"]);
  assert.equal(B20.PHASES[0].name, "Dụ địch lúc triều lên"); assert.equal(B20.PHASES[5].name, "Bạch Đằng Quyết Chiến");
  assert.deepEqual(B20.PHASES.map((p) => !!p.auto), [false, true, true, true, false, false]);
  for (const p of B20.PHASES) assert.ok(p.goal && p.tip);
});
t("KE_SACH: 3 Kế Sách Lớn +20; cửa sổ Nghi binh Trận nhanh = ×0,75 canon; bãi cọc và Con nước tự xét (không cửa sổ)", () => {
  assert.deepEqual(B20.KS_ORDER, ["nghiBinh", "kichCoc", "conNuoc"]);
  for (const id of B20.KS_ORDER) { const k = B20.KE_SACH[id]; assert.equal(k.quyMo, "lon"); assert.equal(k.hk, 20); assert.ok(k.label); }
  const w = B20.KE_SACH.nghiBinh.window; assert.equal(w.chuan, 120); assert.equal(w.nhanh, w.chuan * 0.75);
  assert.equal(B20.KE_SACH.kichCoc.window, null); assert.equal(B20.KE_SACH.conNuoc.window, null);
});
t("BOSSES/ALLY/WINGS/HISTORY_NOTES đủ trường; không còn Thoát vây / hộ vệ / thuyền dò trong dữ liệu", () => {
  const X = B20.BOSSES;
  assert.equal(X.X20.defeatMeans, "bị bắt"); assert.equal(X.X20.hpLockPct, 10); assert.equal(X.X20.tier, "daituong");
  assert.equal(X.X24.defeatMeans, "bị bắt"); assert.equal(X.X24.chainAtPct, 50); assert.equal(X.X24.nameHan, "樊楫");
  assert.ok(X.X20.mechanics.length === 4 && X.X24.mechanics.length === 3);
  assert.ok(X.X24.mechanics.find((m) => m.name === "Trinh Sát Lòng Sông").todo, "Trinh Sát Lòng Sông không có trong bản thử");
  assert.equal(B20.ALLY_GENERALS.H40.weapon, "cung");
  for (const k of ["ESCAPE", "ESCORT_OPS", "SCOUT_OPS", "SQUADS", "EBB_OPS"]) assert.equal(B20[k], undefined, k);
  assert.deepEqual(Object.keys(B20.WINGS), ["flotilla", "chanh", "rut", "gia"]);
  const labels = new Set(B20.HISTORY_NOTES.map((n) => n.label));
  for (const l of ["Chính sử", "Tương truyền", "Hư cấu"]) assert.ok(labels.has(l), l);
  const all = JSON.stringify(B20.HISTORY_NOTES) + JSON.stringify(B20.BOSSES) + JSON.stringify(B20.PHASES);
  assert.ok(!/Sát Thát|bịt sắt vào|bè lửa|hỏa công/i.test(all.replace("không bịt sắt", "").replace("cọc bịt sắt là", "")), "nội dung nhạy cảm");
  assert.deepEqual(B20.STORY_INSERTS, {});
});

console.log("Pha 1: một lệnh Ra khiêu chiến");
t("chưa ra lệnh: hạm đội và đoàn thuyền nhẹ đứng yên, đồng hồ pha 1, Con nước và cửa sổ Kế Sách chưa chạy", () => {
  const st = createRiver({ mode: "nhanh" }); const w0 = st.ks.nghiBinh.left, h0 = st.fleet.headX, f0 = st.nghi.flotX;
  const ev = ticks(st, 60);
  assert.equal(st.fleet.headX, h0); assert.equal(st.nghi.flotX, f0); assert.equal(st.phaseT, 0); assert.equal(st.ks.nghiBinh.left, w0);
  near(st.tide, 85, 1e-9); assert.equal(st.ks.nghiBinh.state, "khadung"); assert.equal(st.nghi.launched, false);
  assert.ok(!has(ev, "khucCoc") && !has(ev, "baited"));
});
t("launch: một lần; sai pha thì từ chối; Mệnh Lệnh Tiến công / Giữ vững / Theo ta của đoàn thuyền nhẹ ở pha 1 đều là launch", () => {
  const st = createRiver({ mode: "nhanh" }), ev = [];
  assert.deepEqual(launch(st, ev), { ok: true }); assert.ok(has(ev, "launched")); assert.equal(st.nghi.launched, true);
  assert.deepEqual(launch(st, []), { ok: false, why: "done" });
  assert.deepEqual(launch(at(1), []), { ok: false, why: "phase" });
  for (const id of ["tiencong", "giuvung", "theota"]) { const s = createRiver({ mode: "nhanh" }); assert.deepEqual(order(s, "flotilla", id), { ok: true }); assert.ok(s.nghi.launched, id); }
});
t("sau lệnh: đoàn tự áp sát (tiencong) cho tới khi Khiêu khích đầy, rồi tự lui dụ (giuvung); không cần lệnh nào nữa", () => {
  const st = createRiver({ mode: "nhanh" }); launch(st);
  ticks(st, 1); assert.equal(st.nghi.stance, "tiencong");
  const seen = new Set();
  for (let s = 0; s < 80 && st.ks.nghiBinh.state === "khadung"; s++) { riverTick(st); seen.add(st.nghi.stance); }
  assert.equal(st.ks.nghiBinh.state, "sansang"); assert.equal(st.nghi.kk, 100); assert.deepEqual([...seen], ["tiencong"]);
  ticks(st, 1); assert.equal(st.nghi.stance, "giuvung");
});
t("không làm gì ngoài một lệnh: Nghi binh thành công trong cửa sổ Trận nhanh (90 s), đoàn thuyền ở trong dải 15–40 m khi qua Khúc cọc, không mất thuyền", () => {
  const st = createRiver({ mode: "nhanh" }), ev = runP1(st);
  assert.ok(has(ev, "khucCoc"), "hạm đội qua Khúc cọc"); assert.equal(st.ks.nghiBinh.state, "thanhcong"); assert.ok(st.t <= 90, `xong ở ${st.t} s`);
  assert.ok(st.nghi.gap >= 15 && st.nghi.gap <= 40, `gap ${st.nghi.gap}`);
  assert.equal(st.fleet.reachShare, 0.8); assert.equal(st.wings.flotilla.boats, 8);
  assert.ok(!has(ev, "boatLost"));
});
t("Trận chuẩn và Tiết Chế +15% cũng đủ cửa sổ; Phụ Tử +20 Sĩ Khí không ảnh hưởng", () => {
  for (const o of [{ mode: "chuan" }, { mode: "nhanh", mods: { ksWindow: 0.15 } }, { mode: "nhanh", mods: { wingSk: 20 } }]) {
    const st = createRiver(o); runP1(st); assert.equal(st.ks.nghiBinh.state, "thanhcong", JSON.stringify(o));
  }
});
t("Con nước pha 1: 85 → 100 theo cửa sổ kể từ lúc ra lệnh; nội suy giữa hai tick", () => {
  const st = createRiver({ mode: "nhanh" }); launch(st);
  ticks(st, 45); near(st.tide, 92.5, 1e-9);
  const a = st.tide, r = 15 / 90;
  near(tideAt(st, 0.25), a + r * 0.25, 1e-9); near(tideAt(st, 0.25), a + r * 0.5, 1e-9);
  riverTick(st); near(tidePct(st), a + r, 1e-9); assert.equal(st.tideT, 0);
});
t("Khiêu khích: +2 mỗi KO, +15 mỗi sĩ quan; đầy 100 → Sẵn sàng + thưởng lẻ 5", () => {
  const st = createRiver({ mode: "nhanh" }); const ev = [];
  provoke(st, "ko", 3, ev); assert.equal(st.nghi.kk, 6);
  provoke(st, "officer", 1, ev); assert.equal(st.nghi.kk, 21);
  const r = provoke(st, "officer", 6, ev); assert.equal(st.nghi.kk, 100); assert.equal(r.hk, 5);
  assert.equal(st.ks.nghiBinh.state, "sansang"); assert.ok(has(ev, "baited"));
});
t("lính tiên phong bị hạ làm Khiêu khích đầy sớm hơn: đoàn chuyển sang lui dụ sớm hơn (hạm đội không đuổi nhanh hơn vì tốc đã trần)", () => {
  const when = (kos) => { const st = createRiver({ mode: "nhanh" }); launch(st);
    for (let s = 0; s < 200; s++) { if (kos && s % 2 === 0) provoke(st, "ko", kos); riverTick(st); if (st.nghi.stance === "giuvung") return st.t; } return Infinity; };
  const a = when(0), b = when(3); assert.ok(b < a, `${b} < ${a}`); assert.ok(a <= 30, `tự khiêu chiến xong sau ${a} s`);
});

console.log("Pha 2–4: cảnh tua");
t("P2: hạm đội vào bãi cọc tới FLEET.stopX rồi neo, báo fleetIn một lần; nước đứng ở đỉnh", () => {
  const st = at(1); st.fleet.headX = B20.MAP.khucCoc; const ev = [];
  const tide0 = st.tide; ticks(st, 80, ev);
  assert.equal(st.fleet.headX, B20.FLEET.stopX); assert.equal(st.fleet.speed, 0);
  assert.equal(ev.filter((e) => e.type === "fleetIn").length, 1); near(st.tide, tide0, 1e-9);
  const need = Math.ceil((B20.FLEET.stopX - B20.MAP.khucCoc) / B20.FLEET.tuaSpeed); assert.ok(need <= 60, `cần ${need} giây mô phỏng`);
});
t("P3: bãi cọc tự xét ngay — thành công khi Nghi binh thành công (+20 Hào Khí), thất bại khi không (0)", () => {
  const ok = at(1), ev = []; setPhase(ok, 2, ev);
  assert.equal(ok.ks.kichCoc.state, "thanhcong"); assert.ok(has(ev, "ksResult", (e) => e.id === "kichCoc" && e.ok)); assert.equal(hkSum(ev), 20);
  const bad = at(1, { baited: false }), ev2 = []; setPhase(bad, 2, ev2);
  assert.equal(bad.ks.kichCoc.state, "thatbai"); assert.equal(hkSum(ev2), 0); assert.match(bad.ks.kichCoc.why, /một nửa/);
});
t("P3: nước về 50% trong TIDE.tua.p3Sec rồi phát tide50 một lần", () => {
  const st = at(2), S = B20.TIDE.tua.p3Sec; st.tide = 100; st.tide0 = 100; st.phaseT = 0; riverTick(st); // tide0 đỉnh
  const ev = ticks(st, S - 2); assert.ok(!has(ev, "tide50")); assert.ok(st.tide > 50);
  const ev2 = ticks(st, 2); assert.equal(ev2.filter((e) => e.type === "tide50").length, 1); near(st.tide, 50, 1e-9);
  assert.ok(!has(ticks(st, 5), "tide50"));
});
t("P4: nước 50 → 0 trong TIDE.tua.p4Sec; cọc nhô (strandAt) ở 30% đúng giây; nước ròng (tideZero) cuối pha", () => {
  const st = at(3), S = B20.TIDE.tua.p4Sec; near(st.tide, 50, 1e-9); const when = {};
  for (let s = 1; s <= S + 5; s++) { const e = []; riverTick(st, e); for (const x of e) when[x.type] ??= s; }
  assert.equal(when.strandAt, S * 20 / 50, "strandAt"); assert.equal(when.tideZero, S, "tideZero"); near(st.tide, 0, 1e-9);
});
t("P4: Con nước tự xét lúc nước ròng — thành công nếu bãi cọc thành công (+20), không thì thất bại", () => {
  const st = at(3), ev = []; assert.equal(st.ks.conNuoc.state, "khadung"); ticks(st, B20.TIDE.tua.p4Sec, ev);
  assert.equal(st.ks.conNuoc.state, "thanhcong"); assert.equal(hkSum(ev), 20); assert.equal(strandShare(st), 1);
  const bad = at(3, { baited: false }); ticks(bad, B20.TIDE.tua.p4Sec);
  assert.equal(bad.ks.conNuoc.state, "thatbai"); assert.equal(strandShare(bad), 0.5);
});
t("P5–P6: nước ròng 0; vào P5 cánh thuyền phục xuất kích; vào P6 phát đặt Hào Khí = 100 và khóa", () => {
  const st = at(4); near(st.tide, 0, 1e-9); ticks(st, 5); near(st.tide, 0, 1e-9);
  assert.ok(st.wings.gia.sortie);
  const ev = []; setPhase(st, 5, ev);
  assert.ok(has(ev, "hkSet", (e) => e.value === 100 && e.lock));
});
t("nhảy pha (debug ?phase=N): bỏ qua P2–P4 vẫn tự xét hai Kế Sách tự động", () => {
  const st = at(0); st.ks.nghiBinh.state = "thanhcong"; const ev = []; setPhase(st, 4, ev);
  assert.equal(st.ks.kichCoc.state, "thanhcong"); assert.equal(st.ks.conNuoc.state, "thanhcong");
});

console.log("Cánh thủy quân, Mệnh Lệnh");
t("Mệnh Lệnh B20: thuyền phục không xuất kích trước pha 5; tiếp viện 2 lượt, tới sau 20 s; Giữ vững không còn việc", () => {
  const st = at(3);
  assert.deepEqual(order(st, "gia", "tiencong"), { ok: false, why: "phuc" });
  assert.equal(order(st, "rut", "giuvung").why, "nouse");
  const r = order(st, "chanh", "tiepvien"); assert.ok(r.ok);
  assert.equal(order(st, "rut", "tiepvien").why, "cd");
  ticks(st, 19); assert.equal(st.wings.chanh.q, 60); ticks(st, 1); assert.equal(st.wings.chanh.q, 80);
  const s5 = at(4); assert.ok(s5.wings.gia.sortie); assert.ok(order(s5, "gia", "tiencong").ok);
  assert.ok(order(s5, "flotilla", "theota").ferry);
});
t("đò chuyển (Theo ta) chưa dùng được ở pha 1 sau khi đã ra lệnh khiêu chiến", () => {
  const st = createRiver({ mode: "nhanh" }); launch(st);
  assert.deepEqual(order(st, "flotilla", "theota"), { ok: false, why: "done" });
});
t("Phụ Tử Chi Binh: cánh mở màn +20 Sĩ Khí, trôi dần về 50", () => {
  const st = createRiver({ mode: "nhanh", mods: { wingSk: 20 } });
  assert.equal(st.wings.chanh.sk, 70); ticks(st, 100); assert.equal(st.wings.chanh.sk, 60);
});

// ---- Chạy kịch bản trọn 6 pha: director giả lập ------------------------------------------------------
// Một lệnh ở đầu pha 1; director chuyển pha theo sự kiện gợi ý. Hào Khí qua haokhi.js.
function runScript({ mode = "nhanh", p5 = 60, p6 = 45, lead = 0, kos = 0 } = {}) {
  const st = createRiver({ mode, mods: { ksWindow: 0, wingSk: 20 }, quyetSachOk: true });
  const hk = createHaoKhi({ quick: mode === "nhanh", start: 30 });
  const log = { phaseAt: [0], events: [], tideZeroAt: null };
  const apply = (ev) => {
    for (const e of ev) {
      log.events.push(e.type);
      if (e.type === "hk") gain(hk, e.amount, e.source, { optional: false });
      if (e.type === "hkSet") hk.value = e.value;
      if (e.type === "tideZero") log.tideZeroAt = st.t;
    }
  };
  for (let s = 0; s < 1500; s++) {
    const ev = [];
    if (s === lead) launch(st, ev);
    if (kos && st.phase === 0 && st.nghi.launched && s % 4 === 0 && st.nghi.kk < 100) provoke(st, "ko", kos, ev);
    riverTick(st, ev);
    apply(ev);
    hkTick(hk, 1);
    const next = [];
    if (st.phase === 0 && ev.some((e) => e.type === "khucCoc")) setPhase(st, 1, next);
    else if (st.phase === 1 && ev.some((e) => e.type === "fleetIn")) setPhase(st, 2, next);
    else if (st.phase === 2 && ev.some((e) => e.type === "tide50")) setPhase(st, 3, next);
    else if (st.phase === 3 && ev.some((e) => e.type === "tideZero")) setPhase(st, 4, next);
    else if (st.phase === 4 && st.phaseT >= p5) setPhase(st, 5, next);
    else if (st.phase === 5 && st.phaseT >= p6) break;
    if (next.length) { log.phaseAt[st.phase] = st.t; apply(next); }
  }
  return { st, hk, log, res: riverResult(st) };
}

console.log("Kịch bản trọn trận (Trận nhanh)");
const P = runScript({ kos: 1 }), Q = runScript();
t("một lệnh ngay đầu trận: cả 3 Kế Sách thành công (Hào Khí gốc +20 ×3), mắc cạn 100%, tới pha 6", () => {
  const r = P.res;
  assert.equal(r.keSachOk, 3, JSON.stringify(r.keSach)); assert.equal(r.strandShare, 1); assert.equal(r.reachShare, 0.8); assert.ok(r.kRank);
  assert.equal(P.st.phase, 5);
  for (const k of ["Nghi binh lúc triều lên", "Kích hoạt bãi cọc", "Con nước"]) near(P.hk.log["kế sách:" + k], 20, 0, k);
});
t("không KO nào: vẫn thành công (đoàn tự lái), Hào Khí tới pha 5 ≥ 30 + 60 gốc (×1,3)", () => {
  assert.equal(Q.res.keSachOk, 3); assert.ok(Q.hk.value >= 100 - 1e-9 || Q.hk.value >= 90, `HK ${Q.hk.value}`);
});
t("cảnh tua P2–P4 ≈ 28 s thật (tốc độ tua TUA.rate): tổng giây mô phỏng / rate trong 20–40 s", () => {
  const sim = P.log.phaseAt[4] - P.log.phaseAt[1], real = sim / B20.TUA.rate;
  assert.ok(real >= 20 && real <= 40, `tua ${sim} s mô phỏng = ${real.toFixed(1)} s thật`);
});
t("pha 1 xong trước hết cửa sổ 90 s (kể từ lệnh)", () => assert.ok(Q.log.phaseAt[1] <= 90, `P2 bắt đầu ở ${Q.log.phaseAt[1]} s`));
t("chậm ra lệnh 40 s: đồng hồ pha 1 chưa chạy trong lúc chờ nên vẫn thành công; hạm đội không nhúc nhích", () => {
  const S = runScript({ lead: 40 });
  assert.equal(S.res.keSach.nghiBinh.state, "thanhcong"); assert.equal(S.res.keSachOk, 3);
  assert.equal(S.log.phaseAt[1], Q.log.phaseAt[1] + 40);
});
t("tất định: cùng kịch bản → cùng JSON; checkpoint giữa trận chạy tiếp giống hệt", () => {
  const a = runScript({ kos: 1 }), b = runScript({ kos: 1 });
  assert.equal(JSON.stringify(a.st), JSON.stringify(b.st));
  assert.equal(JSON.stringify(a.log.events), JSON.stringify(b.log.events));
  const s1 = createRiver({ mode: "nhanh" }); launch(s1); ticks(s1, 30);
  const s2 = snapshotRiver(s1);
  const e1 = ticks(s1, 50), e2 = ticks(s2, 50);
  assert.equal(JSON.stringify(s1), JSON.stringify(s2)); assert.equal(JSON.stringify(e1), JSON.stringify(e2));
});
t("riverResult: không còn trường của cơ chế đã bỏ (mốc cọc, hộ vệ, Thoát vây, thuyền nhẹ mất)", () => {
  const r = P.res;
  for (const k of ["markers", "markersActive", "escorts", "escape", "escapeFull", "flotillaLost"]) assert.equal(r[k], undefined, k);
  assert.equal(typeof r.hkRaw, "number"); assert.equal(r.intel, true);
});

console.log(`\n${pass} đạt, ${fail} trượt`);
console.log(`  (một lệnh: P2 ở ${Q.log.phaseAt[1]} s, P3 ${Q.log.phaseAt[2]}, P4 ${Q.log.phaseAt[3]}, P5 ${Q.log.phaseAt[4]} s mô phỏng; HK tới P5+ ${Q.hk.value.toFixed(1)})`);
if (fail) process.exit(1);
