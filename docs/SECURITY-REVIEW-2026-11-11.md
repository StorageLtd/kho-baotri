# Rà soát bảo mật LTD CMMS — 11/11/2026

## Phạm vi và trạng thái

Đã kiểm tra mã web, Rules Realtime Database trong repository và cơ chế xác thực của tiện ích truyền chương trình. Không truy cập hoặc điều khiển CNC thật; không tạo tài khoản thử trên Firebase sản xuất và không tải dữ liệu sản xuất. Kiểm tra REST không đăng nhập không thực hiện thành công do lỗi kết nối từ môi trường kiểm tra, nên **chưa xác nhận Rules đang chạy hoặc dữ liệu có bị công khai hay không**.

Thay đổi web được phát hành qua GitHub Pages. **Rules trong GitHub chưa tự áp dụng lên Firebase**. Cần quản trị viên đối chiếu và Publish Rules trên đúng dự án `ltdst-80b3e`. Chưa thể kết luận hệ thống sản xuất đã an toàn chỉ vì web đã cập nhật.

## Phát hiện và thay đổi

| Phát hiện trong mã | Thay đổi | Giới hạn |
|---|---|---|
| Tự đăng ký được tạo hồ sơ technician, có quyền vận hành | Hồ sơ mới và hồ sơ thiếu được tạo với role `pending`; web từ chối mở ứng dụng đến khi được duyệt | Phải Publish Rules mới để chặn truy cập API trực tiếp; tài khoản technician đã tồn tại phải được rà soát riêng |
| Một số nhánh chỉ yêu cầu đăng nhập để đọc, thiếu xác minh email/quyền thành viên | Rules dự thảo yêu cầu email đã xác minh, vai trò được cấp và không bị disabled; viewer chỉ xem | Chưa triển khai lên Firebase thật |
| ID dữ liệu được ghép vào thuộc tính onclick | Thay bằng data attributes đã escape và bộ xử lý sự kiện có danh sách hành động cố định; escape thêm số liệu/ngày không hợp lệ | Đây không phải kiểm toán đầy đủ mọi kiểu dữ liệu/chuỗi xuất báo cáo |
| Thiếu chính sách hạn chế script | Thêm CSP chặn script nội tuyến/eval, object và form submission; referrer `no-referrer` | GitHub Pages không cho đặt đầy đủ HTTP headers; chống nhúng bằng frame-ancestors cần hosting cho cấu hình response headers |
| Phiên Firebase mặc định có thể được lưu lâu trên trình duyệt | Dùng browser session persistence; xóa quyền cache khi đăng xuất | Không tự thu hồi refresh token trên máy bị mất; cần Firebase Console/Admin SDK |
| Lịch sử tài khoản của chính người dùng có thể bị ghi đè | Rules mới chỉ cho tạo thêm từng bản ghi tài khoản, không sửa/xóa | Vẫn là lịch sử do client gửi, không phải audit log tin cậy từ máy chủ |

Rules giữ các vai trò hiện có `admin`, `manager`, `technician`, `viewer`, bổ sung `pending` và cờ `disabled: true`. Không tự hạ quyền người đang làm việc. Bổ sung nhánh `stockMovements` đã được ứng dụng sử dụng nhưng chưa có trong file Rules cũ. Bản fragment báo cáo được đồng bộ với cùng điều kiện thành viên.

## Áp dụng Rules và duyệt tài khoản

1. Vào Firebase Console → Realtime Database → Rules, sao lưu toàn bộ Rules đang chạy trước.
2. Đối chiếu với [database.rules.json](../firebase/database.rules.json). Nếu có nhánh dữ liệu hoặc điều kiện riêng ngoài bản này, hợp nhất chúng; không xóa nhánh riêng chỉ để thay toàn bộ bằng file trong repository.
3. Kiểm tra tài khoản quản trị hiện tại có `users/<UID>/role = "admin"`, email đã xác minh và không có `disabled: true`. Không sửa dữ liệu CNC.
4. Dùng Rules Playground kiểm tra: khách không đăng nhập bị từ chối; pending bị từ chối dữ liệu công ty; tài khoản chưa xác minh/bị disabled bị từ chối; viewer đọc được nhưng không ghi; technician được cấp quyền đọc/ghi nghiệp vụ; technician không sửa được role; admin có thể duyệt tài khoản. Kiểm tra cả telemetry, alarm, báo cáo và nhập/xuất kho.
5. Publish Rules đã hợp nhất, sau đó kiểm tra bridge vẫn gửi telemetry/báo cáo bằng tài khoản đã được cấp quyền. Không cần đổi native DLL hoặc tham số CNC.
6. Duyệt người mới tại Realtime Database → Data → `users/<UID>`: kiểm tra email/nhân sự, đổi `pending` thành vai trò phù hợp. Ưu tiên viewer cho người chỉ xem. Không cấp admin đại trà. Tài khoản đã tự đăng ký từ trước cần kiểm tra lại, vì không có bằng chứng xác định ai đã được duyệt thủ công trong schema cũ.
7. Để khóa truy cập dữ liệu: đặt `disabled: true` trong hồ sơ với Rules mới. Với nhân sự nghỉ việc hoặc nghi lộ mật khẩu, đồng thời disable tài khoản Authentication và thu hồi phiên bằng công cụ quản trị; đăng xuất bridge dùng tài khoản đó.

## Các việc cần quản trị viên thực hiện thêm

- Đổi mật khẩu truyền/nhận ngắn hoặc dùng chung (mật khẩu 6 ký tự hiện tại không đủ mạnh). Đặt mật khẩu riêng dài ít nhất 12–16 ký tự trong Manager; dừng tiện ích truyền trước khi đổi rồi đăng nhập lại. Repository/ZIP không chứa mật khẩu mặc định; tiện ích lưu PBKDF2-SHA256 có salt và giới hạn thử sai. Chưa thay đổi mật khẩu trên laptop của người dùng.
- Bật xác thực hai bước cho GitHub, Google/Firebase quản trị; kiểm tra cộng tác viên và token truy cập repository. Cân nhắc MFA người dùng nếu gói Firebase/Identity Platform hỗ trợ.
- Cấu hình chính sách mật khẩu và bảo vệ chống dò email trong Firebase Authentication nếu khả dụng. Giới hạn authorized domains vào các miền thật sự sử dụng.
- Firebase Web API key là thông tin định danh ứng dụng công khai, không thay cho Rules. Kiểm tra API restrictions/quota trong Google Cloud, không giấu API key rồi coi như đã bảo vệ dữ liệu.
- Không mở cổng FOCAS 8193 ra Internet. Tiện ích truyền chương trình hiện lắng nghe loopback `127.0.0.1:8766`, kiểm tra Origin, mật khẩu riêng, phiên và máy đã khai báo; không mở listener này ra toàn LAN khi chưa thiết kế xác thực phù hợp.
- App Check có thể bổ sung sau, nhưng phải thiết kế tương thích bridge PowerShell/REST trước khi enforce, tránh cắt kết nối sản xuất.
- Nếu cần bảo vệ mã giao diện khỏi sao chép: web công khai vẫn tải HTML/JS về trình duyệt kể cả repository private. Logic đặc quyền cần ở backend; dữ liệu riêng cần Rules, không dựa vào việc ẩn nút hay mã nguồn.

## Kiểm chứng

- `node --test tests/security-rules.test.mjs tests/auth-security.test.mjs`: mô phỏng predicates Rules và SDK đăng nhập, kiểm tra quyền âm/dương, pending/disabled/xác minh email và phiên. Đây **không phải Firebase Rules emulator** hoặc kiểm chứng deployment thực tế.
- `python tests/security-browser.py`: Chromium không bypass CSP; dữ liệu giả chứa ký tự chèn mã không thực thi, thao tác sửa qua data attributes vẫn hoạt động, script inline bị chặn.
- `python tests/cnc-browser-smoke.py`: hồi quy giao diện/telemetry/export/truyền bằng fixtures; CSP bypass chỉ trong test này để Playwright giả lập clock/eval, CSP thực được kiểm riêng ở test trên.
- Không phát hiện chuỗi mật khẩu truyền mặc định hay khóa riêng/service-account trong các file văn bản đang theo dõi qua lượt quét mẫu. Đây không phải kiểm tra toàn bộ lịch sử Git hoặc xác nhận không có bí mật trong mọi tệp nhị phân.
