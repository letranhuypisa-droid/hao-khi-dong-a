// battle/waypoint.js — hình học của nhãn chỉ đường (hud.js frame). Thuần: không DOM, không three; tests/waypoint.test.mjs.
//
// Vào: W, H kích cỡ màn hình (px); fwd, rgt thành phần của vector từ tướng tới mục tiêu theo hướng nhìn của camera (m; fwd > 0 là
// phía trước, rgt > 0 là bên phải); p điểm mục tiêu chiếu lên màn hình ({x, y}) hoặc null khi nó ở sau lưng; half nửa bề ngang nhãn (px);
// avoid các khung HUD cần tránh [{ l, r, t, b, side: "l" | "r" }] (cột trái, bản đồ nhỏ).
// Ra: { x, y, mode, rot }. mode "on": nhãn nổi ngay trên mục tiêu. mode "edge": mục tiêu ở sau lưng, ngoài khung hoặc sát khung HUD khác
// nên nhãn ra rìa màn hình theo hướng tới mục tiêu; rot là góc (độ, CSS clockwise) để xoay mũi tên tam giác vốn chỉ xuống.

// Vùng an toàn cho tâm nhãn: lề ngang = max(90, nửa bề rộng nhãn + 8) để nhãn dài ("A3 · Cổng bắc Hàm Tử quan" ~230 px) không tràn mép;
// cách mép trên 105; cách mép dưới 200 (hộp nhãn cao ~46 px nên đáy hộp còn cách hàng ô kỹ năng, đỉnh ở ~152 px tính từ đáy màn).
const SAFE = { side: 90, top: 105, bottom: 200 };

export function placeWaypoint({ W, H, fwd, rgt, p = null, half = 90, avoid = [] }) {
  const m = Math.max(SAFE.side, half + 8);
  const hit = (cx, cy, up, down) => avoid.find((r) => cx + half > r.l && cx - half < r.r && cy + down > r.t && cy - up < r.b);
  if (p && fwd > 0 && p.x > m && p.x < W - m && p.y > 150 && p.y < H - SAFE.bottom && !hit(p.x, p.y, 62, 14)) {
    return { x: p.x, y: p.y, mode: "on", rot: 0 };
  }
  let ux = rgt, uy = -fwd;                                                  // hướng tới mục tiêu trên màn hình (lên = phía trước)
  const L = Math.hypot(ux, uy) || 1; ux /= L; uy /= L;
  const hw = W / 2 - m, hh = (H - SAFE.bottom - SAFE.top) / 2;
  const s = Math.min(ux ? hw / Math.abs(ux) : 1e9, uy ? hh / Math.abs(uy) : 1e9);
  let x = W / 2 + ux * s, y = SAFE.top + hh + uy * s;
  const rot = Math.atan2(-ux, uy) * 180 / Math.PI;
  for (let i = 0, r; i < 3 && (r = hit(x, y, 26, 26)); i++) {               // tránh cột trái / bản đồ nhỏ: dịch ngang trước, còn kẹt thì xuống dưới
    x = r.side === "l" ? r.r + 10 + half : r.l - 10 - half;
    x = Math.max(half + 8, Math.min(W - half - 8, x));
    if (hit(x, y, 26, 26)) y = r.b + 34;
  }
  if (hit(x, y, 26, 26)) y = Math.max(...avoid.map((r) => r.b)) + 34;      // vẫn kẹt (màn quá hẹp): đặt dưới mọi khung
  return { x, y, mode: "edge", rot };
}
