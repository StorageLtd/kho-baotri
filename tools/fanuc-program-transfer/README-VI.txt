BẢN THỬ TRUYỀN CHƯƠNG TRÌNH FANUC — CÓ GHI VÀO BỘ NHỚ CNC
Build: 20261107-transfer-trial

Gói này RIÊNG BIỆT với cầu nối giám sát. Không có Firebase, web hay PMC.
Khác với giám sát chỉ đọc: nút Truyền sẽ ghi chương trình NC vào bộ nhớ CNC.
Chưa kiểm chứng trên CNC thật. Chỉ thử khi người có trách nhiệm vận hành máy
có mặt, đã sao lưu chương trình cần thiết và kiểm soát riêng máy đích.

CÁCH THỬ TRÊN WINDOWS 64-BIT
1. Giải nén. Chép Fwlib64.dll, fwlibe64.dll, fwlib30i64.dll vào lib.
2. Kết nối LAN. Nhấp đúp START-TRANSFER.cmd.
3. Nhập IP CNC và cổng FOCAS. Bản thử chỉ chấp nhận IP LAN/link-local.
4. Chọn file NC. Đối chiếu tên file, số O, nội dung và SHA256.
5. Tại máy: dừng máy, chuyển EDIT, không có alarm/emergency.
6. Bấm Kiểm tra CNC. Nếu O-number đã có hoặc không kiểm tra được,
   chương trình sẽ chặn truyền; không tự ghi đè hoặc xóa chương trình.
7. Nhập chính xác TRUYEN Oxxxx (ví dụ TRUYEN O1234), bấm xác nhận truyền,
   rồi xác nhận thêm lần cuối đúng IP, số O và file.
8. Không rút cáp hoặc đóng cửa sổ khi đang truyền. Có thể mất đến 90 giây.
9. Khi CNC nhận xong, người vận hành kiểm tra TOÀN BỘ chương trình trên CNC,
   dao, gốc tọa độ, offset và quy trình chạy thử của nhà máy trước khi chạy.
   Bản thử không đọc ngược để xác minh từng byte; thông báo nhận xong dựa
   trên mã trả về của FOCAS, không xác nhận chương trình gia công an toàn.

GIỚI HẠN CHỦ ĐỘNG CỦA BẢN THỬ
- Chỉ CNC một kênh (path). Máy nhiều kênh hoặc không đọc được số kênh sẽ bị chặn.
- Một file ASCII, đúng một chương trình, có % đầu/cuối và M02/M30.
- Chỉ O0001–O7999, file tối đa 2 MB; không gộp nhiều chương trình.
- Không cho ghi đè O-number đã tồn tại theo lần kiểm tra thư mục trước truyền.
- Không đổi chế độ, không chọn/chạy chương trình, không bấm Cycle Start từ xa.
- Không sửa offset, tham số, ladder, PMC; không có API xóa chương trình.
- File thay đổi sau khi chọn sẽ bị chặn bởi SHA256.
- Kiểm tra định dạng không thay thế kiểm tra nội dung gia công.
- Không truyền đồng thời từ một máy tính/phần mềm khác vào cùng CNC.

NẾU TRUYỀN BỊ LỖI / MẤT MẠNG
Có thể còn chương trình chưa hoàn chỉnh trên CNC. Bản thử không tự thử lại,
không tự xóa. Người vận hành phải kiểm tra bộ nhớ tại máy trước bước tiếp theo.
Không dùng bản thử này thay thế hệ thống DNC đã được nhà máy nghiệm thu.
Nếu IT chặn PowerShell, cần IT cho phép; không yêu cầu cài dịch vụ hoặc mở cổng Internet.
