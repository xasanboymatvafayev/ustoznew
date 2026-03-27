// groups.js
const router = require('express').Router();
const auth = require('../middleware/auth');

router.get('/', auth(['admin', 'mentor', 'student']), async (req, res) => {
  const db = req.app.get('db');
  try {
    const result = await db.query('SELECT name FROM groups WHERE is_active=true ORDER BY name');
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
