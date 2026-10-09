// tools/baseline-b15.mjs — đo nhịp trận B15 Hàm Tử bằng bot, KHÔNG vẽ (đợt 12): chạy trọn một hoặc nhiều trận (advance), ghi thời gian từng pha và các số liên quan
// tới ba lỗi hay gặp của trận: lính đồn trú chạy ra ngoài vòng, lính địch mọc ngẫu nhiên, cung kỵ diễn đứng sát tướng mà không đánh được. Chỉ ĐỌC game (bọc hàm
// trong trang bằng móc chỉ đếm rồi gọi lại hàm gốc, không đổi thứ tự rng), không ghi gì vào kho git.
//
// CHẠY (cần một máy chủ tĩnh phục vụ gốc kho — đường /game/ — bất kỳ cổng; shot.mjs mở http://localhost:CỔNG; Git Bash: giá trị env không bắt đầu bằng "/"):
//   B15_PARAMS='{"seeds":[1001,2002],"mode":"nhanh","diff":"quansi","out":"<thư-mục>"}' node game/tools/shot.mjs game/tools/baseline-b15.mjs --port 8951 --w 1280 --h 720
//   (hoặc B15_PARAMS_FILE=<file json>). Mỗi seed ~75 s đồng hồ thật (máy rảnh, không vẽ): chạy 2 seed mỗi lần Chrome cho khỏi quá 4 phút; nhiều Chrome song song
//   thì mỗi lượt chậm đi nhưng kết quả KHÔNG đổi. So hai bản (cùng seed): node game/tools/baseline-compare.mjs <thư-mục-cũ> <thư-mục-mới>.
// TÁI LẬP: trận seed theo Date.now (battle.js: (Date.now() & 0xffff) ^ (R * 977)); script ghim Date.now = seed trước __start() nên cùng seed ra cùng kết quả từng
//   byte (đã kiểm: chạy hai lần, và bản HEAD cũ giống số đo cũ). Đổi số lượng / thứ tự lời gọi crowd.spawn hoặc ctx.rng thì MỌI seed sau đó đổi theo (nhiễu
//   ±40–50 s mỗi seed): so bằng trung vị / trung bình của 10 seed (SD tổng ~42 s, nên chỉ thấy được chênh lệch từ khoảng 35 s), không so từng seed.
// THAM SỐ (JSON):
//   seeds    mảng seed trận. Mặc định [1001,2002,3003,4004,5005] (bộ seed của bảng "Cân bằng đợt 9"; đủ 10: thêm 6006,7007,8118,9229,10330)
//   mode     "nhanh" (par 600 s, mặc định) | "chuan" (par 900 s)       → save.settings.mode
//   diff     danbinh | quansi (mặc định) | tuongquan | nguyensoai | truyenky  → save.settings.difficulty
//   troops   thap | vua (mặc định) | cao | rc  (số lính diễn; đổi chuỗi rng nên giữ nguyên khi so sánh)
//   botSeed  null (mặc định: bot seed 1) | "seed" (bot seed = seed trận) | số
//   botOpts  opts thêm cho __bot, vd {"hunt":false} (bot không tự săn lính sót — giống người chơi chỉ đọc "còn N") hoặc {"react":0,"miss":0}
//   maxSec   giây trận tối đa (mặc định 1500); maxRetries thua thì tải lại checkpoint tối đa bấy nhiêu lần (mặc định 3)
//   chunk    giây trận mỗi lần p.eval (mặc định 5)
//   out      thư mục ghi b15-<mode>-<diff>-<seed>.json (tuỳ chọn). Không có thì chỉ in ra.
// ĐẦU RA: mỗi seed một dòng "RESULT {...}" + file JSON đầy đủ; cuối cùng bảng min / trung vị / max nếu > 1 seed.
//   Nhớ: bot nhìn thấy mọi thứ và tự săn, nên che bớt lỗi lính đồn trú sót (hunt:false lộ ra) và lỗi lính diễn không trúng đòn (bot chỉ thấy lính trúng đòn được):
//   hai lỗi đó đo bằng chỉ số riêng (mt.* = thời gian có cung kỵ diễn trong 6 / 9 / 12 m, ring.* = lính đồn trú ngoài vòng) chứ không bằng thời gian thắng.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const env = process.env;
const DEF = { seeds: [1001, 2002, 3003, 4004, 5005], mode: "nhanh", diff: "quansi", troops: "vua", botSeed: null, botOpts: {}, maxSec: 1500, maxRetries: 3, chunk: 5, out: null };
let P = { ...DEF };
if (env.B15_PARAMS_FILE) P = { ...P, ...JSON.parse(readFileSync(env.B15_PARAMS_FILE, "utf8")) };
if (env.B15_PARAMS) P = { ...P, ...JSON.parse(env.B15_PARAMS) };

// ---- móc đo trong trang -----------------------------------------------------------------------------------------------
const INSTALL = (prm) => `(() => {
  const PRM = ${JSON.stringify(prm)}, c = __hk, d = c.director, h = c.hero, crowd = c.crowd;
  const TR = window.__r = { frames: 0, simTotal: 0, lastT: d.time, lastPhase: d.phase, phaseAt: [0, null, null, null], minHp: 1, minHpPhase: [1, 1, 1, 1],
    tHpLow: 0, deaths: 0, revives: 0, lastAlive: true, restoring: false, spawn: {}, spawnP: [{}, {}, {}, {}], spawnMounted: {}, spawnGarSrc: {},
    kills: {}, killsMounted: {}, garReleased: 0, garRelEv: [], ring: {}, mt: { nActMax: 0, tActNear25: 0, tActNear12: 0, tActMNear12: 0, tActMNear25: 0, nRealMMax: 0, nRealMSamples: 0, nRealMSum: 0, tActMNear9: 0, tActNear9: 0, mSecAct9: 0, mSecReal9: 0, tActMNear6: 0, tActNear6: 0, mSecAct6: 0, mSecReal6: 0 },
    init: { E_actor: crowd.agents.filter((a) => a.side === 'dich' && a.role === 'actor').length, A_all: crowd.agents.filter((a) => a.side === 'ta').length }, ev: [], samples: [], ringSamples: [], enemies45Sum: 0, enemies45Max: 0, enemies45T: 0, capEnemiesT: 0, hintGarT: 0 };
  const push = (kind, extra = {}) => TR.ev.push({ t: Math.round(d.time * 10) / 10, kind, phase: d.phase + 1, ...extra });
  const BASE_IDS = Object.keys(c.sim.bases).filter((id) => !["cong", "ban_doanh"].includes(c.sim.bases[id].type));
  // --- móc (chỉ đếm, rồi gọi hàm gốc) ---
  const sp = crowd.spawn.bind(crowd);
  crowd.spawn = (o) => {
    const a = sp(o), k = (a.side === "dich" ? "E:" : "A:") + a.role;
    TR.spawn[k] = (TR.spawn[k] || 0) + 1; TR.spawnP[d.phase][k] = (TR.spawnP[d.phase][k] || 0) + 1;
    if (a.side === "dich" && a.K.mounted) TR.spawnMounted[a.role] = (TR.spawnMounted[a.role] || 0) + 1;
    if (a.role === "garrison") TR.spawnGarSrc[a.src] = (TR.spawnGarSrc[a.src] || 0) + 1;
    return a;
  };
  const rl = crowd.release.bind(crowd);
  crowd.release = (a) => {
    if (!TR.restoring && a.alive && a.side === "dich" && a.role === "garrison" && a.state !== "dead") {
      TR.garReleased++; if (TR.garRelEv.length < 60) TR.garRelEv.push([Math.round(d.time), a.src, Math.round(Math.hypot(a.x - h.x, a.z - h.z))]);
    }
    return rl(a);
  };
  const ok = d.onSoldierKilled.bind(d);
  d.onSoldierKilled = (a, opt) => {
    if (a.side === "dich") {
      const k = a.role + ":" + (opt && opt.by === "hero" ? "hero" : (opt && opt.by) || "?"); TR.kills[k] = (TR.kills[k] || 0) + 1;
      if (a.K.mounted) { const k2 = a.role + ":" + (opt && opt.by === "hero" ? "hero" : "other"); TR.killsMounted[k2] = (TR.killsMounted[k2] || 0) + 1; }
    }
    return ok(a, opt);
  };
  const rc = d.restoreCheckpoint.bind(d);
  d.restoreCheckpoint = () => { TR.restoring = true; try { return rc(); } finally { TR.restoring = false; } };
  const wrap = (name, fn) => { const o = d[name].bind(d); d[name] = (...a) => { fn(...a); return o(...a); }; };
  wrap("onRevive", () => { TR.revives++; push("revive", { hp: Math.round(h.hp) }); });
  wrap("captureBase", (id) => push("capture", { id, by: "hero" }));
  wrap("openGate", (id) => push("gateOpen", { id }));
  wrap("startCounterA1", () => push("counterA1:start"));
  wrap("startSurrounded", () => push("surrounded:start"));
  wrap("endEvent", (id, okk) => push("event:" + id, { ok: okk }));
  wrap("tryTPC", () => { if (!c.hk.tpc && c.hk.value >= 100) push("tpc", { hk: Math.round(c.hk.value) }); });
  wrap("lose", (why) => { if (!d.over) push("lose", { why }); });
  // sự kiện của mô phỏng 1 Hz: Cứ Điểm đổi chủ (collapse = cánh vỡ trận, sim), cánh vỡ, tiếp viện địch — để biết pha kết thúc do tướng hay do mô phỏng
  wrap("onSimTick", (evs) => { for (const e of evs) if (["baseFlip", "collapse", "enemyReinf", "hqLost", "generalDown"].includes(e.type)) push("sim:" + e.type, { id: e.id || e.front, side: e.side, owner: e.owner, by: e.by, amount: e.amount }); });
  // --- bot + đo mỗi khung ---
  const opts = { ...PRM.botOpts }; if (PRM.botSeed != null) opts.seed = PRM.botSeed === "seed" ? PRM.seed : PRM.botSeed;
  const bot = __bot(__objective, opts);
  window.__rBot = (cc) => {
    const sim = cc.sim, T = d.time; let dt = T - TR.lastT; TR.lastT = T;
    if (dt < 0) dt = 0; else if (dt > 0.2) dt = 0.2;
    TR.frames++; TR.simTotal += dt;
    const ph = d.phase;
    if (ph !== TR.lastPhase) { if (TR.phaseAt[ph] == null) TR.phaseAt[ph] = Math.round(T * 10) / 10; push("phase"); TR.lastPhase = ph; }
    if (h.alive) { const f = h.hp / h.maxHp; if (f < TR.minHp) TR.minHp = f; if (f < TR.minHpPhase[ph]) TR.minHpPhase[ph] = f; if (f < 0.35) TR.tHpLow += dt; }
    if (h.alive !== TR.lastAlive) { if (!h.alive) { TR.deaths++; push("heroDown"); } TR.lastAlive = h.alive; }
    // một lượt qua mọi lính
    const gar = {}; let real45 = 0;
    let nAct = 0, nAct25 = 0, nAct12 = 0, nActM12 = 0, nActM25 = 0, nRealM = 0, nAct9 = 0, nActM9 = 0, nRealM9 = 0, nAct6 = 0, nActM6 = 0, nRealM6 = 0;
    for (const a of crowd.agents) {
      if (a.side !== "dich") continue;
      const dh = Math.hypot(a.x - h.x, a.z - h.z);
      if (a.role === "actor") {
        if (a.state === "dead") continue;
        nAct++; if (dh < 25) nAct25++; if (dh < 12) nAct12++; if (dh < 9) nAct9++; if (dh < 6) nAct6++;
        if (a.K.mounted) { if (dh < 12) nActM12++; if (dh < 25) nActM25++; if (dh < 9) nActM9++; if (dh < 6) nActM6++; }
        continue;
      }
      if (!crowd.hittable(a)) continue;
      if (dh < 45) real45++;
      if (a.K.mounted) { nRealM++; if (dh < 9) nRealM9++; if (dh < 6) nRealM6++; }
      if (a.role === "garrison" && a.src) {
        const p = cc.world.bases[a.src];
        if (p) {
          const g = gar[a.src] || (gar[a.src] = { in: 0, out: 0, maxOut: 0, outMounted: 0 }), dd = Math.hypot(a.x - p.x, a.z - p.z);
          if (dd <= p.r) g.in++; else { g.out++; if (a.K.mounted) g.outMounted++; if (dd - p.r > g.maxOut) g.maxOut = dd - p.r; }
        }
      }
    }
    const M = TR.mt; if (nAct > M.nActMax) M.nActMax = nAct; if (nAct25 > 0) M.tActNear25 += dt; if (nAct12 > 0) M.tActNear12 += dt;
    if (nActM12 > 0) M.tActMNear12 += dt; if (nActM25 > 0) M.tActMNear25 += dt; if (nRealM > M.nRealMMax) M.nRealMMax = nRealM;
    if (nActM9 > 0) M.tActMNear9 += dt; if (nAct9 > 0) M.tActNear9 += dt; M.mSecAct9 += nActM9 * dt; M.mSecReal9 += nRealM9 * dt; if (nActM6 > 0) M.tActMNear6 += dt; if (nAct6 > 0) M.tActNear6 += dt; M.mSecAct6 += nActM6 * dt; M.mSecReal6 += nRealM6 * dt; M.nRealMSum += nRealM * dt; M.nRealMSamples += dt;
    TR.enemies45Sum += real45 * dt; TR.enemies45T += dt; if (real45 > TR.enemies45Max) TR.enemies45Max = real45;
    if (real45 >= 30) TR.capEnemiesT += dt;
    if (d.baseHint && String(d.baseHint).startsWith("Hạ quân đồn trú")) TR.hintGarT += dt;
    // vòng Cứ Điểm: tướng đứng trong vòng của Cứ Điểm địch
    for (const id of BASE_IDS) {
      const b = sim.bases[id]; if (b.owner !== "dich") continue;
      const p = cc.world.bases[id]; if (!p) continue;
      const g = gar[id] || { in: 0, out: 0, maxOut: 0, outMounted: 0 }, garAlive = g.in + g.out;
      const R = TR.ring[id] || (TR.ring[id] = { tRing: 0, tReady: 0, tBlocked: 0, tKeeper: 0, tG: 0, tGar: 0, tGarOnly: 0, tGNoGar: 0, tOutside: 0, tAllOutside: 0,
        outCountSum: 0, inCountSum: 0, maxOutDist: 0, near45T: 0, out45Sum: 0, G0: b.G0, gateOutAny: 0 });
      const dH = Math.hypot(h.x - p.x, h.z - p.z), inRing = h.alive && dH < p.r;
      if (dH < 45) { R.near45T += dt; R.out45Sum += g.out * dt; if (g.maxOut > R.maxOutDist) R.maxOutDist = g.maxOut; }
      if (!inRing) continue;
      R.tRing += dt;
      const keeper = !!b.keeperAlive, Gge1 = b.G >= 1, ready = !Gge1 && !garAlive && !keeper;
      if (ready) { R.tReady += dt; continue; }
      R.tBlocked += dt;
      if (keeper) R.tKeeper += dt; if (Gge1) R.tG += dt; if (garAlive) R.tGar += dt;
      if (!keeper && !Gge1 && garAlive) R.tGarOnly += dt;          // G đã < 1 mà còn lính sót
      if (!keeper && Gge1 && !garAlive) R.tGNoGar += dt;           // G còn ≥ 1 mà không có lính đồn trú nào sống (chờ spawn / bị trần)
      if (g.out > 0) R.tOutside += dt; if (garAlive && g.in === 0) R.tAllOutside += dt;
      R.outCountSum += g.out * dt; R.inCountSum += g.in * dt;
      if (garAlive && TR.frames % 60 === 0 && TR.ringSamples.length < 300) TR.ringSamples.push([Math.round(T), id, d.baseHint ? Number((String(d.baseHint).match(/\\d+/) || [0])[0]) : null, Math.ceil(b.G), g.in, g.out, Math.round(g.maxOut)]);
    }
    if (TR.frames % 150 === 0) {
      TR.samples.push([Math.round(T), ph + 1, Math.round(h.hp / h.maxHp * 100), Math.round(cc.hk.value), real45, nAct25, Math.round(cc.sim.fronts.A.q.dich.KHIEN_NG + cc.sim.fronts.A.q.dich.CUNGKY_NG), Math.round(cc.sim.fronts.B.q.dich.KHIEN_NG + cc.sim.fronts.B.q.dich.CUNGKY_NG), window.__botDbg?.mode || ""]);
    }
    bot(cc);
  };
  return { ok: true, R: c.R, diff: c.diff.id, mode: c.mode, heroHp: h.maxHp, revives: h.revives, phase: d.phase, troops: c.troops.id };
})()`;

const STEP = (n) => `(() => {
  const c = __hk, d = c.director, TR = window.__r, f0 = TR.frames;
  c.advance(${(n - 0.5) / 30}, window.__rBot, false);
  return { f: TR.frames, moved: TR.frames - f0, t: d.time, over: !!d.over, won: d.result ? !!d.result.won : null, phase: d.phase,
    canRetry: d.result ? !!d.result.canRetry : null, mode: window.__botDbg?.mode };
})()`;

const med = (a) => { const s = [...a].sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; };
const sumObj = (o) => Object.values(o).reduce((x, y) => x + y, 0);

async function runOne(p, seed) {
  const t0 = Date.now();
  const log = (s) => console.log(`[b15 ${P.mode}/${P.diff}/${seed}] ${s}`);
  await p.go("/game/?debug");
  await p.eval(`(async () => {
    const Pm = await import("/game/js/meta/progress.js");
    const s = Pm.newSave(); s.settings.difficulty = ${JSON.stringify(P.diff)}; s.settings.mode = ${JSON.stringify(P.mode)}; s.settings.troops = ${JSON.stringify(P.troops)}; s.tutorial = { done: true };
    localStorage.setItem("hkda:save:v1", JSON.stringify(s)); return true; })()`);
  await p.go("/game/?debug");
  const s16 = Number(seed) & 0xffff;
  await p.eval(`(() => {
    window.__realNow = Date.now; Date.now = () => ${s16}; window.requestAnimationFrame = () => 0;
    let a = ${(Number(seed) * 2654435761) >>> 0}; Math.random = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    return true; })()`);
  await p.eval(`(__start(), true)`);
  let ready = false;
  for (let i = 0; i < 400 && !ready; i++) { ready = await p.eval(`!!(window.__hk && window.__hk.advance && window.__hk.director)`); if (!ready) await p.wait(200); }
  if (!ready) { log("NOT READY " + JSON.stringify(p.errors)); return null; }
  await p.eval(`(() => { Date.now = window.__realNow; return true; })()`);
  const info = await p.eval(INSTALL({ ...P, seed }));
  log("start " + JSON.stringify(info));
  const maxFrames = Math.round(P.maxSec * 30);
  let last = null, lastLog = -999;
  for (;;) {
    const left = maxFrames - (last ? last.f : 0);
    if (left <= 0) { log("maxSec"); break; }
    last = await p.eval(STEP(Math.min(Math.round(P.chunk * 30), left)));
    if (last.t - lastLog >= 60) { lastLog = last.t; log(`t=${last.t.toFixed(0)} P${last.phase + 1} mode=${last.mode}`); }
    if (last.over) {
      if (last.won) break;
      const st = await p.eval(`(() => { const d = __hk.director; return { retries: d.retries || 0, canRetry: !!d.result.canRetry, why: d.result.why }; })()`);
      log(`LOST t=${last.t.toFixed(0)} P${last.phase + 1} retries=${st.retries} (${st.why})`);
      if (!st.canRetry || st.retries >= P.maxRetries) break;
      await p.eval(`(() => { __hk.director.restoreCheckpoint(); window.__r.ev.push({ t: Math.round(__hk.director.time), kind: "restore", phase: __hk.director.phase + 1 }); return true; })()`);
      continue;
    }
    if (last.moved === 0) { log("stalled"); break; }
  }
  const out = await p.eval(`(() => {
    const c = __hk, d = c.director, TR = window.__r, res = d.result || d.buildResult(false, "cut");
    const bot = window.__botDbg ? { ...window.__botDbg } : null; if (bot) { delete bot.tgt; }
    return { seed: ${seed}, won: !!res.won, why: res.why, timeSec: Math.round(res.timeSec * 10) / 10, simTotal: Math.round(TR.simTotal), mode: c.mode, diff: c.diff.id,
      phaseAt: TR.phaseAt, retries: d.retries || 0, deaths: TR.deaths, revives: TR.revives, minHp: Math.round(TR.minHp * 1000) / 1000, minHpPhase: TR.minHpPhase.map((x) => Math.round(x * 1000) / 1000), tHpLow: Math.round(TR.tHpLow),
      ko: res.ko, kills: TR.kills, killsMounted: TR.killsMounted, spawn: TR.spawn, spawnP: TR.spawnP, spawnMounted: TR.spawnMounted, spawnGarSrc: TR.spawnGarSrc, init: TR.init,
      garReleased: TR.garReleased, garRelEv: TR.garRelEv, ring: TR.ring, mt: TR.mt, enemies45Avg: TR.enemies45T ? TR.enemies45Sum / TR.enemies45T : 0, enemies45Max: TR.enemies45Max,
      tCapEnemies: Math.round(TR.capEnemiesT), hintGarT: Math.round(TR.hintGarT), tpc: d.tpcLog || [], tpcCount: res.tpcCount, hkLog: res.hkLog, avgSK: res.avgSK, events: res.events, mainDone: res.mainDone, sideDone: res.sideDone,
      keSachOk: res.keSachOk, orders: res.orders, ev: TR.ev, samples: TR.samples, ringSamples: TR.ringSamples, bot, qRatio: res.qRatio, baseRatio: res.baseRatio, hkRaw: res.hkRaw };
  })()`);
  out.wallSec = Math.round((Date.now() - t0) / 1000); out.errors = p.errors.length;
  const pa = out.phaseAt, endT = out.timeSec, dur = [0, 1, 2, 3].map((i) => (pa[i] == null ? null : Math.round(((i < 3 ? pa[i + 1] ?? endT : endT) - pa[i]) * 10) / 10));
  out.phaseDur = dur;
  const rt = (id) => out.ring[id]?.tBlocked != null ? Math.round(out.ring[id].tBlocked) : 0;
  log(`RESULT won=${out.won} time=${out.timeSec}s (par 600/900) phaseAt=${JSON.stringify(pa)} phaseDur=${JSON.stringify(dur)} retries=${out.retries} deaths=${out.deaths} revives=${out.revives} minHp=${out.minHp} ko=${out.ko} ` +
    `spawnE=${JSON.stringify(Object.fromEntries(Object.entries(out.spawn).filter(([k]) => k.startsWith("E:"))))} garReleased=${out.garReleased} ringBlocked(A1/A2/B2)=${rt("A1")}/${rt("A2")}/${rt("B2")} wall=${out.wallSec}s errors=${out.errors}`);
  if (P.out) { mkdirSync(P.out, { recursive: true }); writeFileSync(`${P.out}/b15-${P.mode}-${P.diff}-${seed}.json`, JSON.stringify(out, null, 1)); }
  return out;
}

export default async (p) => {
  const runs = [];
  for (const seed of P.seeds) { const r = await runOne(p, seed); if (r) runs.push(r); }
  if (runs.length > 1) {
    const stat = (name, f) => { const v = runs.map(f).filter((x) => x != null && !Number.isNaN(x)); if (!v.length) return console.log(`  ${name.padEnd(24)} (không có số liệu)`); console.log(`  ${name.padEnd(24)} min ${Math.min(...v).toFixed(1)}  med ${med(v).toFixed(1)}  max ${Math.max(...v).toFixed(1)}  (n=${v.length})`); };
    console.log(`SUMMARY ${P.mode}/${P.diff} seeds=${JSON.stringify(runs.map((r) => r.seed))} won=${runs.filter((r) => r.won).length}/${runs.length}`);
    stat("timeSec", (r) => r.timeSec); for (let i = 0; i < 4; i++) stat("P" + (i + 1) + " dur", (r) => r.phaseDur[i]);
    stat("minHp", (r) => r.minHp); stat("ko", (r) => r.ko); stat("spawn E total (all)", (r) => sumObj(Object.fromEntries(Object.entries(r.spawn).filter(([k]) => k.startsWith("E:")))));
    stat("spawn E real (non-actor)", (r) => sumObj(Object.fromEntries(Object.entries(r.spawn).filter(([k]) => k.startsWith("E:") && k !== "E:actor"))));
    stat("ring blocked A1 s", (r) => r.ring.A1?.tBlocked ?? 0); stat("ring blocked A2 s", (r) => r.ring.A2?.tBlocked ?? 0);
  }
};
