require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const ADMIN_IDS = ['6365371142' , '8517530604'];
const isAdmin = (id) => ADMIN_IDS.includes(id.toString());

// ── EmailJS ──────────────────────────────────────────────────
async function sendEmailCode(toEmail, code, fullName) {
  try {
    const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: 'service_8ydilud', template_id: 'template_92ivt1m',
        user_id: 'j5RueHALLy0tonOBq', accessToken: 'b2ERBmdg-259dwmlIVxDu',
        template_params: { to_email: toEmail, to_name: fullName, code },
      }),
    });
    return res.ok;
  } catch { return false; }
}

// ── Bot ──────────────────────────────────────────────────────
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const sessions = {};
const session = (id) => { if (!sessions[id]) sessions[id] = {}; return sessions[id]; };
const clearSession = (id) => { sessions[id] = {}; };

// ── Menyular ─────────────────────────────────────────────────
const mainMenu = () => ({
  inline_keyboard: [
    [
      { text: '📊 Baholar',   callback_data: 'grades' },
      { text: '🏆 Reyting',   callback_data: 'rating' },
    ],
    [
      { text: '📅 Davomat',   callback_data: 'attendance' },
      { text: '📝 Vazifalar', callback_data: 'tasks' },
    ],
    [{ text: '👤 Profil va sozlamalar', callback_data: 'profile' }],
  ],
});

const adminMenu = () => ({
  inline_keyboard: [
    [
      { text: '📊 Statistika',  callback_data: 'admin_stats' },
      { text: '🏫 Guruhlar',    callback_data: 'admin_groups' },
    ],
    [
      { text: '👥 O\'quvchilar', callback_data: 'admin_users' },
      { text: '📢 Rasilka',     callback_data: 'admin_broadcast' },
    ],
  ],
});

const backToMain = () => ({ inline_keyboard: [[{ text: '🏠 Bosh menyu', callback_data: 'menu' }]] });
const backToAdmin = () => ({ inline_keyboard: [[{ text: '🔙 Admin menyu', callback_data: 'admin_menu' }]] });

// ── /start ───────────────────────────────────────────────────
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;

  if (isAdmin(chatId)) {
    return bot.sendMessage(chatId,
      `╔══════════════════════╗\n` +
      `║   🛡️  ADMIN PANEL    ║\n` +
      `╚══════════════════════╝\n\n` +
      `Xush kelibsiz, *Admin*!\n\n` +
      `Quyidagi bo'limlardan birini tanlang:`,
      { parse_mode: 'Markdown', reply_markup: adminMenu() }
    );
  }

  const linked = await pool.query(
    'SELECT * FROM users WHERE telegram_chat_id=$1 AND is_verified=true', [chatId.toString()]
  );
  if (linked.rows.length) {
    const u = linked.rows[0];
    return bot.sendMessage(chatId,
      `👋 Xush kelibsiz, *${u.full_name}*!\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `🎓 Ustoz Yordamchi Bot\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `Quyidagi bo'limlardan birini tanlang 👇`,
      { parse_mode: 'Markdown', reply_markup: mainMenu() }
    );
  }

  clearSession(chatId);
  session(chatId).step = 'ask_group';
  bot.sendMessage(chatId,
    `🎓 *Ustoz Yordamchi*\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `Bu bot ota-onalar uchun:\n` +
    `• 📊 Farzandingiz baholari\n` +
    `• 📅 Davomat holati\n` +
    `• 📝 Vazifalar\n` +
    `• 🏆 Sinf reytingi\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `📌 Boshlash uchun *guruh nomini* kiriting:\n` +
    `_(masalan: N45, A1, Python-2)_`,
    { parse_mode: 'Markdown' }
  );
});

// ── Matn xabarlari ───────────────────────────────────────────
bot.on('message', async (msg) => {
  if (!msg.text || msg.text.startsWith('/')) return;
  const chatId = msg.chat.id;
  const text = msg.text.trim();
  const s = session(chatId);

  // Admin rasilka
  if (isAdmin(chatId) && s.step === 'admin_broadcast') {
    clearSession(chatId);
    const statusMsg = await bot.sendMessage(chatId, '📡 Rasilka yuborilmoqda...');
    const users = await pool.query(
      'SELECT telegram_chat_id FROM users WHERE telegram_chat_id IS NOT NULL AND is_verified=true'
    );
    let sent = 0, failed = 0;
    for (const u of users.rows) {
      try {
        await bot.sendMessage(u.telegram_chat_id,
          `📢 *Ustoz Yordamchi — E'lon*\n━━━━━━━━━━━━━━━━━━━━━\n\n${text}`,
          { parse_mode: 'Markdown' }
        );
        sent++;
        await new Promise(r => setTimeout(r, 50));
      } catch { failed++; }
    }
    await bot.deleteMessage(chatId, statusMsg.message_id);
    return bot.sendMessage(chatId,
      `✅ *Rasilka tugadi!*\n\n` +
      `📤 Muvaffaqiyatli: *${sent}* ta\n` +
      `❌ Xato: *${failed}* ta\n` +
      `👥 Jami: *${sent + failed}* ta`,
      { parse_mode: 'Markdown', reply_markup: adminMenu() }
    );
  }

  // 1. Guruh nomi
  if (s.step === 'ask_group') {
    const res = await pool.query(
      `SELECT u.id, u.full_name, u.email
         FROM group_members gm JOIN users u ON gm.user_id=u.id
         JOIN groups g ON gm.group_id=g.id
        WHERE g.name ILIKE $1 AND u.is_verified=true ORDER BY u.full_name`,
      [text]
    );
    if (!res.rows.length) {
      return bot.sendMessage(chatId,
        `❌ *"${text}"* guruh topilmadi\n\n_Guruh nomini to'g'ri kiriting:_`,
        { parse_mode: 'Markdown' }
      );
    }
    s.groupName = text; s.students = res.rows; s.step = 'choose_student';
    const keyboard = res.rows.map(st => [{ text: `👤 ${st.full_name}`, callback_data: `student_${st.id}` }]);
    keyboard.push([{ text: '❌ Bekor qilish', callback_data: 'cancel' }]);
    return bot.sendMessage(chatId,
      `✅ *${text}* guruhida *${res.rows.length}* ta o'quvchi\n\n` +
      `👇 Farzandingizni tanlang:`,
      { parse_mode: 'Markdown', reply_markup: { inline_keyboard: keyboard } }
    );
  }

  // 2. Parol
  if (s.step === 'ask_password') {
    const student = s.selectedStudent;
    if (!student) return;
    const userRes = await pool.query('SELECT * FROM users WHERE id=$1', [student.id]);
    const valid = await bcrypt.compare(text, userRes.rows[0].password_hash);
    if (!valid) {
      return bot.sendMessage(chatId,
        `❌ *Parol noto'g'ri*\n\nQaytadan kiriting:`,
        { parse_mode: 'Markdown' }
      );
    }
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000);
    await pool.query(
      `UPDATE users SET verification_code=$1, verification_expires=$2 WHERE id=$3`,
      [code, expires, student.id]
    );
    s.step = 'ask_email_code'; s.verifyUserId = student.id; s.pendingChatId = chatId.toString();

    const sent = await sendEmailCode(student.email, code, student.full_name);
    if (!sent) {
      return bot.sendMessage(chatId,
        `⚠️ *Email yuborishda xatolik*\n\nIltimos qayta urinib ko'ring yoki adminga murojaat qiling.`,
        { parse_mode: 'Markdown' }
      );
    }
    return bot.sendMessage(chatId,
      `📧 *Tasdiqlash kodi yuborildi!*\n\n` +
      `📮 Email: \`${student.email}\`\n` +
      `⏳ Amal qilish vaqti: *10 daqiqa*\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `👇 6 xonali kodni kiriting:`,
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
      return bot.sendMessage(chatId,
        `❌ *Kod noto'g'ri yoki muddati o'tgan*\n\nQaytadan kiriting:`,
        { parse_mode: 'Markdown' }
      );
    }
    await pool.query(
      'UPDATE users SET verification_code=null, telegram_chat_id=$1 WHERE id=$2',
      [s.pendingChatId, s.verifyUserId]
    );
    clearSession(chatId);
    return bot.sendMessage(chatId,
      `🎉 *Muvaffaqiyatli ro'yxatdan o'tdingiz!*\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `Endi farzandingiz haqida\n` +
      `barcha ma'lumotlarni ko'rishingiz mumkin 👇`,
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

  // ── ADMIN ────────────────────────────────────────────────
  if (isAdmin(chatId)) {
    if (data === 'admin_menu') {
      return bot.editMessageText(
        `╔══════════════════════╗\n` +
        `║   🛡️  ADMIN PANEL    ║\n` +
        `╚══════════════════════╝\n\n` +
        `Bo'limni tanlang:`,
        { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', reply_markup: adminMenu() }
      );
    }

    if (data === 'admin_stats') {
      const q = await pool.query(`
        SELECT
          (SELECT COUNT(*) FROM users WHERE is_verified=true)::int as students,
          (SELECT COUNT(*) FROM mentors WHERE is_active=true)::int as mentors,
          (SELECT COUNT(*) FROM groups WHERE is_active=true)::int as groups,
          (SELECT COUNT(*) FROM users WHERE telegram_chat_id IS NOT NULL AND is_verified=true)::int as bot_users,
          (SELECT COUNT(*) FROM assignments)::int as assignments,
          (SELECT COUNT(*) FROM submissions)::int as submissions
      `);
      const s = q.rows[0];
      return bot.editMessageText(
        `📊 *Tizim statistikasi*\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `🎓 O'quvchilar:        *${s.students}* ta\n` +
        `👨‍🏫 Mentorlar:          *${s.mentors}* ta\n` +
        `🏫 Faol guruhlar:      *${s.groups}* ta\n` +
        `✈️  Bot foydalanuvchi: *${s.bot_users}* ta\n` +
        `📝 Jami vazifalar:     *${s.assignments}* ta\n` +
        `✅ Topshirishlar:      *${s.submissions}* ta\n\n` +
        `📈 Bot ulash foizi: *${s.students > 0 ? Math.round(s.bot_users/s.students*100) : 0}%*`,
        { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', reply_markup: backToAdmin() }
      );
    }

    if (data === 'admin_broadcast') {
      session(chatId).step = 'admin_broadcast';
      return bot.editMessageText(
        `📢 *Rasilka yuborish*\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `Barcha bot foydalanuvchilariga yuboriladigan\n` +
        `xabar matnini yozing:\n\n` +
        `_Markdown ishlaydi:_\n` +
        `• \`*qalin*\` → *qalin*\n` +
        `• \`_kursiv_\` → _kursiv_\n` +
        `• \`\`\`kod\`\`\` → kod bloki`,
        { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[{ text: '❌ Bekor qilish', callback_data: 'admin_menu' }]] }
        }
      );
    }

    if (data === 'admin_users') {
      const res = await pool.query(`
        SELECT u.full_name, u.group_name,
               CASE WHEN u.telegram_chat_id IS NOT NULL THEN '✅' ELSE '➖' END as bot
        FROM users u WHERE u.is_verified=true ORDER BY u.created_at DESC LIMIT 20
      `);
      let txt = `👥 *So'nggi 20 ta o'quvchi*\n━━━━━━━━━━━━━━━━━━━━━\n\n`;
      res.rows.forEach((u, i) => {
        txt += `${i+1}. ${u.bot} *${u.full_name}*\n   📚 ${u.group_name || '—'}\n`;
      });
      txt += `\n✅ = Bot ulangan  ➖ = Ulanmagan`;
      return bot.editMessageText(txt, {
        chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', reply_markup: backToAdmin()
      });
    }

    if (data === 'admin_groups') {
      const res = await pool.query(`
        SELECT g.name, g.subject, g.lesson_days,
               (SELECT COUNT(*) FROM group_members WHERE group_id=g.id)::int as cnt,
               m.full_name as mentor
        FROM groups g LEFT JOIN mentors m ON g.mentor_id=m.id
        WHERE g.is_active=true ORDER BY g.name
      `);
      let txt = `🏫 *Faol guruhlar* (${res.rows.length} ta)\n━━━━━━━━━━━━━━━━━━━━━\n\n`;
      res.rows.forEach(g => {
        const days = g.lesson_days === 'juft' ? 'Se,Pay,Sha' : g.lesson_days === 'toq' ? 'Du,Chor,Ju' : 'Har kuni';
        txt += `📚 *${g.name}* — ${g.cnt} o'q\n`;
        txt += `   👨‍🏫 ${g.mentor || 'Mentor yo\'q'} | 📅 ${days}\n\n`;
      });
      return bot.editMessageText(txt, {
        chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', reply_markup: backToAdmin()
      });
    }
  }

  // ── UMUMIY ───────────────────────────────────────────────
  if (data === 'cancel') {
    clearSession(chatId);
    return bot.editMessageText('❌ Bekor qilindi.', { chat_id: chatId, message_id: msgId });
  }

  if (data.startsWith('student_') && s.step === 'choose_student') {
    const student = s.students.find(st => st.id === data.replace('student_', ''));
    if (!student) return;
    s.selectedStudent = student; s.step = 'ask_password';
    return bot.editMessageText(
      `👤 *${student.full_name}* tanlandi\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `🔐 Web-saytdagi *parolini* kiriting:`,
      { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown' }
    );
  }

  const linked = await pool.query(
    'SELECT * FROM users WHERE telegram_chat_id=$1 AND is_verified=true', [chatId.toString()]
  );
  if (!linked.rows.length) {
    return bot.sendMessage(chatId, '⚠️ Avval /start orqali ro\'yxatdan o\'ting.');
  }
  const user = linked.rows[0];

  // Baholar
  if (data === 'grades') {
    const res = await pool.query(
      `SELECT a.title, s.score, a.lesson_date, a.due_date, a.type
         FROM submissions s JOIN assignments a ON s.assignment_id=a.id
        WHERE s.user_id=$1 ORDER BY COALESCE(a.lesson_date,a.due_date) DESC LIMIT 15`,
      [user.id]
    );
    if (!res.rows.length) {
      return bot.editMessageText(
        `📊 *Baholar*\n━━━━━━━━━━━━━━━━━━━━━\n\nHozircha baho yo'q`,
        { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', reply_markup: backToMain() }
      );
    }
    const avg = Math.round(res.rows.reduce((a,b) => a + b.score, 0) / res.rows.length);
    let txt = `📊 *Baholar — ${user.full_name}*\n━━━━━━━━━━━━━━━━━━━━━\n\n`;
    for (const r of res.rows) {
      const date = (r.lesson_date || r.due_date || '').toString().slice(0, 10);
      const icon = r.score >= 85 ? '🟢' : r.score >= 60 ? '🟡' : '🔴';
      const bar = '█'.repeat(Math.floor(r.score/10)) + '░'.repeat(10-Math.floor(r.score/10));
      txt += `${icon} *${r.title}*\n   ${bar} ${r.score}/100\n   📅 ${date}\n\n`;
    }
    txt += `━━━━━━━━━━━━━━━━━━━━━\n📈 O'rtacha ball: *${avg}/100*`;
    return bot.editMessageText(txt, {
      chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', reply_markup: backToMain()
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
      `SELECT u.full_name, COALESCE(SUM(s.score),0)::int AS total
         FROM group_members gm JOIN users u ON gm.user_id=u.id
         LEFT JOIN submissions s ON s.user_id=u.id
         LEFT JOIN assignments a ON s.assignment_id=a.id AND a.group_id=$1
        WHERE gm.group_id=$1 GROUP BY u.id, u.full_name ORDER BY total DESC`,
      [group.id]
    );
    let txt = `🏆 *${group.name} — Reyting*\n━━━━━━━━━━━━━━━━━━━━━\n\n`;
    const medals = ['🥇','🥈','🥉'];
    rating.rows.forEach((r, i) => {
      const isMine = r.full_name === user.full_name;
      const medal = medals[i] || `${i+1}.`;
      const name = isMine ? `*${r.full_name}* 👈` : r.full_name;
      txt += `${medal} ${name}\n   💯 ${r.total} ball\n`;
    });
    const myRank = rating.rows.findIndex(r => r.full_name === user.full_name) + 1;
    txt += `\n━━━━━━━━━━━━━━━━━━━━━\n🎯 Sizning o'rningiz: *${myRank}-o'rin*`;
    return bot.editMessageText(txt, {
      chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', reply_markup: backToMain()
    });
  }

  // Davomat
  if (data === 'attendance') {
    const res = await pool.query(
      `SELECT lesson_date, status FROM attendance WHERE user_id=$1 ORDER BY lesson_date DESC LIMIT 30`,
      [user.id]
    );
    if (!res.rows.length) {
      return bot.editMessageText(
        `📅 *Davomat*\n━━━━━━━━━━━━━━━━━━━━━\n\nHozircha ma'lumot yo'q`,
        { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', reply_markup: backToMain() }
      );
    }
    const total = res.rows.length;
    const present = res.rows.filter(r => r.status === 'present').length;
    const pct = Math.round(present / total * 100);
    const bar = '🟢'.repeat(Math.floor(pct/10)) + '⬜'.repeat(10-Math.floor(pct/10));
    let txt = `📅 *Davomat — ${user.full_name}*\n━━━━━━━━━━━━━━━━━━━━━\n\n`;
    txt += `${bar}\n\n`;
    txt += `✅ Kelgan:   *${present}* dars\n`;
    txt += `❌ Kelmagan: *${total - present}* dars\n`;
    txt += `📊 Foiz:     *${pct}%*\n\n`;
    txt += `━━━━━━━━━━━━━━━━━━━━━\n*So'nggi darslar:*\n`;
    res.rows.slice(0, 10).forEach(r => {
      const date = r.lesson_date?.toString().slice(0, 10);
      txt += `${r.status === 'present' ? '✅' : '❌'} ${date}\n`;
    });
    return bot.editMessageText(txt, {
      chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', reply_markup: backToMain()
    });
  }

  // Vazifalar
  if (data === 'tasks') {
    const res = await pool.query(
      `SELECT a.title, a.due_date, a.is_open, s.id as sid, s.score
         FROM assignments a JOIN group_members gm ON a.group_id=gm.group_id
         LEFT JOIN submissions s ON s.assignment_id=a.id AND s.user_id=$1
        WHERE gm.user_id=$1 ORDER BY a.created_at DESC LIMIT 15`,
      [user.id]
    );
    if (!res.rows.length) {
      return bot.editMessageText(
        `📝 *Vazifalar*\n━━━━━━━━━━━━━━━━━━━━━\n\nHozircha vazifa yo'q`,
        { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', reply_markup: backToMain() }
      );
    }
    const done = res.rows.filter(r => r.sid).length;
    const pending = res.rows.filter(r => !r.sid && r.is_open).length;
    let txt = `📝 *Vazifalar — ${user.full_name}*\n━━━━━━━━━━━━━━━━━━━━━\n\n`;
    txt += `✅ Topshirilgan: *${done}* ta\n`;
    txt += `⏳ Kutilmoqda:  *${pending}* ta\n\n`;
    txt += `━━━━━━━━━━━━━━━━━━━━━\n`;
    res.rows.forEach(r => {
      const icon = r.sid ? '✅' : !r.is_open ? '🔒' : '⏳';
      const score = r.sid ? ` — *${r.score}/100*` : '';
      const date = r.due_date ? ` | 📅 ${r.due_date.toString().slice(0,10)}` : '';
      txt += `${icon} ${r.title}${score}${date}\n`;
    });
    return bot.editMessageText(txt, {
      chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', reply_markup: backToMain()
    });
  }

  // Profil
  if (data === 'profile') {
    const grpRes = await pool.query(
      `SELECT g.name FROM group_members gm JOIN groups g ON gm.group_id=g.id WHERE gm.user_id=$1`, [user.id]
    );
    const groups = grpRes.rows.map(r => r.name).join(', ') || '—';
    const txt =
      `👤 *Profil*\n━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `📛 Ism:     *${user.full_name}*\n` +
      `📧 Email:   \`${user.email}\`\n` +
      `📱 Telefon: ${user.phone || '—'}\n` +
      `🎓 Guruh:   *${groups}*\n`;
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
      `👋 *Profildan chiqdingiz*\n\n` +
      `Qaytadan ulanish uchun /start yozing.`,
      { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown' }
    );
  }

  // Bosh menyu
  if (data === 'menu') {
    return bot.editMessageText(
      `🎓 *Ustoz Yordamchi*\n━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `👋 *${user.full_name}*, bo'limni tanlang 👇`,
      { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', reply_markup: mainMenu() }
    );
  }
});

// ── Kechki xabarnoma 20:00 UZT ──────────────────────────────
async function notifyUnsubmitted() {
  try {
    const res = await pool.query(`
      SELECT u.full_name, u.telegram_chat_id, a.title, a.due_date,
             COUNT(*) OVER (PARTITION BY u.id)::int AS total_missed
        FROM assignments a JOIN group_members gm ON a.group_id=gm.group_id
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
      const missed = r.total_missed;
      let txt = `⚠️ *Vazifa topshirilmadi!*\n━━━━━━━━━━━━━━━━━━━━━\n\n`;
      txt += `📝 *${r.title}*\n📅 Muddat: ${r.due_date?.toString().slice(0,10)}\n\n`;
      if (missed >= 5) {
        txt += `🚨 *Diqqat!* Jami *${missed} ta* vazifa topshirilmadi!\nIltimos, mentor bilan bog'laning!`;
      } else {
        txt += `Bu *${missed}-marta*. Vaqtida topshirishga harakat qiling! 💪`;
      }
      try { await bot.sendMessage(r.telegram_chat_id, txt, { parse_mode: 'Markdown' }); } catch {}
    }
  } catch (e) { console.error('Xabarnoma xato:', e.message); }
}

function scheduleNightly() {
  function getDelay() {
    const now = new Date();
    const target = new Date(now.getTime() + 5 * 60 * 60 * 1000); // UZT
    target.setUTCHours(15, 0, 0, 0); // 20:00 UZT = 15:00 UTC
    if (target <= now) target.setUTCDate(target.getUTCDate() + 1);
    return target - now;
  }
  setTimeout(() => {
    notifyUnsubmitted();
    setInterval(notifyUnsubmitted, 24 * 60 * 60 * 1000);
  }, getDelay());
}
scheduleNightly();

// ── Migration ────────────────────────────────────────────────
(async () => {
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_chat_id VARCHAR(30)`);
  console.log('✅ Bot ishga tushdi');
})();
