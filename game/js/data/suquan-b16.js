// data/suquan-b16.js — thẻ Sử quán của Chương B16 Chương Dương (GDD 12.11) và ngân hàng Quiz chương (22.6). Cùng dạng với suquan-b20.js
// (nhóm thẻ dùng chung CARD_GROUPS của B15).
//
// Chữ lấy từ canon B16, H32, H35, X18 (history, bio, fate, caveats, dignity, sensitivity). Chưa qua cố vấn sử: review "draft" trên từng thẻ, từng
// câu. Chương chưa có comic nên thẻ không gắn khung (panels: []) và câu Quiz chỉ dùng seenRef "card:…".
//
// Luật nhạy cảm (canon B16.sensitivity, X18.dignity): kinh thành bị chiếm không có cảnh cướp phá; bài thơ có chữ "Hồ" chỉ ở thẻ Sử quán này, kèm
// bản dịch nghĩa trung tính, không đọc trong trận; Thoát Hoan là hoàng tử mang lệnh vua cha, không chế giễu.
//
// Khóa mở (unlock): "chapterOpen", "battleStart", "bossMet" (Thoát Hoan ra trận), "keSach:<id>" (danhUp, danBinh của battle-b16.js; chỉ mở khi
// Kế Sách thành công — meta/chapter.js battleUnlockKeys, như B20), "firstWin", "firstQuiz".

const TT = "Đại Việt sử ký toàn thư, Bản kỷ q.5 (năm Ất Dậu 1285; đối chiếu bản dịch Viện KHXH 1993)";
const NS = "Nguyên sử q.209, An Nam truyện";
const WIKI = "Trận Chương Dương độ (vi.wikipedia), theo canon B16";
const CANON = (id) => `Canon ${id} (GDD, tab ${id.startsWith("B") ? "Hồ sơ 30 trận" : id.startsWith("X") ? "Boss & tướng địch" : "Hồ sơ 56 tướng"})`;

export const CARDS = [
  {
    id: "B16-tran", chapter: "B16", group: "tran", label: "Chính sử", review: "draft",
    title: "Trận Chương Dương", unlock: "chapterOpen", hint: "Mở Chương Chương Dương.",
    body: [
      "Tháng 5 năm Ất Dậu (khoảng tháng 6/1285), sau trận Hàm Tử, quân Trần đánh bại quân Nguyên ở bến Chương Dương (nay thuộc Thường Tín, Hà Nội) rồi đánh vào kinh thành.",
      "Bến Chương Dương nằm trên sông Hồng, phía nam kinh thành Thăng Long.",
      "Bố cục trận trong game (ba làng, mười hai thuyền neo, xe húc, cổng nam, điện chính) là Hư cấu, dựng để chơi; bản thử còn đặt trên đất Hàm Tử.",
    ],
    src: [TT, WIKI, CANON("B16")], panels: [],
  },
  {
    id: "H32", chapter: "B16", group: "tuongta", label: "Chính sử", review: "draft",
    title: "Chiêu Minh vương Trần Quang Khải", unlock: "battleStart", hint: "Ra trận Chương Dương lần đầu.",
    body: [
      "Trần Quang Khải (1241–1294), con thứ ba của vua Trần Thái Tông, giữ chức Thượng tướng Thái sư.",
      "Đầu năm 1285 ông trấn giữ Nghệ An chặn cánh quân Toa Đô từ phía nam; tháng 5 năm ấy cùng Hoài Văn hầu Trần Quốc Toản và dân binh các lộ phá quân Nguyên ở Chương Dương và ở kinh thành.",
      "Sử chép ông thông hiểu tiếng nói các nước. Ông là tác giả bài \"Tụng giá hoàn kinh sư\" mừng xa giá trở về kinh.",
      "Cây cung Chiêu Minh và các kỹ năng của ông trong game là Hư cấu; bản thử chưa cho chơi ông.",
    ],
    src: [TT, CANON("H32")], panels: [],
  },
  {
    id: "H35-b16", chapter: "B16", group: "tuongta", label: "Chính sử", review: "draft",
    title: "Hoài Văn hầu ở Chương Dương", unlock: "battleStart", hint: "Ra trận Chương Dương lần đầu.",
    body: [
      "Sau Hàm Tử, Trần Quốc Toản theo Thượng tướng Trần Quang Khải đánh ở Chương Dương; Toàn thư ghi tên ông cùng Trần Thông, Nguyễn Khả Lạp và Nguyễn Truyền.",
      "Ông mất ngay trong năm 1285 khi còn rất trẻ.",
      "Gia binh, lá cờ sáu chữ \"Phá cường địch, báo hoàng ân\" là Chính sử; song đao của ông là chi tiết Hư cấu của game.",
    ],
    src: [TT, CANON("H35")], panels: [],
  },
  {
    id: "X18-b16", chapter: "B16", group: "tuongdich", label: "Chính sử", review: "draft",
    title: "Trấn Nam vương Thoát Hoan", unlock: "bossMet", hint: "Gặp Thoát Hoan ở sân điện.",
    body: [
      "Hoàng tử nhà Nguyên (脫歡, Toghon), con Hốt Tất Liệt, được phong Trấn Nam vương; tổng chỉ huy các cuộc tiến quân năm 1285 và 1287–1288.",
      "Hai lần ông chiếm được Thăng Long nhưng đều thiếu lương, phải rút. Năm 1285 ông rút về Tư Minh sau thất bại ở Vạn Kiếp.",
      "Hốt Tất Liệt sau đó đày ông ra trấn Dương Châu, suốt đời không cho vào chầu.",
      "Việc ông đích thân giữ thành và ra trận ở sân điện, ba lá Vương Kỳ quanh ông, là Hư cấu của game: ông đóng ở Thăng Long và rút ra sau trận Chương Dương.",
    ],
    src: [TT, NS, CANON("X18")], panels: [],
  },
  {
    id: "B16-danhup", chapter: "B16", group: "kesach", label: "Chính sử", review: "draft",
    title: "Đánh úp bến thuyền", unlock: "keSach:danhUp", hint: "Thành công Kế Sách \"Đánh úp bến thuyền\".",
    body: [
      "Toàn thư chép phần lớn thuyền Nguyên ở bến Chương Dương bị đốt hoặc đánh chìm.",
      "Trong game, Kế Sách thành thì quân Nguyên trong thành mất đường rút thủy và cổng nam núng thế; cách tiếp cận qua lau sậy, đê, lính cầm đuốc đốt kho cũng là Hư cấu.",
    ],
    src: [TT, CANON("B16")], panels: [],
  },
  {
    id: "B16-danbinh", chapter: "B16", group: "kesach", label: "Chính sử", review: "draft",
    title: "Dân binh các lộ", unlock: "keSach:danBinh", hint: "Thành công Kế Sách \"Dân binh các lộ\".",
    body: [
      "Toàn thư chép Trần Quang Khải cùng Trần Quốc Toản, Trần Thông, Nguyễn Khả Lạp và em là Nguyễn Truyền đem dân binh các lộ đánh ở Chương Dương và kinh thành.",
      "Tên ba làng và việc gọi dân binh từng làng trong game là Hư cấu.",
    ],
    src: [TT, CANON("B16")], panels: [],
  },
  {
    id: "B16-tho", chapter: "B16", group: "sukien", label: "Chính sử", review: "draft",
    title: "Tụng giá hoàn kinh sư", unlock: "firstWin", hint: "Thắng trận Chương Dương lần đầu.",
    body: [
      "Bài thơ ngũ ngôn của Trần Quang Khải, làm khi theo xa giá trở về kinh sau chiến thắng năm 1285:",
      "\"Đoạt sáo Chương Dương độ, Cầm Hồ Hàm Tử quan. Thái bình tu trí lực, Vạn cổ thử giang san.\"",
      "Dịch nghĩa: Đoạt giáo ở bến Chương Dương, bắt quân Nguyên ở cửa Hàm Tử. Thái bình rồi nên dốc sức, non sông này còn mãi muôn đời.",
      "Chữ \"Hồ\" trong nguyên văn là cách gọi người phương Bắc thời ấy; bản dịch nghĩa ở đây viết \"quân Nguyên\", và game không đọc bài thơ trong trận.",
    ],
    src: [TT, CANON("B16"), CANON("H32")], panels: [],
  },
  {
    id: "B16-thanglong", chapter: "B16", group: "sukien", label: "Chính sử", review: "draft",
    title: "Thu hồi Thăng Long", unlock: "firstWin", hint: "Thắng trận Chương Dương lần đầu.",
    body: [
      "Sau Chương Dương, quân Trần thu hồi kinh thành Thăng Long; mốc thời gian thường gặp là khoảng tháng 6/1285 (theo en.wikipedia).",
      "Quân Nguyên rút lên phía bắc; tiếp đó là trận Tây Kết (Toa Đô tử trận) và trận Vạn Kiếp, Thoát Hoan rút về nước.",
      "Game không dựng cảnh cướp phá kinh thành; trận kết bằng việc cắm cờ trên điện chính.",
    ],
    src: [TT, CANON("B16")], panels: [],
  },
  {
    id: "B16-benle", chapter: "B16", group: "benle", label: "Chính sử", review: "draft",
    title: "Ai đánh ở Chương Dương?", unlock: "firstQuiz", hint: "Xong lượt Quiz Chương Dương đầu tiên.",
    body: [
      "Toàn thư liệt kê Trần Quang Khải, Trần Quốc Toản, Trần Thông, Nguyễn Khả Lạp và Nguyễn Truyền.",
      "Nhiều tài liệu hiện đại kể thêm Phạm Ngũ Lão trong trận này; game không cho ông ra trận ở Chương Dương vì Toàn thư không ghi.",
      "Chỉ huy Nguyên ở bến không được sử ghi rõ; vi.wikipedia gắn lực lượng ở bến với cánh quân của Toa Đô.",
    ],
    src: [TT, WIKI, CANON("B16")], panels: [],
  },
];

export const CARD_BY_ID = Object.fromEntries(CARDS.map((c) => [c.id, c]));

// ---- Quiz chương B16 (22.6) ------------------------------------------------------------------------
// Schema như QUIZ_B20; đáp án đúng ở vị trí 0 (trừ đúng/sai), seenRef chỉ "card:…" (chưa có comic).
const vi = (s) => ({ vi: s, en: null });
const Q = [
  {
    id: "B16-Q01", type: "mcq4", label: "Chính sử", seenRef: ["card:H32", "card:B16-tran"], src: [TT],
    q: vi("Năm 1285, ai cùng Hoài Văn hầu Trần Quốc Toản đem dân binh đánh quân Nguyên ở bến Chương Dương?"),
    options: ["Thượng tướng Thái sư Trần Quang Khải", "Hưng Đạo vương Trần Quốc Tuấn", "Trần Khánh Dư", "Chiêu Văn vương Trần Nhật Duật"],
    why: vi("Toàn thư chép Trần Quang Khải cùng Trần Quốc Toản, Trần Thông, Nguyễn Khả Lạp, Nguyễn Truyền đem dân binh các lộ đánh ở Chương Dương và kinh thành."),
  },
  {
    id: "B16-Q02", type: "truefalse", label: "Chính sử", seenRef: ["card:B16-danhup", "card:B16-tran"], src: [TT],
    q: vi("Phần lớn thuyền Nguyên ở bến Chương Dương bị quân Trần đốt hoặc đánh chìm."),
    options: ["Đúng", "Sai"], answer: 0,
    why: vi("Đúng. Toàn thư chép phần lớn thuyền Nguyên ở bến bị đốt hoặc đánh chìm."),
  },
  {
    id: "B16-Q03", type: "whoSaid", label: "Chính sử", seenRef: ["card:B16-tho", "card:H32"], src: [TT, CANON("H32")],
    q: vi("\"Thái bình tu trí lực, vạn cổ thử giang san\" là hai câu cuối trong bài thơ của ai?"),
    options: ["Trần Quang Khải", "Vua Trần Nhân Tông", "Phạm Ngũ Lão", "Hưng Đạo vương Trần Quốc Tuấn"],
    why: vi("Đó là hai câu cuối bài \"Tụng giá hoàn kinh sư\" của Trần Quang Khải, làm khi theo xa giá về kinh sau chiến thắng năm 1285."),
  },
  {
    id: "B16-Q04", type: "mcq4", label: "Chính sử", seenRef: ["card:B16-tran"], src: [WIKI, CANON("B16")],
    q: vi("Bến Chương Dương xưa nay thuộc vùng nào?"),
    options: ["Thường Tín, Hà Nội", "Quảng Yên, Quảng Ninh", "Khoái Châu, Hưng Yên", "Vạn Kiếp, Hải Dương"],
    why: vi("Bến Chương Dương trên sông Hồng, nay thuộc huyện Thường Tín, Hà Nội. Quảng Yên là nơi có bãi cọc Bạch Đằng."),
  },
  {
    id: "B16-Q05", type: "timeline", label: "Chính sử", seenRef: ["card:B16-thanglong", "card:B16-tran"], src: [TT],
    q: vi("Xếp các sự việc theo đúng thứ tự trước sau."),
    options: ["Hội nghị Bình Than, Quốc Toản bóp nát quả cam", "Trận Hàm Tử", "Trận Chương Dương", "Thoát Hoan rút về Tư Minh"],
    why: vi("Hội nghị Bình Than năm 1282; trận Hàm Tử tháng 4 và Chương Dương tháng 5 năm Ất Dậu (1285); sau thất bại ở Vạn Kiếp, Thoát Hoan rút về Tư Minh."),
  },
  {
    id: "B16-Q06", type: "mcq4", label: "Chính sử", seenRef: ["card:X18-b16"], src: [TT, NS],
    q: vi("Thoát Hoan, người chỉ huy quân Nguyên năm 1285, là ai?"),
    options: ["Hoàng tử nhà Nguyên, con Hốt Tất Liệt, Trấn Nam vương", "Tướng thủy quân người Sắc mục", "Tướng nhà Tống lưu vong", "Vua Chiêm Thành"],
    why: vi("Thoát Hoan (Toghon) là con Hốt Tất Liệt, được phong Trấn Nam vương, tổng chỉ huy các cuộc tiến quân năm 1285 và 1287–1288."),
  },
  {
    id: "B16-Q07", type: "truefalse", label: "Hư cấu", seenRef: ["card:X18-b16"], src: [TT, CANON("B16")],
    q: vi("Sử chép Thoát Hoan đích thân cầm quân đánh ở sân điện Thăng Long trong trận Chương Dương."),
    options: ["Đúng", "Sai"], answer: 1,
    why: vi("Sai. Đó là Hư cấu của game: Thoát Hoan đóng ở Thăng Long và rút ra sau đó; sử không chép ông đánh ở Chương Dương."),
  },
  {
    id: "B16-Q08", type: "mcq4", label: "Chính sử", seenRef: ["card:B16-danbinh", "card:B16-benle"], src: [TT],
    q: vi("Theo Toàn thư, lực lượng nào cùng các tướng Trần đánh ở Chương Dương và kinh thành?"),
    options: ["Dân binh các lộ", "Quân Tống lưu vong mặc áo Tống", "Quân Chiêm Thành", "Thủy quân của Ô Mã Nhi"],
    why: vi("Toàn thư chép các tướng đem dân binh các lộ. Quân mặc áo Tống (gia tướng Triệu Trung) là chuyện ở Hàm Tử; Ô Mã Nhi là tướng Nguyên."),
  },
  {
    id: "B16-Q09", type: "truefalse", label: "Chính sử", seenRef: ["card:B16-tho"], src: [TT],
    q: vi("Câu thơ \"Đoạt sáo Chương Dương độ\" nói về việc đoạt giáo của quân Nguyên ở bến Chương Dương."),
    options: ["Đúng", "Sai"], answer: 0,
    why: vi("Đúng. \"Đoạt sáo\" là đoạt giáo (của quân Nguyên); \"Chương Dương độ\" là bến Chương Dương."),
  },
  {
    id: "B16-Q10", type: "mcq4", label: "Chính sử", seenRef: ["card:B16-thanglong", "card:B16-tran"], src: [TT, CANON("B16")],
    q: vi("Thắng ở Chương Dương rồi, quân Trần thu hồi nơi nào?"),
    options: ["Kinh thành Thăng Long", "Vạn Kiếp", "Vân Đồn", "Thiên Trường"],
    why: vi("Sau Chương Dương, quân Trần đánh vào kinh thành và thu hồi Thăng Long, khoảng tháng 6/1285."),
  },
  {
    id: "B16-Q11", type: "mcq4", label: "Chính sử", seenRef: ["card:H32"], src: [TT, CANON("H32")],
    q: vi("Năm 1285 Trần Quang Khải giữ chức gì?"),
    options: ["Thượng tướng Thái sư", "Quốc công Tiết chế", "Nhân Huệ vương, Phó tướng quân", "Hành khiển"],
    why: vi("Trần Quang Khải là Thượng tướng Thái sư. Quốc công Tiết chế là Hưng Đạo vương; Nhân Huệ vương là Trần Khánh Dư."),
  },
];

export const QUIZ_B16 = Q.map((q) => ({ answer: 0, chapter: "B16", review: "draft", contested: false, panel: null, ...q }));
