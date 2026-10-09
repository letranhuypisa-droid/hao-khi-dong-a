// riglab/bake.js — cho mô hình đã gắn xương (autorig.js) chạy đúng hoạt ảnh của game: dựng một rig tướng của game (ẩn) làm
// "người diễn", đặt tư thế bằng chính các hàm của anim.js / anim-wc01.js / hero-anim.js, chạy rig-motion.js (chân bám đất, tay
// nắm chuôi đại kiếm), rồi chép góc từng khớp sang xương cùng tên của mô hình. Xương mô hình nghỉ ở cùng quy ước với rig game
// (góc 0 = tay chân buông thẳng) nên chép nguyên quaternion là đúng; hông chép độ lệch so với độ cao nghỉ.
// Nướng (bakeClips): lấy mẫu 30 khung/giây thành THREE.AnimationClip để GLTFExporter ghi vào GLB.

import * as THREE from "three";
import { makeRig, disposeRig, RIGS } from "../battle/models.js";
import * as A from "../battle/anim.js";
import * as W1 from "../battle/anim-wc01.js";
import { ANIMS } from "../battle/hero-anim.js";
import { RigMotion } from "../battle/rig-motion.js";
import { MOVES } from "../data/tuning.js";
import { MOVES_WC01 } from "../data/moves-wc01.js";
import { JOINTS, GAME } from "./autorig.js";

// Bộ đòn theo lớp vũ khí: rig game làm người diễn, tốc chạy (như lab.js rigSpeed), bảng đòn, tư thế ngoài đòn, thời lượng.
export const SETS = {
  WC03: { label: "Song đao (Trần Quốc Toản)", rig: "hero", speed: 6.75, anims: ANIMS.WC03, moves: MOVES,
    idle: (t) => A.idle(t), run: A.run, block: () => A.block(), hit: (u) => A.hitReact(u), dodge: (u) => A.dodgeRoll(u), down: (u) => A.knockdown(u) },
  WC01: { label: "Đại kiếm (Trần Hưng Đạo)", rig: "H31", speed: 6.0, anims: ANIMS.WC01, moves: MOVES_WC01,
    idle: (t) => W1.idle(t), run: W1.run, block: () => W1.block(), hit: (u) => W1.hitReact(u), dodge: (u) => W1.dodgeRoll(u), down: (u) => W1.knockdown(u) },
};
const MOVE_KEYS = ["N1", "N2", "N3", "N4", "N5", "N6", "C1", "C2", "C3", "C4", "C5", "C6"];

// Danh sách clip của một bộ: { name, label, dur (s), loop, pose(t, u, drv) → tư thế anim.js }.
export function clipList(setKey) {
  const S = SETS[setKey], out = [];
  out.push({ name: "idle", label: "Đứng thủ", dur: 2.4, loop: true, pose: (t) => S.idle(t) });
  out.push({ name: "run", label: "Chạy", dur: null, loop: true, pose: (t, u, d) => { const g = A.gait(S.speed, d.rig.scale); return S.run(t * g.rate, 1, g.stride); } });
  for (const k of MOVE_KEYS) if (S.anims[k] && S.moves[k]) out.push({ name: k, label: k, dur: S.moves[k].dur, loop: false, pose: (t, u) => S.anims[k](u) });
  out.push({ name: "block", label: "Đỡ", dur: 1, loop: true, pose: () => S.block() });
  out.push({ name: "dodge", label: "Lộn né", dur: 0.55, loop: false, pose: (t, u) => S.dodge(u) });
  out.push({ name: "hit", label: "Trúng đòn", dur: 0.6, loop: false, pose: (t, u) => S.hit(u) });
  out.push({ name: "down", label: "Ngã", dur: 1.2, loop: false, pose: (t, u) => S.down(u) });
  return out;
}

// Người diễn: rig game ẩn + rig-motion. Một chu kỳ chạy = 2π / nhịp bước (để clip chạy lặp liền).
export function makeDriver(setKey) {
  const S = SETS[setKey], rig = makeRig(RIGS[S.rig]), motion = new RigMotion(rig);
  const d = { set: setKey, rig, motion, pose: A.zeroPose() };
  d.runDur = (2 * Math.PI) / A.gait(S.speed, rig.scale).rate;
  return d;
}
export function disposeDriver(d) { disposeRig(d.rig); }
const flat = () => 0;
export function durOf(d, clip) { return clip.dur ?? d.runDur; }

// Đặt người diễn ở thời điểm t (s) của clip. blend: hệ số trộn với tư thế trước (1 = đặt thẳng — dùng khi nướng).
export function poseDriver(d, clip, t, dt = 1 / 30, blend = 1) {
  const dur = durOf(d, clip), u = clip.loop ? (t % dur) / dur : Math.min(1, t / dur);
  const target = clip.pose(t, u, d);
  d.pose = blend >= 1 ? target : A.blendPose(d.pose, target, blend);
  A.applyPose(d.rig, d.pose);
  d.rig.root.position.set(0, 0, 0); d.rig.root.rotation.set(0, 0, 0);
  d.rig.root.updateMatrixWorld(true);
  d.motion.update(dt, d.pose, flat);
}

// Chép góc khớp người diễn → xương mô hình. hipsRest: vị trí nghỉ của xương hông mô hình (autorig rest.hips).
export function copyPose(d, byName, hipsRest) {
  const p = d.rig.p;
  for (const name of JOINTS) { const b = byName[name], j = p[name]; if (b && j) b.quaternion.copy(j.quaternion); }
  const h = p.hips.position;
  byName.hips.position.set(hipsRest.x + h.x, hipsRest.y + (h.y - GAME.hips), hipsRest.z + h.z);
}

// Nướng các clip thành AnimationClip (track theo tên xương). Quaternion giữ cùng bán cầu với khung trước (không lật).
export function bakeClips(setKey, byName, hipsRest, names = null, fps = 30) {
  const d = makeDriver(setKey), clips = [];
  try {
    for (const clip of clipList(setKey)) {
      if (names && !names.includes(clip.name)) continue;
      const dur = durOf(d, clip), n = Math.max(2, Math.round(dur * fps) + 1);
      const times = new Float32Array(n), q = Object.fromEntries(JOINTS.map((k) => [k, new Float32Array(n * 4)])), hp = new Float32Array(n * 3);
      // khởi động rig-motion (lò xo, IK) bằng nửa giây đầu clip để khung đầu không giật
      d.pose = clip.pose(0, 0, d); for (let w = 0; w < 15; w++) poseDriver(d, clip, 0, 1 / 30);
      for (let i = 0; i < n; i++) {
        const t = (i / (n - 1)) * dur;
        poseDriver(d, clip, clip.loop && i === n - 1 ? 0 : t, 1 / fps);
        copyPose(d, byName, hipsRest);
        times[i] = t;
        for (const k of JOINTS) {
          const b = byName[k], a = q[k];
          let x = b.quaternion.x, y = b.quaternion.y, z = b.quaternion.z, w = b.quaternion.w;
          if (i > 0 && a[i * 4 - 4] * x + a[i * 4 - 3] * y + a[i * 4 - 2] * z + a[i * 4 - 1] * w < 0) { x = -x; y = -y; z = -z; w = -w; }
          a.set([x, y, z, w], i * 4);
        }
        hp.set([byName.hips.position.x, byName.hips.position.y, byName.hips.position.z], i * 3);
      }
      const tracks = JOINTS.map((k) => new THREE.QuaternionKeyframeTrack(`${k}.quaternion`, times, q[k]));
      tracks.push(new THREE.VectorKeyframeTrack("hips.position", times, hp));
      clips.push(new THREE.AnimationClip(clip.name, dur, tracks));
    }
  } finally { disposeDriver(d); }
  return clips;
}
