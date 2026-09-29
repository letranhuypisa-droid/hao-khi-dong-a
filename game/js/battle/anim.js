// battle/anim.js — hoạt ảnh thủ tục cho rig (chưa có clip nướng; 21.4 S1.9 là việc của AN).
//
// Mỗi hàm trả về một "tư thế" (object góc). applyPose() đặt góc lên khớp, blendPose() trộn hai
// tư thế để chuyển clip mượt. Quy ước: sh*.x âm = giơ tay ra trước/lên; sh*.z dương ở tay phải
// = dang ra ngoài; torsoY = vặn người.

const K = ["torsoX", "torsoY", "torsoZ", "shLx", "shLy", "shLz", "elLx", "shRx", "shRy", "shRz", "elRx",
  "hipLx", "hipRx", "kneeLx", "kneeRx", "hipsY", "rootX", "spin", "headX"];

export function zeroPose() { const p = {}; for (const k of K) p[k] = 0; return p; }

export function blendPose(a, b, t) {
  const p = {};
  for (const k of K) p[k] = (a[k] || 0) + ((b[k] || 0) - (a[k] || 0)) * t;
  return p;
}

export function applyPose(rig, p) {
  const j = rig.p;
  j.torso.rotation.set(p.torsoX, p.torsoY, p.torsoZ);
  j.shL.rotation.set(p.shLx, p.shLy, p.shLz); j.elL.rotation.x = p.elLx;
  j.shR.rotation.set(p.shRx, p.shRy, p.shRz); j.elR.rotation.x = p.elRx;
  j.hipL.rotation.x = p.hipLx; j.hipR.rotation.x = p.hipRx;
  j.kneeL.rotation.x = p.kneeLx; j.kneeR.rotation.x = p.kneeRx;
  j.hips.position.y = 0.92 + p.hipsY; j.hips.rotation.x = p.rootX; j.hips.rotation.y = p.spin;
  j.head.rotation.x = p.headX;
}

const ease = (t) => t * t * (3 - 2 * t);
const seg = (u, a, b) => Math.min(1, Math.max(0, (u - a) / (b - a)));

export function idle(t, guard = true) {
  const p = zeroPose(), br = Math.sin(t * 2) * 0.03;
  p.torsoX = 0.05 + br; p.hipsY = -0.04 + br * 0.5;
  p.shRx = guard ? -0.5 : -0.1; p.elRx = guard ? -0.9 : -0.2; p.shRz = 0.15;
  p.shLx = guard ? -0.3 : -0.1; p.elLx = guard ? -1.0 : -0.2; p.shLz = -0.15;
  p.hipLx = -0.15; p.hipRx = 0.15; p.kneeLx = 0.2; p.kneeRx = 0.1;
  return p;
}

export function run(phase, speed01 = 1) {
  const p = zeroPose(), s = Math.sin(phase), c = Math.cos(phase);
  p.torsoX = 0.22 * speed01; p.hipsY = -0.05 + Math.abs(c) * 0.06 * speed01;
  p.hipLx = s * 0.8 * speed01; p.hipRx = -s * 0.8 * speed01;
  p.kneeLx = Math.max(0, -s) * 1.1 * speed01 + 0.1; p.kneeRx = Math.max(0, s) * 1.1 * speed01 + 0.1;
  p.shRx = -0.4 + s * 0.5 * speed01; p.elRx = -0.9; p.shRz = 0.2;
  p.shLx = -0.4 - s * 0.5 * speed01; p.elLx = -0.9; p.shLz = -0.2;
  return p;
}

// Chém ngang: side = 1 tay phải, -1 tay trái. u = 0..1 tiến độ clip.
export function slash(u, side = 1, high = 0) {
  const p = zeroPose(), w = ease(seg(u, 0, 0.35)), s = ease(seg(u, 0.35, 0.62)), r = seg(u, 0.62, 1);
  const twist = 0.9 * w - 1.9 * s;
  p.torsoY = side * (twist * (1 - r * 0.7));
  p.torsoX = 0.15 + 0.1 * s;
  const arm = side > 0 ? "R" : "L", other = side > 0 ? "L" : "R";
  p["sh" + arm + "x"] = -1.3 - high * 0.9 * (1 - s);
  p["sh" + arm + "z"] = side * (0.9 * w - 0.6 * s) * (1 - r * 0.6);
  p["el" + arm + "x"] = -0.2 - 0.6 * w * (1 - s);
  p["sh" + other + "x"] = -0.6; p["el" + other + "x"] = -1.1; p["sh" + other + "z"] = -side * 0.3;
  p.hipLx = -0.35 * s; p.hipRx = 0.35 * s; p.kneeLx = 0.3; p.kneeRx = 0.3; p.hipsY = -0.1 * s;
  return p;
}

// Hai đao cùng chém (N6, C1).
export function doubleChop(u) {
  const p = zeroPose(), w = ease(seg(u, 0, 0.45)), s = ease(seg(u, 0.45, 0.62));
  p.shRx = -2.8 * w + 2.4 * s; p.shLx = -2.8 * w + 2.4 * s; p.shRz = 0.2; p.shLz = -0.2;
  p.elRx = -0.4 * w; p.elLx = -0.4 * w;
  p.torsoX = -0.25 * w + 0.6 * s; p.hipsY = -0.25 * s; p.hipLx = -0.5 * s; p.kneeLx = 0.6 * s; p.kneeRx = 0.5 * s; p.hipRx = 0.3 * s;
  p.headX = -0.2 * w;
  return p;
}

// Xoay tròn: n vòng trong clip, hai tay dang.
export function spin(u, turns = 1) {
  const p = zeroPose(), s = ease(seg(u, 0.1, 0.85));
  p.spin = s * turns * Math.PI * 2;
  p.shRz = 1.35; p.shLz = -1.35; p.shRx = -0.3; p.shLx = -0.3;
  p.torsoX = 0.2; p.hipsY = -0.15; p.kneeLx = 0.4; p.kneeRx = 0.4;
  return p;
}

// Hất tung (C2): chém vòng từ dưới lên.
export function uppercut(u) {
  const p = zeroPose(), w = ease(seg(u, 0, 0.3)), s = ease(seg(u, 0.3, 0.55));
  p.shRx = 0.6 * w - 3.2 * s; p.shLx = 0.6 * w - 3.2 * s; p.shRz = 0.25; p.shLz = -0.25;
  p.torsoX = 0.45 * w - 0.4 * s; p.hipsY = -0.3 * w + 0.25 * s; p.kneeLx = 0.8 * w; p.kneeRx = 0.8 * w;
  return p;
}

// Lao tới (lướt, C5, Phá Trận).
export function dash(u) {
  const p = zeroPose(), s = ease(seg(u, 0.2, 0.6));
  p.torsoX = 0.55; p.hipsY = -0.2;
  p.shRx = 0.9 - 2.2 * s; p.shLx = 0.9 - 2.2 * s; p.shRz = 0.3 + 0.6 * s; p.shLz = -0.3 - 0.6 * s;
  p.hipLx = -0.9; p.hipRx = 0.6; p.kneeLx = 0.5; p.kneeRx = 0.9;
  return p;
}

export function block() {
  const p = zeroPose();
  p.shRx = -1.25; p.shRz = -0.55; p.elRx = -1.1; p.shLx = -1.25; p.shLz = 0.55; p.elLx = -1.1;
  p.torsoX = 0.2; p.hipsY = -0.18; p.kneeLx = 0.4; p.kneeRx = 0.4; p.hipLx = -0.3; p.hipRx = 0.2;
  return p;
}

export function hitReact(u) {
  const p = idle(0); const k = Math.sin(Math.min(1, u) * Math.PI);
  p.torsoX = -0.45 * k; p.headX = -0.3 * k; p.shRx = 0.3 * k; p.shLx = 0.3 * k;
  return p;
}

export function dodgeRoll(u) {
  const p = zeroPose(), k = Math.sin(u * Math.PI);
  p.torsoX = 0.9 * k; p.hipsY = -0.45 * k; p.kneeLx = 1.2 * k; p.kneeRx = 1.2 * k; p.hipLx = -1.0 * k; p.hipRx = -0.6 * k;
  p.shRx = -1.0 * k; p.shLx = -1.0 * k; p.elRx = -1.2; p.elLx = -1.2;
  return p;
}

export function knockdown(u) {
  const p = zeroPose(), k = ease(Math.min(1, u * 2.5));
  p.rootX = -1.4 * k; p.hipsY = -0.75 * k; p.shRx = -2.5 * k; p.shLx = -2.5 * k; p.kneeLx = 0.4; p.kneeRx = 0.4;
  return p;
}

// Đòn nặng hai tay (Toa Đô đại đao, đòn viền đỏ): giơ cao rồi bổ.
export function heavyChop(u, windup = 0.55) {
  const p = zeroPose(), w = ease(seg(u, 0, windup)), s = ease(seg(u, windup, windup + 0.14));
  p.shRx = -2.9 * w + 2.5 * s; p.shLx = -2.7 * w + 2.4 * s; p.shRz = -0.25; p.shLz = 0.35;
  p.elRx = -0.5 * w; p.elLx = -0.7 * w;
  p.torsoX = -0.35 * w + 0.75 * s; p.torsoY = 0.3 * w - 0.3 * s; p.hipsY = -0.3 * s;
  p.hipLx = -0.6 * s; p.kneeLx = 0.7 * s; p.hipRx = 0.4 * s; p.kneeRx = 0.4;
  return p;
}

export function sweep(u) {
  const p = zeroPose(), w = ease(seg(u, 0, 0.4)), s = ease(seg(u, 0.4, 0.62));
  p.torsoY = 1.3 * w - 2.6 * s; p.shRx = -1.4; p.shLx = -1.2; p.shRz = -0.3; p.shLz = 0.2; p.elRx = -0.2;
  p.hipsY = -0.18; p.kneeLx = 0.35; p.kneeRx = 0.35;
  return p;
}

export function shoot(u) {
  const p = zeroPose(), d = ease(seg(u, 0, 0.6));
  p.shLx = -1.5; p.shLz = -0.1; p.elLx = 0; p.shRx = -1.5; p.shRz = -0.5 * d; p.elRx = -2.0 * d; p.torsoY = -0.5;
  return p;
}

export function cheer(t) {
  const p = idle(t, false);
  p.shRx = -2.9; p.elRx = -0.2; p.shLx = -2.6; p.elLx = -0.4; p.headX = -0.3;
  return p;
}
