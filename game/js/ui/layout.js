// ui/layout.js — phần thuần của giao diện gọn (đợt 13): khi nào HUD trận dùng bố cục gọn, cụm nút cảm ứng quanh nút N,
// tin nhắn của HUD gọn (một tin, tự tắt sau 5 s) và sổ tin cho bảng tạm dừng, nhóm mục của hub (thanh 5 mục).
// File này KHÔNG import gì (kiểm trong Node: tests/ui-layout.test.mjs).

// ---- HUD gọn ------------------------------------------------------------------------------------------------------------
// Cảm ứng luôn gọn; chuột + bàn phím chỉ gọn khi khung hẹp (≤ 900 px, khung trình duyệt của app thường 600–910 px) hoặc
// thấp (≤ 500 px). Máy tính màn rộng giữ bố cục cũ.
export const COMPACT_W = 900, COMPACT_H = 500;
export const isCompact = ({ w, h, touch }) => !!touch || w <= COMPACT_W || h <= COMPACT_H;

// ---- cụm nút cảm ứng ------------------------------------------------------------------------------------------------------
// Cỡ nút theo đơn vị u (CSS --u, đặt theo chiều cao màn: touchUnit). N ở góc phải dưới; vòng 1 (C, Đỡ, Né) ôm sát N, vòng 2
// (kỹ năng, kỹ năng 2, Tuyệt Kỹ, Tương tác) ở ngoài — nút hay bấm (C, kỹ năng) nằm ngang tầm N cho ngón cái trượt sang.
export const TOUCH_SIZE = { n: 1.6, c: 1.2, dodge: 1.05, block: 1.05, skill: 1, skill2: 1, ult: 1, interact: 1.1 };
const RING1 = { r: 1.6, at: { c: 180, block: 135, dodge: 90 } };
const RING2 = { r: 2.85, order: ["skill", "skill2", "ult", "interact"], span: [184, 100] };
// Tâm từng nút lệch so với tâm N, đơn vị u: x sang trái, y lên trên; s đường kính (u). ids: các nút có trong trận (không gồm n).
export function touchArc(ids) {
  const out = {}, rad = (a) => (a * Math.PI) / 180;
  const at = (id, r, deg) => { out[id] = { x: -r * Math.cos(rad(deg)), y: r * Math.sin(rad(deg)), s: TOUCH_SIZE[id] ?? 1 }; };
  for (const id of ids) if (RING1.at[id] != null) at(id, RING1.r, RING1.at[id]);
  const outer = RING2.order.filter((id) => ids.includes(id)), [a0, a1] = RING2.span;
  outer.forEach((id, i) => at(id, RING2.r, outer.length === 1 ? 160 : outer.length === 2 ? [170, 118][i] : a0 + ((a1 - a0) * i) / (outer.length - 1)));
  return out;
}
// u (px) theo chiều cao màn: 12,5% chiều cao, kẹp 40–62 px (điện thoại ngang 390 px → 49 px; máy tính bảng → 62 px).
export const touchUnit = (h) => Math.max(40, Math.min(62, Math.round(h * 0.125)));

// ---- tin nhắn HUD gọn ------------------------------------------------------------------------------------------------------
// director.msgs: [{ text, T (đời tin, s), t (tuổi, s), kind }]. HUD gọn chỉ hiện tin MỚI NHẤT khi nó chưa quá MSG_SHOW giây
// (director có thể giữ tin 7–12 s), mờ dần nửa giây cuối. Tin mới nhất đã tắt thì thôi, không lôi tin cũ ra.
export const MSG_SHOW = 5;
export function compactMsg(msgs, show = MSG_SHOW) {
  const m = msgs?.[msgs.length - 1];
  if (!m) return null;
  const end = Math.min(m.T ?? show, show);
  if (m.t >= end) return null;
  return { m, alpha: Math.max(0, Math.min(1, (end - m.t) * 2)) };
}
// Sổ tin (đọc lại ở bảng tạm dừng): ghi mỗi tin một lần (seen: WeakSet các object tin), chữ phím đổi lúc ghi, giữ max tin.
export function logMsgs(log, msgs, seen, fmt = (s) => s, max = 30) {
  for (const m of msgs || []) {
    if (seen.has(m)) continue;
    seen.add(m); log.push({ text: fmt(m.text), kind: m.kind || "info" });
  }
  if (log.length > max) log.splice(0, log.length - max);
  return log;
}

// ---- hub: thanh 5 mục ---------------------------------------------------------------------------------------------------
// Thẻ cũ (main.js tab) giữ nguyên tên; mục Quân doanh gom 6 thẻ thành hàng mục con.
export const NAV = [
  { id: "xuattran", name: "Xuất trận", tabs: ["xuattran"] },
  { id: "tudo", name: "Tự do", tabs: ["tudo"] },
  { id: "suquan", name: "Sử quán", tabs: ["suquan"] },
  { id: "quandoanh", name: "Quân doanh", tabs: ["huanluyen", "votruong", "truongsoai", "loren", "luyenbinh", "doanhtrai"] },
  { id: "hoso", name: "Hồ sơ", tabs: ["hoso"] },
];
export const SUBTABS = { huanluyen: "Huấn luyện", votruong: "Võ trường", truongsoai: "Trướng soái", loren: "Lò rèn", luyenbinh: "Luyện binh", doanhtrai: "Doanh trại" };
export const groupOf = (tab) => (NAV.find((g) => g.tabs.includes(tab)) || NAV[0]).id;
// Chữ trên số báo của một mục: Sử quán = thẻ chưa đọc; Quân doanh = điểm kỹ năng chưa tiêu, không có thì "mới" khi chưa
// huấn luyện; Tự do = info.tudo (vd "mới" khi chưa có lính).
export function navBadge(group, info = {}) {
  if (group === "suquan") return info.unread > 0 ? String(info.unread) : "";
  if (group === "quandoanh") return info.points > 0 ? String(info.points) : info.tutorialNew ? "mới" : "";
  if (group === "tudo") return info.tudo || "";
  return "";
}
