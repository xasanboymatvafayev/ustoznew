# Ustoz AI — Multi-Tenant Setup Guide

## Arxitektura

```
railway-app.up.railway.app/
  ├── /superadmin          ← Boss Admin Panel (HTML)
  ├── /center/1001         ← O'quv markaz #1001 frontendi
  ├── /center/1002         ← O'quv markaz #1002 frontendi
  └── /api/...             ← Backend API
```

## Tizim qanday ishlaydi

1. **Boss Admin** `/superadmin` ga kiradi
2. Yangi o'quv markaz qo'shadi → ID avtomatik (1001, 1002, ...)
3. URL generatsiya bo'ladi: `railway-url/center/1001`
4. Markaz admini shu URL orqali kiradi
5. **Pro/Unlimited** paket tanlansa → oylik to'lov yaratiladi
6. **To'lovchi.uz** orqali to'lov yig'iladi
7. To'lov "paid" bo'lganda markaz avtomatik faollashadi

## Paketlar

| Paket | Narx | Guruhlar | Mentorlar | O'quvchilar |
|-------|------|----------|-----------|-------------|
| Free | Bepul | 1 | 1 | 10 |
| Pro | 499,000 so'm/oy | 20 | Cheksiz | 400 |
| Unlimited | 1,000,000 so'm/oy | Cheksiz | Cheksiz | Cheksiz |

## To'lov jarayoni

```
Boss Admin → To'lov yaratish (To'lovchi.uz API)
         ↓
    order_id olinadi
         ↓
Markaz admin to'lovni amalga oshiradi
         ↓
Boss Admin "Tekshir" bosganda → To'lovchi.uz status check
         ↓
    status=paid → markaz avtomatik faollashadi
```

## Setup

### 1. .env sozlash
```bash
cp .env.example .env
# .env ni to'ldiring
```

### 2. server.js almashtirish
```bash
cp backend/server_new.js backend/server.js
```

### 3. Database migration
```sql
-- PostgreSQL da ishga tushiring:
\i backend/multitenant_migration.sql
```

### 4. superadmin papkasini joylashtirish
```
loyiha/
  ├── backend/
  ├── frontend/
  └── superadmin/      ← bu papka Railway da joylashadi
        └── index.html
```

### 5. Railway deploy
```bash
# Railway da environment variables qo'shing:
# DATABASE_URL, BASE_URL, TOLOV_SHOP_ID, TOLOV_SHOP_KEY, ...
```

## Boss Admin URL

- **Local:** `http://localhost:5000/superadmin`
- **Railway:** `https://your-app.up.railway.app/superadmin`
- **Login:** `boss_admin` / `ustoz2026` (o'zgartirib oling!)

## O'quv markaz URL

- `https://your-app.up.railway.app/center/1001`
- `https://your-app.up.railway.app/center/1002`

## To'lovchi.uz Integration

```
GET https://tolovavto.up.railway.app/api?method=create&shop_id=ID&shop_key=KEY&amount=499000
→ { order: "owld1001", status: "success" }

GET https://tolovavto.up.railway.app/api?method=check&order=owld1001
→ { data: { status: "paid" } }
```
