const test = require('node:test');
const assert = require('node:assert/strict');
require('dotenv').config();

const enabled = process.env.RUN_POSTGRES_INTEGRATION_TESTS === 'true';

test('Neon PostgreSQL contains the RoomSync schema and generated membership column', {
  skip: !enabled ? 'Set RUN_POSTGRES_INTEGRATION_TESTS=true and DATABASE_URL to run against the selected Neon branch.' : false
}, async () => {
  assert.ok(process.env.DATABASE_URL, 'DATABASE_URL is required for PostgreSQL integration tests.');

  const pool = require('../db/config');
  try {
    const [context] = await pool.query(
      'SELECT current_database() AS database_name, current_schema() AS schema_name, current_user AS database_user'
    );
    assert.equal(context[0].schema_name, process.env.DB_SCHEMA || 'roomsync');

    const [tables] = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'"
    );
    const tableNames = new Set(tables.map((row) => row.table_name));
    const requiredTables = [
      'users', 'profiles', 'rooms', 'room_requests', 'registration_otps',
      'password_reset_otps', 'notifications', 'chat_messages', 'room_views',
      'room_images', 'activity_events'
    ];
    for (const table of requiredTables) assert.ok(tableNames.has(table), 'Missing table: ' + table);

    const [generated] = await pool.query(
      "SELECT is_generated, generation_expression FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'room_requests' AND column_name = 'active_user_id'"
    );
    assert.equal(generated[0]?.is_generated, 'ALWAYS');
    assert.match(generated[0]?.generation_expression || '', /applied/);
    assert.match(generated[0]?.generation_expression || '', /accepted/);

    const [counts] = await pool.query(
      'SELECT (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM rooms) AS rooms, (SELECT COUNT(*) FROM room_requests) AS room_requests'
    );
    assert.ok(Number(counts[0].users) >= 0);
    assert.ok(Number(counts[0].rooms) >= 0);
    assert.ok(Number(counts[0].room_requests) >= 0);
  } finally {
    await pool.end();
  }
});
