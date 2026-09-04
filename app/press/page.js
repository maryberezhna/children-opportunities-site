import Link from 'next/link';
import { CITY_META } from '@/lib/cities';
import { MENTIONS, pressStats } from '@/lib/press';
import PressLogos from '../PressLogos';

export const metadata = {
  title: 'Для медіа — прескіт dityam.com.ua',
  description:
    'Прескіт dityam.com.ua: цифри проєкту, опис одним абзацом, логотипи, контакт для журналістів. Платформа можливостей для українських дітей 0-18 років.',
  alternates: {
    canonical: 'https://dityam.com.ua/press',
    languages: {
      uk: 'https://dityam.com.ua/press',
      en: 'https://dityam.com.ua/en/press',
    },
  },
};

// Цифри тягнемо живими: журналіст цитує те, що бачить, тож застаріле «280+»
// у статичному тексті рано чи пізно стало б помилкою в чужій публікації.
export const revalidate = 3600;

export default async function PressPage() {
  const stats = await pressStats();

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

        <h2>Про нас пишуть</h2>
        <PressLogos />

        <h2>Опис одним абзацом</h2>
        <blockquote className="press-quote">
          dityam.com.ua — безкоштовна платформа, де зібрані можливості для дітей
          0-18 років в Україні. Курси, олімпіади, стипендії, табори, гранти, медична
          допомога та державні виплати — в одному місці, з фільтрами за віком,
          регіоном, вартістю й особливими потребами дитини. Кожен запис перевіряється вручну
          і має посилання на офіційне джерело. Окрема увага — дітям ВПО, дітям
          ветеранів і загиблих захисників та дітям з особливими потребами.
        </blockquote>

        <h2>Коротко</h2>
        <ul>
          <li><strong>Що це:</strong> платформа можливостей для українських дітей — в Україні та за кордоном</li>
          <li><strong>Для кого:</strong> батьки, опікуни, вчителі, соціальні працівники</li>
          <li><strong>Вік дітей:</strong> 0-18 років</li>
          <li><strong>Вартість для родин:</strong> платформа безкоштовна, без реклами</li>
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

        <h2>Повний перелік публікацій</h2>
        <ul className="press-mentions">
          {MENTIONS.map((m) => (
            <li key={m.url}>
              <a href={m.url} target="_blank" rel="noopener noreferrer">
                {m.title}
              </a>
              <br />
              <span className="press-mention-meta">
                {m.outlet} · {m.date}
              </span>
            </li>
          ))}
        </ul>

        <h2>Логотипи і зображення</h2>
        <ul>
          <li>
            <a href="/press/dityam-brand-kit.zip" download>Бренд-кіт (ZIP, 1,1 МБ)</a> —
            знак і локапи у SVG та PNG, версії для світлого й темного фону, палітра,
            шрифт DM Sans і правила використання
          </li>
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
          знайшли програму через платформу. Якщо потрібні дані під конкретний зріз
          (за віком, регіоном чи типом допомоги) — напишіть, підготую.
        </p>
      </article>
    </div>
  );
}
