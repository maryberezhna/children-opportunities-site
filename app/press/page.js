import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { CITY_META } from '@/lib/cities';

// Сторінку тимчасово сховано на прохання (16.08.2026): віддає 404, посилання
// з футера/en/llms.txt/sitemap прибрані. Повернути — видалити HIDDEN.
const HIDDEN = true;

export const metadata = {
  title: 'Для медіа — прескіт dityam.com.ua',
  description:
    'Прескіт dityam.com.ua: цифри проєкту, опис одним абзацом, логотипи, контакт для журналістів. Платформа можливостей для українських дітей 0-18 років.',
  alternates: { canonical: 'https://dityam.com.ua/press' },
};

// Цифри тягнемо живими: журналіст цитує те, що бачить, тож застаріле «280+»
// у статичному тексті рано чи пізно стало б помилкою в чужій публікації.
export const revalidate = 3600;

async function getStats() {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('opportunities')
    .select('cost_type, source, opportunity_type, cities, child_needs')
    .eq('status', 'active');
  if (error || !data) return null;

  const cities = new Set();
  const needs = new Set();
  data.forEach((o) => {
    (o.cities || []).forEach((c) => cities.add(c));
    (o.child_needs || []).forEach((n) => needs.add(n));
  });

  return {
    total: data.length,
    free: data.filter((o) => o.cost_type === 'free').length,
    sources: new Set(data.map((o) => o.source).filter(Boolean)).size,
    types: new Set(data.map((o) => o.opportunity_type).filter(Boolean)).size,
    cities: cities.size,
    needs: needs.size,
  };
}

export default async function PressPage() {
  if (HIDDEN) notFound();
  const stats = await getStats();

  return (
    <div className="container">
      <nav className="opportunity-breadcrumbs">
        <Link href="/">← Усі можливості</Link>
      </nav>

      <article className="legal-page">
        <h1>Для медіа</h1>

        <p className="lead">
          Тут зібрано все, що знадобиться для матеріалу про dityam.com.ua: цифри,
          готовий опис, логотипи і контакт. Матеріали можна використовувати вільно,
          з посиланням на сайт.
        </p>

        {stats ? (
          <>
            <h2>Проєкт у цифрах</h2>
            <div className="stats press-stats">
              <div className="stat">
                <span className="stat-num">{stats.total}</span>
                <span className="stat-label">перевірених можливостей</span>
              </div>
              <div className="stat">
                <span className="stat-num">{stats.free}</span>
                <span className="stat-label">безкоштовних</span>
              </div>
              <div className="stat">
                <span className="stat-num">{stats.sources}</span>
                <span className="stat-label">джерел</span>
              </div>
              <div className="stat">
                <span className="stat-num">{stats.types}</span>
                <span className="stat-label">типів можливостей</span>
              </div>
              <div className="stat">
                <span className="stat-num">{stats.cities}</span>
                <span className="stat-label">міст і регіонів</span>
              </div>
              <div className="stat">
                <span className="stat-num">0-18</span>
                <span className="stat-label">років</span>
              </div>
            </div>
            <p className="press-note">
              Цифри оновлюються автоматично — станом на момент відкриття цієї сторінки.
            </p>
          </>
        ) : null}

        <h2>Опис одним абзацом</h2>
        <blockquote className="press-quote">
          dityam.com.ua — безкоштовний каталог можливостей для дітей 0-18 років в
          Україні. Курси, олімпіади, стипендії, табори, гранти, медична допомога та
          державні виплати зібрані в одному місці з фільтрами за віком, регіоном,
          вартістю й особливими потребами дитини. Кожен запис перевіряється вручну
          і має посилання на офіційне джерело. Окрема увага — дітям ВПО, дітям
          ветеранів і загиблих захисників та дітям з особливими потребами.
        </blockquote>

        <h2>Коротко</h2>
        <ul>
          <li><strong>Що це:</strong> платформа можливостей для українських дітей — в Україні та за кордоном</li>
          <li><strong>Для кого:</strong> батьки, опікуни, вчителі, соціальні працівники</li>
          <li><strong>Вік дітей:</strong> 0-18 років</li>
          <li><strong>Вартість для родин:</strong> каталог безкоштовний, без реклами</li>
          <li><strong>Хто робить:</strong> Мері Бережна, соло-проєкт</li>
          <li><strong>Як наповнюється:</strong> щоденні скрапери МОН, МАН, IREX, UNICEF, Erasmus+ та інших джерел + ручна модерація кожного запису</li>
          <li>
            <strong>Регіональні сторінки:</strong>{' '}
            {Object.entries(CITY_META).map(([slug, meta], i, arr) => (
              <span key={slug}>
                <Link href={`/${slug}`}>{meta.ua}</Link>
                {i < arr.length - 1 ? ', ' : ''}
              </span>
            ))}
          </li>
        </ul>

        <h2>Логотипи і зображення</h2>
        <ul>
          <li>
            <a href="/icon.svg" download>Іконка (SVG)</a> — для favicon і дрібних розмірів
          </li>
          <li>
            <a href="/og-image.png" download>Обкладинка 1200×630 (PNG)</a> — для анонсів і соцмереж
          </li>
        </ul>
        <p>
          Кожна сторінка можливості має власну згенеровану картку 1200×630 —
          достатньо поділитися посиланням на неї.
        </p>

        <h2>Посилання</h2>
        <ul>
          <li>Сайт: <a href="https://dityam.com.ua">dityam.com.ua</a></li>
          <li>
            Telegram-канал:{' '}
            <a href="https://t.me/dityam_com_ua" target="_blank" rel="noopener noreferrer">
              @dityam_com_ua
            </a>
          </li>
          <li>
            Instagram:{' '}
            <a href="https://www.instagram.com/dityam.com.ua" target="_blank" rel="noopener noreferrer">
              dityam.com.ua
            </a>
          </li>
          <li><Link href="/about">Про проєкт</Link></li>
        </ul>

        <h2>Контакт для журналістів</h2>
        <p>
          Мері Бережна —{' '}
          <a href="mailto:maryberezhna@gmail.com">maryberezhna@gmail.com</a>.
          Відповідаю на запити щодо коментарів, статистики та історій родин, які
          знайшли програму через каталог. Якщо потрібні дані під конкретний зріз
          (за віком, регіоном чи типом допомоги) — напишіть, підготую.
        </p>
      </article>
    </div>
  );
}
