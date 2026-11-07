GIÁM SÁT CNC CỤC BỘ — KHÔNG GỬI LÊN WEB CÔNG TY
Build: 20261107-local-only | Windows 10/11 64-bit

CÁCH CHẠY
1. Giải nén toàn bộ FANUC-Local-Monitor.zip vào Desktop hoặc Documents.
2. Chép 3 DLL 64-bit bạn đang dùng thành công vào thư mục lib:
   Fwlib64.dll, fwlibe64.dll, fwlib30i64.dll
   Không chép cấu hình hoặc script Bridge của công ty sang đây.
3. Kết nối laptop với CNC bằng LAN, hoặc cùng router. Kiểm tra ping IP CNC.
4. Nhấp đúp START-LOCAL.cmd. Nhập IP CNC rồi nhấn Enter.
   Nếu IP trong ngoặc đã đúng, chỉ cần Enter.
5. Trình duyệt tự mở http://localhost:8080/
   Nếu không tự mở, chép địa chỉ sau chữ OPEN: vào trình duyệt.
6. Giữ cửa sổ chương trình hoạt động. Nhấn Ctrl+C để dừng.

Không cần tài khoản CMMS, Firebase, Internet, tên miền hay hosting.
Thông thường không cần quyền admin. Nếu máy tính do IT quản lý chặn
PowerShell hoặc file .cmd, cần IT cho phép chương trình chạy.
File khởi động chỉ bỏ đánh dấu tải xuống của các file trong gói này,
dùng RemoteSigned trong tiến trình hiện tại, không đổi chính sách vĩnh viễn.

CẤU HÌNH local-config.json
- machineName: tên máy hiển thị.
- cncIp: IP CNC; cũng có thể nhập khi khởi động.
- cncPort: cổng FOCAS, thường là 8193.
- webPort: cổng trang cục bộ, mặc định 8080; nếu bị chiếm, đổi sang 8081.
- pollSeconds: khoảng nghỉ giữa các lần đọc, mặc định 3 giây.
  Mỗi lần đọc có thể mất thêm thời gian; timeout kết nối FOCAS là 10 giây.

DỮ LIỆU
- last-result.json: kết quả đọc gần nhất, chỉ lưu trên laptop.
- Nút Lưu dữ liệu JSON: tải kết quả hiện tại về laptop.
- RUN TIME / CYCLE TIME là bộ thời gian CNC trả về, không phải tổng riêng của ngày.
- Bản thử này chưa có lịch sử dài hạn, báo cáo ngày hay tự chạy cùng Windows.
- Chương trình khởi động bằng file .cmd, nhưng vẫn chạy PowerShell ở bên trong.

PHẠM VI
- Chỉ đọc thông tin CNC, trạng thái, tốc độ, chương trình, PART COUNT,
  timer và thông điệp alarm nếu CNC hỗ trợ.
- Không truy cập PMC; không ghi tham số, ladder, chương trình hoặc điều khiển CNC.
- Trang chỉ phục vụ trên 127.0.0.1 của laptop, không mở cho thiết bị khác.
- Không gọi Firebase, không gửi dữ liệu CNC về web công ty.
- DLL do bạn cung cấp, không đóng kèm trong gói tải này.

NẾU CÓ LỖI
- Trang không mở: xem cửa sổ START-LOCAL.cmd báo lỗi gì.
- Missing lib: chép đúng 3 DLL vào lib của gói này.
- Cannot open local port: đóng bản cục bộ đang chạy, hoặc đổi webPort.
- FOCAS -16: kiểm tra IP, ping và Test-NetConnection <IP> -Port 8193.
- Có trang nhưng không có dữ liệu: gửi dòng READ FAILED để kiểm tra.

Đã kiểm tra máy chủ cục bộ và giao diện bằng dữ liệu mô phỏng trên Linux.
Chưa xác nhận chạy với CNC thật và Windows của bạn; cần thử kết nối tại máy.
