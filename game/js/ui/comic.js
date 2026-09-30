// ui/comic.js — khung đọc comic trong game (GDD 22.3). Ảnh AI chỉ là nền đã nướng sẵn (tools/bake-comic.py); lời dẫn,
// bóng thoại, chữ trên cờ, nhãn sử liệu do engine vẽ từ dữ liệu, nên dịch được và luôn đúng dấu.
//
//   readComic(comic, { ids, title, settings, single, onSeen }) → Promise<{ skipped, seen }>
//
// PC: nguyên trang theo pages của dữ liệu; điện thoại (hoặc màn hẹp): từng khung vừa màn hình, lời dẫn rồi từng bóng
// thoại hiện theo mỗi lần chạm, giữ 0,5 s để xem nguyên trang. Lật: → ← Space Enter, chuột/chạm (nửa phải tới, nửa
// trái lui), tay cầm A/B. Bỏ qua: nút góc trên phải hoặc Esc, hỏi lại một lần "Bỏ qua? Đọc lại ở Sử quán".
// Tự lật: 1,5 s + 0,25 s mỗi âm tiết. Chuyển động nhẹ (phóng ≤ 108%, lia ≤ 8%) tắt khi "Rung và nháy" tắt.

const LABEL_CLS = { "Chính sử": "cs", "Tương truyền": "tt", "Hư cấu": "hc" };
const T = {
  vi: { skip: "Bỏ qua", skipQ: "Bỏ qua? Đọc lại ở Sử quán.", yes: "Bỏ qua", no: "Đọc tiếp", page: "Trang", panel: "Từng khung", auto: "Tự lật",
    fiction: "Lời thoại: Hư cấu", done: "Xong", cont: "Tiếp tục trận", hold: "Giữ để xem cả trang" },
  en: { skip: "Skip", skipQ: "Skip? You can reread it in the Archive.", yes: "Skip", no: "Keep reading", page: "Page", panel: "Panel", auto: "Auto",
    fiction: "Dialogue: fiction", done: "Done", cont: "Back to battle", hold: "Hold to see the page" },
};

let handLoaded = false;
const hanLoaded = new Set();
function loadFonts(comic) {
  // bóng thoại dùng chữ viết tay có dấu tiếng Việt; chữ Hán trên cờ chỉ tải đúng các chữ cần (&text=), vài KB —
  // theo dõi từng chữ đã tải để Chương sau có chữ Hán khác vẫn được nạp
  if (!handLoaded) {
    handLoaded = true;
    const l = document.createElement("link"); l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Patrick+Hand&display=swap&subset=vietnamese";
    document.head.appendChild(l);
  }
  const signs = [...new Set(Object.values(comic.panels).flatMap((p) => (p.signs || []).map((s) => s.text)).join(""))].filter((c) => !hanLoaded.has(c)).join("");
  for (const c of signs) hanLoaded.add(c);
  if (signs) {
    const h = document.createElement("link"); h.rel = "stylesheet";
    h.href = "https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@900&display=swap&text=" + encodeURIComponent(signs);
    document.head.appendChild(h);
  }
}

// số âm tiết (tiếng Việt: mỗi tiếng cách nhau bởi khoảng trắng) — đo thời gian đọc
const syll = (s) => (s ? s.trim().split(/\s+/).length : 0);
export function panelSyllables(p, lang = "vi") {
  let n = p.caption ? syll(p.caption[lang] || p.caption.vi) : 0;
  for (const b of p.bubbles || []) n += syll(b[lang] || b.vi || "");
  return n;
}
export const readSeconds = (p, lang) => 1.5 + 0.25 * panelSyllables(p, lang);

// chia ids thành trang theo pages của dữ liệu; khung không nằm trong trang nào thành một trang riêng
export function pagesFor(comic, ids) {
  const want = new Set(ids), used = new Set(), out = [];
  for (const pg of comic.pages) {
    const rows = pg.rows.map((r) => r.filter((id) => want.has(id))).filter((r) => r.length);
    if (!rows.length) continue;
    rows.flat().forEach((id) => used.add(id));
    out.push(rows);
  }
  for (const id of ids) if (!used.has(id)) out.push([[id]]);
  // giữ thứ tự đọc của ids
  const pos = (rows) => Math.min(...rows.flat().map((id) => ids.indexOf(id)));
  return out.sort((a, b) => pos(a) - pos(b));
}

const ratio = (a) => { const [w, h] = a.split(":").map(Number); return w / h; };
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const hash = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };

function panelHTML(comic, id, lang, { layers = true } = {}) {
  const p = comic.panels[id], base = `./assets/comic/${comic.chapter.id}/${id}`;
  const lab = (l) => `<span class="clabel ${LABEL_CLS[l] || "hc"}">${esc(l)}</span>`;
  // ảnh và chữ trên cờ chung một lớp .cmove: lia/phóng kéo cả hai, chữ không trôi khỏi lá cờ
  let h = `<div class="cmove"><picture><source type="image/avif" srcset="${base}.avif"><img class="art" src="${base}.webp" alt="" draggable="false"></picture>`;
  for (const s of p.signs || []) {
    const tr = s.rotate ? `translate(-50%,-50%) rotate(${s.rotate}deg)` : "translate(-50%,-50%)";
    h += `<div class="sign${s.vertical ? " vertical" : ""}" style="left:${s.x}%;top:${s.y}%;font-size:${s.size || 6}cqh;transform:${tr}">${esc(s.text)}</div>`;
  }
  h += `</div><div class="gold"></div>`;
  if (p.caption) {
    const pos = p.capPos && p.capPos !== "tl" ? " " + p.capPos : "";
    h += `<div class="cap${pos}${layers ? " layer" : ""}"${p.capW ? ` style="max-width:${p.capW}cqw"` : ""}>${esc(p.caption[lang] || p.caption.vi)}${lab(p.caption.label)}</div>`;
  }
  let fiction = false;
  for (const b of p.bubbles || []) {
    if (b.from) continue;                         // lời lấy từ Hiến kế (bản R1) — bản VS không có Hiến kế
    if (b.label === "Hư cấu") fiction = true;
    h += `<div class="bub ${b.tail || "down"}${layers ? " layer" : ""}" style="left:${b.x}%;top:${b.y}%"><span class="who">${esc(b.who)}</span>${esc(b[lang] || b.vi)}${b.label && b.label !== "Hư cấu" ? lab(b.label) : ""}</div>`;
  }
  if (fiction) h += `<div class="fmark">${T[lang].fiction}</div>`;
  if (p.imageLabel) h += `<div class="imglabel">${esc(p.imageLabel[lang] || p.imageLabel.vi)}</div>`;
  return `<div class="cpanel" data-id="${id}" style="--ar:${ratio(p.aspect)};aspect-ratio:${p.aspect.replace(":", " / ")}">${h}</div>`;
}

// kéo bóng thoại vào trong khung (x của dữ liệu là tâm bóng; bóng sát mép dễ lòi ra ngoài); khung nhỏ (điện thoại)
// thì lời dẫn phình cao, bóng đè lên — đẩy bóng xuống dưới hộp lời dẫn
function clampBubbles(root) {
  for (const b of root.querySelectorAll(".bub")) {
    b.style.marginLeft = "0px"; b.style.marginTop = "0px";
    const panel = b.closest(".cpanel"), p = panel.getBoundingClientRect();
    let r = b.getBoundingClientRect();
    if (!p.width) continue;
    const s = r.left < p.left + 6 ? p.left + 6 - r.left : r.right > p.right - 6 ? p.right - 6 - r.right : 0;
    if (s) b.style.marginLeft = s + "px";
    const cap = panel.querySelector(".cap");
    if (!cap) continue;
    const c = cap.getBoundingClientRect(); r = b.getBoundingClientRect();
    if (r.left < c.right && r.right > c.left && r.top < c.bottom && r.bottom > c.top) {
      const down = c.bottom + 8 - r.top;
      if (r.bottom + down < p.bottom - 6) b.style.marginTop = down + "px";
    }
  }
}

// bề ngang lớn nhất để cả trang (các hàng khung, mỗi hàng cao theo tỉ lệ) nằm gọn trong W × H
function pageWidth(comic, rows, W, H, g) {
  let inv = 0, fixed = g * (rows.length - 1);
  for (const r of rows) { const R = r.reduce((s, id) => s + ratio(comic.panels[id].aspect), 0); inv += 1 / R; fixed -= (g * (r.length - 1)) / R; }
  return Math.min(W, (H - fixed) / inv);
}

export function readComic(comic, { ids, title = "", settings = {}, single = false, closeLabel = null, onSeen, onSettings } = {}) {
  loadFonts(comic);
  return new Promise((resolve) => {
    let lang = settings.comicLang === "en" ? "en" : "vi";
    const t = () => T[lang];
    const coarse = matchMedia("(pointer: coarse)").matches;
    let mode = single ? "panel" : settings.comicMode === "page" ? "page" : settings.comicMode === "panel" ? "panel" : (coarse || innerWidth < 900 ? "panel" : "page");
    let auto = !!settings.comicAuto;
    const motion = settings.motion !== false;
    const pages = pagesFor(comic, ids);
    const order = pages.flat(2);                   // thứ tự khung khi đọc từng khung
    let pi = 0, ki = 0, step = 0, confirm = false, done = false, autoT = 0, autoLeft = 0;
    const seen = new Set();
    // 0,45 s đầu không nhận lật/bỏ qua: phím đang giữ (D, mũi tên), nút tay cầm, nút cảm ứng N ở nửa phải màn lúc khung
    // chèn giữa trận bật lên không được lướt qua khung ngay
    const armedAt = performance.now() + 450;
    const armed = () => performance.now() >= armedAt;
    document.activeElement?.blur?.();             // Enter không kích lại nút đang focus nằm sau lớp phủ

    const el = document.createElement("div");
    el.className = "comic";
    el.style.setProperty("--ctext", settings.comicText || 1);
    document.body.appendChild(el);
    const prevFocus = document.activeElement;

    const render = () => {
      el.className = `comic m-${mode}${motion ? "" : " nomotion"}${single ? " single" : ""}`;   // m-: .panel/.page của game.css là bảng tạm dừng
      const count = mode === "page" ? `${pi + 1} / ${pages.length}` : `${ki + 1} / ${order.length}`;
      el.innerHTML = `
        <div class="cbar"><div class="ctitle">${esc(title)}<span class="ccount2"> · ${count}</span></div>
          <div class="cctl">${single ? "" : `<button data-c="mode">${mode === "page" ? t().panel : t().page}</button>`}
            <button data-c="auto" class="${auto ? "on" : ""}">${t().auto}</button><button data-c="lang">${lang === "vi" ? "EN" : "VI"}</button>
            <button data-c="skip" class="primary">${single ? closeLabel || t().cont : t().skip} ✕</button></div></div>
        <div class="cstage"></div>
        <div class="cnav"><button data-c="prev" aria-label="Lùi">‹</button><span class="ccount">${count}</span><button data-c="next" aria-label="Tới">›</button></div>
        <div class="cconfirm${confirm ? " on" : ""}"><p>${t().skipQ}</p><div class="row center"><button data-c="yes" class="primary">${t().yes}</button><button data-c="no">${t().no}</button></div></div>
        <div class="cpeek"></div>`;
      const stage = el.querySelector(".cstage");
      if (mode === "page") {
        const rows = pages[pi];
        stage.innerHTML = `<div class="cpage">${rows.map((r) => `<div class="crow">${r.map((id) => panelHTML(comic, id, lang, { layers: false })).join("")}</div>`).join("")}</div>`;
        rows.flat().forEach(see);
      } else {
        const id = order[ki], p = comic.panels[id], base = `./assets/comic/${comic.chapter.id}/${id}`;
        // viền hai bên là chính ảnh làm mờ (khung 4:3 trên màn rộng)
        stage.innerHTML = `<div class="cbg" style="background-image:url(${base}.webp)"></div>${panelHTML(comic, id, lang)}`;
        const art = stage.querySelector(".cmove");
        if (motion && art) {
          const kind = hash(id) % 3, dur = Math.max(6, readSeconds(p, lang) + 2);
          art.style.animation = `${["cz-in", "cz-pan-l", "cz-pan-r"][kind]} ${dur}s ease-out both`;
        }
        see(id);
      }
      layout();
      reveal();
      el.querySelectorAll("[data-c]").forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); act(b.dataset.c); }));
      armAuto();
    };
    function see(id) { if (!seen.has(id)) { seen.add(id); onSeen?.([id]); } }

    const layout = () => {
      const stage = el.querySelector(".cstage"); if (!stage) return;
      const W = stage.clientWidth - 16, H = stage.clientHeight - 16;
      if (mode === "page") {
        const pg = stage.querySelector(".cpage"), g = 8;
        pg.style.width = Math.floor(pageWidth(comic, pages[pi], W - 2 * g, H - 2 * g, g) + 2 * g) + "px";
        pg.querySelectorAll(".crow").forEach((row) => row.querySelectorAll(".cpanel").forEach((c) => (c.style.flex = `${getComputedStyle(c).getPropertyValue("--ar")} 1 0`)));
      } else {
        const c = stage.querySelector(".cpanel"), ar = ratio(comic.panels[order[ki]].aspect);
        const w = Math.min(W, H * ar); c.style.width = Math.floor(w) + "px"; c.style.height = Math.floor(w / ar) + "px";
      }
      requestAnimationFrame(() => clampBubbles(el));
    };
    const layers = () => [...el.querySelectorAll(".cstage .layer")];
    const reveal = () => layers().forEach((x, i) => x.classList.toggle("later", i > step));

    // tự lật: thời gian mỗi khung theo số âm tiết; lời dẫn/bóng hiện dần trong khoảng đó
    function armAuto() {
      clearTimeout(autoT);
      if (!auto || confirm || done) return;
      const ids = mode === "page" ? pages[pi].flat() : [order[ki]];
      const total = ids.reduce((s, id) => s + readSeconds(comic.panels[id], lang), 0);
      const n = mode === "page" ? 1 : Math.max(1, layers().length);
      autoLeft = total / n;
      autoT = setTimeout(() => { go(1); }, autoLeft * 1000);
    }

    function go(d) {
      if (confirm || done) return;
      if (mode === "page") {
        if (d > 0 && pi >= pages.length - 1) return finish(false);
        pi = Math.max(0, pi + d);
        ki = order.indexOf(pages[pi].flat()[0]);
        render(); return;
      }
      if (d > 0 && step < layers().length - 1) { step++; reveal(); armAuto(); return; }
      if (d > 0 && ki >= order.length - 1) return finish(false);
      ki = Math.max(0, Math.min(order.length - 1, ki + d));
      pi = pages.findIndex((rows) => rows.flat().includes(order[ki]));
      step = d < 0 ? 99 : 0;
      render();
    }
    function act(c) {
      if (!armed() && (c === "next" || c === "prev" || c === "skip")) return;
      if (c === "next") go(1);
      else if (c === "prev") go(-1);
      else if (c === "skip") { if (single) return finish(false); confirm = true; clearTimeout(autoT); render(); }
      else if (c === "yes") finish(true);
      else if (c === "no") { confirm = false; render(); }
      else if (c === "mode") { mode = mode === "page" ? "panel" : "page"; step = 0; settings.comicMode = mode; onSettings?.(); render(); }
      else if (c === "auto") { auto = !auto; settings.comicAuto = auto; onSettings?.(); render(); }
      else if (c === "lang") { lang = lang === "vi" ? "en" : "vi"; settings.comicLang = lang; onSettings?.(); render(); }
    }

    const onKey = (e) => {
      if (done) return;
      e.stopPropagation();                        // trận đang dừng phía sau không nhận phím (Space = đòn N)
      const k = e.key;
      if (["ArrowRight", "ArrowLeft", " ", "Enter", "Escape"].includes(k)) e.preventDefault();
      if (e.repeat || !armed()) return;           // phím tự lặp của phím đang giữ không lật trang
      if (confirm) { if (k === "Escape" || k === "Enter") act(k === "Escape" ? "yes" : "no"); e.preventDefault(); return; }
      if (k === "ArrowRight" || k === " " || k === "Enter" || k === "d") { go(1); e.preventDefault(); }
      else if (k === "ArrowLeft" || k === "a") { go(-1); e.preventDefault(); }
      else if (k === "Escape") { act("skip"); e.preventDefault(); }
    };
    // chạm/nhấp: nửa phải tới, nửa trái lui; giữ 0,5 s (từng khung) để xem nguyên trang
    let holdT = 0, held = false, downX = 0, downY = 0;
    const onDown = (e) => {
      if (!e.target.closest(".cstage") || confirm || !armed()) return;
      held = false; downX = e.clientX; downY = e.clientY;
      clearTimeout(holdT);
      if (mode === "panel" && !single) holdT = setTimeout(() => { held = true; peek(true); }, 500);
    };
    const onUp = (e) => {
      clearTimeout(holdT);
      if (held) { peek(false); held = false; return; }
      if (!armed()) return;
      if (!e.target.closest(".cstage") || confirm || Math.hypot(e.clientX - downX, e.clientY - downY) > 30) return;
      go(e.clientX > innerWidth / 2 ? 1 : -1);
    };
    const peek = (on) => {
      const pk = el.querySelector(".cpeek"); if (!pk) return;
      if (!on) { pk.classList.remove("on"); pk.innerHTML = ""; return; }
      const rows = pages[pi], W = innerWidth * 0.94, H = innerHeight * 0.9;
      pk.innerHTML = `<div class="cpage" style="width:${Math.floor(pageWidth(comic, rows, W - 16, H - 16, 8) + 16)}px">${rows.map((r) => `<div class="crow">${r.map((id) => panelHTML(comic, id, lang, { layers: false })).join("")}</div>`).join("")}</div>`;
      pk.querySelectorAll(".cpanel").forEach((c) => (c.style.flex = `${getComputedStyle(c).getPropertyValue("--ar")} 1 0`));
      pk.classList.add("on");
      requestAnimationFrame(() => clampBubbles(pk));
    };
    // giữ lâu trên điện thoại: chặn menu ảnh của hệ điều hành; hủy chạm thì tắt xem cả trang
    const onCancel = () => { clearTimeout(holdT); if (held) { peek(false); held = false; } };
    const onMenu = (e) => e.preventDefault();
    // tay cầm: A tới, B lui, Start bỏ qua (bắt cạnh nhấn); nút đang giữ lúc mở không tính là một lần bấm
    let raf = 0; const padPrev = {};
    for (const gp of navigator.getGamepads?.() || []) if (gp) for (const bi of [0, 1, 9, 14, 15]) padPrev[gp.index + ":" + bi] = !!gp.buttons[bi]?.pressed;
    const poll = () => {
      raf = requestAnimationFrame(poll);
      for (const gp of navigator.getGamepads?.() || []) {
        if (!gp) continue;
        for (const [bi, c] of [[0, "next"], [1, "prev"], [9, "skip"], [15, "next"], [14, "prev"]]) {
          const on = !!gp.buttons[bi]?.pressed, key = gp.index + ":" + bi;
          if (on && !padPrev[key]) confirm ? act(bi === 0 ? "yes" : "no") : act(c);
          padPrev[key] = on;
        }
      }
    };
    const onResize = () => layout();

    function finish(skipped) {
      if (done) return; done = true;
      clearTimeout(autoT); clearTimeout(holdT); cancelAnimationFrame(raf);
      removeEventListener("keydown", onKey, true); el.removeEventListener("pointerdown", onDown); el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onCancel); el.removeEventListener("contextmenu", onMenu);
      removeEventListener("resize", onResize);
      el.classList.add("out");
      setTimeout(() => el.remove(), 250);
      prevFocus?.focus?.();
      resolve({ skipped, seen: [...seen] });
    }

    // dựng trước rồi mới gắn listener: dữ liệu hỏng (id khung thiếu) thì đóng ngay, không nuốt bàn phím mãi
    try { if (!order.length) throw new Error("comic không có khung nào"); render(); }
    catch (err) { console.error(err); el.remove(); resolve({ skipped: true, seen: [...seen], error: err }); return; }
    addEventListener("keydown", onKey, true);
    el.addEventListener("pointerdown", onDown); el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onCancel); el.addEventListener("contextmenu", onMenu);
    addEventListener("resize", onResize);
    raf = requestAnimationFrame(poll);
  });
}
