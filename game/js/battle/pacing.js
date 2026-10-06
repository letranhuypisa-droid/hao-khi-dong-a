// battle/pacing.js — nhịp bước cố định của vòng lặp trận và phần thuần của nội suy khi vẽ (đợt 19c). Không dùng three: kiểm thử bằng Node
// (tests/pacing.test.mjs). battle.js / arena.js chạy bước qua Pacer; battle/view.js dùng RigSnap, lerpYaw để vẽ giữa hai bước.
//
// Pacer — bộ tích lũy bước cố định STEP = 1/60 s, tối đa MAX_STEPS bước mỗi khung. acc là phần giờ trận chưa chạy (pha).
//   · Tua bằng script (advance, live = false): y hệt bộ tích lũy cũ của battle.js — acc bắt đầu từ 0, khung chạm trần 4 bước thì acc = 0
//     — từng bit, nên tools/baseline-b15.mjs và mọi kịch bản tua cho cùng kết quả như trước.
//   · Vòng rAF thật (live = true): pha đặt giữa bước (acc = STEP/2) ở khung thật đầu tiên và sau tạm dừng (reset), khung chạm trần chỉ bỏ phần
//     thừa rồi đưa pha về giữa bước. Trước đây pha nằm sát biên bước (acc = 0 khi vào trận và sau mọi khung ≥ 67 ms): màn 60 Hz đúng chuẩn với
//     dấu giờ lệch ±0,05–0,3 ms thì 1/4 khung không chạy bước nào, 1/4 khung chạy hai bước (lính, tướng đứng hình rồi nhảy).
//   · Khoá pha (chỉ vòng thật): khung có dt × tốc ≈ k·STEP (màn 60 Hz → k = 1, 30 Hz → 2; lệch ≤ PHASE.tol) thì đẩy acc về giữa bước, mỗi khung
//     tối đa PHASE.max (≤ 1,2% giờ trận) — khung trễ lệch pha (VRR, dấu giờ lệch), màn 59,94 Hz trôi pha dần đều quay lại một bước mỗi khung.
//     Màn 90/120/144 Hz không khoá (dt không gần bội STEP): khung 0 / 1 bước xen nhau, nội suy lo phần nhìn.
//   · alpha = acc / STEP ∈ [0; 1]: vị trí giữa trạng thái đầu bước cuối (0) và hiện tại (1) để vẽ; giờ vẽ = giờ trận − (1 − α)·STEP.
//     Hit-stop cắt ngang vòng bước còn acc ≥ STEP thì α = 1.
//
// RigSnap — ảnh chụp TRS cục bộ (vị trí, quaternion, tỉ lệ) của một cây Object3D (rig tướng, sĩ quan; vật lẻ như vũ khí đặt đất, nhãn cận vệ,
//   thuyền Kế Sách). capture đầu mỗi bước mô phỏng (trước khi bước chạy); apply(α) ghi giá trị nội suy vào chính các nút ngay trước khi vẽ;
//   restore trả lại đúng từng bit ngay sau khi vẽ — mô phỏng không bao giờ thấy giá trị nội suy. Quaternion ghi thẳng vào _x … _w (không gọi
//   onChange) nên góc Euler (rotation) không bị tính lại: trả về y nguyên. Gốc dời quá SNAP_D m trong một bước (dịch chuyển, hồi sinh, nạp
//   checkpoint) thì không nội suy: vẽ ngay chỗ mới, không trượt ngang bản đồ.

export const STEP = 1 / 60, MAX_STEPS = 4;
export const PHASE = { tol: 0.001, gain: 0.1, max: 0.0002 };   // khoá pha: cửa sổ (s), hệ số, bước chỉnh tối đa mỗi khung (s) — ĐỀ XUẤT BẢN THỬ
export const SNAP_D = 1;                                         // m mỗi bước (≈ 60 m/s): dời xa hơn là dịch chuyển tức thời
const TAU = Math.PI * 2;

export class Pacer {
  constructor() { this.acc = 0; this.n = 0; this.live = false; this.mode = 0; }   // mode: 0 chưa chạy, 1 tua, 2 vòng thật
  // tạm dừng xong, tải lại checkpoint: pha về giữa bước (chỉ vòng thật — tua bằng script giữ nguyên acc)
  reset() { if (this.mode === 2) this.acc = STEP / 2; }
  begin(dt, scale = 1, live = false) {
    if (live && this.mode !== 2) this.acc = STEP / 2;            // khung thật đầu tiên
    this.mode = live ? 2 : 1; this.live = live; this.n = 0;
    const d = dt * scale;
    if (live) this.lock(d);
    this.acc += d;
  }
  // khoá pha: dt × tốc gần bội STEP thì đẩy phần dư hiện có về giữa bước
  lock(d) {
    const k = Math.round(d / STEP), r = this.acc;
    if (k < 1 || k > MAX_STEPS || Math.abs(d - k * STEP) > PHASE.tol || !(r >= 0 && r < STEP)) return;
    const e = (STEP / 2 - r) * PHASE.gain;
    this.acc = r + (e > PHASE.max ? PHASE.max : e < -PHASE.max ? -PHASE.max : e);
  }
  next() { if (this.acc >= STEP && this.n < MAX_STEPS) { this.acc -= STEP; this.n++; return true; } return false; }
  end() {
    if (this.n !== MAX_STEPS) return;
    if (!this.live) this.acc = 0;                                // bộ tích lũy cũ (tất định)
    else if (this.acc >= STEP) this.acc = STEP / 2;              // khung giật: bỏ phần thừa, pha về giữa bước
  }
  get alpha() { const a = this.acc; return a >= STEP ? 1 : a > 0 ? a / STEP : 0; }
}

// Nội suy góc (rad) theo đường ngắn nhất.
export function lerpYaw(a, b, t) { let d = b - a; d -= TAU * Math.round(d / TAU); return a + d * t; }

const F = 10;                     // số mỗi nút: vị trí 3, quaternion 4, tỉ lệ 3
function read(N, n, B) {
  for (let i = 0, o = 0; i < n; i++, o += F) {
    const p = N[i].position, q = N[i].quaternion, s = N[i].scale;
    B[o] = p.x; B[o + 1] = p.y; B[o + 2] = p.z; B[o + 3] = q._x; B[o + 4] = q._y; B[o + 5] = q._z; B[o + 6] = q._w; B[o + 7] = s.x; B[o + 8] = s.y; B[o + 9] = s.z;
  }
}

export class RigSnap {
  constructor() { this.root = null; this.nodes = []; this.n = 0; this.prev = new Float64Array(F * 16); this.cur = new Float64Array(F * 16); this.tick = -1; this.on = false; }
  // deep: cả cây (rig); false: chỉ gốc. Duyệt theo bề rộng vào mảng dùng lại, không cấp phát mỗi bước.
  capture(root, deep, tick) {
    const N = this.nodes; let n = 1;
    N[0] = root;
    if (deep) for (let i = 0; i < n; i++) { const c = N[i].children; for (let k = 0; k < c.length; k++) N[n++] = c[k]; }
    N.length = n; this.n = n; this.root = root; this.tick = tick; this.on = false;
    if (this.prev.length < n * F) { this.prev = new Float64Array(n * F * 2); this.cur = new Float64Array(n * F * 2); }
    read(N, n, this.prev);
  }
  // dịch chuyển trong bước vừa chạy: gốc dời quá SNAP_D
  jumped() {
    const p = this.root.position, P = this.prev, dx = p.x - P[0], dy = p.y - P[1], dz = p.z - P[2];
    return !(dx * dx + dy * dy + dz * dz <= SNAP_D * SNAP_D);
  }
  // ghi giá trị nội suy α vào các nút đã chụp; false (không ghi gì) khi dịch chuyển
  apply(a) {
    if (this.on) return true;                            // đã ghi, chưa trả: không đọc giá trị nội suy làm "hiện tại"
    if (this.jumped()) return false;
    const N = this.nodes, n = this.n, P = this.prev, C = this.cur;
    read(N, n, C);
    for (let i = 0, o = 0; i < n; i++, o += F) {
      const nd = N[i], p = nd.position, q = nd.quaternion, s = nd.scale;
      p.x = P[o] + (C[o] - P[o]) * a; p.y = P[o + 1] + (C[o + 1] - P[o + 1]) * a; p.z = P[o + 2] + (C[o + 2] - P[o + 2]) * a;
      const x0 = P[o + 3], y0 = P[o + 4], z0 = P[o + 5], w0 = P[o + 6];
      let x1 = C[o + 3], y1 = C[o + 4], z1 = C[o + 5], w1 = C[o + 6];
      if (x0 !== x1 || y0 !== y1 || z0 !== z1 || w0 !== w1) {
        if (x0 * x1 + y0 * y1 + z0 * z1 + w0 * w1 < 0) { x1 = -x1; y1 = -y1; z1 = -z1; w1 = -w1; }    // đường ngắn
        const x = x0 + (x1 - x0) * a, y = y0 + (y1 - y0) * a, z = z0 + (z1 - z0) * a, w = w0 + (w1 - w0) * a, l = Math.sqrt(x * x + y * y + z * z + w * w) || 1;
        q._x = x / l; q._y = y / l; q._z = z / l; q._w = w / l;
      }
      s.x = P[o + 7] + (C[o + 7] - P[o + 7]) * a; s.y = P[o + 8] + (C[o + 8] - P[o + 8]) * a; s.z = P[o + 9] + (C[o + 9] - P[o + 9]) * a;
    }
    this.on = true;
    return true;
  }
  restore() {
    if (!this.on) return;
    const N = this.nodes, C = this.cur;
    for (let i = 0, o = 0; i < this.n; i++, o += F) {
      const nd = N[i], p = nd.position, q = nd.quaternion, s = nd.scale;
      p.x = C[o]; p.y = C[o + 1]; p.z = C[o + 2]; q._x = C[o + 3]; q._y = C[o + 4]; q._z = C[o + 5]; q._w = C[o + 6]; s.x = C[o + 7]; s.y = C[o + 8]; s.z = C[o + 9];
    }
    this.on = false;
  }
  // vị trí gốc nội suy (camera, mặt trời) vào out { x, y, z } — không ghi vào nút
  rootAt(a, out) {
    const p = this.root.position, P = this.prev;
    if (this.on || this.jumped()) { out.x = p.x; out.y = p.y; out.z = p.z; return out; }
    out.x = P[0] + (p.x - P[0]) * a; out.y = P[1] + (p.y - P[1]) * a; out.z = P[2] + (p.z - P[2]) * a;
    return out;
  }
}
