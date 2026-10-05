# GLB tạo bằng Meshy

Mẫu 3D tĩnh tạo bằng Meshy API từ đúng prompt trong `design/glb-prompts.md`. Nhân vật và vũ khí là **tệp riêng**: nhân vật tay không, vũ khí là một vật đứng một mình.

| Thư mục | Chứa | Tiền tố tệp |
| --- | --- | --- |
| `nhan-vat/` | Tướng, sĩ quan, người lính Tự do, cận vệ (`char_`), lính đám đông và dân làng (`unit_`). Bản làm lại `…_v2.glb` nằm cạnh tệp cũ | `char_`, `unit_` |
| `vu-khi/` | Đao, kiếm, giáo, cung, nỏ, chùy, khiên | `wpn_` |
| `dao-cu/` | Mũi tên, cờ lưng, áo choàng, bành voi… | `prop_` |
| `thu-cuoi/` | Ngựa, voi, trâu | `mount_` |
| `moi-truong/` | Môi trường (mã `ENV_`): thuyền, công trình, đạo cụ cảnh, cây, đá, núi, cò, quạ. Đã có 89 prompt (`glb-prompts.md` mục K–O; bộ `moi-truong` 86, ba mục tuỳ chọn ở `tuy-chon`), chưa có tệp nào; chưa có bước nướng môi trường (đầu mục K của tài liệu). Mã `ENV_` luôn đi với tệp `env_` (công cụ báo lỗi nếu lệch) | `env_` |

Còn phải tạo gì, theo thứ tự nào, mỗi lượt tốn bao nhiêu credit và Claude phải làm gì sau đó: mục 0.8 của `glb-prompts.md`.

`manifest.json` ghi từng tệp: mã task Meshy, model, số tam giác trước và sau khi nén, dung lượng, kích thước khung bao. Xem nhanh mọi mẫu: mở `xem.html` qua máy chủ tĩnh ở gốc repo (ví dụ `npx serve .` rồi vào `/design/glb/xem.html`). Ảnh tổng hợp nằm ở `xem-truoc/`.

## Tình trạng đợt đầu (2026-10-02)

Đã tạo đủ 40 tệp game hiện cần (`--set can`): 25 nhân vật, 13 vũ khí, mũi tên, ngựa cung kỵ. Tổng khoảng 21 MB (nhân vật 18 MB, tướng 0,9–1,5 MB, lính đám đông 0,25–0,3 MB, vũ khí 0,1–0,25 MB). Cả 40 tệp nạp được bằng `GLTFLoader` của game, không lỗi. Đã dùng hết 1100 credit Meshy: 45 cho cặp chạy thử, 485 dựng lưới lần đầu, 170 dựng lại các lưới hỏng, 400 tô texture.

![Nhân vật](xem-truoc/nhan-vat.webp)
![Vũ khí, đạo cụ, ngựa](xem-truoc/vu-khi.webp)

Còn lệch so với `glb-prompts.md`, chưa làm lại vì hết credit. Từ đợt 19b mỗi mẫu lệch có một mục làm lại mã `_v2` ở mục P của tài liệu (`--set lam-lai`, 14 mục, khoảng 405 credit); tệp cũ giữ nguyên cho tới khi soát và chọn bản mới:

| Tệp | Lệch | Mục làm lại |
| --- | --- | --- |
| `char_H33` | Mũ vàng mọc cặp sừng (lần đầu thì đeo đao ở hông) | `H33_v2`: mũ bát vàng, một chóp son ngắn ở chính giữa |
| `char_X19` | Mũ có hai chóp nhọn như sừng | `X19_v2`: mũ lông trụ thẳng, một chóp vàng ngắn ở chính giữa |
| `char_X20` | Không có mũ lông và chóp vàng, dáng áo bào, giáp mỏng | `X20_v2`: mũ lông trụ thẳng, một chóp vàng ngắn (chùm lông đỏ code dựng), giáp nặng tới gối |
| `unit_DV_DAO` | Bao đao ở hông trái; đội nón thay vì khăn đỏ quấn đầu | `DV_DAO_v2`: đầu trần khăn son, thắt lưng trơn |
| `wpn_dadao` | Lưỡi lớn nằm cạnh cán thay vì ở đầu cán (bước nướng đang bù bằng `side`, `flip`) | `WPN_dadao_v2`: tả lưỡi trước, lưỡi và cán thẳng hàng; dựng lưới bằng meshy-5 trước (`latest` từng chỉ ra cây gậy) |
| `char_LINH_r01`, `char_CV_giao`, `char_CV_cung`, `char_CV_songdao` | Đội mũ trụ đỏ thay vì nón lá; CV_giao có râu, CV_songdao ra mặt già tóc bạc | Mục `_v2` đầu trần buộc khăn đỏ, nón lá là `prop_non-la.glb` gắn bằng code (Meshy chưa dựng được nón lá vành rộng lần nào) |
| `unit_DV_GIAO`, `unit_DV_NO` | Nón chóp nhỏ (giống mũ nhọn phe Nguyên), mũ lưỡi trai | `DV_GIAO_v2`, `DV_NO_v2`: đầu trần khăn then; nón gộp vào bộ lính khi nướng (PROP_non_la co về cỡ code), không thử nón lần thứ bảy |
| `char_OFF_photuong` | Mũ có mào tua tủa thay vì chóp xám bạc | `OFF_photuong_v2`: mũ lông trụ thẳng, một chóp xám bạc ngắn ở chính giữa |
| `char_OFF_doitruong` | Gần T-pose; tay phải không rig được | `OFF_doitruong_v2` |
| `wpn_giao-dv` | Có một chùm cánh nhỏ dưới mũi giáo | `WPN_giao_dv_v2`: một lưỡi lá dẹt |
| Mọi nhân vật | Tay dang gần ngang hơn A-pose 45° của tài liệu, khuỷu gập, nên bộ dò khớp đặt sai khuỷu | Mục `_v2` và mọi mục người mới viết bằng POSE v2 (`glb-prompts.md` mục 2.2) |

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

Bảng chọn cỡ lưới, texture, chỗ cầm vũ khí: `design/tools/bake/catalog.mjs`.

| Loại | Gắn vào | Cách làm (tệp trong `design/tools/bake/`) |
| --- | --- | --- |
| Tướng, sĩ quan, cận vệ, người lính Tự do (17) | 15 khớp của rig tướng (`battle/models.js` `makeRig`), cùng hoạt ảnh như trước | `landmarks.mjs` dò khớp trên lưới (đo đường dọc mặt lưới từ đầu ngón tay, nên tay đưa trước ngực, áo dài không lẫn), `human.mjs` dựng khung gắn theo dáng tay của mẫu và trọng số da, `char.mjs` ghi lưới da + vị trí vai, khuỷu, cổ tay, cổ riêng của mẫu. Lưới hàn đỉnh, giảm đúng ngân sách, trải UV lại và nướng texture mới (`rebake.mjs`): tướng chơi được, người lính Tự do 9 nghìn tam giác, texture 1024; tướng khác, sĩ quan 5–6 nghìn, boss 7,5 nghìn, cận vệ 5 nghìn, texture 512 |
| Lính đám đông (8 kiểu, gồm cung kỵ) | Bộ khúc instanced (`soldier-motion.js`), vẽ bằng `soldiers.js` `glbKit` | `kit.mjs` đưa mẫu về tư thế nghỉ của bộ khúc, mỗi đỉnh ≤ 2 khúc, ghép vũ khí vào cẳng tay. 3 mức chi tiết: LOD0 (< 18 m) ~550–640 tam giác, trải UV lại bằng xatlas và nướng texture 512 riêng (`rebake.mjs`); LOD1 (< 40 m) ~250–310, LOD2 ~100–145, tô màu đỉnh |
| Vũ khí (13) + mũi tên | Tay rig tướng, cẳng tay lính | `wpn.mjs` đặt gốc ở chỗ nắm, cán theo +Z, đúng chiều dài thật |

Lúc chạy, `game/js/battle/glb.js` nạp mô hình trong màn tải trận (`main.js` `loadModels`: tướng người chơi, lính, vũ khí, cận vệ, sĩ quan trước; phần còn lại tải ngầm). Mô hình nào chưa nạp được thì game dựng hình bằng code như cũ. Soát nhanh: `game/lab.html?view=state&s=idle&lod=0` (lính đám đông, `lod=1`, `2` cho mức xa), `lab.html?view=rigs` (tướng).

## Tạo thêm hoặc làm lại

```bash
cd design/tools && npm i && cd ../..
export MESHY_API_KEY=...            # không ghi key vào repo
node design/tools/meshy.mjs balance
node design/tools/meshy.mjs list --only H34,H38 --prompt          # xem đúng prompt sẽ gửi
node design/tools/meshy.mjs list --set tat-ca --hash              # băm, độ dài API, tam giác; so với manifest
node design/tools/meshy.test.mjs                                  # không mạng: đọc tài liệu, 40 băm cũ không đổi
# Bước 1: chỉ dựng lưới xám, rồi ghép ảnh lưới để soát
node design/tools/meshy.mjs run --only H34,H38 --stage luoi
node design/tools/meshy.mjs sheet design/glb/_raw/to-xem.png --only H34,H38
# Lưới nào hỏng thì dựng lại (mã --redo phải có trong --only; tệp cũ trong _raw/ đổi tên .cu-<giờ>, không xoá):
#   run --only H38 --redo H38 --stage luoi
# Bước 2: tô texture, tải và nén
node design/tools/meshy.mjs run --only H34,H38
```

Lệnh đủ cho từng lượt còn lại (dân làng và nón lá, làm lại, môi trường, tướng mới, tuỳ chọn), kèm credit ước tính: mục 0.8 của `glb-prompts.md`.

Bộ chọn (`--set`):

| Bộ | Gồm |
| --- | --- |
| `thu` | Cặp thử H35 + song đao |
| `can` | 40 tệp game đang dùng (mặc định của `run`); không bao giờ gồm mục mới |
| `thieu` | Thứ game còn dựng bằng code: dân làng (`DAN_*`), áo Tống, nón lá, quang gánh, tay nải, ống tên, trâu, thú ở mục O (12 mục) |
| `moi-truong` | Mã `ENV_` trừ mục ghi tuỳ chọn ở đầu mục: thuyền, công trình, đạo cụ cảnh, cây, đá, núi, cò, quạ (86 mục, tệp `env_` vào `moi-truong/`) |
| `lam-lai` | Mọi mã `_v2`, `_v3` (làm lại mẫu cũ, ra tệp mới cạnh tệp cũ): 14 mục ở mục P của tài liệu |
| `tuong-moi` | Tướng có tên (mã H.., X.., TT) chưa có GLB: H34, H38, H39 và 15 tướng chuyển từ `design/3d-ref/PROMPTS-TUONG.md` (mục A8–A15, B7–B13), 18 mục |
| `tuy-chon` | Mục không thuộc bộ nào ở trên (cờ lưng, áo choàng, vũ khí tuỳ chọn, ngựa tướng, voi, bành, giáp voi) và ba mục môi trường tuỳ chọn K10, L22, N17: 15 mục. Không gồm LINH_r2 (còn khối POSE cũ, chỉ chạy bằng `--only`) |
| `tat-ca` | Mọi mục: 40 mã `can` trước, rồi theo thứ tự bảng. `run --set tat-ca` bỏ LINH_r2 (chỉ dựng khi ghi trong `--only`) |

Các bộ mới tính từ mã và chữ mục, nên mục thêm sau tự vào đúng bộ; bộ chưa có mục nào thì công cụ báo và dừng. Chạy lại chỉ làm phần chưa xong. Tài liệu đọc được cả khi cây làm việc là CRLF (Windows, `core.autocrlf`). Lỗi trong tài liệu báo ngay khi đọc, trước mọi lệnh: thiếu PROMPT, mục có PROMPT mà không có dòng bảng, trùng mã ở hai dòng bảng hay hai mục `###` (hay gặp khi chép mục làm `_v2`), tiền tố tệp lạ, tên tệp không phải tiền tố + mã + `.glb`, mã `_v2` không có dòng mã gốc hay tệp, nhóm khác mã gốc, dải tam giác sai (lo > hi, dấu phân cách nghìn, mục tiêu dưới 300), ghi cả `Symmetry: bật` lẫn `tắt`, mục người thiếu nguyên khối POSE hoặc POSE v2. `list` đánh dấu `> 600!` bản API quá dài. `--only` bỏ mã trùng.

**Sửa prompt của mẫu đã có là mua lại và ghi đè.** Băm (`list --hash`) tính từ đúng bản gửi API, số tam giác và đối xứng; băm khác manifest ở mã đã trả tiền thì `run` dừng trước khi gọi Meshy và nêu mã: mẫu đã xong (nếu cố ý mua lại, ghi đè tệp trong thư mục này, thì ghi mã vào `--redo`), và cả mẫu mới có lưới mà sửa chữ trước lần tô texture (mua lại lưới cũng qua `--redo`); `list --hash` trả mã 1 khi có dòng ≠. Muốn làm lại một mẫu cũ (mũ mọc sừng, tay dang ngang…), thêm mục mới mã `_v2` thay vì sửa mục cũ (`glb-prompts.md` mục 0.5): dòng bảng `H33_v2` · tệp `char_H33_tran-nhat-duat_v2.glb` · nhóm của mã gốc, và mục `### P1 · H33_v2 · …` có PROMPT viết bằng POSE v2 (mục 2.2). Mã `_v2` có dòng riêng trong `manifest.json`, tệp gốc riêng ở `_raw/`, tệp nén riêng (`nhan-vat/char_H33_tran-nhat-duat_v2.glb`), giữ quy tắc riêng của mã gốc (texture 2048 cho H35, H31, người lính Tự do; đối xứng cho ngựa) nhưng không mang theo bảng `FIX` của mã gốc trong `meshy.mjs`. Tệp cũ còn nguyên cho tới khi chọn xong.

Chuyển bản nướng sang tệp `_v2` (khi đã soát và chọn bản mới): `glb-bake.mjs` đọc đường dẫn tệp từ `manifest.json` theo mã.

- Vũ khí, mũi tên: đổi `src` của mục trong `design/tools/bake/catalog.mjs` `WEAPONS` sang mã mới (`src: "WPN_dadao_v2"`). Ngựa của kỵ binh: đổi `horse` của `KIT_LIST.NG_KY` (`horse: "MOUNT_ngua_nguyen_v2"`). Không phải sửa code.
- Tướng, cận vệ, lính đám đông: khoá của `CHARS` và `KIT_LIST` vừa là mã manifest vừa là tên tệp game nạp (`char/H33.hkm`), nên đừng đổi khoá. Thêm `src: "H33_v2"` vào mục catalog và cho `glb-bake.mjs` đọc `man[c.src ?? code].path` thay cho `man[code].path` ở ba chỗ (phần `char`, và hai lệnh `bakeHorseKit`, `bakeKit` ở phần `kit`). Sửa nhỏ này để tới lúc cần, vì phần nướng đang được sửa song song ở nhánh khác.
- Rồi nướng lại: `node design/tools/glb-bake.mjs char --only H33` (hoặc `kit`, `wpn`).

Model: `--model` (mặc định `latest`) cho tướng, sĩ quan, người lính Tự do, cận vệ, ngựa; `--model-linh` cho lính đám đông và dân làng; `--model-vk` cho vũ khí, đạo cụ; `--model-mt` cho môi trường (mặc định bằng `--model-vk`). Lần đầu đã dùng `--model-linh meshy-5 --model-vk meshy-5` để vừa ngân sách (lưới meshy-5 tốn 5 credit, `latest` tốn 20; texture 10). Song đao dùng `latest` vì bản meshy-5 ra dáng dao găm.

Prompt gửi API khác bản trong tài liệu ở ba chỗ, vì API v2 của Meshy bỏ qua `negative_prompt`: khối STYLE và POSE rút gọn; nhân vật thêm câu chặn "không vũ khí, không bao đao, không sừng, không áo choàng" (bản thử đầu của H35 tự mọc mũ có sừng kiểu kabuto và đeo hai thanh đao ở hông); ai không có mũ trong prompt thì thêm "No helmet." Mục mới viết bằng POSE v2 (`glb-prompts.md` mục 2.2) được đổi sang bản API riêng của khối đó, vẫn có câu chặn.

Bản quyền: tệp tạo bằng gói Meshy trả phí thuộc người tạo; gói miễn phí theo CC BY 4.0 (phải ghi công Meshy). Ghi gói đã dùng vào `game/assets/SOURCES.md` khi đưa mẫu vào game.
