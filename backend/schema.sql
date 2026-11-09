CREATE DATABASE IF NOT EXISTS roomsync;
USE roomsync;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  username VARCHAR(40) NULL UNIQUE,
  email VARCHAR(100) NOT NULL UNIQUE,
  phone VARCHAR(30) NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('student','admin') DEFAULT 'student',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login_at DATETIME NULL
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id INT PRIMARY KEY,
  bio TEXT,
  skills VARCHAR(255),
  interests VARCHAR(255),
  academic_details VARCHAR(255),
  language VARCHAR(50),
  branch VARCHAR(50),
  cgpa_range VARCHAR(10),
  bed_pref ENUM('upper','lower'),
  expected_members INT,
  sleep_pref VARCHAR(50),
  study_pref VARCHAR(50),
  food_pref VARCHAR(50),
  cleanliness VARCHAR(50),
  custom_preferences JSON NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS rooms (
  room_id INT AUTO_INCREMENT PRIMARY KEY,
  owner_id INT NOT NULL UNIQUE,
  block VARCHAR(50) NOT NULL,
  room_type VARCHAR(50) NOT NULL,
  bed_type VARCHAR(50) NOT NULL DEFAULT 'Normal Bed',
  total_capacity INT NOT NULL,
  current_occupancy INT DEFAULT 1,
  use_custom_logic BOOLEAN DEFAULT FALSE,
  additional_requirements TEXT,
  custom_options JSON NULL,
  status ENUM('open','closed') NOT NULL DEFAULT 'open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS room_requests (
  request_id INT AUTO_INCREMENT PRIMARY KEY,
  room_id INT NOT NULL,
  user_id INT NOT NULL,
  status ENUM('applied','accepted','rejected','removed') DEFAULT 'applied',
  active_user_id INT GENERATED ALWAYS AS (CASE WHEN status IN ('applied','accepted') THEN user_id ELSE NULL END) STORED,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_room_requests_room_user (room_id, user_id),
  UNIQUE KEY uq_room_requests_one_active_per_user (active_user_id),
  FOREIGN KEY (room_id) REFERENCES rooms(room_id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  room_id INT NOT NULL,
  sender_id INT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id) REFERENCES rooms(room_id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS room_views (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  room_id INT NOT NULL,
  viewer_id INT NOT NULL,
  view_count INT UNSIGNED NOT NULL DEFAULT 1,
  first_viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_room_views_room_viewer (room_id, viewer_id),
  INDEX idx_room_views_viewer (viewer_id),
  FOREIGN KEY (room_id) REFERENCES rooms(room_id) ON DELETE CASCADE,
  FOREIGN KEY (viewer_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS room_images (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  room_id INT NOT NULL,
  uploaded_by INT NOT NULL,
  original_name VARCHAR(120) NOT NULL,
  mime_type VARCHAR(40) NOT NULL,
  image_data LONGBLOB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_room_images_room (room_id),
  FOREIGN KEY (room_id) REFERENCES rooms(room_id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
);

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
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);


-- Privacy-conscious operational events used for admin analytics.
-- Never store message bodies, credentials, OTP values or contact details here.
CREATE TABLE IF NOT EXISTS activity_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  actor_user_id INT NULL,
  subject_user_id INT NULL,
  event_type VARCHAR(50) NOT NULL,
  entity_type VARCHAR(40) NULL,
  entity_id VARCHAR(64) NULL,
  metadata JSON NULL,
  occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_activity_events_type_time (event_type, occurred_at),
  INDEX idx_activity_events_actor_time (actor_user_id, occurred_at),
  INDEX idx_activity_events_subject_time (subject_user_id, occurred_at),
  INDEX idx_activity_events_entity (entity_type, entity_id),
  FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (subject_user_id) REFERENCES users(id) ON DELETE SET NULL
);
