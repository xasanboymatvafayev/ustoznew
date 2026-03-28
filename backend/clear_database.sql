-- Barcha ma'lumotlarni tozalash (jadvallarni saqlab)
TRUNCATE TABLE attendance CASCADE;
TRUNCATE TABLE scores CASCADE;
TRUNCATE TABLE submissions CASCADE;
TRUNCATE TABLE assignments CASCADE;
TRUNCATE TABLE chat_messages CASCADE;
TRUNCATE TABLE calendar_events CASCADE;
TRUNCATE TABLE group_members CASCADE;
TRUNCATE TABLE groups CASCADE;
TRUNCATE TABLE users CASCADE;
TRUNCATE TABLE mentors CASCADE;

-- Admin saqlanib qolsin
INSERT INTO admins (username, password_hash) 
VALUES ('admin', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi')
ON CONFLICT DO NOTHING;

SELECT 'Database tozalandi! Admin: admin / parol: sonnet123' as natija;
