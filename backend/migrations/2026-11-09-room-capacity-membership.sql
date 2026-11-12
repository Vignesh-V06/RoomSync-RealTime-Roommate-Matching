-- LEGACY MYSQL SQL: retained as a source/history reference only. Do not execute against PostgreSQL/Neon.
USE roomsync;

-- Keep historical application rows when owners remove joined roommates.
-- active_user_id only includes applied/accepted memberships, so a removed
-- roommate is free to pursue another room without losing application history.
ALTER TABLE room_requests
  MODIFY COLUMN status ENUM('applied','accepted','rejected','removed') DEFAULT 'applied';

-- Repair full listings that were previously left marked open.
UPDATE rooms
SET status = 'closed'
WHERE current_occupancy >= total_capacity
  AND status <> 'closed';
