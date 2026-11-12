# LTD CMMS Desktop — 20261112-native

Đây là **ứng dụng Windows dùng giao diện WPF**, không mở trình duyệt, không dùng HTML/WebView và không mở cổng localhost. Logo LTD, điều hướng trái, bảng dữ liệu native và các cửa sổ nghiệp vụ được làm riêng cho desktop. Một file EXE khởi động phần mềm; bộ chạy dùng Windows PowerShell/.NET có sẵn, không cài máy chủ web.

## Bắt đầu

1. Đóng hẳn bản offline trước ở khay hệ thống. Không xóa thư mục dữ liệu.
2. Giải nén toàn bộ `LTD-CMMS-Desktop-20261112.zip` vào Desktop hoặc Documents.
3. Nhấp đúp **LTD-CMMS.exe**. Có thể tạo shortcut ra Desktop. Không chạy riêng file EXE khi các file đi kèm vẫn trong ZIP.
4. Nếu đã tạo tài khoản ở bản offline trước, dùng lại email/mật khẩu nội bộ. Nếu chưa có, màn hình đầu cho tạo admin mới; mật khẩu 12–128 ký tự và nhập lại để xác nhận. Có thể dùng tên dạng email bất kỳ hợp lệ, không cần Internet/mật khẩu Gmail.
5. Cửa sổ phải có tiêu đề **LTD CMMS Desktop · 20261112-native**.

Windows 10/11 **64-bit**, .NET Framework 4.8+ và Windows PowerShell 5.1. Không cần Python, Node, Excel để chạy hoặc xuất XLSX. Không cần tài khoản Firebase hay Internet. Nếu chính sách IT chặn ứng dụng/script, cần IT kiểm tra và cho phép gói; không tắt bảo vệ máy tính. Bản EXE này chưa ký chứng thư thương mại.

## Các mục chính

- **Tổng quan:** số vật tư, thiết bị, job đến hạn, CNC có tín hiệu và danh sách việc cần chú ý.
- **Kho:** bảng tồn gọn, tìm kiếm, thêm/sửa/xóa, chi tiết có ảnh và ghi chú; nhập/xuất bằng cửa sổ riêng. Tồn kho và phiếu giao dịch được ghi cùng một lần lưu, không cho xuất âm.
- **Danh sách máy:** tên/model/serial, ngày lắp, bảo hành và nhà cung cấp.
- **Bảo trì:** tạo/sửa job, chọn máy, chu kỳ, kỳ tiếp theo, phụ trách và checklist; hoàn tất kỳ tự tạo lịch sử và chuyển ngày theo lịch, xử lý cả cuối tháng. Không có nhắc email.
- **Sửa chữa:** xem lịch sử; admin có thể thêm/sửa/xóa. Người kỹ thuật tạo lịch sử thông qua hoàn tất bảo trì.
- **Nhập/xuất:** xem phiếu đã ghi, không sửa/xóa ledger.
- **CNC:** ô máy đổi xanh khi RUN, vàng dừng/HOLD, đỏ alarm, xám mất kết nối. Mở cửa sổ chi tiết để xem POSITION, PROGRAM, WORK, OFFSET, ALARM và chẩn đoán. Có alarm và bảng báo cáo chạy theo ngày/phiên riêng từng máy.
- **Tài khoản:** admin tạo người dùng nội bộ, phân quyền viewer/technician/manager/admin, khóa hoặc đổi mật khẩu; không được hạ/khóa admin cuối cùng. Người chỉ xem vẫn xuất báo cáo được.
- **Xuất Excel:** tạo file XLSX native có logo LTD, tiêu đề, bảng kẻ ô, lọc/sắp xếp, hàng xen kẽ và cấu hình trang A4 ngang. Không cần Microsoft Excel cài trên máy để tạo file.

Nhấp chọn bản ghi rồi dùng thanh công cụ; nhấp đúp để xem nội dung đầy đủ. Quyền được kiểm tra ở lớp dữ liệu trước khi ghi, không chỉ qua trạng thái nút.

## Dữ liệu cũ và sao lưu

Dùng cùng dữ liệu tại **%LOCALAPPDATA%\LTD\CmmsOffline**. Bản Desktop không xóa hoặc tạo lại tài khoản/dữ liệu đã có. Không mở đồng thời bản trình duyệt offline và Desktop trên cùng thư mục dữ liệu.

- **Sao lưu** tạo JSON nghiệp vụ, không xuất mật khẩu/hash tài khoản.
- **Nhập dữ liệu** nhận JSON backup nội bộ hoặc JSON xuất tại gốc Firebase. Nhập thay những nhánh có trong file; giữ tài khoản nội bộ. Có bản sao tự động trước nhập.
- Không tự đồng bộ với website online. Web công ty vẫn hoạt động độc lập và không đổi giao diện.
- Ảnh dạng dữ liệu PNG/JPG/BMP trong backup dùng được; không tải ảnh từ Internet.
- Dữ liệu nghiệp vụ chưa mã hóa riêng; cần bảo vệ tài khoản Windows và file sao lưu của công ty.

## Kết nối CNC

Chép 3 DLL 64-bit có bản quyền đang dùng vào `lib`: **Fwlib64.dll, fwlibe64.dll, fwlib30i64.dll**. Chỉ cần khi đọc CNC thật; kho/bảo trì không cần DLL.

Trong Giám sát CNC → Thêm mới, khai báo IP nội bộ, cổng (thường 8193), loại máy và bảng offset. Chỉ đánh dấu đối chiếu offset sau khi kiểm tra máy thật. Bộ thu thập tự chạy từng máy bằng tiến trình riêng. Chưa có dữ liệu thì để trống, không dùng số giả.

Không cần Internet nhưng vẫn phải có LAN/cáp nối máy tính và CNC. Reader giữ nguyên mã chỉ đọc đã dùng ở cầu nối: không PMC, không ghi offset/parameter/ladder và không điều khiển chạy/dừng máy. Bản Desktop này chưa bật truyền chương trình vào CNC hoặc đọc Haas.

WORK/OFFSET/PROGRAM phụ thuộc bộ điều khiển, cấu hình và chức năng được máy hỗ trợ. Bảng thời gian theo ngày/phiên là dữ liệu quan sát thực tế, không phải OEE hoặc xác nhận từng nút Cycle Start/M30. Giao diện thống kê desktop hiện dùng bảng; chưa chuyển toàn bộ biểu đồ của bản web sang WPF.

## Khi đóng phần mềm

Thu nhỏ cửa sổ để tiếp tục chạy. Bấm X sẽ hỏi xác nhận thoát; thoát hẳn sẽ dừng thu thập, không dừng CNC. Máy tính phải bật, không Sleep. Chưa cài dịch vụ Windows hoặc tự khởi động cùng Windows.

Nếu không mở được EXE, chạy **START-CMMS-CONSOLE.cmd** để thấy lỗi. Gửi thông báo/ảnh lỗi, không gửi mật khẩu hay accounts.json. Không xóa AppData để thử sửa lỗi. Khi đang có bản cũ chạy, mở bản mới sẽ báo thư mục bị khóa; đóng bản cũ trước.

## Kiểm chứng và giới hạn bản đầu

Đã kiểm tra logic đăng nhập/quyền, ghi dữ liệu, nhập/xuất nguyên tử, hoàn tất bảo trì, Excel với thư viện đọc XLSX độc lập, cú pháp PowerShell và cấu trúc XAML. EXE được biên dịch cho .NET Framework 4.8 / Windows x64. Không có trình duyệt, WebView, Firebase SDK, cổng web hoặc dữ liệu công ty trong gói.

**Chưa chạy trực tiếp WPF/EXE trên Windows của người dùng và chưa nối CNC thật.** Cần thử trên máy thu thập trước khi xác nhận vận hành tại xưởng. Đây là bản desktop đầu tiên; chưa phải sản phẩm đã nghiệm thu nhiều máy trạm/đa người dùng đồng thời.
