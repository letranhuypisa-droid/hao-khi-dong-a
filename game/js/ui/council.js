// ui/council.js — màn Quyết sách / Hiến kế trước trận (systems §12.6, GDD 22.2). Đọc sau phần Tình thế của comic mở
// chương, trước phần Chủ soái quyết. Tướng quân là một tướng trong hội đồng, hiến 1 trong 3 kế; 1 kế là cách người xưa.
//
//   runCouncil({ council, comic, settings, replay, tutorial, rng, marks, onSettings }) → Promise<{ picked, historical }>
//     council   khối council của comic (comic-b20.js: title, prompt, cards[{id, historical?, label, text, reply}], decree)
//     comic     (không bắt buộc) comic của Chương: lấy tên người đáp ở bóng from:"reply" và ảnh nền mờ (bgPanel, mặc định
//               khung hội quân O7)
//     replay    Chương đã thắng: thẻ lịch sử mang dấu "Người xưa chọn" ngay từ đầu, hai nhánh đều có Tình báo sớm
//     tutorial  lần đầu gặp Quyết sách (bản VS: B20): 1 thẻ hướng dẫn 1 màn hình trước khi chọn
//     marks     tên các Kế Sách mang dấu "Kế đã định" (quyetSach.danhDau) để ghi ở màn kết quả
//     onComic   (đợt 9, chơi lại) có thì thanh trên có nút "Xem comic": ẩn hội đồng, chờ onComic() (phát lại comic mở
//               chương) rồi hiện lại đúng bước đang dở. Kết quả mang comic: true khi đã bấm (main.js phát tiếp phần
//               Chủ soái quyết như lần đầu).
//
// Luật (§12.6): vị trí thẻ xáo mỗi lần; trước khi chọn không thẻ nào lộ nhãn hay chữ "người xưa"; chọn → lời đáp của
// chủ soái → lệnh Chủ soái quyết (luôn theo sử). Quyết sách không đổi Hào Khí, hạng, độ khó; không bỏ qua được.
// Bàn phím: 1–3 chọn, Enter/Space tiếp; tay cầm: ←/→ đổi thẻ, A chọn/tiếp. VI/EN theo settings.comicLang.
//
// Phần thuần (xáo, kiểm dữ liệu, điền bóng thoại D1 của comic theo kế đã chọn) chạy được trong node cho kiểm thử.

const LCLS = { "Chính sử": "cs", "Tương truyền": "tt", "Hư cấu": "hc" };
const T = {
  vi: {
    seal: "Kế", pick: "Chọn một kế để hiến", next: "Tiếp", comic: "Xem comic", go: "Nghe lệnh", done: "Vào trận", old: "Người xưa chọn", you: "Kế của tướng quân",
    replyHead: "Chủ soái đáp", decreeHead: "Chủ soái quyết", fiction: "Lời đáp: Hư cấu",
    right: (m) => `Kế của tướng quân hợp với cách người xưa. <b>Kế đã định</b>: ${m} mang dấu trên bản đồ lớn và bản đồ nhỏ từ đầu trận; <b>Tình báo sớm</b> lộ tuyến tiến của địch ngay từ sa bàn.`,
    wrong: "Người xưa đã chọn cách khác. Trận vẫn như cũ: tướng quân tự tìm Kế Sách qua quân sư và tháp canh; comic kết chương kể người xưa đã làm gì.",
    replayNote: "Chơi lại: cả hai nhánh đều có Tình báo sớm.", marksDefault: "các Kế Sách chính",
    same: "Quyết sách không đổi Hào Khí, xếp hạng hay độ khó.",
    tutTitle: "Quyết sách", tutOk: "Vào hội đồng",
    tut: [
      "Trước mỗi trận lớn, chủ soái họp các tướng. Tướng quân được hiến <b>một trong ba kế</b>.",
      "Một kế là cách <b>người xưa đã làm</b>; hai kế kia là Hư cấu. Trước khi chọn, không thẻ nào lộ đâu là kế của người xưa.",
      "Chọn đúng: Kế Sách của trận mang dấu <b>Kế đã định</b> và có <b>Tình báo sớm</b>. Chọn khác: trận như cũ, comic kết chương kể người xưa đã làm gì.",
      "Không cộng trừ Hào Khí, không đổi xếp hạng hay độ khó. Cứ chọn theo suy nghĩ của mình.",
    ],
  },
  en: {
    seal: "Kế", pick: "Choose a plan to offer", next: "Next", comic: "Read comic", go: "Hear the order", done: "To battle", old: "The ancients' choice", you: "Your plan",
    replyHead: "The commander replies", decreeHead: "The commander decides", fiction: "Reply: fiction",
    right: (m) => `Your plan matches what the ancients did. <b>Plan set</b>: ${m} are marked on the map and minimap from the start; <b>early intelligence</b> shows the enemy's route on the sand table.`,
    wrong: "The ancients chose differently. The battle is unchanged: find the stratagems through your adviser and the watchtowers; the closing comic tells what really happened.",
    replayNote: "Replay: both choices get early intelligence.", marksDefault: "the main stratagems",
    same: "Your choice never changes Hào Khí, rank or difficulty.",
    tutTitle: "War council", tutOk: "Enter the council",
    tut: [
      "Before each great battle the commander gathers his generals. You may offer <b>one of three plans</b>.",
      "One plan is <b>what the ancients did</b>; the other two are fiction. Nothing tells you which before you choose.",
      "The historical plan marks the battle's stratagems as <b>Plan set</b> and grants <b>early intelligence</b>. Another plan leaves the battle unchanged, and the closing comic tells what really happened.",
      "No Hào Khí gained or lost, no change to rank or difficulty. Choose as you think best.",
    ],
  },
};
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const tx = (o, lang) => (o && (o[lang] || o.vi)) || "";

// ---- phần thuần --------------------------------------------------------------------------------------------------

// Kiểm dữ liệu Hiến kế: đúng 3 thẻ, đúng 1 thẻ lịch sử (nhãn Chính sử), 2 thẻ còn lại Hư cấu; đủ chữ VI/EN.
export function councilErrors(c) {
  const errs = [], e = (m) => errs.push(m);
  if (!c) return ["không có dữ liệu Hiến kế"];
  if (!c.title?.vi || !c.prompt?.vi || !c.decree?.vi) e("thiếu title, prompt hoặc decree");
  const cards = c.cards || [];
  if (cards.length !== 3) e(`cần 3 thẻ, có ${cards.length}`);
  if (cards.filter((k) => k.historical).length !== 1) e("cần đúng 1 thẻ historical");
  if (new Set(cards.map((k) => k.id)).size !== cards.length) e("id thẻ trùng");
  for (const k of cards) {
    if (!LCLS[k.label]) e(`${k.id}: nhãn lạ ${k.label}`);
    if (k.historical && k.label !== "Chính sử") e(`${k.id}: thẻ lịch sử phải là Chính sử`);
    if (!k.historical && k.label !== "Hư cấu") e(`${k.id}: kế khác phải là Hư cấu`);
    for (const f of ["text", "reply"]) if (!k[f]?.vi || !k[f]?.en) e(`${k.id}: thiếu ${f} vi/en`);
    if (/người xưa|ancients/i.test(tx(k.text, "vi") + tx(k.text, "en"))) e(`${k.id}: chữ trên thẻ lộ "người xưa"`);
  }
  return errs;
}

// Xáo vị trí thẻ (Fisher–Yates); rng() ∈ [0, 1). Trả mảng mới, không đổi dữ liệu gốc.
export function shuffleCards(cards, rng = Math.random) {
  const a = cards.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export function councilResult(council, pickedId) {
  const card = council.cards.find((k) => k.id === pickedId);
  if (!card) throw new Error("không có thẻ " + pickedId);
  return { picked: card.id, historical: !!card.historical };
}

// Comic sau Hiến kế: bóng from:"reply" nhận lời đáp của kế đã chọn (Hư cấu), bóng from:"decree" nhận lệnh Chủ soái quyết.
// Trả bản sao (không đổi COMIC_*). ui/comic.js bỏ qua bóng còn trường from, nên đọc lại ở Sử quán không có Hiến kế thì
// khung D1 chỉ còn hình (đúng như bản VS của B15).
export function applyCouncil(comic, pickedId, council = comic.council) {
  const card = council.cards.find((k) => k.id === pickedId);
  if (!card) return comic;
  const panels = {};
  for (const [id, p] of Object.entries(comic.panels)) {
    if (!(p.bubbles || []).some((b) => b.from)) { panels[id] = p; continue; }
    panels[id] = {
      ...p,
      bubbles: p.bubbles.map((b) => {
        if (b.from === "reply") { const { from, ...r } = b; return { ...r, vi: card.reply.vi, en: card.reply.en, label: b.label || "Hư cấu" }; }
        if (b.from === "decree") { const { from, ...r } = b; return { ...r, vi: council.decree.vi, en: council.decree.en }; }
        return b;
      }),
    };
  }
  return { ...comic, panels };
}

// người đáp: tên ở bóng from:"reply" của comic (B20: "Trần Hưng Đạo")
export function councilSpeaker(comic) {
  for (const p of Object.values(comic?.panels || {})) for (const b of p.bubbles || []) if (b.from === "reply" && b.who) return b.who;
  return "Chủ soái";
}

// ---- màn hình ----------------------------------------------------------------------------------------------------

export function runCouncil({ council, comic = null, settings = {}, replay = false, tutorial = false, rng = Math.random, marks = null,
  bgPanel = "O7", onSettings, onComic = null } = {}) {
  const errs = councilErrors(council);
  if (errs.length) { console.error("Hiến kế: " + errs.join("; ")); return Promise.resolve({ picked: null, historical: false, error: errs }); }
  return new Promise((resolve) => {
    let lang = settings.comicLang === "en" ? "en" : "vi";
    const t = () => T[lang];
    const motion = settings.motion !== false;
    const cards = shuffleCards(council.cards, rng);
    const who = councilSpeaker(comic);
    let stage = tutorial ? "tut" : "pick", picked = null, focus = 0, kbd = false, entered = false, done = false, busy = false, sawComic = false;
    const armedAt = performance.now() + 400;      // phím/nút đang giữ lúc mở không chọn nhầm
    const armed = () => performance.now() >= armedAt;
    // giữ chỗ đang focus TRƯỚC khi bỏ focus (trước đây blur rồi mới lưu → luôn lưu <body>, không trả focus được)
    const prevFocus = document.activeElement;
    document.activeElement?.blur?.();

    // bóng thoại dùng chữ viết tay như comic (ui/comic.js cũng nạp; nạp ở đây nếu Hiến kế mở trước comic)
    if (!document.querySelector('link[href*="Patrick+Hand"]')) {
      const l = document.createElement("link"); l.rel = "stylesheet";
      l.href = "https://fonts.googleapis.com/css2?family=Patrick+Hand&display=swap&subset=vietnamese";
      document.head.appendChild(l);
    }
    const el = document.createElement("div");
    document.body.appendChild(el);
    const bg = comic && comic.panels?.[bgPanel] ? `./assets/comic/${comic.chapter.id}/${bgPanel}.webp` : null;

    function cardHTML(k, i) {
      const after = stage !== "pick" && stage !== "tut";
      const isPick = picked === k.id, showOld = k.historical && (replay || after);
      const cls = ["cc-card", isPick ? "sel" : "", after && !isPick ? "dim" : "", kbd && focus === i && stage === "pick" ? "focus" : ""].filter(Boolean).join(" ");
      return `<button class="${cls}" data-k="${esc(k.id)}" ${after ? "disabled" : ""} style="--i:${i}">
        <span class="cc-n">${i + 1}</span>
        <span class="cc-text">${esc(tx(k.text, lang))}</span>
        <span class="cc-tags">${after ? `<span class="clabel ${LCLS[k.label]}">${esc(k.label)}</span>` : ""}${showOld ? `<span class="cc-old">${t().old}</span>` : ""}${after && isPick ? `<span class="cc-you">${t().you}</span>` : ""}</span>
      </button>`;
    }

    function render() {
      el.className = `council s-${stage}${motion ? "" : " nomotion"}${stage === "pick" && !entered ? " enter" : ""}`;
      if (stage === "pick") entered = true;          // thẻ chỉ bay vào một lần, đổi focus không chạy lại
      const k = picked && council.cards.find((c) => c.id === picked);
      const marksTxt = marks?.length ? marks.map((m) => `<b>${esc(m)}</b>`).join(", ") : t().marksDefault;
      el.innerHTML = `${bg ? `<div class="cc-bg" style="background-image:url(${bg})"></div>` : ""}
        <div class="cc-bar"><div class="cc-title">${esc(tx(council.title, lang))}</div>${onComic ? `<button data-c="comic">${t().comic}</button>` : ""}<button data-c="lang">${lang === "vi" ? "EN" : "VI"}</button></div>
        <div class="cc-main"><div class="cc-in">
          <div class="cc-head"><div class="seal">${t().seal}</div><p class="cc-prompt">${esc(tx(council.prompt, lang))}</p></div>
          <div class="cc-cards" role="group" aria-label="${t().pick}">${cards.map(cardHTML).join("")}</div>
          ${k ? `<div class="cc-reply at${cards.indexOf(k)}"><div class="cc-bub"><span class="who">${esc(who)}</span>${esc(tx(k.reply, lang))}</div><span class="cc-fmark">${t().fiction}</span></div>` : ""}
          ${stage === "decree" ? `<div class="cc-decree"><div class="cc-dh">${t().decreeHead}<span class="clabel cs">Chính sử</span></div>
            <p class="cc-dtext">${esc(tx(council.decree, lang))}</p>
            <p class="cc-res">${k.historical ? t().right(marksTxt) : t().wrong}${replay && !k.historical ? ` ${t().replayNote}` : ""}</p>
            <p class="cc-same">${t().same}</p></div>` : ""}
          <div class="cc-nav">${stage === "pick" ? `<span class="small">${t().pick} · 1–3</span>` : stage === "reply" ? `<button class="primary" data-c="next">${t().go} ›</button>` : stage === "decree" ? `<button class="primary" data-c="next">${t().done} ›</button>` : ""}</div>
        </div></div>
        ${stage === "tut" ? `<div class="cc-tut"><div class="cc-tcard"><div class="cc-thead"><div class="seal">${t().seal}</div><h2>${t().tutTitle}</h2></div>
          <ol>${t().tut.map((s) => `<li>${s}</li>`).join("")}</ol>
          <div class="row center"><button class="primary" data-c="tutok">${t().tutOk}</button></div></div></div>` : ""}`;
      el.querySelectorAll("[data-k]").forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); choose(b.dataset.k); }));
      el.querySelectorAll("[data-c]").forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); act(b.dataset.c); }));
      // màn thấp (điện thoại, PC 720p khi đã hiện lệnh): kéo nút Tiếp vào tầm nhìn
      if (stage === "reply" || stage === "decree") el.querySelector(".cc-nav")?.scrollIntoView?.({ block: "end", behavior: motion ? "smooth" : "auto" });
    }

    function choose(id) {
      if (stage !== "pick" || done || !armed()) return;
      picked = id; stage = "reply"; render();
    }
    function act(c) {
      if (c === "lang") { lang = lang === "vi" ? "en" : "vi"; settings.comicLang = lang; onSettings?.(); render(); return; }
      if (c === "comic") { watchComic(); return; }
      if (!armed()) return;
      if (c === "tutok" && stage === "tut") { stage = "pick"; render(); }
      else if (c === "next" && stage === "reply") { stage = "decree"; render(); }
      else if (c === "next" && stage === "decree") finish();
    }
    // "Xem comic" (chơi lại): tắt phím/tay cầm của hội đồng trong lúc comic chạy (comic có phím riêng), rồi bật lại
    function watchComic() {
      if (!onComic || busy || done) return;
      busy = true; sawComic = true;
      removeEventListener("keydown", onKey, true);
      el.style.visibility = "hidden";
      Promise.resolve().then(onComic).catch((e) => console.error(e)).finally(() => {
        busy = false; el.style.visibility = "";
        if (!done) { addEventListener("keydown", onKey, true); render(); }
      });
    }
    function move(d) { if (stage !== "pick") return; kbd = true; focus = (focus + d + cards.length) % cards.length; render(); }
    function primary() {
      if (stage === "tut") act("tutok");
      else if (stage === "pick") choose(cards[focus].id);
      else act("next");
    }

    const onKey = (e) => {
      if (done || busy) return;
      e.stopPropagation();
      const k = e.key;
      if (["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", " ", "Enter"].includes(k)) e.preventDefault();
      if (e.repeat) return;
      if (/^[1-3]$/.test(k) && stage === "pick") choose(cards[Number(k) - 1]?.id);
      else if (k === "ArrowRight" || k === "ArrowDown") move(1);
      else if (k === "ArrowLeft" || k === "ArrowUp") move(-1);
      else if (k === "Enter" || k === " ") primary();
    };
    // tay cầm: bắt cạnh nhấn; nút đang giữ lúc mở không tính
    let raf = 0; const padPrev = {};
    for (const gp of navigator.getGamepads?.() || []) if (gp) for (const bi of [0, 14, 15]) padPrev[gp.index + ":" + bi] = !!gp.buttons[bi]?.pressed;
    const poll = () => {
      raf = requestAnimationFrame(poll);
      if (busy) { for (const k in padPrev) padPrev[k] = true; return; }    // nút đang giữ khi comic đóng không tính
      for (const gp of navigator.getGamepads?.() || []) {
        if (!gp) continue;
        for (const [bi, f] of [[0, primary], [14, () => move(-1)], [15, () => move(1)]]) {
          const on = !!gp.buttons[bi]?.pressed, key = gp.index + ":" + bi;
          if (on && !padPrev[key]) f();
          padPrev[key] = on;
        }
      }
    };

    function finish() {
      if (done) return; done = true;
      cancelAnimationFrame(raf);
      removeEventListener("keydown", onKey, true);
      el.classList.add("out");
      setTimeout(() => el.remove(), 250);
      if (prevFocus?.isConnected && prevFocus !== document.body) prevFocus.focus?.();
      resolve(sawComic ? { ...councilResult(council, picked), comic: true } : councilResult(council, picked));
    }

    render();
    addEventListener("keydown", onKey, true);
    raf = requestAnimationFrame(poll);
  });
}
