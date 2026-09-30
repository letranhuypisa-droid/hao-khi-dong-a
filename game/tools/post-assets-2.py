# Hậu kỳ đợt 7: icon chiêu thức và SFX sinh bằng tools/render-assets-2.sh.
#   python tools/post-assets-2.py <thư-mục-kết-quả-của-render-assets-2>
# Cần ffmpeg trên PATH, Pillow, numpy. Ghi vào assets/icons/*.webp và assets/sfx/*.wav|m4a.
#
# SFX: mẫu Seed Audio thường dài 1,5–10 s, có khoảng lặng đầu, đôi khi hai tiếng rời nhau. Mỗi file cắt theo SPEC:
#   src: file gốc; start: "first" (tiếng đầu tiên vượt ngưỡng thr dB dưới đỉnh) hoặc "peak" (lùi từ đỉnh tới khi dưới
#   ngưỡng — lấy tiếng to nhất, bỏ tiếng lạc phía trước); max: độ dài tối đa (s); fade: tắt dần cuối (s).
# Rồi chuẩn hoá đỉnh −1 dBFS, mono. Mẫu ngắn ghi WAV 16-bit 32 kHz (không có khoảng đệm đầu như AAC/MP3 — tiếng đòn
# phải ăn đúng khung); mẫu dài (> 2,5 s) mã AAC 96 kbps .m4a. Hai vòng lặp nền (ambience, fire) nối đuôi vào đầu 1 s
# cho lặp không vấp.
import json, os, re, subprocess, sys, wave
import numpy as np
from PIL import Image

SRC = sys.argv[1]
HERE = os.path.dirname(os.path.abspath(__file__))
OUT_I = os.path.join(HERE, "..", "assets", "icons")
OUT_S = os.path.join(HERE, "..", "assets", "sfx")
SR = 32000

ICONS = ["n", "c1", "c2", "c3", "c4", "c5", "c6", "dash", "dq", "ct", "dodge", "block", "skill", "ult", "tpc",
         "cmd", "tiencong", "giuvung", "theota", "tiepvien", "kesach", "lock"]

# tên ra: (file gốc, cách chọn điểm đầu, ngưỡng dB, dài tối đa s, tắt dần s)
SPEC = {
    "swing-1": ("swing-1", "first", -24, 0.5, 0.15), "swing-2": ("swing-2", "first", -24, 0.5, 0.15), "swing-3": ("swing-3", "first", -24, 0.55, 0.15),
    "swingheavy-1": ("swingheavy-1", "first", -20, 0.75, 0.25), "swingheavy-2": ("swingheavy-2", "peak", -9, 0.75, 0.3),
    "slice-1": ("slice-1", "first", -18, 0.5, 0.18), "slice-2": ("slice-2", "first", -18, 0.45, 0.15), "slice-3": ("slice-3", "first", -18, 0.45, 0.15),
    "clang-1": ("clang-1", "first", -20, 0.6, 0.2), "clang-2": ("clang-2", "first", -20, 0.6, 0.2), "clang-3": ("clang-3", "first", -20, 0.55, 0.2),
    "grunt-1": ("grunt-1", "first", -16, 0.7, 0.15), "grunt-2": ("grunt-2", "peak", -12, 0.55, 0.15),
    "kiai-1": ("kiai-1", "first", -16, 0.55, 0.12), "kiai-2": ("kiai-2", "peak", -6, 0.7, 0.2),
    "parry": ("parry", "first", -20, 1.4, 0.6), "finisher": ("finisher", "first", -20, 1.6, 0.7),
    "slam": ("slam", "first", -20, 1.4, 0.6), "dash": ("dash", "first", -18, 1.0, 0.35), "roll": ("roll", "first", -14, 0.6, 0.2),
    "arrowhit": ("arrowhit", "first", -20, 0.3, 0.1), "crossbow": ("crossbow", "peak", -18, 0.5, 0.2),
    "drum": ("drum", "first", -20, 1.8, 0.8), "gatehit": ("gatehit", "first", -20, 0.9, 0.35),
    "roar": ("roar", "peak", -10, 2.2, 0.6), "charge": ("charge", "first", -20, 1.4, 0.4), "pickup": ("pickup", "first", -20, 0.9, 0.4),
    "ui": ("ui", "peak", -20, 0.12, 0.05), "ultstart": ("ultstart", "first", -20, 2.2, 0.6),
    # dài → m4a
    "volley": ("volley", "first", -20, 2.6, 0.8), "horn": ("horn", "first", -20, 3.2, 1.0), "drumroll": ("drumroll", "first", -20, 6.6, 1.2),
    "gong": ("gong", "first", -20, 4.0, 1.8), "gatebreak": ("gatebreak", "first", -20, 3.2, 1.2), "cheer": ("cheer", "first", -20, 4.2, 1.4),
}
# đợt bù: chỉ dùng khi đã có file (xem render-assets-2.sh, phần sfx2)
EXTRA = {
    "hitheavy-1": ("hitheavy-3", "first", -18, 0.6, 0.25), "hitheavy-2": ("hitheavy-4", "first", -18, 0.6, 0.25), "hitheavy-3": ("hitheavy-5", "first", -18, 0.6, 0.25),
    "fall-1": ("fall-3", "first", -18, 0.8, 0.3), "fall-2": ("fall-4", "first", -18, 0.8, 0.3),
    "warn": ("warn-2", "peak", -8, 0.5, 0.25), "bow-1": ("bow-2", "peak", -18, 0.6, 0.25), "bow-2": ("bow-3", "first", -20, 0.7, 0.25),
}
LOOPS = {"ambience": ("ambience", 22.0), "fire": ("fire", 12.0)}
LONG = 2.5


def url_of(js):
    try:
        d = json.load(open(js, encoding="utf-8"))
        return d[0]["result_url"] if d and d[0].get("result_url") else None
    except Exception:
        return None


def fetch(kind, name, ext):
    p = os.path.join(SRC, kind, f"{name}.{ext}")
    if not os.path.exists(p):
        u = url_of(os.path.join(SRC, kind, f"{name}.json"))
        if not u:
            return None
        subprocess.run(["curl", "-s", "-o", p, u], check=True)
    return p


def load(p):
    raw = subprocess.run(["ffmpeg", "-v", "quiet", "-i", p, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def env(x, win):
    return np.sqrt(np.convolve(x * x, np.ones(win) / win, mode="same"))


def cut(x, mode, thr, mx, fade):
    e = env(x, int(SR * 0.005)); pk = e.max(); lim = pk * 10 ** (thr / 20)
    if mode == "first":
        i0 = int(np.argmax(e > lim))
    else:
        i0 = int(np.argmax(e))
        while i0 > 0 and e[i0] > lim: i0 -= 1
    i0 = max(0, i0 - int(SR * 0.008))
    y = x[i0:i0 + int(SR * mx)].copy()
    # hết tiếng sớm (dưới đỉnh 50 dB liền 60 ms) thì cắt luôn
    e2 = env(y, int(SR * 0.005)); quiet = e2 < pk * 10 ** (-50 / 20); run = int(SR * 0.06)
    for k in range(int(SR * 0.08), len(y) - run, int(SR * 0.01)):
        if quiet[k:k + run].all(): y = y[:k + run]; break
    n = len(y); fi = int(SR * 0.003); fo = min(int(SR * fade), n // 2)
    y[:fi] *= np.linspace(0, 1, fi); y[n - fo:] *= np.linspace(1, 0, fo) ** 2
    return y / (np.abs(y).max() + 1e-9) * 0.89


def write_wav(p, y):
    with wave.open(p, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(y, -1, 1) * 32767).astype("<i2").tobytes())


def write_m4a(p, y):
    tmp = p + ".tmp.wav"; write_wav(tmp, y)
    subprocess.run(["ffmpeg", "-v", "quiet", "-y", "-i", tmp, "-c:a", "aac", "-b:a", "96k", p], check=True); os.remove(tmp)


os.makedirs(OUT_I, exist_ok=True); os.makedirs(OUT_S, exist_ok=True)
# icon: 1k → 192 px, WebP q86
for n in ICONS:
    p = fetch("icons", n, "png")
    if not p: print("thiếu icon", n); continue
    Image.open(p).convert("RGB").resize((192, 192), Image.LANCZOS).save(os.path.join(OUT_I, f"{n}.webp"), "WEBP", quality=86, method=6)
# sfx
made = {}
for out, (src, mode, thr, mx, fade) in {**SPEC, **EXTRA}.items():
    p = fetch("sfx", src, "wav")
    if not p: print("thiếu sfx", src); continue
    y = cut(load(p), mode, thr, mx, fade)
    ext = "m4a" if mx > LONG else "wav"
    (write_m4a if ext == "m4a" else write_wav)(os.path.join(OUT_S, f"{out}.{ext}"), y)
    made[out] = round(len(y) / SR, 2)
for out, (src, L) in LOOPS.items():
    p = fetch("sfx", src, "wav")
    if not p: print("thiếu vòng lặp", src); continue
    x = load(p); x = x[int(SR * 0.3):int(SR * (0.3 + L))]
    xf = int(SR * 1.0); head, tail = x[:xf], x[-xf:]; t = np.linspace(0, 1, xf)
    y = np.concatenate([tail * (1 - t) ** 0.5 + head * t ** 0.5, x[xf:-xf]])   # đuôi hoà vào đầu → nối vòng liền
    y = y / (np.abs(y).max() + 1e-9) * 0.7
    write_m4a(os.path.join(OUT_S, f"{out}.m4a"), y); made[out] = round(len(y) / SR, 2)
print(json.dumps(made, ensure_ascii=False))
