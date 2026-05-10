require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

// DEBUG: papka strukturasini ko'rish
const fs = require('fs');
console.log('__dirname:', __dirname);
console.log('Root files:', fs.readdirSync(path.join(__dirname, '..')).join(', '));
const saPath = path.join(__dirname, '..', 'superadmin');
console.log('superadmin exists:', fs.existsSync(saPath));

// ── Static: Boss Admin Panel ─────────────────────────────────────────────
// superadmin/index.html → /superadmin/ da ochiladi
app.use('/superadmin', express.static(path.join(__dirname, '..', 'superadmin')));

// ── Static: O'quv markaz frontendi ──────────────────────────────────────
const frontendBuild  = path.join(__dirname, '..', 'frontend', 'build');
const frontendPublic = path.join(__dirname, '..', 'frontend', 'public');
const frontendRoot   = require('fs').existsSync(frontendBuild) ? frontendBuild : frontendPublic;
console.log('Frontend served from:', frontendRoot);

// / → /superadmin (bu static middleware dan OLDIN bo'lishi shart)
app.get('/', (req, res) => res.redirect('/superadmin'));

// CRA build qilganda asset yo'llari absolyut bo'ladi: /static/js/main.js
// Faqat /static/, /manifest.json kabi fayllarni serve qilamiz (index.html emas)
app.use('/static', express.static(require('path').join(frontendRoot, 'static')));
app.use('/manifest.json', express.static(require('path').join(frontendRoot, 'manifest.json')));
app.use('/favicon.ico', express.static(require('path').join(frontendRoot, 'favicon.ico')));

// /center/:centerId/* uchun ham static fayllar (ehtiyot uchun)
app.use('/center', express.static(frontendRoot));

// SPA uchun: /center/:centerId — avval DB dan mavjudligini tekshiramiz
async function serveCenterOrNotFound(req, res) {
  try {
    const { centerId } = req.params;
    const result = await pool.query('SELECT id FROM centers WHERE id=$1 AND is_active=true', [centerId]);
    if (!result.rows.length) {
      return res.status(404).send(`
        <!DOCTYPE html><html lang="uz"><head><meta charset="utf-8">
        <title>Topilmadi</title>
        <style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f8fafc}
        .box{text-align:center;padding:40px;background:#fff;border-radius:16px;box-shadow:0 4px 24px #0001}
        h1{font-size:64px;margin:0;color:#6366f1}p{color:#64748b;font-size:18px}
        a{display:inline-block;margin-top:16px;padding:10px 24px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none}</style>
        </head><body><div class="box">
        <h1>404</h1>
        <p>Bu o'quv markaz mavjud emas yoki faol emas.</p>
        <a href="/">Bosh sahifa</a>
        </div></body></html>
      `);
    }
    res.sendFile(path.join(frontendRoot, 'index.html'));
  } catch(e) {
    res.sendFile(path.join(frontendRoot, 'index.html'));
  }
}
app.get('/center/:centerId', serveCenterOrNotFound);
app.get('/center/:centerId/*', serveCenterOrNotFound);

// ── DB Connection ─────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ustoz_yordamchi',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// ── Auto-migrate ──────────────────────────────────────────────────────────
const initDB = async () => {
  try {
    await pool.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // Admins jadvaliga multitenant ustunlarini qo'shish (migration)
    await pool.query(`ALTER TABLE admins ADD COLUMN IF NOT EXISTS login VARCHAR(100)`);
    await pool.query(`ALTER TABLE admins ADD COLUMN IF NOT EXISTS center_id INTEGER REFERENCES centers(id)`);
    await pool.query(`ALTER TABLE admins ADD COLUMN IF NOT EXISTS full_name VARCHAR(200)`);
    await pool.query(`ALTER TABLE admins ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`);
    // login bo'sh bo'lsa username bilan to'ldiramiz
    await pool.query(`UPDATE admins SET login=username WHERE login IS NULL`);
    await pool.query(`UPDATE admins SET is_active=true WHERE is_active IS NULL`);

    // Asosiy jadvallar (oldingi kod)
    await pool.query(`CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      login VARCHAR(100) UNIQUE NOT NULL,
      full_name VARCHAR(200) NOT NULL,
      phone VARCHAR(20),
      email VARCHAR(200) UNIQUE NOT NULL,
      group_name VARCHAR(100),
      password_hash VARCHAR(255) NOT NULL,
      is_verified BOOLEAN DEFAULT FALSE,
      verification_code VARCHAR(10),
      verification_expires TIMESTAMP,
      center_id INTEGER,
      created_at TIMESTAMP DEFAULT NOW()
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS mentors (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      full_name VARCHAR(200) NOT NULL,
      phone VARCHAR(20) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      center_id INTEGER,
      created_at TIMESTAMP DEFAULT NOW()
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS groups (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name VARCHAR(100) NOT NULL,
      mentor_id UUID REFERENCES mentors(id) ON DELETE SET NULL,
      lesson_days VARCHAR(20) DEFAULT 'juft',
      lesson_time TIME,
      start_date DATE,
      end_date DATE,
      subject VARCHAR(200),
      is_active BOOLEAN DEFAULT TRUE,
      center_id INTEGER,
      created_at TIMESTAMP DEFAULT NOW()
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS group_members (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      joined_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(group_id, user_id)
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS assignments (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
      mentor_id UUID REFERENCES mentors(id) ON DELETE SET NULL,
      title VARCHAR(500) NOT NULL,
      description TEXT,
      type VARCHAR(20) DEFAULT 'homework',
      due_date DATE,
      due_time TIME,
      lesson_date DATE,
      duration_minutes INTEGER,
      is_open BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW()
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS submissions (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      assignment_id UUID REFERENCES assignments(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      content TEXT,
      file_url VARCHAR(500),
      score INTEGER DEFAULT 0,
      ai_feedback TEXT,
      mentor_feedback TEXT,
      submitted_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(assignment_id, user_id)
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS chat_messages (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
      sender_id UUID NOT NULL,
      sender_type VARCHAR(20) NOT NULL,
      sender_name VARCHAR(200),
      message TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS scores (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
      assignment_id UUID REFERENCES assignments(id) ON DELETE SET NULL,
      score INTEGER DEFAULT 0,
      lesson_date DATE,
      updated_at TIMESTAMP DEFAULT NOW()
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS admins (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      username VARCHAR(100) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      center_id INTEGER,
      created_at TIMESTAMP DEFAULT NOW()
    )`);

    // ── MULTI-TENANT JADVALLAR ──────────────────────────
    await pool.query(`CREATE TABLE IF NOT EXISTS packages (
      id          SERIAL PRIMARY KEY,
      key         VARCHAR(50) UNIQUE NOT NULL,
      name        VARCHAR(100) NOT NULL,
      price       INTEGER NOT NULL DEFAULT 0,
      max_groups  INTEGER DEFAULT 1,
      max_mentors INTEGER DEFAULT 1,
      max_students INTEGER DEFAULT 10,
      created_at  TIMESTAMP DEFAULT NOW()
    )`);

    await pool.query(`
      INSERT INTO packages (key, name, price, max_groups, max_mentors, max_students) VALUES
        ('free',      'Free',      0,       1,  1,  10),
        ('pro',       'Pro',       499000,  20, -1, 400),
        ('unlimited', 'Unlimited', 1000000, -1, -1, -1)
      ON CONFLICT (key) DO NOTHING
    `);

    // Centers ID sequence 1001 dan
    await pool.query(`CREATE SEQUENCE IF NOT EXISTS centers_id_seq START 1001`);
    await pool.query(`CREATE TABLE IF NOT EXISTS centers (
      id                INTEGER PRIMARY KEY DEFAULT nextval('centers_id_seq'),
      name              VARCHAR(200) NOT NULL,
      city              VARCHAR(100),
      admin_name        VARCHAR(200) NOT NULL,
      phone             VARCHAR(30) NOT NULL,
      package_id        INTEGER REFERENCES packages(id) DEFAULT 1,
      is_active         BOOLEAN DEFAULT TRUE,
      trial_ends_at     TIMESTAMP,
      subscription_until DATE,
      created_at        TIMESTAMP DEFAULT NOW()
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS center_payments (
      id          SERIAL PRIMARY KEY,
      center_id   INTEGER REFERENCES centers(id) ON DELETE CASCADE,
      month       VARCHAR(7) NOT NULL,
      amount      INTEGER NOT NULL,
      order_id    VARCHAR(100),
      status      VARCHAR(20) DEFAULT 'pending',
      created_at  TIMESTAMP DEFAULT NOW(),
      paid_at     TIMESTAMP,
      UNIQUE(center_id, month)
    )`);

    // Default admin (bitta global)
    await pool.query(`
      INSERT INTO admins (username, password_hash)
      VALUES ('admin', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi')
      ON CONFLICT (username) DO NOTHING
    `);

    console.log('✅ Database tables ready!');
  } catch (err) {
    console.error('❌ DB init error:', err.message);
  }
};

pool.connect((err) => {
  if (err) console.error('DB connection error:', err);
  else { console.log('✅ PostgreSQL connected!'); initDB(); }
});

app.set('db', pool);

// ── ROUTES ────────────────────────────────────────────────────────────────
app.use('/api/auth',        require('./routes/auth'));
app.use('/api/admin',       require('./routes/admin'));
app.use('/api/mentor',      require('./routes/mentor'));
app.use('/api/student',     require('./routes/student'));
app.use('/api/groups',      require('./routes/groups'));
app.use('/api/assignments', require('./routes/assignments'));
app.use('/api/chat',        require('./routes/chat'));

// 🆕 Yangi routelar
app.use('/api/payments',    require('./routes/payments'));
app.use('/api/superadmin',  require('./routes/superadmin'));

// ── Health check ──────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({
  status:  'ok',
  service: 'Ustoz AI Backend',
  version: '2.0.0',
  baseUrl: process.env.BASE_URL || 'not set'
}));

// ── Root redirect yuqorida (static dan oldin) ────────────────────────────

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🛡️  Boss Admin: http://localhost:${PORT}/superadmin`);
  console.log(`🏢  O'quv markaz: http://localhost:${PORT}/center/1001`);
});

module.exports = app;
