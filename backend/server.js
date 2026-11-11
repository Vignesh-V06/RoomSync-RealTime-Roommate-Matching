const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const pool = require('./db/config');

dotenv.config();

const configuredOrigins = (process.env.FRONTEND_ORIGINS || process.env.CLIENT_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const isDevelopment = process.env.NODE_ENV !== 'production';

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || configuredOrigins.includes(origin) || (isDevelopment && configuredOrigins.length === 0)) {
      return callback(null, true);
    }
    return callback(new Error('Origin is not allowed by the RoomSync CORS policy'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

const app = express();
app.set('trust proxy', 1);
app.use(cors(corsOptions));
app.use(express.json({ limit: '8mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

const routes = require('./routes');
app.use('/api', routes);

app.get('/', (req, res) => res.json({ service: 'RoomSync API', status: 'running' }));
app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);
const socket = require('./socket');
socket.init(server, configuredOrigins, isDevelopment);

const startServer = async () => {
  try {
    const [database] = await pool.query(
      'SELECT current_database() AS database_name, current_schema() AS schema_name'
    );
    const expectedSchema = process.env.DB_SCHEMA || 'roomsync';
    if (database[0]?.schema_name !== expectedSchema) {
      throw new Error(
        'Connected PostgreSQL schema "' + database[0]?.schema_name +
        '". Expected "' + expectedSchema + '". Check DB_SCHEMA and Neon search_path.'
      );
    }

    server.listen(PORT, () => {
      console.log(
        'RoomSync API and Socket.IO listening on port ' + PORT +
        ' (PostgreSQL: ' + database[0].database_name + '.' + database[0].schema_name + ')'
      );
    });
  } catch (error) {
    console.error('RoomSync PostgreSQL startup check failed:', error.message);
    await pool.end().catch(() => {});
    process.exitCode = 1;
  }
};

const shutdown = (signal) => {
  console.log('Received ' + signal + '; closing RoomSync connections.');
  server.close(async () => {
    await pool.end().catch((error) => console.error('PostgreSQL pool shutdown failed:', error.message));
    process.exitCode = 0;
  });
};

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));

startServer();
