const router = require('express').Router();
const auth = require('../middleware/auth');
const bcrypt = require('bcryptjs');

router.use(auth(['student']));

// Student profile & dashboard
router.get('/dashboard', async (req, res) => {
  const db = req.app.get('db');
  try {
    const user = await db.query('SELECT id, full_name, email, phone, group_name FROM users WHERE id=$1', [req.user.id]);
    const groups = await db.query(
      `SELECT g.* FROM group_members gm JOIN groups g ON gm.group_id=g.id WHERE gm.user_id=$1`, [req.user.id]
    );
    const pending = await db.query(
      `SELECT COUNT(*) FROM assignments a
       JOIN group_members gm ON a.group_id=gm.group_id
       WHERE gm.user_id=$1 AND a.is_open=true
       AND NOT EXISTS (SELECT 1 FROM submissions s WHERE s.assignment_id=a.id AND s.user_id=$1)`,
      [req.user.id]
    );
    res.json({
      user: user.rows[0],
      groups: groups.rows,
      pending_assignments: parseInt(pending.rows[0].count)
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get my assignments (homework)
router.get('/assignments/homework', async (req, res) => {
  const db = req.app.get('db');
  try {
    const result = await db.query(
      `SELECT a.*, 
        (SELECT id FROM submissions WHERE assignment_id=a.id AND user_id=$1) as my_submission_id,
        (SELECT score FROM submissions WHERE assignment_id=a.id AND user_id=$1) as my_score,
        (SELECT submitted_at FROM submissions WHERE assignment_id=a.id AND user_id=$1) as submitted_at
       FROM assignments a
       JOIN group_members gm ON a.group_id=gm.group_id
       WHERE gm.user_id=$1 AND a.type='homework'
       ORDER BY a.due_date DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get my classwork assignments
router.get('/assignments/classwork', async (req, res) => {
  const db = req.app.get('db');
  try {
    const result = await db.query(
      `SELECT a.*,
        (SELECT id FROM submissions WHERE assignment_id=a.id AND user_id=$1) as my_submission_id,
        (SELECT score FROM submissions WHERE assignment_id=a.id AND user_id=$1) as my_score
       FROM assignments a
       JOIN group_members gm ON a.group_id=gm.group_id
       WHERE gm.user_id=$1 AND a.type='classwork'
       ORDER BY a.lesson_date DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Submit assignment
router.post('/assignments/:id/submit', async (req, res) => {
  const db = req.app.get('db');
  const { content } = req.body;
  try {
    // Check if assignment is still open
    const assignment = await db.query('SELECT * FROM assignments WHERE id=$1', [req.params.id]);
    if (!assignment.rows.length) return res.status(404).json({ error: 'Topilmadi' });
    
    const a = assignment.rows[0];
    
    if (!a.is_open) return res.status(400).json({ error: 'Vazifa yopilgan' });
    
    // Check deadline
    if (a.type === 'homework' && a.due_date) {
      const deadline = new Date(`${a.due_date}T${a.due_time || '23:59:59'}`);
      if (new Date() > deadline) return res.status(400).json({ error: 'Muddati o\'tgan' });
    }

    const result = await db.query(
      `INSERT INTO submissions (assignment_id, user_id, content)
       VALUES ($1,$2,$3) ON CONFLICT (assignment_id,user_id)
       DO UPDATE SET content=$3, submitted_at=NOW() RETURNING *`,
      [req.params.id, req.user.id, content]
    );
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Change password
router.put('/change-password', async (req, res) => {
  const db = req.app.get('db');
  const { old_password, new_password } = req.body;
  try {
    const user = await db.query('SELECT * FROM users WHERE id=$1', [req.user.id]);
    const valid = await bcrypt.compare(old_password, user.rows[0].password_hash);
    if (!valid) return res.status(400).json({ error: 'Eski parol noto\'g\'ri' });
    
    const hash = await bcrypt.hash(new_password, 10);
    await db.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, req.user.id]);
    res.json({ message: 'Parol o\'zgartirildi' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get calendar events
router.get('/calendar', async (req, res) => {
  const db = req.app.get('db');
  try {
    const result = await db.query(
      `SELECT ce.* FROM calendar_events ce
       JOIN group_members gm ON ce.group_id=gm.group_id
       WHERE gm.user_id=$1 ORDER BY ce.event_date`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get student's own attendance
router.get('/attendance', async (req, res) => {
  const db = req.app.get('db');
  try {
    const result = await db.query(
      `SELECT a.lesson_date, a.status, g.id as group_id, g.name as group_name
       FROM attendance a
       JOIN groups g ON a.group_id=g.id
       WHERE a.user_id=$1 ORDER BY a.lesson_date`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
