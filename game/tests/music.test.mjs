// tests/music.test.mjs — core/music.js khi trình duyệt chặn tự phát (đợt 19c). battle.js gọi music.play(bài) MỖI KHUNG: trước đây play() bị từ chối
// (chưa có thao tác người dùng) thì khung sau dựng phần tử <audio> mới, tải lại cả bài m4a và thêm hai chuỗi hẹn giờ fade — 60 phần tử mỗi giây
// tới lần chạm kế. Nay: một phần tử chờ, thử lại đúng phần tử đó khi có thao tác. Chạm màn cảm ứng: pointerdown KHÔNG cho phép phát (chỉ
// touchend / pointerup / click mới là "user activation"), nên thử lại cả ở các sự kiện đó.
//   node game/tests/music.test.mjs
import assert from "node:assert/strict";

let pass = 0, fail = 0;
async function t(name, fn) {
  try { await fn(); pass++; console.log("  ok  " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + (e.stack || e.message).split("\n").slice(0, 4).join("\n       ")); }
}

// Trình duyệt giả: Audio.play() bị từ chối tới khi có user activation (activated = true); window nhận addEventListener.
const B = { activated: false, made: [], listeners: {}, timers: 0 };
globalThis.window = { addEventListener: (ev, fn) => { (B.listeners[ev] ||= []).push(fn); } };
globalThis.setTimeout = ((orig) => (fn, ms) => { B.timers++; return orig(fn, Math.min(ms, 1)); })(globalThis.setTimeout);
globalThis.Audio = class {
  constructor(src) { this.src = src; this.paused = true; this.volume = 1; this.loop = false; this.plays = 0; B.made.push(this); }
  play() {
    this.plays++; this.paused = false;
    if (B.activated) return Promise.resolve();
    return Promise.reject(Object.assign(new Error("NotAllowedError"), { name: "NotAllowedError" })).catch((e) => { this.paused = true; throw e; });
  }
  pause() { this.paused = true; }
};
const fire = async (ev) => { for (const fn of B.listeners[ev] || []) fn({ type: ev }); await tick(); };
const tick = () => new Promise((r) => setImmediate(r));
const reset = () => { B.activated = false; B.made.length = 0; B.listeners = {}; B.timers = 0; };
const { Music } = await import("../js/core/music.js");

await t("bị chặn: gọi play() mỗi khung 60 lần chỉ dựng MỘT phần tử, không thêm chuỗi fade mỗi khung", async () => {
  reset(); const m = new Music(0.5);
  for (let i = 0; i < 60; i++) { m.play("battle", { fade: 2 }); await tick(); }
  assert.equal(B.made.length, 1, `dựng ${B.made.length} phần tử`);
  assert.ok(B.timers < 60, `hẹn giờ ${B.timers}`);
});
await t("chạm màn cảm ứng: pointerdown chưa cho phát, touchend cho phát — thử lại đúng phần tử đang chờ", async () => {
  reset(); const m = new Music(0.5);
  m.play("battle"); await tick();
  await fire("pointerdown");                                   // chạm: chưa có activation
  assert.equal(B.made.length, 1); assert.ok(B.made[0].paused);
  B.activated = true; await fire("touchend");
  assert.equal(B.made.length, 1, "không dựng phần tử mới");
  assert.equal(B.made[0].paused, false, "đang phát");
  for (let i = 0; i < 30; i++) { m.play("battle"); await tick(); }
  assert.equal(B.made.length, 1, "đang phát: play() mỗi khung không làm gì");
});
await t("click / pointerup cũng thử lại; đổi bài vẫn dựng phần tử mới (chuyển bài có crossfade như cũ)", async () => {
  reset(); const m = new Music(0.5);
  m.play("battle"); await tick();
  B.activated = true; await fire("click");
  assert.equal(B.made[0].paused, false);
  m.play("boss"); await tick();
  assert.equal(B.made.length, 2); assert.equal(B.made[1].src.includes("boss"), true);
  reset(); const m2 = new Music(0.5); m2.play("hub"); await tick();
  B.activated = true; await fire("pointerup");
  assert.equal(B.made.length, 1); assert.equal(B.made[0].paused, false);
});
await t("tạm dừng trận (pause) rồi chạm nút: không tự phát lại bài đang tạm dừng (resume() lo)", async () => {
  reset(); B.activated = true; const m = new Music(0.5);
  m.play("battle"); await tick(); m.pause();
  await fire("pointerdown"); await fire("click");
  assert.equal(B.made.length, 1); assert.equal(B.made[0].paused, true, "vẫn tạm dừng");
  m.resume(); await tick(); assert.equal(B.made[0].paused, false);
});
await t("stop() rồi chạm: không phát lại", async () => {
  reset(); const m = new Music(0.5);
  m.play("battle"); await tick(); m.stop(0.1);
  B.activated = true; await fire("touchend");
  assert.equal(B.made.length, 1);
});

console.log(`\n${pass} đạt, ${fail} trượt`);
process.exit(fail ? 1 : 0);
