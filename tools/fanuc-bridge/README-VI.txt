NEWAY 1260S - FOCAS STATUS ONLY (KHÔNG ĐỌC PMC)
Bridge build: 20261107-tool-context

BẢN NÀY LÀM GÌ?
- Đọc trạng thái CNC, tốc độ, số chương trình, PART COUNT và timer qua FOCAS.
- Đọc tối đa 32 Alarm đang hoạt động bằng cnc_rdalmmsg2 (chỉ đọc).
  Hiện số lỗi, loại lỗi, trục và nội dung CNC trả về; không tự suy diễn tiền tố mã.
  Tự lưu Alarm mới vào cncAlarms ngay trong lần đọc phát hiện lỗi; không cần mở web.
  Alarm giữ nguyên không tạo dòng trùng; hết rồi tái xuất hiện tạo sự cố mới.
  Lưu hàng chờ và trạng thái vào report-outbox/alarms-*.json, tự gửi lại khi có mạng.
  Giữ nguyên report-outbox khi nâng cấp để tránh mất dữ liệu hoặc lặp sự cố.
  Hết lỗi chỉ ghi khi đọc thành công không còn mã đó; mất kết nối không đóng sự cố.
  Alarm ngắn giữa hai lần đọc có thể bị bỏ lỡ. Web tải lịch sử mỗi 5 giây.
  Nội dung theo bảng mã Windows hiện tại; cần đối chiếu màn hình nếu chữ bị sai.
  CNC không hỗ trợ sẽ báo readErrors.alarms, không làm dừng các thông số khác.
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
7. Phải thấy Bridge build: 20261107-tool-context. Bản mới từ chối sử dụng lớp C# cũ.
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
- PART COUNT đầu/cuối là giá trị đọc trực tiếp từ bộ đếm 6711 trên CNC.
  Đổi chương trình hoặc khởi động lại cầu nối không đặt lại số đếm.
  Nếu CNC tự reset bộ đếm thì hiển thị đúng số CNC trả về, không cộng bù.
  Báo cáo cũ chỉ có số tăng không thể khôi phục mốc tuyệt đối nếu chưa từng lưu.
- RUN TIME/CYCLE TIME đọc từ CNC; nếu không hỗ trợ sẽ để trống/báo lỗi, cần đối chiếu màn hình.

WEB VÀ BÁO CÁO
- Ctrl+Shift+R trên web sau cập nhật. Đèn web là quy ước từ FOCAS:
  xanh RUN, vàng HOLD, đỏ alarm, xám STOP/RESET/mất tín hiệu; không đọc bóng đèn tháp thật.
- Excel chỉ Tổng quan và Theo ngày. Theo ngày có hàng chu kỳ, giờ RUN/Alarm/HOLD,
  giờ bắt đầu/dừng quan sát và PART COUNT. Dữ liệu cũ tổng hợp ngày không tách ngược thành chu kỳ.
- FIREBASE UPDATED: tín hiệu hiện tại gửi thành công.
- ALARM HISTORY SAVED: một bản ghi Alarm đã gửi Firebase thành công.
  Nếu báo HTTP 401/403, kiểm tra quyền cncAlarms trong Rules hiện có, không mở quyền công khai.
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

BỔ SUNG 20261107-tool-context
- Hiển thị T modal qua cnc_modal(108,0); số T này có thể là dao đã chọn trước.
  Không khẳng định dao đang trên trục chính và không đọc PMC để suy diễn.
- Lưu chương trình và ngữ cảnh dao trong sự cố, khi bắt đầu lượt chạy,
  và khi T / chương trình / gốc / offset thay đổi trong lượt chạy.
- Dữ liệu cũ không có ngữ cảnh được để trống, không lấy giá trị hiện tại bù vào lịch sử.
- Mặc định machiningContextProfile là unverified: chưa đọc/diễn giải XYZ và H/D.
  Chỉ sau khi xác minh máy phay FANUC 3 trục, Memory C, macro và độ chia offset
  mới dùng verified-fanuc-m-3axis-memory-c trong bridge-config.json.
  Không tự bật cấu hình này cho máy khác hoặc bảng offset khác.
- Hồ sơ M-C dùng #4006 (đơn vị), #4014 (G54-G59), #4111 (H), #4107 (D),
  macro #5221…#5323 cho bảng XYZ, cnc_rdtofsinfo / cnc_rdtofs / cnc_getfigure.
  G54.1/P, G52, xoay hệ tọa độ, TCP và bảng offset khác chưa được diễn giải.
  Giá trị là bảng gốc làm việc, không phải vị trí trục hoặc tổng biến đổi tọa độ.
- Đối chiếu số T, gốc và offset trên màn hình CNC trước khi dùng số liệu cho báo cáo.
- Bản này vẫn chỉ đọc. Không có hàm truyền, ghi đè hoặc chạy chương trình.
  Bản thử truyền chương trình nằm trong gói FANUC-Program-Transfer-Trial riêng.
- Trên web: Sửa IP → Loại máy → Bảng offset. Nếu chưa rõ, chọn Chưa xác định.
  Chỉ đánh dấu đã đối chiếu khi đã xác nhận trực tiếp bảng và đơn vị trên CNC.
  Cầu nối mới đọc lại lựa chọn mỗi 60 giây. Chỉ hồ sơ Phay 3 trục / Memory C
  đã đối chiếu mới được diễn giải offset; các loại khác hiện chỉ lưu phân loại.
- Ưu tiên cnc_toolnum(0,0) nếu CNC có tool-life management, sau đó mới dùng
  T modal. Cả hai đều là dữ liệu CNC trả về, không phải đọc cảm biến dao vật lý.
- Khi dùng web, lựa chọn trong Cài đặt máy là nguồn cấu hình đọc offset;
  chỉnh tay machiningContextProfile trong JSON không thay thế xác nhận trên web.
  Chỉ chế độ -LocalOnly mới dùng trực tiếp hồ sơ trong file JSON.
