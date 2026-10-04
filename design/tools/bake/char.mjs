// design/tools/bake/char.mjs — nhân vật dùng rig khớp nối của game (battle/models.js makeRig: tướng, sĩ quan, cận vệ, người
// lính Tự do): lưới Meshy → lưới da gắn đúng 15 khớp rig, kèm ma trận gắn nghịch đảo và vị trí khớp tay, cổ riêng của mô hình.
//
// Mô hình giữ dáng gốc (tay đưa ra trước hoặc chữ A); khung gắn đặt ở khớp dò được (human.mjs). Lúc chạy, game đặt góc khớp như
// rig cũ (0 = tay chân buông thẳng), lưới đi theo bằng skinning chuẩn (khớp lúc chạy × nghịch đảo khung gắn). Hông, thân, khớp
// chân giữ đúng độ cao rig (applyPose đặt hông 0,92; IK chân dùng LEG.L1/L2 cố định), chỉ bề ngang chân theo mô hình. Vai, khuỷu,
// cổ tay, cổ theo mô hình (models.js đặt lại các khớp đó khi dựng rig: khớp lúc chạy trùng khung gắn, kể cả rig đại kiếm WC01 —
// trước đây rig đó giữ tay mặc định 0,34 + 0,36 của tư thế WC01 nên lưới tay giãn ở mọi tư thế; nay tay trái nắm chuôi giải IK
// theo độ dài tay của rig, rig-motion.js gripIK). meta.foot: đế giày, mũi, gót của lưới (khung cổ chân gắn) — rig-motion.js đặt đế
// giày lưới xuống đất thay cho đế khối 0,08 dưới cổ chân (trước đây lưới GLB lơ lửng 3–5 cm).
// Mô hình chuẩn hoá: vai trung bình ở 1,48 (độ cao vai rig), cổ ở x = 0, z = 0. catalog cut: phần thừa (sừng mũ) cắt trước khi dò.
// Lưới: dò khớp, tính trọng số trên lưới Meshy giảm sơ (giữ đường may UV), rồi hàn đỉnh, giảm tới đúng ngân sách và trải UV lại,
// nướng texture mới từ lưới đó (rebake.mjs) — đường may UV của Meshy chặn giảm lưới (tướng khác dừng ở 7–9 nghìn thay vì 6).

import { readGLB, smoothNormals, packMesh, quantWeights, rawImage } from "./io.mjs";
import { JOINTS, fitHuman, cutBoxes, bindSkeleton, weights15, topK } from "./human.mjs";
import { weldSimplify, rebake } from "./rebake.mjs";

const Y = { hips: 0.92, torso: 0.96, hipOff: 0.02, thigh: 0.45, shin: 0.4, knee: 0.45, ankle: 0.05 };

// Đế giày của lưới trong khung cổ chân gắn (cổ chân ở (legX, ankle), trục thẳng): đỉnh dưới cổ chân + 0,02, cách trục chân ≤ 0,12,
// trọng số cổ chân ≥ 0,6 (gấu áo dài chạm đất theo hông, không tính) mỗi bên → sole (đế thấp hơn cổ chân), toe / heel (z xa nhất
// trước / sau), footZ (giữa đế) — trung bình hai bên. W: trọng số 15 khớp (weights15).
function footOf(V, W, legX, ankleY) {
  const out = [], NB = JOINTS.length;
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

export async function bakeChar(file, { tris, tex = 512, wc01 = false, fix = null, cut = null, name = "?" } = {}) {
  const c = cutBoxes(await readGLB(file, tris), cut), g = c.g;
  const F = fitHuman(g.pos, g.idx, { shY: 1.48, fix, box: c.bounds, name, wc01 });
  const { inv, restLocal } = bindSkeleton(F, Y);
  const rest = Object.fromEntries(Object.entries(restLocal).map(([k, v]) => [k, v.map((x) => +x.toFixed(4))]));
  const W = weights15(F, Y), { idx: si, w: sw } = topK(W, JOINTS.length, 4);
  const nor = smoothNormals(F.V, g.idx);
  const low = await weldSimplify(F.V, g.idx, tris);
  const r = await rebake({ pos: low.pos, nor: smoothNormals(low.pos, low.idx), idx: low.idx }, [{ pos: F.V, nor, uv: g.uv, idx: g.idx, img: await rawImage(g.image) }], tex);
  const n = r.xref.length, si2 = new Uint8Array(n * 4), sw2 = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { const v = low.src[r.xref[i]]; for (let k = 0; k < 4; k++) { si2[i * 4 + k] = si[v * 4 + k]; sw2[i * 4 + k] = sw[v * 4 + k]; } }
  const mesh = packMesh({ pos: r.part.pos, nor: r.part.nor, uv: r.part.uv, idx: r.part.idx, si: si2, sw: quantWeights(sw2) });
  let ymax = 0; for (let i = 1; i < F.V.length; i += 3) ymax = Math.max(ymax, F.V[i]);
  return {
    mesh, image: r.image, tris: r.part.idx.length / 3, trisBefore: g.trisBefore, warnings: F.lm.warnings, how: F.how, cut: c.cut,
    meta: { kind: "char", bones: JOINTS, inv: inv.flatMap((m) => m.toArray().map((x) => +x.toFixed(6))), rest, wc01, scale: +F.s.toFixed(4), norm: [+F.s.toFixed(5), +F.ox.toFixed(5), +F.oz.toFixed(5)], top: +ymax.toFixed(3),
      foot: footOf(F.V, W, F.legX, Y.hips - Y.hipOff - Y.thigh - Y.shin), arms: F.how, ...(c.cut ? { cut: c.cut } : {}) },
  };
}
