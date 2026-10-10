# tools/fbx2glb.py — chạy trong Blender (nền): đổi FBX hoạt ảnh (Mixamo, Haley Tuffles, …) sang GLB cho bake-clips.mjs.
#   blender --background --python game/tools/fbx2glb.py -- vào.fbx ra.glb
# Mixamo đặt tên mọi clip là "mixamo.com", nên action được đổi thành tên tệp (bỏ đuôi): bake-clips.mjs tìm clip theo tên tệp.
# Tệp có nhiều action (FBX Mixamo "With Skin" / chuỗi quay dài: Blender tách thêm một action rỗng cho mỗi xương đầu mút, "…End|clip|Base_Layer",
# còn chuyển động thật nằm trong action "Reference" có hàng trăm đường cong): lấy action nhiều đường cong nhất, bỏ các action còn lại.
# Bỏ lưới (tải "Without Skin" thì không có; "With Skin" thì lưới bị xoá), không thêm xương lá, lấy mẫu mọi khung.
import bpy, sys, os

argv = sys.argv[sys.argv.index("--") + 1:]
src, dst = argv[0], argv[1]
stem = os.path.splitext(os.path.basename(src))[0]


def fcurves_of(act):
    # Blender ≤ 4: act.fcurves; Blender 5: action phân lớp (layers → strips → channelbags → fcurves)
    if hasattr(act, "fcurves"):
        return list(act.fcurves)
    out = []
    for layer in act.layers:
        for strip in layer.strips:
            for cb in strip.channelbags:
                out.extend(cb.fcurves)
    return out


bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=src, automatic_bone_orientation=True, use_anim=True)

for o in list(bpy.data.objects):
    if o.type == "MESH":
        bpy.data.objects.remove(o, do_unlink=True)

arms = [o for o in bpy.data.objects if o.type == "ARMATURE"]
if not arms:
    raise SystemExit("không có xương trong " + src)
if bpy.data.actions:
    best = max(bpy.data.actions, key=lambda a: len(fcurves_of(a)))
    for a in list(bpy.data.actions):
        if a is not best:
            bpy.data.actions.remove(a)
    best.name = stem
    ad = arms[0].animation_data or arms[0].animation_data_create()
    ad.action = best

kw = dict(filepath=dst, export_format="GLB", export_animations=True, export_force_sampling=True, export_optimize_animation_size=False,
          export_yup=True, use_selection=False, export_apply=False)
try:
    bpy.ops.export_scene.gltf(**kw, export_leaf_bone=False)
except TypeError:
    bpy.ops.export_scene.gltf(**kw)
print("ĐÃ GHI", dst, "action:", [a.name for a in bpy.data.actions][:5], "…" if len(bpy.data.actions) > 5 else "")
