// data/suquan-b20.js — thẻ Sử quán của Chương B20 Bạch Đằng (GDD 12.11) và ngân hàng Quiz chương (22.6).
// Cùng dạng với suquan-b15.js (nhóm thẻ dùng chung CARD_GROUPS của B15).
//
// Chữ lấy từ canon B20 (canon-b20: B20, H31, H38, H40, X18, X20, X24, X25 — history, bio, fate, caveats, dignity)
// và lời dẫn Chính sử của comic (comic/B20-bach-dang/panels.json). Chưa qua cố vấn sử: review "draft" trên từng thẻ,
// từng câu (cổng VS 22.8 cần duyệt 100%).
//
// Luật nhạy cảm (canon B20.sensitivity, X20/X25.dignity): không "Sát Thát" làm khẩu hiệu; tướng bị bắt không bị hạ
// nhục (Ô Mã Nhi đứng thẳng); cái chết năm 1289 của Ô Mã Nhi và cái chết của A Bát Xích chỉ nêu ở Sử quán, giọng
// trung tính, có nguồn; không một con số thương vong phía Nguyên (các nguồn chênh 4 vạn – 8, 9 vạn); không bè lửa.
//
// Khóa mở (unlock) — meta/chapter.js mở thẻ theo khóa: "chapterOpen", "battleStart", "bossMet" (gặp Ô Mã Nhi),
// "keSach:<id>" với id Kế Sách của battle-b20.js (nghiBinh, kichCoc, conNuoc; chỉ mở khi Kế Sách thành công —
// B20-GAMEPLAY §D5, khác B15 thành hay bại đều mở), "firstWin", "firstQuiz".
// Nội Bàng (Kế Sách Nhỏ) chưa có ở bản thử nên thẻ Nội Bàng mở khi thắng lần đầu.

import { COMIC_B20 } from "./comic-b20.js";

const TT = "Đại Việt sử ký toàn thư, Bản kỷ q.5 (năm Mậu Tý 1288, Kỷ Sửu 1289; đối chiếu bản dịch Viện KHXH 1993)";
const NS = "Nguyên sử q.209, An Nam truyện";
const KC = "Khảo cổ học: các bãi cọc Yên Giang, Đồng Má Ngựa, Đồng Vạn Muối, Cao Quỳ (Quảng Yên, Quảng Ninh) — theo canon B20 (vi/en.wikipedia)";
const QUAT = "Truyền thuyết và thần tích đền Quát (theo canon H38)";
const CANON = (id) => `Canon ${id} (GDD, tab ${id.startsWith("B") ? "Hồ sơ 30 trận" : id.startsWith("X") ? "Boss & tướng địch" : "Hồ sơ 56 tướng"})`;

export const CARDS = [
  {
    id: "H31", chapter: "B20", group: "tuongta", label: "Chính sử", review: "draft",
    title: "Hưng Đạo vương Trần Quốc Tuấn", unlock: "chapterOpen", hint: "Mở Chương Bạch Đằng.",
    body: [
      "Tôn thất nhà Trần, Quốc công Tiết chế thống lĩnh quân đội trong hai cuộc kháng chiến 1285 và 1287–1288; tác giả Hịch tướng sĩ và Binh thư yếu lược.",
      "Năm 1288 ông đoán thủy quân Nguyên sẽ theo sông Bạch Đằng ra biển, cho đóng cọc dưới lòng sông từ trước và đặt quân mai phục ở các nhánh sông.",
      "Năm sinh chưa rõ (các thuyết từ 1221 đến 1232); ông mất năm 1300. Hội đồng quân sự, lời thoại trong comic và thanh Gươm Tiết chế của game là Hư cấu.",
      "Hậu thế tôn vinh: dân gian thờ ông là Đức Thánh Trần.",
    ],
    src: [TT, CANON("H31")], panels: ["O3", "O7", "K5"],
  },
  {
    id: "H38", chapter: "B20", group: "tuongta", label: "Tương truyền", review: "draft",
    title: "Yết Kiêu", unlock: "battleStart", hint: "Ra trận Bạch Đằng lần đầu.",
    body: [
      "Gia tướng của Hưng Đạo vương, xuất thân làng chài. Toàn thư chép đầu năm 1285, sau khi quân ta thất lợi ở Vạn Kiếp, Yết Kiêu giữ thuyền ở bãi Tân chờ Hưng Đạo vương; chi tiết này là Chính sử.",
      "Chuyện ông lặn lâu dưới nước, đục đáy thuyền giặc và có mặt ở trận Bạch Đằng năm 1288 là Tương truyền, theo truyền thuyết và thần tích đền Quát.",
      "Năm sinh, năm mất (1242–1303) và tên thật Phạm Hữu Thế đều theo thần tích. Trong comic, hình Yết Kiêu mang nhãn Tương truyền.",
    ],
    src: [TT, QUAT, CANON("H38")], panels: ["O6", "O7"],
  },
  {
    id: "X24", chapter: "B20", group: "tuongdich", label: "Chính sử", review: "draft",
    title: "Phàn Tiếp", unlock: "battleStart", hint: "Ra trận Bạch Đằng lần đầu.",
    body: [
      "Tướng thủy quân nhà Nguyên (樊楫) trong cuộc tiến quân 1287–1288, cùng Ô Mã Nhi chỉ huy chiến thuyền.",
      "Tháng 4 năm 1288 ông rút theo sông Bạch Đằng ra biển và bị bắt sống trong trận. Các nguồn ghi khác nhau về kết cục của ông sau đó.",
      "Trong game ông là tướng cẩn trọng, sớm nghi lòng sông, cho thuyền dò luồng và xích thuyền khi bị dồn; các cơ chế ấy và câu thoại \"Nước này quá lặng\" là Hư cấu.",
    ],
    src: [TT, NS, CANON("X24")], panels: ["K1"],
  },
  {
    id: "X20", chapter: "B20", group: "tuongdich", label: "Chính sử", review: "draft",
    title: "Ô Mã Nhi", unlock: "bossMet", hint: "Gặp Ô Mã Nhi trên kỳ hạm.",
    body: [
      "Vạn hộ thủy quân nhà Nguyên, người Sắc mục (烏馬兒, Omar). Từng cùng Toa Đô đánh Chiêm Thành; năm 1285 chỉ huy chiến thuyền đánh vào Đại Việt.",
      "Năm 1287–1288 ông chỉ huy thủy quân chủ lực, tiến trước, bỏ lại đoàn thuyền lương phía sau; đoàn thuyền ấy bị quân Trần đánh ở Vân Đồn.",
      "Ngày 9/4/1288 ông bị bắt sống ở Bạch Đằng. Toàn thư chép Nội minh tự Đỗ Hành bắt được ông, đem dâng Thượng hoàng.",
      "Năm 1289 nhà Trần trả ông về nước; thuyền chìm dọc đường và ông chết đuối. Toàn thư chép việc thuyền chìm do phía Trần sắp đặt theo kế của Hưng Đạo vương. Game không dựng cảnh này.",
    ],
    src: [TT, NS, CANON("X20")], panels: ["O2", "O8", "K2"],
  },
  {
    id: "B20-nghibinh", chapter: "B20", group: "kesach", label: "Chính sử", review: "draft",
    title: "Kế Sách: Nghi binh lúc triều lên", unlock: "keSach:nghiBinh", hint: "Kế Sách \"Nghi binh lúc triều lên\" thành công.",
    body: [
      "Ngày 9/4/1288, lúc triều lên, thuyền nhẹ quân Trần ra khiêu chiến rồi giả thua, lui dần. Hạm đội Nguyên đuổi theo vào khúc sông đã đóng cọc mà không thấy cọc.",
      "Tên Kế Sách, 8 thuyền nhẹ, khoảng cách 15–40 m với thuyền dẫn đầu và mốc \"Khúc cọc\" là cơ chế của game (Hư cấu).",
    ],
    src: [TT, CANON("B20")], panels: ["O8"],
  },
  {
    id: "B20-baicoc", chapter: "B20", group: "kesach", label: "Chính sử", review: "draft",
    title: "Bãi cọc Bạch Đằng", unlock: "keSach:kichCoc", hint: "Kế Sách \"Kích hoạt bãi cọc\" thành công.",
    body: [
      "Hưng Đạo vương cho đóng cọc gỗ lớn, vạt nhọn một đầu, thành nhiều bãi dưới lòng sông Bạch Đằng từ trước, ngụy trang để lúc triều lên cọc chìm khuất.",
      "Khảo cổ học đã tìm thấy các bãi cọc ở Yên Giang, Đồng Má Ngựa, Đồng Vạn Muối, Cao Quỳ (Quảng Ninh): cọc gỗ đường kính 10–30 cm, dài 1,5–3 m.",
      "Cọc năm 1288 là gỗ vạt nhọn, không bịt sắt; cọc bịt sắt là chi tiết trận Bạch Đằng năm 938 của Ngô Quyền.",
      "Ba mốc cọc, bè cỏ neo bằng dây và thao tác \"Mở bãi cọc\" trong game là Hư cấu.",
    ],
    src: [TT, KC], panels: ["O4", "O5", "K1", "K6"],
  },
  {
    id: "B20-connuoc", chapter: "B20", group: "kesach", label: "Chính sử", review: "draft",
    title: "Con nước", unlock: "keSach:conNuoc", hint: "Kế Sách \"Con nước\" thành công.",
    body: [
      "Thế trận dựa vào con nước: lúc triều lên, cọc chìm khuất, hạm đội Nguyên đi qua được; khi triều rút, cọc nhô lên, thuyền lớn mắc cọc, nghiêng, không xoay trở được.",
      "Quân mai phục ở các nhánh sông đổ ra, quân Trần đánh từ nhiều phía vào đoàn thuyền đã mắc lại.",
      "Trong game, đồng hồ Con nước chạy theo pha trận, khúc sông được thu ngắn còn khoảng 1,2 km; Kế Sách \"Con nước\" và thanh Thoát vây là cơ chế của game (Hư cấu).",
    ],
    src: [TT, CANON("B20")], panels: ["O6", "K1"],
  },
  {
    id: "B20-tran", chapter: "B20", group: "tran", label: "Chính sử", review: "draft",
    title: "Trận Bạch Đằng (1288)", unlock: "firstWin", hint: "Thắng trận Bạch Đằng.",
    body: [
      "Đầu năm 1288, đoàn thuyền lương Nguyên bị đánh ở Vân Đồn; quân Thoát Hoan ở Vạn Kiếp thiếu đói nên quyết định rút: thủy quân của Ô Mã Nhi, Phàn Tiếp theo sông Bạch Đằng ra biển, quân bộ theo đường Lạng Sơn.",
      "Ngày 8 tháng 3 năm Mậu Tý (9/4/1288), quân Trần do vua Nhân Tông, Thượng hoàng Thánh Tông và Hưng Đạo vương chỉ huy đánh tan thủy quân Nguyên. Ô Mã Nhi, Phàn Tiếp, Tích Lệ Cơ Ngọc bị bắt; hơn 400 chiến thuyền bị thu.",
      "Sau chiến thắng, vua Nhân Tông có câu thơ \"Xã tắc hai phen chồn ngựa đá, non sông nghìn thuở vững âu vàng\" (bản dịch).",
      "Số thương vong phía Nguyên khác nhau lớn giữa các nguồn nên game không nêu một con số. Bố cục khúc sông, các mốc và các pha của trận trong game là Hư cấu.",
    ],
    src: [TT, NS, CANON("B20")], panels: ["O1", "O8", "K1", "K3"],
  },
  {
    id: "B20-dohanh", chapter: "B20", group: "tuongta", label: "Chính sử", review: "draft",
    title: "Nội minh tự Đỗ Hành", unlock: "firstWin", hint: "Thắng trận Bạch Đằng.",
    body: [
      "Quan nhà Trần giữ chức Nội minh tự. Toàn thư chép ông bắt được Ô Mã Nhi và Tích Lệ Cơ Ngọc trong trận Bạch Đằng, đem dâng Thượng hoàng.",
      "Trong game, người chơi (Hưng Đạo vương) dồn Ô Mã Nhi tới Vỡ Thế trên kỳ hạm (Hư cấu); comic kết chương ghi đúng người bắt theo Toàn thư.",
      "Cảnh Ô Mã Nhi đứng thẳng, đặt gươm dưới chân, giáo quân Trần hạ xuống là cách dựng hình của comic (Hư cấu).",
    ],
    src: [TT, CANON("B20")], panels: ["K2"],
  },
  {
    id: "B20-noibang", chapter: "B20", group: "sukien", label: "Chính sử", review: "draft",
    title: "Nội Bàng và A Bát Xích", unlock: "firstWin", hint: "Thắng trận Bạch Đằng.",
    body: [
      "Cùng lúc thủy quân rút theo sông Bạch Đằng, quân bộ của Thoát Hoan rút về phương Bắc qua vùng Lạng Sơn và bị quân Trần đón đánh dọc đường. Phạm Ngũ Lão phục kích ở ải Nội Bàng.",
      "A Bát Xích (來阿八赤), người Đường Ngột, giữ chức Hữu thừa hành tỉnh, cầm quân mở đường cho đoàn rút, đi đầu nơi nguy hiểm nhất. Ông trúng ba mũi tên độc mà chết trên đường rút.",
      "Nguyên sử ghi việc ấy lúc đánh Trúc Động và cửa An Bang; một số tài liệu Việt hiện đại ghi ở vùng ải Nội Bàng.",
      "Thoát Hoan về được Tư Minh; Hốt Tất Liệt đày ông ra trấn Dương Châu, suốt đời không cho vào chầu. Mặt trận Nội Bàng chưa có trong bản thử này.",
    ],
    src: ["Nguyên sử q.129, truyện Lai A Bát Xích", NS, "en.wikipedia, Battle of Bạch Đằng (1288) — Phạm Ngũ Lão phục kích ở ải Nội Bàng (theo canon B20)", CANON("X25")], panels: ["K4"],
  },
  {
    id: "B20-bl-938", chapter: "B20", group: "benle", label: "Chính sử", review: "draft",
    title: "Hai trận cọc: 938 và 1288", unlock: "firstQuiz", hint: "Trả lời Quiz Chương Bạch Đằng lần đầu.",
    body: [
      "Năm 938, Ngô Quyền cho đóng cọc lớn đầu bịt sắt nhọn ở cửa sông Bạch Đằng, đánh tan thủy quân Nam Hán.",
      "350 năm sau, Hưng Đạo vương dùng lại thế trận cọc trên cùng con sông, nhưng cọc năm 1288 là gỗ lớn vạt nhọn, không bịt sắt; khảo cổ ở Yên Giang cho thấy điều ấy.",
      "Vì vậy cọc trong game là cọc gỗ trần, không mũi sắt.",
    ],
    src: ["Đại Việt sử ký toàn thư, Ngoại kỷ (kỷ Tiền Ngô Vương)", KC], panels: ["O5", "K6"],
  },
];

export const CARD_BY_ID = Object.fromEntries(CARDS.map((c) => [c.id, c]));

// ---- Quiz chương B20 (22.6) ------------------------------------------------------------------------
// Schema như QUIZ_B15; thêm src (nguồn của câu). seenRef: "panel:<id>" (khung comic đã xem), "card:<id>" (thẻ đã mở).
const FROM_COMIC = {       // 4 câu có sẵn trong panels.json → gắn id, dạng, seenRef, nguồn
  O1: { id: "B20-Q01", seenRef: ["panel:O1", "card:B20-tran"], src: [TT] },
  K1: { id: "B20-Q02", seenRef: ["panel:K1", "card:B20-baicoc", "card:B20-connuoc"], src: [TT, KC] },
  K2: { id: "B20-Q03", seenRef: ["panel:K2", "card:B20-dohanh", "card:X20"], src: [TT] },
  O5: { id: "B20-Q04", seenRef: ["panel:O5", "card:B20-baicoc", "card:B20-bl-938"], src: [TT, KC] },
};

const vi = (s) => ({ vi: s, en: null });
const NEW = [
  {
    id: "B20-Q05", type: "mcq4", panel: "O8", label: "Chính sử", seenRef: ["panel:O8", "card:B20-nghibinh"], src: [TT],
    q: vi("Lúc triều lên ngày 9/4/1288, quân Trần làm gì để dụ hạm đội Nguyên vào khúc sông có cọc?"),
    options: ["Cho thuyền nhẹ ra khiêu chiến rồi giả thua, lui dần", "Sai sứ giả mang thư xin hàng", "Bỏ trống doanh trại Vạn Kiếp để nhử quân bộ", "Mở trống cửa sông cho thuyền Nguyên đi"],
    why: vi("Thuyền nhẹ quân Trần ra khiêu chiến lúc triều lên rồi giả thua; hạm đội Nguyên đuổi theo vào khúc sông đã đóng cọc, khi ấy cọc còn chìm khuất dưới nước."),
  },
  {
    id: "B20-Q06", type: "truefalse", panel: "K6", label: "Chính sử", seenRef: ["panel:K6", "card:B20-baicoc"], src: [KC],
    q: vi("Ngày nay vẫn còn tìm thấy cọc gỗ của trận Bạch Đằng năm 1288 dưới bùn ở Quảng Ninh."),
    options: ["Đúng", "Sai"], answer: 0,
    why: vi("Đúng. Các bãi cọc Yên Giang, Đồng Má Ngựa, Đồng Vạn Muối, Cao Quỳ (Quảng Yên, Quảng Ninh) là dấu tích khảo cổ của trận đánh."),
  },
  {
    id: "B20-Q07", type: "mcq4", panel: "O2", label: "Chính sử", seenRef: ["panel:O2", "card:B20-tran"], src: [TT, NS],
    q: vi("Khi quyết định rút năm 1288, Thoát Hoan cho thủy quân của Ô Mã Nhi ra biển theo đường nào?"),
    options: ["Theo sông Bạch Đằng", "Theo sông Hồng qua Thăng Long", "Theo đường bộ qua Lạng Sơn", "Theo sông Mã vào Thanh Hóa"],
    why: vi("Thủy quân của Ô Mã Nhi, Phàn Tiếp theo sông Bạch Đằng ra biển; đường bộ qua Lạng Sơn là đường rút của quân bộ Thoát Hoan."),
  },
  {
    id: "B20-Q08", type: "mcq4", panel: "K4", label: "Chính sử", seenRef: ["panel:K4", "card:B20-noibang"], src: [TT, NS],
    q: vi("Năm 1288, trên đường bộ, quân Thoát Hoan ra sao?"),
    options: ["Rút về phương Bắc, bị quân Trần đón đánh dọc đường", "Ở lại giữ Vạn Kiếp thêm một năm", "Xuống thuyền theo sông Bạch Đằng ra biển", "Quay lại chiếm Thăng Long"],
    why: vi("Quân bộ rút qua vùng Lạng Sơn về phương Bắc giữa những trận phục kích; A Bát Xích trúng tên độc mà chết trên đường rút, Thoát Hoan về được Tư Minh."),
  },
  {
    id: "B20-Q09", type: "mcq4", panel: "K3", label: "Chính sử", seenRef: ["card:X24", "panel:K3"], src: [TT, NS],
    q: vi("Tướng thủy quân Nguyên nào cùng Ô Mã Nhi chỉ huy chiến thuyền và cũng bị bắt sống ở Bạch Đằng?"),
    options: ["Phàn Tiếp", "Toa Đô", "A Bát Xích", "Trương Văn Hổ"],
    why: vi("Phàn Tiếp cùng Ô Mã Nhi chỉ huy thủy quân và bị bắt sống ngày 9/4/1288. Toa Đô đã tử trận năm 1285; A Bát Xích đi cùng quân bộ; Trương Văn Hổ chỉ huy đoàn thuyền lương bị đánh ở Vân Đồn."),
  },
  {
    id: "B20-Q10", type: "timeline", panel: "O1", label: "Chính sử", seenRef: ["panel:O1", "card:B20-tran"], src: [TT],
    q: vi("Xếp các sự việc theo đúng thứ tự trước sau."),
    options: ["Đoàn thuyền lương Nguyên bị đánh ở Vân Đồn", "Thoát Hoan quyết định rút quân", "Thuyền nhẹ quân Trần khiêu chiến lúc triều lên", "Nước ròng, thuyền Nguyên mắc lại giữa bãi cọc"],
    why: vi("Mất thuyền lương ở Vân Đồn (tháng chạp năm Đinh Hợi, khoảng đầu 1288) khiến quân Nguyên đói, Thoát Hoan quyết rút. Sáng 9/4/1288 thuyền nhẹ quân Trần khiêu chiến lúc triều lên; nước ròng thì thuyền Nguyên mắc cọc."),
  },
  {
    id: "B20-Q11", type: "truefalse", panel: "O6", label: "Tương truyền", seenRef: ["panel:O6", "card:H38"], src: [TT, QUAT],
    q: vi("Toàn thư chép rõ Yết Kiêu lặn xuống sông Bạch Đằng đục thuyền giặc năm 1288."),
    options: ["Đúng", "Sai"], answer: 1,
    why: vi("Sai. Toàn thư chỉ chép Yết Kiêu giữ thuyền ở bãi Tân chờ Hưng Đạo vương năm 1285. Chuyện lặn sông đục thuyền và việc ông có mặt ở Bạch Đằng là Tương truyền, theo truyền thuyết và thần tích đền Quát."),
  },
  // "Ai nói câu này" chỉ dùng câu có nguồn: hai câu thơ của vua Nhân Tông sau chiến thắng 1288 (canon H30.quote)
  {
    id: "B20-Q12", type: "whoSaid", panel: "K5", label: "Chính sử", seenRef: ["panel:K5", "card:B20-tran"], src: [TT, CANON("H30")],
    q: vi("\"Xã tắc hai phen chồn ngựa đá, non sông nghìn thuở vững âu vàng\" (bản dịch) là thơ của ai, làm sau chiến thắng năm 1288?"),
    options: ["Vua Trần Nhân Tông", "Hưng Đạo vương Trần Quốc Tuấn", "Phạm Ngũ Lão", "Trần Quang Khải"],
    why: vi("Hai câu thơ của vua Trần Nhân Tông sau chiến thắng năm 1288: xã tắc hai lần lao đao, non sông muôn thuở vững bền. Phạm Ngũ Lão để lại bài Thuật hoài; Trần Quang Khải có bài Tụng giá hoàn kinh sư."),
  },
  {
    id: "B20-Q13", type: "mcq4", panel: "O3", label: "Chính sử", seenRef: ["panel:O3", "card:H31"], src: [TT],
    q: vi("Ai đoán thủy quân Nguyên sẽ theo sông Bạch Đằng ra biển và cho đóng cọc chờ sẵn?"),
    options: ["Hưng Đạo vương Trần Quốc Tuấn", "Trần Khánh Dư", "Trần Nhật Duật", "Trần Quang Khải"],
    why: vi("Hưng Đạo vương, Quốc công Tiết chế, đoán đường rút của thủy quân Nguyên, cho đóng cọc dưới lòng sông Bạch Đằng từ trước và đặt quân mai phục ở các nhánh sông."),
  },
];

export const QUIZ_B20 = [
  ...COMIC_B20.quiz.map((q) => ({
    ...q, ...FROM_COMIC[q.panel], chapter: "B20", type: "mcq4", review: "draft", contested: false,
    q: { vi: q.q.vi, en: q.q.en }, why: { vi: q.why.vi, en: q.why.en },
  })),
  ...NEW.map((q) => ({ answer: 0, chapter: "B20", review: "draft", contested: false, ...q })),
];
