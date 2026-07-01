<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

require_once 'config.php';
require_once 'LoginHistory.php';
require_once 'AccountActivity.php';

// Start session
session_start();

$conn = getDBConnection();
$loginHistory = new LoginHistory($conn);
$accountActivity = new AccountActivity($conn);

// Check authentication
if (empty($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

$userId = $_SESSION['user_id'];
$action = $_GET['action'] ?? $_POST['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

try {
    switch ($action) {
        // Login History Endpoints
        case 'get-login-history':
            $limit = (int)($_GET['limit'] ?? 50);
            $offset = (int)($_GET['offset'] ?? 0);
            $history = $loginHistory->getLoginHistory($userId, $limit, $offset);
            echo json_encode(['success' => true, 'data' => $history]);
            break;

        case 'get-suspicious-logins':
            $days = (int)($_GET['days'] ?? 7);
            $suspicious = $loginHistory->getSuspiciousLogins($userId, $days);
            echo json_encode(['success' => true, 'data' => $suspicious]);
            break;

        case 'get-active-sessions':
            $sessions = $loginHistory->getActiveSessions($userId);
            echo json_encode(['success' => true, 'data' => $sessions]);
            break;

        case 'terminate-session':
            if ($method !== 'POST') {
                http_response_code(405);
                echo json_encode(['error' => 'Method not allowed']);
                break;
            }
            $sessionId = (int)$_POST['session_id'];
            $result = $loginHistory->terminateSession($sessionId, $userId);
            echo json_encode(['success' => $result]);
            break;

        // Account Activity Endpoints
        case 'get-activity-history':
            $limit = (int)($_GET['limit'] ?? 50);
            $offset = (int)($_GET['offset'] ?? 0);
            $filters = [
                'activity_type' => $_GET['activity_type'] ?? null,
                'module_name' => $_GET['module_name'] ?? null,
                'status' => $_GET['status'] ?? null,
                'date_from' => $_GET['date_from'] ?? null,
                'date_to' => $_GET['date_to'] ?? null
            ];
            $history = $accountActivity->getActivityHistory($userId, $limit, $offset, $filters);
            echo json_encode(['success' => true, 'data' => $history]);
            break;

        case 'get-activity-summary':
            $days = (int)($_GET['days'] ?? 30);
            $summary = $accountActivity->getActivitySummary($userId, $days);
            echo json_encode(['success' => true, 'data' => $summary]);
            break;

        case 'get-failed-activities':
            $limit = (int)($_GET['limit'] ?? 50);
            $failed = $accountActivity->getFailedActivities($userId, $limit);
            echo json_encode(['success' => true, 'data' => $failed]);
            break;

        case 'search-activities':
            $keyword = $_GET['keyword'] ?? '';
            $limit = (int)($_GET['limit'] ?? 50);
            if (empty($keyword)) {
                http_response_code(400);
                echo json_encode(['error' => 'Keyword required']);
                break;
            }
            $results = $accountActivity->searchActivities($userId, $keyword, $limit);
            echo json_encode(['success' => true, 'data' => $results]);
            break;

        case 'get-resource-history':
            $resourceId = $_GET['resource_id'] ?? '';
            $resourceType = $_GET['resource_type'] ?? '';
            if (empty($resourceId) || empty($resourceType)) {
                http_response_code(400);
                echo json_encode(['error' => 'Resource ID and type required']);
                break;
            }
            $history = $accountActivity->getResourceHistory($userId, $resourceId, $resourceType);
            echo json_encode(['success' => true, 'data' => $history]);
            break;

        default:
            http_response_code(400);
            echo json_encode(['error' => 'Invalid action']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}

$conn->close();
?>
