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
      'Нагадує завчасно: за 2–4 тижні для стипендій і обмінів, за тиждень для гуртків',
      'Вчиться на ваших позначках «Цікаво» і «Не цікаво»',
    ],

    mockTitle: 'Ви налаштовуєте добірку одним дотиком',
    mockSub: 'Під кожною можливістю — «👍 Цікаво» і «👎 Не цікаво». Що більше позначок, то точніше наступна добірка.',
    mockTg: 'Так це виглядає в Telegram',
    mockMail: 'Так це виглядає на пошті',
    tg: {
      title: 'ISEF Ukraine — національний відбір на Regeneron ISEF',
      meta: 'Конкурс · 14-17 років · Безкоштовно · до 31 січня 2027',
      text: 'Всеукраїнський конкурс наукових та інженерних проєктів для учнів 9-11 класів. 22 категорії: біохімія, біомедицина, хімія, інженерія, ML, екологія…',
      more: 'Деталі →',
      cal: '📅 Додати в календар',
      toast: 'Дякуємо за зворотній зв’язок',
    },
    mail: {
      fromLabel: 'Від',
      from: 'Dityam+',
      subjectLabel: 'Тема',
      subject: 'Нове для вашої дитини: конкурс підприємництва',
      hello: 'Знайшли можливість під профіль вашої дитини:',
      title: 'NFTE Youth Entrepreneurship Challenge',
      meta: 'Конкурс · 13-18 років · Безкоштовно · до 31 жовтня 2026',
      text: 'Глобальний конкурс підліткового підприємництва, 47+ країн. Реєстрація команд відкрита до кінця жовтня.',
      more: 'Деталі на dityam.com.ua →',
      foot: 'Позначте — і наступний лист буде точнішим.',
    },
    yes: '👍 Цікаво',
    no: '👎 Не цікаво',
    mockNote: 'Кнопки «Цікаво» і «Не цікаво» вже стоять під кожним постом у нашому телеграм-каналі. У Dityam+ ваші позначки підлаштовуватимуть наступні добірки — і в Telegram, і на пошті.',

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
      ['Розкажіть про вподобання дитини', 'Вік, що подобається, формат, місто й чи показувати платне. Особливі обставини — лише за бажанням. Кілька дітей — окремий профіль для кожної. Ні імені, ні школи.'],
      ['Отримуйте нове під профіль', 'Щойно зʼявляється можливість, що підходить, — надсилаємо. Якщо нового немає два тижні, нагадаємо про те, що вже відкрито.'],
      ['Не пропускайте дедлайни', 'Стипендії, гранти й обміни — за 4 і 2 тижні: на документи й есе потрібен час. Конкурси, олімпіади й табори — за 2 тижні. Курси й гуртки — за тиждень. І останній дзвінок — за кілька днів.'],
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
      'добірка під профіль кожної дитини — вік, вподобання, формат, місто',
      'наступний крок з урахуванням того, куди вже подавались',
      'нагадування про дедлайни завчасно — від 4 тижнів для стипендій до тижня для гуртків',
      'доставка в Telegram або на email',
    ],
    trust: (total) => [
      'Не питаємо ні імені дитини, ні школи',
      'Платформа лишається безкоштовною для всіх',
      'Скасувати можна одною командою',
      total ? `${total.toLocaleString('uk-UA')} ${opportunitiesWord(total)} — щодня додаємо нові й перевіряємо` : 'Щодня додаємо нові можливості й перевіряємо',
    ],

    faqTitle: 'Питання',
    faq: [
      ['Чим підписка відрізняється від безкоштовної платформи?', 'Усі можливості на Dityam.com.ua відкриті для всіх і такими лишаться. Підписка не відкриває доступ — вона стежить за профілем вашої дитини, пропонує наступний крок і нагадує про дедлайни.'],
      ['Коли запуск?', 'Ми саме дороблюємо Dityam+. Усім, хто в списку, напишемо першими — зі знижкою на старті.'],
      ['А якщо в мене двоє чи більше дітей?', 'У підписці можна завести профіль для кожної дитини. Можливість, що підходить кільком, прийде один раз — із позначкою, кому саме. Місця в добірці діляться між дітьми по черзі.'],
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
      'Reminds you in good time: 2–4 weeks ahead for scholarships and exchanges, a week for clubs',
      'Learns from your “Interested” and “Not interested” marks',
    ],

    mockTitle: 'You tune the selection with one tap',
    mockSub: 'Every opportunity comes with “👍 Interested” and “👎 Not interested”. The more you mark, the sharper the next selection.',
    mockTg: 'This is how it looks on Telegram',
    mockMail: 'This is how it looks by email',
    tg: {
      title: 'ISEF Ukraine — national selection for Regeneron ISEF',
      meta: 'Competition · ages 14-17 · Free · until 31 January 2027',
      text: 'A national science and engineering fair for students in grades 9–11. 22 categories: biochemistry, biomedicine, chemistry, engineering, ML, ecology…',
      more: 'Details →',
      cal: '📅 Add to calendar',
      toast: 'Thanks for the feedback',
    },
    mail: {
      fromLabel: 'From',
      from: 'Dityam+',
      subjectLabel: 'Subject',
      subject: 'New for your child: an entrepreneurship competition',
      hello: 'We found an opportunity that fits your child’s profile:',
      title: 'NFTE Youth Entrepreneurship Challenge',
      meta: 'Competition · ages 13-18 · Free · until 31 October 2026',
      text: 'A global teen entrepreneurship competition in 47+ countries. Team registration is open until the end of October.',
      more: 'Details on dityam.com.ua →',
      foot: 'Mark it — and the next email will be sharper.',
    },
    yes: '👍 Interested',
    no: '👎 Not interested',
    mockNote: 'The “Interested” and “Not interested” buttons are already under every post in our Telegram channel. In Dityam+, your marks will shape the next selections — on Telegram and by email.',

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
      ['Tell us what your child enjoys', 'Age, what they like, format, city and whether to show paid options. Special circumstances only if you choose to share them. Several children — a profile for each. No name, no school.'],
      ['Get what fits the profile', 'The moment a matching opportunity appears, we send it. If nothing new shows up for two weeks, we remind you of what is already open.'],
      ['Never miss a deadline', 'Scholarships, grants and exchanges — 4 and 2 weeks ahead: documents and essays take time. Competitions, olympiads and camps — 2 weeks. Courses and clubs — a week. And a last call a few days before.'],
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
      'a selection for each child’s profile — age, likes, format, city',
      'the next step, based on where you have already applied',
      'deadline reminders in good time — from 4 weeks for scholarships to a week for clubs',
      'delivery on Telegram or by email',
    ],
    trust: (total) => [
      'We never ask for your child’s name or school',
      'The platform stays free for everyone',
      'Cancel with one command',
      total ? `${total.toLocaleString('en-US')} opportunities — new ones added and checked daily` : 'New opportunities added and checked daily',
    ],

    faqTitle: 'Questions',
    faq: [
      ['How is the subscription different from the free platform?', 'Every opportunity on Dityam.com.ua is open to everyone and will stay that way. The subscription does not unlock access — it follows your child’s profile, suggests the next step and reminds you about deadlines.'],
      ['When does it launch?', 'We are finishing Dityam+ now. Everyone on the list hears from us first — with a launch discount.'],
      ['What if I have two or more children?', 'The subscription lets you set up a profile for each child. An opportunity that fits several of them arrives once, marked with who it is for. Slots in each selection are shared between the children in turn.'],
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

          {/* Приклад: пост у Telegram повторює справжній формат нашого каналу
              (scripts/post-to-telegram.mjs, варіант B) із тими самими кнопками
              «👍 Цікаво / 👎 Не цікаво». Лист — ескіз майбутньої розсилки: кнопок
              у пошті поки немає, як і того, щоб позначки міняли добірку. Обидва
              записи — справжні активні можливості з бази. */}
          <div className="pl-mock">
            <h3 className="pl-mock-title">{t.mockTitle}</h3>
            <p className="pl-mock-sub">{t.mockSub}</p>
            <div className="pl-mock-grid">
              <figure className="pl-mock-card" aria-label={t.mockTg}>
                <figcaption className="pl-mock-label">{t.mockTg}</figcaption>
                <div className="pl-tg">
                  <span className="pl-tg-toast" aria-hidden="true">{t.tg.toast}</span>
                  <div className="pl-tg-bubble">
                    <p className="pl-tg-title">✨ {t.tg.title}</p>
                    <p className="pl-tg-meta">{t.tg.meta}</p>
                    <p className="pl-tg-text">{t.tg.text}</p>
                    <p className="pl-tg-more">{t.tg.more}</p>
                  </div>
                  <div className="pl-tg-kb" aria-hidden="true">
                    <span className="pl-tg-btn">{t.tg.cal}</span>
                    <div className="pl-tg-row">
                      <span className="pl-tg-btn is-on">{t.yes}</span>
                      <span className="pl-tg-btn">{t.no}</span>
                    </div>
                  </div>
                </div>
              </figure>

              <figure className="pl-mock-card" aria-label={t.mockMail}>
                <figcaption className="pl-mock-label">{t.mockMail}</figcaption>
                <div className="pl-mail">
                  <div className="pl-mail-head">
                    <div><span>{t.mail.fromLabel}</span>{t.mail.from}</div>
                    <div><span>{t.mail.subjectLabel}</span><strong>{t.mail.subject}</strong></div>
                  </div>
                  <div className="pl-mail-body">
                    <p className="pl-mail-hello">{t.mail.hello}</p>
                    <div className="pl-mail-item">
                      <p className="pl-mail-title">{t.mail.title}</p>
                      <p className="pl-mail-meta">{t.mail.meta}</p>
                      <p className="pl-mail-text">{t.mail.text}</p>
                      <p className="pl-mail-more">{t.mail.more}</p>
                      <div className="pl-mail-btns" aria-hidden="true">
                        <span className="pl-mail-btn">{t.yes}</span>
                        <span className="pl-mail-btn">{t.no}</span>
                      </div>
                    </div>
                    <p className="pl-mail-foot">{t.mail.foot}</p>
                  </div>
                </div>
              </figure>
            </div>
            <p className="pl-mock-note">{t.mockNote}</p>
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
      <section className="pl-sec pl-price-sec">
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
      <section className="pl-sec pl-sec-cream pl-faq-sec">
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
