// battle/kesach.js — Kế Sách của B15 (GDD 5.6, 5.7, hồ sơ B15).
//
//   KeSach { id, loai, quyMo, dieuKien[], hanhDong[], cuaSo, phanThuong{haoKhi 10|20, thuongLe}, thatBai{coTheThuLai, thuLaiSau} }
//   Máy trạng thái: khoa → khadung → sansang (cửa sổ đang mở) → thanhcong | thatbai (→ khadung sau thuLaiSau)
//
// Luật thưởng: khung Hào Khí gốc là trần cả trận, gộp mọi lần thử; thưởng lẻ giữ lại khi thất bại;
// Kế Sách thất bại không trừ Hào Khí. Không có hồi chiêu; thuLaiSau là thời gian kịch bản dựng lại.

import * as THREE from "three";
import { KE_SACH, lineToX, FRONTS } from "../data/battle-b15.js";
import { merge, part, lambert, flagTexture, PAL } from "./models.js";
import { heightAt } from "./world.js";
import { BigUnit } from "./units.js";
import { g } from "../data/tuning.js";

const STATE_WORD = { khoa: "Khóa", khadung: "Khả dụng", sansang: "Sẵn sàng", thanhcong: "Thành công", thatbai: "Thất bại" };

export class KeSachManager {
  constructor(ctx, mode) {
    this.ctx = ctx; this.mode = mode;
    this.list = Object.values(KE_SACH).filter((k) => k.modes.includes(mode)).map((def) => ({
      def, state: "khoa", got: 0, attempts: 0, left: 0, retryT: 0, success: false,
    }));
    this.boats = []; this.bundles = []; this.carried = 0;
    this.mods = ctx.stats.mods;
    this.windowMult = (mode === "nhanh" ? 0.75 : 1) * (1 + (this.mods.ksWindow || 0));
    this.effectMult = 1 + (this.mods.ksEffect || 0);
    if (this.get("muiTenThu")) this.open("muiTenThu");
  }

  get(id) { return this.list.find((k) => k.def.id === id); }
  word(k) { return STATE_WORD[k.state]; }
  successCount() { return this.list.filter((k) => k.success).length; }
  ratio() { return this.list.length ? this.successCount() / this.list.length : 1; }

  // Hào Khí từ Kế Sách: cộng không vượt khung (trần cả trận).
  reward(k, amount) {
    const add = Math.max(0, Math.min(amount, k.def.hk - k.got));
    if (add > 0) { k.got += add; this.ctx.director.hk(add, "kế sách:" + k.def.name, true); }
    return add;
  }

  // Mở Kế Sách (Khóa → Khả dụng).
  open(id) {
    const k = this.get(id); if (!k || (k.state !== "khoa" && k.state !== "thatbai")) return;
    k.state = "khadung"; k.attempts++;
    const d = this.ctx.director;
    if (id === "coAoTong") {
      this.spawnBoats(k); this.spawnGuards(k);
      if (k.attempts === 1) { this.banner("KẾ SÁCH · CỜ ÁO TỐNG", "#f1d98a", 2, true); d.say(`${k.def.text} Thuyền dừng khi có địch trong ${k.def.stopEnemyR} m — hãy dọn bờ sông.`, 8, "good"); }
      else d.say("Thuyền quân Triệu Trung lại xuất bến.", 4, "good");
    }
    if (id === "muiTenThu") {
      this.spawnBundles(k);
      if (k.attempts === 1) d.say(`Kế Sách Nhỏ "Mũi tên thư": ${k.def.text}`, 7);
    }
  }

  onBaseTaken(id) {
    for (const k of this.list) if (k.def.unlockBase === id && k.state === "khoa") this.open(k.def.id);
  }

  // ---- thuyền quân Triệu Trung ---------------------------------------------------------------
  spawnBoats(k) {
    const ctx = this.ctx, def = k.def;
    for (const b of this.boats) ctx.scene.remove(b.mesh);
    this.boats = [];
    for (let i = 0; i < def.boats; i++) {
      const mesh = new THREE.Mesh(merge([
        part(new THREE.BoxGeometry(2.8, 1.0, 9), PAL.nau, { y: 0.5 }),
        part(new THREE.BoxGeometry(2.2, 0.8, 2.6), PAL.go, { y: 1.3, z: -2.6 }),
        part(new THREE.CylinderGeometry(0.1, 0.12, 6, 5), PAL.then, { y: 3.5, z: 0.8 }),
        ...[-0.7, 0, 0.7].map((x) => part(new THREE.BoxGeometry(0.4, 1.1, 0.4), 0xa0622c, { x, y: 1.5, z: 1.8 })),
      ]), lambert());
      mesh.castShadow = true;
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.8), new THREE.MeshLambertMaterial({ map: flagTexture("宋", "#b0752c", "#1d1a17"), side: THREE.DoubleSide }));
      flag.position.set(0.65, 5.4, 0.8); flag.rotation.y = Math.PI / 2; mesh.add(flag);
      ctx.scene.add(mesh); ctx.view?.track(mesh, true);    // thuyền, cờ chạy theo bước mô phỏng: vẽ nội suy (battle/view.js)
      const p0 = def.route[0];
      this.boats.push({
        mesh, flag, idx: 1, x: p0.x - i * 14, z: p0.z, boatY: 0.3, yaw: Math.PI / 2,
        hp: def.boatHp * g(ctx.R), maxHp: def.boatHp * g(ctx.R), alive: true, dead: false, landed: false, stopped: false,
        isBig: true, giap: 30, arrowMult: 0.35, name: `Thuyền quân Triệu Trung ${i + 1}`,
        receiveHit: (h) => this.hitBoat(this.boats[i], h),
      });
    }
  }
  hitBoat(b, h) {
    if (!b.alive) return;
    b.hp -= h.dmg; b.flash = 0.12;
    if (b.hp <= 0) {
      b.hp = 0; b.alive = false; b.dead = true; b.sinkT = 0;
      this.ctx.director.say(`${b.name} bị đánh chìm!`, 4, "bad"); this.ctx.audio.play("gateBreak", b.x, b.z);
    }
  }
  // Toán giữ bờ: chỉ bù cho đủ G.n lính còn đánh được và 1 sĩ quan mỗi toán. Trước đây mỗi lần dựng lại (thất bại →
  // 60 s → open) sinh thêm đủ 28 lính + 1 Đội trưởng mà không gỡ toán cũ: bờ sông dày thêm sau mỗi lần thử (28 → 56 →
  // 84…), thuyền chìm nhanh hơn, mọi vòng quét O(lính) nặng dần. Lần đầu và tải lại checkpoint (đã gỡ hết) vẫn đủ bộ.
  // Lính cũ còn nhắm thuyền đã chìm thì crowd bỏ đích chết, updateBoats gán lại thuyền mới.
  spawnGuards(k) {
    const ctx = this.ctx, crowd = ctx.crowd;
    for (const [gi, G] of k.def.guards.entries()) {
      let have = 0;
      for (const a of crowd.agents) if (a.src === "coAoTong" && a.anchor?.group === gi && crowd.hittable(a)) have++;
      for (let i = have; i < G.n; i++) {
        const archer = i % 3 !== 2;
        crowd.spawn({ side: "dich", unit: archer ? "CUNGKY_NG" : "KHIEN_NG", role: "squad", src: "coAoTong",
          x: G.x + ctx.rng.range(-7, 7), z: G.z + ctx.rng.range(-3, 3), anchor: { x: G.x, z: G.z, r: archer ? 12 : 2, group: gi } });
      }
      if (G.officer && !ctx.units.some((u) => u.ksGroup === gi && u.alive && !u.dead)) {
        const u = new BigUnit(ctx, { kind: "officer", side: "dich", tier: G.officer, name: "Đội trưởng giữ bờ", x: G.x, z: G.z + 3, aggro: 26 });
        u.ksGroup = gi;                                   // đánh dấu sĩ quan của toán gi (lần thử sau khỏi sinh trùng)
        ctx.units.push(u);
      }
    }
  }

  updateBoats(dt) {
    const ctx = this.ctx, k = this.get("coAoTong");
    if (!k || !this.boats.length) return;
    const def = k.def, squad = ctx.crowd.agents.filter((a) => a.src === "coAoTong" && ctx.crowd.hittable(a));
    for (const b of this.boats) {
      if (b.dead) {
        b.sinkT += dt; b.mesh.position.y = b.boatY - b.sinkT * 0.6; b.mesh.rotation.z = Math.min(0.5, b.sinkT * 0.2);
        if (b.sinkT > 5) b.mesh.visible = false;
        continue;
      }
      // lính giữ bờ nhắm thuyền khi thuyền tới trong 24 m
      for (const a of squad) if (a.anchor && Math.hypot(a.x - b.x, a.z - b.z) < 24) a.anchor.target = b;
      if (!b.landed) {
        const near = squad.some((a) => Math.hypot(a.x - b.x, a.z - b.z) < def.stopEnemyR)
          || ctx.units.some((u) => u.side === "dich" && u.alive && !u.dead && Math.hypot(u.x - b.x, u.z - b.z) < def.stopEnemyR);
        const ahead = this.boats.find((o) => o !== b && !o.dead && !o.landed && o.idx >= b.idx && Math.hypot(o.x - b.x, o.z - b.z) < 12 && ((o.x - b.x) * Math.sin(b.yaw) + (o.z - b.z) * Math.cos(b.yaw)) > 0);
        b.stopped = near || !!ahead;
        if (!b.stopped) {
          const t = def.route[b.idx], dx = t.x - b.x, dz = t.z - b.z, d = Math.hypot(dx, dz);
          if (d < 0.5) {
            b.idx++;
            if (b.idx >= def.route.length) this.landBoat(k, b);
          } else {
            const s = Math.min(d, def.boatSpeed * dt);
            b.x += dx / d * s; b.z += dz / d * s; b.yaw = Math.atan2(dx, dz);
          }
        }
      }
      b.mesh.position.set(b.x, b.boatY + Math.sin(ctx.clock * 1.3 + b.x) * 0.12, b.z);
      b.mesh.rotation.y = b.yaw;
      b.flag.rotation.x = Math.sin(ctx.clock * 4 + b.x) * 0.15;
      b.flash = Math.max(0, (b.flash || 0) - dt);
    }
    if (k.state === "khadung") {
      const alive = this.boats.filter((b) => !b.dead);
      if (!alive.length) this.fail(k, "Cả hai thuyền quân Triệu Trung bị đánh chìm.");
      else if (alive.every((b) => b.landed)) this.ready(k);
    }
  }

  landBoat(k, b) {
    const ctx = this.ctx, def = k.def, L = def.landing;
    b.landed = true;
    const f = ctx.sim.fronts.A;
    f.q.ta.GIAO_DV += def.effect.qTa;                // quân Triệu Trung nhập cánh A (ĐỀ XUẤT BẢN THỬ)
    for (let i = 0; i < def.effect.troops; i++) {
      ctx.crowd.spawn({ side: "ta", unit: "GIAO_DV", role: "zone", front: "A", tint: [1.25, 0.9, 0.55],
        x: L.x + ctx.rng.range(-6, 6), z: L.z + ctx.rng.range(-3, 3), legionMult: ctx.stats.legionMult });
    }
    this.reward(k, def.perBoat);
    ctx.director.say(`${b.name} cập bến: người Tống của Chiêu Văn vương lên bãi (+${def.effect.qTa} quân cho cánh A).`, 4, "good");
    ctx.audio.play("capture", b.x, b.z);
    ctx.storyEvent?.("coAoTong:land");             // khung comic D2 "Áo Tống trên bến" (lần chơi đầu, battle.js)
  }

  // ---- Mũi tên thư ------------------------------------------------------------------------------
  spawnBundles(k) {
    const ctx = this.ctx;
    for (const b of this.bundles) ctx.scene.remove(b.mesh);
    this.bundles = k.def.bundles.map((p) => {
      const m = new THREE.Group();
      const bundle = new THREE.Mesh(merge([
        ...[-0.08, 0, 0.08].flatMap((x) => [part(new THREE.CylinderGeometry(0.025, 0.025, 1.1, 4), PAL.go, { x, y: 0.55 }), part(new THREE.ConeGeometry(0.05, 0.12, 4), PAL.sat, { x, y: 1.15 })]),
        part(new THREE.BoxGeometry(0.28, 0.2, 0.05), PAL.trung, { y: 0.6, z: 0.06 }),
        part(new THREE.BoxGeometry(0.3, 0.06, 0.3), PAL.son, { y: 0.35 }),
      ]), lambert({ emissive: 0x3a2a08 }));
      m.add(bundle);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.85, 20), new THREE.MeshBasicMaterial({ color: 0xf1d98a, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; m.add(ring);
      m.position.set(p.x, heightAt(p.x, p.z), p.z); ctx.scene.add(m);
      return { ...p, mesh: m, taken: false };
    });
    this.carried = 0;
  }

  updateBundles(dt) {
    const ctx = this.ctx, k = this.get("muiTenThu"), h = ctx.hero;
    if (!k || k.state !== "khadung") return;
    for (const b of this.bundles) {
      if (b.taken) continue;
      b.mesh.rotation.y += dt;
      if (h.alive && Math.hypot(h.x - b.x, h.z - b.z) < 1.8) {
        b.taken = true; this.carried++; ctx.scene.remove(b.mesh);
        ctx.fx.text(h.x, h.z, `Bó tên buộc thư ${this.carried}/3`, "#f1d98a"); ctx.audio.play("pickup");
        this.reward(k, 1);
      }
    }
    if (this.carried >= k.def.bundles.length) {
      const gen = ctx.director.generals[k.def.deliverTo];
      if (gen && gen.alive && !gen.dead && Math.hypot(gen.x - h.x, gen.z - h.z) < k.def.deliverR) {
        ctx.director.say("Đã giao 3 bó tên cho Nguyễn Khoái. Bấm {kesach} (Lệnh Kế Sách) để bắn yểm trợ.", 5, "good");
        this.ready(k);
      }
    }
  }

  // Băng chữ qua hàng đợi của director (fx.banner chỉ giữ một băng: chiếm A1 gọi ba băng cùng nhịp thì chỉ còn băng cuối).
  // low: băng phụ — luôn hiện sau "CHIẾM ĐỒN" và tên pha mới khi cùng một nhịp
  banner(text, color, T, low = false) { const d = this.ctx.director; if (d?.banner) d.banner(text, color, T, low); else this.ctx.fx.banner(text, color, T); }

  // ---- chung --------------------------------------------------------------------------------------
  ready(k) {
    k.state = "sansang"; k.left = k.def.window * this.windowMult;
    this.banner(`KẾ SÁCH SẴN SÀNG · ${k.def.name.toUpperCase()} · {KESACH}`, "#ffd27a", 1.8);
    this.ctx.audio.play("drums3");
  }

  // Người chơi bấm Lệnh Kế Sách.
  trigger() {
    const k = this.list.find((x) => x.state === "sansang");
    if (!k) {
      const any = this.list.find((x) => x.state === "khadung");
      this.ctx.director.say(any ? `${any.def.name}: chưa sẵn sàng — ${any.def.text}` : "Chưa có Kế Sách nào khả dụng.", 3);
      return false;
    }
    if (k.def.id === "coAoTong") return this.fireCoAoTong(k);
    if (k.def.id === "muiTenThu") return this.fireMuiTenThu(k);
    return false;
  }

  fireCoAoTong(k) {
    const ctx = this.ctx, E = k.def.effect, L = k.def.landing, dur = E.dur * this.effectMult;
    const f = ctx.sim.fronts.A;
    f.panic = Math.max(f.panic || 0, Math.round(dur)); f.panicRate = E.skPerSec;
    let n = 0;
    for (const a of ctx.crowd.agents) {
      if (a.side !== "dich" || a.state === "dead") continue;
      if (Math.hypot(a.x - L.x, a.z - L.z) < E.radius || (a.front === "A" && Math.abs(a.x - lineToX(FRONTS.A, f.x)) < E.radius)) { a.panicT = dur; n++; }
    }
    this.banner("QUÂN NGUYÊN HOANG MANG!", "#ffd27a", 2); ctx.audio.play("horn");
    ctx.fx.ring(L.x, L.z, E.radius, 0xf1d98a, 1.2);
    for (let i = 0; i < 24; i++) ctx.fx.embers(L.x + (Math.random() - 0.5) * 16, L.z + (Math.random() - 0.5) * 8);
    this.succeed(k, `Cờ áo Tống tung bay trên bến: cánh Nguyên trong ${E.radius} m hoang mang ${Math.round(dur)} s (Sĩ Khí −${E.skPerSec}/s, chính xác −30%).`);
    return true;
  }

  fireMuiTenThu(k) {
    const ctx = this.ctx, sim = ctx.sim;
    const tid = k.def.targets.find((id) => sim.bases[id].owner === "dich");
    if (!tid) { this.fail(k, "Không còn doanh trại Nguyên để bắn thư vào.", false); return false; }
    const gen = ctx.director.generals[k.def.deliverTo], p = ctx.director.basePos(tid);
    // loạt tên có thư bay vào doanh trại
    for (let i = 0; i < 24; i++) {
      const sx = (gen?.x ?? p.x - 30) + ctx.rng.range(-3, 3), sz = (gen?.z ?? p.z) + ctx.rng.range(-3, 3);
      const tx = p.x + ctx.rng.range(-8, 8), tz = p.z + ctx.rng.range(-8, 8), T = Math.hypot(tx - sx, tz - sz) / 30 + 0.2 * ctx.rng.next();
      ctx.crowd.arrows.push({ x: sx, y: heightAt(sx, sz) + 2, z: sz, vx: (tx - sx) / T, vz: (tz - sz) / T, vy: 4.9 * T, t: 0, T, side: "ta" });
    }
    this.pendingVolley = { at: ctx.clock + 1.6, base: tid, k };
    ctx.audio.play("bow"); ctx.audio.play("drum");
    return true;
  }
  resolveVolley() {
    const v = this.pendingVolley; if (!v || this.ctx.clock < v.at) return;
    this.pendingVolley = null;
    const ctx = this.ctx, b = ctx.sim.bases[v.base], n = v.k.def.effect.g;
    b.G = Math.max(0, b.G - n);
    let shown = 0;
    for (const a of ctx.crowd.agents) {
      if (a.role !== "garrison" || a.src !== v.base || a.state === "dead" || shown >= n) continue;
      shown++; ctx.fx.text(a.x, a.z, "buông vũ khí", "#e6dcc3"); ctx.crowd.release(a);
    }
    this.succeed(v.k, `Thư trên mũi tên tới doanh trại: ${n} lính phụ trợ buông vũ khí.`);
  }

  succeed(k, msg) {
    k.state = "thanhcong"; k.success = true;
    this.reward(k, k.def.hk);
    this.ctx.director.say(msg, 6, "good");
    this.banner(`KẾ SÁCH THÀNH CÔNG · +${k.def.hk} HÀO KHÍ`, "#f1d98a", 1.8);
  }

  fail(k, why, retry = true) {
    k.state = "thatbai"; k.retryT = retry ? k.def.retryAfter : Infinity;
    this.ctx.director.say(`Kế Sách "${k.def.name}" thất bại: ${why}${retry ? ` Dựng lại sau ${k.def.retryAfter} s.` : ""}`, 6, "bad");
  }

  update(dt) {
    this.updateBoats(dt); this.updateBundles(dt); this.resolveVolley();
    for (const k of this.list) {
      if (k.state === "sansang") {
        const was = k.left; k.left -= dt;
        if (was > 10 && k.left <= 10) this.ctx.director.say(`Kế Sách "${k.def.name}": cửa sổ còn 10 s!`, 3, "bad");
        if (k.left <= 0) {
          // hết cửa sổ: giữ thưởng lẻ, dựng lại (quân đã lên bãi thì chỉ mở lại cửa sổ)
          this.fail(k, "Hết cửa sổ mà chưa ra lệnh.");
          k.reopen = k.def.id === "coAoTong" && this.boats.some((b) => b.landed && !b.dead);
        }
      } else if (k.state === "thatbai" && Number.isFinite(k.retryT)) {
        k.retryT -= dt;
        if (k.retryT <= 0) {
          if (k.reopen) { k.reopen = false; k.attempts++; this.ready(k); }
          else if (k.def.id === "muiTenThu" && this.ctx.sim.bases.B2.owner !== "dich" && this.ctx.sim.bases.A2.owner !== "dich") k.retryT = Infinity;
          else this.open(k.def.id);
        }
      }
    }
  }

  // Checkpoint đầu pha: lưu trạng thái, khôi phục thì dựng lại thuyền, bó tên theo trạng thái đó.
  snapshot() {
    return { list: this.list.map((k) => ({ id: k.def.id, state: k.state, got: k.got, attempts: k.attempts, success: k.success, retryT: k.retryT })) };
  }
  restore(snap) {
    const ctx = this.ctx;
    for (const b of this.boats) ctx.scene.remove(b.mesh);
    for (const b of this.bundles) ctx.scene.remove(b.mesh);
    this.boats = []; this.bundles = []; this.carried = 0; this.pendingVolley = null;
    for (const s of snap?.list || []) {
      const k = this.get(s.id); if (!k) continue;
      Object.assign(k, { got: s.got, success: s.success, retryT: s.retryT, reopen: false });
      if (s.state === "khadung" || s.state === "sansang") { k.state = "khoa"; this.open(s.id); k.attempts = s.attempts; }
      else { k.state = s.state; k.attempts = s.attempts; }
    }
  }

  // Cho HUD và bản đồ nhỏ.
  hud() {
    return this.list.map((k) => {
      let detail = "";
      if (k.def.id === "coAoTong" && k.state === "khadung") {
        detail = "thuyền " + this.boats.map((b) => b.dead ? "chìm" : b.landed ? "đã cập bến" : `${Math.round((b.hp / b.maxHp) * 100)}%${b.stopped ? " · dừng" : ""}`).join(" · ");
      }
      if (k.def.id === "muiTenThu" && k.state === "khadung") detail = this.carried >= 3 ? "mang tới Nguyễn Khoái" : `bó tên ${this.carried}/3`;
      if (k.state === "sansang") detail = `bấm {kesach} · còn ${Math.ceil(k.left)} s`;
      if (k.state === "thatbai" && Number.isFinite(k.retryT)) detail = `dựng lại sau ${Math.ceil(k.retryT)} s`;
      return { id: k.def.id, name: k.def.name, quyMo: k.def.quyMo === "lon" ? "Lớn" : "Nhỏ", hk: k.def.hk, got: k.got, state: k.state, word: STATE_WORD[k.state], detail, label: k.def.label };
    });
  }
}
