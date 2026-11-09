LTD CNC BRIDGE MANAGER
Build 20261109-login-first · Windows 10/11 64-bit

CẬP NHẬT
1. Trong bản Manager cũ: dừng từng cầu nối, chờ tiến trình dừng.
2. Nhấp phải biểu tượng Manager ở khay hệ thống → Thoát quản lý.
3. Giải nén bản mới ra thư mục mới. Chép Fwlib64.dll, fwlibe64.dll,
   fwlib30i64.dll của bạn vào lib. Không chạy đồng thời hai cầu nối cùng máy.
4. Nhấp đúp START-MANAGER.cmd. Máy đã lưu trong LocalAppData vẫn còn.
5. Chọn máy → Chạy cầu nối → đăng nhập trong hộp thoại CMMS.
   Mật khẩu và token chỉ nằm trong bộ nhớ, không ghi vào cấu hình hay nhật ký.

THÊM / SỬA / GỠ MÁY
- + Thêm máy → chọn mẫu Vertical Mill, Horizontal Mill, Lathe hoặc Custom.
- Điền tên, IP, cổng, model và tên trục đúng với CNC; bấm Lưu cấu hình.
- Chọn đúng bảng Memory A, B hoặc C và xác nhận đã đối chiếu nếu cần đọc offset.
  Ảnh có LENGTH GEOM/WEAR và RADIUS GEOM/WEAR tương ứng Memory C.
- Kiểm tra FOCAS: chỉ đọc thử, không gửi dữ liệu lên web.
- Chạy cầu nối: đăng nhập CMMS, bắt đầu gửi dữ liệu và báo cáo lên web.
- Sửa cấu hình: dừng cầu nối trước. Gỡ cấu hình: chuyển cả dữ liệu máy sang
  LocalAppData/LTD/CncBridgeManager/archive, không xóa báo cáo cũ.
- Gỡ cấu hình Manager không tự xóa bản ghi web. Trên web có nút Xóa máy.

CHẠY NỀN
- Sau khi đăng nhập, cầu nối chạy nền, không cần giữ cửa sổ PowerShell.
- Nút X của Manager hoặc Chạy ở khay hệ thống chỉ ẩn giao diện.
- Nhấp biểu tượng LTD Bridge Manager ở khay hệ thống để mở lại.
- Thoát quản lý trong menu khay cũng không dừng các cầu nối đang chạy.
- Dừng cầu nối chỉ ngừng thu thập, không gửi lệnh dừng máy CNC.
- Laptop phải bật, không Sleep/Hibernate; giữ LAN tới CNC và Internet tới Firebase.
  Đây là tiến trình của tài khoản Windows hiện tại, không phải dịch vụ tự chạy
  sau khởi động/đăng xuất. Không tự lưu mật khẩu để đăng nhập lại.
- Tab Nhật ký cầu nối hiển thị nhật ký cục bộ; thanh dưới hiển thị trạng thái gửi.

CÁC MÀN HÌNH TRÊN WEB
POSITION: tọa độ, tải servo, đoạn đang thực thi, G modal và thông số trong một khung.
PROGRAM / WORK: toàn bộ file O đang chạy và EXT / G54–G59 cho máy phay XYZ được xác minh.
OFFSET: bảng đã cài đặt, phân trang 16 dòng; phân biệt Memory A/B/C.
ALARM: chỉ trạng thái/mã/mô tả lỗi và lịch sử alarm.
THỐNG KÊ: các biểu đồ trong ngày và báo cáo đã có.

NGUỒN DỮ LIỆU / GIỚI HẠN
- HD.T và NX.T đọc bằng cnc_rdhdnxt (vị trí trục chính/chờ thứ nhất của CNC).
  T modal chỉ lưu riêng; không dùng thay thế HD.T. Không phải cảm biến vật lý.
- Bảng gốc XYZ lấy các macro hệ thống có số lẻ do CNC trả về. EXT và G54–G59
  là giá trị cài đặt; không suy ra bằng cách lấy MACHINE trừ ABSOLUTE.
  G54.1/P, G52, xoay tọa độ, TCP và gốc của máy tiện chưa được diễn giải.
- Offset được đối chiếu kiểu khai báo với cnc_rdtofsinfo; lấy độ chia từ
  cnc_getfigure. Chỉ diễn giải phay XYZ 3 trục đã xác nhận; bảng tiện để trống.
  Bảng được đọc lại khoảng 30 giây/lần; thời điểm đọc hiện ngay tại bảng.
- Full file O đọc bằng cnc_upstart3/upload3/upend3 theo chiều CNC → PC.
  Không truyền chương trình từ PC sang CNC; không bật sửa hoặc bỏ bảo vệ.
  Đổi O thì đọc lại; cùng O làm mới khoảng 60 giây. Tối đa 2 MiB, ngân sách
  vòng đọc 2 giây (mỗi lời gọi vẫn chịu timeout thư viện). Chỉ hiển thị là đủ
  file khi kiểm tra đúng số O và ký tự kết thúc %. File lỗi/thiếu không giả làm đủ.
  CNC bận, chế độ hoặc tùy chọn không cho phép: để Chưa đọc và hiện chẩn đoán.
- Path 1 / trục chính mặc định; mẫu nhiều trục không tự bật thu thập đa kênh.
- Tất cả chức năng trong gói này chỉ đọc. Không đọc/ghi PMC, không ghi offset,
  sửa/chạy/xóa chương trình, đổi tham số hoặc điều khiển chuyển động CNC.
- Giữ report-outbox khi cập nhật. last-result.json là mẫu gần nhất.
- Đã kiểm tra bằng fixture và trình duyệt. Chưa thử GUI Windows/CNC thật;
  cần đối chiếu lần đầu HD.T/NX.T, đơn vị, gốc và bảng offset với màn hình máy.

SỬA HỘP ĐĂNG NHẬP — 20261109-login-first
Manager mở hộp đăng nhập nổi trên cùng trước khi nạp DLL hoặc đọc CNC.
Thanh trạng thái phân biệt chờ đăng nhập, xác thực và đọc dữ liệu.
Hủy hộp thoại thì chưa kết nối CNC. Nhật ký hiển thị cả lỗi khởi động.
Nếu cầu nối cũ kẹt: bấm Dừng cầu nối, chờ 15 giây; nút đổi thành Đóng tiến trình.
Xác nhận chỉ đóng tiến trình phần mềm cầu nối của máy đang chọn trên laptop,
không gửi lệnh tới CNC; dữ liệu chưa lưu trong bộ nhớ có thể mất.
Khi cập nhật phải Thoát quản lý từ menu khay hệ thống, không chỉ bấm X.
