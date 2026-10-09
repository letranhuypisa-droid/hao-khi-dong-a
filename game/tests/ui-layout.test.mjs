// tests/ui-layout.test.mjs — phần thuần của giao diện gọn (đợt 13, ui/layout.js): khi nào dùng HUD gọn, cụm nút cảm ứng
// quanh nút N không chồng nhau và không ra ngoài màn, tin nhắn của HUD gọn (một tin, tự tắt sau 5 s), sổ tin cho bảng
// tạm dừng, nhóm mục của hub (thanh 5 mục). Chạy trong Node:
//   node game/tests/ui-layout.test.mjs
import assert from "node:assert/strict";
import { isCompact, touchArc, TOUCH_SIZE, touchUnit, compactMsg, MSG_SHOW, logMsgs, NAV, groupOf, navBadge, SUBTABS } from "../js/ui/layout.js";

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log("  ok  " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + (e.stack || e.message)); }
}

console.log("HUD gọn: khi nào bật");
t("cảm ứng thì luôn gọn, kể cả màn lớn", () => assert.equal(isCompact({ w: 1280, h: 800, touch: true }), true));
t("chuột trên màn rộng thì giữ bố cục máy tính", () => {
  assert.equal(isCompact({ w: 1280, h: 720, touch: false }), false);
  assert.equal(isCompact({ w: 1024, h: 600, touch: false }), false);
});
t("chuột trên khung hẹp (≤ 900 px) hoặc thấp (≤ 500 px) thì gọn", () => {
  assert.equal(isCompact({ w: 900, h: 700, touch: false }), true);
  assert.equal(isCompact({ w: 600, h: 667, touch: false }), true);
  assert.equal(isCompact({ w: 1100, h: 480, touch: false }), true);
});

console.log("Cụm nút cảm ứng quanh N");
const SETS = [["c", "dodge", "block", "skill", "ult"], ["c", "dodge", "block", "skill", "ult", "skill2"], ["c", "dodge", "block", "skill", "ult", "skill2", "interact"], ["c", "dodge", "block", "skill", "ult", "interact"]];
const PAD = 12;
// tâm nút theo px từ góc phải dưới (x sang trái, y lên trên) với cỡ u
const place = (arc, u) => Object.fromEntries(Object.entries({ n: { x: 0, y: 0, s: TOUCH_SIZE.n }, ...arc }).map(([k, p]) =>
  [k, { cx: PAD + (TOUCH_SIZE.n / 2) * u + p.x * u, cy: PAD + (TOUCH_SIZE.n / 2) * u + p.y * u, r: (p.s * u) / 2 }]));
t("mỗi bộ nút đều có vị trí và cỡ cho từng nút", () => {
  for (const ids of SETS) {
    const arc = touchArc(ids);
    assert.deepEqual(Object.keys(arc).sort(), [...ids].sort());
    for (const k of ids) assert.ok(arc[k].s > 0 && Number.isFinite(arc[k].x) && Number.isFinite(arc[k].y), k);
  }
});
t("không hai nút nào chồng nhau (chừa ít nhất 0,08 u)", () => {
  for (const ids of SETS) {
    const P = place(touchArc(ids), 50), keys = Object.keys(P);
    for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
      const a = P[keys[i]], b = P[keys[j]], gap = Math.hypot(a.cx - b.cx, a.cy - b.cy) - a.r - b.r;
      assert.ok(gap >= 0.08 * 50, `${keys[i]} – ${keys[j]} cách ${gap.toFixed(1)} px (bộ ${ids.join(",")})`);
    }
  }
});
t("không nút nào lòi ra mép phải hay mép dưới", () => {
  for (const ids of SETS) for (const [k, p] of Object.entries(place(touchArc(ids), 50))) {
    assert.ok(p.cx - p.r >= 0 && p.cy - p.r >= 0, `${k} ra ngoài màn (${p.cx.toFixed(0)}, ${p.cy.toFixed(0)}, r ${p.r})`);
  }
});
t("cả cụm vừa trong 4,4 u × 4,4 u tính từ góc (điện thoại ngang 844 × 390: chừa nửa trái cho cần điều khiển)", () => {
  for (const ids of SETS) for (const [k, p] of Object.entries(place(touchArc(ids), 50))) {
    assert.ok(p.cx + p.r <= PAD + 4.4 * 50 && p.cy + p.r <= PAD + 4.4 * 50, `${k} vượt khung cụm`);
  }
});
t("N to nhất, C to hơn Né / Đỡ, kỹ năng không nhỏ hơn 1 u (ngón cái chạm được)", () => {
  assert.ok(TOUCH_SIZE.n > TOUCH_SIZE.c && TOUCH_SIZE.c > TOUCH_SIZE.dodge);
  for (const k of ["skill", "ult", "skill2"]) assert.ok(TOUCH_SIZE[k] >= 1, k);
});
t("cỡ nút u theo chiều cao màn, kẹp 40–62 px", () => {
  assert.equal(touchUnit(390), Math.round(390 * 0.125));
  assert.equal(touchUnit(300), 40);
  assert.equal(touchUnit(1024), 62);
});

console.log("Tin nhắn HUD gọn");
t("chỉ hiện tin mới nhất còn trong 5 s", () => {
  const msgs = [{ text: "cũ", T: 8, t: 1 }, { text: "mới", T: 8, t: 0.5 }];
  assert.equal(compactMsg(msgs).m.text, "mới");
});
t("tin quá 5 s thì tắt dù đời tin của director còn dài", () => {
  assert.equal(compactMsg([{ text: "x", T: 12, t: MSG_SHOW + 0.01 }]), null);
  assert.equal(compactMsg([]), null);
});
t("tin mới nhất đã tắt thì không lôi tin cũ hơn ra", () => {
  assert.equal(compactMsg([{ text: "a", T: 9, t: 2 }, { text: "b", T: 9, t: 6 }]), null);
});
t("mờ dần nửa giây cuối", () => {
  assert.equal(compactMsg([{ text: "a", T: 9, t: 1 }]).alpha, 1);
  assert.ok(Math.abs(compactMsg([{ text: "a", T: 9, t: MSG_SHOW - 0.25 }]).alpha - 0.5) < 1e-9);
  assert.ok(Math.abs(compactMsg([{ text: "a", T: 3, t: 2.75 }]).alpha - 0.5) < 1e-9, "tin ngắn hơn 5 s mờ theo đời của nó");
});
t("sổ tin: mỗi tin ghi một lần, giữ 30 tin mới nhất, chữ phím đổi theo fmt", () => {
  const seen = new WeakSet(), log = [];
  const a = { text: "Bấm {tpc}", kind: "tip" }, b = { text: "b", kind: "info" };
  logMsgs(log, [a], seen, (s) => s.replace("{tpc}", "F"));
  logMsgs(log, [a, b], seen, (s) => s);
  assert.deepEqual(log.map((x) => x.text), ["Bấm F", "b"]);
  assert.equal(log[0].kind, "tip");
  for (let i = 0; i < 40; i++) logMsgs(log, [{ text: "m" + i, kind: "info" }], seen, (s) => s);
  assert.equal(log.length, 30); assert.equal(log[29].text, "m39");
});

console.log("Hub: thanh 5 mục");
t("đúng 5 mục theo thứ tự đã chốt", () => assert.deepEqual(NAV.map((g) => g.name), ["Xuất trận", "Tự do", "Sử quán", "Quân doanh", "Hồ sơ"]));
t("Quân doanh gom 6 mục con, mỗi thẻ cũ thuộc đúng một mục", () => {
  assert.deepEqual(NAV.find((g) => g.id === "quandoanh").tabs, ["huanluyen", "votruong", "truongsoai", "loren", "luyenbinh", "doanhtrai"]);
  const all = NAV.flatMap((g) => g.tabs);
  assert.equal(new Set(all).size, all.length);
  for (const k of ["xuattran", "huanluyen", "suquan", "votruong", "truongsoai", "loren", "luyenbinh", "doanhtrai", "hoso", "tudo"]) assert.ok(all.includes(k), k);
  for (const k of NAV.find((g) => g.id === "quandoanh").tabs) assert.ok(SUBTABS[k], "tên mục con " + k);
});
t("groupOf: thẻ con về mục cha, thẻ lạ về Xuất trận", () => {
  assert.equal(groupOf("loren"), "quandoanh"); assert.equal(groupOf("suquan"), "suquan"); assert.equal(groupOf("???"), "xuattran");
});
t("số báo: Sử quán = thẻ chưa đọc; Quân doanh = điểm kỹ năng, không có thì 'mới' khi chưa huấn luyện", () => {
  assert.equal(navBadge("suquan", { unread: 3 }), "3");
  assert.equal(navBadge("suquan", { unread: 0 }), "");
  assert.equal(navBadge("quandoanh", { points: 2, tutorialNew: true }), "2");
  assert.equal(navBadge("quandoanh", { points: 0, tutorialNew: true }), "mới");
  assert.equal(navBadge("quandoanh", { points: 0, tutorialNew: false }), "");
  assert.equal(navBadge("hoso", {}), "");
});

console.log(`\n${pass} đạt, ${fail} trượt`);
process.exit(fail ? 1 : 0);
