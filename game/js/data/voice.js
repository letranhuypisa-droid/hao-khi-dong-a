// data/voice.js — lồng tiếng (đợt 16): dàn giọng, lời thoại của tướng ta khi tung chiêu, của tướng Mông-Nguyên khi giáp mặt.
// Thuần dữ liệu: battle/voice.js (động cơ phát) và design/tools/ai33-audio.mjs (sinh giọng bằng ai33) cùng đọc tệp này, nên lời thoại chỉ nằm một chỗ.
//
// Lời tướng ta nói bằng tiếng Việt, hiện nguyên văn làm phụ đề. Tướng địch nói tiếng Trung phổ thông (`zh`, thư viện giọng ai33 không có
// giọng Mông Cổ; lời lệnh của quân Nguyên chép bằng chữ Hán), phụ đề là bản dịch tiếng Việt (`text`).
// Nhãn theo quy ước của game: câu có nguồn là Chính sử, còn lại là Hư cấu — lời thoại do ta viết, không phải lời ghi trong sử.
//   - "Phá cường địch, báo hoàng ân" là sáu chữ trên lá cờ của Trần Quốc Toản (Toàn thư, Chính sử).
//   - "Ta thường tới bữa quên ăn, nửa đêm vỗ gối" là câu trong Hịch tướng sĩ của Trần Hưng Đạo (Chính sử).
//
// on: tên chiêu (khóa trong heroes.js SKILLS) hoặc mã sự kiện giáp mặt của tướng địch ("b15"…"b20").
// Giọng: mã `tts` là voice_id ai33 (design/tools/ai33-audio.mjs voices elevenlabs Vietnamese male …); chọn theo mô tả giọng, đổi ở đây rồi sinh lại.

export const VOICE_CAST = {
  H35: { name: "Trần Quốc Toản", lang: "vi", tts: "elevenlabs_kyWPawcLE727zSyf3yY6" },   // Vũ — trẻ, giọng Bắc, hăng
  H40: { name: "Nguyễn Khoái", lang: "vi", tts: "elevenlabs_mTMLdrFZdBqiPUW1W47D" },     // Cuong Pham — trầm, mạnh, dứt khoát
  H31: { name: "Trần Hưng Đạo", lang: "vi", tts: "elevenlabs_bgEAVlb0lL0mCSoVll8V" },    // Bob — trầm, điềm tĩnh, giọng Bắc
  X19: { name: "Toa Đô", lang: "zh", tts: "elevenlabs_d8IR2QHf65bKkLRMo3sk" },           // Wei — uy quyền, trung niên
  X20: { name: "Ô Mã Nhi", lang: "zh", tts: "elevenlabs_pz7hOfW7kgI9kF818eDS" },         // Jerry — tự phụ, hách dịch
  X24: { name: "Phàn Tiếp", lang: "zh", tts: "elevenlabs_YBS7vt5CeZiqlZYGamwR" },        // Jerry Lin — trầm, thận trọng
  X18: { name: "Thoát Hoan", lang: "zh", tts: "elevenlabs_Qz42O0rKFmFBzAviAloi" },       // Aaron Shang — trầm, kiêu ngạo
};

const CS = "Chính sử", HC = "Hư cấu";
// id tệp = assets/voice/<id>.m4a. `speed` (0,5–1,5) chỉ dùng lúc sinh giọng.
export const VOICE_LINES = [
  // ---- Trần Quốc Toản (B15, B16) ----
  { id: "H35-phaTran-1", who: "H35", on: "phaTran", text: "Phá trận cho ta!", label: HC },
  { id: "H35-phaTran-2", who: "H35", on: "phaTran", text: "Xông lên, theo ta!", label: HC },
  { id: "H35-phaTran-3", who: "H35", on: "phaTran", text: "Không lùi một bước!", label: HC },
  { id: "H35-bopNat-1", who: "H35", on: "bopNat", text: "Phá cường địch, báo hoàng ân!", label: CS },
  { id: "H35-bopNat-2", who: "H35", on: "bopNat", text: "Quả cam còn bóp nát, quân giặc là gì!", label: HC },
  // ---- Nguyễn Khoái (B17) ----
  { id: "H40-tenXuyenHang-1", who: "H40", on: "tenXuyenHang", text: "Một mũi tên, xuyên giáp!", label: HC },
  { id: "H40-tenXuyenHang-2", who: "H40", on: "tenXuyenHang", text: "Nhắm cho chuẩn, bắn!", label: HC },
  { id: "H40-chanDong-1", who: "H40", on: "chanDong", text: "Chặn dòng, dụ chúng vào!", label: HC },
  { id: "H40-chanDong-2", who: "H40", on: "chanDong", text: "Nước ròng rồi, chặn lại!", label: HC },
  { id: "H40-mocTen-1", who: "H40", on: "mocTen", text: "Móc tên, giữ chặt thuyền chúng!", label: HC },
  { id: "H40-mocTen-2", who: "H40", on: "mocTen", text: "Kéo! Đừng để chúng thoát!", label: HC },
  // ---- Trần Hưng Đạo (B20) ----
  { id: "H31-hichTuongSi-1", who: "H31", on: "hichTuongSi", text: "Ta thường tới bữa quên ăn, nửa đêm vỗ gối!", label: CS, speed: 0.95 },
  { id: "H31-hichTuongSi-2", who: "H31", on: "hichTuongSi", text: "Binh thư là gốc đánh giặc, các ngươi phải học!", label: HC, speed: 0.95 },
  { id: "H31-binhThu-1", who: "H31", on: "binhThu", text: "Dùng binh phải biết thế, biết thời.", label: HC, speed: 0.95 },
  { id: "H31-binhThu-2", who: "H31", on: "binhThu", text: "Biết người biết ta, trăm trận không nguy.", label: HC, speed: 0.95 },
  { id: "H31-bachDang-1", who: "H31", on: "bachDang", text: "Nước triều đã lên, toàn quân tiến công!", label: HC },
  { id: "H31-bachDang-2", who: "H31", on: "bachDang", text: "Bạch Đằng này, giặc không còn đường về!", label: HC },
  // ---- tướng Mông-Nguyên khi giáp mặt ----
  { id: "X19-b15-1", who: "X19", on: "b15", zh: "我从占城一路杀来，谁敢拦我？", text: "Ta từ Chiêm Thành đánh ra một mạch, ai dám cản?", label: HC },
  { id: "X19-b15-2", who: "X19", on: "b15", zh: "安南兵马，不堪一击！", text: "Binh mã An Nam, chẳng chịu nổi một đòn!", label: HC },
  { id: "X19-b17-1", who: "X19", on: "b17", zh: "大军北归，挡路者死！", text: "Đại quân kéo về phương bắc, kẻ cản đường phải chết!", label: HC },
  { id: "X19-b17-2", who: "X19", on: "b17", zh: "此路不通，便杀出一条路！", text: "Đường này không thông, ta sẽ mở đường máu!", label: HC },
  { id: "X20-b17-1", who: "X20", on: "b17", zh: "这个渡口，由我来守。", text: "Bến này, để ta giữ.", label: HC },
  { id: "X20-b17-2", who: "X20", on: "b17", zh: "想过此渡，先过我这一关！", text: "Muốn qua bến này, trước hết phải qua ải của ta!", label: HC },
  { id: "X20-b20-1", who: "X20", on: "b20", zh: "纵然撤军，也不容你们放肆！", text: "Dù phải rút quân, cũng không để các ngươi làm càn!", label: HC },
  { id: "X20-b20-2", who: "X20", on: "b20", zh: "战船列阵，掩护撤军！", text: "Chiến thuyền dàn trận, yểm hộ rút quân!", label: HC },
  { id: "X24-b20-1", who: "X24", on: "b20", zh: "江面如此安静，小心有诈。", text: "Mặt sông yên ắng thế này… coi chừng có mai phục.", label: HC },
  { id: "X24-b20-2", who: "X24", on: "b20", zh: "稳住阵脚，别乱！", text: "Giữ vững đội hình, đừng loạn!", label: HC },
  { id: "X18-b16-1", who: "X18", on: "b16", zh: "本王乃镇南王脱欢，谁敢来犯？", text: "Bổn vương là Trấn Nam vương Thoát Hoan. Kẻ nào dám xâm phạm?", label: HC },
  { id: "X18-b16-2", who: "X18", on: "b16", zh: "这里是本王的营地，谁敢放肆？", text: "Đây là doanh trại của bổn vương, ai dám làm càn?", label: HC },
];

export const VOICE_BY_ID = Object.fromEntries(VOICE_LINES.map((l) => [l.id, l]));
// các dòng của một người cho một chiêu / sự kiện
export const voiceLinesFor = (who, on) => VOICE_LINES.filter((l) => l.who === who && l.on === on);
