# LTD — Nhắc bảo trì qua Gmail / Google Apps Script

Bản 12/11/2026. Không cần bật laptop hay mở web sau khi cài xong. Chưa tự triển khai vào tài khoản Google của người dùng; không chứa mật khẩu và không gửi mail khi tải/cài mã nguồn.

## Hành vi

- Mỗi giờ kiểm tra lịch; chỉ gửi từ 08:00 giờ Việt Nam trở đi. Thời điểm trigger Google có thể xê dịch, không cam kết đúng 08:00.
- Chỉ job có bật **Nhắc qua email khi đến hạn**, có email hợp lệ và đã đến hạn mới được gửi.
- Gửi cho email người phụ trách; CC tối đa một email quản lý nếu khai báo. Hai địa chỉ giống nhau chỉ tính một người nhận.
- Một job / một ngày kỳ hạn được gửi một lần. Không có job đến hạn thì không gửi thư. Đổi tên/người nhận sau khi đã gửi không gửi lại kỳ đó. Khi hoàn tất job, web cập nhật kỳ kế tiếp; đến kỳ mới mới có thư mới.
- Job bị xóa/tắt nhắc/chuyển sang ngày khác trước lượt kiểm tra được bỏ qua. Script kiểm tra lại job ngay trước gửi; thay đổi xảy ra đồng thời sau lần kiểm tra cuối vẫn có thể đi cùng một thư đã bắt đầu gửi.
- Khi cài lần đầu, `START_DATE` là ngày cài (giờ Việt Nam): không gửi dồn những job đã quá hạn từ trước. Lỗi trigger/quota sau ngày bắt đầu sẽ được kiểm tra bù ở lần chạy sau, khi job vẫn giữ kỳ hạn đó.
- Gmail cá nhân qua Apps Script thường giới hạn 100 người nhận/ngày, dùng chung với các script khác của người gửi. Workspace có hạn mức khác. Script tự kiểm tra hạn mức; hết hạn mức thì chờ lượt sau, không tạo bản ghi đã gửi giả.
- Giữ nguyên nội dung job trong email, không đính kèm chương trình CNC hoặc thông tin xác thực.

## 1. Chọn tài khoản Gmail gửi

Dùng một Gmail của công ty để tạo dự án tại https://script.google.com/ . Mail gửi từ tài khoản Google cài trigger. Không cần cung cấp mật khẩu Gmail cho website hoặc người hỗ trợ.

Chỉ chia sẻ quyền sửa dự án Apps Script cho người quản trị tin cậy: người sửa dự án có thể đọc Script Properties và thay mã.

## 2. Áp dụng Firebase Rules mới

Trong Firebase dự án `ltdst-80b3e`, sao lưu Rules đang dùng rồi thay tại **Realtime Database → Rules** bằng file `LTD-Firebase-Rules-20261112-Email.json` trong gói. Publish. **Không import Rules vào Data**.

Bản này bổ sung role **notifier** và nhánh `maintenanceMailDeliveries`. Giữ các nhánh và giới hạn đã đối chiếu ngày 11/11: viewer không ghi kho/job; phiếu kho chỉ tạo mới; chỉ admin sửa/xóa lịch sử sửa chữa; telemetry/báo cáo CNC giữ quyền như trước. Nếu đã tự sửa thêm Rules sau ngày 11/11, cần hợp nhất các thay đổi riêng trước khi thay.

Kiểm tra tài khoản admin và bridge vẫn có quyền sau khi Publish; không đổi role tài khoản admin hoặc tài khoản cầu nối thành notifier.

## 3. Tạo tài khoản Firebase riêng cho bộ nhắc

1. Trong **Authentication → Users → Add user**, tạo một tài khoản email/password riêng. Có thể dùng một hộp thư dành cho nhắc lịch; hoặc địa chỉ Gmail có dấu `+` như `tencongty+nhaclich@gmail.com` nếu hộp thư của anh hỗ trợ. Không dùng mật khẩu Gmail; đặt mật khẩu Firebase riêng đủ mạnh.
2. Xác minh email: thử đăng nhập tài khoản mới trên web LTD một lần; nếu email chưa xác minh, web gửi liên kết xác minh rồi đăng xuất. Mở thư, bấm liên kết. Không cần tài khoản này đăng nhập giao diện CMMS sau đó.
3. Sao chép UID ở Authentication, tạo hồ sơ tại **Realtime Database → Data → users → UID**:

```json
{
  "displayName": "LTD Email Reminder",
  "email": "email-tai-khoan-firebase-rieng@example.com",
  "role": "notifier"
}
```

Email phải đúng với tài khoản mới. Không có `disabled: true`. Role notifier chỉ được đọc jobs và ghi nhật ký gửi; không được đọc kho/CNC hoặc sửa lịch. Vì vậy tài khoản này không mở được ứng dụng web như người dùng thông thường — đây là hành vi chủ đích.

## 4. Tạo Apps Script và cấu hình riêng

1. Tại https://script.google.com/ chọn **New project / Dự án mới**, đặt tên `LTD Nhac Bao Tri`.
2. Mở file `Code.gs` mặc định, thay toàn bộ bằng nội dung file **LTD-Maintenance-Email.gs** trong gói tải về. Đây là một file đã gộp đủ lõi và bộ chạy; không dán thêm bản ReminderCore/Code lần nữa.
3. Mở **Project Settings / Cài đặt dự án**, bật hiển thị `appsscript.json` trong editor. Mở file manifest và thay bằng `appsscript.json` trong gói. Dùng V8, múi giờ Asia/Ho_Chi_Minh.
4. Trong **Project Settings → Script Properties → Add script property**, thêm:

| Property | Giá trị |
|---|---|
| `FIREBASE_API_KEY` | Web API key trong Firebase Project settings; cũng có tại assets/js/firebase-config.js của website. Đây là định danh công khai, không phải mật khẩu. |
| `FIREBASE_DATABASE_URL` | `https://ltdst-80b3e-default-rtdb.asia-southeast1.firebasedatabase.app` |
| `FIREBASE_EMAIL` | Email Firebase riêng ở bước 3 |
| `FIREBASE_PASSWORD` | Mật khẩu Firebase riêng ở bước 3; không phải mật khẩu Google/Gmail |
| `SITE_URL` | `https://storageltd.github.io/kho-baotri/` |

Không đặt mật khẩu trong file .gs, HTML/JS web, GitHub hoặc URL. Không cần service-account key, database secret hay mở Rules công khai. Phiên Firebase được tạo riêng mỗi lượt chạy, không ghi token vào log.

## 5. Kiểm tra chưa gửi và bật lịch

1. Chọn hàm **previewMaintenanceReminders** → Run. Google yêu cầu cấp quyền cho dự án của chính anh: truy cập dịch vụ ngoài, gửi email và quản lý trigger. Bản preview **không gửi mail và không ghi nhật ký gửi**; trả số job đủ điều kiện, ngày bắt đầu và hạn mức còn lại.
2. Nếu HTTP 400: kiểm tra email/mật khẩu Firebase và API key. Nếu HTTP 401/403: kiểm tra Rules đã Publish, email đã xác minh, UID/role notifier. Không gửi mật khẩu/token khi báo lỗi.
3. Chạy **installMaintenanceReminder** một lần. Hàm tạo trigger mỗi giờ, ghi ngày bắt đầu và bật kiểm tra. Cài lại không tạo trùng trigger và không xóa lịch sử gửi.
4. Muốn ngừng: chạy **stopMaintenanceReminder**. Không xóa job hay nhật ký.

**Không cần Deploy / Web app**. Không công khai Apps Script thành một endpoint. Trigger chạy bằng tài khoản Google đã cài; không cần mở trình duyệt hay laptop.

## 6. Bật trên từng job và thử thật có kiểm soát

Trên web LTD, Ctrl+F5 → Lịch bảo trì → sửa một job thử:

- Bật **Nhắc qua email khi đến hạn**.
- Nhập email người phụ trách; CC quản lý nếu cần.
- Đặt ngày kỳ tới từ ngày cài đặt trở đi, lưu thành công.

Để thử gửi thật, dùng một job thử và email của chính anh, ngày hôm nay; từ 08:00 trở đi, chạy **runMaintenanceReminders** thủ công hoặc chờ trigger. Kiểm tra hộp thư đến/spam và mục Sent của Gmail gửi. Chạy lại không được có thêm thư của cùng kỳ. Sau khi thử, tắt nhắc hoặc xóa job thử. Việc chạy hàm này khi có job thật đủ điều kiện sẽ gửi mail thật cho người phụ trách tương ứng.

Mở link trong email cần đăng nhập web và có quyền; link đưa đến đúng job. Không chứa token hay mật khẩu trong link.

## Theo dõi lỗi và tránh gửi trùng

Trong **Apps Script → Executions**, mỗi lượt trả thống kê `sent`, `duplicate`, `quota`, `cancelled`, `uncertain`. Không ghi mật khẩu/token. Nhật ký lâu dài ở Firebase `maintenanceMailDeliveries/<jobId>/<ngày-kỳ-hạn>`:

- `sent`: dịch vụ Gmail đã chấp nhận lệnh gửi. Không đảm bảo người nhận đã mở thư hoặc thư không vào spam.
- `cancelled`: đã đặt chỗ nhưng job thay đổi trước gửi; chưa gửi, có thể kiểm tra lại an toàn.
- `reserved` còn lâu hoặc `uncertain`: có sự cố giữa các bước. **Không tự gửi lại**, để tránh trường hợp Gmail đã gửi nhưng xác nhận lưu Firebase bị lỗi.

Không có giao dịch nguyên tử giữa MailApp và Firebase, nên không thể hứa vừa không mất thư vừa tuyệt đối không trùng trong mọi sự cố. Với reserved/uncertain, quản trị viên kiểm tra Sent trước; không xóa toàn bộ nhật ký để thử lại. Chỉ xử lý một bản ghi sau khi biết thư đã/ chưa được gửi. Đây là đánh đổi ưu tiên tránh gửi trùng.

Không đổi ngày kỳ tới rồi đổi về ngày đã gửi với mục đích gửi lại: ngày đó vẫn có nhật ký và không được tự nhắc lại. Không có nhắc quá hạn mỗi ngày hoặc nhắc lặp lại ở bản này.

## Kiểm thử của bản cung cấp

Đã có kiểm thử cô lập bằng Firebase/MailApp giả lập cho điều kiện đến hạn, múi giờ, người nhận/CC, quota, ETag chống gửi trùng giữa các bản script, lỗi gửi/lưu, đổi lịch và nội dung HTML. Chưa truy cập tài khoản Google của người dùng, chưa cài trigger thật và chưa gửi email thật. File Rules cũng cần chủ hệ thống Publish trước khi chức năng hoạt động.
