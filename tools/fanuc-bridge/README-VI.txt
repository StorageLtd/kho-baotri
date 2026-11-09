LTD FANUC BRIDGE — CHỈ ĐỌC, KHÔNG TRUY CẬP PMC
Bridge build: 20261109-spindle-meters

KHUYÊN DÙNG GIAO DIỆN
Tải FANUC-Bridge-Manager.zip trên web, chép ba DLL vào lib rồi nhấp đúp
START-MANAGER.cmd. Có thêm/sửa/gỡ cấu hình máy, chọn mẫu, nhập tài khoản ngay trong Manager, chạy nền, khay hệ thống, trạng thái gửi dữ liệu và nhật ký theo máy.
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
6. Phải thấy Bridge build: 20261109-spindle-meters. Đăng nhập tài khoản CMMS
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
Gốc EXT/G54–G59 dùng cnc_rdzofs và độ chia cnc_getfigure, kiểm tra tên trục/đơn vị
CNC. H/D ưu tiên CNC modal. Không lấy chênh lệch vị trí để đoán gốc. Không diễn giải G54.1/P, G52, xoay tọa độ hoặc TCP.
Chọn đúng Phay XYZ 3 trục và Memory A/B/C, đánh dấu đã đối chiếu trên Manager
hoặc web. Cầu nối đối chiếu với loại thật từ cnc_rdtofsinfo và cnc_getfigure.
Loại/độ chia chưa xác minh hoặc máy tiện: không đoán giá trị offset.
Bảng offset làm mới khoảng 30 giây, hiển thị thời điểm đọc; tối đa 2000 dòng.
Path/trục chính mặc định; không tự thu thập mọi kênh khi chọn mẫu nhiều trục.

TOÀN BỘ FILE O
Chỉ đọc CNC → PC bằng cnc_upstart3/cnc_upload3/cnc_upend3. Không gọi download,
không ghi/xóa/chạy chương trình. Không bỏ bảo vệ hoặc đổi chế độ máy.
Đúng số O và kết thúc % mới được coi là đủ; tối đa 2 MiB và ngân sách vòng đọc
8 giây, mỗi lời gọi vẫn chịu timeout của DLL. Đổi O thì đọc lại; cùng O làm mới
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
