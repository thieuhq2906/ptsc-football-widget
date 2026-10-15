# PTSC Cup 6v6 — widget bóng đá nhúng

Trận bóng đá hoạt hình sân 6 người (SVG + JavaScript thuần), nhúng được vào bất kỳ trang web nào.
Không cần thư viện, không cần build, không cần server riêng.

## Chơi trên website

[Mở PTSC Cup](https://thieuhq2906.github.io/ptsc-football-widget/).

- **Chỉ xem:** một trận ngẫu nhiên; kịch bản ưu tiên rượt đuổi, lội ngược dòng và bàn thắng muộn. Cả Đỏ và Xanh đều có thể thắng.
- **Đấu với máy:** bạn chọn áo Đỏ hoặc Xanh; máy điều khiển đội còn lại.
- **Hai người:** A chọn áo, B chọn sân trái/phải lúc bắt đầu và nhận màu áo còn lại. Hai đội đổi sân giữa hiệp.

Mỗi đội vẫn gồm thủ môn và 5 cầu thủ. Giữ nguyên hình vẽ, góc nhìn, thể lực và thẻ phạt. Camera bám bóng, kể cả khi thay người; thay người tự động chỉ lúc bóng chết và đồng hồ dừng đến khi thay xong. Cầu thủ ra/vào chạy nhanh gấp đôi; bàn giao và chờ đá tiếp đã được rút ngắn.
Chế độ chơi không dùng lịch bàn thắng của chế độ xem; tỷ số phụ thuộc vào thao tác, vị trí sút, đối thủ và thể lực. Hết giờ có thể hòa.

Tam giác xanh trên đầu và vòng dưới chân đánh dấu người đang điều khiển, giống mẫu tham chiếu; người B dùng xanh lam.
Mũi nhỏ dưới chân hiển thị hướng theo input và giữ hướng cuối cùng khi thả phím. Cầu thủ đã nhận thẻ vàng luôn có biểu tượng vàng trên đầu (theo danh tính khi thay người).
**Hỗ trợ ngắm** bật mặc định, có thể bật/tắt ngay trong trận: chuyền tới đồng đội gần hướng ngắm nhất và sút trúng khung thành.
Thủ môn vẫn có thể cứu thua. Khi tắt hỗ trợ, bóng đi theo mũi tên; có thể chuyền hụt, ra biên, sút lệch hoặc phản lưới.

| Thao tác | Người A / đấu với máy | Người B |
|---|---|---|
| Di chuyển theo hướng màn hình | W A S D | Các phím mũi tên |
| Giữ để nạp lực chuyền, thả để đá (khi có bóng) | F | J |
| Có bóng: giữ để nạp lực sút, thả để đá; phòng ngự: bấm để xoạc (tự bám đối thủ trong 5,5m) | G | K |
| Chọn cầu thủ gần bóng nhất, kể cả lúc chờ | R | U |
| Giữ để chạy nhanh | T | I |
| Giữ để pressing / áp sát khi phòng ngự | V | N |
| Bấm để tranh bóng khi đủ gần đối thủ | B | M |
| Skill đặc biệt: bấm icon cạnh tên/thể lực hoặc phím | E | O |

Các phím hành động nằm thành cụm hai cột, ba hàng: A **R/T – F/G – V/B**, B **U/I – J/K – N/M**. Chuyền, pressing và tranh bóng có phím riêng. Hai người dùng các phím không trùng nhau; hướng dẫn trên sân và ngoài sân vẽ đúng cụm phím này.

Bấm **Bắt đầu trận** hoặc **Bắt đầu trận mới**: sân luôn tạm dừng, phủ nền mờ và hiện **Nhấn Space để bắt đầu trận đấu**. Nhấn Space để vào trận, rồi dùng lại Space để tạm dừng/tiếp tục. Phím này không nằm trong hướng dẫn cơ bản trên sân.
Khi tạm dừng giữa trận, sân phủ xám và hiện **Nhấn Space để tiếp tục trận đấu**.
Pad minh họa gắn WASD cho A, phím mũi tên cho B. Hai cụm hướng dẫn cơ bản nằm riêng góc trái/phải sân, độ mờ 30%.
Phần trăm và thanh thể lực của người đang điều khiển hiện ngay trong sân: A bên trái, B bên phải, vẫn đọc được khi toàn màn hình; chuyển màu cảnh báo khi dưới 35%.
Tam giác xanh (A) hoặc xanh lam (B) đánh dấu người đang điều khiển.
Tự chuyển điều khiển ngay sang người cầm bóng, kể cả thủ môn khi bắt bóng hoặc phát bóng; thủ môn tự bảo vệ khung thành khi không được điều khiển.
Giao bóng, đá phạt, phạt góc, đá biên và phát bóng lên luôn trỏ về người thực hiện khi chờ đưa bóng vào cuộc. Người này tự tới vị trí cạnh bóng rồi đứng yên; phím di chuyển chỉ đổi hướng ngắm, R/U giữ điều khiển ở người đá cho đến khi bóng vào cuộc. Khi không bị khóa bởi tình huống này, R/U lần đầu ưu tiên người gần bóng; các lần liên tiếp trong 1 giây luân phiên qua những đồng đội đủ điều kiện. Mỗi lần bấm riêng đổi ngay, không chờ hồi hay kết thúc động tác; giữ phím bắt đầu lặp sau 140ms, rồi lặp mỗi 45ms, không phụ thuộc độ trễ lặp phím của hệ điều hành. Nhả phím, mất focus hoặc đổi chế độ sẽ hủy lặp. Lựa chọn thủ công được giữ đến khi bóng đổi chủ hoặc có tình huống nhận/giao bóng mới.
Giao bóng phải có cầu thủ đứng trong 1,4m cạnh bóng giữa sân. A dùng **F**, B dùng **J** (giữ rồi thả để chuyền), hoặc bấm **Chuyền giao bóng**. Space chỉ bỏ tạm dừng, không tự chuyền giao bóng. Máy cũng phải tới cạnh bóng trước khi chuyền.
Phạt góc có người đá đứng trong 1,4m cạnh cờ, luôn điều khiển người đó; người chơi chọn **Tạt bổng / Chuyền ngắn / Đập nhả / Trả tuyến hai** trên sân. Chưa có người cạnh bóng hoặc trọng tài chưa quay lại thì không phát bóng. Người đá đứng yên cạnh cờ cho đến khi thực hiện; máy tự chọn kiểu đá khi đã sẵn sàng.
Các cầu thủ khác vẫn có thể di chuyển lúc bóng chết, thay người và trọng tài nghỉ. Với người được điều khiển không phải người thực hiện bóng chết, input di chuyển ngắt đường chạy bố trí tự động; nhấn hướng phản hồi ngay, nhả phím dừng ngay. Space vẫn đóng băng trận. Đồng hồ và thể lực không giảm trong các khoảng chờ.
Giữ V/N áp sát phản hồi ngay, bỏ đường chạy bố trí tự động không thuộc hành động đang thực hiện; tốc độ tiếp cận cơ bản 6,8m/s, hướng bám người cầm bóng cập nhật mỗi bước. Thả nút dừng áp sát, không tự tranh bóng/xoạc.
Đá phạt thường ưu tiên cầu thủ có **Vua đá phạt** còn lượt và đủ thể lực, tự điều khiển người đó. Người đá tự vào vị trí cạnh bóng rồi đứng yên chờ thực hiện; không đổi sang người khác trong lúc chờ. Giữ rồi thả **F/J** để chuyền, **G/K** để sút; có nạp lực, hướng ngắm và đường bóng cao/thấp như lúc chơi. Trên sân cũng có nút chuyền/sút giữ để nạp lực bằng chuột. Cú đá tự động của đội người chơi chờ thao tác; máy chỉ đá sau khi người đá và hàng rào chuẩn bị xong, cân nhắc kích hoạt Vua đá phạt.
Phạm lỗi trong vòng cấm bán nguyệt của đội phòng ngự dẫn tới **penalty trong trận**: màn camera từ sau người sút, hai bên chọn trái/giữa/phải. Vào thì cộng bàn thật và chuẩn bị giao bóng; bị cản thì thủ môn ôm bóng tiếp tục. Tình huống này tách khỏi luân lưu cuối trận, không cộng vào tỷ số luân lưu.
Thủ môn được tăng nhẹ khả năng cản sút thường và bắt dính; sút thần sầu dễ ghi bàn hơn nhưng vẫn có thể bị cứu thua.
Thủ môn có thể lao ra ôm đường chuyền thấp, bóng rời hoặc áp sát người cầm bóng gần khung thành. Quyết định dựa trên vùng cấm, độ cao, khoảng cách, thời gian tới bóng và đối thủ; tình huống không an toàn giữ vị trí. Bóng được ôm chỉ khi thực sự ở trong tầm tay và vòng cấm, không ép lao ra với mọi pha bóng hay thay thế logic cứu thua các cú sút.
Thủ môn ôm bóng trên tay tối đa 6 giây trước khi tự phát bóng. Khi đi ra khỏi vòng cấm bán nguyệt, thủ môn tự hạ bóng xuống chân và tiếp tục điều khiển bình thường; không bị ép phá bóng khi bóng đã ở chân. Việc kiểm tra xét cả vị trí bóng trên tay và sân hiện tại sau đổi sân.
Đồng đội hỗ trợ tự động. Xoạc có thời gian hồi, tốn thể lực, có thể phạm lỗi hoặc bị thẻ; xoạc hụt vẫn có động tác trượt và đứng dậy.
Khi chuyển chế độ hoặc rời cửa sổ, trận chơi tạm dừng để tránh kẹt phím.
Sự kiện thả phím được bắt ở mức cửa sổ; mất focus, đổi toàn màn hình hoặc hủy pointer sẽ xóa input. Trọng tài dừng trận hủy thao tác chuyền/sút đang chờ nhưng giữ các phím di chuyển đang nhấn. Nhả hướng di chuyển thì cầu thủ điều khiển dừng ngay, không tiếp tục trôi do quán tính; các lần lặp phím cũ không tự bật lại input đã xóa.
Chọn **Tiếp tục** để trở lại. Đổi lựa chọn áo/sân áp dụng ở trận mới. Website chơi cùng máy cần bàn phím.

Lực nạp đầy sau khoảng 0,9 giây, có thanh lực dưới chân và trong bảng cầu thủ. Lực thấp cho đường bóng thấp; lực cao tăng tốc độ, tầm chuyền và độ bổng.
Hỗ trợ ngắm giữ cú sút trong khung thành; khi tắt hỗ trợ, sút quá mạnh có thể vọt xà.

### Thao tác nâng cao

- Nhấn **sút hai lần nhanh** (G hoặc K): sút thần sầu, lấy đà 0,6 giây, tiêu hao 18% thể lực, cần ít nhất 23% thể lực. Có thể bị cản; không bảo đảm ghi bàn.
- Khi phòng ngự, bấm **B hoặc M** khi gần đối thủ: 30% lỗi nhẹ, 50% cướp bóng, 15% lỗi đáng nhận vàng, 5% lỗi nặng. Thẻ đỏ và vàng thứ hai được xét thêm theo mức độ lỗi và kế hoạch thẻ đỏ thường của trận. Giữ V/N chỉ áp sát, không tự tranh bóng.
- Xoạc tự hướng và bám theo người cầm bóng trong phạm vi 5,5m, kể cả khi hướng ngắm chưa chính xác. Ngoài phạm vi này vẫn trượt theo hướng ngắm và có thể hụt; đối thủ chuyền/sút trước khi tiếp xúc cũng thoát được pha xoạc. Khi thực sự chạm đối thủ: **50% lấy bóng / 50% thẻ đỏ trực tiếp**. Một lần rút độc lập cho **30% gây chấn thương**, kể cả pha lấy bóng sạch. Có chấn thương thì dừng đồng hồ, xử lý và thay người trước khi đá tiếp; lấy bóng sạch vẫn giữ quyền kiểm soát sau khi chữa trị.
- Tranh chấp tự động trong chế độ chơi có 22% phạm lỗi khi áp sát và thực sự chạm người cầm bóng. Chế độ xem tăng xác suất phạm lỗi khi tranh bóng từ 9–17% lên 22–32%, tùy thể lực. Nhánh xử lý lỗi thông thường tăng khả năng xét thẻ từ 12% lên 45%.
- Mỗi trận rút một kế hoạch độc lập với xác suất 30% để có thẻ đỏ do tranh chấp thường. Trận được chọn ưu tiên tạo một pha phạm lỗi nặng khi có đối thủ ở đủ gần; các lỗi nhẹ của người đã nhận vàng chỉ bị nhắc nhở, lỗi nghiêm trọng có thể nhận vàng thứ hai, lỗi rất nặng có thể đỏ trực tiếp. Tối đa một đỏ thường theo kế hoạch; đỏ do xoạc giữ tỷ lệ 50/50 riêng và không tiêu thụ kế hoạch này. Mục tiêu 30% là xác suất chọn kịch bản, chưa phải tỷ lệ thực nghiệm trên nhiều trận.
- Phạm lỗi không có chấn thương có 25% dẫn tới đôi co/xô xát, với ít nhất 20 giây giữa hai tình huống. Cảnh đôi co không rút thêm thẻ cho pha B/M hoặc xoạc đã có kết quả định sẵn.

### Skills đặc biệt

Mỗi cầu thủ dùng tối đa **một lần mỗi trận**, tiêu hao **40% thể lực**, cần ít nhất 40% để kích hoạt. Dùng thất bại vẫn tính lượt và trừ thể lực. Lượt dùng gắn với danh tính cầu thủ, giữ nguyên khi ra/vào sân, qua hiệp phụ; trận mới đặt lại. Bấm icon bên cạnh tên/thể lực hoặc **E cho A, O cho B**; icon và trạng thái thay đổi theo cầu thủ đang chọn.
Skill tấn công dùng được ngay từ màn bắt đầu trước Space hoặc lúc chờ giao bóng đầu trận. Skill tăng tốc được bật sẵn và chỉ đếm hiệu lực khi bóng trong cuộc; skill sút/chuyền có thể chuẩn bị trước, hiển thị **Đã chuẩn bị**, tự thực hiện khi cầu thủ có bóng. Vẫn tiêu hao lượt và thể lực ngay khi chuẩn bị. Tạm dừng giữa trận không cho kích hoạt skill.

Skill phòng thủ và thủ môn **chỉ kích hoạt khi bóng trong cuộc và đội đang phòng ngự**; không chuẩn bị trước lúc chờ giao bóng, không tiêu hao lượt/thể lực nếu bấm khi đang tấn công. Quyền kiểm soát xét người cầm bóng, hoặc đội đang triển khai khi bóng bay. Icon chuyển xám và ghi **Chỉ phòng thủ** khi sai trạng thái. Máy tuân thủ cùng điều kiện. Có thể đổi sang thủ môn lúc phòng ngự để dùng skill; Siêu phòng thủ chỉ tăng tốc/cản bóng trong giai đoạn phòng ngự, không buff tấn công sau khi đoạt bóng.

Mỗi trận mỗi cầu thủ được phân ngẫu nhiên một trong ba skill phù hợp vị trí. Máy cũng chủ động dùng skill khi đủ thể lực và phù hợp diễn biến. Skill theo thời gian có hiệu lực **2 giây bóng trong cuộc**; skill sút, chuyền và cướp bóng giải quyết một pha bóng. Tỷ lệ hiệu quả 70%; riêng skill sút là 70% ghi bàn, không nhân thêm một lần xác suất kích hoạt.

| Vị trí | Skill được phân ngẫu nhiên | Hiệu quả |
|---|---|---|
| Tiền đạo | Bứt tốc bất khả cản / Sát thủ vòng cấm / Bóng ma sân cỏ | Tăng tốc và bảo vệ bóng 2s, hoặc cú sút đặc biệt 70%. |
| Tiền vệ | Vua đá phạt / Nhạc trưởng / Chuyền xuyên tuyến | Sút đặc biệt 70%, giữ bóng tăng tốc 2s, hoặc đường chuyền nhanh tới người ở tuyến trên. |
| Hậu vệ | Tường thép / Siêu phòng thủ / Máy quét | Cướp bóng sạch trong 5,5–7m; hoặc tăng tốc các hậu vệ và cướp bóng khi áp sát trong 2s. Không vượt bảo vệ giữ bóng. |
| Thủ môn | Bàn tay thép / Thủ môn quét / Phản xạ chớp nhoáng | Bật bảo vệ cho cú sút thường kế tiếp trong 2s; thủ môn quét tăng độ chủ động trong tình huống an toàn. Skill sút đặc biệt vẫn giữ 70%. |

Icon skill là huy hiệu tròn nhiều lớp viền xanh, nền màu và hình riêng cho mỗi loại; không khả dụng chuyển xám, đang hiệu lực phát sáng. Nút hiển thị **Sẵn sàng**, **Chỉ phòng thủ**, **Chờ**, **Thiếu lực**, **Đã chuẩn bị**, **Đã dùng** hoặc giây còn lại. Ngoài phần chuẩn bị đầu trận, skill tấn công cần có bóng, skill cướp bóng cần đối thủ trong tầm. Dùng skill xong không có hồi để dùng lại trong cùng trận.
Người đang chuẩn bị đá phạt có thể dùng Vua đá phạt thay cho skill bình thường; vẫn trừ cùng lượt dùng của cầu thủ đó.

### Cấu trúc dữ liệu gameplay

`PTSCFootball.data` công khai bảng cấu hình `GAME_DATA` trong `ptsc-football.js`: `skills` (id, tên, vị trí, hiệu ứng, icon, tốc độ/tầm), `skillRules` (40%, 70%, 2s, một lượt), `controls` (chuỗi đổi người/nhấn lặp), `rendering` (nhịp khán giả, biên bỏ vẽ), `restarts` (điều kiện người đá), `corners` (các bài góc), `goalkeeper` (quy tắc lao ra) và `celebrations` (danh mục ăn mừng). Engine đọc các bảng này; trang lấy cùng dữ liệu để vẽ icon và nút, tránh hai danh mục khác nhau.

Trạng thái cầu thủ lưu `specialId`, `specialUsed`, `specialUntil`; trạng thái phạt góc lưu người đá, điểm bóng, thời điểm sẵn sàng và lệnh thực hiện. Trạng thái giao bóng chờ chuyền tách khỏi bóng đang trong cuộc, nên không đá tự động do hết thời gian chờ.

### Hiệu năng

- Mô phỏng giữ bước 60Hz; chỉ vẽ lại khi có bước mô phỏng mới, tránh vẽ trùng trên màn hình 120/144Hz. Dừng vòng lặp khi widget khuất hoặc tab trình duyệt ẩn; xóa listener khi hủy trận.
- SVG chỉ ghi thuộc tính thay đổi; tái dùng hình dáng khi tư thế không đổi và bỏ cập nhật nhân vật ngoài khung hình camera. Camera và đội hình vẫn tính như trước.
- Khán giả hoạt ảnh 20Hz, bỏ cập nhật người ngoài khung hình; không tính hiệu ứng nâng cúp/pháo giấy khi chưa tới cảnh ăn mừng.
- Tái dùng danh sách chiều sâu; chỉ di chuyển node SVG sai thứ tự, không gắn lại toàn bộ sân. Hẹn giờ được chèn đúng thứ tự thay vì sắp xếp mỗi bước.
- Đổi người chỉ cập nhật mũi trỏ/vòng chọn ngay; HUD tái dùng node, hạn chế thay văn bản không đổi.

**Toàn màn hình** là một nút biểu tượng ở góc dưới phải sân, giống nút của trình phát video, có cả ở chế độ xem. Bấm cùng nút để thu nhỏ, hoặc Escape để thoát. Nếu trình duyệt không cho phép Fullscreen API, sân vẫn được mở phủ cửa sổ.
Hướng dẫn trong sân chỉ có nút cơ bản; thao tác nhấn hai lần nằm trong mục nâng cao ngoài sân.
Hướng dẫn nâng cao ở bên dưới, mở sẵn và chia riêng hai cột A/B cho chế độ hai người; mỗi cột chỉ dùng bộ phím của người đó.

### Trọng tài và kết thúc trận

- Trọng tài có thoại riêng khi giao bóng, ra biên, phạt góc, đá phạt, phát bóng và thay người. Chờ lâu sẽ nhắc luân phiên “Nhanh lên!”, “Đừng có câu giờ!”, “Nhanh không cho đá thiếu một người bây giờ!”; chỉ nói “Tiếp tục!” khi bóng trở lại cuộc chơi.
- Bong bóng thoại giảm 20% kích thước. Cầu thủ thuộc bên A/B điều khiển nói khi nhận bóng, chuyền, sút, đổi người, áp sát và chạy nhanh; có khoảng nghỉ 2,3 giây giữa các câu để tránh spam.
- Thúc giục chỉ xuất hiện trong trạng thái chờ, cách nhau ít nhất 6 giây sau câu đầu. Giao bóng tiếp tục ngay khi đội hình sẵn sàng và thay người hoàn tất; không buộc người đã tự di chuyển phải đứng lại đúng điểm máy chỉ định. Có giới hạn chờ 8 giây sau các lượt thay người để tránh kẹt; thời gian thổi tiếp tục không phụ thuộc việc câu thoại đã kết thúc hay chưa.
- Cầu thủ dự bị ngoài biên cổ vũ theo diễn biến, mừng bàn thắng và đôi lúc chỉ trích cách chơi. Thoại định kỳ cách nhau khoảng 6–11 giây, ưu tiên cổ vũ (80% khi bóng trong cuộc); tránh chen vào thoại trọng tài, cảnh xô xát hoặc nhiều bong bóng đang hiện. Bộ ngẫu nhiên thoại riêng không làm thay đổi kết quả trận.
- Mỗi trận chọn một lần với xác suất 5% cho tình huống trọng tài đi WC, chỉ thực hiện khi bóng chết và không có đường bóng đang bay. Ông ấy chạy đến WC rồi quay lại sau 15 giây. Đồng hồ, thể lực và các lệnh cho bóng vào cuộc chờ; cả hai đội tiếp tục di chuyển/bố trí vị trí, người chơi vẫn điều khiển người đang chọn. Trọng tài quay lại không tự đưa bóng vào cuộc: tình huống giao bóng/phạt góc vẫn phải thực hiện đúng thao tác. Camera tiếp tục bám bóng.
- Khi ghi bàn nhưng vẫn bị dẫn, cầu thủ nhặt bóng trong lưới, nói “Nhanh lên, vẫn còn thời gian!”, ôm bóng chạy về chấm giữa sân và đặt xuống trước khi chuyển sang giao bóng. Thời gian ăn mừng đủ để hoàn thành đường chạy này, không cộng vào đồng hồ trận.
- Đội thắng ăn mừng, đội thua thất vọng và có cảnh nâng cúp theo logic cũ, kể cả thắng bằng luân lưu. Tỷ số trận và tỷ số PEN được hiển thị riêng.
- Nút **Trận mới** ngay trong sân cho phép restart kể cả khi toàn màn hình. Trận mới giữ lựa chọn áo/sân/thời gian hiện có và luôn chờ Space để bắt đầu.

### Các kiểu ăn mừng hiện có

Vung nắm đấm; đập tay/ôm đồng đội; dang tay; máy bay; chỉ tay cảm ơn đồng đội; chỉ huy hiệu áo; nhảy múa; trượt gối; suỵt; SIUU; chỉ lên trời; ôm bóng chạy về giữa sân khi vẫn bị dẫn; ôm cả nhóm; quỳ giơ tay. Kết thúc trận thắng còn có tập trung ăn mừng và nâng cúp.

### Thời lượng, hiệp phụ và luân lưu

- Hai chế độ chơi có thể chọn 2, 4, 6 hoặc 10 phút bóng trong cuộc. Hai hiệp chia đều; thời gian bóng chết, thay người và tạm dừng không tính vào thời lượng này. Đồng hồ trận vẫn thể hiện hai hiệp 30 phút mô phỏng; mức tiêu hao thể lực theo đồng hồ này được giữ nguyên.
- Bật **Hiệp phụ nếu hòa**: thêm hai hiệp 15 phút mô phỏng, tương ứng tổng thời gian bằng một nửa thời lượng chính, đổi sân giữa hai hiệp phụ. Nếu không bật luân lưu, hòa sau hiệp phụ được giữ nguyên.
- Bật **Luân lưu nếu vẫn hòa**: nếu có hiệp phụ, đá luân lưu sau hiệp phụ; nếu không, đá ngay khi hết thời gian chính.
- Luân lưu chuyển riêng sang góc nhìn từ sau cầu thủ về khung thành. Cả bên sút và thủ môn chọn trái / giữa / phải bằng nút trên sân, hoặc A/S/D cho người A và ←/↓/→ cho B. Hai hướng được giữ kín đến khi cả hai bên chốt. Máy chọn ngẫu nhiên trước khi người chơi chốt.
- Thủ môn chọn cùng hướng sút sẽ cản phá; khác hướng là bàn thắng. Mỗi đội 5 lượt, có thể kết thúc sớm nếu đã phân thắng bại; hòa thì đá tiếp từng cặp. Tỷ số luân lưu được hiển thị riêng với tỷ số trận.

## Kiểm tra phát triển

Kiểm tra trên trình duyệt bằng Node và Playwright: `node tests/game-browser.cjs`.
Nếu Playwright nằm ở vị trí khác, đặt `PLAYWRIGHT_MODULE` thành đường dẫn tới module đó.
Kết quả và ảnh kiểm tra nằm trong `test-results/` (không đưa lên Git).

## Cách dùng

Chép 2 file `ptsc-football.js` và `ptsc-football.css` vào cùng một thư mục trên web của bạn, rồi:

```html
<div class="ptsc-football" data-seed="7" data-caption="Sân 6 người · Đỏ gặp Xanh"></div>
<script src="/duong-dan/ptsc-football.js" defer></script>
```

- Mỗi thẻ `div.ptsc-football` là một trận riêng. Đặt bao nhiêu thẻ cũng được.
- Widget co giãn theo chiều rộng của thẻ div, chiều cao tự theo tỉ lệ 16:9.
- File CSS do script tự nạp vào bên trong widget (Shadow DOM), nên CSS của trang không làm vỡ widget và CSS của widget không ảnh hưởng tới trang.

## Tuỳ chọn (thuộc tính `data-*`)

| Thuộc tính | Ý nghĩa |
|---|---|
| `data-seed="7"` | Cùng một seed thì luôn ra cùng một trận. Bỏ trống thì mỗi lần tải là một trận ngẫu nhiên. |
| `data-caption="..."` | Dòng chữ dưới khung hình. |
| `data-still="12"` | Chỉ vẽ một khung hình đứng yên tại giây thứ 12, không chạy. |
| `data-css="https://.../ptsc-football.css"` | Đường dẫn tới file CSS nếu nó không nằm cạnh file JS. |
| `data-fonts="none"` | Không tải font Google; dùng font của hệ thống. |
| `data-mode="cpu"` / `data-mode="local"` | Chơi với máy / hai người, có thể truyền bằng `PTSCFootball.mount`. |
| `data-team-a="R"` / `data-team-a="B"` | Màu áo của người A. |
| `data-left-team="R"` / `data-left-team="B"` | Đội bắt đầu ở sân trái; tự đổi sân sau hiệp 1. |

## Điều khiển bằng JavaScript

```js
const tran = PTSCFootball.mount(document.querySelector("#san"), { seed: 3 });
tran.pause();    // tạm dừng
tran.play();     // chạy tiếp
tran.destroy();  // gỡ widget

PTSCFootball.mountAll(); // gắn các div.ptsc-football được thêm vào trang sau này (ví dụ trong SPA)
```

Widget chỉ chạy khi đang hiển thị trên màn hình (tự dừng khi bị cuộn khuất hoặc khi chuyển tab).
Người dùng bật "giảm chuyển động" trong hệ điều hành sẽ thấy một khung hình tĩnh.

## Dùng trong React / Vue

```jsx
useEffect(() => {
  const tran = window.PTSCFootball.mount(ref.current, { seed: 7 });
  return () => tran.destroy();
}, []);
// <div ref={ref} />
```

## Tệp

- `ptsc-football.js`: toàn bộ mô phỏng và hình vẽ (khoảng 200 KB, khoảng 60 KB khi server bật gzip).
- `ptsc-football.css`: giao diện (màu, bảng tỉ số, nhãn).
- `demo.html`: trang ví dụ.
- `index.html`, `game.js`, `game.css`: trang ba chế độ, lựa chọn trước trận và bàn phím.
- `assets/control-pad.svg`: hình pad minh họa phím di chuyển.
- `penalties.js`: giao diện luân lưu và góc nhìn từ sau cầu thủ sút.
- `tests/game-browser.cjs`: kiểm tra tích hợp game trên trình duyệt.
