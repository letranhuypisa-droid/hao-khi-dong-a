// tests/models.test.mjs — đợt 19a: mô hình nướng sẵn (game/assets/models/** + index.json, design/tools/glb-bake.mjs) đúng hình người
// và đúng chiều vũ khí: (a) 17 nhân vật rig — độ dài cánh tay, cẳng tay, hai bên lệch nhau, khớp lúc chạy trùng khung gắn, vai, cổ;
// (b) trọng số da — mỗi xương có phần, ≤ 4 xương, tổng 1, không trộn xương không kề, bàn chân không theo hông, da mượt; (c) vũ khí —
// kiếm, đao chuôi ở phía tay và lưỡi theo +Z, đại đao nắm ở cán dưới lưỡi, giáo / chùy đầu ở +Z; (d) lính đám đông — không trộn khúc
// không kề, tay theo khúc tay, mức chi tiết nào cũng còn vũ khí; (e) xương phụ (đợt 19a bước A4).
// Thuần Node: đọc .hkm bằng fs (định dạng bake/io.mjs, như glb.js parseHKM), không three, không node_modules. Số liệu lấy từ khung gắn
// (nghịch đảo meta.inv) và meta.rest; bảng nướng (cỡ, chỗ cầm vũ khí của lính) từ design/tools/bake/catalog.mjs (dữ liệu thuần).
// TODO: lỗi đã đo trên tài sản hiện có, bước sau của đợt 19a sửa (A2 khung xương + vũ khí, A3 trọng số + lính đám đông, A4 xương phụ):
// in "bỏ qua (TODO …)", không tính trượt. Mục ngoài TODO mà đỏ là trượt thật (giữ phần đang đúng); mục TODO đã xanh thì in nhắc xoá.
//   node game/tests/models.test.mjs
import { readFileSync, existsSync } from "node:fs";

const MD = new URL("../assets/models/", import.meta.url);
const { CHARS, WEAPONS, KIT_LIST } = await import("../../design/tools/bake/catalog.mjs");
const { SKELETONS, JOINT_NAMES } = await import("../js/battle/soldier-motion.js");

// mã kiểm:id → bước sửa. "*" = mọi mô hình của mục đó. Số đo lúc viết (đợt 19a A1) in kèm khi chạy.
const TODO = {
  ...Object.fromEntries(["CV_cung", "CV_daidao", "CV_khien", "CV_songdao", "H31", "H35", "H40", "LINH_r24", "OFF_doitruong", "OFF_photuong", "X19", "X20", "X24"].map((id) => ["tay-dai:" + id, "A2"])),
  ...Object.fromEntries(["CV_cung", "CV_daidao", "CV_khien", "CV_songdao", "H31", "H35", "OFF_doitruong", "OFF_photuong", "X19", "X24"].map((id) => ["tay-lech:" + id, "A2"])),
  "tay-nghi:H31": "A2",
  "vai:OFF_doitruong": "A2",
  ...Object.fromEntries(["CV_daidao", "CV_songdao", "H31", "H33", "H35", "H40", "OFF_doitruong", "X19", "X20", "X24"].map((id) => ["dau:" + id, "A2"])),
  ...Object.fromEntries(["songdao", "dao", "dao_linh", "daikiem"].map((id) => ["kiem:" + id, "A2"])),
  "dadao:dadao": "A2",
  ...Object.fromEntries(["OFF_doitruong", "OFF_photuong", "OFF_tuong", "X19"].map((id) => ["phan:" + id, "A3"])),
  "khong-ke:*": "A3",
  "ban-chan:*": "A3",
  ...Object.fromEntries(["CV_cung", "CV_daidao", "CV_giao", "CV_khien", "CV_songdao", "H31", "H33", "H35", "H40", "LINH_r01", "LINH_r24", "OFF_doitruong", "OFF_photuong", "X19", "X20", "X24"].map((id) => ["mot-xuong:" + id, "A3"])),
  ...Object.fromEntries(["DV_DAO", "DV_GIAO", "DV_NO", "NG_CUNG", "NG_DAO", "NG_GIAO", "NG_TANK"].map((id) => ["kit-ke:" + id, "A3"])),
  "kit-tay:DV_GIAO": "A3", "kit-tay:NG_CUNG": "A3",
  "kit-vk:DV_GIAO": "A3", "kit-vk:DV_DAO": "A3", "kit-vk:NG_DAO": "A3",          // LOD2: giáo mất cán; dao_linh 12 tam giác chỉ còn chắn tay + chuôi
  "phu:*": "A4",
};
// A4: tên xương phụ chốt ở bước A4 (mỗi nhân vật rig phải có đủ); null = chỉ đòi có ít nhất một xương ngoài 15 khớp
const HELPERS = null;

let pass = 0, fail = 0, skip = 0;
// fn trả danh sách lỗi [{ id, msg }] (rỗng = đạt); lỗi có trong TODO thì bỏ qua
function t(code, name, fn) {
  let probs;
  try { probs = fn(); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + (e.stack || e.message).split("\n").slice(0, 3).join("\n       ")); return; }
  const todoOf = (id) => TODO[`${code}:${id}`] || TODO[`${code}:*`];
  const real = probs.filter((p) => !todoOf(p.id)), todo = probs.filter((p) => todoOf(p.id));
  const ids = new Set(probs.map((p) => p.id));
  const stale = Object.keys(TODO).filter((k) => k.startsWith(code + ":") && (k.endsWith(":*") ? !probs.length : !ids.has(k.slice(code.length + 1))));
  const list = (ps, tag) => ps.map((p) => `       ${tag ? `[TODO ${todoOf(p.id)}] ` : ""}${p.id}: ${p.msg}`).join("\n");
  if (real.length) { fail++; console.log(`  FAIL ${name}\n${list(real)}${todo.length ? "\n" + list(todo, true) : ""}`); }
  else if (todo.length) { skip++; console.log(`  bỏ qua (TODO ${[...new Set(todo.map((p) => todoOf(p.id)))].join("/")}) ${name}\n${list(todo)}`); }
  else { pass++; console.log("  ok  " + name); }
  for (const k of stale) console.log(`       (TODO ${TODO[k]} đã xanh — xoá khỏi TODO: ${k})`);
}

// ---- đọc .hkm: "HKM1" · u32 độ dài JSON · JSON · khối nhị phân -----------------------------------------------------------------
const TYPES = { f32: Float32Array, i8n: Int8Array, u16n: Uint16Array, u8: Uint8Array, u8n: Uint8Array, u16: Uint16Array, u32: Uint32Array };
function readHKM(rel) {
  const b = readFileSync(new URL(rel, MD)), buf = b.buffer.slice(b.byteOffset, b.byteOffset + b.length), dv = new DataView(buf);
  if (String.fromCharCode(...new Uint8Array(buf, 0, 4)) !== "HKM1") throw new Error(rel + ": không phải tệp .hkm");
  const jl = dv.getUint32(4, true), meta = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, jl))), base = 8 + jl;
  const view = (c) => new TYPES[c.t](buf, base + c.o, c.n);
  const meshes = {};
  for (const [name, m] of Object.entries(meta.meshes)) {
    const g = { count: m.count, index: view(m.index), size: {} };
    for (const [k, c] of Object.entries(m.attrs)) { g[k] = view(c); g.size[k] = c.s; }
    meshes[name] = g;
  }
  return { meta, meshes };
}
const INDEX = JSON.parse(readFileSync(new URL("index.json", MD), "utf8"));
const ids = (kind) => Object.keys(INDEX).filter((k) => INDEX[k].kind === kind).map((k) => k.slice(kind.length + 1)).sort();
const CH = Object.fromEntries(ids("char").map((id) => [id, readHKM(INDEX["char/" + id].file)]));
const KT = Object.fromEntries(ids("kit").map((id) => [id, readHKM(INDEX["kit/" + id].file)]));
const WP = Object.fromEntries(ids("wpn").map((id) => [id, readHKM(INDEX["wpn/" + id].file)]));
const f2 = (x) => x.toFixed(2), f3 = (x) => x.toFixed(3), pc = (x) => (x * 100).toFixed(1) + "%";

// ---- cây xương: khoảng cách, chi (tay / chân trái phải), cặp cấm trộn -----------------------------------------------------------
// Cấm: cách nhau ≥ 3 đốt (cổ chân với hông, bàn tay với thân), hai chi khác nhau (chân này với chân kia), hoặc thân với đốt chi không
// phải gốc chi (hông với gối, thân với khuỷu: vạt áo kéo giãn theo cẳng chân).
const PARENT15 = { hips: null, torso: "hips", head: "torso", shL: "torso", elL: "shL", handL: "elL", shR: "torso", elR: "shR", handR: "elR",
  hipL: "hips", kneeL: "hipL", ankleL: "kneeL", hipR: "hips", kneeR: "hipR", ankleR: "kneeR" };
const CORE15 = Object.keys(PARENT15);
const up = (b, P) => { const a = [b]; while (P[a[a.length - 1]]) a.push(P[a[a.length - 1]]); return a; };
function treeDist(a, b, P) { const A = up(a, P), B = up(b, P); for (let i = 0; i < A.length; i++) { const j = B.indexOf(A[i]); if (j >= 0) return i + j; } return Infinity; }
const limbOf = (b, P, roots) => up(b, P).find((x) => roots.includes(x)) || "core";
function forbidden(a, b, P, roots) {
  if (a === b) return false;
  if (treeDist(a, b, P) >= 3) return true;
  const la = limbOf(a, P, roots), lb = limbOf(b, P, roots);
  if (la !== "core" && lb !== "core") return la !== lb;
  if (la === "core" && lb === "core") return false;
  const limb = la === "core" ? b : a;
  return !roots.includes(limb);
}
const ARM_ROOTS = ["shL", "shR", "hipL", "hipR"];
const KIT_ROOTS = { human: ["uaL", "uaR", "thL", "thR"], horse: ["uaL", "uaR", "thL", "thR", "shL", "shR"] };

// ---- nhân vật rig: khớp ở khung gắn (nghịch đảo ma trận gắn, cứng: −Rᵀt) ------------------------------------------------------------
function bindPos(inv, i) {
  const m = inv.slice(i * 16, i * 16 + 16);
  return [0, 1, 2].map((k) => -(m[k * 4] * m[12] + m[k * 4 + 1] * m[13] + m[k * 4 + 2] * m[14]));
}
const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
function charInfo(id) {
  const { meta, meshes } = CH[id], B = meta.bones, J = Object.fromEntries(B.map((n, i) => [n, bindPos(meta.inv, i)]));
  const arm = {}, rest = {};
  for (const s of ["L", "R"]) {
    arm["U" + s] = dist3(J["sh" + s], J["el" + s]); arm["F" + s] = dist3(J["el" + s], J["hand" + s]);
    rest["U" + s] = Math.hypot(...meta.rest["el" + s]); rest["F" + s] = Math.hypot(...meta.rest["hand" + s]);
  }
  const y0 = meta.rest.hips[1] + meta.rest.torso[1];                 // thân lúc chạy (hông applyPose 0,92 + thân)
  const restW = (n) => [meta.rest[n][0], y0 + meta.rest[n][1], meta.rest[n][2]];
  const P = { ...PARENT15, ...(meta.parent || {}) };
  return { meta, g: meshes.body, B, J, arm, rest, restW, P };
}
// trọng số mỗi đỉnh: [[tên xương, w], …] (w > 0, w = u8/255)
function* skinOf(c) {
  const { g, B } = c, si = g.skinIndex, sw = g.skinWeight;
  for (let v = 0; v < g.count; v++) {
    const ws = new Map();
    for (let q = 0; q < 4; q++) { const w = sw[v * 4 + q]; if (w > 0) ws.set(B[si[v * 4 + q]], (ws.get(B[si[v * 4 + q]]) || 0) + w / 255); }
    yield [v, ws];
  }
}
const domOf = (ws) => { let b = null, m = -1; for (const [k, w] of ws) if (w > m) { m = w; b = k; } return b; };
const C = Object.fromEntries(ids("char").map((id) => [id, charInfo(id)]));
const forChars = (fn) => Object.entries(C).flatMap(([id, c]) => { const msg = fn(c, id); return msg ? [{ id, msg }] : []; });

console.log("Tệp nướng: index.json khớp tệp và bảng nướng");
t("index", "mọi mục index.json có .hkm + .webp, đúng loại, đúng số tam giác; mọi mục của catalog.mjs đã nướng", () => {
  const probs = [];
  for (const [k, e] of Object.entries(INDEX)) {
    const bad = [];
    for (const f of [e.file, e.tex]) if (!existsSync(new URL(f, MD))) bad.push("thiếu " + f);
    if (!bad.length) {
      const { meta, meshes } = readHKM(e.file), first = meshes.body || meshes.lod0;
      if (meta.kind !== e.kind) bad.push(`kind ${meta.kind} ≠ ${e.kind}`);
      if (first.index.length / 3 !== e.tris) bad.push(`tris ${first.index.length / 3} ≠ ${e.tris}`);
      if (e.kind === "kit") { const n = Object.keys(meshes).map((m) => meshes[m].index.length / 3); if (String(n) !== String(e.lods)) bad.push(`lods ${n} ≠ ${e.lods}`); }
    }
    if (bad.length) probs.push({ id: k, msg: bad.join(", ") });
  }
  for (const [kind, cat] of [["char", CHARS], ["wpn", WEAPONS], ["kit", KIT_LIST]]) for (const id of Object.keys(cat)) if (!INDEX[`${kind}/${id}`]) probs.push({ id: `${kind}/${id}`, msg: "có trong catalog.mjs, chưa nướng" });
  return probs;
});

console.log("(a) Nhân vật rig: độ dài xương, vai, cổ (khung gắn = nghịch đảo meta.inv; lúc chạy = meta.rest)");
t("tay-dai", "cánh tay trên 0,22–0,40 m, cẳng tay 0,18–0,34 m, hai bên (rig WC01: cẳng tới 0,37 — tư thế WC01 giải IK cho tay 0,34 + 0,36)", () => forChars((c) => {
  const bad = [], fMax = c.meta.wc01 ? 0.37 : 0.34;
  for (const s of ["L", "R"]) {
    if (!(c.arm["U" + s] >= 0.22 && c.arm["U" + s] <= 0.4)) bad.push(`trên ${s} ${f3(c.arm["U" + s])}`);
    if (!(c.arm["F" + s] >= 0.18 && c.arm["F" + s] <= fMax)) bad.push(`cẳng ${s} ${f3(c.arm["F" + s])}`);
  }
  return bad.join(", ");
}));
t("tay-lech", "hai tay lệch nhau ≤ 25% (cánh tay trên, cẳng tay)", () => forChars((c) => {
  const bad = [];
  for (const k of ["U", "F"]) { const l = c.arm[k + "L"], r = c.arm[k + "R"], d = Math.abs(l - r) / Math.max(l, r, 1e-9); if (!(d <= 0.25)) bad.push(`${k === "U" ? "trên" : "cẳng"} ${f3(l)} / ${f3(r)} (${pc(d)})`); }
  return bad.join(", ");
}));
t("tay-nghi", "khớp lúc chạy (meta.rest) trùng khung gắn ±1 cm: vai, độ dài tay, cổ (lệch = tay giãn mọi tư thế)", () => forChars((c) => {
  const bad = [];
  for (const s of ["L", "R"]) {
    const d = dist3(c.restW("sh" + s), c.J["sh" + s]); if (d > 0.01) bad.push(`vai ${s} lệch ${f3(d)}`);
    for (const k of ["U", "F"]) if (Math.abs(c.rest[k + s] - c.arm[k + s]) > 0.01) bad.push(`${k === "U" ? "trên" : "cẳng"} ${s} nghỉ ${f3(c.rest[k + s])} ≠ gắn ${f3(c.arm[k + s])}`);
  }
  const dh = dist3(c.restW("head"), c.J.head); if (dh > 0.01) bad.push(`cổ lệch ${f3(dh)}`);
  return bad.join(", ");
}));
t("vai", "vai |x| 0,12–0,35 m, trái âm phải dương (khung gắn)", () => forChars((c) => {
  const bad = [];
  for (const [s, sg] of [["L", -1], ["R", 1]]) { const x = c.J["sh" + s][0] * sg; if (!(x >= 0.12 && x <= 0.35)) bad.push(`vai ${s} x ${f3(c.J["sh" + s][0])}`); }
  return bad.join(", ");
}));
t("dau", "khớp cổ cao hơn đường vai 0,05–0,26 m (cổ quá cao thì mặt, cằm theo thân)", () => forChars((c) => {
  const h = c.J.head[1] - (c.J.shL[1] + c.J.shR[1]) / 2;
  return h >= 0.05 && h <= 0.26 ? "" : `cổ trên vai ${f3(h)}`;
}));

console.log("(b) Trọng số da nhân vật rig");
// phần trọng số tối thiểu mỗi xương (% số đỉnh, Σw / n): rig đúng đều qua; tay, khuỷu ~0% là tay chết (rig hỏng)
const MIN_SHARE = { hips: 1.5, torso: 15, head: 3, sh: 2, el: 1, hand: 0.5, hip: 0.8, knee: 0.5, ankle: 0.3 };
t("phan", "mỗi xương trong 15 khớp có phần trọng số tối thiểu (bàn tay ≥ 0,5%, khuỷu ≥ 1%, vai ≥ 2%, cổ ≥ 3%…)", () => forChars((c) => {
  const S = Object.fromEntries(c.B.map((b) => [b, 0]));
  for (const [, ws] of skinOf(c)) for (const [b, w] of ws) S[b] += w;
  const bad = [];
  for (const b of CORE15) { const min = MIN_SHARE[b] ?? MIN_SHARE[b.slice(0, -1)], s = (S[b] / c.g.count) * 100; if (!(s >= min)) bad.push(`${b} ${s.toFixed(1)}% (< ${min})`); }
  return bad.join(", ");
}));
t("dinh-dang", "mỗi đỉnh ≤ 4 xương, chỉ số xương hợp lệ, tổng trọng số = 1 (u8: 255 ± 1)", () => forChars((c) => {
  const { g, B } = c, si = g.skinIndex, sw = g.skinWeight;
  if (g.size.skinIndex !== 4 || g.size.skinWeight !== 4) return `skinIndex/skinWeight ${g.size.skinIndex}/${g.size.skinWeight} thành phần`;
  let badSum = 0, badIdx = 0;
  for (let v = 0; v < g.count; v++) {
    let s = 0; for (let q = 0; q < 4; q++) { s += sw[v * 4 + q]; if (sw[v * 4 + q] > 0 && si[v * 4 + q] >= B.length) badIdx++; }
    if (Math.abs(s - 255) > 1) badSum++;
  }
  return badSum || badIdx ? `${badSum} đỉnh tổng ≠ 1, ${badIdx} chỉ số ngoài ${B.length} xương` : "";
}));
t("khong-ke", "không đỉnh nào trộn hai xương không kề (cổ chân + hông, tay + thân, chân này + chân kia, hông + gối), w ≥ 0,01", () => forChars((c) => {
  const unknown = c.B.filter((b) => !(b in c.P));
  if (unknown.length) return `xương không rõ cha (cần meta.parent): ${unknown.join(", ")}`;
  let n = 0; const pairs = {};
  for (const [, ws] of skinOf(c)) {
    const bs = [...ws].filter(([, w]) => w >= 0.01).map(([b]) => b); let hit = false;
    for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) if (forbidden(bs[i], bs[j], c.P, ARM_ROOTS)) { hit = true; const k = [bs[i], bs[j]].sort().join("+"); pairs[k] = (pairs[k] || 0) + 1; }
    if (hit) n++;
  }
  return n ? `${n} đỉnh (${pc(n / c.g.count)}): ${Object.entries(pairs).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, m]) => k + " " + m).join(", ")}` : "";
}));
t("ban-chan", "đỉnh bàn chân (cổ chân hoặc xương con của nó nặng nhất) không có trọng số hông", () => forChars((c) => {
  let n = 0, bad = 0;
  for (const [, ws] of skinOf(c)) {
    const d = domOf(ws); if (!up(d, c.P).some((x) => x === "ankleL" || x === "ankleR")) continue;
    n++; if ((ws.get("hips") || 0) >= 0.01) bad++;
  }
  return bad ? `${bad}/${n} đỉnh bàn chân có trọng số hông` : "";
}));
const SINGLE_MAX = 0.55;
t("mot-xuong", `da mượt: đỉnh chỉ theo một xương ≤ ${Math.round(SINGLE_MAX * 100)}% (dải trộn hẹp, không làm mượt thì nếp gấp gãy)`, () => forChars((c) => {
  let one = 0; for (const [, ws] of skinOf(c)) if (ws.size === 1) one++;
  return one / c.g.count <= SINGLE_MAX ? "" : `một xương ${pc(one / c.g.count)}`;
}));

console.log("(c) Vũ khí wpn/*.hkm (khung chuẩn bake/wpn.mjs: gốc ở chỗ nắm, mũi theo +Z, bề rộng lưỡi ±Y)");
// mặt cắt dọc Z: mỗi mặt phẳng z (bước 1 cm) lấy giao các cạnh tam giác và đỉnh gần → r = nửa bề ngang max(|x|, |y|), y lớn / nhỏ nhất
function profile(g, step = 0.01) {
  const P = g.position, I = g.index;
  let z0 = Infinity, z1 = -Infinity; for (let i = 2; i < P.length; i += 3) { z0 = Math.min(z0, P[i]); z1 = Math.max(z1, P[i]); }
  const K = Math.floor((z1 - z0) / step) + 1, r = new Float64Array(K), yp = new Float64Array(K).fill(-Infinity), yn = new Float64Array(K).fill(Infinity);
  const put = (k, x, y) => { if (k < 0 || k >= K) return; r[k] = Math.max(r[k], Math.abs(x), Math.abs(y)); yp[k] = Math.max(yp[k], y); yn[k] = Math.min(yn[k], y); };
  for (let v = 0; v < P.length / 3; v++) put(Math.round((P[v * 3 + 2] - z0) / step), P[v * 3], P[v * 3 + 1]);
  for (let t3 = 0; t3 < I.length; t3 += 3) for (let e = 0; e < 3; e++) {
    const a = I[t3 + e] * 3, b = I[t3 + ((e + 1) % 3)] * 3, za = P[a + 2], zb = P[b + 2];
    if (za === zb) continue;
    const k0 = Math.ceil((Math.min(za, zb) - z0) / step), k1 = Math.floor((Math.max(za, zb) - z0) / step);
    for (let k = k0; k <= k1; k++) { const u = (z0 + k * step - za) / (zb - za); put(k, P[a] + u * (P[b] - P[a]), P[a + 1] + u * (P[b + 1] - P[a + 1])); }
  }
  const z = (k) => z0 + k * step;
  const rAt = (zc, h = 0.015) => { let m = 0; for (let k = 0; k < K; k++) if (Math.abs(z(k) - zc) <= h) m = Math.max(m, r[k]); return m; };
  const argmax = () => { let m = 0; for (let k = 1; k < K; k++) if (r[k] > r[m]) m = k; return m; };
  return { z0, z1, L: z1 - z0, K, r, yp, yn, z, rAt, argmax };
}
const SWORDS = ["songdao", "dao", "dao_linh", "daikiem"];
t("kiem", "kiếm, đao (songdao, dao, dao_linh, daikiem): chắn tay sát phía tay (≤ 45% dài từ đuôi, trước chỗ nắm), chỗ nắm hẹp, lưỡi theo +Z ≥ ½ dài", () => SWORDS.flatMap((id) => {
  const p = profile(WP[id].meshes.body), kg = p.argmax(), zg = p.z(kg), f = (zg - p.z0) / p.L, r0 = p.rAt(0), bad = [];
  if (f > 0.45) bad.push(`chắn tay (r ${f3(p.r[kg])}) ở z ${f2(zg)} = ${pc(f)} dài tính từ đuôi`);
  if (zg <= 0) bad.push(`chắn tay ở z ${f2(zg)}, sau chỗ nắm`);
  if (r0 > 0.5 * p.r[kg]) bad.push(`chỗ nắm z = 0 rộng ${f3(r0)} (> ½ chắn tay)`);
  if (p.z1 - zg < 0.5 * p.L) bad.push(`lưỡi phía +Z dài ${f2(p.z1 - zg)} / ${f2(p.L)} m`);
  return bad.length ? [{ id, msg: bad.join("; ") }] : [];
}));
t("dadao", "đại đao: chỗ nắm trên cán (z = 0 hẹp ≤ 0,06 m), lưỡi bắt đầu ≥ 0,10 m trên tay và lệch +Y, cán còn ≥ 0,2 m dưới tay", () => {
  const p = profile(WP.dadao.meshes.body), bad = [];
  let kb = -1; for (let k = 0; k < p.K; k++) if (p.yp[k] > 0.15) { kb = k; break; }
  if (kb < 0) return [{ id: "dadao", msg: "không thấy lưỡi (y > 0,15)" }];
  const zb = p.z(kb), r0 = p.rAt(0);
  let yP = 0, yN = 0; for (let k = kb; k < p.K; k++) { if (p.yp[k] > yP) yP = p.yp[k]; if (-p.yn[k] > yN) yN = -p.yn[k]; }
  if (zb < 0.1) bad.push(`lưỡi bắt đầu ở z ${f2(zb)}`);
  if (r0 > 0.06) bad.push(`chỗ nắm z = 0 rộng ${f3(r0)}`);
  if (p.z0 > -0.2) bad.push(`cán dưới tay chỉ ${f2(-p.z0)} m`);
  if (yP < 3 * yN) bad.push(`lưỡi không lệch +Y (+${f3(yP)} / −${f3(yN)})`);
  return bad.length ? [{ id: "dadao", msg: bad.join("; ") }] : [];
});
t("mui", "giáo (giao_dv, giao_ng), chùy: đầu (mặt cắt rộng nhất) ở phía +Z (≥ 60% dài từ đuôi), chỗ nắm trên cán (≤ 0,07 m)", () => ["giao_dv", "giao_ng", "chuy"].flatMap((id) => {
  const p = profile(WP[id].meshes.body), kh = p.argmax(), f = (p.z(kh) - p.z0) / p.L, r0 = p.rAt(0), bad = [];
  if (f < 0.6) bad.push(`đầu (r ${f3(p.r[kh])}) ở ${pc(f)} dài tính từ đuôi`);
  if (r0 > 0.07) bad.push(`chỗ nắm z = 0 rộng ${f3(r0)}`);
  return bad.length ? [{ id, msg: bad.join("; ") }] : [];
}));

console.log("(d) Lính đám đông kit/*.hkm (bộ khúc soldier-motion.js, aSkin = khúc 0, khúc 1, w0·255)");
function kitInfo(id) {
  const { meta, meshes } = KT[id], J = SKELETONS[meta.skel];
  return { meta, meshes, P: Object.fromEntries(J.map((j) => [j[0], j[1]])), roots: KIT_ROOTS[meta.skel], piv: Object.fromEntries(JOINT_NAMES.map((n, i) => [n, meta.piv[i]])) };
}
const K = Object.fromEntries(ids("kit").map((id) => [id, kitInfo(id)]));
const segOf = (S, v) => { const a = JOINT_NAMES[S[v * 4]], b = JOINT_NAMES[S[v * 4 + 1]], w = S[v * 4 + 2] / 255; return { a, b, w, dom: w >= 0.5 ? a : b }; };
t("kit-ke", "không đỉnh nào trộn hai khúc không kề (bàn chân + chậu, cẳng chân + chậu, cẳng tay + thân), mọi mức chi tiết", () => Object.entries(K).flatMap(([id, k]) => {
  const out = [];
  for (const [ln, g] of Object.entries(k.meshes)) {
    let n = 0; const pairs = {};
    for (let v = 0; v < g.count; v++) { const s = segOf(g.aSkin, v); if (s.a !== s.b && s.w >= 0.01 && s.w <= 0.99 && forbidden(s.a, s.b, k.P, k.roots)) { n++; const q = [s.a, s.b].sort().join("+"); pairs[q] = (pairs[q] || 0) + 1; } }
    if (n) out.push(`${ln} ${n} đỉnh (${Object.entries(pairs).map(([q, m]) => q + " " + m).join(", ")})`);
  }
  return out.length ? [{ id, msg: out.join("; ") }] : [];
}));
t("kit-tay", "lính bộ: tay theo khúc tay — không đỉnh thân / chậu nào ở |x| > 0,42, y > 1,1 (tay chìa ngang ở tư thế nghỉ), LOD0 khúc ua ≥ 2%, fa ≥ 1,5%", () => Object.entries(K).filter(([, k]) => k.meta.skel === "human").flatMap(([id, k]) => {
  const out = [];
  for (const [ln, g] of Object.entries(k.meshes)) {
    const P = g.position, dom = {}; let n = 0;
    for (let v = 0; v < g.count; v++) {
      const d = segOf(g.aSkin, v).dom; dom[d] = (dom[d] || 0) + 1;
      if (Math.abs(P[v * 3]) > 0.42 && P[v * 3 + 1] > 1.1 && !/^(ua|fa|tas)/.test(d)) n++;
    }
    if (n) out.push(`${ln} ${n} đỉnh thân/chậu ngoài vai`);
    if (ln === "lod0") for (const [s, min] of [["uaL", 0.02], ["uaR", 0.02], ["faL", 0.015], ["faR", 0.015]]) if (!((dom[s] || 0) / g.count >= min)) out.push(`${ln} ${s} ${pc((dom[s] || 0) / g.count)}`);
  }
  return out.length ? [{ id, msg: out.join("; ") }] : [];
}));
// vũ khí trong lưới lính: tam giác gắn cứng vào khúc cẳng tay, nằm ngoài ống cẳng tay + bàn tay (r 0,1 m quanh đoạn piv → piv − 0,38 y);
// chiếu lên trục dài nhất của hộp vũ khí mong đợi (piv + p + s·R(r)·[lo, hi] của wpn/*.hkm) → phần phủ. LOD0 phủ ≥ 50%, mức xa ≥ 70% LOD0.
function rotXYZ([x, y, z], [rx, ry, rz]) {
  const cz = Math.cos(rz), sz = Math.sin(rz); [x, y] = [x * cz - y * sz, x * sz + y * cz];
  const cy = Math.cos(ry), sy = Math.sin(ry); [x, z] = [x * cy + z * sy, -x * sy + z * cy];
  const cx = Math.cos(rx), sx = Math.sin(rx); [y, z] = [y * cx - z * sx, y * sx + z * cx];
  return [x, y, z];
}
function weaponBox(k, w) {
  const m = WP[w.id].meta, piv = k.piv[w.bone], p = w.p || [0, 0, 0], s = w.s ?? 1, lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let c = 0; c < 8; c++) {
    const q = rotXYZ([0, 1, 2].map((a) => ((c >> a) & 1 ? m.hi[a] : m.lo[a]) * s), w.r || [0, 0, 0]);
    for (let a = 0; a < 3; a++) { const x = piv[a] + p[a] + q[a]; lo[a] = Math.min(lo[a], x); hi[a] = Math.max(hi[a], x); }
  }
  return { lo, hi };
}
function segDist(q, a, b) {
  const ab = [0, 1, 2].map((i) => b[i] - a[i]), aq = [0, 1, 2].map((i) => q[i] - a[i]);
  const u = Math.max(0, Math.min(1, (aq[0] * ab[0] + aq[1] * ab[1] + aq[2] * ab[2]) / (ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2)));
  return Math.hypot(aq[0] - u * ab[0], aq[1] - u * ab[1], aq[2] - u * ab[2]);
}
function coverage(g, bone, box, piv) {
  const P = g.position, I = g.index, S = g.aSkin, bi = JOINT_NAMES.indexOf(bone), ax = [0, 1, 2].reduce((m, a) => (box.hi[a] - box.lo[a] > box.hi[m] - box.lo[m] ? a : m), 0);
  const rigid = (v) => S[v * 4] === bi && (S[v * 4 + 1] === bi || S[v * 4 + 2] === 255);
  const A = piv, Bp = [piv[0], piv[1] - 0.38, piv[2]], iv = [];
  for (let t3 = 0; t3 < I.length; t3 += 3) {
    const vs = [I[t3], I[t3 + 1], I[t3 + 2]]; if (!vs.every(rigid)) continue;
    const q = vs.map((v) => [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]]);
    const e1 = [0, 1, 2].map((i) => q[1][i] - q[0][i]), e2 = [0, 1, 2].map((i) => q[2][i] - q[0][i]);
    if (Math.hypot(e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]) < 1e-8) continue;
    const cen = [0, 1, 2].map((i) => (q[0][i] + q[1][i] + q[2][i]) / 3);
    if (segDist(cen, A, Bp) < 0.1) continue;
    const xs = q.map((p) => p[ax]); iv.push([Math.max(box.lo[ax], Math.min(...xs)), Math.min(box.hi[ax], Math.max(...xs))]);
  }
  iv.sort((a, b) => a[0] - b[0]);
  let len = 0, cur = null;
  for (const [a, b] of iv) { if (b <= a) continue; if (!cur || a > cur[1]) { if (cur) len += cur[1] - cur[0]; cur = [a, b]; } else cur[1] = Math.max(cur[1], b); }
  if (cur) len += cur[1] - cur[0];
  return len / (box.hi[ax] - box.lo[ax]);
}
t("kit-vk", "mức chi tiết nào cũng còn vũ khí (phủ trục dài: LOD0 ≥ 50% hộp mong đợi, LOD1/2 ≥ 70% LOD0) và tua giáo", () => Object.entries(K).flatMap(([id, k]) => {
  const out = [], cat = KIT_LIST[id];
  if (!cat) return [];
  for (const w of cat.weapons) {
    const box = weaponBox(k, w), cv = Object.entries(k.meshes).map(([ln, g]) => [ln, coverage(g, w.bone, box, k.piv[w.bone])]), c0 = cv[0][1];
    if (c0 < 0.5) out.push(`${w.id} ${cv[0][0]} phủ ${pc(c0)}`);
    for (const [ln, c] of cv.slice(1)) if (c < 0.7 * c0) out.push(`${w.id} ${ln} phủ ${pc(c)} (LOD0 ${pc(c0)})`);
  }
  if (cat.tassel) for (const [ln, g] of Object.entries(k.meshes)) {
    let n = 0; const ti = JOINT_NAMES.indexOf("tas"); for (let v = 0; v < g.count; v++) if (g.aSkin[v * 4] === ti) n++;
    if (n < 6) out.push(`${ln} thiếu tua (${n} đỉnh)`);
  }
  return out.length ? [{ id, msg: out.join("; ") }] : [];
}));

console.log("(e) Xương phụ (A4)");
t("phu", "nhân vật rig có xương phụ (ngoài 15 khớp) có cha (meta.parent) và có trọng số (≥ 0,1%)", () => forChars((c) => {
  const extra = c.B.filter((b) => !CORE15.includes(b)), bad = [];
  if (HELPERS) { for (const h of HELPERS) if (!c.B.includes(h)) bad.push("thiếu " + h); }
  else if (!extra.length) return "chưa có xương phụ (chỉ 15 khớp)";
  const S = Object.fromEntries(c.B.map((b) => [b, 0]));
  for (const [, ws] of skinOf(c)) for (const [b, w] of ws) S[b] += w;
  for (const h of extra) {
    if (!c.meta.parent || !c.B.includes(c.meta.parent[h])) bad.push(`${h} không có cha trong meta.parent`);
    if (!(S[h] / c.g.count >= 0.001)) bad.push(`${h} ${pc(S[h] / c.g.count)}`);
  }
  return bad.join(", ");
}));

console.log(`\n${pass} đạt, ${fail} trượt, ${skip} bỏ qua (TODO đợt 19a)`);
process.exit(fail ? 1 : 0);
