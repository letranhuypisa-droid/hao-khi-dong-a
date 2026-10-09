// tools/retarget.mjs — chuyển một tư thế xương người bất kỳ (clip Mixamo, Quaternius…) về bảng góc của rig game (js/battle/anim.js K).
//
// Không dùng góc xương nguồn (mỗi bộ xương một quy ước trục, T-pose hay A-pose đều khác nhau) mà chỉ dùng VỊ TRÍ khớp, đã đổi
// sang hệ trục game (mặt nhìn +z, lên +y, "R" ở +x; tay phải giải phẫu của nguồn thành R của game, xem bake-clips.mjs). Từ vị trí
// suy ra hướng từng đoạn xương rồi giải ngược đúng các bậc tự do mà rig game có:
//   · hông (hips): khung từ hai khớp háng + gốc cột sống → Euler XYZ (rootX, hipsYaw, rootZ), độ cao → hipsY;
//   · thân (torso): khung từ hai khớp vai + cổ, tương đối với hông → Euler XYZ (torsoX, torsoY, torsoZ);
//   · đầu: chỉ gật (headX) — hướng "lên" của xương đầu trong khung thân;
//   · vai (sh, Euler YXZ, 3 bậc) + khuỷu (el, bản lề quanh x): tay trên theo hướng khuỷu; mặt phẳng gập khuỷu của nguồn quyết định
//     phần xoắn của vai, nhờ đó cẳng tay đúng hướng nguồn với chỉ một bản lề x (khuỷu thẳng thì giữ mặt phẳng khung trước);
//   · cổ tay (hand, x và z): hướng bàn tay (khớp cổ tay → gốc ngón giữa) trong khung cẳng tay;
//   · háng (hip, chỉ x và z — rig game không có xoay dọc đùi) + gối (knee, bản lề x): đùi theo hướng gối, gối gập đúng góc giữa
//     đùi và cẳng chân.
// Thuần số (three để tính ma trận / Euler), không DOM, không đọc tệp: tests/clips.test.mjs chạy được trong Node.

import * as THREE from "three";

export const HIPS_Y = 0.92;       // độ cao khớp hông của rig game khi chân duỗi (models.js makeRig)
// Cổ tay của rig nằm lệch 0,02 m ra trước trục cẳng tay (models.js: joint(el, 0, −0,36, 0,02)): khuỷu "thẳng" (góc 0) thì cẳng tay
// đã chếch ARM_OFF so với cánh tay trên; góc khuỷu = ARM_OFF − góc giữa hai đoạn.
export const ARM_OFF = Math.atan2(0.02, 0.36);

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const _e = new THREE.Euler();
const dir = (a, b) => b.clone().sub(a).normalize();

// Khung quay từ trục x gần đúng và trục y gần đúng: z = x × y, y dựng lại cho trực giao. Trả THREE.Matrix4 (cột x, y, z).
export function frameXY(xDir, yDir) {
  const x = xDir.clone().normalize();
  const z = new THREE.Vector3().crossVectors(x, yDir).normalize();
  const y = new THREE.Vector3().crossVectors(z, x).normalize();
  return new THREE.Matrix4().makeBasis(x, y, z);
}
const inv = (m) => m.clone().transpose();                 // nghịch đảo của ma trận quay
const toLocal = (m, v) => v.clone().applyMatrix4(inv(m));
const euler = (m, order) => { _e.setFromRotationMatrix(m, order); return _e; };

// Khung thân (Rt) của bộ giải: dùng chung cho chế độ gươm hai tay của bake-clips.mjs (đổi vị trí bàn tay sang khung thân).
export function torsoFrame(P) { return frameXY(dir(P.L.arm, P.R.arm), dir(P.spine, P.neck)); }

// Trạng thái giữa các khung (mặt phẳng gập khuỷu của khung trước, dùng khi tay duỗi thẳng).
export function newState() { return { w: { L: V(0, 0, 1), R: V(0, 0, 1) } }; }

// P: { hips, spine, neck, headUp (hướng, không phải điểm), L: { arm, fore, hand, mid, thigh, shin }, R: {...} } — mọi điểm là
// THREE.Vector3 trong hệ trục game, đã nhân tỉ lệ k (hông cao HIPS_Y khi đứng thẳng). Ghi vào out (đối tượng tư thế) và trả out.
export function solvePose(P, st, out = {}, armOff = ARM_OFF) {
  // ---- hông ----
  const Rh = frameXY(dir(P.L.thigh, P.R.thigh), dir(P.hips, P.spine));
  euler(Rh, "XYZ"); out.rootX = _e.x; out.hipsYaw = _e.y; out.rootZ = _e.z; out.spin = 0;
  out.hipsY = P.hips.y - HIPS_Y;
  // ---- thân: khung từ vai + cổ, tương đối với hông ----
  const Rt = frameXY(dir(P.L.arm, P.R.arm), dir(P.spine, P.neck));
  euler(inv(Rh).multiply(Rt), "XYZ"); out.torsoX = _e.x; out.torsoY = _e.y; out.torsoZ = _e.z;
  // ---- đầu: gật trong khung thân ----
  const hl = toLocal(Rt, P.headUp); out.headX = Math.atan2(hl.z, hl.y);
  // ---- tay ----
  for (const s of ["L", "R"]) {
    const Q = P[s], u = toLocal(Rt, dir(Q.arm, Q.fore)), f = toLocal(Rt, dir(Q.fore, Q.hand));
    const phi = Math.acos(clamp(u.dot(f), -1, 1));
    const perp = f.clone().sub(u.clone().multiplyScalar(f.dot(u)));
    const keep = st.w[s].clone(); keep.sub(u.clone().multiplyScalar(keep.dot(u)));
    if (keep.lengthSq() < 1e-6) keep.set(0, 0, 1).sub(u.clone().multiplyScalar(u.z));
    keep.normalize();
    // khuỷu gần thẳng: mặt phẳng gập chưa xác định → trộn dần từ mặt phẳng khung trước
    const blend = clamp(Math.sin(phi) / 0.15, 0, 1);
    const w = perp.lengthSq() > 1e-10 ? keep.clone().lerp(perp.normalize(), blend).normalize() : keep;
    st.w[s].copy(w);
    const Rsh = new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(u.clone().negate(), w), u.clone().negate(), w);
    euler(Rsh, "YXZ"); out["sh" + s + "x"] = _e.x; out["sh" + s + "y"] = _e.y; out["sh" + s + "z"] = _e.z;
    const el = armOff - phi; out["el" + s + "x"] = el;
    // cổ tay: hướng bàn tay trong khung cẳng tay (khung vai quay thêm bản lề khuỷu)
    const Rel = Rsh.clone().multiply(new THREE.Matrix4().makeRotationX(el));
    const d = toLocal(Rel, toLocal(Rt, dir(Q.hand, Q.mid)));
    out["hand" + s + "z"] = Math.asin(clamp(d.x, -1, 1));
    out["hand" + s + "x"] = Math.atan2(-d.z, -d.y);
  }
  // ---- chân ----
  // Háng chỉ có x, z (không xoay dọc đùi) nên đùi và cẳng chân của nguồn không phải lúc nào cũng cùng đạt được (gối chếch ngang khi bước
  // dài, lunge). Nghiệm giải tích khớp đúng đùi rồi để cẳng chân sai tới 60–90°; tinh chỉnh ba góc (háng x, z, gối) để tổng sai hướng
  // đùi + cẳng chân nhỏ nhất. Khứ hồi (nguồn đạt được) vẫn ra nghiệm đúng vì sai số bằng 0 ngay từ đầu.
  for (const s of ["L", "R"]) {
    const Q = P[s], u = toLocal(Rh, dir(Q.thigh, Q.shin)), f = toLocal(Rh, dir(Q.shin, Q.foot));
    const x0 = Math.atan2(-u.z, -u.y), z0 = Math.asin(clamp(u.x, -1, 1)), k0 = Math.acos(clamp(u.dot(f), -1, 1));
    const [x, z, k] = refineLeg(u, f, x0, z0, k0);
    out["hip" + s + "z"] = z; out["hip" + s + "x"] = x; out["knee" + s + "x"] = k;
  }
  return out;
}

// Sai hướng (rad) của chân dựng từ (x, z, k) so với đùi u và cẳng chân f mục tiêu (khung hông). Hông: Rx(x)·Rz(z); gối: Rx(k) trong khung đùi.
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _m = new THREE.Matrix4(), _n = new THREE.Matrix4();
function legErr(u, f, x, z, k) {
  _m.makeRotationX(x).multiply(_n.makeRotationZ(z));
  const th = _a.set(0, -1, 0).applyMatrix4(_m), sh = _b.set(0, -1, 0).applyMatrix4(_n.makeRotationX(k)).applyMatrix4(_m);
  return Math.acos(clamp(th.dot(u), -1, 1)) + Math.acos(clamp(sh.dot(f), -1, 1));
}
function refineLeg(u, f, x, z, k) {
  let e = legErr(u, f, x, z, k), step = 0.2;
  if (e < 1e-6) return [x, z, k];
  for (let it = 0; it < 40 && step > 1e-4; it++) {
    let moved = false;
    for (const [dx, dz, dk] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      const nx = x + dx * step, nz = z + dz * step, nk = Math.max(0, k + dk * step), ne = legErr(u, f, nx, nz, nk);
      if (ne < e - 1e-9) { e = ne; x = nx; z = nz; k = nk; moved = true; }
    }
    if (!moved) step *= 0.5;
  }
  return [x, z, k];
}

// Tên các kênh bộ giải ghi (theo thứ tự cố định để nén thành mảng).
export const KEYS = ["rootX", "hipsYaw", "rootZ", "hipsY", "torsoX", "torsoY", "torsoZ", "headX",
  "shLx", "shLy", "shLz", "elLx", "handLx", "handLz", "shRx", "shRy", "shRz", "elRx", "handRx", "handRz",
  "hipLx", "hipLz", "kneeLx", "hipRx", "hipRz", "kneeRx"];
// Kênh là góc có thể quay quá ±π giữa hai khung (cần gỡ nhảy khi nướng clip lăn, ngã).
export const WRAP = new Set(["rootX", "hipsYaw", "rootZ", "torsoX", "torsoY", "torsoZ"]);
