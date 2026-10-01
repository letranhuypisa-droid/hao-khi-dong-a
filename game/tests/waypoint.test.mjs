// tests/waypoint.test.mjs — hình học nhãn chỉ đường (battle/waypoint.js): nổi trên mục tiêu khi nó nằm trong màn hình, không thì ra
// rìa màn hình theo hướng tới mục tiêu (mũi tên quay đúng hướng) và tránh thẻ nhiệm vụ / bản đồ nhỏ. Chạy trong Node:
//   node hao-khi-viet/game/tests/waypoint.test.mjs
import assert from "node:assert/strict";
import { placeWaypoint } from "../js/battle/waypoint.js";

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log("  ok  " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + (e.stack || e.message)); }
}
const W = 1280, H = 720;
const mod360 = (d) => ((d % 360) + 360) % 360;
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ""} ${a} ≉ ${b} (±${tol})`);
// vùng HUD tại 1280×720: cột trái (thẻ nhiệm vụ + tin) và bản đồ nhỏ + bảng mặt trận
const LEFT = { l: 14, r: 324, t: 10, b: 200, side: "l" }, MAP = { l: 1024, r: 1268, t: 10, b: 232, side: "r" };

console.log("Nhãn chỉ đường: vị trí và hướng");
t("mục tiêu nằm trong màn hình thì nhãn nổi ngay trên mục tiêu (kiểu 'on')", () => {
  const r = placeWaypoint({ W, H, fwd: 60, rgt: 5, p: { x: 640, y: 300 }, avoid: [LEFT, MAP] });
  assert.deepEqual([r.mode, r.x, r.y, r.rot], ["on", 640, 300, 0]);
});
t("mục tiêu ở ngay sau lưng: nhãn xuống giữa cạnh dưới, mũi tên chỉ xuống", () => {
  const r = placeWaypoint({ W, H, fwd: -80, rgt: 0, p: null, avoid: [LEFT, MAP] });
  assert.equal(r.mode, "edge"); near(r.x, W / 2, 1e-6); near(r.y, H - 200, 1e-6);
  near(mod360(r.rot), 0, 1e-6, "mũi tên chỉ xuống");
});
t("mục tiêu ở bên phải (ngang tầm): nhãn ra cạnh phải giữa màn, mũi tên chỉ sang phải", () => {
  const r = placeWaypoint({ W, H, fwd: 0, rgt: 50, p: null });
  near(r.x, W - 98, 1e-6); near(r.y, (105 + H - 200) / 2, 1e-6); near(mod360(r.rot), 270, 1e-6, "chỉ sang phải");
});
t("mục tiêu ở bên trái: cạnh trái, mũi tên chỉ sang trái", () => {
  const r = placeWaypoint({ W, H, fwd: 0, rgt: -50, p: null });
  near(r.x, 98, 1e-6); near(mod360(r.rot), 90, 1e-6, "chỉ sang trái");
});
t("mục tiêu thẳng phía trước nhưng chiếu lên cao hơn vùng an toàn: dính cạnh trên, mũi tên chỉ lên", () => {
  const r = placeWaypoint({ W, H, fwd: 140, rgt: 0, p: { x: 640, y: 60 }, avoid: [] });
  assert.equal(r.mode, "edge"); near(r.x, W / 2, 1e-6); near(r.y, 105, 1e-6); near(mod360(r.rot), 180, 1e-6, "chỉ lên");
});
t("điểm chiếu nằm trong màn hình nhưng trúng thẻ nhiệm vụ: không nổi trên mục tiêu mà ra rìa", () => {
  const r = placeWaypoint({ W, H, fwd: 50, rgt: -30, p: { x: 200, y: 180 }, avoid: [LEFT, MAP] });
  assert.equal(r.mode, "edge");
});
t("điểm chiếu quá sát mép (trong 90 px) cũng ra rìa", () => {
  assert.equal(placeWaypoint({ W, H, fwd: 50, rgt: 0, p: { x: 40, y: 300 } }).mode, "edge");
  assert.equal(placeWaypoint({ W, H, fwd: 50, rgt: 0, p: { x: 640, y: H - 100 } }).mode, "edge");
  assert.equal(placeWaypoint({ W, H, fwd: 50, rgt: 0, p: { x: 640, y: H - 190 } }).mode, "edge", "sát vùng ô kỹ năng");
});

console.log("Nhãn chỉ đường: tránh khung HUD");
t("hướng chếch trái lên mà cột trái rộng: nhãn dịch sang phải, ra khỏi cột trái", () => {
  const wide = { l: 14, r: 480, t: 10, b: 200, side: "l" };
  const r = placeWaypoint({ W, H, fwd: 100, rgt: -100, p: null, half: 90, avoid: [wide, MAP] });
  assert.ok(r.x - 90 >= wide.r || r.y - 26 >= wide.b, `nhãn (${r.x}, ${r.y}) còn đè cột trái`);
  assert.equal(r.mode, "edge");
});
t("hướng chếch phải lên mà bản đồ nhỏ rộng: nhãn dịch sang trái, ra khỏi bản đồ", () => {
  const wide = { l: 700, r: 1268, t: 10, b: 232, side: "r" };
  const r = placeWaypoint({ W, H, fwd: 100, rgt: 100, p: null, half: 90, avoid: [LEFT, wide] });
  assert.ok(r.x + 90 <= wide.l || r.y - 26 >= wide.b, `nhãn (${r.x}, ${r.y}) còn đè bản đồ nhỏ`);
});
t("màn hẹp 600 px: nhãn không đè thẻ nhiệm vụ ở cột trái dù mục tiêu thẳng phía trước", () => {
  const left = { l: 14, r: 250, t: 78, b: 190, side: "l" }, map = { l: 417, r: 588, t: 10, b: 137, side: "r" };
  const r = placeWaypoint({ W: 600, H: 667, fwd: 120, rgt: 0, p: { x: 300, y: 70 }, half: 90, avoid: [left, map] });
  const overlaps = (a) => r.x + 90 > a.l && r.x - 90 < a.r && r.y + 26 > a.t && r.y - 26 < a.b;
  assert.ok(!overlaps(left) && !overlaps(map), `nhãn (${r.x}, ${r.y}) đè khung HUD`);
});
t("không bao giờ ra ngoài màn hình, kể cả khi tránh khung", () => {
  for (const [f, rg] of [[100, -100], [100, 100], [-100, -100], [-100, 100], [0, 100], [0, -100], [100, 0], [-100, 0]]) {
    const r = placeWaypoint({ W, H, fwd: f, rgt: rg, p: null, half: 90, avoid: [LEFT, MAP] });
    assert.ok(r.x >= 98 - 1e-6 && r.x <= W - 98 + 1e-6 && r.y >= 100 && r.y <= H, `(${f}, ${rg}) → (${r.x}, ${r.y})`);
  }
});
t("nhãn rộng (mục tiêu dài như 'A3 · Cổng bắc Hàm Tử quan', 230 px): cả hộp nằm trọn trong màn hình ở mọi hướng", () => {
  const half = 115;
  for (const [f, rg] of [[100, -100], [100, 100], [-100, -100], [-100, 100], [0, 100], [0, -100], [100, 0], [-100, 0], [1, 100], [1, -100]]) {
    for (const avoid of [[], [LEFT, MAP]]) {
      const r = placeWaypoint({ W, H, fwd: f, rgt: rg, p: null, half, avoid });
      assert.ok(r.x - half >= 0 && r.x + half <= W, `(${f}, ${rg}) → x ${r.x}: hộp [${r.x - half}, ${r.x + half}] tràn màn hình`);
    }
  }
});
t("nhãn rộng mà điểm chiếu còn gần mép (trong nửa bề rộng nhãn) thì ra rìa chứ không nổi trên mục tiêu rồi bị cắt", () => {
  assert.equal(placeWaypoint({ W, H, fwd: 50, rgt: 0, p: { x: W - 100, y: 300 }, half: 115 }).mode, "edge");
  assert.equal(placeWaypoint({ W, H, fwd: 50, rgt: 0, p: { x: 100, y: 300 }, half: 115 }).mode, "edge");
  assert.equal(placeWaypoint({ W, H, fwd: 50, rgt: 0, p: { x: W - 100, y: 300 }, half: 60 }).mode, "on", "nhãn ngắn thì còn vừa");
});
t("hộp nhãn ở rìa dưới không chạm hàng ô kỹ năng (đỉnh ô cách đáy màn ~152 px)", () => {
  const r = placeWaypoint({ W, H, fwd: -100, rgt: 100, p: null, half: 90 });
  assert.ok(r.y + 26 <= H - 152 - 8, `đáy hộp ${r.y + 26} chạm ô kỹ năng`);
});
t("mục tiêu ngay trên đầu tướng (fwd = rgt = 0): không chia cho 0", () => {
  const r = placeWaypoint({ W, H, fwd: 0, rgt: 0, p: null });
  assert.ok(Number.isFinite(r.x) && Number.isFinite(r.y) && Number.isFinite(r.rot));
});

console.log(`\n${pass} đạt, ${fail} trượt`);
process.exit(fail ? 1 : 0);
