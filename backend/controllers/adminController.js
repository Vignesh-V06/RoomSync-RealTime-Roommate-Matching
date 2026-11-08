const pool = require('../db/config');
const recordActivity = require('../utils/activityLogger');
const { createWorkbook } = require('../utils/xlsxWorkbook');

const RANGE_DAYS = Object.freeze({ '3m': 90, '12m': 365, all: null });
const DATASETS = new Set(['overview', 'users', 'rooms', 'applications', 'activity']);
const EXPORT_LIMIT = 20000;

const normalizeRange = (value) => Object.prototype.hasOwnProperty.call(RANGE_DAYS, value) ? value : '12m';
const dateClause = (column, range) => {
  const days = RANGE_DAYS[range];
  return days ? ` AND ${column} >= DATE_SUB(NOW(), INTERVAL ${days} DAY)` : '';
};
const safeJson = (value) => {
  if (value && typeof value === 'object') return value;
  try { return JSON.parse(value || '{}'); } catch { return {}; }
};
const csvCell = (value) => {
  if (value == null) return '';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  const safe = /^[\s]*[=+@\-]/.test(text) ? "'" + text : text;
  return '"' + safe.replace(/"/g, '""') + '"';
};
const toCsv = (rows) => {
  if (!rows.length) return '\uFEFFNo records found\r\n';
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return '\uFEFF' + [
    columns.map(csvCell).join(','),
    ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(','))
  ].join('\r\n');
};

const getAnalyticsData = async (range) => {
  const [
    [users],
    [usersInRange],
    [profiles],
    [rooms],
    [applications],
    [engagement],
    [funnel],
    [monthly],
    [topRooms],
    [blocks],
    [recentUsers],
    [recentActivity],
    [activeUsers]
  ] = await Promise.all([
    pool.query("SELECT COUNT(*) AS total_users, SUM(created_at >= NOW() - INTERVAL 30 DAY) AS new_users_30d, SUM(last_login_at >= NOW() - INTERVAL 30 DAY) AS active_users_30d FROM users WHERE role <> 'admin'"),
    pool.query(`SELECT COUNT(*) AS users_in_range FROM users WHERE role <> 'admin' AND 1=1${dateClause('created_at', range)}`),
    pool.query("SELECT COUNT(*) AS completed_profiles FROM profiles p JOIN users u ON u.id = p.user_id WHERE u.role <> 'admin'"),
    pool.query(`SELECT COUNT(*) AS total_rooms, SUM(status = 'open') AS open_rooms, SUM(status = 'closed') AS closed_rooms, SUM(current_occupancy >= total_capacity) AS full_rooms, COALESCE(SUM(current_occupancy), 0) AS occupied_beds, COALESCE(SUM(total_capacity), 0) AS total_beds FROM rooms WHERE 1=1${dateClause('created_at', range)}`),
    pool.query(`SELECT COUNT(*) AS total_applications, SUM(status = 'applied') AS pending_applications, SUM(status = 'accepted') AS accepted_applications, SUM(status = 'rejected') AS rejected_applications FROM room_requests WHERE 1=1${dateClause('created_at', range)}`),
    pool.query(`SELECT
      (SELECT COUNT(DISTINCT viewer_id) FROM room_views WHERE 1=1${dateClause('last_viewed_at', range)}) AS unique_room_visitors,
      (SELECT COALESCE(SUM(view_count), 0) FROM room_views WHERE 1=1${dateClause('last_viewed_at', range)}) AS room_impressions,
      (SELECT COUNT(*) FROM chat_messages WHERE 1=1${dateClause('created_at', range)}) AS total_messages,
      (SELECT COUNT(*) FROM room_images WHERE 1=1${dateClause('created_at', range)}) AS room_photos,
      (SELECT COUNT(*) FROM activity_events WHERE event_type = 'user_logged_in'${dateClause('occurred_at', range)}) AS tracked_logins,
      (SELECT COUNT(DISTINCT actor_user_id) FROM activity_events WHERE event_type = 'user_logged_in'${dateClause('occurred_at', range)}) AS tracked_login_users`),
    pool.query(`SELECT
      (SELECT COUNT(*) FROM users WHERE role <> 'admin') AS registered_users,
      (SELECT COUNT(*) FROM profiles p JOIN users u ON u.id = p.user_id WHERE u.role <> 'admin') AS profiled_users,
      (SELECT COUNT(DISTINCT viewer_id) FROM room_views) AS room_viewers,
      (SELECT COUNT(*) FROM room_requests) AS applications,
      (SELECT COUNT(*) FROM room_requests WHERE status = 'accepted') AS accepted_applications,
      (SELECT COUNT(DISTINCT sender_id) FROM chat_messages) AS chat_participants`),
    pool.query(`SELECT period, metric, amount FROM (
      SELECT DATE_FORMAT(created_at, '%Y-%m') AS period, 'Sign-ups' AS metric, COUNT(*) AS amount FROM users WHERE role <> 'admin'${dateClause('created_at', range)} GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      UNION ALL
      SELECT DATE_FORMAT(created_at, '%Y-%m'), 'Rooms created', COUNT(*) FROM rooms WHERE 1=1${dateClause('created_at', range)} GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      UNION ALL
      SELECT DATE_FORMAT(created_at, '%Y-%m'), 'Applications', COUNT(*) FROM room_requests WHERE 1=1${dateClause('created_at', range)} GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      UNION ALL
      SELECT DATE_FORMAT(created_at, '%Y-%m'), 'Messages', COUNT(*) FROM chat_messages WHERE 1=1${dateClause('created_at', range)} GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      UNION ALL
      SELECT DATE_FORMAT(occurred_at, '%Y-%m'), 'Logins (tracked)', COUNT(*) FROM activity_events WHERE event_type = 'user_logged_in'${dateClause('occurred_at', range)} GROUP BY DATE_FORMAT(occurred_at, '%Y-%m')
      UNION ALL
      SELECT DATE_FORMAT(occurred_at, '%Y-%m'), 'Room views (tracked)', COUNT(*) FROM activity_events WHERE event_type = 'room_viewed'${dateClause('occurred_at', range)} GROUP BY DATE_FORMAT(occurred_at, '%Y-%m')
    ) AS monthly_activity ORDER BY period ASC, metric ASC`),
    pool.query(`SELECT r.room_id, r.block, r.room_type, r.status, r.current_occupancy, r.total_capacity, u.name AS owner_name,
      (SELECT COUNT(DISTINCT v.viewer_id) FROM room_views v WHERE v.room_id = r.room_id) AS unique_visitors,
      (SELECT COALESCE(SUM(v.view_count), 0) FROM room_views v WHERE v.room_id = r.room_id) AS impressions,
      (SELECT COUNT(*) FROM room_requests q WHERE q.room_id = r.room_id) AS applications,
      (SELECT COUNT(*) FROM chat_messages m WHERE m.room_id = r.room_id) AS messages,
      ((SELECT COUNT(DISTINCT v.viewer_id) FROM room_views v WHERE v.room_id = r.room_id)
        + (SELECT COUNT(*) FROM room_requests q WHERE q.room_id = r.room_id) * 3
        + (SELECT COUNT(*) FROM chat_messages m WHERE m.room_id = r.room_id) * 0.25) AS engagement_score
      FROM rooms r JOIN users u ON u.id = r.owner_id
      ORDER BY engagement_score DESC, r.created_at DESC LIMIT 10`),
    pool.query(`SELECT r.block, COUNT(*) AS room_count, SUM(r.status = 'open') AS open_rooms,
      SUM(r.status = 'closed') AS closed_rooms, COALESCE(SUM(r.current_occupancy), 0) AS occupied_beds,
      COALESCE(SUM(r.total_capacity), 0) AS total_beds,
      (SELECT COUNT(*) FROM room_requests q JOIN rooms rr ON rr.room_id = q.room_id WHERE rr.block = r.block) AS applications
      FROM rooms r GROUP BY r.block ORDER BY room_count DESC, r.block ASC`),
    pool.query(`SELECT u.id, u.name, u.email, u.created_at, u.last_login_at, (p.user_id IS NOT NULL) AS has_profile,
      (SELECT COUNT(*) FROM rooms r WHERE r.owner_id = u.id) AS rooms_owned,
      (SELECT COUNT(*) FROM room_requests q WHERE q.user_id = u.id AND q.status IN ('applied','accepted')) AS active_relationships
      FROM users u LEFT JOIN profiles p ON p.user_id = u.id
      WHERE u.role <> 'admin' ORDER BY u.created_at DESC LIMIT 12`),
    pool.query(`SELECT e.id, e.event_type, e.entity_type, e.entity_id, e.metadata, e.occurred_at,
      actor.name AS actor_name, subject.name AS subject_name
      FROM activity_events e LEFT JOIN users actor ON actor.id = e.actor_user_id
      LEFT JOIN users subject ON subject.id = e.subject_user_id
      WHERE 1=1${dateClause('e.occurred_at', range)}
      ORDER BY e.occurred_at DESC, e.id DESC LIMIT 24`),
    pool.query(`SELECT u.id, u.name, COUNT(e.id) AS login_count, MAX(e.occurred_at) AS last_tracked_login
      FROM activity_events e JOIN users u ON u.id = e.actor_user_id
      WHERE e.event_type = 'user_logged_in'${dateClause('e.occurred_at', range)}
      GROUP BY u.id, u.name ORDER BY login_count DESC, last_tracked_login DESC LIMIT 8`)
  ]);

  return {
    generated_at: new Date().toISOString(),
    selected_range: range,
    tracking_note: 'Historical totals use existing database records. Event-based login and activity trends begin when event tracking was deployed.',
    users: { ...users[0], ...usersInRange[0], completed_profiles: profiles[0].completed_profiles },
    rooms: rooms[0],
    applications: applications[0],
    engagement: engagement[0],
    funnel: funnel[0],
    monthly_activity: monthly,
    top_rooms: topRooms,
    block_stats: blocks,
    recent_users: recentUsers,
    recent_activity: recentActivity.map((event) => ({ ...event, metadata: safeJson(event.metadata) })),
    most_active_users: activeUsers
  };
};

const getReportData = async (range) => {
  const clause = (column) => dateClause(column, range);
  const [overview, users, rooms, applications, activity] = await Promise.all([
    getAnalyticsData(range),
    pool.query(`SELECT u.id, u.name, u.username, u.email, u.created_at, u.last_login_at,
      (p.user_id IS NOT NULL) AS profile_completed,
      (SELECT COUNT(*) FROM rooms r WHERE r.owner_id = u.id) AS rooms_owned,
      (SELECT COUNT(*) FROM room_requests q WHERE q.user_id = u.id AND q.status IN ('applied','accepted')) AS active_room_relationships
      FROM users u LEFT JOIN profiles p ON p.user_id = u.id
      WHERE u.role <> 'admin' ORDER BY u.created_at DESC LIMIT ${EXPORT_LIMIT}`),
    pool.query(`SELECT r.room_id, r.block, r.room_type, r.bed_type, r.status, r.current_occupancy, r.total_capacity, r.created_at,
      u.name AS owner_name, u.email AS owner_email,
      (SELECT COUNT(DISTINCT v.viewer_id) FROM room_views v WHERE v.room_id = r.room_id) AS unique_visitors,
      (SELECT COALESCE(SUM(v.view_count), 0) FROM room_views v WHERE v.room_id = r.room_id) AS impressions,
      (SELECT COUNT(*) FROM room_requests q WHERE q.room_id = r.room_id) AS applications
      FROM rooms r JOIN users u ON u.id = r.owner_id
      WHERE 1=1${clause('r.created_at')} ORDER BY r.created_at DESC LIMIT ${EXPORT_LIMIT}`),
    pool.query(`SELECT q.request_id, q.status, q.created_at, r.room_id, r.block, r.room_type,
      applicant.name AS applicant_name, applicant.email AS applicant_email, owner.name AS owner_name
      FROM room_requests q JOIN rooms r ON r.room_id = q.room_id
      JOIN users applicant ON applicant.id = q.user_id JOIN users owner ON owner.id = r.owner_id
      WHERE 1=1${clause('q.created_at')} ORDER BY q.created_at DESC LIMIT ${EXPORT_LIMIT}`),
    pool.query(`SELECT e.id, e.event_type, e.entity_type, e.entity_id, e.metadata, e.occurred_at,
      actor.name AS actor_name, actor.email AS actor_email, subject.name AS subject_name
      FROM activity_events e LEFT JOIN users actor ON actor.id = e.actor_user_id
      LEFT JOIN users subject ON subject.id = e.subject_user_id
      WHERE 1=1${clause('e.occurred_at')} ORDER BY e.occurred_at DESC, e.id DESC LIMIT ${EXPORT_LIMIT}`)
  ]);

  return {
    overview: [
      { metric: 'Generated at', value: overview.generated_at },
      { metric: 'Selected range', value: range },
      { metric: 'Total student accounts', value: overview.users.total_users },
      { metric: 'Profiles completed', value: overview.users.completed_profiles },
      { metric: 'Rooms', value: overview.rooms.total_rooms },
      { metric: 'Open rooms', value: overview.rooms.open_rooms },
      { metric: 'Closed rooms', value: overview.rooms.closed_rooms },
      { metric: 'Applications', value: overview.applications.total_applications },
      { metric: 'Accepted applications', value: overview.applications.accepted_applications },
      { metric: 'Pending applications', value: overview.applications.pending_applications },
      { metric: 'Unique room visitors', value: overview.engagement.unique_room_visitors },
      { metric: 'Room impressions', value: overview.engagement.room_impressions },
      { metric: 'Chat messages', value: overview.engagement.total_messages },
      { metric: 'Tracked logins', value: overview.engagement.tracked_logins }
    ],
    users: users[0],
    rooms: rooms[0],
    applications: applications[0],
    activity: activity[0].map((event) => ({ ...event, metadata: safeJson(event.metadata) }))
  };
};

exports.getAnalytics = async (req, res) => {
  try {
    const range = normalizeRange(req.query.range);
    const data = await getAnalyticsData(range);
    res.set('Cache-Control', 'no-store');
    res.json(data);
  } catch (error) {
    console.error('Admin analytics failed:', error);
    res.status(500).json({ message: 'Admin analytics are unavailable. Confirm the activity and platform migrations have been applied.' });
  }
};

exports.exportReport = async (req, res) => {
  try {
    const range = normalizeRange(req.query.range);
    const format = String(req.query.format || 'xlsx').toLowerCase();
    if (!['xlsx', 'csv'].includes(format)) return res.status(400).json({ message: 'Choose xlsx or csv.' });

    const report = await getReportData(range);
    if (format === 'csv') {
      const dataset = String(req.query.dataset || 'overview').toLowerCase();
      if (!DATASETS.has(dataset)) return res.status(400).json({ message: 'Choose a supported report dataset.' });
      await recordActivity({ actorUserId: req.user.id, subjectUserId: req.user.id, eventType: 'admin_report_exported', entityType: 'report', entityId: dataset, metadata: { format, range } });
      const filename = `roomsync-${dataset}-${range}-report.csv`;
      res.set({
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff'
      });
      return res.send(toCsv(report[dataset]));
    }

    const sheets = [
      { name: 'Overview', rows: report.overview },
      { name: 'Users', rows: report.users },
      { name: 'Rooms', rows: report.rooms },
      { name: 'Applications', rows: report.applications },
      { name: 'Activity', rows: report.activity }
    ];
    const workbook = createWorkbook(sheets);
    await recordActivity({ actorUserId: req.user.id, subjectUserId: req.user.id, eventType: 'admin_report_exported', entityType: 'report', entityId: 'full_workbook', metadata: { format, range, sheets: sheets.length } });
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="roomsync-${range}-admin-report.xlsx"`,
      'Content-Length': workbook.length,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    });
    return res.send(workbook);
  } catch (error) {
    console.error('Admin report export failed:', error);
    return res.status(500).json({ message: 'The admin report could not be generated.' });
  }
};
