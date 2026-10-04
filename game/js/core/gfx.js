// core/gfx.js — cài đặt Đồ hoạ (đợt 19c): Tự động / Thấp / Vừa / Cao. Hàm thuần (không DOM, không three), kiểm trong Node
// (tests/gfx.test.mjs); battle/gfx.js đọc máy, dựng renderer theo kết quả.
//
// Mỗi mức: trần tỉ lệ điểm ảnh (renderer.setPixelRatio = min(DPR, trần) × Tỉ lệ render), khử răng cưa MSAA (cờ của ngữ cảnh WebGL —
// chỉ chọn được lúc dựng renderer, mỗi trận một renderer), kiểu bóng. Cao = như trước đợt 19c. Tự động chọn mức theo máy (tên GPU,
// cảm ứng, số nhân, bộ nhớ, số điểm ảnh màn) rồi bật độ phân giải động: khung chậm kéo dài thì hạ tỉ lệ từng nấc (sàn 0,75 × tỉ lệ
// của mức), khung nhanh thì nâng chậm. Chỉ phần vẽ: bước mô phỏng cố định, ctx.project dùng cỡ CSS — trận cho cùng kết quả ở mọi mức.

export const GFX_LEVELS = [{ id: "auto", name: "Tự động" }, { id: "thap", name: "Thấp" }, { id: "vua", name: "Vừa" }, { id: "cao", name: "Cao" }];
export const GFX_NAME = { thap: "Thấp", vua: "Vừa", cao: "Cao" };

// cap: trần tỉ lệ điểm ảnh (capHi: màn DPR ≥ 2); msaaBelow: bật MSAA khi tỉ lệ < số này; shadow: "pcf" (5 mẫu, mềm) | "basic" (1 mẫu)
export const GFX_PRESETS = {
  thap: { cap: 1, capHi: 1.25, msaaBelow: 0, shadow: "basic", shadowSize: 1024 },
  vua: { cap: 1.5, msaaBelow: 1.25, shadow: "pcf", shadowSize: 2048 },
  cao: { cap: 2, msaaBelow: Infinity, shadow: "pcf", shadowSize: 2048 },
};

// Tên GPU (WEBGL_debug_renderer_info, thường qua ANGLE). Rời trước tích hợp: "Arc(TM) A770", "Arc(TM) B580" là card rời, "Arc(TM) Graphics"
// là tích hợp; AMD tích hợp có khi không ghi "(TM)" ("AMD Radeon 780M Graphics").
const SOFT = /swiftshader|llvmpipe|softpipe|software|basic render/i;
const MOBILE_GPU = /adreno|mali|powervr|apple gpu|videocore|immortalis|xclipse|tegra/i;
const DISCRETE = /nvidia|geforce|quadro|radeon rx|radeon pro|radeon r9|\brx ?\d{3,4}|arc\(tm\) [ab]\d|\barc [ab]\d|firepro/i;
const INTEGRATED = /intel|radeon\(tm\) graphics|radeon graphics|vega|radeon\(tm\) \d{3}m|\b[678]\d0m\b|apple m\d/i;

// info: { dpr, sw, sh (màn, px CSS), coarse (any-pointer: coarse), cores, mem (GB, Chrome), gpu (tên), mobile (UA) } → "thap" | "vua" | "cao"
export function detectTier(info = {}) {
  const gpu = String(info.gpu || "");
  if (SOFT.test(gpu)) return "thap";
  if ((info.mem && info.mem <= 2) || (info.cores && info.cores <= 2)) return "thap";
  if (MOBILE_GPU.test(gpu) || info.mobile) return (info.mem && info.mem <= 3) || (info.cores && info.cores <= 3) ? "thap" : "vua";
  if (DISCRETE.test(gpu)) return "cao";
  if (INTEGRATED.test(gpu)) return "vua";
  // không đọc được tên GPU: màn cảm ứng hoặc màn mật độ cao nhiều điểm ảnh (> 4,5 MP thật) → Vừa
  const px = (info.sw || 0) * (info.sh || 0) * (info.dpr || 1) ** 2;
  return info.coarse || px > 4.5e6 ? "vua" : "cao";
}

// setting: save.settings.graphics; renderScale: thanh "Tỉ lệ render" (hệ số nhân 0,5–1).
// → { tier, auto, base (tỉ lệ điểm ảnh khi chưa hạ động), msaa, shadow, shadowSize, dyn (độ phân giải động), floor (tỉ lệ thấp nhất khi hạ) }
export function gfxPlan(setting, info = {}, renderScale = 1) {
  const auto = !GFX_PRESETS[setting];
  const tier = auto ? detectTier(info) : setting, P = GFX_PRESETS[tier];
  const dpr = info.dpr || 1, rs = Math.min(1, Math.max(0.5, renderScale || 1));
  const cap = P.capHi && dpr >= 2 ? P.capHi : P.cap;
  const base = Math.min(dpr, cap) * rs;
  return { tier, auto, base, msaa: base < P.msaaBelow, shadow: P.shadow, shadowSize: P.shadowSize, dyn: auto, floor: base * 0.75 };
}

// Độ phân giải động: frame(ms) mỗi khung với khoảng giữa hai rAF; trả hệ số mới (nhân vào base) khi đổi nấc, không đổi thì 0.
// EMA khoảng khung; > down (18 ms) liền holdDown (1 s) → hạ một nấc; < up (13 ms, chỉ màn > 60 Hz mới đạt) liền holdUp (3 s) → nâng
// một nấc; hai lần đổi cách nhau ≥ settle (2 s — mỗi lần đổi cấp phát lại bộ đệm khung). Khoảng > gap (100 ms: khựng lẻ, trình duyệt bóp
// rAF khi pane ở nền; tab ẩn thì trận tự tạm dừng) bỏ qua — máy chậm 11–20 khung/s vẫn được hạ. Màn 60 Hz không bao giờ < 13 ms: đủ khung
// (≤ down) liền probe (15 s) thì nâng thử một nấc; lỡ khung lại ngay (≤ probeFail s sau khi hết settle) thì hạ và chờ gấp đôi, thử hỏng
// probeTries lần thì thôi hẳn — đổi mức có hạn, không dao động.
export class DynRes {
  constructor(o = {}) {
    this.steps = o.steps || [1, 0.875, 0.75];
    this.down = o.down ?? 18; this.up = o.up ?? 13; this.gap = o.gap ?? 100;
    this.settle = o.settle ?? 2; this.holdDown = o.holdDown ?? 1; this.holdUp = o.holdUp ?? 3;
    this.probeWait = o.probe ?? 15; this.probeTries = o.probeTries ?? 4; this.probeFail = o.probeFail ?? 4;
    this.level = 0; this.ema = 0; this.slow = 0; this.fast = 0; this.steady = 0;
    this.t = 0; this.last = -Infinity; this.probeAt = -Infinity; this.fails = 0;
  }
  get k() { return this.steps[this.level]; }
  frame(ms) {
    if (!(ms > 0) || ms > this.gap) return 0;
    const s = ms / 1000; this.t += s;
    this.ema = this.ema ? this.ema + (ms - this.ema) * 0.1 : ms;
    this.slow = this.ema > this.down ? this.slow + s : 0;
    this.fast = this.ema < this.up ? this.fast + s : 0;
    this.steady = this.ema <= this.down ? this.steady + s : 0;
    if (this.t - this.last < this.settle) return 0;
    if (this.slow >= this.holdDown && this.level < this.steps.length - 1) {
      if (this.t - this.probeAt < this.settle + this.probeFail) { this.fails++; this.probeWait = this.fails >= this.probeTries ? Infinity : this.probeWait * 2; }
      return this.set(this.level + 1);
    }
    if (this.level > 0 && (this.fast >= this.holdUp || this.steady >= this.probeWait)) {
      this.probeAt = this.fast >= this.holdUp ? -Infinity : this.t;
      return this.set(this.level - 1);
    }
    return 0;
  }
  set(l) { this.level = l; this.last = this.t; this.slow = this.fast = this.steady = 0; return this.k; }
}
