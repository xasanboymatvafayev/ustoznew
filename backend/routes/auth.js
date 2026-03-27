const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

const JWT_SECRET = process.env.JWT_SECRET || 'ustoz_yordamchi_secret_2024';

// EmailJS config (using nodemailer as backend alternative)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const sendCode = async (email, code) => {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Ustoz Yordamchi - Tasdiqlash kodi',
      html: `<div style="font-family:Arial;padding:20px;background:#f5f5f5">
        <h2 style="color:#6c63ff">Ustoz Yordamchi AI</h2>
        <p>Sizning tasdiqlash kodingiz:</p>
        <h1 style="color:#6c63ff;font-size:40px;letter-spacing:10px">${code}</h1>
        <p>Bu kod 10 daqiqa davomida amal qiladi.</p>
      </div>`
    });
  } catch (e) {
    console.error('Email error:', e.message);
  }
};

const genCode = () => Math.floor(100000 + Math.random() * 900000).toString();

// REGISTER - Step 1: send verification code
router.post('/register/send-code', async (req, res) => {
  const { login, full_name, phone, email, group_name } = req.body;
  const db = req.app.get('db');
  
  try {
    // Check if email already exists
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ 
        error: 'Bu email bilan avval ro\'yxatdan o\'tilgan',
        exists: true 
      });
    }

    // Check group exists
    const groupExists = await db.query('SELECT name FROM groups WHERE name = $1', [group_name]);
    if (!groupExists.rows.length) {
      return res.status(400).json({ error: 'Bu guruh topilmadi' });
    }

    const code = genCode();
    const expires = new Date(Date.now() + 10 * 60 * 1000);
    
    // Store temp data in a pending table (use users with is_verified=false)
    await db.query(`
      INSERT INTO users (login, full_name, phone, email, group_name, password_hash, verification_code, verification_expires)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (email) DO UPDATE SET verification_code=$7, verification_expires=$8
    `, [login, full_name, phone, email, group_name, 'PENDING', code, expires]);

    await sendCode(email, code);
    res.json({ message: 'Tasdiqlash kodi yuborildi', email });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// REGISTER - Step 2: verify code and set password
router.post('/register/verify', async (req, res) => {
  const { email, code, password } = req.body;
  const db = req.app.get('db');
  
  try {
    const user = await db.query(
      'SELECT * FROM users WHERE email = $1 AND verification_code = $2 AND verification_expires > NOW()',
      [email, code]
    );
    
    if (!user.rows.length) {
      return res.status(400).json({ error: 'Kod noto\'g\'ri yoki muddati o\'tgan' });
    }

    const hash = await bcrypt.hash(password, 10);
    const u = user.rows[0];

    await db.query(
      'UPDATE users SET password_hash=$1, is_verified=true, verification_code=null WHERE email=$2',
      [hash, email]
    );

    // Add to group
    const group = await db.query('SELECT id FROM groups WHERE name = $1', [u.group_name]);
    if (group.rows.length) {
      await db.query(
        'INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [group.rows[0].id, u.id]
      );
    }

    const token = jwt.sign({ id: u.id, role: 'student', email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: u.id, full_name: u.full_name, email, role: 'student' } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Re-register: send new verification code to existing email
router.post('/register/re-verify', async (req, res) => {
  const { email } = req.body;
  const db = req.app.get('db');
  
  try {
    const code = genCode();
    const expires = new Date(Date.now() + 10 * 60 * 1000);
    await db.query(
      'UPDATE users SET verification_code=$1, verification_expires=$2 WHERE email=$3',
      [code, expires, email]
    );
    await sendCode(email, code);
    res.json({ message: 'Yangi tasdiqlash kodi yuborildi' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// STUDENT LOGIN
router.post('/login/student', async (req, res) => {
  const { email, password } = req.body;
  const db = req.app.get('db');
  
  try {
    const result = await db.query('SELECT * FROM users WHERE email = $1 AND is_verified = true', [email]);
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

// MENTOR LOGIN
router.post('/login/mentor', async (req, res) => {
  const { phone, password } = req.body;
  const db = req.app.get('db');
  
  try {
    const result = await db.query('SELECT * FROM mentors WHERE phone = $1 AND is_active = true', [phone]);
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

// ADMIN LOGIN
router.post('/login/admin', async (req, res) => {
  const { password } = req.body;
  if (password !== 'sonnet123') return res.status(401).json({ error: 'Parol noto\'g\'ri' });
  
  const token = jwt.sign({ id: 'admin', role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token, role: 'admin' });
});

// FORGOT PASSWORD
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  const db = req.app.get('db');
  
  try {
    const result = await db.query('SELECT * FROM users WHERE email = $1 AND is_verified = true', [email]);
    if (!result.rows.length) return res.status(404).json({ error: 'Bu email topilmadi' });

    const code = genCode();
    const expires = new Date(Date.now() + 10 * 60 * 1000);
    await db.query(
      'UPDATE users SET verification_code=$1, verification_expires=$2 WHERE email=$3',
      [code, expires, email]
    );
    await sendCode(email, code);
    res.json({ message: 'Tasdiqlash kodi yuborildi' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// FORGOT PASSWORD - verify code, send credentials
router.post('/forgot-password/verify', async (req, res) => {
  const { email, code } = req.body;
  const db = req.app.get('db');
  
  try {
    const result = await db.query(
      'SELECT * FROM users WHERE email = $1 AND verification_code = $2 AND verification_expires > NOW()',
      [email, code]
    );
    if (!result.rows.length) return res.status(400).json({ error: 'Kod noto\'g\'ri' });

    const user = result.rows[0];
    
    // Generate new password
    const newPassword = Math.random().toString(36).slice(-8);
    const hash = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE users SET password_hash=$1, verification_code=null WHERE email=$2', [hash, email]);

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Ustoz Yordamchi - Yangi parolingiz',
      html: `<div style="font-family:Arial;padding:20px">
        <h2 style="color:#6c63ff">Ustoz Yordamchi AI</h2>
        <p>Sizning yangi ma'lumotlaringiz:</p>
        <p><b>Login:</b> ${user.login}</p>
        <p><b>Parol:</b> ${newPassword}</p>
        <p>Tizimga kirgach parolni o'zgartiring!</p>
      </div>`
    });

    res.json({ message: 'Yangi login va parol emailga yuborildi' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
