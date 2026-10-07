// battle/naval.js — lớp thủy chiến B20 Bạch Đằng (đợt 9 pha D1): thuyền, boong, bè cỏ, ván bắc áp mạn, ván dốc xuống bùn
// của thuyền mắc cạn, đò chuyển, leo boong, lội / bơi, vớt tướng. Director B20 (pha D2) và bot (D4) dựng trên lớp này.
//
// ---- API (hợp đồng B20-GAMEPLAY §D1; lệch hợp đồng ghi ở mục "Khác hợp đồng" cuối phần này) -----------------------------
//   Naval.install(ctx, world, { cap }) → naval      dựng lớp thủy chiến + gắn mặt đất trận (ground.setBattleTerrain /
//                                                  setDecks / setWaterLevel) — gọi trong BattleDef.buildWorld; ctx.naval = naval
//   new Naval(ctx, world, { cap })                 chỉ dựng (không đụng ground.js); owns FleetRenderer, boats[], rafts, links
//   addBoat(opts) → Boat                           opts của Boat (type, side, id, path, speed, flag, s0) + label, kind; tự đăng
//                                                  ký boong vào world.decks, autoGround = false (director quyết mắc cọc / mắc cạn)
//   removeBoat(boat)
//   update(dt)                                     ĐẦU mỗi bước mô phỏng (battle.js gọi ctx.naval.update trước tướng): chở người
//                                                  trên boong (toạ độ cục bộ o.dlx, o.dlz, o.dyaw), chạy thuyền, đặt tư thế boong,
//                                                  bè, ván bắc; thuyền mắc cạn thì bắc ván dốc; leo, đò chuyển; vớt tướng rơi nước
//   render(camera)                                 sau vòng bước (BattleDef.frameVisuals): FleetRenderer.sync + ván, xích
//   spawnCrew(boat, { side, n, kitMix, officer, tier, role, officerTier, name }) → agents[] (agents.officer = BigUnit | null)
//   grapple(a, b, { chain }) → link / release(link)   ván bắc giữa hai boong; b bám a (dừng chuyển động tương đối).
//                                                  chain(boats[]) → links: Liên Hoàn Thuyền (xích + ván, cả cụm không dập dềnh)
//   board(o, deck) / leave(o)                      cho tướng / đơn vị lớn / lính lên boong (toạ độ cục bộ) hoặc về đất
//   climbTo(o, deck, local?) → handle              leo 0,8 s lên boong (tướng: trạng thái "climb"); không leo được thì null
//   ferry(hero, dest, { followers, onDone }) → handle { done, t, T, len, phase, boat, cancel() }   đò chuyển
//   ferryDestinations(hero, phase) → [{ id, label, sub, kind, x, z }]  (≤ 4, gần trước; director lọc / thêm tuỳ pha)
//   interactables(hero) → [{ kind:"capture"|"board"|"marker"|"ferry", id, deck, hold, label }]  theo thứ tự ưu tiên
//   interactStep(hero, held, dt) → { item, p, done }  bộ giữ phím Tương tác (X / D-pad xuống); xong thì doInteract(item)
//   doInteract(item, hero)                          hành động mặc định (móc naval.on.* của director thay được)
//   captureShip(boat)                              chiếm thuyền: cờ 陳, dừng, phe ta, làm nơi đến đò chuyển
//   addRamp(boat)                                  ván dốc xuống bùn (tự bắc khi thuyền "stranded"; boat.rampOk = false thì thôi)
//   (hàm thuần xuất kèm) strandSelect(ids, share, keep), ferryTiming(len), ferryPath(a, b, dry), sortInteract(list)
//   deckOf(o), shipAt(x, z), boatById(id)
//   surfaceY(x, z), inDeepWater(x, z), deep(x, z), shore(x, z)
//   standY(a), land(a), toSwim(a), swim(a, dt)       lính: độ cao đứng, chạm đất / nước, bơi vào bờ (crowd.js gọi)
//   route(o, target, tx, tz) → { x, z } | null      điểm trung gian qua ván bắc / ván dốc khi mục tiêu ở boong khác
//   snapshot() / restore(snap)                     thuyền, trạng thái, ván bắc (lính do director dựng lại theo pha)
//   dispose()
// Móc director (naval.on, tuỳ chọn): capture(boat), marker(raftId, hero), ferry(hero) (mở bảng chọn), rescue(hero),
// shipCaptured(boat); naval.canMarker(id) → bool (mặc định: mốc còn ẩn); naval.canFerry() → bool (mặc định: được gọi đò).
// Dịch chuyển tức thời người đang đứng trên boong (checkpoint, đặt tướng theo pha): gọi leave(o) trước (hoặc board(o, boong
// mới) sau khi đặt) — không thì bước sau naval kéo người đó về lại boong cũ.
// Thuộc tính trên vật: o.deck (Deck | null), o.dlx/o.dlz/o.dli/o.dyaw (toạ độ trên boong), o.climbY (đang leo), a.boat
// (lính thuộc thủy thủ thuyền nào), boat.crew / boat.officer / boat.captured / boat.anchor / boat.ramp / boat.label.
// Boong: deck.kind ("ship" | "flagship" | "light" | "raft" | "pier" | "plank"), deck.label, deck.raft (id mốc), deck.pier.
//
// Khác hợp đồng: (1) board(o, deck, portal?) bỏ tham số portal (vị trí người giữ nguyên, lên boong bằng bước đi hoặc
// climbTo); (2) thêm Naval.install, climbTo, chain, interactStep, doInteract, captureShip, route, land/toSwim/swim, standY;
// (3) Boat "caught" nay là dừng + nổi, chưa nghiêng — strand() mới lún, nghiêng (boats.js).
//
// Luật (ĐỀ XUẤT BẢN THỬ, bảng NAV): tự bước sang boong khác / xuống đất khi chênh ≤ 1 m (ván bắc, ván dốc, cầu bến); cao
// hơn phải leo (Tương tác 1 s trong 4 m); nước sâu hơn WADE_MAX (0,9 m) thì người không lội được — va chạm đẩy về chỗ lội
// được gần nhất, lính rơi xuống nước thì bơi vào bờ (không xác trôi, không cận cảnh chết đuối — R-spec §6), tướng rơi nước
// thì được vớt lên boong / bờ gần nhất, mất 5% Sinh lực.

import * as THREE from "three";
import { Boat, FleetRenderer, HULLS, BOAT } from "./boats.js";
import { Deck } from "./deck.js";
import { BigUnit } from "./units.js";
import { heightAt, setBattleTerrain, setDecks, setWaterLevel } from "./ground.js";
import { RAFT, zc, hw } from "../data/river-b20.js";
import { WADE_MAX, TERRAIN_B20, mudAt as mudB20, TIDE } from "../data/terrain-b20.js";
import { MAP, BOARD } from "../data/battle-b20.js";
import { makeRng } from "../core/rng.js";
import { lerpYaw, SNAP_D } from "./pacing.js";

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth01 = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const lc1 = (s) => (s ? s[0].toLowerCase() + s.slice(1) : s);     // "Chiến thuyền Nguyên" → "chiến thuyền Nguyên"
const hash = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

// ---- số liệu (ĐỀ XUẤT BẢN THỬ trừ chỗ ghi nguồn) -------------------------------------------------------------------------
export const NAV = {
  step: 1.0,              // chênh cao lớn nhất khi tự bước sang boong khác / xuống đất (m)
  off: 0.35,              // lính ra ngoài mặt boong quá chừng này (bị đánh văng, không qua va chạm) thì rơi khỏi boong
  shore: [0.75, 1.5, 3, 6, 12, 20],               // bán kính dò chỗ lội được khi lỡ bước vào nước sâu (m)
  rescue: { after: 0.35, hp: 0.05, r: 45 },       // tướng ở nước sâu 0,35 s thì vớt: boong gần trong 45 m hoặc bờ; −5% Sinh lực
  climb: { T: BOARD.climb, arc: 0.6 },             // leo boong 0,8 s (battle-b20 BOARD.climb)
  hold: { capture: BOARD.capture, board: BOARD.hold, marker: 5, ferry: 0.4 },   // giữ Tương tác (s): chiếm 3, lên boong 1, mốc 5
  boardR: BOARD.range, captureCrew: 2, markerFoe: 6, ferryWater: 0.3, ferryR: 3, ferryPortalR: 2.5,
  // 8 m/s, 5–8 s; tối đa 10 người theo; gap: khe mạn đò — mạn thuyền / bè (chừa mái chèo 2,2 m, tướng nhảy qua khi leo)
  // chase: tới giờ mà nơi đến đã dời chỗ thì đò đuổi tới chỗ cập mới tối đa chừng ấy giây
  ferry: { speed: 8, T: BOARD.ferrySec, leave: 6, follow: 10, followR: 8, dry: 0.25, gap: 2.3, chase: 6 },
  swim: { speed: 1.6, y: -0.62, far: 40, maxT: 30 },                            // bơi vào bờ; khuất xa 40 m hoặc tới chỗ lội thì thôi
  plankW: 1.1, rampW: 1.5, rampSlope: 0.75, rampMin: 2.5,
};

// Thời gian, tốc độ đò chuyển theo chiều dài đường: 8 m/s, kẹp 5–8 s (xa thì chạy nhanh hơn 8 m/s). Thuần.
export function ferryTiming(len, F = NAV.ferry) {
  const T = clamp(len / F.speed, F.T[0], F.T[1]);
  return { T, speed: len / T };
}
// Đường đò: thẳng từ a tới b; đoạn thẳng cắt qua đất khô (dry(x, z) = true) thì uốn qua tâm dòng ở giữa. Thuần.
export function ferryPath(a, b, dry = () => false, zcf = zc) {
  let cut = false;
  for (let k = 1; k < 12 && !cut; k++) { const t = k / 12; if (dry(lerp(a.x, b.x, t), lerp(a.z, b.z, t))) cut = true; }
  if (!cut) return [{ x: a.x, z: a.z }, { x: b.x, z: b.z }];
  const mx = (a.x + b.x) / 2;
  return [{ x: a.x, z: a.z }, { x: mx, z: zcf(mx) }, { x: b.x, z: b.z }];
}
// Thứ tự ưu tiên Tương tác (hợp đồng gameplay B20): chiếm thuyền → lên boong → mở mốc → gọi đò. Thuần.
export const INTERACT_ORDER = ["capture", "board", "marker", "ferry"];
export const sortInteract = (list) => list.slice().sort((a, b) => INTERACT_ORDER.indexOf(a.kind) - INTERACT_ORDER.indexOf(b.kind));
// Chọn thuyền mắc cạn (hợp đồng B20: share 1 → mọi thuyền; 0,5 → một nửa xác định theo id, luôn gồm các id trong keep —
// kỳ hạm, thuyền Phàn Tiếp để pha 5–6 xảy ra). ids: id thuyền trong bãi cọc. Thuần, không phụ thuộc thứ tự vào.
export function strandSelect(ids, share, keep = []) {
  const all = [...new Set(ids)].sort();
  if (share >= 1) return all;
  const want = Math.max(Math.ceil(all.length * share), keep.filter((k) => all.includes(k)).length);
  const kept = all.filter((id) => keep.includes(id)), rest = all.filter((id) => !keep.includes(id)).sort((a, b) => hash(a) - hash(b) || (a < b ? -1 : 1));
  return [...kept, ...rest.slice(0, Math.max(0, want - kept.length))].sort();
}

const _L = { x: 0, z: 0, h: 0, i: -1, d: 0 }, _L2 = { x: 0, z: 0, h: 0, i: -1, d: 0 };
const _W = { x: 0, y: 0, z: 0 }, _W2 = { x: 0, y: 0, z: 0 }, _F = { h: 0 }, _C = { x0: 0, z0: 0, x1: 0, z1: 0, r: 0 }, _P = { x: 0, z: 0 };
// collideExtra trả [x, z] dùng lại (đợt 19c): ground.collide đọc r[0], r[1] ngay rồi bỏ — không cấp phát mỗi lính mỗi bước
const _XZ = [0, 0], xz = (x, z) => { _XZ[0] = x; _XZ[1] = z; return _XZ; };
const GROUND = null;         // nút "mặt đất" trong đồ thị cửa (route)

// ---- vật dựng phụ: ván bắc, ván dốc, xích (một InstancedMesh hộp đơn vị) ---------------------------------------------------
class Bits {
  constructor(scene, cap = 160) {
    const g = new THREE.BoxGeometry(1, 1, 1);
    this.mesh = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial({ flatShading: true }), cap);   // màu theo instance
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);
    this.mesh.count = 0; this.mesh.castShadow = true; this.mesh.receiveShadow = true; this.mesh.frustumCulled = false;
    this.mesh.name = "naval-bits"; this.cap = cap; this.n = 0; scene.add(this.mesh); this.scene = scene;
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(0, 0, 0, "YXZ");
    this._p = new THREE.Vector3(); this._s = new THREE.Vector3(); this._c = new THREE.Color();
  }
  begin() { this.n = 0; }
  // hộp từ điểm a tới điểm b (trục dài), rộng w, dày t, màu col
  span(ax, ay, az, bx, by, bz, w, t, col, roll = 0) {
    if (this.n >= this.cap) return;
    const dx = bx - ax, dy = by - ay, dz = bz - az, L = Math.hypot(dx, dy, dz) || 1e-3;
    this._e.set(-Math.atan2(dy, Math.hypot(dx, dz)), Math.atan2(dx, dz), roll, "YXZ"); this._q.setFromEuler(this._e);
    this._m.compose(this._p.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2), this._q, this._s.set(w, t, L));
    this._c.setHex(col); this.mesh.setMatrixAt(this.n, this._m); this.mesh.instanceColor.setXYZ(this.n, this._c.r, this._c.g, this._c.b); this.n++;
  }
  box(x, y, z, sx, sy, sz, yaw, col, pitch = 0, roll = 0) {
    if (this.n >= this.cap) return;
    this._e.set(pitch, yaw, roll, "YXZ"); this._q.setFromEuler(this._e);
    this._m.compose(this._p.set(x, y, z), this._q, this._s.set(sx, sy, sz));
    this._c.setHex(col); this.mesh.setMatrixAt(this.n, this._m); this.mesh.instanceColor.setXYZ(this.n, this._c.r, this._c.g, this._c.b); this.n++;
  }
  end() { this.mesh.count = this.n; this.mesh.visible = this.n > 0; this.mesh.instanceMatrix.needsUpdate = true; this.mesh.instanceColor.needsUpdate = true; }
  dispose() { this.scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.dispose(); this.mesh.dispose(); }
}
const WOOD = 0x8a6a44, WOOD_D = 0x5e4630, WOOD_L = 0xa8845a, IRON = 0x3a3836, ROPE = 0xa8966c;

// =========================================================================================================================
export class Naval {
  // Dựng lớp thủy chiến và gắn mặt đất trận B20: độ cao = world.groundY (đúng lưới đang vẽ), boong = world.decks, mặt nước =
  // world.tideY, bùn / va chạm qua naval (terrainB20). Gọi trong BattleDef.buildWorld (ctx đã có scene, chưa có lính, tướng).
  static install(ctx, world, opts = {}) {
    const nav = new Naval(ctx, world, opts);
    setBattleTerrain(terrainB20(world, nav));
    world.decks.active(0, 0); setDecks(world.decks);
    setWaterLevel(() => world.tideY);
    return nav;
  }

  constructor(ctx, world, { cap = 40, shadows = true } = {}) {
    this.ctx = ctx; this.world = world; ctx.naval = this;
    this.decks = world.decks;
    this.fleet = new FleetRenderer(ctx.scene, { shadows, cap });
    this.bits = new Bits(ctx.scene);
    this.boats = []; this.byId = new Map();
    this.riders = new Map();           // vật → boong đang đứng
    this.links = [];                   // ván bắc / xích giữa hai thuyền
    this.doors = []; this._adj = null; // cửa qua lại giữa boong / đất (route)
    this.climbs = []; this.ferries = []; this.rafts = [];
    this.t = 0; this.nFerry = 0; this.rescueT = 0; this._crewN = 0;
    this.inter = { key: null, t: 0, t0: 0 };
    this.on = {}; this.canMarker = null; this.canFerry = null;
    this._env = { tideY: world.tideY, t: 0, bedHeight: world.groundY, stakeActive: null };
    // cầu bến: boong tĩnh sẵn trong world.decks; cửa gốc bến ↔ đất
    for (const d of world.pierDecks || []) {
      const p = (MAP.piers || []).find((q) => q.id === d.pier);
      d.kind = "pier"; d.label = p?.name || "Bến"; d.len = Math.max(...d.rects.map((r) => r.z1));
      this._door(GROUND, d, () => d.toWorld(0, 1.2, _W2));
      this._door(d, GROUND, () => d.toWorld(0, -3.5, _W2));
    }
    // bè cỏ ở ba mốc: boong nổi theo bè của cảnh (scenery-b20 rafts.list — x, z, y, yaw, pitch, roll, fade)
    for (const r of world.scenery?.rafts?.list || []) {
      const w = RAFT.w / 2 - 0.3, dd = RAFT.d / 2 - 0.3;
      const D = new Deck({ rects: [{ x0: -w, x1: w, z0: -dd, z1: dd, y: RAFT.y }],
        portals: [{ lx: w, lz: 0, r: 1.6 }, { lx: -w, lz: 0, r: 1.6 }, { lx: 0, lz: dd, r: 1.6 }, { lx: 0, lz: -dd, r: 1.6 }] });
      D.kind = "raft"; D.raft = r.id; D.label = "Bè cỏ " + r.id;
      this.decks.add(D); this.rafts.push({ id: r.id, src: r, deck: D });
      this._poseRaft(this.rafts[this.rafts.length - 1]);
    }
  }

  // ---- thuyền -------------------------------------------------------------------------------------------------------
  addBoat(o = {}) {
    const b = new Boat({ autoGround: false, ...o });
    b.crew = []; b.officer = null; b.captured = false; b.ramp = null; b.label = o.label || b.hull.name;
    b.anchor = { x: b.x, z: b.z, r: Math.max(1.5, b.hull.len * 0.3) };
    const D = b.deck; D.kind = o.kind || (b.type === "flagship" ? "flagship" : b.hull.family === "tran" ? "light" : "ship"); D.label = b.label;
    this.boats.push(b); this.byId.set(b.id, b); this.decks.add(D);
    b.update(0, this._envNow());
    return b;
  }
  // Gỡ thuyền: boong tắt hẳn (deck.off — mọi kiểm tra "boong còn dùng được" bỏ qua nó: Tương tác, đò, leo, cửa route); người
  // đang đứng trên boong: lính rơi / bơi, tướng và đơn vị lớn phe ta sang boong phe ta gần nhất, tướng Nguyên giữa nước sâu rời trận
  // (_offDeck → _lostDeck). Đò đang chở tới boong này đổi nơi đến lúc cập (_updateFerries).
  removeBoat(b) {
    b.deck.off = true;
    for (const L of [...this.links]) if (L.a === b || L.b === b) this.release(L);
    this.evacuate(b);
    if (b.ramp) this._dropRamp(b);
    for (const [o, D] of [...this.riders]) if (D === b.deck) this._offDeck(o, D, true);
    this.decks.remove(b.deck);
    const i = this.boats.indexOf(b); if (i >= 0) this.boats.splice(i, 1);
    if (this.byId.get(b.id) === b) this.byId.delete(b.id);
    for (const f of this.ferries) if (f.boat === b) f.done = true;
  }
  // Rời thuyền b sắp chìm / rời trận: tướng sang boong phe ta gần nhất (safeLand), quân ta trên boong (thân binh, quân theo) sang
  // cùng boong quanh tướng (không thì boong phe ta gần thuyền). Lính Nguyên ở lại (director / removeBoat lo). Trả boong tướng sang.
  evacuate(b) {
    const hero = this.ctx.hero, crowd = this.ctx.crowd, D = b.deck;
    const onPlank = hero?.deck?.plank && this.links.some((L) => L.plank === hero.deck && (L.a === b || L.b === b));
    const T0 = hero && hero.alive && (hero.deck === D || onPlank) ? this.safeLand(hero, D) : null;
    const allies = [];
    for (const [o, E] of this.riders) if (E === D && o.K && o.side === "ta" && crowd?.hittable(o)) allies.push(o);
    if (allies.length) {
      const T = T0 || this.friendlyDeck(b.x, b.z, NAV.rescue.r * 2, D);
      if (T) {
        const spots = this.deckSpots(T, allies.length, makeRng(hash(b.id) + 101));
        allies.forEach((a, k) => { const q = spots[k]; T.toWorld(q.x, q.z, _W, q.i); this.leave(a); a.x = _W.x; a.z = _W.z; a.sx = a.x; a.sz = a.z; a._pins = null; this.board(a, T); });
      }
    }
    return T0;
  }
  boatById(id) { return this.byId.get(id) || null; }
  deckOf(o) { return o?.deck || null; }
  // thuyền có boong hoặc thân (viên nang) chứa (x, z)
  shipAt(x, z) {
    const d = this.decks.find(x, z, 0.3); if (d?.boat) return d.boat;
    for (const b of this.boats) { if (!b.visible) continue; b.hullCapsule(_C); if (segDist(x, z, _C) < _C.r) return b; }
    return null;
  }
  _envNow() { const e = this._env; e.tideY = this.world.tideY; e.t = this.t; return e; }

  // ---- mặt đất, nước ---------------------------------------------------------------------------------------------------
  deep(x, z) { return this.world.tideY - this.world.groundY(x, z) > WADE_MAX; }
  inDeepWater(x, z) { return this.deep(x, z) && !this.decks.find(x, z, 0); }
  surfaceY(x, z) {
    const d = this.decks.find(x, z, 0, null, _F); if (d) return _F.h;
    const g = this.world.groundY(x, z); return g > this.world.tideY ? g : this.world.tideY;
  }
  // mặt dưới chân vật không đứng trên boong nào: boong (mọi boong), đất, hoặc mặt nước nếu sâu quá lội
  baseY(x, z) {
    const d = this.decks.find(x, z, 0, null, _F); if (d) return _F.h;
    const g = this.world.groundY(x, z), w = this.world.tideY;
    return w - g > WADE_MAX ? w : g;
  }
  // bùn: đất dưới mức triều cao, lội được, không có boong (trên boong, dưới nước sâu: không bùn)
  mud(x, z) {
    const g = this.world.groundY(x, z);
    if (g > TIDE.high + 0.4 || this.world.tideY - g > WADE_MAX) return 0;
    if (this.decks.find(x, z, 0)) return 0;
    return mudB20(x, z);
  }
  // Chỗ lội được gần (x, z) nhất: dò 8 hướng theo các vòng NAV.shore; far: còn dò theo z về phía bờ gần tới 220 m (vớt).
  shore(x, z, far = false) {
    for (const R of NAV.shore) {
      let best = null, bd = Infinity;
      for (let k = 0; k < 8; k++) {
        const a = k * Math.PI / 4, px = x + Math.sin(a) * R, pz = z + Math.cos(a) * R;
        const dep = this.world.tideY - this.world.groundY(px, pz);
        if (dep <= WADE_MAX && dep < bd && !this._inHull(px, pz, 0.4)) { bd = dep; best = [px, pz]; }
      }
      if (best) return best;
    }
    if (!far) return null;
    const s = z < zc(x) ? -1 : 1;
    for (const sg of [s, -s]) for (let k = 1; k <= 110; k++) { const pz = z + sg * 2 * k; if (!this.deep(x, pz)) return [x, pz + sg * 2]; }
    return null;
  }
  _inHull(x, z, r) {
    for (const b of this.boats) {
      if (!b.visible || b.state === "sunk") continue;
      const R = b.hull.len / 2 + r + 1; if ((x - b.x) ** 2 + (z - b.z) ** 2 > R * R) continue;
      b.hullCapsule(_C); if (segDist(x, z, _C) < _C.r + r) return b;
    }
    return null;
  }

  // Va chạm B20 (ground.collide → T.collideExtra, o là vật đang đi — tướng, lính, đơn vị lớn; có thể thiếu):
  //  • trên boong: trong mặt đi được thì giữ trong lan can (Deck.clampInside); ra khỏi mặt boong (qua cửa, ván) thì sang boong
  //    khác / xuống đất nếu chênh ≤ NAV.step, không thì giữ lại (kể cả ở cửa: ngoài kia là nước sâu hay mạn cao)
  //  • dưới đất: bước lên boong chênh ≤ NAV.step (chân ván dốc, gốc cầu bến); đẩy khỏi thân thuyền (viên nang); nước sâu quá
  //    lội thì đẩy về chỗ lội được gần nhất (không có trong 20 m: để yên — tướng thì naval.update vớt)
  collideExtra(x, z, r, o) {
    const D = o ? o.deck : null;
    if (D) {
      _P.x = x; _P.z = z;
      if (D.contains(x, z, 0.02)) return D.clampInside(_P, r) ? xz(_P.x, _P.z) : null;
      const h0 = D.heightAt(x, z, 3);
      const E = this.decks.find(x, z, 0, D, _F);
      if (E && Math.abs(_F.h - h0) <= NAV.step && this._mayRide(o, E)) { this._ride(o, E); return null; }
      if (!E && !this.deep(x, z) && Math.abs(this.world.groundY(x, z) - h0) <= NAV.step) { this._unride(o); return null; }
      D.clampInside(_P, r, true); return xz(_P.x, _P.z);
    }
    if (o) {
      const E = this.decks.find(x, z, 0, null, _F);
      if (E && !E.plank && Math.abs(_F.h - this.baseYNoDeck(x, z)) <= NAV.step && this._mayRide(o, E)) { this._ride(o, E); return null; }
    }
    let moved = false;
    for (const b of this.boats) {
      if (!b.visible || b.state === "sunk") continue;
      const R = b.hull.len / 2 + r + 1; if ((x - b.x) ** 2 + (z - b.z) ** 2 > R * R) continue;
      b.hullCapsule(_C);
      const px = pushCapsule(x, z, r, _C); if (px) { x = px[0]; z = px[1]; moved = true; }
    }
    if (this.deep(x, z)) { const p = this.shore(x, z); if (p) return p; }
    return moved ? xz(x, z) : null;
  }
  // đò chuyển chỉ chở tướng và người theo (naval.ferry đặt lên); người khác không tự bước lên đò
  _mayRide(o, E) { return !E.boat?.isFerry || o === this.ctx.hero; }
  baseYNoDeck(x, z) { const g = this.world.groundY(x, z), w = this.world.tideY; return w - g > WADE_MAX ? w : g; }

  // ---- người trên boong ----------------------------------------------------------------------------------------------
  // Lên boong: nhớ toạ độ cục bộ (bước sau toạ độ thế giới tính lại từ đây — review P2-1: không trôi khỏi boong dù ít cập nhật).
  board(o, deck) {
    if (!deck) return this.leave(o);
    this._ride(o, deck);
    const L = deck.toLocal(o.x, o.z, _L); o.dlx = L.x; o.dlz = L.z; o.dli = L.i;
    if (typeof o.yaw === "number") o.dyaw = wrap(o.yaw - deck.yaw);
    return o;
  }
  leave(o) { this._unride(o); return o; }
  _ride(o, D) {
    if (o.deck === D && this.riders.get(o) === D) return;
    const hero = this.ctx.hero;
    if (o === hero && o.deck) o.deck.priority = 0;
    o.deck = D; this.riders.set(o, D);
    const L = D.toLocal(o.x, o.z, _L2); o.dlx = L.x; o.dlz = L.z; o.dli = L.i;
    if (typeof o.yaw === "number") o.dyaw = wrap(o.yaw - D.yaw);
    if (o === hero) D.priority = 1;
    // điểm neo theo boong (ghim lần lên boong đầu, theo boong chứa điểm đó — người sang boong khác điểm vẫn đi theo boong
    // cũ): chỗ đứng gốc của lính (sx, sz), nhà / trạm của đơn vị lớn (home, post)
    if (!o._pins) {
      const pins = [];
      const pin = (obj, kx, kz) => { if (obj && typeof obj[kx] === "number" && D.contains(obj[kx], obj[kz], 1.5)) { D.toLocal(obj[kx], obj[kz], _L2); pins.push([obj, kx, kz, _L2.x, _L2.z, D]); } };
      if (o.K) pin(o, "sx", "sz"); else if (o.isBig) { pin(o.home, "x", "z"); pin(o.post, "x", "z"); }
      o._pins = pins;
    }
  }
  _unride(o) {
    if (!o) return;
    if (o === this.ctx.hero && o.deck) o.deck.priority = 0;
    this.riders.delete(o); if (o.deck) o.deck = null;
  }
  _live(o) { return o.K ? o.role !== "free" && o.role !== "swim" : o.isBig ? o.alive : true; }
  // Vật đã ra ngoài mặt boong D mà không qua va chạm (lính bị đánh văng, xác trượt, boong tắt): tướng / đơn vị lớn kéo lại
  // (boong tắt thì để rơi — naval vớt tướng); lính rơi: sang boong kề, rơi xuống bùn (hất tung) hoặc rơi nước (bơi).
  // Trả true nếu vật không còn trên D.
  _offDeck(o, D, gone = false) {
    if (!o.K && !gone && !D.off) {
      _P.x = o.x; _P.z = o.z; D.clampInside(_P, 0.4, true); o.x = _P.x; o.z = _P.z; return false;
    }
    const h0 = (D.off || gone ? D.y + (D.rects[0]?.y || 0) : D.heightAt(o.x, o.z, 4)) + (o.K ? Math.max(0, o.y || 0) : 0);
    const E = this.decks.find(o.x, o.z, 0, D, _F);
    if (E && Math.abs(_F.h - h0) <= NAV.step + 0.6) { this._ride(o, E); return true; }
    this._unride(o);
    if (!o.K) { if (gone || D.off) this._lostDeck(o, D); return true; }
    const base = this.baseY(o.x, o.z);
    o.y = Math.max(0, h0 - base);
    if (o.state === "dead") return true;
    if (o.y > 0.05) { if (o.state !== "launch") { o.state = "launch"; o.vy = 0; o.st = 0.15; o.windup = 0; o.vx *= 0.5; o.vz *= 0.5; } return true; }
    if (this.deep(o.x, o.z)) this.toSwim(o);
    return true;
  }

  // Tướng / đơn vị lớn mất boong dưới chân (thuyền bị gỡ hay chìm, bè trôi mất — không phải người đó tự bước xuống nước): tướng
  // và đơn vị lớn phe ta sang boong phe ta gần nhất (tướng không mất máu như khi bị vớt); tướng, sĩ quan Nguyên đứng giữa nước sâu
  // thì rời trận (không đứng dưới lòng sông — review code P1-1). Lính do _offDeck lo (bơi vào bờ).
  _lostDeck(o, D = null) {
    if (o === this.ctx.hero) { if (o.alive) this.safeLand(o, D); return; }
    if (!o.isBig || !o.alive || o.dead > 0 || !this.deep(o.x, o.z)) return;
    if (o.side === "dich" && !o.captured) { o.dispose(); return; }
    this.safeLand(o, D);
  }
  // Boong "phe ta" gần (x, z) nhất trong r m: thuyền quân Trần (không phải đò, chưa mất / chìm), thuyền đã chiếm, cầu bến, bè cỏ còn
  // nổi. skip: boong bỏ qua. Không có: null.
  friendlyDeck(x, z, r = NAV.rescue.r, skip = null) {
    let best = null, bd = r;
    for (const d of this.decks.all) {
      if (d === skip || d.off || d.plank) continue;
      const b = d.boat;
      if (b && (b.isFerry || b.hidden || b.lost || b.state === "sunk" || !(b.side === "ta" || b.captured))) continue;
      const L = d.toLocal(x, z, _L); if (L.d < bd) { bd = L.d; best = d; }
    }
    return best;
  }
  // đặt vật lên boong D ở điểm trong mặt boong gần (x, z) nhất (lùi khỏi mép 0,8 m)
  _placeOnDeck(o, D) {
    const L = D.toLocal(o.x, o.z, _L), r = D.rects[L.i];
    const lx = r.x1 - r.x0 > 1.6 ? clamp(L.x, r.x0 + 0.8, r.x1 - 0.8) : (r.x0 + r.x1) / 2, lz = r.z1 - r.z0 > 1.6 ? clamp(L.z, r.z0 + 0.8, r.z1 - 0.8) : (r.z0 + r.z1) / 2;
    D.toWorld(lx, lz, _W, L.i); o.x = _W.x; o.z = _W.z; this.board(o, D);
  }
  // Đưa tướng (đơn vị lớn phe ta) sang chỗ an toàn: boong phe ta gần nhất (≤ 2 × tầm vớt), không có thì bờ / chỗ lội được gần nhất.
  // Trả boong đã lên (hoặc null). Tướng đang ngồi đò / leo thì thôi (đò tự lo).
  safeLand(o, skip = null) {
    const hero = this.ctx.hero;
    if (o === hero && (o.state === "climb" || o.state === "ride")) { for (const c of this.climbs) if (c.o === o) c.cancel = true; o.climbY = undefined; o.climbU = 0; }
    const D = this.friendlyDeck(o.x, o.z, NAV.rescue.r * 2, skip);
    if (D) this._placeOnDeck(o, D);
    else { this._unride(o); const p = this.shore(o.x, o.z, true); if (p) { o.x = p[0]; o.z = p[1]; } }
    if (o === hero && o.alive && o.state !== "dead") { if (o.state === "climb" || o.state === "ride") o.state = "free"; o.invuln = Math.max(o.invuln || 0, 0.6); }
    this.on.relanded?.(o, D);
    return D;
  }

  // ---- lính: đứng, chạm, bơi (crowd.js gọi khi có naval) ---------------------------------------------------------------------
  standY(a) {
    const D = a.deck;
    if (D) { const h = D.heightAt(a.x, a.z, 0.8); if (h === h) return h; }
    if (a.state === "swim") return this.world.tideY;
    if (a.y > 0 || a.state === "launch" || a.state === "dead") return this.baseY(a.x, a.z);
    return heightAt(a.x, a.z);
  }
  // Lính rơi chạm mặt dưới (a.y ≤ 0): chạm boong thì đứng trên boong đó, chạm nước sâu thì bơi. true: đã thành bơi.
  land(a) {
    const E = this.decks.find(a.x, a.z, 0.1, null, _F);
    if (E) { if (a.deck !== E) this._ride(a, E); return false; }
    if (this.deep(a.x, a.z)) { this.toSwim(a); return true; }
    return false;
  }
  // Rơi xuống nước: bỏ trận (tính như bị hạ nếu còn sống — KO của ai đánh gần nhất), bơi vào bờ.
  toSwim(a) {
    const crowd = this.ctx.crowd, h = this.ctx.hero;
    if (a.state !== "dead" && crowd) {
      const near = h && (a.x - h.x) ** 2 + (a.z - h.z) ** 2 < 100;
      crowd.kill(a, { by: a.side === "dich" ? (near ? "hero" : "ally") : "enemy", water: true, kx: 0, kz: 0 });
    }
    this._unride(a);
    Object.assign(a, { state: "swim", role: "swim", swimT: 0, y: NAV.swim.y, vx: 0, vz: 0, vy: 0, token: false, foe: null, target: null,
      windup: 0, stun: 0, fleeT: 0, chargeT: 0, evadeT: 0, spd: 0 });
    this.splash(a.x, a.z, 1);
  }
  swim(a, dt) {
    const S = NAV.swim, h = this.ctx.hero;
    a.swimT += dt; a.flash = 0;
    const side = a.z < zc(a.x) ? -1 : 1, dz = side;
    // tránh thân thuyền: bị viên nang chặn thì trượt dọc thân
    let nx = a.x + 0.25 * S.speed * dt * (a.id % 2 ? 1 : -1), nz = a.z + dz * S.speed * dt;
    const b = this._inHull(nx, nz, 0.3); if (b) { nx = a.x + Math.sin(b.yaw) * S.speed * dt; nz = a.z; }
    a.x = nx; a.z = nz;
    a.yaw += wrap(Math.atan2(0, dz) - a.yaw) * Math.min(1, dt * 3);
    a.y = S.y + 0.05 * Math.sin(a.swimT * 4 + a.id);
    const far = h && (a.x - h.x) ** 2 + (a.z - h.z) ** 2 > S.far * S.far;
    if (!this.deep(a.x, a.z) || a.swimT > S.maxT || (far && a.swimT > 3)) this.ctx.crowd.release(a);
  }
  // Tia nước (tên rơi xuống sông, người rơi nước): vòng sóng trên mặt nước + bụi nước trắng.
  splash(x, z, s = 1) {
    const fx = this.ctx.fx; if (!fx) return;
    const y = this.world.tideY;
    fx.sprite("ring", x, y + 0.3, z, { size: 1.2 + 1.4 * s, T: 0.8, grow: 2.2, flat: true, opacity: 0.9, color: 0xf4fbff, rot: Math.random() * 6.28 });
    fx.sprite("smoke", x, y + 0.2 + 0.4 * s, z, { size: 0.6 + 1.0 * s, T: 0.5, grow: 1.6, rise: 1.2 + s, opacity: 0.75, color: 0xf0f6f8, rot: Math.random() * 6.28 });
  }

  // ---- đường qua boong (ván bắc, ván dốc, cầu bến) ---------------------------------------------------------------------------
  _door(from, to, pt, link = null) { const d = { from, to, pt, link }; this.doors.push(d); this._adj = null; return d; }
  _undoors(link) { this.doors = this.doors.filter((d) => d.link !== link); this._adj = null; }
  // Điểm kế tiếp để o đi tới mục tiêu (vật target, hoặc điểm tx, tz) khi hai bên ở boong khác nhau: điểm qua cửa đầu tiên
  // (bên kia ngưỡng) theo BFS trên đồ thị cửa. Cùng boong / không có đường: null (đi thẳng, lan can giữ lại).
  route(o, target, tx, tz) {
    const from = o.deck || GROUND;
    let to = target && "deck" in target ? target.deck || GROUND : undefined;
    if (to === undefined) to = this.decks.find(tx, tz, 0) || GROUND;
    if (from === to) return null;
    const d = this._firstDoor(from, to); if (!d) return null;
    const p = d.pt(); return { x: p.x, z: p.z };
  }
  _firstDoor(from, to) {
    if (!this._adj) { this._adj = new Map(); for (const d of this.doors) { if (!this._adj.has(d.from)) this._adj.set(d.from, []); this._adj.get(d.from).push(d); } }
    const A = this._adj, seen = new Set([from]), q = [[from, null]];
    for (let k = 0; k < q.length && k < 64; k++) {
      const [n, first] = q[k];
      for (const d of A.get(n) || []) {
        if (seen.has(d.to) || d.to?.off) continue;
        const f = first || d;
        if (d.to === to) return f;
        seen.add(d.to); q.push([d.to, f]);
      }
    }
    return null;
  }

  // ---- ván bắc áp mạn, Liên Hoàn Thuyền ------------------------------------------------------------------------------------
  // b bám a (giữ vị trí tương đối lúc áp), ván bắc từ cửa mạn a sang cửa mạn b. chain: xích + cả hai thuyền không dập dềnh.
  grapple(a, b, { chain = false } = {}) {
    if (!a || !b || a === b) return null;
    if (!b.follow && !(a.follow && a.follow.boat === b)) {
      const c = Math.cos(a.yaw), s = Math.sin(a.yaw), dx = b.x - a.x, dz = b.z - a.z;
      b.follow = { boat: a, dx: dx * c - dz * s, dz: dx * s + dz * c, dyaw: wrap(b.yaw - a.yaw) };
    }
    const pa = sidePortal(a, b.x, b.z), pb = sidePortal(b, a.x, a.z);
    const P = new Deck({ rects: [{ x0: -NAV.plankW / 2, x1: NAV.plankW / 2, z0: -0.35, z1: 4, y: 0 }], portals: [{ lx: 0, lz: 0, r: 0.9 }, { lx: 0, lz: 4, r: 0.9 }] });
    P.kind = "plank"; P.plank = true; P.label = "Ván bắc";
    const L = { a, b, pa, pb, plank: P, chain, len: 4 };
    this.links.push(L); this.decks.add(P);
    this._poseLink(L);
    const A = a.deck, B = b.deck;
    this._door(A, P, () => P.toWorld(0, 1.0, _W2), L);
    this._door(P, B, () => B.toWorld(pb.lx * 0.55, pb.lz, _W2), L);
    this._door(B, P, () => P.toWorld(0, L.len - 1.0, _W2), L);
    this._door(P, A, () => A.toWorld(pa.lx * 0.55, pa.lz, _W2), L);
    if (chain) { a.calm = b.calm = true; }
    return L;
  }
  chain(boats) { const out = []; for (let i = 1; i < boats.length; i++) out.push(this.grapple(boats[0], boats[i], { chain: true })); return out; }
  release(L) {
    const i = this.links.indexOf(L); if (i < 0) return;
    this.links.splice(i, 1); this._undoors(L);
    // người đang đứng trên ván: sang boong gần hơn (không rơi xuống nước)
    for (const [o, D] of this.riders) if (D === L.plank) {
      const A = L.a.deck, B = L.b.deck, da = A.toLocal(o.x, o.z, _L).d, db = B.toLocal(o.x, o.z, _L2).d, T = da <= db ? A : B;
      _P.x = o.x; _P.z = o.z; this._ride(o, T); T.clampInside(_P, 0.4, true); o.x = _P.x; o.z = _P.z; this.board(o, T);
    }
    this.decks.remove(L.plank);
    if (L.b.follow?.boat === L.a) L.b.follow = null;
    if (L.chain) { L.a.calm = this.links.some((q) => q.chain && (q.a === L.a || q.b === L.a)); L.b.calm = false; }
  }
  _poseLink(L) {
    const A = L.a.deck, B = L.b.deck, P = L.plank;
    const a = A.toWorld(L.pa.lx * 0.92, L.pa.lz, _W, -1), ax = a.x, ay = a.y, az = a.z;
    const b = B.toWorld(L.pb.lx * 0.92, L.pb.lz, _W2, -1);
    const dx = b.x - ax, dz = b.z - az, len = Math.max(0.5, Math.hypot(dx, dz)), sz = (b.y - ay) / len;
    P.setPose(ax, ay, az, Math.atan2(dx, dz), 0, 0);
    P.setRect(P.rects[0], { z0: -0.35, z1: len + 0.35, y: -0.35 * sz, sz });
    P.portals[1].lz = len; L.len = len;
  }

  // ---- ván dốc xuống bùn của thuyền mắc cạn ----------------------------------------------------------------------------------
  // Bên mạn thấp (thuyền nghiêng), ở cửa mạn: mặt dốc từ mép boong ra tới bùn (dốc ≤ ~37°), cửa ở chân ván. ĐỀ XUẤT BẢN THỬ.
  addRamp(b) {
    if (b.ramp) return b.ramp;
    const D = b.deck, H = b.hull, ports = H.deck.portals.filter((p) => Math.abs(p.lx) > 0.3);
    if (!ports.length) return null;
    // cửa mạn thấp hơn (thế giới)
    let pp = ports[0], py = Infinity;
    for (const p of ports) { const w = D.toWorld(p.lx, p.lz, _W, -1); if (w.y < py) { py = w.y; pp = p; } }
    const sg = Math.sign(pp.lx), x0 = pp.lx, lz = pp.lz, deckH = D.toLocal(D.toWorld(x0 * 0.98, lz, _W, -1).x, _W.z, _L).h;
    const m = D.m;
    // chân ván: giải độ cao cục bộ h để điểm (xe, h, lz) nằm trên bùn (+0,06); chọn độ dài theo dốc
    const solveEnd = (xe) => {
      let h = deckH - 3;
      for (let k = 0; k < 4; k++) {
        const wx = m[9] + m[0] * xe + m[3] * h + m[6] * lz, wz = m[11] + m[2] * xe + m[5] * h + m[8] * lz;
        const Y = this.world.groundY(wx, wz) + 0.06;
        h = (Y - m[10] - m[1] * xe - m[7] * lz) / m[4];
      }
      return h;
    };
    // độ dài: dốc THẾ GIỚI (đã tính thân nghiêng) ≈ NAV.rampSlope
    const wy = (lx, h) => m[10] + m[1] * lx + m[4] * h + m[7] * lz, wxz = (lx, h) => Math.hypot(m[0] * lx + m[3] * h, m[2] * lx + m[5] * h);
    let len = NAV.rampMin, he = solveEnd(x0 + sg * len);
    for (let k = 0; k < 4; k++) {
      const drop = wy(x0, deckH) - wy(x0 + sg * len, he), run = Math.abs(wxz(x0 + sg * len, he) - wxz(x0, deckH)) || len;
      len = Math.max(NAV.rampMin, len * (drop / run) / NAV.rampSlope); he = solveEnd(x0 + sg * len);
    }
    const xe = x0 + sg * len, w = NAV.rampW / 2;
    const rect = sg > 0 ? { x0, x1: xe, z0: lz - w, z1: lz + w, y: deckH, sx: (he - deckH) / len }
      : { x0: xe, x1: x0, z0: lz - w, z1: lz + w, y: he, sx: (deckH - he) / len };
    const r = D.addRect(rect), foot = D.addPortal({ lx: xe - sg * 0.4, lz, r: 1.3 });
    const ramp = { rect: r, foot, sg, x0, xe, lz, deckH, he, len };
    ramp.doors = [
      this._door(GROUND, D, () => D.toWorld(xe - sg * 1.2, lz, _W2, D.rects.indexOf(r)), ramp),
      this._door(D, GROUND, () => { D.toWorld(xe + sg * 1.6, lz, _W2, D.rects.indexOf(r)); return _W2; }, ramp),
    ];
    // hình: ván chính + thanh ngang + hai cột đỡ + đồ vỡ ở chân (tính một lần: thuyền đã nằm yên)
    const top = D.toWorld(x0, lz, { x: 0, y: 0, z: 0 }, D.rects.indexOf(r)), bot = D.toWorld(xe, lz, { x: 0, y: 0, z: 0 }, D.rects.indexOf(r));
    ramp.vis = { top, bot, yaw: b.yaw, side: sg };
    b.ramp = ramp;
    return ramp;
  }
  _dropRamp(b) {
    const R = b.ramp; if (!R) return;
    b.deck.removeRect(R.rect); b.deck.removePortal(R.foot);
    this._undoors(R); b.ramp = null;
  }

  // ---- bè cỏ ------------------------------------------------------------------------------------------------------------
  _poseRaft(R) {
    const r = R.src, D = R.deck;
    D.off = !!(r.gone || r.fade < 0.35);
    if (!D.off) D.setPose(r.x, r.y ?? this.world.tideY, r.z, r.yaw || 0, r.pitch || 0, r.roll || 0);
  }

  // ---- thủy thủ -----------------------------------------------------------------------------------------------------------
  // Điểm đứng rải trên các mặt rộng của boong (cách nhau ≥ 0,9 m, lùi khỏi mép 0,45 m, tránh tường). Cục bộ {x, z, i}.
  deckSpots(D, n, rng) {
    const R = D.rects.map((r, i) => ({ r, i, a: Math.max(0, r.x1 - r.x0 - 0.9) * Math.max(0, r.z1 - r.z0 - 0.9) })).filter((q) => q.a > 0.5 && Math.abs(q.r.sx) + Math.abs(q.r.sz) < 0.05);
    const tot = R.reduce((s, q) => s + q.a, 0), out = [];
    for (let k = 0; k < 400 && out.length < n; k++) {
      let u = rng.next() * tot, q = R[0]; for (const c of R) { if (u < c.a) { q = c; break; } u -= c.a; }
      if (!q) break;
      const x = lerp(q.r.x0 + 0.45, q.r.x1 - 0.45, rng.next()), z = lerp(q.r.z0 + 0.45, q.r.z1 - 0.45, rng.next());
      if (D.walls.some((w) => x > w.x0 - 0.4 && x < w.x1 + 0.4 && z > w.z0 - 0.4 && z < w.z1 + 0.4)) continue;
      if (out.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < (k > 250 ? 0.49 : 0.81))) continue;
      out.push({ x, z, i: q.i });
    }
    while (out.length < n && R.length) { const q = R[0]; out.push({ x: (q.r.x0 + q.r.x1) / 2, z: (q.r.z0 + q.r.z1) / 2, i: q.i }); }
    return out;
  }
  // Thủy thủ trên thuyền: n lính (kitMix vòng tròn) + Đội trưởng (officer) — đứng giữ thuyền (role "garrison", neo tâm
  // thuyền) hoặc role khác (vd "zone" cho toán áp mạn). Trả mảng lính, .officer = đơn vị lớn (hoặc null).
  spawnCrew(boat, { side = boat.side, n = 6, kitMix = null, officer = false, tier = "thuong", role = "garrison", officerTier = "doitruong",
    name = "Đội trưởng", aggro = 14 } = {}) {
    const ctx = this.ctx, D = boat.deck, rng = makeRng(hash(boat.id) + 7919 * ++this._crewN);
    const unit = side === "dich" ? "KHIEN_NG" : "GIAO_DV";
    const kits = kitMix || (side === "dich" ? ["NG_DAO", "NG_GIAO", "NG_DAO", "NG_CUNG"] : ["DV_GIAO", "DV_DAO", "DV_GIAO", "DV_NO"]);
    const spots = this.deckSpots(D, n + (officer ? 1 : 0), rng), out = [];
    for (let i = 0; i < n; i++) {
      const s = spots[i]; D.toWorld(s.x, s.z, _W, s.i);
      const a = ctx.crowd.spawn({ side, unit, kit: kits[i % kits.length], tier, role, x: _W.x, z: _W.z, yaw: D.yaw + (rng.next() - 0.5) * 2,
        anchor: role === "garrison" ? boat.anchor : null });
      a.boat = boat; this.board(a, D); boat.crew.push(a); out.push(a);
    }
    out.officer = null;
    if (officer) {
      const s = spots[n] || spots[0]; D.toWorld(s.x, s.z, _W, s.i);
      const u = new BigUnit(ctx, { kind: "officer", side, tier: officerTier, name, id: boat.id + ":doitruong", x: _W.x, z: _W.z, yaw: D.yaw + Math.PI, aggro });
      ctx.units.push(u); this.board(u, D); u.boat = boat; boat.officer = u; out.officer = u;
    }
    return out;
  }
  crewAlive(boat, side = "dich") {
    const crowd = this.ctx.crowd; let n = 0;
    for (const [o, D] of this.riders) if (D === boat.deck && o.K && o.side === side && crowd.hittable(o)) n++;
    return n;
  }

  // ---- leo boong ------------------------------------------------------------------------------------------------------------
  // Leo (0,8 s) lên boong deck ở điểm local (mặc định: điểm trên boong gần o nhất, lùi vào trong 0,8 m). Đích theo boong đang
  // chạy. deck null + point {x, y, z}: leo xuống đất / bờ. onDone gọi khi xong.
  climbTo(o, deck, local = null, onDone = null, point = null) {
    if (deck && !this.deckOk(deck)) return null;                 // boong đã gỡ / tắt (thuyền rời trận, bè trôi mất)
    let lx, lz, li = -1;
    if (deck) {
      if (local) { lx = local.x; lz = local.z; }
      else {
        const L = deck.toLocal(o.x, o.z, _L), r = deck.rects[L.i];
        lx = clamp(L.x, r.x0 + 0.8, r.x1 - 0.8); lz = clamp(L.z, r.z0 + 0.8, r.z1 - 0.8); li = L.i;
        if (r.x1 - r.x0 < 1.6) lx = (r.x0 + r.x1) / 2; if (r.z1 - r.z0 < 1.6) lz = (r.z0 + r.z1) / 2;
      }
    }
    const y0 = o === this.ctx.hero ? o.y : o.isBig ? o.y : this.standY(o);
    const from = o.deck ? { deck: o.deck, ...(() => { const L = o.deck.toLocal(o.x, o.z, _L); return { lx: L.x, lz: L.z, li: L.i }; })() } : null;
    this._unride(o);
    for (const c of this.climbs) if (c.o === o) c.cancel = true;
    const c = { o, from, x0: o.x, y0, z0: o.z, deck, lx, lz, li, point, t: 0, T: NAV.climb.T, onDone };
    this.climbs.push(c);
    if (o === this.ctx.hero) { o.state = "climb"; o.climbU = 0; o.climbY = y0; }
    else if (o.isBig) o.climbY = y0;
    return c;
  }
  // boong còn dùng được: còn trong bộ boong, không tắt, thuyền chưa mất / chìm
  deckOk(D) { return !!D && !D.off && this.decks.all.includes(D) && !D.boat?.lost && D.boat?.state !== "sunk"; }
  _updateClimbs(dt) {
    const hero = this.ctx.hero;
    for (let i = this.climbs.length - 1; i >= 0; i--) {
      const c = this.climbs[i], o = c.o;
      if (c.cancel) { this.climbs.splice(i, 1); continue; }
      c.t += dt; const u = Math.min(1, c.t / c.T), e = smooth01(u);
      let sx = c.x0, sy = c.y0, sz = c.z0;
      if (c.from && !c.from.deck.off) { const w = c.from.deck.toWorld(c.from.lx, c.from.lz, _W, c.from.li); sx = w.x; sy = w.y; sz = w.z; }
      let ex, ey, ez;
      if (c.deck) { const w = c.deck.toWorld(c.lx, c.lz, _W2, c.li); ex = w.x; ey = w.y; ez = w.z; }
      else { ex = c.point.x; ez = c.point.z; ey = c.point.y ?? this.baseYNoDeck(ex, ez); }
      o.x = lerp(sx, ex, e); o.z = lerp(sz, ez, e);
      const y = lerp(sy, ey, smooth01(u * 1.25)) + NAV.climb.arc * Math.sin(Math.PI * u) * (ey >= sy ? 1 : 0.5);
      if (Math.hypot(ex - sx, ez - sz) > 0.2) o.yaw = Math.atan2(ex - sx, ez - sz);
      if (o === hero) { o.climbY = y; o.climbU = u; if (o.state !== "climb" && o.alive) o.state = "climb"; }
      else if (o.isBig) o.climbY = y;
      if (u >= 1) {
        this.climbs.splice(i, 1);
        o.climbY = undefined;
        if (o === hero) { o.state = "free"; o.climbU = 0; }
        if (c.deck && this.deckOk(c.deck)) this.board(o, c.deck);
        else if (c.deck && (o === hero || o.isBig)) this.safeLand(o, c.deck);     // boong đích mất giữa lúc leo
        else this._unride(o);
        c.done = true; c.onDone?.(c);
      }
    }
  }

  // ---- đò chuyển ------------------------------------------------------------------------------------------------------------
  // Nơi đến: thuyền phe ta (thuyền nhẹ, thuyền chỉ huy nhẹ, thuyền đã chiếm), bè cỏ còn nổi, cầu bến, thuyền Nguyên đã mắc
  // cạn (lên boong đánh ở pha 5–6). Bỏ boong đang đứng; gần trước; tối đa 4. phase: để director lọc (lớp này không dùng).
  ferryDestinations(hero, phase = null) {
    const out = [], cur = hero.deck;
    const push = (id, label, kind, D, sub = "") => {
      if (D === cur || D.off) return;
      const x = D.m[9], z = D.m[11], d = Math.hypot(x - hero.x, z - hero.z); if (d < 6) return;
      out.push({ id, label, kind, x, z, d, sub: sub ? `${sub} · ${Math.round(d)} m` : `${Math.round(d)} m` });
    };
    for (const b of this.boats) {
      if (b.isFerry || !b.visible || b.state === "sunk") continue;
      if (b.side === "ta") push(b.id, b.captured ? `${b.hull.name} (đã chiếm)` : b.label, b.captured ? "captured" : "ship", b.deck);
      else if (b.state === "stranded" || b.ferryOk) push(b.id, b.label, b.type === "flagship" ? "flagship" : "ship", b.deck, "mắc cạn");
    }
    for (const R of this.rafts) push("raft:" + R.id, R.deck.label, "raft", R.deck);
    for (const d of this.world.pierDecks || []) push("pier:" + d.pier, d.label, "pier", d);
    out.sort((a, b) => a.d - b.d);
    return out.slice(0, 4);
  }
  destById(id) {
    if (typeof id !== "string") return id;
    if (id.startsWith("raft:")) { const R = this.rafts.find((q) => "raft:" + q.id === id); return R ? { id, kind: "raft", deck: R.deck } : null; }
    if (id.startsWith("pier:")) { const d = (this.world.pierDecks || []).find((q) => "pier:" + q.pier === id); return d ? { id, kind: "pier", deck: d } : null; }
    const b = this.byId.get(id); return b ? { id, kind: "ship", deck: b.deck, boat: b } : null;
  }
  // chỗ đò đỗ khi đón tướng: sát mạn thuyền đang đứng (bên phía nơi đến), hoặc chỗ nước gần nhất (≥ 0,3 m) quanh bến / bờ
  _launchPoint(hero, toward) {
    const D = hero.deck, lb = HULLS.light.beam / 2;
    if (D && D.boat) {
      // mạn phía nơi đến; bên đó vướng thân thuyền khác (thuyền áp mạn) thì sang mạn kia
      const B = D.boat, c = Math.cos(B.yaw), s = Math.sin(B.yaw), dx = toward.x - B.x, dz = toward.z - B.z;
      const pref = (dx * c - dz * s) >= 0 ? 1 : -1, fx = Math.sin(B.yaw), fz = Math.cos(B.yaw);
      for (const side of [pref, -pref]) {
        const off = side * (B.hull.beam / 2 + lb + NAV.ferry.gap), x = B.x + off * c, z = B.z - off * s;
        let clear = true;
        for (const k of [-5, 0, 5]) { const h = this._inHull(x + fx * k, z + fz * k, lb); if (h && h !== B) clear = false; }
        if (clear || side === -pref) return { x, z, yaw: B.yaw };
      }
    }
    if (D && D.kind === "raft") {
      const c = Math.cos(D.yaw), s = Math.sin(D.yaw), off = RAFT.w / 2 + lb + NAV.ferry.gap;
      return { x: D.m[9] + off * c, z: D.m[11] - off * s, yaw: D.yaw };
    }
    if (D && D.kind === "pier") { const w = D.toWorld(0, D.len + lb + 1.2, { x: 0, y: 0, z: 0 }); return { x: w.x, z: w.z, yaw: D.yaw + Math.PI / 2 }; }
    let best = null, bd = Infinity;
    for (const R of [2, 4, 6, 9, 13, 18]) for (let k = 0; k < 12; k++) {
      const a = k * Math.PI / 6, x = hero.x + Math.sin(a) * R, z = hero.z + Math.cos(a) * R;
      if (this.world.tideY - this.world.groundY(x, z) < NAV.ferryWater + 0.1 || this.decks.find(x, z, 1.5)) continue;
      const d = R + 0.02 * k; if (d < bd) { bd = d; best = { x, z, yaw: Math.atan2(toward.x - x, toward.z - z) }; }
    }
    return best || { x: hero.x, z: hero.z, yaw: 0 };
  }
  // chỗ đò cập ở nơi đến + chỗ tướng leo lên (cục bộ trên boong đích)
  _landPoint(d, from) {
    const D = d.deck, lb = HULLS.light.beam / 2, c = Math.cos(D.yaw), s = Math.sin(D.yaw);
    const dx = from.x - D.m[9], dz = from.z - D.m[11], side = (dx * c - dz * s) >= 0 ? 1 : -1;
    if (D.boat) {
      const H = D.boat.hull, p = H.deck.portals.find((q) => Math.sign(q.lx) === side && Math.abs(q.lx) > 0.3) || { lx: side * H.beam / 2 * 0.8, lz: 0 };
      const off = side * (H.beam / 2 + lb + NAV.ferry.gap);
      return { x: D.m[9] + off * c + p.lz * s, z: D.m[11] - off * s + p.lz * c, yaw: D.yaw, local: { x: p.lx - side * 0.9, z: p.lz } };
    }
    if (D.kind === "raft") {
      const off = side * (RAFT.w / 2 + lb + NAV.ferry.gap);
      return { x: D.m[9] + off * c, z: D.m[11] - off * s, yaw: D.yaw, local: { x: side * (RAFT.w / 2 - 1.3), z: 0 } };
    }
    const w = D.toWorld(0, D.len + lb + 1.2, { x: 0, y: 0, z: 0 });
    return { x: w.x, z: w.z, yaw: D.yaw + Math.PI / 2, local: { x: 0, z: D.len - 1.2 } };
  }
  // Gọi đò: đò (thuyền nhẹ quân Trần) cập bên tướng, tướng leo sang (0,8 s), cùng tối đa 10 thân binh / quân theo ngồi đò;
  // đò chạy 5–8 s theo đường sinh ra; tới nơi tướng leo lên boong đích ở cửa mạn gần. Trong lúc đi: tướng "ride" (không đánh,
  // tên vẫn trúng), camera theo tướng. Trả handle (đang có một chuyến thì null).
  ferry(hero, dest, { followers = null, onDone = null } = {}) {
    const d = this.destById(dest?.id ?? dest);
    if (!d || !this.deckOk(d.deck) || d.deck === hero.deck || this.ferries.some((f) => !f.done) || !hero.alive || hero.state === "climb") return null;
    const toward = { x: d.deck.m[9], z: d.deck.m[11] };
    const st = this._launchPoint(hero, toward), en = this._landPoint(d, st);
    const dry = (x, z) => this.world.groundY(x, z) > this.world.tideY - NAV.ferry.dry && !this.decks.find(x, z, 0);
    // vào / ra song song mạn: đoạn đầu dọc hướng đò lúc đón, đoạn cuối dọc hướng lúc cập (không đâm mũi vào mạn, vào bè)
    const dir = (q, sgn) => { const fx = Math.sin(q.yaw), fz = Math.cos(q.yaw), k = (en.x - st.x) * fx + (en.z - st.z) * fz >= 0 ? 1 : -1; return { x: fx * k * sgn, z: fz * k * sgn }; };
    const d0 = dir(st, 1), d1 = dir(en, 1), A = { x: st.x + d0.x * 7, z: st.z + d0.z * 7 }, Bp = { x: en.x - d1.x * 9, z: en.z - d1.z * 9 };
    const path = Math.hypot(en.x - st.x, en.z - st.z) > 24 ? [{ x: st.x, z: st.z }, ...ferryPath(A, Bp, dry), { x: en.x, z: en.z }] : ferryPath(st, en, dry);
    const b = this.addBoat({ type: "light", side: "ta", id: "do" + ++this.nFerry, flag: "陳", path, speed: 0, label: "Đò chuyển" });
    b.isFerry = true; b.yaw = st.yaw; b.update(0, this._envNow());
    const { T } = ferryTiming(b.track.len);
    const h = { boat: b, dest: d, phase: "board", t: 0, T, len: b.track.len, done: false, followers: [], onDone,
      cancel: () => { h.done = true; h.phase = "away"; b.drive = null; } };
    b.drive = () => h.phase === "ride" ? b.track.len * smooth01(h.t / h.T) : h.phase === "board" ? 0 : b.track.len;
    // người theo: thân binh / quân theo tướng quanh 8 m, ngồi đò (đứng yên suốt chuyến)
    const crowd = this.ctx.crowd, fl = followers || (crowd ? crowd.agents.filter((a) => a.side === "ta" && (a.role === "guard" || a.role === "follow")
      && crowd.hittable(a) && (a.x - hero.x) ** 2 + (a.z - hero.z) ** 2 < NAV.ferry.followR ** 2) : []);
    const seats = this.deckSpots(b.deck, Math.min(NAV.ferry.follow, fl.length) + 1, makeRng(this.nFerry * 31 + 5));
    fl.slice(0, NAV.ferry.follow).forEach((a, i) => {
      const s = seats[i + 1] || seats[0]; b.deck.toWorld(s.x, s.z, _W, s.i);
      a.x = _W.x; a.z = _W.z; a.yaw = b.yaw; a.stun = h.T + 3; this.board(a, b.deck); h.followers.push(a);
    });
    this.climbTo(hero, b.deck, { x: 0, z: 1.6 }, () => { if (!h.done) { h.phase = "ride"; h.t = 0; if (hero.alive && hero.state === "free") hero.state = "ride"; } });
    h.landing = en;
    this.ferries.push(h);
    return h;
  }
  _updateFerries(dt) {
    const hero = this.ctx.hero;
    for (let i = this.ferries.length - 1; i >= 0; i--) {
      const h = this.ferries[i], b = h.boat;
      if (h.phase === "ride") {
        h.t += dt;
        if (hero.state === "free" && hero.deck === b.deck && hero.alive) hero.state = "ride";
        if (h.t >= h.T && (hero.state === "ride" || hero.state === "free") && hero.alive) {
          // nơi đến đã mất (thuyền rời trận, chìm, thuyền nhẹ bị mất, bè trôi): đổi sang boong phe ta gần nhất
          if (!this.deckOk(h.dest.deck)) {
            const D2 = this.friendlyDeck(b.x, b.z, 400, b.deck);
            if (!D2) { if (hero.state === "ride") hero.state = "free"; h.phase = "away"; h.done = true; this.safeLand(hero, b.deck); continue; }
            h.dest = { id: D2.boat?.id ?? "deck", kind: D2.boat ? "ship" : D2.kind, deck: D2, boat: D2.boat || null };
            this.on.ferryRetarget?.(h);
          }
          // nơi đến đã dời chỗ trong lúc chạy (hộ vệ đang chạy, thuyền nhẹ lui): đò đuổi tới chỗ cập mới rồi mới leo (không nhảy xa)
          h.phase = "chase"; h.ct = 0; b.drive = null; b.track = null;
        }
      }
      if (h.phase === "chase") {
        h.ct += dt;
        const en = this._landPoint(h.dest, b), dx = en.x - b.x, dz = en.z - b.z, d = Math.hypot(dx, dz);
        const sp = clamp(d * 1.6, 4, 12), step = sp * dt;
        if (d > Math.max(0.6, step) && h.ct < NAV.ferry.chase && this.deckOk(h.dest.deck)) {
          b.x += dx / d * step; b.z += dz / d * step; b.speed = sp;
          b.yaw = wrap(b.yaw + wrap((d > 6 ? Math.atan2(dx, dz) : en.yaw) - b.yaw) * Math.min(1, dt * 3));
          continue;
        }
        if (d <= Math.max(0.6, step)) { b.x = en.x; b.z = en.z; b.yaw = en.yaw; }
        b.speed = 0;
        if (hero.state === "ride") hero.state = "free";
        const D = h.dest.deck, loc = en.local;
        h.phase = "land";
        const ok = this.deckOk(D) && hero.alive ? this.climbTo(hero, D, loc, () => { h.phase = "away"; h.done = true; h.onDone?.(h); }) : null;
        if (!ok) { h.phase = "away"; h.done = true; if (hero.alive && hero.deck === b.deck) this.safeLand(hero, b.deck); }
        // người theo: sang boong đích quanh chỗ tướng lên
        const OK = this.deckOk(D), seats = OK ? this.deckSpots(D, h.followers.length, makeRng(this.nFerry * 17 + 3)) : [];
        h.followers.forEach((a, k) => {
          if (!this.ctx.crowd.hittable(a)) return;
          if (OK && seats[k]) { const s = seats[k]; D.toWorld(s.x, s.z, _W, s.i); a.x = _W.x; a.z = _W.z; this.board(a, D); }
          a.stun = 0;
        });
      } else if (h.phase === "away") {
        if (!h.awayT) {
          h.awayT = 0.001; b.drive = null;
          const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw);
          b.setPath([{ x: b.x, z: b.z }, { x: b.x + fx * 30, z: b.z + fz * 30 }]); b.speed = 0; b.go(4);
        }
        h.awayT += dt;
        for (const [o, D] of this.riders) if (D === b.deck && o !== hero) { if (o.K) this._offDeck(o, D, true); else this._unride(o); }
        if (h.awayT > NAV.ferry.leave) { this.removeBoat(b); this.ferries.splice(i, 1); }
      }
    }
  }

  // ---- Tương tác (X / D-pad xuống, giữ) ---------------------------------------------------------------------------------------
  interactables(hero) {
    const out = [], D = hero.deck, ctx = this.ctx, H = NAV.hold;
    if (!hero.alive || hero.state === "climb" || hero.state === "ride") return out;
    // 1. chiếm thuyền: đứng trên boong thuyền địch, trấn thủ đã ngã, còn ≤ 2 lính địch trên boong
    const B = D?.boat;
    if (B && B.side === "dich" && !B.captured && B.capturable !== false) {
      const off = B.officer, down = !off || !off.alive || off.dead > 0 || off.captured;
      if (down && this.crewAlive(B, "dich") <= NAV.captureCrew) out.push({ kind: "capture", id: B.id, deck: D, hold: H.capture, label: `Chiếm ${lc1(B.hull.name)}` });
    }
    // 2. lên boong khác trong 4 m (mép boong / cửa), không phải boong đang đứng hay ván bắc
    let bestD = null, bd = NAV.boardR;
    for (const d of this.decks.all) {
      if (d === D || d.off || d.plank || d.noBoard || d.boat?.isFerry || (D && this._linked(D, d))) continue;
      const dx = hero.x - d.m[9], dz = hero.z - d.m[11], R = d._R + NAV.boardR; if (dx * dx + dz * dz > R * R) continue;
      const L = d.toLocal(hero.x, hero.z, _L); if (L.d < bd && L.d > 0.05) { bd = L.d; bestD = d; }
    }
    if (bestD) out.push({ kind: "board", id: bestD.boat?.id ?? (bestD.raft ? "raft:" + bestD.raft : bestD.pier ? "pier:" + bestD.pier : "deck"), deck: bestD, hold: H.board, label: `Lên ${bestD.label ? lc1(bestD.label) : "boong"}` });
    // 3. mở mốc cọc: trên bè cỏ, mốc còn ẩn, director cho phép (pha 3), không địch trong 6 m
    if (D && D.raft && this.markerOk(D.raft, hero)) out.push({ kind: "marker", id: D.raft, deck: D, hold: H.marker, label: `Mở bãi cọc ${D.raft}` });
    // 4. gọi đò: trên thuyền ta / bến / bè / thuyền đã chiếm, hoặc có nước ≥ 0,3 m trong 3 m (điểm dò rơi trên boong thì không tính —
    // đáy sông dưới thân thuyền không phải chỗ đò cập). Trên boong thuyền Nguyên chưa chiếm: chỉ khi đứng sát cửa mạn (≤ portalR m) —
    // không thì nhắc "Gọi đò" hiện suốt trận đánh trên thuyền địch (review B20).
    let ferryOk = !!D && (D.kind === "light" || D.kind === "pier" || D.kind === "raft" || D.boat?.side === "ta");
    const enemyDeck = !!D?.boat && D.boat.side === "dich" && !D.boat.captured;
    if (!ferryOk && enemyDeck) {
      const L = D.toLocal(hero.x, hero.z, _L), lx = L.x, lz = L.z;
      ferryOk = D.portals.some((q) => Math.abs(q.lx) > 0.3 && (q.lx - lx) ** 2 + (q.lz - lz) ** 2 < NAV.ferryPortalR ** 2);
    } else if (!ferryOk) {
      const w = this.world;
      for (let k = 0; k < 9 && !ferryOk; k++) {
        const a = k * Math.PI / 4, R = k === 8 ? 0 : NAV.ferryR, x = hero.x + Math.sin(a) * R, z = hero.z + Math.cos(a) * R;
        if (w.tideY - w.groundY(x, z) >= NAV.ferryWater && !this.decks.find(x, z, 0)) ferryOk = true;
      }
    }
    if (ferryOk && (!this.canFerry || this.canFerry()) && !this.ferries.some((f) => !f.done)) out.push({ kind: "ferry", id: "ferry", deck: D, hold: H.ferry, label: "Gọi đò chuyển" });
    return out;
  }
  // hai boong nối nhau bằng ván bắc (đi bộ qua được, khỏi nhắc "lên boong")
  _linked(A, B) { for (const L of this.links) { const a = L.a.deck, b = L.b.deck, p = L.plank; if ((A === a || A === b || A === p) && (B === a || B === b || B === p)) return true; } return false; }
  markerOk(id, hero) {
    const st = this.world.scenery?.stakes?.state?.[id];
    if (st && st !== "hidden") return false;
    if (this.canMarker && !this.canMarker(id)) return false;
    const crowd = this.ctx.crowd, R2 = NAV.markerFoe ** 2;
    if (crowd) for (const a of crowd.agents) if (a.side === "dich" && crowd.hittable(a) && (a.x - hero.x) ** 2 + (a.z - hero.z) ** 2 < R2) return false;
    for (const u of this.ctx.units || []) if (u.side === "dich" && u.alive && !u.dead && !u.captured && (u.x - hero.x) ** 2 + (u.z - hero.z) ** 2 < R2) return false;
    return true;
  }
  // Bộ giữ phím: item đầu danh sách; đổi item thì đếm lại; thả phím hoặc trúng đòn nặng / viền đỏ (hero.lastHardHit) thì về 0.
  interactStep(hero, held, dt) {
    const it = this.interactables(hero)[0] || null, I = this.inter, now = this.ctx.clock ?? this.t;
    if (!it) { I.key = null; I.t = 0; return { item: null, p: 0 }; }
    const key = it.kind + ":" + it.id;
    if (key !== I.key) { I.key = key; I.t = 0; I.t0 = now; }
    if (!held || (hero.lastHardHit ?? -9) > I.t0) { I.t = 0; I.t0 = now; return { item: it, p: 0 }; }
    I.t += dt;
    if (I.t >= it.hold) { I.t = 0; I.key = null; this.doInteract(it, hero); return { item: it, p: 1, done: true }; }
    return { item: it, p: I.t / it.hold };
  }
  doInteract(it, hero) {
    const on = this.on;
    if (it.kind === "capture") { const b = this.byId.get(it.id); if (on.capture) on.capture(b, hero); else this.captureShip(b); }
    else if (it.kind === "board") this.climbTo(hero, it.deck);
    else if (it.kind === "marker") { if (on.marker) on.marker(it.id, hero); else { this.world.scenery?.stakes?.setState(it.id, "active"); this.openFerryPicker(hero); } }
    else if (it.kind === "ferry") { if (on.ferry) on.ferry(hero); else this.openFerryPicker(hero); }
  }
  openFerryPicker(hero) {
    const items = this.ferryDestinations(hero); if (!items.length || !this.ctx.hud?.picker) return false;
    this.ctx.hud.picker(items, (it) => this.ferry(hero, it.id), "Đò chuyển · chọn nơi đến");
    return true;
  }
  // Chiếm thuyền: cờ chữ 陳, dừng hẳn, về phe ta (nơi đến đò chuyển); lính Nguyên còn trên boong nhảy xuống nước bơi vào bờ.
  captureShip(b) {
    if (!b || b.captured) return;
    b.captured = true; b.side = "ta"; b.flag = "陳"; b.stop(); b.targetSpeed = 0; b.label = b.hull.name + " (đã chiếm)"; b.deck.label = b.label;
    for (const [o, D] of [...this.riders]) if (D === b.deck && o.K && o.side === "dich" && this.ctx.crowd.hittable(o)) this.toSwim(o);
    this.ctx.fx?.banner?.("CHIẾM THUYỀN", "#f1d98a");
    this.on.shipCaptured?.(b);
  }

  // ---- vòng bước --------------------------------------------------------------------------------------------------------
  update(dt) {
    const ctx = this.ctx, hero = ctx.hero, w = this.world;
    this.t += dt;
    // 1. người trên boong: thế giới → cục bộ (lấy bước đi của bước trước); ai đã ra ngoài mặt boong thì xử lý rơi
    for (const [o, D] of this.riders) {
      if (o.deck !== D || !this._live(o)) { this.riders.delete(o); if (o.deck === D) o.deck = null; continue; }
      if (D.off) { this._offDeck(o, D, true); continue; }
      const L = D.toLocal(o.x, o.z, _L);
      if (L.d > NAV.off) { if (this._offDeck(o, D)) continue; D.toLocal(o.x, o.z, _L); }
      o.dlx = _L.x; o.dlz = _L.z; o.dli = _L.i;
      if (typeof o.yaw === "number") o.dyaw = wrap(o.yaw - D.yaw);
    }
    // 2. thuyền (thuyền đầu trước, thuyền bám sau), bè, ván bắc
    const env = this._envNow();
    for (const b of this.boats) if (!b.follow) b.update(dt, env);
    for (const b of this.boats) if (b.follow) b.update(dt, env);
    for (const b of this.boats) { b.anchor.x = b.x; b.anchor.z = b.z; }
    for (const R of this.rafts) this._poseRaft(R);
    for (const L of this.links) this._poseLink(L);
    for (const b of this.boats) if (b.state === "stranded" && !b.ramp && b.rampOk !== false && b.hull.deckY >= 1.5) this.addRamp(b);
    // 3. cục bộ → thế giới
    for (const [o, D] of this.riders) {
      D.toWorld(o.dlx, o.dlz, _W, o.dli); o.x = _W.x; o.z = _W.z;
      if (o.dyaw !== undefined && typeof o.yaw === "number") o.yaw = wrap(D.yaw + o.dyaw);
      if (o._pins) for (const p of o._pins) if (!p[5].off) { p[5].toWorld(p[3], p[4], _W); p[0][p[1]] = _W.x; p[0][p[2]] = _W.z; }
    }
    // 4. leo, đò
    this._updateClimbs(dt);
    this._updateFerries(dt);
    // 5. boong đang xét quanh tướng (ground.heightAt), vớt tướng
    if (hero) { this.decks.active(hero.x, hero.z, 80); this._rescue(dt); }
  }
  _rescue(dt) {
    const h = this.ctx.hero;
    if (!h.alive || h.deck || h.state === "climb" || h.state === "ride" || !this.deep(h.x, h.z) || this.decks.find(h.x, h.z, 0)) { this.rescueT = 0; return; }
    this.rescueT += dt; if (this.rescueT < NAV.rescue.after) return;
    this.rescueT = 0;
    this.splash(h.x, h.z, 1.4);
    // vớt lên đâu: boong phe ta trong 45 m (thuyền ta, thuyền đã chiếm, bến, bè), rồi bờ / chỗ lội được, cuối cùng boong bất kỳ
    // (trước đây boong gần nhất bất kể phe — tướng bị vớt lên giữa hạm đội Nguyên)
    let best = this.friendlyDeck(h.x, h.z, NAV.rescue.r), p = null;
    if (!best) p = this.shore(h.x, h.z, true);
    if (!best && !p) {
      let bd = NAV.rescue.r * 2;
      for (const d of this.decks.all) {
        if (d.off || d.plank || d.boat?.isFerry || d.boat?.state === "sunk") continue;
        const L = d.toLocal(h.x, h.z, _L); if (L.d < bd) { bd = L.d; best = d; }
      }
    }
    if (best) this._placeOnDeck(h, best);
    else if (p) { h.x = p[0]; h.z = p[1]; }
    h.hp = Math.max(1, h.hp - h.maxHp * NAV.rescue.hp); h.invuln = Math.max(h.invuln, 1.2);
    if (h.state !== "dead") h.state = "free";
    this.ctx.fx?.text?.(h.x, h.z, "Được vớt lên · −5% Sinh lực", "#e6dcc3");
    this.on.rescue?.(h);
  }

  // ---- vẽ ----------------------------------------------------------------------------------------------------------------
  // Nội suy khi vẽ (đợt 19c, battle/view.js): capture đầu mỗi bước chụp tư thế thuyền (b.iv), render vẽ thuyền ở tư thế b.rv giữa đó và hiện
  // tại theo α (thuyền mới, dời quá SNAP_D m: tư thế thật); cờ sóng theo giờ vẽ. b.iv, b.rv chỉ để vẽ.
  capture(tick) {
    for (const b of this.boats) { const v = b.iv || (b.iv = new Float64Array(6)); v[0] = b.x; v[1] = b.y; v[2] = b.z; v[3] = b.yaw; v[4] = b.pitch; v[5] = b.roll; b.itk = tick; }
  }
  // see: điểm máy quay đang nhìn cần thấy (ngực tướng; cảnh bắt sống: người bị bắt) — thân thuyền, buồm, lầu chắn giữa thì mờ chấm
  // (FleetRenderer._seeThrough); null: tắt (cảnh kết nhìn cả khúc sông).
  render(camera, see = null) {
    const V = this.ctx.view, al = V ? V.alpha : 1;
    for (const b of this.boats) {
      const r = b.rv || (b.rv = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 }), v = b.iv;
      if (al < 1 && v && b.itk === V.tick && (b.x - v[0]) ** 2 + (b.z - v[2]) ** 2 <= SNAP_D * SNAP_D) {
        r.x = v[0] + (b.x - v[0]) * al; r.y = v[1] + (b.y - v[1]) * al; r.z = v[2] + (b.z - v[2]) * al;
        r.yaw = lerpYaw(v[3], b.yaw, al); r.pitch = v[4] + (b.pitch - v[4]) * al; r.roll = v[5] + (b.roll - v[5]) * al;
      } else { r.x = b.x; r.y = b.y; r.z = b.z; r.yaw = b.yaw; r.pitch = b.pitch; r.roll = b.roll; }
    }
    if (see) this.fleet.setSee(camera.position, see.x, see.y, see.z); else this.fleet.setSee(camera.position, 0, -1e4, 0);
    this.fleet.sync(this.boats, camera, this.t - (V ? V.lag : 0));
    const B = this.bits; B.begin();
    for (const L of this.links) {
      const P = L.plank, a = P.toWorld(0, -0.3, _W, 0), ax = a.x, ay = a.y, az = a.z, b = P.toWorld(0, L.len + 0.3, _W2, 0);
      B.span(ax, ay - 0.06, az, b.x, b.y - 0.06, b.z, NAV.plankW, 0.1, WOOD_L);
      for (let k = 1; k < 4; k++) { const t = k / 4; B.box(lerp(ax, b.x, t), lerp(ay, b.y, t) + 0.0, lerp(az, b.z, t), NAV.plankW + 0.1, 0.05, 0.14, P.yaw, WOOD_D); }
      if (L.chain) {         // xích sắt nối mạn (Liên Hoàn Thuyền), hai sợi hai bên ván
        const s = Math.cos(P.yaw), c2 = -Math.sin(P.yaw);
        for (const o of [-1.6, 1.6]) B.span(ax + s * o, ay + 0.5, az + c2 * o, b.x + s * o, b.y + 0.5, b.z + c2 * o, 0.07, 0.07, IRON);
      }
    }
    for (const b of this.boats) {
      const R = b.ramp; if (!R) continue;
      // (px, pz): hướng ra ngoài mạn (x cục bộ); (qx, qz): ngang ván (z cục bộ)
      const { top, bot, yaw } = R.vis, px = Math.cos(yaw), pz = -Math.sin(yaw), qx = Math.sin(yaw), qz = Math.cos(yaw), wv = NAV.rampW / 2 - 0.1;
      B.span(top.x, top.y - 0.07, top.z, bot.x, bot.y - 0.07, bot.z, NAV.rampW, 0.12, WOOD);
      for (let k = 1; k < 7; k++) {           // thanh ngang bậc thang
        const t = k / 7, x = lerp(top.x, bot.x, t), y = lerp(top.y, bot.y, t) + 0.02, z = lerp(top.z, bot.z, t);
        B.span(x - qx * wv, y, z - qz * wv, x + qx * wv, y, z + qz * wv, 0.1, 0.07, WOOD_D);
      }
      for (const sd of [-1, 1]) B.span(top.x + sd * wv * qx, top.y + 0.05, top.z + sd * wv * qz, bot.x + sd * wv * qx, bot.y + 0.05, bot.z + sd * wv * qz, 0.12, 0.12, WOOD_D);
      // đồ vỡ ở chân ván: thùng, sọt, cột buồm gãy
      const fx = bot.x + px * R.sg * 1.2, fz = bot.z + pz * R.sg * 1.2, gy = this.world.groundY(fx, fz);
      B.box(fx + Math.sin(yaw) * 1.6, gy + 0.3, fz + Math.cos(yaw) * 1.6, 0.8, 0.6, 0.7, yaw + 0.4, WOOD_D);
      B.box(fx - Math.sin(yaw) * 1.7, gy + 0.22, fz - Math.cos(yaw) * 1.7, 0.6, 0.45, 0.6, yaw - 0.3, WOOD);
      B.span(fx - Math.sin(yaw) * 2.6, gy + 0.15, fz - Math.cos(yaw) * 2.6, fx + px * R.sg * 2.4, gy + 0.35, fz + pz * R.sg * 2.4, 0.22, 0.22, WOOD_D);
    }
    B.end();
  }

  // ---- lưu / nạp (checkpoint) ------------------------------------------------------------------------------------------
  snapshot() {
    return {
      t: this.t,
      boats: this.boats.filter((b) => !b.isFerry).map((b) => ({ id: b.id, type: b.type, side: b.side, flag: b.flag, label: b.label, x: b.x, z: b.z, yaw: b.yaw,
        s: b.s, speed: b.speed, targetSpeed: b.targetSpeed, state: b.state, hp: b.hp, captured: b.captured, visible: b.visible,
        path: b.track ? b.track.P.map((p) => ({ x: p.x, z: p.z })) : null })),
      links: this.links.map((L) => ({ a: L.a.id, b: L.b.id, chain: L.chain })),
      rafts: this.rafts.map((R) => ({ id: R.id, state: this.world.scenery?.stakes?.state?.[R.id] ?? "hidden" })),
    };
  }
  restore(snap) {
    for (const f of this.ferries) f.done = true;
    this.ferries.length = 0; this.climbs.length = 0;
    for (const [o] of [...this.riders]) this._unride(o);
    for (const b of [...this.boats]) this.removeBoat(b);
    this.t = snap.t ?? 0;
    const env = this._envNow();
    for (const s of snap.boats) {
      const b = this.addBoat({ type: s.type, side: s.side, id: s.id, flag: s.flag, label: s.label, path: s.path, s0: s.s, speed: s.targetSpeed });
      b.speed = s.speed; b.hp = s.hp; b.captured = !!s.captured; b.visible = s.visible !== false;
      if (!s.path) { b.x = s.x; b.z = s.z; b.yaw = s.yaw; }
      if (s.state === "stranded" || s.state === "settle") { b.strand(); b.update(BOAT.settle + 0.01, env); }
      else if (s.state === "caught") b.catch();
      else if (s.state === "hold") b.stop();
      else if (s.state === "sunk") b.sink();
      b.update(0, env);
    }
    for (const L of snap.links || []) this.grapple(this.byId.get(L.a), this.byId.get(L.b), { chain: L.chain });
    for (const b of this.boats) if (b.state === "stranded" && b.rampOk !== false && b.hull.deckY >= 1.5) this.addRamp(b);
    for (const r of snap.rafts || []) this.world.scenery?.stakes?.setState(r.id, r.state);
  }

  dispose() {
    for (const [o] of [...this.riders]) this._unride(o);
    this.fleet.dispose(); this.bits.dispose();
    for (const b of this.boats) this.decks.remove(b.deck);
    for (const L of this.links) this.decks.remove(L.plank);
    for (const R of this.rafts) this.decks.remove(R.deck);
    this.boats.length = 0; this.links.length = 0;
    if (this.ctx.naval === this) this.ctx.naval = null;
  }
}

// ---- địa hình trận B20 cho ground.setBattleTerrain -------------------------------------------------------------------------
// Độ cao = world.groundY (đúng tam giác đang vẽ — review P2-3), bùn / va chạm qua naval (boong, nước sâu, thân thuyền), kẹp
// trong MAP.clamp. Thay bản giữ chỗ của đợt lõi (wadeGuard dò 400 lần mỗi lần va chạm — core verify mục 7): kiểm nước sâu
// nay là 1 lần tra lưới (world.groundY), chỉ khi lỡ vào nước sâu mới dò ≤ 48 điểm.
export function terrainB20(world, naval) {
  return { ...TERRAIN_B20, height: world.groundY, bare: world.groundY, exact: world.groundY, clamp: MAP.clamp,
    mud: (x, z) => naval.mud(x, z), collideExtra: (x, z, r, o) => naval.collideExtra(x, z, r, o) };
}

// ---- hình học phẳng ---------------------------------------------------------------------------------------------------------
function segDist(x, z, c) {
  const dx = c.x1 - c.x0, dz = c.z1 - c.z0, L2 = dx * dx + dz * dz || 1e-9;
  const t = clamp(((x - c.x0) * dx + (z - c.z0) * dz) / L2, 0, 1);
  return Math.hypot(x - c.x0 - dx * t, z - c.z0 - dz * t);
}
function pushCapsule(x, z, r, c) {
  const dx = c.x1 - c.x0, dz = c.z1 - c.z0, L2 = dx * dx + dz * dz || 1e-9;
  const t = clamp(((x - c.x0) * dx + (z - c.z0) * dz) / L2, 0, 1), px = c.x0 + dx * t, pz = c.z0 + dz * t;
  const ox = x - px, oz = z - pz, d = Math.hypot(ox, oz), m = c.r + r;
  if (d >= m) return null;
  if (d < 1e-6) return [px + m * Math.cos(Math.atan2(dx, dz)), pz - m * Math.sin(Math.atan2(dx, dz))];
  return [px + ox / d * m, pz + oz / d * m];
}
// cửa mạn của thuyền b phía điểm (x, z) (cửa có |lx| lớn nhất cùng phía; không có thì mép boong giữa thân)
function sidePortal(b, x, z) {
  const c = Math.cos(b.yaw), s = Math.sin(b.yaw), dx = x - b.x, dz = z - b.z;
  const lx = dx * c - dz * s, lz = dx * s + dz * c, sg = lx >= 0 ? 1 : -1;
  let best = null, bd = Infinity;
  for (const p of b.hull.deck.portals) { if (Math.sign(p.lx) !== sg || Math.abs(p.lx) < 0.3) continue; const d = Math.abs(p.lz - lz); if (d < bd) { bd = d; best = p; } }
  if (best) return best;
  const r = b.hull.deck.rects[0]; return { lx: sg > 0 ? r.x1 : r.x0, lz: clamp(lz, r.z0 + 0.6, r.z1 - 0.6), r: 1.2 };
}
