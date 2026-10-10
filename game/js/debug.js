// debug.js — công cụ kiểm thử trận bằng script. Chỉ nạp khi URL có ?debug.
//   __start()               vào trận từ Doanh trại
//   __hk.advance(s, bot)    tua s giây logic trận (không cần requestAnimationFrame)
//   __bot(target, opts)     bot chơi thay người (xem dưới); target là điểm {x, z} hoặc hàm (ctx) → điểm
//   __objective(ctx)        mục tiêu theo pha: A1 → A2 → cổng bắc → Toa Đô (B20 Bạch Đằng: chuyển sang __objectiveB20)
//   __objectiveB20(ctx)     B20: việc theo pha (Ra khiêu chiến bằng Lệnh Kế Sách, đánh lính tiên phong, chờ cảnh tua, Phàn Tiếp,
//                           kỳ hạm + cầu thang, Tổng Phản Công ở pha 6) — xem dưới
//   __state()               ảnh chụp gọn trạng thái trận (B20: battles/b20.js debug.state)
//   __botDbg                bot đang chạy: việc đang làm (mode), mục tiêu (tgt), bộ đếm phản đòn / đỡ / né / Tuyệt Kỹ…,
//                           time: giây trận dồn theo "pha + việc" (biết bot tốn thời gian ở đâu)
//
// Bot chơi như người chơi khá (mặc định). Mọi tính năng bật sẵn, tắt từng cái bằng opts.<tên> = false:
//   parry   phản đòn viền đỏ (bấm Đỡ ~0,15 s trước lúc bổ); hết lượt phản (đang khóa) thì lộn né
//   block   giữ Đỡ khi sĩ quan vung đòn thường, khi đứng giữ vòng chiếm; khóa mục tiêu vào sĩ quan để thế đỡ quay đúng
//   dodge   né cú húc / đòn nặng của lực sĩ, né tên sắp trúng, lộn tránh Tuyệt Kỹ Toa Đô
//   finisher Đòn Quyết (C) khi sĩ quan Vỡ Thế
//   ult     Tuyệt Kỹ khi sĩ quan trong tầm, khi bị vây đông, hoặc khi máu thấp (10 s bất tử); cả Tuyệt Kỹ Hào Khí
//   skill   Phá Trận để đuổi cung thủ / cung kỵ đang thả diều, hoặc lao thoát vòng vây khi máu thấp
//   tpc     Tổng Phản Công khi Hào Khí đủ 100
//   heal    máu dưới healAt (0,5) thì đi nhặt Cơm nắm / Rượu thuốc (≤ 60 m; dưới 0,35 thì ≤ 140 m); máu cao thì đi vòng tránh
//   hunt    săn quân đồn trú còn sót (cung kỵ thả diều ngoài vòng Cứ Điểm) và cung thủ đang giữ thẻ bắn tướng
//   roll    đi xa thì lộn liên tiếp (nhanh hơn chạy ~40%, có khung bất tử)
//   orders  Mệnh Lệnh: Tiến công / Giữ vững cho mặt trận có sự kiện (quân ta tự hạ toán phản công, toán vây tướng),
//           Tiến công cho mặt trận đang đứng khi rảnh, Gọi tiếp viện ở P2
//   kesach  bấm Lệnh Kế Sách (G) ngay khi có Kế Sách Sẵn sàng; mục tiêu { ks: true } (xem __objective) thì săn toán giữ bờ
//           Kế Sách "Cờ áo Tống" (lính và Đội trưởng giữ bờ) cho thuyền quân Triệu Trung đi tiếp
//   Số: reach (3,4 m tầm ra đòn), engage (30 m: xa mục tiêu hơn thì chỉ chạy, không dây dưa), healAt (0,5), ultHp (0,3),
//   gateHunt (9 m: ở cổng chỉ đuổi cung thủ giữ cổng gần hơn thế, hoặc đang giữ thẻ bắn mình).
//   Tay người: react (0,2 s — chỉ phản ứng khi đòn gồng / cú húc / mũi tên đã hiện ít nhất chừng ấy), miss (0,1 — xác suất
//   không để ý một đòn), seed (PRNG riêng của bot, trận vẫn xác định). { react: 0, miss: 0 } = tay máy (phản xạ hoàn hảo).
// opts.smart = false: bot cũ (đi tới mục tiêu, gặp địch thì chém; parry/ult/skill/tpc phải bật tay như trước).
//
// Vì sao bot cũ thua ở A2: không phải vì Phó tướng (bị hạ trong mọi lần chạy, gây 70–200 sát thương) mà vì quân đồn
// trú còn sót là cung kỵ đứng thả diều ở 0,7 × tầm bắn ≈ 14 m, ngay ngoài vòng 13 m. Bot cũ chỉ đánh địch trong 12 m nên
// đứng giữa vòng chờ chiếm (không chiếm được khi còn quân đồn trú) và bị bắn tới chết: 0–416 s đứng yên mỗi trận.
// Phía game đã sửa: dòng nhắc "Hạ quân đồn trú: còn N" nay hiện (director.updateBases), cung đồn trú không thả diều quá
// vòng + AI.kiteLeash. Bot cũ vẫn kẹt vì con cung cuối đứng cách tướng ~14 m (trong dây) mà bot chỉ nhìn 12 m.

import { fortRoute } from "./battle/fort.js";

window.__start = () => document.querySelector("[data-go]")?.click();

window.__bot = (getTarget, opts = {}) => (opts.smart === false ? legacyBot(getTarget, opts) : smartBot(getTarget, opts));

// ---- bot cũ (giữ để so sánh) ------------------------------------------------------------------------
function legacyBot(getTarget, opts) {
  let t = 0;
  return (c) => {
    t += 1 / 30;
    const h = c.hero, inp = c.input;
    const tg = typeof getTarget === "function" ? getTarget(c) : getTarget;
    const cy = c.cam.yaw, fx = Math.sin(cy), fz = Math.cos(cy);
    const steer = (dx, dz) => { const L = Math.hypot(dx, dz) || 1; inp.setStick((dx / L) * -fz + (dz / L) * fx, (dx / L) * fx + (dz / L) * fz); };
    if (opts.ult && h.ki >= 100 && h.nearestEnemy(5)) inp.pressed.ult = true;
    if (opts.skill && h.phaTran.cd <= 0 && h.nearestEnemy(10)) inp.pressed.skill = true;
    if (opts.tpc && c.hk.value >= 100) inp.pressed.tpc = true;
    for (const u of c.units) {
      if (u.side !== "dich" || !u.alive || u.dead) continue;
      const du = Math.hypot(u.x - h.x, u.z - h.z);
      if (opts.parry && u.state === "red" && du < 4.2 && !u._parried && u.st >= 0.6 - 0.1) { inp.pressed.block = true; u._parried = true; }
      if (u.state !== "red") u._parried = false;
      if (opts.parry && u.state === "ult" && du < 8 && u.st < 0.9) {
        const L = du || 1; inp.setStick(((h.x - u.x) / L) * -fz + ((h.z - u.z) / L) * fx, ((h.x - u.x) / L) * fx + ((h.z - u.z) / L) * fz);
        if (u.st > 0.6 && !u._dodged) { inp.pressed.dodge = true; u._dodged = true; }
        return;
      }
      if (u.state !== "ult") u._dodged = false;
    }
    const e = h.nearestEnemy(opts.reach ?? 3.6);
    if (e) {
      inp.setStick(0, 0);
      if (Math.floor(t * 30) % 4 === 0) inp.pressed[Math.floor(t * 3) % 5 === 4 ? "c" : "n"] = true;
      return;
    }
    const dx = tg.x - h.x, dz = tg.z - h.z, L = Math.hypot(dx, dz);
    if (tg.gate && L < 4) {
      inp.setStick(0, 0); h.yaw = Math.atan2(dx + 2.5, dz);
      if (Math.floor(t * 30) % 4 === 0) inp.pressed[Math.floor(t * 3) % 3 === 2 ? "c" : "n"] = true;
      return;
    }
    const e2 = h.nearestEnemy(12);
    if (e2 && L < (opts.engage ?? 30)) { steer(e2.x - h.x, e2.z - h.z); return; }
    if (L > 1.2) steer(dx, dz); else inp.setStick(0, 0);
  };
}

// ---- bot chơi như người -----------------------------------------------------------------------------
// Số đọc từ luật trận (units.js, hero.js, crowd.js): đòn viền đỏ bổ ở 0,6 s; đòn thường sĩ quan trúng ở 0,5 × 0,95 s;
// Né bất tử 0,25 s đầu; phản đòn cửa sổ 0,2 s (cảm ứng) + 0,02.
const RED_LEAD = 0.15;                 // bấm Đỡ khi còn ≤ 0,15 s tới lúc bổ
const OFF_HIT = 0.475;                 // đòn thường sĩ quan trúng ở st = 0,475 s
const HEAL_KINDS = new Set(["comnam", "ruouthuoc"]);
const CHAIN_N = new Set(["N1", "N2", "N3", "N4", "N5"]);
const CMD_KEY = { tiencong: "cmd1", giuvung: "cmd2", theota: "cmd3", tiepvien: "cmd4" };

function smartBot(getTarget, opts) {
  const on = (k) => opts[k] !== false;
  const REACH = opts.reach ?? 3.4, ENGAGE = opts.engage ?? 30, HEAL_AT = opts.healAt ?? 0.5, ULT_HP = opts.ultHp ?? 0.3;
  const GATE_HUNT = opts.gateHunt ?? 9;       // ở cổng chỉ đuổi cung thủ giữ cổng trong 9 m (cổng không cần hạ hết quân giữ)
  // Tay người: chỉ phản ứng khi dấu hiệu (đòn gồng, cú húc, mũi tên) đã hiện ≥ react giây, và mỗi đòn có xác suất miss
  // không để ý (gieo một lần cho mỗi đòn, PRNG riêng theo opts.seed nên trận vẫn xác định). react 0 + miss 0 = tay máy.
  const REACT = opts.react ?? 0.2, MISS = opts.miss ?? 0.1;
  let rs = (opts.seed ?? 1) >>> 0;
  const rnd = () => { rs = (rs + 0x6d2b79f5) >>> 0; let t = rs; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const rolls = new WeakMap();
  const notice = (obj, key) => { const r = rolls.get(obj); if (r && r.key === key) return r.ok; const ok = rnd() >= MISS; rolls.set(obj, { key, ok }); if (!ok) dbg.missed++; return ok; };
  const seenRed = new WeakMap();       // mỗi đòn viền đỏ xử lý một lần (khóa theo impactAt của đòn)
  let lastArrowDodge = -9, lastOrder = -9, reinfUsed = 0, lastSkill = -9, lastNow = -1;
  let stuck = { x: 0, z: 0, t: 0 }, unstickT = 0, unstickSide = 1;
  const seenAtk = new WeakMap();       // đòn thường sĩ quan đã đỡ (khóa theo u.combo) — chỉ để đếm
  let healTrip = null;
  // bộ đếm: parry (bấm phản đòn), dodgeRed (né đòn đỏ khi đang khóa phản), block (đòn thường sĩ quan đã giữ Đỡ), dodgeArrow,
  // dodgeHeavy (né húc / đòn nặng lực sĩ), ult, skill (lần bấm Phá Trận), orders, heal (lần đi nhặt thuốc), unstick;
  // time: giây trận theo "pha + việc"
  const dbg = window.__botDbg = { mode: "", tgt: "", parry: 0, dodgeRed: 0, block: 0, dodgeArrow: 0, dodgeHeavy: 0, ult: 0, skill: 0,
    orders: 0, heal: 0, unstick: 0, missed: 0, time: {} };

  let lastFerry = -9;                  // B20: lần gọi đò gần nhất (đồng hồ trận)
  return (c) => {
    const h = c.hero, inp = c.input, d = c.director, crowd = c.crowd, sim = c.sim, now = c.clock, P = inp.pressed;
    inp.touchHeld.block = false; inp.touchHeld.cmd = false;
    // B20 Bạch Đằng: lớp thủy chiến (ctx.naval) — địch trên thuyền khác (không có ván / cửa nối) không tới được; Tương tác giữ X
    // do mục tiêu B20 quyết (__objectiveB20: obj.hold) nên mỗi khung thả trước. B15 không vào nhánh nào có b20.
    const b20 = c.battle?.id === "B20" ? c.naval : null;
    if (b20) inp.touchHeld.interact = false;
    if (!h.alive || d.over) { inp.setStick(0, 0); return; }

    // ---- tiện ích --------------------------------------------------------------------------------
    const cy = c.cam.yaw, fx = Math.sin(cy), fz = Math.cos(cy);
    const stick = (dx, dz, m = 1) => {
      const L = Math.hypot(dx, dz);
      if (L < 1e-6 || m <= 0) { inp.setStick(0, 0); return; }
      inp.setStick(m * ((dx / L) * -fz + (dz / L) * fx), m * ((dx / L) * fx + (dz / L) * fz));
    };
    const dist = (o) => Math.hypot(o.x - h.x, o.z - h.z);
    const hpF = h.hp / h.maxHp;
    const free = h.state === "free" || h.state === "block";
    const mode = (m, t = null) => { dbg.mode = m; dbg.tgt = t ? (t.isBig ? t.tier : t.kit + "@" + t.role) + ":" + dist(t).toFixed(1) : ""; };
    // thời gian trận dành cho từng việc (theo đồng hồ trận): biết bot tốn thời gian ở đâu
    if (dbg.mode && lastNow >= 0) { const k = "P" + (d.phase + 1) + " " + dbg.mode.replace(/ \(.*\)$/, ""); dbg.time[k] = (dbg.time[k] || 0) + (now - lastNow); }
    lastNow = now;
    // B20: đang ngồi đò / leo boong — không điều khiển được, chờ
    if (b20 && (h.state === "ride" || h.state === "climb")) { inp.setStick(0, 0); if (d.ferryPick) d.ferryPick = null; mode(h.state === "ride" ? "ngồi đò" : "leo boong"); return; }
    const reach = b20 ? reachFn(b20, h) : null;

    const foes = [];
    for (const a of crowd.agents) if (a.side === "dich" && crowd.hittable(a) && (!reach || reach(a))) { const dd = dist(a); if (dd < 70) foes.push({ a, d: dd }); }
    foes.sort((p, q) => p.d - q.d);
    const bigs = [];
    // (B20: đơn vị lớn ở tầng khác — Ô Mã Nhi trên lầu chỉ huy khi tướng ở boong dưới — chém không tới: bỏ, mục tiêu dẫn lên cầu thang)
    for (const u of c.units) if (u.side === "dich" && u.alive && !u.dead && !u.retreating && (!reach || (!u.script && reach(u) && Math.abs(u.y - h.y) < 1.8))) bigs.push({ u, d: dist(u) });
    bigs.sort((p, q) => p.d - q.d);
    const count = (r, f) => { let n = 0; for (const o of foes) { if (o.d >= r) break; if (!f || f(o.a)) n++; } return n; };

    // ---- khóa mục tiêu: chỉ khóa sĩ quan đang đấu; sĩ quan chết / xa thì bỏ khóa ----------------
    let lockUsed = false;
    const lk = h.lock;
    if (lk && (lk.dead || !lk.alive || lk.retreating || dist(lk) > 22)) { P.lock = true; lockUsed = true; }
    const wantLock = (u) => {
      if (lockUsed || h.lock === u) return;
      if (h.lock) { P.lock = true; lockUsed = true; return; }                 // bỏ khóa cũ, khung sau khóa lại
      if (bigs.length && bigs[0].u === u) { P.lock = true; lockUsed = true; }   // toggleLock chọn đơn vị lớn gần nhất
    };
    const dropLock = () => { if (h.lock && !lockUsed) { P.lock = true; lockUsed = true; } };
    const countBlock = (u) => { if (seenAtk.get(u) !== u.combo) { seenAtk.set(u, u.combo); dbg.block++; } };

    // ---- 1. phòng thủ -----------------------------------------------------------------------------
    // (a) Tuyệt Kỹ Toa Đô: không đỡ được — Tuyệt Kỹ của mình (bất tử) hoặc chạy khỏi 7 m, lộn né lúc sắp nổ
    for (const { u, d: du } of bigs) {
      if (u.state !== "ult" || du > 9) continue;
      const hitAt = (u.T.ultTelegraph ?? 1) + 0.3;
      if (on("ult") && h.state !== "ult" && (h.ki >= 100 || (h.inTPC && h.hkUltReady)) && u.st < hitAt - 0.12 && free) { P.ult = true; dbg.ult++; mode("Tuyệt Kỹ chặn Tuyệt Kỹ", u); return; }
      stick(h.x - u.x, h.z - u.z, 1);
      if (on("dodge") && du < 7.6 && (u.st > hitAt - 0.26 || h.state === "attack")) P.dodge = true;
      mode("tránh Tuyệt Kỹ", u); return;
    }
    // (b) đòn viền đỏ: phản đòn (không đỡ được); đang khóa phản thì lộn né; ngoài tầm thì lùi ra
    for (const { u, d: du } of bigs) {
      if (u.state !== "red" || du > 6.5 || seenRed.get(u) === u.impactAt || !notice(u, "r" + u.impactAt)) continue;
      const tImp = u.impactAt - now;
      if (du > 4.4) { stick(h.x - u.x, h.z - u.z, 1); mode("lùi khỏi đòn đỏ", u); return; }
      wantLock(u);
      if (tImp <= RED_LEAD) {
        seenRed.set(u, u.impactAt);
        if (on("parry") && now > h.parryLock) { P.block = true; dbg.parry++; }
        else if (on("dodge") && free) { stick(h.x - u.x, h.z - u.z, 1); P.dodge = true; dbg.dodgeRed++; mode("né đòn đỏ", u); return; }
      }
      break;       // còn sớm: cứ đánh tiếp (phản đòn cắt ngang mọi trạng thái)
    }
    // (c) sĩ quan vung đòn thường (đòn nặng, cắt ngang đòn của tướng): giữ Đỡ nếu kịp vào thế đỡ, không thì lộn né
    if (on("block")) for (const { u, d: du } of bigs) {
      if (u.state !== "atk" || u.hitDone || du > 4.6 || !faces(u, h, 1.35) || u.st < REACT || !notice(u, "a" + u.combo)) continue;
      const tImp = OFF_HIT - u.st;
      if (tImp < -0.01) continue;
      wantLock(u);
      if (h.state === "attack") {
        const rem = h.dur - h.st;
        if (rem < tImp - 0.03) { inp.touchHeld.block = true; inp.setStick(0, 0); countBlock(u); mode("chờ đỡ", u); return; }
        if (on("dodge") && h.dur * 0.7 - h.st < tImp - 0.03) { stick(h.x - u.x, h.z - u.z, 1); P.dodge = true; mode("né đòn thường", u); return; }
        break;     // không kịp: chịu đòn
      }
      if (free || h.state === "hit" || h.state === "down") { inp.touchHeld.block = true; inp.setStick(0, 0); countBlock(u); mode("đỡ sĩ quan", u); return; }
      break;
    }
    // (d) lực sĩ lao húc (trúng thì ngã) và đòn nặng sắp bổ vào mình: lộn né
    if (on("dodge")) for (const { a, d: da } of foes) {
      if (da > 7) break;
      if (a.chargeT > 0 && 0.9 - a.chargeT >= REACT && notice(a, "c" + Math.round((now - 0.9 + a.chargeT) * 10))) {
        const rx = h.x - a.x, rz = h.z - a.z, along = rx * a.chargeX + rz * a.chargeZ, perp = rx * a.chargeZ - rz * a.chargeX;
        if (along > -0.5 && along < 6 && Math.abs(perp) < 1.8) {
          if (free) { const s = perp >= 0 ? 1 : -1; stick(a.chargeZ * s, -a.chargeX * s, 1); P.dodge = true; dbg.dodgeHeavy++; mode("né cú húc", a); return; }
          if (h.state === "attack") P.dodge = true;
        }
      }
      if (a.K.heavy && a.windup > 0 && !a.fake && a.target === h && a.windup < 0.3 && da < (a.K.reach || 2.3) + 1.4
        && a.windupT - a.windup >= REACT && notice(a, "w" + Math.round((now - a.windupT + a.windup) * 10))) {
        if (free || (h.state === "attack" && h.dur * 0.7 - h.st < a.windup - 0.02)) { stick(h.x - a.x, h.z - a.z, 1); P.dodge = true; dbg.dodgeHeavy++; mode("né đòn nặng", a); return; }
      }
    }
    // (e) tên sắp trúng (≤ 0,2 s) — chỉ khi rảnh tay và không đang đấu sĩ quan sát sườn
    const duel = bigs.find((o) => o.d < 4.2 && o.u.awake);
    if (on("dodge") && free && now - lastArrowDodge > 0.45 && h.dodgeCd <= 0 && (!duel || hpF < 0.4)) {
      const th = arrowThreat(crowd, h, REACT, notice);
      if (th && th.t >= 0.02 && th.t <= 0.2) {
        // lộn vuông góc với đường tên, về phía có ít địch hơn
        const px = -th.vz, pz = th.vx, L = Math.hypot(px, pz) || 1;
        let s = 1, best = -1e9;
        for (const sg of [1, -1]) { const tx = h.x + sg * px / L * 4, tz = h.z + sg * pz / L * 4; let sc = 0; for (const o of foes) { if (o.d > 10) break; sc -= 1 / (1 + Math.hypot(o.a.x - tx, o.a.z - tz)); } if (sc > best) { best = sc; s = sg; } }
        stick(s * px, s * pz, 1); P.dodge = true; lastArrowDodge = now; dbg.dodgeArrow++; mode("né tên"); return;
      }
    }

    // ---- 2. Mệnh Lệnh (một khung giữ vòng lệnh) ------------------------------------------------------
    if (!b20 && on("orders") && now - lastOrder > 1 && !lockUsed && free) {
      const cmd = pickOrder(c, reinfUsed);
      if (cmd) {
        const hf = sim.heroFront || d.lastFront;
        inp.touchHeld.cmd = true; if (cmd.front !== hf) P.cmdSwap = true; P[CMD_KEY[cmd.id]] = true;
        if (cmd.id === "tiepvien") reinfUsed++;
        lastOrder = now; dbg.orders++; inp.setStick(0, 0); mode("lệnh " + cmd.id + " → " + cmd.front); return;
      }
    }

    // ---- 3. Tổng Phản Công, Kế Sách -----------------------------------------------------------------
    if (!b20 && on("tpc") && !c.hk.tpc && c.hk.value >= 100) P.tpc = true;
    if (on("kesach") && d.keSach.list.some((k) => k.state === "sansang")) P.kesach = true;

    // ---- 4. mục tiêu -----------------------------------------------------------------------------
    const obj = typeof getTarget === "function" ? getTarget(c) : getTarget;
    // B20: việc của mục tiêu — Tổng Phản Công đúng lúc (obj.tpc), Lệnh Kế Sách (G), giữ X (chiếm thuyền, mở mốc), gọi đò
    // (director.ferryTo: bảng chọn nơi đến là việc của người, bot gọi thẳng), Mệnh Lệnh cho cánh thủy quân (obj.order)
    if (b20) {
      if (on("tpc") && obj.tpc && !c.hk.tpc && c.hk.value >= 100) P.tpc = true;
      if (on("kesach") && obj.kesach) P.kesach = true;
      if (d.ferryPick) d.ferryPick = null;              // bảng chọn tự mở (vừa mở mốc): đóng, bot gọi đò thẳng
      if (on("orders") && obj.order && now - lastOrder > 1) { d.order(obj.order.wing, obj.order.id); lastOrder = now; dbg.orders++; }
      if (obj.hold && !d.needRelease) inp.touchHeld.interact = true;
      const busy = count(3.4) > 0 || bigs.some((o) => o.d < 4.5 && o.u.awake);
      if (obj.ferry && free && (!busy || obj.urgent) && now - lastFerry > 2.5 && !b20.ferries.some((f) => !f.done)) {
        dropLock();
        if (d.ferryTo(obj.ferry)) { lastFerry = now; dbg.ferry = (dbg.ferry || 0) + 1; inp.setStick(0, 0); mode("gọi đò → " + obj.ferry); return; }
      }
      dbg.b20 = obj.why || "";
    }
    const L0 = Math.hypot(obj.x - h.x, obj.z - h.z);
    let baseId = null, gateId = null;
    for (const id in sim.bases) {
      const b = sim.bases[id], p = c.world.bases[id];
      if (!p || b.owner !== "dich" || b.type === "ban_doanh") continue;
      if (b.type === "cong") { const g = c.world.gates[id]; if (obj.gate && g && Math.hypot(g.x - obj.x, g.z - obj.z) < 6) gateId = id; }
      else if (Math.hypot(p.x - obj.x, p.z - obj.z) < 3) baseId = id;
    }
    const B = baseId ? sim.bases[baseId] : null, bp = baseId ? c.world.bases[baseId] : null;
    const keeper = baseId ? d.keepers[baseId] : null;
    const kAlive = !!(keeper && keeper.alive && !keeper.dead);
    const src = baseId || gateId;
    const gar = src ? foes.filter((o) => o.a.role === "garrison" && o.a.src === src) : [];
    const garAll = src ? crowd.agents.some((a) => a.role === "garrison" && a.src === src && crowd.hittable(a)) : false;
    const ready = !!B && B.G < 1 && !garAll && !B.keeperAlive;
    const boss = obj.isBig ? obj : (b20 && obj.boss) || null;
    // Kế Sách "Cờ áo Tống": toán giữ bờ (lính + Đội trưởng) chặn thuyền — mục tiêu { ks: true, ref } là người giữ bờ
    // __objective đã chọn (toán tây nhất trước). Đánh đúng người đó, không đánh "người giữ bờ gần nhất": người gần nhất
    // thường ở toán phía đông, bot chạy qua lại giữa hai toán (mục tiêu xa > 30 m thì chỉ chạy) mà không hạ được ai.
    const ksRef = obj.ks && obj.ref && (obj.ref.isBig ? obj.ref.alive && !obj.ref.dead : crowd.hittable(obj.ref)) ? obj.ref : null;

    // ---- 5. cơ hội: Đòn Quyết, Tuyệt Kỹ ------------------------------------------------------------
    const broken = bigs.find((o) => o.u.broken > 0.15 && o.d < 10);
    if (on("finisher") && broken) {
      const u = broken.u;
      wantLock(u);
      if (broken.d < 4.2) {
        stick(u.x - h.x, u.z - h.z, 0.2);
        if (h.state === "attack" && CHAIN_N.has(h.move)) { mode("chờ ra Đòn Quyết", u); return; }   // C nối chuỗi N thành đòn C, không phải Đòn Quyết
        if (!(h.state === "attack" && h.move === "DQ")) P.c = true;
        mode("Đòn Quyết", u); return;
      }
      if (broken.u.broken > 0.6) { stick(u.x - h.x, u.z - h.z, 1); mode("tới Đòn Quyết", u); return; }
    }
    // tướng không phải H35 (H31, ?debug&hero=H31): Hịch Tướng Sĩ khi quanh 8 m không có địch (đọc 3 s đứng yên), Binh Thư
    // Yếu Lược khi có sĩ quan trong 20 m. H35 không vào nhánh này (bot B15 giữ y hệt).
    if (h.def && h.def.skills?.sk1 !== "phaTran" && on("skill") && free) {
      if (h.skillReady(1) && count(8) === 0 && !bigs.some((o) => o.d < 10)) { P.skill = true; dbg.skill++; mode("Hịch Tướng Sĩ"); return; }
      if (h.skillReady(2) && bigs.length && bigs[0].d < 20) { P.skill2 = true; dbg.skill++; mode("Binh Thư", bigs[0].u); return; }
    }
    if (on("ult") && free && h.state !== "ult") {
      const hk = h.inTPC && h.hkUltReady;
      if (h.ki >= 100 || hk) {
        const off = bigs.find((o) => o.u.awake && o.d < 2.4 + o.u.radius && o.u.hp > o.u.maxHp * 0.3 && o.u.roarT <= 0);
        const crowdN = count(4.5, (a) => !a.K.ranged), officersLeft = kAlive || !!boss || bigs.some((o) => o.d < 30);
        const shot = foes.some((o) => o.d < 22 && o.a.K.ranged && o.a.token);
        // Khí Lực đầy (200) thì dùng thoáng tay hơn cho khỏi phí; máu thấp: 10 s bất tử để hạ kẻ đang bắn / vây mình
        if (off || (crowdN >= (h.ki >= 200 ? 4 : 6) && (h.ki >= 200 || hk || !officersLeft)) || (hpF < ULT_HP && (count(6) >= 3 || shot))) {
          P.ult = true; dbg.ult++; mode(off ? "Tuyệt Kỹ vào sĩ quan" : hpF < ULT_HP ? "Tuyệt Kỹ giữ mạng" : "Tuyệt Kỹ vào đám đông", off?.u); return;
        }
      }
    }

    // ---- 6. hồi máu --------------------------------------------------------------------------------
    if (on("heal") && hpF < HEAL_AT && !duel) {
      let best = null, bd = hpF < 0.35 ? 140 : 60;
      for (const p of d.pickups) if (HEAL_KINDS.has(p.kind) && p.t > 2) { const pd = Math.hypot(p.x - h.x, p.z - h.z); if (pd < bd) { bd = pd; best = p; } }
      if (best) { if (healTrip !== best) { healTrip = best; dbg.heal++; } dropLock(); travel(best.x, best.z, bd, true); mode("đi nhặt " + best.kind); return; }
    }
    // túi quân lương, cờ lệnh gần thì nhặt
    if (on("heal") && free && !duel) for (const p of d.pickups) {
      if ((p.kind === "tuiten" && h.ki < 130) || p.kind === "colenh") { const pd = Math.hypot(p.x - h.x, p.z - h.z); if (pd < 14) { travel(p.x, p.z, pd, false); mode("nhặt " + p.kind); return; } }
    }

    // ---- 7. chọn đối thủ ---------------------------------------------------------------------------
    let tgt = null, why = "";
    const adj = foes.filter((o) => o.d < 3.2 && !o.a.K.ranged);
    const offNear = bigs.find((o) => o.u.awake && o.u.roarT <= 0 && o.d < 5.5);
    const hunting = (a) => a.K.ranged && (a.fleeT || 0) <= 0;
    // xa mục tiêu thì chỉ chạy — trừ khi quân đồn trú của chính mục tiêu đang ở quanh (cung kỵ thả diều kéo tướng ra
    // ngoài 30 m: trước đây bot lượn qua lại ở mép 30 m, lúc săn lúc quay về, mất 10–20 s)
    if (L0 > ENGAGE && !boss && !(gar.length && L0 < 75) && !(b20 && obj.clear)) {
      // đi đường: chỉ đánh khi bị kẹt giữa đám đông
      if (adj.length >= 3) { tgt = adj[0].a; why = "mở đường"; }
    } else if (boss) {
      if (adj.length >= 3 && dist(boss) > 5) { tgt = adj[0].a; why = "dọn quanh"; }
      else { tgt = boss; why = "đấu Toa Đô"; }
    } else if (ready) {
      // vòng đã sạch quân đồn trú và trấn thủ: chỉ chém kẻ áp sát, còn lại đứng giữ vòng
      if (offNear) { tgt = offNear.u; why = "đấu sĩ quan"; }
      else if (adj.length && Math.hypot(bp.x - h.x, bp.z - h.z) < bp.r - 1) { tgt = adj[0].a; why = "giữ vòng"; }
    } else {
      // cung đang giữ thẻ bắn mình trong 11 m; cung của quân đồn trú mục tiêu trong 22 m (phải hạ hết mới chiếm được); ở cổng
      // thì cung giữ cổng đang bắn mình (có thẻ) hoặc ở gần — hai cung kỵ tinh nhuệ bắn ~50 sát thương/s nếu cứ đứng chém cổng
      const rangedTok = on("hunt") ? foes.filter((o) => hunting(o.a) && o.d < 22 && ((o.a.token && o.d < 11) || (src && o.a.role === "garrison" && o.a.src === src && (baseId || o.d < GATE_HUNT || o.a.token)))) : [];
      // đứng ở cổng: cứ chém cổng (C4 đòn vòng 5 m trúng cả cổng lẫn lính quanh mình); chỉ quay sang đánh riêng khi bị ≥ 3
      // lính cận chiến áp sát hoặc cung đang giữ thẻ bắn mình trong gateHunt m. Trước đây (đợt 9 đo) tuyến A áp tới cổng
      // thì vùng chiến đấu bù lính liên tục, bot "dọn" 100–400 s mà không chém cổng nhát nào.
      const gp = gateId ? c.world.gates[gateId] : null, atGate = !!gp && Math.hypot(gp.x - 1.6 - h.x, gp.z - h.z) < 6;
      if (atGate && !offNear) {
        const rt = rangedTok.find((o) => o.a.token && o.d < GATE_HUNT);
        if (adj.length >= 3) { tgt = adj[0].a; why = "cận chiến"; }
        else if (rt) { tgt = rt.a; why = "săn cung"; }
      }
      else if (offNear && !obj.strike) { tgt = offNear.u; why = "đấu sĩ quan"; }      // B16 Vương Kỳ: chém cờ trước, chỉ quay ra khi bị vây
      else if (adj.length && (!obj.strike || adj.length >= 3)) { tgt = adj[0].a; why = "cận chiến"; }
      else if (rangedTok.length) { tgt = rangedTok[0].a; why = "săn cung"; }
      else if (ksRef) { tgt = ksRef; why = ksRef.isBig ? "Kế Sách: sĩ quan giữ bờ" : "Kế Sách: dọn bờ"; }
      else if (kAlive && (keeper.awake || dist(keeper) < 35)) { tgt = keeper; why = "trấn thủ"; }
      else if (on("hunt") && baseId && gar.length) {
        // quân đồn trú còn sót: cung kỵ trước (hay thả diều ngoài vòng), rồi người gần nhất
        const rg = gar.find((o) => o.a.K.ranged && o.d < 30);
        tgt = (rg || gar[0]).a; why = "săn đồn trú";
      }
      else if (b20 && obj.clear && (foes.length || bigs.length)) {
        // B20: dọn boong (lính, trấn thủ / Đội trưởng) trong obj.clear m, chỉ kẻ tới được (cùng boong hoặc qua ván / cửa)
        const f = foes[0], g = bigs[0];
        if (g && g.d < obj.clear && (!f || g.d <= f.d + 3)) { tgt = g.u; why = "B20: sĩ quan"; }
        else if (f && f.d < obj.clear) { tgt = f.a; why = "B20: dọn boong"; }
      }
      else if (foes.length && foes[0].d < (gateId ? 6 : 9)) { tgt = foes[0].a; why = "dọn"; }
    }

    // ---- 8. hành động ------------------------------------------------------------------------------
    if (tgt) {
      const td = dist(tgt), reachT = REACH + (tgt.isBig ? tgt.radius : 0.25);
      if (tgt.isBig) wantLock(tgt); else dropLock();
      // bị vây đông, máu thấp: Phá Trận lao ra phía ít địch
      if (on("skill") && hpF < 0.45 && count(3.5) >= 5 && skillReady(h) && free && now - lastSkill > 0.7) {
        let ex = 0, ez = 0; for (const o of foes) { if (o.d > 5) break; ex += h.x - o.a.x; ez += h.z - o.a.z; }
        dropLock(); stick(ex, ez, 1); P.skill = true; lastSkill = now; dbg.skill++; mode("lao thoát vây"); return;
      }
      if (td <= reachT) { strike(tgt); mode(why, tgt); return; }
      if (h.state === "attack" && count(REACH + 0.3) > 0) { strike(null); mode(why + " (dứt chuỗi)", tgt); return; }
      // đuổi cung thủ thả diều: Phá Trận lao qua (choáng 1 s), không thì lộn liên tiếp
      if (!tgt.isBig && tgt.K.ranged && on("skill") && td > 5.5 && td < 16 && skillReady(h) && free && now - lastSkill > 0.7) {
        dropLock(); stick(tgt.x - h.x, tgt.z - h.z, 1); P.skill = true; lastSkill = now; dbg.skill++; mode("Phá Trận đuổi cung", tgt); return;
      }
      // cung thủ lùi giữ tầm nhanh gần bằng tướng: lộn tới rồi Lướt chém (N ngay sau khi lộn → lao 4 m)
      if (!tgt.isBig && tgt.K.ranged && td < 8.5) {
        stick(tgt.x - h.x, tgt.z - h.z, 1);
        if (h.postDodge > 0 && td < 7) P.n = true;
        else if (on("roll") && free && h.dodgeCd <= 0 && td > reachT + 0.3) P.dodge = true;
        mode(why + " (lộn tới)", tgt); return;
      }
      travel(tgt.x, tgt.z, td, !tgt.isBig && td > 6.5);
      mode(why + " (tiếp cận)", tgt); return;
    }
    dropLock();
    if (h.state === "attack" && count(REACH) > 0) { strike(null); mode("dứt chuỗi"); return; }

    // cổng: đứng trước cổng mà chém (đòn vòng C4 luôn trúng cổng trong 8 m)
    if (gateId && obj.gate) {
      const g = c.world.gates[gateId], gd = Math.hypot(g.x - 1.6 - h.x, g.z - h.z);
      if (gd < 4.5) { stick(g.x - h.x, g.z - h.z, 0.2); strike(null, true); mode("phá cổng"); return; }
      travel(obj.x, obj.z, L0, L0 > 12); mode("tới cổng"); return;
    }
    // vòng Cứ Điểm đã sạch: đứng giữa vòng, giữ Đỡ cho khỏi ngắt đồng hồ chiếm
    if (B && ready) {
      const cd = Math.hypot(bp.x - h.x, bp.z - h.z);
      if (cd > bp.r * 0.45) { travel(bp.x, bp.z, cd, cd > 10); mode("vào vòng chiếm"); return; }
      inp.setStick(0, 0); if (on("block") && count(9) > 0) inp.touchHeld.block = true; mode("giữ vòng chiếm"); return;
    }
    // vật chém được (B16: Vương Kỳ — obj.strike): tới sát rồi chém; B15, B20 không đặt obj.strike
    if (obj.strike) {
      if (L0 < 2.4) { stick(obj.x - h.x, obj.z - h.z, 0.2); strike(null, true); mode("chém vật"); return; }
      travel(obj.x, obj.z, L0, L0 > 14); mode("tới vật"); return;
    }
    if (L0 > 1.2) { travel(obj.x, obj.z, L0, L0 > 14); mode(B ? "tới Cứ Điểm" : "tới mục tiêu"); return; }
    inp.setStick(0, 0); mode("chờ");

    // ---- hàm hành động (dùng biến của khung này) ---------------------------------------------------
    // Chuỗi N N N C (→ C4 đòn vòng 5 m, MV 2,1): DPS cao nhất của song đao cấp thấp, đòn vòng dẹp đám đông và trúng cổng.
    function strike(t, gate = false) {
      if (t) stick(t.x - h.x, t.z - h.z, 0.2); else if (!gate) inp.setStick(0, 0);
      if (h.state === "attack") {
        if (h.move === "N1" || h.move === "N2") P.n = true;
        else if (h.move === "N3") P.c = true;
      } else if (free) {
        if (h.chainGrace > 0 && h.chain >= 1 && h.chain < 3) P.n = true;
        else if (h.chainGrace > 0 && h.chain === 3) P.c = true;
        else P.n = true;
      }
    }
    // Đi tới (x, z): tránh nhặt thuốc khi máu còn cao, gỡ kẹt, lộn liên tiếp khi đi xa.
    function travel(x, z, L, roll) {
      // B20: đích ở boong khác (hoặc dưới bùn) — đi qua cửa đầu tiên (ván bắc, ván xích, ván dốc; naval.route), vượt ngưỡng
      // 2,5 m cho bước hẳn sang; trên boong không lộn (lộn liên tiếp trên boong hẹp đâm lan can)
      if (b20) {
        const w = b20.route(h, null, x, z);
        if (w) { const ex = w.x - h.x, ez = w.z - h.z, n0 = Math.hypot(ex, ez) || 1; x = w.x + ex / n0 * 2.5; z = w.z + ez / n0 * 2.5; L = Math.hypot(x - h.x, z - h.z); }
        if (h.deck) roll = false;
      }
      // tường tây Hàm Tử quan: mục tiêu ở bên kia tường thì đi qua cổng đã mở gần nhất (trước đây bot đâm thẳng vào
      // tường khi đuổi Toa Đô từ chỗ khác ngoài cổng, kẹt hơn 2 phút và mất một lần Gượng dậy)
      const gs = c.world.gates;
      let wall = null; for (const id in gs) { wall = gs[id].x; break; }
      if (wall !== null && (h.x < wall) !== (x < wall)) {
        let g = null, gd = 1e9;
        for (const id in gs) if (c.openGates[id]) { const q = gs[id], dd = Math.abs(q.z - h.z) + Math.abs(q.z - z); if (dd < gd) { gd = dd; g = q; } }
        if (g) {
          const side = h.x < g.x ? -1 : 1;
          if (Math.abs(h.z - g.z) > 2 && Math.abs(h.x - g.x) < 7) { x = g.x + side * 7; z = g.z; }   // sát tường: lùi ra trước cổng
          else if (Math.abs(h.z - g.z) > 2) { x = g.x + side * 5; z = g.z; }                        // tới trước cổng
          else { x = g.x - side * 6; z = g.z; }                                                       // đi qua cổng
          L = Math.hypot(x - h.x, z - h.z);
        }
      }
      // đồn có tường (fort.js, đồn A1 / B1): mục tiêu ở bên kia tường thì đi qua cổng trước / sau (hoặc vòng qua góc)
      { const fw = c.world.forts && fortRoute(c.world.forts, h.x, h.z, x, z); if (fw) { x = fw.x; z = fw.z; L = Math.hypot(x - h.x, z - h.z); } }
      let dx = x - h.x, dz = z - h.z;
      const n = Math.hypot(dx, dz) || 1; dx /= n; dz /= n;
      if (on("heal") && hpF > 0.75) for (const p of d.pickups) {
        if (!HEAL_KINDS.has(p.kind)) continue;
        const px = p.x - h.x, pz = p.z - h.z, pd = Math.hypot(px, pz);
        if (pd > 4.5 || px * dx + pz * dz <= 0 || Math.hypot(p.x - x, p.z - z) < 1) continue;
        const side = px * dz - pz * dx >= 0 ? -1 : 1, k = 1.2 * (1 - pd / 4.5);   // lệch sang phía không có thuốc
        const qx = dx + dz * side * k, qz = dz - dx * side * k, m = Math.hypot(qx, qz) || 1;
        dx = qx / m; dz = qz / m;
      }
      // gỡ kẹt: 3 s không nhích được 1,5 m khi đang muốn đi xa
      if (now - stuck.t > 3) {
        if (L > 3 && Math.hypot(h.x - stuck.x, h.z - stuck.z) < 1.5 && free) { unstickT = now + 1.2; unstickSide = -unstickSide; dbg.unstick++; }
        stuck = { x: h.x, z: h.z, t: now };
      }
      if (now < unstickT) { const sx = -dz * unstickSide, sz = dx * unstickSide; dx = dx * 0.3 + sx; dz = dz * 0.3 + sz; }
      if (L < 0.8) { inp.setStick(0, 0); return; }
      stick(dx, dz, 1);
      if (on("roll") && roll && L > 6 && free && h.dodgeCd <= 0 && now >= unstickT) P.dodge = true;
    }
  };
}

function faces(u, t, halfArc) {
  let da = Math.atan2(t.x - u.x, t.z - u.z) - u.yaw;
  while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
  return Math.abs(da) <= halfArc;
}
// Phá Trận sẵn sàng (H35). Tướng có ô 1 khác (H31 Hịch Tướng Sĩ — đứng đọc 3 s) không dùng các nhánh lao Phá Trận của bot.
function skillReady(h) { if (h.def && h.def.skills?.sk1 !== "phaTran") return false; return h.phaTran.left > 0 || h.phaTran.cd <= 0; }

// B20: vật o tới được bằng chân từ chỗ tướng đứng — cùng boong (hoặc cùng dưới đất / bùn), hoặc có đường qua cửa (ván bắc, ván
// xích, ván dốc, cầu bến; naval._firstDoor). Nhớ theo boong trong khung.
function reachFn(nav, h) {
  const hd = h.deck || null, memo = new Map();
  return (o) => {
    const od = o.deck || null;
    if (od === hd) return true;
    let r = memo.get(od);
    if (r === undefined) { r = !!nav._firstDoor(hd, od); memo.set(od, r); }
    return r;
  };
}

// Tên của địch sẽ trúng tướng trong 0,3 s tới (giả sử tướng đứng yên): thời gian + vận tốc tên. Luật trúng như
// crowd.updateArrows: cách ngang < 0,9 m, lệch cao < 1,3 m so với ngực, và tên phải trúng được tướng (heroMult > 0: nhắm
// tướng hoặc tên lạc — đợt 9; tên nhắm người khác ở xa bay qua người tướng không trúng nên không né).
function arrowThreat(crowd, h, react, notice) {
  let best = null;
  for (const r of crowd.arrows) {
    if (r.side !== "dich" || r.t < react || !(r.heroMult > 0)) continue;
    let x = r.x, y = r.y, z = r.z, vy = r.vy, t = r.t;
    for (let k = 1; k <= 18; k++) {
      const dt = 1 / 60; t += dt; x += r.vx * dt; z += r.vz * dt; y += vy * dt; vy -= 9.8 * dt;
      if (t > r.T) break;
      if (Math.hypot(h.x - x, h.z - z) < 0.9 && Math.abs(y - (h.y + 1.1)) < 1.3) { if ((!best || k / 60 < best.t) && notice(r, 1)) best = { t: k / 60, vx: r.vx, vz: r.vz }; break; }
    }
  }
  return best;
}

// Mệnh Lệnh: sự kiện đang chạy cần lệnh ở mặt trận của nó (quân ta hạ một lính của toán mỗi 2,5 s khi mặt trận có
// lệnh); Gọi tiếp viện ở P2; rảnh thì Tiến công cho mặt trận đang đứng (khi không có sự kiện sắp tới cần giữ lệnh).
function pickOrder(c, reinfUsed) {
  const d = c.director, sim = c.sim, cd = sim.cooldowns, E = d.events || {};
  for (const [ev, fr] of [["counterA1", "A"], ["surrounded", "B"]]) {
    if (E[ev]?.state !== "run" || sim.fronts[fr].order) continue;
    if (cd.tiencong <= 0) return { front: fr, id: "tiencong" };
    if (cd.giuvung <= 0) return { front: fr, id: "giuvung" };
  }
  if (d.phase >= 1 && sim.reinf.charges > 0 && cd.tiepvien <= 0 && reinfUsed < 2) {
    // mặt trận yếu hơn (tỉ lệ quân còn lại) nhận tiếp viện; lần đầu cho A (cánh chính)
    const r = (f) => Object.values(sim.fronts[f].q.ta).reduce((a, b) => a + b, 0) / sim.fronts[f].q0.ta;
    return { front: reinfUsed === 0 ? "A" : (r("A") <= r("B") ? "A" : "B"), id: "tiepvien" };
  }
  const pending = ["counterA1", "surrounded"].some((k) => E[k] && (E[k].state === "wait" || E[k].state === "run"));
  const hf = sim.heroFront;
  if (hf && !pending && !sim.fronts[hf].order && cd.tiencong <= 0) return { front: hf, id: "tiencong" };
  return null;
}

// Mục tiêu theo pha: P1 A1 → P2 A2 → P3 cổng bắc → P4 Toa Đô. Việc phụ như người chơi thường làm (đợt 9):
//   - P2–P3, Kế Sách "Cờ áo Tống" Khả dụng (chỉ lần thử đầu): dọn toán giữ bờ theo thứ tự thuyền gặp (tây → đông) để thuyền
//     cập bến; bấm G khi Sẵn sàng là việc của bot (opts.kesach).
//   - P2, B2 "rẻ": mô phỏng đã bào G của B2 xuống ≤ 30% G gốc và tướng còn ≥ 60% máu → sang chiếm B2 (đi rồi thì đi hẳn)
//     (nhiệm vụ phụ, +6 +4 Hào Khí gốc). Tắt: window.__objectiveOff.ks = true / .b2 = true.
const OBJ_OFF = window.__objectiveOff = { ks: false, b2: false };
const B2_TRIP = new WeakMap();     // director → đã quyết sang B2 (trạng thái của bot, không ghi lên director của trận)
window.__objective = (c) => {
  if (c.battle?.id === "B20") return window.__objectiveB20(c);   // B20: mục tiêu theo pha riêng (dưới)
  if (c.battle?.id === "B16" || c.battle?.id === "B17") return c.battle.debug.objective(c);  // B16, B17: mục tiêu của director (battles/b16.js, b17.js debug.objective)
  const d = c.director, w = c.world.bases, sim = c.sim, h = c.hero;
  if (d.phase === 0) return w.A1;
  if (d.phase === 1 || d.phase === 2) {
    const ks = d.keSach.get("coAoTong");
    if (!OBJ_OFF.ks && ks && ks.state === "khadung" && ks.attempts <= 1 && d.keSach.boats.some((b) => !b.dead && !b.landed)) {
      // toán giữ bờ theo thứ tự thuyền gặp: neo tây nhất trước, cùng neo thì người gần tướng nhất
      let best = null, bk = Infinity;
      const consider = (o, ax) => { const k = ax * 1000 + Math.hypot(o.x - h.x, o.z - h.z); if (k < bk) { bk = k; best = o; } };
      for (const a of c.crowd.agents) if (a.src === "coAoTong" && c.crowd.hittable(a)) consider(a, a.anchor.x);
      for (const u of c.units) if (u.ksGroup !== undefined && u.alive && !u.dead) consider(u, u.home.x);
      if (best) return { x: best.x, z: best.z, ks: true, ref: best };
    }
    const B2 = sim.bases.B2;
    if (B2.owner !== "dich") B2_TRIP.delete(d);
    else if (!OBJ_OFF.b2 && (B2_TRIP.get(d) || (d.phase === 1 && B2.G <= 0.3 * B2.G0 && h.hp >= 0.6 * h.maxHp))) { B2_TRIP.set(d, true); return w.B2; }
  }
  if (d.phase === 1) return w.A2;
  if (d.phase === 2) return { x: w.A3.x - 2.5, z: w.A3.z, gate: true };
  return d.boss && d.boss.alive ? d.boss : { x: 528, z: -40 };
};

// ---- B20 Bạch Đằng: mục tiêu theo pha cho bot ---------------------------------------------------------------------------------------
// Trả { x, z, why, clear (m: dọn địch tới được trong tầm), hold (giữ X: lên boong), ferry (id nơi đến cho director.ferryTo), urgent (gọi
// đò cả khi đang bị áp sát), boss (đơn vị lớn phải đánh), order ({ wing, id } Mệnh Lệnh cho cánh thủy quân), kesach (bấm G), tpc (được
// kích Tổng Phản Công) }. Việc theo pha (đợt 20):
//   P1  chưa ra lệnh: bấm Lệnh Kế Sách (= Ra khiêu chiến); sau đó đoàn thuyền tự lái — bot ở trên thuyền chỉ huy, đánh lính tiên phong áp mạn.
//   P2–P4  cảnh tua: đứng chờ.
//   P5  thuyền chỉ huy Phàn Tiếp: có đường đi bộ (bùn, ván dốc, ván xích) thì đi, không thì đò; đánh Phàn Tiếp tới Vỡ Thế → Đòn Quyết.
//   P6  kỳ hạm: đò / đi bộ lên boong dưới, Tổng Phản Công khi đã lên kỳ hạm; Ô Mã Nhi lui lên lầu thì dọn toán giữ cầu thang, vòng
//       qua cột buồm chính lên lầu, đánh tới Sinh lực khóa 10% → Vỡ Thế → Đòn Quyết "Bắt sống".
const B20_MEM = new WeakMap();      // director → trí nhớ của bot (gỡ kẹt…)
const B20_OPS = { clear: 28 };
window.__objectiveB20 = (c) => {
  const d = c.director, h = c.hero, st = c.sim, nav = c.naval, crowd = c.crowd;
  let M = B20_MEM.get(d); if (!M) B20_MEM.set(d, (M = {}));
  const dist = (o) => Math.hypot(o.x - h.x, o.z - h.z);
  const on = (b) => !!b && !!h.deck && h.deck === b.deck;
  const alive = (u) => !!u && u.alive && !u.dead && !u.captured && u.dead !== true;
  const reach = reachFn(nav, h);
  const foesOn = (...D) => { let n = 0; for (const a of crowd.agents) if (a.side === "dich" && crowd.hittable(a) && a.deck && D.includes(a.deck)) n++; return n; };
  const it = nav.interactables(h)[0];
  let near = 0; for (const a of crowd.agents) if (a.side === "dich" && crowd.hittable(a) && reach(a) && dist(a) < 8) near++;
  // Tổng Phản Công: pha 6 khi đã tới kỳ hạm / gần Ô Mã Nhi; trước đó khi đang giáp chiến đông (Hào Khí đầy thì cứ dùng, pha 6 kịch bản
  // đặt lại 100)
  const x20 = d.bosses?.X20, fs = d.ships?.FS;
  const tpc = d.phase === 5 ? on(fs) || (x20 && reach(x20) && dist(x20) < 12) : near >= 4 || Object.values(d.bosses || {}).some((u) => alive(u) && reach(u) && dist(u) < 12);
  const base = { x: h.x, z: h.z, clear: B20_OPS.clear, hold: false, tpc };
  const R = (o) => ({ ...base, ...o });

  if (d.phase === 0) {
    if (!st.nghi.launched) return R({ kesach: true, why: "P1: ra khiêu chiến" });
    // lính tiên phong áp mạn thuyền của tướng: đánh trên thuyền mình
    for (const v of d.vg) {
      if (v.state !== "grappled" || !v.target) continue;
      const pl = v.link?.plank;
      if (foesOn(v.target.deck, v.boat.deck, ...(pl ? [pl] : []))) return R({ x: v.target.x, z: v.target.z, why: "P1: đánh lính tiên phong" });
    }
    return R({ why: "P1: giữ thuyền" });
  }
  if (d.phase <= 3) return R({ why: "P" + (d.phase + 1) + ": cảnh tua, chờ" });

  // P5 Phàn Tiếp, P6 Ô Mã Nhi
  const u = d.phase === 4 ? d.bosses?.X24 : x20, b = d.phase === 4 ? d.ships?.PT : fs;
  if (!b) return R({ why: "P" + (d.phase + 1) + ": chờ" });
  // gỡ kẹt: 10 s đứng một chỗ (rảnh tay, chưa lên thuyền đích) dù có đường đi bộ (thân thuyền khác chắn, cửa lạ) → gọi đò tới thuyền đích
  if (!M.st || Math.hypot(h.x - M.st.x, h.z - M.st.z) > 1.5 || h.state !== "free" || M.st.ph !== d.phase) M.st = { x: h.x, z: h.z, t: d.time, ph: d.phase };
  if (d.time - M.st.t > 10 && h.deck !== b.deck) { M.forceFerry = d.time + 15; M.st.t = d.time; }
  const way = !(M.forceFerry > d.time) && (h.deck === b.deck || !!nav._firstDoor(h.deck || null, b.deck));
  if (!way) return R({ ferry: b.id, urgent: true, why: "P" + (d.phase + 1) + ": đò tới " + b.id });
  // sát mạn thuyền đích dưới bùn (thân thuyền chắn đường tới ván dốc bên kia): giữ X 1 s lên boong
  if (it && it.kind === "board" && it.deck === b.deck) return R({ x: b.x, z: b.z, hold: true, why: "P" + (d.phase + 1) + ": lên boong " + b.id });
  if (!alive(u)) return R({ x: b.x, z: b.z, why: "P" + (d.phase + 1) + ": chờ" });
  const D = b.deck;
  if (d.phase === 5 && d.x20 && d.x20.st !== "deck" && h.deck === D) {
    // Ô Mã Nhi đã lui lên lầu chỉ huy, tướng còn ở boong dưới: hạ toán giữ cầu thang, rồi tới chân thang (vòng qua cột buồm chính
    // ở tim thuyền), lên thẳng lầu
    const g = d.stairGuard, gl = g && (alive(g.officer) || g.agents.some((a) => crowd.hittable(a)));
    const towerY = D.toWorld(0, -10.8, {}).y;
    if (h.y < towerY - 1) {
      if (gl && d.x20.st === "wait" && near) return R({ x: h.x, z: h.z, clear: 14, why: "P6: toán giữ cầu thang" });
      // Cầu thang (boats.js HULLS.flagship): mặt dốc |x| ≤ 1,1, z 2,0 (chân, cao bằng boong dưới) → −6,05 (lầu); chỉ vào được từ chân
      // (hai bên là bậc cao hơn một bước). Cột buồm chính ở tim thuyền z 4,5. Đứng cạnh thang: ra khỏi hông thang về phía mũi (z 2,8),
      // rồi vào chân thang ở giữa (0; 2,4), thẳng hàng rồi mới lên; sau cột buồm thì vòng qua mạn cột.
      const L = D.toLocal(h.x, h.z, {}), ax = Math.abs(L.x), sg = L.x < 0 ? -1 : 1;
      let wx, wz, step;
      if (ax <= 0.6 && L.z < 3.3) { wx = 0; wz = -10.5; step = "lên thang"; }                 // thẳng hàng ở chân / trên thang
      else if (L.z > 4.0 && ax < 1.2) { wx = sg * 1.9; wz = 4.5; step = "vòng cột buồm"; }       // sau cột buồm chính
      else if (L.z < 2.4 && ax > 0.6) { wx = sg * 1.7; wz = 3.0; step = "ra hông thang"; }       // cạnh thang (bậc chắn)
      else { wx = 0; wz = 2.4; step = "vào chân thang"; }
      const Wp = D.toWorld(wx, wz, {}), ex = Wp.x - h.x, ez = Wp.z - h.z, n0 = Math.hypot(ex, ez);
      // điểm quá gần (< 1,5 m) thì kéo dài theo hướng đi — bot đứng yên khi cách mục tiêu dưới 1,2 m
      const k = n0 > 1e-3 && n0 < 1.5 ? 1.5 / n0 : 1;
      return R({ x: h.x + ex * k, z: h.z + ez * k, clear: gl ? 6 : 3, why: "P6: lên lầu chỉ huy (" + step + ")" });
    }
    if (u.script) return R({ x: u.x, z: u.z, clear: 8, why: "P6: chờ Ô Mã Nhi trên lầu" });
  }
  if (reach(u) && !u.script) return R({ x: u.x, z: u.z, boss: u, why: "P" + (d.phase + 1) + ": đánh " + u.name });
  const w = nav.route(h, u, u.x, u.z);
  if (!w) return R({ x: u.x, z: u.z, why: "P" + (d.phase + 1) + ": tới " + u.name });
  const dx = w.x - h.x, dz = w.z - h.z, L = Math.hypot(dx, dz) || 1;
  return R({ x: w.x + dx / L * 2.5, z: w.z + dz / L * 2.5, clear: 10, why: "P" + (d.phase + 1) + ": đường tới " + u.name });
};

window.__state = () => {
  const c = window.__hk, d = c.director, s = c.sim;
  if (c.battle?.debug?.state) return c.battle.debug.state(c);   // B20: ảnh chụp gọn riêng (battles/b20.js)
  const q = (f, side) => Math.round(Object.values(s.fronts[f].q[side]).reduce((a, b) => a + b, 0));
  const B = (id) => ({ o: s.bases[id].owner, G: +s.bases[id].G.toFixed(1), k: s.bases[id].keeperAlive, cap: +(d.capT[id] || 0).toFixed(1), gate: s.bases[id].gate });
  return {
    t: Math.round(d.time), phase: d.phase, ko: d.ko, hp: Math.round(c.hero.hp), ki: Math.round(c.hero.ki), rev: c.hero.revives,
    hk: +c.hk.value.toFixed(1), tpc: c.hk.tpc, pos: [Math.round(c.hero.x), Math.round(c.hero.z)], st: c.hero.state,
    A1: B("A1"), A2: B("A2"), B1: B("B1"), B2: B("B2"), A3: B("A3"), B3: B("B3"),
    lines: [+s.fronts.A.x.toFixed(3), +s.fronts.B.x.toFixed(3)], qA: [q("A", "ta"), q("A", "dich")], qB: [q("B", "ta"), q("B", "dich")],
    sk: [Math.round(s.fronts.A.sk.ta), Math.round(s.fronts.A.sk.dich), Math.round(s.fronts.B.sk.ta), Math.round(s.fronts.B.sk.dich)],
    roles: c.crowd.agents.reduce((m, a) => ((m[a.role + ":" + a.side] = (m[a.role + ":" + a.side] || 0) + 1), m), {}),
    units: c.units.map((u) => `${u.name}:${Math.round(u.hp)}${u.broken > 0 ? "(vỡ)" : ""}`),
    events: Object.fromEntries(Object.entries(d.events).map(([k, v]) => [k, v.state + (v.left ? ":" + Math.round(v.left) : "")])),
    msgs: d.msgs.map((m) => m.text).slice(-3), over: d.over, res: d.result && d.result.why,
    ks: d.keSach.hud().map((k) => `${k.name}:${k.state}:${k.got}${k.detail ? " (" + k.detail + ")" : ""}`),
    bot: window.__botDbg ? window.__botDbg.mode : null,
  };
};
