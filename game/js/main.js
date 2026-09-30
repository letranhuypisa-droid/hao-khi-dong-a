// main.js — Doanh trại (hub), xuất trận, màn kết quả. Hub là DOM thuần; trận là three.js.

import { loadSave, writeSave, exportSave, importSave, resetSave } from "./meta/save.js";
import * as P from "./meta/progress.js";
import { NODES, TREE, TREE_RULES, WEAPON_TIERS, WEAPON_NAMES, FORGE, KHAC, LEGION, CAMP, R_LADDER } from "./data/progression.js";
import { DIFFICULTY, TROOP_LEVELS, HERO, EXP_NEXT, LEVEL_CAP, MOVES, MODES } from "./data/tuning.js";
import { Music } from "./core/music.js";
import { ARENA_MODES, MEDALS, isoWeekKey, seedFromKey, arenaRewards, applyArena } from "./meta/arena.js";
import { TIERS } from "./data/tuning.js";
import { HISTORY_NOTES, BOSS } from "./data/battle-b15.js";
import { movesGuideHTML } from "./ui/guide.js";
import { ICON } from "./data/moves-info.js";
import { COMIC_B15 } from "./data/comic-b15.js";
import { CARDS, CARD_GROUPS, CARD_BY_ID, QUIZ_B15 } from "./data/suquan-b15.js";
import { chapterState, markSeen, unlockCards, battleUnlockKeys, pickQuiz, answerQuiz, completeChapter, syncLegacy } from "./meta/chapter.js";
import { readComic } from "./ui/comic.js";
import { runQuiz } from "./ui/quiz.js";

// ?debug (bot, kịch bản kiểm thử) bỏ comic và khung chèn giữa trận; thêm &story để vẫn phát
const STORY = !/[?&]debug\b/.test(location.search) || /[?&]story\b/.test(location.search);
const CH = "B15";

const app = document.getElementById("app");
let save = loadSave();
if (syncLegacy(save)) writeSave(save);
let tab = "xuattran";
let pick = { R: Math.max(...save.ladder.unlocked), difficulty: save.settings.difficulty };
const music = new Music(save.settings.music ?? 0.5);
music.play("hub");
const persist = () => writeSave(save);
const n = (v) => Math.round(v).toLocaleString("vi-VN");
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
let toastT = 0;
function toast(msg, bad = false) {
  let t = document.querySelector(".toast"); if (!t) { t = document.createElement("div"); t.className = "toast"; document.body.appendChild(t); }
  t.textContent = msg; t.classList.toggle("bad", bad); t.classList.add("on");
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), 2200);
}
const act = (r, okMsg) => { if (r.ok) { persist(); toast(okMsg); } else toast(r.why, true); render(); };

// ---- khung hub -------------------------------------------------------------------------------
function render() {
  const h = save.hero, w = save.wallet;
  const expPct = h.level >= LEVEL_CAP ? 100 : (h.exp / EXP_NEXT(h.level)) * 100;
  const tabs = [["xuattran", "Xuất trận"], ["huanluyen", "Huấn luyện"], ["suquan", "Sử quán"], ["votruong", "Võ trường"], ["truongsoai", "Trướng soái"], ["loren", "Lò rèn"], ["luyenbinh", "Luyện binh"], ["doanhtrai", "Doanh trại"], ["hoso", "Hồ sơ"]];
  const unread = unreadCards().length;
  app.innerHTML = `
  <div class="hub">
    <header class="hub-head">
      <div class="brand"><h1>HÀO KHÍ ĐÔNG A</h1><p>Nam Quốc Sơn Hà · Quyển Nhà Trần · bản thử B15 Hàm Tử</p></div>
      <div class="purse">
        <span class="chip tien" title="Tiền (quan tiền)">${n(w.tien)}<small>Tiền</small></span>
        <span class="chip tt" title="Tinh thiết">${n(w.tt)}<small>Tinh thiết</small></span>
        <span class="chip qc" title="Quân công">${n(w.qc)}<small>Quân công</small></span>
      </div>
      <div class="herochip"><b>Trần Quốc Toản</b><span>Cấp ${h.level}${h.level >= LEVEL_CAP ? " (trần R1)" : ""} · Doanh trại cấp ${save.camp}</span>
        <div class="exp"><div style="width:${expPct}%"></div></div><small>${h.level >= LEVEL_CAP ? "Đã đạt trần" : `${n(h.exp)} / ${n(EXP_NEXT(h.level))} EXP`}</small></div>
    </header>
    <nav class="tabs">${tabs.map(([k, l]) => `<button data-tab="${k}" class="${tab === k ? "on" : ""}">${l}${k === "truongsoai" && P.freePoints(save) > 0 ? ` <em>${P.freePoints(save)}</em>` : ""}${k === "huanluyen" && !save.tutorial?.done ? ` <em>mới</em>` : ""}${k === "suquan" && unread ? ` <em>${unread}</em>` : ""}</button>`).join("")}</nav>
    <main class="hub-body">${{ xuattran, huanluyen, suquan, votruong, truongsoai, loren, luyenbinh, doanhtrai, hoso }[tab]()}</main>
  </div>`;
  app.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => { tab = b.dataset.tab; render(); }));
  bind[tab]?.();
}

// ---- Xuất trận --------------------------------------------------------------------------------
function xuattran() {
  const st = P.heroStats(save, pick.R);
  const diff = DIFFICULTY.find((d) => d.id === pick.difficulty);
  return `${save.tutorial?.done ? "" : tutorialBanner()}
  <section class="card battle">
    <div class="battle-art"><div class="seal">B15</div><div><h2>Trận Hàm Tử</h2><p>Tháng 4 năm Ất Dậu · 1285 · bến Hàm Tử, sông Hồng</p></div></div>
    <p class="lead">Chiếm bến trên, giữ hai cánh, phá Hàm Tử quan, đánh lui ${BOSS.name}. Hai mặt trận cách nhau 150 m: bạn không thể có mặt ở cả hai, nên hãy dùng Mệnh Lệnh.</p>
    <ul class="notes">${HISTORY_NOTES.map((x) => `<li><span class="label ${x.label === "Chính sử" ? "cs" : x.label === "Tương truyền" ? "tt" : "hc"}">${x.label}</span>${esc(x.text)}</li>`).join("")}</ul>
    ${chapterState(save, CH).openSeen ? `<div class="row" style="margin-top:10px"><button data-comic="open">Xem comic mở chương</button>
      <span class="small">Lần đầu vào trận, comic mở chương tự phát (bỏ qua được). Đọc lại mọi lúc ở Sử quán.</span></div>`
      : `<p class="small" style="margin-top:10px">Trước trận đầu tiên có comic mở chương (6 khung, chừng 40 giây, bỏ qua được).</p>`}
  </section>
  ${chapterState(save, CH).cleared ? `<section class="card battle" style="opacity:.8"><div class="battle-art"><div class="seal" style="background:#2e2620">B20</div>
    <div><h2>Chương kế: Bạch Đằng</h2><p>Ngày 8 tháng 3 năm Mậu Tý · 9/4/1288</p></div></div>
    <p class="small">Trận quyết định của Quyển VI. Chương này còn đang dựng trong bản thử.</p></section>` : ""}
  <section class="card">
    <h3>Cấp trận R</h3>
    <div class="ladder">${R_LADDER.map((R) => {
      const open = save.ladder.unlocked.includes(R), best = save.ladder.best[R];
      return `<button data-r="${R}" class="${pick.R === R ? "on" : ""}" ${open ? "" : "disabled"}>R ${R}${best ? `<em class="rank r${best}">${best}</em>` : ""}${open ? "" : "<small>khóa</small>"}</button>`;
    }).join("")}</div>
    <p class="small">Thắng một cấp thì mở cấp kế (+3, như R1: B12 = 1 … B20 = 25). Địch mạnh theo R; tướng được nâng tối thiểu lên cấp R − 2 và binh khí tối thiểu E(R) − 0,10 khi vào trận (12.1, 12.7).</p>
    <h3>Chế độ</h3>
    <div class="ladder">${Object.values(MODES).map((m) => `<button data-mode="${m.id}" class="${(save.settings.mode || "nhanh") === m.id ? "on" : ""}">${m.name}<small>par ${m.par / 60} phút · ${m.id === "nhanh" ? "Hào Khí ×1,3 · thưởng ×0,6 · 1 Kế Sách" : "thưởng ×1 · 2 Kế Sách"}</small></button>`).join("")}</div>
    <h3>Độ khó</h3>
    <div class="ladder">${DIFFICULTY.map((d) => `<button data-diff="${d.id}" class="${pick.difficulty === d.id ? "on" : ""}">${d.name}<small>${d.tokens} lính đánh cùng lúc · thưởng ×${d.reward}</small></button>`).join("")}</div>
    <div class="grid2">
      <div><h3>Vào trận với</h3><table class="stat">
        <tr><td>Cấp</td><td>${st.level}${st.floorLifted ? ` <em class="lift">nâng từ ${save.hero.level}</em>` : ""}</td></tr>
        <tr><td>Công</td><td>${n(st.cong)}</td></tr><tr><td>Sinh lực</td><td>${n(st.hp)}</td></tr><tr><td>Giáp</td><td>${n(st.giap)}</td></tr>
        <tr><td>Hệ số binh khí</td><td>×${st.weaponMult.toFixed(2).replace(".", ",")}${st.weaponFloor ? ` <em class="lift">Quân giới cấp phát</em>` : ""}</td></tr>
        <tr><td>Chí mạng</td><td>${Math.round(st.crit * 100)}%</td></tr>
        <tr><td>Gượng dậy</td><td>${diff.revive} lần</td></tr>
        <tr><td>Đòn mạnh</td><td>C1–C4${save.hero.level >= MOVES.C5.unlockLv || st.level >= 5 ? ", C5" : ""}${st.level >= MOVES.C6.unlockLv ? ", C6" : ""}</td></tr>
      </table></div>
      <div><h3>Hiển thị</h3>
        <label class="field">Số lính hiển thị <select data-set="troops">${TROOP_LEVELS.map((t) => `<option value="${t.id}" ${t.id === save.settings.troops ? "selected" : ""}>${t.name} · ${t.N}</option>`).join("")}</select></label>
        <label class="field">Điều khiển cảm ứng <select data-set="touch">${[["auto", "Tự nhận"], ["on", "Bật"], ["off", "Tắt"]].map(([v, l]) => `<option value="${v}" ${v === save.settings.touch ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        <label class="field">Bóng <input type="checkbox" data-set="shadows" ${save.settings.shadows ? "checked" : ""}></label>
        <button class="primary go" data-go>VÀO TRẬN</button>
      </div>
    </div>
  </section>`;
}

// ---- Huấn luyện (đợt 7) ------------------------------------------------------------------------
// Màn huấn luyện có bài tập (chạy trên sân Võ trường, không cần Doanh trại cấp 3) và bảng đòn có icon.
let guideDev = matchMedia("(pointer: coarse)").matches ? 1 : 0;
function tutorialBanner() {
  return `<section class="card tutbanner"><img src="${ICON("n")}" alt=""><div style="flex:1"><h3>Lần đầu ra trận?</h3>
    <p class="small">11 bài tập ngắn ở Võ trường, chừng bốn phút: chuỗi đòn song đao, né, đỡ, phản đòn, Đòn Quyết, Phá Trận, Tuyệt Kỹ.</p></div>
    <button class="primary" data-tutgo>Vào huấn luyện</button></section>`;
}
function huanluyen() {
  const done = save.tutorial?.done;
  return `<section class="card tutbanner"><img src="${ICON("ult")}" alt=""><div style="flex:1"><h3>Màn huấn luyện ${done ? "· đã xong" : ""}</h3>
      <p>Tập từng thao tác trên sân Võ trường: mỗi bài có mục tiêu, làm được thì sang bài sau. Tướng không gục trong lúc tập.</p>
      <p class="small">Có thể chơi lại bất cứ lúc nào. Không cần Doanh trại cấp 3.</p></div>
      <button class="primary" data-tutgo>${done ? "Tập lại" : "Vào huấn luyện"}</button></section>
    <section class="card"><div class="row" style="justify-content:space-between"><h3>Bảng đòn và điều khiển</h3>
      <div class="row">${["Bàn phím", "Cảm ứng", "Tay cầm"].map((l, i) => `<button data-gdev="${i}" class="${guideDev === i ? "primary" : ""}">${l}</button>`).join("")}</div></div>
      ${movesGuideHTML({ dev: guideDev })}</section>`;
}

async function startTutorial() {
  app.innerHTML = `<div class="loading"><h2>Võ trường · Huấn luyện</h2><p>Trần Quốc Toản luyện song đao trước khi ra bến Hàm Tử.</p><div class="spin"></div><p class="small">Bấm vào màn hình để khóa chuột và điều khiển camera. Esc để tạm dừng.</p></div>`;
  await new Promise((r) => setTimeout(r, 60));
  const { runArena } = await import("./battle/arena.js");
  const stage = document.createElement("div"); stage.className = "stage"; document.body.appendChild(stage);
  app.style.display = "none";
  let res = null;
  try { res = await runArena({ container: stage, save, R: Math.max(1, Math.min(...save.ladder.unlocked)), difficulty: "danbinh", music, opts: { mode: "huanluyen" }, onSettings: () => persist() }); }
  catch (err) { console.error(err); toast("Lỗi màn huấn luyện: " + err.message, true); }
  stage.remove(); stage.replaceChildren(); app.style.display = ""; music.play("hub");
  if (res?.done) { save.tutorial = { done: true, at: Date.now() }; persist(); toast("Xong huấn luyện — sẵn sàng ra bến Hàm Tử!"); tab = "xuattran"; }
  else if (res) toast(`Đã rời huấn luyện ở bài ${Math.max(1, res.reached)} / ${res.total}.`);
  render();
}

// ---- Sử quán (12.11, 22.3, 22.6) -----------------------------------------------------------------
// Thư viện thẻ sử liệu, comic đã gặp (đọc lại), Quiz chương. Thẻ và comic mở miễn phí theo tiến độ.
const LCLS = { "Chính sử": "cs", "Tương truyền": "tt", "Hư cấu": "hc" };
const unreadCards = () => Object.keys(save.cards || {}).filter((id) => !(save.cardsRead || []).includes(id));
const TITLES = [
  { id: "giabinh", name: "Gia Binh Hoài Văn", how: "Hạng A trở lên ở trận Hàm Tử", ok: (s) => Object.values(s.ladder.best).some((r) => r === "A" || r === "S") },
  { id: "suquan", name: "Sử Quan Đông A", how: "Trả lời đúng hết câu Quiz của Quyển (tính cả lần ôn)", ok: (s) => QUIZ_B15.every((q) => s.quiz?.answered?.[q.id]?.right > 0) },
];
function suquan() {
  const ch = chapterState(save, CH), cards = save.cards || {}, read = save.cardsRead || [];
  const Q = save.quiz || { answered: {}, review: [] };
  const met = QUIZ_B15.filter((q) => Q.answered[q.id]).length;
  const cardBtn = (c) => cards[c.id]
    ? `<button class="sq-card ${read.includes(c.id) ? "" : "new"}" data-card="${c.id}"><b>${esc(c.title)}</b><small><span class="label ${LCLS[c.label]}">${c.label}</span>${read.includes(c.id) ? "" : "Mới mở"}</small></button>`
    : `<div class="sq-card lock"><b>Thẻ chưa mở</b><small>${esc(c.hint)}</small></div>`;
  const s = save.settings;
  return `
  <section class="card"><h3>Sử quán</h3>
    <p class="small">Thư viện thẻ sử liệu, mở miễn phí theo tiến độ. Mỗi thẻ mang đúng một nhãn Chính sử, Tương truyền hoặc Hư cấu kèm nguồn. Bản thử: thẻ và câu hỏi chưa qua cố vấn sử duyệt.</p>
    <p class="small">Danh hiệu: ${TITLES.map((t) => `<span class="lift" style="${t.ok(save) ? "" : "opacity:.45"}" title="${esc(t.how)}">${t.name}</span>`).join(" ")}</p>
  </section>
  <section class="grid2">
    <div class="card"><h3>Comic · Quyển VI · Chương Hàm Tử</h3>
      <div class="comic-row">
        <button data-comic="open" ${ch.openSeen ? "" : "disabled"}><b>Mở chương</b><small>${ch.openSeen ? `${COMIC_B15.open.length} khung · Tình thế, Chủ soái quyết` : "Mở khi vào trận lần đầu"}</small></button>
        <button data-comic="insert" ${ch.insertSeen ? "" : "disabled"}><b>Giữa trận</b><small>${ch.insertSeen ? "1 khung · Áo Tống trên bến" : "Mở khi thuyền quân Triệu Trung cập bến"}</small></button>
        <button data-comic="close" ${ch.cleared || ch.closeSeen ? "" : "disabled"}><b>Kết chương</b><small>${ch.cleared || ch.closeSeen ? `${COMIC_B15.close.length} khung${ch.closeSeen ? "" : " · chưa đọc"}` : "Mở khi thắng trận"}</small></button>
      </div>
      <p class="small">Chương Bạch Đằng: đang dựng.</p>
      <h3>Cài đặt đọc</h3>
      <label class="field">Cỡ chữ lời dẫn, bóng thoại <input type="range" min="0.8" max="1.5" step="0.1" value="${Number(s.comicText) || 1}" data-rs="comicText"><b>${Math.round((Number(s.comicText) || 1) * 100)}%</b></label>
      <label class="field">Rung và nháy (lia, phóng khung) <input type="checkbox" data-rs="motion" ${s.motion !== false ? "checked" : ""}></label>
      <label class="field">Chế độ đọc <select data-rs="comicMode">${[["auto", "Tự chọn theo màn hình"], ["page", "Nguyên trang"], ["panel", "Từng khung"]].map(([v, l]) => `<option value="${v}" ${(s.comicMode || "auto") === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
    </div>
    <div class="card"><h3>Quiz chương</h3>
      <p class="small">Sử quan hỏi 3–5 câu về điều tướng quân đã gặp trong comic, trong trận và trong thẻ. Không tính giờ, không trừ gì; chỉ thưởng thẻ và danh hiệu.</p>
      <p>Đã gặp ${met} / ${QUIZ_B15.length} câu của Chương${(Q.review || []).length ? ` · ${Q.review.length} câu chờ hỏi lại` : ""}.</p>
      <button class="primary" data-quiz ${ch.cleared ? "" : "disabled"}>Hỏi sử quan</button>${ch.cleared ? "" : `<p class="small">Mở sau khi thắng trận Hàm Tử.</p>`}
    </div>
  </section>
  <section class="card"><h3>Thẻ sử liệu · ${Object.keys(cards).length} / ${CARDS.length}</h3>
    ${CARD_GROUPS.map((g) => { const cs = CARDS.filter((c) => c.group === g.id); return cs.length ? `<div class="sq-group">${g.name}</div><div class="cards">${cs.map(cardBtn).join("")}</div>` : ""; }).join("")}
  </section>`;
}

function showCard(id, onClose = render) {
  const c = CARD_BY_ID[id], ch = chapterState(save, c.chapter);
  save.cardsRead = [...new Set([...(save.cardsRead || []), id])]; persist();
  const seenPanels = c.panels.filter((p) => ch.seen.includes(p));
  document.activeElement?.blur?.();              // Enter không mở thêm một thẻ chồng lên
  const d = document.createElement("div"); d.className = "sq-detail";
  d.innerHTML = `<div class="card"><p class="small">${CARD_GROUPS.find((g) => g.id === c.group).name} · Chương ${c.chapter}</p>
    <h2>${esc(c.title)} <span class="label ${LCLS[c.label]}">${c.label}</span></h2>
    ${c.body.map((p) => `<p>${esc(p)}</p>`).join("")}
    ${seenPanels.length ? `<div class="row">${seenPanels.map((p) => `<button data-panel="${p}">Xem khung ${p}</button>`).join("")}</div>` : ""}
    <p class="src">Nguồn: ${c.src.map(esc).join(" · ")}<br>${c.review === "draft" ? "Chờ cố vấn sử duyệt. " : ""}Góp ý sử liệu: bản thử chưa có biểu mẫu.</p>
    <div class="row center"><button class="primary" data-close>Đóng</button></div></div>`;
  document.body.appendChild(d);
  const close = () => { d.remove(); removeEventListener("keydown", onKey); onClose(); };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  addEventListener("keydown", onKey);
  d.onclick = (e) => { if (e.target === d) close(); };
  d.querySelector("[data-close]").onclick = close;
  d.querySelectorAll("[data-panel]").forEach((b) => (b.onclick = () => readComic(COMIC_B15, { ids: [b.dataset.panel], single: true, title: c.title, closeLabel: "Đóng", settings: save.settings, onSettings: persist })));
}

// Phát một phần comic của B15 (open | insert | close), ghi khung đã xem. Trả về { skipped, seen }.
async function playComic(part, { title } = {}) {
  const ids = COMIC_B15[part];
  const names = { open: "Mở chương", insert: "Giữa trận", close: "Kết chương" };
  const r = await readComic(COMIC_B15, {
    ids, title: title || `Quyển VI · Chương Hàm Tử · ${names[part]}`, settings: save.settings, onSettings: persist,
    onSeen: (s) => { markSeen(save, CH, s); persist(); },
  });
  const ch = chapterState(save, CH);
  if (part === "open") { ch.openSeen = true; if (r.skipped) ch.openSkips = (ch.openSkips || 0) + 1; }
  if (part === "close") { ch.closeSeen = true; if (r.skipped) ch.closeSkips = (ch.closeSkips || 0) + 1; }
  persist();
  return r;
}

async function startQuiz() {
  const items = pickQuiz(save, QUIZ_B15, { chapter: CH, n: 4 });
  if (!items.length) { toast("Sử quan chưa có câu nào để hỏi — hãy đọc comic hoặc mở thêm thẻ."); return; }
  const ch = chapterState(save, CH);
  await runQuiz({
    items, comic: COMIC_B15, settings: save.settings, onSettings: persist,
    onSeen: (s) => { markSeen(save, CH, s); persist(); },
    onAnswer: (it, right) => { answerQuiz(save, it, right); persist(); },
    onFinish: () => {
      ch.quizRounds = (ch.quizRounds || 0) + 1;
      const got = unlockCards(save, CH, ["firstQuiz"]); persist();
      return got.map((id) => CARD_BY_ID[id]);
    },
  });
  render();
}

// ---- Võ trường (13.5) -------------------------------------------------------------------------
let arenaPick = { mode: "duako", tier: "thuong", count: 12, invincible: false, seed: 1285, sync: false };
const fmtT = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;
function votruong() {
  if (save.camp < 3) return lockedCard("Võ trường", 3);
  const A = save.arena || { medals: {}, best: {}, goldWeeks: [] }, week = isoWeekKey();
  const medalOf = (node) => { const m = A.medals[node]; return m ? `<em class="medal ${m}">${MEDALS.find((x) => x.id === m).name}</em>` : ""; };
  const board = (key, ko) => (A.best[key] || []).map((r, i) => `<li>${i + 1}. ${ko ? r.v + " KO" : fmtT(r.v)} <small>cấp ${r.lv} · R ${r.R}</small></li>`).join("") || `<li class="small">Chưa có lượt nào.</li>`;
  const sk = arenaPick.sync ? "dongbo" : "tudo";
  const card = (id, body) => `<button class="amode ${arenaPick.mode === id ? "on" : ""}" data-amode="${id}"><b>${ARENA_MODES[id].name}</b><span>${ARENA_MODES[id].text}</span>${body || ""}</button>`;
  const P1 = arenaPick;
  return `
  <section class="card"><h3>Võ trường · Doanh trại cấp 3</h3>
    <p class="small">Thưởng lần đầu đạt mỗi mức ở một nút: Đồng 5 · Bạc 10 · Vàng 15 Tinh thiết. Vàng Seed tuần ở 4 tuần khác nhau: binh khí bậc Danh (${A.goldWeeks.length}/4). Chơi lại: EXP và Tiền theo thời lượng (×0,1–0,6).</p>
    <div class="amodes">${card("luyentap")}${card("duako", medalOf("duako"))}${card("thoigian", medalOf("thoigian"))}${card("seedtuan", `<small>Tuần ${week}</small>${medalOf("tuan:" + week)}`)}</div>
  </section>
  <section class="grid2">
    <div class="card"><h3>Thiết lập</h3>
      ${P1.mode === "luyentap" ? `
        <label class="field">Bậc địch <select data-ap="tier">${Object.entries(TIERS).map(([k, t]) => `<option value="${k}" ${P1.tier === k ? "selected" : ""}>${t.name}</option>`).join("")}</select></label>
        <label class="field">Số lượng (sĩ quan tối đa 3) <input type="range" min="1" max="30" value="${P1.count}" data-ap="count"><b>${P1.count}</b></label>
        <label class="field">Bất tử <input type="checkbox" data-ap="invincible" ${P1.invincible ? "checked" : ""}></label>` : ""}
      ${P1.mode === "thoigian" ? `<label class="field">Seed <input type="number" value="${P1.seed}" data-ap="seed" style="width:120px"><button data-rseed>Ngẫu nhiên</button></label>` : ""}
      ${P1.mode !== "luyentap" ? `<label class="field">Đồng bộ cấp: cấp = R, binh khí E(R), không Khắc, quân đoàn cấp 3 <input type="checkbox" data-ap="sync" ${P1.sync ? "checked" : ""}></label>` : ""}
      <label class="field">Cấp địch R <select data-ap="R">${save.ladder.unlocked.map((r) => `<option value="${r}" ${pick.R === r ? "selected" : ""}>R ${r}</option>`).join("")}</select></label>
      <p class="small">Độ khó theo thẻ Xuất trận: ${DIFFICULTY.find((d) => d.id === pick.difficulty).name}.</p>
      <button class="primary go" data-arena-go>VÀO VÕ TRƯỜNG</button>
    </div>
    <div class="card"><h3>Bảng điểm cục bộ · ${P1.sync ? "Đồng bộ cấp" : "Tự do"}</h3>
      ${P1.mode === "duako" ? `<ol class="board">${board("duako|" + sk, true)}</ol>` : ""}
      ${P1.mode === "thoigian" ? `<p class="small">Seed ${P1.seed}</p><ol class="board">${board("seed:" + P1.seed + "|" + sk)}</ol>` : ""}
      ${P1.mode === "seedtuan" ? `<p class="small">Tuần ${week}</p><ol class="board">${board("tuan:" + week + "|" + sk)}</ol>` : ""}
      ${P1.mode === "luyentap" ? `<p class="small">Luyện tập không ghi điểm.</p>` : ""}
    </div>
  </section>`;
}

// ---- Trướng soái: chỉ số + cây kỹ năng -----------------------------------------------------------
function truongsoai() {
  const s = HERO.stats, st = P.heroStats(save, 1), m = st.mods;
  const star = (v) => "★".repeat(v) + "☆".repeat(5 - v);
  const col = (b) => {
    const tiers = [1, 2, 3, 4].map((t) => `<div class="tier"><span class="tn">Tầng ${t} · ${t} điểm</span>${NODES.filter((x) => x.b === b && x.t === t && !x.apex).map(nodeBtn).join("")}</div>`).join("");
    const apex = NODES.find((x) => x.b === b && x.apex);
    return `<div class="branch"><h4>${TREE[b].name} · <i>${TREE[b].title}</i></h4><p class="small">${TREE[b].blurb} · đã tiêu ${P.spentPoints(save, b)} điểm</p>${tiers}<div class="tier apex"><span class="tn">Đỉnh · 5 điểm (cấp ${TREE_RULES.apexMinLevel}, ≥ ${TREE_RULES.apexMinBranch} điểm trong nhánh)</span>${nodeBtn(apex)}</div></div>`;
  };
  return `
  <section class="card">
    <div class="grid2">
      <div><h3>Trần Quốc Toản · Hoài Văn hầu</h3><p class="small">Lớp WC03 Song đao · archetype Tốc độ – xuyên đội hình</p>
        <table class="stat">
          <tr><td>Công</td><td>${star(s.cong)}</td></tr><tr><td>Thủ</td><td>${star(s.thu)}</td></tr><tr><td>Tốc</td><td>${star(s.toc)}</td></tr>
          <tr><td>Tầm</td><td>${star(s.tam)}</td></tr><tr><td>Thống Suất</td><td>${star(s.thong)}</td></tr>
        </table>
        <p class="small">Cấp ${save.hero.level}: Công ${n(st.cong)} · Sinh lực ${n(st.hp)} · Giáp ${n(st.giap)} · Thân binh ${HERO.bodyguards + m.bodyguards} · hào quang ${HERO.aura + m.aura} m</p>
        <p class="small"><span class="label cs">Chính sử</span> lá cờ sáu chữ, gia binh hơn nghìn người, chuyện quả cam ở Bình Than. <span class="label hc">Hư cấu</span> song đao, tên các nút kỹ năng.</p>
      </div>
      <div><h3>Điểm kỹ năng</h3>
        <p class="big">${P.freePoints(save)} <small>còn / ${P.totalPoints(save)} tổng</small></p>
        <p class="small">1 điểm mỗi cấp; +1 lần đầu đạt hạng S ở mỗi cấp trận. Tẩy điểm miễn phí, không giới hạn. R1 chỉ mở 1 nút đỉnh.</p>
        <button data-respec>Tẩy điểm</button>
      </div>
    </div>
  </section>
  <section class="tree">${["vo", "thong", "muu"].map(col).join("")}</section>`;
}
function nodeBtn(nd) {
  const owned = save.hero.nodes.includes(nd.id), c = P.canBuy(save, nd.id);
  const cls = owned ? "owned" : c.ok ? "avail" : "lock";
  return `<button class="node ${cls}" data-node="${nd.id}" title="${esc(owned ? "Đã học" : c.why || "Học nút này")}">
    <b>${nd.name}</b><span>${nd.text}</span>${nd.kind ? `<em>${nd.kind}</em>` : ""}${nd.inert ? `<em class="inert">${nd.inertWhy || "chưa có ở bản thử"}</em>` : ""}
    ${!owned && !c.ok ? `<small>${esc(c.why)}</small>` : ""}</button>`;
}

// ---- Lò rèn ----------------------------------------------------------------------------------
function loren() {
  if (save.camp < 2) return lockedCard("Lò rèn", 2);
  const w = save.weapon, t = P.tierInfo(w.tier), next = WEAPON_TIERS[w.tier];
  const fc = w.forge < FORGE.maxLevel ? FORGE.cost(w.forge + 1) : null;
  const mult = P.weaponMult(w);
  return `
  <section class="card">
    <div class="weapon"><div class="wicon t${w.tier}">⚔</div><div>
      <h3>${WEAPON_NAMES[w.tier]} ${w.forge ? `+${w.forge}` : ""}</h3>
      <p>Bậc <b>${t.name}</b> (+${Math.round(t.pct * 100)}%) · rèn +${w.forge} (+${Math.round(w.forge * FORGE.atkPerLevel * 100)}%) · hệ số <b>×${mult.toFixed(2).replace(".", ",")}</b> (trần ×1,8) · ${t.slots} ô Khắc</p>
      <p class="small">Binh khí lưu theo lớp WC03: đổi bậc vẫn giữ mức rèn và dòng Khắc. Rơi đồ cố định theo điều kiện, không ngẫu nhiên.</p></div></div>
  </section>
  <section class="grid3">
    <div class="card"><h3>Nâng bậc</h3>
      ${next ? (next.up ? `<p>Lên <b>${next.name}</b> (+${Math.round(next.pct * 100)}%, ${next.slots} ô Khắc)</p><p class="cost">${n(next.up.tien)} Tiền · ${next.up.tt} Tinh thiết</p><button data-tier>Nâng bậc</button>`
        : `<p>Lên <b>${next.name}</b>: ${next.tier === 4 ? "chỉ rơi khi lần đầu đánh lui Toa Đô ở Tướng quân trở lên" : "nhiệm vụ riêng khi tướng cấp 30 (chưa có ở bản thử)"}.</p>`) : "<p>Bậc cao nhất.</p>"}
      <p class="small">Rơi tự nhiên: Tinh khi lần đầu hạng A ở R 5–14; Bảo khi lần đầu hạng A ở R ≥ 15.</p>
    </div>
    <div class="card"><h3>Rèn</h3>
      ${fc ? `<p>Rèn lên <b>+${w.forge + 1}</b> (+6% Công, không có tỉ lệ thất bại)</p><p class="cost">${n(fc.tien)} Tiền · ${fc.tt} Tinh thiết</p><button data-forge>Rèn</button>` : "<p>Đã rèn +5.</p>"}
      <h3>Đúc thép</h3><p class="cost">400 Tiền → 1 Tinh thiết</p><div class="row"><button data-smelt="1">Đúc ×1</button><button data-smelt="5">Đúc ×5</button></div>
    </div>
    <div class="card"><h3>Ô Khắc</h3>
      ${t.slots === 0 ? "<p>Binh khí bậc Thường và Tinh chưa có ô Khắc. Bậc Bảo có 1 ô.</p>" :
        [...Array(t.slots)].map((_, i) => `<label class="field">Ô ${i + 1} <select data-khac="${i}"><option value="">— trống —</option>${KHAC.map((k) => `<option value="${k.id}" ${w.khac[i] === k.id ? "selected" : ""}>${k.name}: ${k.text}</option>`).join("")}</select></label>`).join("") +
        `<p class="small">Khắc ô trống miễn phí; tẩy dòng cũ tốn ${n(FORGE.rerollKhac(w.tier))} Tiền. Chí mạng từ cây và Khắc chung trần 30%.</p>`}
    </div>
  </section>`;
}

// ---- Luyện binh --------------------------------------------------------------------------------
function luyenbinh() {
  if (save.camp < 2) return lockedCard("Luyện binh trường", 2);
  const L = save.legion;
  const gc = L.giao < LEGION.unitMax ? LEGION.unitCost(L.giao + 1) : null, tc = L.guard < LEGION.guardMax ? LEGION.guardCost(L.guard + 1) : null;
  return `
  <section class="grid2">
    <div class="card"><h3>Giáo binh Đại Việt · cấp ${L.giao}/5</h3>
      <p>Lính hiển thị Sinh lực/Công <b>+${(L.giao - 1) * 8}%</b> · hệ số mô phỏng c <b>+${(L.giao - 1) * 3}%</b></p>
      ${gc ? `<p class="cost">Lên cấp ${L.giao + 1}: ${n(gc)} Quân công</p><button data-legion="giao">Luyện</button>` : "<p>Cấp tối đa.</p>"}
      <p class="small">Cấp binh chủng đổi chất lượng quân, không đổi số lính hiển thị (12.8). Quân ta ở trận Hàm Tử là giáo binh.</p></div>
    <div class="card"><h3>Thân binh · cấp ${L.guard}/5</h3>
      <ol class="perks">${LEGION.guardPerks.map((p, i) => `<li class="${i < L.guard ? "on" : ""}">${p}</li>`).join("")}</ol>
      ${tc ? `<p class="cost">Lên cấp ${L.guard + 1}: ${n(tc)} Quân công</p><button data-legion="guard">Luyện</button>` : "<p>Cấp tối đa.</p>"}
      <p class="small">Bản thử: mỗi cấp thân binh +10% Sinh lực/Công; từ cấp 3 là Tinh nhuệ.</p></div>
  </section>
  <p class="small center">Quân công đến từ Hào Khí gốc, Kế Sách và Sĩ Khí trung bình — không từ KO — để phần thưởng nuôi trụ cột "Quân ta".</p>`;
}

// ---- Doanh trại --------------------------------------------------------------------------------
function doanhtrai() {
  const next = save.camp < CAMP.maxLevel ? CAMP.cost(save.camp + 1) : null;
  return `
  <section class="card"><h3>Doanh trại · cấp ${save.camp}/${CAMP.maxLevel}</h3>
    ${next ? `<p class="cost">Lên cấp ${save.camp + 1}: ${n(next)} Tiền</p><button data-camp>Nâng Doanh trại</button>` : "<p>Cấp tối đa.</p>"}
    <div class="buildings">${CAMP.buildings.map((b) => `<div class="bld ${save.camp >= b.lv ? "on" : ""}"><b>${b.name}</b><span>${b.text}</span><small>${save.camp >= b.lv ? (b.id === "votruong" ? "Chưa có ở bản thử" : "Đã mở") : `Cần cấp ${b.lv}`}</small></div>`).join("")}</div>
  </section>`;
}

// ---- Hồ sơ -------------------------------------------------------------------------------------
function hoso() {
  const s = save.stats;
  return `
  <section class="grid2">
    <div class="card"><h3>Chiến tích</h3><table class="stat">
      <tr><td>Số trận</td><td>${s.battles}</td></tr><tr><td>Thắng</td><td>${s.wins}</td></tr>
      <tr><td>Tổng KO</td><td>${n(s.ko)}</td></tr><tr><td>Lần kích Tổng Phản Công</td><td>${s.tpc}</td></tr>
      <tr><td>Thắng nhanh nhất</td><td>${s.bestTime ? `${Math.floor(s.bestTime / 60)}:${String(s.bestTime % 60).padStart(2, "0")}` : "—"}</td></tr></table>
      <h3>Nhật ký</h3><table class="stat log">${save.log.map((l) => `<tr><td>R ${l.R}</td><td>${l.won ? `Thắng · hạng ${l.rank}` : "Thua"}</td><td>+${n(l.exp)} EXP</td><td>+${n(l.tien)} Tiền</td></tr>`).join("") || "<tr><td>Chưa có trận nào.</td></tr>"}</table>
    </div>
    <div class="card"><h3>Bản lưu</h3>
      <p class="small">Lưu trong trình duyệt này. Safari xóa dữ liệu trang sau 7 ngày không mở, nên hãy xuất file nếu chơi trên iPhone.</p>
      <div class="row"><button data-export>Xuất file</button><label class="btn">Nhập file<input type="file" accept="application/json" data-import hidden></label><button data-reset class="danger">Xóa bản lưu</button></div>
      <p class="small">Không gacha, không bán tiền tệ hay chỉ số (12.12). Mọi phần thưởng rơi theo điều kiện cố định.</p>
    </div>
  </section>`;
}

function lockedCard(name, lv) {
  return `<section class="card center"><h3>${name}</h3><p>Cần Doanh trại cấp ${lv}. Nâng ở thẻ Doanh trại (${n(CAMP.cost(lv))} Tiền).</p><button data-tab-go="doanhtrai">Tới Doanh trại</button></section>`;
}

// ---- gắn sự kiện ------------------------------------------------------------------------------
const bind = {
  huanluyen() {
    app.querySelector("[data-tutgo]")?.addEventListener("click", startTutorial);
    app.querySelectorAll("[data-gdev]").forEach((b) => (b.onclick = () => { guideDev = Number(b.dataset.gdev); render(); }));
  },
  votruong() {
    app.querySelector("[data-tab-go]")?.addEventListener("click", () => { tab = "doanhtrai"; render(); });
    app.querySelectorAll("[data-amode]").forEach((b) => (b.onclick = () => { arenaPick.mode = b.dataset.amode; render(); }));
    app.querySelectorAll("[data-ap]").forEach((el) => (el.onchange = () => {
      const k = el.dataset.ap, v = el.type === "checkbox" ? el.checked : el.type === "range" || el.type === "number" ? Number(el.value) : el.value;
      if (k === "R") pick.R = Number(v); else arenaPick[k] = v;
      render();
    }));
    app.querySelector("[data-rseed]")?.addEventListener("click", () => { arenaPick.seed = Math.floor(Math.random() * 999999); render(); });
    app.querySelector("[data-arena-go]")?.addEventListener("click", startArena);
  },
  xuattran() {
    app.querySelectorAll("[data-r]").forEach((b) => (b.onclick = () => { pick.R = Number(b.dataset.r); render(); }));
    app.querySelectorAll("[data-mode]").forEach((b) => (b.onclick = () => { save.settings.mode = b.dataset.mode; persist(); render(); }));
    app.querySelectorAll("[data-diff]").forEach((b) => (b.onclick = () => { pick.difficulty = b.dataset.diff; save.settings.difficulty = pick.difficulty; persist(); render(); }));
    app.querySelectorAll("[data-set]").forEach((el) => (el.onchange = () => { save.settings[el.dataset.set] = el.type === "checkbox" ? el.checked : el.value; persist(); }));
    app.querySelector("[data-go]").onclick = startBattle;
    app.querySelector("[data-tutgo]")?.addEventListener("click", startTutorial);
    app.querySelector("[data-comic]")?.addEventListener("click", async () => { await playComic("open"); render(); });
  },
  suquan() {
    app.querySelectorAll("[data-card]").forEach((b) => (b.onclick = () => showCard(b.dataset.card)));
    app.querySelectorAll("[data-comic]").forEach((b) => (b.onclick = async () => { await playComic(b.dataset.comic); render(); }));
    app.querySelector("[data-quiz]")?.addEventListener("click", startQuiz);
    app.querySelectorAll("[data-rs]").forEach((el) => (el.onchange = () => {
      save.settings[el.dataset.rs] = el.type === "checkbox" ? el.checked : el.type === "range" ? Number(el.value) : el.value;
      persist(); render();
    }));
  },
  truongsoai() {
    app.querySelectorAll("[data-node]").forEach((b) => (b.onclick = () => act(P.buyNode(save, b.dataset.node), "Đã học nút kỹ năng.")));
    app.querySelector("[data-respec]").onclick = () => { P.respec(save); persist(); toast("Đã tẩy điểm."); render(); };
  },
  loren() {
    app.querySelector("[data-tab-go]")?.addEventListener("click", () => { tab = "doanhtrai"; render(); });
    app.querySelector("[data-tier]")?.addEventListener("click", () => act(P.tierUp(save), "Binh khí lên bậc!"));
    app.querySelector("[data-forge]")?.addEventListener("click", () => act(P.forge(save), `Đã rèn lên +${save.weapon.forge}.`));
    app.querySelectorAll("[data-smelt]").forEach((b) => (b.onclick = () => act(P.smelt(save, Number(b.dataset.smelt)), `Đúc được ${b.dataset.smelt} Tinh thiết.`)));
    app.querySelectorAll("[data-khac]").forEach((s) => (s.onchange = () => { if (!s.value) { render(); return; } act(P.setKhac(save, Number(s.dataset.khac), s.value), "Đã khắc."); }));
  },
  luyenbinh() {
    app.querySelector("[data-tab-go]")?.addEventListener("click", () => { tab = "doanhtrai"; render(); });
    app.querySelectorAll("[data-legion]").forEach((b) => (b.onclick = () => act(P.upLegion(save, b.dataset.legion), "Luyện xong.")));
  },
  doanhtrai() { app.querySelector("[data-camp]")?.addEventListener("click", () => act(P.upCamp(save), `Doanh trại lên cấp ${save.camp}.`)); },
  hoso() {
    app.querySelector("[data-export]").onclick = () => exportSave(save);
    app.querySelector("[data-import]").onchange = async (e) => { const f = e.target.files[0]; if (!f) return; try { save = await importSave(f); syncLegacy(save); persist(); toast("Đã nhập bản lưu."); render(); } catch (_) { toast("File không đọc được.", true); } };
    app.querySelector("[data-reset]").onclick = () => { if (confirm("Xóa toàn bộ tiến độ? Không hoàn tác được.")) { save = resetSave(); pick = { R: 1, difficulty: "quansi" }; persist(); render(); } };
  },
};

// ---- vào trận, kết quả ------------------------------------------------------------------------
// Luồng một Chương (22.2) ở bản VS: comic mở chương (lần đầu) → trận (khung chèn giữa trận) → cảnh kết ≤ 10 s →
// xếp hạng → comic kết chương (lần thắng đầu) → thẻ Sử quán → Quiz chương (không bắt buộc) → Doanh trại.
// B15 bản VS miễn Quyết sách (canon quyetSach.mien = ['VS']).
async function startBattle() {
  const ch = chapterState(save, CH);
  ch.opened = true; unlockCards(save, CH, ["chapterOpen"]); persist();   // bỏ qua comic vẫn mở thẻ; mở trùng thì không làm gì
  if (!ch.openSeen && STORY) { music.play("hub"); await playComic("open"); }
  const met = unlockCards(save, CH, ["battleStart"]); persist();
  const note = HISTORY_NOTES[Math.floor(Math.random() * HISTORY_NOTES.length)];
  app.innerHTML = `<div class="loading"><h2>Bến Hàm Tử · 1285</h2><p><span class="label ${note.label === "Chính sử" ? "cs" : "hc"}">${note.label}</span> ${esc(note.text)}</p><div class="spin"></div><p class="small">Bấm vào màn hình để khóa chuột và điều khiển camera. Esc để tạm dừng.</p></div>`;
  await new Promise((r) => setTimeout(r, 60));
  const { runBattle } = await import("./battle/battle.js");
  const stage = document.createElement("div"); stage.className = "stage"; document.body.appendChild(stage);
  app.style.display = "none";
  let res;
  try {
    // khung chèn giữa trận (D2 khi thuyền quân Triệu Trung đầu tiên cập bến) chỉ tự phát lần đầu
    const story = STORY && !ch.insertSeen ? {
      comic: COMIC_B15, settings: save.settings, onSettings: persist,
      onSeen: (s) => { markSeen(save, CH, s); persist(); },
      onDone: () => { ch.insertSeen = true; persist(); },
    } : null;
    res = await runBattle({ container: stage, save, R: pick.R, difficulty: pick.difficulty, mode: save.settings.mode || "nhanh", music, story, onSettings: () => persist() });
  } catch (err) {
    console.error(err);
    res = null;
    toast("Lỗi khi chạy trận: " + err.message, true);
  }
  // gỡ cả cây DOM của trận: canvas (còn bị gl giữ nếu đệm nào sót listener) không còn dẫn tới lớp phủ, nút cảm
  // ứng mà closure của chúng giữ ctx → trận cũ thu hồi được
  stage.remove(); stage.replaceChildren(); app.style.display = "";
  if (!res?.won) music.play("hub");
  if (!res) { render(); return; }
  afterBattle(res, met);
}

// Sau trận: mở thẻ Sử quán theo kết quả, đánh dấu Chương xong (lần thắng đầu), rồi màn kết quả.
function afterBattle(res, met = []) {
  const ch = chapterState(save, CH);
  if (res.won) completeChapter(save, CH);
  const firstClear = res.won && !ch.closeSeen;     // lần thắng đầu, hoặc thắng rồi mà comic kết chương chưa đọc
  const cards = [...met, ...unlockCards(save, CH, battleUnlockKeys(res))];
  persist();
  showResults(res, { cards, firstClear });
}

// Kết chương sau lần thắng đầu: comic kết → thẻ Sử quán vừa mở → mời Quiz → Doanh trại.
async function endChapter(cards) {
  if (STORY) await playComic("close");
  const all = [...new Set(cards)].map((id) => CARD_BY_ID[id]);
  app.innerHTML = `<div class="results win"><h1>Sử quán mở thẻ</h1>
    <p class="small">Thẻ sử liệu của Chương Hàm Tử, đọc ở thẻ Sử quán của Doanh trại.</p>
    <div class="unlocked">${all.map((c) => `<button class="sq-card new" data-card="${c.id}"><b>${esc(c.title)}</b><small><span class="label ${LCLS[c.label]}">${c.label}</span>${CARD_GROUPS.find((g) => g.id === c.group).name}</small></button>`).join("") || `<p class="small">Không có thẻ mới.</p>`}</div>
    <div class="card"><h3>Sử quan xin hỏi tướng quân đôi câu</h3>
      <p>Ba, bốn câu về điều vừa gặp trong comic và trong trận, chừng một, hai phút. Không tính điểm, không trừ gì; làm xong lượt đầu mở thêm một thẻ "Chuyện bên lề".</p>
      <div class="row center"><button class="primary" data-q>Trả lời</button><button data-later>Để sau</button></div></div></div>`;
  app.querySelectorAll("[data-card]").forEach((b) => (b.onclick = () => showCard(b.dataset.card, () => {})));
  app.querySelector("[data-q]").onclick = async () => { await startQuiz(); tab = "suquan"; render(); };
  app.querySelector("[data-later]").onclick = () => { tab = "xuattran"; render(); };
}

const EVENT_WORD = { wait: "chưa xảy ra", run: "còn dang dở khi trận kết thúc", skip: "bỏ qua (tướng đã rút)", win: "giữ được", lose: "thất bại" };

async function startArena() {
  const week = isoWeekKey();
  const opts = { ...arenaPick, week, seed: arenaPick.mode === "seedtuan" ? seedFromKey(week) : arenaPick.seed };
  app.innerHTML = `<div class="loading"><h2>Võ trường</h2><p>${ARENA_MODES[opts.mode].text}</p><div class="spin"></div></div>`;
  await new Promise((r) => setTimeout(r, 60));
  const { runArena } = await import("./battle/arena.js");
  const stage = document.createElement("div"); stage.className = "stage"; document.body.appendChild(stage);
  app.style.display = "none";
  let res = null;
  try { res = await runArena({ container: stage, save, R: pick.R, difficulty: pick.difficulty, music, opts, onSettings: () => persist() }); }
  catch (err) { console.error(err); toast("Lỗi Võ trường: " + err.message, true); }
  stage.remove(); stage.replaceChildren(); app.style.display = ""; music.play("hub");   // như startBattle
  if (!res) { render(); return; }
  const rw = arenaRewards(save, res);
  applyArena(save, res, rw); const lv = P.addExp(save, rw.exp); persist();
  const medal = res.medal ? MEDALS.find((m) => m.id === res.medal) : null;
  const line = res.mode === "duako" ? `${res.ko} KO trong 180 s` : res.cleared ? `Hạ hết 5 đợt trong ${fmtT(res.clearSec)}` : esc(res.why || "");
  app.innerHTML = `<div class="results ${medal ? "win" : "lose"}">
    <div class="rank-seal medal-${res.medal || "none"}">${medal ? medal.name : "–"}</div>
    <h1>Võ trường · ${ARENA_MODES[res.mode].name}</h1><p>${line}${res.sync ? " · Đồng bộ cấp" : ""}</p>
    <div class="card"><table class="stat">
      ${rw.newMedals.length ? `<tr><td>Huy chương mới</td><td>${rw.newMedals.map((m) => MEDALS.find((x) => x.id === m).name).join(", ")}</td></tr>` : ""}
      <tr><td>Tinh thiết</td><td>+${rw.tt}</td></tr><tr><td>EXP</td><td>+${n(rw.exp)}${lv ? ` · lên cấp ${save.hero.level}` : ""}</td></tr><tr><td>Tiền</td><td>+${n(rw.tien)}</td></tr>
      ${rw.drops.map((d) => `<tr><td>Binh khí</td><td><b>${WEAPON_NAMES[d.tier]}</b> · ${esc(d.why)}</td></tr>`).join("")}
    </table></div>
    <div class="row center"><button class="primary" data-back>Về Doanh trại</button><button data-again>Chơi lại</button></div></div>`;
  app.querySelector("[data-back]").onclick = () => { tab = "votruong"; render(); };
  app.querySelector("[data-again]").onclick = () => startArena();
}

function showResults(res, { cards = [], firstClear = false } = {}) {
  const score = res.won ? P.scoreBattle(res) : { diem: 0, rank: "-", rankMult: 0, parts: {} };
  const full = { ...res, ...score, rank: score.rank, rankMult: score.rankMult, diem: score.diem, at: Date.now() };
  const lvBefore = save.hero.level;
  const rw = P.computeRewards(save, full);
  const applied = P.applyRewards(save, full, rw);
  persist();
  const parts = score.parts;
  const pct = (v) => `${Math.round((v || 0) * 100)}%`;
  const hkRows = Object.entries(res.hkLog || {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v > 0 ? "+" : ""}${Math.round(v)}</td></tr>`).join("");
  app.innerHTML = `
  <div class="results ${res.won ? "win" : "lose"}">
    <div class="rank-seal r${score.rank}">${res.won ? score.rank : "✕"}</div>
    <h1>${res.won ? "Thắng trận Hàm Tử" : "Thua trận"}</h1><p>${esc(res.why)}</p>
    ${res.won ? `<div class="card"><h3>Điểm ${score.diem} / 100</h3><table class="stat">
      <tr><td>Nhiệm vụ (35)</td><td>${pct(parts.M)} · chính ${res.mainDone}/4, phụ ${res.sideDone}/2</td></tr>
      <tr><td>Thời gian (15)</td><td>${pct(parts.T)} · ${Math.floor(res.timeSec / 60)}:${String(Math.floor(res.timeSec % 60)).padStart(2, "0")} (par ${MODES[res.mode].par / 60}:00)</td></tr>
      <tr><td>Quân ta còn (20)</td><td>${pct(parts.Q)}</td></tr><tr><td>Cứ Điểm (20)</td><td>${pct(parts.C)}</td></tr>
      <tr><td>Kế Sách (10)</td><td>${pct(parts.K)} · ${(res.keSachList || []).map((k) => `${k.name}: ${k.word.toLowerCase()}`).join(", ")}</td></tr>
      <tr><td>KO</td><td>${res.ko} (par ${MODES[res.mode].koPar})</td></tr></table></div>` : ""}
    <div class="grid2">
      <div class="card"><h3>Phần thưởng</h3><table class="stat">
        <tr><td>EXP</td><td>+${n(rw.exp)}${applied.levelsGained ? ` · <b>lên cấp ${save.hero.level}</b> (từ ${lvBefore})` : ""}</td></tr>
        <tr><td>Tiền</td><td>+${n(rw.tien)}${res.chestCoins ? ` (gồm ${n(res.chestCoins)} từ rương)` : ""}</td></tr>
        <tr><td>Tinh thiết</td><td>+${n(rw.tt)}</td></tr><tr><td>Quân công</td><td>+${n(rw.qc)}</td></tr>
        ${rw.drops.map((d) => `<tr><td>Binh khí</td><td><b>${WEAPON_NAMES[d.tier]}</b> · ${esc(d.why)}</td></tr>`).join("")}
        ${rw.skillPoint ? `<tr><td>Điểm kỹ năng</td><td>+1 (lần đầu hạng S ở R ${res.R})</td></tr>` : ""}
        ${rw.unlockR ? `<tr><td>Mở</td><td>Cấp trận R ${rw.unlockR}</td></tr>` : ""}
      </table></div>
      <div class="card"><h3>Quân ta và Hào Khí</h3><table class="stat">
        <tr><td>Hào Khí gốc</td><td>${Math.round(res.hkRaw)} · nguồn tùy chọn ${res.hkRaw ? Math.round((res.hkOptional / res.hkRaw) * 100) : 0}%</td></tr>
        <tr><td>Tổng Phản Công</td><td>${res.tpcCount} lần</td></tr><tr><td>Mệnh Lệnh</td><td>${res.orders}</td></tr>
        <tr><td>Kế Sách thành công</td><td>${res.keSachOk} / ${(res.keSachList || []).length}</td></tr>
        <tr><td>Sĩ Khí TB</td><td>${Math.round(res.avgSK)}</td></tr>
        ${Object.entries(res.events || {}).map(([k, v]) => `<tr><td>${k === "counterA1" ? "Cứ Điểm bị phản công" : "Tướng ta bị vây"}</td><td>${esc(EVENT_WORD[v] || v)}</td></tr>`).join("")}
      </table><details><summary>Hào Khí theo nguồn</summary><table class="stat">${hkRows}</table></details></div>
    </div>
    ${cards.length ? `<div class="card"><h3>Sử quán mở thẻ</h3><div class="unlocked" style="justify-content:flex-start">${cards.map((id) => CARD_BY_ID[id]).map((c) => `<div class="sq-card new"><b>${esc(c.title)}</b><small><span class="label ${LCLS[c.label]}">${c.label}</span>${CARD_GROUPS.find((g) => g.id === c.group).name}</small></div>`).join("")}</div></div>` : ""}
    <div class="row center">${firstClear && STORY ? `<button class="primary" data-end>Tiếp: Kết chương ›</button>` : `<button class="primary" data-back>Về Doanh trại</button>`}
      <button data-again>Đánh lại</button><button data-sq>Sử quán</button></div>
  </div>`;
  const nextR = () => { pick.R = Math.max(...save.ladder.unlocked.filter((r) => r <= Math.max(pick.R, rw.unlockR || 0))); };
  app.querySelector("[data-back]")?.addEventListener("click", () => { tab = "xuattran"; nextR(); render(); });
  app.querySelector("[data-end]")?.addEventListener("click", () => { nextR(); endChapter(cards); });
  app.querySelector("[data-sq]").onclick = () => { tab = "suquan"; nextR(); render(); };
  app.querySelector("[data-again]").onclick = () => startBattle();
}

render();
if (location.search.includes("debug")) {
  import("./debug.js");
  // kịch bản kiểm thử màn Chương (comic, kết quả, kết chương, Quiz) không cần đánh hết trận
  window.__main = { afterBattle, showResults, endChapter, startQuiz, playComic, render, get save() { return save; }, set tab(v) { tab = v; } };
}
