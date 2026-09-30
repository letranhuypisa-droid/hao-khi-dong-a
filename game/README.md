# Hào Khí Đông A — bản thử B15 Hàm Tử (PROTO)

Game hành động Nam Quốc Sơn Hà, quyển Nhà Trần. Bản này dựng theo tab **Đặc tả prototype (mục 21)** và **Mục 15 · Kỹ thuật (web)** của GDD, cộng phần tiến triển ở mục 12 (GDD để phần đó cho VS; bản này làm sớm theo yêu cầu).

Engine: three.js r186.1 (vendor trong `vendor/three/`), JavaScript ES module thuần, không build step.

## Chạy

```bash
node tools/dev-server.mjs 8942
```

Mở `http://localhost:8942/hao-khi-viet/game/`. Thêm `?debug` để có `window.__hk`, `__bot`, `__state` và `__hk.advance(giây, bot)` (tua trận không cần khung hình). Thêm `?nolanes` để tắt lũy, hào, hố trên hai làn (so sánh, máy yếu).

Màn **Huấn luyện** (thẻ Huấn luyện ở Doanh trại, hoặc khung "Lần đầu ra trận?" ở thẻ Xuất trận): 11 bài tập có mục tiêu trên sân Võ trường rồi 4 thẻ giải thích chỉ huy, chừng 4 phút; không cần Doanh trại cấp 3. Thẻ Huấn luyện còn có bảng đòn có icon theo bàn phím / cảm ứng / tay cầm.

Xem hoạt ảnh lính và tướng theo từng trạng thái: mở `http://localhost:8942/hao-khi-viet/game/lab.html` (chỉ dùng khi phát triển; tham số ở đầu `js/lab.js`). `&ground=slope|bumps|ledge` đặt hình lên dốc, gò, bậc đất để xem chân bám đất; `view=rigs&rigs=tuong,H33,photuong&m=run` xem sĩ quan, boss, tướng đồng minh; `&play` chạy thời gian thật.

Chụp màn hình trận hoặc lab bằng Chrome headless (không cần pane trình duyệt, chạy song song được): `node hao-khi-viet/game/tools/shot.mjs <kịch-bản.mjs> --port 8942` — cách viết kịch bản ở đầu file.

Kiểm thử phần thuần (mô phỏng, Hào Khí, tiến triển, kiểu lính, IK và dây treo, địa hình làn đánh, va chạm, luật đất cao thấp, hoạt ảnh lính, trời nắng theo pha):

```bash
node hao-khi-viet/game/tests/run.mjs
```

## Có gì

| Phần | Nội dung | Nguồn GDD |
| --- | --- | --- |
| Bản đồ | Bến Hàm Tử 600 × 400 m, sông Hồng mép bắc và mép đông, 2 mặt trận cách 150 m, bản doanh, 2 đồn, 2 doanh trại, Hàm Tử quan có 2 cổng, bãi cát cho boss | 21.2 (bố cục Hư cấu) |
| Cảnh | Màu đất theo nhiễu (cỏ tươi, cỏ khô, đất trống, đầm ven sông, đất cháy quanh trại Nguyên); ruộng lúa bậc thềm có bờ, ô ngập nước, mạ, lúa chín; lũy tre quanh làng, cây đa đầu làng, cau; 4 gò đá giữa hai mặt trận; cỏ, hoa dại; bến gỗ, thuyền nan; giáo cắm, khiên rơi, tên cắm, xe hỏng dọc làn; lều cháy, hòm, thùng, khói ở trại Nguyên; núi xa, mây. Cột cờ che camera thì tự mờ | Hư cấu (scenery.js) |
| Cảnh Võ trường | Khán đài mái son 10 gian có 97 quân Trần đứng xem, reo hò khi tướng hạ địch; đài chỉ huy có lọng vàng, ghế, trống đồng; bia đá "Sát Thát" (hai chữ quân Trần thích lên tay là Chính sử, tấm bia là Hư cấu); vạc lửa hai bên mỗi cổng; trường bắn cung 5 bia; 16 lều trại; đường đất từ 4 cổng; cỏ theo nhiễu; núi, mây; lầu trống, giá binh khí, hình nộm, cột cờ nay đặt theo gờ đất (trước bị vùi) | Hư cấu (scenery.js) |
| Làn đánh | Hai làn có công trình và dấu chiến trận (`data/terrain-b15.js`, `ground.js`, `scenery.js`): ụ đất quân ta (cọc tre, sọt đất, khiên son, cờ đuôi nheo), bãi giằng co có hố đất, hố ngập nước, hố chông; hào và chiến lũy Nguyên cao 1,5 m vỡ hai đoạn (cọc nhọn trên đỉnh, phên ván mặt trước, cờ chàm rách); gò cao hai bên làn; rào tre ruộng gãy; cự mã; 16 xác ngựa (có yên cương, tên cắm, đồ rơi của kỵ binh); hào thành trước Hàm Tử quan chừa cầu đất trước hai cổng. Lưới đất mịn tới 0,6 m ở hai làn, `heightAt` trả đúng mặt đất đã vẽ. Đạo cụ che giữa camera và tướng thì thưa đi | Hư cấu |
| Đất cao thấp | Dốc lên chậm, dốc xuống nhanh hơn một chút; bùn ở đáy hố, hào làm chậm; đứng cao hơn đối thủ thì đánh mạnh hơn (tối đa +20%), thấp hơn thì yếu hơn (tối đa −15%), cung thủ trên cao bắn xa hơn (tối đa +25%); cung thủ Nguyên leo lên gò gần để bắn. Mô phỏng 1 Hz: tuyến đánh sát chân lũy Nguyên thì quân Nguyên hao ×0,75, bị đẩy lùi về ụ đất quân ta thì quân ta hao ×0,8. HUD báo "Thế đất cao/thấp ±%", "Bùn lầy"; bản đồ nhỏ vẽ lũy, hào, hố, gò (`sim/terrain-rules.js`) | ĐỀ XUẤT |
| Sự sống | Đàn cò trắng kiếm ăn ở ruộng ngập và đầm ven sông, bay lên khi có giao chiến rồi đậu chỗ yên; đàn cò bay chữ V qua trời; trâu gặm cỏ, đầm nước, có trẻ chăn trâu thổi sáo; quạ quanh xác ngựa. Dân tản cư ("vườn không nhà trống" là Chính sử của cuộc kháng chiến 1285; người và đường đi ở đây là Hư cấu): từng nhà gánh gồng, bế con, chống gậy rời làng và bến sông về phía tây nam, tránh xa hai làn, gặp giao chiến thì chạy tán loạn; hết người từ P3 (`ambient.js`) | Hư cấu |
| Trời, nắng theo pha | P1 sáng trong, P2 gần trưa sáng nhất, P3 chiều nắng cam và khói bốc trên trại Nguyên, trong thành; P4 xế chiều sang hoàng hôn: nắng đỏ vàng thấp, bóng dài, sương khói dày, thuyền chiến Nguyên cháy trên sông, tàn lửa, cổng vỡ cháy tới hết trận; Tổng Phản Công phủ ánh vàng. Chuyển pha 8 s; tải lại checkpoint đặt ngay (`atmosphere.js`) | Hư cấu |
| Tướng | H35 Trần Quốc Toản, song đao WC03: N1–N6, C1–C4 (C5 mở ở cấp 5, C6 ở cấp 10), Lướt N/C, Né 0,25 s, Đỡ 120°, phản đòn, Phá Trận 3 lần lao, Tuyệt Kỹ "Bóp Nát Quân Thù", Đòn Quyết khi Vỡ Thế, Gượng dậy | 3, 21.6 |
| Địch | Lính, tinh nhuệ, Đội trưởng, Phó tướng, Toa Đô (rút chạy khi hết Sinh lực); khiên binh và cung kỵ; thẻ tấn công theo độ khó; đòn viền đỏ báo trước 0,6 s | 11.1, 21.6 |
| Kiểu lính | Khiên binh Nguyên chia thành Đao thuẫn (đao + khiên tròn), Thương binh (tầm 2,5 m), Cung thủ bộ (bắn 16 m) và Lực sĩ trọng giáp (chùy lang nha, máu ×3, đòn nặng cắt được đòn của tướng, đòn N không đẩy lùi được). Giáo binh Đại Việt chia thành Giáo binh, Đao khiên, Nỏ thủ. Mô phỏng 1 Hz vẫn chỉ biết binh chủng | 21.5 (mở rộng) |
| Giáp lá cà (đợt 7) | Lính hai phe thật sự đánh nhau: mỗi lính giữ một đối thủ (chọn lại mỗi 0,6–1,2 s, chỉ đổi khi người mới gần hơn 2 m), tối đa 2 người đánh một lính, 4 người đánh một tướng đồng minh. Địch không có thẻ tấn công tướng thì đánh quân ta trong 7 m, bị lính đánh thì quay lại đánh trả; quân ta ưu tiên kẻ đang đánh tướng. Hai bên áp tới tầm chém rồi đứng vững mà chém (nhát có bước dồn), lính có khiên đỡ được nhát của lính. Quân đồn trú chỉ giao chiến trong vòng Cứ Điểm + 10 m, thân binh không đuổi quá 14 m khỏi tướng. Lính diễn ở tuyến giữ chỗ cố định trong đội hình (3 khối: cận chiến, cung/nỏ, cung kỵ), hàng đầu hai bên cách nhau 1,9 m và ghép cặp theo cột thay nhau chém — người bị chém giơ khiên đỡ hoặc khựng người; người ngã (do mô phỏng) bị đối thủ trước mặt chém, hàng sau bước lên lấp chỗ. Đo trong 90 s đầu trận: trước đây địch nhắm tướng 97% thời gian và 0 nhát vào quân ta, quân ta chém hụt 30% vì mục tiêu lượn quanh tướng; nay địch giao chiến với quân ta ~2/3 thời gian, chém hụt ~3%, tốc độ chạy trung bình của địch giảm một nửa | ĐỀ XUẤT (khối `AI.duel`) |
| Cảm giác trúng đòn (đợt 7) | Hit-stop dài hơn (×1,4) cộng thêm theo số người trúng, chí mạng, người ngã; camera giật theo hướng chém và thu FOV chớp nhoáng (vẫn chạy trong hit-stop); chớp sáng cả màn ở Đòn Quyết, phản đòn, đòn nặng hạ địch; tại chỗ trúng: chớp sáng, vệt chém chéo, tia lửa, tia máu kiểu mực son văng theo hướng đòn; xác bị tướng chém văng xa ×1,7 và bổng lên (đòn nặng cao hơn), rơi xuống tung bụi; chậm hình khi Đòn Quyết, hạ sĩ quan; vệt tốc độ quanh mép màn khi Phá Trận, Tuyệt Kỹ; bộ đếm "đòn liên hoàn" nảy mỗi nhát, đổi màu ở 30/60/100 | ĐỀ XUẤT (khối `IMPACT`) |
| SFX (đợt 7) | 45 mẫu sinh bằng Seed Audio (Higgsfield): chém gió nhẹ/nặng, chém trúng, đòn nặng, chạm khiên, phản đòn, Đòn Quyết, bổ đất, lao, lộn, dây cung, nỏ, tên cắm, loạt tên, kêu đau, tiếng thét, xác ngã, tù và, trống trận, hồi trống, cồng, cổng bị đập / vỡ, quân reo, sĩ quan gầm, lực sĩ húc, nhặt đồ, nút bấm, báo nguy, Tuyệt Kỹ; nền tiếng giao chiến xa và lửa trại (dày theo khoảng cách tới tuyến và số lính đang đánh quanh tướng). Mỗi lần phát chọn ngẫu nhiên biến thể, lệch cao độ ±6%, trái/phải theo camera, qua bộ nén và chút vang; tiếng đòn có lớp trầm tổng hợp chồng lên cho chắc tay; lính chém lính có trần số tiếng. Mẫu chưa nạp xong thì dùng âm tổng hợp cũ | Hư cấu |
| Icon (đợt 7) | 22 icon sơn mài (GPT Image 2): chuỗi N, C1–C6, Lướt chém, Đòn Quyết, Phản đòn, Né, Đỡ, Phá Trận, Tuyệt Kỹ (bàn tay bóp quả cam), Tổng Phản Công, Mệnh Lệnh và 4 lệnh, Kế Sách, Khóa mục tiêu. Thanh chiêu hai hàng (J / K / Space / Shift, rồi E / R / F / Tab); ô K đổi icon theo đòn C sẽ ra (N N → "C3 Lốc đao", vừa né → Lướt C, sĩ quan Vỡ Thế → nhấp nháy "ĐÒN QUYẾT"), ô J hiện chấm chuỗi N1–N6; nút cảm ứng, vòng Mệnh Lệnh, bảng tạm dừng, thẻ Huấn luyện đều có icon. Tên đòn C là Hư cấu (`data/moves-info.js`) | Hư cấu |
| AI | Lính có thẻ tấn công chia góc vây quanh tướng (có người đánh sườn, đánh lưng), lính chờ đứng thành vòng thưa; khiên binh đỡ đòn N trúng trước mặt; lính nhảy lùi khi tướng gồng đòn nặng; cung thủ lùi giữ tầm; lực sĩ lao húc (trúng thì tướng ngã); vỡ trận khi sĩ quan chết, khi tướng tung Tuyệt Kỹ, khi tướng hạ ≥ 6 lính trong 4 s; thân binh ưu tiên kẻ đang đánh tướng. Sĩ quan gầm thị uy khi phát hiện tướng, đi vòng thăm dò, bắt lỗi lúc tướng hồi đòn/vừa né, chuyển sang đòn viền đỏ khi tướng cứ đứng đỡ, lùi né khi bị dồn 3 đòn | ĐỀ XUẤT (AI trong tuning.js) |
| Hoạt ảnh | Lính có khớp (hông, thân, tay trên, cẳng tay, đùi, cẳng chân; kỵ binh có 4 chân ngựa): bước chân theo quãng đi, thế thủ theo vũ khí, báo trước → đánh → hồi thế, trúng đòn ngả theo hướng, hất tung lộn người, nằm rồi chống dậy, 4 kiểu ngã. Tướng: đòn dựng bằng khung khoá (gồng → chém → theo đà → hồi), cổ tay lật lưỡi đao, bước chân khi chém, lộn khi né, vệt lưỡi đao. **Chân bám đất** (IK hai khớp, `ik.js`): hạ hông, gập gối, cổ chân nằm theo dốc — lính trong 40 m quanh tướng, tướng, sĩ quan, boss, tướng đồng minh; ngựa nghiêng thân theo dốc; xác nằm theo dốc. Bước chân tính theo sải thật nên bàn chân chống không trượt (lính 2–5%, tướng ~6% tốc độ thân; trước 50–140%); lính xoay tại chỗ thì bước chân theo. **Vạt áo** lò xo: lính có vạt trước/sau khác dáng theo phe (Đại Việt vạt dài hẹp viền đen, Nguyên vạt xẻ có đai giáp, cung thủ áo dài, lực sĩ giáp lá), tướng có 4 vạt viền vàng xoè theo vòng xoay (N6, C3, C4, C6); áo choàng sĩ quan nhiều đoạn; cờ lưng tướng rung theo đà chạy. **Dây treo** (PBD): tua giáo, tua đại đao buông theo trọng lực và văng khi đâm, đuôi ngựa, hai dải khăn của tướng. Sĩ quan cầm giáo, đại đao dựng đứng khi chạy | 21.4 (thủ tục) |
| Quân ta | Mô phỏng 1 Hz theo công thức 4.2, Sĩ Khí, tuyến, sụp đổ cánh, tiếp viện hai phe; vùng chiến đấu r 25 m (30 địch + 20 ta); lính diễn ở tuyến theo số lính hiển thị | 4, 15.2 |
| Chỉ huy | 4 Mệnh Lệnh (Tiến công, Giữ vững, Theo ta, Gọi tiếp viện), đồng hồ trận ×0,2 khi mở vòng; 2 sự kiện động (Cứ Điểm bị phản công, Tướng ta bị vây) có thể tự làm hoặc giao cho quân | 4.5, 4.8, 21.2 |
| Hào Khí | Nguồn tăng/giảm, mốc 25/50/75/100, suy giảm sau 45 s, Hào Khí dư, Tổng Phản Công 25 s, Tuyệt Kỹ Hào Khí | 5, 21.6 |
| Pha | P1 chiếm A1 → P2 chiếm A2 → P3 phá cổng → P4 Toa Đô; checkpoint đầu pha; thua khi hết Gượng dậy, mất bản doanh, quá 30 phút | 21.2 |
| Tiến triển | Cấp 1–35 theo EXP_next = 50L² + 250; cây kỹ năng 27 nút (3 nhánh, 1 nút đỉnh); binh khí bậc Thường → Danh, rèn +1…+5, ô Khắc 7 dòng, Đúc thép; quân đoàn (giáo binh, thân binh); Doanh trại 3 cấp; 3 tiền tệ | 12 |
| Vật phẩm | Cơm nắm, Rượu thuốc, Túi quân lương, Cờ lệnh, Rương Cứ Điểm; rơi cố định theo điều kiện, không ngẫu nhiên | 4.4, 12.12 |
| Kế Sách | "Cờ áo Tống" (Lớn +20, Chính sử): hộ tống 2 thuyền quân Triệu Trung cập bến, bấm G → cánh Nguyên hoang mang. "Mũi tên thư" (Nhỏ +10, Tương truyền, chỉ Trận chuẩn): 3 bó tên ở làng → Nguyễn Khoái → bắn thư vào doanh trại. Máy trạng thái Khóa → Khả dụng → Sẵn sàng → Kết quả, không hồi chiêu | 5.6, 5.7, hồ sơ B15 |
| Chế độ | Trận nhanh (par 10, Hào Khí ×1,3, thưởng ×0,6, 1 Kế Sách, cửa sổ ×0,75) và Trận chuẩn (par 15, thưởng ×1, 2 Kế Sách) | 13.7, 5.6 |
| Võ trường | Doanh trại cấp 3: Luyện tập (chọn bậc địch), Đua KO bến Hàm Tử (180 s, 150/220/300), Thử thách thời gian theo seed, Seed tuần (tuần ISO giờ VN); Đồng bộ cấp; bảng điểm cục bộ; huy chương 5/10/15 Tinh thiết; 4 tuần Vàng → binh khí Danh | 13.5, 12.9 |
| Xếp hạng | Diem = 35M + 15T + 20Q + 20C + 10K (K = Kế Sách); S ≥ 85, A 70–84, B 50–69 | 2.3, 5.6 |
| Asset | 8 ảnh hiệu ứng (GPT Image 2, nền trong suốt) và 4 bài nhạc (Sonilo Music) sinh bằng Higgsfield CLI — xem assets/SOURCES.md, tools/render-assets.sh. Đợt 7: 22 icon, 45 SFX + 2 vòng nền — tools/render-assets-2.sh (sinh), tools/post-assets-2.py (cắt, chuẩn hoá) | — |
| Điều khiển | Bàn phím + chuột, tay cầm (Gamepad API), cảm ứng | 15.8 |

## Đề xuất của bản thử (GDD chưa chốt số)

Những chỗ dưới đây là số bản thử tự đặt, ghi `ĐỀ XUẤT BẢN THỬ` trong code; cần thiết kế chính duyệt:

- Thời lượng từng đòn WC03 (chọn để DPS đơn mục tiêu ≈ 1,6 MV/s ở ×1,0); Phá Thế = 14 × MV.
- Hệ số Sĩ Khí theo 5 dải; cánh vỡ trận tập hợp lại ở Sĩ Khí 25.
- Cung kỵ dùng thẻ tấn công riêng (≈ 2/3 số thẻ cận chiến).
- Cổng Hàm Tử quan có 30 "quân giữ cổng".
- Lính vây đánh tướng đồng minh chỉ gây 0,2 sát thương; có lệnh ở mặt trận thì quân ta hạ một lính của toán mỗi 2,5 s.
- Liên hoàn WC03: mỗi 10 đòn trúng thì +4% tốc đánh trong 6 s, tối đa 3 tầng.
- C5, C6 mở theo cấp tướng (5 và 10).
- Kế Sách: vị trí đường thuyền và bến, 3 toán giữ bờ, máu thuyền 1.500, +80 quân Triệu Trung cho cánh A, cửa sổ 40 s, dựng lại sau 60 s; làng và vị trí bó tên (Hư cấu); "2 đội phụ trợ" = 24 người.
- Trận chuẩn: par 15 phút, KO par 600.
- Võ trường: ước lượng thời gian bố cục, Vàng ≤ 0,75 ×, Bạc ≤ 1,05 × ước lượng; Đua KO chạy trên sân tập thay vì từ checkpoint B15.
- Thua vẫn nhận 25% EXP.
- Nguồn rơi vật phẩm trong trận.
- Kiểu lính (KITS trong `tuning.js`): tỉ lệ trong binh chủng, hệ số máu/công/giáp/tốc, tầm chém, tầm bắn, thời gian báo trước. Lực sĩ máu ×3, công ×1,6, tốc ×0,72; đòn N của tướng chỉ làm khựng, đòn có knock ≥ 5 hoặc hất tung mới làm bật. Kiểu lính chọn theo băm id, không ăn vào chuỗi rng của trận.
- Tên của cung thủ, nỏ thủ trúng lính thường tính như đòn cận chiến giữa hai đám lính (×0,8 cho quân ta, ×0,6 cho địch). Trước đây tên nhắm lính thường không gây sát thương.
- AI (khối `AI` trong `tuning.js`): tỉ lệ đỡ khiên 30% (đao thuẫn, đao khiên), 15% (thương binh), đỡ xong nhận 25% sát thương, nghỉ 1,4 s; nhảy lùi 20% (lính thường), 45% (tinh nhuệ); cung thủ lùi khi tướng dưới 40% tầm bắn; lực sĩ húc 5–11 m, ×2,6 tốc, 0,9 s, hồi 8 s, sát thương ×1,25; vỡ trận 2,5–4,5 s trong 22 m quanh sĩ quan chết, 12 m quanh Tuyệt Kỹ. Sĩ quan lùi né 40% khi trúng 3 đòn trong 1,5 s, hồi 5 s; đứng đỡ quá 1,2 s thì sĩ quan chuyển sang đòn viền đỏ.
- Bộ đệm input: phím bấm lúc đang ra đòn được giữ tới khi đòn kế được phép (bấm dồn), ngoài ra giữ 0,15 s.
- Địa hình và trận (khối `TERRAIN` trong `tuning.js`): đọc dốc 0,6 m trước/sau theo hướng chạy, dốc dưới 0,04 coi là phẳng; dốc lên −45% tốc mỗi đơn vị độ dốc (sàn ×0,6), dốc xuống +30% (trần ×1,12); bùn × (1 − 0,4·mức bùn); sàn chung ×0,4. Không áp cho né, lao, Phá Trận, lực sĩ húc, bị đẩy, hất tung, tháo chạy. Thế đất cao: chênh chân dưới 0,4 m không tính, sau đó ±8% sát thương mỗi mét, trần +20%, sàn −15%; cung trên cao +12% tầm mỗi mét, trần +25%. Mô phỏng 1 Hz: dải [−0,04; +0,01] quanh tuyến của lũy Nguyên (A 0,48, B 0,482) khi doanh trại A2/B2 còn của địch → tổn thất Nguyên ×0,75; dải ±0,03 quanh ụ đất quân ta (A 0,163, B 0,35) → tổn thất ta ×0,8. Cung thủ Nguyên tìm gò trong 14 m, đỉnh gò cách tướng 7 m tới 0,9 tầm bắn.
- Giáp lá cà (khối `AI.duel`): tìm đối thủ trong 7 m, đổi đối thủ khi người mới gần hơn 2 m, chọn lại mỗi 0,6–1,2 s, tối đa 2 người / lính, 4 người / tướng đồng minh; nhịp chém giữa lính = nhịp thường × 0,6; sát thương mỗi nhát × 0,8 (quân ta) / × 0,5 (địch — địch đông gấp rưỡi trong vùng chiến đấu); lính có khiên đỡ nhát của lính 30%; bước dồn 0,22 m; dây xích quân đồn trú 10 m. Lính địch đang giáp lá cà được thẻ tấn công tướng sau (xa thêm 5 m).
- Cảm giác trúng đòn (khối `IMPACT`): hit-stop × 1,4 + 6 ms mỗi người trúng thêm (trần 30) + 25 ms chí mạng + 12 ms nếu hạ ai, trần 220 ms; rung 0,09 / 0,18 / 0,32 / 0,7; giật camera 0,13 / 0,32 / 0,55 m; thu FOV 0,8 / 2 / 3,5 / 6 độ; xác văng ×1,7, bổng 1,6 m/s (đòn nặng 4,2).
- Màn Huấn luyện: tướng không xuống dưới 60% máu, lính tập không đánh (thẻ 0) trừ bài Đỡ (3 thẻ, sát thương ×0,3); sĩ quan bài Phản đòn chỉ dùng đòn viền đỏ mỗi ~2,2 s; kẹt quá 25 s thì cho bỏ qua bài.
- Vùng chiến đấu: trần 30 địch / 20 ta chỉ đếm lính thật trong 45 m quanh tướng (`ZONE.countR`). Trước đây đếm cả các toán ở xa (phản công A1, vây tướng, giữ bờ Kế Sách) nên P2 có thể kẹt: đứng trong vòng A2 mà quân đồn trú đã hết thì không sinh thêm ai và G không giảm.

## Khác với mục 15

- Lính vẽ bằng `InstancedMesh` skinned: 15 khúc (thêm cổ chân, vạt trước, vạt sau, tua giáo/đuôi ngựa) gộp một lưới, ma trận khớp tính trên CPU (`soldier-motion.js`, không qua three) rồi đọc từ texture float trong vertex shader (gần với hướng three-vat của mục 15, nhưng hoạt ảnh vẫn thủ tục, chưa có clip nướng). Mỗi kiểu lính một lượt vẽ. Lính xa tướng hơn 40 m chỉ tính lại tư thế mỗi 3 khung, không IK, không lò xo, không dây treo. Cả trận khoảng 120 lượt vẽ, 470 nghìn tam giác (kể cả lượt đổ bóng) trên máy phát triển.
- Mô phỏng chạy trên luồng chính, chưa tách Worker.
- Vùng chiến đấu dùng `Math.sin` và `Math.hypot`, nên chưa xác định từng bit giữa các trình duyệt. Mô phỏng 1 Hz thì xác định (có kiểm thử).
- Lưu bằng localStorage, có nút xuất/nhập file, thay cho IndexedDB.
- SFX là mẫu sinh bằng máy (Seed Audio), giải mã một lần vào AudioBuffer dùng chung các trận, âm tổng hợp Web Audio làm dự phòng; nhạc nền là file stream qua phần tử audio.
- Chưa có: thuyền cho tướng, ngựa, benchmark hạng máy, comic trong trận; nút Mưu "Đốt kho" chưa có tác dụng vì B15 không có kho lương.
