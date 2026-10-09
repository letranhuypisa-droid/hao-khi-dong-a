// ui/nozoom.js — chặn trình duyệt điện thoại tự phóng to trang khi đang đánh (đợt 17).
//
// Safari trên iPhone (và các trình duyệt nhúng của Zalo, Facebook… dùng cùng lõi) bỏ qua `user-scalable=no` của thẻ viewport,
// và nút cảm ứng trong trận nghe `pointerdown` — preventDefault của pointer event KHÔNG ngăn được cử chỉ "chạm đúp để phóng
// to". Bấm đòn N liên tục là chạm đúp, nên trang cứ tự zoom. Cách chắc ăn là chặn ở tầng touch:
//   - trong khung trận (.stage): chạm kết thúc trong DOUBLE_TAP_MS sau lần chạm trước thì preventDefault `touchend` — hết
//     phóng to chạm đúp; nút trong trận đã chạy theo pointerdown / pointerup (bắn trước touchend) nên vẫn ăn đòn, chỉ mất
//     "click" giả của lần chạm thứ hai (lớp tạm dừng bấm đúp nhanh thì lần hai không tính);
//   - trong khung trận chặn luôn cử chỉ chụm (gesturestart / gesturechange, chỉ iOS có): hai ngón cái trên cần điều khiển
//     và nút đòn dễ thành "chụm hai ngón" làm trang phóng to;
//   - dblclick ngoài ô nhập chữ: không làm gì.
// Ngoài trận (hub, sảnh) dùng CSS `touch-action: manipulation` trên html (css/game.css) — hết chạm đúp phóng to mà vẫn cuộn được.
// Ô nhập chữ được miễn (chạm đúp để chọn chữ). doc: tham số để kiểm thử trong Node (tests/nozoom.test.mjs).
export const DOUBLE_TAP_MS = 350;

const within = (t, sel) => !!(t && typeof t.closest === "function" && t.closest(sel));
const EDITABLE = "input, textarea, select, [contenteditable]";

export function installNoZoom(doc = document) {
  let last = -Infinity;
  const onEnd = (e) => {
    if (!within(e.target, ".stage")) return;
    const now = e.timeStamp;
    if (now - last < DOUBLE_TAP_MS && !within(e.target, EDITABLE)) e.preventDefault();
    last = now;
  };
  const onGesture = (e) => { if (within(e.target, ".stage")) e.preventDefault(); };
  const onDbl = (e) => { if (!within(e.target, EDITABLE)) e.preventDefault(); };
  const opt = { passive: false };
  doc.addEventListener("touchend", onEnd, opt);
  doc.addEventListener("gesturestart", onGesture, opt);
  doc.addEventListener("gesturechange", onGesture, opt);
  doc.addEventListener("dblclick", onDbl, opt);
  return () => {
    doc.removeEventListener("touchend", onEnd, opt);
    doc.removeEventListener("gesturestart", onGesture, opt);
    doc.removeEventListener("gesturechange", onGesture, opt);
    doc.removeEventListener("dblclick", onDbl, opt);
  };
}
