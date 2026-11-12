# LTD CMMS Offline — nội bộ trên máy tính thu thập

Build **20261112**. Đây là bản riêng, dùng giao diện CMMS hiện tại nhưng tài khoản, dữ liệu và máy chủ nằm trên máy tính. Không cần Firebase, hosting, tên miền hoặc Internet. Bản online của công ty không bị thay đổi.

## Có những mục nào?

- Tổng quan, kho linh kiện và hình ảnh, nhập/xuất kho, in phiếu và Excel có logo LTD.
- Danh sách máy thiết bị, lịch bảo trì/job, hoàn tất kỳ bảo trì, lịch sử sửa chữa và xuất báo cáo.
- Giám sát nhiều CNC FANUC: sơ đồ máy đổi màu theo trạng thái, chi tiết POSITION / PROGRAM / WORK / OFFSET / ALARM / thống kê, tốc độ và tải trục chính/servo khi CNC hỗ trợ.
- Lưu alarm từng máy, xuất Excel riêng từng máy; lưu báo cáo vận hành theo ngày/phiên và xuất như bản web.
- Tài khoản nội bộ admin / manager / technician / viewer; kiểm tra quyền ở máy chủ, không chỉ khóa nút. Admin quản lý người dùng trong mục **Tài khoản** ở góc dưới bên phải.
- Sao lưu/nhập JSON; nhập dữ liệu từ bản online nếu có file xuất từ Firebase.

Phạm vi này là CMMS + giám sát CNC chỉ đọc. Chưa bật truyền/ghi chương trình vào bộ nhớ CNC, Diagnostic/PMC hay nhắc email trong bản offline này. Chưa tích hợp đọc Haas. Tọa độ/offset và chương trình phụ thuộc API, cấu hình máy và độ dài CNC trả về như bản online; không dựng số liệu khi chưa đọc được.

## 1. Chạy lần đầu

1. Dùng **Windows 10/11 64-bit**, Windows PowerShell 5.1 và **.NET Framework 4.8 trở lên** (máy đang chạy Manager thành công thường đã có).
2. Giải nén toàn bộ `LTD-CMMS-Offline-20261112.zip` vào Desktop hoặc Documents. Không chạy trực tiếp trong ZIP.
3. Nhấp đúp **START-OFFLINE.cmd**. Nếu Windows hỏi về file tải xuống, kiểm tra đúng gói trước khi cho chạy. Không cần cài Python, Node, Firebase hay phần mềm máy chủ khác.
4. Lần đầu có hộp tạo quản trị viên. Tài khoản gợi ý **admin@ltd.local** chỉ là tên đăng nhập nội bộ, không phải email thật. Tự đặt mật khẩu ít nhất 12 ký tự và ghi nhớ an toàn. Không có mật khẩu mặc định.
5. Chương trình mở **http://localhost:8088/**. Đăng nhập bằng tài khoản vừa tạo, không dùng tài khoản Firebase của website cũ.
6. Ban đầu dữ liệu trống. Có thể thêm linh kiện/máy/job mới hoặc nhập dữ liệu ở phần dưới.

Không cần DLL để dùng kho, danh sách máy, bảo trì và báo cáo đã có. DLL chỉ cần khi thu thập từ CNC thật.

File CMD vẫn dùng PowerShell bên trong, nhưng anh không cần gõ lệnh. Chính sách thực thi chỉ đặt trong tiến trình hiện tại; không đổi Registry hoặc chính sách của IT. Nếu máy công ty chặn PowerShell/CMD thì nhờ IT cho phép, không tự vượt chính sách.

## 2. Cửa sổ quản lý và khay hệ thống

Cửa sổ **LTD CMMS OFFLINE** có Mở phần mềm / Thu nhỏ vào khay / Dừng và thoát.

- Bấm **X** chỉ thu nhỏ vào khay gần đồng hồ Windows. Máy chủ và thu thập CNC tiếp tục chạy.
- Nhấp đúp biểu tượng khay để mở lại quản lý; dùng **Mở phần mềm** để mở trình duyệt.
- Muốn dừng hẳn, chọn **Dừng và thoát**. Không dừng máy CNC.
- Laptop phải bật, không Sleep. Tắt trình duyệt không dừng máy chủ. Chưa tự cài dịch vụ Windows hoặc tự chạy khi bật máy trong bản này.
- Chỉ chạy một bản trên một thư mục dữ liệu. Mở file CMD lần nữa không tạo một cơ sở dữ liệu thứ hai.

Trang chỉ mở được khi chương trình đang chạy. Không nhấp riêng `web/index.html`; dùng START-OFFLINE.cmd. Nếu trình duyệt không tự mở, chép `http://localhost:8088/` vào thanh địa chỉ.

## 3. Đọc CNC

**Không cần Internet nhưng vẫn cần kết nối LAN/cáp Ethernet giữa máy tính và CNC.** “Offline” không có nghĩa đọc CNC không qua dây mạng. Dữ liệu chỉ đi từ CNC về máy tính nội bộ.

1. Chép ba DLL **64-bit, đúng bản có bản quyền đang dùng thành công** vào thư mục `lib` của gói: `Fwlib64.dll`, `fwlibe64.dll`, `fwlib30i64.dll`. Gói này không kèm DLL.
2. Kết nối cáp hoặc cùng switch/router nội bộ, đặt IP cùng lớp mạng theo cấu hình đã được kỹ thuật/IT xác nhận. Kiểm tra ping và cổng FOCAS 8193 tại LAN; không mở 8193 ra Internet.
3. Trong **Giám sát CNC → Thêm máy CNC mới**, nhập tên, IP và cổng, chọn loại/model/offset như bản web. Chỉ xác nhận bảng offset sau khi đối chiếu máy thật. Lưu.
4. Bộ thu thập tự nhận máy đã khai báo, không yêu cầu tài khoản CMMS online và không phải chạy từng PowerShell thủ công.
5. Chu kỳ nghỉ mặc định 3 giây, cộng thời gian CNC trả lời. Một máy không phản hồi được xử lý bởi tiến trình riêng, không chặn máy khác.

Chỉ thu thập IP IPv4 nội bộ 10.x / 172.16–31.x / 192.168.x / 169.254.x. Reader giữ nguyên nguồn chỉ đọc của cầu nối hiện tại; không dùng PMC, không ghi parameter/offset/ladder, không chạy/dừng CNC. Kiểu offset không được xác nhận sẽ để trống/chẩn đoán thay vì đoán.

Khi thiếu DLL hoặc không kết nối, vào chi tiết máy → Chẩn đoán đọc dữ liệu. Sửa IP/loại máy ngay trong web nội bộ. Worker tự thử lại kết nối; sau khi bổ sung DLL có thể đợi tối đa khoảng 30 giây hoặc dừng/mở lại chương trình.

PART COUNT là bộ đếm trên CNC, không tự tăng giả. Báo cáo chỉ tích lũy từ lúc bản offline bắt đầu thu thập, hoặc từ file lịch sử nhập vào. Mất dữ liệu không được tính là máy chạy; khởi động lại tạo phiên thu thập mới. Chu kỳ START/STOP/HOLD là quan sát trạng thái, không xác nhận nút bấm hoặc M30. Thống kê không phải OEE có kế hoạch ca.

## 4. Chuyển dữ liệu từ website hiện tại

Không có dữ liệu công ty sẵn trong gói tải. Không tự truy cập/tải dữ liệu Firebase của công ty.

1. Khi có Internet, quản trị viên mở Firebase Console → Realtime Database → Data và **Export JSON tại gốc cơ sở dữ liệu**. Không phải Export Rules và không phải file Excel.
2. Chuyển file JSON đó sang máy chạy offline (USB hoặc cách nội bộ được công ty cho phép).
3. Đăng nhập admin bản offline, chọn **Khôi phục / nhập dữ liệu** ở góc dưới bên phải, chọn file, đọc xác nhận.
4. Nhập thay các nhánh dữ liệu có trong file: kho, máy, jobs, nhập/xuất, sửa chữa, hoạt động và lịch sử CNC. Những nhánh không có trong file được giữ. Trước nhập có bản sao tự động.
5. Tài khoản Firebase/khóa cấu hình không được nhập. Tài khoản nội bộ vẫn giữ nguyên; tạo lại những người cần dùng bằng nút **Tài khoản**.

Bản offline và online **không tự đồng bộ hai chiều**. Sau nhập, các thay đổi offline ở lại máy tính này. Không tự đẩy kho/job/trạng thái lên website công ty. Ảnh đã lưu dạng dữ liệu trong file sẽ dùng được; ảnh chỉ có liên kết Internet không thể tải khi offline và bị chính sách nội bộ chặn.

Dung lượng nhập qua giao diện tối đa 32 MiB. Nếu dữ liệu lớn hơn, cần phương án di chuyển riêng; không tự chia/xóa file cơ sở dữ liệu. File xuất nghiệp vụ có thể chứa thông tin sản xuất, cần lưu ở vị trí công ty cho phép.

## 5. Tài khoản và sao lưu

- **Tài khoản**: admin tạo email dạng tên đăng nhập, họ tên, mật khẩu riêng và role. Không cần email thật/xác minh mail.
- `viewer` chỉ xem và xuất báo cáo, không sửa kho/job/CNC. `technician` và `manager` làm nghiệp vụ; admin quản lý người dùng và sửa lịch sử sửa chữa theo quyền.
- Cập nhật quyền/khóa/đổi mật khẩu làm phiên của tài khoản đó hết hiệu lực; người dùng đăng nhập lại. Không được khóa/hạ quyền admin cuối cùng.
- **Sao lưu** tải toàn bộ dữ liệu nghiệp vụ thành JSON, không bao gồm mật khẩu hoặc danh sách tài khoản. Lưu bản sao ngoài máy tính định kỳ. Excel là báo cáo, không thay thế JSON backup để khôi phục.
- Cơ sở dữ liệu và tài khoản thật nằm tại **%LOCALAPPDATA%\LTD\CmmsOffline**. Cập nhật/giải nén lại gói chương trình không xóa thư mục này. Không xóa AppData để sửa lỗi đăng nhập.
- Mật khẩu nội bộ lưu bằng PBKDF2-SHA256 có salt, không lưu dạng rõ. File dữ liệu nghiệp vụ không mã hóa riêng; dùng quyền Windows và bảo vệ máy tính/tệp sao lưu.

Muốn sao lưu cả tài khoản/thiết lập worker bằng cách chép toàn bộ thư mục AppData: **dừng chương trình trước** và bảo vệ bản sao như dữ liệu riêng. File `accounts.json` và `.bak` không được chia sẻ công khai. Chuyển sang máy khác nên tạo admin mới rồi nhập JSON nghiệp vụ nếu không cần chuyển tài khoản.

## 6. Phạm vi nội bộ và giới hạn

- Bản này chỉ bind **127.0.0.1**, theo lựa chọn dùng trên máy tính thu thập trước; điện thoại/máy khác trong LAN chưa truy cập được. Không mở firewall hoặc port-forward để cố chia sẻ bản này.
- Không gọi Firebase/Google/CDN để đăng nhập hoặc tải giao diện. Toàn bộ JS/CSS/logo nằm trong gói.
- Không dùng API key, mật khẩu web công ty hay Firebase Rules. Không cần thay Rules online.
- Giữ các thao tác và mẫu báo cáo hiện có; chưa có tính năng dịch vụ nhiều máy chủ, giao dịch đồng thời nhiều người hoặc đồng bộ offline/online. Đây là bản đầu cho một máy tính; nên sao lưu trước khi dùng dữ liệu sản xuất.

## Lỗi thường gặp

- Không mở được trang: chương trình chưa chạy/đã dừng, hoặc cổng 8088 bị chiếm. Xem cửa sổ quản lý hoặc lỗi khởi động. Trường hợp phải dùng cổng khác, có thể chạy `Start-Offline.ps1 -Port 8089` trong thư mục gói; các quyền vẫn chỉ trên máy tính này.
- Báo dữ liệu bị khóa: kiểm tra khay hệ thống, không mở thêm bản thứ hai. Không xóa file lock khi chương trình còn chạy.
- Lỗi đọc database JSON: dừng chương trình, giữ nguyên file lỗi và kiểm tra `database.json.bak`/bản sao lưu. Không khởi tạo cơ sở dữ liệu trống đè lên dữ liệu cũ.
- CNC mất kết nối: kiểm tra LAN, IP/cổng, DLL và máy CNC có bật; không thay tham số CNC để thử một cách phỏng đoán.

## Đã kiểm tra ở đâu?

Đã chạy máy chủ/API và giao diện thật trong Chromium trên Linux với dữ liệu giả: đăng nhập nội bộ, sửa/lưu kho và job, quyền viewer, xuất XLSX, backup/import và giữ dữ liệu sau khởi động lại. Kiểm tra source C# với bộ reference .NET Framework 4.8/C# 5 và cú pháp PowerShell 5-compatible. Bộ thu thập báo cáo/alarm được kiểm tra với mẫu giả và giữ nguyên native Reader chỉ đọc.

**Chưa chạy trực tiếp WinForms/khay hệ thống trên Windows của anh hoặc kết nối CNC thật.** Cần thử trên máy tính thu thập trước khi coi là đã xác nhận tại xưởng. Không có dữ liệu demo giả được đóng gói vào cơ sở dữ liệu sản xuất mặc định.
