// debug.js — công cụ kiểm thử trận bằng script. Chỉ nạp khi URL có ?debug.
//   __start(opts)        vào trận từ Doanh trại
//   __hk.advance(s, bot) tua s giây logic trận (không cần requestAnimationFrame)
//   __bot(target)        bot đơn giản: đi tới mục tiêu, gặp địch thì chém
//   __state()            ảnh chụp gọn trạng thái trận

window.__start = () => document.querySelector("[data-go]")?.click();

window.__bot = (getTarget, opts = {}) => {
  let t = 0;
  return (c) => {
    t += 1 / 30;
    const h = c.hero, inp = c.input;
    const tg = typeof getTarget === "function" ? getTarget(c) : getTarget;
    const cy = c.cam.yaw, fx = Math.sin(cy), fz = Math.cos(cy);
    const steer = (dx, dz) => { const L = Math.hypot(dx, dz) || 1; inp.setStick((dx / L) * -fz + (dz / L) * fx, (dx / L) * fx + (dz / L) * fz); };
    if (opts.ult && h.ki >= 100 && h.nearestEnemy(5)) inp.pressed.ult = true;
    if (opts.skill && h.phaTran.cd <= 0 && h.nearestEnemy(10)) inp.pressed.skill = true;
    if (opts.tpc && c.hk.value >= 100) inp.pressed.tpc = true;
    // phản đòn đòn viền đỏ (bấm Đỡ ~0,08 s trước lúc bổ), né Tuyệt Kỹ của boss
    for (const u of c.units) {
      if (u.side !== "dich" || !u.alive || u.dead) continue;
      const du = Math.hypot(u.x - h.x, u.z - h.z);
      if (opts.parry && u.state === "red" && du < 4.2 && !u._parried && u.st >= 0.6 - 0.1) { inp.pressed.block = true; u._parried = true; }
      if (u.state !== "red") u._parried = false;
      if (opts.parry && u.state === "ult" && du < 8 && u.st < 0.9) {
        const L = du || 1; inp.setStick(((h.x - u.x) / L) * -fz + ((h.z - u.z) / L) * fx, ((h.x - u.x) / L) * fx + ((h.z - u.z) / L) * fz);
        if (u.st > 0.6 && !u._dodged) { inp.pressed.dodge = true; u._dodged = true; }
        return;
      }
      if (u.state !== "ult") u._dodged = false;
    }
    const e = h.nearestEnemy(opts.reach ?? 3.6);
    if (e) {
      inp.setStick(0, 0);
      if (Math.floor(t * 30) % 4 === 0) inp.pressed[Math.floor(t * 3) % 5 === 4 ? "c" : "n"] = true;
      return;
    }
    const dx = tg.x - h.x, dz = tg.z - h.z, L = Math.hypot(dx, dz);
    if (tg.gate && L < 4) {       // đứng trước cổng: chém cổng
      inp.setStick(0, 0); h.yaw = Math.atan2(dx + 2.5, dz);
      if (Math.floor(t * 30) % 4 === 0) inp.pressed[Math.floor(t * 3) % 3 === 2 ? "c" : "n"] = true;
      return;
    }
    const e2 = h.nearestEnemy(12);
    if (e2 && L < (opts.engage ?? 30)) { steer(e2.x - h.x, e2.z - h.z); return; }
    if (L > 1.2) steer(dx, dz); else inp.setStick(0, 0);
  };
};

// Mục tiêu theo pha: P1 A1 → P2 A2 → P3 cổng bắc → P4 Toa Đô.
window.__objective = (c) => {
  const d = c.director, w = c.world.bases;
  if (d.phase === 0) return w.A1;
  if (d.phase === 1) return w.A2;
  if (d.phase === 2) return { x: w.A3.x - 2.5, z: w.A3.z, gate: true };
  return d.boss && d.boss.alive ? d.boss : { x: 528, z: -40 };
};

window.__state = () => {
  const c = window.__hk, d = c.director, s = c.sim;
  const q = (f, side) => Math.round(Object.values(s.fronts[f].q[side]).reduce((a, b) => a + b, 0));
  const B = (id) => ({ o: s.bases[id].owner, G: +s.bases[id].G.toFixed(1), k: s.bases[id].keeperAlive, cap: +(d.capT[id] || 0).toFixed(1), gate: s.bases[id].gate });
  return {
    t: Math.round(d.time), phase: d.phase, ko: d.ko, hp: Math.round(c.hero.hp), ki: Math.round(c.hero.ki), rev: c.hero.revives,
    hk: +c.hk.value.toFixed(1), tpc: c.hk.tpc, pos: [Math.round(c.hero.x), Math.round(c.hero.z)], st: c.hero.state,
    A1: B("A1"), A2: B("A2"), B1: B("B1"), B2: B("B2"), A3: B("A3"), B3: B("B3"),
    lines: [+s.fronts.A.x.toFixed(3), +s.fronts.B.x.toFixed(3)], qA: [q("A", "ta"), q("A", "dich")], qB: [q("B", "ta"), q("B", "dich")],
    sk: [Math.round(s.fronts.A.sk.ta), Math.round(s.fronts.A.sk.dich), Math.round(s.fronts.B.sk.ta), Math.round(s.fronts.B.sk.dich)],
    roles: c.crowd.agents.reduce((m, a) => ((m[a.role + ":" + a.side] = (m[a.role + ":" + a.side] || 0) + 1), m), {}),
    units: c.units.map((u) => `${u.name}:${Math.round(u.hp)}${u.broken > 0 ? "(vỡ)" : ""}`),
    events: Object.fromEntries(Object.entries(d.events).map(([k, v]) => [k, v.state + (v.left ? ":" + Math.round(v.left) : "")])),
    msgs: d.msgs.map((m) => m.text).slice(-3), over: d.over, res: d.result && d.result.why,
    ks: d.keSach.hud().map((k) => `${k.name}:${k.state}:${k.got}${k.detail ? " (" + k.detail + ")" : ""}`),
  };
};
