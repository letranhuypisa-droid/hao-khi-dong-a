// tests/hud-b20.test.mjs — HUD B20 (battle/hud-b20.js): riverHud dựng hudState từ sim/river.js thật; HudB20 trên một HUD giả
// và DOM giả (chỉ đủ cho các ô setTopWidget / setPanel / prompt / picker, thanh boss). Chạy trong Node:
//   node hao-khi-viet/game/tests/hud-b20.test.mjs
import assert from "node:assert/strict";
import { riverHud, HudB20, HUD_B20, wireHudB20, FERRY_SVG, MAP_BOUNDS, MAP_CANVAS } from "../js/battle/hud-b20.js";
import { createRiver, setPhase, riverTick, markerAction, onEscortDown, order, setMarkerOfficer } from "../js/sim/river.js";
import { TIDE, LIGHT_BOATS, STAKES, FLEET, MAP } from "../js/data/battle-b20.js";

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log("  ok  " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + (e.stack || e.message)); }
}
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ""} ${a} ≉ ${b} (±${tol})`);
const ticks = (st, n) => { for (let i = 0; i < n; i++) riverTick(st, []); return st; };
function at(i, opts = {}) { const st = createRiver({ mode: "nhanh", ...opts }); for (let p = 1; p <= i; p++) setPhase(st, p); return st; }

console.log("riverHud (hudState từ sim sông)");
t("P1: triều lên tới đỉnh, bảng Nghi binh đủ trường, Kế Sách đủ 3 mục", () => {
  const st = ticks(at(0), 10), h = riverHud(st);
  assert.equal(h.phase, 0); assert.ok(h.tide.rate > 0 && h.tide.next.pct === TIDE.p1.to && h.tide.next.label === "Đỉnh triều");
  near(h.tide.next.sec, (TIDE.p1.to - h.tide.pct) / h.tide.rate, 1e-9); assert.equal(h.tide.warn, false);
  assert.deepEqual(h.lure.band, [LIGHT_BOATS.gap.min, LIGHT_BOATS.gap.max]); assert.equal(h.lure.boatsMax, LIGHT_BOATS.n);
  assert.equal(h.lure.gap, st.nghi.gap); assert.equal(h.lure.toLine, Math.max(0, MAP.khucCoc - st.fleet.headX));
  assert.deepEqual(h.ks.map((k) => [k.id, k.state]), [["nghiBinh", "khadung"], ["kichCoc", "khoa"], ["conNuoc", "khoa"]]);
  assert.ok(h.ks[0].left > 0 && /Khiêu khích/.test(h.ks[0].detail)); assert.equal(h.ks[0].label, "Chính sử"); assert.equal(h.ks[0].quyMo, "Lớn");
  assert.equal(h.escorts, null); assert.equal(h.escape, null); assert.equal(h.markers.length, 3, "mốc luôn có cho bản đồ nhỏ");
});
t("P2: hộ vệ đợt 1 (cần 4), mốc cọc, triều xuống về sàn 55", () => {
  const st = at(1); ticks(st, 20); onEscortDown(st, "capture");
  const h = riverHud(st);
  assert.equal(h.lure, null); assert.deepEqual([h.escorts.down, h.escorts.need, h.escorts.total, h.escorts.wave], [1, 4, FLEET.escorts[0], 1]);
  assert.ok(h.tide.rate < 0 && h.tide.next.pct === TIDE.p2Floor);
  assert.deepEqual(h.markers.map((m) => m.state), ["hidden", "hidden", "hidden"]);
});
t("P3: tướng địch đứng mốc → officerT; mở mốc; triều đứng rồi rút về 50", () => {
  const st = at(2); setMarkerOfficer(st, "M2", true); ticks(st, 4); markerAction(st, "M1", "activate");
  let h = riverHud(st);
  const m2 = h.markers.find((m) => m.id === "M2");
  assert.equal(m2.officerOn, true); assert.equal(m2.officerT, 4); assert.equal(m2.exposeSec, STAKES[1].exposeSec);
  assert.equal(h.markers[0].state, "active"); assert.equal(h.tide.hold, true); assert.equal(h.tide.next, null);
  assert.equal(h.escorts, null, "P3 không có bảng hộ vệ");
  markerAction(st, "M3", "activate"); st.ks.kichCoc.state = "sansang";
  st.drop = { from: st.tide, t: 0 }; ticks(st, 2); h = riverHud(st);
  assert.equal(h.tide.hold, false); assert.equal(h.tide.next.pct, TIDE.p3HoldTo);
});
t("P4: Thoát vây + Giữ vững ×0,7, hộ vệ đợt 2, mốc 30% rồi 0%, cảnh báo T−30", () => {
  const st = at(3); ticks(st, 5); order(st, "rut", "giuvung");
  let h = riverHud(st);
  assert.ok(h.escape.holding && h.escape.holdLeft > 0); near(h.escape.rate, 0.5 * FLEET.cmdShips * 0.7, 1e-9);
  assert.equal(h.escorts.wave, 2); assert.equal(h.escorts.waveTotal, FLEET.escorts[1]);
  assert.equal(h.tide.next.pct, TIDE.strandAt); assert.equal(h.tide.warn, h.tide.next.sec <= TIDE.warn);
  ticks(st, 200); h = riverHud(st); assert.equal(h.tide.next, null);
  const st2 = at(3); ticks(st2, 80); assert.equal(riverHud(st2).tide.warn, false, "0% còn > 30 s");
  ticks(st2, 30); const h2 = riverHud(st2);
  assert.ok(h2.tide.pct <= TIDE.strandAt && h2.tide.next.pct === 0 && h2.tide.warn);
});
t("P5–P6: không bảng pha; extra (boss, Tương tác, Đò chuyển) gộp đè", () => {
  const h = riverHud(at(5), { bosses: [{ id: "X20" }], hkLock: true, lure: null });
  assert.equal(h.phase, 5); assert.equal(h.tide.pct, 0); assert.equal(h.escape, null); assert.equal(h.hkLock, true); assert.equal(h.bosses[0].id, "X20");
});
t("Quyết sách đúng → intel", () => { assert.equal(riverHud(at(0, { quyetSachOk: true })).intel, true); assert.equal(riverHud(at(0)).intel, false); });

console.log("Bản đồ nhỏ, hình Đò chuyển");
t("HUD_B20 đúng khuôn BattleDef.hud; wireHudB20", () => {
  assert.equal(HUD_B20.bounds, MAP_BOUNDS); assert.equal(HUD_B20.canvas, MAP_CANVAS); assert.equal(HUD_B20.frontsHTML(), "");
  assert.ok(typeof HUD_B20.drawBase === "function" && typeof HUD_B20.drawTop === "function");
  const r = (MAP_BOUNDS.x1 - MAP_BOUNDS.x0) / (MAP_BOUNDS.z1 - MAP_BOUNDS.z0); near(MAP_CANVAS.w / MAP_CANVAS.h, r, 0.05, "tỉ lệ khung");
  assert.ok(MAP_BOUNDS.x0 <= MAP.clamp.x0 && MAP_BOUNDS.x1 >= MAP.clamp.x1, "khung chứa vùng đi được theo x");
  const d = {}; assert.equal(wireHudB20(d), d); assert.equal(d.hud, HUD_B20);
});
t("hình SVG cho mọi loại điểm đến", () => {
  for (const k of ["ship", "escort", "captured", "flagship", "raft", "pier", "light", "bank"]) assert.ok(/^<svg /.test(FERRY_SVG[k]), k);
});

// ---- DOM giả, HUD giả -----------------------------------------------------------------------------------------------------
function el() {
  const cls = new Set();
  return { style: {}, dataset: {}, hidden: false, textContent: "", innerHTML: "", className: "", children: [], parentElement: null,
    classList: { add: (...c) => c.forEach((x) => cls.add(x)), remove: (...c) => c.forEach((x) => cls.delete(x)), toggle: (c, on) => (on ? cls.add(c) : cls.delete(c)), contains: (c) => cls.has(c) },
    querySelector() { return el(); }, appendChild(c) { this.children.push(c); c.parentElement = this; }, remove() { this.removed = true; } };
}
globalThis.document = { createElement: () => el() };
function fakeHud() {
  const root = el(); root.parentElement = el();
  const h = { root, el: { topw: el(), prompt: el(), picker: el() }, log: [], panels: new Map(), top: null, pickerOpen: false, cb: null,
    setTopWidget(x) { this.top = x; }, setPanel(id, x) { if (x == null) this.panels.delete(id); else this.panels.set(id, x); },
    prompt(text, p) { this.log.push(["prompt", text, p]); }, picker(items, cb, title) { this.log.push(["picker", items && items.length, title]); this.pickerOpen = !!items; this.cb = cb; this.items = items; },
    nearestOfficer: () => null };
  return h;
}
function mk(touch = false) {
  const sounds = [], hud = fakeHud();
  const ctx = { hud, touch, audio: { play: (n) => sounds.push(n) }, hero: { lock: null }, hk: { tpc: false } };
  return { ctx, hud, sounds, hb: new HudB20(ctx) };
}

console.log("HudB20 (HUD giả)");
t("dựng: lớp hud-b20, đồng hồ Con nước ở ô trên, thanh boss ẩn; dispose dọn sạch", () => {
  const { ctx, hud, hb } = mk();
  assert.ok(hud.root.classList.contains("hud-b20") && hud.root.parentElement.classList.contains("b20"));
  assert.ok(/CON NƯỚC/.test(hud.top)); assert.equal(ctx.hudB20, hb); assert.equal(hb.bossEl.hidden, true);
  hb.update(riverHud(at(0)), 0.1); assert.ok(hud.panels.has("b20"));
  hb.dispose(); assert.equal(hud.top, null); assert.equal(hud.panels.size, 0); assert.equal(ctx.hudB20, null); assert.ok(hb.bossEl.removed);
  assert.ok(!hud.root.classList.contains("hud-b20"));
});
t("bảng theo pha: Nghi binh P1, hộ vệ + mốc P2, mốc P3, Thoát vây P4, Hào Khí khóa P6", () => {
  const { hud, hb } = mk(), html = (st) => { hb.update(st, 0.1); return hud.panels.get("b20") || ""; };
  assert.ok(/NGHI BINH/.test(html(riverHud(ticks(at(0), 3)))));
  const p2 = html(riverHud(at(1))); assert.ok(/HỘ VỆ/.test(p2) && /MỐC CỌC/.test(p2));
  const p3 = html(riverHud(at(2))); assert.ok(/MỐC CỌC/.test(p3) && !/HỘ VỆ/.test(p3));
  const p4 = html(riverHud(at(3))); assert.ok(/THOÁT VÂY/.test(p4) && /ĐỢT 2/.test(p4) && !/MỐC CỌC/.test(p4));
  assert.ok(/HÀO KHÍ KHÓA 100/.test(html(riverHud(at(5), { hkLock: true }))));
  assert.ok(/Kế Sách Lớn · Nghi binh lúc triều lên/.test(html(riverHud(at(0)))), "Kế Sách đang chạy đầy đủ");
});
t("khoảng cách Nghi binh: trong dải / quá sát / quá xa", () => {
  const { hud, hb } = mk(), st = at(0);
  for (const [g, word] of [[27, "Trong dải"], [10, "Quá sát!"], [50, "Quá xa"]]) { st.nghi.gap = g; hb.update(riverHud(st), 0.1); assert.ok(hud.panels.get("b20").includes(word), word); }
});
t("nhắc Tương tác: phím X / cảm ứng, tiến độ; null thì ẩn", () => {
  const a = mk(); a.hb.update({ phase: 1, interact: { text: "Chiếm thuyền hộ vệ", p: 0.4 } }, 0.01);
  assert.deepEqual(a.hud.log.at(-1), ["prompt", "Giữ X · Chiếm thuyền hộ vệ", 0.4]); assert.equal(a.hud.el.prompt.dataset.key, "X");
  a.hb.update({ phase: 1, interact: null }, 0.01); assert.deepEqual(a.hud.log.at(-1), ["prompt", null, undefined]);
  const b = mk(true); b.hb.update({ phase: 1, interact: { text: "Mở bãi cọc", p: 1 } }, 0.01);
  assert.deepEqual(b.hud.log.at(-1), ["prompt", "Mở bãi cọc", 1]); assert.equal(b.hud.el.prompt.dataset.key, "✋");
});
t("Đò chuyển: mở theo đối tượng ferry (không mở lại sau khi chọn), tối đa 4, có hình; null đóng", () => {
  const { hud, hb, sounds } = mk();
  let got = null;
  const f1 = { items: [1, 2, 3, 4, 5].map((i) => ({ id: "d" + i, label: "Nơi " + i, kind: i === 4 ? "flagship" : "raft" })), onPick: (it) => (got = it.id) };
  hb.update({ phase: 4, ferry: f1 }, 0.01);
  const opens = () => hud.log.filter((l) => l[0] === "picker" && l[1]).length;
  assert.equal(opens(), 1); assert.equal(hud.items.length, 4); assert.ok(hud.items[3].svg === FERRY_SVG.flagship && hud.items[0].svg === FERRY_SVG.raft);
  assert.ok(/Đò chuyển/.test(hud.log.at(-1)[2])); assert.ok(sounds.includes("ui"));
  hud.cb(hud.items[1]); hud.pickerOpen = false; assert.equal(got, "d2");
  hb.update({ phase: 4, ferry: f1 }, 0.01); assert.equal(opens(), 1, "cùng đối tượng: không mở lại");
  hb.update({ phase: 4, ferry: null }, 0.01); assert.equal(opens(), 1);
  const f2 = { items: f1.items.slice(0, 2), onPick() {} }; hb.update({ phase: 4, ferry: f2 }, 0.01); assert.equal(opens(), 2);
  hb.update({ phase: 4, ferry: null }, 0.01); assert.equal(hud.pickerOpen, false, "director đóng bảng");
});
t("thanh boss: khóa Sinh lực, Vỡ Thế → Bắt sống, bị bắt hiện 4 s rồi ẩn; boss kế tiếp thay chỗ", () => {
  const { hb } = mk(), X24 = { id: "X24", name: "Phàn Tiếp", nameHan: "樊楫", hp: 3000, maxHp: 4200, hpLock: 0, poise: 300, poiseMax: 600, phases: 1, phase: 1 };
  const up = (b) => hb.update({ phase: 4, bosses: b }, 0.05);
  up([X24]); assert.equal(hb.bossEl.hidden, false); assert.equal(hb.bw.bname.textContent, "Phàn Tiếp"); assert.equal(hb.bw.block.hidden, true);
  up([{ ...X24, broken: true }]); assert.ok(hb.bossEl.classList.contains("broken")); assert.ok(/BẮT SỐNG/.test(hb.bw.bhint.textContent));
  up([{ ...X24, captured: true }]); assert.ok(hb.bossEl.classList.contains("captured")); assert.equal(hb.bw.bhint.textContent, "ĐÃ BẮT SỐNG");
  for (let i = 0; i < 90; i++) up([{ ...X24, captured: true }]);
  assert.equal(hb.bossEl.hidden, true, "ẩn sau 4 s");
  const X20 = { id: "X20", name: "Ô Mã Nhi", hp: 1200, maxHp: 12000, hpLock: 10, poise: 500, poiseMax: 1000, phases: 2, phase: 2 };
  up([{ ...X24, captured: true }, X20]); assert.equal(hb.bossEl.hidden, false); assert.equal(hb.bw.bname.textContent, "Ô Mã Nhi");
  assert.ok(hb.bossEl.classList.contains("locked")); assert.equal(hb.bw.block.style.left, "10.0%"); assert.ok(/khóa ở 10%/.test(hb.bw.bhint.textContent));
  up([{ ...X24, captured: true }, { ...X20, hp: 5000 }]); assert.ok(!hb.bossEl.classList.contains("locked"));
});
t("tiếng báo: T−30 Con nước, tướng địch đứng mốc, thuyền nhẹ quá sát (≤ 1 lần / 4 s), Thoát vây ≥ 80 — mỗi lần một", () => {
  const { hb, sounds } = mk(), n = () => sounds.filter((s) => s === "warn").length;
  hb.update({ phase: 3, tide: { pct: 40, rate: -0.3, next: { pct: 30, sec: 20, label: "Cọc nhô" }, warn: true } }, 0.1); assert.equal(n(), 1);
  hb.update({ phase: 3, tide: { pct: 39, rate: -0.3, next: { pct: 30, sec: 19, label: "Cọc nhô" }, warn: true } }, 0.1); assert.equal(n(), 1);
  hb.update({ phase: 2, markers: [{ id: "M1", state: "hidden", officerOn: true, officerT: 1 }] }, 0.1); assert.equal(n(), 2);
  hb.update({ phase: 2, markers: [{ id: "M1", state: "hidden", officerOn: true, officerT: 2 }] }, 0.1); assert.equal(n(), 2);
  const lure = { gap: 10, band: [15, 40], max: 60, kk: 0, boats: 8, boatsMax: 8, lostMax: 2 };
  hb.update({ phase: 0, lure }, 0.1); hb.update({ phase: 0, lure }, 0.1); assert.equal(n(), 3);
  for (let i = 0; i < 45; i++) hb.update({ phase: 0, lure }, 0.1); assert.equal(n(), 4);
  hb.update({ phase: 3, escape: { value: 82, full: false, holding: false, rate: 1 } }, 0.1); assert.equal(n(), 5);
  const q = mk(); q.hb.cues = false; q.hb.update({ phase: 0, lure }, 0.1); assert.equal(q.sounds.length, 0, "cues: false thì im");
});

console.log(`\n${pass} đạt, ${fail} trượt`);
if (fail) process.exitCode = 1;
