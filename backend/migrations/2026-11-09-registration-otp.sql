-- LEGACY MYSQL SQL: retained as a source/history reference only. Do not execute against PostgreSQL/Neon.
-- Email verification for new RoomSync registrations.
-- Run once against the existing roomsync database before deploying the new API.
CREATE TABLE IF NOT EXISTS registration_otps (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(100) NOT NULL,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(30) NULL,
  password_hash VARCHAR(255) NOT NULL,
  otp_hash CHAR(64) NOT NULL,
  request_ip VARCHAR(45) NULL,
  attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_registration_otp_email_created (email, created_at),
  INDEX idx_registration_otp_ip_created (request_ip, created_at),
  INDEX idx_registration_otp_expiry (expires_at)
);
