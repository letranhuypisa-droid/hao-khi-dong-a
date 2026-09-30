// data/moves-info.js — tên, icon, phím và lời giải thích của từng đòn, kỹ năng, lệnh (đợt 7).
// Dùng chung cho HUD (thanh kỹ năng, nút cảm ứng, vòng Mệnh Lệnh), màn Huấn luyện và bảng tra cứu ở Doanh trại.
// Icon: assets/icons/<icon>.webp (GPT Image 2 qua Higgsfield, xem assets/SOURCES.md). Tên đòn C là Hư cấu của game.
// File này chỉ import moves-wc01.js (thuần, không import gì) nên chạy được trong Node để kiểm thử.
//
// Theo tướng (đợt 9, lõi nhiều tướng): moveInfoOf(def) — H35 (WC03) dùng MOVE_INFO như cũ; H31 (WC01) = MOVE_INFO đè bằng
// MOVE_INFO_WC01 (tên đòn đại kiếm, Hịch Tướng Sĩ ở ô "skill", Binh Thư ở ô "skill2", Bạch Đằng Quyết Chiến ở "ult").

import { MOVE_INFO_WC01 } from "./moves-wc01.js";

export const ICON = (id) => `./assets/icons/${id}.webp`;

// keys: [bàn phím, cảm ứng, tay cầm]
export const MOVE_INFO = {
  N:  { icon: "n",  name: "Song đao liên trảm", keys: ["J · chuột trái", "nút N", "X"],
        text: "Chuỗi 6 nhát N1–N6 khi bấm liên tiếp. N6 xoay một vòng đẩy lùi mọi kẻ quanh mình." },
  C1: { icon: "c1", name: "Phá thế", seq: "C", text: "Đâm mạnh phá khiên, lính đỡ không được; đẩy lùi xa." },
  C2: { icon: "c2", name: "Hất tung", seq: "N → C", text: "Chém hất địch lên không, rơi xuống nằm một lúc." },
  C3: { icon: "c3", name: "Lốc đao", seq: "N N → C", text: "Xoay 5 vòng chém quanh mình, trúng nhiều nhát." },
  C4: { icon: "c4", name: "Chấn địa", seq: "N N N → C", text: "Bổ song đao xuống đất, sóng chấn tròn 5 m đẩy văng." },
  C5: { icon: "c5", name: "Lao xuyên trận", seq: "N N N N → C", text: "Lao thẳng 8 m chém xuyên hàng lính. Mở ở cấp 5." },
  C6: { icon: "c6", name: "Bão đao", seq: "N N N N N → C", text: "Nổ vòng chém 6 m hất tung tất cả. Mở ở cấp 10." },
  D:  { icon: "dash", name: "Lướt chém", seq: "Né → N / C", text: "Vừa né xong bấm N (Lướt N) hoặc C (Lướt C): lao tới chém." },
  DQ: { icon: "dq", name: "Đòn Quyết", seq: "C cạnh kẻ Vỡ Thế", text: "Sĩ quan cạn thanh Phá Thế thì Vỡ Thế: bấm C cạnh hắn để kết liễu, chắc chắn chí mạng." },
  CT: { icon: "ct", name: "Phản đòn", seq: "Đỡ đúng lúc", text: "Bấm Đỡ đúng lúc đòn viền đỏ sắp trúng: gạt đòn và chém trả." },
  dodge: { icon: "dodge", name: "Né", keys: ["Space", "nút Né", "A"], text: "Lộn tránh, bất tử 0,25 s. Né 2 lần liền thì phải nghỉ chốc lát." },
  block: { icon: "block", name: "Đỡ", keys: ["Shift · L (giữ)", "nút Đỡ (giữ)", "RB"], text: "Giữ để đỡ đòn trước mặt. Đòn viền đỏ phá được thế đỡ." },
  skill: { icon: "skill", name: "Phá Trận", keys: ["E", "nút Phá Trận", "LB"], text: "3 lần lao 18 m trong 6 s, làm choáng lính trên đường. Hồi 20 s." },
  ult: { icon: "ult", name: "Bóp Nát Quân Thù", keys: ["R", "nút Tuyệt Kỹ", "B"], text: "Tốn một vạch Khí Lực: 10 s bất tử, 24 nhát chém quanh mình, xong cắm cờ tăng Công quân ta." },
  tpc: { icon: "tpc", name: "Tổng Phản Công", keys: ["F", "nút Phản Công", "D-pad lên"], text: "Hào Khí đủ 100: cả hai mặt trận xông lên 25 s, tướng được một Tuyệt Kỹ Hào Khí." },
  cmd: { icon: "cmd", name: "Mệnh Lệnh", keys: ["Tab (giữ) + 1–4", "nút Lệnh", "LT (giữ) + D-pad"], text: "Mở vòng lệnh (trận chậm lại ×0,2), ra lệnh cho mặt trận; Z đổi mặt trận." },
  tiencong: { icon: "tiencong", name: "Tiến công", text: "Mặt trận đánh mạnh hơn 20 s (lực ×1,15)." },
  giuvung: { icon: "giuvung", name: "Giữ vững", text: "Mặt trận giữ tuyến 20 s, tổn thất giảm 20%." },
  theota: { icon: "theota", name: "Theo ta", text: "Tối đa 30 quân tách khỏi mặt trận đi theo tướng; bấm lại để trả về." },
  tiepvien: { icon: "tiepvien", name: "Gọi tiếp viện", text: "300 quân tới sau 20 s. Có hạn lượt: chiếm doanh trại được thêm lượt." },
  kesach: { icon: "kesach", name: "Kế Sách", keys: ["G", "nút Kế Sách", "D-pad phải"], text: "Làm đủ điều kiện thì Kế Sách Sẵn sàng: bấm để thi hành, được nhiều Hào Khí." },
  lock: { icon: "lock", name: "Khóa mục tiêu", keys: ["Q · chuột giữa", "nút Khóa", "RT"], text: "Khóa sĩ quan gần nhất: camera và đòn đánh bám theo hắn." },
};

// Bảng tên đòn / kỹ năng theo tướng (def: HEROES[id] hoặc id). Tướng WC01 thiếu mục nào thì lấy mục chung của MOVE_INFO.
const BY_CLS = { WC03: MOVE_INFO, WC01: { ...MOVE_INFO, ...MOVE_INFO_WC01 } };
export function moveInfoOf(def) {
  const cls = typeof def === "string" ? ({ H31: "WC01", H34: "WC01" }[def] || "WC03") : (def?.moves || def?.cls || "WC03");
  return BY_CLS[cls] || MOVE_INFO;
}

// Đòn C sẽ ra nếu bấm C ngay bây giờ (HUD hiện icon đòn kế). hero: Hero; cKey: hàm chọn C theo cấp đã mở. hero.F (cờ đòn,
// data/heroes.js moveFlags): chainN = đòn N nối tiếp được — H35 đúng như luật cũ "N mà không phải N6".
export function nextHeavy(hero) {
  if (hero.findBroken?.()) return "DQ";
  if (hero.postDodge > 0) return "D";
  const inChain = (hero.state === "attack" && (hero.F ? !!hero.F[hero.move]?.chainN : hero.move?.[0] === "N" && hero.move !== "N6")) || hero.chainGrace > 0;
  return hero.cKey ? hero.cKey(inChain ? hero.chain + 1 : 1) : "C1";
}
