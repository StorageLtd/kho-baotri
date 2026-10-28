CẦU NỐI NEWAY 1260S - WINDOWS 11 X64

Máy: Neway 1260S | ID cố định: neway-1260s
FANUC 0i-MF Plus | IP: 169.254.85.99 | TCP: 8193

BẢN NÀY LÀM GÌ?
- Chỉ đọc thông tin và trạng thái CNC bằng bốn API của bản thử đã chạy thành công.
- Đọc lại sau mỗi chu kỳ khoảng 5 giây (cộng thời gian đọc/gửi); không điều khiển CNC.
- Gửi dữ liệu tới Firebase CMMS sau khi bạn đăng nhập tại laptop.
- Tạo/cập nhật duy nhất bản ghi cncs/neway-1260s; không thay danh sách máy hay dữ liệu kho.
- Web báo mất kết nối khi tín hiệu quá 30 giây. Không sử dụng để quyết định an toàn máy.
- Chưa đọc tốc độ trục chính, feedrate, chương trình, nội dung alarm chi tiết.
  Các mục chưa đo sẽ để trống, không tạo dữ liệu giả.

CHUẨN BỊ
1. Giải nén ZIP vào thư mục riêng, không chạy bên trong ZIP.
2. Chép ba DLL từ bộ 64-bit của bạn vào thư mục lib:
   Fwlib64.dll, fwlibe64.dll, fwlib30i64.dll.
   Không chép DLL vào Windows/System32. ZIP không kèm thư viện FANUC.
3. Laptop giữ kết nối Ethernet với CNC và Wi-Fi có Internet để truy cập Firebase.
4. Dùng tài khoản CMMS có email đã xác minh, hồ sơ users/<uid> với vai trò
   technician, manager hoặc admin. Có thể dùng tài khoản hiện đang đăng nhập web.
   Nên dùng tài khoản riêng cho cầu nối khi vận hành lâu dài.
   Không gửi mật khẩu cho người khác, không lưu mật khẩu trong config.
5. IP 169.254.x.x là cấu hình thử; nếu IP Ethernet tự thay đổi, phải kiểm tra lại.

CÁCH CHẠY
1. Trong File Explorer, mở thư mục có Start-FanucBridge.ps1, bấm thanh địa chỉ,
   nhập powershell rồi Enter. Dùng Windows PowerShell 64-bit, không cần Run as administrator.
2. Nếu quy định IT cho phép chạy mã từ repository này, như với bản thử trước:
   Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
   Unblock-File -LiteralPath .\Start-FanucBridge.ps1
   Unblock-File -LiteralPath .\FanucReader.cs
   Chỉ áp dụng cho các file đã kiểm tra nguồn; không dùng Bypass/Unrestricted.
3. Chạy:
   .\Start-FanucBridge.ps1
4. Sau khi đọc CNC thành công, nhập email CMMS rồi mật khẩu trong ô nhập ẩn.
   Không nhập mật khẩu trong câu lệnh. Chương trình không lưu mật khẩu/token vào file.
5. Dòng FIREBASE UPDATED xác nhận Firebase nhận bản cập nhật.
6. Mở web bảo trì, tải lại bằng Ctrl+Shift+R, vào Giám sát CNC.
   Máy Neway 1260S sẽ xuất hiện sau khi đăng nhập cầu nối và gửi thành công.
   Nếu máy chưa xuất hiện, gửi dòng lỗi, KHÔNG gửi mật khẩu/token.
7. Giữ cửa sổ PowerShell mở. Ctrl+C dừng cầu nối. Đóng cửa sổ, laptop ngủ,
   mất Internet hoặc mất LAN sẽ khiến web chuyển mất kết nối sau thời gian chờ.

KIỂM TRA KHÔNG GỬI FIREBASE
   .\Start-FanucBridge.ps1 -LocalOnly -Once
Chỉ đọc một lần và lưu last-result.json, không yêu cầu tài khoản, không gửi dữ liệu.
   .\Start-FanucBridge.ps1 -Once
Đăng nhập, gửi một mẫu rồi dừng; bản ghi sẽ được đánh dấu ngắt kết nối khi kết thúc.

CẤU HÌNH
bridge-config.json chỉ chứa cấu hình không bí mật và Firebase Web API key công khai.
Không thay databaseUrl sang địa chỉ khác. Không thêm mật khẩu, service account
hoặc private key vào file này. Máy khác cần ID riêng, không dùng neway-1260s.
Không chạy hai cầu nối đồng thời với cùng machineId.
Dừng cầu nối trước khi xóa máy trên web; nếu không nó có thể tạo lại bản ghi.

LỖI THƯỜNG GẶP
- FOCAS -16: kiểm tra LAN, đúng giao diện EMBEDDED/PCMCIA, IP/cổng và phần mềm khác.
- HTTP 400 khi đăng nhập: kiểm tra thông tin tài khoản; không đăng nhập lặp liên tục.
- Email chưa xác minh hoặc vai trò viewer: xử lý tài khoản trước, không nới Firebase Rules.
- HTTP 401/403 hoặc Permission denied: cần quản trị viên kiểm tra Rules đã triển khai
  cho users/<uid> và cncs, không công khai quyền đọc/ghi database.
- Gửi thất bại: cầu nối báo lỗi rồi thử lại chu kỳ sau; tín hiệu cũ trên web sẽ hết hạn.
- Khi script bị chính sách công ty chặn, liên hệ IT; không vô hiệu hóa bảo vệ toàn máy.

GIỚI HẠN KIỂM CHỨNG
Mã đã được kiểm tra bằng PowerShell 7, biên dịch C#, thử luồng với CNC/Firebase giả lập
và thử giao diện Chromium. Cấu trúc dữ liệu theo header do bạn cung cấp. Bản đọc FOCAS
một lần trước đây đã chạy thành công trên CNC của bạn; bản cầu nối mới vẫn cần bạn
chạy trên Windows 11 để xác nhận việc gửi Firebase thật.
last-result.json chỉ lưu bản đọc CNC gần nhất, không chứa mật khẩu/token.
DLL được bạn cung cấp, chưa xác minh nguồn/chữ ký hoặc bảo đảm phiên bản từ nhà sản xuất.
