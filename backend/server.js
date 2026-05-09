require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

// DB Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ustoz_yordamchi',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Auto-migrate: create tables if not exist
const initDB = async () => {
  try {
    await pool.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

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
      created_at TIMESTAMP DEFAULT NOW()
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS mentors (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      full_name VARCHAR(200) NOT NULL,
      phone VARCHAR(20) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW()
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS groups (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name VARCHAR(100) UNIQUE NOT NULL,
      mentor_id UUID REFERENCES mentors(id) ON DELETE SET NULL,
      lesson_days VARCHAR(20) DEFAULT 'juft',
      lesson_time TIME,
      start_date DATE,
      end_date DATE,
      subject VARCHAR(200),
      is_active BOOLEAN DEFAULT TRUE,
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

    await pool.query(`CREATE TABLE IF NOT EXISTS calendar_events (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
      title VARCHAR(300) NOT NULL,
      event_date DATE NOT NULL,
      created_by_admin BOOLEAN DEFAULT TRUE,
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

    // Unique constraints for scores
    await pool.query(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_user_assignment') THEN
        ALTER TABLE scores ADD CONSTRAINT unique_user_assignment UNIQUE (user_id, assignment_id);
      END IF;
    END $$`).catch(() => {});

    await pool.query(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_user_group_date') THEN
        ALTER TABLE scores ADD CONSTRAINT unique_user_group_date UNIQUE (user_id, group_id, lesson_date);
      END IF;
    END $$`).catch(() => {});

    console.log('✅ Database tables ready!');
  } catch (err) {
    console.error('❌ DB init error:', err.message);
  }
};

pool.connect((err) => {
  if (err) console.error('DB connection error:', err);
  else { console.log('PostgreSQL connected!'); initDB(); }
});

app.set('db', pool);

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/mentor', require('./routes/mentor'));
app.use('/api/student', require('./routes/student'));
app.use('/api/groups', require('./routes/groups'));
app.use('/api/assignments', require('./routes/assignments'));
app.use('/api/chat', require('./routes/chat'));

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'Ustoz Yordamchi AI' }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;
