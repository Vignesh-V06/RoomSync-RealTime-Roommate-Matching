const pool = require('../db/config');

const calculateCompatibility = (userProfile, otherProfile) => {
  let score = 0;
  let matches = [];
  if (!otherProfile) return { score, matches };
  
  if (userProfile.language === otherProfile.language) { score += 30; matches.push('Language'); }
  if (userProfile.branch === otherProfile.branch) { score += 20; matches.push('Branch'); }
  if (userProfile.cgpa_range === otherProfile.cgpa_range) { score += 15; matches.push('CGPA Range'); }
  if (userProfile.sleep_pref === otherProfile.sleep_pref) { score += 15; matches.push('Sleep Routine'); }
  if (userProfile.study_pref === otherProfile.study_pref) { score += 10; matches.push('Study Habit'); }
  if (userProfile.food_pref === otherProfile.food_pref) { score += 10; matches.push('Dietary C.'); }

  return { score, matches };
};

exports.createRoom = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const { block, room_type, total_capacity, use_custom_logic, additional_requirements } = req.body;

    const [result] = await pool.query(
      `INSERT INTO rooms (owner_id, block, room_type, total_capacity, current_occupancy, use_custom_logic, additional_requirements)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [ownerId, block, room_type, total_capacity, 1, use_custom_logic || false, additional_requirements || '']
    );

    res.status(201).json({ message: 'Room created successfully', room_id: result.insertId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error creating room' });
  }
};

exports.getVacantRooms = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get current user's profile
    const [userProfiles] = await pool.query('SELECT * FROM profiles WHERE user_id = ?', [userId]);
    const userProfile = userProfiles.length > 0 ? userProfiles[0] : null;

    // Get vacant rooms not owned by the user
    // Include the owner's profile to calculate compatibility
    const [rooms] = await pool.query(`
      SELECT r.*, u.name as owner_name, p.language, p.branch, p.cgpa_range, p.sleep_pref, p.study_pref, p.food_pref
      FROM rooms r
      JOIN users u ON r.owner_id = u.id
      LEFT JOIN profiles p ON r.owner_id = p.user_id
      WHERE r.owner_id != ? AND r.current_occupancy < r.total_capacity
    `, [userId]);

    const roomsWithScore = rooms.map(room => {
      const ownerProfile = {
        language: room.language,
        branch: room.branch,
        cgpa_range: room.cgpa_range,
        sleep_pref: room.sleep_pref,
        study_pref: room.study_pref,
        food_pref: room.food_pref
      };
      const compatibility = userProfile ? calculateCompatibility(userProfile, ownerProfile) : { score: 0, matches: [] };
      
      // Clean up the output
      delete room.language; delete room.branch; delete room.cgpa_range;
      delete room.sleep_pref; delete room.study_pref; delete room.food_pref;
      
      return { ...room, compatibility_score: compatibility.score, compatibility_matches: compatibility.matches };
    });

    // Sort by compatibility score descending
    roomsWithScore.sort((a, b) => b.compatibility_score - a.compatibility_score);

    res.json(roomsWithScore);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error fetching vacant rooms' });
  }
};

exports.getMyGroups = async (req, res) => {
  try {
    const userId = req.user.id;
    // Get rooms the user owns
    // Get rooms the user is accepted in
    const [rooms] = await pool.query(`
      SELECT DISTINCT r.room_id, r.block, r.room_type, r.owner_id,
      (SELECT name FROM users WHERE id = r.owner_id) as owner_name,
      (SELECT MAX(created_at) FROM chat_messages WHERE room_id = r.room_id) as last_activity
      FROM rooms r
      LEFT JOIN room_requests rq ON r.room_id = rq.room_id
      WHERE r.owner_id = ? OR (rq.user_id = ? AND rq.status = 'accepted')
      ORDER BY last_activity DESC
    `, [userId, userId]);

    res.json(rooms);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error fetching your groups' });
  }
};

exports.getMyApplications = async (req, res) => {
  try {
    const userId = req.user.id;
    const [applications] = await pool.query(`
      SELECT rq.request_id, rq.status, r.room_id, r.block, r.room_type, 
             u.name as owner_name, u.email as owner_email
      FROM room_requests rq
      JOIN rooms r ON rq.room_id = r.room_id
      JOIN users u ON r.owner_id = u.id
      WHERE rq.user_id = ?
      ORDER BY rq.request_id DESC
    `, [userId]);

    res.json(applications);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error fetching applications' });
  }
};
