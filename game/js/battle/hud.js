// battle/hud.js — HUD bằng DOM trên canvas (S3.12, S5.8). Thanh Hào Khí có mốc 25/50/75/100,
// bản đồ nhỏ vẽ canvas 2D, vòng Mệnh Lệnh 4 ô (đồng hồ trận ×0,2 khi mở, S5.7).

import { FRONTS, MAP, PHASES, EVENTS, lineToX, BASES } from "../data/battle-b15.js";
import { ORDERS, HERO, MODES, TERRAIN } from "../data/tuning.js";
import { KE_SACH, VILLAGE } from "../data/battle-b15.js";
import { totalQ } from "../sim/front.js";
import { tpcReady } from "../sim/haokhi.js";
import { LANE_TERRAIN } from "../data/terrain-b15.js";
import { heroTerrain } from "../sim/terrain-rules.js";
import { laneFeaturesOn } from "./ground.js";
import { MOVE_INFO, ICON, nextHeavy } from "../data/moves-info.js";

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const ORDER_KEYS = ["tiencong", "giuvung", "theota", "tiepvien"];

// Công sự làn đánh trên bản đồ nhỏ (chỉ khi bật công trình làn đánh): đoạn còn nguyên [x0, z0, x1, z1] của lũy
// Nguyên, ụ đất ta, hào (bỏ đoạn vỡ — lối đi đọc được trên bản đồ), tính một lần khi nạp module.
function solidPieces(f, out) {
  const at = (t) => [f.a[0] + (f.b[0] - f.a[0]) * t, f.a[1] + (f.b[1] - f.a[1]) * t];
  let t0 = 0;
  for (const [g0, g1] of [...f.gaps].sort((p, q) => p[0] - q[0])) { if (g0 > t0) out.push([...at(t0), ...at(g0)]); t0 = Math.max(t0, g1); }
  if (t0 < 1) out.push([...at(t0), ...at(1)]);
}
const MAP_LUY = [], MAP_UTA = [], MAP_HAO = [];
for (const b of LANE_TERRAIN.berms) solidPieces(b, b.kind === "luy_nguyen" ? MAP_LUY : MAP_UTA);
for (const d of LANE_TERRAIN.ditches) solidPieces(d, MAP_HAO);

export class HUD {
  constructor(root, ctx) {
    this.root = root; this.ctx = ctx; ctx.hud = this;
    root.innerHTML = `
      <div class="fx-hurt"></div><div class="fx-gold"></div><div class="fx-flash"></div><div class="fx-speed" data-k="speed"></div>
      <div class="hud-combo" data-k="combo"><b data-k="combon">0</b><span>ĐÒN LIÊN HOÀN</span></div>
      <div class="hud-top">
        <div class="hud-phase"><b data-k="phase"></b><span data-k="goal"></span></div>
        <div class="hk">
          <div class="hk-label"><span>HÀO KHÍ</span><b data-k="hkv">0</b></div>
          <div class="hk-bar"><div class="hk-fill" data-k="hkfill"></div><div class="hk-over" data-k="hkover"></div>
            <i style="left:25%"></i><i style="left:50%"></i><i style="left:75%"></i></div>
          <div class="hk-state" data-k="hkstate"></div>
        </div>
        <div class="hud-time"><b data-k="time">0:00</b><span>${MODES[ctx.mode || "nhanh"].name} · par ${fmt(MODES[ctx.mode || "nhanh"].par)}</span></div>
      </div>
      <div class="hud-hero">
        <div class="portrait"><span>H35</span><em data-k="lv"></em></div>
        <div class="bars">
          <div class="name">Trần Quốc Toản <small data-k="rev"></small></div>
          <div class="bar hp"><div data-k="hp"></div><span data-k="hpt"></span></div>
          <div class="ki"><div class="bar kb"><div data-k="ki0"></div></div><div class="bar kb"><div data-k="ki1"></div></div></div>
          <div class="buffs" data-k="buffs"></div>
          <div class="ttags"><span class="ttag" data-k="ttag"></span><span class="ttag mud" data-k="tmud"></span></div>
        </div>
      </div>
      <div class="hud-map"><canvas width="240" height="160" data-k="map"></canvas>
        <div class="fronts" data-k="fronts"></div>
      </div>
      <div class="hud-msgs" data-k="msgs"></div>
      <div class="hud-events" data-k="events"></div>
      <div class="hud-ks" data-k="ks"></div>
      <div class="hud-target" data-k="target"><div class="tname" data-k="tname"></div><div class="bar thp"><div data-k="thp"></div></div><div class="bar tpo"><div data-k="tpo"></div></div></div>
      <div class="hud-hint" data-k="hint"></div>
      <div class="hud-ko"><b data-k="ko">0</b><span>KO</span></div>
      ${skillBarHTML(true)}
      <div class="ring" data-k="ring">
        <div class="ring-title">MỆNH LỆNH · <span data-k="ringfront"></span> <small>(Z / chạm để đổi mặt trận)</small></div>
        <div class="ring-grid">${ORDER_KEYS.map((k, i) => `<button data-order="${k}"><img class="ric" src="${ICON(MOVE_INFO[k].icon)}" alt=""><b>${i + 1}</b><span>${ORDERS[k].name}</span><i data-k="cd_${k}"></i></button>`).join("")}</div>
        <div class="ring-foot" data-k="ringfoot"></div>
      </div>
      <div class="cine" data-k="cine"></div>
      <div class="lockmark" data-k="lockmark">◆</div>`;
    this.el = {};
    root.querySelectorAll("[data-k]").forEach((n) => (this.el[n.dataset.k] = n));
    this.mapCtx = this.el.map.getContext("2d");
    this.ringFront = "A";
    this.el.ringfront.addEventListener("pointerdown", () => this.swapFront());
    root.querySelectorAll("[data-order]").forEach((b) => b.addEventListener("pointerdown", (e) => { e.stopPropagation(); this.issue(b.dataset.order); }));
    this.t = 0; this.pulse = 0;
    this.ringOpen = false; this.lastCombo = 0; this.nextC = "";
  }
  // vệt tốc độ quanh mép màn (Phá Trận, Tuyệt Kỹ)
  speedLines(T) { const e = this.el.speed; e.classList.remove("on"); void e.offsetWidth; e.style.animationDuration = `${T}s`; e.classList.add("on"); }

  swapFront() { this.ringFront = this.ringFront === "A" ? "B" : "A"; }
  issue(k) { this.ctx.director.order(this.ringFront, k); this.ctx.audio.play("ui"); }
  setRing(open) {
    if (open && !this.ringOpen) this.ringFront = this.ctx.sim.heroFront || this.ctx.director.lastFront;
    this.ringOpen = open; this.el.ring.classList.toggle("on", open);
  }
  hkPulse(g) { this.pulse = 0.6; this.el.hkv.dataset.delta = (g > 0 ? "+" : "") + Math.round(g); }

  update(dt, w, h) {
    const ctx = this.ctx, hero = ctx.hero, d = ctx.director, sim = ctx.sim, hk = ctx.hk, E = this.el;
    this.t += dt; this.pulse = Math.max(0, this.pulse - dt);
    const P = PHASES[d.phase];
    E.phase.textContent = `${P.id} · ${P.name}`;
    E.goal.textContent = d.baseHint || P.goal;
    E.time.textContent = fmt(d.time);
    E.time.classList.toggle("late", d.time > d.M.par);
    // Hào Khí
    E.hkv.textContent = Math.floor(hk.value);
    E.hkfill.style.width = `${hk.value}%`;
    E.hkover.style.width = `${(hk.overflow / 30) * 100}%`;
    E.hkfill.parentElement.classList.toggle("ready", tpcReady(hk));
    E.hkfill.parentElement.classList.toggle("tpc", hk.tpc);
    E.hkv.classList.toggle("pulse", this.pulse > 0);
    E.hkstate.textContent = hk.tpc ? `TỔNG PHẢN CÔNG · ${Math.ceil(hk.tpcLeft)} s` : tpcReady(hk) ? "Sẵn sàng · bấm F" : hk.overflow > 0 ? `dư ${Math.floor(hk.overflow)}` : "";
    // tướng
    E.lv.textContent = `Cấp ${ctx.stats.level}`;
    E.hp.style.width = `${(hero.hp / hero.maxHp) * 100}%`;
    E.hpt.textContent = `${Math.ceil(hero.hp)} / ${Math.round(hero.maxHp)}`;
    E.hp.parentElement.classList.toggle("low", hero.hp / hero.maxHp < 0.3);
    E.ki0.style.width = `${Math.min(100, hero.ki)}%`;
    E.ki1.style.width = `${Math.max(0, hero.ki - 100)}%`;
    E.rev.textContent = hero.revives > 0 ? `· Gượng dậy ×${hero.revives}` : "";
    const buffs = [];
    if (hero.buffs.atk) buffs.push(`Cờ lệnh ${Math.ceil(hero.buffs.atkT)}s`);
    if (hero.buffs.flag) buffs.push("Dưới cờ +25%");
    if (hero.lienHoan) buffs.push(`Liên hoàn ×${hero.lienHoan}`);
    if (hero.invuln > 0 && hero.state === "ult") buffs.push("Bất tử");
    if (hero.combo > 4) buffs.push(`${hero.combo} đòn`);
    E.buffs.textContent = buffs.join(" · ");
    this.terrainTags(hero, E);
    // kỹ năng
    updateAttackTiles(hero, E, this);
    this.combo(hero, E);
    const pt = hero.phaTran;
    E.sk1.classList.toggle("ready", pt.cd <= 0);
    E.sk1cd.textContent = pt.left > 0 ? `${pt.left} lần · ${Math.ceil(pt.window)}s` : pt.cd > 0 ? Math.ceil(pt.cd) : "";
    const ultReady = hero.ki >= HERO.tuyetKy.cost || (hk.tpc && hero.hkUltReady);
    E.sk2.classList.toggle("ready", ultReady);
    E.sk2cd.textContent = hk.tpc && hero.hkUltReady ? "Hào Khí" : `${Math.floor(hero.ki / 100)}/2`;
    E.sk3.classList.toggle("ready", tpcReady(hk));
    E.sk3.style.display = tpcReady(hk) || hk.tpc ? "" : "none";
    if (ctx.touch) { E.sk1.querySelector("b").textContent = ""; }
    // mặt trận
    E.fronts.innerHTML = Object.values(FRONTS).map((F) => {
      const f = sim.fronts[F.id], qt = Math.round(totalQ(f, "ta")), qd = Math.round(totalQ(f, "dich"));
      const o = f.order ? `<em>${ORDERS[f.order.id].name} ${Math.ceil(f.order.left)}s</em>` : "";
      const gen = f.general.alive ? "" : "<em class=bad>tướng rút</em>";
      const here = sim.heroFront === F.id ? " here" : "";
      return `<div class="front${here}"><b>${F.id}</b><span class="ta">${qt}</span><span class="vs">·</span><span class="dich">${qd}</span>
        <span class="skv">SK ${Math.round(f.sk.ta)}|${Math.round(f.sk.dich)}</span>${o}${gen}</div>`;
    }).join("") + `<div class="front reinf">Tiếp viện: ${sim.reinf.charges} lượt${sim.reinf.pending.length ? ` · đang tới ${Math.max(0, Math.ceil(sim.reinf.pending[0].at - sim.t))}s` : ""}${d.followers ? ` · Theo ta ${d.followers.q}` : ""}</div>`;
    // sự kiện
    E.events.innerHTML = Object.entries(d.events).filter(([, v]) => v.state === "run").map(([k, v]) =>
      `<div class="ev"><b>${EVENTS[k].name}</b><span>${Math.ceil(v.left)} s</span></div>`).join("");
    // Kế Sách
    E.ks.innerHTML = d.keSach.hud().filter((k) => k.state !== "khoa").map((k) =>
      `<div class="ks ${k.state}"><b>Kế Sách ${k.quyMo} · ${k.name}</b><span>${k.word}${k.detail ? " · " + k.detail : ""}</span><i>Hào Khí ${Math.round(k.got)}/${k.hk} · <em>${k.label}</em></i></div>`).join("");
    // tin nhắn
    E.msgs.innerHTML = d.msgs.slice(-4).map((m) => `<div class="msg ${m.kind}" style="opacity:${Math.min(1, (m.T - m.t) * 2)}">${m.text}</div>`).join("");
    E.ko.textContent = d.ko;
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
      E.ringfront.textContent = FRONTS[this.ringFront].name;
      for (const k of ORDER_KEYS) {
        const cd = sim.cooldowns[k];
        E["cd_" + k].textContent = k === "tiepvien" ? `${sim.reinf.charges} lượt${cd > 0 ? " · " + Math.ceil(cd) + "s" : ""}` : k === "theota" && d.followers ? "đang theo" : cd > 0 ? Math.ceil(cd) + "s" : "";
      }
      E.ringfoot.textContent = "Đồng hồ trận chậm ×0,2 khi vòng mở. Phím 1–4 hoặc chạm.";
    }
    E.hint.textContent = hero.alive ? "" : "";
    this.drawMap();
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

  drawMap() {
    const c = this.mapCtx, W = 240, H = 160, sx = W / 600, sz = H / 400;
    const X = (x) => x * sx, Z = (z) => (z + 200) * sz;
    const ctx = this.ctx, sim = ctx.sim, d = ctx.director;
    c.fillStyle = "#cdb888"; c.fillRect(0, 0, W, H);
    c.fillStyle = "#2f5d62"; c.fillRect(0, 0, W, Z(MAP.riverNorthZ)); c.fillRect(X(MAP.riverEastX), 0, W, H);
    c.fillStyle = "#b39a6a"; c.fillRect(X(MAP.fortWallX), Z(MAP.riverNorthZ), X(MAP.riverEastX) - X(MAP.fortWallX), Z(MAP.fortSouthZ) - Z(MAP.riverNorthZ));
    c.strokeStyle = "#5a4632"; c.lineWidth = 2; c.beginPath();
    c.moveTo(X(MAP.fortWallX), Z(MAP.riverNorthZ)); c.lineTo(X(MAP.fortWallX), Z(MAP.fortSouthZ)); c.lineTo(X(MAP.riverEastX), Z(MAP.fortSouthZ)); c.stroke();
    for (const F of Object.values(FRONTS)) {
      const f = sim.fronts[F.id], lx = lineToX(F, f.x);
      c.fillStyle = "rgba(155,45,32,.45)"; c.fillRect(X(F.x0), Z(F.laneZ - 22), X(lx) - X(F.x0), Z(F.laneZ + 22) - Z(F.laneZ - 22));
      c.fillStyle = "rgba(44,58,74,.45)"; c.fillRect(X(lx), Z(F.laneZ - 22), X(Math.min(F.x1, MAP.fortWallX)) - X(lx), Z(F.laneZ + 22) - Z(F.laneZ - 22));
      c.fillStyle = "#f1d98a"; c.fillRect(X(lx) - 1, Z(F.laneZ - 24), 2, Z(F.laneZ + 24) - Z(F.laneZ - 24));
      c.fillStyle = "#1d1a17"; c.font = "bold 10px sans-serif"; c.fillText(F.id, X(F.x0) - 12, Z(F.laneZ) + 4);
    }
    // công sự làn đánh: gò (vệt đất nhạt), hào và hào thành (nét nước), lũy Nguyên (nét đậm), ụ ta, hố (chấm)
    if (laneFeaturesOn()) {
      c.fillStyle = "rgba(122,96,58,.5)";
      for (const m of LANE_TERRAIN.mounds) { c.beginPath(); c.arc(X(m.x), Z(m.z), m.r * sx, 0, 7); c.fill(); }
      const seg = (list, color, w) => {
        c.strokeStyle = color; c.lineWidth = w; c.beginPath();
        for (const p of list) { c.moveTo(X(p[0]), Z(p[1])); c.lineTo(X(p[2]), Z(p[3])); }
        c.stroke();
      };
      seg(MAP_HAO, "#2f5d62", 1.6); seg(MAP_UTA, "#7a5230", 1.2); seg(MAP_LUY, "#3b2a1a", 1.8);
      for (const p of LANE_TERRAIN.pits) { c.fillStyle = p.kind === "ngap" ? "#2f5d62" : "#4a3a28"; c.beginPath(); c.arc(X(p.x), Z(p.z), 1.3, 0, 7); c.fill(); }
    }
    for (const b of BASES) {
      const v = ctx.world.bases[b.id], s = sim.bases[b.id];
      const sz2 = b.type === "doanh_trai" ? 9 : b.type === "cong" ? 6 : b.type === "ban_doanh" ? 11 : 7;
      c.fillStyle = s.owner === "ta" ? "#c0392b" : "#3d5a78";
      if (b.type === "cong") c.fillRect(X(v.x) - 2, Z(v.z) - sz2, 5, sz2 * 2);
      else c.fillRect(X(v.x) - sz2 / 2, Z(v.z) - sz2 / 2, sz2, sz2);
      c.strokeStyle = "#1d1a17"; c.lineWidth = 1; c.strokeRect(X(v.x) - sz2 / 2, Z(v.z) - sz2 / 2, sz2, sz2);
    }
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
    // sự kiện nhấp nháy
    if (Math.floor(this.t * 3) % 2 === 0) {
      c.strokeStyle = "#ff5a3a"; c.lineWidth = 2;
      if (d.events.counterA1?.state === "run") { const v = ctx.world.bases.A1; c.beginPath(); c.arc(X(v.x), Z(v.z), 10, 0, 7); c.stroke(); }
      if (d.events.surrounded?.state === "run" && d.generals.H40) { const g = d.generals.H40; c.beginPath(); c.arc(X(g.x), Z(g.z), 10, 0, 7); c.stroke(); }
    }
    const ks = d.keSach;
    c.fillStyle = "#8a6a3a"; c.beginPath(); c.arc(X(VILLAGE.x), Z(VILLAGE.z), 5, 0, 7); c.fill();
    for (const b of ks.boats) { if (b.dead) continue; c.fillStyle = "#e0a24a"; c.fillRect(X(b.x) - 3, Z(b.z) - 1.5, 6, 3); }
    for (const b of ks.bundles) if (!b.taken) { c.fillStyle = "#f1d98a"; c.beginPath(); c.arc(X(b.x), Z(b.z), 2.5, 0, 7); c.fill(); }
    if (ks.list.some((k) => k.state === "sansang") && Math.floor(this.t * 4) % 2) { const L = KE_SACH.coAoTong.landing; c.strokeStyle = "#ffd27a"; c.lineWidth = 2; c.beginPath(); c.arc(X(L.x), Z(L.z), 8, 0, 7); c.stroke(); }
    for (const p of d.pickups) { c.fillStyle = "#f1d98a"; c.fillRect(X(p.x) - 1.5, Z(p.z) - 1.5, 3, 3); }
    // tướng người chơi + hướng camera
    const h = ctx.hero;
    c.save(); c.translate(X(h.x), Z(h.z)); c.rotate(-h.yaw + Math.PI);
    c.fillStyle = "#f1d98a"; c.strokeStyle = "#1d1a17"; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(0, -6); c.lineTo(4.5, 5); c.lineTo(-4.5, 5); c.closePath(); c.fill(); c.stroke();
    c.restore();
  }
}

// ---- thanh chiêu có icon (dùng chung trận chính và Võ trường) ------------------------------------------------
// Hàng trên: đòn N, đòn C kế tiếp (đổi icon theo chuỗi: N N → C báo "C3 Lốc đao"), Né, Đỡ. Hàng dưới: kỹ năng.
export function skillBarHTML(full) {
  const tile = (k, id, key, name, extra = "", cls = "") => `<div class="sk ${cls}" data-k="${k}"><img class="ico" src="${ICON(MOVE_INFO[id].icon)}" alt="" data-k="${k}ic"><b>${key}</b><span data-k="${k}nm">${name}</span><i data-k="${k}cd">${extra}</i></div>`;
  return `<div class="hud-skills">
    <div class="skrow atk">${tile("atkN", "N", "J", "Đòn N", "")}${tile("atkC", "C1", "K", "C1 Phá thế", "")}${tile("atkD", "dodge", "Space", "Né")}${tile("atkB", "block", "Shift", "Đỡ")}</div>
    <div class="skrow">${tile("sk1", "skill", "E", "Phá Trận")}${tile("sk2", "ult", "R", "Tuyệt Kỹ")}${full ? tile("sk3", "tpc", "F", "Tổng Phản Công", "", "tpc") + tile("sk4", "cmd", "Tab", "Mệnh Lệnh") : ""}</div>
  </div>`;
}
const PIPS = ["", "●○○○○○", "●●○○○○", "●●●○○○", "●●●●○○", "●●●●●○", "●●●●●●"];
export function updateAttackTiles(hero, E, st) {
  const chain = hero.state === "attack" && hero.move?.[0] === "N" ? Number(hero.move[1]) : hero.chainGrace > 0 ? hero.chain : 0;
  E.atkNcd.textContent = PIPS[chain] || "";
  E.atkN.classList.toggle("ready", chain > 0);
  const nk = nextHeavy(hero);
  if (nk !== st.nextC) {
    st.nextC = nk;
    const info = MOVE_INFO[nk];
    E.atkCic.src = ICON(info.icon); E.atkCnm.textContent = nk === "D" ? "Lướt C" : nk === "DQ" ? "ĐÒN QUYẾT" : `${nk} ${info.name}`;
    E.atkC.classList.toggle("hot", nk === "DQ");
    st.touchC ??= document.querySelector(".touch [data-b=c] img");
    if (st.touchC) st.touchC.src = ICON(info.icon);
  }
  E.atkC.classList.toggle("ready", nk !== "C1");
  E.atkD.classList.toggle("ready", hero.dodgeCd <= 0);
  E.atkD.classList.toggle("off", hero.dodgeCd > 0);
  E.atkB.classList.toggle("ready", hero.state === "block");
}
