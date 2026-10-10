// battle/audio.js — âm thanh trận: mẫu SFX sinh bằng Higgsfield (assets/sfx, xem assets/SOURCES.md) + âm tổng hợp
// Web Audio làm dự phòng khi mẫu chưa nạp xong hoặc không nạp được.
//
// Đồ thị: nguồn → (panner trái/phải theo camera) → bus SFX ─┬─→ bộ nén → master → loa
//                                                          └─→ vang (convolver, gửi ít) ─┘
// Bus Nhạc riêng (15.9). AudioContext mở ở lần chạm đầu tiên (luật autoplay). Mỗi sự kiện (play("hit")) là một
// "công thức": một hoặc vài lớp mẫu, mỗi lần chọn ngẫu nhiên một biến thể và lệch cao độ ±6% cho khỏi lặp tai.

// Mẫu có trong assets/sfx (tên → số biến thể; 1 = file không hậu tố). Hậu kỳ: tools/post-assets-2.py.
export const SFX_FILES = {
  swing: 3, swingheavy: 2, slice: 3, clang: 3, hitheavy: 3, fall: 2, grunt: 2, kiai: 2, bow: 2,
  parry: 1, finisher: 1, slam: 1, dash: 1, roll: 1, arrowhit: 1, volley: 1, crossbow: 1, horn: 1, drum: 1,
  drumroll: 1, gong: 1, gatehit: 1, gatebreak: 1, cheer: 1, roar: 1, charge: 1, pickup: 1, ui: 1, warn: 1, ultstart: 1,
  // đợt 16 (ai33 / ElevenLabs sound-effect, design/audio/sfx.json): lửa, cờ, sông nước, thuyền, quân reo, chim muông, hiệu thua
  ignite: 1, flag: 1, oar: 2, hullcreak: 1, splash: 1, stakecrash: 1, chain: 1, grapple: 1, warcry: 1, crow: 1,
  buffalo: 1, stingloss: 1, bowheavy: 1, wave: 1,
};
const LOOPS = { ambience: "ambience.m4a", fire: "fire.m4a", river: "river.m4a" };
const EXT = { drumroll: "m4a", horn: "m4a", cheer: "m4a", volley: "m4a", gong: "m4a", gatebreak: "m4a", warcry: "m4a", stingloss: "m4a", wave: "m4a" };   // mẫu dài (> 2,5 s) mã hoá AAC, còn lại WAV

// công thức: [mẫu, âm lượng, xác suất (mặc định 1)]; synth: tiếng tổng hợp cộng thêm (lực cú đánh) hoặc dự phòng
const RECIPES = {
  whoosh: [["swing", 0.5]], whooshHeavy: [["swingheavy", 0.65]],
  hit: [["slice", 0.75]], hitHeavy: [["hitheavy", 0.85], ["slice", 0.35]], crit: [["finisher", 0.55]],
  hitSoft: [["slice", 0.22]], swingSoft: [["swing", 0.16]], swingHeavy: [["swingheavy", 0.3]],
  block: [["clang", 0.55]], parry: [["parry", 0.9]],
  hurt: [["slice", 0.45], ["grunt", 0.5, 0.6]], hurtHeavy: [["hitheavy", 0.8], ["grunt", 0.6]],
  dodge: [["roll", 0.55]], bow: [["bow", 0.32]], crossbow: [["crossbow", 0.38]], arrowHit: [["arrowhit", 0.45]], volley: [["volley", 0.5]],
  warn: [["warn", 0.55]], horn: [["horn", 0.55]], roar: [["roar", 0.7]], drum: [["drum", 0.85]], drums3: [["drumroll", 0.8]],
  ult: [["ultstart", 0.95], ["kiai", 0.7]], capture: [["gong", 0.55], ["cheer", 0.45]], cheer: [["cheer", 0.55]],
  pickup: [["pickup", 0.5]], gate: [["gatehit", 0.85]], gateBreak: [["gatebreak", 1]], ui: [["ui", 0.35]],
  kiai: [["kiai", 0.55]], grunt: [["grunt", 0.4]], fall: [["fall", 0.4]], finisher: [["finisher", 1]], slam: [["slam", 0.85]],
  dash: [["dash", 0.7]], charge: [["charge", 0.65]], kill: [["grunt", 0.32, 0.35], ["fall", 0.3, 0.6]],
  // đợt 16: "fire" và "gong" trước đây được gọi mà không có công thức (câm)
  fire: [["ignite", 0.7]], gong: [["gong", 0.6]], flag: [["flag", 0.75]], oar: [["oar", 0.5]], hullCreak: [["hullcreak", 0.55]], splash: [["splash", 0.6]],
  stakeCrash: [["stakecrash", 0.9]], chain: [["chain", 0.7]], grapple: [["grapple", 0.7]],
  warcry: [["warcry", 0.6]], crow: [["crow", 0.4]], buffalo: [["buffalo", 0.45]], bowHeavy: [["bowheavy", 0.8]], wave: [["wave", 0.85]],
  defeat: [["stingloss", 0.8]],      // thua: nhạc tắt, chỉ còn hồi trầm này (thắng giữ âm tổng hợp ngắn, nhạc victory.m4a lo phần còn lại)
};
// trần số tiếng cùng lúc của một công thức (lính chém lính cả chục người không được nuốt tiếng tướng)
const CAP = { hitSoft: 4, swingSoft: 3, block: 4, bow: 4, fall: 3, kill: 3, grunt: 2, hit: 6, whoosh: 3 };

// Bộ đệm giải mã dùng chung mọi trận (AudioBuffer không gắn với một AudioContext).
const BUF = {};
function loadBuf(ctx, file) {
  if (!BUF[file]) BUF[file] = fetch(`./assets/sfx/${file}`).then((r) => { if (!r.ok) throw new Error(file); return r.arrayBuffer(); })
    .then((ab) => new Promise((res, rej) => ctx.decodeAudioData(ab, res, rej))).then((b) => (BUF[file].buf = b, b)).catch(() => null);
  return BUF[file];
}
const fileOf = (name, v) => `${name}${SFX_FILES[name] > 1 ? "-" + v : ""}.${EXT[name] || "wav"}`;

export class Audio {
  constructor(volume = 0.7) {
    this.vol = volume; this.ctx = null; this.listener = { x: 0, z: 0, yaw: 0 }; this.last = {}; this.active = {};
    this.amb = null;
  }
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      const c = this.ctx = new AC();
      this.master = c.createGain(); this.master.gain.value = this.vol;
      // bộ nén: nhiều nhát chém trúng cùng lúc không vỡ tiếng, tiếng nhỏ được đẩy lên cho chắc
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.18;
      this.master.connect(comp).connect(c.destination);
      this.sfx = c.createGain(); this.sfx.connect(this.master);
      this.music = c.createGain(); this.music.gain.value = 0.5; this.music.connect(this.master);
      // vang ngắn (xung đáp dựng bằng nhiễu tắt dần): bãi sông rộng, gửi rất ít
      this.verb = c.createConvolver(); this.verb.buffer = this.impulse(1.4);
      this.verbSend = c.createGain(); this.verbSend.gain.value = 0.16;
      this.sfx.connect(this.verbSend).connect(this.verb).connect(this.master);
      const len = c.sampleRate; this.noise = c.createBuffer(1, len, c.sampleRate);
      const d = this.noise.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.preload();
    }
    if (this.ctx.state !== "running") this.ctx.resume();
  }
  preload() {
    for (const n in SFX_FILES) for (let v = 1; v <= SFX_FILES[n]; v++) loadBuf(this.ctx, fileOf(n, v));
    for (const k in LOOPS) loadBuf(this.ctx, LOOPS[k]);
  }
  impulse(T) {
    const c = this.ctx, n = Math.floor(c.sampleRate * T), b = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.2); }
    return b;
  }
  setVolume(v) { this.vol = v; if (this.master) this.master.gain.value = v; }
  suspend() { this.ctx?.suspend(); }
  // Rời trận: đóng hẳn AudioContext (trình duyệt giới hạn số context; suspend thì mỗi trận rò một cái).
  // ctx = null để unlock() lần sau dựng context mới thay vì resume một context đã đóng.
  close() { const c = this.ctx; this.ctx = null; this.amb = null; c?.close?.().catch?.(() => {}); }

  // ---- nền: tiếng giao chiến xa, lửa trại cháy -------------------------------------------------------
  // k 0..1: độ dữ dội quanh tướng (số lính đang đánh nhau gần, khoảng cách tới tuyến); fire 0..1: có đám cháy gần; river 0..1: gần mặt sông
  // (đợt 16: sóng vỗ thuyền, battle.js tính từ ground.waterDist; vòng này nạp riêng nên thiếu tệp thì nền cũ vẫn chạy).
  setBed(k, fire = 0, river = 0) {
    const c = this.ctx; if (!c || c.state !== "running") return;
    const loop = (key) => {
      const b = BUF[LOOPS[key]].buf;
      const s = c.createBufferSource(); s.buffer = b; s.loop = true;
      const g = c.createGain(); g.gain.value = 0; s.connect(g).connect(this.sfx); s.start(0, Math.random() * b.duration);
      return g;
    };
    if (!this.amb) {
      if (!BUF[LOOPS.ambience]?.buf || !BUF[LOOPS.fire]?.buf) return;      // chờ nạp đủ cả hai rồi mới dựng (không dựng dở)
      this.amb = { ambience: loop("ambience"), fire: loop("fire") };
    }
    if (!this.amb.river && BUF[LOOPS.river]?.buf) this.amb.river = loop("river");
    const t = c.currentTime;
    this.amb.ambience.gain.setTargetAtTime(0.1 + 0.32 * k, t, 0.8);
    this.amb.fire.gain.setTargetAtTime(0.35 * fire, t, 1.2);
    this.amb.river?.gain.setTargetAtTime(0.4 * river, t, 1.5);
  }

  // ---- phát ------------------------------------------------------------------------------------------
  // x, z: vị trí nguồn (null = không định vị: tiếng HUD, tiếng của chính tướng khi không truyền). opt.gain: nhân
  // thêm âm lượng; opt.rate: nhân cao độ.
  play(name, x = null, z = null, opt = null) {
    const c = this.ctx;
    if (!c || c.state !== "running") return;
    const now = c.currentTime;
    if (this.last[name] && now - this.last[name] < 0.03) return;   // chống dội khi nhiều lính cùng trúng
    this.last[name] = now;
    let k = 1, pan = 0;
    if (x !== null) {
      const L = this.listener, dx = x - L.x, dz = z - L.z, d = Math.hypot(dx, dz);
      k = 1 / (1 + d / 18); if (k < 0.05) return;
      // phải của camera = (−cos yaw, sin yaw)·… — theo tích có hướng hướng nhìn × trục đứng
      if (d > 1.5) pan = Math.max(-0.85, Math.min(0.85, (dx * -Math.cos(L.yaw) + dz * Math.sin(L.yaw)) / d * Math.min(1, d / 6)));
    }
    if (opt?.gain) k *= opt.gain;
    const R = RECIPES[name];
    if (R && (this.active[name] || 0) >= (CAP[name] || 8)) return;   // đủ tiếng cùng loại đang kêu: bỏ, không rơi xuống âm tổng hợp
    let played = false;
    if (R) {
      for (const [s, g, p = 1] of R) {
        if (p < 1 && Math.random() > p) continue;
        const v = 1 + Math.floor(Math.random() * SFX_FILES[s]);
        const b = BUF[fileOf(s, v)]?.buf;
        if (!b) continue;
        this.sample(name, b, g * k, pan, (opt?.rate || 1) * (0.94 + Math.random() * 0.12));
        played = true;
      }
    }
    if (!played) this.synth(name, now, (v) => v * k);
    // lực cú đánh: lớp trầm tổng hợp chồng lên mẫu cho chắc tay (mẫu sinh bằng máy đôi khi mềm ở đầu tiếng)
    if (played && (name === "hit" || name === "hitHeavy" || name === "crit" || name === "finisher")) {
      const big = name !== "hit";
      this.tone(now, { f: big ? 120 : 160, to: big ? 38 : 55, a: 0.002, d: big ? 0.26 : 0.12, g: (big ? 0.6 : 0.38) * k, type: "sine" });
      this.noiseHit(now, { f: 2600, q: 0.8, a: 0.001, d: 0.03, g: 0.22 * k });
    }
  }
  sample(name, buf, gain, pan, rate) {
    const c = this.ctx, s = c.createBufferSource(); s.buffer = buf; s.playbackRate.value = rate;
    const g = c.createGain(); g.gain.value = gain;
    let node = s.connect(g);
    if (pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; node = node.connect(p); }
    node.connect(this.sfx);
    this.active[name] = (this.active[name] || 0) + 1;
    s.onended = () => { this.active[name]--; };
    s.start();
  }

  env(node, t, a, peak, dcy) {
    node.gain.setValueAtTime(0.0001, t); node.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a); node.gain.exponentialRampToValueAtTime(0.0001, t + a + dcy);
  }
  noiseHit(t, { f = 1200, q = 1, a = 0.005, d = 0.12, g = 0.5, sweep = null, type = "bandpass", dest }) {
    const c = this.ctx, s = c.createBufferSource(); s.buffer = this.noise;
    const bp = c.createBiquadFilter(); bp.type = type; bp.frequency.setValueAtTime(f, t); bp.Q.value = q;
    if (sweep) bp.frequency.exponentialRampToValueAtTime(sweep, t + a + d);
    const gn = c.createGain(); this.env(gn, t, a, g, d);
    s.connect(bp).connect(gn).connect(dest || this.sfx); s.start(t, Math.random() * 0.5); s.stop(t + a + d + 0.05);
  }
  tone(t, { f = 220, type = "sine", a = 0.005, d = 0.3, g = 0.3, to = null, dest }) {
    const c = this.ctx, o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + a + d);
    const gn = c.createGain(); this.env(gn, t, a, g, d);
    o.connect(gn).connect(dest || this.sfx); o.start(t); o.stop(t + a + d + 0.05);
  }

  // Âm tổng hợp: dự phòng khi mẫu chưa có, và các tiếng không cần mẫu (thắng, thua).
  synth(name, t, G) {
    switch (name) {
      case "whoosh": case "swingSoft": this.noiseHit(t, { f: 700, sweep: 2600, q: 0.8, a: 0.02, d: 0.13, g: G(name === "whoosh" ? 0.25 : 0.08) }); break;
      case "whooshHeavy": case "swingHeavy": case "dash": this.noiseHit(t, { f: 400, sweep: 1800, q: 0.7, a: 0.04, d: 0.22, g: G(0.35) }); break;
      case "hit": case "hitSoft": this.noiseHit(t, { f: 900, q: 1.2, d: 0.08, g: G(name === "hit" ? 0.5 : 0.15) }); this.tone(t, { f: 140, to: 60, d: 0.1, g: G(name === "hit" ? 0.3 : 0.1), type: "triangle" }); break;
      case "hitHeavy": case "crit": case "finisher": case "slam": this.noiseHit(t, { f: 600, q: 0.9, d: 0.16, g: G(0.7) }); this.tone(t, { f: 110, to: 40, d: 0.22, g: G(0.5), type: "triangle" }); break;
      case "block": this.tone(t, { f: 1250, d: 0.18, g: G(0.18), type: "square" }); this.noiseHit(t, { f: 3000, q: 3, d: 0.06, g: G(0.3) }); break;
      case "parry": for (const f of [1320, 1760, 2640]) this.tone(t, { f, d: 0.5, g: G(0.14), type: "sine" }); this.noiseHit(t, { f: 4000, q: 2, d: 0.1, g: G(0.4) }); break;
      case "hurt": this.noiseHit(t, { f: 500, q: 0.8, d: 0.1, g: G(0.35), type: "lowpass" }); break;
      case "hurtHeavy": case "charge": this.noiseHit(t, { f: 300, q: 0.8, d: 0.25, g: G(0.6), type: "lowpass" }); this.tone(t, { f: 90, to: 45, d: 0.3, g: G(0.5) }); break;
      case "dodge": this.noiseHit(t, { f: 1500, sweep: 500, q: 0.6, a: 0.03, d: 0.18, g: G(0.18) }); break;
      case "bow": case "crossbow": this.tone(t, { f: 320, to: 180, d: 0.08, g: G(0.1), type: "triangle" }); this.noiseHit(t, { f: 2500, q: 2, d: 0.12, g: G(0.08) }); break;
      case "arrowHit": this.noiseHit(t, { f: 1800, q: 1.5, d: 0.05, g: G(0.2) }); break;
      case "warn": this.tone(t, { f: 880, d: 0.12, g: G(0.18), type: "square" }); this.tone(t + 0.14, { f: 880, d: 0.12, g: G(0.18), type: "square" }); break;
      case "horn": case "roar": this.tone(t, { f: 98, to: 110, a: 0.2, d: 1.2, g: G(0.35), type: "sawtooth" }); this.tone(t, { f: 147, a: 0.2, d: 1.1, g: G(0.15), type: "sawtooth" }); break;
      case "drum": this.drum(t, G(1)); break;
      case "drums3": for (let i = 0; i < 9; i++) this.drum(t + i * 0.22 + (i >= 3 ? 0.35 : 0) + (i >= 6 ? 0.35 : 0), G(0.9)); break;
      case "ult": this.tone(t, { f: 220, to: 660, a: 0.05, d: 0.6, g: G(0.3), type: "sawtooth" }); this.drum(t, G(1)); break;
      case "capture": case "cheer": for (const [i, f] of [392, 523, 659].entries()) this.tone(t + i * 0.09, { f, d: 0.35, g: G(0.2), type: "triangle" }); break;
      case "pickup": this.tone(t, { f: 660, to: 990, d: 0.18, g: G(0.2), type: "triangle" }); break;
      case "gate": this.noiseHit(t, { f: 250, q: 1, d: 0.2, g: G(0.6), type: "lowpass" }); this.tone(t, { f: 70, to: 45, d: 0.25, g: G(0.5) }); break;
      case "gateBreak": this.noiseHit(t, { f: 180, q: 0.5, a: 0.02, d: 1.0, g: G(0.9), type: "lowpass" }); this.drum(t, G(1)); break;
      case "victory": for (const [i, f] of [262, 330, 392, 523].entries()) this.tone(t + i * 0.16, { f, d: 0.8, g: 0.2, type: "triangle" }); this.drum(t, 1); break;
      case "defeat": for (const [i, f] of [330, 262, 196].entries()) this.tone(t + i * 0.3, { f, d: 1, g: 0.2, type: "triangle" }); break;
      case "ui": this.tone(t, { f: 520, d: 0.06, g: 0.08, type: "triangle" }); break;
      case "fall": case "kill": this.noiseHit(t, { f: 220, q: 0.7, d: 0.14, g: G(0.25), type: "lowpass" }); break;
    }
  }
  drum(t, g) {
    this.tone(t, { f: 95, to: 48, a: 0.004, d: 0.4, g: 0.9 * g, type: "sine" });
    this.noiseHit(t, { f: 180, q: 0.7, d: 0.12, g: 0.4 * g, type: "lowpass" });
  }
}
