LTD WEB PROGRAM TRANSFER
Build: 20261110-transfer-tool

Chức năng được tích hợp trong web công ty, mục chi tiết máy CNC →
Truyền chương trình. Giao diện hai khung: Máy tính và Bộ nhớ CNC.
Truyền file vào bộ nhớ CNC để người vận hành xem/chọn chạy tại máy.
Nhận và xem chương trình từ bộ nhớ CNC về máy tính. Không chạy DNC.

CÁCH DÙNG
1. Giải nén gói FANUC-Web-Transfer-Tool vào thư mục riêng.
2. Chép bộ 3 DLL tin cậy đang dùng vào lib:
   Fwlib64.dll, fwlibe64.dll, fwlib30i64.dll. Gói không kèm DLL.
3. Mở START-WEB-TRANSFER.cmd trên chính laptop sẽ mở web.
4. Nhập IP/cổng CNC hoặc bấm Nhập cấu hình máy để lấy IP/cổng từ
   bridge-config.json. Không sửa file cấu hình cầu nối.
5. Bấm Bật kết nối web rồi Sao chép mã.
6. Đăng nhập web công ty bằng tài khoản có quyền chỉnh sửa.
   Mở máy cần truyền → Truyền chương trình. Dán mã ghép rồi bấm Ghép kết nối.
   IP/cổng của máy trên web phải khớp chính xác máy đã chọn ở tiện ích.
7. Nếu Chrome/Edge hỏi quyền truy cập mạng cục bộ, cho phép.
   Nếu IT chặn quyền này, cần IT cho phép. Không tắt bảo vệ trình duyệt.

GỬI CHƯƠNG TRÌNH VÀO BỘ NHỚ CNC
- Chọn file NC ở khung Máy tính. Kiểm tra nội dung.
- Máy CNC phải dừng ở EDIT, không có alarm/emergency. Chuyển tại máy;
  tiện ích không đổi mode, không bấm Cycle Start hoặc Reset.
- Bấm Kiểm tra trước truyền. Tiện ích kiểm tra file, trạng thái CNC,
  path và số O chưa tồn tại, trả SHA256 và mã kiểm tra hạn 2 phút.
- Đối chiếu máy/IP/file/số O trên màn hình. Sau khi kiểm tra đạt, bấm
  Truyền vào bộ nhớ CNC để gửi ngay, không phải gõ TRUYEN Oxxxx.
- Đóng/mở khung truyền trong cùng tab sẽ khôi phục ghép theo đúng tài
  khoản và máy. Không khôi phục file/ticket hoặc gửi lại lệnh. Quên ghép,
  đăng xuất/đổi tài khoản sẽ xóa ghép; tải lại trang cần ghép lại.
- Máy được kiểm tra lại ngay trước khi ghi. Số O đã tồn tại sẽ bị chặn,
  không có chức năng ghi đè hoặc xóa chương trình.
- Không đóng tiện ích, tắt máy tính hoặc rút cáp khi đang truyền.
- Khi CNC nhận xong, kiểm tra toàn bộ nội dung, dao, gốc tọa độ, offset
  và quy trình chạy thử tại máy trước khi chọn chạy.
- Thông báo nhận xong dựa vào cnc_dwnend3, không phải kiểm định gia công
  hoặc xác minh byte-for-byte bằng đọc ngược. Có thể dùng Xem chương trình
  để tự đối chiếu chương trình trong bộ nhớ.
- Không dùng đồng thời công cụ khác để sửa/truyền chương trình vào cùng CNC.

NHẬN CHƯƠNG TRÌNH VỀ MÁY TÍNH
- Làm mới để đọc danh sách bộ nhớ CNC.
- Chọn một hàng → Xem chương trình hoặc Nhận về máy tính.
- File chỉ được trả sau khi đọc đủ, đúng số O và kết thúc upload thành công.
  Bản nhận có thể có M99 (chương trình con). Không tự sửa mã NC.
- Tải về bằng chức năng tải file của trình duyệt, tên Oxxxx.nc.
- Chương trình được bảo vệ hoặc không có tùy chọn đọc sẽ hiện mã lỗi.
  Không sửa tham số CNC để vượt bảo vệ.

GIỚI HẠN CỦA BẢN THỬ
- Windows 64-bit; máy CNC một path. Chưa có cấu hình chọn đa path.
- Một file ASCII có % đầu/cuối, một số O, tối đa 2 MiB.
- Gửi: O0001–O7999 và có M02/M30. Chỉ kiểm tra định dạng, không xác nhận
  đường chạy dao an toàn. Macro GOTO không bị nhầm thành một số O khác.
- Nhận: O0001–O7999; file đầy đủ, không gộp dữ liệu macro xuất thêm sau %.
- Danh sách tối đa 10.000 chương trình; quá giới hạn sẽ báo lỗi thay vì
  trình bày danh sách thiếu như thể đã đủ.
- Bảo vệ O8000/O9000 được giữ nguyên. Không force, không tự retry gửi.
- Truyền vào bộ nhớ, không có DNC streaming, xóa/đổi tên trên CNC,
  thay offset/tham số/PMC, chọn hoặc chạy chương trình từ xa.
- Đây là tiện ích LTD, không phải phần mềm FANUC chính hãng hay bản sao
  được FANUC chứng nhận. Chưa kiểm chứng với CNC thật.

KẾT NỐI VÀ BẢO MẬT
- Chỉ lắng nghe tại 127.0.0.1:8766 trên laptop. Không cần mở cổng router,
  không nghe trên 0.0.0.0/LAN và không chuyển tiếp 8193 ra Internet.
- Chỉ nhận yêu cầu từ nguồn web https://storageltd.github.io, đúng Host,
  đúng mã ngẫu nhiên 256-bit của phiên đang mở và đúng IP/cổng CNC đã ghim.
- Yêu cầu ghi cần thêm ticket dùng một lần, hết hạn sau 2 phút, gắn với
  nội dung đã kiểm tra. File, hash và trạng thái máy được kiểm tra lại.
- Mã ghép không ghi vào URL, Firebase, localStorage hay file cấu hình.
  Không chia sẻ mã ghép; đóng tiện ích sẽ làm mất hiệu lực mã cũ.
- Nội dung NC đi từ trình duyệt → tiện ích cục bộ → CNC. Không đưa file
  NC hay hàng đợi lệnh lên Firebase. File tạm ngẫu nhiên được xóa sau xử lý.
- Cần mở tiện ích trên chính laptop đang dùng web, laptop kết nối LAN tới CNC.
  Điện thoại hoặc máy ở nhà chưa điều khiển tiện ích trên laptop khác.
- Cầu nối giám sát hiện tại không cần thay thế. Tiện ích truyền có handle
  FOCAS riêng; nếu CNC hết kết nối, xử lý ở laptop, không sửa tham số máy.
- Ứng dụng có thao tác GHI vào bộ nhớ chương trình. Chỉ truyền khi đã đối
  chiếu đúng máy và có người vận hành kiểm soát tại CNC.

NẾU LỖI / MẤT KẾT NỐI
Có thể còn chương trình chưa hoàn chỉnh trong bộ nhớ CNC. Kiểm tra tại máy
trước bước tiếp theo. Không tự xóa và không tự gửi lại. Nếu bị chặn do số O
đã có, hãy đối chiếu và xử lý tại CNC theo quy trình của công ty.

KIỂM CHỨNG
Đã kiểm tra C#/PowerShell, native ABI bằng máy mô phỏng, gửi từng phần,
EW_BUFFER, trạng thái EDIT/dừng, số O trùng, lỗi trễ, nhận đủ file và giải
phóng handle; origin/host/token/IP, ticket dùng một lần/hết hạn/nội dung
đổi; Chromium với API mô phỏng cho thao tác truyền, nhận, tải file và
bố cục desktop/điện thoại. Chưa chạy WinForms trên Windows, chưa truyền
vào CNC thật và chưa xác nhận quyền mạng cục bộ trên laptop của anh.

Gói cũ START-TRANSFER.cmd vẫn là cửa sổ thử riêng. Gói dùng cho web này
mở bằng START-WEB-TRANSFER.cmd.
