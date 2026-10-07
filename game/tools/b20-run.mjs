// b20-run.mjs — chạy trọn một trận B20 Bạch Đằng bằng bot (xác định: Date.now cố định lúc dựng, rAF rỗng, chỉ tua bằng advance)
// và in số đo: thời gian từng pha, Kế Sách, dòng Hào Khí, lúc Tổng Phản Công, số lần gục / Gượng dậy, thuyền tiên phong dọn / đẩy lui,
// tổng thời gian so với par.
//
// CHẠY:  B20_PARAMS='{"diff":"quansi","seed":1001}' node hao-khi-viet/game/tools/shot.mjs hao-khi-viet/game/tools/b20-run.mjs --port 8951
//   (Git Bash: giá trị env không bắt đầu bằng "/")
// THAM SỐ (JSON ở B20_PARAMS, hoặc file ở B20_PARAMS_FILE):
//   diff     quansi | danbinh | tuongquan | …     seed   Date.now cố định lúc dựng trận (seed trận)
//   botSeed  PRNG của bot (mặc định = seed)       bot    "b20" (bot B20, window.__objectiveB20)
//   maxSec   giây tua tối đa (mặc định 1500)      maxRetries  thua thì tải lại checkpoint tối đa bấy nhiêu lần (mặc định 3)
//   shots    thư mục ảnh (null: không chụp) — chụp 2 ảnh mỗi pha (vào pha +6 s, giữa pha) và lúc thắng
//   phase    vào thẳng đầu pha (1..6, ?debug&phase=N)   out   file JSON kết quả (tuỳ chọn)
//   botOpts  opts thêm cho __bot
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const env = process.env;
const DEF = { diff: "quansi", seed: 1001, botSeed: null, bot: "b20", maxSec: 1500, maxRetries: 3, shots: null, phase: null, out: null, botOpts: {}, chunk: 5 };
let P = { ...DEF };
if (env.B20_PARAMS_FILE) P = { ...P, ...JSON.parse(readFileSync(env.B20_PARAMS_FILE, "utf8")) };
if (env.B20_PARAMS) P = { ...P, ...JSON.parse(env.B20_PARAMS) };
if (P.botSeed == null) P.botSeed = P.seed;

const INSTALL = (prm) => `(() => {
  const PRM = ${JSON.stringify(prm)}, c = __hk, d = c.director, h = c.hero;
  const TR = window.__r = { frames: 0, hk: [], samples: [], ev: [], phaseAt: [0], lastPhase: d.phase, rev: h.revives, downs: 0, deaths: 0, lastAlive: true };
  const opts = { seed: PRM.botSeed, ...PRM.botOpts };
  const bot = __bot(window.__objectiveB20, opts);
  const push = (kind, extra = {}) => TR.ev.push({ t: Math.round(d.time * 10) / 10, kind, phase: d.phase + 1, ...extra });
  // theo dõi sự kiện qua móc director (chỉ đọc, gọi hàm gốc)
  const wrap = (name, fn) => { const o = d[name]?.bind(d); d[name] = (...a) => { fn(...a); return o?.(...a); }; };
  wrap("onRevive", () => push("revive", { hp: Math.round(h.hp) }));
  wrap("launchLure", () => push("launch"));
  wrap("beginFight", () => push("beginFight"));
  wrap("tryTPC", () => { if (!c.hk.tpc && c.hk.value >= 100) push("tpc", { hk: Math.round(c.hk.value) }); });
  wrap("onCaptured", (u) => push("captured", { id: u.id }));
  wrap("ferryTo", (id) => push("ferry", { id }));
  const oh = d.handle.bind(d);
  d.handle = (evs) => { for (const e of evs) if (e.type === "ksResult" || e.type === "baited" || e.type === "strandAt" || e.type === "ksOpen" || e.type === "fleetIn" || e.type === "tide50" || e.type === "tideZero") push(e.type, { id: e.id, ok: e.ok, why: e.why }); return oh(evs); };
  window.__rBot = (cc) => {
    const dd = cc.director;
    if (TR.frames % 30 === 0) {
      const st = cc.sim;
      TR.samples.push({ t: Math.round(dd.time), ph: dd.phase + 1, hk: Math.round(cc.hk.value), tide: Math.round(cc.world.tidePct),
        kk: Math.round(st.nghi.kk), gap: Math.round(st.nghi.gap), hp: Math.round(cc.hero.hp / cc.hero.maxHp * 100), ki: Math.round(cc.hero.ki), mode: window.__botDbg?.mode || "" });
    }
    if (dd.phase !== TR.lastPhase) { TR.phaseAt[dd.phase] = Math.round(dd.time); TR.lastPhase = dd.phase; push("phase"); }
    if (cc.hero.alive !== TR.lastAlive) { if (!cc.hero.alive) push("heroDown"); TR.lastAlive = cc.hero.alive; }
    TR.frames++;
    bot(cc);
  };
  return { ok: true, R: c.R, diff: c.diff.id, heroHp: h.maxHp, revives: h.revives, phase: d.phase };
})()`;

const STEP = (n) => `(() => {
  const c = __hk, d = c.director, TR = window.__r;
  const f0 = TR.frames;
  c.advance(${(n - 0.5) / 30}, window.__rBot, false);
  const s = c.battle.debug.state(c);
  return { f: TR.frames, moved: TR.frames - f0, t: d.time, over: !!d.over, won: d.result ? !!d.result.won : null, phase: d.phase,
    canRetry: d.result ? !!d.result.canRetry : null, s, mode: window.__botDbg?.mode };
})()`;

const SHOT = async (p, file) => { await p.eval(`(__hk.advance(0.1, window.__rBot, true), true)`); await p.shot(file); };

export default async (p) => {
  const t0 = Date.now();
  const log = (s) => console.log(`[b20 ${P.diff}/${P.seed}/${P.bot}] ${s}`);
  await p.go("/hao-khi-viet/game/?debug");
  await p.eval(`(async () => {
    const Pm = await import("/hao-khi-viet/game/js/meta/progress.js");
    const s = Pm.newSave(); s.settings.difficulty = ${JSON.stringify(P.diff)}; s.tutorial = { done: true };
    localStorage.setItem("hkda:save:v1", JSON.stringify(s)); return true; })()`);
  await p.go("/hao-khi-viet/game/?debug&battle=B20" + (P.phase ? "&phase=" + P.phase : ""));
  const seed = Number(P.seed) & 0xffff;
  await p.eval(`(() => {
    window.__realNow = Date.now; Date.now = () => ${seed}; window.requestAnimationFrame = () => 0;
    let a = ${(Number(P.seed) * 2654435761) >>> 0}; Math.random = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    return true; })()`);
  await p.eval(`(__start(), true)`);
  let ready = false;
  for (let i = 0; i < 400 && !ready; i++) { ready = await p.eval(`!!(window.__hk && window.__hk.advance && window.__hk.director && window.__hk.director.hudState)`); if (!ready) await p.wait(200); }
  if (!ready) { log("NOT READY " + JSON.stringify(p.errors)); return; }
  await p.eval(`(() => { Date.now = window.__realNow; return true; })()`);
  log("start " + JSON.stringify(await p.eval(INSTALL(P))));
  if (P.shots) mkdirSync(P.shots, { recursive: true });
  const shotAt = {};   // pha → đã chụp
  const maxFrames = Math.round(P.maxSec * 30);
  let last = null, lastLog = -999, lastPh = -1, phT0 = 0;
  for (;;) {
    const left = maxFrames - (last ? last.f : 0);
    if (left <= 0) { log("maxSec"); break; }
    last = await p.eval(STEP(Math.min(Math.round(P.chunk * 30), left)));
    const s = last.s;
    if (last.phase !== lastPh) { lastPh = last.phase; phT0 = last.t; }
    if (last.t - lastLog >= 30) { lastLog = last.t; log(`t=${s.t} P${s.phase + 1} pos=${s.pos} hp=${s.hp} hk=${s.hk} tide=${s.tide} gap=${s.gap} kk=${s.kk} st=${s.stance} raids=${s.raids} tua=${s.tua} ks=${s.ks} deck=${s.deck} bosses=${s.bosses} x20=${s.x20} mode=${last.mode} | ${s.msgs.slice(-1)[0] || ""}`); }
    if (P.shots) {
      const k = last.phase;
      if (!shotAt[k + "a"] && last.t - phT0 >= 6) { shotAt[k + "a"] = 1; await SHOT(p, `${P.shots}/p${k + 1}-a.png`); }
      if (!shotAt[k + "b"] && last.t - phT0 >= [40, 8, 5, 8, 45, 45][k]) { shotAt[k + "b"] = 1; await SHOT(p, `${P.shots}/p${k + 1}-b.png`); }
    }
    if (last.over) {
      if (last.won) { log("WON"); if (P.shots) { await p.eval(`(__hk.advance(3, null, false), true)`); await SHOT(p, `${P.shots}/win-outro.png`); } break; }
      const st = await p.eval(`(() => { const d = __hk.director; window.__r.ev.push({ t: Math.round(d.time), kind: "lost", phase: d.phase + 1, why: d.result.why }); return { retries: d.retries || 0, canRetry: !!d.result.canRetry }; })()`);
      log(`LOST t=${last.t.toFixed(0)} P${last.phase + 1} retries=${st.retries}`);
      if (!st.canRetry || st.retries >= P.maxRetries) break;
      await p.eval(`(() => { __hk.director.restoreCheckpoint(); window.__r.ev.push({ t: Math.round(__hk.director.time), kind: "restore", phase: __hk.director.phase + 1 }); return true; })()`);
      continue;
    }
    if (last.moved === 0) { log("stalled"); break; }
  }
  const out = await p.eval(`(() => {
    const c = __hk, d = c.director, TR = window.__r, res = d.result || d.buildResult(false, "cut"), rr = res.river;
    const ev = TR.ev;
    const bot = window.__botDbg ? Object.fromEntries(Object.entries(window.__botDbg).filter(([k]) => k !== "mode" && k !== "tgt")) : null;
    return { won: !!res.won, why: res.why, timeSec: Math.round(res.timeSec), par: res.parSec, phaseTimes: res.phaseTimes, phaseAt: TR.phaseAt,
      ks: res.keSachList.map((k) => ({ id: k.id, state: k.state, got: k.got, why: k.why || null })), keSachOk: res.keSachOk,
      hkTimeline: TR.samples.filter((s, i) => i % 15 === 0).map((s) => [s.t, s.ph, s.hk]), tpc: res.tpcLog,
      revivesUsed: ev.filter((e) => e.kind === "revive").length, downs: ev.filter((e) => e.kind === "heroDown").length, lost: ev.filter((e) => e.kind === "lost").length,
      retries: d.retries, raidsCleared: d.raidsCleared, raidsRepelled: d.raidsRepelled, strandShare: rr.strandShare, ko: res.ko, main: res.main, side: res.side,
      captured: res.captured, bot, events: ev };
  })()`);
  out.params = P;
  const fmt = (s) => (s == null ? "-" : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`);
  log(`RESULT won=${out.won} time=${fmt(out.timeSec)} (${out.timeSec}s, par ${out.par}) phases=${JSON.stringify(out.phaseTimes)} ks=${out.ks.map((k) => k.id + ":" + k.state).join(" ")} tpc=${JSON.stringify(out.tpc)} revives=${out.revivesUsed} lost=${out.lost} raids=${out.raidsCleared}/${out.raidsRepelled} wall=${Math.round((Date.now() - t0) / 1000)}s errors=${p.errors.length}`);
  log("HK " + JSON.stringify(out.hkTimeline));
  log("EV " + JSON.stringify(out.events.filter((e) => e.kind !== "ferry").map((e) => `${e.t}:${e.kind}${e.id ? ":" + e.id : ""}${e.ok !== undefined ? ":" + e.ok : ""}`)));
  log("BOT " + JSON.stringify(out.bot));
  if (P.out) writeFileSync(P.out, JSON.stringify(out, null, 1));
  if (p.errors.length) log("ERRORS " + JSON.stringify(p.errors.slice(0, 5)));
};
