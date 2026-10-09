// data/controls.js — nhãn phím theo thiết bị: MỘT bảng cho ô kỹ năng, bảng phím, bài Huấn luyện và mọi dòng gợi ý trong trận.
// dev: 0 bàn phím + chuột, 1 cảm ứng, 2 tay cầm (cùng quy ước ui/guide.js). Phím thật gán ở battle/input.js (KEYMAP, MOUSEMAP);
// tests/controls.test.mjs đối chiếu hai bảng để chữ trên màn hình không lệch phím. Thuần (chỉ một bộ nhớ "lần bấm gần nhất"
// ở cuối file, bỏ qua khi không có DOM) nên chạy được trong Node.
//
// Tên "N", "C" là tên nút đánh (đòn thường, đòn mạnh); phím thật trên bàn phím là J / chuột trái và K / chuột phải.
// Chữ trong câu viết bằng {token}: "Bấm {tpc}" → "Bấm F" / "Bấm nút Phản Công" / "Bấm D-pad lên"; {TPC} viết hoa cho băng chữ.

export const DEV = { KB: 0, TOUCH: 1, PAD: 2 };
const DEV_KEY = ["kb", "touch", "pad"];

// kb: phím / nút chuột (cái đầu là chính); touch: nút trên màn hình; pad: nút tay cầm.
// hold: [bàn phím, cảm ứng, tay cầm] — giữ phím mới có tác dụng (nút Lệnh cảm ứng là bật / tắt nên không "giữ").
// Đợt 13: trên cảm ứng Kế Sách, Lệnh, Phản Công, Khóa, tạm dừng nằm trong nút ☰ (battle.js buildTouch) — nhãn ghi "(trong ☰)".
// free: không qua KEYMAP (di chuyển, camera). say: chữ riêng trong câu thay cho chip ghép bằng "hoặc", theo thiết bị.
export const ACTIONS = {
  move:     { free: true, kb: ["W A S D"], touch: ["cần gạt trái"], pad: ["cần trái"] },
  cam:      { free: true, kb: ["chuột"], touch: ["vuốt nửa phải màn hình"], pad: ["cần phải"], say: { kb: "di chuột (bấm vào màn để khóa chuột)" } },
  n:        { kb: ["J", "chuột trái"], touch: ["nút N"], pad: ["X"] },
  c:        { kb: ["K", "chuột phải"], touch: ["nút C"], pad: ["Y"] },
  dodge:    { kb: ["Space"], touch: ["nút Né"], pad: ["A"] },
  block:    { kb: ["Shift", "L"], touch: ["nút Đỡ"], pad: ["RB"], hold: [1, 1, 1], say: { kb: "Shift" } },
  skill:    { kb: ["E"], touch: ["nút Phá Trận"], pad: ["LB"] },
  skill2:   { kb: ["T"], touch: ["nút Binh Thư"], pad: ["D-pad trái"] },
  ult:      { kb: ["R"], touch: ["nút Tuyệt Kỹ"], pad: ["B"] },
  tpc:      { kb: ["F"], touch: ["nút Phản Công (trong ☰)"], pad: ["D-pad lên"] },
  cmd:      { kb: ["Tab"], touch: ["nút Lệnh (trong ☰)"], pad: ["LT"], hold: [1, 0, 1] },
  cmdSwap:  { kb: ["Z"], touch: ["chạm tên mặt trận"], pad: ["LB"] },
  kesach:   { kb: ["G"], touch: ["nút Kế Sách (trong ☰)"], pad: ["D-pad phải"] },
  lock:     { kb: ["Q", "chuột giữa"], touch: ["nút Khóa (trong ☰)"], pad: ["RT"], say: { kb: "Q" } },
  interact: { kb: ["X"], touch: ["nút Tương tác"], pad: ["D-pad xuống"], hold: [1, 1, 1] },
  pause:    { kb: ["Esc", "P"], touch: ["nút II (trong ☰)"], pad: ["Start"], say: { kb: "Esc" } },
  next:     { kb: ["Enter"], touch: ["nút Tiếp"], pad: ["Back"] },
};

const chipsOf = (a, dev) => a[DEV_KEY[dev]] || a.kb;

// Chữ dùng trong câu: "K hoặc chuột phải", "nút Phản Công", "D-pad lên".
export function say(action, dev = 0) {
  const a = ACTIONS[action]; if (!a) return String(action);
  return a.say?.[DEV_KEY[dev]] ?? chipsOf(a, dev).join(" hoặc ");
}

// Động từ + phím theo thiết bị, lấy từ cờ hold của bảng: "giữ Tab" (bàn phím), "chạm nút Lệnh" (cảm ứng: nút Lệnh bật / tắt), "giữ LT" (tay cầm);
// hành động không có cờ hold thì "bấm F", "bấm nút Phản Công", "bấm D-pad lên".
export function act(action, dev = 0) {
  const a = ACTIONS[action]; if (!a) return String(action);
  const verb = a.hold ? (a.hold[dev] ? "giữ" : "chạm") : "bấm";
  return `${verb} ${say(action, dev)}`;
}

// Chữ gọn cho ô nhỏ (ô kỹ năng trên HUD): cái đầu trong bảng.
export function short(action, dev = 0) {
  const a = ACTIONS[action]; return a ? chipsOf(a, dev)[0] : String(action);
}

// Ba chuỗi [bàn phím, cảm ứng, tay cầm] cho thẻ bảng phím (ui/guide.js tách chip bằng " · "). extra[dev]: đuôi thêm sau chip
// ("+ 1–4" của Mệnh Lệnh); touch: nhãn nút cảm ứng riêng của tướng ("nút Hịch").
export function guideKeys(action, { extra = [], touch } = {}) {
  const a = ACTIONS[action];
  return DEV_KEY.map((d, i) => {
    const chips = i === DEV.TOUCH && touch ? [touch] : [...a[d]];
    if (a.hold?.[i]) chips[chips.length - 1] += " (giữ)";
    return chips.join(" · ") + (extra[i] || "");
  });
}

// Chuỗi đòn viết bằng tên nút (N, C, Né, Đỡ) → cái người chơi thật sự bấm: bàn phím "J J → K", tay cầm "X X → Y"; cảm ứng giữ
// nguyên vì nút trên màn hình mang đúng tên N / C.
const SEQ_TOKEN = { N: "n", C: "c", "Né": "dodge", "Đỡ": "block" };
export function seqFor(seq, dev = 0) {
  if (dev === DEV.TOUCH) return String(seq);
  return String(seq).split(" ").map((w) => (SEQ_TOKEN[w] ? short(SEQ_TOKEN[w], dev) : w)).join(" ");
}

// Thay {token} trong câu bằng nhãn theo thiết bị; token lạ giữ nguyên. {tpc}: chỉ phím ("F"); {act:cmd}: động từ + phím ("giữ Tab").
// Viết {TPC} / {ACT:CMD} (hoa hết) thì kết quả viết hoa hết (băng chữ); {Act:cmd} (hoa chữ đầu) thì hoa chữ đầu (đầu câu).
export function fmtKeys(text, dev = 0) {
  return String(text).replace(/\{((?:act:)?)(\w+)\}/gi, (m, verb, name) => {
    const id = Object.keys(ACTIONS).find((k) => k.toLowerCase() === name.toLowerCase());
    if (!id) return m;
    const s = verb ? act(id, dev) : say(id, dev), tok = verb + name;
    if (tok === tok.toUpperCase() && tok !== tok.toLowerCase()) return s.toUpperCase();
    if (tok[0] === tok[0].toUpperCase() && tok[0] !== tok[0].toLowerCase() && tok.slice(1) === tok.slice(1).toLowerCase()) return s[0].toUpperCase() + s.slice(1);
    return s;
  });
}

// Thiết bị đang dùng (input.js lật cờ theo lần bấm cuối): tay cầm > cảm ứng > bàn phím.
export const devOf = (ctx) => (ctx?.input?.pad ? DEV.PAD : ctx?.touch ? DEV.TOUCH : DEV.KB);

// Giao diện cảm ứng ("Điều khiển cảm ứng": auto / on / off). "Tự nhận" nhìn cách bấm gần nhất thay vì chỉ hỏi trình duyệt có màn
// cảm ứng hay không: nhiều máy bàn / laptop báo "pointer: coarse" (không thấy chuột) dù đang chơi bằng chuột và bàn phím. Đây chỉ là
// lựa chọn lúc vào trận; trong trận ở chế độ "Tự nhận" lớp cảm ứng còn bật / tắt theo thiết bị vừa dùng (battle.js setupTouch).
export function wantTouchUI(setting, lastPointer = "", coarse = false) {
  if (setting === "on") return true;
  if (setting !== "auto") return false;
  if (lastPointer === "touch") return true;
  if (lastPointer === "mouse") return false;
  return !!coarse;                                                  // chưa bấm gì, hoặc bút (máy bảng dùng bút, laptop dùng bút như chuột)
}

// Loại con trỏ của lần bấm gần nhất trong trang ("mouse" / "touch" / "pen"; "" khi chưa bấm gì hoặc không có DOM thật — các bài
// kiểm thử Node dựng `document` giả không có addEventListener).
let lastPointer = "";
if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
  document.addEventListener("pointerdown", (e) => { if (e.pointerType) lastPointer = e.pointerType; }, true);
}
export const lastPointerKind = () => lastPointer;
export const touchUI = (settings) => wantTouchUI(settings?.touch, lastPointer, typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches);
