// battle/hitshape.js — hình học nón chém của tướng (shape "cone" của bảng đòn; hero.js applyHits). THUẦN: không three, không rng; tests/hitshape.test.mjs.
//
// Người bị chém là một vòng tròn bán kính rad quanh điểm đứng (tuning.js hitRadius: bộ binh 0,4 m, kỵ binh 1 m), không phải một điểm. Chỉ LÍNH dùng
// phần nới này: sĩ quan và cổng giữ luật cũ — hero.js gọi inCone(…, reach + bán kính, arc, 0), bán kính chỉ cộng vào tầm. Luật cũ (trước đợt 15b) chỉ xét góc của TÂM người so với nửa độ mở nón, nên cung kỵ đứng lệch mép nón — thân ngựa nằm trong lưỡi chém —
// vẫn bị chém xuyên. Nay nửa góc nới thêm atan2(rad, d): góc mà nửa bề ngang thân chiếm khi nhìn từ tướng (gần bằng asin(rad / d), nhưng không NaN khi
// d < rad). rad 0 → đúng từng bit luật cũ.
//   dx, dz  từ tướng tới người bị chém (m)        fx, fz  hướng mặt tướng (véc-tơ đơn vị)
//   reach   tầm đòn (m)                            arcDeg  độ mở nón (độ)            rad  bán kính thân (m)
// → true nếu trúng: ngoài tầm + rad thì trượt; sát tướng (< CONE_NEAR) thì trúng mọi hướng như cũ; nửa góc đã nới ≥ 180° thì trúng mọi hướng trong tầm.

export const CONE_NEAR = 0.8;

export function inCone(dx, dz, fx, fz, reach, arcDeg, rad = 0) {
  const d = Math.hypot(dx, dz);
  if (d > reach + rad) return false;
  if (d < CONE_NEAR) return true;
  const half = (arcDeg / 2) * Math.PI / 180 + Math.atan2(rad, d);
  if (half >= Math.PI) return true;                         // cos không còn giảm sau 180°: nón đã phủ kín vòng
  return (dx * fx + dz * fz) / d >= Math.cos(half);
}
