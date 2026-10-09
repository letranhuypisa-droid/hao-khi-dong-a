// core/music.js — nhạc nền stream bằng phần tử <audio>, không giải mã cả bài vào bộ nhớ (15.9).
// Hai phần tử luân phiên để chuyển bài có crossfade. Trình duyệt chỉ cho phát sau thao tác đầu
// tiên của người chơi, nên play() lỗi thì giữ phần tử đó chờ (pending) và thử lại ĐÚNG phần tử ấy ở lần chạm kế.
// battle.js gọi play() MỖI KHUNG (đợt 19c): đang chờ thì play() cùng bài không làm gì — trước đây khung nào cũng dựng
// <audio> mới, tải lại cả bài và thêm hai chuỗi hẹn giờ fade tới lần chạm kế. Chạm màn cảm ứng: pointerdown chưa là
// "user activation" (chỉ pointerup / touchend / click / phím / pointerdown của chuột) nên thử lại ở cả các sự kiện đó.
// pause() giữ bài: lần chạm sau không tự phát lại — resume() lo.

const TRACKS = {
  hub: "./assets/music/hub.m4a",
  battle: "./assets/music/battle.m4a",
  boss: "./assets/music/boss.m4a",
  victory: "./assets/music/victory.m4a",
};

export class Music {
  constructor(volume = 0.5) {
    this.volume = volume; this.cur = null; this.name = null; this.want = null; this.fades = new Set();
    this.pending = null; this.held = false; this.fade = 1.5;
    const retry = () => {
      const el = this.pending;
      if (!el || el !== this.cur || this.held) return;
      this.pending = null; el.volume = 0; this.start(el); this.fadeTo(el, this.volume, this.fade);
    };
    for (const ev of ["pointerdown", "pointerup", "touchend", "click", "keydown"]) window.addEventListener(ev, retry);
  }

  play(name, opts = {}) {
    const { loop = true, fade = 1.5 } = opts;
    if (this.name === name && this.cur && (!this.cur.paused || this.pending === this.cur || this.held)) return;
    this.want = { name, opts };
    const src = TRACKS[name]; if (!src) return;
    const el = new Audio(src); el.loop = loop; el.volume = 0; el.preload = "auto";
    const old = this.cur;
    this.cur = el; this.name = name; this.pending = null; this.held = false; this.fade = fade;
    this.start(el);
    this.fadeTo(el, this.volume, fade);
    if (old) this.fadeTo(old, 0, fade, () => { old.pause(); old.src = ""; });
    if (!loop) el.onended = () => { if (this.cur === el) { this.name = null; opts.then && this.play(opts.then); } };
  }

  // phát; bị từ chối (chưa có thao tác người dùng) thì giữ phần tử chờ lần chạm kế (retry ở constructor)
  start(el) {
    const p = el.play();
    if (p?.catch) p.catch(() => { if (this.cur === el) this.pending = el; });
  }

  stop(fade = 1.2) {
    this.want = null; this.pending = null; this.held = false;
    const old = this.cur; this.cur = null; this.name = null;
    if (old) this.fadeTo(old, 0, fade, () => { old.pause(); old.src = ""; });
  }

  setVolume(v) { this.volume = v; if (this.cur) this.cur.volume = v; }
  pause() { this.held = true; this.cur?.pause(); }
  resume() { this.held = false; if (this.cur && this.cur.paused) { this.pending = null; this.start(this.cur); } }

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
