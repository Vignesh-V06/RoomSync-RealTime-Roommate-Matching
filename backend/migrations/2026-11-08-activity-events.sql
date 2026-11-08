USE roomsync;

-- Privacy-conscious platform activity log for analytics and admin audit reporting.
-- Do not add credentials, OTP values, message content, email addresses or phone numbers.
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
  CONSTRAINT fk_activity_events_actor
    FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_activity_events_subject
    FOREIGN KEY (subject_user_id) REFERENCES users(id) ON DELETE SET NULL
);
