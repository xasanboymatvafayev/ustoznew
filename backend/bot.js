/**
 * USTOZ YORDAMCHI — Telegram Bot
 * Ota-onalar uchun: o'quvchi baholar, reyting, davomat va vazifa xabarlari
 * 
 * Ishlatish:
 *   BOT_TOKEN=... node bot.js
 * 
 * Kerakli paket:
 *   npm install node-telegram-bot-api
 */

require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// ── DB ulanish ──────────────────────────────────────────────
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── Bot yaratish ────────────────────────────────────────────
const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error('❌  BOT_TOKEN .env faylida yo\'q!');
  process.exit(1);
}
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// ── Holatlar (session) ──────────────────────────────────────
// { chatId: { step, groupName, students, selectedStudent, email } }
const sessions = {};

function session(chatId) {
  if (!sessions[chatId]) sessions[chatId] = {};
  return sessions[chatId];
}
function clearSession(chatId) {
  sessions[chatId] = {};
}

// ── Yordamchi: inline tugmalar ──────────────────────────────
function mainMenu() {
  return {
    inline_keyboard: [
      [{ text: '📊 Baholarim',       callback_data: 'grades'     }],
      [{ text: '🏆 Sinfdagi reyting', callback_data: 'rating'     }],
      [{ text: '📅 Davomat',          callback_data: 'attendance' }],
      [{ text: '📝 Vazifalar',        callback_data: 'tasks'      }],
      [{ text: '👤 Profil',           callback_data: 'profile'    }],
    ],
  };
}

// ── /start ──────────────────────────────────────────────────
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;

  // Ro'yxatdan o'tganmi?
  const linked = await pool.query(
    'SELECT u.* FROM users u WHERE u.telegram_chat_id = $1 AND u.is_verified = true',
    [chatId.toString()]
  );

  if (linked.rows.length) {
    const u = linked.rows[0];
    return bot.sendMessage(
      chatId,
      `👋 Xush kelibsiz, *${u.full_name}*!\n\nQuyidagi bo'limlardan birini tanlang:`,
      { parse_mode: 'Markdown', reply_markup: mainMenu() }
    );
  }

  clearSession(chatId);
  session(chatId).step = 'ask_group';
  bot.sendMessage(
    chatId,
    '🎓 *Ustoz Yordamchi Botiga xush kelibsiz!*\n\n' +
    'Bu bot ota-onalar uchun: farzandingizning baholari, davomati va vazifalari haqida ma\'lumot olishingiz mumkin.\n\n' +
    '📌 Ro\'yxatdan o\'tish uchun *guruh nomini* kiriting (masalan: N45):',
    { parse_mode: 'Markdown' }
  );
});

// ── Matn xabarlari ──────────────────────────────────────────
bot.on('message', async (msg) => {
  if (msg.text && msg.text.startsWith('/')) return; // komandalar alohida
  const chatId = msg.chat.id;
  const text   = msg.text ? msg.text.trim() : '';
  const s      = session(chatId);

  // ── 1. Guruh nomi so'ralmoqda ──
  if (s.step === 'ask_group') {
    const res = await pool.query(
      `SELECT u.id, u.full_name, u.email
         FROM group_members gm
         JOIN users u ON gm.user_id = u.id
         JOIN groups g ON gm.group_id = g.id
        WHERE g.name ILIKE $1 AND u.is_verified = true
        ORDER BY u.full_name`,
      [text]
    );

    if (!res.rows.length) {
      return bot.sendMessage(
        chatId,
        `❌ *"${text}"* nomli guruh topilmadi yoki guruhda hech kim yo'q.\n\nQaytadan guruh nomini kiriting:`,
        { parse_mode: 'Markdown' }
      );
    }

    s.groupName = text;
    s.students  = res.rows;
    s.step      = 'choose_student';

    const keyboard = res.rows.map((st) => [
      { text: st.full_name, callback_data: `student_${st.id}` },
    ]);
    keyboard.push([{ text: '❌ Bekor qilish', callback_data: 'cancel' }]);

    return bot.sendMessage(
      chatId,
      `✅ *${text}* guruhida ${res.rows.length} ta o'quvchi topildi.\n\nFarzandingizni tanlang:`,
      { parse_mode: 'Markdown', reply_markup: { inline_keyboard: keyboard } }
    );
  }

  // ── 3. Parol kutilmoqda ──
  if (s.step === 'ask_password') {
    const student = s.selectedStudent;
    if (!student) return;

    // Web-sayt paroli bilan tekshirish
    const userRes = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [student.id]
    );
    const valid = await bcrypt.compare(text, userRes.rows[0].password_hash);
    if (!valid) {
      return bot.sendMessage(chatId, '❌ Parol noto\'g\'ri. Qaytadan kiriting:');
    }

    // Telegram chat_id saqlash + email kodi yuborish
    const code    = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(
      `UPDATE users
          SET verification_code = $1, verification_expires = $2, telegram_chat_id = $3
        WHERE id = $4`,
      [code, expires, chatId.toString(), student.id]
    );

    s.step          = 'ask_email_code';
    s.verifyUserId  = student.id;

    // ❗ Frontend EmailJS orqali yuboradi — biz kodni faqat DB ga saqlaymiz.
    // Agar backend Resend bilan ishlashini xohlasangiz, quyidagi blokni yoching:
    // await sendEmailCode(student.email, code);

    return bot.sendMessage(
      chatId,
      `📧 *${student.email}* manziliga tasdiqlash kodi yuborildi.\n\n` +
      '6 xonali kodni kiriting:',
      { parse_mode: 'Markdown' }
    );
  }

  // ── 4. Email kodi kutilmoqda ──
  if (s.step === 'ask_email_code') {
    const res = await pool.query(
      `SELECT id FROM users
        WHERE id = $1
          AND verification_code = $2
          AND verification_expires > NOW()`,
      [s.verifyUserId, text]
    );

    if (!res.rows.length) {
      return bot.sendMessage(
        chatId,
        '❌ Kod noto\'g\'ri yoki muddati o\'tgan. Qaytadan kiriting:'
      );
    }

    await pool.query(
      "UPDATE users SET verification_code = null WHERE id = $1",
      [s.verifyUserId]
    );

    clearSession(chatId);
    return bot.sendMessage(
      chatId,
      '🎉 *Muvaffaqiyatli ro\'yxatdan o\'tdingiz!*\n\nEndi quyidagi bo\'limlardan foydalanishingiz mumkin:',
      { parse_mode: 'Markdown', reply_markup: mainMenu() }
    );
  }
});

// ── Callback tugmalar ───────────────────────────────────────
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data   = query.data;
  const msgId  = query.message.message_id;
  const s      = session(chatId);

  await bot.answerCallbackQuery(query.id);

  // ── Bekor qilish ──
  if (data === 'cancel') {
    clearSession(chatId);
    return bot.editMessageText('❌ Bekor qilindi.', { chat_id: chatId, message_id: msgId });
  }

  // ── O'quvchi tanlandi ──
  if (data.startsWith('student_') && s.step === 'choose_student') {
    const studentId = data.replace('student_', '');
    const student   = s.students.find((st) => st.id === studentId);
    if (!student) return;

    s.selectedStudent = student;
    s.step            = 'ask_password';

    return bot.editMessageText(
      `👤 *${student.full_name}* tanlandi.\n\n` +
      '🔐 Web-saytdagi *parolini* kiriting (tasdiqlash uchun):',
      { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown' }
    );
  }

  // ── Asosiy menyudan oldin — foydalanuvchi ulangan bo'lishi kerak ──
  const linked = await pool.query(
    'SELECT u.* FROM users u WHERE u.telegram_chat_id = $1 AND u.is_verified = true',
    [chatId.toString()]
  );
  if (!linked.rows.length) {
    return bot.sendMessage(chatId, '⚠️ Avval /start orqali ro\'yxatdan o\'ting.');
  }
  const user = linked.rows[0];

  // ── Baholar ──
  if (data === 'grades') {
    const res = await pool.query(
      `SELECT a.title, s.score, s.submitted_at, a.type, a.lesson_date, a.due_date
         FROM submissions s
         JOIN assignments a ON s.assignment_id = a.id
        WHERE s.user_id = $1
        ORDER BY COALESCE(a.lesson_date, a.due_date) DESC
        LIMIT 20`,
      [user.id]
    );

    if (!res.rows.length) {
      return bot.editMessageText('📊 Hozircha baho yo\'q.', {
        chat_id: chatId, message_id: msgId, reply_markup: { inline_keyboard: [[{ text: '🏠 Bosh menyu', callback_data: 'menu' }]] }
      });
    }

    let text = `📊 *${user.full_name} — So'nggi baholar*\n\n`;
    for (const r of res.rows) {
      const date = r.lesson_date || r.due_date || '';
      const icon = r.score >= 80 ? '🟢' : r.score >= 60 ? '🟡' : '🔴';
      text += `${icon} *${r.title}*\n   Baho: ${r.score}/100  |  ${date}\n\n`;
    }

    return bot.editMessageText(text, {
      chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '🏠 Bosh menyu', callback_data: 'menu' }]] }
    });
  }

  // ── Reyting ──
  if (data === 'rating') {
    // O'quvchi guruhini toping
    const grpRes = await pool.query(
      `SELECT g.id, g.name FROM group_members gm JOIN groups g ON gm.group_id = g.id WHERE gm.user_id = $1 LIMIT 1`,
      [user.id]
    );
    if (!grpRes.rows.length) {
      return bot.editMessageText('⚠️ Hali hech qaysi guruhga qo\'shilmagansiz.', {
        chat_id: chatId, message_id: msgId
      });
    }
    const group = grpRes.rows[0];

    const rating = await pool.query(
      `SELECT u.full_name, COALESCE(SUM(s.score), 0) AS total
         FROM group_members gm
         JOIN users u ON gm.user_id = u.id
         LEFT JOIN submissions s ON s.user_id = u.id
         LEFT JOIN assignments a ON s.assignment_id = a.id AND a.group_id = $1
        WHERE gm.group_id = $1
        GROUP BY u.id, u.full_name
        ORDER BY total DESC`,
      [group.id]
    );

    let text = `🏆 *${group.name} guruhidagi reyting*\n\n`;
    let rank = 1;
    for (const r of rating.rows) {
      const isMine = r.full_name === user.full_name;
      const medal  = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
      text += `${medal} ${isMine ? '*' : ''}${r.full_name}${isMine ? '*' : ''} — ${r.total} ball\n`;
      rank++;
    }

    return bot.editMessageText(text, {
      chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '🏠 Bosh menyu', callback_data: 'menu' }]] }
    });
  }

  // ── Davomat ──
  if (data === 'attendance') {
    const res = await pool.query(
      `SELECT a.lesson_date, a.status
         FROM attendance a
        WHERE a.user_id = $1
        ORDER BY a.lesson_date DESC
        LIMIT 30`,
      [user.id]
    );

    if (!res.rows.length) {
      return bot.editMessageText('📅 Davomat ma\'lumoti yo\'q.', {
        chat_id: chatId, message_id: msgId,
        reply_markup: { inline_keyboard: [[{ text: '🏠 Bosh menyu', callback_data: 'menu' }]] }
      });
    }

    const total   = res.rows.length;
    const present = res.rows.filter((r) => r.status === 'present').length;
    const absent  = total - present;
    const pct     = Math.round((present / total) * 100);

    let text = `📅 *${user.full_name} — Davomat*\n\n`;
    text += `✅ Kelgan: ${present} / ${total} (${pct}%)\n`;
    text += `❌ Kelmagan: ${absent}\n\n`;
    text += `*So'nggi 10 dars:*\n`;
    for (const r of res.rows.slice(0, 10)) {
      const icon = r.status === 'present' ? '✅' : '❌';
      text += `${icon} ${r.lesson_date}\n`;
    }

    return bot.editMessageText(text, {
      chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '🏠 Bosh menyu', callback_data: 'menu' }]] }
    });
  }

  // ── Vazifalar ──
  if (data === 'tasks') {
    const res = await pool.query(
      `SELECT a.title, a.type, a.due_date, a.is_open,
              s.id as submitted_id, s.score
         FROM assignments a
         JOIN group_members gm ON a.group_id = gm.group_id
         LEFT JOIN submissions s ON s.assignment_id = a.id AND s.user_id = $1
        WHERE gm.user_id = $1
        ORDER BY a.created_at DESC
        LIMIT 15`,
      [user.id]
    );

    if (!res.rows.length) {
      return bot.editMessageText('📝 Hozircha vazifa yo\'q.', {
        chat_id: chatId, message_id: msgId,
        reply_markup: { inline_keyboard: [[{ text: '🏠 Bosh menyu', callback_data: 'menu' }]] }
      });
    }

    let text = `📝 *${user.full_name} — Vazifalar*\n\n`;
    for (const r of res.rows) {
      let status;
      if (r.submitted_id)   status = `✅ Topshirilgan (${r.score}/100)`;
      else if (!r.is_open)  status = '🔒 Yopilgan';
      else                  status = '⏳ Topshirilmagan';
      text += `• *${r.title}*\n  ${status}  |  ${r.due_date || ''}\n\n`;
    }

    return bot.editMessageText(text, {
      chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '🏠 Bosh menyu', callback_data: 'menu' }]] }
    });
  }

  // ── Profil ──
  if (data === 'profile') {
    const grpRes = await pool.query(
      `SELECT g.name FROM group_members gm JOIN groups g ON gm.group_id = g.id WHERE gm.user_id = $1`,
      [user.id]
    );
    const groups = grpRes.rows.map((r) => r.name).join(', ') || 'Guruh yo\'q';

    const text =
      `👤 *Profil*\n\n` +
      `📛 Ism: ${user.full_name}\n` +
      `📧 Email: ${user.email}\n` +
      `📱 Telefon: ${user.phone || '—'}\n` +
      `🎓 Guruh: ${groups}\n`;

    return bot.editMessageText(text, {
      chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '🏠 Bosh menyu', callback_data: 'menu' }]] }
    });
  }

  // ── Bosh menyu ──
  if (data === 'menu') {
    return bot.editMessageText(
      `👋 *${user.full_name}*, bo'limni tanlang:`,
      { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', reply_markup: mainMenu() }
    );
  }
});

// ════════════════════════════════════════════════════════════
// VAZIFA BAJARILMASA — TELEGRAM XABARI YUBORISH
// (Har kecha 20:00 da ishga tushadi)
// ════════════════════════════════════════════════════════════
async function notifyUnsubmittedTasks() {
  console.log('🔔  Topshirilmagan vazifalar tekshirilmoqda...');
  try {
    // Muddati o'tgan, ochiq vazifalarni topshirmagan o'quvchilar
    const res = await pool.query(`
      SELECT u.full_name, u.telegram_chat_id, a.title, a.due_date,
             COUNT(*) OVER (PARTITION BY u.id) AS total_missed
        FROM assignments a
        JOIN group_members gm ON a.group_id = gm.group_id
        JOIN users u ON gm.user_id = u.id
       WHERE a.type = 'homework'
         AND a.due_date < CURRENT_DATE
         AND a.is_open = false
         AND u.telegram_chat_id IS NOT NULL
         AND NOT EXISTS (
               SELECT 1 FROM submissions s
                WHERE s.assignment_id = a.id AND s.user_id = u.id
             )
       ORDER BY u.id, a.due_date DESC
    `);

    // Har bir o'quvchiga bitta xabar (oxirgi topshirilmagan vazifa)
    const seen = new Set();
    for (const r of res.rows) {
      if (seen.has(r.telegram_chat_id)) continue;
      seen.add(r.telegram_chat_id);

      const missed = parseInt(r.total_missed);
      let text =
        `⚠️ *Vazifa topshirilmadi!*\n\n` +
        `📝 Vazifa: *${r.title}*\n` +
        `📅 Muddat: ${r.due_date}\n\n`;

      if (missed >= 5) {
        text +=
          `🚨 Diqqat! Siz allaqachon *${missed} ta* vazifani topshirmadingiz.\n` +
          `Iltimos, mentor bilan bog'laning!`;
      } else {
        text += `Iltimos, vaqtida topshirishga harakat qiling.`;
      }

      try {
        await bot.sendMessage(r.telegram_chat_id, text, { parse_mode: 'Markdown' });
      } catch (e) {
        console.error(`Xabar yuborilmadi (${r.telegram_chat_id}):`, e.message);
      }
    }
    console.log(`✅  ${seen.size} ta o'quvchiga xabar yuborildi.`);
  } catch (e) {
    console.error('Xabar yuborishda xato:', e.message);
  }
}

// Har kecha 20:00 da ishga tushish
function scheduleNightly() {
  const now    = new Date();
  const target = new Date();
  target.setHours(20, 0, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  const delay = target - now;
  setTimeout(() => {
    notifyUnsubmittedTasks();
    setInterval(notifyUnsubmittedTasks, 24 * 60 * 60 * 1000);
  }, delay);
  console.log(`⏰  Kechki xabarnoma ${target.toLocaleTimeString()} da ishga tushadi.`);
}

scheduleNightly();

// ════════════════════════════════════════════════════════════
// DB migratsiya: telegram_chat_id ustuni qo'shish
// ════════════════════════════════════════════════════════════
(async () => {
  try {
    await pool.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS telegram_chat_id VARCHAR(30)
    `);
    console.log('✅  Bot ishga tushdi. Polling...');
  } catch (e) {
    console.error('Migration xato:', e.message);
  }
})();
