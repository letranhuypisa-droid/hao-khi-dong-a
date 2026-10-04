# GLB tạo bằng Meshy

Mẫu 3D tĩnh tạo bằng Meshy API từ đúng prompt trong `design/glb-prompts.md`. Nhân vật và vũ khí là **tệp riêng**: nhân vật tay không, vũ khí là một vật đứng một mình.

| Thư mục | Chứa | Tiền tố tệp |
| --- | --- | --- |
| `nhan-vat/` | Tướng, sĩ quan, người lính Tự do, cận vệ (`char_`), lính đám đông và dân làng (`unit_`) | `char_`, `unit_` |
| `vu-khi/` | Đao, kiếm, giáo, cung, nỏ, chùy, khiên | `wpn_` |
| `dao-cu/` | Mũi tên, cờ lưng, áo choàng, bành voi… | `prop_` |
| `thu-cuoi/` | Ngựa, voi | `mount_` |

`manifest.json` ghi từng tệp: mã task Meshy, model, số tam giác trước và sau khi nén, dung lượng, kích thước khung bao. Xem nhanh mọi mẫu: mở `xem.html` qua máy chủ tĩnh ở gốc repo (ví dụ `npx serve .` rồi vào `/design/glb/xem.html`). Ảnh tổng hợp nằm ở `xem-truoc/`.

## Tình trạng đợt đầu (2026-10-02)

Đã tạo đủ 40 tệp game hiện cần (`--set can`): 25 nhân vật, 13 vũ khí, mũi tên, ngựa cung kỵ. Tổng khoảng 21 MB (nhân vật 18 MB, tướng 0,9–1,5 MB, lính đám đông 0,25–0,3 MB, vũ khí 0,1–0,25 MB). Cả 40 tệp nạp được bằng `GLTFLoader` của game, không lỗi. Đã dùng hết 1100 credit Meshy: 45 cho cặp chạy thử, 485 dựng lưới lần đầu, 170 dựng lại các lưới hỏng, 400 tô texture.

![Nhân vật](xem-truoc/nhan-vat.webp)
![Vũ khí, đạo cụ, ngựa](xem-truoc/vu-khi.webp)

Còn lệch so với `glb-prompts.md`, chưa làm lại vì hết credit:

| Tệp | Lệch | Cách xử lý đề xuất |
| --- | --- | --- |
| `char_H33` | Mũ vàng mọc cặp sừng (lần đầu thì đeo đao ở hông) | Cắt sừng khi rig, hoặc tạo lại khi có credit |
| `char_X19` | Mũ có hai chóp nhọn như sừng | Như trên |
| `unit_DV_DAO` | Bao đao ở hông trái; đội nón thay vì khăn đỏ quấn đầu | Xoá mảnh bao đao khi rig |
| `wpn_dadao` | Lưỡi lớn nằm cạnh cán thay vì ở đầu cán | Dời lưỡi lên đầu cán khi đặt trục vũ khí |
| `char_LINH_r01`, `char_CV_giao`, `char_CV_cung`, `char_CV_songdao` | Đội mũ trụ đỏ thay vì nón lá | Meshy chưa dựng được nón lá vành rộng; có thể gắn nón lá dựng bằng code |
| `unit_DV_GIAO`, `unit_DV_NO` | Nón chóp nhỏ, khác dáng nón trong prompt | Chấp nhận được ở cỡ lính đám đông |
| `char_OFF_photuong` | Mũ có mào tua tủa thay vì chóp xám bạc | Chấp nhận, hoặc tạo lại |
| `wpn_giao-dv` | Có một chùm cánh nhỏ dưới mũi giáo | Xoá khi đặt trục, hoặc giữ làm tua |
| Mọi nhân vật | Tay dang gần ngang hơn A-pose 45° của tài liệu | Rig vẫn dùng được |

Lính đám đông (nhóm C, D) và vũ khí, đạo cụ dùng meshy-5 cho vừa ngân sách; tướng, sĩ quan, người lính Tự do, cận vệ, ngựa, song đao và nỏ dùng model mới nhất (cột `model` trong `manifest.json`). Mặt nhân vật quay về +Z; ngựa quay theo trục X (xoay khi rig).

## Đã làm gì với tệp gốc của Meshy

Tệp gốc (texture PNG 2048, nặng) không đưa vào git. Công cụ nén chỉ làm ba việc:

- Texture màu đổi sang WebP 1024; riêng hai tướng chơi được (H35, H31) và người lính Tự do giữ 2048, vì camera bám sát họ suốt trận.
- Đặt gốc toạ độ ở giữa đáy (đứng trên mặt đất y = 0).
- Giảm lưới nếu Meshy trả quá dải tam giác của bảng mục 1.

Không đổi đơn vị, không xoay, không lượng tử hoá lưới. Chiều cao còn theo đơn vị của Meshy; chuẩn hoá mét, hướng +Z, gốc và trục vũ khí, `grip2` làm khi rig (mục 0.3 của `glb-prompts.md`).

## Đưa vào game: rig và nướng (`design/tools/glb-bake.mjs`)

Game không nạp GLB lúc chạy (bản deploy không có `GLTFLoader`). Công cụ nướng đọc `design/glb/*.glb` và ghi `game/assets/models/` (tệp `.hkm` lưới nhị phân + texture WebP, `index.json` liệt kê). Không cần mạng, không tốn credit.

```bash
cd design/tools && npm i && cd ../..
node design/tools/glb-bake.mjs all                 # hoặc char | kit | wpn, thêm --only H35,DV_GIAO
```

Bảng chọn cỡ lưới, texture, chỗ cầm và chiều vũ khí, hộp cắt phần thừa, khớp ghi tay: `design/tools/bake/catalog.mjs`.

| Loại | Gắn vào | Cách làm (tệp trong `design/tools/bake/`) |
| --- | --- | --- |
| Tướng, sĩ quan, cận vệ, người lính Tự do (17) | 15 khớp của rig tướng (`battle/models.js` `makeRig`), cùng hoạt ảnh như trước | `landmarks.mjs` dò khớp trên lưới (đo đường dọc mặt lưới từ đầu ngón tay, nên tay đưa trước ngực, áo dài không lẫn; trục tay là tâm các vòng đẳng mức liền; khuỷu ở chỗ gập trong dải tỉ lệ cánh tay / cẳng tay hợp lý, hai tay cùng tỉ lệ; cổ dò dưới mũ). `human.mjs` cắt phần thừa (sừng mũ H33, X19), kiểm từng tay (cánh tay 0,18–0,40 m, cẳng tay 0,18–0,34, hai tay lệch ≤ 25%, vai): tay sai thay bằng tay kia đối xứng, rồi tỉ lệ người trên trục dò được, không được thì dừng nướng, báo tên mẫu — thêm khớp ghi tay vào `catalog.mjs` (đang có OFF_tuong, CV_daidao, lính DV_NO; trọng số tay theo khớp ghi tay); dựng khung gắn theo dáng tay của mẫu (bản lề khuỷu theo mặt gập khuỷu) và trọng số da mềm (`weights15`: dải smoothstep theo chuỗi xương — eo tăng đều từ khớp đùi tới giữa ngực, khoảng cách tới trục chân tính cả bàn chân nên mũi giày không theo hông, vạt áo dựa hông — rồi làm mượt trên lưới hàn, đỉnh ngoài dải neo yên, trung bình theo 1 / độ dài cạnh; chỉ trộn xương kề nhau, ≤ 4 xương; mũ cứng theo đầu; số dải ở `WEIGHT_PRM`). `char.mjs` ghi lưới da + vị trí vai, khuỷu, cổ tay, cổ riêng của mẫu (lúc chạy trùng khung gắn, kể cả H31 đại kiếm) và đế giày (`meta.foot`, IK chân đặt đế lưới xuống đất). Lưới hàn đỉnh, giảm đúng ngân sách, trải UV lại và nướng texture mới (`rebake.mjs`): tướng chơi được, người lính Tự do 9 nghìn tam giác, texture 1024; tướng khác, sĩ quan 5–6 nghìn, boss 7,5 nghìn, cận vệ 5 nghìn, texture 512 |
| Lính đám đông (8 kiểu, gồm cung kỵ) | Bộ khúc instanced (`soldier-motion.js`), vẽ bằng `soldiers.js` `glbKit` | `kit.mjs` đưa mẫu về tư thế nghỉ của bộ khúc (cùng trọng số mềm của `human.mjs`), mỗi đỉnh ≤ 2 khúc liền nhau (cha – con: gấu áo không trộn bàn chân + chậu), ghép vũ khí vào cẳng tay (bao đao DV_DAO cắt bỏ; neo tua giáo ở chân mũi, `meta.tas`). 3 mức chi tiết: LOD0 (< 18 m) ~550–640 tam giác, trải UV lại bằng xatlas và nướng texture 512 riêng (`rebake.mjs`); LOD1 (< 40 m) ~250–310, LOD2 ~100–145, tô màu đỉnh; tua giáo nhỏ dần theo mức (36 / 20 / 12 tam giác), giáo, đao LOD2 đủ tam giác để còn cán, lưỡi |
| Vũ khí (13) + mũi tên | Tay rig tướng, cẳng tay lính | `wpn.mjs` đặt gốc ở chỗ nắm, cán theo +Z, đúng chiều dài thật. Kiếm, đao Meshy dựng mũi xuống: `flip`, tay nắm chuôi ngay dưới chắn tay; đại đao nắm cán dưới đĩa chắn (lưỡi chạy dọc nửa trên cán); giáo, đại đao ghi chân đầu (`meta.head`) để treo tua |

Lúc chạy, `game/js/battle/glb.js` nạp mô hình trong màn tải trận (`main.js` `loadModels`: tướng người chơi, lính, vũ khí, cận vệ, sĩ quan trước; phần còn lại tải ngầm). Mô hình nào chưa nạp được thì game dựng hình bằng code như cũ. Soát nhanh: `game/lab.html?view=state&s=idle&lod=0` (lính đám đông, `lod=1`, `2` cho mức xa), `lab.html?view=rigs` (tướng). Kiểm tự động trên tệp đã nướng (không cần node_modules): `node game/tests/models.test.mjs` (độ dài tay, vai, cổ, bản lề khuỷu, đế giày, phần cắt, chiều vũ khí, neo tua, trọng số, lính đám đông).

## Tạo thêm hoặc làm lại

```bash
cd design/tools && npm i && cd ../..
export MESHY_API_KEY=...            # không ghi key vào repo
node design/tools/meshy.mjs balance
node design/tools/meshy.mjs list --only H34,H38 --prompt          # xem đúng prompt sẽ gửi
# Bước 1: chỉ dựng lưới xám, rồi ghép ảnh lưới để soát
node design/tools/meshy.mjs run --only H34,H38 --stage luoi
node design/tools/meshy.mjs sheet design/glb/_raw/to-xem.png --only H34,H38
# Lưới nào hỏng thì dựng lại: run --only H38 --redo H38 --stage luoi
# Bước 2: tô texture, tải và nén
node design/tools/meshy.mjs run --only H34,H38
```

`--set thu` là cặp thử H35 + song đao, `--set can` là 40 tệp game hiện cần (mặc định), `--set tat-ca` là cả 63 mục. Chạy lại chỉ làm phần chưa xong. Sửa prompt trong `glb-prompts.md` thì công cụ tự coi là mẫu mới.

Model: `--model` (mặc định `latest`) cho tướng, sĩ quan, người lính Tự do, cận vệ, ngựa; `--model-linh` cho lính đám đông và dân làng; `--model-vk` cho vũ khí, đạo cụ. Lần đầu đã dùng `--model-linh meshy-5 --model-vk meshy-5` để vừa ngân sách (lưới meshy-5 tốn 5 credit, `latest` tốn 20; texture 10). Song đao dùng `latest` vì bản meshy-5 ra dáng dao găm.

Prompt gửi API khác bản trong tài liệu ở ba chỗ, vì API v2 của Meshy bỏ qua `negative_prompt`: khối STYLE và POSE rút gọn; nhân vật thêm câu chặn "không vũ khí, không bao đao, không sừng, không áo choàng" (bản thử đầu của H35 tự mọc mũ có sừng kiểu kabuto và đeo hai thanh đao ở hông); ai không có mũ trong prompt thì thêm "No helmet."

Bản quyền: tệp tạo bằng gói Meshy trả phí thuộc người tạo; gói miễn phí theo CC BY 4.0 (phải ghi công Meshy). Ghi gói đã dùng vào `game/assets/SOURCES.md` khi đưa mẫu vào game.
