LTD CNC BRIDGE MANAGER
Build 20261110-path1-directory · Windows 10/11 64-bit

CẬP NHẬT
1. Trong bản Manager cũ: dừng từng cầu nối, chờ tiến trình dừng.
2. Nhấp phải biểu tượng Manager ở khay hệ thống → Thoát quản lý.
3. Giải nén bản mới ra thư mục mới. Chép Fwlib64.dll, fwlibe64.dll,
   fwlib30i64.dll của bạn vào lib. Không chạy đồng thời hai cầu nối cùng máy.
4. Nhấp đúp START-MANAGER.cmd. Máy đã lưu trong LocalAppData vẫn còn.
5. Chọn máy → Chạy cầu nối → mở tab Đăng nhập CMMS, nhập email/mật khẩu và bấm Đăng nhập và kết nối.
   Mật khẩu và token chỉ nằm trong bộ nhớ, không ghi vào cấu hình hay nhật ký.

TRUYỀN/NHẬN BẰNG MẬT KHẨU RIÊNG — KHÔNG CẦN MÃ GHÉP
- Bản này dùng mật khẩu truyền/nhận riêng, độc lập mật khẩu CMMS.
- Lần đầu: chọn máy đã lưu → Truyền trên web → nhập mật khẩu riêng
  trong ô thiết lập → Lưu mật khẩu riêng. Nhập mật khẩu do anh chọn;
  gói công khai không có mật khẩu mặc định hoặc verifier dùng chung.
- Chỉ thiết lập một lần trên laptop. Cấu hình kiểm tra mật khẩu lưu tại
  %LOCALAPPDATA%\LTD\CncBridgeManager\machines\transfer-auth.json,
  dạng PBKDF2-SHA256 có salt ngẫu nhiên; không lưu mật khẩu dạng rõ.
- Khi đã đặt mật khẩu, Manager tự bật truy cập cho các máy đã lưu khi
  mở ứng dụng. Có thể bấm Bật truyền cho các máy nếu đang dừng.
- Chỉ cần khai báo máy một lần. Mở máy A hoặc B trên web, đăng nhập
  mật khẩu truyền/nhận và thao tác; không đổi phiên/máy trong Manager.
- Trên chính laptop này: mở web → chi tiết máy → Truyền chương trình →
  nhập mật khẩu truyền/nhận riêng → Đăng nhập truyền/nhận.
- Không nhập mật khẩu đăng nhập web vào ô này. Không cần chép mã ghép.
- Đổi mật khẩu: dừng truy cập truyền trước, nhập mật khẩu mới rồi lưu.
  Các phiên cũ mất hiệu lực sau khi dừng/đổi mật khẩu.
- Đóng/mở khung truyền trong cùng tab giữ phiên đăng nhập tối đa 30 phút.
  Không lưu mật khẩu hay phiên vào localStorage/sessionStorage/file web.
- Đăng xuất truyền/nhận để kết thúc phiên; đăng xuất/đổi tài khoản web
  cũng xóa phiên đã nhớ và gửi yêu cầu thu hồi phiên cục bộ.
- Nhập sai 5 lần bị chặn đăng nhập 60 giây. Không có chức năng bỏ qua
  mật khẩu, force bit, đổi mode hoặc chạy chương trình từ xa.

ĐỌC THƯ MỤC PATH1 TRÊN FANUC 0i-D/F / 30i
- Ưu tiên cnc_rdpdf_alldir để duyệt //CNC_MEM/USER/PATH1/ và thư mục con.
  Không lấy chương trình đang chọn để thay thế thư mục bộ nhớ.
- Hiển thị đường dẫn từng chương trình, phân biệt cùng số O ở các thư mục.
  Xem/nhận dùng cnc_upstart4/upload4/upend4 với đường dẫn cụ thể; không
  thay đổi chương trình đang chọn hoặc thư mục foreground/background.
- Nếu máy không hỗ trợ API thư mục, dùng cnc_rdprogdir3 như bản trước.
  Giao diện hiện nguồn PATH1 khi đọc bằng API thư mục, không giả metadata.
- Không truy cập CF/USB/Data Server hoặc SYSTEM. Giới hạn 60 giây,
  10.000 mục, 256 thư mục và 8 mức; hết giới hạn báo lỗi thay vì báo đủ.
- Thư mục bị bảo vệ không bị vượt quyền; báo chú thích nếu phải bỏ qua.
- Khi gửi từ giao diện PATH1, CNC phải đang chọn root PATH1. Chương trình
  kiểm tra lại thư mục và số O trực tiếp từ thư mục trước khi ghi; không
  tự đổi thư mục CNC và không thêm API ghi ngoài download3 hiện có.
- Đã kiểm tra mô phỏng 5 file ở root/thư mục con, trùng số O khác thư mục,
  đọc đúng đường dẫn, thư mục lặp/bảo vệ, chặn sai thư mục và O đã tồn tại.

ĐỌC DANH SÁCH BỘ NHỚ CNC
- Đọc thư mục qua cnc_rdprogdir3, không dùng số chương trình đang chọn
  để thay thế danh sách bộ nhớ. Tiếp tục từ số O kế tiếp dù lần trước
  trả ít dòng hơn yêu cầu; chỉ kết thúc khi CNC báo hết hoặc đạt số O tối đa.
- Nếu CNC giới hạn số dòng/lần, thử đọc một dòng/lần. Nếu không hỗ trợ
  metadata thư mục, đọc số O; dung lượng chưa đọc được hiển thị —.
- Nếu CNC lặp lại số O hoặc trả số đếm không hợp lệ, hiện lỗi; không
  trình bày phần đã đọc như danh sách đầy đủ. Giới hạn 60 giây/10.000 dòng.
- Phạm vi là các chương trình đã đăng ký trong bộ nhớ CNC ở path được
  hỗ trợ. Không tự duyệt thẻ CF/USB/Data Server hoặc đổi path/folder máy.
- Chỉ đọc thư mục; không sửa chương trình, tham số hoặc PMC.
- Kiểm tra mô phỏng gồm CNC trả từng dòng, trang ngắn, giới hạn số dòng,
  không hỗ trợ metadata, kết thúc bằng EW_NUMBER và trả trùng một số O.

TRUYỀN CHƯƠNG TRÌNH
- Chọn file, kiểm tra đúng máy/IP và số O trong nội dung.
- Kiểm tra đạt → bấm Truyền để gửi ngay, không gõ câu xác nhận.
- CNC phải dừng ở EDIT, không alarm/emergency; chỉ máy một path.
- Một file ASCII, % đầu/cuối, một chương trình O0001–O7999, M02/M30,
  tối đa 2 MiB. Không ghi đè số O đã có hoặc xóa chương trình trên CNC.
- Danh sách, xem nội dung và nhận file .nc lấy từ bộ nhớ CNC thực tế.
- Ticket kiểm tra dùng một lần, hết hạn 2 phút, gắn đúng file và phiên
  đăng nhập; trạng thái máy, hash và số O được kiểm tra lại trước khi ghi.
- Truyền vào bộ nhớ, không chạy DNC. Người vận hành kiểm tra toàn bộ mã,
  dao/gốc/offset và quy trình chạy thử trước khi chọn chạy tại CNC.
- Nếu mất mạng, có thể còn chương trình chưa hoàn chỉnh. Kiểm tra tại
  máy; không tự gửi lại/xóa. Không truyền đồng thời bằng công cụ khác.

KẾT NỐI VÀ BẢO MẬT
- Dùng chung lib và cấu hình máy đã lưu; không cần mở ứng dụng truyền riêng.
- Một tiện ích phục vụ các máy đã lưu. Mỗi phiên đăng nhập chỉ dùng
  cho đúng IP/cổng của máy đang mở trên web. Máy chưa khai báo hoặc
  có IP/cổng khác Manager bị chặn; không tự dò hoặc chọn IP thay thế.
- Thêm/sửa/gỡ máy sẽ cập nhật danh sách phục vụ; máy gỡ bị thu hồi phiên.
  Khi đang truyền/nhận, chờ thao tác hoàn tất trước khi sửa cấu hình.
- Các yêu cầu truyền xử lý lần lượt; không tự gửi lại hoặc truyền đồng
  thời vào nhiều CNC. Giám sát vẫn hoạt động độc lập.
- Chỉ lắng nghe 127.0.0.1:8766, chỉ nhận nguồn web công ty và IP/cổng
  đã lưu và phiên đăng nhập đúng máy. Không mở cổng router, không gửi file NC/mật khẩu lên Firebase.
- Mật khẩu chỉ gửi tới tiện ích localhost trên chính laptop. Phiên ngẫu
  nhiên chỉ trong RAM và được thu hồi khi dừng Manager hoặc hết hạn.
- Nút X thu nhỏ vào khay: giám sát và truyền vẫn tiếp tục. Thoát Manager
  dừng truy cập truyền; các cầu nối giám sát con vẫn chạy. Chờ thao tác
  CNC hoàn tất mới được dừng/thoát. Laptop phải bật, không Sleep.
- Nếu trình duyệt hỏi quyền mạng cục bộ, cho phép. Nếu IT chặn, cần IT
  cho phép; không tắt bảo vệ trình duyệt.
- Cầu nối giám sát vẫn chỉ đọc; mô-đun ghi chương trình là phần riêng.

LỖI VÀ KIỂM CHỨNG
- Truyền chỉ nạp khi dùng; nếu lỗi, chi tiết giữ trong tab Truyền.
- Lỗi khởi động Manager hiển thị cửa sổ có thể sao chép và lưu tại
  %LOCALAPPDATA%\LTD\CncBridgeManager\manager-startup-error.log.
  Không gửi mật khẩu hoặc token khi báo lỗi.
- Đã kiểm tra C# 5/.NET Framework 4.8, lưu/kiểm tra mật khẩu, phiên,
  chặn thử sai, native/API và trình duyệt bằng máy CNC mô phỏng.
  Đã kiểm tra hai CNC mô phỏng: A/B dùng đúng IP, phiên/ticket không
  dùng chéo máy, máy chưa khai báo/đã gỡ bị chặn và không đổi danh sách
  giữa thao tác. Chưa chạy WinForms trên Windows hoặc truyền vào CNC thật.

THÊM / SỬA / GỠ MÁY
- + Thêm máy → chọn mẫu Vertical Mill, Horizontal Mill, Lathe hoặc Custom.
- Điền tên, IP, cổng, model và tên trục đúng với CNC; bấm Lưu cấu hình.
- Chọn đúng bảng Memory A, B hoặc C và xác nhận đã đối chiếu nếu cần đọc offset.
  Ảnh có LENGTH GEOM/WEAR và RADIUS GEOM/WEAR tương ứng Memory C.
- Kiểm tra FOCAS: chỉ đọc thử, không gửi dữ liệu lên web.
- Chạy cầu nối: đăng nhập CMMS, bắt đầu gửi dữ liệu và báo cáo lên web.
- Sửa cấu hình: dừng cầu nối trước. Gỡ cấu hình: chuyển cả dữ liệu máy sang
  LocalAppData/LTD/CncBridgeManager/archive, không xóa báo cáo cũ.
- Gỡ cấu hình Manager không tự xóa bản ghi web. Trên web có nút Xóa máy.

CHẠY NỀN
- Sau khi đăng nhập, cầu nối chạy nền, không cần giữ cửa sổ PowerShell.
- Nút X của Manager hoặc Chạy ở khay hệ thống chỉ ẩn giao diện.
- Nhấp biểu tượng LTD Bridge Manager ở khay hệ thống để mở lại.
- Thoát quản lý trong menu khay cũng không dừng các cầu nối đang chạy.
- Dừng cầu nối chỉ ngừng thu thập, không gửi lệnh dừng máy CNC.
- Laptop phải bật, không Sleep/Hibernate; giữ LAN tới CNC và Internet tới Firebase.
  Đây là tiến trình của tài khoản Windows hiện tại, không phải dịch vụ tự chạy
  sau khởi động/đăng xuất. Không tự lưu mật khẩu để đăng nhập lại.
- Tab Nhật ký cầu nối hiển thị nhật ký cục bộ; thanh dưới hiển thị trạng thái gửi.

CÁC MÀN HÌNH TRÊN WEB
POSITION: tọa độ, tải servo, đoạn đang thực thi, G modal và thông số trong một khung.
PROGRAM / WORK: toàn bộ file O đang chạy và EXT / G54–G59 cho máy phay XYZ được xác minh.
OFFSET: bảng đã cài đặt, phân trang 16 dòng; phân biệt Memory A/B/C.
ALARM: chỉ trạng thái/mã/mô tả lỗi và lịch sử alarm.
THỐNG KÊ: các biểu đồ trong ngày và báo cáo đã có.

NGUỒN DỮ LIỆU / GIỚI HẠN
- HD.T và NX.T đọc bằng cnc_rdhdnxt (vị trí trục chính/chờ thứ nhất của CNC).
  T modal chỉ lưu riêng; không dùng thay thế HD.T. Không phải cảm biến vật lý.
- Bảng gốc XYZ dùng cnc_rdzofs theo từng trục, cnc_getfigure cho độ chia và
  đơn vị CNC đã xác minh. EXT / G54–G59 là giá trị cài đặt, không suy ra
  bằng MACHINE trừ ABSOLUTE. H/D ưu tiên CNC modal, không phụ thuộc macro.
  G54.1/P, G52, xoay tọa độ, TCP và gốc của máy tiện chưa được diễn giải.
- Offset được đối chiếu kiểu khai báo với cnc_rdtofsinfo; lấy độ chia từ
  cnc_getfigure. Chỉ diễn giải phay XYZ 3 trục đã xác nhận; bảng tiện để trống.
  Bảng được đọc lại khoảng 30 giây/lần; thời điểm đọc hiện ngay tại bảng.
- Full file O đọc bằng cnc_upstart3/upload3/upend3 theo chiều CNC → PC.
  Không truyền chương trình từ PC sang CNC; không bật sửa hoặc bỏ bảo vệ.
  Đổi O thì đọc lại; cùng O làm mới khoảng 60 giây. Tối đa 2 MiB, ngân sách
  vòng đọc 8 giây (mỗi lời gọi vẫn chịu timeout thư viện). Chỉ hiển thị là đủ
  file khi kiểm tra đúng số O và ký tự kết thúc %. File lỗi/thiếu không giả làm đủ.
  CNC bận, chế độ hoặc tùy chọn không cho phép: để Chưa đọc và hiện chẩn đoán.
- Path 1 / trục chính mặc định; mẫu nhiều trục không tự bật thu thập đa kênh.
- Tất cả chức năng trong gói này chỉ đọc. Không đọc/ghi PMC, không ghi offset,
  sửa/chạy/xóa chương trình, đổi tham số hoặc điều khiển chuyển động CNC.
- Giữ report-outbox khi cập nhật. last-result.json là mẫu gần nhất.
- Đã kiểm tra bằng fixture và trình duyệt. Chưa thử GUI Windows/CNC thật;
  cần đối chiếu lần đầu HD.T/NX.T, đơn vị, gốc và bảng offset với màn hình máy.

ĐĂNG NHẬP TRỰC TIẾP TRONG MANAGER — 20261109-state-io
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

SỬA NHẬN DẠNG VÀ ĐỌC DỮ LIỆU — 20261109-state-io
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

SỬA ĐỘ CHIA BẢNG — 20261109-state-io
- cnc_getfigure có thể trả dec_fig_in khác dec_fig_out; đây không phải lỗi.
- Các giá trị thô của cnc_rdzofs / cnc_rdtofs / cnc_rdtofsr được chia theo
  dec_fig_in của đúng loại dữ liệu, không lấy dec_fig_out để chia bảng.
- Vẫn kiểm tra phạm vi độ chia, tên trục, đơn vị và loại bảng đã xác nhận.
- Có kiểm tra giả lập đầu vào 4 / đầu ra 6 với giá trị âm, khác 0; input
  ngoài phạm vi vẫn bị từ chối. Cần đối chiếu giá trị hiện tại trên CNC thật.

ĐỒNG HỒ TRỤC CHÍNH — 20261109-state-io
- POSITION có Spindle Load Meter và Spindle Speed Meter cạnh Servo Load.
- Tải trục chính thứ nhất đọc bằng cnc_rdspmeter(type=0), xác minh đơn vị %.
  Thang hình 0–200%; số đo thực vẫn hiển thị nếu vượt 200%. Chưa đọc được là —.
- Tốc độ hiển thị RPM thực đã đọc bằng cnc_rdspeed. Không dùng tốc độ motor
  trong ODBSPLOAD thay thế tốc độ trục chính; không tự đặt giới hạn RPM máy.
- Dữ liệu quá hạn được ẩn. Chỉ đọc FOCAS, không có truy cập PMC hay ghi CNC.
- Cần cập nhật Bridge để có tải trục chính; web tải lại bằng Ctrl+F5.

SỬA FILE TRẠNG THÁI — 20261109-state-io
- bridge-state.json ghi qua file tạm riêng rồi thay thế nguyên vẹn. Manager mở
  đọc với FileShare.ReadWrite/Delete, tránh va chạm với lần ghi tiếp theo.
- Có thử lại ngắn; lỗi file trạng thái phụ không dừng thu thập/gửi CNC.
- Nhật ký và lỗi khởi động tách theo từng phiên GUID; Manager chỉ hiển thị
  file của phiên hiện tại, không ghép lỗi HTTP 400 của phiên trước vào phiên mới.
- Mã lỗi xác thực Firebase chỉ hiện các mã an toàn đã biết (ví dụ
  INVALID_LOGIN_CREDENTIALS), không in body phản hồi, mật khẩu hay URL/token.
- Khi cập nhật phải thay đủ thư mục, gồm Bridge.State.ps1; không chỉ chép
  Start-FanucBridge.ps1. Nút X chỉ ẩn Manager; chọn Thoát quản lý ở khay.
- Đã kiểm tra I/O và giả lập lỗi ghi; nhánh khóa deny-delete được kiểm tra
  khi bộ kiểm thử chạy trên Windows. Chưa chạy trực tiếp trên laptop/CNC thật.
