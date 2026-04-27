<div align="center">

# 🌻 Children Opportunities Site

### Сайт-агрегатор можливостей для дітей 0–18 років в Україні

**Кожна дитина заслуговує знати про свої можливості.** <br/>
Один сайт збирає конкурси, гранти, стипендії, табори, медичну допомогу, кастинги, обміни та програми підтримки — все в одному місці, із зручними фільтрами та пошуком.

🔗 **[dityam.com.ua](https://dityam.com.ua)**

![Next.js](https://img.shields.io/badge/Next.js-14-000?style=for-the-badge&logo=next.js)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000?style=for-the-badge&logo=vercel)
![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=for-the-badge&logo=python&logoColor=white)

[Живий сайт](https://dityam.com.ua) · [Підтримати проєкт](https://dityam.com.ua#support) · [Повідомити про помилку](https://github.com/maryberezhna/children-opportunities-site/issues)

</div>

---

## ✨ Що вміє сайт

| | |
|---|---|
| 🔍 | **Розумний пошук** по назві, опису та джерелу |
| 🎂 | **Фільтр за віком** — 0–3, 4–6, 7–11, 12–14, 15–17 років |
| 🎯 | **18 типів можливостей** — курси, обміни, табори, стипендії, медична допомога, конкурси, кастинги, олімпіади та інше |
| 💡 | **Фільтр за потребою дитини** — ВПО, інвалідність, обдаровані |
| 💰 | **Фільтр за вартістю** — безкоштовно, з частковим фінансуванням, доступне, преміум |
| 📱 | **Адаптивний дизайн** — працює на телефоні, планшеті, ПК |
| 🤖 | **Автоматичне оновлення** — щоденні скрапери AI-агентами додають нові можливості |

---

## 🏗️ Архітектура

```
┌─────────────────────────┐     ┌─────────────────────────┐     ┌────────────────────────┐
│  🕷️  GitHub Actions     │────▶│  🗄️  Supabase (Postgres)│────▶│  🌐  Next.js + Vercel  │
│  Python-скрапери з AI   │     │  Таблиця opportunities  │     │  dityam.com.ua         │
│  Запуск щодня о 09:00   │     │  REST API + RLS         │     │  SSR + ISR              │
└─────────────────────────┘     └─────────────────────────┘     └────────────────────────┘
          ▲                                                                ▲
          │                                                                │
   📡 Джерела даних                                               👥 Батьки та діти
   МАН, МОН, Prometheus,                                           з усієї України
   EdEra, Дія.Освіта,
   фонди, UNICEF, і т.д.
```

---

## 🛠️ Технічний стек

### Frontend
- **[Next.js 14](https://nextjs.org/)** — App Router, React Server Components
- **[Tailwind CSS](https://tailwindcss.com/)** — утилітарні стилі
- **[Supabase JS Client](https://supabase.com/docs/reference/javascript)** — запити до БД

### Backend / Data
- **[Supabase](https://supabase.com/)** — Postgres, REST API, авторизація
- **[Python 3.11](https://www.python.org/)** — скрапери
- **BeautifulSoup + requests** — парсинг HTML
- **Anthropic Claude API** — AI-категоризація та збагачення даних

### Infra
- **[Vercel](https://vercel.com/)** — хостинг Next.js + CDN
- **[GitHub Actions](https://github.com/features/actions)** — cron для скраперів
- **Власний домен** — [dityam.com.ua](https://dityam.com.ua)

---

## 🗄️ Структура бази даних

Таблиця `opportunities` у Supabase:

| Поле | Тип | Опис |
|---|---|---|
| `id` | `uuid` | Первинний ключ |
| `title` | `text` | Назва можливості |
| `slug` | `text` | URL-дружній ідентифікатор |
| `summary` | `text` | Короткий опис |
| `age_from` / `age_to` | `int` | Віковий діапазон |
| `opportunity_type` | `text` | Тип (18 категорій) |
| `categories` | `text[]` | Тематичні теги (arts, STEM, sports…) |
| `child_needs` | `text[]` | Потреби (idp, orphan, disability, gifted) |
| `format` | `text` | Офлайн / онлайн / гібрид |
| `cost_type` | `text` | Безкоштовно / частково / платно |
| `deadline` | `date` | Кінцева дата подачі заявки |
| `source_url` | `text` | Посилання на першоджерело |
| `source` | `text` | Назва організації |
| `content_hash` | `text` | Хеш для дедуплікації (`UNIQUE`) |

---

## 🚀 Локальний запуск

### Frontend

```bash
git clone https://github.com/maryberezhna/children-opportunities-site.git
cd children-opportunities-site

npm install
cp .env.local.example .env.local
# Додайте ваші NEXT_PUBLIC_SUPABASE_URL та NEXT_PUBLIC_SUPABASE_ANON_KEY

npm run dev
```

Відкрийте [http://localhost:3000](http://localhost:3000) 🎉

### Скрапери

```bash
cd scrapers
pip install -r requirements.txt
cp .env.example .env
# Додайте SUPABASE_URL та SUPABASE_KEY (service_role!)

python run_all.py
```

---

## 📊 Статистика

- **265+ можливостей** в актуальній базі
- **18 типів** — від стипендій до медичної допомоги
- **40+ джерел** даних, що оновлюються автоматично
- **0–18 років** — повне покриття дитячого віку

---

## 🤝 Як допомогти

Проєкт з відкритим кодом і живе завдяки допомозі спільноти:

- 🐛 **Знайшли помилку?** — [відкрийте issue](https://github.com/maryberezhna/children-opportunities-site/issues)
- 💡 **Знаєте можливість, якої немає на сайті?** — напишіть нам через [форму на сайті](https://dityam.com.ua)
- 💝 **Хочете підтримати фінансово?** — [кнопка "Підтримати" на сайті](https://dityam.com.ua) (monobank)
- ⭐ **Поставте зірочку** цьому репозиторію — це мотивує

---

## 📄 Ліцензія

MIT — використовуйте, форкайте, покращуйте. Єдине прохання: якщо робите форк для своєї країни чи регіону — повідомте, щоб ми могли разом обмінюватися досвідом 🌍

---

<div align="center">

**Зроблено з 💛💙 в Україні**

*для того, щоб кожна дитина знала про свої можливості*

</div>
