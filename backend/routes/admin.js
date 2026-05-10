const router = require('express').Router();
const bcrypt = require('bcryptjs');
const auth = require('../middleware/auth');

// All admin routes protected
router.use(auth(['admin']));

// Dashboard stats
router.get('/dashboard', async (req, res) => {
  const db = req.app.get('db');
  try {
    const [students, mentors, groups, activeGroups] = await Promise.all([
      db.query('SELECT COUNT(*) FROM users WHERE is_verified=true'),
      db.query('SELECT COUNT(*) FROM mentors WHERE is_active=true AND center_id=$1', [req.user.center_id]),
      db.query('SELECT COUNT(*) FROM groups WHERE center_id=$1', [req.user.center_id]),
      db.query('SELECT COUNT(*) FROM groups WHERE is_active=true AND center_id=$1', [req.user.center_id])
    ]);
    const groupList = await db.query(`
      SELECT g.*, m.full_name as mentor_name,
        (SELECT COUNT(*) FROM group_members WHERE group_id=g.id) as member_count
      FROM groups g LEFT JOIN mentors m ON g.mentor_id=m.id ORDER BY g.created_at DESC
    `);
    res.json({
      total_students: parseInt(students.rows[0].count),
      total_mentors: parseInt(mentors.rows[0].count),
      total_groups: parseInt(groups.rows[0].count),
      active_groups: parseInt(activeGroups.rows[0].count),
      groups: groupList.rows
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get all mentors
router.get('/mentors', async (req, res) => {
  const db = req.app.get('db');
  try {
    const result = await db.query(`
      SELECT m.*, 
        (SELECT COUNT(*) FROM groups WHERE mentor_id=m.id) as group_count
      FROM mentors m ORDER BY m.created_at DESC
    `);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Add mentor
router.post('/mentors', async (req, res) => {
  const { full_name, phone, password, group_names } = req.body;
  const db = req.app.get('db');
  try {
    const hash = await bcrypt.hash(password, 10);
    const mentor = await db.query(
      'INSERT INTO mentors (full_name, phone, password_hash, center_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [full_name, phone, hash, req.user.center_id]
    );
    
    // Assign groups
    if (group_names && group_names.length) {
      for (const gname of group_names) {
        await db.query(
          'UPDATE groups SET mentor_id=$1 WHERE name=$2',
          [mentor.rows[0].id, gname]
        );
      }
    }
    res.json(mentor.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Deactivate/delete mentor
router.delete('/mentors/:id', async (req, res) => {
  const db = req.app.get('db');
  try {
    await db.query('UPDATE mentors SET is_active=false WHERE id=$1', [req.params.id]);
    res.json({ message: 'Mentor nofaol qilindi' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get all groups
router.get('/groups', async (req, res) => {
  const db = req.app.get('db');
  try {
    const result = await db.query(`
      SELECT g.*, m.full_name as mentor_name,
        (SELECT COUNT(*) FROM group_members WHERE group_id=g.id) as member_count
      FROM groups g LEFT JOIN mentors m ON g.mentor_id=m.id ORDER BY g.created_at DESC
    `);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Add group
router.post('/groups', async (req, res) => {
  const { name, mentor_id, lesson_days, lesson_time, start_date, end_date, subject } = req.body;
  const db = req.app.get('db');
  try {
    const result = await db.query(
      `INSERT INTO groups (name, mentor_id, lesson_days, lesson_time, start_date, end_date, subject, center_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, mentor_id, lesson_days, lesson_time, start_date, end_date, subject]
    );
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update group dates (sanani uzaytirish)
router.put('/groups/:id', async (req, res) => {
  const { start_date, end_date } = req.body;
  const db = req.app.get('db');
  try {
    const result = await db.query(
      `UPDATE groups SET start_date=$1, end_date=$2 WHERE id=$3 RETURNING *`,
      [start_date, end_date, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Guruh topilmadi' });
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Add calendar event
router.post('/calendar', async (req, res) => {
  const { group_id, title, event_date } = req.body;
  const db = req.app.get('db');
  try {
    const result = await db.query(
      'INSERT INTO calendar_events (group_id, title, event_date) VALUES ($1, $2, $3) RETURNING *',
      [group_id, title, event_date]
    );
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get all students
router.get('/students', async (req, res) => {
  const db = req.app.get('db');
  try {
    const result = await db.query(`
      SELECT u.*, g.name as group_name FROM users u
      LEFT JOIN group_members gm ON u.id=gm.user_id
      LEFT JOIN groups g ON gm.group_id=g.id
      WHERE u.is_verified=true ORDER BY u.created_at DESC
    `);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update student (full_name, login, group_name)
router.put('/students/:id', async (req, res) => {
  const db = req.app.get('db');
  const { full_name, login, group_name } = req.body;
  const studentId = req.params.id;
  try {
    // login unique tekshirish (o'zi bundan mustasno)
    if (login) {
      const existing = await db.query('SELECT id FROM users WHERE login=$1 AND id!=$2', [login, studentId]);
      if (existing.rows.length) return res.status(409).json({ error: 'Bu username allaqachon band' });
    }

    // users jadvalini yangilash
    await db.query(
      `UPDATE users SET
        full_name = COALESCE($1, full_name),
        login     = COALESCE($2, login),
        group_name= COALESCE($3, group_name)
       WHERE id = $4`,
      [full_name || null, login || null, group_name || null, studentId]
    );

    // Guruh o'zgargan bo'lsa group_members ni ham yangilash
    if (group_name) {
      const grp = await db.query('SELECT id FROM groups WHERE name=$1 AND center_id=$2', [group_name, req.user.center_id]);
      if (!grp.rows.length) return res.status(400).json({ error: 'Guruh topilmadi' });
      const newGroupId = grp.rows[0].id;

      // Eski group_members yozuvini o'chirish
      await db.query('DELETE FROM group_members WHERE user_id=$1', [studentId]);
      // Yangi guruhga qo'shish
      await db.query(
        'INSERT INTO group_members (group_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [newGroupId, studentId]
      );
    }

    res.json({ message: "O'quvchi yangilandi" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
