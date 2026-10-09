# Prompt vẽ các tướng (thời Trần) để dựng 3D

Phạm vi: **Quyển Nhà Trần (E6)** — đúng phần game đang làm (bản VS và đợt R1). 14 tướng Đại Việt H27–H40, đồng minh quân Tống lưu vong,
10 tướng Mông Cổ / Nguyên X16–X25 và hai bậc sĩ quan Nguyên dùng chung. Các thời đại khác (56 tướng Việt, 35 tướng địch trong canon) làm
sau, theo từng thời đại khi game dựng tới.

Nguồn mô tả: `comic/_shared/bible.json` (Trần Hưng Đạo, Trần Khánh Dư, Yết Kiêu, Ô Mã Nhi, Thoát Hoan, Trần Quốc Toản, Toa Đô — giữ
nguyên câu tả để mặt khớp comic), `comic/B15-ham-tu/PROMPTS.md` (Trần Nhật Duật, Triệu Trung), `design/canon.json` (tuổi theo năm
trận, binh khí riêng, lớp vũ khí, ghi chú "dignity" của tướng địch), `game/js/battle/models.js` RIGS (màu áo, áo choàng, mũ của các rig
đang chạy). **Diện mạo là Hư cấu** — sử không tả mặt mũi; nhãn ở mỗi mục là nhãn của binh khí theo canon.

Tướng địch tả đúng "dignity" của canon: đối thủ có danh dự, không biếm họa.

## Cách dùng

Như `PROMPTS-LINH.md`: Higgsfield, Nano Banana Pro, 2K, đúng khung ghi ở mỗi mục. Một người, toàn thân, nhìn thẳng, tay chữ A, binh khí
cầm thẳng bên hông, nền xám trơn, không nét mực — để Hunyuan3D tách nền sạch và dựng xong gắn xương được. Tướng đã có mặt trong comic thì gắn
ảnh tham chiếu: tờ nhân vật comic nếu máy bạn còn giữ (`comic/_shared/refs/`, cố ý không đưa lên git), không thì ảnh cắt trong thư mục này
(`tuong-*.jpg`, `dich-*.jpg`); thêm vào cuối prompt `Use the reference image only for the face and costume, not for drawing style or pose.`
Tướng cưỡi ngựa / voi (khung 1:1): Hunyuan3D dựng người và thú thành một khối; muốn tách để gắn xương riêng thì sinh thêm bản người đứng
(đổi đầu prompt thành khung đứng tay chữ A của các mục khác).

## Đại Việt

### H27 · Trần Thái Tông — vua, kiếm và khiên mây (B12, B13)

Khung **3:4** · binh khí Hư cấu (Ngự kiếm Thiên Mạc)

```
Full-body 3D game character concept art for image-to-3D modelling: a single Dai Viet emperor leading his army in person, Emperor Tran Thai Tong, front view, standing straight in a relaxed A-pose with arms held about 30 degrees away from the body, feet slightly apart and flat, the whole figure from head to toe in frame with a small margin, centered, eye-level orthographic view, plain flat light-grey background, soft even studio lighting, no cast shadows, no ground, no other people. A Vietnamese emperor of about forty, calm and resolute face, short black beard and moustache, hair in a topknot under a small black silk cap with a gold ornament, a dark vermilion war robe with subtle gold cloud patterns under black lacquered lamellar armor with gold edging, a gold-trimmed belt, black leather boots, a straight sword with a wave pattern engraved along the blade held point-down in the right hand at his side, a round woven rattan shield lacquered vermilion on the left forearm held out at his side. Stylized semi-realistic game art in a Vietnamese lacquer palette (vermilion red, lacquer black, gold, burnt umber, jade green, warm ivory), clean hand-painted matte materials with clear shape separation, no heavy black ink outlines, no cracked texture, no motion lines; 13th-century Dai Viet (Vietnam), Tran dynasty. Avoid: any text, letters or symbols (including on banners, shields and fans), logos, watermark; blood, gore or wounds; Japanese samurai armor, Chinese Qing dynasty clothing, queue hairstyles, firearms, modern objects; weapons crossing in front of the body; cropped feet, hands or hooves; multiple views; caricature or cartoonish exaggeration.
```

### H28 · Trần Thủ Độ — Thái sư, cờ lệnh có mũi giáo (B13)

Khung **3:4** · binh khí Hư cấu (Đại kỳ Thái sư)

```
Full-body 3D game character concept art for image-to-3D modelling: a single elderly Dai Viet grand chancellor in war gear, Tran Thu Do, front view, standing straight in a relaxed A-pose with arms held about 30 degrees away from the body, feet slightly apart and flat, the whole figure from head to toe in frame with a small margin, centered, eye-level orthographic view, plain flat light-grey background, soft even studio lighting, no cast shadows, no ground, no other people. A Vietnamese statesman in his sixties, lean and upright, stern iron-willed face, grey moustache and long thin grey beard, hair in a topknot under a black silk cap, a black court robe with dark red trim worn under black lacquered lamellar armor, black leather boots, holding upright in the right hand beside his body a 3-metre iron-shafted command banner-spear: a spear tip on top and a plain black banner with a red border hanging from the pole (the banner completely blank). Stylized semi-realistic game art in a Vietnamese lacquer palette (vermilion red, lacquer black, gold, burnt umber, jade green, warm ivory), clean hand-painted matte materials with clear shape separation, no heavy black ink outlines, no cracked texture, no motion lines; 13th-century Dai Viet (Vietnam), Tran dynasty. Avoid: any text, letters or symbols (including on banners, shields and fans), logos, watermark; blood, gore or wounds; Japanese samurai armor, Chinese Qing dynasty clothing, queue hairstyles, firearms, modern objects; weapons crossing in front of the body; cropped feet, hands or hooves; multiple views; caricature or cartoonish exaggeration.
```

### H29 · Lê Phụ Trần — tấm ván thuyền làm khiên (B12)

Khung **3:4** · Chính sử (ván thuyền che vua) + Hư cấu (dáng binh khí)

```
Full-body 3D game character concept art for image-to-3D modelling: a single Dai Viet bodyguard general, Le Phu Tran, front view, standing straight in a relaxed A-pose with arms held about 30 degrees away from the body, feet slightly apart and flat, the whole figure from head to toe in frame with a small margin, centered, eye-level orthographic view, plain flat light-grey background, soft even studio lighting, no cast shadows, no ground, no other people. A sturdy watchful Vietnamese general in his thirties, short black beard, black cloth head-wrap, a dark brown tunic under dark brown lacquered leather lamellar armor, red sash, black boots, a shield made from a rough wooden boat plank with added iron grips and a few arrows stuck in it strapped to the left forearm held out at his side, a short single-edged sword held point-down in the right hand at his side. Stylized semi-realistic game art in a Vietnamese lacquer palette (vermilion red, lacquer black, gold, burnt umber, jade green, warm ivory), clean hand-painted matte materials with clear shape separation, no heavy black ink outlines, no cracked texture, no motion lines; 13th-century Dai Viet (Vietnam), Tran dynasty. Avoid: any text, letters or symbols (including on banners, shields and fans), logos, watermark; blood, gore or wounds; Japanese samurai armor, Chinese Qing dynasty clothing, queue hairstyles, firearms, modern objects; weapons crossing in front of the body; cropped feet, hands or hooves; multiple views; caricature or cartoonish exaggeration.
```

### H30 · Trần Nhân Tông — vua, bút lông và quạt (B17)

Khung **3:4** · binh khí Hư cấu (Bút ngự Thiên Trường)

```
Full-body 3D game character concept art for image-to-3D modelling: a single young Dai Viet emperor commanding in the field, Emperor Tran Nhan Tong, front view, standing straight in a relaxed A-pose with arms held about 30 degrees away from the body, feet slightly apart and flat, the whole figure from head to toe in frame with a small margin, centered, eye-level orthographic view, plain flat light-grey background, soft even studio lighting, no cast shadows, no ground, no other people. A Vietnamese emperor around thirty, serene, scholarly and warm face, thin moustache, hair in a topknot under a black silk cap with a small gold ornament, a dark vermilion imperial robe with gold borders under light gold-edged black lacquered lamellar armor, a jade belt, black boots, a large writing brush with a jade handle held in the right hand at his side, a closed folding fan of plain ivory paper in the left hand at his side, a small round drum hanging at his hip. Stylized semi-realistic game art in a Vietnamese lacquer palette (vermilion red, lacquer black, gold, burnt umber, jade green, warm ivory), clean hand-painted matte materials with clear shape separation, no heavy black ink outlines, no cracked texture, no motion lines; 13th-century Dai Viet (Vietnam), Tran dynasty. Avoid: any text, letters or symbols (including on banners, shields and fans), logos, watermark; blood, gore or wounds; Japanese samurai armor, Chinese Qing dynasty clothing, queue hairstyles, firearms, modern objects; weapons crossing in front of the body; cropped feet, hands or hooves; multiple views; caricature or cartoonish exaggeration.
```

### H31 · Trần Hưng Đạo — đại kiếm Tiết chế (B18, B20)

Khung **3:4** · binh khí Hư cấu (Gươm Tiết chế)

```
Full-body 3D game character concept art for image-to-3D modelling: a single Dai Viet supreme commander, Tran Hung Dao, front view, standing straight in a relaxed A-pose with arms held about 30 degrees away from the body, feet slightly apart and flat, the whole figure from head to toe in frame with a small margin, centered, eye-level orthographic view, plain flat light-grey background, soft even studio lighting, no cast shadows, no ground, no other people. Tran Hung Dao, supreme commander of Dai Viet, about 60 years old, dignified and calm, long black beard streaked with grey, sharp thoughtful eyes, black cloth head-wrap, dark red lacquered lamellar armor with gold trim and a gold breast disc over a black robe, a narrow short vermilion cape that does not hide the armor, black boots, a broad two-handed straight greatsword with a red cord-wrapped hilt held point-down in the right hand at his side. Stylized semi-realistic game art in a Vietnamese lacquer palette (vermilion red, lacquer black, gold, burnt umber, jade green, warm ivory), clean hand-painted matte materials with clear shape separation, no heavy black ink outlines, no cracked texture, no motion lines; 13th-century Dai Viet (Vietnam), Tran dynasty. Avoid: any text, letters or symbols (including on banners, shields and fans), logos, watermark; blood, gore or wounds; Japanese samurai armor, Chinese Qing dynasty clothing, queue hairstyles, firearms, modern objects; weapons crossing in front of the body; cropped feet, hands or hooves; multiple views; caricature or cartoonish exaggeration.
```

### H32 · Trần Quang Khải — cung sừng, tên lệnh có còi (B16)

Khung **3:4** · binh khí Hư cấu (Cung Chiêu Minh)

```
Full-body 3D game character concept art for image-to-3D modelling: a single Dai Viet royal prince and archer-commander, Tran Quang Khai, front view, standing straight in a relaxed A-pose with arms held about 30 degrees away from the body, feet slightly apart and flat, the whole figure from head to toe in frame with a small margin, centered, eye-level orthographic view, plain flat light-grey background, soft even studio lighting, no cast shadows, no ground, no other people. A Vietnamese prince-general in his forties with a noble poet-warrior bearing, neat moustache and short beard, topknot under a black silk cap with a gold pin, a dark jade-green robe under black lacquered lamellar armor with gold edging, black boots, a long horn composite bow held in the left hand pointing down at his side, a quiver on his back holding arrows with small carved whistle heads. Stylized semi-realistic game art in a Vietnamese lacquer palette (vermilion red, lacquer black, gold, burnt umber, jade green, warm ivory), clean hand-painted matte materials with clear shape separation, no heavy black ink outlines, no cracked texture, no motion lines; 13th-century Dai Viet (Vietnam), Tran dynasty. Avoid: any text, letters or symbols (including on banners, shields and fans), logos, watermark; blood, gore or wounds; Japanese samurai armor, Chinese Qing dynasty clothing, queue hairstyles, firearms, modern objects; weapons crossing in front of the body; cropped feet, hands or hooves; multiple views; caricature or cartoonish exaggeration.
```

### H33 · Trần Nhật Duật — quạt Chiêu Văn (B15)

Khung **3:4** · binh khí Hư cấu (Quạt Chiêu Văn)

```
Full-body 3D game character concept art for image-to-3D modelling: a single Dai Viet scholar-general, Prince Chieu Van Tran Nhat Duat, front view, standing straight in a relaxed A-pose with arms held about 30 degrees away from the body, feet slightly apart and flat, the whole figure from head to toe in frame with a small margin, centered, eye-level orthographic view, plain flat light-grey background, soft even studio lighting, no cast shadows, no ground, no other people. Tran Nhat Duat, about 30 years old, a scholar-general with a calm, warm and quick-witted face, thin neat moustache and short goatee, hair in a topknot under a small black silk cap, a jade-green brocade robe worn over light gold-edged dark lacquered lamellar armor, a jade belt, black boots, a large closed folding fan of split bamboo and plain ivory paper held in the right hand at his side. Stylized semi-realistic game art in a Vietnamese lacquer palette (vermilion red, lacquer black, gold, burnt umber, jade green, warm ivory), clean hand-painted matte materials with clear shape separation, no heavy black ink outlines, no cracked texture, no motion lines; 13th-century Dai Viet (Vietnam), Tran dynasty. Avoid: any text, letters or symbols (including on banners, shields and fans), logos, watermark; blood, gore or wounds; Japanese samurai armor, Chinese Qing dynasty clothing, queue hairstyles, firearms, modern objects; weapons crossing in front of the body; cropped feet, hands or hooves; multiple views; caricature or cartoonish exaggeration.
```

### H34 · Trần Khánh Dư — đại kiếm Vân Đồn (B19, B20)

Khung **3:4** · binh khí Hư cấu (gợi từ quãng đời bán than)

```
Full-body 3D game character concept art for image-to-3D modelling: a single Dai Viet naval general, Tran Khanh Du, front view, standing straight in a relaxed A-pose with arms held about 30 degrees away from the body, feet slightly apart and flat, the whole figure from head to toe in frame with a small margin, centered, eye-level orthographic view, plain flat light-grey background, soft even studio lighting, no cast shadows, no ground, no other people. Tran Khanh Du, weathered broad-shouldered Vietnamese general in his forties, sun-darkened skin, short beard, rugged and fierce, black cloth head-wrap, dark brown lacquered lamellar armor over a dark tunic, black boots, a heavy two-handed greatsword with a thick blade, an iron-clad spine and a hilt wrapped in charcoal-dusted hemp cord, held point-down in the right hand at his side. Stylized semi-realistic game art in a Vietnamese lacquer palette (vermilion red, lacquer black, gold, burnt umber, jade green, warm ivory), clean hand-painted matte materials with clear shape separation, no heavy black ink outlines, no cracked texture, no motion lines; 13th-century Dai Viet (Vietnam), Tran dynasty. Avoid: any text, letters or symbols (including on banners, shields and fans), logos, watermark; blood, gore or wounds; Japanese samurai armor, Chinese Qing dynasty clothing, queue hairstyles, firearms, modern objects; weapons crossing in front of the body; cropped feet, hands or hooves; multiple views; caricature or cartoonish exaggeration.
```

### H35 · Trần Quốc Toản — song đao, cờ sáu chữ (B15)

Khung **3:4** · Chính sử (lá cờ) + Hư cấu (song đao)

```
Full-body 3D game character concept art for image-to-3D modelling: a single young Dai Viet noble warrior, Tran Quoc Toan, front view, standing straight in a relaxed A-pose with arms held about 30 degrees away from the body, feet slightly apart and flat, the whole figure from head to toe in frame with a small margin, centered, eye-level orthographic view, plain flat light-grey background, soft even studio lighting, no cast shadows, no ground, no other people. Tran Quoc Toan, a very young noble of the Tran royal clan in his late teens, slim, light and quick on his feet, a boyish beardless face with fierce bright eyes and a set jaw, black hair tied in a topknot under a vermilion cloth head-band whose ends trail behind, a dark vermilion knee-length tunic under a black lacquered leather lamellar vest with thin gold edging, dark trousers with cloth-wrapped shins and straw sandals, a short single-edged saber with a red silk tassel held point-down in each hand at his sides, and a tall red banner with six plain empty gold squares in a single vertical column on a bamboo pole strapped to his back. Stylized semi-realistic game art in a Vietnamese lacquer palette (vermilion red, lacquer black, gold, burnt umber, jade green, warm ivory), clean hand-painted matte materials with clear shape separation, no heavy black ink outlines, no cracked texture, no motion lines; 13th-century Dai Viet (Vietnam), Tran dynasty. Avoid: any text, letters or symbols (including on banners, shields and fans), logos, watermark; blood, gore or wounds; Japanese samurai armor, Chinese Qing dynasty clothing, queue hairstyles, firearms, modern objects; weapons crossing in front of the body; cropped feet, hands or hooves; multiple views; caricature or cartoonish exaggeration.
```

### H36 · Trần Bình Trọng — giáo gỗ lim (B14)

Khung **3:4** · binh khí Hư cấu (Giáo Bảo Nghĩa)

```
Full-body 3D game character concept art for image-to-3D modelling: a single young Dai Viet general, Tran Binh Trong, front view, standing straight in a relaxed A-pose with arms held about 30 degrees away from the body, feet slightly apart and flat, the whole figure from head to toe in frame with a small margin, centered, eye-level orthographic view, plain flat light-grey background, soft even studio lighting, no cast shadows, no ground, no other people. A Vietnamese noble general in his mid-twenties, upright and defiant bearing, clean-shaven with a light moustache, black cloth head-wrap, a dark red tunic under black lacquered lamellar armor with bronze studs, black boots, a 2.5-metre ironwood spear with a bronze-capped butt held upright in the right hand beside his body, butt on the ground. Stylized semi-realistic game art in a Vietnamese lacquer palette (vermilion red, lacquer black, gold, burnt umber, jade green, warm ivory), clean hand-painted matte materials with clear shape separation, no heavy black ink outlines, no cracked texture, no motion lines; 13th-century Dai Viet (Vietnam), Tran dynasty. Avoid: any text, letters or symbols (including on banners, shields and fans), logos, watermark; blood, gore or wounds; Japanese samurai armor, Chinese Qing dynasty clothing, queue hairstyles, firearms, modern objects; weapons crossing in front of the body; cropped feet, hands or hooves; multiple views; caricature or cartoonish exaggeration.
```

### H37 · Phạm Ngũ Lão — ngọn sóc cán tre (B18)

Khung **3:4** · Chính sử (thơ Thuật hoài) + Hư cấu (hình dáng)

```
Full-body 3D game character concept art for image-to-3D modelling: a single Dai Viet general of common birth, Pham Ngu Lao, front view, standing straight in a relaxed A-pose with arms held about 30 degrees away from the body, feet slightly apart and flat, the whole figure from head to toe in frame with a small margin, centered, eye-level orthographic view, plain flat light-grey background, soft even studio lighting, no cast shadows, no ground, no other people. A strong earnest Vietnamese general around thirty with a farmer's broad hands, short beard, black cloth head-wrap, a plain dark brown tunic under black lacquered lamellar armor, red sash, black boots, a very long lance with a thick bamboo shaft and a long leaf-shaped blade held upright in the right hand beside his body, butt on the ground. Stylized semi-realistic game art in a Vietnamese lacquer palette (vermilion red, lacquer black, gold, burnt umber, jade green, warm ivory), clean hand-painted matte materials with clear shape separation, no heavy black ink outlines, no cracked texture, no motion lines; 13th-century Dai Viet (Vietnam), Tran dynasty. Avoid: any text, letters or symbols (including on banners, shields and fans), logos, watermark; blood, gore or wounds; Japanese samurai armor, Chinese Qing dynasty clothing, queue hairstyles, firearms, modern objects; weapons crossing in front of the body; cropped feet, hands or hooves; multiple views; caricature or cartoonish exaggeration.
```

### H38 · Yết Kiêu — dùi đục, đoản đao, cuộn dây (B20)

Khung **3:4** · Tương truyền

```
Full-body 3D game character concept art for image-to-3D modelling: a single Dai Viet naval diver, Yet Kieu, front view, standing straight in a relaxed A-pose with arms held about 30 degrees away from the body, feet slightly apart and flat, the whole figure from head to toe in frame with a small margin, centered, eye-level orthographic view, plain flat light-grey background, soft even studio lighting, no cast shadows, no ground, no other people. Yet Kieu, lean young Vietnamese naval diver, bare-chested and sinewy, short hair tied back with a cloth band, dark knee-length trousers, barefoot, a coiled rope over one shoulder, a pouch of cloth plugs at the waist, an iron chisel held in the right hand at his side and a short knife in the left hand at his side. Stylized semi-realistic game art in a Vietnamese lacquer palette (vermilion red, lacquer black, gold, burnt umber, jade green, warm ivory), clean hand-painted matte materials with clear shape separation, no heavy black ink outlines, no cracked texture, no motion lines; 13th-century Dai Viet (Vietnam), Tran dynasty. Avoid: any text, letters or symbols (including on banners, shields and fans), logos, watermark; blood, gore or wounds; Japanese samurai armor, Chinese Qing dynasty clothing, queue hairstyles, firearms, modern objects; weapons crossing in front of the body; cropped feet, hands or hooves; multiple views; caricature or cartoonish exaggeration.
```

### H39 · Dã Tượng — voi chiến (B18) — khung 1:1

Khung **1:1** · Tương truyền

```
Full-body 3D game character concept art for image-to-3D modelling: a single Dai Viet war-elephant commander, Da Tuong, riding his war elephant, three-quarter front view, the elephant standing still with all four feet flat on the ground, the rider seated upright, the whole elephant and rider in frame with a small margin, centered, eye-level view, plain flat light-grey background, soft even studio lighting, no cast shadows, no ground, no other people or animals. A tough Vietnamese man in his thirties with a short beard and black head-wrap, black lacquered leather lamellar vest over a dark tunic, seated on the elephant's neck holding an elephant goad hook in the right hand and a short spear in the left; a large Asian war elephant with a wooden howdah on its back, bronze caps on its tusks, a vermilion and black lacquered head cloth with gold trim, leather straps. Stylized semi-realistic game art in a Vietnamese lacquer palette (vermilion red, lacquer black, gold, burnt umber, jade green, warm ivory), clean hand-painted matte materials with clear shape separation, no heavy black ink outlines, no cracked texture, no motion lines; 13th-century Dai Viet (Vietnam), Tran dynasty. Avoid: any text, letters or symbols (including on banners, shields and fans), logos, watermark; blood, gore or wounds; Japanese samurai armor, Chinese Qing dynasty clothing, queue hairstyles, firearms, modern objects; weapons crossing in front of the body; cropped feet, hands or hooves; multiple views; caricature or cartoonish exaggeration.
```

### H40 · Nguyễn Khoái — cung lớn, tên móc dây (B17)

Khung **3:4** · binh khí Hư cấu (Cung Thánh Dực)

```
Full-body 3D game character concept art for image-to-3D modelling: a single Dai Viet guard general and archer, Nguyen Khoai, front view, standing straight in a relaxed A-pose with arms held about 30 degrees away from the body, feet slightly apart and flat, the whole figure from head to toe in frame with a small margin, centered, eye-level orthographic view, plain flat light-grey background, soft even studio lighting, no cast shadows, no ground, no other people. A keen-eyed veteran Vietnamese general in his mid-forties, short beard, a black lacquered general's helmet with a small red plume, a dark olive-green robe under black lacquered lamellar armor with gold trim, a dark crimson cape, black boots, a large horn bow held in the left hand pointing down at his side, a quiver of heavy arrows and a few hooked arrows tied to coiled rope on his back. Stylized semi-realistic game art in a Vietnamese lacquer palette (vermilion red, lacquer black, gold, burnt umber, jade green, warm ivory), clean hand-painted matte materials with clear shape separation, no heavy black ink outlines, no cracked texture, no motion lines; 13th-century Dai Viet (Vietnam), Tran dynasty. Avoid: any text, letters or symbols (including on banners, shields and fans), logos, watermark; blood, gore or wounds; Japanese samurai armor, Chinese Qing dynasty clothing, queue hairstyles, firearms, modern objects; weapons crossing in front of the body; cropped feet, hands or hooves; multiple views; caricature or cartoonish exaggeration.
```

## Đồng minh: quân Tống lưu vong

### TT · Triệu Trung — gia tướng quân Tống lưu vong (B15)

Khung **3:4** · Chính sử (người) + Hư cấu (trang phục)

```
Full-body 3D game character concept art for image-to-3D modelling: a single exiled Southern Song officer serving Dai Viet, Zhao Zhong, front view, standing straight in a relaxed A-pose with arms held about 30 degrees away from the body, feet slightly apart and flat, the whole figure from head to toe in frame with a small margin, centered, eye-level orthographic view, plain flat light-grey background, soft even studio lighting, no cast shadows, no ground, no other people. Zhao Zhong, an exiled Southern Song officer in his forties, lean weathered face with a trimmed moustache and short beard, grave and steady eyes, black cloth head-wrap knotted at the back, knee-length round-collared dark ochre robe under a worn brown leather lamellar cuirass with shoulder guards, a jade-green scarf knotted at the neck, black boots, a recurve bow held in the left hand pointing down at his side, a quiver at the hip, a straight sword at his belt — an honorable ally. Stylized semi-realistic game art in a Vietnamese lacquer palette (vermilion red, lacquer black, gold, burnt umber, jade green, warm ivory), clean hand-painted matte materials with clear shape separation, no heavy black ink outlines, no cracked texture, no motion lines; 13th-century Dai Viet (Vietnam), Tran dynasty. Avoid: any text, letters or symbols (including on banners, shields and fans), logos, watermark; blood, gore or wounds; Japanese samurai armor, Chinese Qing dynasty clothing, queue hairstyles, firearms, modern objects; weapons crossing in front of the body; cropped feet, hands or hooves; multiple views; caricature or cartoonish exaggeration.
```

### TONG · Cung thủ quân Tống lưu vong — 'áo Tống' (B15, Kế Sách Cờ áo Tống)

Khung **3:4** · Chính sử (Toàn thư) + Hư cấu (trang phục)

```
Full-body 3D game character concept art for image-to-3D modelling: a single exiled Southern Song archer serving in a Dai Viet prince's household army, front view, standing straight in a relaxed A-pose with arms held about 30 degrees away from the body, feet slightly apart and flat, the whole figure from head to toe in frame with a small margin, centered, eye-level orthographic view, plain flat light-grey background, soft even studio lighting, no cast shadows, no ground, no other people. A Han Chinese foot archer in his thirties, short beard, black cloth head-wrap, a knee-length round-collared dark ochre Song-style robe belted at the waist, a brown leather vest, a jade-green scarf, cloth leg wraps and black cloth shoes, a recurve bow held in the left hand pointing down at his side, a quiver of arrows on his back. Stylized semi-realistic game art in a Vietnamese lacquer palette (vermilion red, lacquer black, gold, burnt umber, jade green, warm ivory), clean hand-painted matte materials with clear shape separation, no heavy black ink outlines, no cracked texture, no motion lines; 13th-century Dai Viet (Vietnam), Tran dynasty. Avoid: any text, letters or symbols (including on banners, shields and fans), logos, watermark; blood, gore or wounds; Japanese samurai armor, Chinese Qing dynasty clothing, queue hairstyles, firearms, modern objects; weapons crossing in front of the body; cropped feet, hands or hooves; multiple views; caricature or cartoonish exaggeration.
```

## Mông Cổ và nhà Nguyên

### X16 · Ngột Lương Hợp Thai — lão soái Mông Cổ, cưỡi ngựa bắn cung (B12, B13) — khung 1:1

Khung **1:1** · Hư cấu (diện mạo)

```
Full-body 3D game character concept art for image-to-3D modelling: a single veteran Mongol marshal on horseback, Uriyangkhadai, three-quarter front view, the horse standing still with all four hooves flat on the ground, the rider seated upright, the whole horse and rider in frame with a small margin, centered, eye-level view, plain flat light-grey background, soft even studio lighting, no cast shadows, no ground, no other people or animals. A Mongol marshal in his late fifties, weathered steppe face, long grey moustache and thin grey beard, braided hair under a conical steel helmet with fur trim and leather neck flaps, heavy lamellar armor over a dark brown deel robe, a fur-trimmed cloak, a composite bow held in the left hand resting on his thigh, the reins in the right hand, a quiver and a saber at his hip; a sturdy short-legged dun steppe horse with black leather tack and a dark saddle cloth. Stylized semi-realistic game art in a Vietnamese lacquer palette (lacquer black, steel grey, indigo, burnt umber, gold accents), clean hand-painted matte materials with clear shape separation, no heavy black ink outlines, no cracked texture, no motion lines; 13th-century Mongol and Yuan armies fighting in Dai Viet, portrayed with dignity as a worthy opponent. Avoid: any text, letters or symbols (including on banners, shields and fans), logos, watermark; blood, gore or wounds; Japanese samurai armor, Chinese Qing dynasty clothing, queue hairstyles, firearms, modern objects; weapons crossing in front of the body; cropped feet, hands or hooves; multiple views; caricature or cartoonish exaggeration.
```

### X17 · A Truật — tướng trẻ Mông Cổ, giáo kỵ (B12, B13)

Khung **3:4** · Hư cấu (diện mạo)

```
Full-body 3D game character concept art for image-to-3D modelling: a single young Mongol general, Aju, front view, standing straight in a relaxed A-pose with arms held about 30 degrees away from the body, feet slightly apart and flat, the whole figure from head to toe in frame with a small margin, centered, eye-level orthographic view, plain flat light-grey background, soft even studio lighting, no cast shadows, no ground, no other people. A bold spirited Mongol general around thirty, confident eyes, short moustache, braided hair under a conical steel helmet with fur trim and a red tassel, steel lamellar armor over an indigo deel robe, leather boots, a long lance with a hooked blade and a horsehair tassel held upright in the right hand beside his body, butt on the ground, a saber at his hip. Stylized semi-realistic game art in a Vietnamese lacquer palette (lacquer black, steel grey, indigo, burnt umber, gold accents), clean hand-painted matte materials with clear shape separation, no heavy black ink outlines, no cracked texture, no motion lines; 13th-century Mongol and Yuan armies fighting in Dai Viet, portrayed with dignity as a worthy opponent. Avoid: any text, letters or symbols (including on banners, shields and fans), logos, watermark; blood, gore or wounds; Japanese samurai armor, Chinese Qing dynasty clothing, queue hairstyles, firearms, modern objects; weapons crossing in front of the body; cropped feet, hands or hooves; multiple views; caricature or cartoonish exaggeration.
```

### X18 · Thoát Hoan — Trấn Nam vương, kích mạ vàng (B16, B18, B20)

Khung **3:4** · Hư cấu (diện mạo)

```
Full-body 3D game character concept art for image-to-3D modelling: a single Yuan prince and commander-in-chief, Toghon, front view, standing straight in a relaxed A-pose with arms held about 30 degrees away from the body, feet slightly apart and flat, the whole figure from head to toe in frame with a small margin, centered, eye-level orthographic view, plain flat light-grey background, soft even studio lighting, no cast shadows, no ground, no other people. Toghon, Yuan prince, Mongol noble in his thirties, stern and weary expression, short moustache, a fur-trimmed brocade robe in deep blue and gold over gilded lamellar armor, a round helmet with fur trim and a gold finial, leather boots, a gilded long-hafted halberd held upright in the right hand beside his body, butt on the ground. Stylized semi-realistic game art in a Vietnamese lacquer palette (lacquer black, steel grey, indigo, burnt umber, gold accents), clean hand-painted matte materials with clear shape separation, no heavy black ink outlines, no cracked texture, no motion lines; 13th-century Mongol and Yuan armies fighting in Dai Viet, portrayed with dignity as a worthy opponent. Avoid: any text, letters or symbols (including on banners, shields and fans), logos, watermark; blood, gore or wounds; Japanese samurai armor, Chinese Qing dynasty clothing, queue hairstyles, firearms, modern objects; weapons crossing in front of the body; cropped feet, hands or hooves; multiple views; caricature or cartoonish exaggeration.
```

### X19 · Toa Đô — đại tướng, rìu lớn (B15, B17)

Khung **3:4** · Hư cấu (diện mạo)

```
Full-body 3D game character concept art for image-to-3D modelling: a single Yuan marshal, Sogetu, front view, standing straight in a relaxed A-pose with arms held about 30 degrees away from the body, feet slightly apart and flat, the whole figure from head to toe in frame with a small margin, centered, eye-level orthographic view, plain flat light-grey background, soft even studio lighting, no cast shadows, no ground, no other people. Sogetu, Yuan marshal of the Jalair Mongol clan, a veteran commander in his fifties hardened by years of campaigning in the far south, weather-beaten face, grey-streaked moustache and beard, heavy iron lamellar armor dulled and scuffed by long marches, fur-trimmed round helmet with a dark plume, a long dark cloak, leather boots, a long-hafted great axe held upright in the right hand beside his body with its head resting on the ground — loyal and unyielding. Stylized semi-realistic game art in a Vietnamese lacquer palette (lacquer black, steel grey, indigo, burnt umber, gold accents), clean hand-painted matte materials with clear shape separation, no heavy black ink outlines, no cracked texture, no motion lines; 13th-century Mongol and Yuan armies fighting in Dai Viet, portrayed with dignity as a worthy opponent. Avoid: any text, letters or symbols (including on banners, shields and fans), logos, watermark; blood, gore or wounds; Japanese samurai armor, Chinese Qing dynasty clothing, queue hairstyles, firearms, modern objects; weapons crossing in front of the body; cropped feet, hands or hooves; multiple views; caricature or cartoonish exaggeration.
```

### X20 · Ô Mã Nhi — thủy tướng, đại đao (B14–B20)

Khung **3:4** · Hư cấu (diện mạo)

```
Full-body 3D game character concept art for image-to-3D modelling: a single Yuan admiral, Omar, front view, standing straight in a relaxed A-pose with arms held about 30 degrees away from the body, feet slightly apart and flat, the whole figure from head to toe in frame with a small margin, centered, eye-level orthographic view, plain flat light-grey background, soft even studio lighting, no cast shadows, no ground, no other people. Omar, Yuan admiral of Central Asian origin, in his forties, full dark beard, proud and disciplined bearing, ornate black lamellar armor with gold trim over a dark robe, a fur-trimmed round helmet with a red plume, a heavy dark red cloak, leather boots, a long-hafted single-edged glaive held upright in the right hand beside his body, butt on the ground. Stylized semi-realistic game art in a Vietnamese lacquer palette (lacquer black, steel grey, indigo, burnt umber, gold accents), clean hand-painted matte materials with clear shape separation, no heavy black ink outlines, no cracked texture, no motion lines; 13th-century Mongol and Yuan armies fighting in Dai Viet, portrayed with dignity as a worthy opponent. Avoid: any text, letters or symbols (including on banners, shields and fans), logos, watermark; blood, gore or wounds; Japanese samurai armor, Chinese Qing dynasty clothing, queue hairstyles, firearms, modern objects; weapons crossing in front of the body; cropped feet, hands or hooves; multiple views; caricature or cartoonish exaggeration.
```

### X21 · Lý Hằng — lão tướng Đảng Hạng, cưỡi ngựa bắn cung (B18) — khung 1:1

Khung **1:1** · Hư cấu (diện mạo)

```
Full-body 3D game character concept art for image-to-3D modelling: a single veteran Yuan general of Tangut royal descent on horseback, Li Heng, three-quarter front view, the horse standing still with all four hooves flat on the ground, the rider seated upright, the whole horse and rider in frame with a small margin, centered, eye-level view, plain flat light-grey background, soft even studio lighting, no cast shadows, no ground, no other people or animals. A lean Tangut-born general in his late forties, grey-streaked beard, calm steady eyes, a round steel helmet with fur trim and a short spike, steel lamellar armor over a dark blue robe, a dark cloak, a composite bow held in the left hand resting on his thigh, the reins in the right hand, a quiver at his hip; a sturdy dark bay horse with black leather tack. Stylized semi-realistic game art in a Vietnamese lacquer palette (lacquer black, steel grey, indigo, burnt umber, gold accents), clean hand-painted matte materials with clear shape separation, no heavy black ink outlines, no cracked texture, no motion lines; 13th-century Mongol and Yuan armies fighting in Dai Viet, portrayed with dignity as a worthy opponent. Avoid: any text, letters or symbols (including on banners, shields and fans), logos, watermark; blood, gore or wounds; Japanese samurai armor, Chinese Qing dynasty clothing, queue hairstyles, firearms, modern objects; weapons crossing in front of the body; cropped feet, hands or hooves; multiple views; caricature or cartoonish exaggeration.
```

### X22 · Lý Quán — phó tướng hầu cận, giáo (B18)

Khung **3:4** · Hư cấu (diện mạo)

```
Full-body 3D game character concept art for image-to-3D modelling: a single loyal Yuan aide-general, Li Guan, front view, standing straight in a relaxed A-pose with arms held about 30 degrees away from the body, feet slightly apart and flat, the whole figure from head to toe in frame with a small margin, centered, eye-level orthographic view, plain flat light-grey background, soft even studio lighting, no cast shadows, no ground, no other people. A Han Chinese officer in Yuan service in his forties, earnest protective face, moustache, a round steel helmet with fur trim, steel lamellar armor over an indigo robe, leather boots, a long spear held upright in the right hand beside his body, butt on the ground, a small round leather shield on the left forearm held out at his side. Stylized semi-realistic game art in a Vietnamese lacquer palette (lacquer black, steel grey, indigo, burnt umber, gold accents), clean hand-painted matte materials with clear shape separation, no heavy black ink outlines, no cracked texture, no motion lines; 13th-century Mongol and Yuan armies fighting in Dai Viet, portrayed with dignity as a worthy opponent. Avoid: any text, letters or symbols (including on banners, shields and fans), logos, watermark; blood, gore or wounds; Japanese samurai armor, Chinese Qing dynasty clothing, queue hairstyles, firearms, modern objects; weapons crossing in front of the body; cropped feet, hands or hooves; multiple views; caricature or cartoonish exaggeration.
```

### X23 · Trương Văn Hổ — vạn hộ đoàn thuyền lương, kích (B19)

Khung **3:4** · Hư cấu (diện mạo)

```
Full-body 3D game character concept art for image-to-3D modelling: a single Yuan naval supply commander, Zhang Wenhu, front view, standing straight in a relaxed A-pose with arms held about 30 degrees away from the body, feet slightly apart and flat, the whole figure from head to toe in frame with a small margin, centered, eye-level orthographic view, plain flat light-grey background, soft even studio lighting, no cast shadows, no ground, no other people. A careful practical Han Chinese commander in his forties, moustache and short beard, a round helmet with fur trim, lamellar armor over a blue-grey robe, a cloth sash, leather boots, a long-hafted halberd held upright in the right hand beside his body, butt on the ground, a rolled cargo ledger tied at his belt. Stylized semi-realistic game art in a Vietnamese lacquer palette (lacquer black, steel grey, indigo, burnt umber, gold accents), clean hand-painted matte materials with clear shape separation, no heavy black ink outlines, no cracked texture, no motion lines; 13th-century Mongol and Yuan armies fighting in Dai Viet, portrayed with dignity as a worthy opponent. Avoid: any text, letters or symbols (including on banners, shields and fans), logos, watermark; blood, gore or wounds; Japanese samurai armor, Chinese Qing dynasty clothing, queue hairstyles, firearms, modern objects; weapons crossing in front of the body; cropped feet, hands or hooves; multiple views; caricature or cartoonish exaggeration.
```

### X24 · Phàn Tiếp — thủy tướng cẩn trọng, đại đao (B20)

Khung **3:4** · Hư cấu (diện mạo)

```
Full-body 3D game character concept art for image-to-3D modelling: a single cautious Yuan naval general, Fan Ji, front view, standing straight in a relaxed A-pose with arms held about 30 degrees away from the body, feet slightly apart and flat, the whole figure from head to toe in frame with a small margin, centered, eye-level orthographic view, plain flat light-grey background, soft even studio lighting, no cast shadows, no ground, no other people. A wary Han Chinese naval general in his forties, narrowed watchful eyes, dark beard, an indigo robe under steel lamellar armor with grey trim, a pointed Yuan steel helmet with an indigo neck flap, a dark indigo cloak, leather boots, a long-hafted single-edged glaive held upright in the right hand beside his body, butt on the ground. Stylized semi-realistic game art in a Vietnamese lacquer palette (lacquer black, steel grey, indigo, burnt umber, gold accents), clean hand-painted matte materials with clear shape separation, no heavy black ink outlines, no cracked texture, no motion lines; 13th-century Mongol and Yuan armies fighting in Dai Viet, portrayed with dignity as a worthy opponent. Avoid: any text, letters or symbols (including on banners, shields and fans), logos, watermark; blood, gore or wounds; Japanese samurai armor, Chinese Qing dynasty clothing, queue hairstyles, firearms, modern objects; weapons crossing in front of the body; cropped feet, hands or hooves; multiple views; caricature or cartoonish exaggeration.
```

### X25 · A Bát Xích — tướng Đường Ngột mở đường, giáo (B20)

Khung **3:4** · Hư cấu (diện mạo)

```
Full-body 3D game character concept art for image-to-3D modelling: a single Yuan general of Tangut origin, Abachi, front view, standing straight in a relaxed A-pose with arms held about 30 degrees away from the body, feet slightly apart and flat, the whole figure from head to toe in frame with a small margin, centered, eye-level orthographic view, plain flat light-grey background, soft even studio lighting, no cast shadows, no ground, no other people. A brave Tangut-born general in his forties, broad face, short beard, a fur-trimmed felt hat over a steel cap, steel lamellar armor over a dark green robe, leather boots, a long spear with a wide blade held upright in the right hand beside his body, butt on the ground, a saber at his hip. Stylized semi-realistic game art in a Vietnamese lacquer palette (lacquer black, steel grey, indigo, burnt umber, gold accents), clean hand-painted matte materials with clear shape separation, no heavy black ink outlines, no cracked texture, no motion lines; 13th-century Mongol and Yuan armies fighting in Dai Viet, portrayed with dignity as a worthy opponent. Avoid: any text, letters or symbols (including on banners, shields and fans), logos, watermark; blood, gore or wounds; Japanese samurai armor, Chinese Qing dynasty clothing, queue hairstyles, firearms, modern objects; weapons crossing in front of the body; cropped feet, hands or hooves; multiple views; caricature or cartoonish exaggeration.
```

### DT · Đội trưởng Nguyên (sĩ quan thường, mọi trận)

Khung **3:4** · Hư cấu

```
Full-body 3D game character concept art for image-to-3D modelling: a single Yuan infantry officer, front view, standing straight in a relaxed A-pose with arms held about 30 degrees away from the body, feet slightly apart and flat, the whole figure from head to toe in frame with a small margin, centered, eye-level orthographic view, plain flat light-grey background, soft even studio lighting, no cast shadows, no ground, no other people. A stocky Yuan officer with a short black beard, an indigo robe under steel lamellar armor with grey trim, a round Yuan steel helmet with fur trim, leather boots, a round leather shield on the left forearm held out at his side, a curved saber held point-down in the right hand at his side. Stylized semi-realistic game art in a Vietnamese lacquer palette (lacquer black, steel grey, indigo, burnt umber, gold accents), clean hand-painted matte materials with clear shape separation, no heavy black ink outlines, no cracked texture, no motion lines; 13th-century Mongol and Yuan armies fighting in Dai Viet, portrayed with dignity as a worthy opponent. Avoid: any text, letters or symbols (including on banners, shields and fans), logos, watermark; blood, gore or wounds; Japanese samurai armor, Chinese Qing dynasty clothing, queue hairstyles, firearms, modern objects; weapons crossing in front of the body; cropped feet, hands or hooves; multiple views; caricature or cartoonish exaggeration.
```

### PT · Phó tướng Nguyên (mọi trận)

Khung **3:4** · Hư cấu

```
Full-body 3D game character concept art for image-to-3D modelling: a single Yuan deputy general, front view, standing straight in a relaxed A-pose with arms held about 30 degrees away from the body, feet slightly apart and flat, the whole figure from head to toe in frame with a small margin, centered, eye-level orthographic view, plain flat light-grey background, soft even studio lighting, no cast shadows, no ground, no other people. A tall Yuan deputy general with a dark beard, an indigo robe under black lacquered lamellar armor with grey trim, a fur-trimmed round helmet, a steel-blue cloak, leather boots, a long-hafted single-edged glaive held upright in the right hand beside his body, butt on the ground. Stylized semi-realistic game art in a Vietnamese lacquer palette (lacquer black, steel grey, indigo, burnt umber, gold accents), clean hand-painted matte materials with clear shape separation, no heavy black ink outlines, no cracked texture, no motion lines; 13th-century Mongol and Yuan armies fighting in Dai Viet, portrayed with dignity as a worthy opponent. Avoid: any text, letters or symbols (including on banners, shields and fans), logos, watermark; blood, gore or wounds; Japanese samurai armor, Chinese Qing dynasty clothing, queue hairstyles, firearms, modern objects; weapons crossing in front of the body; cropped feet, hands or hooves; multiple views; caricature or cartoonish exaggeration.
```
