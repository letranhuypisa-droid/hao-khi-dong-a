// meta/chapter.js — tiến độ một Chương (GDD 22.2), thẻ Sử quán (12.11), chọn câu Quiz và ôn ngắt quãng (22.6).
// Thuần (không DOM), chạy được trong node cho kiểm thử.
//
// save.chapters[id] = { opened, openSeen, closeSeen, insertSeen, seen[], cleared, quizRounds }
// save.cards[id] = thời điểm mở; save.quiz = { done: số Chương đã xong, answered: {qid: {n, right, first}}, review: [{id, due, stage}] }

import { CARDS as CARDS_B15 } from "../data/suquan-b15.js";

// Ngân hàng thẻ theo Chương (đợt 9: nhiều Chương). B15 có sẵn; Chương khác đăng ký khi nạp nội dung (main.js, lười).
const BANKS = { B15: CARDS_B15 };
export function registerCards(chapter, cards) { BANKS[chapter] = cards; }
export const cardBank = (chapter) => BANKS[chapter] || [];

export function chapterState(save, id) {
  save.chapters ||= {};
  return (save.chapters[id] ||= { opened: false, openSeen: false, closeSeen: false, insertSeen: false, seen: [], cleared: false, quizRounds: 0 });
}

export function markSeen(save, chapter, ids) {
  const ch = chapterState(save, chapter), set = new Set(ch.seen);
  for (const id of ids) set.add(id);
  ch.seen = [...set];
  return ch;
}

// Mở các thẻ có khóa mở nằm trong keys (vd "battleStart", "keSach:coAoTong"). Trả về id thẻ vừa mở. bank: thẻ của Chương
// (mặc định ngân hàng đã đăng ký cho chapter; Chương chưa đăng ký thì không mở gì).
export function unlockCards(save, chapter, keys, now = Date.now(), bank = cardBank(chapter)) {
  save.cards ||= {};
  const out = [];
  for (const c of bank) {
    if (c.chapter !== chapter || save.cards[c.id] || !keys.includes(c.unlock)) continue;
    save.cards[c.id] = now; out.push(c.id);
  }
  return out;
}

// Khóa mở thẻ rút từ kết quả một trận (director.buildResult). B15 (res.battle thiếu hoặc "B15"): bossMet khi gặp Toa Đô,
// keSach:<id> khi Kế Sách đã phân thắng bại (thành hay bại đều mở), firstWin khi thắng — như trước đợt 9.
// B20 (đợt 9, B20-GAMEPLAY §D5): keSach:<id> chỉ khi Kế Sách THÀNH CÔNG (nghiBinh, kichCoc, conNuoc — danh sách lấy từ
// res.keSachList, thiếu thì từ res.river.keSach của riverResult); bossMet khi Ô Mã Nhi (X20) đã xuất hiện: res.bossesMet
// (mảng id boss đã gặp) có "X20", không có mảng thì res.bossMet (director-b20 chỉ bật khi X20 ra trận, không tính Phàn Tiếp).
export function battleUnlockKeys(res) {
  const keys = [];
  const b20 = res.battle === "B20";
  if (b20 ? (Array.isArray(res.bossesMet) ? res.bossesMet.includes("X20") : !!res.bossMet) : res.bossMet) keys.push("bossMet");
  const list = res.keSachList || (b20 ? Object.values(res.river?.keSach || {}) : []);
  const strict = b20 || res.battle === "B16";          // B16 (đợt 21) theo luật B20: thẻ Kế Sách chỉ mở khi thành công
  for (const k of list) if (k.state === "thanhcong" || (!strict && k.state === "thatbai")) keys.push("keSach:" + k.id);
  if (res.won) keys.push("firstWin");
  return keys;
}

// ---- Quiz --------------------------------------------------------------------------------------------
const quizState = (save) => (save.quiz ||= { done: 0, answered: {}, review: [] });

// Câu được rút khi đã gặp ít nhất một nội dung trong seenRef: khung comic đã xem, thẻ đã mở, sự kiện đã xảy ra.
// Bỏ qua comic thì câu gắn khung chỉ rút khi thẻ cùng nội dung đã mở (seenRef có cả "card:…").
export function seenOk(save, item) {
  const ch = chapterState(save, item.chapter), cards = save.cards || {};
  return (item.seenRef || []).some((r) => {
    const [kind, id] = r.split(":");
    if (kind === "panel") return ch.seen.includes(id);
    if (kind === "card") return !!cards[id];
    if (kind === "event") return (ch.events || []).includes(id);
    return false;
  });
}

// Rút 3–5 câu (mặc định 4): câu ôn đã tới hạn của MỌI Chương (tối đa 2 — câu sai ở B15 quay lại trong Quiz của Chương
// sau), rồi câu chưa hỏi của Chương này, rồi câu cũ đã đúng; câu còn trong hàng ôn mà chưa tới hạn thì không hỏi lại sớm.
// Không hai câu cùng khung trong một lượt. rng() ∈ [0, 1) để xáo — cùng rng thì cùng lượt (kiểm thử được).
export function pickQuiz(save, bank, { chapter, n = 4, rng = Math.random, maxReview = 2 } = {}) {
  const Q = quizState(save);
  const ok = (q) => q.review !== "retired" && seenOk(save, q);
  const pool = bank.filter((q) => q.chapter === chapter && ok(q));
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const due = new Set(Q.review.filter((r) => r.due <= Q.done).map((r) => r.id));
  const waiting = new Set(Q.review.filter((r) => r.due > Q.done).map((r) => r.id));
  const review = shuffle(bank.filter((q) => due.has(q.id) && ok(q))).slice(0, maxReview);
  const fresh = shuffle(pool.filter((q) => !Q.answered[q.id]));
  const old = shuffle(pool.filter((q) => Q.answered[q.id] && !due.has(q.id) && !waiting.has(q.id)));
  const out = [], panels = new Set();
  for (const q of [...review, ...fresh, ...old]) {
    if (out.length >= n) break;
    if (q.panel && panels.has(q.panel)) continue;
    out.push(q); if (q.panel) panels.add(q.panel);
  }
  return shuffle(out);
}

// Ghi một câu trả lời. Sai → vào hàng ôn, quay lại sau 1 Chương; đúng khi ôn lần đầu → quay lại một lần nữa
// sau 3 Chương rồi rời hàng ôn (22.6 "Lặp lại ngắt quãng").
export function answerQuiz(save, item, right) {
  const Q = quizState(save);
  const a = (Q.answered[item.id] ||= { n: 0, right: 0, first: null });
  a.n++; if (right) a.right++; if (a.first === null) a.first = right;
  const r = Q.review.find((x) => x.id === item.id);
  if (!right) {
    if (r) { r.due = Q.done + 1; r.stage = 1; } else Q.review.push({ id: item.id, due: Q.done + 1, stage: 1 });
  } else if (r && r.due <= Q.done) {
    if (r.stage === 1) { r.stage = 2; r.due = Q.done + 3; } else Q.review.splice(Q.review.indexOf(r), 1);
  }
  return a;
}

// Bản lưu từ trước đợt 8 (chưa có save.chapters) mà đã thắng trận: coi Chương B15 đã xong, mở các thẻ tương ứng,
// để Quiz và teaser Chương kế không bị khóa tới lần thắng sau. Gọi lúc nạp và lúc nhập bản lưu.
export function syncLegacy(save) {
  if (!((save.stats?.wins || 0) > 0)) return false;
  const ch = chapterState(save, "B15");
  if (ch.cleared) return false;
  ch.opened = true; completeChapter(save, "B15");
  unlockCards(save, "B15", ["chapterOpen", "battleStart", "firstWin"]);
  return true;
}

// Chương xong lần đầu: tăng bộ đếm Chương cho lịch ôn.
export function completeChapter(save, chapter) {
  const ch = chapterState(save, chapter);
  if (ch.cleared) return false;
  ch.cleared = true; quizState(save).done++;
  return true;
}

// Xáo phương án để hiển thị: trả về mảng chỉ số gốc. Đúng/sai giữ thứ tự Đúng, Sai (22.6).
export function optionOrder(item, rng = Math.random) {
  const idx = item.options.map((_, i) => i);
  if (item.type === "truefalse") return idx;
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return idx;
}

// Kiểm ngân hàng câu (pipeline 22.6): schema, đáp án, phương án không trùng, khung và seenRef tồn tại, nhãn hợp lệ.
export function lintQuiz(bank, { panels = {}, cards = {} } = {}) {
  const errs = [], ids = new Set();
  const LABELS = ["Chính sử", "Tương truyền", "Hư cấu"];
  for (const q of bank) {
    const e = (m) => errs.push(`${q.id}: ${m}`);
    if (!q.id || ids.has(q.id)) e("id trống hoặc trùng"); ids.add(q.id);
    if (!["mcq4", "truefalse", "timeline", "whoSaid", "match", "mapPin"].includes(q.type)) e("type lạ " + q.type);
    if (!q.q?.vi || !q.why?.vi) e("thiếu q hoặc why");
    if (!LABELS.includes(q.label)) e("nhãn lạ " + q.label);
    if (q.type === "truefalse") { if (q.options.join() !== "Đúng,Sai") e("đúng/sai phải là [Đúng, Sai]"); }
    else {
      if (q.answer !== 0) e("đáp án đúng phải ở vị trí 0");
      if (q.options.length !== 4) e("cần 4 phương án");
    }
    if (new Set(q.options).size !== q.options.length) e("phương án trùng");
    if (q.panel && !panels[q.panel]) e("khung không có trong comic: " + q.panel);
    if (!q.seenRef?.length) e("thiếu seenRef");
    for (const r of q.seenRef || []) {
      const [k, id] = r.split(":");
      if (k === "panel" && !panels[id]) e("seenRef khung lạ " + id);
      if (k === "card" && !cards[id]) e("seenRef thẻ lạ " + id);
    }
    // thẻ "Chuyện bên lề" không bao giờ là seenRef duy nhất
    if ((q.seenRef || []).length === 1 && cards[q.seenRef[0].split(":")[1]]?.group === "benle") e("thẻ Chuyện bên lề là seenRef duy nhất");
    if (q.type === "mcq4" && /\b(1[0-9]{3}|năm \d+)\b/.test(q.options.join(" ")) && /^(Năm|Ngày) /.test(q.q.vi)) e("trắc nghiệm hỏi thuần ngày tháng");
  }
  return errs;
}
