// assignments.js
const router = require('express').Router();
const auth = require('../middleware/auth');

// Add homework (mentor only)
router.post('/', auth(['mentor']), async (req, res) => {
  const db = req.app.get('db');
  const { group_id, title, description, due_date, due_time } = req.body;
  try {
    const result = await db.query(
      `INSERT INTO assignments (group_id, mentor_id, title, description, type, due_date, due_time)
       VALUES ($1,$2,$3,$4,'homework',$5,$6) RETURNING *`,
      [group_id, req.user.id, title, description, due_date, due_time]
    );
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get assignments for a group
router.get('/group/:id', auth(['mentor', 'student', 'admin']), async (req, res) => {
  const db = req.app.get('db');
  try {
    const result = await db.query(
      'SELECT * FROM assignments WHERE group_id=$1 ORDER BY created_at DESC',
      [req.params.id]
    );
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
