// tests/banner-queue.test.mjs — hàng đợi băng chữ giữa màn (battle/banner-queue.js): ba băng trong cùng một nhịp
// ("KẾ SÁCH", "CHIẾM ĐỒN", "P2 · HAI CÁNH") phải lần lượt hiện, không băng sau xoá băng trước ngay. Chạy trong Node:
//   node hao-khi-viet/game/tests/banner-queue.test.mjs
import assert from "node:assert/strict";
import { BannerQueue } from "../js/battle/banner-queue.js";

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log("  ok  " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + (e.stack || e.message)); }
}

// chạy hàng đợi với bước 1/60 s, ghi lại giây hiện của từng băng
function run(q, seconds, log, t0 = { v: 0 }) {
  for (let i = 0; i < Math.round(seconds * 60); i++) { t0.v += 1 / 60; q.now = t0.v; q.update(1 / 60); }
  return t0;
}
const make = (opts) => { const log = []; const q = new BannerQueue((text, color, T) => log.push({ text, color, T, at: q.now ?? 0 }), opts); q.now = 0; return { q, log }; };

console.log("Hàng đợi băng chữ");
t("băng đầu hiện ngay ở nhịp kế; không có băng nào thì không hiện gì", () => {
  const { q, log } = make();
  run(q, 1, log); assert.equal(log.length, 0);
  q.push("A", "#fff", 1.4); q.update(1 / 60);
  assert.deepEqual(log.map((b) => b.text), ["A"]);
});
t("ba băng cùng một nhịp hiện lần lượt, cách nhau ~1,35 s, băng cuối giữ nguyên T", () => {
  const { q, log } = make();
  q.push("KẾ SÁCH · CỜ ÁO TỐNG", "#f1d98a", 2); q.push("CHIẾM ĐỒN BẾN TRÊN", "#f1d98a", 1.4); q.push("P2 · HAI CÁNH", "#e6dcc3", 2);
  run(q, 6, log);
  assert.deepEqual(log.map((b) => b.text), ["KẾ SÁCH · CỜ ÁO TỐNG", "CHIẾM ĐỒN BẾN TRÊN", "P2 · HAI CÁNH"]);
  const gap1 = log[1].at - log[0].at, gap2 = log[2].at - log[1].at;
  assert.ok(Math.abs(gap1 - 1.35) < 0.05, `gap1 ${gap1}`); assert.ok(Math.abs(gap2 - 1.35) < 0.05, `gap2 ${gap2}`);
  assert.equal(log[2].T, 2, "băng cuối hiện đủ T");
});
t("băng ngắn hơn mức giữ thì chỉ chờ T, không chờ cả mức giữ", () => {
  const { q, log } = make();
  q.push("A", "#fff", 0.6); q.push("B", "#fff", 0.6);
  run(q, 2, log);
  assert.ok(Math.abs((log[1].at - log[0].at) - 0.85) < 0.05, `gap ${log[1].at - log[0].at}`);
});
t("băng trùng chữ đang chờ bị bỏ", () => {
  const { q, log } = make();
  q.push("A", "#fff", 1); q.push("B", "#fff", 1); q.push("B", "#fff", 1);
  run(q, 5, log);
  assert.deepEqual(log.map((b) => b.text), ["A", "B"]);
});
t("hàng đầy thì bỏ băng chờ cũ nhất (băng mới thường quan trọng hơn)", () => {
  const { q, log } = make({ max: 2 });
  q.push("A", "#fff", 1); q.update(1 / 60);        // A đang hiện
  q.push("B", "#fff", 1); q.push("C", "#fff", 1); q.push("D", "#fff", 1);   // B bị đẩy ra
  run(q, 6, log);
  assert.deepEqual(log.map((b) => b.text), ["A", "C", "D"]);
});
t("dt = 0 (hit-stop, tạm dừng) thì hàng đợi đứng yên", () => {
  const { q, log } = make();
  q.push("A", "#fff", 1);
  for (let i = 0; i < 300; i++) q.update(0);
  assert.equal(log.length, 1, "băng đầu hiện ngay dù dt = 0");
  q.push("B", "#fff", 1);
  for (let i = 0; i < 300; i++) q.update(0);
  assert.equal(log.length, 1, "băng sau chưa tới lượt vì thời gian không trôi");
});
t("sau một quãng yên, băng mới hiện ngay ở nhịp kế", () => {
  const { q, log } = make();
  q.push("A", "#fff", 1); run(q, 5, log);
  q.push("B", "#fff", 1); q.update(1 / 60);
  assert.deepEqual(log.map((b) => b.text), ["A", "B"]);
});
t("băng ưu tiên thấp xếp sau mọi băng thường dù đến trước (Kế Sách mở cùng lúc chiếm đồn)", () => {
  const { q, log } = make();
  q.push("KẾ SÁCH · CỜ ÁO TỐNG", "#f1d98a", 2, true);
  q.push("CHIẾM ĐỒN BẾN TRÊN", "#f1d98a", 1.4); q.push("P2 · HAI CÁNH", "#e6dcc3", 2);
  run(q, 6, log);
  assert.deepEqual(log.map((b) => b.text), ["CHIẾM ĐỒN BẾN TRÊN", "P2 · HAI CÁNH", "KẾ SÁCH · CỜ ÁO TỐNG"]);
});
t("clear xoá hàng chờ và cho băng kế hiện ngay (tải lại đầu pha)", () => {
  const { q, log } = make();
  q.push("A", "#fff", 2); q.push("B", "#fff", 2); q.update(1 / 60);
  q.clear();
  assert.equal(q.q.length, 0);
  q.push("C", "#fff", 1); q.update(1 / 60);
  assert.deepEqual(log.map((b) => b.text), ["A", "C"]);
});

console.log(`\n${pass} đạt, ${fail} trượt`);
process.exit(fail ? 1 : 0);
