# Prompt vẽ các loại lính còn thiếu (để dựng 3D bằng Hunyuan3D)

Sáu loại lính trong game chưa có ảnh nào (`game/js/data/tuning.js` KITS): Thương binh, Cung thủ, Lực sĩ trọng giáp, Cung kỵ của Nguyên;
Giáo binh, Nỏ thủ của Đại Việt. Trang bị và màu lấy đúng theo mô hình low poly đang chạy trong game (`game/js/battle/soldiers.js`
BUILD, bảng màu `PAL` ở `models.js`): Nguyên chàm + xám thép + da thuộc, mũ nhọn; Đại Việt son + đen then + nón lá. Hai phe khác
nhau cả dáng mũ lẫn màu (luật 21.9: phân biệt được qua bộ lọc mù màu).

## Vì sao viết khác prompt comic

Ảnh comic (nét mực đậm, vân nứt sơn mài, tư thế động, nhiều người) dựng 3D ra mô hình dính người bên cạnh và texture in cả nét mực.
Prompt ở đây ép đúng những gì công cụ ảnh → 3D cần:

- **một người, toàn thân, nhìn thẳng**, đứng thẳng **tay chữ A** (cách thân chừng 30°) — dựng xong còn gắn xương được;
- **nền xám nhạt trơn, ánh sáng đều, không bóng đổ** — công cụ tách nền sạch;
- **vũ khí cầm thẳng bên hông**, không chéo trước người — không che thân;
- **bỏ nét mực đen và vân nứt**, giữ bảng màu sơn mài — texture sạch, vẫn hợp tông game.

## Cách dùng

1. Higgsfield, model **Nano Banana Pro**, **2K**, khung **3:4** (Cung kỵ: **1:1**).
2. Muốn trang phục khớp nhân vật đã có thì gắn một ảnh tham chiếu trong thư mục này (Nguyên: `dich-toa-do.jpg`; Đại Việt:
   `linh-dai-viet-dao-khien-1.jpg`) và thêm vào cuối prompt: `Use the reference image only for costume details, not for drawing style or pose.`
3. Loại ngay ảnh có chữ (kể cả chữ Hán trên khiên), giáp samurai, áo nhà Thanh, tóc đuôi sam, hoặc thiếu bàn chân / bàn tay.
4. Hunyuan3D chế độ nhiều góc nhìn (trước / sau / trái): lấy ảnh mặt trước vừa sinh làm ảnh tham chiếu rồi sinh tiếp bằng câu
   `Same character, same outfit, same weapon, same A-pose and same plain light-grey background, seen from directly behind.`
   (đổi `from directly behind` thành `from the left side` cho góc trái).

Nhãn sử liệu: trang phục là **Hư cấu** dựa trên tạo hình chung của game (comic bible + mô hình), không chép một hiện vật cụ thể.

---

## Nguyên · Thương binh (`NG_GIAO`)

```
Full-body 3D game character concept art for image-to-3D modelling: a single Yuan dynasty spearman, front view, standing straight in a relaxed A-pose with arms held about 30 degrees away from the body, feet slightly apart and flat, the whole figure from head to toe in frame with a small margin, centered, eye-level orthographic view, plain flat light-grey background, soft even studio lighting, no cast shadows, no ground, no other people. A sturdy Mongol-led Yuan infantryman with a short black beard, knee-length dark steel-blue quilted robe, steel lamellar armor over the chest with indigo shoulder guards, a round steel helmet with a short spike and a small red knob on top and an indigo cloth neck flap at the back, black leather boots, a small round leather shield strapped to the left forearm held out at his side, a long spear held upright in the right hand beside the body with its butt on the ground and a brown horsehair tassel below the blade. Stylized semi-realistic game art in a Vietnamese lacquer palette (lacquer black, steel grey, indigo, burnt umber, gold accents), clean hand-painted matte materials with clear shape separation, no heavy black ink outlines, no cracked texture, no motion lines; 13th-century Yuan army fighting in Dai Viet. Avoid: any text, letters or symbols on the shield, logos, watermark; blood or gore; Japanese samurai armor, Chinese Qing dynasty clothing, queue hairstyles, firearms, modern objects; weapons crossing in front of the body; cropped feet or hands; multiple views; cartoonish exaggeration.
```

## Nguyên · Cung thủ (`NG_CUNG`)

```
Full-body 3D game character concept art for image-to-3D modelling: a single Yuan dynasty foot archer, front view, standing straight in a relaxed A-pose with arms held about 30 degrees away from the body, feet slightly apart and flat, the whole figure from head to toe in frame with a small margin, centered, eye-level orthographic view, plain flat light-grey background, soft even studio lighting, no cast shadows, no ground, no other people. A lean Yuan archer with a short black beard, long slate grey-blue quilted robe reaching below the knee, a brown leather lamellar vest and leather armored skirt panels, a cap with a wide brown leather fur-trimmed brim and a pointed indigo crown, black boots, a composite recurve bow held in the left hand pointing down at his side, a leather quiver full of arrows on his back. Stylized semi-realistic game art in a Vietnamese lacquer palette (lacquer black, steel grey, indigo, burnt umber, gold accents), clean hand-painted matte materials with clear shape separation, no heavy black ink outlines, no cracked texture, no motion lines; 13th-century Yuan army fighting in Dai Viet. Avoid: any text, letters or symbols, logos, watermark; blood or gore; Japanese samurai armor, Chinese Qing dynasty clothing, queue hairstyles, firearms, modern objects; drawn bowstring or arrow on the string; cropped feet or hands; multiple views; cartoonish exaggeration.
```

## Nguyên · Lực sĩ trọng giáp (`NG_TANK`)

```
Full-body 3D game character concept art for image-to-3D modelling: a single Yuan dynasty heavy infantry brute, front view, standing straight in a relaxed A-pose with arms held about 30 degrees away from the body, feet apart and flat, the whole figure from head to toe in frame with a small margin, centered, eye-level orthographic view, plain flat light-grey background, soft even studio lighting, no cast shadows, no ground, no other people. A huge broad-shouldered warrior about a third bulkier than a normal soldier, covered in heavy steel lamellar armor with a long layered steel plate skirt, black lacquered shoulder guards and bracers, a stern iron face mask with eye slits covering the whole face, a tall black helmet topped with a steel cone and a small gold spike, a brown leather neck guard over the shoulders and a leather back plate, indigo trousers, heavy black boots, a massive iron flanged mace held upright in the right hand at his side, head resting on the ground. Stylized semi-realistic game art in a Vietnamese lacquer palette (lacquer black, steel grey, indigo, burnt umber, gold accents), clean hand-painted matte materials with clear shape separation, no heavy black ink outlines, no cracked texture, no motion lines; 13th-century Yuan army fighting in Dai Viet. Avoid: any text, letters or symbols, logos, watermark; blood or gore; Japanese samurai armor, European plate armor, Chinese Qing dynasty clothing, queue hairstyles, firearms, modern objects; weapons crossing in front of the body; cropped feet or hands; multiple views; cartoonish exaggeration.
```

## Nguyên · Cung kỵ (`NG_KY`) — khung 1:1

```
Full-body 3D game character concept art for image-to-3D modelling: a single Yuan dynasty mounted archer on his horse, three-quarter front view, the horse standing still with all four hooves flat on the ground and head slightly raised, the rider seated upright, the whole horse and rider in frame with a small margin, centered, eye-level view, plain flat light-grey background, soft even studio lighting, no cast shadows, no ground, no other people or horses. A Mongol horse archer with a short black beard, steel lamellar armor over an indigo robe, a round fur-trimmed brown cap with a short steel spike, a composite recurve bow held in the left hand resting on his thigh, the reins in the right hand, a leather quiver of arrows at his hip; a sturdy short-legged brown steppe horse with a dark mane, tail and lower legs, an indigo saddle cloth with brown leather trim and black leather tack. Stylized semi-realistic game art in a Vietnamese lacquer palette (lacquer black, steel grey, indigo, burnt umber, gold accents), clean hand-painted matte materials with clear shape separation, no heavy black ink outlines, no cracked texture, no motion lines; 13th-century Yuan army fighting in Dai Viet. Avoid: any text, letters or symbols, logos, watermark; blood or gore; Japanese samurai armor, Chinese Qing dynasty clothing, queue hairstyles, firearms, modern objects; galloping or rearing horse; drawn bowstring; cropped hooves; multiple views; cartoonish exaggeration.
```

## Đại Việt · Giáo binh (`DV_GIAO`)

```
Full-body 3D game character concept art for image-to-3D modelling: a single Dai Viet spearman of the Tran dynasty, front view, standing straight in a relaxed A-pose with arms held about 30 degrees away from the body, feet slightly apart and flat, the whole figure from head to toe in frame with a small margin, centered, eye-level orthographic view, plain flat light-grey background, soft even studio lighting, no cast shadows, no ground, no other people. A lean young Vietnamese soldier with a clean-shaven determined face, hair tied up, a wide conical hat of woven palm leaf with a black chin band, a knee-length vermilion red tunic with vermilion sleeves and black cuffs, a black lacquered leather lamellar vest, a red cloth sash at the waist, black trousers rolled to the knee with pale straw-coloured cloth leg wraps, black cloth shoes, a long spear held upright in the right hand beside the body with its butt on the ground and a red tassel below the blade. Stylized semi-realistic game art in a Vietnamese lacquer palette (vermilion red, lacquer black, gold, burnt umber, warm ivory), clean hand-painted matte materials with clear shape separation, no heavy black ink outlines, no cracked texture, no motion lines; 13th-century Dai Viet (Vietnam) resisting the Yuan invasion. Avoid: any text, letters or symbols, logos, watermark; blood or gore; Japanese samurai armor, Chinese Qing dynasty clothing, queue hairstyles, firearms, modern objects; weapons crossing in front of the body; cropped feet or hands; multiple views; cartoonish exaggeration.
```

## Đại Việt · Nỏ thủ (`DV_NO`)

```
Full-body 3D game character concept art for image-to-3D modelling: a single Dai Viet crossbowman of the Tran dynasty, front view, standing straight in a relaxed A-pose with arms held about 30 degrees away from the body, feet slightly apart and flat, the whole figure from head to toe in frame with a small margin, centered, eye-level orthographic view, plain flat light-grey background, soft even studio lighting, no cast shadows, no ground, no other people. A wiry Vietnamese soldier with a calm focused face, hair tied up, a tall conical hat of woven palm leaf with a black band at the base, a vermilion red tunic under a light padded quilted cloth vest in pale straw colour with short cloth skirt flaps, a red sash, black trousers with pale cloth leg wraps, black cloth shoes, a wooden crossbow with a bronze trigger held in the right hand pointing down at his side, a small wooden bolt case slung at his back. Stylized semi-realistic game art in a Vietnamese lacquer palette (vermilion red, lacquer black, gold, burnt umber, warm ivory), clean hand-painted matte materials with clear shape separation, no heavy black ink outlines, no cracked texture, no motion lines; 13th-century Dai Viet (Vietnam) resisting the Yuan invasion. Avoid: any text, letters or symbols, logos, watermark; blood or gore; Japanese samurai armor, Chinese Qing dynasty clothing, queue hairstyles, firearms, modern European crossbows, modern objects; weapons crossing in front of the body; cropped feet or hands; multiple views; cartoonish exaggeration.
```

---

## Tùy chọn: hai loại đã có ảnh comic nhưng chưa đúng tư thế

Ảnh comic của Đao thuẫn Nguyên và Đao khiên Đại Việt bị che, mờ hoặc chìm trong sương. Muốn cả bộ lính cùng tư thế để gắn xương chung thì sinh lại:

### Nguyên · Đao thuẫn (`NG_DAO`)

```
Full-body 3D game character concept art for image-to-3D modelling: a single Yuan dynasty sword-and-shield infantryman, front view, standing straight in a relaxed A-pose with arms held about 30 degrees away from the body, feet slightly apart and flat, the whole figure from head to toe in frame with a small margin, centered, eye-level orthographic view, plain flat light-grey background, soft even studio lighting, no cast shadows, no ground, no other people. A stocky Yuan soldier with a short black beard, knee-length indigo quilted robe, steel lamellar armor with steel shoulder guards, a pointed grey felt helmet with a brown fur-trimmed brim and an indigo neck flap, black boots, a round brown leather shield with a black rim and an iron boss, strapped to the left forearm held out at his side, a curved single-edged saber held point-down in the right hand at his side. Stylized semi-realistic game art in a Vietnamese lacquer palette (lacquer black, steel grey, indigo, burnt umber, gold accents), clean hand-painted matte materials with clear shape separation, no heavy black ink outlines, no cracked texture, no motion lines; 13th-century Yuan army fighting in Dai Viet. Avoid: any text, letters or symbols on the shield, logos, watermark; blood or gore; Japanese samurai armor, Chinese Qing dynasty clothing, queue hairstyles, firearms, modern objects; weapons crossing in front of the body; cropped feet or hands; multiple views; cartoonish exaggeration.
```

### Đại Việt · Đao khiên (`DV_DAO`)

```
Full-body 3D game character concept art for image-to-3D modelling: a single Dai Viet sword-and-shield soldier of the Tran dynasty, front view, standing straight in a relaxed A-pose with arms held about 30 degrees away from the body, feet slightly apart and flat, the whole figure from head to toe in frame with a small margin, centered, eye-level orthographic view, plain flat light-grey background, soft even studio lighting, no cast shadows, no ground, no other people. A strong Vietnamese soldier with a clean-shaven face, hair in a topknot under a vermilion cloth head-wrap, a dark crimson tunic, a black lacquered leather lamellar vest and shoulder guards, a red sash, black trousers with pale cloth leg wraps, black cloth shoes, a tall rectangular dark crimson wooden shield with black lacquered bands along the top and bottom edges and a small gold boss, on the left forearm held out at his side, a long single-edged saber held point-down in the right hand at his side. Stylized semi-realistic game art in a Vietnamese lacquer palette (vermilion red, lacquer black, gold, burnt umber, warm ivory), clean hand-painted matte materials with clear shape separation, no heavy black ink outlines, no cracked texture, no motion lines; 13th-century Dai Viet (Vietnam) resisting the Yuan invasion. Avoid: any text, letters or symbols on the shield, logos, watermark; blood or gore; Japanese samurai armor, Chinese Qing dynasty clothing, queue hairstyles, firearms, modern objects; weapons crossing in front of the body; cropped feet or hands; multiple views; cartoonish exaggeration.
```
