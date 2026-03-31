const router = require('express').Router();
const auth = require('../middleware/auth');

// Get chat messages
router.get('/:groupId', auth(['mentor', 'student']), async (req, res) => {
  const db = req.app.get('db');
  try {
    const result = await db.query(
      'SELECT * FROM chat_messages WHERE group_id=$1 ORDER BY created_at ASC LIMIT 100',
      [req.params.groupId]
    );
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Send message
router.post('/:groupId', auth(['mentor', 'student']), async (req, res) => {
  const db = req.app.get('db');
  const { message } = req.body;
  const role = req.user.role;
  
  try {
    let senderName = '';
    if (role === 'student') {
      const u = await db.query('SELECT full_name FROM users WHERE id=$1', [req.user.id]);
      senderName = u.rows[0]?.full_name || 'O\'quvchi';
    } else {
      const m = await db.query('SELECT full_name FROM mentors WHERE id=$1', [req.user.id]);
      senderName = m.rows[0]?.full_name || 'Mentor';
    }

    const result = await db.query(
      `INSERT INTO chat_messages (group_id, sender_id, sender_type, sender_name, message)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.params.groupId, req.user.id, role, senderName, message]
    );
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
