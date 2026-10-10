# tools/bake-terrain-tex.py — chạy trong Blender (nền): nén bộ texture đất (gói kiểu Poly Haven: dirt_1k, rocky_terrain_1k; xem assets/SOURCES.md) thành WebP nhỏ cho shader địa hình
# (js/battle/terrain-tex.js). Cần Blender vì pháp tuyến / độ nhám của Poly Haven là EXR.
#   blender --background --python game/tools/bake-terrain-tex.py -- <thư mục dirt_1k.blend> <thư mục rocky_terrain_1k.blend> <thư mục ra> [kích thước, mặc định 512]
# Ra: dirt_d.webp, rock_d.webp (màu, sRGB), dirt_n.webp, rock_n.webp (pháp tuyến OpenGL, tangent space; hạ mẫu rồi chuẩn hoá lại vector).
# In ra trung bình màu tuyến tính từng texture: shader chia cho trung bình này để chỉ lấy HOA VĂN (tỉ lệ quanh 1), không đổi màu nền của lưới địa hình
# (hằng DIRT_MEAN / ROCK_MEAN ở đầu js/battle/terrain-tex.js phải khớp).
import bpy, sys, os
import numpy as np

argv = sys.argv[sys.argv.index("--") + 1:]
dirt_dir, rock_dir, out_dir = argv[0], argv[1], argv[2]
S = int(argv[3]) if len(argv) > 3 else 512
os.makedirs(out_dir, exist_ok=True)


def load(path, cs):
    im = bpy.data.images.load(path)
    im.colorspace_settings.name = cs
    return im


def pixels(im):
    a = np.empty(len(im.pixels), np.float32)
    im.pixels.foreach_get(a)
    return a.reshape(im.size[1], im.size[0], 4)


def box(a, S):
    f = a.shape[0] // S
    return a.reshape(S, f, S, f, a.shape[2]).mean(axis=(1, 3))


def save(arr, path, cs, quality):
    h, w = arr.shape[:2]
    im = bpy.data.images.new(os.path.basename(path), w, h, alpha=False, float_buffer=False)
    im.colorspace_settings.name = cs
    rgba = np.ones((h, w, 4), np.float32)
    rgba[..., :3] = arr[..., :3]
    im.pixels.foreach_set(rgba.ravel())
    im.file_format = "WEBP"
    im.filepath_raw = path
    scene = bpy.context.scene
    scene.render.image_settings.file_format = "WEBP"
    scene.render.image_settings.quality = quality
    im.save()
    print("SAVED", path, os.path.getsize(path))


def srgb_to_linear(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


for name, d in (("dirt", dirt_dir), ("rock", rock_dir)):
    src = "dirt" if name == "dirt" else "rocky_terrain"
    diff = box(pixels(load(os.path.join(d, "textures", f"{src}_diff_1k.jpg"), "sRGB")), S)        # còn mã hoá sRGB (xem MEAN_LINEAR bên dưới)
    save(diff, os.path.join(out_dir, f"{name}_d.webp"), "sRGB", 88)
    # Blender trả về giá trị còn mã hoá sRGB cho ảnh sRGB (và nhận lại đúng như thế khi lưu): trung bình TUYẾN TÍNH phải giải mã từng điểm ảnh trước
    print("MEAN_LINEAR", name, [round(float(v), 4) for v in srgb_to_linear(diff[..., :3]).reshape(-1, 3).mean(axis=0)])
    nor = pixels(load(os.path.join(d, "textures", f"{src}_nor_gl_1k.exr"), "Non-Color"))
    v = nor[..., :3] * 2.0 - 1.0
    v = box(np.concatenate([v, np.zeros_like(v[..., :1])], axis=2), S)[..., :3]
    v /= np.maximum(np.linalg.norm(v, axis=2, keepdims=True), 1e-6)
    save(v * 0.5 + 0.5, os.path.join(out_dir, f"{name}_n.webp"), "Non-Color", 92)
