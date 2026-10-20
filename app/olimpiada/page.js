import '@/app/styles/olimpiada.css';
import Footer from '../Footer';
import { OLIMP, OLIMP_OPEN, OLIMP_PUBLIC, LEVELS, PRIZES, OPEN_TASK, DIPLOMA_VERSION, AUDIENCE_MONTHLY, TEACHER_SAMPLE, TEACHER_THANKS_AT, monthKey, monthName, criteriaText } from '@/lib/olimpiada';
import { PRICE, PRICE_FIRST } from '@/lib/wayforpay';
import { SIA_AWARD } from '@/lib/awards';
import { MK } from '@/lib/modnyi-kod';
import TelegramJoin from './TelegramJoin';
import FaqTabs from './FaqTabs';
import OlimpTrack from './OlimpTrack';
import TeacherForm from './TeacherForm';
import ContactForm from '../contacts/ContactForm';
import { svg, shape, SHAPE_COLOR, balance, star, circle, line, text, INK } from '@/content/olimpiada/art';
import { MonsterPink, MonsterYellow, MonsterBlue, Rocket, Planet, Star, Wave } from './Doodles';

// Онлайн-олімпіада Dityam.com.ua — пілот (рішення Марії 05.10.2026): одна
// група 9–11 років, логіка, 30 завдань за 40 хвилин. З 08.10.2026 участь
// безкоштовна (до того — внесок 150 грн); платний лише друкований диплом з
// доставкою Новою поштою — OLIMP.printPrice, замовляють після тесту. Кожен
// учасник одразу отримує диплом; щомісяця — призи за
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
const DESCRIPTION = `Онлайн-олімпіада з логіки для дітей ${OLIMP.groupLabel}: ${OLIMP.questionCount} завдань за ${OLIMP.minutes} хвилин у зручний час. Участь безкоштовна: диплом одразу, призи щомісяця.`;

// Місяць конкурсу в текстах оновлюється сам.
export const revalidate = 3600;

export const metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: URL },
  // Сторінку видно пошуку вже до продажу (OLIMP_PUBLIC): на ній список
  // очікування. Без обох прапорців — лише для перевірки, без індексу.
  ...(OLIMP_OPEN || OLIMP_PUBLIC ? {} : { robots: { index: false, follow: false } }),
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
  { big: 'Безкоштовно', small: 'участь і диплом на екрані' },
];

const GETS = [
  { title: 'Диплом одразу', text: 'З іменем дитини, балами й рівнем. Готовий, щойно дитина завершила тест: можна зберегти, надрукувати чи поділитися.' },
  // Замість подарункового місяця — перший місяць за 1 грн (Марія, 08.10.2026:
  // «усім, хто проходить онлайн-олімпіаду, Dityam+ перший місяць за 1 грн»).
  { title: `Dityam+ на місяць за ${PRICE_FIRST} грн`, text: `Особиста добірка можливостей у Telegram під вік та інтереси дитини й нагадування про дедлайни. Після тесту — Dityam+ на місяць за ${PRICE_FIRST} грн замість ${PRICE} грн, далі ${PRICE} грн на місяць.` },
  { title: 'Шанс на приз місяця', text: 'Останнє завдання олімпіади — відкрите. Саме воно вирішує, хто отримає приз місяця: журі обирає 3 найкращі відповіді.' },
];

const STEPS = [
  // Реєстрація — у Telegram, без пошти (Марія, 13.10.2026: «нам треба відходити від імейлу»).
  ['Заявка', 'Запишіть дитину в Telegram-боті: лише імʼя для диплома. Участь безкоштовна, підписка не потрібна — бот одразу дасть кнопку «Почати олімпіаду».'],
  ['Тест', `У зручний час дитина проходить тест сама: ${OLIMP.questionCount} завдань за ${OLIMP.minutes} хвилин і 1 відкрите, 1 спроба. З компʼютера чи телефона.`],
  // Без таймера з 07.10.2026 (Марія: «без таймера»): хвилини — на завдання з варіантами.
  ['Відкрите завдання', `Останнє завдання тесту — подивитися на малюнок і придумати до нього своє питання. Таймера на ньому немає: можна подумати спокійно. Саме воно вирішує, хто отримає приз місяця.`],
  ['Диплом', `Результат і диплом зʼявляються на екрані одразу після тесту, а диплом приходить ще й у Telegram. Друкований диплом можна замовити після тесту — ${OLIMP.printPrice}\u00a0грн, доставка у відділення або поштомат Нової пошти включена.`,
    { text: 'Подивитися зразки диплома', href: '#dyplom' }],
];

// Зразки — не з тесту: показують стиль (малюнок + 4 варіанти), а не відповіді.
// Беремо середні за складністю: найлегші для 9–11 років виглядають як тест
// для першокласників (Марія, 05.10.2026).
const sampleLog = svg(360, 120, [
  `<rect x="40" y="40" width="280" height="44" rx="22" fill="#c9924a" stroke="${INK}" stroke-width="3"/>`,
  `<ellipse cx="40" cy="62" rx="14" ry="22" fill="#e8c38a" stroke="${INK}" stroke-width="3"/>`,
  line(180, 30, 180, 94, 4, '#ff5a5f', '8 6'),
  text(180, 22, '1 розпил = 2 хвилини', 16, '#ff5a5f'),
].join(''));
const SAMPLES = [
  {
    q: 'Щоб розпиляти колоду на 2 частини, потрібно 2 хвилини. Скільки хвилин піде, щоб розпиляти таку саму колоду на 4 частини?',
    art: sampleLog, options: ['4', '6', '8', '10'], answer: 1,
  },
  {
    q: 'Терези в рівновазі: 1 зірка важить стільки ж, скільки 2 кружечки. Скільки кружечків важать стільки, скільки 2 зірки?',
    art: svg(360, 196, balance(360, (x, y) => star(x, y - 18, 20, SHAPE_COLOR.star), (x, y) => `${circle(x - 20, y - 14, 13, SHAPE_COLOR.circle)}${circle(x + 20, y - 14, 13, SHAPE_COLOR.circle)}`)),
    options: ['2', '3', '4', '6'], answer: 2,
  },
];

const levelRange = (i) => {
  const top = i === 0 ? OLIMP.questionCount : LEVELS[i - 1].min - 1;
  return LEVELS[i].min === 0 ? `до ${top} балів` : `${LEVELS[i].min}–${top} балів`;
};

function faq(month) {
  return [
    { q: 'Для кого ця олімпіада?', a: `Для дітей ${OLIMP.groupLabel} з будь-якого міста України й для дітей з України, які живуть за кордоном. Завдання — на логіку й кмітливість, шкільна програма не потрібна.` },
    { q: 'Скільки коштує участь і що в неї входить?', a: `Участь безкоштовна. У неї входить тест і диплом з результатом: він зʼявляється на екрані й приходить у Telegram. Після тесту можна спробувати Dityam+ на місяць за ${PRICE_FIRST} грн замість ${PRICE} грн. Платний лише друкований диплом — ${OLIMP.printPrice} грн, доставка у відділення або поштомат Нової пошти включена; замовити його можна після тесту.`, link: { text: 'Dityam+', href: '/plus' } },
    { q: 'Коли можна проходити тест?', a: `У зручний час: після реєстрації бот дасть кнопку «Почати олімпіаду», вона лишається в чаті. Від натискання «Почати» дитина має ${OLIMP.minutes} хвилин на ${OLIMP.questionCount} завдань з варіантами і 1 спробу. Відкрите завдання — без таймера.` },
    { q: 'Що буде, коли час закінчиться?', a: `Відповіді на завдання з варіантами відправляться автоматично, а на екрані зʼявиться останнє, відкрите завдання — на нього таймера немає. Його можна дописати без поспіху й надіслати або пропустити, і диплом зʼявиться одразу. Завдання без відповіді просто не дають балів.` },
    // Два питання про диплом злиті в одне (Марія, 06.10.2026).
    { q: 'Коли ми отримаємо диплом?', a: `Одразу після завершення тесту — на екрані. Його можна завантажити, надрукувати, отримати в Telegram або замовити друкований диплом — ${OLIMP.printPrice} грн, друк і доставка у відділення або поштомат Нової пошти по Україні включені. Форма доставки (отримувач, телефон, місто, відділення чи поштомат) зʼявиться на сторінці з результатом, щойно оберете доставку.` },
    { q: 'Як визначається рівень диплома?', a: `За кількістю правильних відповідей: золотий рівень — від ${LEVELS[0].min} балів із ${OLIMP.questionCount}, срібний — від ${LEVELS[1].min}, бронзовий — від ${LEVELS[2].min}. Решта учасників отримують диплом учасника.` },
    { q: 'Як обирають переможців місяця?', a: `За останнім, відкритим завданням олімпіади. Журі Dityam.com.ua читає відповіді, надіслані протягом місяця, і обирає 3 найкращі за 3 критеріями: ${criteriaText()}. Жеребкування немає. Переможців за ${month} оголосимо до 7-го числа наступного місяця й окремо напишемо кожному на email із заявки.` },
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
        serviceType: 'Онлайн-олімпіада для дітей',
        areaServed: [{ '@type': 'Country', name: 'Україна' }, 'Українські діти за кордоном'],
        about: ['логіка', 'кмітливість', 'олімпіада для дітей', 'диплом'],
        name: 'Онлайн-олімпіада з логіки Dityam.com.ua',
        description: DESCRIPTION,
        url: URL,
        provider: { '@id': `${SITE_URL}/#org` },
        audience: { '@type': 'PeopleAudience', suggestedMinAge: OLIMP.ageMin, suggestedMaxAge: OLIMP.ageMax },
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'UAH', url: URL, ...(OLIMP_OPEN ? { availability: 'https://schema.org/InStock' } : {}) },
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

// Заклики до форми після кожного великого блоку (Марія, 06.10.2026: «мало cta»).
// До старту — у список очікування, після — до заявки (участь безкоштовна).
// at — мітка кнопки для статистики (OlimpTrack: olimp_cta.source).
function Cta({ note, light = false, at }) {
  return (
    <div className={`ol-cta${light ? ' is-light' : ''}`} data-cta={at}>
      <a href="#uchast" className="ol-btn ol-btn-main">{OLIMP_OPEN ? 'Взяти участь безкоштовно' : 'Повідомити про старт'}</a>
      {note && <span>{note}</span>}
    </div>
  );
}

// Підписи під кнопками-закликами — про те, за що батьки платять, а не про
// формальності (Марія, 07.10.2026: «Диплом з іменем дитини — одразу після
// тесту й на email — ти думаєш, це та цінність, за яку батьки хочуть платити?»).
const NOTE_GIFT = `Після тесту — Dityam+ на місяць за ${PRICE_FIRST} грн замість ${PRICE} грн`;
const NOTE_NEXT = 'Після тесту — особиста добірка можливостей під вік та інтереси дитини в Dityam+';
const NOTE_AUDIENCE = `${AUDIENCE_MONTHLY} родин за останній місяць шукали можливості на Dityam.com.ua`;

export default async function OlimpiadaPage() {
  const key = monthKey();
  const month = monthName(key);
  const FAQ = faq(month);
  return (
    <div className="v2-page ol-page">
      <main>
        <section className="ol-hero">
          <div className="ol-wrap">
            {/* Видимий заголовок — малюнок із монстриками замість «О», тому
                пошуковикам і AI-агентам — повна назва прихованим текстом:
                з одного aria-label вони читали «лімпіада з лгіки». */}
            <h1 className="ol-mega">
              <span className="ol-sr">Онлайн-олімпіада з логіки для дітей {OLIMP.groupLabel} від Dityam.com.ua</span>
              <span className="ol-mega-row" aria-hidden="true"><MonsterPink className="ol-mega-o" />лімпіада</span>
              <span className="ol-mega-row" aria-hidden="true">з л<MonsterYellow className="ol-mega-o" />гіки</span>
            </h1>
            <div className="ol-hero-grid">
              <div>
                <p className="ol-hand ol-hand-blue">від <span className="ol-brand">dityam.com.ua</span><br />онлайн, для дітей {OLIMP.groupLabel}</p>
                <p className="ol-lead">
                  {OLIMP.questionCount} завдань на кмітливість за {OLIMP.minutes} хвилин — у зручний час, безкоштовно.
                  Диплом з результатом зʼявляється одразу після тесту.
                </p>
                <div className="ol-actions" data-cta="hero">
                  <a href="#uchast" className="ol-btn ol-btn-main">{OLIMP_OPEN ? 'Взяти участь безкоштовно' : 'Повідомити про старт'}</a>
                  <a href="#yak" className="ol-btn ol-btn-ghost">Як це працює</a>
                </div>
                {/* Довіра під кнопкою замість трьох карток цифр (Марія, 07.10.2026:
                    «прибрати, але залишити 3к родин і підкріпити це чимось», «десь
                    біля CTA»). Число — AUDIENCE_MONTHLY (GA4), підкріплення —
                    перемога на SIA Ukraine (lib/awards.js).

                    Того ж дня рядок із кремовою пігулкою й 🏆 — «це виглядає
                    убого»: з трьох варіантів обрано медаль у стилі жовтого значка
                    «25 завдань» і підпис рукописним шрифтом сторінки. Медаль —
                    декор (з табу виключена), посилання — сам підпис. */}
                <div className="ol-trust">
                  <a className="ol-trust-medal" href={SIA_AWARD.href} target="_blank" rel="noopener noreferrer" tabIndex={-1} aria-hidden="true">
                    <span className="ol-trust-disc">
                      <svg viewBox="0 0 24 24"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z" /></svg>
                      <b>SIA</b>
                      <i>2026</i>
                    </span>
                  </a>
                  <div className="ol-trust-text">
                    <a className="ol-trust-award" href={SIA_AWARD.href} target="_blank" rel="noopener noreferrer" title={SIA_AWARD.full.uk}>
                      {SIA_AWARD.short.uk}
                    </a>
                    <span><b>{AUDIENCE_MONTHLY} родин</b> за останній місяць шукали можливості на Dityam.com.ua</span>
                  </div>
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
            <Cta at="after-gets" light note={NOTE_AUDIENCE} />

            <h2 id="yak" className="ol-hand ol-hand-gap">Як це працює</h2>
            {/* Короткі цифри — тут, а не в першому екрані: там їх було забагато (Марія, 05.10.2026) */}
            <ul className="ol-facts">
              {FACTS.map((f) => (
                <li key={f.big}><b>{f.big}</b><span>{f.small}</span></li>
              ))}
            </ul>
            <ol className="ol-steps">
              {STEPS.map(([title, text, link], i) => (
                <li key={title}>
                  <span className="ol-step-n" aria-hidden="true">{i + 1}</span>
                  <div><b>{title}</b><p>{text}</p>{link && <a className="ol-step-link" href={link.href}>{link.text} →</a>}</div>
                </li>
              ))}
            </ol>
            <Cta at="after-steps" light note={`${OLIMP.questionCount} завдань за ${OLIMP.minutes} хвилин і 1 відкрите · з телефона чи компʼютера`} />
          </div>
          <Planet className="ol-doodle ol-planet" />
          <Wave className="ol-wave ol-wave-bottom" flip />
        </section>

        <section className="ol-wrap ol-sec">
          <h2 className="ol-hand ol-hand-blue">Які бувають завдання</h2>
          <p className="ol-text">
            На логіку й кмітливість, без шкільних формул: візерунки, терези, роботи на сітці, дзеркала, шифри — майже
            кожне з малюнком. Ось 2 зразки, у самому тесті завдання інші.
          </p>
          <div className="ol-samples">
            {SAMPLES.map((s) => (
              <article key={s.q} className="ol-sample">
                <div className="ol-sample-art" dangerouslySetInnerHTML={{ __html: s.art }} />
                <p className="ol-sample-q">{s.q}</p>
                <ul className={s.options.some((o) => o.art) ? 'is-pics' : ''}>
                  {s.options.map((o, i) => (
                    <li key={i} className={i === s.answer ? 'is-right' : ''}>
                      {o.art ? <span className="ol-sample-pic" dangerouslySetInnerHTML={{ __html: o.art }} /> : o}
                      {i === s.answer && <em>правильно</em>}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
          <Cta at="after-samples" note={`У тесті — ${OLIMP.questionCount} таких завдань, від легких до хитрих`} />

          <h2 id="dyplom" className="ol-hand ol-hand-blue ol-hand-gap">Диплом, який хочеться повісити на стіну</h2>
          <p className="ol-text">З іменем дитини, медаллю й результатом. Готовий одразу після тесту: рівень залежить лише від її балів.</p>
          {/* Зразки малює той самий маршрут, що й справжні дипломи (?sample=…),
              тож на сторінці — рівно те, що отримає дитина. */}
          <ul className="ol-dips">
            {LEVELS.map((l, i) => (
              <li key={l.key} className={`ol-dip ol-dip-${l.key}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/olimpiada/diploma?sample=${l.key}&v=${DIPLOMA_VERSION}`} width={620} height={877} loading="lazy" alt={`Зразок диплома: ${l.label.toLowerCase()}`} />
                <b>{l.label}</b>
                <span>{levelRange(i)}</span>
              </li>
            ))}
          </ul>
          <Cta at="after-diplomas" note={NOTE_NEXT} />
        </section>

        <section className="ol-space ol-space-2">
          <Wave className="ol-wave" />
          <div className="ol-wrap">
            <h2 className="ol-hand">Призи місяця</h2>
            {/* Яке саме відкрите завдання — секрет до тесту (Марія, 06.10.2026:
                «це має бути секретом»): ні малюнка, ні назви на сторінці, у листі
                й на екрані перед «Почати». Дитина бачить його лише в кінці тесту. */}
            <p className="ol-text ol-text-light">
              Останнє завдання олімпіади — відкрите: тут немає варіантів відповіді, дитина пише свою.
              Яке саме — секрет, дитина побачить його лише в кінці тесту. Журі Dityam.com.ua щомісяця
              читає всі відповіді й обирає 3 найкращі. Що ми шукаємо:
            </p>
            <ol className="ol-crit">
              {OPEN_TASK.criteria.map((c) => (
                <li key={c.name}>
                  <b>{c.name}</b>
                  <span>{c.text.charAt(0).toUpperCase() + c.text.slice(1)}.</span>
                </li>
              ))}
            </ol>
            <ul className="ol-prizes">
              {PRIZES.map((p) => (
                <li key={p.place} className="ol-prize-card">
                  <span className="ol-pill">{p.place} місце</span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="ol-prize-photo" src={p.image} width={640} height={640} loading="lazy" alt={p.title} />
                  <b>{p.title}</b>
                  <span className="ol-prize-note">{p.note}</span>
                </li>
              ))}
            </ul>
            <p className="ol-note ol-note-light">Переможців оголошуємо до 7-го числа наступного місяця в Telegram-каналі й на цій сторінці. Переможцям також пишемо окремо — у Telegram чи на email, з яких записували дитину. Фото товарів — з магазинів.</p>

            <div id="uchast" className="ol-frame">
              <MonsterBlue className="ol-doodle ol-frame-monster" />
              <div className="ol-form-box">
                <div className="ol-form-copy">
                  <h2 className="ol-hand ol-hand-blue">Взяти участь</h2>
                  <p className="ol-text">
                    {/* Марія, 13.10.2026: «помітіть якось тут, що батьки чи вчителі реєструють дитину». */}
                    Дитину реєструють батьки чи вчитель — у Telegram: бот запише дитину, дасть посилання на тест і надішле диплом у той самий чат. Вчитель може записати весь клас з одного Telegram.
                    Пройти тест можна в зручний час: {OLIMP.minutes} хвилин підуть лише після натискання «Почати».
                  </p>
                  <ul className="ol-ticks">
                    <li>участь безкоштовна: тест і диплом</li>
                    <li>друкований диплом — за бажанням після тесту: {OLIMP.printPrice} грн, доставка у відділення або поштомат Нової пошти включена</li>
                  </ul>
                </div>
                <TelegramJoin />
              </div>
            </div>

            <h2 className="ol-hand ol-hand-gap">Питання й відповіді</h2>
            <div className="ol-frame ol-frame-faq">
              <FaqTabs items={FAQ} />
            </div>
            <Cta at="after-faq" light note={NOTE_GIFT} />
          </div>
          <Wave className="ol-wave ol-wave-bottom" flip />
        </section>

        {/* Для педагогів (Марія, 11.10.2026): педагог лишає імʼя та email і
            отримує особисте посилання для класу; подяку видаємо один раз, коли за
            ним олімпіаду пройдуть 5 учнів (TEACHER_THANKS_AT). Стоїть після призів, заявки й питань:
            батьків, які прийшли подати заявку, цей блок не перебиває, а
            педагог бачить уже всю олімпіаду — завдання, диплом і призи. */}
        <section id="pedagogam" className="ol-wrap ol-sec ol-teach" data-cta="teacher">
          <div className="ol-teach-box">
            <div className="ol-teach-copy">
              <p className="ol-kicker">Для педагогів</p>
              <h2 className="ol-hand">Ви педагог? Залучіть учнів до цікавої олімпіади</h2>
              <p className="ol-text">
                Отримайте від нас окрему подяку за учнів, які пройдуть олімпіаду за вашим посиланням. Залиште імʼя та
                email — надішлемо особисте посилання для класу.
              </p>
              <TeacherForm />
            </div>
            <figure className="ol-teach-sample">
              {/* Зразок малює той самий маршрут, що й справжню подяку. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/olimpiada/diploma?kind=teacher&sample=1&v=${DIPLOMA_VERSION}`} width={620} height={877} loading="lazy"
                alt={`Зразок подяки педагогу: ${TEACHER_SAMPLE.name}`} />
              <figcaption>Подяку надсилаємо, коли за вашим посиланням олімпіаду пройдуть {TEACHER_THANKS_AT} учнів</figcaption>
            </figure>
          </div>
        </section>

        <section className="ol-wrap ol-sec ol-sec-rules">
          {/* Правила завжди відкриті (Марія, 06.10.2026): батьки мають бачити
              умови без зайвого натискання. */}
          <h2 id="pravyla" className="ol-hand ol-hand-blue">Правила олімпіади</h2>
          <ol className="ol-rules">
            <li>Організатор — платформа Dityam.com.ua, ФОП Шутяк Марія Олександрівна. Звʼязок: {EMAIL}.</li>
            <li>Учасники — діти {OLIMP.groupLabel}. Заявку подає мама, тато чи опікун.</li>
            <li>Участь безкоштовна. У неї входить тест і диплом.</li>
            <li>Реєстрація — у Telegram-боті @DityamPlusBot, підписка не потрібна: бот одразу дає посилання на тест, а після тесту надсилає диплом у той самий чат.</li>
            <li>Тест: {OLIMP.questionCount} завдань із 4 варіантами відповіді — {OLIMP.minutes} хвилин, 1 спроба — і 1 відкрите завдання без таймера. Усі учасники отримують однакові завдання в різному порядку. Дитина відповідає самостійно. З однієї пошти олімпіаду можна пройти не більше {OLIMP.maxEntriesPerEmail} разів (педагоги, які записують клас через блок «Для педагогів», — без цього обмеження). Коли дитина завершує завдання з варіантами або час вийшов, відповіді на них фіксуються й відправляються автоматично; відкрите завдання після цього можна написати без обмеження часу.</li>
            <li>Диплом: {LEVELS.map((l, i) => `${l.label.toLowerCase()} — ${levelRange(i)}`).join('; ')}.</li>
            <li>Останнє завдання олімпіади — відкрите, без таймера; відповідь надсилається 1 раз. Виконавши його, дитина бере участь у конкурсі на подарунки місяця: журі Dityam.com.ua обирає 3 найкращі відповіді календарного місяця за 3 критеріями: {criteriaText()}. Жеребкування не проводиться.</li>
            <li>Призи місяця: {PRIZES.map((p) => `${p.place} місце — ${p.title}`).join('; ')}. Якщо товару на момент вручення немає в продажу, замінимо його на рівноцінний за вартістю. Про доставку призу домовляємось із батьками переможця.</li>
            <li>Друкований диплом — за бажанням: {OLIMP.printPrice} грн, друк і доставка у відділення або поштомат Нової пошти по Україні включені у вартість. Замовити можна після тесту на сторінці з результатом; оплата карткою через WayForPay.</li>
            <li>Дані: імʼя дитини потрібне для диплома; звʼязок з вами — у чаті з ботом. Деталі — в <a href="/privacy">Політиці конфіденційності</a> та <a href="/terms">Умовах</a>.</li>
            <li>Завдання не поширюємо. Фотографувати завдання, робити знімки чи запис екрана, переписувати й публікувати їх не можна: завдання однакові для всіх, і знімок у відкритому доступі псує олімпіаду для інших дітей.</li>
            <li>Чесна участь. Дитина виконує завдання самостійно. Організатор має право анулювати диплом і доступ до олімпіади за порушення правил етики — зокрема за вимогу видати диплом без виконання завдання, очікування грошової винагороди за участь, образи чи несамостійне проходження тесту. Сторінка з результатом лишається доступною й пояснює причину; сплачені кошти (зокрема за друкований диплом) не повертаються; рішення можна оскаржити листом на {EMAIL}. Докладніше — в <a href="/terms">Умовах</a>.</li>
            <li>Олімпіада незалежна: вона не є учнівською олімпіадою МОН і не дає пільг при вступі. Назви товарів-призів належать їхнім виробникам; виробники не є партнерами олімпіади.</li>
          </ol>
          <Cta at="after-rules" note={NOTE_AUDIENCE} />
        </section>

        {/* Перелінковка олімпіад між собою (Марія, 20.10.2026: «типу як
            рекомендоване»). Стоїть після правил: хто дочитав сюди, вже
            вирішив щодо цієї олімпіади, і друга — наступний крок, а не
            відволікання від заявки. Текст — з опису /modnyi-kod. */}
        <section className="ol-wrap ol-sec ol-more" data-cta="more">
          <div className="ol-more-box">
            <p className="ol-kicker">Рекомендуємо також</p>
            <h2 className="ol-hand ol-hand-blue">«{MK.title}» — онлайн-олімпіада з моди для дітей {MK.ageFrom}–{MK.ageTo} років</h2>
            <p className="ol-text">Тест про кольори, тканини й стилі, студія образу й обкладинка модного журналу з балами. Участь безкоштовна.</p>
            <a href={`/${MK.slug}`} className="ol-btn ol-btn-main">Дізнатися більше</a>
          </div>
        </section>

        <section className="ol-wrap ol-sec ol-contact">
          <h2 className="ol-hand ol-hand-blue">Залишилися питання? Напишіть нам</h2>
          <ContactForm defaultType="olimpiada" fixedType />
        </section>

        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(FAQ)) }} />
      </main>
      <OlimpTrack />
      <Footer />
    </div>
  );
}
