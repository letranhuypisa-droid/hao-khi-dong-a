// battle/hud.js — HUD bằng DOM trên canvas (S3.12, S5.8). Thanh Hào Khí có mốc 25/50/75/100,
// bản đồ nhỏ vẽ canvas 2D, vòng Mệnh Lệnh 4 ô (đồng hồ trận ×0,2 khi mở, S5.7).
//
// Nhiều trận, nhiều tướng (đợt 9 lõi): dữ liệu trận lấy từ ctx.battle (BattleDef, battles/b15.js): data.PHASES / FRONTS /
// EVENTS, hud.bounds + hud.drawBase / hud.drawTop (bản đồ nhỏ), hud.frontsHTML (bảng mặt trận), par. Tướng lấy từ
// ctx.hero: def (tên, chân dung), kiBars (số vạch Khí Lực), skillSlots() (ô kỹ năng), ultInfo() (ô Tuyệt Kỹ),
// nextHeavyInfo() (ô C). Thiếu móc nào thì dùng đúng cách của B15 / H35 như trước.
// Ô chung cho widget của trận khác (B15 không gọi): setTopWidget (dưới thanh Hào Khí), setPanel (cột phải, dưới bảng Kế
// Sách), prompt (nhắc tương tác giữa đáy màn, vòng giữ phím), picker (chọn ≤ 4 điểm đến bằng phím 1–4 / chạm).

import { ORDERS, HERO, MODES, TERRAIN } from "../data/tuning.js";
import { totalQ, supplyOpen } from "../sim/front.js";
import { tpcReady } from "../sim/haokhi.js";
import { heroTerrain } from "../sim/terrain-rules.js";
import { MOVE_INFO, ICON, nextHeavy } from "../data/moves-info.js";
import { short } from "../data/controls.js";
import { placeWaypoint } from "./waypoint.js";
import { compactMsg, logMsgs } from "../ui/layout.js";

// HUD gọn (đợt 13, css/hud.css; khung trận mang lớp .compact khi cảm ứng hoặc khung hẹp — battle.js syncCompact): thẻ nhiệm vụ
// thành một dòng (chạm để mở đủ 5 s), tin nhắn chỉ một tin ở mép trên (tự tắt sau 5 s; sổ tin đọc lại ở bảng tạm dừng), bản đồ
// nhỏ chạm để mở to kèm bảng mặt trận, Kế Sách và bảng riêng của trận (B20) gom vào ngăn "Tình hình" mở bằng nút có số báo.
const OPEN_SEC = 5;

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const ORDER_KEYS = ["tiencong", "giuvung", "theota", "tiepvien"];
const B15_BOUNDS = { x0: 0, x1: 600, z0: -200, z1: 200 };       // bản đồ nhỏ mặc định: Hàm Tử 600 × 400 m
const SLOT_TILE = ["sk1", "sk5"];                               // ô kỹ năng 1 (E), ô kỹ năng 2 (T)
const SLOT_KEY = [short("skill"), short("skill2")];

// Ô kỹ năng của tướng: mảng từ hero.skillSlots() (C2), không có thì null (đường H35 cũ: một ô Phá Trận).
// Mỗi ô: { id, name, icon?, key?, ready?, cd?, text? } — thiếu trường nào thì suy ra như dưới.
const heroSlots = (h) => { const s = h?.skillSlots?.(); return Array.isArray(s) && s.length ? s.slice(0, 2) : null; };

export class HUD {
  constructor(root, ctx) {
    this.root = root; this.ctx = ctx; ctx.hud = this;
    const B = this.B = ctx.battle || {}, H = B.hud || {}, hero = ctx.hero, hd = hero?.def;
    const mode = ctx.mode || "nhanh", par = B.par?.[mode] ?? MODES[mode].par;
    this.parSec = par;
    const nKi = hero?.kiBars ?? HERO.kiLucBars;
    this.nKi = nKi;
    this.slots = heroSlots(hero);
    const cv = H.canvas || { w: 240, h: 160 };
    this.mapW = cv.w; this.mapH = cv.h;
    // H.pinTip (B15): thẻ nhiệm vụ nằm cột trái cùng khung tin và giữ câu "làm thế nào" của pha suốt pha (trước đây câu đó hiện 7 s
    // rồi mất). Trận khác (B20) giữ bố cục đã chỉnh tay của nó.
    const pin = this.pin = !!H.pinTip;
    if (pin) root.classList.add("hud-pin");
    const card = `<div class="hud-phase"><b data-k="phase"></b><span data-k="goal"></span>${pin ? `<small data-k="tip"></small>` : ""}</div>`;
    root.innerHTML = `
      <div class="fx-hurt"></div><div class="fx-gold"></div><div class="fx-flash"></div><div class="fx-speed" data-k="speed"></div>
      <div class="hud-combo" data-k="combo"><b data-k="combon">0</b><span>ĐÒN LIÊN HOÀN</span></div>
      <div class="hud-top">
        ${pin ? "" : card}
        <div class="hk">
          <div class="hk-label"><span data-k="hklabel">HÀO KHÍ</span><b data-k="hkv">0</b></div>
          <div class="hk-bar"><div class="hk-fill" data-k="hkfill"></div><div class="hk-over" data-k="hkover"></div>
            <i style="left:25%"></i><i style="left:50%"></i><i style="left:75%"></i></div>
          <div class="hk-state" data-k="hkstate"></div>
          <div class="hk-widget" data-k="topw" hidden></div>
        </div>
        <div class="hud-time"><b data-k="time">0:00</b><span>${MODES[mode].name} · par ${fmt(par)}</span><small class="hud-kos" data-k="kos"></small></div>
      </div>
      <div class="hud-hero">
        <div class="portrait"><span>${hd?.portrait ?? "H35"}</span><em data-k="lv"></em></div>
        <div class="bars">
          <div class="name">${hd?.name ?? HERO.name} <small data-k="rev"></small></div>
          <div class="bar hp"><div data-k="hp"></div><span data-k="hpt"></span></div>
          <div class="bar hpo" data-k="hpo" hidden><div data-k="hpof"></div></div>
          <div class="ki">${Array.from({ length: nKi }, (_, i) => `<div class="bar kb"><div data-k="ki${i}"></div></div>`).join("")}</div>
          <div class="buffs" data-k="buffs"></div>
          <div class="ttags"><span class="ttag" data-k="ttag"></span><span class="ttag mud" data-k="tmud"></span></div>
        </div>
      </div>
      <div class="hud-map"><canvas width="${cv.w}" height="${cv.h}" data-k="map"${H.canvas ? ` style="width:${cv.w}px;height:${cv.h}px"` : ""}></canvas>
        <div class="fronts" data-k="fronts"></div>
      </div>
      ${pin ? `<div class="hud-left" data-k="left">${card}<div class="hud-msgs" data-k="msgs"></div></div>` : `<div class="hud-msgs" data-k="msgs"></div>`}
      <div class="hud-events" data-k="events"></div>
      <div class="hud-ks" data-k="ks"></div>
      <button class="hud-sit" data-k="sit" hidden aria-label="Tình hình: Kế Sách và bảng của trận"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h12v16H6z"/><path d="M9 8h6M9 12h6M9 16h4"/></svg><em data-k="sitn"></em></button>
      <div class="hud-target" data-k="target"><div class="tname" data-k="tname"></div><div class="bar thp"><div data-k="thp"></div></div><div class="bar tpo"><div data-k="tpo"></div></div></div>
      <div class="hud-hint" data-k="hint"></div>
      <div class="hud-ko"><b data-k="ko">0</b><span>KO</span></div>
      ${skillBarHTML(true, this.slots, hero?.ultInfo?.())}
      <div class="ring" data-k="ring">
        <div class="ring-title">MỆNH LỆNH · <span data-k="ringfront"></span> <small>(Z / chạm để đổi mặt trận)</small></div>
        <div class="ring-grid">${ORDER_KEYS.map((k, i) => `<button data-order="${k}"><img class="ric" src="${ICON(MOVE_INFO[k].icon)}" alt=""><b>${i + 1}</b><span>${ORDERS[k].name}</span><i data-k="cd_${k}"></i></button>`).join("")}</div>
        <div class="ring-foot" data-k="ringfoot"></div>
      </div>
      <div class="hud-prompt" data-k="prompt" hidden><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" class="bg"></circle><circle cx="18" cy="18" r="15" class="fg" data-k="promptring"></circle></svg><span data-k="prompttext"></span></div>
      <div class="hud-picker" data-k="picker" hidden></div>
      <div class="hud-wp" data-k="wp" hidden><div class="wp-in"><div class="wp-box"><i class="wp-dir" data-k="wpdir"></i><div><b data-k="wpname"></b><span data-k="wpdist"></span></div></div><i class="wp-tip"></i></div></div>
      <div class="hud-wp alt" data-k="wp2" hidden><div class="wp-in"><div class="wp-box"><i class="wp-dir" data-k="wp2dir"></i><div><b data-k="wp2name"></b><span data-k="wp2dist"></span></div></div><i class="wp-tip"></i></div></div>
      <div class="hud-lockhint" data-k="lockhint" hidden></div>
      <div class="cine" data-k="cine"></div>
      <div class="lockmark" data-k="lockmark">◆</div>`;
    this.el = {};
    root.querySelectorAll("[data-k]").forEach((n) => (this.el[n.dataset.k] = n));
    this.sk1Key = this.el.sk1?.querySelector("b")?.textContent ?? "";           // chữ phím ô kỹ năng 1, trả lại khi lớp cảm ứng tắt
    this.mapCtx = this.el.map.getContext("2d");
    this.ringFront = "A";
    this.el.ringfront.addEventListener("pointerdown", () => this.swapFront());
    root.querySelectorAll("[data-order]").forEach((b) => b.addEventListener("pointerdown", (e) => { e.stopPropagation(); this.issue(b.dataset.order); }));
    this.t = 0; this.pulse = 0;
    this.ringOpen = false; this.lastCombo = 0; this.nextC = "";
    this.panels = new Map(); this.topHtml = null; this.promptKey = null;
    this.pickerOpen = false; this.pickItems = null; this.onPick = null;
    // HUD gọn: sổ tin, thẻ nhiệm vụ mở tạm, ngăn Tình hình, bản đồ to (chỉ bấm được khi .compact — css/hud.css bật pointer-events)
    this.log = []; this.seenMsgs = new WeakSet(); this.openT = 0;
    const card0 = this.el.phase.parentElement;
    card0.addEventListener("pointerdown", (e) => { e.stopPropagation(); this.openCard(this.openT <= 0); });
    root.querySelector(".hud-map").addEventListener("pointerdown", (e) => { e.stopPropagation(); this.toggleMap(); });
    this.el.sit.addEventListener("pointerdown", (e) => { e.stopPropagation(); this.toggleSit(); });
  }
  get compact() { return !!this.root.parentElement?.classList.contains("compact"); }
  // thẻ nhiệm vụ một dòng → mở đủ (mục tiêu, câu "làm thế nào") OPEN_SEC giây; chạm lần nữa thì gập
  // mở cái này thì gập hai cái kia (thẻ nhiệm vụ, bản đồ to, ngăn Tình hình chồng lên nhau ở giữa / bên phải màn)
  openCard(on) { this.openT = on ? OPEN_SEC : 0; this.el.phase.parentElement.classList.toggle("open", on); if (on) { this.root.classList.remove("bigmap", "sit-open"); } }
  toggleMap(on = !this.root.classList.contains("bigmap")) { this.root.classList.toggle("bigmap", on); if (on) { this.root.classList.remove("sit-open"); if (this.openT > 0) this.openCard(false); } this.ctx.audio?.play?.("ui"); }
  toggleSit(on = !this.root.classList.contains("sit-open")) { this.root.classList.toggle("sit-open", on); if (on) { this.root.classList.remove("bigmap"); if (this.openT > 0) this.openCard(false); } }
  // vệt tốc độ quanh mép màn (Phá Trận, Tuyệt Kỹ)
  speedLines(T) { const e = this.el.speed; e.classList.remove("on"); void e.offsetWidth; e.style.animationDuration = `${T}s`; e.classList.add("on"); }

  // Z / chạm tên mặt trận: vòng qua mọi mặt trận của trận (B15: A ↔ B)
  swapFront() {
    const ids = Object.keys(this.B.data?.FRONTS || {});
    if (!ids.length) return;
    this.ringFront = ids[(ids.indexOf(this.ringFront) + 1) % ids.length];
  }
  issue(k) { this.ctx.director.order(this.ringFront, k); this.ctx.audio.play("ui"); this.onIssue?.(k); }   // onIssue: lớp cảm ứng đóng vòng lệnh (battle.js buildTouch)
  setRing(open) {
    if (open && !this.ringOpen) this.ringFront = this.ctx.sim.heroFront || this.ctx.director.lastFront;
    this.ringOpen = open; this.el.ring.classList.toggle("on", open);
  }
  // Thẻ nhiệm vụ nháy khi sang pha mới (và lúc vào trận): mắt kéo về mục tiêu và câu "làm thế nào".
  phaseFlash() {
    const c = this.el.phase?.parentElement; if (!c) return;
    c.classList.remove("flash"); void c.offsetWidth; c.classList.add("flash");
  }
  // Nhắc khóa chuột (bàn phím + chuột): cú bấm đầu, và cú bấm đầu sau khi tạm dừng, chỉ khóa chuột chứ chưa ra đòn. Trình duyệt từ chối
  // khóa hai lần liền (input.lockFails) thì đổi sang nhắc xoay camera bằng phím ← →.
  lockHint(ctx, d) {
    const E = this.el, inp = ctx.input;
    const msg = !document.pointerLockElement && !ctx.touch && !d.over && inp && inp.enabled !== false && !inp.pad      // tay cầm không cần khóa chuột
      ? (inp.lockFails >= 2 ? "Trình duyệt không cho khóa chuột — xoay camera bằng phím ← →." : "Bấm vào màn hình để khóa chuột: chuột xoay camera, chuột trái / phải ra đòn.") : "";
    if (msg === this.lockMsg) return;
    this.lockMsg = msg; E.lockhint.hidden = !msg; E.lockhint.textContent = msg;
  }
  // Vùng HUD mà nhãn chỉ đường phải tránh (cột trái: thẻ nhiệm vụ + tin; bản đồ nhỏ + bảng mặt trận), đo ở nhịp 0,05 s thay vì mỗi khung.
  // HUD gọn: cột trái là display: contents (khung 0 × 0) nên đo từng mảnh — thẻ nhiệm vụ, tin, nút Tình hình, cụm nút cảm ứng,
  // cần điều khiển, thanh máu.
  measureAvoid() {
    const base = this.root.getBoundingClientRect(), out = [], st = this.root.parentElement;
    const list = [this.el.left, this.el.phase.parentElement, this.el.msgs, this.root.querySelector(".hud-map"), this.el.events, this.el.ks, this.el.sit];
    if (this.compact && st) list.push(st.querySelector(".touch.on .tbtns"), st.querySelector(".touch.on .stick"), st.querySelector(".touch.on .tsys"), this.root.querySelector(".hud-hero"));
    for (const n of list) {
      if (!n) continue;
      const r = n.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;      // bảng sự kiện / Kế Sách rỗng thì cao 0
      const l = r.left - base.left;
      out.push({ l, r: r.right - base.left, t: r.top - base.top, b: r.bottom - base.top, side: l + r.width / 2 < base.width / 2 ? "l" : "r" });
    }
    this.avoid = out;
  }
  // Nhãn chỉ đường tới mục tiêu chính của pha (director.objectives()). Gọi mỗi khung hình sau khi vẽ (battle.js) để nhãn bám mục tiêu
  // khi xoay camera: nổi trên mục tiêu khi nó nằm trong màn hình; ở sau lưng hoặc ngoài khung thì ra rìa màn hình kèm mũi tên;
  // tắt khi tướng đã vào vòng chiếm. Tự tránh thẻ nhiệm vụ, khung tin và bản đồ nhỏ. Trận không có objectives() (B20) thì không hiện.
  frame(W, H) {
    const E = this.el, ctx = this.ctx, d = ctx.director, hero = ctx.hero;
    const list = d.objectives && hero.alive && !d.over ? d.objectives() : null;
    let best = null, bd = Infinity;
    for (const o of list || []) { const dd = Math.hypot(o.x - hero.x, o.z - hero.z); if (dd < bd) { bd = dd; best = o; } }
    if (!best || bd < best.r) { if (!E.wp.hidden) E.wp.hidden = true; this.frameBlocker(W, H, null); return; }
    const yaw = ctx.cam.yaw, fx = Math.sin(yaw), fz = Math.cos(yaw), dx = best.x - hero.x, dz = best.z - hero.z;
    const fwd = dx * fx + dz * fz, rgt = -dx * fz + dz * fx;      // phải của camera = (−cos, sin)
    const w = placeWaypoint({ W, H, fwd, rgt, p: fwd > 0 ? ctx.project(best.x, best.y + 9, best.z) : null, half: this.wpHalf || 90, avoid: this.avoid || [] });   // hình học: waypoint.js
    if (E.wp.hidden) E.wp.hidden = false;
    if (E.wp.dataset.mode !== w.mode) E.wp.dataset.mode = w.mode;
    E.wp.style.transform = `translate(${Math.round(w.x)}px, ${Math.round(w.y)}px)`;
    E.wpdir.style.transform = `rotate(${Math.round(w.rot)}deg)`;
    if (best.label !== this.wpName) { this.wpName = best.label; E.wpname.textContent = best.label; this.wpHalf = 0; }
    if (!this.wpHalf) this.wpHalf = Math.max(60, ((E.wp.querySelector(".wp-box").offsetWidth || 180) + 26) / 2);       // đo lại khi đổi chữ
    const dist = `${Math.round(bd)} m`;
    if (dist !== this.wpDist) { this.wpDist = dist; E.wpdist.textContent = dist; }
    this.frameBlocker(W, H, w);
  }
  // Nhãn thứ hai (đợt 12b): con lính đồn trú cuối cùng còn chặn việc chiếm (director.blockers(), còn ≤ GARRISON.pointLast người). Cùng hình học với nhãn mục
  // tiêu (waypoint.js) nhưng tránh luôn khung của nhãn đó; nổi trên đầu con lính khi thấy, ra rìa màn hình kèm mũi tên khi nó ở sau lưng hoặc ngoài khung.
  // Trận không có blockers() (B20) thì không hiện.
  frameBlocker(W, H, prim) {
    const E = this.el, ctx = this.ctx, d = ctx.director, hero = ctx.hero;
    const list = E.wp2 && d.blockers && hero.alive && !d.over ? d.blockers() : null, b = list && list[0];
    if (!b) { if (E.wp2 && !E.wp2.hidden) E.wp2.hidden = true; return; }
    const yaw = ctx.cam.yaw, fx = Math.sin(yaw), fz = Math.cos(yaw), dx = b.x - hero.x, dz = b.z - hero.z;
    const fwd = dx * fx + dz * fz, rgt = -dx * fz + dz * fx, half = this.wp2Half || 70;
    const avoid = this.avoid || [];
    const first = prim ? [{ l: prim.x - (this.wpHalf || 90), r: prim.x + (this.wpHalf || 90), t: prim.y - 62, b: prim.y + 14, side: "r" }] : [];
    const w = placeWaypoint({ W, H, fwd, rgt, p: fwd > 0 ? ctx.project(b.x, b.y + 2.6, b.z) : null, half, avoid: [...avoid, ...first] });
    if (E.wp2.hidden) E.wp2.hidden = false;
    if (E.wp2.dataset.mode !== w.mode) E.wp2.dataset.mode = w.mode;
    E.wp2.style.transform = `translate(${Math.round(w.x)}px, ${Math.round(w.y)}px)`;
    E.wp2dir.style.transform = `rotate(${Math.round(w.rot)}deg)`;
    if (b.label !== this.wp2Name) { this.wp2Name = b.label; E.wp2name.textContent = b.label; this.wp2Half = 0; }
    if (!this.wp2Half) this.wp2Half = Math.max(50, ((E.wp2.querySelector(".wp-box").offsetWidth || 120) + 26) / 2);
    const dist = `${Math.round(Math.hypot(dx, dz))} m`;
    if (dist !== this.wp2Dist) { this.wp2Dist = dist; E.wp2dist.textContent = dist; }
  }
  hkPulse(g) { this.pulse = 0.6; this.el.hkv.dataset.delta = (g > 0 ? "+" : "") + Math.round(g); }

  // ---- ô chung cho widget của trận (B15 không dùng) ------------------------------------------------------------
  // Dưới thanh Hào Khí (vd đồng hồ Con nước của B20). html null: ẩn.
  setTopWidget(html) {
    const e = this.el.topw;
    if (html == null) { if (this.topHtml !== null) { e.hidden = true; e.innerHTML = ""; this.topHtml = null; } return; }
    if (html !== this.topHtml) { e.innerHTML = html; this.topHtml = html; }
    e.hidden = false;
  }
  // Bảng ở cột phải, xếp dưới bảng Kế Sách theo thứ tự đặt (vẽ ở lần cập nhật HUD kế, ≤ 0,05 s). html null: bỏ.
  setPanel(id, html) { if (html == null) this.panels.delete(id); else this.panels.set(id, html); }
  // Nhắc tương tác giữa đáy màn (vd "Giữ X · Chiếm thuyền") với vòng tiến độ giữ phím p ∈ [0, 1]. text null: ẩn.
  prompt(text, p = 0) {
    const E = this.el;
    if (text == null) { if (this.promptKey !== null) { E.prompt.hidden = true; this.promptKey = null; } return; }
    if (text !== this.promptKey) { E.prompttext.textContent = text; this.promptKey = text; }
    E.prompt.hidden = false;
    E.promptring.style.strokeDashoffset = String(94.25 * (1 - Math.max(0, Math.min(1, p))));
    E.prompt.classList.toggle("full", p >= 1);
  }
  // Chọn điểm đến: items [{ id, label, sub?, icon?, svg?, kind? }] (tối đa 4), phím 1–4 (battle.js chuyển cmd1–4 vào pick khi
  // đang mở, đồng hồ trận ×0,2 như vòng lệnh) hoặc chạm. Chọn xong gọi onPick(item) rồi tự đóng. items null: đóng.
  // icon: id ảnh assets/icons; svg: hình vẽ sẵn (chuỗi <svg>, vd thuyền / bè / bến của B20); kind → data-kind để tô CSS.
  picker(items, onPick = null, title = "Chọn nơi đến") {
    const E = this.el;
    if (!items || !items.length) { this.pickerOpen = false; this.pickItems = null; this.onPick = null; E.picker.hidden = true; E.picker.innerHTML = ""; return; }
    this.pickItems = items.slice(0, 4); this.onPick = onPick; this.pickerOpen = true;
    E.picker.innerHTML = `<div class="pk-title">${title}</div>` + this.pickItems.map((it, i) =>
      `<button data-pick="${i}"${it.kind ? ` data-kind="${it.kind}"` : ""}>${it.svg ? `<i class="pk-ic">${it.svg}</i>` : it.icon ? `<img src="${ICON(it.icon)}" alt="">` : ""}<b>${i + 1}</b><span>${it.label}</span>${it.sub ? `<small>${it.sub}</small>` : ""}</button>`).join("");
    E.picker.hidden = false;
    E.picker.querySelectorAll("[data-pick]").forEach((b) => b.addEventListener("pointerdown", (e) => { e.stopPropagation(); this.pick(Number(b.dataset.pick)); }));
  }
  pick(i) {
    const it = this.pickItems?.[i]; if (!it) return false;
    const cb = this.onPick; this.picker(null); this.ctx.audio?.play("ui"); cb?.(it);
    return true;
  }

  update(dt, w, h) {
    const ctx = this.ctx, hero = ctx.hero, d = ctx.director, sim = ctx.sim, hk = ctx.hk, E = this.el;
    const fm = (s) => (ctx.fmt ? ctx.fmt(s) : s);                       // {tpc}, {Act:cmd}… → phím của thiết bị đang dùng (data/controls.js)
    const data = this.B.data || {}, PH = data.PHASES || [], FRONTS = data.FRONTS || {}, EVENTS = data.EVENTS || {};
    this.t += dt; this.pulse = Math.max(0, this.pulse - dt);
    const P = PH[Math.min(d.phase, PH.length - 1)];
    E.phase.textContent = P ? `${P.id} · ${P.name}` : "";
    E.goal.textContent = d.baseHint || P?.goal || "";
    if (P && P.id !== this.phaseId) { this.phaseId = P.id; this.phaseFlash(); }
    if (E.tip) {                                              // câu "làm thế nào" của pha, chữ phím theo thiết bị đang dùng
      const tip = P?.tip ? fm(P.tip) : "";
      if (tip !== this.tipText) { this.tipText = tip; E.tip.textContent = tip; }
    }
    this.lockHint(ctx, d);
    this.measureAvoid();
    E.time.textContent = fmt(d.time);
    E.time.classList.toggle("late", d.time > (d.M?.par ?? this.parSec));
    // Hào Khí — trận có hud.hkView (chế độ Tự do dưới bậc Tướng) thì dải này là Danh tiếng: { label, value, pct, state }
    const hv = this.B.hud?.hkView?.(ctx);
    if (hv) {
      if (E.hklabel.textContent !== hv.label) { E.hklabel.textContent = hv.label; E.hkover.style.width = "0"; E.hkfill.parentElement.classList.add("rep"); }
      E.hkv.textContent = hv.value; E.hkfill.style.width = `${hv.pct}%`; E.hkstate.textContent = hv.state;
    } else {
      E.hkv.textContent = Math.floor(hk.value);
      E.hkfill.style.width = `${hk.value}%`;
      E.hkover.style.width = `${(hk.overflow / 30) * 100}%`;
      E.hkfill.parentElement.classList.toggle("ready", tpcReady(hk));
      E.hkfill.parentElement.classList.toggle("tpc", hk.tpc);
      E.hkv.classList.toggle("pulse", this.pulse > 0);
      E.hkstate.textContent = hk.tpc ? `TỔNG PHẢN CÔNG · ${Math.ceil(hk.tpcLeft)} s` : tpcReady(hk) ? fm("Sẵn sàng · bấm {tpc}") : hk.overflow > 0 ? `dư ${Math.floor(hk.overflow)}` : "";
    }
    // tướng
    E.lv.textContent = `Cấp ${ctx.stats.level}`;
    E.hp.style.width = `${(hero.hp / hero.maxHp) * 100}%`;
    E.hpt.textContent = `${Math.ceil(hero.hp)} / ${Math.round(hero.maxHp)}`;
    E.hp.parentElement.classList.toggle("low", hero.hp / hero.maxHp < 0.3);
    const per = hero.def?.kiLucPerBar ?? HERO.kiLucPerBar ?? 100;                                   // Khí Lực mỗi vạch theo tướng (H35: 100)
    for (let i = 0; i < this.nKi; i++) E["ki" + i].style.width = `${Math.max(0, Math.min(100, (hero.ki - per * i) / per * 100))}%`;
    E.rev.textContent = hero.revives > 0 ? `· Gượng dậy ×${hero.revives}` : "";
    // thanh Phá Thế của người lính (chế độ Tự do, từ Đội trưởng): đòn nhẹ trừ thanh thay vì làm khựng
    if (hero.poiseMax > 0) { if (E.hpo.hidden) E.hpo.hidden = false; E.hpof.style.width = `${(hero.poise / hero.poiseMax) * 100}%`; }
    // ô / nút chưa mở theo bậc (người lính): ẩn ô Phá Trận, Mệnh Lệnh; làm mờ ô Tuyệt Kỹ
    if (hero.locked) {
      if (E.sk1) E.sk1.style.display = hero.locked("skill") ? "none" : "";
      if (E.sk4) E.sk4.style.display = hero.locked("cmd") ? "none" : "";
      if (E.sk2) E.sk2.classList.toggle("locked", hero.locked("ult"));
    }
    const buffs = [];
    if (hero.buffs.atk) buffs.push(`Cờ lệnh ${Math.ceil(hero.buffs.atkT)}s`);
    if (hero.buffs.flag) buffs.push(`Dưới cờ: đánh lính +${Math.round(hero.buffs.flag * 100)}%`);   // cờ Tuyệt Kỹ không cộng vào đòn lên sĩ quan, Toa Đô (đợt 9)
    if (hero.lienHoan) buffs.push(`Liên hoàn ×${hero.lienHoan}`);
    if (hero.chargeLevel > 0) buffs.push(`Tụ lực ${hero.chargeLevel}`);
    if (hero.invuln > 0 && hero.state === "ult") buffs.push("Bất tử");
    if (hero.combo > 4) buffs.push(`${hero.combo} đòn`);
    E.buffs.textContent = buffs.join(" · ");
    this.terrainTags(hero, E);
    // kỹ năng
    updateAttackTiles(hero, E, this);
    this.combo(hero, E);
    this.skillTiles(hero, hk, E);
    E.sk3.classList.toggle("ready", tpcReady(hk));
    E.sk3.style.display = tpcReady(hk) || hk.tpc ? "" : "none";
    { const kb = E.sk1?.querySelector("b"), want = ctx.touch ? "" : this.sk1Key; if (kb && kb.textContent !== want) kb.textContent = want; }    // lớp cảm ứng bật / tắt theo thiết bị đang dùng
    // mặt trận
    E.fronts.innerHTML = this.B.hud?.frontsHTML ? this.B.hud.frontsHTML(ctx) : Object.values(FRONTS).map((F) => frontRowHTML(F, sim.fronts[F.id], sim)).join("") + (sim.reinf ? `<div class="front reinf">Tiếp viện: ${sim.reinf.charges} lượt${sim.reinf.pending.length ? ` · đang tới ${Math.max(0, Math.ceil(sim.reinf.pending[0].at - sim.t))}s` : ""}${d.followers ? ` · Theo ta ${d.followers.q}` : ""}</div>` : "");
    // sự kiện
    E.events.innerHTML = Object.entries(d.events || {}).filter(([, v]) => v.state === "run").map(([k, v]) =>
      `<div class="ev"><b>${EVENTS[k]?.name ?? k}</b><span>${Math.ceil(v.left)} s</span></div>`).join("");
    // Kế Sách, rồi các bảng của trận (setPanel)
    const kl = (d.keSach?.hud?.() || []).filter((k) => k.state !== "khoa");
    let ks = kl.map((k) =>
      `<div class="ks ${k.state}"><b>Kế Sách ${k.quyMo} · ${k.name}</b><span>${fm(k.word + (k.detail ? " · " + k.detail : ""))}</span><i>Hào Khí ${Math.round(k.got)}/${k.hk} · <em>${k.label}</em></i></div>`).join("");
    for (const [id, html] of this.panels) ks += `<div class="hud-panel" data-panel="${id}">${html}</div>`;
    if (ks !== this.ksHtml) { E.ks.innerHTML = ks; this.ksHtml = ks; this.sitBadge(kl.length); }     // chỉ vẽ lại khi đổi: hoạt ảnh CSS (nhấp nháy Sẵn sàng) chạy liền
    // tin nhắn: sổ tin (bảng tạm dừng) + HUD gọn một tin ≤ 5 s, bố cục máy tính 4 tin như cũ
    logMsgs(this.log, d.msgs, this.seenMsgs, fm);
    const compact = this.compact;
    if (compact) {
      const c = compactMsg(d.msgs), html = c ? `<div class="msg ${c.m.kind}" style="opacity:${c.alpha}">${fm(c.m.text)}</div>` : "";
      if (html !== this.msgHtml) { E.msgs.innerHTML = html; this.msgHtml = html; }
    } else { E.msgs.innerHTML = d.msgs.slice(-4).map((m) => `<div class="msg ${m.kind}" style="opacity:${Math.min(1, (m.T - m.t) * 2)}">${fm(m.text)}</div>`).join(""); this.msgHtml = null; }
    if (this.openT > 0 && (this.openT -= dt) <= 0) this.openCard(false);
    E.ko.textContent = d.ko;
    E.kos.textContent = `${d.ko} KO`;
    // nút ☰ của lớp cảm ứng sáng khi có việc ở trong (Tổng Phản Công sẵn sàng, Kế Sách sẵn sàng)
    this.menuEl ??= this.root.parentElement?.querySelector(".touch .tmenu") || null;
    if (this.menuEl) { const al = tpcReady(hk) || kl.some((k) => k.state === "sansang"); if (al !== this.menuAlert) { this.menuAlert = al; this.menuEl.classList.toggle("alert", al); } }
    // mục tiêu
    const t = hero.lock?.alive && !hero.lock.dead ? hero.lock : this.nearestOfficer();
    if (t) {
      E.target.classList.add("on");
      E.tname.textContent = t.name + (t.broken > 0 ? " · VỠ THẾ" : "");
      E.thp.style.width = `${(t.hp / t.maxHp) * 100}%`;
      E.tpo.style.width = t.poiseMax ? `${(t.poise / t.poiseMax) * 100}%` : "0";
      E.tpo.parentElement.style.display = t.poiseMax ? "" : "none";
      E.target.classList.toggle("broken", t.broken > 0);
    } else E.target.classList.remove("on");
    // dấu khóa mục tiêu
    if (hero.lock?.alive && !hero.lock.dead) {
      const p = ctx.project(hero.lock.x, hero.lock.y + 3.2 * hero.lock.rig.scale, hero.lock.z);
      E.lockmark.style.display = p ? "" : "none";
      if (p) E.lockmark.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%,-50%)`;
    } else E.lockmark.style.display = "none";
    // vòng lệnh
    if (this.ringOpen) {
      E.ringfront.textContent = FRONTS[this.ringFront]?.name ?? "";
      for (const k of ORDER_KEYS) {
        const cd = sim.cooldowns?.[k] ?? 0;
        E["cd_" + k].textContent = k === "tiepvien" ? `${sim.reinf?.charges ?? 0} lượt${cd > 0 ? " · " + Math.ceil(cd) + "s" : ""}` : k === "theota" && d.followers ? "đang theo" : cd > 0 ? Math.ceil(cd) + "s" : "";
      }
      E.ringfoot.textContent = "Đồng hồ trận chậm ×0,2 khi vòng mở. Phím 1–4 hoặc chạm.";
    }
    E.hint.textContent = hero.alive ? "" : "";
    this.drawMap();
  }

  // Nút "Tình hình" (HUD gọn): hiện khi ngăn có gì; số báo = số Kế Sách đang theo dõi + số bảng của trận (B20: Nghi binh, hộ vệ,
  // mốc cọc, Thoát vây…); nhấp nháy khi có việc gấp (Kế Sách sẵn sàng, Nghi binh quá sát, Thoát vây ≥ 80, tướng địch đứng mốc…).
  sitBadge(nKs) {
    const E = this.el, secs = E.ks.querySelectorAll(".b20-sec:not(.ksl), .ksl .ks:not(.mini)").length;
    const n = nKs + secs + E.ks.querySelectorAll(".hud-panel:not([data-panel=b20])").length;
    const hot = !!E.ks.querySelector(".ks.sansang, .b20-sec.lure.near, .b20-sec.escape.hot, .mchip.danger, .b20-sec.rally, .b20-sec .sub.warn");
    E.sit.hidden = !E.ks.innerHTML.trim();
    E.sitn.textContent = n > 0 ? String(n) : "";
    E.sit.classList.toggle("hot", hot);
    if (E.sit.hidden) this.toggleSit(false);
  }

  // Ô kỹ năng (E, T) và ô Tuyệt Kỹ (R). H35 không có skillSlots / ultInfo: đúng chữ, đúng trạng thái như trước.
  skillTiles(hero, hk, E) {
    const slots = this.slots ? heroSlots(hero) || this.slots : null;
    const phaTran = () => {
      const pt = hero.phaTran;
      E.sk1.classList.toggle("ready", pt.cd <= 0);
      E.sk1cd.textContent = pt.left > 0 ? `${pt.left} lần · ${Math.ceil(pt.window)}s` : pt.cd > 0 ? Math.ceil(pt.cd) : "";
    };
    // ô: { ready, cd } với cd là chữ hiện ở góc ô (số giây hồi, "3 lần · 5s", "đọc hịch") — hero-skills.js hud()
    if (!slots) phaTran();
    else slots.forEach((s, i) => {
      const k = SLOT_TILE[i], tile = E[k]; if (!tile) return;
      tile.classList.toggle("ready", s.ready ?? !(s.cd > 0));
      E[k + "cd"].textContent = s.text ?? s.cd ?? "";
    });
    const u = hero.ultInfo?.(), cost = u?.cost ?? HERO.tuyetKy.cost;
    const hkUlt = hk.tpc && hero.hkUltReady;
    E.sk2.classList.toggle("ready", u?.ready ?? (hero.ki >= cost || hkUlt));
    E.sk2cd.textContent = u?.text ?? (typeof u?.cd === "string" ? u.cd : hkUlt ? "Hào Khí" : `${Math.floor(hero.ki / 100)}/${this.nKi}`);
  }

  // Tag thế đất cạnh thanh máu (terrain-rules.js): chênh độ cao chân tướng với mục tiêu đang khóa (trong 2 × tagR m)
  // hoặc địch gần nhất đang giáp mặt (tagR m) → hệ số sát thương tướng gây ra; bùn dưới chân → tốc chạy mất bao nhiêu.
  terrainTags(hero, E) {
    const R = TERRAIN.tag.r, L = hero.lock;
    const locked = L?.alive && !L.dead && (L.x - hero.x) ** 2 + (L.z - hero.z) ** 2 < 4 * R * R;
    const t = hero.alive ? heroTerrain(hero, locked ? L : hero.nearestEnemy(R)) : null;
    const pct = t ? Math.round((t.dmg - 1) * 100) : 0;
    const h = t && Math.abs(t.dmg - 1) >= TERRAIN.tag.min && pct !== 0 ? (pct > 0 ? `Thế đất cao +${pct}%` : `Thế đất thấp −${-pct}%`) : "";
    const m = t && t.mud >= TERRAIN.tag.mud ? `Bùn lầy −${Math.round((1 - t.run) * 100)}% tốc chạy` : "";
    if (E.ttag.textContent !== h) { E.ttag.textContent = h; E.ttag.classList.toggle("down", pct < 0); }
    if (E.tmud.textContent !== m) E.tmud.textContent = m;
  }

  nearestOfficer() {
    const h = this.ctx.hero; let best = null, bd = 18 * 18;
    for (const u of this.ctx.units) {
      if (u.side !== "dich" || !u.alive || u.dead || u.retreating || !u.awake) continue;
      const d2 = (u.x - h.x) ** 2 + (u.z - h.z) ** 2; if (d2 < bd) { bd = d2; best = u; }
    }
    return best;
  }

  cinematic(text) {
    const c = this.el.cine; c.textContent = text; c.classList.remove("on"); void c.offsetWidth; c.classList.add("on");
  }

  // Bộ đếm đòn liên hoàn: nảy mỗi lần tăng, đổi màu ở 30 / 60 / 100 đòn, tắt khi chuỗi đứt (hero.comboT hết).
  combo(hero, E) {
    const n = hero.combo;
    E.combo.classList.toggle("on", n >= 3);
    if (n !== this.lastCombo) {
      E.combon.textContent = n;
      if (n > this.lastCombo) { E.combo.classList.remove("pop"); void E.combo.offsetWidth; E.combo.classList.add("pop"); }
      E.combo.dataset.tier = n >= 100 ? 3 : n >= 60 ? 2 : n >= 30 ? 1 : 0;
      this.lastCombo = n;
    }
  }

  // Bản đồ nhỏ: khung toạ độ ctx.battle.hud.bounds (mặc định Hàm Tử 600 × 400). Lớp nền và lớp trên của trận vẽ qua
  // hud.drawBase(M, ctx) / hud.drawTop(M, ctx), M = { c, W, H, X, Z, sx, sz, t }; phần chung: lính thật, sĩ quan, vật
  // phẩm, mũi tên tướng.
  drawMap() {
    const H0 = this.B.hud || {}, bd = H0.bounds || B15_BOUNDS;
    const c = this.mapCtx, W = this.mapW, H = this.mapH, sx = W / (bd.x1 - bd.x0), sz = H / (bd.z1 - bd.z0);
    const X = (x) => (x - bd.x0) * sx, Z = (z) => (z - bd.z0) * sz;
    const ctx = this.ctx, d = ctx.director;
    const M = { c, W, H, X, Z, sx, sz, t: this.t };
    if (H0.drawBase) H0.drawBase(M, ctx); else { c.fillStyle = "#cdb888"; c.fillRect(0, 0, W, H); }
    // lính thật
    for (const a of ctx.crowd.agents) {
      if (a.role === "actor" || a.state === "dead") continue;
      c.fillStyle = a.side === "ta" ? "#8a1d12" : "#22303e";
      c.fillRect(X(a.x) - 1, Z(a.z) - 1, 2, 2);
    }
    for (const u of ctx.units) {
      if (!u.alive || u.dead) continue;
      if (u.side === "ta") { c.fillStyle = "#2f6fb0"; c.beginPath(); c.arc(X(u.x), Z(u.z), 3.5, 0, 7); c.fill(); }
      else if (u.tier === "tuong" || u.awake || ctx.stats.mods.revealOfficers) {
        c.strokeStyle = u.tier === "tuong" ? "#d8321e" : "#22303e"; c.lineWidth = 2;
        const r = u.tier === "tuong" ? 5 : 3.5;
        c.beginPath(); c.moveTo(X(u.x) - r, Z(u.z) - r); c.lineTo(X(u.x) + r, Z(u.z) + r); c.moveTo(X(u.x) + r, Z(u.z) - r); c.lineTo(X(u.x) - r, Z(u.z) + r); c.stroke();
      }
    }
    H0.drawTop?.(M, ctx);
    for (const p of d.pickups || []) { c.fillStyle = "#f1d98a"; c.fillRect(X(p.x) - 1.5, Z(p.z) - 1.5, 3, 3); }
    // tướng người chơi + hướng camera
    const h = ctx.hero;
    c.save(); c.translate(X(h.x), Z(h.z)); c.rotate(-h.yaw + Math.PI);
    c.fillStyle = "#f1d98a"; c.strokeStyle = "#1d1a17"; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(0, -6); c.lineTo(4.5, 5); c.lineTo(-4.5, 5); c.closePath(); c.fill(); c.stroke();
    c.restore();
  }
}

// Một hàng của bảng mặt trận ở bản đồ nhỏ (trận dùng bảng mặc định — B15): tên cánh, quân ta · địch, Sĩ Khí ta|địch (0–100; giải thích ở
// data/glossary.js, gợi ý lần đầu ở battle/hints.js), lệnh đang chạy, tướng rút. Tách ra để kiểm trong Node (tests/hints.test.mjs).
export function frontRowHTML(F, f, sim) {
  const qt = Math.round(totalQ(f, "ta")), qd = Math.round(totalQ(f, "dich"));
  const o = f.order ? `<em>${ORDERS[f.order.id].name} ${Math.ceil(f.order.left)}s</em>` : "";
  const gen = f.general.alive ? "" : "<em class=bad>tướng rút</em>";
  const here = sim.heroFront === F.id ? " here" : "";
  const door = F.door && sim.bases?.[F.door] ? (supplyOpen(sim, F.id) ? "<em class=door title=\"Cửa ngõ mở: doanh trại cánh này còn của Nguyên, viện binh còn chạy ra tuyến\">Cửa mở</em>" : "<em class=door-shut title=\"Cửa ngõ đóng: hết viện binh cho cánh này\">Cửa đóng</em>") : "";   // đợt 12c: ngắn để hàng không xuống dòng
  return `<div class="front${here}"><b>${F.id}</b><span class="ta">${qt}</span><span class="vs">·</span><span class="dich">${qd}</span>
        <span class="skv">Sĩ Khí ${Math.round(f.sk.ta)}|${Math.round(f.sk.dich)}</span>${o}${gen}${door}</div>`;
}

// ---- thanh chiêu có icon (dùng chung trận chính và Võ trường) ------------------------------------------------
// Hàng trên: đòn N, đòn C kế tiếp (đổi icon theo chuỗi: N N → C báo "C3 Lốc đao"), Né, Đỡ. Hàng dưới: kỹ năng.
// slots (hero.skillSlots()) / ult (hero.ultInfo()): không có thì đúng thanh của H35 (Phá Trận E, Tuyệt Kỹ R).
export function skillBarHTML(full, slots = null, ult = null) {
  const tile = (k, id, key, name, extra = "", cls = "", icon = MOVE_INFO[id].icon, skill = "") => `<div class="sk ${cls}" data-k="${k}"${skill ? ` data-skill="${skill}"` : ""}><img class="ico" src="${ICON(icon)}" alt="" data-k="${k}ic"><b>${key}</b><span data-k="${k}nm">${name}</span><i data-k="${k}cd">${extra}</i></div>`;
  const sk = slots ? slots.map((s, i) => tile(SLOT_TILE[i], "skill", s.key ?? SLOT_KEY[i], s.name ?? s.id, "", "", s.icon ?? MOVE_INFO[s.id]?.icon ?? "skill", s.id)).join("")
    : tile("sk1", "skill", short("skill"), "Phá Trận");
  // nhãn ô Tuyệt Kỹ: ult.label, không có thì tên chiêu của tướng (H31 "Bạch Đằng Quyết Chiến"); Bóp Nát của H35 giữ chữ "Tuyệt Kỹ"
  const ut = ult ? tile("sk2", "ult", ult.key ?? short("ult"), ult.label ?? ((ult.id && ult.id !== "bopNat" && ult.name) || "Tuyệt Kỹ"), "", "", ult.icon ?? "ult") : tile("sk2", "ult", short("ult"), "Tuyệt Kỹ");
  return `<div class="hud-skills">
    <div class="skrow atk">${tile("atkN", "N", short("n"), "Đòn N", "")}${tile("atkC", "C1", short("c"), `C1 ${MOVE_INFO.C1.name}`, "")}${tile("atkD", "dodge", short("dodge"), "Né")}${tile("atkB", "block", short("block"), "Đỡ")}</div>
    <div class="skrow">${sk}${ut}${full ? tile("sk3", "tpc", short("tpc"), "Tổng Phản Công", "", "tpc") + tile("sk4", "cmd", short("cmd"), "Mệnh Lệnh") : ""}</div>
  </div>`;
}
const PIPS = ["", "●○○○○○", "●●○○○○", "●●●○○○", "●●●●○○", "●●●●●○", "●●●●●●"];
// Ô C: đòn C kế tiếp. hero.nextHeavyInfo() → { id, icon?, name?, label?, hot? } (C2); không có thì nextHeavy + MOVE_INFO.
export function updateAttackTiles(hero, E, st) {
  const chain = hero.state === "attack" && hero.move?.[0] === "N" ? Number(hero.move[1]) : hero.chainGrace > 0 ? hero.chain : 0;
  E.atkNcd.textContent = PIPS[chain] || "";
  E.atkN.classList.toggle("ready", chain > 0);
  const ni = hero.nextHeavyInfo?.();
  const nk = ni ? ni.id ?? ni.key : nextHeavy(hero);
  if (nk !== st.nextC) {
    st.nextC = nk;
    const info = MOVE_INFO[nk] || {};
    const icon = ni?.icon ?? info.icon ?? "c1", name = ni?.name ?? info.name ?? "";
    E.atkCic.src = ICON(icon); E.atkCnm.textContent = ni?.label ?? (nk === "D" ? "Lướt C" : nk === "DQ" ? "ĐÒN QUYẾT" : `${nk} ${name}`);
    E.atkC.classList.toggle("hot", ni?.hot ?? nk === "DQ");
    st.touchC ??= document.querySelector(".touch [data-b=c] img");
    if (st.touchC) st.touchC.src = ICON(icon);
  }
  E.atkC.classList.toggle("ready", nk !== "C1");
  E.atkD.classList.toggle("ready", hero.dodgeCd <= 0);
  E.atkD.classList.toggle("off", hero.dodgeCd > 0);
  E.atkB.classList.toggle("ready", hero.state === "block");
}
