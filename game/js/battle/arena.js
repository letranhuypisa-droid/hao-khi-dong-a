// battle/arena.js — Võ trường: sân tập, bộ điều phối và HUD riêng (GDD 13.5, 12.9).
// Dùng lại hệ chiến đấu của trận chính (lính, tướng, sĩ quan, hiệu ứng, âm thanh, input, cảm ứng).

import * as THREE from "three";
import { buildArena, heightAt, ARENA_R } from "./world.js";
import { Crowd } from "./crowd.js";
import { Hero } from "./hero.js";
import { BigUnit } from "./units.js";
import { FX } from "./fx.js";
import { Audio } from "./audio.js";
import { Input } from "./input.js";
import { lerpAngle, buildTouch, controlsHTML, releaseGpu } from "./battle.js";
import { HUD, skillBarHTML, updateAttackTiles } from "./hud.js";
import { TutorialDirector } from "./tutorial.js";
import { createHaoKhi } from "../sim/haokhi.js";
import { makeRng } from "../core/rng.js";
import { DIFFICULTY, TROOP_LEVELS, HERO, TIERS, E, g } from "../data/tuning.js";
import { heroStats } from "../meta/progress.js";
import { ARENA_MODES, makeLayout, estimateTime, timeMedals, medalFor, syncSave, MEDALS } from "../meta/arena.js";

const STEP = 1 / 60;
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const fmt1 = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;

class ArenaDirector {
  constructor(ctx, o) {
    this.ctx = ctx; ctx.director = this; this.o = o;
    this.mode = o.mode; this.time = 0; this.ko = 0; this.msgs = []; this.over = false; this.result = null;
    this.events = {}; this.generals = {}; this.pickups = []; this.phase = 0;
    this.wave = -1; this.waveUnits = []; this.waveAgents = new Set(); this.respawn = [];
    this.clearSec = null;
    if (o.mode === "thoigian" || o.mode === "seedtuan") {
      this.layout = makeLayout(o.seed);
      this.est = estimateTime(this.layout, ctx.stats, ctx.R);
      this.thresholds = timeMedals(this.est);
      this.gatePts = this.layout.gates.map((a) => ({ x: Math.cos(a) * (ARENA_R - 2), z: Math.sin(a) * (ARENA_R - 2) }));
      this.say(`Seed ${o.mode === "seedtuan" ? o.week : o.seed}: 5 đợt. Vàng ≤ ${fmt(this.thresholds.vang)}, Bạc ≤ ${fmt(this.thresholds.bac)}.`, 6);
      this.nextWaveAt = 2;
    } else if (o.mode === "duako") {
      this.say("Đua KO: 180 s. Đồng 150 · Bạc 220 · Vàng 300.", 5);
    } else {
      this.say(`Luyện tập với ${TIERS[o.tier].name}${o.invincible ? " · bất tử" : ""}. Esc để rời sân.`, 5);
    }
  }

  say(text, T = 4, kind = "info") { this.msgs.push({ text, T, kind, t: 0 }); }
  alive(a) { return this.ctx.crowd.hittable(a); }

  spawnSoldier(x, z, opts = {}) {
    const ctx = this.ctx, rng = ctx.rng;
    const unit = opts.unit || (rng.next() < (opts.archers ?? 0.4) ? "CUNGKY_NG" : "KHIEN_NG");
    const a = ctx.crowd.spawn({ side: "dich", unit, tier: opts.tier || (rng.next() < (opts.elite ?? 0.1) ? "tinhnhue" : "thuong"),
      role: "zone", front: null, x, z, yaw: Math.atan2(-x, -z) });
    if (opts.wave) this.waveAgents.add(a);
    return a;
  }
  spawnOfficer(tier, x, z, wave) {
    const ctx = this.ctx;
    const u = new BigUnit(ctx, { kind: tier === "tuong" ? "boss" : "officer", side: "dich", tier, name: tier === "tuong" ? "Tướng Nguyên" : TIERS[tier].name, x, z, awake: true, aggro: 200 });
    u.home = { x: 0, z: 0 }; u.retreatTo = { x: x * 1.3, z: z * 1.3 };
    ctx.units.push(u);
    if (wave) this.waveUnits.push(u);
    return u;
  }
  edgePoint(near = null) {
    const ctx = this.ctx, a = ctx.rng.range(0, Math.PI * 2);
    if (near) { const r = ctx.rng.range(14, 22); const x = near.x + Math.cos(a) * r, z = near.z + Math.sin(a) * r; const d = Math.hypot(x, z); return d > ARENA_R - 2 ? { x: x / d * (ARENA_R - 2), z: z / d * (ARENA_R - 2) } : { x, z }; }
    return { x: Math.cos(a) * (ARENA_R - 3), z: Math.sin(a) * (ARENA_R - 3) };
  }

  update(dt) {
    const ctx = this.ctx, o = this.o;
    for (const m of this.msgs) m.t += dt; this.msgs = this.msgs.filter((m) => m.t < m.T);
    if (this.over) return;
    this.time += dt;
    const enemies = ctx.crowd.agents.filter((a) => a.side === "dich" && this.alive(a)).length;

    if (this.mode === "luyentap") {
      if (o.invincible) { ctx.hero.hp = ctx.hero.maxHp; }
      if (TIERS[o.tier].poise > 0) {
        const up = ctx.units.filter((u) => u.alive && !u.dead && !u.retreating).length;
        if (up < Math.min(3, o.count) && (this.respawnT = (this.respawnT || 0) - dt) <= 0) { const p = this.edgePoint(); this.spawnOfficer(o.tier, p.x, p.z); this.respawnT = 3; }
      } else if (enemies < o.count) {
        const p = this.edgePoint(ctx.hero); this.spawnSoldier(p.x, p.z, { tier: o.tier, elite: 0 });
      }
    } else if (this.mode === "duako") {
      // vùng chiến đấu cố định 30 địch — đua KO công bằng ở mọi cấu hình (13.5)
      for (let i = enemies; i < 30; i++) { const p = this.edgePoint(ctx.hero); this.spawnSoldier(p.x, p.z, { archers: 0.4, elite: 0.1 }); }
      if (this.time >= ARENA_MODES.duako.dur) this.finish(true);
    } else {
      const aliveWave = [...this.waveAgents].filter((a) => a.alive && a.state !== "dead").length + this.waveUnits.filter((u) => u.alive && !u.dead && !u.retreating).length;
      if (this.wave >= 0 && aliveWave === 0 && this.nextWaveAt == null) {
        if (this.wave >= this.layout.waves.length - 1) { this.clearSec = this.time; this.finish(true); return; }
        this.nextWaveAt = this.time + 2;
        this.say(`Hạ xong đợt ${this.wave + 1}.`, 2, "good");
      }
      if (this.nextWaveAt != null && this.time >= this.nextWaveAt) { this.nextWaveAt = null; this.startWave(this.wave + 1); }
      if (this.time > 600) this.finish(false, "Quá 10 phút.");
    }
  }

  startWave(i) {
    const ctx = this.ctx, W = this.layout.waves[i], gp = this.gatePts[W.gate], rng = makeRng(this.layout.seed + i * 7919);
    this.wave = i; this.waveAgents.clear(); this.waveUnits = [];
    for (let k = 0; k < W.soldiers; k++) {
      const a = rng.range(-0.5, 0.5) * W.spread, r = rng.range(0, 9);
      this.spawnSoldier(gp.x * 0.92 + Math.cos(a + Math.atan2(gp.z, gp.x)) * r, gp.z * 0.92 + Math.sin(a + Math.atan2(gp.z, gp.x)) * r, { archers: W.archers, elite: W.elite, wave: true });
    }
    W.officers.forEach((t, k) => this.spawnOfficer(t, gp.x * (0.85 - k * 0.05), gp.z * (0.85 - k * 0.05), true));
    ctx.fx.banner(`ĐỢT ${i + 1} / ${this.layout.waves.length}`, "#e6dcc3", 1.2); ctx.audio.play("drum");
  }

  finish(ok, why = "") {
    if (this.over) return;
    this.over = true;
    const o = this.o, dur = this.time;
    const value = this.mode === "duako" ? this.ko : this.clearSec;
    const medal = this.mode === "luyentap" ? null : medalFor(this.mode, ok ? value : null, this.thresholds);
    this.result = { arena: true, mode: this.mode, R: this.ctx.R, difficulty: this.ctx.diff.id, sync: o.sync, level: this.ctx.stats.level,
      seed: o.seed, week: o.week, ko: this.ko, clearSec: this.clearSec, cleared: ok && this.mode !== "duako" ? true : false,
      durSec: dur, medal, thresholds: this.thresholds, est: this.est, why, aborted: !!o.abortedFlag, at: Date.now() };
    this.ctx.audio.play(medal ? "victory" : "defeat");
  }

  // ---- móc từ lính, tướng, sĩ quan ---------------------------------------------------------------
  onSoldierKilled(a, opt) { if (a.side === "dich" && opt.by === "hero") this.ko++; }
  onOfficerKilled(u) { this.ko++; this.ctx.fx.banner(`ĐÃ HẠ ${TIERS[u.tier].name.toUpperCase()}`, "#e6dcc3", 1); }
  onBossDefeated(u) { this.ko++; this.ctx.fx.banner("TƯỚNG NGUYÊN RÚT CHẠY", "#f1d98a", 1.4); }
  onOfficerAwake() {}
  onBreak() { this.ctx.fx.banner("VỠ THẾ · ĐÒN MẠNH ĐỂ RA ĐÒN QUYẾT", "#ffd27a", 1.1); }
  onHeroHit() {}
  onRevive() {}
  onUlt() {}
  onCounterBoss() {}
  ultQ() {}
  plantFlag(x, z, r) { this.ctx.fx.ring(x, z, r, 0xf1d98a, 0.8); }
  damageGate() {}
  onAllyGeneralDown() {}
  onHeroDead() {
    if (this.mode === "luyentap") { const h = this.ctx.hero; h.alive = true; h.state = "free"; h.hp = h.maxHp; h.invuln = 2; this.say("Tập lại từ đầu.", 2); return; }
    this.finish(false, "Trần Quốc Toản gục ngã.");
  }
}

class ArenaHUD {
  constructor(root, ctx) {
    this.ctx = ctx; this.root = root; ctx.hud = this;
    root.innerHTML = `<div class="fx-hurt"></div><div class="fx-gold"></div><div class="fx-flash"></div><div class="fx-speed" data-k="speed"></div>
      <div class="hud-combo" data-k="combo"><b data-k="combon">0</b><span>ĐÒN LIÊN HOÀN</span></div>
      <div class="arena-top"><b data-k="mode"></b><div class="arena-big" data-k="big"></div><span data-k="sub"></span><div class="arena-medals" data-k="medals"></div></div>
      <div class="hud-hero"><div class="portrait"><span>H35</span><em data-k="lv"></em></div>
        <div class="bars"><div class="name">Trần Quốc Toản <small data-k="rev"></small></div>
          <div class="bar hp"><div data-k="hp"></div><span data-k="hpt"></span></div>
          <div class="ki"><div class="bar kb"><div data-k="ki0"></div></div><div class="bar kb"><div data-k="ki1"></div></div></div>
          <div class="buffs" data-k="buffs"></div></div></div>
      <div class="hud-msgs" data-k="msgs"></div>
      <div class="hud-target" data-k="target"><div class="tname" data-k="tname"></div><div class="bar thp"><div data-k="thp"></div></div><div class="bar tpo"><div data-k="tpo"></div></div></div>
      <div class="hud-ko"><b data-k="ko">0</b><span>KO</span></div>
      ${skillBarHTML(false)}
      <div class="tut" data-k="tut" style="display:none"></div>
      <div class="cine" data-k="cine"></div><div class="lockmark" data-k="lockmark">◆</div>`;
    this.el = {}; root.querySelectorAll("[data-k]").forEach((n) => (this.el[n.dataset.k] = n));
    this.lastCombo = 0; this.nextC = "";
  }
  speedLines(T) { HUD.prototype.speedLines.call(this, T); }
  combo(h, E) { HUD.prototype.combo.call(this, h, E); }
  hkPulse() {}
  setRing() {}
  cinematic(text) { const c = this.el.cine; c.textContent = text; c.classList.remove("on"); void c.offsetWidth; c.classList.add("on"); }
  update() {
    const ctx = this.ctx, d = ctx.director, h = ctx.hero, E1 = this.el, o = d.o;
    E1.mode.textContent = `VÕ TRƯỜNG · ${ARENA_MODES[d.mode].name}${o.sync ? " · Đồng bộ cấp" : ""}`;
    if (d.mode === "duako") {
      E1.big.textContent = fmt(Math.max(0, ARENA_MODES.duako.dur - d.time));
      E1.sub.textContent = `${d.ko} KO`;
      const m = ARENA_MODES.duako.medals;
      E1.medals.innerHTML = MEDALS.slice().reverse().map((x) => `<span class="${d.ko >= m[x.id] ? "got " : ""}${x.id}">${x.name} ${m[x.id]}</span>`).join("");
    } else if (d.layout) {
      E1.big.textContent = fmt1(d.clearSec ?? d.time);
      E1.sub.textContent = `Đợt ${Math.max(1, d.wave + 1)} / ${d.layout.waves.length}`;
      E1.medals.innerHTML = `<span class="vang ${d.time <= d.thresholds.vang ? "got" : ""}">Vàng ≤ ${fmt(d.thresholds.vang)}</span><span class="bac ${d.time <= d.thresholds.bac ? "got" : ""}">Bạc ≤ ${fmt(d.thresholds.bac)}</span><span class="dong got">Đồng: hạ hết</span>`;
    } else if (d.mode !== "huanluyen") {
      E1.big.textContent = fmt(d.time); E1.sub.textContent = `${TIERS[o.tier].name} · ${d.ko} KO`; E1.medals.innerHTML = "";
    }
    updateAttackTiles(h, E1, this); this.combo(h, E1);
    d.tutorialHUD?.(E1);
    E1.lv.textContent = `Cấp ${ctx.stats.level}`;
    E1.hp.style.width = `${(h.hp / h.maxHp) * 100}%`; E1.hpt.textContent = `${Math.ceil(h.hp)} / ${Math.round(h.maxHp)}`;
    E1.hp.parentElement.classList.toggle("low", h.hp / h.maxHp < 0.3);
    E1.ki0.style.width = `${Math.min(100, h.ki)}%`; E1.ki1.style.width = `${Math.max(0, h.ki - 100)}%`;
    E1.rev.textContent = h.revives > 0 ? `· Gượng dậy ×${h.revives}` : "";
    E1.buffs.textContent = [h.lienHoan ? `Liên hoàn ×${h.lienHoan}` : "", h.combo > 4 ? `${h.combo} đòn` : ""].filter(Boolean).join(" · ");
    E1.sk1.classList.toggle("ready", h.phaTran.cd <= 0); E1.sk1cd.textContent = h.phaTran.left > 0 ? `${h.phaTran.left} lần` : h.phaTran.cd > 0 ? Math.ceil(h.phaTran.cd) : "";
    E1.sk2.classList.toggle("ready", h.ki >= 100); E1.sk2cd.textContent = `${Math.floor(h.ki / 100)}/2`;
    E1.ko.textContent = d.ko;
    E1.msgs.innerHTML = d.msgs.slice(-3).map((m) => `<div class="msg ${m.kind}">${m.text}</div>`).join("");
    let t = h.lock?.alive && !h.lock.dead ? h.lock : null, bd = 18 * 18;
    if (!t) for (const u of ctx.units) { if (!u.alive || u.dead || u.retreating) continue; const d2 = (u.x - h.x) ** 2 + (u.z - h.z) ** 2; if (d2 < bd) { bd = d2; t = u; } }
    if (t) {
      E1.target.classList.add("on"); E1.tname.textContent = t.name + (t.broken > 0 ? " · VỠ THẾ" : "");
      E1.thp.style.width = `${(t.hp / t.maxHp) * 100}%`; E1.tpo.style.width = t.poiseMax ? `${(t.poise / t.poiseMax) * 100}%` : "0";
      E1.target.classList.toggle("broken", t.broken > 0);
    } else E1.target.classList.remove("on");
    if (h.lock?.alive && !h.lock.dead) { const p = ctx.project(h.lock.x, h.lock.y + 3.2 * h.lock.rig.scale, h.lock.z); E1.lockmark.style.display = p ? "" : "none"; if (p) E1.lockmark.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%,-50%)`; }
    else E1.lockmark.style.display = "none";
  }
}

// opts: { mode, tier, count, invincible, seed, week, sync }
export function runArena({ container, save, R, difficulty, music, opts, onSettings }) {
  return new Promise((resolve) => {
    const settings = save.settings;
    const diff = DIFFICULTY.find((d) => d.id === difficulty) || DIFFICULTY[1];
    let stats;
    if (opts.sync && opts.mode !== "luyentap") {
      stats = heroStats(syncSave(save, R), R);
      stats.weaponMult = E(R); stats.cong = Math.round(HERO.cong1 * g(R) * E(R) * (1 + stats.mods.atkPct));
    } else stats = heroStats(save, R);
    container.innerHTML = `<canvas class="game"></canvas><div class="hud"></div><div class="overlay"></div><div class="touch"></div>`;
    container.classList.add("arena-mode");
    if (opts.mode === "huanluyen") container.classList.add("tut-mode");
    const canvas = container.querySelector("canvas"), hudRoot = container.querySelector(".hud");
    const overlay = container.querySelector(".overlay"), touchRoot = container.querySelector(".touch");
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = settings.shadows; renderer.shadowMap.type = THREE.PCFShadowMap;   // r186 bỏ PCFSoft (xem battle.js)
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(55, 1, 0.3, 1400);   // núi xa đặt ngoài vòng 600–900 m
    // Võ trường (cả Huấn luyện) giữ HP / Phá Thế địch ×1 ở mọi độ khó: ước lượng thời gian Vàng/Bạc (meta/arena.js
    // estimateTime) và mốc Đua KO cố định tính theo HP gốc; hệ số §10 của đợt 9 chỉ dành cho trận (trước đây lọt sang đây,
    // làm huy chương thời gian khó hơn ×1,7–2,2 ở Nguyên soái, Truyền Kỳ).
    const ctx = {
      scene, camera, renderer, R, diff: { ...diff, hp: 1, poise: 1 }, stats, save, rng: makeRng((opts.seed || Date.now()) & 0x7fffffff), clock: 0,
      openGates: {}, units: [], troops: TROOP_LEVELS[1], touch: false, mode: "arena", music,
    };
    ctx.world = buildArena(scene, { shadows: settings.shadows });
    ctx.hk = createHaoKhi({ quick: false });
    ctx.sim = { heroFront: null, fronts: {}, bases: {} };
    ctx.audio = new Audio(settings.volume); ctx.audio.unlock();
    music?.play(opts.mode === "luyentap" || opts.mode === "huanluyen" ? "hub" : "boss");
    ctx.fx = new FX(scene, camera, hudRoot);
    ctx.crowd = new Crowd(scene, ctx);
    // khán giả trên khán đài: quân Trần đứng xem, reo hò khi tướng hạ địch (không đánh, không bị đánh)
    for (const s of ctx.world.spectatorSpots || []) {
      const a = ctx.crowd.spawn({ side: "ta", unit: "GIAO_DV", role: "spectator", x: s.x, z: s.z, yaw: s.yaw });
      a.y = s.y;
    }
    ctx.hero = new Hero(ctx, stats); ctx.hero.x = 0; ctx.hero.z = 8; ctx.hero.yaw = Math.PI;
    const input = new Input(canvas);
    new ArenaHUD(hudRoot, ctx);
    if (opts.mode === "huanluyen") new TutorialDirector(ctx, opts); else new ArenaDirector(ctx, opts);
    ctx.input = input;
    if (location.search.includes("debug")) window.__hk = ctx;
    ctx.hitstopT = 0; ctx.hitstop = (ms) => { ctx.hitstopT = Math.max(ctx.hitstopT, ms / 1000); };
    const cam = ctx.cam = { yaw: Math.PI, pitch: 0.42, dist: 10.5, idle: 0, x: 0, y: 0, z: 0, pull: 0 };
    let slowT = 0, slowK = 1;
    ctx.cinematic = (text, unit, big) => { ctx.hud.cinematic(text); slowT = big ? 1.5 : 0.6; slowK = big ? 0.25 : 0.4; cam.pull = big ? 1 : 0.4; };
    ctx.slowmo = (T, k) => { if (slowT <= 0 || k <= slowK) slowK = k; slowT = Math.max(slowT, T); };
    const v3 = new THREE.Vector3(); let W = 1, H = 1;
    ctx.project = (x, y, z) => { v3.set(x, y, z).project(camera); if (v3.z > 1) return null; return { x: (v3.x * 0.5 + 0.5) * W, y: (-v3.y * 0.5 + 0.5) * H }; };
    const resize = () => {
      W = container.clientWidth; H = container.clientHeight;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2) * (settings.renderScale || 1));
      renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", resize); resize();
    if (settings.touch === "on" || (settings.touch === "auto" && matchMedia("(pointer: coarse)").matches)) buildTouch(touchRoot, input, ctx);

    let paused = false, finished = false, raf = 0, last = performance.now(), acc = 0, time = 0, endShown = false;
    // hết lượt (director.over) thì không mở tạm dừng, như battle.js: bảng tạm dừng đè mất bảng kết quả
    const pause = (on) => {
      if (finished) return;
      paused = on; overlay.classList.toggle("on", on);
      const tut = opts.mode === "huanluyen";
      overlay.innerHTML = on ? `<div class="panel pause"><h2>${tut ? "HUẤN LUYỆN" : "VÕ TRƯỜNG"} · TẠM DỪNG</h2><div class="row"><button class="primary" data-a="resume">Tiếp tục</button><button data-a="quit">${tut ? "Rời huấn luyện" : "Rời Võ trường"}</button></div>${controlsHTML(ctx.touch)}</div>` : "";
      if (on) {
        document.exitPointerLock?.(); ctx.audio.suspend(); music?.pause();
        overlay.querySelector("[data-a=resume]").onclick = () => pause(false);
        overlay.querySelector("[data-a=quit]").onclick = () => {
          if (ctx.director.over) { finish(ctx.director.result); return; }
          opts.abortedFlag = true; ctx.director.finish(false, "Rời sân."); pause(false);
        };
      } else { ctx.audio.unlock(); music?.resume(); last = performance.now(); }
      if (!on && ctx.director.over && endShown) showEnd(ctx.director.result);
    };
    const onLock = () => { if (!document.pointerLockElement && !paused && !finished && !ctx.touch && !ctx.director.over) pause(true); };
    document.addEventListener("pointerlockchange", onLock);
    const onVis = () => { if (document.hidden && !paused && !finished && !ctx.director.over) pause(true); };
    document.addEventListener("visibilitychange", onVis);
    const finish = (res) => {
      finished = true; cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize); document.removeEventListener("pointerlockchange", onLock); document.removeEventListener("visibilitychange", onVis);
      input.dispose(); ctx.audio.close(); releaseGpu(scene, renderer);    // như battle.js: không thì sân cũ ở lại bộ nhớ
      resolve(res);
    };
    const showEnd = (res) => {
      overlay.classList.add("on"); document.exitPointerLock?.();
      const medal = res.medal ? MEDALS.find((m) => m.id === res.medal).name : null;
      const line = res.mode === "duako" ? `${res.ko} KO trong 180 s` : res.cleared ? `Hạ hết 5 đợt trong ${fmt1(res.clearSec)}` : res.why;
      overlay.innerHTML = `<div class="panel end ${medal ? "win" : "lose"}"><h2>${res.aborted ? "RỜI SÂN" : medal ? `HUY CHƯƠNG ${medal.toUpperCase()}` : res.mode === "luyentap" ? "KẾT THÚC LUYỆN TẬP" : "CHƯA ĐẠT"}</h2><p>${line}</p><div class="row"><button class="primary" data-a="leave">Về Doanh trại</button></div></div>`;
      overlay.querySelector("[data-a=leave]").onclick = () => finish(res);
    };

    const step = (dt, inp, draw) => {
      time += dt; ctx.touch = inp.touch;
      const d = ctx.director;
      if (inp.pressed.pause && !d.over) { pause(true); input.endFrame(); return; }
      ctx.audio.listener.x = ctx.hero.x; ctx.audio.listener.z = ctx.hero.z; ctx.audio.listener.yaw = cam.yaw;
      if (!d.over) {
        if (inp.pressed.lock) ctx.hero.toggleLock();
        let scale = 1;
        if (slowT > 0) { slowT -= dt; scale *= slowK; }
        if (ctx.hitstopT > 0) { ctx.hitstopT -= dt; scale = 0; }
        ctx.hero.intake(inp); d.intake?.(inp);
        acc += dt * scale; let steps = 0;
        while (acc >= STEP && steps < 4) {
          acc -= STEP; steps++; ctx.clock += STEP;
          ctx.hero.update(STEP, inp);
          ctx.crowd.update(STEP); for (const u of ctx.units) u.update(STEP); d.update(STEP);
          if (ctx.hitstopT > 0) break;
        }
        if (steps === 4) acc = 0;
        for (let i = ctx.units.length - 1; i >= 0; i--) if (!ctx.units[i].alive) ctx.units.splice(i, 1);
      } else d.update(dt);
      const h = ctx.hero;
      if (Math.abs(inp.camDX) + Math.abs(inp.camDY) > 0.01) cam.idle = 0; else cam.idle += dt;
      cam.yaw -= inp.camDX * (inp.touch ? 0.006 : 0.0026);
      cam.pitch = Math.max(0.12, Math.min(0.95, cam.pitch + inp.camDY * 0.002));
      if (h.lock?.alive && !h.lock.dead) cam.yaw = lerpAngle(cam.yaw, Math.atan2(h.lock.x - h.x, h.lock.z - h.z), Math.min(1, dt * 3));
      else if (cam.idle > 1.2 && h.state === "free" && h.inputMag > 0.3) cam.yaw = lerpAngle(cam.yaw, h.yaw, Math.min(1, dt * 0.8 * h.inputMag));
      cam.pull = Math.max(0, cam.pull - dt * 0.6);
      const dist = cam.dist + cam.pull * 5, fx = Math.sin(cam.yaw), fz = Math.cos(cam.yaw);
      const tx = h.x, ty = h.y + 1.6, tz = h.z;
      const cx = tx - fx * dist * Math.cos(cam.pitch), cz = tz - fz * dist * Math.cos(cam.pitch), cy = Math.max(ty + dist * Math.sin(cam.pitch), heightAt(cx, cz) + 1.2);
      const k = time < 0.2 ? 1 : Math.min(1, dt * 10);
      cam.x += (cx - cam.x) * k; cam.y += (cy - cam.y) * k; cam.z += (cz - cam.z) * k;
      const fxk = ctx.fx;            // rung + giật camera theo hướng chém, thu FOV (như battle.js)
      camera.position.set(cam.x + fxk.shakeX + fxk.kickX, cam.y + fxk.shakeY + fxk.kickY, cam.z + fxk.kickZ); camera.lookAt(tx + fxk.kickX * 0.5, ty, tz + fxk.kickZ * 0.5);
      const fov = 55 - fxk.fovPunch; if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
      ctx.world.fadeOccluders(camera.position, tx, tz, dt);
      ctx.world.sun.position.set(h.x - 40, 80, h.z + 30); ctx.world.sun.target.position.set(h.x, 0, h.z);
      ctx.world.update(time); ctx.crowd.render(); ctx.fx.update(dt, W, H); ctx.hud.update();
      if (draw) renderer.render(scene, camera);
      input.endFrame();
      if (d.over && !endShown) { endShown = true; if (d.result?.tutorial) setTimeout(() => finish(d.result), 400); else setTimeout(() => showEnd(d.result), 900); }
    };
    if (window.__hk === ctx) ctx.advance = (sec, bot, draw = false) => { for (let t = 0; t < sec && !finished; t += 1 / 30) { bot?.(ctx); step(1 / 30, input.poll(), draw); if (paused) break; } };
    const frame = (now) => { raf = requestAnimationFrame(frame); const dt = Math.min(0.1, (now - last) / 1000); last = now; if (paused || finished) return; step(dt, input.poll(), true); };
    raf = requestAnimationFrame(frame);
  });
}
