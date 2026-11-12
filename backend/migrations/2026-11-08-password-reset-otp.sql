-- LEGACY MYSQL SQL: retained as a source/history reference only. Do not execute against PostgreSQL/Neon.
USE roomsync;

-- One-time password reset codes.
-- Only a keyed SHA-256 hash is stored; the six-digit code is never persisted.
CREATE TABLE IF NOT EXISTS password_reset_otps (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  otp_hash CHAR(64) NOT NULL,
  request_ip VARCHAR(45) NULL,
  attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_password_reset_user_created (user_id, created_at),
  INDEX idx_password_reset_ip_created (request_ip, created_at),
  INDEX idx_password_reset_expiry (expires_at),
  CONSTRAINT fk_password_reset_otps_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
