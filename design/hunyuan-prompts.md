# Prompt cho Hunyuan3D / Krea (tướng chơi được, tay NẮM ĐẤM)

Khác `glb-prompts.md` (Meshy): bàn tay **nắm đấm lỏng** thay vì tay mở, để chuôi vũ khí (gắn bằng code vào khớp cổ tay) xuyên qua nắm tay, không nằm lệch bên cạnh bàn tay phẳng. File này không do `design/tools/meshy.mjs` đọc.

## Vì sao A-pose (không phải T-pose)
`game/js/riglab/autorig.js` và bộ nướng `design/tools/bake/` viết cho tay chữ A (30–45° so với thân, khuỷu thẳng). Tay dang gần ngang (~74°) từng làm bộ dò khớp đặt sai khuỷu và cổ tay (`glb-prompts.md` mục 2.2). T-pose phải sửa bộ dò khớp và kéo dãn giáp vai.

## Quy trình đề xuất (hai bước, nghe lời prompt tốt hơn text-to-3D thẳng)
1. Dựng ẢNH tham chiếu mặt trước bằng model ảnh (Krea Image…): sinh 4 bản, chọn bản đối xứng nhất, đúng tư thế.
2. Ảnh → 3D bằng Hunyuan3D 3.1 Pro (Krea hoặc trang Hunyuan): số mặt khoảng 20–30k (bake giảm xuống ~9k), tuỳ chọn PBR có thể tắt (game chỉ dùng màu albedo), xuất GLB.
3. Đặt tệp vào `design/glb/_raw/` (ngoài git), ví dụ `H35_hunyuan.glb`, rồi chạy qua pipeline để so với bản Meshy cùng tư thế.

## Khối tư thế (POSE v3, dùng cho mọi nhân vật)
```text
Full body front view, A-pose: straight arms about 40° away from the body with a clear gap under each armpit, elbows straight, wrists straight, both hands in loose relaxed fists with thumbs on top and the fist hollow pointing forward as if gripping a horizontal rod, empty hands, legs straight and shoulder-width apart with a clear gap between the legs, feet flat and fully visible, neutral calm expression, mouth closed, perfectly symmetrical, centered, plain light grey background, even soft lighting, no cast shadow.
```

## NEGATIVE (dùng chung)
```text
weapon, sword, shield, cape, cloak, banner, flag, bow, spear, backpack, holding objects, open flat hands, spread fingers, arms raised, T-pose, bent elbows, crossed arms, arms touching the body, hands in pockets, side view, three-quarter view, dynamic pose, motion blur, cropped feet, long skirt hiding the legs, kabuto, samurai, Japanese armor, anime, chibi, text, watermark, extra limbs, multiple characters
```

## H35 · Trần Quốc Toản
```text
Slender Vietnamese youth general, 13th-century Tran dynasty, about 17, beardless, fierce eyes. Black topknot under a vermilion headband knotted at the back. Knee-length vermilion robe, black lacquer lamellar chest armor and shoulder guards with gold trim, four short vermilion skirt flaps open at the front and back so both legs stay visible, black greaves and shoes. Full body front view, A-pose: straight arms about 40° away from the body with a clear gap under each armpit, elbows straight, wrists straight, both hands in loose relaxed fists with thumbs on top and the fist hollow pointing forward as if gripping a horizontal rod, empty hands, legs straight and shoulder-width apart with a clear gap between the legs, feet flat and fully visible, neutral calm expression, mouth closed, perfectly symmetrical, centered, plain light grey background, even soft lighting, no cast shadow. Stylized low-poly game character, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

## H31 · Trần Hưng Đạo
```text
Dignified Vietnamese supreme commander, 13th-century Tran dynasty, about 60, stern eyes, long silver pointed beard. Song-style black helmet with gold rim, gold flame brow plate, red top tassel, neck guard. Heavy black lamellar armor, gold trim, gold chest mirror, pauldrons, gold knee guards, short dark red robe ending above the knees so both legs stay visible. Full body front view, A-pose: straight arms about 40° away from the body with a clear gap under each armpit, elbows straight, wrists straight, both hands in loose relaxed fists with thumbs on top and the fist hollow pointing forward as if gripping a horizontal rod, empty hands, legs straight and shoulder-width apart with a clear gap between the legs, feet flat and fully visible, neutral calm expression, mouth closed, perfectly symmetrical, centered, plain light grey background, even soft lighting, no cast shadow. Stylized low-poly game character, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

## Các nhân vật khác trong game (cách dùng)

Mỗi khối `text` dưới đây là prompt ảnh hoàn chỉnh (mô tả + POSE v3 + STYLE), dán thẳng vào Krea Image hoặc model ảnh khác rồi đưa ảnh vào Hunyuan3D như quy trình ở trên. Lời tả (nhận dạng, màu, giáp) lấy từ `glb-prompts.md`; đổi hai thứ để ra tay nắm đấm và chân tách: bỏ "open empty hands…" thay bằng POSE v3, và mọi váy giáp, vạt áo thành "short skirt flaps open at the front and back so both legs stay visible".

**NEGATIVE:** dùng khối NEGATIVE chung ở trên, cộng thêm tuỳ nhóm:

| Nhóm | Cộng thêm vào NEGATIVE |
| --- | --- |
| Tướng, lính ta (H33, H40, LINH, CV, DV) | `, Qing dynasty clothing, Nguyen dynasty court dress` |
| Tướng, lính Nguyên (X19, X20, X24, OFF, NG) | `, Qing dynasty clothing, queue braid, European plate armor, monster, demon, orc, horns, skull, fangs, grotesque, caricature, evil villain, gore` |
| Có ống tên / hộp tên sau lưng (H40, CV_cung, DV_NO, NG_CUNG, NG_KY) | bỏ chữ `backpack` khỏi NEGATIVE chung |
| NG_KY | thêm `, horse, saddle, sitting, mounted` |

**Tên tệp và mã nướng:** `design/glb/_raw/nhan-vat/<mã>_hunyuan.glb`, mã nướng `<mã>h` (như `H35h`), năm tướng đã có bản này (H35, H31, H33, H40, Toa Đô X19) dùng nó làm mô hình mặc định trong game; bản Meshy cũ vẫn nướng sẵn, ở khoá `<khoá>m` (xem mục "Đưa mô hình vào game" bước 6). Vũ khí, khiên, áo choàng, cờ lưng do code gắn, nên không nằm trong ảnh (đã có trong NEGATIVE). Mọi vũ khí của game chĩa theo trục +z của bàn tay lúc nghỉ, nên nắm đấm "như nắm một thanh nằm ngang" đúng cho cả kiếm, giáo, cung lẫn đao; khiên buộc vào cẳng tay trái nên bàn tay trái cứ để nắm đấm.

**Đã làm** (2026-10-08): H35, H31, H33, H40, X19. Còn lại theo thứ tự dưới đây.

**Thứ tự nên làm** (theo mức người chơi nhìn gần):
1. `LINH_r01`, `LINH_r24` (chính nhân vật người chơi ở chế độ Tự do), rồi `X19`, `X20`, `X24` (boss, camera áp sát), `H33`, `H40`.
2. `OFF_tuong`, `OFF_photuong`, `OFF_doitruong`; năm cận vệ `CV_*` (tối thiểu hai tệp: `CV_khien` đại diện mũ tướng, `CV_giao` đại diện nón lá, như `glb-prompts.md` mục F).
3. Lính đám đông (`DV_*`, `NG_*`): **không đáng làm.** Thân LOD0 chỉ 470 tam giác (`KIT_LIST` trong `catalog.mjs`), mỗi trận cả trăm người, tới 18 m trở đi đã hạ xuống 220 và 90 tam giác, nắm đấm không còn sống nổi ở mức đó. Giữ bản Meshy hiện có; prompt bên dưới chỉ để sẵn nếu sau này đổi ý.

## Tướng ta còn lại

### H33 · Trần Nhật Duật
```text
Vietnamese scholar-general, 13th-century Tran dynasty, about 30, warm clever face, neat moustache, short goatee. Short gold cylindrical helmet with a tall thin red spike. Knee-length steel-blue brocade robe, black lacquer lamellar vest with gold trim, jade belt, four short steel-blue skirt flaps open at the front and back so both legs stay visible, black greaves and shoes. Full body front view, A-pose: straight arms about 40° away from the body with a clear gap under each armpit, elbows straight, wrists straight, both hands in loose relaxed fists with thumbs on top and the fist hollow pointing forward as if gripping a horizontal rod, empty hands, legs straight and shoulder-width apart with a clear gap between the legs, feet flat and fully visible, neutral calm expression, mouth closed, perfectly symmetrical, centered, plain light grey background, even soft lighting, no cast shadow. Stylized low-poly game character, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```
- Vũ khí do code gắn: giáo (`giao_dv`). Áo choàng son do code dựng. Muốn mũ như truyện thay câu mũ bằng `Small black silk scholar hat over a topknot.`

### H40 · Nguyễn Khoái
```text
Vietnamese royal guard general, 13th-century Tran dynasty, about 45, weathered face, short black beard. Short gold cylindrical helmet with a tall thin red spike. Knee-length olive-green robe, black lacquer lamellar armor with gold trim, leather bracer on the left forearm, small quiver on the back, four short olive skirt flaps open at the front and back so both legs stay visible, black greaves and shoes. Full body front view, A-pose: straight arms about 40° away from the body with a clear gap under each armpit, elbows straight, wrists straight, both hands in loose relaxed fists with thumbs on top and the fist hollow pointing forward as if gripping a horizontal rod, empty hands, legs straight and shoulder-width apart with a clear gap between the legs, feet flat and fully visible, neutral calm expression, mouth closed, perfectly symmetrical, centered, plain light grey background, even soft lighting, no cast shadow. Stylized low-poly game character, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```
- Vũ khí do code gắn: cung (`cung_viet`) ở tay trái. Ống tên sau lưng là một phần thân (game chưa vẽ riêng); bỏ chữ `backpack` khỏi NEGATIVE.

## Tướng và sĩ quan Nguyên

### X19 · Toa Đô
```text
Veteran Mongol-Yuan general, 13th century, about 55, sturdy broad build, weathered dignified face, grey-streaked moustache and beard. Tall brown fur hat tapering upward, gold spike on top. Heavy black lacquer lamellar armor with gold trim, worn and scuffed, short dark plum robe ending above the knees so both legs stay visible, leather belt, tall riding boots. Full body front view, A-pose: straight arms about 40° away from the body with a clear gap under each armpit, elbows straight, wrists straight, both hands in loose relaxed fists with thumbs on top and the fist hollow pointing forward as if gripping a horizontal rod, empty hands, legs straight and shoulder-width apart with a clear gap between the legs, feet flat and fully visible, neutral calm expression, mouth closed, perfectly symmetrical, centered, plain light grey background, even soft lighting, no cast shadow. Stylized low-poly game character, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```
- Vũ khí: đại đao (`dadao`). Mặt nghiêm, cứng cỏi, không dữ tợn kiểu phản diện (đối thủ có danh dự).

### X20 · Ô Mã Nhi
```text
Proud Central Asian admiral of the Yuan navy, 13th century, about 45, sturdy broad build, noble features, thick black beard and moustache. Tall brown fur hat with gold spike and small red plume. Heavy black lacquer lamellar armor with gold trim, gold chest mirror, layered pauldrons, knee guards, short near-black robe ending above the knees so both legs stay visible, tall boots. Full body front view, A-pose: straight arms about 40° away from the body with a clear gap under each armpit, elbows straight, wrists straight, both hands in loose relaxed fists with thumbs on top and the fist hollow pointing forward as if gripping a horizontal rod, empty hands, legs straight and shoulder-width apart with a clear gap between the legs, feet flat and fully visible, neutral calm expression, mouth closed, perfectly symmetrical, centered, plain light grey background, even soft lighting, no cast shadow. Stylized low-poly game character, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```
- Vũ khí: đại đao. Áo choàng và cờ lưng (烏馬兒) do code dựng, không để trong ảnh. Pauldron nhiều lớp dễ che nách: nếu tay dính thân thì sinh lại với `arms about 45° away from the body`.

### X24 · Phàn Tiếp
```text
Cautious Yuan naval commander, 13th century, about 50, watchful thoughtful face, short dark beard. Tall pointed silver-grey steel helmet with brown fur rim. Blue-grey steel lamellar armor with silver trim, dark indigo robe with four short skirt flaps open at the front and back so both legs stay visible, leather belt, tall black boots. Full body front view, A-pose: straight arms about 40° away from the body with a clear gap under each armpit, elbows straight, wrists straight, both hands in loose relaxed fists with thumbs on top and the fist hollow pointing forward as if gripping a horizontal rod, empty hands, legs straight and shoulder-width apart with a clear gap between the legs, feet flat and fully visible, neutral calm expression, mouth closed, perfectly symmetrical, centered, plain light grey background, even soft lighting, no cast shadow. Stylized low-poly game character, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```
- Vũ khí: đại đao. Áo choàng chàm và cờ lưng (樊) do code dựng.

### OFF_tuong · Tướng Nguyên
```text
Mongol-Yuan general, 13th century, about 40, stern clean-shaven face. Tall brown fur hat tapering upward, gold spike on top. Black lacquer lamellar armor with gold trim, short dark plum robe, four short plum skirt flaps with gold hems open at the front and back so both legs stay visible, leather belt, tall riding boots. Full body front view, A-pose: straight arms about 40° away from the body with a clear gap under each armpit, elbows straight, wrists straight, both hands in loose relaxed fists with thumbs on top and the fist hollow pointing forward as if gripping a horizontal rod, empty hands, legs straight and shoulder-width apart with a clear gap between the legs, feet flat and fully visible, neutral calm expression, mouth closed, perfectly symmetrical, centered, plain light grey background, even soft lighting, no cast shadow. Stylized low-poly game character, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```
- Vũ khí: đại đao. Cùng bảng màu với X19 nên dễ lẫn; khác ở mặt cạo râu và dáng thon hơn.

### OFF_photuong · Phó tướng Nguyên
```text
Mongol-Yuan deputy commander, 13th century, about 35, stern clean-shaven face. Tall brown fur hat tapering upward, silver-grey spike on top. Black lacquer lamellar armor with silver-grey trim, short dark indigo robe, four short indigo skirt flaps open at the front and back so both legs stay visible, leather belt, tall riding boots. Full body front view, A-pose: straight arms about 40° away from the body with a clear gap under each armpit, elbows straight, wrists straight, both hands in loose relaxed fists with thumbs on top and the fist hollow pointing forward as if gripping a horizontal rod, empty hands, legs straight and shoulder-width apart with a clear gap between the legs, feet flat and fully visible, neutral calm expression, mouth closed, perfectly symmetrical, centered, plain light grey background, even soft lighting, no cast shadow. Stylized low-poly game character, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```
- Vũ khí: đại đao (khâu xám).

### OFF_doitruong · Đội trưởng Nguyên
```text
Mongol-Yuan squad captain, 13th century, about 30, alert clean-shaven face. Tall pointed silver-grey steel helmet with brown fur rim. Blue-grey steel lamellar cuirass and shoulder guards with silver trim, short dark indigo robe, four short indigo skirt flaps open at the front and back so both legs stay visible, leather belt, black boots. Full body front view, A-pose: straight arms about 40° away from the body with a clear gap under each armpit, elbows straight, wrists straight, both hands in loose relaxed fists with thumbs on top and the fist hollow pointing forward as if gripping a horizontal rod, empty hands, legs straight and shoulder-width apart with a clear gap between the legs, feet flat and fully visible, neutral calm expression, mouth closed, perfectly symmetrical, centered, plain light grey background, even soft lighting, no cast shadow. Stylized low-poly game character, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```
- Vũ khí: đao (`dao`) tay phải và khiên tròn buộc cẳng tay trái, cả hai do code gắn, không để trong ảnh. Không áo choàng.

## Người lính Tự do và cận vệ

Người chơi nhìn gần nhất. Giữ cùng một khuôn mặt giữa `LINH_r01` và `LINH_r24`: sinh `LINH_r01` trước, rồi dùng ảnh đã chọn làm ảnh tham chiếu mặt cho `LINH_r24`.

### LINH_r01 · Lính, Tinh nhuệ
```text
Young Vietnamese Tran dynasty foot soldier, 13th century, about 20, beardless determined face. Wide conical palm-leaf hat over a red headband. Knee-length brick-red robe, dark brown leather chest armor, arm and shoulder guards with dull bronze trim, four short brick-red skirt flaps open at the front and back so both legs stay visible, black greaves and shoes. Full body front view, A-pose: straight arms about 40° away from the body with a clear gap under each armpit, elbows straight, wrists straight, both hands in loose relaxed fists with thumbs on top and the fist hollow pointing forward as if gripping a horizontal rod, empty hands, legs straight and shoulder-width apart with a clear gap between the legs, feet flat and fully visible, neutral calm expression, mouth closed, perfectly symmetrical, centered, plain light grey background, even soft lighting, no cast shadow. Stylized low-poly game character, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```
- Vũ khí do code gắn: song đao (`songdao`) hoặc đại kiếm (`daikiem`). Nón lá rộng dính đầu, nên chọn ảnh vành nón không chạm vai.

### LINH_r24 · Đội trưởng, Phó tướng, Tướng
```text
Young Vietnamese Tran dynasty officer, 13th century, about 22, beardless determined face. Short gold cylindrical helmet with a tall thin red spike. Knee-length dark red robe, black lacquer lamellar chest armor, arm and shoulder guards with gold trim, four short dark red skirt flaps with gold hems open at the front and back so both legs stay visible, black greaves and shoes. Full body front view, A-pose: straight arms about 40° away from the body with a clear gap under each armpit, elbows straight, wrists straight, both hands in loose relaxed fists with thumbs on top and the fist hollow pointing forward as if gripping a horizontal rod, empty hands, legs straight and shoulder-width apart with a clear gap between the legs, feet flat and fully visible, neutral calm expression, mouth closed, perfectly symmetrical, centered, plain light grey background, even soft lighting, no cast shadow. Stylized low-poly game character, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```
- Vũ khí như `LINH_r01`. Áo choàng son của bậc Tướng do code dựng.

### CV_khien · Cận vệ Khiên thủ
```text
Sturdy Vietnamese Tran dynasty bodyguard, 13th century, about 30, steady face, short moustache. Short gold cylindrical helmet with a tall thin red spike. Knee-length brick-red robe, dark brown lamellar armor and shoulder guards, gold trim, leather guard on the left forearm, four short maroon skirt flaps open at the front and back so both legs stay visible, black greaves and shoes. Full body front view, A-pose: straight arms about 40° away from the body with a clear gap under each armpit, elbows straight, wrists straight, both hands in loose relaxed fists with thumbs on top and the fist hollow pointing forward as if gripping a horizontal rod, empty hands, legs straight and shoulder-width apart with a clear gap between the legs, feet flat and fully visible, neutral calm expression, mouth closed, perfectly symmetrical, centered, plain light grey background, even soft lighting, no cast shadow. Stylized low-poly game character, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```
- Vũ khí: đao (`dao`) tay phải, khiên (`khien_nhat`) buộc cẳng tay trái.

### CV_giao · Cận vệ Giáo thủ
```text
Vietnamese Tran dynasty bodyguard, 13th century, about 25, lean alert beardless face. Wide conical palm-leaf hat over a red headband. Knee-length brick-red robe, dark brown lamellar chest armor and shoulder guards with gold trim, four short maroon skirt flaps with gold hems open at the front and back so both legs stay visible, black greaves and shoes. Full body front view, A-pose: straight arms about 40° away from the body with a clear gap under each armpit, elbows straight, wrists straight, both hands in loose relaxed fists with thumbs on top and the fist hollow pointing forward as if gripping a horizontal rod, empty hands, legs straight and shoulder-width apart with a clear gap between the legs, feet flat and fully visible, neutral calm expression, mouth closed, perfectly symmetrical, centered, plain light grey background, even soft lighting, no cast shadow. Stylized low-poly game character, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```
- Vũ khí: giáo (`giao_dv`).

### CV_cung · Cận vệ Cung thủ
```text
Vietnamese Tran dynasty bodyguard, 13th century, about 25, calm focused face, thin moustache. Wide conical palm-leaf hat over a red headband. Knee-length brick-red robe, dark brown leather chest armor with gold trim, leather bracer on the left forearm, small quiver on the back, four short maroon skirt flaps open at the front and back so both legs stay visible, black greaves and shoes. Full body front view, A-pose: straight arms about 40° away from the body with a clear gap under each armpit, elbows straight, wrists straight, both hands in loose relaxed fists with thumbs on top and the fist hollow pointing forward as if gripping a horizontal rod, empty hands, legs straight and shoulder-width apart with a clear gap between the legs, feet flat and fully visible, neutral calm expression, mouth closed, perfectly symmetrical, centered, plain light grey background, even soft lighting, no cast shadow. Stylized low-poly game character, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```
- Vũ khí: cung (`cung_viet`) tay trái. Bỏ chữ `backpack` khỏi NEGATIVE.

### CV_songdao · Cận vệ Song đao
```text
Agile Vietnamese Tran dynasty bodyguard, 13th century, about 22, lean wiry build, beardless. Wide conical palm-leaf hat over a red headband. Knee-length brick-red robe with sleeves bound at the wrist, light dark-brown leather vest with gold trim, red sash, four short maroon skirt flaps open at the front and back so both legs stay visible, black greaves and shoes. Full body front view, A-pose: straight arms about 40° away from the body with a clear gap under each armpit, elbows straight, wrists straight, both hands in loose relaxed fists with thumbs on top and the fist hollow pointing forward as if gripping a horizontal rod, empty hands, legs straight and shoulder-width apart with a clear gap between the legs, feet flat and fully visible, neutral calm expression, mouth closed, perfectly symmetrical, centered, plain light grey background, even soft lighting, no cast shadow. Stylized low-poly game character, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```
- Vũ khí: song đao (`songdao`) hai tay.

### CV_daidao · Cận vệ Đại đao
```text
Broad-shouldered Vietnamese Tran dynasty bodyguard, 13th century, about 35, strong face, short black beard. Short gold cylindrical helmet with a tall thin red spike. Knee-length brick-red robe, dark brown lamellar chest armor and shoulder guards with gold trim, four short maroon skirt flaps open at the front and back so both legs stay visible, black greaves and shoes. Full body front view, A-pose: straight arms about 40° away from the body with a clear gap under each armpit, elbows straight, wrists straight, both hands in loose relaxed fists with thumbs on top and the fist hollow pointing forward as if gripping a horizontal rod, empty hands, legs straight and shoulder-width apart with a clear gap between the legs, feet flat and fully visible, neutral calm expression, mouth closed, perfectly symmetrical, centered, plain light grey background, even soft lighting, no cast shadow. Stylized low-poly game character, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```
- Vũ khí: đại đao (`dadao`) cầm hai tay. Vai rộng + giáp vai dễ che nách: nhớ khe hở dưới nách.

## Lính đám đông (tuỳ chọn, không khuyến nghị)

Thân 470 tam giác ở LOD0, xem lý do ở danh sách thứ tự phía trên. Phong cách giản lược để mô hình ra ít chi tiết nhỏ.

### DV_GIAO · Giáo binh ta
```text
Vietnamese Tran dynasty infantryman, 13th century, young beardless face. Low wide conical straw hat over a black headband. Vermilion tunic, black lacquer chest plate, black belt and wrist guards, narrow pointed vermilion front apron and wide back flap ending above the knees, black hems, black trousers, straw leg wraps, black shoes. Full body front view, A-pose: straight arms about 40° away from the body with a clear gap under each armpit, elbows straight, wrists straight, both hands in loose relaxed fists with thumbs on top and the fist hollow pointing forward as if gripping a horizontal rod, empty hands, legs straight and shoulder-width apart with a clear gap between the legs, feet flat and fully visible, neutral calm expression, mouth closed, perfectly symmetrical, centered, plain light grey background, even soft lighting, no cast shadow. Stylized low-poly game character, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```
- Vũ khí: giáo (`giao_dv`).

### DV_DAO · Đao khiên ta
```text
Vietnamese Tran dynasty infantryman, 13th century, young beardless face, black topknot, vermilion cloth wrapped around the head. Dark red tunic, black lacquer chest plate and shoulder pads, black belt, dark red front apron and back flap ending above the knees with black hems, black trousers, straw-colored leg wraps, black shoes. Full body front view, A-pose: straight arms about 40° away from the body with a clear gap under each armpit, elbows straight, wrists straight, both hands in loose relaxed fists with thumbs on top and the fist hollow pointing forward as if gripping a horizontal rod, empty hands, legs straight and shoulder-width apart with a clear gap between the legs, feet flat and fully visible, neutral calm expression, mouth closed, perfectly symmetrical, centered, plain light grey background, even soft lighting, no cast shadow. Stylized low-poly game character, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```
- Vũ khí: đao lính (`dao_linh`) + khiên nhật (`khien_nhat`).

### DV_NO · Nỏ thủ ta
```text
Vietnamese Tran dynasty foot soldier, 13th century, young beardless face. Tall narrow-brimmed conical straw hat over a wide black headband. Vermilion tunic under a padded straw-colored vest, matching apron and back flap ending above the knees with black hems, black trousers, leg wraps, black shoes, small brown wooden box on the back. Full body front view, A-pose: straight arms about 40° away from the body with a clear gap under each armpit, elbows straight, wrists straight, both hands in loose relaxed fists with thumbs on top and the fist hollow pointing forward as if gripping a horizontal rod, empty hands, legs straight and shoulder-width apart with a clear gap between the legs, feet flat and fully visible, neutral calm expression, mouth closed, perfectly symmetrical, centered, plain light grey background, even soft lighting, no cast shadow. Stylized low-poly game character, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```
- Vũ khí: nỏ (`no`) buộc cẳng tay phải. Bỏ chữ `backpack` khỏi NEGATIVE.

### NG_DAO · Đao thuẫn Nguyên
```text
Mongol-Yuan infantryman, 13th century, short black beard. Tall pointed light-grey steel helmet, brown fur rim, indigo neck flap. Dark indigo crossover robe, blue-grey steel lamellar chest and shoulder plates, wrist guards, four short flared indigo skirt panels with lamellae open at the front and back so both legs stay visible, black belt, brown boots. Full body front view, A-pose: straight arms about 40° away from the body with a clear gap under each armpit, elbows straight, wrists straight, both hands in loose relaxed fists with thumbs on top and the fist hollow pointing forward as if gripping a horizontal rod, empty hands, legs straight and shoulder-width apart with a clear gap between the legs, feet flat and fully visible, neutral calm expression, mouth closed, perfectly symmetrical, centered, plain light grey background, even soft lighting, no cast shadow. Stylized low-poly game character, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```
- Vũ khí: đao lính + khiên tròn.

### NG_GIAO · Thương binh Nguyên
```text
Mongol-Yuan infantryman, 13th century, short black beard. Rounded steel helmet with short iron point, red knob on top, indigo neck and cheek flaps. Slate-blue robe, blue-grey steel lamellar chest plate, indigo shoulder pads, steel wrist guards, four short skirt panels with lamellae and leather hems open at the front and back so both legs stay visible, black boots. Full body front view, A-pose: straight arms about 40° away from the body with a clear gap under each armpit, elbows straight, wrists straight, both hands in loose relaxed fists with thumbs on top and the fist hollow pointing forward as if gripping a horizontal rod, empty hands, legs straight and shoulder-width apart with a clear gap between the legs, feet flat and fully visible, neutral calm expression, mouth closed, perfectly symmetrical, centered, plain light grey background, even soft lighting, no cast shadow. Stylized low-poly game character, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```
- Vũ khí: thương (`giao_ng`) + khiên tròn nhỏ.

### NG_CUNG · Cung thủ bộ Nguyên
```text
Mongol-Yuan foot soldier, 13th century, short black beard. Brown fur hat flaring outward, small indigo cone on top. Grey-blue knee-length robe split front and back, brown leather chest guard and wrist guards, black trousers, brown boots, brown arrow quiver slung diagonally on the back, cream fletching. Full body front view, A-pose: straight arms about 40° away from the body with a clear gap under each armpit, elbows straight, wrists straight, both hands in loose relaxed fists with thumbs on top and the fist hollow pointing forward as if gripping a horizontal rod, empty hands, legs straight and shoulder-width apart with a clear gap between the legs, feet flat and fully visible, neutral calm expression, mouth closed, perfectly symmetrical, centered, plain light grey background, even soft lighting, no cast shadow. Stylized low-poly game character, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```
- Vũ khí: cung (`cung_ng`) tay trái. Bỏ chữ `backpack` khỏi NEGATIVE.

### NG_TANK · Lực sĩ trọng giáp Nguyên
```text
Broad-shouldered Mongol-Yuan heavy infantryman, 13th century, disciplined human soldier, iron face mask. Tall black helmet with steel cone and gold spike. Fur collar, charcoal robe, steel lamellar cuirass, black pauldrons, steel greaves, short riveted iron lamellar skirt panels open at the front and back so both legs stay visible, indigo trousers, black boots. Full body front view, A-pose: straight arms about 40° away from the body with a clear gap under each armpit, elbows straight, wrists straight, both hands in loose relaxed fists with thumbs on top and the fist hollow pointing forward as if gripping a horizontal rod, empty hands, legs straight and shoulder-width apart with a clear gap between the legs, feet flat and fully visible, neutral calm expression, mouth closed, perfectly symmetrical, centered, plain light grey background, even soft lighting, no cast shadow. Stylized low-poly game character, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```
- Vũ khí: chùy gai (`chuy`). Tấm lông sau lưng bỏ khỏi ảnh (tách riêng nếu muốn đung đưa). Là người lính, không phải quái vật.

### NG_KY · Cung kỵ Nguyên (người cưỡi, đứng)
```text
Mongol-Yuan soldier, 13th century, steady face, short black beard. Brown fur hat tapering upward from a wide brim, steel spike on top. Blue-grey steel lamellar coat ending above the knees, steel upper-arm guards, indigo sleeves and waist sash, indigo trousers, tall black boots, small brown arrow quiver on the back, cream fletching. Full body front view, A-pose: straight arms about 40° away from the body with a clear gap under each armpit, elbows straight, wrists straight, both hands in loose relaxed fists with thumbs on top and the fist hollow pointing forward as if gripping a horizontal rod, empty hands, legs straight and shoulder-width apart with a clear gap between the legs, feet flat and fully visible, neutral calm expression, mouth closed, perfectly symmetrical, centered, plain light grey background, even soft lighting, no cast shadow. Stylized low-poly game character, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```
- Vũ khí: cung (`cung_ng`) tay trái. Ngựa là mô hình riêng (`MOUNT_ngua_nguyen`). NEGATIVE thêm `, horse, saddle, sitting, mounted`, bỏ `backpack`.

## Tướng chưa có trong game

H34, H38, H39, H27 đến H30, H32, H36, H37, TT, X16 đến X18, X21 đến X23, X25, DV_AOTONG, DAN_*: lấy PROMPT trong `glb-prompts.md` và đổi bốn chỗ cho thành bản Hunyuan:
1. Thay cả khối POSE v2 ("A-pose, straight arms 45° down … mouth closed.") bằng POSE v3 ở trên.
2. Váy giáp, vạt áo, áo dài: ngắn tới trên đầu gối và "open at the front and back so both legs stay visible".
3. Bỏ vũ khí, áo choàng, cờ khỏi lời tả (đã có trong NEGATIVE).
4. Thêm cụm NEGATIVE của nhóm (bảng ở trên).

## Sinh ảnh bằng API ai33 (`design/tools/ai33-img.mjs`)

Công cụ đọc đúng các khối prompt ở trên (tướng, lính) và các mục còn lại của `glb-prompts.md`: vũ khí, đạo cụ, ngựa và voi, dân làng, thuyền, công trình, đạo cụ cảnh, cây đá, thú, cùng các tướng chưa có trong game (đổi sang POSE v3 khi ghép). Vật thể được nối câu góc nhìn ba phần tư, nền xám, không đổ bóng, không thêm hoa văn ngoài lời tả. Gửi tới `POST /v1i/task/generate-image`, chờ và tải ảnh về `design/glb/_raw/img/<mã>/<mã>-NN.png` (ngoài git). Khoá API chỉ truyền qua biến môi trường `AI33_KEY`, không ghi vào tệp.

```bash
AI33_KEY=… node design/tools/ai33-img.mjs --only OFF_photuong,LINH_r01 --n 4 --no-collect   # gửi (mặc định: gpt-image-2.5-sunburst, 2:3, 2K, chất lượng high)
AI33_KEY=… node design/tools/ai33-img.mjs --collect                                          # chờ và tải mọi tác vụ chưa xong
node design/tools/ai33-img.mjs --status                                                      # xem tác vụ nào còn chờ
AI33_KEY=… node design/tools/ai33-img.mjs --set weapons,props --price                       # tổng giá của một nhóm, chưa gửi
AI33_KEY=… node design/tools/ai33-img.mjs --set objects                                      # gửi dần và nhặt luôn (nhóm: weapons props mounts villagers boats buildings scenery nature animals heroes2)
node design/tools/ai33-img.mjs --list                                                         # mọi mã, nhóm, tỉ lệ khung, cỡ, chất lượng, số ảnh
```

- Model ảnh không có ô Negative, nên công cụ nối câu khẳng định cuối prompt ("No weapon, no shield, no cape, no banner, no text, no watermark", "Single character only", cả người từ đầu tới chân).
- Giá tham khảo: ảnh dọc 2:3, 2K, high khoảng 830 credit mỗi ảnh (4 ảnh một lần gửi là tối đa); chất lượng medium rẻ hơn 2 đến 3 lần và đủ cho vật thể đơn giản. Kế hoạch mỗi nhóm (tỉ lệ khung theo hình vật, cỡ, chất lượng, số ảnh): vũ khí 1:3 hoặc 1:2 2K high 2 ảnh; thuyền, ngựa, voi, thú 3:2 2K high 2 ảnh; công trình 4:3 2K medium 1 ảnh (công trình chính 2 ảnh high); đạo cụ cảnh, cây đá 1K medium 1 ảnh; tướng, dân làng 2:3 2K high 2 ảnh. Đợt vật thể toàn bộ (143 mã, 216 ảnh) ước tính khoảng 170 nghìn credit.
- Hàng đợi chậm và thất thường: tác vụ cũ của tài khoản mất từ 40 phút tới hơn 3 giờ; đợt sinh ngày 8/10/2026 (19 tác vụ) xong sau 23 phút tới khoảng 2 giờ 30, thanh tiến độ đứng ở 15 cho tới lúc xong. Mọi tác vụ đã gửi ghi vào `tasks.jsonl` cùng thư mục ảnh, nên tắt máy rồi `--collect` lại vẫn nhặt được, không bị tính tiền lần nữa. Gửi hết một lượt bằng `--no-collect`, rồi chạy đúng một `--collect` (hai bộ nhặt chạy song song sẽ tải trùng ảnh). Máy chủ chỉ cho 20 tác vụ đang chờ cùng lúc (lỗi `active_task_limit`), nên công cụ tự gửi dần theo chỗ trống và nhặt xen kẽ, chạy được qua đêm; chỉ chạy MỘT lệnh có nhặt (hai bộ nhặt sẽ tải trùng ảnh).
- Mặt `LINH_r24` lấy từ ảnh `LINH_r01` đã chọn: `--only LINH_r24 --again --ref <ảnh r01> --extra "Use only the face, age and skin tone of the young man in @img1 so that it is clearly the same person. Do not copy his hat, armor or clothes: dress him in the officer outfit described above."`. Đợt này ra ảnh số 05 đến 08 của `LINH_r24`, không bị chép nón và áo của r01; ảnh 07 có mặt gần r01 nhất trong tám ảnh nên được chọn.
- Soát nhanh: `node design/tools/img-sheet.mjs <mã> …` ra `sheet.png` (các biến thể cạnh nhau, đánh số) và `hands.png` (dải ngang tầm bàn tay, chỉ với người); `--from N` chỉ lấy ảnh từ số N; `--grid ENV_c` ghép mọi biến thể của các mã có tiền tố, 30 ảnh một trang, vào `design/glb/_raw/img/_grids/`; `--pick WPN_dao:2,ENV_hom_go:1` chép ảnh đã chọn vào `design/glb/_raw/img/best/<mã>.png` (`--pick single` lấy luôn các mã chỉ có một ảnh); `--overview [WPN_]` ghép ảnh đã chọn thành `best/_overview*.png`.
- **Đợt vật thể và tướng chưa có (8/10/2026, 143 mã, gpt-image-2.5-sunburst):** vũ khí 19, đạo cụ 9, ngựa / voi / trâu, thuyền, công trình, đạo cụ cảnh, cây đá, thú (cò, quạ), dân làng (nam, nữ, trẻ) và 19 tướng chưa có trong game (H27 đến H30, H32, H34, H36 đến H39, TT, X16 đến X18, X21 đến X23, X25, DV_AOTONG). Ảnh chọn nằm ở `design/glb/_raw/img/best/<mã>.png` (mỗi mã một ảnh), bảng xem nhanh ở `best/_overview_chars.png` (17 nhân vật đợt một), `_overview_tuong+dan.png`, `_overview_WPN.png`, `_overview_PROP.png`, `_overview_MOUNT.png`, `_overview_ENV_1…3.png`.
- Cách chọn ảnh: người (tướng, dân) chọn biến thể có hai chân tách nhau rõ nhất, váy áo ngắn tới trên đầu gối và xẻ trước (dải `--band 0.5:0.8` của `img-sheet.mjs` soi riêng phần này), tay chữ A, nắm đấm lỏng, đủ chi tiết lời tả; vật thể chọn ảnh còn nguyên vật trong khung (không cắt đầu cánh, mũi thương), một vật, không hoa văn ngoài lời tả, ưu tiên góc ba phần tư nhìn rõ hình khối. Hai mã phải sinh lại vì lần đầu thêm hoa văn không có trong lời tả: `WPN_khien_tron_ng` (khiên tròn Nguyên bị vẽ họa tiết; thêm `--extra "The shield face is plain, uniformly brown leather …"`, ra mặt da trơn, chọn ảnh 04) và `ENV_gia_cheo` (giá chèo bị tô màu từng mái chèo; thêm `--extra "All four oars are plain, unpainted natural brown wood …"`).
- Sắp xếp theo độ ưu tiên khi dựng Hunyuan3D: vật thể chiến đấu và thuyền trước (`WPN_*`, `PROP_*`, `ENV_thuyen_*`, `ENV_chien_thuyen_nguyen`, `ENV_ky_ham_nguyen`, `ENV_long_thuyen`), công trình đồn (`ENV_cong_ham_tu`, `ENV_thap_canh_*`, `ENV_coc_*`, `ENV_leu_*`), rồi cây đá. Ảnh vật thể đều có nền xám phẳng, đúng một vật, không đổ bóng, hợp để đưa vào Hunyuan3D.

## Soát ảnh / mô hình trước khi nhận
- Tay thẳng, chếch ~40°, thấy rõ khe dưới nách; khuỷu không gập.
- Hai bàn tay là nắm đấm lỏng, lỗ nắm hướng ra trước, ngón cái ở trên (không phải bàn tay phẳng).
- Không vũ khí, áo choàng, cờ, đạo cụ trong tay hay sau lưng.
- Hai chân tách nhau, thấy rõ cả hai bàn chân; váy giáp không dính liền hai đùi.
- Mặt nhìn thẳng, đối xứng trái / phải; không có nền hay bệ dính vào mesh.
- Mũ: nếu bị vẽ thành kabuto Nhật hay có cặp sừng thì bỏ (xem ghi chú mục A1, A2 của `glb-prompts.md`).

## Đưa mô hình vào game (đã làm với H35, H31, H33, H40, X19: mã `H35h`, `H31h`, `H33h`, `H40h`, `X19h`; đợt hai: `LINH_r01h`, `LINH_r24h`, `OFF_photuongh`, `OFF_doitruongh`, năm `CV_*h` và tám lính đám đông `kit/<mã>h`)
1. Bỏ GLB vào `design/glb/_raw/` (ngoài git), tên `<mã>_hunyuan.glb`. `readGLB` (bake/io.mjs) áp ma trận node nên GLB trục Z lên của Hunyuan (phép quay 90° trong node) được đứng thẳng; GLB Meshy (ma trận đơn vị) giữ nguyên số liệu.
2. Thêm mục vào `CHARS` của `design/tools/bake/catalog.mjs`, `src` là đường dẫn GLB (không cần manifest Meshy): `{ src: "design/glb/_raw/….glb", tris: 9000, tex: 1024, fix: FIX_…, ...ARM_TUBE }`. Hạng ngân sách như bản Meshy (tướng người chơi 9000 tam giác / 1024², tướng khác 6000 / 512²); boss Toa Đô 7500 / 1024² vì camera áp sát.
3. **Đo khớp tay bằng công cụ:** `node design/tools/fit-arms.mjs <mã trong catalog | đường dẫn .glb>` in khối `FIX_…` (vai, khuỷu, "hand" = giữa nắm đấm, `neck` = khớp cổ; khung chuẩn hoá thô cao 1,9) để dán vào `catalog.mjs`. Bộ dò geodesic (`landmarks.mjs`) trượt với tay chữ A áo giáp rộng nên công cụ đo bằng mặt cắt ngang (`bake/fit-arms.mjs`, mô tả đầu tệp): nắm đấm là phần tay thấp nhất tách khỏi thân bằng một khe, hướng tay lấy từ các mặt cắt giữa nắm đấm và nách, chiều dài tay vai → nắm đấm cố định 0,51 (vai nằm trong giáp, không đo được), cánh tay trên đứng hơn cẳng tay (mẫu Hunyuan có cánh tay trên gần thẳng đứng, cẳng tay chếch ~38° ra ngoài và 25–30° về trước). Có thêm `khoá=số` để đổi tham số, vd `upX=1 upZ=1` ra tay thẳng. Công cụ báo lỗi hướng dẫn ghi tay khi tay áp thân (không có khe) hay nắm đấm không tách.
   - Kiểm trên hai nguồn độc lập: H35h (`FIX_H35H` đo lát cắt bằng mắt: nắm đấm lệch 0,02, vai 0,02, khuỷu đo tay thấp hơn 0,07) và X19h (bộ xương của công cụ rig tự động, `design/glb/_raw/nhan-vat/X19_hunyuan_rigged.fbx`: vai lệch ≤ 0,02, khuỷu ≤ 0,03, nắm đấm ≤ 0,025). Test: `game/tests/bake-fit.test.mjs` (người tổng hợp; H35h thật nếu có GLB).
   - Cổ (`fix.neck`): `landmarks.mjs` dò cổ theo vai bộ dò, vai bộ dò sai thì cổ sai theo (H33h: cổ chỉ 0,057 m trên vai, giáp vai lọt vào vùng đầu, quay theo đầu) nên khớp cổ đo theo vai ghi tay: chỗ thân hẹp nhất 0,0855–0,19 trên vai.
4. `cd design/tools && npm i` (một lần; node_modules ngoài git) rồi `node design/tools/glb-bake.mjs char --only <mã>`.
5. Chạy `game/tests/models.test.mjs` và `game/tests/rig-glb.test.mjs`; trượt thì chữa theo nguyên nhân:
   - **Đường tách hở (rig-glb), tam giác cầu ở nách / cánh tay:** tay giáp dày (hộ tay, giáp cánh tay trên) lòi mặt trong ra ngoài ống quanh chuỗi xương tay (mặc định 0,076 cẳng tay, 0,0855 cánh tay trên): đỉnh mặt trong theo thân, nối với đỉnh theo tay. Chữa: `...ARM_TUBE` trong catalog (`rad: [0.05, 0.05, 0.055]`, `radOut: [0.07, 0.07, 0.075]`, đơn vị H) — mức nhỏ nhất làm hết cầu ở H31h, H33h, X19h; H35h dùng `w: { mirror: 1 }` (nách phải dính thân, tay trái sạch).
   - **Đồ đeo dài dính lưng** (ống tên H40h: dây đeo chéo từ eo lên cổ, mũi tên cao ngang đầu — theo trường độ cao thì mũi tên quay theo đầu, và tam giác dài nối xương lưng với xương cổ bị tách hở 0,19 m khi lộn né): `rigid: [{ lo, hi }]` (khung gắn, mét) khoá đỉnh trong hộp theo thân thuần (`char.mjs` `lockTorso`; H40h: `QUIVER_H40H`).
   - **Phần trọng số vai dưới 2%** (models.test (b)): chỉnh `w: { so: … }` (mặc định −0,05; dải vai kết thúc ở `dS + bs + so`).
6. Xem trong lab: `lab.html?view=rigs&rigs=H31,H31m&m=idle` (khoá `<khoá>m` là bản Meshy cũ, đúng mã và cỡ cũ: `heroM`, `H31m`, `H33m`, `H40m`, `X19m`; H31 có bộ đòn WC01 nên chỉ hiện khi ghi rõ trong `rigs`). Trong trận thật `?debug&rigmodel=meshy` (models.js `useMeshy`) trả cả năm tướng về Meshy để so; `?debug&rigmodel=<mã>` đổi thân của H35 sang mô hình nướng khác. Khoá `RIGS` giữ nguyên (`hero`, `H31`, `H33`, `H40`, `X19`), chỉ `model` và `scale` đổi.

### Cỡ trong game
Chuẩn hoá theo độ cao vai (1,48 m) nên đầu và mũ Hunyuan nhỏ hơn Meshy: đỉnh đầu thấp hơn 7–9% ở cùng cỡ `RIGS.scale` (H31 2,158 → 1,964 m; H33 2,11 → 1,957; H40 2,108 → 1,969; X19 2,124 → 1,979; H35 1,952 → 1,953 như nhau). `models.js` nhân cỡ lên đúng tỉ lệ đó để giữ chiều cao tướng và boss như trước: H31 1,12 → 1,23, H33 1,15 → 1,24, H40 1,15 → 1,23, X19 1,38 → 1,48 (H35 giữ 1,08). Muốn giữ cỡ vai và cỡ vũ khí như cũ thay vì chiều cao, đặt lại các số đó (bản Meshy cũ ở `MESHY`).

### Kết quả (Hunyuan3D, nắm đấm) so với Meshy (tay mở)
- Bàn tay: nắm đấm bao quanh chuôi, vòng chắn và núm kiếm nằm hai đầu nắm tay; Meshy: bàn tay mở phẳng, chuôi kiếm nằm ngoài lòng bàn tay.
- Chi tiết: giáp tay, đai, hoa văn áo, giáp vai rõ nét. Tam giác gốc 50 nghìn → H35h 8996 (426 KB), H31h 9000 (435 KB), H33h 6000 (274 KB), H40h 5992 (273 KB), X19h 7490 (372 KB).
- Test: 43 tệp test của game đạt (models 22, rig-glb 17, bake-fit 15, rig-helpers 10, autorig 17); đã xem trong lab (đứng, đòn bổ C1, lộn né, N1 của đại kiếm WC01) và trong trận B15 (H35h, Trần Nhật Duật, Toa Đô) và B20 (Trần Hưng Đạo).
- Chưa làm: boss B20 `X20`, `X24`, `OFF_tuong`, ngựa `MOUNT_ngua_nguyen` (kỵ binh `NG_KYh` vẫn đặt người cưỡi mới lên ngựa Meshy).

### Đợt hai (17 GLB: lính Tự do, sĩ quan, cận vệ, lính đám đông)
Ảnh tham chiếu sinh bằng `design/tools/ai33-img.mjs` (mục trên), GLB Hunyuan3D để ở `design/glb/_raw/nhan-vat/<mã>_hunyuan.glb`. Mỗi mã làm đúng năm bước trên (`node design/tools/fit-arms.mjs …`, mục `CHARS` / `KIT_LIST` trong `catalog.mjs`, nướng, hai test). Thêm các tuỳ chọn catalog sau khi gặp lỗi mới:
- **`zs` (mét, khung nướng):** dời trục dọc của rig ra trước (+) hoặc sau (−) so với cổ. Mẫu AI hay có chân lệch khỏi cổ: `CV_cungh` (ống tên kéo hộp bao ra sau) chân lệch +0,14 m, `CV_giaoh` −0,05 m, nên test đế giày (`meta.foot`: mũi > 0,05, gót < 0) trượt; `zs: 0,06` / `−0,07` đưa mũi và gót về hai phía cổ chân.
- **`simp: { w, hi }` (lính Tự do, cận vệ):** mẫu áo rộng, mũ lớn (nón lá chiếm 12–17% số đỉnh) bị giảm lưới đều tay nên cánh tay còn ~40% số đỉnh của tướng mặc giáp (vai chỉ 0,8–1,2% trọng số, test (b) cần ≥ 2%; tăng `tris` tới 10 nghìn vẫn không đủ). `simp` đọc lưới ở `hi × tris`, dò khớp và trọng số trên lưới dày, rồi giảm còn `tris` có thuộc tính trọng số (`weldSimplify` attr): chỗ trọng số đổi (vai, khuỷu, cổ tay) giữ đỉnh, mũ (một xương) gộp thoải mái. `CV_cungh` và `CV_songdaoh` dùng `{ w: 2, hi: 4 }`: vai 2,1–2,3%, đỉnh 4,6 nghìn thay vì 5,9 nghìn. Thử tham số không ghi tệp: `node design/tools/weights-try.mjs <mã> '{"simp":{"w":2,"hi":4}}' …` (in phần trọng số mỗi khớp).
- **Lính đám đông:** `KIT_LIST` có `src` như `CHARS`; `HUN_KITS` cuối `catalog.mjs` sinh `<mã>h` từ bản Meshy (cùng `lods`, vũ khí, tua; khớp tay `FIX_*H`, không kế thừa hộp cắt, `shoulder`, `keep` của Meshy). Ba chỗ phải chỉnh để qua `models.test.mjs`: `NG_GIAOh` thân LOD0 455 (tổng 628 ≤ 640), `NG_DAOh` thân LOD2 112 (bóng chính diện ≥ 80%), `DV_NOh` `simp: { w: 1 }` (khúc cánh tay trên 1,5% → ≥ 2%). `bakeKit` / `bakeHorseKit` đọc `c.src`.
- **Chọn mô hình trong game:** `models.js` có `HUN2` (hệ số cỡ), `modelOf(mã)`, `sizeOf(mã, cỡ)`, `kitOf(mã)`, `kitFiles()`; `soldier.js`, `guard.js`, `crowd.js`, `main.js` (nạp trước đúng tệp đang dùng, không còn ký tự đại diện `char/CV_*`, `char/OFF_*`, `kit/*` nạp cả hai bản) và `lab.js` gọi chúng. `useMeshy()` (`?debug&rigmodel=meshy`, lab `&meshy`) trả về bản Meshy cho tất cả. Lab: `lab.html?view=rigs&rigs=linh_WC03_0,linh_WC03_2,cv_khien,cv_giao,cv_cung,cv_songdao,cv_daidao,doitruong,photuong` (lính Tự do và cận vệ dựng lúc chạy nên lab đăng ký sẵn); `view=state&s=ready` cho tám lính đám đông.
- **Cỡ:** sĩ quan `doitruong` 1,12 → 1,245 và `photuong` 1,22 → 1,342 giữ chiều cao đỉnh đầu như Meshy (Hunyuan thấp hơn 11% và 10% ở cùng cỡ); lính Tự do nhân 1,030 / 1,015; cận vệ đưa về đúng chiều cao thiết kế (khiên 1,80, giáo 1,78, cung 1,78, song đao 1,75, đại đao 1,85 m, nhân 1,12): cỡ 1,018–1,061 thay vì 1,04 cho cả năm lớp (đỉnh đầu Meshy lệch nhau 1,94–2,10 theo từng mẫu).
- **Test:** 43 tệp test của game đạt (`models.test.mjs`: 31 nhân vật rig + 16 lính đám đông, 22 mục đạt). **Hạn chế đã biết:** `rig-glb.test.mjs` chỉ đo thân Meshy (`H31`, `LINH_r01`, `LINH_r24`, đọc `char/<mã>.hkm`). Thử thêm `LINH_r01h`, `LINH_r24h`, `H31h` vào các vòng `["H31", "LINH_r01", "LINH_r24"]` thì bộ đòn đại kiếm WC01 trượt hai mục ở vài khung (nối đòn 60 khung/giây, nhát bổ): `LINH_r01h` C6 khuỷu nhảy 0,12 m một khung, Tuyệt Kỹ gươm vào cổ 1,3 cm và lưỡi quay 21–29° hai khung; `LINH_r24h` Tuyệt Kỹ gươm vào mặt 0,6–2,3 cm bốn khung, lộn né khuỷu nhảy 0,13–0,18 m, C6 lưỡi thấp nhất 0,102 m, Đòn Quyết 9 khung liền lệch > 45°; `H31h` C6 lưỡi quay 24°, Tuyệt Kỹ khuỷu nhảy 0,19 m (đã có từ đợt một, chưa ai chạy). Cánh tay Hunyuan (vai hẹp ±0,24–0,28, cẳng tay chếch 38° ra, 25–30° trước) khác Meshy mà bộ giải IK (`anim-wc01.js fitArms`, `solveRight`) chỉnh theo Meshy. Bộ đòn song đao WC03 (mặc định của lính Tự do) dùng bộ clip như H35h nên không bị. Muốn thấy lại: thêm hai mã `h` vào các vòng đó. Chưa sửa: mỗi lỗi chỉ vài khung (1/60 giây) trong đòn dài 0,3–4,4 giây, và Tuyệt Kỹ chỉ có từ bậc 4.

### Đợt ba (6 GLB trong lô 90 tệp thả vào `design/` ngày 2026-10-09: Triệu Trung, Yết Kiêu, dân làng, quân áo Tống)
Lô 90 tệp (75 `ENV_*`, 8 `PROP_*`, 2 `MOUNT_*`, 6 người) soát bằng `design/tools/glb-scan.mjs` và tờ xem trước `design/glb/contact-sheet.html` (chạy qua `design/tools/serve.mjs`, cổng 8950, ảnh ra `design/glb/_raw/sheets/`). Mọi tệp hợp lệ, một lưới ~50 nghìn tam giác, ba ảnh 4096², chân đặt ở y = 0, mặt về +Z, **mọi tệp chuẩn hoá cạnh dài ~1,2 m (người cao ~1,15 m)** nên cỡ thật lấy từ bảng `glb-prompts.md`. Sáu người đi cùng đường như đợt hai: chuyển sang `design/glb/_raw/nhan-vat/<mã>_hunyuan.glb`, `fit-arms.mjs` (hai tay đối xứng, nắm đấm từ y 0,89–1,00), mục `catalog.mjs`, nướng, hai test.
- **Nhân vật rig:** `TTh` (Triệu Trung) và `H38h` (Yết Kiêu), tướng khác nên 6000 tam giác / 512². Cả hai trượt `models.test.mjs` (b) ở phần trọng số vai (H38h 1,9 / 1,4%, TTh 1,8%) như lính Tự do đợt hai: `simp: { w: 2, hi: 4 }` cho 2,7 / 2,7% và 3,2 / 3,3%. TT dùng `ARM_TUBE` (hộ tay), H38 ống mặc định (tay trần). TT, DV_AOTONG có ống tên đeo hông, H38 có cuộn dây vắt vai và túi hông: **dính vào lưới**, chưa tách thành `rigid`; không trượt test nào, nhưng cuộn dây của H38 theo vai trái.
- **Lính bộ (KIT_LIST, cuối `catalog.mjs`, không qua `HUN_KITS` vì chưa có bản Meshy):** `DV_AOTONGh` (quân áo Tống, cầm `cung_viet` ở tay trái như NG_CUNG; `wl` mức 2 phải là 24: với 12 cung chỉ phủ 58,8% trục dài, test (d) cần 70% LOD0), `DAN_NAMh`, `DAN_NUh` (LOD 466 / 216 / 86), `DAN_TREh` (396 / 190 / 80). Dân không cầm gì; quang gánh, tay nải (`PROP_quang_ganh`, `PROP_tay_nai`) chưa gắn.
- **Trong game:** `models.js` có `RIGS.TT` (cỡ 1,175) và `RIGS.H38` (1,135), cỡ tính theo chiều cao thiết kế (TT 1,76, H38 1,72 m) so với H40 (1,80 m, cỡ 1,23); `hat: "khan"` để code không thêm hai dải khăn đỏ lên đầu đã quấn khăn trong lưới. Xem: `lab.html?view=rigs&rigs=TT,H38&m=idle` hoặc `view=hero&hero=TT&m=dodge`; lính bộ xem bằng `lab.html?view=kit&kit=DV_NO&kitfile=DV_AOTONGh` (`&kitfile=` mới: tệp nướng chưa nối vào game, `kit=` chọn bộ tư thế).
- **Chưa nối:** (1) dân làng: `ambient.js` `Villagers` vẽ bằng `skinnedKit` (một khúc mỗi đỉnh, lưới dựng bằng code, "khúc mượn" làm đòn gánh, thúng, tay nải) chứ không `glbKit` như `crowd.js`, nên thay bằng `DAN_*h` là việc dựng lại phần vẽ và đồ mang; (2) ~~quân Triệu Trung ở Cờ áo Tống~~ **đã nối (2026-10-09, mục dưới)**; (3) TT, H38 chưa có trận dựng họ. **Cỡ DAN_TRE:** nướng ra cỡ người lớn vì chuẩn hoá theo độ cao vai; nơi dùng phải thu nhỏ (~0,7 so với người lớn, theo bảng: trẻ 1,15 m, nam 1,65 m, nữ 1,55 m).
- **Test:** mọi tệp test của game đạt (`node game/tools/run-tests.mjs`; `models.test.mjs` vẫn 22 mục đạt, 11 bỏ qua; `rig-glb.test.mjs` chỉ đo thân Meshy như ghi ở đợt hai).
- **Đã nối: cung thủ áo Tống ở Cờ áo Tống (2026-10-09).** Mười hai người của quân Triệu Trung đổ bộ (`kesach.js landBoat`) từ giáo binh Đại Việt nhuộm hổ phách thành cung thủ `DV_AOTONG` (mô hình `kit/DV_AOTONGh`, khăn xanh ngọc, áo hổ phách, cung Việt như tranh D2), phe ta, cánh A, vẫn `role: "zone"` và quân cánh A vẫn +`effect.qTa`. Ba chỗ: (a) `tuning.js` `KITS.DV_AOTONG` (`GIAO_DV`, bắn xa tầm 14 m, **`w: 0`** nên `pickKit` không bao giờ chọn nó — kiểu chỉ sinh có chủ ý; số liệu lấy của nỏ thủ `DV_NO`, ĐỀ XUẤT BẢN THỬ; `pickKit` dự phòng nay là kiểu cuối có `w > 0`), `KIT_WEAPON.DV_AOTONG = "cung"` (tư thế như cung thủ Nguyên); (b) `models.js` `HUN_ONLY`: `kitOf("DV_AOTONG")` luôn `DV_AOTONGh` (không có bản Meshy), `kitFiles()` nạp trước nó cho mọi trận; (c) `soldiers.js` `BUILD.DV_AOTONG` là bản dựng bằng code dự phòng khi chưa nạp mô hình (Crowd dựng lưới cho MỌI kiểu trong `KITS`, nên thiếu nó là sập trong test Node). Đổi gameplay: giáo binh cận chiến thành cung thủ (hp 0,8, cong 0,9, giáp 0,8, tầm 14 m). Như trước, lính đổ bộ chỉ hiện khi tướng đứng gần bãi (tướng ở xa thì lính vùng chiến đấu tự gỡ về mô phỏng; chỉ còn +`qTa` ở cánh A). Test: `tests/coaotong.test.mjs` (5 mục: khai báo, mô hình, Crowd không mô hình, bắn thật ngang DV_NO, landBoat).

### Đợt năm (50 GLB thả vào `design/` ngày 2026-10-10: 14 tướng, 19 vũ khí, 14 cảnh, 2 thú, 1 đạo cụ)
Soát như đợt ba (`glb-scan.mjs`, tờ `contact-sheet.html`): 50 tệp hợp lệ, 1,58 GB, một lưới ~50 nghìn tam giác, ba ảnh 4096², chuẩn hoá cạnh dài ~1,2 m. Tệp chuyển vào `design/glb/_raw/nhan-vat/<mã>_hunyuan.glb` (14 tướng), `_raw/moi-truong/` (cảnh, thú, đạo cụ) và thư mục mới `_raw/vu-khi/WPN_<mã>.glb` (vũ khí). Ảnh soát: `_raw/sheets/sheet-design_glb__raw_*-sel.jpg`, `lab-gen-*.png`.
- **14 tướng** (lượt `tuong-moi` của `glb-prompts.md`: H27 Trần Thái Tông, H28 Trần Thủ Độ, H29 Lê Phụ Trần, H30 Trần Nhân Tông, H32 Trần Quang Khải, H34 Trần Khánh Dư, H36 Trần Bình Trọng, H37 Phạm Ngũ Lão, H39 Dã Tượng, X16 Ngột Lương Hợp Thai, X17 A Truật, X18 Thoát Hoan, X21 Lý Hằng, X23 Trương Văn Hổ): `fit-arms.mjs` đo cả 14 không cảnh báo, hai tay đối xứng; mục `<mã>h` trong `CHARS` (6000 tam giác / 512², X18 7500 / 1024² vì là boss), `ARM_TUBE`. Nướng 3–7 s mỗi mẫu. X21h còn 17 tam giác cầu ở hai nách (giáp vảy tay dày, đường tách hở 0,6 m ở C1 — `rig-glb.test`): ống tay `rad` +0,01 (0,06 / 0,08) thì hết; `w.mirror` không giúp. H32 (ống tên sau lưng), X16, X21 (ống tên / đao ở hông) dính vào lưới như TT, không trượt test.
- **`RIGS` (`models.js`):** cả 14, cỡ theo chiều cao thiết kế so với H40 (1,80 m, cỡ 1,23); vũ khí theo cột Đi kèm; `wpnAlt` (mới) chọn tệp vũ khí riêng cho kiểu vũ khí của rig: H34 `daikiem` → `daikiem_vandon`, X16 / X21 `cung_viet` → `cung_ng`, X17 `giao_dv` → `giao_ng`, H38 `dao` → `doandao`, Toa Đô X19 `dadao` → `daiphu` (G14 "cho Toa Đô nếu muốn đúng truyện"; chỉ đổi hình). Xem: `lab.html?view=rigs&rigs=H27,H28,H29,H30,H32,H34,H36&m=idle`.
- **Có trận dùng:** vua Trần Nhân Tông ở B17 (`director-b17.js` `B17_H30` = `RIGS.H30` + áo choàng vàng; bỏ mô hình Phó tướng nhuộm vàng `tintGold`) và Thoát Hoan, boss B16 (`data/battle-b16.js` `rigKey: "X18"`, `RIGS.X18` = rig "Tướng Nguyên" + mô hình X18h). Cả hai **giữ cỡ cũ** (1,342 và 1,38) vì bán kính va chạm `BigUnit` = 0,9 × cỡ: luật trận không đổi. `data/battles.js` `models` nạp trước H30 (B17), X18 (B16); `battles/b16.js` `rigs` làm nóng X18.
- **Vũ khí Hunyuan3D thay bản Meshy** (cùng mã tệp game `wpn/<id>`; bảng Meshy cũ giữ ở `WEAPONS_MESHY`, quay về = đổi tên bảng rồi nướng lại `wpn` + `kit`). `glb-bake.mjs`: vũ khí có `raw` đọc GLB ngoài manifest. Mẫu Hunyuan dựng **mũi lên** (không `flip`); chỗ nắm đo lại từ mặt cắt (chắn tay cách nắm 5–6 cm); `guard: true` ghi `meta.guard` cho kiếm, đao không flip; nỏ báng dọc Z → `ry: 90` (`wpn.mjs` tự quay nửa vòng cho cánh nỏ về −X); khiên tròn: tay cầm sau nhô xa bằng núm trước, phép dò mặt hoà và chọn nhầm mặt sau → `face: 1`. Đại đao lần này **lưỡi thẳng hàng cán** (lỗi "lưỡi nằm cạnh cán như lá cờ" của Meshy hết; test `dadao` sửa theo: phía lưỡi rộng hơn ở +Y, chân lưỡi = `meta.head`). Sáu mẫu mới: `daiphu` (Toa Đô), `daikiem_vandon` (H34), `doandao` (H38), `quat` (Chiêu Văn H33 — chưa gắn: H33 đánh bằng giáo trong game), `duisat` (H38, chưa gắn), `moc_voi` (H39, chờ voi chiến).
- **Gươm Tiết chế (`daikiem`) giữ bản Meshy:** bản Hunyuan3D (chắn tay rộng hơn 0,08 m) làm vài khung Tuyệt Kỹ / C6 của WC01 (`anim-wc01.js` `fitArms`) vượt ngưỡng `rig-glb.test` (gươm vào mặt LINH_r24, lưỡi lệch > 45° 4–5 khung) ở mọi chỗ nắm thử 0,38 / 0,40 / 0,42. Tệp thô vẫn ở `_raw/vu-khi/WPN_daikiem.glb`.
- **Lính đám đông nướng lại** với vũ khí mới (mọi `KIT_LIST` trừ `DV_NO` giữ bản cũ). Hai chỉnh: nỏ cánh rộng 0,82 m nên `DV_NO` `wl` mức 2 22 (14 chỉ phủ 43%); bản Meshy `DV_GIAO` (chỉ dùng khi `?rigmodel=meshy`) nướng bằng bộ nướng hiện tại ở thân LOD2 100 thì mất một chân (bóng 65%; tệp cũ nướng bằng bản code trước ảnh chụp đầu): 106 (81%), bản Hunyuan giữ 100.
- **Test:** mọi tệp đạt (`node game/tools/run-tests.mjs`). `models.test` thêm `daikiem_vandon`, `doandao` vào phép kiếm (đoản đao: chuôi quấn dày, nới "chỗ nắm hẹp" ¾ chắn tay), `daiphu` vào phép đầu cán.
- **Cảnh, thú (đặt vào game):** lều nỉ tròn (Hàm Tử quan), lều vuông Nguyên (đồn, doanh trại), lều quân Trần (bản doanh B15, B20 mức xa, Võ trường giãn 1,45 / 1,33 / 2,2), nhà làng a / b xen nhau (làng ven bãi), lau sậy mức xa (ven sông B15, quanh hố ngập; B16, B20 giữ code vì tốn 4,3 lần / vượt ngân sách 120 nghìn), khóm tre mức xa, gò đá (đồ thêm trên gò tây), đá tảng và khúc gỗ chặn luồng B20 (mức xa), giá mái chèo bến B20, bia Sát Thát Võ trường (chữ vẽ canvas lên tấm dán: bớt 5 lượt vẽ), trâu (thân tĩnh + cổ đầu xoay ở khớp đầu code, chân đuôi code vẫn bước), lều lương "Đánh úp trại" (director-td.js, lều cháy thay khung ENV_khung_leu_chay; world.js ghi chỗ chiếm sân doanh trại L.yard để lều tránh nhà). Mọi chỗ: envPart || khối code, giữ rng và vật va chạm (env.test so InstancedMesh có / không mẫu); dấu vết bot B15 trùng main 21c9c8e ở cả bốn mốc; B15 lượt vẽ cao nhất 116. Tam giác: B15 +628, Võ trường +8.420, B20 +7.456 (117–120 nghìn / 120: gần hết chỗ; ngân sách vật tĩnh B20 trong env.test nâng 8.000 → 10.000). Bỏ qua: long thuyền (chưa có chỗ), voi chiến, cờ lưng. **Khóm tre trông như búi cỏ khổng lồ 9 m** (không ra thân tre, tán lá) — nên tạo lại mẫu.
