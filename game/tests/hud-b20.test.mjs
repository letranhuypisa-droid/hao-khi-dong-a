// tests/hud-b20.test.mjs — HUD B20 (battle/hud-b20.js): riverHud dựng hudState từ sim/river.js thật; HudB20 trên một HUD giả
// và DOM giả (chỉ đủ cho các ô setTopWidget / setPanel / prompt / picker, thanh boss). Chạy trong Node:
//   node hao-khi-viet/game/tests/hud-b20.test.mjs
import assert from "node:assert/strict";
import { riverHud, HudB20, HUD_B20, wireHudB20, FERRY_SVG, MAP_BOUNDS, MAP_CANVAS } from "../js/battle/hud-b20.js";
import { createRiver, setPhase, riverTick, launch } from "../js/sim/river.js";
import { TIDE, TUA, LIGHT_BOATS, STAKES, MAP } from "../js/data/battle-b20.js";

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log("  ok  " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + (e.stack || e.message)); }
}
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ""} ${a} ≉ ${b} (±${tol})`);
const ticks = (st, n) => { for (let i = 0; i < n; i++) riverTick(st, []); return st; };
function at(i, opts = {}) { const st = createRiver({ mode: "nhanh", ...opts }); for (let p = 1; p <= i; p++) setPhase(st, p); return st; }

console.log("riverHud (hudState từ sim sông)");
t("P1 chưa ra lệnh: bảng Nghi binh chờ lệnh, triều chưa lên, Kế Sách đủ 3 mục", () => {
  const st = ticks(at(0), 10), h = riverHud(st);
  assert.equal(h.phase, 0); assert.equal(h.tide.next, null, "triều chưa chạy"); assert.equal(h.lure.launched, false); assert.equal(h.lure.stance, null);
  assert.deepEqual(h.lure.band, [LIGHT_BOATS.gap.min, LIGHT_BOATS.gap.max]); assert.equal(h.lure.toLine, Math.max(0, MAP.khucCoc - st.fleet.headX));
  assert.deepEqual(h.ks.map((k) => [k.id, k.state]), [["nghiBinh", "khadung"], ["kichCoc", "khoa"], ["conNuoc", "khoa"]]);
  assert.match(h.ks[0].detail, /chờ lệnh/); assert.equal(h.ks[0].label, "Chính sử"); assert.equal(h.ks[0].quyMo, "Lớn");
  assert.equal(h.tua, null); assert.equal(h.markers.length, 3); assert.deepEqual(h.markers.map((m) => m.state), ["hidden", "hidden", "hidden"]);
});
t("P1 sau lệnh: triều lên tới đỉnh, thế tự chọn, Khiêu khích; không còn trường thuyền mất / số thuyền", () => {
  const st = createRiver({ mode: "nhanh" }); launch(st); ticks(st, 10); const h = riverHud(st);
  assert.ok(h.tide.rate > 0 && h.tide.next.pct === TIDE.p1.to && h.tide.next.label === "Đỉnh triều");
  near(h.tide.next.sec, (TIDE.p1.to - h.tide.pct) / h.tide.rate, 1e-9);
  assert.equal(h.lure.launched, true); assert.equal(h.lure.stance, "tiencong"); assert.equal(h.lure.gap, st.nghi.gap); assert.equal(h.lure.kk, st.nghi.kk);
  assert.match(h.ks[0].detail, /Khiêu khích/); assert.ok(h.ks[0].left > 0);
  for (const k of ["boats", "boatsMax", "lostMax", "stanceCd", "max"]) assert.equal(h.lure[k], undefined, k);
});
t("P2–P4 cảnh tua: bảng tua theo bước, giây còn lại là giây THẬT (÷ TUA.rate), triều rút về 50 rồi 30 / 0", () => {
  const p2 = riverHud(at(1)); assert.deepEqual(p2.tua, { step: 1, label: p2.tua.label }); assert.equal(p2.lure, null); assert.equal(p2.tide.next, null);
  const st = at(2); ticks(st, 3); const p3 = riverHud(st);
  assert.equal(p3.tua.step, 2); assert.ok(p3.tide.rate < 0 && p3.tide.next.pct === TIDE.p3HoldTo);
  near(p3.tide.next.sec, (st.tide - TIDE.p3HoldTo) / -st.tideRate / TUA.rate, 1e-9);
  const s4 = at(3); const p4 = riverHud(s4); assert.equal(p4.tua.step, 3); assert.equal(p4.tide.next.pct, TIDE.strandAt);
  near(p4.tide.next.sec, (50 - TIDE.strandAt) / (50 / TIDE.tua.p4Sec) / TUA.rate, 1e-9);
  ticks(s4, TIDE.tua.p4Sec); assert.equal(riverHud(s4).tide.next, null);
  assert.deepEqual(riverHud(at(2)).markers.map((m) => m.state), ["active", "active", "active"], "cọc lộ từ pha 3");
});
t("P5–P6: không bảng pha; extra (boss, Tương tác, Đò chuyển) gộp đè", () => {
  const h = riverHud(at(5), { bosses: [{ id: "X20" }], hkLock: true, lure: null });
  assert.equal(h.phase, 5); assert.equal(h.tide.pct, 0); assert.equal(h.tua, null); assert.equal(h.hkLock, true); assert.equal(h.bosses[0].id, "X20");
});
t("Quyết sách đúng → intel", () => { assert.equal(riverHud(at(0, { quyetSachOk: true })).intel, true); assert.equal(riverHud(at(0)).intel, false); });
t("hudState không còn khối của cơ chế đã bỏ (hộ vệ, Thoát vây, thuyền dò)", () => {
  const h = riverHud(at(3));
  for (const k of ["escorts", "escape", "scout"]) assert.equal(h[k], undefined, k);
});

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
    querySelector() { return el(); }, addEventListener(type, fn) { (this.handlers ||= {})[type] = fn; }, appendChild(c) { this.children.push(c); c.parentElement = this; }, remove() { this.removed = true; } };
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
t("bảng theo pha: Nghi binh P1, Cảnh tua P2–P4, Hào Khí khóa P6", () => {
  const { hud, hb } = mk(), html = (st) => { hb.update(st, 0.1); return hud.panels.get("b20") || ""; };
  assert.ok(/NGHI BINH/.test(html(riverHud(ticks(at(0), 3)))));
  for (const i of [1, 2, 3]) { const p = html(riverHud(at(i))); assert.ok(/CẢNH TUA/.test(p) && new RegExp(`${i}/3`).test(p) && !/NGHI BINH/.test(p), "P" + (i + 1)); }
  assert.ok(/HÀO KHÍ KHÓA 100/.test(html(riverHud(at(5), { hkLock: true }))));
  assert.ok(/Kế Sách Lớn · Nghi binh lúc triều lên/.test(html(riverHud(at(0)))), "Kế Sách đang chạy đầy đủ");
  const p3 = html(riverHud(at(2))); assert.ok(/Kế Sách Lớn · Kích hoạt bãi cọc/.test(p3) && !/THOÁT VÂY|HỘ VỆ|MỐC CỌC/.test(p3));
});
t("bảng Nghi binh: chờ lệnh → khiêu chiến → lui dụ → qua Khúc cọc", () => {
  const { hud, hb } = mk(), st = at(0), w = (word) => assert.ok(hud.panels.get("b20").includes(word), word);
  hb.update(riverHud(st), 0.1); w("Chờ lệnh"); w("chờ ở thượng lưu");
  launch(st); ticks(st, 3); hb.update(riverHud(st), 0.1); w("Khiêu chiến"); w("áp sát");
  st.nghi.stance = "giuvung"; hb.update(riverHud(st), 0.1); w("Lui dụ");
  st.nghi.crossedAt = 5; hb.update(riverHud(st), 0.1); w("Qua Khúc cọc");
});
t("nút Ra khiêu chiến: hiện tới khi ra lệnh; bấm gọi director.launchLure; nhắc phím (cảm ứng: chạm); dispose gỡ", () => {
  const a = mk(); let n = 0; a.ctx.director = { launchLure: () => { n++; return true; } }; a.ctx.fmt = (x) => (x === "{kesach}" ? "G" : x);
  const st = at(0);
  assert.equal(a.hb.launchEl.hidden, true, "ẩn lúc dựng");
  a.hb.update(riverHud(st), 0.1); assert.equal(a.hb.launchEl.hidden, false); assert.equal(a.hb.lk.textContent, "hoặc bấm G");
  a.hb.launchEl.handlers.pointerdown({}); assert.equal(n, 1);
  launch(st); a.hb.update(riverHud(st), 0.1); assert.equal(a.hb.launchEl.hidden, true, "đã ra lệnh thì ẩn");
  a.hb.update(riverHud(at(1)), 0.1); assert.equal(a.hb.launchEl.hidden, true);
  const b = mk(true); b.hb.update(riverHud(at(0)), 0.1); assert.equal(b.hb.lk.textContent, "chạm để ra lệnh");
  a.hb.dispose(); assert.ok(a.hb.launchEl.removed);
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
t("không còn tiếng báo riêng của HUD (T−30, mốc, thuyền quá sát, Thoát vây): chỉ ui khi mở Đò chuyển", () => {
  const { hb, sounds } = mk();
  hb.update(riverHud(at(3)), 0.1); hb.update(riverHud(at(0)), 0.1); assert.deepEqual(sounds, []);
  hb.update({ phase: 4, ferry: { items: [{ id: "a", label: "A", kind: "ship" }], onPick() {} } }, 0.1); assert.deepEqual(sounds, ["ui"]);
});

console.log(`\n${pass} đạt, ${fail} trượt`);
if (fail) process.exitCode = 1;
