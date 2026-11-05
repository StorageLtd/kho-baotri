THỬ ĐỌC PMC RIÊNG - CHỈ X10.1 VÀ R423.6

Đây là công cụ thử do người dùng yêu cầu, tách khỏi cầu nối giám sát web.
Chỉ dùng pmc_rdpmcrng để đọc byte X10 (loại 3) và R423 (loại 5).
Không ghi/ép bit, không sửa ladder, tham số, chương trình hoặc xóa lỗi CNC.
Không quét dải địa chỉ, không chọn thêm vùng PMC, không gửi Firebase.
Các byte chứa 8 bit, chỉ diễn giải X10.1 và R423.6; địa chỉ và ý nghĩa do bạn cung cấp.
Không phải cam kết DLL bên thứ ba hoàn toàn an toàn: mã công cụ được giới hạn chỉ đọc.

CÁCH THỬ TRÊN WINDOWS 11
1. Ctrl+C dừng cầu nối cũ trước, để tránh chạy đồng thời nhiều kết nối khi thử.
   Trong lúc dừng cầu nối, web không nhận dữ liệu mới.
2. Giải nén gói PMC-ReadOnly-Test vào thư mục riêng.
3. Chép 3 DLL từ lib của cầu nối đang dùng sang lib của công cụ thử:
   Fwlib64.dll, fwlibe64.dll, fwlib30i64.dll. Không cần report-outbox hay config Firebase.
4. Mở PowerShell 64-bit MỚI tại thư mục chứa Test-PmcReadOnly.ps1:
   Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
   Unblock-File .\Test-PmcReadOnly.ps1
   Unblock-File .\PmcReadOnlyProbe.cs
   .\Test-PmcReadOnly.ps1 -CncIp 192.168.1.1 -Port 8193
5. Nếu đọc một lần thành công, có thể thử trong tối đa khoảng 30 giây:
   .\Test-PmcReadOnly.ps1 -CncIp 192.168.1.1 -Port 8193 -Samples 60 -IntervalMs 500
   Ctrl+C dừng sớm. Công cụ tự ngắt kết nối khi kết thúc/lỗi/dừng bình thường.
   Lệnh native đang chờ có thể cần thêm thời gian tới timeout.
6. Giá trị 1 là ON, 0 là OFF. X10/R423 hex là byte gốc.
   CSV pmc-readonly-*.csv chỉ lưu cục bộ; mỗi lần thử tạo file riêng.
   Không yêu cầu tài khoản CMMS. Gửi ảnh kết quả hoặc mã FOCAS nếu có lỗi.
7. Kết thúc thử rồi chạy lại cầu nối cũ để tiếp tục theo dõi web như trước.

GIỚI HẠN
- Hai byte được đọc lần lượt, không phải ảnh chụp đồng thời của PMC.
- Có thể bỏ sót xung M30 ngắn hơn nhịp đọc. Không dùng kết quả này để khẳng định
  bắt đủ từng lần Cycle Start/M30 hoặc thống kê sản phẩm chính xác.
- Khi đọc thất bại, công cụ dừng, không tự đổi tham số máy hay giả giá trị 0.
- Không cần đổi cấu hình CNC, mở khóa ghi hoặc ép bit để chạy thử công cụ này.
