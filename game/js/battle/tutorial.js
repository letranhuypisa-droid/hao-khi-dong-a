// battle/tutorial.js — màn Huấn luyện ở Võ trường (đợt 7): dạy từng thao tác bằng bài tập có điều kiện qua bài,
// thay cho bảng phím chỉ nằm trong bảng tạm dừng. Chạy trong runArena (arena.js, opts.mode = "huanluyen"); cùng
// hệ chiến đấu với trận chính. Tướng không chết (máu không xuống dưới 60%), lính tập mặc định không đánh (thẻ tấn
// công = 0), chỉ bài Đỡ mới cho lính đánh, bài Phản đòn sĩ quan chỉ dùng đòn viền đỏ.
//
// Mỗi bài: title, icons (assets/icons), text(d) → HTML, setup(d), check(d) → tiến độ 0..1, goal(d) → dòng mục tiêu.
// Bài info (không có check) qua bằng Enter / chạm "Tiếp" / nút Back tay cầm. Bài có check: đủ 1 thì tự sang bài sau
// 1,4 s; kẹt quá 25 s thì hiện "Enter để bỏ qua".

import * as THREE from "three";
import { TIERS } from "../data/tuning.js";
import { MOVE_INFO, ICON } from "../data/moves-info.js";
import { say, short, seqFor, devOf } from "../data/controls.js";
import { BigUnit } from "./units.js";
import { heightAt } from "./world.js";

// chữ phím theo thiết bị đang dùng (bàn phím, cảm ứng, tay cầm): cùng bảng nhãn với HUD, bảng phím và các dòng gợi ý (data/controls.js)
const kb = (d, k) => `<kbd>${say(k, devOf(d.ctx))}</kbd>`;
const verbHold = (d) => (devOf(d.ctx) === 1 ? "Chạm" : "Giữ");        // nút Lệnh cảm ứng là bật / tắt, bàn phím và tay cầm là giữ
const verbPress = (d) => (devOf(d.ctx) === 1 ? "Chạm" : "Bấm");       // cảm ứng chạm nút, còn lại bấm
const pct = (v, of) => Math.min(1, v / of);

const STEPS = [
  { id: "intro", title: "Võ trường · Huấn luyện", icons: ["n", "c3", "dodge", "ult"],
    text: (d) => `Trần Quốc Toản luyện song đao trước khi ra bến Hàm Tử. 11 bài ngắn, chừng bốn phút. Trong lúc tập tướng không gục. ${verbPress(d)} ${kb(d, "next")} để bắt đầu; ${kb(d, "pause")} để tạm dừng hoặc rời sân.` },
  { id: "move", title: "Bài 1 · Di chuyển", icons: [],
    text: (d) => `Dùng ${kb(d, "move")} chạy tới vòng vàng.`,
    setup: (d) => d.marker(10, -6), check: (d) => (Math.hypot(d.ctx.hero.x - d.mk.x, d.ctx.hero.z - d.mk.z) < 2.3 ? 1 : 0), goal: () => "Tới vòng vàng" },
  { id: "cam", title: "Bài 2 · Camera", icons: ["lock"],
    text: (d) => `Xoay camera bằng ${kb(d, "cam")}. Đứng yên một lúc thì camera tự quay theo hướng chạy.`,
    check: (d) => pct(d.st.camTurn, 3), goal: () => "Xoay camera một vòng" },
  { id: "n", title: "Bài 3 · Đòn thường N", icons: ["n"],
    text: (d) => `Bấm ${kb(d, "n")} liên tiếp: song đao chém chuỗi 6 nhát N1–N6, nhát thứ 6 xoay tròn đẩy lùi. Đòn tự xoay về kẻ gần nhất theo hướng bạn đẩy. Hạ 3 lính tập.`,
    setup: (d) => { d.passive(); for (let i = 0; i < 4; i++) d.soldier(); },
    tick: (d) => d.keep(3),
    check: (d) => (Math.min(3, d.st.kills) + (d.st.maxN >= 4 ? 1 : 0)) / 4,
    goal: (d) => `Hạ lính ${Math.min(3, d.st.kills)}/3 · chuỗi tới N4 ${d.st.maxN >= 4 ? "✓" : "✗"}` },
  { id: "c", title: "Bài 4 · Đòn mạnh C", icons: ["c1", "c2", "c3", "c4"], captions: ["C", "N → C", "N N → C", "N N N → C"],
    text: (d) => `Bấm ${kb(d, "c")} ngay sau chuỗi N để đổi sang đòn mạnh: bao nhiêu nhát N trước thì ra C kế tiếp. ${devOf(d.ctx) === 1 ? "Biểu tượng nút C" : `Ô "${short("c")}"`} ở góc phải báo đòn C sẽ ra. Thử 3 đòn C khác nhau.`,
    setup: (d) => { d.passive(); for (let i = 0; i < 6; i++) d.soldier(); },
    tick: (d) => d.keep(5),
    check: (d) => pct(d.cSet().size, 3), goal: (d) => `Đã dùng: ${[...d.cSet()].join(", ") || "chưa có"}` },
  { id: "dodge", title: "Bài 5 · Né và Lướt chém", icons: ["dodge", "dash"],
    text: (d) => `Bấm ${kb(d, "dodge")} để lộn né (bất tử 0,25 s; né 2 lần liền thì phải nghỉ). Vừa né xong bấm ${kb(d, "n")} hoặc ${kb(d, "c")}: Lướt chém lao tới.`,
    setup: (d) => { d.passive(); for (let i = 0; i < 4; i++) d.soldier(); },
    tick: (d) => d.keep(3),
    check: (d) => (Math.min(2, d.st.dodges) + (d.st.moves.has("DN") || d.st.moves.has("DC") ? 1 : 0)) / 3,
    goal: (d) => `Né ${Math.min(2, d.st.dodges)}/2 · Lướt chém ${d.st.moves.has("DN") || d.st.moves.has("DC") ? "✓" : "✗"}` },
  { id: "block", title: "Bài 6 · Đỡ", icons: ["block"],
    text: (d) => `Lính sắp đánh thì thân ửng đỏ. Giữ ${kb(d, "block")} để đỡ đòn trước mặt, lúc đỡ vẫn bước được. Đỡ 3 đòn.`,
    setup: (d) => { d.aggressive(3); for (let i = 0; i < 4; i++) d.soldier(); },
    tick: (d) => d.keep(3),
    check: (d) => pct(d.st.blocks, 3), goal: (d) => `Đỡ ${Math.min(3, d.st.blocks)}/3` },
  { id: "parry", title: "Bài 7 · Phản đòn", icons: ["ct"],
    text: (d) => `Đòn viền đỏ (vòng đỏ dưới chân sĩ quan) không đỡ được. Bấm ${kb(d, "block")} đúng lúc vòng đỏ vừa khép lại — trước cú bổ chừng một nhịp — để gạt đòn và chém trả.`,
    setup: (d) => { d.passive(); d.officer("doitruong", { redOnly: true }); },
    check: (d) => (d.st.parries > 0 ? 1 : 0),
    goal: (d) => d.st.redSeen >= 3 && !d.st.parries ? "Mẹo: bấm khi vòng đỏ gần đầy, đừng giữ trước" : "Phản đòn 1 lần" },
  { id: "break", title: "Bài 8 · Vỡ Thế và Đòn Quyết", icons: ["dq"],
    text: (d) => `Đánh liên tục cho cạn thanh vàng (Phá Thế) dưới tên sĩ quan: hắn Vỡ Thế, loạng choạng 3,5 s. Chạy lại gần bấm ${kb(d, "c")}: Đòn Quyết.`,
    setup: (d) => { d.aggressive(1); if (!d.officerAlive()) d.officer("doitruong"); },
    check: (d) => (d.st.moves.has("DQ") || d.st.officerKilled ? 1 : d.st.broke ? 0.6 : 0),
    goal: (d) => (d.st.broke ? `Vỡ Thế! Bấm ${say("c", devOf(d.ctx))} cạnh hắn` : "Làm cạn thanh Phá Thế") },
  { id: "skill", title: "Bài 9 · Phá Trận", icons: ["skill"],
    text: (d) => `Bấm ${kb(d, "skill")}: lao 18 m xuyên hàng địch, lính trên đường bị choáng. Bấm thêm trong 6 s để lao tiếp (tối đa 3 lần), rồi hồi 20 s.`,
    setup: (d) => { d.passive(); d.ctx.hero.phaTran.cd = 0; d.ctx.hero.phaTran.left = 0; for (let i = 0; i < 10; i++) d.soldier(8 + i * 1.2); },
    tick: (d) => d.keep(6),
    check: (d) => pct(d.st.skills, 2) * 0.5 + pct(d.st.skillHits, 4) * 0.5, goal: (d) => `Lao ${Math.min(2, d.st.skills)}/2 · trúng ${Math.min(4, d.st.skillHits)}/4 (đẩy hướng về phía địch rồi bấm)` },
  { id: "ult", title: "Bài 10 · Tuyệt Kỹ", icons: ["ult"],
    text: (d) => `Thanh xanh dưới máu là Khí Lực, đầy dần khi giao chiến. Đủ một vạch thì bấm ${kb(d, "ult")}: "Bóp Nát Quân Thù" — 10 s bất tử, 24 nhát chém quanh mình, xong cắm cờ tăng Công cho quân ta.`,
    setup: (d) => { d.passive(); d.ctx.hero.ki = Math.max(d.ctx.hero.ki, 100); for (let i = 0; i < 10; i++) d.soldier(); },
    tick: (d) => d.keep(8),
    check: (d) => (d.st.ult && d.ctx.hero.state !== "ult" ? 1 : d.st.ult ? 0.5 : 0), goal: (d) => (d.st.ult ? "Chém cho hết Tuyệt Kỹ" : "Bấm Tuyệt Kỹ") },
  { id: "lock", title: "Bài 11 · Khóa mục tiêu", icons: ["lock"],
    text: (d) => `Bấm ${kb(d, "lock")} để khóa sĩ quan gần nhất: camera và đòn đánh bám theo hắn. Bấm lại để bỏ khóa.`,
    setup: (d) => { d.passive(); d.officer("doitruong", { far: true }); },
    check: (d) => (d.ctx.hero.lock ? 1 : 0), goal: () => "Khóa sĩ quan" },
  { id: "cmd", title: "Trong trận · Mệnh Lệnh", icons: ["cmd", "tiencong", "giuvung", "theota", "tiepvien"],
    captions: ["Mở vòng", "1", "2", "3", "4"],
    text: (d) => `Trận Hàm Tử có hai mặt trận cách nhau 150 m; bạn không ở cả hai nơi được. ${verbHold(d)} ${kb(d, "cmd")} mở vòng Mệnh Lệnh (trận chậm lại ×0,2), bấm 1–4: <b>Tiến công</b>, <b>Giữ vững</b>, <b>Theo ta</b> (quân đi theo tướng), <b>Gọi tiếp viện</b>. Đổi mặt trận: ${kb(d, "cmdSwap")}.` },
  { id: "hk", title: "Trong trận · Hào Khí", icons: ["tpc"],
    text: (d) => `Thanh Hào Khí ở đỉnh màn tăng khi chiếm Cứ Điểm, hạ sĩ quan, làm nhiệm vụ, thi hành Kế Sách. Đủ 100 thì bấm ${kb(d, "tpc")}: <b>Tổng Phản Công</b> — cả hai mặt trận xông lên 25 s, tướng có thêm một Tuyệt Kỹ Hào Khí.` },
  { id: "base", title: "Trong trận · Cứ Điểm và Kế Sách", icons: ["giuvung", "kesach"], captions: ["Cứ Điểm", "Kế Sách"],
    text: (d) => `Đồn, doanh trại có vòng tròn dưới đất: hạ hết quân đồn trú và sĩ quan trấn thủ, rồi đứng trong vòng cho tới khi chiếm xong. Kế Sách (như "Cờ áo Tống") hiện ở cột phải: làm đủ điều kiện thì bấm ${kb(d, "kesach")}.` },
  { id: "end", title: "Xong huấn luyện!", icons: ["n", "c4", "skill", "ult", "tpc"], final: true,
    text: (d) => `Bạn đã sẵn sàng ra bến Hàm Tử. Bảng đòn đầy đủ luôn có ở thẻ <b>Huấn luyện</b> và trong bảng tạm dừng. ${verbPress(d)} ${kb(d, "next")} để về Doanh trại.` },
];

export class TutorialDirector {
  constructor(ctx, o) {
    this.ctx = ctx; ctx.director = this; this.o = o;
    this.mode = "huanluyen"; this.time = 0; this.ko = 0; this.msgs = []; this.over = false; this.result = null;
    this.events = {}; this.generals = {}; this.pickups = []; this.phase = 0;
    this.steps = STEPS; this.i = -1; this.doneT = 0; this.want = false; this.lastYaw = null; this.panelKey = "";
    this.go(0);
  }
  get step() { return this.steps[this.i]; }

  // ---- dựng bài ------------------------------------------------------------------------------------------
  go(i) {
    this.clear();
    this.i = i; this.stepT = 0; this.doneT = 0; this.completed = false; this.panelKey = "";
    this.st = { kills: 0, maxN: 0, moves: new Set(), dodges: 0, blocks: 0, parries: 0, redSeen: 0, broke: false, officerKilled: false,
      skills: 0, skillHits: 0, ult: false, camTurn: 0 };
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
  cSet() { return new Set([...this.st.moves].filter((k) => /^C[1-6]$/.test(k))); }

  // ---- vòng lặp ------------------------------------------------------------------------------------------
  intake(inp) { if (inp.pressed.next || inp.pressed.map) this.want = true; }
  update(dt) {
    const ctx = this.ctx, h = ctx.hero, S = this.step;
    for (const m of this.msgs) m.t += dt; this.msgs = this.msgs.filter((m) => m.t < m.T);
    if (this.over) return;
    this.time += dt; this.stepT += dt;
    if (h.hp < h.maxHp * 0.6) h.hp = h.maxHp * 0.6;
    // góc camera đã xoay (bài 2)
    const y = ctx.cam.yaw; if (this.lastYaw != null) this.st.camTurn += Math.abs(y - this.lastYaw); this.lastYaw = y;
    // sĩ quan bài Phản đòn: chỉ dùng đòn viền đỏ, không vỡ thế, không chết
    for (const u of ctx.units) if (u.redOnly && u.alive && !u.dead) {
      u.atkCd = 9; if (u.state !== "red") u.redCd = Math.min(u.redCd, 2.2);
      u.poise = u.poiseMax; u.hp = Math.max(u.hp, u.maxHp * 0.5);
      if (u.state === "red" && !u._seen) { u._seen = true; this.st.redSeen++; } if (u.state !== "red") u._seen = false;
    }
    if (this.mk) this.mk.mesh.children[0].material.opacity = 0.55 + 0.3 * Math.sin(this.time * 5);
    S.tick?.(this);
    if (this.mk && !this.completed && S.check?.(this) >= 1) { ctx.scene.remove(this.mk.mesh); }
    const want = this.want; this.want = false;
    if (!S.check) {                                          // bài info: chờ Tiếp
      if (want && this.stepT > 0.4) { if (S.final) this.finish(true); else this.go(this.i + 1); }
      return;
    }
    if (!this.completed && S.check(this) >= 1) {
      this.completed = true; this.doneT = 1.4;
      ctx.audio.play("capture");                          // bảng bài tập tự báo "✓ Xong" (banner giữa màn đè lên bảng)
    }
    if (this.completed) { this.doneT -= dt; if (this.doneT <= 0) this.go(this.i + 1); }
    else if (want && this.stepT > 25) this.go(this.i + 1);   // kẹt thì cho bỏ qua
  }

  // ---- bảng hướng dẫn (ArenaHUD gọi mỗi lần cập nhật) ----------------------------------------------------
  tutorialHUD(E) {
    const S = this.step, touch = this.ctx.touch, dev = devOf(this.ctx);
    E.mode.textContent = "VÕ TRƯỜNG · HUẤN LUYỆN";
    const nAct = this.steps.filter((x) => x.check).length, k = this.steps.slice(0, this.i + 1).filter((x) => x.check).length;
    E.big.textContent = S.check ? `Bài ${k} / ${nAct}` : S.final ? "Xong" : "Ghi nhớ";
    E.sub.textContent = `${this.ko} KO`; E.medals.innerHTML = "";
    const el = E.tut; el.style.display = "";
    const key = `${this.i}|${dev}`;
    if (key !== this.panelKey) {
      this.panelKey = key;
      const icons = (S.icons || []).map((ic, j) => `<figure><img src="${ICON(ic)}" alt=""><figcaption>${S.captions?.[j] != null ? seqFor(S.captions[j], dev) : MOVE_INFO[Object.keys(MOVE_INFO).find((m) => MOVE_INFO[m].icon === ic)]?.name ?? ""}</figcaption></figure>`).join("");
      el.innerHTML = `<div class="tut-head"><b>${S.title}</b><span>${S.check ? `${k} / ${nAct} bài` : ""}</span></div>
        <div class="tut-body">${icons ? `<div class="tut-icons">${icons}</div>` : ""}<div class="tut-text">${S.text(this)}</div></div>
        ${S.check ? `<div class="tut-prog"><div data-tp></div></div><div class="tut-goal" data-tg></div>` : ""}
        <div class="tut-foot"><span class="small" data-tf></span>${S.check ? "" : `<button class="primary" data-tut="next">${S.final ? "Về Doanh trại" : "Tiếp"} ▶</button>`}</div>`;
      el.classList.remove("enter", "done"); void el.offsetWidth; el.classList.add("enter");
      el.querySelector("[data-tut=next]")?.addEventListener("pointerdown", (e) => { e.stopPropagation(); this.want = true; });
    }
    if (S.check) {
      const p = Math.min(1, S.check(this));
      el.querySelector("[data-tp]").style.width = `${Math.round(p * 100)}%`;
      el.querySelector("[data-tg]").textContent = this.completed ? "✓ Xong" : S.goal?.(this) ?? "";
      el.classList.toggle("done", this.completed);
      el.querySelector("[data-tf]").innerHTML = !this.completed && this.stepT > 25 && dev !== 1 ? `Kẹt? ${kb(this, "next")} để bỏ qua bài này` : "";   // cảm ứng: bài tập không có nút Tiếp nên không hứa điều không làm được
    } else el.querySelector("[data-tf]").innerHTML = touch ? "" : `hoặc bấm ${kb(this, "next")}`;
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
    this.result = { arena: true, tutorial: true, mode: "huanluyen", done: ok, reached: this.i, total: this.steps.length, why, ko: this.ko, durSec: this.time, aborted: !!this.o.abortedFlag, at: Date.now() };
    if (ok) this.ctx.audio.play("cheer");
  }
}
