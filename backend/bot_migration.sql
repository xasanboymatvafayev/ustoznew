-- Telegram bot uchun migration
-- users jadvaliga telegram_chat_id ustuni qo'shish

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS telegram_chat_id VARCHAR(30);

-- Index (tezroq qidirish uchun)
CREATE INDEX IF NOT EXISTS idx_users_telegram_chat_id
  ON users(telegram_chat_id);
