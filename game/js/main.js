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
import { touchUI } from "./data/controls.js";
import { ICON } from "./data/moves-info.js";
import { COMIC_B15 } from "./data/comic-b15.js";
import { CARDS, CARD_GROUPS, CARD_BY_ID, QUIZ_B15 } from "./data/suquan-b15.js";
import { chapterState, markSeen, unlockCards, battleUnlockKeys, pickQuiz, answerQuiz, completeChapter, syncLegacy, registerCards } from "./meta/chapter.js";
import { readComic } from "./ui/comic.js";
import { runQuiz } from "./ui/quiz.js";
import { BATTLES, BATTLE_ORDER, loadBattleDef, loadChapterMeta } from "./data/battles.js";
import { HEROES } from "./data/heroes.js";
import { exitLine } from "./data/tutorial-steps.js";
import { guongDayRow } from "./data/glossary.js";
import { NAV, SUBTABS, groupOf, navBadge } from "./ui/layout.js";
import { installNoZoom } from "./ui/nozoom.js";
import { RANKS as CAREER_RANKS, rankOf, nextRank, RANK_PERKS, PICKS, GEAR, gearCost, QUE, suggestName, MISSION_MULT } from "./data/career.js";
import { newCareer, soldierStats, soldierDef, recordBattle, buyGear, retire, WEAPONS, careerGuards, recruitGuard, editGuard, dismissGuard } from "./meta/career.js";
import { GUARD_CLASSES, GUARD_NAME_MAX, guardSlots, guardStats } from "./data/guards.js";
import { MISSIONS, SITES, missionBoard } from "./data/skirmish.js";
import { GFX_LEVELS, isGfx } from "./core/gfx.js";

// ?debug (bot, kịch bản kiểm thử) bỏ comic, Hiến kế và khung chèn giữa trận; thêm &story để vẫn phát
const DEBUG = /[?&]debug\b/.test(location.search);
const STORY = !DEBUG || /[?&]story\b/.test(location.search);
const CH = "B15";
// Chỉ khi ?debug: &battle=B20 chọn sẵn trận (nút VÀO TRẬN / __start vào trận đó), &hero=H31 thay tướng (kể cả ở B15)
const QP = new URLSearchParams(location.search);
const DEBUG_BATTLE = DEBUG && BATTLES[QP.get("battle")] ? QP.get("battle") : null;
const DEBUG_HERO = DEBUG && HEROES[QP.get("hero")] ? QP.get("hero") : null;
// ?debug&rigmodel=meshy: trả năm tướng (H35, H31, H33, H40, Toa Đô) về mô hình Meshy cũ (models.js useMeshy) để so với Hunyuan3D mặc định; ?debug&rigmodel=<mã>: mô hình
// đã nướng khác (assets/models/char/<mã>.hkm) cho thân của H35
const DEBUG_RIGMODEL = DEBUG ? QP.get("rigmodel") : null;

const app = document.getElementById("app");
let save = loadSave();
if (syncLegacy(save)) writeSave(save);
save.battles ||= {};                               // trận ngoài thang R (B20): { best, cleared } — progress.js migrate cũng thêm
for (const id of BATTLE_ORDER) if (!BATTLES[id].ladder) save.battles[id] ||= { best: null, cleared: false };
let tab = "xuattran";
let onTitle = false;                                      // đang ở màn chào (titleScreen); render() đặt lại false
const freshPick = () => ({ R: Math.max(...save.ladder.unlocked), difficulty: save.settings.difficulty, battle: DEBUG_BATTLE || "B15", hero: {} });
let pick = freshPick();

// ---- nội dung Chương (comic, thẻ, Quiz): B15 nạp sẵn, Chương khác nạp lười (data/battles.js) ----------------------
const METAS = { B15: { id: "B15", comic: COMIC_B15, cards: CARDS, cardById: CARD_BY_ID, quiz: QUIZ_B15, groups: CARD_GROUPS } };
const metaOf = (ch) => METAS[ch] || null;
async function ensureMeta(ch) {
  if (!METAS[ch]) { const m = await loadChapterMeta(ch); registerCards(ch, m.cards); METAS[ch] = m; }
  return METAS[ch];
}
const cardOf = (id) => { for (const k in METAS) { const c = METAS[k].cardById[id]; if (c) return c; } return null; };
const groupName = (c) => (CARD_GROUPS.find((g) => g.id === c.group) || { name: c.group }).name;
const battleOfChapter = (ch) => BATTLE_ORDER.map((id) => BATTLES[id]).find((B) => B.chapter === ch) || BATTLES.B15;
// tướng ra trận của một trận: ?debug&hero= trước, rồi tướng đã chọn trên thẻ, rồi tướng đầu tiên chơi được
const heroFor = (B) => DEBUG_HERO || (B.playable.includes(pick.hero[B.id]) ? pick.hero[B.id] : B.playable[0]);
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
// Đợt 13: thanh 5 mục (ui/layout.js NAV) — dưới đáy trên điện thoại dọc, cột trái trên điện thoại ngang, hàng trên màn rộng
// (css/hub.css). Mục Quân doanh gom 6 thẻ cũ thành hàng mục con; `tab` vẫn là thẻ lá như trước (lockedCard, kết quả… đặt thẳng).
// Phần đầu là một dải mỏng: tên game, tướng + EXP, ví, nút Cài đặt (các tùy chọn "Hiển thị" cũ của Xuất trận).
const SVG = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const NAV_ICON = {
  xuattran: SVG(`<path d="M4.5 4.5l11 11M19.5 4.5l-11 11"/><path d="M14 17.5l3.5-3.5M6.5 14l3.5 3.5M15.5 15.5l3 3M8.5 15.5l-3 3"/>`),
  tudo: SVG(`<path d="M3 11.5h18L12 3.5z"/><path d="M8 11.5v1.5a4 4 0 0 0 8 0v-1.5"/><path d="M7 21c.6-2.6 2.6-4 5-4s4.4 1.4 5 4"/>`),
  suquan: SVG(`<path d="M7 4h10.5A2.5 2.5 0 0 1 20 6.5V17a3 3 0 0 1-3 3H7"/><path d="M7 4a2.5 2.5 0 0 0-2.5 2.5V8H9.5V6.5A2.5 2.5 0 0 0 7 4z"/><path d="M9.5 8v10a2 2 0 0 1-2.5 2"/><path d="M12.5 9h4.5M12.5 12.5h4.5M12.5 16h3"/>`),
  quandoanh: SVG(`<path d="M2.5 20.5L12 5l9.5 15.5z"/><path d="M9 20.5l3-6 3 6"/><path d="M12 5V2.5l3.5 1.2L12 5"/>`),
  hoso: SVG(`<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8.5 8h7M8.5 12h7M8.5 16h4"/>`),
};
const GEAR_ICON = SVG(`<circle cx="12" cy="12" r="3"/><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M5.6 18.4l1.6-1.6M16.8 7.2l1.6-1.6"/><circle cx="12" cy="12" r="6.6"/>`);
// Đợt 16: ví trên dải đầu chỉ còn biểu tượng + số (tên ở title / aria-label): đồng tiền lỗ vuông, thỏi thép, huy chương
const PURSE_ICON = {
  tien: SVG(`<circle cx="12" cy="12" r="8.5"/><rect x="9.6" y="9.6" width="4.8" height="4.8"/>`),
  tt: SVG(`<path d="M3.5 17h17l-3-7.5h-11z"/><path d="M7.5 9.5L9 6h6l1.5 3.5"/>`),
  qc: SVG(`<circle cx="12" cy="15" r="5.5"/><path d="M8.5 3l3.5 6.5L15.5 3"/><path d="M12 12.4v5.2M9.4 15h5.2"/>`),
};
const lastSub = { quandoanh: "huanluyen" };          // mục con Quân doanh mở gần nhất
// Dải đầu kiểu game điện thoại (đợt 16): chân dung tròn + số cấp, vòng EXP quanh chân dung (--xp, %), tên + thanh EXP (ẩn khi
// màn hẹp), ví gọn, nút Cài đặt. Ở Tự do: người lính (vòng = danh tiếng tới bậc kế).
function hubHead(group) {
  const h = save.hero, w = save.wallet;
  const expPct = h.level >= LEVEL_CAP ? 100 : (h.exp / EXP_NEXT(h.level)) * 100;
  const chip = (k, v, name) => `<span class="chip ${k}" title="${name}" aria-label="${name}: ${n(v)}">${PURSE_ICON[k]}<b>${n(v)}</b></span>`;
  const who = group === "tudo" && save.career ? tdHeroChip(save.career)
    : `<div class="pf" title="Trần Quốc Toản · Cấp ${h.level}${h.level >= LEVEL_CAP ? " (trần R1)" : ""} · Doanh trại cấp ${save.camp} · ${h.level >= LEVEL_CAP ? "đã đạt trần" : `${n(h.exp)} / ${n(EXP_NEXT(h.level))} EXP`}">
        <div class="pf-ava h35" style="--xp:${expPct.toFixed(1)}"><em>${h.level}</em></div>
        <div class="pf-txt"><b>Trần Quốc Toản</b><div class="exp"><div style="width:${expPct}%"></div></div></div></div>
      <div class="purse">${chip("tien", w.tien, "Tiền")}${chip("tt", w.tt, "Tinh thiết")}${chip("qc", w.qc, "Quân công")}</div>`;
  return `<header class="hub-head">${who}<button class="gear" data-settings title="Cài đặt" aria-label="Cài đặt">${GEAR_ICON}</button></header>`;
}
function render() {
  onTitle = false;
  const group = groupOf(tab);
  if (group === "quandoanh") lastSub.quandoanh = tab;
  const info = { unread: unreadCards().length, points: P.freePoints(save), tutorialNew: !save.tutorial?.done, tudo: tudoBadge() };
  const subBadge = (k) => (k === "truongsoai" && info.points > 0 ? String(info.points) : k === "huanluyen" && info.tutorialNew ? "mới" : "");
  const QD = NAV.find((g) => g.id === "quandoanh");
  app.innerHTML = `
  <div class="hub g-${group}">
    ${hubHead(group)}
    <nav class="navbar" aria-label="Mục chính">${NAV.map((g) => { const b = navBadge(g.id, info);
      return `<button data-nav="${g.id}" class="${group === g.id ? "on" : ""}"${group === g.id ? ` aria-current="page"` : ""}><i class="nav-ic">${NAV_ICON[g.id]}</i><span>${g.name}</span>${b ? `<em>${b}</em>` : ""}</button>`; }).join("")}</nav>
    ${group === "quandoanh" ? `<nav class="subtabs" aria-label="Quân doanh">${QD.tabs.map((k) => `<button data-tab="${k}" class="${tab === k ? "on" : ""}">${SUBTABS[k]}${subBadge(k) ? ` <em>${subBadge(k)}</em>` : ""}</button>`).join("")}</nav>` : ""}
    <main class="hub-body">${{ xuattran, tudo, huanluyen, suquan, votruong, truongsoai, loren, luyenbinh, doanhtrai, hoso }[tab]()}</main>
  </div>`;
  app.querySelectorAll("[data-nav]").forEach((b) => (b.onclick = () => {
    const g = NAV.find((x) => x.id === b.dataset.nav);
    tab = g.id === "quandoanh" ? lastSub.quandoanh : g.tabs[0]; render(); window.scrollTo(0, 0);
  }));
  app.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => { tab = b.dataset.tab; render(); }));
  app.querySelector("[data-settings]").onclick = openSettings;
  bind[tab]?.();
}

// Cài đặt (nút ⚙ ở dải đầu): các tùy chọn "Hiển thị" trước đây nằm ở Xuất trận, thêm âm lượng, Đồ hoạ (đợt 19c, core/gfx.js). Bảng
// trượt từ đáy trên điện thoại, hộp giữa màn trên màn rộng (css/hub.css). Đổi là lưu ngay (Đồ hoạ theo từ trận sau).
function openSettings() {
  const s = save.settings;
  const opt = (v, cur, l) => `<option value="${v}" ${v === cur ? "selected" : ""}>${l}</option>`;
  const d = document.createElement("div"); d.className = "sheet-wrap";
  d.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="Cài đặt">
    <div class="sheet-head"><h3>Cài đặt</h3><button data-close aria-label="Đóng">✕</button></div>
    <label class="field">Đồ hoạ <select data-set="graphics">${GFX_LEVELS.map((l) => opt(l.id, isGfx(s.graphics) ? s.graphics : "auto", l.name)).join("")}</select></label>
    <label class="field">Số lính hiển thị <select data-set="troops">${TROOP_LEVELS.map((t) => opt(t.id, s.troops, `${t.name} · ${t.N}`)).join("")}</select></label>
    <label class="field">Điều khiển cảm ứng <select data-set="touch">${[["auto", "Tự nhận"], ["on", "Bật"], ["off", "Tắt"]].map(([v, l]) => opt(v, s.touch, l)).join("")}</select></label>
    <label class="field">Bóng <input type="checkbox" data-set="shadows" ${s.shadows ? "checked" : ""}></label>
    <label class="field">Gợi ý lần đầu giữa trận <input type="checkbox" data-set="hints" ${s.hints !== false ? "checked" : ""}></label>
    <label class="field">Âm lượng nhạc <input type="range" min="0" max="1" step="0.05" value="${s.music ?? 0.5}" data-set="music"></label>
    <label class="field">Âm lượng hiệu ứng <input type="range" min="0" max="1" step="0.05" value="${s.volume ?? 0.8}" data-set="volume"></label>
    <button data-hintreset>Hiện lại gợi ý đã xem</button>
    ${onTitle ? "" : `<button data-totitle>Về màn chào</button>`}
    <p class="small">Đồ hoạ Tự động chọn theo máy và tự hạ độ phân giải khi khung hình chậm. Số lính hiển thị chỉ đổi phần vẽ; mô phỏng cho cùng kết quả ở mọi mức. "Tự nhận": giao diện cảm ứng theo cách bạn bấm gần nhất.</p>
  </div>`;
  document.body.appendChild(d);
  const close = () => { d.remove(); removeEventListener("keydown", onKey); };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  addEventListener("keydown", onKey);
  d.onclick = (e) => { if (e.target === d) close(); };
  d.querySelector("[data-close]").onclick = close;
  d.querySelectorAll("[data-set]").forEach((el) => (el.onchange = () => {
    const k = el.dataset.set, v = el.type === "checkbox" ? el.checked : el.type === "range" ? Number(el.value) : el.value;
    save.settings[k] = v; persist();
    if (k === "music") music.setVolume(v);
  }));
  d.querySelector("[data-hintreset]").onclick = () => { save.hints = {}; persist(); toast("Các gợi ý lần đầu sẽ hiện lại từ trận sau."); };
  d.querySelector("[data-totitle]")?.addEventListener("click", () => { close(); titleScreen(); });
  d.querySelector("[data-close]").focus();
}

// ---- Tự do (đợt 14): binh nghiệp người lính ---------------------------------------------------------
// save.career (meta/career.js): một người lính một lúc, lưu riêng (không chung ví, cấp với Trần Quốc Toản). Chưa có thì trang tạo lính;
// có rồi thì trang binh nghiệp: bậc + thanh danh tiếng, bảng nhiệm vụ (data/skirmish.js missionBoard: 1 · 2 · 2 · 3 · 3 lựa chọn theo
// bậc, đổi sau mỗi trận), quân nhu (nâng binh khí / giáp bằng tiền thưởng, đổi Song đao ↔ Đại đao), thang bậc, sổ trận, giải ngũ.
const tudoBadge = () => (save.career === undefined && !save.veterans?.length ? "mới" : "");
let tdForm = { name: "", que: QUE[0], weapon: "WC03", seed: Date.now() & 0xffffff };
// thẻ Cận vệ (đợt 15c): đang chiêu mộ (mode "new") hoặc sửa (mode "edit", id) một người — null khi không mở biểu mẫu
let gdForm = null;
const fmtSec = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const rankSeal = (i, big = false) => `<span class="rk-seal r${i}${big ? " big" : ""}">${CAREER_RANKS[i].name}</span>`;
// dải đầu khi đang ở mục Tự do: người lính thay cho Trần Quốc Toản, ví là tiền thưởng riêng của lính
function tdHeroChip(c) {
  const i = rankOf(c.rep), nx = nextRank(c.rep);
  return `<div class="pf" title="${esc(c.name)} · ${CAREER_RANKS[i].name} · danh tiếng ${n(c.rep)} · ${nx ? `còn ${n(nx.need)} tới ${nx.name}` : "bậc cao nhất"}">
        <div class="pf-ava td" style="--xp:${nx ? Math.round(nx.pct * 100) : 100}">${NAV_ICON.tudo}</div>
        <div class="pf-txt"><b>${esc(c.name)}</b><span class="pf-sub">${CAREER_RANKS[i].name}</span><div class="exp"><div style="width:${nx ? Math.round(nx.pct * 100) : 100}%"></div></div></div></div>
    <div class="purse"><span class="chip tien" title="Tiền thưởng của người lính" aria-label="Tiền thưởng: ${n(c.tien)}">${PURSE_ICON.tien}<b>${n(c.tien)}</b></span></div>`;
}
function tudo() {
  const c = save.career;
  if (!c) return tudoCreate();
  const i = rankOf(c.rep), nx = nextRank(c.rep), board = missionBoard(c.seed, c.battles, i), W = WEAPONS[c.weapon];
  const missionCard = (s, k) => {
    const M = MISSIONS[s.type], site = SITES[s.siteId];
    return `<article class="card td-mission">
      <header><span class="td-type">${esc(M.name)}</span><span class="small">${esc(site?.name || "")} · ${fmtSec(s.timeLimit)}</span></header>
      <p>${esc(M.goal)}.</p>
      <p class="small">${esc(M.how)}</p>
      <ul class="td-side">${s.side.map((x) => `<li>${esc(x.name)} <em>+30</em></li>`).join("")}</ul>
      <div class="td-foot"><span class="small">Địch ~${s.enemyTotal} lính${s.officers.length ? ` · ${s.officers.length} sĩ quan` : ""} · danh tiếng ~${Math.round(M.base * MISSION_MULT[i])}+</span>
        <button class="primary" data-td-go="${k}">Ra trận</button></div></article>`;
  };
  return `
  <section class="card td-head">
    <div class="td-id">${rankSeal(i, true)}<div><h2>${esc(c.name)}</h2><p class="small">Quê ${esc(c.que)} · ${esc(W.name)} <span class="label hc">Hư cấu</span> · ${c.battles} trận, thắng ${c.wins}</p></div></div>
    <div class="td-rep"><div class="row" style="justify-content:space-between"><b>Danh tiếng ${n(c.rep)}</b><span class="small">${nx ? `còn ${n(nx.need)} tới ${nx.name}` : "Bậc cao nhất"}</span></div>
      <div class="exp td-bar"><div style="width:${nx ? Math.round(nx.pct * 100) : 100}%"></div></div>
      <p class="small">${esc(RANK_PERKS[i])}</p></div>
  </section>
  <h3 class="td-h">${PICKS[i] === 1 ? "Đội trưởng giao nhiệm vụ" : `Chọn 1 trong ${board.length} nhiệm vụ`}</h3>
  <section class="td-board">${board.map(missionCard).join("")}</section>
  ${guardCard(c, i)}
  <section class="grid2">
    <div class="card"><h3>Quân nhu · tiền thưởng ${n(c.tien)}</h3>
      ${["weapon", "armor"].map((k) => { const lv = c.gear[k], cost = lv < GEAR.max ? gearCost(lv + 1) : null;
        return `<div class="field"><span>${GEAR.names[k]} bậc ${lv}/${GEAR.max} <small class="small">${k === "weapon" ? `Công +${Math.round(lv * GEAR.weaponPct * 100)}%` : `Sinh lực, Giáp +${Math.round(lv * GEAR.armorPct * 100)}%`}</small></span>
          ${cost ? `<button data-td-gear="${k}" ${c.tien < cost ? "disabled" : ""}>Nâng · ${n(cost)}</button>` : `<span class="small">Tốt nhất</span>`}</div>`; }).join("")}
      <div class="field"><span>Binh khí</span><div class="row">${Object.values(WEAPONS).map((w) => `<button data-td-weapon="${w.id}" class="${c.weapon === w.id ? "primary" : ""}">${esc(w.name)}</button>`).join("")}</div></div>
      <p class="small">${esc(W.text)} Đổi binh khí không mất gì.</p>
      <p class="small">Chỉ số vào trận: Công ${n(soldierStats(c).cong)} · Sinh lực ${n(soldierStats(c).hp)} · Giáp ${n(soldierStats(c).giap)}.</p>
    </div>
    <div class="card"><h3>Thang bậc</h3><ol class="td-ladder">${CAREER_RANKS.map((r, k) => `<li class="${k === i ? "on" : k < i ? "done" : ""}"><b>${r.name}</b><small>${n(r.rep)}</small><span>${esc(RANK_PERKS[k])}</span></li>`).join("")}</ol></div>
  </section>
  <section class="grid2">
    <div class="card"><h3>Sổ trận</h3><table class="stat">${c.log.slice(0, 6).map((l) => `<tr><td>${esc(MISSIONS[l.type]?.name || l.type)}</td><td>${l.won ? "Thắng" : "Thua"} · ${fmtSec(l.timeSec)}</td><td>${l.rep >= 0 ? "+" : ""}${n(l.rep)} danh tiếng</td></tr>`).join("") || `<tr><td>Chưa đánh trận nào.</td></tr>`}</table></div>
    <div class="card"><h3>Giải ngũ</h3><p class="small">Cho người lính này về quê và làm lại một người lính mới. Lính đã giải ngũ được ghi tên ở đây.</p>
      ${(save.veterans || []).slice(0, 5).map((v) => `<p class="small">${esc(v.name)} · ${esc(v.rank)} · ${v.battles} trận</p>`).join("")}
      <button class="danger" data-td-retire>Giải ngũ</button></div>
  </section>`;
}
// ---- Cận vệ (đợt 15c): 4 ô — có người (xem / sửa / cho về), trống (chiêu mộ: tên + lớp), khóa (mở ở bậc nào) ----------------------------------
function guardCard(c, i) {
  const list = careerGuards(c), slots = guardSlots(i), base = { ...soldierStats(c), move: 0 };
  const statLine = (cls) => { const g = guardStats(base, cls), P = GUARD_CLASSES[cls].pct; return `Công ${n(g.cong)} · Sinh lực ${n(g.hp)} · Giáp ${n(g.giap)} <span class="small">(${Math.round(P.cong * 100)}/${Math.round(P.hp * 100)}/${Math.round(P.giap * 100)}% của bạn)</span>`; };
  const form = (title, okLabel) => {
    const C = GUARD_CLASSES[gdForm.cls];
    return `<article class="card gd-card gd-form"><h4>${title}</h4>
      <label class="field">Tên <span class="row"><input type="text" maxlength="${GUARD_NAME_MAX}" data-gd-name value="${esc(gdForm.name)}" placeholder="Để trống: tên gợi ý"><button data-gd-suggest>Gợi ý</button></span></label>
      <div class="gd-classes">${Object.values(GUARD_CLASSES).map((K) => `<button class="td-w ${gdForm.cls === K.id ? "on" : ""}" data-gd-cls="${K.id}"><b>${esc(K.name)}</b><span>${esc(K.text)}</span><small>Chiêu: ${esc(K.skill.name)}</small></button>`).join("")}</div>
      <p class="small"><b>${esc(C.name)}</b>: ${statLine(C.id)}</p>
      <p class="small">Chiêu <b>${esc(C.skill.name)}</b> (hồi ${C.skill.cd} s): ${esc(C.skill.text)}</p>
      <div class="row"><button class="primary" data-gd-save>${okLabel}</button><button data-gd-cancel>Thôi</button></div></article>`;
  };
  const cards = [];
  for (let k = 0; k < 4; k++) {
    const g = list[k];
    if (g && gdForm?.mode === "edit" && gdForm.id === g.id) { cards.push(form(`Sửa · ${esc(g.name)}`, "Lưu")); continue; }
    if (g) {
      const C = GUARD_CLASSES[g.cls] || GUARD_CLASSES.khien;
      cards.push(`<article class="card gd-card"><header><b>${esc(g.name)}</b><span>${esc(C.name)}</span></header>
        <p class="small">${statLine(C.id)}</p><p class="small">Chiêu <b>${esc(C.skill.name)}</b>: ${esc(C.skill.text)}</p>
        <p class="small">${g.battles} trận · hạ ${n(g.ko)} địch</p>
        <div class="row"><button data-gd-edit="${g.id}">Sửa tên, lớp</button><button class="danger" data-gd-dismiss="${g.id}">Cho về</button></div></article>`);
    } else if (k < slots) {
      cards.push(gdForm?.mode === "new" && gdForm.slot === k ? form("Chiêu mộ cận vệ", "Nhận vào đội")
        : `<article class="card gd-card gd-empty"><p>Chỗ trống</p><button class="primary" data-gd-new="${k}">Chiêu mộ</button></article>`);
    } else {
      const at = CAREER_RANKS.findIndex((_, r) => guardSlots(r) > k);
      cards.push(`<article class="card gd-card gd-lock"><p>Mở ở bậc <b>${at >= 0 ? CAREER_RANKS[at].name : "?"}</b></p></article>`);
    }
  }
  return `<h3 class="td-h">Cận vệ · ${list.length}/${slots} <span class="label hc">Hư cấu</span></h3>
  <p class="small td-gd-note">Cận vệ theo bạn vào trận (trừ Đấu tướng). Chỉ số bằng 50–75% chỉ số của bạn tùy lớp, mạnh lên cùng bạn. Ra lệnh bằng vòng Mệnh Lệnh: Xung trận · Giữ chỗ · Theo ta · Tung chiêu. Gục thì đứng cạnh để đỡ dậy; hết trận ai cũng lành.</p>
  <section class="gd-list">${cards.join("")}</section>`;
}
function tudoCreate() {
  const f = tdForm;
  return `
  <section class="card td-create">
    <h2>Nhập ngũ</h2>
    <p>Năm Ất Dậu (1285), quân Nguyên tràn xuống. Bạn là một người lính thường của nhà Trần: lập công qua từng trận giao tranh trên đất Hàm Tử để lên Tinh nhuệ, Đội trưởng, Phó tướng rồi Tướng.</p>
    <p class="small"><span class="label hc">Hư cấu</span> người lính và các trận giao tranh. <span class="label cs">Chính sử</span> quân sĩ thích hai chữ "Sát Thát" lên cánh tay.</p>
    <label class="field">Tên <span class="row"><input type="text" maxlength="32" data-td-name value="${esc(f.name)}" placeholder="${esc(suggestName(f.seed))}"><button data-td-suggest>Gợi ý</button></span></label>
    <label class="field">Quê <select data-td-que>${QUE.map((q) => `<option ${q === f.que ? "selected" : ""}>${esc(q)}</option>`).join("")}</select></label>
    <div class="td-weapons">${Object.values(WEAPONS).map((w) => `<button class="td-w ${f.weapon === w.id ? "on" : ""}" data-td-pickw="${w.id}"><b>${esc(w.name)}</b><span>${esc(w.text)}</span></button>`).join("")}</div>
    <button class="primary go" data-td-create>Nhập ngũ</button>
  </section>
  ${save.veterans?.length ? `<section class="card"><h3>Lính đã giải ngũ</h3>${save.veterans.map((v) => `<p class="small">${esc(v.name)} · quê ${esc(v.que)} · ${esc(v.rank)} · ${v.battles} trận, thắng ${v.wins}</p>`).join("")}</section>` : ""}`;
}
// Cảnh mở đầu (một lần, sau khi nhập ngũ): thích chữ "Sát Thát" — Chính sử (Toàn thư, 1285).
function tudoIntro(c) {
  const d = document.createElement("div"); d.className = "sheet-wrap td-intro";
  d.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="td-tattoo" aria-hidden="true">殺韃</div>
    <h2>Sát Thát</h2>
    <p>Bến đò đầu làng ${esc(c.que)}. Người thợ chấm mực, kim đâm từng nhát lên cánh tay ${esc(c.name)}: hai chữ "Sát Thát" — giết giặc Thát. Cả đội cùng thích, không ai lùi.</p>
    <p class="small"><span class="label cs">Chính sử</span> năm 1285 quân sĩ nhà Trần thích chữ "Sát Thát" lên tay. <span class="label hc">Hư cấu</span> người lính, bến đò, người thợ.</p>
    <p>Đội trưởng gọi tên: trận đầu tiên đang chờ.</p>
    <div class="row center"><button class="primary" data-close>Nhận lệnh</button></div></div>`;
  document.body.appendChild(d);
  d.querySelector("[data-close]").onclick = () => { d.remove(); c.introSeen = true; persist(); };
}
// Mô hình GLB (battle/glb.js) và ảnh fx (battle/fx.js) trong lúc màn tải hiện: chờ mọi thứ trận dùng — tướng người chơi, tướng đồng minh và
// boss của trận (data/battles.js models: ra giữa trận cũng nạp trước, đợt 19c — trước đây tải ngầm khi trận đã chạy nên tướng đồng minh
// trận đầu là hình khối, việc đọc mô hình rơi vào mấy giây đầu trận), lính đám đông, vũ khí, cận vệ, sĩ quan, vật môi trường của đất trận
// (env: hàm trả danh sách mã — data/battles.js env, world.js ARENA_ENV của Võ trường; thiếu thì đất Hàm Tử, world.js WORLD_ENV: thuyền, bến,
// cổng, tháp, cây…). Tối đa 12 s; mạng chậm, lỗi:
// trận vẫn chạy với hình dựng bằng code. Mô hình của trận khác không tải ngầm giữa trận nữa: màn tải của trận đó tự nạp.
// chars: mã tướng / boss (heroes.js, data/battles.js models) hoặc mã mô hình (lính Tự do LINH_*); mã tướng đổi qua RIGS thành mô hình đã nướng (H35 → H35h).
async function loadModels(chars = [], env = null) {
  try {
    const [{ preloadModels }, { preloadFx }, { loadClips }, { RIGS, modelOf, kitFiles }, { WORLD_ENV }, envIds] = await Promise.all([import("./battle/glb.js"), import("./battle/fx.js"), import("./battle/clips.js"), import("./battle/models.js"), import("./battle/world.js"), env ? env() : null]);
    await Promise.race([Promise.all([preloadModels([...chars.map((c) => "char/" + (RIGS[HEROES[c]?.rig || c]?.model || modelOf(c))), ...kitFiles().map((k) => "kit/" + k), "wpn/*", ...(envIds || WORLD_ENV).map((id) => "env/" + id),
      ...["CV_khien", "CV_giao", "CV_cung", "CV_songdao", "CV_daidao", "OFF_tuong", "OFF_photuong", "OFF_doitruong"].map((c) => "char/" + modelOf(c))], 12000), preloadFx(), loadClips()]),
      new Promise((r) => setTimeout(r, 12000))]);
  } catch (e) { console.warn("mô hình", e); }
}
const arenaEnv = () => import("./battle/world.js").then((m) => m.ARENA_ENV);     // mô hình môi trường Võ trường (khán đài, đài chỉ huy…)
// Khung trận (đợt 19c): dựng ẩn sau màn tải; battle.js / arena.js gọi onReady khi đã làm nóng (biên dịch shader, nạp texture — battle/gfx.js)
// thì mới hiện khung trận và ẩn màn tải, nên khung đầu nhìn thấy không khựng vì biên dịch. Lỗi trước lúc đó: nơi gọi gỡ stage, hiện lại app.
function makeStage() {
  const stage = document.createElement("div"); stage.className = "stage"; stage.style.visibility = "hidden"; document.body.appendChild(stage);
  return { stage, onReady: () => { stage.style.visibility = ""; app.style.display = "none"; } };
}

async function startSkirmish(sk) {
  const c = save.career; if (!c) return;
  app.innerHTML = `<div class="loading"><h2>${esc(sk.name)} · ${esc(SITES[sk.siteId]?.name || "")}</h2><p>${esc(sk.goal)}.</p><div class="spin"></div><p class="small">${esc(sk.how)}</p></div>`;
  await new Promise((r) => setTimeout(r, 60));
  const [{ runBattle }, { makeTD }] = await Promise.all([import("./battle/battle.js"), import("./battles/td.js"), loadModels(["LINH_r01", "LINH_r24"])]);
  const { stage, onReady } = makeStage();
  let res = null;
  try {
    res = await runBattle({ container: stage, save, R: sk.R, difficulty: "quansi", mode: "nhanh", music, onSettings: () => persist(), onReady,
      battle: makeTD(sk, c), heroDef: { ...soldierDef(c), ...(sk.type === "dautuong" ? { guards: 0 } : {}) }, stats: soldierStats(c) });     // Đấu tướng: cận vệ ở lại doanh — ẩn nút Lệnh
  } catch (err) { console.error(err); toast("Lỗi khi chạy giao tranh: " + err.message, true); }
  stage.remove(); stage.replaceChildren(); app.style.display = ""; music.play("hub");
  if (!res) { tab = "tudo"; render(); return; }
  showTdResult(res, sk);
}
function showTdResult(res, sk) {
  const before = save.career.rep, rec = recordBattle(save, { ...res, base: sk.base, at: Date.now() }); persist();
  const c = save.career, i = rec.rankAfter, nx = nextRank(c.rep);
  app.innerHTML = `
  <div class="results ${res.won ? "win" : "lose"} td-result">
    <div class="rank-seal">${res.won ? "Thắng" : "Thua"}</div>
    <h1>${esc(sk.name)}</h1><p>${esc(res.why)}</p>
    <div class="grid2">
      <div class="card"><h3>Danh tiếng ${rec.applied.gained >= 0 ? "+" : ""}${n(rec.applied.gained)}</h3><table class="stat">
        ${rec.rep.parts.map((p) => `<tr><td>${esc(p.label)}</td><td>+${n(p.rep)}</td></tr>`).join("") || `<tr><td>Không có</td><td>0</td></tr>`}
        ${rec.applied.penalty ? `<tr><td>Thua trận: trừ 3% danh tiếng tích lũy</td><td class="bad">−${n(rec.applied.penalty)}</td></tr>` : ""}
        ${!res.won ? `<tr><td colspan="2" class="small">Thua chỉ giữ 25% danh tiếng của trận; không bao giờ rớt bậc.</td></tr>` : ""}
        <tr><td>Tiền thưởng</td><td>+${n(rec.pay)}</td></tr></table>
        <div class="exp td-bar"><div style="width:${nx ? Math.round(nx.pct * 100) : 100}%"></div></div>
        <p class="small">Danh tiếng ${n(before)} → ${n(c.rep)} · ${nx ? `còn ${n(nx.need)} tới ${nx.name}` : "bậc cao nhất"}</p></div>
      <div class="card"><h3>Mục phụ ${res.side}/${res.sideList.length}</h3><ul class="rb-list">${res.sideList.map((x) => `<li class="${x.ok ? "ok" : ""}"><i class="rb-tick ${x.ok ? "ok" : "no"}">${x.ok ? "✓" : "–"}</i><b>${esc(x.name)}</b></li>`).join("")}</ul>
        <table class="stat"><tr><td>Thời gian</td><td>${fmtSec(res.timeSec)}</td></tr><tr><td>Hạ địch</td><td>${res.ko}</td></tr>
          ${(res.guards || []).map((g) => `<tr><td>Cận vệ ${esc(g.name)} · ${esc(g.cls)}</td><td>${g.up ? "đứng vững" : "gục"} · hạ ${g.ko}</td></tr>`).join("")}</table></div>
    </div>
    <div class="row center"><button class="primary" data-td-back>Về binh nghiệp</button></div>
  </div>`;
  app.querySelector("[data-td-back]").onclick = () => { tab = "tudo"; render(); window.scrollTo(0, 0); };
  if (rec.promoted) tdPromotion(i);
}
// Màn thăng bậc: dấu son lớn + những gì vừa mở.
function tdPromotion(i) {
  const d = document.createElement("div"); d.className = "sheet-wrap td-promo";
  d.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${rankSeal(i, true)}<h2>Thăng bậc · ${CAREER_RANKS[i].name}</h2>
    <p>${esc(RANK_PERKS[i])}</p>${guardSlots(i) > guardSlots(i - 1) ? `<p class="small">Có thêm một chỗ cận vệ: chiêu mộ ở trang Tự do (đặt tên, chọn lớp).</p>` : ""}<div class="row center"><button class="primary" data-close>Nhận</button></div></div>`;
  document.body.appendChild(d); music.play("victory", { loop: false, then: "hub" });
  d.querySelector("[data-close]").onclick = () => d.remove();
}

// ---- Xuất trận: sảnh chính (đợt 16) -----------------------------------------------------------
// Sảnh kiểu game hành động trên điện thoại: tranh lớn của trận đang chọn (khung comic, css/lobby.css), hàng nút tắt
// (Huấn luyện, Võ trường, comic mở chương), dải thẻ trận bằng tranh, ô "Bày trận" tóm tắt chế độ · độ khó · R và
// nút XUẤT CHINH. Chữ dài trước đây nằm thẳng trên trang (mô tả trận, ghi chú sử liệu, giải thích cấp R, bảng chỉ số) dời
// vào hai bảng trượt: "Sử liệu" (nút i trên thẻ trận — openBattleInfo) và "Bày trận" (openPrep). Logo chỉ ở màn chào (đợt 17).
let lastArt = null;                                           // trận của tranh nền lần vẽ trước: đổi trận thì tranh mờ vào lại
const EMBERS = `<i class="ember"></i>`.repeat(9);
const SLIDERS = SVG(`<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>`);
const LOCK = SVG(`<rect x="5.5" y="10.5" width="13" height="10" rx="1.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>`);
const ratio = (v) => String(v).replace(".", ",");
const bestOf = (B) => (B.ladder ? save.ladder.best[pick.R] : save.battles?.[B.id]?.best) || null;
function xuattran() {
  const B = BATTLES[pick.battle] || BATTLES.B15, heroId = heroFor(B);
  const R = B.fixedR ?? pick.R, diff = DIFFICULTY.find((d) => d.id === pick.difficulty), curMode = modeFor(B);
  const fresh = lastArt !== B.id; lastArt = B.id;
  const tutNew = !save.tutorial?.done, seen = chapterState(save, B.chapter).openSeen && !B.noComic;
  return `<section class="lobby b-${B.id}">
    <div class="lb-art${fresh ? " fresh" : ""}" aria-hidden="true"><i class="lb-img"></i>${EMBERS}</div>
    <nav class="lb-rail" aria-label="Lối tắt">
      <button class="rail-btn${tutNew ? " hot" : ""}" data-rail="tut"><img src="${ICON("n")}" alt=""><span>Huấn luyện</span>${tutNew ? "<em>Mới</em>" : ""}</button>
      <button class="rail-btn" data-rail="votruong"><img src="${ICON("ct")}" alt=""><span>Võ trường</span></button>
      ${seen ? `<button class="rail-btn" data-rail="comic"><img src="${ICON("kesach")}" alt=""><span>Comic</span></button>` : ""}
    </nav>
    <div class="lb-stages" role="radiogroup" aria-label="Chọn trận">${BATTLE_ORDER.map(stageCard).join("")}</div>
    <div class="lb-cta">
      <button class="lb-prep" data-prep aria-label="Bày trận: chế độ, độ khó, cấp trận">${SLIDERS}<span>${MODES[curMode].name}</span><span>${diff.name}</span><span>R ${R}</span></button>
      <button class="lb-go" data-go><span class="gi"><i>${NAV_ICON.xuattran}</i><span><b>Xuất chinh</b><small>${esc(B.name)} · ${esc(HEROES[heroId]?.name || "")}</small></span></span></button>
    </div>
  </section>`;
}

// chế độ chơi của trận: chế độ đang chọn nếu trận có, không thì chế độ đầu tiên của trận (B20 chỉ Trận nhanh)
const modeFor = (B) => (B.modes.includes(save.settings.mode || "nhanh") ? save.settings.mode || "nhanh" : B.modes[0]);
const labelCls = (l) => (l === "Chính sử" ? "cs" : l === "Tương truyền" ? "tt" : "hc");

// Thẻ trận ở sảnh: tranh, ấn mã trận, tên, năm, hạng tốt nhất, nhãn "Thử" cho trận đang dựng; nút i mở bảng Sử liệu.
function stageCard(id) {
  const B = BATTLES[id], on = pick.battle === id, best = bestOf(B);
  return `<div class="st-card s-${id}${on ? " on" : ""}">
    <button class="st-pick" data-bpick="${id}" role="radio" aria-checked="${on}"><i class="st-art"></i><span class="st-seal">${id}</span>
      <span class="st-txt"><b>${esc(B.name)}</b><small>${esc(B.date.split("/").pop())}</small></span>
      ${best ? `<span class="st-rank r${best}" title="Hạng tốt nhất">${best}</span>` : ""}${B.wip ? `<span class="st-tag">Thử</span>` : ""}</button>
    <button class="st-info" data-binfo="${id}" aria-label="Sử liệu · ${esc(B.title)}">i</button>
  </div>`;
}

// Bảng trượt (cùng kiểu Cài đặt, css/hub.css): đáy màn trên điện thoại dọc, hộp giữa màn khi ngang / màn rộng.
// draw(sheet, close, redraw) vẽ nội dung; nút [data-close] tự đóng. Trả hàm đóng.
function openSheet(cls, label, draw) {
  const d = document.createElement("div"); d.className = "sheet-wrap " + cls;
  d.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(label)}"></div>`;
  const sh = d.firstElementChild;
  const close = () => { d.remove(); removeEventListener("keydown", onKey); };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  addEventListener("keydown", onKey);
  d.onclick = (e) => { if (e.target === d) close(); };
  const redraw = () => { const y = sh.scrollTop; draw(sh, close, redraw); sh.scrollTop = y; sh.querySelector("[data-close]")?.addEventListener("click", close); };
  document.body.appendChild(d); redraw(); sh.querySelector("[data-close]")?.focus();
  return close;
}

// Sử liệu của một trận: những gì trước đây in thẳng trên thẻ Xuất trận.
const LEAD = {
  B15: () => `Chiếm bến trên, giữ hai cánh, phá Hàm Tử quan, đánh lui ${BOSS.name}. Hai mặt trận cách nhau 150 m: bạn không thể có mặt ở cả hai, nên hãy dùng Mệnh Lệnh.`,
  B16: () => "Gọi dân binh ở các làng ven sông, đánh úp bến Chương Dương đốt 12 thuyền neo, hộ tống xe húc phá cổng nam kinh thành, đánh lui Thoát Hoan rồi chiếm điện chính. Bản thử: dựng tạm trên đất Hàm Tử.",
  B17: () => "Toa Đô chưa biết Thoát Hoan đã rút, kéo cánh quân dọc đường đê ra biển. Nguyễn Khoái chọn bãi lau đặt phục binh, cùng vua Nhân Tông hạ 3 đồn để làm chậm cánh, đứng xa khi Toa Đô vào bãi rồi phát lệnh phục kích, hạ Toa Đô trên gò; giữ vua an toàn, chặn thuyền tàn quân của Ô Mã Nhi. Bản thử: dựng tạm trên đất Hàm Tử.",
  B20: () => "Dụ hạm đội Nguyên vào khúc sông đã đóng cọc lúc triều lên, giữ chân chúng tới khi nước ròng, rồi lên boong chiến thuyền mắc cạn. Sáu pha theo con nước.",
};
async function openBattleInfo(id) {
  const B = BATTLES[id];
  let notes = id === "B15" ? HISTORY_NOTES : null;
  if (!notes) try { notes = await B.notes(); } catch (e) { console.error(e); notes = []; }
  const st = save.battles?.[id], best = bestOf(B);
  openSheet("binfo", `Sử liệu · ${B.title}`, (sh, close) => {
    const seen = chapterState(save, B.chapter).openSeen;
    const facts = B.ladder ? [`Cấp trận R ${pick.R}`, `${B.modes.length} chế độ`]
      : [`R ${B.fixedR} cố định`, B.ownHero ? "Tướng của bạn" : `Tướng dựng sẵn cấp ${B.preset?.level}`, B.modes.length === 1 ? MODES[B.modes[0]].name : "Mọi chế độ", ...(B.keSach?.[B.modes[0]] ? [`${B.keSach[B.modes[0]]} Kế Sách${B.ownHero ? "" : " Lớn"}`] : [])];
    sh.innerHTML = `
      <div class="bi-art s-${id}"><button data-close aria-label="Đóng">✕</button><span class="st-seal">${id}</span>
        <div><h3>${esc(B.title)}${B.wip ? ` <em class="wiptag">đang dựng — chơi thử</em>` : ""}</h3><p>${esc(B.sub)}</p></div></div>
      ${LEAD[id] ? `<p class="lead">${LEAD[id]()}</p>` : ""}
      <div class="facts">${facts.map((f) => `<span>${esc(f)}</span>`).join("")}${best ? `<span class="best">Hạng tốt nhất <b class="rank r${best}">${best}</b>${!B.ladder && st?.bestTime ? ` · ${fmtSec(st.bestTime)}` : ""}</span>` : ""}</div>
      ${B.wip ? `<p class="small">Bản thử, còn đang dựng: có thể còn thô, thiếu phần.</p>` : ""}
      ${notes.length ? `<h4>Ghi chú sử liệu · ${notes.length}</h4><ul class="notes">${notes.map((x) => `<li><span class="label ${labelCls(x.label)}">${x.label}</span>${esc(x.text)}</li>`).join("")}</ul>` : ""}
      <h4>Comic mở chương</h4>
      ${seen && !B.noComic ? `<div class="row"><button data-bi-comic>Xem lại comic</button><span class="small">Đọc lại mọi lúc ở Sử quán.</span></div>`
        : `<p class="small">${B.ladder ? "Tự phát trước trận đầu tiên (6 khung, chừng 40 giây, bỏ qua được)."
          : B.noComic ? "Chương này chưa có comic, không có Hiến kế (bản thử)."
          : `Trước trận đầu tiên: comic mở chương (${metaOf(B.chapter)?.comic?.open?.length ?? 4} khung), Hiến kế ba thẻ, lệnh Chủ soái quyết — bỏ qua được comic, không bỏ qua được Hiến kế.`}</p>`}`;
    sh.querySelector("[data-bi-comic]")?.addEventListener("click", async () => { close(); await playComic("open", { ch: B.chapter }); render(); });
  });
}

// Bày trận: tướng (trận nhiều tướng), cấp trận R, chế độ, độ khó, chỉ số vào trận. Giải thích nằm sau nút "?" (mở rồi thì
// giữ mở qua các lần vẽ lại của bảng).
const prepWhy = new Set();
function openPrep() {
  openSheet("prep", "Bày trận", (sh, close, redraw) => {
    const B = BATTLES[pick.battle] || BATTLES.B15, heroId = heroFor(B), R = B.fixedR ?? pick.R;
    const st = B.ladder ? P.heroStats(save, pick.R) : P.heroStats(save, R, heroId, B.preset || null);
    const diff = DIFFICULTY.find((d) => d.id === pick.difficulty);
    const modes = Object.values(MODES).filter((m) => B.modes.includes(m.id)), curMode = modeFor(B);
    const q = (k) => `<button class="q${prepWhy.has(k) ? " on" : ""}" data-why="${k}" aria-expanded="${prepWhy.has(k)}" aria-label="Giải thích">?</button>`;
    const why = (k, t) => (prepWhy.has(k) ? `<p class="why-p">${t}</p>` : "");
    const tile = (k, v) => `<div class="tile"><small>${k}</small><b>${v}</b></div>`;
    sh.innerHTML = `
      <div class="sheet-head"><h3>Bày trận · ${esc(B.name)}</h3><button data-close aria-label="Đóng">✕</button></div>
      ${B.heroes.length > 1 ? `<h4>Tướng</h4><div class="seg">${B.heroes.map((h) => { const H = HEROES[h], ok = B.playable.includes(h);
        return `<button data-hero="${h}" class="${ok && heroId === h ? "on" : ""}" ${ok ? "" : "disabled"}><b>${esc(H?.name || h)}</b><small>${ok ? esc(H?.title?.split(" · ")[0] || "") : "sắp có"}</small></button>`; }).join("")}</div>` : ""}
      ${B.ladder ? `<h4>Cấp trận ${q("R")}</h4>${why("R", "Thắng một cấp thì mở cấp kế (+3, như R1: B12 = 1 … B20 = 25). Địch mạnh theo R; tướng được nâng tối thiểu lên cấp R − 2 và binh khí tối thiểu E(R) − 0,10 khi vào trận (12.1, 12.7).")}
        <div class="seg rgrid">${R_LADDER.map((r) => { const open = save.ladder.unlocked.includes(r), best = save.ladder.best[r];
          return `<button data-r="${r}" class="${pick.R === r ? "on" : ""}" ${open ? "" : `disabled aria-label="R ${r} · khóa"`}>R ${r}${best ? `<em class="rank r${best}">${best}</em>` : ""}${open ? "" : `<i class="lk">${LOCK}</i>`}</button>`; }).join("")}</div>`
      : `<h4>Cấp trận · R ${R} cố định ${q("R")}</h4>${why("R", B.ownHero ? `${esc(B.title)}: địch theo R ${R}; tướng là Trần Quốc Toản của bạn (cấp, cây kỹ năng, Lò rèn), nâng tối thiểu lên cấp R − 2 và binh khí E(R) − 0,10 khi vào trận như thang R.` : `${esc(B.title)}: tướng dựng sẵn cấp ${B.preset?.level ?? R}, binh khí E(R), không dùng cây kỹ năng và Lò rèn của Trần Quốc Toản (bản VS).`)}`}
      <h4>Chế độ</h4>
      <div class="seg">${modes.map((m) => `<button data-mode="${m.id}" class="${curMode === m.id ? "on" : ""}"><b>${m.name}</b><small>${Math.round((B.par?.[m.id] ?? m.par) / 60)} phút</small></button>`).join("")}</div>
      <p class="seg-note">${curMode === "nhanh" ? `Hào Khí ×1,3 · thưởng ×0,6 · ${B.keSach?.nhanh ?? 1} Kế Sách` : `Thưởng ×1 · ${B.keSach?.chuan ?? 2} Kế Sách`}</p>
      <h4>Độ khó</h4>
      <div class="seg diff">${DIFFICULTY.map((d) => `<button data-diff="${d.id}" class="${pick.difficulty === d.id ? "on" : ""}"><b>${d.name}</b></button>`).join("")}</div>
      <p class="seg-note">${diff.tokens} lính đánh cùng lúc · thưởng ×${ratio(diff.reward)} · gượng dậy: ${guongDayRow(diff.revive)}</p>
      <h4>${esc(HEROES[heroId]?.name || "")}</h4>
      <div class="tiles">
        ${tile("Cấp", `${st.level}${st.floorLifted ? ` <em class="lift" title="nâng từ cấp ${save.hero.level}">↑</em>` : ""}`)}
        ${tile("Công", n(st.cong))}${tile("Sinh lực", n(st.hp))}${tile("Giáp", n(st.giap))}${tile("Chí mạng", `${Math.round(st.crit * 100)}%`)}
        ${tile("Binh khí", `×${st.weaponMult.toFixed(2).replace(".", ",")}`)}
      </div>
      <p class="seg-note">${B.ladder || B.ownHero ? `Đòn mạnh C1–C4${save.hero.level >= MOVES.C5.unlockLv || st.level >= 5 ? ", C5" : ""}${st.level >= MOVES.C6.unlockLv ? ", C6" : ""}${st.weaponFloor ? " · binh khí: Quân giới cấp phát" : ""}`
        : `${esc(HEROES[heroId].weaponName || "")} <span class="label hc">${HEROES[heroId].weaponLabel || "Hư cấu"}</span> · Khí Lực ${st.kiBars ?? HEROES[heroId].kiLucBars} vạch`}</p>
      <button class="lb-go" data-prep-go><span class="gi"><i>${NAV_ICON.xuattran}</i><span><b>Xuất chinh</b><small>${esc(B.name)} · ${MODES[curMode].name} · ${diff.name}</small></span></span></button>`;
    const upd = (fn) => () => { fn(); persist(); render(); redraw(); };
    sh.querySelectorAll("[data-why]").forEach((b) => (b.onclick = () => { const k = b.dataset.why; if (!prepWhy.delete(k)) prepWhy.add(k); redraw(); }));
    sh.querySelectorAll("[data-hero]").forEach((b) => (b.onclick = upd(() => (pick.hero[B.id] = b.dataset.hero))));
    sh.querySelectorAll("[data-r]").forEach((b) => (b.onclick = upd(() => (pick.R = Number(b.dataset.r)))));
    sh.querySelectorAll("[data-mode]").forEach((b) => (b.onclick = upd(() => (save.settings.mode = b.dataset.mode))));
    sh.querySelectorAll("[data-diff]").forEach((b) => (b.onclick = upd(() => { pick.difficulty = b.dataset.diff; save.settings.difficulty = pick.difficulty; })));
    sh.querySelector("[data-prep-go]").onclick = () => { close(); startBattle(pick.battle); };
  });
}

// ---- Huấn luyện (đợt 7) ------------------------------------------------------------------------
// Màn huấn luyện có bài tập (chạy trên sân Võ trường, không cần Doanh trại cấp 3) và bảng đòn có icon.
let guideDev = null;                                      // null: theo cách bạn bấm gần nhất (touchUI), bấm nút Bàn phím / Cảm ứng / Tay cầm thì ghi đè
const guideDevNow = () => guideDev ?? (touchUI(save.settings) ? 1 : 0);
let guideHero = "H35";                                    // tướng của bảng đòn (đợt 11): Hưng Đạo vương dùng đại kiếm, Hịch Tướng Sĩ, Binh Thư — trước đây thẻ này luôn là bảng của Trần Quốc Toản
function huanluyen() {
  const done = save.tutorial?.done;
  return `<section class="card tutbanner"><img src="${ICON("ult")}" alt=""><div style="flex:1"><h3>Màn huấn luyện ${done ? "· đã xong" : ""}</h3>
      <p>Tập từng thao tác trên sân Võ trường: mỗi bài có mục tiêu, làm được thì sang bài sau. Tướng không gục trong lúc tập.</p>
      <p class="small">Có thể chơi lại bất cứ lúc nào. Không cần Doanh trại cấp 3.</p></div>
      <button class="primary" data-tutgo>${done ? "Tập lại" : "Vào huấn luyện"}</button></section>
    <section class="card"><div class="row" style="justify-content:space-between"><h3>Bảng đòn và điều khiển</h3>
      <div class="row">${["Bàn phím", "Cảm ứng", "Tay cầm"].map((l, i) => `<button data-gdev="${i}" class="${guideDevNow() === i ? "primary" : ""}">${l}</button>`).join("")}</div></div>
      <div class="row" style="margin:2px 0 8px"><span class="small">Tướng</span>${["H35", "H31", "H40"].map((h) => `<button data-ghero="${h}" class="${guideHero === h ? "primary" : ""}">${esc(HEROES[h].name)}</button>`).join("")}</div>
      ${movesGuideHTML({ dev: guideDevNow(), hero: guideHero })}</section>`;
}

async function startTutorial() {
  app.innerHTML = `<div class="loading"><h2>Võ trường · Huấn luyện</h2><p>Trần Quốc Toản luyện song đao trước khi ra bến Hàm Tử.</p><div class="spin"></div><p class="small">Bấm vào màn hình để khóa chuột và điều khiển camera. Esc để tạm dừng.</p></div>`;
  await new Promise((r) => setTimeout(r, 60));
  const [{ runArena }] = await Promise.all([import("./battle/arena.js"), loadModels(["H35"], arenaEnv)]);
  const { stage, onReady } = makeStage();
  let res = null;
  try { res = await runArena({ container: stage, save, R: Math.max(1, Math.min(...save.ladder.unlocked)), difficulty: "danbinh", music, opts: { mode: "huanluyen" }, onSettings: () => persist(), onReady }); }
  catch (err) { console.error(err); toast("Lỗi màn huấn luyện: " + err.message, true); }
  stage.remove(); stage.replaceChildren(); app.style.display = ""; music.play("hub");
  if (res?.done) { save.tutorial = { done: true, at: Date.now() }; persist(); toast("Xong huấn luyện — sẵn sàng ra bến Hàm Tử!"); tab = "xuattran"; }
  else if (res) toast(exitLine(res.progress));       // "ở bài k / 11": cùng cách đếm với bảng trong màn (data/tutorial-steps.js tutorialProgress)
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
// Mỗi Chương trong danh mục một khối: comic đã gặp (mở chương, [Chủ soái quyết], giữa trận, kết chương), Quiz chương,
// thẻ sử liệu. Chương chưa nạp nội dung (nạp lười) thì hiện "đang nạp" rồi tự vẽ lại.
const EMPTY_CH = { opened: false, openSeen: false, closeSeen: false, insertSeen: false, seen: [], cleared: false };
const COMIC_INFO = {
  B15: { open: "Tình thế, Chủ soái quyết", insert: "Áo Tống trên bến", insertLock: "Mở khi thuyền quân Triệu Trung cập bến" },
  B16: { open: "Chưa có (bản thử)", close: "Chưa có (bản thử)" },
  B17: { open: "Chưa có (bản thử)", close: "Chưa có (bản thử)" },
  B20: { open: "Tình thế, hội quân", decree: "Chủ soái quyết", close: "Triều rút, bắt sống Ô Mã Nhi" },
};
function suquan() {
  const s = save.settings;
  return `
  <section class="card"><h3>Sử quán</h3>
    <p class="small">Thư viện thẻ sử liệu, mở miễn phí theo tiến độ. Mỗi thẻ mang đúng một nhãn Chính sử, Tương truyền hoặc Hư cấu kèm nguồn. Bản thử: thẻ và câu hỏi chưa qua cố vấn sử duyệt.</p>
    <p class="small">Danh hiệu: ${TITLES.map((t) => `<span class="lift" style="${t.ok(save) ? "" : "opacity:.45"}" title="${esc(t.how)}">${t.name}</span>`).join(" ")}</p>
  </section>
  ${BATTLE_ORDER.map((id) => chapterBlock(BATTLES[id])).join("")}
  <section class="card"><h3>Cài đặt đọc</h3>
    <label class="field">Cỡ chữ lời dẫn, bóng thoại <input type="range" min="0.8" max="1.5" step="0.1" value="${Number(s.comicText) || 1}" data-rs="comicText"><b>${Math.round((Number(s.comicText) || 1) * 100)}%</b></label>
    <label class="field">Rung và nháy (lia, phóng khung) <input type="checkbox" data-rs="motion" ${s.motion !== false ? "checked" : ""}></label>
    <label class="field">Chế độ đọc <select data-rs="comicMode">${[["auto", "Tự chọn theo màn hình"], ["page", "Nguyên trang"], ["panel", "Từng khung"]].map(([v, l]) => `<option value="${v}" ${(s.comicMode || "auto") === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
  </section>`;
}
function chapterBlock(B) {
  const id = B.chapter, M = metaOf(id);
  const head = `<h3>Chương ${esc(B.name)} · ${esc(B.date)}${B.wip ? ` <em class="wiptag">đang dựng</em>` : ""}</h3>`;
  if (!M) return `<section class="card sq-chapter">${head}<p class="small">Đang nạp comic, thẻ và câu hỏi của Chương…</p></section>`;
  const ch = save.chapters?.[id] || EMPTY_CH, cards = save.cards || {}, read = save.cardsRead || [], C = M.comic, info = COMIC_INFO[id] || {};
  const Q = save.quiz || { answered: {}, review: [] };
  const met = M.quiz.filter((q) => Q.answered[q.id]).length, due = (Q.review || []).filter((r) => M.quiz.some((q) => q.id === r.id)).length;
  const cardBtn = (c) => cards[c.id]
    ? `<button class="sq-card ${read.includes(c.id) ? "" : "new"}" data-card="${c.id}"><b>${esc(c.title)}</b><small><span class="label ${LCLS[c.label]}">${c.label}</span>${read.includes(c.id) ? "" : "Mới mở"}</small></button>`
    : `<div class="sq-card lock"><b>Thẻ chưa mở</b><small>${esc(c.hint)}</small></div>`;
  const btn = (part, ok, title, sub) => (C[part] && !C[part].length
    ? `<button disabled><b>${title}</b><small>Chưa có (bản thử)</small></button>`                  // Chương chưa có comic (B16)
    : `<button data-comic="${part}" data-ch="${id}" ${ok ? "" : "disabled"}><b>${title}</b><small>${sub}</small></button>`);
  const got = M.cards.filter((c) => cards[c.id]).length;
  return `<section class="card sq-chapter">${head}
  <div class="grid2">
    <div><h3>Comic · Quyển VI · Chương ${esc(B.name)}</h3>
      <div class="comic-row">
        ${btn("open", ch.openSeen, "Mở chương", ch.openSeen ? `${C.open.length} khung${info.open ? " · " + info.open : ""}` : "Mở khi vào trận lần đầu")}
        ${C.decree?.length ? btn("decree", ch.decreeSeen, "Chủ soái quyết", ch.decreeSeen ? `${C.decree.length} khung · sau Hiến kế` : "Mở sau Hiến kế lần đầu") : ""}
        ${C.insert?.length ? btn("insert", ch.insertSeen, "Giữa trận", ch.insertSeen ? `${C.insert.length} khung${info.insert ? " · " + info.insert : ""}` : info.insertLock || "Mở giữa trận") : ""}
        ${btn("close", ch.cleared || ch.closeSeen, "Kết chương", ch.cleared || ch.closeSeen ? `${C.close.length} khung${info.close ? " · " + info.close : ""}${ch.closeSeen ? "" : " · chưa đọc"}` : "Mở khi thắng trận")}
      </div>
      ${M.comic.council && ch.council?.picked ? councilLine(M.comic.council, ch.council) : ""}
    </div>
    <div><h3>Quiz chương</h3>
      <p class="small">Sử quan hỏi 3–5 câu về điều tướng quân đã gặp trong comic, trong trận và trong thẻ. Không tính giờ, không trừ gì; chỉ thưởng thẻ và danh hiệu.</p>
      <p>Đã gặp ${met} / ${M.quiz.length} câu của Chương${due ? ` · ${due} câu chờ hỏi lại` : ""}.</p>
      <button class="primary" data-quiz="${id}" ${ch.cleared ? "" : "disabled"}>Hỏi sử quan</button>${ch.cleared ? "" : `<p class="small">Mở sau khi thắng ${esc(B.title.replace(/^Trận/, "trận"))}.</p>`}
    </div>
  </div>
  <h3>Thẻ sử liệu · ${got} / ${M.cards.length}</h3>
    ${M.groups.map((g) => { const cs = M.cards.filter((c) => c.group === g.id); return cs.length ? `<div class="sq-group">${g.name}</div><div class="cards">${cs.map(cardBtn).join("")}</div>` : ""; }).join("")}
  </section>`;
}

// Sử quán: lần Hiến kế gần nhất của Chương (kế đã hiến, có hợp cách người xưa không). Kế Hư cấu ghi nhãn Hư cấu.
function councilLine(council, got) {
  const k = council.cards.find((c) => c.id === got.picked), old = council.cards.find((c) => c.historical);
  if (!k) return "";
  return `<p class="small sq-council"><b>Hiến kế:</b> ${esc(k.text.vi)} <span class="label ${LCLS[k.label]}">${k.label}</span>
    ${got.historical ? "— trùng lựa chọn của người xưa." : `— người xưa chọn: ${esc(old?.text.vi || "")} <span class="label cs">Chính sử</span>`}</p>`;
}

function showCard(id, onClose = render) {
  const c = cardOf(id), ch = chapterState(save, c.chapter), M = metaOf(c.chapter);
  save.cardsRead = [...new Set([...(save.cardsRead || []), id])]; persist();
  const seenPanels = c.panels.filter((p) => ch.seen.includes(p));
  document.activeElement?.blur?.();              // Enter không mở thêm một thẻ chồng lên
  const d = document.createElement("div"); d.className = "sq-detail";
  d.innerHTML = `<div class="card"><p class="small">${groupName(c)} · Chương ${c.chapter}</p>
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
  d.querySelectorAll("[data-panel]").forEach((b) => (b.onclick = () => readComic(M.comic, { ids: [b.dataset.panel], single: true, title: c.title, closeLabel: "Đóng", settings: save.settings, onSettings: persist })));
}

// Phát một phần comic của một Chương (open | decree | insert | close), ghi khung đã xem. Trả về { skipped, seen }.
// comic: bản comic đã điền bóng thoại Hiến kế (applyCouncil) cho phần decree; mặc định comic của Chương (đã nạp).
async function playComic(part, { title, ch: chId = CH, comic = null } = {}) {
  const M = await ensureMeta(chId), C = comic || M.comic, B = battleOfChapter(chId);
  const ids = C[part];
  if (!ids?.length) {                                                        // Chương chưa có comic (B16 bản thử): bỏ qua, nhưng vẫn ghi đã qua
    const ch0 = chapterState(save, chId);                                    // phần đó (không thì lần thắng nào cũng là "thắng lần đầu", kết chương lặp lại)
    if (part === "open") ch0.openSeen = true;
    if (part === "close") ch0.closeSeen = true;
    persist();
    return { skipped: false, seen: [], empty: true };
  }
  const names = { open: "Mở chương", decree: "Chủ soái quyết", insert: "Giữa trận", close: "Kết chương" };
  const r = await readComic(C, {
    ids, title: title || `Quyển VI · Chương ${B.name} · ${names[part]}`, settings: save.settings, onSettings: persist,
    onSeen: (s) => { markSeen(save, chId, s); persist(); },
  });
  const ch = chapterState(save, chId);
  if (part === "open") { ch.openSeen = true; if (r.skipped) ch.openSkips = (ch.openSkips || 0) + 1; }
  if (part === "decree") ch.decreeSeen = true;
  if (part === "close") { ch.closeSeen = true; if (r.skipped) ch.closeSkips = (ch.closeSkips || 0) + 1; }
  persist();
  return r;
}

async function startQuiz(chId = CH) {
  const M = await ensureMeta(chId);
  const items = pickQuiz(save, M.quiz, { chapter: chId, n: 4 });
  if (!items.length) { toast("Sử quan chưa có câu nào để hỏi — hãy đọc comic hoặc mở thêm thẻ."); return; }
  const ch = chapterState(save, chId);
  await runQuiz({
    items, comic: M.comic, settings: save.settings, onSettings: persist,
    onSeen: (s) => { markSeen(save, chId, s); persist(); },
    onAnswer: (it, right) => { answerQuiz(save, it, right); persist(); },
    onFinish: () => {
      ch.quizRounds = (ch.quizRounds || 0) + 1;
      const got = unlockCards(save, chId, ["firstQuiz"]); persist();
      return got.map((id) => cardOf(id));
    },
  });
  render();
}

// Hiến kế (Quyết sách, ui/council.js) khi comic của Chương có khối council: lần đầu có thẻ hướng dẫn. Chơi lại (đã hiến kế
// một lần, hoặc đã thắng Chương): thẻ lịch sử mang dấu "Người xưa chọn" ngay từ đầu, cả hai nhánh có Tình báo sớm (R-spec §5),
// comic bỏ qua — thanh trên hội đồng có nút "Xem comic" (phát phần mở chương, rồi sau Hiến kế phát tiếp "Chủ soái quyết").
// Lần đầu vào Chương thì đọc tiếp phần "Chủ soái quyết" theo kế đã chọn.
// Trả về ctx.quyetSach của trận: { picked, historical, replay, ok } — ok = Tình báo sớm (director B20 → createRiver quyetSachOk).
async function councilFlow(chId, M, first) {
  const { runCouncil, applyCouncil } = await import("./ui/council.js");
  const ch = chapterState(save, chId), B = battleOfChapter(chId);
  const replay = !!(ch.cleared || ch.council?.picked);
  let marks = null;
  try { marks = (await B.marks?.()) || null; } catch (e) { console.error(e); }
  const r = await runCouncil({ council: M.comic.council, comic: M.comic, settings: save.settings, replay, marks,
    tutorial: !save.councilSeen, onSettings: persist, onComic: first ? null : () => playComic("open", { ch: chId }) });
  save.councilSeen = true; ch.council = { picked: r.picked, historical: !!r.historical }; persist();
  if ((first || r.comic) && M.comic.decree?.length) await playComic("decree", { ch: chId, comic: r.picked ? applyCouncil(M.comic, r.picked) : M.comic });
  return { ...ch.council, replay, ok: !!r.historical || replay };
}
// comic đã điền bóng thoại theo kế đã chọn lần trước (đọc lại "Chủ soái quyết" ở Sử quán); chưa chọn thì null
async function decreeComic(chId) {
  const M = await ensureMeta(chId), picked = save.chapters?.[chId]?.council?.picked;
  if (!picked || !M.comic.council) return null;
  const { applyCouncil } = await import("./ui/council.js");
  return applyCouncil(M.comic, picked);
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
      <h3>Nhật ký</h3><table class="stat log">${save.log.map((l) => `<tr><td>${l.battle && !BATTLES[l.battle]?.ladder ? esc(BATTLES[l.battle]?.name || l.battle) : `R ${l.R}`}</td><td>${l.won ? `Thắng · hạng ${l.rank}` : "Thua"}</td><td>+${n(l.exp)} EXP</td><td>+${n(l.tien)} Tiền</td></tr>`).join("") || "<tr><td>Chưa có trận nào.</td></tr>"}</table>
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
  tudo() {
    const c = save.career;
    if (!c) {
      const nameEl = app.querySelector("[data-td-name]");
      nameEl.oninput = () => (tdForm.name = nameEl.value);
      app.querySelector("[data-td-suggest]").onclick = (e) => { e.preventDefault(); tdForm.seed = (Math.imul(tdForm.seed, 1103515245) + 12345) & 0xffffff; tdForm.name = suggestName(tdForm.seed); render(); };
      app.querySelector("[data-td-que]").onchange = (e) => (tdForm.que = e.target.value);
      app.querySelectorAll("[data-td-pickw]").forEach((b) => (b.onclick = () => { tdForm.weapon = b.dataset.tdPickw; render(); }));
      app.querySelector("[data-td-create]").onclick = () => {
        save.career = newCareer({ name: tdForm.name.trim() || nameEl.placeholder, que: tdForm.que, weapon: tdForm.weapon, seed: tdForm.seed });
        persist(); render(); window.scrollTo(0, 0);              // bind.tudo của lần vẽ này mở cảnh "Sát Thát" (introSeen chưa đặt)
      };
      return;
    }
    const board = missionBoard(c.seed, c.battles, rankOf(c.rep));
    app.querySelectorAll("[data-td-go]").forEach((b) => (b.onclick = () => startSkirmish(board[Number(b.dataset.tdGo)])));
    app.querySelectorAll("[data-td-gear]").forEach((b) => (b.onclick = () => act(buyGear(c, b.dataset.tdGear), "Đã nâng quân nhu.")));
    app.querySelectorAll("[data-td-weapon]").forEach((b) => (b.onclick = () => { c.weapon = b.dataset.tdWeapon; persist(); render(); }));
    app.querySelector("[data-td-retire]").onclick = () => { if (confirm(`Cho ${c.name} giải ngũ? Không hoàn tác được.`)) { retire(save); gdForm = null; persist(); render(); } };
    // cận vệ
    app.querySelectorAll("[data-gd-new]").forEach((b) => (b.onclick = () => { gdForm = { mode: "new", slot: Number(b.dataset.gdNew), name: "", cls: "khien", seed: (Date.now() & 0xffffff) }; render(); }));
    app.querySelectorAll("[data-gd-edit]").forEach((b) => (b.onclick = () => { const g = careerGuards(c).find((x) => x.id === Number(b.dataset.gdEdit)); if (g) { gdForm = { mode: "edit", id: g.id, name: g.name, cls: g.cls, seed: g.id * 7919 }; render(); } }));
    app.querySelectorAll("[data-gd-dismiss]").forEach((b) => (b.onclick = () => { const g = careerGuards(c).find((x) => x.id === Number(b.dataset.gdDismiss)); if (g && confirm(`Cho ${g.name} về quê? Số trận, số địch đã hạ của người này mất theo.`)) { gdForm = null; act(dismissGuard(c, g.id), `${g.name} đã về quê.`); } }));
    const gdName = app.querySelector("[data-gd-name]");
    if (gdName) gdName.oninput = () => (gdForm.name = gdName.value);
    app.querySelector("[data-gd-suggest]")?.addEventListener("click", (e) => { e.preventDefault(); gdForm.seed = (Math.imul(gdForm.seed, 1103515245) + 12345) & 0xffffff; gdForm.name = suggestName(gdForm.seed); render(); });
    app.querySelectorAll("[data-gd-cls]").forEach((b) => (b.onclick = () => { gdForm.cls = b.dataset.gdCls; render(); }));
    app.querySelector("[data-gd-cancel]")?.addEventListener("click", () => { gdForm = null; render(); });
    app.querySelector("[data-gd-save]")?.addEventListener("click", () => {
      const F = gdForm; if (!F) return;
      const r = F.mode === "new" ? recruitGuard(c, { name: F.name, cls: F.cls }) : editGuard(c, F.id, { name: F.name, cls: F.cls });
      if (r.ok) gdForm = null;
      act(r, F.mode === "new" ? `${r.guard?.name ?? ""} đã vào đội cận vệ.` : "Đã lưu cận vệ.");
    });
    if (!c.introSeen) tudoIntro(c);
  },
  huanluyen() {
    app.querySelector("[data-tutgo]")?.addEventListener("click", startTutorial);
    app.querySelectorAll("[data-gdev]").forEach((b) => (b.onclick = () => { guideDev = Number(b.dataset.gdev); render(); }));
    app.querySelectorAll("[data-ghero]").forEach((b) => (b.onclick = () => { guideHero = b.dataset.ghero; render(); }));
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
    app.querySelector("[data-go]").onclick = () => startBattle(pick.battle);
    app.querySelector("[data-prep]").onclick = openPrep;
    app.querySelectorAll("[data-bpick]").forEach((b) => (b.onclick = () => { if (pick.battle !== b.dataset.bpick) { pick.battle = b.dataset.bpick; render(); } }));
    app.querySelectorAll("[data-binfo]").forEach((b) => (b.onclick = () => openBattleInfo(b.dataset.binfo)));
    // nút tắt: Huấn luyện (chưa tập thì vào thẳng bài tập, tập rồi thì sang trang Huấn luyện), Võ trường, comic mở chương của trận đang chọn
    app.querySelectorAll("[data-rail]").forEach((b) => (b.onclick = async () => {
      const k = b.dataset.rail;
      if (k === "tut" && !save.tutorial?.done) return startTutorial();
      if (k === "comic") { await playComic("open", { ch: (BATTLES[pick.battle] || BATTLES.B15).chapter }); render(); return; }
      tab = k === "tut" ? "huanluyen" : k; render(); window.scrollTo(0, 0);
    }));
  },
  suquan() {
    app.querySelectorAll("[data-card]").forEach((b) => (b.onclick = () => showCard(b.dataset.card)));
    app.querySelectorAll("[data-comic]").forEach((b) => (b.onclick = async () => {
      const chId = b.dataset.ch || CH;
      await playComic(b.dataset.comic, { ch: chId, comic: b.dataset.comic === "decree" ? await decreeComic(chId) : null }); render();
    }));
    app.querySelectorAll("[data-quiz]").forEach((b) => b.addEventListener("click", () => startQuiz(b.dataset.quiz || CH)));
    // Chương nạp lười: nạp xong thì vẽ lại (chỉ khi vẫn đang ở Sử quán)
    for (const id of BATTLE_ORDER) if (!metaOf(BATTLES[id].chapter)) ensureMeta(BATTLES[id].chapter).then(() => { if (tab === "suquan") render(); }, (e) => console.error(e));
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
    app.querySelector("[data-reset]").onclick = () => { if (confirm("Xóa toàn bộ tiến độ? Không hoàn tác được.")) { save = resetSave(); pick = freshPick(); persist(); render(); } };
  },
};

// ---- vào trận, kết quả ------------------------------------------------------------------------
// Luồng một Chương (22.2) ở bản VS: comic mở chương (lần đầu) → trận (khung chèn giữa trận) → cảnh kết ≤ 10 s →
// xếp hạng → comic kết chương (lần thắng đầu) → thẻ Sử quán → Quiz chương (không bắt buộc) → Doanh trại.
// B15 bản VS miễn Quyết sách (canon quyetSach.mien = ['VS']). Chương có khối council (B20): comic mở chương → Hiến kế →
// "Chủ soái quyết" → trận. battleId: khóa trong data/battles.js (mặc định trận đang chọn ở thẻ Xuất trận).
async function startBattle(battleId = pick.battle) {
  const B = BATTLES[battleId] || BATTLES.B15, chId = B.chapter;
  const M = await ensureMeta(chId);
  const ch = chapterState(save, chId), first = !ch.openSeen;
  ch.opened = true; unlockCards(save, chId, ["chapterOpen"]); persist();   // bỏ qua comic vẫn mở thẻ; mở trùng thì không làm gì
  if (first && STORY) { music.play("hub"); await playComic("open", { ch: chId }); }
  const quyetSach = STORY && M.comic.council ? await councilFlow(chId, M, first) : null;
  const met = unlockCards(save, chId, ["battleStart"]); persist();
  const notes = await B.notes();
  const note = notes[Math.floor(Math.random() * notes.length)];
  app.innerHTML = `<div class="loading ld-art b-${B.id}"><i class="ld-img" aria-hidden="true"></i><h2>${esc(B.loading.title)}</h2><p><span class="label ${note.label === "Chính sử" ? "cs" : note.label === "Tương truyền" && B.id !== "B15" ? "tt" : "hc"}">${note.label}</span> ${esc(note.text)}</p><div class="spin"></div><p class="small">Bấm vào màn hình để khóa chuột và điều khiển camera. Esc để tạm dừng.</p></div>`;
  await new Promise((r) => setTimeout(r, 60));
  if (DEBUG_RIGMODEL) { const M = await import("./battle/models.js"); if (DEBUG_RIGMODEL === "meshy") M.useMeshy(); else M.RIGS.hero.model = DEBUG_RIGMODEL; }
  const [{ runBattle }, def] = await Promise.all([import("./battle/battle.js"), loadBattleDef(B.id), loadModels([heroFor(B), ...(B.models || [])], B.env)]);
  const { stage, onReady } = makeStage();
  let res;
  try {
    // khung chèn giữa trận (B15: D2 khi thuyền quân Triệu Trung đầu tiên cập bến) chỉ tự phát lần đầu
    const story = STORY && !ch.insertSeen && M.comic.insert?.length ? {
      comic: M.comic, settings: save.settings, onSettings: persist,
      onSeen: (s) => { markSeen(save, chId, s); persist(); },
      onDone: () => { ch.insertSeen = true; persist(); },
    } : null;
    res = await runBattle({ container: stage, save, R: B.fixedR ?? pick.R, difficulty: pick.difficulty, mode: modeFor(B), music, story, onSettings: () => persist(),
      battle: def, heroId: heroFor(B), quyetSach, onReady });
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
  if (res.stub) { toast(`${B.title} còn đang dựng — đã về Doanh trại.`); tab = "xuattran"; render(); return; }   // bản giữ chỗ: không chấm, không thưởng
  return afterBattle({ battle: B.id, ...res }, met, { council: quyetSach });
}

// Sau trận: mở thẻ Sử quán theo kết quả, đánh dấu Chương xong (lần thắng đầu), rồi màn kết quả. res.battle: trận nào
// (thiếu thì B15, như kết quả trước đợt 9). Trận có phần kết quả riêng (BATTLES[id].resultUI — B20) nạp module đó trước
// rồi mới vẽ (trả Promise); B15 vẽ ngay như cũ. opts.council: Hiến kế của lần vào trận này (thiếu thì lần gần nhất).
function afterBattle(res, met = [], { council } = {}) {
  const B = BATTLES[res.battle] || BATTLES.B15, chId = B.chapter;
  const ch = chapterState(save, chId);
  if (res.won) completeChapter(save, chId);
  const firstClear = res.won && !ch.closeSeen;     // lần thắng đầu, hoặc thắng rồi mà comic kết chương chưa đọc
  const cards = [...met, ...unlockCards(save, chId, battleUnlockKeys(res))];
  persist();
  if (!B.resultUI) { showResults(res, { cards, firstClear }); return; }
  return B.resultUI().then((ui) => showResults(res, { cards, firstClear, ui, council: council ?? ch.council ?? null }),
    (e) => { console.error(e); showResults(res, { cards, firstClear }); });
}

// Kết chương sau lần thắng đầu: comic kết → thẻ Sử quán vừa mở → mời Quiz → Doanh trại.
async function endChapter(cards, chId = CH) {
  if (STORY) await playComic("close", { ch: chId });
  const B = battleOfChapter(chId);
  const all = [...new Set(cards)].map((id) => cardOf(id)).filter(Boolean);
  app.innerHTML = `<div class="results win"><h1>Sử quán mở thẻ</h1>
    <p class="small">Thẻ sử liệu của Chương ${esc(B.name)}, đọc ở thẻ Sử quán của Doanh trại.</p>
    <div class="unlocked">${all.map((c) => `<button class="sq-card new" data-card="${c.id}"><b>${esc(c.title)}</b><small><span class="label ${LCLS[c.label]}">${c.label}</span>${groupName(c)}</small></button>`).join("") || `<p class="small">Không có thẻ mới.</p>`}</div>
    <div class="card"><h3>Sử quan xin hỏi tướng quân đôi câu</h3>
      <p>Ba, bốn câu về điều vừa gặp trong comic và trong trận, chừng một, hai phút. Không tính điểm, không trừ gì; làm xong lượt đầu mở thêm một thẻ "Chuyện bên lề".</p>
      <div class="row center"><button class="primary" data-q>Trả lời</button><button data-later>Để sau</button></div></div></div>`;
  app.querySelectorAll("[data-card]").forEach((b) => (b.onclick = () => showCard(b.dataset.card, () => {})));
  app.querySelector("[data-q]").onclick = async () => { await startQuiz(chId); tab = "suquan"; render(); };
  app.querySelector("[data-later]").onclick = () => { tab = "xuattran"; render(); };
}

const EVENT_WORD = { wait: "chưa xảy ra", run: "còn dang dở khi trận kết thúc", skip: "bỏ qua (tướng đã rút)", win: "giữ được", lose: "thất bại" };

async function startArena() {
  const week = isoWeekKey();
  const opts = { ...arenaPick, week, seed: arenaPick.mode === "seedtuan" ? seedFromKey(week) : arenaPick.seed };
  app.innerHTML = `<div class="loading"><h2>Võ trường</h2><p>${ARENA_MODES[opts.mode].text}</p><div class="spin"></div></div>`;
  await new Promise((r) => setTimeout(r, 60));
  const [{ runArena }] = await Promise.all([import("./battle/arena.js"), loadModels(["H35"], arenaEnv)]);
  const { stage, onReady } = makeStage();
  let res = null;
  try { res = await runArena({ container: stage, save, R: pick.R, difficulty: pick.difficulty, music, opts, onSettings: () => persist(), onReady }); }
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

// Màn kết quả. Trận trong thang R (B15) như trước đợt 9. Trận ngoài thang (B20, tướng dựng sẵn): thưởng chỉ ví và thống kê
// (meta/progress.js computeFixedRewards / applyFixedRewards — hạng tốt nhất ở save.battles[id]), par riêng của trận, mất
// điểm K khi river.kRank === false; opts.ui (module resultUI của trận) chèn phần riêng (B20: 6 nhiệm vụ, Kế Sách, khúc sông).
function showResults(res, { cards = [], firstClear = false, ui = null, council = null } = {}) {
  const B = BATTLES[res.battle] || BATTLES.B15, RD = B.result;
  const parSec = res.parSec ?? B.par?.[res.mode] ?? MODES[res.mode].par;
  const kLost = res.river?.kRank === false;
  const score = res.won ? P.scoreBattle({ ...res, par: parSec, kLost }) : { diem: 0, rank: "-", rankMult: 0, parts: {} };
  const full = { ...res, ...score, rank: score.rank, rankMult: score.rankMult, diem: score.diem, at: Date.now() };
  const lvBefore = save.hero.level;
  const rw = B.ladder ? P.computeRewards(save, full) : P.computeFixedRewards(save, full);
  const applied = B.ladder ? P.applyRewards(save, full, rw) : P.applyFixedRewards(save, B.id, full, rw);
  persist();
  const evName = (k) => (res.eventNames || RD.eventNames)[k] ?? (B.id === "B15" ? "Tướng ta bị vây" : k);
  const parts = score.parts;
  const pct = (v) => `${Math.round((v || 0) * 100)}%`;
  const ksList = res.keSachList || Object.values(res.river?.keSach || {});
  const hkRows = Object.entries(res.hkLog || {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v > 0 ? "+" : ""}${Math.round(v)}</td></tr>`).join("");
  const extra = ui?.resultHTML ? ui.resultHTML(res, { council }) : "";
  app.innerHTML = `
  <div class="results ${res.won ? "win" : "lose"}${B.ladder ? "" : " fixed"}">
    <div class="rank-seal r${score.rank}">${res.won ? score.rank : "✕"}</div>
    <h1>${res.won ? esc(RD.title) : "Thua trận"}</h1><p>${esc(res.why)}</p>
    ${res.won ? `<div class="card"><h3>Điểm ${score.diem} / 100</h3><table class="stat">
      <tr><td>Nhiệm vụ (35)</td><td>${pct(parts.M)} · chính ${res.mainDone}/${res.missionsTotal ?? RD.missionsTotal}, phụ ${res.sideDone}/${res.sideTotal ?? RD.sideTotal}</td></tr>
      <tr><td>Thời gian (15)</td><td>${pct(parts.T)} · ${Math.floor(res.timeSec / 60)}:${String(Math.floor(res.timeSec % 60)).padStart(2, "0")} (par ${Math.floor(parSec / 60)}:${String(Math.round(parSec % 60)).padStart(2, "0")})</td></tr>
      <tr><td>Quân ta còn (20)</td><td>${pct(parts.Q)}</td></tr><tr><td>${esc(RD.cLabel || "Cứ Điểm")} (20)</td><td>${pct(parts.C)}</td></tr>
      <tr><td>Kế Sách (10)</td><td>${pct(parts.K)} · ${ksList.map((k) => `${k.name}: ${k.word.toLowerCase()}`).join(", ")}${kLost ? ` <small class="bad">— mất điểm Kế Sách: chỉ một nửa hạm đội mắc cạn</small>` : ""}</td></tr>
      <tr><td>KO</td><td>${res.ko} (par ${MODES[res.mode].koPar})</td></tr></table></div>` : ""}
    ${extra}
    <div class="grid2">
      <div class="card"><h3>Phần thưởng</h3><table class="stat">
        ${B.ladder ? `<tr><td>EXP</td><td>+${n(rw.exp)}${applied.levelsGained ? ` · <b>lên cấp ${save.hero.level}</b> (từ ${lvBefore})` : ""}</td></tr>`
          : `<tr><td>EXP</td><td>— <small class="small">${B.ownHero ? "trận thử ngoài thang R: chưa tính EXP" : `tướng dựng sẵn cấp ${B.preset?.level ?? res.R}`}</small></td></tr>`}
        <tr><td>Tiền</td><td>+${n(rw.tien)}${res.chestCoins ? ` (gồm ${n(res.chestCoins)} từ rương)` : ""}</td></tr>
        <tr><td>Tinh thiết</td><td>+${n(rw.tt)}</td></tr><tr><td>Quân công</td><td>+${n(rw.qc)}</td></tr>
        ${rw.drops.map((d) => `<tr><td>Binh khí</td><td><b>${WEAPON_NAMES[d.tier]}</b> · ${esc(d.why)}</td></tr>`).join("")}
        ${rw.skillPoint ? `<tr><td>Điểm kỹ năng</td><td>+1 (lần đầu hạng S ở R ${res.R})</td></tr>` : ""}
        ${rw.unlockR ? `<tr><td>Mở</td><td>Cấp trận R ${rw.unlockR}</td></tr>` : ""}
        ${applied.newBest ? `<tr><td>Hạng tốt nhất</td><td><b>${score.rank}</b> · mới</td></tr>` : ""}
      </table></div>
      <div class="card"><h3>Quân ta và Hào Khí</h3><table class="stat">
        <tr><td>Hào Khí gốc</td><td>${Math.round(res.hkRaw)} · nguồn tùy chọn ${res.hkRaw ? Math.round((res.hkOptional / res.hkRaw) * 100) : 0}%</td></tr>
        <tr><td>Tổng Phản Công</td><td>${res.tpcCount} lần</td></tr><tr><td>Mệnh Lệnh</td><td>${res.orders}</td></tr>
        <tr><td>Kế Sách thành công</td><td>${res.keSachOk} / ${ksList.length}</td></tr>
        <tr><td>Sĩ Khí TB</td><td>${Math.round(res.avgSK)}</td></tr>
        ${Object.entries(res.events || {}).map(([k, v]) => `<tr><td>${esc(evName(k))}</td><td>${esc(EVENT_WORD[v] || v)}</td></tr>`).join("")}
      </table><details><summary>Hào Khí theo nguồn</summary><table class="stat">${hkRows}</table></details></div>
    </div>
    ${cards.length ? `<div class="card"><h3>Sử quán mở thẻ</h3><div class="unlocked" style="justify-content:flex-start">${cards.map((id) => cardOf(id)).filter(Boolean).map((c) => `<div class="sq-card new"><b>${esc(c.title)}</b><small><span class="label ${LCLS[c.label]}">${c.label}</span>${groupName(c)}</small></div>`).join("")}</div></div>` : ""}
    <div class="row center">${firstClear && STORY ? `<button class="primary" data-end>Tiếp: Kết chương ›</button>` : `<button class="primary" data-back>Về Doanh trại</button>`}
      <button data-again>Đánh lại</button><button data-sq>Sử quán</button>${!B.ladder && res.won && !firstClear ? `<button data-close-comic>Xem comic kết chương</button>` : ""}</div>
  </div>`;
  const nextR = () => { if (B.ladder) pick.R = Math.max(...save.ladder.unlocked.filter((r) => r <= Math.max(pick.R, rw.unlockR || 0))); };
  app.querySelector("[data-back]")?.addEventListener("click", () => { tab = "xuattran"; nextR(); render(); });
  app.querySelector("[data-end]")?.addEventListener("click", () => { nextR(); endChapter(cards, B.chapter); });
  app.querySelector("[data-sq]").onclick = () => { tab = "suquan"; nextR(); render(); };
  app.querySelector("[data-again]").onclick = () => startBattle(B.id);
  // chơi lại đã thắng: comic kết chương không tự phát; xem xong thì về Doanh trại (màn kết quả đã ghi thưởng)
  app.querySelector("[data-close-comic]")?.addEventListener("click", async () => { await playComic("close", { ch: B.chapter }); tab = "xuattran"; render(); });
}

// ---- màn chào (đợt 17) -------------------------------------------------------------------------
// Mở game là màn này, không phải sảnh: tranh, logo và chỉ hai, ba nút — Bắt đầu (máy chưa có tiến độ) hoặc Tiếp tục + Chơi mới,
// và Cài đặt. Bấm Bắt đầu / Tiếp tục mới tới sảnh Xuất trận. Chơi mới hỏi lại rồi xóa bản lưu (như nút ở Hồ sơ). Cài đặt ở hub
// có nút "Về màn chào". ?debug bỏ qua màn này: bot và kịch bản kiểm thử bấm thẳng nút ở sảnh (__start).
const hasProgress = (s) => !!(s.stats?.battles || s.hero.level > 1 || s.hero.exp > 0 || s.tutorial?.done || s.career || s.veterans?.length
  || Object.values(s.chapters || {}).some((c) => c?.opened));
function titleScreen() {
  onTitle = true;
  const cont = hasProgress(save);
  app.innerHTML = `<div class="ttl">
    <div class="lb-art fresh" aria-hidden="true"><i class="lb-img"></i>${EMBERS}</div>
    <div class="lb-logo ttl-logo"><h1>Hào Khí <span>Đông A</span></h1><p>Nam Quốc Sơn Hà</p></div>
    <nav class="ttl-menu" aria-label="Màn chào">
      <button class="lb-go" data-ttl="go"><span class="gi"><i>${NAV_ICON.xuattran}</i><span><b>${cont ? "Tiếp tục" : "Bắt đầu"}</b></span></span></button>
      ${cont ? `<button class="ttl-btn" data-ttl="new">Chơi mới</button>` : ""}
      <button class="ttl-btn" data-ttl="settings">${GEAR_ICON}<span>Cài đặt</span></button>
    </nav>
  </div>`;
  window.scrollTo(0, 0);
  app.querySelector("[data-ttl=go]").onclick = () => { tab = "xuattran"; render(); };
  app.querySelector("[data-ttl=settings]").onclick = openSettings;
  app.querySelector("[data-ttl=new]")?.addEventListener("click", () => openSheet("ttl-new", "Chơi mới", (sh, close) => {
    sh.innerHTML = `<div class="sheet-head"><h3>Chơi mới?</h3><button data-close aria-label="Đóng">✕</button></div>
      <p>Tiến độ trên máy này sẽ bị xóa: cấp tướng, binh khí, thẻ Sử quán, người lính Tự do. Không hoàn tác được.</p>
      <p class="small">Muốn giữ bản cũ: Tiếp tục → Hồ sơ → Xuất file trước.</p>
      <div class="row center"><button class="danger" data-ttl-reset>Xóa và chơi mới</button><button data-ttl-keep>Thôi</button></div>`;
    sh.querySelector("[data-ttl-keep]").onclick = close;
    sh.querySelector("[data-ttl-reset]").onclick = () => { save = resetSave(); pick = freshPick(); persist(); close(); tab = "xuattran"; render(); };
  }));
}

installNoZoom();
if (DEBUG) render(); else titleScreen();
if (location.search.includes("debug")) {
  import("./debug.js");
  // kịch bản kiểm thử màn Chương (comic, kết quả, kết chương, Quiz) không cần đánh hết trận
  // startBattle(id), pick (trận / tướng đang chọn), ensureMeta(chương) cho kịch bản nhiều trận (đợt 9)
  window.__main = { afterBattle, showResults, endChapter, startQuiz, playComic, render, startBattle, ensureMeta, pick, startSkirmish, missionBoard, showTdResult,
    get save() { return save; }, set tab(v) { tab = v; } };
}
