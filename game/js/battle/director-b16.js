// battle/director-b16.js — bộ điều phối B16 Chương Dương (bản thử đợt 1): luật thuần ở sim/b16.js, file này sinh lính, sĩ quan, Thoát Hoan,
// dựng vật của trận (thuyền neo, xe húc, vòng làng / bến / điện, cờ), đổi sự kiện của luật thành băng chữ, Hào Khí, tiếng, và giữ giao diện
// director mà battle.js, hud.js, hero.js, hero-skills.js, crowd.js, units.js gọi (như director.js của B15 và director-td.js của Tự do):
// phase, time, over, result, msgs, events, keSach{hud,trigger}, pickups, flags, M, ko, objectives, damageGate, gateTarget, goalText,
// order / ringItems / ringTargets (dân binh), tryTPC, plantFlag, ultQ, lose, restoreCheckpoint, fillActors, các móc on*.
//
// Dựng trên đất Hàm Tử của B15 (battles/b16.js). Mọi số ở đây là ĐỀ XUẤT BẢN THỬ.

import * as THREE from "three";
import { BigUnit } from "./units.js";
import { heightAt } from "./world.js";
import { BannerQueue } from "./banner-queue.js";
import { flagTexture, lambert, merge } from "./models.js";
import { envPart } from "./glb.js";
import { gateTarget as pickGate, gatePct } from "./gatebar.js";
import { gain, tick as hkTick, activate as hkActivate, tpcReady, milestone } from "../sim/haokhi.js";
import { HAO_KHI, TIERS, MODES, HERO, S } from "../data/tuning.js";
import { createB16, tickB16, damageGateB16, damageBannerB16, bossFloorB16, noteSquadCleared, sideB16, snapshotB16, restoreB16, along, secLeft, finish as simFinish } from "../sim/b16.js";
import { VILLAGES, BOATS, BOAT_RULE, LANDING, RAM, GATES, GATE_SOUTH, GATE_EAST, PALACE, BOSS_B16, PHASES, KE_SACH, KS_ORDER, REINF, PAR_B16,
  REEDS, DYKE, DEPOTS, DEPOT_RULE, SQUADS, COUNTER, BANNERS, BANNER_RULE } from "../data/battle-b16.js";

const COL = { ta: 0x9b2d20, dich: 0x2c3e55, gold: 0xf1d98a, ring: 0xffffff };
const BOAT_FAR = 60;               // thuyền neo (mẫu): từ đây vẽ mức xa LOD1 (frameBoats)
const PUSH = { gap: 1.6, back: 2.4, pullR: 3.2, respawn: 5 };       // người đẩy xe húc: khoảng cách, đứng sau xe, tầm "đang đẩy", hồi người mới (giây)
const RING_ITEMS = [
  { k: "theota", name: "Theo ta", icon: "theota" },
  { k: "xungtran", name: "Xung trận", icon: "tiencong" },
  { k: "giucho", name: "Giữ chỗ", icon: "giuvung" },
  { k: "tiepvien", name: "Gọi tiếp viện", icon: "tiepvien" },
];
const clone = (o) => JSON.parse(JSON.stringify(o));

export class DirectorB16 {
  constructor(ctx) {
    this.ctx = ctx; ctx.director = this;
    this.mode = ctx.mode || "nhanh";
    this.st = createB16({ S: S(ctx.R), timeout: MODES[this.mode].timeout, ksWin: this.mode === "nhanh" ? 0.75 : 1 });
    this.phase = 0; this.time = 0; this.over = false; this.result = null; this.retries = 0;
    this.msgs = []; this.events = {}; this.pickups = []; this.flags = []; this.generals = {};
    this.M = { par: PAR_B16, timeout: this.st.timeout };
    this.ko = 0; this.koMs = 0; this.orders = 0; this.revived = false; this.counterBoss = 0;
    this.lastFront = null; this.baseHint = null; this.gateHit = null;
    this.bq = new BannerQueue((t, c, T) => ctx.fx.banner(t, c, T));
    this.keSach = { list: [], hud: () => this.ksHud(), trigger: () => this.say("Kế Sách của trận này tự xét theo việc bạn làm — xem bảng Kế Sách.", 3) };
    this.reinf = { charges: REINF.charges, cd: 0 };
    ctx.sim.reinf = { charges: this.reinf.charges, pending: [] }; ctx.sim.cooldowns = {};
    this.ringTarget = "all"; this.militiaOrder = "theota";
    this.resetLists();
    // đầu vào luật mỗi bước (sim/b16.js tickB16): một đối tượng dùng lại, hàm gắn một lần
    this.inp = { hero: { x: 0, z: 0, alive: true }, ramMoving: false, bossDown: false, landingDef: 0, counterLeft: 0,
      foesAt: (x, z, r) => this.foesAt(x, z, r), torchesAt: (i) => this.torchesAt(i) };
    this.props = new THREE.Group(); ctx.scene.add(this.props);
    this.buildProps();
    this.spawnPhase(0);
    this.say("Dân binh các lộ chờ hiệu lệnh: tới làng có vòng vàng để gọi họ.", 7);
    this.bq.push("CHƯƠNG DƯƠNG", "#f1d98a", 1.6);
    ctx.audio.play("drum");
    this.saveCheckpoint();
  }

  // ---- tiện ích ---------------------------------------------------------------------------------------------------------------
  say(text, T = 4, kind = "info") { this.msgs.push({ text, T, kind, t: 0 }); }
  banner(text, color = "#f1d98a", T = 1.2) { this.bq.push(text, color, T); }
  get hero() { return this.ctx.hero; }
  hk(v, src, optional = false) { const g = gain(this.ctx.hk, v, src, { optional }); if (g && Math.abs(g) >= 0.5) this.ctx.hud?.hkPulse?.(g); return g; }
  alive(a) { return this.ctx.crowd.hittable(a); }
  // Crowd dùng lại đối tượng lính đã chết (crowd.js spawn / release: bể free) và không xoá trường của director. Mọi danh sách lính của B16
  // vì thế giữ { a, id } (id cấp mới mỗi lần spawn): live(r) chỉ đúng khi đối tượng vẫn là con lính lúc thêm vào và còn đánh được.
  ref(a, extra) { return { a, id: a.id, ...extra }; }
  live(r) { return r.a.id === r.id && this.alive(r.a); }
  liveCount(list) { let n = 0; for (const r of list) if (this.live(r)) n++; return n; }
  resetLists() {
    this.militia = []; this.pushers = []; this.torches = []; this.counterUnits = []; this.landGuard = []; this.hunters = [];
    this.squads = new Map(); this.squadOf = new Map();                   // ô đội (slot) → [ref]; id lính → ô đội
  }
  dist(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }
  foesAt(x, z, r) {
    let n = 0;
    for (const a of this.ctx.crowd.agents) if (a.side === "dich" && this.alive(a) && Math.hypot(a.x - x, a.z - z) < r) n++;
    for (const u of this.ctx.units) if (u.side === "dich" && u.alive && !u.dead && !u.retreating && Math.hypot(u.x - x, u.z - z) < r + u.radius) n++;
    return n;
  }
  enemyUnit() { return this.ctx.rng.chance(0.25) ? "CUNGKY_NG" : "KHIEN_NG"; }
  spawnEnemy(x, z, { role = "garrison", anchor = null, elite = 0.08, tx = x, tz = z } = {}) {
    const ctx = this.ctx;
    return ctx.crowd.spawn({ side: "dich", unit: this.enemyUnit(), tier: ctx.rng.chance(elite) ? "tinhnhue" : "thuong", role, front: null,
      x, z, sx: tx, sz: tz, yaw: Math.atan2(tx - x, tz - z), anchor });
  }
  // toán giữ chỗ: n lính quanh c trong vòng r, dây xích anchor r + pad
  spawnHold(c, n, r, { pad = 6, elite = 0.08 } = {}) {
    const rng = this.ctx.rng, out = [];
    for (let i = 0; i < n; i++) { const a = rng.range(0, Math.PI * 2), d = rng.range(1, r); out.push(this.spawnEnemy(c.x + Math.cos(a) * d, c.z + Math.sin(a) * d, { anchor: { x: c.x, z: c.z, r: r + pad }, elite })); }
    return out;
  }
  // một đội giữ bến ở ô `slot` (Đoạt Giáo): hạ hết người của đội là tước được đội đó; ô đã tước (st.squadsDone) không sinh lại khi tải lại điểm lưu
  spawnSquad(slot, c, n, r, opts) {
    const list = this.spawnHold(c, n, r, opts).map((a) => this.ref(a));
    for (const x of list) this.squadOf.set(x.id, slot);
    this.squads.set(slot, list);
    return list;
  }
  spawnMilitia(x, z, n, role = this.militiaRole()) {
    const ctx = this.ctx, rng = ctx.rng, out = [], o = this.militiaOrder === "xungtran" ? this.objectivePoint() || this.hero : null;
    for (let i = 0; i < n; i++) {
      const a = ctx.crowd.spawn({ side: "ta", unit: "GIAO_DV", role, front: null, x: x + rng.range(-3, 3), z: z + rng.range(-3, 3), legionMult: ctx.stats.legionMult ?? 1 });
      this.aimMilitia(a, o); this.militia.push(this.ref(a)); out.push(a);
    }
    return out;
  }
  spawnOfficer(tier, x, z, { awake = false, aggro = 22, name = null, kind = "officer", rigKey } = {}) {
    const u = new BigUnit(this.ctx, { kind, side: "dich", tier, name: name || `${TIERS[tier].name} Nguyên`, x, z, awake, aggro, ...(rigKey ? { rigKey } : {}) });
    u.home = { x, z }; u.retreatTo = { x: BOSS_B16.retreatTo.x, z: BOSS_B16.retreatTo.z };
    this.ctx.units.push(u);
    return u;
  }

  // ---- vật của trận ----------------------------------------------------------------------------------------------------------
  // vòng, cung trên đất: trong suốt hai mặt mà phẳng — một lượt vẽ (forceSinglePass; three mặc định hai lượt: mặt sau, mặt trước)
  ringMesh(c, r, color = COL.ring, op = 0.55) {
    const m = new THREE.Mesh(new THREE.RingGeometry(r - 0.4, r, 56), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, side: THREE.DoubleSide, depthWrite: false, forceSinglePass: true }));
    m.rotation.x = -Math.PI / 2; m.position.set(c.x, heightAt(c.x, c.z) + 0.14, c.z); this.props.add(m);
    return m;
  }
  // cung tiến độ vàng trên đất, chạy vòng trong vòng chiếm (như vòng Cứ Điểm B15 — world.js setBaseProgress): đầy dần khi đứng giữ
  arcMesh(c, r) {
    const m = new THREE.Mesh(new THREE.RingGeometry(r - 1.3, r - 0.5, 56, 1, Math.PI / 2, 0.001),
      new THREE.MeshBasicMaterial({ color: COL.gold, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, forceSinglePass: true }));
    m.rotation.x = -Math.PI / 2; m.position.set(c.x, heightAt(c.x, c.z) + 0.16, c.z); this.props.add(m);
    m.userData = { r, p: 0 }; m.visible = false;
    return m;
  }
  setArc(m, p, on) {
    m.visible = on && p > 0.005;
    if (!m.visible || Math.abs(p - m.userData.p) < 0.01) return;
    m.userData.p = p; m.geometry.dispose();
    m.geometry = new THREE.RingGeometry(m.userData.r - 1.3, m.userData.r - 0.5, 56, 1, Math.PI / 2, Math.max(0.001, Math.min(1, p) * Math.PI * 2));
  }
  flag(p, color, h = 7, text = null) {
    const g = new THREE.Group(), y = heightAt(p.x, p.z), env = envPart("ENV_cot_co", { s: h / 9 });          // cột mẫu cao 9 m (đế gỗ), không có thì trụ
    const pole = env ? new THREE.Mesh(env, this.envMat()) : new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, h, 6), new THREE.MeshLambertMaterial({ color: 0x4a3626 }));
    if (!env) pole.position.y = h / 2;
    g.add(pole);
    const cloth = new THREE.Mesh(text ? new THREE.PlaneGeometry(0.8, 2.4) : new THREE.PlaneGeometry(1.8, 1.1),
      new THREE.MeshLambertMaterial(text ? { map: flagTexture(text), side: THREE.DoubleSide } : { color, side: THREE.DoubleSide }));
    cloth.position.set(text ? 0.45 : 0.92, h - (text ? 1.4 : 0.7), 0); g.add(cloth);
    g.position.set(p.x, y, p.z); this.props.add(g); g.cloth = cloth;
    return g;
  }
  // vật liệu màu đỉnh phẳng cho mô hình môi trường nướng (glb.js envPart: thuyền, cột cờ, bao lương), như lưới tĩnh của world.js
  envMat() { return (this._envMat ||= lambert()); }
  buildProps() {
    const P = this.props, wood = new THREE.MeshLambertMaterial({ color: 0x5a3d26 }), dark = new THREE.MeshLambertMaterial({ color: 0x2a2018 });
    const sail = new THREE.MeshLambertMaterial({ color: 0xc9b98f }), roof = new THREE.MeshLambertMaterial({ color: 0x8f7a4a }), wall = new THREE.MeshLambertMaterial({ color: 0xa08560 });
    const box = (w, h, d, m, x, y, z, ry = 0) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.rotation.y = ry; b.castShadow = true; return b; };
    // làng: vòng, cờ, mấy nếp nhà (làng V2 đã có nhà của world.js)
    this.vRings = VILLAGES.map((V) => this.ringMesh(V, V.r, COL.gold, 0.7));
    this.vArcs = VILLAGES.map((V) => this.arcMesh(V, V.r));
    this.vFlags = VILLAGES.map((V) => this.flag({ x: V.x + V.r * 0.4, z: V.z - V.r * 0.4 }, 0x8a6a3a, 6));
    for (const V of VILLAGES) {
      if (V.id === "V2") continue;
      [[-9, -6, 0.3], [8, -8, -0.2], [-6, 9, 0.6], [10, 6, 0.1]].forEach(([dx, dz, ry]) => {
        const x = V.x + dx, z = V.z + dz, y = heightAt(x, z);
        P.add(box(3.4, 2.2, 2.6, wall, x, y + 1.1, z, ry));
        const r = new THREE.Mesh(new THREE.ConeGeometry(2.8, 1.8, 4), roof); r.position.set(x, y + 3.1, z); r.rotation.y = ry + Math.PI / 4; r.scale.x = 1.25; r.castShadow = true; P.add(r);
      });
    }
    // 12 thuyền neo: mẫu ENV_thuyen_song_nguyen (gốc ở mớn nước) tách thân / cột buồm ở 1,9 m — thuyền cháy giữ thân cháy đen, mất cột buồm.
    // Vẽ theo lô: mỗi phần (thân, buồm, thân cháy) × mức (gần LOD0, từ BOAT_FAR m LOD1) một InstancedMesh, frameBoats() xếp thuyền vào lô theo
    // khoảng cách camera như THREE.LOD — tối đa 6 lượt vẽ cho cả bến. Trước đây mỗi thuyền hai THREE.LOD: tới 24 lượt vẽ và ngần ấy lượt bóng
    // (đỉnh B16 161 lượt vẽ, trần 150). Chưa nạp mẫu: khối code mỗi thuyền một nhóm như cũ.
    const boatId = "ENV_thuyen_song_nguyen", cuts = envPart(boatId) && [{ y1: 1.9 }, { y0: 1.9 }].map((cut) => [envPart(boatId, { cut }), envPart(boatId, { cut, lod: 1 })]);
    if (cuts) {
      this.charMat ||= new THREE.MeshLambertMaterial({ color: 0x1e1814 });
      const lot = (geo, mat) => { const m = new THREE.InstancedMesh(geo, mat, BOATS.length); m.count = 0; m.castShadow = true; P.add(m); return m; };
      this.boatLots = { hull: cuts[0].map((g) => lot(g, this.envMat())), sail: cuts[1].map((g) => lot(g, this.envMat())), burnt: cuts[0].map((g) => lot(g, this.charMat)) };
      this.boatAt = BOATS.map((B) => ({ p: new THREE.Vector3(B.x, 0.3, B.z), m: new THREE.Matrix4().compose(new THREE.Vector3(B.x, 0.3, B.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, B.yaw, 0)), new THREE.Vector3(1, 1, 1)) }));
      this.boatKey = "";
    }
    this.boatMesh = cuts ? [] : BOATS.map((B) => {
      const g = new THREE.Group();
      g.add(box(3.2, 1.1, 10, wood, 0, 0.55, 0), box(2.6, 0.9, 3.2, wood, 0, 1.5, -2.6));
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 7, 5), dark); mast.position.set(0, 4.4, 0.6); g.add(mast);
      const s = box(0.08, 3.8, 3.2, sail, 0, 5, 0.6); g.add(s); g.sail = s;
      g.position.set(B.x, 0.1, B.z); g.rotation.y = B.yaw; P.add(g);
      g.traverse((m) => { if (m.isMesh) m.userData.mat0 = m.material; });
      return g;
    });
    this.landRing = this.ringMesh(LANDING, LANDING.r, COL.ring, 0.45);
    this.landArc = this.arcMesh(LANDING, LANDING.r);
    this.landFlag = this.flag({ x: LANDING.x + 4, z: LANDING.z + 4 }, COL.dich, 9);
    // xe húc: thân gỗ có mái, cây gỗ húc
    const ram = new THREE.Group();
    ram.add(box(2.2, 0.8, 4.4, wood, 0, 0.9, 0));
    const rf = box(2.6, 0.18, 4.8, roof, 0, 2.3, 0); rf.rotation.z = 0; ram.add(rf);
    for (const sx of [-1, 1]) for (const sz of [-1.8, 1.8]) ram.add(box(0.16, 1.5, 0.16, wood, sx * 1.1, 1.6, sz));
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 5.4, 8), dark); log.rotation.x = Math.PI / 2; log.position.set(0, 1.5, 0.5); ram.add(log); ram.log = log;
    for (const sx of [-1, 1]) for (const sz of [-1.5, 1.5]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.14, 10), dark); w.rotation.z = Math.PI / 2; w.position.set(sx * 1.2, 0.5, sz); ram.add(w); }
    ram.visible = false; P.add(ram); this.ramMesh = ram;
    // điện chính: nền, thân, mái hai tầng
    const pc = PALACE, py = heightAt(pc.x, pc.z), red = new THREE.MeshLambertMaterial({ color: 0x7a2a1e }), tile = new THREE.MeshLambertMaterial({ color: 0x4a3a2e });
    P.add(box(22, 1.2, 14, new THREE.MeshLambertMaterial({ color: 0x9a8a70 }), pc.x, py + 0.6, pc.z - 10));
    P.add(box(18, 5, 10, red, pc.x, py + 3.7, pc.z - 10));
    const r1 = new THREE.Mesh(new THREE.ConeGeometry(14, 3.2, 4), tile); r1.position.set(pc.x, py + 7.6, pc.z - 10); r1.rotation.y = Math.PI / 4; r1.scale.set(1.35, 1, 0.75); r1.castShadow = true; P.add(r1);
    const r2 = new THREE.Mesh(new THREE.ConeGeometry(9, 2.4, 4), tile); r2.position.set(pc.x, py + 9.6, pc.z - 10); r2.rotation.y = Math.PI / 4; r2.scale.set(1.35, 1, 0.75); r2.castShadow = true; P.add(r2);
    this.palRing = this.ringMesh(PALACE, PALACE.r, COL.ring, 0.45);
    this.palArc = this.arcMesh(PALACE, PALACE.r);
    this.palFlag = this.flag({ x: PALACE.x + 6, z: PALACE.z + 5 }, COL.dich, 11);
    this.ctx.world.colliders.push({ x0: pc.x - 9, z0: pc.z - 10, x1: pc.x + 9, z1: pc.z - 10, r: 5.2 });      // thân điện (đoạn dày 10,4 m)
    // lau sậy dày hai bên cầu bến (lối lẻn vào), đê đất phía nam bến (đi trên đê là bị thấy). Lau giữ nón code: mẫu ENV_lau_say mức xa 34 tam giác ×
    // 1.406 khóm = 47,8 nghìn (nón 8 tam giác: 11,2 nghìn) — gấp 4,3 lần cho một bãi lau
    const reedMat = new THREE.MeshLambertMaterial({ color: 0x8a8a4a }), reedGeo = new THREE.ConeGeometry(0.22, 2.6, 4);
    let nReed = 0; for (const R of REEDS) nReed += Math.floor(((R.x1 - R.x0) * (R.z1 - R.z0)) / 2.2);
    const reeds = new THREE.InstancedMesh(reedGeo, reedMat, nReed), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    let k = 0, seed = 1616;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);        // không dùng ctx.rng: vật trang trí không đổi thứ tự rút của trận
    for (const R of REEDS) for (let i = 0, n = Math.floor(((R.x1 - R.x0) * (R.z1 - R.z0)) / 2.2); i < n; i++) {
      const x = R.x0 + rnd() * (R.x1 - R.x0), z = R.z0 + rnd() * (R.z1 - R.z0), s = 0.8 + rnd() * 0.6;
      e.set((rnd() - 0.5) * 0.25, rnd() * 6, (rnd() - 0.5) * 0.25); q.setFromEuler(e); v.set(x, Math.max(heightAt(x, z), -0.2) + 1.2 * s, z); sc.set(s, s, s);
      m4.compose(v, q, sc); reeds.setMatrixAt(k++, m4);
    }
    reeds.count = k; P.add(reeds);
    const dk = DYKE, dy = heightAt((dk.x0 + dk.x1) / 2, (dk.z0 + dk.z1) / 2);
    // mặt đê chỉ là hình (thấp 0,5 m, không va chạm): đi lên là báo động (sim/b16.js)
    const dyke = new THREE.Mesh(new THREE.BoxGeometry(dk.x1 - dk.x0, dk.h * 0.45, dk.z1 - dk.z0), new THREE.MeshLambertMaterial({ color: 0x9a7a52 }));
    dyke.position.set((dk.x0 + dk.x1) / 2, dy + dk.h * 0.2, (dk.z0 + dk.z1) / 2); dyke.receiveShadow = true; P.add(dyke);
    // kho quân nhu: đống bao, mái che, cờ
    // đống bao: 6 đống mẫu ENV_bao_gao (1,2 × 0,75 m) ×1,15 dưới, 2 đống trên — cùng chỗ hai khối bao code (4,2 × 3 m, cao 2,4 m)
    const sack = new THREE.MeshLambertMaterial({ color: 0xb59a68 });
    const pile = envPart("ENV_bao_gao") && merge([...[-1.4, 0, 1.4].flatMap((x) => [-0.75, 0.75].map((z) => envPart("ENV_bao_gao", { x, z, s: 1.15, ry: (x + z) * 2 }))),
      envPart("ENV_bao_gao", { x: -0.7, y: 0.75, s: 1.2, ry: 1.4 }), envPart("ENV_bao_gao", { x: 0.7, y: 0.75, s: 1.2, ry: -1.7 })]);
    // đống bao, bốn cột, mái gộp một lưới màu đỉnh (envMat như thuyền; màu đỉnh = màu vật liệu khối cũ) — một lượt vẽ thay sáu mỗi kho; kho cháy vẫn
    // đổi cả lưới sang charMat như trước (mọi phần của kho đều đổi)
    const tinted = (geo, color, x, y, z) => {
      const g = geo.toNonIndexed(), c = new THREE.Color(color), n = g.attributes.position.count, cc = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) cc.set([c.r, c.g, c.b], i * 3);
      g.translate(x, y, z); g.setAttribute("color", new THREE.BufferAttribute(cc, 3));
      return g;
    };
    const depotGeo = merge([...(pile ? [pile] : [tinted(new THREE.BoxGeometry(4.2, 1.4, 3), sack.color, 0, 0.7, 0), tinted(new THREE.BoxGeometry(3.2, 1, 2.2), sack.color, 0, 1.9, 0)]),
      ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => tinted(new THREE.BoxGeometry(0.16, 3.2, 0.16), wood.color, sx * 2.4, 1.6, sz * 1.8))),
      tinted(new THREE.BoxGeometry(5.2, 0.15, 4), roof.color, 0, 3.25, 0)]);
    this.depotMesh = DEPOTS.map((D) => {
      const g = new THREE.Group(), y = heightAt(D.x, D.z), m = new THREE.Mesh(depotGeo, this.envMat());
      m.castShadow = true; g.add(m);
      g.position.set(D.x, y, D.z); P.add(g);
      for (const m of g.children) m.userData.mat0 = m.material;
      return g;
    });
    // Vương Kỳ Trấn Nam: cột cao, cờ vàng chữ 鎮南
    this.bannerMesh = BANNERS.map((B) => {
      const g = new THREE.Group();
      const env = envPart("ENV_cot_co", { s: 1.05 }), pole = env ? new THREE.Mesh(env, this.envMat()) : new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 9, 6), dark);
      if (!env) pole.position.y = 4.5;
      g.add(pole);
      const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 3.6), new THREE.MeshLambertMaterial({ map: flagTexture("鎮南王"), color: 0xffe08a, side: THREE.DoubleSide }));
      cloth.position.set(0.75, 6.8, 0); g.add(cloth);
      g.position.set(B.x, heightAt(B.x, B.z), B.z); g.visible = false; P.add(g);
      return g;
    });
    this.syncProps();
  }
  // vật theo trạng thái luật (gọi mỗi bước và sau khi tải lại)
  syncProps() {
    const st = this.st;
    VILLAGES.forEach((V, i) => {
      const v = st.villages[i], on = !v.done && st.phase <= 1;
      this.vRings[i].visible = on; this.vRings[i].material.color.set(v.blocked ? 0xff5a3a : COL.gold);
      this.setArc(this.vArcs[i], v.p, on);
      this.vFlags[i].cloth.material.color.set(v.done ? COL.ta : 0x8a6a3a);
    });
    if (this.boatLots) this.frameBoats();
    else BOATS.forEach((B, i) => {
      const g = this.boatMesh[i], burnt = st.boats[i].burnt;
      g.sail.visible = !burnt;
      if (g.burnt === burnt) return;
      g.burnt = burnt; this.charMat ||= new THREE.MeshLambertMaterial({ color: 0x1e1814 });
      for (const c of g.children) if (c !== g.sail) c.traverse((m) => { if (m.isMesh) m.material = burnt ? this.charMat : m.userData.mat0; });
    });
    this.landRing.visible = st.phase === 1 && st.burnt >= BOATS.length;
    this.setArc(this.landArc, st.landing.p, this.landRing.visible);
    this.landFlag.cloth.material.color.set(st.landing.taken ? COL.ta : COL.dich);
    DEPOTS.forEach((D, i) => {
      const g = this.depotMesh[i], burnt = st.depots[i].burnt;
      if (g.burnt === burnt) return;
      g.burnt = burnt; this.charMat ||= new THREE.MeshLambertMaterial({ color: 0x1e1814 });
      for (const m of g.children) m.material = burnt ? this.charMat : m.userData.mat0;
    });
    BANNERS.forEach((B, i) => { const g = this.bannerMesh[i], b = st.banners[i]; g.visible = st.phase >= 3 && !b.down; });
    this.palRing.visible = st.phase === 4;
    this.setArc(this.palArc, st.palace.p, this.palRing.visible);
    this.palFlag.cloth.material.color.set(st.palace.taken ? COL.ta : COL.dich);
    this.ramMesh.visible = st.phase >= 2;
    for (const id of [GATE_SOUTH, GATE_EAST]) if (st.gates[id].open && !this.ctx.openGates[id]) this.openGateVisual(id, true);
  }

  // Thuyền neo (mẫu) vào lô: thuyền cháy → thân cháy, còn lại → thân + buồm; mức xa khi camera cách gốc thuyền ≥ BOAT_FAR (như THREE.LOD cũ:
  // khoảng cách tới gốc, không trễ). Mỗi khung (BattleDef.frameVisuals, sau khi đặt camera) và mỗi lần đồng bộ trạng thái; chỉ ghi lại khi có
  // thuyền đổi lô (hình cầu bao của lô tính lại theo các bản đang dùng — bóng, khung nhìn loại theo đó).
  frameBoats() {
    const L = this.boatLots; if (!L) return;
    const cam = this.ctx.camera.position, st = this.st;
    let key = "";
    for (let i = 0; i < BOATS.length; i++) key += (st.boats[i].burnt ? "b" : "h") + (cam.distanceTo(this.boatAt[i].p) >= BOAT_FAR ? 1 : 0);
    if (key === this.boatKey) return;
    this.boatKey = key;
    const n = { hull: [0, 0], sail: [0, 0], burnt: [0, 0] };
    for (let i = 0; i < BOATS.length; i++) {
      const l = +key[i * 2 + 1], M = this.boatAt[i].m;
      if (key[i * 2] === "b") L.burnt[l].setMatrixAt(n.burnt[l]++, M);
      else { L.hull[l].setMatrixAt(n.hull[l]++, M); L.sail[l].setMatrixAt(n.sail[l]++, M); }
    }
    for (const k in L) L[k].forEach((m, l) => { m.count = n[k][l]; m.instanceMatrix.needsUpdate = true; if (m.count) m.computeBoundingSphere(); });
  }

  // ---- sinh lính theo pha (cả khi tải lại điểm lưu) ----------------------------------------------------------------------------
  spawnPhase(i) {
    const st = this.st, ctx = this.ctx;
    if (i <= 1) {
      VILLAGES.forEach((V, k) => { if (!st.villages[k].done) this.spawnHold(V, V.foes, V.r - 2, { pad: 10 }); });
      if (!st.landing.taken) {
        // quân giữ bến chia SQUADS.landing đội (Đoạt Giáo), mỗi đội đứng một chỗ trên bãi; lính canh từng cặp dọc bờ giữa các thuyền
        const per = SQUADS.size, nSq = SQUADS.landing;
        const done = new Set(st.squadsDone);
        for (let k = 0; k < nSq; k++) {
          if (done.has(k)) continue;
          const a = (k / nSq) * Math.PI * 2, c = { x: LANDING.x + Math.cos(a) * 10, z: LANDING.z + Math.sin(a) * 7 };
          this.spawnSquad(k, c, k === nSq - 1 ? LANDING.garrison - per * (nSq - 1) : per, 3, { pad: 16, elite: 0.12 });
        }
        for (let k = 0; k < SQUADS.sentryPairs; k++) { if (done.has(nSq + k)) continue; const B = BOATS[k * 3]; this.spawnSquad(nSq + k, { x: B.x + 4, z: B.z + 8 }, 2, 2, { pad: 8 }); }
        this.landOfficers = LANDING.officers.map((t, k) => this.spawnOfficer(t, LANDING.x - 6 + k * 12, LANDING.z + 2, { aggro: 26, name: `${TIERS[t].name} giữ bến` }));
      }
    }
    if (i >= 2 && st.landing.taken && (st.counter.state === "wait" || st.counter.state === "run") && !this.liveCount(this.landGuard)) {
      this.landGuard = [];
      for (let k = 0; k < COUNTER.keepMilitia; k++) this.landGuard.push(this.ref(ctx.crowd.spawn({ side: "ta", unit: "GIAO_DV", role: "squad", front: null,
        x: LANDING.x - 5 + (k % 3) * 5, z: LANDING.z + 3 + Math.floor(k / 3) * 4, sx: LANDING.x - 5 + (k % 3) * 5, sz: LANDING.z + 3 + Math.floor(k / 3) * 4, legionMult: ctx.stats.legionMult ?? 1 })));
    }
    if (st.counter.state === "run" && !this.liveCount(this.counterUnits)) this.spawnCounter();
    if (i === 2) {
      const G = ctx.world.gates[GATE_SOUTH];
      this.spawnHold({ x: G.x - 14, z: G.z }, GATES[GATE_SOUTH].guards, 8, { pad: 10, elite: 0.12 });
      this.pushers = [];
      this.pushT = 0;
    }
    if (i === 3) {
      this.spawnBoss();
      BANNERS.forEach((B, k) => { if (!st.banners[k].down) this.spawnHold(B, 3, 3, { pad: 6, elite: 0.15 }); });
    }
    if (i >= 3) this.spawnHold(PALACE, PALACE.guards, PALACE.r - 2, { pad: 8, elite: 0.15 });
    // dân binh đã gọi theo tướng lại (tải lại điểm lưu: lính cũ đã gỡ)
    if (this.militia.length === 0 && st.rallied > 0 && i > 0) { const h = this.hero; this.spawnMilitia(h.x - 5, h.z, Math.min(12, 4 * st.rallied), "follow"); }
  }
  spawnBoss() {
    const B = BOSS_B16;
    const u = this.spawnOfficer("tuong", B.at.x, B.at.z, { kind: "boss", rigKey: B.rigKey, name: B.name, aggro: B.aggro });
    this.boss = u; this.bossMet = true; this.escortCalled = false;
    u.floorPct = bossFloorB16(this.st);
    for (let k = 0; k < 2; k++) this.spawnOfficer("doitruong", B.at.x - 5 + k * 10, B.at.z + 5, { aggro: 20, name: "Cận vệ Trấn Nam vương" });
  }
  // phản công bến: lính đổ bộ từ mép nước, chạy vào vòng bến
  spawnCounter() {
    const F = COUNTER.from, rng = this.ctx.rng;
    this.counterUnits = [];
    for (let k = 0; k < COUNTER.n; k++) {
      const a = this.spawnEnemy(F.x + rng.range(-14, 14), F.z + rng.range(-1, 2), { role: "squad", tx: LANDING.x + rng.range(-6, 6), tz: LANDING.z + rng.range(-5, 5), elite: 0.12 });
      this.counterUnits.push(this.ref(a));
    }
  }
  // Vương Kỳ chém được (hero.js gọi strikeables mỗi đòn): chỉ pha Thoát Hoan, cờ còn đứng
  strikeables() {
    const st = this.st;
    if (st.phase !== 3) return [];
    if (!this.strk) this.strk = BANNERS.map((B, i) => ({ x: B.x, z: B.z, r: BANNER_RULE.r, i, hit: (d) => this.hitBanner(i, d) }));
    return this.strk.filter((s) => !st.banners[s.i].down);
  }
  hitBanner(i, dmg) {
    const ev = [], d = damageBannerB16(this.st, i, dmg, ev), B = BANNERS[i];
    if (d > 0) { this.ctx.fx.text(B.x, B.z, `−${Math.round(d)}`, "#ffd27a"); this.ctx.audio.play("gate", B.x, B.z); this.bannerHit = { i, t: this.time }; }
    this.onEvents(ev);
  }

  // ---- dân binh (vòng Mệnh Lệnh) ---------------------------------------------------------------------------------------------
  ringItems() { return RING_ITEMS; }
  ringTargets() { return [{ id: "all", name: this.militiaUp() ? `Dân binh · ${this.militiaUp()} người` : "Chưa có dân binh" }]; }
  ringHint() { return ""; }
  ringStatus(k) {
    if (k === "tiepvien") return `${this.reinf.charges} lượt${this.reinf.cd > 0 ? " · " + Math.ceil(this.reinf.cd) + "s" : ""}`;
    return this.militiaOrder === k && this.militiaUp() ? "đang theo" : "";
  }
  militiaUp() { return this.liveCount(this.militia); }
  militiaRole() { return this.militiaOrder === "theota" ? "follow" : this.militiaOrder === "giucho" ? "squad" : "zone"; }
  // o: điểm mục tiêu hiện tại (tính một lần cho cả đoàn — objectives() lọc, sắp xếp mỗi lần gọi)
  aimMilitia(a, o = null) {
    if (this.militiaOrder === "xungtran") { o ||= this.objectivePoint() || this.hero; a.sx = o.x; a.sz = o.z; }
    else if (this.militiaOrder === "giucho") { a.sx = a.x; a.sz = a.z; }
  }
  order(target, k) {
    const ctx = this.ctx;
    if (k === "tiepvien") {
      if (this.reinf.charges <= 0) { this.say("Hết lượt gọi tiếp viện dân binh.", 2.5); return { ok: false }; }
      if (this.reinf.cd > 0) { this.say(`Gọi tiếp viện đang hồi (${Math.ceil(this.reinf.cd)} s).`, 2.5); return { ok: false }; }
      this.reinf.charges--; this.reinf.cd = REINF.cd; ctx.sim.reinf.charges = this.reinf.charges;
      const h = this.hero; this.spawnMilitia(h.x - Math.sin(h.yaw) * 8, h.z - Math.cos(h.yaw) * 8, REINF.n);
      this.say(`Dân binh các lộ kéo tới: ${REINF.n} người.`, 3, "good"); ctx.audio.play("horn"); this.orders++;
      return { ok: true };
    }
    if (!this.militiaUp()) { this.say("Chưa có dân binh — tới làng để gọi họ.", 3); return { ok: false }; }
    this.militiaOrder = k;
    const role = this.militiaRole();
    const o = k === "xungtran" ? this.objectivePoint() || this.hero : null;
    for (const r of this.militia) if (this.live(r)) { r.a.role = role; r.a.foe = null; this.aimMilitia(r.a, o); }
    this.say(`Dân binh: ${RING_ITEMS.find((o) => o.k === k).name}.`, 2.5, "good"); ctx.audio.play("drum"); this.orders++;
    return { ok: true };
  }

  // ---- Kế Sách (tự xét — sim/b16.js) ---------------------------------------------------------------------------------------------
  ksHud() {
    return KS_ORDER.map((id) => {
      const K = KE_SACH[id], s = this.st.ks[id];
      const word = s.state === "thanhcong" ? "Thành công" : s.state === "thatbai" ? "Thất bại" : s.state === "sansang" ? `Còn ${Math.ceil(s.left)} s · ${this.st.burnt}/${K.need} thuyền` : id === "danBinh" ? `${this.st.rallied}/3 làng` : "Chờ báo động";
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
    ctx.cinematic?.("TỔNG PHẢN CÔNG", h, true); ctx.audio.play("drums3"); ctx.audio.play("horn");
    ctx.crowd.rout(h.x, h.z, 14, (e) => e.tier === "thuong");
    return true;
  }
  plantFlag(x, z, r, atk, dur, quiet = false) {
    const g = this.flag({ x, z }, COL.ta, 5, "破強敵報皇恩");
    this.flags.push({ x, z, r, atk, t: dur, g });
    this.ctx.fx.ring(x, z, r, COL.gold, 0.8);
    if (!quiet) { this.ctx.audio.play("drum"); this.say(`Cắm cờ: quân ta trong ${r} m Công +${Math.round(atk * 100)}% trong ${dur} s.`, 3, "good"); }
  }
  // cờ cắm (Tổng Phản Công, Tuyệt Kỹ) tạo hình, vật liệu, texture mới mỗi lần: gỡ thì giải phóng luôn (trước đây chỉ remove → rò GPU cả trận)
  dropProp(g) {
    this.props.remove(g);
    g.traverse((m) => { m.geometry?.dispose(); const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : []; for (const x of mats) { x.map?.dispose(); x.dispose(); } });
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
  objectives() {
    const st = this.st, h = this.hero, P = (id, label, p, r) => ({ id, label, x: p.x, y: heightAt(p.x, p.z), z: p.z, r });
    if (this.over) return [];
    const near = (list) => list.sort((a, b) => Math.hypot(a.x - h.x, a.z - h.z) - Math.hypot(b.x - h.x, b.z - h.z));
    if (st.phase === 0) return near(VILLAGES.filter((V, i) => !st.villages[i].done).map((V) => P(V.id, V.name, V, V.r)));
    // việc gấp trước mục tiêu của pha: bến bị phản công (sức giữ < 85%), lính cầm đuốc đang chạy tới kho còn nguyên
    if (st.counter.state === "run" && st.counter.keep < 85) return [P("ben", `Bến bị phản công · ${Math.ceil(st.counter.keep)}%`, LANDING, LANDING.r * 0.6)];
    if (st.phase === 1) {
      const torch = near(this.torches.filter((r) => this.live(r) && !st.depots[r.i].burnt).map((r) => P("duoc", "Lính cầm đuốc", r.a, 1.5)))[0];
      if (torch) return [torch];
    }
    if (st.phase === 1) {
      if (st.burnt < BOATS.length) return near(BOATS.filter((B, i) => !st.boats[i].burnt).map((B) => P(B.id, "Thuyền neo", { x: B.x, z: B.z + 3 }, 2.5))).slice(0, 1);
      return [P("ben", "Bến Chương Dương", LANDING, LANDING.r)];
    }
    if (st.phase === 2) {
      const r = this.ramPos();
      if (!st.ram.arrived) return [P("xe", "Xe húc", r, 6)];
      const g = this.ctx.world.gates[GATE_SOUTH]; return [P(GATE_SOUTH, "Cổng nam", g, 5)];
    }
    if (st.phase === 3) {
      const flags = BANNERS.filter((B, i) => !st.banners[i].down).map((B) => P(B.id, "Vương Kỳ", B, 2.5));
      if (flags.length) return near(flags).slice(0, 1);
      const u = this.boss; return u && u.alive && !u.dead && !u.retreating ? [P("X18", BOSS_B16.name, u, 6)] : [];
    }
    if (st.phase === 4) return [P("dien", "Điện chính", PALACE, PALACE.r)];
    return [];
  }
  ramPos() { return along(RAM.route, this.st.ram.s); }
  // vòng chiếm đang bị chặn mà tướng đứng trong (làng, bến, điện) → { c, r } | null
  heldRing() {
    const st = this.st, h = this.hero, inR = (c, r) => this.dist(h, c) <= r;
    if (st.phase <= 1) for (let i = 0; i < VILLAGES.length; i++) { const V = VILLAGES[i]; if (!st.villages[i].done && inR(V, V.r)) return { c: V, r: V.r }; }
    if (st.phase === 1 && st.burnt >= BOATS.length && inR(LANDING, LANDING.r)) return { c: LANDING, r: LANDING.r };
    if (st.phase === 4 && inR(PALACE, PALACE.r)) return { c: PALACE, r: PALACE.r };
    return null;
  }
  // Nhãn thứ hai của HUD (hud.js frameBlocker, như B15): còn ≤ 4 lính địch chặn vòng tướng đang đứng → chỉ con gần nhất (cung kỵ chạy vòng ngoài
  // rìa vòng làm vòng đứng mãi — bot đo được: đứng giữa bến 300 s không chiếm được)
  blockers() {
    const R = this.heldRing(); if (!R) return [];
    const crowd = this.ctx.crowd, h = this.hero, list = [];
    for (const a of crowd.agents) if (a.side === "dich" && crowd.hittable(a) && this.dist(a, R.c) < R.r) list.push(a);
    for (const u of this.ctx.units) if (u.side === "dich" && u.alive && !u.dead && !u.retreating && this.dist(u, R.c) < R.r + u.radius) list.push(u);   // sĩ quan cũng chặn (foesAt tính cả)
    if (!list.length || list.length > 4) return [];
    const a = list.sort((p, q) => this.dist(p, h) - this.dist(q, h))[0];
    const label = a.isBig ? `${a.name} còn chặn` : a.unit === "CUNGKY_NG" ? "Cung kỵ còn chặn" : "Lính Nguyên còn chặn";
    return [{ id: "chan", label, x: a.x, y: heightAt(a.x, a.z), z: a.z, r: 2, ref: a }];
  }

  // ---- cổng --------------------------------------------------------------------------------------------------------------------
  damageGate(id, dmg) {
    const ctx = this.ctx, st = this.st;
    if (!st.gates[id] || st.gates[id].open) return;
    this.gateHit = { id, t: this.time };
    if (st.phase < 2) { this.gateNag = (this.gateNag || 0) + 1; if (this.gateNag % 20 === 1) this.say("Chưa phá cổng được — chiếm bến Chương Dương trước để có xe húc.", 3); return; }
    const ev = [], d = damageGateB16(st, id, dmg, ev);
    const g = ctx.world.gates[id]; g.shake = 0.25; ctx.audio.play("gate", g.x, g.z);
    this.gateHits = (this.gateHits || 0) + 1;
    if (d > 0) ctx.fx.text(g.x - 1.8, g.z + ((this.gateHits % 3) - 1) * 1.4, `−${Math.round(d)}`, "#ffd27a");
    this.onEvents(ev);
  }
  gateList() {
    const out = [];
    for (const id of [GATE_SOUTH, GATE_EAST]) {
      const g = this.ctx.world.gates[id], s = this.st.gates[id];
      out.push({ id, name: GATES[id].name, x: g.x, z: g.z, hp: s.hp, max: s.hp0, open: s.open });
    }
    return out;
  }
  gateTarget() {
    const t = pickGate({ gates: this.gateList(), hero: this.hero, phase: this.st.phase, now: this.time, lastHit: this.gateHit });
    if (t?.locked) t.why = "Khóa: chiếm bến Chương Dương trước";
    return t;
  }
  goalText(short = false) {
    if (this.st.phase !== 2) return null;
    const G = this.st.gates[GATE_SOUTH], pct = gatePct(G.hp, G.hp0);         // không lộ id nội bộ B3 (cổng của đất Hàm Tử) ra HUD
    return short ? `Phá cổng nam ${pct}%` : `Hộ tống xe húc, phá Cổng nam ${pct}%`;
  }
  openGateVisual(id, quiet = false) {
    const ctx = this.ctx, g = ctx.world.gates[id];
    ctx.openGates[id] = true; g.broken = true;
    if (ctx.sim.bases[id]) { ctx.sim.bases[id].open = true; ctx.sim.bases[id].owner = "ta"; }
    if (quiet) return;
    ctx.audio.play("gateBreak"); ctx.fx.shake(0.8); ctx.fx.dust(g.x, g.z, 3);
    for (const dz of [-5, 0, 5]) ctx.fx.fire(g.x - 0.5, heightAt(g.x, g.z + dz), g.z + dz, 30, 3);
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

    const ramMoving = st.phase === 2 && this.stepRam(dt);
    this.stepTorches();
    const I = this.inp, run = st.counter.state === "run";
    I.hero.x = h.x; I.hero.z = h.z; I.hero.alive = h.alive; I.ramMoving = ramMoving; I.bossDown = !!this.bossDown;
    I.landingDef = run ? this.allyIn(LANDING, LANDING.r) : 0; I.counterLeft = run ? this.liveCount(this.counterUnits) : 0;   // luật chỉ đọc khi đang phản công
    const ev = tickB16(st, I, dt);
    this.stepBoss();
    this.phase = st.phase;
    this.onEvents(ev);
    if (this.over) return;
    this.updateFlags(dt);
    this.stepBoatFires(dt);
    if (st.phase === 2) this.placeRam();
    ctx.hud?.prompt?.(st.prompt ? st.prompt.text : null, st.prompt?.p ?? 0);
    this.baseHint = this.hint();
    this.syncProps();
    // dân binh "Xung trận" bám theo mục tiêu hiện tại
    if (this.militiaOrder === "xungtran" && (this.aimT = (this.aimT || 0) - dt) <= 0) { this.aimT = 1; const o = this.objectivePoint() || this.hero; for (const r of this.militia) if (this.live(r)) this.aimMilitia(r.a, o); }
    if (this.militia.length > 80) this.militia = this.militia.filter((r) => this.live(r));
  }
  hint() {
    const st = this.st;
    // đang giữ một làng (hoặc đã giữ dở): thẻ nhiệm vụ đếm ngược giây — người chơi thử: "không biết mình đang làm nhiệm vụ đó"
    if (st.phase <= 1) {
      const h = this.hero, i = VILLAGES.findIndex((V, k) => !st.villages[k].done && this.dist(h, V) <= V.r);
      if (i >= 0) { const V = VILLAGES[i], v = st.villages[i]; return v.blocked ? `${V.name}: dẹp lính Nguyên trong vòng` : `${V.name}: dân binh tập hợp · còn ${secLeft(v, V.hold)} s`; }
    }
    if (st.phase === 0) return `Dân binh: ${st.rallied}/3 làng (cần 2 để đánh bến)`;
    if (st.phase === 1) return st.burnt < BOATS.length ? `Thuyền neo đã đốt ${st.burnt}/12${st.rallied < 3 ? ` · làng ${st.rallied}/3` : ""}` : "Chiếm bến Chương Dương";
    const keep = st.counter.state === "run" ? `Sức giữ bến ${Math.ceil(st.counter.keep)}% · ` : "";
    if (st.phase === 2) return keep ? keep + "về bến đẩy lui quân phản công" : null;      // không phản công: goalText (độ bền cổng nam)
    if (st.phase === 3) return keep + (st.bannersDown < BANNERS.length ? `Vương Kỳ đã đổ ${st.bannersDown}/3 — Thoát Hoan còn khiên` : "Vương Kỳ đổ hết — đánh lui Thoát Hoan");
    return keep || null;
  }
  allyIn(c, r) { let n = 0; for (const a of this.ctx.crowd.agents) if (a.side === "ta" && this.alive(a) && this.dist(a, c) < r) n++; return n; }
  // lính cầm đuốc: chạy thẳng tới kho của mình (đánh trả nếu bị đánh)
  stepTorches() {
    for (const r of this.torches) if (this.live(r)) { const D = DEPOTS[r.i]; r.a.sx = D.x; r.a.sz = D.z; }
  }
  torchesAt(i) { let n = 0; for (const r of this.torches) if (r.i === i && this.live(r) && this.dist(r.a, DEPOTS[i]) < DEPOT_RULE.r) n++; return n; }
  // Thoát Hoan: sàn Sinh lực khi còn Vương Kỳ; lần đầu chạm sàn gọi hộ vệ (Hộ Vệ Hoàng Tử, canon X18)
  stepBoss() {
    const u = this.boss;
    if (!u || !u.alive || u.retreating) return;
    u.floorPct = bossFloorB16(this.st);
    if (u.hpLocked && u.floorPct > 0 && !this.escortCalled) {
      this.escortCalled = true;
      this.spawnOfficer("photuong", u.x + 4, u.z + 3, { awake: true, aggro: 40, name: "Hộ vệ Trấn Nam vương" });
      this.spawnHold(u, BANNER_RULE.guards, 5, { pad: 12, elite: 0.2 });
      this.banner("HỘ VỆ HOÀNG TỬ", "#ff8a6a", 1.4); this.ctx.audio.play("horn", u.x, u.z);
      this.say("Thoát Hoan còn khiên vương giả: chém đổ cả ba Vương Kỳ quanh sân điện thì mới đánh lui được ông.", 6, "bad");
    }
  }
  // xe húc: người đẩy (dân binh), chạy khi có người đẩy sát xe và không địch trong stopR
  stepRam(dt) {
    const ctx = this.ctx, st = this.st, p = this.ramPos();
    this.pushers = this.pushers.filter((r) => this.live(r));
    if (this.pushers.length < RAM.pushers && !st.ram.arrived) {
      this.pushT = (this.pushT || 0) + dt;
      if (this.pushers.length === 0 || this.pushT > PUSH.respawn) {
        this.pushT = 0;
        const n = this.pushers.length === 0 ? RAM.pushers : 1, back = { x: p.x - Math.sin(p.yaw) * 4, z: p.z - Math.cos(p.yaw) * 4 };
        for (let i = 0; i < n; i++) this.pushers.push(this.ref(ctx.crowd.spawn({ side: "ta", unit: "GIAO_DV", role: "squad", front: null, x: back.x + (i - 1.5) * 1.2, z: back.z, yaw: p.yaw, legionMult: ctx.stats.legionMult ?? 1 })));
      }
    }
    let pushing = 0;
    this.pushers.forEach(({ a }, i) => {
      const off = (i - (this.pushers.length - 1) / 2) * PUSH.gap;
      a.sx = p.x - Math.sin(p.yaw) * PUSH.back + Math.cos(p.yaw) * off; a.sz = p.z - Math.cos(p.yaw) * PUSH.back - Math.sin(p.yaw) * off;
      if (Math.hypot(a.x - a.sx, a.z - a.sz) < PUSH.pullR && !a.foe) pushing++;
    });
    const blocked = this.foesAt(p.x, p.z, RAM.stopR) > 0;
    this.ramState = st.ram.arrived ? "húc cổng" : blocked ? "bị chặn" : pushing ? "đang chạy" : "chờ người đẩy";
    if (blocked && this.time - (this.ramWarn || -99) > 10) { this.ramWarn = this.time; this.say("Địch chặn xe húc — dẹp chúng để xe chạy tiếp!", 3.5, "bad"); }
    return pushing > 0 && !blocked;
  }
  placeRam() {
    const p = this.ramPos(), m = this.ramMesh;
    m.position.set(p.x, heightAt(p.x, p.z), p.z); m.rotation.y = p.yaw;
    if (this.st.ram.arrived) { const k = (this.time * 1.2) % 1; m.log.position.z = 0.5 + (k < 0.2 ? k * 6 : Math.max(0, 1.2 - (k - 0.2) * 1.5)); if (k < 0.02) { const g = this.ctx.world.gates[GATE_SOUTH]; g.shake = 0.3; this.ctx.audio.play("gate", g.x, g.z); } }
  }
  stepBoatFires(dt) {
    BOATS.forEach((B, i) => {
      const b = this.st.boats[i];
      if (!b.burnt) return;
      if ((b.fireT = (b.fireT ?? 0) - dt) <= 0) { b.fireT = 28; this.ctx.fx.fire(B.x, 1.2, B.z, 30, 3.2); }
    });
  }

  // ---- sự kiện luật → trận --------------------------------------------------------------------------------------------------
  onEvents(ev) {
    const ctx = this.ctx, st = this.st;
    for (const e of ev) {
      if (e.type === "villageRallied") {
        const V = VILLAGES.find((v) => v.id === e.id);
        this.hk(V.hk, "dân binh " + V.name);
        this.banner(`${V.name.toUpperCase()} · DÂN BINH TẬP HỢP`, "#dff0c8", 1.4); ctx.audio.play("cheer");
        this.spawnMilitia(V.x, V.z, V.militia);
        this.say(`${V.militia} dân binh ${V.name} theo tướng. {Act:cmd} để ra lệnh cho họ.`, 4, "good");
      } else if (e.type === "phase") {
        const P = PHASES[e.phase];
        this.hk(HAO_KHI.src.mainMission, "nhiệm vụ chính");
        this.banner(`${P.id} · ${P.name.toUpperCase()}`, "#e6dcc3", 2); ctx.audio.play("drums3");
        if (e.phase === 1) this.say("Đủ dân binh. Men bờ sông tới bến Chương Dương, đốt 12 thuyền neo.", 6);
        if (e.phase === 2) { this.say("Xe húc rời bến. Hộ tống nó tới cổng nam; cánh Trần Quang Khải đánh cổng đông.", 6); this.spawnPhase(2); }
        if (e.phase === 3) { this.say(`${BOSS_B16.name} ở sân trước điện chính. Đánh lui ông ta.`, 6); this.spawnPhase(3); }
        if (e.phase === 4) this.say("Thoát Hoan rút khỏi thành về phía bắc. Chiếm điện chính!", 6);
        this.phase = e.phase;
        this.saveCheckpoint();
      } else if (e.type === "alarm") {
        this.banner("BẾN CHƯƠNG DƯƠNG BÁO ĐỘNG", "#ff8a6a", 1.4); ctx.audio.play("horn", LANDING.x, LANDING.z);
        this.say(e.by === "de" ? "Lính canh thấy bạn trên đê — bến báo động! (Lần sau đi trong lau sậy ven sông.)" : e.by === "thay" ? "Lính canh thấy bạn — bến báo động!" : "Lửa bốc trên thuyền — bến báo động!", 5, "bad");
        for (const u of this.landOfficers || []) if (u.alive) u.awake = true;
      } else if (e.type === "torches") {
        const rng = ctx.rng;
        DEPOTS.forEach((D, i) => { for (let k = 0; k < DEPOT_RULE.torches; k++) { const a = this.spawnEnemy(D.x + rng.range(-10, 10), D.z - 22 + rng.range(-3, 3), { role: "squad", tx: D.x, tz: D.z }); this.torches.push(this.ref(a, { i })); } });
        this.say("Quân Nguyên cầm đuốc chạy tới kho quân nhu — hạ chúng để giữ kho!", 5, "bad"); ctx.audio.play("horn");
      } else if (e.type === "depotBurnt") {
        const D = DEPOTS.find((d) => d.id === e.id);
        ctx.fx.fire(D.x, heightAt(D.x, D.z), D.z, 60, 4.5); ctx.audio.play("fire", D.x, D.z);
        this.say(`${D.name} bị quân Nguyên tự đốt.`, 4, "bad");
      } else if (e.type === "counterStart") {
        this.spawnCounter();
        this.banner("QUÂN NGUYÊN PHẢN CÔNG BẾN", "#ff8a6a", 1.6); ctx.audio.play("horn", LANDING.x, LANDING.z);
        this.say("Thuyền Nguyên áp bờ, phản công bến Chương Dương! Mất bến là thua — về giữ bến hoặc gọi tiếp viện.", 6, "bad");
      } else if (e.type === "counterEnd") {
        if (e.ok) {
          this.hk(COUNTER.hk, "giữ bến"); this.banner("GIỮ ĐƯỢC BẾN", "#dff0c8", 1.4); ctx.audio.play("cheer");
          const ids = new Set();
          for (const r of this.counterUnits) if (this.live(r)) { ids.add(r.id); r.a.role = "squad"; r.a.sx = COUNTER.from.x; r.a.sz = COUNTER.from.z - 6; }   // còn sống thì lui xuống thuyền
          ctx.crowd.rout(LANDING.x, LANDING.z, LANDING.r + 10, (a) => ids.has(a.id));
        }
      } else if (e.type === "bannerDown") {
        const B = BANNERS.find((b) => b.id === e.id);
        ctx.fx.dust(B.x, B.z, 1.5); ctx.audio.play("gateBreak"); this.hk(BANNER_RULE.hk, "Vương Kỳ");
        this.banner(`VƯƠNG KỲ ĐỔ ${e.n}/3`, "#f1d98a", 1.1);
      } else if (e.type === "bannersAll") {
        if (this.boss) { this.boss.floorPct = 0; this.boss.hpLocked = false; }
        this.say("Ba Vương Kỳ đã đổ: Thoát Hoan mất khiên vương giả!", 5, "good");
      } else if (e.type === "boatBurnt") {
        const B = BOATS.find((b) => b.id === e.id);
        ctx.fx.fire(B.x, 1.2, B.z, 30, 3.2); ctx.audio.play("fire", B.x, B.z);
        this.banner(`ĐỐT THUYỀN ${e.n}/12`, "#ffb07a", 0.9); this.hk(BOAT_RULE.hk, "đốt thuyền", true);
      } else if (e.type === "landingTaken") {
        this.banner("CHIẾM BẾN CHƯƠNG DƯƠNG", "#f1d98a", 1.6); ctx.audio.play("cheer");
      } else if (e.type === "keSach") {
        const K = KE_SACH[e.id];
        if (e.ok) {
          this.hk(K.hk, "Kế Sách " + K.name); this.banner(`KẾ SÁCH · ${K.name.toUpperCase()}`, "#ffd27a", 1.6); ctx.audio.play("horn");
          if (e.id === "danhUp") this.say("Quân Nguyên trong thành mất đường rút thủy — cổng nam đã núng (−30% độ bền).", 5, "good");
          if (e.id === "danBinh") { this.reinf.charges += K.charges; ctx.sim.reinf.charges = this.reinf.charges; this.say(`Dân binh các lộ: +${K.charges} lượt Gọi tiếp viện.`, 5, "good"); }
        } else this.say(`Kế Sách ${K.name}: không thành.`, 4, "bad");
      } else if (e.type === "ambush") {
        const A = RAM.ambush[e.i];
        for (let k = 0; k < A.n; k++) { const p = this.ramPos(); this.hunters.push(this.ref(this.spawnEnemy(A.from.x + this.ctx.rng.range(-5, 5), A.from.z + this.ctx.rng.range(-5, 5), { role: "squad", tx: p.x, tz: p.z, elite: 0.12 }))); }
        this.say("Phục kích! Quân Nguyên lao ra chặn xe húc.", 4, "bad"); ctx.audio.play("horn");
      } else if (e.type === "ramArrived") {
        this.banner("XE HÚC TỚI CỔNG NAM", "#e6dcc3", 1.2);
      } else if (e.type === "gateOpen") {
        this.openGateVisual(e.id);
        this.banner(`PHÁ ${GATES[e.id].name.toUpperCase()}`, "#f1d98a", 1.5);
        this.hk(5, "cổng " + e.id, e.id === GATE_EAST);
        if (e.id === GATE_EAST) this.say("Cánh Trần Quang Khải đã phá cổng đông.", 4, "good");
      } else if (e.type === "win") this.win(e.why);
      else if (e.type === "lose") this.lose(e.why, true);                // mất bến, quá giờ: tải lại đầu pha được (như B15)
    }
    // lính phục kích bám theo xe húc
    if (st.phase === 2 && this.hunters.length) { const p = this.ramPos(); for (const r of this.hunters) if (this.live(r)) { r.a.sx = p.x; r.a.sz = p.z; } }
  }

  // ---- móc từ lính, sĩ quan, tướng ---------------------------------------------------------------------------------------------
  onSoldierKilled(a, opt) {
    const slot = a.side === "dich" ? this.squadOf.get(a.id) : undefined;
    if (slot !== undefined && this.squads.has(slot)) {                                // Đoạt Giáo: đội giữ bến hết người
      const list = this.squads.get(slot);
      if (list.every((r) => r.id === a.id || !this.live(r))) {
        this.squads.delete(slot);
        const n = noteSquadCleared(this.st, slot);
        if (n <= SQUADS.need) { this.banner(`ĐOẠT GIÁO ${n}/${SQUADS.need}`, "#e6dcc3", 0.9); this.hk(1, "Đoạt Giáo", true); }
      }
    }
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
  onOfficerAwake(u) { if (u === this.boss) { this.ctx.fx.banner("TRẤN NAM VƯƠNG THOÁT HOAN", "#ff8a6a", 1.6); this.ctx.audio.play("horn"); } }
  onBossDefeated(u) {
    if (u !== this.boss) return;
    this.bossDown = true; this.ko++;
    this.bq.clear(); this.ctx.fx.banner("THOÁT HOAN RÚT KHỎI KINH THÀNH", "#f1d98a", 2.2); this.ctx.audio.play("drums3");
    this.hk(15, "đánh lui Thoát Hoan");
  }
  onCaptured(u) { this.onBossDefeated(u); }
  onCounterBoss() { if (this.counterBoss < HAO_KHI.src.counterBossMax) { this.counterBoss++; this.hk(HAO_KHI.src.counterBoss, "phản đòn Thoát Hoan"); } }
  onBreak(u) { this.ctx.fx.banner("VỠ THẾ · ĐÒN MẠNH ĐỂ RA ĐÒN QUYẾT", "#ffd27a", 1.2); this.ctx.audio.play("parry", u.x, u.z); }
  onHeroHit() {}
  onHeroAction() {}
  onRevive() { this.hk(HAO_KHI.src.reviveUsed, "gượng dậy"); this.revived = true; }
  onHeroDead() { if (!this.over) this.lose("Trần Quốc Toản gục ngã.", true); }
  onAllyGeneralDown() {}
  killActor() {}
  fillActors() {}

  // ---- điểm lưu đầu pha, thắng thua --------------------------------------------------------------------------------------------
  saveCheckpoint() {
    const ctx = this.ctx, h = this.hero;
    this.checkpoint = { st: snapshotB16(this.st), time: this.time, hk: clone(ctx.hk), ko: this.ko, koMs: this.koMs, revived: this.revived, counterBoss: this.counterBoss,
      reinf: { ...this.reinf }, hero: { hp: h.hp, ki: h.ki, revives: h.revives, x: h.x, z: h.z } };
  }
  restoreCheckpoint() {
    const ctx = this.ctx, c = this.checkpoint, h = this.hero;
    for (const a of [...ctx.crowd.agents]) ctx.crowd.release(a);
    for (const u of ctx.units) if (u.alive) u.dispose();
    ctx.units.length = 0; this.boss = null; this.landOfficers = []; this.strk = null; this.resetLists();
    this.militiaOrder = "theota";                                          // dân binh sinh lại đều "Theo ta"
    for (const f of this.flags) this.dropProp(f.g); this.flags = [];
    restoreB16(this.st, c.st); Object.assign(ctx.hk, clone(c.hk));
    this.bossDown = this.st.bossDown; this.bossMet ||= this.st.phase >= 3; this.counterBoss = c.counterBoss ?? 0;   // P5: Thoát Hoan đã rút (thưởng hạ boss giữ nguyên)
    this.phase = this.st.phase; this.time = c.time; this.ko = c.ko; this.koMs = c.koMs; this.revived = c.revived; this.reinf = { ...c.reinf };
    ctx.sim.reinf.charges = this.reinf.charges;
    for (const id of [GATE_SOUTH, GATE_EAST]) { const open = this.st.gates[id].open; ctx.openGates[id] = open; ctx.world.gates[id].broken = open; }
    h.alive = true; h.state = "free"; h.hp = Math.max(c.hero.hp, h.maxHp * HERO.retryHp); h.ki = c.hero.ki; h.revives = c.hero.revives; h.x = c.hero.x; h.z = c.hero.z; h.invuln = 2; h.lock = null;
    this.over = false; this.result = null; this.retries++;
    this.spawnPhase(this.st.phase);
    this.syncProps(); this.bq.clear();
    this.say(`Tải lại đầu pha ${PHASES[this.st.phase].id}.`, 3);
  }
  win(why) {
    if (this.over) return;
    this.over = true; this.ctx.hud?.prompt?.(null);
    this.result = this.buildResult(true, why || "Quân Trần thu hồi kinh thành Thăng Long.");
    this.bq.push("TỤNG GIÁ HOÀN KINH", "#f1d98a", 2); this.ctx.audio.play("victory");
  }
  lose(why, canRetry = true) {
    if (this.over) return;
    if (!this.st.over) simFinish(this.st, false, why);
    this.over = true; this.ctx.hud?.prompt?.(null);
    this.result = this.buildResult(false, why); this.result.canRetry = canRetry && !!this.checkpoint;
    this.ctx.audio.play("defeat");
  }
  buildResult(won, why) {
    const ctx = this.ctx, st = this.st, side = sideB16(st);
    const mainDone = st.main.filter(Boolean).length, sideDone = Object.values(side).filter(Boolean).length;
    const ks = this.ksHud(), ksOk = ks.filter((k) => k.state === "thanhcong").length;
    const alliesUp = this.liveCount(this.militia), alliesAll = Math.max(1, this.militia.length);
    return {
      battle: "B16", won, why, R: ctx.R, difficulty: ctx.diff.id, timeSec: this.time, mode: this.mode, parSec: PAR_B16,
      missions: (mainDone / 5) * 0.8 + (sideDone / 3) * 0.2, mainDone, sideDone, missionsTotal: 5, sideTotal: 3,
      qRatio: alliesUp / alliesAll, baseRatio: (st.burnt / BOATS.length + (st.landing.taken ? 1 : 0) + (st.gates[GATE_SOUTH].open ? 1 : 0) + (st.palace.taken ? 1 : 0)) / 4,
      ko: this.ko, hkRaw: ctx.hk.rawTotal, hkOptional: ctx.hk.optional, hkLog: { ...ctx.hk.log },
      avgSK: 50, bossDefeated: !!this.bossDown, bossMet: !!this.bossMet, tpcCount: ctx.hk.tpcCount, chestCoins: 0, extraTT: 0,
      events: {}, eventNames: {}, orders: this.orders, items: 0,
      keSach: ks.reduce((s, k) => s + k.got, 0) / ks.reduce((s, k) => s + k.hk, 0), keSachOk: ksOk,
      keSachList: ks.map((k) => ({ id: k.id, state: k.state, name: k.name, word: k.word, got: k.got, hk: k.hk })),
      b16: { rallied: st.rallied, burnt: st.burnt, eastOpen: st.gates[GATE_EAST].open, squads: st.squadsCleared, depots: st.depots.map((d) => d.burnt ? "chay" : d.saved ? "giu" : "-"), alarmBy: st.alarmBy, counter: st.counter.state, side },
    };
  }
  bedDist() {
    const h = this.hero; let d = 999;
    for (const a of this.ctx.crowd.agents) if (a.side === "dich" && this.alive(a)) d = Math.min(d, Math.hypot(a.x - h.x, a.z - h.z));
    return d;
  }
  // Vật của trận để lại trong scene: battle.js releaseGpu duyệt scene và giải phóng (trước đây gỡ khỏi scene trước nên không ai giải phóng).
  dispose() {}
}
