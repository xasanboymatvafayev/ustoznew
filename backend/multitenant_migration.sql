-- =====================================================
-- MULTI-TENANT MIGRATION
-- O'quv markazlar + Paketlar + To'lovlar
-- =====================================================

-- ── PACKAGES (Paketlar) ──────────────────────────────
CREATE TABLE IF NOT EXISTS packages (
  id          SERIAL PRIMARY KEY,
  key         VARCHAR(50) UNIQUE NOT NULL,   -- 'free', 'pro', 'unlimited'
  name        VARCHAR(100) NOT NULL,
  price       INTEGER NOT NULL DEFAULT 0,    -- so'mda
  max_groups  INTEGER DEFAULT 1,             -- -1 = cheksiz
  max_mentors INTEGER DEFAULT 1,             -- -1 = cheksiz
  max_students INTEGER DEFAULT 10,           -- -1 = cheksiz
  created_at  TIMESTAMP DEFAULT NOW()
);

-- Default paketlar
INSERT INTO packages (key, name, price, max_groups, max_mentors, max_students) VALUES
  ('free',      'Free',      0,       1,  1,  10),
  ('pro',       'Pro',       499000,  20, -1, 400),
  ('unlimited', 'Unlimited', 1000000, -1, -1, -1)
ON CONFLICT (key) DO NOTHING;

-- ── CENTERS (O'quv markazlar) ─────────────────────────
-- ID 1001 dan boshlash uchun SEQUENCE
CREATE SEQUENCE IF NOT EXISTS centers_id_seq START 1001 INCREMENT 1;

CREATE TABLE IF NOT EXISTS centers (
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
);

-- ── CENTER PAYMENTS (Oylik to'lovlar) ────────────────
CREATE TABLE IF NOT EXISTS center_payments (
  id          SERIAL PRIMARY KEY,
  center_id   INTEGER REFERENCES centers(id) ON DELETE CASCADE,
  month       VARCHAR(7) NOT NULL,           -- '2026-05'
  amount      INTEGER NOT NULL,              -- so'mda
  order_id    VARCHAR(100),                  -- To'lovchi.uz order ID
  status      VARCHAR(20) DEFAULT 'pending', -- 'pending', 'paid', 'cancelled'
  created_at  TIMESTAMP DEFAULT NOW(),
  paid_at     TIMESTAMP,
  UNIQUE(center_id, month)
);

-- ── ADMINS jadvaliga center_id qo'shish ───────────────
-- (agar admins jadvali allaqachon bor bo'lsa)
ALTER TABLE admins ADD COLUMN IF NOT EXISTS center_id INTEGER REFERENCES centers(id);

-- ── USERS jadvaliga center_id qo'shish ───────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS center_id INTEGER REFERENCES centers(id);

-- ── MENTORS jadvaliga center_id qo'shish ─────────────
ALTER TABLE mentors ADD COLUMN IF NOT EXISTS center_id INTEGER REFERENCES centers(id);

-- ── GROUPS jadvaliga center_id qo'shish ──────────────
ALTER TABLE groups ADD COLUMN IF NOT EXISTS center_id INTEGER REFERENCES centers(id);

-- ── INDEXES ───────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_center    ON users(center_id);
CREATE INDEX IF NOT EXISTS idx_mentors_center  ON mentors(center_id);
CREATE INDEX IF NOT EXISTS idx_groups_center   ON groups(center_id);
CREATE INDEX IF NOT EXISTS idx_payments_center ON center_payments(center_id);
CREATE INDEX IF NOT EXISTS idx_payments_month  ON center_payments(month);
CREATE INDEX IF NOT EXISTS idx_centers_active  ON centers(is_active);
