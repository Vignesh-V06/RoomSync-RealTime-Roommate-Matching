const pool = require('../db/config');
const socket = require('../socket');

exports.applyRoom = async (req, res) => {
  try {
    const userId = req.user.id;
    const { room_id } = req.body;

    // Ensure room exists, not full, and not owned by user
    const [rooms] = await pool.query('SELECT * FROM rooms WHERE room_id = ?', [room_id]);
    if (rooms.length === 0) return res.status(404).json({ message: 'Room not found' });
    
    const room = rooms[0];
    if (room.owner_id === userId) return res.status(400).json({ message: 'Cannot apply to your own room' });
    if (room.current_occupancy >= room.total_capacity) return res.status(400).json({ message: 'Room is full' });

    // Check if already applied
    const [existing] = await pool.query('SELECT * FROM room_requests WHERE room_id = ? AND user_id = ?', [room_id, userId]);
    if (existing.length > 0) return res.status(400).json({ message: 'You have already applied to this room' });

    await pool.query('INSERT INTO room_requests (room_id, user_id, status) VALUES (?, ?, ?)', [room_id, userId, 'applied']);
    res.status(201).json({ message: 'Applied successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error applying to room' });
  }
};

exports.getOwnerRequests = async (req, res) => {
  try {
    const ownerId = req.user.id;

    // We only want requests for rooms owned by this user
    const [requests] = await pool.query(`
      SELECT rq.*, r.block, r.room_type, u.name as applicant_name, u.email as applicant_email,
             p.language, p.branch, p.cgpa_range, p.sleep_pref, p.study_pref, p.food_pref, p.cleanliness
      FROM room_requests rq
      JOIN rooms r ON rq.room_id = r.room_id
      JOIN users u ON rq.user_id = u.id
      LEFT JOIN profiles p ON rq.user_id = p.user_id
      WHERE r.owner_id = ? AND rq.status = 'applied'
    `, [ownerId]);

    // We should ideally calculate compatibility from the owner's perspective too
    // For simplicity, we just send all profile data and the frontend can display it
    res.json(requests);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error fetching requests' });
  }
};

exports.acceptRequest = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const { request_id } = req.body;

    const [requests] = await pool.query(`
      SELECT rq.*, r.owner_id, r.current_occupancy, r.total_capacity, r.block, r.room_type
      FROM room_requests rq
      JOIN rooms r ON rq.room_id = r.room_id
      WHERE rq.request_id = ?
    `, [request_id]);

    if (requests.length === 0) return res.status(404).json({ message: 'Request not found' });
    
    const request = requests[0];
    if (request.owner_id !== ownerId) return res.status(403).json({ message: 'Unauthorized' });
    if (request.current_occupancy >= request.total_capacity) return res.status(400).json({ message: 'Room is already full' });

    // Update Request Status
    await pool.query("UPDATE room_requests SET status = 'accepted' WHERE request_id = ?", [request_id]);
    
    // Update Room Occupancy
    await pool.query("UPDATE rooms SET current_occupancy = current_occupancy + 1 WHERE room_id = ?", [request.room_id]);

    // Create Notification and Emit
    const message = `Your request to join room ${request.block} (${request.room_type}) has been accepted!`;
    const [result] = await pool.query(
      "INSERT INTO notifications (user_id, message) VALUES (?, ?)", 
      [request.user_id, message]
    );

    const io = socket.getIo();
    console.log(`[Socket] Emitting new_notification to user_${request.user_id} for Acceptance`);
    io.to(`user_${request.user_id}`).emit('new_notification', {
      id: result.insertId,
      user_id: request.user_id,
      message,
      is_read: 0,
      created_at: new Date()
    });

    res.json({ message: 'Request accepted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error accepting request' });
  }
};

exports.rejectRequest = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const { request_id } = req.body;

    const [requests] = await pool.query(`
      SELECT rq.*, r.owner_id, r.block, r.room_type 
      FROM room_requests rq
      JOIN rooms r ON rq.room_id = r.room_id
      WHERE rq.request_id = ?
    `, [request_id]);

    if (requests.length === 0) return res.status(404).json({ message: 'Request not found' });
    
    if (requests[0].owner_id !== ownerId) return res.status(403).json({ message: 'Unauthorized' });

    await pool.query("UPDATE room_requests SET status = 'rejected' WHERE request_id = ?", [request_id]);
    
    const request = requests[0];
    const message = `Your request to join room ${request.block} (${request.room_type}) has been rejected.`;
    const [result] = await pool.query(
      "INSERT INTO notifications (user_id, message) VALUES (?, ?)", 
      [request.user_id, message]
    );

    const io = socket.getIo();
    console.log(`[Socket] Emitting new_notification to user_${request.user_id} for Rejection`);
    io.to(`user_${request.user_id}`).emit('new_notification', {
      id: result.insertId,
      user_id: request.user_id,
      message,
      is_read: 0,
      created_at: new Date()
    });

    res.json({ message: 'Request rejected' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error rejecting request' });
  }
};
