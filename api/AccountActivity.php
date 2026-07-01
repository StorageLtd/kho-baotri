<?php
require_once 'config.php';

class AccountActivity {
    private $conn;

    public function __construct($conn) {
        $this->conn = $conn;
    }

    /**
     * Log activity
     */
    public function logActivity(
        $userId,
        $username,
        $activityType,
        $actionDescription,
        $moduleName = null,
        $resourceId = null,
        $resourceType = null,
        $oldValue = null,
        $newValue = null,
        $status = 'success',
        $errorMessage = null
    ) {
        $ipAddress = $this->getClientIP();
        $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? 'Unknown';

        $oldValueJson = $oldValue ? json_encode($oldValue) : null;
        $newValueJson = $newValue ? json_encode($newValue) : null;

        $stmt = $this->conn->prepare("
            INSERT INTO account_activity 
            (user_id, username, activity_type, action_description, module_name, resource_id, 
             resource_type, old_value, new_value, ip_address, user_agent, status, error_message)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");

        if (!$stmt) {
            throw new Exception("Prepare failed: " . $this->conn->error);
        }

        $stmt->bind_param(
            "issssssssssss",
            $userId,
            $username,
            $activityType,
            $actionDescription,
            $moduleName,
            $resourceId,
            $resourceType,
            $oldValueJson,
            $newValueJson,
            $ipAddress,
            $userAgent,
            $status,
            $errorMessage
        );

        $result = $stmt->execute();
        $stmt->close();

        return $result;
    }

    /**
     * Get activity history
     */
    public function getActivityHistory($userId, $limit = 50, $offset = 0, $filters = []) {
        $query = "
            SELECT 
                id,
                username,
                activity_type,
                action_description,
                module_name,
                resource_id,
                old_value,
                new_value,
                ip_address,
                status,
                activity_time
            FROM account_activity
            WHERE user_id = ?
        ";

        $params = [$userId];
        $types = "i";

        // Apply filters
        if (!empty($filters['activity_type'])) {
            $query .= " AND activity_type = ?";
            $params[] = $filters['activity_type'];
            $types .= "s";
        }

        if (!empty($filters['module_name'])) {
            $query .= " AND module_name = ?";
            $params[] = $filters['module_name'];
            $types .= "s";
        }

        if (!empty($filters['status'])) {
            $query .= " AND status = ?";
            $params[] = $filters['status'];
            $types .= "s";
        }

        if (!empty($filters['date_from'])) {
            $query .= " AND activity_time >= ?";
            $params[] = $filters['date_from'];
            $types .= "s";
        }

        if (!empty($filters['date_to'])) {
            $query .= " AND activity_time <= ?";
            $params[] = $filters['date_to'];
            $types .= "s";
        }

        $query .= " ORDER BY activity_time DESC LIMIT ? OFFSET ?";
        $params[] = $limit;
        $params[] = $offset;
        $types .= "ii";

        $stmt = $this->conn->prepare($query);
        if (!$stmt) {
            throw new Exception("Prepare failed: " . $this->conn->error);
        }

        $stmt->bind_param($types, ...$params);
        $stmt->execute();
        $result = $stmt->get_result();
        $history = $result->fetch_all(MYSQLI_ASSOC);
        $stmt->close();

        // Decode JSON fields
        foreach ($history as &$record) {
            if ($record['old_value']) {
                $record['old_value'] = json_decode($record['old_value'], true);
            }
            if ($record['new_value']) {
                $record['new_value'] = json_decode($record['new_value'], true);
            }
        }

        return $history;
    }

    /**
     * Get activity summary
     */
    public function getActivitySummary($userId, $days = 30) {
        $stmt = $this->conn->prepare("
            SELECT 
                activity_type,
                COUNT(*) as count,
                SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count
            FROM account_activity
            WHERE user_id = ? 
            AND activity_time > DATE_SUB(NOW(), INTERVAL ? DAY)
            GROUP BY activity_type
            ORDER BY count DESC
        ");

        if (!$stmt) {
            throw new Exception("Prepare failed: " . $this->conn->error);
        }

        $stmt->bind_param("ii", $userId, $days);
        $stmt->execute();
        $result = $stmt->get_result();
        $summary = $result->fetch_all(MYSQLI_ASSOC);
        $stmt->close();

        return $summary;
    }

    /**
     * Get failed activities
     */
    public function getFailedActivities($userId, $limit = 50) {
        $stmt = $this->conn->prepare("
            SELECT 
                id,
                activity_type,
                action_description,
                error_message,
                ip_address,
                activity_time
            FROM account_activity
            WHERE user_id = ? AND status = 'failed'
            ORDER BY activity_time DESC
            LIMIT ?
        ");

        if (!$stmt) {
            throw new Exception("Prepare failed: " . $this->conn->error);
        }

        $stmt->bind_param("ii", $userId, $limit);
        $stmt->execute();
        $result = $stmt->get_result();
        $failed = $result->fetch_all(MYSQLI_ASSOC);
        $stmt->close();

        return $failed;
    }

    /**
     * Search activities by keyword
     */
    public function searchActivities($userId, $keyword, $limit = 50) {
        $stmt = $this->conn->prepare("
            SELECT 
                id,
                activity_type,
                action_description,
                module_name,
                resource_id,
                activity_time
            FROM account_activity
            WHERE user_id = ? 
            AND MATCH(action_description) AGAINST(? IN BOOLEAN MODE)
            ORDER BY activity_time DESC
            LIMIT ?
        ");

        if (!$stmt) {
            throw new Exception("Prepare failed: " . $this->conn->error);
        }

        $keyword = "+{$keyword}*";
        $stmt->bind_param("isi", $userId, $keyword, $limit);
        $stmt->execute();
        $result = $stmt->get_result();
        $results = $result->fetch_all(MYSQLI_ASSOC);
        $stmt->close();

        return $results;
    }

    /**
     * Get resource change history
     */
    public function getResourceHistory($userId, $resourceId, $resourceType) {
        $stmt = $this->conn->prepare("
            SELECT 
                id,
                activity_type,
                username,
                old_value,
                new_value,
                activity_time
            FROM account_activity
            WHERE user_id = ? 
            AND resource_id = ? 
            AND resource_type = ?
            ORDER BY activity_time DESC
        ");

        if (!$stmt) {
            throw new Exception("Prepare failed: " . $this->conn->error);
        }

        $stmt->bind_param("iss", $userId, $resourceId, $resourceType);
        $stmt->execute();
        $result = $stmt->get_result();
        $history = $result->fetch_all(MYSQLI_ASSOC);
        $stmt->close();

        // Decode JSON fields
        foreach ($history as &$record) {
            if ($record['old_value']) {
                $record['old_value'] = json_decode($record['old_value'], true);
            }
            if ($record['new_value']) {
                $record['new_value'] = json_decode($record['new_value'], true);
            }
        }

        return $history;
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
}
?>
