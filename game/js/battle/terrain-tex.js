// battle/terrain-tex.js — chi tiết bề mặt cho địa hình lưới tam giác phẳng (màu theo đỉnh) bằng texture đất dirt_1k, rocky_terrain_1k (gói kiểu Poly Haven, xem assets/SOURCES.md;
// nén bằng tools/bake-terrain-tex.py thành assets/terrain/*.webp 512 px).
//
// Màu nền vẫn là màu đỉnh của từng tam giác (cỏ, đường, đất đắp, cát… do world.js tô); texture chỉ thêm HOA VĂN: shader chia texel cho màu trung bình của texture
// (DIRT_MEAN / ROCK_MEAN, do bake-terrain-tex.py in ra) nên hoa văn dao động quanh 1 và nhân vào màu nền — không đổi tông màu của bản đồ. Toạ độ texture theo mặt
// phẳng thế giới (x, −z), không cần UV: đất bằng, gò thoải (< 20°) nên chiếu phẳng không bị kéo giãn đáng kể; xa thì mipmap tự trung bình về 1.
//
// Hai thuộc tính đỉnh aSplat = (đất, đá), phẳng trên cả tam giác như màu: đất (đường, vệt giẫm, mái lũy, đáy hào, nền đồn, sân) tô hoa văn đất mịn + pháp tuyến đất
// (hạt, sỏi); đá (gò đá) tô hoa văn phiến đá xen cỏ của rocky_terrain + pháp tuyến phiến. Trọng số đá được nhiễu thế giới xé biên nên mép gò không lộ hình tam giác.
// Cỏ (không có trọng số) vẫn nhận một lớp hoa văn đất mờ (BASE_DIRT) để mặt đất không phẳng lì. Vật không có aSplat (lớp phủ, gò đầm B17) đọc (0, 0) = chỉ lớp nền.
//
// Pháp tuyến: tangent space OpenGL, khung tiếp tuyến dựng trong không gian nhìn từ trục x, z của thế giới chiếu lên mặt tam giác (nên đúng cả trên mái dốc).
// Texture nạp bất đồng bộ (loadTerrainTextures, main.js nạp sớm cùng mô hình); chưa có thì uTexOn = 0 → đúng như trước (chỉ màu đỉnh). ?notex tắt hẳn.

import * as THREE from "three";

export const DIRT_MEAN = [0.1257, 0.0855, 0.049], ROCK_MEAN = [0.1526, 0.0857, 0.0346];   // trung bình TUYẾN TÍNH (bake-terrain-tex.py)
// Cỡ một ô texture trên mặt đất (m): đất mịn / đất xa (xoá lặp, sắc độ lốm đốm to) / phiến đá. Texture Poly Haven: dirt phủ 2 m, rocky_terrain phủ 90 m — game cỡ nhỏ hơn.
export const TILE = { dirt: 5.5, dirtFar: 37, rock: 26 };
const ROCK_ANGLE = 0.55;
export const STRENGTH = { baseDirt: 0.72, dirt: 0.85, rock: 0.95, normalDirt: 0.55, normalRock: 0.8 };
const BASE = typeof URL !== "undefined" ? new URL("../../assets/terrain/", import.meta.url) : null;
export const terrainTexOn = () => !(typeof location !== "undefined" && /[?&]notex\b/.test(location.search));

let TEX = null;
function loadTex(name, srgb) {
  return new Promise((resolve) => {
    new THREE.TextureLoader().load(new URL(name, BASE).href, (t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
      resolve(t);
    }, undefined, () => resolve(null));
  });
}
// Nạp (một lần) bốn texture; thiếu / lỗi mạng thì null và địa hình giữ màu đỉnh như cũ. Node (kiểm thử) không nạp.
export function loadTerrainTextures() {
  if (TEX) return TEX;
  if (typeof document === "undefined" || typeof Image === "undefined" || !BASE || !terrainTexOn()) return (TEX = Promise.resolve(null));     // Node (kể cả kiểm thử có document giả) không nạp
  return (TEX = Promise.all([loadTex("dirt_d.webp", true), loadTex("dirt_n.webp", false), loadTex("rock_d.webp", true), loadTex("rock_n.webp", false)])
    .then(([dirtD, dirtN, rockD, rockN]) => (dirtD && dirtN && rockD && rockN ? { dirtD, dirtN, rockD, rockN } : null)).catch(() => null));
}

const VERT_DECL = `
attribute vec2 aSplat;
varying vec2 vSplat;
varying vec3 vWPos;
`;
const VERT_BODY = `
  vSplat = aSplat;
  vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
`;
const v3 = (a) => `vec3(${a.map((x) => x.toFixed(4)).join(", ")})`;
const FRAG_DECL = `
uniform sampler2D uDirtD, uDirtN, uRockD, uRockN;
uniform float uTexOn;
uniform vec4 uTile;      // 1 / ô: dirt, dirtFar, rock
uniform vec4 uStr;       // baseDirt, dirt, rock, (chưa dùng)
uniform vec2 uNStr;      // pháp tuyến: đất, đá
varying vec2 vSplat;
varying vec3 vWPos;
const vec3 DIRT_MEAN = ${v3(DIRT_MEAN)};
const vec3 ROCK_MEAN = ${v3(ROCK_MEAN)};
const mat2 ROCK_ROT = mat2(${Math.cos(ROCK_ANGLE).toFixed(4)}, ${Math.sin(ROCK_ANGLE).toFixed(4)}, ${(-Math.sin(ROCK_ANGLE)).toFixed(4)}, ${Math.cos(ROCK_ANGLE).toFixed(4)});   // xoay hoa văn phiến đá: các dải ngang song song của texture không lộ như lát sân
float tHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float tNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(tHash(i), tHash(i + vec2(1.0, 0.0)), f.x), mix(tHash(i + vec2(0.0, 1.0)), tHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
`;
// sau color_fragment: nhân hoa văn vào màu nền; ghi lại kd, kr cho khối pháp tuyến
const FRAG_COLOR = `
  vec2 tP = vec2(vWPos.x, -vWPos.z);
  float tMk = tNoise(tP * 0.045);
  float tKr = clamp(smoothstep(0.3, 0.7, vSplat.y + (tNoise(tP * 0.31 + 7.0) - 0.5) * 0.55 + (tMk - 0.5) * 0.25) * step(0.02, vSplat.y), 0.0, 1.0);
  float tKd = clamp(uStr.x + vSplat.x * (1.0 - uStr.x), 0.0, 1.0);
  vec3 tDirt = texture2D(uDirtD, tP * uTile.x).rgb / DIRT_MEAN;
  vec3 tDirtFar = texture2D(uDirtD, tP * uTile.y + vec2(0.31, 0.77)).rgb / DIRT_MEAN;
  vec3 tRel = mix(vec3(1.0), tDirt * mix(vec3(1.0), tDirtFar, 0.6), tKd * uStr.y);
  vec3 tRock = texture2D(uRockD, ROCK_ROT * tP * uTile.z).rgb / ROCK_MEAN;
  tRel = mix(tRel, mix(vec3(1.0), tRock, uStr.z), tKr);
  diffuseColor.rgb *= mix(vec3(1.0), clamp(tRel, 0.25, 2.4), uTexOn);
`;
// thay normal_fragment_maps: nhiễu pháp tuyến bằng khung tiếp tuyến thế giới (x, −z) chiếu lên mặt tam giác (trong không gian nhìn)
const FRAG_NORMAL = `
  {
    // chưa nạp texture (uTexOn = 0): sampler rỗng đọc ra 0 → pháp tuyến (−1, −1, −1) lật mặt xuống, tối đen; giữ pháp tuyến phẳng (0, 0, 1)
    vec3 tNd = mix(vec3(0.0, 0.0, 1.0), texture2D(uDirtN, tP * uTile.x).xyz * 2.0 - 1.0, uTexOn);
    vec3 tNr = mix(vec3(0.0, 0.0, 1.0), texture2D(uRockN, ROCK_ROT * tP * uTile.z).xyz * 2.0 - 1.0, uTexOn);
    tNr.xy = tNr.xy * ROCK_ROT;      // q = R·p ⇒ độ dốc theo p = Rᵀ·độ dốc theo q (v * M = Mᵀ v)
    float tNk = mix(uNStr.x * mix(0.35, 1.0, tKd), uNStr.y, tKr) * uTexOn;
    vec3 tNt = normalize(vec3(mix(tNd.xy, tNr.xy, tKr) * tNk, mix(tNd.z, tNr.z, tKr)));
    vec3 tT = mat3(viewMatrix) * vec3(1.0, 0.0, 0.0);
    tT = normalize(tT - normal * dot(tT, normal));
    vec3 tB = cross(normal, tT);
    normal = normalize(tT * tNt.x + tB * tNt.y + normal * tNt.z);
  }
`;

// Vật liệu địa hình: Lambert màu đỉnh + phẳng như cũ, thêm chi tiết texture. opts như MeshLambertMaterial (polygonOffset của lớp phủ…).
export function terrainMaterial(opts = {}) {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, ...opts });
  const U = {
    uDirtD: { value: null }, uDirtN: { value: null }, uRockD: { value: null }, uRockN: { value: null }, uTexOn: { value: 0 },
    uTile: { value: new THREE.Vector4(1 / TILE.dirt, 1 / TILE.dirtFar, 1 / TILE.rock, 0) },
    uStr: { value: new THREE.Vector4(STRENGTH.baseDirt, STRENGTH.dirt, STRENGTH.rock, 0) },
    uNStr: { value: new THREE.Vector2(STRENGTH.normalDirt, STRENGTH.normalRock) },
  };
  mat.userData.terrainTex = U;
  mat.customProgramCacheKey = () => "terrainTex1";
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>" + VERT_DECL).replace("#include <begin_vertex>", "#include <begin_vertex>" + VERT_BODY);
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>" + FRAG_DECL)
      .replace("#include <color_fragment>", "#include <color_fragment>" + FRAG_COLOR).replace("#include <normal_fragment_maps>", FRAG_NORMAL);
  };
  loadTerrainTextures().then((T) => {
    if (!T) return;
    U.uDirtD.value = T.dirtD; U.uDirtN.value = T.dirtN; U.uRockD.value = T.rockD; U.uRockN.value = T.rockN; U.uTexOn.value = 1;
  });
  return mat;
}

// Thuộc tính aSplat (đất, đá) cho n đỉnh từ hai mảng trọng số 0..1 (cùng độ dài n, theo đỉnh).
export function splatAttribute(dirt, rock) {
  const a = new Float32Array(dirt.length * 2);
  for (let i = 0; i < dirt.length; i++) { a[i * 2] = dirt[i]; a[i * 2 + 1] = rock[i]; }
  return new THREE.BufferAttribute(a, 2);
}
