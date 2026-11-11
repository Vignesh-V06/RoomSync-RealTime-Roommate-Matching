-- LEGACY MYSQL SQL: retained as a source/history reference only. Do not execute against PostgreSQL/Neon.
USE roomsync;

-- Clean existing data
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE room_requests;
TRUNCATE TABLE rooms;
TRUNCATE TABLE profiles;
TRUNCATE TABLE users;
SET FOREIGN_KEY_CHECKS = 1;

-- Insert sample users (all passwords are 'password123' hashed with bcrypt)
-- Password hash for 'password123' is $2b$10$wT//x5l3ZkZ.1U2o8a5c.eV4N6eI/6xRx.pM1Qz9z9vY6Q9M.yTOW
INSERT INTO users (id, name, email, password, role) VALUES 
(1, 'Alice Smith', 'alice@student.com', '$2b$10$wT//x5l3ZkZ.1U2o8a5c.eV4N6eI/6xRx.pM1Qz9z9vY6Q9M.yTOW', 'student'),
(2, 'Bob Johnson', 'bob@student.com', '$2b$10$wT//x5l3ZkZ.1U2o8a5c.eV4N6eI/6xRx.pM1Qz9z9vY6Q9M.yTOW', 'student'),
(3, 'Charlie Brown', 'charlie@student.com', '$2b$10$wT//x5l3ZkZ.1U2o8a5c.eV4N6eI/6xRx.pM1Qz9z9vY6Q9M.yTOW', 'student'),
(4, 'Diana Prince', 'diana@student.com', '$2b$10$wT//x5l3ZkZ.1U2o8a5c.eV4N6eI/6xRx.pM1Qz9z9vY6Q9M.yTOW', 'student');

-- Insert profiles
INSERT INTO profiles (user_id, language, branch, cgpa_range, bed_pref, expected_members, sleep_pref, study_pref, food_pref, cleanliness) VALUES
(1, 'English', 'Computer Science', '8-9', 'lower', 2, 'Early Bird', 'Total Silence', 'Vegetarian', 'Neat Freak'),
(2, 'English', 'Computer Science', '8-9', 'lower', 3, 'Night Owl', 'Total Silence', 'Vegetarian', 'Moderate'),
(3, 'Hindi', 'Mechanical', '7-8', 'upper', 2, 'Night Owl', 'Background Music', 'Non-Vegetarian', 'Messy'),
(4, 'Spanish', 'Civil', '9-10', 'lower', 4, 'Early Bird', 'Group Study', 'Vegan', 'Moderate');

-- Insert rooms
INSERT INTO rooms (room_id, owner_id, block, room_type, total_capacity, current_occupancy, use_custom_logic, additional_requirements) VALUES 
(1, 1, 'Block A', '2-Sharing', 2, 1, FALSE, 'Looking for an early bird who keeps the room clean.'),
(2, 3, 'Block C', '3-Sharing', 3, 1, FALSE, 'Chill room, music is fine.');

-- Insert room requests
INSERT INTO room_requests (request_id, room_id, user_id, status) VALUES 
(1, 1, 2, 'applied');
