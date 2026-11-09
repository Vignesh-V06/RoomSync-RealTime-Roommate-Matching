USE roomsync;

-- Review existing duplicates before adding these unique constraints:
-- SELECT owner_id, COUNT(*) FROM rooms GROUP BY owner_id HAVING COUNT(*) > 1;
-- SELECT user_id, COUNT(*) FROM room_requests WHERE status IN ('applied','accepted') GROUP BY user_id HAVING COUNT(*) > 1;
-- Resolve any returned rows deliberately before running this migration.

ALTER TABLE users
  DROP INDEX name,
  ADD COLUMN username VARCHAR(40) NULL AFTER name,
  ADD COLUMN phone VARCHAR(30) NULL AFTER email,
  ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN last_login_at DATETIME NULL;
UPDATE users
SET username = CONCAT('student_', id)
WHERE username IS NULL OR TRIM(username) = '';
CREATE UNIQUE INDEX uq_users_username ON users(username);

ALTER TABLE profiles
  ADD COLUMN custom_preferences JSON NULL;

ALTER TABLE rooms
  ADD COLUMN bed_type VARCHAR(50) NOT NULL DEFAULT 'Normal Bed',
  ADD COLUMN custom_options JSON NULL,
  ADD COLUMN status ENUM('open','closed') NOT NULL DEFAULT 'open',
  ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE UNIQUE INDEX uq_rooms_one_per_owner ON rooms(owner_id);

ALTER TABLE room_requests
  ADD COLUMN active_user_id INT GENERATED ALWAYS AS (CASE WHEN status IN ('applied','accepted') THEN user_id ELSE NULL END) STORED,
  ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE UNIQUE INDEX uq_room_requests_one_active_per_user ON room_requests(active_user_id);

CREATE TABLE room_views (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  room_id INT NOT NULL,
  viewer_id INT NOT NULL,
  view_count INT UNSIGNED NOT NULL DEFAULT 1,
  first_viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_room_views_room_viewer (room_id, viewer_id),
  INDEX idx_room_views_viewer (viewer_id),
  CONSTRAINT fk_room_views_room FOREIGN KEY (room_id) REFERENCES rooms(room_id) ON DELETE CASCADE,
  CONSTRAINT fk_room_views_viewer FOREIGN KEY (viewer_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE room_images (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  room_id INT NOT NULL,
  uploaded_by INT NOT NULL,
  original_name VARCHAR(120) NOT NULL,
  mime_type VARCHAR(40) NOT NULL,
  image_data LONGBLOB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_room_images_room (room_id),
  CONSTRAINT fk_room_images_room FOREIGN KEY (room_id) REFERENCES rooms(room_id) ON DELETE CASCADE,
  CONSTRAINT fk_room_images_uploader FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
);
