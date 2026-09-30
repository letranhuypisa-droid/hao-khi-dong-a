# tools/bake-comic.py — nướng comic một Chương cho game (GDD 22.3, 22.4).
#
#   python -X utf8 hao-khi-viet/game/tools/bake-comic.py B15-ham-tu --variant VS --renders <thư mục renders>
#
# Đọc hao-khi-viet/comic/<chương>/panels.json (kịch bản, lời dẫn, bóng thoại, chữ trên cờ, quiz) và ảnh gốc 2K
# trong renders/ (ảnh gốc nằm ngoài git, xem comic/.gitignore). Mỗi khung của biến thể được:
#   1. cắt 2,5% mỗi cạnh (AI hay tự vẽ viền khung sát mép — viewer mẫu cũng phóng 1,05 để giấu viền này),
#      rồi cắt giữa đúng tỉ lệ khung trong kịch bản;
#   2. thu về cạnh dài ≤ 1552 px (22.3 "Dung lượng");
#   3. qua bộ lọc thống nhất "lacquer v1" — đúng các bước của bộ lọc SVG trong comic/_tool/viewer.html (làm nét
#      nét mực → 7 bậc màu → kéo về tông sơn mài → saturate .92, contrast 1.06), cộng lớp giấy dó + mép tối.
#      Nướng một lần ở bước công cụ, không lọc lúc chạy (22.4: "bake ra ảnh, giữ ảnh gốc để chỉnh lại");
#   4. ghi AVIF (chính) + WebP (dự phòng), có XMP khai nội dung AI (luật AI Việt Nam 2025: dấu nhận biết máy đọc
#      được; Steam: khai nội dung AI — GDD 22.7).
# Rồi sinh js/data/comic-<id>.js: dữ liệu khung (chữ do engine vẽ), trang, thứ tự đọc của biến thể, quiz gốc.
# Chữ không bao giờ nằm trong ảnh.

import argparse, hashlib, json, os, sys
import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.dirname(HERE)
COMIC = os.path.join(os.path.dirname(GAME), "comic")
LONG_EDGE = 1552
TRIM = 0.025

# ---- bộ lọc lacquer v1 (bản numpy của #lacquer trong viewer.html) -------------------------------------------
TABLES = [np.array(t) for t in ([0, .16, .32, .5, .66, .82, 1], [0, .15, .3, .46, .62, .8, .96], [0, .13, .26, .4, .55, .7, .86])]
MATRIX = np.array([[1.06, .04, 0], [.02, .98, .02], [0, .04, .88]]); OFFSET = np.array([.012, 0, 0])


def lacquer(img, seed):
    a = np.asarray(img.convert("RGB"), dtype=np.float32) / 255.0
    # feConvolveMatrix 3×3 (0 −.6 0 / −.6 3.4 −.6 / 0 −.6 0), mép "duplicate": làm nét nét mực
    p = np.pad(a, ((1, 1), (1, 1), (0, 0)), mode="edge")
    a = 3.4 * p[1:-1, 1:-1] - 0.6 * (p[:-2, 1:-1] + p[2:, 1:-1] + p[1:-1, :-2] + p[1:-1, 2:])
    a = np.clip(a, 0, 1)
    # feFuncX type="discrete": n bậc, v ∈ [k/n, (k+1)/n) → bảng[k]
    for c in range(3):
        t = TABLES[c]; k = np.minimum((a[..., c] * len(t)).astype(np.int32), len(t) - 1); a[..., c] = t[k]
    a = np.clip(a @ MATRIX.T + OFFSET, 0, 1)
    # CSS saturate(.92) (ma trận chuẩn Filter Effects) rồi contrast(1.06)
    s = 0.92
    S = np.array([[.213 + .787 * s, .715 - .715 * s, .072 - .072 * s],
                  [.213 - .213 * s, .715 + .285 * s, .072 - .072 * s],
                  [.213 - .213 * s, .715 - .715 * s, .072 + .928 * s]])
    a = np.clip(a @ S.T, 0, 1)
    a = np.clip((a - 0.5) * 1.06 + 0.5, 0, 1)
    # lớp giấy dó + mép tối, trộn multiply 35% (như .fx .panel::after): vân nhiễu màu nâu nhạt + vignette elip
    h, w = a.shape[:2]
    rng = np.random.default_rng(seed)
    n = Image.fromarray((rng.random((h // 2 + 1, w // 2 + 1)) * 255).astype(np.uint8)).resize((w, h), Image.BILINEAR)
    n = np.asarray(n.filter(ImageFilter.GaussianBlur(0.8)), dtype=np.float32) / 255.0
    paper = 1 - 0.55 * n[..., None] * (1 - np.array([.55, .45, .3]))          # nhiễu nhuộm (.55 .45 .3), alpha .55
    yy, xx = np.mgrid[0:h, 0:w]
    d = np.sqrt(((xx - w / 2) / (w / 2)) ** 2 + ((yy - h / 2) / (h / 2)) ** 2) / np.sqrt(2)   # 0 tâm → 1 góc
    v = np.clip((d - 0.55) / 0.45, 0, 1)[..., None] * 0.55
    vign = 1 - v * (1 - np.array([40, 15, 5]) / 255.0)
    over = paper * vign
    a = a * (1 - 0.35 + 0.35 * over)
    return Image.fromarray((np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8))


def fit(img, aspect):
    w, h = img.size
    img = img.crop((round(w * TRIM), round(h * TRIM), round(w * (1 - TRIM)), round(h * (1 - TRIM))))
    w, h = img.size
    aw, ah = (float(x) for x in aspect.split(":")); r = aw / ah
    if w / h > r: nw = round(h * r); img = img.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
    else: nh = round(w / r); img = img.crop((0, (h - nh) // 2, w, (h - nh) // 2 + nh))
    w, h = img.size; k = LONG_EDGE / max(w, h)
    return img.resize((round(w * k), round(h * k)), Image.LANCZOS) if k < 1 else img


def xmp(chapter, pid, src_sha):
    return (f'<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">'
            f'<rdf:Description xmlns:Iptc4xmpExt="http://iptc.org/std/Iptc4xmpExt/2008-02-29/" xmlns:dc="http://purl.org/dc/elements/1.1/" '
            f'Iptc4xmpExt:DigitalSourceType="http://cv.iptc.org/newscodes/digitalsourcetype/compositeWithTrainedAlgorithmicMedia">'
            f'<dc:description>Nam Quoc Son Ha comic {chapter}/{pid}. AI-generated image (Higgsfield nano_banana_pro 2K), filtered '
            f'(lacquer v1); lettering added by the game engine. Source sha256 {src_sha}.</dc:description>'
            f'</rdf:Description></rdf:RDF></x:xmpmeta>').encode("utf-8")


KEEP = ("id", "part", "aspect", "caption", "capPos", "capW", "bubbles", "signs", "imageLabel", "insert")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("chapter"); ap.add_argument("--variant", default="VS"); ap.add_argument("--renders")
    ap.add_argument("--avif-q", type=int, default=52); ap.add_argument("--webp-q", type=int, default=76)
    ap.add_argument("--data-only", action="store_true")
    o = ap.parse_args()
    src = os.path.join(COMIC, o.chapter)
    d = json.load(open(os.path.join(src, "panels.json"), encoding="utf-8"))
    cid = d["chapter"]["id"]
    var = d["variants"][o.variant]
    ids = var["open"] + var.get("insert", []) + var["close"]
    renders = o.renders or os.path.join(src, "renders")
    out_dir = os.path.join(GAME, "assets", "comic", cid)
    os.makedirs(out_dir, exist_ok=True)
    byid = {p["id"]: p for p in d["panels"]}
    images, total = {}, 0
    for pid in ids:
        p = byid[pid]
        f = os.path.join(renders, pid + ".png")
        av, wp = os.path.join(out_dir, pid + ".avif"), os.path.join(out_dir, pid + ".webp")
        if o.data_only:
            im = Image.open(av); images[pid] = {"w": im.size[0], "h": im.size[1]}; continue
        if not os.path.exists(f): sys.exit(f"thiếu ảnh gốc {f}")
        sha = hashlib.sha256(open(f, "rb").read()).hexdigest()
        img = lacquer(fit(Image.open(f), p["aspect"]), int(sha[:8], 16))
        meta = xmp(cid, pid, sha)
        img.save(av, quality=o.avif_q, speed=4, xmp=meta)
        img.save(wp, quality=o.webp_q, method=6, xmp=meta)
        images[pid] = {"w": img.size[0], "h": img.size[1]}
        sa, sw = os.path.getsize(av), os.path.getsize(wp); total += sa
        print(f"{pid}: {img.size[0]}×{img.size[1]}  avif {sa / 1024:.0f} KB  webp {sw / 1024:.0f} KB")
    if not o.data_only: print(f"tổng AVIF {total / 1024 / 1024:.2f} MB (trần 3 MB mỗi Chương, 22.3)")

    panels = {}
    for pid in ids:
        p = byid[pid]
        panels[pid] = {k: p[k] for k in KEEP if k in p}
        panels[pid].update(images[pid])
    data = {
        "chapter": {k: d["chapter"][k] for k in ("id", "title", "subtitle", "era", "name", "teaser", "battle", "card") if k in d["chapter"]},
        "variant": o.variant, "open": var["open"], "insert": var.get("insert", []), "close": var["close"],
        "pages": var.get("pages") or d["pages"], "panels": panels, "quiz": d.get("quiz", []),
        "provenance": "Ảnh AI (Higgsfield nano_banana_pro 2K), lọc lacquer v1 bằng tools/bake-comic.py; nguồn và ảnh bị loại: comic/" + o.chapter + "/NGUON-GOC.md",
    }
    js = os.path.join(GAME, "js", "data", f"comic-{cid.lower()}.js")
    with open(js, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(f"// Sinh bởi tools/bake-comic.py từ comic/{o.chapter}/panels.json (biến thể {o.variant}) — đừng sửa tay.\n")
        fh.write(f"export const COMIC_{cid} = ")
        fh.write(json.dumps(data, ensure_ascii=False, indent=1))
        fh.write(";\n")
    print("đã ghi", os.path.relpath(js, GAME))


if __name__ == "__main__":
    main()
