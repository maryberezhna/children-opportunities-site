import SubscribeForm from './SubscribeForm';
import { opportunitiesWord } from '@/lib/plural';

/**
 * Лендінг Dityam+.
 *
 * Сторінка продає не доступ і не економію часу, а памʼять: підписка знає, що
 * дитина вже пройшла, і пропонує наступну сходинку. Тому головний аргумент —
 * не перелік фіч, а три траєкторії. Усі дванадцять програм у них — реальні
 * активні записи бази (звірено 13.09.2026), не приклади з голови: якщо котрусь
 * закриють, її треба замінити тут, а не лишати.
 *
 * Продаж ще не відкритий, тож заклик — список очікування, і сторінка прямо
 * каже «скоро». Обіцянка «памʼятаємо, куди подавались» описує підписку на
 * момент запуску; до запуску форма «я подався» мусить отримати звʼязок із
 * підписником, інакше обіцянка стане неправдою.
 */

const L = {
  uk: {
    soon: 'скоро',
    h1a: 'Не пошук, а ',
    h1script: 'траєкторія',
    h1b: ' розвитку дитини',
    lead: 'Ми памʼятаємо, куди ваша дитина вже подавалась і що їй підійшло, — і наступного місяця пропонуємо не випадкові картки, а наступний крок.',
    cta: 'Стати в список першим',
    how: 'Як це працює ↓',
    priceHint: '179 грн/міс · 1 490 грн/рік · скасувати можна будь-коли',
    stairsLabel: 'Приклад траєкторії',
    stairsCaption: 'Реальний шлях дитини 14 років, яка любить біологію. Усі чотири програми зараз є на платформі.',
    stairs: [
      ['Школа', 'Олімпіади МОН'],
      ['Україна', 'Мала академія наук'],
      ['Відбір', 'ISEF Ukraine'],
      ['Світ', 'Regeneron ISEF'],
    ],

    contrastTitle: 'Пошукав і забув — чи наступний крок',
    contrastA: 'Звичайний пошук',
    contrastAItems: [
      'Щоразу з нуля: пошуковик не знає, що дитина вже пройшла',
      'Знаходите те саме, що бачили місяць тому',
      'Про дедлайн дізнаєтесь, коли він уже минув',
    ],
    contrastB: 'Dityam+',
    contrastBItems: [
      'Памʼятає, куди дитина вже подавалась і що їй підійшло',
      'Пропонує наступну сходинку, а не повтор',
      'Нагадує за 7 і 2 дні до кінця подачі',
    ],

    pathsTitle: 'Три траєкторії з нашої бази',
    pathsSub: 'Це не вигадані приклади: усі дванадцять програм нижче зараз відкриті на платформі.',
    paths: [
      {
        persona: 'Дитині 14, любить біологію',
        title: 'Від шкільної олімпіади до світової виставки',
        steps: [
          ['Школа', 'Всеукраїнські предметні олімпіади МОН', '11–17'],
          ['Україна', 'Конкурс Малої академії наук України', '7–17'],
          ['Відбір', 'ISEF Ukraine — національний відбір', '14–17'],
          ['Світ', 'Regeneron ISEF — найбільша наукова виставка світу', '14–17'],
        ],
        why: 'Кожна сходинка має сенс лише тому, що пройдена попередня.',
      },
      {
        persona: 'Підлітку 14, хоче свою справу',
        title: 'Від інкубатора до глобального конкурсу',
        steps: [
          ['Інкубатор', 'Youthquake від Дія.Бізнес', '13–18'],
          ['Премія', 'StudBiz Award для шкільних соціальних підприємств', '14–17'],
          ['Конкурс', 'NFTE Youth Entrepreneurship Challenge', '13–18'],
          ['Конкурс', 'Diamond Challenge — глобальний підлітковий конкурс', '14–18'],
        ],
        why: 'З кожним кроком у дитини більше досвіду, з яким іти на наступний.',
      },
      {
        persona: 'Дитині 13, родина переселилась',
        title: 'Один статус — чотири різні світи',
        steps: [
          ['Виплата', 'Виплата 3 000 грн дітям ВПО', '0–17'],
          ['Відпочинок', 'Безкоштовне оздоровлення за держпрограмою', '7–18'],
          ['Навичка', 'STEM «Блогер Кемп» у Закарпатті', '12–16'],
          ['Підтримка', 'Gen.Camp — психологічний інтенсив', '7–17'],
        ],
        why: 'Соцзахист, держпрограма, фонд і психологи. Пошук «гурток для дитини» не покаже жодної з цих програм.',
      },
    ],

    howTitle: 'Як це працює',
    how4: [
      ['Розкажіть про дитину', 'Три питання: вік, інтереси й чи показувати платне. Ні імені, ні школи.'],
      ['Отримуйте нове під профіль', 'Щойно зʼявляється можливість, що підходить, — надсилаємо. Якщо нового немає два тижні, нагадаємо про те, що вже відкрито.'],
      ['Не пропускайте дедлайни', 'За 7 днів — щоб устигнути зібрати документи. За 2 дні — останній дзвінок.'],
      ['Позначайте, куди подались', 'І наступна добірка враховує пройдене: не повтор, а сходинка вище.'],
    ],

    priceTitle: 'Скільки коштує',
    month: '179 грн',
    monthPer: ' / місяць',
    monthNote: 'скасувати можна будь-коли',
    year: '1 490 грн',
    yearPer: ' / рік',
    yearNote: '≈ 124 грн на місяць',
    yearRibbon: 'вигідніше на 31%',
    includedTitle: 'У підписку входить',
    included: [
      'добірка під профіль дитини — вік, інтереси, місто',
      'наступний крок з урахуванням того, куди вже подавались',
      'нагадування про дедлайни за 7 і 2 дні',
      'доставка в Telegram або на email',
    ],
    trust: (total) => [
      'Не питаємо ні імені дитини, ні школи',
      'Платформа лишається безкоштовною для всіх',
      'Скасувати можна одною командою',
      total ? `${total.toLocaleString('uk-UA')} ${opportunitiesWord(total)}, перевіряємо щодня` : 'Можливості перевіряємо щодня',
    ],

    faqTitle: 'Питання',
    faq: [
      ['Чим підписка відрізняється від безкоштовної платформи?', 'Усі можливості на Dityam.com.ua відкриті для всіх і такими лишаться. Підписка не відкриває доступ — вона стежить за профілем вашої дитини, пропонує наступний крок і нагадує про дедлайни.'],
      ['Коли запуск?', 'Ми саме дороблюємо Dityam+. Усім, хто в списку, напишемо першими — зі знижкою на старті.'],
      ['А якщо під мою дитину нічого не знайдеться?', 'Мовчати місяцями не будемо: запропонуємо розширити профіль — наприклад, додати інтерес чи сусідній вік.'],
      ['Як скасувати?', 'Командою /stop у боті. Спершу зупиняємо автоматичне списання, потім підписку — більше нічого не спишеться.'],
    ],

    joinTitle: 'Станьте першими',
    joinText: 'Dityam+ ще не продається. Залиште контакт — напишемо в день запуску, і для перших буде знижка.',
  },

  en: {
    soon: 'soon',
    h1a: 'Not a search, but a ',
    h1script: 'path',
    h1b: ' for your child',
    lead: 'We remember what your child has already applied to and what worked — so next month you get not random cards, but the next step.',
    cta: 'Join the list first',
    how: 'How it works ↓',
    priceHint: 'UAH 179/month · UAH 1,490/year · cancel any time',
    stairsLabel: 'An example path',
    stairsCaption: 'A real path for a 14-year-old who loves biology. All four programmes are on the platform right now.',
    stairs: [
      ['School', 'National olympiads'],
      ['Ukraine', 'Junior Academy of Sciences'],
      ['Selection', 'ISEF Ukraine'],
      ['World', 'Regeneron ISEF'],
    ],

    contrastTitle: 'Search and forget — or the next step',
    contrastA: 'A regular search',
    contrastAItems: [
      'Starts from zero every time: a search engine does not know what your child has done',
      'You find the same things you saw a month ago',
      'You learn about a deadline after it has passed',
    ],
    contrastB: 'Dityam+',
    contrastBItems: [
      'Remembers where your child has applied and what worked',
      'Suggests the next step, not a repeat',
      'Reminds you 7 and 2 days before applications close',
    ],

    pathsTitle: 'Three paths from our database',
    pathsSub: 'These are not made-up examples: all twelve programmes below are open on the platform right now.',
    paths: [
      {
        persona: 'Age 14, loves biology',
        title: 'From a school olympiad to the world’s biggest science fair',
        steps: [
          ['School', 'Ukrainian national subject olympiads', '11–17'],
          ['Ukraine', 'Junior Academy of Sciences of Ukraine competition', '7–17'],
          ['Selection', 'ISEF Ukraine — national selection', '14–17'],
          ['World', 'Regeneron ISEF — the world’s largest science fair', '14–17'],
        ],
        why: 'Each step only makes sense because the previous one is done.',
      },
      {
        persona: 'Age 14, wants to start something',
        title: 'From an incubator to a global competition',
        steps: [
          ['Incubator', 'Youthquake by Diia.Business', '13–18'],
          ['Award', 'StudBiz Award for school social enterprises', '14–17'],
          ['Competition', 'NFTE Youth Entrepreneurship Challenge', '13–18'],
          ['Competition', 'Diamond Challenge — a global teen competition', '14–18'],
        ],
        why: 'With every step your child has more experience to take into the next one.',
      },
      {
        persona: 'Age 13, family displaced by the war',
        title: 'One status — four different worlds',
        steps: [
          ['Payment', 'UAH 3,000 payment for displaced children', '0–17'],
          ['Recovery', 'Free state-funded recovery stay', '7–18'],
          ['Skill', 'STEM “Blogger Camp” in Zakarpattia', '12–16'],
          ['Support', 'Gen.Camp — a psychological intensive', '7–17'],
        ],
        why: 'Social services, a state programme, a foundation and psychologists. A search for “clubs for kids” shows none of them.',
      },
    ],

    howTitle: 'How it works',
    how4: [
      ['Tell us about your child', 'Three questions: age, interests and whether to show paid options. No name, no school.'],
      ['Get what fits the profile', 'The moment a matching opportunity appears, we send it. If nothing new shows up for two weeks, we remind you of what is already open.'],
      ['Never miss a deadline', '7 days before — enough time to gather documents. 2 days before — the last call.'],
      ['Mark where you applied', 'And the next selection takes it into account: not a repeat, but a step up.'],
    ],

    priceTitle: 'Pricing',
    month: 'UAH 179',
    monthPer: ' / month',
    monthNote: 'cancel any time',
    year: 'UAH 1,490',
    yearPer: ' / year',
    yearNote: '≈ UAH 124 a month',
    yearRibbon: '31% cheaper',
    includedTitle: 'The subscription includes',
    included: [
      'a selection for your child’s profile — age, interests, city',
      'the next step, based on where you have already applied',
      'deadline reminders 7 and 2 days ahead',
      'delivery on Telegram or by email',
    ],
    trust: (total) => [
      'We never ask for your child’s name or school',
      'The platform stays free for everyone',
      'Cancel with one command',
      total ? `${total.toLocaleString('en-US')} opportunities, checked daily` : 'Opportunities checked daily',
    ],

    faqTitle: 'Questions',
    faq: [
      ['How is the subscription different from the free platform?', 'Every opportunity on Dityam.com.ua is open to everyone and will stay that way. The subscription does not unlock access — it follows your child’s profile, suggests the next step and reminds you about deadlines.'],
      ['When does it launch?', 'We are finishing Dityam+ now. Everyone on the list hears from us first — with a launch discount.'],
      ['What if nothing fits my child?', 'We will not go quiet for months: we will suggest widening the profile — for example, adding an interest or a neighbouring age.'],
      ['How do I cancel?', 'Send /stop to the bot. We stop the recurring payment first, then the subscription — nothing more is charged.'],
    ],

    joinTitle: 'Be the first',
    joinText: 'Dityam+ is not on sale yet. Leave a contact — we will write on launch day, with a discount for early members.',
  },
};

export default function PlusLanding({ lang = 'uk', total = null }) {
  const t = L[lang] || L.uk;

  return (
    <main className="pl" lang={lang === 'en' ? 'en' : undefined}>
      {/* ── Хіро: теза сторінки — сходинки, а не список фіч ── */}
      <section className="pl-hero">
        <div className="pl-wrap pl-hero-grid">
          <div className="pl-hero-copy">
            <div className="pl-badges">
              <span className="pl-badge">Dityam+</span>
              <span className="pl-badge pl-badge-soon">{t.soon}</span>
            </div>
            <h1 className="pl-h1">
              {t.h1a}<span className="pl-script">{t.h1script}</span>{t.h1b}
            </h1>
            <p className="pl-lead">{t.lead}</p>
            <div className="pl-cta-row">
              <a href="#join" className="pl-btn">{t.cta}</a>
              <a href="#how" className="pl-link">{t.how}</a>
            </div>
            <p className="pl-price-hint">{t.priceHint}</p>
          </div>

          <figure className="pl-stairs-fig">
            <ol className="pl-stairs" aria-label={t.stairsLabel}>
              {t.stairs.map(([lvl, name]) => (
                <li key={lvl} className="pl-stair">
                  <span className="pl-stair-lvl">{lvl}</span>
                  <span className="pl-stair-t">{name}</span>
                </li>
              ))}
            </ol>
            <figcaption className="pl-stairs-cap">{t.stairsCaption}</figcaption>
          </figure>
        </div>
      </section>

      {/* ── Контраст: разовий пошук проти памʼяті ── */}
      <section className="pl-sec pl-sec-cream">
        <div className="pl-wrap">
          <h2 className="pl-h2">{t.contrastTitle}</h2>
          <div className="pl-contrast">
            <div className="pl-contrast-card pl-contrast-a">
              <h3>{t.contrastA}</h3>
              <ul>{t.contrastAItems.map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
            <div className="pl-contrast-card pl-contrast-b">
              <h3>{t.contrastB}</h3>
              <ul>{t.contrastBItems.map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Три траєкторії: реальні записи бази ── */}
      <section className="pl-sec">
        <div className="pl-wrap">
          <h2 className="pl-h2">{t.pathsTitle}</h2>
          <p className="pl-sub">{t.pathsSub}</p>
          <div className="pl-paths">
            {t.paths.map((p) => (
              <article key={p.title} className="pl-path">
                <p className="pl-persona">{p.persona}</p>
                <h3 className="pl-path-title">{p.title}</h3>
                <ol className="pl-steps">
                  {p.steps.map(([lvl, name, age]) => (
                    <li key={name} className="pl-step">
                      <span className="pl-step-lvl">{lvl}</span>
                      <span className="pl-step-t">{name}</span>
                      <span className="pl-step-age">{age}</span>
                    </li>
                  ))}
                </ol>
                <p className="pl-why">{p.why}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Як це працює ── */}
      <section className="pl-sec pl-sec-cream" id="how">
        <div className="pl-wrap">
          <h2 className="pl-h2">{t.howTitle}</h2>
          <ol className="pl-how">
            {t.how4.map(([title, text], i) => (
              <li key={title} className="pl-how-item">
                <span className="pl-how-n" aria-hidden="true">{i + 1}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Ціна ── */}
      <section className="pl-sec">
        <div className="pl-wrap">
          <h2 className="pl-h2">{t.priceTitle}</h2>
          <div className="pl-prices">
            <div className="pl-price">
              <div className="pl-price-amount">{t.month}<span>{t.monthPer}</span></div>
              <div className="pl-price-note">{t.monthNote}</div>
            </div>
            <div className="pl-price pl-price-best">
              <span className="pl-ribbon">{t.yearRibbon}</span>
              <div className="pl-price-amount">{t.year}<span>{t.yearPer}</span></div>
              <div className="pl-price-note">{t.yearNote}</div>
            </div>
          </div>
          <p className="pl-included-title">{t.includedTitle}</p>
          <ul className="pl-included">
            {t.included.map((x) => <li key={x}>{x}</li>)}
          </ul>
          <ul className="pl-trust">
            {t.trust(total).map((x) => <li key={x}>{x}</li>)}
          </ul>
        </div>
      </section>

      {/* ── Питання ── */}
      <section className="pl-sec pl-sec-cream">
        <div className="pl-wrap">
          <h2 className="pl-h2">{t.faqTitle}</h2>
          <div className="pl-faq">
            {t.faq.map(([q, a]) => (
              <details key={q} className="pl-faq-item">
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── Список очікування ── */}
      <section className="pl-join" id="join">
        <div className="pl-wrap pl-narrow">
          <h2 className="pl-h2">{t.joinTitle}</h2>
          <p className="pl-join-text">{t.joinText}</p>
          <div className="pl-form-card">
            <SubscribeForm lang={lang} />
          </div>
        </div>
      </section>
    </main>
  );
}
