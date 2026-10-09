# tools/fbx2glb.py — chạy trong Blender (nền): đổi FBX hoạt ảnh (Mixamo, …) sang GLB cho bake-clips.mjs.
#   blender --background --python game/tools/fbx2glb.py -- vào.fbx ra.glb
# Mixamo đặt tên mọi clip là "mixamo.com", nên action được đổi thành tên tệp (bỏ đuôi): bake-clips.mjs tìm clip theo tên tệp.
# Bỏ lưới (tải "Without Skin" thì không có; "With Skin" thì lưới bị xoá), không thêm xương lá, lấy mẫu mọi khung.
import bpy, sys, os

argv = sys.argv[sys.argv.index("--") + 1:]
src, dst = argv[0], argv[1]
stem = os.path.splitext(os.path.basename(src))[0]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=src, automatic_bone_orientation=True, use_anim=True)

for o in list(bpy.data.objects):
    if o.type == "MESH":
        bpy.data.objects.remove(o, do_unlink=True)

arms = [o for o in bpy.data.objects if o.type == "ARMATURE"]
if not arms:
    raise SystemExit("không có xương trong " + src)
single = len(bpy.data.actions) == 1
if single:
    bpy.data.actions[0].name = stem          # clip duy nhất của tệp Mixamo
    if arms[0].animation_data:
        arms[0].animation_data.action = bpy.data.actions[0]

kw = dict(filepath=dst, export_format="GLB", export_animations=True, export_force_sampling=True, export_optimize_animation_size=False,
          export_yup=True, use_selection=False, export_apply=False)
try:
    bpy.ops.export_scene.gltf(**kw, export_leaf_bone=False)
except TypeError:
    bpy.ops.export_scene.gltf(**kw)
print("ĐÃ GHI", dst, "action:", [a.name for a in bpy.data.actions][:5], "…" if len(bpy.data.actions) > 5 else "")
