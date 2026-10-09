// tests/gfx.test.mjs — cài đặt Đồ hoạ (đợt 19c, core/gfx.js): Tự động chọn mức theo máy (GPU, cảm ứng, bộ nhớ), mỗi mức giới hạn tỉ lệ
// điểm ảnh (và số điểm ảnh thật) / khử răng cưa / kiểu bóng, độ phân giải động (hạ khi khung chậm và hạ có ích, nâng chậm, không dao động
// ở mọi tần số màn); bản lưu cũ có graphics = "auto", giá trị lạ (kể cả khoá kế thừa của Object) là Tự động.
//   node game/tests/gfx.test.mjs
import assert from "node:assert/strict";
import { GFX_LEVELS, GFX_PRESETS, detectTier, gfxPlan, DynRes, isGfx } from "../js/core/gfx.js";
import { newSave, migrate } from "../js/meta/progress.js";

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log("  ok  " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + (e.stack || e.message)); }
}

// máy mẫu
const Z1E = { dpr: 2, sw: 1280, sh: 800, coarse: true, cores: 16, mem: 8, gpu: "ANGLE (AMD, AMD Radeon(TM) Graphics (0x000015BF) Direct3D11 vs_5_0 ps_5_0, D3D11)" };
const RTX = { dpr: 1, sw: 1920, sh: 1080, coarse: false, cores: 12, mem: 8, gpu: "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 (0x00002504) Direct3D11 vs_5_0 ps_5_0, D3D11)" };
const SWS = { dpr: 1, sw: 1280, sh: 720, coarse: false, cores: 8, mem: 8, gpu: "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)" };
const PHONE = { dpr: 2.625, sw: 412, sh: 915, coarse: true, cores: 8, mem: 8, gpu: "ANGLE (Qualcomm, Adreno (TM) 650, OpenGL ES 3.2)", mobile: true };
const OLDPHONE = { dpr: 2, sw: 360, sh: 740, coarse: true, cores: 8, mem: 2, gpu: "Mali-G52", mobile: true };

console.log("Mức Đồ hoạ");
t("bốn lựa chọn, tên tiếng Việt, mặc định Tự động", () => {
  assert.deepEqual(GFX_LEVELS.map((l) => l.id), ["auto", "thap", "vua", "cao"]);
  assert.deepEqual(GFX_LEVELS.map((l) => l.name), ["Tự động", "Thấp", "Vừa", "Cao"]);
  assert.equal(newSave().settings.graphics, "auto");
});
t("bản lưu cũ (chưa có graphics) nhận Tự động, giữ Tỉ lệ render", () => {
  const s = migrate({ settings: { troops: "cao", renderScale: 0.8, shadows: false } });
  assert.equal(s.settings.graphics, "auto");
  assert.equal(s.settings.renderScale, 0.8);
  assert.equal(s.settings.shadows, false);
  assert.equal(migrate({ settings: { graphics: "thap" } }).settings.graphics, "thap");
});

console.log("Tự động: chọn mức theo máy");
t("máy cầm tay Z1 Extreme (GPU tích hợp 780M, màn 2560×1600 cảm ứng) → Vừa", () => {
  assert.equal(detectTier(Z1E), "vua");
  assert.equal(detectTier({ ...Z1E, gpu: "AMD Radeon(TM) 780M" }), "vua");
});
t("GPU rời (RTX, Radeon RX, Arc A / B) → Cao", () => {
  assert.equal(detectTier(RTX), "cao");
  assert.equal(detectTier({ ...RTX, gpu: "ANGLE (AMD, AMD Radeon RX 6700 XT Direct3D11 vs_5_0 ps_5_0, D3D11)" }), "cao");
  assert.equal(detectTier({ ...RTX, gpu: "ANGLE (Intel, Intel(R) Arc(TM) A770 Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)" }), "cao");
  assert.equal(detectTier({ ...RTX, gpu: "ANGLE (Intel, Intel(R) Arc(TM) B580 Graphics (0x0000E20B) Direct3D11 vs_5_0 ps_5_0, D3D11)" }), "cao");
  assert.equal(detectTier({ ...RTX, gpu: "ANGLE (AMD, AMD Radeon RX 7600M XT Direct3D11 vs_5_0 ps_5_0, D3D11)" }), "cao");
});
t("GPU tích hợp AMD đủ kiểu tên (có / không \"(TM)\", 660M–890M) trên máy không cảm ứng → Vừa", () => {
  for (const gpu of ["ANGLE (AMD, AMD Radeon 780M Graphics (0x000015BF) Direct3D11 vs_5_0 ps_5_0, D3D11)",
    "ANGLE (AMD, AMD Radeon 890M Graphics (0x0000150E) Direct3D11 vs_5_0 ps_5_0, D3D11)", "AMD Radeon(TM) 880M Graphics",
    "ANGLE (AMD, AMD Radeon 660M Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)", "ANGLE (AMD, AMD Radeon(TM) Vega 8 Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)"])
    assert.equal(detectTier({ ...RTX, gpu }), "vua", gpu);
});
t("GPU tích hợp (Intel UHD / Iris, Apple M, Radeon Graphics, Arc tích hợp) → Vừa", () => {
  for (const gpu of ["ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)", "ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)",
    "ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)", "ANGLE (Intel, Intel(R) Arc(TM) Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)"])
    assert.equal(detectTier({ ...RTX, gpu }), "vua", gpu);
});
t("trình vẽ phần mềm (SwiftShader, llvmpipe) → Thấp", () => {
  assert.equal(detectTier(SWS), "thap");
  assert.equal(detectTier({ ...RTX, gpu: "llvmpipe (LLVM 15.0.7, 256 bits)" }), "thap");
});
t("điện thoại: GPU di động khoẻ → Vừa; bộ nhớ ≤ 2 GB → Thấp", () => {
  assert.equal(detectTier(PHONE), "vua");
  assert.equal(detectTier({ ...PHONE, gpu: "Apple GPU", mem: 0, cores: 0 }), "vua");    // Safari: không có deviceMemory
  assert.equal(detectTier(OLDPHONE), "thap");
});
t("máy 2 nhân hoặc 2 GB → Thấp dù GPU rời", () => {
  assert.equal(detectTier({ ...RTX, cores: 2 }), "thap");
  assert.equal(detectTier({ ...RTX, mem: 2 }), "thap");
});
t("không đọc được tên GPU: cảm ứng hoặc màn nhiều điểm ảnh → Vừa, còn lại Cao", () => {
  assert.equal(detectTier({ ...RTX, gpu: "" }), "cao");
  assert.equal(detectTier({ ...RTX, gpu: "", coarse: true }), "vua");
  assert.equal(detectTier({ ...RTX, gpu: "", dpr: 2, sw: 1920, sh: 1200 }), "vua");
});

console.log("Mức → tỉ lệ điểm ảnh, khử răng cưa, bóng");
t("Cao = như trước đợt 19c: tỉ lệ tới 2, MSAA bật, bóng PCF 2048, không độ phân giải động", () => {
  const p = gfxPlan("cao", Z1E, 1);
  assert.equal(p.tier, "cao"); assert.equal(p.base, 2); assert.equal(p.msaa, true);
  assert.equal(p.shadow, "pcf"); assert.equal(p.shadowSize, 2048); assert.equal(p.dyn, false);
  assert.equal(gfxPlan("cao", { ...Z1E, dpr: 3 }, 1).base, 2);
  assert.equal(gfxPlan("cao", { ...Z1E, dpr: 1 }, 0.75).base, 0.75);
});
t("Vừa: tỉ lệ tối đa 1,5; MSAA tắt khi tỉ lệ ≥ 1,25; bóng PCF", () => {
  const p = gfxPlan("vua", Z1E, 1);
  assert.equal(p.base, 1.5); assert.equal(p.msaa, false); assert.equal(p.shadow, "pcf");
  assert.equal(gfxPlan("vua", { ...Z1E, dpr: 1 }, 1).msaa, true);
  assert.equal(gfxPlan("vua", { ...Z1E, dpr: 1.25 }, 1).msaa, false);
  assert.equal(gfxPlan("vua", Z1E, 0.75).base, 1.125);
  assert.equal(gfxPlan("vua", Z1E, 0.75).msaa, true);
});
t("Thấp: tỉ lệ 1 (màn mật độ cao 1,25), MSAA tắt, bóng Basic 1024", () => {
  const p = gfxPlan("thap", Z1E, 1);
  assert.equal(p.base, 1.25); assert.equal(p.msaa, false); assert.equal(p.shadow, "basic"); assert.equal(p.shadowSize, 1024);
  assert.equal(gfxPlan("thap", { ...Z1E, dpr: 1 }, 1).base, 1);
  assert.equal(gfxPlan("thap", { ...Z1E, dpr: 1.5 }, 1).base, 1);
});
t("Tự động: mức theo máy + độ phân giải động, sàn 0,75 × tỉ lệ của mức", () => {
  const p = gfxPlan("auto", Z1E, 1);
  assert.equal(p.auto, true); assert.equal(p.tier, "vua"); assert.equal(p.dyn, true);
  assert.equal(p.base, 1.5); assert.equal(p.floor, 1.125);
  assert.equal(gfxPlan(undefined, SWS, 1).tier, "thap");
  assert.equal(gfxPlan("lạ", RTX, 1).auto, true);
});
t("giá trị lưu trùng khoá kế thừa của Object (\"toString\", \"__proto__\"… — bản lưu sửa tay / nhập) → Tự động, tỉ lệ là số", () => {
  for (const v of ["toString", "constructor", "__proto__", "hasOwnProperty", "valueOf", null, "", 3, "high"]) {
    const p = gfxPlan(v, RTX, 1);
    assert.equal(p.auto, true, String(v)); assert.equal(p.tier, "cao", String(v)); assert.ok(Number.isFinite(p.base) && p.base > 0, `${v}: ${p.base}`);
    assert.equal(isGfx(v), false, String(v));
  }
  for (const v of ["thap", "vua", "cao"]) assert.equal(isGfx(v), true, v);
  assert.equal(isGfx("auto"), false);
});
t("Vừa giới hạn cả số điểm ảnh thật (≤ 2,4 MP): màn DPR 1,5 cỡ 1707×1067 không còn vẽ đủ 4,1 MP, có MSAA lại", () => {
  const M = { ...Z1E, dpr: 1.5, sw: 1707, sh: 1067 }, p = gfxPlan("vua", M, 1);
  const mp = (p.base * 1707) * (p.base * 1067);
  assert.ok(mp <= 2.45e6 && mp > 2.3e6, `${(mp / 1e6).toFixed(2)} MP`);
  assert.equal(p.msaa, true);
  assert.equal(gfxPlan("auto", M, 1).base, p.base);
  assert.equal(gfxPlan("vua", Z1E, 1).base, 1.5);                                         // DPR 2, 1280×800: 1920×1200 = 2,3 MP như cũ
  assert.equal(gfxPlan("vua", { ...M, vw: 1000, vh: 700 }, 1).base, 1.5);                 // pane nhỏ trong ứng dụng: khung vẽ nhỏ, khỏi hạ
  assert.equal(gfxPlan("vua", { ...RTX, sw: 2560, sh: 1440 }, 1).base, 1);                // không hạ dưới 1 điểm ảnh mỗi px CSS
  assert.equal(gfxPlan("thap", { ...RTX, dpr: 2 }, 1).base, 1);                           // Thấp ≤ 1,6 MP: màn 1920×1080 @2× vẽ 1×
  assert.equal(gfxPlan("cao", M, 1).base, 1.5);                                           // Cao không giới hạn số điểm ảnh
});
t("Tỉ lệ render ngoài 0,5–1 bị kẹp; thiếu thì 1", () => {
  assert.equal(gfxPlan("cao", RTX, undefined).base, 1);
  assert.equal(gfxPlan("cao", RTX, 0.2).base, 0.5);
  assert.equal(gfxPlan("cao", RTX, 3).base, 1);
});
t("bảng mức đủ ba mức, mức thấp không bao giờ nét hơn mức cao", () => {
  assert.deepEqual(Object.keys(GFX_PRESETS).sort(), ["cao", "thap", "vua"]);
  for (const scr of [[1920, 1080], [1280, 800], [1707, 1067], [2560, 1440], [412, 915]]) for (const dpr of [1, 1.25, 1.5, 2, 3]) {
    const b = ["thap", "vua", "cao"].map((k) => gfxPlan(k, { ...RTX, dpr, sw: scr[0], sh: scr[1] }, 1).base);
    assert.ok(b[0] <= b[1] && b[1] <= b[2], `${scr} dpr ${dpr}: ${b}`);
  }
});

console.log("Độ phân giải động");
const run = (d, ms, sec) => { const ch = []; let tt = 0; while (tt < sec) { const k = d.frame(ms); tt += ms / 1000; if (k) ch.push([+tt.toFixed(2), k]); } return ch; };
// Máy mẫu: GPU làm gpu ms mỗi khung ở mức đầy (tỉ lệ số điểm ảnh, k²), CPU cpu ms; vsync hz: khoảng khung là bội của chu kỳ màn; cap: trình
// duyệt giới hạn khung/s (tiết kiệm pin). Khoảng khung đổi theo mức — hạ độ phân giải có ích hay không tuỳ máy.
const frameMs = (d, m) => {
  const w = Math.max(m.cpu || 0, m.gpu * d.k * d.k), vs = m.hz ? 1000 / m.hz : 0;
  const iv = vs ? Math.ceil(w / vs - 1e-9) * vs : w;
  return m.cap ? Math.max(iv, 1000 / m.cap) : iv;
};
const sim = (d, m, sec) => { const ch = []; let tt = 0; while (tt < sec) { const ms = frameMs(d, m), k = d.frame(ms); tt += ms / 1000; if (k) ch.push([+tt.toFixed(2), k]); } return ch; };
t("60 Hz đủ khung (16,7 ms) ở mức đầy: không đổi", () => {
  const d = new DynRes(); assert.deepEqual(run(d, 16.7, 120), []); assert.equal(d.k, 1);
});
t("GPU chậm (30 ms ở mức đầy): hạ từng nấc, cách nhau ≥ 2 s, dừng ở sàn 0,75", () => {
  const d = new DynRes(), ch = sim(d, { gpu: 30 }, 12);
  assert.deepEqual(ch.map((c) => c[1]), [0.875, 0.75]);
  assert.ok(ch[0][0] >= 1 && ch[1][0] - ch[0][0] >= 2, JSON.stringify(ch));
  assert.equal(d.k, 0.75);
});
t("một cú khựng lẻ hoặc khoảng > 100 ms (rAF bị bóp khi pane ở nền) không hạ", () => {
  const d = new DynRes();
  run(d, 16.7, 5); d.frame(300); d.frame(120); run(d, 16.7, 5);
  for (let i = 0; i < 100; i++) d.frame(250);            // trình duyệt bóp rAF khi pane ở nền
  run(d, 16.7, 5);
  assert.equal(d.k, 1);
  const e = new DynRes(); run(e, 16.7, 3); for (let i = 0; i < 6; i++) e.frame(33.4); run(e, 16.7, 3);   // 6 khung lỡ liền: chưa đủ 1 s chậm
  assert.equal(e.k, 1);
});
t("máy rất chậm (60–90 ms mỗi khung) vẫn hạ tới sàn", () => {
  const d = new DynRes(); sim(d, { gpu: 60 }, 8); assert.equal(d.k, 0.75);
  const e = new DynRes(); sim(e, { gpu: 90 }, 8); assert.equal(e.k, 0.75);
});
t("màn 120 Hz: khung nhanh (< 13 ms) thì nâng lại chậm (≥ 3 s mỗi nấc)", () => {
  const d = new DynRes(); sim(d, { gpu: 30 }, 10); assert.equal(d.k, 0.75);
  const ch = run(d, 8.3, 20);
  assert.deepEqual(ch.map((c) => c[1]), [0.875, 1]);
  assert.ok(ch[0][0] >= 3 && ch[1][0] - ch[0][0] >= 3, JSON.stringify(ch));
});
t("màn 60 Hz: đủ khung 15 s thì nâng thử một nấc; lỡ khung lại thì hạ và lần thử sau chờ gấp bốn", () => {
  const d = new DynRes(); run(d, 25, 2.5); assert.equal(d.k, 0.875);
  const up = run(d, 16.7, 16); assert.deepEqual(up.map((c) => c[1]), [1]); assert.ok(up[0][0] >= 15);
  const back = run(d, 20, 2.5); assert.deepEqual(back.map((c) => c[1]), [0.875]);
  assert.deepEqual(run(d, 16.7, 50), []);                // lần thử sau phải chờ 60 s
  assert.deepEqual(run(d, 16.7, 15).map((c) => c[1]), [1]);
});
t("máy ở ranh giới (mức đầy 20 ms, mức dưới 16,7 ms): đổi mức có hạn, thử nâng thưa dần tới mỗi 240 s — không dao động", () => {
  const d = new DynRes(); let tt = 0, n = 0, n300 = 0, late = 0;
  while (tt < 900) { const ms = d.k === 1 ? 20 : 16.7; const k = d.frame(ms); tt += ms / 1000; if (k) { n++; if (tt < 300) n300++; if (tt >= 400) late++; } }
  assert.ok(n300 <= 5, `${n300} lần đổi trong 300 s`);
  assert.ok(late <= 4, `${late} lần đổi trong 400–900 s (mỗi lần thử: nâng rồi hạ, ≥ 240 s một lần)`);
  assert.ok(n <= 11, `${n} lần đổi`);
  assert.equal(d.k, 0.875);
});
t("nặng lâu (hỏng thử nhiều lần) rồi nhẹ lại: vẫn về mức đầy — không thôi nâng tới hết trận", () => {
  // GPU 12 ms × 1,6 trong 400 s (mức đầy lỡ khung, mức dưới đủ khung) rồi × 0,5: trước đây hỏng 3 lần là chờ thử = ∞, kẹt mức dưới
  for (const hz of [60, 90, 120, 144]) {
    const d = new DynRes(); sim(d, { gpu: 12 * 1.6, hz }, 400);
    assert.ok(d.k < 1 && d.fails >= 1, `${hz} Hz: phải đang ở mức dưới, đã thử hỏng (k ${d.k}, hỏng ${d.fails})`);
    assert.ok(Number.isFinite(d.probeWait) && d.probeWait <= 240, `${hz} Hz: chờ thử ${d.probeWait} s`);
    sim(d, { gpu: 12 * 0.5, hz }, 300);
    assert.equal(d.k, 1, `${hz} Hz: 300 s sau khi nhẹ vẫn ở ${d.k}`);
  }
});
t("tải dồn từng đợt (nặng 2 s mỗi 10 s): không đổi độ phân giải mỗi đợt — ≤ 15 lần trong 900 s", () => {
  // trước đây: hạ giữa đợt nặng, 3 s khung nhanh sau đợt là nâng, nâng "trụ" qua 6 s nên xoá số hỏng — 180 lần / 900 s ở 120–144 Hz
  for (const [hz, light] of [[60, 8], [90, 6], [120, 8], [144, 6], [144, 8], [144, 10]]) {
    const d = new DynRes(); let tt = 0, n = 0;
    while (tt < 900) { const heavy = tt % 10 < 2, ms = frameMs(d, { gpu: light * (heavy ? 2.5 : 1), hz }); if (d.frame(ms)) n++; tt += ms / 1000; }
    assert.ok(n <= 15, `${hz} Hz, nhẹ ${light} ms: ${n} lần đổi`);
  }
});
t("màn 90 Hz (khung lượng tử 11,1 / 22,2 ms): nâng lên lỡ khung thì thôi nâng theo khung nhanh — ≤ 6 lần đổi trong 300 s, không dao động", () => {
  // GPU 12–19 ms ở mức đầy: mức đầy 22,2 ms, mức dưới 11,1 ms (< 13 ms "nhanh") — trước đây nâng / hạ mỗi ~2,6 s suốt trận (115 lần / 300 s)
  for (const gpu of [12, 14, 16, 19]) {
    const d = new DynRes(), ch = sim(d, { gpu, hz: 90 }, 300);
    assert.ok(ch.length <= 6, `GPU ${gpu} ms: ${ch.length} lần — ${JSON.stringify(ch)}`);
    assert.ok(d.k < 1, `GPU ${gpu} ms: phải ở mức dưới (mức đầy lỡ khung)`);
    const late = sim(d, { gpu, hz: 90 }, 600);                              // về sau chỉ còn thử ≥ 240 s một lần (nâng rồi hạ)
    assert.ok(late.length <= 6, `GPU ${gpu} ms, 300–900 s: ${late.length} lần`);
  }
  for (const hz of [60, 120, 144]) for (const gpu of [12, 16, 19, 22]) {
    const ch = sim(new DynRes(), { gpu, hz }, 300);
    assert.ok(ch.length <= 6, `${hz} Hz, GPU ${gpu} ms: ${ch.length} lần — ${JSON.stringify(ch)}`);
  }
  const ch12 = sim(new DynRes(), { gpu: 12, hz: 90 }, 300);                  // ca soát nêu: 90 Hz, GPU 12 ms
  assert.ok(ch12.length <= 5, `90 Hz, GPU 12 ms: ${ch12.length} lần — ${JSON.stringify(ch12)}`);
});
t("thử nâng mà trụ được ≥ 12 s (cảnh nhẹ đi) thì xoá số lần hỏng: lần chậm sau lại hạ / nâng như đầu trận", () => {
  const d = new DynRes(); sim(d, { gpu: 12, hz: 90 }, 12);
  assert.equal(d.fails, 1); assert.equal(d.k, 0.875);
  sim(d, { gpu: 9, hz: 90 }, 75);                                         // nhẹ đi: lần thử sau 60 s trụ được
  assert.equal(d.k, 1); assert.equal(d.fails, 0); assert.equal(d.probeWait, 15);
});
t("đang khoá hạ mà nâng thử lên (khung ở mức dưới nhanh dần) rồi lỡ khung: vẫn hạ về được — khoá đo ở mức cũ, nâng là bỏ khoá", () => {
  const d = new DynRes();
  run(d, 30, 1.5); assert.equal(d.k, 0.875);                              // hạ: 30 → 20 ms (có ích)
  run(d, 20, 6); assert.equal(d.k, 0.875); assert.ok(d.block > 0, "0,75 không nhanh hơn: trả về 0,875, khoá hạ");
  run(d, 17, 16); assert.equal(d.k, 1);                                   // 17 ms (trong ±20% của khoá) đủ 15 s: nâng thử
  run(d, 22, 2.5); assert.equal(d.k, 0.875, "mức đầy lỡ khung (22 ms, vẫn trong ±20% của khoá cũ): phải hạ về");
  assert.equal(d.fails, 1);
});
t("hạ mà khung không nhanh hơn (trình duyệt giới hạn 30 khung/s, nghẽn CPU): trả về mức đầy và thôi hạ — không ngồi ở sàn 0,75", () => {
  const d = new DynRes(), ch = sim(d, { gpu: 6, hz: 60, cap: 30 }, 300);
  assert.ok(ch.length <= 3, JSON.stringify(ch)); assert.equal(d.k, 1);
  const e = new DynRes(), ce = sim(e, { gpu: 4, cpu: 25 }, 300);       // CPU 25 ms mỗi khung: độ phân giải không đổi gì
  assert.ok(ce.length <= 3, JSON.stringify(ce)); assert.equal(e.k, 1);
  // giới hạn 30 khung/s mà GPU nặng thật (mức đầy 50 ms, 0,875 về 33 ms): hạ có ích thì giữ
  const f = new DynRes(); sim(f, { gpu: 40, hz: 60, cap: 30 }, 60); assert.ok(f.k < 1);
  // đã khoá hạ mà khoảng khung đổi hẳn (> ±20%: cảnh nặng lên 50 ms) thì lại được hạ khi chậm
  const g = new DynRes(); sim(g, { gpu: 6, hz: 60, cap: 30 }, 30); assert.equal(g.k, 1);
  sim(g, { gpu: 40, hz: 60 }, 30); assert.ok(g.k < 1, "khung đổi hẳn sau khi khoá: phải hạ");
  // màn 120 / 144 Hz bị giới hạn 30 khung/s cũng vậy
  for (const hz of [120, 144]) { const h = new DynRes(), c = sim(h, { gpu: 6, hz, cap: 30 }, 300); assert.ok(c.length <= 3 && h.k === 1, `${hz} Hz: ${JSON.stringify(c)}`); }
});
t("0,875 chưa qua ngưỡng vsync mà 0,75 qua (60 Hz, GPU 22 ms): hạ tiếp tới nấc có ích", () => {
  const d = new DynRes(); sim(d, { gpu: 22, hz: 60 }, 30); assert.equal(d.k, 0.75);
});

console.log(`\n${pass} đạt, ${fail} trượt`);
process.exit(fail ? 1 : 0);
