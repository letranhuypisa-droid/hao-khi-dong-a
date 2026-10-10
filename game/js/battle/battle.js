// battle/battle.js — dựng một trận, chạy vòng lặp, trả kết quả khi người chơi rời trận.
//
// Vùng chiến đấu chạy bước cố định 1/60 s bằng bộ tích lũy, tối đa 4 bước mỗi khung rồi bỏ phần
// dư (15.2). Hit-stop dừng đồng hồ trận; vòng Mệnh Lệnh làm chậm ×0,2.
// Nhịp khung (đợt 19c): bộ tích lũy ở battle/pacing.js — vòng rAF thật giữ pha giữa bước (màn 60 Hz đúng một bước mỗi khung, cả sau
// khung giật), tua bằng advance giữ y hệt cách cũ (tất định); vẽ giữa trạng thái đầu bước cuối và hiện tại theo α (battle/view.js:
// rig, lính, thuyền, mũi tên, camera nhắm vị trí vẽ của tướng) — màn 90–144 Hz và lúc chậm hình chuyển động liền mạch. Chỉ phần vẽ đổi.
// Tua bằng advance vẽ với α = 1: camera, cảnh y như trước đợt 19c từng bit (cam.yaw — mô phỏng đọc khi đi — có lúc lấy từ camera.position:
// cảnh ngắn B20 kết thúc).
//
// Nhiều trận, nhiều tướng (đợt 9 lõi): phần riêng của trận nằm sau các móc của BattleDef (battles/b15.js — danh sách
// móc ở đầu file đó), tướng theo HEROES[heroId] (data/heroes.js). Mặc định B15 + H35: đúng thứ tự dựng, thứ tự rút
// ctx.rng và từng phép tính như trước.
//
// Đồ hoạ (đợt 19c, battle/gfx.js): renderer dựng theo mức Đồ hoạ (MSAA, kiểu bóng, tỉ lệ điểm ảnh, độ phân giải động khi Tự động).
// Dựng xong thì làm nóng (biên dịch mọi shader kể cả bóng, nạp texture) trong lúc màn tải của main.js còn che, rồi mới gọi onReady và
// chạy vòng lặp — khung đầu nhìn thấy không khựng. Trước làm nóng: camera đặt vào chỗ mở màn, lính có chỗ vẽ (lượt vẽ làm nóng là cảnh
// khung đầu, hình nằm lại trên canvas khi khung đầu chưa vẽ); sau: HUD cập nhật một lượt (khung đầu đủ bản đồ nhỏ, mục tiêu, thanh). Đổi
// Bóng / Đồ hoạ ở bảng tạm dừng thì biên dịch lại ngay lúc còn tạm dừng; đổi cỡ vẽ thì vẽ lại cảnh sau bảng.

import * as THREE from "three";
import { heightAt, setBattleTerrain, setDecks, setWaterLevel, setOverlay, waterLevel, waterDist } from "./ground.js";
import { Crowd } from "./crowd.js";
import { Hero } from "./hero.js";
import { FX, releaseFxTextures, preloadFx } from "./fx.js";
import { createRenderer, Warm, watchLateFirstUse } from "./gfx.js";
import { Pacer, STEP } from "./pacing.js";
import { View } from "./view.js";
import { GFX_LEVELS, GFX_NAME, isGfx } from "../core/gfx.js";
import * as Models from "./models.js";
import { Atmosphere } from "./atmosphere.js";
import { Audio } from "./audio.js";
import { Voice } from "./voice.js";
import { Input } from "./input.js";
import { HUD } from "./hud.js";
import { createHintDriver } from "./hints.js";
import { createHaoKhi } from "../sim/haokhi.js";
import { makeRng } from "../core/rng.js";
import { DIFFICULTY, TROOP_LEVELS, HERO, ORDERS, MODES } from "../data/tuning.js";
import { HEROES, SKILLS } from "../data/heroes.js";
import { heroStats } from "../meta/progress.js";
import { movesGuideHTML } from "../ui/guide.js";
import { fmtKeys, devOf, touchUI } from "../data/controls.js";
import { readComic } from "../ui/comic.js";
import { isCompact, touchArc, touchUnit } from "../ui/layout.js";
import B15 from "../battles/b15.js";

// Camera tránh tường thành (chỉ hình ảnh; hộp do BattleDef.camBoxes dựng — B15: tường Hàm Tử quan): pad khoảng chừa
// trước mặt tường cho mặt phẳng gần 0,3 m, minH cần ngang tối thiểu (dưới mức này lookAt gần thẳng đứng thì xoay loạn),
// keep: cần bị kéo ngắn thì nâng camera cho cần dài ít nhất keep × dist.
const CAM_WALL = { pad: 0.35, minH: 0.8, keep: 0.6 };

// Trả mặt đất về địa hình dựng sẵn (bỏ địa hình / boong / nước / lớp phủ bùn, gò của trận khác).
function resetGround() { setBattleTerrain(null); setDecks(null); setWaterLevel(null); setOverlay(null); }

// battle: BattleDef (mặc định B15), heroId: tướng (mặc định H35), quyetSach: kết quả Hiến kế { picked, historical } | null
// (ctx.quyetSach, director của trận đọc). Dựng lỗi (vd trận chưa dựng) thì dọn GPU, trả mặt đất về mặc định rồi reject
// để main.js báo lỗi và về Doanh trại.
// Chế độ Tự do (đợt 14): heroDef / stats truyền thẳng (người lính — meta/career.js soldierDef / soldierStats), BattleDef.Hero là lớp tướng
// riêng của trận (battle/soldier.js SoldierHero); thiếu thì như cũ (HEROES[heroId], heroStats, Hero).
// onReady (đợt 19c): gọi khi đã làm nóng xong, ngay trước khung đầu — main.js lúc đó mới hiện khung trận, ẩn màn tải.
export function runBattle({ container, save, R, difficulty, mode = "nhanh", music, story = null, onSettings, battle = B15, heroId = "H35", quyetSach = null, heroDef: heroDefIn = null, stats: statsIn = null, onReady = null }) {
  return new Promise((resolve, reject) => {
    const def = battle || B15;
    const heroDef = heroDefIn || HEROES[heroId] || HEROES.H35;
    const settings = save.settings;
    const diff = DIFFICULTY.find((d) => d.id === difficulty) || DIFFICULTY[1];
    const stats = statsIn || heroStats(save, R, heroDef.id, def.preset || null);
    stats.guardBase = (heroDef.bodyguards ?? HERO.bodyguards) + stats.mods.bodyguards;

    container.innerHTML = `<canvas class="game"></canvas><div class="hud"></div><div class="overlay"></div><div class="touch"></div>`;
    const canvas = container.querySelector("canvas"), hudRoot = container.querySelector(".hud");
    const overlay = container.querySelector(".overlay"), touchRoot = container.querySelector(".touch");

    // renderer theo mức Đồ hoạ (battle/gfx.js): MSAA, kiểu bóng; tone mapping, không gian màu như trước
    const { renderer, gfx } = createRenderer(canvas, settings);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, 1, 0.3, def.camFar ?? 1400);

    const seed = (Date.now() & 0xffff) ^ (R * 977);
    const ctx = {
      scene, camera, renderer, R, diff, stats, save,
      rng: makeRng(seed), clock: 0, openGates: def.openGates ? def.openGates() : {}, units: [], gfx,
      troops: TROOP_LEVELS.find((t) => t.id === settings.troops) || TROOP_LEVELS[1],
      touch: false, mode, music, battle: def, heroDef, quyetSach,
    };
    // Chữ phím trong gợi ý, băng chữ, HUD: viết {tpc}, {c}, {cmd}… trong câu, ctx.fmt đổi sang phím của thiết bị đang dùng
    // (bàn phím, cảm ứng, tay cầm — data/controls.js).
    ctx.fmt = (s) => fmtKeys(s, devOf(ctx));
    ctx.view = new View();             // nội suy khi vẽ (battle/view.js): bản sao để vẽ, mô phỏng không đọc
    let input = null, camBoxes = [];
    try {
      resetGround();
      // Vật đổ bóng (mặt trời, tường, cổng, thuyền, cảnh) luôn dựng như khi bật bóng; nút "Bóng" chỉ bật/tắt
      // renderer.shadowMap (tắt thì three bỏ hẳn lượt bóng, shader không lấy mẫu bóng: không tốn gì). Trước đây vào
      // trận khi tắt bóng thì mặt trời, vật tĩnh dựng castShadow = false nên bật lại giữa trận không có bóng.
      ctx.world = def.buildWorld(scene, { shadows: true, ctx });
      ctx.sim = def.sim.create(ctx, stats, mode);
      ctx.hk = def.createHaoKhi ? def.createHaoKhi(ctx, stats, diff, mode)
        : createHaoKhi({ quick: MODES[mode].hkQuick, start: stats.mods.hkStart, gainPct: stats.mods.hkPct, decayMult: stats.mods.hkDecay, tpcExt: stats.mods.tpcExt,
          diffMult: diff.hk ?? 1 });   // Hào Khí nhận × theo độ khó (§10)
      ctx.audio = new Audio(settings.volume, settings.voice ?? 0.9); ctx.audio.unlock();
      music?.play("battle");
      ctx.fx = new FX(scene, camera, hudRoot); ctx.fx.fmt = ctx.fmt;
      ctx.crowd = new Crowd(scene, ctx);
      ctx.hero = new (def.Hero || Hero)(ctx, stats, heroDef);
      // lồng tiếng (voice.js): lời của tướng ra trận và của tướng địch trong chương này, phụ đề qua director.say
      ctx.voice = new Voice(ctx.audio, { music, volume: settings.voice ?? 0.9, say: (t, T, k) => ctx.director?.say?.(t, T, k) });
      ctx.voice.preload(ctx.hero.id, def.chapter);
      // Hero chưa đọc chỗ xuất hiện của trận (lõi tướng chưa nhận def): đặt theo BattleDef, chỉ cho trận khác B15
      const sp = def.heroSpawn;
      if (sp && def !== B15 && !ctx.hero.def) { ctx.hero.x = sp.x; ctx.hero.z = sp.z; ctx.hero.yaw = sp.yaw ?? ctx.hero.yaw; }
      for (const tr of ctx.hero.trails || []) ctx.view.follow(tr.mesh, ctx.hero.rig.root);   // vệt lưỡi (toạ độ thế giới) dời theo tướng lúc vẽ
      input = new Input(canvas);
      ctx.hud = new HUD(hudRoot, ctx);
      new def.Director(ctx);
      ctx.atmo = new Atmosphere(ctx, new THREE.PointLight(0xff8a3c, 0, 30, 1.7));   // nắng, sương, khói lửa theo pha (atmosphere.js)
      ctx.ambient = def.ambient ? def.ambient(scene, ctx) : null;   // B15: cò, trâu, trẻ chăn trâu, quạ, dân; theo đồng hồ trận
      camBoxes = def.camBoxes ? def.camBoxes(ctx.world) : [];
      gfx.shadow(ctx.world.sun);                    // cỡ bản đồ bóng theo mức (Thấp 1024)
    } catch (err) {
      input?.dispose?.();
      try { ctx.audio?.close(); } catch (_) { /* đã đóng */ }
      try { releaseGpu(scene, renderer); } catch (_) { /* bỏ qua */ }
      resetGround();
      reject(err);
      return;
    }
    ctx.input = input;                 // director đọc phím giữ (held.interact — Tương tác B20); B15 không đọc
    // Gợi ý lần đầu giữa trận (hints.js, đợt 11): giải thích thuật ngữ / cơ chế đúng lúc gặp. Cờ đã xem ghi thẳng vào save.hints (lưu qua onSettings),
    // tắt được ở settings.hints (bảng tạm dừng, màn Xuất trận); hiện qua director.say(…, "tip").
    ctx.hints = createHintDriver(ctx, { seen: (save.hints ||= {}), enabled: () => settings.hints !== false, onSeen: () => onSettings?.(save.settings) });
    if (location.search.includes("debug")) { window.__hk = ctx; watchLateFirstUse(renderer, ctx); }   // chỉ để kiểm thử bằng script
    ctx.hitstopT = 0;
    ctx.hitstop = (ms) => { ctx.hitstopT = Math.max(ctx.hitstopT, ms / 1000); };
    const cam = ctx.cam = { yaw: def.camYaw ?? Math.PI / 2, pitch: 0.42, dist: def.camDist ?? 10.5, idle: 0, x: 0, y: 0, z: 0, pull: 0, ahead: 0, aimK: 0 };
    let slowT = 0, slowK = 1;
    ctx.cinematic = (text, unit, big) => {
      ctx.hud.cinematic(text);
      slowT = big ? 1.5 : 0.6; slowK = big ? 0.25 : 0.4; cam.pull = big ? 1 : 0.4;
      const gold = hudRoot.querySelector(".fx-gold"); gold.classList.remove("on"); void gold.offsetWidth; gold.classList.add("on");
    };
    // chậm hình ngắn (Đòn Quyết, hạ sĩ quan): T giây giờ thật ở tốc k
    ctx.slowmo = (T, k) => { if (slowT <= 0 || k <= slowK) { slowK = k; } slowT = Math.max(slowT, T); };
    const v3 = new THREE.Vector3(), hp = { x: 0, y: 0, z: 0 };    // hp: vị trí vẽ của tướng (view.pos)
    let W = 1, H = 1;
    ctx.project = (x, y, z) => { v3.set(x, y, z).project(camera); if (v3.z > 1) return null; return { x: (v3.x * 0.5 + 0.5) * W, y: (-v3.y * 0.5 + 0.5) * H }; };

    // ---- cỡ khung, tỉ lệ render ----------------------------------------------------------
    const resize = () => {
      W = container.clientWidth; H = container.clientHeight;
      gfx.resize(W, H);                            // min(DPR, trần của mức Đồ hoạ) × Tỉ lệ render × nấc độ phân giải động
      camera.aspect = W / H; camera.updateProjectionMatrix();
      syncCompact(container);
    };
    resize();                                      // đổi cỡ cửa sổ: onResize (dưới, cùng vẽ lại khi đang tạm dừng)

    // ---- cảm ứng -------------------------------------------------------------------------
    // "Điều khiển cảm ứng": Tự nhận theo cách bạn bấm VÀO TRẬN rồi đi theo thiết bị vừa dùng (setupTouch), Bật, Tắt
    const syncTouch = setupTouch(container, touchRoot, input, ctx, settings);
    syncCompact(container);

    // ---- tạm dừng, kết quả -----------------------------------------------------------------
    let paused = false, finished = false, raf = 0, last = performance.now(), warm = null;   // warm: làm nóng (battle/gfx.js)
    const pacer = new Pacer(), view = ctx.view;                // bước cố định (battle/pacing.js), nội suy khi vẽ (battle/view.js)
    // Trận đã hết (director.over) thì không mở tạm dừng: bảng tạm dừng ghi đè bảng THẮNG/THUA, tắt đi thì lớp phủ
    // trống mà showEnd không hiện lại → kẹt trong trận chết, mất thưởng. Chặn ở cả ba đường (Esc/Start/"II",
    // mất khoá chuột, ẩn tab); nếu vẫn lọt thì tắt tạm dừng sẽ dựng lại bảng kết quả, "Rút quân" thì rời luôn.
    const pause = (on) => {
      if (finished) return;
      paused = on; overlay.innerHTML = on ? pauseHTML(save, ctx.hero?.id, ctx.battle, devOf(ctx), ctx.hud?.log, gfx) : ""; overlay.classList.toggle("on", on);
      if (on) { document.exitPointerLock?.(); bindPause(); ctx.audio.suspend(); music?.pause(); } else { ctx.audio.unlock(); music?.resume(); last = performance.now(); pacer.reset(); }
      if (!on && ctx.director.over && endShown) showEnd(ctx.director.result);
    };
    const bindPause = () => {
      overlay.querySelector("[data-a=resume]").onclick = () => pause(false);
      const rt = overlay.querySelector("[data-a=retry]");
      if (rt) rt.onclick = () => { ctx.director.restoreCheckpoint(); view.cut(); pause(false); };
      overlay.querySelector("[data-a=quit]").onclick = () => {
        if (ctx.director.over) { finish(ctx.director.result); return; }
        ctx.director.lose("Rút quân khỏi trận.", false); pause(false);
      };
      overlay.querySelectorAll("[data-set]").forEach((el) => el.onchange = () => {
        const k = el.dataset.set, v = el.type === "checkbox" ? el.checked : el.type === "range" ? Number(el.value) : el.value;
        save.settings[k] = v; onSettings?.(save.settings);
        if (k === "troops") { ctx.troops = TROOP_LEVELS.find((t) => t.id === v); ctx.director.fillActors(false); }
        if (k === "volume") ctx.audio.setVolume(v);
        if (k === "voice") ctx.voice?.setVolume(v);
        if (k === "music") music?.setVolume(v);
        // Tỉ lệ render, Đồ hoạ: tỉ lệ điểm ảnh, bóng đổi ngay (MSAA theo từ trận sau). Bóng / kiểu bóng đổi thì mọi chương trình shader dựng
        // lại: biên dịch và vẽ một lượt ngay lúc còn tạm dừng (warm.pass) thay vì khựng cả giây ở khung đầu sau khi bấm Tiếp tục.
        let recompile = false;
        if (k === "renderScale" || k === "graphics") { recompile = gfx.set(save.settings); resize(); }
        if (k === "shadows") { renderer.shadowMap.enabled = v; recompile = true; }
        if (recompile) {
          scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
          // lượt làm nóng lỗi (vật tạm hiện không vẽ được): đã trả lại vật trong finally, vẽ lại cảnh thường quanh bảng — lỗi không thoát ra bảng
          if (warm) { try { warm.pass(renderer, scene, camera, true); } catch (err) { console.warn("làm nóng", err); redraw(); } } else redraw();
        }
        else if (k === "renderScale" || k === "graphics") redraw();   // setSize xoá canvas: vẽ lại cảnh quanh bảng tạm dừng (trước đây đen)
        cvNote();
      });
    };
    // vẽ lại đúng khung vừa rồi (đang tạm dừng: không bước, không tính lại lính) — sau setSize (xoá canvas) cảnh vẫn hiện quanh bảng
    const redraw = () => { view.begin(); try { renderer.render(scene, camera); } finally { view.end(); } };
    const cvNote = () => { const n = overlay.querySelector("[data-cv]"); if (n) n.textContent = `${canvas.width}×${canvas.height}`; };   // cỡ khung vẽ ở bảng tạm dừng
    const onResize = () => { resize(); if (paused && !finished && ctx.warmed) { redraw(); cvNote(); } };
    window.addEventListener("resize", onResize);
    const onLockChange = () => { if (!document.pointerLockElement && !paused && !finished && !ctx.touch && !ctx.director.over) pause(true); };
    document.addEventListener("pointerlockchange", onLockChange);
    const onVis = () => { if (document.hidden && !paused && !finished && !ctx.director.over) pause(true); };
    document.addEventListener("visibilitychange", onVis);

    const showEnd = (res) => {
      overlay.classList.add("on");
      overlay.innerHTML = `<div class="panel end ${res.won ? "win" : "lose"}">
        <h2>${res.won ? "THẮNG TRẬN" : "THUA TRẬN"}</h2><p>${res.why}</p>
        <div class="row">${res.canRetry ? `<button data-a="retry" class="primary">Tải lại đầu pha ${ctx.director.phase + 1}</button>` : ""}
        <button data-a="leave" class="${res.canRetry ? "" : "primary"}">${res.won ? "Xem kết quả" : "Rời trận"}</button></div></div>`;
      document.exitPointerLock?.();
      const r = overlay.querySelector("[data-a=retry]");
      if (r) r.onclick = () => { overlay.classList.remove("on"); overlay.innerHTML = ""; ctx.director.restoreCheckpoint(); view.cut(); last = performance.now(); pacer.reset(); };
      overlay.querySelector("[data-a=leave]").onclick = () => finish(res);
    };
    const finish = (res) => {
      finished = true; cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("pointerlockchange", onLockChange);
      document.removeEventListener("visibilitychange", onVis);
      input.dispose(); ctx.voice?.dispose(); ctx.audio.close();                      // đóng hẳn AudioContext (suspend thì mỗi trận rò một cái)
      // dọn riêng của trận trước khi trả GPU (B20: naval tự gỡ lưới hạm đội — làm sau releaseGpu là gỡ hai lần)
      resetGround(); def.dispose?.(ctx);
      warm?.attach();                                          // nhóm làm nóng về cảnh để releaseGpu dọn cùng (battle/gfx.js)
      releaseGpu(scene, renderer);
      resolve(res);
    };

    // ---- khung comic chèn giữa trận (GDD 22.3: khung insert do engine phát giữa trận) ------------------------
    // Sự kiện trận (vd "coAoTong:land") → khung trong data.STORY_INSERTS của trận. Trận đứng hẳn (như tạm dừng, không hiện bảng
    // tạm dừng) tới khi đọc xong; mỗi khung chỉ phát một lần, và chỉ khi main.js truyền story (lần chơi đầu).
    let storyOpen = false;
    const played = new Set();
    ctx.storyEvent = (ev) => {
      const id = def.data?.STORY_INSERTS?.[ev];
      if (!story || !id || played.has(id) || storyOpen || finished || ctx.director.over || !story.comic.panels[id]) return;
      played.add(id); storyOpen = true; paused = true;
      document.exitPointerLock?.(); ctx.audio.suspend(); music?.pause();
      readComic(story.comic, { ids: [id], single: true, title: "Giữa trận · " + (story.comic.panels[id].insert?.phase || ""),
        settings: story.settings, onSettings: story.onSettings, onSeen: story.onSeen })
        .then((r) => story.onDone?.(r), (err) => console.error(err))
        .finally(() => {
          storyOpen = false; if (finished) return;
          paused = false; ctx.audio.unlock(); music?.resume(); last = performance.now(); pacer.reset();
          // nút tay cầm dùng để đóng comic không thành cạnh bấm mới (né, tạm dừng) ở khung đầu: đồng bộ padPrev rồi xoá
          input.poll(); input.endFrame();
          // cú bấm đóng comic còn trong cửa sổ user activation: khoá chuột lại luôn, khỏi mất một cú bấm
          if (!ctx.touch && navigator.userActivation?.isActive) try { canvas.requestPointerLock?.()?.catch?.(() => {}); } catch (_) { /* trình duyệt từ chối thì thôi */ }
        });
    };

    // ---- vòng lặp ------------------------------------------------------------------------
    // Thắng: cảnh kết trong engine (22.2 bước 6, ≤ 10 s): camera kéo xa, nâng cao thấy cả bến, rồi mới hiện bảng
    // THẮNG TRẬN; bấm phím / chạm bất kỳ để bỏ qua. Thua giữ như cũ (1,8 s).
    const OUTRO = { sec: def.outroSec ?? 5, pull: 3.4, pitch: 0.66 };   // B20: cảnh kết riêng của director (máy quay nhìn cả khúc sông) dài hơn
    let hudAcc = 0, endShown = false, time = 0, bedT = 0, outroT = -1, outroTap = false;
    container.addEventListener("pointerdown", () => { if (outroT > 0.6) outroTap = true; });   // chạm/nhấp bỏ qua cảnh kết
    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      // dấu giờ rAF có thể sớm hơn last (đặt sau khi dựng trận xong): dt âm làm bộ tích lũy âm, trận đứng ~0,5 s đầu
      const ms = now - last, dt = Math.max(0, Math.min(0.1, ms / 1000)); last = now;
      if (paused || finished) return;
      if (rotateBlocked(container)) return;          // điện thoại cầm dọc: màn nhắc xoay ngang che trận (css/hud.css) — trận đứng chờ
      if (gfx.frame(ms)) resize();                   // độ phân giải động (Đồ hoạ Tự động): khung chậm kéo dài thì hạ một nấc
      step(dt, input.poll(), true, true);
      input.pickMode = !!ctx.hud?.pickerOpen;   // bảng chọn điểm đến mở: D-pad tay cầm chọn 1–4 (input.js)
    };
    // Tua trận bằng script (chỉ khi ?debug): chạy logic không cần requestAnimationFrame. Bộ tích lũy chạy kiểu cũ (live = false: tất định).
    if (window.__hk === ctx) ctx.advance = (sec, bot, draw = false) => {
      for (let t = 0; t < sec && !finished && !paused; t += 1 / 30) { bot?.(ctx); step(1 / 30, input.poll(), draw); }
    };
    // Camera, mặt trời theo tướng — mỗi khung sau vòng bước. Trước làm nóng gọi aim(0, NOIN): time = 0 < 0,2 nên camera đặt thẳng vào chỗ
    // mở màn. Hướng theo trạng thái thật của tướng (cam.yaw tướng đọc khi đi), vị trí nhắm vào chỗ vẽ của tướng (view.pos).
    const NOIN = { camDX: 0, camDY: 0, touch: false };
    const aim = (dt, inp) => {
      const h = ctx.hero;
      if (Math.abs(inp.camDX) + Math.abs(inp.camDY) > 0.01) cam.idle = 0; else cam.idle += dt;
      cam.yaw -= inp.camDX * (inp.touch ? 0.006 : 0.0026);
      cam.pitch = Math.max(0.12, Math.min(0.95, cam.pitch + inp.camDY * 0.002));
      if (h.lock?.alive && !h.lock.dead) cam.yaw = lerpAngle(cam.yaw, Math.atan2(h.lock.x - h.x, h.lock.z - h.z), Math.min(1, dt * 3));
      else if (cam.idle > 1.2 && h.state === "free" && h.inputMag > 0.3) cam.yaw = lerpAngle(cam.yaw, h.yaw, Math.min(1, dt * 0.8 * h.inputMag));
      cam.pull = Math.max(0, cam.pull - dt * 0.6);
      if (outroT >= 0) {
        outroT += dt; const k = Math.min(1, outroT / 3.2), e = k * k * (3 - 2 * k);
        cam.pull = Math.max(cam.pull, OUTRO.pull * e); cam.pitch += (OUTRO.pitch - cam.pitch) * Math.min(1, dt * 1.2); cam.yaw += dt * 0.05;
      }
      let dist = cam.dist + cam.pull * 5, pitch = cam.pitch;
      const fx = Math.sin(cam.yaw), fz = Math.cos(cam.yaw);
      view.pos(h, hp);
      let tx = hp.x, ty = hp.y + 1.6, tz = hp.z;
      // Tướng tầm xa (WC09, hero.ranged) trên bàn phím + chuột: camera nhìn trước mặt tướng ranged.ahead m để tâm màn (tâm ngắm, hud.js)
      // nằm trên đường tên; đang căng dây (ngắm chính xác, hero.aiming) thì dí vai — nhìn xa aimAhead m, kéo gần, hạ thấp, lệch sang vai
      // phải, thu FOV. Chỉ là trình bày: mô phỏng chỉ đọc cam.yaw như cũ. Tướng khác không vào nhánh này (camera y như cũ).
      if (h.ranged) {
        const R = h.ranged, pc = !ctx.touch && !input.pad, kk = Math.min(1, dt * 7);
        cam.aimK += ((pc && h.aiming ? 1 : 0) - cam.aimK) * kk;
        cam.ahead += ((pc ? (h.aiming ? R.aimAhead : R.ahead) : 0) - cam.ahead) * kk;
        const a = cam.aimK;
        tx += fx * cam.ahead - fz * 1.2 * a; tz += fz * cam.ahead + fx * 1.2 * a; ty -= 0.2 * a;
        dist *= 1 - 0.45 * a; pitch += (0.12 - pitch) * a;
      }
      let cx = tx - fx * dist * Math.cos(pitch), cz = tz - fz * dist * Math.cos(pitch), cy = ty + dist * Math.sin(pitch);
      // Cần camera cắt tường / tháp cổng / cửa Hàm Tử quan (hộp 2D, cắt cần theo phương ngang): kéo camera về phía
      // tướng tới trước mặt tường CAM_WALL.pad m và nâng lên (cần giữ dài ≥ keep × dist) → nhìn chếch xuống qua đầu
      // tướng thay vì đứng sau cửa tối, sau lưng tường. Chỉ số vô hướng, không cấp phát.
      const hx = cx - tx, hz = cz - tz, hd = Math.sqrt(hx * hx + hz * hz);
      if (hd > 0.01) {
        let tHit = 1;
        for (let i = 0; i < camBoxes.length; i++) {
          const b = camBoxes[i];
          if (b.gate && (b.open ? !ctx.openGates[b.gate] : ctx.openGates[b.gate])) continue;
          let t0 = 0, t1 = 1;
          if (Math.abs(hx) < 1e-6) { if (tx < b.x0 || tx > b.x1) continue; }
          else { let a = (b.x0 - tx) / hx, c = (b.x1 - tx) / hx; if (a > c) { const s = a; a = c; c = s; } if (a > t0) t0 = a; if (c < t1) t1 = c; if (t0 > t1) continue; }
          if (Math.abs(hz) < 1e-6) { if (tz < b.z0 || tz > b.z1) continue; }
          else { let a = (b.z0 - tz) / hz, c = (b.z1 - tz) / hz; if (a > c) { const s = a; a = c; c = s; } if (a > t0) t0 = a; if (c < t1) t1 = c; if (t0 > t1) continue; }
          if (t0 > 0 && t0 < tHit) tHit = t0;          // t0 = 0: tướng đứng trong hộp (lối cổng hẹp) → bỏ qua hộp này
        }
        if (tHit < 1) {
          const keep = CAM_WALL.keep * dist, flat = Math.min(hd, Math.max(CAM_WALL.minH, tHit * hd - CAM_WALL.pad)), k = flat / hd;
          cx = tx + hx * k; cz = tz + hz * k;
          cy = ty + Math.max(cy - ty, Math.sqrt(Math.max(0, keep * keep - flat * flat)));
        }
      }
      cy = Math.max(cy, Math.max(heightAt(cx, cz), waterLevel(cx, cz)) + 1.2);   // B15: waterLevel() = −∞
      if (h.deck) cy = Math.max(cy, hp.y + 2.2);         // B20: tướng trên boong — camera không tụt xuống dưới mạn thuyền
      const k = Math.min(1, dt * 10);
      cam.x += (cx - cam.x) * k; cam.y += (cy - cam.y) * k; cam.z += (cz - cam.z) * k;
      if (time < 0.2) { cam.x = cx; cam.y = cy; cam.z = cz; }
      // rung màn + giật theo hướng chém (fx.kick); nhìn theo cùng độ giật một nửa cho cú giật "đẩy" khung hình tới
      const fxk = ctx.fx;
      camera.position.set(cam.x + fxk.shakeX + fxk.kickX, cam.y + fxk.shakeY + fxk.kickY, cam.z + fxk.kickZ);
      camera.lookAt(tx + fxk.kickX * 0.5, ty, tz + fxk.kickZ * 0.5);
      const fov = 55 - fxk.fovPunch - (h.ranged ? 10 * cam.aimK : 0);
      if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
      ctx.world.fadeOccluders(camera.position, tx, tz, dt);
      const sun = ctx.world.sun, sd = ctx.atmo.sunDir; sun.position.set(tx + sd.x * 120, sd.y * 120, tz + sd.z * 120); sun.target.position.set(tx, 0, tz);
    };
    // live: khung rAF thật (pacing.js: giữ pha giữa bước, khoá pha); tua bằng advance thì false
    const step = (dt, inp, draw, live = false) => {
      time += dt;
      ctx.touch = inp.touch; syncTouch();
      const d = ctx.director;
      if (inp.pressed.pause && !d.over) { pause(true); input.endFrame(); return; }
      ctx.audio.listener.x = ctx.hero.x; ctx.audio.listener.z = ctx.hero.z; ctx.audio.listener.yaw = cam.yaw;
      ctx.voice?.update(dt);

      if (!d.over) {
        // vòng lệnh (giữ Tab)
        ctx.hud.setRing(inp.cmdHeld);
        if (inp.cmdHeld) {
          if (inp.pressed.cmdSwap || inp.pressed.lock) ctx.hud.swapFront();
          ["cmd1", "cmd2", "cmd3", "cmd4"].forEach((k, i) => { if (inp.pressed[k]) ctx.hud.issue(ctx.hud.ringKey(i)); });   // phím 1–4 → 4 ô của vòng (B15/B20: lệnh mặt trận; Tự do: lệnh cận vệ)
          inp.pressed.lock = false;
        } else if (ctx.hud.pickerOpen) ["cmd1", "cmd2", "cmd3", "cmd4"].forEach((k, i) => { if (inp.pressed[k]) ctx.hud.pick(i); });   // bảng chọn điểm đến (hud.picker)
        else ["cmd1", "cmd2", "cmd3", "cmd4"].forEach((k, i) => { if (inp.pressed[k]) ctx.hud.issue(ctx.hud.ringKey(i)); });   // phím 1–4 → 4 ô của vòng (B15/B20: lệnh mặt trận; Tự do: lệnh cận vệ)
        if (inp.pressed.tpc) d.tryTPC();
        if (inp.pressed.kesach) d.keSach?.trigger();
        if (inp.pressed.lock) ctx.hero.toggleLock();
        if (inp.pressed.map) ctx.hud.root.classList.toggle("bigmap");

        let scale = inp.cmdHeld || ctx.hud.pickerOpen ? 0.2 : 1;
        if (slowT > 0) { slowT -= dt; scale *= slowK; }
        if (ctx.hitstopT > 0) { ctx.hitstopT -= dt; scale = 0; }
        ctx.hero.intake(inp);
        pacer.begin(dt, scale, live);
        while (pacer.next()) {
          view.capture(ctx);                // trạng thái đầu bước (bản sao để vẽ, battle/view.js)
          ctx.clock += STEP;
          ctx.naval?.update(STEP);          // B20 (naval.js): thuyền, boong, chở người trên boong — trước mọi người; B15 không có
          ctx.hero.update(STEP, inp);
          ctx.crowd.update(STEP);
          for (const u of ctx.units) u.update(STEP);
          d.update(STEP);
          if (ctx.hitstopT > 0) break;
        }
        pacer.end();
        for (let i = ctx.units.length - 1; i >= 0; i--) if (!ctx.units[i].alive) ctx.units.splice(i, 1);
      }
      // vẽ giữa đầu bước cuối (α = 0) và hiện tại (α = 1); tua bằng advance: α = 1 — đúng trạng thái mô phỏng, camera y như trước đợt 19c
      view.frame(pacer.live ? pacer.alpha : 1, ctx.clock);
      const h = ctx.hero;
      aim(dt, inp);                                // camera, mặt trời

      // cổng: rung khi trúng, đổ khi phá
      for (const id in ctx.world.gates) {
        const g = ctx.world.gates[id];
        if (g.broken) { g.lp.rotation.y = Math.min(1.5, g.lp.rotation.y + dt * 2); g.rp.rotation.y = Math.max(-1.5, g.rp.rotation.y - dt * 2); g.doors.rotation.z = Math.min(0.12, g.doors.rotation.z + dt * 0.2); }
        else { g.lp.rotation.y = g.rp.rotation.y = 0; g.doors.rotation.z = 0; }
        if (g.shake > 0) { g.shake -= dt; g.doors.position.x = g.x + (Math.random() - 0.5) * 0.15; } else g.doors.position.x = g.x;
      }
      def.frameVisuals?.(ctx, dt);   // B15: vòng Cứ Điểm, cờ tuyến hai mặt trận

      if (ctx.hk.tpc && Math.random() < dt * 7) ctx.fx.embers(ctx.hero.x, ctx.hero.z);   // tàn lửa Tổng Phản Công
      // nắng, sương, trời theo pha; khói đống lửa tàn, cột khói, lửa, tàn lửa, đèn lửa (atmosphere.js)
      ctx.atmo.update(dt);
      // nền tiếng giao chiến: càng gần tuyến, càng nhiều lính đang đánh nhau quanh tướng thì càng dày
      bedT -= dt;
      if (bedT <= 0) {
        bedT = 0.3;
        const { dF, fire } = def.bed(ctx);          // khoảng cách tới giao tranh, mức lửa trại (BattleDef)
        let fighting = 0;
        for (const a of ctx.crowd.agents) if ((a.windup > 0 || a.duel) && a.state !== "dead" && (a.x - h.x) ** 2 + (a.z - h.z) ** 2 < 900) fighting++;
        const river = Math.min(1, Math.max(0, 1 - waterDist(h.x, h.z) / 70));     // sóng sông: đầy khi đứng sát nước, hết ở 70 m (ground.waterDist theo bản đồ của trận)
        ctx.audio.setBed(Math.min(1, Math.max(0, 1 - dF / 140) * 0.55 + Math.min(1, fighting / 18) * 0.45 + (ctx.hk.tpc ? 0.2 : 0)), fire, river);
      }
      ctx.world.update(time);
      ctx.ambient?.update(view.clock);  // giờ vẽ (đồng hồ trận lùi (1 − α) bước): hit-stop đứng hình, vòng lệnh chậm ×0,2, màn 120 Hz liền mạch
      ctx.crowd.render();
      ctx.fx.update(dt, W, H);
      hudAcc += dt;
      if (hudAcc > 0.05) { ctx.hud.update(hudAcc, W, H); hudAcc = 0; }
      view.begin();                                // rig ở vị trí nội suy trong lúc vẽ, trả lại đúng từng bit ngay sau (battle/view.js)
      try { if (draw) renderer.render(scene, camera); } finally { view.end(); }
      ctx.hud.frame?.(W, H);                       // nhãn chỉ đường bám mục tiêu mỗi khung (hud.js), không đợi nhịp 0,05 s
      ctx.hints?.update(dt, inp);                  // gợi ý lần đầu (hints.js); đọc cạnh bấm trước input.endFrame()
      const anyKey = Object.keys(inp.pressed).length > 0;     // đọc trước endFrame (inp === input, endFrame xoá pressed)
      input.endFrame();

      // nhạc theo BattleDef (B15: P4 và Tổng Phản Công đổi sang bài trận boss)
      if (!d.over && music) music.play(def.music(d, ctx.hk), { fade: 2 });
      if (d.over && !endShown && music) { if (d.result.won) music.play("victory", { loop: false, then: "hub" }); else music.stop(2); }
      if (d.over && !endShown) {
        endShown = true;
        if (d.result.won) { outroT = 0; outroTap = false; container.classList.add("outro-mode"); } else setTimeout(() => showEnd(d.result), 1800);
      }
      if (outroT >= 0 && d.over && (outroT >= OUTRO.sec || (outroT > 0.6 && (anyKey || outroTap)))) { outroT = -1; container.classList.remove("outro-mode"); showEnd(d.result); }
      if (!d.over) { endShown = false; outroT = -1; container.classList.toggle("outro-mode", false); }   // toggle(…, false): không ghi lại class mỗi khung như remove
    };
    // Làm nóng (battle/gfx.js) trước khung đầu: sprite fx dựng sẵn, vòng báo đòn, cờ, vật phẩm, rig sĩ quan / boss / tướng vào sau
    // (BattleDef.rigs); biên dịch, vẽ một lượt lên canvas còn bị màn tải che. Xong (hoặc lỗi) mới hiện trận và chạy vòng lặp.
    // Trước đó (đồng bộ, trước mọi bước trận): camera đặt vào chỗ mở màn, lính có chỗ vẽ, tư thế (crowd.render), thuyền B20 (naval.render)
    // — chỉ phần vẽ — lượt làm nóng vẽ đúng cảnh khung đầu, cả lính (trước đây lưới lính còn rỗng nên lần vẽ đầu của chúng rơi vào khung đầu
    // nhìn thấy), và hình nằm lại trên canvas là cảnh thật (cầm dọc chờ xoay ngang, tạm dừng lúc đang tải). Sau: HUD một lượt (khung đầu đủ
    // bản đồ nhỏ, mục tiêu). ctx.warmed: kịch bản kiểm thử (?debug) chờ cờ này; tua bằng advance trong lúc làm nóng vẫn được (làm nóng chỉ vẽ).
    ctx.warmed = false;
    (async () => {
      try {
        const h = ctx.hero;
        aim(0, NOIN); ctx.crowd.render(); ctx.naval?.render(camera, { x: h.x, y: h.y + 1.3, z: h.z });
        warm = new Warm(scene, ctx, ["doitruong", "photuong", ...(def.rigs || [])]); await warm.run(renderer, scene, camera, preloadFx());
        if (window.__hk === ctx) ctx.warmStats = warm.stats;
      } catch (err) { console.warn("làm nóng", err); }
      if (finished) return;
      try { ctx.hud.update(0.05, W, H); ctx.hud.frame?.(W, H); ctx.hudB20?.update(ctx.director.hudState(), 0); } catch (err) { console.warn("HUD", err); }   // B20: con nước, bảng
      ctx.warmed = true; onReady?.();
      last = performance.now(); raf = requestAnimationFrame(frame);
    })();
  });
}

// Rời trận / Võ trường: giải phóng GPU của cảnh và đệm dùng chung giữa các trận, rồi bỏ hẳn ngữ cảnh WebGL.
// Texture, hình học three đã nạp gắn listener "dispose" giữ gl → canvas → .stage → nút bấm → ctx; đệm cấp module
// (ảnh fx.js, hình học Sprite của three, rig đệm models.js) còn giữ listener thì cả trận cũ (≈ 46 MB heap, bóng
// 2048², texture xương) ở lại sau mỗi lần rời. Dispose trước renderer.dispose() để lệnh xoá GL còn chạy; ảnh, hình
// học đệm tự nạp lại ở trận sau. Chỉ chạy một lần lúc thoát nên cấp phát thoải mái.
export function releaseGpu(scene, renderer) {
  const seen = new Set();
  const tex = (t) => { if (t && t.isTexture && !seen.has(t)) { seen.add(t); t.dispose(); } };
  scene.traverse((o) => {
    o.geometry?.dispose?.();
    if (o.isInstancedMesh) o.dispose();                 // bộ đệm instanceMatrix / instanceColor
    o.skeleton?.dispose?.();                            // texture xương
    for (const m of o.material ? [].concat(o.material) : []) {
      if (seen.has(m)) continue; seen.add(m);
      for (const k in m) tex(m[k]);
      if (m.uniforms) for (const k in m.uniforms) { const v = m.uniforms[k]?.value; if (Array.isArray(v)) v.forEach(tex); else tex(v); }
      m.dispose();
    }
  });
  tex(scene.background);
  releaseFxTextures();
  Models.releaseRigCache?.();                           // rig đệm (models.js RIG_GEO) của sĩ quan đã chết trước khi hết trận
  renderer.dispose(); renderer.forceContextLoss();      // trả bộ nhớ GPU ngay, không chờ trình duyệt thu ngữ cảnh cũ
}

export function lerpAngle(a, b, t) {
  let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
  return a + d * t;
}

// log: sổ tin của HUD (hud.js, ui/layout.js logMsgs) — HUD gọn chỉ hiện một tin 5 s nên tin đã trôi đọc lại ở đây, mới nhất trên cùng.
export function logHTML(log) {
  if (!log?.length) return "";
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  return `<details class="msglog"${log.length ? " open" : ""}><summary>Tin trong trận · ${log.length}</summary><ol>${log.slice().reverse().map((m) => `<li class="${m.kind}">${esc(m.text)}</li>`).join("")}</ol></details>`;
}
// gfx: Đồ hoạ của trận (battle/gfx.js) — Tự động ghi kèm mức đang dùng; ghi chú cuối ghi cỡ khung vẽ thật (điểm ảnh) để đối chiếu trên máy.
function pauseHTML(save, heroId = "H35", def = null, dev = 0, log = null, gfx = null) {
  const s = save.settings;
  const opt = (v, cur, label) => `<option value="${v}" ${v === cur ? "selected" : ""}>${label}</option>`;
  const gl = (l) => (l.id === "auto" && gfx && !isGfx(s.graphics) ? `${l.name} · ${GFX_NAME[gfx.tier]}` : l.name);
  const cv = gfx?.renderer?.domElement;
  return `<div class="panel pause">
    <h2>TẠM DỪNG</h2>
    <div class="row"><button class="primary" data-a="resume">Tiếp tục</button>${def?.noRetry ? "" : `<button data-a="retry">Tải lại đầu pha</button>`}<button data-a="quit">Rút quân</button></div>
    ${logHTML(log)}
    <h3>Cài đặt (đổi được giữa trận)</h3>
    <label>Số lính hiển thị <select data-set="troops">${TROOP_LEVELS.map((t) => opt(t.id, s.troops, `${t.name} · ${t.N}`)).join("")}</select></label>
    <label>Đồ hoạ <select data-set="graphics">${GFX_LEVELS.map((l) => opt(l.id, isGfx(s.graphics) ? s.graphics : "auto", gl(l))).join("")}</select></label>
    <label>Tỉ lệ render <input type="range" min="0.5" max="1" step="0.05" value="${s.renderScale}" data-set="renderScale"></label>
    <label>Bóng <input type="checkbox" ${s.shadows ? "checked" : ""} data-set="shadows"></label>
    <label>Âm lượng hiệu ứng <input type="range" min="0" max="1" step="0.05" value="${s.volume}" data-set="volume"></label>
    <label>Âm lượng nhạc <input type="range" min="0" max="1" step="0.05" value="${s.music ?? 0.5}" data-set="music"></label>
    <label>Âm lượng giọng nói <input type="range" min="0" max="1" step="0.05" value="${s.voice ?? 0.9}" data-set="voice"></label>
    <label>Gợi ý lần đầu <input type="checkbox" ${s.hints !== false ? "checked" : ""} data-set="hints"></label>
    <p class="small">Số lính hiển thị chỉ đổi phần vẽ; mô phỏng và vùng chiến đấu cho cùng kết quả ở mọi mức. Đồ hoạ Tự động chọn theo máy và tự hạ độ phân giải khi khung hình chậm; khử răng cưa đổi từ trận sau.${cv ? ` Khung vẽ lúc này <span data-cv>${cv.width}×${cv.height}</span> điểm ảnh.` : ""}</p>
    ${controlsHTML(dev, heroId)}${def?.touch?.interact ? interactNote(def) : ""}
  </div>`;
}

// Bảng điều khiển trong bảng tạm dừng: dùng chung bảng hướng dẫn có icon (ui/guide.js), bản gọn. hero: tướng đang ra trận
// (đợt 9: H31 thấy đòn đại kiếm, Hịch Tướng Sĩ, Binh Thư; mặc định H35 — Võ trường, B15 như cũ).
// dev: 0 bàn phím, 1 cảm ứng, 2 tay cầm (devOf(ctx), thiết bị đang dùng). Nhận cả true / false như trước = cảm ứng / bàn phím.
// Trước đây bảng này hỏi trình duyệt "(pointer: coarse)" nên máy báo cảm ứng luôn thấy bảng cảm ứng dù chơi bằng bàn phím.
export function controlsHTML(dev = 0, hero = "H35") {
  return `<h3>Điều khiển</h3>${movesGuideHTML({ dev: typeof dev === "number" ? dev : dev ? 1 : 0, compact: true, hero })}`;
}

// Trận có Tương tác (B20): một dòng dưới bảng đòn; def.controlsNote (tùy chọn) ghi việc cụ thể của trận. B15 không có.
const interactNote = (def) => `<p class="small"><b>Tương tác</b>: giữ <b>X</b> (tay cầm: D-pad xuống; nút cảm ứng Tương tác) — ${def.controlsNote || "thao tác theo chỗ đứng: chiếm thuyền, lên boong, mở mốc cọc, gọi đò chuyển"}.</p>`;

// Bố cục gọn (đợt 13, css/hud.css): khung trận mang .compact khi lớp cảm ứng đang hiện hoặc khung hẹp / thấp (ui/layout.js isCompact),
// --u = cỡ nút cảm ứng theo chiều cao màn (touchUnit). Gọi lúc dựng, lúc đổi cỡ và khi lớp cảm ứng bật / tắt.
// Màn nhắc xoay ngang đang che trận (cùng điều kiện với css/hud.css, b20.css): giao diện cảm ứng (hoặc B20) trên điện thoại dọc ≤ 600 px.
const PORTRAIT = typeof matchMedia === "function" ? matchMedia("(orientation: portrait) and (max-width: 600px)") : null;
export const rotateBlocked = (container) => !!PORTRAIT?.matches && (container.classList.contains("touchmode") || container.classList.contains("b20"));
export function syncCompact(container) {
  const W = container.clientWidth, H = container.clientHeight;
  container.classList.toggle("compact", isCompact({ w: W, h: H, touch: container.classList.contains("touchmode") }));
  container.style.setProperty("--u", `${touchUnit(H)}px`);
}

// nút cảm ứng có icon chiêu (nút C đổi icon theo đòn C kế tiếp, hud.js); p: vị trí trên cung quanh N (ui/layout.js touchArc, đơn vị u)
const tb = (b, icon, label, cls = "", p = null) => `<button data-b="${b}" class="${cls}"${p ? ` style="--x:${p.x.toFixed(3)};--y:${p.y.toFixed(3)};--s:${p.s}"` : ""}><img src="./assets/icons/${icon}.webp" alt=""><em>${label}</em></button>`;
const MENU_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M5 12h14M5 17h14"/></svg>`;
// Ô kỹ năng theo tướng (hero.skillSlots(), hero.ultInfo()): H35 đúng hai nút Phá Trận, Tuyệt Kỹ như cũ; tướng có ô thứ
// hai (H31 Binh Thư) thêm nút skill2; trận có Tương tác (BattleDef.touch.interact) thêm nút interact.
// Nhãn nút tròn: tên ngắn SKILLS[id].short (tên đầy đủ "Binh Thư Yếu Lược" bị cắt trong nút 54–58 px), không có thì tên ô.
const tlabel = (s) => (s ? SKILLS[s.id]?.short ?? s.name : undefined);
// Dựng lớp cảm ứng một lần; show = hiện ngay. Trả { shown, set(on) }: set bật / tắt lớp phủ (`.touch.on`, `touchmode` trên khung trận).
// Lớp phủ kín cả màn hình nên khi hiện nó chặn chuột — người chơi chuột + bàn phím không thể khóa chuột — vì vậy phải ẩn được.
export function buildTouch(root, input, ctx, show = true) {
  const ui = {
    get shown() { return root.classList.contains("on"); },
    set(on) {
      root.classList.toggle("on", on); root.parentElement.classList.toggle("touchmode", on);
      if (on) input.touch = true;       // giao diện cảm ứng đang hiện thì chữ phím theo cảm ứng ngay (trước đây tới lần chạm đầu ctx.touch vẫn false)
      syncCompact(root.parentElement);  // cảm ứng luôn dùng HUD gọn
    },
  };
  ui.set(show);
  const slots = ctx.hero?.skillSlots?.() || [], s1 = slots[0], s2 = slots[1], ult = ctx.hero?.ultInfo?.();
  // Cụm nút hình cung quanh N ở góc phải dưới (ui/layout.js touchArc): vòng trong C / Đỡ / Né, vòng ngoài kỹ năng, Tuyệt Kỹ, Tương tác.
  // Nút hệ thống (Kế Sách, Lệnh, Phản Công, Khóa, tạm dừng) gom sau nút ☰ trên cần điều khiển; ☰ sáng khi có việc trong đó (hud.js).
  // Nút chưa mở (người lính chế độ Tự do: hero.locked(id) theo bậc) thì không dựng — Lính chỉ thấy N, C, Né, Đỡ, Khóa, tạm dừng.
  const off = (id) => !!ctx.hero?.locked?.(id);
  const ids = ["c", "dodge", "block", ...(off("skill") || (!s1 && ctx.hero?.locked) ? [] : ["skill"]), ...(off("ult") ? [] : ["ult"]), ...(s2 && !off("skill2") ? ["skill2"] : []), ...(ctx.battle?.touch?.interact ? ["interact"] : [])];
  const arc = touchArc(ids);
  root.innerHTML = `
    <div class="stick" data-t="stick"><div class="knob"></div></div>
    <div class="camzone" data-t="cam"></div>
    <div class="tbtns">
      ${tb("n", "n", "N", "big", { x: 0, y: 0, s: 1.6 })}${tb("c", "c1", "C", "mid", arc.c)}
      ${tb("dodge", "dodge", "Né", "", arc.dodge)}${tb("block", "block", "Đỡ", "", arc.block)}
      ${arc.skill ? tb("skill", s1?.icon ?? "skill", tlabel(s1) ?? "Phá Trận", "", arc.skill) : ""}${arc.ult ? tb("ult", ult?.icon ?? "ult", ult?.label && ctx.hero?.locked ? ult.label : "Tuyệt Kỹ", "", arc.ult) : ""}${arc.skill2 ? tb("skill2", s2.icon ?? "skill", tlabel(s2) ?? s2.name ?? s2.id, "sk-" + s2.id, arc.skill2) : ""}
      ${ctx.battle?.touch?.interact ? tb("interact", "kesach", "Tương tác", "act", arc.interact) : ""}
    </div>
    <div class="tsys"><button class="tmenu" data-menu aria-label="Lệnh, Kế Sách, Phản Công, Khóa, tạm dừng" aria-expanded="false">${MENU_SVG}</button>
      <div class="tfan">${off("kesach") ? "" : tb("kesach", "kesach", "Kế Sách")}${off("cmd") ? "" : tb("cmd", "cmd", "Lệnh")}${off("tpc") ? "" : tb("tpc", "tpc", "Phản Công")}${tb("lock", "lock", "Khóa")}<button data-b="pause">II</button></div></div>`;
  // ☰: mở / gập quạt nút hệ thống; tự gập sau 5 s (trừ lúc vòng Mệnh Lệnh đang mở) và sau khi bấm một nút trong quạt
  const sys = root.querySelector(".tsys"), menu = sys.querySelector("[data-menu]");
  let fanTimer = 0;
  const fan = (open) => {
    sys.classList.toggle("open", open); menu.setAttribute("aria-expanded", String(open)); clearTimeout(fanTimer);
    if (open) fanTimer = setTimeout(function tick() { if (input.touchHeld.cmd) fanTimer = setTimeout(tick, 1000); else fan(false); }, 5000);
  };
  menu.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); ctx.audio.unlock(); fan(!sys.classList.contains("open")); });
  // chọn lệnh trong vòng Mệnh Lệnh (hud.issue) bằng cảm ứng: đóng vòng (đồng hồ trận về ×1) và gập quạt
  if (ctx.hud) ctx.hud.onIssue = () => { if (input.touchHeld.cmd) { input.touchButton("cmd", false); sys.querySelector("[data-b=cmd]")?.classList.remove("on"); } fan(false); };
  root.querySelectorAll("[data-b]").forEach((b) => {
    const name = b.dataset.b, inFan = !!b.closest(".tfan");
    const down = (e) => { e.preventDefault(); ctx.audio.unlock(); if (name === "cmd") { const on = !input.touchHeld.cmd; input.touchButton("cmd", on); b.classList.toggle("on", on); if (!on) fan(false); return; } input.touchButton(name, true); b.classList.add("on"); };
    const up = (e) => { e.preventDefault(); if (name === "cmd") return; input.touchButton(name, false); b.classList.remove("on"); if (inFan && e.type === "pointerup") fan(false); };
    b.addEventListener("pointerdown", down); b.addEventListener("pointerup", up); b.addEventListener("pointercancel", up); b.addEventListener("pointerleave", up);
  });
  const stick = root.querySelector("[data-t=stick]"), knob = stick.querySelector(".knob");
  let sid = null, ox = 0, oy = 0;
  stick.addEventListener("pointerdown", (e) => { sid = e.pointerId; const r = stick.getBoundingClientRect(); ox = r.left + r.width / 2; oy = r.top + r.height / 2; stick.setPointerCapture(sid); move(e); });
  const move = (e) => {
    if (e.pointerId !== sid) return;
    let dx = e.clientX - ox, dy = e.clientY - oy; const R = stick.clientWidth * 0.42 || 55, l = Math.hypot(dx, dy);
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
  return ui;
}

// "Điều khiển cảm ứng" (save.settings.touch): off = không dựng lớp cảm ứng; on = luôn hiện; auto ("Tự nhận") = bắt đầu theo cách bạn bấm VÀO
// TRẬN (data/controls.js touchUI) rồi đi theo thiết bị vừa dùng: bấm phím / chuột / tay cầm thì ẩn lớp cảm ứng (nó phủ kín màn hình nên chặn
// chuột, không khóa chuột được), chạm ngón tay lên sân thì hiện lại. Trả hàm đồng bộ, gọi mỗi khung sau input.poll(). Khung trận (container)
// dựng mới cho mỗi trận nên bộ nghe chạm không cần gỡ.
export function setupTouch(container, touchRoot, input, ctx, settings) {
  if (settings.touch === "off") return () => {};
  const ui = buildTouch(touchRoot, input, ctx, touchUI(settings));
  if (settings.touch !== "auto") return () => {};
  container.addEventListener("pointerdown", (e) => { if (e.pointerType === "touch" && !ui.shown) input.touch = true; }, true);
  return () => { if (input.touch !== ui.shown) ui.set(input.touch); };
}
