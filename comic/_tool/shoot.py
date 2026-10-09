"""shoot.py — chụp từng trang comic đã dàn (lời dẫn, bóng thoại, bộ lọc sơn mài) thành ảnh JPG.

    python _tool/shoot.py B15-ham-tu            # cần server tĩnh đang chạy: npm run dev (cổng 8942)
    python _tool/shoot.py B15-ham-tu --lang en
    (chạy từ thư mục hao-khi-viet/comic)

Dùng Chrome headless mở _tool/viewer.html?ch=<chương>&shot=N (chỉ vẽ trang N trên nền đen), chụp,
rồi cắt sát khung trang theo vùng khác màu đen. Ảnh ra ở <chương>/pages/ — để duyệt và gắn vào tài liệu.
shot=council chụp màn Hiến kế (sau khi chọn thẻ lịch sử A).
"""
import json, subprocess, sys, pathlib, re
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
if len(sys.argv) < 2 or sys.argv[1].startswith("--"):
    sys.exit("Cách dùng: python _tool/shoot.py <thư mục chương> [--lang en]")
ch = sys.argv[1].rstrip("/\\")
lang = "en" if "--lang" in sys.argv and sys.argv[sys.argv.index("--lang") + 1] == "en" else "vi"
BASE = f"http://localhost:8942/hao-khi-viet/comic/_tool/viewer.html?ch={ch}"

data = (ROOT / ch / "comic-data.js").read_text(encoding="utf8")
comic = json.loads(re.search(r"window\.COMIC = (\{.*\});", data, re.S).group(1))
out_dir = ROOT / ch / "pages"
out_dir.mkdir(exist_ok=True)

shots = [*range(len(comic["pages"]))] + (["council"] if comic.get("council") else [])
for n in shots:
    raw = out_dir / f"_raw-{n}.png"
    subprocess.run([CHROME, "--headless=new", "--hide-scrollbars", "--disable-gpu",
                    "--window-size=1648,2200", "--virtual-time-budget=15000",
                    f"--screenshot={raw}", f"{BASE}&shot={n}&lang={lang}"],
                   check=True, capture_output=True)
    im = Image.open(raw).convert("RGB")
    # vùng trang = mọi điểm không gần-đen (nền shot là #000)
    box = im.convert("L").point(lambda v: 255 if v > 12 else 0).getbbox()
    if not box:
        print(f"{n}: ảnh trống — server có chạy không?"); continue
    page = im.crop(box)
    if page.height >= im.height - 30 and n != "council":
        print(f"⚠ trang {n}: có thể bị cắt đáy — tăng --window-size")
    out = out_dir / (f"hien-ke-{lang}.jpg" if n == "council" else f"page-{n + 1}-{lang}.jpg")
    page.save(out, quality=88, optimize=True)
    raw.unlink()
    print(f"{out.name}: {page.width}x{page.height}")
