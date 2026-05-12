require('dotenv').config();

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// =====================
// SAFETY FIX (MUHIM)
// =====================
if (!process.env.DATABASE_URL) {
  throw new Error('❌ DATABASE_URL topilmadi (.env ni tekshir)');
}

// =====================
// DB CONNECTION FIX
// =====================
const pool = new Pool({
  connectionString: String(process.env.DATABASE_URL),
  ssl:
    process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
});

const centers = [
  {
    name: 'Toshkent IT Academy',
    city: 'Toshkent',
    admin_name: 'Aziz Karimov',
    phone: '+998901234567',
    admin_password: 'admin123',
    package_key: 'free',

    groups: [
      {
        name: 'Python 8.4',
        subject: 'Python dasturlash',
        lesson_days: 'juft',
        lesson_time: '09:00',
      },
      {
        name: 'Web Frontend',
        subject: 'HTML/CSS/JS',
        lesson_days: 'toq',
        lesson_time: '11:00',
      },
    ],

    mentors: [
      {
        full_name: 'Bobur Toshmatov',
        phone: '+998901111111',
        password: 'mentor123',
      },
    ],
  },

  {
    name: 'Samarqand Edu Center',
    city: 'Samarqand',
    admin_name: 'Dilnoza Yusupova',
    phone: '+998901234568',
    admin_password: 'admin123',
    package_key: 'pro',

    groups: [
      {
        name: 'Python 8.4',
        subject: 'Python dasturlash',
        lesson_days: 'juft',
        lesson_time: '10:00',
      },
      {
        name: 'Java Boshlangich',
        subject: 'Java',
        lesson_days: 'toq',
        lesson_time: '14:00',
      },
      {
        name: 'Ingliz tili A1',
        subject: 'Ingliz tili',
        lesson_days: 'juft',
        lesson_time: '16:00',
      },
    ],

    mentors: [
      {
        full_name: 'Jasur Mirzayev',
        phone: '+998902222222',
        password: 'mentor123',
      },
      {
        full_name: 'Maftuna Xoliqova',
        phone: '+998902222223',
        password: 'mentor123',
      },
    ],
  },

  {
    name: 'Namangan Smart School',
    city: 'Namangan',
    admin_name: 'Farhodjon Razzaqov',
    phone: '+998901234569',
    admin_password: 'admin123',
    package_key: 'pro',

    groups: [
      {
        name: 'Python 8.4',
        subject: 'Python dasturlash',
        lesson_days: 'juft',
        lesson_time: '09:00',
      },
      {
        name: 'Matematika IELTS',
        subject: 'Matematika',
        lesson_days: 'toq',
        lesson_time: '15:00',
      },
    ],

    mentors: [
      {
        full_name: 'Sanjar Umarov',
        phone: '+998903333333',
        password: 'mentor123',
      },
    ],
  },

  {
    name: 'Buxoro Digital Hub',
    city: 'Buxoro',
    admin_name: 'Zulfiya Hamidova',
    phone: '+998901234570',
    admin_password: 'admin123',
    package_key: 'unlimited',

    groups: [
      {
        name: 'Python 8.4',
        subject: 'Python dasturlash',
        lesson_days: 'juft',
        lesson_time: '10:00',
      },
      {
        name: 'Flutter Mobile',
        subject: 'Flutter/Dart',
        lesson_days: 'toq',
        lesson_time: '13:00',
      },
      {
        name: 'Data Science',
        subject: 'ML/AI',
        lesson_days: 'juft',
        lesson_time: '16:00',
      },
      {
        name: 'Rus tili B2',
        subject: 'Rus tili',
        lesson_days: 'toq',
        lesson_time: '18:00',
      },
    ],

    mentors: [
      {
        full_name: 'Kamol Nazarov',
        phone: '+998904444444',
        password: 'mentor123',
      },
      {
        full_name: 'Lobar Sotvoldiyeva',
        phone: '+998904444445',
        password: 'mentor123',
      },
    ],
  },
];

async function seed() {
  const client = await pool.connect();

  try {
    console.log('\n🚀 Demo markazlar yaratilmoqda...\n');

    await client.query('BEGIN');

    const packagesResult = await client.query(`
      SELECT *
      FROM packages
      ORDER BY price ASC
    `);

    if (!packagesResult.rows.length) {
      throw new Error('❌ Paketlar topilmadi!');
    }

    console.log(
      '📦 Paketlar:',
      packagesResult.rows.map(p => `${p.name} (${p.key})`).join(', ')
    );

    console.log('');

    for (const c of centers) {
      const pkg = packagesResult.rows.find(
        p => p.key === c.package_key
      );

      if (!pkg) {
        console.log(`⚠️ Paket topilmadi: ${c.package_key}`);
        continue;
      }

      let centerId;

      const existingCenter = await client.query(
        `SELECT id FROM centers WHERE name = $1`,
        [c.name]
      );

      if (existingCenter.rows.length) {
        centerId = existingCenter.rows[0].id;

        console.log(`⏭️ ${c.name} mavjud → yangilanmoqda`);

        await client.query(
          `UPDATE centers
           SET city=$1, admin_name=$2, phone=$3, package_id=$4, is_active=true
           WHERE id=$5`,
          [c.city, c.admin_name, c.phone, pkg.id, centerId]
        );
      } else {
        const trialEnds =
          c.package_key === 'free'
            ? null
            : new Date(Date.now() + 30 * 86400000);

        const subscriptionUntil =
          c.package_key === 'free'
            ? null
            : new Date(Date.now() + 31 * 86400000);

        const centerResult = await client.query(
          `INSERT INTO centers (
            name, city, admin_name, phone,
            package_id, is_active,
            trial_ends_at, subscription_until, created_at
          )
          VALUES ($1,$2,$3,$4,$5,true,$6,$7,NOW())
          RETURNING id`,
          [
            c.name,
            c.city,
            c.admin_name,
            c.phone,
            pkg.id,
            trialEnds,
            subscriptionUntil,
          ]
        );

        centerId = centerResult.rows[0].id;

        console.log(`✅ ${c.name} yaratildi → ID: ${centerId}`);
      }

      // ADMIN
      const adminHash = await bcrypt.hash(c.admin_password, 10);

      await client.query(
        `INSERT INTO center_admins (
          center_id, full_name, password_hash, is_active
        )
        VALUES ($1,$2,$3,true)
        ON CONFLICT (center_id)
        DO UPDATE SET
          full_name = EXCLUDED.full_name,
          password_hash = EXCLUDED.password_hash,
          is_active = true`,
        [centerId, c.admin_name, adminHash]
      );

      console.log(`🔑 ADMIN PAROL: ${c.admin_password}`);

      // MENTORS
      for (const mentor of c.mentors) {
        const mentorHash = await bcrypt.hash(mentor.password, 10);

        await client.query(
          `INSERT INTO mentors (
            full_name, phone, password_hash, is_active, center_id
          )
          VALUES ($1,$2,$3,true,$4)
          ON CONFLICT (phone) DO NOTHING`,
          [mentor.full_name, mentor.phone, mentorHash, centerId]
        );

        console.log(
          `   👨‍🏫 Mentor: ${mentor.full_name} | PAROL: ${mentor.password}`
        );
      }

      // GROUPS
      for (const g of c.groups) {
        const existingGroup = await client.query(
          `SELECT id FROM study_groups
           WHERE name=$1 AND center_id=$2`,
          [g.name, centerId]
        );

        if (!existingGroup.rows.length) {
          await client.query(
            `INSERT INTO study_groups (
              name, subject, lesson_days, lesson_time, is_active, center_id
            )
            VALUES ($1,$2,$3,$4,true,$5)`,
            [
              g.name,
              g.subject,
              g.lesson_days,
              g.lesson_time,
              centerId,
            ]
          );

          console.log(`   🏫 Guruh: ${g.name}`);
        }
      }

      const baseUrl =
        process.env.BASE_URL ||
        'https://ustoz.up.railway.app';

      console.log(`🔗 URL: ${baseUrl}/center/${centerId}`);
      console.log('--------------------------\n');
    }

    await client.query('COMMIT');

    console.log('🎉 BARCHA MARKAZLAR TAYYOR!');
  } catch (error) {
    await client.query('ROLLBACK');

    console.error('\n❌ XATOLIK:\n');
    console.error(error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
