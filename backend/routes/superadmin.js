/**
 * SUPERADMIN ROUTER — Boss Admin Panel API
 *
 * Routes:
 *  POST /api/superadmin/login
 *  GET  /api/superadmin/dashboard
 *  GET  /api/superadmin/centers
 *  POST /api/superadmin/centers
 *  PUT  /api/superadmin/centers/:id
 *  PUT  /api/superadmin/centers/:id/toggle
 *  GET  /api/superadmin/packages
 *  PUT  /api/superadmin/packages/:key
 *  GET  /api/superadmin/payments
 *  PUT  /api/superadmin/payments/:id/mark-paid
 */

const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');

const SUPER_SECRET  = process.env.SUPER_JWT_SECRET || 'super_boss_secret_2026';
const SUPER_USER    = process.env.SUPER_ADMIN_USER  || 'boss_admin';
const SUPER_PASS_HASH = process.env.SUPER_ADMIN_PASS_HASH; // bcrypt hash of password

// ── Auth middleware for superadmin ─────────────────────────────────────────
function superAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'Token kerak' });
  try {
    const token = header.replace('Bearer ', '');
    const decoded = jwt.verify(token, SUPER_SECRET);
    if (decoded.role !== 'superadmin') throw new Error('Not superadmin');
    req.superAdmin = decoded;
    next();
  } catch (e) {
    res.status(401).json({ error: 'Token yaroqsiz' });
  }
}

// ──────────────────────────────────────────────────────────────────────────
// POST /api/superadmin/login
// ──────────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (username !== SUPER_USER) {
    return res.status(401).json({ error: 'Login yoki parol noto\'g\'ri' });
  }

  // Password tekshirish (env da hash yoki default)
  let valid = false;
  if (SUPER_PASS_HASH) {
    valid = await bcrypt.compare(password, SUPER_PASS_HASH);
  } else {
    // Development: default parol
    valid = (password === (process.env.SUPER_ADMIN_PASS || 'ustoz2026'));
  }

  if (!valid) return res.status(401).json({ error: 'Login yoki parol noto\'g\'ri' });

  const token = jwt.sign(
    { username, role: 'superadmin' },
    SUPER_SECRET,
    { expiresIn: '24h' }
  );
  res.json({ success: true, token });
});

// ──────────────────────────────────────────────────────────────────────────
// GET /api/superadmin/dashboard
// ──────────────────────────────────────────────────────────────────────────
router.get('/dashboard', superAuth, async (req, res) => {
  const db = req.app.get('db');
  try {
    const [total, active, pending, paid, students] = await Promise.all([
      db.query(`SELECT COUNT(*) FROM centers`),
      db.query(`SELECT COUNT(*) FROM centers WHERE is_active=true`),
      db.query(`SELECT COUNT(*) FROM center_payments WHERE status='pending'`),
      db.query(`SELECT COALESCE(SUM(amount),0) as total FROM center_payments WHERE status='paid' AND month=to_char(NOW(),'YYYY-MM')`),
      db.query(`SELECT COUNT(*) FROM users WHERE is_verified=true`),
    ]);
    const recentCenters = await db.query(`
      SELECT c.*, pk.name as package_name, pk.price,
        (SELECT COUNT(*) FROM users WHERE center_id=c.id AND is_verified=true) as student_count
      FROM centers c
      JOIN packages pk ON c.package_id=pk.id
      ORDER BY c.created_at DESC LIMIT 5
    `);
    res.json({
      total_centers:   parseInt(total.rows[0].count),
      active_centers:  parseInt(active.rows[0].count),
      pending_payments: parseInt(pending.rows[0].count),
      month_income:    parseInt(paid.rows[0].total),
      total_students:  parseInt(students.rows[0].count),
      recent_centers:  recentCenters.rows,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ──────────────────────────────────────────────────────────────────────────
// GET /api/superadmin/centers
// ──────────────────────────────────────────────────────────────────────────
router.get('/centers', superAuth, async (req, res) => {
  const db = req.app.get('db');
  try {
    const result = await db.query(`
      SELECT c.*, pk.name as package_name, pk.price,
        (SELECT COUNT(*) FROM users WHERE center_id=c.id AND is_verified=true) as student_count,
        (SELECT status FROM center_payments WHERE center_id=c.id AND month=to_char(NOW(),'YYYY-MM') LIMIT 1) as payment_status
      FROM centers c
      JOIN packages pk ON c.package_id=pk.id
      ORDER BY c.created_at DESC
    `);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ──────────────────────────────────────────────────────────────────────────
// POST /api/superadmin/centers — Yangi markaz yaratish
// ──────────────────────────────────────────────────────────────────────────
router.post('/centers', superAuth, async (req, res) => {
  const db = req.app.get('db');
  const { name, city, admin_name, phone, admin_login, admin_password, package_key, trial_days } = req.body;

  if (!name || !admin_name || !phone || !admin_login || !admin_password || !package_key) {
    return res.status(400).json({ error: 'Barcha majburiy maydonlarni to\'ldiring' });
  }

  try {
    // Paket ID ni olish
    const pkgRes = await db.query(`SELECT id, price FROM packages WHERE key=$1`, [package_key]);
    if (!pkgRes.rows.length) return res.status(400).json({ error: 'Noto\'g\'ri paket' });
    const pkg = pkgRes.rows[0];

    // Center yaratish (ID avtomatik: SEQUENCE 1001 dan boshlanadi)
    const passHash = await bcrypt.hash(admin_password, 10);
    const trialEnds = trial_days > 0
      ? new Date(Date.now() + trial_days * 86400000)
      : null;

    const centerRes = await db.query(`
      INSERT INTO centers (name, city, admin_name, phone, package_id, is_active, trial_ends_at, created_at)
      VALUES ($1, $2, $3, $4, $5, true, $6, NOW())
      RETURNING *
    `, [name, city||null, admin_name, phone, pkg.id, trialEnds]);

    const center = centerRes.rows[0];

    // Admin akkauntini yaratish
    await db.query(`
      INSERT INTO admins (login, password_hash, center_id, full_name, is_active)
      VALUES ($1, $2, $3, $4, true)
    `, [admin_login, passHash, center.id, admin_name]);

    // Agar pro/unlimited → to'lov yaratish
    if (package_key !== 'free' && pkg.price > 0) {
      await db.query(`
        INSERT INTO center_payments (center_id, month, amount, status, created_at)
        VALUES ($1, to_char(NOW(),'YYYY-MM'), $2, 'pending', NOW())
      `, [center.id, pkg.price]);
    }

    const baseUrl = process.env.BASE_URL || 'https://your-app.up.railway.app';
    res.json({
      success: true,
      center,
      url:     `${baseUrl}/center/${center.id}`,
      message: `Markaz #${center.id} yaratildi`,
    });
  } catch (e) {
    console.error('Create center error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// PUT /api/superadmin/centers/:id/toggle — Faollashtirish/bloklash
// ──────────────────────────────────────────────────────────────────────────
router.put('/centers/:id/toggle', superAuth, async (req, res) => {
  const db = req.app.get('db');
  try {
    const result = await db.query(
      `UPDATE centers SET is_active = NOT is_active WHERE id=$1 RETURNING id, name, is_active`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Topilmadi' });
    res.json({ success: true, center: result.rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ──────────────────────────────────────────────────────────────────────────
// PUT /api/superadmin/centers/:id — Paket yoki info o'zgartirish
// ──────────────────────────────────────────────────────────────────────────
router.put('/centers/:id', superAuth, async (req, res) => {
  const db = req.app.get('db');
  const { package_key } = req.body;
  try {
    if (package_key) {
      const pkgRes = await db.query(`SELECT id FROM packages WHERE key=$1`, [package_key]);
      if (!pkgRes.rows.length) return res.status(400).json({ error: 'Noto\'g\'ri paket' });
      await db.query(`UPDATE centers SET package_id=$1 WHERE id=$2`, [pkgRes.rows[0].id, req.params.id]);
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ──────────────────────────────────────────────────────────────────────────
// GET /api/superadmin/packages
// ──────────────────────────────────────────────────────────────────────────
router.get('/packages', superAuth, async (req, res) => {
  const db = req.app.get('db');
  try {
    const result = await db.query(`SELECT * FROM packages ORDER BY price ASC`);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ──────────────────────────────────────────────────────────────────────────
// PUT /api/superadmin/packages/:key — Paket tahrirlash
// ──────────────────────────────────────────────────────────────────────────
router.put('/packages/:key', superAuth, async (req, res) => {
  const db = req.app.get('db');
  const { name, price, max_groups, max_mentors, max_students } = req.body;
  try {
    await db.query(`
      UPDATE packages SET name=$1, price=$2, max_groups=$3, max_mentors=$4, max_students=$5
      WHERE key=$6
    `, [name, price, max_groups, max_mentors, max_students, req.params.key]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ──────────────────────────────────────────────────────────────────────────
// GET /api/superadmin/payments
// ──────────────────────────────────────────────────────────────────────────
router.get('/payments', superAuth, async (req, res) => {
  const db = req.app.get('db');
  const { month } = req.query;
  try {
    const result = await db.query(`
      SELECT cp.*, c.name as center_name, pk.name as package_name
      FROM center_payments cp
      JOIN centers c  ON cp.center_id=c.id
      JOIN packages pk ON c.package_id=pk.id
      ${month ? 'WHERE cp.month=$1' : ''}
      ORDER BY cp.created_at DESC
    `, month ? [month] : []);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ──────────────────────────────────────────────────────────────────────────
// PUT /api/superadmin/payments/:id/mark-paid — Qo'lda to'landi belgilash
// ──────────────────────────────────────────────────────────────────────────
router.put('/payments/:id/mark-paid', superAuth, async (req, res) => {
  const db = req.app.get('db');
  try {
    const payRes = await db.query(
      `UPDATE center_payments SET status='paid', paid_at=NOW() WHERE id=$1 RETURNING center_id`,
      [req.params.id]
    );
    if (!payRes.rows.length) return res.status(404).json({ error: 'Topilmadi' });
    // Markaz faollashtirish
    await db.query(`UPDATE centers SET is_active=true WHERE id=$1`, [payRes.rows[0].center_id]);
    res.json({ success: true, message: 'To\'lov tasdiqlandi, markaz faollashtirildi' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
