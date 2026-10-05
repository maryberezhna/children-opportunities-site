import '@/app/styles/olimpiada.css';
import Footer from '../Footer';
import { OLIMP, OLIMP_OPEN, LEVELS, PRIZES, OPEN_TASK, monthKey, monthName } from '@/lib/olimpiada';
import { TELEGRAM_URL } from '@/lib/social';
import EntryForm from './EntryForm';
import FaqTabs from './FaqTabs';
import { MonsterPink, MonsterYellow, MonsterBlue, Rocket, Planet, Star, Wave, PrizeAstronaut, PrizeMicrobit, PrizePen } from './Doodles';

// Онлайн-олімпіада Dityam.com.ua — пілот (рішення Марії 05.10.2026): одна
// група 9–11 років, логіка, 30 завдань за 40 хвилин, організаційний внесок
// 150 грн (Марія: «орг внесок, який не повертається» — після початку тесту). Кожен
// учасник одразу отримує диплом і місяць Dityam+; щомісяця — призи за
// найкращі відповіді на відкрите завдання (обирає журі, не жереб).
// Дизайн — за референсом Марії noospherespace.art: мальований заголовок із
// монстриками замість «О», сині секції з хвилястим краєм і зірками, жовті
// рукописні заголовки (Caveat), питання вкладками в мальованій рамці.
// Цифри й призи — з lib/olimpiada.js, щоб сторінка, тест і правила не розійшлись.
const SITE_URL = 'https://dityam.com.ua';
const PATH = '/olimpiada';
const URL = `${SITE_URL}${PATH}`;
const EMAIL = 'hellodityam.com.ua@gmail.com';

const TITLE = 'Онлайн-олімпіада з логіки для дітей 9–11 років — Dityam.com.ua';
const DESCRIPTION = `Онлайн-олімпіада з логіки для дітей ${OLIMP.groupLabel}: ${OLIMP.questionCount} завдань за ${OLIMP.minutes} хвилин у зручний час. Диплом одразу, місяць Dityam+ кожному, призи щомісяця. Внесок ${OLIMP.price} грн.`;

// Місяць конкурсу в текстах оновлюється сам.
export const revalidate = 3600;

export const metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: URL },
  // До запуску (OLIMP_OPEN) сторінку не індексуємо: оплата ще закрита.
  ...(OLIMP_OPEN ? {} : { robots: { index: false, follow: false } }),
  openGraph: {
    type: 'website', locale: 'uk_UA', url: URL, siteName: 'Dityam.com.ua',
    title: TITLE, description: DESCRIPTION,
  },
  // Картинка прев'ю — opengraph-image.js / twitter-image.js у цій теці.
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
};

const FACTS = [
  { big: OLIMP.groupLabel, small: 'вік учасників' },
  { big: `${OLIMP.questionCount} завдань`, small: 'з варіантами відповідей' },
  { big: `${OLIMP.minutes} хвилин`, small: '1 спроба, у зручний час' },
  { big: `${OLIMP.price} грн`, small: 'організаційний внесок' },
];

const GETS = [
  { title: 'Диплом одразу', text: 'З іменем дитини, балами й рівнем. Готовий, щойно дитина завершила тест: можна зберегти, надрукувати чи отримати в Telegram.' },
  { title: `Dityam+ на ${OLIMP.giftDays} днів`, text: 'Особиста добірка можливостей у Telegram під вік та інтереси дитини й нагадування про дедлайни.' },
  { title: 'Шанс на приз місяця', text: 'Останнє завдання олімпіади — відкрите. Саме воно вирішує, хто отримає приз місяця: журі обирає 3 найкращі відповіді.' },
];

const STEPS = [
  ['Заявка й оплата', `Вкажіть імʼя дитини для диплома та свій email, сплатіть організаційний внесок ${OLIMP.price} грн карткою. На email прийде запрошення до тесту.`],
  ['Тест', `Протягом ${OLIMP.accessHours} годин після оплати дитина проходить тест сама: ${OLIMP.questionCount} завдань, ${OLIMP.minutes} хвилин, 1 спроба. З компʼютера чи телефона.`],
  ['Диплом', 'Результат і диплом зʼявляються на екрані одразу після тесту.'],
  ['Останнє завдання', 'Відкрите й без таймера: придумати власну логічну задачу. Воно вирішує, хто отримає приз місяця.'],
];

const PRIZE_ART = { astronaut: PrizeAstronaut, microbit: PrizeMicrobit, pen: PrizePen };

// Зразки — не з тесту: показують рівень, а не відповіді. Беремо середнє й
// складне завдання: найлегші (ряд 3, 6, 9… чи «хто наймолодший») для 9–11
// років виглядають як тест для першокласників (Марія, 05.10.2026).
const SAMPLES = [
  { q: 'Щоб розпиляти колоду на 2 частини, потрібно 2 хвилини. Скільки хвилин піде, щоб розпиляти її на 4 частини?', options: ['4', '6', '8', '10'], answer: '6' },
  { q: 'Хтось із 3 друзів зʼїв останню цукерку. Андрій каже: «Це не я». Богдан каже: «Це Андрій». Василь каже: «Це не я». Правду сказав лише 1 з них. Хто зʼїв цукерку?', options: ['Андрій', 'Богдан', 'Василь', 'неможливо визначити'], answer: 'Василь' },
];

const levelRange = (i) => {
  const top = i === 0 ? OLIMP.questionCount : LEVELS[i - 1].min - 1;
  return LEVELS[i].min === 0 ? `до ${top} балів` : `${LEVELS[i].min}–${top} балів`;
};

function faq(month) {
  return [
    { q: 'Для кого ця олімпіада?', a: `Для дітей ${OLIMP.groupLabel} з будь-якого міста України й для дітей з України, які живуть за кордоном. Завдання — на логіку й кмітливість, шкільна програма не потрібна.` },
    { q: 'Скільки коштує участь і що в неї входить?', a: `Організаційний внесок — ${OLIMP.price} грн. У нього входить тест, диплом з результатом і ${OLIMP.giftDays} днів Dityam+.` },
    { q: 'Коли можна проходити тест?', a: `У зручний час протягом ${OLIMP.accessHours} годин після оплати: посилання на тест прийде на ваш email. Від натискання «Почати» дитина має ${OLIMP.minutes} хвилин і 1 спробу.` },
    { q: 'Коли ми отримаємо диплом?', a: 'Одразу після завершення тесту — на екрані. Його можна завантажити, надрукувати або отримати в Telegram.' },
    { q: 'Чи можна замовити доставку диплома?', a: `Так, за додаткові ${OLIMP.printPrice} грн. Після тесту на сторінці з результатом вкажіть отримувача й відділення Нової пошти — надішлемо друкований диплом. Доставка — по Україні.` },
    { q: 'Як визначається рівень диплома?', a: `За кількістю правильних відповідей: золотий рівень — від ${LEVELS[0].min} балів із ${OLIMP.questionCount}, срібний — від ${LEVELS[1].min}, бронзовий — від ${LEVELS[2].min}. Решта учасників отримують диплом учасника.` },
    { q: 'Як обирають переможців місяця?', a: `За останнім, відкритим завданням олімпіади. Журі Dityam.com.ua читає відповіді, надіслані протягом місяця, і обирає 3 найкращі за критеріями: ${OPEN_TASK.criteria.join(', ')}. Жеребкування немає. Переможців за ${month} оголосимо до 7-го числа наступного місяця.` },
    { q: 'Чи повертається внесок?', a: `На проходження тесту є ${OLIMP.accessHours} години після оплати. Якщо за цей час дитина ще не починала тест, внесок можна повернути: напишіть на ${EMAIL}. Після початку тесту або коли ${OLIMP.accessHours} години минули, внесок не повертається.` },
    { q: 'Хто організатор?', a: 'Платформа Dityam.com.ua, ФОП Шутяк Марія Олександрівна. Це незалежна онлайн-олімпіада: вона не є учнівською олімпіадою МОН і не дає пільг при вступі.' },
  ];
}

function jsonLd(FAQ) {
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
        '@type': 'Service',
        '@id': `${URL}#service`,
        name: 'Онлайн-олімпіада з логіки Dityam.com.ua',
        description: DESCRIPTION,
        url: URL,
        provider: { '@id': `${SITE_URL}/#org` },
        audience: { '@type': 'PeopleAudience', suggestedMinAge: OLIMP.ageMin, suggestedMaxAge: OLIMP.ageMax },
        offers: { '@type': 'Offer', price: String(OLIMP.price), priceCurrency: 'UAH', url: URL, availability: 'https://schema.org/InStock' },
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
          { '@type': 'ListItem', position: 2, name: 'Онлайн-олімпіада з логіки', item: URL },
        ],
      },
    ],
  };
}

export default function OlimpiadaPage() {
  const key = monthKey();
  const month = monthName(key);
  const FAQ = faq(month);
  return (
    <div className="v2-page ol-page">
      <main>
        <section className="ol-hero">
          <div className="ol-wrap">
            <h1 className="ol-mega" aria-label={`Олімпіада з логіки для дітей ${OLIMP.groupLabel}`}>
              <span className="ol-mega-row" aria-hidden="true"><MonsterPink className="ol-mega-o" />лімпіада</span>
              <span className="ol-mega-row" aria-hidden="true">з л<MonsterYellow className="ol-mega-o" />гіки</span>
            </h1>
            <div className="ol-hero-grid">
              <div>
                <p className="ol-hand ol-hand-blue">від Dityam.com.ua · онлайн, для дітей {OLIMP.groupLabel}</p>
                <p className="ol-lead">
                  {OLIMP.questionCount} завдань на кмітливість за {OLIMP.minutes} хвилин — у зручний час протягом {OLIMP.accessHours} годин після оплати.
                  Диплом з результатом зʼявляється одразу після тесту, а разом із ним {OLIMP.giftDays} днів Dityam+.
                </p>
                <div className="ol-actions">
                  <a href="#uchast" className="ol-btn ol-btn-main">{OLIMP_OPEN ? `Взяти участь · ${OLIMP.price} грн` : 'Реєстрація скоро'}</a>
                  <a href="#yak" className="ol-btn ol-btn-ghost">Як це працює</a>
                </div>
              </div>
              <div className="ol-badge">
                <b>{OLIMP.questionCount}</b>
                <span>завдань<br />за {OLIMP.minutes} хвилин</span>
              </div>
            </div>
          </div>
          <Star className="ol-doodle ol-star-1" />
          <Star className="ol-doodle ol-star-2" />
        </section>

        <section className="ol-space">
          <Wave className="ol-wave" />
          <Rocket className="ol-doodle ol-rocket" />
          <div className="ol-wrap">
            <h2 className="ol-hand">Що отримує кожен учасник</h2>
            <div className="ol-cards">
              {GETS.map((g, i) => (
                <article key={g.title} className="ol-card">
                  <span className="ol-num" aria-hidden="true">{i + 1}</span>
                  <h3>{g.title}</h3>
                  <p>{g.text}</p>
                </article>
              ))}
            </div>

            <h2 id="yak" className="ol-hand ol-hand-gap">Як це працює</h2>
            {/* Короткі цифри — тут, а не в першому екрані: там їх було забагато (Марія, 05.10.2026) */}
            <ul className="ol-facts">
              {FACTS.map((f) => (
                <li key={f.big}><b>{f.big}</b><span>{f.small}</span></li>
              ))}
            </ul>
            <ol className="ol-steps">
              {STEPS.map(([title, text], i) => (
                <li key={title}>
                  <span className="ol-step-n" aria-hidden="true">{i + 1}</span>
                  <div><b>{title}</b><p>{text}</p></div>
                </li>
              ))}
            </ol>
          </div>
          <Planet className="ol-doodle ol-planet" />
          <Wave className="ol-wave ol-wave-bottom" flip />
        </section>

        <section className="ol-wrap ol-sec">
          <h2 className="ol-hand ol-hand-blue">Які бувають завдання</h2>
          <p className="ol-text">На логіку й кмітливість, без шкільних формул. Ось 2 зразки — у самому тесті завдання інші.</p>
          <div className="ol-samples">
            {SAMPLES.map((s) => (
              <article key={s.q} className="ol-sample">
                <p className="ol-sample-q">{s.q}</p>
                <ul>
                  {s.options.map((o) => (
                    <li key={o} className={o === s.answer ? 'is-right' : ''}>{o}{o === s.answer ? ' — правильно' : ''}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          <h2 className="ol-hand ol-hand-blue ol-hand-gap">Диплом, який хочеться повісити на стіну</h2>
          <p className="ol-text">З іменем дитини, медаллю й результатом. Готовий одразу після тесту: рівень залежить лише від її балів.</p>
          {/* Зразки малює той самий маршрут, що й справжні дипломи (?sample=…),
              тож на сторінці — рівно те, що отримає дитина. */}
          <ul className="ol-dips">
            {LEVELS.map((l, i) => (
              <li key={l.key} className={`ol-dip ol-dip-${l.key}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/olimpiada/diploma?sample=${l.key}`} width={877} height={620} loading="lazy" alt={`Зразок диплома: ${l.label.toLowerCase()}`} />
                <b>{l.label}</b>
                <span>{levelRange(i)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="ol-space ol-space-2">
          <Wave className="ol-wave" />
          <div className="ol-wrap">
            <h2 className="ol-hand">Призи місяця: {month}</h2>
            <p className="ol-text ol-text-light">
              Останнє завдання олімпіади — відкрите: «{OPEN_TASK.title}». Воно прямо впливає на приз місяця:
              журі Dityam.com.ua обирає 3 найкращі відповіді за критеріями: {OPEN_TASK.criteria.join(', ')}.
            </p>
            <ul className="ol-prizes">
              {PRIZES.map((p) => {
                const Art = PRIZE_ART[p.art];
                return (
                  <li key={p.place} className="ol-prize-card">
                    <span className="ol-pill">{p.place} місце</span>
                    <span className="ol-prize-art">{Art ? <Art /> : null}</span>
                    <b>{p.title}</b>
                    <span className="ol-prize-note">{p.note}</span>
                  </li>
                );
              })}
            </ul>
            <p className="ol-note ol-note-light">Переможців оголошуємо до 7-го числа наступного місяця в Telegram-каналі й на цій сторінці. Малюнки — ілюстрації, не фото товарів.</p>

            <div id="uchast" className="ol-frame">
              <MonsterBlue className="ol-doodle ol-frame-monster" />
              <div className="ol-form-box">
                <div className="ol-form-copy">
                  <h2 className="ol-hand ol-hand-blue">Взяти участь</h2>
                  <p className="ol-text">
                    На вказаний email прийде запрошення до тесту. Пройти його можна в зручний час
                    протягом {OLIMP.accessHours} годин після оплати: {OLIMP.minutes} хвилин підуть лише після натискання «Почати».
                  </p>
                  <ul className="ol-ticks">
                    <li>організаційний внесок {OLIMP.price} грн: тест, диплом і {OLIMP.giftDays} днів Dityam+</li>
                    <li>оплата карткою через WayForPay</li>
                    <li>на проходження є {OLIMP.accessHours} години після оплати</li>
                  </ul>
                  <p className="ol-note ol-note-form">Після початку тесту або через {OLIMP.accessHours} години після оплати внесок не повертається.</p>
                </div>
                <EntryForm price={OLIMP.price} ages={[9, 10, 11]} open={OLIMP_OPEN} channelUrl={TELEGRAM_URL} />
              </div>
            </div>

            <h2 className="ol-hand ol-hand-gap">Питання й відповіді</h2>
            <div className="ol-frame ol-frame-faq">
              <FaqTabs items={FAQ} />
            </div>
          </div>
          <Wave className="ol-wave ol-wave-bottom" flip />
        </section>

        <section className="ol-wrap ol-sec">
          {/* Правила — довідковий текст: згорнуті, щоб сторінка (особливо на
              телефоні) не закінчувалась стіною дрібного тексту. */}
          <details className="ol-rules-box">
          <summary><h2 className="ol-hand ol-hand-blue">Правила олімпіади</h2><span>показати</span></summary>
          <ol className="ol-rules">
            <li>Організатор — платформа Dityam.com.ua, ФОП Шутяк Марія Олександрівна. Звʼязок: {EMAIL}.</li>
            <li>Учасники — діти {OLIMP.groupLabel}. Заявку подає й оплачує мама, тато чи опікун.</li>
            <li>Організаційний внесок — {OLIMP.price} грн. У нього входить тест, диплом і {OLIMP.giftDays} днів Dityam+.</li>
            <li>Після оплати на вказаний email надходить запрошення до тесту. Почати тест треба протягом {OLIMP.accessHours} годин після оплати.</li>
            <li>Тест: {OLIMP.questionCount} завдань із 4 варіантами відповіді, {OLIMP.minutes} хвилин, 1 спроба. Усі учасники отримують однакові завдання в різному порядку. Дитина відповідає самостійно.</li>
            <li>Диплом: {LEVELS.map((l, i) => `${l.label.toLowerCase()} — ${levelRange(i)}`).join('; ')}.</li>
            <li>Останнє завдання олімпіади — відкрите: його виконують після тесту, без таймера, відповідь надсилають 1 раз. Саме за ним журі Dityam.com.ua обирає 3 переможців календарного місяця за критеріями: {OPEN_TASK.criteria.join(', ')}. Жеребкування не проводиться.</li>
            <li>Призи місяця: {PRIZES.map((p) => `${p.place} місце — ${p.title}`).join('; ')}. Якщо товару на момент вручення немає в продажу, замінимо його на рівноцінний за вартістю. Про доставку призу домовляємось із батьками переможця.</li>
            <li>Друкований диплом — за бажанням: {OLIMP.printPrice} грн з доставкою Новою поштою по Україні. Замовити можна після тесту на сторінці з результатом.</li>
            <li>Повернення внеску: протягом {OLIMP.accessHours} годин після оплати, якщо дитина ще не починала тест, — за листом на {EMAIL}. Після початку тесту або коли {OLIMP.accessHours} години минули, внесок не повертається.</li>
            <li>Дані: імʼя дитини потрібне для диплома, email — для звʼязку з вами. Деталі — в <a href="/privacy">Політиці конфіденційності</a> та <a href="/terms">Умовах</a>.</li>
            <li>Олімпіада незалежна: вона не є учнівською олімпіадою МОН і не дає пільг при вступі. Назви товарів-призів належать їхнім виробникам; виробники не є партнерами олімпіади.</li>
          </ol>
          </details>
        </section>

        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(FAQ)) }} />
      </main>
      <Footer />
    </div>
  );
}
