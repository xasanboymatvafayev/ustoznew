// assignments.js
const router = require('express').Router();
const auth = require('../middleware/auth');

// ─────────────────────────────────────────────
// Uy vazifasi qo'shish (mentor only)
// QOIDALAR:
//  1. lesson_date faqat guruh jadvalidagi bugungi yoki o'tgan sana bo'lishi kerak
//  2. Bir sanaga faqat 1 ta uy vazifasi bo'ladi
//  3. max_score mentor tomonidan belgilanadi (AI shu ballgacha tekshiradi)
// ─────────────────────────────────────────────
router.post('/', auth(['mentor']), async (req, res) => {
  const db = req.app.get('db');
  const { group_id, title, description, lesson_date, due_date, due_time, max_score } = req.body;
  const cid = req.user.center_id;
  const homeworkDate = lesson_date || due_date;

  try {
    // Guruh shu mentorga tegishli ekanligini tekshirish
    const grpCheck = await db.query(
      'SELECT * FROM groups WHERE id=$1 AND mentor_id=$2 AND center_id=$3',
      [group_id, req.user.id, cid]
    );
    if (!grpCheck.rows.length) return res.status(403).json({ error: "Bu guruh sizga tegishli emas" });

    const group = grpCheck.rows[0];

    // Jadval sanalarini hisoblash
    const getLessonDates = (start, end, lessonDays) => {
      const dates = [];
      let d = new Date(start);
      const endD = new Date(end);
      while (d <= endD) {
        const day = d.getDay();
        let ok = false;
        if (lessonDays === 'juft') ok = [2, 4, 6].includes(day);
        else if (lessonDays === 'toq') ok = [1, 3, 5].includes(day);
        else ok = day !== 0;
        if (ok) dates.push(d.toISOString().slice(0, 10));
        d.setDate(d.getDate() + 1);
      }
      return dates;
    };

    if (homeworkDate && group.start_date && group.end_date) {
      const validDates = getLessonDates(group.start_date, group.end_date, group.lesson_days);

      if (!validDates.includes(homeworkDate)) {
        return res.status(400).json({ error: "Bu sana jadval sanasi emas! Faqat dars sanasiga uy vazifasi qo'shing." });
      }

      // Faqat bugungi yoki o'tgan sanaga
      const today = new Date().toISOString().slice(0, 10);
      if (homeworkDate > today) {
        return res.status(400).json({ error: `Kelajak sanaga (${homeworkDate}) uy vazifasi qo'shib bo'lmaydi!` });
      }

      // Bir sanaga faqat 1 ta
      const existing = await db.query(
        `SELECT id FROM assignments WHERE group_id=$1 AND type='homework' AND lesson_date=$2`,
        [group_id, homeworkDate]
      );
      if (existing.rows.length > 0) {
        return res.status(400).json({ error: `${homeworkDate} sanasida allaqachon uy vazifasi mavjud!` });
      }
    }

    // Keyingi dars sanasini topish (topshirish muddati)
    let nextLessonDate = due_date || null;
    if (!nextLessonDate && homeworkDate && group.start_date && group.end_date) {
      const validDates = getLessonDates(group.start_date, group.end_date, group.lesson_days);
      const idx = validDates.indexOf(homeworkDate);
      if (idx >= 0 && idx + 1 < validDates.length) {
        nextLessonDate = validDates[idx + 1];
      }
    }

    const result = await db.query(
      `INSERT INTO assignments
        (group_id, mentor_id, title, description, type, lesson_date, due_date, due_time, max_score)
       VALUES ($1,$2,$3,$4,'homework',$5,$6,$7,$8) RETURNING *`,
      [group_id, req.user.id, title, description,
       homeworkDate || null,
       nextLessonDate || null,
       due_time || '23:59',
       max_score || 10]
    );
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────
// Guruh uchun vazifalar ro'yxati
// ─────────────────────────────────────────────
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
