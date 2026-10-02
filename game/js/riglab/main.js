// riglab/main.js — trang gắn xương GLB (rig.html, công cụ phát triển, không đưa lên web game).
// Nạp mô hình người tĩnh (Hunyuan3D…) → autorig.js gắn xương theo rig tướng của game → xem chạy đúng các đòn, dáng chạy của game
// (bake.js) → xuất GLB có xương và clip hoạt ảnh. "Mẫu thử" dựng một tướng mặc áo dài từ chính rig game, xoay tay chữ A, bỏ xương —
// giống một mô hình Hunyuan3D — để thử khi chưa có tệp.
// window.__rig: load(url), loadBuffer(ArrayBuffer, tên), sample(), setClip(tên), setSet("WC03"|"WC01"), rotate(), adjust(obj),
// exportGLB() → ArrayBuffer, info() — cho kịch bản chụp màn / nướng tự động bằng Playwright.

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { makeRig, disposeRig, RIGS, lambert } from "../battle/models.js";
import { rigMeshes, JOINTS, GAME } from "./autorig.js";
import { SETS, clipList, makeDriver, disposeDriver, poseDriver, copyPose, bakeClips } from "./bake.js";

const $ = (s) => document.querySelector(s);
const canvas = $("#view");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1d1916);
const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 100);
camera.position.set(2.6, 1.6, 4.2);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.95, 0); controls.update();
scene.add(new THREE.HemisphereLight(0xfff1dc, 0x3a2a20, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(3, 5, 4); scene.add(sun);
const grid = new THREE.GridHelper(6, 12, 0x6b5a48, 0x3a2e25); scene.add(grid);
// mũi tên phía trước (+z, quy ước rig game): mô hình phải nhìn theo mũi tên, không thì bấm Xoay 90°
scene.add(new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0.01, 0.3), 0.6, 0xc0392b, 0.15, 0.1));

const st = { name: "", meshes: null, yaw: null, rigged: null, set: "WC03", clip: "idle", t: 0, playing: true, showBones: true,
  paint: false, adjust: {}, driver: null, helper: null, origMats: null };

// ---- nạp mô hình: gộp mọi lưới, bake toạ độ thế giới, bỏ xương / hoạt ảnh cũ nếu có ------------------------------------------
function staticMeshes(root) {
  root.updateMatrixWorld(true);
  const out = [], v = new THREE.Vector3();
  root.traverse((o) => {
    if (!o.isMesh) return;
    let g = o.geometry.clone();
    if (o.isSkinnedMesh) {                                // mô hình đã có xương: lấy hình đang hiện (đã áp da)
      o.skeleton.update();
      const p = g.attributes.position, arr = new Float32Array(p.count * 3);
      for (let i = 0; i < p.count; i++) { o.getVertexPosition(i, v); v.applyMatrix4(o.matrixWorld); arr.set([v.x, v.y, v.z], i * 3); }
      g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
      g.deleteAttribute("skinIndex"); g.deleteAttribute("skinWeight");
    } else g.applyMatrix4(o.matrixWorld);
    for (const k of Object.keys(g.morphAttributes)) delete g.morphAttributes[k];
    if (!g.index) { const idx = []; for (let i = 0; i < g.attributes.position.count; i++) idx.push(i); g.setIndex(idx); }
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (mats.length > 1 && g.groups.length) {             // lưới nhiều vật liệu: tách theo nhóm
      for (const gr of g.groups) {
        const sub = g.clone(); sub.setIndex(Array.from(g.index.array.slice(gr.start, gr.start + gr.count))); sub.clearGroups();
        out.push({ geometry: sub, material: mats[gr.materialIndex] || mats[0], name: o.name });
      }
    } else out.push({ geometry: g, material: mats[0], name: o.name });
  });
  return out;
}
async function loadBuffer(buf, name = "model.glb") {
  const gltf = await new GLTFLoader().parseAsync(buf, "");
  st.name = name.replace(/\.(glb|gltf)$/i, ""); st.meshes = staticMeshes(gltf.scene); st.yaw = null; st.adjust = {};
  rig();
}
async function loadUrl(url) { const r = await fetch(url); return loadBuffer(await r.arrayBuffer(), url.split("/").pop()); }

// Mẫu thử: tướng áo dài (rig "tuong" của Toa Đô: áo choàng, vạt áo; bỏ đại đao — mô hình để gắn xương nên tay không) tay chữ A
// 38°, bake ra lưới tĩnh không xương.
function sample() {
  const r = makeRig({ ...RIGS.tuong, flag: null, weapon: "none" });
  r.p.shL.rotation.z = -0.66; r.p.shR.rotation.z = 0.66; r.p.elL.rotation.x = -0.15; r.p.elR.rotation.x = -0.15;
  r.p.hipL.rotation.z = -0.06; r.p.hipR.rotation.z = 0.06;
  r.root.updateMatrixWorld(true);
  const meshes = staticMeshes(r.root).map((m) => ({ ...m, material: lambert() }));
  disposeRig(r);
  st.name = "mau-thu"; st.meshes = meshes; st.yaw = null; st.adjust = {};
  rig();
}

// ---- gắn xương, dựng lại khi đổi hướng / chỉnh khớp --------------------------------------------------------------------------
function rig() {
  if (!st.meshes) return;
  if (st.rigged) { scene.remove(st.rigged.root); if (st.helper) scene.remove(st.helper); }
  const adjust = (lm) => {
    const a = st.adjust, H = GAME.height, j = lm.j;
    if (a.hips) for (const k of ["hips", "torso", "hipL", "hipR"]) j[k][1] += a.hips * H;
    if (a.knee) for (const k of ["kneeL", "kneeR"]) j[k][1] += a.knee * H;
    if (a.shoulderY) for (const k of ["shL", "shR"]) j[k][1] += a.shoulderY * H;
    if (a.shoulderX) { j.shL[0] -= a.shoulderX * H; j.shR[0] += a.shoulderX * H; }
    if (a.neck) j.head[1] += a.neck * H;
    if (a.legX) for (const k of ["hipL", "kneeL", "ankleL"]) j[k][0] -= a.legX * H;
    if (a.legX) for (const k of ["hipR", "kneeR", "ankleR"]) j[k][0] += a.legX * H;
    if (a.elbow) for (const s of ["L", "R"]) { const sh = j["sh" + s], h = j["hand" + s]; const u = 0.43 + a.elbow; j["el" + s] = [0, 1, 2].map((i) => sh[i] + (lm.ends["hand" + s][i] - sh[i]) * u); void h; }
  };
  const res = rigMeshes(st.meshes, { yaw: st.yaw, adjust });
  st.yaw = res.norm.yaw; st.rigged = res;
  st.origMats = res.root.children.filter((o) => o.isSkinnedMesh).map((m) => m.material);
  scene.add(res.root);
  st.helper = new THREE.SkeletonHelper(res.root); st.helper.visible = st.showBones; scene.add(st.helper);
  if (st.paint) { st.paint = false; paint(true); }
  if (!st.driver || st.driver.set !== st.set) { if (st.driver) disposeDriver(st.driver); st.driver = makeDriver(st.set); }
  st.t = 0; ui();
}

// Tô màu theo xương nặng nhất (kiểm tra trọng số): mỗi xương một màu.
const BONE_COL = JOINTS.map((_, i) => new THREE.Color().setHSL((i * 0.618) % 1, 0.7, 0.55));
function paint(on) {
  const was = st.paint; st.paint = on; if (!st.rigged || was === on) return;
  st.rigged.root.children.filter((o) => o.isSkinnedMesh).forEach((m, k) => {
    const g = m.geometry;
    if (!on) {                                   // trả vật liệu và màu đỉnh gốc (mô hình tô màu bằng màu đỉnh, như mẫu thử)
      m.material = st.origMats[k];
      if (g.userData.color0) g.setAttribute("color", g.userData.color0); else g.deleteAttribute("color");
      delete g.userData.color0; return;
    }
    if (!g.userData.color0 && g.attributes.color) g.userData.color0 = g.attributes.color;
    const si = g.attributes.skinIndex, sw = g.attributes.skinWeight, col = new Float32Array(si.count * 3), c = new THREE.Color();
    for (let i = 0; i < si.count; i++) {
      c.setRGB(0, 0, 0);
      for (let q = 0; q < 4; q++) { const w = sw.getComponent(i, q); if (w > 0) { const b = BONE_COL[si.getComponent(i, q)]; c.r += b.r * w; c.g += b.g * w; c.b += b.b * w; } }
      col.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    m.material = new THREE.MeshLambertMaterial({ vertexColors: true });
  });
}

// ---- xuất GLB: tư thế mặc định = tư thế gắn (mô hình đứng như gốc), kèm mọi clip của bộ đòn ---------------------------------
async function exportGLB() {
  const R = st.rigged; if (!R) throw new Error("chưa có mô hình");
  const clips = bakeClips(st.set, R.byName, R.rest.hips);
  for (const b of R.bones) { b.position.copy(R.rest[b.name]); b.quaternion.copy(R.bind[b.name]); }
  const wasPaint = st.paint; if (wasPaint) paint(false);
  R.root.updateMatrixWorld(true);
  const buf = await new GLTFExporter().parseAsync(R.root, { binary: true, animations: clips });
  if (wasPaint) paint(true);
  return buf;
}
async function download() {
  const btn = $("#export"); btn.disabled = true; btn.textContent = "Đang xuất…";
  try {
    const buf = await exportGLB();
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([buf], { type: "model/gltf-binary" }));
    a.download = `${st.name || "model"}-rigged-${st.set}.glb`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  } catch (e) { alert("Xuất lỗi: " + e.message); console.error(e); }
  btn.disabled = false; btn.textContent = "Xuất GLB";
}

// ---- giao diện ---------------------------------------------------------------------------------------------------------------
const SLIDERS = [["hips", "Hông lên/xuống"], ["knee", "Gối"], ["shoulderY", "Vai lên/xuống"], ["shoulderX", "Vai rộng/hẹp"], ["neck", "Cổ"], ["legX", "Hai chân xa/gần"], ["elbow", "Khuỷu tay"]];
function ui() {
  const R = st.rigged, clips = clipList(st.set);
  $("#clips").innerHTML = clips.map((c) => `<button data-clip="${c.name}" class="${st.clip === c.name ? "on" : ""}">${c.label}</button>`).join("");
  $("#clips").querySelectorAll("[data-clip]").forEach((b) => (b.onclick = () => { st.clip = b.dataset.clip; st.t = 0; ui(); }));
  $("#set").innerHTML = Object.entries(SETS).map(([k, s]) => `<option value="${k}" ${k === st.set ? "selected" : ""}>${s.label}</option>`).join("");
  const tris = R ? R.root.children.filter((o) => o.isSkinnedMesh).reduce((s, m) => s + (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3, 0) : 0;
  $("#info").innerHTML = R ? `<b>${st.name}</b> · ${Math.round(tris).toLocaleString("vi-VN")} tam giác · ${R.bones.length} xương · hướng ${Math.round((st.yaw * 180) / Math.PI)}°`
    + (R.warnings.length ? `<ul>${R.warnings.map((w) => `<li>${w}</li>`).join("")}</ul>` : `<p class="ok">Dò khớp ổn.</p>`) : "Chưa có mô hình — chọn tệp GLB hoặc bấm Mẫu thử.";
  $("#sliders").innerHTML = SLIDERS.map(([k, l]) => `<label>${l}<input type="range" min="-0.12" max="0.12" step="0.005" value="${st.adjust[k] || 0}" data-adj="${k}"></label>`).join("");
  $("#sliders").querySelectorAll("[data-adj]").forEach((el) => (el.onchange = () => { st.adjust[el.dataset.adj] = Number(el.value); rig(); }));
}
$("#file").onchange = async (e) => { const f = e.target.files[0]; if (f) await loadBuffer(await f.arrayBuffer(), f.name); };
$("#sample").onclick = sample;
$("#rotate").onclick = () => { st.yaw = (st.yaw ?? 0) + Math.PI / 2; rig(); };
$("#set").onchange = (e) => { st.set = e.target.value; st.clip = "idle"; rig(); };
$("#bones").onchange = (e) => { st.showBones = e.target.checked; if (st.helper) st.helper.visible = st.showBones; };
$("#paint").onchange = (e) => paint(e.target.checked);
$("#play").onclick = () => { st.playing = !st.playing; $("#play").textContent = st.playing ? "Dừng" : "Chạy"; };
$("#reset").onclick = () => { st.adjust = {}; rig(); };
$("#export").onclick = download;

// ---- vòng vẽ -----------------------------------------------------------------------------------------------------------------
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * renderer.getPixelRatio()) || canvas.height !== Math.round(h * renderer.getPixelRatio())) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
}
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  resize();
  if (st.rigged && st.driver) {
    if (st.playing) st.t += dt;
    const clip = clipList(st.set).find((c) => c.name === st.clip) || clipList(st.set)[0];
    poseDriver(st.driver, clip, st.t, dt, clip.loop ? 1 : 1);
    if (!clip.loop && st.t > (clip.dur ?? 1) + 0.6) st.t = 0;
    copyPose(st.driver, st.rigged.byName, st.rigged.rest.hips);
  }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
ui();

window.__rig = {
  load: loadUrl, loadBuffer, sample, rotate: () => $("#rotate").click(), setYaw: (y) => { st.yaw = y; rig(); },
  setClip: (c, t = 0) => { st.clip = c; st.t = t; ui(); }, setSet: (s) => { st.set = s; st.clip = "idle"; rig(); },
  adjust: (o) => { Object.assign(st.adjust, o); rig(); }, pause: (on = true) => { st.playing = !on; },
  paint, exportGLB, camera, controls, st, info: () => st.rigged && { name: st.name, yaw: st.yaw, warnings: st.rigged.warnings, lm: st.rigged.lm.j, info: st.rigged.lm.info },
};
