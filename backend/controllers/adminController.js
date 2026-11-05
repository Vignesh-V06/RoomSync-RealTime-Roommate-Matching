const pool = require('../db/config');

exports.getAnalytics = async (req, res) => {
  try {
    const [
      [users],
      [rooms],
      [applications],
      [engagement],
      [topRooms],
      [blocks],
      [recentSignups]
    ] = await Promise.all([
      pool.query("SELECT COUNT(*) AS total_users, SUM(created_at >= NOW() - INTERVAL 30 DAY) AS new_users_30d, SUM(last_login_at >= NOW() - INTERVAL 30 DAY) AS active_users_30d FROM users WHERE role <> 'admin'"),
      pool.query("SELECT COUNT(*) AS total_rooms, SUM(status = 'open') AS open_rooms, SUM(status = 'closed') AS closed_rooms, SUM(current_occupancy >= total_capacity) AS full_rooms FROM rooms"),
      pool.query("SELECT COUNT(*) AS total_applications, SUM(status = 'applied') AS pending_applications, SUM(status = 'accepted') AS accepted_applications, SUM(status = 'rejected') AS rejected_applications FROM room_requests"),
      pool.query('SELECT (SELECT COUNT(DISTINCT viewer_id) FROM room_views) AS unique_room_visitors, (SELECT COALESCE(SUM(view_count), 0) FROM room_views) AS room_impressions, (SELECT COUNT(*) FROM chat_messages) AS total_messages, (SELECT COUNT(*) FROM room_images) AS room_photos'),
      pool.query("SELECT r.room_id, r.block, r.room_type, r.status, u.name AS owner_name, (SELECT COUNT(DISTINCT v.viewer_id) FROM room_views v WHERE v.room_id = r.room_id) AS unique_visitors, (SELECT COUNT(*) FROM room_requests q WHERE q.room_id = r.room_id) AS applications, ((SELECT COUNT(DISTINCT v.viewer_id) FROM room_views v WHERE v.room_id = r.room_id) + (SELECT COUNT(*) FROM room_requests q WHERE q.room_id = r.room_id) * 3) AS rank_score FROM rooms r JOIN users u ON u.id = r.owner_id ORDER BY rank_score DESC, r.created_at DESC LIMIT 8"),
      pool.query('SELECT block, COUNT(*) AS room_count FROM rooms GROUP BY block ORDER BY room_count DESC LIMIT 8'),
      pool.query("SELECT DATE(created_at) AS day, COUNT(*) AS signups FROM users WHERE role <> 'admin' AND created_at >= CURDATE() - INTERVAL 6 DAY GROUP BY DATE(created_at) ORDER BY day ASC")
    ]);

    res.json({
      generated_at: new Date().toISOString(),
      users: users[0],
      rooms: rooms[0],
      applications: applications[0],
      engagement: engagement[0],
      top_rooms: topRooms,
      blocks,
      signups_last_7_days: recentSignups
    });
  } catch (error) {
    console.error('Admin analytics failed:', error);
    res.status(500).json({ message: 'Admin analytics are unavailable. Confirm the latest database migration has been applied.' });
  }
};
