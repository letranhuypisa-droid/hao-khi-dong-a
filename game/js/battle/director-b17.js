// battle/director-b17.js — bộ điều phối B17 Tây Kết: luật thuần ở sim/b17.js, file này sinh lính, sĩ quan, Toa Đô, Hưng Đạo vương, các cánh phục binh,
// vua Nhân Tông (tướng AI) và cánh chính, Ô Mã Nhi và bến tàn quân, sứ giả, Yết Kiêu, thuyền đổ bộ; dựng vật của trận (mốc cửa sông, vòng đấu trường,
// bến gỗ, thuyền — một InstancedMesh, chuỗi phao Chặn Dòng); đổi sự kiện của luật thành băng chữ, Hào Khí, tiếng, và giữ giao diện director mà battle.js,
// hud.js, hero.js, hero-skills.js, crowd.js, units.js gọi (như director-b16.js): phase, time, over, result, msgs, events, keSach{list,hud,trigger}, pickups,
// flags, M, ko, objectives, blockers, damageGate, gateTarget, goalText, order / ringItems / ringTargets (phục binh), tryTPC, plantFlag, ultQ, lose,
// restoreCheckpoint, fillActors, các móc on*, strikeables (thuyền tàn quân chém / bắn được), hookTarget (Móc Tên kéo thuyền), onBoom (Chặn Dòng trên sông).
//
// Cánh Toa Đô: luật giữ quãng đã đi (col.s); Toa Đô và hai Đội trưởng đi theo điểm của mình bằng BigUnit.march (units.js, tùy chọn: đi cùng cánh, không ra
// đòn, vẫn nhận đòn), lính hộ tống (vai "squad") theo ô trong đội hình. Toa Đô giáp mặt tướng thì march = null (đánh như thường) tới khi luật thôi cho
// cánh dừng. Lệnh Kế Sách (G) chỉ đặt cờ inp.ksPress — luật quyết. Danh sách lính giữ { a, id } (crowd dùng lại lính chết, xem director-b16.js).
// Vua, sứ giả là BigUnit phe ta (units.js updateAlly; noFight: chỉ đi về post — tùy chọn mới, trận khác không đặt); luật vua (lui, hồi, gục là thua) ở sim.
//
// Dựng trên đất Hàm Tử của B15 (battles/b17.js, cùng lớp phủ bùn, gò). Mọi số ở đây là ĐỀ XUẤT BẢN THỬ.

import * as THREE from "three";
import { BigUnit } from "./units.js";
import { heightAt } from "./world.js";
import { waterDist } from "./ground.js";
import { BannerQueue } from "./banner-queue.js";
import { flagTexture, lambert, merge, part, PAL, RIGS, modelOf, sizeOf, ropeLine } from "./models.js";
import { envPart } from "./glb.js";
import { gain, tick as hkTick, activate as hkActivate, tpcReady, milestone } from "../sim/haokhi.js";
import { HAO_KHI, TIERS, MODES, HERO, g } from "../data/tuning.js";
import { createB17, tickB17, sideB17, snapshotB17, restoreB17, along, routeS, columnHead, columnSpeed, secLeft, bedOf, routed, BED_S, finish as simFinish,
  envoyPos, boatPos, damageBoat, holdBoat, catchBoat, kingGoal, armedBeds, nextBed, ENVOY_LEN } from "../sim/b17.js";
import { HUNG_DAO, HQ, ROUTE, MOUTH, COLUMN, LAST_STAND, OUTPOSTS, BEDS, AMBUSH, PHASES, KE_SACH, KS_ORDER, REINF, PAR_B17, BOSS_B17, REMNANTS, inRect,
  LANDING, PIER, OMA, ENVOY, KING, YET_KIEU, SIDE_MISSIONS } from "../data/battle-b17.js";

const COL = { ta: 0x9b2d20, dich: 0x2c3e55, gold: 0xf1d98a, ring: 0xffffff };
const RING_ITEMS = [
  { k: "theota", name: "Theo ta", icon: "theota" },
  { k: "xungtran", name: "Xung trận", icon: "tiencong" },
  { k: "giucho", name: "Giữ vững", icon: "giuvung" },
  { k: "tiepvien", name: "Gọi tiếp viện", icon: "tiepvien" },
];
// lính hộ tống: hàng dọc lộ trình so với đầu cánh (m, Toa Đô ở 0; âm là phía sau), 4 người mỗi hàng; kiểu lính cận chiến (không cung: phục binh
// nấp cách đường ~18 m, cung thủ tầm 16 m sẽ bắn lộ họ)
const ROWS = [4.5, -3.5, -6, -8.5, -11, -13.5];
const ESCORT_KITS = ["NG_DAO", "NG_GIAO", "NG_DAO", "NG_GIAO", "NG_DAO", "NG_TANK"];
const clone = (o) => JSON.parse(JSON.stringify(o));
const KS_WHY = { lo: "Toa Đô thấy bạn ở gần — phục binh bị lộ", canh: "phục binh không còn Giữ vững trong bãi", muon: "lỡ thời cơ" };
const HK_WHY = { chet: "sứ giả gục", muon: "phục kích đã nổ trước khi sứ giả tới" };
const BOAT_SLOTS = PIER.docks.length + 6;
const FAR_UNIT = 140;                                  // m: đơn vị lớn xa camera hơn thế thì ẩn (cullFar) — cao ~15 điểm ảnh ở 768 dòng              // thuyền tàn quân (0..3) + thuyền đổ bộ (đang chạy cùng lúc tối đa 6)

// Mô hình mượn (như guard.js dựng RIGS lúc chạy): vua Nhân Tông — mô hình Phó tướng nhuộm vàng (tintGold) tới khi bake H30; sứ giả — mô hình cận vệ giáo.
RIGS.B17_H30 ||= { ...RIGS.photuong, cloth: 0xc9a227, armor: PAL.vang, trim: PAL.son, cape: 0xd8b03a };
RIGS.B17_SUGIA ||= { model: modelOf("CV_giao"), scale: sizeOf("CV_giao", 1.04), cloth: 0x7a2418, armor: 0x4a3a2a, trim: PAL.vang, hat: "non", weapon: "giao" };

export class DirectorB17 {
  constructor(ctx) {
    this.ctx = ctx; ctx.director = this;
    this.mode = ctx.mode || "nhanh";
    this.st = createB17({ timeout: MODES[this.mode].timeout, ksWin: this.mode === "nhanh" ? 0.75 : 1, boatHp: PIER.hp * g(ctx.R) });
    this.phase = 0; this.time = 0; this.over = false; this.result = null; this.retries = 0;
    this.msgs = []; this.events = {}; this.pickups = []; this.flags = []; this.generals = {};
    this.M = { par: PAR_B17, timeout: this.st.timeout };
    this.ko = 0; this.koMs = 0; this.orders = 0; this.revived = false; this.counterBoss = 0;
    this.lastFront = null; this.baseHint = null; this.gateHit = null;
    this.bq = new BannerQueue((t, c, T) => ctx.fx.banner(t, c, T));
    const self = this;
    // Lệnh Kế Sách (G): chỉ đặt cờ, luật (sim/b17.js) xét trong bước kế. list: bot (debug.js) bấm G khi có mục "sansang".
    this.keSach = { get list() { return self.ksList(); }, hud: () => this.ksHud(), trigger: () => { this.inp.ksPress = true; } };
    this.reinf = { charges: REINF.charges, cd: 0 };
    ctx.sim.reinf = { charges: this.reinf.charges, pending: [] }; ctx.sim.cooldowns = {};
    this.ringTarget = "all"; this.wingOrder = "giucho"; this.groupDone = [false, false]; this.groupOrder = ["giucho", "giucho"];
    this.resetLists();
    // đầu vào luật mỗi bước (sim/b17.js tickB17): một đối tượng dùng lại, hàm gắn một lần
    this.inp = { hero: { x: 0, z: 0, alive: true }, engaged: false, bossHalf: false, bossDown: false, wingsHold: false, heroToBoss: 999, ksPress: false, pick: null,
      king: { x: 0, z: 0, alive: true, hpPct: 100 }, landUp: 0, omaDown: false, envoyDown: false, foesAt: (x, z, r) => this.foesAt(x, z, r) };
    this.props = new THREE.Group(); ctx.scene.add(this.props);
    this.buildProps();
    this.openGateA3();
    this.spawnHungDao();
    this.spawnPhase(0);
    this.say("Hưng Đạo vương ở bản doanh hỏi kế: đặt phục binh ở bãi lau nào?", 7);
    this.bq.push("TÂY KẾT", "#f1d98a", 1.6);
    ctx.audio.play("drum");
    this.saveCheckpoint();
  }

  // ---- tiện ích ---------------------------------------------------------------------------------------------------------------
  say(text, T = 4, kind = "info") { this.msgs.push({ text, T, kind, t: 0 }); }
  banner(text, color = "#f1d98a", T = 1.2) { this.bq.push(text, color, T); }
  get hero() { return this.ctx.hero; }
  get heroName() { return this.ctx.hero?.def?.name || "Tướng ta"; }
  fmt(s) { return this.ctx.fmt ? this.ctx.fmt(s) : s; }
  hk(v, src, optional = false) { const g0 = gain(this.ctx.hk, v, src, { optional }); if (g0 && Math.abs(g0) >= 0.5) this.ctx.hud?.hkPulse?.(g0); return g0; }
  alive(a) { return this.ctx.crowd.hittable(a); }
  ref(a, extra) { return { a, id: a.id, ...extra }; }
  live(r) { return r.a.id === r.id && this.alive(r.a); }
  liveCount(list) { let n = 0; for (const r of list) if (this.live(r)) n++; return n; }
  unitUp(u) { return !!u && u.alive && !u.dead; }
  resetLists() {
    this.escorts = []; this.wings = [[], [], [], []]; this.outGuards = OUTPOSTS.map(() => []); this.scattered = []; this.keepers = OUTPOSTS.map(() => null);
    this.officers = []; this.boss = null;
    this.landed = []; this.landBoats = []; this.pierGuards = []; this.kingWing = []; this.interceptors = []; this.leaving = [];
    this.king = null; this.oma = null; this.envoy = null; this.yk = null;
  }
  dist(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }
  foesAt(x, z, r) {
    let n = 0;
    for (const a of this.ctx.crowd.agents) if (a.side === "dich" && this.alive(a) && Math.hypot(a.x - x, a.z - z) < r) n++;
    for (const u of this.ctx.units) if (u.side === "dich" && u.alive && !u.dead && !u.retreating && Math.hypot(u.x - x, u.z - z) < r + u.radius) n++;
    return n;
  }
  spawnEnemy(x, z, { role = "garrison", anchor = null, elite = 0.08, tx = x, tz = z, unit = null, kit = undefined, src = null } = {}) {
    const ctx = this.ctx;
    return ctx.crowd.spawn({ side: "dich", unit: unit || (ctx.rng.chance(0.25) ? "CUNGKY_NG" : "KHIEN_NG"), kit, tier: ctx.rng.chance(elite) ? "tinhnhue" : "thuong", role, front: null,
      x, z, sx: tx, sz: tz, yaw: Math.atan2(tx - x, tz - z), anchor, src });
  }
  // toán giữ chỗ: n lính quanh c trong vòng r, dây xích anchor r + pad
  spawnHold(c, n, r, { pad = 6, elite = 0.08 } = {}) {
    const rng = this.ctx.rng, out = [];
    for (let i = 0; i < n; i++) { const a = rng.range(0, Math.PI * 2), d = rng.range(1, r); out.push(this.spawnEnemy(c.x + Math.cos(a) * d, c.z + Math.sin(a) * d, { anchor: { x: c.x, z: c.z, r: r + pad }, elite })); }
    return out;
  }
  spawnOfficer(tier, x, z, { awake = false, aggro = 22, name = null, kind = "officer", rigKey, extra = null } = {}) {
    const u = new BigUnit(this.ctx, { kind, side: "dich", tier, name: name || `${TIERS[tier].name} Nguyên`, x, z, awake, aggro, ...(rigKey ? { rigKey } : {}), ...extra });
    u.home = { x, z }; u.retreatTo = { x: MOUTH.x, z: MOUTH.z };
    this.ctx.units.push(u);
    return u;
  }
  spawnAlly(rigKey, name, id, hp, x, z, yaw = Math.PI * 0.6) {
    const u = new BigUnit(this.ctx, { kind: "general", side: "ta", tier: "ally", rigKey, name, id, hp, x, z, yaw });
    this.ctx.units.push(u);
    return u;
  }
  spawnHungDao() {
    const H = HUNG_DAO, u = this.spawnAlly(H.id, H.name, H.id, H.hp, H.x, H.z);
    this.hungDao = u; this.generals[H.id] = u;
  }
  openGateA3() {
    const g0 = this.ctx.world.gates?.A3;                 // cổng bắc Hàm Tử quan: quân Nguyên giữ, mở sẵn cho cánh Toa Đô đi qua
    if (!g0) return;
    this.ctx.openGates.A3 = true; g0.broken = true;
  }
  // Áo vàng của vua (mô hình mượn): nhuộm vàng màu texture ở shader (giữ sáng tối của texture, đổi sắc) — chỉ vật liệu thân GLB của đơn vị này.
  tintGold(u) {
    const m = u.rig.glb ? u.rig.mats[0] : null;
    if (!m) return;
    m.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace("#include <map_fragment>", "#include <map_fragment>\n"
        + "{ float l = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)); vec3 gold = vec3(1.0, 0.78, 0.26) * (0.35 + 1.5 * l); diffuseColor.rgb = mix(diffuseColor.rgb, gold, 0.72); }");
    };
    m.customProgramCacheKey = () => "b17-gold"; m.needsUpdate = true;
  }

  // ---- vật của trận ----------------------------------------------------------------------------------------------------------
  ringMesh(c, r, color = COL.ring, op = 0.55) {
    const m = new THREE.Mesh(new THREE.RingGeometry(r - 0.4, r, 56), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, side: THREE.DoubleSide, depthWrite: false, forceSinglePass: true }));
    m.rotation.x = -Math.PI / 2; m.position.set(c.x, heightAt(c.x, c.z) + 0.14, c.z); this.props.add(m);
    return m;
  }
  envMat() { return (this._envMat ||= lambert()); }
  flag(p, color, h = 7) {
    const g0 = new THREE.Group(), y = heightAt(p.x, p.z), env = envPart("ENV_cot_co", { s: h / 9 });          // cột mẫu cao 9 m (như B16), không có thì trụ
    const pole = env ? new THREE.Mesh(env, this.envMat()) : new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, h, 6), new THREE.MeshLambertMaterial({ color: 0x4a3626 }));
    if (!env) pole.position.y = h / 2;
    g0.add(pole);
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.1), new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }));
    cloth.position.set(0.92, h - 0.7, 0); g0.add(cloth);
    g0.position.set(p.x, y, p.z); this.props.add(g0); g0.cloth = cloth;
    return g0;
  }
  buildProps() {
    // mốc cửa sông: vòng đỏ, cờ Nguyên cao (đầu cánh tới đây là thua; thuyền tàn quân qua đây là thoát)
    this.mouthRing = this.ringMesh(MOUTH, MOUTH.r, 0xff5a3a, 0.6);
    this.mouthFlag = this.flag({ x: MOUTH.x + 2, z: MOUTH.z + 2 }, COL.dich, 10);
    // vòng đấu trường (P4: gò Toa Đô cố thủ), dựng khi đứng lại
    this.arenaRing = null;
    // bến tàn quân: cầu gỗ (mẫu ENV_ben_go dài 10 m dọc z, sàn ở 1,2 m trên đáy cọc — như bến của scenery.js) và tời neo trên bờ; một lưới
    const zb = PIER.z, parts = [envPart("ENV_ben_go", { x: PIER.x, y: 0.95 - 1.2, z: zb - PIER.len / 2, sz: PIER.len / 10 }), envPart("ENV_toi_neo", { x: PIER.x + 7, y: heightAt(PIER.x + 7, zb + 3) - 0.05, z: zb + 3, ry: 0.3 })].filter(Boolean);
    if (!parts.length) parts.push(part(new THREE.BoxGeometry(2.4, 0.15, PIER.len), PAL.go, { x: PIER.x, y: 0.95, z: zb - PIER.len / 2 }));
    const pier = new THREE.Mesh(merge(parts), this.envMat()); pier.castShadow = true; pier.receiveShadow = true; this.props.add(pier);
    // thuyền: mẫu ENV_thuyen_song_nguyen (gốc ở mớn nước) — mọi thuyền của trận một InstancedMesh (2 lượt vẽ kể cả bóng); chưa nạp thì khối code
    const env = envPart("ENV_thuyen_song_nguyen");
    const geo = env || merge([part(new THREE.BoxGeometry(3.4, 1.2, 11), PAL.nau, { y: 0.6 }), part(new THREE.BoxGeometry(2.8, 0.9, 3.5), PAL.go, { y: 1.6, z: -3 }),
      part(new THREE.CylinderGeometry(0.1, 0.12, 6, 5), PAL.then, { y: 3.6, z: 0.6 })]);
    this.boatY = env ? 0.3 : 0.1;
    const bm = this.boatMesh = new THREE.InstancedMesh(geo, this.envMat(), BOAT_SLOTS);
    bm.castShadow = true; bm.receiveShadow = true; bm.frustumCulled = false;              // thuyền rải khắp sông: hộp bao của InstancedMesh không theo kịp
    bm.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < BOAT_SLOTS; i++) { this.hideBoat(i); bm.setColorAt(i, this._col.set(0xffffff)); }
    this.props.add(bm);
    this.boom = null;
    this.syncProps(); this.syncBoats(0);
  }
  get _col() { return (this.__col ||= new THREE.Color()); }
  setBoat(i, x, z, yaw, { y = 0, roll = 0, pitch = 0 } = {}) {
    const M = (this._m4 ||= new THREE.Matrix4()), q = (this._q ||= new THREE.Quaternion()), e = (this._e ||= new THREE.Euler(0, 0, 0, "YXZ"));
    e.set(pitch, yaw, roll); q.setFromEuler(e);
    M.compose((this._v ||= new THREE.Vector3()).set(x, this.boatY + y, z), q, (this._s1 ||= new THREE.Vector3(1, 1, 1)));
    this.boatMesh.setMatrixAt(i, M); this.boatMesh.instanceMatrix.needsUpdate = true;
  }
  hideBoat(i) { this.boatMesh.setMatrixAt(i, (this._m0 ||= new THREE.Matrix4().makeScale(0, 0, 0))); this.boatMesh.instanceMatrix.needsUpdate = true; }
  colorBoat(i, hex) { this.boatMesh.setColorAt(i, this._col.set(hex)); this.boatMesh.instanceColor.needsUpdate = true; }
  syncProps() {
    const st = this.st, w = this.ctx.world;
    OUTPOSTS.forEach((O, i) => {
      const o = st.outposts[i], v = w.bases?.[O.id];
      if (!v) return;
      if (v.ring) { v.ring.visible = !o.taken; v.ring.material.color.set(o.blockedRing ? 0xff5a3a : 0xffffff); }
      if (v.prog) { v.prog.visible = !o.taken && o.p > 0.005; w.setBaseProgress?.(O.id, o.p); }
      if (o.taken !== v._b17taken) { v._b17taken = o.taken; w.setBaseOwner?.(O.id, o.taken ? "ta" : "dich"); }
    });
    if (st.arena && !this.arenaRing) this.arenaRing = this.ringMesh(st.arena, 10, COL.gold, 0.5);
    if (this.arenaRing) this.arenaRing.visible = !!st.arena && st.phase >= 3 && !this.over;
  }
  // thuyền tàn quân theo luật: neo / đang chạy (dập dềnh), chìm (nghiêng, chìm dần rồi ẩn), cháy (đen, khói lửa), mắc cạn (nghiêng), qua mốc (ẩn)
  syncBoats(dt) {
    const st = this.st, t = this.time;
    const V = (this.boatVis ||= st.pier.boats.map(() => ({ k: 0, c: 0 })));
    st.pier.boats.forEach((b, i) => {
      const p = boatPos(st, i), bob = 0.07 * Math.sin(t * 1.3 + i * 1.7), v = V[i];
      if (b.state === "dock" || b.state === "sail") { v.k = 0; this.setBoat(i, p.x, p.z, p.yaw, { y: bob, roll: 0.03 * Math.sin(t + i) }); if (v.c) { v.c = 0; this.colorBoat(i, 0xffffff); } return; }
      if (b.state === "passed") { this.hideBoat(i); return; }
      v.k = Math.min(1, v.k + dt / 5);
      if (b.state === "sunk") { if (v.k >= 1) this.hideBoat(i); else this.setBoat(i, p.x, p.z, p.yaw, { y: -v.k * 3, roll: 0.5 * v.k }); }
      else if (b.state === "caught") this.setBoat(i, p.x, p.z, p.yaw, { y: -0.25, roll: 0.22 });
      else if (b.state === "burnt") { this.setBoat(i, p.x, p.z, p.yaw, { y: -0.4 * v.k, roll: 0.08 }); if (!v.c) { v.c = 1; this.colorBoat(i, 0x2a221c); } }
    });
  }

  // ---- sinh lính theo pha (cả khi tải lại điểm lưu) ----------------------------------------------------------------------------
  spawnPhase() {
    const st = this.st;
    OUTPOSTS.forEach((O, k) => { if (!st.outposts[k].taken) this.spawnOutpost(k); });
    if (!st.bossDown) this.spawnColumn();
    if (st.bed && st.phase < 4) { this.spawnWings(0); if (st.bed2) this.spawnWings(1); }
    this.spawnKing();
    this.spawnPier();
    this.spawnEnvoy();
  }
  spawnOutpost(k) {
    const O = OUTPOSTS[k], gate = O.id === "A3", c = gate ? { x: O.x - 5, z: O.z } : O;   // đồn cổng: quân giữ đứng phía tây cổng (vòng chiếm vắt qua tường)
    this.outGuards[k] = this.spawnHold(c, O.garrison, gate ? 4 : O.r - 3, { pad: 8 }).map((a) => this.ref(a));
    this.keepers[k] = this.spawnOfficer(O.keeper, c.x - 2, c.z + 2, { aggro: 20, name: `${TIERS[O.keeper].name} giữ ${O.name.toLowerCase()}` });
  }
  spawnColumn() {
    const st = this.st, C = st.col, head = columnHead(st), at = C.stood && st.arena ? st.arena : head;
    const u = this.spawnOfficer("tuong", at.x, at.z, { kind: "boss", rigKey: BOSS_B17.rigKey, name: BOSS_B17.name, aggro: BOSS_B17.aggro, extra: { fate: "killed", lastStand: LAST_STAND } });
    u.yaw = head.yaw; u.defeatMeans = null;
    this.boss = u; this.bossMet = true;
    this.officers = [];
    for (let k = 0; k < COLUMN.officers; k++) { const q = this.officerPoint(k); this.officers.push(this.spawnOfficer("doitruong", q.x, q.z, { aggro: 16, name: "Đội trưởng hộ tống" })); }
    const n = C.stood && routed(st) ? Math.ceil(COLUMN.escorts * (1 - AMBUSH.scatter)) : COLUMN.escorts;
    this.escorts = [];
    for (let k = 0; k < n; k++) {
      const q = this.slotPoint(k);
      this.escorts.push(this.ref(this.spawnEnemy(q.x, q.z, { role: "squad", unit: "KHIEN_NG", kit: ESCORT_KITS[k % ESCORT_KITS.length], elite: 0.12 }), { k }));
    }
    this.weakenEscorts();
    this.stepColumn();
  }
  // Quân Viễn Chinh: Sĩ Khí cánh dưới weakBelow thì lính hộ tống Công × weakMult (mỗi người một lần)
  weakenEscorts() {
    if (this.st.col.morale >= COLUMN.weakBelow) return;
    for (const r of this.escorts) if (this.live(r) && !r.weak) { r.weak = true; r.a.cong *= COLUMN.weakMult; }
  }
  // ô của lính hộ tống thứ k: theo lộ trình khi cánh đi; quanh gò khi đã đứng lại
  slotPoint(k) {
    const st = this.st;
    if (st.col.stood && st.arena) { const A = st.arena, ang = k * 2.39996, r = 5.5 + (k % 3) * 2.2; return { x: A.x + Math.cos(ang) * r, z: A.z + Math.sin(ang) * r }; }
    const row = Math.floor(k / 4), f = ROWS[row % ROWS.length] - Math.floor(row / ROWS.length) * 16, side = ((k % 4) - 1.5) * 2.4;
    const p = along(ROUTE, st.col.s + f);
    return { x: p.x + Math.cos(p.yaw) * side, z: p.z - Math.sin(p.yaw) * side, yaw: p.yaw };
  }
  officerPoint(k) {
    const st = this.st, side = k ? 3.8 : -3.8;
    if (st.col.stood && st.arena) return { x: st.arena.x + side, z: st.arena.z + 3 };
    const p = along(ROUTE, st.col.s - 1.5);
    return { x: p.x + Math.cos(p.yaw) * side, z: p.z - Math.sin(p.yaw) * side, yaw: p.yaw };
  }
  // phục binh: nhóm 0 (hai cánh ở bãi đã chọn), nhóm 1 (hai cánh ở bãi thứ hai — Kế Sách Nhỏ). Nấp ở chỗ (dây neo r 2: chỉ đánh kẻ tới gần chỗ nấp — crowd.js leashOk)
  groupBed(gi) { return gi ? this.st.bed2 : this.st.bed; }
  spawnWings(gi) {
    const B = bedOf(this.groupBed(gi)), ctx = this.ctx;
    if (!B) return;
    B.wings.forEach((w, j) => {
      const wi = gi * 2 + j;
      if (this.liveCount(this.wings[wi])) return;
      this.wings[wi] = [];
      for (let k = 0; k < AMBUSH.wingN; k++) {
        const ang = k * 2.39996, rr = 0.8 + (k % 4) * 1.1, x = w.x + Math.cos(ang) * rr, z = w.z + Math.sin(ang) * rr;
        const a = ctx.crowd.spawn({ side: "ta", unit: "GIAO_DV", role: "squad", front: null, x, z, sx: x, sz: z, yaw: Math.atan2(B.x0 - x, -75 - z), legionMult: ctx.stats.legionMult ?? 1 });
        this.wings[wi].push(this.ref(a, { w: j, g: gi, post: { x, z } }));
      }
    });
    this.setWingOrder(this.groupDone[gi] ? "xungtran" : this.groupOrder[gi], true, [gi]);
  }

  // ---- vua Nhân Tông (tướng AI) và cánh chính --------------------------------------------------------------------------------------
  spawnKing() {
    const ctx = this.ctx, Kc = this.checkpointKing, p = Kc && this.st.king.mode === "fight" ? Kc : KING;
    const u = this.king = this.spawnAlly("B17_H30", KING.name, KING.id, KING.hp, p.x, p.z);
    if (Kc) u.hp = Math.max(u.maxHp * 0.5, Kc.hp ?? u.maxHp);
    u.postK = 1; this.tintGold(u); this.generals[KING.id] = u;
    for (const m of [...u.rig.meshes.slice(1), ...u.rig.weapons]) m.castShadow = false;   // vua luôn gần tướng: chỉ thân đổ bóng (bớt 3 lượt vẽ bóng)
    this.kingWing = [];
    for (let k = 0; k < KING.wing; k++) {
      const ang = k * 2.39996, rr = 2 + (k % 4) * 1.4, x = u.x - 4 + Math.cos(ang) * rr, z = u.z + Math.sin(ang) * rr;
      const a = ctx.crowd.spawn({ side: "ta", unit: "GIAO_DV", role: "squad", front: null, x, z, sx: x, sz: z, legionMult: ctx.stats.legionMult ?? 1 });
      this.kingWing.push(this.ref(a, { k }));
    }
    this.kingT = 0;
  }
  stepKing(dt) {
    const u = this.king, st = this.st;
    if (!this.unitUp(u)) return;
    const mode = st.king.mode, goal = kingGoal(st, u);
    u.noFight = mode !== "fight";
    u.post.x = goal.x; u.post.z = goal.z;
    if (mode === "heal") u.hp = Math.min(u.maxHp, u.hp + u.maxHp * KING.heal / KING.healSec * dt);
    if ((this.kingT -= dt) > 0) return;
    this.kingT = 1;
    // cánh chính: theo sau vua (lui về bản doanh cùng vua); đánh địch trong 16 m của mình (crowd.js pickFoe)
    const back = mode === "fight" ? 5 : 3;
    for (const r of this.kingWing) {
      if (!this.live(r)) continue;
      const ang = r.k * 2.39996, rr = back + (r.k % 4) * 1.6;
      r.a.sx = u.x - Math.sin(u.yaw) * back + Math.cos(ang) * rr * 0.6; r.a.sz = u.z - Math.cos(u.yaw) * back + Math.sin(ang) * rr * 0.6;
    }
  }

  // ---- bến tàn quân, Ô Mã Nhi -------------------------------------------------------------------------------------------------------
  spawnPier() {
    const st = this.st;
    if (st.oma.state !== "hold") return;
    const u = this.oma = this.spawnOfficer("tuong", OMA.x, OMA.z, { kind: "boss", rigKey: OMA.id, name: OMA.name, aggro: OMA.aggro, extra: { T: { hp: OMA.hp }, leash: OMA.leash } });
    u.retreatTo = { x: PIER.x, z: PIER.z - PIER.len }; u.yaw = 0;
    this.pierGuards = this.spawnHold({ x: PIER.x, z: PIER.z + 6 }, PIER.troops, PIER.r, { pad: 6, elite: 0.15 }).map((a) => this.ref(a));
  }
  // Ô Mã Nhi rời bến (bị đuổi: đã chạy theo nhánh rút của BigUnit; bỏ bến P4: cho chạy luôn) — quân giữ bến bỏ chạy xuống thuyền rồi rời trận
  abandonPier() {
    const u = this.oma;
    if (this.unitUp(u) && !u.retreating) { u.retreating = true; u.retreatT = 0; u.march = null; }
    const ids = new Set();
    for (const r of this.pierGuards) if (this.live(r)) { ids.add(r.id); r.a.anchor = null; r.a.role = "squad"; r.a.sx = PIER.x + (r.a.x - PIER.x) * 0.3; r.a.sz = PIER.z - 2; this.leaving.push(r); }
    this.pierGuards = [];
    if (ids.size) this.ctx.crowd.rout(PIER.x, PIER.z, 30, (a) => ids.has(a.id));
  }
  boatIdx(i) { const b = this.st.pier.boats[i]; return b && (b.state === "dock" || b.state === "sail"); }
  hitBoat(i, dmg) {
    const ev = [], d = damageBoat(this.st, i, dmg, ev);
    if (d > 0) { const p = boatPos(this.st, i); this.ctx.fx.text(p.x, p.z, `−${Math.round(d)}`, "#ffd27a"); this.ctx.audio.play("gate", p.x, p.z); }
    this.onEvents(ev);
  }
  // Móc Tên trúng thuyền: kéo dạt vào bờ gần nhất, mắc cạn
  catchBoatAt(i) {
    const p = boatPos(this.st, i), ev = [];
    catchBoat(this.st, i, { x: p.x, z: Math.max(p.z, -170.5) }, ev);
    this.onEvents(ev);
  }
  // vật thay thế cho Móc Tên (hero-skills.js hookTarget → hero.js updateShots nhận đích proxy ngoài ctx.units)
  boatProxy(i) {
    const self = this, st = () => self.st;
    return ((this._px ||= [])[i] ||= {
      proxy: true, isBig: true, side: "dich", tier: "thuyen", name: "Thuyền tàn quân", radius: 3, rig: { scale: 1 }, poiseMax: 0, retreating: false, dead: 0,
      get giap() { return 30 * g(self.ctx.R); },
      get x() { return boatPos(st(), i).x; }, get z() { return boatPos(st(), i).z; }, get y() { return 0.4; },
      get alive() { return self.boatIdx(i); },
      takeHeroHit(dmg) { self.hitBoat(i, dmg); return { killed: !self.boatIdx(i) }; },
      applyStatus(kind) { if ((kind === "pull" || kind === "bind") && self.boatIdx(i)) self.catchBoatAt(i); return true; },
    });
  }
  hookTarget(h, range) {
    let best = null, bd = range + 4;
    this.st.pier.boats.forEach((b, i) => { if (!this.boatIdx(i)) return; const p = boatPos(this.st, i), d = Math.hypot(p.x - h.x, p.z - h.z); if (d < bd) { bd = d; best = i; } });
    return best == null ? null : this.boatProxy(best);
  }
  // thuyền tàn quân (neo, đang chạy) chém / bắn được: tên × 0,3 như vào cổng (hero.js)
  strikeables() {
    const out = (this._strk ||= []); out.length = 0;
    this.st.pier.boats.forEach((b, i) => {
      if (!this.boatIdx(i)) return;
      const s = ((this._sk ||= [])[i] ||= { r: 3.2, i, hit: (d) => this.hitBoat(i, d) }), p = boatPos(this.st, i);
      s.x = p.x; s.z = p.z; out.push(s);
    });
    return out;
  }
  // Chặn Dòng thả trên sông (giữa chuỗi dưới mặt nước, hoặc chuỗi cắt luồng thuyền): director tự lo — chuỗi phao, thuyền tàn quân chạm thì đứng lại
  onBoom({ x0, z0, x1, z1, until }) {
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    if (waterDist(mx, mz) > -1 && !(Math.min(z0, z1) < PIER.laneZ + 3 && Math.max(x0, x1) > PIER.docks[3].x - 10)) return false;
    this.dropBoom();
    const n = 9, parts = [];
    for (let k = 0; k < n; k++) { const t = k / (n - 1), x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t; parts.push(envPart("ENV_phao_moc", { x, y: -0.2, z, ry: Math.atan2(x1 - x0, z1 - z0), s: 0.6 }) || part(new THREE.CylinderGeometry(0.35, 0.35, 0.5, 6), PAL.go, { x, y: 0.2, z })); }
    const mesh = new THREE.Mesh(merge(parts), this.envMat()); this.props.add(mesh);
    const rope = ropeLine(0x6a5a3a); rope.set(x0, 0.45, z0, x1, 0.45, z1); this.props.add(rope);
    this.boom = { x0, z0, x1, z1, until, mesh, rope };
    this.say("Chuỗi phao chặn dòng: thuyền tàn quân chạm phải phải đứng lại.", 3, "good");
    return true;
  }
  dropBoom() {
    const B = this.boom; if (!B) return;
    this.props.remove(B.mesh); B.mesh.geometry.dispose(); this.props.remove(B.rope); B.rope.geometry.dispose();
    this.boom = null;
  }
  stepBoom() {
    const B = this.boom; if (!B) return;
    const now = this.ctx.clock;
    if (now >= B.until) { this.dropBoom(); return; }
    const dx = B.x1 - B.x0, dz = B.z1 - B.z0, L2 = dx * dx + dz * dz || 1;
    this.st.pier.boats.forEach((b, i) => {
      if (b.state !== "sail") return;
      const p = boatPos(this.st, i), t = Math.max(0, Math.min(1, ((p.x - B.x0) * dx + (p.z - B.z0) * dz) / L2));
      if (Math.hypot(B.x0 + dx * t - p.x, B.z0 + dz * t - p.z) < 6.5) holdBoat(this.st, i, B.until - now);
    });
  }

  // ---- thuyền đổ bộ (Phá Trận Thủy Bộ) ----------------------------------------------------------------------------------------------
  freeBoatSlot() { for (let i = PIER.docks.length; i < BOAT_SLOTS; i++) if (!this.landBoats.some((b) => b.slot === i)) return i; return -1; }
  startLanding(e) {
    const n = e.boats, per = e.boats - e.sunk > 0 ? Math.ceil(e.troops / (e.boats - e.sunk)) : 0;
    let left = e.troops;
    for (let k = 0; k < n; k++) {
      const slot = this.freeBoatSlot(); if (slot < 0) break;
      const bx = e.x + (k - (n - 1) / 2) * LANDING.gap, sunk = k < e.sunk, troops = sunk ? 0 : Math.min(per, left);
      left -= troops;
      this.landBoats.push({ slot, x: bx, z: e.z - LANDING.from, tx: bx, tz: LANDING.bank.z - 6.5, state: "in", t: 0, troops, sunk, sinkAt: sunk ? 0.45 : 2 });
    }
    if (!this.landTold) { this.landTold = true; this.say("Phá Trận Thủy Bộ: thuyền Nguyên đổ bộ ở bờ gần bạn — cứ 30 giây một lượt.", 5, "bad"); }
    else this.banner("THUYỀN NGUYÊN ĐỔ BỘ", "#ff8a6a", 0.9);
    this.ctx.audio.play("horn", e.x, e.z);
  }
  stepLanding(dt) {
    const ctx = this.ctx;
    for (const b of this.landBoats) {
      b.t += dt;
      const dz = b.tz - b.z, dd = Math.abs(dz);
      if (b.state === "in") {
        b.z += Math.sign(dz) * Math.min(dd, LANDING.speed * dt);
        if (b.sunk && Math.abs(b.z - b.tz) < LANDING.from * (1 - b.sinkAt)) { b.state = "sink"; b.t = 0; ctx.fx.dust(b.x, b.z, 1.2); this.say("Yết Kiêu đục thủng một thuyền đổ bộ!", 3, "good"); }
        else if (Math.abs(b.z - b.tz) < 0.05) { b.state = "stay"; b.t = 0; this.landTroops(b); }
        this.setBoat(b.slot, b.x, b.z, 0, { y: 0.06 * Math.sin(b.t * 2) });
      } else if (b.state === "stay") {
        this.setBoat(b.slot, b.x, b.z, 0, { y: 0.05 * Math.sin(b.t * 1.5), pitch: -0.04 });
        if (b.t > LANDING.stay) { b.state = "out"; b.t = 0; }
      } else if (b.state === "out") {
        b.z -= LANDING.speed * 0.7 * dt; this.setBoat(b.slot, b.x, b.z, Math.PI, { y: 0.05 * Math.sin(b.t * 1.5) });
        if (b.z < LANDING.bank.z - LANDING.from - 6) b.state = "gone";
      } else if (b.state === "sink") {
        this.setBoat(b.slot, b.x, b.z, 0, { y: -b.t * 0.8, roll: Math.min(0.6, b.t * 0.25) });
        if (b.t > 4) b.state = "gone";
      }
      if (b.state === "gone") this.hideBoat(b.slot);
    }
    this.landBoats = this.landBoats.filter((b) => b.state !== "gone");
  }
  landTroops(b) {
    const ctx = this.ctx, h = this.hero;
    for (let k = 0; k < b.troops; k++) {
      const x = b.x + (k - (b.troops - 1) / 2) * 1.6, z = LANDING.bank.z + ctx.rng.range(-0.5, 1.5);
      const a = this.spawnEnemy(x, z, { role: "zone", unit: "KHIEN_NG", tx: h.x, tz: h.z, elite: 0.15, src: "landing" });
      this.landed.push(this.ref(a));
    }
    ctx.fx.dust(b.x, LANDING.bank.z, 1);
  }

  // ---- sứ giả (Kế Sách Nhỏ "Hỏi kế Quốc công") --------------------------------------------------------------------------------------
  spawnEnvoy() {
    const st = this.st, E = st.envoy;
    if (E.state === "lost") return;
    const p = E.state === "done" ? { x: HUNG_DAO.x + 3, z: HUNG_DAO.z + 4 } : envoyPos(st);
    const u = this.envoy = this.spawnAlly("B17_SUGIA", ENVOY.name, "SUGIA", ENVOY.hp, p.x, p.z, -2.4);
    u.noFight = true; u.postK = 0.55; u.meleeMult = ENVOY.meleeMult;
  }
  stepEnvoy() {
    const u = this.envoy, st = this.st, E = st.envoy;
    if (!this.unitUp(u)) return;
    if (E.state === "wait" || E.state === "walk") { const p = envoyPos(st); u.post.x = p.x; u.post.z = p.z; }
    else if (E.state === "done") { u.post.x = HUNG_DAO.x + 3; u.post.z = HUNG_DAO.z + 4; }
  }
  spawnInterceptors(e) {
    const list = [];
    for (let k = 0; k < e.n; k++) {
      const ang = k * 2.39996, x = e.x + Math.cos(ang) * 2.5, z = e.z + Math.sin(ang) * 2.5;
      const a = this.spawnEnemy(x, z, { role: "squad", unit: "KHIEN_NG", kit: k % 2 ? "NG_GIAO" : "NG_DAO", elite: 0.2, anchor: { x: e.x, z: e.z, r: 2.5, target: this.envoy } });
      list.push(this.ref(a));
    }
    this.interceptors.push(...list);
    this.say("Quân Nguyên lao ra chặn sứ giả!", 3, "bad"); this.ctx.audio.play("horn", e.x, e.z);
  }

  // ---- Yết Kiêu (Tương truyền) --------------------------------------------------------------------------------------------------------
  spawnYetKieu(e) {
    const ctx = this.ctx, u = this.spawnAlly(YET_KIEU.id, YET_KIEU.name, YET_KIEU.id, YET_KIEU.hp, e.x, e.z, 0);
    const head = columnHead(this.st); u.post.x = head.x; u.post.z = head.z; u.postK = 1;
    this.yk = { u, t: YET_KIEU.dur };
    ctx.fx.dust(e.x, e.z, 1.6); ctx.fx.ring(e.x, e.z, 4, 0x9fd0e0, 0.6); ctx.audio.play("dash", e.x, e.z);
    // hạ vài lính hộ tống gần nhất (đòn đầu khi trồi lên)
    const near = this.escorts.filter((r) => this.live(r)).sort((p, q) => this.dist(p.a, e) - this.dist(q.a, e)).slice(0, YET_KIEU.kills);
    for (const r of near) { const dx = r.a.x - e.x, dz = r.a.z - e.z, d = Math.hypot(dx, dz) || 1; ctx.crowd.damage(r.a, r.a.maxHp * 2, { kx: dx / d, kz: dz / d, knock: 4, by: "ally" }); }
    this.banner("YẾT KIÊU · TƯƠNG TRUYỀN", "#9fd0e0", 1.6);
    this.say(`Yết Kiêu trồi lên từ lạch đầm, đánh vào sườn cánh Toa Đô${this.st.land.off ? "" : " và đục một thuyền đổ bộ"} (Tương truyền).`, 5, "good");
  }
  stepYetKieu(dt) {
    const Y = this.yk; if (!Y) return;
    Y.t -= dt;
    const u = Y.u;
    if (this.unitUp(u)) { const head = columnHead(this.st); u.post.x = head.x; u.post.z = head.z - 3; }
    if (Y.t <= 0 || !this.unitUp(u)) {
      if (u.alive) { this.ctx.fx.dust(u.x, u.z, 1.4); this.ctx.fx.ring(u.x, u.z, 3, 0x9fd0e0, 0.5); u.dispose(); }
      this.yk = null;
    }
  }

  // ---- phục binh (vòng Mệnh Lệnh) ---------------------------------------------------------------------------------------------
  ringItems() { return RING_ITEMS; }
  ringTargets() { return [{ id: "all", name: this.wingsUp() ? `Phục binh · ${this.wingsUp()} người` : "Chưa có phục binh" }]; }
  ringHint() { return ""; }
  ringStatus(k) {
    if (k === "tiepvien") return `${this.reinf.charges} lượt${this.reinf.cd > 0 ? " · " + Math.ceil(this.reinf.cd) + "s" : ""}`;
    return this.wingOrder === k && this.wingsUp() ? "đang theo" : "";
  }
  wingsUp() { let n = 0; for (const l of this.wings) n += this.liveCount(l); return n; }
  pending() { const s = this.st.ks.phucKich.state; return s === "khadung" || s === "sansang"; }
  // nhóm còn chờ phục kích (bãi chưa nổ); hết thì mọi nhóm
  liveGroups() { const gs = [0, 1].filter((gi) => !this.groupDone[gi] && this.groupBed(gi)); return gs.length ? gs : [0, 1]; }
  // đặt lệnh cho các cánh của nhóm gs. giucho: trước phục kích thì về chỗ nấp; sau đó giữ tại chỗ.
  setWingOrder(k, quiet = false, gs = this.liveGroups()) {
    const live = this.liveGroups();
    if (gs.length === live.length && gs.every((gi, i) => gi === live[i])) this.wingOrder = k;   // lệnh cho đúng các nhóm còn chờ: vòng Mệnh Lệnh hiện lệnh này
    const role = k === "theota" ? "follow" : k === "giucho" ? "squad" : "zone", o = k === "xungtran" ? this.chargePoint() : null;
    for (const gi of gs) {
      this.groupOrder[gi] = k;
      const B = bedOf(this.groupBed(gi)), wait = !this.groupDone[gi] && this.pending();
      for (const list of [this.wings[gi * 2], this.wings[gi * 2 + 1]]) for (const r of list) {
        if (!this.live(r)) continue;
        const a = r.a; a.role = role; a.foe = null; r.charge = k === "xungtran";
        if (k === "giucho" && wait && B) { a.anchor = { x: B.wings[r.w].x, z: B.wings[r.w].z, r: 2 }; a.sx = r.post.x; a.sz = r.post.z; }
        else if (k === "giucho") { a.anchor = null; a.sx = a.x; a.sz = a.z; }
        else { a.anchor = null; if (o) { a.sx = o.x; a.sz = o.z; } }
      }
    }
    if (!quiet) this.orders++;
  }
  chargePoint() { const u = this.boss; return u && u.alive && !u.dead ? { x: u.x, z: u.z } : this.st.arena || columnHead(this.st); }
  order(target, k) {
    const ctx = this.ctx;
    if (k === "tiepvien") {
      if (!this.st.bed) { this.say("Chưa đặt phục binh — chọn bãi lau ở bản doanh trước.", 3); return { ok: false }; }
      if (this.reinf.charges <= 0) { this.say("Hết lượt gọi tiếp viện.", 2.5); return { ok: false }; }
      if (this.reinf.cd > 0) { this.say(`Gọi tiếp viện đang hồi (${Math.ceil(this.reinf.cd)} s).`, 2.5); return { ok: false }; }
      this.reinf.charges--; this.reinf.cd = REINF.cd; ctx.sim.reinf.charges = this.reinf.charges;
      const gi = this.liveGroups()[0], B = bedOf(this.groupBed(gi));
      for (let k2 = 0; k2 < REINF.n; k2++) {
        const j = k2 % 2, w = B.wings[j], ang = k2 * 2.39996, x = w.x + Math.cos(ang) * 4.5, z = w.z + Math.sin(ang) * 4.5;
        const a = ctx.crowd.spawn({ side: "ta", unit: "GIAO_DV", role: "squad", front: null, x, z, sx: x, sz: z, legionMult: ctx.stats.legionMult ?? 1 });
        this.wings[gi * 2 + j].push(this.ref(a, { w: j, g: gi, post: { x, z } }));
      }
      this.setWingOrder(this.groupDone[gi] ? "xungtran" : this.wingOrder, true, [gi]);
      this.say(`Thêm ${REINF.n} quân vào hai cánh phục binh.`, 3, "good"); ctx.audio.play("horn"); this.orders++;
      return { ok: true };
    }
    if (!this.wingsUp()) { this.say("Chưa có phục binh — chọn bãi lau ở bản doanh trước.", 3); return { ok: false }; }
    this.setWingOrder(k);
    const name = RING_ITEMS.find((o) => o.k === k).name;
    this.say(`Phục binh: ${name}.${k !== "giucho" && this.pending() ? " (Phục kích cần cả hai cánh Giữ vững trong bãi.)" : ""}`, 3, k === "giucho" || !this.pending() ? "good" : "bad");
    ctx.audio.play("drum");
    return { ok: true };
  }
  // hai cánh của bãi đang mở cửa sổ (không thì bãi kế cánh sẽ vào) Giữ vững trong bãi (mỗi cánh ≥ holdMin người trong bãi nới pad m)
  wingsHold() {
    const st = this.st, id = st.ks.phucKich.state === "sansang" ? st.ks.phucKich.bed : nextBed(st), B = bedOf(id);
    const gi = id === st.bed ? 0 : 1;
    if (!B || this.groupDone[gi] || this.groupOrder[gi] !== "giucho") return false;
    const R = { x0: B.x0 - AMBUSH.pad, x1: B.x1 + AMBUSH.pad, z0: B.z0 - AMBUSH.pad, z1: B.z1 + AMBUSH.pad };
    return [this.wings[gi * 2], this.wings[gi * 2 + 1]].every((list) => { let n = 0; for (const r of list) if (this.live(r) && inRect(R, r.a.x, r.a.z)) n++; return n >= AMBUSH.holdMin; });
  }

  // ---- Kế Sách (Phục kích bãi lau, Hỏi kế Quốc công — sim/b17.js) --------------------------------------------------------------------
  ksList() { const K = this.st.ks; return [{ id: "phucKich", state: K.phucKich.state }, { id: "hoiKe", state: K.hoiKe.state }]; }
  ksHud() {
    const st = this.st;
    return KS_ORDER.map((id) => {
      const K = KE_SACH[id], s = st.ks[id];
      let word;
      if (id === "phucKich") {
        const B = bedOf(s.state === "sansang" ? s.bed : nextBed(st) || st.bed);
        word = s.state === "thanhcong" ? "Thành công" : s.state === "thatbai" ? `Thất bại · ${KS_WHY[s.why] || ""}`
          : s.state === "sansang" ? this.fmt(`Còn ${Math.ceil(s.left)} s · {kesach}`)
          : !B ? "Chọn bãi lau ở bản doanh" : st.col.stood ? "Không kịp dùng" : `${s.tries ? "Lần hai · " : ""}Chờ ở ${B.name} · phục binh ${this.wingsHold() ? "giữ vững" : "chưa giữ vững"}`;
      } else {
        const E = st.envoy;
        word = s.state === "thanhcong" ? `Thành công · thêm phục binh ở ${bedOf(st.bed2)?.name || "bãi còn lại"}` : s.state === "thatbai" ? `Thất bại · ${HK_WHY[s.why] || ""}`
          : E.state === "walk" ? `Hộ tống sứ giả · còn ${Math.ceil(ENVOY_LEN - E.s)} m` : "Sứ giả chờ ở làng phía nam";
      }
      return { id, state: s.state, quyMo: K.quyMo === "lon" ? "Lớn" : "Nhỏ", name: K.name, word, detail: K.text, got: s.state === "thanhcong" ? K.hk : 0, hk: K.hk, label: K.label };
    });
  }

  // ---- Tổng Phản Công, cờ, Tuyệt Kỹ -------------------------------------------------------------------------------------------
  tryTPC() {
    const ctx = this.ctx, h = this.hero;
    if (ctx.hk.tpc) return false;
    if (!tpcReady(ctx.hk)) { this.say(`Hào Khí ${Math.floor(ctx.hk.value)}/100 — chưa đủ để kích Tổng Phản Công.`, 2); return false; }
    const T = hkActivate(ctx.hk);
    h.hkUltReady = true; this.plantFlag(h.x, h.z, 30, 0.3, T, true);
    ctx.cinematic?.("TỔNG PHẢN CÔNG", h, true); ctx.audio.play("drums3"); ctx.audio.play("horn"); ctx.audio.play("warcry");
    ctx.crowd.rout(h.x, h.z, 14, (e) => e.tier === "thuong");
    return true;
  }
  plantFlag(x, z, r, atk, dur, quiet = false) {
    const g0 = new THREE.Group(), y = heightAt(x, z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 5, 6), new THREE.MeshLambertMaterial({ color: 0x4a3626 })); pole.position.y = 2.5; g0.add(pole);
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 2.4), new THREE.MeshLambertMaterial({ map: flagTexture("破強敵報皇恩"), side: THREE.DoubleSide }));
    cloth.position.set(0.45, 3.6, 0); g0.add(cloth); g0.position.set(x, y, z); this.props.add(g0);
    this.flags.push({ x, z, r, atk, t: dur, g: g0 });
    this.ctx.fx.ring(x, z, r, COL.gold, 0.8);
    if (!quiet) { this.ctx.audio.play("drum"); this.ctx.audio.play("flag"); this.say(`Cắm cờ: quân ta trong ${r} m Công +${Math.round(atk * 100)}% trong ${dur} s.`, 3, "good"); }
  }
  dropProp(g0) {
    this.props.remove(g0);
    g0.traverse((m) => { m.geometry?.dispose(); const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : []; for (const x of mats) { x.map?.dispose(); x.dispose(); } });
  }
  updateFlags(dt) {
    for (const f of this.flags) { f.t -= dt; if (f.t <= 0) this.dropProp(f.g); }
    this.flags = this.flags.filter((f) => f.t > 0);
    const h = this.hero; h.buffs.flag = this.flags.find((f) => this.dist(h, f) < f.r)?.atk ?? 0;
  }
  ultQ() {}
  onUlt() {}
  onUltEnd() {}

  // ---- mục tiêu cho HUD --------------------------------------------------------------------------------------------------------
  objectivePoint() { const o = this.objectives()[0]; return o ? { x: o.x, z: o.z } : null; }
  // chỗ chờ khi phục kích còn treo: sau chỗ Toa Đô vào bãi kế tiếp 60 m dọc đường (ngoài 40 m lúc ông bước vào)
  waitPoint() { const id = nextBed(this.st); if (!id) return null; const p = along(ROUTE, BED_S[id] + 60); return { x: p.x, z: p.z }; }
  envoyTask() { const st = this.st, E = st.envoy; return st.ks.hoiKe.state === "khadung" && (E.state === "wait" || E.state === "walk") && this.unitUp(this.envoy); }
  objectives() {
    const st = this.st, P = (id, label, p, r) => ({ id, label, x: p.x, y: heightAt(p.x, p.z), z: p.z, r });
    if (this.over) return [];
    if (st.phase === 0) return [P("H31", "Hưng Đạo vương · chọn bãi lau", HUNG_DAO, 5)];
    const u = this.boss, bossP = u && u.alive && !u.dead ? P("X19", BOSS_B17.name, u, 6) : null;
    if (st.phase === 4) return [P("tan", "Tàn quân", st.arena || this.hero, REMNANTS.r * 0.4)];
    if (st.phase === 3) return bossP ? [bossP] : [];
    const K = st.ks.phucKich;
    if (K.state === "sansang") return bossP ? [{ ...bossP, label: this.fmt("Toa Đô trong bãi lau · {kesach}") }] : [];
    const out = [], k = st.outposts.findIndex((o) => !o.taken);
    if (k >= 0) out.push(P(OUTPOSTS[k].id, OUTPOSTS[k].name, OUTPOSTS[k], OUTPOSTS[k].r));
    if (this.envoyTask()) out.push(P("SUGIA", st.envoy.state === "walk" ? "Sứ giả · đi cạnh ông" : "Sứ giả · Kế Sách Nhỏ", this.envoy, 4));
    if (out.length) return out;
    if (K.state === "khadung" && nextBed(st)) { const w = this.waitPoint(); if (w) return [P("cho", "Chờ phục kích · đứng xa Toa Đô", w, 6)]; }
    return bossP ? [bossP] : [];
  }
  // vòng chiếm đang đứng trong (đồn chưa hạ) → { c, r } | null
  heldRing() {
    const st = this.st, h = this.hero;
    for (let i = 0; i < OUTPOSTS.length; i++) { const O = OUTPOSTS[i]; if (!st.outposts[i].taken && this.dist(h, O) <= O.r) return { c: O, r: O.r }; }
    return null;
  }
  // Nhãn thứ hai của HUD (như B16): còn ≤ 4 địch chặn vòng tướng đang đứng → con gần nhất
  blockers() {
    const R = this.heldRing(); if (!R) return [];
    const crowd = this.ctx.crowd, h = this.hero, list = [];
    for (const a of crowd.agents) if (a.side === "dich" && crowd.hittable(a) && this.dist(a, R.c) < R.r) list.push(a);
    for (const u of this.ctx.units) if (u.side === "dich" && u.alive && !u.dead && !u.retreating && this.dist(u, R.c) < R.r + u.radius) list.push(u);
    if (!list.length || list.length > 4) return [];
    const a = list.sort((p, q) => this.dist(p, h) - this.dist(q, h))[0];
    const label = a.isBig ? `${a.name} còn chặn` : a.unit === "CUNGKY_NG" ? "Cung kỵ còn chặn" : "Lính Nguyên còn chặn";
    return [{ id: "chan", label, x: a.x, y: heightAt(a.x, a.z), z: a.z, r: 2, ref: a }];
  }

  // ---- cổng (B17 không phá cổng: cổng bắc mở sẵn, cổng nam không dùng) ------------------------------------------------------
  damageGate(id) {
    if (this.ctx.openGates[id]) return;
    this.gateNag = (this.gateNag || 0) + 1;
    if (this.gateNag % 20 === 1) this.say("Không cần phá cổng này — cánh Toa Đô đi qua cổng bắc đang mở.", 3);
  }
  gateTarget() { return null; }
  goalText(short = false) {
    const st = this.st;
    if (st.phase !== 1 && st.phase !== 2) return null;
    const pct = Math.round((st.col.s / st.col.len) * 100);
    return short ? `Cánh Toa Đô ${pct}% đường` : `Cánh Toa Đô đã đi ${pct}% đường ra biển · đồn ${st.taken}/3`;
  }

  // ---- vòng lặp ------------------------------------------------------------------------------------------------------------------
  update(dt) {
    const ctx = this.ctx, st = this.st, h = this.hero;
    for (const m of this.msgs) m.t += dt; this.msgs = this.msgs.filter((m) => m.t < m.T);
    this.bq.update(dt);
    if (this.over) return;
    this.time += dt;
    this.reinf.cd = Math.max(0, this.reinf.cd - dt);
    if (hkTick(ctx.hk, dt)) this.say("Tổng Phản Công kết thúc.", 3);
    const ms = milestone(ctx.hk);
    if (ms > (this.lastMs || 0) && ms < 100) { this.banner(`HÀO KHÍ ${ms}`, "#f1d98a", 1); ctx.audio.play("drum"); }
    if (ms === 100 && this.lastMs !== 100) { this.banner("TỔNG PHẢN CÔNG SẴN SÀNG · {TPC}", "#ffd27a", 1.8); ctx.audio.play("drums3"); }
    this.lastMs = ms;

    this.stepPicker();
    const I = this.inp, u = this.boss, bossUp = !!u && u.alive && !u.dead, kg = this.king;
    I.hero.x = h.x; I.hero.z = h.z; I.hero.alive = h.alive;
    I.heroToBoss = bossUp ? this.dist(h, u) : this.dist(h, columnHead(st));
    I.engaged = bossUp && h.alive && I.heroToBoss < COLUMN.engageR;
    I.bossHalf = bossUp && !!u.hpLocked; I.bossDown = !!this.bossDown;
    I.wingsHold = st.bed ? this.wingsHold() : false;
    I.king.alive = !!kg && kg.alive && !kg.dead; if (kg) { I.king.x = kg.x; I.king.z = kg.z; I.king.hpPct = kg.hp / kg.maxHp * 100; }
    I.landUp = this.liveCount(this.landed); I.omaDown = !!this.omaDown; I.envoyDown = !!this.envoyDown;
    const ev = tickB17(st, I, dt);
    I.ksPress = false; I.pick = null;
    this.phase = st.phase;
    this.onEvents(ev);
    if (this.over) return;
    this.stepColumn();
    this.stepWings(dt);
    this.stepKing(dt);
    this.stepEnvoy();
    this.stepLanding(dt);
    this.stepYetKieu(dt);
    this.stepBoom();
    this.stepLeaving();
    this.updateFlags(dt);
    ctx.hud?.prompt?.(st.prompt ? st.prompt.text : st.ks.phucKich.state === "sansang" ? this.fmt(`Phục kích! {Act:kesach} · còn ${Math.ceil(st.ks.phucKich.left)} s`) : null,
      st.prompt?.p ?? (st.ks.phucKich.state === "sansang" ? st.ks.phucKich.left / st.ks.phucKich.window : 0));
    this.baseHint = this.hint();
    this.syncProps();
    this.syncBoats(dt);
    this.cullFar();
    this.topWidget();
  }
  // Đơn vị lớn xa camera quá FAR_UNIT m (Ô Mã Nhi ở bến khi tướng đánh đồn đầu, cánh Toa Đô ở cuối đường — cao vài điểm ảnh mà mỗi người 3–5 lượt vẽ)
  // thì ẩn rig; chỉ trình bày, không đổi mô phỏng. Người đang rút chạy tự nhấp nháy (units.js updateRetreat) nên bỏ qua.
  cullFar() {
    const c = this.ctx.camera?.position;
    if (!c) return;
    for (const u of this.ctx.units) { if (u.retreating || !u.rig?.root) continue; u.rig.root.visible = Math.hypot(u.x - c.x, u.z - c.z) < FAR_UNIT; }
  }
  // P1: bảng chọn bãi lau mở khi tướng đứng gần Hưng Đạo vương (đồng hồ trận ×0,2 khi bảng mở — hud.js); đi xa thì đóng
  stepPicker() {
    const hud = this.ctx.hud, h = this.hero;
    if (!hud?.picker) return;
    const want = this.st.phase === 0 && h.alive && this.dist(h, HUNG_DAO) < 16;
    if (want && !hud.pickerOpen) {
      this.pickerMine = true;
      hud.picker(BEDS.map((B) => ({ id: B.id, label: B.name, sub: B.sub, icon: "giuvung" })), (it) => this.pickBed(it.id), "Hưng Đạo vương: đặt phục binh ở đâu?");
    } else if (!want && hud.pickerOpen && this.pickerMine) { this.pickerMine = false; hud.picker(null); }
  }
  // chọn bãi (bảng chọn, hoặc bot): luật nhận ở bước kế
  pickBed(id) {
    if (this.st.phase !== 0 || !bedOf(id)) return false;
    this.inp.pick = id;
    if (this.ctx.hud?.pickerOpen && this.pickerMine) { this.pickerMine = false; this.ctx.hud.picker(null); }
    return true;
  }
  // Toa Đô, sĩ quan, lính hộ tống theo cánh
  stepColumn() {
    const st = this.st, C = st.col, u = this.boss, head = columnHead(st), v = C.halt ? 0 : columnSpeed(st);
    if (u && u.alive && !u.dead) {
      if (!C.stood) {
        u.floorPct = COLUMN.floorPct; u.home = { x: head.x, z: head.z };
        u.march = C.fight ? null : { x: head.x, z: head.z, v, yaw: head.yaw };
      } else {
        u.floorPct = 0; u.march = null; u.awake = true;
        if (st.arena) { u.home = { x: st.arena.x, z: st.arena.z }; u.leash = COLUMN.standLeash; }
      }
    }
    const h = this.hero;
    this.officers.forEach((o, k) => {
      if (!o.alive || o.dead) return;
      const q = this.officerPoint(k);
      o.home = { x: q.x, z: q.z }; o.leash = C.stood ? COLUMN.standLeash : 25;
      if (C.stood) { o.march = null; o.awake = true; return; }
      o.march = h.alive && o.awake && this.dist(o, h) < 10 ? null : { x: q.x, z: q.z, v, yaw: q.yaw };
    });
    for (const r of this.escorts) {
      if (!this.live(r) || r.a.fleeT > 0) continue;
      const q = this.slotPoint(r.k); r.a.sx = q.x; r.a.sz = q.z;
    }
  }
  stepWings(dt) {
    if ((this.aimT = (this.aimT || 0) - dt) <= 0) {
      this.aimT = 1; const o = this.chargePoint();
      for (const list of this.wings) for (const r of list) if (r.charge && this.live(r)) { r.a.sx = o.x; r.a.sz = o.z; }
    }
    // lính hộ tống tán loạn: chạy xa rồi bỏ khỏi trận
    if (this.scattered.length) {
      const h = this.hero;
      this.scattered = this.scattered.filter((r) => {
        if (!this.live(r)) return false;
        if (this.dist(r.a, h) > 45 && Math.hypot(r.a.x - r.a.sx, r.a.z - r.a.sz) < 8) { this.ctx.crowd.release(r.a); return false; }
        return true;
      });
    }
  }
  // quân giữ bến xuống thuyền theo Ô Mã Nhi: tới mép bến (hoặc xa tướng) thì rời trận
  stepLeaving() {
    if (!this.leaving.length) return;
    const h = this.hero;
    this.leaving = this.leaving.filter((r) => {
      if (!this.live(r)) return false;
      if (Math.hypot(r.a.x - r.a.sx, r.a.z - r.a.sz) < 4 || (this.dist(r.a, h) > 50 && r.a.fleeT <= 0)) { this.ctx.crowd.release(r.a); return false; }
      return true;
    });
  }
  hint() {
    const st = this.st, h = this.hero;
    const i = OUTPOSTS.findIndex((O, k) => !st.outposts[k].taken && this.dist(h, O) <= O.r);
    if (i >= 0) { const O = OUTPOSTS[i], o = st.outposts[i]; return o.blockedRing ? `${O.name}: dẹp quân giữ đồn trong vòng` : `${O.name}: chiếm đồn · còn ${secLeft(o, O.capSec)} s`; }
    if (st.phase === 0) return `Chọn bãi lau phục kích · còn ${Math.max(0, Math.ceil(AMBUSH.pickSec - st.phaseT))} s`;
    const K = st.ks.phucKich;
    if (K.state === "sansang") return this.fmt(`Phục kích: {kesach} · còn ${Math.ceil(K.left)} s`);
    if (st.king.mode !== "fight" && this.unitUp(this.king)) return st.king.mode === "fall" ? "Vua bị thương, lui về bản doanh" : `Vua hồi sức ở bản doanh · còn ${Math.ceil(st.king.healT)} s`;
    if (st.envoy.state === "walk" && this.envoyTask() && this.dist(h, envoyPos(st)) > ENVOY.near) return "Sứ giả đứng chờ: lại gần ông (15 m) để ông đi tiếp";
    if (st.phase === 1) {
      const id = nextBed(st), B = bedOf(id), near = K.state === "khadung" && B && BED_S[B.id] - st.col.s < 60;
      if (near && this.inp.heroToBoss < AMBUSH.revealR + 10) return `Toa Đô sắp vào ${B.name}: lùi xa ông ngoài 40 m`;
      if (this.boss?.hpLocked) return "Toa Đô đang khóa nửa Sinh lực: chỉ đứng lại khi đã vào bãi lau";
      return null;                                                            // goalText: % đường, số đồn
    }
    if (st.phase === 2) return K.state === "khadung" && nextBed(st) ? `Còn phục binh ở ${bedOf(nextBed(st)).name}: đứng xa Toa Đô` : "Đánh Toa Đô xuống nửa Sinh lực để chặn cánh";
    if (st.phase === 3) return this.boss?.lsOn ? "Chí Tử Chiến: tránh vòng đỏ, hạ Toa Đô" : routed(st) ? "Đội hình Nguyên vỡ — hạ Toa Đô trên gò" : "Toa Đô cố thủ trên gò — hạ ông";
    if (st.phase === 4) return `Dẹp tàn quân · còn ${Math.max(0, Math.ceil(REMNANTS.sec - st.phaseT))} s`;
    return null;
  }
  // thanh "Đường ra biển" dưới Hào Khí: % đường, vạch 3 đồn (đỏ khi ta đã hạ) và bãi lau có phục binh, trạng thái cánh; Sinh lực vua, thuyền qua mốc
  topWidget() {
    const hud = this.ctx.hud, st = this.st, C = st.col;
    if (!hud?.setTopWidget) return;
    if (st.phase === 0 || C.stood || this.over) { if (this.lastTop !== null) { this.lastTop = null; hud.setTopWidget(null); } return; }
    const pc = (s) => Math.max(0, Math.min(100, (s / C.len) * 100)).toFixed(1);
    const ticks = OUTPOSTS.map((O, i) => `<i style="position:absolute;left:${pc(routeS(ROUTE, O))}%;top:-3px;width:3px;height:14px;background:${st.outposts[i].taken ? "#c0392b" : "#3d5a78"}"></i>`).join("")
      + armedBeds(st).map((id) => `<i style="position:absolute;left:${pc(BED_S[id])}%;top:-2px;height:12px;width:${(70 / C.len * 100).toFixed(1)}%;background:rgba(110,140,62,${st.entered[id] ? ".3" : ".6"})"></i>`).join("");
    const halt = C.halt === "engage" ? "dừng giao chiến" : C.halt === "outpost" ? "bị đồn ta chặn" : "đang đi";
    const kg = this.king, kp = this.unitUp(kg) ? Math.round(kg.hp / kg.maxHp * 100) : 0;
    // hai dòng (ô dưới thanh Hào Khí hẹp tới ~126 px ở màn nhỏ): tên + thanh co giãn; trạng thái cánh, Sinh lực vua, thuyền thoát
    const html = `<div style="display:flex;align-items:center;gap:6px"><b style="white-space:nowrap">Đường ra biển</b><div style="position:relative;flex:1;max-width:170px;min-width:60px;height:8px;background:rgba(0,0,0,.45);border:1px solid rgba(241,217,138,.5);border-radius:4px">`
      + `<i style="position:absolute;left:0;top:0;bottom:0;width:${Math.round(C.s / C.len * 100)}%;background:#d0864a;border-radius:3px"></i>${ticks}</div></div>`
      + `<small>${halt} · tốc ×${C.mult.toFixed(2).replace(".", ",")} · <span style="color:${kp < KING.fallPct ? "#ff8a6a" : "#f1d98a"}">Vua ${kp}%</span>${st.pier.passed ? ` · <span style="color:#ff8a6a">${st.pier.passed} thuyền thoát</span>` : ""}</small>`;
    if (html !== this.lastTop) { this.lastTop = html; hud.setTopWidget(html); }
  }

  // ---- sự kiện luật → trận --------------------------------------------------------------------------------------------------
  onEvents(ev) {
    const ctx = this.ctx, st = this.st;
    for (const e of ev) {
      if (e.type === "bedPicked") {
        const B = bedOf(e.bed);
        this.say(e.auto ? `Hết giờ bàn kế: phục binh đặt ở ${B.name}.` : `Phục binh đặt ở ${B.name}. Giữ họ Giữ vững; khi Toa Đô tới gần bãi thì đứng xa ông ngoài 40 m.`, 6, "good");
        this.spawnWings(0);
      } else if (e.type === "bed2") {
        const B = bedOf(e.bed);
        this.spawnWings(1);
        this.say(`Hưng Đạo vương cho thêm 2 cánh phục binh ở ${B.name}: phục kích hỏng lần đầu thì còn lần thứ hai.`, 6, "good");
      } else if (e.type === "phase") {
        const P = PHASES[e.phase];
        if (e.phase > 1) this.hk(HAO_KHI.src.mainMission, "nhiệm vụ chính");
        this.banner(`${P.id} · ${P.name.toUpperCase()}`, "#e6dcc3", 2); ctx.audio.play("drums3");
        if (e.phase === 1) this.say(`${BOSS_B17.name} kéo cánh quân dọc đường đê ra cửa sông. Hạ 3 đồn để làm chậm cánh; vua Nhân Tông dẫn cánh chính đánh đồn cùng bạn.`, 6);
        if (e.phase === 2) this.say(this.fmt("Toa Đô đã vào bãi lau! {Act:kesach} để phục binh đánh úp."), 5);
        if (e.phase === 3) this.say("Toa Đô từ chối rút, lên gò cố thủ. Hạ ông!", 6);
        if (e.phase === 4) this.say("Toa Đô tử trận. Dẹp tàn quân quanh gò.", 6);
        this.phase = e.phase;
        this.saveCheckpoint();
      } else if (e.type === "outpostTaken") {
        const O = OUTPOSTS.find((o) => o.id === e.id);
        this.hk(O.hk, "hạ " + O.name); ctx.audio.play("cheer");
        this.banner(`HẠ ${O.name.toUpperCase()} · ${e.n}/3`, "#f1d98a", 1.4);
        this.say(`${e.by === "king" ? "Vua Nhân Tông hạ " + O.name + ". " : ""}Cánh Toa Đô chậm lại: tốc ×${st.col.mult.toFixed(2).replace(".", ",")}.`, 4, "good");
      } else if (e.type === "outpostBlock") {
        const O = OUTPOSTS.find((o) => o.id === e.id);
        this.say(`${O.name} của ta chặn đường: cánh Toa Đô phải dừng 15 giây.`, 4, "good");
      } else if (e.type === "engage") {
        if (!this.engagedOnce) { this.engagedOnce = true; this.say("Toa Đô dừng cánh để đánh bạn — chỉ giữ được ông tối đa 20 giây mỗi lượt.", 5); }
      } else if (e.type === "engageEnd") {
        this.say("Toa Đô bỏ giao chiến, thúc cánh đi tiếp!", 3.5, "bad"); ctx.audio.play("horn", this.boss?.x, this.boss?.z);
      } else if (e.type === "bedEnter") {
        this.banner("TOA ĐÔ VÀO BÃI LAU", "#e6dcc3", 1.4);
      } else if (e.type === "ksOpen") {
        this.banner("PHỤC KÍCH · {KESACH}", "#ffd27a", 1.8); ctx.audio.play("horn");
      } else if (e.type === "ksIdle") {
        this.say(e.state === "khadung" ? "Lệnh Kế Sách: chờ Toa Đô vào bãi lau có phục binh." : "Kế Sách Phục kích bãi lau đã dùng.", 3);
      } else if (e.type === "keSach" && e.id === "phucKich") {
        const K = KE_SACH.phucKich, gi = e.bed && e.bed === st.bed2 ? 1 : 0;
        if (e.ok) {
          this.hk(K.hk, "Kế Sách " + K.name); this.banner(`KẾ SÁCH · ${K.name.toUpperCase()}`, "#ffd27a", 1.8); ctx.audio.play("horn"); ctx.audio.play("drums3");
          this.say("Phục binh đánh úp: đội hình Nguyên vỡ, một nửa lính hộ tống tán loạn!", 5, "good");
          this.scatterEscorts(); this.weakenEscorts();
          this.groupDone = [true, true]; this.setWingOrder("xungtran", true, [0, 1]);
        } else {
          this.say(`Kế Sách ${K.name}: không thành — ${KS_WHY[e.why] || "lỡ thời cơ"}. Phục binh vẫn xông ra đánh.${e.rearm ? ` Còn phục binh ở ${bedOf(nextBed(st))?.name}: lùi xa Toa Đô, chờ ông vào đó.` : ""}`, 6, "bad");
          this.groupDone[gi] = true; this.setWingOrder("xungtran", true, [gi]);
        }
      } else if (e.type === "keSach" && e.id === "hoiKe") {
        const K = KE_SACH.hoiKe;
        if (e.ok) { this.hk(K.hk, "Kế Sách " + K.name); this.banner(`KẾ SÁCH · ${K.name.toUpperCase()}`, "#ffd27a", 1.6); ctx.audio.play("horn"); this.say("Sứ giả về tới bản doanh: Hưng Đạo vương hiến kế.", 4, "good"); }
        else this.say(`Kế Sách Nhỏ ${K.name}: không thành — ${HK_WHY[e.why] || ""}.`, 5, "bad");
      } else if (e.type === "envoyGo") {
        this.say("Sứ giả lên đường về bản doanh — đi cạnh ông (trong 15 m), ông mới đi.", 4);
      } else if (e.type === "intercept") {
        this.spawnInterceptors(e);
      } else if (e.type === "landing") {
        this.startLanding(e);
      } else if (e.type === "landingOff") {
        this.say("Đội hình vỡ: Toa Đô mất Phá Trận Thủy Bộ, thuyền Nguyên thôi đổ bộ.", 4, "good");
      } else if (e.type === "yetKieu") {
        this.spawnYetKieu(e);
      } else if (e.type === "boatLaunch") {
        this.say("Một thuyền tàn quân rời bến, chạy ra cửa sông — bắn chìm, móc kéo hoặc chặn dòng!", 4, "bad");
      } else if (e.type === "boatPassed") {
        this.say(`Thuyền tàn quân qua mốc cửa sông (${e.n}).`, 3.5, "bad"); ctx.audio.play("horn", PIER.mark.x, PIER.mark.z);
      } else if (e.type === "boatSunk" || e.type === "boatBurnt" || e.type === "boatCaught") {
        const p = boatPos(st, e.i), w = e.type === "boatSunk" ? "ĐÁNH CHÌM" : e.type === "boatBurnt" ? "ĐỐT" : "KÉO MẮC CẠN";
        this.hk(PIER.hk, "thuyền tàn quân", true); this.banner(`${w} THUYỀN TÀN QUÂN`, "#ffb07a", 0.9);
        if (e.type === "boatBurnt") ctx.fx.fire(p.x, 1.2, p.z, 30, 3.2);
        ctx.audio.play("gateBreak", p.x, p.z);
      } else if (e.type === "omaDriven") {
        this.banner("ĐUỔI Ô MÃ NHI", "#f1d98a", 1.6); ctx.audio.play("cheer");
        this.say(e.inTime ? "Ô Mã Nhi bỏ bến chạy xuống thuyền: bến thôi xuất thuyền." : "Ô Mã Nhi bỏ bến — nhưng đã quá 8:00.", 5, "good");
        this.abandonPier();
      } else if (e.type === "omaLeft") {
        this.say("Ô Mã Nhi thấy Toa Đô núng thế, bỏ bến ra biển.", 5, "bad");
        this.abandonPier();
      } else if (e.type === "kingFall") {
        this.say("Vua Nhân Tông bị thương nặng, lui về bản doanh hồi sức!", 4, "bad");
      } else if (e.type === "kingHeal") {
        this.say(`Vua về tới bản doanh, hồi sức ${KING.healSec} giây.`, 3);
      } else if (e.type === "kingBack") {
        this.say("Vua Nhân Tông lại dẫn cánh chính ra trận.", 3, "good");
      } else if (e.type === "stand") {
        this.banner(e.why === "half" ? "TOA ĐÔ ĐỨNG LẠI" : "ĐỘI HÌNH NGUYÊN VỠ", "#ff8a6a", 1.6);
        if (e.why === "half") this.say("Toa Đô núng thế, thôi đẩy cánh: ông lên gò gần nhất cố thủ.", 5, "good");
        if (e.why === "morale") { this.say("Quân Viễn Chinh kiệt sức, Sĩ Khí cạn: đội hình Nguyên vỡ, Toa Đô lên gò cố thủ.", 5, "good"); this.scatterEscorts(); }
      } else if (e.type === "moraleDrop") {
        if (e.morale > 0) this.say(`Quân Viễn Chinh mỏi mệt: Sĩ Khí cánh Toa Đô còn ${e.morale}.`, 3.5, "good");
        this.weakenEscorts();
      } else if (e.type === "win") this.win(e.why);
      else if (e.type === "lose") this.lose(e.why, true);
    }
  }
  // đội hình vỡ: một nửa lính hộ tống còn đứng bỏ chạy về phía sông rồi rời trận
  scatterEscorts() {
    const live = this.escorts.filter((r) => this.live(r)), ids = new Set(), keep = [];
    live.forEach((r, i) => {
      if (i % 2 === 0) { ids.add(r.id); r.a.role = "squad"; r.a.sx = r.a.x + (r.a.x < 462 ? -30 : 20); r.a.sz = -168; this.scattered.push(r); }
      else keep.push(r);
    });
    this.escorts = keep;
    if (live.length) this.ctx.crowd.rout(live[0].a.x, live[0].a.z, 60, (a) => ids.has(a.id));
  }

  // ---- móc từ lính, sĩ quan, tướng ---------------------------------------------------------------------------------------------
  onSoldierKilled(a, opt) {
    if (a.side !== "dich" || opt.by !== "hero") return;
    this.ko++;
    if (this.ko % HAO_KHI.src.koMilestoneEvery === 0 && this.koMs < HAO_KHI.src.koMilestoneCap) { this.koMs++; this.hk(HAO_KHI.src.koMilestone, "mốc KO"); }
  }
  onOfficerKilled(u) {
    const ctx = this.ctx;
    if (u.tier === "doitruong") this.hk(HAO_KHI.src.killCaptain, "hạ đội trưởng");
    if (u.tier === "photuong") this.hk(HAO_KHI.src.killVice, "hạ phó tướng");
    this.ko++;
    ctx.fx.banner(`ĐÃ HẠ ${TIERS[u.tier].name.toUpperCase()}`, "#e6dcc3", 1.2);
    ctx.slowmo?.(0.55, 0.28); ctx.fx.flash(0.4); ctx.audio.play("finisher", u.x, u.z); ctx.audio.play("cheer");
  }
  onOfficerAwake(u) {
    if (u === this.boss && !this.bossRoared) { this.bossRoared = true; this.ctx.fx.banner("TOA ĐÔ", "#ff8a6a", 1.4); this.ctx.audio.play("horn"); }
    if (u === this.oma && !this.omaRoared) { this.omaRoared = true; this.ctx.fx.banner("Ô MÃ NHI", "#ff8a6a", 1.2); this.say("Ô Mã Nhi giữ bến tàn quân. Đánh ông về 0 Sinh lực thì ông bỏ bến.", 4); }
  }
  // Toa Đô về 0 Sinh lực: tử trận (canon "bị giết"; BigUnit fate "killed" — ngã theo clip death, nằm lại). Camera lùi xa, chậm hình (ctx.cinematic),
  // băng chữ. Không máu me, không thủ cấp (canon B17.sensitivity).
  onBossKilled(u) {
    if (u !== this.boss || this.bossDown) return;
    this.bossDown = true; this.ko++;
    this.bq.clear(); this.ctx.cinematic?.("TOA ĐÔ TỬ TRẬN", u, true); this.ctx.audio.play("drums3");
    this.ctx.crowd.rout(u.x, u.z, 24);
    this.hk(15, "hạ Toa Đô");
  }
  onBossDefeated(u) {
    if (u === this.oma) { this.omaDown = true; this.ko++; this.hk(8, "đuổi Ô Mã Nhi", true); return; }      // Ô Mã Nhi: nhánh rút sẵn có (chạy xuống thuyền)
    if (u === this.boss) { u.retreating = false; u.dead = 0.001; u.killed = true; u.march = null; this.onBossKilled(u); }   // dự phòng: BigUnit không có fate
  }
  onCaptured(u) { this.onBossDefeated(u); }
  onLastStand(u) {
    if (u !== this.boss) return;
    this.banner("CHÍ TỬ CHIẾN", "#ff5a3a", 1.6); this.ctx.audio.play("horn", u.x, u.z);
    this.say("Toa Đô liều chết: Công +30%, cứ 8 giây bổ đại phủ xuống đất — tránh khỏi vòng đỏ, không đỡ được!", 6, "bad");
  }
  onCounterBoss() { if (this.counterBoss < HAO_KHI.src.counterBossMax) { this.counterBoss++; this.hk(HAO_KHI.src.counterBoss, "phản đòn Toa Đô"); } }
  onBreak(u) { this.ctx.fx.banner("VỠ THẾ · ĐÒN MẠNH ĐỂ RA ĐÒN QUYẾT", "#ffd27a", 1.2); this.ctx.audio.play("parry", u.x, u.z); }
  onHeroHit() {}
  onHeroAction() {}
  onRevive() { this.hk(HAO_KHI.src.reviveUsed, "gượng dậy"); this.revived = true; }
  onHeroDead() { if (!this.over) this.lose(`${this.heroName} gục ngã.`, true); }
  onAllyGeneralDown(u) {
    if (u === this.hungDao) this.say("Hưng Đạo vương bị thương, lui vào trong bản doanh.", 4, "bad");
    if (u === this.envoy) { this.envoyDown = true; this.say("Sứ giả gục ngã giữa đường!", 4, "bad"); }
    if (u === this.yk?.u) this.say("Yết Kiêu lặn mất dưới lạch.", 3);
  }
  killActor() {}
  fillActors() {}

  // ---- điểm lưu đầu pha, thắng thua --------------------------------------------------------------------------------------------
  saveCheckpoint() {
    const ctx = this.ctx, h = this.hero, kg = this.king;
    this.checkpoint = { st: snapshotB17(this.st), time: this.time, hk: clone(ctx.hk), ko: this.ko, koMs: this.koMs, revived: this.revived, counterBoss: this.counterBoss,
      reinf: { ...this.reinf }, wingOrder: this.wingOrder, groupDone: [...this.groupDone], groupOrder: [...this.groupOrder], omaDown: !!this.omaDown, envoyDown: !!this.envoyDown,
      king: this.unitUp(kg) ? { x: kg.x, z: kg.z, hp: kg.hp } : null, hero: { hp: h.hp, ki: h.ki, revives: h.revives, x: h.x, z: h.z } };
  }
  restoreCheckpoint() {
    const ctx = this.ctx, c = this.checkpoint, h = this.hero;
    for (const a of [...ctx.crowd.agents]) ctx.crowd.release(a);
    for (const u of ctx.units) if (u.alive) u.dispose();
    ctx.units.length = 0;
    for (const b of this.landBoats) this.hideBoat(b.slot);
    this.resetLists(); this.dropBoom(); h.dropShots?.();
    for (const f of this.flags) this.dropProp(f.g); this.flags = [];
    restoreB17(this.st, c.st); Object.assign(ctx.hk, clone(c.hk));
    this.bossDown = this.st.bossDown; this.counterBoss = c.counterBoss ?? 0; this.wingOrder = c.wingOrder || "giucho"; this.groupDone = [...(c.groupDone || [false, false])]; this.groupOrder = [...(c.groupOrder || ["giucho", "giucho"])];
    this.omaDown = c.omaDown; this.envoyDown = c.envoyDown; this.checkpointKing = c.king;
    this.phase = this.st.phase; this.time = c.time; this.ko = c.ko; this.koMs = c.koMs; this.revived = c.revived; this.reinf = { ...c.reinf };
    ctx.sim.reinf.charges = this.reinf.charges;
    this.inp.ksPress = false; this.inp.pick = null;
    h.alive = true; h.state = "free"; h.hp = Math.max(c.hero.hp, h.maxHp * HERO.retryHp); h.ki = c.hero.ki; h.revives = c.hero.revives; h.x = c.hero.x; h.z = c.hero.z; h.invuln = 2; h.lock = null;
    this.over = false; this.result = null; this.retries++;
    this.openGateA3();
    this.spawnHungDao();
    this.spawnPhase(this.st.phase);
    this.checkpointKing = null;
    this.boatVis = null; this.syncProps(); this.syncBoats(0); this.bq.clear(); this.lastTop = null;
    this.say(`Tải lại đầu pha ${PHASES[this.st.phase].id}.`, 3);
  }
  win(why) {
    if (this.over) return;
    this.over = true; this.ctx.hud?.prompt?.(null); this.ctx.hud?.setTopWidget?.(null);
    this.result = this.buildResult(true, why || "Quân Trần thắng ở Tây Kết.");
    this.bq.push("THẮNG TRẬN TÂY KẾT", "#f1d98a", 2); this.ctx.audio.play("victory");
  }
  lose(why, canRetry = true) {
    if (this.over) return;
    if (!this.st.over) simFinish(this.st, false, why);
    this.over = true; this.ctx.hud?.prompt?.(null); this.ctx.hud?.setTopWidget?.(null);
    if (this.ctx.hud?.pickerOpen && this.pickerMine) { this.pickerMine = false; this.ctx.hud.picker(null); }
    this.result = this.buildResult(false, why); this.result.canRetry = canRetry && !!this.checkpoint;
    this.ctx.audio.play("defeat");
  }
  buildResult(won, why) {
    const ctx = this.ctx, st = this.st, side = sideB17(st);
    const mainDone = st.main.filter(Boolean).length, sideDone = Object.values(side).filter(Boolean).length;
    const ks = this.ksHud(), ksOk = ks.filter((k) => k.state === "thanhcong").length;
    let allies = 0; for (const l of this.wings) allies += l.length;
    const alliesUp = this.wingsUp();
    return {
      battle: "B17", won, why, R: ctx.R, difficulty: ctx.diff.id, timeSec: this.time, mode: this.mode, parSec: PAR_B17,
      missions: (mainDone / 3) * 0.8 + (sideDone / SIDE_MISSIONS.length) * 0.2, mainDone, sideDone, missionsTotal: 3, sideTotal: SIDE_MISSIONS.length,
      qRatio: allies ? alliesUp / allies : 1, baseRatio: (st.taken / OUTPOSTS.length + (st.ks.phucKich.state === "thanhcong" ? 1 : 0) + (st.col.stood ? 1 : 0)) / 3,
      ko: this.ko, hkRaw: ctx.hk.rawTotal, hkOptional: ctx.hk.optional, hkLog: { ...ctx.hk.log },
      avgSK: 50, bossDefeated: !!this.bossDown, bossMet: !!this.bossMet, tpcCount: ctx.hk.tpcCount, chestCoins: 0, extraTT: 0,
      events: {}, eventNames: {}, orders: this.orders, items: 0,
      keSach: ks.reduce((s, k) => s + k.got, 0) / ks.reduce((s, k) => s + k.hk, 0), keSachOk: ksOk,
      keSachList: ks.map((k) => ({ id: k.id, state: k.state, name: k.name, word: k.word, got: k.got, hk: k.hk })),
      b17: { bed: st.bed, bed2: st.bed2, taken: st.taken, colPct: Math.round(st.col.s / st.col.len * 100), stood: st.col.standWhy, morale: st.col.morale, ks: st.ks.phucKich.state,
        ksWhy: st.ks.phucKich.why, hoiKe: st.ks.hoiKe.state, oma: st.oma.state, boatsPassed: st.pier.passed, boatsLost: st.pier.lost, landings: st.land.n, king: st.king.mode, side },
    };
  }
  bedDist() {
    const h = this.hero; let d = 999;
    for (const a of this.ctx.crowd.agents) if (a.side === "dich" && this.alive(a)) d = Math.min(d, Math.hypot(a.x - h.x, a.z - h.z));
    return d;
  }
  // Vật của trận ở lại trong scene (battle.js releaseGpu duyệt scene và giải phóng). Lớp phủ bùn, gò do battles/b17.js dispose gỡ.
  dispose() { if (this.ctx.hud?.pickerOpen && this.pickerMine) this.ctx.hud.picker(null); }
}
