<div align="center">

# 🌻 dityam.com.ua

### Каталог можливостей для дітей 0–18 років в Україні

**Кожна дитина заслуговує знати про свої можливості.** <br/>
Один сайт збирає курси, олімпіади, табори, стипендії, медичну допомогу, виплати ВПО, кастинги та програми обмінів — все в одному місці, із зручними фільтрами та пошуком.

🔗 **[dityam.com.ua](https://dityam.com.ua)**

![Next.js](https://img.shields.io/badge/Next.js-14-000?style=for-the-badge&logo=next.js)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000?style=for-the-badge&logo=vercel)

[Живий сайт](https://dityam.com.ua) · [Про проєкт](https://dityam.com.ua/about) · [Підтримати](https://send.monobank.ua/jar/F72fDrV2c) · [Issues](https://github.com/maryberezhna/children-opportunities-site/issues)

</div>

---

## ✨ Функції

| | |
|---|---|
| 🔍 | **Пошук** по назві, опису, джерелу |
| 🎂 | **Multi-фільтр за віком** — 0-3, 4-6, 7-11, 12-14, 15-17 (одразу декілька діапазонів) |
| 🎯 | **18 типів можливостей** — курси, олімпіади, обміни, табори, стипендії, медична допомога, конкурси, кастинги, гранти, виплати тощо |
| 💡 | **Multi-фільтр за потребою** — ВПО, інвалідність, обдаровані, онкохворі, діти ветеранів |
| 💰 | **Multi-фільтр за вартістю** — безкоштовно / з фінансуванням |
| ⏰ | **Сортування за терміновістю** — найурgentніші дедлайни завжди перші, незалежно від вибраного сорту |
| 📄 | **Окремі сторінки `/o/[slug]`** для кожної можливості з JSON-LD (Course/Event), canonical, OG image |
| 📱 | **Адаптивний дизайн** — mobile-first, картки клікабельні всю площу на тач-екранах |
| 🤖 | **Автоматичні скрапери** — щотижня шукають нові можливості з 6+ джерел |

---

## 🏗️ Архітектура

```
┌──────────────────────┐    ┌──────────────────────┐    ┌──────────────────────┐
│ 🕷️  GitHub Actions   │───▶│ 🗄️  Supabase         │───▶│ 🌐  Next.js 14       │
│ • scrape.yml         │    │ Postgres 17          │    │ App Router + RSC     │
│ • deadline-check.yml │    │ opportunities table  │    │ ISR every 5 min      │
│ Node.js + cheerio    │    │ 261 rows             │    │ Hosted on Vercel     │
└──────────────────────┘    └──────────────────────┘    └──────────────────────┘
         │                                                         │
         ▼                                                         ▼
   📡 Sources                                              👥 Users
   ACMODASI castings,                                      Батьки та діти
   Constellation, FEST-PORTAL,                             з усієї України
   regional camps, Society for                             — щодня сотні
   Science, Alliance Française                              унікальних візитів
```

---

## 🛠️ Стек

### Frontend
- **Next.js 14** — App Router, async server components, ISR
- **Plain CSS** (no framework) — design tokens у `:root`, mobile-first media queries
- **next/font/google** — DM Sans (Latin) + Manrope (Cyrillic fallback) + Caveat (accent), self-hosted
- **`@supabase/supabase-js`** — server-side data fetching

### Backend / Data
- **Supabase Postgres** — таблиця `opportunities` з content_hash UNIQUE constraint
- **Node.js scrapers** (`scrapers/`) — `cheerio` + native fetch, валідація + дедуплікація через `lib/rules.mjs`

### SEO
- `app/sitemap.js` — auto-generated sitemap.xml з 280+ URL (homepage + per-opportunity)
- `app/robots.js` — robots.txt
- JSON-LD: `WebSite` + `Organization` + `SearchAction` (root) + `Course`/`Event` + `BreadcrumbList` (per-opportunity)
- Open Graph + Twitter Card з 1200×630 brand image
- Verified в Google Search Console

### Аналітика
- **Google Analytics 4** (`G-KPLE8LGH91`)
- **Hotjar** (`6704189`)

### Infra
- **Vercel** — hosting + CDN + automatic preview deploys
- **GitHub Actions** —
  - `scrape.yml` — щопонеділка 05:00 UTC, генерує CSV артефакт
  - `deadline-check.yml` — щопонеділка 06:00 UTC, аудит прострочених програм

---

## 🗄️ Структура БД

Таблиця `opportunities` у Supabase:

| Поле | Тип | Опис |
|---|---|---|
| `id` | `uuid` | Primary key |
| `title` | `text` | Назва можливості |
| `slug` | `text` | URL-друнній ідентифікатор (kebab + 6-char hash) |
| `summary` | `text` | Короткий опис (показується в картці) |
| `age_from` / `age_to` | `int` | Віковий діапазон (0-17) |
| `opportunity_type` | `text` | Один з 18 типів (course, olympiad, camp, scholarship, ...) |
| `categories` | `text[]` | Тематичні теги (arts, STEM, languages, sports, ...) |
| `child_needs` | `text[]` | Потреби (idp, disability, gifted, oncology, veteran_family, ...) |
| `format` | `text` | "Онлайн" / "Офлайн" / "Гібрид" / "Офлайн, Київ" |
| `cost_type` | `text` | `free` / `partially_free` / `paid_affordable` / `paid_premium` / `closed` |
| `deadline` | `date` | Кінцевий термін подачі (NULL = постійна програма) |
| `source_url` | `text` | Посилання на офіційну сторінку |
| `source` | `text` | Назва організації-джерела |
| `content_hash` | `text` | SHA-256 fingerprint (UNIQUE — захист від дублів) |
| `created_at` / `updated_at` | `timestamptz` | Audit timestamps |

---

## 🚀 Локальний запуск

### Frontend

```bash
git clone https://github.com/maryberezhna/children-opportunities-site.git
cd children-opportunities-site

npm install

# Опційно — для розробки з реальною БД:
echo "NEXT_PUBLIC_SUPABASE_URL=..." >> .env.local
echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=..." >> .env.local

npm run dev
```

Відкрийте [http://localhost:3000](http://localhost:3000) 🎉

> Без env-змінних сайт зібрається теж — Supabase client коректно повертає пустий список замість падіння (див. `lib/supabase.js`).

### Скрапери (Node.js)

```bash
npm run scrape
```

Виводить CSV у `scrapers/output/opportunities-YYYY-MM-DD.csv` + `rejects-YYYY-MM-DD.txt` з причинами відхилення кожного рядка. Імпорт у Supabase — Table editor → Import data from CSV.

Деталі (як додати нове джерело, які правила insertion-валідації) — у [`scrapers/README.md`](scrapers/README.md).

### Deadline check

```bash
NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
  node scripts/check-deadlines.mjs
```

Виводить три блоки: 🔴 прострочені непостійні (потребують delete), 🟡 прострочені щорічні (UI вже ховає чіп — оновити дату), 🟢 ті, що ось-ось закриваються.

---

## 📊 Статистика

- **261 можливість** після останньої вичитки (травень 2026)
- **18 типів** — від виплат ВПО до стипендій IB Diploma
- **40+ джерел** — МАН, МОН, EdEra, Prometheus, UNICEF, фонди, міжнародні олімпіади
- **0–18 років** — повне покриття дитячого віку

---

## 🤝 Як допомогти

- 🐛 **Знайшли помилку?** — [issue](https://github.com/maryberezhna/children-opportunities-site/issues) або [написати на email](mailto:maryberezhna@gmail.com)
- 💡 **Знаєте можливість, якої немає?** — [форма пропозиції](mailto:maryberezhna@gmail.com?subject=Запропонувати%20можливість%20на%20dityam.com.ua)
- 💝 **Підтримати фінансово** — [monobank-банка](https://send.monobank.ua/jar/F72fDrV2c) або [Підписка Base](https://base.monobank.ua/5QKZeVxPVjZEx7)
- ⭐ **Поставте зірочку** репозиторію — мотивує
- 🌍 **Робите форк для іншої країни/регіону?** — напишіть, обмінятись досвідом

---

## 📄 Ліцензія

MIT — використовуйте, форкайте, покращуйте.

---

<div align="center">

**Зроблено з 💛💙 в Україні** · за технологічної підтримки [.HUB](https://dot-hub.club/)

*щоб кожна дитина знала про свої можливості*

</div>
