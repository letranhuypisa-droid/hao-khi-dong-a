// tests/gfx.test.mjs — cài đặt Đồ hoạ (đợt 19c, core/gfx.js): Tự động chọn mức theo máy (GPU, cảm ứng, bộ nhớ), mỗi mức giới hạn tỉ lệ
// điểm ảnh / khử răng cưa / kiểu bóng, độ phân giải động (hạ khi khung chậm, nâng chậm, không dao động); bản lưu cũ có graphics = "auto".
//   node game/tests/gfx.test.mjs
import assert from "node:assert/strict";
import { GFX_LEVELS, GFX_PRESETS, detectTier, gfxPlan, DynRes } from "../js/core/gfx.js";
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
t("Tỉ lệ render ngoài 0,5–1 bị kẹp; thiếu thì 1", () => {
  assert.equal(gfxPlan("cao", RTX, undefined).base, 1);
  assert.equal(gfxPlan("cao", RTX, 0.2).base, 0.5);
  assert.equal(gfxPlan("cao", RTX, 3).base, 1);
});
t("bảng mức đủ ba mức, mức thấp không bao giờ nét hơn mức cao", () => {
  assert.deepEqual(Object.keys(GFX_PRESETS).sort(), ["cao", "thap", "vua"]);
  for (const dpr of [1, 1.25, 1.5, 2, 3]) {
    const b = ["thap", "vua", "cao"].map((k) => gfxPlan(k, { ...RTX, dpr }, 1).base);
    assert.ok(b[0] <= b[1] && b[1] <= b[2], `dpr ${dpr}: ${b}`);
  }
});

console.log("Độ phân giải động");
const run = (d, ms, sec) => { const ch = []; let tt = 0; while (tt < sec) { const k = d.frame(ms); tt += ms / 1000; if (k) ch.push([+tt.toFixed(2), k]); } return ch; };
t("60 Hz đủ khung (16,7 ms) ở mức đầy: không đổi", () => {
  const d = new DynRes(); assert.deepEqual(run(d, 16.7, 120), []); assert.equal(d.k, 1);
});
t("khung chậm kéo dài (25 ms): hạ từng nấc, cách nhau ≥ 2 s, dừng ở sàn 0,75", () => {
  const d = new DynRes(), ch = run(d, 25, 20);
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
  const d = new DynRes(); run(d, 60, 8); assert.equal(d.k, 0.75);
  const e = new DynRes(); run(e, 90, 8); assert.equal(e.k, 0.75);
});
t("màn 120 Hz: khung nhanh (< 13 ms) thì nâng lại chậm (≥ 3 s mỗi nấc)", () => {
  const d = new DynRes(); run(d, 25, 10); assert.equal(d.k, 0.75);
  const ch = run(d, 8.3, 20);
  assert.deepEqual(ch.map((c) => c[1]), [0.875, 1]);
  assert.ok(ch[0][0] >= 3 && ch[1][0] - ch[0][0] >= 3, JSON.stringify(ch));
});
t("màn 60 Hz: đủ khung 15 s thì nâng thử một nấc; lỡ khung lại thì hạ và chờ gấp đôi", () => {
  const d = new DynRes(); run(d, 25, 2.5); assert.equal(d.k, 0.875);
  const up = run(d, 16.7, 16); assert.deepEqual(up.map((c) => c[1]), [1]); assert.ok(up[0][0] >= 15);
  const back = run(d, 20, 2.5); assert.deepEqual(back.map((c) => c[1]), [0.875]);
  assert.deepEqual(run(d, 16.7, 25), []);                // lần thử sau phải chờ 30 s
  assert.deepEqual(run(d, 16.7, 6).map((c) => c[1]), [1]);
});
t("máy ở ranh giới (mức đầy 20 ms, mức dưới 16,7 ms): đổi mức có hạn, hết thử sau vài lần — không dao động", () => {
  const d = new DynRes(); let tt = 0, n = 0, lastAt = 0;
  while (tt < 900) { const ms = d.k === 1 ? 20 : 16.7; const k = d.frame(ms); tt += ms / 1000; if (k) { n++; lastAt = tt; } }
  assert.ok(n <= 9, `${n} lần đổi`);
  assert.ok(lastAt < 300, `lần đổi cuối ở ${lastAt.toFixed(0)} s`);
  assert.equal(d.k, 0.875);
});

console.log(`\n${pass} đạt, ${fail} trượt`);
process.exit(fail ? 1 : 0);
