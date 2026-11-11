const test = require('node:test');
const assert = require('node:assert/strict');
const {
  addReturningClause,
  getInsertPrimaryKey,
  normalizePostgresError,
  replaceQuestionPlaceholders,
  translateMySqlSql
} = require('../db/postgresSql');

test('converts parameter placeholders without changing quoted text or comments', () => {
  const sql = "SELECT '?' AS marker, name FROM users WHERE id = ? AND email = ? -- keep ?\n";
  assert.equal(
    replaceQuestionPlaceholders(sql),
    "SELECT '?' AS marker, name FROM users WHERE id = $1 AND email = $2 -- keep ?\n"
  );
});

test('converts MySQL date arithmetic to PostgreSQL intervals', () => {
  assert.equal(
    translateMySqlSql('SELECT DATE_SUB(NOW(), INTERVAL 10 MINUTE) AS cutoff'),
    "SELECT (CURRENT_TIMESTAMP - INTERVAL '10 minute') AS cutoff"
  );
  assert.equal(
    translateMySqlSql('SELECT DATE_ADD(NOW(), INTERVAL 10 MINUTE) AS expires'),
    "SELECT (CURRENT_TIMESTAMP + INTERVAL '10 minute') AS expires"
  );
  assert.equal(
    translateMySqlSql('SELECT created_at >= NOW() - INTERVAL 30 DAY AS recent'),
    "SELECT created_at >= CURRENT_TIMESTAMP - INTERVAL '30 day' AS recent"
  );
});

test('converts MySQL date formatting to TO_CHAR', () => {
  assert.equal(
    translateMySqlSql("SELECT DATE_FORMAT(e.occurred_at, '%Y-%m') AS period"),
    "SELECT TO_CHAR(e.occurred_at, 'YYYY-MM') AS period"
  );
});

test('converts MySQL boolean SUM aggregates to PostgreSQL FILTER aggregates', () => {
  assert.equal(
    translateMySqlSql("SELECT SUM(status = 'open') AS open_rooms FROM rooms"),
    "SELECT COUNT(*) FILTER (WHERE status = 'open') AS open_rooms FROM rooms"
  );
  assert.equal(
    translateMySqlSql('SELECT SUM(created_at >= NOW() - INTERVAL 30 DAY) AS recent FROM users'),
    "SELECT COUNT(*) FILTER (WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '30 day') AS recent FROM users"
  );
});

test('converts MySQL IF expressions to CASE expressions and parameterizes values', () => {
  assert.equal(
    translateMySqlSql('UPDATE password_reset_otps SET used_at = IF(? >= 5, CURRENT_TIMESTAMP, used_at) WHERE id = ?'),
    'UPDATE password_reset_otps SET used_at = (CASE WHEN $1 >= 5 THEN CURRENT_TIMESTAMP ELSE used_at END) WHERE id = $2'
  );
});

test('converts SUBSTRING_INDEX and ON DUPLICATE KEY UPDATE', () => {
  assert.equal(
    translateMySqlSql('SELECT SUBSTRING_INDEX(u.email, "@", 1) AS username FROM users u'),
    "SELECT SPLIT_PART(u.email, '@', 1) AS username FROM users u"
  );
  assert.equal(
    translateMySqlSql('INSERT INTO room_views (room_id, viewer_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE view_count = view_count + 1, last_viewed_at = CURRENT_TIMESTAMP'),
    'INSERT INTO room_views (room_id, viewer_id) VALUES ($1, $2) ON CONFLICT (room_id, viewer_id) DO UPDATE SET view_count = room_views.view_count + 1, last_viewed_at = CURRENT_TIMESTAMP'
  );
});

test('converts SHOW COLUMNS to information_schema for PostgreSQL', () => {
  const sql = translateMySqlSql('SHOW COLUMNS FROM password_reset_otps');
  assert.match(sql, /information_schema\.columns/);
  assert.match(sql, /column_name AS "Field"/);
  assert.match(sql, /table_name = 'password_reset_otps'/);
});

test('adds RETURNING clauses for all RoomSync insert primary keys', () => {
  assert.equal(getInsertPrimaryKey('INSERT INTO users (name) VALUES ($1)'), 'id');
  assert.equal(getInsertPrimaryKey('INSERT INTO rooms (block) VALUES ($1)'), 'room_id');
  assert.deepEqual(
    addReturningClause('INSERT INTO room_requests (room_id, user_id) VALUES ($1, $2)'),
    { sql: 'INSERT INTO room_requests (room_id, user_id) VALUES ($1, $2) RETURNING request_id', primaryKey: 'request_id' }
  );
  assert.equal(
    addReturningClause('INSERT INTO users (name) VALUES ($1) RETURNING id').sql,
    'INSERT INTO users (name) VALUES ($1) RETURNING id'
  );
});

test('maps PostgreSQL constraint and schema errors to existing API error categories', () => {
  const duplicate = normalizePostgresError({ code: '23505', message: 'duplicate key' });
  assert.equal(duplicate.code, 'ER_DUP_ENTRY');
  assert.equal(duplicate.postgresCode, '23505');

  const missingTable = normalizePostgresError({ code: '42P01', message: 'missing relation' });
  assert.equal(missingTable.code, 'ER_NO_SUCH_TABLE');
  assert.equal(missingTable.errno, 1146);
});
