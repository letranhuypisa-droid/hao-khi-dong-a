// tools/dc-probe.js — đo lượt vẽ mỗi khung trong trang game (?debug, khung trình duyệt; không phải công cụ Node): ghim seed như baseline-b15,
// bot 40 × 5 s, advance(draw), ghi renderer.info.render.calls sau mỗi lần vẽ (gồm lượt bóng), băm vết bot mỗi 10 bước, và (tuỳ chọn) chia lượt
// vẽ của các khung > ngưỡng theo dòng mã dựng vật (tagAdds: tệp:dòng gọi add()). Không phải tệp của game: không ai import, không deploy.
//   1) const P = await import("/tools/dc-probe.js"); await P.prep();   rồi tải lại /?debug (&battle=B16 | B17 | B20) — save mới trước MỖI lượt
//   2) const P = await import("/tools/dc-probe.js"); await P.start(); const r = await P.run({ draw: true, attrib: 140 });
//      r: max, over150, mean, trace (k, ag, st, hero, t mỗi 10 bước); window.__dc.peaks: khung > attrib, lượt vẽ theo nhãn ("S " = lượt bóng)
// Vết: ag (lính còn sống), st (__state()) và hero ở bước 10/20/30/40 trùng cột ag / st / hero của bảng env-place-traces (ghi chú phiên); H là băm
// dồn riêng của tệp này. Chỉ tin lượt vẽ ở tab đang hiện có canvas > 0 (tab nền: camera NaN, vẽ hết); một advance(5) là 151 khung vẽ.
// So hai bản cùng origin: phục vụ bản cũ ở /_base/ (thư mục nối tạm), chụp góc nhìn cố định bằng view / saveShot, so bằng diffShots.
export async function prep() {
  const Pm = await import("/js/meta/progress.js");
  const s = Pm.newSave(); s.settings.difficulty = "quansi"; s.settings.mode = "nhanh"; s.settings.troops = "vua"; s.tutorial = { done: true };
  localStorage.setItem("hkda:save:v1", JSON.stringify(s));
  return true;
}

// tag: ghi chỗ gọi add() (tệp:dòng ngoài three) vào từng vật, để chia lượt vẽ theo dòng mã dựng vật
export async function tagAdds() {
  const THREE = await import("three"), P = THREE.Object3D.prototype;
  if (P.__tagged) return; P.__tagged = true;
  const orig = P.add;
  P.add = function (...objs) {
    const st = new Error().stack.split("\n").slice(2), fr = [];
    for (const l of st) { const m = l.match(/\/([\w.-]+\.js):(\d+):\d+\)?$/); if (m && !/^three\.|dc-probe/.test(m[1])) { fr.push(m[1] + ":" + m[2]); if (fr.length >= 2) break; } }
    for (const o of objs) if (o && !o.__src) o.__src = fr.join("<");
    return orig.apply(this, objs);
  };
}

export async function start(seed = 1001, tag = true) {
  for (let i = 0; i < 300 && !(window.__start && window.__bot && document.querySelector("[data-go]")); i++) await new Promise((r) => setTimeout(r, 100));
  if (tag) await tagAdds();
  Object.defineProperty(document, "hidden", { get: () => false, configurable: true });
  const realNow = Date.now; Date.now = () => seed & 0xffff; window.requestAnimationFrame = () => 0;
  let a = (seed * 2654435761) >>> 0;
  Math.random = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  window.__start();
  for (let i = 0; i < 600 && !(window.__hk && window.__hk.advance && window.__hk.director); i++) await new Promise((r) => setTimeout(r, 100));
  Date.now = realNow;
  for (let i = 0; i < 600 && !window.__hk.warmed; i++) await new Promise((r) => setTimeout(r, 100));
  const ld = document.querySelector(".loading"); if (ld) ld.style.display = "none";
  window.__bt = window.__bot(window.__objective, {});
  return { warmed: window.__hk.warmed, w: window.__hk.renderer.domElement.width, h: window.__hk.renderer.domElement.height, iw: innerWidth, ih: innerHeight };
}

const fnv = (s, h = 2166136261) => { for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
export function traceStep(H) {
  const c = window.__hk, h = c.hero;
  const ag = JSON.stringify(c.crowd.agents.filter((a) => a.alive).map((a) => [a.id, a.role, Math.round(a.x * 100), Math.round(a.z * 100), Math.round(a.hp)]));
  const st = JSON.stringify(window.__state());
  const hs = `${h.x.toFixed(3)},${h.z.toFixed(3)}/${h.hp.toFixed(2)}`;
  return { H: fnv(hs + "|" + ag + "|" + st, H), ag: fnv(ag), st: fnv(st), hero: hs, t: +c.director.time.toFixed(2) };
}

// Nhãn một vật: crowd (kit:LOD), tướng, đơn vị, rồi chuỗi tên cha gần nhất.
function labeler(c) {
  const L = new Map();
  for (const k in c.crowd.meshes) { const M = c.crowd.meshes[k]; (M.meshes || [M.mesh]).forEach((m, l) => L.set(m, "kit:" + k + ":" + l)); }
  L.set(c.crowd.blob, "crowd:blob"); L.set(c.crowd.arrowMesh, "crowd:arrows");
  const roots = new Map();
  if (c.hero?.rig?.root) roots.set(c.hero.rig.root, "hero");
  for (const u of c.units) if (u.rig?.root) roots.set(u.rig.root, "unit:" + (u.def?.id || u.id || u.kind || "?"));
  return (o) => {
    const d = L.get(o); if (d) return d;
    const path = [];
    for (let p = o; p; p = p.parent) {
      const r = roots.get(p); if (r) return r;
      if (p.__src) return p.__src + (p.name ? "#" + p.name : "") + "<" + (o.isInstancedMesh ? "I" : o.isSprite ? "S" : "M") + ">";
      if (p.name) path.push(p.name);
      if (p.parent === c.scene) break;
    }
    return (path.length ? path.slice(0, 3).reverse().join("/") : "?") + "<" + (o.isInstancedMesh ? "I" : o.isSprite ? "S" : o.isPoints ? "P" : o.isLine ? "L" : "M") + ">";
  };
}

// opts: n bước × sec giây; draw: vẽ; attrib: ngưỡng (khung có calls > attrib được chia theo nhóm); every: băm mỗi bước
export async function run({ n = 40, sec = 5, draw = true, attrib = 0, dist = false } = {}) {
  const THREE = await import("three"), _v = new THREE.Vector3();
  const c = window.__hk, R = c.renderer, frames = [], trace = [], peaks = [];
  const origRender = R.render, origRBD = R.renderBufferDirect;
  let cur = null, label = labeler(c);
  R.renderBufferDirect = function (camera, scene, geometry, material, object, group) {
    const before = R.info.render.calls;
    origRBD.call(this, camera, scene, geometry, material, object, group);
    if (cur && R.info.render.calls > before) {
      let k = (scene === null ? "S " : "") + label(object);
      if (dist && scene !== null && !object.isInstancedMesh) { const g = geometry.boundingSphere || (geometry.computeBoundingSphere(), geometry.boundingSphere); _v.copy(g.center).applyMatrix4(object.matrixWorld); k += " @" + Math.round(_v.distanceTo(camera.position) / 50) * 50; }
      cur.set(k, (cur.get(k) || 0) + 1);
    }
  };
  R.render = function (s, cam) {
    if (attrib) cur = new Map();
    origRender.call(this, s, cam);
    const calls = R.info.render.calls, h = c.hero;
    frames.push(calls);
    if (attrib && calls > attrib) peaks.push({ i: frames.length - 1, t: +c.director.time.toFixed(2), calls, cam: [cam.position.x, cam.position.y, cam.position.z].map((v) => Math.round(v)), hero: [Math.round(h.x), Math.round(h.z)], by: [...cur.entries()].sort((a, b) => b[1] - a[1]) });
    cur = null;
  };
  let H = 2166136261;
  try {
    for (let k = 1; k <= n; k++) {
      c.advance(sec, window.__bt, draw);
      const s = traceStep(H); H = s.H;
      if (k % 10 === 0) trace.push({ k, ...s });
      if (c.director.over) { trace.push({ k, over: true, ...s }); break; }
    }
  } finally { R.render = origRender; R.renderBufferDirect = origRBD; }
  const over = frames.filter((x) => x > 150).length, max = Math.max(0, ...frames), mean = frames.reduce((a, b) => a + b, 0) / (frames.length || 1);
  const imax = frames.indexOf(max);
  window.__dc = { frames, peaks, trace };
  return { canvas: [R.domElement.width, R.domElement.height], css: [innerWidth, innerHeight], nFrames: frames.length, max, imax, over150: over, mean: +mean.toFixed(1), trace, nPeaks: peaks.length };
}

// Nhóm lượt vẽ của các khung đỉnh: cộng theo nhãn (đã bỏ hậu tố), trung bình trên các khung > ngưỡng
export function summary(minCalls = 150, cut = 1) {
  const P = window.__dc.peaks.filter((p) => p.calls > minCalls), S = new Map();
  for (const p of P) for (const [k, v] of p.by) S.set(k, (S.get(k) || 0) + v);
  return { n: P.length, rows: [...S.entries()].map(([k, v]) => [k, +(v / P.length).toFixed(2)]).filter((r) => r[1] >= cut).sort((a, b) => b[1] - a[1]) };
}

// ---- ảnh so sánh (cùng origin: bản gốc phục vụ ở /_base/): PNG lưu IndexedDB, so từng điểm ảnh -----------------------------------
const idb = () => new Promise((res, rej) => { const r = indexedDB.open("dcshots", 1); r.onupgradeneeded = () => r.result.createObjectStore("s"); r.onsuccess = () => res(r.result); r.onerror = rej; });
export async function view(p, t, fov = 55) {
  const THREE = await import("three"), c = window.__hk;
  const cam = new THREE.PerspectiveCamera(fov, innerWidth / innerHeight, 0.3, 1400); cam.position.set(...p); cam.lookAt(...t); cam.updateMatrixWorld();
  // lô sprite fx (bản mới) loại theo camera của fx.update: xếp lại theo camera của góc nhìn này (dt 0: không đổi giờ, không đổi gì khác)
  if (c.fx?.batches) { const k = c.fx.camera; c.fx.camera = cam; c.fx.update(0, innerWidth, innerHeight); c.fx.camera = k; }
  c.renderer.render(c.scene, cam);
  const calls = c.renderer.info.render.calls, blob = await new Promise((r) => c.renderer.domElement.toBlob(r, "image/png"));
  return { calls, blob };
}
export async function saveShot(key, blob) {
  const db = await idb();
  await new Promise((res, rej) => { const t = db.transaction("s", "readwrite"); t.objectStore("s").put(blob, key); t.oncomplete = res; t.onerror = rej; });
  return blob.size;
}
async function loadShot(key) {
  const db = await idb();
  const blob = await new Promise((res, rej) => { const q = db.transaction("s").objectStore("s").get(key); q.onsuccess = () => res(q.result); q.onerror = rej; });
  return createImageBitmap(blob);
}
// số điểm ảnh khác (kênh lệch > 2 / > 24), lệch lớn nhất; show: ảnh lệch ×8 phủ lên màn
export async function diffShots(a, b, show = false) {
  const [A, B] = await Promise.all([loadShot(a), loadShot(b)]), w = A.width, h = A.height;
  const px = (I) => { const cv = new OffscreenCanvas(w, h), g = cv.getContext("2d"); g.drawImage(I, 0, 0); return g.getImageData(0, 0, w, h); };
  const P = px(A), Q = px(B), D = new ImageData(w, h);
  let n2 = 0, n24 = 0, mx = 0;
  for (let i = 0; i < P.data.length; i += 4) {
    const d = Math.max(Math.abs(P.data[i] - Q.data[i]), Math.abs(P.data[i + 1] - Q.data[i + 1]), Math.abs(P.data[i + 2] - Q.data[i + 2]));
    if (d > 2) n2++; if (d > 24) n24++; if (d > mx) mx = d;
    D.data[i] = D.data[i + 1] = D.data[i + 2] = Math.min(255, d * 8); D.data[i + 3] = 255;
  }
  if (show) {
    const cv = document.createElement("canvas"); cv.width = w; cv.height = h; cv.getContext("2d").putImageData(D, 0, 0);
    let img = document.getElementById("dcshot"); if (!img) { img = document.createElement("img"); img.id = "dcshot"; img.style.cssText = "position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:99999"; document.body.appendChild(img); }
    img.src = cv.toDataURL();
  }
  return { w, h, diff2: n2, diff24: n24, max: mx };
}

// bộ fx cố định trước một camera cố định (Math.random gieo lại): tia lửa, đòn trúng, bụi, vòng sóng, vòng đỏ, tàn lửa, lửa, vệt chém — so ảnh hai bản
export async function fxScene(T = 0.05) {
  const c = window.__hk, fx = c.fx, h = c.hero;
  let a = 12345; Math.random = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const x = h.x + 6, z = h.z, y = (c.world.groundY || ((q) => 0))(x, z);
  fx.spark(x - 2, y + 1.2, z - 1, true); fx.impact(x, y + 1.2, z, 1, 0, { heavy: true, crit: true, kill: true });
  fx.dust(x + 1.5, z + 1.5, 1.2); fx.ring(x - 1, z + 2, 3, 0xf1d98a, 0.6); fx.ring(x + 2, z - 2, 2, 0xd8321e, 0.6);
  for (let i = 0; i < 6; i++) fx.embers(x, z);
  fx.fire(x + 3, y, z + 3, 20, 3);
  fx.slashArc({ x: x - 1.5, y, z: z - 1.5, yaw: 0.8 }, "N1", { shape: "ring", range: 3 });
  fx.update(T, innerWidth, innerHeight);
  return view([x - 8, y + 4, z + 6], [x, y + 1, z]);
}
