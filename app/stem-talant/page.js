import '@/app/styles/stem-talant.css';
import Footer from '../Footer';
import { TELEGRAM_URL, CHANNEL_CTA } from '@/lib/social';
import { CodeIcon, RobotIcon, AtomIcon } from './Icons';
import PartnerModal from './PartnerModal';
import PressLogos from '../PressLogos';
import SharePosts from './SharePosts';

// «STEM-талант України» — власний конкурс Dityam.com.ua (рішення Марії
// 04–05.10.2026): лише STEM, діти 12–17 років, 3 номінації × 2 вікові групи,
// внесок 100 грн (було 50, змінено 05.10.2026), партнери — IT-компанії. Проводимо на зимових канікулах
// 2026–2027, «щоб у дітей був час» (Марія, 05.10.2026): реєстрація з грудня,
// проєкти — на канікулах, переможці — після канікул.
//
// Вигляд (05.10.2026, третя ітерація): «веселий» дудл-варіант Марія назвала
// «дуже по-дитячому» — тепер темний «технологічний» перший екран з рухомими
// плямами, сіткою й орбітою, плавна поява блоків. «Стати партнером» — по
// центру й одразу відкриває форму (PartnerModal → /api/contact).
//
// Графік (Марія, 05.10.2026): реєстрація 1–20 грудня 2026, проєкти до 4 січня
// 2027, журі 5–9 січня, переможці 10 січня — наприкінці канікул. Внесок
// називаємо «організаційний» (плата за організацію, а не ставка).
// Поки це АНОНС: положення й форма реєстрації зʼявляться разом зі стартом
// реєстрації (ст. 1151 ЦК); партнерів, яких ще немає, не показуємо.

const SITE_URL = 'https://dityam.com.ua';
const PATH = '/stem-talant';
const URL = `${SITE_URL}${PATH}`;

const TITLE = 'STEM-талант України — онлайн-конкурс для школярів 12–17';
const DESCRIPTION = 'Онлайн-конкурс STEM-проєктів для школярів 12–17 років: програмування й ШІ, робототехніка, наука. 1 грудня 2026 – 10 січня 2027, журі з інженерів.';

export const metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: URL },
  openGraph: {
    type: 'website', locale: 'uk_UA', url: URL, siteName: 'Dityam.com.ua',
    title: TITLE, description: DESCRIPTION,
  },
  // Картинка прев'ю — opengraph-image.js / twitter-image.js у цій теці.
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
};

const FACTS = [
  { big: '12–17 років', small: 'дві вікові групи', tone: 'a' },
  { big: 'Зимові канікули', small: '1 грудня 2026 – 10 січня 2027', tone: 'b' },
  { big: 'Онлайн', small: 'з будь-якого міста й країни', tone: 'c' },
  { big: '100 грн', small: 'організаційний внесок', tone: 'd' },
];

const NOMINATIONS = [
  { Icon: CodeIcon, tone: 'a', title: 'Програмування й ШІ', text: 'Застосунки, ігри, боти, сайти й проєкти зі штучним інтелектом.' },
  { Icon: RobotIcon, tone: 'b', title: 'Робототехніка й інженерія', text: 'Роботи, пристрої, 3D-моделі — усе, що зібрано й працює.' },
  { Icon: AtomIcon, tone: 'c', title: 'Наука й математика', text: 'Дослідження, експерименти й математичні розвʼязки.' },
];

const STEPS = [
  ['Реєстрація', '1–20 грудня 2026', 'Онлайн-форма й організаційний внесок 100 грн.'],
  ['Проєкт', 'до 4 січня 2027', 'Працюєте над проєктом на канікулах і надсилаєте опис та посилання на код, відео чи фото.'],
  ['Журі', '5–9 січня 2027', 'Інженери й науковці оцінюють за критеріями з правил конкурсу.'],
  ['Переможці', '10 січня 2027', 'Оголошуємо наприкінці канікул: 6 переможців, дипломи й призи від партнерів.'],
];

// Значки — усі чотири літери STEM: наука (E=mc², H₂O), технології (</>, AI),
// інженерія (3D), математика (π). Марія, 05.10.2026: «а це все асоціюється зі стемом?»
const CHIPS = ['</>', 'E=mc²', 'π', 'H₂O', 'AI', '3D'];


const FAQ = [
  { q: 'Хто організовує конкурс?', a: 'Платформа Dityam.com.ua — вона збирає перевірені можливості для українських дітей 0–18 років в Україні та за кордоном.' },
  { q: 'Хто може взяти участь?', a: 'Школярі 12–17 років з будь-якого міста України й діти з України, які зараз живуть за кордоном. Конкурс проходить онлайн.' },
  { q: 'Коли проходить конкурс?', a: 'На зимових канікулах, щоб у дітей був час на проєкт: реєстрація 1–20 грудня 2026 року, проєкти — до 4 січня 2027, журі — 5–9 січня, переможців оголосимо 10 січня 2027. Повні правила опублікуємо разом зі стартом реєстрації.' },
  { q: 'Скільки коштує участь?', a: 'Організаційний внесок — 100 грн за заявку. Переможців обирає журі за критеріями, а не жеребкування.' },
  { q: 'Як обирають переможців?', a: 'Журі з інженерів і науковців оцінює проєкти в кожній номінації окремо для груп 12–14 і 15–17 років. У кожній групі — один переможець, разом 6.' },
  { q: 'Як компанії стати партнером?', a: 'Натисніть «Стати партнером» на цій сторінці й залиште контакт — ми напишемо з умовами. Партнери — IT-компанії: їхні інженери в журі, а назва й логотип — на сторінці конкурсу й на дипломах.' },
  { q: 'Як допомогти, якщо я не компанія?', a: 'Поділіться сторінкою конкурсу з батьками, вчителями чи друзями — кнопки є вище. Медіа, спільноти й школи можуть стати інформаційними партнерами: натисніть «Стати партнером» і оберіть цей формат.' },
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
        '@type': 'Event',
        '@id': `${URL}#event`,
        name: 'STEM-талант України',
        description: DESCRIPTION,
        url: URL,
        startDate: '2026-12-01',
        endDate: '2027-01-10',
        eventStatus: 'https://schema.org/EventScheduled',
        eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
        location: { '@type': 'VirtualLocation', url: URL },
        organizer: { '@id': `${SITE_URL}/#org` },
        audience: { '@type': 'PeopleAudience', suggestedMinAge: 12, suggestedMaxAge: 17 },
        offers: { '@type': 'Offer', price: '100', priceCurrency: 'UAH', url: URL, validFrom: '2026-12-01' },
        inLanguage: 'uk',
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
          <div className="st-blob st-blob-1" aria-hidden="true" />
          <div className="st-blob st-blob-2" aria-hidden="true" />
          <div className="st-blob st-blob-3" aria-hidden="true" />
          <div className="st-grid" aria-hidden="true" />
          {CHIPS.map((c, i) => (
            <span key={c} className={`st-chip st-chip-${i + 1}`} aria-hidden="true">{c}</span>
          ))}

          <div className="st-wrap st-hero-grid">
            <div className="st-hero-copy">
              <p className="st-kicker st-rise" style={{ '--d': '0ms' }}>
                <span className="st-dot" aria-hidden="true" />
                Анонс · онлайн-конкурс для 12–17 років
              </p>
              <h1 className="st-title st-rise" style={{ '--d': '80ms' }}>
                STEM-талант <span className="st-title-grad">України</span>
              </h1>
              <p className="st-lead st-rise" style={{ '--d': '160ms' }}>
                Код, робот чи дослідження — покажи свою роботу й розкажи, як вона
                влаштована. Журі з інженерів і науковців обере переможців у 3 номінаціях.
              </p>
              <div className="st-actions st-rise" style={{ '--d': '240ms' }}>
                <a href={TELEGRAM_URL} className="st-btn st-btn-yellow" target="_blank" rel="noopener">
                  {CHANNEL_CTA.uk.cta}
                </a>
                <PartnerModal className="st-btn st-btn-ghost" />
              </div>
            </div>

            <div className="st-orbit st-rise" style={{ '--d': '200ms' }} aria-label="На зимових канікулах 2026–2027" role="img">
              <span className="st-ring st-ring-1" aria-hidden="true"><i /></span>
              <span className="st-ring st-ring-2" aria-hidden="true"><i /></span>
              <span className="st-ring st-ring-3" aria-hidden="true"><i /></span>
              <span className="st-core" aria-hidden="true">
                <small>на зимових</small>
                <b>канікулах</b>
                <small>2026–2027</small>
              </span>
            </div>
          </div>
        </section>

        <section className="st-wrap st-facts" aria-label="Коротко про конкурс">
          {FACTS.map((f, i) => (
            <div key={f.big} className={`st-fact st-tone-${f.tone} st-rise`} style={{ '--d': `${320 + i * 70}ms` }}>
              <b>{f.big}</b>
              <span>{f.small}</span>
            </div>
          ))}
        </section>

        <section className="st-wrap st-sec">
          <p className="st-eyebrow st-reveal">3 напрями</p>
          <h2 className="st-h2 st-reveal">Номінації</h2>
          <div className="st-noms">
            {NOMINATIONS.map(({ Icon, tone, title, text }) => (
              <article key={title} className={`st-card st-tone-${tone} st-reveal`}>
                <span className="st-icon"><Icon /></span>
                <h3>{title}</h3>
                <p>{text}</p>
                <div className="st-ages">
                  <span>12–14 років</span>
                  <span>15–17 років</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="st-wrap st-sec">
          <p className="st-eyebrow st-reveal">4 кроки</p>
          <h2 className="st-h2 st-reveal">Як це працює</h2>
          <ol className="st-steps">
            {STEPS.map(([title, date, text], i) => (
              <li key={title} className="st-step st-reveal">
                <span className="st-step-n" aria-hidden="true">{i + 1}</span>
                <p className="st-step-date">{date}</p>
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="partnery" className="st-wrap st-sec st-partners">
          <p className="st-eyebrow st-reveal">Для компаній і медіа</p>
          <h2 className="st-h2 st-reveal">Партнери</h2>
          <p className="st-text st-reveal">
            Шукаємо IT-компанії, яким важливі майбутні інженери: партнер дає призи переможцям,
            його інженери сидять у журі, а назва й логотип — на цій сторінці й на дипломах.
            Медіа, спільноти й школи можуть стати інформаційними партнерами й розповісти
            про конкурс своїй аудиторії.
          </p>
          <div className="st-slots st-reveal">
            <div className="st-slot">
              <b>Генеральний партнер</b>
              <span>IT-компанія · місце відкрите</span>
            </div>
            <div className="st-slot">
              <b>Партнери номінацій</b>
              <span>IT-компанії · 3 місця відкриті</span>
            </div>
            <div className="st-slot">
              <b>Інформаційні партнери</b>
              <span>медіа, спільноти, школи</span>
            </div>
          </div>
          <div className="st-center st-reveal">
            <PartnerModal className="st-btn st-btn-yellow st-btn-big" />
          </div>
        </section>

        <section className="st-wrap st-sec st-press">
          <p className="st-eyebrow st-reveal">Про Dityam.com.ua писали</p>
          <h2 className="st-h2 st-reveal">Нас уже знають</h2>
          <div className="st-reveal"><PressLogos /></div>
        </section>

        <section className="st-wrap st-sec">
          <div className="st-share st-reveal">
            <div className="st-share-copy">
              <h2 className="st-h2">Підтримайте репостом</h2>
              <p className="st-text">
                Не компанія і не медіа? Ви все одно можете допомогти: оберіть готовий текст,
                скопіюйте й поділіться з батьками, вчителями чи друзями, яким цікаві технології.
                Кожен репост — шанс, що про конкурс дізнається ще одна дитина.
              </p>
            </div>
            <SharePosts />
          </div>
        </section>

        <section className="st-wrap st-sec">
          <h2 className="st-h2 st-reveal">Питання й відповіді</h2>
          <div className="st-faq st-reveal">
            {FAQ.map((f) => (
              <details key={f.q} className="st-faq-item">
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="st-wrap st-sec">
          <div className="st-tg st-reveal">
            <div className="st-blob st-blob-tg" aria-hidden="true" />
            <div className="st-tg-copy">
              <h2 className="st-h2">{CHANNEL_CTA.uk.title}</h2>
              <p className="st-text">{CHANNEL_CTA.uk.text} Старт реєстрації оголосимо там першими.</p>
              <a href={TELEGRAM_URL} className="st-btn st-btn-yellow" target="_blank" rel="noopener">
                {CHANNEL_CTA.uk.cta}
              </a>
            </div>
          </div>
        </section>

        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd()) }} />
      </main>
      <Footer />
    </div>
  );
}
