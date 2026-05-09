-- Attendance jadvalini qo'shish (migration)
CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  lesson_date DATE NOT NULL,
  status VARCHAR(10) DEFAULT 'present',
  marked_by UUID REFERENCES mentors(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(group_id, user_id, lesson_date)
);
