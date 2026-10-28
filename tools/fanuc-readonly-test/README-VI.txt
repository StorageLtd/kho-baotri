FANUC - THỬ ĐỌC THÔNG TIN VÀ TRẠNG THÁI (WINDOWS 11 X64)

Đây là bản chẩn đoán đầu tiên của cầu nối, CHƯA gửi lên Firebase/web.
Không có lệnh ghi tham số, truyền chương trình, khởi động hoặc điều khiển CNC.
Chỉ dùng cnc_allclibhndl3, cnc_sysinfo, cnc_statinfo và cnc_freelibhndl.
Kết nối một lần, đọc hai bản ghi, ngắt kết nối và lưu last-result.json cục bộ.

1. Giải nén toàn bộ ZIP, ví dụ vào C:\CNC-Test\FANUC-ReadOnly-Test.
   Không chạy trực tiếp bên trong ZIP. Không chép DLL vào System32.
2. lib phải có ba file từ bộ thư viện bạn đã cung cấp:
   Fwlib64.dll, fwlibe64.dll, fwlib30i64.dll. ZIP KHÔNG kèm DLL.
   Chép ba DLL cùng phiên bản từ bộ FOCAS của bạn vào thư mục lib.
   DLL của bạn chưa được xác minh nguồn/chữ ký hay tương thích
   Windows 11/0i-MF Plus. Chương trình chưa được chạy trên Windows hoặc CNC thật.
   Không bỏ qua cảnh báo bảo mật; nếu bị chặn, ghi lại thông báo để kiểm tra.
3. Laptop phải kết nối LAN với CNC. Chỉ thử đọc khi người phụ trách máy cho phép.
   Mở Windows PowerShell 64-bit (không phải x86), không cần Run as administrator.
4. Đi vào thư mục đã giải nén. Ví dụ:
   cd C:\CNC-Test\FANUC-ReadOnly-Test
5. Kiểm tra TCP trước:
   Test-NetConnection 192.168.1.1 -Port 8193
   Nếu TcpTestSucceeded không phải True, xử lý kết nối mạng trước.
6. Chạy:
   .\Test-Fanuc.ps1
   IP và cổng mặc định: 192.168.1.1 và 8193, theo ảnh CNC bạn cung cấp.
   Nếu IP thực tế khác, dùng:
   .\Test-Fanuc.ps1 -CncIp 192.168.1.20 -Port 8193
7. Nếu PowerShell báo script bị chặn, không thay đổi ExecutionPolicy toàn máy.
   Gửi nguyên văn thông báo để được hướng dẫn phương án phù hợp.
8. Thành công: hiện SUCCESS, dữ liệu JSON và last-result.json trong thư mục này.
   Lỗi: hiện TEST FAILED kèm mã FOCAS hoặc lỗi Windows; gửi ảnh thông báo.
   Không cần gửi mật khẩu hay thông tin tài khoản Firebase.

CÁCH HIỂU KẾT QUẢ
- SUCCESS xác nhận hai API đọc đã thành công tại thời điểm thử.
- rawStatus chứa số gốc từ CNC (run, aut, alarm, emergency...), chưa phải diễn
  giải đầy đủ trạng thái hoặc nội dung alarm. Không dùng để quyết định an toàn máy.
- Đây chưa phải dịch vụ chạy nền, không tự khởi động và không đọc liên tục.
- Không sửa địa chỉ/cổng trên CNC, không bật PWE, không mở cổng CNC ra Internet.

CHUẨN BỊ CHO BƯỚC SAU
Khi thử thật thành công, mới thêm đọc dữ liệu cần thiết, xử lý mất kết nối,
xác thực Firebase và sửa web để phân biệt dữ liệu thật/mô phỏng.
Hiện không thay đổi website hay cơ sở dữ liệu của bạn.

Gói này chỉ gồm mã chương trình và hướng dẫn, không phân phối thư viện FANUC.
