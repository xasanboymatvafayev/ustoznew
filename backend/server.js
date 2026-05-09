require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

// ── Static: Boss Admin Panel ─────────────────────────────────────────────
// superadmin/index.html → /superadmin/ da ochiladi
app.use('/superadmin', express.static(path.join(__dirname, 'public', 'superadmin')));

// ── Static: O'quv markaz frontendi ──────────────────────────────────────
// /center/:id → frontend React app (index.html)
// React app o'zi URL dan center ID ni oladi
const frontendBuild = path.join(__dirname, '..', 'frontend', 'build');
app.use('/center/:centerId', express.static(frontendBuild));
app.get('/center/:centerId/*', (req, res) => {
  res.sendFile(path.join(frontendBuild, 'index.html'));
});

// ── DB Connection ─────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ustoz_yordamchi',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// ── Auto-migrate ──────────────────────────────────────────────────────────
const initDB = async () => {
  try {
    await pool.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

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

// ── Root redirect ─────────────────────────────────────────────────────────
app.get('/', (req, res) => res.redirect('/superadmin'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🛡️  Boss Admin: http://localhost:${PORT}/superadmin`);
  console.log(`🏢  O'quv markaz: http://localhost:${PORT}/center/1001`);
});

module.exports = app;
