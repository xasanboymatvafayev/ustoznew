const router = require('express').Router();
const auth = require('../middleware/auth');

router.use(auth(['mentor']));

// Mentor dashboard
router.get('/dashboard', async (req, res) => {
  const db = req.app.get('db');
  const mentorId = req.user.id;
  try {
    const groups = await db.query(
      `SELECT g.*, (SELECT COUNT(*) FROM group_members WHERE group_id=g.id) as member_count
       FROM groups g WHERE g.mentor_id=$1`, [mentorId]
    );
    const totalStudents = groups.rows.reduce((a, b) => a + parseInt(b.member_count), 0);
    const events = await db.query(
      `SELECT ce.* FROM calendar_events ce
       JOIN groups g ON ce.group_id=g.id WHERE g.mentor_id=$1 ORDER BY event_date`, [mentorId]
    );
    res.json({ groups: groups.rows, total_students: totalStudents, calendar: events.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get mentor's groups
router.get('/groups', async (req, res) => {
  const db = req.app.get('db');
  try {
    const result = await db.query(
      `SELECT g.*, (SELECT COUNT(*) FROM group_members WHERE group_id=g.id) as member_count
       FROM groups g WHERE g.mentor_id=$1`, [req.user.id]
    );
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get group members
router.get('/groups/:id/members', async (req, res) => {
  const db = req.app.get('db');
  try {
    const result = await db.query(
      `SELECT u.id, u.full_name, u.email, u.phone, gm.joined_at
       FROM group_members gm JOIN users u ON gm.user_id=u.id
       WHERE gm.group_id=$1 ORDER BY u.full_name`, [req.params.id]
    );
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Remove student from group
router.delete('/groups/:groupId/members/:userId', async (req, res) => {
  const db = req.app.get('db');
  try {
    await db.query('DELETE FROM group_members WHERE group_id=$1 AND user_id=$2',
      [req.params.groupId, req.params.userId]);
    res.json({ message: 'O\'quvchi guruhdan chiqarildi' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get group schedule (jadval)
router.get('/groups/:id/schedule', async (req, res) => {
  const db = req.app.get('db');
  const groupId = req.params.id;
  try {
    const group = await db.query('SELECT * FROM groups WHERE id=$1', [groupId]);
    const members = await db.query(
      `SELECT u.id, u.full_name FROM group_members gm JOIN users u ON gm.user_id=u.id WHERE gm.group_id=$1`,
      [groupId]
    );
    const assignments = await db.query(
      `SELECT a.*, 
        json_agg(json_build_object('user_id',s.user_id,'score',s.score,'submitted_at',s.submitted_at)) as submissions
       FROM assignments a
       LEFT JOIN submissions s ON a.id=s.assignment_id
       WHERE a.group_id=$1 AND a.lesson_date IS NOT NULL
       GROUP BY a.id ORDER BY a.lesson_date`,
      [groupId]
    );
    const scores = await db.query(
      `SELECT sc.* FROM scores sc WHERE sc.group_id=$1`, [groupId]
    );
    res.json({
      group: group.rows[0],
      members: members.rows,
      assignments: assignments.rows,
      scores: scores.rows
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update score
router.put('/scores/:id', async (req, res) => {
  const db = req.app.get('db');
  try {
    const result = await db.query(
      'UPDATE scores SET score=$1 WHERE id=$2 RETURNING *',
      [req.body.score, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Add classwork assignment
router.post('/assignments/classwork', async (req, res) => {
  const db = req.app.get('db');
  const { group_id, title, description, lesson_date, duration_minutes } = req.body;
  try {
    const result = await db.query(
      `INSERT INTO assignments (group_id, mentor_id, title, description, type, lesson_date, duration_minutes)
       VALUES ($1,$2,$3,$4,'classwork',$5,$6) RETURNING *`,
      [group_id, req.user.id, title, description, lesson_date, duration_minutes]
    );
    
    // Auto-close after duration
    if (duration_minutes) {
      setTimeout(async () => {
        await db.query('UPDATE assignments SET is_open=false WHERE id=$1', [result.rows[0].id]);
      }, duration_minutes * 60 * 1000);
    }
    
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get assignment submissions
router.get('/assignments/:id/submissions', async (req, res) => {
  const db = req.app.get('db');
  try {
    const result = await db.query(
      `SELECT s.*, u.full_name, u.email FROM submissions s
       JOIN users u ON s.user_id=u.id WHERE s.assignment_id=$1`, [req.params.id]
    );
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Grade submission
router.put('/submissions/:id/grade', async (req, res) => {
  const db = req.app.get('db');
  const { score, mentor_feedback } = req.body;
  try {
    const sub = await db.query(
      'UPDATE submissions SET score=$1, mentor_feedback=$2 WHERE id=$3 RETURNING *',
      [score, mentor_feedback, req.params.id]
    );
    
    // Update scores table
    const s = sub.rows[0];
    const assignment = await db.query('SELECT * FROM assignments WHERE id=$1', [s.assignment_id]);
    const a = assignment.rows[0];
    
    await db.query(
      `INSERT INTO scores (user_id, group_id, assignment_id, score, lesson_date)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (user_id, assignment_id) 
       DO UPDATE SET score=$4`,
      [s.user_id, a.group_id, s.assignment_id, score, a.lesson_date || a.due_date]
    );
    
    res.json(sub.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Delete assignment
router.delete('/assignments/:id', async (req, res) => {
  const db = req.app.get('db');
  try {
    await db.query('DELETE FROM assignments WHERE id=$1 AND mentor_id=$2', [req.params.id, req.user.id]);
    res.json({ message: 'Vazifa o\'chirildi' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update schedule (jadval tahrirlash)
router.put('/groups/:id/schedule/edit', async (req, res) => {
  const db = req.app.get('db');
  const { updates } = req.body; // array of { date, scores: [{user_id, score}] }
  try {
    for (const update of updates) {
      for (const sc of update.scores) {
        await db.query(
          `INSERT INTO scores (user_id, group_id, score, lesson_date)
           VALUES ($1,$2,$3,$4)
           ON CONFLICT (user_id, group_id, lesson_date) DO UPDATE SET score=$3`,
          [sc.user_id, req.params.id, sc.score, update.date]
        );
      }
    }
    res.json({ message: 'Jadval yangilandi' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
