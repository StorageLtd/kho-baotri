# LTD CMMS

## Cài đặt bảo mật bắt buộc

1. Trong Firebase Console, bật **Authentication > Sign-in method > Email/Password**.
2. Tạo từng tài khoản bằng email công ty/cá nhân, gửi và hoàn tất xác minh email. Không tạo mật khẩu trong mã nguồn.
3. Điền Web App config vào `assets/js/firebase-config.js`.
4. Trong Realtime Database, tạo hồ sơ cho từng UID tại `users/<uid>`:
   `{ "displayName": "Nguyen Van A", "role": "technician" }`.
5. Dán nội dung `firebase/database.rules.json` vào tab **Rules** của Realtime Database và Publish.

Nếu email chưa xác minh, màn hình đăng nhập sẽ tự gửi lại liên kết xác minh. Hãy mở email, hoàn tất xác minh, rồi đăng nhập lại.

Vai trò: `admin` quản trị người dùng và dữ liệu; `manager` được chỉnh sửa nghiệp vụ; `technician` và `viewer` chỉ xem. Firebase Rules là lớp kiểm soát bắt buộc trên máy chủ, nên người dùng không thể vượt quyền chỉ bằng cách sửa trình duyệt.

## Chạy ứng dụng

Mở bằng máy chủ tĩnh, ví dụ `npx serve .`, vì JavaScript module không được trình duyệt cho phép chạy ổn định qua đường dẫn file trực tiếp.
