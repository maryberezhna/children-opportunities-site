import Link from 'next/link';
import Footer from './Footer';
import CopyButton from './CopyButton';
import { CITY_META } from '@/lib/cities';
import { MENTIONS } from '@/lib/press';
import { plural, sourcesWord, freeWord } from '@/lib/plural';

// Сторінка «Для медіа» в новому дизайні (вересень 2026). Одна розмітка на
// /press і /en/press — раніше це були дві копії, які встигали розʼїхатись.
// Серверний компонент; єдина інтерактивність — кнопка «Скопіювати».

const EMAIL = 'maryberezhna@gmail.com';
const BRAND_KIT = '/press/dityam-brand-kit.zip';
// Обкладинка — динамічний маршрут із живими цифрами, а не статичний
// og-image.png: той застиг на «690 можливостей» і в прескіті брехав би.
const COVER = '/opengraph-image';
const COVER_FILE = 'dityam-cover-1200x630.png';

const T = {
  uk: {
    status: 'Для медіа · прескіт',
    lead: 'Матеріали ',
    script: 'для журналістів',
    sub: 'Цифри, готовий опис, публікації, логотипи й контакт — на одній '
      + 'сторінці. Усе можна використовувати вільно, з активним посиланням '
      + 'на dityam.com.ua.',
    write: 'Написати Мері',
    kit: 'Бренд-кіт (ZIP, 1,1 МБ)',

    statsTitle: 'Проєкт у цифрах',
    statsNote: 'Цифри рахуються з бази автоматично й оновлюються щогодини — цитуйте те, що бачите.',
    verified: (n) => plural(n, 'перевірена можливість', 'перевірені можливості', 'перевірених можливостей'),
    free: freeWord,
    sources: sourcesWord,
    types: (n) => plural(n, 'тип можливостей', 'типи можливостей', 'типів можливостей'),
    cities: (n) => plural(n, 'місто чи регіон', 'міста й регіони', 'міст і регіонів'),
    age: '0–18',
    ageLabel: 'років — вік дітей',

    pressTitle: 'Про нас пишуть',
    pressCount: (n) => `${n} ${plural(n, 'публікація', 'публікації', 'публікацій')}`,
    pressFirst: 'перша — ',
    read: 'Читати →',

    descTitle: 'Опис одним абзацом',
    copy: 'Скопіювати',
    copied: 'Скопійовано ✓',
    desc: 'dityam.com.ua — безкоштовна платформа, де зібрані можливості для '
      + 'дітей 0–18 років в Україні та за кордоном. Курси, олімпіади, '
      + 'стипендії, табори, гранти, обміни, медична допомога та державні '
      + 'виплати — в одному місці, з фільтрами за віком, регіоном, вартістю '
      + 'й особливими потребами дитини. Кожен запис перевіряється вручну і '
      + 'має посилання на офіційне джерело. Окрема увага — дітям ВПО, дітям '
      + 'ветеранів і загиблих захисників та дітям з особливими потребами.',

    briefTitle: 'Коротко',
    facts: [
      ['Що це', 'платформа можливостей для українських дітей — в Україні та за кордоном'],
      ['Для кого', 'батьки, опікуни, вчителі, соціальні працівники; окремий режим «Підліткам» — для 13–18, хто подається сам'],
      ['Вік дітей', '0–18 років'],
      ['Для родин', 'безкоштовно, без реклами й без реєстрації'],
      ['Хто робить', 'Мері Бережна, соло-проєкт'],
      ['Як наповнюється', 'щоденні скрапери МОН, МАН, IREX, UNICEF, Erasmus+ та інших джерел + ручна модерація кожного запису; посилання перевіряються щоночі'],
    ],
    regions: 'Регіональні сторінки',

    filesTitle: 'Логотипи і зображення',
    files: [
      { href: BRAND_KIT, name: 'Бренд-кіт', meta: 'ZIP, 1,1 МБ', text: 'Знак і локапи у SVG та PNG, версії для світлого й темного фону, палітра, шрифт DM Sans і правила використання', kind: 'kit' },
      { href: '/icon.svg', name: 'Іконка', meta: 'SVG', text: 'Для favicon, аватарів і дрібних розмірів', kind: 'icon' },
      { href: COVER, file: COVER_FILE, name: 'Обкладинка', meta: 'PNG, 1200×630', text: 'Для анонсів і соцмереж; цифри на ній живі', kind: 'cover' },
    ],
    download: 'Завантажити ↓',
    filesNote: 'Кожна сторінка можливості має власну згенеровану картку 1200×630 — достатньо поділитися посиланням на неї.',

    contactLead: 'Контакт ',
    contactScript: 'для журналістів',
    contactText: 'Мері Бережна, засновниця. Відповідаю на запити щодо коментарів, '
      + 'статистики та історій родин, які знайшли програму через платформу. '
      + 'Потрібні дані під конкретний зріз — за віком, регіоном чи типом '
      + 'допомоги? Напишіть, підготую.',
    linksTitle: 'Посилання',
    links: [
      ['Сайт', 'dityam.com.ua', 'https://dityam.com.ua'],
      ['Telegram', '@dityam_com_ua', 'https://t.me/dityam_com_ua'],
      ['Instagram', 'dityam.com.ua', 'https://www.instagram.com/dityam.com.ua'],
      ['Про проєкт', 'як народився dityam.com.ua', '/about'],
      ['Перевірка', 'як ми перевіряємо програми', '/yak-my-pereviriaiemo'],
    ],
  },
  en: {
    status: 'For media · press kit',
    lead: 'Materials ',
    script: 'for journalists',
    sub: 'Figures, a ready-made description, coverage, logos and a contact — on '
      + 'one page. Everything is free to use, with an active link to dityam.com.ua.',
    write: 'Email Mary',
    kit: 'Brand kit (ZIP, 1.1 MB)',

    statsTitle: 'The project in numbers',
    statsNote: 'The figures are counted from the database automatically and refresh every hour — quote what you see.',
    verified: () => 'verified opportunities',
    free: () => 'free of charge',
    sources: () => 'sources',
    types: () => 'types of opportunity',
    cities: () => 'cities and regions',
    age: '0–18',
    ageLabel: 'years old',

    pressTitle: 'Coverage',
    pressCount: (n) => `${n} publication${n === 1 ? '' : 's'}`,
    pressFirst: 'first: ',
    read: 'Read →',

    descTitle: 'Description in one paragraph',
    copy: 'Copy',
    copied: 'Copied ✓',
    desc: 'dityam.com.ua is a free platform collecting opportunities for children '
      + 'aged 0–18 in Ukraine and abroad. Courses, olympiads, scholarships, camps, '
      + 'grants, exchanges, medical help and state payments — in one place, with '
      + 'filters by age, region, cost and a child’s particular needs. Every listing '
      + 'is checked by hand and links to its official source. Particular attention '
      + 'goes to displaced children, children of veterans and of the fallen, and '
      + 'children with special needs.',

    briefTitle: 'In brief',
    facts: [
      ['What it is', 'a platform of opportunities for Ukrainian children — in Ukraine and abroad'],
      ['Who it is for', 'parents, guardians, teachers, social workers; a separate “Teens” mode for 13–18-year-olds who apply on their own'],
      ['Ages', '0–18'],
      ['For families', 'free, with no advertising and no sign-up'],
      ['Who runs it', 'Mary Berezhna, a solo project'],
      ['How it is filled', 'daily scrapers of the Ministry of Education, the Junior Academy of Sciences, IREX, UNICEF, Erasmus+ and other sources, plus manual review of every listing; links are checked nightly'],
    ],
    regions: 'Regional pages',

    filesTitle: 'Logos and images',
    files: [
      { href: BRAND_KIT, name: 'Brand kit', meta: 'ZIP, 1.1 MB', text: 'The mark and lockups in SVG and PNG, versions for light and dark backgrounds, the palette, the DM Sans typeface and usage rules', kind: 'kit' },
      { href: '/icon.svg', name: 'Icon', meta: 'SVG', text: 'For favicons, avatars and small sizes', kind: 'icon' },
      { href: COVER, file: COVER_FILE, name: 'Cover', meta: 'PNG, 1200×630', text: 'For announcements and social media; the figures on it are live', kind: 'cover' },
    ],
    download: 'Download ↓',
    filesNote: 'Every opportunity page has its own generated 1200×630 card — sharing a link to it is enough.',

    contactLead: 'Contact ',
    contactScript: 'for journalists',
    contactText: 'Mary Berezhna, founder. I answer requests for comment, statistics '
      + 'and stories of families who found a programme through the platform. Need '
      + 'figures for a particular cut — by age, region or type of help? Write, and '
      + 'I will prepare them.',
    linksTitle: 'Links',
    links: [
      ['Site', 'dityam.com.ua', 'https://dityam.com.ua'],
      ['Telegram', '@dityam_com_ua', 'https://t.me/dityam_com_ua'],
      ['Instagram', 'dityam.com.ua', 'https://www.instagram.com/dityam.com.ua'],
      ['About', 'how dityam.com.ua came to be', '/en/about'],
      ['Verification', 'how we check programmes', '/en/how-we-verify'],
    ],
  },
};

function mentionDate(m, lang) {
  if (lang !== 'en') return m.date;
  return new Date(`${m.iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
}

function outletName(m, lang) {
  return lang === 'en' ? (m.outletEn || m.outlet) : m.outlet;
}

const isExternal = (href) => href.startsWith('http');

export default function PressKit({ stats, lang = 'uk' }) {
  const t = T[lang] || T.uk;
  const isEn = lang === 'en';
  const first = MENTIONS[0];

  const tiles = stats ? [
    [stats.total, t.verified(stats.total)],
    [stats.free, t.free(stats.free)],
    [stats.sources, t.sources(stats.sources)],
    [stats.types, t.types(stats.types)],
    [stats.cities, t.cities(stats.cities)],
    [t.age, t.ageLabel],
  ] : [];

  return (
    <div className="v2-page" lang={isEn ? 'en' : undefined}>
      <main className="v2-container pk-page">
        <section className="v2-hero pk-hero">
          <div className="v2-hero-copy">
            <div className="v2-hero-status">
              <span className="v2-dot" aria-hidden="true" />
              {t.status}
            </div>
            <h1>
              {t.lead}<span className="v2-script">{t.script}</span>
            </h1>
            <p className="v2-hero-sub">{t.sub}</p>
            <div className="pk-actions">
              <a href={`mailto:${EMAIL}`} className="v2-btn-dark">{t.write}</a>
              <a href={BRAND_KIT} download className="v2-btn-outline">{t.kit}</a>
            </div>
          </div>
        </section>

        {stats ? (
          <section className="pk-section" aria-labelledby="pk-stats-h">
            <h2 id="pk-stats-h">{t.statsTitle}</h2>
            <div className="pk-stats">
              {tiles.map(([num, label]) => (
                <div className="pk-stat" key={label}>
                  <span className="pk-stat-num">{num}</span>
                  <span className="pk-stat-label">{label}</span>
                </div>
              ))}
            </div>
            <p className="pk-note">{t.statsNote}</p>
          </section>
        ) : null}

        <section className="pk-section" aria-labelledby="pk-press-h">
          <div className="pk-section-head">
            <h2 id="pk-press-h">{t.pressTitle}</h2>
            <span>
              {t.pressCount(MENTIONS.length)} · {t.pressFirst}
              {outletName(first, lang)}, {mentionDate(first, lang)}
            </span>
          </div>
          <div className="pk-mentions">
            {MENTIONS.map((m) => (
              <a
                key={m.url}
                href={m.url}
                target="_blank"
                rel="noopener noreferrer"
                className="pk-mention"
              >
                <div className="pk-mention-logo">
                  <img
                    src={m.logo.src}
                    width={m.logo.width}
                    height={m.logo.height}
                    alt={outletName(m, lang)}
                    className={m.logo.width / m.logo.height < 1.5 ? 'is-square' : undefined}
                  />
                </div>
                <div className="pk-mention-meta">
                  {outletName(m, lang)} · {mentionDate(m, lang)}
                </div>
                <h3>{m.title}</h3>
                <span className="pk-mention-more">{t.read}</span>
              </a>
            ))}
          </div>
        </section>

        <section className="pk-two">
          <div className="pk-panel">
            <div className="pk-section-head">
              <h2>{t.descTitle}</h2>
              <CopyButton text={t.desc} label={t.copy} done={t.copied} className="pk-copy" />
            </div>
            <blockquote className="pk-quote">{t.desc}</blockquote>
          </div>
          <div className="pk-panel">
            <h2>{t.briefTitle}</h2>
            <dl className="pk-facts">
              {t.facts.map(([k, v]) => (
                <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
              ))}
              <div>
                <dt>{t.regions}</dt>
                <dd>
                  {Object.entries(CITY_META).map(([slug, meta], i, arr) => (
                    <span key={slug}>
                      <Link href={isEn ? `/en/${slug}` : `/${slug}`}>
                        {isEn ? (meta.en || meta.ua) : meta.ua}
                      </Link>
                      {i < arr.length - 1 ? ', ' : ''}
                    </span>
                  ))}
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="pk-section" aria-labelledby="pk-files-h">
          <h2 id="pk-files-h">{t.filesTitle}</h2>
          <div className="pk-downloads">
            {t.files.map((f) => (
              <a key={f.href} href={f.href} download={f.file || true} className="pk-download">
                <div className={`pk-download-preview is-${f.kind}`}>
                  {f.kind === 'kit' && (
                    <span className="pk-lockup" aria-hidden="true">
                      <span className="v2-logo-heart">🧡</span>
                      <span className="v2-logo-script">dityam.com.ua</span>
                    </span>
                  )}
                  {f.kind === 'icon' && <img src="/icon.svg" width={56} height={56} alt="" />}
                  {f.kind === 'cover' && <img src={COVER} width={1200} height={630} alt="" loading="lazy" />}
                </div>
                <strong>{f.name} <span className="pk-download-meta">· {f.meta}</span></strong>
                <span>{f.text}</span>
                <span className="pk-download-cta">{t.download}</span>
              </a>
            ))}
          </div>
          <p className="pk-note">{t.filesNote}</p>
        </section>

        <section className="v2-bottom">
          <div className="v2-panel">
            <h2>
              {t.contactLead}<span className="v2-script">{t.contactScript}</span>
            </h2>
            <p>{t.contactText}</p>
            <div className="v2-panel-actions">
              <a href={`mailto:${EMAIL}`} className="v2-btn-dark">{EMAIL}</a>
            </div>
          </div>
          <div className="v2-panel">
            <h2>{t.linksTitle}</h2>
            <ul className="pk-links">
              {t.links.map(([label, text, href]) => (
                <li key={href}>
                  <span>{label}: </span>
                  {isExternal(href)
                    ? <a href={href} target="_blank" rel="noopener noreferrer">{text}</a>
                    : <Link href={href}>{text}</Link>}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <Footer lang={lang} />
    </div>
  );
}
