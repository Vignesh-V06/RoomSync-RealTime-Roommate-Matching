-- LEGACY MYSQL SQL: retained as a source/history reference only. Do not execute against PostgreSQL/Neon.
USE roomsync;

-- Room numbers distinguish different rooms within the same hostel block.
-- Existing listings remain valid; owners can fill in their room number later.
ALTER TABLE rooms
  ADD COLUMN room_number VARCHAR(20) NULL AFTER block;

CREATE UNIQUE INDEX uq_rooms_block_room_number
  ON rooms (block, room_number);
