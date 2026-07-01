# Hướng dẫn tích hợp Lịch sử & Hoạt động

## Tổng quan

Hệ thống theo dõi lịch sử đăng nhập và hoạt động tài khoản cho phép:
- 📱 Xem lịch sử đăng nhập từ các thiết bị
- 📊 Theo dõi tất cả hoạt động tài khoản
- 💻 Quản lý các phiên hoạt động
- 🔒 Phát hiện hoạt động đáng ngờ

## Các file được thêm

### Backend
- `api/config.php` - Cấu hình cơ sở dữ liệu và bảo mật
- `api/LoginHistory.php` - Lớp quản lý lịch sử đăng nhập
- `api/AccountActivity.php` - Lớp quản lý hoạt động tài khoản
- `api/history-api.php` - API endpoint cho lịch sử

### Database
- `api/database.sql` - Schema cơ sở dữ liệu

### Frontend
- `js/history-manager.js` - Quản lý UI lịch sử
- `html/history-page.html` - Giao diện trang lịch sử

## Hướng dẫn cài đặt

### 1. Tạo bảng cơ sở dữ liệu

```bash
mysql -u root -p your_database < api/database.sql
```

### 2. Cập nhật config.php

```php
define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', 'your_password');
define('DB_NAME', 'kho_baotri');
```

### 3. Tích hợp vào trang login

Trong file xử lý đăng nhập hiện tại của bạn:

```php
<?php
require_once 'api/LoginHistory.php';

// Sau khi xác thực thành công
if (authenticated) {
    $conn = getDBConnection();
    $loginHistory = new LoginHistory($conn);
    $loginHistory->recordLogin($userId, $username, 'success');
    session_start();
    $_SESSION['user_id'] = $userId;
}

// Khi đăng xuất
session_start();
if (isset($_SESSION['user_id'])) {
    $loginHistory->recordLogout($_SESSION['user_id']);
}
?>
```

### 4. Ghi log hoạt động

Bất cứ khi nào bạn muốn ghi lại một hoạt động:

```php
<?php
require_once 'api/AccountActivity.php';

$conn = getDBConnection();
$activity = new AccountActivity($conn);

// Ghi log tạo thiết bị
$activity->logActivity(
    $userId,
    $username,
    'create',  // activity_type
    'Created new machine',
    'inventory',  // module_name
    $machineId,
    'machine',
    null,
    $newMachineData,
    'success'
);

// Ghi log cập nhật
$activity->logActivity(
    $userId,
    $username,
    'update',
    'Updated machine status',
    'maintenance',
    $jobId,
    'job',
    ['status' => 'pending'],
    ['status' => 'completed'],
    'success'
);

// Ghi log xóa
$activity->logActivity(
    $userId,
    $username,
    'delete',
    'Deleted spare part',
    'inventory',
    $partId,
    'part',
    $oldPartData,
    null,
    'success'
);

// Ghi log thất bại
$activity->logActivity(
    $userId,
    $username,
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

### 5. Thêm giao diện vào index.html

Thêm vào navigation sidebar:

```html
<button class="nav button" onclick="showPage('history')">
    <svg><!-- history icon --></svg>
    Lịch sử & Hoạt động
</button>
```

Thêm vào main content area:

```html
<div id="history-page" class="page-content" hidden>
    <!-- Include content from html/history-page.html -->
</div>
```

Tải JavaScript:

```html
<script src="js/history-manager.js"></script>
```

### 6. Cập nhật chuyển trang

Thêm hàm showPage để chuyển đến trang lịch sử:

```javascript
function showPage(page) {
    document.querySelectorAll('.page-content').forEach(el => {
        el.hidden = true;
    });
    
    const pageEl = document.getElementById(page + '-content');
    if (pageEl) {
        pageEl.hidden = false;
        if (page === 'history') {
            historyManager.loadLoginHistory();
        }
    }
}
```

## API Endpoints

### Login History
- `GET /api/history-api.php?action=get-login-history&limit=50&offset=0`
- `GET /api/history-api.php?action=get-suspicious-logins&days=7`
- `GET /api/history-api.php?action=get-active-sessions`
- `POST /api/history-api.php?action=terminate-session` (session_id)

### Account Activity
- `GET /api/history-api.php?action=get-activity-history&limit=50&offset=0`
- `GET /api/history-api.php?action=get-activity-summary&days=30`
- `GET /api/history-api.php?action=get-failed-activities&limit=50`
- `GET /api/history-api.php?action=search-activities&keyword=search`
- `GET /api/history-api.php?action=get-resource-history&resource_id=123&resource_type=machine`

## Cấu hình bảo mật

Trong `api/config.php`:

```php
define('MAX_LOGIN_ATTEMPTS', 5);           // Số lần thử tối đa
define('LOCKOUT_DURATION', 900);            // Thời gian khóa (giây)
define('MAX_HISTORY_DAYS', 90);             // Giữ lịch sử tối đa (ngày)
define('SUSPICIOUS_LOGIN_THRESHOLD', 3);    // Ngưỡng đáng ngờ
```

## Tính năng nâng cao

### Cảnh báo bảo mật
- Phát hiện đăng nhập từ vị trí mới
- Cảnh báo về nhiều lần thất bại
- Kiểm tra thiết bị lạ

### Báo cáo
- Báo cáo hoạt động hàng ngày
- Báo cáo thay đổi dữ liệu
- Báo cáo xác thực

### Xuất dữ liệu
- Xuất lịch sử đăng nhập (CSV, PDF)
- Xuất lịch sử hoạt động
- Xuất báo cáo bảo mật

## Quy trình làm việc

```
User Login
    ↓
recordLogin() → login_history
    ↓
logActivity() → account_activity
    ↓
isSuspiciousLogin() → check thresholds
    ↓
storeDeviceFingerprint() → trusted_devices
```

## Ví dụ thực tế

### Ghi log tạo mới

```php
$newMachine = [
    'name' => 'CNC Machine A',
    'model' => 'FANUC 0iF',
    'status' => 'operational',
    'location' => 'Workshop 1'
];

$activity->logActivity(
    $_SESSION['user_id'],
    $_SESSION['username'],
    'create',
    'Created new CNC machine: ' . $newMachine['name'],
    'inventory',
    $machineId,
    'machine',
    null,
    $newMachine,
    'success'
);
```

### Ghi log sửa đổi

```php
$oldJob = getJob($jobId);
$newJob = ['status' => 'completed', 'end_time' => date('Y-m-d H:i:s')];
updateJob($jobId, $newJob);

$activity->logActivity(
    $_SESSION['user_id'],
    $_SESSION['username'],
    'update',
    'Completed maintenance job: ' . $oldJob['description'],
    'maintenance',
    $jobId,
    'job',
    ['status' => $oldJob['status']],
    ['status' => 'completed'],
    'success'
);
```

## Xử lý lỗi

```php
try {
    $activity->logActivity(...);
} catch (Exception $e) {
    error_log('Failed to log activity: ' . $e->getMessage());
    // Fallback hoặc thông báo người dùng
}
```

## Bảo mật dữ liệu

- Tất cả dữ liệu được mã hóa trong transit (HTTPS)
- IP address được lưu trữ an toàn
- User agent được đồng bộ hóa nhưng không lưu trữ tệp nhị phân
- Dữ liệu lịch sử được xóa sau MAX_HISTORY_DAYS

## Hỗ trợ

Nếu gặp vấn đề:
1. Kiểm tra log MySQL
2. Xác minh cấu hình cơ sở dữ liệu
3. Kiểm tra quyền tệp
4. Chạy lại database.sql
