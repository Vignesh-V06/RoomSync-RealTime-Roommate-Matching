const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');

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

server.listen(PORT, () => {
  console.log('RoomSync API and Socket.IO listening on port ' + PORT);
});
