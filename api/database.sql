-- Bảng lưu lịch sử đăng nhập thiết bị
CREATE TABLE IF NOT EXISTS login_history (
  id INTEGER PRIMARY KEY AUTO_INCREMENT,
  user_id INTEGER NOT NULL,
  username VARCHAR(255) NOT NULL,
  device_name VARCHAR(255),
  device_type VARCHAR(50),
  ip_address VARCHAR(45),
  browser_info VARCHAR(500),
  user_agent TEXT,
  login_status ENUM('success', 'failed', 'blocked') DEFAULT 'success',
  failure_reason VARCHAR(500),
  login_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  logout_time DATETIME NULL,
  session_duration INT COMMENT 'Duration in seconds',
  location VARCHAR(255),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  is_suspicious BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_login_time (login_time),
  INDEX idx_ip_address (ip_address)
);

-- Bảng lưu lịch sử hoạt động tài khoản
CREATE TABLE IF NOT EXISTS account_activity (
  id INTEGER PRIMARY KEY AUTO_INCREMENT,
  user_id INTEGER NOT NULL,
  username VARCHAR(255) NOT NULL,
  activity_type VARCHAR(100) NOT NULL,
  action_description TEXT,
  module_name VARCHAR(100),
  resource_id VARCHAR(255),
  resource_type VARCHAR(100),
  old_value LONGTEXT COMMENT 'JSON format',
  new_value LONGTEXT COMMENT 'JSON format',
  ip_address VARCHAR(45),
  user_agent TEXT,
  status ENUM('success', 'failed', 'pending') DEFAULT 'success',
  error_message TEXT,
  activity_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_activity_type (activity_type),
  INDEX idx_activity_time (activity_time),
  INDEX idx_resource_id (resource_id),
  FULLTEXT INDEX ft_action (action_description)
);

-- Bảng lưu danh sách thiết bị đã đăng nhập
CREATE TABLE IF NOT EXISTS trusted_devices (
  id INTEGER PRIMARY KEY AUTO_INCREMENT,
  user_id INTEGER NOT NULL,
  device_name VARCHAR(255),
  device_id VARCHAR(255) UNIQUE,
  device_type VARCHAR(50),
  ip_address VARCHAR(45),
  browser_info VARCHAR(500),
  device_fingerprint VARCHAR(255),
  is_trusted BOOLEAN DEFAULT FALSE,
  last_login DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_device_id (device_id)
);

-- Bảng lưu cảnh báo bảo mật
CREATE TABLE IF NOT EXISTS security_alerts (
  id INTEGER PRIMARY KEY AUTO_INCREMENT,
  user_id INTEGER NOT NULL,
  alert_type VARCHAR(100),
  alert_message TEXT,
  severity ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
  action_required BOOLEAN DEFAULT FALSE,
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_at DATETIME NULL,
  ip_address VARCHAR(45),
  details LONGTEXT COMMENT 'JSON format',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at),
  INDEX idx_severity (severity)
);
