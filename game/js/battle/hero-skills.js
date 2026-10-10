// battle/hero-skills.js — kỹ năng (ô 1, ô 2) và Tuyệt Kỹ của tướng người chơi, theo id kỹ năng của data/heroes.js (SKILLS,
// HEROES[id].skills). Mỗi mục:
//   { slot, start(h) → bool, update(h, dt), tick?(h, dt), hud(h) → { ready, cd }, ready?(h), armored?(h, hit) → bool,
//     interrupted?(h, hit) }
// start trả false khi chưa dùng được (hồi chiêu, thiếu Khí Lực, không có mục tiêu) — hero.js đã xoá bộ đệm phím trước đó.
// tick chạy mỗi bước mô phỏng ở chỗ hero.update trước đây đếm hồi chiêu Phá Trận (giữ nguyên thứ tự cho B15).
//
// H35 (B15): phaTran, bopNat — chép NGUYÊN VĂN từ hero.js đợt 9a (cùng thứ tự gọi ctx.rng, cùng số): B15 phải chạy y hệt.
// Đợt 15b: mọi vòng sát thương của tướng lên đám lính (Phá Trận, Bóp Nát, Bạch Đằng) dùng crowd.strikeable + crowd.enlist — lính diễn phe địch bị
// chạm thì thành lính thật rồi nhận đòn, như nhát chém thường (hero.js applyHits).
// H31 (B20): hichTuongSi, binhThu, bachDang — cơ chế Hư cấu theo systems §4.1 / §4.5 (số ở data/heroes.js SKILLS).
// H40 (B17, đợt B17-B2): tenXuyenHang, chanDong, thanhDuc (nội tại, hero.passive.tick), mocTen — mũi tên qua lõi tên của hero.js;
// móc director tuỳ chọn: director.onBoom?.({ x0, z0, x1, z1, until, src, hero }) → true nếu trận tự lo chuỗi phao (sông);
// director.hookTarget?.(hero, range) → đơn vị thay thế để móc (thuyền chỉ huy). Không có móc: hàng cọc trên đất, chỉ móc tướng / sĩ quan.
// Hiệu ứng toàn quân đi qua móc của director (B20 dựng; director B15 không có thì dùng bản dự phòng gọn ở đây):
//   director.onArmyBuff?.({ src, skAll, congPct, sec, x, z })          — Hịch Tướng Sĩ đọc xong
//   director.onMark?.(target, { src, sec, mult })                      — Binh Thư đánh dấu (target: đơn vị; B20 tự lo Cứ Điểm)
//   director.pickMarkTarget?.(hero, range) → mục tiêu | null            — không khoá ai, không sĩ quan gần: B20 chọn Cứ Điểm
//   director.onUlt(hkUlt, { id, escort, r })                            — Tuyệt Kỹ bắt đầu (B15 bỏ qua tham số 2)
//   director.onUltEnd?.({ id, x, z, tpc, order, siKhi, qCost })         — Bạch Đằng Quyết Chiến kết thúc
// Dấu Binh Thư trên đơn vị: unit.markT (giờ trận ctx.clock hết hạn), unit.markMult (×1,4) — crowd.damage và
// units.takeHeroHit nhân khi markT > ctx.clock.

import * as A from "./anim.js";
import { heightAt } from "./world.js";
import { turn } from "./crowd.js";
import { HERO, POISE_PER_MV, C_POISE_MULT, HAO_KHI, AI, ultBigDamage, ultBigNote, hitPad, hitRadius } from "../data/tuning.js";
import { SKILLS, moveFlags } from "../data/heroes.js";
import { stakeRow, ropeLine } from "./models.js";

// ---- H35 · Phá Trận: 3 lần lao 18 m trong 6 s, choáng lính 1 s (nguyên văn hero.js) -----------------------------------
const phaTran = {
  slot: 1,
  tick(h, dt) {
    h.phaTran.cd = Math.max(0, h.phaTran.cd - dt);
    if (h.phaTran.window > 0) { h.phaTran.window -= dt; if (h.phaTran.window <= 0) { h.phaTran.left = 0; h.phaTran.cd = HERO.phaTran.cd; } }
  },
  ready(h) { return h.phaTran.left > 0 || h.phaTran.cd <= 0; },
  hud(h) {
    const pt = h.phaTran;
    return { ready: pt.cd <= 0, cd: pt.left > 0 ? `${pt.left} lần · ${Math.ceil(pt.window)}s` : pt.cd > 0 ? Math.ceil(pt.cd) : "" };
  },
  start(h) {
    const P = h.phaTran;
    if (P.left <= 0) { if (P.cd > 0) return false; P.left = HERO.phaTran.dashes; P.window = HERO.phaTran.window; }
    P.left--;
    if (P.left <= 0) { P.window = 0; P.cd = HERO.phaTran.cd; }
    h.state = "skill"; h.st = 0; h.swingId++;
    const t = h.lock?.alive ? h.lock : null;
    h.yaw = t ? Math.atan2(t.x - h.x, t.z - h.z) : (h.inputDir ?? h.yaw);
    h.dashLen = h.mods.phaTranLen; h.dashHit = new Set();
    h.ctx.director.onHeroAction?.("skill");
    h.ctx.audio.play("dash"); h.ctx.fx.banner("PHÁ TRẬN", "#e6dcc3", 0.6); h.ctx.hud?.speedLines?.(0.5);
    return true;
  },
  update(h, dt) {
    const ctx = h.ctx, dur = 0.5;
    h.st += dt; const u = h.st / dur;
    h.setPose(A.dash(Math.min(1, u)), 0.6);
    const sp = h.dashLen / dur;
    h.x += Math.sin(h.yaw) * sp * dt; h.z += Math.cos(h.yaw) * sp * dt;
    let hit = false;
    for (const a of ctx.crowd.agents) {
      if (a.side !== "dich" || !ctx.crowd.strikeable(a) || h.dashHit.has(a)) continue;
      if (Math.hypot(a.x - h.x, a.z - h.z) > 2.2 + hitPad(a)) continue;
      h.dashHit.add(a); ctx.crowd.enlist(a);       // lính diễn trên đường lao: thành lính thật rồi nhận đòn (đợt 15b; trước đây lao xuyên qua)
      const kx = Math.cos(h.yaw), kz = -Math.sin(h.yaw), side = ((a.x - h.x) * kx + (a.z - h.z) * kz) >= 0 ? 1 : -1;
      const died = ctx.crowd.damage(a, h.damageTo(a.giap, HERO.phaTran.mv, false, a), { by: "hero", swing: h.swingId, kx: kx * side, kz: kz * side, knock: 4, stun: HERO.phaTran.stun });
      ctx.fx.impact(a.x, heightAt(a.x, a.z) + 1.15 * a.scale, a.z, kx * side, kz * side, { kill: died, full: h.dashHit.size < 6 });
      ctx.director.onHeroAction?.("skillHit", 1);
      hit = true; h.onLanded();
    }
    for (const un of ctx.units) {
      if (un.side !== "dich" || !un.alive || un.dead || un.retreating || h.dashHit.has(un)) continue;
      if (Math.hypot(un.x - h.x, un.z - h.z) > 2.2 + un.radius) continue;
      h.dashHit.add(un);
      un.takeHeroHit(h.damageTo(un.giap, HERO.phaTran.mv, false, un), POISE_PER_MV * HERO.phaTran.mv * C_POISE_MULT, { by: "hero" });
      hit = true;
    }
    if (hit) { ctx.hitstop(35); ctx.audio.play("hit"); ctx.fx.shake(0.12); ctx.fx.kick(Math.sin(h.yaw), Math.cos(h.yaw), 0.18); }
    ctx.fx.trail(h);
    if (u >= 1) { h.state = "free"; h.swingId++; }
  },
};

// ---- H35 · Tuyệt Kỹ "Bóp Nát Quân Thù": 1 vạch, 10 s bất tử, 24 đòn tổng MV 20 (nguyên văn hero.js) --------------------
const bopNat = {
  slot: "ult",
  start(h) {
    if (h.ctx.crowd && (h.ki >= HERO.tuyetKy.cost || (h.inTPC && h.hkUltReady))) h.ctx.crowd.rout(h.x, h.z, AI.rout.ultR);
    const T = HERO.tuyetKy;
    const hkUlt = h.inTPC && h.hkUltReady;
    if (!hkUlt && h.ki < T.cost) return false;
    if (hkUlt) h.hkUltReady = false;
    else {
      h.ki -= T.cost;
      if (h.mods.ultRefund && h.ctx.rng.chance(h.mods.ultRefund)) { h.addKi(50); h.ctx.fx.text(h.x, h.z, "+50 Khí Lực", "#f1d98a"); }
    }
    h.state = "ult"; h.st = 0; h.ultHits = 0; h.invuln = T.invuln; h.ultId = (h.ultId || 0) + 1;
    h.ultHK = hkUlt;
    h.ultMv = hkUlt ? HAO_KHI.tpc.freeUlt.mv / T.hits : (T.mvTotal / T.hits) * (1 + h.mods.ultPct);
    h.ultR = hkUlt ? 3.5 * HAO_KHI.tpc.freeUlt.radius : 3.5;
    h.ctx.cinematic(hkUlt ? "TUYỆT KỸ HÀO KHÍ" : "BÓP NÁT QUÂN THÙ", h);
    h.ctx.audio.play("ult", h.x, h.z);
    h.ctx.director.onUlt(hkUlt); h.ctx.director.onHeroAction?.("ult"); h.ctx.hud?.speedLines?.(0.8);
    return true;
  },
  update(h, dt) {
    const ctx = h.ctx, T = HERO.tuyetKy, per = 4 / T.hits;
    h.st += dt;
    // một nhát chém dài 3 đòn (u chạy hết 0..1 qua 3 đòn), đổi tay mỗi chu kỳ 6 đòn (chém rồi xoay); nhát tay trái giữ
    // chân như tay phải cho nối liền với nhát xoay. Trước đây đổi tay theo từng đòn (k % 2): giữa nhát chém tư thế lật
    // trái ↔ phải, chân tay giật 70 lần trong 4,2 s. u tính từ cùng x với k (trước là st % (3·per): sai số dấu phẩy
    // động làm k sang nhát xoay mà u còn ≈ 1, giật một khung ở chỗ đổi chém ↔ xoay).
    const x = h.st / per, k = Math.floor(x), u = (x - 3 * Math.floor(k / 3)) / 3;
    h.setPose(k % 6 < 3 ? A.slash(u, Math.floor(k / 6) % 2 ? 1 : -1, 0.4, false) : A.spin(u, 1), 0.7);
    while (h.ultHits < Math.min(T.hits, k)) {
      h.ultHits++; h.swingId++;
      const tgt = h.nearestEnemy(h.ultR + 5);
      if (tgt) {
        const d = Math.hypot(tgt.x - h.x, tgt.z - h.z);
        h.yaw = Math.atan2(tgt.x - h.x, tgt.z - h.z);
        const step = h.ultHits % 5 === 0 ? 5 : Math.max(0, Math.min(1.2, d - 1.5));
        h.x += Math.sin(h.yaw) * step; h.z += Math.cos(h.yaw) * step;
      }
      for (const a of ctx.crowd.agents) {
        if (a.side !== "dich" || !ctx.crowd.strikeable(a)) continue;
        const dx = a.x - h.x, dz = a.z - h.z, dd = Math.hypot(dx, dz);
        if (dd > h.ultR + hitPad(a)) continue;
        ctx.crowd.enlist(a);                       // lính diễn trong vòng: thành lính thật (đợt 15b)
        const died = ctx.crowd.damage(a, h.damageTo(a.giap, h.ultMv, false, a), { by: "hero", swing: h.swingId, kx: dx / (dd || 1), kz: dz / (dd || 1), knock: 3, launch: h.ultHits % 6 === 0 });
        if (Math.random() < 0.5) ctx.fx.impact(a.x, heightAt(a.x, a.z) + 1.15 * a.scale, a.z, dx / (dd || 1), dz / (dd || 1), { heavy: h.ultHits % 6 === 0, kill: died, full: Math.random() < 0.4 });
      }
      for (const un of ctx.units) {
        if (un.side !== "dich" || !un.alive || un.dead || un.retreating) continue;
        if (Math.hypot(un.x - h.x, un.z - h.z) > h.ultR + un.radius) continue;
        // sĩ quan / Toa Đô: × bigMult (sát thương và Phá Thế); Tuyệt Kỹ lấy tối đa bigCap × Sinh lực tối đa của mỗi đơn vị
        // trong bigCapWindow giây tính từ đòn Tuyệt Kỹ đầu tiên trúng nó (tính cả ×1,5 khi Vỡ Thế) — hai Tuyệt Kỹ thường liền
        // nhau (2 vạch Khí Lực) chung một trần; Tuyệt Kỹ Hào Khí có trần riêng bigCapHK. Hết trần thì đòn vẫn trúng (khựng,
        // Phá Thế) nhưng không trừ máu nữa — báo "trụ vững" một lần mỗi Tuyệt Kỹ trên đơn vị đó.
        const hp0 = un.hp, dmg = ultBigDamage(un, h.damageTo(un.giap, h.ultMv, false, un), ctx.clock, h.ultHK);
        un.takeHeroHit(dmg, POISE_PER_MV * h.ultMv * T.bigMult, { by: "hero" });
        ultBigNote(un, hp0 - un.hp, h.ultHK);
        if (dmg <= 0 && un.alive && un.ultCapSaid !== h.ultId) { un.ultCapSaid = h.ultId; ctx.fx.text(un.x, un.z, `${un.name || "Tướng địch"} trụ vững`, "#c9bfae"); }
      }
      ctx.fx.shockwave(h.x, h.z, h.ultR * 0.8); ctx.audio.play(h.ultHits % 6 === 0 ? "hitHeavy" : "hit");
      if (h.ultHits % 4 === 0) ctx.fx.shake(0.2);
      if (h.ultHits % 6 === 0) { ctx.fx.punch(3); ctx.fx.kick(Math.sin(h.yaw), Math.cos(h.yaw), 0.25); ctx.hitstop(45); }
    }
    if (h.st >= 4.2) {
      h.state = "free";
      // cắm cờ: quân ta trong 20 m Công +25% trong 15 s
      ctx.director.plantFlag(h.x, h.z, T.flagR, T.flagAtk, T.flagDur);
      if (!h.ultHK) ctx.director.ultQ(T.qCost);
    }
  },
};

// ---- H31 · dùng chung ---------------------------------------------------------------------------------------------------
// Dự phòng khi director (B15, Võ trường) không có móc hiệu ứng toàn quân: chỉ cộng Sĩ Khí quân ta ở mọi mặt trận mô phỏng.
function siKhiFallback(ctx, v) {
  const F = ctx.sim?.fronts; if (!F) return;
  for (const id in F) if (F[id].sk) F[id].sk.ta = Math.min(100, F[id].sk.ta + v);
}
const HICH_LINES = ["Ta thường tới bữa quên ăn", "nửa đêm vỗ gối", "ruột đau như cắt, nước mắt đầm đìa"];   // Hịch tướng sĩ (Chính sử)

// ---- H31 · ô 1 Hịch Tướng Sĩ: đọc 3 s (đứng yên), bị ngắt bởi đòn nặng / đòn viền đỏ / đòn hất ngã ---------------------------
// ĐỀ XUẤT BẢN THỬ: hồi chiêu tính từ lúc bắt đầu đọc; bị ngắt thì hồi còn cdInterrupt (8 s) — ngắt không mất trắng 40 s.
const HICH_CD_INTERRUPT = 8;
const hichTuongSi = {
  slot: 1,
  tick(h, dt) { const s = h.skillCd; s.hichTuongSi = Math.max(0, (s.hichTuongSi || 0) - dt); },
  ready(h) { return !(h.skillCd.hichTuongSi > 0); },
  hud(h) { const cd = h.skillCd.hichTuongSi || 0; return { ready: cd <= 0, cd: h.state === "skill" && h.skillActive === hichTuongSi ? "đọc hịch" : cd > 0 ? Math.ceil(cd) : "" }; },
  start(h) {
    const S = SKILLS.hichTuongSi, ctx = h.ctx;
    if (h.skillCd.hichTuongSi > 0) return false;
    h.skillCd.hichTuongSi = S.cd;
    h.state = "skill"; h.st = 0; h.swingId++; h.skillActive = hichTuongSi; h.hichBeat = -1;
    ctx.director.onHeroAction?.("skill");
    ctx.fx.banner("HỊCH TƯỚNG SĨ", "#f1d98a", 1.0); ctx.audio.play("drum", h.x, h.z);
    ctx.fx.ring(h.x, h.z, 4, 0xf1d98a, 0.5);
    return true;
  },
  // đọc hịch: chỉ đòn thường của lính không ngắt; đòn nặng, đòn viền đỏ, đòn hất ngã ngắt
  armored(h, hit) { return !hit.heavy && !hit.red && !hit.knockdown; },
  interrupted(h) {
    h.skillCd.hichTuongSi = Math.min(h.skillCd.hichTuongSi, HICH_CD_INTERRUPT);
    h.ctx.fx.text(h.x, h.z, "Đọc hịch bị ngắt", "#e6a08a");
  },
  update(h, dt) {
    const S = SKILLS.hichTuongSi, ctx = h.ctx;
    h.st += dt; const u = h.st / S.channel;
    h.setPose(h.A.hich(Math.min(1, u)), 0.5);
    const beat = Math.floor(h.st);                                  // mỗi giây một nhịp trống + một câu hịch
    if (beat !== h.hichBeat && beat < S.channel) {
      h.hichBeat = beat;
      ctx.audio.play("drum", h.x, h.z); ctx.fx.ring(h.x, h.z, 6 + 4 * beat, 0xf1d98a, 0.7);
      ctx.fx.text(h.x, h.z, HICH_LINES[beat % HICH_LINES.length], "#f1d98a");
    }
    if (u >= 1) {
      h.state = "free"; h.skillActive = null;
      const info = { src: "hichTuongSi", skAll: S.siKhi, congPct: S.allyAtk, sec: S.dur, x: h.x, z: h.z };
      if (ctx.director.onArmyBuff) ctx.director.onArmyBuff(info);
      else siKhiFallback(ctx, S.siKhi);
      ctx.fx.ring(h.x, h.z, 22, 0xf1d98a, 0.9); ctx.fx.flash(0.3, "255,220,150"); ctx.audio.play("horn", h.x, h.z);
      ctx.fx.banner(`TƯỚNG SĨ MỘT LÒNG · +${S.siKhi} SĨ KHÍ`, "#f1d98a", 1.4);
    }
  },
};

// ---- H31 · ô 2 Binh Thư Yếu Lược: chỉ gươm đánh dấu mục tiêu 20 s, quân ta đánh +40% ---------------------------------------
// Mục tiêu: đơn vị đang khoá; không thì sĩ quan / Toa Đô gần nhất trong range m; không có thì hỏi director (B20: Cứ Điểm).
const binhThu = {
  slot: 2,
  tick(h, dt) {
    const s = h.skillCd; s.binhThu = Math.max(0, (s.binhThu || 0) - dt);
    const t = h.markTarget;                                         // vòng đỏ nhấp nháy dưới chân mục tiêu còn dấu
    if (t && (t.markT ?? 0) > h.ctx.clock && t.alive !== false && !t.dead) {
      h.markPulse = (h.markPulse || 0) - dt;
      if (h.markPulse <= 0) {
        h.markPulse = 0.5;
        if (t.x !== undefined) { const R = (t.radius || 1) + 1.4; h.ctx.fx.ring(t.x, t.z, R, 0xff5a3a, 0.5); h.ctx.fx.ring(t.x, t.z, R * 1.8, 0xff5a3a, 0.9); }
      }
    } else h.markTarget = null;
  },
  ready(h) { return !(h.skillCd.binhThu > 0); },
  hud(h) { const cd = h.skillCd.binhThu || 0; return { ready: cd <= 0, cd: cd > 0 ? Math.ceil(cd) : "" }; },
  pick(h) {
    const S = SKILLS.binhThu, ctx = h.ctx;
    if (h.lock?.alive && !h.lock.dead) return h.lock;
    let best = null, bd = S.range * S.range;
    for (const u of ctx.units) {
      if (u.side !== "dich" || !u.alive || u.dead || u.retreating) continue;
      const d2 = (u.x - h.x) ** 2 + (u.z - h.z) ** 2; if (d2 < bd) { bd = d2; best = u; }
    }
    return best || ctx.director.pickMarkTarget?.(h, S.range) || null;
  },
  start(h) {
    const ctx = h.ctx;
    if (h.skillCd.binhThu > 0) return false;
    const t = binhThu.pick(h);
    if (!t) { ctx.fx.text(h.x, h.z, "Không thấy mục tiêu", "#c9bfae"); return false; }
    h.skillCd.binhThu = SKILLS.binhThu.cd;
    h.state = "skill"; h.st = 0; h.swingId++; h.skillActive = binhThu; h.markPending = t;
    if (t.x !== undefined) h.yaw = Math.atan2(t.x - h.x, t.z - h.z);
    ctx.director.onHeroAction?.("skill2");
    ctx.audio.play("whooshHeavy");
    return true;
  },
  update(h, dt) {
    const S = SKILLS.binhThu, ctx = h.ctx;
    h.st += dt; const u = h.st / S.castSec;
    h.setPose(h.A.binhThu(Math.min(1, u)), 0.6);
    const t = h.markPending;
    if (t && u >= 0.35) {                                           // mũi gươm chĩa thẳng: đánh dấu
      h.markPending = null;
      t.markT = ctx.clock + S.mark; t.markMult = 1 + S.dmgPct; h.markTarget = t; h.markPulse = 0;
      ctx.director.onMark?.(t, { src: "binhThu", sec: S.mark, mult: t.markMult });
      if (t.x !== undefined) {
        ctx.fx.ring(t.x, t.z, (t.radius || 1) + 3, 0xff5a3a, 0.8);
        ctx.fx.text(t.x, t.z, `${t.name || "Mục tiêu"} · quân ta đánh +${Math.round(S.dmgPct * 100)}%`, "#ffb08a");
      }
      ctx.fx.banner("BINH THƯ YẾU LƯỢC", "#e6dcc3", 0.8); ctx.audio.play("horn", h.x, h.z);
    }
    if (u >= 1) { h.state = "free"; h.skillActive = null; }
  },
};

// ---- H31 · Tuyệt Kỹ "Bạch Đằng Quyết Chiến" ----------------------------------------------------------------------------------
// 12 s bất tử; clip 4,4 s: 3 nhát bổ đất ở 0,9 / 2,0 / 3,2 s, mỗi nhát một sóng chấn tròn r 15 m (Tổng Phản Công: 25 m, MV
// theo SKILLS.bachDang.tpc); nhát 3 phá mọi khiên (hất tung) và làm lính địch trong vòng núng thế bỏ chạy. Đòn vào sĩ quan /
// Toa Đô qua trần ultBigDamage (tuning.js) như Tuyệt Kỹ H35. Cuối clip đứng chỉ gươm về phía sông (hướng nước thấp nhất).
// ĐỀ XUẤT BẢN THỬ: lưỡi bổ ở 2,2 m trước mặt (tâm sóng); nhát 1–2 đẩy lùi 4,5 (khiên còn đỡ được), nhát 3 hất tung.
const ULT_BLADE = 2.2;
// Hướng về sông: B20 cho ctx.battle.riverYaw(x, z); không có thì dò 16 hướng, chỗ đất thấp nhất ở 20–50 m.
function riverYaw(ctx, x, z) {
  const f = ctx.battle?.riverYaw?.(x, z);
  if (f !== undefined && f !== null) return f;
  let best = null, bh = Infinity;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2; let s = 0;
    for (const d of [20, 35, 50]) s += heightAt(x + Math.sin(a) * d, z + Math.cos(a) * d);
    if (s < bh - 1e-6) { bh = s; best = a; }
  }
  return best;
}
const bachDang = {
  slot: "ult",
  start(h) {
    const S = SKILLS.bachDang, ctx = h.ctx;
    const hkUlt = h.inTPC && h.hkUltReady;
    if (!hkUlt && h.ki < S.cost) return false;
    if (hkUlt) h.hkUltReady = false;
    else {
      h.ki -= S.cost;
      if (h.mods.ultRefund && ctx.rng.chance(h.mods.ultRefund)) { h.addKi(50); ctx.fx.text(h.x, h.z, "+50 Khí Lực", "#f1d98a"); }
    }
    h.state = "ult"; h.st = 0; h.invuln = S.invuln; h.ultId = (h.ultId || 0) + 1; h.ultHK = hkUlt;
    h.ultS = { i: 0, r: hkUlt ? S.tpc.r : S.r, chops: hkUlt ? S.tpc.chops : S.chops, fx: [], riverYaw: null };
    // quay về phía đông địch nhất trong vòng sóng
    const t = h.lock?.alive && !h.lock.dead ? h.lock : h.nearestEnemy(12);
    if (t) h.yaw = Math.atan2(t.x - h.x, t.z - h.z);
    ctx.crowd?.rout(h.x, h.z, AI.rout.ultR);
    ctx.cinematic(hkUlt ? "BẠCH ĐẰNG · HÀO KHÍ" : "BẠCH ĐẰNG QUYẾT CHIẾN", h);
    ctx.audio.play("ult", h.x, h.z); ctx.audio.play("drum", h.x, h.z); ctx.audio.play("wave", h.x, h.z);
    ctx.director.onUlt(hkUlt, { id: "bachDang", escort: S.escort, r: h.ultS.r });
    ctx.director.onHeroAction?.("ult"); ctx.hud?.speedLines?.(0.8);
    ctx.fx.ring(h.x, h.z, 6, 0xf1d98a, 0.5); ctx.fx.flash(0.25, "255,200,140");
    return true;
  },
  update(h, dt) {
    const S = SKILLS.bachDang, U = h.ultS;
    h.st += dt;
    h.setPose(h.A.ult(Math.min(1, h.st / S.clip)), 0.7);
    while (U.i < U.chops.length && h.st >= U.chops[U.i].t) { bachDangChop(h, U.chops[U.i], U.i, U.i === U.chops.length - 1); U.i++; }
    for (let i = U.fx.length - 1; i >= 0; i--) if (h.st >= U.fx[i].t) { U.fx[i].fn(); U.fx.splice(i, 1); }
    // sau nhát 3: xoay người chỉ gươm về phía sông
    if (U.i >= U.chops.length) {
      if (U.riverYaw === null) U.riverYaw = riverYaw(h.ctx, h.x, h.z) ?? h.yaw;
      h.yaw = turn(h.yaw, U.riverYaw, dt * 3);
    }
    if (h.st >= S.clip) { h.state = "free"; bachDangEnd(h); }
  },
};
function bachDangChop(h, c, i, last) {
  const ctx = h.ctx, U = h.ultS, r = U.r, T = HERO.tuyetKy;
  const fx = Math.sin(h.yaw), fz = Math.cos(h.yaw), gx = h.x + fx * ULT_BLADE, gz = h.z + fz * ULT_BLADE;
  const mv = c.mv * (h.ultHK ? 1 : 1 + h.mods.ultPct), hard = last || !!c.breakShields;
  h.swingId++;
  let n = 0, kills = 0;
  for (const a of [...ctx.crowd.agents]) {
    if (a.side !== "dich" || !ctx.crowd.strikeable(a)) continue;
    const dx = a.x - gx, dz = a.z - gz, d = Math.hypot(dx, dz);
    if (d > r + hitPad(a)) continue;
    ctx.crowd.enlist(a);                           // lính diễn trong vòng sóng chấn: thành lính thật (đợt 15b)
    const k = d || 1;
    const died = ctx.crowd.damage(a, h.damageTo(a.giap, mv, false, a), { by: "hero", swing: h.swingId, kx: dx / k, kz: dz / k,
      knock: hard ? 9 : 4.5, launch: hard && d < r * 0.7, heavy: true });
    if (n < 16) ctx.fx.impact(a.x, heightAt(a.x, a.z) + 1.15 * a.scale, a.z, dx / k, dz / k, { heavy: true, kill: died, full: n < 8 });
    n++; if (died) kills++;
  }
  for (const un of ctx.units) {
    if (un.side !== "dich" || !un.alive || un.dead || un.retreating) continue;
    if (Math.hypot(un.x - gx, un.z - gz) > r + un.radius) continue;
    // trần Tuyệt Kỹ lên đơn vị lớn (tuning.js ultBigDamage); dấu Binh Thư nhân sau trong takeHeroHit nên chia ra trước khi cắt
    const mm = (un.markT ?? 0) > ctx.clock ? un.markMult : 1;
    const hp0 = un.hp, dmg = ultBigDamage(un, h.damageTo(un.giap, mv, false, un) * mm, ctx.clock, h.ultHK) / mm;
    un.takeHeroHit(dmg, h.poisePerMv * mv * T.bigMult, { by: "hero", knock: hard ? 8 : 4 });
    ultBigNote(un, hp0 - un.hp, h.ultHK);
    if (dmg <= 0 && un.alive && un.ultCapSaid !== h.ultId) { un.ultCapSaid = h.ultId; ctx.fx.text(un.x, un.z, `${un.name || "Tướng địch"} trụ vững`, "#c9bfae"); }
    n++;
  }
  // nhát 3 (hoặc nhát phá khiên): lính trong vòng núng thế; nhát 1–2 chỉ vòng trong
  ctx.crowd.rout(gx, gz, hard ? r : r * 0.5);
  // sóng chấn: ba vòng lan nối nhau từ chỗ lưỡi bổ, bụi tung thành vòng, chớp sáng, rung mạnh dần theo nhát
  // (vòng của fx.ring nở từ 0,3 r tới r trong T giây theo giờ thật — nở cả trong hit-stop; ba vòng T khác nhau thành sóng lan;
  // một vòng dội lại sau hit-stop theo giờ trận)
  const gy = heightAt(gx, gz), p = [0.35, 0.45, 0.75][Math.min(2, i)];
  ctx.fx.ring(gx, gz, r * 0.45, 0xf1d98a, 0.3);
  ctx.fx.ring(gx, gz, r * 0.8, 0xf1d98a, 0.5);
  ctx.fx.ring(gx, gz, r, last ? 0xff5a3a : 0xf1d98a, 0.8);
  U.fx.push({ t: h.st + 0.2, fn: () => ctx.fx.ring(gx, gz, r * 1.05, 0xf1d98a, 0.6) });
  ctx.fx.sprite("ring", gx, gy + 0.3, gz, { size: 5, T: 0.35, grow: 2.2, flat: true, additive: true, color: 0xffd9a0, opacity: 0.9 });
  ctx.fx.dust(gx, gz, 1.4);
  for (let j = 0; j < 10; j++) {
    const a = (j / 10) * Math.PI * 2, d = 2.5 + (j % 3) * 1.5;
    ctx.fx.dust(gx + Math.sin(a) * d, gz + Math.cos(a) * d, 0.8);
  }
  ctx.fx.spark(gx, gy + 0.3, gz, true);
  ctx.audio.play("slam", gx, gz); ctx.audio.play("hitHeavy", null, null, { gain: 1.2 });
  if (last) ctx.audio.play("finisher");
  ctx.fx.flash(p, last ? "255,210,160" : "255,236,200");
  ctx.fx.shake(0.5 + 0.2 * i); ctx.fx.punch(4 + 1.5 * i); ctx.fx.kick(fx, fz, 0.35 + 0.1 * i);
  ctx.hitstop(last ? 120 : 75);
  if (last) { ctx.slowmo?.(0.45, 0.35); ctx.fx.banner("PHÁ TAN QUÂN GIẶC", "#f1d98a", 1.0); }
  if (kills >= 3 || n >= 6) ctx.fx.text(h.x, h.z, `${n} quân giặc trúng sóng chấn`, "#f1d98a");
}
function bachDangEnd(h) {
  const S = SKILLS.bachDang, ctx = h.ctx;
  const info = { id: "bachDang", x: h.x, z: h.z, tpc: !!h.ultHK, order: S.end.order, siKhi: S.end.siKhi, qCost: h.ultHK ? 0 : S.qCost };
  if (ctx.director.onUltEnd) ctx.director.onUltEnd(info);
  else { siKhiFallback(ctx, S.end.siKhi); if (!h.ultHK) ctx.director.ultQ?.(S.qCost); }
  ctx.fx.banner("TOÀN QUÂN TIẾN CÔNG", "#f1d98a", 1.4); ctx.audio.play("horn", h.x, h.z);
}

// ---- H40 Nguyễn Khoái (WC09 Cung, đợt B17-B2) -------------------------------------------------------------------------------
// Số ở data/heroes.js SKILLS (canon H40 + ĐỀ XUẤT BẢN THỬ). Mũi tên đi qua lõi tên của hero.js (fireArrow / updateShots / landHit):
// bay thật, xuyên, trúng trễ. nock(h): tên cầm tay hiện lúc kéo dây (hero.js nocked).
const XH_M = { mv: 0.9, range: 30, pierce: 4, speed: 55, knock: 4, stop: 67, heavy: true };      // một mũi Tên Xuyên Hàng (khoá "xuyenHang")
const HOOK_M = { mv: 3, range: 37, pierce: 1, speed: 45, knock: 0, stop: 100, heavy: true };     // mũi móc dây (khoá "mocTen")
const cdOf = (id) => ({
  tick(h, dt) { h.skillCd[id] = Math.max(0, (h.skillCd[id] || 0) - dt); },
  ready(h) { return !(h.skillCd[id] > 0); },
  hud(h) { const cd = h.skillCd[id] || 0; return { ready: cd <= 0, cd: cd > 0 ? Math.ceil(cd) : "" }; },
});
// Hướng ra chiêu của cung: mục tiêu khoá (trong tầm) → tự nhắm (nón ±30° quanh hướng ngắm) → hướng ngắm → hướng mặt.
function bowAim(h, range = 30) {
  const lk = h.lock?.alive && !h.lock.dead && Math.hypot(h.lock.x - h.x, h.lock.z - h.z) <= range ? h.lock : null;
  const t = lk || h.aimTarget?.() || null;
  return t ? Math.atan2(t.x - h.x, t.z - h.z) : h.aimYaw ?? h.yaw;
}

// ô 1 Tên Xuyên Hàng: kéo dây castSec × release rồi buông 5 tên nặng tỏa spread rad, tầm 30 m, mỗi tên xuyên 4 người; người thứ 4
// trên đường mỗi tên bị ghim 1,5 s (lính: choáng có sẵn của crowd; sĩ quan / tướng: units.js applyStatus("pin")).
const tenXuyenHang = {
  slot: 1, ...cdOf("tenXuyenHang"),
  nock(h) { const S = SKILLS.tenXuyenHang; return h.st < S.castSec * S.release; },
  armored(h, hit) { return !hit.heavy && !hit.red; },
  start(h) {
    const S = SKILLS.tenXuyenHang, ctx = h.ctx;
    if (h.skillCd.tenXuyenHang > 0) return false;
    h.skillCd.tenXuyenHang = S.cd;
    h.state = "skill"; h.st = 0; h.swingId++; h.skillActive = tenXuyenHang; h.xhFired = false;
    h.F.xuyenHang ||= moveFlags("xuyenHang", XH_M);
    h.yaw = bowAim(h, S.range);
    ctx.director.onHeroAction?.("skill");
    ctx.fx.banner("TÊN XUYÊN HÀNG", "#e6dcc3", 0.7); ctx.audio.play("whooshHeavy", h.x, h.z);
    return true;
  },
  update(h, dt) {
    const S = SKILLS.tenXuyenHang, ctx = h.ctx;
    h.st += dt; const u = h.st / S.castSec;
    h.setPose(h.A.xuyenHang(Math.min(1, u)), 0.7);
    if (!h.xhFired && u < S.release && h.aimYaw !== null && !h.lock) h.yaw = turn(h.yaw, bowAim(h, S.range), dt * 6);
    if (!h.xhFired && u >= S.release) {
      h.xhFired = true;
      for (let i = 0; i < S.arrows; i++) {
        const da = (i - (S.arrows - 1) / 2) * (S.spread / (S.arrows - 1));
        h.fireArrow("xuyenHang", XH_M, h.yaw + da, S.mv, null, { pierce: S.pierce, range: S.range, speed: S.speed, pin: { at: S.pinAt, sec: S.pin } });
      }
      ctx.audio.play("crossbow", h.x, h.z); ctx.audio.play("bow", h.x, h.z); ctx.audio.play("bowHeavy", h.x, h.z);
      ctx.fx.kick(-Math.sin(h.yaw), -Math.cos(h.yaw), 0.2); ctx.fx.shake(0.15);
    }
    if (u >= 1) { h.state = "free"; h.skillActive = null; }
  },
};

// ô 2 Chặn Dòng Dụ Địch: thả chuỗi chặn dài len m ngang hướng ngắm, tâm cách tướng ahead m, trong dur s. Trận có móc director.onBoom
// (sông, thuyền — trả true nếu director tự lo) thì giao cho director; không có: thuyền địch của lớp thủy chiến (ctx.naval) chạm chuỗi thì
// dừng (Boat.stop), và trên đất là hàng cọc — lính, sĩ quan địch không vượt qua được (đẩy ra khỏi dải dày thick m mỗi bước), phải đi vòng.
function fenceTick(h) {
  const F = h.fence, ctx = h.ctx;
  if (ctx.clock >= F.until) { F.mesh?.parent?.remove(F.mesh); h.fence = null; return; }
  const push = (o, r) => {
    const px = o.x - F.cx, pz = o.z - F.cz, al = px * F.tx + pz * F.tz;
    if (Math.abs(al) > F.half + r) return;
    const s = px * F.nx + pz * F.nz, w = F.th + r;
    if (Math.abs(s) >= w) return;
    const ns = s >= 0 ? w : -w;
    o.x += F.nx * (ns - s); o.z += F.nz * (ns - s);
  };
  for (const a of ctx.crowd.agents) if (a.side === "dich" && a.alive && a.state !== "dead") push(a, hitRadius(a));
  for (const u of ctx.units) if (u.side === "dich" && u.alive && !u.dead && !u.retreating && !u.script) push(u, u.radius);
  for (const b of ctx.naval?.boats || []) {
    if (b.side === "ta") continue;
    const px = b.x - F.cx, pz = b.z - F.cz;
    if (Math.abs(px * F.tx + pz * F.tz) <= F.half + 3 && Math.abs(px * F.nx + pz * F.nz) < 7) b.stop?.();
  }
}
const chanDong = {
  slot: 2,
  tick(h, dt) { h.skillCd.chanDong = Math.max(0, (h.skillCd.chanDong || 0) - dt); if (h.fence) fenceTick(h); },
  ready(h) { return !(h.skillCd.chanDong > 0); },
  hud(h) { const cd = h.skillCd.chanDong || 0; return { ready: cd <= 0, cd: h.fence ? `${Math.ceil(h.fence.until - h.ctx.clock)}s` : cd > 0 ? Math.ceil(cd) : "" }; },
  start(h) {
    const S = SKILLS.chanDong, ctx = h.ctx;
    if (h.skillCd.chanDong > 0) return false;
    h.skillCd.chanDong = S.cd;
    h.state = "skill"; h.st = 0; h.swingId++; h.skillActive = chanDong; h.cdPlaced = false;
    h.yaw = h.aimYaw ?? h.yaw;
    ctx.director.onHeroAction?.("skill2"); ctx.audio.play("whooshHeavy", h.x, h.z);
    return true;
  },
  update(h, dt) {
    const S = SKILLS.chanDong, ctx = h.ctx;
    h.st += dt; const u = h.st / S.castSec;
    h.setPose(h.A.chanDong(Math.min(1, u)), 0.6);
    if (!h.cdPlaced && u >= 0.5) {
      h.cdPlaced = true;
      const fx = Math.sin(h.yaw), fz = Math.cos(h.yaw), cx = h.x + fx * S.ahead, cz = h.z + fz * S.ahead, tx = fz, tz = -fx;
      const until = ctx.clock + S.dur, ends = { x0: cx - tx * S.len / 2, z0: cz - tz * S.len / 2, x1: cx + tx * S.len / 2, z1: cz + tz * S.len / 2 };
      if (h.fence) { h.fence.mesh?.parent?.remove(h.fence.mesh); h.fence = null; }
      if (!ctx.director.onBoom?.({ ...ends, until, src: "chanDong", hero: h })) {
        const mesh = stakeRow(S.len);
        mesh.position.set(cx, 0, cz); mesh.rotation.y = h.yaw;
        for (const c of mesh.children) { const wx = cx + tx * c.position.x, wz = cz + tz * c.position.x; c.position.y = heightAt(wx, wz) - 0.15; }
        ctx.scene?.add(mesh);
        h.fence = { cx, cz, nx: fx, nz: fz, tx, tz, half: S.len / 2, th: S.thick / 2, until, mesh };
      }
      for (const k of [-0.5, -0.25, 0, 0.25, 0.5]) ctx.fx.dust(cx + tx * S.len * k, cz + tz * S.len * k, 0.7);
      ctx.fx.banner("CHẶN DÒNG DỤ ĐỊCH", "#e6dcc3", 0.8); ctx.audio.play("slam", cx, cz);
    }
    if (u >= 1) { h.state = "free"; h.skillActive = null; }
  },
};

// Nội tại Thánh Dực Dũng Nghĩa: đứng trên boong (h.deck) thì tầm bắn × (1 + deckRange) (hero.rangeBonus nhân vào tầm tên và nón tự
// nhắm); mỗi thuyền địch mắc cạn (lớp thủy chiến: state "stranded") trong strandedR m: +kiPerBoat Khí Lực/s.
const thanhDuc = {
  slot: "passive",
  tick(h, dt) {
    const S = SKILLS.thanhDuc, boats = h.ctx.naval?.boats;
    h.rangeBonus = h.deck ? 1 + S.deckRange : 1;
    if (!boats) return;
    let n = 0;
    for (const b of boats) if (b.side !== "ta" && b.state === "stranded" && (b.x - h.x) ** 2 + (b.z - h.z) ** 2 < S.strandedR * S.strandedR) n++;
    if (n) h.addKi(S.kiPerBoat * n * dt);
  },
};

// Tuyệt Kỹ Móc Tên Trói Thuyền: một mũi móc dây vào tướng / sĩ quan địch trong range m (khoá trước, rồi người gần tâm ngắm, rồi gần
// nhất); trúng thì kéo về phía tướng pull m (không gần hơn 3 m) trong pullSec s rồi trói bind s (units.js applyStatus); boss (bậc
// "tuong") mất poiseCut × thanh Phá Thế (đủ thì Vỡ Thế, không kết thúc pha). Bất tử invuln s; cắt máy ngắn (ctx.cinematic, mẫu "lướt theo
// đòn" của §4.5 là việc của trình bày). Không có tướng địch trong tầm: không tốn Khí Lực. Thuyền chỉ huy (B20): director.hookTarget?.(h, range)
// trả { x, z, isBig: true, … } đơn vị thay thế — chưa trận nào dựng.
function hookTarget(h, range) {
  const ok = (u) => u.side === "dich" && u.alive && !u.dead && !u.retreating && !u.script && Math.hypot(u.x - h.x, u.z - h.z) <= range + u.radius;
  if (h.lock && h.lock.isBig && ok(h.lock)) return h.lock;
  const dir = h.aimYaw ?? h.yaw;
  let best = null, bs = 1e9;
  for (const u of h.ctx.units) {
    if (!ok(u)) continue;
    let da = Math.atan2(u.x - h.x, u.z - h.z) - dir; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
    const s = Math.abs(da) + Math.hypot(u.x - h.x, u.z - h.z) / range;
    if (s < bs) { bs = s; best = u; }
  }
  return best || h.ctx.director.hookTarget?.(h, range) || null;
}
const mocTen = {
  slot: "ult",
  nock(h) { const S = SKILLS.mocTen; return h.st < S.release; },
  start(h) {
    const S = SKILLS.mocTen, ctx = h.ctx;
    const hkUlt = h.inTPC && h.hkUltReady;
    if (!hkUlt && h.ki < S.cost) return false;
    const t = hookTarget(h, S.range);
    if (!t) { ctx.fx.text(h.x, h.z, `Không có tướng địch trong ${S.range} m`, "#c9bfae"); return false; }
    if (hkUlt) h.hkUltReady = false;
    else {
      h.ki -= S.cost;
      if (h.mods.ultRefund && ctx.rng.chance(h.mods.ultRefund)) { h.addKi(50); ctx.fx.text(h.x, h.z, "+50 Khí Lực", "#f1d98a"); }
    }
    h.state = "ult"; h.st = 0; h.invuln = S.invuln; h.ultId = (h.ultId || 0) + 1; h.ultHK = hkUlt;
    h.F.mocTen ||= moveFlags("mocTen", HOOK_M);
    h.ultS = { t, fired: false, hooked: null, rope: null, shot: null };
    h.yaw = Math.atan2(t.x - h.x, t.z - h.z);
    ctx.cinematic(hkUlt ? "MÓC TÊN · HÀO KHÍ" : "MÓC TÊN TRÓI THUYỀN", h);
    ctx.audio.play("ult", h.x, h.z); ctx.audio.play("grapple", h.x, h.z);
    ctx.director.onUlt(hkUlt, { id: "mocTen", r: S.range }); ctx.director.onHeroAction?.("ult"); ctx.hud?.speedLines?.(0.6);
    return true;
  },
  update(h, dt) {
    const S = SKILLS.mocTen, U = h.ultS, ctx = h.ctx, t = U.t;
    h.st += dt;
    h.setPose(h.A.mocTen(Math.min(1, h.st / S.clip)), 0.7);
    if (!U.fired && t.alive && !t.dead) h.yaw = turn(h.yaw, Math.atan2(t.x - h.x, t.z - h.z), dt * 10);
    if (!U.fired && h.st >= S.release) {
      U.fired = true;
      U.shot = h.fireArrow("mocTen", HOOK_M, h.yaw, HOOK_M.mv * (h.ultHK ? 1.5 : 1 + h.mods.ultPct), t, { speed: S.speed, range: S.range + 2 });
      U.shot.hook = U;
      U.onHook = (tg) => {                                            // landHit gọi khi móc cắm vào tướng
        U.hooked = tg;
        const d = Math.hypot(tg.x - h.x, tg.z - h.z) || 1, pd = Math.max(0, Math.min(S.pull, d - 3));
        tg.applyStatus?.("pull", { x: tg.x - (tg.x - h.x) / d * pd, z: tg.z - (tg.z - h.z) / d * pd, sec: S.pullSec });
        tg.applyStatus?.("bind", S.bind);
        ctx.fx.text(tg.x, tg.z, `${tg.name || "Tướng địch"} bị móc · trói ${S.bind} s`, "#ffb08a");
        ctx.fx.flash(0.2, "255,220,160"); ctx.fx.shake(0.35); ctx.audio.play("hitHeavy", tg.x, tg.z); ctx.hitstop(90);
        U.rope = ropeLine(); ctx.scene?.add(U.rope);
      };
      ctx.audio.play("crossbow", h.x, h.z);
    }
    if (U.rope) {                                                     // dây căng từ tay phải tướng tới người bị móc
      const tg = U.hooked, hy = h.y + 1.4 * h.rig.scale;
      U.rope.set(h.x + Math.sin(h.yaw) * 0.4, hy, h.z + Math.cos(h.yaw) * 0.4, tg.x, tg.y + 1.3 * (tg.rig?.scale || 1), tg.z);
    }
    if (h.st >= S.clip) {
      h.state = "free";
      if (U.rope) { U.rope.parent?.remove(U.rope); U.rope.geometry.dispose(); U.rope = null; }
      if (!U.hooked) ctx.fx.text(h.x, h.z, "Móc trượt", "#c9bfae");
    }
  },
};

// Khoá: id kỹ năng của data/heroes.js; ultBopNat / ultBachDang là tên gọi trong hợp đồng lõi.
export const SKILL_IMPL = { phaTran, bopNat, hichTuongSi, binhThu, bachDang, ultBopNat: bopNat, ultBachDang: bachDang,
  tenXuyenHang, chanDong, thanhDuc, mocTen, ultMocTen: mocTen };
