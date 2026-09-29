// core/music.js — nhạc nền stream bằng phần tử <audio>, không giải mã cả bài vào bộ nhớ (15.9).
// Hai phần tử luân phiên để chuyển bài có crossfade. Trình duyệt chỉ cho phát sau thao tác đầu
// tiên của người chơi, nên play() lỗi thì ghi nhớ bài muốn phát và thử lại ở lần chạm kế.

const TRACKS = {
  hub: "./assets/music/hub.m4a",
  battle: "./assets/music/battle.m4a",
  boss: "./assets/music/boss.m4a",
  victory: "./assets/music/victory.m4a",
};

export class Music {
  constructor(volume = 0.5) {
    this.volume = volume; this.cur = null; this.name = null; this.want = null; this.fades = new Set();
    const retry = () => { if (this.want && (!this.cur || this.cur.paused)) this.play(this.want.name, this.want.opts); };
    window.addEventListener("pointerdown", retry); window.addEventListener("keydown", retry);
  }

  play(name, opts = {}) {
    const { loop = true, fade = 1.5 } = opts;
    if (this.name === name && this.cur && !this.cur.paused) return;
    this.want = { name, opts };
    const src = TRACKS[name]; if (!src) return;
    const el = new Audio(src); el.loop = loop; el.volume = 0; el.preload = "auto";
    const p = el.play();
    if (p?.catch) p.catch(() => { /* chưa có thao tác người dùng: retry() lo */ });
    const old = this.cur;
    this.cur = el; this.name = name;
    this.fadeTo(el, this.volume, fade);
    if (old) this.fadeTo(old, 0, fade, () => { old.pause(); old.src = ""; });
    if (!loop) el.onended = () => { if (this.cur === el) { this.name = null; opts.then && this.play(opts.then); } };
  }

  stop(fade = 1.2) {
    this.want = null;
    const old = this.cur; this.cur = null; this.name = null;
    if (old) this.fadeTo(old, 0, fade, () => { old.pause(); old.src = ""; });
  }

  setVolume(v) { this.volume = v; if (this.cur) this.cur.volume = v; }
  pause() { this.cur?.pause(); }
  resume() { if (this.cur && this.cur.paused) this.cur.play().catch(() => {}); }

  fadeTo(el, target, sec, done) {
    const start = el.volume, t0 = performance.now();
    const step = () => {
      const u = Math.min(1, (performance.now() - t0) / (sec * 1000));
      el.volume = Math.max(0, Math.min(1, start + (target - start) * u));
      if (u < 1) setTimeout(step, 50); else done?.();
    };
    step();
  }
}
