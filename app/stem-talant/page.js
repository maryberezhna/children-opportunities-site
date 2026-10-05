import '@/app/styles/stem-talant.css';
import Footer from '../Footer';
import TelegramCard from '../TelegramCard';
import { TELEGRAM_URL, CHANNEL_CTA } from '@/lib/social';

// «STEM-талант України» — власний конкурс Dityam.com.ua (рішення Марії
// 04–05.10.2026): лише STEM, діти 12–17 років, 3 номінації × 2 вікові групи,
// внесок 50 грн, січень–лютий 2027, партнери — лише IT-компанії.
//
// Поки це АНОНС: положення, форма й точні дати зʼявляться разом зі стартом
// реєстрації (ст. 1151 ЦК: умови конкурсу оголошуються одночасно з ним). Тому
// на сторінці немає жодної дати з числом і жодного партнера, якого ще немає:
// місця партнерів показані відкритими. Event у JSON-LD не ставимо, доки немає
// дня старту — вигаданий startDate гірший за його відсутність.

const SITE_URL = 'https://dityam.com.ua';
const PATH = '/stem-talant';
const URL = `${SITE_URL}${PATH}`;
const EMAIL = 'hellodityam.com.ua@gmail.com';
const PARTNER_MAIL = `mailto:${EMAIL}?subject=${encodeURIComponent('Партнерство: STEM-талант України')}`;

const TITLE = 'STEM-талант України — онлайн-конкурс для школярів 12–17';
const DESCRIPTION = 'Онлайн-конкурс STEM-проєктів для дітей 12–17 років: програмування й ШІ, робототехніка, наука. Журі з інженерів і науковців. Січень–лютий 2027, участь — 50 грн.';

export const metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: URL },
  openGraph: {
    type: 'website', locale: 'uk_UA', url: URL, siteName: 'Dityam.com.ua',
    title: TITLE, description: DESCRIPTION,
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Dityam.com.ua' }],
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: ['/og-image.png'] },
};

const FACTS = [
  ['12–17 років', <>2 вікові групи: <span className="st-nw">12–14</span> і <span className="st-nw">15–17</span></>],
  ['Січень–лютий 2027', 'реєстрація відкриється в січні'],
  ['Онлайн', 'з будь-якого міста України й з-за кордону'],
  ['50 грн', 'внесок за участь'],
];

const NOMINATIONS = [
  { icon: '💻', title: 'Програмування й ШІ', text: 'Застосунки, ігри, боти, сайти й проєкти зі штучним інтелектом.' },
  { icon: '🤖', title: 'Робототехніка й інженерія', text: 'Роботи, пристрої, 3D-моделі — усе, що зібрано й працює.' },
  { icon: '🔬', title: 'Наука й математика', text: 'Дослідження, експерименти й математичні розвʼязки.' },
];

const STEPS = [
  ['Реєстрація', 'Онлайн-форма й внесок 50 грн. Відкриється в січні 2027 року.'],
  ['Проєкт', 'Опис проєкту й посилання на код, відео чи фото роботи.'],
  ['Журі', 'Інженери й науковці оцінюють за критеріями з правил конкурсу.'],
  ['Переможці', '6 переможців — дипломи й призи від партнерів. Оголосимо в лютому 2027.'],
];

const FAQ = [
  { q: 'Хто організовує конкурс?', a: 'Платформа Dityam.com.ua — вона збирає перевірені можливості для українських дітей 0–18 років в Україні та за кордоном.' },
  { q: 'Хто може взяти участь?', a: 'Школярі 12–17 років з будь-якого міста України й діти з України, які зараз живуть за кордоном. Конкурс проходить онлайн.' },
  { q: 'Скільки коштує участь?', a: 'Внесок — 50 грн за заявку. Переможців обирає журі за критеріями, а не жеребкування.' },
  { q: 'Коли старт?', a: 'Реєстрація відкриється в січні 2027 року, переможців оголосимо в лютому. Повні правила конкурсу опублікуємо разом зі стартом реєстрації.' },
  { q: 'Як обирають переможців?', a: 'Журі з інженерів і науковців оцінює проєкти в кожній номінації окремо для груп 12–14 і 15–17 років. У кожній групі — один переможець, разом 6.' },
  { q: 'Як компанії стати партнером?', a: `Напишіть на ${EMAIL} — у листі вкажіть компанію й номінацію, яка вам цікава. Партнери — IT-компанії: їхні інженери в журі, а назва й логотип — на сторінці конкурсу й на дипломах.` },
];

function jsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${URL}#page`,
        url: URL,
        name: TITLE,
        description: DESCRIPTION,
        inLanguage: 'uk',
        isPartOf: { '@id': `${SITE_URL}/#website` },
        publisher: { '@id': `${SITE_URL}/#org` },
      },
      {
        '@type': 'FAQPage',
        '@id': `${URL}#faq`,
        mainEntity: FAQ.map((f) => ({
          '@type': 'Question', name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Головна', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'STEM-талант України', item: URL },
        ],
      },
    ],
  };
}

export default function StemTalantPage() {
  return (
    <div className="v2-page st-page">
      <main>
        <section className="st-hero">
          <div className="st-wrap st-hero-grid">
            <div className="st-hero-copy">
              <p className="st-pill">Анонс · онлайн-конкурс для 12–17 років</p>
              <h1 className="st-h1">STEM-талант України</h1>
              <p className="st-lead">
                Покажи свій проєкт — код, робота чи дослідження — і розкажи, як його
                зробив. Журі з інженерів і науковців обере переможців у 3 номінаціях.
              </p>
              <div className="st-actions">
                <a href={TELEGRAM_URL} className="st-btn st-btn-accent" target="_blank" rel="noopener">
                  {CHANNEL_CTA.uk.cta}
                </a>
                <a href="#partnery" className="st-btn st-btn-ghost">Стати партнером</a>
              </div>
              <p className="st-hero-note">Старт реєстрації оголосимо в Telegram-каналі Dityam.com.ua.</p>
            </div>
            <div className="st-bubble" aria-label="Старт — січень 2027">
              <span className="st-bubble-top">Старт</span>
              <span className="st-bubble-main">січень</span>
              <span className="st-bubble-top">2027</span>
            </div>
          </div>
        </section>

        <section className="st-wrap st-facts" aria-label="Коротко про конкурс">
          {FACTS.map(([big, small]) => (
            <div key={big} className="st-fact">
              <b>{big}</b>
              <span>{small}</span>
            </div>
          ))}
        </section>

        <section className="st-wrap st-sec">
          <h2 className="st-h2">Номінації</h2>
          <div className="st-noms">
            {NOMINATIONS.map((n) => (
              <article key={n.title} className="st-card">
                <span className="st-icon" aria-hidden="true">{n.icon}</span>
                <h3>{n.title}</h3>
                <p>{n.text}</p>
                <p className="st-card-note">12–14 і 15–17 років</p>
              </article>
            ))}
          </div>
        </section>

        <section className="st-wrap st-sec">
          <h2 className="st-h2">Як це працює</h2>
          <ol className="st-steps">
            {STEPS.map(([title, text], i) => (
              <li key={title} className="st-step">
                <span className="st-step-n" aria-hidden="true">{i + 1}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="partnery" className="st-band">
          <div className="st-wrap">
            <h2 className="st-h2">Партнери</h2>
            <p className="st-band-lead">
              Шукаємо IT-компанії, яким важливі майбутні інженери. Партнер дає призи
              переможцям, його інженери сидять у журі, а назва й логотип — на цій сторінці
              й на дипломах.
            </p>
            <div className="st-partner-row">
              <span className="st-tag st-tag-main">Генеральний партнер</span>
              <span className="st-slot">Місце відкрите</span>
            </div>
            <div className="st-partner-row">
              <span className="st-tag">Партнери номінацій</span>
              {NOMINATIONS.map((n) => (
                <span key={n.title} className="st-slot">{n.title} — місце відкрите</span>
              ))}
            </div>
            <a href={PARTNER_MAIL} className="st-btn st-btn-accent">Стати партнером</a>
          </div>
        </section>

        <section className="st-wrap st-sec">
          <h2 className="st-h2">Питання й відповіді</h2>
          <div className="st-faq">
            {FAQ.map((f) => (
              <details key={f.q} className="st-faq-item">
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="st-wrap st-sec">
          <TelegramCard lang="uk" place="topic" hub="stem-talant" variant="panel" />
        </section>

        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd()) }} />
      </main>
      <Footer />
    </div>
  );
}
