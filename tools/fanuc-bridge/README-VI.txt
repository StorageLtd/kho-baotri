LTD FANUC BRIDGE — CHỈ ĐỌC, KHÔNG TRUY CẬP PMC
Bridge build: 20261109-login-first

KHUYÊN DÙNG GIAO DIỆN
Tải FANUC-Bridge-Manager.zip trên web, chép ba DLL vào lib rồi nhấp đúp
START-MANAGER.cmd. Có thêm/sửa/gỡ cấu hình máy, chọn mẫu, đăng nhập bằng hộp
thoại, chạy nền, khay hệ thống, trạng thái gửi dữ liệu và nhật ký theo máy.
Cấu hình đã lưu ở LocalAppData vẫn còn khi giải nén bản Manager mới.

CHẠY THỦ CÔNG GÓI NÀY
1. Dừng cầu nối cũ, đóng PowerShell cũ trước khi cập nhật mã nguồn.
2. Giữ bridge-config.json và report-outbox của đúng máy/tài khoản.
3. Chép Fwlib64.dll, fwlibe64.dll, fwlib30i64.dll của bạn vào lib.
4. Mở Windows PowerShell 64-bit trong thư mục chứa Start-FanucBridge.ps1.
5. Chạy:
   Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
   Unblock-File .\Start-FanucBridge.ps1
   Unblock-File .\FanucReader.cs
   Unblock-File .\ReportCollector.ps1
   .\Start-FanucBridge.ps1
6. Phải thấy Bridge build: 20261109-login-first. Đăng nhập tài khoản CMMS
   đã xác minh, có vai trò phù hợp. Mật khẩu/token không lưu vào file.
   Chế độ thủ công cần giữ PowerShell mở; Ctrl+C dừng cầu nối, không dừng CNC.
7. Chỉ kiểm tra cục bộ, không đăng nhập/gửi Firebase:
   .\Start-FanucBridge.ps1 -Once -LocalOnly

MÀN HÌNH CNC MỚI
- POSITION: bốn vùng tọa độ, tải servo, đoạn đang thực thi, G modal và thông số.
- PROGRAM / WORK: toàn bộ file O đang chạy, EXT và G54–G59 của máy phay XYZ.
- OFFSET: bảng giá trị cài đặt, phân trang 16 dòng, phân biệt Memory A/B/C.
- ALARM: chỉ thông tin lỗi. THỐNG KÊ: biểu đồ và báo cáo trong ngày.
- Web có nút Xóa máy; dừng cầu nối trước để bản ghi không được tạo lại.

DAO / GỐC / OFFSET
HD.T/NX.T đọc riêng bằng cnc_rdhdnxt. T modal không thay thế dao trên trục chính.
Nguồn là vị trí đầu/chờ thứ nhất do CNC quản lý, không phải cảm biến vật lý.
Gốc EXT/G54–G59 dùng macro hệ thống và số lẻ CNC trả về, không lấy chênh lệch
vị trí để đoán gốc. Không diễn giải G54.1/P, G52, xoay tọa độ hoặc TCP.
Chọn đúng Phay XYZ 3 trục và Memory A/B/C, đánh dấu đã đối chiếu trên Manager
hoặc web. Cầu nối đối chiếu với loại thật từ cnc_rdtofsinfo và cnc_getfigure.
Loại/độ chia chưa xác minh hoặc máy tiện: không đoán giá trị offset.
Bảng offset làm mới khoảng 30 giây, hiển thị thời điểm đọc; tối đa 2000 dòng.
Path/trục chính mặc định; không tự thu thập mọi kênh khi chọn mẫu nhiều trục.

TOÀN BỘ FILE O
Chỉ đọc CNC → PC bằng cnc_upstart3/cnc_upload3/cnc_upend3. Không gọi download,
không ghi/xóa/chạy chương trình. Không bỏ bảo vệ hoặc đổi chế độ máy.
Đúng số O và kết thúc % mới được coi là đủ; tối đa 2 MiB và ngân sách vòng đọc
2 giây, mỗi lời gọi vẫn chịu timeout của DLL. Đổi O thì đọc lại; cùng O làm mới
khoảng 60 giây. File bận/bị bảo vệ/thiếu tùy chọn hiện Chưa đọc + chẩn đoán.
Nội dung file gửi lên bản ghi máy trong dự án Firebase hiện tại, dùng quyền
đọc/ghi hiện có. Nội dung lớn không được gửi lặp mỗi lần nếu hash không đổi.

ALARM / BÁO CÁO
Alarm mới lưu ngay trong lần đọc phát hiện vào cncAlarms, giữ hàng chờ để gửi
lại. Lỗi đang giữ không tạo bản ghi trùng; mất liên lạc không coi là hết lỗi.
Báo cáo thu thập khoảng START → STOP/RESET; không xác nhận M30, không đọc PMC.
HOLD rồi chạy tiếp cùng lượt. Khoảng mất tín hiệu không tính là giờ RUN.
PART COUNT lấy bộ đếm CNC 6711; số tăng không luôn đồng nghĩa sản phẩm đạt.
Excel gồm Tổng quan và Theo ngày; số liệu cũ không được tự bù bằng suy đoán.
Giữ report-outbox khi cập nhật. last-result.json là mẫu gần nhất, không có mật khẩu.
Nếu báo cáo bị HTTP 401: ghép nhánh FIREBASE-REPORTS-RULES.json vào Rules đang dùng,
không thay toàn bộ và không mở quyền công khai; tệp báo cáo vẫn chờ trên máy.

PHẠM VI / KIỂM TRA
Không đọc/ghi PMC hoặc ghi CNC. Không đổi offset, tham số, chương trình hay
điều khiển chuyển động. DLL do bạn cung cấp chưa được kiểm toán toàn bộ.
Đã kiểm tra mã, ABI giả lập và giao diện; chưa kết nối CNC thật/GUI Windows.
Đối chiếu lần đầu HD.T/NX.T, đơn vị, gốc và offset trên màn hình CNC.

SỬA HỘP ĐĂNG NHẬP — 20261109-login-first
Manager mở hộp đăng nhập nổi trên cùng trước khi nạp DLL hoặc đọc CNC.
Thanh trạng thái phân biệt chờ đăng nhập, xác thực và đọc dữ liệu.
Hủy hộp thoại thì chưa kết nối CNC. Nhật ký hiển thị cả lỗi khởi động.
Nếu cầu nối cũ kẹt: bấm Dừng cầu nối, chờ 15 giây; nút đổi thành Đóng tiến trình.
Xác nhận chỉ đóng tiến trình phần mềm cầu nối của máy đang chọn trên laptop,
không gửi lệnh tới CNC; dữ liệu chưa lưu trong bộ nhớ có thể mất.
Khi cập nhật phải Thoát quản lý từ menu khay hệ thống, không chỉ bấm X.
