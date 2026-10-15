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
Tự chuyển điều khiển ngay sang người cầm bóng, kể cả thủ môn khi bắt bóng hoặc phát bóng; thủ môn tự bảo vệ khung thành khi không cầm bóng.
Giao bóng, đá phạt, phạt góc, đá biên và phát bóng lên tự chọn đúng người thực hiện. R/U chọn người gần bóng nhất và hoạt động cả khi chờ giao bóng, thay người, bóng chết hoặc tạm dừng; không tự ghi đè lựa chọn trong lúc chờ, trừ khi chọn người thực hiện một tình huống mới.
Có thể di chuyển lúc chờ giao bóng, bóng chết, thay người và trọng tài nghỉ. Input di chuyển ngắt đường chạy bố trí tự động của cầu thủ đang chọn; nhấn hướng phản hồi ngay, nhả phím dừng ngay. Space vẫn đóng băng trận. Đồng hồ và thể lực không giảm trong các khoảng chờ.
Thủ môn được tăng nhẹ khả năng cản sút thường và bắt dính; sút thần sầu dễ ghi bàn hơn nhưng vẫn có thể bị cứu thua.
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

| Vai trò / icon | Skill | Hiệu quả |
|---|---|---|
| Tiền đạo / tia sét | Bứt tốc bất khả cản | 70% kích hoạt thành công: tốc độ cơ bản 9,8m/s, giữ bóng không thể bị cướp/xoạc trong 4 giây bóng trong cuộc. Chuyền hoặc sút kết thúc bảo vệ quyền cầm bóng. |
| Tiền vệ hoặc người đang đá phạt / bóng và sao | Vua đá phạt | Một cú sút ngắm khung thành, lấy đà 0,6s, xác suất ghi bàn 70%; không rút thêm một lần 70% kích hoạt. Có thể dùng khi đang chuẩn bị đá phạt, thay cho cú đá tự động. |
| Hậu vệ / khiên | Tường thép | 70% cướp bóng sạch từ đối thủ trong 5,5m; không gây thẻ/chấn thương. Không xuyên qua bảo vệ bứt tốc. |
| Thủ môn / găng tay | Bàn tay thép | 70% bật bảo vệ trong 8 giây bóng trong cuộc; cản cú sút thường tiếp theo rồi hết hiệu lực. Skill sút đặc biệt vẫn giữ xác suất vào 70%. |

Nút skill hiển thị **Sẵn sàng**, **Chờ**, **Thiếu lực**, **Đã dùng** hoặc số giây hiệu lực còn lại. Skill tấn công cần đang có bóng, skill hậu vệ cần đối thủ trong tầm. Tạm dừng, thay người hoặc bóng chết thông thường không kích hoạt được skill. Dùng skill xong không có hồi để dùng lại trong cùng trận.

**Toàn màn hình** là một nút biểu tượng ở góc dưới phải sân, giống nút của trình phát video, có cả ở chế độ xem. Bấm cùng nút để thu nhỏ, hoặc Escape để thoát. Nếu trình duyệt không cho phép Fullscreen API, sân vẫn được mở phủ cửa sổ.
Hướng dẫn trong sân chỉ có nút cơ bản; thao tác nhấn hai lần nằm trong mục nâng cao ngoài sân.
Hướng dẫn nâng cao ở bên dưới, mở sẵn và chia riêng hai cột A/B cho chế độ hai người; mỗi cột chỉ dùng bộ phím của người đó.

### Trọng tài và kết thúc trận

- Trọng tài có thoại riêng khi giao bóng, ra biên, phạt góc, đá phạt, phát bóng và thay người. Chờ lâu sẽ nhắc luân phiên “Nhanh lên!”, “Đừng có câu giờ!”, “Nhanh không cho đá thiếu một người bây giờ!”; chỉ nói “Tiếp tục!” khi bóng trở lại cuộc chơi.
- Thúc giục chỉ xuất hiện trong trạng thái chờ, cách nhau ít nhất 6 giây sau câu đầu. Giao bóng tiếp tục ngay khi đội hình sẵn sàng và thay người hoàn tất; không buộc người đã tự di chuyển phải đứng lại đúng điểm máy chỉ định. Có giới hạn chờ 8 giây sau các lượt thay người để tránh kẹt; thời gian thổi tiếp tục không phụ thuộc việc câu thoại đã kết thúc hay chưa.
- Cầu thủ dự bị ngoài biên cổ vũ theo diễn biến, mừng bàn thắng và đôi lúc chỉ trích cách chơi. Thoại định kỳ cách nhau khoảng 6–11 giây, ưu tiên cổ vũ (80% khi bóng trong cuộc); tránh chen vào thoại trọng tài, cảnh xô xát hoặc nhiều bong bóng đang hiện. Bộ ngẫu nhiên thoại riêng không làm thay đổi kết quả trận.
- Mỗi trận chọn một lần với xác suất 5% cho tình huống trọng tài đi WC, thực hiện khi bóng đã được kiểm soát và không có một pha sút/chuyền đang diễn ra. Ông ấy thổi dừng, chạy đến WC rồi quay lại; toàn bộ lần nghỉ kéo dài 15 giây, không tính vào đồng hồ trận. Máy, thể lực và các hành động đang chờ tạm dừng; người chơi vẫn được di chuyển cầu thủ đã chọn, bóng đang cầm đi theo cầu thủ và camera vẫn bám bóng. Mỗi trận tối đa một lần, với bộ ngẫu nhiên riêng để không đổi kịch bản bóng đá.
- Khi ghi bàn nhưng vẫn bị dẫn, cầu thủ nhặt bóng trong lưới, nói “Nhanh lên, vẫn còn thời gian!”, ôm bóng chạy về chấm giữa sân và đặt xuống trước khi chuyển sang giao bóng. Thời gian ăn mừng đủ để hoàn thành đường chạy này, không cộng vào đồng hồ trận.
- Đội thắng ăn mừng, đội thua thất vọng và có cảnh nâng cúp theo logic cũ, kể cả thắng bằng luân lưu. Tỷ số trận và tỷ số PEN được hiển thị riêng.
- Nút **Trận mới** ngay trong sân cho phép restart kể cả khi toàn màn hình. Trận mới giữ lựa chọn áo/sân/thời gian hiện có và luôn chờ Space để bắt đầu.

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
