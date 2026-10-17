# PTSC Cup 6v6 — widget bóng đá nhúng

Trận bóng đá hoạt hình sân 6 người (SVG + JavaScript thuần), nhúng được vào bất kỳ trang web nào.
Không cần thư viện, không cần build, không cần server riêng.

## Chơi trên website

[Mở PTSC Cup](https://thieuhq2906.github.io/ptsc-football-widget/).

Trang là một game duy nhất trên một màn hình (stage) phủ kín cửa sổ: mọi lựa chọn, mô tả và nút đều nằm trong game, điều hướng bằng nút trong game như PES/eFootball. Nút **Toàn màn hình** có ở mọi màn, kể cả menu đầu; khi toàn màn hình, trình duyệt cho phép thì Esc vẫn là phím của game (giữ Esc để thoát).

- **Menu chính** (`#/menu`): các thanh menu bên trái, ô mô tả mục đang chọn bên phải, một trận máy đấu máy chạy phía sau. **Đấu với máy · Hai người · Chỉ xem · Thông tin game**.
- **Chuẩn bị trận** (`#/cpu`, `#/local`): các hàng cài đặt (màu áo, độ khó hoặc sân bắt đầu của B, thời gian 2/4/6/10 phút, hiệp phụ, luân lưu, hỗ trợ ngắm, bố trí phím, tùy chỉnh phím). Ô dưới danh sách giải thích hàng đang chọn; bên phải là thẻ đối đầu (hai áo, VS, tóm tắt) và nút **Vào sân**.
- **Trận đấu** (`#/cpu/match`, `#/local/match`): chỉ có sân và HUD trong sân, góc phải dưới là nút tạm dừng và toàn màn hình. Menu trận (trước giao bóng, khi tạm dừng, khi hết trận): **Bắt đầu/Tiếp tục · Hỗ trợ ngắm Bật/Tắt · Kế hoạch trận · Điều khiển · Trận mới · Cài đặt trận · Thông tin game · Menu chính**. Hết trận, menu tự hiện sau tiếng còi với **Trận mới** làm nổi bật. Giữ **Tab** khi đang đá để xem nhanh hai thẻ chỉ số mà không dừng trận.
- **Chỉ xem** (`#/watch`): Space hoặc Esc mở menu **Tiếp tục · Trận mới · Đội hình & chỉ số · Menu chính**.
- **Thông tin game** (`#/info/…`): sáu mục kiểu menu game, mỗi mục là một màn duyệt: các nhóm đổi bằng **Q/E**, các ô chọn bằng mũi tên, thẻ chi tiết bên phải cho ô đang chọn. **Bảng skill** (icon, cách kích hoạt, thời gian, thể lực, số lần), **Chỉ số & hình thể** (mức nền theo vị trí, trọng số OVR, lối chơi tăng chỉ số, chiều cao/cân nặng/tầm với), **Phong cách chơi** (theo vùng; sơ đồ vị trí điển hình, cách chơi, ảnh hưởng chỉ số), **Layout phím** (chọn layout bằng ← →, đổi tên, Enter rồi bấm phím mới, ghi đè/lưu mới/khôi phục/xóa, dùng cho chế độ nào; hình bàn phím minh họa), **Điều khiển** (theo người chơi và trong menu, có hình bàn phím) và **Độ khó & luật** (so sánh bốn mức độ khó, tỉ lệ penalty, luật trận). Esc hoặc ← ở mép trái quay về danh sách mục. Bảng **Điều khiển** trong menu trận dùng cùng màn duyệt cho người chơi của trận đó.

Bàn phím trong menu: **↑ ↓** (hoặc W S) chọn, **← →** (A D) đổi giá trị, **Enter** xác nhận (ở màn chuẩn bị là vào sân), **Space** tiếp tục trận, **Esc** quay lại. Chuột: rê vào là chọn, bấm là xác nhận; mũi tên hai bên mỗi hàng cài đặt để đổi. Hộp xác nhận (bỏ thay đổi, xóa layout) cũng nằm trong game. Nút Back của trình duyệt về màn trước. Rời màn trận đấu sẽ tạm dừng trận; quay lại vẫn đá tiếp. Từ Thông tin game quay lại đúng màn đã mở nó.

- **Chỉ xem:** hai câu lạc bộ ngẫu nhiên; kịch bản ưu tiên rượt đuổi, lội ngược dòng và bàn thắng muộn. Đội nào cũng có thể thắng.
- **Đấu với máy:** bạn chọn **câu lạc bộ của mình** và **câu lạc bộ của máy** (hoặc "Ngẫu nhiên"), cùng **độ khó** (Dễ, Thường, Khó, Huyền thoại, nhớ trong trình duyệt).
- **Hai người:** mỗi người chọn một câu lạc bộ; B chọn sân trái/phải lúc bắt đầu. Hai đội đổi sân giữa hiệp. Mỗi bên có **3 lượt tạm dừng**, mỗi lượt tối đa **60 giây** (đếm ngược) để thay người hoặc đổi chiến thuật: người A bấm phím tạm dừng của mình (mặc định **Q**; Space cũng tính là của A), người B bấm phím của mình (mặc định **P**). Hết giờ trận tự chạy tiếp. **Esc** và nút tạm dừng trên sân chỉ mở menu (không tính lượt, không được sửa đội hình); hết lượt thì phím tạm dừng cũng chỉ mở menu và sân báo "đã hết 3 lượt". Rời màn trận hoặc cửa sổ mất focus thì lượt đang chạy đổi thành tạm dừng thường (không tự chạy tiếp). Trong lượt tạm dừng chỉ bên xin dừng được sửa đội hình/chiến thuật của mình.

### Câu lạc bộ và 300 cầu thủ

Dữ liệu trong `teams.js` (`window.PTSC_TEAMS`, sinh từ `document/top_10_clb_bong_da_2026_300_ngoi_sao_25_huyen_thoai_khoi_phuc.xlsx`): **10 câu lạc bộ** (Real Madrid, FC Barcelona, Manchester United, Paris Saint-Germain, Manchester City, Juventus, Liverpool, Chelsea, Bayern Munich, Arsenal), mỗi đội **30 ngôi sao và huyền thoại** với vị trí 11 người (GK/CB/LB/RB/CDM/CM/CAM/LM/RM/LW/RW/ST/CF), vai trò, tóm tắt lối chơi, OVR, chiều cao, cân nặng, **10 chỉ số cố định** 1–99, kiểu tóc/màu tóc/da/râu/lông mày/phụ kiện/dáng mặt, kiểu ăn mừng đặc trưng, số áo quen thuộc và tên hiển thị ngắn. Logo và hai bộ áo (sân nhà, sân khách) của mỗi đội nằm trong `assets/teams/`.

- **Chọn đội → bốc 9 người:** mỗi trận `PTSCTeams.pickSquad` bốc ngẫu nhiên **1 thủ môn, 3 hậu vệ, 2 tiền vệ, 3 tiền đạo** từ 30 người (CB/LB/RB → hậu vệ; CDM/CM/CAM/LM/RM → tiền vệ; LW/RW/ST/CF → tiền đạo). Trong mỗi tuyến, người OVR cao hơn đá chính (6 người: TM, 2 HV, 1 TV, 2 TĐ), ba người còn lại ngồi dự bị. Số áo trùng trong 9 người được đổi sang số trống. Hai người OVR cao nhất ngoài thủ môn là trụ cột (đá lâu hơn, máy không tự thay). **Trận mới** giữ hai câu lạc bộ nhưng bốc lại.
- **Áo đấu:** đội thứ nhất mặc áo sân nhà; nếu màu áo hai đội gần nhau (so khoảng cách màu), đội thứ hai mặc áo sân khách (ví dụ Liverpool – Manchester United, Real Madrid – Juventus). Thủ môn luôn mặc màu khác cả hai áo. Áo có sọc giữa (Barcelona, PSG, Juventus, Liverpool sân khách…); số áo tự đổi màu mực cho áo sáng. Bảng tỉ số ghi tên ngắn (RMA, BAR…), chấm màu và khán đài theo màu áo.
- **Khuôn mặt:** đầu được ghép từ các phần cùng phong cách sticker: dáng mặt (tròn/dài/vuông), 18 kiểu tóc (trọc, húi cua, cắt ngắn, dựng, quiff, vuốt ngược, ngôi lệch, xoăn, afro, gợn sóng, dài, búi, mohawk, tết, bát úp, hói trán, undercut, đuôi ngựa), 8 màu tóc, 4 tông da, 6 kiểu râu, 3 kiểu lông mày, băng đô/kính. Mặt sau đầu (góc nhìn penalty) vẽ theo kiểu tóc. Chân dung trong Kế hoạch trận được lưu đệm trong mỗi trận.
- **Ăn mừng đặc trưng:** mỗi cầu thủ có kiểu riêng (SIUU, chỉ lên trời, trái tim, lộn nhào, khoanh tay, chào kiểu nhà binh, khum tai, quỳ cầu nguyện, máy bay, trượt gối, nhảy múa, hôn huy hiệu, suỵt, ôm đồng đội, chỉ tay cảm ơn, dang tay, vung nắm đấm); anh ta dùng nó khoảng 3/4 số bàn, trừ khi tình huống đặc biệt (gỡ hòa muộn → cả đội ôm nhau; đang bị dẫn → ôm bóng về giữa sân).
- **Chỉ số và OVR** của 300 cầu thủ hiển thị đúng như dữ liệu (thang 1–99, OVR biên tập của từng người) ở màn chuẩn bị, Thông tin game và trong trận. **Độ khó** cộng/trừ chỉ số của đội máy lên cả chỉ số cố định và OVR (trừ Bắt bóng của cầu thủ sân). Ba trung vệ (Boateng, Bonucci, Stones) được chỉnh lại chỉ số phòng ngự so với file gốc; xem `tools/teams/build-teams.cjs`.
- **Thông tin game → Đội bóng:** duyệt 10 câu lạc bộ: logo, hai bộ áo, số người từng tuyến, OVR đội hình mạnh nhất và danh sách 30 cầu thủ.

Mỗi đội vẫn gồm thủ môn và 5 cầu thủ. Giữ nguyên hình vẽ, góc nhìn, thể lực và thẻ phạt. Camera bám bóng, kể cả khi thay người; thay người (tự động hoặc do bạn chọn trong Kế hoạch trận) chỉ lúc bóng chết và đồng hồ dừng đến khi thay xong. Cầu thủ ra/vào chạy nhanh gấp đôi; bàn giao và chờ đá tiếp đã được rút ngắn.
Chế độ chơi không dùng lịch bàn thắng của chế độ xem; tỷ số phụ thuộc vào thao tác, vị trí sút, đối thủ và thể lực. Hết giờ có thể hòa.

Tam giác xanh trên đầu và vòng dưới chân đánh dấu người đang điều khiển, giống mẫu tham chiếu; người B dùng xanh lam.
Mũi nhỏ dưới chân hiển thị hướng theo input và giữ hướng cuối cùng khi thả phím. Cầu thủ đã nhận thẻ vàng luôn có biểu tượng vàng trên đầu (theo danh tính khi thay người).
**Hỗ trợ ngắm** bật mặc định, có thể bật/tắt ở màn chuẩn bị hoặc trong menu trận: chuyền tới đồng đội gần hướng ngắm nhất và sút trúng khung thành.
**Tự động đổi người** bật mặc định (màn chuẩn bị hoặc Kế hoạch trận → Hỗ trợ): khi đội mình không có bóng, con trỏ tự nhảy sang đồng đội gần bóng nhất (bóng đang bay thì gần điểm rơi; thủ môn chỉ khi bóng trong vòng cấm), chỉ khi người đó gần hơn rõ rệt (1,5 m) để không nhấp nháy; người bạn vừa chọn bằng phím đổi người được giữ 1,2 giây. Tắt thì chỉ đổi bằng phím.
Thủ môn vẫn có thể cứu thua. Khi tắt hỗ trợ, bóng đi theo mũi tên; có thể chuyền hụt, ra biên, sút lệch hoặc phản lưới.

| Thao tác | Người A / đấu với máy | Người B |
|---|---|---|
| Di chuyển theo hướng màn hình | W A S D | Các phím mũi tên |
| Giữ để nạp lực chuyền, thả để đá (khi có bóng); **bấm hai lần nhanh: chuyền siêu tốc** (bóng sệt rất nhanh tới đồng đội xa nhất, tốn 6% thể lực) | F | J |
| Có bóng: giữ để nạp lực sút, thả để đá; phòng ngự: bấm để xoạc (tự bám đối thủ trong 5,5m) | G | K |
| Chọn cầu thủ gần bóng nhất, kể cả lúc chờ; **khi đang cầm bóng: gọi đồng đội theo hướng mũi tên chạy chỗ thẳng về khung thành** | R | U |
| Giữ để chạy nhanh | T | I |
| Giữ để bám người: người cầm bóng, người sắp nhận đường chuyền, hoặc bóng tự do; thả là dừng | V | N |
| Bấm để tranh bóng khi đủ gần đối thủ | B | M |
| Skill đặc biệt (icon cạnh tên/thể lực là chỉ dẫn) | E | O |

Đây là bộ phím mặc định; có thể đổi theo ý trong mục **Tùy chỉnh phím** bên dưới.
Các phím hành động nằm thành cụm hai cột, ba hàng: A **R/T – F/G – V/B**, B **U/I – J/K – N/M**. Chuyền, pressing và tranh bóng có phím riêng. Hai người dùng các phím không trùng nhau; hướng dẫn trên sân và ngoài sân vẽ đúng cụm phím này.

### Tùy chỉnh phím

- Trong màn chuẩn bị, hàng **Bố trí phím** (hai người: **Phím người A/B**) chọn layout cho bạn (đấu với máy) hoặc cho từng người A/B (hai người). Lựa chọn của mỗi chế độ được nhớ riêng; ô giải thích liệt kê các phím của layout. Hai người: layout trùng phím với người còn lại được bỏ qua khi đổi.
- Hàng **Tùy chỉnh phím** mở **Thông tin game → Layout phím**: chọn layout cần sửa, bấm vào ô phím rồi nhấn phím mới (Esc để hủy). Phím đã có trong layout sẽ được hoán đổi. Space, Esc, Tab, Ctrl/Alt/Meta và F1–F12 được giữ cho trình duyệt và tạm dừng.
- **Ghi đè layout** lưu đè lên layout đang chọn, **Lưu thành layout mới** tạo bản riêng; layout tự tạo có thể xóa, layout mặc định đã sửa có **Khôi phục gốc**. Các nút **Dùng layout đang sửa cho** gán ngay cho Đấu máy · Bạn, Hai người · A hoặc B.
- Mọi layout và lựa chọn được lưu trong `localStorage` của trình duyệt này (khóa `ptsc-football.key-layouts.v1`), không gửi đi đâu. Nếu trình duyệt chặn lưu trữ, thay đổi chỉ áp dụng trong lần mở trang đó.
- Hai người chơi không bao giờ dùng chung một phím: chọn hoặc ghi đè layout gây trùng sẽ bị từ chối kèm danh sách phím trùng.
- Hướng dẫn trên sân, ngoài sân, phạt góc, đá phạt, skill và penalty đều vẽ theo layout đang dùng. Đổi layout giữa trận có hiệu lực ngay.

Bấm **Vào sân** (hoặc **Trận mới**): sân chờ ở thế giao bóng, menu trận hiện **Nhấn Space để bắt đầu trận đấu**. Nhấn Space để vào trận, rồi dùng lại Space để tạm dừng/tiếp tục. Phím này không nằm trong hướng dẫn cơ bản trên sân.
Khi tạm dừng (Space, Esc hoặc nút tạm dừng trong sân), menu trận hiện tỉ số, phút và **Nhấn Space để tiếp tục trận đấu**; con trỏ nằm ở **Tiếp tục**.
Pad minh họa gắn WASD cho A, phím mũi tên cho B. Hai cụm hướng dẫn cơ bản nằm riêng góc trái/phải sân, độ mờ 30%.
Phần trăm và thanh thể lực của người đang điều khiển hiện ngay trong sân: A bên trái, B bên phải, vẫn đọc được khi toàn màn hình; chuyển màu cảnh báo khi dưới 35%.
Tam giác xanh (A) hoặc xanh lam (B) đánh dấu người đang điều khiển.
Tự chuyển điều khiển ngay sang người cầm bóng, kể cả thủ môn khi bắt bóng hoặc phát bóng; thủ môn tự bảo vệ khung thành khi không được điều khiển.
Giao bóng, đá phạt, phạt góc, đá biên và phát bóng lên luôn trỏ về người thực hiện khi chờ đưa bóng vào cuộc. Người này tự tới vị trí cạnh bóng rồi đứng yên; phím di chuyển chỉ đổi hướng ngắm, R/U giữ điều khiển ở người đá cho đến khi bóng vào cuộc. Khi không bị khóa bởi tình huống này, R/U lần đầu ưu tiên người gần bóng; các lần liên tiếp trong 1 giây luân phiên qua những đồng đội đủ điều kiện. Mỗi lần bấm riêng đổi ngay, không chờ hồi hay kết thúc động tác; giữ phím bắt đầu lặp sau 140ms, rồi lặp mỗi 45ms, không phụ thuộc độ trễ lặp phím của hệ điều hành. Nhả phím, mất focus hoặc đổi chế độ sẽ hủy lặp. Lựa chọn thủ công được giữ đến khi bóng đổi chủ hoặc có tình huống nhận/giao bóng mới.
Giao bóng phải có cầu thủ đứng trong 1,4m cạnh bóng giữa sân. A dùng **F**, B dùng **J** (giữ rồi thả để chuyền). Space chỉ bỏ tạm dừng, không tự chuyền giao bóng. Máy cũng phải tới cạnh bóng trước khi chuyền.
Phạt góc có người đá đứng trong 1,4m cạnh cờ, luôn điều khiển người đó. Chỉ dẫn phím nhỏ nằm ở góc tương ứng A/B; không mở bảng chọn chuột. Chưa có người cạnh bóng hoặc trọng tài chưa quay lại thì không phát bóng. Người đá đứng yên cạnh cờ cho đến khi thực hiện; máy tự chọn kiểu đá khi sẵn sàng.

| Kiểu phạt góc | A | B |
|---|---|---|
| Tạt bổng | F | J |
| Chuyền ngắn | G | K |
| Đập nhả | V | N |
| Trả tuyến hai | B | M |
Khi giao bóng chờ người chơi, cả hai đội đứng yên ở vị trí giao bóng trong nửa sân nhà (người được điều khiển cũng không qua được vạch giữa). Khi phạt góc hay đá phạt chờ người chơi, người chạy chỗ, người kèm, người giữ cột, hàng rào và thủ môn giữ nguyên chỗ đã bố trí cho tới khi bóng được đá. Các cầu thủ khác vẫn có thể di chuyển lúc bóng chết, thay người và trọng tài nghỉ. Với người được điều khiển không phải người thực hiện bóng chết, input di chuyển ngắt đường chạy bố trí tự động; nhấn hướng phản hồi ngay, nhả phím dừng ngay. Space vẫn đóng băng trận. Đồng hồ và thể lực không giảm trong các khoảng chờ.
Giữ V/N là bám theo ngay, chạy 6,8 m/s: bám người đối phương đang cầm bóng (cách 0,85 m); khi đối phương chuyền thì bám người nhận (hoặc chạy tới điểm bóng rơi); bóng tự do thì chạy tới bóng. Đội mình có bóng hoặc bóng chết thì phím không có tác dụng. Thả nút dừng ngay, không tự tranh bóng/xoạc.
Đá phạt thường ưu tiên cầu thủ có **Vua đá phạt** còn lượt và đủ thể lực, tự điều khiển người đó. Người đá tự vào vị trí cạnh bóng rồi đứng yên chờ thực hiện; không đổi sang người khác trong lúc chờ. Giữ rồi thả **F/J** để chuyền, **G/K** để sút; có nạp lực, hướng ngắm và đường bóng cao/thấp như lúc chơi. Trên sân chỉ hiện chỉ dẫn phím nhỏ. Đội phòng ngự (kể cả người điều khiển) luôn lùi cách bóng 5 m từ lúc thổi còi cho tới khi bóng được đá, dù người chơi chờ bao lâu. Cú đá của đội người chơi chờ thao tác; máy chỉ đá sau khi người đá và hàng rào chuẩn bị xong, cân nhắc kích hoạt Vua đá phạt.
Phạm lỗi trong vòng cấm bán nguyệt của đội phòng ngự dẫn tới **penalty trong trận**: màn camera từ sau người sút, hai bên chọn trái/giữa/phải. Vào thì cộng bàn thật và chuẩn bị giao bóng; bị cản thì thủ môn ôm bóng tiếp tục. Tình huống này tách khỏi luân lưu cuối trận, không cộng vào tỷ số luân lưu.
Thủ môn được tăng nhẹ khả năng cản sút thường và bắt dính; sút thần sầu dễ ghi bàn hơn nhưng vẫn có thể bị cứu thua.
Thủ môn băng ra thường xuyên: cắt bóng ở điểm sớm nhất trên đường bay mà kịp tới (bóng đủ thấp, trong vòng cấm), xét lại mỗi 0,35 giây, tầm lao ra 9 m; gặp tiền đạo thoát xuống đối mặt thì lao ra sớm từ mép vòng cấm. **Khi bóng vào tầm với (sải tay + nhoài khoảng 1,6 m), thủ môn nhoài người tới vị trí bóng sẽ tới**, không chạy lên rồi đứng chờ. Nhoài vào chân đối phương là tranh chấp: Bắt bóng đấu Rê bóng (35–90%); thua thì bị qua người và nằm sân. Đối phương sút ngay lúc thủ môn đang lao ra/nhoài tới trong 6 m thì khả năng thủng lưới giảm theo khoảng cách (sát 1 m chỉ còn khoảng 40%).
**Phát bóng** (bóng qua vạch cuối sân do đội tấn công): thủ môn chạy về chỗ phát bóng cách giữa khung thành khoảng 2,7 m, bóng đặt ở đó, cả hai đội chờ ở vị trí sơ đồ. Thủ môn đội máy chuyền lên (chuyền dài hoặc ngắn tùy lối chơi) sau 0,5 giây; thủ môn đội người chơi được tự chọn và **chờ phím chuyền** (giữ nạp lực được, không sút, không dẫn bóng); trên sân hiện "Phát bóng · tên thủ môn".
Thủ môn ôm bóng trên tay tối đa 6 giây trước khi tự phát bóng. Khi đi ra khỏi vòng cấm bán nguyệt, thủ môn tự hạ bóng xuống chân và tiếp tục điều khiển bình thường; không bị ép phá bóng khi bóng đã ở chân. Việc kiểm tra xét cả vị trí bóng trên tay và sân hiện tại sau đổi sân.
Đồng đội hỗ trợ tự động. Xoạc có thời gian hồi, tốn thể lực, có thể phạm lỗi hoặc bị thẻ; xoạc hụt vẫn có động tác trượt và đứng dậy.
Khi chuyển chế độ hoặc rời cửa sổ, trận chơi tạm dừng để tránh kẹt phím.
Phím hướng đang giữ được ghi nhận cả lúc tạm dừng: giữ hướng rồi nhấn Space để bắt đầu/tiếp tục thì cầu thủ chạy ngay, không phải nhả ra bấm lại. Engine tự quyết định lúc nào được di chuyển (ăn mừng, bóng chết…), nên khi trận chạy lại phím đang giữ có tác dụng ngay.
Nhấn/thả phím được bắt ngay ở cửa sổ, dùng vị trí phím `KeyboardEvent.code`. Di chuyển cập nhật input trực tiếp, không đợi HUD 250ms hoặc lần lặp của hệ điều hành. Khi vẫn giữ phím và sân đang có focus, một sự kiện nhấn lặp có thể phục hồi input bị xóa. Mất focus, ẩn tab hoặc đổi chế độ sẽ dừng/xóa input. Đổi toàn màn hình giữ các hướng đang nhấn, chỉ hủy chuyền/sút đang nạp.
Di chuyển được ưu tiên hơn đường chạy bố trí, rê bóng và nhận bóng tự động; giữ hướng sẽ nhận lại điều khiển ở mỗi bước mô phỏng. Nhả hướng dừng ngay, không trôi theo quán tính. Động tác ra chân, xoạc, ngã hoặc bắt bóng vẫn hoàn tất; người thực hiện bóng chết luôn vào vị trí và đứng yên cho tới lúc đá. Nếu người chơi chạy khỏi điểm nhận bóng, bóng không tự dịch chuyển theo người. Trọng tài dừng trận hủy cú chuyền/sút đang chờ nhưng giữ các hướng di chuyển.
Chọn **Tiếp tục** để trở lại. Đổi lựa chọn áo/sân áp dụng ở trận mới. Website chơi cùng máy cần bàn phím.

Lực nạp đầy sau khoảng 0,9 giây, có thanh lực dưới chân và trong bảng cầu thủ. Lực thấp cho đường bóng thấp; lực cao tăng tốc độ, tầm chuyền và độ bổng.
Hỗ trợ ngắm giữ cú sút trong khung thành; khi tắt hỗ trợ, sút quá mạnh có thể vọt xà.

### Thao tác nâng cao

- Nhấn **sút hai lần nhanh** (G hoặc K): sút thần sầu, lấy đà 0,6 giây, tiêu hao 30% thể lực, cần ít nhất 30% thể lực. Có thể bị cản; không bảo đảm ghi bàn.
- Nhấn **chuyền hai lần nhanh** (F hoặc J): chuyền siêu tốc, bóng sệt 26 m/s tới đồng đội xa nhất (ưu tiên người ở phía trước), bất kể hướng ngắm; tốn 6% thể lực (hơn cú sút mạnh nhất, 3%), cần ít nhất 12%. Một lần bấm chuyền ngắn chờ 0,2 giây xem có lần bấm thứ hai không rồi mới chuyền thường.
- Khi phòng ngự, bấm **B hoặc M** khi gần đối thủ: 30% lỗi nhẹ, 50% cướp bóng, 15% lỗi đáng nhận vàng, 5% lỗi nặng. Thẻ đỏ và vàng thứ hai được xét thêm theo mức độ lỗi và kế hoạch thẻ đỏ thường của trận. Giữ V/N chỉ áp sát, không tự tranh bóng.
- Xoạc tự hướng và bám theo người cầm bóng trong phạm vi 5,5m, kể cả khi hướng ngắm chưa chính xác. Ngoài phạm vi này vẫn trượt theo hướng ngắm và có thể hụt; đối thủ chuyền/sút trước khi tiếp xúc cũng thoát được pha xoạc. Khi thực sự chạm đối thủ: **50% lấy bóng / 50% thẻ đỏ trực tiếp**. Một lần rút độc lập cho **30% gây chấn thương**, kể cả pha lấy bóng sạch. Có chấn thương thì dừng đồng hồ, xử lý và thay người trước khi đá tiếp; lấy bóng sạch vẫn giữ quyền kiểm soát sau khi chữa trị. Người chấn thương (được cáng hoặc được dìu) luôn ra đường biên gần, nơi **xe cấp cứu 115** chạy tới đón rồi chạy khỏi màn hình; anh ta không thể trở lại trận đó. Khoảng một nửa số ca, sau đó anh ta quay lại đứng cạnh băng ghế với chân băng bó và nạng, tay băng treo hoặc đầu quấn băng, chỉ để cổ vũ.
- Tranh chấp tự động trong chế độ chơi có 22% phạm lỗi khi áp sát và thực sự chạm người cầm bóng. Chế độ xem tăng xác suất phạm lỗi khi tranh bóng từ 9–17% lên 22–32%, tùy thể lực. Nhánh xử lý lỗi thông thường tăng khả năng xét thẻ từ 12% lên 45%.
- Mỗi trận rút một kế hoạch độc lập với xác suất 30% để có thẻ đỏ do tranh chấp thường. Trận được chọn ưu tiên tạo một pha phạm lỗi nặng khi có đối thủ ở đủ gần; các lỗi nhẹ của người đã nhận vàng chỉ bị nhắc nhở, lỗi nghiêm trọng có thể nhận vàng thứ hai, lỗi rất nặng có thể đỏ trực tiếp. Tối đa một đỏ thường theo kế hoạch; đỏ do xoạc giữ tỷ lệ 50/50 riêng và không tiêu thụ kế hoạch này. Mục tiêu 30% là xác suất chọn kịch bản, chưa phải tỷ lệ thực nghiệm trên nhiều trận.
- Phạm lỗi không có chấn thương có 25% dẫn tới đôi co/xô xát, với ít nhất 20 giây giữa hai tình huống. Cảnh đôi co không rút thêm thẻ cho pha B/M hoặc xoạc đã có kết quả định sẵn.

### Skills đặc biệt

Mỗi cầu thủ dùng tối đa **một lần mỗi trận**, tiêu hao **40% thể lực**, cần ít nhất 40% để kích hoạt. **Bấm skill là skill luôn được kích hoạt** (không còn thông báo kích hoạt thất bại); kết quả của pha bóng vẫn tùy tình huống. Skill tấn công kéo dài 2 giây bóng trong cuộc; **skill phòng ngự kéo dài 3 giây (hơn 50%)**; skill thủ môn tự bật 5 phút. Khi skill đang hiệu lực, **icon của skill hiện trên đầu cầu thủ** và mất khi hết (skill tức thời như sút/chuyền hiện 1,6 giây). Lượt dùng gắn với danh tính cầu thủ, giữ nguyên khi ra/vào sân, qua hiệp phụ; trận mới đặt lại. Nhấn **E cho A, O cho B**; icon cạnh tên/thể lực là chỉ dẫn, không phải nút chuột.
Mỗi cầu thủ có một skill trận thường, phần lớn theo vị trí nhưng không cố định: tiền đạo 85% skill tấn công/15% phòng ngự, tiền vệ 60/40, **hậu vệ 30% có skill tấn công**, **thủ môn 25% có skill tấn công** (Chọc khe, Cầm nhịp, Bứt tốc; không có skill sút). Kèm chuyên môn bóng chết phù hợp vai trò. Chỉ khoảng 30% cầu thủ sân có skill sút pen và 50% thủ môn có skill bắt pen. Icon tự chuyển theo tình huống; **tất cả chuyên môn trong trận dùng chung một lượt của cầu thủ** (riêng skill penalty tính riêng). Bấm sai tình huống không mất lượt hay thể lực. Máy dùng cùng bộ điều kiện với người chơi. Bảng skill ngoài sân có mô tả ngắn từng skill.

| Tình huống | Skill / vai trò | Khi nào dùng và hiệu quả |
|---|---|---|
| Tấn công | Bứt tốc bất khả cản, Bóng ma sân cỏ (FW), Nhạc trưởng (MF) | Đội mình triển khai bóng; có thể tăng tốc chạy chỗ không bóng. Hiệu lực 2s bóng trong cuộc, bảo vệ bóng khi cầm bóng. |
| Tấn công có bóng | Sát thủ vòng cấm (FW), Chuyền xuyên tuyến (MF) | Người đang chọn phải có bóng; sút đặc biệt hoặc chuyền nhanh ngay, không giữ lệnh chờ nhận bóng về sau. |
| Phòng ngự | Tường thép, Siêu phòng thủ, Máy quét (DF) | Bóng trong cuộc và đối phương triển khai. Cướp bóng có cửa sổ 2s để áp sát trong 5,5–7m; buff phòng ngự có hiệu lực 2s. |
| Thủ môn (tự kích hoạt) | Bàn tay thép, Thủ môn quét, Phản xạ chớp nhoáng (GK) | Không cần bấm phím, không tốn thể lực. Khi đối phương tấn công trong nửa sân nhà, mỗi phút đồng hồ trận có 7% tự bật; một lần/thủ môn/trận, kéo dài **5 phút đồng hồ trận** (dừng khi bóng chết). Bàn tay thép: giảm 40% khả năng thủng lưới và luôn bắt dính; Phản xạ: giảm 45%, phản ứng nhanh hơn; Thủ môn quét: giảm 20%, lao ra xa thêm 3m. HUD hiện số phút còn lại. |
| Đá phạt trực tiếp | Vua đá phạt (MF), Đại bác bóng chết (FW) | Chỉ người thực hiện, đã đứng cạnh bóng và trọng tài cho phép. E/O thực hiện cú sút đặc biệt 70% ghi bàn. Không dùng ở phạt gián tiếp. |
| Đá phạt góc | Đường cong góc cờ (MF/FW) | Chỉ người đá đã sẵn sàng. E/O tạt bổng; kích hoạt thành công đưa bóng đến người tấn công đánh đầu, không bảo đảm bàn thắng. Các phím F/G/V/B hoặc J/K/N/M vẫn đá góc thường. |
| Chống phạt góc | Lá chắn không chiến (DF) | Lúc đối thủ chờ đá góc. E/O chuẩn bị cản đúng quả góc đó, tối đa một lá chắn mỗi đội/tình huống. Thành công ưu tiên phá bóng; hết tình huống hủy hiệu ứng. |
| Sút penalty | Bản lĩnh chấm phạt (khoảng 30% cầu thủ sân) | **Tự bật ở mọi lượt sút** (trong trận và luân lưu), không cần bấm phím, không tốn thể lực, không tính vào lượt skill trong trận. |
| Bắt penalty | Người hùng bắt pen (50% thủ môn) | Tự bật ở mọi lượt, bị động. |

Skill sút (Dứt điểm, Đá phạt, Đại bác) luôn tung ra cú sút đặc biệt trúng khung với **70% vào lưới**; nếu thủ môn đối phương đang bật skill thủ môn thì tỷ lệ giảm theo mức của skill đó (Bàn tay thép còn 42%, Phản xạ 38,5%, Thủ môn quét 56%). Khi hai skill đối nhau cùng bật ở phạt góc (Phạt góc và Không chiến), hai lợi thế triệt tiêu, quay về cách xử lý thường. Penalty: sút khác hướng thủ môn đoán là vào. Thủ môn đoán đúng hướng: có Bắt pen thì luôn bắt được, trừ khi người sút dùng Sút pen (80% bắt được); không có Bắt pen thì bắt được 80%, nhưng chỉ 20% nếu người sút dùng Sút pen. Áp dụng cả penalty trong trận và luân lưu.

Đội triển khai được xác định bằng người cầm bóng; lúc bóng bay dùng quyền triển khai gần nhất. Không có thời gian hồi đầu trận: tăng tốc có thể bật khi đội mình chuẩn bị giao bóng, nhưng skill sút/chuyền cần người đó thực sự có bóng. Đường chạy tự động không khóa skill. Động tác đang ra chân hiển thị **Đang ra chân**; chờ vào vị trí đá phạt hiển thị **Vào vị trí**. Tạm dừng giữa trận không nhận lệnh kích hoạt.

Mỗi skill có một icon tượng hình riêng (cùng nét, cùng khung) và nhãn 1–2 từ: Bứt tốc, Dứt điểm, Lách người, Đá phạt, Cầm nhịp, Chọc khe, Chặn đứng, Tổng thủ, Cắt bóng, Bắt dính, Lao ra, Phản xạ, Đại bác, Phạt góc, Không chiến, Sút pen, Bắt pen. Nhãn hiện ngay dưới icon trên sân; **Bảng skill** ngoài sân chia nhóm Tấn công, Phòng ngự, Thủ môn (tự kích hoạt), Đá phạt & phạt góc, Penalty; mỗi skill có icon, nhãn, tên và tình huống dùng. Không khả dụng chuyển xám. Trạng thái nêu lý do cụ thể: **Cần có bóng**, **Chỉ tấn công**, **Chỉ phòng ngự**, **Chỉ bắt pen**, **Thiếu lực**, **Đã dùng**… Tên skill, loại tình huống và phím E/O hiện dưới bảng cầu thủ; màn penalty hiện thêm chỉ dẫn skill ở mỗi góc. Khi luân lưu đổi lượt, tự chọn người sút tiếp theo và thủ môn bên kia; không lộ hướng trước khi cả hai chốt.

Tham khảo thiết kế tình huống từ [hướng dẫn gameplay chính thức của Konami](https://www.konami.com/efootball/en/page/2022/season1_patch-notes_v1-0-0) và cách nhận vị trí/lặp phím từ [MDN KeyboardEvent](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent). Phân loại, tỷ lệ và giới hạn lượt ở đây là cơ chế riêng của PTSC Cup.

### Lối chơi (playstyle)

Mỗi cầu thủ có **một lối chơi tấn công** (khi đội mình có bóng) và **một lối chơi phòng ngự** (khi mất bóng). **Lối chơi không đổi chỉ số**: chỉ số là của riêng cầu thủ (dữ liệu cố định); lối chơi quyết định anh ta tự làm gì khi không được điều khiển (đứng đâu, chạy chỗ nào, áp sát hay chờ, rê hay chuyền). Với 300 cầu thủ, lối chơi được suy từ vai trò, vị trí và chỉ số trong dữ liệu. Bộ lối chơi là của riêng PTSC Cup, đặt tên mới và thiết kế cho sân 6 người; mỗi kiểu có tên, một dòng tóm tắt và mô tả. Ngoài các thông số cũ (dâng cao, độ rộng, đi lại, sút, rê, tạt, phối hợp, chuyền dài, áp sát, kèm người, cắt bóng, tuyến hàng thủ, lao ra), có ba hành vi mới: **lệch theo bóng** (dạt về phía có bóng, hoặc ngược lại rình ở phía xa bóng), **chờ rìa vòng cấm** (đứng ngoài vòng cấm đón bóng bật ra) và **che trục** (khi mất bóng đứng trên đường từ bóng tới khung thành nhà). Lối chơi gắn với cầu thủ (đi theo khi thay người; vào ở vị trí khác thì nhận kiểu hợp vị trí đó). Người đang được điều khiển đi theo phím bấm; lối chơi quyết định phần còn lại.

| Vùng | Khi có bóng · tấn công | Khi mất bóng · phòng ngự |
|---|---|---|
| Tiền đạo | **Mũi khoan**: rình phía xa bóng rồi xé khe. **Nam châm**: đứng giữa vòng cấm hút bóng tạt, đánh đầu. **Bức tường**: lùi về phía bóng làm điểm tựa, nhả bóng. **Vũ công biên**: ôm biên, rê bó vào. **Kẻ đón lõng**: chờ rìa vòng cấm, sút một chạm. **Số 9 ảo**: lùi khỏi hàng thủ để nhận bóng, rê và phối hợp. | **Thợ săn**: áp sát thủ môn và hậu vệ ngay khi mất bóng. **Lò xo**: đứng cao chờ phản công. **Cái bóng**: lùi che trục giữa. |
| Tiền vệ | **Máy đếm nhịp**: chuyền ngắn giữ nhịp. **Cơn gió muộn**: băng muộn vào vòng cấm. **Người rải bóng**: đứng phía ít người, phất dài đổi cánh. **Tự do**: đi khắp sân, rê và sút. | **Lá chắn**: chắn trước hàng thủ, che đường bóng. **Pít-tông**: lên xuống, áp sát liên tục. **Máy cắt cỏ**: lao vào tranh chấp. **Người đọc trận**: đón lõng cắt bóng. |
| Hậu vệ | **Bệ phóng**: đứng lại, phất dài. **Trung vệ cầm bóng**: dẫn bóng vượt tuyến. **Đường chồng biên**: chạy chồng phía có bóng và tạt. | **Con đỉa**: bám người. **Chốt chặn cuối**: đứng thấp nhất, bọc lót. **Bẫy việt vị**: dâng hàng thủ. **Tường thành**: lùi sát vòng cấm, che đường sút. |
| Thủ môn | **Thủ môn chia bài**: triển khai ngắn. **Máy bắn đá**: đứng cao, phát bóng thật xa. | **Gác đền**: bám vạch vôi, cứu thua tốt hơn. **Thủ môn quét**: lao ra rất sớm. |

### Kế hoạch trận

Mở từ menu trận (**Esc → Kế hoạch trận**; khi chỉ xem: **Đội hình & chỉ số**). Hai đội đặt cạnh nhau với logo và màu áo; đầu mỗi đội là **OVR đội** (trung bình OVR theo vị trí đang đá của những người trên sân), **Sức mạnh** (tổng OVR), **Công** (tiền vệ + tiền đạo) và **Thủ** (hậu vệ + thủ môn), rồi sơ đồ. Mỗi đội một sân nhỏ có chân dung, vị trí và OVR, cùng danh sách đá chính và dự bị (thể lực, thẻ, lượt thay). Trang cầu thủ ghi vị trí gốc (ST, CAM…), vai trò, tóm tắt lối chơi, kiểu ăn mừng và **OVR theo vị trí** (TM/HV/TV/TĐ). Hai người: trong lượt tạm dừng chỉ bên xin dừng được thay người/đổi vị trí/đổi sơ đồ/đổi tùy chọn.

- **Đội hình:** chọn cầu thủ bất kỳ (cả đội máy) bằng Enter để xem **Thông tin cầu thủ** (chiều cao, cân nặng, tầm với, thể lực, thẻ, hai lối chơi, skill, biểu đồ 6 cạnh) và trang **Chỉ số** (10 chỉ số tô màu theo mức). ← → đổi trang, ↑ ↓ đổi cầu thủ.
- **Thay người / đổi vị trí** (X, hoặc nút trong trang cầu thủ): chọn một người trên sân rồi chọn **một người dự bị** (thay người) hoặc **một người khác trên sân** (hai người đổi chỗ cho nhau trong sơ đồ, có hiệu lực ngay cả khi bóng đang lăn; mỗi người giữ bóng, vị trí đứng và chạy dần sang chỗ mới). Thay người: trước giờ bóng lăn đội hình đổi ngay; trong trận, lượt thay chờ tới lần bóng chết kế tiếp (▼ sẽ ra, ▲ sẽ vào; chọn lại để hủy); người vào đá đúng chỗ người ra. Không thay được thủ môn (không có thủ môn dự bị), không đổi vị trí với thủ môn, không thay/đổi người đang bị thương.
- **Chiến thuật:** chọn sơ đồ 2-1-2, 3-1-1, 1-2-2 hoặc 1-1-3 (khi thiếu người là các sơ đồ 4 hoặc 3 người); mỗi sơ đồ ghi OVR đội sẽ có nếu dùng nó. **Đổi sơ đồ sẽ tự xếp lại vị trí** cho OVR đội cao nhất (thử mọi cách xếp 5 cầu thủ sân vào 5 chỗ, lấy tổng OVR theo vị trí lớn nhất; bằng nhau thì giữ nguyên); nút **Tự xếp vị trí tối ưu** làm việc đó bất cứ lúc nào. Thay người tự động và thay người vì chấn thương cũng tự xếp lại; thay người do bạn chọn thì không. Sơ đồ đã chọn được giữ nguyên; bị đuổi người thì đội tự bớt một vị trí cùng kiểu (và xếp lại).
- **Hỗ trợ:** bật/tắt **Tự động đổi chiến thuật** (mặc định tắt: máy đổi sơ đồ theo tỉ số), **Tự động thay người** (mặc định bật: máy thay người mệt lúc bóng chết; chấn thương luôn được thay), **Tự động đổi người** (mặc định bật) và **Hỗ trợ ngắm**. Ba tùy chọn tự động cũng có ở màn chuẩn bị trận.
- Phím: **Q/E** đổi mục, **↑ ↓** chọn, **← →** đổi đội, **Enter** xem cầu thủ, **X** thay người / đổi vị trí, **Esc** quay lại. Đội máy chỉ xem, không sửa được.

### Chỉ số cầu thủ

Mỗi cầu thủ có 10 chỉ số: **Tốc độ, Rê bóng, Chuyền ngắn, Chuyền dài, Dứt điểm, Đánh đầu, Phòng ngự, Sức mạnh, Thể lực, Bắt bóng**. Với 300 cầu thủ của 10 câu lạc bộ, chỉ số là dữ liệu cố định (1–99, mô phỏng phong độ đỉnh cao). Đội hình tùy chỉnh không ghi chỉ số thì sinh từ nền theo vị trí sở trường + ngôi sao (#10, #7) + ngẫu nhiên ±5 (35–95); lối chơi không cộng trừ chỉ số. **OVR theo vị trí:** với cầu thủ câu lạc bộ, OVR ở vị trí sở trường đúng như dữ liệu; ở vị trí khác, OVR cộng/trừ hiệu giữa điểm có trọng số của vị trí đó và của vị trí sở trường (trọng số: TĐ dứt điểm 30%, tốc độ 20%, rê 20%, đầu 10%, sức 10%, chuyền ngắn 10%; TV chuyền ngắn 25%, rê 20%, chuyền dài 15%, bền 15%, thủ 15%, dứt điểm 10%; HV phòng ngự 35%, sức 20%, đầu 15%, tốc 15%, chuyền ngắn 15%; TM bắt bóng 70%, chuyền dài/ngắn/tốc 10%). Ví dụ một cánh phải 94 đá trung vệ chỉ còn khoảng 70. Đội hình tùy chỉnh dùng thẳng điểm có trọng số. Vị trí đang đá là tuyến mà chỗ đứng trong sơ đồ quy định (trong 3-1-1 một tiền đạo đá như hậu vệ và được tính OVR hậu vệ); dự bị tính theo vị trí sở trường.

| Chỉ số | Tác động trong game |
|---|---|
| Tốc độ | Tốc chạy của mọi cầu thủ (AI và người điều khiển): 85 nhanh hơn khoảng 9% so với 70. |
| Thể lực | Tốc độ hao thể lực, nên quyết định khi nào bị thay. Thể lực còn lại dưới 70% kéo mọi chỉ số đang dùng xuống dần (tới −20% khi gần kiệt sức) và chạy chậm lại; chỉ số hiển thị không đổi. |
| Dứt điểm / Đánh đầu | Khả năng ghi bàn ở chế độ chơi (đánh đầu dùng chỉ số Đánh đầu); Đánh đầu còn tăng tỷ lệ đánh đầu khi đón bóng tạt. |
| Bắt bóng | Khả năng cứu thua ở chế độ chơi. |
| Chuyền ngắn | Đường chuyền sệt ít bị cắt hơn. |
| Chuyền dài | Ít chuyền dài quá tay ra biên hơn. |
| Rê bóng + Sức mạnh đấu Phòng ngự + Sức mạnh | Tranh chấp tự động: ai thắng, người rê giỏi đôi khi lách qua pha vào bóng. |

### Thể lực

Mọi cầu thủ trên sân mất sức suốt trận khi bóng lăn (đồng hồ dừng thì không), nhanh hơn khi chạy nhiều: một cầu thủ sân chạy vừa phải còn khoảng 45–55% ở phút 46 và 30–45% hết trận; sprint liên tục thì kiệt sức sau khoảng 25 phút. Thủ môn hao rất ít; dự bị hồi 4,5%/phút; nghỉ giữa hiệp hồi 12%. Dưới 70% thể lực, các chỉ số đang dùng (không phải số hiển thị) giảm tuyến tính tới −20% ở 8%, tốc độ chạy giảm tới 30%, chuyền dễ bị cắt hơn, dứt điểm kém hơn. Tiêu hao thêm: skill 40%, sút thần sầu 30%, chuyền siêu tốc 6%, xoạc 3,5%, tranh bóng 1,5%, cú đá thường 0,5–3% theo lực. Máy thay người khi ai đó dưới 33% (trụ cột 25%).

### Độ khó máy

Chỉ áp dụng cho đội máy trong chế độ đấu với máy; đội của bạn không đổi.

| Độ khó | Chỉ số cả đội | Tranh bóng | Đọc đường chuyền | Dứt điểm | Thủ môn | Ra quyết định |
|---|---|---|---|---|---|---|
| Dễ | −8 | ×0,7 | ×0,6 | ×0,85 | −6 điểm % cứu thua | chậm 50% |
| Thường | 0 | ×1 | ×1 | ×1 | 0 | bình thường |
| Khó | +5 | ×1,25 | ×1,3 | ×1,1 | +4 | nhanh 25% |
| Huyền thoại | +10 | ×1,5 | ×1,6 | ×1,2 | +8 | nhanh 50% |

### Thẻ thông tin

Mỗi đội có một thẻ lớn: OVR, tên, vị trí, chiều cao/cân nặng, thể lực (số lớn và thanh), skill (icon, tên, trạng thái, mô tả), 10 chỉ số dạng ô số lớn tô màu theo mức (xanh ≥80, vàng 65–79, đỏ dưới 65) và hai chip lối chơi. Đội do người chơi điều khiển hiện người đang chọn; **đội máy** hiện người đang cầm bóng hoặc gần bóng nhất. Thẻ hiện nhanh khi giữ Tab; xem từng cầu thủ của cả hai đội trong **Kế hoạch trận**. Màn **Chỉ xem** cũng có thẻ, ô thể lực + skill trong sân và Đội hình & chỉ số cho cả hai đội. Ô trong sân của đội máy hiện thể lực và skill, không có phím.

### Phạt góc

Phạt góc chỉ xảy ra khi bóng thực sự chạm người: thủ môn đẩy ra ngoài, hoặc hậu vệ đứng trên đường bóng (cách đường bóng khoảng 1 m, giữa người sút và khung thành) chặn cú sút đi chệch. Khi đó bóng bay tới, chạm người hậu vệ rồi mới đổi hướng ra ngoài. Không có ai chắn thì là phát bóng lên.

Tranh bóng bằng phím (B/M) vẫn giữ tỷ lệ cố định 30/50/15/5% như mô tả ở trên. Chế độ xem vẫn theo kịch bản bàn thắng. Thẻ cầu thủ hiện OVR và 10 chỉ số; HUD trên sân ghi OVR cạnh tên; **Kế hoạch trận** liệt kê cả hai đội, kể cả dự bị.

### Hình thể cầu thủ (player model)

Mỗi cầu thủ có chiều cao, cân nặng, tỉ lệ chân và tay; từ đó tính sải với tay (m) và tầm quét chân khi tranh bóng (m). Với 300 cầu thủ, chiều cao và cân nặng lấy từ dữ liệu. Đội hình tùy chỉnh không ghi thì sinh theo vị trí (thủ môn 182–196 cm, hậu vệ 174–192, tiền vệ 164–184, tiền đạo 165–191) và chỉ số khối cơ thể 20,5–25. Hình vẽ cao/thấp, to/gầy, chân tay dài/ngắn theo đúng số đo.

| Yếu tố | Tác động |
|---|---|
| Chiều cao, sải tay, Đánh đầu, Sức mạnh | Không chiến: tranh chấp quả phạt góc (khi không bên nào dùng skill), tỷ lệ đánh đầu khi đón bóng tạt. |
| Chiều cao thấp (trọng tâm thấp) | Khó bị cướp bóng hơn khi rê. |
| Cân nặng | Thêm sức mạnh khi tranh chấp; nặng hơn thì chậm hơn một chút. |
| Tầm quét chân | Tầm tranh bóng, tầm xoạc tự bám và tầm chạm khi xoạc. |
| Thủ môn cao, tay dài | Tầm ôm bóng rộng hơn, cứu thua tốt hơn. |

Thẻ cầu thủ ghi chiều cao và cân nặng; bảng đội hình có cột CAO/NẶNG. Có thể ghi `height`, `weight` cho từng cầu thủ trong dữ liệu squads.

### Đội hình tùy chỉnh (squads)

Đội hình là dữ liệu (`PTSCFootball.data.squads`). Truyền `squads` (object hoặc chuỗi JSON, cũng dùng được `data-squads`) khi mount để đá với đội khác; `teams` đặt tên, tên ngắn, logo và màu áo (`colors: { shirt, shorts, socks, stripe, gk }`) cho hai bên, dùng cho bảng tỉ số, khán đài và HUD. Mỗi người có thể có `short` (tên hiển thị), `face` ({ hair, hairColor, skin, beard, brows, extras, build }), `celebration`, `roleName`, `summary`, `pos`, `pillar`. `fixedBench: true` giữ nguyên cả băng ghế thay vì bốc 1–3 người. Trang web dùng `PTSCTeams.pickSquad(id, rng)` và `PTSCTeams.teamOption(idA, idB)` để tạo hai tham số này từ dữ liệu câu lạc bộ. Mỗi đội cần đúng 6 người đá chính theo thứ tự thủ môn, hai hậu vệ, tiền vệ, hai tiền đạo; dự bị tùy ý (tối đa 3 người ngồi ghế mỗi trận). Đội nào thiếu dữ liệu hợp lệ thì giữ đội mặc định. Chỉ số không ghi sẽ được sinh tự động; lối chơi không ghi hoặc không hợp vị trí sẽ được chọn tự động.

```js
PTSCFootball.mount(el, { mode: "cpu", squads: { R: {
  players: [
    { name: "Thủ Thành", head: "buzz", skin: 1, num: 1, stats: { goalkeeping: 90 }, defense: "libero" },
    { name: "Hậu A", head: "spiky", skin: 1, num: 2 }, { name: "Hậu B", head: "curly", skin: 2, num: 3 },
    { name: "Tiền Vệ", head: "beard", skin: 1, num: 8, attack: "spray" },
    { name: "Sát Thủ", head: "quiff", skin: 2, num: 9, star: 7, stats: { finishing: 92, speed: 88 }, attack: "drill" },
    { name: "Cánh Phải", head: "glasses", skin: 1, num: 11 }
  ],
  bench: [{ name: "Dự Bị", head: "buzz", skin: 2, num: 12, natural: "DF" }]
} } });
```

`head` cũ (`buzz`, `spiky`, `curly`, `beard`, `glasses`, `quiff`, `sidepart`) vẫn dùng được và được ánh xạ sang hệ mặt mới; `face.hair` nhận `bald, buzz, crop, spiky, quiff, slick, sidepart, curly, afro, wavy, long, bun, mohawk, braids, bowl, receding, undercut, ponytail`; `hairColor`: `black, darkBrown, brown, blond, ginger, grey, white, platinum`; `skin` 1–4; `beard`: `none, stubble, goatee, short, full, moustache`; `extras`: `none, headband, glasses`; `build`: `round, long, square`. Mã lối chơi xem `PTSCFootball.data.playstyles`.

### Khung thành

Lưới khung thành chia lớp theo chiều sâu: lưới sau và lưới hông phía xa vẽ sau bóng; lưới hông phía gần, lưới nóc và khung cột vẽ đè lên bóng khi bóng đã nằm trong lưới. Cú sút góc hẹp không còn trông như bay ra ngoài cột rồi vẫn tính bàn.

### Cấu trúc dữ liệu gameplay

`PTSCFootball.data` công khai bảng cấu hình `GAME_DATA` trong `ptsc-football.js`: `skills` (id, tên, `roles`, `contexts`, `requiresBall`, hiệu ứng, icon, tốc độ/tầm), `skillContexts` (nhãn và điều kiện tình huống), `skillRules` (40%, 70%, 2s, một lượt, `keeperAuto` 5 phút/7% mỗi phút), `playstyles` (`attack` và `defense`, mỗi kiểu kèm vị trí, tham số hành vi và điểm cộng chỉ số), `stats` (10 chỉ số, nền theo vị trí, trọng số OVR), `squads` (đội hình mặc định), `controls`, `rendering`, `restarts`, `corners`, `goalkeeper` và `celebrations`. Engine và HUD đọc cùng bảng; `skillContext()` xác định tình huống, `specialAvailability()` kiểm tra điều kiện dùng chung cho cả máy và người.

Trạng thái cầu thủ lưu `specialId`, `specialSituations`, `specialUsed`, `specialActiveId`, `specialUntil`; các trường theo danh tính khi thay người. Phạt góc và penalty lưu hiệu ứng theo đúng tình huống/lượt, không mang buff sang lần tiếp theo. Trạng thái giao bóng chờ chuyền tách khỏi bóng trong cuộc, nên không tự đá do hết thời gian chờ.

### Hiệu năng

Dữ liệu 300 cầu thủ nằm trong `teams.js` tải một lần (khoảng 170 KB); mỗi trận chỉ 18 người được tạo trong engine. Chân dung (`api.figure`) và phần đầu theo mô tả mặt được lưu đệm; ảnh logo/áo tải lười (`loading="lazy"`) và chỉ khi lên màn.

- Khán đài, mặt sân và băng ghế nằm trên một lớp nền riêng do GPU dịch chuyển theo camera, không phải vẽ lại mỗi khung hình (chỉ vẽ lại khi đổi mức zoom hoặc khán giả ăn mừng). Khán giả đứng yên khi không có bàn thắng. Trong thử nghiệm, công việc raster giảm khoảng 3–5 lần, khung hình p99 từ 33 ms xuống 16,8 ms.

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
- Bong bóng thoại nhỏ hơn 30% so với trước (tỉ lệ 0,56) để đỡ che sân; các bong bóng chồng nhau tự giãn theo kích thước mới. Cầu thủ và bóng nhỏ hơn 10% để sân trông rộng hơn. Cầu thủ thuộc bên A/B điều khiển nói khi nhận bóng, chuyền, sút, đổi người, áp sát và chạy nhanh; có khoảng nghỉ 2,3 giây giữa các câu để tránh spam.
- Thúc giục chỉ xuất hiện trong trạng thái chờ, cách nhau ít nhất 6 giây sau câu đầu. Sau bàn thắng (và đầu hiệp), trọng tài chỉ thổi giao bóng khi **cả hai đội đã về hết phần sân nhà**. Lúc chờ, không ai bước được sang nửa sân đối phương; cầu thủ đang được chọn tự đi về vị trí nếu người chơi không bấm hướng (đang bấm thì tự do đứng trong nửa sân nhà). Sau 8 giây chỉ giao bóng sớm nếu mọi người đã ở nửa sân nhà; giới hạn tuyệt đối 20 giây để không bao giờ kẹt; thời gian thổi tiếp tục không phụ thuộc việc câu thoại đã kết thúc hay chưa.
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
- Penalty và luân lưu dùng góc nhìn từ sau lưng người sút về khung thành. Người sút và thủ môn là đúng cầu thủ trên sân, vẽ bằng cùng khung xương, nét viền, kiểu tóc, màu da và số áo như trận chính (người sút nhìn từ phía sau). Bảng tỷ số cùng kiểu bảng trong trận; tam giác A/B đánh dấu người đang điều khiển. Khi cả hai chốt hướng: chạy đà, sút, thủ môn bay người, bóng vào lưới hoặc bị đẩy ra; kết quả chỉ hiện khi bóng tới đích.
- Cả bên sút và thủ môn chốt trái / giữa / phải bằng **A/S/D cho A**, **←/↓/→ cho B**. Chỉ dẫn nhỏ nằm riêng hai góc, không có bảng chọn chuột. Hai hướng giữ kín đến khi cả hai bên chốt. Máy chọn ngẫu nhiên trước khi người chơi chốt.
- Sút khác hướng thủ môn đoán luôn vào. Đoán đúng: thủ môn có Bắt pen bắt 100% (80% nếu người sút bật Sút pen); thủ môn không có Bắt pen bắt 80% (20% nếu người sút bật Sút pen). E/O bật Sút pen trước khi chốt hướng; Bắt pen tự áp dụng. Mỗi đội 5 lượt, có thể kết thúc sớm nếu đã phân thắng bại; hòa thì đá tiếp từng cặp. Tỷ số luân lưu hiển thị riêng với tỷ số trận.

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
| `data-auto-tactics`, `data-auto-subs`, `data-auto-switch` | Tự động đổi chiến thuật (mặc định tắt), thay người (bật), đổi người điều khiển (bật) cho đội của người chơi; `"false"` để tắt. |

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
- `index.html`, `game.js`, `game.css`: game một stage: menu chính, chuẩn bị trận, trận đấu với menu trận và các bảng, thông tin game, hộp xác nhận, toàn màn hình (điều hướng bằng hash), bàn phím.
- `assets/control-pad.svg`: hình pad minh họa phím di chuyển.
- `penalties.js`: giao diện penalty/luân lưu và góc nhìn từ sau cầu thủ sút.
- `keymap.js`: layout phím mặc định và tự tạo (có phím tạm dừng riêng cho mỗi người), lưu trong `localStorage`.
- `teams.js`: 10 câu lạc bộ, 300 cầu thủ và các hàm bốc đội hình, chọn áo (`PTSCTeams`).
- `assets/teams/`: logo và áo sân nhà/sân khách của 10 câu lạc bộ (PNG).
- `document/`: file Excel nguồn của dữ liệu cầu thủ.
- `tests/game-browser.cjs`: kiểm tra tích hợp game trên trình duyệt.
