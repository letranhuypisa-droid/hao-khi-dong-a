// sim/front.js — mô phỏng mặt trận 1 Hz (GDD mục 4.2, 4.4, 4.7; Đặc tả prototype 21.6).
//
// Luật cứng: không đọc cài đặt đồ họa, không dùng Math.random, không dùng hàm Math siêu việt.
// Cùng seed + cùng chuỗi input (theo tick) → cùng kết quả ở mọi mức số lính (Trụ cột 3).
//
//   F_A[i]    = Q_A[i] * c[i] * khac(i,B) * m_SK * m_KS * m_lenh * m_TPC * (1 + min(0.3, 0.1 * soTuongAI_A))
//   tonThat_A = SIM_LOSS_K * F_B * diaHinh_A * mThu_A
//   diaHinh_A = công sự Hàm Tử quan × công sự làn đánh (sim/terrain-rules.js earthworkLossMult, khi st.earthworks)
//   Q_A[i]   -= tonThat_A * Q_A[i] / Q_A * (bị khắc ? 1.25 : 1)
//   hoiQuan_A = SIM_REGEN * Q0_A * min(2, soDoanhTrai_A) * m_luong_A   (địch: 0 khi cửa ngõ của cánh về tay ta — supplyOpen, đợt 12c)
//   x        += SIM_LINE_V * (F_ta - F_dich) / (F_ta + F_dich) * (TPC ? 3 : 1)
//   mỗi 10 tick: SK_A += 5 * (F_A - F_B) / (F_A + F_B)
//   Cứ Điểm tại tuyến: G -= 0.5 * SIM_LOSS_K * F_tấn_công mỗi tick
//   Sụp đổ cánh: Q < 15% Q0 hoặc SK < 10 trong 15 s → mất Cứ Điểm gần nhất, tuyến lùi 0.1

import { SIM, UNITS, khac, ORDERS, HAO_KHI, S, HERO } from "../data/tuning.js";
import { earthworkLossMult } from "./terrain-rules.js";
import { laneFeaturesOn } from "../battle/ground.js";

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const sum = (o) => { let s = 0; for (const k in o) s += o[k]; return s; };

// earthworks: lũy, ụ đất trên làn đánh có tác dụng trong mô phỏng (mặc định theo công trình làn đánh đã bật khi
// dựng trận — buildWorld chạy trước createSim; kiểm thử truyền thẳng true/false). Giữ trong st nên checkpoint
// mang theo.
export function createSim({ fronts, bases, enemyMix, R = 1, mods = {}, earthworks = laneFeaturesOn() }) {
  const st = {
    t: 0, R, earthworks: !!earthworks,
    mods: {                           // từ cây kỹ năng, quân đoàn, trang bị (meta/progress.js)
      unitSimC: 0, reinfAmt: 0, reinfCharges: 0, holdThu: 0, skPer5: 0, cmdCdMult: 1,
      cmdCd: HERO.cmdCd, allyHpPct: 0, heroSkMult: HERO.skMult, ...mods,
    },
    hk: { m25: 0, m50: false, m75: false },   // mốc Hào Khí đang có (battle.js đặt)
    tpc: { active: false, left: 0, afterLeft: 0 },
    fronts: {}, bases: {},
    reinf: { charges: SIM.allyReinf.charges + (mods.reinfCharges || 0), pending: [] },
    cooldowns: { tiencong: 0, giuvung: 0, theota: 0, tiepvien: 0 },
    heroFront: null,
  };
  for (const id in fronts) {
    const f = fronts[id];
    const dich = {};
    for (const u in enemyMix) dich[u] = Math.round(f.qDich * enemyMix[u]);
    st.fronts[id] = {
      id, x: f.line0,
      q: { ta: { GIAO_DV: f.qTa }, dich },
      q0: { ta: f.qTa, dich: f.qDich },
      sk: { ta: 50, dich: 50 },
      order: null,                     // { id, left }
      general: { id: f.allyGeneral, alive: true, hp: 1, down: 0 },   // hp là tỉ lệ 0..1
      door: f.door ?? null,                // cửa ngõ của cánh (id Cứ Điểm, FRONTS[id].door): xem supplyOpen
      collapse: { ta: 0, dich: 0 },
      hqHold: 0, waves: 0,
      pendingKills: { ta: 0, dich: 0 },  // Q phải trừ từ vùng chiến đấu (KO thật)
      lastF: { ta: 0, dich: 0 },
      skBoost: 0,                         // Sĩ Khí +10 sau TPC rải trong 30 s
      panic: 0, panicRate: 0,             // "Hoang mang" (Kế Sách Cờ áo Tống): Sĩ Khí địch −rate mỗi tick
    };
  }
  for (const b of bases) {
    st.bases[b.id] = {
      id: b.id, type: b.type, owner: b.owner, front: b.front, lineX: b.lineX ?? 0,
      G: b.G ?? 0, G0: b.G ?? 0,
      gate: b.gate ? Math.round(b.gate * S(R)) : 0, gate0: b.gate ? Math.round(b.gate * S(R)) : 0,
      keeperAlive: !!b.keeper, open: false,
    };
  }
  return st;
}

// Cửa ngõ của cánh (đợt 12c): Cứ Điểm nguồn viện binh — FRONTS[id].door, doanh trại của chính cánh đó. Còn của địch thì cánh địch còn viện binh: hồi quân,
// đợt tiếp viện +100 mỗi 120 s, và lính ở tuyến được bổ sung (director.js fillActors). Về tay ta — tướng chiếm, hoặc cánh địch vỡ trận (tick dưới) — thì hết cả ba.
// Không khai cửa ngõ (hoặc id lạ) thì coi như mở: trận khác và các bài thử cũ chạy như trước.
export function supplyOpen(st, frontId) {
  const f = st.fronts[frontId], b = f && f.door ? st.bases[f.door] : null;
  return !b || b.owner === "dich";
}

export function mSK(sk) {
  for (const [min, m] of SIM.skBands) if (sk >= min) return m;
  return SIM.skBands[SIM.skBands.length - 1][1];
}

// Trung bình khắc chế của loại i trước thành phần quân đối phương.
function khacMix(unit, oppQ) {
  const tot = sum(oppQ); if (tot <= 0) return 1;
  let k = 0; for (const j in oppQ) k += (oppQ[j] / tot) * khac(unit, j);
  return k;
}
function weakMix(unit, oppQ) {
  const tot = sum(oppQ); if (tot <= 0) return 1;
  let w = 0; for (const j in oppQ) w += (oppQ[j] / tot) * (UNITS[j].counters.includes(UNITS[unit].branch) ? 1.25 : 1);
  return w;
}

function force(st, f, side) {
  const own = f.q[side], opp = f.q[side === "ta" ? "dich" : "ta"];
  let F = 0;
  for (const u in own) {
    const c = UNITS[u].simC * (side === "ta" ? 1 + st.mods.unitSimC : 1);
    F += own[u] * c * khacMix(u, opp);
  }
  F *= mSK(f.sk[side]);
  if (side === "ta") {
    const o = f.order && ORDERS[f.order.id];
    F *= o?.mLenh ?? 1;
    F *= 1 + st.hk.m25;                               // mốc 25: Công quân ta +5% (+7% với Dấy Khí)
    if (st.tpc.active) F *= HAO_KHI.tpc.mTPC;
    if (f.general.alive) F *= 1.1;                    // 1 + min(0.3, 0.1 × soTuongAI)
  }
  return F;
}

// Cứ Điểm (không phải cổng, không phải bản doanh) của `owner` gần tuyến nhất.
function nearestBase(st, frontId, owner, x) {
  let best = null;
  for (const id in st.bases) {
    const b = st.bases[id];
    if (b.front !== frontId || b.owner !== owner || b.type === "ban_doanh" || b.type === "cong") continue;
    if (!best || Math.abs(b.lineX - x) < Math.abs(best.lineX - x)) best = b;
  }
  return best;
}

// Giới hạn tuyến: quân ta không vượt Cứ Điểm địch còn đứng trước mặt (cổng đóng cũng chặn),
// quân địch không đẩy qua Cứ Điểm ta còn đứng sau lưng. Cứ Điểm đã bị vượt (do Tổng Phản
// Công đẩy tuyến) thì không chặn nữa.
function lineBounds(st, f) {
  let hi = 0.95, lo = 0;
  for (const id in st.bases) {
    const b = st.bases[id];
    if (b.front !== f.id || b.type === "ban_doanh") continue;
    if (b.owner === "dich" && !b.open && b.lineX >= f.x - 0.03) hi = Math.min(hi, b.lineX - 0.03);
    if (b.owner === "ta" && b.lineX <= f.x + 0.03) lo = Math.max(lo, b.lineX + 0.03);
  }
  return [lo, hi];
}

// Đếm doanh trại (bản doanh ta tính 1, Hàm Tử quan tính 1 cho địch).
function barracks(st, frontId, side) {
  let n = side === "ta" ? 1 : 1;
  for (const id in st.bases) {
    const b = st.bases[id];
    if (b.front === frontId && b.type === "doanh_trai" && b.owner === side) n++;
  }
  return Math.min(2, n);
}

function addQ(side, f, amount, mix) {
  const q = f.q[side];
  if (!mix) { const tot = sum(q) || 1; mix = {}; for (const u in q) mix[u] = q[u] / tot; }
  for (const u in mix) q[u] = (q[u] || 0) + amount * mix[u];
}
function removeQ(f, side, amount) {
  const q = f.q[side], tot = sum(q);
  if (tot <= 0) return;
  const k = Math.min(1, amount / tot);
  for (const u in q) q[u] = Math.max(0, q[u] - q[u] * k);
}

export function issueOrder(st, frontId, id) {
  const o = ORDERS[id];
  if (!o || st.cooldowns[id] > 0) return { ok: false, why: "cd" };
  const cdMult = st.mods.cmdCd * st.mods.cmdCdMult * (st.hk.m75 ? 0.75 : 1);
  const cd = Math.max(o.cd * 0.5, o.cd * cdMult);
  const f = st.fronts[frontId];
  if (id === "tiepvien") {
    if (st.reinf.charges <= 0) return { ok: false, why: "charges" };
    st.reinf.charges--;
    st.reinf.pending.push({ front: frontId, at: st.t + SIM.allyReinf.delay,
      amount: SIM.allyReinf.amount + st.mods.reinfAmt });
  } else if (id === "theota") {
    // battle.js tách 30 Q khỏi mặt trận gần nhất cho đội theo tướng
  } else {
    f.order = { id, left: o.dur };
  }
  st.cooldowns[id] = cd;
  return { ok: true, cd };
}

export function triggerTPC(st, heroFront, durSec) {
  const T = HAO_KHI.tpc;
  st.tpc.active = true; st.tpc.left = durSec;
  const flipped = [], x0 = {};
  for (const id in st.fronts) {
    const f = st.fronts[id];
    x0[id] = f.x;
    f.x = clamp(f.x + T.lineAll + (id === heroFront ? T.lineHere : 0), 0, 0.95);
    f.sk.dich = clamp(f.sk.dich + T.enemySK, 0, 100);
    f.sk.ta = Math.max(f.sk.ta, T.skFloor);
  }
  // Cứ Điểm địch tại tuyến có G < 50% đổi chủ. "Tại tuyến" = trong đoạn tuyến quét qua khi bị đẩy (±0,08 hai đầu).
  // Trước đây chỉ xét tuyến SAU khi đẩy: tuyến đang áp sát Cứ Điểm (A2 0,55: tuyến bị chặn ở ≤ 0,52) bị đẩy vọt tới
  // 0,70 nên Cứ Điểm không lật, tuyến lại vượt qua nó; chỉ tuyến còn cách 0,12–0,28 mới lật được.
  for (const id in st.bases) {
    const b = st.bases[id], f = st.fronts[b.front];
    if (!f || b.owner !== "dich" || b.type === "cong") continue;
    const lo = Math.min(x0[b.front], f.x) - 0.08, hi = Math.max(x0[b.front], f.x) + 0.08;
    if (b.lineX > lo && b.lineX < hi && b.G < b.G0 * T.flipBaseG) {
      b.owner = "ta"; b.G = Math.round(b.G0 * 0.5); b.keeperAlive = false;
      flipped.push(b.id);
    }
  }
  return flipped;
}

// Một tick 1 s. Trả về danh sách sự kiện cho tầng trận.
export function simTick(st) {
  const ev = [];
  st.t++;
  for (const k in st.cooldowns) st.cooldowns[k] = Math.max(0, st.cooldowns[k] - 1);

  if (st.tpc.active) {
    st.tpc.left--;
    if (st.tpc.left <= 0) {
      st.tpc.active = false; st.tpc.afterLeft = HAO_KHI.tpc.after.skDur;
      ev.push({ type: "tpcEnd" });
    }
  } else if (st.tpc.afterLeft > 0) st.tpc.afterLeft--;

  // tiếp viện ta tới nơi
  st.reinf.pending = st.reinf.pending.filter((p) => {
    if (st.t < p.at) return true;
    addQ("ta", st.fronts[p.front], p.amount);
    st.fronts[p.front].sk.ta = clamp(st.fronts[p.front].sk.ta + 5, 0, 100);
    ev.push({ type: "reinfArrived", front: p.front, amount: p.amount });
    return false;
  });

  for (const id in st.fronts) {
    const f = st.fronts[id];

    // KO thật từ vùng chiến đấu
    if (f.pendingKills.dich > 0) { removeQ(f, "dich", f.pendingKills.dich); f.pendingKills.dich = 0; }
    if (f.pendingKills.ta > 0) { removeQ(f, "ta", f.pendingKills.ta); f.pendingKills.ta = 0; }

    const Fta = force(st, f, "ta"), Fd = force(st, f, "dich");
    f.lastF.ta = Fta; f.lastF.dich = Fd;
    const tot = Fta + Fd || 1;

    // tổn thất
    const o = f.order && ORDERS[f.order.id];
    let mThuTa = o?.mThu ?? 1;
    if (f.order?.id === "giuvung") mThuTa -= st.mods.holdThu;
    const gatesClosed = Object.values(st.bases).some((b) => b.front === id && b.type === "cong" && b.owner === "dich" && !b.open);
    let diaHinhDich = gatesClosed && f.x > 0.72 ? 0.6 : 1;       // công sự Hàm Tử quan
    let diaHinhTa = 1;
    // công sự làn đánh (terrain-rules.js): quân ta đánh vào dải trước lũy Nguyên còn người giữ (doanh trại cánh
    // này còn của địch) thì Nguyên mất ít quân; tuyến bị dồn về ụ đất quân ta thì quân ta mất ít quân
    if (st.earthworks) {
      let luyStands = false;
      for (const bid in st.bases) { const b = st.bases[bid]; if (b.front === id && b.type === "doanh_trai" && b.owner === "dich") luyStands = true; }
      diaHinhDich *= earthworkLossMult("dich", id, f.x, luyStands);
      diaHinhTa = earthworkLossMult("ta", id, f.x, true);
    }
    const lossTa = SIM.LOSS_K * Fd * mThuTa * diaHinhTa;
    const lossD = SIM.LOSS_K * Fta * diaHinhDich;
    for (const [side, loss, opp] of [["ta", lossTa, "dich"], ["dich", lossD, "ta"]]) {
      const q = f.q[side], Q = sum(q);
      if (Q <= 0) continue;
      for (const u in q) q[u] = Math.max(0, q[u] - loss * (q[u] / Q) * weakMix(u, f.q[opp]));
    }

    // hồi quân
    for (const side of ["ta", "dich"]) {
      const regen = side === "dich" && !supplyOpen(st, id) ? 0 : SIM.REGEN * f.q0[side] * barracks(st, id, side);
      const q = f.q[side], Q = sum(q);
      if (Q < f.q0[side]) addQ(side, f, Math.min(regen, f.q0[side] - Q));
    }

    // tuyến
    let dx = SIM.LINE_V * (Fta - Fd) / tot * (st.tpc.active ? HAO_KHI.tpc.lineSpeed : 1);
    if (dx > 0 && f.order?.id === "giuvung") dx = 0;          // Giữ vững: tuyến phe đó không tiến
    const [lo, hi] = lineBounds(st, f);
    let nx = f.x + dx;
    if (dx > 0) nx = Math.min(nx, Math.max(hi, f.x));
    else nx = Math.max(nx, Math.min(lo, f.x));
    f.x = clamp(nx, 0, 0.95);

    // Sĩ Khí
    if (st.t % 10 === 0) {
      f.sk.ta += 5 * (Fta - Fd) / tot;
      f.sk.dich += 5 * (Fd - Fta) / tot;
      const drift = st.hk.m50 ? 60 : SIM.skDrift;
      f.sk.ta += Math.sign(drift - f.sk.ta) * Math.min(SIM.skDriftPer10, Math.abs(drift - f.sk.ta));
      f.sk.dich += Math.sign(SIM.skDrift - f.sk.dich) * Math.min(SIM.skDriftPer10, Math.abs(SIM.skDrift - f.sk.dich));
    }
    if (st.heroFront === id && st.t % 5 === 0) f.sk.ta += st.mods.skPer5;
    if (f.skBoost > 0) { const d = Math.min(f.skBoost, HAO_KHI.tpc.after.skBonus / HAO_KHI.tpc.after.skDur); f.sk.ta += d; f.skBoost -= d; }
    if (st.tpc.active) f.sk.ta = Math.max(f.sk.ta, HAO_KHI.tpc.skLock);
    if (f.panic > 0) { f.sk.dich -= f.panicRate; f.panic--; }
    f.sk.ta = clamp(f.sk.ta, 0, 100); f.sk.dich = clamp(f.sk.dich, 0, 100);

    // Cứ Điểm tại tuyến bị bào mòn
    for (const bid in st.bases) {
      const b = st.bases[bid];
      if (b.front !== id || b.type === "cong") continue;
      if (Math.abs(f.x - b.lineX) > 0.05) continue;
      const atk = b.owner === "ta" ? Fd : Fta;
      b.G = Math.max(0, b.G - 0.5 * SIM.LOSS_K * atk);
      // Chỉ Cứ Điểm của ta bị mô phỏng lật. Cứ Điểm địch đổi chủ khi tướng người chơi chiếm
      // (luật chiếm chung 4.4), khi Tổng Phản Công, hoặc khi cánh địch sụp đổ.
      if (b.G <= 0 && b.owner === "ta") {
        b.owner = "dich"; b.G = Math.round(b.G0 * 0.5); b.keeperAlive = false;
        ev.push({ type: "baseFlip", id: b.id, owner: b.owner, by: "sim" });
      }
    }

    // sụp đổ cánh
    for (const side of ["ta", "dich"]) {
      const bad = sum(f.q[side]) < SIM.collapseQ * f.q0[side] || f.sk[side] < SIM.collapseSK;
      f.collapse[side] = bad ? f.collapse[side] + 1 : 0;
      if (f.collapse[side] >= SIM.collapseHold) {
        f.collapse[side] = 0;
        // Cánh vỡ rồi tập hợp lại (ĐỀ XUẤT BẢN THỬ: Sĩ Khí về tối thiểu 25) — không thì một cánh
        // dưới ngưỡng sẽ sụp lặp lại mỗi 15 s và kéo tuyến xuyên cả bản đồ.
        f.sk[side] = Math.max(f.sk[side], 25);
        const lost = nearestBase(st, id, side, f.x);
        if (lost && Math.abs(lost.lineX - f.x) <= 0.15) {
          lost.owner = side === "ta" ? "dich" : "ta"; lost.G = Math.round(lost.G0 * 0.5); lost.keeperAlive = false;
          ev.push({ type: "baseFlip", id: lost.id, owner: lost.owner, by: "collapse" });
        }
        const [lo, hi] = lineBounds(st, f);      // cổng còn đóng vẫn chặn tuyến
        f.x = side === "ta" ? Math.max(Math.min(lo, f.x), f.x - SIM.collapseLine)
                            : Math.min(Math.max(hi, f.x), f.x + SIM.collapseLine);
        f.x = clamp(f.x, 0, 0.95);
        ev.push({ type: "collapse", front: id, side });
      }
    }

    // bản doanh
    f.hqHold = f.x <= 0.001 ? f.hqHold + 1 : 0;
    if (f.hqHold >= SIM.hqLoseHold) ev.push({ type: "hqLost", front: id });

    // lệnh hết hạn
    if (f.order) { f.order.left--; if (f.order.left <= 0) f.order = null; }

    // tướng AI: Sinh lực trừu tượng khi xa người chơi
    const g = f.general;
    if (g.alive && Fd > Fta && st.heroFront !== id) {
      g.hp -= 0.02 * (Fd - Fta) / tot / (1 + st.mods.allyHpPct);
      if (g.hp <= 0) { g.alive = false; g.down = 90; g.hp = 0; ev.push({ type: "generalDown", front: id, id: g.id }); }
    } else if (!g.alive) {
      g.down--; if (g.down <= 0) { g.alive = true; g.hp = 0.5; ev.push({ type: "generalBack", front: id, id: g.id }); }
    }

    // tiếp viện địch: 100 mỗi 120 s mỗi doanh trại còn giữ, tối đa 4 đợt
    if (st.t % SIM.enemyReinf.every === 0 && f.waves < SIM.enemyReinf.maxWaves) {
      let n = 0;
      for (const bid in st.bases) { const b = st.bases[bid]; if (b.front === id && b.type === "doanh_trai" && b.owner === "dich") n++; }
      if (n > 0 && supplyOpen(st, id)) { addQ("dich", f, SIM.enemyReinf.amount * n); f.waves++; ev.push({ type: "enemyReinf", front: id, amount: 100 * n }); }
    }
  }
  return ev;
}

export const totalQ = (f, side) => sum(f.q[side]);

// Ảnh chụp để checkpoint (JSON thuần, < 256 KB).
export const snapshot = (st) => JSON.parse(JSON.stringify(st));
