// battle/anim.js — hoạt ảnh thủ tục cho rig (chưa có clip nướng; 21.4 S1.9 là việc của AN).
//
// Mỗi hàm trả về một "tư thế" (object góc). applyPose() đặt góc lên khớp, blendPose() trộn hai
// tư thế để chuyển clip mượt. Đòn dựng bằng khung khoá (key): mỗi khung là một tư thế đầy đủ tại
// một mốc u ∈ [0,1], giữa hai khung nội suy theo hàm nhịp của khung đích. Nhịp đòn chém: gồng
// (chậm, easeOut) → chém (rất nhanh) → theo đà (giữ) → hồi thế.
//
// Quy ước: vai xoay theo thứ tự YXZ — sh*x âm = giơ tay ra trước/lên, sh*y = quay cánh tay sang
// ngang (tay phải +y = ra phía +x), sh*z = dang ngang. el*x âm = gập khuỷu. hand*x dương = lật lưỡi
// đao theo trục cẳng tay (1,5 ≈ lưỡi nối dài cánh tay), âm = lưỡi ngửa ra sau. torsoY dương = vai
// phải lùi, vai trái tiến. hip*x âm = đưa chân ra trước; knee*x dương = gập gối. "Phải" = phía +x.

const K = ["torsoX", "torsoY", "torsoZ", "shLx", "shLy", "shLz", "elLx", "handLx", "handLz",
  "shRx", "shRy", "shRz", "elRx", "handRx", "handRz",
  "hipLx", "hipLz", "hipRx", "hipRz", "kneeLx", "kneeRx", "hipsY", "hipsYaw", "rootX", "rootZ", "spin", "headX"];

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
  j.handL.rotation.set(p.handLx, 0, p.handLz); j.handR.rotation.set(p.handRx, 0, p.handRz);
  j.hipL.rotation.set(p.hipLx, 0, p.hipLz); j.hipR.rotation.set(p.hipRx, 0, p.hipRz);
  j.kneeL.rotation.x = p.kneeLx; j.kneeR.rotation.x = p.kneeRx;
  j.hips.position.y = 0.92 + p.hipsY; j.hips.rotation.set(p.rootX, p.spin + p.hipsYaw, p.rootZ);
  j.head.rotation.x = p.headX;
}

// ---- nhịp ------------------------------------------------------------------------------------
const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
const EASE = {
  lin: (t) => t,
  io: (t) => t * t * (3 - 2 * t),
  out: (t) => 1 - (1 - t) * (1 - t),
  out3: (t) => 1 - (1 - t) ** 3,
  in: (t) => t * t,
  snap: (t) => 1 - (1 - t) ** 4,            // chém: gần như tức thì rồi hãm lại
};
const seg = (u, a, b) => clamp01((u - a) / (b - a));

// Dựng tư thế đầy đủ từ phần khác 0.
function P(o) { const p = zeroPose(); for (const k in o) p[k] = o[k]; return p; }
// Trộn dãy khung khoá [[u, tư thế, nhịp]] tại u.
function keys(u, ks) {
  if (u <= ks[0][0]) return { ...ks[0][1] };
  for (let i = 1; i < ks.length; i++) {
    const [u1, p1, e = "io"] = ks[i];
    if (u <= u1) { const [u0, p0] = ks[i - 1]; return blendPose(p0, p1, EASE[e](seg(u, u0, u1))); }
  }
  return { ...ks[ks.length - 1][1] };
}
// Cộng thêm (dùng cho thở, xoay tròn chồng lên khung khoá).
function add(p, o) { for (const k in o) p[k] += o[k]; return p; }
// Lật trái ↔ phải (đòn tay trái dùng lại khung của tay phải).
function mirror(p) {
  const q = { ...p };
  for (const [a, b] of [["shLx", "shRx"], ["elLx", "elRx"], ["handLx", "handRx"], ["hipLx", "hipRx"], ["kneeLx", "kneeRx"]]) { q[a] = p[b]; q[b] = p[a]; }
  q.shLy = -p.shRy; q.shRy = -p.shLy; q.shLz = -p.shRz; q.shRz = -p.shLz; q.handLz = -p.handRz; q.handRz = -p.handLz;
  q.hipLz = -p.hipRz; q.hipRz = -p.hipLz;
  q.torsoY = -p.torsoY; q.torsoZ = -p.torsoZ; q.hipsYaw = -p.hipsYaw; q.rootZ = -p.rootZ; q.spin = -p.spin;
  return q;
}

// ---- thế thủ, chạy -----------------------------------------------------------------------------
// Song đao: đao phải chếch lên trước, đao trái cầm thấp chĩa xuống; chân trụ lệch, gối chùng.
const GUARD = P({
  torsoX: 0.1, torsoY: 0.18, hipsYaw: -0.18, hipsY: -0.08,
  shRx: -0.45, shRy: 0.15, shRz: 0.12, elRx: -1.05, handRx: 0.55,
  shLx: 0.05, shLy: -0.1, shLz: -0.28, elLx: -0.75, handLx: 0.95,
  hipLx: -0.38, hipLz: -0.06, kneeLx: 0.42, hipRx: 0.28, hipRz: 0.08, kneeRx: 0.3, headX: -0.05,
});
const RELAX = P({
  torsoX: 0.04, shRx: -0.1, shRz: 0.12, elRx: -0.35, handRx: 0.3, shLx: -0.05, shLz: -0.12, elLx: -0.3, handLx: 0.3,
  hipLx: -0.1, kneeLx: 0.12, hipRx: 0.08, kneeRx: 0.08, hipsY: -0.02,
});

export function idle(t, guard = true) {
  const b = Math.sin(t * 2.1) * 0.025, s = Math.sin(t * 0.9) * 0.04;
  return add({ ...(guard ? GUARD : RELAX) }, { torsoX: b, hipsY: b * 0.8, shRx: -b, shLx: b, torsoY: s, hipsYaw: -s * 0.5 });
}

export function run(phase, speed01 = 1) {
  const s = Math.sin(phase), c = Math.cos(phase), a = speed01;
  const p = zeroPose();
  p.torsoX = 0.32 * a; p.torsoY = -0.16 * a * s; p.hipsYaw = 0.18 * a * s; p.headX = -0.2 * a;
  p.hipsY = -0.04 + 0.07 * a * Math.abs(c) - 0.05 * a;
  p.hipLx = -0.95 * a * s - 0.1; p.hipRx = 0.95 * a * s - 0.1;
  p.kneeLx = 0.15 + 1.45 * a * Math.max(0, c); p.kneeRx = 0.15 + 1.45 * a * Math.max(0, -c);
  // chạy ôm đao: hai tay ngả ra sau, lưỡi đao kéo theo sau lưng
  p.shRx = 0.35 * a + 0.55 * a * s; p.shRz = 0.3; p.elRx = -0.55; p.handRx = 1.25;
  p.shLx = 0.35 * a - 0.55 * a * s; p.shLz = -0.3; p.elLx = -0.55; p.handLx = 1.25;
  return p;
}

// ---- đòn chém ---------------------------------------------------------------------------------
// Chém ngang tay phải: gồng xoắn người sang phải, vung lưỡi quét ngang sang trái, bước chân trái tới.
const SLASH_H = [
  [0, GUARD],
  [0.3, P({ torsoX: 0.05, torsoY: 0.75, hipsYaw: 0.2, hipsY: -0.1, shRx: -1.25, shRy: 1.25, shRz: 0.2, elRx: -0.75, handRx: 1.1,
    shLx: -0.9, shLy: -0.5, elLx: -1.0, handLx: 0.6, hipLx: -0.2, kneeLx: 0.3, hipRx: 0.3, kneeRx: 0.3, headX: -0.05 }), "out"],
  [0.42, P({ torsoX: 0.22, torsoY: -0.85, hipsYaw: -0.35, hipsY: -0.18, shRx: -1.45, shRy: -1.05, shRz: 0.1, elRx: -0.05, handRx: 1.45,
    shLx: 0.35, shLy: 0.2, shLz: -0.4, elLx: -0.5, handLx: 1.1, hipLx: -0.75, kneeLx: 0.65, hipRx: 0.45, kneeRx: 0.25, headX: 0.05 }), "snap"],
  [0.62, P({ torsoX: 0.24, torsoY: -1.0, hipsYaw: -0.4, hipsY: -0.19, shRx: -1.3, shRy: -1.3, shRz: 0.05, elRx: -0.15, handRx: 1.4,
    shLx: 0.4, shLy: 0.2, shLz: -0.45, elLx: -0.5, handLx: 1.1, hipLx: -0.78, kneeLx: 0.68, hipRx: 0.46, kneeRx: 0.26 }), "out"],
  [1, GUARD, "io"],
];
// Chém xéo từ dưới hất lên (tay phải).
const SLASH_UP = [
  [0, GUARD],
  [0.28, P({ torsoX: 0.4, torsoY: -0.55, hipsYaw: -0.2, hipsY: -0.26, shRx: -0.25, shRy: -0.9, shRz: -0.2, elRx: -0.3, handRx: 1.3,
    shLx: -0.8, elLx: -1.1, handLx: 0.7, hipLx: -0.5, kneeLx: 0.8, hipRx: 0.35, kneeRx: 0.6 }), "out"],
  [0.4, P({ torsoX: -0.18, torsoY: 0.55, hipsYaw: 0.25, hipsY: -0.02, shRx: -2.55, shRy: 0.7, shRz: 0.25, elRx: -0.1, handRx: 1.35,
    shLx: 0.3, shLz: -0.5, elLx: -0.5, handLx: 1.0, hipLx: -0.6, kneeLx: 0.3, hipRx: 0.2, kneeRx: 0.1, headX: -0.2 }), "snap"],
  [0.6, P({ torsoX: -0.2, torsoY: 0.65, hipsYaw: 0.28, hipsY: -0.03, shRx: -2.7, shRy: 0.85, shRz: 0.3, elRx: -0.15, handRx: 1.3,
    shLx: 0.35, shLz: -0.5, elLx: -0.5, handLx: 1.0, hipLx: -0.62, kneeLx: 0.3, hipRx: 0.22, kneeRx: 0.1, headX: -0.2 }), "out"],
  [1, GUARD, "io"],
];
// Bổ chéo từ trên xuống (tay phải).
const SLASH_DOWN = [
  [0, GUARD],
  [0.3, P({ torsoX: -0.2, torsoY: 0.5, hipsYaw: 0.1, hipsY: -0.04, shRx: -2.85, shRy: 0.45, shRz: 0.15, elRx: -0.7, handRx: 0.35,
    shLx: -0.8, shLy: -0.4, elLx: -1.0, handLx: 0.7, hipLx: -0.2, kneeLx: 0.2, hipRx: 0.2, kneeRx: 0.2, headX: -0.15 }), "out"],
  [0.42, P({ torsoX: 0.45, torsoY: -0.6, hipsYaw: -0.3, hipsY: -0.24, shRx: -0.55, shRy: -0.75, shRz: -0.1, elRx: -0.05, handRx: 1.3,
    shLx: 0.4, shLz: -0.4, elLx: -0.5, handLx: 1.1, hipLx: -0.8, kneeLx: 0.8, hipRx: 0.5, kneeRx: 0.35, headX: 0.1 }), "snap"],
  [0.62, P({ torsoX: 0.5, torsoY: -0.7, hipsYaw: -0.32, hipsY: -0.25, shRx: -0.4, shRy: -0.85, shRz: -0.12, elRx: -0.1, handRx: 1.3,
    shLx: 0.45, shLz: -0.42, elLx: -0.5, handLx: 1.1, hipLx: -0.82, kneeLx: 0.82, hipRx: 0.5, kneeRx: 0.35 }), "out"],
  [1, GUARD, "io"],
];
const SLASHES = [SLASH_H, SLASH_UP, SLASH_DOWN];

// Chém: side = 1 tay phải, −1 tay trái. high 0 = ngang, 0,6 = hất lên, 1 = bổ xuống. u = 0..1.
export function slash(u, side = 1, high = 0) {
  const ks = SLASHES[high >= 0.9 ? 2 : high >= 0.45 ? 1 : 0];
  const p = keys(u, ks);
  return side > 0 ? p : mirror(p);
}

// Chém kéo hai tay (N5): dang cả hai lưỡi ra sau rồi quét chéo nhau trước ngực.
export function scissor(u) {
  return keys(u, [
    [0, GUARD],
    [0.32, P({ torsoX: -0.12, hipsY: -0.08, shRx: -1.3, shRy: 1.35, elRx: -0.5, handRx: 1.2, shLx: -1.3, shLy: -1.35, elLx: -0.5, handLx: 1.2,
      hipLx: -0.2, kneeLx: 0.25, hipRx: 0.25, kneeRx: 0.25, headX: -0.1 }), "out"],
    [0.45, P({ torsoX: 0.3, hipsY: -0.2, shRx: -1.45, shRy: -0.8, elRx: -0.05, handRx: 1.45, shLx: -1.35, shLy: 0.8, elLx: -0.05, handLx: 1.45,
      hipLx: -0.8, kneeLx: 0.7, hipRx: 0.45, kneeRx: 0.3 }), "snap"],
    [0.65, P({ torsoX: 0.32, hipsY: -0.21, shRx: -1.35, shRy: -1.0, elRx: -0.1, handRx: 1.4, shLx: -1.25, shLy: 1.0, elLx: -0.1, handLx: 1.4,
      hipLx: -0.82, kneeLx: 0.72, hipRx: 0.46, kneeRx: 0.3 }), "out"],
    [1, GUARD, "io"],
  ]);
}

// Hai đao cùng bổ (C1, Đòn Quyết): nhún, bật lên, giơ cao qua đầu, bổ xuống, khuỵu gối tiếp đất.
export function doubleChop(u) {
  return keys(u, [
    [0, GUARD],
    [0.18, P({ torsoX: 0.45, hipsY: -0.32, shRx: 0.5, shLx: 0.5, shRz: 0.3, shLz: -0.3, elRx: -0.3, elLx: -0.3, handRx: 1.3, handLx: 1.3,
      hipLx: -0.7, kneeLx: 1.1, hipRx: -0.4, kneeRx: 1.0 }), "out"],
    [0.4, P({ torsoX: -0.4, hipsY: 0.28, shRx: -3.0, shLx: -3.0, shRz: 0.25, shLz: -0.25, elRx: -0.55, elLx: -0.55, handRx: 0.2, handLx: 0.2,
      hipLx: -0.9, kneeLx: 1.3, hipRx: 0.2, kneeRx: 0.9, headX: -0.3 }), "out"],
    [0.52, P({ torsoX: 0.8, hipsY: -0.42, shRx: -0.35, shLx: -0.35, shRz: 0.12, shLz: -0.12, elRx: -0.05, elLx: -0.05, handRx: 1.35, handLx: 1.35,
      hipLx: -1.1, kneeLx: 1.3, hipRx: 0.55, kneeRx: 1.1, headX: 0.25 }), "snap"],
    [0.72, P({ torsoX: 0.78, hipsY: -0.42, shRx: -0.3, shLx: -0.3, shRz: 0.14, shLz: -0.14, elRx: -0.1, elLx: -0.1, handRx: 1.35, handLx: 1.35,
      hipLx: -1.1, kneeLx: 1.3, hipRx: 0.55, kneeRx: 1.1, headX: 0.2 }), "out"],
    [1, GUARD, "io"],
  ]);
}

// Xoay tròn: n vòng, hai lưỡi dang ngang nối dài cánh tay; nhún lên giữa vòng xoay.
export function spin(u, turns = 1) {
  const s = EASE.io(seg(u, 0.12, 0.85)), inn = seg(u, 0, 0.12), out = seg(u, 0.85, 1);
  const w = Math.min(inn, 1 - out);
  const spread = P({ torsoX: 0.28, hipsY: -0.22, shRx: -1.3, shRy: 1.05, shRz: 0.15, elRx: -0.05, handRx: 1.45,
    shLx: -1.3, shLy: -1.05, shLz: -0.15, elLx: -0.05, handLx: 1.45, hipLx: -0.5, kneeLx: 0.6, hipRx: 0.3, kneeRx: 0.55, headX: 0.05 });
  const p = blendPose(GUARD, spread, EASE.out(w));
  p.spin = -s * turns * Math.PI * 2;
  p.hipsY += Math.sin(s * Math.PI) * 0.12 * Math.min(1, turns);
  p.torsoZ = Math.sin(s * Math.PI * 2 * turns) * 0.08;
  return p;
}

// Hất tung (C2): hạ thấp người, lưỡi kéo lê sau, rồi bật cả người lên, hai lưỡi hất lên trời.
export function uppercut(u) {
  return keys(u, [
    [0, GUARD],
    [0.28, P({ torsoX: 0.6, hipsY: -0.42, shRx: 0.8, shLx: 0.8, shRz: 0.35, shLz: -0.35, elRx: -0.2, elLx: -0.2, handRx: 1.4, handLx: 1.4,
      hipLx: -0.95, kneeLx: 1.4, hipRx: 0.2, kneeRx: 1.2, headX: 0.2 }), "out"],
    [0.42, P({ torsoX: -0.35, hipsY: 0.32, shRx: -3.0, shLx: -3.0, shRz: 0.35, shLz: -0.35, elRx: -0.1, elLx: -0.1, handRx: 1.35, handLx: 1.35,
      hipLx: -0.3, kneeLx: 0.2, hipRx: 0.4, kneeRx: 0.9, headX: -0.35 }), "snap"],
    [0.62, P({ torsoX: -0.3, hipsY: 0.24, shRx: -2.9, shLx: -2.9, shRz: 0.4, shLz: -0.4, elRx: -0.15, elLx: -0.15, handRx: 1.3, handLx: 1.3,
      hipLx: -0.35, kneeLx: 0.3, hipRx: 0.35, kneeRx: 0.8, headX: -0.3 }), "out"],
    [1, GUARD, "io"],
  ]);
}

// Lao tới (lướt, C5, Phá Trận): đổ người ra trước, hai lưỡi kéo ngược sau lưng, rồi vung chéo qua trước.
export function dash(u) {
  return keys(u, [
    [0, GUARD],
    [0.18, P({ torsoX: 0.7, hipsY: -0.3, shRx: 1.0, shLx: 1.0, shRz: 0.45, shLz: -0.45, elRx: -0.2, elLx: -0.2, handRx: 1.4, handLx: 1.4,
      hipLx: -1.0, kneeLx: 0.9, hipRx: 0.7, kneeRx: 0.7, headX: -0.3 }), "out"],
    [0.5, P({ torsoX: 0.72, hipsY: -0.3, shRx: 1.1, shLx: 1.1, shRz: 0.5, shLz: -0.5, elRx: -0.15, elLx: -0.15, handRx: 1.45, handLx: 1.45,
      hipLx: -1.05, kneeLx: 0.85, hipRx: 0.75, kneeRx: 0.75, headX: -0.35 }), "lin"],
    [0.62, P({ torsoX: 0.4, hipsY: -0.28, shRx: -1.4, shLx: -1.4, shRy: -0.9, shLy: 0.9, elRx: -0.05, elLx: -0.05, handRx: 1.45, handLx: 1.45,
      hipLx: -0.9, kneeLx: 0.8, hipRx: 0.5, kneeRx: 0.4 }), "snap"],
    [1, GUARD, "io"],
  ]);
}

// Đỡ: bắt chéo hai lưỡi trước mặt, hạ trọng tâm.
export function block() {
  return P({
    torsoX: 0.18, hipsY: -0.2, shRx: -1.15, shRy: -0.35, shRz: 0.1, elRx: -1.25, handRx: 0.1, handRz: 0.5,
    shLx: -1.15, shLy: 0.35, shLz: -0.1, elLx: -1.25, handLx: 0.1, handLz: -0.5,
    hipLx: -0.4, kneeLx: 0.55, hipRx: 0.3, kneeRx: 0.45, hipLz: -0.08, hipRz: 0.08, headX: 0.05,
  });
}

// Trúng đòn: giật ngửa người, tay văng, lùi nửa bước.
export function hitReact(u) {
  const k = Math.sin(clamp01(u) * Math.PI) ** 0.7;
  return blendPose(GUARD, P({ torsoX: -0.5, torsoY: 0.25, headX: -0.4, hipsY: -0.12, shRx: 0.4, shRz: 0.6, elRx: -0.6, handRx: 0.5,
    shLx: 0.4, shLz: -0.6, elLx: -0.6, handLx: 0.5, hipLx: 0.3, kneeLx: 0.3, hipRx: -0.2, kneeRx: 0.5, rootX: -0.1 }), k);
}

// Né: lộn một vòng về trước, co tròn người.
export function dodgeRoll(u) {
  const r = EASE.io(seg(u, 0.05, 0.9)), k = Math.sin(clamp01(u) * Math.PI);
  const p = P({ torsoX: 0.9 * k, headX: 0.5 * k, hipsY: -0.52 * k, shRx: -1.2 * k, shLx: -1.2 * k, elRx: -1.4 * k, elLx: -1.4 * k,
    handRx: 1.4, handLx: 1.4, hipLx: -1.5 * k, hipRx: -1.3 * k, kneeLx: 2.0 * k, kneeRx: 1.9 * k });
  p.rootX = r * Math.PI * 2;
  return p;
}

// Ngã ngửa rồi nằm.
export function knockdown(u) {
  const k = EASE.out(clamp01(u * 2.2));
  return P({ rootX: -1.45 * k, hipsY: -0.72 * k, torsoX: -0.1 * k, headX: -0.2 * k, shRx: -2.6 * k, shLx: -2.2 * k, shRz: 0.5 * k, shLz: -0.7 * k,
    elRx: -0.3, elLx: -0.5, handRx: 0.6, handLx: 0.6, hipLx: -0.3 * k, kneeLx: 0.6 * k, hipRx: 0.1, kneeRx: 0.2 * k });
}

// Đòn nặng hai tay (Toa Đô đại đao, đòn viền đỏ): giơ cao rồi bổ.
export function heavyChop(u, windup = 0.55) {
  return keys(u, [
    [0, P({ torsoX: 0.1, shRx: -0.6, shLx: -0.6, shRy: -0.3, shLy: 0.5, elRx: -0.9, elLx: -0.9, handRx: 0.4, hipLx: -0.3, kneeLx: 0.3, hipRx: 0.2, kneeRx: 0.2, hipsY: -0.06 })],
    [windup, P({ torsoX: -0.4, torsoY: 0.4, shRx: -2.95, shLx: -2.8, shRy: -0.2, shLy: 0.4, elRx: -0.5, elLx: -0.7, handRx: 0.3,
      hipLx: -0.25, kneeLx: 0.2, hipRx: 0.3, kneeRx: 0.2, hipsY: 0.02, headX: -0.2 }), "out"],
    [windup + 0.12, P({ torsoX: 0.75, torsoY: -0.3, shRx: -0.35, shLx: -0.3, shRy: -0.25, shLy: 0.45, elRx: -0.05, elLx: -0.1, handRx: 1.1,
      hipLx: -0.85, kneeLx: 0.9, hipRx: 0.5, kneeRx: 0.45, hipsY: -0.3, headX: 0.2 }), "snap"],
    [1, P({ torsoX: 0.6, torsoY: -0.25, shRx: -0.4, shLx: -0.35, shRy: -0.25, shLy: 0.45, elRx: -0.1, elLx: -0.1, handRx: 1.05,
      hipLx: -0.8, kneeLx: 0.85, hipRx: 0.45, kneeRx: 0.4, hipsY: -0.26 }), "out"],
  ]);
}

// Quét ngang (đòn thường của sĩ quan): xoắn người lấy đà rồi quét vũ khí dài một vòng trước mặt.
export function sweep(u) {
  return keys(u, [
    [0, P({ torsoX: 0.1, shRx: -0.6, shLx: -0.6, shRy: -0.3, shLy: 0.5, elRx: -0.9, elLx: -0.9, handRx: 0.4, hipLx: -0.3, kneeLx: 0.3, hipRx: 0.2, kneeRx: 0.2, hipsY: -0.06 })],
    [0.4, P({ torsoX: 0.1, torsoY: 1.0, hipsYaw: 0.3, shRx: -1.3, shRy: 1.0, elRx: -0.4, handRx: 1.3, shLx: -1.2, shLy: 0.9, elLx: -0.8,
      hipLx: -0.3, kneeLx: 0.35, hipRx: 0.3, kneeRx: 0.3, hipsY: -0.12 }), "out"],
    [0.55, P({ torsoX: 0.25, torsoY: -1.1, hipsYaw: -0.4, shRx: -1.35, shRy: -1.1, elRx: -0.05, handRx: 1.45, shLx: -1.3, shLy: -0.8, elLx: -0.4,
      hipLx: -0.75, kneeLx: 0.6, hipRx: 0.45, kneeRx: 0.3, hipsY: -0.18 }), "snap"],
    [1, P({ torsoX: 0.2, torsoY: -0.8, hipsYaw: -0.3, shRx: -1.0, shRy: -0.8, elRx: -0.3, handRx: 1.2, shLx: -1.0, shLy: -0.6, elLx: -0.6,
      hipLx: -0.6, kneeLx: 0.5, hipRx: 0.4, kneeRx: 0.3, hipsY: -0.14 }), "io"],
  ]);
}

// Giương cung bắn (tướng H40): tay trái đẩy cung, tay phải kéo dây về má.
export function shoot(u) {
  const d = EASE.out(seg(u, 0, 0.55)), rel = seg(u, 0.55, 0.7);
  return P({ torsoY: -0.55, hipsYaw: 0.3, shLx: -1.5, shLy: 0.5, elLx: -0.05, shRx: -1.5, shRy: 0.35 + 0.5 * d - 0.6 * rel, shRz: -0.2 * d, elRx: -2.4 * d + 1.0 * rel,
    hipLx: -0.3, kneeLx: 0.3, hipRx: 0.25, kneeRx: 0.2, hipsY: -0.06, headX: 0.05 });
}

export function cheer(t) {
  const p = idle(t, false), b = Math.sin(t * 6) * 0.15;
  p.shRx = -2.9 + b; p.elRx = -0.2; p.handRx = 0.2; p.shLx = -2.5 - b; p.elLx = -0.4; p.headX = -0.3;
  return p;
}
