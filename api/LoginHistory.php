<?php
require_once 'config.php';

class LoginHistory {
    private $conn;

    public function __construct($conn) {
        $this->conn = $conn;
    }

    /**
     * Record login attempt
     */
    public function recordLogin($userId, $username, $status = 'success', $failureReason = null) {
        $deviceInfo = $this->getDeviceInfo();
        $ipAddress = $this->getClientIP();
        $location = $this->getLocationFromIP($ipAddress);

        $stmt = $this->conn->prepare("
            INSERT INTO login_history 
            (user_id, username, device_name, device_type, ip_address, browser_info, user_agent, login_status, failure_reason, location, latitude, longitude)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");

        if (!$stmt) {
            throw new Exception("Prepare failed: " . $this->conn->error);
        }

        $stmt->bind_param(
            "isssssssssdd",
            $userId,
            $username,
            $deviceInfo['device_name'],
            $deviceInfo['device_type'],
            $ipAddress,
            $deviceInfo['browser'],
            $deviceInfo['user_agent'],
            $status,
            $failureReason,
            $location['city'],
            $location['latitude'],
            $location['longitude']
        );

        $result = $stmt->execute();
        $stmt->close();

        if ($result && $status === 'success') {
            // Store device fingerprint for future reference
            $this->storeDeviceFingerprint($userId, $deviceInfo, $ipAddress);
        }

        return $result;
    }

    /**
     * Record logout
     */
    public function recordLogout($userId, $ipAddress = null) {
        if (!$ipAddress) {
            $ipAddress = $this->getClientIP();
        }

        $stmt = $this->conn->prepare("
            UPDATE login_history 
            SET logout_time = NOW(),
                session_duration = TIMESTAMPDIFF(SECOND, login_time, NOW())
            WHERE user_id = ? AND logout_time IS NULL AND ip_address = ?
            ORDER BY login_time DESC LIMIT 1
        ");

        if (!$stmt) {
            throw new Exception("Prepare failed: " . $this->conn->error);
        }

        $stmt->bind_param("is", $userId, $ipAddress);
        $result = $stmt->execute();
        $stmt->close();

        return $result;
    }

    /**
     * Get login history for user
     */
    public function getLoginHistory($userId, $limit = 50, $offset = 0) {
        $stmt = $this->conn->prepare("
            SELECT 
                id,
                username,
                device_name,
                device_type,
                ip_address,
                browser_info,
                login_status,
                login_time,
                logout_time,
                session_duration,
                location,
                is_suspicious
            FROM login_history
            WHERE user_id = ?
            ORDER BY login_time DESC
            LIMIT ? OFFSET ?
        ");

        if (!$stmt) {
            throw new Exception("Prepare failed: " . $this->conn->error);
        }

        $stmt->bind_param("iii", $userId, $limit, $offset);
        $stmt->execute();
        $result = $stmt->get_result();
        $history = $result->fetch_all(MYSQLI_ASSOC);
        $stmt->close();

        return $history;
    }

    /**
     * Get suspicious logins
     */
    public function getSuspiciousLogins($userId, $days = 7) {
        $stmt = $this->conn->prepare("
            SELECT 
                id,
                username,
                device_name,
                ip_address,
                location,
                login_status,
                failure_reason,
                login_time
            FROM login_history
            WHERE user_id = ? 
            AND (is_suspicious = TRUE OR login_status = 'failed')
            AND login_time > DATE_SUB(NOW(), INTERVAL ? DAY)
            ORDER BY login_time DESC
        ");

        if (!$stmt) {
            throw new Exception("Prepare failed: " . $this->conn->error);
        }

        $stmt->bind_param("ii", $userId, $days);
        $stmt->execute();
        $result = $stmt->get_result();
        $suspicious = $result->fetch_all(MYSQLI_ASSOC);
        $stmt->close();

        return $suspicious;
    }

    /**
     * Get active sessions
     */
    public function getActiveSessions($userId) {
        $stmt = $this->conn->prepare("
            SELECT 
                id,
                device_name,
                device_type,
                ip_address,
                browser_info,
                location,
                login_time,
                session_duration
            FROM login_history
            WHERE user_id = ? 
            AND logout_time IS NULL
            AND login_time > DATE_SUB(NOW(), INTERVAL 24 HOUR)
            ORDER BY login_time DESC
        ");

        if (!$stmt) {
            throw new Exception("Prepare failed: " . $this->conn->error);
        }

        $stmt->bind_param("i", $userId);
        $stmt->execute();
        $result = $stmt->get_result();
        $sessions = $result->fetch_all(MYSQLI_ASSOC);
        $stmt->close();

        return $sessions;
    }

    /**
     * Terminate specific session
     */
    public function terminateSession($loginHistoryId, $userId) {
        $stmt = $this->conn->prepare("
            UPDATE login_history 
            SET logout_time = NOW(),
                session_duration = TIMESTAMPDIFF(SECOND, login_time, NOW())
            WHERE id = ? AND user_id = ?
        ");

        if (!$stmt) {
            throw new Exception("Prepare failed: " . $this->conn->error);
        }

        $stmt->bind_param("ii", $loginHistoryId, $userId);
        $result = $stmt->execute();
        $stmt->close();

        return $result;
    }

    /**
     * Store device fingerprint
     */
    private function storeDeviceFingerprint($userId, $deviceInfo, $ipAddress) {
        $deviceId = $deviceInfo['device_id'];
        $stmt = $this->conn->prepare("
            INSERT INTO trusted_devices 
            (user_id, device_name, device_id, device_type, ip_address, browser_info, last_login)
            VALUES (?, ?, ?, ?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE last_login = NOW()
        ");

        if (!$stmt) {
            return false;
        }

        $stmt->bind_param(
            "isssss",
            $userId,
            $deviceInfo['device_name'],
            $deviceId,
            $deviceInfo['device_type'],
            $ipAddress,
            $deviceInfo['browser']
        );

        $result = $stmt->execute();
        $stmt->close();

        return $result;
    }

    /**
     * Get device info
     */
    private function getDeviceInfo() {
        $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? 'Unknown';
        
        // Detect device type and browser
        $deviceType = 'Desktop';
        $browser = 'Unknown';
        
        if (preg_match('/Mobile|Android|iPhone|iPad/', $userAgent)) {
            $deviceType = 'Mobile';
        }
        
        if (preg_match('/Chrome/', $userAgent)) {
            $browser = 'Chrome';
        } elseif (preg_match('/Firefox/', $userAgent)) {
            $browser = 'Firefox';
        } elseif (preg_match('/Safari/', $userAgent)) {
            $browser = 'Safari';
        } elseif (preg_match('/MSIE|Trident/', $userAgent)) {
            $browser = 'Internet Explorer';
        }

        $deviceName = $this->getDeviceName();
        $deviceId = $this->generateDeviceId();

        return [
            'device_name' => $deviceName,
            'device_id' => $deviceId,
            'device_type' => $deviceType,
            'browser' => $browser,
            'user_agent' => $userAgent
        ];
    }

    /**
     * Get client IP address
     */
    private function getClientIP() {
        if (!empty($_SERVER['HTTP_CLIENT_IP'])) {
            $ip = $_SERVER['HTTP_CLIENT_IP'];
        } elseif (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
            $ip = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'])[0];
        } else {
            $ip = $_SERVER['REMOTE_ADDR'] ?? 'Unknown';
        }
        return trim($ip);
    }

    /**
     * Get location from IP
     */
    private function getLocationFromIP($ipAddress) {
        // This is a simplified version. For production, use a real GeoIP service
        // Example: MaxMind GeoIP2, IP2Location, or similar
        
        $location = [
            'city' => 'Unknown',
            'latitude' => 0,
            'longitude' => 0
        ];

        // Try to use a free GeoIP service (optional)
        try {
            $response = @file_get_contents("https://ipinfo.io/{$ipAddress}/json");
            if ($response) {
                $data = json_decode($response, true);
                if (isset($data['city'])) {
                    $location['city'] = $data['city'];
                    if (isset($data['loc'])) {
                        $coords = explode(',', $data['loc']);
                        $location['latitude'] = (float)$coords[0];
                        $location['longitude'] = (float)$coords[1];
                    }
                }
            }
        } catch (Exception $e) {
            // Fallback to 'Unknown'
        }

        return $location;
    }

    /**
     * Get device name
     */
    private function getDeviceName() {
        $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? 'Unknown Device';
        
        if (preg_match('/Windows/', $userAgent)) {
            return 'Windows Device';
        } elseif (preg_match('/Mac/', $userAgent)) {
            return 'Mac Device';
        } elseif (preg_match('/Linux/', $userAgent)) {
            return 'Linux Device';
        } elseif (preg_match('/iPhone/', $userAgent)) {
            return 'iPhone';
        } elseif (preg_match('/iPad/', $userAgent)) {
            return 'iPad';
        } elseif (preg_match('/Android/', $userAgent)) {
            return 'Android Device';
        }
        
        return 'Unknown Device';
    }

    /**
     * Generate device ID
     */
    private function generateDeviceId() {
        // Generate a unique device ID based on user agent and other factors
        $fingerprint = $_SERVER['HTTP_USER_AGENT'] . 
                       ($_SERVER['HTTP_ACCEPT_LANGUAGE'] ?? '') . 
                       ($_SERVER['HTTP_ACCEPT_ENCODING'] ?? '');
        return hash('sha256', $fingerprint);
    }

    /**
     * Check if login is suspicious
     */
    public function isSuspiciousLogin($userId, $ipAddress) {
        // Check for failed login attempts
        $stmt = $this->conn->prepare("
            SELECT COUNT(*) as failed_count 
            FROM login_history 
            WHERE user_id = ? 
            AND login_status = 'failed' 
            AND ip_address = ?
            AND login_time > DATE_SUB(NOW(), INTERVAL 1 HOUR)
        ");

        if (!$stmt) {
            return false;
        }

        $stmt->bind_param("is", $userId, $ipAddress);
        $stmt->execute();
        $result = $stmt->get_result();
        $row = $result->fetch_assoc();
        $stmt->close();

        return $row['failed_count'] >= SUSPICIOUS_LOGIN_THRESHOLD;
    }
}
?>
