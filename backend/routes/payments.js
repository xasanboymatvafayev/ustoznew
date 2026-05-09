/**
 * PAYMENTS ROUTER — To'lovchi.uz API integratsiya
 * O'quv markaz oylik to'lovlarini boshqaradi
 *
 * Routes:
 *  POST /api/payments/create          — Yangi to'lov yaratish
 *  GET  /api/payments/check/:orderId  — To'lov statusini tekshirish
 *  POST /api/payments/cancel          — To'lovni bekor qilish
 *  GET  /api/payments/history         — O'quv markaz to'lov tarixi
 *  GET  /api/payments/status          — Joriy oylik holat
 */

const router = require('express').Router();
const fetch = require('node-fetch'); // npm install node-fetch@2

const TOLOV_BASE = process.env.TOLOV_API_URL || 'https://tolovavto.up.railway.app/api';
const SHOP_ID    = process.env.TOLOV_SHOP_ID;
const SHOP_KEY   = process.env.TOLOV_SHOP_KEY;

// ── Helper: Tolovchi.uz ga GET so'rov ──────────────────────────────────────
async function tolovRequest(params) {
  const url = new URL(TOLOV_BASE);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── DB helper: joriy oy ──────────────────────────────────────────────────
function currentMonth() {
  return new Date().toISOString().slice(0, 7); // "2026-05"
}

// ──────────────────────────────────────────────────────────────────────────
// POST /api/payments/create
// Body: { center_id, promo_code? }
// Admin token kerak
// ──────────────────────────────────────────────────────────────────────────
router.post('/create', async (req, res) => {
  const db = req.app.get('db');
  const { center_id, promo_code } = req.body;

  if (!center_id) return res.status(400).json({ error: 'center_id kerak' });

  try {
    // O'quv markaz va paketini olish
    const centerRes = await db.query(
      `SELECT c.*, p.price, p.name as package_name, p.key as package_key
       FROM centers c
       JOIN packages p ON c.package_id = p.id
       WHERE c.id = $1`,
      [center_id]
    );
    if (!centerRes.rows.length) return res.status(404).json({ error: 'Markaz topilmadi' });

    const center = centerRes.rows[0];
    const month  = currentMonth();

    // Agar bu oyga to'lov allaqachon bo'lsa
    const existing = await db.query(
      `SELECT * FROM center_payments WHERE center_id=$1 AND month=$2`,
      [center_id, month]
    );
    if (existing.rows.length) {
      return res.json({
        success: false,
        message: 'Bu oy uchun to\'lov allaqachon mavjud',
        payment: existing.rows[0],
      });
    }

    // ── Promokod tekshirish (ixtiyoriy) ───────────────────────────────────
    let promoInfo   = null;
    let finalAmount = center.price;

    if (promo_code && promo_code.trim()) {
      const promoRes = await db.query(
        `SELECT * FROM promocodes
         WHERE code = $1
           AND is_active = true
           AND (expires_at IS NULL OR expires_at > NOW())
           AND (max_uses <= 0 OR used_count < max_uses)
           AND (package_key IS NULL OR package_key = $2)`,
        [promo_code.toUpperCase().trim(), center.package_key]
      );

      if (!promoRes.rows.length) {
        return res.status(400).json({
          error: 'Promokod yaroqsiz, muddati tugagan yoki bu paket uchun mos emas',
        });
      }

      promoInfo   = promoRes.rows[0];
      // Chegirma hisoblash
      const discount = Math.floor(center.price * promoInfo.discount_pct / 100);
      finalAmount = center.price - discount;
    }
    // ─────────────────────────────────────────────────────────────────────

    // Agar to'lov 0 so'm bo'lsa (100% promokod) — to'lovsiz faollashtirish
    if (finalAmount <= 0) {
      const payRes = await db.query(
        `INSERT INTO center_payments
           (center_id, month, amount, status, created_at, paid_at)
         VALUES ($1, $2, $3, 'paid', NOW(), NOW())
         RETURNING *`,
        [center_id, month, 0]
      );

      // Promokod ishlatildi deb belgilash
      if (promoInfo) {
        await db.query(`UPDATE promocodes SET used_count = used_count + 1 WHERE id=$1`, [promoInfo.id]);
        await db.query(
          `INSERT INTO promocode_uses (promocode_id, center_id, payment_id) VALUES ($1, $2, $3)`,
          [promoInfo.id, center_id, payRes.rows[0].id]
        );
      }

      // Markaz faollashtirish
      await db.query(
        `UPDATE centers SET is_active=true, subscription_until=DATE_TRUNC('month', NOW()) + INTERVAL '1 month' - INTERVAL '1 day'
         WHERE id=$1`,
        [center_id]
      );

      return res.json({
        success:  true,
        status:   'paid',
        amount:   0,
        promo_applied: promoInfo ? { code: promoInfo.code, discount: 100 } : null,
        payment:  payRes.rows[0],
        message:  '✅ Promokod qo\'llanildi! Markaz faollashtirildi.',
      });
    }

    // To'lovchi.uz orqali to'lov
    if (!SHOP_ID || !SHOP_KEY) {
      return res.status(500).json({ error: 'To\'lovchi.uz API kalitlari sozlanmagan (.env ga TOLOV_SHOP_ID va TOLOV_SHOP_KEY qo\'shing)' });
    }

    const data = await tolovRequest({
      method:   'create',
      shop_id:  SHOP_ID,
      shop_key: SHOP_KEY,
      amount:   finalAmount,
    });

    if (data.status !== 'success') {
      return res.status(400).json({ error: data.message || 'To\'lov yaratishda xatolik' });
    }

    // DBga saqlash
    const payRes = await db.query(
      `INSERT INTO center_payments
         (center_id, month, amount, order_id, status, created_at)
       VALUES ($1, $2, $3, $4, 'pending', NOW())
       RETURNING *`,
      [center_id, month, finalAmount, data.order]
    );

    // Promokod band qilish (ishlatildi lekin hali to'lanmagan)
    if (promoInfo) {
      await db.query(`UPDATE promocodes SET used_count = used_count + 1 WHERE id=$1`, [promoInfo.id]);
      await db.query(
        `INSERT INTO promocode_uses (promocode_id, center_id, payment_id) VALUES ($1, $2, $3)`,
        [promoInfo.id, center_id, payRes.rows[0].id]
      );
    }

    res.json({
      success:  true,
      order_id: data.order,
      amount:   finalAmount,
      original_amount: center.price,
      promo_applied: promoInfo ? {
        code:     promoInfo.code,
        discount: promoInfo.discount_pct,
        saved:    center.price - finalAmount,
      } : null,
      payment:  payRes.rows[0],
      message:  `To'lov yaratildi. Order: ${data.order}`,
    });
  } catch (e) {
    console.error('Payment create error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// GET /api/payments/check/:orderId
// ──────────────────────────────────────────────────────────────────────────
router.get('/check/:orderId', async (req, res) => {
  const db = req.app.get('db');
  const { orderId } = req.params;

  try {
    // To'lovchi.uz dan status
    const data = await tolovRequest({ method: 'check', order: orderId });

    if (data.status !== 'success') {
      return res.status(400).json({ error: data.message });
    }

    const tolovStatus = data.data?.status; // 'pending' | 'paid' | 'cancel'

    // DBda yangilash
    const payRes = await db.query(
      `SELECT * FROM center_payments WHERE order_id = $1`,
      [orderId]
    );

    if (payRes.rows.length) {
      const pay = payRes.rows[0];

      if (tolovStatus === 'paid' && pay.status !== 'paid') {
        // To'lov amalga oshdi → markaz faollashtirish
        await db.query(
          `UPDATE center_payments SET status='paid', paid_at=NOW() WHERE order_id=$1`,
          [orderId]
        );
        await db.query(
          `UPDATE centers SET is_active=true, subscription_until=DATE_TRUNC('month', NOW()) + INTERVAL '1 month' - INTERVAL '1 day'
           WHERE id=$1`,
          [pay.center_id]
        );
        return res.json({ success: true, status: 'paid', message: '✅ To\'lov tasdiqlandi! Markaz faollashtirildi.' });
      }

      if (tolovStatus === 'cancel') {
        await db.query(`UPDATE center_payments SET status='cancelled' WHERE order_id=$1`, [orderId]);
        return res.json({ success: true, status: 'cancelled', message: '❌ To\'lov bekor qilingan' });
      }
    }

    res.json({ success: true, status: tolovStatus, message: 'To\'lov holati: ' + tolovStatus });
  } catch (e) {
    console.error('Payment check error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// POST /api/payments/cancel
// Body: { order_id }
// ──────────────────────────────────────────────────────────────────────────
router.post('/cancel', async (req, res) => {
  const db = req.app.get('db');
  const { order_id } = req.body;
  if (!order_id) return res.status(400).json({ error: 'order_id kerak' });

  try {
    const data = await tolovRequest({ method: 'cancel', order: order_id });
    if (data.status === 'success') {
      await db.query(`UPDATE center_payments SET status='cancelled' WHERE order_id=$1`, [order_id]);
      res.json({ success: true, message: 'To\'lov bekor qilindi' });
    } else {
      res.status(400).json({ error: data.message });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// GET /api/payments/history?center_id=XX
// ──────────────────────────────────────────────────────────────────────────
router.get('/history', async (req, res) => {
  const db = req.app.get('db');
  const { center_id } = req.query;

  try {
    const result = await db.query(
      `SELECT cp.*, c.name as center_name, pk.name as package_name
       FROM center_payments cp
       JOIN centers c  ON cp.center_id = c.id
       JOIN packages pk ON c.package_id = pk.id
       WHERE ($1::int IS NULL OR cp.center_id = $1)
       ORDER BY cp.created_at DESC
       LIMIT 100`,
      [center_id || null]
    );
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// GET /api/payments/status?center_id=XX
// Joriy oylik to'lov holati
// ──────────────────────────────────────────────────────────────────────────
router.get('/status', async (req, res) => {
  const db = req.app.get('db');
  const { center_id } = req.query;
  if (!center_id) return res.status(400).json({ error: 'center_id kerak' });

  try {
    const month = currentMonth();
    const result = await db.query(
      `SELECT cp.*, pk.price, pk.name as package_name
       FROM center_payments cp
       JOIN centers c ON cp.center_id = c.id
       JOIN packages pk ON c.package_id = pk.id
       WHERE cp.center_id=$1 AND cp.month=$2`,
      [center_id, month]
    );

    if (!result.rows.length) {
      // To'lov hali yaratilmagan
      return res.json({ paid: false, month, message: 'Bu oy uchun to\'lov yo\'q' });
    }

    const pay = result.rows[0];
    res.json({
      paid:       pay.status === 'paid',
      status:     pay.status,
      amount:     pay.amount,
      order_id:   pay.order_id,
      paid_at:    pay.paid_at,
      month:      pay.month,
      package:    pay.package_name,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// GET /api/payments/promo-check?code=XXX&center_id=YY
// Admin to'lov formida promokod tekshirish
// ──────────────────────────────────────────────────────────────────────────
router.get('/promo-check', async (req, res) => {
  const db = req.app.get('db');
  const { code, center_id } = req.query;
  if (!code || !center_id) return res.status(400).json({ error: 'code va center_id kerak' });

  try {
    // Markaz paketini olish
    const centerRes = await db.query(
      `SELECT c.*, p.price, p.key as package_key, p.name as package_name
       FROM centers c JOIN packages p ON c.package_id=p.id WHERE c.id=$1`,
      [center_id]
    );
    if (!centerRes.rows.length) return res.status(404).json({ error: 'Markaz topilmadi' });
    const center = centerRes.rows[0];

    const promoRes = await db.query(
      `SELECT * FROM promocodes
       WHERE code = $1
         AND is_active = true
         AND (expires_at IS NULL OR expires_at > NOW())
         AND (max_uses <= 0 OR used_count < max_uses)
         AND (package_key IS NULL OR package_key = $2)`,
      [code.toUpperCase().trim(), center.package_key]
    );

    if (!promoRes.rows.length) {
      return res.json({ valid: false, message: 'Promokod yaroqsiz yoki bu paket uchun mos emas' });
    }

    const promo = promoRes.rows[0];
    const discount = Math.floor(center.price * promo.discount_pct / 100);
    const finalAmount = center.price - discount;

    res.json({
      valid:          true,
      code:           promo.code,
      discount_pct:   promo.discount_pct,
      original_price: center.price,
      discount_amount: discount,
      final_amount:   finalAmount,
      package_name:   center.package_name,
      message:        `✅ Promokod qo'llandi! ${promo.discount_pct}% chegirma — ${discount.toLocaleString()} so'm tejaladi`,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
