import '@/app/styles/olimpiada.css';
import Footer from '../Footer';
import { OLIMP, OLIMP_OPEN, LEVELS, PRIZES, OPEN_TASK, monthKey, monthName } from '@/lib/olimpiada';
import { TELEGRAM_URL } from '@/lib/social';
import EntryForm from './EntryForm';
import FaqTabs from './FaqTabs';
import { MonsterPink, MonsterYellow, MonsterBlue, Rocket, Planet, Star, Wave } from './Doodles';

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
  { title: 'Шанс на приз місяця', text: 'Після тесту дитина може відповісти на відкрите завдання. За 3 найкращі відповіді місяця — призи.' },
];

const STEPS = [
  ['Заявка й оплата', `Вкажіть імʼя дитини для диплома та свій email, сплатіть організаційний внесок ${OLIMP.price} грн карткою.`],
  ['Тест', `Дитина відповідає сама: ${OLIMP.questionCount} завдань, ${OLIMP.minutes} хвилин, 1 спроба. З компʼютера чи телефона.`],
  ['Диплом', 'Результат і диплом зʼявляються на екрані одразу після тесту.'],
  ['Відкрите завдання', 'За бажанням: придумати власну логічну задачу й позмагатися за приз місяця.'],
];

// Зразки — не з тесту: показують рівень, а не відповіді.
const SAMPLES = [
  { q: 'Продовж ряд: 3, 6, 9, 12, …', options: ['13', '14', '15', '18'], answer: '15' },
  { q: 'Іра старша за Олега, а Олег старший за Марка. Хто наймолодший?', options: ['Іра', 'Олег', 'Марко', 'неможливо визначити'], answer: 'Марко' },
];

const levelRange = (i) => {
  const top = i === 0 ? OLIMP.questionCount : LEVELS[i - 1].min - 1;
  return LEVELS[i].min === 0 ? `до ${top} балів` : `${LEVELS[i].min}–${top} балів`;
};

function faq(month) {
  return [
    { q: 'Для кого ця олімпіада?', a: `Для дітей ${OLIMP.groupLabel} з будь-якого міста України й для дітей з України, які живуть за кордоном. Завдання — на логіку й кмітливість, шкільна програма не потрібна.` },
    { q: 'Скільки коштує участь і що в неї входить?', a: `Організаційний внесок — ${OLIMP.price} грн. У нього входить тест, диплом з результатом і ${OLIMP.giftDays} днів Dityam+.` },
    { q: 'Коли можна проходити тест?', a: `У будь-який зручний час після оплати. Від натискання «Почати» дитина має ${OLIMP.minutes} хвилин і 1 спробу.` },
    { q: 'Коли ми отримаємо диплом?', a: 'Одразу після завершення тесту — на екрані. Його можна завантажити, надрукувати або отримати в Telegram.' },
    { q: 'Як визначається рівень диплома?', a: `За кількістю правильних відповідей: золотий рівень — від ${LEVELS[0].min} балів із ${OLIMP.questionCount}, срібний — від ${LEVELS[1].min}, бронзовий — від ${LEVELS[2].min}. Решта учасників отримують диплом учасника.` },
    { q: 'Як обирають переможців місяця?', a: `Журі Dityam.com.ua читає відповіді на відкрите завдання, надіслані протягом місяця, і обирає 3 найкращі за критеріями: ${OPEN_TASK.criteria.join(', ')}. Жеребкування немає. Переможців за ${month} оголосимо до 7-го числа наступного місяця.` },
    { q: 'Чи повертається внесок?', a: `Після початку тесту організаційний внесок не повертається. Якщо дитина ще не починала тест, напишіть на ${EMAIL} протягом 14 днів після оплати.` },
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
                <p className="ol-hand ol-hand-blue">Онлайн, для дітей {OLIMP.groupLabel}</p>
                <p className="ol-lead">
                  {OLIMP.questionCount} завдань на кмітливість за {OLIMP.minutes} хвилин — у зручний для вас час.
                  Диплом з результатом зʼявляється одразу після тесту, а разом із ним {OLIMP.giftDays} днів Dityam+.
                </p>
                <div className="ol-actions">
                  <a href="#uchast" className="ol-btn ol-btn-main">{OLIMP_OPEN ? `Взяти участь · ${OLIMP.price} грн` : 'Реєстрація скоро'}</a>
                  <a href="#yak" className="ol-btn ol-btn-ghost">Як це працює</a>
                </div>
                <ul className="ol-facts">
                  {FACTS.map((f) => (
                    <li key={f.big}><b>{f.big}</b><span>{f.small}</span></li>
                  ))}
                </ul>
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

          <h2 className="ol-hand ol-hand-blue ol-hand-gap">Рівні диплома</h2>
          <p className="ol-text">Рівень залежить лише від балів дитини, тому диплом готовий одразу.</p>
          <ul className="ol-levels">
            {LEVELS.map((l, i) => (
              <li key={l.key} className={`ol-level ol-level-${l.key}`}>
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
              Після тесту дитина може виконати відкрите завдання: «{OPEN_TASK.title}». Журі Dityam.com.ua
              обирає 3 найкращі відповіді місяця за критеріями: {OPEN_TASK.criteria.join(', ')}.
            </p>
            <ul className="ol-prizes">
              {PRIZES.map((p) => (
                <li key={p.place}>
                  <span className="ol-pill">{p.place} місце</span>
                  <b className="ol-tile">{p.title}</b>
                </li>
              ))}
            </ul>
            <p className="ol-note ol-note-light">Переможців оголошуємо до 7-го числа наступного місяця в Telegram-каналі й на цій сторінці.</p>

            <div id="uchast" className="ol-frame">
              <MonsterBlue className="ol-doodle ol-frame-monster" />
              <div className="ol-form-box">
                <div className="ol-form-copy">
                  <h2 className="ol-hand ol-hand-blue">Взяти участь</h2>
                  <p className="ol-text">
                    Після оплати одразу відкриється сторінка тесту. Починати можна тоді, коли дитині зручно:
                    час піде лише після натискання «Почати».
                  </p>
                  <ul className="ol-ticks">
                    <li>організаційний внесок {OLIMP.price} грн: тест, диплом і {OLIMP.giftDays} днів Dityam+</li>
                    <li>оплата карткою через WayForPay</li>
                    <li>починати тест можна будь-коли після оплати</li>
                  </ul>
                  <p className="ol-note ol-note-form">Після початку тесту внесок не повертається.</p>
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
          <h2 className="ol-hand ol-hand-blue">Правила олімпіади</h2>
          <ol className="ol-rules">
            <li>Організатор — платформа Dityam.com.ua, ФОП Шутяк Марія Олександрівна. Звʼязок: {EMAIL}.</li>
            <li>Учасники — діти {OLIMP.groupLabel}. Заявку подає й оплачує мама, тато чи опікун.</li>
            <li>Організаційний внесок — {OLIMP.price} грн. У нього входить тест, диплом і {OLIMP.giftDays} днів Dityam+. Після початку тесту внесок не повертається.</li>
            <li>Тест: {OLIMP.questionCount} завдань із 4 варіантами відповіді, {OLIMP.minutes} хвилин, 1 спроба. Усі учасники отримують однакові завдання в різному порядку. Дитина відповідає самостійно.</li>
            <li>Диплом: {LEVELS.map((l, i) => `${l.label.toLowerCase()} — ${levelRange(i)}`).join('; ')}.</li>
            <li>Конкурс місяця: відповідь на відкрите завдання можна надіслати 1 раз після тесту. Журі Dityam.com.ua обирає 3 найкращі відповіді календарного місяця за критеріями: {OPEN_TASK.criteria.join(', ')}. Жеребкування не проводиться.</li>
            <li>Призи місяця: {PRIZES.map((p) => `${p.place} місце — ${p.title.toLowerCase()}`).join('; ')}. Про доставку призу домовляємось із батьками переможця.</li>
            <li>Якщо дитина ще не починала тест, від участі можна відмовитись протягом 14 днів після оплати: напишіть на {EMAIL}.</li>
            <li>Дані: імʼя дитини потрібне для диплома, email — для звʼязку з вами. Деталі — в <a href="/privacy">Політиці конфіденційності</a> та <a href="/terms">Умовах</a>.</li>
            <li>Олімпіада незалежна: вона не є учнівською олімпіадою МОН і не дає пільг при вступі.</li>
          </ol>
        </section>

        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(FAQ)) }} />
      </main>
      <Footer />
    </div>
  );
}
