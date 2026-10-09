// data/glossary.js — thuật ngữ của trận, MỘT nguồn (đợt 11): câu dài cho thẻ "Trong trận" ở Doanh trại (ui/guide.js), câu ngắn cho gợi ý lần
// đầu giữa trận (battle/hints.js). Con số lấy từ tuning.js, không gõ tay, nên đổi cân bằng thì chữ đổi theo (tests/hints.test.mjs kiểm).
// THUẦN (chỉ import tuning.js). `long` là chữ thường, không có {token} phím (thẻ bảng đòn không đổi chữ phím); `short` có {c}, {block}… cho ctx.fmt.
//
// Ba chữ dễ lẫn: "Phá Thế" = thanh vàng dưới tên sĩ quan (đầy → Vỡ Thế → Đòn Quyết); "Phá Trận" = kỹ năng E của Trần Quốc Toản;
// "Phá khiên" = tên đòn C1 (trước đợt 11 gọi "Phá thế", trùng với thanh). Xem moves-info.js.

import { HERO, HAO_KHI, SIM, DEFENSE, DIFFICULTY, BROKEN_SEC, BROKEN_MULT, KITS, AI } from "./tuning.js";

const vn = (x) => String(x).replace(".", ",");
const pct = (x) => `${Math.round(x * 100)}%`;

// "Dân binh 2; Quân sĩ, Tướng quân 1; Nguyên soái, Truyền Kỳ không có" — gom độ khó theo số lượt Gượng dậy
function reviveByDifficulty() {
  const g = new Map();
  for (const d of DIFFICULTY) { if (!g.has(d.revive)) g.set(d.revive, []); g.get(d.revive).push(d.name); }
  return [...g].sort((a, b) => b[0] - a[0]).map(([n, names]) => `${names.join(", ")} ${n || "không có"}`).join("; ");
}
const SK_HI = SIM.skBands[0], SK_LO = SIM.skBands[SIM.skBands.length - 1], SK_LO_BELOW = SIM.skBands[SIM.skBands.length - 2][0];
const revive = HERO.revive, reviveHk = -HAO_KHI.src.reviveUsed;
const KY = KITS.NG_KY, KY_BACK = KY.range * AI.kite;      // Cung kỵ: tầm bắn 20 m; tướng áp sát dưới 8 m thì nó lùi giữ tầm

// Chữ ở hàng "Gượng dậy" của màn Xuất trận (main.js): n lần theo độ khó đang chọn.
export const guongDayRow = (n) => (n > 0
  ? `${n} lần — gục thì đứng lại với ${pct(revive.hp)} Sinh lực, bất tử ${revive.invuln} s`
  : "không có — gục là thua");

export const GLOSS = {
  hk: { icon: "tpc", name: "Hào Khí",
    long: "Thanh trên đỉnh màn. Tăng khi chiếm Cứ Điểm, hạ sĩ quan, làm nhiệm vụ, Kế Sách; giảm khi mất đồn, phải Gượng dậy. Đủ 100 thì kích Tổng Phản Công." },
  cuDiem: { icon: "giuvung", name: "Cứ Điểm",
    long: "Đồn, doanh trại có vòng tròn dưới đất. Cả đồn lẫn doanh trại có tường cọc và hai cổng (trước phía tây, sau phía đông): lính và tướng chỉ ra vào bằng cổng. Hạ hết quân đồn trú và sĩ quan trấn thủ, rồi đứng trong vòng cho tới khi chiếm xong." },
  matTran: { icon: "tiencong", name: "Mặt trận",
    long: "Hai tuyến A (bến trên) và B (bến dưới) tự đánh nhau kể cả khi bạn ở xa. Bản đồ nhỏ góc phải cho biết quân hai bên và Sĩ Khí." },
  siKhi: { icon: "theota", name: "Sĩ Khí",
    long: `Tinh thần của một cánh quân, 0–100 điểm, hiện ở bảng mặt trận dạng "Sĩ Khí ta|địch". Từ ${SK_HI[0]} trở lên cánh đánh mạnh ×${vn(SK_HI[1])}; dưới ${SK_LO_BELOW} yếu đi ×${vn(SK_LO[1])}; dưới ${SIM.collapseSK} suốt ${SIM.collapseHold} s thì cánh vỡ, mất Cứ Điểm gần nhất. Tự trôi dần về ${SIM.skDrift}.`,
    short: `SK là Sĩ Khí: tinh thần mỗi cánh quân, 0–100, ghi "ta | địch" ở bảng mặt trận. Từ ${SK_HI[0]} trở lên đánh mạnh ×${vn(SK_HI[1])}; dưới ${SK_LO_BELOW} yếu đi ×${vn(SK_LO[1])}; dưới ${SIM.collapseSK} quá ${SIM.collapseHold} s thì cánh vỡ.` },
  guongDay: { icon: "block", name: "Gượng dậy",
    long: `Tướng gục mà còn lượt thì đứng lại với ${pct(revive.hp)} Sinh lực, bất tử ${revive.invuln} s, trừ ${reviveHk} Hào Khí. Số lượt theo độ khó: ${reviveByDifficulty()}. Hết lượt mà gục là thua trận.` },
  phaThe: { icon: "dq", name: "Phá Thế và Vỡ Thế",
    long: `Thanh vàng dưới tên sĩ quan là Phá Thế; đòn trúng làm nó cạn dần. Cạn hết thì hắn Vỡ Thế: loạng choạng ${vn(BROKEN_SEC)} s, nhận thêm ${pct(BROKEN_MULT - 1)} sát thương, mở Đòn Quyết (bấm C cạnh hắn). Không nhầm với Phá Trận (kỹ năng của Trần Quốc Toản) hay đòn C1 Phá khiên.`,
    short: `Thanh vàng Phá Thế của sĩ quan: đánh cạn thì hắn Vỡ Thế, loạng choạng ${vn(BROKEN_SEC)} s. Lúc đó bấm {c} cạnh hắn để ra Đòn Quyết.` },
  doDo: { icon: "ct", name: "Đòn viền đỏ",
    long: `Vòng đỏ dưới chân sĩ quan lớn dần cho đầy trong ${vn(DEFENSE.redTelegraph)} s, vừa đầy thì cú bổ rơi. Không đỡ được: né ra khỏi vòng, hoặc bấm Đỡ trong ${vn(DEFENSE.parryWindow)} s cuối để Phản đòn; bấm sớm hơn thì hụt và bị khóa ${vn(DEFENSE.counterLockout)} s. Trúng đòn này lúc đang chiếm Cứ Điểm thì tiến độ chiếm về 0.`,
    short: "Vòng đỏ dưới chân sĩ quan là đòn không đỡ được. Né ra khỏi vòng, hoặc bấm {block} lúc vòng vừa đầy để Phản đòn." },
  // Đợt 12c: cửa ngõ = doanh trại của cánh, nguồn viện binh. Vệt đỏ chạy từ doanh trại tới tuyến trên bản đồ nhỏ khi còn mở.
  cuaNgo: { icon: "giuvung", name: "Cửa ngõ",
    long: "Doanh trại của mỗi cánh là cửa ngõ viện binh. Còn của quân Nguyên thì quân mới liên tục xuất ra từ sau doanh trại rồi hành quân ra tuyến (bản đồ nhỏ có vệt đỏ từ doanh trại tới tuyến), cánh còn hồi quân và có thêm các đợt tiếp viện. Chiếm doanh trại, hoặc để cánh địch vỡ trận, là đóng cửa ngõ: hết viện binh, quân còn lại chỉ vơi đi.",
    short: "Doanh trại là cửa ngõ viện binh của cánh: còn của quân Nguyên thì quân mới liên tục xuất ra rồi hành quân ra tuyến (vệt đỏ trên bản đồ nhỏ). Chiếm nó là đóng cửa ngõ, hết viện binh." },
  // Đợt 12a: cung kỵ lùi giữ tầm nhanh gần bằng tướng chạy (4,7–5,7 so với 6,75 m/s) nên đuổi bộ rất lâu mới tới. Mọi cung kỵ thật không đang đấu tay đôi đều lùi khi tướng áp sát dưới 8 m.
  cungKy: { icon: "dodge", name: "Cung kỵ",
    long: `Cung kỵ cưỡi ngựa, bắn xa ${KY.range} m và lùi giữ tầm khi tướng áp sát dưới ${KY_BACK} m. Chạy bộ đuổi thì rất lâu mới tới: Né một cái cho sát rồi chém liền, hoặc dùng Phá Trận (kỹ năng của Trần Quốc Toản) lao tới. Trúng một đòn là hắn khựng lại.`,
    short: `Cung kỵ lùi ngựa giữ tầm khi tướng áp sát dưới ${KY_BACK} m, chạy bộ đuổi rất lâu mới tới. Bấm {dodge} lộn sát tới rồi chém liền, hoặc dùng kỹ năng lao tới ({skill}).` },
};

// Thứ tự thẻ "Trong trận" ở bảng đòn (ui/guide.js)
export const CONCEPT_ORDER = ["hk", "cuDiem", "matTran", "siKhi", "guongDay", "phaThe", "doDo", "cungKy", "cuaNgo"];
