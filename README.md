# 🤖 Ustoz Yordamchi AI — ITpark

O'quvchilar va mentorlar uchun to'liq ta'lim platformasi.

---

## 📁 Loyiha tuzilishi

```
ustoz-yordamchi/
├── backend/          ← Node.js + Express + PostgreSQL
│   ├── routes/       ← API marshrutlar
│   ├── middleware/   ← Auth middleware (JWT)
│   ├── server.js     ← Asosiy server
│   ├── schema.sql    ← Ma'lumotlar bazasi sxemasi
│   └── .env.example  ← Muhit o'zgaruvchilari
└── frontend/         ← React.js
    ├── src/
    │   ├── pages/    ← Sahifalar
    │   ├── context/  ← AuthContext
    │   ├── utils/    ← API utility
    │   └── styles/   ← CSS
    └── .env.example
```

---

## ⚙️ O'rnatish

### 1. PostgreSQL bazasini yarating

```bash
psql -U postgres
CREATE DATABASE ustoz_yordamchi;
\c ustoz_yordamchi
\i backend/schema.sql
\q
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
# .env faylni to'ldiring
npm run dev
```

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env
# .env faylni to'ldiring
npm start
```

---

## 🔧 .env to'ldirish

### backend/.env
```env
DATABASE_URL=postgresql://postgres:PAROLINGIZ@localhost:5432/ustoz_yordamchi
JWT_SECRET=ixtiyoriy_maxfiy_kalit
PORT=5000

# Gmail App Password olish:
# Google Account → Security → 2-Step Verification → App passwords
EMAIL_USER=sizningemail@gmail.com
EMAIL_PASS=gmail_app_paroli
```

### frontend/.env
```env
REACT_APP_API_URL=http://localhost:5000/api

# EmailJS.com dan ro'yxatdan o'ting
REACT_APP_EMAILJS_SERVICE=service_xxx
REACT_APP_EMAILJS_TEMPLATE=template_xxx  
REACT_APP_EMAILJS_KEY=public_key_xxx
```

---

## 📧 EmailJS sozlash

1. https://emailjs.com ga kiring
2. Email Service qo'shing (Gmail)
3. Template yarating, template parametrlar: `{{to_email}}`, `{{code}}`
4. Service ID, Template ID va Public Key ni `.env` ga yozing

---

## 🔐 Kirish ma'lumotlari

| Rol | Maydon | Qiymat |
|-----|--------|--------|
| Admin | Parol | `sonnet123` |
| Mentor | Telefon + Parol | Admin tomonidan beriladi |
| O'quvchi | Email + Parol | Ro'yxatdan o'tishda belgilanadi |

---

## 🌟 Xususiyatlar

### Admin Panel
- 📊 Dashboard (statistikalar)
- 👨‍🏫 Mentor qo'shish/o'chirish
- 🏫 Guruh yaratish (juft/toq/harkuni kunlar)
- 🎓 O'quvchilar ro'yxati
- 📅 Kalendar tadbirlari

### Mentor Panel
- 📋 Uy vazifalari (muddat bilan)
- ⏱️ Darsda vazifalar (taymer bilan, avtoyopilish)
- 🤖 AI orqali kod/vazifalarni tekshirish
- 💬 Guruh chati (real-time polling)
- 📊 Jadval (Excel-style, tahrirlash, ball qo'yish)
- 🚫 O'quvchini guruhdan chiqarish

### O'quvchi Panel
- 📋 Uy vazifalari (topshirish)
- ⏱️ Darsda vazifalar (countdown timer)
- 💬 Guruh chati
- 👤 Profil va parol o'zgartirish

### Login sahifasi
- 👨‍🏫 Mentor kirish (tel+parol)
- 🎓 O'quvchi kirish (email+parol)
- 📝 Ro'yxatdan o'tish (emailjs tasdiqlash kodi)
- 🔑 Parolni tiklash (email orqali)
- 🔐 Admin kirish (yashirin icon)

---

## 🗄️ Ma'lumotlar bazasi

```
users          → O'quvchilar
mentors        → Mentorlar
groups         → Guruhlar
group_members  → Guruh a'zolari
assignments    → Vazifalar (homework/classwork)
submissions    → Topshirilgan vazifalar
chat_messages  → Chat xabarlar
calendar_events→ Kalendar tadbirlar
scores         → Jadval ballari
```

---

## 📌 Texnologiyalar

- **Backend**: Node.js, Express, PostgreSQL, JWT, Bcrypt, Nodemailer
- **Frontend**: React.js, React Router, Axios
- **AI**: Anthropic Claude API (vazifalarni tekshirish)
- **Email**: EmailJS (frontend) + Nodemailer (backend)
