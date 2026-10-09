// core/gfx.js — cài đặt Đồ hoạ (đợt 19c): Tự động / Thấp / Vừa / Cao. Hàm thuần (không DOM, không three), kiểm trong Node
// (tests/gfx.test.mjs); battle/gfx.js đọc máy, dựng renderer theo kết quả.
//
// Mỗi mức: trần tỉ lệ điểm ảnh (renderer.setPixelRatio = min(DPR, trần) × Tỉ lệ render), khử răng cưa MSAA (cờ của ngữ cảnh WebGL —
// chỉ chọn được lúc dựng renderer, mỗi trận một renderer), kiểu bóng. Cao = như trước đợt 19c. Tự động chọn mức theo máy (tên GPU,
// cảm ứng, số nhân, bộ nhớ, số điểm ảnh màn) rồi bật độ phân giải động: khung chậm kéo dài thì hạ tỉ lệ từng nấc (sàn 0,75 × tỉ lệ
// của mức), khung nhanh thì nâng chậm. Chỉ phần vẽ: bước mô phỏng cố định, ctx.project dùng cỡ CSS — trận cho cùng kết quả ở mọi mức.

export const GFX_LEVELS = [{ id: "auto", name: "Tự động" }, { id: "thap", name: "Thấp" }, { id: "vua", name: "Vừa" }, { id: "cao", name: "Cao" }];
export const GFX_NAME = { thap: "Thấp", vua: "Vừa", cao: "Cao" };

// cap: trần tỉ lệ điểm ảnh (capHi: màn DPR ≥ 2); mp: trần điểm ảnh thật của khung vẽ (màn DPR 1,5 cỡ 1707×1067 thì Vừa vẫn hạ — trước
// đây trần 1,5 = DPR nên vẽ đủ 4,1 MP; không bao giờ hạ dưới 1 điểm ảnh mỗi px CSS); msaaBelow: bật MSAA khi tỉ lệ < số này;
// shadow: "pcf" (5 mẫu, mềm) | "basic" (1 mẫu)
export const GFX_PRESETS = {
  thap: { cap: 1, capHi: 1.25, mp: 1.6e6, msaaBelow: 0, shadow: "basic", shadowSize: 1024 },
  vua: { cap: 1.5, mp: 2.4e6, msaaBelow: 1.25, shadow: "pcf", shadowSize: 2048 },
  cao: { cap: 2, msaaBelow: Infinity, shadow: "pcf", shadowSize: 2048 },
};
// giá trị lưu là một mức có thật (không nhận khoá kế thừa của Object như "toString", "__proto__" — bản lưu sửa tay / nhập)
export const isGfx = (v) => typeof v === "string" && Object.hasOwn(GFX_PRESETS, v);

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

// setting: save.settings.graphics; renderScale: thanh "Tỉ lệ render" (hệ số nhân 0,5–1); info.vw, info.vh: cỡ khung vẽ (px CSS — pane
// trong ứng dụng nhỏ hơn màn), thiếu thì cỡ màn.
// → { tier, auto, base (tỉ lệ điểm ảnh khi chưa hạ động), msaa, shadow, shadowSize, dyn (độ phân giải động), floor (tỉ lệ thấp nhất khi hạ) }
export function gfxPlan(setting, info = {}, renderScale = 1) {
  const auto = !isGfx(setting);
  const tier = auto ? detectTier(info) : setting, P = GFX_PRESETS[tier];
  const dpr = info.dpr || 1, rs = Math.min(1, Math.max(0.5, renderScale || 1));
  const px = info.vw > 0 && info.vh > 0 ? info.vw * info.vh : (info.sw || 0) * (info.sh || 0);
  let cap = P.capHi && dpr >= 2 ? P.capHi : P.cap;
  if (P.mp && px > 0) cap = Math.min(cap, Math.max(1, Math.sqrt(P.mp / px)));
  const base = Math.min(dpr, cap) * rs;
  return { tier, auto, base, msaa: base < P.msaaBelow, shadow: P.shadow, shadowSize: P.shadowSize, dyn: auto, floor: base * 0.75 };
}

// Độ phân giải động: frame(ms) mỗi khung với khoảng giữa hai rAF; trả hệ số mới (nhân vào base) khi đổi nấc, không đổi thì 0.
// EMA khoảng khung; > down (18 ms) liền holdDown (1 s) → hạ một nấc; < up (13 ms, chỉ màn > 60 Hz mới đạt) liền holdUp (3 s) → nâng
// một nấc; hai lần đổi cách nhau ≥ settle (2 s — mỗi lần đổi cấp phát lại bộ đệm khung). Khoảng > gap (100 ms: khựng lẻ, trình duyệt bóp
// rAF khi pane ở nền; tab ẩn thì trận tự tạm dừng) bỏ qua — máy chậm 11–20 khung/s vẫn được hạ. Màn 60 Hz không bao giờ < 13 ms: đủ khung
// (≤ down) liền probe (15 s) thì nâng thử một nấc.
// Nâng nào cũng là thử: lỡ khung lại trong probeFail (10) s sau khi hết settle là hỏng — lần thử sau chờ gấp backoff (4), tối đa probeMax
// (240 s: cảnh nặng lâu rồi nhẹ lại vẫn về mức đầy; trước đây hỏng 3 lần là thôi hẳn tới hết trận); đã hỏng thì khung nhanh không còn đủ để
// nâng, chỉ còn thử theo probe (màn 90 Hz vsync lượng tử: GPU 12 ms ở mức đầy ra khung 22,2 ms, mức dưới 11,1 ms "nhanh" — trước đây nâng /
// hạ mỗi ~2,6 s suốt trận; tải dồn từng đợt 2 s nặng mỗi 10 s: nâng sau đợt "trụ" qua cửa sổ 6 s cũ nên đổi mỗi ~5 s). Tải đều: ≤ 5–6 lần
// đổi trong 300 s ở 60–144 Hz; tải dồn từng đợt: ~12 lần trong 900 s. Thử mà trụ được (cảnh nhẹ đi) thì xoá số lần hỏng: lại nâng nhanh
// như đầu trận.
// Hạ phải có ích: hết settle mà EMA không nhanh hơn ≥ gain (10%) lúc bắt đầu hạ (và vẫn chậm) thì hạ tiếp một nấc (vsync: 0,875 có khi
// chưa qua ngưỡng chu kỳ mà 0,75 qua); tới sàn vẫn không nhanh hơn thì trả về mức cũ, khoá hạ tới khi khoảng khung đổi quá ±band (20%) so
// với lúc khoá hoặc tới lần nâng sau — trình duyệt giới hạn 30 khung/s (tiết kiệm pin), nghẽn CPU: hạ độ phân giải không được gì, trước đây
// ngồi ở sàn cả trận.
export class DynRes {
  constructor(o = {}) {
    this.steps = o.steps || [1, 0.875, 0.75];
    this.down = o.down ?? 18; this.up = o.up ?? 13; this.gap = o.gap ?? 100;
    this.settle = o.settle ?? 2; this.holdDown = o.holdDown ?? 1; this.holdUp = o.holdUp ?? 3;
    this.probeWait = o.probe ?? 15; this.probeMax = o.probeMax ?? 240; this.probeFail = o.probeFail ?? 10; this.backoff = o.backoff ?? 4;
    this.gain = o.gain ?? 0.1; this.band = o.band ?? 0.2;
    this.level = 0; this.ema = 0; this.slow = 0; this.fast = 0; this.steady = 0;
    this.t = 0; this.last = -Infinity; this.probeAt = -Infinity; this.fails = 0; this.probe0 = this.probeWait; this.probing = false;
    this.from = -1; this.before = 0; this.block = 0;    // đang kiểm lần hạ: mức trước khi hạ, EMA lúc đó; khoá hạ: EMA lúc khoá (0: không khoá)
  }
  get k() { return this.steps[this.level]; }
  frame(ms) {
    if (!(ms > 0) || ms > this.gap) return 0;
    const s = ms / 1000; this.t += s;
    this.ema = this.ema ? this.ema + (ms - this.ema) * 0.1 : ms;
    this.slow = this.ema > this.down ? this.slow + s : 0;
    this.fast = this.ema < this.up ? this.fast + s : 0;
    this.steady = this.ema <= this.down ? this.steady + s : 0;
    if (this.block && Math.abs(this.ema - this.block) > this.band * this.block) this.block = 0;
    if (this.probing && this.t - this.probeAt >= this.settle + this.probeFail) { this.probing = false; this.fails = 0; this.probeWait = this.probe0; }
    if (this.t - this.last < this.settle) return 0;
    if (this.from >= 0) {                                 // kiểm lần hạ vừa rồi
      if (this.ema <= this.down || this.ema <= this.before * (1 - this.gain)) this.from = -1;
      else if (this.level < this.steps.length - 1) return this.set(this.level + 1);
      else { const l = this.from; this.from = -1; this.block = this.before; return this.set(l); }
    }
    if (this.slow >= this.holdDown && this.level < this.steps.length - 1 && !this.block) {
      if (this.probing) { this.probing = false; this.fails++; this.probeWait = Math.min(this.probeMax, this.probeWait * this.backoff); }
      this.from = this.level; this.before = this.ema;
      return this.set(this.level + 1);
    }
    if (this.level > 0 && ((this.fast >= this.holdUp && !this.fails) || this.steady >= this.probeWait)) {
      this.probeAt = this.t; this.probing = true; this.block = 0;      // khoá đo ở mức cũ: nâng lên lỡ khung thì phải hạ về được
      return this.set(this.level - 1);
    }
    return 0;
  }
  set(l) { this.level = l; this.last = this.t; this.slow = this.fast = this.steady = 0; return this.k; }
}
