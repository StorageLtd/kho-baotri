NEWAY 1260S - FOCAS STATUS ONLY (KHÔNG ĐỌC PMC)
Bridge build: 20261029-status-only

BẢN NÀY LÀM GÌ?
- Đọc trạng thái CNC, tốc độ, số chương trình, PART COUNT và timer qua FOCAS.
- Không chứa hàm pmc_rdpmcrng, không đọc X/R, không có luồng đọc PMC nền.
- Không có lệnh sửa ladder, ép tín hiệu, ghi tham số hoặc điều khiển CNC.
- Vẫn là kết nối đọc bộ điều khiển CNC qua FOCAS, không phải hệ thống độc lập với CNC.
- DLL do bạn cung cấp chưa được kiểm toán toàn bộ; giới hạn trên nói về mã cầu nối này.

CẬP NHẬT QUAN TRỌNG
1. Ctrl+C rồi ĐÓNG HẲN PowerShell cũ để kết thúc mọi luồng của bản trước.
   Chỉ thay file hoặc đổi config không dừng được chương trình cũ còn chạy.
2. Giải nén bản mới vào thư mục riêng. Chép ba DLL của bạn vào lib:
   Fwlib64.dll, fwlibe64.dll, fwlib30i64.dll. Không chép vào System32.
3. Nếu có report-outbox từ bản cũ, giữ/copy nó sang thư mục mới để không mất số liệu chờ.
4. Kiểm tra bridge-config.json: CNC 192.168.1.1:8193; laptop Ethernet 192.168.1.10,
   cùng subnet 255.255.255.0. IP laptop không cần khai báo trong cầu nối.
5. Mở PowerShell 64-bit MỚI tại thư mục có Start-FanucBridge.ps1, không mở trong lib.
   Theo quyền chạy script đã được cho phép trên laptop:
   Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
   Unblock-File -LiteralPath .\Start-FanucBridge.ps1
   Unblock-File -LiteralPath .\FanucReader.cs
   Unblock-File -LiteralPath .\ReportCollector.ps1
   .\Start-FanucBridge.ps1
6. Nhập email/mật khẩu CMMS tại lời nhắc, không ghi mật khẩu vào lệnh/config.
   Token và mật khẩu không được lưu trong file. Cần tài khoản email đã xác minh,
   vai trò technician, manager hoặc admin.
7. Phải thấy Bridge build: 20261029-status-only. Bản mới từ chối sử dụng lớp C# cũ.
   Cấu hình cũ có pmcCycleSignals=true cũng không bật được PMC trong mã mới.
8. Giữ LAN nối CNC, Wi-Fi có Internet và cửa sổ cầu nối mở. Không chạy hai bản cùng máy.

QUY TẮC CHU KỲ
- MEM/REMOTE chuyển từ STOP/RESET sang START: bắt đầu hàng quan sát.
- Chuyển về STOP hoặc RESET: kết thúc hàng, không khẳng định nguyên nhân hay lệnh M30.
- HOLD rồi START: tiếp tục cùng một hàng, cộng thời gian HOLD.
- START khi đã chạy không tự tạo thêm sản phẩm. Nếu bắt đầu đọc giữa chu kỳ,
  mốc đầu để trống và hàng đánh dấu thiếu dữ liệu.
- Thời điểm là lúc cầu nối phát hiện trạng thái, sai số theo chu kỳ đọc (mặc định 5 giây).
  Chu kỳ quá ngắn có thể bị bỏ lỡ; không coi là ghi chính xác thời điểm nút bấm.
- Mất dữ liệu hoặc đổi chương trình giữa chu kỳ: đánh dấu chưa đầy đủ, không đoán kết thúc.
- Alarm sau khi đã STOP thuộc tổng hợp trạng thái ngày, không ép vào một chu kỳ đã đóng.
- PART COUNT tăng là chênh lệch bộ đếm quan sát được, không mặc định là sản phẩm đạt.
- RUN TIME/CYCLE TIME đọc từ CNC; nếu không hỗ trợ sẽ để trống/báo lỗi, cần đối chiếu màn hình.

WEB VÀ BÁO CÁO
- Ctrl+Shift+R trên web sau cập nhật. Đèn web là quy ước từ FOCAS:
  xanh RUN, vàng HOLD, đỏ alarm, xám STOP/RESET/mất tín hiệu; không đọc bóng đèn tháp thật.
- Excel chỉ Tổng quan và Theo ngày. Theo ngày có hàng chu kỳ, giờ RUN/Alarm/HOLD,
  giờ bắt đầu/dừng quan sát và PART COUNT. Dữ liệu cũ tổng hợp ngày không tách ngược thành chu kỳ.
- FIREBASE UPDATED: tín hiệu hiện tại gửi thành công.
- REPORTS UPDATED: tổng hợp và chu kỳ đã được lưu. Dùng lại nhánh cncReports Rules đã thêm.
- Nếu chưa có quyền báo cáo, thêm nhánh trong FIREBASE-REPORTS-RULES.json vào Rules
  hiện có và Publish, không thay toàn bộ Rules hoặc mở quyền công khai.
- report-outbox giữ dữ liệu vận hành chờ gửi, không chứa token/mật khẩu. Gửi lại cùng phiên
  không cộng đôi. Giữ thư mục này khi cập nhật. Chưa đăng nhập thì chưa thu thập báo cáo mới.
- last-result.json là mẫu CNC gần nhất, không chứa thông tin đăng nhập.

THỬ KHÔNG GỬI FIREBASE
   .\Start-FanucBridge.ps1 -LocalOnly -Once
Chỉ đọc một lần, không đăng nhập hoặc gửi dữ liệu cloud.

KIỂM CHỨNG
Đã kiểm tra danh sách API native, không có import PMC, luồng nền hoặc lệnh ghi CNC;
đã biên dịch C#, thử các luồng với dữ liệu giả và giao diện Chromium/Excel hai sheet.
Cần chạy thực tế để xác nhận dữ liệu timer và quy tắc quan sát phù hợp với máy của bạn.
