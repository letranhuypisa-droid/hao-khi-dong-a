// data/tutorial-steps.js — các bài của màn Huấn luyện (đợt 7, sửa đợt 11): chữ, điều kiện qua bài, đếm bài, bỏ qua bài kẹt.
// THUẦN (chỉ import controls.js, tuning.js) nên kiểm được trong Node (tests/tutorial-steps.test.mjs); chạy thật ở battle/tutorial.js,
// nơi TutorialDirector đọc danh sách này và dựng cảnh (setup / tick gọi các hàm của director: d.passive(), d.soldier()…).
//
// Mỗi bài: id, title, icons (assets/icons), captions?, text(d) → HTML (cách làm), setup?(d), tick?(d), defines? (thuật ngữ thẻ này giải thích).
// Bài tập (drill) có conds(d) → [{ say, label, n, of, fmt? }]: danh sách điều kiện qua bài. MỘT danh sách này sinh ra cả ba thứ người
// chơi thấy — dòng "Qua bài khi: …" trong thẻ (say), thanh tiến độ (progressOf) và dòng mục tiêu có đếm (label n/of) — nên điều kiện
// không thể lệch với việc xét qua bài. hint?(d) → chữ thay dòng mục tiêu khi cần dặn thêm (vd Bài 7 báo bấm Đỡ hụt).
// Thẻ ghi nhớ (không conds) qua bằng Tiếp. Thẻ chỉ dùng thuật ngữ đã được giải thích ở thẻ trước (test kiểm theo defines).

import { say, short, devOf } from "./controls.js";
import { DEFENSE, HERO, BROKEN_SEC } from "./tuning.js";

export const SKIP_AFTER = 25;                 // bài tập kẹt quá chừng này giây thì cho bỏ qua
export const CAM_TURN = 3;                    // rad camera phải xoay (≈ nửa vòng) cho Bài 2
const NEED = { kills: 3, chain: 4, cKinds: 3, dodges: 2, blocks: 3, skills: 2, skillHits: 4 };

// chữ phím theo thiết bị đang dùng (bàn phím, cảm ứng, tay cầm): cùng bảng nhãn với HUD, bảng phím và các dòng gợi ý (data/controls.js)
export const kbd = (d, k) => `<kbd>${say(k, devOf(d.ctx))}</kbd>`;
const verbHold = (d) => (devOf(d.ctx) === 1 ? "Chạm" : "Giữ");        // nút Lệnh cảm ứng là bật / tắt, bàn phím và tay cầm là giữ
const verbPress = (d) => (devOf(d.ctx) === 1 ? "Chạm" : "Bấm");       // cảm ứng chạm nút, còn lại bấm
const vn = (x) => String(x).replace(".", ",");                         // 0.15 → "0,15"

export const isDrill = (S) => typeof S?.conds === "function";

// Trạng thái đếm của một bài (director.go() dựng mới mỗi bài). parryMiss / missT / missRed: lần bấm Đỡ hụt gần nhất (Bài 7).
export const freshStats = () => ({ kills: 0, maxN: 0, moves: new Set(), dodges: 0, blocks: 0, parries: 0, redSeen: 0, broke: false,
  officerKilled: false, skills: 0, skillHits: 0, ult: false, camTurn: 0, parryMiss: 0, missT: 0, missRed: false });
export const cUsed = (st) => new Set([...st.moves].filter((k) => /^C[1-6]$/.test(k)));

const one = (say_, label, ok) => ({ say: say_, label, n: ok ? 1 : 0, of: 1 });
const PT = HERO.phaTran, TK = HERO.tuyetKy;

export const STEPS = [
  { id: "intro", title: "Võ trường · Huấn luyện", icons: ["n", "c3", "dodge", "ult"],
    text: (d) => `Trần Quốc Toản luyện song đao trước khi ra bến Hàm Tử. ${DRILL_COUNT} bài ngắn, chừng bốn phút. Trong lúc tập tướng không gục. ${verbPress(d)} ${kbd(d, "next")} để bắt đầu; ${kbd(d, "pause")} để tạm dừng hoặc rời sân.` },
  { id: "move", title: "Bài 1 · Di chuyển", icons: [],
    text: (d) => `Dùng ${kbd(d, "move")} để chạy.`,
    setup: (d) => d.marker(10, -6),
    conds: (d) => { const h = d.ctx.hero, m = d.mk; return [one("chạy tới vòng vàng", "Tới vòng vàng", m && Math.hypot(h.x - m.x, h.z - m.z) < 2.3)]; } },
  { id: "cam", title: "Bài 2 · Camera", icons: [],            // không có icon camera; icon "Khóa mục tiêu" chỉ hiện từ Bài 11
    text: (d) => `Xoay camera bằng ${kbd(d, "cam")}. Đứng yên một lúc thì camera tự quay theo hướng chạy.`,
    conds: (d) => [{ say: "xoay camera nửa vòng", label: "Xoay camera", n: Math.min(d.st.camTurn, CAM_TURN), of: CAM_TURN, fmt: "pct" }] },
  { id: "n", title: "Bài 3 · Đòn thường N", icons: ["n"],
    text: (d) => `Bấm ${kbd(d, "n")} liên tiếp: song đao chém chuỗi 6 nhát N1–N6, nhát thứ 6 xoay tròn đẩy lùi. Đòn tự xoay về kẻ gần nhất theo hướng bạn đẩy.`,
    setup: (d) => { d.passive(); for (let i = 0; i < 4; i++) d.soldier(); },
    tick: (d) => d.keep(3),
    conds: (d) => [{ say: `hạ ${NEED.kills} lính tập`, label: "Hạ lính", n: Math.min(NEED.kills, d.st.kills), of: NEED.kills },
      one(`đánh một chuỗi liền tới nhát N${NEED.chain}`, `Chuỗi tới N${NEED.chain}`, d.st.maxN >= NEED.chain)] },
  { id: "c", title: "Bài 4 · Đòn mạnh C", icons: ["c1", "c2", "c3", "c4"], captions: ["C", "N → C", "N N → C", "N N N → C"],
    text: (d) => `Bấm ${kbd(d, "c")} ngay sau chuỗi N để đổi sang đòn mạnh: bao nhiêu nhát N trước thì ra C kế tiếp. ${devOf(d.ctx) === 1 ? "Biểu tượng nút C" : `Ô "${short("c", devOf(d.ctx))}"`} ở góc phải báo đòn C sẽ ra.`,
    setup: (d) => { d.passive(); for (let i = 0; i < 6; i++) d.soldier(); },
    tick: (d) => d.keep(5),
    conds: (d) => { const used = [...d.cSet()].sort(); return [{ say: `dùng ${NEED.cKinds} đòn C khác nhau`, label: `Đòn C khác nhau (${used.join(", ") || "chưa có"})`, n: Math.min(NEED.cKinds, used.length), of: NEED.cKinds }]; } },
  { id: "dodge", title: "Bài 5 · Né và Lướt chém", icons: ["dodge", "dash"],
    text: (d) => `Bấm ${kbd(d, "dodge")} để lộn né (bất tử ${vn(DEFENSE.dodgeIFrame)} s; né ${DEFENSE.dodgeChain} lần liền thì phải nghỉ). Vừa né xong bấm ${kbd(d, "n")} hoặc ${kbd(d, "c")}: Lướt chém lao tới.`,
    setup: (d) => { d.passive(); for (let i = 0; i < 4; i++) d.soldier(); },
    tick: (d) => d.keep(3),
    conds: (d) => [{ say: `né ${NEED.dodges} lần`, label: "Né", n: Math.min(NEED.dodges, d.st.dodges), of: NEED.dodges },
      one("Lướt chém 1 lần", "Lướt chém", d.st.moves.has("DN") || d.st.moves.has("DC"))] },
  { id: "block", title: "Bài 6 · Đỡ", icons: ["block"],
    text: (d) => `Lính sắp đánh thì thân ửng đỏ. Giữ ${kbd(d, "block")} để đỡ đòn trước mặt, lúc đỡ vẫn bước được.`,
    setup: (d) => { d.aggressive(3); for (let i = 0; i < 4; i++) d.soldier(); },
    tick: (d) => d.keep(3),
    conds: (d) => [{ say: `đỡ ${NEED.blocks} đòn`, label: "Đỡ", n: Math.min(NEED.blocks, d.st.blocks), of: NEED.blocks }] },
  { id: "parry", title: "Bài 7 · Phản đòn", icons: ["ct"],
    text: (d) => `Đòn viền đỏ (vòng đỏ dưới chân sĩ quan) không đỡ được. Vòng đỏ lớn dần cho đầy trong ${vn(DEFENSE.redTelegraph)} s, vừa đầy thì cú bổ rơi. Bấm ${kbd(d, "block")} đúng lúc vòng vừa đầy (trong ${vn(devOf(d.ctx) === 1 ? DEFENSE.parryWindowTouch : DEFENSE.parryWindow)} s cuối) để gạt đòn và chém trả. Bấm sớm hơn thì hụt và bị khóa ${vn(DEFENSE.counterLockout)} s.`,
    setup: (d) => { d.passive(); d.officer("doitruong", { redOnly: true }); },
    conds: (d) => [one("Phản đòn thành công 1 lần", "Phản đòn", d.st.parries > 0)],
    hint: (d) => parryHint(d.st, devOf(d.ctx)) },
  { id: "break", title: "Bài 8 · Vỡ Thế và Đòn Quyết", icons: ["dq"], defines: ["Phá Thế", "Vỡ Thế", "Đòn Quyết"],
    text: (d) => `Dưới tên sĩ quan có thanh vàng: Phá Thế. Đánh liên tục cho cạn thanh đó: hắn Vỡ Thế, loạng choạng ${vn(BROKEN_SEC)} s. Chạy lại gần bấm ${kbd(d, "c")}: Đòn Quyết.`,
    setup: (d) => { d.aggressive(1); if (!d.officerAlive()) d.officer("doitruong"); },
    conds: (d) => { const dq = d.st.moves.has("DQ") || d.st.officerKilled; return [one("đánh cạn Phá Thế cho sĩ quan Vỡ Thế", "Vỡ Thế", d.st.broke || dq), one("ra Đòn Quyết", "Đòn Quyết", dq)]; },
    hint: (d) => (d.st.broke && !d.st.moves.has("DQ") && !d.st.officerKilled ? `Vỡ Thế! Bấm ${say("c", devOf(d.ctx))} cạnh hắn` : null) },
  { id: "skill", title: "Bài 9 · Phá Trận", icons: ["skill"], defines: ["Phá Trận"],
    text: (d) => `Bấm ${kbd(d, "skill")}: lao ${PT.len} m xuyên hàng địch, lính trên đường bị choáng. Bấm thêm trong ${PT.window} s để lao tiếp (tối đa ${PT.dashes} lần), rồi hồi ${PT.cd} s. Đẩy hướng về phía địch trước khi bấm.`,
    setup: (d) => { d.passive(); d.ctx.hero.phaTran.cd = 0; d.ctx.hero.phaTran.left = 0; for (let i = 0; i < 10; i++) d.soldier(8 + i * 1.2); },
    tick: (d) => d.keep(6),
    conds: (d) => [{ say: `lao ${NEED.skills} lần`, label: "Lao", n: Math.min(NEED.skills, d.st.skills), of: NEED.skills },
      { say: `làm choáng trúng ${NEED.skillHits} lính`, label: "Trúng", n: Math.min(NEED.skillHits, d.st.skillHits), of: NEED.skillHits }] },
  { id: "ult", title: "Bài 10 · Tuyệt Kỹ", icons: ["ult"], defines: ["Khí Lực", "Tuyệt Kỹ"],
    text: (d) => `Thanh xanh dưới máu là Khí Lực, đầy dần khi giao chiến. Đủ một vạch thì bấm ${kbd(d, "ult")}: "Bóp Nát Quân Thù" — ${TK.invuln} s bất tử, ${TK.hits} nhát chém quanh mình, xong cắm cờ tăng Công cho quân ta.`,
    setup: (d) => { d.passive(); d.ctx.hero.ki = Math.max(d.ctx.hero.ki, 100); for (let i = 0; i < 10; i++) d.soldier(); },
    tick: (d) => d.keep(8),
    conds: (d) => [one("dùng Tuyệt Kỹ", "Dùng Tuyệt Kỹ", d.st.ult), one(`chém cho hết ${TK.invuln} s`, "Chém cho hết", d.st.ult && d.ctx.hero.state !== "ult")] },
  { id: "lock", title: "Bài 11 · Khóa mục tiêu", icons: ["lock"],
    text: (d) => `Bấm ${kbd(d, "lock")} để khóa sĩ quan gần nhất: camera và đòn đánh bám theo hắn. Bấm lại để bỏ khóa.`,
    setup: (d) => { d.passive(); d.officer("doitruong", { far: true }); },
    conds: (d) => [one("khóa sĩ quan", "Khóa sĩ quan", d.ctx.hero.lock)] },
  // ---- thẻ ghi nhớ (Tiếp để qua): Cứ Điểm và Kế Sách đứng TRƯỚC Hào Khí, vì thẻ Hào Khí dùng cả hai chữ ----
  { id: "cmd", title: "Trong trận · Mệnh Lệnh", icons: ["cmd", "tiencong", "giuvung", "theota", "tiepvien"], defines: ["Mệnh Lệnh"],
    captions: ["Mở vòng", "1", "2", "3", "4"],
    text: (d) => `Trận Hàm Tử có hai mặt trận cách nhau 150 m; bạn không ở cả hai nơi được. ${verbHold(d)} ${kbd(d, "cmd")} mở vòng Mệnh Lệnh (trận chậm lại ×0,2), bấm 1–4: <b>Tiến công</b>, <b>Giữ vững</b>, <b>Theo ta</b> (quân đi theo tướng), <b>Gọi tiếp viện</b>. Đổi mặt trận: ${kbd(d, "cmdSwap")}.` },
  { id: "base", title: "Trong trận · Cứ Điểm và Kế Sách", icons: ["giuvung", "kesach"], captions: ["Cứ Điểm", "Kế Sách"], defines: ["Cứ Điểm", "Kế Sách"],
    text: (d) => `Đồn, doanh trại có vòng tròn dưới đất: hạ hết quân đồn trú và sĩ quan trấn thủ, rồi đứng trong vòng cho tới khi chiếm xong. Trúng đòn thì chiếm dừng nửa giây; trúng đòn viền đỏ thì tiến độ về 0. Kế Sách (như "Cờ áo Tống") hiện ở cột phải: làm đủ điều kiện thì bấm ${kbd(d, "kesach")}.` },
  { id: "hk", title: "Trong trận · Hào Khí", icons: ["tpc"], defines: ["Hào Khí", "Tổng Phản Công"],
    text: (d) => `Thanh Hào Khí ở đỉnh màn tăng khi chiếm Cứ Điểm, hạ sĩ quan, làm nhiệm vụ, thi hành Kế Sách. Đủ 100 thì bấm ${kbd(d, "tpc")}: <b>Tổng Phản Công</b> — cả hai mặt trận xông lên 25 s, tướng có thêm một Tuyệt Kỹ Hào Khí.` },
  { id: "end", title: "Xong huấn luyện!", icons: ["n", "c4", "skill", "ult", "tpc"], final: true,
    text: (d) => `Bạn đã sẵn sàng ra bến Hàm Tử. Bảng đòn đầy đủ luôn có ở thẻ <b>Huấn luyện</b> và trong bảng tạm dừng. ${verbPress(d)} ${kbd(d, "next")} để về Doanh trại.` },
];

export const DRILL_COUNT = STEPS.filter(isDrill).length;

// ---- điều kiện qua bài ------------------------------------------------------------------------------------------------
// Tiến độ 0..1 = trung bình tỉ lệ từng điều kiện (mỗi điều kiện một mục trong dòng mục tiêu); xong khi MỌI điều kiện đủ.
export const progressOf = (cs) => (cs.length ? cs.reduce((s, c) => s + Math.min(1, c.n / c.of), 0) / cs.length : 0);
export const doneOf = (cs) => cs.length > 0 && cs.every((c) => c.n >= c.of);
const joinVi = (a) => (a.length < 2 ? a[0] ?? "" : `${a.slice(0, -1).join(", ")} và ${a[a.length - 1]}`);
export const passLine = (cs) => `Qua bài khi: ${joinVi(cs.map((c) => c.say))}.`;
export function goalLine(cs) {
  return cs.map((c) => `${c.label} ${c.fmt === "pct" ? `${Math.round(100 * Math.min(1, c.n / c.of))}%` : c.of > 1 ? `${Math.min(c.n, c.of)}/${c.of}` : c.n >= c.of ? "✓" : "✗"}`).join(" · ");
}

// ---- đếm bài, thoát, bỏ qua -------------------------------------------------------------------------------------------
// k: số bài tập đã vào tới chỗ này, n: tổng bài tập. Thẻ ghi nhớ không có số bài (trước đây thông báo thoát lấy chỉ số trong CẢ 16 mục
// nên ghi "bài 12 / 16" trong khi bảng đếm "/ 11").
export function tutorialProgress(steps, i) {
  const n = steps.filter(isDrill).length, S = steps[i];
  return { k: steps.slice(0, i + 1).filter(isDrill).length, n, where: i <= 0 ? "intro" : isDrill(S) ? "drill" : !S || S.final ? "end" : "notes" };
}
export function exitLine({ k, n, where }) {
  if (where === "intro") return "Đã rời huấn luyện trước khi vào bài 1.";
  if (where === "drill") return `Đã rời huấn luyện ở bài ${k} / ${n}.`;
  if (where === "end") return `Đã rời huấn luyện ở thẻ cuối, đã xong ${n} / ${n} bài.`;
  return `Đã rời huấn luyện sau khi xong ${n} / ${n} bài (còn các thẻ ghi nhớ).`;
}
// Bài tập kẹt quá SKIP_AFTER giây thì cho bỏ qua: cảm ứng có nút "Bỏ qua bài" (bài tập không có nút Tiếp), bàn phím và tay cầm có dòng nhắc.
export function skipOffer({ drill, dev, stepT, completed }) {
  if (!drill || completed || !(stepT > SKIP_AFTER)) return null;
  return dev === 1 ? "button" : "hint";
}

// Bài 7: bấm Đỡ không trúng cửa sổ phản đòn thì hero.parryLock khóa 0,5 s mà không báo gì — ở bài tập, dòng mục tiêu nói rõ vì sao hụt.
export function parryHint(st, dev = 0) {
  const k = say("block", dev);
  if (st.missT > 0) return st.missRed ? `Sớm quá — chờ vòng đỏ đầy rồi mới bấm ${k}.` : `Hụt — bấm ${k} đúng lúc vòng đỏ vừa đầy.`;
  if (st.redSeen >= 3 && !st.parries) return `Mẹo: bấm ${k} lúc vòng đỏ vừa đầy, đừng giữ sẵn.`;
  return null;
}
