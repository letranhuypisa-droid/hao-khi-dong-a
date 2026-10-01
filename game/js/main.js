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
import { chapterState, markSeen, unlockCards, battleUnlockKeys, pickQuiz, answerQuiz, completeChapter, syncLegacy, registerCards } from "./meta/chapter.js";
import { readComic } from "./ui/comic.js";
import { runQuiz } from "./ui/quiz.js";
import { BATTLES, BATTLE_ORDER, loadBattleDef, loadChapterMeta } from "./data/battles.js";
import { HEROES } from "./data/heroes.js";

// ?debug (bot, kịch bản kiểm thử) bỏ comic, Hiến kế và khung chèn giữa trận; thêm &story để vẫn phát
const DEBUG = /[?&]debug\b/.test(location.search);
const STORY = !DEBUG || /[?&]story\b/.test(location.search);
const CH = "B15";
// Chỉ khi ?debug: &battle=B20 chọn sẵn trận (nút VÀO TRẬN / __start vào trận đó), &hero=H31 thay tướng (kể cả ở B15)
const QP = new URLSearchParams(location.search);
const DEBUG_BATTLE = DEBUG && BATTLES[QP.get("battle")] ? QP.get("battle") : null;
const DEBUG_HERO = DEBUG && HEROES[QP.get("hero")] ? QP.get("hero") : null;

const app = document.getElementById("app");
let save = loadSave();
if (syncLegacy(save)) writeSave(save);
save.battles ||= {};                               // trận ngoài thang R (B20): { best, cleared } — progress.js migrate cũng thêm
for (const id of BATTLE_ORDER) if (!BATTLES[id].ladder) save.battles[id] ||= { best: null, cleared: false };
let tab = "xuattran";
let pick = { R: Math.max(...save.ladder.unlocked), difficulty: save.settings.difficulty, battle: DEBUG_BATTLE || "B15", hero: {} };

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
function render() {
  const h = save.hero, w = save.wallet;
  const expPct = h.level >= LEVEL_CAP ? 100 : (h.exp / EXP_NEXT(h.level)) * 100;
  const tabs = [["xuattran", "Xuất trận"], ["huanluyen", "Huấn luyện"], ["suquan", "Sử quán"], ["votruong", "Võ trường"], ["truongsoai", "Trướng soái"], ["loren", "Lò rèn"], ["luyenbinh", "Luyện binh"], ["doanhtrai", "Doanh trại"], ["hoso", "Hồ sơ"]];
  const unread = unreadCards().length;
  app.innerHTML = `
  <div class="hub">
    <header class="hub-head">
      <div class="brand"><h1>HÀO KHÍ ĐÔNG A</h1><p>Nam Quốc Sơn Hà · Quyển Nhà Trần · bản thử B15 Hàm Tử, B20 Bạch Đằng</p></div>
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
// Một thẻ mỗi trận trong danh mục (data/battles.js); bấm thẻ để chọn trận, phần thiết lập bên dưới theo trận đã chọn.
function xuattran() {
  const B = BATTLES[pick.battle] || BATTLES.B15, heroId = heroFor(B);
  const R = B.fixedR ?? pick.R;
  const st = B.ladder ? P.heroStats(save, pick.R) : P.heroStats(save, R, heroId, B.preset || null);
  const diff = DIFFICULTY.find((d) => d.id === pick.difficulty);
  const modes = Object.values(MODES).filter((m) => B.modes.includes(m.id)), curMode = modeFor(B);
  return `${save.tutorial?.done ? "" : tutorialBanner()}
  ${BATTLE_ORDER.map(battleCard).join("")}
  <section class="card">
    ${B.ladder ? `<h3>Cấp trận R</h3>
    <div class="ladder">${R_LADDER.map((R) => {
      const open = save.ladder.unlocked.includes(R), best = save.ladder.best[R];
      return `<button data-r="${R}" class="${pick.R === R ? "on" : ""}" ${open ? "" : "disabled"}>R ${R}${best ? `<em class="rank r${best}">${best}</em>` : ""}${open ? "" : "<small>khóa</small>"}</button>`;
    }).join("")}</div>
    <p class="small">Thắng một cấp thì mở cấp kế (+3, như R1: B12 = 1 … B20 = 25). Địch mạnh theo R; tướng được nâng tối thiểu lên cấp R − 2 và binh khí tối thiểu E(R) − 0,10 khi vào trận (12.1, 12.7).</p>`
    : `<h3>Cấp trận R ${R} · cố định</h3>
    <p class="small">${B.title}: tướng dựng sẵn cấp ${B.preset?.level ?? R}, binh khí E(R), không dùng cây kỹ năng và Lò rèn của Trần Quốc Toản (bản VS).${save.battles?.[B.id]?.best ? ` Hạng tốt nhất: <b>${save.battles[B.id].best}</b>${save.battles[B.id].bestTime ? ` · thắng nhanh nhất ${Math.floor(save.battles[B.id].bestTime / 60)}:${String(save.battles[B.id].bestTime % 60).padStart(2, "0")}` : ""}.` : ""}</p>`}
    <h3>Chế độ</h3>
    <div class="ladder">${modes.map((m) => `<button data-mode="${m.id}" class="${curMode === m.id ? "on" : ""}">${m.name}<small>par ${Math.round((B.par?.[m.id] ?? m.par) / 60)} phút · ${m.id === "nhanh" ? `Hào Khí ×1,3 · thưởng ×0,6 · ${B.keSach?.nhanh ?? 1} Kế Sách` : `thưởng ×1 · ${B.keSach?.chuan ?? 2} Kế Sách`}</small></button>`).join("")}</div>
    <h3>Độ khó</h3>
    <div class="ladder">${DIFFICULTY.map((d) => `<button data-diff="${d.id}" class="${pick.difficulty === d.id ? "on" : ""}">${d.name}<small>${d.tokens} lính đánh cùng lúc · thưởng ×${d.reward}</small></button>`).join("")}</div>
    <div class="grid2">
      <div><h3>Vào trận với${B.ladder ? "" : ` ${esc(HEROES[heroId].name)}`}</h3><table class="stat">
        <tr><td>Cấp</td><td>${st.level}${st.floorLifted ? ` <em class="lift">nâng từ ${save.hero.level}</em>` : ""}</td></tr>
        <tr><td>Công</td><td>${n(st.cong)}</td></tr><tr><td>Sinh lực</td><td>${n(st.hp)}</td></tr><tr><td>Giáp</td><td>${n(st.giap)}</td></tr>
        <tr><td>Hệ số binh khí</td><td>×${st.weaponMult.toFixed(2).replace(".", ",")}${st.weaponFloor ? ` <em class="lift">Quân giới cấp phát</em>` : ""}</td></tr>
        <tr><td>Chí mạng</td><td>${Math.round(st.crit * 100)}%</td></tr>
        <tr><td>Gượng dậy</td><td>${diff.revive} lần</td></tr>
        ${B.ladder ? `<tr><td>Đòn mạnh</td><td>C1–C4${save.hero.level >= MOVES.C5.unlockLv || st.level >= 5 ? ", C5" : ""}${st.level >= MOVES.C6.unlockLv ? ", C6" : ""}</td></tr>`
          : `<tr><td>Binh khí</td><td>${esc(HEROES[heroId].weaponName || "")} <span class="label hc">${HEROES[heroId].weaponLabel || "Hư cấu"}</span></td></tr>
        <tr><td>Khí Lực</td><td>${st.kiBars ?? HEROES[heroId].kiLucBars} vạch</td></tr>`}
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

// chế độ chơi của trận: chế độ đang chọn nếu trận có, không thì chế độ đầu tiên của trận (B20 chỉ Trận nhanh)
const modeFor = (B) => (B.modes.includes(save.settings.mode || "nhanh") ? save.settings.mode || "nhanh" : B.modes[0]);
const labelCls = (l) => (l === "Chính sử" ? "cs" : l === "Tương truyền" ? "tt" : "hc");

// Thẻ trận ở Xuất trận. B15 như trước đợt 9 (thêm viền chọn); trận đang dựng (wip) có nhãn "đang dựng — chơi thử" và
// ô chọn tướng (tướng chưa làm hiện "sắp có").
function battleCard(id) {
  const B = BATTLES[id], ch = save.chapters?.[B.chapter], on = pick.battle === id ? " picked" : "";
  if (id === "B15") return `<section class="card battle pickable${on}" data-bpick="B15">
    <div class="battle-art"><div class="seal">B15</div><div><h2>Trận Hàm Tử</h2><p>Tháng 4 năm Ất Dậu · 1285 · bến Hàm Tử, sông Hồng</p></div></div>
    <p class="lead">Chiếm bến trên, giữ hai cánh, phá Hàm Tử quan, đánh lui ${BOSS.name}. Hai mặt trận cách nhau 150 m: bạn không thể có mặt ở cả hai, nên hãy dùng Mệnh Lệnh.</p>
    <ul class="notes">${HISTORY_NOTES.map((x) => `<li><span class="label ${labelCls(x.label)}">${x.label}</span>${esc(x.text)}</li>`).join("")}</ul>
    ${chapterState(save, CH).openSeen ? `<div class="row" style="margin-top:10px"><button data-comic="open" data-ch="B15">Xem comic mở chương</button>
      <span class="small">Lần đầu vào trận, comic mở chương tự phát (bỏ qua được). Đọc lại mọi lúc ở Sử quán.</span></div>`
      : `<p class="small" style="margin-top:10px">Trước trận đầu tiên có comic mở chương (6 khung, chừng 40 giây, bỏ qua được).</p>`}
  </section>`;
  const hero = heroFor(B);
  return `<section class="card battle pickable${B.wip ? " wip" : ""}${on}" data-bpick="${id}">
    <div class="battle-art"><div class="seal${B.wip ? " seal-wip" : ""}">${id}</div><div><h2>${esc(B.title)}${B.wip ? ` <em class="wiptag">đang dựng — chơi thử</em>` : ""}</h2><p>${esc(B.sub)}</p></div></div>
    ${id === "B20" ? `<p class="lead">Dụ hạm đội Nguyên vào khúc sông đã đóng cọc lúc triều lên, giữ chân chúng tới khi nước ròng, rồi lên boong chiến thuyền mắc cạn. Sáu pha theo con nước.</p>` : ""}
    <div class="heropick"><span class="small">Tướng</span>${B.heroes.map((h) => {
      const H = HEROES[h], ok = B.playable.includes(h);
      return `<button data-hero="${h}" data-hb="${id}" class="${ok && hero === h ? "on" : ""}" ${ok ? "" : "disabled"}><b>${esc(H?.name || h)}</b><small>${ok ? esc(H?.title?.split(" · ")[0] || "") : "sắp có"}</small></button>`;
    }).join("")}</div>
    <p class="small">${B.wip ? `Bản thử đợt 9, còn đang dựng: có thể còn thô, thiếu phần. ` : ""}R ${B.fixedR} cố định, tướng dựng sẵn cấp ${B.preset?.level}, ${B.modes.length === 1 ? MODES[B.modes[0]].name : "mọi chế độ"}${B.keSach?.[B.modes[0]] ? `, ${B.keSach[B.modes[0]]} Kế Sách Lớn` : ""}.${save.battles?.[id]?.best ? ` Hạng tốt nhất: <b>${save.battles[id].best}</b>.` : ""}</p>
    ${ch?.openSeen ? `<div class="row" style="margin-top:10px"><button data-comic="open" data-ch="${B.chapter}">Xem comic mở chương</button>
      <span class="small">Lần đầu vào trận: comic, Hiến kế, lệnh Chủ soái tự phát. Chơi lại thì bỏ qua comic (nút "Xem comic" ở hội đồng), thẻ kế của người xưa mang dấu "Người xưa chọn".</span></div>`
      : `<p class="small" style="margin-top:10px">Trước trận đầu tiên: comic mở chương (${metaOf(B.chapter)?.comic?.open?.length ?? 4} khung), Hiến kế ba thẻ, lệnh Chủ soái quyết — bỏ qua được comic, không bỏ qua được Hiến kế.</p>`}
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
// Mỗi Chương trong danh mục một khối: comic đã gặp (mở chương, [Chủ soái quyết], giữa trận, kết chương), Quiz chương,
// thẻ sử liệu. Chương chưa nạp nội dung (nạp lười) thì hiện "đang nạp" rồi tự vẽ lại.
const EMPTY_CH = { opened: false, openSeen: false, closeSeen: false, insertSeen: false, seen: [], cleared: false };
const COMIC_INFO = {
  B15: { open: "Tình thế, Chủ soái quyết", insert: "Áo Tống trên bến", insertLock: "Mở khi thuyền quân Triệu Trung cập bến" },
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
  const btn = (part, ok, title, sub) => `<button data-comic="${part}" data-ch="${id}" ${ok ? "" : "disabled"}><b>${title}</b><small>${sub}</small></button>`;
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
    app.querySelector("[data-go]").onclick = () => startBattle(pick.battle);
    app.querySelector("[data-tutgo]")?.addEventListener("click", startTutorial);
    app.querySelectorAll("[data-comic]").forEach((b) => b.addEventListener("click", async (e) => { e.stopPropagation(); await playComic("open", { ch: e.currentTarget.dataset.ch || CH }); render(); }));
    app.querySelectorAll("[data-bpick]").forEach((s) => s.addEventListener("click", () => { if (pick.battle !== s.dataset.bpick) { pick.battle = s.dataset.bpick; render(); } }));
    app.querySelectorAll("[data-hero]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); pick.battle = b.dataset.hb; pick.hero[b.dataset.hb] = b.dataset.hero; render(); }));
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
    app.querySelector("[data-reset]").onclick = () => { if (confirm("Xóa toàn bộ tiến độ? Không hoàn tác được.")) { save = resetSave(); pick = { R: 1, difficulty: "quansi" }; persist(); render(); } };
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
  app.innerHTML = `<div class="loading"><h2>${esc(B.loading.title)}</h2><p><span class="label ${note.label === "Chính sử" ? "cs" : note.label === "Tương truyền" && B.id !== "B15" ? "tt" : "hc"}">${note.label}</span> ${esc(note.text)}</p><div class="spin"></div><p class="small">Bấm vào màn hình để khóa chuột và điều khiển camera. Esc để tạm dừng.</p></div>`;
  await new Promise((r) => setTimeout(r, 60));
  const [{ runBattle }, def] = await Promise.all([import("./battle/battle.js"), loadBattleDef(B.id)]);
  const stage = document.createElement("div"); stage.className = "stage"; document.body.appendChild(stage);
  app.style.display = "none";
  let res;
  try {
    // khung chèn giữa trận (B15: D2 khi thuyền quân Triệu Trung đầu tiên cập bến) chỉ tự phát lần đầu
    const story = STORY && !ch.insertSeen && M.comic.insert?.length ? {
      comic: M.comic, settings: save.settings, onSettings: persist,
      onSeen: (s) => { markSeen(save, chId, s); persist(); },
      onDone: () => { ch.insertSeen = true; persist(); },
    } : null;
    res = await runBattle({ container: stage, save, R: B.fixedR ?? pick.R, difficulty: pick.difficulty, mode: modeFor(B), music, story, onSettings: () => persist(),
      battle: def, heroId: heroFor(B), quyetSach });
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
          : `<tr><td>EXP</td><td>— <small class="small">tướng dựng sẵn cấp ${B.preset?.level ?? res.R}</small></td></tr>`}
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

render();
if (location.search.includes("debug")) {
  import("./debug.js");
  // kịch bản kiểm thử màn Chương (comic, kết quả, kết chương, Quiz) không cần đánh hết trận
  // startBattle(id), pick (trận / tướng đang chọn), ensureMeta(chương) cho kịch bản nhiều trận (đợt 9)
  window.__main = { afterBattle, showResults, endChapter, startQuiz, playComic, render, startBattle, ensureMeta, pick,
    get save() { return save; }, set tab(v) { tab = v; } };
}
