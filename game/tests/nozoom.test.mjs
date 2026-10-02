// tests/nozoom.test.mjs — chặn trình duyệt điện thoại tự phóng to khi đánh (đợt 17, ui/nozoom.js): chạm đúp trong khung
// trận không phóng to, chạm thường không bị chặn, ngoài trận để yên, ô nhập chữ được miễn, cử chỉ chụm trong trận bị chặn.
// Chạy trong Node bằng document giả:
//   node game/tests/nozoom.test.mjs
import assert from "node:assert/strict";
import { installNoZoom, DOUBLE_TAP_MS } from "../js/ui/nozoom.js";

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log("  ok  " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + (e.stack || e.message)); }
}

// document giả: ghi listener, phát sự kiện; phần tử giả có closest(sel) theo danh sách tổ tiên
function fakeDoc() {
  const L = {};
  return {
    addEventListener: (type, fn, opt) => { (L[type] ||= []).push({ fn, opt }); },
    removeEventListener: (type, fn) => { L[type] = (L[type] || []).filter((x) => x.fn !== fn); },
    fire(type, target, timeStamp = 0) {
      const e = { type, target, timeStamp, prevented: false, preventDefault() { this.prevented = true; } };
      for (const { fn } of L[type] || []) fn(e);
      return e.prevented;
    },
    opts: (type) => (L[type] || []).map((x) => x.opt),
    count: (type) => (L[type] || []).length,
  };
}
const el = (...inside) => ({ closest: (sel) => (sel.split(",").map((s) => s.trim()).some((s) => inside.includes(s)) ? {} : null) });
const btn = el(".stage"), hub = el(), input = el(".stage", "input");

console.log("Chạm đúp trong khung trận");
t("chạm đầu không bị chặn, chạm thứ hai trong hạn thì bị chặn (hết phóng to)", () => {
  const d = fakeDoc(); installNoZoom(d);
  assert.equal(d.fire("touchend", btn, 1000), false);
  assert.equal(d.fire("touchend", btn, 1000 + DOUBLE_TAP_MS - 50), true);
});
t("bấm đòn liên tục: mọi lần sau lần đầu đều bị chặn", () => {
  const d = fakeDoc(); installNoZoom(d);
  const got = [0, 120, 240, 360, 480].map((ms) => d.fire("touchend", btn, 5000 + ms));
  assert.deepEqual(got, [false, true, true, true, true]);
});
t("hai lần chạm cách xa hơn hạn thì không chặn", () => {
  const d = fakeDoc(); installNoZoom(d);
  d.fire("touchend", btn, 0);
  assert.equal(d.fire("touchend", btn, DOUBLE_TAP_MS + 10), false);
});
t("ô nhập chữ trong trận được miễn", () => {
  const d = fakeDoc(); installNoZoom(d);
  d.fire("touchend", btn, 0);
  assert.equal(d.fire("touchend", input, 100), false);
});

console.log("Ngoài trận và cử chỉ khác");
t("ngoài khung trận (hub) để yên — CSS touch-action lo phần đó, nút hub vẫn nhận click", () => {
  const d = fakeDoc(); installNoZoom(d);
  d.fire("touchend", hub, 0);
  assert.equal(d.fire("touchend", hub, 100), false);
});
t("cử chỉ chụm (iOS gesturestart / gesturechange) trong trận bị chặn, ngoài trận để yên", () => {
  const d = fakeDoc(); installNoZoom(d);
  assert.equal(d.fire("gesturestart", btn), true);
  assert.equal(d.fire("gesturechange", btn), true);
  assert.equal(d.fire("gesturestart", hub), false);
});
t("dblclick bị chặn trừ ô nhập chữ", () => {
  const d = fakeDoc(); installNoZoom(d);
  assert.equal(d.fire("dblclick", btn), true);
  assert.equal(d.fire("dblclick", el("textarea")), false);
});
t("listener đăng ký không thụ động (passive: false), không thì preventDefault bị bỏ qua", () => {
  const d = fakeDoc(); installNoZoom(d);
  for (const ty of ["touchend", "gesturestart", "gesturechange", "dblclick"]) assert.deepEqual(d.opts(ty), [{ passive: false }], ty);
});
t("hàm trả về gỡ hết listener", () => {
  const d = fakeDoc(); const off = installNoZoom(d); off();
  for (const ty of ["touchend", "gesturestart", "gesturechange", "dblclick"]) assert.equal(d.count(ty), 0, ty);
});

console.log(`\n${pass} đạt, ${fail} trượt`);
process.exit(fail ? 1 : 0);
