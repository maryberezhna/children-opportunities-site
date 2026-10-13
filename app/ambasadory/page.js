import '@/app/styles/ambasadory.css';
import Footer from '../Footer';
import AmbassadorForm from './AmbassadorForm';

// «Амбасадори Dityam.com.ua» (Марія, 12.10.2026). Хто може бути амбасадором
// і що він отримує — рішення Марії дослівно: батьки й педагоги; 4 вигоди, ні
// більше, ні менше. Без квот і обовʼязків. Нових вигод чи цифр сюди не
// дописувати без її «так».
//
// Заявка йде тим самим шляхом, що й контактна форма: /api/contact з типом
// 'ambassador' → contact_messages → адмінка «Звернення» (/admin/messages) і
// сповіщення в адмін-чат.
//
// Фото — без облич (Марія, 12.10.2026: «фото інші, без обличчя можна»),
// rawpixel, ліцензія CC0 (через Openverse): перший екран — руки, зчеплені в
// коло (openverse ac3fea54-1909-49b2-8ff7-baf0951e20b7); «Батьки» — дитячі
// долоні зіркою (f79e13e1-630c-44e8-8885-b9c729dce304); «Педагоги» — руки
// дітей з олівцями й фарбами (00ceba15-8d6f-4085-9e28-88c83d14e54e).
const SITE_URL = 'https://dityam.com.ua';
const PATH = '/ambasadory';
const URL = `${SITE_URL}${PATH}`;

const TITLE = 'Амбасадори Dityam.com.ua — для батьків і педагогів';
const DESCRIPTION = 'Станьте амбасадором Dityam.com.ua: розповідайте батькам, колегам і учням про можливості для дітей. Що ви отримаєте і як подати заявку.';
// Прев'ю для соцмереж — той самий знімок, кадр 1200×630 (public/ambasadory/og.jpg).
const OG_IMAGE = { url: `${SITE_URL}/ambasadory/og.jpg`, width: 1200, height: 630, alt: 'Руки людей, зчеплені в коло' };

export const metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: URL },
  openGraph: {
    type: 'website', locale: 'uk_UA', url: URL, siteName: 'Dityam.com.ua',
    title: TITLE, description: DESCRIPTION, images: [OG_IMAGE],
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: [OG_IMAGE.url] },
};

const WHO = [
  {
    title: 'Батьки',
    text: 'Мами й тата, які діляться корисним у батьківських чатах і з друзями.',
    photo: '/ambasadory/batky',
    alt: 'Дитячі долоні, складені зіркою на траві',
  },
  {
    title: 'Педагоги',
    text: 'Вчителі, вихователі й керівники гуртків, які розповідають про можливості учням і колегам.',
    photo: '/ambasadory/pedahohy',
    alt: 'Руки дітей за столом з олівцями й фарбами',
  },
];

// Чотири вигоди — рішення Марії 12.10.2026, дослівно за змістом.
// Сценарії «що роблять амбасадори» (Марія: «наведи декілька сценаріїв»).
// Лише те, що на сайті справді є: канал із дедлайнами, олімпіада, форма
// «Запропонувати можливість», звернення.
const CASES = [
  { who: 'Мама в чаті класу', text: 'Раз на тиждень пересилає в батьківський чат дедлайни з нашого Telegram-каналу — і ніхто з класу не пропускає конкурс.' },
  { who: 'Вчителька початкових класів', text: 'Дає учням посилання на нашу онлайн-олімпіаду з логіки й розповідає про конкурси на класній годині.' },
  { who: 'Керівник гуртка', text: 'Знаходить на Dityam.com.ua конкурс за напрямом гуртка й підказує вихованцям, як подати заявку.' },
  { who: 'Тато з Дніпра', text: 'Помітив місцевий табір чи конкурс, якого ще немає на сайті, — надсилає нам, і ми додаємо його для всіх.' },
  { who: 'Будь-хто з амбасадорів', text: 'Розповідає, чого бракує батькам і що незрозуміло на сайті, — і ми змінюємо Dityam.com.ua разом.' },
];

// Шапочка кольором, як у карток можливостей (Марія, 12.10.2026: «зроби це
// шапочкою різними кольорами як наші можливості»), — ті самі тони, що в
// lib/card-tone.js. «Подарунки від партнерів» — дослівно Марія.
const BENEFITS = [
  { title: 'Першими дізнаєтесь про наші олімпіади й конкурси', tone: 'compete' },
  { title: 'Згадка на сайті', note: 'Імʼя та місто на сторінці амбасадорів — лише за вашою згодою.', tone: 'learn' },
  { title: 'Сертифікат і подяка від Dityam.com.ua', tone: 'money' },
  { title: 'Dityam+ безкоштовно', tone: 'event' },
  { title: 'Подарунки від партнерів', tone: 'grow' },
];

const JSON_LD = {
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
      primaryImageOfPage: { '@type': 'ImageObject', url: `${SITE_URL}/ambasadory/hero.jpg`, width: 945, height: 882 },
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Головна', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'Амбасадори', item: URL },
      ],
    },
  ],
};

export default function AmbassadorsPage() {
  return (
    <div className="v2-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
      <main className="v2-container amb-page">
        <section className="v2-hero amb-hero">
          <div className="v2-hero-copy amb-hero-copy">
            <div className="v2-hero-status">
              <span className="v2-dot" aria-hidden="true" />
              Для батьків і педагогів
            </div>
            <h1>
              Станьте <span className="v2-script">амбасадором</span> Dityam.com.ua
            </h1>
            <p className="v2-hero-sub amb-sub">
              Допоможіть більшій кількості дітей знайти свої можливості:
              розповідайте про Dityam.com.ua батькам, колегам і учням і допомагайте додавати нові можливості на сайт.
            </p>
            <div className="amb-actions">
              <a href="#zayavka" className="v2-btn-dark amb-btn">Стати амбасадором</a>
            </div>
          </div>
          <picture className="amb-hero-photo">
            <source srcSet="/ambasadory/hero.webp" type="image/webp" />
            <img
              src="/ambasadory/hero.jpg"
              alt="Руки людей, зчеплені в коло"
              width="945"
              height="882"
              fetchPriority="high"
              decoding="async"
            />
          </picture>
        </section>

        {/* Ціль і роль — слова Марії дослівно (12.10.2026), правлено лише правопис. */}
        <section className="amb-section amb-goal" aria-labelledby="amb-goal">
          <h2 id="amb-goal">Наша ціль</h2>
          <p className="amb-goal-lead">Створювати кращий світ для наших дітей у такий складний час.</p>
          <div className="amb-goal-role">
            <p>Амбасадори можуть прямо впливати на наш проєкт:</p>
            <ul>
              <li>брати участь у розробці нових ідей;</li>
              <li>ділитися зворотним звʼязком;</li>
              <li>тримати руку на пульсі нових можливостей;</li>
              <li>впливати на розвиток самої платформи — які можливості є на Dityam.com.ua;</li>
              <li>допомагати додавати нові можливості на сайт.</li>
            </ul>
            <p>Це дуже крута й освітньо орієнтована роль на забезпечення сталого розвитку дитини.</p>
          </div>
        </section>

        <section className="amb-section" aria-labelledby="amb-who">
          <h2 id="amb-who">Хто може стати амбасадором</h2>
          <ul className="amb-who">
            {WHO.map((w) => (
              <li key={w.title} className="amb-who-card">
                <picture className="amb-who-photo">
                  <source srcSet={`${w.photo}.webp`} type="image/webp" />
                  <img src={`${w.photo}.jpg`} alt={w.alt} width="900" height="600" loading="lazy" decoding="async" />
                </picture>
                <div className="amb-who-text">
                  <h3>{w.title}</h3>
                  <p>{w.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="amb-section" aria-labelledby="amb-cases">
          <h2 id="amb-cases">Що роблять амбасадори</h2>
          <ul className="amb-cases">
            {CASES.map((c) => (
              <li key={c.who} className="amb-case">
                <span className="amb-case-who">{c.who}</span>
                <p>{c.text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="amb-section" aria-labelledby="amb-get">
          <h2 id="amb-get">Що ви отримаєте</h2>
          <ol className="amb-benefits">
            {BENEFITS.map((b, i) => (
              <li key={b.title} className="amb-benefit" data-tone={b.tone}>
                <span className="amb-benefit-n" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                <div className="amb-benefit-body">
                  <h3>{b.title}</h3>
                  {b.note && <p>{b.note}</p>}
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="amb-section amb-apply" id="zayavka" aria-labelledby="amb-how">
          <div className="amb-apply-head">
            <h2 id="amb-how">Як стати амбасадором</h2>
            <p className="amb-intro">
              Заповніть коротку форму.
            </p>
            {/* Що робить амбасадор (Марія, 13.10.2026): без жодних зобовʼязань у тексті; не лише розповідає, а й допомагає додавати можливості й впливає на розвиток платформи. */}
            <div className="amb-does">
              <h3>Що робить амбасадор</h3>
              <p>
                Розповідає батькам, колегам і учням про можливості для дітей на
                Dityam.com.ua, допомагає додавати нові можливості на сайт і впливає
                на розвиток самої платформи — які можливості ми шукаємо й показуємо.
              </p>
            </div>
          </div>
          <AmbassadorForm />
        </section>
      </main>
      <Footer />
    </div>
  );
}
