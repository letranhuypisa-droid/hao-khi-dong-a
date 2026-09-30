// ui/guide.js — bảng hướng dẫn có icon: đòn đánh, phòng thủ, kỹ năng, chỉ huy, các khái niệm của trận.
// Dùng ở thẻ Huấn luyện (Doanh trại), bảng tạm dừng, màn Huấn luyện. Chỉ dựng chuỗi HTML.
// hero (đợt 9): id tướng ("H35" mặc định — bảng như cũ, "H31" đại kiếm + Hịch Tướng Sĩ + Binh Thư + Bạch Đằng Quyết Chiến).

import { MOVE_INFO, ICON, moveInfoOf } from "../data/moves-info.js";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const kbd = (s) => s.split(" · ").map((k) => `<kbd>${esc(k)}</kbd>`).join("");

// dev: 0 bàn phím, 1 cảm ứng, 2 tay cầm
export function card(id, dev = 0, extraKey = "", info = MOVE_INFO) {
  const m = info[id];
  const key = m.keys ? kbd(m.keys[dev] || m.keys[0]) : m.seq ? kbd(m.seq) : extraKey ? kbd(extraKey) : "";
  return `<div class="gcard"><img src="${ICON(m.icon)}" alt=""><div><b>${esc(m.name)}</b>${key}<small>${esc(m.text)}</small></div></div>`;
}

// Khái niệm của trận (không có phím riêng): icon mượn của lệnh gần nghĩa nhất.
const CONCEPTS = [
  { icon: "tpc", name: "Hào Khí", text: "Thanh trên đỉnh màn. Tăng khi chiếm Cứ Điểm, hạ sĩ quan, làm nhiệm vụ, Kế Sách; giảm khi mất đồn, phải Gượng dậy. Đủ 100 thì kích Tổng Phản Công." },
  { icon: "giuvung", name: "Cứ Điểm", text: "Đồn, doanh trại có vòng tròn dưới đất. Hạ hết quân đồn trú và sĩ quan trấn thủ, rồi đứng trong vòng cho tới khi chiếm xong." },
  { icon: "tiencong", name: "Mặt trận", text: "Hai tuyến A (bến trên) và B (bến dưới) tự đánh nhau kể cả khi bạn ở xa. Bản đồ nhỏ góc phải cho biết quân hai bên và Sĩ Khí." },
  { icon: "dq", name: "Vỡ Thế", text: "Sĩ quan có thanh Phá Thế (vạch vàng). Đánh liên tục cho cạn: hắn loạng choạng 3,5 s, nhận thêm 50% sát thương, mở Đòn Quyết." },
  { icon: "ct", name: "Đòn viền đỏ", text: "Vòng đỏ dưới chân sĩ quan báo trước 0,6 s. Không đỡ được: né ra, hoặc bấm Đỡ đúng lúc để Phản đòn." },
];

export function movesGuideHTML({ dev = 0, compact = false, hero = "H35" } = {}) {
  const I = moveInfoOf(hero), wc01 = I !== MOVE_INFO, c = (k) => card(k, dev, "", I);
  const mv = dev === 1 ? "cần gạt trái" : dev === 2 ? "cần trái" : "W A S D";
  const cam = dev === 1 ? "vuốt nửa phải màn hình" : dev === 2 ? "cần phải" : "chuột (bấm vào màn để khóa chuột) · ← →";
  return `<div class="guide${compact ? " compact" : ""}">
    <h4>Di chuyển</h4>
    <div class="gcards">
      <div class="gcard"><img src="${ICON("dash")}" alt=""><div><b>Chạy</b>${kbd(mv)}<small>Đòn đánh tự xoay về địch gần nhất theo hướng bạn đang đẩy.</small></div></div>
      <div class="gcard"><img src="${ICON("lock")}" alt=""><div><b>Camera</b>${kbd(cam)}<small>Đứng yên một lúc thì camera tự xoay theo hướng chạy.</small></div></div>
      ${c("lock")}
    </div>
    <h4>Đòn đánh · ${wc01 ? "đại kiếm" : "song đao"}</h4>
    <div class="gcards">${["N", "C1", "C2", "C3", "C4", "C5", "C6", "D", "DQ", "CT"].map(c).join("")}</div>
    <h4>Phòng thủ và kỹ năng</h4>
    <div class="gcards">${["dodge", "block", "skill", ...(I.skill2 ? ["skill2"] : []), "ult", "tpc"].map(c).join("")}</div>
    <h4>Chỉ huy</h4>
    <div class="gcards">${["cmd", "tiencong", "giuvung", "theota", "tiepvien", "kesach"].map((k) => card(k, dev)).join("")}</div>
    ${compact ? "" : `<h4>Trong trận</h4><div class="gcards">${CONCEPTS.map((c) => `<div class="gcard"><img src="${ICON(c.icon)}" alt=""><div><b>${c.name}</b><small>${c.text}</small></div></div>`).join("")}</div>`}
    <p class="small">${dev === 2 ? "" : wc01 ? "Tay cầm: X đòn N · Y đòn C (giữ để tụ lực) · A né · RB đỡ · LB Hịch Tướng Sĩ · D-pad trái Binh Thư · B Tuyệt Kỹ · LT giữ = Mệnh Lệnh · D-pad lên Tổng Phản Công · D-pad phải Kế Sách. " : "Tay cầm: X đòn N · Y đòn C · A né · RB đỡ · LB Phá Trận · B Tuyệt Kỹ · LT giữ = Mệnh Lệnh · D-pad lên Tổng Phản Công · D-pad phải Kế Sách. "}M bản đồ lớn · Esc tạm dừng.</p>
  </div>`;
}
