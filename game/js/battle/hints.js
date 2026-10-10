// battle/hints.js — gợi ý "lần đầu" giữa trận (đợt 11): giải thích thuật ngữ và cơ chế ĐÚNG LÚC người chơi gặp nó (Gượng dậy khi Sinh lực tụt
// thấp, Sĩ Khí khi con số bắt đầu xê dịch, Phá Thế khi thanh vàng hiện ra, vòng đỏ khi nó xuất hiện…), thay vì dồn chữ vào thẻ cuối bài tập.
//
// Mỗi gợi ý hiện đúng MỘT lần (cờ lưu ở save.hints — createHints ghi thẳng vào đối tượng seen được đưa vào), hai gợi ý cách nhau ≥ GAP_SEC giây,
// hàng đợi có ưu tiên và hạn chờ (ttl: quá hạn thì bỏ mà chưa tính là đã xem). Hiện qua director.say(chữ, T, "tip"): dùng khung tin có sẵn,
// chữ phím ({c}, {block}, {act:cmd}…) đổi theo thiết bị lúc vẽ (hud.js update, ctx.fmt). Tắt được ở Cài đặt / bảng tạm dừng (settings.hints).
//
// Ba tầng, tách để kiểm trong Node (tests/hints.test.mjs): HINTS + createHints (hàng đợi, thuần), hintsDue (luật đến hạn trên ảnh chụp, thuần),
// snapshotOf + createHintDriver (đọc ctx của trận, gắn vào vòng lặp battle.js; chỉ đọc ctx nên chạy được với ctx giả). Không THREE.

import { GLOSS } from "../data/glossary.js";
import { SKILLS } from "../data/heroes.js";
import { WEAPON_CLASSES } from "../data/weapon-classes.js";
import { HERO, HAO_KHI, SIM } from "../data/tuning.js";

export const GAP_SEC = 9;                  // hai gợi ý cách nhau ít nhất chừng này giây
const TICK = 0.25;                         // nhịp đọc ảnh chụp trận (giây); cạnh bấm C được đọc ngay khung đó
const LOW_HP = 0.35;                       // Sinh lực dưới mức này (còn lượt Gượng dậy) → nhắc Gượng dậy
const SK_LOW = 25, SK_SHIFT = 10, SK_FIRST_AT = 40;   // Sĩ Khí cánh ta dưới 25 → cảnh báo; một cánh lệch ≥ 10 khỏi 50, hoặc sau 40 s → giải thích
const HICH_AFTER = 30;                     // sau chừng này giây chưa dùng Hịch Tướng Sĩ (E) thì nhắc
const RED_NEAR = 14, OFFICER_NEAR = 25;    // vòng đỏ gần tướng; sĩ quan gần để nhắc Binh Thư (m)
const KITE_NEAR = 14, KITE_AFTER = 3;      // cung kỵ lùi giữ tầm trong 14 m quanh tướng liên tục 3 s → dạy cách bắt kịp (đợt 12a)

const vn = (x) => String(x).replace(".", ",");
const pct = (x) => `${Math.round(x * 100)}%`;

// prio: lớn hiện trước · ttl: giây được chờ trong hàng đợi · T: giây hiện trên màn · also: id coi như đã xem luôn · text(info) → chữ (có {token} phím)
export const HINTS = {
  guongDay: { prio: 90, ttl: 4, T: 9,
    text: ({ n = 1, hp = HERO.revive.hp, invuln = HERO.revive.invuln } = {}) => `Gục thì còn ${n} lần Gượng dậy: đứng lại với ${pct(hp)} Sinh lực, bất tử ${invuln} s, trừ ${-HAO_KHI.src.reviveUsed} Hào Khí. Hết lượt mà gục là thua.` },
  chiemNgat: { prio: 85, ttl: 3, T: 8, text: () => "Trúng đòn viền đỏ làm tiến độ chiếm Cứ Điểm về 0. Né vòng đỏ rồi chiếm lại." },
  doDo: { prio: 80, ttl: 3, T: 9, text: () => GLOSS.doDo.short },
  phaThe: { prio: 70, ttl: 6, T: 10, text: () => GLOSS.phaThe.short },
  siKhiThap: { prio: 60, ttl: 10, T: 10, also: ["siKhi"],
    text: ({ id = "?", n = 0 } = {}) => `Sĩ Khí cánh ${id} còn ${n}/100. Dưới ${SIM.collapseSK} quá ${SIM.collapseHold} s thì cánh vỡ, mất Cứ Điểm gần nhất. Mở Mệnh Lệnh ({act:cmd}) chọn Giữ vững, hoặc tới đánh cùng cánh đó.` },
  siKhi: { prio: 50, ttl: 30, T: 11, text: () => GLOSS.siKhi.short },
  tuLuc: { prio: 40, ttl: 5, T: 9,
    text: () => { const c = WEAPON_CLASSES.WC01.traits.charge; return `Đại kiếm: giữ {c} thay vì bấm nhanh để tụ lực. Giữ ${vn(c.levels[0])} s lên cấp 2 (sát thương ×${vn(c.mult[1])}), ${vn(c.levels[1])} s lên cấp 3 (×${vn(c.mult[2])}); thanh "Tụ lực" hiện dưới Sinh lực.`; } },
  // Cung (WC09, H40): lần bấm đầu N / C — ngắm, tên bay thật, căng dây (đợt B17-B1)
  cung: { prio: 42, ttl: 6, T: 11,
    text: () => { const R = WEAPON_CLASSES.WC09.traits.ranged; return `Cung: {n} bắn, tự nhắm người gần tâm ngắm (±${R.aimCone}°, ${R.aimRange} m); tên bay thật, kẻ né khỏi đường tên là trượt. Vừa đi vừa bắn được. Giữ {c} để căng dây, ngắm chính xác theo tâm màn, thả ra là bắn.`; } },
  hich: { prio: 30, ttl: 30, T: 10,
    text: () => { const H = SKILLS.hichTuongSi; return `Bấm {skill}: ${H.name}. Đứng đọc ${H.channel} s (trúng đòn nặng thì bị ngắt), mọi cánh quân ta tăng ${H.siKhi} Sĩ Khí (tinh thần) và Công +${pct(H.allyAtk)} trong ${H.dur} s.`; } },
  kyLui: { prio: 55, ttl: 6, T: 10, text: () => GLOSS.cungKy.short },
  cuaNgo: { prio: 65, ttl: 12, T: 11, text: () => GLOSS.cuaNgo.short },        // sang P2 (director.completeMain): doanh trại là cửa ngõ viện binh của cánh
  binhThu: { prio: 30, ttl: 20, T: 10,
    text: () => { const B = SKILLS.binhThu; return `Bấm {skill2}: ${B.name}. Chỉ gươm đánh dấu một đơn vị địch (hoặc Cứ Điểm); ${B.mark} s quân ta đánh nó mạnh hơn ${pct(B.dmgPct)}.`; } },
};

// ---- hàng đợi --------------------------------------------------------------------------------------------------------------
// seen: đối tượng { id: true } (save.hints) — ghi thẳng vào đây; enabled(): đọc mỗi lần (bật / tắt giữa trận có hiệu lực ngay); onSeen(id): để lưu save.
export function createHints({ seen = {}, enabled = () => true, gap = GAP_SEC, onSeen = null } = {}) {
  const queue = []; let lastAt = -Infinity;
  return {
    seen,
    get size() { return queue.length; },
    // Xếp hàng nếu gợi ý có thật, đang bật, chưa xem, chưa xếp. Gọi lặp mỗi nhịp khi điều kiện còn đúng cũng được.
    offer(id, info = {}, now = 0) {
      if (!HINTS[id] || !enabled() || seen[id] || queue.some((q) => q.id === id)) return false;
      queue.push({ id, info, at: now }); return true;
    },
    // Gợi ý kế tiếp được phép hiện lúc now (đủ gap, ưu tiên cao nhất, còn hạn) → { id, text, T } và đánh dấu đã xem; không thì null.
    next(now = 0) {
      for (let i = queue.length - 1; i >= 0; i--) if (now - queue[i].at > HINTS[queue[i].id].ttl) queue.splice(i, 1);
      if (!queue.length || !enabled() || now - lastAt < gap) return null;
      let best = 0;
      for (let i = 1; i < queue.length; i++) if (HINTS[queue[i].id].prio > HINTS[queue[best].id].prio) best = i;
      const q = queue.splice(best, 1)[0], H = HINTS[q.id];
      lastAt = now; seen[q.id] = true; for (const a of H.also || []) seen[a] = true;
      for (let i = queue.length - 1; i >= 0; i--) if (seen[queue[i].id]) queue.splice(i, 1);     // cái vừa được coi như đã xem (also) mà đang chờ thì bỏ, khỏi nhắc lần hai
      onSeen?.(q.id);
      return { id: q.id, text: H.text(q.info), T: H.T };
    },
  };
}

// ---- luật đến hạn (thuần) ----------------------------------------------------------------------------------------------------
// snap: ảnh chụp trận (snapshotOf):
//   t (giây trong trận) · battle ("B15"…) · hero { id, alive, hpFrac, revives, revive{hp,invuln}, charge (có tụ lực), ranged (cung WC09), sk1, sk2, ready1, ready2 }
//   used { skill, skill2 } (đã bấm E / T lần nào chưa) · pressed (cạnh bấm khung này) · fronts [{ id, ta, dich }] | null (chỉ B15 hiện Sĩ Khí)
//   target { poiseMax } | null (khung mục tiêu HUD) · redRing (vòng đỏ gần tướng) · officerNear
//   kiteT (giây cung kỵ thật lùi giữ tầm gần tướng liên tục; bộ gợi ý tự cộng, snapshotOf chỉ cho kiter)
// → [{ id, info }]: những gợi ý đang đến hạn (chưa lọc cái đã xem — createHints lo).
export function hintsDue(s) {
  const out = [], h = s.hero;
  if (h.alive && h.revives > 0 && h.hpFrac < LOW_HP) out.push({ id: "guongDay", info: { n: h.revives, hp: h.revive?.hp, invuln: h.revive?.invuln } });
  if (s.redRing) out.push({ id: "doDo", info: {} });
  if (s.target && s.target.poiseMax > 0) out.push({ id: "phaThe", info: {} });
  if (s.fronts) {
    let low = null, shifted = false;
    for (const f of s.fronts) {
      if (f.ta < SK_LOW && (!low || f.ta < low.n)) low = { id: f.id, n: Math.round(f.ta) };
      if (Math.abs(f.ta - SIM.skDrift) >= SK_SHIFT || Math.abs(f.dich - SIM.skDrift) >= SK_SHIFT) shifted = true;
    }
    if (low) out.push({ id: "siKhiThap", info: low });
    if (shifted || s.t >= SK_FIRST_AT) out.push({ id: "siKhi", info: {} });
  }
  if (h.charge && !h.ranged && s.pressed?.c) out.push({ id: "tuLuc", info: {} });
  if (h.ranged && (s.pressed?.n || s.pressed?.c)) out.push({ id: "cung", info: {} });
  if (h.sk1 === "hichTuongSi" && h.ready1 && !s.used.skill && s.t >= HICH_AFTER) out.push({ id: "hich", info: {} });
  if (h.sk2 === "binhThu" && h.ready2 && !s.used.skill2 && s.officerNear) out.push({ id: "binhThu", info: {} });
  if (s.kiteT >= KITE_AFTER) out.push({ id: "kyLui", info: {} });
  return out;
}

// Có cung kỵ THẬT (trúng đòn được) đang lùi giữ tầm trong KITE_NEAR m quanh tướng không. a.kiting do crowd.update đặt mỗi khung.
function kiterNear(ctx) {
  const h = ctx.hero, crowd = ctx.crowd;
  if (!crowd?.agents) return false;
  for (const a of crowd.agents) {
    if (a.side !== "dich" || !a.kiting || !a.K?.mounted || !a.K?.ranged || !crowd.hittable(a)) continue;
    if ((a.x - h.x) ** 2 + (a.z - h.z) ** 2 < KITE_NEAR * KITE_NEAR) return true;
  }
  return false;
}

// ---- đọc ctx của trận ----------------------------------------------------------------------------------------------------------
export function snapshotOf(ctx, mem, inp) {
  const h = ctx.hero, def = h.def || {}, sk = def.skills || {};
  const live = (u) => !!u && u.alive && !u.dead, dist = (u) => Math.hypot(u.x - h.x, u.z - h.z);
  const tgt = (live(h.lock) ? h.lock : null) || ctx.hud?.nearestOfficer?.() || null;
  return {
    t: mem.t, battle: ctx.battle?.id ?? "",
    hero: { id: h.id ?? def.id, alive: !!h.alive, hpFrac: h.maxHp > 0 ? h.hp / h.maxHp : 1, revives: h.revives ?? 0, revive: def.revive,
      charge: !!h.chargeTrait, ranged: !!h.ranged, sk1: sk.sk1 ?? null, sk2: sk.sk2 ?? null, ready1: !!h.skillReady?.(1), ready2: !!h.skillReady?.(2) },
    used: mem.used, pressed: inp?.pressed || {},
    fronts: ctx.battle?.id === "B15" && ctx.sim?.fronts ? Object.entries(ctx.sim.fronts).map(([id, f]) => ({ id, ta: f.sk.ta, dich: f.sk.dich })) : null,   // B20 không hiện Sĩ Khí
    target: tgt ? { poiseMax: tgt.poiseMax || 0 } : null,
    redRing: (ctx.fx?.teles || []).some((t) => !t.big && live(t.unit) && dist(t.unit) < RED_NEAR),         // big: Tuyệt Kỹ sĩ quan (đã có băng chữ riêng)
    officerNear: (ctx.units || []).some((u) => u.side === "dich" && live(u) && u.awake && dist(u) < OFFICER_NEAR),
    kiter: kiterNear(ctx),
  };
}

// Gắn vào vòng lặp trận (battle.js step): update(dt, inp) mỗi khung; event(id) cho việc chỉ director biết (vd đòn đỏ ngắt chiếm: director.onHeroHit).
export function createHintDriver(ctx, { seen = {}, enabled = () => true, onSeen = null, gap = GAP_SEC } = {}) {
  const hints = createHints({ seen, enabled, gap, onSeen });
  const mem = { t: 0, acc: 0, kiteT: 0, used: { skill: false, skill2: false } };
  return {
    hints,
    update(dt, inp) {
      const d = ctx.director;
      if (!d) return;
      mem.t += dt; mem.acc += dt;                                    // đồng hồ và cờ "đã bấm E / T" chạy cả lúc gợi ý tắt: bật lại giữa trận thì giãn cách tính đúng, không nhắc nhầm Hịch
      const P = inp?.pressed || {};
      if (P.skill) mem.used.skill = true;
      if (P.skill2) mem.used.skill2 = true;
      if (d.over || !enabled()) { mem.acc = 0; mem.kiteT = 0; return; }       // tắt rồi bật lại giữa trận: không dồn thời gian lúc tắt vào đồng hồ lùi giữ tầm
      if (mem.acc >= TICK || P.c || (P.n && ctx.hero?.ranged)) {      // cạnh bấm C (và N của cung) chỉ tồn tại một khung: đọc ngay khung đó
        const step = mem.acc; mem.acc = 0;
        const snap = snapshotOf(ctx, mem, inp);
        mem.kiteT = snap.kiter ? mem.kiteT + step : 0;               // đứt quãng (hết lùi, lính hạ, xa tướng) thì đếm lại từ đầu
        snap.kiteT = mem.kiteT;
        for (const { id, info } of hintsDue(snap)) hints.offer(id, info, mem.t);
      }
      const h = hints.next(mem.t);
      if (h) d.say(h.text, h.T, "tip");
    },
    event(id, info = {}) { hints.offer(id, info, mem.t); },
  };
}
