const router = require('express').Router();
const auth = require('../middleware/auth');

// Guruhlarni faqat shu center dan qaytarish
router.get('/', auth(['admin', 'mentor', 'student']), async (req, res) => {
  const db = req.app.get('db');
  const center_id = req.user.center_id;
  try {
    const result = await db.query(
      'SELECT id, name, subject, lesson_days, lesson_time FROM groups WHERE center_id=$1 AND is_active=true ORDER BY name',
      [center_id]
    );
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Public: guruh nomi qidirish (ro'yxatdan o'tishda, auth kerak emas)
router.get('/search', async (req, res) => {
  const db = req.app.get('db');
  const { name, center_id } = req.query;
  try {
    const cid = parseInt(center_id);
    if (!cid || !name) return res.status(400).json({ error: 'name va center_id kerak' });
    const result = await db.query(
      'SELECT id, name, subject FROM groups WHERE name ILIKE $1 AND center_id=$2 AND is_active=true LIMIT 5',
      [`%${name}%`, cid]
    );
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
