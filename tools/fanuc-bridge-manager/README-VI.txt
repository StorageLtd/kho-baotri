LTD CNC BRIDGE MANAGER
Build 20261109-spindle-meters · Windows 10/11 64-bit

CẬP NHẬT
1. Trong bản Manager cũ: dừng từng cầu nối, chờ tiến trình dừng.
2. Nhấp phải biểu tượng Manager ở khay hệ thống → Thoát quản lý.
3. Giải nén bản mới ra thư mục mới. Chép Fwlib64.dll, fwlibe64.dll,
   fwlib30i64.dll của bạn vào lib. Không chạy đồng thời hai cầu nối cùng máy.
4. Nhấp đúp START-MANAGER.cmd. Máy đã lưu trong LocalAppData vẫn còn.
5. Chọn máy → Chạy cầu nối → mở tab Đăng nhập CMMS, nhập email/mật khẩu và bấm Đăng nhập và kết nối.
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
- Bảng gốc XYZ dùng cnc_rdzofs theo từng trục, cnc_getfigure cho độ chia và
  đơn vị CNC đã xác minh. EXT / G54–G59 là giá trị cài đặt, không suy ra
  bằng MACHINE trừ ABSOLUTE. H/D ưu tiên CNC modal, không phụ thuộc macro.
  G54.1/P, G52, xoay tọa độ, TCP và gốc của máy tiện chưa được diễn giải.
- Offset được đối chiếu kiểu khai báo với cnc_rdtofsinfo; lấy độ chia từ
  cnc_getfigure. Chỉ diễn giải phay XYZ 3 trục đã xác nhận; bảng tiện để trống.
  Bảng được đọc lại khoảng 30 giây/lần; thời điểm đọc hiện ngay tại bảng.
- Full file O đọc bằng cnc_upstart3/upload3/upend3 theo chiều CNC → PC.
  Không truyền chương trình từ PC sang CNC; không bật sửa hoặc bỏ bảo vệ.
  Đổi O thì đọc lại; cùng O làm mới khoảng 60 giây. Tối đa 2 MiB, ngân sách
  vòng đọc 8 giây (mỗi lời gọi vẫn chịu timeout thư viện). Chỉ hiển thị là đủ
  file khi kiểm tra đúng số O và ký tự kết thúc %. File lỗi/thiếu không giả làm đủ.
  CNC bận, chế độ hoặc tùy chọn không cho phép: để Chưa đọc và hiện chẩn đoán.
- Path 1 / trục chính mặc định; mẫu nhiều trục không tự bật thu thập đa kênh.
- Tất cả chức năng trong gói này chỉ đọc. Không đọc/ghi PMC, không ghi offset,
  sửa/chạy/xóa chương trình, đổi tham số hoặc điều khiển chuyển động CNC.
- Giữ report-outbox khi cập nhật. last-result.json là mẫu gần nhất.
- Đã kiểm tra bằng fixture và trình duyệt. Chưa thử GUI Windows/CNC thật;
  cần đối chiếu lần đầu HD.T/NX.T, đơn vị, gốc và bảng offset với màn hình máy.

ĐĂNG NHẬP TRỰC TIẾP TRONG MANAGER — 20261109-spindle-meters
- Có sẵn tab Đăng nhập CMMS, không chờ hộp thoại từ tiến trình nền.
- Chọn máy → Chạy cầu nối → nhập email và mật khẩu → Đăng nhập và kết nối.
- Manager chuyển tài khoản một lần qua stdin riêng cho tiến trình cầu nối.
  Gói dùng base64 để giữ đúng Unicode, không coi base64 là mã hóa.
  Không ghi mật khẩu/token vào file, cấu hình, argv hoặc biến môi trường.
- Cầu nối xác thực tài khoản trước khi đọc CNC; lỗi nằm ở Nhật ký cầu nối.
- Khi cập nhật: nút X chỉ ẩn Manager. Chọn Thoát quản lý từ menu khay hệ thống.
- Nếu tiến trình cũ kẹt: Dừng cầu nối, chờ 15 giây, bấm Đóng tiến trình và xác nhận.
  Chỉ đóng đúng phần mềm cầu nối trên laptop, không gửi lệnh tới CNC.
- Đã kiểm tra luồng tài khoản và tiến trình con thực trên môi trường thử Linux.
  Chưa chạy thử WinForms trên Windows hoặc kết nối CNC thật của người dùng.

SỬA NHẬN DẠNG VÀ ĐỌC DỮ LIỆU — 20261109-spindle-meters
- Mã ASCII cố định có đệm: " M", "03", " 3" được chuẩn hóa đúng.
  Vẫn kiểm tra máy phay 3 trục, tên trục XYZ, bảng thật và xác nhận của người dùng.
- Đọc gốc bằng cnc_rdzofs; không cần đọc biến macro khi đã có đơn vị/vị trí CNC.
- Khi EW_BUFFER, chờ 10 ms để CNC có thời gian cung cấp dữ liệu.
  Ngân sách vòng đọc file 8 giây / 2 MiB; không ghi hay đổi con trỏ chương trình.
- Nếu chưa xong, giữ lỗi đầu tiên và số byte/lượt chờ khi thử lại sau 30 giây.
- Tab PROGRAM / WORK dùng đoạn CNC đang trả về nếu chưa có đủ file O;
  có nhãn phân biệt đoạn chương trình với file đầy đủ.
- Dừng cầu nối, thoát Manager qua menu khay trước khi nâng cấp.
  Bản mới từ chối lớp C# cũ nếu chưa khởi động lại tiến trình.

SỬA ĐỘ CHIA BẢNG — 20261109-spindle-meters
- cnc_getfigure có thể trả dec_fig_in khác dec_fig_out; đây không phải lỗi.
- Các giá trị thô của cnc_rdzofs / cnc_rdtofs / cnc_rdtofsr được chia theo
  dec_fig_in của đúng loại dữ liệu, không lấy dec_fig_out để chia bảng.
- Vẫn kiểm tra phạm vi độ chia, tên trục, đơn vị và loại bảng đã xác nhận.
- Có kiểm tra giả lập đầu vào 4 / đầu ra 6 với giá trị âm, khác 0; input
  ngoài phạm vi vẫn bị từ chối. Cần đối chiếu giá trị hiện tại trên CNC thật.

ĐỒNG HỒ TRỤC CHÍNH — 20261109-spindle-meters
- POSITION có Spindle Load Meter và Spindle Speed Meter cạnh Servo Load.
- Tải trục chính thứ nhất đọc bằng cnc_rdspmeter(type=0), xác minh đơn vị %.
  Thang hình 0–200%; số đo thực vẫn hiển thị nếu vượt 200%. Chưa đọc được là —.
- Tốc độ hiển thị RPM thực đã đọc bằng cnc_rdspeed. Không dùng tốc độ motor
  trong ODBSPLOAD thay thế tốc độ trục chính; không tự đặt giới hạn RPM máy.
- Dữ liệu quá hạn được ẩn. Chỉ đọc FOCAS, không có truy cập PMC hay ghi CNC.
- Cần cập nhật Bridge để có tải trục chính; web tải lại bằng Ctrl+F5.
