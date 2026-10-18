# PTSC Cup 3D (nhánh `3d`)

Bản 3D của game, phát triển trên nhánh `3d`. Bản 2D trên `main` không bị đụng tới.

## Cách chạy

Mở `3d.html` ở gốc repo qua một máy chủ tĩnh (ví dụ `npx serve` ở thư mục gốc), hoặc xem bản thử trực tuyến:
https://raw.githack.com/thieuhq2906/ptsc-football-widget/3d/3d.html

Mọi thứ ngoài khung sân giống hệt bản 2D: menu, chọn đội, đấu với máy, hai người, chỉ xem, kế hoạch trận, skill, thay người, lượt tạm dừng, layout phím, thông tin game.

## Kiến trúc

- `3d.html` là trang 2D (`index.html`) nạp thêm Babylon.js 9.29 (CDN jsDelivr, cố định phiên bản) và `3d/render3d.js`.
- `3d/render3d.js` đặt `window.PTSCRenderer3D`. Khi engine (`ptsc-football.js`) thấy nó lúc `mount`, mỗi trận (kể cả trận nền ở menu) có một canvas thay cho cảnh SVG; bảng tỉ số vẫn là HTML của engine. Sau mỗi bước mô phỏng engine gọi `view.frame(dt)`; bộ vẽ đọc `api.snapshot()` (vị trí, vận tốc, tư thế, áo đấu, khuôn mặt của mọi người; bóng; người đang điều khiển và hướng ngắm).
- Engine chạy chậm hơn thời gian thực theo `PTSCRenderer3D.timeScale` (0,8): người, bóng và đồng hồ cùng chậm 20%.
- **Cầu thủ**: khung xương dựng bằng mã (hông, gối, cổ chân, vai, khuỷu, cổ tay, cổ, đầu). Góc khớp lấy từ tư thế của engine, cộng lớp tư thế 3D riêng cho những gì góc nhìn nghiêng của 2D không có: dạng tay chân sang ngang, xoay vai, ngả người sang bên. Thủ môn có tư thế chờ, bắt bóng, bay người sang bên phía có bóng, ném tay trên, lăn bóng; cầu thủ có chọc bóng, xoạc, sút, chuyền. Nhịp bước tính theo quãng đường thật nên chân không trượt; bóng khi dẫn chạy trước chân một nhịp.
- **Sân**: vạch kẻ, khung thành có lưới thật (đường lưới), bảng quảng cáo, khán đài ba phía với khán giả nhảy lên khi có bàn thắng, cột đèn, băng ghế dự bị. Vòng tròn và mũi tên chỉ hướng dưới chân người đang điều khiển (A xanh lá, B xanh lam), vòng vàng khi nạp lực, tên trên đầu.
- **Mức đồ họa** lưu ở `localStorage["ptsc3d.quality"]` (`high` hoặc `low`): Cao có viền, hậu kỳ FXAA, bloom, vignette; Thấp giảm độ phân giải và khán giả.

## Còn lại

1. Vật lý bóng trong engine: bóng nảy khỏi người trên đường bay, bóng tự do nảy và lăn, thủ môn đẩy bóng bật ra theo lực thật (đang làm).
2. Màn penalty 3D (hiện vẫn là màn penalty 2D phủ lên sân).
3. Hướng người khi sút và chuyền theo đúng mục tiêu, trộn chuyển động mượt hơn, ngã kiểu búp bê vật lý.
4. Replay và quay chậm bàn thắng, nhiều góc máy.
5. Gộp mesh để giảm số lần vẽ, bộ test cho lớp 3D.
