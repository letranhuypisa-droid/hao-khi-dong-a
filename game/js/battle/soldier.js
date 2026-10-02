// battle/soldier.js — người lính của chế độ Tự do (đợt 14b): lớp con của Hero (battle/hero.js không đổi), khóa đòn / kỹ năng theo bậc
// (data/career.js UNLOCK), thanh Phá Thế từ Đội trưởng, dáng lính (nón lá, áo chàm đỏ; Đội trưởng trở lên mũ tướng, Tướng có áo choàng),
// hai kỹ năng riêng đăng ký thêm vào SKILL_IMPL: Hô quân (ô 2, Phó tướng) và Tuyệt Kỹ Sát Thát (Tướng — dùng lại cơ chế Bóp Nát Quân
// Thù, đổi tên). Tên kỹ năng, dáng lính là Hư cấu; chữ "Sát Thát" thích trên tay quân Trần 1285 là Chính sử.
//
// Bậc (def.rank, 0..4):
//   Lính       đòn N, C1–C2, Né, Đỡ; đòn nhẹ của địch cũng ngắt nhát đang vung (tướng thì có giáp đòn); không Đòn Quyết.
//   Tinh nhuệ  + C3–C4, Đòn Quyết.
//   Đội trưởng + C5, Phá Trận (ô 1), thanh Phá Thế: đòn nhẹ trừ thanh thay vì làm khựng, cạn thanh mới khựng; hồi sau 3 s không trúng.
//   Phó tướng  + C6, Hô quân (ô 2).
//   Tướng      + Tuyệt Kỹ Sát Thát.

import { Hero } from "./hero.js";
import { RIGS } from "./models.js";
import { SKILL_IMPL } from "./hero-skills.js";
import { PAL } from "./models.js";
import { can, RANKS } from "../data/career.js";

const MAX_C = [2, 4, 5, 6, 6];                    // đòn C cao nhất theo bậc
const POISE = { base: 60, perRank: 25, hit: 14, regenDelay: 3, regen: 22 };   // ĐỀ XUẤT BẢN THỬ

// ---- dáng lính theo bậc + binh khí (đăng ký vào RIGS để Hero tìm theo def.rig) ----------------------------------------------
export function soldierRigKey(weapon, rank) {
  const key = `linh_${weapon}_${rank}`;
  if (!RIGS[key]) {
    const officer = rank >= 2;
    RIGS[key] = {
      model: rank >= 2 ? "LINH_r24" : "LINH_r01",           // mô hình GLB: bậc Lính, Tinh nhuệ / Đội trưởng trở lên
      scale: 1.0 + 0.02 * rank, cloth: rank >= 3 ? PAL.sonDam : 0x8a2a1e, armor: officer ? PAL.then : 0x3a2c22, trim: officer ? PAL.vang : 0x8a6a3a,
      hat: officer ? "mutuong" : "non", weapon: weapon === "WC01" ? "daikiem" : "songdao",
      cape: rank >= 4 ? PAL.son : null, capeScale: rank >= 4 ? [0.62, 0.72] : null,
    };
  }
  return key;
}

// ---- kỹ năng riêng ---------------------------------------------------------------------------------------------------------
// Hô quân (Phó tướng): hô một tiếng 0,7 s, quân ta trong 18 m Công +25% trong 12 s (cờ trong director.flags, crowd.flagMult; cận vệ: guard.js
// flagMult), lính ta và cận vệ (đợt 15c, trừ người đang gục) hồi 20% Sinh lực, địch thường trong 6 m khựng. Hồi 35 s.
const HO = { cd: 35, cast: 0.7, r: 18, atk: 0.25, dur: 12, heal: 0.2, stunR: 6, stun: 0.8 };
const hoQuan = {
  slot: 2,
  tick(h, dt) { h.skillCd.hoQuan = Math.max(0, (h.skillCd.hoQuan || 0) - dt); },
  ready(h) { return !(h.skillCd.hoQuan > 0); },
  hud(h) { const cd = h.skillCd.hoQuan || 0; return { ready: cd <= 0, cd: cd > 0 ? Math.ceil(cd) : "" }; },
  start(h) {
    if (h.skillCd.hoQuan > 0) return false;
    h.skillCd.hoQuan = HO.cd; h.state = "skill"; h.st = 0; h.hoDone = false;
    h.ctx.fx.banner("HÔ QUÂN", "#f1d98a", 0.9); h.ctx.audio.play("kiai", h.x, h.z); h.ctx.audio.play("drum");
    h.ctx.director.onHeroAction?.("skill");
    return true;
  },
  update(h, dt) {
    const ctx = h.ctx; h.st += dt;
    h.setPose(h.P.block, 0.3);
    if (!h.hoDone && h.st >= HO.cast * 0.5) {
      h.hoDone = true;
      ctx.director.addFlag?.(h.x, h.z, HO.r, HO.atk, HO.dur);
      ctx.fx.ring(h.x, h.z, HO.r, 0xf1d98a, 0.8); ctx.fx.shockwave?.(h.x, h.z, 6);
      for (const a of ctx.crowd.agents) {
        if (!ctx.crowd.hittable(a)) continue;
        const d = Math.hypot(a.x - h.x, a.z - h.z);
        if (a.side === "ta" && d < HO.r) a.hp = Math.min(a.maxHp, a.hp + a.maxHp * HO.heal);
        else if (a.side === "dich" && d < HO.stunR && a.tier === "thuong") a.stun = Math.max(a.stun, HO.stun);
      }
      for (const g of ctx.director?.guards || []) if (g.alive && !g.down && Math.hypot(g.x - h.x, g.z - h.z) < HO.r) g.hp = Math.min(g.maxHp, g.hp + g.maxHp * HO.heal);
    }
    if (h.st >= HO.cast) { h.state = "free"; h.skillActive = null; }
  },
  interrupted(h) { h.hoDone = true; },
};
// Sát Thát (Tướng): đúng cơ chế, số của Bóp Nát Quân Thù (hero-skills.js), chỉ đổi chữ trên màn.
const bop = SKILL_IMPL.bopNat;
const satThat = {
  ...bop,
  start(h) {
    const ctx = h.ctx, cine = ctx.cinematic;
    ctx.cinematic = (t, u, big) => cine(t === "BÓP NÁT QUÂN THÙ" ? "SÁT THÁT" : t, u, big);
    try { return bop.start(h); } finally { ctx.cinematic = cine; }
  },
};
SKILL_IMPL.hoQuan ??= hoQuan;
SKILL_IMPL.satThat ??= satThat;
export const SOLDIER_SKILL_NAMES = { phaTran: "Phá Trận", hoQuan: "Hô quân", satThat: "Sát Thát" };

// ---- người lính ---------------------------------------------------------------------------------------------------------------
export class SoldierHero extends Hero {
  constructor(ctx, stats, def) {
    const rank = def.rank ?? 0;
    super(ctx, stats, { ...def, rig: soldierRigKey(def.cls, rank) });
    this.rank = rank;
    if (can(rank, "poise")) { this.poiseMax = POISE.base + POISE.perRank * (rank - 2); this.poise = this.poiseMax; this.poiseWait = 0; }
    else { this.poiseMax = 0; this.poise = 0; }
  }
  // nút / ô bị khóa theo bậc (battle.js buildTouch bỏ nút, hud.js làm mờ ô): skill, skill2, ult, cmd, kesach, tpc
  locked(id) {
    const r = this.rank;
    if (id === "skill") return !can(r, "skill1");
    if (id === "skill2") return !can(r, "skill2");
    if (id === "ult") return !can(r, "ult");
    if (id === "cmd") return !can(r, "squad") || !(this.def.guards > 0);          // vòng Mệnh Lệnh ra lệnh cho cận vệ (đợt 15c): chưa chiêu mộ ai thì ẩn
    if (id === "kesach") return !can(r, "keSach");
    if (id === "tpc") return !can(r, "haoKhi");
    return false;
  }
  lockedMsg(what, f) {
    const need = RANKS.find((_, i) => can(i, f));
    this.ctx.fx.text(this.x, this.z, `${what}: mở ở bậc ${need?.name ?? "?"}`, "#c9bfae");
  }

  cKey(k) {
    let key = super.cKey(k);
    const n = Number(key[1]), max = MAX_C[this.rank] ?? 6;
    if (key[0] === "C" && n > max) key = "C" + max;
    return key;
  }
  findBroken() { return can(this.rank, "dq") ? super.findBroken() : null; }
  startSkill(slot = 1) {
    if (this.locked(slot === 1 ? "skill" : "skill2")) { this.buf = null; this.lockedMsg(slot === 1 ? "Phá Trận" : "Hô quân", slot === 1 ? "skill1" : "skill2"); return false; }
    return super.startSkill(slot);
  }
  startUlt() {
    if (this.locked("ult")) { this.buf = null; this.lockedMsg("Tuyệt Kỹ", "ult"); return false; }
    return super.startUlt();
  }
  skillSlots() { return super.skillSlots().filter((s) => !this.locked(s.slot === 1 ? "skill" : "skill2")).map((s) => ({ ...s, name: SOLDIER_SKILL_NAMES[s.id] ?? s.name })); }
  ultInfo() { const u = super.ultInfo(); return { ...u, name: "Sát Thát", label: "Sát Thát", locked: this.locked("ult") }; }

  update(dt, inp) {
    if (this.poiseMax > 0 && dt > 0) {
      if (this.poiseWait > 0) this.poiseWait -= dt;
      else this.poise = Math.min(this.poiseMax, this.poise + POISE.regen * dt);
    }
    super.update(dt, inp);
  }
  // Lính / Tinh nhuệ: đòn nhẹ cũng ngắt nhát đang vung. Đội trưởng trở lên: đòn nhẹ trừ thanh Phá Thế thay vì làm khựng.
  receiveHit(h) {
    const st0 = this.state, light = !h.heavy && !h.red && !h.knockdown;
    const r = super.receiveHit(h);
    if (r !== "hit" || !this.alive || !light) return r;
    if (this.poiseMax > 0) {
      this.poiseWait = POISE.regenDelay;
      if (this.state === "hit" && this.poise > 0) {
        this.poise = Math.max(0, this.poise - POISE.hit);
        this.state = st0 === "block" ? "block" : "free"; this.st = 0;
        if (this.poise <= 0) { this.state = "hit"; this.st = 0.3; this.chain = 0; this.ctx.fx.text(this.x, this.z, "Vỡ Thế", "#ffb09a"); }
      }
    } else if (st0 === "attack" && this.state === "attack" && !this.superArmorNow()) {
      this.state = "hit"; this.st = 0.3; this.chain = 0;
    }
    return r;
  }
  superArmorNow() { return this.superArmor && this.inArmor(); }
}
