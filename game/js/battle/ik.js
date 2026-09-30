// battle/ik.js — toán thuần cho chân bám đất và chuyển động phụ (vạt áo, tua giáo, dải khăn).
// Không import three: kiểm thử được trong Node (tests/run.mjs), dùng chung cho lính instanced
// (soldiers.js, crowd.js) và rig khớp nối của tướng, sĩ quan (models.js, hero.js, units.js).
//
// ---- quy ước chân ------------------------------------------------------------------------------
// Giống rig (anim.js) và bộ khớp lính (soldiers.js): góc đùi θ quay quanh trục x, âm = đưa chân ra
// trước; góc gối κ dương = gập gối. Xét mặt phẳng dọc của chân, gốc ở khớp hông, y hướng lên,
// z hướng ra trước (hướng mặt):
//   gối      = (y: −L1·cos θ,        z: −L1·sin θ)
//   bàn chân = gối + (y: −L2·cos(θ+κ), z: −L2·sin(θ+κ))
// Xoay quanh x theo chiều dương đưa mũi bàn chân (+z) đi XUỐNG; góc bàn chân bám dốc lên = −atan(dốc).

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };

// Vị trí bàn chân (so với khớp hông) theo góc đùi, góc gối. out = [y, z].
export function footPos(th, kn, L1, L2, out = [0, 0]) {
  out[0] = -L1 * Math.cos(th) - L2 * Math.cos(th + kn);
  out[1] = -L1 * Math.sin(th) - L2 * Math.sin(th + kn);
  return out;
}

// Giải IK hai khúc tới điểm (ty, tz) so với khớp hông. out = [θ, κ]. Gối luôn gập về trước (κ ≥ 0).
// Điểm ngoài tầm với thì chân duỗi hết cỡ về phía điểm đó; điểm quá gần thì co tối đa (không lật gối).
export function legIK(ty, tz, L1, L2, out = [0, 0]) {
  const reach = (L1 + L2) * 0.9995, dMin = Math.max(Math.abs(L1 - L2) + 1e-3, (L1 + L2) * 0.22);
  let d = Math.sqrt(ty * ty + tz * tz);
  if (!(d > 1e-6)) { ty = -dMin; tz = 0; d = dMin; }
  const phi = Math.atan2(-tz, -ty);
  d = clamp(d, dMin, reach);
  const cosK = clamp((L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2), -1, 1);
  const cosA = clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1);
  out[0] = phi - Math.acos(cosA);
  out[1] = Math.PI - Math.acos(cosK);
  return out;
}

// Dời bàn chân theo phương đứng một đoạn dy (dương = nâng lên) mà giữ nguyên vị trí trước/sau.
// Dùng cho chân bám đất: dy = (đất dưới bàn chân − đất dưới gốc rig) − độ hạ hông.
const _f = [0, 0];
export function legShift(th, kn, L1, L2, dy, out = [0, 0]) {
  footPos(th, kn, L1, L2, _f);
  return legIK(_f[0] + dy, _f[1], L1, L2, out);
}

// Độ hạ hông (≤ 0) để chân phía đất thấp còn chạm được đất: lấy chỗ thấp nhất dưới hai bàn chân so với
// gốc, không hạ quá maxDrop. dyL, dyR = đất dưới bàn chân − đất dưới gốc.
export function pelvisDrop(dyL, dyR, maxDrop) { return clamp(Math.min(0, dyL, dyR), -maxDrop, 0); }

// Mức "bàn chân đang chạm đất" 0..1 theo độ cao đế giày so với mặt đất trong tư thế gốc (chưa IK):
// sát đất = 1, nhấc quá 0,16 m = 0. Dùng để trộn góc cổ chân bám dốc và khoá bàn chân.
export function contact(soleH) { return 1 - smooth(0.02, 0.16, soleH); }

// Độ dốc mặt đất theo hướng (fx, fz) tại (x, z): trả về góc cổ chân (quanh trục x của chân) làm đế
// giày nằm song song mặt dốc. ground(x, z) là hàm độ cao (heightAt).
export function slopePitch(ground, x, z, fx, fz, d = 0.3) {
  const s = (ground(x + fx * d, z + fz * d) - ground(x - fx * d, z - fz * d)) / (2 * d);
  return -Math.atan(clamp(s, -1.5, 1.5));
}

// ---- lò xo tắt dần (vạt áo, áo choàng, cờ) -----------------------------------------------------
// s[i] = vị trí, s[i+1] = vận tốc. x'' = k·(đích − x) − c·x'. Tự chia bước ≤ 1/60 s nên ổn định với
// mọi dt (khung dài, tua trận); dt ≤ 0 thì đứng yên (hit-stop). Trả về vị trí mới.
export function spring(s, i, target, k, c, dt) {
  if (!(dt > 0)) return s[i];
  const n = Math.min(12, Math.ceil(dt * 60)), h = dt / n;
  let x = s[i], v = s[i + 1];
  if (!Number.isFinite(x) || !Number.isFinite(v)) { x = target; v = 0; }
  for (let j = 0; j < n; j++) { v += (k * (target - x) - c * v) * h; x += v * h; }
  s[i] = x; s[i + 1] = v;
  return x;
}
// Hệ số cản cho lò xo có tần số riêng k và tỉ số tắt dần zeta (1 = tắt tới hạn, < 1 = còn đung đưa).
export const damping = (k, zeta) => 2 * zeta * Math.sqrt(k);

// ---- con lắc / dây treo (tua giáo, đuôi ngựa, dải khăn) -----------------------------------------
// Động lực học vị trí (PBD) có chia bước: mỗi đốt rơi theo trọng lực, bị kéo về đúng độ dài đốt tính
// từ đốt trước (đốt 0 treo vào điểm neo a). pts: Float32Array cỡ n·6 — [x, y, z, vx, vy, vz] mỗi đốt.
// Lần đầu (hoặc khi neo nhảy xa hơn 4 lần độ dài dây, vd lính được tái dùng từ pool) thì đặt lại dây
// buông thẳng xuống. opts: damp (1/s, cản không khí), g, floor (độ cao mặt đất dưới dây),
// wind [wx, wz] (gió, m/s²), maxV (trần vận tốc).
export function rope(pts, n, ax, ay, az, seg, dt, opts = {}) {
  const damp = opts.damp ?? 2.2, g = opts.g ?? 9.8, floor = opts.floor ?? -Infinity, maxV = opts.maxV ?? 25;
  const wx = opts.wind ? opts.wind[0] : 0, wz = opts.wind ? opts.wind[1] : 0;
  const L = seg * n;
  const dx0 = pts[(n - 1) * 6] - ax, dy0 = pts[(n - 1) * 6 + 1] - ay, dz0 = pts[(n - 1) * 6 + 2] - az;
  const bad = !Number.isFinite(dx0 + dy0 + dz0) || dx0 * dx0 + dy0 * dy0 + dz0 * dz0 > 16 * L * L || opts.reset;
  if (bad || (pts[0] === 0 && pts[1] === 0 && pts[2] === 0)) {
    for (let k = 0; k < n; k++) { const o = k * 6; pts[o] = ax; pts[o + 1] = ay - seg * (k + 1); pts[o + 2] = az; pts[o + 3] = pts[o + 4] = pts[o + 5] = 0; }
    return pts;
  }
  const steps = dt > 0 ? Math.min(8, Math.ceil(dt * 60)) : 1, h = dt > 0 ? dt / steps : 0;
  const kd = h > 0 ? Math.exp(-damp * h) : 1;
  for (let s = 0; s < steps; s++) {
    let px = ax, py = ay, pz = az;
    for (let k = 0; k < n; k++) {
      const o = k * 6;
      let x = pts[o], y = pts[o + 1], z = pts[o + 2];
      let nx = x, ny = y, nz = z;
      if (h > 0) {
        let vx = (pts[o + 3] + wx * h) * kd, vy = (pts[o + 4] - g * h) * kd, vz = (pts[o + 5] + wz * h) * kd;
        nx = x + vx * h; ny = y + vy * h; nz = z + vz * h;
      }
      // giữ đúng độ dài đốt tính từ đốt trước
      let ex = nx - px, ey = ny - py, ez = nz - pz;
      const d = Math.sqrt(ex * ex + ey * ey + ez * ez);
      if (d > 1e-6) { const f = seg / d; nx = px + ex * f; ny = py + ey * f; nz = pz + ez * f; } else { nx = px; ny = py - seg; nz = pz; }
      if (ny < floor) ny = floor;
      if (h > 0) {
        let vx = (nx - x) / h, vy = (ny - y) / h, vz = (nz - z) / h;
        const sp = Math.sqrt(vx * vx + vy * vy + vz * vz);
        if (sp > maxV) { const f = maxV / sp; vx *= f; vy *= f; vz *= f; }
        pts[o + 3] = vx; pts[o + 4] = vy; pts[o + 5] = vz;
      }
      pts[o] = nx; pts[o + 1] = ny; pts[o + 2] = nz;
      px = nx; py = ny; pz = nz;
    }
  }
  return pts;
}

// Góc Euler (thứ tự "XYZ" với y = 0 thì chỉ còn x rồi z) để một khúc treo dọc −y trong khung cha
// chĩa theo hướng (dx, dy, dz) đã đổi về khung cha. Trả out = [rx, rz]. Dùng cho khúc treo đơn giản
// (vạt, tua) khi không muốn dựng quaternion.
export function hangAngles(dx, dy, dz, out = [0, 0]) {
  // xoay quanh z trước (lệch sang ±x), rồi quanh x (lệch ra trước/sau): v = Rx·Rz·(0, −1, 0)
  const L = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
  const ux = dx / L, uy = dy / L, uz = dz / L;
  out[1] = Math.asin(clamp(ux, -1, 1));                 // rz: +x khi rz dương
  const c = Math.cos(out[1]);
  out[0] = c > 1e-4 ? Math.atan2(-uz, -uy) : 0;         // rx: −y → −z khi rx dương (mũi ra sau)
  return out;
}
