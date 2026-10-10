// data/suquan-b17.js — thẻ Sử quán của Chương B17 Tây Kết (GDD 12.11) và ngân hàng Quiz chương (22.6), đợt A3. Cùng dạng với suquan-b16.js
// (nhóm thẻ dùng chung CARD_GROUPS của B15).
//
// Chữ lấy từ canon B17, H30, H31, H38, H39, H40, X19, X20 (history, bio, fate, caveats, dignity, sensitivity), đối chiếu đoạn Toàn thư năm 1285
// trích ở nghiencuuquocte.org. Chưa qua cố vấn sử: review "draft" trên từng thẻ, từng câu. Chương chưa có comic nên thẻ không gắn khung (panels: [])
// và câu Quiz chỉ dùng seenRef "card:…".
//
// Luật nhạy cảm (canon B17.sensitivity, X19.dignity, H30.notes; kiểm ở tests/b17-content.test.mjs):
// - không cảnh chém đầu, không chữ "thủ cấp" (ở thẻ cũng không: thẻ áo ngự viết "thấy Toa Đô đã tử trận");
// - không gán công giết Toa Đô cho ai: các thuyết (Nguyễn Khoái bắn, Hưng Đạo vương chỉ huy, Dã Tượng) chỉ nêu kèm "sử không ghi";
// - hai chữ thích trên tay năm 1285 có từ miệt thị: chỉ ở thẻ B17-thichchu, kèm giải nghĩa trung tính; không ở Quiz, không ở chữ trong trận;
// - Toa Đô là tướng tận trung có danh dự; chữ của thẻ và Quiz gọi "quân Nguyên", không gọi "giặc".
//
// Khóa mở (unlock): "chapterOpen", "battleStart", "bossMet" (Toa Đô ra trận), "keSach:phucKich", "keSach:hoiKe" (chỉ mở khi Kế Sách thành công — meta/chapter.js
// battleUnlockKeys, như B16, B20), "firstWin", "firstQuiz". Thẻ hỏi kế (B17-hoike) mở khi Kế Sách Nhỏ "Hỏi kế Quốc công" thành công.

const TT = "Đại Việt sử ký toàn thư, Bản kỷ q.5 (năm Ất Dậu 1285; đối chiếu bản dịch Viện KHXH 1993)";
const TT87 = "Đại Việt sử ký toàn thư, Bản kỷ q.5 (năm Đinh Hợi 1287; đối chiếu bản dịch Viện KHXH 1993)";
const NCQT = "Đại Việt đánh bại quân Nguyên Mông lần thứ hai (nghiencuuquocte.org, 2020, trích Toàn thư kèm chú thích)";
const NS = "Nguyên sử q.209, An Nam truyện";
const NS_TD = "Nguyên sử, truyện Toa Đô (thụy Tương Mẫn; theo canon X19)";
const ANCL = "An Nam chí lược (Lê Tắc), dẫn theo chú thích bản dịch Toàn thư ở nghiencuuquocte.org";
const QUAT = "Truyền thuyết và thần tích đền Quát (theo canon H38)";
const CANON = (id) => `Canon ${id} (GDD, tab ${id.startsWith("B") ? "Hồ sơ 30 trận" : id.startsWith("X") ? "Boss & tướng địch" : "Hồ sơ 56 tướng"})`;

export const CARDS = [
  {
    id: "B17-tran", chapter: "B17", group: "tran", label: "Chính sử", review: "draft",
    title: "Trận Tây Kết (1285)", unlock: "chapterOpen", hint: "Mở Chương Tây Kết.",
    body: [
      "Ngày 20 tháng 5 năm Ất Dậu (1285), quân Trần đánh bại quân Nguyên ở Tây Kết, vùng Khoái Châu (nay thuộc Hưng Yên). Nguyên soái Toa Đô tử trận.",
      "Toa Đô kéo quân từ phía nam lên, không biết Thoát Hoan đã rút khỏi Thăng Long, định về Tây Kết rồi theo đường sông ra biển. Sau trận, Ô Mã Nhi cùng tàn quân chạy ra biển.",
      "Ngày dương lịch quy đổi không thống nhất giữa các tài liệu; mốc thường gặp là khoảng 24/6/1285.",
      "Ba đồn dọc đường đê, hai bãi lau phục binh, các gò đất và mốc cửa sông trong game là Hư cấu, dựng để chơi; bản thử còn đặt trên đất Hàm Tử.",
    ],
    src: [TT, NCQT, CANON("B17")], panels: [],
  },
  {
    id: "X19-b17", chapter: "B17", group: "tuongdich", label: "Chính sử", review: "draft",
    title: "Toa Đô ở Tây Kết", unlock: "bossMet", hint: "Gặp Toa Đô trên đường ra biển.",
    body: [
      "Toa Đô (唆都, Sögetü), người Jalair, danh tướng nhà Nguyên từng dự trận Tương Dương. Năm 1282–1283 ông đem thủy quân từ Quảng Châu đánh Chiêm Thành, chiếm kinh đô Vijaya.",
      "Đầu năm 1285 ông từ phía nam đánh vào Đại Việt, thắng ở Nghệ An và Thanh Hóa rồi tiến lên phía bắc; quân Trần chặn ông ở Hàm Tử.",
      "Toàn thư chép ông tử trận ở Tây Kết. Sử nhà Nguyên chép ông tử trận trong lúc rút quân. Nhà Nguyên truy tặng ông thụy Tương Mẫn.",
      "Game dựng ông là một tướng tận trung, đánh tới cùng. Cánh quân hành quân ra biển, Quân Viễn Chinh, Chí Tử Chiến và đòn bổ đại phủ là Hư cấu về cơ chế.",
    ],
    src: [TT, NS, NS_TD, CANON("X19")], panels: [],
  },
  {
    id: "B17-aongu", chapter: "B17", group: "sukien", label: "Chính sử", review: "draft",
    title: "Áo ngự khâm liệm Toa Đô", unlock: "firstWin", hint: "Thắng trận Tây Kết lần đầu.",
    body: [
      "Toàn thư chép: sau trận Tây Kết, vua Trần Nhân Tông thấy Toa Đô đã tử trận, thương mà nói \"Người làm tôi phải nên như thế này\", rồi cởi áo ngự, sai quân khâm liệm và chôn cất ông.",
      "Toa Đô là tướng bên kia, đã đánh vào Đại Việt từ phía nam. Lời bàn của sử gia Ngô Sĩ Liên trong Toàn thư khen lời vua làm sáng nghĩa bề tôi trung với chủ, và việc cởi áo ngự khâm liệm còn hơn thế nữa.",
      "Game giữ chi tiết này làm điểm nhấn danh dự của phe đối địch: Toa Đô ngã xuống trong trận, không có cảnh máu me. Comic kết Chương (sẽ có) dựng cảnh vua đứng trước linh cữu phủ áo ngự.",
    ],
    src: [TT, NCQT, CANON("B17"), CANON("H30")], panels: [],
  },
  {
    id: "H40", chapter: "B17", group: "tuongta", label: "Chính sử", review: "draft",
    title: "Nguyễn Khoái và quân Thánh Dực", unlock: "battleStart", hint: "Ra trận Tây Kết lần đầu.",
    body: [
      "Tướng người Hồng Châu, chỉ huy quân Thánh Dực của nhà Trần.",
      "Toàn thư chép mùa hạ tháng 4 năm 1285, vua sai Chiêu Thành vương, Hoài Văn hầu Trần Quốc Toản và tướng quân Nguyễn Khoái đem quân đón đánh quân Nguyên ở bến Tây Kết; sau đó quân Trần giao chiến ở Hàm Tử.",
      "Theo tài liệu hiện đại, năm 1288 ông được giao chặn luồng sông, dụ thủy quân Nguyên vào bãi cọc Bạch Đằng, sau được phong Liệt hầu, ban ấp Khoái Lộ. Năm sinh, năm mất (1240–1300) theo tài liệu địa phương, chưa đối chiếu chính sử.",
      "Có bài viết hiện đại nói chính ông bắn chết Toa Đô; Toàn thư không ghi điều đó, nên game không theo. Cung Thánh Dực, tên móc kéo thuyền và các kỹ năng của ông là Hư cấu.",
    ],
    src: [TT, NCQT, CANON("H40")], panels: [],
  },
  {
    id: "H31-b17", chapter: "B17", group: "tuongta", label: "Chính sử", review: "draft",
    title: "Hưng Đạo vương có ở Tây Kết?", unlock: "battleStart", hint: "Ra trận Tây Kết lần đầu.",
    body: [
      "Quốc công Tiết chế Trần Quốc Tuấn thống lĩnh quân Trần trong cuộc kháng chiến năm 1285.",
      "Một số tài liệu hiện đại kể ông có mặt, chỉ huy ở Tây Kết. Đoạn Toàn thư chép trận Tây Kết không nêu tên ông; cũng quãng ấy, Toàn thư chép ông đánh bại Thoát Hoan và Lý Hằng ở Vạn Kiếp.",
      "Vì vậy game chỉ đặt ông ở bản doanh làm tướng đồng minh. Việc ông hỏi người chơi đặt phục binh ở bãi lau nào là Hư cấu.",
    ],
    src: [TT, NCQT, CANON("H31"), CANON("B17")], panels: [],
  },
  {
    id: "X20-b17", chapter: "B17", group: "tuongdich", label: "Chính sử", review: "draft",
    title: "Ô Mã Nhi ra biển", unlock: "firstWin", hint: "Thắng trận Tây Kết lần đầu.",
    body: [
      "Vạn hộ thủy quân nhà Nguyên, người Sắc mục (烏馬兒, Omar). Ông từng cùng Toa Đô đánh Chiêm Thành; năm 1285 chỉ huy chiến thuyền đánh vào Đại Việt.",
      "Toàn thư chép sau khi Toa Đô tử trận, Ô Mã Nhi nửa đêm trốn qua cửa sông Thanh Hóa; hai vua đuổi theo không kịp. Ông chỉ còn một chiếc thuyền vượt biển thoát về.",
      "Ba năm sau, ông trở lại chỉ huy thủy quân Nguyên và bị bắt sống ở Bạch Đằng năm 1288 (xem Chương Bạch Đằng).",
      "Bến tàn quân và những chuyến thuyền rời bến trong game là Hư cấu.",
    ],
    src: [TT, NCQT, CANON("X20")], panels: [],
  },
  {
    id: "B17-giatuong", chapter: "B17", group: "tuongta", label: "Tương truyền", review: "draft",
    title: "Yết Kiêu, Dã Tượng ở Tây Kết", unlock: "battleStart", hint: "Ra trận Tây Kết lần đầu.",
    body: [
      "Hai gia tướng của Hưng Đạo vương. Toàn thư chép đầu năm 1285, khi quân Trần lui từ Vạn Kiếp, Yết Kiêu giữ thuyền ở bãi Tân, còn Dã Tượng theo Hưng Đạo vương và nói: \"Yết Kiêu chưa thấy Đại Vương thì nhất định không dời thuyền.\" Phần này là Chính sử.",
      "Toàn thư không chép hai ông đánh ở Tây Kết. Việc hai ông quấy rối cánh Toa Đô từ lạch nước trong game là Tương truyền.",
      "Chuyện Yết Kiêu lặn sông đục thuyền theo truyền thuyết và thần tích đền Quát; tài điều khiển voi chiến của Dã Tượng là truyền ngôn gắn với cái tên \"voi rừng\". Có truyền ngôn gán cho Dã Tượng công bắt Toa Đô, nhưng không có nguồn chính sử; game không theo.",
    ],
    src: [TT, NCQT, QUAT, CANON("H38"), CANON("H39")], panels: [],
  },
  {
    id: "B17-hoike", chapter: "B17", group: "kesach", label: "Hư cấu", review: "draft",
    title: "Hỏi kế ở bản doanh", unlock: "keSach:hoiKe", hint: "Thành công Kế Sách \"Hỏi kế Quốc công\".",
    body: [
      "Mở Chương, game dựng cảnh bàn kế đặt phục binh ở bản doanh trước trận Tây Kết. Đặt cuộc hỏi kế vào năm 1285 là Hư cấu về bối cảnh.",
      "Toàn thư chép lần vua Trần Nhân Tông hỏi Hưng Đạo vương về tình thế quân Nguyên vào cuối năm 1287, khi quân Nguyên sang lần thứ ba. Ông đáp rằng năm nay đánh sẽ nhàn, quân ta đã quen trận, phá được quân Nguyên là điều chắc chắn.",
      "Kế Sách Nhỏ \"Hỏi kế Quốc công\" và việc chọn bãi lau đặt phục binh mượn từ cuộc hỏi kế ấy; cơ chế là Hư cấu.",
    ],
    src: [TT87, CANON("B17"), CANON("H30")], panels: [],
  },
  {
    id: "B17-phuckich", chapter: "B17", group: "kesach", label: "Hư cấu", review: "draft",
    title: "Phục kích bãi lau", unlock: "keSach:phucKich", hint: "Thành công Kế Sách \"Phục kích bãi lau\".",
    body: [
      "Toàn thư chép quân Trần đánh bại quân Nguyên ở Tây Kết, giết và làm bị thương nhiều người, nhưng không tả cách bày trận.",
      "Phục binh trong bãi lau, hai cánh Giữ vững, tướng đứng xa ngoài 40 m và Lệnh Kế Sách trong 30 giây là cách game dựng trận, không phải chuyện sử chép.",
      "Kế Sách thành thì đội hình Nguyên vỡ, Sĩ Khí cánh Toa Đô giảm mạnh và ông đứng lại cố thủ trên gò; các con số này cũng là Hư cấu.",
    ],
    src: [TT, NCQT, CANON("B17")], panels: [],
  },
  {
    id: "B17-aigiet", chapter: "B17", group: "benle", label: "Chính sử", review: "draft",
    title: "Ai giết Toa Đô?", unlock: "firstWin", hint: "Thắng trận Tây Kết lần đầu.",
    body: [
      "Toàn thư chỉ chép chung rằng quân ta đánh bại quân Nguyên ở Tây Kết và giết được nguyên soái Toa Đô; sử không ghi tên người trực tiếp ra tay.",
      "Có bài viết hiện đại nói Nguyễn Khoái bắn ông, có tài liệu nói Hưng Đạo vương chỉ huy trận, có truyền ngôn nhắc Dã Tượng. Không thuyết nào có trong chính sử.",
      "An Nam chí lược của Lê Tắc chép một thuyết khác nữa: Toa Đô phóng ngựa, rơi xuống nước mà chết. Sử nhà Nguyên chép ông tử trận trong lúc rút quân.",
      "Vì vậy game không gán công giết Toa Đô cho ai: trong trận, ông ngã xuống khi Sinh lực về 0, bất kể ai ra đòn cuối.",
    ],
    src: [TT, ANCL, NS, CANON("B17"), CANON("H40")], panels: [],
  },
  {
    id: "B17-thichchu", chapter: "B17", group: "benle", label: "Chính sử", review: "draft",
    title: "Chữ thích trên cánh tay (1285)", unlock: "firstQuiz", hint: "Xong lượt Quiz Tây Kết đầu tiên.",
    body: [
      "Toàn thư chép tháng giêng năm 1285, quân Nguyên bắt được quân Trần, thấy người nào cũng thích bằng mực hai chữ \"Sát Thát\" trên cánh tay.",
      "Bị Ô Mã Nhi trách, sứ thần Đỗ Khắc Chung đáp rằng quân sĩ vì lòng trung phẫn mà tự thích, nhà vua không biết việc ấy.",
      "\"Thát\" là gọi tắt Thát Đát (Tatar), tên người thời ấy dùng chỉ quân Mông Cổ với ý khinh miệt. Thẻ này ghi lại chi tiết như một sự kiện sử; trận Tây Kết không dùng hai chữ ấy làm khẩu hiệu.",
    ],
    src: [TT, NCQT, CANON("H30")], panels: [],
  },
];

export const CARD_BY_ID = Object.fromEntries(CARDS.map((c) => [c.id, c]));

// ---- Quiz chương B17 (22.6) ------------------------------------------------------------------------
// Schema như QUIZ_B16; đáp án đúng ở vị trí 0 (trừ đúng/sai), seenRef chỉ "card:…" (chưa có comic). Không câu nào nhắc hai chữ thích trên tay.
const vi = (s) => ({ vi: s, en: null });
const Q = [
  {
    id: "B17-Q01", type: "mcq4", label: "Chính sử", seenRef: ["card:B17-aongu"], src: [TT],
    q: vi("Toàn thư chép sau trận Tây Kết, vua Trần Nhân Tông đã làm gì cho Toa Đô?"),
    options: ["Cởi áo ngự, sai quân khâm liệm và chôn cất ông", "Sai đưa ông về trả cho Thoát Hoan", "Truy phong cho ông tước hầu của Đại Việt", "Sai dựng đền thờ ông bên bến Tây Kết"],
    why: vi("Toàn thư chép vua thương Toa Đô, nói người làm tôi phải nên như thế, rồi cởi áo ngự sai quân khâm liệm và chôn cất ông."),
  },
  {
    id: "B17-Q02", type: "whoSaid", label: "Chính sử", seenRef: ["card:B17-aongu"], src: [TT],
    q: vi("\"Người làm tôi phải nên như thế này.\" Toàn thư chép ai nói câu ấy về Toa Đô?"),
    options: ["Vua Trần Nhân Tông", "Hưng Đạo vương Trần Quốc Tuấn", "Ô Mã Nhi", "Thoát Hoan"],
    why: vi("Đó là lời vua Trần Nhân Tông sau trận Tây Kết, trước khi cởi áo ngự sai khâm liệm Toa Đô. Sử gia Ngô Sĩ Liên khen lời ấy làm sáng nghĩa trung với chủ."),
  },
  {
    id: "B17-Q03", type: "truefalse", label: "Chính sử", seenRef: ["card:B17-aigiet", "card:X19-b17"], src: [TT, CANON("B17")],
    q: vi("Toàn thư ghi rõ tên người đã giết Toa Đô ở Tây Kết."),
    options: ["Đúng", "Sai"], answer: 1,
    why: vi("Sai. Toàn thư chỉ chép chung quân ta giết được Toa Đô ở Tây Kết. Các thuyết nêu tên người ra tay không có trong chính sử, nên game không gán công cho ai."),
  },
  {
    id: "B17-Q04", type: "mcq4", label: "Chính sử", seenRef: ["card:B17-tran", "card:X19-b17"], src: [TT, CANON("B17")],
    q: vi("Vì sao Toa Đô kéo quân về Tây Kết?"),
    options: ["Ông không biết Thoát Hoan đã rút, định theo đường sông ra biển", "Ông đuổi theo hai vua Trần đang lui về Thiên Trường", "Ông đi đón đoàn thuyền lương từ Vân Đồn", "Ông được lệnh đóng quân giữ Khoái Châu qua mùa mưa"],
    why: vi("Toa Đô từ phía nam lên, không biết Thoát Hoan đã rút khỏi Thăng Long, nên kéo về Tây Kết định ra biển. Đoàn thuyền lương ở Vân Đồn là chuyện năm 1288."),
  },
  {
    id: "B17-Q05", type: "mcq4", label: "Chính sử", seenRef: ["card:X19-b17"], src: [CANON("X19")],
    q: vi("Trước khi vào Đại Việt năm 1285, Toa Đô đem thủy quân từ Quảng Châu đánh nước nào?"),
    options: ["Chiêm Thành", "Chân Lạp", "Ai Lao", "Nhật Bản"],
    why: vi("Năm 1282–1283 Toa Đô đem thủy quân từ Quảng Châu đánh Chiêm Thành, chiếm kinh đô Vijaya, rồi từ phía nam đánh vào Đại Việt năm 1285."),
  },
  {
    id: "B17-Q06", type: "mcq4", label: "Chính sử", seenRef: ["card:X19-b17", "card:B17-aigiet"], src: [NS, CANON("X19")],
    q: vi("Sử nhà Nguyên chép Toa Đô tử trận trong hoàn cảnh nào?"),
    options: ["Trong lúc rút quân", "Khi vây kinh thành Thăng Long", "Trong trận Bạch Đằng", "Khi đang đánh Chiêm Thành"],
    why: vi("Sử nhà Nguyên chép ông tử trận khi rút quân; Toàn thư chép ông tử trận ở Tây Kết năm 1285, ba năm trước trận Bạch Đằng."),
  },
  {
    id: "B17-Q07", type: "truefalse", label: "Chính sử", seenRef: ["card:X19-b17"], src: [NS_TD, CANON("X19")],
    q: vi("Nhà Nguyên truy tặng Toa Đô thụy hiệu Tương Mẫn."),
    options: ["Đúng", "Sai"], answer: 0,
    why: vi("Đúng. Sau khi ông tử trận, nhà Nguyên truy tặng thụy Tương Mẫn."),
  },
  {
    id: "B17-Q08", type: "mcq4", label: "Chính sử", seenRef: ["card:H40"], src: [TT, CANON("H40")],
    q: vi("Nguyễn Khoái chỉ huy đạo quân nào của nhà Trần?"),
    options: ["Quân Thánh Dực", "Gia binh của Hoài Văn hầu", "Quân áo Tống của Chiêu Văn vương", "Dân binh các lộ ở Chương Dương"],
    why: vi("Nguyễn Khoái là tướng quân Thánh Dực. Gia binh là của Trần Quốc Toản, quân áo Tống là người Tống trong quân Chiêu Văn vương Trần Nhật Duật, còn dân binh các lộ đánh ở Chương Dương cùng Trần Quang Khải."),
  },
  {
    id: "B17-Q09", type: "truefalse", label: "Hư cấu", seenRef: ["card:B17-hoike"], src: [TT87, CANON("B17")],
    q: vi("Toàn thư chép vua Nhân Tông hỏi kế Hưng Đạo vương ngay trước trận Tây Kết năm 1285."),
    options: ["Đúng", "Sai"], answer: 1,
    why: vi("Sai. Toàn thư ghi lần vua hỏi Hưng Đạo vương về tình thế quân Nguyên vào cuối năm 1287. Game đặt cuộc hỏi kế vào Tây Kết là Hư cấu về bối cảnh."),
  },
  {
    id: "B17-Q10", type: "truefalse", label: "Tương truyền", seenRef: ["card:B17-giatuong"], src: [TT, CANON("H38"), CANON("H39")],
    q: vi("Toàn thư chép Yết Kiêu và Dã Tượng đánh ở Tây Kết."),
    options: ["Đúng", "Sai"], answer: 1,
    why: vi("Sai. Toàn thư có chép hai ông đầu năm 1285 (Yết Kiêu giữ thuyền ở bãi Tân chờ Hưng Đạo vương), nhưng việc hai ông đánh ở Tây Kết là Tương truyền."),
  },
  {
    id: "B17-Q11", type: "whoSaid", label: "Chính sử", seenRef: ["card:B17-giatuong"], src: [TT, CANON("H39")],
    q: vi("\"Yết Kiêu chưa thấy Đại Vương thì nhất định không dời thuyền.\" Toàn thư chép ai nói câu này?"),
    options: ["Dã Tượng", "Yết Kiêu", "Nguyễn Khoái", "Trần Quốc Toản"],
    why: vi("Đó là lời Dã Tượng năm 1285, khi theo Hưng Đạo vương lui quân; Yết Kiêu giữ thuyền ở bãi Tân chờ chủ tướng."),
  },
  {
    id: "B17-Q12", type: "mcq4", label: "Chính sử", seenRef: ["card:X20-b17"], src: [TT, CANON("X20")],
    q: vi("Sau khi Toa Đô tử trận, Ô Mã Nhi làm gì?"),
    options: ["Trốn ra biển, chỉ còn một chiếc thuyền thoát về", "Đầu hàng hai vua Trần ở Khoái Châu", "Lên thay Toa Đô chỉ huy cánh quân phía nam", "Theo Thoát Hoan rút đường bộ về Tư Minh"],
    why: vi("Toàn thư chép Ô Mã Nhi trốn qua cửa sông Thanh Hóa, hai vua đuổi không kịp; ông chỉ còn một chiếc thuyền vượt biển thoát về. Năm 1288 ông bị bắt sống ở Bạch Đằng."),
  },
  {
    id: "B17-Q13", type: "timeline", label: "Chính sử", seenRef: ["card:X19-b17", "card:B17-hoike"], src: [TT, TT87, CANON("X19")],
    q: vi("Xếp các sự việc theo đúng thứ tự trước sau."),
    options: ["Toa Đô đem thủy quân từ Quảng Châu đánh Chiêm Thành", "Trận Hàm Tử", "Trận Tây Kết, Toa Đô tử trận", "Vua Nhân Tông hỏi Hưng Đạo vương về tình thế quân Nguyên"],
    why: vi("Toa Đô đánh Chiêm Thành năm 1282–1283; trận Hàm Tử tháng 4 và trận Tây Kết tháng 5 năm Ất Dậu (1285); cuộc hỏi kế được Toàn thư ghi cuối năm 1287."),
  },
  {
    id: "B17-Q14", type: "mcq4", label: "Chính sử", seenRef: ["card:B17-tran"], src: [NCQT, CANON("B17")],
    q: vi("Trận Tây Kết diễn ra ở vùng nào?"),
    options: ["Khoái Châu, nay thuộc Hưng Yên", "Thường Tín, Hà Nội", "Quảng Yên, Quảng Ninh", "Vạn Kiếp, Hải Dương"],
    why: vi("Tây Kết thuộc vùng Khoái Châu, nay thuộc Hưng Yên. Thường Tín có bến Chương Dương; Quảng Yên có bãi cọc Bạch Đằng."),
  },
  {
    id: "B17-Q15", type: "truefalse", label: "Hư cấu", seenRef: ["card:B17-phuckich", "card:B17-tran"], src: [TT, CANON("B17")],
    q: vi("Ba đồn dọc đường và hai bãi lau phục binh trong game dựng đúng theo cách bày trận Tây Kết mà sử chép."),
    options: ["Đúng", "Sai"], answer: 1,
    why: vi("Sai. Toàn thư không tả cách bày trận ở Tây Kết; đồn, bãi lau, gò và mốc cửa sông là Hư cấu, dựng để chơi."),
  },
];

export const QUIZ_B17 = Q.map((q) => ({ answer: 0, chapter: "B17", review: "draft", contested: false, panel: null, ...q }));
