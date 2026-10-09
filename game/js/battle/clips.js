// battle/clips.js — clip hoạt ảnh xương người đã nướng sẵn (tools/bake-clips.mjs → assets/anim/clips.json, nguồn Quaternius UAL CC0 /
// Mixamo) phát lại thành tư thế rig game (bảng góc của anim.js). anim.js hỏi module này trước, không có clip (đang tải, lỗi mạng,
// chạy trong Node, `?noclips`) thì nó dùng hoạt ảnh thủ tục như cũ — nên mọi nơi gọi A.run / A.idle / A.hitReact / A.dodgeRoll /
// A.knockdown tự hưởng clip, không phải sửa từng chỗ.
//
// Clip là mảng phẳng n khung × KEYS kênh. Vòng lặp (loop) nối khung cuối về khung đầu; clip chạy bộ đã dịch pha lúc nướng (khung 0 =
// chân R chạm đất phía trước) nên trộn walk / jog theo tốc độ dùng chung một pha. `speed` là tốc độ chân trụ (đơn vị rig / s,
// nhân cỡ rig ra m/s): phát clip với đúng nhịp tỉ lệ tốc độ thì chân trụ không trượt.

const BASE = new URL("../../assets/anim/", import.meta.url);
const TAU = Math.PI * 2;

let LIB = null, PENDING = null;
export const clipsOn = { value: typeof location === "undefined" || !/[?&]noclips\b/.test(location.search) };

export async function loadClips() {
  if (LIB || typeof fetch === "undefined") return LIB;
  PENDING ||= fetch(new URL("clips.json", BASE)).then((r) => (r.ok ? r.json() : null)).then((j) => {
    if (j) { LIB = prepare(j); }
    return LIB;
  }).catch((e) => { console.warn("clip hoạt ảnh", e.message); return null; });
  return PENDING;
}
// Cho kiểm thử trong Node: nạp thẳng đối tượng đã đọc từ clips.json.
export function setClips(json) { LIB = json ? prepare(json) : null; }
export const clipsReady = () => !!LIB && clipsOn.value;

function prepare(j) {
  const nk = j.keys.length, clips = {};
  for (const [name, c] of Object.entries(j.clips)) {
    const data = Float32Array.from(c.data), mean = new Float32Array(nk);
    for (let i = 0; i < c.n; i++) for (let k = 0; k < nk; k++) mean[k] += data[i * nk + k] / c.n;
    clips[name] = { ...c, data, mean, nk, stride: c.speed ? c.speed * c.dur : 0 };
  }
  return { keys: j.keys, clips };
}

// Nhóm kênh để lớp trộn theo phần cơ thể.
export const BODY = ["rootX", "hipsYaw", "rootZ", "hipsY", "torsoX", "torsoY", "torsoZ", "headX"];
export const LEGS = ["hipLx", "hipLz", "kneeLx", "hipRx", "hipRz", "kneeRx"];
export const ARMS = ["shLx", "shLy", "shLz", "elLx", "shRx", "shRy", "shRz", "elRx"];
export const HANDS = ["handLx", "handLz", "handRx", "handRz"];
export const LOWER = [...BODY, ...LEGS];
export const FULL = [...BODY, ...LEGS, ...ARMS];          // trừ cổ tay: lưỡi vũ khí cầm theo tư thế cổ tay của lớp vũ khí (rig-motion.js)

// Mẫu một clip tại khung thực f (0…n, vòng lặp tự quấn) → out[key] = giá trị (nội suy tuyến tính). keys: chỉ ghi các kênh này
// (mặc định mọi kênh); w: trọng số trộn vào out (1 = ghi đè, <1 = trộn với giá trị đang có).
function sampleFrame(c, f, out, keys, w = 1) {
  const n = c.n, nk = c.nk;
  let i0, i1, a;
  if (c.loop) { f = ((f % n) + n) % n; i0 = Math.floor(f); i1 = (i0 + 1) % n; a = f - i0; }
  else { f = f < 0 ? 0 : f > n - 1 ? n - 1 : f; i0 = Math.floor(f); i1 = Math.min(n - 1, i0 + 1); a = f - i0; }
  const d = c.data, K = LIB.keys;
  for (let k = 0; k < nk; k++) {
    const key = K[k];
    if (keys && !keys.includes(key)) continue;
    const v = d[i0 * nk + k] + (d[i1 * nk + k] - d[i0 * nk + k]) * a;
    out[key] = w >= 1 ? v : (out[key] || 0) + (v - (out[key] || 0)) * w;
  }
  return out;
}

// Cộng vào out phần LỆCH của clip so với trung bình cả vòng (gain × (mẫu − trung bình)): dáng đứng vẫn là thế thủ của game (hướng mặt,
// hướng vũ khí), clip chỉ thêm chuyển động sống — dồn trọng lượng, thở, đảo vai. Dùng cho clip đứng (idle).
export function addDeltaT(name, t, out, keys = null, gain = 1) {
  const c = LIB.clips[name], tmp = sampleFrame(c, (t / c.dur) * c.n, {}, keys), K = LIB.keys;
  for (const key in tmp) out[key] = (out[key] || 0) + (tmp[key] - c.mean[K.indexOf(key)]) * gain;
  return out;
}

// { dur, strike (s, lúc tay vung nhanh nhất), hand ("L" | "R" game, tay vung nhanh nhất), sword (tay giải theo gươm hai tay) } của clip; null nếu không có.
export const info = (name) => { const c = LIB?.clips[name]; return c ? { dur: c.dur, strike: c.strike, start: c.start || 0, hand: c.hand, sword: !!c.sword } : null; };
export const has = (name) => !!LIB && !!LIB.clips[name];
export const clipDur = (name) => LIB?.clips[name]?.dur ?? 0;

// Mẫu theo giây t (vòng lặp quấn, clip thường giữ khung cuối).
export function sampleT(name, t, out, keys = null, w = 1) {
  const c = LIB.clips[name]; return sampleFrame(c, (t / c.dur) * c.n, out, keys, w);
}
// Mẫu theo tiến độ u ∈ [0,1] của cả clip (đòn, né, trúng đòn: hàm tư thế nhận u).
export function sampleU(name, u, out, keys = null, w = 1) {
  const c = LIB.clips[name], uu = u < 0 ? 0 : u > 1 ? 1 : u;
  return sampleFrame(c, c.loop ? uu * c.n : uu * (c.n - 1), out, keys, w);
}

// ---- chạy / đi bộ theo tốc độ ----------------------------------------------------------------------------------------------------
// Tầng chạy bộ, theo tốc độ chân trụ tăng dần. Tốc độ rig v = tốc độ thế giới / cỡ rig.
const LOCO = ["walk", "jog"];                   // sprint đã bỏ: chạm đất 3–4 khung, chân trượt ≥ 22% ở mọi tốc độ (xem bake-clips.mjs CLIPS); chạy nhanh hơn jog thì tăng nhịp
function bracket(v) {
  const L = LOCO.map((n) => LIB.clips[n]).filter(Boolean);
  if (!L.length) return null;
  if (v <= L[0].speed) return [L[0], L[0], 0];
  for (let i = 1; i < L.length; i++) if (v <= L[i].speed) return [L[i - 1], L[i], (v - L[i - 1].speed) / (L[i].speed - L[i - 1].speed)];
  const e = L[L.length - 1]; return [e, e, 0];
}
// Nhịp pha (rad/s, 2π = một vòng 2 bước) cho tốc độ rig v: quãng đường một vòng của clip (speed × dur) nội suy theo cặp clip kề.
export function locoRate(v) {
  const b = bracket(v); if (!b) return 0;
  const stride = b[0].stride + (b[1].stride - b[0].stride) * b[2];
  return stride > 0 ? (TAU * Math.max(0.05, v)) / stride : 0;
}
// Tư thế chạy tại pha phase (rad) và tốc độ rig v → ghi các kênh keys vào out.
export function locoPose(phase, v, out, keys = LOWER) {
  const b = bracket(v), u = (((phase / TAU) % 1) + 1) % 1;
  sampleFrame(b[0], u * b[0].n, out, keys);
  if (b[2] > 0) sampleFrame(b[1], u * b[1].n, out, keys, b[2]);
  return out;
}
