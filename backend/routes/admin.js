const router = require('express').Router();
const bcrypt = require('bcryptjs');
const auth = require('../middleware/auth');

// All admin routes protected
router.use(auth(['admin']));

// ─────────────────────────────────────────────
// Dashboard stats
// ─────────────────────────────────────────────
router.get('/dashboard', async (req, res) => {
  const db = req.app.get('db');
  const cid = req.user.center_id;
  try {
    const [students, mentors, groups, activeGroups] = await Promise.all([
      // FIX: faqat shu markazning o'quvchilarini hisoblash
      db.query('SELECT COUNT(*) FROM users WHERE is_verified=true AND center_id=$1', [cid]),
      db.query('SELECT COUNT(*) FROM mentors WHERE is_active=true AND center_id=$1', [cid]),
      db.query('SELECT COUNT(*) FROM groups WHERE center_id=$1', [cid]),
      db.query('SELECT COUNT(*) FROM groups WHERE is_active=true AND center_id=$1', [cid])
    ]);
    // FIX: guruhlarni ham faqat shu markazdan olish
    const groupList = await db.query(`
      SELECT g.*, m.full_name as mentor_name,
        (SELECT COUNT(*) FROM group_members WHERE group_id=g.id) as member_count
      FROM groups g
      LEFT JOIN mentors m ON g.mentor_id = m.id
      WHERE g.center_id = $1
      ORDER BY g.created_at DESC
    `, [cid]);
    res.json({
      total_students: parseInt(students.rows[0].count),
      total_mentors:  parseInt(mentors.rows[0].count),
      total_groups:   parseInt(groups.rows[0].count),
      active_groups:  parseInt(activeGroups.rows[0].count),
      groups: groupList.rows
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────
// Get all mentors (faqat shu markaz)
// ─────────────────────────────────────────────
router.get('/mentors', async (req, res) => {
  const db = req.app.get('db');
  const cid = req.user.center_id;
  try {
    // FIX: center_id filter qo'shildi
    const result = await db.query(`
      SELECT m.*,
        (SELECT COUNT(*) FROM groups WHERE mentor_id=m.id AND center_id=$1) as group_count
      FROM mentors m
      WHERE m.center_id = $1
      ORDER BY m.created_at DESC
    `, [cid]);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────
// Add mentor
// ─────────────────────────────────────────────
router.post('/mentors', async (req, res) => {
  const { full_name, phone, password, group_names } = req.body;
  const db = req.app.get('db');
  const cid = req.user.center_id;
  try {
    if (!full_name || !phone || !password) {
      return res.status(400).json({ error: 'full_name, phone va password majburiy' });
    }
    const hash = await bcrypt.hash(password, 10);
    const mentor = await db.query(
      'INSERT INTO mentors (full_name, phone, password_hash, center_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [full_name, phone, hash, cid]
    );

    // Guruhlarni faqat shu markazdan topib biriktiramiz
    if (group_names && group_names.length) {
      for (const gname of group_names) {
        await db.query(
          'UPDATE groups SET mentor_id=$1 WHERE name=$2 AND center_id=$3',
          [mentor.rows[0].id, gname, cid]
        );
      }
    }
    res.json(mentor.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────
// Deactivate mentor
// ─────────────────────────────────────────────
router.delete('/mentors/:id', async (req, res) => {
  const db = req.app.get('db');
  const cid = req.user.center_id;
  try {
    // FIX: faqat shu markazning mentorini o'chirish
    const result = await db.query(
      'UPDATE mentors SET is_active=false WHERE id=$1 AND center_id=$2 RETURNING id',
      [req.params.id, cid]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Mentor topilmadi' });
    res.json({ message: 'Mentor nofaol qilindi' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────
// Get all groups (faqat shu markaz)
// ─────────────────────────────────────────────
router.get('/groups', async (req, res) => {
  const db = req.app.get('db');
  const cid = req.user.center_id;
  try {
    // FIX: center_id filter qo'shildi
    const result = await db.query(`
      SELECT g.*, m.full_name as mentor_name,
        (SELECT COUNT(*) FROM group_members WHERE group_id=g.id) as member_count
      FROM groups g
      LEFT JOIN mentors m ON g.mentor_id = m.id
      WHERE g.center_id = $1
      ORDER BY g.created_at DESC
    `, [cid]);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────
// Add group
// ─────────────────────────────────────────────
router.post('/groups', async (req, res) => {
  const { name, mentor_id, lesson_days, lesson_time, start_date, end_date, subject } = req.body;
  const db = req.app.get('db');
  const cid = req.user.center_id;
  try {
    if (!name) return res.status(400).json({ error: 'Guruh nomi majburiy' });

    // FIX: 8 column — 8 ta $placeholder, center_id qo'shildi ($8)
    const result = await db.query(
      `INSERT INTO groups (name, mentor_id, lesson_days, lesson_time, start_date, end_date, subject, center_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [name, mentor_id || null, lesson_days || 'juft', lesson_time || null, start_date || null, end_date || null, subject || null, cid]
    );
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────
// Update group
// ─────────────────────────────────────────────
router.put('/groups/:id', async (req, res) => {
  const { name, mentor_id, lesson_days, lesson_time, start_date, end_date, subject } = req.body;
  const db = req.app.get('db');
  const cid = req.user.center_id;
  try {
    // FIX: center_id bilan birga update qilamiz (boshqa markaz guruhini o'zgartira olmasin)
    const result = await db.query(
      `UPDATE groups SET
        name        = COALESCE($1, name),
        mentor_id   = COALESCE($2, mentor_id),
        lesson_days = COALESCE($3, lesson_days),
        lesson_time = COALESCE($4, lesson_time),
        start_date  = COALESCE($5, start_date),
        end_date    = COALESCE($6, end_date),
        subject     = COALESCE($7, subject)
       WHERE id=$8 AND center_id=$9 RETURNING *`,
      [name || null, mentor_id || null, lesson_days || null, lesson_time || null, start_date || null, end_date || null, subject || null, req.params.id, cid]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Guruh topilmadi' });
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────
// Delete (deactivate) group
// ─────────────────────────────────────────────
router.delete('/groups/:id', async (req, res) => {
  const db = req.app.get('db');
  const cid = req.user.center_id;
  try {
    const result = await db.query(
      'UPDATE groups SET is_active=false WHERE id=$1 AND center_id=$2 RETURNING id',
      [req.params.id, cid]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Guruh topilmadi' });
    res.json({ message: 'Guruh nofaol qilindi' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────
// Add calendar event
// ─────────────────────────────────────────────
router.post('/calendar', async (req, res) => {
  const { group_id, title, event_date } = req.body;
  const db = req.app.get('db');
  const cid = req.user.center_id;
  try {
    // FIX: guruh shu markazga tegishli ekanligini tekshirish
    const grpCheck = await db.query('SELECT id FROM groups WHERE id=$1 AND center_id=$2', [group_id, cid]);
    if (!grpCheck.rows.length) return res.status(403).json({ error: "Bu guruh sizning markazingizga tegishli emas" });

    const result = await db.query(
      'INSERT INTO calendar_events (group_id, title, event_date) VALUES ($1, $2, $3) RETURNING *',
      [group_id, title, event_date]
    );
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────
// Get all students (faqat shu markaz)
// ─────────────────────────────────────────────
router.get('/students', async (req, res) => {
  const db = req.app.get('db');
  const cid = req.user.center_id;
  try {
    // FIX: center_id filter qo'shildi
    const result = await db.query(`
      SELECT u.*, g.name as current_group FROM users u
      LEFT JOIN group_members gm ON u.id = gm.user_id
      LEFT JOIN groups g ON gm.group_id = g.id AND g.center_id = $1
      WHERE u.is_verified = true AND u.center_id = $1
      ORDER BY u.created_at DESC
    `, [cid]);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────
// Update student
// ─────────────────────────────────────────────
router.put('/students/:id', async (req, res) => {
  const db = req.app.get('db');
  const cid = req.user.center_id;
  const { full_name, login, group_name } = req.body;
  const studentId = req.params.id;
  try {
    // FIX: o'quvchi shu markazga tegishli ekanligini tekshirish
    const stuCheck = await db.query('SELECT id FROM users WHERE id=$1 AND center_id=$2', [studentId, cid]);
    if (!stuCheck.rows.length) return res.status(403).json({ error: "Bu o'quvchi sizning markazingizga tegishli emas" });

    // login unique tekshirish (o'zi bundan mustasno)
    if (login) {
      const existing = await db.query('SELECT id FROM users WHERE login=$1 AND id!=$2', [login, studentId]);
      if (existing.rows.length) return res.status(409).json({ error: 'Bu username allaqachon band' });
    }

    await db.query(
      `UPDATE users SET
        full_name  = COALESCE($1, full_name),
        login      = COALESCE($2, login),
        group_name = COALESCE($3, group_name)
       WHERE id = $4`,
      [full_name || null, login || null, group_name || null, studentId]
    );

    // Guruh o'zgargan bo'lsa group_members ni yangilash
    if (group_name) {
      const grp = await db.query(
        'SELECT id FROM groups WHERE name=$1 AND center_id=$2 AND is_active=true',
        [group_name, cid]
      );
      if (!grp.rows.length) return res.status(400).json({ error: 'Guruh topilmadi' });

      await db.query('DELETE FROM group_members WHERE user_id=$1', [studentId]);
      await db.query(
        'INSERT INTO group_members (group_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [grp.rows[0].id, studentId]
      );
    }

    res.json({ message: "O'quvchi yangilandi" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────
// Delete student
// ─────────────────────────────────────────────
router.delete('/students/:id', async (req, res) => {
  const db = req.app.get('db');
  const cid = req.user.center_id;
  try {
    // FIX: faqat shu markazning o'quvchisini o'chirish
    const result = await db.query(
      "UPDATE users SET is_verified=false WHERE id=$1 AND center_id=$2 RETURNING id",
      [req.params.id, cid]
    );
    if (!result.rows.length) return res.status(404).json({ error: "O'quvchi topilmadi" });
    res.json({ message: "O'quvchi o'chirildi" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────
// Get group join requests (mentor tasdiqlashi uchun)
// ─────────────────────────────────────────────
router.get('/join-requests', async (req, res) => {
  const db = req.app.get('db');
  const cid = req.user.center_id;
  try {
    const result = await db.query(`
      SELECT jr.*, u.full_name, u.email, u.phone, g.name as group_name
      FROM group_join_requests jr
      JOIN users u ON jr.user_id = u.id
      JOIN groups g ON jr.group_id = g.id
      WHERE jr.center_id = $1 AND jr.status = 'pending'
      ORDER BY jr.created_at DESC
    `, [cid]);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────
// Approve / reject join request
// ─────────────────────────────────────────────
router.put('/join-requests/:id', async (req, res) => {
  const { action } = req.body; // 'approve' | 'reject'
  const db = req.app.get('db');
  const cid = req.user.center_id;
  try {
    const jr = await db.query(
      "SELECT * FROM group_join_requests WHERE id=$1 AND center_id=$2",
      [req.params.id, cid]
    );
    if (!jr.rows.length) return res.status(404).json({ error: 'So\'rov topilmadi' });

    const { group_id, user_id } = jr.rows[0];

    if (action === 'approve') {
      await db.query(
        'INSERT INTO group_members (group_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [group_id, user_id]
      );
      await db.query(
        "UPDATE group_join_requests SET status='approved' WHERE id=$1",
        [req.params.id]
      );
      res.json({ message: 'Tasdiqlandi' });
    } else {
      await db.query(
        "UPDATE group_join_requests SET status='rejected' WHERE id=$1",
        [req.params.id]
      );
      res.json({ message: 'Rad etildi' });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────
// GET /api/admin/my-center — Markaz va paket ma'lumotlari
// ─────────────────────────────────────────────
router.get('/my-center', async (req, res) => {
  const db = req.app.get('db');
  const cid = req.user.center_id;
  try {
    const result = await db.query(`
      SELECT c.*, p.key as package_key, p.name as package_name,
             p.price, p.max_groups, p.max_mentors, p.max_students
      FROM centers c
      JOIN packages p ON c.package_id = p.id
      WHERE c.id = $1
    `, [cid]);
    if (!result.rows.length) return res.status(404).json({ error: 'Markaz topilmadi' });

    // Joriy foydalanish
    const usage = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM groups WHERE center_id=$1 AND is_active=true) as groups_count,
        (SELECT COUNT(*) FROM mentors WHERE center_id=$1 AND is_active=true) as mentors_count,
        (SELECT COUNT(*) FROM users WHERE center_id=$1 AND is_verified=true) as students_count
    `, [cid]);

    // Barcha paketlar
    const packages = await db.query('SELECT * FROM packages ORDER BY price ASC');

    res.json({
      center: result.rows[0],
      usage: usage.rows[0],
      packages: packages.rows
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────
// POST /api/admin/change-package — Paketni o'zgartirish va to'lov URL olish
// ─────────────────────────────────────────────
router.post('/change-package', async (req, res) => {
  const db = req.app.get('db');
  const cid = req.user.center_id;
  const { package_key } = req.body;
  const fetch = require('node-fetch');

  const TOLOV_BASE = process.env.TOLOV_API_URL || 'https://tolovavto.up.railway.app/api';
  const SHOP_ID    = process.env.TOLOV_SHOP_ID;
  const SHOP_KEY   = process.env.TOLOV_SHOP_KEY;

  try {
    if (!package_key) return res.status(400).json({ error: 'package_key kerak' });

    const pkg = await db.query('SELECT * FROM packages WHERE key=$1', [package_key]);
    if (!pkg.rows.length) return res.status(404).json({ error: 'Paket topilmadi' });

    const newPkg = pkg.rows[0];

    // Paketni o'zgartir
    await db.query('UPDATE centers SET package_id=$1 WHERE id=$2', [newPkg.id, cid]);

    // Agar bepul paket bo'lsa — to'lovsiz faollashtir
    if (newPkg.price <= 0) {
      await db.query('UPDATE centers SET is_active=true WHERE id=$1', [cid]);
      return res.json({ success: true, message: `Paket ${newPkg.name} ga o'zgartirildi`, pay_url: null });
    }

    // To'lovli paket — to'lov URL olish
    if (!SHOP_ID || !SHOP_KEY) {
      return res.status(500).json({ error: 'To\'lovchi.uz API kalitlari sozlanmagan' });
    }

    const month = new Date().toISOString().slice(0, 7);

    // Avvalgi pending to'lovni o'chirish
    await db.query(
      `DELETE FROM center_payments WHERE center_id=$1 AND month=$2 AND status='pending'`,
      [cid, month]
    );

    // Markaz faol bo'lmagan holatda qoldirish (to'lov amalga oshmagunicha)
    await db.query('UPDATE centers SET is_active=false WHERE id=$1', [cid]);

    // To'lovchi.uz dan URL olish
    const url = new URL(TOLOV_BASE);
    url.searchParams.set('method', 'create');
    url.searchParams.set('shop_id', SHOP_ID);
    url.searchParams.set('shop_key', SHOP_KEY);
    url.searchParams.set('amount', newPkg.price);
    url.searchParams.set('payurl', 'true');

    const tolovRes = await fetch(url.toString());
    if (!tolovRes.ok) throw new Error(`To\'lovchi.uz HTTP ${tolovRes.status}`);
    const data = await tolovRes.json();

    if (data.status !== 'success') {
      return res.status(400).json({ error: data.message || 'To\'lov yaratishda xatolik' });
    }

    const pay_url = data.pay_url || data.url || null;

    // DBga to'lov yozuvi saqlash
    await db.query(
      `INSERT INTO center_payments (center_id, month, amount, order_id, status, pay_url, created_at)
       VALUES ($1, $2, $3, $4, 'pending', $5, NOW())`,
      [cid, month, newPkg.price, data.order, pay_url]
    );

    res.json({
      success:  true,
      message:  `${newPkg.name} paketiga o'tish uchun to'lov zarur`,
      pay_url,
      order_id: data.order,
      amount:   newPkg.price,
      package:  newPkg.name,
    });
  } catch (e) {
    console.error('change-package error:', e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
