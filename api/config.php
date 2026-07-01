<?php
// Database Configuration
define('DB_HOST', getenv('DB_HOST') ?: 'localhost');
define('DB_USER', getenv('DB_USER') ?: 'root');
define('DB_PASS', getenv('DB_PASS') ?: '');
define('DB_NAME', getenv('DB_NAME') ?: 'kho_baotri');

// Session Configuration
define('SESSION_TIMEOUT', 3600); // 1 hour
define('MAX_LOGIN_ATTEMPTS', 5);
define('LOCKOUT_DURATION', 900); // 15 minutes

// Security Configuration
define('ENABLE_2FA', true);
define('LOG_FAILED_ATTEMPTS', true);
define('LOG_ALL_ACTIVITIES', true);
define('MAX_HISTORY_DAYS', 90);
define('SUSPICIOUS_LOGIN_THRESHOLD', 3); // Failed attempts before suspicious

// API Configuration
define('API_VERSION', 'v1');
define('CORS_ORIGIN', getenv('CORS_ORIGIN') ?: '*');

// Get database connection
function getDBConnection() {
    try {
        $conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
        if ($conn->connect_error) {
            throw new Exception("Connection failed: " . $conn->connect_error);
        }
        $conn->set_charset("utf8mb4");
        return $conn;
    } catch (Exception $e) {
        error_log("Database connection error: " . $e->getMessage());
        die(json_encode(['error' => 'Database connection failed']));
    }
}
?>
