const pool = require('../db/config');
const recordActivity = require('../utils/activityLogger');

const parseJson = (value, fallback) => {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return fallback; }
};

const slug = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);

const normalizeOptions = (value) => {
  let list = value;
  if (typeof list === 'string') list = parseJson(list, []);
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  return list.slice(0, 8).map((item) => {
    const label = String(item.label || '').trim().slice(0, 40);
    const optionValue = String(item.value || '').trim().slice(0, 100);
    const key = slug(item.key || label);
    if (!label || !optionValue || !key || seen.has(key)) return null;
    seen.add(key);
    return { key, label, value: optionValue };
  }).filter(Boolean);
};

const normalizePreferences = (value) => {
  const preferences = parseJson(value, {});
  return preferences && typeof preferences === 'object' && !Array.isArray(preferences) ? preferences : {};
};

const calculateCompatibility = (userProfile, ownerProfile, customOptions) => {
  if (!userProfile || !ownerProfile) return { score: 0, matches: [] };
  const criteria = [
    ['language', 'Language', 15],
    ['branch', 'Academic branch', 10],
    ['cgpa_range', 'CGPA range', 5],
    ['sleep_pref', 'Sleep routine', 15],
    ['study_pref', 'Study habits', 15],
    ['food_pref', 'Food preference', 10],
    ['cleanliness', 'Cleanliness', 10],
    ['bed_pref', 'Bed preference', 5]
  ];
  let possible = 0;
  let earned = 0;
  const matches = [];

  criteria.forEach(([key, label, weight]) => {
    const mine = String(userProfile[key] || '').trim();
    const theirs = String(ownerProfile[key] || '').trim();
    if (!theirs) return;
    possible += weight;
    if (mine && mine.toLowerCase() === theirs.toLowerCase()) {
      earned += weight;
      matches.push(label);
    }
  });

  const preferences = normalizePreferences(userProfile.custom_preferences);
  const options = normalizeOptions(customOptions);
  if (options.length) {
    const perOptionWeight = 15 / options.length;
    options.forEach((option) => {
      const mine = preferences[option.key] || preferences[option.label] || '';
      possible += perOptionWeight;
      if (String(mine).trim() && String(mine).trim().toLowerCase() === option.value.toLowerCase()) {
        earned += perOptionWeight;
        matches.push(option.label);
      }
    });
  }

  return {
    score: possible ? Math.round((earned / possible) * 100) : 0,
    matches,
    evaluated_factors: Math.round(possible)
  };
};

exports.createRoom = async (req, res) => {
  const ownerId = req.user.id;
  const block = String(req.body.block || '').trim();
  const roomType = String(req.body.room_type || '').trim();
  const bedType = String(req.body.bed_type || 'Normal Bed').trim();
  const capacity = Number(req.body.total_capacity);
  const notes = String(req.body.additional_requirements || '').trim().slice(0, 1000);
  const customOptions = normalizeOptions(req.body.custom_options);

  if (!block || block.length > 50) return res.status(400).json({ message: 'Enter a valid hostel block.' });
  if (!/^[1-4]-sharing$/i.test(roomType)) return res.status(400).json({ message: 'Choose a valid sharing type.' });
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 4) return res.status(400).json({ message: 'Room capacity must be between 1 and 4.' });
  if (!['Normal Bed', 'Bunk Bed'].includes(bedType)) return res.status(400).json({ message: 'Choose a valid bed type.' });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [owned] = await connection.query('SELECT room_id FROM rooms WHERE owner_id = ? LIMIT 1 FOR UPDATE', [ownerId]);
    if (owned.length) {
      await connection.rollback();
      return res.status(409).json({ message: 'Your account already owns a room. Manage its status from the owner dashboard.' });
    }
    const [activeRequests] = await connection.query(
      "SELECT request_id FROM room_requests WHERE user_id = ? AND status IN ('applied', 'accepted') LIMIT 1 FOR UPDATE",
      [ownerId]
    );
    if (activeRequests.length) {
      await connection.rollback();
      return res.status(409).json({ message: 'You already have an active room application or membership. You can only have one room relationship at a time.' });
    }

    const [result] = await connection.query(
      'INSERT INTO rooms (owner_id, block, room_type, bed_type, total_capacity, current_occupancy, use_custom_logic, additional_requirements, custom_options, status) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?)',
      [ownerId, block, roomType, bedType, capacity, customOptions.length > 0, notes, JSON.stringify(customOptions), 'open']
    );
    await connection.commit();
    await recordActivity({ actorUserId: ownerId, subjectUserId: ownerId, eventType: 'room_created', entityType: 'room', entityId: result.insertId });
    res.status(201).json({ message: 'Room created successfully.', room_id: result.insertId });
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Your account already owns a room.' });
    console.error('Room creation failed:', error);
    res.status(500).json({ message: 'Server error creating room.' });
  } finally {
    connection.release();
  }
};

exports.getVacantRooms = async (req, res) => {
  try {
    const userId = req.user.id;
    const [userProfiles] = await pool.query('SELECT * FROM profiles WHERE user_id = ? LIMIT 1', [userId]);
    const userProfile = userProfiles[0] || null;

    const [rooms] = await pool.query(
      "SELECT r.*, u.name AS owner_name, u.username AS owner_username, p.language, p.branch, p.cgpa_range, p.bed_pref, p.sleep_pref, p.study_pref, p.food_pref, p.cleanliness FROM rooms r JOIN users u ON r.owner_id = u.id LEFT JOIN profiles p ON r.owner_id = p.user_id WHERE r.owner_id <> ? AND r.status = 'open' AND r.current_occupancy < r.total_capacity ORDER BY r.created_at DESC",
      [userId]
    );


    const result = rooms.map((room) => {
      const ownerProfile = {
        language: room.language,
        branch: room.branch,
        cgpa_range: room.cgpa_range,
        bed_pref: room.bed_pref,
        sleep_pref: room.sleep_pref,
        study_pref: room.study_pref,
        food_pref: room.food_pref,
        cleanliness: room.cleanliness
      };
      const compatibility = calculateCompatibility(userProfile, ownerProfile, room.custom_options);
      delete room.language;
      delete room.branch;
      delete room.cgpa_range;
      delete room.bed_pref;
      delete room.sleep_pref;
      delete room.study_pref;
      delete room.food_pref;
      delete room.cleanliness;
      room.custom_options = normalizeOptions(room.custom_options);
      return {
        ...room,
        compatibility_score: compatibility.score,
        compatibility_matches: compatibility.matches,
        evaluated_factors: compatibility.evaluated_factors || 0
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Room discovery failed:', error);
    res.status(500).json({ message: 'Server error fetching vacant rooms.' });
  }
};


exports.getRoomPreview = async (req, res) => {
  try {
    const roomId = Number(req.params.roomId);
    if (!Number.isInteger(roomId) || roomId < 1) return res.status(400).json({ message: 'Invalid room.' });
    const [rooms] = await pool.query(
      "SELECT r.*, u.name AS owner_name, p.language, p.branch, p.cgpa_range, p.bed_pref, p.sleep_pref, p.study_pref, p.food_pref, p.cleanliness FROM rooms r JOIN users u ON u.id = r.owner_id LEFT JOIN profiles p ON p.user_id = r.owner_id WHERE r.room_id = ? AND r.status = 'open' LIMIT 1",
      [roomId]
    );
    if (!rooms.length) return res.status(404).json({ message: 'This room is no longer available.' });

    const room = rooms[0];
    const [viewerProfiles] = await pool.query('SELECT * FROM profiles WHERE user_id = ? LIMIT 1', [req.user.id]);
    const ownerProfile = {
      language: room.language, branch: room.branch, cgpa_range: room.cgpa_range,
      bed_pref: room.bed_pref, sleep_pref: room.sleep_pref, study_pref: room.study_pref,
      food_pref: room.food_pref, cleanliness: room.cleanliness
    };
    const compatibility = calculateCompatibility(viewerProfiles[0] || null, ownerProfile, room.custom_options);
    delete room.language; delete room.branch; delete room.cgpa_range; delete room.bed_pref;
    delete room.sleep_pref; delete room.study_pref; delete room.food_pref; delete room.cleanliness;
    room.compatibility_score = compatibility.score;
    room.compatibility_matches = compatibility.matches;
    if (String(room.owner_id) !== String(req.user.id)) {
      await pool.query(
        'INSERT INTO room_views (room_id, viewer_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE view_count = view_count + 1, last_viewed_at = CURRENT_TIMESTAMP',
        [roomId, req.user.id]
      );
      await recordActivity({ actorUserId: req.user.id, subjectUserId: room.owner_id, eventType: 'room_viewed', entityType: 'room', entityId: roomId });
    }
    const [images] = await pool.query(
      'SELECT id, original_name, mime_type FROM room_images WHERE room_id = ? ORDER BY id ASC',
      [roomId]
    );
    room.custom_options = normalizeOptions(room.custom_options);
    res.json({ room, images });
  } catch (error) {
    console.error('Room preview failed:', error);
    res.status(500).json({ message: 'Server error loading room details.' });
  }
};

exports.getMyGroups = async (req, res) => {
  try {
    const userId = req.user.id;
    const [rooms] = await pool.query(
      "SELECT DISTINCT r.room_id, r.block, r.room_type, r.owner_id, r.status, r.bed_type, u.name AS owner_name, (SELECT MAX(m.created_at) FROM chat_messages m WHERE m.room_id = r.room_id) AS last_activity FROM rooms r JOIN users u ON u.id = r.owner_id LEFT JOIN room_requests rq ON rq.room_id = r.room_id AND rq.user_id = ? AND rq.status = 'accepted' WHERE r.owner_id = ? OR rq.user_id = ? ORDER BY last_activity DESC, r.room_id DESC LIMIT 1",
      [userId, userId, userId]
    );
    res.json(rooms);
  } catch (error) {
    console.error('Room conversations failed:', error);
    res.status(500).json({ message: 'Server error fetching your conversations.' });
  }
};

exports.getMyApplications = async (req, res) => {
  try {
    const [applications] = await pool.query(
      'SELECT rq.request_id, rq.status, rq.created_at, r.room_id, r.block, r.room_type, r.status AS room_status, u.name AS owner_name, u.email AS owner_email FROM room_requests rq JOIN rooms r ON rq.room_id = r.room_id JOIN users u ON r.owner_id = u.id WHERE rq.user_id = ? ORDER BY rq.request_id DESC',
      [req.user.id]
    );
    res.json(applications);
  } catch (error) {
    console.error('Application history failed:', error);
    res.status(500).json({ message: 'Server error fetching applications.' });
  }
};

exports.getOwnerAnalytics = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const [rooms] = await pool.query(
      "SELECT r.*, (SELECT COALESCE(SUM(v.view_count), 0) FROM room_views v WHERE v.room_id = r.room_id) AS total_views, (SELECT COUNT(DISTINCT v.viewer_id) FROM room_views v WHERE v.room_id = r.room_id) AS unique_visitors, (SELECT COUNT(*) FROM room_requests q WHERE q.room_id = r.room_id) AS application_count, (SELECT COUNT(*) FROM room_requests q WHERE q.room_id = r.room_id AND q.status = 'accepted') AS accepted_count, (SELECT COUNT(*) FROM room_requests q WHERE q.room_id = r.room_id AND q.status = 'applied') AS pending_count FROM rooms r WHERE r.owner_id = ? LIMIT 1",
      [ownerId]
    );
    if (!rooms.length) return res.json({ room: null, rank: null, total_open_rooms: 0 });
    const room = rooms[0];
    room.custom_options = normalizeOptions(room.custom_options);
    const [ranking] = await pool.query(
      "SELECT r.room_id, (SELECT COUNT(DISTINCT v.viewer_id) FROM room_views v WHERE v.room_id = r.room_id) + ((SELECT COUNT(*) FROM room_requests q WHERE q.room_id = r.room_id) * 3) AS rank_score FROM rooms r WHERE r.status = 'open' ORDER BY rank_score DESC, r.created_at ASC"
    );
    const rankIndex = ranking.findIndex((item) => String(item.room_id) === String(room.room_id));
    const [counts] = await pool.query("SELECT COUNT(*) AS total_open_rooms FROM rooms WHERE status = 'open'");
    res.json({ room, rank: room.status === 'open' && rankIndex >= 0 ? rankIndex + 1 : null, total_open_rooms: counts[0].total_open_rooms });
  } catch (error) {
    console.error('Owner analytics failed:', error);
    res.status(500).json({ message: 'Server error fetching owner analytics.' });
  }
};

exports.setRoomStatus = async (req, res) => {
  const status = String(req.body.status || '').toLowerCase();
  if (!['open', 'closed'].includes(status)) return res.status(400).json({ message: 'Choose open or closed.' });
  try {
    const [rooms] = await pool.query('SELECT room_id, total_capacity, current_occupancy FROM rooms WHERE owner_id = ? LIMIT 1', [req.user.id]);
    if (!rooms.length) return res.status(404).json({ message: 'You do not have a room to update.' });
    if (status === 'open' && Number(rooms[0].current_occupancy) >= Number(rooms[0].total_capacity)) {
      return res.status(409).json({ message: 'A full room cannot be reopened until a space becomes available.' });
    }
    await pool.query('UPDATE rooms SET status = ? WHERE room_id = ?', [status, rooms[0].room_id]);
    await recordActivity({ actorUserId: req.user.id, subjectUserId: req.user.id, eventType: 'room_status_changed', entityType: 'room', entityId: rooms[0].room_id, metadata: { status } });
    res.json({ message: 'Room status updated.', status });
  } catch (error) {
    console.error('Room status update failed:', error);
    res.status(500).json({ message: 'Server error updating room status.' });
  }
};

const requireRoomMember = async (roomId, userId) => {
  const [rooms] = await pool.query('SELECT room_id, owner_id FROM rooms WHERE room_id = ? LIMIT 1', [roomId]);
  if (!rooms.length) return { error: 404, message: 'Room not found.' };
  const room = rooms[0];
  if (String(room.owner_id) !== String(userId)) {
    const [members] = await pool.query(
      "SELECT request_id FROM room_requests WHERE room_id = ? AND user_id = ? AND status = 'accepted' LIMIT 1",
      [roomId, userId]
    );
    if (!members.length) return { error: 403, message: 'You are not a member of this room.' };
  }
  return { room };
};

exports.getRoomDetails = async (req, res) => {
  try {
    const access = await requireRoomMember(req.params.roomId, req.user.id);
    if (access.error) return res.status(access.error).json({ message: access.message });
    const room = access.room;
    const [details] = await pool.query(
      'SELECT r.*, u.name AS owner_name FROM rooms r JOIN users u ON u.id = r.owner_id WHERE r.room_id = ? LIMIT 1',
      [room.room_id]
    );
    const [members] = await pool.query(
      "SELECT u.id, u.name, COALESCE(u.username, SUBSTRING_INDEX(u.email, '@', 1)) AS username, u.email, u.phone, u.role, CASE WHEN u.id = ? THEN 1 ELSE 0 END AS is_owner FROM users u WHERE u.id = ? OR u.id IN (SELECT user_id FROM room_requests WHERE room_id = ? AND status = 'accepted') ORDER BY is_owner DESC, u.name ASC",
      [room.owner_id, room.owner_id, room.room_id]
    );
    const [images] = await pool.query(
      'SELECT id, original_name, mime_type, created_at FROM room_images WHERE room_id = ? ORDER BY id ASC',
      [room.room_id]
    );
    details[0].custom_options = normalizeOptions(details[0].custom_options);
    res.json({ room: details[0], members, images });
  } catch (error) {
    console.error('Room details failed:', error);
    res.status(500).json({ message: 'Server error fetching room details.' });
  }
};

exports.uploadRoomImage = async (req, res) => {
  try {
    const [rooms] = await pool.query('SELECT room_id FROM rooms WHERE room_id = ? AND owner_id = ? LIMIT 1', [req.params.roomId, req.user.id]);
    if (!rooms.length) return res.status(403).json({ message: 'Only the room owner can upload room photos.' });
    const mimeType = String(req.body.mime_type || '');
    const base64 = String(req.body.data_base64 || '').replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');
    const originalName = String(req.body.original_name || 'room-photo').slice(0, 120);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
      return res.status(400).json({ message: 'Use a JPG, PNG or WebP image.' });
    }
    if (!/^[A-Za-z0-9+/]+=*$/.test(base64)) return res.status(400).json({ message: 'The image file could not be read.' });
    const imageData = Buffer.from(base64, 'base64');
    if (!imageData.length || imageData.length > 4 * 1024 * 1024) {
      return res.status(413).json({ message: 'Each photo must be smaller than 4 MB.' });
    }
    const [count] = await pool.query('SELECT COUNT(*) AS total FROM room_images WHERE room_id = ?', [req.params.roomId]);
    if (Number(count[0].total) >= 5) return res.status(409).json({ message: 'A room can have up to five photos.' });
    const [result] = await pool.query(
      'INSERT INTO room_images (room_id, uploaded_by, original_name, mime_type, image_data) VALUES (?, ?, ?, ?, ?)',
      [req.params.roomId, req.user.id, originalName, mimeType, imageData]
    );
    await recordActivity({ actorUserId: req.user.id, subjectUserId: req.user.id, eventType: 'room_photo_uploaded', entityType: 'room', entityId: req.params.roomId, metadata: { image_id: result.insertId } });
    res.status(201).json({ id: result.insertId, original_name: originalName, mime_type: mimeType });
  } catch (error) {
    console.error('Room photo upload failed:', error);
    res.status(500).json({ message: 'Server error uploading the room photo.' });
  }
};

exports.getRoomImage = async (req, res) => {
  try {
    const [images] = await pool.query(
      'SELECT mime_type, image_data FROM room_images WHERE id = ? AND room_id = ? LIMIT 1',
      [req.params.imageId, req.params.roomId]
    );
    if (!images.length) return res.status(404).end();
    res.set('Content-Type', images[0].mime_type);
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(images[0].image_data);
  } catch (error) {
    console.error('Room photo read failed:', error);
    res.status(500).end();
  }
};
