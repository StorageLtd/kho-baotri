# LTD CMMS

## Cài đặt bảo mật bắt buộc

1. Trong Firebase Console, bật **Authentication > Sign-in method > Email/Password**.
2. Tạo từng tài khoản bằng email công ty/cá nhân, gửi và hoàn tất xác minh email. Không tạo mật khẩu trong mã nguồn.
3. Điền Web App config vào `assets/js/firebase-config.js`.
4. Trong Realtime Database, tạo hồ sơ cho từng UID tại `users/<uid>`:
   `{ "displayName": "Nguyen Van A", "role": "technician" }`.
5. Dán nội dung `firebase/database.rules.json` vào tab **Rules** của Realtime Database và Publish.

Nếu email chưa xác minh, màn hình đăng nhập sẽ tự gửi lại liên kết xác minh. Hãy mở email, hoàn tất xác minh, rồi đăng nhập lại.

## Vận hành CMMS

- Ứng dụng yêu cầu đăng nhập lại mỗi khi trang được mở; phiên Firebase cũ được đóng chủ động.
- `accountHistory/<uid>` lưu tạo tài khoản, đăng nhập và đăng xuất của từng tài khoản.
- `deviceHistory` lưu lịch sử thao tác CMMS: thêm, sửa, xóa và nhập/xuất dữ liệu.
- `admin`, `manager` và `technician` đều được thao tác nghiệp vụ; `viewer` chỉ có quyền xem. Chỉ `admin` được quản lý tài khoản và phân quyền.
- Sau mỗi lần thay đổi, upload lại `index.html`, `assets/css/app.css`, `assets/js/app.js`, `assets/js/auth.js` và publish lại Firebase Rules.

Vai trò: `admin` quản trị người dùng và dữ liệu; `manager` được chỉnh sửa nghiệp vụ; `technician` và `viewer` chỉ xem. Firebase Rules là lớp kiểm soát bắt buộc trên máy chủ, nên người dùng không thể vượt quyền chỉ bằng cách sửa trình duyệt.

## Chạy ứng dụng

Mở bằng máy chủ tĩnh, ví dụ `npx serve .`, vì JavaScript module không được trình duyệt cho phép chạy ổn định qua đường dẫn file trực tiếp.

## Cầu nối máy CNC Neway 1260S

- Tải [gói Windows](downloads/Neway-1260S-Bridge.zip), đọc [hướng dẫn](tools/fanuc-bridge/README-VI.txt).
- Cầu nối chỉ đọc thông tin/trạng thái CNC, đăng nhập Firebase bằng tài khoản CMMS đã xác minh và PATCH riêng `cncs/neway-1260s`. Không đóng kèm DLL hoặc thông tin đăng nhập.
- Dữ liệu FOCAS thật có nhãn riêng và hết hạn sau 30 giây không nhận tín hiệu mới. Không tự tạo số liệu mô phỏng khi thêm máy. Các bản ghi cũ chưa rõ nguồn vẫn được giữ nhưng không coi là tín hiệu thật.
- Cầu nối đọc thêm tốc độ trục chính/chạy dao thực tế (đúng đơn vị và số thập phân), số O hiện tại/chính; API tùy chọn lỗi không làm mất trạng thái cơ bản. Tốc độ đặt, override, dòng lệnh NC, bộ đếm và alarm chi tiết chưa được đọc.
- Kiểm thử: `node --test tests/cnc-status.test.mjs`, `pwsh -NoProfile -File tests/fanuc-bridge.Tests.ps1`, `pwsh -NoProfile -File tests/fanuc-reader.Tests.ps1`, `python3 tests/cnc-browser-smoke.py` (cần Playwright/Chromium). Các kiểm thử dùng dữ liệu giả, không truy cập CNC hoặc Firebase thật.
