const pool = require('../db/config');
const socket = require('../socket');

exports.applyRoom = async (req, res) => {
  const userId = req.user.id;
  const roomId = Number(req.body.room_id);
  if (!Number.isInteger(roomId) || roomId < 1) return res.status(400).json({ message: 'Choose a valid room.' });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rooms] = await connection.query('SELECT * FROM rooms WHERE room_id = ? FOR UPDATE', [roomId]);
    if (!rooms.length) {
      await connection.rollback();
      return res.status(404).json({ message: 'Room not found.' });
    }
    const room = rooms[0];
    if (String(room.owner_id) === String(userId)) {
      await connection.rollback();
      return res.status(400).json({ message: 'You cannot apply to your own room.' });
    }
    if (room.status !== 'open') {
      await connection.rollback();
      return res.status(409).json({ message: 'This room is currently closed to applications.' });
    }
    if (Number(room.current_occupancy) >= Number(room.total_capacity)) {
      await connection.rollback();
      return res.status(409).json({ message: 'This room is full.' });
    }

    const [owned] = await connection.query('SELECT room_id FROM rooms WHERE owner_id = ? LIMIT 1', [userId]);
    if (owned.length) {
      await connection.rollback();
      return res.status(409).json({ message: 'You already own a room. One room relationship is allowed per account.' });
    }
    const [existing] = await connection.query('SELECT request_id, status FROM room_requests WHERE room_id = ? AND user_id = ? LIMIT 1', [roomId, userId]);
    if (existing.length) {
      await connection.rollback();
      return res.status(409).json({ message: existing[0].status === 'rejected' ? 'You already applied to this room previously.' : 'You already applied to this room.' });
    }
    const [active] = await connection.query(
      "SELECT request_id FROM room_requests WHERE user_id = ? AND status IN ('applied', 'accepted') LIMIT 1 FOR UPDATE",
      [userId]
    );
    if (active.length) {
      await connection.rollback();
      return res.status(409).json({ message: 'You already have an active application or room membership. You can only apply to one room at a time.' });
    }

    await connection.query('INSERT INTO room_requests (room_id, user_id, status) VALUES (?, ?, ?)', [roomId, userId, 'applied']);
    await connection.commit();
    res.status(201).json({ message: 'Application sent successfully.' });
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'You already have an active room application.' });
    console.error('Room application failed:', error);
    res.status(500).json({ message: 'Server error applying to this room.' });
  } finally {
    connection.release();
  }
};

exports.getOwnerRequests = async (req, res) => {
  try {
    const [requests] = await pool.query(
      "SELECT rq.*, r.block, r.room_type, u.name AS applicant_name, u.username AS applicant_username, u.email AS applicant_email, p.language, p.branch, p.cgpa_range, p.sleep_pref, p.study_pref, p.food_pref, p.cleanliness, p.bed_pref FROM room_requests rq JOIN rooms r ON rq.room_id = r.room_id JOIN users u ON rq.user_id = u.id LEFT JOIN profiles p ON rq.user_id = p.user_id WHERE r.owner_id = ? AND rq.status = 'applied' ORDER BY rq.request_id DESC",
      [req.user.id]
    );
    res.json(requests);
  } catch (error) {
    console.error('Owner request list failed:', error);
    res.status(500).json({ message: 'Server error fetching applications.' });
  }
};

exports.acceptRequest = async (req, res) => {
  const ownerId = req.user.id;
  const requestId = Number(req.body.request_id);
  const connection = await pool.getConnection();
  let notificationUserId = null;
  let notificationMessage = '';

  try {
    await connection.beginTransaction();
    const [requests] = await connection.query(
      'SELECT rq.*, r.owner_id, r.current_occupancy, r.total_capacity, r.status AS room_status, r.block, r.room_type FROM room_requests rq JOIN rooms r ON r.room_id = rq.room_id WHERE rq.request_id = ? FOR UPDATE',
      [requestId]
    );
    if (!requests.length) {
      await connection.rollback();
      return res.status(404).json({ message: 'Application not found.' });
    }
    const request = requests[0];
    if (String(request.owner_id) !== String(ownerId)) {
      await connection.rollback();
      return res.status(403).json({ message: 'You cannot manage this application.' });
    }
    if (request.status !== 'applied') {
      await connection.rollback();
      return res.status(409).json({ message: 'This application has already been processed.' });
    }
    if (request.room_status !== 'open' || Number(request.current_occupancy) >= Number(request.total_capacity)) {
      await connection.rollback();
      return res.status(409).json({ message: 'This room is closed or full.' });
    }
    const [otherApplications] = await connection.query(
      "SELECT request_id FROM room_requests WHERE user_id = ? AND status IN ('applied', 'accepted') AND request_id <> ? LIMIT 1 FOR UPDATE",
      [request.user_id, requestId]
    );
    const [ownedRooms] = await connection.query('SELECT room_id FROM rooms WHERE owner_id = ? LIMIT 1', [request.user_id]);
    if (otherApplications.length || ownedRooms.length) {
      await connection.rollback();
      return res.status(409).json({ message: 'This student already has another active room relationship.' });
    }

    await connection.query("UPDATE room_requests SET status = 'accepted' WHERE request_id = ?", [requestId]);
    await connection.query('UPDATE rooms SET current_occupancy = current_occupancy + 1 WHERE room_id = ?', [request.room_id]);
    await connection.commit();

    notificationUserId = request.user_id;
    notificationMessage = 'Your request to join ' + request.block + ' (' + request.room_type + ') has been accepted.';
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'This student already has an active room relationship.' });
    console.error('Accept application failed:', error);
    return res.status(500).json({ message: 'Server error accepting the application.' });
  } finally {
    connection.release();
  }

  if (notificationUserId) {
    try {
      const [result] = await pool.query('INSERT INTO notifications (user_id, message) VALUES (?, ?)', [notificationUserId, notificationMessage]);
      const io = socket.getIo();
      if (io) io.to('user_' + notificationUserId).emit('new_notification', {
        id: result.insertId,
        user_id: notificationUserId,
        message: notificationMessage,
        is_read: 0,
        created_at: new Date()
      });
    } catch (error) {
      console.error('Acceptance notification failed:', error);
    }
  }
  res.json({ message: 'Application accepted successfully.' });
};

exports.rejectRequest = async (req, res) => {
  const ownerId = req.user.id;
  const requestId = Number(req.body.request_id);
  let notificationUserId = null;
  let notificationMessage = '';
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const [requests] = await connection.query(
      'SELECT rq.*, r.owner_id, r.block, r.room_type FROM room_requests rq JOIN rooms r ON r.room_id = rq.room_id WHERE rq.request_id = ? FOR UPDATE',
      [requestId]
    );
    if (!requests.length) {
      await connection.rollback();
      return res.status(404).json({ message: 'Application not found.' });
    }
    const request = requests[0];
    if (String(request.owner_id) !== String(ownerId)) {
      await connection.rollback();
      return res.status(403).json({ message: 'You cannot manage this application.' });
    }
    if (request.status !== 'applied') {
      await connection.rollback();
      return res.status(409).json({ message: 'This application has already been processed.' });
    }
    await connection.query("UPDATE room_requests SET status = 'rejected' WHERE request_id = ?", [requestId]);
    await connection.commit();
    notificationUserId = request.user_id;
    notificationMessage = 'Your request to join ' + request.block + ' (' + request.room_type + ') was declined.';
  } catch (error) {
    await connection.rollback();
    console.error('Reject application failed:', error);
    return res.status(500).json({ message: 'Server error rejecting the application.' });
  } finally {
    connection.release();
  }

  if (notificationUserId) {
    try {
      const [result] = await pool.query('INSERT INTO notifications (user_id, message) VALUES (?, ?)', [notificationUserId, notificationMessage]);
      const io = socket.getIo();
      if (io) io.to('user_' + notificationUserId).emit('new_notification', {
        id: result.insertId,
        user_id: notificationUserId,
        message: notificationMessage,
        is_read: 0,
        created_at: new Date()
      });
    } catch (error) {
      console.error('Rejection notification failed:', error);
    }
  }
  res.json({ message: 'Application rejected successfully.' });
};
