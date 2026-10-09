// battle/hero-anim.js — bảng hoạt ảnh đòn của H35 (WC03 Song đao; WC01 Đại kiếm ở anim-wc01.js): khoá đòn → hàm tư thế theo
// tiến độ clip u ∈ [0,1]. Tách khỏi hero.js để lab.html xem được từng khung.

import * as A from "./anim.js";
import { HERO_ANIM_WC01 } from "./anim-wc01.js";
import { withClips } from "./clip-moves.js";

// Chuỗi N: ngang phải → ngang trái → hất lên → bổ xuống (tay trái) → kéo chéo hai lưỡi → xoay.
// C4 = xoay một vòng rồi bổ hai đao xuống đất (sóng xung kích lúc 0,55).
const PROC = {
  N1: (u) => A.slash(u, 1, 0), N2: (u) => A.slash(u, -1, 0), N3: (u) => A.slash(u, 1, 0.6), N4: (u) => A.slash(u, -1, 1),
  N5: (u) => A.scissor(u), N6: (u) => A.spin(u, 1.25), C1: (u) => A.doubleChop(u), C2: (u) => A.uppercut(u),
  C3: (u) => A.spin(u, 3.5), C4: (u) => (u < 0.42 ? A.spin((u / 0.42) * 0.85, 1) : A.doubleChop(0.4 + ((u - 0.42) / 0.58) * 0.6)),
  C5: (u) => A.dash(u), C6: (u) => A.spin(u, 2),
  DN: (u) => A.dash(u), DC: (u) => A.dash(u), DQ: (u) => A.doubleChop(u), CT: (u) => A.slash(u, 1, 0),
};
// Đòn dựng từ clip kiếm (clip-moves.js); N5 kéo hai đao, N6 / C3 / C4 / C6 xoay, C1 / C2 / C5 / DQ nhảy bổ, hất, lao vẫn là khung khoá cũ.
const CLIP_SPECS = {
  N1: { clip: "swordA" }, N2: { clip: "swordA", mirror: true }, N3: { clip: "hook" }, N4: { clip: "swordC", t0: 0.5, t1: 0.95, mirror: true },
  DN: { clip: "swordB" }, DC: { clip: "swordDash", t0: 0.1, t1: 0.7 }, CT: { clip: "swordA" },
};
export const HERO_ANIM = withClips(PROC, CLIP_SPECS);
export const HERO_MOVE_LIST = Object.keys(HERO_ANIM);

// Bảng hoạt ảnh theo lớp vũ khí (lõi chọn theo HEROES[id].anim, data/heroes.js). WC03 giữ nguyên HERO_ANIM ở trên.
export const ANIMS = { WC03: HERO_ANIM, WC01: HERO_ANIM_WC01 };
