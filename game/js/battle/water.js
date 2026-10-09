// battle/water.js — mặt nước sông Bạch Đằng (B20): một mesh phủ sông cái + ba lạch nhánh, mực nước theo Con nước.
//
// Lưới vuông đều 8 m trên cả bản đồ, chỉ giữ ô có thể ngập khi triều cao (đáy thấp hơn triều cao + 0,5 m ở một
// điểm dò trong ô): một lưới liền, không có đường nối giữa sông cái và lạch (hai lưới chồng nhau lộ vệt ở cửa lạch).
// Không dập dềnh bằng CPU như B15 (world.js đẩy lại cả buffer mỗi khung): đỉnh nằm phẳng y = 0, shader nâng lên
// uTide + sóng. Độ sâu từng điểm ảnh lấy từ uBed (DataTexture độ cao đáy 2 m/texel, R half-float lọc tuyến tính).
//   • alpha = mix(0,35; 0,97; smoothstep(0; 1,2; sâu)) → cọc chìm quá ~1 m khuất hẳn (canon "cọc chìm khuất")
//   • màu nước đục phù sa 0x7a6a48 chỗ nông → xanh rêu 0x2f5d62 chỗ sâu (cùng màu sông B15)
//   • viền bọt sóng động rộng ~1–2 m (theo khoảng cách ngang tới mép nước) bám mép bờ; bỏ điểm ảnh khi sâu < −0,05 (đất
//     khô) — không cần cắt lưới
// Giữ MeshPhongMaterial + onBeforeCompile để còn sương, đèn, bóng đổ, pháp tuyến phẳng (mặt low poly).
// Mọi số là ĐỀ XUẤT BẢN THỬ.

import * as THREE from "three";
import { TIDE, TIDE_Y, WAVES, WAVE_DEPTH } from "../data/terrain-b20.js";

// m mỗi texel của uBed. 2 m (không phải 4 m như hợp đồng §4): đường đồng mức song tuyến trên ô 4 m ra răng cưa rõ ở mép
// nước bờ dốc (bọt sóng, mép nước lởm chởm — world-b20 / lab-b20); 761 × 301 half-float = 458 KB
const TEX_STEP = 2;
const CELL = 8, PROBE = 4;                // ô lưới nước 8 m; dò đáy 5 × 5 điểm mỗi ô (bước 2 m) để không sót mép nước

const COLORS = { shallow: 0x7a6a48, deep: 0x2f5d62, foam: 0xe6dcc3 };

// GLSL sóng sinh từ bảng WAVES (terrain-b20.js) — thuyền dùng waveY() cùng công thức nên nổi đúng mặt nước.
const waveGlsl = () => WAVES.map((w) => `${w.amp.toFixed(4)} * sin(uTime * ${w.w.toFixed(4)} + p.x * ${w.kx.toFixed(4)} + p.y * ${w.kz.toFixed(4)})`).join(" + ");

export class Water {
  constructor(scene, { terrain, bounds = terrain.bounds, shadows = true } = {}) {
    this.scene = scene;
    this.terrain = terrain;
    this.tidePct = 100;
    this.tideY = TIDE_Y(100);

    // ---- bảng độ cao đáy ------------------------------------------------------------------------------------------
    const B = bounds, H = terrain.height;
    const nx = Math.round((B.maxX - B.minX) / TEX_STEP) + 1, nz = Math.round((B.maxZ - B.minZ) / TEX_STEP) + 1;
    const data = new Uint16Array(nx * nz), toH = THREE.DataUtils.toHalfFloat;
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) data[j * nx + i] = toH(H(B.minX + i * TEX_STEP, B.minZ + j * TEX_STEP));
    const tex = new THREE.DataTexture(data, nx, nz, THREE.RedFormat, THREE.HalfFloatType);
    tex.minFilter = tex.magFilter = THREE.LinearFilter;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    this.bedTex = tex;
    // texel (i, j) ở tâm điểm ảnh: uv = (xz − (gốc − nửa texel)) / (số texel · bước)
    const xf = new THREE.Vector4(B.minX - TEX_STEP / 2, B.minZ - TEX_STEP / 2, 1 / (nx * TEX_STEP), 1 / (nz * TEX_STEP));

    // ---- lưới: ô 8 m có thể ngập ở triều cao ------------------------------------------------------------------------
    const cx = Math.ceil((B.maxX - B.minX) / CELL), cz = Math.ceil((B.maxZ - B.minZ) / CELL), wetY = TIDE.high + 0.5;
    const keep = new Uint8Array(cx * cz);
    for (let j = 0; j < cz; j++) for (let i = 0; i < cx; i++) {
      const x0 = B.minX + i * CELL, z0 = B.minZ + j * CELL;
      let wet = 0;
      for (let a = 0; a <= PROBE && !wet; a++) for (let b = 0; b <= PROBE && !wet; b++) if (H(x0 + CELL * a / PROBE, z0 + CELL * b / PROBE) < wetY) wet = 1;
      keep[j * cx + i] = wet;
    }
    const vid = new Int32Array((cx + 1) * (cz + 1)).fill(-1), pos = [], idx = [];
    const v = (i, j) => { const k = j * (cx + 1) + i; if (vid[k] < 0) { vid[k] = pos.length / 3; pos.push(B.minX + i * CELL, 0, B.minZ + j * CELL); } return vid[k]; };
    for (let j = 0; j < cz; j++) for (let i = 0; i < cx; i++) {
      if (!keep[j * cx + i]) continue;
      const a = v(i, j), b = v(i, j + 1), c = v(i + 1, j + 1), d = v(i + 1, j);
      if ((i + j) & 1) idx.push(a, b, c, a, c, d); else idx.push(a, b, d, b, c, d);   // chéo xen kẽ: mặt low poly đều tay
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    this.tris = idx.length / 3;

    // ---- vật liệu ----------------------------------------------------------------------------------------------------
    const mat = new THREE.MeshPhongMaterial({ color: COLORS.deep, specular: 0xf1d98a, shininess: 60, flatShading: true, transparent: true });
    const U = this.uniforms = {
      uTime: { value: 0 }, uTide: { value: this.tideY }, uBed: { value: tex }, uBedXf: { value: xf },
      uShallow: { value: new THREE.Color(COLORS.shallow) }, uDeep: { value: new THREE.Color(COLORS.deep) }, uFoam: { value: new THREE.Color(COLORS.foam) },
    };
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", `#include <common>
uniform float uTime, uTide; uniform sampler2D uBed; uniform vec4 uBedXf;
varying vec2 vWXZ;`)
        .replace("#include <begin_vertex>", `#include <begin_vertex>
{ vec2 p = (modelMatrix * vec4(position, 1.0)).xz;
  float dep = uTide - texture2D(uBed, (p - uBedXf.xy) * uBedXf.zw).r;
  transformed.y = uTide + (${waveGlsl()}) * smoothstep(${WAVE_DEPTH[0].toFixed(3)}, ${WAVE_DEPTH[1].toFixed(3)}, dep);   // sát bờ lặng sóng (waveDepthK)
  vWXZ = p; }`);
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", `#include <common>
uniform float uTime, uTide; uniform sampler2D uBed; uniform vec4 uBedXf; uniform vec3 uShallow, uDeep, uFoam;
varying vec2 vWXZ;`)
        .replace("vec4 diffuseColor = vec4( diffuse, opacity );", `
vec2 bedUv = (vWXZ - uBedXf.xy) * uBedXf.zw;
float depth = uTide - texture2D(uBed, bedUv).r;
if (depth < -0.05) discard;                                // đất khô: để lộ địa hình
vec3 wcol = mix(uShallow, uDeep, smoothstep(0.2, 3.0, depth));
float walpha = mix(0.35, 0.97, smoothstep(0.0, 1.2, depth));
// bọt tính theo khoảng cách ngang tới mép nước hd = sâu / độ dốc đáy (sai phân trung tâm 4 m trên uBed), không theo độ sâu:
// bãi bùn gần phẳng (dốc 2–5%) thì dải "sâu < 0,35 m" rộng cả chục mét, nhiễu bọt vẽ thành răng cưa chéo — nay dải bọt
// luôn rộng ~1–2 m dù bờ dốc hay bãi phẳng (world-b20 / lab-b20)
vec2 bedE = 2.0 * uBedXf.zw;
float bgx = texture2D(uBed, bedUv + vec2(bedE.x, 0.0)).r - texture2D(uBed, bedUv - vec2(bedE.x, 0.0)).r;
float bgz = texture2D(uBed, bedUv + vec2(0.0, bedE.y)).r - texture2D(uBed, bedUv - vec2(0.0, bedE.y)).r;
float hd = max(depth, 0.0) / max(0.25 * length(vec2(bgx, bgz)), 0.04);
// bọt: dải sát mép gợn theo hai sóng chéo, cộng một vệt bọt chạy ra vào theo nhịp sóng vỗ
float n = sin(vWXZ.x * 0.43 + uTime * 1.3) * sin(vWXZ.y * 0.37 - uTime * 0.9) + 0.35 * sin(vWXZ.x * 1.7 - vWXZ.y * 1.3 + uTime * 2.1);
float edge = 1.0 - smoothstep(0.0, 1.6, hd);
float lineD = 2.2 + 0.9 * sin(uTime * 0.8 + vWXZ.x * 0.05 + vWXZ.y * 0.03);
float line = 1.0 - smoothstep(0.15, 0.45, abs(hd - lineD));
float foam = max(smoothstep(0.5, 0.72, edge + 0.16 * n), line * smoothstep(-0.2, 0.4, n) * 0.75);
wcol = mix(wcol, uFoam, foam * 0.85);
walpha = max(walpha, foam * 0.9);
vec4 diffuseColor = vec4(wcol, walpha * opacity);`);
    };
    mat.customProgramCacheKey = () => "b20-water";
    this.material = mat;

    const mesh = this.mesh = new THREE.Mesh(geo, mat);
    mesh.name = "water-b20";
    mesh.receiveShadow = !!shadows;
    mesh.frustumCulled = false;             // đỉnh nâng trong shader: hộp bao của lưới (y = 0) không đúng
    scene.add(mesh);
  }

  // Con nước pct 0..100 → uTide (mét). Rẻ, gọi mỗi khung được.
  setTide(pct) { this.tidePct = pct; this.tideY = this.uniforms.uTide.value = TIDE_Y(pct); }
  update(t) { this.uniforms.uTime.value = t; }
  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose(); this.material.dispose(); this.bedTex.dispose();
  }
}

// Vá vật liệu địa hình (MeshLambert/Phong/Standard) cho dải bùn ướt: điểm ảnh dưới mức triều cao sẫm lại (bùn triều),
// dải ngay trên mép nước hiện tại sẫm và bóng hơn nữa (nước vừa rút). getTideY() → mực nước hiện tại (m), đọc mỗi lần
// vẽ (uniform có getter) nên không cần gọi gì mỗi khung. Giữ onBeforeCompile cũ nếu có. Trả lại material.
export function wetBandMaterialPatch(material, getTideY, { high = TIDE.high, dark = 0.74, sheen = 0.8 } = {}) {
  const base = material.onBeforeCompile;
  const uTideY = { get value() { return getTideY(); } };
  material.onBeforeCompile = (sh, r) => {
    if (base) base.call(material, sh, r);
    sh.uniforms.uWetTide = uTideY;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying float vWetY;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvWetY = (modelMatrix * vec4(transformed, 1.0)).y;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vWetY; uniform float uWetTide;")
      .replace("#include <color_fragment>", `#include <color_fragment>
{ float wet = 1.0 - smoothstep(${(high - 0.1).toFixed(3)}, ${(high + 0.25).toFixed(3)}, vWetY);   // bùn triều
  float fresh = 1.0 - smoothstep(uWetTide, uWetTide + 0.7, vWetY);                              // vừa rút
  diffuseColor.rgb *= mix(1.0, ${dark.toFixed(3)}, wet) * mix(1.0, ${sheen.toFixed(3)}, fresh * wet); }`);
  };
  const key = material.customProgramCacheKey?.bind(material);
  material.customProgramCacheKey = () => (key ? key() : "") + "|wetband";
  material.needsUpdate = true;
  return material;
}
