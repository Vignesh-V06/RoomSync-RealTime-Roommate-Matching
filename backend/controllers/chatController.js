const pool = require('../db/config');
const recordActivity = require('../utils/activityLogger');
const socket = require('../socket');

const getRoomAccess = async (roomId, userId) => {
  const [rooms] = await pool.query('SELECT room_id, owner_id FROM rooms WHERE room_id = ? LIMIT 1', [roomId]);
  if (!rooms.length) return { error: 404, message: 'Room not found.' };
  if (String(rooms[0].owner_id) === String(userId)) return { room: rooms[0] };
  const [members] = await pool.query(
    "SELECT request_id FROM room_requests WHERE room_id = ? AND user_id = ? AND status = 'accepted' LIMIT 1",
    [roomId, userId]
  );
  if (!members.length) return { error: 403, message: 'You are not a member of this room.' };
  return { room: rooms[0] };
};

exports.getRoomMessages = async (req, res) => {
  try {
    const access = await getRoomAccess(req.params.roomId, req.user.id);
    if (access.error) return res.status(access.error).json({ message: access.message });

    const [messages] = await pool.query(
      'SELECT m.id, m.room_id, m.sender_id, m.message, m.created_at, u.name AS sender_name, COALESCE(u.username, split_part(u.email, chr(64), 1)) AS sender_username FROM chat_messages m JOIN users u ON u.id = m.sender_id WHERE m.room_id = ? ORDER BY m.created_at ASC, m.id ASC',
      [req.params.roomId]
    );
    res.json(messages);
  } catch (error) {
    console.error('Chat history failed:', error);
    res.status(500).json({ message: 'Server error fetching messages.' });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';
    if (!message || message.length > 2000) return res.status(400).json({ message: 'Message must contain 1 to 2000 characters.' });

    const access = await getRoomAccess(req.params.roomId, req.user.id);
    if (access.error) return res.status(access.error).json({ message: access.message });

    const [result] = await pool.query(
      'INSERT INTO chat_messages (room_id, sender_id, message) VALUES (?, ?, ?)',
      [req.params.roomId, req.user.id, message]
    );
    const [senders] = await pool.query(
      'SELECT name, COALESCE(username, split_part(email, chr(64), 1)) AS username FROM users WHERE id = ? LIMIT 1',
      [req.user.id]
    );
    await recordActivity({ actorUserId: req.user.id, subjectUserId: req.user.id, eventType: 'chat_message_sent', entityType: 'room', entityId: req.params.roomId });
    const newMessage = {
      id: result.insertId,
      room_id: Number(req.params.roomId),
      sender_id: req.user.id,
      sender_name: senders[0]?.name || 'Room member',
      sender_username: senders[0]?.username || '',
      message,
      created_at: new Date()
    };

    const io = socket.getIo();
    if (io) io.to('room_' + req.params.roomId).emit('receive_message', newMessage);
    res.status(201).json(newMessage);
  } catch (error) {
    console.error('Message send failed:', error);
    res.status(500).json({ message: 'Server error sending your message.' });
  }
};
