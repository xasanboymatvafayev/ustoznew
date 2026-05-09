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
    res.json({ message: "O'quvchi guruhdan chiqarildi" });
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
        json_agg(json_build_object('user_id',s.user_id,'score',s.score,'submitted_at',s.submitted_at,'id',s.id,'content',s.content,'mentor_feedback',s.mentor_feedback)) as submissions
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

// ── JADVAL TOZALASH (barcha scores=0 ga tushiradi) ──
router.post('/groups/:id/schedule/clear', async (req, res) => {
  const db = req.app.get('db');
  try {
    await db.query('UPDATE scores SET score=0, updated_at=NOW() WHERE group_id=$1', [req.params.id]);
    res.json({ message: 'Jadval tozalandi' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── SUBMISSION O'CHIRISH (jadvalda baho qo'yilgan o'quvchi javobi) ──
router.delete('/submissions/:id', async (req, res) => {
  const db = req.app.get('db');
  try {
    // submission ma'lumotini olamiz
    const sub = await db.query('SELECT * FROM submissions WHERE id=$1', [req.params.id]);
    if (!sub.rows[0]) return res.status(404).json({ error: 'Topilmadi' });
    const s = sub.rows[0];
    // scores jadvalidan ham o'chiramiz
    const asgn = await db.query('SELECT * FROM assignments WHERE id=$1', [s.assignment_id]);
    if (asgn.rows[0]) {
      const lessonDate = asgn.rows[0].lesson_date || asgn.rows[0].due_date;
      await db.query(
        'DELETE FROM scores WHERE user_id=$1 AND group_id=$2 AND lesson_date=$3',
        [s.user_id, asgn.rows[0].group_id, lessonDate]
      );
    }
    await db.query('DELETE FROM submissions WHERE id=$1', [req.params.id]);
    res.json({ message: "Javob o'chirildi" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Add classwork assignment (kodli yoki IQ)
router.post('/assignments/classwork', async (req, res) => {
  const db = req.app.get('db');
  const { group_id, title, description, lesson_date, duration_minutes, classwork_type, correct_answer, max_score } = req.body;
  // classwork_type: 'code' | 'iq'
  try {
    const result = await db.query(
      `INSERT INTO assignments (group_id, mentor_id, title, description, type, lesson_date, duration_minutes, classwork_type, correct_answer, max_score)
       VALUES ($1,$2,$3,$4,'classwork',$5,$6,$7,$8,$9) RETURNING *`,
      [group_id, req.user.id, title, description, lesson_date, duration_minutes,
       classwork_type || 'code', correct_answer || null, max_score || 10]
    );
    
    // Auto-close after duration
    if (duration_minutes) {
      setTimeout(async () => {
        try {
          const a = await db.query('SELECT * FROM assignments WHERE id=$1', [result.rows[0].id]);
          if (!a.rows[0]) return;
          await db.query('UPDATE assignments SET is_open=false WHERE id=$1', [result.rows[0].id]);
          
          // IQ savolda: vaqt tugaganda to'g'ri javob yuborgan o'quvchilarga avtomatik ball
          if ((classwork_type || 'code') === 'iq' && correct_answer) {
            const subs = await db.query('SELECT * FROM submissions WHERE assignment_id=$1', [result.rows[0].id]);
            const ballPerCorrect = parseInt(max_score) || 10;
            for (const sub of subs.rows) {
              const userAnswer = (sub.content || '').trim().toLowerCase();
              const correctAns = correct_answer.trim().toLowerCase();
              if (userAnswer === correctAns) {
                // Ball qo'yamiz
                await db.query(
                  'UPDATE submissions SET score=$1, mentor_feedback=$2 WHERE id=$3',
                  [ballPerCorrect, "✅ To'g'ri javob!", sub.id]
                );
                await db.query(
                  `INSERT INTO scores (user_id, group_id, assignment_id, score, lesson_date)
                   VALUES ($1,$2,$3,$4,$5)
                   ON CONFLICT (user_id, group_id, lesson_date)
                   DO UPDATE SET score=$4, assignment_id=$3, updated_at=NOW()`,
                  [sub.user_id, group_id, result.rows[0].id, ballPerCorrect, lesson_date]
                );
              } else {
                await db.query(
                  'UPDATE submissions SET score=0, mentor_feedback=$1 WHERE id=$2',
                  ["❌ Noto'g'ri javob", sub.id]
                );
              }
            }
          }
        } catch(err) { console.error('Auto-close error:', err); }
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
    
    const lessonDate = a.lesson_date || a.due_date;
    await db.query(
      `INSERT INTO scores (user_id, group_id, assignment_id, score, lesson_date)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (user_id, group_id, lesson_date)
       DO UPDATE SET score=$4, assignment_id=$3, updated_at=NOW()`,
      [s.user_id, a.group_id, s.assignment_id, score, lessonDate]
    );
    
    res.json(sub.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── BARCHA SUBMISSIONLARNI TEKSHIRISH (AI bilan) ──
router.post('/assignments/:id/grade-all', async (req, res) => {
  const db = req.app.get('db');
  try {
    const subs = await db.query(
      `SELECT s.*, u.full_name FROM submissions s JOIN users u ON s.user_id=u.id WHERE s.assignment_id=$1 AND (s.score IS NULL OR s.score=0)`,
      [req.params.id]
    );
    res.json({ count: subs.rows.length, submissions: subs.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Delete assignment
router.delete('/assignments/:id', async (req, res) => {
  const db = req.app.get('db');
  try {
    await db.query('DELETE FROM assignments WHERE id=$1 AND mentor_id=$2', [req.params.id, req.user.id]);
    res.json({ message: "Vazifa o'chirildi" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update schedule (jadval tahrirlash) — faqat bugungi dars kunida
router.put('/groups/:id/schedule/edit', async (req, res) => {
  const db = req.app.get('db');
  const { updates } = req.body;
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
    res.json({ message: "Jadval yangilandi" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── DAVOMAT (Attendance) ──

// Get attendance for a group on a specific date
router.get('/groups/:id/attendance', async (req, res) => {
  const db = req.app.get('db');
  const { date } = req.query;
  try {
    const members = await db.query(
      `SELECT u.id, u.full_name FROM group_members gm JOIN users u ON gm.user_id=u.id WHERE gm.group_id=$1 ORDER BY u.full_name`,
      [req.params.id]
    );
    let attendance = [];
    if (date) {
      const att = await db.query(
        `SELECT * FROM attendance WHERE group_id=$1 AND lesson_date=$2`,
        [req.params.id, date]
      );
      attendance = att.rows;
    }
    res.json({ members: members.rows, attendance });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Save attendance for a group on a date
router.post('/groups/:id/attendance', async (req, res) => {
  const db = req.app.get('db');
  const { date, records } = req.body;
  try {
    for (const rec of records) {
      await db.query(
        `INSERT INTO attendance (group_id, user_id, lesson_date, status, marked_by)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (group_id, user_id, lesson_date) DO UPDATE SET status=$4, marked_by=$5`,
        [req.params.id, rec.user_id, date, rec.status, req.user.id]
      );
    }
    res.json({ message: "Davomat saqlandi" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get attendance history for a group (all dates)
router.get('/groups/:id/attendance/history', async (req, res) => {
  const db = req.app.get('db');
  try {
    const att = await db.query(
      `SELECT a.*, u.full_name FROM attendance a JOIN users u ON a.user_id=u.id WHERE a.group_id=$1 ORDER BY a.lesson_date DESC`,
      [req.params.id]
    );
    res.json(att.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Student: get own attendance for their group
router.get('/groups/:id/attendance/mine', async (req, res) => {
  const db = req.app.get('db');
  try {
    const att = await db.query(
      `SELECT lesson_date, status FROM attendance WHERE group_id=$1 AND user_id=$2 ORDER BY lesson_date`,
      [req.params.id, req.query.user_id]
    );
    res.json(att.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Start classwork timer
router.post('/assignments/:id/start', async (req, res) => {
  const db = req.app.get('db');
  try {
    const result = await db.query(
      'UPDATE assignments SET started_at=NOW() WHERE id=$1 AND mentor_id=$2 RETURNING *',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Topilmadi' });
    
    const a = result.rows[0];
    if (a.duration_minutes) {
      setTimeout(async () => {
        try {
          await db.query('UPDATE assignments SET is_open=false WHERE id=$1', [a.id]);
          
          // IQ savolda: vaqt tugaganda avtomatik ball
          if (a.classwork_type === 'iq' && a.correct_answer) {
            const subs = await db.query('SELECT * FROM submissions WHERE assignment_id=$1', [a.id]);
            const ballPerCorrect = parseInt(a.max_score) || 10;
            for (const sub of subs.rows) {
              const userAnswer = (sub.content || '').trim().toLowerCase();
              const correctAns = a.correct_answer.trim().toLowerCase();
              if (userAnswer === correctAns) {
                await db.query(
                  'UPDATE submissions SET score=$1, mentor_feedback=$2 WHERE id=$3',
                  [ballPerCorrect, "✅ To'g'ri javob!", sub.id]
                );
                await db.query(
                  `INSERT INTO scores (user_id, group_id, assignment_id, score, lesson_date)
                   VALUES ($1,$2,$3,$4,$5)
                   ON CONFLICT (user_id, group_id, lesson_date)
                   DO UPDATE SET score=$4, assignment_id=$3, updated_at=NOW()`,
                  [sub.user_id, a.group_id, a.id, ballPerCorrect, a.lesson_date]
                );
              } else {
                await db.query(
                  'UPDATE submissions SET score=0, mentor_feedback=$1 WHERE id=$2',
                  ["❌ Noto'g'ri javob", sub.id]
                );
              }
            }
          }
        } catch(err) { console.error('Auto-close error:', err); }
      }, a.duration_minutes * 60 * 1000);
    }
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── JADVAL SANASINI YANGILASH (start_date, end_date) ──
router.put('/groups/:id/dates', async (req, res) => {
  const db = req.app.get('db');
  const { start_date, end_date } = req.body;
  try {
    // Faqat o'z guruhini yangilay oladi
    const check = await db.query('SELECT id FROM groups WHERE id=$1 AND mentor_id=$2', [req.params.id, req.user.id]);
    if (!check.rows[0]) return res.status(403).json({ error: 'Ruxsat yoq' });
    await db.query('UPDATE groups SET start_date=$1, end_date=$2 WHERE id=$3', [start_date, end_date, req.params.id]);
    res.json({ message: "Jadval sanasi yangilandi" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Mentor profile - change password
router.put('/profile/password', async (req, res) => {
  const db = req.app.get('db');
  const { old_password, new_password } = req.body;
  const bcrypt = require('bcryptjs');
  try {
    const mentor = await db.query('SELECT * FROM mentors WHERE id=$1', [req.user.id]);
    if (!mentor.rows[0]) return res.status(404).json({ error: 'Topilmadi' });
    const ok = await bcrypt.compare(old_password, mentor.rows[0].password_hash);
    if (!ok) return res.status(400).json({ error: "Eski parol noto'g'ri" });
    const hash = await bcrypt.hash(new_password, 10);
    await db.query('UPDATE mentors SET password_hash=$1 WHERE id=$2', [hash, req.user.id]);
    res.json({ message: "Parol o'zgartirildi" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Mentor profile - update avatar
router.put('/profile/avatar', async (req, res) => {
  const db = req.app.get('db');
  const { avatar_url } = req.body;
  try {
    await db.query('UPDATE mentors SET avatar_url=$1 WHERE id=$2', [avatar_url, req.user.id]);
    res.json({ message: "Avatar yangilandi" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
