import Link from 'next/link';
import { supabase, publicOpportunities, fetchAllRows, rowsOrThrow, CARD_FIELDS } from '@/lib/supabase';
import { TOPICS, topicPath, collectionsPath } from '@/lib/topics';
import { opportunitiesWord, freeWord } from '@/lib/plural';
import { kyivToday } from '@/lib/dates';
import { whenRank } from '@/lib/timing';
import { isLive } from '@/lib/audience';
import { ERASMUS_PATH, isErasmus } from '@/lib/erasmus';
import TopicCards from '../topic/TopicCards';
import ShareButton from '../topic/ShareButton';
import StickyBar from '../StickyBar';
import SubscribePopup from '../SubscribePopup';
import SupportPopup from '../SupportPopup';
import Footer from '../Footer';

/**
 * Путівник «Обміни Erasmus+ для підлітків з України» (вересень 2026).
 *
 * Рамка — шаблон підбірок (класи tp-* з topic-v2.css): крихти, хіро з фото,
 * живий список карток, «Важливо знати», «Часті питання», «Інші підбірки».
 * Між хіро й картками — сам путівник.
 *
 * Факти звірено 17.09.2026 з Programme Guide Erasmus+ 2026 (версія 1 від
 * 12.11.2025), European Solidarity Corps Guide 2026, youth.europa.eu,
 * erasmusplus.org.ua, home-affairs.ec.europa.eu і повідомленням Єврокомісії
 * від 12.05.2026. Свідомо НЕ пишемо:
 * - «обмін безкоштовний» — Programme Guide дозволяє дуже низький внесок
 *   учасника (хоч European Youth Portal пише «without having to pay»);
 * - «грант покриває проживання й харчування» — у Guide лише «subsistence»;
 * - суми з сайту Нацофісу — вони застарілі (100 € замість 125 €);
 * - правила виїзду дітей і юнаків з України — не перевірено, лише посилання
 *   на ДПСУ.
 * Україна досі «третя країна, не асоційована з програмою». Коли асоціацію
 * підпишуть, розділ «Що доступно з України» треба переписати.
 */

const SITE_URL = 'https://dityam.com.ua';
const TELEGRAM_URL = 'https://t.me/dityam_com_ua';
const URL = `${SITE_URL}${ERASMUS_PATH}`;
const CHECKED = '17 вересня 2026 року';

const TITLE = 'Обміни Erasmus+ для підлітків з України: як поїхати';
const DESCRIPTION =
  'Молодіжні обміни Erasmus+ для 13–30 років: хто з України може поїхати, скільки це коштує, як подати заявку і які набори відкриті зараз.';
const HERO = { src: '/topic-obmin', alt: 'Велика група усміхнених підлітків фотографується разом' };

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

const SOURCES = {
  guide: 'https://erasmus-plus.ec.europa.eu/programme-guide/part-b/key-action-1/youth-exchanges',
  portal: 'https://youth.europa.eu/go-abroad/school-and-youth-exchanges/erasmus-youth-exchanges-all-you-need-know_en',
  neo: 'https://erasmusplus.org.ua/opportunities/mozhlyvosti-dlya-indyvidualnyh-osib/molodi/',
  association: 'https://ec.europa.eu/commission/presscorner/detail/en/mex_26_1063',
  visaFree: 'https://home-affairs.ec.europa.eu/policies/international-affairs/engagement-partner-countries/eastern-partnership/visa-liberalisation-moldova-ukraine-georgia-and-armenia_en',
  ees: 'https://home-affairs.ec.europa.eu/policies/schengen/smart-borders/entry-exit-system_en',
  dpsu: 'https://dpsu.gov.ua',
};

const FACTS = [
  { label: 'Вік', value: '13–30 років', note: 'на день початку обміну' },
  { label: 'Тривалість', value: '5–21 день', note: 'без днів дороги' },
  { label: 'Група', value: '16–60 учасників', note: 'з кожної країни щонайменше 4 і лідер від 18 років' },
  { label: 'Гроші', value: 'Грант Erasmus+', note: 'отримує організація; внесок учасника, якщо є, — дуже низький' },
];

const CAN = [
  { t: 'Молодіжні обміни', a: '13⁠–⁠30 років.', d: 'Українська організація може бути відправною або приймаючою, а заявку на грант подає партнер з ЄС чи асоційованої країни.' },
  { t: 'Проєкти молодіжної участі', a: '13⁠–⁠30 років.', d: 'Українська організація чи неформальна група молоді може бути партнером проєкту.' },
  { t: 'Віртуальні обміни Erasmus+', a: '13⁠–⁠30 років, онлайн.', d: 'Для учасників до 18 років організація заздалегідь отримує дозвіл батьків.' },
  { t: 'eTwinning', a: 'Онлайн-проєкти шкіл.', d: 'Україна бере участь: реєструються вчителі, а учні долучаються через проєкти свого вчителя.' },
  { t: 'Європейський корпус солідарності', a: 'З 18 років.', d: 'Волонтерство для 18–30 років. Зареєструватися на порталі можна з 17.' },
];

const CANNOT = [
  { t: 'Шкільні обміни Erasmus+', d: 'Лише для шкіл з ЄС і асоційованих країн, тож школа в Україні подати проєкт не може. Учасники мають навчатися в школі, яка їх відправляє.' },
  { t: 'DiscoverEU', d: 'Подорож Європою для 18-річних громадян і резидентів ЄС та асоційованих країн, тож жителі України не підходять. Наступний набір — 1–15 жовтня 2026 року для народжених у 2008 році.' },
  { t: 'Обміни студентів вишів', d: 'Лише для тих, хто вже навчається у виші. Самостійно податися не можна: учасників відбирає виш.' },
];

const STEPS = [
  {
    t: 'Знайдіть набір',
    d: 'Особисто подати заявку на грант Erasmus+ не можна. Кожен обмін — це проєкт щонайменше двох організацій з різних країн, і учасників набирають вони. Відкриті набори, які ми знайшли, зібрані нижче на цій сторінці. Національний Erasmus+ офіс в Україні радить також стежити за оголошеннями Інформаційного центру «Еразмус+ молодь та Європейський корпус солідарності в Україні» та Євродеску.',
  },
  {
    t: 'Подайте заявку організації',
    d: 'Анкету, дати, країну, компенсацію дороги й розмір внеску, якщо він є, вказує в оголошенні організація, яка набирає групу.',
  },
  {
    t: 'До 18 років — згода батьків',
    d: 'Організації зобовʼязані отримати її заздалегідь. У кожній національній групі є лідер віком від 18 років, який відповідає за безпеку й навчання учасників.',
  },
  {
    t: 'Після обміну — Youthpass',
    d: 'Цей сертифікат Erasmus+ описує, чого учасник навчився в проєкті. Отримати його мають право всі учасники.',
  },
];

const FAQ = [
  {
    q: 'Чи може школяр з України поїхати на обмін Erasmus+?',
    a: 'Так, на молодіжний обмін. Брати участь можуть молоді люди 13–30 років, які живуть у країні однієї з організацій проєкту, зокрема в Україні. Обмін триває від 5 до 21 дня без урахування дороги, а для учасників до 18 років організація заздалегідь отримує згоду батьків.',
  },
  {
    q: 'Скільки коштує молодіжний обмін Erasmus+?',
    a: 'Грант Erasmus+ отримує організація: з нього оплачують частину дороги, перебування учасників і програму обміну. Організація може попросити внесок до виїзду, але за правилами програми він має бути дуже низьким і пропорційним гранту, а з молоді зі зменшеними можливостями внески не беруть.',
  },
  {
    q: 'Як подати заявку на Erasmus+ самостійно?',
    a: 'Особисто подати заявку на грант Erasmus+ не можна: обмін проводять щонайменше дві організації з різних країн, і учасників набирають вони. Потрібно знайти оголошення про набір і заповнити анкету організації. Відкриті набори зібрані на сторінці dityam.com.ua/erasmus.',
  },
  {
    q: 'Чи потрібна віза, щоб поїхати на обмін Erasmus+?',
    a: 'Громадянам України з біометричним закордонним паспортом віза для короткої поїздки до Шенгенської зони не потрібна: без візи можна перебувати до 90 днів у будь-якому 180-денному періоді. Дитині потрібен власний паспорт.',
  },
  {
    q: 'Чи можуть школи з України брати участь у шкільних обмінах Erasmus+?',
    a: 'Ні. Шкільні обміни Erasmus+ доступні лише школам з ЄС і асоційованих з програмою країн, а Україна поки не асоційована. Школи з України беруть участь в eTwinning — онлайн-проєктах шкіл, до яких учнів залучає вчитель.',
  },
  {
    q: 'Що таке Youthpass?',
    a: 'Youthpass — сертифікат Erasmus+, який описує, чого учасник навчився в проєкті. Отримати його мають право всі учасники молодіжних обмінів.',
  },
];

// Та сама вибірка, що в підбірках: fetchAllRows кешує її на 60 с, а збій бази
// кидає помилку замість порожнього списку (#263).
async function getRows() {
  if (!supabase) return [];
  return rowsOrThrow(await fetchAllRows(() =>
    publicOpportunities(CARD_FIELDS).order('created_at', { ascending: false }).order('id')), 'erasmus guide');
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

const CARD_LABELS = {
  all: 'Усі',
  sort: 'за дедлайном, найближчі спочатку',
  details: 'Детальніше ↗',
  emptyTitle: 'Нічого не знайдено',
  emptyText: 'Спробуйте інший фільтр.',
  listLabel: 'Відкриті набори Erasmus+',
  filterLabel: 'Фільтр за типом',
};

const titled = ([plain, script]) => (
  <>{plain} <span className="tp-script">{script}</span></>
);

const ext = (href, text) => (
  <a href={href} target="_blank" rel="noopener noreferrer">{text}</a>
);

export default async function ErasmusGuide() {
  const todayIso = kyivToday();
  const rows = await getRows();
  const live = rows.filter((o) => isLive(o, todayIso));
  const items = live.filter(isErasmus)
    .sort((a, b) => {
      const ra = whenRank(a, todayIso);
      const rb = whenRank(b, todayIso);
      if (ra === rb) return 0;
      return ra < rb ? -1 : 1;
    });
  const total = items.length;
  const freeCount = items.filter((o) => o.cost_type === 'free').length;

  const related = ['prohramy-obminu', 'za-kordon']
    .map((slug) => TOPICS[slug])
    .map((t) => ({ topic: t, count: live.filter(t.match).length }));

  const updatedLabel = new Intl.DateTimeFormat('uk-UA', {
    timeZone: 'Europe/Kyiv', day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date());
  const sentence = `Станом на ${updatedLabel} на платформі Dityam.com.ua — ${total} ${opportunitiesWord(total)} Erasmus+`
    + (freeCount > 0 ? `, з них ${freeCount} — ${freeWord(freeCount)}` : '')
    + '. Платформа оновлюється щодня.';

  const exchanges = TOPICS['prohramy-obminu'];
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${URL}#page`,
        url: URL,
        name: 'Обміни Erasmus+ для підлітків з України',
        headline: TITLE,
        description: DESCRIPTION,
        inLanguage: 'uk',
        dateModified: todayIso,
        about: { '@type': 'Thing', name: 'Erasmus+', sameAs: 'https://erasmus-plus.ec.europa.eu' },
        isPartOf: { '@id': `${SITE_URL}/#website` },
        primaryImageOfPage: { '@type': 'ImageObject', url: `${SITE_URL}${HERO.src}.jpg` },
        breadcrumb: { '@id': `${URL}#breadcrumb` },
      },
      {
        '@type': 'ItemList',
        '@id': `${URL}#list`,
        name: 'Відкриті набори Erasmus+',
        numberOfItems: total,
        itemListOrder: 'https://schema.org/ItemListOrderAscending',
        itemListElement: items.map((o, i) => ({
          '@type': 'ListItem', position: i + 1, url: `${SITE_URL}/o/${o.slug}`, name: o.title,
        })),
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${URL}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Головна', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'Підбірки', item: `${SITE_URL}${collectionsPath()}` },
          { '@type': 'ListItem', position: 3, name: exchanges.nav, item: `${SITE_URL}${topicPath(exchanges)}` },
          { '@type': 'ListItem', position: 4, name: 'Erasmus+', item: URL },
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
          <Link href={topicPath(exchanges)}>{exchanges.nav}</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Erasmus+</span>
        </nav>

        <section className="tp-hero" aria-labelledby="tp-title">
          <div className="tp-hero-copy">
            <span className="tp-eyebrow">Путівник · оновлено {updatedLabel}</span>
            <h1 id="tp-title" className="tp-h1">
              Обміни <span className="tp-script">Erasmus+</span> для підлітків з України
            </h1>
            <p className="tp-intro">
              Erasmus+ — програма Європейського Союзу у сфері освіти, навчання, молоді та спорту. Підліток,
              який живе в Україні, може поїхати в ній на молодіжний обмін: від 5 до 21 дня разом з однолітками
              з інших країн. Пояснюємо, хто може поїхати, скільки це коштує і як подати заявку.
            </p>
            <p className="tp-guide-link"><a href="#er-open">Одразу до відкритих наборів ↓</a></p>
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
            {total > 0 ? (
              <p className="tp-hero-count">
                <span className="tp-hero-count-n">{total}</span>
                <span className="tp-hero-count-t">
                  {opportunitiesWord(total)} Erasmus+ зараз
                </span>
              </p>
            ) : null}
          </div>
        </section>

        <section className="tp-faq er-section" aria-labelledby="er-facts">
          <h2 id="er-facts" className="tp-h2">{titled(['Коротко', 'про обміни'])}</h2>
          <div className="er-body">
            <ul className="er-facts">
              {FACTS.map((f) => (
                <li key={f.label} className="er-fact">
                  <span className="er-fact-label">{f.label}</span>
                  <span className="er-fact-value">{f.value}</span>
                  <span className="er-fact-note">{f.note}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="tp-faq er-section" aria-labelledby="er-access">
          <h2 id="er-access" className="tp-h2">{titled(['Що доступно', 'з України'])}</h2>
          <div className="er-body">
            <p className="er-lead">
              Україна поки не асоційована з Erasmus+ і бере участь як «третя країна, не асоційована з програмою».
              Тому частина можливостей відкрита для жителів України, а частина — лише для жителів ЄС і асоційованих
              країн. У травні 2026 року Єврокомісія та Україна {ext(SOURCES.association, 'домовилися')} продовжувати
              підготовку до асоціації, зокрема створити в Україні Національне агентство Erasmus+.
            </p>
            <div className="er-columns">
              <div className="er-col">
                <h3 className="er-col-title">Можна</h3>
                <ul className="er-list is-yes">
                  {CAN.map((x) => (
                    <li key={x.t}><strong>{x.t}.</strong> {x.a} {x.d}</li>
                  ))}
                </ul>
              </div>
              <div className="er-col">
                <h3 className="er-col-title">Поки не можна</h3>
                <ul className="er-list is-no">
                  {CANNOT.map((x) => (
                    <li key={x.t}><strong>{x.t}.</strong> {x.d}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="tp-faq er-section" aria-labelledby="er-how">
          <h2 id="er-how" className="tp-h2">{titled(['Як', 'потрапити'])}</h2>
          <div className="er-body">
            <ol className="er-steps">
              {STEPS.map((s) => (
                <li key={s.t} className="er-step">
                  <h3>{s.t}</h3>
                  <p>{s.d}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="tp-faq er-section" aria-labelledby="er-cost">
          <h2 id="er-cost" className="tp-h2">{titled(['Скільки це', 'коштує'])}</h2>
          <div className="er-body er-prose">
            <p>
              Грант Erasmus+ отримує організація, а не учасник. З нього оплачують частину дороги (сума залежить
              від відстані), перебування учасників і програму обміну. Витрати на візи й медичні довідки можуть
              покриватися повністю.
            </p>
            <p>
              Організація може попросити внесок до виїзду. {ext(SOURCES.guide, 'Правила Erasmus+')} вимагають,
              щоб він був дуже низьким, пропорційним гранту, поясненим учасникам і зібраним не для заробітку.
              З молоді зі зменшеними можливостями внесків не беруть, а сторонні постачальники послуг не можуть
              брати додаткових платежів.
            </p>
            <p>
              Організатори зобовʼязані застрахувати всіх учасників, зокрема від нещасного випадку й серйозної
              хвороби.
            </p>
          </div>
        </section>

        <section className="tp-faq er-section" aria-labelledby="er-docs">
          <h2 id="er-docs" className="tp-h2">{titled(['Документи', 'й кордон'])}</h2>
          <div className="er-body">
            <ul className="er-list">
              <li>
                <strong>Біометричний закордонний паспорт.</strong> З ним громадяни України{' '}
                {ext(SOURCES.visaFree, 'їздять до Шенгенської зони без візи')} — до 90 днів у будь-якому
                180-денному періоді. Дитині потрібен власний паспорт.
              </li>
              <li>
                <strong>Термін дії.</strong> Паспорт має бути дійсним ще щонайменше 3 місяці після запланованого
                виїзду з ЄС і виданим не раніше ніж 10 років тому.
              </li>
              <li>
                <strong>Кордон ЄС.</strong> З 10 квітня 2026 року замість штампів у паспорті дані записують
                в {ext(SOURCES.ees, 'електронну систему вʼїзду/виїзду EES')}. Систему ETIAS ще не запущено.
              </li>
              <li>
                <strong>Виїзд дитини з України.</strong> Правила перетину кордону неповнолітніми перевірте перед
                поїздкою на сайті {ext(SOURCES.dpsu, 'Державної прикордонної служби')}.
              </li>
            </ul>
          </div>
        </section>

        <section className="tp-faq er-section" aria-labelledby="er-fraud">
          <h2 id="er-fraud" className="tp-h2">{titled(['Як не натрапити', 'на шахраїв'])}</h2>
          <div className="er-body">
            <ul className="er-list is-warn">
              <li>Erasmus+ не фінансує обміни, мета яких — заробіток, і такі, які можна вважати туризмом.</li>
              <li>
                Великий «реєстраційний збір» чи оплата посереднику — тривожний знак. Внесок, якщо він є, дуже низький,
                і збирає його сама організація, яка отримала грант.
              </li>
              <li>Запитайте в організаторів, яка організація отримала грант Erasmus+ на цей обмін і з якої вона країни.</li>
              <li>
                Представництво ЄС ще у 2021 році попереджало про фальшиві «стипендії Erasmus+», за які просять реєстраційний внесок:
                програма не вимагає плати за подання заявки.
              </li>
            </ul>
          </div>
        </section>

        <section id="er-open" className="er-open" aria-labelledby="er-open-title">
          <h2 id="er-open-title" className="tp-h2">{titled(['Відкриті набори', 'зараз'])}</h2>
          {total > 0 ? (
            <TopicCards items={items.map(slim)} todayIso={todayIso} lang="uk" labels={CARD_LABELS} />
          ) : (
            <p className="tp-note-text">
              Зараз відкритих наборів Erasmus+ на платформі немає. Нові зʼявляються тут щойно ми їх знаходимо, а інші
              обміни — у підбірці <Link href={topicPath(exchanges)}>«{exchanges.nav}»</Link>.
            </p>
          )}
        </section>

        <section className="tp-note" aria-labelledby="tp-note-title">
          <h2 id="tp-note-title" className="tp-h2">{titled(['Важливо', 'знати'])}</h2>
          <div className="tp-note-body">
            <p className="tp-note-text">
              Dityam.com.ua не організовує обміни: ми збираємо відкриті набори й ведемо на сторінку організатора.
              Умови кожного обміну визначає організація, яка його проводить, тож перевіряйте їх в оголошенні.
            </p>
            <p className="tp-note-meta">
              Факти звірено {CHECKED} з {ext(SOURCES.guide, 'Керівництвом програми Erasmus+ 2026')},{' '}
              {ext(SOURCES.portal, 'Європейським молодіжним порталом')},{' '}
              {ext(SOURCES.neo, 'сайтом Національного Erasmus+ офісу в Україні')} і сторінками Єврокомісії.
            </p>
            <p className="tp-note-meta">{sentence}</p>
            <p className="tp-note-meta">
              Побачили помилку або знаєте про набір, якого тут немає, —{' '}
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
