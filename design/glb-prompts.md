# Prompt tạo GLB: tướng, lính, cận vệ, vũ khí, đạo cụ, ngựa, voi, môi trường, thú

Tài liệu này gom prompt để bạn tạo mẫu 3D (GLB) bằng công cụ AI (Meshy, Tripo, Rodin, Hunyuan3D…) cho mọi nhân vật đang có trong game **Hào Khí Đông A**, và cho môi trường (thuyền, công trình, đạo cụ cảnh, cây, đá, núi, thú; mục K–O). Bạn gửi tệp GLB, Claude sẽ rig, làm hoạt ảnh và thay khối hình dựng bằng code hiện nay.

**Đã tạo bằng Meshy API (2026-10-02):** 40 tệp game hiện cần nằm ở `design/glb/` (nhân vật, vũ khí, đạo cụ, thú cưỡi để thư mục riêng), tạo bằng `design/tools/meshy.mjs` từ đúng các PROMPT dưới đây; xem `design/glb/README.md` cho tình trạng từng tệp.

Ngoại hình và màu bám theo cách game đang vẽ: `game/js/battle/models.js` (RIGS: tướng, sĩ quan, cận vệ, người lính Tự do) và `game/js/battle/soldiers.js` (lính đám đông, ngựa, dân làng). Chỗ game còn thiếu thì lấy từ `design/canon.json` và truyện tranh (`comic/_shared/bible.json`). Chi tiết mà không nguồn nào ghi thì tài liệu tự chọn và đánh dấu **(đề xuất)** ở phần tiếng Việt.

---

## 0. Đọc nhanh

### 0.1 Hai cách dùng

1. **Chữ → 3D (nhanh nhất).** Mở công cụ, chọn Text to 3D, dán nguyên khối **PROMPT** của mục. Prompt đã kèm sẵn khối tư thế và khối phong cách, dài không quá 550 ký tự (Meshy cho tối đa 600); mục người viết bằng POSE v2 (mục 2.2) dài tới 565 ký tự vì khối tư thế dài hơn; riêng prompt môi trường (mục K–O) dài tới 630 ký tự, xem đầu mục K. Bản gửi API (in bởi `node design/tools/meshy.mjs list`) không quá 600. Nếu công cụ có ô *Negative prompt* thì dán khối **NEGATIVE** ở mục 2.3.
2. **Ảnh mẫu → 3D (đẹp và ổn định hơn).** Dùng công cụ tạo ảnh để vẽ ảnh mẫu trước, chọn ảnh ưng ý, rồi đưa vào Image to 3D. Prompt ảnh mẫu = khối **ẢNH-MỞ** + PROMPT của mục + khối **ẢNH-ĐÓNG** (mục 2.4, có ví dụ ghép sẵn). Ảnh mẫu luôn ra một tờ có hai hình (mặt trước và nghiêng). **Luôn cắt tờ ảnh thành từng hình riêng, đừng đưa cả tờ vào công cụ 3D**: đưa cả tờ thì công cụ sẽ dựng ra hai người dính nhau hoặc một lưới hỏng. Công cụ chỉ nhận một ảnh: chỉ đưa ảnh **mặt trước**. Công cụ nhận nhiều ảnh (multi-view): ảnh mặt trước vào ô Front, ảnh nghiêng vào ô Left hoặc Right tuỳ ảnh cho thấy sườn trái hay sườn phải của nhân vật (xem hình minh hoạ cạnh từng ô trong công cụ). Cách này còn giữ được **cùng một khuôn mặt** giữa các tệp, ví dụ người lính Tự do ở bậc thấp và bậc cao.

Mẹo giữ phong cách đồng đều: làm xong ảnh mẫu đầu tiên (H35) thì dùng nó làm ảnh tham chiếu phong cách cho mọi ảnh mẫu sau.

### 0.2 Cài đặt trong công cụ

Mỗi công cụ đặt tên tuỳ chọn khác nhau. Cần chỉnh mấy thứ sau:

- **Số tam giác / số mặt mục tiêu** (Target polycount, Face limit): đặt theo cột "Tam giác" ở bảng mục 1.
- **Kiểu lưới** (Topology ở Meshy, Mesh mode ở Rodin): chọn **Triangle** (hoặc Raw). Nếu công cụ chỉ cho lưới tứ giác (Quad) thì đặt số mặt bằng **một nửa** cột "Tam giác", vì mỗi mặt tứ giác khi xuất GLB thành hai tam giác.
- **Tư thế**: nếu có tuỳ chọn A-pose thì bật.
- **Texture**: cỡ 1024 hoặc 2048, xuất **GLB** có texture nhúng sẵn.
- **Đối xứng** (Symmetry): bật cho ngựa và cho nhân vật mặc đồ cân hai bên. **Tắt** (Off, hoặc để Auto) với các mẫu có đồ lệch một bên: ống tên hay hộp tên sau lưng, bao tay một bên, dây vắt chéo vai. Đó là A4 H40, A6 H38, C3 DV_NO, C4 DV_AOTONG, D3 NG_CUNG, D5 NG_KY, F1 CV_khien, F3 CV_cung; phần Kỹ thuật của các mục này có ghi "Symmetry: tắt". Mục chưa tạo của các bộ `thieu`, `moi-truong`, `lam-lai`, `tuong-moi` (dân làng và đạo cụ của họ, môi trường, mục P làm lại, tướng mới) ghi rõ bật hay tắt ở phần Kỹ thuật. Bật đối xứng thì công cụ sẽ nhân đôi các chi tiết đó sang bên kia, dời vào giữa, hoặc xoá mất.

### 0.3 Phải đúng ngay khi tạo, và phần Claude tự sửa được

| Phải đúng ngay trong tệp (Claude không sửa được) | Claude tự sửa được (không cần lo) |
| --- | --- |
| A-pose: tay chếch xuống khoảng 45°, bàn tay mở, ngón hơi xoè (mục viết bằng POSE v2, mục 2.2: ngón khép là đúng), **tay không** | Đổi đơn vị sang mét, chỉnh chiều cao |
| Nhân vật không có áo choàng, cờ lưng hay vũ khí | Xoay mặt về +Z, đặt gốc toạ độ giữa hai bàn chân |
| Mặt nhìn thẳng, miệng khép, chân rộng bằng vai | Giảm số tam giác nếu tệp quá nặng (nhưng không cứu được lưới vỡ hoặc quá thô) |
| Đúng hình mũ, màu áo và phe (xem bảng màu mục 2.5) | Đặt gốc và trục vũ khí, thêm điểm `grip2` |
| Không có bệ, sàn, chữ, logo | Nén texture về 1024–2048 |
| Tỉ lệ người thật, không chibi | Dựng tua, dải khăn, vải áo choàng, vải cờ bằng code (có mô phỏng vải) |

Prompt không xin bao đao ở hông, dù quy cách cho phép: vũ khí đã là tệp riêng cầm tay, nên bao đao có chuôi sẽ thành hai thanh trong cảnh, và từ "sword" trong khối NEGATIVE cũng đẩy công cụ tránh tạo bao. Nếu công cụ tự thêm một bao **rỗng** (không có chuôi) ở hông thì vẫn dùng được.

Theo quy cách đã chốt, mũ, giáp và ống tên nên là object riêng trong tệp. Công cụ AI thường gộp mọi thứ thành một lưới. Nếu công cụ có chức năng tách phần thì dùng; nếu không thì **lưới liền vẫn dùng được**, Claude sẽ gán mũ và giáp bám cứng theo xương.

### 0.4 Thứ tự làm

| Đợt | Làm gì | Vì sao |
| --- | --- | --- |
| **Thử** | `char_H35_tran-quoc-toan` + `wpn_songdao` | Kiểm cả quy trình: tạo → rig → gắn vũ khí → so dáng trong game. Chốt xong mới làm hàng loạt |
| 1 | Lính đám đông B15: `unit_DV_GIAO`, `unit_NG_DAO`, `unit_NG_KY` + `mount_ngua-nguyen`, rồi `unit_NG_GIAO`, `unit_NG_CUNG`, `unit_DV_DAO`, `unit_DV_NO`, `unit_NG_TANK`, kèm vũ khí của họ | Hàng trăm người trên màn hình nên đổi diện mạo nhiều nhất |
| 2 | Tướng và sĩ quan B15: H33, H40, X19, OFF_doitruong, OFF_photuong | |
| 3 | B20: H31, X20, X24 (thêm `prop_co-lung`, `prop_cape` nếu muốn vải đẹp hơn bản code) | |
| 4 | Tự do và Võ trường: LINH_r01, LINH_r24, 5 lớp CV, OFF_tuong | |
| 5 (tuỳ chọn) | H34, H38 (chưa có trong game), vũ khí riêng (quạt, đại phủ…), ngựa tướng, voi chiến + bành + Dã Tượng | Game chưa dùng. Dân làng và áo Tống nay ở mức ưu tiên 1 của mục 0.8, vì game đang vẽ họ bằng code |
| 6 (môi trường) | Thuyền B20 (`env_thuyen-chien-tran`, `env_chien-thuyen-nguyen`, `env_ky-ham-nguyen`), cổng và tường Hàm Tử, lều lương Tự do, khóm tre, cột đá vôi; rồi phần còn lại của mục K–O (nón lá rời H5 nay ở mức ưu tiên 1 của mục 0.8) | Thuyền người chơi đứng và cổng là vật nhìn gần, lều lương hiện không có hình, tre và đá vôi là bóng dáng lớn nhất mỗi cảnh. Cần thêm bước nướng môi trường (đầu mục K) |

Phần còn phải tạo sau 40 mẫu đầu (thứ game còn vẽ bằng code, mục làm lại, tướng mới), thứ tự mua theo lượt, lệnh và credit: mục 0.8. Bảng trên là thứ tự của đợt đầu; chỗ hai bảng khác nhau thì theo mục 0.8.

### 0.5 Tên tệp

Tên tệp luôn suy ra được từ cột **Mã** ở bảng mục 1, theo ba quy tắc:

- **Tướng có tên** (mã H.., X..): `char_<mã>_<tên>.glb`. Mã giữ chữ hoa; tên viết thường không dấu, mỗi âm tiết nối bằng `-`. Ví dụ `char_H35_tran-quoc-toan.glb`.
- **Sĩ quan chung, người lính Tự do, cận vệ, lính đám đông, dân làng** (mã OFF_.., LINH_.., CV_.., DV_.., NG_.., DAN_..): mã đã gồm cả tên, nên tệp là tiền tố + mã giữ nguyên. Nhân vật dùng rig: `char_<mã>.glb`, ví dụ `char_OFF_tuong.glb`, `char_CV_khien.glb`, `char_LINH_r01.glb`. Lính đám đông và dân làng: `unit_<mã>.glb`, ví dụ `unit_DV_GIAO.glb`, `unit_DAN_NAM.glb`.
- **Vũ khí, đạo cụ, ngựa** (mã WPN_.., PROP_.., MOUNT_..): tiền tố viết thường (`wpn_`, `prop_`, `mount_`) + phần còn lại của mã, viết thường, `_` đổi thành `-`. Tên ghép đã viết liền trong mã thì giữ liền. Ví dụ `WPN_songdao` → `wpn_songdao.glb`, `WPN_dao_linh` → `wpn_dao-linh.glb`, `PROP_co_lung` → `prop_co-lung.glb`, `MOUNT_ngua_nguyen` → `mount_ngua-nguyen.glb`.
- **Môi trường** (mã ENV_..: thuyền, công trình, đạo cụ cảnh, cây, đá, núi): `env_` + phần còn lại của mã viết thường, `_` đổi thành `-`, ví dụ `ENV_thap_canh` → `env_thap-canh.glb`. Công cụ đặt tệp `env_` vào `design/glb/moi-truong/`; mã ENV_ phải đi với tệp `env_`.
- Làm lại thì thêm hậu tố `_v2`, `_v3`, đừng ghi đè tệp cũ: mã thêm hậu tố, tệp thêm hậu tố ngay trước `.glb`, ví dụ `H33_v2` → `char_H33_tran-nhat-duat_v2.glb`, `DV_DAO_v2` → `unit_DV_DAO_v2.glb`. Cột Nhóm giữ nhóm của mã gốc (công cụ chọn model và cỡ texture theo nhóm). Công cụ báo lỗi nếu tệp của mã `_v2` thiếu hậu tố, hoặc hai mục trùng một tệp.

### 0.6 Chỗ các nguồn lệch nhau và lựa chọn của tài liệu

| Chỗ lệch | Game đang vẽ | Truyện / canon | Tài liệu chọn |
| --- | --- | --- | --- |
| H31 giáp, mũ | Giáp then viền vàng, mũ trụ Tiết chế, râu bạc | Giáp lá đỏ viền vàng, khăn đen, râu đen điểm bạc | Theo game. Câu thay để làm theo truyện ghi ở A2 |
| H33 mũ, binh khí | Mũ tướng, giáo | Mũ lụa đen, quạt nan tre | Theo game. Câu thay mũ ở A3; quạt là tệp tuỳ chọn `wpn_quat` |
| X19 Toa Đô | Không râu, đại đao (rig chung với "Tướng Nguyên") | Râu điểm bạc, đại phủ | Thêm râu điểm bạc **(đề xuất)** để Toa Đô khác Tướng Nguyên chung; vẫn dùng đại đao, đại phủ là tệp tuỳ chọn |
| X20 binh khí | Đại đao | Gươm đặt dưới chân khi bị bắt | Đại đao như game |
| Song đao H35 | Chưa có tua | Tua lụa đỏ ở chuôi | Claude thêm tua bằng code |
| H40 ống tên, cung | Không ống tên, cung thẳng | Ống tên; cung sừng lớn | Ống tên dính thân; cung sừng hơi phản khúc `wpn_cung-viet` |
| Khiên của cận vệ Khiên thủ | Khiên tròn, chung lưới với Đội trưởng Nguyên | — | **(đề xuất)** dùng khiên nhật của quân Trần, phóng to, để hai phe khác nhau cả hình dáng (`models.js:3-5`) |
| Khiên quân Trần | Khiên nhật sơn son | Khiên mây tròn | Theo game |
| Người lính chọn WC01 | Giao diện gọi "Đại đao" nhưng lưới là đại kiếm | — | Dùng `wpn_daikiem` như game đang vẽ |
| Chữ "Sát Thát" trên tay | Không vẽ | Chính sử, nhưng canon H30 và `suquan-b20.js:8` không cho hiện trong trận | Không thích chữ lên mẫu |
| Cán cờ H35 | Sơn then | Cán tre | Theo game (then) |
| Tuổi Yết Kiêu | — | Truyện vẽ trẻ; thần tích cho khoảng 46 tuổi năm 1288 | Khoảng 30 **(đề xuất)** |

### 0.7 Lưu ý thêm

- **Không rig trong công cụ.** Claude rig mọi tệp bằng Blender (đã cài trên máy), kể cả ngựa và voi. Xuất **bản tĩnh, chưa rig, không hoạt ảnh** là đủ; nếu lỡ xuất bản đã rig thì vẫn dùng được.
- **Texture không có sẵn ánh sáng và bóng.** Chọn tuỳ chọn texture kiểu màu phẳng (albedo / base color), tắt bake ánh sáng nếu công cụ có. Game tự chiếu sáng; texture có sẵn bóng thì đứng dưới nắng trông bẩn. Khối NEGATIVE đã có `baked lighting, baked shadows`.
- **Có khe hở để xương tách được.** Ngón tay rời nhau, có khe giữa cánh tay và thân (nách), có khe giữa hai đùi. Chỗ nào dính liền thì rig kéo cả mảng lưới theo. Mục viết bằng POSE v2 (mục 2.2) xin ngón khép: ngón dính nhau ở các mục ấy là đúng prompt, đừng dựng lại; chỉ cần khe nách và khe đùi.
- **Áo không dài quá gối.** Prompt đều ghi áo tới gối. Áo bào phủ kín hai chân sẽ bị xé khi bước. Nếu công cụ ra áo dài hơn thì vẫn gửi, nhưng ghi chú để Claude thêm xương cho vạt áo.
- **Lính đám đông dùng chung một thân.** Game vẽ hàng trăm lính bằng một bộ xương chung, nên mọi mẫu nhóm C và D phải cùng chiều cao, cùng tỉ lệ (vai, tay, chân), chỉ khác mũ, giáp, áo. Làm DV_GIAO trước, rồi dùng ảnh mẫu của nó làm ảnh tham chiếu dáng người cho các kiểu lính còn lại, kể cả lính Nguyên. NG_TANK to con hơn là do code phóng to, không cần tạo thân to hơn.
- **Dung lượng.** Cả game hiện khoảng 28 MB. Claude sẽ nén mọi tệp: texture lính đám đông và vũ khí còn 1024, nhắm mỗi lính đám đông ≤ 1 MB, mỗi tướng ≤ 3–4 MB. Bạn cứ xuất 2048 nếu công cụ cho.
- **Bản quyền.** Game đang công khai trên mạng. Nhiều công cụ AI 3D ở gói miễn phí cấp tệp theo giấy phép CC BY (phải ghi công) hoặc không cho dùng thương mại. Kiểm gói bạn đang dùng và báo Claude để ghi nguồn vào `game/assets/SOURCES.md`.

### 0.8 Còn phải tạo (từ đợt 19)

40 mẫu game cần ở đợt đầu đã có (bộ `can`). Tài liệu nay có 183 mục; 143 mục chưa có GLB, tất cả đã có prompt đúng khuôn công cụ (bản API ≤ 600 ký tự). Liệt kê: `node design/tools/meshy.mjs list --set tat-ca --hash` (cột cuối ghi "chưa tạo").

**Còn thiếu, theo mức ưu tiên**

| Mức | Gồm | Bộ (`--set`) | Hiện trong game |
| --- | --- | --- | --- |
| 1. Game đang dựng bằng code | Nón lá rời PROP_non_la; dân làng DAN_NAM, DAN_NU, DAN_TRE cùng quang gánh, tay nải; quân áo Tống DV_AOTONG; ống tên rời; trâu, cò, quạ | `thieu` (12) | Dân, trâu, chim ở B15 và Tự do (`ambient.js`); quân Triệu Trung là giáo binh nhuộm hổ phách (`kesach.js:164`); bốn vai đội nón đang ra mũ trụ đỏ của GLB vì nón code bị bỏ khi có thân GLB (`models.js:181`) |
| 1. Game đang dựng bằng code | Môi trường: thuyền, công trình, đạo cụ cảnh, cây đá núi (mục K–N), trừ ba mục ghi tuỳ chọn | `moi-truong` (86, gồm cò, quạ của mục O) | Mọi cảnh B15, B20, Võ trường, Tự do; lều lương ở nhiệm vụ Đánh úp trại hiện không có hình |
| 2. GLB có rồi nhưng lệch prompt | 14 mục làm lại (mục P): mũ mọc sừng H33, X19, mào OFF_photuong, X20 thiếu mũ và giáp, đầu và nón lính Trần, bốn vai đội nón ra mũ trụ, giáo có cánh, lưỡi đại đao lệch cán, OFF_doitruong gần T-pose | `lam-lai` (14) | Đang hiện bản lệch |
| 3. Chưa có trong game | H34, H38, H39 và 15 tướng thời Trần từ `design/3d-ref/PROMPTS-TUONG.md` (mục A8–A15, B7–B13) | `tuong-moi` (18) | Chưa có trận dùng (B12–B14, B16–B19 chưa dựng; H34, H38 hiện "sắp có" ở B20) |
| 4. Tuỳ chọn | Cờ lưng, áo choàng (code đã dựng vải có lắc), vũ khí tuỳ chọn G14–G19, ngựa tướng, voi chiến, bành, giáp voi; long thuyền K10, miếu L22, dãy núi xa N17 | `tuy-chon` (15) | Không |

LINH_r2 (dòng 23a) không thuộc bộ nào: công cụ dựng nó từ prompt LINH_r24 nên còn khối POSE cũ (tay dang gần ngang) và câu mũ từng mọc sừng ở H33; muốn tạo thì thêm mục riêng viết bằng POSE v2 trước (mục 2.2). `list --set tat-ca` có in nó, nhưng `run --set tat-ca` bỏ nó; chỉ `run --only LINH_r2` mới dựng.

Chưa có prompt, phải viết sau: binh khí riêng của 15 tướng mới (kiếm khắc sóng và khiên mây H27, cờ lệnh H28, ván thuyền H29, bút lông H30, sóc H37, giáo móc X17, kích mạ vàng X18, kích X23, giáo lưỡi rộng X25; cột Đi kèm ở bảng mục 1 ghi vũ khí có sẵn dùng tạm). Ba vũ khí lệch nhẹ chưa có mục làm lại: `wpn_songdao` ra kiếm thẳng mũi nhọn hai cạnh thay vì đao mũi vát, `wpn_dao-linh` không hếch mũi, `wpn_daikiem` chắn tay kiểu châu Âu. Không cần credit: H31 lệch khuỷu trái phải và LINH_r24 khuỷu cao là lỗi bộ dò khớp, sửa trong `design/tools/bake/landmarks.mjs` hoặc ghi khớp tay trong catalog.

**Thứ tự tạo theo lượt**

Gọi là "lượt" cho khỏi lẫn với đợt làm việc của dự án (đợt 19) và bảng đợt ở mục 0.4. Mỗi lượt ba bước: dựng lưới xám (`--stage luoi`, chỉ tốn tiền lưới), ghép ảnh lưới thành một tờ để soát, rồi chạy lại không có `--stage` để tô texture. Lưới hỏng thì dựng lại riêng mã đó trước khi tô: `run --only <mã> --redo <mã> --stage luoi` (mã trong `--redo` phải có trong danh sách chạy; công cụ đổi tên tệp gốc và ảnh lưới cũ trong `_raw/` sang `.cu-<giờ>`, không xoá, nên `sheet` hiện lưới mới). Thêm `--dry` vào lệnh `run` thì công cụ chỉ in ước tính credit, không gọi Meshy. Lần tô texture công cụ giữ model của lưới, nên tuỳ chọn model chỉ có tác dụng ở lần dựng lưới; muốn đổi model của một lưới đã có thì `--redo` mã đó.

Credit tính theo bảng giá trong `meshy.mjs`: lưới 20 với `latest` (mặc định), 5 với `meshy-5`; texture 10 mỗi mẫu. `--model-mt` (môi trường) mặc định bằng `--model-vk`; trâu, ngựa, voi là thú cưỡi nên theo `--model`. Mẫu đã xong ở lượt trước thì công cụ bỏ qua, nên số dưới đây đã trừ phần trùng (cò, quạ ở lượt 1; 9 mục môi trường ở lượt 2). Số tính bằng đúng bảng giá và cách chọn model của `run`, không gọi mạng.

| Lượt | Gồm | Credit: lưới + texture | Claude làm sau lượt này |
| --- | --- | --- | --- |
| 1 | `thieu`, 12 mục | 90 + 120 = **210**: DV_AOTONG và trâu bằng `latest`, dân, đạo cụ, chim bằng meshy-5; tất cả `latest` 240 + 120 = 360 | Code gắn nón lá vào khớp đầu khi có thân GLB (`models.js`) và gộp nón vào bộ lính (`design/tools/bake/kit.mjs`); nướng bộ lính cho dân làng (thay thân code ở `ambient.js`) và quân áo Tống (chọn cung hay giáo, đổi lính thả ở `kesach.js`); gộp quang gánh, tay nải vào bộ dân; ống tên rời vào bước nướng vũ khí (`wpn`) để làm ống tên rơi cạnh xác ngựa (`scenery.js:422-430`). Trâu, chim chờ bước nướng môi trường (lượt 2), cắt thành phần rời cho code tự cử động (`ambient.js:13-15`) |
| 2 | 9 mục môi trường thử: thuyền chiến quân Trần (người chơi đứng), chiến thuyền Nguyên, kỳ hạm, cổng, cánh cổng, tường Hàm Tử, lều lương, khóm tre, cột đá vôi A | lưới bằng meshy-5, cùng model sẽ mua hàng loạt ở lượt 4: 45 + 90 = **135**; mục nào hỏng thì dựng lại lưới bằng `latest` (thêm 20 mỗi mục); tất cả `latest` 180 + 90 = 270 | Chế độ nướng tĩnh `env` mới trong `design/tools/glb-bake.mjs`: giảm lưới, phóng về cột "Kích thước thật", đặt lại gốc, tách cán cờ code của thuyền, nướng texture thành màu đỉnh, LOD (đầu mục K). Đo boong và cột của ba thuyền theo đầu mục K. Mã đặt mẫu vào cảnh thay khối code (`boats.js` LOD0, cổng và tường, lều, `kit.js`) làm ở một lượt sau. Đếm tam giác cảnh B15, B20, Võ trường trước và sau khi đặt mẫu (`design/tools/scene-tris.mjs`, đầu mục K): B20 không vượt 120 nghìn, B15 không tăng. Chờ 9 mục này vào được game rồi mới mua lượt 4, vì có thể phải sửa câu chữ; meshy-5 hỏng nhiều thì lượt 4 dùng `latest` |
| 3 | `lam-lai`, 14 mục | 280 + 140 = **420** (cả mục bằng `latest`, như mục P khuyên); nếu thêm `--model-linh meshy-5 --model-vk meshy-5` thì 205 + 140 = 345 | Soát tờ ảnh; chuyển bước nướng sang tệp `_v2` (vũ khí: đổi `src` trong catalog; nhân vật, bộ lính: thêm `src` và cho `glb-bake.mjs` đọc `man[c.src ?? code].path`, xem `design/glb/README.md`); nướng lại; bỏ khớp ghi tay nếu bộ dò khớp ra đúng; bỏ `side`, `flip` của đại đao; gắn nón lá cho bốn vai đầu trần (code của lượt 1) |
| 4 | Phần còn lại của `moi-truong`, 74 mục | `--model-mt meshy-5`: 370 + 740 = **1.110**; `latest` 1.480 + 740 = 2.220 | Như lượt 2, thêm mã đặt từng cảnh; đếm tam giác cảnh trước và sau mỗi cảnh bằng `design/tools/scene-tris.mjs` (B20 ≤ 120 nghìn, B15 không tăng). Vật vẽ hàng trăm lần (cây, tre, cọc, lau, đá, cột đá vôi) và mô-đun lặp dọc tường, vòng rào, làn đánh (L3, L4, M5–M8, M10) phải nướng giảm về ngân sách trong game ghi ở từng mục, tức số tam giác code hiện nay; cao hơn chỉ khi làm kèm mức chi tiết gần, xa (LOD) như bộ vẽ hạm đội; giảm tới đó mà hỏng dáng thì giữ code cho vật ấy. Mấy mô-đun lặp này rẻ (15 credit mỗi mục) nhưng lợi ít nhất, nên có thể để sau cùng (chạy `--only` với danh sách in bởi `list --set moi-truong`, bỏ các mã ấy) |
| 5 | `tuong-moi`, 18 mục | 360 + 180 = **540** (`latest`) | Rig và nướng như 17 nhân vật đang có (thêm vào `CHARS` của catalog), thêm cấu hình `RIGS` khi có trận dùng họ; viết prompt binh khí riêng; ngựa cho X16, X21 (đổi màu mẫu ngựa có sẵn hoặc làm ngựa tướng) |
| 6 | `tuy-chon`, 15 mục, theo nhu cầu | vũ khí, đạo cụ, môi trường bằng meshy-5, ngựa tướng và voi `latest`: 105 + 150 = **255**; `latest` 300 + 150 = 450 | Tuỳ mục (voi: rig bốn chân, bành gắn lưng) |

Cả sáu lượt theo lựa chọn in đậm khoảng 2.670 credit, chưa tính lưới phải dựng lại; tất cả bằng `latest` khoảng 4.260.

Lệnh cho từng lượt (chạy ở gốc repo; key đặt bằng `MESHY_API_KEY`, không ghi vào repo):

```bash
# Lượt 1. DV_AOTONG dựng lưới bằng latest trước: meshy-5 từng bỏ qua câu tả đầu của DV_DAO,
# mà khăn cổ xanh ngọc là dấu nhận quân Tống. Lần chạy cả bộ sau đó giữ model của lưới đã có.
node design/tools/meshy.mjs list --set thieu --hash
node design/tools/meshy.mjs run --only DV_AOTONG --stage luoi
node design/tools/meshy.mjs run --set thieu --stage luoi --model-linh meshy-5 --model-vk meshy-5
node design/tools/meshy.mjs sheet design/glb/_raw/luot1-luoi.png --set thieu
node design/tools/meshy.mjs run --set thieu --model-linh meshy-5 --model-vk meshy-5

# Lượt 2. Mục hỏng: run --only <mã> --redo <mã> --stage luoi --model-mt latest
node design/tools/meshy.mjs run --only ENV_thuyen_chien_tran,ENV_chien_thuyen_nguyen,ENV_ky_ham_nguyen,ENV_cong_ham_tu,ENV_canh_cong,ENV_tuong_dat,ENV_leu_luong,ENV_khom_tre,ENV_nui_da_a --stage luoi --model-mt meshy-5
node design/tools/meshy.mjs sheet design/glb/_raw/luot2-luoi.png --only ENV_thuyen_chien_tran,ENV_chien_thuyen_nguyen,ENV_ky_ham_nguyen,ENV_cong_ham_tu,ENV_canh_cong,ENV_tuong_dat,ENV_leu_luong,ENV_khom_tre,ENV_nui_da_a
node design/tools/meshy.mjs run --only ENV_thuyen_chien_tran,ENV_chien_thuyen_nguyen,ENV_ky_ham_nguyen,ENV_cong_ham_tu,ENV_canh_cong,ENV_tuong_dat,ENV_leu_luong,ENV_khom_tre,ENV_nui_da_a

# Lượt 3
node design/tools/meshy.mjs run --set lam-lai --stage luoi
node design/tools/meshy.mjs sheet design/glb/_raw/luot3-luoi.png --set lam-lai
node design/tools/meshy.mjs run --set lam-lai

# Lượt 4
node design/tools/meshy.mjs run --set moi-truong --stage luoi --model-mt meshy-5
node design/tools/meshy.mjs sheet design/glb/_raw/luot4-luoi.png --set moi-truong --cols 10
node design/tools/meshy.mjs run --set moi-truong --model-mt meshy-5

# Lượt 5
node design/tools/meshy.mjs run --set tuong-moi --stage luoi
node design/tools/meshy.mjs sheet design/glb/_raw/luot5-luoi.png --set tuong-moi
node design/tools/meshy.mjs run --set tuong-moi

# Lượt 6 (chọn bớt thì dùng --only với mã in bởi list --set tuy-chon)
node design/tools/meshy.mjs run --set tuy-chon --stage luoi --model-vk meshy-5
node design/tools/meshy.mjs sheet design/glb/_raw/luot6-luoi.png --set tuy-chon
node design/tools/meshy.mjs run --set tuy-chon --model-vk meshy-5
```

`run` không có `--set` và `--only` thì chạy bộ `can` (40 mẫu đã có): công cụ chỉ báo "đã có", không tốn credit. Mã đã trả tiền mà băm prompt khác manifest thì `run` dừng trước khi gọi Meshy và nêu mã: mẫu đã xong (sửa chữ prompt cũ, mục 2.2), và cả mẫu mới có lưới (sửa chữ giữa lần dựng lưới và lần tô texture, kể cả khi sửa khối POSE v2 hay STYLE bản API trong `meshy.mjs`, vì thế đổi băm mọi mục đang chờ). Muốn mua lại thật thì ghi mã đó vào `--redo`, như cách dựng lại lưới hỏng ở trên. Trước mỗi lượt nên chạy `list --set tat-ca --hash`: dòng cuối phải có hai số bằng nhau ("40/40 mã đã có trong manifest giữ nguyên băm" trước lượt 1, rồi 52/52 sau lượt 1, và cứ thế tăng; mục mới có trong manifest mà chưa mua lưới thì không tính); có dòng ≠ thì lệnh trả mã 1.

---

## 1. Bảng tóm tắt mọi tệp

Cột **Cao** (tới đỉnh đầu, chưa tính mũ) chỉ để tả dáng người khi tạo: mảnh hay to con, già hay trẻ. Công cụ AI không giữ đúng số mét, và game đã có `scale` riêng cho từng vai, nên Claude **không** nhân thẳng số này với scale. Claude chuẩn hoá mọi tệp về chiều cao gốc của thân dựng bằng code rồi mới áp scale, để tỉ lệ giữa các vai trong trận giữ như hiện nay:

- Nhân vật dùng rig (nhóm A, B, E, F): đỉnh đầu 1,90 m (`models.js:176-208`), rồi nhân `RIGS.scale` (H35 ×1,08 ra 2,05 m; X20 ×1,42 ra 2,70 m).
- Lính đám đông (nhóm C, D): đỉnh đầu 1,79 m (`soldier-motion.js:41-42`, `soldiers.js:160`), rồi nhân scale của bậc và kiểu lính (Tinh nhuệ ×1,05, NG_TANK ×1,3).
- Dân làng (nhóm J): về thân dân trong code (`soldiers.js:429`, đỉnh đầu khoảng 1,74 m), rồi nhân vóc từng vai ở `ambient.js:1021-1027`.

Vũ khí, đạo cụ và ngựa thì khác: số đo trong bảng là kích thước thật, nên giữ đúng.

| # | Mã | Tệp | Tên | Nhóm | Tam giác | Cao (tả dáng) | Đi kèm |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | H35 | `char_H35_tran-quoc-toan.glb` | Trần Quốc Toản | A | 10–20k | 1,75 m | WPN_songdao ×2, PROP_co_lung |
| 2 | H31 | `char_H31_tran-hung-dao.glb` | Trần Hưng Đạo | A | 10–20k | 1,82 m | WPN_daikiem, PROP_cape |
| 3 | H33 | `char_H33_tran-nhat-duat.glb` | Trần Nhật Duật | A | 10–20k | 1,78 m | WPN_giao_dv, PROP_cape, (WPN_quat) |
| 4 | H40 | `char_H40_nguyen-khoai.glb` | Nguyễn Khoái | A | 10–20k | 1,80 m | WPN_cung_viet, PROP_cape |
| 5 | H34 | `char_H34_tran-khanh-du.glb` | Trần Khánh Dư (chưa có trong game) | A | 10–20k | 1,88 m | WPN_daikiem_vandon |
| 6 | H38 | `char_H38_yet-kieu.glb` | Yết Kiêu (chưa có trong game) | A | 10–20k | 1,72 m | WPN_doandao, WPN_duisat |
| 7 | X19 | `char_X19_toa-do.glb` | Toa Đô | B | 10–20k | 1,90 m | WPN_dadao, PROP_cape, (WPN_daiphu) |
| 8 | X20 | `char_X20_o-ma-nhi.glb` | Ô Mã Nhi | B | 10–20k | 1,92 m | WPN_dadao, PROP_cape, PROP_co_lung |
| 9 | X24 | `char_X24_phan-tiep.glb` | Phàn Tiếp | B | 10–20k | 1,86 m | WPN_dadao, PROP_cape, PROP_co_lung |
| 10 | OFF_tuong | `char_OFF_tuong.glb` | Tướng Nguyên (chung) | B | 10–20k | 1,88 m | WPN_dadao, PROP_cape |
| 11 | OFF_photuong | `char_OFF_photuong.glb` | Phó tướng Nguyên | B | 10–15k | 1,82 m | WPN_dadao, PROP_cape |
| 12 | OFF_doitruong | `char_OFF_doitruong.glb` | Đội trưởng Nguyên | B | 10–12k | 1,78 m | WPN_dao, WPN_khien_tron_ng |
| 13 | DV_GIAO | `unit_DV_GIAO.glb` | Giáo binh | C | 1,5–3k | 1,75 m | WPN_giao_dv |
| 14 | DV_DAO | `unit_DV_DAO.glb` | Đao khiên | C | 1,5–3k | 1,75 m | WPN_dao_linh, WPN_khien_nhat_dv |
| 15 | DV_NO | `unit_DV_NO.glb` | Nỏ thủ | C | 1,5–3k | 1,75 m | WPN_no |
| 16 | DV_AOTONG | `unit_DV_AOTONG.glb` | Quân áo Tống (tuỳ chọn) | C | 1,5–3k | 1,75 m | WPN_cung_viet |
| 17 | NG_DAO | `unit_NG_DAO.glb` | Đao thuẫn | D | 1,5–3k | 1,75 m | WPN_dao_linh, WPN_khien_tron_ng |
| 18 | NG_GIAO | `unit_NG_GIAO.glb` | Thương binh | D | 1,5–3k | 1,75 m | WPN_giao_ng, WPN_khien_tron_ng (×0,72) |
| 19 | NG_CUNG | `unit_NG_CUNG.glb` | Cung thủ bộ | D | 1,5–3k | 1,75 m | WPN_cung_ng |
| 20 | NG_TANK | `unit_NG_TANK.glb` | Lực sĩ trọng giáp | D | 2–3k | 1,85 m | WPN_chuy |
| 21 | NG_KY | `unit_NG_KY.glb` | Cung kỵ (người cưỡi) | D | 1,5–3k | 1,75 m | WPN_cung_ng, MOUNT_ngua_nguyen |
| 22 | LINH_r01 | `char_LINH_r01.glb` | Người lính Tự do, bậc Lính và Tinh nhuệ | E | 10–20k | 1,78 m | WPN_songdao hoặc WPN_daikiem |
| 23 | LINH_r24 | `char_LINH_r24.glb` | Người lính Tự do, bậc Đội trưởng → Tướng | E | 10–20k | 1,78 m | như trên; bậc Tướng thêm PROP_cape |
| 23a | LINH_r2 | `char_LINH_r2.glb` | Người lính Tự do, riêng bậc Đội trưởng (tuỳ chọn, xem mục E) | E | 10–20k | 1,78 m | như trên |
| 24 | CV_khien | `char_CV_khien.glb` | Cận vệ Khiên thủ | F | 4–8k | 1,80 m | WPN_dao, WPN_khien_nhat_dv |
| 25 | CV_giao | `char_CV_giao.glb` | Cận vệ Giáo thủ | F | 4–8k | 1,78 m | WPN_giao_dv |
| 26 | CV_cung | `char_CV_cung.glb` | Cận vệ Cung thủ | F | 4–8k | 1,78 m | WPN_cung_viet |
| 27 | CV_songdao | `char_CV_songdao.glb` | Cận vệ Song đao | F | 4–8k | 1,75 m | WPN_songdao ×2 |
| 28 | CV_daidao | `char_CV_daidao.glb` | Cận vệ Đại đao | F | 4–8k | 1,85 m | WPN_dadao |
| 29 | WPN_songdao | `wpn_songdao.glb` | Song đao (một lưỡi) | G | 1–2k | 1,05 m | — |
| 30 | WPN_daikiem | `wpn_daikiem.glb` | Đại kiếm / Gươm Tiết chế | G | 1–3k | 1,55 m | grip2 |
| 31 | WPN_dadao | `wpn_dadao.glb` | Đại đao cán dài | G | 1–3k | 2,6 m | grip2 |
| 32 | WPN_dao | `wpn_dao.glb` | Đao thẳng một tay | G | 0,8–1,5k | 1,2 m | — |
| 33 | WPN_dao_linh | `wpn_dao-linh.glb` | Đao lính mũi hếch | G | 0,3–0,8k | 0,95 m | — |
| 34 | WPN_giao_dv | `wpn_giao-dv.glb` | Giáo Đại Việt | G | 0,5–1,5k | 3,0 m | grip2 (tuỳ chọn) |
| 35 | WPN_giao_ng | `wpn_giao-ng.glb` | Thương Nguyên | G | 0,3–0,8k | 2,8 m | grip2 (tuỳ chọn) |
| 36 | WPN_cung_viet | `wpn_cung-viet.glb` | Cung sừng Đại Việt | G | 0,8–2k | 1,45 m | — |
| 37 | WPN_cung_ng | `wpn_cung-ng.glb` | Cung phản khúc Nguyên | G | 0,3–0,8k | 1,3 m | — |
| 38 | WPN_no | `wpn_no.glb` | Nỏ | G | 0,5–1,2k | báng 0,72 m | — |
| 39 | WPN_chuy | `wpn_chuy.glb` | Chùy gai | G | 0,5–1,5k | 1,7 m | — |
| 40 | WPN_khien_tron_ng | `wpn_khien-tron-ng.glb` | Khiên tròn Nguyên | G | 0,3–1k | Ø 0,74 m | — |
| 41 | WPN_khien_nhat_dv | `wpn_khien-nhat-dv.glb` | Khiên nhật quân Trần | G | 0,3–1k | 0,5 × 0,75 m | — |
| 42 | WPN_daiphu | `wpn_daiphu.glb` | Đại phủ (tuỳ chọn) | G | 1–3k | 2,2 m | grip2 |
| 43 | WPN_quat | `wpn_quat.glb` | Quạt Chiêu Văn (tuỳ chọn) | G | 1–2k | 0,45 m | — |
| 44 | WPN_daikiem_vandon | `wpn_daikiem-vandon.glb` | Đại kiếm Vân Đồn (tuỳ chọn) | G | 1–3k | 1,6 m | grip2 |
| 45 | WPN_doandao | `wpn_doandao.glb` | Đoản đao Yết Kiêu (tuỳ chọn) | G | 0,5–1,5k | 0,5 m | — |
| 46 | WPN_duisat | `wpn_duisat.glb` | Dùi sắt đục thuyền (tuỳ chọn) | G | 0,3–1k | 0,35 m | — |
| 47 | PROP_co_lung | `prop_co-lung.glb` | Cờ lưng (cán + vải trơn; dùng chung H35, X20, X24) | H | 0,5–1,5k | cán 2,0 m | — |
| 48 | PROP_cape | `prop_cape.glb` | Áo choàng (dùng chung, Claude đổi màu) | H | 0,5–2k | dài 0,9 m | — |
| 49 | PROP_mui_ten | `prop_mui-ten.glb` | Mũi tên | H | 100–300 | 0,85 m | — |
| 50 | PROP_ong_ten | `prop_ong-ten.glb` | Ống tên rời (tuỳ chọn) | H | 0,3–1k | 0,55 m | — |
| 51 | MOUNT_ngua_nguyen | `mount_ngua-nguyen.glb` | Ngựa cung kỵ Nguyên | I | 4–8k | lưng 1,4 m | — |
| 52 | MOUNT_ngua_tuong | `mount_ngua-tuong.glb` | Ngựa tướng (tuỳ chọn) | I | 8–15k | lưng 1,5 m | — |
| 53 | DAN_NAM | `unit_DAN_NAM.glb` | Dân làng nam (tuỳ chọn) | J | 1,5–3k | 1,65 m | PROP_quang_ganh, PROP_non_la |
| 54 | DAN_NU | `unit_DAN_NU.glb` | Dân làng nữ (tuỳ chọn) | J | 1,5–3k | 1,55 m | PROP_tay_nai |
| 55 | DAN_TRE | `unit_DAN_TRE.glb` | Trẻ con làng (tuỳ chọn) | J | 1–2k | 1,15 m | PROP_tay_nai (thu nhỏ) |
| 56 | PROP_quang_ganh | `prop_quang-ganh.glb` | Đòn gánh + hai thúng (tuỳ chọn) | J | 1–2k | đòn 1,7 m | — |
| 57 | PROP_tay_nai | `prop_tay-nai.glb` | Tay nải (tuỳ chọn) | J | 300–500 | 0,36 m | — |
| 58 | MOUNT_voi_chien | `mount_voi-chien.glb` | Voi chiến (thân trơn, chưa có trong game) | I | 10–20k | vai 2,7 m | PROP_banh_voi, PROP_giap_voi |
| 59 | PROP_banh_voi | `prop_banh-voi.glb` | Bành voi + vải phủ (chưa có trong game) | I | 1–3k | sàn 1,4 m | — |
| 60 | PROP_giap_voi | `prop_giap-voi.glb` | Giáp đầu voi (tuỳ chọn) | I | 0,5–1,5k | 1,0 m | — |
| 61 | WPN_moc_voi | `wpn_moc-voi.glb` | Móc voi (tuỳ chọn) | G | 0,3–1k | 0,7 m | — |
| 62 | H39 | `char_H39_da-tuong.glb` | Dã Tượng, người cưỡi voi (chưa có trong game) | A | 10–20k | 1,78 m | WPN_moc_voi, WPN_giao_dv, MOUNT_voi_chien |
| 63 | PROP_non_la | `prop_non-la.glb` | Nón lá rời (người lính Tự do, cận vệ Giáo, Cung, Song đao, dân làng nam) | H | 300–600 | Ø 0,84 m, cao 0,22 m | — |
| 154 | H27 | `char_H27_tran-thai-tong.glb` | Trần Thái Tông (chưa có trong game) | A | 10–20k | 1,74 m | kiếm, khiên mây (chưa có prompt) |
| 155 | H28 | `char_H28_tran-thu-do.glb` | Trần Thủ Độ (chưa có trong game) | A | 10–20k | 1,72 m | WPN_giao_dv tạm cho cờ lệnh |
| 156 | H29 | `char_H29_le-phu-tran.glb` | Lê Phụ Trần (chưa có trong game) | A | 10–20k | 1,76 m | WPN_dao tạm, ván thuyền (chưa có prompt) |
| 157 | H30 | `char_H30_tran-nhan-tong.glb` | Trần Nhân Tông (chưa có trong game) | A | 10–20k | 1,72 m | WPN_quat, bút lông (chưa có prompt) |
| 158 | H32 | `char_H32_tran-quang-khai.glb` | Trần Quang Khải (chưa có trong game) | A | 10–20k | 1,76 m | WPN_cung_viet, PROP_mui_ten |
| 159 | H36 | `char_H36_tran-binh-trong.glb` | Trần Bình Trọng (chưa có trong game) | A | 10–20k | 1,76 m | WPN_giao_dv (rút ngắn) |
| 160 | H37 | `char_H37_pham-ngu-lao.glb` | Phạm Ngũ Lão (chưa có trong game) | A | 10–20k | 1,80 m | WPN_giao_dv tạm cho sóc |
| 161 | TT | `char_TT_trieu-trung.glb` | Triệu Trung (chưa có trong game) | A | 10–20k | 1,76 m | WPN_cung_viet |
| 162 | X16 | `char_X16_ngot-luong-hop-thai.glb` | Ngột Lương Hợp Thai (chưa có trong game) | B | 10–20k | 1,74 m | WPN_cung_ng, PROP_cape, ngựa |
| 163 | X17 | `char_X17_a-truat.glb` | A Truật (chưa có trong game) | B | 10–20k | 1,80 m | WPN_giao_ng tạm |
| 164 | X18 | `char_X18_thoat-hoan.glb` | Thoát Hoan (chưa có trong game) | B | 10–20k | 1,80 m | WPN_dadao tạm cho kích |
| 165 | X21 | `char_X21_ly-hang.glb` | Lý Hằng (chưa có trong game) | B | 10–20k | 1,78 m | WPN_cung_ng, PROP_cape, ngựa |
| 166 | X22 | `char_X22_ly-quan.glb` | Lý Quán (chưa có trong game) | B | 10–20k | 1,78 m | WPN_giao_ng, WPN_khien_tron_ng (×0,72) |
| 167 | X23 | `char_X23_truong-van-ho.glb` | Trương Văn Hổ (chưa có trong game) | B | 10–20k | 1,76 m | WPN_dadao tạm cho kích |
| 168 | X25 | `char_X25_a-bat-xich.glb` | A Bát Xích (chưa có trong game) | B | 10–20k | 1,82 m | WPN_giao_ng tạm |

Cần cho game hiện tại: mục 1–4, 7–15, 17–41 (trừ 23a), 49 và 51. Cờ (47) và áo choàng (48) Claude dựng bằng code cũng được (xem nhóm H), nên tuỳ bạn. Voi và Dã Tượng (58–62) làm sẵn cho các trận sau (lớp vũ khí WC16 Voi chiến trong `systems.md`); game hiện chưa có voi. Còn lại là tuỳ chọn.

Mục 63 (nón lá rời) là đạo cụ game đang vẽ bằng code mà mẫu GLB của người lính Tự do và cận vệ chưa có. Môi trường và thú (mục K–O, từ số 64) có bảng riêng ở đầu từng mục; cột 7 của các bảng đó là kích thước thật để bước nướng phóng về.

Mục 154–168 là 15 tướng thời Trần chưa có trong game, chuyển từ prompt vẽ ảnh `design/3d-ref/PROMPTS-TUONG.md` sang khuôn Meshy (mục A8–A15, B7–B13: tay không, POSE v2). Cột Đi kèm ghi vũ khí có sẵn để dùng tạm; binh khí riêng của họ chưa có prompt (mục 0.8). Mục làm lại mẫu lệch (169–182, mã `_v2`) có bảng riêng ở mục P.

---

## 2. Khối dùng chung

### 2.1 STYLE (đã gắn sẵn cuối mọi PROMPT)

```text
Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

### 2.2 POSE (đã gắn sẵn trong prompt nhân vật, trước STYLE)

```text
A-pose, arms 45° down, open empty hands, fingers slightly apart, feet shoulder-width, facing front, mouth closed.
```

**POSE v2, cho mục mới** (từ đợt 19: tướng mới, dân làng, áo Tống, mục làm lại `_v2`). 40 mẫu đầu dùng khối trên và ra tay dang gần ngang (khoảng 74° so với buông thẳng), khuỷu gập, ngửa bàn tay như đang chìa ra, nên bộ dò khớp khi rig đặt sai khuỷu và cổ tay. Khối v2 đòi tay thẳng, khuỷu thẳng, bàn tay thả lỏng, ngón khép:

```text
A-pose, straight arms 45° down, elbows straight, relaxed open hands, fingers together, feet shoulder-width, facing front, mouth closed.
```

- **Đừng sửa khối POSE cũ trong 40 mục đã tạo.** `design/tools/meshy.mjs` băm đúng chữ của bản gửi API; đổi một chữ là băm đổi; không có chặn thì lần `run` kế tiếp sẽ mua lại mẫu đó bằng model mặc định `latest` (25 nhân vật khoảng 750 credit, cả 40 mẫu 1.200) và ghi đè GLB. Từ đợt 19b `run` dừng trước khi gọi Meshy nếu mẫu đã xong mà băm khác manifest, trừ mã ghi trong `--redo`, và `list --hash` trả mã 1 khi có dòng ≠. Muốn làm lại một mẫu cũ với POSE v2 thì thêm mục mới mã `_v2` (mục 0.5).
- Công cụ nhận cả hai khối, đúng từng chữ như trên, và đổi sang bản API ngắn hơn (v2 bỏ `mouth closed`, 121 ký tự). Prompt người không chứa nguyên một trong hai khối thì công cụ báo lỗi khi đọc tài liệu, vì biến thể (ví dụ `45 °`) sẽ được gửi nguyên văn, dài hơn và còn `mouth closed`. Bản API vẫn mở đầu bằng `A-pose,` (dấu phẩy) vì câu chặn vũ khí được chèn ngay trước chữ đó; viết `A-pose:` thì công cụ báo lỗi khi đọc tài liệu.
- Bản API của mục người = mô tả + câu chặn (69 ký tự, thêm 11 khi prompt không có chữ helmet, hat, cap) + POSE + STYLE rút gọn. Với POSE v2, phần mô tả (trước khối POSE) giữ trong 300 ký tự thì bản API không quá 600; `node design/tools/meshy.mjs list --only <mã>` in độ dài.
- Từ đợt 19b mọi mục người chưa tạo dùng POSE v2: H34, H38, H39, DV_AOTONG, DAN_NAM, DAN_NU, DAN_TRE, 15 tướng mới và mục P. Riêng LINH_r2 (tuỳ chọn) công cụ dựng từ prompt LINH_r24 đã tạo nên còn khối cũ, và không nằm trong bộ `tuy-chon`; muốn tạo thì thêm mục riêng viết bằng POSE v2.

### 2.3 NEGATIVE (dán vào ô Negative prompt nếu công cụ có)

**NEGATIVE-NV**, cho nhân vật, lính, dân làng, ngựa và voi. Với ngựa thì thêm `, rider, person` vào cuối; với voi thì thêm `, rider, person, howdah, saddle`. Với người cưỡi NG_KY thì thêm `, horse, saddle, sitting, mounted`. Với trâu (O1) thì bỏ chữ `horns, ` (prompt xin sừng trâu; công cụ tự bỏ).

```text
weapon, sword, spear, bow, shield, holding, cape, cloak, flag, T-pose, pedestal, base, anime, chibi, cartoon, photorealistic, text, logo, samurai armor, kabuto, Qing dynasty clothing, queue braid, European plate armor, Nguyen dynasty court dress, monster, demon, orc, horns, skull, fangs, grotesque, caricature, evil villain, gore, blood, baked lighting, baked shadows
```

**NEGATIVE-VK**, cho vũ khí và đạo cụ:

```text
hand, person, character, holding, stand, rack, pedestal, base, wall mount, text, letters, runes, glowing, fantasy ornament, anime, chibi, cartoon, katana, European sword, gore, blood, baked lighting, baked shadows
```

**NEGATIVE-MT**, cho môi trường (mã `ENV_`: thuyền, công trình, đạo cụ cảnh, cây, đá). Không chặn giá, bệ, đế vì đó có thể là một phần của vật (giá binh khí, bia đá có đế):

```text
person, people, character, crowd, text, letters, calligraphy, logo, anime, chibi, cartoon, photorealistic, modern, glowing, fantasy ornament, gore, blood, baked lighting, baked shadows
```

Những ý quan trọng nhất đã nằm sẵn trong PROMPT: với nhân vật là tay không và A-pose; với vũ khí và đạo cụ là không giá đỡ, không tay (`no stand, no hand`). Nhưng ô Negative còn giữ hai loại từ chặn mà PROMPT không có chỗ chứa: từ chặn lỗi thời đại (giáp samurai, mũ kabuto, áo nhà Thanh, áo triều Nguyễn, giáp tấm châu Âu) và từ chặn biếm hoạ kẻ địch (quái vật, sừng, đầu lâu, mặt phản diện; mục 2.6). Vì thế, nếu công cụ không có ô Negative thì phải soát kết quả kỹ hơn theo danh sách kiểm tra cuối tài liệu, nhất là tướng ta (dễ ra dáng samurai) và lính Nguyên (dễ ra dáng quái vật).

### 2.4 Khối cho ảnh mẫu

Có ba khối. Ghép theo thứ tự: khối **MỞ** (chọn theo loại) + PROMPT của mục + khối **ẢNH-ĐÓNG**, cách nhau một dấu cách. Prompt ảnh mẫu dài hơn 550 ký tự cũng được, vì công cụ tạo ảnh nhận prompt dài.

**ẢNH-MỞ-NV** (mở đầu, cho nhân vật, lính, dân làng):

```text
Character turnaround sheet, full body, front view and side view of the same character side by side.
```

**ẢNH-MỞ-VK** (mở đầu, cho vũ khí, đạo cụ, ngựa):

```text
Single object reference sheet, front view and side view side by side.
```

**ẢNH-ĐÓNG** (kết thúc, dùng chung cho mọi loại):

```text
Plain light grey background, even flat lighting, no cast shadows, orthographic view, no text.
```

**Ví dụ ghép sẵn cho H35** (ẢNH-MỞ-NV + PROMPT của A1 + ẢNH-ĐÓNG):

```text
Character turnaround sheet, full body, front view and side view of the same character side by side. Slender Vietnamese youth general, 13th-century Tran dynasty, about 17, beardless, fierce eyes. Black topknot under a vermilion headband knotted at the back. Knee-length vermilion robe, black lacquer lamellar chest armor and shoulder guards with gold trim, four vermilion skirt flaps, black greaves and shoes. A-pose, arms 45° down, open empty hands, fingers slightly apart, feet shoulder-width, facing front, mouth closed. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette. Plain light grey background, even flat lighting, no cast shadows, orthographic view, no text.
```

Ảnh ra xong thì cắt thành từng hình riêng trước khi đưa vào công cụ 3D (xem mục 0.1).

### 2.5 Bảng màu: hex trong code ↔ từ tiếng Anh dùng trong prompt

Công cụ AI hiểu tên màu tốt hơn mã hex. Prompt dùng tên màu; mã hex để Claude so khi chỉnh màu.

| Tên trong code | Hex | Trong prompt | Dùng cho |
| --- | --- | --- | --- |
| son | `#9b2d20` | vermilion / vermilion red | Áo quân Trần, khăn, chóp mũ tướng |
| son sẫm | `#6e1d15` | dark red | Áo H31, DV_DAO, người lính bậc cao |
| then | `#1d1a17` | black lacquer | Giáp quân Trần, ống chân, giày |
| vàng | `#c9a14a` | gold | Viền giáp, mũ tướng |
| vàng chữ cờ | `#f1d98a` | pale gold | Chữ và viền cờ (code vẽ) |
| trứng sáo | `#e6dcc3` | cream | Dây cung, lông tên |
| vải | `#b9a37a` | straw-colored | Nón lính, xà cạp, áo giáp vải DV_NO |
| nón lá | `#cdb98a` | palm-leaf | Nón lá người lính Tự do, cận vệ |
| da | `#c48f63` | (không ghi, để tự nhiên) | Da người |
| tóc | `#141210` | black | Tóc, râu |
| gỗ | `#6b4a2b` | brown wood | Cán giáo, cung |
| sắt | `#8d9296` | grey steel | Lưỡi vũ khí |
| thép | `#5f6f7c` | blue-grey steel | Giáp phe Nguyên |
| chàm | `#2c3a4a` | dark indigo | Áo phe Nguyên |
| lông | `#5a4632` | brown fur / leather | Mũ lông, viền da phe Nguyên |
| xám | `#b8bdbf` | silver-grey | Mũ trụ nhọn, viền sĩ quan Nguyên |
| nâu | `#4a3524` | dark brown | Khiên tròn, ống tên |
| H33 áo | `#2f4a6a` | steel-blue | |
| H40 áo | `#4a5a2a` | olive-green | |
| tuong áo | `#3a2f3a` | dark plum | Toa Đô, Tướng Nguyên |
| X20 áo | `#2a2630` | near-black | |
| NG_GIAO áo | `#34465a` | slate-blue | |
| NG_CUNG áo | `#4b5364` | grey-blue | |
| NG_TANK áo | `#2a2f38` | charcoal | |
| Người lính r0–r2 áo | `#8a2a1e` | brick-red | |
| Người lính r0–r1 giáp / viền | `#3a2c22` / `#8a6a3a` | dark brown leather / dull bronze | |
| Cận vệ áo / giáp / vạt | `#7a2418` / `#4a3a2a` / `#5a2014` | brick-red / dark brown / maroon | |
| ngựa / ngựa đen | `#6a4e36` / `#2a211b` | bay-brown / dark brown | |
| **Môi trường (mục K–O)** | | | |
| gỗ thuyền Nguyên | `#6b4c34` | weathered brown wood | Vỏ chiến thuyền, thuyền hộ vệ, thuyền dò |
| buồm / khiên thuyền Nguyên | `#5b77a3` / `#3d5a7a` | faded indigo-blue / indigo-blue | Buồm cánh dơi, khiên tròn treo mạn |
| thuyền Trần: thân / mạn | `#2a2420` / `#a8321f` | black lacquer / vermilion | Thuyền chiến nhẹ |
| vàng đất quân Tống | `#b0752c` / `#a0622c` | ochre | Cờ, bó hàng trên thuyền Tống |
| đất nện | `#7a6a50` | tan rammed earth | Tường Hàm Tử quan |
| tháp cổng | `#6d5c45` | tan-brown rammed earth | Hai tháp cổng Hàm Tử quan |
| mái cổng | `#4a3524` | dark brown terracotta tile | Mái nhà cổng Hàm Tử quan (màu code, ngói đất nung thời Lý – Trần) |
| thúng chai | `#8c7a52` (code) / nâu sẫm **(đề xuất)** | dark brown resin (code: pale tan woven bamboo) | Thúng câu K9: prompt xin lớp dầu rái quét kín của thúng chai thật; muốn giữ màu code thì thay câu màu |
| tre | `#b09a5a` / `#9aa252` | pale bamboo / green-yellow bamboo | Tháp canh B20, cọc tre, rào, khóm tre |
| tranh | `#9c8452` | golden-brown thatch | Mái chòi, nhà làng, tháp canh B20 |
| nỉ lều Mông Cổ | `#b8bdbf` / `#8d8f86` | pale grey felt | Lều tròn trong Hàm Tử quan |
| đá vôi | `#a7a295` | pale grey limestone | Cột đá vôi B20, tảng đá |
| lá cây | `#4f6a32` / `#5e7a3a` | dark green / leaf green | Cây, tre, đước |
| đồng | `#7a5a2a` | dark bronze | Vạc lửa, trống đồng |
| đá bia | `#8a8474` | grey stone | Bia đá Sát Thát |
| gỗ cháy | `#2a221a` | charred black | Khung lều cháy |
| trâu | `#687078` | slate-grey | Trâu |
| cò / mỏ cò | `#f4f1e8` / `#e2b43a` | pure white / yellow | Cò trắng |
| **Tướng mới (mục A8–A15, B7–B13)** | | | |
| H32 áo | `#2f5a4a` **(đề xuất)** | dark jade-green | Trần Quang Khải |
| áo Tống | `#b0752c` / `#8a5a28` **(đề xuất)** | amber-ochre / dark ochre | Quân áo Tống (C4) / Triệu Trung |
| khăn cổ quân Tống | `#2f8f83` **(đề xuất)** | jade-green | C4, Triệu Trung |
| X16 áo | `#4a3524` | dark brown | Ngột Lương Hợp Thai (như "nâu") |
| X18 áo, giáp | `#2c3a4a` + `#c9a14a` | dark indigo silk with gold trim, gilded | Thoát Hoan |
| X21 áo / X23 áo | `#34465a` / `#4b5364` | slate-blue / grey-blue | Như NG_GIAO / NG_CUNG |
| X25 áo | `#3a4a2e` **(đề xuất)** | dark green | A Bát Xích |

### 2.6 Nguyên tắc nội dung

- **Quân Trần, thế kỷ 13**: áo vải dài tới gối, giáp phiến hoặc giáp da sơn then, nón lá, khăn quấn, búi tóc, mũ trụ đơn giản. Không dùng áo dài, khăn xếp, mũ cánh chuồn của triều Nguyễn; không giáp samurai Nhật; không áo hay tóc đuôi sam nhà Thanh.
- **Quân Nguyên kiểu Mông Cổ – Nguyên**: giáp phiến (lamellar), mũ trụ nhọn viền lông hoặc có vải che gáy, mũ lông, áo del vạt chéo, ủng cưỡi ngựa, cung phản khúc. Đúng như code đang vẽ (mũ `munguyen`, `mulong`).
- **Không biếm hoạ, không xấu xí hoá kẻ địch.** Canon ghi tướng Nguyên là đối thủ có danh dự (X19, X20, X24 `dignity`). Lính Nguyên không đáng sợ hơn hay đáng cười hơn lính ta.
- Không máu me, không thương tích (`systems.md:700`, `scenery.js:438`).
- Không đưa chữ lên mẫu. Chữ trên cờ do code vẽ (`flagTexture`, `models.js:463`); không thích chữ "Sát Thát" lên tay.
- Quân Tống lưu vong là đồng minh có phẩm giá. Áo Tống là áo của chính họ, không phải đồ cải trang (canon B15).

---

## A. Tướng chơi được và tướng ta

### A1 · H35 · Trần Quốc Toản (Hoài Văn hầu) · tướng chơi được

Tướng người chơi ở B15 và Võ trường. Nhân vật và lá cờ sáu chữ là Chính sử; song đao và màu cờ đỏ chữ vàng là Hư cấu. Tuổi khoảng 17 **(đề xuất; sử chỉ ghi "nhỏ tuổi")**. Màu theo `RIGS.hero`; ống chân và giày then.

PROMPT (dán thẳng):
```text
Slender Vietnamese youth general, 13th-century Tran dynasty, about 17, beardless, fierce eyes. Black topknot under a vermilion headband knotted at the back. Knee-length vermilion robe, black lacquer lamellar chest armor and shoulder guards with gold trim, four vermilion skirt flaps, black greaves and shoes. A-pose, arms 45° down, open empty hands, fingers slightly apart, feet shoulder-width, facing front, mouth closed. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 10–20k tam giác; cao 1,75 m, người mảnh.
- **Tách riêng**: hai dải khăn đỏ sau gáy (Claude dựng bằng code, đã có sẵn ở `models.js:284-288`); cờ lưng → PROP_co_lung.
- **Vũ khí**: WPN_songdao, một tệp, Claude lật gương cho tay trái. Tua lụa đỏ ở chuôi do code thêm.
- **Ảnh tham chiếu**: `game/assets/comic/B15/O3.webp`, `D3.webp`, `K1.webp`, `K4.webp`.
- **Lưu ý**: không dựng cảnh tử trận (`canon.json:2988`).

### A2 · H31 · Trần Hưng Đạo (Quốc công Tiết chế) · tướng chơi được

Tướng người chơi ở B20. Nhân vật là Chính sử; Gươm Tiết chế và mũ trụ Tiết chế là Hư cấu. Khoảng 60 tuổi. Theo `RIGS.H31`: giáp nặng sơn then viền vàng, hộ tâm kính vàng, mũ trụ Tiết chế, râu bạc, áo son sẫm.

PROMPT (dán thẳng):
```text
Dignified Vietnamese supreme commander, 13th-century Tran dynasty, about 60, stern eyes, long silver pointed beard. Song-style black helmet with gold rim, gold flame brow plate, red top tassel, neck guard. Heavy black lamellar armor, gold trim, gold chest mirror, pauldrons, gold knee guards, dark red robe. A-pose, arms 45° down, open empty hands, fingers slightly apart, feet shoulder-width, facing front, mouth closed. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 10–20k; cao 1,82 m.
- **Tách riêng**: áo choàng son, hẹp và ngắn → PROP_cape (Claude thu hẹp ×0,62, rút ngắn ×0,72 như game). Không có cờ lưng.
- **Vũ khí**: WPN_daikiem (có grip2).
- **Muốn làm theo truyện tranh** (giáp lá đỏ, khăn đen): thay câu mũ (`Song-style black helmet … neck guard.`) bằng `Black cloth head wrap knotted at the back over a topknot.` và đổi `Heavy black lamellar armor` thành `Dark red lamellar armor`, `dark red robe` thành `black robe`. Dải khăn buông sau gáy thì không đưa vào prompt; Claude dựng bằng code cho có lắc, như dải khăn của H35.
- **Ảnh tham chiếu**: `game/assets/comic/B20/O3.webp`, `D1.webp`, `O7.webp`, `K5.webp` (truyện vẽ giáp đỏ, khăn đen).
- **Lưu ý**: danh xưng "Đức Thánh Trần" chỉ dùng trong Sử quán, không thêm hào quang hay yếu tố thần linh (`canon.json:2661`). Mũ bát đen có tấm trán vàng, che gáy và vai giáp dễ bị công cụ vẽ thành mũ kabuto, giáp samurai Nhật; chữ `Song-style` trong prompt và chữ `kabuto` trong NEGATIVE để chặn việc này. Làm theo cách ảnh mẫu thì soát ảnh trước khi đưa vào 3D: tấm trán vàng là một tấm nhỏ hình ngọn lửa sát vành mũ (`models.js:217-224`), không thành cặp sừng hay tấm cao kiểu maedate; che gáy là một tấm, không xoè nhiều tầng kiểu shikoro.

### A3 · H33 · Trần Nhật Duật (Chiêu Văn Đại vương) · tướng đồng minh

Tướng AI cánh A ở B15 (`battle-b15.js:98`). Chính sử; vai chỉ huy ở Hàm Tử là Hư cấu. Khoảng 30 tuổi; văn nhân kiêm tướng, nói được tiếng Tống, tiếng Chiêm. Màu theo `RIGS.H33`. Mặt, ria mảnh, chòm râu dê và đai ngọc lấy từ truyện tranh.

PROMPT (dán thẳng):
```text
Vietnamese scholar-general, 13th-century Tran dynasty, about 30, warm clever face, neat moustache, short goatee. Short gold cylindrical helmet with a tall thin red spike. Steel-blue brocade robe, black lacquer lamellar vest with gold trim, jade belt, four steel-blue skirt flaps, black greaves and shoes. A-pose, arms 45° down, open empty hands, fingers slightly apart, feet shoulder-width, facing front, mouth closed. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 10–20k; cao 1,78 m.
- **Tách riêng**: áo choàng son → PROP_cape.
- **Vũ khí**: WPN_giao_dv (game đang cho cầm giáo). Theo canon thì đúng ra là quạt (WPN_quat, tuỳ chọn).
- **Muốn mũ như truyện**: thay câu mũ bằng `Small black silk scholar hat over a topknot.`
- **Ảnh tham chiếu**: `game/assets/comic/B15/O5.webp`, `K3.webp`.
- **Lưu ý**: không nhầm với Trần Nhật Hiệu (`canon.json:2824`).

### A4 · H40 · Nguyễn Khoái (tướng quân Thánh Dực) · tướng đồng minh

Tướng AI cánh B ở B15; ở B20 đứng trên thuyền chặn luồng. Chính sử; Cung Thánh Dực là Hư cấu. Khoảng 45 tuổi. Màu theo `RIGS.H40`. Mặt dạn nắng, râu ngắn **(đề xuất, nguồn không tả)**. Ống tên sau lưng lấy theo canon (`canon.json:3340`); game hiện chưa vẽ.

PROMPT (dán thẳng):
```text
Vietnamese royal guard general, 13th-century Tran dynasty, about 45, weathered face, short black beard. Short gold cylindrical helmet with a tall thin red spike. Olive-green robe, black lacquer lamellar armor with gold trim, left forearm bracer, quiver on the back, olive skirt flaps, black greaves and shoes. A-pose, arms 45° down, open empty hands, fingers slightly apart, feet shoulder-width, facing front, mouth closed. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 10–20k; cao 1,80 m. **Symmetry: tắt** (bao tay một bên, ống tên). Ống tên dính thân (object riêng nếu tách được); bao tay da ở cẳng tay trái.
- **Tách riêng**: áo choàng son sẫm `#6e1d15` → PROP_cape.
- **Vũ khí**: WPN_cung_viet, cầm tay trái.
- **Lưu ý**: không đưa chuyện ông tự tay giết Toa Đô vào game (`canon.json:3398`).

### A5 · H34 · Trần Khánh Dư (Nhân Huệ vương) · tướng ta, chưa có trong game

Đang dựng: ô chọn tướng B20 hiện chữ "sắp có", chưa có rig. Chính sử; Đại kiếm Vân Đồn là Hư cấu. Theo truyện: tuổi bốn mươi, phong trần, vai rộng, da sạm, râu ngắn, giáp lá nâu sẫm viền vàng, áo lót đỏ, đai xanh ngọc. Bụi than trên áo gợi quãng đời bán than ở Chí Linh **(đề xuất)**.

PROMPT (dán thẳng):
```text
Rugged Vietnamese naval general, 13th-century Tran dynasty, about 45, broad shoulders, sun-tanned weathered face, short full beard, topknot. Dark brown lacquer lamellar armor with gold trim and pauldrons, red under-robe, teal sash, dark trousers, black boots, faint charcoal dust on the clothes. A-pose, straight arms 45° down, elbows straight, relaxed open hands, fingers together, feet shoulder-width, facing front, mouth closed. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 10–20k; cao 1,88 m. **Symmetry: bật.**
- **Vũ khí**: WPN_daikiem_vandon (tuỳ chọn).
- **Ảnh tham chiếu**: `game/assets/comic/B20/O7.webp`.
- **Lưu ý**: không khai thác đời tư (`canon.json:2906`).

### A6 · H38 · Yết Kiêu · tướng ta, chưa có trong game

Đang dựng ("sắp có" ở B20). Danh tính là Chính sử; tài lặn và đục thuyền là Tương truyền. Theo truyện: thợ lặn thủy quân, người gầy gân guốc, cởi trần, khăn đen buộc trán, quần sẫm tới gối, cuộn dây thừng vắt vai. Khoảng 30 tuổi **(đề xuất; truyện vẽ trẻ, thần tích cho khoảng 46)**.

PROMPT (dán thẳng):
```text
Lean wiry Vietnamese navy diver, 13th-century Tran dynasty, around 30, bare-chested, sun-darkened skin, black cloth headband over a small topknot. Dark knee-length trousers, red cloth sash, barefoot, coiled hemp rope slung across one shoulder, small cloth pouch at the hip. A-pose, straight arms 45° down, elbows straight, relaxed open hands, fingers together, feet shoulder-width, facing front, mouth closed. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 10–20k; cao 1,72 m. **Symmetry: tắt** (dây vắt một vai, túi một bên hông). Cuộn dây dính thân.
- **Vũ khí**: WPN_doandao + WPN_duisat (tuỳ chọn).
- **Ảnh tham chiếu**: `game/assets/comic/B20/O6.webp`, `O7.webp`.
- **Lưu ý**: không đưa chuyện "nàng Vân" vào game; lặn và đục thuyền gắn nhãn Tương truyền (`canon.json:3233`).

### A7 · H39 · Dã Tượng · người cưỡi voi, chưa có trong game

Gia tướng của Hưng Đạo vương cùng Yết Kiêu. Danh tính và lời nói năm 1285 là Chính sử; tài điều khiển voi chiến là **Tương truyền**, gắn với cái tên "Dã Tượng" (voi rừng). Vũ khí riêng trong canon: voi chiến "Voi Rừng" đeo bành gỗ, ngà bọc đồng; ông đánh bằng **móc voi** và **giáo ngắn** trên lưng voi. Canon không tả mặt mũi: khoảng 35 tuổi, vai rộng, râu ngắn, khăn nâu là **(đề xuất)**. Ngồi trên bành hay trên cổ voi là tư thế Claude dựng bằng rig, nên mẫu vẫn A-pose.

PROMPT (dán thẳng):
```text
Strong Vietnamese war-elephant handler, 13th-century Tran dynasty, about 35, broad weathered face, short black beard, black topknot under a brown cloth head wrap. Brown knee-length tunic, black lacquer lamellar vest with bronze trim, leather bracers, red sash, dark trousers, black cloth shoes. A-pose, straight arms 45° down, elbows straight, relaxed open hands, fingers together, feet shoulder-width, facing front, mouth closed. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 10–20k; cao 1,78 m. **Symmetry: bật** (áo cân hai bên; móc voi, giáo là tệp riêng).
- **Vũ khí**: WPN_moc_voi (tay phải) + WPN_giao_dv (Claude rút ngắn còn khoảng 2 m). **Voi**: MOUNT_voi_chien + PROP_banh_voi.
- **Lưu ý**: mọi chiến công trên voi gắn nhãn Tương truyền (`canon.json`, H39 notes).

### A8 · H27 · Trần Thái Tông · vua, chưa có trong game

Vua đầu tiên nhà Trần, tự cầm quân năm 1258 ở Bình Lệ Nguyên và Đông Bộ Đầu (B12, B13; hai trận này chưa có trong game, `game/js/data/battles.js`). Chính sử (`canon.json:2260`); diện mạo là Hư cấu, theo `design/3d-ref/PROMPTS-TUONG.md` H27. Khoảng 40 tuổi năm 1258 (sinh 1218). Áo son sẫm viền vàng, giáp then viền vàng, mũ lụa đen có đồ trang sức vàng. Lọng vàng của kỹ năng "Ngự Giá Thân Chinh" là đạo cụ code, không thuộc mẫu. Prompt không ghi `emperor`: chữ ấy kéo về vương miện, áo rồng; áo son sẫm và mũ lụa đen đủ nói vai vua. Đồ trang sức vàng viết là một trâm vàng nhỏ ở trước mũ (`gold pin`), không `gold ornament`: món trang sức tả chung chung trên đỉnh mũ từng ra mào kiểu vương miện (ghi chú B9).

PROMPT (dán thẳng):
```text
Vietnamese commander, 13th-century Tran dynasty, about 40, resolute face, short black beard and moustache. Topknot under a small soft round black silk cap with a gold pin at the front. Dark red war robe, black lacquer lamellar armor and shoulder guards with gold trim, gold-trimmed belt, black boots. A-pose, straight arms 45° down, elbows straight, relaxed open hands, fingers together, feet shoulder-width, facing front, mouth closed. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 10–20k; cao 1,74 m **(đề xuất)**. **Symmetry: bật.**
- **Vũ khí** (tệp riêng, chưa có prompt, mục 0.8): Ngự kiếm Thiên Mạc (kiếm thẳng, lưỡi khắc sóng nước) và khiên mây tròn sơn son; khiên tạm dùng câu khiên mây ở G13. Hư cấu.

### A9 · H28 · Trần Thủ Độ · Thái sư, chưa có trong game

Thái sư năm 1258 (B13), người đáp vua "Đầu thần chưa rơi xuống đất". Chính sử (`canon.json:2343`); nhân vật gây tranh cãi, game chỉ khắc hoạ vai trò năm 1258. Khoảng 64 tuổi (sinh 1194): người gầy, thẳng lưng, râu bạc dài. Áo đen viền đỏ sẫm dưới giáp then cũng viền đỏ sẫm (prompt không viết giáp buộc dây màu: dây lụa màu trên giáp sơn là dấu giáp samurai). Prompt cũng không viết `grand chancellor`: chữ chức quan đi cùng `black silk cap` dễ kéo về mũ quan có cánh (cánh chuồn, mục 2.6), như chữ vai trò từng kéo mũ tuồng có cánh ở H33 (mục P1, suy luận). Diện mạo Hư cấu theo 3d-ref.

PROMPT (dán thẳng):
```text
Elderly Vietnamese commander in war gear, 13th-century Tran dynasty, about 64, lean and upright, stern face, grey moustache and long thin grey beard. Small soft round black silk cap hugging the topknot. Black robe with dark red trim, black lacquer lamellar armor with dark red trim, black boots. A-pose, straight arms 45° down, elbows straight, relaxed open hands, fingers together, feet shoulder-width, facing front, mouth closed. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 10–20k; cao 1,72 m **(đề xuất)**. **Symmetry: bật.**
- **Vũ khí**: Đại kỳ Thái sư, cờ lệnh đen viền đỏ trên cán sắt dài 3 m có mũi giáo (Hư cấu): tạm WPN_giao_dv, lá cờ do code dựng và vẽ như cờ lưng (`flagTexture`, `models.js:463`); chưa có prompt riêng.

### A10 · H29 · Lê Phụ Trần · tướng hộ vệ, chưa có trong game

Lấy ván thuyền che tên cho vua Thái Tông ở Bình Lệ Nguyên năm 1258 (B12, B13). Chính sử (`canon.json:2423`); năm sinh không rõ, khoảng 35 theo 3d-ref **(đề xuất)**. Dáng chắc nịch, khăn đen, giáp da nâu sẫm, thắt lưng đỏ. Chuyện ông là cha Trần Bình Trọng chỉ là gia phả (Tương truyền), không thể hiện qua mẫu.

PROMPT (dán thẳng):
```text
Sturdy watchful Vietnamese bodyguard general, 13th-century Tran dynasty, about 35, short black beard, black topknot under a black cloth head wrap. Dark brown tunic, dark brown lacquered leather lamellar armor and shoulder guards, red sash, black boots. A-pose, straight arms 45° down, elbows straight, relaxed open hands, fingers together, feet shoulder-width, facing front, mouth closed. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 10–20k; cao 1,76 m **(đề xuất)**. **Symmetry: bật.**
- **Vũ khí**: tấm ván mạn thuyền đóng quai làm khiên (Chính sử: ván thuyền che vua; dáng là Hư cấu) và kiếm ngắn: chưa có prompt; kiếm tạm WPN_dao.

### A11 · H30 · Trần Nhân Tông · vua, chưa có trong game

Vua thứ ba nhà Trần, cùng Thượng hoàng và Hưng Đạo vương lãnh đạo kháng chiến 1285 và 1288 (B14, B17, B20). Chính sử (`canon.json:2504`). Khoảng 30 tuổi (sinh 1258). Áo ngự son sẫm viền vàng, giáp then nhẹ viền vàng, đai ngọc. Bút lông cán ngọc, quạt giấy và trống ngự nhỏ bên hông là đạo cụ kỹ năng (Hư cấu), tệp riêng hoặc code dựng, không dính thân. Prompt không ghi `emperor`, `imperial` (kéo về vương miện, áo rồng), không `scholarly` (chữ vai trò, như H28), và viết trâm vàng như H27.

PROMPT (dán thẳng):
```text
Young Vietnamese commander in the field, 13th-century Tran dynasty, about 30, serene face, thin moustache. Topknot under a small soft round black silk cap with a small gold pin at the front. Dark red robe with gold borders, light black lacquer lamellar armor with gold trim, jade belt, black boots. A-pose, straight arms 45° down, elbows straight, relaxed open hands, fingers together, feet shoulder-width, facing front, mouth closed. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 10–20k; cao 1,72 m **(đề xuất)**. **Symmetry: bật.**
- **Vũ khí**: quạt WPN_quat (G15); bút lông cán ngọc và trống ngự: chưa có prompt.
- **Lưu ý**: không hiện chữ thích trên tay năm 1285 (canon H30), không hào quang.

### A12 · H32 · Trần Quang Khải · tướng, chưa có trong game

Chiêu Minh Đại vương, Thượng tướng Thái sư; phá quân Nguyên ở Chương Dương năm 1285 (B16). Chính sử (`canon.json:2670`). Khoảng 44 tuổi (sinh 1241), dáng văn võ, ria và râu ngắn. Áo xanh ngọc sẫm **(đề xuất, theo 3d-ref)** dưới giáp then viền vàng; ống tên lệnh có còi sau lưng dính thân như H40. Prompt không ghi `prince` (vương miện), `archer` (cạnh ống tên, chữ ấy kéo cây cung vào tay) và `poet-warrior` (chữ vai trò, như H28).

PROMPT (dán thẳng):
```text
Vietnamese general, 13th-century Tran dynasty, about 44, calm noble bearing, neat moustache and short beard. Topknot under a black silk cap with a gold pin. Dark jade-green robe, black lacquer lamellar armor with gold trim, quiver of arrows on the back, black boots. A-pose, straight arms 45° down, elbows straight, relaxed open hands, fingers together, feet shoulder-width, facing front, mouth closed. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 10–20k; cao 1,76 m **(đề xuất)**. **Symmetry: tắt** (ống tên).
- **Vũ khí**: WPN_cung_viet (Cung Chiêu Minh, cung sừng dài; Hư cấu). Tên lệnh có còi: PROP_mui_ten, Claude thêm đầu còi.

### A13 · H36 · Trần Bình Trọng · tướng, chưa có trong game

Bảo Nghĩa hầu, chặn hậu ở bãi Đà Mạc năm 1285 để triều đình rút (B14). Chính sử (`canon.json:2997`). Khoảng 26 tuổi (sinh 1259), dáng thẳng, bất khuất; khăn đen, áo son sẫm, giáp then đinh đồng.

PROMPT (dán thẳng):
```text
Young Vietnamese noble general, 13th-century Tran dynasty, about 26, upright defiant bearing, no beard, thin light moustache, black topknot under a black cloth head wrap. Dark red tunic, black lacquer lamellar armor and shoulder guards with bronze studs, black boots. A-pose, straight arms 45° down, elbows straight, relaxed open hands, fingers together, feet shoulder-width, facing front, mouth closed. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 10–20k; cao 1,76 m **(đề xuất)**. **Symmetry: bật.**
- **Vũ khí**: Giáo Bảo Nghĩa, cán gỗ lim 2,5 m đuôi bịt đồng (Hư cấu): tạm WPN_giao_dv, Claude rút ngắn và nhuộm cán sẫm.
- **Lưu ý**: không dựng cảnh bị bắt hay xử tử (canon H36).

### A14 · H37 · Phạm Ngũ Lão · tướng, chưa có trong game

Người làng Phù Ủng, xuất thân bình dân; đánh quân Nguyên năm 1285 và 1288 (B18, B20). Chính sử (`canon.json:3078`); chuyện ngồi đan sọt là Tương truyền. Khoảng 30 tuổi (sinh 1255), vai rộng. Prompt không tả bàn tay to (dễ ra bàn tay quá khổ hoặc cầm nông cụ). Khác H29 ở giáp then (H29 giáp da nâu).

PROMPT (dán thẳng):
```text
Strong earnest Vietnamese general of common birth, 13th-century Tran dynasty, about 30, broad shoulders, short black beard, black topknot under a black cloth head wrap. Plain dark brown tunic, black lacquer lamellar armor, red sash, black boots. A-pose, straight arms 45° down, elbows straight, relaxed open hands, fingers together, feet shoulder-width, facing front, mouth closed. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 10–20k; cao 1,80 m **(đề xuất)**. **Symmetry: bật.**
- **Vũ khí**: Sóc Phù Ủng, giáo dài cán tre đực, lưỡi lá dài (Chính sử: thơ Thuật hoài; dáng Hư cấu): tạm WPN_giao_dv; chưa có prompt riêng.

### A15 · TT · Triệu Trung · gia tướng quân Tống lưu vong, chưa có trong game

Gia tướng người Tống lưu vong của Chiêu Văn vương Trần Nhật Duật, dẫn quân áo Tống ở Hàm Tử năm 1285 (B15). Người là Chính sử (Toàn thư, `canon.json:2758`); trang phục là Hư cấu theo truyện (`comic/B15-ham-tu/PROMPTS.md:39`). Game có Kế Sách "Cờ áo Tống" với hai thuyền quân Triệu Trung (`kesach.js:150-165`) nhưng chưa có nhân vật ông. Khoảng 45 **(đề xuất)**. Cùng kiểu áo với quân áo Tống (C4) nhưng màu đất sẫm hơn, giáp da cũ.

PROMPT (dán thẳng):
```text
Exiled Southern Song officer, 13th century, about 45, lean weathered face, trimmed moustache, short beard. Black cloth head wrap knotted at the back, jade-green scarf at the neck. Knee-length round-collar dark ochre robe, brown leather lamellar cuirass, black boots, arrow quiver at the right hip. A-pose, straight arms 45° down, elbows straight, relaxed open hands, fingers together, feet shoulder-width, facing front, mouth closed. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 10–20k; cao 1,76 m **(đề xuất)**. **Symmetry: tắt** (ống tên một bên hông).
- **Vũ khí**: WPN_cung_viet (cung tên theo Toàn thư); kiếm đeo hông của bản 3d-ref bỏ, vì mẫu tay không.
- **Lưu ý**: đồng minh có phẩm giá, chiến đấu vì mối thù mất nước. Khăn cổ xanh ngọc phải rõ để không nhầm với địch (`comic-b15.js:224`). Cung thủ "TONG" của 3d-ref là lính đám đông, đã có ở mục C4 (DV_AOTONG), không thêm mục riêng.

---

## B. Tướng và sĩ quan Nguyên

### B1 · X19 · Toa Đô (唆都, Sögetü) · boss B15

Boss pha 4 ở B15: đổ bộ lên bãi cát rồi rút chạy. Chính sử (người Jalair, danh tướng từng dự trận Tương Dương); việc ông có mặt ở Hàm Tử là Hư cấu. Màu theo `RIGS.tuong`: áo tím than, giáp then viền vàng, mũ lông chóp vàng. Theo truyện: tuổi năm mươi, mặt dạn phong sương, giáp trầy vì hành quân lâu. Râu điểm bạc là **(đề xuất)** theo truyện; rig hiện không có râu.

PROMPT (dán thẳng):
```text
Veteran Mongol-Yuan general, 13th century, about 55, weathered dignified face, grey-streaked moustache and beard. Tall brown fur hat tapering upward, gold spike on top. Heavy black lacquer lamellar armor with gold trim, worn and scuffed, dark plum robe, leather belt, tall riding boots. A-pose, arms 45° down, open empty hands, fingers slightly apart, feet shoulder-width, facing front, mouth closed. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 10–20k; cao 1,90 m, vạm vỡ (game phóng ×1,38).
- **Tách riêng**: áo choàng nâu đỏ sẫm `#4a2f2a` viền vàng → PROP_cape.
- **Vũ khí**: WPN_dadao (theo game). Nếu muốn đúng truyện thì dùng WPN_daiphu.
- **Ảnh tham chiếu**: `game/assets/comic/B15/O4.webp`, `K2.webp`.
- **Lưu ý**: đối thủ có danh dự, không cảnh chém đầu (`canon.json:5159`). Mặt nghiêm và cứng cỏi, không dữ tợn kiểu phản diện.

### B2 · X20 · Ô Mã Nhi (烏馬兒) · boss B20

Boss pha 6 ở B20, trên kỳ hạm. Chính sử (người Sắc mục, vạn hộ thủy quân); màu, mũ và cờ của rig là Hư cấu. Màu theo `RIGS.X20`: giáp nặng then viền vàng như H31, mũ lông chóp vàng, râu đen. Theo truyện: tuổi bốn mươi, gốc Trung Á, râu rậm, dáng kiêu hãnh và kỷ luật, mũ cắm chùm lông đỏ.

PROMPT (dán thẳng):
```text
Proud Central Asian admiral of the Yuan navy, 13th century, about 45, noble features, thick black beard and moustache. Tall brown fur hat with gold spike and small red plume. Heavy black lacquer lamellar armor with gold trim, gold chest mirror, layered pauldrons, knee guards, near-black robe, tall boots. A-pose, arms 45° down, open empty hands, fingers slightly apart, feet shoulder-width, facing front, mouth closed. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 10–20k; cao 1,92 m (game phóng ×1,42, to nhất game).
- **Tách riêng**: áo choàng đỏ sẫm `#6a2420` → PROP_cape; cờ lưng 烏馬兒 → PROP_co_lung (code vẽ chữ, nền `#6a2420`, chữ `#f1d98a`).
- **Vũ khí**: WPN_dadao.
- **Ảnh tham chiếu**: `game/assets/comic/B20/O2.webp`, `O8.webp`, `K2.webp`.
- **Lưu ý**: khi bị bắt ông đứng thẳng, vũ khí đặt dưới chân, không trói, không quỳ (`units.js:7-9`). Cờ phải ghi đủ ba chữ, vì riêng chữ 烏 đọc là "con quạ" (`models.js:408`).

### B3 · X24 · Phàn Tiếp (樊楫) · boss B20

Boss pha 5 ở B20, bị bắt sống. Chính sử; màu và cờ của rig là Hư cấu. Tướng thủy quân cẩn trọng, sớm nghi lòng sông ("Nước này quá lặng"). Màu theo `RIGS.X24`: áo chàm, giáp thép xám xanh, viền bạc, mũ trụ nhọn bạc, râu sẫm. Tuổi khoảng 50 **(đề xuất)**.

PROMPT (dán thẳng):
```text
Cautious Yuan naval commander, 13th century, about 50, watchful thoughtful face, short dark beard. Tall pointed silver-grey steel helmet with brown fur rim. Blue-grey steel lamellar armor with silver trim, dark indigo robe and skirt flaps, leather belt, tall black boots. A-pose, arms 45° down, open empty hands, fingers slightly apart, feet shoulder-width, facing front, mouth closed. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 10–20k; cao 1,86 m (game ×1,34).
- **Tách riêng**: áo choàng chàm sẫm `#27324a` → PROP_cape; cờ lưng 樊 → PROP_co_lung (nền `#27324a`, chữ `#e6dcc3`).
- **Vũ khí**: WPN_dadao.
- **Lưu ý**: bị bắt trong tư thế chỉ huy tới cùng, đứng thẳng (`canon.json:5281`).

### B4 · OFF_tuong · Tướng Nguyên (tướng địch không tên)

Dùng ở Tự do (trận đấu tướng từ bậc 4) và Võ trường (đợt 5, Luyện tập bậc Tướng). Hư cấu. Hiện game dùng chung rig với Toa Đô; tệp riêng này giúp Toa Đô có nét riêng. Mặt khoảng 40 tuổi, cạo râu như rig **(đề xuất)**.

PROMPT (dán thẳng):
```text
Mongol-Yuan general, 13th century, about 40, stern clean-shaven face. Tall brown fur hat tapering upward, gold spike on top. Black lacquer lamellar armor with gold trim, dark plum robe, plum skirt flaps with gold hems, leather belt, tall riding boots. A-pose, arms 45° down, open empty hands, fingers slightly apart, feet shoulder-width, facing front, mouth closed. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 10–20k; cao 1,88 m (game ×1,38).
- **Tách riêng**: áo choàng `#4a2f2a` → PROP_cape.
- **Vũ khí**: WPN_dadao.

### B5 · OFF_photuong · Phó tướng Nguyên (sĩ quan bậc 2)

Giữ doanh trại A2/B2 ở B15; có ở Tự do và Võ trường. Hư cấu. Màu theo `RIGS.photuong`: áo chàm, giáp then, viền và chóp mũ màu xám bạc (Toa Đô thì chóp vàng). Rig không có râu. Tuổi khoảng 35 **(đề xuất)**.

PROMPT (dán thẳng):
```text
Mongol-Yuan deputy commander, 13th century, about 35, stern clean-shaven face. Tall brown fur hat tapering upward, silver-grey spike on top. Black lacquer lamellar armor with silver-grey trim, dark indigo robe, indigo skirt flaps, leather belt, tall riding boots. A-pose, arms 45° down, open empty hands, fingers slightly apart, feet shoulder-width, facing front, mouth closed. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 10–15k; cao 1,82 m (game ×1,22).
- **Tách riêng**: áo choàng xám xanh `#3b4a5a` → PROP_cape.
- **Vũ khí**: WPN_dadao (khâu màu xám).

### B6 · OFF_doitruong · Đội trưởng Nguyên (sĩ quan bậc 1)

Sĩ quan địch gặp nhiều nhất: đồn A1/B1 ở B15, trên thuyền và cầu thang kỳ hạm ở B20, Tự do, Võ trường, Huấn luyện. Hư cấu. Màu theo `RIGS.doitruong`: áo chàm, giáp thép xám xanh, viền bạc, mũ trụ nhọn bạc viền lông. Không áo choàng. Tuổi khoảng 30 **(đề xuất)**.

PROMPT (dán thẳng):
```text
Mongol-Yuan squad captain, 13th century, about 30, alert clean-shaven face. Tall pointed silver-grey steel helmet with brown fur rim. Blue-grey steel lamellar cuirass and shoulder guards with silver trim, dark indigo robe and skirt flaps, leather belt, black boots. A-pose, arms 45° down, open empty hands, fingers slightly apart, feet shoulder-width, facing front, mouth closed. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 10–12k (mức thấp nhất của sĩ quan theo quy cách, vì Đội trưởng hay xuất hiện nhiều người cùng lúc); cao 1,78 m (game ×1,12).
- **Vũ khí**: WPN_dao (tay phải) + WPN_khien_tron_ng (cẳng tay trái).

### B7 · X16 · Ngột Lương Hợp Thai (兀良合台, Uriyangkhadai) · chủ soái 1258, chưa có trong game

Chủ soái Mông Cổ năm 1258 (B12, B13), con danh tướng Tốc Bất Đài, cha A Truật. Chính sử (`canon.json:5062`); diện mạo Hư cấu theo 3d-ref. Khoảng 57 tuổi **(đề xuất; sinh khoảng 1200)**: lão tướng thảo nguyên, ria dài và râu thưa bạc. Prompt viết `Senior`, không `Veteran` (P2 ghi chữ ấy kéo về dáng thủ lĩnh man rợ, suy luận). Mũ trụ Mông Cổ mở mặt (câu mũ đã dựng đúng ở FIX của OFF_doitruong, `MONGOL_HELM2` trong `meshy.mjs`). 3d-ref vẽ ông trên ngựa; mẫu này đứng A-pose như NG_KY, Claude dựng tư thế ngồi. Ngựa thảo nguyên màu vàng sẫm: MOUNT_ngua_nguyen hoặc MOUNT_ngua_tuong, Claude đổi màu lông.

PROMPT (dán thẳng):
```text
Senior Mongol marshal, 13th century, about 57, weathered face, long grey moustache, thin grey beard. Open-face Mongol helmet: tall onion-shaped steel bowl, brown fur band, neck flaps. Heavy blue-grey steel lamellar armor over a dark brown crossover robe, arrow quiver at the right hip, riding boots. A-pose, straight arms 45° down, elbows straight, relaxed open hands, fingers together, feet shoulder-width, facing front, mouth closed. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 10–20k; cao 1,74 m, thấp chắc **(đề xuất)**. **Symmetry: tắt** (ống tên một bên hông).
- **Tách riêng**: áo choàng viền lông → PROP_cape. **Vũ khí**: WPN_cung_ng; đao đeo hông của bản 3d-ref bỏ.
- **Lưu ý**: lão tướng dày dạn nhất thời đại, nói năng tôn trọng đối thủ (canon `dignity`); không biếm hoạ.

### B8 · X17 · A Truật (阿朮, Aju) · tướng trẻ Mông Cổ, chưa có trong game

Con Ngột Lương Hợp Thai, theo cha đánh Đại Việt năm 1258 (B12, B13); về sau là đại tướng vây Tương Dương. Chính sử (`canon.json:5087`). Khoảng 31 tuổi (sinh 1227), dáng hăng hái tự tin. Đỉnh mũ là một chóp thép ngắn, đếm được; tua đỏ cắm ở chóp Claude dựng bằng code (mục 0.3), vì tua mềm trong prompt dễ ra đúng kiểu mào tua tủa đã hỏng ở OFF_photuong (mục P3, suy luận).

PROMPT (dán thẳng):
```text
Bold young Mongol general, 13th century, about 31, confident eyes, short moustache. Open-face Mongol helmet: tall onion-shaped steel bowl, brown fur band, one short steel cone on top. Blue-grey steel lamellar armor over a dark indigo crossover robe, leather belt, leather riding boots. A-pose, straight arms 45° down, elbows straight, relaxed open hands, fingers together, feet shoulder-width, facing front, mouth closed. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 10–20k; cao 1,80 m **(đề xuất)**. **Symmetry: bật.**
- **Vũ khí**: giáo kỵ có móc và tua lông ngựa: tạm WPN_giao_ng; chưa có prompt riêng. Đao đeo hông bỏ.

### B9 · X18 · Thoát Hoan (脫歡, Toghon) · Trấn Nam vương, chưa có trong game

Hoàng tử nhà Nguyên, tổng chỉ huy các đợt tiến quân 1285 và 1287–1288 (B16, B18; ở B20 chỉ có trên sa bàn Kế Sách). Chính sử (`canon.json:5112`). Khoảng 35 **(đề xuất; năm sinh không rõ)**, mặt nghiêm và mệt mỏi. Áo gấm chàm sẫm viền vàng cổ lông, giáp mạ vàng, mũ tròn viền lông có chóp vàng. Prompt viết `silk`, không `brocade` (P1 ghi chữ ấy kéo về mũ tuồng có cánh), không `prince`; chóp viết là một chóp ngắn ở chính giữa (núm tròn hay quả cầu trên mũ là dấu mũ quan nhà Thanh; chữ `spike` từng ra mào tua tủa ở P3).

PROMPT (dán thẳng):
```text
Mongol noble commander, 13th century, about 35, stern weary expression, short moustache. Open-face round steel helmet with a brown fur band and one short gold cone on the top centre. Gilded lamellar armor over a dark indigo silk robe with gold trim and fur collar, leather belt, leather boots. A-pose, straight arms 45° down, elbows straight, relaxed open hands, fingers together, feet shoulder-width, facing front, mouth closed. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 10–20k; cao 1,80 m **(đề xuất)**. **Symmetry: bật.**
- **Vũ khí**: kích mạ vàng cán dài: tạm WPN_dadao, Claude nhuộm vàng; chưa có prompt riêng.
- **Lưu ý**: hoàng tử mang gánh nặng lệnh vua cha; chuyện chui ống đồng là mưu thoát thân của cận vệ, không chế giễu (canon `dignity`).

### B10 · X21 · Lý Hằng (李恆, Li Heng) · lão tướng Đảng Hạng, chưa có trong game

Tướng Nguyên dòng dõi hoàng tộc Tây Hạ, cầm hậu vệ khi Thoát Hoan rút năm 1285 (B18). Chính sử (`canon.json:5191`). Khoảng 49 tuổi (mất khoảng 50 tuổi năm 1285), người gầy, râu điểm bạc. 3d-ref vẽ ông trên ngựa; mẫu đứng A-pose, ngựa nâu sẫm dùng mẫu ngựa có sẵn đổi màu.

PROMPT (dán thẳng):
```text
Lean senior Yuan general of Tangut descent, 13th century, about 49, calm steady eyes, grey-streaked beard. Open-face round steel helmet with a brown fur band and one short cone on the top centre. Blue-grey steel lamellar armor over a slate-blue robe, arrow quiver at the right hip, riding boots. A-pose, straight arms 45° down, elbows straight, relaxed open hands, fingers together, feet shoulder-width, facing front, mouth closed. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 10–20k; cao 1,78 m **(đề xuất)**. **Symmetry: tắt** (ống tên một bên hông).
- **Tách riêng**: áo choàng sẫm → PROP_cape. **Vũ khí**: WPN_cung_ng.
- **Lưu ý**: không hiển thị vết thương hay tên độc (canon `dignity`).

### B11 · X22 · Lý Quán (李瓘, Li Guan) · phó tướng hầu cận, chưa có trong game

Tướng trong đạo quân Thoát Hoan năm 1285 (B18); Toàn thư chép ông giấu Thoát Hoan trong ống đồng để thoát về bắc. Chính sử (`canon.json:5215`); gốc người Hán là theo 3d-ref (Hư cấu). Khoảng 45 **(đề xuất)**, mặt chân thành, che chở.

PROMPT (dán thẳng):
```text
Loyal Han Chinese aide-general in Yuan service, 13th century, about 45, earnest protective face, moustache. Open-face round steel helmet with a brown fur band. Blue-grey steel lamellar armor with silver-grey trim over a dark indigo robe, leather belt, leather boots. A-pose, straight arms 45° down, elbows straight, relaxed open hands, fingers together, feet shoulder-width, facing front, mouth closed. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 10–20k; cao 1,78 m **(đề xuất)**. **Symmetry: bật.**
- **Vũ khí**: WPN_giao_ng + WPN_khien_tron_ng thu nhỏ ×0,72 như NG_GIAO.
- **Lưu ý**: người hầu cận liều mình cứu chủ, kể bằng giọng trân trọng (canon `dignity`).

### B12 · X23 · Trương Văn Hổ (張文虎, Zhang Wenhu) · vạn hộ đoàn thuyền lương, chưa có trong game

Chỉ huy đoàn thuyền lương đường biển năm 1287–1288 (B19, Vân Đồn). Chính sử (`canon.json:5238`); gốc người Hán theo 3d-ref. Khoảng 45 **(đề xuất)**, mặt cẩn thận, thực tế. Cuộn sổ hàng buộc ở hông trái, dính thân.

PROMPT (dán thẳng):
```text
Careful practical Han Chinese naval supply commander of the Yuan, 13th century, about 45, moustache and short beard. Open-face round steel helmet with a brown fur band. Blue-grey steel lamellar armor over a grey-blue robe, cloth sash, rolled paper ledger tied at the left hip, leather boots. A-pose, straight arms 45° down, elbows straight, relaxed open hands, fingers together, feet shoulder-width, facing front, mouth closed. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 10–20k; cao 1,76 m **(đề xuất)**. **Symmetry: tắt** (cuộn sổ một bên hông).
- **Vũ khí**: kích cán dài: tạm WPN_dadao; chưa có prompt riêng.
- **Lưu ý**: quan vận lương tận tụy lo cho binh sĩ tuyến trước (canon `dignity`).

### B13 · X25 · A Bát Xích (來阿八赤, Abachi) · tướng Đường Ngột mở đường, chưa có trong game

Tướng Nguyên người Đường Ngột (Tangut), cầm quân mở đường khi quân Nguyên rút năm 1288 (B20, chỉ ở sa bàn Kế Sách "Chặn đường bộ Nội Bàng"; bản đánh trực tiếp chưa có, canon `openQuestions`). Chính sử (`canon.json:5285`). Khoảng 45 **(đề xuất)**, mặt rộng, râu ngắn; mũ nỉ viền lông trùm mũ sắt, áo xanh lục sẫm. Prompt chỉ tả mũ nỉ vành lông; mũ sắt bên trong không thấy, tả hai lớp thì dễ ra lớp chồng lộn xộn.

PROMPT (dán thẳng):
```text
Brave Yuan general of Tangut origin, 13th century, about 45, broad face, short beard. Round brown felt hat with a fur brim. Blue-grey steel lamellar armor over a dark green robe, leather belt, leather boots. A-pose, straight arms 45° down, elbows straight, relaxed open hands, fingers together, feet shoulder-width, facing front, mouth closed. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 10–20k; cao 1,82 m **(đề xuất)**. **Symmetry: bật.**
- **Vũ khí**: giáo lưỡi rộng: tạm WPN_giao_ng. Đao đeo hông bỏ.
- **Lưu ý**: tướng đi đầu nơi nguy hiểm nhất để đồng đội rút; cái chết chỉ nêu trong thẻ Sử quán, không dựng cảnh (canon).

---

## C. Lính đám đông quân Trần

Hàng trăm lính cùng lúc nên giữ lưới rất nhẹ (1,5–3k tam giác). Lính Tinh nhuệ dùng chung lưới, game chỉ phóng ×1,05 và nhuộm sẫm (`crowd.js:689`). Cần một mặt chung chung, không cá tính quá mạnh, để lặp lại không lộ. Hai phe khác nhau cả ở dáng mũ lẫn dáng vạt áo (`soldiers.js:196-197`). Vạt áo quân Trần: vạt trước hẹp thon nhọn như tấm yếm, vạt sau rộng.

### C1 · DV_GIAO · Giáo binh

Kiểu lính đông nhất của quân ta (50% binh chủng). Có ở B15, B20 (thủy thủ, thân binh, vòng vây bắt sống), Tự do và khán giả Võ trường. Hư cấu (kiểu lính là đề xuất bản thử, `tuning.js:142`).

PROMPT (dán thẳng):
```text
Vietnamese Tran dynasty infantryman, 13th century, young beardless face. Low wide conical straw hat over a black headband. Vermilion tunic, black lacquer chest plate, black belt and wrist guards, narrow pointed vermilion front apron, wide back flap, black hems, black trousers, straw leg wraps, black shoes. A-pose, arms 45° down, open empty hands, fingers slightly apart, feet shoulder-width, facing front, mouth closed. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 1,5–3k; cao 1,75 m.
- **Vũ khí**: WPN_giao_dv (tay phải). Tua đỏ do code dựng.

### C2 · DV_DAO · Đao khiên

30% binh chủng. Có mặt ở mọi chỗ có quân Trần như DV_GIAO, thường xen kẽ với giáo binh trong đội thân binh. Hư cấu. Không đội nón: khăn đỏ quấn đầu, búi tóc.

PROMPT (dán thẳng):
```text
Vietnamese Tran dynasty infantryman, 13th century, young beardless face, black topknot, vermilion cloth wrapped around the head. Dark red tunic, black lacquer chest plate and shoulder pads, black belt, dark red front apron and back flap with black hems, black trousers, straw-colored leg wraps, black shoes. A-pose, arms 45° down, open empty hands, fingers slightly apart, feet shoulder-width, facing front, mouth closed. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 1,5–3k; cao 1,75 m.
- **Vũ khí**: WPN_dao_linh (tay phải) + WPN_khien_nhat_dv (cẳng tay trái).

### C3 · DV_NO · Nỏ thủ

20% binh chủng, bắn xa 14 m. Có ở B15 và trên thuyền ta ở B20. Hư cấu. Nón chóp cao hơn, vành hẹp hơn nón giáo binh; áo giáp vải màu rơm; hộp tên nỏ sau lưng.

PROMPT (dán thẳng):
```text
Vietnamese Tran dynasty foot soldier, 13th century, young beardless face. Tall narrow-brimmed conical straw hat over a wide black headband. Vermilion tunic under a padded straw-colored vest, matching apron and back flap with black hems, black trousers, leg wraps, black shoes, brown wooden box on the back. A-pose, arms 45° down, open empty hands, fingers slightly apart, feet shoulder-width, facing front, mouth closed. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 1,5–3k; cao 1,75 m. **Symmetry: tắt** (hộp tên lệch một bên). Hộp tên nâu `#4a3524` sau lưng, lệch trái, dính thân; nếu công cụ đặt hộp vào giữa lưng thì vẫn dùng được.
- **Vũ khí**: WPN_no (báng dọc cẳng tay phải).

### C4 · DV_AOTONG · Quân áo Tống (người Tống lưu vong) · tuỳ chọn

Kế Sách "Cờ áo Tống" ở B15: gia binh người Tống của Chiêu Văn vương, Triệu Trung dẫn. Hiện game chỉ nhuộm lưới DV sang màu cam hổ phách (`kesach.js:164`). Người Tống mặc áo Tống, cầm cung tên là Chính sử (Toàn thư); khăn xanh ngọc nhận diện là Hư cấu (quy ước truyện, `comic-b15.js:241`). Theo truyện, lính Tống quấn khăn đen buộc sau gáy, buộc khăn xanh ngọc ở cổ, thắt lưng da (`comic/B15-ham-tu/PROMPTS.md:147`; Triệu Trung cũng vậy, dòng 39), và ống tên đeo ở hông như Triệu Trung. Kiểu áo cổ tròn dài tới gối và màu hổ phách hợp với màu nhuộm trong game **(đề xuất)**.

PROMPT (dán thẳng):
```text
Southern Song exile soldier, 13th century, short black beard, black cloth head-wrap knotted at the back, jade-green scarf knotted at the neck. Knee-length round-collar amber-ochre robe, brown leather lamellar vest, leather belt, dark trousers, black cloth boots, arrow quiver at the right hip. A-pose, straight arms 45° down, elbows straight, relaxed open hands, fingers together, feet shoulder-width, facing front, mouth closed. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 1,5–3k; cao 1,75 m. **Symmetry: tắt** (ống tên một bên hông). Áo hổ phách khoảng `#b0752c` (lấy màu nền cờ 宋, `kesach.js:76`); khăn cổ xanh ngọc khoảng `#2f8f83` **(đề xuất)**. Không có dải khăn buông: mẫu lính đám đông giữ lưới nhẹ, nút khăn sau gáy là đủ. Dựng lưới bằng `latest` (mục 0.8, lượt 1): meshy-5 từng bỏ qua câu tả đầu của DV_DAO, mà khăn cổ là dấu nhận phe.
- **Vũ khí**: WPN_cung_viet (theo Toàn thư: cung tên), hoặc giữ vũ khí DV như game hiện nay.
- **3d-ref**: cung thủ "TONG" ở `design/3d-ref/PROMPTS-TUONG.md` chính là kiểu lính này, không thêm mục riêng. Game thả quân Triệu Trung là giáo binh nhuộm hổ phách (`kesach.js:164`), nên khi nướng bộ lính cần chọn cung (theo Toàn thư) hay giáo (như game); thân tạo tay không nên không ảnh hưởng lúc tạo.
- **Lưu ý**: đồng minh có phẩm giá, chiến đấu vì mối thù mất nước, không phải lính đánh thuê. Theo sử, áo Tống trông gần giống áo Nguyên, nên khăn xanh ngọc phải nổi rõ để người chơi không nhầm với địch (`comic-b15.js:224, 473`).

---

## D. Lính đám đông quân Nguyên

Phe Nguyên dùng chàm, xám thép, lông thú và mũ nhọn. Lính thường có râu đen ngắn (`soldiers.js:193`). Vạt áo: vạt trước xẻ hai tấm loe, vạt sau một tấm, có hàng giáp lá (`soldiers.js:118-129`). Lưu ý ở B20: lính rơi xuống nước thì bơi vào bờ, không có cảnh chết đuối cận cảnh. Lính Nguyên là người lính có kỷ luật, mặt nghiêm, không dữ tợn hay quái dị (mục 2.6); khối NEGATIVE-NV đã có từ chặn quái vật hoá, nên nhớ dán khi công cụ có ô Negative.

### D1 · NG_DAO · Đao thuẫn

40% binh chủng khiên Nguyên. Có ở B15, trên thuyền Nguyên ở B20, Tự do và Võ trường. Hư cấu. Mũ trụ nhọn bảy cạnh màu thép sáng, viền lông, tấm vải chàm che gáy.

PROMPT (dán thẳng):
```text
Mongol-Yuan infantryman, 13th century, short black beard. Tall pointed light-grey steel helmet, brown fur rim, indigo neck flap. Dark indigo crossover robe, blue-grey steel lamellar chest and shoulder plates, wrist guards, split flared indigo skirt panels with lamellae and leather, black belt, brown boots. A-pose, arms 45° down, open empty hands, fingers slightly apart, feet shoulder-width, facing front, mouth closed. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 1,5–3k; cao 1,75 m.
- **Vũ khí**: WPN_dao_linh + WPN_khien_tron_ng.

### D2 · NG_GIAO · Thương binh

27% binh chủng, tầm đâm 2,5 m. Có ở B15, B20, Tự do và Võ trường. Hư cấu. Mũ bát thép tròn có chóp sắt ngắn, núm đỏ trên đỉnh, vải chàm che gáy và hai bên má.

PROMPT (dán thẳng):
```text
Mongol-Yuan infantryman, 13th century, short black beard. Rounded steel helmet with short iron point, red knob on top, indigo neck and cheek flaps. Slate-blue robe, blue-grey steel lamellar chest plate, indigo shoulder pads, steel wrist guards, split skirt panels with lamellae and leather hems, black boots. A-pose, arms 45° down, open empty hands, fingers slightly apart, feet shoulder-width, facing front, mouth closed. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 1,5–3k; cao 1,75 m.
- **Vũ khí**: WPN_giao_ng + WPN_khien_tron_ng thu nhỏ ×0,72 (Claude đổi mặt khiên sang nâu da `#5a4632`, núm xám).

### D3 · NG_CUNG · Cung thủ bộ

20% binh chủng, bắn xa 16 m. Có ở B15, B20 (đội dò luồng), Tự do và Võ trường. Hư cấu. Áo dài tới gối, không giáp lá; mũ lông loe miệng, chóp chàm; ống tên chéo sau lưng.

PROMPT (dán thẳng):
```text
Mongol-Yuan foot soldier, 13th century, short black beard. Brown fur hat flaring outward, small indigo cone on top. Grey-blue knee-length robe split front and back, brown leather chest guard and wrist guards, black trousers, brown boots, brown arrow quiver slung diagonally on the back, cream fletching. A-pose, arms 45° down, open empty hands, fingers slightly apart, feet shoulder-width, facing front, mouth closed. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 1,5–3k; cao 1,75 m. **Symmetry: tắt** (ống tên chéo). Ống tên dính thân.
- **Vũ khí**: WPN_cung_ng (tay trái).

### D4 · NG_TANK · Lực sĩ trọng giáp

13% binh chủng, máu ×3, lao húc người chơi. Có ở B15, Tự do và Võ trường; không có ở B20. Hư cấu. Thân bè ngang ×1,28, mặt che bằng mặt nạ sắt, mũ trụ đen cao có nón thép và gai vàng, cổ áo lông, váy giáp phiến sắt có đinh tán.

PROMPT (dán thẳng):
```text
Broad-shouldered Mongol-Yuan heavy infantryman, 13th century, disciplined human soldier, iron face mask. Tall black helmet with steel cone and gold spike. Fur collar, back pelt, charcoal robe, steel lamellar cuirass, black pauldrons, steel greaves, riveted iron lamellar skirt, indigo trousers, black boots. A-pose, arms 45° down, open empty hands, fingers slightly apart, feet shoulder-width, facing front, mouth closed. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 2–3k; cao 1,85 m chỉ để tả dáng to con. Claude đưa về thân lính chung (đỉnh đầu 1,79 m), game phóng ×1,3 ra khoảng 2,33 m như hiện nay; thân bè ngang ×1,28 nằm sẵn trong hình. Tấm lông sau lưng có thể tách nếu muốn cho đung đưa.
- **Vũ khí**: WPN_chuy.
- **Lưu ý**: to và nặng nhưng là người lính, không phải quái vật. Giáp là giáp phiến (lamellar) như mọi lính Nguyên, váy giáp là phiến sắt dày có hai hàng đinh tán (`soldiers.js:103, 131-142`), không phải giáp tấm châu Âu.

### D5 · NG_KY · Cung kỵ (người cưỡi)

Binh chủng cung kỵ: 40% quân địch ở B15, 12% ở Tự do, 40% ở Võ trường; không có ở B20. Hư cấu. Trong code người cưỡi dính liền với ngựa; theo quy cách, đây là nhân vật A-pose riêng, Claude dựng tư thế ngồi. Phần chân dưới không có trong nguồn: quần chàm, ủng đen **(đề xuất)**.

PROMPT (dán thẳng):
```text
Mongol-Yuan soldier, 13th century, steady face, short black beard. Brown fur hat tapering upward from a wide brim, steel spike on top. Blue-grey steel lamellar coat, steel upper-arm guards, indigo sleeves and waist sash, indigo trousers, tall black boots, brown arrow quiver on the back, cream fletching. A-pose, arms 45° down, open empty hands, fingers slightly apart, feet shoulder-width, facing front, mouth closed. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 1,5–3k; cao 1,75 m. **Symmetry: tắt** (ống tên chéo sau lưng, `soldiers.js:280`). Ống tên dính thân.
- **Negative**: dán NEGATIVE-NV và thêm `, horse, saddle, sitting, mounted` để công cụ không dựng thêm ngựa hay dáng ngồi. Prompt cố ý không dùng chữ "riding" và "horse".
- **Vũ khí**: WPN_cung_ng (tay trái). **Ngựa**: MOUNT_ngua_nguyen.

---

## E. Người lính Tự do theo bậc

Nhân vật người chơi ở chế độ Tự do (`battle/soldier.js:23-34`), tên do người chơi đặt. Game có 5 bậc × 2 binh khí. Màu áo và mũ đổi theo bậc:

| Bậc | Áo | Giáp | Viền | Mũ | Áo choàng | scale |
| --- | --- | --- | --- | --- | --- | --- |
| 0 Lính | `#8a2a1e` | da nâu `#3a2c22` | đồng xỉn `#8a6a3a` | nón lá + khăn đỏ | — | 1,00 |
| 1 Tinh nhuệ | như bậc 0 | | | | — | 1,02 |
| 2 Đội trưởng | `#8a2a1e` | then | vàng | mũ tướng | — | 1,04 |
| 3 Phó tướng | `#6e1d15` | then | vàng | mũ tướng | — | 1,06 |
| 4 Tướng | `#6e1d15` | then | vàng | mũ tướng | son, hẹp ngắn | 1,08 |

**Cách ít tệp nhất**: hai thân, `LINH_r01` cho bậc 0–1 và `LINH_r24` cho bậc 2–4. Bậc 4 gắn thêm PROP_cape (Claude thu hẹp ×0,62, rút ngắn ×0,72). Scale do code lo. Bậc 2 trong game mặc áo đỏ nâu `#8a2a1e`, còn thân r24 mặc son sẫm `#6e1d15`. Hai màu rất gần nhau, nên chấp nhận được; nếu muốn đúng hẳn thì tạo thêm `char_LINH_r2.glb` (mục 23a ở bảng) bằng prompt E2, đổi `Dark red robe` thành `Brick-red robe` và `four dark red skirt flaps` thành `four brick-red skirt flaps` (prompt vẫn dưới 550 ký tự).

**Giữ cùng một khuôn mặt** giữa hai tệp: làm r01 trước, rồi dùng ảnh mẫu của r01 làm ảnh tham chiếu khi tạo r24.

**Không thích chữ "Sát Thát" lên tay.** Đây là Chính sử, nhưng canon ghi không được hiển thị trong trận (`suquan-b20.js:8`).

### E1 · LINH_r01 · Người lính Tự do, bậc Lính và Tinh nhuệ

Hư cấu (người lính, dáng lính, `soldier.js:4`). Tuổi khoảng 20, không râu **(đề xuất)**.

PROMPT (dán thẳng):
```text
Young Vietnamese Tran dynasty foot soldier, 13th century, about 20, beardless determined face. Wide conical palm-leaf hat over a red headband. Brick-red robe, dark brown leather chest armor, arm and shoulder guards with dull bronze trim, four brick-red skirt flaps, black greaves and shoes. A-pose, arms 45° down, open empty hands, fingers slightly apart, feet shoulder-width, facing front, mouth closed. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 10–20k (nhân vật chính); cao 1,78 m. Nón lá rộng (bán kính khoảng 0,4 m, chóp thấp) dính đầu.
- **Vũ khí**: WPN_songdao ×2 (WC03) hoặc WPN_daikiem (WC01). Chắn tay bậc thấp màu đồng xỉn, Claude đổi màu.

### E2 · LINH_r24 · Người lính Tự do, bậc Đội trưởng, Phó tướng, Tướng

Hư cấu. Cùng người với E1 nhưng đội mũ tướng (bát vàng, chóp đỏ nhọn) và mặc giáp then viền vàng.

PROMPT (dán thẳng):
```text
Young Vietnamese Tran dynasty officer, 13th century, about 22, beardless determined face. Short gold cylindrical helmet with a tall thin red spike. Dark red robe, black lacquer lamellar chest armor, arm and shoulder guards with gold trim, four dark red skirt flaps with gold hems, black greaves and shoes. A-pose, arms 45° down, open empty hands, fingers slightly apart, feet shoulder-width, facing front, mouth closed. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 10–20k; cao 1,78 m.
- **Tách riêng**: bậc Tướng thêm áo choàng son → PROP_cape.
- **Vũ khí**: như E1.

---

## F. Năm lớp cận vệ (chế độ Tự do)

Cận vệ của người lính, tối đa 4 người theo bậc (`guards.js:12-14`). Hư cấu (`guards.js:6`). Năm lớp dùng chung một bảng màu (`guard.js:26`): áo đỏ gạch `#7a2418`, giáp nâu sẫm `#4a3a2a`, viền vàng `#c9a14a`, vạt đỏ nâu sẫm `#5a2014`, ống chân và giày then. Các lớp chỉ khác nhau ở mũ (mũ tướng hoặc nón lá) và binh khí. Tên cận vệ hiện bằng chữ nổi trên đầu, không thuộc mẫu.

Tài liệu cho mỗi lớp một dáng người riêng (to, gầy, tuổi) để người chơi nhận ra từng người **(đề xuất)**. **Cách ít tệp nhất** nếu muốn tiết kiệm: chỉ làm hai tệp, F1 (mũ tướng, dùng cho Khiên thủ và Đại đao) và F2 (nón lá, dùng cho Giáo thủ, Cung thủ và Song đao).

### F1 · CV_khien · Cận vệ Khiên thủ

"Đao ngắn, khiên lớn. Đứng lâu nhất trong đội" (`guards.js:26`). Mũ tướng. Dáng chắc nịch, ria ngắn **(đề xuất)**.

PROMPT (dán thẳng):
```text
Sturdy Vietnamese Tran dynasty bodyguard, 13th century, about 30, steady face, short moustache. Short gold cylindrical helmet with a tall thin red spike. Brick-red robe, dark brown lamellar armor and shoulder guards, gold trim, leather guard on left forearm, four maroon skirt flaps, black greaves and shoes. A-pose, arms 45° down, open empty hands, fingers slightly apart, feet shoulder-width, facing front, mouth closed. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 4–8k; cao 1,80 m. **Symmetry: tắt** (bao da một bên cẳng tay).
- **Vũ khí**: WPN_dao + WPN_khien_nhat_dv phóng khoảng ×1,2 **(đề xuất; game hiện dùng khiên tròn chung với Đội trưởng Nguyên)**.

### F2 · CV_giao · Cận vệ Giáo thủ

Chiêu Đâm xuyên. Nón lá. Dáng gọn, nhanh **(đề xuất)**.

PROMPT (dán thẳng):
```text
Vietnamese Tran dynasty bodyguard, 13th century, about 25, lean alert beardless face. Wide conical palm-leaf hat over a red headband. Brick-red robe, dark brown lamellar chest armor and shoulder guards with gold trim, four maroon skirt flaps with gold hems, black greaves and shoes. A-pose, arms 45° down, open empty hands, fingers slightly apart, feet shoulder-width, facing front, mouth closed. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 4–8k; cao 1,78 m.
- **Vũ khí**: WPN_giao_dv.

### F3 · CV_cung · Cận vệ Cung thủ

Chiêu Mưa tên, bắn xa 14 m. Nón lá. Game hiện không vẽ ống tên; tài liệu thêm ống tên sau lưng và bao tay da **(đề xuất)**.

PROMPT (dán thẳng):
```text
Vietnamese Tran dynasty bodyguard, 13th century, about 25, calm focused face, thin moustache. Wide conical palm-leaf hat over a red headband. Brick-red robe, dark brown leather chest armor with gold trim, leather bracer on left forearm, quiver on the back, four maroon skirt flaps, black greaves and shoes. A-pose, arms 45° down, open empty hands, fingers slightly apart, feet shoulder-width, facing front, mouth closed. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 4–8k; cao 1,78 m. **Symmetry: tắt** (bao tay một bên, ống tên). Ống tên dính thân.
- **Vũ khí**: WPN_cung_viet (tay trái).

### F4 · CV_songdao · Cận vệ Song đao

"Hai đao nhanh, chém dồn dập, giáp mỏng" (`guards.js:41`). Nón lá. Người gầy, giáp da nhẹ **(đề xuất, theo câu "giáp mỏng")**.

PROMPT (dán thẳng):
```text
Agile Vietnamese Tran dynasty bodyguard, 13th century, about 22, lean wiry build, beardless. Wide conical palm-leaf hat over a red headband. Brick-red robe with sleeves bound at the wrist, light dark-brown leather vest with gold trim, red sash, four short maroon skirt flaps, black greaves and shoes. A-pose, arms 45° down, open empty hands, fingers slightly apart, feet shoulder-width, facing front, mouth closed. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 4–8k; cao 1,75 m.
- **Vũ khí**: WPN_songdao ×2.

### F5 · CV_daidao · Cận vệ Đại đao

Chiêu Phá thế. Mũ tướng. Vai rộng, râu ngắn **(đề xuất)**.

PROMPT (dán thẳng):
```text
Broad-shouldered Vietnamese Tran dynasty bodyguard, 13th century, about 35, strong face, short black beard. Short gold cylindrical helmet with a tall thin red spike. Brick-red robe, dark brown lamellar chest armor and shoulder guards with gold trim, four maroon skirt flaps, black greaves and shoes. A-pose, arms 45° down, open empty hands, fingers slightly apart, feet shoulder-width, facing front, mouth closed. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 4–8k; cao 1,85 m.
- **Vũ khí**: WPN_dadao (khâu vàng), hai tay.

---

## G. Vũ khí

Quy ước gắn vào tay, Claude sẽ tự đặt sau khi nhận tệp:

- **Gốc toạ độ** = chỗ bàn tay chính nắm.
- Thân hoặc cán chạy dọc **+Y**, từ chỗ nắm ra phía mũi.
- Lưỡi quay về **+Z**.
- Kích thước thật, đơn vị mét.
- Vũ khí hai tay có thêm empty `grip2` ở chỗ tay trái nắm.

Công cụ AI không đặt được gốc và trục, nên **bạn chỉ cần đúng hình và tỉ lệ**. Mỗi loại làm **một tệp chi tiết**; Claude tự giảm lưới để làm bản cho lính đám đông. Tua lông ngựa ở giáo và đại đao **không** đưa vào prompt, vì code đã dựng tua có lắc theo (`models.js:274-281`, `soldier-motion.js:502`).

Vũ khí đơn giản (giáo, cung, khiên) Claude cũng dựng được bằng code. GLB chủ yếu để có hình và texture đẹp hơn, nên **ưu tiên làm nhân vật trước**.

### G1 · WPN_songdao · Song đao

Dùng cho H35, người lính Tự do WC03, cận vệ Song đao. Hư cấu (`heroes.js:79`). Chỉ cần một lưỡi; Claude lật gương cho tay kia. Tua lụa đỏ ở chuôi (canon và truyện) do code thêm.

PROMPT (dán thẳng):
```text
One short straight single-edged saber, 13th-century Vietnam, about 1.05 m long. Black cord-wrapped grip, small flat gold crossguard, plain grey steel blade 85 cm long and 8 cm wide with a clipped tip. Vertical, point up, floating, isolated single object, no stand, no hand. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Gốc**: giữa chuôi, cách đuôi chuôi khoảng 9 cm. Lưỡi +Y, sống −Z, cạnh sắc +Z. 1–2k tam giác.

### G2 · WPN_daikiem · Đại kiếm hai tay (Gươm Tiết chế)

Dùng cho H31 và người lính Tự do WC01 (giao diện gọi là "Đại đao"). Hư cấu; canon ghi "bản rộng, chuôi quấn dây đỏ" (`canon.json:2604`).

PROMPT (dán thẳng):
```text
Two-handed straight double-edged greatsword, 13th-century Vietnam, about 1.55 m long. Long grip wrapped in red cord with dark red bands, gold ball pommel, wide gold crossguard with red center, broad grey steel blade with darker central ridge, diamond point. Vertical, point up, floating, isolated single object, no stand, no hand. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Gốc**: sát dưới chắn tay. **grip2**: cách gốc khoảng 0,19 m về phía núm (`models.js:322`). Lưỡi khoảng 1,06 m, bản 12 cm, chuôi khoảng 35 cm. 1–3k.

### G3 · WPN_dadao · Đại đao cán dài

Dùng cho Phó tướng, Tướng Nguyên, Toa Đô, Phàn Tiếp, Ô Mã Nhi và cận vệ Đại đao. Cũng là đạo cụ đặt dưới chân khi tướng Nguyên bị bắt (`units.js:29-39`). Canon xếp tướng Nguyên vào lớp EWC02 "Kích / đại phủ"; game vẽ đại đao. Lưỡi hơi cong **(đề xuất; code vẽ lưỡi hộp thẳng)**.

PROMPT (dán thẳng):
```text
Long pole glaive, 13th-century East Asia, about 2.6 m long. Plain brown wooden shaft, iron butt cap, gold metal collar, broad single-edged grey steel blade about 75 cm long and 26 cm wide, slightly curved edge, straight back. Vertical, blade up, floating, isolated single object, no stand, no hand. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Gốc**: cách đuôi cán khoảng 0,65 m. **grip2** **(đề xuất)**: cách gốc khoảng 0,5 m về phía đuôi cán. Khâu vàng; Phó tướng và Phàn Tiếp dùng khâu xám, Claude đổi màu. 1–3k.

### G4 · WPN_dao · Đao thẳng một tay

Dùng cho Đội trưởng Nguyên và cận vệ Khiên thủ (`models.js:305-307`). Lưỡi thẳng, dài hơn đao lính.

PROMPT (dán thẳng):
```text
One-handed straight single-edged saber, 13th century, about 1.2 m long. Black grip, small flat silver-grey crossguard, plain grey steel blade 1 m long and 9 cm wide, angled clipped tip. Vertical, point up, floating, isolated single object, no stand, no hand. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Gốc**: giữa chuôi. Chắn tay xám cho Đội trưởng; cận vệ dùng vàng, Claude đổi màu. 0,8–1,5k.

### G5 · WPN_dao_linh · Đao lính mũi hếch

Dùng cho lính đám đông của cả hai phe, DV_DAO và NG_DAO (`soldiers.js:37-42`).

PROMPT (dán thẳng):
```text
Simple one-handed military saber, 13th century, about 95 cm long. Black grip, small gold crossguard, narrow grey steel single-edged blade with a slightly upturned tip. Very simple shapes. Vertical, point up, floating, isolated single object, no stand, no hand. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Gốc**: giữa chuôi. 300–800 tam giác (dùng cho đám đông).

### G6 · WPN_giao_dv · Giáo Đại Việt

Dùng cho DV_GIAO, H33 và cận vệ Giáo thủ. Game: lính dài 2,8 m cán + mũi, rig khoảng 3,1 m; gộp làm một tệp 3 m.

PROMPT (dán thẳng):
```text
Long infantry spear, 13th-century Vietnam, about 3 m long. Slim straight brown wooden shaft, black iron butt cap, black binding below the head, four-sided leaf-shaped grey steel spearhead about 30 cm. Vertical, point up, floating, isolated single object, no stand, no hand. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Gốc**: cách đuôi cán khoảng 0,8 m. **grip2** (tuỳ chọn, code hiện cầm một tay): cách gốc 0,5 m về phía đuôi. Tua đỏ do code dựng. 0,5–1,5k.

### G7 · WPN_giao_ng · Thương Nguyên

Dùng cho NG_GIAO (`soldiers.js:216`, cán 2,6 m).

PROMPT (dán thẳng):
```text
Mongol-Yuan spear, 13th century, about 2.8 m long. Slim straight brown wooden shaft, small iron butt spike, black binding, narrow four-sided grey steel spearhead about 28 cm. Vertical, point up, floating, isolated single object, no stand, no hand. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Gốc**: cách đuôi cán 0,8 m. **grip2** (tuỳ chọn, code hiện cầm một tay vì tay trái giữ khiên): cách gốc 0,5 m về phía đuôi. Tua nâu `#5a4632` do code dựng. 300–800.

### G8 · WPN_cung_viet · Cung sừng Đại Việt

Dùng cho H40 (Cung Thánh Dực, canon: "cung sừng lớn bắn tên nặng", Hư cấu), cận vệ Cung thủ, và DV_AOTONG nếu làm. Hơi phản khúc và dài hơn cung Nguyên để hai phe khác nhau **(đề xuất; code vẽ cung thẳng)**.

PROMPT (dán thẳng):
```text
Large Vietnamese horn-and-wood war bow, 13th century, about 1.45 m tall, strung, gentle recurve, dark brown limbs, black lacquered grip wrapped in red cord, cream bowstring. Vertical, floating, isolated single object, no stand, no hand. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Gốc**: giữa chuôi cầm. Hai cánh dọc ±Y, dây về phía −Z (phía người bắn). Dây cung Claude dựng lại bằng code để làm động tác kéo dây. 0,8–2k.

### G9 · WPN_cung_ng · Cung phản khúc Nguyên

Dùng cho NG_CUNG và NG_KY (`soldiers.js:49-56`: cánh ngắn, hai đầu tai gập ngược).

PROMPT (dán thẳng):
```text
Mongol composite recurve bow, 13th century, about 1.3 m tip to tip, strung, short reflexed limbs with stiff black ear tips, brown wood and horn, black leather grip, cream bowstring. Vertical, floating, isolated single object, no stand, no hand. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Gốc**: giữa chuôi cầm. 300–800.

### G10 · WPN_no · Nỏ

Dùng cho DV_NO (`soldiers.js:57-63`). Báng nằm dọc cẳng tay phải.

PROMPT (dán thẳng):
```text
Vietnamese wooden crossbow, 13th century. Straight brown wooden stock 72 cm long, dark brown bow arms 1.1 m wide with slightly swept tips, iron trigger and groove, cream string, no bolt loaded. Floating, isolated single object, no stand, no hand. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Gốc**: chỗ nắm dưới báng, cách đuôi báng khoảng 14 cm. Báng dọc +Y về phía cánh nỏ; rãnh tên quay +Z. 0,5–1,2k.
- **Lưu ý**: canon có nỏ binh quân Trần (`canon.json:3390, 5208, 5300`); riêng lớp vũ khí tướng WC08 (nỏ) được để dành cho Âu Lạc (`canon.json:3398`). Hình dáng nỏ DV_NO là Hư cấu.

### G11 · WPN_chuy · Chùy gai

Dùng cho NG_TANK (`soldiers.js:64-73`). Code cầm một tay.

PROMPT (dán thẳng):
```text
Heavy spiked war mace, 13th-century Mongol-Yuan, about 1.7 m long. Thick brown wooden shaft, black iron butt knob, black iron cylindrical head with six iron spikes around it and one on top. Vertical, head up, floating, isolated single object, no stand, no hand. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Gốc**: cách đuôi cán khoảng 0,25 m. grip2 không cần; nếu muốn cầm hai tay thì đặt cách gốc 0,3 m về phía đầu chùy **(đề xuất)**. 0,5–1,5k.

### G12 · WPN_khien_tron_ng · Khiên tròn Nguyên

Dùng cho NG_DAO, NG_GIAO (thu nhỏ ×0,72) và Đội trưởng Nguyên. Khiên tròn là dấu hình dáng của phe Nguyên (`models.js:3-5`).

PROMPT (dán thẳng):
```text
Round Mongol-Yuan shield, 13th century, 74 cm diameter, slightly domed, brown leather-covered wooden face, black rim, round iron boss in the center, arm strap and grip on the back. Front view, floating, isolated single object, no stand, no hand. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Gốc**: giữa quai đeo cẳng tay ở mặt sau. Mặt khiên quay +Z. 300–1000.

### G13 · WPN_khien_nhat_dv · Khiên nhật quân Trần

Dùng cho DV_DAO (`soldiers.js:82-87`), và đề xuất cho cận vệ Khiên thủ (phóng ×1,2). Truyện tranh vẽ khiên mây tròn; nếu muốn làm theo truyện thì thay câu đầu bằng `Round woven rattan shield, 13th-century Vietnam, 70 cm diameter, dark red lacquered center boss.`

PROMPT (dán thẳng):
```text
Rectangular Vietnamese infantry shield, 13th century, 50 cm wide and 75 cm tall, dark red lacquered wood, black horizontal bands at top and bottom edges, round gold boss in the center, arm strap and grip on the back. Front view, floating, isolated single object, no stand, no hand. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Gốc**: giữa quai cẳng tay. Mặt khiên +Z. 300–1000.

### G14 · WPN_daiphu · Đại phủ cán dài (tuỳ chọn)

Cho Toa Đô nếu muốn đúng truyện ("long-hafted great axe", `bible.json:64`) và lớp EWC02 của canon. Game hiện dùng đại đao.

PROMPT (dán thẳng):
```text
Long-hafted great axe, 13th-century Mongol-Yuan, about 2.2 m long, brown wooden haft with iron bands, broad crescent single-bladed grey steel head with a back spike, iron butt cap. Vertical, head up, floating, isolated single object, no stand, no hand. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Gốc**: cách đuôi cán khoảng 0,6 m; **grip2** cách gốc 0,45 m về phía đuôi **(đề xuất)**. Lưỡi rìu +Z. 1–3k.

### G15 · WPN_quat · Quạt Chiêu Văn (tuỳ chọn)

Vũ khí riêng của H33 theo canon (lớp WC12 Quạt & bút; Hư cấu). Game chưa dùng. Canon ghi mặt quạt viết chữ các thứ tiếng, còn truyện vẽ quạt trơn; prompt để trơn (chữ, nếu có, do code vẽ). Kích thước là **(đề xuất)**.

PROMPT (dán thẳng):
```text
Large folding fan, 13th-century Vietnam, split bamboo ribs and plain ivory paper, about 45 cm long, shown half open, dark lacquered outer guards with a gold rivet, no writing or pictures. Floating, isolated single object, no stand, no hand. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Gốc**: đầu đinh tán (chỗ cầm), nan quạt dọc +Y. 1–2k.

### G16 · WPN_daikiem_vandon · Đại kiếm Vân Đồn (tuỳ chọn)

Của H34 Trần Khánh Dư (Hư cấu, `canon.json:2848`): lưỡi dày, sống kiếm bọc sắt, chuôi quấn dây gai ám bụi than. Kích thước là **(đề xuất)**.

PROMPT (dán thẳng):
```text
Heavy two-handed greatsword, 13th-century Vietnam, about 1.6 m long, thick dark steel single-edged blade with an iron-clad spine, plain square iron crossguard, long grip wrapped in rough hemp cord stained with charcoal dust. Vertical, point up, floating, isolated single object, no stand, no hand. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Gốc**: sát dưới chắn tay; **grip2** cách gốc 0,2 m về phía núm. 1–3k.

### G17 · WPN_doandao · Đoản đao Yết Kiêu (tuỳ chọn)

Tương truyền (`canon.json:3176`). Kích thước là **(đề xuất)**.

PROMPT (dán thẳng):
```text
Short Vietnamese knife-saber, 13th century, about 50 cm long, straight single-edged grey steel blade, wooden grip wrapped in dark cord, tiny iron guard. Vertical, point up, floating, isolated single object, no stand, no hand. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Gốc**: giữa chuôi. 0,5–1,5k.

### G18 · WPN_duisat · Dùi sắt đục thuyền (tuỳ chọn)

Tương truyền (`canon.json:3176`). Kích thước là **(đề xuất)**.

PROMPT (dán thẳng):
```text
Iron boat-breaking chisel, 13th century, about 35 cm long, thick square iron shaft tapering to a flat chisel edge, round flat striking head, cord loop at the top. Vertical, chisel edge up, floating, isolated single object, no stand, no hand. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Gốc**: giữa thân, mũi đục +Y. 300–1000.

### G19 · WPN_moc_voi · Móc voi (tuỳ chọn)

Của Dã Tượng (H39) theo canon: điều khiển voi bằng móc. Tương truyền. Kích thước là **(đề xuất)**.

PROMPT (dán thẳng):
```text
Elephant goad, 13th-century Vietnam, about 70 cm long, dark wooden handle wrapped in red cord, bronze head with one straight spike and one curved hook. Vertical, spike up, floating, isolated single object, no stand, no hand. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Gốc**: giữa cán, mũi nhọn +Y, móc cong quay +Z. 300–1000.

---

## H. Đạo cụ

**Khuyên**: áo choàng và vải cờ nên để Claude dựng bằng code. Game đã có lưới vải chia khúc kèm mô phỏng lắc (`models.js:86-124, 325-363`); công cụ AI thường sinh vải dày và méo. Prompt bên dưới chỉ dùng khi bạn muốn có hình và texture vải đẹp hơn. Tua ở giáo và đại đao, và hai dải khăn của H35, Claude cũng dựng bằng code, không cần tệp.

### H1 · PROP_co_lung · Cờ lưng (cán + vải trơn)

Một tệp dùng chung cho ba người. Cờ sáu chữ 破強敵報皇恩 của H35: chữ là Chính sử, màu đỏ chữ vàng là Hư cấu (`suquan-b15.js:99-105`). Cờ 烏馬兒 của X20 và cờ 樊 của X24 là Hư cấu. Vải để **trơn, không chữ**; code vẽ chữ và đổi màu nền (`flagTexture`, `models.js:463`). Game vẽ cán sơn then (truyện vẽ cán tre). Núm vàng trên đỉnh là **(đề xuất)**.

PROMPT (dán thẳng):
```text
Tall back banner: slim straight black lacquered pole about 2 m long with a small gold finial, plain dark red rectangular silk flag 50 cm wide and 1.2 m tall hanging from the upper pole, thin pale gold border, completely blank. Floating, isolated single object, no stand, no person. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 0,5–1,5k. Cán và vải là hai object riêng nếu tách được. Gốc ở chân cán; cán gắn sau lưng (`models.js:338-352`).

### H2 · PROP_cape · Áo choàng dùng chung

Một tệp, Claude nhuộm màu và co giãn theo từng người: H31 son (hẹp, ngắn), H33 son, H40 son sẫm, Toa Đô và Tướng Nguyên `#4a2f2a`, Phó tướng `#3b4a5a`, X20 `#6a2420`, X24 `#27324a`, người lính bậc Tướng son (hẹp, ngắn). Vì thế prompt dùng **màu xám nhạt trơn** để nhuộm được mọi màu **(đề xuất)**.

PROMPT (dán thẳng):
```text
Short military cloak hanging straight down as if from the shoulders, about 90 cm long, 45 cm wide at the top flaring to 56 cm, plain light grey cloth, thin darker hem band, simple folds, no clasp. Back view, floating, isolated single object, no body, no mannequin. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 0,5–2k. Gốc ở mép trên giữa (chỗ gắn lưng). Claude chia ba khúc xương để mô phỏng vải như hiện nay.

### H3 · PROP_mui_ten · Mũi tên

Dùng cho tên bay, tên cắm trên lũy và xác ngựa (`scenery.js:374-378`), và Mũi tên thư (Kế Sách B15, Claude buộc thêm tờ thư bằng code).

PROMPT (dán thẳng):
```text
Single arrow, 13th century, about 85 cm long, thin straight brown wooden shaft, small iron leaf-shaped head, three cream feathers. Straight, floating, isolated single object, no hand. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 100–300. Gốc ở đuôi tên, mũi +Y.
- **Lưu ý**: thư trên Mũi tên thư diễn đạt trung tính, không dùng tên gọi miệt thị (canon B15).

### H4 · PROP_ong_ten · Ống tên rời (tuỳ chọn)

Ống tên của nhân vật đã dính thân. Tệp rời này dùng cho cảnh (ống tên rơi cạnh xác ngựa, `scenery.js:422-430`) hoặc nếu bạn muốn gắn ống tên riêng.

PROMPT (dán thẳng):
```text
Cylindrical arrow quiver, 13th-century Mongol style, about 55 cm long, brown leather, cream rim at the mouth, five arrows with cream feathers sticking out, shoulder strap. Floating, isolated single object, no stand, no person. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 300–1000. **Symmetry: tắt** (năm mũi tên lệch, dây đeo một bên).

### H5 · PROP_non_la · Nón lá rời

Nón lá của người lính Tự do ở bậc Lính và Tinh nhuệ (`soldier.js:30`) và ba lớp cận vệ Giáo thủ, Cung thủ, Song đao (`guards.js:29`, `guards.js:34`, `guards.js:39`). Code dựng nón chóp thấp vành rộng: Ø 0,84 m, cao 0,22 m, màu nón lá `#cdb98a`, vòng khăn son dưới nón (`models.js:223-224`). Khi thân là lưới GLB thì khối đầu dựng bằng code bị bỏ (`addBody` không làm gì, `models.js:181`), nên các vai này đang mất nón; các mẫu Meshy đã tạo cho họ cũng không ra nón. Tệp rời này để gắn vào khớp đầu và gộp vào bộ lính khi nướng; dân làng nam (J1, thu nhỏ khoảng ×0,8) và bốn mục làm lại đầu trần ở mục P (LINH_r01_v2, CV_giao_v2, CV_cung_v2, CV_songdao_v2) cũng đội tệp này. Cần sửa code đi kèm: `models.js` gắn nón vào `p.head` khi `cfg.hat === "non"` kể cả khi có thân GLB, `design/tools/bake/kit.mjs` gộp nón vào bộ lính. Vành 84 cm là cỡ game vẽ cho dễ nhìn (Hư cấu).

PROMPT (dán thẳng):
```text
Vietnamese conical palm-leaf hat (non la), 84 cm wide and 22 cm tall: a wide shallow cone of pale palm-leaf color with fine concentric ribs, thin bamboo rings visible inside, a small vermilion cloth headband ring inside the crown. Floating, isolated single object, no head, no stand. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 300–600. Gốc ở giữa vòng đội đầu, chóp nón +Y. **Symmetry: bật.**

---

## I. Ngựa và voi

Ngựa và voi đứng thẳng bốn chân ở tư thế trung tính. Yên cương dính liền (object riêng nếu tách được). Người cưỡi là nhân vật A-pose riêng (NG_KY); Claude dựng tư thế ngồi bằng rig. Dùng NEGATIVE-NV và thêm `, rider, person`.

### I1 · MOUNT_ngua_nguyen · Ngựa cung kỵ Nguyên

Ngựa sống duy nhất trong game (`soldiers.js:255-297`). Có ở B15, Tự do và Võ trường. Trong code: lông nâu `#6a4e36`; đầu, bờm, cẳng chân và đuôi nâu đen `#2a211b`; móng then; yên và chăn yên chàm `#2c3a4a`, vạt chăn hai bên sườn viền lông `#5a4632`. Code chưa có cương và bàn đạp; tài liệu thêm cả hai **(đề xuất)**. Dáng ngựa thảo nguyên thấp và chắc **(đề xuất)**.

PROMPT (dán thẳng):
```text
Small sturdy Mongolian steppe horse, standing square on four legs in a neutral pose, head forward, bay-brown coat, dark brown mane, lower legs and tail, black hooves. Low wooden saddle on a dark indigo saddle blanket, side flaps edged with brown fur, simple black bridle, iron stirrups. No rider. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 4–8k; lưng cao khoảng 1,4 m, đỉnh đầu khoảng 1,9 m, dài khoảng 2,0 m chưa tính đuôi. Mặt ngựa hướng +Z, gốc giữa bốn chân. Đuôi và vạt chăn yên có lắc, Claude tách bằng xương.

### I2 · MOUNT_ngua_tuong · Ngựa tướng (tuỳ chọn)

Game chưa có tướng cưỡi ngựa, nhưng `systems.md` (dòng 80, 179, 204, 241) có thiết kế ngựa cho tướng; truyện vẽ Toa Đô cưỡi ngựa đen (B15 O4). Yên đỏ viền vàng giống yên quân Trần trong cảnh (`scenery.js:801-803`); Claude đổi màu vải yên theo phe **(đề xuất)**.

PROMPT (dán thẳng):
```text
Tall strong war horse, standing square on four legs in a neutral pose, head forward, glossy black coat, long black mane and tail. High wooden saddle on a dark red saddle cloth with gold edging, black leather bridle and reins with small gold fittings, iron stirrups. No rider. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 8–15k; lưng khoảng 1,5 m.

### I3 · MOUNT_voi_chien · Voi chiến (thân trơn)

Game hiện chưa có voi; làm sẵn cho lớp vũ khí WC16 Voi chiến (`systems.md:294`: chiến đấu trên voi, không xuống, giẫm và húc) và cho Dã Tượng (H39). Voi châu Á, voi đực trưởng thành, **ngà bọc đồng** theo canon "Voi Rừng". Thân để **trơn**: không bành, không vải phủ, không người cưỡi; bành và giáp đầu là hai tệp riêng ngay dưới, để sau này đổi bành cho voi của tướng khác (canon có voi trắng một ngà, bành chạm hoa sen của Bà Triệu, thời khác). Kích thước **(đề xuất)**.

PROMPT (dán thẳng):
```text
Large Asian elephant, adult bull, standing square on four legs in a neutral pose, trunk hanging straight down, ears relaxed against the head, medium tusks with bronze caps, wrinkled dark grey skin, thin tail hanging down. Bare back, no howdah, no blanket, no rider. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 10–20k; cao khoảng 2,7 m tới vai, dài thân khoảng 5 m chưa tính vòi và đuôi. Mặt voi hướng +Z, gốc giữa bốn chân, mặt đất y = 0. **Symmetry: bật.** Claude chia vòi thành nhiều đốt xương, thêm xương tai và đuôi để có lắc.
- **Negative**: NEGATIVE-NV thêm `, rider, person, howdah, saddle`.
- **Đi kèm**: PROP_banh_voi, PROP_giap_voi (tuỳ chọn). **Người cưỡi**: H39 hoặc nhân vật khác, ngồi trên bành hay trên cổ, Claude dựng tư thế.

### I4 · PROP_banh_voi · Bành voi và vải phủ

Bành gỗ đặt trên lưng voi (canon "Voi Rừng": "voi chiến đeo bành gỗ"). Sàn thấp có lan can, vải phủ son viền vàng rủ hai bên sườn **(đề xuất, theo bảng màu quân Trần)**.

PROMPT (dán thẳng):
```text
Elephant howdah: low square wooden platform about 1.4 m wide with a short black lacquered railing and gold corner caps, on a vermilion saddle cloth with gold border hanging down both sides, girth ropes. Isolated single object, no elephant, no person. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 1–3k. Gốc ở giữa đáy (chỗ đặt lên lưng voi). Sàn gỗ và vải phủ là hai object riêng nếu tách được; vải phủ Claude có thể cho lắc nhẹ.
- **Negative**: NEGATIVE-VK.

### I5 · PROP_giap_voi · Giáp đầu voi (tuỳ chọn)

Tấm giáp che trán voi, sơn then viền vàng, chùm tua đỏ trên đỉnh **(đề xuất; canon không tả)**.

PROMPT (dán thẳng):
```text
Elephant head armor: curved black lacquered lamellar plate covering the forehead down to the top of the trunk, gold trim, red tassel on top, leather straps. Isolated single object, no elephant, no person. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 0,5–1,5k. Gốc ở mép trên giữa (chỗ gắn đỉnh đầu voi). Tua đỏ Claude dựng bằng code.
- **Negative**: NEGATIVE-VK.

---

## J. Dân làng (tuỳ chọn)

Chỉ có ở B15, là cảnh nền dân chạy loạn (`ambient.js`). Dân không bị đánh trúng, địch không nhìn thấy (`ambient.js:979-980`). "Vườn không nhà trống" năm 1285 là Chính sử; từng người dân là Hư cấu. Chiều cao là **(đề xuất)**. Cụ già chống gậy dùng chung thân DAN_NAM (code làm còng lưng); em bé được bế dùng DAN_TRE thu nhỏ. Trẻ chăn trâu thổi sáo là một khối ngồi riêng trong code (`ambient.js:190-205`), không phải thân DAN_TRE: giữ code, sau này nướng tư thế ngồi từ DAN_TRE (lý do ở đầu mục O). Con trâu là mục O1.

### J1 · DAN_NAM · Dân làng nam

Gánh quang gánh. Màu theo `soldiers.js:394-437`: áo nâu củ nâu `#5e4330`, thắt lưng `#8a7550`, quần thâm `#2b2825`, nón lá `#d8c48e`. Tạo **đầu trần** (búi tóc, khăn vấn): Meshy chưa dựng được nón lá vành rộng lần nào (mục P), nên nón lấy từ PROP_non_la (mục H5) thu nhỏ khoảng ×0,8, nhuộm `#d8c48e`, gộp vào bộ lính khi nướng (nón code Ø 0,68 m, cao 0,18 m, `soldiers.js:487`).

PROMPT (dán thẳng):
```text
Vietnamese peasant man, 13th century, about 40, lean, plain face, black hair bun at the nape under a dark headcloth. Brown hip-length tunic with sleeves rolled past the elbows, khaki sash, black trousers rolled to mid-calf, barefoot. A-pose, straight arms 45° down, elbows straight, relaxed open hands, fingers together, feet shoulder-width, facing front, mouth closed. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 1,5–3k; cao 1,65 m. **Symmetry: bật.** **Đi kèm**: PROP_quang_ganh, PROP_non_la. Gậy tre của cụ già Claude dựng bằng code.

### J2 · DAN_NU · Dân làng nữ

Đội tay nải, ôm tay nải hoặc bế con. Áo nâu `#684832` tay dài, váy đen `#221f1c` hai tấm, khăn vấn `#2e2622`, không đội nón.

PROMPT (dán thẳng):
```text
Vietnamese peasant woman, 13th century, about 30, gentle tired face, hair wrapped in a dark cloth turban. Long-sleeved brown tunic, khaki sash, black two-panel skirt to mid-calf with dark hem, barefoot. A-pose, straight arms 45° down, elbows straight, relaxed open hands, fingers together, feet shoulder-width, facing front, mouth closed. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 1,5–3k; cao 1,55 m. **Symmetry: bật.** Váy hai tấm có lắc như vạt áo lính. **Đi kèm**: PROP_tay_nai.

### J3 · DAN_TRE · Trẻ con làng

Đi bộ cạnh mẹ hoặc được bế. Chỏm tóc trái đào, áo nâu `#6f5238` cộc tay, quần cộc `#2b2825`.

PROMPT (dán thẳng):
```text
Vietnamese village child, 13th century, about 7, natural child proportions, small tuft of black hair at the front of a shaved head, brown short-sleeved tunic, black shorts, barefoot. A-pose, straight arms 45° down, elbows straight, relaxed open hands, fingers together, feet shoulder-width, facing front, mouth closed. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 1–2k; cao 1,15 m. **Symmetry: bật.** **Đi kèm**: PROP_tay_nai thu nhỏ (bọc nhỏ xách tay).

### J4 · PROP_quang_ganh · Đòn gánh và hai thúng

Theo `soldiers.js:405-415, 459`: đòn tre `#b19a5c`, thúng `#8c7a52`; thúng trước đựng gạo và nồi đất, thúng sau đựng bọc vải chàm và chiếu cuộn.

PROMPT (dán thẳng):
```text
Vietnamese carrying set: 1.7 m bamboo shoulder pole with two round woven bamboo baskets hanging from four ropes each; one basket holds rice and a clay pot, the other an indigo cloth bundle and a rolled straw mat. Isolated single object, no person. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 1–2k. **Symmetry: tắt** (hai thúng đựng khác nhau). Gốc ở giữa đòn (chỗ tì vai). Hai thúng có thể tách để lắc theo bước chân.

### J5 · PROP_tay_nai · Tay nải

Bọc vải chàm `#3d4a5e`, nút buộc `#55627a` có hai tai (`soldiers.js:460-461`).

PROMPT (dán thẳng):
```text
Indigo cloth bundle, about 36 cm wide, soft folds, tied with a knot on top showing two small ears. Isolated single object, no hand. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 300–500. **Symmetry: bật.** Gốc ở giữa đáy bọc.

---

## K. Thuyền (môi trường)

**Quy ước chung cho mục K–O** (môi trường và thú, từ đợt 19):

- **Mã, tệp, bảng.** Mã `ENV_…` đi với tệp `env_….glb` trong `design/glb/moi-truong/` (mục 0.5); trâu giữ tiền tố `mount_` (thư mục `thu-cuoi/`). Mỗi mục có bảng riêng ngay dưới đầu mục, cùng 8 cột như bảng mục 1: cột 7 là kích thước thật, cột 8 là khối code mà tệp thay. Liệt kê bằng `node design/tools/meshy.mjs list --set moi-truong` (86 mục, thêm `--prompt` để in bản gửi API); ba mục ghi tuỳ chọn ở đầu mục (K10, L22, N17) nằm ở `--set tuy-chon`, thú và nón lá ở `--set thieu`. Thứ tự mua theo mục 0.8: lượt 2 dựng lưới 9 mục thử bằng `--model-mt meshy-5`, soát, tô, đưa vào được game rồi mới mua phần còn lại ở lượt 4; mỗi lượt dựng lưới (`--stage luoi`, chỉ tốn tiền lưới) và soát ảnh trước khi tô. Giá riêng phần môi trường theo bảng trong `meshy.mjs` (89 mục, kể cả ba mục tuỳ chọn): 89 × 30 = 2.670 credit nếu mọi mục bằng `latest`, 89 × 15 = 1.335 nếu mọi mục bằng `--model-mt meshy-5` (meshy-5 từng dựng nỏ thành súng, xem FIX `WPN_no`, nên soát ảnh lưới kỹ). Số 2.670 ở cuối bảng lượt của mục 0.8 là cả sáu lượt theo lựa chọn in đậm, trùng số chỉ là tình cờ.
- **Độ dài.** Prompt môi trường dài tới 630 ký tự: công cụ rút khối STYLE bớt 30 ký tự nên bản gửi API không quá 600 (giới hạn của Meshy). Dán tay vào web Meshy thì dán bản API in bởi `list --only <mã> --prompt`.
- **Kích thước.** Số mét trong prompt chỉ giúp công cụ giữ đúng tỉ lệ, nên prompt phải ghi đủ những tỉ lệ mà code cần (boong, mạn, cột của thuyền). Meshy chuẩn hoá mọi mẫu về khoảng 1,9 đơn vị theo trục dài nhất (`size_xyz` trong `design/glb/manifest.json`: nhân vật, khiên, mũi tên, ngựa đều ra 1,89–1,90), nên bước nướng môi trường sau này phải phóng về đúng cột "Kích thước thật" của bảng, như `WEAPONS.len` của vũ khí (`design/tools/bake/catalog.mjs:30-45`).
- **Gốc toạ độ.** Công cụ luôn đặt gốc giữa đáy (`center({ pivot: "below" })` trong `post()` của `meshy.mjs`). Bước nướng đặt lại gốc cho vật cần gốc khác: thuyền ở đường mớn nước giữa thân, mũi +Z (`boats.js:5`); khúc gỗ phao ở tâm; cọc Bạch Đằng, cọc gãy và đá tảng về khối đơn vị của code (mục M1, N10). Cột đá vôi: chân thấy được của mẫu ở y 0 (vòng −0,1 của `karstGeo`), rồi bước nướng đùn thêm một váy thẳng xuống y −1,2 lần bán kính chân như code (`kit.js:127`), vì instance đặt ở mặt đất thấp nhất − 0,6 m trên bờ dốc (`scenery-b20.js:339`); đừng đặt đáy mẫu ở −1,2 lần bán kính, như vậy là chôn mất khoảng một phần ba cột. Đảo đá C thì hàm ếch nằm ngang mặt nước (N16).
- **Chưa có bước nướng môi trường.** Game không đọc GLB khi chạy: mọi mẫu được nướng sang `.hkm` + WebP, và `design/tools/glb-bake.mjs` mới biết nhân vật, bộ lính, vũ khí (`char`, `kit`, `wpn`). Môi trường cần thêm chế độ `env`: giảm lưới, đổi đơn vị, đặt gốc, và nên nướng texture thành màu đỉnh để gộp vào đúng InstancedMesh hay lưới gộp đang có (không thêm lượt vẽ, khớp kiểu sơn mài màu phẳng). Chỉ vật camera tới gần 3–10 m mới nên giữ texture: thuyền người chơi đứng, cổng Hàm Tử, kỳ hạm, nhà bạt, khán đài.
- **Tam giác.** Cột "Tam giác" là số gửi Meshy (thấp nhất 300; dựng thô hơn thì Meshy hỏng hình), không phải số trong game. Trong game, vật vẽ nhiều lần (InstancedMesh: cây, tre, lau, đá, cọc, cột đá vôi, bè, khúc gỗ phao, phao mốc), mô-đun lặp dọc tường, vòng rào, làn đánh (L3, L4, M5–M8, M10) và vật gộp vào lưới tĩnh `b20-statics` của B20 giữ **đúng số tam giác code hiện nay** mỗi bản (`trong game ≤ …` ở phần Kỹ thuật từng mục, đếm trên bản gốc). Chỉ được cao hơn khi làm kèm mức chi tiết gần, xa (LOD) như bộ vẽ hạm đội (`boats.js`: LOD0 gần, LOD1 xa, `TRI_BUDGET` ở `boats.js:99`): bản xa không quá số code, bản gần chỉ cho số ít bản quanh camera, và phần tăng phải bù ở chỗ khác. Giảm tới số ấy mà hỏng dáng thì giữ code cho vật ấy. Đếm tổng cảnh bằng `design/tools/scene-tris.mjs` (kịch bản của `game/tools/shot.mjs`, đếm cả vật đang ẩn) trước và sau mỗi lượt đưa mẫu vào game (mục 0.8, lượt 2 và 4):
  - **B20** nay 120.730 tam giác trên hợp đồng ≤ ~120 nghìn (`scenery-b20.js:13`), nên sau khi thay vẫn không quá 120 nghìn. Trong đó `b20-statics` 8.553 (bến, tháp canh, bản doanh, tời neo; số từng vật ghi ở mục của nó): các vật gộp vào đó cộng lại không quá 8.553, thêm tối đa 1.500 nếu bớt được chừng ấy ở chỗ khác.
  - **B15** (lưới của `buildWorld`, kể cả mặt đất, nay 472.254; cả khung có lính đo headless 688.827, trong khi trần toàn cảnh là 200 nghìn ở T1, 300 nghìn ở T2, riêng địa hình và đạo cụ khoảng 50–60 nghìn, `design/systems.md:1125`, `design/systems.md:1160`) không được tăng: mẫu đơn lẻ nhìn gần (cổng, cây đa, tháp, lều, nhà) muốn nhiều tam giác hơn code thì phải có LOD hoặc bớt ở chỗ khác.
  - **Võ trường** nay 57.000: cây và rào giữ số code; khán đài, đài chỉ huy, lầu trống là vật đơn lẻ nhìn gần.
- **Texture** 1024 cho mọi mục môi trường (công cụ chưa có cỡ riêng từng mục).
- **Không người, không nước, không đất**, trừ vật vốn là một khối địa hình (gò đá, chân cột đá vôi). **Không chữ**: lá cờ, chữ trên cờ, chữ bia vẫn do code vẽ (`flagBatch` ở `kit.js:266`, `flagTexture` ở `models.js:463`, CanvasTexture của bia ở `scenery.js:995-1001`), prompt chỉ xin cán cờ trần. API v2 bỏ qua ô Negative nên mọi ý chặn đã nằm sẵn trong prompt; khối NEGATIVE-MT (mục 2.3) chỉ dùng khi dán tay vào công cụ có ô Negative.
- **Màu** theo bảng 2.5 (phần môi trường ở cuối bảng).
- **Sử liệu.** Hình dáng thuyền, công trình, đạo cụ là Hư cấu dựa trên cảnh game đang dựng (đầu tệp `boats.js`, `scenery.js`, `scenery-b20.js`), trừ chỗ ghi Chính sử (bãi cọc Bạch Đằng, `scenery-b20.js:6-8`). Game có B15 Hàm Tử, B20 Bạch Đằng, Võ trường; Thăng Long, Vạn Kiếp, Chương Dương chưa có cảnh (`game/js/data/battles.js`), nên chưa cần mẫu riêng cho các trận đó.

Thuyền K1–K5 thay hình gần (LOD0) của từng loại thuyền B20. Code giữ hình LOD1, hình thay thế ở xa, mặt đi được, tường, cửa lên xuống (`HULLS`, `boats.js:33-97`, `deck.js`), và lá cờ (`flagAt`, vẽ riêng). **Cán cờ cũng do code giữ**: que cán cờ nằm trong hình thân của `BUILD` (`boats.js:392`, `boats.js:436`, `boats.js:482`, `boats.js:497`, `boats.js:511`) mà GLB thay, nên bước nướng tách riêng que đó, giữ làm một phần code đặt cạnh LOD0 của GLB, đúng chân của `flagAt`; vì thế prompt K1–K5 ghi `No flagpole.` (cán Meshy tự đặt sẽ lệch `flagAt`, lá cờ treo lơ lửng, hoặc thuyền có hai cán). Thuyền Tống K6 thì lá cờ treo trên chính cột buồm của mẫu. Mẫu phải khớp boong và tường của `HULLS` vì lính đứng và đánh trên boong: prompt ghi chiều cao boong, mạn, lầu và cột theo code (`HULLS.deckY`, `SPECS`, `boats.js:188-220`; cột ở `BUILD`), vì Meshy chỉ giữ tỉ lệ. Sau `--stage luoi`, đo trên lưới: chiều cao boong chia chiều dài so với `deckY / len` (chiến thuyền 2,6 / 24 = 0,108; đỉnh cột chính (2,6 + 14,5) / 24 = 0,71), vị trí z của cột so với tường cột `mastW` của boong, và chiều dài lầu sau chia chiều dài thân: chiến thuyền khoảng 0,26 (mặt trước lầu ở z −6,2, tường lầu x ±3,3, z −12,5…−6,2, nóc 5,2; `boats.js:38`), kỳ hạm khoảng 0,33 (mặt trước ở z −6,05, mặt lầu đi được z −15,5…−6,05 ở cao 6,0; `boats.js:49`, `boats.js:54`). Lầu của mẫu dài hơn thì lính đứng boong từ z −6,0 sẽ đứng trong lầu. Lệch quá khoảng 10% thì sửa câu, dựng lại lưới trước khi tô. Bộ vẽ hạm đội dùng một vật liệu đã vá shader nhìn xuyên (`boats.js:761-793`): vật liệu có texture của LOD0 phải vá cùng cách, không thì thân và buồm hết mờ khi chắn camera.

| # | Mã | Tệp | Tên | Nhóm | Tam giác | Kích thước thật (nướng về số này) | Thay cho (code) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 64 | ENV_chien_thuyen_nguyen | `env_chien-thuyen-nguyen.glb` | Chiến thuyền Nguyên (ba cột buồm) | K | 2–3k | 24 × 7 m, boong 2,6 m, mạn 0,9 m, lầu sau dài 0,26 thân, nóc 5,2 m; cột 14,5 / 10 m trên boong, 6,5 m trên nóc lầu | `BUILD.junk`, LOD0 |
| 65 | ENV_ky_ham_nguyen | `env_ky-ham-nguyen.glb` | Kỳ hạm Ô Mã Nhi | K | 6–8k | 36 × 9 m, boong 3 m, lầu sau dài 0,33 thân, nóc lầu 6 m, mái đình 11 m; cột 19 / 13 m trên boong | `BUILD.flagship`, LOD0 |
| 66 | ENV_thuyen_ho_ve | `env_thuyen-ho-ve.glb` | Thuyền hộ vệ Nguyên | K | 1,5–2,5k | 16 × 4,5 m, boong 1,8 m, nóc lầu 3,3 m, cột 10 m | `BUILD.escort`, LOD0 |
| 67 | ENV_thuyen_do_luong | `env_thuyen-do-luong.glb` | Thuyền dò luồng Nguyên | K | 0,8–1,2k | 9 × 2,2 m, boong 0,8 m, cột 5,4 m | `BUILD.scout`, LOD0 |
| 68 | ENV_thuyen_chien_tran | `env_thuyen-chien-tran.glb` | Thuyền chiến nhẹ quân Trần | K | 2–3k | 12 × 2,6 m, boong 0,7 m | `BUILD.light`, LOD0 (cả "lead" ×1,35) |
| 69 | ENV_thuyen_tong | `env_thuyen-tong.glb` | Thuyền quân Tống (Triệu Trung) | K | 1–2k | 9 × 2,8 m, cột 6 m ở z +0,8 | khối hộp `kesach.js` |
| 70 | ENV_thuyen_song_nguyen | `env_thuyen-song-nguyen.glb` | Thuyền chiến Nguyên trên sông Hồng (B15) | K | 1–2k | 11 × 3,4 m, cột 8 m | 7 lưới riêng `world.js` |
| 71 | ENV_thuyen_mui | `env_thuyen-mui.glb` | Thuyền nan mui ở bến | K | 0,5–1k | 4,2 × 1,2 m | `skiffGeo`, 8 lưới riêng |
| 72 | ENV_thung_cau | `env_thung-cau.glb` | Thúng câu | K | 300–800 | Ø 1,8 m, sâu 0,5 m | trụ 8 cạnh `scenery.js`, `scenery-b20.js` |
| 73 | ENV_long_thuyen | `env_long-thuyen.glb` | Long thuyền nhà Trần (tuỳ chọn) | K | 3–5k | dài 20 m | chưa có trong game |

### K1 · ENV_chien_thuyen_nguyen · Chiến thuyền Nguyên (ba cột buồm)

Dùng ở B20: 16 chiến thuyền của hạm đội, cộng thuyền chỉ huy PT của Phàn Tiếp cũng là thân junk (`battle-b20.js:71`, `battle-b20.js:260`). Thay `BUILD.junk` (`boats.js:362-393`). Boong và tường code giữ (`HULLS.junk`, `boats.js:34-42`): mặt đi x ±2,8, z −6…10 ở cao 2,6; khối lầu lái x ±3,3, z −12,5…−6,2, nóc 5,2; cán cờ chữ ở `flagAt` [−2,3; 11,4; −11,2]. Kích thước: dài 24 m, rộng 7 m, boong 2,6 m trên mớn nước, mạn cao 0,9 m trên boong (`SPECS.junk`, `boats.js:189-194`), mớn 1,4 m. Ba cột (`boats.js:385-390`): cột chính ở z +1 cao 14,5 m trên boong, cột mũi chúi ra trước ở z +7,8 cao 10 m, cột lái nhỏ lệch mạn trên nóc lầu (x 0,9; z −10) cao 6,5 m. Buồm cánh dơi có nẹp tre màu chàm nhạt `#5b77a3`/`#516c97`, khiên tròn chàm treo mạn, mắt thuyền, tời và neo gỗ ở mũi, bánh lái lớn. Kiểu thuyền buồm Nam Tống – Nguyên thế kỷ 13 mà hạm đội Ô Mã Nhi dùng năm 1288; chi tiết là Hư cấu (`boats.js:7-9`). Prompt ảnh ở `design/3d-ref/PROMPTS-MOI-TRUONG.md` ghi hai cột là lệch với game. Lầu lái chiếm khoảng một phần tư thân phía đuôi (z −12,5…−6,2 trên thân 24 m) nên prompt ghi `over the aft quarter` và nóc 5,2 m, kèm chiều cao ba cột. Để đủ chỗ trong 600 ký tự, prompt bỏ cửa và cửa sổ lầu, đuôi phẳng, bánh lái, tời, neo, mắt thuyền; mắt thuyền code vẽ thêm lên LOD0 được nếu cần.

PROMPT (dán thẳng):
```text
Yuan war junk, 13th century, 24 m long and 7 m wide, whole hull and keel visible. Weathered brown hull, dark indigo trim. Flat deck 2.6 m above the waterline, bulwark 0.9 m. High stern castle over the aft quarter, roof 5.2 m above the waterline, indigo-blue shields on the rails. Three masts: main amidships 14.5 m above the deck, raked 10 m foremast near the bow, 6.5 m mizzen on the castle, each with a faded indigo-blue batten lug sail. No flagpole. Isolated single object, no water, no people. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 2–3k (code LOD0 1.276 tam giác; ngân sách LOD0 3.000, `TRI_BUDGET` ở `boats.js:99`). Gốc ở mớn nước giữa thân, mũi +Z. **Symmetry: tắt** (cột lái lệch mạn, buồm xoay chéo như code).

### K2 · ENV_ky_ham_nguyen · Kỳ hạm Ô Mã Nhi

Dùng ở B20, một chiếc; pha 6 đánh boss ngay trên boong (`battle-b20.js:71`). Thay `BUILD.flagship` (`boats.js:395-460`). Boong nhiều tầng code giữ (`HULLS.flagship`, `boats.js:46-59`): mặt lầu x ±3,7, z −15,5…−6,05 ở cao 6,0; cầu thang giữa thân x ±1,1, từ z −6,05 cao 6,0 xuống z 2,0 cao 3,0; boong dưới cao 3,0; bốn cột đình ở x ±2,2, z −15 và −12,4; cán cờ soái ở `flagAt` [0; 15,5; −13,7]. Kích thước: dài 36 m, rộng 9 m, mớn 1,9 m, mái đình tới khoảng 11 m, cột chính 19 m trên boong. Hai cột buồm, chính ở z +4,5 và mũi ở z +12,8 (`boats.js:455-458`). Mặt tiền lầu cột son, cửa sổ viền vàng; đình bốn cột son, mái hai tầng ngói sẫm, đầu đao vàng; đuôi nheo chàm bốn góc lầu; trống trận son trên lầu; bảng đuôi son lồng chàm có đĩa vàng; tời và hai neo ở mũi. Lầu chiếm khoảng một phần ba thân phía đuôi (z −18…−6,05 trên thân 36 m), quyết chỗ chân cầu thang và mặt lầu đi được ở cao 6,0, nên prompt ghi `over the aft third` và cột chính 19 m; để đủ chỗ trong 600 ký tự, prompt bỏ cửa sổ, mắt thuyền, khiên treo mạn, tời, neo. 3d-ref ghi ba cột và "tháp chỉ huy giữa thân" là lệch với game. Hư cấu.

PROMPT (dán thẳng):
```text
Yuan flagship junk, 13th century, 36 m long and 9 m wide, whole hull and keel visible. Dark brown hull, vermilion trim, open deck 3 m above the waterline. Tall castle over the aft third with vermilion columns, flat top a terrace 6 m up, reached by a central stair; on it a pavilion of four vermilion columns, two-tier dark tile roof, gold upturned corners, red war drum. Two masts, main 19 m above the deck, faded indigo-blue batten lug sails. No flagpole. Isolated single object, no water, no people. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 6–8k (code LOD0 1.756, LOD1 494; ngân sách kỳ hạm 8.000, `boats.js:99`). Texture 1024 như mọi mục môi trường; boss đánh trên boong nên nếu cần nét hơn thì thêm luật 2048 cho riêng mã này trong `meshy.mjs`. **Symmetry: tắt** (trống trận lệch mạn, buồm xoay).

### K3 · ENV_thuyen_ho_ve · Thuyền hộ vệ Nguyên

Dùng ở B20: 6 chiếc ở pha 2 và 8 chiếc đợt hai E7–E14 ở pha 4, tới 14 thân (`battle-b20.js:62-66`, `director-b20.js:23`). Thay `BUILD.escort` (`boats.js:462-483`). Boong code giữ (`HULLS.escort`, `boats.js:60-68`): mặt đi x ±1,85, z −4…6,8 ở cao 1,8; lầu lái x ±2,4, z −8,5…−4,2, nóc 3,3. Kích thước 16 × 4,5 m, mớn 0,9 m, mạn khoảng 0,65 m trên boong. Hai cột (`boats.js:477-480`): cột chính 10 m ở z +1, cột mũi chúi 6,5 m ở z +5,6; 3d-ref ghi một cột là lệch. Không dùng mẫu này cho thuyền quân Tống ở Kế Sách: màu chàm của Nguyên không hợp quân đồng minh, thuyền Tống là K6.

PROMPT (dán thẳng):
```text
Small Yuan dynasty escort junk, 13th century, 16 m long and 4.5 m wide, whole hull and keel visible. Flat transom bow and stern, weathered brown wood hull with dark indigo trim, open deck 1.8 m above the waterline, low stern cabin with a door and a flat roof 3.3 m up, stern rudder, round indigo-blue shields on the rails, painted bow eyes. Two masts, main 10 m and raked foremast, with faded indigo-blue batten lug sails. No flagpole. Isolated single object, no water, no people. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 1,5–2,5k (code LOD0 794, LOD1 268; ngân sách 3.000). **Symmetry: tắt** (buồm xoay chéo).

### K4 · ENV_thuyen_do_luong · Thuyền dò luồng Nguyên

Dùng ở B20: thuyền tiên phong pha 1 và thuyền dò mốc cọc pha 2–3, cứ khoảng 40 s một chiếc (`battle-b20.js:276-290`, `director-b20.js:707`, `director-b20.js:805`). Thay `BUILD.scout` (`boats.js:485-498`). Boong code giữ (`HULLS.scout`, `boats.js:69-77`): mặt đi x ±0,7, z −3,3…3,2 ở cao 0,8, cột buồm là tường; cờ "元" vẽ riêng. Kích thước 9 × 2,2 m, mớn 0,5 m. Thân hở, hai thanh ngang, một cột 5,4 m với buồm cánh dơi nhỏ và đuôi nheo, hai mái chèo mỗi bên, sào dò luồng nằm dọc sàn (`boats.js:490`); không mui, không lầu. 3d-ref ghi bốn mái chèo mỗi bên, có mui, không cột là lệch.

PROMPT (dán thẳng):
```text
Narrow Yuan scout boat, 13th century, 9 m long and 2.2 m wide, open wooden hull with keel visible, deck 0.8 m above the waterline, weathered brown wood with a dark indigo rail stripe, two plank thwarts, one mast 5.4 m tall amidships with a small faded indigo-blue batten lug sail, two oars on each side, a long thin sounding pole lying along the deck. No cabin, no awning, no flagpole. Isolated single object, no water, no people. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 0,8–1,2k (code LOD0 496, LOD1 170). **Symmetry: tắt** (buồm xoay, sào lệch).

### K5 · ENV_thuyen_chien_tran · Thuyền chiến nhẹ quân Trần

Dùng ở B20: sàn của người chơi suốt pha 1 (tướng và 10 quân đứng trên boong), các thuyền nhẹ khác của ta, và thuyền chỉ huy nhẹ "lead" là chính thân này phóng 1,35× (`boats.js:79-97`; `director-b20.js:633`, `director-b20.js:666`, `director-b20.js:677`). Thay `BUILD.light` (`boats.js:500-512`). Boong code giữ (`HULLS.light`): mặt đi x ±0,85, z −4,3…4,3 ở cao 0,7, không tường, mạn khoảng 0,4 m; cán cờ (code) ở z −5,3. Kích thước 12 × 2,6 m, mớn 0,36 m, mũi cong lên tới 2,75 m, đuôi tới 2,3 m. Thân dưới then `#2a2420`, mạn son `#a8321f`, viền vàng; mắt thuyền trứng sáo, con ngươi son; năm mái chèo mỗi bên, lá chèo son; năm thanh ngang trên sàn; mũi và đuôi uốn thành đầu rồng, đuôi rồng cách điệu thếp vàng. Không mui, không buồm, không lầu: boong phải trống cho 10 quân. 3d-ref ghi dài 14 m, sáu mái chèo, mui đuôi là lệch. Đầu rồng ở thuyền chiến là Hư cấu.

PROMPT (dán thẳng):
```text
Slender 13th-century Vietnamese Tran dynasty war boat, 12 m long and 2.6 m wide, whole hull and keel visible. Black lacquer lower hull, vermilion upper planks, thin gold band, cream bow eyes with red pupils. Bow and stern curve up into small gilded stylized dragon-head and dragon-tail finials. Five oars on each side with vermilion blades. Open flat plank deck 0.7 m above the waterline with five thwarts. No sail, no cabin, no awning, no flagpole. Isolated single object, no water, no people. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 2–3k (code LOD0 602; ngân sách 3.000). Người chơi đứng trên thuyền này cả pha 1 nên nên giữ texture. **Symmetry: bật.**

### K6 · ENV_thuyen_tong · Thuyền quân Tống (Triệu Trung)

Dùng ở B15, Kế Sách "Quân áo Tống": 2 thuyền chở quân Tống lưu vong của Triệu Trung cập bến (`kesach.js:64-81`, số thuyền ở `battle-b15.js:125`). Thay khối hộp `kesach.js:69-77`: thân 2,8 × 1 × 9 m, lầu sau 2,2 × 0,8 × 2,6 m, cột then 6 m, ba bó hàng vàng đất `#a0622c`. Code giữ lá cờ "宋" (vàng đất `#b0752c`, chữ then, `flagTexture`) treo trên cột ở cao 5,4 m (`kesach.js:77`), đường chạy, máu thuyền; nên cột của mẫu phải ở đúng chỗ cột code: cao 6 m, lệch về mũi 0,8 m (`kesach.js:72`). Kích thước 9 × 2,8 m. Hình thuyền sông Nam Tống, sơn màu quân Tống (nâu sẫm, vàng đất), không dùng màu chàm của Nguyên: quân Tống lưu vong là đồng minh có phẩm giá (mục 2.6). Mái mui đan trên lầu là **(đề xuất)**. Hư cấu.

PROMPT (dán thẳng):
```text
Southern Song river transport boat, 13th century, 9 m long and 2.8 m wide, whole hull and keel visible. Flat transom ends, dark brown planked hull with ochre trim, a small wooden cabin at the stern with a low curved woven-mat roof, one plain black mast 6 m tall a little forward of amidships, without sail, three tall bundles wrapped in ochre cloth standing amidships. No flag. Isolated single object, no water, no people. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 1–2k (code khoảng 80). **Symmetry: bật.**

### K7 · ENV_thuyen_song_nguyen · Thuyền chiến Nguyên trên sông Hồng (B15)

Dùng ở B15 và Tự do: 7 thuyền Nguyên neo trên sông phía bắc Hàm Tử quan, thấy từ bãi đánh boss; 3 chiếc cháy ở pha 4 (`world.js:283-295`, lửa ở `atmosphere.js:118`). Thay 7 lưới riêng (7 lượt vẽ): thân hộp 3,4 × 1,2 × 11 m, nhà boong 2,8 × 0,9 × 3,5 m lệch về đuôi, cột then 8 m, một lá buồm phẳng màu rơm 3,6 × 4,2 m. Code giữ dập dềnh, chỗ neo, lửa cháy. Thân nhỏ hơn hẳn chiến thuyền 24 m của B20 nên là mẫu riêng (một GLB ở hai cỡ không vừa cả hai). Gộp 7 thuyền thành một InstancedMesh thì bớt 6 lượt vẽ. Hư cấu.

PROMPT (dán thẳng):
```text
Small Yuan river war boat, 13th century, 11 m long and 3.4 m wide, whole flat-bottomed hull visible. Boxy dark brown planked hull with flat transom ends, a low wooden deckhouse toward the stern, one black mast 8 m tall carrying a single straw-colored batten mat sail. Isolated single object, no water, no people. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 1–2k (code khoảng 50). **Symmetry: bật.**

### K8 · ENV_thuyen_mui · Thuyền nan mui ở bến

Dùng ở B15 và Tự do: 8 thuyền nhỏ, hai chiếc ở đầu mỗi bến gỗ bờ bắc, dập dềnh (`scenery.js:215-228`). Thay `skiffGeo`: thân hộp 1,2 × 0,45 × 4,2 m, mũi nhọn, mui tre đan nửa trụ Ø 1,8 m dài 1,6 m ở giữa thân, một sào chống. Hiện mỗi thuyền một lưới (8 lượt vẽ); dùng GLB thì gộp một InstancedMesh. Bản kiểm kê cũ ghi chỗ này là thúng tròn là sai: thúng là mục K9.

PROMPT (dán thẳng):
```text
Small Vietnamese river sampan, 13th century, 4.2 m long and 1.2 m wide, shallow brown wooden hull with a pointed bow, an arched awning of woven bamboo over the middle, one long wooden pole resting along the side. Isolated single object, no water, no people. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 0,5–1k (code khoảng 70). **Symmetry: tắt** (sào nằm lệch một mạn, x 0,5 ở `scenery.js:218`; bật thì sào có thể nhân đôi hoặc mất).

### K9 · ENV_thung_cau · Thúng câu

Dùng ở B15 và Tự do (3 thúng trên bờ cạnh lưới phơi, `scenery.js:229-231`) và B20 (thúng ở gốc mỗi bến phục binh, `scenery-b20.js:441`). Thay trụ 8 cạnh Ø 1,8 m sâu 0,5 m (B20 Ø 1,4 m, bước nướng thu nhỏ). Thúng chai tre đan quét dầu rái của dân chài vùng sông nước Bắc Bộ; chi tiết là Hư cấu. Code tô màu tre đan nhạt `#8c7a52` (`scenery.js:231`, `scenery-b20.js:441`); lớp dầu rái nâu sẫm trong prompt là **(đề xuất)** (bảng 2.5): thúng chai thật trét kín bằng dầu rái, nhựa cây nên sẫm màu. Muốn giữ màu code thì thay `tightly woven bamboo coated with dark brown resin` bằng `pale tan tightly woven bamboo`.

PROMPT (dán thẳng):
```text
Round Vietnamese woven bamboo basket boat, 1.8 m across and 50 cm deep, tightly woven bamboo coated with dark brown resin, thick bamboo rim, one wooden paddle lying inside. Isolated single object, no water, no people. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 300–800 gửi Meshy; trong game ≤ 32 mỗi thúng như code (B20 4 thúng trong `b20-statics`, B15 3 thúng trong lưới tĩnh). **Symmetry: tắt** (mái chèo nằm lệch một bên).

### K10 · ENV_long_thuyen · Long thuyền nhà Trần (tuỳ chọn)

Chưa có trong game; chỉ có trong truyện (khung O1, K3 theo 3d-ref). Làm sẵn nếu sau này có cảnh duyệt thủy quân. Dài khoảng 20 m **(đề xuất)**. Hư cấu.

PROMPT (dán thẳng):
```text
Tran dynasty royal dragon boat, 13th century, 20 m long, whole hull and keel visible. Vermilion and gold lacquered hull, a carved dragon head with open jaws at the raised bow and a dragon tail at the stern, a central pavilion with vermilion columns and a curved dark tile roof with a gold ridge, rows of oars along both sides. Isolated single object, no water, no people. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 3–5k. **Symmetry: bật.**

---

## L. Công trình (môi trường)

Quy ước chung ở đầu mục K. Công trình B15 nay là khối hộp gộp vào lưới tĩnh của trận (`world.js:176-297`), B20 gộp vào lưới `b20-statics` (`scenery-b20.js:517-520`), Võ trường gộp vào lưới của sân (`world.js:598`, `scenery.js:1067`); vật hay chắn camera (cột cờ, cây đa, khán đài) là lưới riêng tự mờ (`world.addFadeable`). Va chạm (`world.colliders`) do code giữ, nên mẫu phải giữ đúng chân đế.

| # | Mã | Tệp | Tên | Nhóm | Tam giác | Kích thước thật (nướng về số này) | Thay cho (code) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 74 | ENV_cong_ham_tu | `env_cong-ham-tu.glb` | Cổng Hàm Tử quan (nhà cổng) | L | 2,5–4k | rộng 15,6 m, cao 10,2 m, lối 9,2 m | khối `house` của `buildGate` |
| 75 | ENV_canh_cong | `env_canh-cong.glb` | Cánh cổng Hàm Tử | L | 300–600 | 4,4 × 5,4 × 0,5 m | `leaf()` của `buildGate` |
| 76 | ENV_tuong_dat | `env_tuong-dat.glb` | Tường đất nện Hàm Tử quan (khúc 10 m) | L | 0,5–1k | 10 × 2,6 m, cao 5,5 m | `wallSeg` |
| 77 | ENV_rao_coc | `env_rao-coc.glb` | Rào cọc (khúc 3,3 m) | L | 300–600 | 3,3 m, đỉnh cọc 1,75–2,05 m (mẫu 1,6 m) | `palisade`, rào Võ trường, rào bản doanh B20 |
| 78 | ENV_thap_canh_nguyen | `env_thap-canh-nguyen.glb` | Tháp canh gỗ (trại Nguyên, đồn) | L | 0,8–1,5k | cao 8,3 m, sàn 2,8 m ở 6 m | `tower` B15 |
| 79 | ENV_thap_canh_tran | `env_thap-canh-tran.glb` | Tháp canh tre gỗ quân Trần (B20) | L | 1–2k | cao 11,4 m, sàn 3,3 m ở 8,2 m | tháp canh `scenery-b20.js` |
| 80 | ENV_leu_tron | `env_leu-tron.glb` | Lều nỉ tròn Mông Cổ | L | 0,6–1,2k | Ø 4,8 m, cao 3,2 m | `yurt` |
| 81 | ENV_leu_vuong_nguyen | `env_leu-vuong-nguyen.glb` | Lều vuông quân Nguyên | L | 0,5–1k | 3,2 × 3,2 m, cao 2,6 m | `tent` trong doanh trại |
| 82 | ENV_leu_luong | `env_leu-luong.glb` | Lều lương quân Nguyên (Đánh úp trại) | L | 0,8–1,5k | 5 × 4 m, nóc 3 m | mới (nay không có hình) |
| 83 | ENV_khung_leu_chay | `env_khung-leu-chay.glb` | Khung lều cháy | L | 300–800 | Ø 3,2 m, cao 2,2 m | lều cháy trại Nguyên bỏ |
| 84 | ENV_leu_tran | `env_leu-tran.glb` | Lều quân Trần | L | 300–800 | 3,1 × 3,1 m, cao 2,4 m | `tent`, `tentParts`, lều Võ trường |
| 85 | ENV_nha_bat_chi_huy | `env_nha-bat-chi-huy.glb` | Nhà bạt chỉ huy Hưng Đạo vương | L | 2–3k | sàn 9,4 × 7,2 m, nóc 5,5 m | `pavilionParts` |
| 86 | ENV_nha_lang_a | `env_nha-lang-a.glb` | Nhà sàn thấp ven bãi | L | 0,8–1,5k | thân 3,6 × 2,8 m, cao 4,7 m | `hut` |
| 87 | ENV_nha_lang_b | `env_nha-lang-b.glb` | Nhà tranh vách đất | L | 0,8–1,5k | thân 3,6 × 2,8 m, cao 4,5 m | `hut` (biến thể) |
| 88 | ENV_choi_tranh | `env_choi-tranh.glb` | Chòi tranh | L | 300–600 | mái 3,8 m, cột 2,3 m, nóc 3 m | `hutParts` |
| 89 | ENV_cau_tau_nhip | `env_cau-tau-nhip.glb` | Nhịp cầu bến (2,5 m) | L | 300–600 | 2,5 × 2,6 m, cọc 4 m | ván, dầm, cọc bến B20 |
| 90 | ENV_cau_tau_dau | `env_cau-tau-dau.glb` | Đầu bến chữ T | L | 0,6–1k | 6 × 4 m | đầu bến B20 |
| 91 | ENV_ben_go | `env_ben-go.glb` | Bến gỗ nhỏ (B15) | L | 0,5–1k | 10 × 2,4 m, sàn 0,95 m | `pier` B15 |
| 92 | ENV_khan_dai | `env_khan-dai.glb` | Gian khán đài Võ trường | L | 0,8–1,5k | 6 × 5,8 m, nóc 5,5 m | `bay` |
| 93 | ENV_dai_chi_huy | `env_dai-chi-huy.glb` | Đài chỉ huy Võ trường | L | 1,5–2,5k | 7 × 6 m, cao 1,8 m, lọng 6,3 m | đài chỉ huy `scenery.js` |
| 94 | ENV_lau_trong | `env_lau-trong.glb` | Lầu trống Võ trường | L | 1–2k | cao 10 m, sàn 4 m ở 7 m | `tower` Võ trường |
| 95 | ENV_mieu | `env_mieu.glb` | Miếu làng (tuỳ chọn) | L | 0,8–1,5k | 3 × 3 m, cao 3 m | mới |

### L1 · ENV_cong_ham_tu · Cổng Hàm Tử quan (nhà cổng)

Dùng ở B15 và Tự do: hai cổng A3, B3 trên tường tây Hàm Tử quan (z −75 và +75), mục tiêu pha 3 có thanh máu (`world.js:482-505`; mở, rung, đổ ở `battle.js:336-339`). Thay khối `house` (`world.js:484-490`): hai tháp 3,2 × 7 × 3,2 m, tâm cách nhau 12,4 m nên lối giữa rộng 9,2 m; xà 3,6 × 1,2 × 15,6 m ở cao 6,8–8,0 m; mái bốn mặt tới 10,2 m. Code giữ hai cánh cổng (mục L2, trong nhóm bản lề `lp`/`rp` ở z ±4,4), cờ, lửa cháy cổng (`atmosphere.js:117-133`), hộp cắt camera (`battle.js:298-312`). Không gắn khúc tường: tường là mô-đun L3 (3d-ref gắn sẵn một khúc lũy là lệch). Cổng đất và gỗ của một cửa ải ven sông, không phải tường gạch có lỗ châu mai (Hư cấu, suy luận). Code: hai tháp màu đất nâu `#6d5c45`, xà gỗ, mái chóp nâu sẫm `#4a3524` (`world.js:485-488`). Prompt xin mái ngói đất nung nâu sẫm: đúng màu code, và hợp mái ngói đất nung đỏ nâu thời Lý – Trần (ngói mũi hài); mái ngói xám đều trên vọng lâu dễ ra lầu cổng kiểu Minh – Thanh. Lầu trên xà và lan can là **(đề xuất)**.

PROMPT (dán thẳng):
```text
Vietnamese fortified gatehouse of a 13th-century river pass, 15.6 m wide and 10.2 m tall: two square towers 3.2 m wide and 7 m tall of tan rammed earth framed with brown wood posts, standing 9.2 m apart, joined on top by a heavy timber beam carrying a covered fighting gallery with wooden railings under a four-sided dark brown terracotta tile roof. The gateway between the towers is an empty opening with no doors. Isolated single object, no wall attached, no people. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 2,5–4k (code 44 mỗi nhà cổng, hai cổng). Vật đơn lẻ nhìn gần: phần tăng so với code phải bù ở chỗ khác trong B15 (đầu mục K). Nên giữ texture (pha 3 đánh sát cổng). **Symmetry: bật.**

### L2 · ENV_canh_cong · Cánh cổng Hàm Tử

Dùng cho cả bốn cánh của hai cổng (`world.js:491-499`): mỗi cánh rộng 4,4 m, cao 5,4 m, dày 0,5 m, ván nâu sẫm `#5a3b22`, ba đai sắt then ở cao 1,2 / 2,7 / 4,2 m tính từ chân. Một tệp, lật gương cho cánh kia. Code giữ bản lề, mở, rung, đổ (`battle.js:336-339`). Đinh tán sắt là **(đề xuất)**.

PROMPT (dán thẳng):
```text
One heavy wooden gate door leaf, 4.4 m wide, 5.4 m tall and 50 cm thick, vertical dark brown planks, three black iron bands across at even heights, rows of iron studs, standing upright. Isolated single object, no frame, no people. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 300–600 (code khoảng 48). Gốc ở mép bản lề (bước nướng đặt lại). **Symmetry: bật.**

### L3 · ENV_tuong_dat · Tường đất nện Hàm Tử quan (khúc 10 m)

Dùng ở B15 và Tự do: tường tây (x 462, ba đoạn từ bờ sông tới góc nam, chừa hai cổng) và tường nam, tổng khoảng 418 m, khoảng 42 khúc (`world.js:263-276`). Thay thân tường hộp dày 2,6 m cao 4,6 m màu đất `#7a6a50`, sàn đi 3,0 × 0,5 m ở cao 4,5 m, khối lỗ châu mai gỗ 0,7 × 0,8 × 0,7 m cách 2,2 m (đỉnh 5,5 m), đặt trên đường giữa mặt tường (`world.js:270-272`), không ở mép ngoài. Code giữ va chạm (đoạn r 1,6) và tháp góc (mục L5). Hai đầu cắt phẳng để nối liền. Đất nện có vết đầm từng lớp là cách đắp thành thời này; chi tiết là Hư cấu. Prompt ghi `Vietnamese rammed-earth rampart` và `parapet blocks`, không `fortress wall`, `merlons` (từ của tường thành châu Âu có lỗ châu mai).

PROMPT (dán thẳng):
```text
Straight 10 m section of a 13th-century Vietnamese rammed-earth rampart: tan rammed earth 4.6 m tall and 2.6 m thick with horizontal tamping layers and slightly sloped faces, a brown wooden walkway deck on top, a row of low square wooden parapet blocks 70 cm wide spaced 2.2 m apart along the middle of the top. Both ends cut flat so sections join. Isolated single object, no people. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 0,5–1k gửi Meshy; trong game ≤ 60 mỗi khúc 10 m như code (khoảng 4,5 khối ụ chắn × 12 cộng phần thân; cả tường khoảng 2.400 cho 42 khúc), vì B15 không được tăng (đầu mục K). Giảm tới đó mà hỏng dáng thì giữ code. **Symmetry: bật.**

### L4 · ENV_rao_coc · Rào cọc (khúc 3,3 m)

Dùng ở B15 và Tự do (vòng bản doanh ta r 18, hai đồn r 10, hai doanh trại r 13; `world.js:179-189`, gọi ở `world.js:220`, `world.js:231`, `world.js:234`), Võ trường (vòng r 47, `world.js:569-575`) và bản doanh B20 (vòng r 19, cọc 2,2–2,6 m có nẹp ngang ở 1,2 m; `scenery-b20.js:476-488`). Thay từng cọc trụ 5 cạnh có chóp: thân 1,5–1,8 m cộng chóp 0,3 m, đỉnh ở 1,75 / 1,90 / 2,05 m (`world.js:186-187`), Ø 0,26–0,32 m, cách 0,55 m; cọc thấp để camera đứng sau tướng nhìn qua được (`world.js:185`). Prompt ghi 1,6 m nên vòng rào nướng ra thấp hơn code khoảng 0,3 m, dễ cho camera hơn; muốn giữ đúng thì bước nướng kéo Y khoảng 1,2 lần. Khúc hơi cong để xếp thành vòng bán kính 10–18 m của B15. Code giữ va chạm và chỗ chừa cổng.

Khúc 6 cọc chỉ hợp khoảng cách 0,55 m của B15. Hai chỗ kia thưa hơn, nên bước nướng **tách một cọc** từ mẫu và đặt từng cọc vào đúng chỗ cọc của code (hoặc giữ code ở hai chỗ ấy), không lặp nguyên khúc: B20 cọc cách 0,8 m (149 cọc trên vòng r 19), r 0,12 m, thân 2,2–2,6 m có chóp 0,35 m, nẹp ngang ở cao 1,2 m nối mỗi cọc chẵn với cọc cách hai (`scenery-b20.js:476-488`); Võ trường cọc cách 1,34 m (220 chỗ trên vòng r 47, trừ bốn cửa), cọc trụ 1,6–2,0 m không chóp (`world.js:569-575`). Lặp nguyên khúc ở đó thì ra gấp 1,45 lần (B20) và 2,4 lần (Võ trường) số cọc của code.

PROMPT (dán thẳng):
```text
Short palisade section 3.3 m long: six sharpened bark-covered log stakes 1.6 m tall and 30 cm thick standing close together in a slightly curved row, tied by one rope band at mid height. Isolated single object, no ground, no people. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 300–600 gửi Meshy; trong game ≤ 180 mỗi khúc B15 (6 cọc × 30 như code): vòng rào B15 khoảng 111 khúc ≈ 20 nghìn như hiện nay. Cọc tách đặt riêng: B20 ≤ 19 mỗi cọc kể cả phần nẹp (cả vòng 2.829 trong `b20-statics`), Võ trường ≤ 20 mỗi cọc (cọc trụ 5 cạnh có nắp, khoảng 4 nghìn cả vòng). Giảm tới đó mà hỏng dáng thì giữ code. **Symmetry: bật.**

### L5 · ENV_thap_canh_nguyen · Tháp canh gỗ (trại Nguyên, đồn)

Dùng ở B15 và Tự do: 7 tháp, ở ngoài rào hai đồn (sàn 6 m), hai doanh trại (7 m) và ba góc Hàm Tử quan (8 m) (`world.js:200-205`, gọi ở `world.js:231`, `world.js:235`, `world.js:278`). Thay bốn chân hộp 0,22 m cách nhau 2 m, sàn vuông 2,8 m ở cao h, mái chóp bốn mặt nâu sẫm tới h + 2,3 m. Code chưa có thang, lan can, giằng chéo; mẫu thêm vào **(đề xuất)**. Đồn đổi chủ khi đánh (chỉ cờ đổi màu, `world.js:348-353`), nên tháp để gỗ trơn, không dấu hiệu phe. Mẫu dựng theo sàn 6 m (cao 8,3 m); bước nướng kéo Y cho tháp 7 m, 8 m.

PROMPT (dán thẳng):
```text
Plain timber watchtower 8.3 m tall: four straight square log legs 2 m apart with diagonal cross bracing, a wooden ladder up one side, a square plank lookout platform 2.8 m wide at 6 m height with a low railing, a small four-sided dark brown plank roof on corner posts above. No flag. Isolated single object, no people. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 0,8–1,5k (code 68 mỗi tháp, 7 tháp). Vật đơn lẻ: phần tăng so với code phải bù ở chỗ khác trong B15 (đầu mục K). **Symmetry: tắt** (thang một bên).

### L6 · ENV_thap_canh_tran · Tháp canh tre gỗ quân Trần (B20)

Dùng ở B20: hai tháp canh ven sông (`scenery-b20.js:448-471`). Thay bốn chân tre choãi (cách 3,5 m ở chân, 2,2 m ở đỉnh), giằng chữ X ở hai tầng (2,6 và 5,4 m), sàn vuông 3,3 m ở cao 8,2 m, lan can tre ở 9,2 m, mái tranh bốn mặt tới khoảng 11,4 m, thang 17 bậc phía đất, trống báo nhỏ trên sàn (thùng nằm ngang `#8a5a3a` Ø 0,8 m, dài 0,6 m, không giá, `scenery-b20.js:467`; trống này thuộc mẫu tháp, M11 không thay nó). Code giữ cán cờ ở góc (−1,2; −1,2) và lá cờ (`flagBatch`), chòi dưới chân (mục L15), va chạm r 2,2. Thang phải quay về phía đất (`t.side`): bước nướng xoay mẫu theo thang. Màu tre `#b09a5a`/`#8e7c48`, tranh `#9c8452`.

PROMPT (dán thẳng):
```text
Vietnamese bamboo-and-timber watchtower 11.4 m tall: four thick pale bamboo legs splayed 3.5 m apart at the foot and 2.2 m at the top, X bracing at two levels, a bamboo ladder up one side, square plank platform 3.3 m wide at 8.2 m with a bamboo railing, a small barrel alarm drum on the platform, steep four-sided golden-brown thatch roof. No flag. Isolated single object, no people. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 1–2k gửi Meshy; trong game ≤ 560 mỗi tháp như code (thân 528 cộng trống báo 32, hai tháp trong `b20-statics`); cao hơn thì phải có LOD hoặc bớt ở chỗ khác (đầu mục K). **Symmetry: tắt** (thang một bên).

### L7 · ENV_leu_tron · Lều nỉ tròn Mông Cổ

Dùng ở B15 và Tự do: 9 lều trong Hàm Tử quan, khu đánh boss pha 4 (`world.js:195-199`, đặt ở `world.js:279`). Thay trụ 9 cạnh r 2,4 m cao 1,8 m màu xám bạc cộng nón 9 cạnh r 2,7 m cao 1,4 m: Ø 4,8 m, cao 3,2 m, scale 0,9–1,2. Vách nỉ quấn dây, mái nỉ thấp, vòng gỗ trên đỉnh, cửa gỗ sơn đỏ là dáng lều Mông Cổ thật; chi tiết là Hư cấu.

PROMPT (dán thẳng):
```text
Mongol felt tent (ger), 13th century, 4.8 m across and 3.2 m tall: round wall 1.8 m high of pale grey felt tied with three dark rope bands, low conical pale grey felt roof with a round wooden roof ring on top, small wooden door painted dark red. Isolated single object, no people. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 0,6–1,2k (code khoảng 54). **Symmetry: tắt** (cửa một bên).

### L8 · ENV_leu_vuong_nguyen · Lều vuông quân Nguyên

Dùng ở B15 và Tự do: 4 lều trong mỗi doanh trại A2, B2 (`world.js:234`); hiện nay là đúng hàm `tent()` hình chóp của quân ta, màu rơm và xám. Mẫu riêng để trại Nguyên khác trại Trần bằng dáng: lều vách đứng mái bốn mặt, vuông 3,2 m, cao 2,6 m (chiếm chỗ gần bằng chóp code: đáy chéo 4,4 m, cao 2,4 m). Doanh trại A2, B2 đổi chủ khi đánh (`battle-b15.js:50`, `battle-b15.js:53`; `setBaseOwner` chỉ đổi màu cờ, `world.js:348-353`), nên như tháp L5, lều không mang màu phe: vải xám, dải viền vải nhạt để bước nướng nhuộm được theo chủ trại nếu muốn (code nay dùng màu trung tính `PAL.vai`, `PAL.xam`). Lều vải kiểu quân Hán trong quân Nguyên (Hư cấu).

PROMPT (dán thẳng):
```text
Yuan army square wall tent, 13th century: square base 3.2 m, upright canvas walls 1.3 m high under a four-sided sloping roof reaching 2.6 m, grey canvas with pale cloth hem bands, door flap tied open, guy ropes to wooden pegs. Isolated single object, no people. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 0,5–1k (code 20 mỗi lều, 8 lều). Vật đơn lẻ: phần tăng so với code phải bù ở chỗ khác trong B15. **Symmetry: tắt** (cửa một bên).

### L9 · ENV_leu_luong · Lều lương quân Nguyên (Đánh úp trại)

Dùng ở Tự do, nhiệm vụ "Đánh úp trại": 3 lều lương là mục tiêu phải đốt nhưng nay **không có hình**, chỉ có ô vuông trên bản đồ nhỏ và lửa khi cháy (`director-td.js:263-266`, `director-td.js:356-364`; vị trí cách tâm trại 8 m, `skirmish.js:76`; bản đồ nhỏ `battles/td.js:50`). Mẫu mới 5 × 4 m, nóc 3 m; cháy rồi thì đổi sang mục L10. Lưu ý chỗ đặt: tâm trại là doanh trại A2/B2, nơi 4 lều chóp đứng cách tâm khoảng 6,4–6,7 m (đáy r 2,2), nên bản dựng nhiệm vụ phải ẩn lều cũ hoặc dời lều lương. Hư cấu.

PROMPT (dán thẳng):
```text
Yuan army grain-store tent, 13th century, 5 m long, 4 m wide and 3 m tall: ridge tent of grey canvas on a brown wood frame, side flaps rolled up to show stacked hemp rice sacks and bound bundles of fodder inside. Isolated single object, no people. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 0,8–1,5k. **Symmetry: tắt** (vạt cuốn).

### L10 · ENV_khung_leu_chay · Khung lều cháy

Dùng ở B15 và Tự do: lều cháy trơ khung trong trại Nguyên bỏ ngoài thành (`scenery.js:272-273`: năm cột đen `#2a221a` dài 2,2 m nghiêng quanh vòng Ø 3,2 m) và lều lương đã đốt ở "Đánh úp trại" (`director-td.js:356-364`). Lửa, khói vẫn là hiệu ứng. Lều lương L9 là lều nóc 5 × 4 m, còn khung này là vòng Ø 3,2 m: khi lều lương cháy, bước nướng kéo khung không đều về chân đế 5 × 4 m (X khoảng 1,56, Z 1,25) để cùng chỗ chiếm, không đổi hình đột ngột.

PROMPT (dán thẳng):
```text
Burnt-out tent frame: five charred black wooden poles 2.2 m long leaning in a ring 3.2 m across, scraps of scorched cloth hanging from them, a ring of grey ash and black embers between them. No flame, no smoke. Isolated single object, no people. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 300–800. **Symmetry: tắt.**

### L11 · ENV_leu_tran · Lều quân Trần

Dùng ở B15 (5 lều bản doanh ta, `world.js:190-194`, đặt ở `world.js:221`), B20 (6 lều quanh bản doanh Hưng Đạo vương, `scenery-b20.js:286`, đặt ở `scenery-b20.js:505-509`) và Võ trường (16 lều, `scenery.js:1037-1041`: chóp r 3,2 cao 3,2 kéo 1,5 lần theo một chiều, tức đáy 4,5 × 6,8 m, cao 3,2 m, cột giữa 3,6 m, vạt cửa 1,2 × 1,6 m; bước nướng phóng mẫu 3,1 × 2,4 m theo X ×1,45, Z ×2,2, Y ×1,33). Thay chóp bốn mặt: đáy chéo 4,4 m (cạnh 3,1 m), cao 2,4 m, scale 0,8–1,4; vạt cửa then 0,6 × 1,2 m. Code nhuộm màu từng lều (son, son sẫm, vải, xám, `#c9b98f`), nên vải để màu rơm nhạt để nhuộm được.

PROMPT (dán thẳng):
```text
13th-century Vietnamese army field tent: square pyramid tent 3.1 m wide and 2.4 m tall, plain straw-colored cloth reaching the ground, black door flap at the front, short pole tip at the apex, guy ropes to wooden pegs at the corners. Isolated single object, no people. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 300–800 gửi Meshy; trong game ≤ 20 mỗi lều như code ở B15 và B20 (6 lều trong `b20-statics`), Võ trường ≤ 32 (thêm cột giữa); cao hơn thì phải có LOD hoặc bớt ở chỗ khác. **Symmetry: tắt** (cửa một bên).

### L12 · ENV_nha_bat_chi_huy · Nhà bạt chỉ huy Hưng Đạo vương

Dùng ở B20: nhà bạt giữa bản doanh trên gò bờ bắc, quay ra cổng (`scenery-b20.js:287-297`, đặt ở `scenery-b20.js:496`, va chạm r 4,6). Thay sàn gỗ 9,4 × 7,2 m, 8 cột son sẫm cao 3,4 m (x ±4,2 và ±1,4; z ±3,1), khung xà then 10,2 × 8 m ở 3,8 m, mái hai dốc bằng vải son, dải vàng ở nóc 5,45 m, vách vải màu rơm phía sau, án thư son mặt vàng 2,4 × 0,9 × 1,2 m, ghế then. Code giữ cờ lệnh, cờ "陳" (`flagBatch`). Mái vải, không ngói: nhà bạt của doanh trại dã chiến năm 1288 (3d-ref ghi mái ngói son là lệch chất liệu).

PROMPT (dán thẳng):
```text
Open-sided field command pavilion of a 13th-century Vietnamese army camp: raised plank floor 9.4 by 7.2 m, eight round dark red lacquered columns 3.4 m tall, black lacquer beam frame, gabled roof of stretched vermilion cloth with a gold ridge band, ridge 5.5 m high, a straw-colored cloth screen along the back, a low vermilion table with a gold top and a black lacquer chair inside. No tiles. Isolated single object, no people. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 2–3k gửi Meshy; trong game ≤ 300 như code (trong `b20-statics`); cao hơn thì phải bớt ở chỗ khác trong B20 (đầu mục K). **Symmetry: bật.**

### L13 · ENV_nha_lang_a · Nhà sàn thấp ven bãi

Dùng ở B15 và Tự do: 6 nhà của làng ven bãi (làng của Kế Sách "Mũi tên thư" và đường dân tản cư; `world.js:253-260`; dân chạy ra từ đúng các chỗ này, `ambient.js:1009`). Thay 4 cột 1,2 m, thân hộp 3,6 × 1,6 × 2,8 m màu `#a08560`, mái chóp bốn mặt kéo dài: tổng cao khoảng 4,7 m, scale 0,9–1,06. Đây là kiểu code đang vẽ; nhà sàn ở làng đồng bằng chỉ là cách điệu, nên có thêm biến thể nhà đất L14. Hư cấu.

PROMPT (dán thẳng):
```text
Small 13th-century Vietnamese village house on short stilts: body 3.6 by 2.8 m raised 1.2 m on wooden posts, walls of woven bamboo mats, steep four-sided golden-brown thatch roof with deep eaves, ridge 4.7 m high, short bamboo ladder up to the doorway. Isolated single object, no people. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 0,8–1,5k (code 68 mỗi nhà, 6 nhà). Vật đơn lẻ: phần tăng so với code phải bù ở chỗ khác trong B15. **Symmetry: tắt** (thang một bên).

### L14 · ENV_nha_lang_b · Nhà tranh vách đất

Biến thể cho cùng 6 chỗ ở `world.js:253-260`, xen với L13: nhà tranh trên nền đất đắp thấp, vách đất trát, hiên trước cột tre, cùng chân đế 3,6 × 2,8 m, cao khoảng 4,5 m. Hợp với làng đồng bằng sông Hồng hơn nhà sàn (suy luận). Không dùng kiểu đình: đình làng phần lớn có từ thế kỷ 16.

PROMPT (dán thẳng):
```text
Small 13th-century Vietnamese thatched cottage on a low earth plinth: body 3.6 by 2.8 m, mud-plastered woven-bamboo walls in tan clay, a narrow front veranda on bamboo posts, a wooden door in the middle, steep four-sided golden-brown thatch roof with deep eaves, ridge 4.5 m high. Isolated single object, no people. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 0,8–1,5k. **Symmetry: bật.**

### L15 · ENV_choi_tranh · Chòi tranh

Dùng ở B20: chòi ở gốc mỗi bến phục binh và dưới chân mỗi tháp canh, 4 chòi (`scenery-b20.js:310-316`, đặt ở `scenery-b20.js:436-437`, `scenery-b20.js:465-466`). Thay 4 cột tre 2,3 m (cách 3 × 2,2 m) và mái tranh hai dốc dài 3,8 m, nóc 3,05 m. Mở bốn phía. Hư cấu.

PROMPT (dán thẳng):
```text
Open thatched field shelter: four pale bamboo posts 2.3 m tall standing 3 by 2.2 m apart, two-slope golden-brown thatch roof 3.8 m long overhanging all sides, ridge 3 m high, open on all four sides, no walls. Isolated single object, no people. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 300–600 gửi Meshy; trong game ≤ 116 mỗi chòi như code (4 chòi trong `b20-statics`). **Symmetry: bật.**

### L16 · ENV_cau_tau_nhip · Nhịp cầu bến (2,5 m)

Dùng ở B20: hai bến phục binh đâm ra sông từ bờ (`scenery-b20.js:418-424`), sàn đi được ở cao 2,3 m (`world-b20.js:289-299`). Thay từng khúc: ván ngang rộng 2,6 m, bản 0,9 m, dày 0,1 m, cách 1 m; hai dầm dọc 0,2 × 0,2 m; cọc tròn r 0,13 m mỗi 2,5 m hai bên, từ dưới bùn lên quá sàn 0,35 m. Lặp nhịp theo chiều dài bến; hai nhịp liền nhau dùng chung một cặp cọc nên bước nướng bỏ cọc trùng. Cọc trong mẫu dài 4 m, bước nướng cắt hoặc chôn theo đáy sông. Code giữ đầu bến (L17), thang, cờ.

PROMPT (dán thẳng):
```text
One 2.5 m bay of a wooden pier: deck 2.6 m wide of brown boards laid crosswise on two log stringers, standing on four round dark log piles 4 m long at its corners. Isolated single object, no water, no people. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 300–600 gửi Meshy; trong game ≤ 67 mỗi nhịp như code (ván, dầm, cọc của 23 nhịp hai bến là 1.536 trong `b20-statics`; hai bến dài 33,1 m và 21 m); nặng hơn thì giữ code. **Symmetry: bật.**

### L17 · ENV_cau_tau_dau · Đầu bến chữ T

Dùng ở B20: đầu hai bến phục binh (`scenery-b20.js:425-434`): sàn ngang 6 m, dọc 4 m, cùng cao 2,3 m; 4 cọc buộc thuyền r 0,16 m cao quá sàn 0,9 m có cuộn dây; thang xuống lúc nước ròng ở mép ngoài. Cọc dài 4 m như L16.

PROMPT (dán thẳng):
```text
T-shaped wooden pier head 6 m wide and 4 m deep: deck of brown boards on round dark log piles 4 m long, four tall mooring posts at the corners with coils of dark rope, a wooden ladder hanging down the front edge. Isolated single object, no water, no people. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 0,6–1k gửi Meshy; trong game ≤ 426 mỗi đầu bến như code (sàn, cọc, cuộn dây 276 cộng thang 150; hai đầu bến trong `b20-statics`). **Symmetry: bật.**

### L18 · ENV_ben_go · Bến gỗ nhỏ (B15)

Dùng ở B15 và Tự do: 4 bến gỗ bờ bắc dài 8–12 m (`scenery.js:209-214`, gọi ở `scenery.js:222`). Thay ván 2,4 × 1,0 m dày 0,12 m cách 1,1 m, lệch nhẹ, hai màu xen; cọc r 0,12–0,14 m dài 3 m mỗi 3,3 m hai bên; sàn cao 0,95 m. Mẫu dài 10 m, bước nướng co giãn theo chiều dài. Thuyền nan đậu ở đầu bến là mục K8.

PROMPT (dán thẳng):
```text
Small 13th-century wooden river jetty 10 m long and 2.4 m wide: loose, slightly uneven brown plank deck about 1 m up, resting on pairs of round dark log piles 3 m long every 3.3 m. Isolated single object, no water, no people. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 0,5–1k. **Symmetry: bật.**

### L19 · ENV_khan_dai · Gian khán đài Võ trường

Dùng ở Võ trường và màn hướng dẫn (cảnh đầu tiên người chơi mới thấy): 10 gian, hai dãy năm gian quay vào sân (`scenery.js:959-977`). Thay mỗi gian: 3 bậc ván rộng 6 m sâu 1,6 m, mặt bậc ở 0,5 / 1,1 / 1,7 m; 4 cột son sẫm cao 4,6 m (x ±2,9; z 0,6 và −4,2); khung then; mái hai dốc ngói son, dải vàng ở nóc 5,55 m. Lính khán giả ngồi đúng mặt bậc (`spectatorSpots`, `scenery.js:970-975`), nên chiều cao và độ sâu bậc phải giữ. Mỗi gian là lưới riêng tự mờ khi chắn camera (`world.addFadeable`, r 3,2). Doanh trại luyện quân lâu dài nên mái ngói hợp (Hư cấu).

PROMPT (dán thẳng):
```text
One 6 m wide bay of a wooden spectator stand at a 13th-century Vietnamese army training ground: three stepped plank tiers 1.6 m deep with tops at 0.5, 1.1 and 1.7 m, four round dark red columns 4.6 m tall, gabled roof of vermilion clay tiles with a gold ridge band, ridge 5.5 m, open front and sides. Isolated single object, no people. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 0,8–1,5k (code khoảng 180). **Symmetry: bật.**

### L20 · ENV_dai_chi_huy · Đài chỉ huy Võ trường

Dùng ở Võ trường (`scenery.js:980-990`, va chạm r 4,2). Thay bệ gỗ 7 × 6 m cao 1,8 m, mặt ván nâu sẫm, 5 bậc ở góc trước trái, lan can son sẫm hai bên, ghế son mặt vàng, lọng vàng trên cán then ngay trên ghế (cán ở z −1,1, ghế z −1,6; tán Ø 3,8 m, đỉnh khoảng 6,3 m; `scenery.js:985-986`), giá trống hai trụ 1,2 m bên phải (`scenery.js:988`). Trống đồng là mục M12, bước nướng đặt lên giá trống của mẫu này (code: x 2,2, z 1,2).

PROMPT (dán thẳng):
```text
Reviewing dais of a 13th-century Vietnamese army training ground: solid brown timber platform 7 by 6 m and 1.8 m high with a dark brown plank top, a stair of five steps at the front left corner, dark red railings along both sides, a vermilion lacquered seat with a gold top near the back, a golden ceremonial parasol with a short fringe on a black pole above the seat, top 6.3 m, a low two-post drum stand on the right side. No drum. Isolated single object, no people. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 1,5–2,5k (code khoảng 250). **Symmetry: tắt** (bậc ở góc trước trái, giá trống bên phải).

### L21 · ENV_lau_trong · Lầu trống Võ trường

Dùng ở Võ trường: hai lầu ngoài rào (`world.js:591-597`). Thay 4 cột vuông 0,25 m cao 7 m cách 3 m, sàn 4 × 4 m ở khoảng 7 m, trống son nằm ngang Ø 2 m dài 1,2 m trên sàn, mái chóp bốn mặt son tới khoảng 10 m.

PROMPT (dán thẳng):
```text
Wooden drum tower 10 m tall: four tall square brown posts 3 m apart, square plank platform 4 m wide at 7 m height, a large vermilion barrel drum 2 m across lying on its side on the platform, four-sided roof of vermilion tiles above. Isolated single object, no people. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 1–2k (code khoảng 120). **Symmetry: bật.**

### L22 · ENV_mieu · Miếu làng (tuỳ chọn)

Chưa có trong game. Mốc mới cạnh cây đa đầu làng (làng ở `world.js:253-260`), tránh chỗ bó Mũi tên thư (`scenery.js:304`). Miếu nhỏ hợp thế kỷ 13 hơn đình (đình làng phần lớn có từ thế kỷ 16). 3 × 3 m, cao 3 m **(đề xuất)**.

PROMPT (dán thẳng):
```text
Small 13th-century Vietnamese village shrine, 3 by 3 m and 3 m tall: low brick base with three steps, four dark wooden columns, hipped roof of dark clay tiles with gently upturned corners, a plain stone altar table inside. No statue, no text. Isolated single object, no people. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 0,8–1,5k. **Symmetry: bật.**

---

## M. Đạo cụ cảnh (môi trường)

Quy ước chung ở đầu mục K. Phần lớn đạo cụ trên hai làn đánh B15 được gộp vào hai lưới (`laneBig` có shader nhìn xuyên và đổ bóng, `laneSmall`; `scenery.js:873-874`), còn lại vào lưới tĩnh của trận; bước nướng phải gộp mẫu vào đúng lưới đó. Chỗ đặt và độ ngẫu nhiên (cọc nghiêng, gãy, đổ, khúc vỡ) code vẫn quyết. Không máu, không thương tích (`systems.md:700`, `scenery.js:438`). Mô-đun lặp dọc lũy, rào, làn đánh (M5–M8, M10) có ngân sách trong game mỗi khúc ở phần Kỹ thuật.

**Vật code dựng mà không có mục riêng** (dùng tệp có sẵn, hoặc giữ code):

- Dấu chiến trận B15 (`scenery.js:238-253`, thêm ở `scenery.js:862-864`): giáo cắm đất (tới 290 cây) dùng `wpn_giao-dv`; bó tên cắm (tới 390 bó) dùng `prop_mui-ten`; khiên rơi (tới 190, code nhuộm theo phe) dùng `wpn_khien-tron-ng` hoặc `wpn_khien-nhat-dv`; cung rơi cạnh xác ngựa (`scenery.js:414-421`) dùng `wpn_cung-ng`, ống tên rơi là PROP_ong_ten. Bước nướng gộp vào đúng InstancedMesh đang có, giữ ngân sách gần code (giáo 24, bó tên 60, khiên 60 tam giác); không giảm được tới đó thì giữ code.
- Mũi giáo gãy trong hố ngập (`scenery.js:671-678`) và cờ đổ nằm đất (`scenery.js:837-849`): giữ code (vài chục tam giác, nằm sát đất).
- Cờ rách trên cán 3,3 m mũi sắt ở lũy Nguyên (`scenery.js:473-478`) và cán cờ đuôi nheo quân Trần (`scenery.js:619-624`): cán dùng M34 co lại, vải cờ code vẽ.
- Cọc hào thành (`scenery.js:643-651`: cọc đơn dài 1,5–1,95 m, ngả 0,55–0,85 rad về phía hào, mũi gỗ mới): dùng một cọc tách từ M6, hoặc giữ code; khúc M6 3 m ngả khoảng 20° không hợp.
- Cổng bản doanh B20 (`scenery-b20.js:490-493`: hai cột son sẫm r 0,2 m cao 5,2 m, xà son có dải vàng; cờ do `flagBatch`): giữ code, vài chục tam giác.
- Cán cờ ngoài M34: cờ nhiệm vụ Tự do và cờ sáu chữ H35 cắm khi dùng kỹ năng dùng M34 co và nhuộm (ghi ở M34); cán cờ B20 cũng vậy (bến `scenery-b20.js:443`, tháp `scenery-b20.js:468`, cờ lệnh có núm vàng `scenery-b20.js:499`, cờ "陳" `scenery-b20.js:503`); que cờ trên đỉnh hai cột cổng bản doanh (`scenery-b20.js:492`) giữ code cùng cổng.
- Thủy chiến B20 (`naval.js:990-1012`): ván bắc giữa hai thuyền, xích sắt Liên Hoàn nối mạn, cầu lên thuyền mắc cạn có bậc và tay vịn: giữ code (mặt đi được của `naval.js`, hoặc thanh mảnh); đồ vỡ dưới chân cầu (hai thùng, một cột buồm gãy) dùng M15, M16 hoặc giữ code.
- Mây của `addSky` (`scenery.js:899-943`) và `addSkyKit` (`kit.js:197-245`): giữ code (khoảng 240 tam giác mỗi đám, 12–14 đám mỗi cảnh, một InstancedMesh).


| # | Mã | Tệp | Tên | Nhóm | Tam giác | Kích thước thật (nướng về số này) | Thay cho (code) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 96 | ENV_coc_bach_dang | `env_coc-bach-dang.glb` | Cọc Bạch Đằng | M | 300–600 | khối đơn vị cao 1, bán kính 1 như `stakeGeo` (game co: dài 1,65–2,25 m, bán kính vẽ 0,12–0,45 m) | `stakeGeo(false)` |
| 97 | ENV_coc_gay | `env_coc-gay.glb` | Cụm cọc gãy | M | 300–800 | cụm 1,5 m, cọc 0,4–1,2 m | `stakeGeo(true)`, cọc gãy chỗ vỡ lũy |
| 98 | ENV_be_co | `env_be-co.glb` | Bè cỏ ngụy trang | M | 0,8–1,5k | 10 × 6 m, sàn 0,25 m | `raftGeo` |
| 99 | ENV_go_chan_song | `env_go-chan-song.glb` | Khúc gỗ phao chặn luồng | M | 300–600 | dài 5,2 m, Ø 0,68 m | `boomLogGeo` |
| 100 | ENV_cu_ma | `env_cu-ma.glb` | Cự mã | M | 300–800 | dài 3,4 m, cao 1,6 m | `chevalGeo` |
| 101 | ENV_coc_luy_nguyen | `env_coc-luy-nguyen.glb` | Hàng cọc lũy Nguyên (khúc 3 m) | M | 300–800 | 3 m, cọc 1,8–2,1 m | cọc đỉnh lũy `rampart` |
| 102 | ENV_ke_van | `env_ke-van.glb` | Tấm kè ván mái lũy | M | 300–600 | 2 × 2,5 m | kè ván `rampart` |
| 103 | ENV_coc_tre_tran | `env_coc-tre-tran.glb` | Hàng cọc tre ụ đất quân Trần (khúc 3 m) | M | 300–600 | 3 m, cọc 1,25–1,7 m | cọc tre `earthwork` |
| 104 | ENV_ho_chong | `env_ho-chong.glb` | Cụm chông hố chông | M | 300–800 | Ø 3,2 m (0,66 × bán kính hố 2,3–2,6 m), chông 0,65–1,05 m | chông và phên hố `chong` |
| 105 | ENV_rao_tre | `env_rao-tre.glb` | Rào ruộng tre chẻ (khúc 4 m) | M | 300–600 | 4 m, cột 1,2 m | `raoRuong` |
| 106 | ENV_trong_tran | `env_trong-tran.glb` | Trống trận trên giá | M | 0,5–1k | Ø 1,9 m, mặt trống cao 2,1 m | `drumParts` |
| 107 | ENV_trong_dong | `env_trong-dong.glb` | Trống đồng Đông Sơn | M | 0,5–1k | nướng về Ø 1,9 m như game (cao khoảng 1,4 m; trống thật Ø 0,8 m) | trống trên đài chỉ huy |
| 108 | ENV_gia_binh_khi | `env_gia-binh-khi.glb` | Giá binh khí | M | 400–800 | rộng 2,4 m, giáo 2,8 m | `rackParts`, giá Võ trường |
| 109 | ENV_gia_cheo | `env_gia-cheo.glb` | Giá mái chèo | M | 300–600 | rộng 2 m, chèo 2,6 m | giá chèo bến B20 |
| 110 | ENV_hom_go | `env_hom-go.glb` | Hòm gỗ | M | 300–500 | 0,9 × 0,75 × 0,9 m | hộp `#7a6040` |
| 111 | ENV_thung_go | `env_thung-go.glb` | Thùng gỗ | M | 300–500 | Ø 0,8 m, cao 0,9 m | trụ `#6a4a2a` |
| 112 | ENV_bao_gao | `env_bao-gao.glb` | Đống bao gạo | M | 300–600 | 1,2 × 1,2 m, cao 0,6 m | hàng trên xe |
| 113 | ENV_xe_luong | `env_xe-luong.glb` | Xe lương | M | 0,6–1,2k | sàn 1,6 × 2,8 m, bánh Ø 1,2 m, càng 2,2 m; xe Tự do thân 1,5 × 2,4 m, mũi càng ở z 2,7 | `cart`, `cartMesh` |
| 114 | ENV_xe_luong_vo | `env_xe-luong-vo.glb` | Xe lương đổ vỡ | M | 0,6–1,2k | như xe lương | `cart(…, broken)` |
| 115 | ENV_bep_lua | `env_bep-lua.glb` | Bếp lửa trại | M | 300–800 | Ø 1,9 m | đống lửa tàn, bếp nấu B20 |
| 116 | ENV_vac_lua | `env_vac-lua.glb` | Vạc lửa | M | 300–800 | cao 2,2 m, miệng Ø 1,4 m | chân, bát, vành vạc |
| 117 | ENV_bia_da | `env_bia-da.glb` | Bia đá Sát Thát (mặt trơn) | M | 300–600 | cao 3,6 m, thân 1,4 × 2,8 × 0,45 m | thân, đế, mũ bia |
| 118 | ENV_bia_rom | `env_bia-rom.glb` | Bia bắn cung | M | 300–800 | Ø 2 m, đỉnh 2,8 m | bia trường bắn |
| 119 | ENV_hinh_nom | `env_hinh-nom.glb` | Hình nộm rơm | M | 300–600 | cao 2,3 m | hình nộm Võ trường |
| 120 | ENV_so_dat | `env_so-dat.glb` | Sọt đất | M | 300–500 | Ø 0,6 m, cao 0,45 m | `basket` |
| 121 | ENV_xac_ngua | `env_xac-ngua.glb` | Xác ngựa nằm | M | 1,5–3k | dài 4 m kể cả đuôi | `horseGeo` |
| 122 | ENV_mu_nguyen_roi | `env_mu-nguyen-roi.glb` | Mũ trụ Nguyên rơi | M | 300–600 | Ø 0,42 m, cao 0,35 m | `helmNg` |
| 123 | ENV_non_tre_roi | `env_non-tre-roi.glb` | Nón tre quân Trần rơi | M | 300–500 | Ø 0,64 m, cao 0,15 m | `helmDv` |
| 124 | ENV_bo_rom | `env_bo-rom.glb` | Bó rơm | M | 300–500 | dài 0,8 m, Ø 0,64 m | `bale` |
| 125 | ENV_coc_buoc_ngua | `env_coc-buoc-ngua.glb` | Cọc buộc ngựa | M | 300–500 | dài 3 m, cao 1,2 m (lặp mỗi 3 m, chung cọc) | cọc buộc ngựa B15 |
| 126 | ENV_luoi_phoi | `env_luoi-phoi.glb` | Lưới phơi trên cọc | M | 300–600 | 3 × 1,8 m | giàn lưới bờ sông B15 |
| 127 | ENV_phao_moc | `env_phao-moc.glb` | Phao mốc luồng Nguyên | M | 300–500 | cao 3,6 m, phao Ø 0,9 m | `buoyGeo` |
| 128 | ENV_toi_neo | `env_toi-neo.glb` | Tời neo phao chặn luồng | M | 0,5–1k | 2,4 × 1 m, cọc cao 1,6 m trên mặt đất | tời đầu nam phao |
| 129 | ENV_cot_co | `env_cot-co.glb` | Cột cờ (không vải) | M | 300–500 | cao 9 m (game 6–12 m) | cán cờ `flagPole`, cờ Võ trường |
| 130 | ENV_co_duoi_ngua | `env_co-duoi-ngua.glb` | Cờ đuôi ngựa Mông Cổ (tug) | M | 300–600 | cao 4,4 m | `tug` |
| 131 | ENV_coc_troi | `env_coc-troi.glb` | Cọc trói tù binh | M | 300–500 | cao 2 m | mới (nay không có hình) |
| 132 | ENV_bo_ten_thu | `env_bo-ten-thu.glb` | Bó Mũi tên thư | M | 300–500 | cao 1,2 m | bó tên Kế Sách |

### M1 · ENV_coc_bach_dang · Cọc Bạch Đằng

Dùng ở B20: khoảng 900 cọc ở ba bãi M1–M3, lộ ra khi nước ròng pha 4–6 (`scenery-b20.js:233-240`, đặt ở `scenery-b20.js:364-370`, bố trí `scenery-b20.js:53-75`, bãi ở `river-b20.js:37-41`). Thay `stakeGeo(false)`: trụ 5 cạnh hở có mũi vạt, 25 tam giác, đơn vị cao 1 bán kính 1, code co theo từng cọc (bán kính vẽ 0,12–0,45 m, đã phóng 2,4 lần để đọc được từ máy quay trận; dài 1,65–2,25 m; nghiêng). Chính sử và khảo cổ: cọc gỗ lớn vạt nhọn, **không bịt sắt**, Ø 10–30 cm, dài 1,5–3 m (`scenery-b20.js:6-8`); 3d-ref ghi dài 3–4 m là lệch. Một cọc đơn, không phải cụm 7 cọc: thuyền mắc cọc tính theo từng cọc (`river-b20.js:45`). Dải màu theo độ cao (rêu ướt dưới, gỗ sáng trên, mũi gỗ mới) code tô lại được bằng `colorByY`.

PROMPT (dán thẳng):
```text
One hewn ironwood river stake, 2 m long and 25 cm thick, roughly round, the top cut by axe into a four-sided point, no iron cap, dark wet mud band at the bottom, bark patches, pale fresh wood at the point. Standing upright. Isolated single object, no water. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 300–600 gửi Meshy; trong game ≤ 25 mỗi cọc như code (810 cọc nguyên, cộng 90 cọc gãy M2); cao hơn chỉ khi có LOD gần, xa (đầu mục K), không thì giữ code. Bước nướng đưa mẫu về đúng khối đơn vị của `stakeGeo` (cao 1, bán kính 1, gốc ở chân), không về 2 m × 0,25 m: instance nhân thẳng (r·2,4; L; r·2,4) (`scenery-b20.js:232-235`, `scenery-b20.js:370`), nướng về số thật thì cọc ra dài 3,3–4,5 m, mảnh 0,03–0,11 m. **Symmetry: tắt.**

### M2 · ENV_coc_gay · Cụm cọc gãy

Dùng ở B20 cho cọc gãy (`stakeGeo(true)`, khoảng 10% số cọc, `scenery-b20.js:233-240`) và ở B15 cho chỗ vỡ lũy Nguyên: gốc cọc gãy hai mép, cọc đổ ngổn ngang (`scenery.js:570-588`). Cụm 5 cọc gãy cao 0,4–1,2 m trong khoảng 1,5 m. Ở B20 code đặt từng cọc gãy riêng, nên bước nướng tách cụm ra từng cọc, mỗi cọc về khối đơn vị cao 1, bán kính 1 như M1, hoặc dùng cả cụm ở chỗ cọc dày.

PROMPT (dán thẳng):
```text
Cluster of five thick dark wooden river stakes snapped and splintered at different heights, 0.4 to 1.2 m tall, leaning at angles in a patch 1.5 m wide, pale splinters at the breaks, mud-stained bases. Isolated single object, no water. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 300–800 gửi Meshy; trong game ≤ 29 mỗi cọc gãy như code ở B20 (90 cọc); ở B15 cọc gãy nằm trong lưới làn đánh, giữ số code. **Symmetry: tắt.**

### M3 · ENV_be_co · Bè cỏ ngụy trang

Dùng ở B20: 3 bè neo dây trên bãi cọc ở pha 3, chặt dây thì bè trôi (`scenery-b20.js:255-266`, neo ở `scenery-b20.js:373-392`). Bè còn là sàn đi được của `naval.js`, nên cỡ phải đúng `RAFT` 10 × 6 m, sàn cao 0,25 m trên mặt nước (`river-b20.js:47`; 3d-ref ghi 6 × 3 m là sai). Thay 7 cây tre dọc theo chiều 10 m (Ø 0,38 m, cách nhau 0,85 m, trải hết bề rộng 6 m; `scenery-b20.js:257-258`), 3 đòn ngang, 12 đống cỏ, lau khô. Code giữ dây neo, trôi, mờ. Bè cỏ và việc chặt dây cho bè trôi là Hư cấu (`scenery-b20.js:6-7`).

PROMPT (dán thẳng):
```text
Floating decoy raft 10 m long and 6 m wide: seven thick pale bamboo poles spaced evenly across the 6 m width, lengthwise, three dark wooden cross beams on top, heaped bundles of cut green grass and dry reeds covering most of the deck, rope ties at the corners. Flat and low. Isolated single object, no water, no people. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 0,8–1,5k gửi Meshy; trong game ≤ 390 mỗi bè như code (387, 3 bè). Gốc ở mặt nước. **Symmetry: tắt.**

### M4 · ENV_go_chan_song · Khúc gỗ phao chặn luồng

Dùng ở B20: phao gỗ chặn luồng của Nguyễn Khoái ở x 840, 30 khúc nổi theo con nước, hiện từ pha 2 (`scenery-b20.js:277-283`, đặt ở `scenery-b20.js:394-397`; `SCN.boom.log` 5,2 m ở `scenery-b20.js:41`). Thay thân gỗ 7 cạnh dài 5,2 m, r 0,34 m, hai đai dây gần hai đầu, một dây chạy dọc lưng. Một khúc đơn, không phải đoạn 12 m ba khúc như 3d-ref: mỗi khúc nổi riêng. Gốc ở tâm, thân dọc trục X cục bộ (bước nướng đặt lại). Code giữ neo và tời (mục M33).

PROMPT (dán thẳng):
```text
One log of a river boom: straight bark-covered tree trunk 5.2 m long and 68 cm thick lying horizontally, a dark rope band wrapped near each end, one thick rope running along the top from end to end. Isolated single object, no water. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 300–600 gửi Meshy; trong game ≤ 70 mỗi khúc như code (68, 30 khúc). **Symmetry: bật.**

### M5 · ENV_cu_ma · Cự mã

Dùng ở B15 và Tự do: hàng cự mã của quân Nguyên trên hai làn đánh, mỗi khúc khoảng 3,4 m, 34 khúc (8 hàng `cu_ma` trong `LANE_TERRAIN.fences`, `game/js/data/terrain-b15.js:52`; mỗi hàng chia round(L / 3,4) khúc ở `scenery.js:779`; dựng ở `scenery.js:761-792`). Thay `chevalGeo`: súc gỗ vỏ cây r 0,13 m nằm ngang ở cao 0,8 m, cọc vót xuyên chéo thành cặp chữ X mỗi 0,6 m, mỗi cọc dài 2,3 m (tổng cao khoảng 1,6 m). Code giữ đặt theo hàng, khúc đổ, khúc gãy bớt cọc, khúc chúi xuống hố, và gộp vào `laneBig`. 3d-ref ghi 4 m là lệch.

PROMPT (dán thẳng):
```text
Wooden cheval-de-frise barrier 3.4 m long and 1.6 m high: one horizontal bark-covered log beam 26 cm thick, pierced by sharpened stakes crossing in X pairs every 60 cm along its length, pale fresh-cut points, rope lashings. Isolated single object, no people. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 300–800 gửi Meshy; trong game ≤ 150 mỗi khúc như code (súc gỗ 24 cộng năm cặp cọc chéo × 24; 34 khúc ≈ 4.900). Giảm tới đó mà hỏng dáng thì giữ code. **Symmetry: bật.**

### M6 · ENV_coc_luy_nguyen · Hàng cọc lũy Nguyên (khúc 3 m)

Dùng ở B15 và Tự do: hàng cọc nhọn trên đỉnh lũy Nguyên (`scenery.js:491-511`): cọc dài 1,8–2,1 m (vài cọc 2,3 m), r 0,075 m, cách khoảng 0,4 m, ngả về phía tây khoảng 21° (0,37 rad), hai nẹp dây ở 0,75 và 1,45 m. Mẫu một khúc 3 m (8 cọc). Code giữ chỗ vỡ (gốc cọc gãy, cọc đổ), cờ, tên cắm mái trước, và gộp vào `laneBig`. Kè mái trước là mục M7.

PROMPT (dán thẳng):
```text
Section of a field-rampart stake row 3 m long: eight sharpened log stakes 1.9 to 2.1 m long and 15 cm thick set in a line 40 cm apart, all tilted forward about 20 degrees from vertical, tied by two rope bands, pale fresh-cut points. Isolated single object, no ground, no people. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 300–800 gửi Meshy; trong game ≤ 120 mỗi khúc 3 m (khoảng 41 khúc trên 124 m đỉnh lũy ≈ 4.900, gần code). Giảm tới đó mà hỏng dáng thì giữ code. **Symmetry: tắt** (cọc ngả một phía).

### M7 · ENV_ke_van · Tấm kè ván mái lũy

Dùng ở B15 và Tự do: kè mái trước lũy Nguyên, chia khoang dài 1,4–2,4 m (`scenery.js:513-557`): ván rộng 0,16–0,34 m, khe hở không đều, tấm gãy, tấm tuột, nẹp ngang buộc; ván cũ nâu xám `#5c4f3f`…`#6b5b47`. Mẫu một tấm phẳng 2 × 2,5 m; code uốn tấm theo mái lũy (`hug`, `scenery.js:389-401`) và chọn khoang ván, phên hay trống.

PROMPT (dán thẳng):
```text
Weathered wooden revetment panel 2 m wide and 2.5 m long lying flat: uneven grey-brown planks of different widths with gaps, one plank broken short, held by two dark lashed cross battens. Isolated single object, no people. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 300–600 gửi Meshy; trong game ≤ 40 mỗi tấm (tấm phẳng, code uốn theo mái). Giảm tới đó mà hỏng dáng thì giữ code. **Symmetry: tắt.**

### M8 · ENV_coc_tre_tran · Hàng cọc tre ụ đất quân Trần (khúc 3 m)

Dùng ở B15 và Tự do: cọc tre vót trên ụ đất quân ta, chĩa về phía quân Nguyên (`scenery.js:593-598`): cọc dài 1,25–1,7 m, r 0,045 m, cách 0,5 m, ngả 29–45° (0,5–0,78 rad), tre xanh vàng `#9aa252`, mũi `#d8cf8e`. Mẫu một khúc 3 m (6 cọc). Sọt đất (M25) và khiên nhật dựng tựa (tệp vũ khí `wpn_khien-nhat-dv`) code đặt riêng.

PROMPT (dán thẳng):
```text
Row of sharpened bamboo stakes 3 m long: six green-yellow bamboo poles 1.3 to 1.7 m long cut to sharp pale points, set 50 cm apart in a line and all tilted forward about 35 degrees from vertical. Isolated single object, no ground, no people. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 300–600 gửi Meshy; trong game ≤ 90 mỗi khúc 3 m (khoảng 20 khúc ≈ 1.800). Giảm tới đó mà hỏng dáng thì giữ code. **Symmetry: tắt** (cọc ngả một phía).

### M9 · ENV_ho_chong · Cụm chông hố chông

Dùng ở B15 và Tự do: bốn hố chông trên làn đánh, bán kính 2,4 / 2,6 / 2,3 / 2,4 m (`terrain-b15.js:40-43`; dựng ở `scenery.js:681-693`): chông tre cao 0,65–1,05 m, round(8 × bán kính) cây (18–21 cây) rải trong bán kính 0,66 lần bán kính hố, tức vùng chông rộng 3,0–3,4 m; vài cây gãy; tấm phên che hố bị giẫm sụt rộng 1,3 m, dài khoảng 2 m (từ 1,12 tới 0,3 lần bán kính), vắt một mép. Lòng hố là địa hình do code dựng; mẫu chỉ có chông và tấm phên, Ø 3,2 m. Bước nướng co XZ theo từng hố (1,32 × bán kính), giữ Y để chông vẫn cao như code.

PROMPT (dán thẳng):
```text
Bamboo spike trap: about twenty sharpened pale bamboo spikes 0.7 to 1 m tall standing in a round cluster 3.2 m wide, a few broken short, and a sagging woven bamboo cover mat 1.3 m wide and 2 m long propped across one side. Isolated single object, no hole, no people. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 300–800 gửi Meshy; trong game ≤ khoảng 260 mỗi hố như code (chông 12 tam giác mỗi cây cộng hai tấm phên). **Symmetry: tắt.**

### M10 · ENV_rao_tre · Rào ruộng tre chẻ (khúc 4 m)

Dùng ở B15 và Tự do: rào ruộng trên làn đánh (`scenery.js:719-757`): cột tre chẻ cao 1,15–1,35 m mỗi 2 m, hai thanh ngang cách đất 0,42 và 0,82 m, tre vàng nhạt `#c2ae6c`. Mẫu một khúc 4 m (3 cột, 2 thanh). Code giữ cột xiêu, cột đổ, thanh tuột, đoạn vỡ.

PROMPT (dán thẳng):
```text
Field fence section 4 m long: three split-bamboo posts 1.2 m tall, two horizontal split-bamboo rails at 40 and 80 cm height, pale straw-colored bamboo, simple cord lashings. Isolated single object, no ground, no people. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 300–600 gửi Meshy; trong game ≤ 60 mỗi khúc 4 m (khoảng 70 khúc trên 282 m rào ruộng ≈ 4.200, gần code). Giảm tới đó mà hỏng dáng thì giữ code. **Symmetry: bật.**

### M11 · ENV_trong_tran · Trống trận trên giá

Dùng ở B20: trống trận trong bản doanh (`scenery-b20.js:298-302`, đặt ở `scenery-b20.js:512`). Trống báo trên hai tháp canh là thùng nằm ngang không giá (`scenery-b20.js:467`), đã gồm trong mẫu tháp L6, không dùng mẫu này. Thay thân trống gỗ nâu `#6a5a3a` Ø 1,9 m dày 0,95 m dựng đứng, mặt da `#8f7a4a` quay lên, núm vàng giữa mặt ở cao 2,1 m, trên giá hai trụ 1,1 m và đòn ngang 1,9 m ở cao 1,05 m: giá cao khoảng nửa tổng chiều cao. Thân nâu, không son (3d-ref ghi son là lệch với game). Code không có dùi trống nên prompt không xin.

PROMPT (dán thẳng):
```text
Large 13th-century Vietnamese war drum on a stand: barrel drum 1.9 m across and 95 cm deep standing upright with its hide head facing up, brown wood body with rows of brass studs, a gold boss in the centre of the head 2.1 m above the ground, set on a 1.1 m tall two-post wooden stand with a crossbar. Isolated single object, no people. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 0,5–1k gửi Meshy; trong game ≤ 152 như code (trong `b20-statics`). **Symmetry: bật.**

### M12 · ENV_trong_dong · Trống đồng Đông Sơn

Dùng ở Võ trường: trống đồng trên giá cạnh ghế đài chỉ huy (`scenery.js:987-988`). Code vẽ đúng khối của trống trận: Ø 1,9 m, cao 0,9 m, mặt có núm vàng. Trống đồng Đông Sơn thật (loại Heger I như trống Ngọc Lũ) rộng khoảng 0,8 m, cao 0,6 m; prompt theo tỉ lệ trống thật; bước nướng phóng đều tới Ø 1,9 m như khối code, giữ cỡ nhìn từ xa của game và vừa giá trống hai trụ của đài L20 (`scenery.js:988`). Không thay khít khối code: trống code cao 0,9 m, mẫu phóng đều cao 1,43 m, là chủ ý; ép Y về 0,9 m thì trống bẹt mất dáng Đông Sơn. Mặt trống vì thế cao hơn code khoảng 0,5 m; chỗ ấy không có va chạm, không ai đứng. Mặt trống có ngôi sao giữa và các vành hoa văn hình học; bỏ cảnh người, chim cho gọn ở cỡ game. Đặt trống trên đài là Hư cấu.

PROMPT (dán thẳng):
```text
Dong Son bronze drum, about 80 cm across and 60 cm tall, dark green-brown bronze, flat top with a raised twelve-pointed star in the centre and concentric bands of simple geometric rings, slightly bulging upper body, straight waist, flared foot, four small side handles. Isolated single object, no stand. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 0,5–1k. **Symmetry: bật.**

### M13 · ENV_gia_binh_khi · Giá binh khí

Dùng ở B20 (2 giá hai bên đường vào bản doanh, `scenery-b20.js:304-308`, đặt ở `scenery-b20.js:513`) và Võ trường (6 giá, `world.js:585-588`, hiện nay chỉ là một đòn ngang 3 m trên một trụ). Thay hai trụ 1,6 m, đòn ngang 2,4 m ở 1,45 m, 5 ngọn giáo dài 2,8 m dựng nghiêng, gỗ nâu (3d-ref ghi sơn then là lệch). Giáo trong giá code không có tua nên prompt cũng không.

PROMPT (dán thẳng):
```text
Brown wooden weapon rack 2.4 m wide: two square posts 1.6 m tall and a crossbar near the top, five plain spears 2.8 m long with grey steel heads leaning against it side by side. Isolated single object, no people. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 400–800 gửi Meshy; trong game ≤ 156 mỗi giá như code ở B20 (2 giá trong `b20-statics`). Ở Võ trường code chỉ là một đòn và một trụ (24 tam giác): ở đó là vật đơn lẻ nhìn gần, phần tăng tính vào tổng Võ trường. **Symmetry: bật.**

### M14 · ENV_gia_cheo · Giá mái chèo

Dùng ở B20: giá ở gốc mỗi bến phục binh (`scenery-b20.js:438-440`): hai trụ 1,4 m, đòn 2,0 m ở 1,3 m, 4 mái chèo dài 2,6 m dựng nghiêng, gỗ `#8a6a44`.

PROMPT (dán thẳng):
```text
Brown wooden oar rack 2 m wide: two posts 1.4 m tall and a crossbar, four long wooden oars 2.6 m long leaning against it side by side, blades down. Isolated single object, no people. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 300–600 gửi Meshy; trong game ≤ 84 mỗi giá như code (2 giá trong `b20-statics`). **Symmetry: bật.**

### M15 · ENV_hom_go · Hòm gỗ

Dùng ở B15 và Tự do (hòm trong trại Nguyên bỏ ngoài thành, `scenery.js:270`) và B20 (5 hòm trong bản doanh, `scenery-b20.js:514`): hộp 0,9 × 0,7 × 0,9 m `#7a6040`, nắp viền then. Không chữ trên hòm.

PROMPT (dán thẳng):
```text
Plain wooden supply crate 90 cm wide and 70 cm tall, brown planks, black lacquer lid rim, bound with rope around the middle. No text. Isolated single object. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 300–500 gửi Meshy; trong game ≤ 24 mỗi hòm như code (hộp và nắp; 5 hòm B20 trong `b20-statics`, hòm B15 trong lưới tĩnh). **Symmetry: bật.**

### M16 · ENV_thung_go · Thùng gỗ

Dùng ở B15 và Tự do: thùng trong trại Nguyên bỏ (`scenery.js:271`): trụ 7 cạnh Ø 0,8 m cao 0,9 m `#6a4a2a`, đai then gần miệng.

PROMPT (dán thẳng):
```text
Wooden barrel 80 cm across and 90 cm tall, dark brown staves, a black hoop near the top and split-bamboo hoops below, closed lid. Isolated single object. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 300–500 gửi Meshy; trong game ≤ 56 mỗi thùng như code (thân và đai 7 cạnh). **Symmetry: bật.**

### M17 · ENV_bao_gao · Đống bao gạo

Dùng làm hàng trên xe lương (`scenery.js:258`: khối 1,2 × 0,6 × 1,2 m `#b09a6a`; xe Tự do `director-td.js:105`: 1,3 × 0,6 × 2,0 m) và đặt rời trong trại, trong lều lương (L9). Đống 5 bao gai màu rơm, không chữ.

PROMPT (dán thẳng):
```text
Small stack of five plump hemp rice sacks of coarse straw-colored cloth tied at the top, piled 1.2 m wide and 60 cm high. No text. Isolated single object. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 300–600. **Symmetry: tắt.**

### M18 · ENV_xe_luong · Xe lương

Dùng ở B15 (2 xe nguyên, `scenery.js:254-263`, va chạm r 1,4) và Tự do: xe là vật chơi được trong "Chặn tiếp tế" và "Hộ tống" (chạy theo đường, có máu, có người kéo; `director-td.js:102-110`, `director-td.js:271-284`, `director-td.js:375-403`). Thay sàn 1,6 × 2,8 m ở cao 0,8 m, thành thấp 0,5 m, một càng giữa dài 2,2 m, hai bánh Ø 1,2 m, đống hàng (bản B15). Xe Tự do hiện nay là 5 lưới riêng với 3 vật liệu mới mỗi xe (`cartMesh`, `director-td.js:102-110`: thân 1,5 × 0,7 × 2,4 m, bánh Ø 1 m, càng 1,6 m tới z 2,7); một GLB gộp bớt lượt vẽ. Xe ấy nhỏ hơn xe B15 và người kéo đứng ở `CART.hitch` + 0,6 = 2,4 m trước tâm xe (`director-td.js:26`, `director-td.js:284`, `director-td.js:395`), tức trong càng 2,2 m của bản B15 (mũi càng ở khoảng 3,5 m): bước nướng ra thêm một cỡ co về thân 1,5 × 2,4 m, mũi càng ở z 2,7, hoặc dời `CART.hitch` ra khoảng 3,3 m nếu dùng cỡ B15. Code nhuộm gỗ theo phe (`0x7a5634` xe hộ tống, `0x5a4a3a` xe lương địch, `director-td.js:279`, `director-td.js:379`): nướng màu gỗ thành màu đỉnh sáng để nhân được màu nhuộm. Bánh nan như xe thời Tống – Nguyên; code vẽ bánh đặc chỉ vì dựng bằng khối trụ. Bánh xe để bước nướng tách ra nếu muốn cho quay.

PROMPT (dán thẳng):
```text
Two-wheeled wooden supply cart, 13th century: flat plank bed 1.6 m wide and 2.8 m long with low side boards, two spoked wooden wheels 1.2 m across, one long central draw pole 2.2 m at the front, loaded with straw-colored hemp rice sacks under a rope net. Isolated single object, no animal, no people. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 0,6–1,2k (code khoảng 100–120). **Symmetry: bật.**

### M19 · ENV_xe_luong_vo · Xe lương đổ vỡ

Dùng ở B15 và Tự do: 4 xe hỏng trên bãi (`scenery.js:254-263`, nhánh `broken`: thân nghiêng 0,28 rad (khoảng 16°) quanh trục dọc và hạ 0,25 m, càng vẫn nguyên, một bánh rời nằm phẳng dưới đất ở x −1,6, không hàng). Cùng cỡ M18. Mẫu nghiêng sẵn về phía mất bánh, đầu trục trần tì thấp; code nghiêng ngược lại (phía còn bánh hạ xuống, bánh lún nửa vào đất), nên bước nướng đặt mẫu thẳng, không xoay thêm 0,28 rad.

PROMPT (dán thẳng):
```text
Broken two-wheeled wooden supply cart tilted about 15 degrees toward one side: plank bed 1.6 by 2.8 m with low side boards, one spoked wheel on the axle, the other wheel off and lying flat on the ground beside the low side, bare axle end resting low, intact central draw pole, no cargo. Isolated single object, no animal, no people. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 0,6–1,2k. **Symmetry: tắt.**

### M20 · ENV_bep_lua · Bếp lửa trại

Dùng ở B15 và Tự do (đống lửa tàn trong trại Nguyên bỏ, khói bốc từ đây; `scenery.js:274-278`: đĩa tro Ø 1,9 m và 4 khúc củi cháy), B20 (3 bếp nấu quanh bản doanh hiện nay chỉ có khói lửa, **không có hình**; `atmo-b20.js:63`) và Võ trường (đống củi cạnh lều, `scenery.js:1046`). Vòng đá, tro, củi cháy, ba hòn kê đỡ nồi đất. Lửa, khói vẫn là hiệu ứng.

PROMPT (dán thẳng):
```text
Camp hearth 1.9 m across: ring of grey stones around a bed of grey ash with crossed charred logs, three hearth stones at one side holding a blackened round clay pot. No flame, no smoke. Isolated single object, no people. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 300–800. **Symmetry: tắt.**

### M21 · ENV_vac_lua · Vạc lửa

Dùng ở Võ trường: 8 vạc, hai bên mỗi cổng (`scenery.js:1008-1021`). Thay chân then thon (r 0,12–0,2 m, cao 1,3 m), bát đồng `#7a5a2a` miệng Ø 1,4 m sâu 0,55 m, vành vàng: tổng cao khoảng 2,2 m. Một chân trụ, không phải ba chân (3d-ref ghi ba chân là lệch). Ngọn lửa nhảy theo thời gian code giữ.

PROMPT (dán thẳng):
```text
Standing fire brazier 2.2 m tall: slender black lacquer pedestal on a round foot, a wide dark bronze bowl 1.4 m across on top with a gold rim, filled with dark coals. No flame. Isolated single object, no people. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 300–800. **Symmetry: bật.**

### M22 · ENV_bia_da · Bia đá Sát Thát (mặt trơn)

Dùng ở Võ trường (`scenery.js:992-1006`): thân 1,4 × 2,8 × 0,45 m đứng trên đế 2,2 × 0,5 × 1,2 m, mũ 1,7 × 0,25 × 0,7 m, tổng cao khoảng 3,6 m (3d-ref ghi 2 m là lệch). Hai chữ 殺韃 và viền vẽ bằng CanvasTexture lên mặt bia (quân Trần thích chữ "Sát Thát" lên tay là Chính sử; tấm bia là Hư cấu), nên hai mặt bia để trơn hoàn toàn.

PROMPT (dán thẳng):
```text
Upright grey stone stele 3.6 m tall: plain flat slab 1.4 m wide, 2.8 m high and 45 cm thick, set in a rectangular stone base 2.2 m wide, a slightly wider flat stone cap on top. Both faces completely blank, no text, no carving. Isolated single object, no people. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 300–600 (code khoảng 36). **Symmetry: bật.**

### M23 · ENV_bia_rom · Bia bắn cung

Dùng ở Võ trường: 5 bia ở trường bắn (`scenery.js:1023-1031`): hai cột 2,2 m cách 1,2 m, bốn vòng Ø 2 / 1,5 / 1 / 0,5 m xen trứng sáo và son, tâm ở cao 1,8 m (đỉnh 2,8 m), ba mũi tên cắm. Vòng đồng tâm đỏ trắng trông hơi hiện đại (bia thế kỷ 13 thường là tấm vải hay da căng); giữ vòng như game (Hư cấu). Tên cắm code thêm bằng `prop_mui-ten`.

PROMPT (dán thẳng):
```text
Archery target, 13th century: round woven straw butt 2 m across painted with cream and vermilion rings, held upright between two wooden posts, top 2.8 m above the ground. No arrows. Isolated single object, no people. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 300–800. **Symmetry: bật.**

### M24 · ENV_hinh_nom · Hình nộm rơm

Dùng ở Võ trường: 6 hình nộm cạnh giá binh khí (`world.js:589`): thân trụ rơm r 0,3–0,35 m cao 1,5 m, đầu cầu r 0,3 m, tổng cao khoảng 2,3 m, màu rơm `#c8b070`. Code không có tay; mẫu cũng không thêm.

PROMPT (dán thẳng):
```text
Straw training dummy 2.3 m tall: thick bundle of straw-colored rice straw bound with dark rope bands into a body, a round straw head on top, set on a short wooden post. No arms. Isolated single object, no people. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 300–600. **Symmetry: bật.**

### M25 · ENV_so_dat · Sọt đất

Dùng ở B15 và Tự do: sọt đất trên đỉnh ụ đất quân ta, vài sọt chồng, vài sọt đổ (`scenery.js:408-410`, đặt ở `scenery.js:599-611`): sọt tre loe miệng Ø 0,6 m cao 0,42 m, nẹp vành và đai đáy sẫm, đất vun trên miệng.

PROMPT (dán thẳng):
```text
Woven bamboo basket 60 cm wide and 45 cm tall with a flaring mouth, dark binding bands at the rim and base, heaped to the brim with dark brown earth. Isolated single object. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 300–500. **Symmetry: bật.**

### M26 · ENV_xac_ngua · Xác ngựa nằm

Dùng ở B15 và Tự do: 16 xác ngựa trên làn đánh, quạ đậu quanh (`scenery.js:440-470`, đặt ở `scenery.js:802-820`). Thay `horseGeo`: nằm nghiêng, cổ và đầu sát đất, bốn chân duỗi cứng, dài khoảng 4 m từ mõm tới chóp đuôi (mõm z 2,1, chóp đuôi z −2,0; `scenery.js:441-459`). Code tô 6 màu lông và vải yên theo phe (phần lớn yên Nguyên chàm, thép, lông; vài con quân ta yên son viền vàng; `scenery.js:800-803`), nên vải yên để xám nhạt trơn để nhuộm; lông nâu ngựa, bước nướng đổi sắc. Không máu, không thương tích; tên cắm sườn code thêm bằng `prop_mui-ten`. Cũng có thể đặt tư thế nằm cho `mount_ngua-nguyen` khi rig; mẫu riêng này rẻ hơn khi gộp vào `laneBig`.

PROMPT (dán thẳng):
```text
Dead horse lying still on its side, about 4 m from nose to tail tip, legs stretched out stiff, head and neck flat on the ground, eyes closed, bay-brown coat, dark brown mane and tail, black hooves, a simple wooden saddle on a plain light grey saddle cloth. Clean coat, no blood, no wounds, no arrows. Isolated single object, no rider. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 1,5–3k. **Symmetry: tắt.**

### M27 · ENV_mu_nguyen_roi · Mũ trụ Nguyên rơi

Dùng ở B15 và Tự do: mũ rơi cạnh xác ngựa có kỵ sĩ và rải ở bãi giằng co, trước cổng (`scenery.js:406`, đặt ở `scenery.js:815`, `scenery.js:865`): chóp sắt xám bạc cao 0,32 m, vành lông Ø 0,42 m, khăn chàm che gáy. Mẫu đặt thẳng, vành ở gốc; code lật nghiêng.

PROMPT (dán thẳng):
```text
Dropped Mongol-Yuan soldier helmet, upright: pointed silver-grey steel bowl 32 cm tall, brown fur rim 42 cm across, a dark indigo cloth neck flap hanging at the back. Isolated single object, no head. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 300–600. **Symmetry: bật.**

### M28 · ENV_non_tre_roi · Nón tre quân Trần rơi

Dùng ở B15 và Tự do: nón của lính ta rơi trên bãi (`scenery.js:407`, đặt ở `scenery.js:866`): chóp nông Ø 0,64 m cao 0,15 m màu rơm `#b9a37a`, vòng đai then bên trong. Khác nón lá rời 84 cm của người lính Tự do (mục H5).

PROMPT (dán thẳng):
```text
Vietnamese soldier's straw hat, 13th century: shallow cone 64 cm wide and 15 cm tall of straw-colored woven bamboo, a black inner headband ring. Isolated single object, no head. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 300–500. **Symmetry: bật.**

### M29 · ENV_bo_rom · Bó rơm

Dùng ở B15 và Tự do: bó rơm nằm giữa đám rơm vãi trên bãi (`scenery.js:435`, đặt ở `scenery.js:835`): trụ 7 cạnh dài 0,8 m Ø 0,64 m màu rơm `#c2a560`, hai đai dây. Rơm vãi phẳng vẫn do code.

PROMPT (dán thẳng):
```text
Bundle of rice straw 80 cm long and 64 cm thick lying on its side, straw-colored, tied with two dark rope bands. Isolated single object. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 300–500. **Symmetry: bật.**

### M30 · ENV_coc_buoc_ngua · Cọc buộc ngựa

Dùng ở B15 và Tự do: 12 cọc dọc đường vào cổng Hàm Tử quan (`scenery.js:280-284`): trụ 0,14 m cao 1,2 m, thanh ngang 3 m ở cao 1,05 m. Code dựng thành chuỗi: mỗi đơn vị là một trụ và một thanh 3 m chìa từ trụ ấy sang chỗ trụ kế, sáu đơn vị mỗi bên đường (thanh cuối chìa quá trụ cuối). Mẫu hai trụ một thanh: bước nướng lặp mỗi 3 m, hai khúc liền nhau dùng chung một trụ (bỏ trụ trùng), khúc cuối giữ đủ hai trụ.

PROMPT (dán thẳng):
```text
Horse hitching rail: two square brown wooden posts 1.2 m tall standing 3 m apart with a straight wooden rail across the top. Isolated single object, no horse, no people. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 300–500. **Symmetry: bật.**

### M31 · ENV_luoi_phoi · Lưới phơi trên cọc

Dùng ở B15 và Tự do: 3 giàn lưới cạnh thúng câu trên bờ (`scenery.js:232-233`): hai cọc 1,8 m cách 3 m, tấm lưới 3 × 1,2 m `#5a5540`.

PROMPT (dán thẳng):
```text
Fishing net drying rack: two thin brown wooden poles 1.8 m tall standing 3 m apart, a dark olive-brown fishing net 3 m wide and 1.2 m high hanging between them, small wooden floats along the top cord. Isolated single object, no people. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 300–600. **Symmetry: bật.**

### M32 · ENV_phao_moc · Phao mốc luồng Nguyên

Dùng ở B20: 3 phao đánh dấu của đội dò luồng Nguyên (mốc cọc bị lộ), nổi theo nước (`scenery-b20.js:268-275`, đặt ở `scenery-b20.js:376-377`): phao gỗ Ø 0,9 m cao 0,5 m, sào then 3,4 m, chóp xám bạc, đuôi nheo chàm dài 1,6 m. Đuôi nheo là một tấm cứng trong code; Meshy dựng đuôi nheo hỏng thì bỏ, code vẽ lại.

PROMPT (dán thẳng):
```text
Channel-marker buoy: squat brown wooden float 90 cm across and 50 cm tall, a straight black lacquer pole 3.4 m tall rising from it with a small silver-grey iron cap, a 1.6 m long stiff dark indigo triangular pennant near the top. No text. Isolated single object, no water. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 300–500 gửi Meshy; trong game ≤ 62 mỗi phao như code (3 phao). Gốc ở mặt nước. **Symmetry: tắt** (đuôi nheo một phía).

### M33 · ENV_toi_neo · Tời neo phao chặn luồng

Dùng ở B20: đầu nam phao chặn luồng trên bờ (`scenery-b20.js:399-404`): hai cọc r 0,16 m cao 1,6 m trên mặt đất (chôn thêm 0,5 m, `scenery-b20.js:402`) cách 2,4 m, trục ngang Ø 0,6 m dài 2,2 m ở cao 1,1 m, cuộn dây, năm tay quay dài 1 m. Cụm ba cọc neo ở đầu bắc code giữ.

PROMPT (dán thẳng):
```text
Wooden rope windlass, 13th century: two thick upright brown posts 1.6 m tall and 2.4 m apart, a horizontal wooden drum 60 cm thick between them at 1.1 m height wound with dark rope, five wooden handspikes sticking out of the drum. Isolated single object, no people. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 0,5–1k gửi Meshy; trong game ≤ 172 như code (trong `b20-statics`). **Symmetry: tắt** (tay quay).

### M34 · ENV_cot_co · Cột cờ (không vải)

Dùng ở B15 và Tự do (khoảng 15 cột: bản doanh, đồn, doanh trại, cổng, Hàm Tử quan, cờ tuyến mặt trận; `world.js:206-217`, gọi ở `world.js:222-240`, `world.js:280`, `world.js:341-344`) và Võ trường (8 cột, `world.js:577-584`), cùng năm loại cán cờ B20 (bến 7,5 m, tháp canh 4,6 m trên sàn, cờ lệnh 12,8 m có núm vàng, hai cờ "陳" 8,7 m; `scenery-b20.js:443`, `scenery-b20.js:468`, `scenery-b20.js:499`, `scenery-b20.js:503`, then `PAL.then`). Thay cán then r 0,06–0,1 m cao 4,6–12,8 m; mẫu 9 m, bước nướng kéo Y theo từng cột. Cùng mẫu (co, nhuộm) cho cán cờ nằm ngoài hai chỗ trên: cờ nhiệm vụ Tự do (`flag` ở `director-td.js:93-100`, cán nâu `#4a3626` cao 6–8 m), cờ sáu chữ H35 cắm khi dùng kỹ năng (`plantFlag`, `director.js:756-763`, cán then 5 m), cán cờ rách và cờ đuôi nheo trên lũy (đầu mục M). Lá cờ, chữ trên cờ, lắc vải do code vẽ (`flagTexture`, `flagBatch`). Cờ B15 hiện ghi chữ quốc ngữ "TRẦN" (`world.js:222`), lệch thời đại so với chữ 陳 của B20 (`scenery-b20.js:520`): đó là việc của code, không thuộc mẫu này. Đế đá vuông nhỏ và núm vàng là **(đề xuất)**.

PROMPT (dán thẳng):
```text
Tall bare flagpole 9 m: slim straight black lacquer pole on a small square grey stone footing, a gold ball finial at the top. No flag, no cloth. Isolated single object, no people. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 300–500 gửi Meshy; trong game giữ số code: cán 5 cạnh 10 tam giác (B20 trong `b20-statics`; cán cờ lệnh có núm vàng 32), cán B15 và Võ trường là lưới riêng tự mờ khoảng 20. **Symmetry: bật.**

### M35 · ENV_co_duoi_ngua · Cờ đuôi ngựa Mông Cổ (tug)

Dùng ở B15 và Tự do: trên lũy Nguyên cạnh lối vỡ chính (`scenery.js:480-487`, đặt ở `scenery.js:562`): cán nâu sẫm 4 m, đĩa xám bạc r 0,2 m, chùm lông đen rủ dưới đĩa dài 0,9 m, chĩa ba sắt trên đỉnh. Dáng cờ Mông Cổ nhận ra từ xa; gộp vào `laneBig`.

PROMPT (dán thẳng):
```text
Mongol horse-tail standard (tug), 13th century, 4.4 m tall: straight dark brown wooden pole, a round silver-grey metal disc near the top with a long thick black horsehair tassel hanging below it, a small iron trident finial on top. No flag. Isolated single object, no people. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 300–600. **Symmetry: bật.**

### M36 · ENV_coc_troi · Cọc trói tù binh

Dùng ở Tự do, nhiệm vụ "Cứu đồng đội": tù binh hiện nay là lính đứng giữa bãi, không có cọc (`director-td.js:287-295`; lời nhắc "Cởi trói cho đồng đội" ở `director-td.js:438`; chỗ đứng cách tâm 4 m, `skirmish.js:113`). Mẫu mới: cọc gỗ 2 m có dây quấn, đặt cạnh mỗi tù binh; cởi trói xong code ẩn dây hoặc cả cọc. Hư cấu.

PROMPT (dán thẳng):
```text
Captive binding post: sturdy rough wooden post 2 m tall and 25 cm thick, a short crossbar near the top, loose coils of thick rope knotted around the middle with cut rope ends hanging. Isolated single object, no people. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 300–500. **Symmetry: tắt.**

### M37 · ENV_bo_ten_thu · Bó Mũi tên thư

Dùng ở B15, Kế Sách "Mũi tên thư": 3 bó để nhặt trong làng (`kesach.js:177-185`): ba mũi tên dựng đứng cao khoảng 1,2 m, tờ thư trứng sáo buộc ở giữa, đai vải son ở chân. Code giữ vòng sáng đánh dấu dưới đất. Thư diễn đạt trung tính, không có chữ trên mẫu (canon B15, mục H3).

PROMPT (dán thẳng):
```text
Bundle of three arrows standing upright, 1.2 m tall: brown wooden shafts with small iron heads pointing up, a rolled cream paper scroll tied to the shafts at mid height, a vermilion cloth band binding them near the bottom. No writing. Isolated single object, no hand. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 300–500. **Symmetry: bật.**

---

## N. Cây, đá, núi (môi trường)

Quy ước chung ở đầu mục K. Cây, tre, đá, cột đá vôi đều là InstancedMesh co giãn và nhuộm màu từng cây (`tintTrees`, `kit.js:103-114`), phần lớn đổ bóng: mẫu phải nướng về ngân sách ghi ở từng mục và để màu lá vừa phải để nhuộm được. Lá dạng khối đặc, không dùng tấm lá trong suốt (alpha) để khỏi vẽ chồng. Cỏ, hoa dại, lúa (hàng nghìn khóm 9–12 tam giác) giữ code.

| # | Mã | Tệp | Tên | Nhóm | Tam giác | Kích thước thật (nướng về số này) | Thay cho (code) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 133 | ENV_khom_tre | `env_khom-tre.glb` | Khóm tre làng | N | 0,8–1,5k | cao 9 m, bụi gốc Ø 2,4 m, tán 5 m | `bambooGeo` |
| 134 | ENV_cay_da | `env_cay-da.glb` | Cây đa đầu làng | N | 3–5k | cao 11 m, tán Ø 13,6 m, thân Ø 2,8 m | `banyan` |
| 135 | ENV_cay_tan_tron | `env_cay-tan-tron.glb` | Cây tán tròn | N | 400–800 | cao 5,5 m | `treeGeo` B15, cây Võ trường |
| 136 | ENV_cay_gao | `env_cay-gao.glb` | Cây gạo | N | 0,6–1,2k | cao 9 m | biến thể của `treeGeo` |
| 137 | ENV_lum_cay_ven_song | `env_lum-cay-ven-song.glb` | Lùm cây ven sông | N | 0,6–1,2k | cao 6 m, rộng 5 m | `groveGeo` |
| 138 | ENV_cum_cau | `env_cum-cau.glb` | Cụm cau | N | 0,6–1,2k | cao 7–10 m | `arecaGeo` |
| 139 | ENV_khom_chuoi | `env_khom-chuoi.glb` | Khóm chuối | N | 0,6–1,2k | cao 4 m | `palmGeo` |
| 140 | ENV_duoc | `env_duoc.glb` | Cây đước (sú vẹt) | N | 0,6–1,2k | cao 4 m, rễ xoè Ø 2,6 m | `mangroveGeo` |
| 141 | ENV_lau_say | `env_lau-say.glb` | Khóm lau sậy | N | 300–600 | cao 1,7 m | `reedGeo` |
| 142 | ENV_da_a | `env_da-a.glb` | Tảng đá tròn | N | 300–600 | khối đơn vị bán kính 1 như code: rộng ≈ 1,9 m (B15) / 1,7 m (B20), cao ≈ 0,65 bề rộng | `rockGeo` |
| 143 | ENV_da_b | `env_da-b.glb` | Tảng đá góc cạnh | N | 300–600 | như N10, cao ≈ 0,8 bề rộng | `rockGeo` |
| 144 | ENV_da_c | `env_da-c.glb` | Phiến đá dẹt | N | 300–600 | như N10, dày ≈ 0,35 bề dài | `rockGeo` |
| 145 | ENV_go_da | `env_go-da.glb` | Gò đá | N | 1–2k | cụm khoảng 12 m, cao 3 m, tảng lớn 3–4,9 m | đá xếp ở gò |
| 146 | ENV_nui_da_a | `env_nui-da-a.glb` | Cột đá vôi A (mảnh) | N | 1–2k | cao 3,4 lần bán kính chân (thật 10–55 m) | `karstGeo` A |
| 147 | ENV_nui_da_b | `env_nui-da-b.glb` | Khối đá vôi B (hai đỉnh) | N | 1,5–2,5k | cao 2,3 lần, rộng khoảng 2,7 lần bán kính chân | `karstGeo` B |
| 148 | ENV_nui_da_c | `env_nui-da-c.glb` | Đảo đá C (hàm ếch) | N | 1–2k | cao 3 lần bán kính chân | `karstGeo` C |
| 149 | ENV_day_nui_xa | `env_day-nui-xa.glb` | Dãy núi đá vôi xa (tuỳ chọn) | N | 1–3k | dài 600 m, cao 150 m | núi xa `addSkyKit` |

### N1 · ENV_khom_tre · Khóm tre làng

Dùng ở B15 và Tự do: lũy tre quanh làng (64 chỗ, chừa cổng hướng bắc) và khóm tre dọc bờ ruộng, 89 khóm (tối đa 160), đổ bóng, va chạm r 1,2–1,3 (`scenery.js:146-166`). Thay `bambooGeo`: 6 thân 6,4–9,2 m ngả ra ngoài, lá thành chùm từ nửa thân, bụi gốc r 1,2 m (`scenery.js:149`, đúng va chạm r 1,2–1,3); hiện nay trông như cây kẹo mút. Tre gai làng Bắc Bộ, thân xanh vàng, vài thân khô vàng.

PROMPT (dán thẳng):
```text
Dense clump of Vietnamese village thorny bamboo about 9 m tall: twenty green-yellow culms rising from a dense base 2.4 m wide and arching outward, a few dry yellow culms, feathery dark green leaf masses from mid-height up, drooping tips, crown 5 m wide. Solid chunky leaf clumps, no ground base. Isolated single object. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 0,8–1,5k gửi Meshy; trong game ≤ 500 mỗi khóm như code (89 × 500 = 44.500). **Symmetry: tắt.**

### N2 · ENV_cay_da · Cây đa đầu làng

Dùng ở B15 và Tự do: cây đa ngay cổng lũy tre, mốc nhận đường (`scenery.js:286-299`). Thay thân r 1,4 m, 7 rễ phụ, 7 khối tán từ 4,4 tới 11 m xoè r 6,8 m. Lưới riêng tự mờ khi chắn camera (`world.addFadeable`, r 5,5), va chạm r 1,6: giữ dải cao của tán để mờ đúng lúc.

PROMPT (dán thẳng):
```text
Huge old banyan tree 11 m tall: thick gnarled grey-brown trunk 2.8 m wide made of fused stems, many hanging aerial roots, wide flat dense dark green canopy 13 m across starting 4.4 m above the ground. Solid chunky leaf masses, no ground base. Isolated single object, no people. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 3–5k (một cây, nhìn gần; code 252). Phần tăng so với code phải bù ở chỗ khác trong B15 (đầu mục K). **Symmetry: tắt.**

### N3 · ENV_cay_tan_tron · Cây tán tròn

Dùng ở B15 và Tự do (260 cây, `world.js:300-304`, đặt ở `world.js:320-333`) và Võ trường (90 cây, `world.js:600-607`): bóng cây phổ biến nhất. Thay thân 2,6 m cộng hai khối tán, cao khoảng 5,5 m, scale 0,8–1,5. Code nhuộm từng cây: phần lớn xanh, 7% ngả vàng, 3% đỏ như cây gạo (`tintTrees`).

PROMPT (dán thẳng):
```text
Broadleaf tree 5.5 m tall: straight brown trunk 2.6 m to the first branches, round dense dark green crown of three large leaf clumps. Solid chunky leaf clumps, no ground base. Isolated single object. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 400–800 gửi Meshy; trong game ≤ 60 mỗi cây ở B15 (260 × 60 = 15.600) và ≤ 40 ở Võ trường (90 cây) như code; cao hơn chỉ khi có LOD gần, xa (đầu mục K). **Symmetry: tắt.**

### N4 · ENV_cay_gao · Cây gạo

Biến thể cho rừng B15 và Võ trường (`world.js:300-304`): thay một phần cây tán tròn, nhất là phần code nhuộm đỏ "gạo đỏ" (`kit.js:109`). Cây gạo đầu làng, bờ ruộng là cảnh quen của đồng bằng Bắc Bộ. Cao khoảng 9 m, cành xếp tầng, hoa đỏ thưa.

PROMPT (dán thẳng):
```text
Red silk-cotton tree (Bombax) 9 m tall: straight grey-brown trunk with small buttress roots, branches in level tiers, a sparse crown of dark green leaf clumps with scattered red flowers. Solid chunky leaf clumps, no ground base. Isolated single object. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 0,6–1,2k gửi Meshy; trong game ≤ 60 mỗi cây, cùng trần với cây tán tròn mà nó thay (N3); cao hơn chỉ khi có LOD gần, xa. **Symmetry: tắt.**

### N5 · ENV_lum_cay_ven_song · Lùm cây ven sông

Dùng ở B20: 300 lùm cây hai bờ (`kit.js:89-95`, đặt ở `scenery-b20.js:346-349`). Thay hai thân và ba khối tán lệch nhau, cao khoảng 6 m, rộng 5 m, scale 1,1–1,75.

PROMPT (dán thẳng):
```text
Riverside grove of two broadleaf trees 6 m tall: one straight brown trunk and one smaller leaning trunk, three overlapping round dark green leaf clumps at different heights, about 5 m wide. Solid chunky leaf clumps, no ground base. Isolated single object. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 0,6–1,2k gửi Meshy; trong game ≤ 80 mỗi lùm như code (300 × 80 = 24.000); cao hơn chỉ khi có LOD gần, xa (bản xa ≤ 80, đầu mục K). **Symmetry: tắt.**

### N6 · ENV_cum_cau · Cụm cau

Dùng ở B15 và Tự do: cau trong làng (30 cây đơn cao 9 m, `scenery.js:300-306`, tránh chỗ bó Mũi tên thư). Cụm ba cây 7–10 m: thay 30 cây đơn bằng khoảng 10–15 cụm.

PROMPT (dán thẳng):
```text
Group of three slender areca palms 7 to 10 m tall growing close together, thin ringed grey trunks, small crowns of feathery green fronds, a cluster of green nuts under each crown. Solid chunky fronds, no ground base. Isolated single object. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 0,6–1,2k gửi Meshy; trong game cả làng ≤ 2.760 như 30 cây đơn của code (92 mỗi cây): 10 cụm × 276 hoặc 15 cụm × 184. **Symmetry: tắt.**

### N7 · ENV_khom_chuoi · Khóm chuối

Dùng ở B15 và Tự do: thay 60 "cây cọ" ven sông (`world.js:305-308`, đặt ở `world.js:334`); dáng cọ nhiệt đới không hợp đồng bằng sông Hồng, chuối ven làng ven sông hợp hơn (suy luận). Cao khoảng 4 m.

PROMPT (dán thẳng):
```text
Banana clump 4 m tall: four green pseudo-stems of different heights from one base, broad long torn leaves arching out, one hanging bunch of green bananas with a purple bud. Solid chunky leaves, no ground base. Isolated single object. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 0,6–1,2k gửi Meshy; trong game ≤ 80 mỗi khóm như 60 cây cọ của code. **Symmetry: tắt.**

### N8 · ENV_duoc · Cây đước (sú vẹt)

Dùng ở B20: 190 cây trên bãi bùn triều, rễ chống lộ khi nước ròng (`scenery-b20.js:242-253`, đặt ở `scenery-b20.js:352-354`). Thay thân ngắn, 4 rễ chống hai khúc (xoè r 1,25–1,6 m, xuống tới y −0,25) và hai khối tán dẹt, cao khoảng 4 m; code kéo dài Y theo độ cao bãi. Rễ chống cong là đặc điểm cây đước (Rhizophora); vẹt có rễ gối, nên mẫu lấy tên đước (code gọi chung là sú vẹt). Gốc ở mặt bùn.

PROMPT (dán thẳng):
```text
Mangrove tree of a tidal estuary 4 m tall: short dark trunk standing on arching stilt roots that spread 2.6 m wide down to the mud line, dense rounded dark green crown. Solid chunky leaf masses. Isolated single object, no water, no mud, no ground base. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 0,6–1,2k gửi Meshy; trong game ≤ 96 như code (190 × 96 = 18.240); cao hơn chỉ khi có LOD gần, xa. **Symmetry: tắt.**

### N9 · ENV_lau_say · Khóm lau sậy

Dùng ở B15 và Tự do (khoảng 450 khóm ven sông, `world.js:336-337`; quanh hố ngập, `scenery.js:412-413`) và B20 (800 khóm, `kit.js:97-98`, đặt ở `scenery-b20.js:355-357`). Thay 4–5 lá nón hở cao 1,6–1,7 m (B20 12 tam giác, B15 24); code nhuộm màu từng khóm. Lá mảnh dễ hỏng khi Meshy dựng lại lưới; dựng hỏng thì giữ code.

PROMPT (dán thẳng):
```text
Clump of tall river reeds 1.7 m tall: about a dozen straight olive stems with long narrow leaves, a few bent, pale feathery plumes at the tips. Simple solid blades. Isolated single object, no water. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 300–600 gửi Meshy; trong game ≤ 12 mỗi khóm ở B20 (800 khóm) và ≤ 24 ở B15 (khoảng 450 khóm) như code. Meshy khó giữ dáng ở số ấy, nên thực tế giữ code, trừ khi làm LOD gần, xa. **Symmetry: tắt.**

### N10 · ENV_da_a · Tảng đá tròn

Dùng ở B15 và Tự do (260 tảng ở gò đá giữa hai mặt trận và đá lẻ khắp bãi, `scenery.js:168-187`) và B20 (130 tảng, `kit.js:100`, đặt ở `scenery-b20.js:358-361`). Thay khối 12 mặt (B15, sy 0,7, `scenery.js:169`) hoặc 20 mặt (B20, sy 0,65, `kit.js:100`) bán kính đơn vị 1: ở scale 1 rộng khoảng 1,87 m (B15) và 1,70 m (B20). Code co từng tảng s 0,15–2,6 (rộng thật 0,3–4,9 m), nhuộm, và cho tảng lớn va chạm r = 0,85·s (`scenery.js:179`) hoặc 0,8·s (`scenery-b20.js:361`). Bước nướng đưa mẫu về đúng khối đơn vị ấy (rộng 1,9 m B15, 1,7 m B20), không về 1 m, thì giữ được cỡ và va chạm; số mét trong prompt chỉ cho tỉ lệ. Ba mẫu N10–N12 để xen cho đỡ lặp.

PROMPT (dán thẳng):
```text
Weathered grey-brown river boulder about 1 m wide and 65 cm tall, rounded and slightly flattened, a few cracks and small moss patches. Isolated single object. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 300–600 gửi Meshy; trong game ≤ 20 mỗi tảng ở B20 (130 tảng) và ≤ 36 ở B15 (260 tảng) như code; cao hơn chỉ khi có LOD gần, xa. **Symmetry: tắt.**

### N11 · ENV_da_b · Tảng đá góc cạnh

Mẫu thứ hai, nướng về cùng khối đơn vị với N10 (`scenery.js:168-187`, `kit.js:100`): đá vôi vỡ góc cạnh, hợp bờ B20 dưới chân núi đá.

PROMPT (dán thẳng):
```text
Angular grey limestone rock about 1 m wide and 80 cm tall with sharp broken faces and edges, light weathering, a little moss on top. Isolated single object. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 300–600 gửi Meshy; trong game ≤ 20 (B20) và ≤ 36 (B15) như N10. **Symmetry: tắt.**

### N12 · ENV_da_c · Phiến đá dẹt

Mẫu thứ ba, nướng về cùng khối đơn vị với N10 (`scenery.js:168-187`, `kit.js:100`): phiến đá dẹt nằm nghiêng, hợp sỏi ven đường và bãi bùn.

PROMPT (dán thẳng):
```text
Flat slab of grey-brown stone about 1.2 m long and 40 cm thick with tilted layers, rounded worn edges and lichen spots. Isolated single object. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 300–600 gửi Meshy; trong game ≤ 20 (B20) và ≤ 36 (B15) như N10. **Symmetry: tắt.**

### N13 · ENV_go_da · Gò đá

Dùng ở B15 và Tự do: gò đá giữa hai mặt trận (`ZONES.knolls`; đá xếp ở `scenery.js:170-181`: mỗi gò 4 tảng lớn 1,6–2,6 m và nhiều đá nhỏ, va chạm theo tảng lớn). Tảng lớn là khối đơn vị rộng 1,87 m nhân s 1,6–2,6, tức rộng 3–4,9 m, rải trong bán kính 0,8 r quanh tâm gò (r 15–26 m, `ground.js:33`). Một cụm khoảng 12 m, cao 3 m, đặt ở tâm gò thay cho bốn tảng lớn; va chạm sinh lại theo tảng của mẫu (code nay theo từng tảng, r 0,85·s). Đá nhỏ rải quanh vẫn dùng N10–N12. Nền gò (màu đá trên địa hình, `world.js:108`) code giữ.

PROMPT (dán thẳng):
```text
Low rocky knoll: cluster of four big weathered grey-brown boulders 3 to 5 m wide and several small stones, about 12 m across and 3 m tall, patches of grass and moss between them. Isolated single object. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 1–2k. **Symmetry: tắt.**

### N14 · ENV_nui_da_a · Cột đá vôi A (mảnh)

Dùng ở B20: 44 cột hai bờ, thấy ở mọi góc nhìn B20 (`kit.js:123-189`, InstancedMesh ở `scenery-b20.js:335-343`, bố trí `scenery-b20.js:142-173`). Thay `karstGeo` cao 3,4: mặt tròn xoay gồ ghề bán kính chân 1, cao 3,4 lần bán kính, vách gần dựng đứng, vai tròn, đỉnh bằng gồ ghề, vệt nước chảy sẫm, chân ướt, cây trên gờ và đỉnh; phần y −1,2…−0,1 là váy chôn dưới đất, không phải thân (gốc mẫu ở chân thấy được, xem quy ước Gốc toạ độ đầu mục K). Code co (r, sy, r) với r 3–16 m, nên cao thật khoảng 10–55 m (mẫu theo r 12 m: cao 40 m, rộng chân 24 m). Đá vôi vùng Hạ Long – Bạch Đằng.

PROMPT (dán thẳng):
```text
Tall slender limestone karst pillar of the Ha Long and Bach Dang coast, 40 m tall and 24 m wide at the foot: near-vertical pale grey limestone walls with dark vertical rain streaks, a rounded shoulder and a rough flat top, a dark wet foot, green shrubs on ledges and on top. Solid low-poly vegetation. Isolated single object, no water. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 1–2k gửi Meshy; trong game ≤ 233 mỗi cột như code (44 cột); cao hơn chỉ khi thêm mức chi tiết gần, xa như bộ vẽ hạm đội (bản xa ≤ 233), vì cảnh B20 đã 120.730 trên ~120 nghìn tam giác. **Symmetry: tắt.**

### N15 · ENV_nui_da_b · Khối đá vôi B (hai đỉnh)

Dùng ở B20: 10 khối (`karstGeo` cao 2,3 có cột phụ, `scenery-b20.js:335`): cột chính cao 2,3 lần bán kính chân, cột phụ hẹp hơn (0,72) lệch 0,95 bán kính, hai đỉnh gần bằng nhau. Mẫu theo r 13 m: cao khoảng 30 m, rộng khoảng 35 m (cột phụ bán kính 0,72 lệch 0,95: khoảng 2,7 lần bán kính chân, `kit.js:182`).

PROMPT (dán thẳng):
```text
Twin-peaked limestone karst massif, 30 m tall and 35 m wide: two steep rounded summits of nearly equal height side by side, the second one narrower, near-vertical pale grey limestone walls with dark rain streaks, a dark wet foot, green shrubs on ledges and tops. Solid low-poly vegetation. Isolated single object, no water. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 1,5–2,5k gửi Meshy; trong game ≤ 464 như code (10 khối); cao hơn chỉ khi có LOD gần, xa. **Symmetry: tắt.**

### N16 · ENV_nui_da_c · Đảo đá C (hàm ếch)

Dùng ở B20: 30 đảo đá ở cửa sông, ngoài luồng tàu (`karstGeo` cao 3,0 có hàm ếch, `scenery-b20.js:335`; đặt ở mặt nước, `scenery-b20.js:338`). Hàm ếch ngấn nước khoét vào quanh chân (cao 0,06–0,34 bán kính), mép trên nhô ra như đảo đá Hạ Long. Mẫu theo r 10 m: cao 30 m, rộng 20 m. Sau khi bước nướng đặt lại gốc, hàm ếch phải nằm ngang mặt nước.

PROMPT (dán thẳng):
```text
Limestone sea islet of Ha Long Bay type, 30 m tall and 20 m wide: steep pale grey limestone walls with dark rain streaks, a deep wave-cut notch all around the foot with an overhanging rock lip above it, dark wet rock below the notch, green shrubs on top. Solid low-poly vegetation. Isolated single object, no water. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 1–2k gửi Meshy; trong game ≤ 269 như code (30 đảo); cao hơn chỉ khi có LOD gần, xa. **Symmetry: tắt.**

### N17 · ENV_day_nui_xa · Dãy núi đá vôi xa (tuỳ chọn)

Núi xa B20 do `addSkyKit` dựng (nón và trụ đá vôi màu khói, ngoài sương, `kit.js:197-245`), B15 và Võ trường do `addSky` (`scenery.js:899-943`). Nên giữ code: rẻ, đặt theo vùng chơi, không đè lên trận. Mẫu này chỉ để thử thay vài dãy ở xa. Dài khoảng 600 m, cao 150 m **(đề xuất)**.

PROMPT (dán thẳng):
```text
Distant ridge of limestone karst peaks about 600 m long and 150 m tall: a row of steep rounded grey peaks of different heights joined at the base, muted blue-grey rock with a little green on top, very simple shapes for a far background. Isolated single object, no water. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 1–3k. **Symmetry: tắt.**

---

## O. Thú (cảnh B15)

Quy ước chung ở đầu mục K. Thú chỉ có ở B15 và Tự do: trâu gặm cỏ, đằm ruộng; đàn cò kiếm ăn và bay hình chữ V; quạ quanh xác ngựa; trẻ chăn trâu ngồi lưng trâu thổi sáo (`ambient.js:1-15`). Toàn bộ Hư cấu, chỉ để nhìn. Code dựng thú bằng từng phần rời và tự tính ma trận mỗi khung (thân chim, cổ đầu cò, cánh, thân trâu, đầu trâu, chân tai đuôi; `ambient.js:13-15`), không phải lưới có xương. GLB thay được theo hai cách: tách mẫu thành đúng các phần đó khi nướng (cắt ở cổ, vai cánh, gốc chân), hoặc rig bốn chân như ngựa. Cả mục O nằm trong bộ `thieu`.

**Trẻ chăn trâu: giữ code, không thêm mục.** Em là một khối ngồi dạng chân trên lưng trâu, đội nón lá, thổi sáo ngang (`boyGeo`, `ambient.js:190-205`), cao khoảng 0,75 m khi ngồi, tối đa 3 em, nhìn từ xa 30 m trở lên. Mục người (`char_`, `unit_`) bắt buộc có khối POSE A-pose và được gửi kèm `pose_mode: a-pose` (công cụ báo lỗi ngay khi prompt người thiếu "A-pose,"), nên Meshy không dựng được dáng ngồi theo đường này. Khi có GLB của DAN_TRE (mục J3) và nón lá rời (mục H5), bước nướng dựng tư thế ngồi tĩnh từ rig của DAN_TRE, như cách nướng bộ lính về tư thế nghỉ; ống sáo là một que code. Không đáng tốn credit cho một mẫu ngồi riêng.

| # | Mã | Tệp | Tên | Nhóm | Tam giác | Kích thước thật (nướng về số này) | Thay cho (code) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 150 | MOUNT_trau | `mount_trau.glb` | Trâu | O | 3–5k | vai 1,5 m, thân 2,2 m chưa tính đầu | `buffaloBodyGeo`, `buffaloHeadGeo` |
| 151 | ENV_co_dung | `env_co-dung.glb` | Cò trắng đứng | O | 300–800 | cao 1,05 m (thân dài 0,56 m, tâm thân cao 0,58 m) | `birdBodyGeo`, `egretNeckGeo` |
| 152 | ENV_co_bay | `env_co-bay.glb` | Cò trắng bay | O | 300–800 | sải cánh 1,7 m | thân, cổ, `wingGeo` |
| 153 | ENV_qua | `env_qua.glb` | Quạ | O | 300–600 | dài 0,45 m | thân cò bóp lại, nhuộm đen |

### O1 · MOUNT_trau · Trâu

Dùng ở B15 và Tự do: tối đa 8 trâu đi, gặm cỏ, đằm ruộng, chạy kiệu tránh trận; hai con có trẻ chăn ngồi (`ambient.js:47-50`; thân `ambient.js:161-172`, đầu và sừng `ambient.js:174-188`). Code: da xám đá `#687078`, vạt trắng dưới cổ, sừng cánh cung vểnh ra sau (gốc nhạt, chóp sẫm), lưng cao khoảng 1,5 m (chỗ trẻ ngồi), thân dài khoảng 2,2 m chưa tính đầu. Trâu nước Việt Nam. Tiền tố `mount_` (thư mục `thu-cuoi/`) vì có người cưỡi; công cụ gửi NEGATIVE-NV cho thú nhưng bỏ chữ "horns" riêng cho trâu (API v2 vốn bỏ qua ô Negative; bỏ cho chắc).

PROMPT (dán thẳng):
```text
Vietnamese water buffalo, adult, about 1.5 m at the shoulder, standing square on four legs in a neutral pose, head forward and level, slate-grey nearly hairless skin, a pale chevron mark under the throat, large crescent horns sweeping back and up, pale at the base and dark at the tips, thin tail with a dark tuft hanging down. No rider, no harness, no rope. Isolated single object. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 3–5k. Mặt hướng +Z, gốc giữa bốn chân. **Symmetry: bật.**

### O2 · ENV_co_dung · Cò trắng đứng

Dùng ở B15 và Tự do: năm đàn 8–14 cò lội ruộng ngập và đầm ven sông (`ambient.js:44`, `ambient.js:231`; thân `ambient.js:132-138`, cổ đầu `ambient.js:140-149`). Code: tâm thân cao 0,58 m (`ambient.js:37`), thân dài khoảng 0,56 m, chân cổ ở trên tâm thân 0,07 m (`ambient.js:761`), cổ chữ S và đầu cao 0,43 m (`ambient.js:140-147`), mỏ vàng `#e2b43a`, chân đen; cò đứng cao khoảng 1,05–1,08 m (cò ngàng lớn). Bước nướng khớp theo thân dài 0,56 m và tâm thân 0,58 m, không theo chiều cao chung. Khi nướng tách cổ khỏi thân để code vẫn vươn cổ, mổ mồi.

PROMPT (dán thẳng):
```text
Great egret standing still, about 1 m tall: pure white plumage, long S-curved neck, long yellow dagger bill, long black legs, wings folded along the body. Isolated single object, no water. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 300–800 gửi Meshy; trong game ≤ 150 mỗi con (tới 112 con). **Symmetry: bật.**

### O3 · ENV_co_bay · Cò trắng bay

Dùng cho cò cất cánh, lượn, bay chữ V ngang trời (vẽ cánh ở `ambient.js:784-795`, tấm cánh `ambient.js:153-159`): sải cánh khoảng 1,7 m, cổ co chữ S, chân duỗi ra sau. Code vỗ cánh hai khúc mỗi bên; mẫu tĩnh dùng khi liệng, hoặc tách cánh ở vai và khuỷu khi nướng để code vỗ.

PROMPT (dán thẳng):
```text
Great egret in gliding flight, wings fully spread 1.7 m wide, pure white plumage, neck folded back in an S, long yellow bill pointing forward, long black legs trailing straight behind. Isolated single object, no water. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 300–800. **Symmetry: bật.**

### O4 · ENV_qua · Quạ

Dùng ở B15 và Tự do: 3–5 quạ quanh mỗi xác ngựa, nhảy, mổ, bay vòng (`ambient.js:235`, `ambient.js:322`; code dùng chung thân cò bóp lại và nhuộm đen, `ambient.js:757-762`). Dài khoảng 45 cm, sải cánh khoảng 1 m. Một mẫu đứng; khi bay code dùng cánh rời.

PROMPT (dán thẳng):
```text
Large-billed crow standing, about 45 cm long: glossy black feathers, thick black bill, black legs, wings folded, tail slightly fanned. Isolated single object. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 300–600. **Symmetry: bật.**

---

## P. Làm lại mẫu lệch (mục `_v2`)

Mẫu đã tạo ở đợt đầu mà lệch prompt, soát bằng ảnh `design/glb/xem-truoc/nhan-vat.webp`, `vu-khi.webp` và khung xương đã nướng trong `game/assets/models/char/*.hkm`. Mỗi mục là một mã mới `<mã gốc>_v2` ra tệp `…_v2.glb` nằm cạnh tệp cũ (mục 0.5). **Tệp cũ và băm của mã gốc giữ nguyên**: game vẫn dùng tệp cũ cho tới khi soát xong bản mới và Claude chuyển bước nướng sang tệp `_v2` (mục "Tạo thêm hoặc làm lại" của `design/glb/README.md`). Liệt kê bằng `node design/tools/meshy.mjs list --set lam-lai --prompt`; thứ tự và credit ở mục 0.8.

- **Tư thế.** Mọi mục người viết bằng POSE v2 (mục 2.2). 40 mẫu đầu ra tay dang khoảng 74° so với buông thẳng, khuỷu gập, ngửa bàn tay, nên bộ dò khớp (`design/tools/bake/landmarks.mjs`) đặt sai khuỷu và cổ tay: cẳng tay chỉ dài 0,03–0,12 đơn vị rig ở X19, OFF_photuong, CV_cung (rig dựng bằng code là 0,36), tay phải của OFF_doitruong không rig được.
- **Đối xứng.** Áo cân hai bên thì bật (mục 0.2), để hai tay ra cùng một góc; 40 mẫu đầu, trừ mẫu có đồ lệch, để Auto, và có mẫu lệch trái phải rõ (H35 cẳng tay 0,26 và 0,15). Đồ chỉ có ở một bên (hộp tên DV_NO, bao tay và ống tên CV_cung, lưỡi đại đao một cạnh) thì tắt.
- **Bảng `FIX` của mã gốc không theo sang mã `_v2`** (`apiPrompt` trong `meshy.mjs`), nên câu đã sửa và dựng ra đúng (mũ Mông Cổ, giáp vảy của OFF_doitruong) được viết thẳng vào prompt. Câu chặn vũ khí là bản chung: `Unarmed: no sword, scabbard or weapon on the body.`, thêm `No helmet.` khi prompt không có chữ helmet, hat, cap, rồi `No horns, no cape.`. Độ dài API in bởi `list` đã gồm câu này.
- **Đỉnh mũ.** Mỗi mũ chỉ xin một chi tiết cứng, có số và chỗ (`one short … cone on the top centre`), đúng như chóp nón của mũ code (`mutuong`, `mulong`, `models.js:220-222`). Tua, chùm lông, dải vải là phần mềm Claude dựng bằng code (mục 0.3; tua mũ code đã có, `models.js:78`); chữ `spike`, `tassel`, `plume` và hai chi tiết chồng trên đỉnh là đúng kiểu đã mọc sừng, mào ở H33, X19, OFF_photuong. Mũ lông tả là trụ thẳng (`straight-sided cylindrical`), không ví với cái trống: `drum` dễ ra mặt da căng, đinh tán (suy luận).
- **Nón lá.** Meshy chưa dựng được nón lá vành rộng lần nào (6/6 lần, cả meshy-5 lẫn `latest`). Người lính Tự do bậc 0–1 và ba cận vệ đội nón vì thế tạo **đầu trần buộc khăn đỏ** (câu của H35, đã dựng đúng); nón là tệp PROP_non_la (mục H5) gắn vào khớp đầu bằng code. Lính đám đông DV_GIAO, DV_NO vẫn thử nón trong prompt, tả bằng hình và cỡ của code; hỏng lần nữa thì làm như trên: thân đầu trần, nón gộp vào bộ lính khi nướng.
- **Model.** DV_DAO bản meshy-5 bỏ qua câu tả đầu, đại đao bản meshy-5 từng mất lưỡi, nên chạy cả mục này bằng `latest` (`--model-linh latest --model-vk latest`, mục 0.8).

| # | Mã | Tệp | Tên | Nhóm | Tam giác | Lệch ở bản cũ | Bản làm lại |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 169 | H33_v2 | `char_H33_tran-nhat-duat_v2.glb` | Trần Nhật Duật (làm lại) | A | 10–20k | Mũ vàng mọc cặp sừng và mào, cả bản sửa FIX | Mũ bát vàng tròn, một chóp son ngắn ở chính giữa |
| 170 | X19_v2 | `char_X19_toa-do_v2.glb` | Toa Đô (làm lại) | B | 10–20k | Mũ lông hai chóp như sừng; cẳng tay rig 0,03 và 0,08 | Mũ lông trụ thẳng, một chóp vàng ngắn ở chính giữa |
| 171 | OFF_photuong_v2 | `char_OFF_photuong_v2.glb` | Phó tướng Nguyên (làm lại) | B | 10–15k | Mào tua tủa như vương miện; cẳng tay trái 0,03 | Mũ lông trụ thẳng, một chóp xám bạc ngắn ở chính giữa |
| 172 | X20_v2 | `char_X20_o-ma-nhi_v2.glb` | Ô Mã Nhi (làm lại) | B | 10–20k | Không mũ lông, không chóp vàng; dáng áo bào, giáp mỏng; tay gần ngang | Mũ lông trụ thẳng, một chóp vàng ngắn (chùm lông đỏ code dựng), giáp nặng từ vai tới gối |
| 173 | DV_DAO_v2 | `unit_DV_DAO_v2.glb` | Đao khiên (làm lại) | C | 1,5–3k | Đội nón thay khăn đỏ; bao đao hông trái | Đầu trần, khăn son buộc trán, thắt lưng trơn |
| 174 | DV_GIAO_v2 | `unit_DV_GIAO_v2.glb` | Giáo binh (làm lại) | C | 1,5–3k | Nón chóp nhỏ nhọn, giống mũ nhọn phe Nguyên | Nón lá Ø 64 cm cao 15 cm, vành rộng hơn vai |
| 175 | DV_NO_v2 | `unit_DV_NO_v2.glb` | Nỏ thủ (làm lại) | C | 1,5–3k | Mũ lưỡi trai thay nón | Nón lá Ø 52 cm cao 24 cm, vành rộng hơn vai |
| 176 | LINH_r01_v2 | `char_LINH_r01_v2.glb` | Người lính Tự do bậc 0–1 (làm lại) | E | 10–20k | Mũ trụ đỏ thay nón lá; tay gần ngang | Đầu trần khăn đỏ; nón là PROP_non_la gắn bằng code |
| 177 | CV_giao_v2 | `char_CV_giao_v2.glb` | Cận vệ Giáo thủ (làm lại) | F | 4–8k | Mũ trụ đỏ; ria và chòm râu dù prompt ghi không râu | Đầu trần khăn đỏ, mặt trẻ cạo nhẵn; nón PROP_non_la |
| 178 | CV_cung_v2 | `char_CV_cung_v2.glb` | Cận vệ Cung thủ (làm lại) | F | 4–8k | Mũ trụ đỏ; cẳng tay trái rig 0,11 | Đầu trần khăn đỏ; nón PROP_non_la |
| 179 | CV_songdao_v2 | `char_CV_songdao_v2.glb` | Cận vệ Song đao (làm lại) | F | 4–8k | Mũ trụ đỏ; mặt già tóc râu bạc dù prompt ghi 22 tuổi | Đầu trần khăn đỏ, mặt trẻ cạo nhẵn; nón PROP_non_la |
| 180 | WPN_giao_dv_v2 | `wpn_giao-dv_v2.glb` | Giáo Đại Việt (làm lại) | G | 0,5–1,5k | Chùm cánh chữ thập dưới mũi giáo | Một lưỡi lá dẹt trên khâu tròn |
| 181 | WPN_dadao_v2 | `wpn_dadao_v2.glb` | Đại đao cán dài (làm lại) | G | 1–3k | Lưỡi nằm cạnh cán như lá cờ | Lưỡi và cán thẳng một hàng |
| 182 | OFF_doitruong_v2 | `char_OFF_doitruong_v2.glb` | Đội trưởng Nguyên (làm lại) | B | 10–12k | Gần T-pose (rộng 1,50 m); tay phải không rig được | POSE v2; giữ mũ và giáp vảy của FIX |

### P1 · H33_v2 · Trần Nhật Duật, làm lại mũ

Làm lại A3. Bản cũ mọc cặp sừng và một mào trên mũ vàng, cả lần đầu lẫn lần sửa FIX (`Small smooth round gold helmet with one thin red spike on top, plain, no crest.`), trong khi cùng câu mũ ấy H40 ra đúng. Lý do (suy luận): phần còn lại của prompt (`scholar-general`, `brocade robe`) kéo về mũ tướng tuồng có cánh, và chữ `spike` bị nhân lên. Bản này bỏ hai chữ đó, tả mũ là cái bát úp với một chóp son ngắn ở chính giữa đỉnh, đúng như mũ code `mutuong` (trụ vàng thấp có chóp son, `models.js:220`); không xin tua (tua mềm dễ ra mào tua tủa như P3; cần tua thì Claude dựng bằng code). Muốn mũ như truyện thì thay câu mũ bằng `Small soft black silk cap over a topknot.`

PROMPT (dán thẳng):
```text
Vietnamese general, 13th-century Tran dynasty, about 30, clever face, thin moustache, goatee. Gold helmet like an upturned bowl, one short vermilion cone on the top centre. Steel-blue robe, black lacquer lamellar vest with gold trim, jade belt, four steel-blue skirt flaps, black greaves and shoes. A-pose, straight arms 45° down, elbows straight, relaxed open hands, fingers together, feet shoulder-width, facing front, mouth closed. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 10–20k; cao 1,78 m. **Symmetry: bật.** Đi kèm như A3.

### P2 · X19_v2 · Toa Đô, làm lại mũ

Làm lại B1. Bản cũ: mũ lông có hai chóp nhọn như sừng (OFF_tuong cùng câu mũ thì ra đúng); cẳng tay rig chỉ 0,03 và 0,08. Mũ code `mulong` là trụ lông có chóp vàng nhỏ (`models.js:222`); bản này tả một chóp vàng ngắn hình nón ở chính giữa đỉnh (như chóp bốn mặt của `mulong`), nói rõ số và chỗ để không thành cặp sừng, như cách đã sửa ở X20_v2, X21; không dùng quả cầu, vì mũ lông có núm tròn trên đỉnh là mũ quan nhà Thanh, và bỏ chữ `Veteran`, `worn` (kéo về dáng thủ lĩnh man rợ, suy luận). Thân mũ tả là trụ thẳng như `mulong`, không ví với cái trống (đầu mục P). Râu điểm bạc giữ như B1.

PROMPT (dán thẳng):
```text
Senior Mongol-Yuan general, 13th century, about 55, weathered dignified face, grey-streaked moustache and beard. Tall straight-sided cylindrical brown fur hat, one short gold cone on the top centre. Heavy black lacquer lamellar armor with gold trim, dark plum robe, leather belt, tall riding boots. A-pose, straight arms 45° down, elbows straight, relaxed open hands, fingers together, feet shoulder-width, facing front, mouth closed. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 10–20k; cao 1,90 m, vạm vỡ. **Symmetry: bật.** Đi kèm như B1.

### P3 · OFF_photuong_v2 · Phó tướng Nguyên, làm lại mũ

Làm lại B5. Bản cũ: mào tua tủa như vương miện thay cho một chóp xám bạc (chữ `spike` bị hiểu thành nhiều gai, suy luận); bắp tay trái 0,12, cẳng tay trái 0,03. Cùng dáng mũ với P2 như code (`mulong` cho cả hai, `models.js:441-442`), chỉ khác chóp xám bạc.

PROMPT (dán thẳng):
```text
Mongol-Yuan deputy commander, 13th century, about 35, stern clean-shaven face. Tall straight-sided cylindrical brown fur hat, one short silver-grey cone on the top centre. Black lacquer lamellar armor with silver-grey trim, dark indigo robe, indigo skirt flaps, leather belt, tall riding boots. A-pose, straight arms 45° down, elbows straight, relaxed open hands, fingers together, feet shoulder-width, facing front, mouth closed. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 10–15k; cao 1,82 m. **Symmetry: bật.** Đi kèm như B5.

### P4 · X20_v2 · Ô Mã Nhi, làm lại mũ và giáp

Làm lại B2. Bản cũ (ảnh `xem-truoc/nhan-vat.webp`): không có mũ lông cao, chỉ búi tóc với mũ nhỏ; dáng áo bào dài, vai giáp mỏng; tay gần ngang (khung rộng 1,48 m). Đây là boss B20, game phóng ×1,42, to nhất game (`models.js:451`), nên cần đủ dáng của rig code: mũ lông `mulong` chóp vàng, giáp nặng then viền vàng như H31. Câu mũ nói rõ **một** chóp ở **chính giữa** đỉnh (X19 ra hai chóp khi câu không nói số và chỗ); câu giáp tả từ vai tới gối để không thành áo bào. Chùm lông đỏ theo truyện Claude dựng bằng code ở đầu chóp: chóp kèm chùm lông là hai chi tiết trên đỉnh mũ, đúng kiểu đã mọc sừng, mào (đầu mục P).

PROMPT (dán thẳng):
```text
Proud Central Asian Yuan admiral, 13th century, about 45, thick black beard. Tall straight-sided cylindrical brown fur hat, one short gold cone on the top centre. Heavy black lacquer lamellar armor to the knees, layered pauldrons, gold chest mirror, gold trim, near-black sleeves, tall boots. A-pose, straight arms 45° down, elbows straight, relaxed open hands, fingers together, feet shoulder-width, facing front, mouth closed. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 10–20k; cao 1,92 m. **Symmetry: bật.** Đi kèm như B2.

### P5 · DV_DAO_v2 · Đao khiên, làm lại đầu

Làm lại C2. Bản cũ (meshy-5): đội nón thay cho khăn đỏ, bao đao ở hông trái. Code: khăn son quấn đầu và búi tóc, không nón (`soldiers.js:247`). Câu tả đầu đứng riêng, mở bằng `Bare head`; thắt lưng trơn. Chạy `--model-linh latest`.

PROMPT (dán thẳng):
```text
Vietnamese Tran dynasty infantryman, 13th century, young beardless face. Bare head: topknot, vermilion cloth band round the forehead. Dark red tunic, black lacquer chest plate, shoulder pads, plain black belt, dark red apron and back flap, black hems, black trousers, straw leg wraps, black shoes. A-pose, straight arms 45° down, elbows straight, relaxed open hands, fingers together, feet shoulder-width, facing front, mouth closed. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 1,5–3k; cao 1,75 m. **Symmetry: bật.** Đi kèm như C2.

### P6 · DV_GIAO_v2 · Giáo binh, làm lại nón

Làm lại C1. Bản cũ: nón chóp nhỏ nhọn, nhìn như mũ trụ nhọn của phe Nguyên, trái quy ước hai phe khác cả dáng mũ (`soldiers.js:196-197`, `models.js:3-5`). Code: nón rơm chóp thấp Ø 0,64 m, cao 0,15 m, màu rơm `#b9a37a`, vòng khăn then dưới nón (`soldiers.js:242`). Prompt ghi đúng cỡ ấy và `brim wider than the shoulders` thay cho `low wide conical`. Vành mỏng có thể vỡ khi Meshy dựng lại lưới 3k tam giác; hỏng thì làm thân đầu trần và gộp PROP_non_la vào bộ lính khi nướng (mục H5).

PROMPT (dán thẳng):
```text
Vietnamese Tran dynasty infantryman, 13th century, young beardless face. Straw rice hat (non la): a flat cone 64 cm across and 15 cm tall, brim wider than the shoulders. Vermilion tunic, black lacquer chest plate, narrow vermilion apron, wide back flap, black trousers, straw leg wraps, black shoes. A-pose, straight arms 45° down, elbows straight, relaxed open hands, fingers together, feet shoulder-width, facing front, mouth closed. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 1,5–3k; cao 1,75 m. **Symmetry: bật.** Đi kèm như C1.

### P7 · DV_NO_v2 · Nỏ thủ, làm lại nón

Làm lại C3. Bản cũ: mũ lưỡi trai thay cho nón. Code: nón rơm Ø 0,52 m, cao 0,24 m (chóp cao hơn, vành hẹp hơn nón giáo binh nhưng vẫn rộng hơn vai), vòng then dưới nón (`soldiers.js:252`); hộp tên nâu lệch trái sau lưng (`soldiers.js:253`). Chữ `narrow-brimmed` và `padded vest` của bản cũ bị hiểu thành mũ lưỡi trai (suy luận); bản này ghi cỡ nón và viết `cloth armor vest`.

PROMPT (dán thẳng):
```text
Vietnamese Tran dynasty foot soldier, 13th century, beardless face. Straw rice hat (non la): a cone 52 cm across and 24 cm tall, brim wider than the shoulders. Vermilion tunic, straw-colored cloth armor vest, apron and back flap, black trousers and shoes, leg wraps, brown wooden box on the back. A-pose, straight arms 45° down, elbows straight, relaxed open hands, fingers together, feet shoulder-width, facing front, mouth closed. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 1,5–3k; cao 1,75 m. **Symmetry: tắt** (hộp tên lệch trái). Đi kèm như C3.

### P8 · LINH_r01_v2 · Người lính Tự do bậc Lính và Tinh nhuệ, làm lại đầu

Làm lại E1, nhân vật người chơi ở chế độ Tự do bậc 0–1. Bản cũ: mũ trụ đỏ thay cho nón lá; tay gần ngang (khung rộng 1,65 m). Bản này đầu trần, búi tóc, khăn đỏ buộc sau gáy. Nón lá là PROP_non_la gắn vào khớp đầu khi `cfg.hat === "non"` (`models.js:224`); cần sửa code, vì khi có thân GLB thì khối đầu dựng bằng code bị bỏ (`addBody`, `models.js:181`).

PROMPT (dán thẳng):
```text
Vietnamese Tran dynasty foot soldier, 13th century, about 20, beardless determined face. Bare head: black topknot under a red headband knotted at the back. Brick-red robe, dark brown leather armor, arm and shoulder guards with dull bronze trim, four brick-red skirt flaps, black greaves and shoes. A-pose, straight arms 45° down, elbows straight, relaxed open hands, fingers together, feet shoulder-width, facing front, mouth closed. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 10–20k; cao 1,78 m; texture 2048 như E1 (công cụ giữ quy tắc của nhóm E). **Symmetry: bật.** Đi kèm: như E1, thêm PROP_non_la.

### P9 · CV_giao_v2 · Cận vệ Giáo thủ, làm lại đầu

Làm lại F2. Bản cũ: mũ trụ đỏ; có ria và chòm râu dù prompt ghi không râu. Đầu trần khăn đỏ như P8, mặt trẻ cạo nhẵn; nón PROP_non_la gắn bằng code (`guards.js:29`).

PROMPT (dán thẳng):
```text
Vietnamese Tran dynasty bodyguard, 13th century, about 25, lean young smooth-shaven face. Bare head: black topknot under a red headband knotted at the back. Brick-red robe, dark brown lamellar chest armor and shoulder guards with gold trim, four maroon skirt flaps, black greaves and shoes. A-pose, straight arms 45° down, elbows straight, relaxed open hands, fingers together, feet shoulder-width, facing front, mouth closed. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 4–8k; cao 1,78 m. **Symmetry: bật.** Đi kèm: WPN_giao_dv, PROP_non_la.

### P10 · CV_cung_v2 · Cận vệ Cung thủ, làm lại đầu

Làm lại F3. Bản cũ: mũ trụ đỏ; cẳng tay trái rig 0,11. Đầu trần khăn đỏ, giữ bao tay da cẳng tay trái và ống tên sau lưng; nón PROP_non_la gắn bằng code (`guards.js:34`).

PROMPT (dán thẳng):
```text
Vietnamese Tran dynasty bodyguard, 13th century, about 25, calm face, thin moustache. Bare head: topknot under a red headband knotted at the back. Brick-red robe, dark brown leather armor with gold trim, bracer on the left forearm, quiver on the back, maroon skirt flaps, black greaves and shoes. A-pose, straight arms 45° down, elbows straight, relaxed open hands, fingers together, feet shoulder-width, facing front, mouth closed. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 4–8k; cao 1,78 m. **Symmetry: tắt** (bao tay một bên, ống tên). Đi kèm: WPN_cung_viet, PROP_non_la.

### P11 · CV_songdao_v2 · Cận vệ Song đao, làm lại đầu và mặt

Làm lại F4. Bản cũ: mũ trụ đỏ; mặt già, tóc và râu bạc dù prompt ghi khoảng 22 tuổi, không râu. Đầu trần khăn đỏ, mặt trẻ cạo nhẵn, tóc đen; nón PROP_non_la gắn bằng code (`guards.js:39`).

PROMPT (dán thẳng):
```text
Vietnamese Tran dynasty bodyguard, 13th century, about 22, wiry build, young smooth-shaven face. Bare head: topknot under a red headband knotted at the back. Brick-red robe, sleeves bound at the wrist, dark brown leather vest, gold trim, red sash, short maroon skirt flaps, black greaves and shoes. A-pose, straight arms 45° down, elbows straight, relaxed open hands, fingers together, feet shoulder-width, facing front, mouth closed. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 4–8k; cao 1,75 m. **Symmetry: bật.** Đi kèm: WPN_songdao ×2, PROP_non_la.

### P12 · WPN_giao_dv_v2 · Giáo Đại Việt, làm lại mũi giáo

Làm lại G6. Bản cũ: chùm cánh chữ thập dưới mũi giáo. Chữ `four-sided` bị hiểu thành bốn lưỡi, `black binding below the head` thành một gờ (suy luận; thương Nguyên ghi `narrow four-sided` mà ra đúng vì mũi hẹp). Code dựng mũi là chóp nhọn dài 0,28 m trên khâu then (`soldiers.js:44-48`); một lưỡi lá dẹt giữ đúng dáng ấy mà không mọc cánh.

PROMPT (dán thẳng):
```text
Long infantry spear, 13th-century Vietnam, about 3 m long. Slim straight brown wooden shaft, black iron butt cap, one flat leaf-shaped grey steel blade 30 cm long on a short round socket wrapped in black cord. Vertical, point up, floating, isolated single object, no stand, no hand. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Gốc** như G6. 0,5–1,5k. **Symmetry: bật.**

### P13 · WPN_dadao_v2 · Đại đao cán dài, làm lại chỗ gắn lưỡi

Làm lại G3 (đã sửa FIX một lần). Bản cũ: lưỡi lớn nằm cạnh phần trên của cán như lá cờ. Bước nướng đang bù bằng `side: true, flip: true` (`design/tools/bake/catalog.mjs:33`), nên đây là sửa cho đẹp, không gấp. Câu `like a Chinese guandao` không nói lưỡi và cán thẳng hàng, mà lưỡi quan đao vốn lệch trục, nên công cụ gắn lưỡi bên hông (suy luận). Chạy `latest` (meshy-5 từng mất lưỡi). Khi chuyển bước nướng sang tệp này thì bỏ `side`, `flip` của mục `dadao` trong catalog.

PROMPT (dán thẳng):
```text
Long pole glaive, 13th-century East Asia, 2.6 m long. Plain brown wooden pole; its top end goes straight into the base of one big curved single-edged grey steel blade 75 cm long and 26 cm wide, blade and pole in one straight line, gold ring at the joint, iron butt cap. Vertical, blade up, floating, isolated single object, no stand, no hand. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Gốc** và grip2 như G3. 1–3k. **Symmetry: tắt** (lưỡi một cạnh, cong về một phía).

### P14 · OFF_doitruong_v2 · Đội trưởng Nguyên, làm lại tư thế

Làm lại B6. Bản cũ: gần T-pose (khung rộng 1,50 m); khung xương nướng không có tay phải (vai phải đặt ở x 0,75, tức đầu ngón tay; khuỷu và cổ tay phải dài 0). Mũ và giáp lấy đúng câu FIX đã dựng ra đúng (`MONGOL_HELM2` trong `meshy.mjs`, giáp vảy thay giáp phiến), vì FIX không theo sang mã `_v2`. Trong lúc chờ, Claude đặt được khớp tay bằng tay trong catalog như `FIX_OFF_TUONG` (`design/tools/bake/catalog.mjs:5-8`), không tốn credit.

PROMPT (dán thẳng):
```text
Mongol-Yuan squad captain, 13th century, about 30, clean-shaven face. Open-face Mongol helmet: tall onion-shaped steel bowl rising to a thin spike, brown fur band, leather neck flap. Blue-grey steel scale cuirass and shoulder guards with silver trim, dark indigo robe and skirt flaps, black boots. A-pose, straight arms 45° down, elbows straight, relaxed open hands, fingers together, feet shoulder-width, facing front, mouth closed. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 10–12k; cao 1,78 m. **Symmetry: bật.** Đi kèm như B6.

---

## Danh sách kiểm tra trước khi gửi tệp cho Claude

Mở tệp GLB ở `gltf-viewer.donmccurdy.com` hoặc `3dviewer.net` (kéo thả tệp vào trang web), hoặc xem ngay trong trình xem của Meshy, Tripo trước khi tải về, rồi soát:

**Nhân vật, lính, dân làng**
- [ ] A-pose: tay chếch xuống khoảng 45°, không dang thẳng (T-pose), không khép sát người.
- [ ] Bàn tay **mở**, ngón hơi xoè, **tay không**: không cầm gì, không có vũ khí dính vào tay. Bao đao **rỗng** ở hông thì được; bao có chuôi đao thò ra thì làm lại (mục 0.3). Mục viết bằng POSE v2 (mục 2.2): tay thẳng, khuỷu thẳng, bàn tay thả lỏng, ngón khép, không ngửa bàn tay.
- [ ] Tỉ lệ người thật: không chibi, không đầu to, không tay chân ngắn cũn (trẻ con DAN_TRE thì theo tỉ lệ trẻ em tự nhiên).
- [ ] Không áo choàng, không cờ lưng (hai thứ này để riêng ở nhóm H).
- [ ] Chân rộng bằng vai, mặt nhìn thẳng, miệng khép.
- [ ] Ngón tay rời nhau (mục POSE v2 thì ngón khép là đúng); có khe giữa cánh tay và thân, giữa hai đùi (mục 0.7).
- [ ] Lính đám đông (nhóm C, D) cùng chiều cao, cùng tỉ lệ với DV_GIAO (mục 0.7).
- [ ] Đúng mũ và màu của phe (so bảng màu mục 2.5); không có chữ, logo, máu.
- [ ] Đúng thời đại và giữ phẩm giá: quân Trần không ra dáng samurai (mũ kabuto, giáp o-yoroi), không áo nhà Thanh; quân Nguyên mặc giáp phiến, không giáp tấm châu Âu, là người lính nghiêm trang, không sừng, không mặt quái vật hay biếm hoạ (mục 2.6).
- [ ] Đồ chỉ có ở một bên (ống tên, hộp tên, bao tay, dây vắt vai) vẫn ở một bên, không bị nhân đôi sang bên kia (mục 0.2, Symmetry).
- [ ] Không có bệ, sàn, bóng đổ hay đèn trong tệp.
- [ ] Mục làm lại `_v2` (mục P): đúng chỗ đã sửa ở cột "Bản làm lại" của bảng mục P, so cạnh ảnh bản cũ; mục đầu trần không mọc mũ.
- [ ] Số tam giác nằm trong khoảng ở bảng mục 1 (đám đông 1,5–3k; cận vệ 4–8k; tướng, sĩ quan và nhân vật chính 10–20k, Đội trưởng Nguyên 10–12k).

**Vũ khí, đạo cụ, ngựa**
- [ ] Mỗi tệp một vật; không có tay, giá đỡ hay bệ.
- [ ] Tỉ lệ đúng: dài và rộng gần với số trong mục.
- [ ] Số tam giác nằm trong khoảng ở cột "Tam giác" của bảng mục 1 (ngựa đám đông 4–8k, ngựa tướng 8–15k; vũ khí chỉ lính đám đông dùng 300–800; các vũ khí khác theo từng dòng).
- [ ] Ngựa đứng thẳng bốn chân, không có người cưỡi.
- [ ] Voi đứng thẳng bốn chân, vòi thả thẳng, lưng **trơn** (không bành, không vải phủ, không người cưỡi); ngà có chóp đồng.

**Môi trường (mục K–O)**
- [ ] Một vật; không người, không nước, không đất (trừ gò đá, chân cột đá vôi); không chữ trên bia, cờ, buồm, hòm, bao; cột cờ chỉ có cán trần.
- [ ] Tỉ lệ dài : rộng : cao gần với cột "Kích thước thật" ở bảng của mục; số mét tuyệt đối Claude sửa khi nướng (Meshy chuẩn hoá mọi mẫu về khoảng 1,9 đơn vị).
- [ ] Thuyền đủ cột buồm và mái chèo như mục ghi: chiến thuyền 3 cột, kỳ hạm 2, hộ vệ 2, thuyền dò 1 cột và 2 chèo mỗi bên, thuyền Trần 5 chèo mỗi bên và không mui; boong trống chỗ lính đứng; chiều cao boong và cột đúng tỉ lệ cột 7 của bảng K; không có cán cờ (code giữ).
- [ ] Cây, tre, lau có lá khối đặc, không tấm lá mỏng trong suốt.

**Mọi tệp**
- [ ] Định dạng `.glb`, texture **nhúng sẵn** trong tệp, cỡ 1024–2048, **không có bóng hay ánh sáng in sẵn** trong texture.
- [ ] Tệp tĩnh, chưa rig cũng được (Claude rig bằng Blender).
- [ ] Tên tệp đúng quy tắc mục 0.5 (ví dụ `char_H35_tran-quoc-toan.glb`).
- [ ] Đơn vị mét, mặt hướng +Z, gốc giữa hai bàn chân, mặt đất y = 0: **làm được thì tốt, sai thì Claude sửa**.
- [ ] Gửi kèm ảnh mẫu đã dùng (nếu có), để Claude so màu và chi tiết.
