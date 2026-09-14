import Link from 'next/link';
import { supabase, publicOpportunities, countActiveOpportunities, countActiveSources, FALLBACK } from '@/lib/supabase';
import Footer from '../Footer';

const SITE_URL = 'https://dityam.com.ua';

export const revalidate = 3600;

// 14.09.2026 сторінку звірено з кодом рядок за рядком. Прибрано:
// «все нове від агента йде на ручну модерацію» (зелений коридор auto_review
// публікує без людини), «дитячих даних не збираємо взагалі» (Dityam+ зберігає
// профіль дитини), «щоночі» (скрапери й перевірка лінків ідуть раз на день
// уранці), «200+ джерел» і «джерел щодня» (число — джерела з живими записами).
// SEO/GEO: title з повною назвою до 60 символів, опис до 160, свої OG і
// Twitter, JSON-LD WebPage + BreadcrumbList.
const TITLE = 'Як Dityam.com.ua перевіряє можливості для дітей';
const DESCRIPTION = 'Щоденний збір, обовʼязкові поля перед публікацією, щоденна перевірка посилань, закриття завершених наборів, злиття дублів і модератор там, де є сумнів.';

export const metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: {
    canonical: 'https://dityam.com.ua/yak-my-pereviriaiemo',
    // Взаємність обовʼязкова: односторонню анотацію Google ігнорує.
    languages: { uk: 'https://dityam.com.ua/yak-my-pereviriaiemo', en: 'https://dityam.com.ua/en/how-we-verify' },
  },
  openGraph: {
    type: 'website', locale: 'uk_UA', siteName: 'Dityam.com.ua',
    url: 'https://dityam.com.ua/yak-my-pereviriaiemo', title: TITLE, description: DESCRIPTION,
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
};

const JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://dityam.com.ua/yak-my-pereviriaiemo#page',
      url: 'https://dityam.com.ua/yak-my-pereviriaiemo',
      name: TITLE,
      description: DESCRIPTION,
      inLanguage: 'uk',
      isPartOf: { '@id': 'https://dityam.com.ua/#website' },
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Головна', item: 'https://dityam.com.ua' },
        { '@type': 'ListItem', position: 2, name: 'Як ми перевіряємо', item: 'https://dityam.com.ua/yak-my-pereviriaiemo' },
      ],
    },
  ],
};

async function getStats() {
  try {
    if (!supabase) return {};
    const [active, verified, sources] = await Promise.all([
      countActiveOpportunities(),
      publicOpportunities('id', { count: 'exact', head: true })
        .gte('last_verified_at', new Date(Date.now() - 3 * 86400000).toISOString()),
      countActiveSources(),
    ]);
    return { active, verified: verified.count, sources };
  } catch {
    return {};
  }
}

const STEPS = [
  {
    icon: '🔎',
    title: 'Щодня збираємо з наших джерел',
    text: 'Державні сайти, фонди, міжнародні програми, громадські організації, освітні платформи й Telegram-канали. Скрапери й пошуковий агент працюють щодня; частота обходу своя для кожного джерела — ті, де нове зʼявляється частіше, перевіряємо частіше.',
  },
  {
    icon: '🧠',
    title: 'Структуруємо кожен запис',
    text: 'Із тексту організатора виділяємо головне: вік, тип, місто або формат, вартість, дату. Без дати, типу, віку, вартості й формату чи місця запис не публікується — його дивиться модератор. Якщо на сторінці написано, що набір завершено, запис одразу закривається, навіть якщо сторінка ще жива.',
  },
  {
    icon: '🔗',
    title: 'Перевіряємо кожне посилання щодня',
    text: 'Усі активні можливості щодня проходять перевірку посилань. Мертве посилання не ховається одразу: запис закривається лише після трьох невдалих перевірок поспіль. На сторінці кожної можливості видно, коли посилання перевірено востаннє.',
  },
  {
    icon: '👯',
    title: 'Зліплюємо дублікати',
    text: 'Той самий табір може бути на сайті фонду, у Telegram і в новинах — трьома різними текстами. Система розпізнає такі повтори і лишає один запис, щоб ви не перебирали те саме тричі.',
  },
  {
    icon: '⏳',
    title: 'Не даємо записам застаріти',
    text: 'Записи без дедлайну (гуртки, курси) щотижня перечитуються: сторінка жива і набір триває — запис лишається; ні — позначаємо «завершено». Закриті сторінки не зникають: на них плашка й посилання на актуальні можливості.',
  },
  {
    icon: '🫶',
    title: 'Модератор — там, де сумнів',
    text: 'Автоматично запис публікується лише тоді, коли погоджуються і механічні перевірки, і модель-суддя. Усе, де бракує обовʼязкових полів, де суддя вагається, а також медична, психологічна допомога й виплати, іде до модератора. Користуватися платформою можна без реєстрації.',
  },
];

export default async function YakPereviriaiemo() {
  const { active, verified, sources } = await getStats();

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <div className="container">
        <div className="hero">
          <div className="hero-copy">
            <div className="hero-badges">
              <Link href="/" className="city-back-link">← Всі можливості</Link>
            </div>
            <h1>
              Як ми перевіряємо
              <br />
              <span className="accent">можливості на платформі</span>
            </h1>
            <p>
              «Перевірено» на Dityam.com.ua — це не обіцянка, а щоденний процес.
              Ось як він влаштований — чесно й без магії.
            </p>
            <div className="stats">
              <div className="stat">
                <span className="stat-num">{active ?? FALLBACK.opportunities}</span>
                <span className="stat-label">активних можливостей</span>
              </div>
              <div className="stat">
                <span className="stat-num">{verified ?? '—'}</span>
                <span className="stat-label">з лінком, перевіреним за 3 доби</span>
              </div>
              <div className="stat">
                <span className="stat-num">{sources ?? FALLBACK.sources}</span>
                <span className="stat-label">джерел із живими записами</span>
              </div>
            </div>
          </div>
        </div>

        <section className="topic-faq" style={{ maxWidth: 760 }}>
          {STEPS.map((s) => (
            <div key={s.title} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 26, lineHeight: 1.2 }} aria-hidden="true">{s.icon}</span>
              <div>
                <h2 style={{ fontSize: 17, margin: '0 0 4px' }}>{s.title}</h2>
                <p style={{ margin: 0, color: 'var(--ink-soft)', fontSize: 15, lineHeight: 1.6 }}>{s.text}</p>
              </div>
            </div>
          ))}
        </section>

        <p className="topic-note" style={{ marginTop: 24 }}>
          Побачили помилку чи мертве посилання? <a href="mailto:hellodityam.com.ua@gmail.com?subject=Помилка%20на%20dityam.com.ua">Напишіть нам</a> —
          виправимо і скажемо дякую. А якщо знаєте можливість, якої на платформі ще немає —{' '}
          <a href="mailto:hellodityam.com.ua@gmail.com?subject=Додати%20можливість">пропонуйте</a>.
        </p>
      </div>
      <Footer />
    </>
  );
}
