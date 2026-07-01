# 📚 Hướng Dẫn Cài Đặt - Lịch Sử & Hoạt Động Tài Khoản

## 🎯 Tổng Quan

Hệ thống theo dõi **Lịch sử đăng nhập thiết bị** và **Hoạt động tài khoản** đã được cài đặt thành công vào repository của bạn.

### ✨ Tính Năng Chính

- 📱 **Lịch sử đăng nhập** - Xem tất cả lần đăng nhập từ các thiết bị
- 📊 **Hoạt động tài khoản** - Theo dõi tất cả hành động (tạo, sửa, xóa)
- 💻 **Quản lý phiên** - Xem & kết thúc phiên hoạt động
- 🔍 **Tìm kiếm & Lọc** - Tìm kiếm theo từ khóa & ngày
- 🔒 **Phát hiện bảo mật** - Cảnh báo đăng nhập đáng ngờ

---

## 📦 Files Được Thêm

### Backend (API & Database)
```
api/
├── config.php              # Cấu hình database & bảo mật
├── LoginHistory.php        # Quản lý lịch sử đăng nhập
├── AccountActivity.php     # Quản lý hoạt động tài khoản
├── history-api.php         # API endpoints
└── database.sql            # Schema cơ sở dữ liệu
```

### Frontend (UI & JavaScript)
```
html/
└── history-page.html       # Giao diện trang lịch sử

js/
└── history-manager.js      # Quản lý UI & tương tác

database.sql               # Schema (root folder)
```

### Documentation
```
INTEGRATION_GUIDE.md       # Hướng dẫn tích hợp chi tiết
SETUP.md                   # File này
```

---

## 🚀 Hướng Dẫn Cài Đặt

### Step 1: Tạo Bảng Cơ Sở Dữ Liệu

```bash
# SSH vào server của bạn
ssh user@your-server

# Import database schema
mysql -u root -p your_database < api/database.sql
```

Hoặc sử dụng phpmyadmin:
1. Vào phpmyadmin
2. Chọn database của bạn
3. Vào tab SQL
4. Copy nội dung từ `api/database.sql` và chạy

### Step 2: Cấu Hình Database

Chỉnh sửa file `api/config.php`:

```php
// Line 2-5: Cấu hình database
define('DB_HOST', 'localhost');      // Địa chỉ MySQL server
define('DB_USER', 'root');           // Tên user MySQL
define('DB_PASS', 'password');       // Mật khẩu MySQL
define('DB_NAME', 'kho_baotri');     // Tên database
```

### Step 3: Tích Hợp Vào Trang Đăng Nhập

Tìm file xử lý đăng nhập của bạn (thường là `login.php` hoặc `auth.php`) và thêm:

```php
<?php
// Sau khi xác thực thành công
require_once 'api/LoginHistory.php';

$conn = getDBConnection();
$loginHistory = new LoginHistory($conn);

// Ghi lại lần đăng nhập
if ($authSuccess) {
    $loginHistory->recordLogin($userId, $username, 'success');
    $_SESSION['user_id'] = $userId;
    $_SESSION['username'] = $username;
}

// Ghi lại lần đăng nhập thất bại
else {
    $loginHistory->recordLogin($userId, $username, 'failed', 'Invalid credentials');
}
?>
```

### Step 4: Tích Hợp Logout

Trong file xử lý logout:

```php
<?php
session_start();
require_once 'api/LoginHistory.php';

if (isset($_SESSION['user_id'])) {
    $conn = getDBConnection();
    $loginHistory = new LoginHistory($conn);
    $loginHistory->recordLogout($_SESSION['user_id']);
    $conn->close();
}

session_destroy();
header('Location: index.html');
?>
```

### Step 5: Thêm Giao Diện Vào index.html

Thêm vào sidebar navigation:

```html
<button class="nav button" onclick="showPage('history')">
    📊 Lịch sử & Hoạt động
</button>
```

Thêm vào main content area (trước các page khác):

```html
<!-- History Page -->
<div id="history-content" class="content" hidden>
    <!-- Nội dung từ html/history-page.html -->
</div>
```

Tải JavaScript file:

```html
<script src="js/history-manager.js"></script>
```

### Step 6: Cập Nhật Hàm showPage

Thêm hoặc cập nhật hàm `showPage()` trong JavaScript:

```javascript
function showPage(page) {
    // Ẩn tất cả page
    document.querySelectorAll('[id$="-content"]').forEach(el => {
        el.hidden = true;
    });
    
    // Hiển thị page được chọn
    const pageEl = document.getElementById(page + '-content');
    if (pageEl) {
        pageEl.hidden = false;
        
        // Tải dữ liệu nếu là trang history
        if (page === 'history' && window.historyManager) {
            historyManager.loadLoginHistory();
        }
    }
}
```

---

## 📝 Ghi Log Hoạt Động

### Ghi Log Tạo Mới

```php
<?php
require_once 'api/AccountActivity.php';

$conn = getDBConnection();
$activity = new AccountActivity($conn);

$newMachine = [
    'name' => 'CNC Machine A',
    'model' => 'FANUC 0iF',
    'status' => 'operational'
];

$activity->logActivity(
    $_SESSION['user_id'],
    $_SESSION['username'],
    'create',                              // activity_type
    'Created new machine: CNC Machine A',  // description
    'inventory',                           // module
    $machineId,                            // resource_id
    'machine',                             // resource_type
    null,                                  // old_value
    $newMachine,                           // new_value
    'success'                              // status
);
?>
```

### Ghi Log Sửa Đổi

```php
<?php
$oldStatus = 'pending';
$newStatus = 'completed';

$activity->logActivity(
    $_SESSION['user_id'],
    $_SESSION['username'],
    'update',
    'Updated maintenance job status',
    'maintenance',
    $jobId,
    'job',
    ['status' => $oldStatus],
    ['status' => $newStatus],
    'success'
);
?>
```

### Ghi Log Xóa

```php
<?php
$activity->logActivity(
    $_SESSION['user_id'],
    $_SESSION['username'],
    'delete',
    'Deleted spare part',
    'inventory',
    $partId,
    'part',
    $deletedPartData,
    null,
    'success'
);
?>
```

### Ghi Log Lỗi

```php
<?php
$activity->logActivity(
    $_SESSION['user_id'],
    $_SESSION['username'],
    'export',
    'Failed to export report',
    'reports',
    null,
    'report',
    null,
    null,
    'failed',
    'Insufficient permissions'
);
?>
```

---

## 🔧 API Endpoints

### Login History

```
GET  /api/history-api.php?action=get-login-history&limit=50&offset=0
GET  /api/history-api.php?action=get-suspicious-logins&days=7
GET  /api/history-api.php?action=get-active-sessions
POST /api/history-api.php?action=terminate-session&session_id=123
```

### Account Activity

```
GET  /api/history-api.php?action=get-activity-history&limit=50
GET  /api/history-api.php?action=get-activity-summary&days=30
GET  /api/history-api.php?action=get-failed-activities&limit=50
GET  /api/history-api.php?action=search-activities&keyword=search
GET  /api/history-api.php?action=get-resource-history&resource_id=123&resource_type=machine
```

---

## ⚙️ Cấu Hình Bảo Mật

Trong file `api/config.php`, bạn có thể điều chỉnh:

```php
define('MAX_LOGIN_ATTEMPTS', 5);           // Số lần thử đăng nhập tối đa
define('LOCKOUT_DURATION', 900);           // Thời gian khóa (giây) = 15 phút
define('MAX_HISTORY_DAYS', 90);            // Lưu lịch sử tối đa (ngày)
define('SUSPICIOUS_LOGIN_THRESHOLD', 3);   // Ngưỡng cảnh báo (lần thất bại)
```

---

## 🗄️ Cấu Trúc Database

### Bảng: login_history
- Lưu tất cả lần đăng nhập
- Fields: user_id, device_name, ip_address, browser_info, location, login_time, logout_time

### Bảng: account_activity
- Lưu tất cả hoạt động tài khoản
- Fields: user_id, activity_type, action_description, old_value, new_value, status

### Bảng: trusted_devices
- Danh sách thiết bị đã tin tưởng
- Fields: user_id, device_id, device_name, last_login

### Bảng: security_alerts
- Cảnh báo bảo mật
- Fields: user_id, alert_type, severity, is_resolved

---

## 🐛 Xử Lý Lỗi

### Lỗi: "Connection failed: Unknown database"
```
✓ Kiểm tra tên database trong config.php
✓ Kiểm tra database có tồn tại không
✓ Chạy lại import: mysql -u root -p < api/database.sql
```

### Lỗi: "Table doesn't exist"
```
✓ Chạy file database.sql để tạo bảng
✓ Kiểm tra quyền của user MySQL
✓ Xác minh database schema được import
```

### Lỗi: "Unauthorized" khi gọi API
```
✓ Kiểm tra session_start() trong tất cả file PHP
✓ Kiểm tra $_SESSION['user_id'] được set sau login
✓ Kiểm tra cookies được gửi từ client
```

---

## 📊 Ví Dụ Sử Dụng

### Xem lịch sử đăng nhập

```javascript
// Sẽ tự động tải khi bạn navigate tới trang history
historyManager.loadLoginHistory();

// Hoặc gọi trực tiếp API
fetch('api/history-api.php?action=get-login-history&limit=50')
    .then(r => r.json())
    .then(data => console.log(data));
```

### Tìm kiếm hoạt động

```javascript
historyManager.searchActivities('machine maintenance');
```

### Lọc hoạt động

```javascript
// Click nút "Lọc" trong giao diện
// Hoặc gọi trực tiếp
fetch('api/history-api.php?action=get-activity-history&activity_type=create&status=success')
    .then(r => r.json())
    .then(data => console.log(data));
```

### Kết thúc phiên

```javascript
// Click nút X trên phiên hoạt động
// Hoặc gọi trực tiếp
historyManager.terminateSession(sessionId);
```

---

## 🔐 Best Practices

1. **Luôn ghi log hoạt động quan trọng**
   - Tạo/sửa/xóa dữ liệu
   - Đăng nhập thất bại
   - Thay đổi quyền truy cập

2. **Định kỳ xem xét lịch sử**
   - Kiểm tra lịch sử đăng nhập hàng tuần
   - Tìm kiếm hoạt động đáng ngờ
   - Kết thúc phiên không xác định

3. **Backup lịch sử định kỳ**
   - Export lịch sử hàng tháng
   - Lưu trữ an toàn
   - Tuân thủ quy định pháp luật

4. **Giám sát bảo mật**
   - Kiểm tra nhiều lần thất bại
   - Giám sát địa chỉ IP lạ
   - Cấp cảnh báo cho quản trị viên

---

## 📞 Hỗ Trợ

Nếu gặp vấn đề:

1. Kiểm tra file log: `error_log` hoặc `php_error.log`
2. Kiểm tra MySQL logs
3. Xác minh cấu hình trong `api/config.php`
4. Chạy lại `database.sql` để tạo bảng
5. Kiểm tra quyền file trên server

---

## 📄 Tài Liệu Thêm

- **INTEGRATION_GUIDE.md** - Hướng dẫn tích hợp chi tiết
- **database.sql** - Schema cơ sở dữ liệu đầy đủ
- **api/config.php** - Cấu hình tất cả các thông số

---

**Cài đặt hoàn thành! 🎉**

Bây giờ bạn có thể:
- ✅ Theo dõi lịch sử đăng nhập
- ✅ Ghi log hoạt động tài khoản
- ✅ Quản lý phiên hoạt động
- ✅ Tìm kiếm và lọc dữ liệu
- ✅ Phát hiện hoạt động bảo mật

Happy coding! 🚀
