# Children Opportunities Site

Сайт-агрегатор можливостей для дітей 0-18 років в Україні.

## Швидкий деплой на Vercel

### Крок 1: Завантажити на GitHub

1. Створіть новий репозиторій на GitHub (наприклад `children-opportunities-site`)
2. Завантажте всі файли з цього архіву в репозиторій

**Як завантажити через веб-інтерфейс GitHub:**
- Зайдіть у порожній репозиторій
- Натисніть **"uploading an existing file"** (посилання у блакитному блоці)
- Перетягніть **всі файли та папки** з розархівованого ZIP у вікно
- Натисніть **Commit changes**

### Крок 2: Деплой на Vercel

1. Відкрийте [vercel.com](https://vercel.com) → **Sign up with GitHub**
2. **Add New** → **Project** → виберіть `children-opportunities-site`
3. Розгорніть **Environment Variables** і додайте:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | https://xxxxx.supabase.co (ваш Supabase URL) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public key з Supabase |

⚠️ **Важливо:** використовуйте **anon** ключ, НЕ service_role!

Де взяти: Supabase → Project Settings → Data API → **anon public** key

4. Натисніть **Deploy**
5. Через 1-2 хвилини сайт буде доступний за адресою типу `xxx.vercel.app`

## Локальний запуск (опціонально)

```bash
npm install
cp .env.example .env.local
# відредагуйте .env.local зі своїми ключами
npm run dev
```

Відкрийте [http://localhost:3000](http://localhost:3000)

## Структура

```
├── app/
│   ├── layout.js              # загальний layout
│   ├── page.js                # головна сторінка (SSR із Supabase)
│   ├── OpportunitiesList.js   # клієнтський компонент з фільтрами
│   └── globals.css            # стилі
├── lib/
│   └── supabase.js            # клієнт Supabase
├── package.json
├── next.config.js
└── jsconfig.json              # для @ аліасів
```

## Функціонал

- 🔍 Пошук по назві/опису/джерелу
- 🎂 Фільтр за віковою групою (0-3, 4-6, 7-11, 12-14, 15-17)
- 🎯 Фільтр за типом (курс, обмін, табір, стипендія, медична допомога тощо)
- 💡 Фільтр за потребою дитини (ВПО, сироти, інвалідність, обдаровані)
- 💰 Фільтр за вартістю (безкоштовно, з фінансуванням)
- 📱 Адаптивний дизайн для мобільних
