// tests/river.test.mjs — luật sông B20 (sim/river.js) và dữ liệu B20 (data/battle-b20.js).
//   node hao-khi-viet/game/tests/river.test.mjs
import assert from "node:assert/strict";
import * as RV from "../js/sim/river.js";
import { createRiver, riverTick, setPhase, tidePct, tideAt, onEscortDown, markerAction, setMarkerOfficer, order,
         strandShare, riverResult, keSachTrigger, provoke, flotillaLoss, snapshotRiver } from "../js/sim/river.js";
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
// Đưa sim tới đầu pha i nhanh (không quan tâm Kế Sách).
function at(i, opts = {}) {
  const st = createRiver({ mode: "nhanh", ...opts });
  for (let p = 1; p <= i; p++) setPhase(st, p);
  return st;
}

console.log("Dữ liệu B20");
t("RIVER/TIDE/STAKES lấy từ river-b20.js (một nguồn)", () => {
  assert.equal(B20.RIVER.zc, GEO.zc); assert.equal(B20.RIVER.hw, GEO.hw);
  assert.deepEqual(B20.RIVER.reach, GEO.RIVER.reach); assert.equal(B20.RIVER.tribs, GEO.RIVER.tribs);
  assert.equal(B20.TIDE.low, GEO.TIDE.low); assert.equal(B20.TIDE.high, GEO.TIDE.high); assert.equal(B20.TIDE_Y, GEO.TIDE_Y);
  assert.deepEqual(B20.STAKES.map((s) => [s.id, s.x]), GEO.STAKE_FIELDS.map((s) => [s.id, s.x]));
  for (const s of B20.STAKES) { near(s.z, GEO.zc(s.x), 1e-9); assert.equal(s.interact, 5); assert.equal(s.exposeSec, 10); }
});
t("MAP: khúc cọc 470, cửa sông 1180, bản doanh bờ bắc, bến/tháp hai bờ", () => {
  assert.equal(B20.MAP.khucCoc, 470); assert.equal(B20.MAP.exitX, 1180);
  assert.equal(B20.MAP.hq.x, 600); near(B20.MAP.hq.z, GEO.zc(600) - 125, 0.5);
  const [pn, ps] = B20.MAP.piers;
  assert.ok(pn.id === "P_N" && pn.x === 400 && pn.z < GEO.zc(400) - GEO.hw(400));
  assert.ok(ps.id === "P_S" && ps.x === 700 && ps.z > GEO.zc(700) + GEO.hw(700));
  assert.ok(B20.MAP.towers[0].z < 0 && B20.MAP.towers[1].z > 0);
});
t("PHASES 6 pha, tên theo canon, par Trận nhanh ≈ 13 phút", () => {
  assert.equal(B20.PHASES.length, 6);
  assert.deepEqual(B20.PHASES.map((p) => p.id), ["P1", "P2", "P3", "P4", "P5", "P6"]);
  assert.equal(B20.PHASES[0].name, "Dụ địch lúc triều lên"); assert.equal(B20.PHASES[5].name, "Bạch Đằng Quyết Chiến");
  near(B20.PHASES.reduce((s, p) => s + p.par, 0), 13, 0.5, "par");
  for (const p of B20.PHASES) assert.ok(p.goal && p.tip);
});
t("KE_SACH: 3 Kế Sách Lớn, +20, cửa sổ Trận nhanh = ×0,75", () => {
  assert.deepEqual(B20.KS_ORDER, ["nghiBinh", "kichCoc", "conNuoc"]);
  for (const id of B20.KS_ORDER) { const k = B20.KE_SACH[id]; assert.equal(k.quyMo, "lon"); assert.equal(k.hk, 20); assert.ok(k.label); }
  for (const id of ["nghiBinh", "kichCoc"]) { const w = B20.KE_SACH[id].window; assert.equal(w.chuan, 120); assert.equal(w.nhanh, w.chuan * 0.75); }
  assert.equal(B20.TIDE.p4Sec.nhanh, B20.TIDE.p4Sec.chuan * 0.75);
});
t("BOSSES/ALLY/ESCAPE/WINGS/HISTORY_NOTES đủ trường", () => {
  const X = B20.BOSSES;
  assert.equal(X.X20.defeatMeans, "bị bắt"); assert.equal(X.X20.hpLockPct, 10); assert.equal(X.X20.tier, "daituong");
  assert.equal(X.X24.defeatMeans, "bị bắt"); assert.equal(X.X24.chainAtPct, 50); assert.equal(X.X24.nameHan, "樊楫");
  assert.ok(X.X20.mechanics.length === 4 && X.X24.mechanics.length === 3);
  assert.equal(B20.ALLY_GENERALS.H40.weapon, "cung");
  assert.deepEqual(B20.ESCAPE, { perCmdShip: 0.5, perEscortDown: 15, max: 100, holdMult: 0.7, holdSec: 25 });
  assert.deepEqual(Object.keys(B20.WINGS), ["flotilla", "chanh", "rut", "gia"]);
  const labels = new Set(B20.HISTORY_NOTES.map((n) => n.label));
  for (const l of ["Chính sử", "Tương truyền", "Hư cấu"]) assert.ok(labels.has(l), l);
  const all = JSON.stringify(B20.HISTORY_NOTES) + JSON.stringify(B20.BOSSES) + JSON.stringify(B20.PHASES);
  assert.ok(!/Sát Thát|bịt sắt vào|bè lửa|hỏa công/i.test(all.replace("không bịt sắt", "").replace("cọc bịt sắt là", "")), "nội dung nhạy cảm");
  assert.deepEqual(B20.STORY_INSERTS, {});
});

console.log("Con nước theo pha và chế độ");
t("P1: 85 → 100 trong cửa sổ (nhanh 90 s, chuẩn 120 s), đứng ở đỉnh", () => {
  for (const [mode, W] of [["nhanh", 90], ["chuan", 120]]) {
    const st = createRiver({ mode });
    near(tidePct(st), 85, 1e-9, mode);
    ticks(st, W / 2); near(st.tide, 92.5, 1e-9, mode + " giữa");
    ticks(st, W / 2); near(st.tide, 100, 1e-9, mode + " đỉnh");
    ticks(st, 10); near(st.tide, 100, 1e-9, mode + " giữ đỉnh");
  }
});
t("P1: cửa sổ dài hơn (Tiết Chế +15%) → nước lên chậm hơn, vẫn tới 100 cuối cửa sổ", () => {
  const st = createRiver({ mode: "nhanh", mods: { ksWindow: 0.15 } });
  const W = Math.round(90 * 1.15); assert.ok(W === 103 || W === 104); assert.equal(st.ks.nghiBinh.window, W);
  ticks(st, W - 1); assert.ok(st.tide < 100); ticks(st, 1); near(st.tide, 100, 1e-9);
});
t("P2: rút về sàn 55 trong 180 s (nhanh) / 240 s (chuẩn), rồi giữ", () => {
  for (const [mode, S, rate] of [["nhanh", 180, 0.25], ["chuan", 240, 0.1875]]) {
    const st = createRiver({ mode }); ticks(st, mode === "nhanh" ? 90 : 120); setPhase(st, 1);
    near(st.tide, 100, 1e-9); riverTick(st); near(st.tide, 100 - rate, 1e-9, mode);
    ticks(st, S - 1); near(st.tide, 55, 1e-9, mode + " sàn");
    ticks(st, 30); near(st.tide, 55, 1e-9, mode + " giữ sàn");
  }
});
t("P3: giữ mức vào pha; Kế Sách cọc chốt → 10 s về 50, phát tide50", () => {
  const st = createRiver({ mode: "nhanh" }); ticks(st, 90); setPhase(st, 1); ticks(st, 100); setPhase(st, 2);
  near(st.tide, 75, 1e-9); ticks(st, 20); near(st.tide, 75, 1e-9, "giữ");
  markerAction(st, "M1", "activate"); markerAction(st, "M2", "activate");
  const r = keSachTrigger(st, "kichCoc"); assert.ok(r.ok);
  const ev = ticks(st, 9); assert.ok(!has(ev, "tide50")); near(st.tide, 52.5, 1e-9);
  const ev2 = ticks(st, 1); assert.ok(has(ev2, "tide50")); near(st.tide, 50, 1e-9);
});
t("P4: 50 → 0 trong 135 s (nhanh) / 180 s (chuẩn); 30% ở 54 / 72 s; báo trước 30 s", () => {
  for (const [mode, S] of [["nhanh", 135], ["chuan", 180]]) {
    const st = createRiver({ mode }); setPhase(st, 1); setPhase(st, 2); setPhase(st, 3);
    near(st.tide, 50, 1e-9); const ev = [];
    const when = {};
    for (let s = 1; s <= S + 5; s++) { const e = []; riverTick(st, e); for (const x of e) when[x.type + (x.at ? ":" + x.at : "")] ??= s; ev.push(...e); }
    const t30 = S * 20 / 50;
    assert.equal(when.strandAt, t30, mode + " strandAt");
    assert.equal(when["tideWarn:strand"], t30 - 30, mode + " báo cọc nhô");
    assert.equal(when["tideWarn:ebb"], S - 30, mode + " báo nước ròng");
    assert.equal(when.tideZero, S, mode + " nước ròng");
    near(st.tide, 0, 1e-9);
  }
});
t("P5–P6: nước ròng 0; vào P6 phát đặt Hào Khí = 100 và khóa", () => {
  const st = at(4); near(st.tide, 0, 1e-9); ticks(st, 5); near(st.tide, 0, 1e-9);
  const ev = []; setPhase(st, 5, ev);
  assert.ok(has(ev, "hkSet", (e) => e.value === 100 && e.lock));
});
t("tideAt nội suy liên tục giữa hai tick, reset khi tick", () => {
  const st = createRiver({ mode: "nhanh" }); ticks(st, 10);
  const a = st.tide; const r = 15 / 90;
  near(tideAt(st, 0.25), a + r * 0.25, 1e-9); near(tideAt(st, 0.25), a + r * 0.5, 1e-9);
  riverTick(st); near(tidePct(st), a + r, 1e-9); assert.equal(st.tideT, 0);
});

console.log("Thoát vây");
t("+0,5/s mỗi thuyền chỉ huy (2 → +1/s); −15 mỗi hộ vệ bị hạ, sàn 0", () => {
  const st = at(3);
  ticks(st, 10); near(st.escape.value, 10, 1e-9);
  const r = onEscortDown(st, "sink"); assert.ok(r.ok); near(st.escape.value, 0, 1e-9, "sàn 0");
  assert.equal(r.hk, 3);
  ticks(st, 20); onEscortDown(st, "capture"); near(st.escape.value, 5, 1e-9);
  setCmd(st, 1); ticks(st, 10); near(st.escape.value, 10, 1e-9, "1 thuyền chỉ huy");
});
function setCmd(st, n) { RV.setCmdShips(st, n); }
t("Giữ vững ở cửa nhánh sông: ×0,7 trong 25 s", () => {
  const st = at(3);
  const r = order(st, "rut", "giuvung"); assert.ok(r.ok);
  ticks(st, 25); near(st.escape.value, 25 * 0.7, 1e-9);
  ticks(st, 5); near(st.escape.value, 25 * 0.7 + 5, 1e-9, "hết Giữ vững");
});
t("Trận nhanh: không làm gì thì đầy ở giây 100 → Con nước hỏng (không thua trận); 3 hộ vệ là đủ giữ", () => {
  const st = at(3); const ev = [];
  for (let s = 1; s <= 100; s++) riverTick(st, ev);
  assert.ok(st.escape.full && has(ev, "escapeFull")); assert.equal(st.ks.conNuoc.state, "thatbai");
  onEscortDown(st, "sink"); near(st.escape.value, 100, 1e-9, "đầy rồi thì không tụt");
  const st2 = at(3);
  for (let s = 1; s <= 135; s++) { if (s === 40 || s === 80 || s === 120) onEscortDown(st2, "capture"); riverTick(st2); }
  assert.ok(!st2.escape.full); near(st2.escape.value, 90, 1e-9);
});

console.log("Mốc cọc");
t("tướng địch đứng ở mốc 10 s chưa lộ; giây thứ 11 thì lộ", () => {
  const st = at(2); setMarkerOfficer(st, "M2", true);
  const ev = ticks(st, 10); assert.equal(st.markers.M2.state, "hidden"); assert.ok(!has(ev, "markerExposed"));
  const ev2 = ticks(st, 1); assert.equal(st.markers.M2.state, "exposed"); assert.ok(has(ev2, "markerExposed", (e) => e.id === "M2" && e.by === "officer"));
});
t("tướng rời mốc thì đếm lại từ 0", () => {
  const st = at(2); setMarkerOfficer(st, "M1", true); ticks(st, 9);
  setMarkerOfficer(st, "M1", false); ticks(st, 1); assert.equal(st.markers.M1.officerOnT, 0);
  setMarkerOfficer(st, "M1", true); ticks(st, 10); assert.equal(st.markers.M1.state, "hidden");
});
t("kích hoạt chỉ ở pha 3; mốc lộ không kích hoạt được; thuyền dò làm lộ ở pha 2", () => {
  const st = at(1);
  assert.equal(markerAction(st, "M1", "activate").ok, false);
  assert.ok(markerAction(st, "M3", "expose").ok); assert.equal(st.markers.M3.state, "exposed");
  setPhase(st, 2);
  const r = markerAction(st, "M3", "activate"); assert.equal(r.ok, false); assert.equal(r.why, "exposed");
  assert.ok(markerAction(st, "M1", "activate").ok);
});
t("2 mốc → Sẵn sàng; Lệnh Kế Sách → Thành công, tổng thưởng đúng khung 20", () => {
  const st = at(2); const ev = [];
  assert.equal(markerAction(st, "M1", "activate", ev).hk, 5);
  assert.equal(st.ks.kichCoc.state, "khadung");
  markerAction(st, "M2", "activate", ev); assert.equal(st.ks.kichCoc.state, "sansang"); assert.ok(has(ev, "ksReady"));
  const r = keSachTrigger(st, "kichCoc", ev); assert.ok(r.ok); assert.equal(r.hk, 10);
  assert.equal(st.ks.kichCoc.state, "thanhcong"); assert.equal(hkSum(ev), 20); assert.equal(st.ks.kichCoc.got, 20);
});
t("Kế Sách cọc đã chốt: mốc còn ẩn thôi bị lộ (tướng địch đứng mốc, thuyền dò) trong 10 s nước rút", () => {
  const st = createRiver({ mode: "nhanh" }); const ev = [];
  setPhase(st, 1, ev); setPhase(st, 2, ev);
  markerAction(st, "M1", "activate", ev); markerAction(st, "M2", "activate", ev);
  assert.equal(keSachTrigger(st, "kichCoc", ev).ok, true); assert.equal(st.ks.kichCoc.state, "thanhcong");
  setMarkerOfficer(st, "M3", true);
  for (let s = 0; s < 12; s++) riverTick(st, ev);
  assert.equal(st.markers.M3.state, "hidden");
  assert.equal(markerAction(st, "M3", "expose", ev).ok, false);
  assert.equal(st.markers.M3.state, "hidden");
});
t("3/3 mốc tự chốt; lộ hết cả 3 → thất bại, không thêm Hào Khí", () => {
  const st = at(2); const ev = [];
  for (const id of ["M1", "M2", "M3"]) markerAction(st, id, "activate", ev);
  assert.equal(st.ks.kichCoc.state, "thanhcong"); assert.equal(hkSum(ev), 20);
  const s2 = at(1); for (const id of ["M1", "M2", "M3"]) markerAction(s2, id, "expose");
  const e2 = []; setPhase(s2, 2, e2); assert.equal(s2.ks.kichCoc.state, "thatbai"); assert.equal(hkSum(e2), 0);
});
t("hết cửa sổ 90 s với 1 mốc → thất bại, giữ thưởng lẻ 5", () => {
  const st = at(2); const ev = [];
  markerAction(st, "M2", "activate", ev); ticks(st, 89, ev); assert.equal(st.ks.kichCoc.state, "khadung");
  ticks(st, 1, ev); assert.equal(st.ks.kichCoc.state, "thatbai"); assert.equal(st.ks.kichCoc.got, 5); assert.equal(hkSum(ev), 5);
});

console.log("Nghi binh, cánh thủy quân, mắc cạn");
t("đứng yên: hạm đội áp sát < 15 m, cứ 4 s mất 1 thuyền; mất 3 → Nghi binh hỏng", () => {
  const st = createRiver({ mode: "nhanh" }); const ev = [];
  for (let s = 0; s < 90 && st.ks.nghiBinh.state === "khadung"; s++) riverTick(st, ev);
  assert.equal(st.ks.nghiBinh.state, "thatbai"); assert.equal(st.nghi.lost, 3);
  assert.ok(has(ev, "boatLost")); assert.equal(st.wings.flotilla.boats, 5);
  flotillaLoss(st, 1); assert.equal(st.nghi.lost, 4);
});
t("Khiêu khích: +2 mỗi KO, +15 mỗi sĩ quan; đầy 100 → Sẵn sàng + thưởng lẻ 5", () => {
  const st = createRiver({ mode: "nhanh" }); const ev = [];
  provoke(st, "ko", 3, ev); assert.equal(st.nghi.kk, 6);
  provoke(st, "officer", 1, ev); assert.equal(st.nghi.kk, 21);
  const r = provoke(st, "officer", 6, ev); assert.equal(st.nghi.kk, 100); assert.equal(r.hk, 5);
  assert.equal(st.ks.nghiBinh.state, "sansang"); assert.ok(has(ev, "baited"));
});
t("Mệnh Lệnh B20: thuyền phục không xuất kích trước pha 5; tiếp viện 2 lượt, tới sau 20 s", () => {
  const st = at(3);
  assert.deepEqual(order(st, "gia", "tiencong"), { ok: false, why: "phuc" });
  const r = order(st, "chanh", "tiepvien"); assert.ok(r.ok);
  assert.equal(order(st, "rut", "tiepvien").why, "cd");
  ticks(st, 19); assert.equal(st.wings.chanh.q, 60); ticks(st, 1); assert.equal(st.wings.chanh.q, 80);
  const s5 = at(4); assert.ok(s5.wings.gia.sortie); assert.ok(order(s5, "gia", "tiencong").ok);
  assert.ok(order(s5, "flotilla", "theota").ferry);
});
t("Phụ Tử Chi Binh: cánh mở màn +20 Sĩ Khí, trôi dần về 50", () => {
  const st = createRiver({ mode: "nhanh", mods: { wingSk: 20 } });
  assert.equal(st.wings.chanh.sk, 70); ticks(st, 100); assert.equal(st.wings.chanh.sk, 60);
});
t("strandShare: cọc VÀ Con nước thành công → 1; hỏng một → 0,5", () => {
  const st = at(2); for (const id of ["M1", "M2"]) markerAction(st, id, "activate"); keSachTrigger(st, "kichCoc");
  setPhase(st, 3); for (let s = 0; s < 135; s++) { if (s % 30 === 0) onEscortDown(st, "sink"); riverTick(st); }
  assert.equal(st.ks.conNuoc.state, "thanhcong"); assert.equal(strandShare(st), 1);
  const s2 = at(3); ticks(s2, 135); assert.equal(strandShare(s2), 0.5);
  const s3 = at(2); markerAction(s3, "M1", "activate"); setPhase(s3, 3); for (let s = 0; s < 135; s++) { if (s % 30 === 0) onEscortDown(s3, "sink"); riverTick(s3); }
  assert.equal(s3.escape.full, false); assert.equal(s3.ks.conNuoc.state, "thatbai", "chỉ 1 mốc giữ 1/3 hạm đội");
  assert.equal(strandShare(s3), 0.5);
});

// ---- Chạy kịch bản trọn 6 pha: director giả lập ------------------------------------------------------
// policy(st, ctx) gọi mỗi giây TRƯỚC riverTick; director chuyển pha theo sự kiện gợi ý. Hào Khí qua haokhi.js.
function runScript(policy, { mode = "nhanh", p5 = 60, p6 = 45 } = {}) {
  const st = createRiver({ mode, mods: { ksWindow: 0, wingSk: 20 }, quyetSachOk: true });
  const hk = createHaoKhi({ quick: mode === "nhanh", start: 30 });
  const log = { hkAtP3End: null, phaseAt: [0], windowsEnd: null, events: [] };
  const apply = (ev) => {
    for (const e of ev) {
      log.events.push(e.type);
      if (e.type === "hk") gain(hk, e.amount, e.source, { optional: false });
      if (e.type === "hkSet") { hk.value = e.value; }
      if (e.type === "tide50") log.hkAtP3End = hk.value;
      if (e.type === "tideZero") log.windowsEnd = st.t;
    }
  };
  const ctx = { gainCaptain: () => gain(hk, 1, "đội trưởng") };
  for (let s = 0; s < 1500; s++) {
    const ev = [];
    policy(st, ev, ctx);
    riverTick(st, ev);
    apply(ev);
    hkTick(hk, 1);
    const next = [];
    if (st.phase === 0 && ev.some((e) => e.type === "khucCoc")) setPhase(st, 1, next);
    else if (st.phase === 1 && ev.some((e) => e.type === "escortsReady" || e.type === "p2Timeout")) setPhase(st, 2, next);
    else if (st.phase === 2 && ev.some((e) => e.type === "tide50")) setPhase(st, 3, next);
    else if (st.phase === 3 && ev.some((e) => e.type === "tideZero")) setPhase(st, 4, next);
    else if (st.phase === 4 && st.phaseT >= p5) setPhase(st, 5, next);
    else if (st.phase === 5 && st.phaseT >= p6) break;
    if (next.length) { log.phaseAt[st.phase] = st.t; apply(next); }
  }
  return { st, hk, log, res: riverResult(st) };
}

// Người chơi giỏi: khiêu chiến ngay, KO tiên phong đều, phá 1 sĩ quan; lui giữ dải; hạ hộ vệ nhanh; mở đủ 3 mốc;
// Giữ vững luân phiên ở cửa nhánh; hạ hộ vệ đợt hai.
function perfect(st, ev, ctx) {
  const p = st.phase, pt = st.phaseT;
  if (p === 0) {
    if (st.t === 0) order(st, "flotilla", "tiencong", ev);
    if (pt > 0 && pt % 4 === 0 && st.nghi.kk < 100) provoke(st, "ko", 2, ev);
    if (pt === 30) provoke(st, "officer", 1, ev);
    if (st.ks.nghiBinh.state === "sansang" && st.nghi.stance === "tiencong") order(st, "flotilla", "giuvung", ev);
  } else if (p === 1) {
    if (pt > 0 && pt % 22 === 0) { onEscortDown(st, "capture", ev); ctx.gainCaptain(); }
  } else if (p === 2) {
    if (pt === 12) markerAction(st, "M1", "activate", ev);
    if (pt === 26) markerAction(st, "M2", "activate", ev);
    if (pt === 40) markerAction(st, "M3", "activate", ev);
  } else if (p === 3) {
    if (pt % 25 === 1) { for (const w of ["chanh", "rut", "gia"]) if (order(st, w, "giuvung", ev).ok) break; }
    if (pt > 0 && pt % 30 === 0) onEscortDown(st, "sink", ev);
  }
}
// Người chơi vụng: chậm ra lệnh, không KO, để lộ mốc, không Giữ vững, hạ ít hộ vệ.
function sloppy(st, ev) {
  const p = st.phase, pt = st.phaseT;
  if (p === 0) {
    if (pt === 12) order(st, "flotilla", "tiencong", ev);
    if (pt === 60) order(st, "flotilla", "giuvung", ev);
  } else if (p === 1) {
    if (pt === 70 || pt === 150) onEscortDown(st, "capture", ev);
    if (pt === 60) markerAction(st, "M3", "expose", ev);                    // để lọt một thuyền dò
  } else if (p === 2) {
    setMarkerOfficer(st, "M2", pt >= 20 && pt < 34);                     // tướng địch đứng ở M2 14 s
    if (pt === 60) markerAction(st, "M1", "activate", ev);
  } else if (p === 3) {
    if (pt === 50) onEscortDown(st, "capture", ev);
  }
}

console.log("Kịch bản trọn trận (Trận nhanh)");
const P = runScript(perfect), S = runScript(sloppy);
t("chạy giỏi: 3/3 Kế Sách thành công, 3/3 mốc, mắc cạn 100%", () => {
  const r = P.res;
  assert.equal(r.keSachOk, 3, JSON.stringify(r.keSach));
  assert.equal(r.markersActive, 3); assert.equal(r.strandShare, 1); assert.equal(r.reachShare, 0.8);
  assert.ok(r.flotillaLost <= 2); assert.ok(!r.escapeFull); assert.ok(r.kRank);
  assert.equal(P.st.phase, 5);
});
t("chạy giỏi: Hào Khí 30 → ≈100 cuối pha 3 (×1,3), đủ kích TPC ở pha 4", () => {
  assert.ok(P.log.hkAtP3End >= 95, `HK cuối P3 = ${P.log.hkAtP3End}`);
  // 20 + 20 (Kế Sách) + 4 × 3 (hộ vệ) = 52 điểm gốc từ sông tới hết P3
  near(P.hk.log["kế sách:Nghi binh lúc triều lên"], 20, 0); near(P.hk.log["kế sách:Kích hoạt bãi cọc"], 20, 0);
});
t("chạy giỏi: pha 1 thành công trước khi hết cửa sổ 90 s", () => {
  assert.ok(P.log.phaseAt[1] <= 95, `P2 bắt đầu ở ${P.log.phaseAt[1]} s`);
});
t("chạy vụng: cả 3 Kế Sách hỏng (mồi hết giờ, mốc lộ, Thoát vây đầy), mắc cạn 50%, không thua trận", () => {
  const r = S.res;
  assert.equal(r.keSachOk, 0, JSON.stringify(r.keSach));
  assert.equal(r.keSach.nghiBinh.state, "thatbai"); assert.equal(r.keSach.kichCoc.state, "thatbai"); assert.equal(r.keSach.conNuoc.state, "thatbai");
  assert.equal(r.markers.M2, "exposed"); assert.equal(r.markers.M3, "exposed"); assert.equal(r.markers.M1, "active");
  assert.ok(r.escapeFull); assert.equal(r.strandShare, 0.5); assert.equal(r.kRank, false);
  assert.equal(S.st.phase, 5, "vẫn tới pha 6");
  assert.ok(S.log.hkAtP3End < 75, `HK cuối P3 = ${S.log.hkAtP3End}`);
});
t("thời lượng cửa sổ: tổng 90 + 180 + 100 + 135 ≈ 8,4 phút; chạy vụng hết pha 4 trong 8–9,5 phút", () => {
  const sum = B20.KE_SACH.nghiBinh.window.nhanh + B20.TIDE.p2Sec.nhanh + B20.KE_SACH.kichCoc.window.nhanh + B20.TIDE.p3DropSec + B20.TIDE.p4Sec.nhanh;
  near(sum, 505, 0); assert.ok(sum / 60 >= 8 && sum / 60 <= 9);
  assert.ok(S.log.windowsEnd >= 480 && S.log.windowsEnd <= 570, `vụng: ${S.log.windowsEnd} s`);
  assert.ok(P.log.windowsEnd >= 300 && P.log.windowsEnd < S.log.windowsEnd, `giỏi: ${P.log.windowsEnd} s`);
});
t("tất định: cùng kịch bản → cùng JSON; checkpoint giữa trận chạy tiếp giống hệt", () => {
  const a = runScript(perfect), b = runScript(perfect);
  assert.equal(JSON.stringify(a.st), JSON.stringify(b.st));
  assert.equal(JSON.stringify(a.log.events), JSON.stringify(b.log.events));
  const s1 = createRiver({ mode: "nhanh" }); order(s1, "flotilla", "tiencong"); ticks(s1, 30);
  const s2 = snapshotRiver(s1);
  const e1 = ticks(s1, 50), e2 = ticks(s2, 50);
  assert.equal(JSON.stringify(s1), JSON.stringify(s2)); assert.equal(JSON.stringify(e1), JSON.stringify(e2));
});
t("đầu hạm đội đi tiếp tới FLEET.stopX ở pha 3 (hạ hộ vệ sớm), rồi neo; pha 1 không chạm stopX", () => {
  const st = at(1); st.fleet.headX = 600; setPhase(st, 2);
  ticks(st, 60); assert.equal(st.fleet.headX, B20.FLEET.stopX); assert.equal(st.fleet.speed, 0);
  const s3 = at(3), x3 = s3.fleet.headX; ticks(s3, 20); assert.equal(s3.fleet.headX, x3, "pha 4: hạm đội đứng");
});
t("Quyết sách đúng: báo trước thuyền dò (Tình báo sớm, FLEET.scoutWarn = 10 s theo hợp đồng gameplay)", () => {
  assert.ok(P.log.events.includes("scoutWarn")); assert.equal(B20.FLEET.scoutWarn, 10);
  const st = at(1); const ev = ticks(st, 60); assert.ok(!has(ev, "scoutWarn")); assert.ok(has(ev, "scout"));
});
t("nước 30% không mốc nào mở: không thưởng Con nước \"cọc nhô\" (+5); có mốc mở thì có", () => {
  for (const [nAct, want] of [[0, 0], [1, B20.KE_SACH.conNuoc.partial.stakesUp]]) {
    const st = at(2); if (nAct) markerAction(st, "M1", "activate"); setPhase(st, 3);
    const ev = [];
    for (let s = 0; s < 80 && !st.flags.strandAt; s++) { const e = []; riverTick(st, e); ev.push(...e); }
    assert.ok(st.flags.strandAt, "đã tới 30%");
    assert.equal(st.ks.conNuoc.got, want, `${nAct} mốc mở`);
  }
});

console.log(`\n${pass} đạt, ${fail} trượt`);
console.log(`  (giỏi: P2 ở ${P.log.phaseAt[1]} s, HK cuối P3 ${P.log.hkAtP3End?.toFixed(1)}, hết P4 ${P.log.windowsEnd} s; vụng: HK cuối P3 ${S.log.hkAtP3End?.toFixed(1)}, hết P4 ${S.log.windowsEnd} s)`);
if (fail) process.exit(1);
