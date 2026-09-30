// battles/b20.js — BattleDef của B20 Bạch Đằng (9/4/1288): BẢN GIỮ CHỖ của đợt 9 lõi. Pha D (director-b20.js, naval.js,
// hud-b20.js, atmo-b20.js) thay phần giữ chỗ; các móc theo danh sách ở đầu battles/b15.js.
//
// Đã có thật: thế giới (world-b20.js: địa hình khúc sông, nước theo Con nước, cảnh, hai cầu bến là boong), mặt đất cho
// mọi module qua ground.setBattleTerrain (độ cao = lưới đang vẽ world.groundY), boong (setDecks: đứng được trên cầu bến),
// mặt nước (setWaterLevel: camera không chui xuống nước), camera far 2200, bản đồ nhỏ khúc sông.
// Giữ chỗ: DirectorB20Stub (không có hạm đội, pha, Kế Sách; tướng đi thử bản đồ, Rút quân để về), mô phỏng rỗng, một bảng
// trời buổi sáng, chặn lội quá sâu đơn giản (collideExtra đẩy về phía bờ gần). Kết quả trận mang stub: true — main.js
// không chấm điểm, không thưởng.

import { TERRAIN_B20, WADE_MAX, zc, hw } from "../data/terrain-b20.js";
import { MAP, PHASES, SIDE_MISSIONS, KE_SACH, KS_ORDER, BOSSES, ALLY_GENERALS, STORY_INSERTS, HISTORY_NOTES, TIDE } from "../data/battle-b20.js";
import { buildWorldB20 } from "../battle/world-b20.js";
import { setBattleTerrain, setDecks, setWaterLevel } from "../battle/ground.js";
import { MODES } from "../data/tuning.js";

const TIDE0 = TIDE.p1.from;                              // Con nước lúc mở màn P1 (85%)
const PAR = Math.round(PHASES.reduce((s, p) => s + p.par, 0) * 60);   // par Trận nhanh = tổng par pha (≈ 12,75 phút)
// Tướng ra trận trên bờ bắc, dưới gò bản doanh, nhìn ra sông (ĐỀ XUẤT BẢN THỬ; pha D đặt tướng lên thuyền chỉ huy nhẹ)
const SPAWN_X = 600, SPAWN_Z = Math.round(zc(600) - hw(600) - 24);

// ---- chặn lội sâu (giữ chỗ cho naval.js của pha D) --------------------------------------------------------------------
// Chỗ nước sâu quá WADE_MAX (không đứng trên boong) thì đẩy theo z về phía bờ gần tới chỗ lội được.
function wadeGuard(world) {
  return (x, z) => {
    if (world.decks.heightAt(x, z) === world.decks.heightAt(x, z)) return null;       // trên boong / cầu bến
    if (world.tideY - world.groundY(x, z) <= WADE_MAX) return null;
    const s = z < zc(x) ? -1 : 1;
    for (let k = 1; k <= 400; k++) { const zz = z + s * 0.5 * k; if (world.tideY - world.groundY(x, zz) <= WADE_MAX) return [x, zz]; }
    return null;
  };
}

// ---- điều phối giữ chỗ --------------------------------------------------------------------------------------------------
// Đủ giao diện Director mà tướng, lính, HUD, bầu trời, vòng trận gọi (như ArenaDirector); không sinh địch.
class DirectorB20Stub {
  constructor(ctx) {
    this.ctx = ctx; ctx.director = this;
    this.phase = 0; this.phaseStart = 0; this.time = 0; this.ko = 0; this.msgs = []; this.over = false; this.result = null;
    this.events = {}; this.generals = {}; this.pickups = []; this.keepers = {}; this.flags = []; this.followers = null;
    this.retries = 0; this.lastFront = null; this.mode = ctx.mode || "nhanh"; this.M = { ...MODES[this.mode], par: PAR };
    this.baseHint = "Bản giữ chỗ: đi thử khúc sông · Esc → Rút quân để về Doanh trại";
    this.keSach = { list: [], boats: [], bundles: [], hud: () => [], trigger: () => this.say("Kế Sách B20 chưa có ở bản giữ chỗ.", 2), update() {} };
    this.say("Trận Bạch Đằng đang dựng: chưa có hạm đội, Con nước, Kế Sách. Bản này để đi thử bản đồ — bờ, bãi bùn, cầu bến.", 9);
  }
  say(text, T = 4, kind = "info") { this.msgs.push({ text, T, kind, t: 0 }); }
  update(dt) {
    for (const m of this.msgs) m.t += dt; this.msgs = this.msgs.filter((m) => m.t < m.T);
    if (!this.over) this.time += dt;
  }
  basePos(id) { const v = this.ctx.world.bases[id]; return v ? { x: v.x, z: v.z, r: v.r } : null; }
  order() { this.say("Chưa có cánh quân để ra lệnh ở bản giữ chỗ.", 2); }
  tryTPC() {}
  fillActors() {}
  killActor() {}
  restoreCheckpoint() {
    const h = this.ctx.hero; h.x = SPAWN_X; h.z = SPAWN_Z; h.alive = true; h.state = "free"; h.hp = h.maxHp;
    this.over = false; this.result = null; this.retries++;
  }
  lose(why = "Rút quân khỏi trận.") {
    if (this.over) return;
    this.over = true;
    this.result = { stub: true, battle: "B20", won: false, why, canRetry: false, R: this.ctx.R, difficulty: this.ctx.diff.id, mode: this.mode,
      timeSec: Math.round(this.time), ko: this.ko };
  }
  // móc từ tướng, lính, sĩ quan (không làm gì ở bản giữ chỗ)
  onSoldierKilled(a, opt) { if (a.side === "dich" && opt?.by === "hero") this.ko++; }
  onOfficerKilled() { this.ko++; }
  onBossDefeated() {}
  onOfficerAwake() {}
  onBreak() {}
  onHeroHit() {}
  onRevive() {}
  onUlt() {}
  onUltEnd() {}
  onArmyBuff() { this.say("Hịch Tướng Sĩ: bản giữ chỗ chưa có cánh quân để nhận Sĩ Khí.", 2); }
  onCounterBoss() {}
  onAllyGeneralDown() {}
  onHeroAction() {}
  ultQ() {}
  plantFlag(x, z, r) { this.ctx.fx.ring(x, z, r, 0xf1d98a, 0.8); }
  damageGate() {}
  onHeroDead() { const h = this.ctx.hero; h.alive = true; h.state = "free"; h.hp = h.maxHp; h.invuln = 2; this.say("Bản giữ chỗ: tướng không gục.", 2); }
}

// ---- trời buổi sáng (một bảng; pha D thay bằng atmo-b20.js 6 pha) -------------------------------------------------
// Như P1 của B15 nhưng sương xa hơn cho khúc sông 1,5 km (world-b20 mặc định sương 170–760 m).
const MORNING = { id: "P1", sun: 0xffdcaa, sunI: 2.2, el: 40, az: 70, sky: 0xffe8c8, ground: 0x3d3222, hemiI: 1.12,
  fog: 0xcfb896, fogNear: 220, fogFar: 1100, bg: 0xd9c4a0, top: 0x2f4a58, mid: 0xa47c56, hor: 0xecd0a0,
  exposure: 1.05, far: 0xffffff, haze: 0xf2e6d6, smoke: 1, cols: 0, embers: 0 };

// ---- bản đồ nhỏ: sông (dải |z − zc| ≤ hw), bản doanh, bến, mốc Khúc cọc --------------------------------------------
function drawBase({ c, W, H, X, Z }, ctx) {
  c.fillStyle = "#b7a276"; c.fillRect(0, 0, W, H);
  c.fillStyle = "#2f5d62"; c.beginPath();
  for (let x = MAP.minX; x <= MAP.maxX; x += 20) c.lineTo(X(x), Z(zc(x) - hw(x)));
  for (let x = MAP.maxX; x >= MAP.minX; x -= 20) c.lineTo(X(x), Z(zc(x) + hw(x)));
  c.closePath(); c.fill();
  c.strokeStyle = "rgba(241,217,138,.5)"; c.lineWidth = 1; c.beginPath(); c.moveTo(X(MAP.khucCoc), Z(-300)); c.lineTo(X(MAP.khucCoc), Z(300)); c.stroke();
  c.fillStyle = "#c0392b"; c.fillRect(X(MAP.hq.x) - 4, Z(MAP.hq.z) - 4, 8, 8);
  for (const p of MAP.piers) { c.fillStyle = "#e0a24a"; c.fillRect(X(p.x) - 2, Z(p.z) - 2, 4, 4); }
}

export const B20 = {
  id: "B20", chapter: "B20", name: "Bạch Đằng", stub: true,
  data: { MAP, PHASES, SIDE_MISSIONS, KE_SACH, KS_ORDER, BOSSES, ALLY_GENERALS, FRONTS: {}, EVENTS: {}, STORY_INSERTS, HISTORY_NOTES },
  preset: { level: 25 }, fixedR: 25,
  camFar: 2200,                                           // núi đá vôi xa ở ~1,75 km (world-b20 addSkyKit)
  openGates: () => ({}),
  heroSpawn: { x: SPAWN_X, z: SPAWN_Z, yaw: 0 },          // nhìn ra sông (+z)
  camYaw: 0,
  par: { nhanh: PAR, chuan: PAR },
  buildWorld(scene, { shadows }) {
    const world = buildWorldB20(scene, { shadows, tide: TIDE0 });
    setBattleTerrain({ ...TERRAIN_B20, height: world.groundY, bare: world.groundY, clamp: MAP.clamp, collideExtra: wadeGuard(world) });
    world.decks.active(SPAWN_X, SPAWN_Z); setDecks(world.decks);
    setWaterLevel(() => world.tideY);
    return world;
  },
  sim: { create: () => ({ t: 0, heroFront: null, fronts: {}, bases: {}, cooldowns: {}, reinf: null }) },
  Director: DirectorB20Stub,
  atmo: { presets: [MORNING], buildSources: () => [], sourceWant: () => 0 },
  ambient: null,
  // boong đang xét (DeckSet chỉ tra ≤ 12 boong gần tướng; pha D: naval.update làm việc này mỗi bước mô phỏng)
  frameVisuals(ctx) { ctx.world.decks.active(ctx.hero.x, ctx.hero.z); },
  bed: () => ({ dF: 999, fire: 0 }),
  music: (d, hk) => (hk.tpc ? "boss" : "battle"),
  hud: { bounds: { x0: MAP.minX, x1: MAP.maxX, z0: MAP.minZ, z1: MAP.maxZ }, canvas: { w: 240, h: 95 }, drawBase, frontsHTML: () => "" },
  touch: { interact: true },
  debug: null,
};
export default B20;
