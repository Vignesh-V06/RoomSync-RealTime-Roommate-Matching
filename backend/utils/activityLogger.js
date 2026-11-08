const pool = require('../db/config');

/**
 * Best-effort audit/analytics event writer.
 * Never stores message text, passwords, OTPs, email addresses or phone numbers.
 */
const recordActivity = async ({
  actorUserId = null,
  subjectUserId = null,
  eventType,
  entityType = null,
  entityId = null,
  metadata = null
}) => {
  if (!eventType || !/^[a-z_]{3,50}$/.test(eventType)) return;

  try {
    await pool.query(
      'INSERT INTO activity_events (actor_user_id, subject_user_id, event_type, entity_type, entity_id, metadata) VALUES (?, ?, ?, ?, ?, ?)',
      [
        actorUserId ? Number(actorUserId) : null,
        subjectUserId ? Number(subjectUserId) : null,
        eventType,
        entityType,
        entityId == null ? null : String(entityId),
        metadata == null ? null : JSON.stringify(metadata)
      ]
    );
  } catch (error) {
    // Analytics must never break core student/room flows.
    console.error('Activity event could not be recorded:', eventType, error.message);
  }
};

module.exports = recordActivity;
