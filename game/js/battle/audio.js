// battle/audio.js — âm thanh tổng hợp bằng Web Audio (chưa có SFX thư viện; S3.14 thuê ngoài).
// Ba bus Nhạc / SFX gộp vào master (15.9). AudioContext mở ở lần chạm đầu tiên (luật autoplay).

export class Audio {
  constructor(volume = 0.7) {
    this.vol = volume; this.ctx = null; this.listener = { x: 0, z: 0 }; this.last = {};
  }
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.gain.value = this.vol; this.master.connect(this.ctx.destination);
      this.sfx = this.ctx.createGain(); this.sfx.connect(this.master);
      this.music = this.ctx.createGain(); this.music.gain.value = 0.5; this.music.connect(this.master);
      const len = this.ctx.sampleRate; this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state !== "running") this.ctx.resume();
  }
  setVolume(v) { this.vol = v; if (this.master) this.master.gain.value = v; }
  suspend() { this.ctx?.suspend(); }
  // Rời trận: đóng hẳn AudioContext (trình duyệt giới hạn số context; suspend thì mỗi trận rò một cái).
  // ctx = null để unlock() lần sau dựng context mới thay vì resume một context đã đóng.
  close() { const c = this.ctx; this.ctx = null; c?.close?.().catch?.(() => {}); }

  env(node, t, a, peak, dcy) {
    node.gain.setValueAtTime(0.0001, t); node.gain.exponentialRampToValueAtTime(peak, t + a); node.gain.exponentialRampToValueAtTime(0.0001, t + a + dcy);
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

  play(name, x = null, z = null) {
    if (!this.ctx || this.ctx.state !== "running") return;
    const now = this.ctx.currentTime;
    if (this.last[name] && now - this.last[name] < 0.03) return;   // chống dội khi nhiều lính cùng trúng
    this.last[name] = now;
    let k = 1;
    if (x !== null) { const d = Math.hypot(x - this.listener.x, z - this.listener.z); k = 1 / (1 + d / 18); if (k < 0.05) return; }
    const t = now, G = (v) => v * k;
    switch (name) {
      case "whoosh": this.noiseHit(t, { f: 700, sweep: 2600, q: 0.8, a: 0.02, d: 0.13, g: G(0.25) }); break;
      case "whooshHeavy": this.noiseHit(t, { f: 400, sweep: 1800, q: 0.7, a: 0.04, d: 0.22, g: G(0.35) }); break;
      case "hit": this.noiseHit(t, { f: 900, q: 1.2, d: 0.08, g: G(0.5) }); this.tone(t, { f: 140, to: 60, d: 0.1, g: G(0.3), type: "triangle" }); break;
      case "hitHeavy": this.noiseHit(t, { f: 600, q: 0.9, d: 0.16, g: G(0.7) }); this.tone(t, { f: 110, to: 40, d: 0.22, g: G(0.5), type: "triangle" }); break;
      case "block": this.tone(t, { f: 1250, d: 0.18, g: G(0.18), type: "square" }); this.noiseHit(t, { f: 3000, q: 3, d: 0.06, g: G(0.3) }); break;
      case "parry": for (const f of [1320, 1760, 2640]) this.tone(t, { f, d: 0.5, g: G(0.14), type: "sine" }); this.noiseHit(t, { f: 4000, q: 2, d: 0.1, g: G(0.4) }); break;
      case "hurt": this.noiseHit(t, { f: 500, q: 0.8, d: 0.1, g: G(0.35), type: "lowpass" }); break;
      case "hurtHeavy": this.noiseHit(t, { f: 300, q: 0.8, d: 0.25, g: G(0.6), type: "lowpass" }); this.tone(t, { f: 90, to: 45, d: 0.3, g: G(0.5) }); break;
      case "dodge": this.noiseHit(t, { f: 1500, sweep: 500, q: 0.6, a: 0.03, d: 0.18, g: G(0.18) }); break;
      case "bow": this.tone(t, { f: 320, to: 180, d: 0.08, g: G(0.1), type: "triangle" }); this.noiseHit(t, { f: 2500, q: 2, d: 0.12, g: G(0.08) }); break;
      case "warn": this.tone(t, { f: 880, d: 0.12, g: G(0.18), type: "square" }); this.tone(t + 0.14, { f: 880, d: 0.12, g: G(0.18), type: "square" }); break;
      case "horn": this.tone(t, { f: 98, to: 110, a: 0.2, d: 1.2, g: G(0.35), type: "sawtooth" }); this.tone(t, { f: 147, a: 0.2, d: 1.1, g: G(0.15), type: "sawtooth" }); break;
      case "drum": this.drum(t, G(1)); break;
      case "drums3": for (let i = 0; i < 9; i++) this.drum(t + i * 0.22 + (i >= 3 ? 0.35 : 0) + (i >= 6 ? 0.35 : 0), G(0.9)); break;
      case "ult": this.tone(t, { f: 220, to: 660, a: 0.05, d: 0.6, g: G(0.3), type: "sawtooth" }); this.drum(t, G(1)); break;
      case "capture": for (const [i, f] of [392, 523, 659].entries()) this.tone(t + i * 0.09, { f, d: 0.35, g: G(0.2), type: "triangle" }); break;
      case "pickup": this.tone(t, { f: 660, to: 990, d: 0.18, g: G(0.2), type: "triangle" }); break;
      case "gate": this.noiseHit(t, { f: 250, q: 1, d: 0.2, g: G(0.6), type: "lowpass" }); this.tone(t, { f: 70, to: 45, d: 0.25, g: G(0.5) }); break;
      case "gateBreak": this.noiseHit(t, { f: 180, q: 0.5, a: 0.02, d: 1.0, g: G(0.9), type: "lowpass" }); this.drum(t, G(1)); break;
      case "victory": for (const [i, f] of [262, 330, 392, 523].entries()) this.tone(t + i * 0.16, { f, d: 0.8, g: 0.2, type: "triangle" }); this.drum(t, 1); break;
      case "defeat": for (const [i, f] of [330, 262, 196].entries()) this.tone(t + i * 0.3, { f, d: 1, g: 0.2, type: "triangle" }); break;
      case "ui": this.tone(t, { f: 520, d: 0.06, g: 0.08, type: "triangle" }); break;
    }
  }
  drum(t, g) {
    this.tone(t, { f: 95, to: 48, a: 0.004, d: 0.4, g: 0.9 * g, type: "sine" });
    this.noiseHit(t, { f: 180, q: 0.7, d: 0.12, g: 0.4 * g, type: "lowpass" });
  }
}
