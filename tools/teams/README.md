# Sinh `teams.js` từ file Excel

`teams.js` ở gốc dự án (10 câu lạc bộ, 300 cầu thủ) được sinh từ `document/top_10_clb_bong_da_2026_300_ngoi_sao_25_huyen_thoai_khoi_phuc.xlsx` bằng các script trong thư mục này. Không sửa tay `teams.js`; sửa dữ liệu nguồn rồi chạy lại.

1. Giải nén file Excel (nó là file zip) vào `tools/teams/book/`:
   `cd tools/teams && cp ../../document/*.xlsx book.zip && unzip -o -q book.zip -d book`
2. `node parse.cjs` → `book.json` (mọi sheet thành bảng, kèm vị trí 30 ảnh logo/áo).
3. Tách 300 cầu thủ: đoạn Node nhỏ trong lịch sử (đọc `book.json`, lấy các sheet câu lạc bộ, cột STT…KĨ NĂNG THỦ MÔN) → `players.json`.
4. `faces-1..5.json`: kiểu tóc, màu tóc, da, râu, lông mày, phụ kiện, dáng mặt, kiểu ăn mừng, số áo và tên ngắn của từng người (đã gán sẵn; chỉ thêm khi có cầu thủ mới).
5. `node build-teams.cjs` → `teams-data.json` (lối chơi suy từ vai trò/vị trí/chỉ số; màu áo hex chỉnh tay trong hằng `TEAMS` của script).
6. Ghép: `header + "window.PTSC_TEAMS = " + teams-data.json + ";" + teams-tail.js` → `../../teams.js`.
7. Ảnh: xuất từ `book/xl/media` (logo 256×256, áo 240×376), lượng tử hóa 8-bit, đặt vào `assets/teams/<slug>.png`, `<slug>-home.png`, `<slug>-away.png`.

`teams-tail.js` là phần chạy trên trình duyệt (`window.PTSCTeams`): bốc 9 người (1 TM, 3 HV, 2 TV, 3 TĐ), chọn áo tránh trùng màu (ngưỡng 0,42), màu thủ môn khác cả hai áo, cặp ngẫu nhiên, sức mạnh đội.
