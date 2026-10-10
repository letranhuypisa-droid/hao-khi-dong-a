# Hậu kỳ đợt 16: SFX mới và lồng tiếng sinh bằng design/tools/ai33-audio.mjs (ai33 / ElevenLabs).
#   python tools/post-audio-3.py <thư-mục-_raw/audio>        (có sfx/*.mp3 và voice/*.mp3)
# Cần ffmpeg trên PATH và numpy. Ghi vào assets/sfx/*.wav|m4a và assets/voice/*.m4a.
#
# SFX: cắt khoảng lặng đầu (ngưỡng thr dB dưới đỉnh), cắt đuôi lặng, tắt dần, chuẩn hoá đỉnh −1 dBFS, mono 32 kHz — giống post-assets-2.py:
# mẫu ngắn (≤ 2,5 s) ghi WAV 16-bit (không có khoảng đệm đầu như AAC), mẫu dài mã AAC 96 kbps .m4a. `river` là vòng lặp nền: nối đuôi vào đầu 1 s.
# Giọng: cắt lặng hai đầu, đưa mọi dòng về cùng độ to (RMS phần có tiếng −20 dBFS, đỉnh tối đa −1 dBFS), mono 32 kHz AAC 64 kbps .m4a.
import os, subprocess, sys, wave
import numpy as np

SRC = sys.argv[1]
HERE = os.path.dirname(os.path.abspath(__file__))
OUT_S = os.path.join(HERE, "..", "assets", "sfx")
OUT_V = os.path.join(HERE, "..", "assets", "voice")
SR = 32000
LONG = 2.5

# tên ra: (ngưỡng dB dưới đỉnh để cắt hai đầu, tắt dần s, dài tối đa s). Tiếng có đuôi dài và nhỏ (đòn xoáy nước, kèn thắng trận) dùng ngưỡng thấp để giữ đuôi.
SFX = {
    "ignite": (-40, 0.4, 2.2), "flag": (-40, 0.3, 1.5), "oar-1": (-40, 0.3, 1.5), "oar-2": (-40, 0.3, 1.5),
    "hullcreak": (-40, 0.5, 2.5), "splash": (-40, 0.3, 1.5), "stakecrash": (-40, 0.4, 2.0), "chain": (-40, 0.4, 2.0),
    "grapple": (-40, 0.15, 1.2), "warcry": (-40, 0.6, 3.0),
    "crow": (-40, 0.3, 1.8), "buffalo": (-40, 0.4, 2.2),
    "stingloss": (-50, 1.2, 3.4), "bowheavy": (-50, 0.25, 1.0), "wave": (-40, 0.8, 3.0),
}


def load(p):
    raw = subprocess.run(["ffmpeg", "-v", "quiet", "-i", p, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def env(x, win):
    return np.sqrt(np.convolve(x * x, np.ones(win) / win, mode="same"))


def trim(x, thr_db):
    """Bỏ khoảng lặng hai đầu: giữ từ chỗ đầu tiên vượt ngưỡng (lùi 8 ms) tới chỗ cuối cùng vượt ngưỡng (thêm 60 ms)."""
    e = env(x, int(SR * 0.005)); lim = e.max() * 10 ** (thr_db / 20)
    idx = np.nonzero(e > lim)[0]
    i0 = max(0, int(idx[0]) - int(SR * 0.008)); i1 = min(len(x), int(idx[-1]) + int(SR * 0.06))
    return x[i0:i1].copy()


def fades(y, fi_s, fo_s):
    n = len(y); fi = min(int(SR * fi_s), n // 2); fo = min(int(SR * fo_s), n // 2)
    y[:fi] *= np.linspace(0, 1, fi); y[n - fo:] *= np.linspace(1, 0, fo) ** 2
    return y


def write_wav(p, y):
    with wave.open(p, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(y, -1, 1) * 32767).astype("<i2").tobytes())


def write_m4a(p, y, kbps):
    tmp = p + ".tmp.wav"; write_wav(tmp, y)
    subprocess.run(["ffmpeg", "-v", "quiet", "-y", "-i", tmp, "-c:a", "aac", "-b:a", f"{kbps}k", p], check=True); os.remove(tmp)


os.makedirs(OUT_S, exist_ok=True); os.makedirs(OUT_V, exist_ok=True)

# ---- SFX -------------------------------------------------------------------------------------------------------------------------
for out, (thr, fade, mx) in SFX.items():
    p = os.path.join(SRC, "sfx", out + ".mp3")
    if not os.path.exists(p): print("thiếu sfx", out); continue
    y = fades(trim(load(p), thr)[:int(SR * mx)], 0.003, fade)
    y = y / (np.abs(y).max() + 1e-9) * 0.89
    if len(y) / SR > LONG: write_m4a(os.path.join(OUT_S, out + ".m4a"), y, 96)
    else: write_wav(os.path.join(OUT_S, out + ".wav"), y)
    print(f"sfx {out:12s} {len(y) / SR:5.2f}s {'m4a' if len(y) / SR > LONG else 'wav'}")

# vòng lặp sông: nối đuôi vào đầu 1 s cho lặp liền
p = os.path.join(SRC, "sfx", "river.mp3")
if os.path.exists(p):
    x = load(p); x = x / (np.abs(x).max() + 1e-9) * 0.89; xf = SR
    head, tail = x[:xf].copy(), x[-xf:].copy()
    body = x[:-xf].copy()
    body[:xf] = head * np.linspace(0, 1, xf) + tail * np.linspace(1, 0, xf)
    write_m4a(os.path.join(OUT_S, "river.m4a"), body, 96)
    print(f"sfx river        {len(body) / SR:5.2f}s m4a (loop)")

# ---- giọng -----------------------------------------------------------------------------------------------------------------------
TARGET_RMS = 10 ** (-20 / 20)
d = os.path.join(SRC, "voice")
for f in sorted(os.listdir(d)) if os.path.isdir(d) else []:
    if not f.endswith(".mp3"): continue
    y = trim(load(os.path.join(d, f)), -42)
    act = y[env(y, int(SR * 0.02)) > np.abs(y).max() * 0.05]                     # phần có tiếng: để đo độ to không bị khoảng ngắt kéo xuống
    g = TARGET_RMS / (np.sqrt(np.mean(act * act)) + 1e-9)
    y = np.tanh(y * g * 0.9) / 0.9 if np.abs(y * g).max() > 0.89 else y * g          # vượt đỉnh thì nén mềm thay vì cắt cứng
    y = fades(y, 0.004, 0.08)
    y = y / max(1.0, np.abs(y).max() / 0.89)
    name = f[:-4]
    write_m4a(os.path.join(OUT_V, name + ".m4a"), y, 64)
    print(f"voice {name:22s} {len(y) / SR:5.2f}s {os.path.getsize(os.path.join(OUT_V, name + '.m4a')) // 1024} KB")
