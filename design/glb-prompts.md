# Prompt tạo GLB: tướng, lính, cận vệ, vũ khí, đạo cụ, ngựa, voi

Tài liệu này gom prompt để bạn tạo mẫu 3D (GLB) bằng công cụ AI (Meshy, Tripo, Rodin, Hunyuan3D…) cho mọi nhân vật đang có trong game **Hào Khí Đông A**. Bạn gửi tệp GLB, Claude sẽ rig, làm hoạt ảnh và thay khối hình dựng bằng code hiện nay.

**Đã tạo bằng Meshy API (2026-10-02):** 40 tệp game hiện cần nằm ở `design/glb/` (nhân vật, vũ khí, đạo cụ, thú cưỡi để thư mục riêng), tạo bằng `design/tools/meshy.mjs` từ đúng các PROMPT dưới đây; xem `design/glb/README.md` cho tình trạng từng tệp.

Ngoại hình và màu bám theo cách game đang vẽ: `game/js/battle/models.js` (RIGS: tướng, sĩ quan, cận vệ, người lính Tự do) và `game/js/battle/soldiers.js` (lính đám đông, ngựa, dân làng). Chỗ game còn thiếu thì lấy từ `design/canon.json` và truyện tranh (`comic/_shared/bible.json`). Chi tiết mà không nguồn nào ghi thì tài liệu tự chọn và đánh dấu **(đề xuất)** ở phần tiếng Việt.

---

## 0. Đọc nhanh

### 0.1 Hai cách dùng

1. **Chữ → 3D (nhanh nhất).** Mở công cụ, chọn Text to 3D, dán nguyên khối **PROMPT** của mục. Prompt đã kèm sẵn khối tư thế và khối phong cách, dài không quá 550 ký tự (Meshy cho tối đa 600). Nếu công cụ có ô *Negative prompt* thì dán khối **NEGATIVE** ở mục 2.3.
2. **Ảnh mẫu → 3D (đẹp và ổn định hơn).** Dùng công cụ tạo ảnh để vẽ ảnh mẫu trước, chọn ảnh ưng ý, rồi đưa vào Image to 3D. Prompt ảnh mẫu = khối **ẢNH-MỞ** + PROMPT của mục + khối **ẢNH-ĐÓNG** (mục 2.4, có ví dụ ghép sẵn). Ảnh mẫu luôn ra một tờ có hai hình (mặt trước và nghiêng). **Luôn cắt tờ ảnh thành từng hình riêng, đừng đưa cả tờ vào công cụ 3D**: đưa cả tờ thì công cụ sẽ dựng ra hai người dính nhau hoặc một lưới hỏng. Công cụ chỉ nhận một ảnh: chỉ đưa ảnh **mặt trước**. Công cụ nhận nhiều ảnh (multi-view): ảnh mặt trước vào ô Front, ảnh nghiêng vào ô Left hoặc Right tuỳ ảnh cho thấy sườn trái hay sườn phải của nhân vật (xem hình minh hoạ cạnh từng ô trong công cụ). Cách này còn giữ được **cùng một khuôn mặt** giữa các tệp, ví dụ người lính Tự do ở bậc thấp và bậc cao.

Mẹo giữ phong cách đồng đều: làm xong ảnh mẫu đầu tiên (H35) thì dùng nó làm ảnh tham chiếu phong cách cho mọi ảnh mẫu sau.

### 0.2 Cài đặt trong công cụ

Mỗi công cụ đặt tên tuỳ chọn khác nhau. Cần chỉnh mấy thứ sau:

- **Số tam giác / số mặt mục tiêu** (Target polycount, Face limit): đặt theo cột "Tam giác" ở bảng mục 1.
- **Kiểu lưới** (Topology ở Meshy, Mesh mode ở Rodin): chọn **Triangle** (hoặc Raw). Nếu công cụ chỉ cho lưới tứ giác (Quad) thì đặt số mặt bằng **một nửa** cột "Tam giác", vì mỗi mặt tứ giác khi xuất GLB thành hai tam giác.
- **Tư thế**: nếu có tuỳ chọn A-pose thì bật.
- **Texture**: cỡ 1024 hoặc 2048, xuất **GLB** có texture nhúng sẵn.
- **Đối xứng** (Symmetry): bật cho ngựa và cho nhân vật mặc đồ cân hai bên. **Tắt** (Off, hoặc để Auto) với các mẫu có đồ lệch một bên: ống tên hay hộp tên sau lưng, bao tay một bên, dây vắt chéo vai. Đó là A4 H40, A6 H38, C3 DV_NO, C4 DV_AOTONG, D3 NG_CUNG, D5 NG_KY, F1 CV_khien, F3 CV_cung; phần Kỹ thuật của các mục này có ghi "Symmetry: tắt". Bật đối xứng thì công cụ sẽ nhân đôi các chi tiết đó sang bên kia, dời vào giữa, hoặc xoá mất.

### 0.3 Phải đúng ngay khi tạo, và phần Claude tự sửa được

| Phải đúng ngay trong tệp (Claude không sửa được) | Claude tự sửa được (không cần lo) |
| --- | --- |
| A-pose: tay chếch xuống khoảng 45°, bàn tay mở, ngón hơi xoè, **tay không** | Đổi đơn vị sang mét, chỉnh chiều cao |
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
| 5 (tuỳ chọn) | H34, H38 (chưa có trong game), DV_AOTONG, vũ khí riêng (quạt, đại phủ…), ngựa tướng, voi chiến + bành + Dã Tượng, dân làng | Game chưa dùng, hoặc chỉ là cảnh nền |

### 0.5 Tên tệp

Tên tệp luôn suy ra được từ cột **Mã** ở bảng mục 1, theo ba quy tắc:

- **Tướng có tên** (mã H.., X..): `char_<mã>_<tên>.glb`. Mã giữ chữ hoa; tên viết thường không dấu, mỗi âm tiết nối bằng `-`. Ví dụ `char_H35_tran-quoc-toan.glb`.
- **Sĩ quan chung, người lính Tự do, cận vệ, lính đám đông, dân làng** (mã OFF_.., LINH_.., CV_.., DV_.., NG_.., DAN_..): mã đã gồm cả tên, nên tệp là tiền tố + mã giữ nguyên. Nhân vật dùng rig: `char_<mã>.glb`, ví dụ `char_OFF_tuong.glb`, `char_CV_khien.glb`, `char_LINH_r01.glb`. Lính đám đông và dân làng: `unit_<mã>.glb`, ví dụ `unit_DV_GIAO.glb`, `unit_DAN_NAM.glb`.
- **Vũ khí, đạo cụ, ngựa** (mã WPN_.., PROP_.., MOUNT_..): tiền tố viết thường (`wpn_`, `prop_`, `mount_`) + phần còn lại của mã, viết thường, `_` đổi thành `-`. Tên ghép đã viết liền trong mã thì giữ liền. Ví dụ `WPN_songdao` → `wpn_songdao.glb`, `WPN_dao_linh` → `wpn_dao-linh.glb`, `PROP_co_lung` → `prop_co-lung.glb`, `MOUNT_ngua_nguyen` → `mount_ngua-nguyen.glb`.
- Làm lại thì thêm hậu tố `_v2`, `_v3`, đừng ghi đè tệp cũ.

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
- **Có khe hở để xương tách được.** Ngón tay rời nhau, có khe giữa cánh tay và thân (nách), có khe giữa hai đùi. Chỗ nào dính liền thì rig kéo cả mảng lưới theo.
- **Áo không dài quá gối.** Prompt đều ghi áo tới gối. Áo bào phủ kín hai chân sẽ bị xé khi bước. Nếu công cụ ra áo dài hơn thì vẫn gửi, nhưng ghi chú để Claude thêm xương cho vạt áo.
- **Lính đám đông dùng chung một thân.** Game vẽ hàng trăm lính bằng một bộ xương chung, nên mọi mẫu nhóm C và D phải cùng chiều cao, cùng tỉ lệ (vai, tay, chân), chỉ khác mũ, giáp, áo. Làm DV_GIAO trước, rồi dùng ảnh mẫu của nó làm ảnh tham chiếu dáng người cho các kiểu lính còn lại, kể cả lính Nguyên. NG_TANK to con hơn là do code phóng to, không cần tạo thân to hơn.
- **Dung lượng.** Cả game hiện khoảng 28 MB. Claude sẽ nén mọi tệp: texture lính đám đông và vũ khí còn 1024, nhắm mỗi lính đám đông ≤ 1 MB, mỗi tướng ≤ 3–4 MB. Bạn cứ xuất 2048 nếu công cụ cho.
- **Bản quyền.** Game đang công khai trên mạng. Nhiều công cụ AI 3D ở gói miễn phí cấp tệp theo giấy phép CC BY (phải ghi công) hoặc không cho dùng thương mại. Kiểm gói bạn đang dùng và báo Claude để ghi nguồn vào `game/assets/SOURCES.md`.

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
| 53 | DAN_NAM | `unit_DAN_NAM.glb` | Dân làng nam (tuỳ chọn) | J | 1,5–3k | 1,65 m | PROP_quang_ganh |
| 54 | DAN_NU | `unit_DAN_NU.glb` | Dân làng nữ (tuỳ chọn) | J | 1,5–3k | 1,55 m | PROP_tay_nai |
| 55 | DAN_TRE | `unit_DAN_TRE.glb` | Trẻ con làng (tuỳ chọn) | J | 1–2k | 1,15 m | PROP_tay_nai (thu nhỏ) |
| 56 | PROP_quang_ganh | `prop_quang-ganh.glb` | Đòn gánh + hai thúng (tuỳ chọn) | J | 1–2k | đòn 1,7 m | — |
| 57 | PROP_tay_nai | `prop_tay-nai.glb` | Tay nải (tuỳ chọn) | J | 200–500 | 0,36 m | — |
| 58 | MOUNT_voi_chien | `mount_voi-chien.glb` | Voi chiến (thân trơn, chưa có trong game) | I | 10–20k | vai 2,7 m | PROP_banh_voi, PROP_giap_voi |
| 59 | PROP_banh_voi | `prop_banh-voi.glb` | Bành voi + vải phủ (chưa có trong game) | I | 1–3k | sàn 1,4 m | — |
| 60 | PROP_giap_voi | `prop_giap-voi.glb` | Giáp đầu voi (tuỳ chọn) | I | 0,5–1,5k | 1,0 m | — |
| 61 | WPN_moc_voi | `wpn_moc-voi.glb` | Móc voi (tuỳ chọn) | G | 0,3–1k | 0,7 m | — |
| 62 | H39 | `char_H39_da-tuong.glb` | Dã Tượng, người cưỡi voi (chưa có trong game) | A | 10–20k | 1,78 m | WPN_moc_voi, WPN_giao_dv, MOUNT_voi_chien |

Cần cho game hiện tại: mục 1–4, 7–15, 17–41 (trừ 23a), 49 và 51. Cờ (47) và áo choàng (48) Claude dựng bằng code cũng được (xem nhóm H), nên tuỳ bạn. Voi và Dã Tượng (58–62) làm sẵn cho các trận sau (lớp vũ khí WC16 Voi chiến trong `systems.md`); game hiện chưa có voi. Còn lại là tuỳ chọn.

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

### 2.3 NEGATIVE (dán vào ô Negative prompt nếu công cụ có)

**NEGATIVE-NV**, cho nhân vật, lính, dân làng, ngựa và voi. Với ngựa thì thêm `, rider, person` vào cuối; với voi thì thêm `, rider, person, howdah, saddle`. Với người cưỡi NG_KY thì thêm `, horse, saddle, sitting, mounted`.

```text
weapon, sword, spear, bow, shield, holding, cape, cloak, flag, T-pose, pedestal, base, anime, chibi, cartoon, photorealistic, text, logo, samurai armor, kabuto, Qing dynasty clothing, queue braid, European plate armor, Nguyen dynasty court dress, monster, demon, orc, horns, skull, fangs, grotesque, caricature, evil villain, gore, blood, baked lighting, baked shadows
```

**NEGATIVE-VK**, cho vũ khí và đạo cụ:

```text
hand, person, character, holding, stand, rack, pedestal, base, wall mount, text, letters, runes, glowing, fantasy ornament, anime, chibi, cartoon, katana, European sword, gore, blood, baked lighting, baked shadows
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

### 2.6 Nguyên tắc nội dung

- **Quân Trần, thế kỷ 13**: áo vải dài tới gối, giáp phiến hoặc giáp da sơn then, nón lá, khăn quấn, búi tóc, mũ trụ đơn giản. Không dùng áo dài, khăn xếp, mũ cánh chuồn của triều Nguyễn; không giáp samurai Nhật; không áo hay tóc đuôi sam nhà Thanh.
- **Quân Nguyên kiểu Mông Cổ – Nguyên**: giáp phiến (lamellar), mũ trụ nhọn viền lông hoặc có vải che gáy, mũ lông, áo del vạt chéo, ủng cưỡi ngựa, cung phản khúc. Đúng như code đang vẽ (mũ `munguyen`, `mulong`).
- **Không biếm hoạ, không xấu xí hoá kẻ địch.** Canon ghi tướng Nguyên là đối thủ có danh dự (X19, X20, X24 `dignity`). Lính Nguyên không đáng sợ hơn hay đáng cười hơn lính ta.
- Không máu me, không thương tích (`systems.md:1227`, `scenery.js:438`).
- Không đưa chữ lên mẫu. Chữ trên cờ do code vẽ (`models.js:421-433`); không thích chữ "Sát Thát" lên tay.
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
Rugged Vietnamese naval general, 13th-century Tran dynasty, about 45, broad shoulders, sun-tanned weathered face, short full beard, topknot. Dark brown lacquer lamellar armor with gold trim and pauldrons, red under-robe, teal sash, dark trousers, black boots, faint charcoal dust on the clothes. A-pose, arms 45° down, open empty hands, fingers slightly apart, feet shoulder-width, facing front, mouth closed. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 10–20k; cao 1,88 m.
- **Vũ khí**: WPN_daikiem_vandon (tuỳ chọn).
- **Ảnh tham chiếu**: `game/assets/comic/B20/O7.webp`.
- **Lưu ý**: không khai thác đời tư (`canon.json:2906`).

### A6 · H38 · Yết Kiêu · tướng ta, chưa có trong game

Đang dựng ("sắp có" ở B20). Danh tính là Chính sử; tài lặn và đục thuyền là Tương truyền. Theo truyện: thợ lặn thủy quân, người gầy gân guốc, cởi trần, khăn đen buộc trán, quần sẫm tới gối, cuộn dây thừng vắt vai. Khoảng 30 tuổi **(đề xuất; truyện vẽ trẻ, thần tích cho khoảng 46)**.

PROMPT (dán thẳng):
```text
Lean wiry Vietnamese navy diver, 13th-century Tran dynasty, around 30, bare-chested, sun-darkened skin, black cloth headband over a small topknot. Dark knee-length trousers, red cloth sash, barefoot, coiled hemp rope slung across one shoulder, small cloth pouch at the hip. A-pose, arms 45° down, open empty hands, fingers slightly apart, feet shoulder-width, facing front, mouth closed. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 10–20k; cao 1,72 m. **Symmetry: tắt** (dây vắt một vai, túi một bên hông). Cuộn dây dính thân.
- **Vũ khí**: WPN_doandao + WPN_duisat (tuỳ chọn).
- **Ảnh tham chiếu**: `game/assets/comic/B20/O6.webp`, `O7.webp`.
- **Lưu ý**: không đưa chuyện "nàng Vân" vào game; lặn và đục thuyền gắn nhãn Tương truyền (`canon.json:3233`).

### A7 · H39 · Dã Tượng · người cưỡi voi, chưa có trong game

Gia tướng của Hưng Đạo vương cùng Yết Kiêu. Danh tính và lời nói năm 1285 là Chính sử; tài điều khiển voi chiến là **Tương truyền**, gắn với cái tên "Dã Tượng" (voi rừng). Vũ khí riêng trong canon: voi chiến "Voi Rừng" đeo bành gỗ, ngà bọc đồng; ông đánh bằng **móc voi** và **giáo ngắn** trên lưng voi. Canon không tả mặt mũi: khoảng 35 tuổi, vai rộng, râu ngắn, khăn nâu là **(đề xuất)**. Ngồi trên bành hay trên cổ voi là tư thế Claude dựng bằng rig, nên mẫu vẫn A-pose.

PROMPT (dán thẳng):
```text
Strong Vietnamese war-elephant handler, 13th-century Tran dynasty, about 35, broad weathered face, short black beard, black topknot under a brown cloth head wrap. Brown knee-length tunic, black lacquer lamellar vest with bronze trim, leather bracers, red sash, dark trousers, black cloth shoes. A-pose, arms 45° down, open empty hands, fingers slightly apart, feet shoulder-width, facing front, mouth closed. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 10–20k; cao 1,78 m.
- **Vũ khí**: WPN_moc_voi (tay phải) + WPN_giao_dv (Claude rút ngắn còn khoảng 2 m). **Voi**: MOUNT_voi_chien + PROP_banh_voi.
- **Lưu ý**: mọi chiến công trên voi gắn nhãn Tương truyền (`canon.json`, H39 notes).

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
Southern Song exile soldier, 13th century, short black beard, black cloth head-wrap knotted at the back, jade-green scarf knotted at the neck. Knee-length round-collar amber-ochre robe, brown leather lamellar vest, leather belt, dark trousers, black cloth boots, arrow quiver at the right hip. A-pose, arms 45° down, open empty hands, fingers slightly apart, feet shoulder-width, facing front, mouth closed. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 1,5–3k; cao 1,75 m. **Symmetry: tắt** (ống tên một bên hông). Áo hổ phách khoảng `#b0752c` (lấy màu nền cờ 宋, `kesach.js:76`); khăn cổ xanh ngọc khoảng `#2f8f83` **(đề xuất)**. Không có dải khăn buông: mẫu lính đám đông giữ lưới nhẹ, nút khăn sau gáy là đủ.
- **Vũ khí**: WPN_cung_viet (theo Toàn thư: cung tên), hoặc giữ vũ khí DV như game hiện nay.
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

Một tệp dùng chung cho ba người. Cờ sáu chữ 破強敵報皇恩 của H35: chữ là Chính sử, màu đỏ chữ vàng là Hư cấu (`suquan-b15.js:99-105`). Cờ 烏馬兒 của X20 và cờ 樊 của X24 là Hư cấu. Vải để **trơn, không chữ**; code vẽ chữ và đổi màu nền (`models.js:421-433`). Game vẽ cán sơn then (truyện vẽ cán tre). Núm vàng trên đỉnh là **(đề xuất)**.

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

- **Kỹ thuật**: 300–1000.

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

Chỉ có ở B15, là cảnh nền dân chạy loạn (`ambient.js`). Dân không bị đánh trúng, địch không nhìn thấy (`ambient.js:979-980`). "Vườn không nhà trống" năm 1285 là Chính sử; từng người dân là Hư cấu. Chiều cao là **(đề xuất)**. Cụ già chống gậy dùng chung thân DAN_NAM (code làm còng lưng); em bé được bế dùng DAN_TRE thu nhỏ. Trẻ chăn trâu thổi sáo cũng dùng DAN_TRE, Claude dựng tư thế ngồi; con trâu nằm ngoài phạm vi tài liệu này.

### J1 · DAN_NAM · Dân làng nam

Gánh quang gánh. Màu theo `soldiers.js:394-437`: áo nâu củ nâu `#5e4330`, thắt lưng `#8a7550`, quần thâm `#2b2825`, nón lá `#d8c48e`.

PROMPT (dán thẳng):
```text
Vietnamese peasant man, 13th century, about 40, lean, plain face, black hair bun at the nape under a dark headcloth, wide conical palm-leaf hat. Brown hip-length tunic with sleeves rolled past the elbows, khaki sash, black trousers rolled to mid-calf, barefoot. A-pose, arms 45° down, open empty hands, fingers slightly apart, feet shoulder-width, facing front, mouth closed. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 1,5–3k; cao 1,65 m. **Đi kèm**: PROP_quang_ganh. Gậy tre của cụ già Claude dựng bằng code.

### J2 · DAN_NU · Dân làng nữ

Đội tay nải, ôm tay nải hoặc bế con. Áo nâu `#684832` tay dài, váy đen `#221f1c` hai tấm, khăn vấn `#2e2622`, không đội nón.

PROMPT (dán thẳng):
```text
Vietnamese peasant woman, 13th century, about 30, gentle tired face, hair wrapped in a dark cloth turban. Long-sleeved brown tunic, khaki sash, black two-panel skirt to mid-calf with dark hem, barefoot. A-pose, arms 45° down, open empty hands, fingers slightly apart, feet shoulder-width, facing front, mouth closed. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 1,5–3k; cao 1,55 m. Váy hai tấm có lắc như vạt áo lính. **Đi kèm**: PROP_tay_nai.

### J3 · DAN_TRE · Trẻ con làng

Đi bộ cạnh mẹ hoặc được bế. Chỏm tóc trái đào, áo nâu `#6f5238` cộc tay, quần cộc `#2b2825`.

PROMPT (dán thẳng):
```text
Vietnamese village child, 13th century, about 7, natural child proportions, small tuft of black hair at the front of a shaved head, brown short-sleeved tunic, black shorts, barefoot. A-pose, arms 45° down, open empty hands, fingers slightly apart, feet shoulder-width, facing front, mouth closed. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 1–2k; cao 1,15 m. **Đi kèm**: PROP_tay_nai thu nhỏ (bọc nhỏ xách tay).

### J4 · PROP_quang_ganh · Đòn gánh và hai thúng

Theo `soldiers.js:405-415, 459`: đòn tre `#b19a5c`, thúng `#8c7a52`; thúng trước đựng gạo và nồi đất, thúng sau đựng bọc vải chàm và chiếu cuộn.

PROMPT (dán thẳng):
```text
Vietnamese carrying set: 1.7 m bamboo shoulder pole with two round woven bamboo baskets hanging from four ropes each; one basket holds rice and a clay pot, the other an indigo cloth bundle and a rolled straw mat. Isolated single object, no person. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 1–2k. Gốc ở giữa đòn (chỗ tì vai). Hai thúng có thể tách để lắc theo bước chân.

### J5 · PROP_tay_nai · Tay nải

Bọc vải chàm `#3d4a5e`, nút buộc `#55627a` có hai tai (`soldiers.js:460-461`).

PROMPT (dán thẳng):
```text
Indigo cloth bundle, about 36 cm wide, soft folds, tied with a knot on top showing two small ears. Isolated single object, no hand. Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.
```

- **Kỹ thuật**: 200–500. Gốc ở giữa đáy bọc.

---

## Danh sách kiểm tra trước khi gửi tệp cho Claude

Mở tệp GLB ở `gltf-viewer.donmccurdy.com` hoặc `3dviewer.net` (kéo thả tệp vào trang web), hoặc xem ngay trong trình xem của Meshy, Tripo trước khi tải về, rồi soát:

**Nhân vật, lính, dân làng**
- [ ] A-pose: tay chếch xuống khoảng 45°, không dang thẳng (T-pose), không khép sát người.
- [ ] Bàn tay **mở**, ngón hơi xoè, **tay không**: không cầm gì, không có vũ khí dính vào tay. Bao đao **rỗng** ở hông thì được; bao có chuôi đao thò ra thì làm lại (mục 0.3).
- [ ] Tỉ lệ người thật: không chibi, không đầu to, không tay chân ngắn cũn (trẻ con DAN_TRE thì theo tỉ lệ trẻ em tự nhiên).
- [ ] Không áo choàng, không cờ lưng (hai thứ này để riêng ở nhóm H).
- [ ] Chân rộng bằng vai, mặt nhìn thẳng, miệng khép.
- [ ] Ngón tay rời nhau; có khe giữa cánh tay và thân, giữa hai đùi (mục 0.7).
- [ ] Lính đám đông (nhóm C, D) cùng chiều cao, cùng tỉ lệ với DV_GIAO (mục 0.7).
- [ ] Đúng mũ và màu của phe (so bảng màu mục 2.5); không có chữ, logo, máu.
- [ ] Đúng thời đại và giữ phẩm giá: quân Trần không ra dáng samurai (mũ kabuto, giáp o-yoroi), không áo nhà Thanh; quân Nguyên mặc giáp phiến, không giáp tấm châu Âu, là người lính nghiêm trang, không sừng, không mặt quái vật hay biếm hoạ (mục 2.6).
- [ ] Đồ chỉ có ở một bên (ống tên, hộp tên, bao tay, dây vắt vai) vẫn ở một bên, không bị nhân đôi sang bên kia (mục 0.2, Symmetry).
- [ ] Không có bệ, sàn, bóng đổ hay đèn trong tệp.
- [ ] Số tam giác nằm trong khoảng ở bảng mục 1 (đám đông 1,5–3k; cận vệ 4–8k; tướng, sĩ quan và nhân vật chính 10–20k, Đội trưởng Nguyên 10–12k).

**Vũ khí, đạo cụ, ngựa**
- [ ] Mỗi tệp một vật; không có tay, giá đỡ hay bệ.
- [ ] Tỉ lệ đúng: dài và rộng gần với số trong mục.
- [ ] Số tam giác nằm trong khoảng ở cột "Tam giác" của bảng mục 1 (ngựa đám đông 4–8k, ngựa tướng 8–15k; vũ khí chỉ lính đám đông dùng 300–800; các vũ khí khác theo từng dòng).
- [ ] Ngựa đứng thẳng bốn chân, không có người cưỡi.
- [ ] Voi đứng thẳng bốn chân, vòi thả thẳng, lưng **trơn** (không bành, không vải phủ, không người cưỡi); ngà có chóp đồng.

**Mọi tệp**
- [ ] Định dạng `.glb`, texture **nhúng sẵn** trong tệp, cỡ 1024–2048, **không có bóng hay ánh sáng in sẵn** trong texture.
- [ ] Tệp tĩnh, chưa rig cũng được (Claude rig bằng Blender).
- [ ] Tên tệp đúng quy tắc mục 0.5 (ví dụ `char_H35_tran-quoc-toan.glb`).
- [ ] Đơn vị mét, mặt hướng +Z, gốc giữa hai bàn chân, mặt đất y = 0: **làm được thì tốt, sai thì Claude sửa**.
- [ ] Gửi kèm ảnh mẫu đã dùng (nếu có), để Claude so màu và chi tiết.
