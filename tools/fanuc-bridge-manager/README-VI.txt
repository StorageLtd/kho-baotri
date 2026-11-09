LTD CNC BRIDGE MANAGER — GIAO DIỆN CẤU HÌNH NHIỀU MÁY
Build 20261109-operator-screen | Windows 10/11 64-bit

KHỞI ĐỘNG
1. Giải nén toàn bộ FANUC-Bridge-Manager.zip.
2. Chép ba DLL 64-bit của bạn vào thư mục lib CHUNG của gói:
   Fwlib64.dll, fwlibe64.dll, fwlib30i64.dll
   Chỉ cần chép một lần cho tất cả máy trong danh sách.
3. Nhấp đúp START-MANAGER.cmd. Không cần mở Notepad hoặc gõ lệnh.
4. Chọn + Thêm máy → chọn mẫu trong Thư viện mẫu.
5. Điền tên, IP, cổng, model bộ điều khiển và các thông số đúng trên máy.
   Model hoặc offset chưa rõ: để Chưa xác định, không đánh dấu đã đối chiếu.
6. Lưu cấu hình → Kiểm tra FOCAS → Chạy cầu nối.
7. Khi bấm Chạy, một cửa sổ Bridge riêng mở ra để đăng nhập CMMS như trước.
   Mật khẩu không lưu trong cấu hình. Mỗi máy vẫn dùng một tiến trình Bridge.
   Bạn không phải tự mở PowerShell, chọn thư mục hoặc gõ câu lệnh cho từng máy.
8. Chọn máy khác ở cây bên trái để cấu hình và chạy tiếp.

THƯ VIỆN MẪU
- Vertical Mill: phay đứng XYZ 3 trục.
- Horizontal Mill: phay ngang XYZB 4 trục.
- Lathe: tiện XZ 2 trục.
- Turning Center: tiện có trục C / dao sống.
- Vertical Mill 5-axis: phay nhiều trục.
- Custom CNC: loại khác hoặc chưa xác định.
Mẫu chỉ hỗ trợ khai báo, không xác nhận phần cứng thật và không tự bật offset.
Các thông số số trục/trục chính là khai báo. Bản Bridge hiện thu thập kênh/trục
chính mặc định, chưa tự thu thập tất cả kênh hoặc trục chính của máy đa kênh.

NẾU MÁY ĐÃ CÓ CẤU HÌNH CŨ
- Dừng Bridge cũ của máy đó trước khi chạy Bridge Manager cho cùng máy.
- Bấm Nhập cấu hình cũ → chọn bridge-config.json cũ.
- Giữ nguyên ID và tên máy đang dùng trên web để tránh tạo bản ghi trùng.
- Chọn loại máy/bố trí theo thực tế, kiểm tra rồi Lưu.
- Không xóa thư mục cũ. Nếu còn báo cáo/alarm chờ gửi trong report-outbox,
  để bản cũ gửi hết trước khi chuyển, hoặc chuyển chúng sang report-outbox
  trong thư mục dữ liệu mới của đúng máy/tài khoản. Không gộp dữ liệu hai máy.

DỮ LIỆU VÀ CẤU HÌNH
- Lưu theo từng máy tại:
  %LOCALAPPDATA%\LTD\CncBridgeManager\machines\<machineId>\
- Trong mỗi thư mục có bridge-config.json, report-outbox và last-result.json.
- Mở thư mục dữ liệu: chọn máy → tab Kết nối và dữ liệu → nút Mở thư mục.
- Xuất cấu hình: lưu JSON để sao lưu/chuyển máy tính, không phải sửa bằng Notepad.
- Mỗi lần cập nhật cấu hình đã có sẽ tạo bản .bak trước khi lưu.
- Không sửa cấu hình máy khi Bridge của máy đó đang chạy; dừng Bridge rồi sửa.
- Không lưu mật khẩu, idToken hoặc refreshToken trong file cấu hình.
- Đóng cửa sổ quản lý không tự dừng các Bridge đang chạy.

DỪNG CẦU NỐI
Nút Dừng cầu nối chỉ gửi yêu cầu dừng chương trình thu thập, KHÔNG dừng CNC.
Bridge kiểm tra yêu cầu ở vòng đọc kế tiếp và đóng phiên có trật tự.
Nếu cửa sổ Bridge đang chờ nhập tài khoản/mật khẩu, nhấn Ctrl+C tại cửa sổ đó.
Không có nút Cycle Start/Stop hoặc chức năng ghi CNC trong Bridge Manager.
Bản thử truyền NC vẫn là gói riêng, không tích hợp vào giao diện này.

PHẠM VI OFFSET
Chỉ phay XYZ 3 trục / Memory C đã đối chiếu mới diễn giải XYZ và H/D.
Máy tiện/nhiều trục/bảng khác vẫn giám sát trạng thái và T nếu FOCAS hỗ trợ;
giá trị offset chưa hỗ trợ để trống. Không suy đoán dao vật lý từ mã T modal.
Cấu hình chọn trên Manager được gửi lên đúng bản ghi máy khi đăng nhập/chạy
Bridge thành công, để mô hình trên web có đúng loại và hướng bố trí.

KIỂM THỬ
Đã kiểm thử logic lưu/nhập cấu hình, phân loại, chống trùng IP/ID, sao lưu,
kiểm soát phiên Bridge và cú pháp GUI. Chưa chạy cửa sổ Windows hoặc kết nối
CNC thật trong môi trường phát triển; cần mở thử trên laptop của bạn.
Nếu IT chặn PowerShell/.cmd, cần IT cho phép chạy chương trình theo chính sách.
Gói không chứa DLL FANUC. Không mở cổng 8193 ra Internet.

MÔ HÌNH TRÊN WEB
Web dùng Loại máy và Kiểu bố trí để chọn mô hình minh họa. Bạn có thể chỉnh
trong Cài đặt máy trên web; cập nhật tương ứng trong Manager nếu muốn giữ
lựa chọn đó khi Bridge khởi động lại từ cấu hình đã lưu trên laptop.
Màu mô hình dựa trên trạng thái FOCAS được lấy mẫu, không đọc đèn/PMC vật lý.

MÀN HÌNH CHI TIẾT CNC — 20261109
- Bấm mô hình máy trên web để xem POSITION, PROGRAM, ALARM hoặc THỐNG KÊ.
- Bổ sung cnc_rdposition (RELATIVE/ABSOLUTE/MACHINE/DISTANCE TO GO),
  cnc_rdsvmeter (tải servo), cnc_rdseqnum và cnc_rdexecprog (đoạn chương trình).
- Tất cả là API chỉ đọc, không đọc PMC và không ghi hay điều khiển CNC.
- Mục không được bộ điều khiển/DLL hỗ trợ hiện Chưa đọc. Không lấy số trong ảnh.
- Cần cập nhật Bridge để có các mục mới; cấu hình và report-outbox cũ giữ nguyên.
- Vùng PROGRAM chỉ là đoạn CNC trả về, không phải toàn bộ file. Dòng N được tô
  khi khớp duy nhất với số N đọc được; các lần đọc không phải ảnh chụp đồng thời.
- Tải servo có thang hiển thị 0–200%, số thực vẫn giữ khi vượt thang.
- Các tab chỉ đổi cách xem trên web. Không có nút Cycle Start/Reset/ghi offset.
- Đã kiểm tra mã và dữ liệu thử; cần đối chiếu tọa độ, đơn vị, tải và chương trình
  trên CNC thật lần đầu. Tên kiểu máy không tự xác nhận bảng offset H/D.
