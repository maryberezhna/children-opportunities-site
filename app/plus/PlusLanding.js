import SubscribeForm from './SubscribeForm';
import PlusFlowDemo from './PlusFlowDemo';
import PlusPathsReveal from './PlusPathsReveal';
import { PLUS_SALES_OPEN, plusBotUrl } from '@/lib/plus';
import { opportunitiesWord } from '@/lib/plural';

/**
 * Лендінг Dityam+.
 *
 * Сторінка обіцяє рівно те, що робить код (звірено 14.09.2026):
 *   профіль для кожної дитини → щоденний добір нового → нагадування про
 *   дедлайни за вікнами типу програми → допомога із заявкою в боті → /stop.
 * Виняток — кнопки «Цікаво / Не цікаво» і «Додати в календар» у переліку й
 * прикладі повідомлень: їх обіцяно наперед (Марія 14.09.2026), примітка під
 * прикладом так і каже.
 *
 * До 14.09.2026 головною тезою була «памʼять»: підписка нібито знає, куди
 * дитина вже подавалась, і пропонує наступну сходинку. У коді цього не було —
 * позначки «я подався» анонімні й не повʼязані з підписником. Тезу прибрано з
 * заголовка, опису, кроків, переліку й повідомлень ботів. Повертати її можна
 * лише разом із кодом, який це робить.
 *
 * Усі дванадцять програм у шляхах і обидва приклади повідомлень — активні
 * записи бази (звірено 14.09.2026). Якщо котрусь закриють, замінити тут.
 *
 * SEO/GEO: власні title/description/OG у page.js, картинка-прев'ю в
 * opengraph-image.js, JSON-LD (FAQPage + Service + BreadcrumbList) нижче.
 */

const L = {
  uk: {
    soon: 'скоро',
    h1a: 'Можливості для дитини ',
    h1script: 'приходять самі',
    h1b: ' — з нагадуванням про дедлайн',
    lead: 'Розкажіть про кожну дитину: вік, вподобання, місто. Щодня ми перебираємо понад тисячу записів і надсилаємо вам у Telegram або на імейл лише те, що підходить, а про дедлайн нагадуємо, поки ще встигаєте подати заявку.',
    cta: 'Стати в список першим',
    how: 'Як це працює ↓',
    priceHint: '179 грн/міс · 1 199 грн/рік',
    stairsLabel: 'Приклад шляху',
    stairsCaption: 'Можливий шлях для дитини 14 років, яка любить біологію. Усі чотири програми є на платформі просто зараз.',
    stairs: [
      ['Школа', 'Олімпіади МОН'],
      ['Україна', 'Мала академія наук'],
      ['Відбір', 'ISEF Ukraine'],
      ['Світ', 'Regeneron ISEF'],
    ],

    contrastTitle: 'Шукати щоразу з нуля — чи отримувати готове',
    contrastA: 'Звичайний пошук',
    contrastAItems: [
      'Щоразу з нуля: пошуковик, соцмережі, чати батьків',
      'Знаходите те саме, що бачили місяць тому',
      'Про дедлайн дізнаєтесь, коли він уже минув',
    ],
    contrastB: 'Dityam+',
    contrastBItems: [
      'Надсилає лише нове й лише те, що підходить вашій дитині',
      'Можливість для кількох дітей приходить один раз, із позначкою, кому саме',
      'Нагадує завчасно: за 2–4 тижні для стипендій і обмінів, за тиждень для гуртків',
      'Додавайте можливість до календаря в один клік',
      // Розіграші й знижки партнерів — з жовтня 2026 (рішення Марії 15.09.2026,
      // задача в Notion). Поки механізму немає, «з жовтня» тут обовʼязкове.
      'Відмічайте «Цікаво» чи «Не цікаво», а з жовтня — беріть участь у розіграшах подарунків і отримуйте знижки від партнерів',
    ],

    mockTitle: 'Що приходить у Telegram або на імейл',
    mockSub: 'Назва, вік, вартість, дедлайн і посилання на деталі — достатньо, щоб за хвилину вирішити, чи подаватись. Під кожною можливістю — «Цікаво», «Не цікаво» і «Додати в календар».',
    flow: {
      channelLabel: 'Канал',
      tabs: { tg: 'Telegram', mail: 'Імейл' },
      play: 'Відтворити',
      pause: 'Пауза',
      steps: [
        ['Приходить нове', 'Лише те, що підходить профілю дитини'],
        ['Тиснете «Цікаво»', 'Або «Не цікаво» — одним дотиком'],
        ['Додаєте в календар', 'Дедлайн уже не загубиться'],
        // Вікна з scraper/deadline_reminders.py: стипендії й обміни — 28/14/3,
        // конкурси й табори — 14/3, гуртки й курси — 7/2. У прикладі 14 днів
        // лише тому, що ISEF Ukraine — конкурс.
        ['Нагадуємо завчасно', 'Стипендії — за 4 тижні, конкурси — за 2, гуртки — за тиждень'],
      ],
      digestHead: '🧡 Нові можливості для вашої дитини',
      title: 'ISEF Ukraine — національний відбір на Regeneron ISEF',
      meta: 'Конкурси/олімпіади · 14–17 р. · безкоштовно',
      forWho: 'для: Дитина 2 (15–18 р.)',
      digestFoot: 'Відібрано під профіль вашої дитини.',
      cal: '📅 Додати в календар',
      yes: '👍 Цікаво',
      no: '👎 Не цікаво',
      toast: 'Дякуємо за відповідь',
      calApp: 'Календар',
      calMonth: 'січ',
      calDay: '31',
      calTitle: 'ISEF Ukraine — кінець подачі',
      calWhen: '31 січня 2027 · весь день',
      calSaved: 'Подію додано',
      remindDate: '17 січня',
      remindHead: '⏳ Нагадуємо заздалегідь: подача закривається через 14 днів',
      remindSub: 'Саме час готувати документи.',
      remindMeta: 'подача до 31 січня',
      remindFoot: 'Підібрано під профіль вашої дитини.',
      mail: {
        fromLabel: 'Від',
        from: 'Dityam.com.ua',
        subjLabel: 'Тема',
        subjDigest: '🧡 Нові можливості для вашої дитини — Dityam+',
        subjRemind: '⏳ Нагадування про дедлайн — Dityam+',
        brand: 'DITYAM+',
        h: 'Нові можливості для вашої дитини',
        lead: 'Підібрано під вік та інтереси дитини.',
      },
    },
    mockNote: 'Приклад на справжній можливості з платформи.',

    pathsTitle: 'Три шляхи з нашої бази',
    pathsSub: 'Не вигадані приклади: усі дванадцять програм нижче є на платформі просто зараз. Підписка надішле кожну з них дитині, якій вона підходить за віком і вподобаннями.',
    // Усі межі віку в траєкторіях закінчуються на 16–18 → «років».
    ages: (a) => `${a} років`,
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
        persona: 'Дитині 14, хоче свою справу',
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
      ['Розкажіть про вподобання дитини', 'Вік, що подобається, формат, місто й чи показувати платне. Особливі обставини — лише за бажанням. Кілька дітей — окремий профіль для кожної. Імені, прізвища чи школи дитини не запитуємо.'],
      ['Отримуйте нове під профіль', 'Щодня перевіряємо нові записи й надсилаємо ті, що підходять кожній дитині. Якщо нового немає два тижні, нагадаємо про те, що вже відкрито.'],
      ['Не пропускайте дедлайни', 'Стипендії, гранти й обміни — за 4 і 2 тижні: на документи й есе потрібен час. Конкурси, олімпіади й табори — за 2 тижні. Курси й гуртки — за тиждень. І останній дзвінок — за кілька днів.'],
      ['Питайте про заявку', 'Не зрозуміло, що заповнювати чи які документи потрібні? Напишіть боту — відповімо там само.'],
    ],

    priceTitle: 'Скільки коштує',
    month: '179 грн',
    monthPer: ' / місяць',
    year: '1 199 грн',
    yearPer: ' / рік',
    yearNote: '≈ 100 грн на місяць',
    // 1 199 грн проти 12 × 179 = 2 148 грн → на 44% менше. Міняючи ціну — перерахувати.
    yearRibbon: 'вигідніше на 44%',
    includedTitle: 'У підписку входить',
    included: [
      'добірка під профіль кожної дитини — вік, вподобання, формат, місто',
      'нагадування про дедлайни завчасно — від 4 тижнів для стипендій до тижня для гуртків',
      'допомога із заявкою — просто напишіть боту',
      'усе приходить у Telegram або на імейл',
    ],
    trust: (total) => [
      'Не запитуємо імені, прізвища чи школи дитини',
      'Платформа лишається безкоштовною для всіх',
      'Скасувати можна одною командою',
      total ? `${total.toLocaleString('uk-UA')} ${opportunitiesWord(total)} — щодня додаємо нові й перевіряємо` : 'Щодня додаємо нові можливості й перевіряємо',
    ],

    faqTitle: 'Питання',
    faq: [
      ['Навіщо платити, якщо всі можливості й так безкоштовні?', 'Платформа безкоштовна й такою лишиться: підписка нічого не ховає. Ви платите за зекономлений час. Щодня ми перебираємо понад тисячу записів і надсилаємо лише те, що підходить віку, вподобанням і місту вашої дитини. А про дедлайн нагадуємо, поки ще встигаєте зібрати документи: за 4 тижні для стипендій і обмінів, за 2 — для конкурсів, за тиждень — для гуртків.'],
      ['Коли можна підписатися?', 'Dityam+ ще не продається — дороблюємо. Хто стане в список зараз, дізнається про старт першим і отримає знижку для перших. Список ні до чого не зобовʼязує й нічого не списує.'],
      ['А якщо під мою дитину нічого не знайдеться?', 'Скажемо прямо, а не мовчатимемо. Коли нового немає два тижні, надішлемо добірку з того, що вже відкрито. А якщо під профіль немає зовсім нічого, запропонуємо його розширити: додати вподобання, сусідній вік чи онлайн-формат.'],
      ['А якщо в мене двоє чи більше дітей?', 'Заведіть профіль для кожної дитини в одній підписці. Можливість, що підходить кільком, прийде один раз — із позначкою, кому саме. Місця в добірці діляться між дітьми по черзі, тож ніхто не лишиться без свого.'],
      ['Чи безпечно розповідати про дитину?', 'Імені, прізвища, школи чи дати народження ми не питаємо. Для добору потрібні лише віковий діапазон, вподобання, формат і місто. Особливі обставини, як-от статус ВПО чи інвалідність, — тільки якщо самі захочете: так покажемо програми з окремим набором саме для таких дітей.'],
      ['Як скасувати?', 'Одною командою /stop у боті — без листів у підтримку й пояснень. Спершу зупиняємо автоматичне списання, потім саму підписку, тож наступного платежу не буде. Якщо гроші списало помилково чи двічі, повернемо повністю.'],
    ],

    joinTitle: 'Станьте першими',
    joinText: 'Dityam+ ще не продається. Залиште контакт — напишемо в день запуску, і для перших буде знижка.',
  },

  en: {
    soon: 'soon',
    h1a: 'Opportunities for your child ',
    h1script: 'come to you',
    h1b: ' — with a deadline reminder',
    lead: 'Tell us about each child: age, interests, city. Every day we go through more than a thousand listings and send you only what fits, on Telegram or by email, and we remind you about the deadline while there is still time to apply.',
    cta: 'Join the list first',
    how: 'How it works ↓',
    priceHint: 'UAH 179/month · UAH 1,199/year',
    stairsLabel: 'An example path',
    stairsCaption: 'A possible path for a 14-year-old who loves biology. All four programmes are on the platform right now.',
    stairs: [
      ['School', 'National olympiads'],
      ['Ukraine', 'Junior Academy of Sciences'],
      ['Selection', 'ISEF Ukraine'],
      ['World', 'Regeneron ISEF'],
    ],

    contrastTitle: 'Search from zero every time — or get it delivered',
    contrastA: 'A regular search',
    contrastAItems: [
      'From zero every time: search engines, social media, parent chats',
      'You find the same things you saw a month ago',
      'You learn about a deadline after it has passed',
    ],
    contrastB: 'Dityam+',
    contrastBItems: [
      'Sends only what is new and only what fits your child',
      'An opportunity for several children arrives once, marked with who it is for',
      'Reminds you in good time: 2–4 weeks ahead for scholarships and exchanges, a week for clubs',
      'Add an opportunity to your calendar in one click',
      'Mark “Interested” or “Not interested”, and from October join partner giveaways and get partner discounts',
    ],

    mockTitle: 'What arrives on Telegram or by email',
    mockSub: 'Title, age, cost, deadline and a link to the details — enough to decide in a minute whether to apply. Every opportunity comes with “Interested”, “Not interested” and “Add to calendar”.',
    flow: {
      channelLabel: 'Channel',
      tabs: { tg: 'Telegram', mail: 'Email' },
      play: 'Play',
      pause: 'Pause',
      steps: [
        ['A new match arrives', 'Only what fits your child’s profile'],
        ['You tap “Interested”', 'Or “Not interested” — one tap'],
        ['You add it to your calendar', 'The deadline won’t get lost'],
        ['We remind you early', 'Scholarships 4 weeks ahead, contests 2 weeks, clubs 1 week'],
      ],
      digestHead: '🧡 New opportunities for your child',
      title: 'ISEF Ukraine — National Selection for Regeneron ISEF',
      meta: 'Contests & olympiads · ages 14–17 · free',
      forWho: 'for: Child 2 (15–18)',
      digestFoot: 'Selected for your child’s profile.',
      cal: '📅 Add to calendar',
      yes: '👍 Interested',
      no: '👎 Not interested',
      toast: 'Thanks for your answer',
      calApp: 'Calendar',
      calMonth: 'Jan',
      calDay: '31',
      calTitle: 'ISEF Ukraine — applications close',
      calWhen: '31 January 2027 · all day',
      calSaved: 'Event added',
      remindDate: '17 January',
      remindHead: '⏳ Early reminder: applications close in 14 days',
      remindSub: 'Time to prepare the documents.',
      remindMeta: 'apply by 31 January',
      remindFoot: 'Selected for your child’s profile.',
      mail: {
        fromLabel: 'From',
        from: 'Dityam.com.ua',
        subjLabel: 'Subject',
        subjDigest: '🧡 New opportunities for your child — Dityam+',
        subjRemind: '⏳ Deadline reminder — Dityam+',
        brand: 'DITYAM+',
        h: 'New opportunities for your child',
        lead: 'Selected for your child’s age and interests.',
      },
    },
    mockNote: 'An example built on a real opportunity from the platform.',

    pathsTitle: 'Three paths from our database',
    pathsSub: 'Not made-up examples: all twelve programmes below are on the platform right now. The subscription sends each of them to a child it fits by age and interests.',
    ages: (a) => `ages ${a}`,
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
      ['Tell us what your child enjoys', 'Age, what they like, format, city and whether to show paid options. Special circumstances only if you choose to share them. Several children — a profile for each. We don’t ask for your child’s name, surname or school.'],
      ['Get what fits the profile', 'Every day we check new listings and send the ones that fit each child. If nothing new shows up for two weeks, we remind you of what is already open.'],
      ['Never miss a deadline', 'Scholarships, grants and exchanges — 4 and 2 weeks ahead: documents and essays take time. Competitions, olympiads and camps — 2 weeks. Courses and clubs — a week. And a last call a few days before.'],
      ['Ask about the application', 'Not sure what to fill in or which documents you need? Message the bot — we answer right there.'],
    ],

    priceTitle: 'Pricing',
    month: 'UAH 179',
    monthPer: ' / month',
    year: 'UAH 1,199',
    yearPer: ' / year',
    yearNote: '≈ UAH 100 a month',
    yearRibbon: '44% cheaper',
    includedTitle: 'The subscription includes',
    included: [
      'a selection for each child’s profile — age, likes, format, city',
      'deadline reminders in good time — from 4 weeks for scholarships to a week for clubs',
      'help with applications — just message the bot',
      'everything arrives on Telegram or by email',
    ],
    trust: (total) => [
      'We don’t ask for your child’s name, surname or school',
      'The platform stays free for everyone',
      'Cancel with one command',
      total ? `${total.toLocaleString('en-US')} opportunities — new ones added and checked daily` : 'New opportunities added and checked daily',
    ],

    faqTitle: 'Questions',
    faq: [
      ['Why pay if every opportunity is free anyway?', 'The platform is free and will stay that way: the subscription hides nothing. You pay for the time you save. Every day we go through more than a thousand listings and send only what fits your child’s age, interests and city. And we remind you about a deadline while there is still time to gather documents: 4 weeks ahead for scholarships and exchanges, 2 for competitions, a week for clubs.'],
      ['When can I subscribe?', 'Dityam+ is not on sale yet — we are finishing it. Join the list now and you hear about the launch first, with an early-bird discount. The list commits you to nothing and charges nothing.'],
      ['What if nothing fits my child?', 'We will tell you plainly instead of going quiet. If nothing new appears for two weeks, we send a selection from what is already open. If nothing fits the profile at all, we suggest widening it: another interest, a neighbouring age or the online format.'],
      ['What if I have two or more children?', 'Set up a profile for each child in one subscription. An opportunity that fits several of them arrives once, marked with who it is for. Slots in each selection are shared between the children in turn, so nobody misses out.'],
      ['Is it safe to tell you about my child?', 'We never ask for your child’s name, surname, school or date of birth. Matching needs only an age range, interests, format and city. Special circumstances, such as displacement or disability, only if you choose to share them: that way we can show programmes with a separate intake for those children.'],
      ['How do I cancel?', 'One command, /stop, in the bot — no emails to support, no explanations. We stop the recurring payment first, then the subscription, so there is no next charge. If money was taken by mistake or twice, we refund it in full.'],
    ],

    joinTitle: 'Be the first',
    joinText: 'Dityam+ is not on sale yet. Leave a contact — we will write on launch day, with a discount for early members.',
  },
};

// Коли продаж відкрито (PLUS_SALES_OPEN у lib/plus.js), ці рядки замінюють
// «скоро» й список очікування. faqWhen стає на місце другого питання —
// «Коли можна підписатися?» (індекс 1 в обох мовах).
const OPEN = {
  uk: {
    cta: 'Оформити в Telegram',
    faqWhen: ['Як підписатися?', 'У Telegram-боті @DityamPlusBot: кілька питань про кожну дитину, вибір — надсилати в Telegram чи на імейл, потім оплата через WayForPay. Хто був у списку очікування, отримує перший місяць за 89 грн.'],
    joinTitle: 'Оформити Dityam+',
    joinText: 'Кілька хвилин у Telegram-боті: питання про дитину, потім оплата. Останні можливості під профіль — у меню бота одразу після оплати.',
  },
  en: {
    cta: 'Subscribe on Telegram',
    faqWhen: ['How do I subscribe?', 'In the @DityamPlusBot Telegram bot: a few questions about each child, a choice of Telegram or email delivery, then payment through WayForPay. People from the waiting list get their first month for UAH 89.'],
    joinTitle: 'Get Dityam+',
    joinText: 'A few minutes in the Telegram bot: questions about your child, then payment. The latest matching opportunities are in the bot menu right after payment.',
  },
};

const SITE = 'https://dityam.com.ua';

// Структуровані дані. FAQPage — питання, які AI-асистенти й Google цитують
// дослівно; Service — що це за послуга й скільки коштує; BreadcrumbList —
// шлях «Головна › Dityam+» у видачі. Текст береться з тих самих рядків, що й
// видимий на сторінці, тож розмітка не може розійтися з контентом.
function jsonLd(t, lang) {
  const en = lang === 'en';
  const home = en ? `${SITE}/en` : SITE;
  const url = en ? `${SITE}/en/plus` : `${SITE}/plus`;
  const strip = (x) => String(x).replace(/\s+/g, ' ').trim();
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Service',
        '@id': `${url}#service`,
        name: 'Dityam+',
        url,
        serviceType: en
          ? 'Personal selection of opportunities for children and deadline reminders'
          : 'Персональна добірка можливостей для дітей і нагадування про дедлайни',
        description: strip(t.lead),
        provider: { '@id': `${SITE}/#org` },
        areaServed: [{ '@type': 'Country', name: en ? 'Ukraine' : 'Україна' }],
        audience: { '@type': 'PeopleAudience', suggestedMinAge: 0, suggestedMaxAge: 18 },
        availableChannel: {
          '@type': 'ServiceChannel',
          name: 'Telegram',
          serviceUrl: 'https://t.me/DityamPlusBot',
        },
        offers: [
          { '@type': 'Offer', name: en ? 'Monthly' : 'Місячна підписка', price: '179', priceCurrency: 'UAH' },
          { '@type': 'Offer', name: en ? 'Yearly' : 'Річна підписка', price: '1199', priceCurrency: 'UAH' },
        ],
      },
      {
        '@type': 'FAQPage',
        '@id': `${url}#faq`,
        mainEntity: t.faq.map(([q, a]) => ({
          '@type': 'Question',
          name: strip(q),
          acceptedAnswer: { '@type': 'Answer', text: strip(a) },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: en ? 'Home' : 'Головна', item: home },
          { '@type': 'ListItem', position: 2, name: 'Dityam+', item: url },
        ],
      },
    ],
  };
}

export default function PlusLanding({ lang = 'uk', total = null }) {
  const base = L[lang] || L.uk;
  const open = PLUS_SALES_OPEN ? (OPEN[lang] || OPEN.uk) : null;
  const t = open
    ? { ...base, ...open, faq: base.faq.map((item, i) => (i === 1 ? open.faqWhen : item)) }
    : base;

  return (
    <main className="pl" lang={lang === 'en' ? 'en' : undefined}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(t, lang)) }}
      />
      {/* ── Хіро: теза сторінки — сходинки, а не список фіч ── */}
      <section className="pl-hero">
        <div className="pl-wrap pl-hero-grid">
          <div className="pl-hero-copy">
            <div className="pl-badges">
              <span className="pl-badge">Dityam+</span>
              {!PLUS_SALES_OPEN && <span className="pl-badge pl-badge-soon">{t.soon}</span>}
            </div>
            <h1 className="pl-h1">
              {t.h1a}<span className="pl-script">{t.h1script}</span>{t.h1b}
            </h1>
            <p className="pl-lead">{t.lead}</p>
            <div className="pl-cta-row">
              <a href={PLUS_SALES_OPEN ? plusBotUrl(`plus_${lang}`) : '#join'} className="pl-btn">{t.cta}</a>
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

          {/* Флоу підписки на одній можливості: дайджест → «Цікаво» → календар →
              нагадування. Формат повідомлень — scraper/personal_digest.py
              (build_telegram, build_email) і scraper/deadline_reminders.py.
              ISEF Ukraine звірено з базою 14.09.2026: 14–17, безкоштовно,
              конкурс (нагадування за 14 і 3 дні), подача до 31.01.2027.
              Кнопки «Цікаво / Не цікаво» і «Додати в календар» є і в
              справжніх повідомленнях з 15.09.2026: у листі — посилання
              (/api/plus/feedback, /events/<slug>/add), у Telegram — кнопки
              під добіркою (pfb: у /api/telegram/plus). Календар — лише для
              записів із дедлайном. */}
          <div className="pl-mock">
            <h3 className="pl-mock-title">{t.mockTitle}</h3>
            <p className="pl-mock-sub">{t.mockSub}</p>
            <PlusFlowDemo f={t.flow} />
            <p className="pl-mock-note">{t.mockNote}</p>
          </div>
        </div>
      </section>

      {/* ── Три траєкторії: реальні записи бази ── */}
      <section className="pl-sec">
        {/* Ширше за решту сторінки: у 1120px три картки мали по ~340px, і назви
            програм ламались на два-три рядки (Марія 14.09.2026: «щоб приклади
            більше місця зайняли»). */}
        <div className="pl-wrap pl-wrap-wide">
          <h2 className="pl-h2">{t.pathsTitle}</h2>
          <p className="pl-sub">{t.pathsSub}</p>
          {/* --p і --i — номер шляху й сходинки для затримок анімації
              (plus-landing.css, «Поява шляхів»). */}
          <PlusPathsReveal className="pl-paths">
            {t.paths.map((p, pi) => (
              <article key={p.title} className="pl-path" style={{ '--p': pi }}>
                <p className="pl-persona">{p.persona}</p>
                <h3 className="pl-path-title">{p.title}</h3>
                <ol className="pl-steps">
                  {p.steps.map(([lvl, name, age], i) => (
                    <li key={name} className="pl-step" style={{ '--i': i }}>
                      <span className="pl-step-meta">
                        <span className="pl-step-lvl">{lvl}</span>
                        <span className="pl-step-age">{t.ages(age)}</span>
                      </span>
                      <span className="pl-step-t">{name}</span>
                    </li>
                  ))}
                </ol>
                <p className="pl-why">{p.why}</p>
              </article>
            ))}
          </PlusPathsReveal>
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
              {/* «Скасувати можна будь-коли» під ціною прибрано на прохання
                  Марії 14.09.2026 — підпис показуємо, лише коли він є. */}
              {t.monthNote ? <div className="pl-price-note">{t.monthNote}</div> : null}
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
