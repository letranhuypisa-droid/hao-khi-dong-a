// battle/tutorial.js — màn Huấn luyện ở Võ trường (đợt 7): dạy từng thao tác bằng bài tập có điều kiện qua bài,
// thay cho bảng phím chỉ nằm trong bảng tạm dừng. Chạy trong runArena (arena.js, opts.mode = "huanluyen"); cùng
// hệ chiến đấu với trận chính. Tướng không chết (máu không xuống dưới 60%), lính tập mặc định không đánh (thẻ tấn
// công = 0), chỉ bài Đỡ mới cho lính đánh, bài Phản đòn sĩ quan chỉ dùng đòn viền đỏ.
//
// Đợt 11: chữ của các bài, điều kiện qua bài (conds), đếm bài, bỏ qua bài kẹt nằm ở data/tutorial-steps.js (thuần, kiểm trong Node:
// tests/tutorial-steps.test.mjs). File này giữ phần dựng cảnh (lính tập, sĩ quan, vòng vàng), vòng lặp và bảng hướng dẫn trên màn hình.
//
// Bài info (không có conds) qua bằng Enter / chạm "Tiếp" / nút Back tay cầm. Bài tập: đủ điều kiện thì tự sang bài sau 1,4 s;
// kẹt quá SKIP_AFTER s thì bỏ qua được (Enter / nút Back, hoặc nút "Bỏ qua bài" trên cảm ứng — bài tập không có nút Tiếp).

import * as THREE from "three";
import { TIERS } from "../data/tuning.js";
import { MOVE_INFO, ICON } from "../data/moves-info.js";
import { seqFor, devOf } from "../data/controls.js";
import { STEPS, isDrill, freshStats, cUsed, progressOf, doneOf, passLine, goalLine, tutorialProgress, skipOffer, kbd } from "../data/tutorial-steps.js";
import { BigUnit } from "./units.js";
import { heightAt } from "./world.js";

export class TutorialDirector {
  constructor(ctx, o) {
    this.ctx = ctx; ctx.director = this; this.o = o;
    this.mode = "huanluyen"; this.time = 0; this.ko = 0; this.msgs = []; this.over = false; this.result = null;
    this.events = {}; this.generals = {}; this.pickups = []; this.phase = 0;
    this.steps = STEPS; this.i = -1; this.doneT = 0; this.want = false; this.lastYaw = null; this.panelKey = ""; this.lastLock = 0;
    this.go(0);
  }
  get step() { return this.steps[this.i]; }

  // ---- dựng bài ------------------------------------------------------------------------------------------
  go(i) {
    this.clear();
    this.i = i; this.stepT = 0; this.doneT = 0; this.completed = false; this.panelKey = "";
    this.st = freshStats();
    this.step.setup?.(this);
    if (i > 0) this.ctx.audio.play("drum");
  }
  clear() {
    const ctx = this.ctx;
    for (const a of [...ctx.crowd.agents]) if (a.side === "dich") ctx.crowd.release(a);
    for (const u of ctx.units) if (u.alive) u.dispose();
    ctx.units.length = 0; ctx.hero.lock = null;
    if (this.mk?.mesh) { ctx.scene.remove(this.mk.mesh); this.mk.mesh.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); }); }
    this.mk = null;
  }
  passive() { this.ctx.diff = { ...this.ctx.diff, tokens: 0, dmg: 0.25 }; }
  aggressive(n) { this.ctx.diff = { ...this.ctx.diff, tokens: n, dmg: 0.3 }; }
  soldier(dist = null) {
    const ctx = this.ctx, h = ctx.hero, a = dist == null ? ctx.rng.range(0, Math.PI * 2) : h.yaw + ctx.rng.range(-0.25, 0.25), r = dist ?? ctx.rng.range(7, 12);
    return ctx.crowd.spawn({ side: "dich", unit: "KHIEN_NG", kit: ctx.rng.next() < 0.6 ? "NG_DAO" : "NG_GIAO", tier: "thuong", role: "zone", front: null,
      x: h.x + Math.sin(a) * r, z: h.z + Math.cos(a) * r, yaw: a + Math.PI });
  }
  keep(n) {
    const alive = this.ctx.crowd.agents.filter((a) => a.side === "dich" && this.ctx.crowd.hittable(a)).length;
    if (alive < n && (this.respawnT = (this.respawnT || 0) - 1 / 60) <= 0) { this.soldier(); this.respawnT = 0.8; }
  }
  officer(tier, o = {}) {
    const ctx = this.ctx, h = ctx.hero, r = o.far ? 13 : 8, a = h.yaw;
    const u = new BigUnit(ctx, { kind: "officer", side: "dich", tier, name: TIERS[tier].name + " luyện tập", x: h.x + Math.sin(a) * r, z: h.z + Math.cos(a) * r, awake: true, aggro: 200 });
    u.home = { x: 0, z: 0 }; u.redOnly = !!o.redOnly; ctx.units.push(u); this.off = u;
    return u;
  }
  officerAlive() { return this.off && this.off.alive && !this.off.dead; }
  marker(x, z) {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.5, 2.1, 48), new THREE.MeshBasicMaterial({ color: 0xf1d98a, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.15; g.add(ring);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.4, 9, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }));
    beam.position.y = 4.5; g.add(beam);
    g.position.set(x, heightAt(x, z), z); this.ctx.scene.add(g);
    this.mk = { x, z, mesh: g };
  }
  cSet() { return cUsed(this.st); }

  // ---- vòng lặp ------------------------------------------------------------------------------------------
  intake(inp) { if (inp.pressed.next || inp.pressed.map) this.want = true; }
  update(dt) {
    const ctx = this.ctx, h = ctx.hero, S = this.step, st = this.st;
    for (const m of this.msgs) m.t += dt; this.msgs = this.msgs.filter((m) => m.t < m.T);
    if (this.over) return;
    this.time += dt; this.stepT += dt;
    if (h.hp < h.maxHp * 0.6) h.hp = h.maxHp * 0.6;
    // góc camera đã xoay (bài 2)
    const y = ctx.cam.yaw; if (this.lastYaw != null) st.camTurn += Math.abs(y - this.lastYaw); this.lastYaw = y;
    // bấm Đỡ hụt: cửa sổ phản đòn trôi qua mà không có đòn đỏ trúng thì hero.parryLock đặt khóa 0,5 s mà không báo gì; bài Phản đòn nói rõ vì sao hụt
    if (h.parryLock > this.lastLock) { this.lastLock = h.parryLock; st.parryMiss++; st.missT = 3; st.missRed = !!(this.off && this.off.alive && this.off.state === "red"); }
    st.missT = Math.max(0, st.missT - dt);
    // sĩ quan bài Phản đòn: chỉ dùng đòn viền đỏ, không vỡ thế, không chết
    for (const u of ctx.units) if (u.redOnly && u.alive && !u.dead) {
      u.atkCd = 9; if (u.state !== "red") u.redCd = Math.min(u.redCd, 2.2);
      u.poise = u.poiseMax; u.hp = Math.max(u.hp, u.maxHp * 0.5);
      if (u.state === "red" && !u._seen) { u._seen = true; st.redSeen++; } if (u.state !== "red") u._seen = false;
    }
    if (this.mk) this.mk.mesh.children[0].material.opacity = 0.55 + 0.3 * Math.sin(this.time * 5);
    S.tick?.(this);
    const cs = isDrill(S) ? S.conds(this) : null;               // điều kiện qua bài của bài tập (thẻ ghi nhớ: null)
    if (this.mk && !this.completed && cs && doneOf(cs)) { ctx.scene.remove(this.mk.mesh); }
    const want = this.want; this.want = false;
    if (!cs) {                                                  // bài info: chờ Tiếp
      if (want && this.stepT > 0.4) { if (S.final) this.finish(true); else this.go(this.i + 1); }
      return;
    }
    if (!this.completed && doneOf(cs)) {
      this.completed = true; this.doneT = 1.4;
      ctx.audio.play("capture");                          // bảng bài tập tự báo "✓ Xong" (banner giữa màn đè lên bảng)
    }
    if (this.completed) { this.doneT -= dt; if (this.doneT <= 0) this.go(this.i + 1); }
    else if (want && skipOffer({ drill: true, dev: devOf(ctx), stepT: this.stepT, completed: false })) this.go(this.i + 1);   // kẹt thì cho bỏ qua
  }

  // ---- bảng hướng dẫn (ArenaHUD gọi mỗi lần cập nhật) ----------------------------------------------------
  tutorialHUD(E) {
    const S = this.step, touch = this.ctx.touch, dev = devOf(this.ctx), P = tutorialProgress(this.steps, this.i), drill = isDrill(S);
    E.mode.textContent = "VÕ TRƯỜNG · HUẤN LUYỆN";
    E.big.textContent = drill ? `Bài ${P.k} / ${P.n}` : S.final ? "Xong" : "Ghi nhớ";
    E.sub.textContent = `${this.ko} KO`; E.medals.innerHTML = "";
    const el = E.tut; el.style.display = "";
    const key = `${this.i}|${dev}`;
    if (key !== this.panelKey) {
      this.panelKey = key;
      const icons = (S.icons || []).map((ic, j) => `<figure><img src="${ICON(ic)}" alt=""><figcaption>${S.captions?.[j] != null ? seqFor(S.captions[j], dev) : MOVE_INFO[Object.keys(MOVE_INFO).find((m) => MOVE_INFO[m].icon === ic)]?.name ?? ""}</figcaption></figure>`).join("");
      // dòng "Qua bài khi: …" nằm ngay trong thẻ (cùng danh sách conds với thanh tiến độ và dòng mục tiêu); nút "Bỏ qua bài" dựng sẵn, ẩn, bật khi kẹt (cảm ứng)
      el.innerHTML = `<div class="tut-head"><b>${S.title}</b><span>${drill ? `${P.k} / ${P.n} bài` : ""}</span></div>
        <div class="tut-body">${icons ? `<div class="tut-icons">${icons}</div>` : ""}<div class="tut-text">${S.text(this)}${drill ? `<b class="tut-pass">${passLine(S.conds(this))}</b>` : ""}</div></div>
        ${drill ? `<div class="tut-prog"><div data-tp></div></div><div class="tut-goal" data-tg></div>` : ""}
        <div class="tut-foot"><span class="small" data-tf></span>${drill ? `<button data-tut="skip" hidden>Bỏ qua bài ▶</button>` : `<button class="primary" data-tut="next">${S.final ? "Về Doanh trại" : "Tiếp"} ▶</button>`}</div>`;
      el.classList.remove("enter", "done"); void el.offsetWidth; el.classList.add("enter");
      for (const b of el.querySelectorAll("[data-tut]")) b.addEventListener("pointerdown", (e) => { e.stopPropagation(); this.want = true; });
    }
    const tf = el.querySelector("[data-tf]");
    if (drill) {
      const cs = S.conds(this), offer = skipOffer({ drill, dev, stepT: this.stepT, completed: this.completed });
      el.querySelector("[data-tp]").style.width = `${Math.round(progressOf(cs) * 100)}%`;
      el.querySelector("[data-tg]").textContent = this.completed ? "✓ Xong" : S.hint?.(this) ?? goalLine(cs);
      el.classList.toggle("done", this.completed);
      const skip = el.querySelector("[data-tut=skip]"); if (skip.hidden !== (offer !== "button")) skip.hidden = offer !== "button";
      const hint = offer === "hint" ? `Kẹt? ${kbd(this, "next")} để bỏ qua bài này` : "";   // cảm ứng có nút, bàn phím / tay cầm có dòng nhắc phím
      if (tf.innerHTML !== hint) tf.innerHTML = hint;
    } else tf.innerHTML = touch ? "" : `hoặc bấm ${kbd(this, "next")}`;
  }

  // ---- móc từ tướng, lính, sĩ quan -----------------------------------------------------------------------
  onHeroAction(kind, v) {
    const st = this.st; if (!st) return;
    if (kind === "move") { st.moves.add(v); if (v[0] === "N") st.maxN = Math.max(st.maxN, Number(v[1])); }
    else if (kind === "dodge") st.dodges++;
    else if (kind === "block") st.blocks++;
    else if (kind === "parry") st.parries++;
    else if (kind === "skill") st.skills++;
    else if (kind === "skillHit") st.skillHits += v;
    else if (kind === "ult") st.ult = true;
  }
  say(text, T = 4, kind = "info") { this.msgs.push({ text, T, kind, t: 0 }); }
  onSoldierKilled(a, opt) { if (a.side === "dich" && opt.by === "hero") { this.ko++; this.st.kills++; } }
  onOfficerKilled(u) { this.ko++; this.st.officerKilled = true; this.ctx.fx.banner(`ĐÃ HẠ ${TIERS[u.tier].name.toUpperCase()}`, "#e6dcc3", 1); }
  onBossDefeated() { this.ko++; }
  onOfficerAwake() {}
  onBreak() { this.st.broke = true; this.ctx.fx.banner("VỠ THẾ · BẤM {C} ĐỂ RA ĐÒN QUYẾT", "#ffd27a", 1.1); this.ctx.audio.play("parry"); }
  onHeroHit() {}
  onRevive() {}
  onUlt() {}
  onCounterBoss() {}
  ultQ() {}
  plantFlag(x, z, r) { this.ctx.fx.ring(x, z, r, 0xf1d98a, 0.8); }
  damageGate() {}
  onAllyGeneralDown() {}
  onHeroDead() { const h = this.ctx.hero; h.alive = true; h.state = "free"; h.hp = h.maxHp; h.invuln = 2; }
  finish(ok, why = "") {
    if (this.over) return;
    this.over = true; this.clear();
    // progress: { k, n, where } — bài tập đã tới / tổng bài tập (main.js exitLine); trước đợt 11 trả chỉ số trong CẢ 16 mục nên thông báo ghi "bài k / 16"
    this.result = { arena: true, tutorial: true, mode: "huanluyen", done: ok, progress: tutorialProgress(this.steps, this.i), why, ko: this.ko, durSec: this.time, aborted: !!this.o.abortedFlag, at: Date.now() };
    if (ok) this.ctx.audio.play("cheer");
  }
}
