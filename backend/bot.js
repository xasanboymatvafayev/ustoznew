require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── EmailJS orqali email yuborish ────────────────────────────
async function sendEmailCode(toEmail, code, fullName) {
  try {
    const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id:  'service_8ydilud',
        template_id: 'template_92ivt1m',
        user_id:     'j5RueHALLy0tonOBq',
        accessToken: 'b2ERBmdg-259dwmlIVxDu',
        template_params: {
          to_email: toEmail,
          to_name:  fullName,
          code:     code,
        },
      }),
    });
    if (res.ok) {
      console.log('Email yuborildi:', toEmail);
      return true;
    }
    const err = await res.text();
    console.error('EmailJS xato:', err);
    return false;
  } catch (e) {
    console.error('Email yuborishda xato:', e.message);
    return false;
  }
}

// ── Bot ──────────────────────────────────────────────────────
const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) { console.error('BOT_TOKEN yoq'); process.exit(1); }
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// ── Session ──────────────────────────────────────────────────
const sessions = {};
function session(chatId) {
  if (!sessions[chatId]) sessions[chatId] = {};
  return sessions[chatId];
}
function clearSession(chatId) { sessions[chatId] = {}; }

// ── Asosiy menyu ─────────────────────────────────────────────
function mainMenu() {
  return {
    inline_keyboard: [
      [{ text: '📊 Baholarim',        callback_data: 'grades'     }],
      [{ text: '🏆 Sinfdagi reyting',  callback_data: 'rating'     }],
      [{ text: '📅 Davomat',           callback_data: 'attendance' }],
      [{ text: '📝 Vazifalar',         callback_data: 'tasks'      }],
      [{ text: '👤 Profil',            callback_data: 'profile'    }],
    ],
  };
}

// ── /start ───────────────────────────────────────────────────
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const linked = await pool.query(
    'SELECT * FROM users WHERE telegram_chat_id=$1 AND is_verified=true',
    [chatId.toString()]
  );
  if (linked.rows.length) {
    return bot.sendMessage(chatId,
      `👋 Xush kelibsiz, *${linked.rows[0].full_name}*!\n\nQuyidagi bo'limlardan birini tanlang:`,
      { parse_mode: 'Markdown', reply_markup: mainMenu() }
    );
  }
  clearSession(chatId);
  session(chatId).step = 'ask_group';
  bot.sendMessage(chatId,
    '🎓 *Ustoz Yordamchi Botiga xush kelibsiz!*\n\n' +
    'Bu bot ota-onalar uchun: farzandingizning baholari, davomati va vazifalari haqida ma\'lumot olishingiz mumkin.\n\n' +
    '📌 Ro\'yxatdan o\'tish uchun *guruh nomini* kiriting (masalan: N45):',
    { parse_mode: 'Markdown' }
  );
});

// ── Matn xabarlari ───────────────────────────────────────────
bot.on('message', async (msg) => {
  if (!msg.text || msg.text.startsWith('/')) return;
  const chatId = msg.chat.id;
  const text = msg.text.trim();
  const s = session(chatId);

  // 1. Guruh nomi
  if (s.step === 'ask_group') {
    const res = await pool.query(
      `SELECT u.id, u.full_name, u.email
         FROM group_members gm
         JOIN users u ON gm.user_id=u.id
         JOIN groups g ON gm.group_id=g.id
        WHERE g.name ILIKE $1 AND u.is_verified=true
        ORDER BY u.full_name`,
      [text]
    );
    if (!res.rows.length) {
      return bot.sendMessage(chatId,
        `❌ *"${text}"* nomli guruh topilmadi.\n\nQaytadan kiriting:`,
        { parse_mode: 'Markdown' }
      );
    }
    s.groupName = text;
    s.students = res.rows;
    s.step = 'choose_student';
    const keyboard = res.rows.map(st => [{ text: st.full_name, callback_data: `student_${st.id}` }]);
    keyboard.push([{ text: '❌ Bekor qilish', callback_data: 'cancel' }]);
    return bot.sendMessage(chatId,
      `✅ *${text}* guruhida ${res.rows.length} ta o'quvchi.\n\nFarzandingizni tanlang:`,
      { parse_mode: 'Markdown', reply_markup: { inline_keyboard: keyboard } }
    );
  }

  // 2. Parol
  if (s.step === 'ask_password') {
    const student = s.selectedStudent;
    if (!student) return;
    const userRes = await pool.query('SELECT * FROM users WHERE id=$1', [student.id]);
    const valid = await bcrypt.compare(text, userRes.rows[0].password_hash);
    if (!valid) return bot.sendMessage(chatId, '❌ Parol noto\'g\'ri. Qaytadan kiriting:');

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000);
    // telegram_chat_id ni HALI saqlamaymiz — faqat kod tasdiqlangandan keyin saqlanadi
    await pool.query(
      `UPDATE users SET verification_code=$1, verification_expires=$2 WHERE id=$3`,
      [code, expires, student.id]
    );
    s.step = 'ask_email_code';
    s.verifyUserId = student.id;
    s.pendingChatId = chatId.toString(); // vaqtinchalik session da saqlaymiz

    const sent = await sendEmailCode(student.email, code, student.full_name);
    if (!sent) {
      return bot.sendMessage(chatId,
        '⚠️ Email yuborishda xatolik yuz berdi. Iltimos qayta urinib ko\'ring yoki adminga murojaat qiling.'
      );
    }
    return bot.sendMessage(chatId,
      `📧 *${student.email}* manziliga tasdiqlash kodi yuborildi.\n\n6 xonali kodni kiriting:`,
      { parse_mode: 'Markdown' }
    );
  }

  // 3. Email kodi
  if (s.step === 'ask_email_code') {
    const res = await pool.query(
      `SELECT id FROM users WHERE id=$1 AND verification_code=$2 AND verification_expires>NOW()`,
      [s.verifyUserId, text]
    );
    if (!res.rows.length) {
      return bot.sendMessage(chatId, '❌ Kod noto\'g\'ri yoki muddati o\'tgan. Qaytadan kiriting:');
    }
    // Faqat shu yerda telegram_chat_id saqlanadi — xavfsiz
    await pool.query(
      'UPDATE users SET verification_code=null, telegram_chat_id=$1 WHERE id=$2',
      [s.pendingChatId, s.verifyUserId]
    );
    clearSession(chatId);
    return bot.sendMessage(chatId,
      '🎉 *Muvaffaqiyatli ro\'yxatdan o\'tdingiz!*\n\nEndi quyidagi bo\'limlardan foydalanishingiz mumkin:',
      { parse_mode: 'Markdown', reply_markup: mainMenu() }
    );
  }
});

// ── Callback tugmalar ────────────────────────────────────────
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;
  const msgId = query.message.message_id;
  const s = session(chatId);
  await bot.answerCallbackQuery(query.id);

  if (data === 'cancel') {
    clearSession(chatId);
    return bot.editMessageText('❌ Bekor qilindi.', { chat_id: chatId, message_id: msgId });
  }

  if (data.startsWith('student_') && s.step === 'choose_student') {
    const studentId = data.replace('student_', '');
    const student = s.students.find(st => st.id === studentId);
    if (!student) return;
    s.selectedStudent = student;
    s.step = 'ask_password';
    return bot.editMessageText(
      `👤 *${student.full_name}* tanlandi.\n\n🔐 Web-saytdagi *parolini* kiriting:`,
      { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown' }
    );
  }

  const linked = await pool.query(
    'SELECT * FROM users WHERE telegram_chat_id=$1 AND is_verified=true',
    [chatId.toString()]
  );
  if (!linked.rows.length) {
    return bot.sendMessage(chatId, '⚠️ Avval /start orqali ro\'yxatdan o\'ting.');
  }
  const user = linked.rows[0];

  // Baholar
  if (data === 'grades') {
    const res = await pool.query(
      `SELECT a.title, s.score, a.lesson_date, a.due_date
         FROM submissions s JOIN assignments a ON s.assignment_id=a.id
        WHERE s.user_id=$1 ORDER BY COALESCE(a.lesson_date,a.due_date) DESC LIMIT 20`,
      [user.id]
    );
    if (!res.rows.length) {
      return bot.editMessageText('📊 Hozircha baho yo\'q.', {
        chat_id: chatId, message_id: msgId,
        reply_markup: { inline_keyboard: [[{ text: '🏠 Bosh menyu', callback_data: 'menu' }]] }
      });
    }
    let txt = `📊 *${user.full_name} — So'nggi baholar*\n\n`;
    for (const r of res.rows) {
      const date = r.lesson_date || r.due_date || '';
      const icon = r.score >= 80 ? '🟢' : r.score >= 60 ? '🟡' : '🔴';
      txt += `${icon} *${r.title}*\n   Baho: ${r.score}/100  |  ${date}\n\n`;
    }
    return bot.editMessageText(txt, {
      chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '🏠 Bosh menyu', callback_data: 'menu' }]] }
    });
  }

  // Reyting
  if (data === 'rating') {
    const grpRes = await pool.query(
      `SELECT g.id, g.name FROM group_members gm JOIN groups g ON gm.group_id=g.id WHERE gm.user_id=$1 LIMIT 1`,
      [user.id]
    );
    if (!grpRes.rows.length) {
      return bot.editMessageText('⚠️ Guruhga qo\'shilmagansiz.', { chat_id: chatId, message_id: msgId });
    }
    const group = grpRes.rows[0];
    const rating = await pool.query(
      `SELECT u.full_name, COALESCE(SUM(s.score),0) AS total
         FROM group_members gm JOIN users u ON gm.user_id=u.id
         LEFT JOIN submissions s ON s.user_id=u.id
         LEFT JOIN assignments a ON s.assignment_id=a.id AND a.group_id=$1
        WHERE gm.group_id=$1 GROUP BY u.id, u.full_name ORDER BY total DESC`,
      [group.id]
    );
    let txt = `🏆 *${group.name} guruhidagi reyting*\n\n`;
    let rank = 1;
    for (const r of rating.rows) {
      const isMine = r.full_name === user.full_name;
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
      txt += `${medal} ${isMine ? '*' : ''}${r.full_name}${isMine ? '*' : ''} — ${r.total} ball\n`;
      rank++;
    }
    return bot.editMessageText(txt, {
      chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '🏠 Bosh menyu', callback_data: 'menu' }]] }
    });
  }

  // Davomat
  if (data === 'attendance') {
    const res = await pool.query(
      `SELECT lesson_date, status FROM attendance WHERE user_id=$1 ORDER BY lesson_date DESC LIMIT 30`,
      [user.id]
    );
    if (!res.rows.length) {
      return bot.editMessageText('📅 Davomat ma\'lumoti yo\'q.', {
        chat_id: chatId, message_id: msgId,
        reply_markup: { inline_keyboard: [[{ text: '🏠 Bosh menyu', callback_data: 'menu' }]] }
      });
    }
    const total = res.rows.length;
    const present = res.rows.filter(r => r.status === 'present').length;
    const pct = Math.round((present / total) * 100);
    let txt = `📅 *${user.full_name} — Davomat*\n\n`;
    txt += `✅ Kelgan: ${present} / ${total} (${pct}%)\n`;
    txt += `❌ Kelmagan: ${total - present}\n\n*So'nggi 10 dars:*\n`;
    for (const r of res.rows.slice(0, 10)) {
      txt += `${r.status === 'present' ? '✅' : '❌'} ${r.lesson_date}\n`;
    }
    return bot.editMessageText(txt, {
      chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '🏠 Bosh menyu', callback_data: 'menu' }]] }
    });
  }

  // Vazifalar
  if (data === 'tasks') {
    const res = await pool.query(
      `SELECT a.title, a.due_date, a.is_open, s.id as sid, s.score
         FROM assignments a
         JOIN group_members gm ON a.group_id=gm.group_id
         LEFT JOIN submissions s ON s.assignment_id=a.id AND s.user_id=$1
        WHERE gm.user_id=$1 ORDER BY a.created_at DESC LIMIT 15`,
      [user.id]
    );
    if (!res.rows.length) {
      return bot.editMessageText('📝 Hozircha vazifa yo\'q.', {
        chat_id: chatId, message_id: msgId,
        reply_markup: { inline_keyboard: [[{ text: '🏠 Bosh menyu', callback_data: 'menu' }]] }
      });
    }
    let txt = `📝 *${user.full_name} — Vazifalar*\n\n`;
    for (const r of res.rows) {
      const status = r.sid ? `✅ Topshirilgan (${r.score}/100)` : !r.is_open ? '🔒 Yopilgan' : '⏳ Topshirilmagan';
      txt += `• *${r.title}*\n  ${status}  |  ${r.due_date || ''}\n\n`;
    }
    return bot.editMessageText(txt, {
      chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '🏠 Bosh menyu', callback_data: 'menu' }]] }
    });
  }

  // Profil
  if (data === 'profile') {
    const grpRes = await pool.query(
      `SELECT g.name FROM group_members gm JOIN groups g ON gm.group_id=g.id WHERE gm.user_id=$1`,
      [user.id]
    );
    const groups = grpRes.rows.map(r => r.name).join(', ') || 'Guruh yo\'q';
    const txt =
      `👤 *Profil*\n\n` +
      `📛 Ism: ${user.full_name}\n` +
      `📧 Email: ${user.email}\n` +
      `📱 Telefon: ${user.phone || '—'}\n` +
      `🎓 Guruh: ${groups}\n`;
    return bot.editMessageText(txt, {
      chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🏠 Bosh menyu', callback_data: 'menu' }],
          [{ text: '🚪 Profildan chiqish', callback_data: 'logout' }],
        ]
      }
    });
  }

  // Chiqish
  if (data === 'logout') {
    await pool.query('UPDATE users SET telegram_chat_id=null WHERE telegram_chat_id=$1', [chatId.toString()]);
    clearSession(chatId);
    return bot.editMessageText(
      '👋 Profildan chiqdingiz.\n\nQaytadan ulanish uchun /start yozing.',
      { chat_id: chatId, message_id: msgId }
    );
  }

  // Bosh menyu
  if (data === 'menu') {
    return bot.editMessageText(
      `👋 *${user.full_name}*, bo'limni tanlang:`,
      { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', reply_markup: mainMenu() }
    );
  }
});

// ── Kechki xabarnoma (20:00) ─────────────────────────────────
async function notifyUnsubmitted() {
  try {
    const res = await pool.query(`
      SELECT u.full_name, u.telegram_chat_id, a.title, a.due_date,
             COUNT(*) OVER (PARTITION BY u.id) AS total_missed
        FROM assignments a
        JOIN group_members gm ON a.group_id=gm.group_id
        JOIN users u ON gm.user_id=u.id
       WHERE a.type='homework' AND a.due_date < CURRENT_DATE
         AND u.telegram_chat_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM submissions s WHERE s.assignment_id=a.id AND s.user_id=u.id)
       ORDER BY u.id, a.due_date DESC
    `);
    const seen = new Set();
    for (const r of res.rows) {
      if (seen.has(r.telegram_chat_id)) continue;
      seen.add(r.telegram_chat_id);
      const missed = parseInt(r.total_missed);
      let txt = `⚠️ *Vazifa topshirilmadi!*\n\n📝 *${r.title}*\n📅 Muddat: ${r.due_date}\n\n`;
      if (missed >= 5) {
        txt += `🚨 Siz allaqachon *${missed} ta* vazifani topshirmadingiz!\nIltimos, mentor bilan bog'laning!`;
      } else {
        txt += `Iltimos, vaqtida topshirishga harakat qiling.`;
      }
      try { await bot.sendMessage(r.telegram_chat_id, txt, { parse_mode: 'Markdown' }); } catch {}
    }
    console.log(`Xabarnoma: ${seen.size} ta o'quvchi`);
  } catch (e) { console.error('Xabarnoma xato:', e.message); }
}

function scheduleNightly() {
  const now = new Date();
  const target = new Date();
  target.setHours(20, 0, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  setTimeout(() => {
    notifyUnsubmitted();
    setInterval(notifyUnsubmitted, 24 * 60 * 60 * 1000);
  }, target - now);
}
scheduleNightly();

// ── Migration ────────────────────────────────────────────────
(async () => {
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_chat_id VARCHAR(30)`);
  console.log('✅ Bot ishga tushdi');
})();
