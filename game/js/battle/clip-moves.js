// battle/clip-moves.js — đòn đánh dựng từ clip xương người (clips.js) thay cho khung khoá viết tay, cho lớp vũ khí có bảng spec bên dưới.
//
// Mỗi đòn của game là hàm tư thế theo tiến độ u ∈ [0,1] (hero.js updateAttack) với mốc gây sát thương MOVES[k].hits[0]. Clip có nhịp riêng,
// nên đổi thời gian từng đoạn: u ∈ [0, hit] chạy clip từ t0 tới giây vung nhanh nhất (strike), u ∈ [hit, 1] chạy từ đó tới t1 — cú chém
// của clip trùng đúng lúc đòn trúng, và thời lượng đòn vẫn do MOVES quyết định (nhịp chiến đấu không đổi). Đầu và cuối đòn trộn từ / về
// thế thủ của lớp (đòn nào cũng bắt đầu và kết thúc ở thế thủ, như khung khoá cũ), trộn theo phép quay (anim.js blendPoseQ: góc Euler đầu / cuối
// clip có thể là cách viết khác của cùng hướng với thế thủ).
//
// spec = { clip, t0?, t1?, strike?, mirror?, even? }: t0 mặc định 0 (clip gươm hai tay: start của clip — bỏ đoạn đứng chờ), t1 mặc định hết clip,
// even: t1 chọn sao cho tốc độ phát sau cú chém bằng tốc độ phát trước nó (không nén phần theo đà vào khoảng ngắn hơn nhiều).
// Clip một tay (song đao): cổ tay = góc cổ tay clip + HAND_BIAS cho lưỡi nối dài cánh tay (rig game: handRx ≈ 1,5 là lưỡi dọc cẳng tay; tay cầm
// kiếm thật lệch chừng 20–30° so với đường cẳng tay); tay trái là bản mirror của clip tay phải. Clip gươm hai tay (clips.json sword: tay đã giải theo
// gươm bằng IK của anim-wc01.js lúc nướng): không cộng lệch cổ tay, kênh grip = 1 (tay trái nắm chuôi), bỏ thẻ bảng giải tay (fk, fu) của thế thủ vì
// tay đã khác — fitArms giải lại từng khung theo số đo tay của mô hình; không lật trái-phải (hai tay có vai trò riêng).
//
// Clip chưa tải / ?noclips: trả về hàm thủ tục cũ của đòn đó, nên hero.js, lab.js không phải biết.

import * as C from "./clips.js";
import { MOVES } from "../data/tuning.js";
import { GUARD, blendPoseQ, mirror } from "./anim.js";

export const HAND_BIAS = 1.2;
const IN = 0.2, OUT = 0.3;                                   // phần đòn trộn từ / về thế thủ
const sm = (e0, e1, x) => { const t = x <= e0 ? 0 : x >= e1 ? 1 : (x - e0) / (e1 - e0); return t * t * (3 - 2 * t); };

// Tư thế của đòn spec ở tiến độ u. hitU: mốc sát thương (0..1), durM: thời lượng đòn (s, cho even). base: thế thủ của lớp.
export function clipMovePose(spec, hitU, u, base = GUARD, durM = 0) {
  const inf = C.info(spec.clip), sword = inf.sword, t0 = spec.t0 ?? (sword ? inf.start : 0), strike = spec.strike ?? inf.strike;
  let t1 = spec.t1 ?? inf.dur;
  if (spec.even && durM > 0) t1 = Math.min(inf.dur, strike + ((strike - t0) / (hitU * durM)) * (1 - hitU) * durM);
  const t = u <= hitU ? t0 + (strike - t0) * (u / hitU) : strike + (t1 - strike) * ((u - hitU) / (1 - hitU));
  const p = { ...base }; delete p.fk; delete p.fu;
  C.sampleT(spec.clip, t, p);
  if (sword) p.grip = 1; else { p.handRx += HAND_BIAS; p.handLx += HAND_BIAS; }
  const q = (spec.mirror ?? (!sword && inf.hand === "L")) ? mirror(p) : p;
  return blendPoseQ(base, q, sm(0, IN, u) * (1 - sm(1 - OUT, 1, u)));
}

// Bảng đòn thủ tục `proc` ({ khoá: u → tư thế }) → bảng cùng khoá, đòn có spec dùng clip khi có, còn lại (hoặc chưa có clip) nguyên hàm cũ.
// moves: bảng đòn của lớp (mốc sát thương, thời lượng): MOVES (song đao) hay MOVES_WC01.
export function withClips(proc, specs, base = GUARD, moves = MOVES) {
  const out = { ...proc };
  for (const [k, spec] of Object.entries(specs)) {
    const hitU = moves[k]?.hits?.[0], durM = moves[k]?.dur ?? 0, old = proc[k];
    if (hitU == null || !old) continue;
    out[k] = (u) => (C.clipsReady() && C.has(spec.clip) ? clipMovePose(spec, hitU, u, base, durM) : old(u));
  }
  return out;
}
