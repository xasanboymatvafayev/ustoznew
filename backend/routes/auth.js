const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'ustoz_yordamchi_secret_2024';

// ✅ Email yuborish FRONTEND (EmailJS) ga o'tkazildi
// Backend faqat: kod generatsiya qiladi, DB ga saqlaydi, frontendga qaytaradi
// Frontend EmailJS orqali kodni emailga yuboradi

const genCode = () => Math.floor(100000 + Math.random() * 900000).toString();

// ─────────────────────────────────────────────
// REGISTER — Step 1: validate, save, return code
// ─────────────────────────────────────────────
router.post('/register/send-code', async (req, res) => {
  const { login, full_name, phone, email, group_name, password } = req.body;
  const db = req.app.get('db');

  try {
    const existing = await db.query('SELECT id, is_verified FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0 && existing.rows[0].is_verified) {
      return res.status(409).json({ error: 'Bu email bilan avval ro\'yxatdan o\'tilgan', exists: true });
    }

    const groupExists = await db.query('SELECT name FROM groups WHERE name = $1', [group_name]);
    if (!groupExists.rows.length) {
      return res.status(400).json({ error: 'Bu guruh topilmadi' });
    }

    const code = genCode();
    const expires = new Date(Date.now() + 10 * 60 * 1000);
    const hash = await bcrypt.hash(password, 8);

    await db.query(`
      INSERT INTO users (login, full_name, phone, email, group_name, password_hash, verification_code, verification_expires)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (email) DO UPDATE SET
        login=$1, full_name=$2, phone=$3, group_name=$5,
        password_hash=$6, verification_code=$7, verification_expires=$8, is_verified=false
    `, [login, full_name, phone, email, group_name, hash, code, expires]);

    // ✅ Kodni frontendga qaytaramiz — frontend EmailJS orqali yuboradi
    res.json({ message: 'Kod tayyor', email, code });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────
// REGISTER — Step 2: verify code
// ─────────────────────────────────────────────
router.post('/register/verify', async (req, res) => {
  const { email, code } = req.body;
  const db = req.app.get('db');

  try {
    const result = await db.query(
      'SELECT * FROM users WHERE email=$1 AND verification_code=$2 AND verification_expires>NOW()',
      [email, code]
    );
    if (!result.rows.length) {
      return res.status(400).json({ error: 'Kod noto\'g\'ri yoki muddati o\'tgan' });
    }

    const u = result.rows[0];
    await db.query('UPDATE users SET is_verified=true, verification_code=null WHERE email=$1', [email]);

    const group = await db.query('SELECT id FROM groups WHERE name=$1', [u.group_name]);
    if (group.rows.length) {
      await db.query(
        'INSERT INTO group_members (group_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [group.rows[0].id, u.id]
      );
    }

    const token = jwt.sign({ id: u.id, role: 'student', email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: u.id, full_name: u.full_name, email, role: 'student' } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────
// Re-verify — yangi kod yuborish
// ─────────────────────────────────────────────
router.post('/register/re-verify', async (req, res) => {
  const { email } = req.body;
  const db = req.app.get('db');
  try {
    const code = genCode();
    const expires = new Date(Date.now() + 10 * 60 * 1000);
    await db.query(
      'UPDATE users SET verification_code=$1, verification_expires=$2, is_verified=false WHERE email=$3',
      [code, expires, email]
    );
    // ✅ Kodni frontendga qaytaramiz
    res.json({ message: 'Yangi kod tayyor', code });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────
// STUDENT LOGIN
// ─────────────────────────────────────────────
router.post('/login/student', async (req, res) => {
  const { email, password } = req.body;
  const db = req.app.get('db');
  try {
    const result = await db.query('SELECT * FROM users WHERE email=$1 AND is_verified=true', [email]);
    if (!result.rows.length) return res.status(401).json({ error: 'Foydalanuvchi topilmadi' });

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Parol noto\'g\'ri' });

    const token = jwt.sign({ id: user.id, role: 'student', email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, full_name: user.full_name, email: user.email, role: 'student' } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────
// MENTOR LOGIN
// ─────────────────────────────────────────────
router.post('/login/mentor', async (req, res) => {
  const { phone, password } = req.body;
  const db = req.app.get('db');
  try {
    const result = await db.query('SELECT * FROM mentors WHERE phone=$1 AND is_active=true', [phone]);
    if (!result.rows.length) return res.status(401).json({ error: 'Mentor topilmadi' });

    const mentor = result.rows[0];
    const valid = await bcrypt.compare(password, mentor.password_hash);
    if (!valid) return res.status(401).json({ error: 'Parol noto\'g\'ri' });

    const token = jwt.sign({ id: mentor.id, role: 'mentor', phone }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, mentor: { id: mentor.id, full_name: mentor.full_name, phone: mentor.phone, role: 'mentor' } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────
// ADMIN LOGIN
// ─────────────────────────────────────────────
router.post('/login/admin', async (req, res) => {
  const { password } = req.body;
  if (password !== 'sonnet123') return res.status(401).json({ error: 'Parol noto\'g\'ri' });
  const token = jwt.sign({ id: 'admin', role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token, role: 'admin' });
});

// ─────────────────────────────────────────────
// FORGOT PASSWORD — send code
// ─────────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  const db = req.app.get('db');
  try {
    const result = await db.query('SELECT * FROM users WHERE email=$1 AND is_verified=true', [email]);
    if (!result.rows.length) return res.status(404).json({ error: 'Bu email topilmadi' });

    const code = genCode();
    const expires = new Date(Date.now() + 10 * 60 * 1000);
    await db.query('UPDATE users SET verification_code=$1, verification_expires=$2 WHERE email=$3', [code, expires, email]);

    // ✅ Kodni frontendga qaytaramiz
    res.json({ message: 'Kod tayyor', code });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────
// FORGOT PASSWORD — verify & get new password
// ─────────────────────────────────────────────
router.post('/forgot-password/verify', async (req, res) => {
  const { email, code } = req.body;
  const db = req.app.get('db');
  try {
    const result = await db.query(
      'SELECT * FROM users WHERE email=$1 AND verification_code=$2 AND verification_expires>NOW()',
      [email, code]
    );
    if (!result.rows.length) return res.status(400).json({ error: 'Kod noto\'g\'ri' });

    const user = result.rows[0];
    const newPassword = Math.random().toString(36).slice(-8);
    const hash = await bcrypt.hash(newPassword, 8);
    await db.query('UPDATE users SET password_hash=$1, verification_code=null WHERE email=$2', [hash, email]);

    // ✅ Yangi parolni frontendga qaytaramiz — frontend EmailJS orqali yuboradi
    res.json({
      message: 'Yangi parol tayyor',
      login: user.login,
      newPassword
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
