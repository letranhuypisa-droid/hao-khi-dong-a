// sim/haokhi.js — thanh Hào Khí và Tổng Phản Công (GDD mục 5, Đặc tả prototype 21.6).
//
// Luật:
//   - Khởi đầu 0 (+ nút đỉnh Mưu +15). Mốc 25 / 50 / 75 / 100; không tụt dưới mốc đã đạt.
//   - Không có nguồn tăng chủ động trong 45 s → −1 mỗi 5 s.
//   - Chạm 100: khoá ở 100, không suy giảm tới khi kích. Phần vượt thành Hào Khí dư, tối đa 30;
//     ôm quá 90 s thì ngừng tích.
//   - Trận nhanh: chỉ nhân nguồn TĂNG ×1,3.
//   - Tổng Phản Công 25 s; +1 s mỗi 3 điểm dư, kéo dài tổng ≤ +10 s (mọi nguồn).
//   - Kết thúc: Hào Khí về 25 rồi cộng phần kiếm trong lúc TPC; dư về 0.
//   - Tuyệt Kỹ không cộng Hào Khí (L6) — tầng trận không gọi gain() cho Tuyệt Kỹ.

import { HAO_KHI } from "../data/tuning.js";

export function createHaoKhi({ quick = true, start = 0, gainPct = 0, decayMult = 1, tpcExt = 0 } = {}) {
  return {
    value: Math.min(45, start), overflow: 0, floor: 0,
    quick, gainPct, decayMult, tpcExt,
    idle: 0, decayAcc: 0, atMaxFor: 0,
    tpc: false, tpcLeft: 0, tpcGained: 0, tpcCount: 0,
    log: {},            // tổng điểm GỐC theo nguồn (trước hệ số) — cho telemetry và Quân công
    optional: 0,        // điểm gốc từ nguồn tùy chọn (21.6)
    rawTotal: 0,
  };
}

export function milestone(hk) {
  let m = 0;
  for (const x of HAO_KHI.milestones) if (hk.value >= x) m = x;
  return m;
}

// amount là điểm gốc. Trả về điểm thực đã cộng.
export function gain(hk, amount, source, { optional = false } = {}) {
  if (!amount) return 0;
  hk.log[source] = (hk.log[source] || 0) + amount;
  if (amount > 0) { hk.rawTotal += amount; if (optional) hk.optional += amount; }
  let real = amount;
  if (amount > 0) {
    real = amount * (hk.quick ? HAO_KHI.quickMult : 1) * (1 + hk.gainPct);
    hk.idle = 0; hk.decayAcc = 0;
  }
  if (hk.tpc) { if (real > 0) hk.tpcGained += real; return real; }
  if (real > 0) {
    const room = 100 - hk.value;
    if (real <= room) hk.value += real;
    else {
      hk.value = 100;
      if (hk.atMaxFor <= HAO_KHI.overflowHold) hk.overflow = Math.min(HAO_KHI.overflowMax, hk.overflow + real - room);
    }
    hk.floor = Math.max(hk.floor, milestoneFloor(hk.value));
  } else {
    // Phạt (mất Cứ Điểm, sự kiện thất bại, Gượng dậy) được phép xuyên mốc; chỉ suy giảm mới bị chặn.
    hk.value = Math.max(0, hk.value + real);
    hk.floor = milestoneFloor(hk.value);
    if (hk.value < 100) hk.atMaxFor = 0;
  }
  return real;
}

function milestoneFloor(v) {
  let f = 0;
  for (const x of HAO_KHI.milestones) if (x < 100 && v >= x) f = x;
  return f;
}

// dt tính bằng giây. Trả về true khi vừa hết Tổng Phản Công.
export function tick(hk, dt) {
  if (hk.tpc) {
    hk.tpcLeft -= dt;
    if (hk.tpcLeft <= 0) {
      hk.tpc = false;
      hk.value = Math.min(100, HAO_KHI.tpc.after.value + hk.tpcGained);
      hk.floor = milestoneFloor(hk.value);
      hk.tpcGained = 0; hk.overflow = 0; hk.idle = 0;
      return true;
    }
    return false;
  }
  if (hk.value >= 100) { hk.atMaxFor += dt; return false; }
  hk.idle += dt;
  if (hk.idle >= HAO_KHI.decayIdle) {
    hk.decayAcc += dt * hk.decayMult;
    while (hk.decayAcc >= HAO_KHI.decayEvery) {
      hk.decayAcc -= HAO_KHI.decayEvery;
      hk.value = Math.max(hk.floor, hk.value - HAO_KHI.decayAmt);
    }
  }
  return false;
}

export const tpcReady = (hk) => !hk.tpc && hk.value >= 100;

// Kích Tổng Phản Công. Trả về thời lượng (s) hoặc 0 nếu chưa sẵn.
export function activate(hk) {
  if (!tpcReady(hk)) return 0;
  const T = HAO_KHI.tpc;
  const ext = Math.min(T.maxExt, Math.floor(hk.overflow / T.perOverflow) + hk.tpcExt);
  hk.tpc = true; hk.tpcLeft = T.base + ext; hk.tpcGained = 0; hk.tpcCount++;
  hk.value = 100; hk.overflow = 0; hk.atMaxFor = 0;
  return hk.tpcLeft;
}
