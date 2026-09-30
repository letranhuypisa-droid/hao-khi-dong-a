// data/suquan-b15.js — thẻ Sử quán của Chương B15 Hàm Tử (GDD 12.11) và ngân hàng Quiz chương (22.6).
//
// Mọi chữ ở đây lấy từ canon (design/canon.json: B15, H33, H35, X19) và lời dẫn Chính sử của comic
// (comic/B15-ham-tu/panels.json, đối chiếu Toàn thư q.5 trong NGUON-GOC.md). Chưa qua cố vấn sử:
// review "draft" trên từng thẻ, từng câu (cổng VS 22.8 cần duyệt 100%).

import { COMIC_B15 } from "./comic-b15.js";

const TT = "Đại Việt sử ký toàn thư, Bản kỷ q.5 (nguyên văn chữ Hán, zh.wikisource; đối chiếu bản dịch Viện KHXH 1993)";
const NS = "Nguyên sử q.209, An Nam truyện";

// Nhóm thẻ R1 (12.11) — bản thử chỉ có các nhóm B15 dùng tới.
export const CARD_GROUPS = [
  { id: "tran", name: "Trận đánh" },
  { id: "kesach", name: "Kế Sách và binh pháp" },
  { id: "tuongta", name: "Tướng Đại Việt" },
  { id: "tuongdich", name: "Tướng đối phương" },
  { id: "sukien", name: "Văn bản và sự kiện" },
  { id: "benle", name: "Chuyện bên lề" },
];

// unlock: khóa máy đọc (meta/chapter.js mở thẻ theo khóa này); hint: chữ hiện trên thẻ còn khóa.
export const CARDS = [
  {
    id: "B15-binhthan", chapter: "B15", group: "sukien", label: "Chính sử", review: "draft",
    title: "Hội nghị Bình Than (1282)", unlock: "chapterOpen", hint: "Mở Chương Hàm Tử.",
    body: [
      "Mùa đông năm 1282, vua Trần Nhân Tông họp vương hầu, trăm quan ở bến Bình Than bàn kế đánh, giữ trước tin quân Nguyên sắp sang.",
      "Hoài Văn hầu Trần Quốc Toản bị cho là còn nhỏ nên không được dự bàn. Ông bóp nát quả cam trong tay lúc nào không biết.",
      "Về nhà, ông họp gia nô, thân thuộc hơn nghìn người, sắm khí giới, đề lên cờ sáu chữ \"Phá cường địch, báo hoàng ân\".",
    ],
    src: [TT], panels: ["O1", "O2", "O3"],
  },
  {
    id: "H35", chapter: "B15", group: "tuongta", label: "Chính sử", review: "draft",
    title: "Hoài Văn hầu Trần Quốc Toản", unlock: "battleStart", hint: "Ra trận Hàm Tử lần đầu.",
    body: [
      "Tôn thất trẻ nhà Trần. Năm 1282 bị cho là nhỏ tuổi nên không được bàn việc nước ở Bình Than; về nhà dựng cờ sáu chữ, tập hợp gia binh hơn nghìn người.",
      "Năm 1285 được vua sai cùng Chiêu Thành vương, Nguyễn Khoái đón đánh quân Nguyên ở Tây Kết; Toàn thư chép ông xông trước quân lính, địch thấy phải tránh.",
      "Khi ông mất, vua thương tiếc, tự làm văn tế, truy phong tước vương.",
      "Năm sinh 1267 và việc ông mất ngay trong năm 1285 là Tương truyền: Toàn thư chỉ ghi ông còn nhỏ, không ghi tuổi. Song đao trong game là Hư cấu.",
    ],
    src: [TT, "Canon H35 (GDD, tab Hồ sơ 56 tướng)"], panels: ["O2", "O3", "K4", "K5"],
  },
  {
    id: "H33", chapter: "B15", group: "tuongta", label: "Chính sử", review: "draft",
    title: "Chiêu Văn vương Trần Nhật Duật", unlock: "battleStart", hint: "Ra trận Hàm Tử lần đầu.",
    body: [
      "Con thứ sáu của Trần Thái Tông, giỏi tiếng Tống, tiếng Chiêm và phong tục các dân tộc. Năm 1280 chiêu dụ Trịnh Giác Mật ở Đà Giang mà không cần giao chiến.",
      "Khi nhà Tống mất, nhiều người Tống sang Đại Việt; ông thu nhận họ, trong đó có Triệu Trung làm gia tướng.",
      "Năm 1285, người Tống trong quân ông mặc áo Tống, cầm cung tên ra trận ở Hàm Tử. Toàn thư chép vì thế công phá quân Nguyên, Chiêu Văn vương có phần nhiều.",
      "Vai chủ soái của ông trong hội đồng ở comic là Hư cấu: Toàn thư không ghi ai chỉ huy chung ở Hàm Tử.",
    ],
    src: [TT, "Canon H33 (GDD, tab Hồ sơ 56 tướng)"], panels: ["O5", "K3"],
  },
  {
    id: "X19", chapter: "B15", group: "tuongdich", label: "Chính sử", review: "draft",
    title: "Toa Đô", unlock: "bossMet", hint: "Gặp Toa Đô trên bến Hàm Tử.",
    body: [
      "Danh tướng nhà Nguyên, từng dự trận Tương Dương. Năm 1282–1283 đem thủy quân từ Quảng Châu đánh Chiêm Thành, chiếm kinh đô Vijaya.",
      "Năm 1285 kéo quân từ phía nam lên, thắng ở Thanh Hóa, Nghệ An rồi bị chặn ở Hàm Tử.",
      "Toàn thư chép ông tử trận ở Tây Kết tháng 5 năm ấy. Vua Trần Nhân Tông thấy thủ cấp, than rằng làm bề tôi nên như thế, cởi áo ngự sai khâm liệm. Nhà Nguyên truy tặng thụy Tương Mẫn.",
      "Việc Toa Đô có mặt, đổ bộ rồi rút chạy ở Hàm Tử trong game là Hư cấu: sử không nêu tên tướng Nguyên ở trận này.",
    ],
    src: [TT, NS, "Canon X19 (GDD, tab Boss & tướng địch)"], panels: ["O4", "K2"],
  },
  {
    id: "B15-coaotong", chapter: "B15", group: "kesach", label: "Chính sử", review: "draft",
    title: "Kế Sách: Cờ áo Tống", unlock: "keSach:coAoTong", hint: "Dùng Kế Sách \"Cờ áo Tống\" (thành hay bại đều mở).",
    body: [
      "Toàn thư chép trong quân Chiêu Văn vương có người Tống mặc áo Tống, cầm cung tên ra trận. Người Tống, người Nguyên tiếng nói, áo quần giống nhau, nên Thượng hoàng Thánh Tông sai người dặn các quân phải nhận cho kỹ.",
      "Ở Hàm Tử quan, quân Nguyên thấy người Tống thì kinh hãi, thua chạy.",
      "Toàn thư chép sự việc, không chép đây là kế của ai hay có ý đánh lừa. Tên \"Cờ áo Tống\", hai thuyền và đường thuyền là cơ chế của game (Hư cấu).",
    ],
    src: [TT], panels: ["D2", "K1"],
  },
  {
    id: "B15-muitenthu", chapter: "B15", group: "kesach", label: "Tương truyền", review: "draft",
    title: "Kế Sách: Mũi tên thư", unlock: "keSach:muiTenThu", hint: "Dùng Kế Sách Nhỏ \"Mũi tên thư\" (chỉ có ở Trận chuẩn).",
    body: [
      "Kế Sách Nhỏ của trận: bắn thư buộc trên mũi tên vào doanh trại Nguyên, nhắn rằng quân Trần chỉ đánh quân xâm lược, không đánh người bị bắt đi lính.",
      "Nhãn Tương truyền theo hồ sơ trận B15 của GDD. Nguồn cụ thể của chi tiết này chưa được đối chiếu; làng, bó tên và lời thư trong game là Hư cấu.",
    ],
    src: ["Canon B15 (GDD, tab Hồ sơ 30 trận) — chờ cố vấn sử bổ sung nguồn"], panels: [],
  },
  {
    id: "B15-tran", chapter: "B15", group: "tran", label: "Chính sử", review: "draft",
    title: "Trận Hàm Tử (1285)", unlock: "firstWin", hint: "Thắng trận Hàm Tử.",
    body: [
      "Năm 1285, cánh quân Toa Đô từ Chiêm Thành đánh ra Nghệ An, Thanh Hóa, định hội với cánh quân Thoát Hoan.",
      "Tháng tư năm Ất Dậu, vua sai Chiêu Thành vương, Hoài Văn hầu Trần Quốc Toản và tướng quân Nguyễn Khoái đón đánh ở bến Tây Kết. Quan quân giao chiến với quân Nguyên ở Hàm Tử quan (Khoái Châu, Hưng Yên ngày nay).",
      "Trong trận có quân của Chiêu Văn vương Trần Nhật Duật, có người Tống mặc áo Tống ra trận. Quân Nguyên thua, phải lui. Chiến thắng mở màn cuộc phản công mùa hè năm 1285.",
      "Bố cục bến, đồn, doanh trại, cổng của trận trong game là Hư cấu, dựng để thử lối chơi.",
    ],
    src: [TT, NS], panels: ["D3", "K1", "K2"],
  },
  {
    id: "B15-bl-co", chapter: "B15", group: "benle", label: "Hư cấu", review: "draft",
    title: "Lá cờ đỏ thêu sáu chữ vàng", unlock: "firstQuiz", hint: "Trả lời Quiz Chương Hàm Tử lần đầu.",
    body: [
      "Toàn thư chỉ chép sáu chữ \"Phá cường địch, báo hoàng ân\" trên lá cờ của Trần Quốc Toản, không ghi màu cờ.",
      "Hình ảnh cờ đỏ chữ vàng quen thuộc đến từ truyện \"Lá cờ thêu sáu chữ vàng\" của nhà văn Nguyễn Huy Tưởng. Comic và game dùng màu cờ ấy, gắn nhãn Hư cấu ở từng khung.",
      "Sáu chữ Hán trên cờ không nằm trong ảnh comic: engine vẽ đè lên sáu ô trống để nét chữ luôn đúng.",
    ],
    src: [TT, "Nguyễn Huy Tưởng, Lá cờ thêu sáu chữ vàng (truyện)"], panels: ["O3", "K5"],
  },
];

export const CARD_BY_ID = Object.fromEntries(CARDS.map((c) => [c.id, c]));

// ---- Quiz chương B15 (22.6) ------------------------------------------------------------------------
// Schema quizItem: q, options (đáp án đúng ở vị trí 0; timeline: đúng thứ tự), answer, why, label, panel
// giữ như mảng quiz của panels.json; thêm id, chapter, type, seenRef (mảng các cách đã gặp — gặp một là đủ),
// contested, review. seenRef: "panel:<id>" (khung comic đã xem), "card:<id>" (thẻ đã mở), "event:<id>".
const FROM_COMIC = {       // 4 câu có sẵn trong panels.json → gắn id, dạng, seenRef
  O2: { id: "B15-Q01", seenRef: ["panel:O2", "card:B15-binhthan"] },
  O3: { id: "B15-Q02", seenRef: ["panel:O3", "card:B15-binhthan"] },
  O5: { id: "B15-Q03", seenRef: ["panel:O5", "card:H33"] },
  K1: { id: "B15-Q04", seenRef: ["panel:K1", "card:B15-coaotong"] },
};

const vi = (s) => ({ vi: s, en: null });
const NEW = [
  {
    id: "B15-Q05", type: "mcq4", panel: "D2", label: "Chính sử", seenRef: ["panel:D2", "card:B15-coaotong"],
    q: vi("Vì sao Thượng hoàng Thánh Tông sai người dặn các quân phải nhận cho kỹ quân của Chiêu Văn vương?"),
    options: ["Người Tống và người Nguyên tiếng nói, áo quần giống nhau", "Quân Chiêu Văn vương cầm cờ hiệu của quân Nguyên", "Quân Chiêu Văn vương mới từ phương nam về, chưa ai quen mặt", "Quân Chiêu Văn vương ra trận không mặc giáp"],
    why: vi("Toàn thư chép người Tống, người Nguyên tiếng nói, áo quần giống nhau, nên Thượng hoàng sai người dặn các quân nhận cho kỹ, kẻo đánh nhầm người Tống đánh bên ta."),
  },
  {
    id: "B15-Q06", type: "mcq4", panel: "K3", label: "Chính sử", seenRef: ["panel:K3", "card:H33"],
    q: vi("Toàn thư chép công phá quân Nguyên ở Hàm Tử, Chiêu Văn vương có phần nhiều. Vì sao?"),
    options: ["Người Tống trong quân của ông khiến quân Nguyên kinh hãi", "Ông bắt sống được tướng Nguyên ngay tại trận", "Ông dẫn thủy quân đánh chìm hết thuyền Nguyên", "Ông giữ Thăng Long suốt mùa hè năm 1285"],
    why: vi("Người Tống mặc áo Tống trong quân Nhật Duật làm quân Nguyên kinh hãi, thua chạy; Toàn thư chép \"vì thế\" công phá giặc Chiêu Văn vương có phần nhiều."),
  },
  {
    id: "B15-Q07", type: "mcq4", panel: "D3", label: "Chính sử", seenRef: ["panel:D3", "card:B15-tran"],
    q: vi("Tháng tư năm 1285, vua sai những ai đón đánh quân Nguyên ở Tây Kết?"),
    options: ["Chiêu Thành vương, Hoài Văn hầu Quốc Toản và Nguyễn Khoái", "Hưng Đạo vương, Chiêu Minh vương Quang Khải và Phạm Ngũ Lão", "Trần Khánh Dư, Yết Kiêu và Dã Tượng", "Trần Bình Trọng, Lê Phụ Trần và Đỗ Hành"],
    why: vi("Toàn thư chép tháng tư, vua sai Chiêu Thành vương, Hoài Văn hầu Trần Quốc Toản và tướng quân Nguyễn Khoái đem quân đón đánh ở Tây Kết. Trong trận, Nguyễn Khoái là tướng đồng minh ở cánh B."),
  },
  {
    id: "B15-Q08", type: "truefalse", panel: "K5", label: "Chính sử", seenRef: ["panel:K5", "card:H35"],
    q: vi("Toàn thư chép khi Trần Quốc Toản mất, vua tự làm văn tế và truy phong ông tước vương."),
    options: ["Đúng", "Sai"], answer: 0,
    why: vi("Đúng. Toàn thư chép vua thương tiếc, tự làm văn tế, truy phong tước vương. Sử không ghi tuổi ông; năm sinh 1267 chỉ là Tương truyền."),
  },
  {
    id: "B15-Q09", type: "truefalse", panel: "O3", label: "Hư cấu", seenRef: ["panel:O3", "card:B15-binhthan"],
    q: vi("Toàn thư có ghi lá cờ của Trần Quốc Toản màu đỏ, chữ vàng."),
    options: ["Đúng", "Sai"], answer: 1,
    why: vi("Sai. Toàn thư chỉ chép sáu chữ trên cờ. Cờ đỏ chữ vàng là hình ảnh trong truyện \"Lá cờ thêu sáu chữ vàng\" của Nguyễn Huy Tưởng; comic dùng lại và gắn nhãn Hư cấu."),
  },
  {
    id: "B15-Q10", type: "truefalse", panel: "K2", label: "Chính sử", seenRef: ["card:X19"],
    q: vi("Toàn thư chép Toa Đô tử trận ngay tại Hàm Tử."),
    options: ["Đúng", "Sai"], answer: 1,
    why: vi("Sai. Sử không nêu tên tướng Nguyên ở Hàm Tử; Toa Đô đổ bộ rồi rút chạy trong trận là Hư cấu của game. Toàn thư chép ông tử trận ở Tây Kết, tháng 5 năm ấy."),
  },
  {
    id: "B15-Q11", type: "timeline", panel: "K2", label: "Chính sử", seenRef: ["panel:K2", "card:B15-tran"],
    q: vi("Xếp các sự việc theo đúng thứ tự trước sau."),
    options: ["Hội nghị Bình Than: Quốc Toản không được dự bàn", "Quốc Toản dựng cờ sáu chữ, họp hơn nghìn gia binh", "Cánh quân Toa Đô từ phương nam tiến lên", "Quân Nguyên thua ở Hàm Tử quan, phải lui"],
    why: vi("Bình Than năm 1282; về nhà ông dựng cờ ngay sau đó (Toàn thư chép cùng năm). Năm 1285 cánh quân Toa Đô đánh lên từ phía nam, rồi thua ở Hàm Tử quan."),
  },
  // "Ai nói câu này" chỉ dùng câu có nguồn; sáu chữ trên cờ là chữ đề, không phải lời nói (reviewNotes panels.json)
  {
    id: "B15-Q12", type: "whoSaid", panel: "K1", label: "Chính sử", seenRef: ["panel:K1", "card:B15-coaotong"],
    q: vi("\"Có người Tống đến giúp!\" — Toàn thư chép ai đã kêu lên như thế ở Hàm Tử quan?"),
    options: ["Quân Nguyên, khi thấy người Tống đánh bên quân Trần", "Quân Trần, khi thuyền người Tống cập bến", "Triệu Trung, khi dẫn người Tống lên bãi", "Chiêu Văn vương Trần Nhật Duật, khi ra lệnh tiến quân"],
    why: vi("Toàn thư chép quân Nguyên thấy người Tống mặc áo Tống, cầm cung tên đánh bên quân Trần thì kinh hãi kêu \"Có người Tống đến giúp!\", rồi thua chạy."),
  },
  {
    id: "B15-Q13", type: "truefalse", panel: "O5", label: "Chính sử", seenRef: ["panel:O5", "card:H33"],
    q: vi("Những người mặc áo Tống ở Hàm Tử là quân Việt cải trang để đánh lừa quân Nguyên."),
    options: ["Đúng", "Sai"], answer: 1,
    why: vi("Sai. Họ là người Tống thật, sang nương nhờ khi nhà Tống mất và được Chiêu Văn vương thu nhận; áo Tống là áo của chính họ. Toàn thư không chép đây là mưu cải trang."),
  },
];

export const QUIZ_B15 = [
  ...COMIC_B15.quiz.map((q) => ({
    ...q, ...FROM_COMIC[q.panel], chapter: "B15", type: "mcq4", review: "draft",
    q: { vi: q.q.vi, en: q.q.en }, why: { vi: q.why.vi, en: q.why.en },
  })),
  ...NEW.map((q) => ({ answer: 0, chapter: "B15", review: "draft", contested: false, ...q })),
];
