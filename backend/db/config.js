const { Pool, types } = require('pg');
require('dotenv').config();

const {
  addReturningClause,
  normalizePostgresError,
  translateMySqlSql
} = require('./postgresSql');

const schema = String(process.env.DB_SCHEMA || 'roomsync').trim();
if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schema)) {
  throw new Error('DB_SCHEMA must be a valid PostgreSQL schema identifier.');
}

if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required when NODE_ENV=production.');
}

// PostgreSQL BIGINT values are parsed as strings by default. RoomSync uses
// numeric IDs and counters, so convert only values within JavaScript's safe range.
types.setTypeParser(20, (value) => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : value;
});

const nativePool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS || 30000),
  connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS || 10000),
  // Startup options apply the schema search path on every acquired connection,
  // including connections routed through Neon pooler / PgBouncer.
  options: '-c search_path=' + schema + ',public',
  application_name: 'RoomSync API'
});

nativePool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error:', error.message);
});

const execute = async (client, mysqlStyleSql, values = []) => {
  try {
    const translatedSql = translateMySqlSql(mysqlStyleSql);
    const statement = addReturningClause(translatedSql);
    const result = await client.query(statement.sql, values);

    if (result.command === 'SELECT' || result.command === 'SHOW') {
      return [result.rows, result.fields];
    }

    const header = {
      affectedRows: Number(result.rowCount || 0),
      changedRows: Number(result.rowCount || 0)
    };

    if (result.command === 'INSERT') {
      header.insertId = statement.primaryKey && result.rows[0]
        ? result.rows[0][statement.primaryKey]
        : null;
    }

    return [header, result.fields];
  } catch (error) {
    throw normalizePostgresError(error);
  }
};

// This facade preserves the current controller contract while every statement
// is executed by node-postgres against PostgreSQL. It keeps the database-driver
// migration separate from business-rule changes.
const pool = {
  query: (sql, values) => execute(nativePool, sql, values),
  getConnection: async () => {
    const client = await nativePool.connect();
    return {
      query: (sql, values) => execute(client, sql, values),
      beginTransaction: () => client.query('BEGIN'),
      commit: () => client.query('COMMIT'),
      rollback: () => client.query('ROLLBACK'),
      release: (error) => client.release(error)
    };
  },
  end: () => nativePool.end(),
  on: (...args) => {
    nativePool.on(...args);
    return pool;
  },
  native: nativePool
};

module.exports = pool;
