// sim/terrain-rules.js — "chỗ đất cao thấp ảnh hưởng tới trận": luật địa hình cho vùng chiến đấu và mô phỏng 1 Hz.
//
// Thuần: không three, không DOM; chạy được trong Node (tests/run.mjs). Mọi con số ở TERRAIN (data/tuning.js),
// cả khối là ĐỀ XUẤT BẢN THỬ.
//
//   tốc chạy     = tốc gốc × slopeFactor(dốc dọc hướng đi) × mudFactor(mudAt), sàn TERRAIN.minSpeed
//   sát thương   = công thức cũ (heSoGiap…) × heightDamageMult(Δh),  Δh = chân kẻ đánh − chân mục tiêu
//   tầm bắn      = tầm gốc × rangeMult(Δh)                            (chỉ được cộng, không bị trừ)
//   tổn thất 1 Hz: tonThat_A = SIM_LOSS_K · F_B · diaHinh_A · mThu_A, diaHinh_A nhân earthworkLossMult
//
// Hàm dùng mỗi bước 1/60 s cho mọi lính đang chạy: không cấp phát, không duyệt công trình (heightAt, mudAt
// tra lưới ô sẵn trong ground.js). earthworkLossMult chỉ so sánh và trả hằng số (mô phỏng 1 Hz xác định).

import { TERRAIN } from "../data/tuning.js";
import { FRONTS, xToLine } from "../data/battle-b15.js";
import { LANE_TERRAIN } from "../data/terrain-b15.js";
import { heightAt, mudAt, laneFeaturesOn } from "../battle/ground.js";

const SL = TERRAIN.slope, HT = TERRAIN.height;

// ---- tốc chạy -------------------------------------------------------------------------------------------
// grade = dh/dx dọc hướng đi (dương = lên dốc). Dốc nhỏ hơn SL.dead coi như phẳng: nền đất lượn sóng của bản
// đồ (dốc < 0,04 trên làn) không làm tướng, lính khựng lúc nhanh lúc chậm.
export function slopeFactor(grade) {
  if (grade > SL.dead) return Math.max(SL.upFloor, 1 - SL.up * (grade - SL.dead));
  if (grade < -SL.dead) return Math.min(SL.downCap, 1 + SL.down * (-grade - SL.dead));
  return 1;
}
export const mudFactor = (mud) => 1 - TERRAIN.mud * mud;

// Hệ số tốc chạy tại (x, z) theo hướng (dx, dz) (không cần chuẩn hoá; 0 thì 1). hf, mf: hàm độ cao, bùn (mặc
// định mặt đất trận; kiểm thử truyền hàm giả). Dò mặt đất trước/sau SL.probe m: bắt đúng mái lũy, vách hố.
export function speedFactor(x, z, dx, dz, hf = heightAt, mf = mudAt) {
  const L = Math.sqrt(dx * dx + dz * dz);
  if (!(L > 1e-6)) return 1;
  const k = SL.probe / L, ox = dx * k, oz = dz * k;
  const grade = (hf(x + ox, z + oz) - hf(x - ox, z - oz)) / (2 * SL.probe);
  return Math.max(TERRAIN.minSpeed, slopeFactor(grade) * mudFactor(mf(x, z)));
}

// ---- thế đất cao trong giao chiến -----------------------------------------------------------------------
// Δh = chân kẻ đánh − chân mục tiêu (m). |Δh| ≤ dead: 1. Cao hơn: +perM mỗi mét vượt dead, trần +cap; thấp
// hơn: −perM mỗi mét, sàn −floor. Liền mạch ở mép vùng chết (không nhảy bậc 3%).
export function heightDamageMult(dh) {
  const e = (dh < 0 ? -dh : dh) - HT.dead;
  if (e <= 0) return 1;
  return dh > 0 ? 1 + Math.min(HT.cap, HT.perM * e) : 1 - Math.min(HT.floor, HT.perM * e);
}
// Kẻ bắn đứng cao hơn mục tiêu: tầm × (1 + rangePerM mỗi mét vượt dead), trần +rangeCap. Thấp hơn: giữ tầm.
export function rangeMult(dh) {
  const e = dh - HT.dead;
  return e > 0 ? 1 + Math.min(HT.rangeCap, HT.rangePerM * e) : 1;
}
// Độ cao chân (mặt đất dưới chân) của tướng, lính, đơn vị lớn. Không dùng o.y: lính có y là độ cao bay khi
// bị hất tung (tính từ mặt đất), đơn vị lớn có y là getter — thế đất tính theo chỗ đứng.
export const footY = (o) => heightAt(o.x, o.z);
// Hệ số sát thương của att đánh tgt theo thế đất.
export const hitMult = (att, tgt) => heightDamageMult(footY(att) - footY(tgt));

// ---- công sự trong mô phỏng 1 Hz ------------------------------------------------------------------------
// Vị trí trên tuyến (0..1) của lũy Nguyên và ụ đất quân ta mỗi mặt trận, lấy từ data/terrain-b15.js: trung bình
// điểm giữa các đoạn cùng loại trên làn đó (lũy A x ≈ 300 → 0,48; ụ ta A x ≈ 141,5 → 0,163, B x ≈ 235 → 0,35).
// null: làn không có công sự loại đó.
function laneLine(kind, lane) {
  let s = 0, n = 0;
  for (const b of LANE_TERRAIN.berms) if (b.kind === kind && b.lane === lane) { s += (b.a[0] + b.b[0]) / 2; n++; }
  return n ? xToLine(FRONTS[lane], s / n) : null;
}
export const EARTHWORK_LINES = {};
for (const id in FRONTS) EARTHWORK_LINES[id] = { luy: laneLine("luy_nguyen", id), uTa: laneLine("u_ta", id) };

// Hệ số tổn thất của phe `side` ở mặt trận frontId khi tuyến ở x. luyStands: doanh trại cánh đó còn trong tay
// địch (lũy Nguyên còn người giữ). Chỉ so sánh, trả hằng số: mô phỏng xác định từng bit.
export function earthworkLossMult(side, frontId, x, luyStands) {
  const L = EARTHWORK_LINES[frontId], F = TERRAIN.front;
  if (!L) return 1;
  if (side === "dich") return luyStands && L.luy !== null && x >= L.luy + F.luyBand[0] && x <= L.luy + F.luyBand[1] ? F.luyLoss : 1;
  return L.uTa !== null && x >= L.uTa - F.uTaBand && x <= L.uTa + F.uTaBand ? F.uTaLoss : 1;
}

// ---- gò cho cung thủ ------------------------------------------------------------------------------------
// Gò gần (x, z) nhất trong TERRAIN.perch.seek m mà đỉnh cách mục tiêu (tx, tz) trong [minD, reach × range]:
// đứng trên đỉnh bắn tới được, lại không sát mặt tướng. null nếu không có (hoặc chưa bật công trình làn đánh).
const MOUNDS = LANE_TERRAIN.mounds;
export function perchNear(x, z, tx, tz, range) {
  if (!laneFeaturesOn()) return null;
  const P = TERRAIN.perch, far = P.reach * range;
  let best = null, bd = P.seek * P.seek;
  for (let i = 0; i < MOUNDS.length; i++) {
    const m = MOUNDS[i], d2 = (m.x - x) * (m.x - x) + (m.z - z) * (m.z - z);
    if (d2 >= bd) continue;
    const t2 = (m.x - tx) * (m.x - tx) + (m.z - tz) * (m.z - tz);
    if (t2 > far * far || t2 < P.minD * P.minD) continue;
    best = m; bd = d2;
  }
  return best;
}

// ---- HUD ------------------------------------------------------------------------------------------------
// Tag thế đất của tướng: dmg hệ số sát thương tướng gây cho mục tiêu (1 nếu không có mục tiêu), mud mức bùn
// dưới chân, run hệ số tốc chạy vì bùn. Trả một đối tượng dùng lại.
const TAG = { dmg: 1, mud: 0, run: 1 };
export function heroTerrain(hero, target) {
  TAG.dmg = target ? hitMult(hero, target) : 1;
  TAG.mud = mudAt(hero.x, hero.z); TAG.run = mudFactor(TAG.mud);
  return TAG;
}
