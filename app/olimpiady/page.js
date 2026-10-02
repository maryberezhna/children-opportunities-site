import '@/app/styles/routes/topic.css';
import Link from 'next/link';
import { supabase, publicOpportunities, fetchAllRows, rowsOrThrow, CARD_FIELDS } from '@/lib/supabase';
import { TOPICS, topicPath, collectionsPath } from '@/lib/topics';
import { opportunitiesWord } from '@/lib/plural';
import { kyivToday } from '@/lib/dates';
import { isLive } from '@/lib/audience';
import { OLYMPIADS_PATH, ORDER, STAGES, SUBJECTS, isMonOlympiad } from '@/lib/olympiads';
import TopicCards from '../topic/TopicCards';
import ShareButton from '../topic/ShareButton';
import StickyBar from '../StickyBar';
import SubscribePopup from '../SubscribePopup';
import SupportPopup from '../SupportPopup';
import Footer from '../Footer';

/**
 * Путівник «Всеукраїнські учнівські олімпіади 2026/2027» (27.09.2026).
 *
 * Рамка — шаблон підбірок (класи tp-* і er-* з topic-v2.css), як у /erasmus:
 * крихти, хіро, розділи путівника, живий список карток, «Важливо знати»,
 * «Часті питання», «Інші підбірки».
 *
 * Навіщо окрема сторінка, якщо є підбірка /mizhnarodni-olimpiady: підбірка
 * показує картки, але не відповідає на питання, з якими людина приходить у
 * жовтні — з яких предметів олімпіада буває, з якого класу, коли етапи й куди
 * записуватись. Ці 24 рядки в жодну картку не влазять.
 *
 * Усі числа — з наказу МОН (lib/olympiads.js). Вік порахований із класів тим
 * самим правилом, що в скрапері, і поруч завжди показані самі класи: щоб було
 * видно, звідки взялась цифра.
 */

const SITE_URL = 'https://dityam.com.ua';
const TELEGRAM_URL = 'https://t.me/dityam_com_ua';
const URL = `${SITE_URL}${OLYMPIADS_PATH}`;
const CHECKED = '27 вересня 2026 року';

const TITLE = 'Всеукраїнські учнівські олімпіади 2026/2027: предмети, класи, дати етапів';
const DESCRIPTION =
  'Усі 24 предмети Всеукраїнських учнівських олімпіад 2026/2027 за наказом МОН: з якого класу, коли три етапи '
  + 'і як записатися. Участь безкоштовна.';
const HERO = { src: '/topic-olimpiady', alt: 'Старшокласники за партами на занятті' };

export const revalidate = 3600;

export const metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: URL },
  openGraph: {
    type: 'article', locale: 'uk_UA', siteName: 'Dityam.com.ua', url: URL,
    title: TITLE, description: DESCRIPTION,
    images: [{ url: `${HERO.src}.jpg`, width: 900, height: 600, alt: HERO.alt }],
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: [`${HERO.src}.jpg`] },
};

const FAQ = [
  {
    q: 'З яких предметів проводяться Всеукраїнські учнівські олімпіади у 2026/2027 році?',
    a: 'На І та ІІ етапах — з 24 предметів: математика, фізика, хімія, біологія, географія, астрономія, '
      + 'інформатика, інформаційні технології, історія, правознавство, українська мова та література, '
      + 'англійська, німецька, французька, іспанська, а також болгарська, кримськотатарська, іврит, '
      + 'новогрецька, польська, румунська, словацька, угорська й чеська мови та літератури. '
      + 'На ІІІ (державному) етапі — з 18: там немає іспанської, французької, словацької, угорської, '
      + 'новогрецької та чеської.',
  },
  {
    q: 'З якого класу можна брати участь в олімпіаді?',
    a: 'З восьмого — з математики, фізики, хімії, біології, географії, інформатики, історії та української мови '
      + 'і літератури. З девʼятого — з решти предметів. Астрономія починається з десятого класу.',
  },
  {
    q: 'Коли відбудуться етапи олімпіад у 2026/2027 навчальному році?',
    a: 'І етап — з 1 жовтня до 10 листопада 2026 року на рівні громад і районів. ІІ етап — з 1 грудня 2026 '
      + 'до 26 січня 2027 року на рівні областей і міста Києва. ІІІ, державний етап — з 15 березня '
      + 'до 10 травня 2027 року. Конкретний день кожного предмета визначають організатори етапу.',
  },
  {
    q: 'Як записатися на олімпіаду?',
    a: 'Окремої заявки подавати не треба: на І етап учня записує школа, зазвичай учитель-предметник. '
      + 'Якщо хочете взяти участь, скажіть про це вчителеві до початку жовтня.',
  },
  {
    q: 'Скільки коштує участь у Всеукраїнській олімпіаді?',
    a: 'Нічого. Це державні олімпіади, які проводить Міністерство освіти і науки, і плати за участь у них немає.',
  },
  {
    q: 'Чим Всеукраїнська олімпіада відрізняється від конкурсів на кшталт «Кенгуру» чи «Левеня»?',
    a: 'Всеукраїнська олімпіада — державна, безкоштовна й має три етапи з виходом на державний рівень. '
      + 'Масові конкурси проводять окремі організації, участь у них зазвичай передбачає благодійний внесок, '
      + 'а етапів у звичному сенсі немає. Одне одному не заважає: дитина може брати участь і там, і там.',
  },
];

const CARD_LABELS = {
  all: 'Усі',
  sort: 'за датою, найближчі спочатку',
  details: 'Детальніше →',
  emptyTitle: 'Нічого не знайдено',
  emptyText: 'Спробуйте інший фільтр.',
  listLabel: 'Олімпіади в каталозі',
  filterLabel: 'Фільтр за типом',
};

async function getRows() {
  if (!supabase) return [];
  return rowsOrThrow(await fetchAllRows(() =>
    publicOpportunities(CARD_FIELDS).order('created_at', { ascending: false }).order('id')), 'olympiads guide');
}

const slim = (o) => ({
  id: o.id, slug: o.slug, title: o.title, title_en: o.title_en || null,
  summary: o.summary, summary_en: null, source: o.source,
  opportunity_type: o.opportunity_type, age_from: o.age_from, age_to: o.age_to,
  deadline: o.deadline, cities: o.cities, countries: o.countries || null,
  event_start_date: o.event_start_date || null, event_end_date: o.event_end_date || null,
  timing_kind: o.timing_kind || null,
  is_international: o.is_international || false, format: o.format,
});

const titled = ([plain, script]) => (
  <>{plain} <span className="tp-script">{script}</span></>
);

const ext = (href, text) => (
  <a href={href} target="_blank" rel="noopener noreferrer">{text}</a>
);

export default async function OlympiadsGuide() {
  const todayIso = kyivToday();
  const rows = await getRows();
  const live = rows.filter((o) => isLive(o, todayIso));
  const items = live.filter(isMonOlympiad)
    .sort((a, b) => (a.title || '').localeCompare(b.title || '', 'uk'));
  const total = items.length;

  const olympiads = TOPICS['mizhnarodni-olimpiady'];
  const related = ['mizhnarodni-olimpiady', 'konkursy']
    .map((slug) => TOPICS[slug])
    .map((t) => ({ topic: t, count: live.filter(t.match).length }));

  const updatedLabel = new Intl.DateTimeFormat('uk-UA', {
    timeZone: 'Europe/Kyiv', day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date());

  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${URL}#page`,
        url: URL,
        name: 'Всеукраїнські учнівські олімпіади 2026/2027',
        headline: TITLE,
        description: DESCRIPTION,
        inLanguage: 'uk',
        dateModified: todayIso,
        about: {
          '@type': 'Thing',
          name: 'Всеукраїнські учнівські олімпіади з навчальних предметів',
        },
        isPartOf: { '@id': `${SITE_URL}/#website` },
        primaryImageOfPage: { '@type': 'ImageObject', url: `${SITE_URL}${HERO.src}.jpg` },
        breadcrumb: { '@id': `${URL}#breadcrumb` },
        citation: {
          '@type': 'Legislation',
          name: `Наказ МОН ${ORDER.no} від ${ORDER.date}`,
          legislationIdentifier: ORDER.no,
          url: ORDER.url,
          description: ORDER.title,
        },
      },
      // Предмет несе класи, вік і державний етап прямо в даних. Без цього
      // асистент, якого спитали «з якого класу олімпіада з фізики», мав би
      // здогадуватись із тексту сторінки — а тут відповідь однозначна.
      {
        '@type': 'ItemList',
        '@id': `${URL}#subjects`,
        name: 'Предмети Всеукраїнських учнівських олімпіад 2026/2027',
        numberOfItems: SUBJECTS.length,
        itemListOrder: 'https://schema.org/ItemListOrderAscending',
        itemListElement: SUBJECTS.map((s, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: s.name,
          item: {
            '@type': 'EducationalOccupationalProgram',
            name: `Всеукраїнська олімпіада з предмета «${s.name}»`,
            educationalProgramMode: 'full-time',
            typicalAgeRange: `${s.from}-${s.to}`,
            educationalLevel: `${s.grades} класи`,
            offers: { '@type': 'Offer', price: 0, priceCurrency: 'UAH', availability: 'https://schema.org/InStock' },
            provider: {
              '@type': 'GovernmentOrganization',
              name: 'Міністерство освіти і науки України',
              url: 'https://mon.gov.ua',
            },
            description: s.third
              ? 'Проводиться на всіх трьох етапах, включно з державним.'
              : 'Проводиться лише на І та ІІ етапах — державного етапу з цього предмета немає.',
          },
        })),
      },
      // Етапи окремо: «коли І етап» — найчастіше питання, і відповідь на нього
      // має бути в даних, а не лише в реченні.
      ...STAGES.map((st, i) => ({
        '@type': 'Event',
        '@id': `${URL}#stage-${i + 1}`,
        name: `${st.n} Всеукраїнських учнівських олімпіад 2026/2027`,
        description: `${st.who}. ${st.note}`,
        startDate: st.startDate,
        endDate: st.endDate,
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        eventStatus: 'https://schema.org/EventScheduled',
        // Place з адресою, а не Country: для офлайн-події Google вимагає
        // location.address, і з Country усі чотири етапи були невалідні.
        location: {
          '@type': 'Place',
          name: 'Україна',
          address: { '@type': 'PostalAddress', addressCountry: 'UA' },
        },
        isAccessibleForFree: true,
        organizer: {
          '@type': 'GovernmentOrganization',
          name: 'Міністерство освіти і науки України',
          url: 'https://mon.gov.ua',
        },
      })),
      {
        '@type': 'BreadcrumbList',
        '@id': `${URL}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Головна', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'Підбірки', item: `${SITE_URL}${collectionsPath()}` },
          { '@type': 'ListItem', position: 3, name: olympiads.nav, item: `${SITE_URL}${topicPath(olympiads)}` },
          { '@type': 'ListItem', position: 4, name: 'Всеукраїнські олімпіади', item: URL },
        ],
      },
      {
        '@type': 'FAQPage',
        '@id': `${URL}#faq`,
        mainEntity: FAQ.map((f) => ({
          '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />

      <main className="tp-main er-main">
        <nav className="tp-crumbs" aria-label="Навігація">
          <Link href="/">Головна</Link>
          <span aria-hidden="true">/</span>
          <Link href={collectionsPath()}>Підбірки</Link>
          <span aria-hidden="true">/</span>
          <Link href={topicPath(olympiads)}>{olympiads.nav}</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Всеукраїнські олімпіади</span>
        </nav>

        <section className="tp-hero" aria-labelledby="tp-title">
          <div className="tp-hero-copy">
            <span className="tp-eyebrow">Путівник · оновлено {updatedLabel}</span>
            <h1 id="tp-title" className="tp-h1">
              Всеукраїнські <span className="tp-script">олімпіади</span> 2026/2027
            </h1>
            <p className="tp-intro">
              Олімпіада — найкоротший шлях, який працює однаково для дитини зі столичного ліцею і зі школи
              в районному центрі: там дивляться на розвʼязані задачі, а не на резюме. Тут усі 24 предмети
              цього навчального року, з якого класу можна брати участь, коли три етапи й куди записуватись.
            </p>
            <p className="tp-guide-link"><a href="#ol-subjects">Одразу до переліку предметів ↓</a></p>
            <div className="tp-actions">
              <a href={TELEGRAM_URL} className="tp-btn tp-btn-dark" target="_blank" rel="noopener noreferrer">
                Отримувати нові в Telegram
              </a>
              <ShareButton label="Поділитися путівником" doneLabel="Посилання скопійовано" />
            </div>
          </div>
          <div className="tp-hero-photo">
            <picture>
              <source srcSet={`${HERO.src}.webp`} type="image/webp" />
              <img src={`${HERO.src}.jpg`} alt={HERO.alt} width="900" height="600" loading="eager" fetchPriority="high" />
            </picture>
            <p className="tp-hero-count">
              <span className="tp-hero-count-n">{SUBJECTS.length}</span>
              <span className="tp-hero-count-t">предметів цього року</span>
            </p>
          </div>
        </section>

        <section className="tp-faq er-section" aria-labelledby="ol-stages">
          <h2 id="ol-stages" className="tp-h2">{titled(['Три', 'етапи'])}</h2>
          <div className="er-body">
            <ol className="er-steps">
              {STAGES.map((s) => (
                <li key={s.n} className="er-step">
                  <h3>{s.n} — {s.when}</h3>
                  <p><strong>{s.who}.</strong> {s.note}</p>
                </li>
              ))}
            </ol>
            <p className="tp-note-text">
              Вікна етапів задає наказ МОН. Конкретний день кожного предмета визначають уже організатори
              етапу — громада, область і МОН, — тому точну дату дізнавайтесь у школі.
            </p>
          </div>
        </section>

        <section id="ol-subjects" className="tp-faq er-section" aria-labelledby="ol-subjects-title">
          <h2 id="ol-subjects-title" className="tp-h2">{titled(['Усі 24', 'предмети'])}</h2>
          <div className="er-body">
            <p className="er-lead">
              Перелік і класи — за {ext(ORDER.url, `наказом МОН ${ORDER.no} від ${ORDER.date}`)}. Вік поруч
              порахований із класів, щоб було зрозуміло батькам; орієнтуватись варто саме на клас.
            </p>
            {/* Саме таблиця, а не список: 24 рядки на чотири колонки читають і
                скрінрідер, і мовна модель — зі списку зі спанів звʼязок
                «предмет ↔ клас» доводиться відновлювати здогадом. */}
            <table className="ol-table">
              <caption className="ol-table-caption">
                Предмети Всеукраїнських учнівських олімпіад 2026/2027, класи участі та вік
              </caption>
              <thead>
                <tr>
                  <th scope="col">Предмет</th>
                  <th scope="col">Класи</th>
                  <th scope="col">Вік</th>
                  <th scope="col">Державний етап</th>
                </tr>
              </thead>
              <tbody>
                {SUBJECTS.map((s) => (
                  <tr key={s.name}>
                    <th scope="row">{s.name}</th>
                    <td>{s.grades}</td>
                    <td>{s.from}–{s.to} років</td>
                    <td>{s.third ? 'так' : 'немає'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="tp-faq er-section" aria-labelledby="ol-how">
          <h2 id="ol-how" className="tp-h2">{titled(['Як', 'потрапити'])}</h2>
          <div className="er-body">
            <ul className="er-list">
              <li>
                <strong>Скажіть учителеві.</strong> Окремої заявки немає: на І етап учня записує школа,
                зазвичай учитель-предметник. Зробити це треба до початку жовтня.
              </li>
              <li>
                <strong>Можна кілька предметів.</strong> Обмеження ставить не наказ, а розклад: етапи різних
                предметів іноді збігаються в часі.
              </li>
              <li>
                <strong>Участь безкоштовна.</strong> Це державні олімпіади, плати за участь немає.
              </li>
              <li>
                <strong>Далі — за результатом.</strong> На ІІ етап проходять переможці І, на ІІІ — переможці ІІ.
              </li>
            </ul>
          </div>
        </section>

        <section id="ol-open" className="er-open" aria-labelledby="ol-open-title">
          <h2 id="ol-open-title" className="tp-h2">{titled(['Олімпіади', 'в каталозі'])}</h2>
          {total > 0 ? (
            <TopicCards items={items.map(slim)} todayIso={todayIso} lang="uk" labels={CARD_LABELS} />
          ) : (
            <p className="tp-note-text">
              Зараз списку немає. Міжнародні олімпіади й інші змагання —
              у підбірці <Link href={topicPath(olympiads)}>«{olympiads.nav}»</Link>.
            </p>
          )}
        </section>

        <section className="tp-note" aria-labelledby="tp-note-title">
          <h2 id="tp-note-title" className="tp-h2">{titled(['Важливо', 'знати'])}</h2>
          <div className="tp-note-body">
            <p className="tp-note-text">
              Dityam.com.ua не проводить олімпіад: ми збираємо їх в одному місці й ведемо на джерело.
              Організатор кожного етапу — школа, громада, область або МОН.
            </p>
            <p className="tp-note-meta">
              Факти звірено {CHECKED} з наказом МОН {ORDER.no} від {ORDER.date} «{ORDER.title}».
            </p>
            <p className="tp-note-meta">
              Побачили помилку —{' '}
              <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer">напишіть у Telegram</a>.
            </p>
          </div>
        </section>

        <section className="tp-faq" aria-labelledby="tp-faq-title">
          <h2 id="tp-faq-title" className="tp-h2">{titled(['Часті', 'питання'])}</h2>
          <div className="tp-faq-list">
            {FAQ.map((f) => (
              <div key={f.q} className="tp-faq-item">
                <h3>{f.q}</h3>
                <p>{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="tp-related" aria-labelledby="tp-related-title">
          <h2 id="tp-related-title" className="tp-h2">{titled(['Інші', 'підбірки'])}</h2>
          <div className="tp-related-grid">
            {related.map(({ topic: t, count }) => (
              <Link key={t.slug} href={topicPath(t)} className="tp-related-card">
                <span className="tp-related-title">{t.nav}</span>
                <span className="tp-related-n">{count} {opportunitiesWord(count)}</span>
              </Link>
            ))}
          </div>
        </section>
      </main>

      <Footer lang="uk" />

      <SupportPopup />
      <StickyBar />
      <SubscribePopup />
    </>
  );
}
