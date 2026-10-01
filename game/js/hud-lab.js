// hud-lab.js — phòng thử HUD B20 (hud-lab.html, chỉ dùng khi phát triển): dựng HUD thật (battle/hud.js) + HudB20 (hud-b20.js)
// trên một ctx giả (tướng H31, Hào Khí, director rỗng) và một hudState giả theo từng cảnh, nền là lab-b20.html (thế giới thật,
// hạm đội mẫu — bản đồ nhỏ lấy thuyền từ đó). Không chạy luật trận; để xem và chụp màn từng trạng thái widget.
//
//   hud-lab.html?s=p1in          cảnh (danh sách SCENES dưới; thanh chọn ở đáy màn)
//   &touch                       dựng nút cảm ứng như điện thoại (battle.js buildTouch)
//   &plain                       nền phẳng thay cho lab-b20 (nhanh, không WebGL)
//   &nobar                       ẩn thanh chọn cảnh (chụp màn)
//   &p=0.6                       tiến độ vòng giữ phím của nhắc Tương tác (nếu cảnh có)
// window.__hudlab: { ctx, hudB20, state, set(name), tick(sec), ready } cho kịch bản chụp (tools/shot.mjs).

import { HUD } from "./battle/hud.js";
import { HudB20, HUD_B20, riverHud } from "./battle/hud-b20.js";
import { buildTouch } from "./battle/battle.js";
import { HEROES, SKILLS } from "./data/heroes.js";
import { moveInfoOf } from "./data/moves-info.js";
import { PHASES, MAP, BOSSES, TIDE } from "./data/battle-b20.js";
import { createRiver, setPhase, riverTick } from "./sim/river.js";
import { zc } from "./data/terrain-b20.js";

const Q = new URLSearchParams(location.search);
if (Q.has("nobar")) document.body.classList.add("nobar");
const stage = document.querySelector(".stage");

// ---- nền: lab-b20 trong iframe (cùng gốc: đọc được __labb20 để lấy thuyền cho bản đồ nhỏ) ------------------------------
const BG = {   // tham số lab-b20 theo pha: Con nước, giờ hạm đội, góc máy
  0: "tide=88&t=6&cam=start", 1: "tide=74&t=150&cam=reach&boom", 2: "tide=55&t=175&cam=reach&boom&stakes=hidden",
  3: "tide=38&t=175&cam=reach&boom&stakes=active", 4: "tide=0&t=175&cam=strand&strand&stakes=active", 5: "tide=0&t=175&cam=strand&strand&stakes=active",
};

// ---- ctx giả ---------------------------------------------------------------------------------------------------------------
const def = HEROES.H31, info = moveInfoOf(def);
const hero = {
  def, id: "H31", kiBars: def.kiLucBars, moveInfo: info, x: 520, z: zc(520) - 6, yaw: Math.PI / 2, alive: true, state: "free",
  hp: 1720, maxHp: 2280, ki: 260, revives: 1, buffs: {}, combo: 0, lock: null, invuln: 0, chargeLevel: 0, lienHoan: 0,
  dodgeCd: 0, chainGrace: 0, chain: 0, move: null, hkUltReady: false, F: null,
  nearestEnemy: () => null,
  skillSlots() {
    return [{ slot: 1, id: "hichTuongSi", key: "E", name: SKILLS.hichTuongSi.name, icon: info.skill.icon, ready: true, cd: "" },
            { slot: 2, id: "binhThu", key: "T", name: SKILLS.binhThu.name, icon: info.skill2.icon, ready: false, cd: 12 }];
  },
  ultInfo() { return { id: "bachDang", name: SKILLS.bachDang.name, icon: info.ult.icon, key: "R", cost: 100, ready: this.ki >= 100, cd: `${Math.floor(this.ki / 100)}/4` }; },
  nextHeavyInfo() { return { id: "C1", key: "C1", icon: "c1", name: info.C1.name, label: `C1 ${info.C1.name}`, hot: false, ready: false, charge: 0 }; },
};
const director = { phase: 0, time: 0, baseHint: "", M: { par: 780 }, events: {}, keSach: { hud: () => [] }, msgs: [], ko: 0, pickups: [], followers: null,
  lastFront: null, order() {} };
const ctx = {
  mode: "nhanh", touch: Q.has("touch"), battle: { id: "B20", data: { PHASES, FRONTS: {}, EVENTS: {} }, hud: HUD_B20, par: { nhanh: 780, chuan: 780 }, touch: { interact: true } },
  hero, director, sim: { fronts: {}, heroFront: null, cooldowns: {}, reinf: null }, hk: { value: 46, overflow: 0, tpc: false, tpcLeft: 0 },
  stats: { level: 25, mods: {} }, crowd: { agents: [] }, units: [], project: () => null, R: 25,
  audio: { play: (n) => lab.sounds.push(n), unlock() {} }, naval: null,
};
const lab = window.__hudlab = { ctx, sounds: [], picked: null, bgReady: Q.has("plain"), ready: false };

// ---- các cảnh: sim/river.js thật tua tới trạng thái cần xem + phần director giả (boss, Tương tác, Đò chuyển) -------------
const TIDE0 = { 1: 100, 2: 57 };                      // Con nước lúc vào pha (sim tua thẳng từ P1 thì chưa đúng mức)
function river(phase, fn) {
  const st = createRiver({ mode: "nhanh", quyetSachOk: true });
  for (let p = 1; p <= phase; p++) setPhase(st, p);
  if (TIDE0[phase] != null) st.tide = st.tide0 = TIDE0[phase];
  fn?.(st);
  return st;
}
const tickN = (st, n) => { for (let i = 0; i < n; i++) riverTick(st, []); };
const X24 = BOSSES.X24, X20 = BOSSES.X20;
const boss = (B, o) => ({ id: B.id, name: B.name, nameHan: B.nameHan, title: B.id === "X20" ? "Vạn hộ thủy quân Nguyên · Đại tướng" : "Tướng thủy quân Nguyên",
  maxHp: B.id === "X20" ? 12000 : 4200, poiseMax: B.poise, phases: B.poisePhases ?? 1, phase: 1, hpLock: B.hpLockPct ?? 0, broken: false, captured: false, ...o });
const FERRY = { items: [
  { id: "esc3", label: "Thuyền hộ vệ đã chiếm", sub: "cách 60 m · cờ 陳", kind: "captured" },
  { id: "M2", label: "Bè cỏ mốc M2", sub: "cách 110 m · mốc cọc ẩn", kind: "raft" },
  { id: "P_S", label: "Bến phục binh bờ nam", sub: "cách 180 m", kind: "pier" },
  { id: "flag", label: "Kỳ hạm Ô Mã Nhi", sub: "cách 240 m · còn hộ vệ: chưa áp mạn", kind: "flagship" },
], onPick: (it) => { lab.picked = it.id; } };
const P = Number(Q.get("p") ?? 0.55);

const SCENES = {
  p1in: () => ({ hk: 38, st: riverHud(river(0, (s) => { tickN(s, 22); s.nghi.gap = 27; s.nghi.kk = 62; s.nghi.stance = "giuvung"; s.nghi.lost = 1; s.wings.flotilla.boats = 7; })) }),
  p1near: () => ({ hk: 44, st: riverHud(river(0, (s) => { tickN(s, 40); s.nghi.gap = 11.5; s.nghi.kk = 100; s.ks.nghiBinh.state = "sansang"; s.ks.nghiBinh.got = 5; s.nghi.stance = "tiencong"; s.nghi.stanceCd = 2; s.nghi.lost = 2; s.wings.flotilla.boats = 6; })) }),
  p1far: () => ({ hk: 34, st: riverHud(river(0, (s) => { tickN(s, 15); s.nghi.gap = 49; s.nghi.kk = 28; s.nghi.stance = "theota"; })) }),
  p2: () => ({ hk: 58, st: riverHud(river(1, (s) => { tickN(s, 50); s.fleet.escortsDown = 2; s.fleet.captured = 2; }), { scout: { target: "M1", sec: 12, warn: true },
    interact: { text: "Chiếm thuyền hộ vệ", p: P, kind: "capture" } }) }),
  p3: () => ({ hk: 66, st: riverHud(river(2, (s) => { tickN(s, 38); s.markers.M1.state = "active"; s.markers.M3.state = "exposed"; s.markers.M2.officerOn = true; s.markers.M2.officerOnT = 6; s.ks.kichCoc.got = 5; }),
    { interact: { text: "Mở bãi cọc · chặt dây bè cỏ", p: P, kind: "marker" } }) }),
  p3ready: () => ({ hk: 74, st: riverHud(river(2, (s) => { tickN(s, 60); s.markers.M1.state = "active"; s.markers.M2.state = "active"; s.ks.kichCoc.state = "sansang"; s.ks.kichCoc.got = 10; })) }),
  p4: () => ({ hk: 82, st: riverHud(river(3, (s) => { tickN(s, 32); s.escape.value = 58; s.wings.rut.order = { id: "giuvung", left: 12 }; s.fleet.escortsDown = 9; s.fleet.downP4 = 3; }), { escorts: null }) }),
  p4warn: () => ({ hk: 88, st: riverHud(river(3, (s) => { tickN(s, 60); s.escape.value = 86; s.fleet.downP4 = 4; }), {}) }),
  p5boss: () => ({ hk: 92, st: riverHud(river(4), { bosses: [boss(X24, { hp: 2310, poise: 380 })], interact: null }) }),
  p5ferry: () => ({ hk: 92, st: riverHud(river(4), { bosses: [boss(X24, { hp: 2310, poise: 380 })], ferry: FERRY }) }),
  p5broken: () => ({ hk: 95, st: riverHud(river(4), { bosses: [boss(X24, { hp: 1200, poise: 0, broken: true })] }) }),
  p6lock: () => ({ hk: 100, st: riverHud(river(5), { hkLock: true, bosses: [boss(X20, { hp: 1200, poise: 620, phase: 2 })] }) }),
  p6broken: () => ({ hk: 100, tpc: true, st: riverHud(river(5), { bosses: [boss(X20, { hp: 1200, poise: 0, phase: 2, broken: true })] }) }),
  p6captured: () => ({ hk: 100, tpc: true, st: riverHud(river(5), { bosses: [boss(X20, { hp: 1200, poise: 0, phase: 2, captured: true })] }) }),
};

// ---- dựng ------------------------------------------------------------------------------------------------------------------
const name = Q.get("s") in SCENES ? Q.get("s") : "p1in";
const sc = SCENES[name]();
director.phase = sc.st.phase; director.time = [40, 150, 300, 420, 560, 700][sc.st.phase] + 7;
director.baseHint = PHASES[sc.st.phase].goal;
ctx.hk.value = sc.hk; ctx.hk.tpc = !!sc.tpc; ctx.hk.tpcLeft = sc.tpc ? 19 : 0;
director.msgs = [{ text: ["Thuyền nhẹ: giữ khoảng cách 15–40 m với thuyền đầu hạm đội.", "Thuyền dò luồng rời hạm đội, nhắm mốc M1!", "Tướng địch đang đứng ở mốc M2 — hạ hắn trước khi mốc lộ.",
  "Nước rút! Mỗi thuyền hộ vệ bị hạ kéo Thoát vây −15.", "Phàn Tiếp xích thuyền: Liên Hoàn Thuyền!", "Kỳ hạm mắc cạn! Hào Khí khóa 100."][sc.st.phase], T: 9, t: 1, kind: "info" }];

const hudRoot = document.createElement("div"); hudRoot.className = "hud"; stage.appendChild(hudRoot);
const touchRoot = document.createElement("div"); touchRoot.className = "touch"; stage.appendChild(touchRoot);
if (Q.has("plain")) stage.classList.add("plain");
else {
  const f = document.createElement("iframe");
  f.src = `./lab-b20.html?hide&still&noshadow&${BG[sc.st.phase]}`;
  stage.prepend(f);
  f.addEventListener("load", () => {
    const poll = setInterval(() => {
      const L = f.contentWindow.__labb20; if (!L) return;
      clearInterval(poll); L.render(); ctx.naval = { boats: L.boats }; lab.bgReady = true;
    }, 100);
  });
}
ctx.hud = new HUD(hudRoot, ctx);
if (ctx.touch) buildTouch(touchRoot, { touchButton() {}, touchHeld: {}, setStick() {}, touchCam() {} }, ctx);
const hb = new HudB20(ctx);
const frame = (dt) => { hb.update(sc.st, dt); ctx.hud.update(dt, innerWidth, innerHeight); };
frame(0.06); frame(0.06);

const bar = document.querySelector(".labbar");
bar.innerHTML = Object.keys(SCENES).map((k) => `<a href="?${new URLSearchParams({ ...Object.fromEntries(Q), s: k })}" class="${k === name ? "on" : ""}">${k}</a>`).join("");
let last = performance.now();
const loop = (now) => { const dt = Math.min(0.1, (now - last) / 1000); last = now; frame(dt); requestAnimationFrame(loop); };
requestAnimationFrame(loop);

Object.assign(lab, { hudB20: hb, state: sc.st, scenes: Object.keys(SCENES), ready: true,
  tick: (sec) => { for (let k = 0; k < sec / 0.05; k++) frame(0.05); } });
