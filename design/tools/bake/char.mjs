// design/tools/bake/char.mjs — nhân vật dùng rig khớp nối của game (battle/models.js makeRig: tướng, sĩ quan, cận vệ, người
// lính Tự do): lưới Meshy → lưới da gắn đúng 15 khớp rig + 6 xương phụ (lưng, cổ, xương đòn, xoắn cẳng tay — game/js/battle/
// rig-helpers.js; glb.js dựng lúc gắn thân, tự quay theo khớp nguồn, hoạt ảnh không biết tới), kèm ma trận gắn nghịch đảo và vị trí
// khớp tay, cổ riêng của mô hình. meta.bones: 15 khớp rồi xương phụ; meta.rest: khớp (khung cha) + gốc xương phụ; meta.parent,
// meta.drive: cha, [khớp nguồn, cách quay, phần góc] của xương phụ.
//
// Mô hình giữ dáng gốc (tay đưa ra trước hoặc chữ A); khung gắn đặt ở khớp dò được (human.mjs). Lúc chạy, game đặt góc khớp như
// rig cũ (0 = tay chân buông thẳng), lưới đi theo bằng skinning chuẩn (khớp lúc chạy × nghịch đảo khung gắn). Hông, thân, khớp
// chân giữ đúng độ cao rig (applyPose đặt hông 0,92; IK chân dùng LEG.L1/L2 cố định), chỉ bề ngang chân theo mô hình. Vai, khuỷu,
// cổ tay, cổ theo mô hình (models.js đặt lại các khớp đó khi dựng rig: khớp lúc chạy trùng khung gắn, kể cả rig đại kiếm WC01 —
// trước đây rig đó giữ tay mặc định 0,34 + 0,36 của tư thế WC01 nên lưới tay giãn ở mọi tư thế; nay tay phải tư thế WC01 giải lại,
// tay trái nắm chuôi giải IK theo độ dài tay của rig — anim-wc01.js fitArms, rig-motion.js gripIK). meta.foot: đế giày, mũi, gót
// của lưới (khung cổ chân gắn) — rig-motion.js đặt đế
// giày lưới xuống đất thay cho đế khối 0,08 dưới cổ chân (trước đây lưới GLB lơ lửng 3–5 cm).
// Mô hình chuẩn hoá: vai trung bình ở 1,48 (độ cao vai rig), cổ ở x = 0, z = 0. catalog cut: phần thừa (sừng mũ) cắt trước khi dò.
// Lưới: dò khớp, tính trọng số trên lưới Meshy giảm sơ (giữ đường may UV), rồi hàn đỉnh, giảm tới đúng ngân sách và trải UV lại,
// nướng texture mới từ lưới đó (rebake.mjs) — đường may UV của Meshy chặn giảm lưới (tướng khác dừng ở 7–9 nghìn thay vì 6).

import { readGLB, smoothNormals, packMesh, quantWeights, rawImage } from "./io.mjs";
import { JOINTS, fitHuman, cutBoxes, bindSkeleton, bindHelpers, weights15, topK, splitBridges } from "./human.mjs";
import { weldSimplify, rebake } from "./rebake.mjs";

const Y = { hips: 0.92, torso: 0.96, hipOff: 0.02, thigh: 0.45, shin: 0.4, knee: 0.45, ankle: 0.05 };

// Đế giày của lưới trong khung cổ chân gắn (cổ chân ở (legX, ankle), trục thẳng): đỉnh dưới cổ chân + 0,02, cách trục chân ≤ 0,12,
// trọng số cổ chân ≥ 0,6 (gấu áo dài chạm đất theo hông, không tính) mỗi bên → sole (đế thấp hơn cổ chân), toe / heel (z xa nhất
// trước / sau), footZ (giữa đế) — trung bình hai bên. W: trọng số NB xương mỗi đỉnh (weights15; cổ chân theo chỉ số trong JOINTS).
function footOf(V, W, NB, legX, ankleY) {
  const out = [];
  for (const sd of ["L", "R"]) {
    const ja = JOINTS.indexOf("ankle" + sd);
    let y0 = Infinity, z0 = Infinity, z1 = -Infinity;
    for (let i = 0; i < V.length; i += 3) {
      if (V[i + 1] > ankleY + 0.02 || Math.abs(V[i] - legX[sd]) > 0.12 || W[(i / 3) * NB + ja] < 0.6) continue;
      y0 = Math.min(y0, V[i + 1]); z0 = Math.min(z0, V[i + 2]); z1 = Math.max(z1, V[i + 2]);
    }
    if (isFinite(y0)) out.push([ankleY - y0, z1, z0]);
  }
  const m = (k) => +(out.reduce((a, q) => a + q[k], 0) / out.length).toFixed(3);
  return out.length ? { sole: m(0), toe: m(1), heel: m(2), footZ: +((m(1) + m(2)) / 2).toFixed(3) } : null;
}

// Đỉnh trong hộp { lo, hi } (khung gắn, mét — toạ độ của meta.pos; catalog rigid) theo xương thân thuần: đồ đeo dài dính lưng (ống tên Hunyuan3D của H40h:
// dây đeo chéo từ eo lên cổ, đầu mũi tên cao ngang đầu) nằm qua dải lưng, dải cổ, dải đầu của trường theo độ cao — mũi tên quay theo đầu, tam giác dài nối
// xương lưng với xương cổ (cách 3 đốt) bị tách hở 0,19 m khi lộn né. W: n × NB (weights15), V: đỉnh (cùng thứ tự), bi: chỉ số xương thân.
function lockTorso(W, V, NB, bi, boxes) {
  for (let v = 0; v < V.length / 3; v++) {
    const x = V[v * 3], y = V[v * 3 + 1], z = V[v * 3 + 2];
    if (!boxes.some((b) => x >= b.lo[0] && x <= b.hi[0] && y >= b.lo[1] && y <= b.hi[1] && z >= b.lo[2] && z <= b.hi[2])) continue;
    for (let k = 0; k < NB; k++) W[v * NB + k] = 0;
    W[v * NB + bi] = 1;
  }
}

// Lưới cuối trước khi nướng texture (bakeChar; số đo của đợt soát chạy trên chính lưới này): dò khớp, khung gắn + xương phụ, trọng số
// (đỉnh lưới Meshy giảm sơ), hàn + giảm tới ngân sách, trọng số u8 mỗi đỉnh, tách tam giác cầu (human.mjs splitBridges). Trả { F, g, cut,
// bind, HB, bones, W, pos, idx, si, sw (u8, lưới cuối), split: { cut: tam giác tách, dups: đỉnh thêm } }. w: thay WEIGHT_PRM.
// Bỏ đỉnh không còn tam giác nào dùng (giảm lưới còn lại đỉnh mồ côi trong mảng hàn); đỉnh giữ thứ tự cũ, src theo đó.
function compact(m) {
  const map = new Int32Array(m.pos.length / 3).fill(-1), P = [], S = [], I = new Uint32Array(m.idx.length);
  for (let i = 0; i < I.length; i++) { const v = m.idx[i]; if (map[v] < 0) { map[v] = P.length / 3; P.push(m.pos[v * 3], m.pos[v * 3 + 1], m.pos[v * 3 + 2]); S.push(m.src[v]); } I[i] = map[v]; }
  return { ...m, pos: Float32Array.from(P), idx: I, src: Int32Array.from(S) };
}
export async function charMesh(file, { tris, fix = null, cut = null, name = "?", shoulder = null, fallback = false, w = {}, split = true, rad = null, radOut = null, rigid = null, zs = 0, simp = null } = {}) {
  // simp: { w, hi } — mẫu áo rộng, mũ lớn (Hunyuan3D): giảm lưới một lượt đều tay trước khi biết cánh tay ở đâu để lại 40% đỉnh cánh tay so với tướng giáp (vai chỉ 0,8% số đỉnh); đọc ở hi × tris,
  // dò khớp + trọng số trên lưới dày, rồi giảm còn tris có thuộc tính trọng số (w): chỗ trọng số đổi (vai, khuỷu, cổ tay) giữ đỉnh, mũ (một xương) gộp thoải mái.
  const c = cutBoxes(await readGLB(file, simp ? tris * (simp.hi ?? 4) : tris), cut), g = c.g;
  const F = fitHuman(g.pos, g.idx, { shY: 1.48, fix, box: c.bounds, name, shoulder, fallback, rad, radOut, zs });
  const bind = bindSkeleton(F, Y), HB = bindHelpers(bind), bones = [...JOINTS, ...HB.names], NB = bones.length;
  const W = weights15(F, Y, w, HB);
  if (rigid) lockTorso(W, F.V, NB, bones.indexOf("torso"), rigid);
  const { idx: si, w: sw } = topK(W, NB, 4);
  const low0 = await weldSimplify(F.V, g.idx, tris, simp ? { data: W, k: NB, w: simp.w ?? 1 } : null), low = simp ? compact(low0) : low0, nl = low.src.length, lsi = new Uint8Array(nl * 4), lsw = new Float32Array(nl * 4);
  for (let i = 0; i < nl; i++) { const v = low.src[i]; for (let k = 0; k < 4; k++) { lsi[i * 4 + k] = si[v * 4 + k]; lsw[i * 4 + k] = sw[v * 4 + k]; } }
  const q = { pos: low.pos, idx: low.idx, si: lsi, sw: quantWeights(lsw) }, s = split ? splitBridges(q, bones) : { ...q, cut: 0, dups: 0 };
  return { F, g, cut: c.cut, bind, HB, bones, W, pos: s.pos, idx: s.idx, si: s.si, sw: s.sw, split: { cut: s.cut, dups: s.dups } };
}

export async function bakeChar(file, o = {}) {
  const M = await charMesh(file, o), { F, g, bind, HB, bones, W } = M, NB = bones.length;
  const rest = Object.fromEntries(Object.entries(bind.restLocal).map(([k, v]) => [k, v.map((x) => +x.toFixed(4))]));
  const nor = smoothNormals(F.V, g.idx);
  const r = await rebake({ pos: M.pos, nor: smoothNormals(M.pos, M.idx), idx: M.idx }, [{ pos: F.V, nor, uv: g.uv, idx: g.idx, img: await rawImage(g.image) }], o.tex ?? 512);
  const n = r.xref.length, si2 = new Uint8Array(n * 4), sw2 = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) { const v = r.xref[i]; for (let k = 0; k < 4; k++) { si2[i * 4 + k] = M.si[v * 4 + k]; sw2[i * 4 + k] = M.sw[v * 4 + k]; } }
  const mesh = packMesh({ pos: r.part.pos, nor: r.part.nor, uv: r.part.uv, idx: r.part.idx, si: si2, sw: sw2 });
  let ymax = 0; for (let i = 1; i < F.V.length; i += 3) ymax = Math.max(ymax, F.V[i]);
  return {
    mesh, image: r.image, tris: r.part.idx.length / 3, trisBefore: g.trisBefore, warnings: F.lm.warnings, how: F.how, cut: M.cut, split: M.split,
    meta: { kind: "char", bones, inv: [...bind.inv, ...HB.inv].flatMap((m) => m.toArray().map((x) => +x.toFixed(6))), rest: { ...rest, ...HB.rest }, parent: HB.parent, drive: HB.drive, scale: +F.s.toFixed(4), norm: [+F.s.toFixed(5), +F.ox.toFixed(5), +F.oz.toFixed(5)], top: +ymax.toFixed(3),
      foot: footOf(F.V, W, NB, F.legX, Y.hips - Y.hipOff - Y.thigh - Y.shin), arms: F.how, ...(M.cut ? { cut: M.cut } : {}) },
  };
}
