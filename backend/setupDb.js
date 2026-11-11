const pool = require('./db/config');

const REQUIRED_TABLES = [
  'users',
  'profiles',
  'rooms',
  'room_requests',
  'registration_otps',
  'password_reset_otps',
  'notifications',
  'chat_messages',
  'room_views',
  'room_images',
  'activity_events'
];

async function verifyDatabase() {
  try {
    const [context] = await pool.query(
      'SELECT current_database() AS database_name, current_schema() AS schema_name, current_user AS database_user'
    );
    const schemaName = context[0]?.schema_name;

    if (schemaName !== (process.env.DB_SCHEMA || 'roomsync')) {
      throw new Error(
        'Connected to schema "' + schemaName + '". Expected "' +
        (process.env.DB_SCHEMA || 'roomsync') + '". Check DB_SCHEMA and the Neon role search_path.'
      );
    }

    const [tables] = await pool.query(
      'SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_type = ?',
      ['BASE TABLE']
    );
    const existing = new Set(tables.map((row) => row.table_name));
    const missing = REQUIRED_TABLES.filter((table) => !existing.has(table));

    if (missing.length) {
      throw new Error(
        'PostgreSQL schema is incomplete. Missing tables: ' + missing.join(', ') +
        '. Review backend/schema.postgres.sql and apply the required DDL to an empty database.'
      );
    }

    const [generatedColumns] = await pool.query(
      "SELECT column_name, is_generated, generation_expression FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'room_requests' AND column_name = 'active_user_id'"
    );
    const activeUserId = generatedColumns[0];
    if (!activeUserId || activeUserId.is_generated !== 'ALWAYS') {
      throw new Error('room_requests.active_user_id must remain a stored generated column.');
    }

    console.log(
      'PostgreSQL database verified:',
      context[0].database_name + '.' + schemaName,
      '(' + REQUIRED_TABLES.length + ' required tables)'
    );
    return true;
  } finally {
    await pool.end();
  }
}

verifyDatabase().catch((error) => {
  console.error('PostgreSQL database verification failed:', error.message);
  process.exitCode = 1;
});
