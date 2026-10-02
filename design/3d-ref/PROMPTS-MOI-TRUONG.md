# Prompt vẽ vật thể môi trường để dựng 3D

Hunyuan3D dựng **từng vật thể**, không dựng cả cảnh. Nên phần môi trường chia làm hai:

- **Dựng bằng Hunyuan3D** (danh sách dưới): thuyền, công trình, cọc, đạo cụ, cây, đá — những thứ game đang dựng bằng khối low poly
  trong `game/js/battle/scenery.js`, `scenery-b20.js`, `boats.js`, `world.js` (cổng Hàm Tử quan).
- **Giữ dựng bằng code như hiện nay**: mặt đất, lũy đất, hào, ruộng bậc thang, mặt sông và con nước, trời, núi xa, sương. Đây là lưới
  địa hình theo số liệu trận (làn đánh, triều lên xuống) — dựng bằng ảnh → 3D thì mất số liệu đó.

Phạm vi: bến Hàm Tử (B15), sông Bạch Đằng (B20), Võ trường. Kích thước ghi theo game (mét). Nhãn sử liệu: tạo hình **Hư cấu** dựa trên
cảnh đang có trong game; bãi cọc Bạch Đằng là Chính sử (hình dáng từng cọc theo mô tả khảo cổ chung, không chép hiện vật cụ thể).

## Cách dùng

Higgsfield, Nano Banana Pro, 2K, đúng khung ghi ở mỗi mục. Một vật thể, nhìn chéo 3/4 hơi từ trên, nền xám trơn, không người, không chữ.
Thuyền: vỏ nhấc khỏi nước để Hunyuan3D dựng cả đáy. Lưu ý trước khi đưa vào game: mô hình Hunyuan3D rất nặng (hàng trăm nghìn tam
giác) trong khi game chạy trên điện thoại với vật thể vài trăm tới vài nghìn tam giác — cần giảm lưới (decimate) và gom màu.

## Thuyền

### Chiến thuyền Nguyên (B20, `HULLS.junk`, dài 24 m)

Khung **16:9** · tên gợi ý `chien-thuyen-nguyen`

```
3D game environment asset concept for image-to-3D modelling: a single Yuan dynasty war junk, isolated, three-quarter side view from slightly above, the whole hull out of the water including the keel, no water, the whole object in frame with a small margin, centered, plain flat light-grey background, soft even studio lighting, no cast shadows, no ground plane, no people, no animals, no other objects. A large 24-metre multi-deck wooden war junk of dark weathered timber with indigo-painted trim, a raised stern castle, two masts with ribbed batten lug sails of brown matting, round leather shields hung along the rails, painted eyes on the bow, a stern rudder, rope rigging. Stylized semi-realistic game art with clean readable shapes suitable for a low-poly game asset, hand-painted matte materials in a Vietnamese lacquer palette (lacquer black, vermilion red, gold, burnt umber, warm ivory, jade green), no heavy black ink outlines, no cracked texture; 13th-century Dai Viet (Vietnam), Tran dynasty, war against the Yuan. Avoid: any text, letters or symbols (including on flags, sails, banners and crates), logos, watermark; modern objects, modern metal hardware or nails; Japanese or Qing-dynasty architecture; people or animals; multiple views; cut-off parts.
```

### Kỳ hạm Ô Mã Nhi (B20, `HULLS.flagship`, dài 36 m)

Khung **16:9** · tên gợi ý `ky-ham-nguyen`

```
3D game environment asset concept for image-to-3D modelling: a single Yuan dynasty flagship, isolated, three-quarter side view from slightly above, the whole hull out of the water including the keel, no water, the whole object in frame with a small margin, centered, plain flat light-grey background, soft even studio lighting, no cast shadows, no ground plane, no people, no animals, no other objects. A huge 36-metre two-deck wooden flagship of dark timber with dark red trim, a tall command tower amidships topped by a small open pavilion with a curved roof, an inner stairway up the tower, three masts with ribbed batten lug sails, shields along the rails, painted eyes on the bow, blank dark red pennants. Stylized semi-realistic game art with clean readable shapes suitable for a low-poly game asset, hand-painted matte materials in a Vietnamese lacquer palette (lacquer black, vermilion red, gold, burnt umber, warm ivory, jade green), no heavy black ink outlines, no cracked texture; 13th-century Dai Viet (Vietnam), Tran dynasty, war against the Yuan. Avoid: any text, letters or symbols (including on flags, sails, banners and crates), logos, watermark; modern objects, modern metal hardware or nails; Japanese or Qing-dynasty architecture; people or animals; multiple views; cut-off parts.
```

### Thuyền chiến nhẹ nhà Trần (B15, B20, `HULLS.light`)

Khung **16:9** · tên gợi ý `thuyen-chien-tran`

```
3D game environment asset concept for image-to-3D modelling: a single slender Dai Viet war boat, isolated, three-quarter side view from slightly above, the whole hull out of the water including the keel, no water, the whole object in frame with a small margin, centered, plain flat light-grey background, soft even studio lighting, no cast shadows, no ground plane, no people, no animals, no other objects. A long narrow 14-metre Vietnamese war boat lacquered black with vermilion and gold bands, a low curved arched awning of woven bamboo at the stern, a row of oars on each side, painted eyes on the bow, a small blank red banner on a pole at the stern. Stylized semi-realistic game art with clean readable shapes suitable for a low-poly game asset, hand-painted matte materials in a Vietnamese lacquer palette (lacquer black, vermilion red, gold, burnt umber, warm ivory, jade green), no heavy black ink outlines, no cracked texture; 13th-century Dai Viet (Vietnam), Tran dynasty, war against the Yuan. Avoid: any text, letters or symbols (including on flags, sails, banners and crates), logos, watermark; modern objects, modern metal hardware or nails; Japanese or Qing-dynasty architecture; people or animals; multiple views; cut-off parts.
```

### Thuyền thúng / thuyền nan nhỏ (bến Hàm Tử)

Khung **1:1** · tên gợi ý `thuyen-nan`

```
3D game environment asset concept for image-to-3D modelling: a single small Vietnamese woven bamboo basket boat with a paddle, isolated, three-quarter view from slightly above eye level, the whole object in frame with a small margin, centered, plain flat light-grey background, soft even studio lighting, no cast shadows, no ground plane, no people, no animals, no other objects. A round woven bamboo coracle boat about 2 metres wide, coated with dark lacquer and resin, a single wooden paddle resting inside. Stylized semi-realistic game art with clean readable shapes suitable for a low-poly game asset, hand-painted matte materials in a Vietnamese lacquer palette (lacquer black, vermilion red, gold, burnt umber, warm ivory, jade green), no heavy black ink outlines, no cracked texture; 13th-century Dai Viet (Vietnam), Tran dynasty, war against the Yuan. Avoid: any text, letters or symbols (including on flags, sails, banners and crates), logos, watermark; modern objects, modern metal hardware or nails; Japanese or Qing-dynasty architecture; people or animals; multiple views; cut-off parts.
```

### Long thuyền ngự nhà Trần (comic O1, K3 — tùy chọn)

Khung **16:9** · tên gợi ý `long-thuyen`

```
3D game environment asset concept for image-to-3D modelling: a single Tran dynasty royal dragon boat, isolated, three-quarter side view from slightly above, the whole hull out of the water including the keel, no water, the whole object in frame with a small margin, centered, plain flat light-grey background, soft even studio lighting, no cast shadows, no ground plane, no people, no animals, no other objects. A long royal boat with a carved dragon head at the bow and dragon tail at the stern, lacquered vermilion and gold, a central roofed pavilion with curved eaves and two golden parasols, rows of oars. Stylized semi-realistic game art with clean readable shapes suitable for a low-poly game asset, hand-painted matte materials in a Vietnamese lacquer palette (lacquer black, vermilion red, gold, burnt umber, warm ivory, jade green), no heavy black ink outlines, no cracked texture; 13th-century Dai Viet (Vietnam), Tran dynasty, war against the Yuan. Avoid: any text, letters or symbols (including on flags, sails, banners and crates), logos, watermark; modern objects, modern metal hardware or nails; Japanese or Qing-dynasty architecture; people or animals; multiple views; cut-off parts.
```

## Công trình

### Đoạn tường rào gỗ (B15, trại Nguyên)

Khung **16:9** · tên gợi ý `rao-go`

```
3D game environment asset concept for image-to-3D modelling: a single straight segment of a wooden palisade wall, isolated, three-quarter view from slightly above eye level, the whole object in frame with a small margin, centered, plain flat light-grey background, soft even studio lighting, no cast shadows, no ground plane, no people, no animals, no other objects. A 10-metre section of vertical sharpened tree-trunk logs lashed together with rope, bark still on, a low earth berm at the foot and a wooden walkway behind. Stylized semi-realistic game art with clean readable shapes suitable for a low-poly game asset, hand-painted matte materials in a Vietnamese lacquer palette (lacquer black, vermilion red, gold, burnt umber, warm ivory, jade green), no heavy black ink outlines, no cracked texture; 13th-century Dai Viet (Vietnam), Tran dynasty, war against the Yuan. Avoid: any text, letters or symbols (including on flags, sails, banners and crates), logos, watermark; modern objects, modern metal hardware or nails; Japanese or Qing-dynasty architecture; people or animals; multiple views; cut-off parts.
```

### Tháp canh gỗ (B15, B20)

Khung **3:4** · tên gợi ý `thap-canh`

```
3D game environment asset concept for image-to-3D modelling: a single wooden watchtower, isolated, three-quarter view from slightly above eye level, the whole object in frame with a small margin, centered, plain flat light-grey background, soft even studio lighting, no cast shadows, no ground plane, no people, no animals, no other objects. An 8-metre wooden watchtower on four log legs with diagonal bracing, a ladder, a railed lookout platform and a small thatched roof, a blank red pennant on top. Stylized semi-realistic game art with clean readable shapes suitable for a low-poly game asset, hand-painted matte materials in a Vietnamese lacquer palette (lacquer black, vermilion red, gold, burnt umber, warm ivory, jade green), no heavy black ink outlines, no cracked texture; 13th-century Dai Viet (Vietnam), Tran dynasty, war against the Yuan. Avoid: any text, letters or symbols (including on flags, sails, banners and crates), logos, watermark; modern objects, modern metal hardware or nails; Japanese or Qing-dynasty architecture; people or animals; multiple views; cut-off parts.
```

### Cổng Hàm Tử quan (B15, cổng thành Nguyên dựng trên lũy)

Khung **16:9** · tên gợi ý `cong-ham-tu-quan`

```
3D game environment asset concept for image-to-3D modelling: a single fortified wooden gatehouse, isolated, three-quarter view from slightly above eye level, the whole object in frame with a small margin, centered, plain flat light-grey background, soft even studio lighting, no cast shadows, no ground plane, no people, no animals, no other objects. A heavy timber gatehouse set in a short section of rammed-earth rampart with a log palisade on top, two massive plank gate doors with iron bands, a covered fighting gallery above the gate with a tiled roof, earth ramps at both sides. Stylized semi-realistic game art with clean readable shapes suitable for a low-poly game asset, hand-painted matte materials in a Vietnamese lacquer palette (lacquer black, vermilion red, gold, burnt umber, warm ivory, jade green), no heavy black ink outlines, no cracked texture; 13th-century Dai Viet (Vietnam), Tran dynasty, war against the Yuan. Avoid: any text, letters or symbols (including on flags, sails, banners and crates), logos, watermark; modern objects, modern metal hardware or nails; Japanese or Qing-dynasty architecture; people or animals; multiple views; cut-off parts.
```

### Lều quân Nguyên (B15, trại ngoài thành)

Khung **1:1** · tên gợi ý `leu-nguyen`

```
3D game environment asset concept for image-to-3D modelling: a single Yuan army campaign tent, isolated, three-quarter view from slightly above eye level, the whole object in frame with a small margin, centered, plain flat light-grey background, soft even studio lighting, no cast shadows, no ground plane, no people, no animals, no other objects. A round felt campaign tent with a low conical roof, off-white felt panels tied with brown ropes, a wooden door frame painted dark red, a smoke opening at the top. Stylized semi-realistic game art with clean readable shapes suitable for a low-poly game asset, hand-painted matte materials in a Vietnamese lacquer palette (lacquer black, vermilion red, gold, burnt umber, warm ivory, jade green), no heavy black ink outlines, no cracked texture; 13th-century Dai Viet (Vietnam), Tran dynasty, war against the Yuan. Avoid: any text, letters or symbols (including on flags, sails, banners and crates), logos, watermark; modern objects, modern metal hardware or nails; Japanese or Qing-dynasty architecture; people or animals; multiple views; cut-off parts.
```

### Trướng chỉ huy Nguyên (comic B20 O2)

Khung **16:9** · tên gợi ý `leu-chi-huy-nguyen`

```
3D game environment asset concept for image-to-3D modelling: a single large Yuan command tent, isolated, three-quarter view from slightly above eye level, the whole object in frame with a small margin, centered, plain flat light-grey background, soft even studio lighting, no cast shadows, no ground plane, no people, no animals, no other objects. A large rectangular command tent of indigo and ochre cloth with fur-trimmed edges, tall wooden poles, the front flap tied open, blank banners on poles at the corners. Stylized semi-realistic game art with clean readable shapes suitable for a low-poly game asset, hand-painted matte materials in a Vietnamese lacquer palette (lacquer black, vermilion red, gold, burnt umber, warm ivory, jade green), no heavy black ink outlines, no cracked texture; 13th-century Dai Viet (Vietnam), Tran dynasty, war against the Yuan. Avoid: any text, letters or symbols (including on flags, sails, banners and crates), logos, watermark; modern objects, modern metal hardware or nails; Japanese or Qing-dynasty architecture; people or animals; multiple views; cut-off parts.
```

### Bản doanh Đại Việt / đình chỉ huy (B20, Võ trường)

Khung **1:1** · tên gợi ý `ban-doanh-dai-viet`

```
3D game environment asset concept for image-to-3D modelling: a single open-sided Dai Viet command pavilion, isolated, three-quarter view from slightly above eye level, the whole object in frame with a small margin, centered, plain flat light-grey background, soft even studio lighting, no cast shadows, no ground plane, no people, no animals, no other objects. A square open pavilion on four vermilion-lacquered wooden columns with a raised wooden floor, a thatched roof with gently upturned corners, a low table with a blank map scroll, a war drum on a stand beside it. Stylized semi-realistic game art with clean readable shapes suitable for a low-poly game asset, hand-painted matte materials in a Vietnamese lacquer palette (lacquer black, vermilion red, gold, burnt umber, warm ivory, jade green), no heavy black ink outlines, no cracked texture; 13th-century Dai Viet (Vietnam), Tran dynasty, war against the Yuan. Avoid: any text, letters or symbols (including on flags, sails, banners and crates), logos, watermark; modern objects, modern metal hardware or nails; Japanese or Qing-dynasty architecture; people or animals; multiple views; cut-off parts.
```

### Nhà sàn mái tranh ven sông (làng B15)

Khung **1:1** · tên gợi ý `nha-san`

```
3D game environment asset concept for image-to-3D modelling: a single Vietnamese thatched stilt house, isolated, three-quarter view from slightly above eye level, the whole object in frame with a small margin, centered, plain flat light-grey background, soft even studio lighting, no cast shadows, no ground plane, no people, no animals, no other objects. A small wooden house on stilts with woven bamboo walls, a steep thatched roof, a ladder up to the door and a narrow veranda. Stylized semi-realistic game art with clean readable shapes suitable for a low-poly game asset, hand-painted matte materials in a Vietnamese lacquer palette (lacquer black, vermilion red, gold, burnt umber, warm ivory, jade green), no heavy black ink outlines, no cracked texture; 13th-century Dai Viet (Vietnam), Tran dynasty, war against the Yuan. Avoid: any text, letters or symbols (including on flags, sails, banners and crates), logos, watermark; modern objects, modern metal hardware or nails; Japanese or Qing-dynasty architecture; people or animals; multiple views; cut-off parts.
```

### Bến gỗ trên cọc (B15, B20)

Khung **16:9** · tên gợi ý `ben-go`

```
3D game environment asset concept for image-to-3D modelling: a single wooden jetty segment on stilts, isolated, three-quarter view from slightly above eye level, the whole object in frame with a small margin, centered, plain flat light-grey background, soft even studio lighting, no cast shadows, no ground plane, no people, no animals, no other objects. A 12-metre wooden plank jetty on log pilings with a T-shaped end, mooring posts, a ladder down one side. Stylized semi-realistic game art with clean readable shapes suitable for a low-poly game asset, hand-painted matte materials in a Vietnamese lacquer palette (lacquer black, vermilion red, gold, burnt umber, warm ivory, jade green), no heavy black ink outlines, no cracked texture; 13th-century Dai Viet (Vietnam), Tran dynasty, war against the Yuan. Avoid: any text, letters or symbols (including on flags, sails, banners and crates), logos, watermark; modern objects, modern metal hardware or nails; Japanese or Qing-dynasty architecture; people or animals; multiple views; cut-off parts.
```

### Cự mã — chướng ngại cọc nhọn (B15, trước cổng)

Khung **16:9** · tên gợi ý `cu-ma`

```
3D game environment asset concept for image-to-3D modelling: a single wooden cheval-de-frise barrier, isolated, three-quarter view from slightly above eye level, the whole object in frame with a small margin, centered, plain flat light-grey background, soft even studio lighting, no cast shadows, no ground plane, no people, no animals, no other objects. A 4-metre log beam pierced with crossed sharpened wooden stakes pointing outward, lashed with rope. Stylized semi-realistic game art with clean readable shapes suitable for a low-poly game asset, hand-painted matte materials in a Vietnamese lacquer palette (lacquer black, vermilion red, gold, burnt umber, warm ivory, jade green), no heavy black ink outlines, no cracked texture; 13th-century Dai Viet (Vietnam), Tran dynasty, war against the Yuan. Avoid: any text, letters or symbols (including on flags, sails, banners and crates), logos, watermark; modern objects, modern metal hardware or nails; Japanese or Qing-dynasty architecture; people or animals; multiple views; cut-off parts.
```

## Cọc và đồ trên sông Bạch Đằng

### Bãi cọc Bạch Đằng — cụm cọc nguyên (B20)

Khung **1:1** · tên gợi ý `coc-bach-dang`

```
3D game environment asset concept for image-to-3D modelling: a single cluster of wooden river stakes, isolated, three-quarter view from slightly above eye level, the whole object in frame with a small margin, centered, plain flat light-grey background, soft even studio lighting, no cast shadows, no ground plane, no people, no animals, no other objects. Seven thick ironwood tree-trunk stakes 3 to 4 metres long, sharpened to points, standing at slight angles in a tight cluster, dark wet wood with bark patches and mud at the base. Stylized semi-realistic game art with clean readable shapes suitable for a low-poly game asset, hand-painted matte materials in a Vietnamese lacquer palette (lacquer black, vermilion red, gold, burnt umber, warm ivory, jade green), no heavy black ink outlines, no cracked texture; 13th-century Dai Viet (Vietnam), Tran dynasty, war against the Yuan. Avoid: any text, letters or symbols (including on flags, sails, banners and crates), logos, watermark; modern objects, modern metal hardware or nails; Japanese or Qing-dynasty architecture; people or animals; multiple views; cut-off parts.
```

### Cọc gãy (B20, sau trận)

Khung **1:1** · tên gợi ý `coc-gay`

```
3D game environment asset concept for image-to-3D modelling: a single cluster of broken wooden river stakes, isolated, three-quarter view from slightly above eye level, the whole object in frame with a small margin, centered, plain flat light-grey background, soft even studio lighting, no cast shadows, no ground plane, no people, no animals, no other objects. Five thick dark ironwood stakes snapped and splintered at different heights, leaning at angles, mud-stained. Stylized semi-realistic game art with clean readable shapes suitable for a low-poly game asset, hand-painted matte materials in a Vietnamese lacquer palette (lacquer black, vermilion red, gold, burnt umber, warm ivory, jade green), no heavy black ink outlines, no cracked texture; 13th-century Dai Viet (Vietnam), Tran dynasty, war against the Yuan. Avoid: any text, letters or symbols (including on flags, sails, banners and crates), logos, watermark; modern objects, modern metal hardware or nails; Japanese or Qing-dynasty architecture; people or animals; multiple views; cut-off parts.
```

### Bè cỏ nghi binh (B20)

Khung **16:9** · tên gợi ý `be-co`

```
3D game environment asset concept for image-to-3D modelling: a single floating grass raft, isolated, three-quarter view from slightly above eye level, the whole object in frame with a small margin, centered, plain flat light-grey background, soft even studio lighting, no cast shadows, no ground plane, no people, no animals, no other objects. A 6-metre raft of lashed bamboo poles covered with bundles of reeds and grass, rope ties at the corners. Stylized semi-realistic game art with clean readable shapes suitable for a low-poly game asset, hand-painted matte materials in a Vietnamese lacquer palette (lacquer black, vermilion red, gold, burnt umber, warm ivory, jade green), no heavy black ink outlines, no cracked texture; 13th-century Dai Viet (Vietnam), Tran dynasty, war against the Yuan. Avoid: any text, letters or symbols (including on flags, sails, banners and crates), logos, watermark; modern objects, modern metal hardware or nails; Japanese or Qing-dynasty architecture; people or animals; multiple views; cut-off parts.
```

### Phao chặn luồng — khúc gỗ nối xích (B20)

Khung **16:9** · tên gợi ý `phao-chan-luong`

```
3D game environment asset concept for image-to-3D modelling: a single floating log boom segment, isolated, three-quarter view from slightly above eye level, the whole object in frame with a small margin, centered, plain flat light-grey background, soft even studio lighting, no cast shadows, no ground plane, no people, no animals, no other objects. Three large logs joined end to end by iron rings and thick rope. Stylized semi-realistic game art with clean readable shapes suitable for a low-poly game asset, hand-painted matte materials in a Vietnamese lacquer palette (lacquer black, vermilion red, gold, burnt umber, warm ivory, jade green), no heavy black ink outlines, no cracked texture; 13th-century Dai Viet (Vietnam), Tran dynasty, war against the Yuan. Avoid: any text, letters or symbols (including on flags, sails, banners and crates), logos, watermark; modern objects, modern metal hardware or nails; Japanese or Qing-dynasty architecture; people or animals; multiple views; cut-off parts.
```

## Đạo cụ

### Trống trận trên giá (B20, Võ trường)

Khung **1:1** · tên gợi ý `trong-tran`

```
3D game environment asset concept for image-to-3D modelling: a single large Vietnamese war drum on a wooden stand, isolated, three-quarter view from slightly above eye level, the whole object in frame with a small margin, centered, plain flat light-grey background, soft even studio lighting, no cast shadows, no ground plane, no people, no animals, no other objects. A big barrel drum with a hide head, lacquered vermilion body with gold bands, on a black wooden stand, two wooden drumsticks resting on top. Stylized semi-realistic game art with clean readable shapes suitable for a low-poly game asset, hand-painted matte materials in a Vietnamese lacquer palette (lacquer black, vermilion red, gold, burnt umber, warm ivory, jade green), no heavy black ink outlines, no cracked texture; 13th-century Dai Viet (Vietnam), Tran dynasty, war against the Yuan. Avoid: any text, letters or symbols (including on flags, sails, banners and crates), logos, watermark; modern objects, modern metal hardware or nails; Japanese or Qing-dynasty architecture; people or animals; multiple views; cut-off parts.
```

### Giá binh khí (Võ trường, bến phục binh)

Khung **16:9** · tên gợi ý `gia-binh-khi`

```
3D game environment asset concept for image-to-3D modelling: a single wooden weapon rack, isolated, three-quarter view from slightly above eye level, the whole object in frame with a small margin, centered, plain flat light-grey background, soft even studio lighting, no cast shadows, no ground plane, no people, no animals, no other objects. A black lacquered wooden rack holding six spears with red tassels, two sabers and two round woven rattan shields leaning against it. Stylized semi-realistic game art with clean readable shapes suitable for a low-poly game asset, hand-painted matte materials in a Vietnamese lacquer palette (lacquer black, vermilion red, gold, burnt umber, warm ivory, jade green), no heavy black ink outlines, no cracked texture; 13th-century Dai Viet (Vietnam), Tran dynasty, war against the Yuan. Avoid: any text, letters or symbols (including on flags, sails, banners and crates), logos, watermark; modern objects, modern metal hardware or nails; Japanese or Qing-dynasty architecture; people or animals; multiple views; cut-off parts.
```

### Hòm, thùng, bao gạo (trại Nguyên)

Khung **1:1** · tên gợi ý `hang-tiep-te`

```
3D game environment asset concept for image-to-3D modelling: a single small pile of army supplies, isolated, three-quarter view from slightly above eye level, the whole object in frame with a small margin, centered, plain flat light-grey background, soft even studio lighting, no cast shadows, no ground plane, no people, no animals, no other objects. A stack of plain wooden crates bound with rope, two wooden barrels and several hemp rice sacks. Stylized semi-realistic game art with clean readable shapes suitable for a low-poly game asset, hand-painted matte materials in a Vietnamese lacquer palette (lacquer black, vermilion red, gold, burnt umber, warm ivory, jade green), no heavy black ink outlines, no cracked texture; 13th-century Dai Viet (Vietnam), Tran dynasty, war against the Yuan. Avoid: any text, letters or symbols (including on flags, sails, banners and crates), logos, watermark; modern objects, modern metal hardware or nails; Japanese or Qing-dynasty architecture; people or animals; multiple views; cut-off parts.
```

### Cột cờ với lá cờ trơn (mọi trận)

Khung **3:4** · tên gợi ý `cot-co`

```
3D game environment asset concept for image-to-3D modelling: a single tall flagpole with a blank banner, isolated, three-quarter view from slightly above eye level, the whole object in frame with a small margin, centered, plain flat light-grey background, soft even studio lighting, no cast shadows, no ground plane, no people, no animals, no other objects. A 6-metre bamboo pole on a stone base with a long vertical vermilion banner with a black border, completely blank, gently waving. Stylized semi-realistic game art with clean readable shapes suitable for a low-poly game asset, hand-painted matte materials in a Vietnamese lacquer palette (lacquer black, vermilion red, gold, burnt umber, warm ivory, jade green), no heavy black ink outlines, no cracked texture; 13th-century Dai Viet (Vietnam), Tran dynasty, war against the Yuan. Avoid: any text, letters or symbols (including on flags, sails, banners and crates), logos, watermark; modern objects, modern metal hardware or nails; Japanese or Qing-dynasty architecture; people or animals; multiple views; cut-off parts.
```

### Đống lửa trại và giá đuốc

Khung **1:1** · tên gợi ý `dong-lua`

```
3D game environment asset concept for image-to-3D modelling: a single campfire with a torch stand beside it, isolated, three-quarter view from slightly above eye level, the whole object in frame with a small margin, centered, plain flat light-grey background, soft even studio lighting, no cast shadows, no ground plane, no people, no animals, no other objects. A ring of stones with stacked burning logs and an iron tripod with a hanging pot, and a tall wooden torch stand with a flaming torch. Stylized semi-realistic game art with clean readable shapes suitable for a low-poly game asset, hand-painted matte materials in a Vietnamese lacquer palette (lacquer black, vermilion red, gold, burnt umber, warm ivory, jade green), no heavy black ink outlines, no cracked texture; 13th-century Dai Viet (Vietnam), Tran dynasty, war against the Yuan. Avoid: any text, letters or symbols (including on flags, sails, banners and crates), logos, watermark; modern objects, modern metal hardware or nails; Japanese or Qing-dynasty architecture; people or animals; multiple views; cut-off parts.
```

### Xe lương hỏng (B15, dấu chiến trận)

Khung **16:9** · tên gợi ý `xe-luong`

```
3D game environment asset concept for image-to-3D modelling: a single broken wooden supply cart, isolated, three-quarter view from slightly above eye level, the whole object in frame with a small margin, centered, plain flat light-grey background, soft even studio lighting, no cast shadows, no ground plane, no people, no animals, no other objects. A two-wheeled wooden ox cart tipped on one side with a broken wheel, spilled rice sacks. Stylized semi-realistic game art with clean readable shapes suitable for a low-poly game asset, hand-painted matte materials in a Vietnamese lacquer palette (lacquer black, vermilion red, gold, burnt umber, warm ivory, jade green), no heavy black ink outlines, no cracked texture; 13th-century Dai Viet (Vietnam), Tran dynasty, war against the Yuan. Avoid: any text, letters or symbols (including on flags, sails, banners and crates), logos, watermark; modern objects, modern metal hardware or nails; Japanese or Qing-dynasty architecture; people or animals; multiple views; cut-off parts.
```

## Cây, đá

### Cây đa đầu làng (B15, mốc nhận đường)

Khung **1:1** · tên gợi ý `cay-da`

```
3D game environment asset concept for image-to-3D modelling: a single old banyan tree, isolated, three-quarter view at eye level, the whole object in frame with a small margin, centered, plain flat light-grey background, soft even studio lighting, no cast shadows, no ground plane, no people, no animals, no other objects. A huge old banyan tree with a thick gnarled trunk, many hanging aerial roots and a wide dense canopy. Stylized semi-realistic game art with clean readable shapes suitable for a low-poly game asset, hand-painted matte materials in a Vietnamese lacquer palette (lacquer black, vermilion red, gold, burnt umber, warm ivory, jade green), no heavy black ink outlines, no cracked texture; 13th-century Dai Viet (Vietnam), Tran dynasty, war against the Yuan. Avoid: any text, letters or symbols (including on flags, sails, banners and crates), logos, watermark; modern objects, modern metal hardware or nails; Japanese or Qing-dynasty architecture; people or animals; multiple views; cut-off parts.
```

### Khóm tre (lũy tre làng B15)

Khung **3:4** · tên gợi ý `khom-tre`

```
3D game environment asset concept for image-to-3D modelling: a single clump of bamboo, isolated, three-quarter view at eye level, the whole object in frame with a small margin, centered, plain flat light-grey background, soft even studio lighting, no cast shadows, no ground plane, no people, no animals, no other objects. A dense clump of tall green bamboo stems leaning outward, leaves in clusters from mid-height up, drooping tips. Stylized semi-realistic game art with clean readable shapes suitable for a low-poly game asset, hand-painted matte materials in a Vietnamese lacquer palette (lacquer black, vermilion red, gold, burnt umber, warm ivory, jade green), no heavy black ink outlines, no cracked texture; 13th-century Dai Viet (Vietnam), Tran dynasty, war against the Yuan. Avoid: any text, letters or symbols (including on flags, sails, banners and crates), logos, watermark; modern objects, modern metal hardware or nails; Japanese or Qing-dynasty architecture; people or animals; multiple views; cut-off parts.
```

### Cụm cây cau (làng B15)

Khung **3:4** · tên gợi ý `cay-cau`

```
3D game environment asset concept for image-to-3D modelling: a single group of three areca palm trees, isolated, three-quarter view at eye level, the whole object in frame with a small margin, centered, plain flat light-grey background, soft even studio lighting, no cast shadows, no ground plane, no people, no animals, no other objects. Three slender areca palms of different heights with ringed grey trunks and feathery crowns. Stylized semi-realistic game art with clean readable shapes suitable for a low-poly game asset, hand-painted matte materials in a Vietnamese lacquer palette (lacquer black, vermilion red, gold, burnt umber, warm ivory, jade green), no heavy black ink outlines, no cracked texture; 13th-century Dai Viet (Vietnam), Tran dynasty, war against the Yuan. Avoid: any text, letters or symbols (including on flags, sails, banners and crates), logos, watermark; modern objects, modern metal hardware or nails; Japanese or Qing-dynasty architecture; people or animals; multiple views; cut-off parts.
```

### Cột đá vôi (B20, cửa sông)

Khung **3:4** · tên gợi ý `cot-da-voi`

```
3D game environment asset concept for image-to-3D modelling: a single limestone karst pillar, isolated, three-quarter view at eye level, the whole object in frame with a small margin, centered, plain flat light-grey background, soft even studio lighting, no cast shadows, no ground plane, no people, no animals, no other objects. A tall jagged grey limestone pillar with vertical weathering grooves, a wave-cut notch at the base and small shrubs clinging to ledges. Stylized semi-realistic game art with clean readable shapes suitable for a low-poly game asset, hand-painted matte materials in a Vietnamese lacquer palette (lacquer black, vermilion red, gold, burnt umber, warm ivory, jade green), no heavy black ink outlines, no cracked texture; 13th-century Dai Viet (Vietnam), Tran dynasty, war against the Yuan. Avoid: any text, letters or symbols (including on flags, sails, banners and crates), logos, watermark; modern objects, modern metal hardware or nails; Japanese or Qing-dynasty architecture; people or animals; multiple views; cut-off parts.
```

### Cụm sú vẹt (B20, ven sông)

Khung **1:1** · tên gợi ý `su-vet`

```
3D game environment asset concept for image-to-3D modelling: a single cluster of mangrove trees, isolated, three-quarter view at eye level, the whole object in frame with a small margin, centered, plain flat light-grey background, soft even studio lighting, no cast shadows, no ground plane, no people, no animals, no other objects. Low mangrove trees with arching stilt roots, dense dark-green leaves. Stylized semi-realistic game art with clean readable shapes suitable for a low-poly game asset, hand-painted matte materials in a Vietnamese lacquer palette (lacquer black, vermilion red, gold, burnt umber, warm ivory, jade green), no heavy black ink outlines, no cracked texture; 13th-century Dai Viet (Vietnam), Tran dynasty, war against the Yuan. Avoid: any text, letters or symbols (including on flags, sails, banners and crates), logos, watermark; modern objects, modern metal hardware or nails; Japanese or Qing-dynasty architecture; people or animals; multiple views; cut-off parts.
```

### Khóm lau sậy (B15, B20)

Khung **1:1** · tên gợi ý `lau-say`

```
3D game environment asset concept for image-to-3D modelling: a single clump of tall river reeds, isolated, three-quarter view at eye level, the whole object in frame with a small margin, centered, plain flat light-grey background, soft even studio lighting, no cast shadows, no ground plane, no people, no animals, no other objects. Tall reeds with pale feathery plumes, some stems bent. Stylized semi-realistic game art with clean readable shapes suitable for a low-poly game asset, hand-painted matte materials in a Vietnamese lacquer palette (lacquer black, vermilion red, gold, burnt umber, warm ivory, jade green), no heavy black ink outlines, no cracked texture; 13th-century Dai Viet (Vietnam), Tran dynasty, war against the Yuan. Avoid: any text, letters or symbols (including on flags, sails, banners and crates), logos, watermark; modern objects, modern metal hardware or nails; Japanese or Qing-dynasty architecture; people or animals; multiple views; cut-off parts.
```

### Gò đá (B15, giữa hai mặt trận)

Khung **1:1** · tên gợi ý `go-da`

```
3D game environment asset concept for image-to-3D modelling: a single rocky outcrop, isolated, three-quarter view from slightly above eye level, the whole object in frame with a small margin, centered, plain flat light-grey background, soft even studio lighting, no cast shadows, no ground plane, no people, no animals, no other objects. A low cluster of weathered grey-brown boulders with patches of grass and moss. Stylized semi-realistic game art with clean readable shapes suitable for a low-poly game asset, hand-painted matte materials in a Vietnamese lacquer palette (lacquer black, vermilion red, gold, burnt umber, warm ivory, jade green), no heavy black ink outlines, no cracked texture; 13th-century Dai Viet (Vietnam), Tran dynasty, war against the Yuan. Avoid: any text, letters or symbols (including on flags, sails, banners and crates), logos, watermark; modern objects, modern metal hardware or nails; Japanese or Qing-dynasty architecture; people or animals; multiple views; cut-off parts.
```
