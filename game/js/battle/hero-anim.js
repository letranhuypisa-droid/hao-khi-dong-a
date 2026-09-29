// battle/hero-anim.js — bảng hoạt ảnh đòn của H35 (WC03 Song đao): khoá đòn → hàm tư thế theo
// tiến độ clip u ∈ [0,1]. Tách khỏi hero.js để lab.html xem được từng khung.

import * as A from "./anim.js";

// Chuỗi N: ngang phải → ngang trái → hất lên → bổ xuống (tay trái) → kéo chéo hai lưỡi → xoay.
// C4 = xoay một vòng rồi bổ hai đao xuống đất (sóng xung kích lúc 0,55).
export const HERO_ANIM = {
  N1: (u) => A.slash(u, 1, 0), N2: (u) => A.slash(u, -1, 0), N3: (u) => A.slash(u, 1, 0.6), N4: (u) => A.slash(u, -1, 1),
  N5: (u) => A.scissor(u), N6: (u) => A.spin(u, 1.25), C1: (u) => A.doubleChop(u), C2: (u) => A.uppercut(u),
  C3: (u) => A.spin(u, 3.5), C4: (u) => (u < 0.42 ? A.spin((u / 0.42) * 0.85, 1) : A.doubleChop(0.4 + ((u - 0.42) / 0.58) * 0.6)),
  C5: (u) => A.dash(u), C6: (u) => A.spin(u, 2),
  DN: (u) => A.dash(u), DC: (u) => A.dash(u), DQ: (u) => A.doubleChop(u), CT: (u) => A.slash(u, 1, 0),
};
export const HERO_MOVE_LIST = Object.keys(HERO_ANIM);
