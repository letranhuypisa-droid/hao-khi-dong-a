// battle/battle.js — dựng một trận B15 PROTO, chạy vòng lặp, trả kết quả khi người chơi rời trận.
//
// Vùng chiến đấu chạy bước cố định 1/60 s bằng bộ tích lũy, tối đa 4 bước mỗi khung rồi bỏ phần
// dư (15.2). Hit-stop dừng đồng hồ trận; vòng Mệnh Lệnh làm chậm ×0,2.

import * as THREE from "three";
import { buildWorld, heightAt } from "./world.js";
import { Crowd } from "./crowd.js";
import { Hero } from "./hero.js";
import { Director } from "./director.js";
import { FX } from "./fx.js";
import { Audio } from "./audio.js";
import { Input } from "./input.js";
import { HUD } from "./hud.js";
import { createSim } from "../sim/front.js";
import { createHaoKhi } from "../sim/haokhi.js";
import { makeRng } from "../core/rng.js";
import { FRONTS, BASES, ENEMY_MIX } from "../data/battle-b15.js";
import { DIFFICULTY, TROOP_LEVELS, HERO, ORDERS, MODES } from "../data/tuning.js";
import { heroStats } from "../meta/progress.js";

const STEP = 1 / 60;

export function runBattle({ container, save, R, difficulty, mode = "nhanh", music, onSettings }) {
  return new Promise((resolve) => {
    const settings = save.settings;
    const diff = DIFFICULTY.find((d) => d.id === difficulty) || DIFFICULTY[1];
    const stats = heroStats(save, R);
    stats.guardBase = HERO.bodyguards + stats.mods.bodyguards;

    container.innerHTML = `<canvas class="game"></canvas><div class="hud"></div><div class="overlay"></div><div class="touch"></div>`;
    const canvas = container.querySelector("canvas"), hudRoot = container.querySelector(".hud");
    const overlay = container.querySelector(".overlay"), touchRoot = container.querySelector(".touch");

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = settings.shadows; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, 1, 0.3, 1400);

    const seed = (Date.now() & 0xffff) ^ (R * 977);
    const ctx = {
      scene, camera, renderer, R, diff, stats, save,
      rng: makeRng(seed), clock: 0, openGates: { A3: false, B3: false }, units: [],
      troops: TROOP_LEVELS.find((t) => t.id === settings.troops) || TROOP_LEVELS[1],
      touch: false, mode, music,
    };
    ctx.world = buildWorld(scene, { shadows: settings.shadows });
    ctx.sim = createSim({ fronts: FRONTS, bases: BASES, enemyMix: ENEMY_MIX, R, mods: {
      unitSimC: stats.legionSimC, reinfAmt: stats.mods.reinfAmt, reinfCharges: stats.mods.reinfCharges,
      holdThu: stats.mods.holdThu, skPer5: stats.mods.skPer5, cmdCdMult: stats.mods.cmdCdMult, allyHpPct: stats.mods.allyHpPct } });
    ctx.hk = createHaoKhi({ quick: MODES[mode].hkQuick, start: stats.mods.hkStart, gainPct: stats.mods.hkPct, decayMult: stats.mods.hkDecay, tpcExt: stats.mods.tpcExt });
    ctx.audio = new Audio(settings.volume); ctx.audio.unlock();
    music?.play("battle");
    ctx.fx = new FX(scene, camera, hudRoot);
    ctx.crowd = new Crowd(scene, ctx);
    ctx.hero = new Hero(ctx, stats);
    const input = new Input(canvas);
    ctx.hud = new HUD(hudRoot, ctx);
    new Director(ctx);
    if (location.search.includes("debug")) { window.__hk = ctx; ctx.input = input; }   // chỉ để kiểm thử bằng script
    ctx.hitstopT = 0;
    ctx.hitstop = (ms) => { ctx.hitstopT = Math.max(ctx.hitstopT, ms / 1000); };
    const cam = ctx.cam = { yaw: Math.PI / 2, pitch: 0.42, dist: 10.5, idle: 0, x: 0, y: 0, z: 0, pull: 0 };
    let slowT = 0, slowK = 1;
    ctx.cinematic = (text, unit, big) => {
      ctx.hud.cinematic(text);
      slowT = big ? 1.5 : 0.6; slowK = big ? 0.25 : 0.4; cam.pull = big ? 1 : 0.4;
      const gold = hudRoot.querySelector(".fx-gold"); gold.classList.remove("on"); void gold.offsetWidth; gold.classList.add("on");
    };
    const v3 = new THREE.Vector3();
    let W = 1, H = 1;
    ctx.project = (x, y, z) => { v3.set(x, y, z).project(camera); if (v3.z > 1) return null; return { x: (v3.x * 0.5 + 0.5) * W, y: (-v3.y * 0.5 + 0.5) * H }; };

    // ---- cỡ khung, tỉ lệ render ----------------------------------------------------------
    const resize = () => {
      W = container.clientWidth; H = container.clientHeight;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2) * (save.settings.renderScale || 1));
      renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", resize); resize();

    // ---- cảm ứng -------------------------------------------------------------------------
    const wantTouch = settings.touch === "on" || (settings.touch === "auto" && matchMedia("(pointer: coarse)").matches);
    if (wantTouch) buildTouch(touchRoot, input, ctx);

    // ---- tạm dừng, kết quả -----------------------------------------------------------------
    let paused = false, finished = false, raf = 0, last = performance.now(), acc = 0;
    const pause = (on) => {
      if (finished) return;
      paused = on; overlay.innerHTML = on ? pauseHTML(save) : ""; overlay.classList.toggle("on", on);
      if (on) { document.exitPointerLock?.(); bindPause(); ctx.audio.suspend(); music?.pause(); } else { ctx.audio.unlock(); music?.resume(); last = performance.now(); }
    };
    const bindPause = () => {
      overlay.querySelector("[data-a=resume]").onclick = () => pause(false);
      overlay.querySelector("[data-a=retry]").onclick = () => { ctx.director.restoreCheckpoint(); pause(false); };
      overlay.querySelector("[data-a=quit]").onclick = () => { ctx.director.lose("Rút quân khỏi trận.", false); pause(false); };
      overlay.querySelectorAll("[data-set]").forEach((el) => el.onchange = () => {
        const k = el.dataset.set, v = el.type === "checkbox" ? el.checked : el.type === "range" ? Number(el.value) : el.value;
        save.settings[k] = v; onSettings?.(save.settings);
        if (k === "troops") { ctx.troops = TROOP_LEVELS.find((t) => t.id === v); ctx.director.fillActors(false); }
        if (k === "renderScale") resize();
        if (k === "volume") ctx.audio.setVolume(v);
        if (k === "music") music?.setVolume(v);
        if (k === "shadows") { renderer.shadowMap.enabled = v; scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; }); }
      });
    };
    const onLockChange = () => { if (!document.pointerLockElement && !paused && !finished && !ctx.touch && !ctx.director.over) pause(true); };
    document.addEventListener("pointerlockchange", onLockChange);
    const onVis = () => { if (document.hidden && !paused && !finished) pause(true); };
    document.addEventListener("visibilitychange", onVis);

    const showEnd = (res) => {
      overlay.classList.add("on");
      overlay.innerHTML = `<div class="panel end ${res.won ? "win" : "lose"}">
        <h2>${res.won ? "THẮNG TRẬN" : "THUA TRẬN"}</h2><p>${res.why}</p>
        <div class="row">${res.canRetry ? `<button data-a="retry" class="primary">Tải lại đầu pha ${ctx.director.phase + 1}</button>` : ""}
        <button data-a="leave" class="${res.canRetry ? "" : "primary"}">${res.won ? "Xem kết quả" : "Rời trận"}</button></div></div>`;
      document.exitPointerLock?.();
      const r = overlay.querySelector("[data-a=retry]");
      if (r) r.onclick = () => { overlay.classList.remove("on"); overlay.innerHTML = ""; ctx.director.restoreCheckpoint(); last = performance.now(); };
      overlay.querySelector("[data-a=leave]").onclick = () => finish(res);
    };
    const finish = (res) => {
      finished = true; cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("pointerlockchange", onLockChange);
      document.removeEventListener("visibilitychange", onVis);
      input.dispose(); ctx.audio.suspend();
      renderer.dispose(); scene.traverse((o) => { o.geometry?.dispose?.(); });
      resolve(res);
    };

    // ---- vòng lặp ------------------------------------------------------------------------
    let hudAcc = 0, endShown = false, time = 0;
    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (paused || finished) return;
      step(dt, input.poll(), true);
    };
    // Tua trận bằng script (chỉ khi ?debug): chạy logic không cần requestAnimationFrame.
    if (window.__hk === ctx) ctx.advance = (sec, bot, draw = false) => {
      for (let t = 0; t < sec && !finished; t += 1 / 30) { bot?.(ctx); step(1 / 30, input.poll(), draw); if (paused) break; }
    };
    const step = (dt, inp, draw) => {
      time += dt;
      ctx.touch = inp.touch;
      if (inp.pressed.pause) { pause(true); input.endFrame(); return; }
      ctx.audio.listener.x = ctx.hero.x; ctx.audio.listener.z = ctx.hero.z;

      const d = ctx.director;
      if (!d.over) {
        // vòng lệnh (giữ Tab)
        ctx.hud.setRing(inp.cmdHeld);
        if (inp.cmdHeld) {
          if (inp.pressed.cmdSwap || inp.pressed.lock) ctx.hud.swapFront();
          ["cmd1", "cmd2", "cmd3", "cmd4"].forEach((k, i) => { if (inp.pressed[k]) ctx.hud.issue(["tiencong", "giuvung", "theota", "tiepvien"][i]); });
          inp.pressed.lock = false;
        } else ["cmd1", "cmd2", "cmd3", "cmd4"].forEach((k, i) => { if (inp.pressed[k]) ctx.hud.issue(["tiencong", "giuvung", "theota", "tiepvien"][i]); });
        if (inp.pressed.tpc) d.tryTPC();
        if (inp.pressed.kesach) d.keSach.trigger();
        if (inp.pressed.lock) ctx.hero.toggleLock();
        if (inp.pressed.map) ctx.hud.root.classList.toggle("bigmap");

        let scale = inp.cmdHeld ? 0.2 : 1;
        if (slowT > 0) { slowT -= dt; scale *= slowK; }
        if (ctx.hitstopT > 0) { ctx.hitstopT -= dt; scale = 0; }
        ctx.hero.intake(inp);
        acc += dt * scale;
        let steps = 0;
        while (acc >= STEP && steps < 4) {
          acc -= STEP; steps++; ctx.clock += STEP;
          ctx.hero.update(STEP, inp);
          ctx.crowd.update(STEP);
          for (const u of ctx.units) u.update(STEP);
          d.update(STEP);
          if (ctx.hitstopT > 0) break;
        }
        if (steps === 4) acc = 0;
        for (let i = ctx.units.length - 1; i >= 0; i--) if (!ctx.units[i].alive) ctx.units.splice(i, 1);
      }
      // camera
      const h = ctx.hero;
      if (Math.abs(inp.camDX) + Math.abs(inp.camDY) > 0.01) cam.idle = 0; else cam.idle += dt;
      cam.yaw -= inp.camDX * (inp.touch ? 0.006 : 0.0026);
      cam.pitch = Math.max(0.12, Math.min(0.95, cam.pitch + inp.camDY * 0.002));
      if (h.lock?.alive && !h.lock.dead) cam.yaw = lerpAngle(cam.yaw, Math.atan2(h.lock.x - h.x, h.lock.z - h.z), Math.min(1, dt * 3));
      else if (cam.idle > 1.2 && h.state === "free" && h.inputMag > 0.3) cam.yaw = lerpAngle(cam.yaw, h.yaw, Math.min(1, dt * 0.8 * h.inputMag));
      cam.pull = Math.max(0, cam.pull - dt * 0.6);
      const dist = cam.dist + cam.pull * 5, fx = Math.sin(cam.yaw), fz = Math.cos(cam.yaw);
      const tx = h.x, ty = h.y + 1.6, tz = h.z;
      let cx = tx - fx * dist * Math.cos(cam.pitch), cz = tz - fz * dist * Math.cos(cam.pitch), cy = ty + dist * Math.sin(cam.pitch);
      cy = Math.max(cy, heightAt(cx, cz) + 1.2);
      const k = Math.min(1, dt * 10);
      cam.x += (cx - cam.x) * k; cam.y += (cy - cam.y) * k; cam.z += (cz - cam.z) * k;
      if (time < 0.2) { cam.x = cx; cam.y = cy; cam.z = cz; }
      camera.position.set(cam.x + ctx.fx.shakeX, cam.y + ctx.fx.shakeY, cam.z);
      camera.lookAt(tx, ty, tz);
      const sun = ctx.world.sun; sun.position.set(h.x - 60, 90, h.z + 50); sun.target.position.set(h.x, 0, h.z);

      // cổng: rung khi trúng, đổ khi phá
      for (const id in ctx.world.gates) {
        const g = ctx.world.gates[id];
        if (g.broken) { g.lp.rotation.y = Math.min(1.5, g.lp.rotation.y + dt * 2); g.rp.rotation.y = Math.max(-1.5, g.rp.rotation.y - dt * 2); g.doors.rotation.z = Math.min(0.12, g.doors.rotation.z + dt * 0.2); }
        else { g.lp.rotation.y = g.rp.rotation.y = 0; g.doors.rotation.z = 0; }
        if (g.shake > 0) { g.shake -= dt; g.doors.position.x = g.x + (Math.random() - 0.5) * 0.15; } else g.doors.position.x = g.x;
      }
      for (const [id, v] of Object.entries(ctx.world.bases)) if (v.ring) v.ring.visible = ctx.sim.bases[id].type !== "cong" || !ctx.openGates[id];
      for (const fid in FRONTS) ctx.world.setLine(fid, ctx.sim.fronts[fid].x);

      if (ctx.hk.tpc && Math.random() < dt * 7) ctx.fx.embers(ctx.hero.x, ctx.hero.z);   // tàn lửa Tổng Phản Công
      ctx.world.update(time);
      ctx.crowd.render();
      ctx.fx.update(dt, W, H);
      hudAcc += dt;
      if (hudAcc > 0.05) { ctx.hud.update(hudAcc, W, H); hudAcc = 0; }
      if (draw) renderer.render(scene, camera);
      input.endFrame();

      // nhạc: P4 và Tổng Phản Công đổi sang bài trận boss
      if (!d.over && music) music.play(ctx.hk.tpc || d.phase === 3 ? "boss" : "battle", { fade: 2 });
      if (d.over && !endShown && music) { if (d.result.won) music.play("victory", { loop: false, then: "hub" }); else music.stop(2); }
      if (d.over && !endShown) { endShown = true; setTimeout(() => showEnd(d.result), d.result.won ? 1200 : 1800); }
      if (!d.over) endShown = false;
    };
    raf = requestAnimationFrame(frame);
  });
}

export function lerpAngle(a, b, t) {
  let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
  return a + d * t;
}

function pauseHTML(save) {
  const s = save.settings;
  const opt = (v, cur, label) => `<option value="${v}" ${v === cur ? "selected" : ""}>${label}</option>`;
  return `<div class="panel pause">
    <h2>TẠM DỪNG</h2>
    <div class="row"><button class="primary" data-a="resume">Tiếp tục</button><button data-a="retry">Tải lại đầu pha</button><button data-a="quit">Rút quân</button></div>
    <h3>Cài đặt (đổi được giữa trận)</h3>
    <label>Số lính hiển thị <select data-set="troops">${TROOP_LEVELS.map((t) => opt(t.id, s.troops, `${t.name} · ${t.N}`)).join("")}</select></label>
    <label>Tỉ lệ render <input type="range" min="0.5" max="1" step="0.05" value="${s.renderScale}" data-set="renderScale"></label>
    <label>Bóng <input type="checkbox" ${s.shadows ? "checked" : ""} data-set="shadows"></label>
    <label>Âm lượng hiệu ứng <input type="range" min="0" max="1" step="0.05" value="${s.volume}" data-set="volume"></label>
    <label>Âm lượng nhạc <input type="range" min="0" max="1" step="0.05" value="${s.music ?? 0.5}" data-set="music"></label>
    <p class="small">Số lính hiển thị chỉ đổi phần vẽ; mô phỏng và vùng chiến đấu cho cùng kết quả ở mọi mức.</p>
    ${controlsHTML()}
  </div>`;
}

export function controlsHTML() {
  return `<h3>Điều khiển</h3><table class="keys">
    <tr><td>WASD</td><td>Di chuyển</td><td>Chuột / ← →</td><td>Xoay camera (bấm vào màn để khóa chuột)</td></tr>
    <tr><td>Chuột trái / J</td><td>Đòn thường N (chuỗi N1–N6)</td><td>Chuột phải / K</td><td>Đòn mạnh C (sau N<sub>k</sub> ra C<sub>k+1</sub>)</td></tr>
    <tr><td>Space</td><td>Né (i-frame 0,25 s); Né → N/C = Lướt</td><td>Shift / L</td><td>Đỡ (giữ); bấm đúng lúc đòn viền đỏ = Phản đòn</td></tr>
    <tr><td>E</td><td>Phá Trận (3 lần lao)</td><td>R</td><td>Tuyệt Kỹ (1 vạch Khí Lực)</td></tr>
    <tr><td>F</td><td>Tổng Phản Công (Hào Khí 100)</td><td>Q</td><td>Khóa mục tiêu</td></tr>
    <tr><td>G</td><td>Lệnh Kế Sách (khi Sẵn sàng)</td><td></td><td></td></tr>
    <tr><td>Tab (giữ)</td><td>Vòng Mệnh Lệnh; 1–4 ra lệnh, Z đổi mặt trận</td><td>M · Esc</td><td>Bản đồ lớn · Tạm dừng</td></tr>
    <tr><td>Tay cầm</td><td colspan="3">X đòn N · Y đòn C · A né · RB đỡ · LB Phá Trận · B Tuyệt Kỹ · LT giữ = Mệnh Lệnh (D-pad chọn, LB đổi mặt trận) · D-pad lên = Tổng Phản Công · D-pad phải = Kế Sách</td></tr>
  </table>`;
}

export function buildTouch(root, input, ctx) {
  root.classList.add("on"); root.parentElement.classList.add("touchmode");
  root.innerHTML = `
    <div class="stick" data-t="stick"><div class="knob"></div></div>
    <div class="camzone" data-t="cam"></div>
    <div class="tbtns">
      <button data-b="n" class="big">N</button><button data-b="c" class="mid">C</button>
      <button data-b="dodge">Né</button><button data-b="block">Đỡ</button>
      <button data-b="skill">Phá<br>Trận</button><button data-b="ult">Tuyệt<br>Kỹ</button>
    </div>
    <div class="tsys"><button data-b="kesach">Kế<br>Sách</button><button data-b="cmd">Lệnh</button><button data-b="tpc">Phản<br>Công</button><button data-b="lock">Khóa</button><button data-b="pause">II</button></div>`;
  root.querySelectorAll("[data-b]").forEach((b) => {
    const name = b.dataset.b;
    const down = (e) => { e.preventDefault(); ctx.audio.unlock(); if (name === "cmd") { input.touchButton("cmd", !input.touchHeld.cmd); return; } input.touchButton(name, true); b.classList.add("on"); };
    const up = (e) => { e.preventDefault(); if (name === "cmd") return; input.touchButton(name, false); b.classList.remove("on"); };
    b.addEventListener("pointerdown", down); b.addEventListener("pointerup", up); b.addEventListener("pointercancel", up); b.addEventListener("pointerleave", up);
  });
  const stick = root.querySelector("[data-t=stick]"), knob = stick.querySelector(".knob");
  let sid = null, ox = 0, oy = 0;
  stick.addEventListener("pointerdown", (e) => { sid = e.pointerId; const r = stick.getBoundingClientRect(); ox = r.left + r.width / 2; oy = r.top + r.height / 2; stick.setPointerCapture(sid); move(e); });
  const move = (e) => {
    if (e.pointerId !== sid) return;
    let dx = e.clientX - ox, dy = e.clientY - oy; const R = 55, l = Math.hypot(dx, dy);
    if (l > R) { dx *= R / l; dy *= R / l; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`; input.setStick(dx / R, -dy / R);
  };
  stick.addEventListener("pointermove", move);
  const end = (e) => { if (e.pointerId !== sid) return; sid = null; knob.style.transform = ""; input.setStick(0, 0); };
  stick.addEventListener("pointerup", end); stick.addEventListener("pointercancel", end);
  const camz = root.querySelector("[data-t=cam]");
  let cid = null, lx = 0, ly = 0;
  camz.addEventListener("pointerdown", (e) => { cid = e.pointerId; lx = e.clientX; ly = e.clientY; camz.setPointerCapture(cid); });
  camz.addEventListener("pointermove", (e) => { if (e.pointerId !== cid) return; input.touchCam(e.clientX - lx, e.clientY - ly); lx = e.clientX; ly = e.clientY; });
  camz.addEventListener("pointerup", () => (cid = null));
}
