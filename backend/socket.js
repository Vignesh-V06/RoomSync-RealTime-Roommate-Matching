const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const pool = require('./db/config');

let io;

module.exports = {
  init: (server, configuredOrigins = [], isDevelopment = true) => {
    io = new Server(server, {
      cors: {
        origin: (origin, callback) => {
          if (!origin || configuredOrigins.includes(origin) || (isDevelopment && configuredOrigins.length === 0)) {
            return callback(null, true);
          }
          return callback(new Error('Origin is not allowed by the RoomSync Socket.IO CORS policy'));
        },
        methods: ['GET', 'POST']
      }
    });

    io.use((socket, next) => {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication required'));

      try {
        socket.user = jwt.verify(token, process.env.JWT_SECRET);
        return next();
      } catch (error) {
        return next(new Error('Invalid authentication token'));
      }
    });

    io.on('connection', (client) => {
      client.on('join_user', (userId) => {
        if (String(userId) === String(client.user.id)) {
          client.join(`user_${client.user.id}`);
        }
      });

      client.on('join_room', async (roomId) => {
        try {
          const [rooms] = await pool.query(
            'SELECT room_id, owner_id FROM rooms WHERE room_id = ?',
            [roomId]
          );
          if (rooms.length === 0) return;

          const room = rooms[0];
          if (String(room.owner_id) === String(client.user.id)) {
            client.join(`room_${roomId}`);
            return;
          }

          const [members] = await pool.query(
            "SELECT request_id FROM room_requests WHERE room_id = ? AND user_id = ? AND status = 'accepted' LIMIT 1",
            [roomId, client.user.id]
          );

          if (members.length > 0) {
            client.join(`room_${roomId}`);
          }
        } catch (error) {
          console.error('Socket room authorization failed:', error);
        }
      });
    });

    return io;
  },
  getIo: () => {
    if (!io) {
      throw new Error('Socket.io not initialized!');
    }
    return io;
  }
};
