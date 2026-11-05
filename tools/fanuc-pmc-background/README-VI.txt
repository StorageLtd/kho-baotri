LTD PMC BACKGROUND TRIAL — BẢN THỬ ĐỌC PMC CỤC BỘ CHẠY NỀN

PHẠM VI ĐÃ THỐNG NHẤT
- Chỉ đọc X10.1 (bạn cung cấp là Cycle Start), R423.6 (bạn cung cấp là M30).
- Không ghi/ép bit, không sửa ladder, tham số hay chương trình CNC/PMC.
- Không sửa website, không gửi Firebase, không hỏi/lưu mật khẩu web.
- Bản thử này chưa thay cầu nối giám sát web. Dùng thử cục bộ trước.
- C# gọi đúng 3 API FOCAS: kết nối, pmc_rdpmcrng chỉ X10/R423, ngắt kết nối.
- DLL bên thứ ba bạn cung cấp chưa được kiểm toán toàn bộ; không cam kết tuyệt đối về DLL.

CÀI MỘT LẦN TRÊN WINDOWS 11 64-BIT
1. Giải nén gói vào một thư mục riêng.
2. Chép 3 DLL đang dùng: Fwlib64.dll, fwlibe64.dll, fwlib30i64.dll vào lib.
3. Dừng các bản cầu nối/thử PMC cũ bằng Ctrl+C trước khi thử bản mới.
4. Bấm đúp CAI-DAT.cmd. Không cần gõ lệnh PowerShell.
5. Nhập mã máy (chữ thường, số, dấu gạch ngang), tên, đúng IP/cổng CNC.
   Mặc định 192.168.1.1:8193. Nếu máy khác là 192.168.1.2 thì sửa IP trong cửa sổ cài.
   Hai tín hiệu phải được đối chiếu đúng với từng máy; không tự suy ra từ máy khác.
6. Nhịp đọc 500 ms mặc định; cho phép 500-5000 ms. Không có chế độ quét PMC khác.
7. Chọn tự chạy khi đăng nhập Windows rồi bấm Cài đặt và chạy thử.
   Không yêu cầu CNC đang nối mạng để cài; chương trình tự chờ khi CNC chưa truy cập được.

SAU KHI CÀI
- Mã chương trình/DLL/config được chép vào %LOCALAPPDATA%\LTD-PMC-Trial\<mã máy>.
- Tạo lối tắt Desktop: Bat, Dung, Trang-thai, Cau-hinh, Go-cai-dat.
- Trang-thai mở cửa sổ xem X10.1 / R423.6, 1=ON và 0=OFF; không cần mở cửa sổ lệnh.
- Mỗi máy một mã riêng. Không khởi chạy nhiều bản đọc cùng IP/cổng để thử.
- Dung đặt cờ dừng. Bản thử giữ trạng thái dừng kể cả đăng nhập lại; Bat để bật lại.
- Go-cai-dat bỏ tự khởi động và lối tắt; giữ thư mục nhật ký để bạn xem/xóa sau.
- Tự khởi động áp dụng SAU KHI ĐĂNG NHẬP Windows, không phải Windows Service chạy trước đăng nhập.
- Dùng PowerShell của Windows ở bên trong nhưng chạy ẩn; người dùng không cần nhập lệnh.
- Cài cho tài khoản Windows hiện tại, không đổi Execution Policy toàn máy và không vượt chính sách IT.
  Nếu IT chặn script/Startup thì cần IT cho phép; không dùng Bypass/Unrestricted.

KẾT NỐI VÀ NHẬT KÝ
- Máy tính phải bật, không ngủ; chỉ tắt màn hình không làm dừng đọc.
- CNC mất mạng/tắt: không giả tín hiệu 0. Màn hình trạng thái hiển thị chưa có dữ liệu mới.
- Tự thử lại sau 30 giây, tăng dần tối đa 5 phút nếu liên tục chưa kết nối được.
- Nhật ký logs\pmc-current.csv chứa hai byte/bit cùng thời gian đọc.
  Tệp khoảng 2 MB sẽ chuyển thành pmc-previous.csv; giữ hai tệp gần nhất để không đầy đĩa.
  Đây là nhật ký thử gần đây, không phải lưu trữ thống kê lâu dài.
- File pmc-status.json chứa lần đọc hiện tại. Cấu hình/nhật ký không chứa tài khoản web.
- Thư mục cài được giới hạn cho tài khoản Windows hiện tại và SYSTEM.
- Hai byte đọc nối tiếp, không phải ảnh chụp đồng thời.
- Xung ngắn, nhất là M30, vẫn có thể bị bỏ sót; xRiseObserved/rRiseObserved chỉ là cạnh đã nhìn thấy.
  KHÔNG coi đó là đếm đầy đủ số lần Cycle Start/M30 hay sản lượng chính xác.
- Khi dừng, chờ lệnh đang đọc kết thúc. Nếu tiến trình không phản hồi lâu, runner chỉ kết thúc
  tiến trình đọc do chính nó tạo ra; không dừng chương trình CNC hoặc tiến trình khác.
- Đã kiểm tra mã/cấu trúc bằng dữ liệu giả trong môi trường phát triển.
  Windows Startup/GUI và dữ liệu CNC thật cần đối chiếu trên laptop/máy thực tế.
