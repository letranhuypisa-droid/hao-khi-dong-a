// design/tools/bake/char.mjs — nhân vật dùng rig khớp nối của game (battle/models.js makeRig: tướng, sĩ quan, cận vệ, người
// lính Tự do): lưới Meshy → lưới da gắn đúng 15 khớp rig, kèm ma trận gắn nghịch đảo và vị trí khớp tay, cổ riêng của mô hình.
//
// Mô hình giữ dáng gốc (tay đưa ra trước hoặc chữ A); khung gắn đặt ở khớp dò được (human.mjs). Lúc chạy, game đặt góc khớp như
// rig cũ (0 = tay chân buông thẳng), lưới đi theo bằng skinning chuẩn (khớp lúc chạy × nghịch đảo khung gắn). Hông, thân, khớp
// chân giữ đúng độ cao rig (applyPose đặt hông 0,92; IK chân dùng LEG.L1/L2 cố định), chỉ bề ngang chân theo mô hình. Vai, khuỷu,
// cổ tay, cổ theo mô hình (models.js đặt lại các khớp đó khi dựng rig) — trừ rig đại kiếm WC01: tư thế WC01 giải IK sẵn theo vai
// ±0,30 và tay 0,34 + 0,36 (anim-wc01.js), nên rig đó giữ khớp tay mặc định, lưới tay dời theo khung gắn.
// Mô hình chuẩn hoá: vai trung bình ở 1,48 (độ cao vai rig), cổ ở x = 0, z = 0.
// Lưới: dò khớp, tính trọng số trên lưới Meshy giảm sơ (giữ đường may UV), rồi hàn đỉnh, giảm tới đúng ngân sách và trải UV lại,
// nướng texture mới từ lưới đó (rebake.mjs) — đường may UV của Meshy chặn giảm lưới (tướng khác dừng ở 7–9 nghìn thay vì 6).

import { readGLB, smoothNormals, packMesh, quantWeights, rawImage } from "./io.mjs";
import { JOINTS, fitHuman, bindSkeleton, weights15, topK } from "./human.mjs";
import { weldSimplify, rebake } from "./rebake.mjs";

const RIG_ARM = { shL: [-0.3, 0.52, 0], elL: [0, -0.34, 0], handL: [0, -0.36, 0.02], shR: [0.3, 0.52, 0], elR: [0, -0.34, 0], handR: [0, -0.36, 0.02] };
const Y = { hips: 0.92, torso: 0.96, hipOff: 0.02, thigh: 0.45, shin: 0.4, knee: 0.45, ankle: 0.05 };

export async function bakeChar(file, { tris, tex = 512, wc01 = false, fix = null } = {}) {
  const g = await readGLB(file, tris);
  const F = fitHuman(g.pos, g.idx, { shY: 1.48, fix });
  const { inv, restLocal } = bindSkeleton(F, Y);
  const rest = Object.fromEntries(Object.entries(restLocal).map(([k, v]) => [k, v.map((x) => +x.toFixed(4))]));
  if (wc01) Object.assign(rest, RIG_ARM);
  const W = weights15(F, Y), { idx: si, w: sw } = topK(W, JOINTS.length, 4);
  const nor = smoothNormals(F.V, g.idx);
  const low = await weldSimplify(F.V, g.idx, tris);
  const r = await rebake({ pos: low.pos, nor: smoothNormals(low.pos, low.idx), idx: low.idx }, [{ pos: F.V, nor, uv: g.uv, idx: g.idx, img: await rawImage(g.image) }], tex);
  const n = r.xref.length, si2 = new Uint8Array(n * 4), sw2 = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { const v = low.src[r.xref[i]]; for (let k = 0; k < 4; k++) { si2[i * 4 + k] = si[v * 4 + k]; sw2[i * 4 + k] = sw[v * 4 + k]; } }
  const mesh = packMesh({ pos: r.part.pos, nor: r.part.nor, uv: r.part.uv, idx: r.part.idx, si: si2, sw: quantWeights(sw2) });
  let ymax = 0; for (let i = 1; i < F.V.length; i += 3) ymax = Math.max(ymax, F.V[i]);
  return {
    mesh, image: r.image, tris: r.part.idx.length / 3, trisBefore: g.trisBefore, warnings: F.lm.warnings,
    meta: { kind: "char", bones: JOINTS, inv: inv.flatMap((m) => m.toArray().map((x) => +x.toFixed(6))), rest, wc01, scale: +F.s.toFixed(4), top: +ymax.toFixed(3) },
  };
}
