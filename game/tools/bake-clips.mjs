// tools/bake-clips.mjs — nướng clip hoạt ảnh xương người (Quaternius UAL, Mixamo…) thành bảng góc của rig game: assets/anim/clips.json.
//   node game/tools/bake-clips.mjs              nướng mọi clip trong CLIPS, in sai số FK, ghi clips.json
//   node game/tools/bake-clips.mjs --list       liệt kê clip có trong từng nguồn (để chọn thêm vào CLIPS)
//   node game/tools/bake-clips.mjs --only jog,hySide   chỉ nướng các clip tên đó (vẫn ghi cả tệp, giữ các clip khác của lần trước)
//   Mixamo: thả FBX vào game/anim-src/mixamo/ (tải "FBX Binary", skin tuỳ ý, clip chạy bộ nên chọn "In Place"). Lệnh nướng tự đổi FBX → GLB bằng
//   Blender chạy nền (tools/fbx2glb.py; tìm `blender` trong PATH hoặc biến BLENDER) rồi nướng mỗi tệp thành clip "mx_<tên tệp>" và TỰ PHÂN LOẠI:
//   vòng lặp (khung đầu ≈ khung cuối), chạy bộ (tốc độ chân trụ, hoặc tốc độ hông nếu clip có chuyển động gốc), đòn (tay vung ≥ 10 m/s → căn hướng
//   hông về phía trước lúc vung). In kết quả phân loại để ghép vào game (clip-moves.js CLIP_SPECS, anim.js).
//
// Mỗi nguồn là một GLB (Quaternius đã là GLB; clip Mixamo tải về FBX thì đổi sang GLB bằng Blender hoặc FBX2glTF rồi bỏ vào
// anim-src/mixamo/). Bước: dựng bộ khung hệ trục game từ tư thế nghỉ (mặt nhìn +z, "R" ở +x — tay phải giải phẫu của nguồn thành R
// của game, vì R của game là tay cầm vũ khí chính), lấy mẫu clip 30 khung/giây bằng AnimationMixer, đổi vị trí khớp sang hệ trục game
// nhân tỉ lệ cho hông cao 0,92, giải ngược ra góc rig (retarget.mjs), gỡ nhảy góc, dịch pha cho clip chạy bộ (khung 0 = chân R chạm
// đất phía trước), đo tốc độ chân trụ (m/s đơn vị rig), rồi chạy lại từng khung trên rig game thật để đo sai số vị trí khớp.
// Nguồn thô (anim-src/) không đưa vào bản deploy; chỉ clips.json (vài chục KB) nằm trong assets/anim/.

import { registerHooks } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const threeUrl = pathToFileURL(path.join(ROOT, "vendor/three/three.module.js")).href;
registerHooks({ resolve: (s, c, next) => (s === "three" ? { url: threeUrl, shortCircuit: true } : next(s, c)) });
const THREE = await import("three");
const { GLTFLoader } = await import(pathToFileURL(path.join(ROOT, "vendor/three/addons/loaders/GLTFLoader.js")).href);
const { solvePose, newState, KEYS, WRAP, HIPS_Y, torsoFrame, armPlaneFix } = await import("./retarget.mjs");
const W1 = await import("../js/battle/anim-wc01.js");
const { makeRig } = await import("../js/battle/models.js");
const A = await import("../js/battle/anim.js");

const OUT = process.argv.includes("--out") ? path.resolve(process.argv[process.argv.indexOf("--out") + 1]) : path.join(ROOT, "assets/anim/clips.json");
const FPS = 30, TAU = Math.PI * 2;

// ---- nguồn và bảng tên xương --------------------------------------------------------------------------------------------------
// Tên xương theo THREE.PropertyBinding.sanitizeNodeName (bỏ dấu chấm, ":" …). Vai trò: hips, spine (gốc cột sống trên), neck, head
// (xương đầu: trục y cục bộ = hướng lên của đầu), mỗi bên: arm (khớp vai), fore (khuỷu), hand (cổ tay), mid (gốc ngón giữa), thigh
// (háng), shin (gối), foot (cổ chân), toe.
const SKELS = {
  ual: { hips: "DEF-hips", spine: "DEF-spine001", neck: "DEF-neck", head: "DEF-head",
    side: (s) => ({ arm: `DEF-upper_arm${s}`, fore: `DEF-forearm${s}`, hand: `DEF-hand${s}`, mid: `DEF-f_middle01${s}`,
      thigh: `DEF-thigh${s}`, shin: `DEF-shin${s}`, foot: `DEF-foot${s}`, toe: `DEF-toe${s}` }) },
  // Skeleton kiểu Unreal (Quaternius UAL 2): hậu tố bên là chữ thường _l / _r
  ue: { hips: "pelvis", spine: "spine_01", neck: "neck_01", head: "Head",
    side: (s) => { const x = s.toLowerCase(); return { arm: `upperarm_${x}`, fore: `lowerarm_${x}`, hand: `hand_${x}`, mid: `middle_01_${x}`,
      thigh: `thigh_${x}`, shin: `calf_${x}`, foot: `foot_${x}`, toe: `ball_${x}` }; } },
  mixamo: { hips: "mixamorigHips", spine: "mixamorigSpine", neck: "mixamorigNeck", head: "mixamorigHead", headTip: "mixamorigHeadTop_End",
    side: (s) => { const n = s === "L" ? "Left" : "Right"; return { arm: `mixamorig${n}Arm`, fore: `mixamorig${n}ForeArm`, hand: `mixamorig${n}Hand`,
      mid: `mixamorig${n}HandMiddle1`, thigh: `mixamorig${n}UpLeg`, shin: `mixamorig${n}Leg`, foot: `mixamorig${n}Foot`, toe: `mixamorig${n}ToeBase` }; } },
  // Haley Tuffles (mocap miễn phí, iPi Soft): xương người chuẩn nhưng tên lạ — L/RShoulder là CÁNH TAY TRÊN (sau L/RClavicle), Finger0 ngón cái, Finger2 ngón giữa
  hy: { hips: "Hip", spine: "LowerSpine", neck: "Neck", head: "Head",
    side: (s) => ({ arm: `${s}Shoulder`, fore: `${s}Forearm`, hand: `${s}Hand`, mid: `${s}Finger2`,
      thigh: `${s}Thigh`, shin: `${s}Shin`, foot: `${s}Foot`, toe: `${s}Toe` }) },
  // Motifect (mocap sinh bằng AI, anim-src/motifect): KHÔNG có xương hông — nút "Hips" là gốc cảnh (không phải khớp) mang chuyển động hông, cột sống và hai
  // chân là ba gốc rời nhau; LeftLeg / RightLeg là ĐÙI.
  // Human Melee Animations FREE (Kevin Iglesias, rig 55 xương B-*, nam HumanM@ / nữ HumanF@): chỉ một thân hông / ngực, không có Spine1–2
  hm: { hips: "B-hips", spine: "B-spine", neck: "B-neck", head: "B-head",
    side: (s) => ({ arm: `B-upperArm${s}`, fore: `B-forearm${s}`, hand: `B-hand${s}`, mid: `B-middleFinger01${s}`,
      thigh: `B-thigh${s}`, shin: `B-shin${s}`, foot: `B-foot${s}`, toe: `B-toe${s}` }) },
  mt: { hips: "Hips", spine: "Spine1", neck: "Neck1", head: "Head",
    side: (s) => { const n = s === "L" ? "Left" : "Right"; return { arm: `${n}Arm`, fore: `${n}ForeArm`, hand: `${n}Hand`, mid: `${n}HandMiddle1`,
      thigh: `${n}Leg`, shin: `${n}Shin`, foot: `${n}Foot`, toe: `${n}ToeBase` }; } },
};
const SOURCES = {
  ual: { file: "anim-src/ual/Animation Library[Standard]/Godot/AnimationLibrary_Godot_Standard.glb", skel: "ual" },
  ual2: { file: "anim-src/ual2/Universal Animation Library 2 [Standard]/Unreal-Godot/UAL2_Standard.glb", skel: "ue" },
};
// Clip cần nướng: tên trong game ← clip nguồn. loop: vòng lặp; gait: clip chạy bộ (dịch pha, đo tốc độ chân trụ).
const CLIPS = {
  // speed: tốc độ chân trụ đã hiệu chỉnh bằng đo độ trượt chân trên đất trong pipeline của game (RigMotion, quét tốc độ 0,6–1,4 × danh định): jog 5,0 → trượt
  // trung vị 5% (ước lượng hình học 5,35 → 9%), walk 1,06 → 19% (thấp nhất trong dải). Sprint_Loop (3–4 khung chạm đất) không xuống dưới 22% ở mọi tốc độ: bỏ khỏi
  // tầng chạy — chạy nhanh hơn thì tăng nhịp jog (locoRate), chân vẫn bám đất.
  jog:       { src: "ual", clip: "Jog_Fwd_Loop", loop: true, gait: true, speed: 5.0 },       // đứng đầu: chuẩn căn pha cho walk
  walk:      { src: "ual", clip: "Walk_Loop", loop: true, gait: true, speed: 1.06 },
  idle:      { src: "ual", clip: "Idle_Loop", loop: true },
  swordIdle: { src: "ual", clip: "Sword_Idle", loop: true },
  hitChest:  { src: "ual", clip: "Hit_Chest" },
  hitHead:   { src: "ual", clip: "Hit_Head" },
  roll:      { src: "ual", clip: "Roll" },
  death:     { src: "ual", clip: "Death01" },
  attack:    { src: "ual", clip: "Sword_Attack", aim: true },
  swordA:    { src: "ual2", clip: "Sword_Regular_A", aim: true },
  swordARec: { src: "ual2", clip: "Sword_Regular_A_Rec" },
  swordB:    { src: "ual2", clip: "Sword_Regular_B", aim: true },
  swordBRec: { src: "ual2", clip: "Sword_Regular_B_Rec" },
  swordC:    { src: "ual2", clip: "Sword_Regular_C", aim: true },
  swordCombo:{ src: "ual2", clip: "Sword_Regular_Combo", aim: true },
  swordBlock:{ src: "ual2", clip: "Sword_Block" },
  swordDash: { src: "ual2", clip: "Sword_Dash_RM", aim: true },
  knockback: { src: "ual2", clip: "Hit_Knockback" },
  hook:      { src: "ual2", clip: "Melee_Hook", aim: true },
  hookRec:   { src: "ual2", clip: "Melee_Hook_Rec" },
  shieldIdle:{ src: "ual2", clip: "Idle_Shield_Loop", loop: true },
  // Đại kiếm hai tay (Mixamo, anim-src/mixamo): sword = tay giải theo gươm (swordArms), aim = hông quay về địch lúc chém. Khai báo tường minh vì
  // tự phân loại hay nhầm nhát chém (kết thúc về lại thế cũ) thành "đứng tại chỗ".
  gsIdle:    { src: "mx:great sword idle", clip: "great sword idle", loop: true, sword: true },
  gsSlash1:  { src: "mx:great sword slash", clip: "great sword slash", aim: true, sword: true },
  gsSlash2:  { src: "mx:great sword slash (2)", clip: "great sword slash (2)", aim: true, sword: true },
  gsSlash3:  { src: "mx:great sword slash (3)", clip: "great sword slash (3)", aim: true, sword: true },
  gsSlash4:  { src: "mx:great sword slash (4)", clip: "great sword slash (4)", aim: true, sword: true },
  gsSlash5:  { src: "mx:great sword slash (5)", clip: "great sword slash (5)", aim: true, sword: true },
  gsSpin:    { src: "mx:great sword high spin attack", clip: "great sword high spin attack", aim: true, sword: true },
  gsHilt:    { src: "mx:great sword attack", clip: "great sword attack", aim: true, sword: true },
  getUp:     { src: "ual2", clip: "LayToIdle" },
  // Nhát kiếm một tay của Haley Tuffles (anim-src/haley, 24 fps, tay phải vung). trim = [giây đầu, giây cuối] nướng: bỏ ~1 s lấy đà đứng chờ đầu clip
  // (để cú chém không bị bóp 4–5× vào 0,2–0,5 s của đòn game, còn ~2×) và đoạn thừa sau cú chém — ứng với t0 … cú chém + (cú chém − t0) × (1 − hit) / hit
  // của đòn dùng clip (hero-anim.js CLIP_SPECS, even). hySide2 → N5 (quét ngang), hyFront → C1 (lao bổ), hyDown → DQ (nhảy lên bổ xuống, tiếp đất quỳ).
  // Còn trong anim-src/haley chưa dùng: SwordSwingSide (quét ngang mạnh nhất, 19 m/s), SwordSwingFrontHeavy (chuỗi quay 26 s, nhát nặng ở 1,35 s).
  hySide2:   { src: "hy:SwordSwingSide2", clip: "SwordSwingSide2", aim: true, trim: [0.45, 1.5] },
  hyFront:   { src: "hy:SwordSwingFront", clip: "SwordSwingFront", aim: true, trim: [0.55, 2.0] },
  hyDown:    { src: "hy:SwordSwingDown", clip: "SwordSwingDown", aim: true, trim: [0.95, 2.9] },
  // Motifect (mocap sinh bằng AI, anim-src/motifect, 30 fps; mọi clip bị kéo dài thành 3–6 s nên trim bỏ đoạn đứng chờ): khuỵu gối rồi gục đầu → Vỡ Thế của sĩ quan / boss
  // (anim.js stagger). Đã thử, không dùng: knockdown_fall + get_up (ngã SẤP rồi đứng dậy, không nối được với knockback / LayToIdle nằm NGỬA của downPose; đứng dậy mất
  // 2,5 s, nén vào 0,55 s của trạng thái ngã là ~4,5× so với ~2,4× của LayToIdle), hit_react_* (giật nhẹ, không hơn Hit_Chest × HIT_GAIN).
  // Human Melee Animations FREE (anim-src/humanmelee, bản nam HumanM@…, 30 fps, đòn ~1–1,6 s, tay phải): giáo, hai tay, một tay, húc khiên → clip-moves.js SWINGS
  // (lính cận vệ, tướng đồng minh, sĩ quan cán dài). Đã thử, không dùng: Death01 (ngã SẤP, rootX +1,6; ngã của game nằm NGỬA), CombatDamage01 (1 s, đòn trúng đòn của game 0,3 s),
  // Run01_* / StrafeRun01_* (8 hướng: chỉ tướng chạy tiến, quay mặt theo hướng chạy; đi ngang của sĩ quan 1,5 m/s dùng bước IK guardStep đã đo trượt chân, clip chạy 3,2–3,7 m/s).
  hmPolearm: { src: "hm:HumanM@AttackPolearm01", clip: "HumanM@AttackPolearm01", aim: true },
  hm2H:      { src: "hm:HumanM@Attack2H01", clip: "HumanM@Attack2H01", aim: true },
  hm1H:      { src: "hm:HumanM@Attack1H01_R", clip: "HumanM@Attack1H01_R", aim: true },
  hmShield:  { src: "hm:HumanM@AttackShield01", clip: "HumanM@AttackShield01", aim: true },
  mtKnees:   { src: "mt:knocked_to_knees", clip: "knocked_to_knees", trim: [0.8, 2.6] },
};

const args = process.argv.slice(2);
// Ad hoc (kiểm thử, thử clip lạ): --src id=tệp.glb:bộXương  --clip tên=id:TênClipNguồn[:loop]   (lặp lại được)
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--src") { const [id, rest] = args[i + 1].split(/=(.*)/s); const k = rest.lastIndexOf(":"); SOURCES[id] = { file: rest.slice(0, k), skel: rest.slice(k + 1) }; }
  if (args[i] === "--clip") { const [name, rest] = args[i + 1].split(/=(.*)/s); const [src, clip, loop] = rest.split(":"); CLIPS[name] = { src, clip, ...(loop === "loop" ? { loop: true } : {}) }; }
}
const flag = (n) => args.includes(n), opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };

async function loadGLB(file) {
  const buf = fs.readFileSync(path.resolve(ROOT, file));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new Promise((res, rej) => new GLTFLoader().parse(ab, "", res, rej));
}

// ---- chuẩn bị nguồn: hệ trục game, tỉ lệ ----------------------------------------------------------------------------------------
function prepare(gltf, skelId) {
  const S = SKELS[skelId], root = gltf.scene;
  root.updateMatrixWorld(true);
  const node = (n) => { const o = root.getObjectByName(n); if (!o) throw new Error(`thiếu xương "${n}" (bộ ${skelId})`); return o; };
  const bones = { hips: node(S.hips), spine: node(S.spine), neck: node(S.neck), head: node(S.head), L: {}, R: {} };
  if (S.headTip) bones.tip = root.getObjectByName(S.headTip) || null;      // đỉnh đầu (Mixamo HeadTop_End): hướng "lên" của đầu không phụ thuộc trục xương
  for (const s of ["L", "R"]) for (const [k, n] of Object.entries(S.side(s))) bones[s][k] = node(n);   // s ở đây là tay GIẢI PHẪU (L/R theo tên xương)
  const wp = (o) => o.getWorldPosition(new THREE.Vector3());
  // hướng mặt: ngón chân so với cổ chân, chiếu ngang
  const fwd = new THREE.Vector3();
  for (const s of ["L", "R"]) fwd.add(wp(bones[s].toe).sub(wp(bones[s].foot)));
  fwd.y = 0; fwd.normalize();
  const up = new THREE.Vector3(0, 1, 0), right = new THREE.Vector3().crossVectors(fwd, up);     // phải giải phẫu = f × u
  // tay phải giải phẫu phải nằm phía +right (kiểm tên xương đúng bên)
  const side = wp(bones.R.thigh).sub(wp(bones.L.thigh)).dot(right);
  if (side <= 0) throw new Error(`bộ ${skelId}: xương "R" không nằm bên phải giải phẫu (đổi tên L/R trong SKELS)`);
  // hệ trục game: x = phải giải phẫu (→ R của game ở +x), y = lên, z = mặt nhìn
  const toGame = (v) => new THREE.Vector3(v.dot(right), v.dot(up), v.dot(fwd));
  const k = HIPS_Y / toGame(wp(bones.hips)).y;           // tỉ lệ: hông đứng thẳng cao 0,92
  return { root, bones, wp, toGame, k };
}

// Vị trí khớp của khung hiện tại (mixer đã đặt), hệ trục game, nhân tỉ lệ.
function jointsNow(src) {
  const { bones, wp, toGame, k } = src;
  src.root.updateMatrixWorld(true);
  const g = (o) => toGame(wp(o)).multiplyScalar(k);
  const q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  bones.head.getWorldQuaternion(q);
  const headUp = bones.tip ? g(bones.tip).sub(g(bones.head)).normalize() : toGame(up.clone().applyQuaternion(q)).normalize();
  const P = { hips: g(bones.hips), spine: g(bones.spine), neck: g(bones.neck), headUp };
  // game L = tay trái giải phẫu = bên −x của game: tay phải giải phẫu (tên "R") → game R (+x)
  for (const s of ["L", "R"]) { P[s] = {}; for (const key of Object.keys(bones[s])) P[s][key] = g(bones[s][key]); }
  return P;
}

// ---- lấy mẫu một clip -----------------------------------------------------------------------------------------------------------
function sampleClip(src, clip, cfg) {
  // trim: [giây đầu, giây cuối] — chỉ nướng đoạn này của clip nguồn (bỏ đoạn đứng chờ / đoạn thừa của chuỗi quay dài); dur, strike, start tính theo đoạn đã cắt
  const ta = cfg.trim ? cfg.trim[0] : 0, D = (cfg.trim ? Math.min(cfg.trim[1], clip.duration) : clip.duration) - ta;
  const loop = !!cfg.loop, n = loop ? Math.max(2, Math.round(D * FPS)) : Math.max(2, Math.ceil(D * FPS) + 1);
  const mixer = new THREE.AnimationMixer(src.root), action = mixer.clipAction(clip);
  action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; action.play();
  const frames = [], joints = [], st = newState();
  st.trace = { L: [], R: [] };
  for (let i = 0; i < n; i++) {
    const t = ta + (loop ? (i * D) / n : Math.min(D, (i * D) / (n - 1)));
    mixer.setTime(t);
    const P = jointsNow(src);
    joints.push(P);
    frames.push(solvePose(P, st, {}));
  }
  mixer.uncacheAction(clip);
  // vai lật ~180° qua khung khuỷu duỗi thẳng (xem armPlaneFix): giải lại cả clip với mặt phẳng gập rải đều ra đoạn khuỷu gần thẳng; clip không lật giữ nguyên
  const fix = armPlaneFix(st.trace);
  if (fix) { const st2 = newState(); for (let i = 0; i < n; i++) { st2.over = fix[i]; frames[i] = solvePose(joints[i], st2, {}); } console.log("    (đã rải cú lật mặt phẳng khuỷu của " + fix.filter((f) => f.L || f.R).length + " khung)"); }
  return { n, dur: D, frames, joints, loop };
}

// Hướng mặt lúc vung: clip đòn xoay hông rất nhiều khi vung (swordA ≈ 117°, swordC > 230°), nhưng trong game vùng sát thương nằm trước mặt hero và
// hero.yaw đã quay về địch: lúc cú vung nhanh nhất hông phải quay đúng về phía trước. Xoay cả hướng toàn thân quanh trục dọc một góc −θ (θ = hướng
// mặt của hông ở khung vung nhanh nhất), R' = Ry(−θ)·R, rồi tách lại Euler XYZ. Chân, thân, tay theo hông nên không đổi tương đối.
function aimAtStrike(sample, strikeT) {
  const dt = sample.dur / (sample.loop ? sample.n : sample.n - 1), at = Math.min(sample.n - 1, Math.max(0, Math.round(strikeT / dt)));
  const mat = (f) => new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(f.rootX, f.hipsYaw, f.rootZ, "XYZ"));
  const fwd = new THREE.Vector3(0, 0, 1).applyMatrix4(mat(sample.frames[at])), theta = Math.atan2(fwd.x, fwd.z);
  const ry = new THREE.Matrix4().makeRotationY(-theta), e = new THREE.Euler();
  for (const f of sample.frames) {
    e.setFromRotationMatrix(ry.clone().multiply(mat(f)), "XYZ");
    f.rootX = e.x; f.hipsYaw = e.y; f.rootZ = e.z;
  }
  return theta;
}

// Gươm hai tay (đại kiếm WC01): tay không theo hướng đoạn xương như clip thường mà theo GƯƠM. Đích gươm suy từ hai bàn tay: lưỡi d = tay phải − tay trái
// (cách nhau ~0,2 m — đúng GRIP của game, tay phải dẫn lưỡi), cổ tay phải ở W = vai rig + (bàn tay − vai nguồn) × tỉ lệ độ dài tay (tay rig 0,70 so với tay
// nhân vật nguồn), tất cả trong khung thân; rồi dùng đúng bộ IK của anim-wc01.js (solveRight / solveLeft) giải ra góc tay cho rig khối — fitArms
// (rig-motion.js) giải lại theo số đo tay từng mô hình, tay trái bám chuôi bằng kênh grip = 1. Hai tay quá gần (< 7 cm): giữ hướng lưỡi khung trước.
function swordArms(sample) {
  let prevD = new THREE.Vector3(0, 1, 0);
  const track = { el: null };
  sample.frames.forEach((f, i) => {
    const P = sample.joints[i], inv = torsoFrame(P).transpose();
    const toT = (v) => v.clone().applyMatrix4(inv);
    const armLen = P.R.arm.distanceTo(P.R.fore) + P.R.fore.distanceTo(P.R.hand), rho = (W1.ARM.L1 + W1.ARM.L2) / armLen;
    const W = toT(P.R.hand.clone().sub(P.R.arm)).multiplyScalar(rho).add(new THREE.Vector3(...W1.SH.R));
    const d = P.R.hand.clone().sub(P.L.hand);
    if (d.length() >= 0.07) prevD = d.normalize();
    const D = toT(prevD), r = W1.solveRight([W.x, W.y, W.z], [D.x, D.y, D.z], null, track);
    Object.assign(f, { shRx: r.shRx, shRy: r.shRy, shRz: r.shRz, elRx: r.elRx, handRx: r.handRx, handRz: r.handRz });
    const l = W1.solveLeft([W.x - W1.GRIP * D.x, W.y - W1.GRIP * D.y, W.z - W1.GRIP * D.z]);
    Object.assign(f, { shLx: l.shLx, shLy: l.shLy, shLz: l.shLz, elLx: l.elLx, handLx: 0.3, handLz: 0 });
  });
}

// Liền mạch góc Euler. Mỗi khớp 3 bậc (hông, thân: XYZ; vai: YXZ) có hai bộ ba góc cho cùng một hướng — (a, b, c) và (a + π, π − b, c + π)
// với b là góc giữa — và mỗi góc còn cộng được bội 2π. Gần gimbal (b ≈ ±90°) bộ giải Euler nhảy sang bộ kia giữa hai khung: hướng tay không đổi nhưng
// nội suy tuyến tính các góc làm tay quay vòng trong 1–2 khung hình (đã đo: nhảy 3–6 rad ở vai, hông của clip chém, ngã). Mỗi khung chọn, trong
// hai bộ ba và mọi bội 2π, bộ gần khung trước nhất (tổng bình phương lệch nhỏ nhất). Kênh còn lại (WRAP) chỉ gỡ bội 2π.
const EULER = [["rootX", "hipsYaw", "rootZ", 1], ["torsoX", "torsoY", "torsoZ", 1],
  ["shLy", "shLx", "shLz", 1], ["shRy", "shRx", "shRz", 1]];       // [góc 1, góc giữa, góc 3, vị trí góc giữa trong mảng] — vai YXZ: giữa là x
function unwrap(frames) {
  const near = (v, ref) => v - TAU * Math.round((v - ref) / TAU);
  for (const [k0, k1, k2] of EULER) for (let i = 1; i < frames.length; i++) {
    const f = frames[i], prev = frames[i - 1];
    const cands = [[f[k0], f[k1], f[k2]], [f[k0] + Math.PI, Math.PI - f[k1], f[k2] + Math.PI]];
    let best = null, bc = Infinity;
    for (const c of cands) {
      const n = [near(c[0], prev[k0]), near(c[1], prev[k1]), near(c[2], prev[k2])];
      const cost = (n[0] - prev[k0]) ** 2 + (n[1] - prev[k1]) ** 2 + (n[2] - prev[k2]) ** 2;
      if (cost < bc) { bc = cost; best = n; }
    }
    [f[k0], f[k1], f[k2]] = best;
  }
  const done = new Set(EULER.flat().filter((k) => typeof k === "string"));
  for (const key of WRAP) if (!done.has(key)) for (let i = 1; i < frames.length; i++) frames[i][key] -= TAU * Math.round((frames[i][key] - frames[i - 1][key]) / TAU);
}

// Vận tốc thân suy từ chân trụ, hai chiều: clip chạy tại chỗ nên chân trụ trượt lùi đúng bằng vận tốc thân, nên vận tốc thân = −trung vị vận tốc
// ngang của cổ chân trên các khung chạm đất (từng thành phần x, z; hệ trục game: +z trước, +x phải R). Vị trí cổ chân so với hông: clip tại chỗ thì hông
// đứng yên, clip có chuyển động gốc thì hông đi và chân trụ đứng yên trên đất — cả hai cho chân trụ trượt lùi đúng bằng vận tốc thân trong khung hông.
// Trả { speed, dir } với dir = góc hướng đi (rad): 0 tiến, +π/2 sang phải (+x, R), −π/2 trái, ±π lùi.
// Ước lượng từ hình học chỉ là điểm xuất phát: với clip dùng thật trong game (walk, jog) tốc độ chốt bằng cấu hình `speed` trong CLIPS, đã hiệu chỉnh bằng đo
// độ trượt chân trụ trong chính pipeline của game (clip nước rút chạm đất chỉ 3–4 khung ở 30 fps, mọi ước lượng nhiễu 0,4–8,9 m/s; đã thử trung vị vận tốc
// từng khung → 7,89, quãng đi lùi / thời gian chạm đất → 5,66, ngoài ra trượt ≥ 22% ở mọi tốc độ nên bỏ khỏi tầng chạy).
function footVelocity(sample) {
  const vx = [], vz = [], dt = sample.dur / sample.n, N = sample.n;
  const rx = (i, s) => sample.joints[i][s].foot.x - sample.joints[i].hips.x, rz = (i, s) => sample.joints[i][s].foot.z - sample.joints[i].hips.z;
  for (const s of ["L", "R"]) {
    const ys = sample.joints.map((P) => P[s].foot.y), lo = Math.min(...ys);
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      if (!sample.loop && i === N - 1) break;
      if (ys[i] < lo + 0.06 && ys[j] < lo + 0.06) { vx.push(-(rx(j, s) - rx(i, s)) / dt); vz.push(-(rz(j, s) - rz(i, s)) / dt); }
    }
  }
  const med = (a) => { a.sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : 0; };
  const x = med(vx), z = med(vz);
  return { speed: Math.hypot(x, z), dir: Math.atan2(x, z) };
}
// Tốc độ chân trụ theo phương tiến (đơn vị rig / s) của clip chạy bộ tiến.
const footSpeed = (sample) => Math.max(0, footVelocity(sample).speed);

// Mốc vung nhanh nhất: giây mà đầu bàn tay (gốc ngón giữa) nhanh nhất, gộp hai tay. Dùng để canh cú chém của clip vào mốc gây sát thương của đòn.
function strikeTime(sample) {
  let best = 0, bv = -1, hand = "R"; const dt = sample.dur / (sample.loop ? sample.n : sample.n - 1);
  for (let i = 1; i < sample.n; i++) for (const s of ["L", "R"]) {
    const v = sample.joints[i][s].mid.distanceTo(sample.joints[i - 1][s].mid) / dt;
    if (v > bv) { bv = v; best = (i - 0.5) * dt; hand = s; }
  }
  // start: lúc đầu tiên một bàn tay rời chỗ khung 0 hơn 8 cm (trừ 1 khung) — bỏ đoạn đứng chờ ở đầu clip khi ghép vào đòn
  let start = 0;
  for (let i = 1; i < sample.n; i++) {
    const moved = Math.max(...["L", "R"].map((s) => sample.joints[i][s].hand.clone().sub(sample.joints[i].hips).distanceTo(sample.joints[0][s].hand.clone().sub(sample.joints[0].hips))));
    if (moved > 0.08) { start = Math.max(0, (i - 1) * dt); break; }
  }
  return { t: best, v: bv, hand, start };
}

// Dịch vòng để khung 0 là lúc chân R (game, +x) ở xa nhất phía trước (chạm đất) — mọi clip chạy bộ cùng pha, trộn theo tốc độ được.
function alignPhase(sample, rel = false) {
  let best = 0, bz = -Infinity;
  sample.joints.forEach((P, i) => { const z = P.R.foot.z - (rel ? P.hips.z : 0); if (z > bz) { bz = z; best = i; } });
  const rot = (a) => a.slice(best).concat(a.slice(0, best));
  sample.frames = rot(sample.frames); sample.joints = rot(sample.joints);
  return best;
}

// Căn pha khít hơn: dịch vòng (khung nguyên) để tín hiệu chân của clip khớp nhất với clip chuẩn (jog) — walk / sprint có nhịp chạm đất khác nhau
// nên căn theo bàn chân vẫn lệch cả chục phần trăm vòng; không căn thì lúc trộn hai clip theo tốc độ hai chân bị bóng mờ.
const REG_KEYS = ["hipLx", "hipRx", "kneeLx", "kneeRx"];
function registerTo(sample, ref) {
  const at = (fr, f) => { const n = fr.length, i = Math.floor(f) % n, j = (i + 1) % n, a = f - Math.floor(f); return (key) => fr[i][key] + (fr[j][key] - fr[i][key]) * a; };
  let best = 0, bc = Infinity;
  for (let sh = 0; sh < sample.n; sh++) {
    let c = 0;
    for (let i = 0; i < sample.n; i++) {
      const me = sample.frames[(i + sh) % sample.n], rv = at(ref.frames, (i / sample.n) * ref.n);
      for (const k of REG_KEYS) c += (me[k] - rv(k)) ** 2;
    }
    if (c < bc) { bc = c; best = sh; }
  }
  const rot = (a) => a.slice(best).concat(a.slice(0, best));
  sample.frames = rot(sample.frames); sample.joints = rot(sample.joints);
  return best;
}

// ---- kiểm sai số: chạy từng khung trên rig game thật, so HƯỚNG từng đoạn xương với clip gốc -------------------------------------
// (so vị trí vô nghĩa: nhân vật nguồn tay chân ngắn hơn rig game, hướng mới là thứ rig tái tạo). Đơn vị độ.
const rig = makeRig({});
function fkError(sample) {
  const w = (o) => o.localToWorld(new THREE.Vector3());
  const ang = (a, b) => (Math.acos(Math.min(1, Math.max(-1, a.dot(b)))) * 180) / Math.PI;
  const dir = (p, q) => q.clone().sub(p).normalize();
  let sum = 0, max = 0, cnt = 0, worst = "";
  const per = {};
  sample.frames.forEach((fr, i) => {
    A.applyPose(rig, Object.assign(A.zeroPose(), fr));
    rig.root.updateMatrixWorld(true);
    const P = sample.joints[i], R = rig.p;
    const segs = [["vai", dir(w(R.shL), w(R.shR)), dir(P.L.arm, P.R.arm)], ["háng", dir(w(R.hipL), w(R.hipR)), dir(P.L.thigh, P.R.thigh)]];
    for (const s of ["L", "R"]) segs.push([s + ".tayTrên", dir(w(R["sh" + s]), w(R["el" + s])), dir(P[s].arm, P[s].fore)],
      [s + ".cẳngTay", dir(w(R["el" + s]), w(R["hand" + s])), dir(P[s].fore, P[s].hand)],
      [s + ".đùi", dir(w(R["hip" + s]), w(R["knee" + s])), dir(P[s].thigh, P[s].shin)],
      [s + ".cẳngChân", dir(w(R["knee" + s]), w(R["ankle" + s])), dir(P[s].shin, P[s].foot)]);
    for (const [name, a, b] of segs) {
      const e = ang(a, b); sum += e; cnt++; per[name] = (per[name] || 0) + e / sample.n;
      if (e > max) { max = e; worst = `${name}@${i}`; }
    }
  });
  return { mean: sum / cnt, max, worst, per };
}

// ---- chính ---------------------------------------------------------------------------------------------------------------------------
if (flag("--list")) {
  for (const [id, s] of Object.entries(SOURCES)) {
    const g = await loadGLB(s.file);
    console.log(`${id}: ${g.animations.map((a) => `${a.name} (${a.duration.toFixed(2)}s)`).join(", ")}`);
  }
  process.exit(0);
}

// ---- Mixamo: tìm FBX / GLB trong anim-src/mixamo, đổi FBX → GLB bằng Blender nền, đăng ký clip tự phân loại --------------------------------------
function findBlender() {
  for (const exe of [process.env.BLENDER, "blender"].filter(Boolean)) if (spawnSync(exe, ["--version"], { encoding: "utf8" }).status === 0) return exe;
  return null;
}
// FBX → GLB bằng Blender chạy nền (tools/fbx2glb.py); bỏ qua nếu GLB đã mới hơn FBX. Trả true nếu có GLB dùng được.
function ensureGlb(fbx, glb) {
  if (fs.existsSync(glb) && fs.statSync(glb).mtimeMs >= fs.statSync(fbx).mtimeMs) return true;
  const blender = findBlender();
  if (!blender) { console.log(`  ! ${path.basename(fbx)}: cần Blender để đổi FBX sang GLB (cài và thêm vào PATH, hoặc đặt biến BLENDER); hoặc tự xuất GLB vào cùng thư mục`); return false; }
  process.stdout.write(`  đổi ${path.basename(fbx)} → GLB bằng Blender… `);
  const r = spawnSync(blender, ["--background", "--python", path.join(ROOT, "tools/fbx2glb.py"), "--", fbx, glb], { encoding: "utf8" });
  const ok = r.status === 0 && fs.existsSync(glb);
  console.log(ok ? "xong" : ["LỖI", ...(r.stdout || "").split("\n").slice(-6), r.stderr || ""].join("\n"));
  return ok;
}
// Gói mocap theo thư mục: thả FBX vào anim-src/<thư mục>/; mỗi tệp thành nguồn "<tiền tố>:<tên tệp>" với bộ xương skel. Không tự thêm clip: khai báo tường minh
// trong CLIPS. ref: nguồn dùng dựng khung hệ trục cho cả gói — prepare() lấy hướng mặt từ tư thế NGHỈ của tệp, mà clip bắt đầu / kết thúc nằm dưới đất
// (đứng dậy, ngã, chết) có tư thế nghỉ không đứng ("xương R không nằm bên phải giải phẫu"); clip vẫn phát trên khung của tệp đứng thẳng (khớp theo tên nút).
const PACKS = [{ dir: "haley", prefix: "hy", skel: "hy" }, { dir: "motifect", prefix: "mt", skel: "mt", ref: "jab_right" },
  { dir: "humanmelee", prefix: "hm", skel: "hm" }];
function discoverPacks() {
  for (const pk of PACKS) {
    const dir = path.join(ROOT, "anim-src", pk.dir);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      const m = /^(.*).fbx$/i.exec(f); if (!m) continue;
      const glb = path.join(dir, m[1] + ".glb");
      if (ensureGlb(path.join(dir, f), glb)) SOURCES[pk.prefix + ":" + m[1]] = { file: glb, skel: pk.skel, ...(pk.ref ? { ref: pk.prefix + ":" + pk.ref } : {}) };
    }
  }
}
function discoverMixamo() {
  const dir = path.join(ROOT, "anim-src/mixamo");
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir)) {
    const m = /^(.*)\.fbx$/i.exec(f); if (!m) continue;
    ensureGlb(path.join(dir, f), path.join(dir, m[1] + ".glb"));
  }
  for (const f of fs.readdirSync(dir)) {
    const m = /^(.*)\.glb$/i.exec(f); if (!m) continue;
    const id = "mx:" + m[1], key = "mx_" + m[1].toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    SOURCES[id] = { file: path.join(dir, f), skel: "mixamo" };
    if (!CLIPS[key] && !Object.values(CLIPS).some((c) => c.src === id)) CLIPS[key] = { src: id, clip: m[1], auto: true, ...(/great sword|two handed sword|longsword/i.test(m[1]) ? { sword: true } : {}) };
  }
}
if (!flag("--list")) { discoverMixamo(); discoverPacks(); }

// Tự phân loại một clip lạ: lấy mẫu thử không lặp, rồi so khung đầu / cuối và đo tốc độ.
function classify(src, clip, cfg) {
  const pilot = sampleClip(src, clip, { loop: false });
  unwrap(pilot.frames);
  const wrapd = (d) => d - TAU * Math.round(d / TAU);
  const first = pilot.frames[0], last = pilot.frames[pilot.n - 1];
  const keys = KEYS.filter((k) => k !== "hipsY");
  const seam = keys.reduce((a, k) => a + Math.abs(wrapd(last[k] - first[k])), 0) / keys.length;
  const strike = strikeTime(pilot);
  cfg.loop = seam < 0.12 && pilot.dur >= 0.4;
  let note = `đầu≈cuối ${seam.toFixed(2)} rad`;
  if (cfg.loop) {
    const dt = pilot.dur / (pilot.n - 1), a = pilot.joints[0].hips, b = pilot.joints[pilot.n - 1].hips;
    const hipsSpeed = Math.hypot(b.x - a.x, b.z - a.z) / (pilot.dur);
    const fv = footVelocity({ ...pilot, loop: true, n: pilot.n - 1 }), fs_ = fv.speed;
    if (fs_ >= 0.5 || hipsSpeed >= 0.5) {
      cfg.gait = true; cfg.rootSpeed = fs_ >= 0.5 ? 0 : hipsSpeed; cfg.dir = fs_ >= 0.5 ? fv.dir : Math.atan2(b.x - a.x, b.z - a.z);
      note += `, chạy bộ (chân trụ ${fs_.toFixed(2)} hướng ${(fv.dir * 180 / Math.PI).toFixed(0)}°, hông ${hipsSpeed.toFixed(2)})`;
    } else note += ", đứng / tại chỗ";
  } else if (strike.v >= 10) { cfg.aim = true; note += `, đòn (tay ${strike.v.toFixed(0)} m/s)`; }
  else note += `, động tác (tay ${strike.v.toFixed(0)} m/s)`;
  cfg.note = note;
}

const MIXAMO_USE = [];                  // clip mx_* đưa vào clips.json (game dùng); xem ghi chú ở chỗ ghi tệp
const GAIT_REF = "jog";                  // clip chạy chuẩn để căn pha các clip chạy bộ khác (phải đứng trước chúng trong CLIPS)
let gaitRef = null;
const only = opt("--only") ? new Set(opt("--only").split(",")) : null;
const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : { clips: {} };
const result = { version: 1, fps: FPS, keys: KEYS, clips: { ...prev.clips } };
const cache = {};
let bad = 0;
for (const [name, cfg] of Object.entries(CLIPS)) {
  if (only && !only.has(name)) continue;
  const def = SOURCES[cfg.src];
  if (!def) { console.log(`  ! ${name}: chưa có nguồn "${cfg.src}" (thả FBX vào anim-src/haley/ hoặc anim-src/mixamo/); giữ bản đã nướng trong clips.json`); continue; }
  const gltf = (cache[cfg.src] ||= await loadGLB(def.file));
  const clip = gltf.animations.find((a) => a.name === cfg.clip) || gltf.animations.find((a) => a.name.endsWith("|" + cfg.clip));
  if (!clip) { console.log(`  ! ${name}: không có clip "${cfg.clip}" trong ${cfg.src}`); bad++; continue; }
  const refId = def.ref && SOURCES[def.ref] ? def.ref : cfg.src, src = (cache[refId + ":prep"] ||= prepare(refId === cfg.src ? gltf : (cache[refId] ||= await loadGLB(SOURCES[refId].file)), def.skel));
  if (cfg.auto) classify(src, clip, cfg);
  const sample = sampleClip(src, clip, cfg);
  if (opt("--probe") === name) {                       // in vị trí hai bàn tay (hệ trục game, đơn vị rig) để xem tay nào dẫn đầu, gươm hướng đâu
    for (let i = 0; i < sample.n; i += Math.max(1, Math.floor(sample.n / 8))) {
      const P = sample.joints[i], f = (v) => v.toArray().map((x) => x.toFixed(2)).join(","), d = P.R.hand.clone().sub(P.L.hand);
      console.log(`    f${i}: tay R ${f(P.R.hand.clone().sub(new THREE.Vector3(P.hips.x, 0, P.hips.z)))}  tay L ${f(P.L.hand.clone().sub(new THREE.Vector3(P.hips.x, 0, P.hips.z)))}  R−L ${f(d)} (dài ${d.length().toFixed(2)})`);
    }
  }
  const strike = cfg.loop ? null : strikeTime(sample);
  unwrap(sample.frames);
  const err = fkError(sample);                           // trước khi xoay hướng: so với hướng xương gốc của nguồn
  if (cfg.sword) { swordArms(sample); unwrap(sample.frames); }
  if (cfg.aim && strike) { const th = aimAtStrike(sample, strike.t); unwrap(sample.frames); cfg.aimTheta = th;
    // quay trọn vòng (swordC: hông xoay một vòng 360° trước khi chém): đặt góc ở khung vung về gần 0, không để lệch cả vòng (blendPose nội suy hipsYaw thẳng)
    const dt = sample.dur / (sample.n - 1), si = Math.min(sample.n - 1, Math.max(0, Math.round(strike.t / dt))), turns = Math.round(sample.frames[si].hipsYaw / TAU);
    if (turns) for (const f of sample.frames) f.hipsYaw -= TAU * turns; }
  let shift = 0, speed = 0, dir = 0;
  if (cfg.gait) {
    const sideways = cfg.dir !== undefined && Math.abs(cfg.dir) > 0.5;       // đi ngang / lùi: không căn pha theo chân R ra trước, giữ nhịp tự nhiên
    if (cfg.dir !== undefined) { const fv = footVelocity(sample); speed = fv.speed; dir = fv.dir; } else speed = footSpeed(sample);
    if (cfg.speed) speed = cfg.speed;                                              // đã hiệu chỉnh (xem CLIPS)
    if (speed < 0.3 && cfg.rootSpeed) { speed = cfg.rootSpeed; dir = cfg.dir; }   // clip có chuyển động gốc: chân trụ đứng yên trên đất, lấy vận tốc hông
    if (!sideways) {
      shift = alignPhase(sample, !!cfg.rootSpeed);
      if (name !== GAIT_REF && gaitRef) shift += registerTo(sample, gaitRef);
    }
    if (name === GAIT_REF) gaitRef = sample;
  }
  const r4 = (v) => Math.round(v * 1e4) / 1e4;
  const data = []; for (const fr of sample.frames) for (const k of KEYS) data.push(r4(fr[k]));
  result.clips[name] = { src: cfg.clip, dur: r4(sample.dur), n: sample.n, loop: !!cfg.loop, ...(cfg.gait ? { speed: r4(speed), shift, ...(cfg.dir !== undefined ? { dir: r4(dir) } : {}) } : {}), ...(strike ? { strike: r4(strike.t), start: r4(strike.start), hand: cfg.sword ? "R" : strike.hand } : {}), ...(cfg.sword ? { sword: 1 } : {}), data };
  console.log(`  ${name.padEnd(10)} ${cfg.clip.padEnd(16)} ${String(sample.n).padStart(3)} khung ${sample.dur.toFixed(2)}s${cfg.gait ? ` tốc độ chân trụ ${speed.toFixed(2)}${cfg.dir !== undefined ? ` hướng ${(dir * 180 / Math.PI).toFixed(0)}°` : ""}` : ""}${strike ? ` vung nhanh nhất tay ${strike.hand} ở ${strike.t.toFixed(2)}s (${strike.v.toFixed(1)} m/s)` : ""}` +
    `  lệch hướng xương: tb ${err.mean.toFixed(1)}°, tối đa ${err.max.toFixed(0)}° (${err.worst})`);
  if (cfg.note) console.log(`    ↳ ${cfg.note}`);
  if (err.mean > 8) { console.log(`  ! ${name}: sai số trung bình quá lớn`); bad++; }
}
// Clip Mixamo tự phát hiện (mx_*) chỉ vào clips.json (tải về máy người chơi) khi game dùng: tên có trong MIXAMO_USE hoặc truyền --use mx_a,mx_b / --use-all.
// Còn lại ghi ra anim-src/mixamo-baked.json (ngoài bản deploy) để xem phân loại, thử trong lab, chọn dùng sau.
const useArg = opt("--use");
const USE = new Set([...MIXAMO_USE, ...(useArg ? useArg.split(",") : [])]);
const staged = {};
for (const key of Object.keys(result.clips)) {
  if (key.startsWith("mx_") && !flag("--use-all") && !USE.has(key)) { staged[key] = result.clips[key]; delete result.clips[key]; }
}
if (Object.keys(staged).length) {
  const stPath = path.join(ROOT, "anim-src/mixamo-baked.json");
  const old = fs.existsSync(stPath) ? JSON.parse(fs.readFileSync(stPath, "utf8")).clips : {};
  fs.writeFileSync(stPath, JSON.stringify({ version: 1, fps: FPS, keys: KEYS, clips: { ...old, ...staged } }));
  console.log(`${Object.keys(staged).length} clip Mixamo chưa dùng → anim-src/mixamo-baked.json (đưa vào game: thêm tên vào MIXAMO_USE hoặc --use)`);
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(result));
console.log(`ghi ${path.relative(ROOT, OUT)} (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB, ${Object.keys(result.clips).length} clip)`);
process.exit(bad ? 1 : 0);
