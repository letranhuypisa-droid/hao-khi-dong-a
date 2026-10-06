// battle/gfx.js — Đồ hoạ trong trận và Võ trường (đợt 19c): renderer theo mức Đồ hoạ, tỉ lệ điểm ảnh, độ phân giải động, làm nóng shader.
//
// Mức (core/gfx.js gfxPlan) chọn lúc dựng renderer — mỗi trận một renderer (releaseGpu bỏ hẳn ngữ cảnh lúc rời): khử răng cưa MSAA là cờ
// của ngữ cảnh WebGL nên đổi mức giữa trận chỉ đổi tỉ lệ điểm ảnh và bóng, MSAA theo từ trận sau. Tỉ lệ điểm ảnh = min(DPR, trần của mức)
// × Tỉ lệ render × nấc độ phân giải động (chỉ Tự động; core/gfx.js DynRes đọc khoảng giữa hai rAF). Chỉ phần vẽ: bước trận cố định,
// ctx.project dùng cỡ CSS.
//
// Làm nóng (Warm): trước khung đầu nhìn thấy (màn tải của main.js còn che), biên dịch mọi chương trình shader kể cả chương trình độ sâu của
// bóng và nạp texture lên GPU, để giữa trận không khựng vì biên dịch (lần đầu gặp tia lửa, vòng báo đòn, sĩ quan, boss, cờ…). three r186:
// compile() dựng mọi vật liệu trong cảnh (cả vật ẩn) nhưng không dựng chương trình độ sâu của bóng — phải vẽ thật một lượt lên CANVAS
// (vẽ vào render target thì three dựng biến thể không tone mapping, sai). Lượt vẽ đó hiện cả nhóm làm nóng (vật liệu của những thứ chỉ
// sinh ra giữa trận: sprite fx dựng sẵn vào pool, vòng báo đòn, bóng né, cờ, vật phẩm, rig sĩ quan / boss / tướng đồng minh) và vẽ mọi
// vật không loại theo khung nhìn (frustumCulled tạm tắt) để chương trình, texture, bộ đệm của cả cảnh có trước khung đầu. Vật ẩn
// (visible = false: lưới chờ dùng, cờ, thuyền chưa ra…; trừ đèn) tạm hiện, InstancedMesh đang rỗng (count = 0: lính, thuyền, tên trước
// lượt vẽ đầu) tạm vẽ 1 bản: compile() dựng chương trình của chúng nhưng three chỉ "dùng lần đầu" (đọc log liên kết, vị trí uniform — lệnh
// GL chờ đồng bộ, 0,3–2 s mỗi chương trình trên SwiftShader) và driver chỉ hoàn tất biên dịch ở lần VẼ đầu — trước đây rơi vào khung 2,
// khung 3 và giữa trận (đo B15: 5 chương trình, B20: 8). Vật làm nóng không bao giờ dispose giữa trận (three xoá chương trình khi vật liệu
// cuối cùng dùng nó bị dispose → lần sau lại biên dịch); nhóm gỡ khỏi cảnh sau lượt vẽ (khỏi tốn cập nhật ma trận mỗi khung), gắn lại lúc
// làm nóng lại và lúc rời trận để releaseGpu dọn cùng cảnh (để ngoài cảnh thì hình học / texture dùng chung của glb.js giữ listener của
// renderer cũ). Không đụng ctx.rng, không spawn lính, không gọi bước trận: vết bot xác định (tools/baseline-b15.mjs) giữ nguyên từng byte.

import * as THREE from "three";
import { isGfx, gfxPlan, DynRes } from "../core/gfx.js";
import { makeRig, RIGS, pickupMesh, flagTexture } from "./models.js";
import { fxTextures } from "./fx.js";

// Máy: tên GPU đọc một lần mỗi lần mở trang (ngữ cảnh WebGL tạm, bỏ ngay); DPR, màn đọc mới mỗi lần (kéo cửa sổ sang màn khác, phóng to trang).
let GPU = null;
function gpuName() {
  if (GPU !== null) return GPU;
  GPU = "";
  try {
    const c = document.createElement("canvas"), gl = c.getContext("webgl2", { powerPreference: "high-performance" }) || c.getContext("webgl");
    if (gl) {
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      GPU = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || "");
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
  } catch (_) { /* không đọc được: core/gfx.js đoán theo màn */ }
  return GPU;
}
export function deviceInfo() {
  const nav = navigator, mm = (q) => { try { return !!matchMedia(q).matches; } catch (_) { return false; } };
  return { dpr: window.devicePixelRatio || 1, sw: screen.width || 0, sh: screen.height || 0, coarse: mm("(any-pointer: coarse)"),
    cores: nav.hardwareConcurrency || 0, mem: nav.deviceMemory || 0, gpu: gpuName(),
    mobile: !!(nav.userAgentData?.mobile ?? /Android|iPhone|iPad|Mobile/i.test(nav.userAgent || "")) };
}

// Renderer + bộ Đồ hoạ của trận. Cao: đúng như trước đợt 19c (MSAA, tỉ lệ tới 2, bóng PCF 2048). Cỡ canvas (khung trận đã dàn trang, đang
// ẩn sau màn tải) cho trần số điểm ảnh của mức (core/gfx.js mp) lúc chọn MSAA.
export function createRenderer(canvas, settings) {
  const gfx = new Gfx(settings, { vw: canvas.clientWidth, vh: canvas.clientHeight });
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: gfx.plan.msaa, powerPreference: "high-performance" });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  // r186 bỏ PCFSoftShadowMap (tự lùi về PCF và cảnh báo mỗi lần vào trận): đặt thẳng PCF; mức Thấp dùng Basic (1 mẫu mỗi điểm ảnh)
  renderer.shadowMap.enabled = settings.shadows;
  gfx.renderer = renderer; gfx.applyShadowType();
  return { renderer, gfx };
}

class Gfx {
  constructor(settings, size = {}) {
    this.settings = settings; this.renderer = null; this.sun = null; this.sunBias = 0; this.W = size.vw || 0; this.H = size.vh || 0;
    const plan = gfxPlan(settings.graphics, this.info(), settings.renderScale);
    this.msaa = plan.msaa;                        // cờ ngữ cảnh: giữ suốt trận
    this.use(plan);
  }
  use(plan) {
    this.plan = plan; this.tier = plan.tier;
    if (!plan.dyn) this.dyn = null;
    else if (!this.dyn) this.dyn = new DynRes();
  }
  info() { const i = deviceInfo(); i.vw = this.W; i.vh = this.H; return i; }
  // tỉ lệ điểm ảnh lúc này: DPR, cỡ khung đọc mới, mức giữ cố định trong trận (Tự động không đổi mức khi DPR đổi)
  ratio() { return gfxPlan(this.tier, this.info(), this.settings.renderScale).base * (this.dyn ? this.dyn.k : 1); }
  resize(W, H) { this.W = W; this.H = H; this.renderer.setPixelRatio(this.ratio()); this.renderer.setSize(W, H, false); }
  // mỗi khung (rAF): true khi độ phân giải động vừa đổi nấc → nơi gọi resize()
  frame(ms) { return !!(this.dyn && this.dyn.frame(ms)); }
  applyShadowType() { this.renderer.shadowMap.type = this.plan.shadow === "basic" ? THREE.BasicShadowMap : THREE.PCFShadowMap; }
  // cỡ bản đồ bóng của mặt trời theo mức (Thấp 1024); normalBias nới theo cỡ ô bóng (world.js chỉnh cho 2048) — nới nửa phần (1024: × 1,5):
  // × 2 thì bóng thanh rào tách khỏi chân rào, đứt thành vạch
  shadow(sun) {
    if (!sun?.shadow) return;
    if (this.sun !== sun) { this.sun = sun; this.sunBias = sun.shadow.normalBias; }
    const n = this.plan.shadowSize;
    sun.shadow.mapSize.set(n, n); sun.shadow.normalBias = this.sunBias * (1 + (2048 / n - 1) * 0.5);
  }
  // Đổi Đồ hoạ / Tỉ lệ render giữa trận (bảng tạm dừng). Trả true khi chương trình shader phải dựng lại (kiểu bóng đổi).
  set(settings) {
    this.settings = settings;
    const prev = this.plan.shadow, auto = !isGfx(settings.graphics);
    if (!auto || !this.plan.auto) this.use(gfxPlan(settings.graphics, this.info(), settings.renderScale));   // vẫn Tự động: giữ mức chọn lúc vào trận
    if (this.sun) this.shadow(this.sun);
    if (prev === this.plan.shadow) return false;
    this.applyShadowType();
    return true;
  }
}

// ---- làm nóng -------------------------------------------------------------------------------------------------------------
// rigs: khoá RIGS của những rig chỉ xuất hiện giữa trận (sĩ quan, boss, tướng đồng minh vào sau); rig đã có lúc dựng trận khỏi cần.
export class Warm {
  constructor(scene, ctx, rigs = []) {
    this.scene = scene; this.ctx = ctx;
    const g = this.group = new THREE.Group(); g.name = "warm";
    const fx = ctx.fx?.warmSet?.() || { pool: [], extra: [] };
    this.pool = fx.pool;                                  // sprite fx dựng sẵn: nằm trong pool của FX (trong cảnh, ẩn) — dùng thật về sau
    for (const m of fx.extra) g.add(m);
    // vật sinh giữa trận của director (cùng công thức vật liệu): vật phẩm (director.drop), cột / vải cờ (plantFlag, kesach, director-td)
    g.add(pickupMesh(0xf1d98a));
    const plane = new THREE.PlaneGeometry(0.5, 0.5);
    g.add(new THREE.Mesh(plane, new THREE.MeshLambertMaterial({ color: 0x1d1a17 })));
    g.add(new THREE.Mesh(plane, new THREE.MeshLambertMaterial({ map: flagTexture("破"), side: THREE.DoubleSide })));
    g.add(new THREE.Mesh(plane, new THREE.MeshLambertMaterial({ color: 0x9b2d20, side: THREE.DoubleSide })));
    for (const k of new Set(rigs)) if (RIGS[k]) { const r = makeRig(RIGS[k]); g.add(r.root); }
    g.traverse((o) => { o.frustumCulled = false; });
  }
  // Một lượt làm nóng đồng bộ: compile mọi vật liệu (cả vật ẩn), rồi vẽ thật lên canvas với nhóm làm nóng hiện, mọi vật ẩn tạm hiện, mọi
  // InstancedMesh rỗng tạm 1 bản, không loại theo khung nhìn (chương trình độ sâu của bóng, lần dùng đầu của mọi chương trình, texture, bộ
  // đệm); trả lại y nguyên ngay sau. clean: vẽ lại một lần đúng cảnh (camera đã đặt: hình nằm lại trên canvas khi khung đầu chưa vẽ, khung
  // sau bảng tạm dừng) — cả hai lượt cùng một tác vụ nên trình duyệt chỉ hiện lượt sau. Trả số vật tạm hiện / tạm 1 bản (kiểm thử).
  pass(renderer, scene, camera, clean = false) {
    const h = this.ctx.hero, g = this.group;
    if (h) g.position.set(h.x, h.y || 0, h.z);
    g.visible = true; scene.add(g);
    // sprite fx còn nằm trong pool (ẩn) dời tới tướng; sprite đang dùng (lửa cháy 20 s lúc tạm dừng đổi Bóng) giữ nguyên chỗ, nguyên trạng
    if (h) for (const o of this.pool) if (!o.visible) o.position.set(h.x, (h.y || 0) + 1, h.z);
    // đèn ẩn giữ nguyên: số đèn là một phần khoá chương trình — hiện thêm đèn thì dựng biến thể không bao giờ dùng
    const culled = [], shown = [], bumped = [];
    scene.traverse((o) => {
      if (!o.visible && !o.isLight) { o.visible = true; shown.push(o); }
      if (o.isInstancedMesh && o.count === 0 && o.instanceMatrix.count > 0) { o.count = 1; bumped.push(o); }
      if (o.frustumCulled && (o.isMesh || o.isSprite || o.isPoints || o.isLine)) { o.frustumCulled = false; culled.push(o); }
    });
    try {
      renderer.compile(scene, camera);
      renderer.render(scene, camera);
    } finally {
      for (const o of culled) o.frustumCulled = true;
      for (const o of shown) o.visible = false;
      for (const o of bumped) o.count = 0;
      scene.remove(g);
    }
    if (clean) renderer.render(scene, camera);
    return { shown: shown.length, bumped: bumped.length };
  }
  // Làm nóng đầu trận: ảnh fx đã tải → nạp lên GPU; có KHR_parallel_shader_compile thì compileAsync trước (biên dịch song song, màn tải
  // vẫn chạy; nhóm làm nóng trong cảnh nhưng ẩn — compile() dựng cả vật ẩn), không có thì compile đồng bộ trong pass; rồi một lượt vẽ
  // thật và một lượt sạch (canvas không giữ hình có nhóm làm nóng nếu khung trận hiện trước khung đầu), rồi đọc 1 điểm ảnh: chờ GPU vẽ xong
  // hai lượt đó ngay sau màn tải, không để khung đầu nhìn thấy phải chờ. Quá giờ thì bỏ qua bước đang chờ (vẫn vào trận).
  async run(renderer, scene, camera, fxReady = null) {
    const wait = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(r, ms))]);
    if (fxReady) await wait(fxReady, 8000);
    for (const t of fxTextures()) if (t.image) renderer.initTexture(t);
    if (renderer.extensions.has("KHR_parallel_shader_compile")) {      // has(): không cảnh báo như compileAsync khi thiếu phần mở rộng
      this.group.visible = false; scene.add(this.group);
      try { await wait(renderer.compileAsync(scene, camera), 15000); } finally { scene.remove(this.group); }
    }
    // màn tải vẽ một khung trước lượt vẽ đồng bộ dài: rAF rồi một tác vụ mới (chạy sau khi khung đó vẽ xong; chạy ngay trong rAF thì vẫn
    // trước lượt vẽ của khung) — tab ẩn: rAF không chạy, quá 100 ms thì làm luôn
    await wait(new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0))), 100);
    this.stats = this.pass(renderer, scene, camera, true);
    const gl = renderer.getContext(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
  }
  // rời trận: gắn lại vào cảnh để releaseGpu dọn cùng
  attach() { this.scene.add(this.group); }
}

// Chỉ ?debug: đếm chương trình shader "dùng lần đầu" sau khi trận hiện (ctx.warmed) — three đọc log liên kết (getProgramInfoLog, lệnh chờ
// đồng bộ) đúng một lần mỗi chương trình, ở lần vẽ đầu. Làm nóng đủ thì ctx.lateFirstUse luôn 0; kịch bản kiểm thử đọc số này.
export function watchLateFirstUse(renderer, ctx) {
  const gl = renderer.getContext(), f = gl.getProgramInfoLog;
  ctx.lateFirstUse = 0;
  gl.getProgramInfoLog = function (p) { if (ctx.warmed) ctx.lateFirstUse++; return f.call(this, p); };
}
