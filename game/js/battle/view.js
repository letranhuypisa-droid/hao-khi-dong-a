// battle/view.js — nội suy khi vẽ (đợt 19c). Mô phỏng chạy bước cố định 1/60 s (battle/pacing.js); trước đây mỗi khung vẽ đúng trạng thái
// sau bước cuối, nên màn 90–144 Hz (khung 0 bước xen khung 1 bước), lúc chậm hình (×0,2–0,4: 3–5 khung mới có một bước) thấy lính, tướng
// đứng hình rồi nhảy trong khi camera vẫn trôi theo giờ thật. Nay vẽ giữa trạng thái đầu bước cuối và hiện tại theo α = acc / STEP
// (battle.js / arena.js gọi frame(α, ctx.clock) sau vòng bước); giờ vẽ clock = ctx.clock − (1 − α)·STEP.
//
// Chỉ ghi BẢN SAO để vẽ — mô phỏng không đọc gì từ đây:
//   · rig tướng, đơn vị lớn (cả cây khớp), vũ khí đặt đất (u.prop), nhãn cận vệ (u.label), vật đăng ký track() (chỉ gốc): capture() chụp TRS
//     cục bộ đầu mỗi bước (gọi trong vòng bước, trước khi bước chạy); begin() ghi giá trị nội suy ngay trước renderer.render; end() trả lại đúng
//     từng bit (pacing.js RigSnap) rồi dựng lại matrixWorld của cây như sau một lượt vẽ thường — bước sau thấy y như chưa từng nội suy;
//   · vệt lưỡi (toạ độ thế giới) dời theo gốc tướng trong lúc vẽ (follow);
//   · lính (crowd.capture / render: a.ix … → a.rx …), thuyền B20 (naval.capture / render → b.rv), mũi tên (lùi theo vận tốc) tự nội suy;
//   · camera, mặt trời nhắm vào vị trí vẽ của tướng (pos); chim, trâu, dân (ambient) chạy theo giờ vẽ.
// Gốc dời quá SNAP_D m trong một bước (dịch chuyển, hồi sinh, nạp checkpoint) thì vẽ ngay chỗ mới; cut() (nạp checkpoint) bỏ hẳn nội suy
// tới bước sau.

import { RigSnap, STEP } from "./pacing.js";

const _o = { x: 0, y: 0, z: 0 };

export class View {
  constructor() {
    this.tick = 0; this.alpha = 1; this.lag = 0; this.clock = 0;
    this.snaps = new WeakMap(); this.live = []; this.on = []; this.tracked = new Map(); this.follows = [];
  }
  // đầu mỗi bước mô phỏng, trước khi bước chạy
  capture(ctx) {
    this.tick++; this.live.length = 0;
    const h = ctx.hero;
    if (h?.rig) this.grab(h.rig.root, true);
    for (const u of ctx.units) { if (u.rig) this.grab(u.rig.root, true); if (u.prop) this.grab(u.prop, false); if (u.label) this.grab(u.label, false); }
    for (const [o, deep] of this.tracked) { if (o.parent) this.grab(o, deep); else this.tracked.delete(o); }
    ctx.crowd?.capture(this.tick);
    ctx.naval?.capture(this.tick);
  }
  grab(root, deep) {
    let s = this.snaps.get(root);
    if (!s) this.snaps.set(root, (s = new RigSnap()));
    else if (s.tick === this.tick) return;               // đã chụp ở bước này (đăng ký trùng)
    s.capture(root, deep, this.tick); this.live.push(s);
  }
  track(o, deep = false) { this.tracked.set(o, deep); }   // vật chạy theo bước mô phỏng ngoài tướng / đơn vị lớn (thuyền Kế Sách B15); gỡ khỏi cảnh thì tự bỏ
  follow(mesh, root) { this.follows.push({ mesh, root, x: 0, y: 0, z: 0, on: false }); }
  cut() { this.tick += 2; this.live.length = 0; }
  // sau vòng bước của khung: hệ số nội suy, giờ vẽ
  frame(alpha, clock) { this.alpha = alpha; this.lag = (1 - alpha) * STEP; this.clock = clock - this.lag; }
  // chỗ vẽ của vật o (tướng) vào out { x, y, z }: vị trí mô phỏng (o.x, o.y, o.z) lùi (1 − α) đoạn gốc rig đã đi trong bước cuối. Chưa có
  // ảnh chụp của bước này (khung đầu chạy 0 bước, sau cut()) hay α = 1 (tua bằng advance, hit-stop) thì đúng vị trí mô phỏng như trước đợt
  // 19c — không lấy gốc rig: gốc chỉ dời theo place() trong bước, tướng đặt chỗ khác sau khi dựng (Võ trường) / director dời tướng sau bước
  // (cảnh bắt sống B20) thì gốc còn ở chỗ cũ.
  pos(o, out) {
    const r = o.rig?.root, s = r && this.snaps.get(r);
    out.x = o.x; out.y = o.y; out.z = o.z;
    if (s && s.tick === this.tick && this.alpha < 1) {
      const p = r.position, x = p.x, y = p.y, z = p.z;
      s.rootAt(this.alpha, _o);
      out.x += _o.x - x; out.y += _o.y - y; out.z += _o.z - z;
    }
    return out;
  }
  begin() {
    if (this.on.length) this.end();                   // lượt trước chưa trả (không xảy ra): trả trước khi ghi lại
    const a = this.alpha;
    if (a >= 1) return;
    for (const s of this.live) if (s.tick === this.tick && s.apply(a)) this.on.push(s);
    for (const f of this.follows) {
      const s = this.snaps.get(f.root);
      if (!s || !s.on || s.root !== f.root) continue;
      const p = f.mesh.position, r = f.root.position, c = s.cur;          // gốc: hiện tại c[0..2], đang vẽ r
      f.x = p.x; f.y = p.y; f.z = p.z; f.on = true;
      p.x = f.x + (r.x - c[0]); p.y = f.y + (r.y - c[1]); p.z = f.z + (r.z - c[2]);
    }
  }
  end() {
    for (const f of this.follows) if (f.on) { const p = f.mesh.position; p.x = f.x; p.y = f.y; p.z = f.z; f.on = false; }
    if (!this.on.length) return;
    for (let i = this.on.length - 1; i >= 0; i--) this.on[i].restore();     // ngược thứ tự ghi: cây lồng nhau vẫn trả đúng
    for (const s of this.on) s.root.updateMatrixWorld(true);
    this.on.length = 0;
  }
}
