// main.js — Doanh trại (hub), xuất trận, màn kết quả. Hub là DOM thuần; trận là three.js.

import { loadSave, writeSave, exportSave, importSave, resetSave } from "./meta/save.js";
import * as P from "./meta/progress.js";
import { NODES, TREE, TREE_RULES, WEAPON_TIERS, WEAPON_NAMES, FORGE, KHAC, LEGION, CAMP, R_LADDER } from "./data/progression.js";
import { DIFFICULTY, TROOP_LEVELS, HERO, EXP_NEXT, LEVEL_CAP, MOVES, E } from "./data/tuning.js";
import { HISTORY_NOTES, BOSS } from "./data/battle-b15.js";

const app = document.getElementById("app");
let save = loadSave();
let tab = "xuattran";
let pick = { R: Math.max(...save.ladder.unlocked), difficulty: save.settings.difficulty };
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
  const tabs = [["xuattran", "Xuất trận"], ["truongsoai", "Trướng soái"], ["loren", "Lò rèn"], ["luyenbinh", "Luyện binh"], ["doanhtrai", "Doanh trại"], ["hoso", "Hồ sơ"]];
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
    <nav class="tabs">${tabs.map(([k, l]) => `<button data-tab="${k}" class="${tab === k ? "on" : ""}">${l}${k === "truongsoai" && P.freePoints(save) > 0 ? ` <em>${P.freePoints(save)}</em>` : ""}</button>`).join("")}</nav>
    <main class="hub-body">${{ xuattran, truongsoai, loren, luyenbinh, doanhtrai, hoso }[tab]()}</main>
  </div>`;
  app.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => { tab = b.dataset.tab; render(); }));
  bind[tab]?.();
}

// ---- Xuất trận --------------------------------------------------------------------------------
function xuattran() {
  const st = P.heroStats(save, pick.R);
  const diff = DIFFICULTY.find((d) => d.id === pick.difficulty);
  return `
  <section class="card battle">
    <div class="battle-art"><div class="seal">B15</div><div><h2>Trận Hàm Tử</h2><p>Tháng 4 năm Ất Dậu · 1285 · bến Hàm Tử, sông Hồng</p></div></div>
    <p class="lead">Chiếm bến trên, giữ hai cánh, phá Hàm Tử quan, đánh lui ${BOSS.name}. Hai mặt trận cách nhau 150 m: bạn không thể có mặt ở cả hai, nên hãy dùng Mệnh Lệnh.</p>
    <ul class="notes">${HISTORY_NOTES.map((x) => `<li><span class="label ${x.label === "Chính sử" ? "cs" : x.label === "Tương truyền" ? "tt" : "hc"}">${x.label}</span>${esc(x.text)}</li>`).join("")}</ul>
  </section>
  <section class="card">
    <h3>Cấp trận R</h3>
    <div class="ladder">${R_LADDER.map((R) => {
      const open = save.ladder.unlocked.includes(R), best = save.ladder.best[R];
      return `<button data-r="${R}" class="${pick.R === R ? "on" : ""}" ${open ? "" : "disabled"}>R ${R}${best ? `<em class="rank r${best}">${best}</em>` : ""}${open ? "" : "<small>khóa</small>"}</button>`;
    }).join("")}</div>
    <p class="small">Thắng một cấp thì mở cấp kế (+3, như R1: B12 = 1 … B20 = 25). Địch mạnh theo R; tướng được nâng tối thiểu lên cấp R − 2 và binh khí tối thiểu E(R) − 0,10 khi vào trận (12.1, 12.7).</p>
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
    <b>${nd.name}</b><span>${nd.text}</span>${nd.kind ? `<em>${nd.kind}</em>` : ""}${nd.inert ? `<em class="inert">Kế Sách chưa có ở bản thử</em>` : ""}
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
  xuattran() {
    app.querySelectorAll("[data-r]").forEach((b) => (b.onclick = () => { pick.R = Number(b.dataset.r); render(); }));
    app.querySelectorAll("[data-diff]").forEach((b) => (b.onclick = () => { pick.difficulty = b.dataset.diff; save.settings.difficulty = pick.difficulty; persist(); render(); }));
    app.querySelectorAll("[data-set]").forEach((el) => (el.onchange = () => { save.settings[el.dataset.set] = el.type === "checkbox" ? el.checked : el.value; persist(); }));
    app.querySelector("[data-go]").onclick = startBattle;
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
    app.querySelector("[data-import]").onchange = async (e) => { const f = e.target.files[0]; if (!f) return; try { save = await importSave(f); persist(); toast("Đã nhập bản lưu."); render(); } catch (_) { toast("File không đọc được.", true); } };
    app.querySelector("[data-reset]").onclick = () => { if (confirm("Xóa toàn bộ tiến độ? Không hoàn tác được.")) { save = resetSave(); pick = { R: 1, difficulty: "quansi" }; persist(); render(); } };
  },
};

// ---- vào trận, kết quả ------------------------------------------------------------------------
async function startBattle() {
  const note = HISTORY_NOTES[Math.floor(Math.random() * HISTORY_NOTES.length)];
  app.innerHTML = `<div class="loading"><h2>Bến Hàm Tử · 1285</h2><p><span class="label ${note.label === "Chính sử" ? "cs" : "hc"}">${note.label}</span> ${esc(note.text)}</p><div class="spin"></div><p class="small">Bấm vào màn hình để khóa chuột và điều khiển camera. Esc để tạm dừng.</p></div>`;
  await new Promise((r) => setTimeout(r, 60));
  const { runBattle } = await import("./battle/battle.js");
  const stage = document.createElement("div"); stage.className = "stage"; document.body.appendChild(stage);
  app.style.display = "none";
  let res;
  try {
    res = await runBattle({ container: stage, save, R: pick.R, difficulty: pick.difficulty, onSettings: () => persist() });
  } catch (err) {
    console.error(err);
    res = null;
    toast("Lỗi khi chạy trận: " + err.message, true);
  }
  stage.remove(); app.style.display = "";
  if (!res) { render(); return; }
  showResults(res);
}

const EVENT_WORD = { wait: "chưa xảy ra", run: "còn dang dở khi trận kết thúc", skip: "bỏ qua (tướng đã rút)", win: "giữ được", lose: "thất bại" };

function showResults(res) {
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
      <tr><td>Thời gian (15)</td><td>${pct(parts.T)} · ${Math.floor(res.timeSec / 60)}:${String(Math.floor(res.timeSec % 60)).padStart(2, "0")} (par 10:00)</td></tr>
      <tr><td>Quân ta còn (20)</td><td>${pct(parts.Q)}</td></tr><tr><td>Cứ Điểm (20)</td><td>${pct(parts.C)}</td></tr>
      <tr><td>KO (10)</td><td>${pct(parts.K)} · ${res.ko} KO (par 400)</td></tr></table></div>` : ""}
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
        <tr><td>Sĩ Khí TB</td><td>${Math.round(res.avgSK)}</td></tr>
        ${Object.entries(res.events || {}).map(([k, v]) => `<tr><td>${k === "counterA1" ? "Cứ Điểm bị phản công" : "Tướng ta bị vây"}</td><td>${esc(EVENT_WORD[v] || v)}</td></tr>`).join("")}
      </table><details><summary>Hào Khí theo nguồn</summary><table class="stat">${hkRows}</table></details></div>
    </div>
    <div class="row center"><button class="primary" data-back>Về Doanh trại</button><button data-again>Đánh lại</button></div>
  </div>`;
  app.querySelector("[data-back]").onclick = () => { tab = "xuattran"; pick.R = Math.max(...save.ladder.unlocked.filter((r) => r <= Math.max(pick.R, rw.unlockR || 0))); render(); };
  app.querySelector("[data-again]").onclick = () => startBattle();
}

render();
if (location.search.includes("debug")) import("./debug.js");
