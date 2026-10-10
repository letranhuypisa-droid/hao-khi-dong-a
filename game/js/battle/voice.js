// battle/voice.js — lồng tiếng trong trận (đợt 16): tướng ra trận hô khi tung chiêu / Tuyệt Kỹ, tướng Mông-Nguyên lên tiếng khi giáp mặt.
//
// Giọng KHÔNG đi qua Audio.play(): play() lệch cao độ ±6% mỗi lần (hợp với tiếng binh khí, làm méo giọng người) và lấy ngẫu nhiên từ Math.random
// (giọng không được động vào dãy số ngẫu nhiên của mô phỏng). Giọng có bus riêng trong Audio (voiceBus, âm lượng "Giọng nói" ở cài đặt, không
// bị kéo theo thanh "hiệu ứng"), hạ nhạc và hiệu ứng (duck) khi đang nói, và phụ đề qua director.say (chữ + nhãn Chính sử / Hư cấu).
//
// Bộ nhớ: mỗi dòng ~2 s giải mã ra ~0,4 MB, nên chỉ nạp dòng của tướng đang chơi và tướng địch của chương này (preload), mỗi trận một bộ,
// bỏ cùng trận. Tệp nén (vài chục KB) giữ chung giữa các trận (BYTES). Thứ tự chọn dòng là vòng tròn, không ngẫu nhiên.
import { VOICE_BY_ID, VOICE_CAST, VOICE_LINES, voiceLinesFor } from "../data/voice.js";

const BYTES = {};                                                      // id → Promise<ArrayBuffer|null>, dùng chung các trận
const urlOf = (id) => `./assets/voice/${id}.m4a`;
const PRIO = { skill: 1, meet: 2, ult: 3 };                            // lời Tuyệt Kỹ không bị cắt; lời giáp mặt cắt lời chiêu thường
const SKILL_GAP = 3.2;                                                 // giây giữa hai lời chiêu thường (Phá Trận có thể tung ba lần liền)
const DUCK = { sfx: 0.5, music: 0.45 };
const LC = { "Chính sử": "cs", "Tương truyền": "tt", "Hư cấu": "hc" };

export class Voice {
  // audio: battle/audio.js Audio; music: core/music.js Music (hạ nhạc); say(text, giây, loại): phụ đề; volume 0..1 (0 = tắt hẳn, không phụ đề)
  constructor(audio, { music = null, say = null, volume = 0.9 } = {}) {
    this.audio = audio; this.music = music; this.sayFn = say;
    this.ready = new Map();                                           // id → AudioBuffer đã giải mã
    this.cur = null;                                                  // { id, prio, src, gain, left }
    this.gap = 0; this.met = new Set(); this.turn = {};
    this.setVolume(volume);
  }
  setVolume(v) { this.vol = v; this.audio?.setVoiceVolume?.(v); }
  get on() { return this.vol > 0.001; }

  // nạp trước: lời của tướng ra trận (heroId) và của tướng địch trong chương (chapter, vd "B15")
  preload(heroId, chapter) {
    const on = String(chapter || "").toLowerCase();
    return Promise.all(VOICE_LINES.filter((l) => l.who === heroId || l.on === on).map((l) => this.load(l.id)));
  }
  load(id) {
    const c = this.audio?.ctx;
    if (!c || !VOICE_BY_ID[id]) return Promise.resolve(null);
    if (this.ready.has(id)) return Promise.resolve(this.ready.get(id));
    BYTES[id] ||= fetch(urlOf(id)).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null);
    return BYTES[id].then((ab) => (ab ? new Promise((res, rej) => c.decodeAudioData(ab.slice(0), res, rej)) : null))
      .then((b) => { if (b) this.ready.set(id, b); return b; }).catch(() => null);
  }

  // Tướng ta tung chiêu: skillId theo heroes.js SKILLS ("phaTran", "bopNat"…). ult: Tuyệt Kỹ (không bị chặn bởi thời gian chờ).
  skill(heroId, skillId, ult = false) {
    if (!this.on || !this.running()) return false;
    const lines = voiceLinesFor(heroId, skillId);
    if (!lines.length || (!ult && this.gap > 0)) return false;
    const key = heroId + ":" + skillId, n = this.turn[key] = (this.turn[key] ?? -1) + 1;
    const ok = this.play(lines[n % lines.length].id, ult ? PRIO.ult : PRIO.skill);
    if (ok && !ult) this.gap = SKILL_GAP;
    return ok;
  }

  // Tướng địch giáp mặt: who = mã tướng (X19…), on = chương ("b15"…). Mỗi tướng chỉ nói một lần mỗi trận. u: BigUnit (đặt âm theo chỗ đứng).
  // Trả về true nếu giọng đã bắt đầu (để gọi nhỏ tiếng gầm thị uy đi).
  meet(who, on, u = null) {
    const key = who + ":" + on;
    if (!this.on || !this.running() || this.met.has(key)) return false;
    const lines = voiceLinesFor(who, on);
    if (!lines.length) return false;
    const ok = this.play(lines[Math.floor(performance.now()) % lines.length].id, PRIO.meet, u?.x ?? null, u?.z ?? null);
    if (ok) this.met.add(key);
    return ok;
  }

  running() { const c = this.audio?.ctx; return !!c && c.state === "running"; }

  play(id, prio, x = null, z = null) {
    const a = this.audio, c = a.ctx, b = this.ready.get(id);
    if (!b || !this.running()) return false;                          // chưa giải mã xong thì thôi, không chờ (lời nói trễ là lời nói lạc)
    if (this.cur) { if (this.cur.prio >= prio) return false; this.stop(0.12); }
    const src = c.createBufferSource(); src.buffer = b;
    const gain = c.createGain(); gain.gain.value = 1;
    let node = src.connect(gain);
    if (x !== null) {                                                 // giọng tướng địch theo chỗ đứng: nhỏ dần chậm hơn tiếng binh khí, lệch trái / phải
      const L = a.listener, dx = x - L.x, dz = z - L.z, d = Math.hypot(dx, dz);
      gain.gain.value = Math.max(0.45, 1 / (1 + d / 45));
      if (d > 1.5 && c.createStereoPanner) {
        const p = c.createStereoPanner(); p.pan.value = Math.max(-0.7, Math.min(0.7, (dx * -Math.cos(L.yaw) + dz * Math.sin(L.yaw)) / d * Math.min(1, d / 6)));
        node = node.connect(p);
      }
    }
    node.connect(a.voiceBus || a.master);
    src.start();
    this.cur = { id, prio, src, gain, left: b.duration + 0.2 };
    a.duck?.(DUCK.sfx, 0.05); this.music?.duck?.(DUCK.music, 0.15);
    this.subtitle(id, b.duration);
    return true;
  }

  // Cắt lời đang nói (nhỏ dần fade giây rồi dừng)
  stop(fade = 0.1) {
    const k = this.cur; if (!k) return; this.cur = null;
    const c = this.audio?.ctx;
    try { const t = c.currentTime; k.gain.gain.setValueAtTime(k.gain.gain.value, t); k.gain.gain.linearRampToValueAtTime(0, t + fade); k.src.stop(t + fade + 0.02); } catch (_) { /* đã dừng */ }
    this.release();
  }
  release() { this.audio?.duck?.(1, 0.3); this.music?.duck?.(1, 0.5); }

  // Phụ đề: tướng ta nguyên văn; tướng địch ghi rõ tiếng Trung và hiện bản dịch tiếng Việt (lời ta viết nên nhãn Hư cấu)
  subtitle(id, dur) {
    const L = VOICE_BY_ID[id], who = VOICE_CAST[L.who];
    const tag = `<span class="label ${LC[L.label]}">${L.label}</span>`;
    const name = L.zh ? `${who.name} <small>(tiếng Trung)</small>` : who.name;
    this.sayFn?.(`${tag}${name}: “${L.text}”`, Math.max(3.2, dur + 1.6), L.zh ? "bad" : "info");
  }

  // mỗi bước mô phỏng (battle.js / arena.js): hết lời thì thả nhạc và hiệu ứng ra
  update(dt) {
    if (this.gap > 0) this.gap -= dt;
    const k = this.cur;
    if (k && (k.left -= dt) <= 0) { this.cur = null; this.release(); }
  }
  dispose() { this.cur = null; this.ready.clear(); this.release(); }
}
