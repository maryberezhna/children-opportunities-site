/**
 * Тематичні сторінки-підбірки.
 *
 * Навіщо. У Search Console видно розрив: за назвами конкретних програм нас
 * показують часто (позиції 4–10), але клікають рідко — прямо над нами сайт
 * організатора, і агрегатор там програє завжди. Натомість за запитами-
 * категоріями («безкоштовні конкурси для дітей», «безкоштовні табори»,
 * «олімпіада з інформатики») ми на 20–33 позиції, бо відповідати на них нема
 * чим, крім головної — а головна ні про що конкретне, її середня позиція 14.
 *
 * Ці сторінки — відповідь саме на такі запити: тема в H1, текст, який пояснює
 * суть, і живий список із каталогу.
 *
 * Правила добору свідомо ширші за фільтр каталогу: тип у базі проставляє
 * модель, і «олімпіада» іноді лежить як competition, а «табір» як
 * rehabilitation. Дублювати сюди фільтр означало б втрачати саме ті записи,
 * заради яких людина прийшла.
 */

/**
 * Збіг лише по НАЗВІ й лише з початку слова.
 *
 * По опису не шукаємо: згадка «оздоровлення» в описі інклюзивно-ресурсного
 * центру затягувала його на сторінку таборів, а «майстер-класи» в описі
 * піаністичного конкурсу — на сторінку гуртків. Для сторінки-підбірки
 * точність важливіша за повноту: зайвий запис виглядає як поламана сторінка.
 *
 * Початок слова важливий окремо: без нього «курс» ловив усі 91 «конКУРС».
 * Виконується на сервері, тож lookbehind тут безпечний.
 */
import { isOnline } from './geo.js';
import {
  isDiaspora, inDiasporaCountry, liveCountryPages, hubGroups, countryName, inCountry,
  DIASPORA_COUNTRIES, MIN_COUNTRY, SCHOOL_NOTES,
} from './diaspora.js';

const has = (o, re) =>
  new RegExp(`(?<![а-яіїєґa-z])(?:${re.source})`, re.flags).test(o.title || '');

/**
 * Що таке «обмін». Одне визначення на дві підбірки: /prohramy-obminu його
 * бере, /za-kordon — відкидає.
 *
 * Навіщо (28.09.2026). Обидві сторінки виходили в Google на той самий запит
 * «навчання за кордоном для українських дітей» — 5-та і 6-та позиції поспіль,
 * — і ділили трафік: у обмінів 205 входів за місяць, у «За кордон» 16. При
 * цьому 18 із 29 записів обмінів стояли й там, і там.
 *
 * Тепер сторінки розведені за НАМІРОМ, а не за словами:
 *   /prohramy-obminu — поїхати ВЧИТИСЯ: рік чи семестр у школі;
 *   /za-kordon       — поїхати НЕ вчитися: табір, конкурс, олімпіада,
 *                      волонтерство, стипендія.
 */
export const EXCHANGE_RE = /обмін|exchange|\bflex\b|\bafs\b|ugrad|erasmus|rotary/i;

/**
 * Єдине правило для обох сторінок: true → запис належить /prohramy-obminu,
 * false → може потрапити в /za-kordon. Одна функція, а не два схожі списки,
 * саме щоб перетин не міг відрости назад: перша спроба розвести їх лише за
 * словом EXCHANGE_RE лишила 8 спільних записів, бо ті попадали в обміни за
 * типом (`exchange`, `internship`, `residency`), а слова «обмін» не мали.
 */
export const isExchangeProgramme = (o) =>
  ['exchange', 'study_program', 'internship', 'residency'].includes(o?.opportunity_type)
  || has(o, EXCHANGE_RE);

/** Типи, за якими дитина фізично їде: для записів без країни. */
const ABROAD_TYPES = new Set([
  'exchange', 'study_program', 'scholarship', 'summer_school', 'residency',
  'internship', 'camp', 'conference', 'olympiad', 'competition', 'volunteer',
  'festival', 'hackathon',
]);
/** І навпаки: типи, які навіть із країною не є поїздкою. */
const ABROAD_EXCLUDE = new Set(['humanitarian', 'club', 'workshop', 'grant', 'educational_material']);

/**
 * Поля шаблону підбірки (app/TopicPage.js, вересень 2026):
 *   heading   { lead, script, tail } — H1, де script пишеться Caveat;
 *   heroImage { src, alt, position? } — фото праворуч у хіро (src без
 *             розширення, поруч лежать .webp і .jpg); position — точка
 *             фокуса для обрізання, як object-position ('30% 40%'), за
 *             замовчуванням центр; без heroImage хіро в одну колонку;
 *   related   ['slug', …] — «Інші підбірки»; без нього — найбільші за кількістю;
 *   subfilters [{ key, label, labelEn, types }] — свої пігулки; без них
 *             пігулки рахуються з типів, що є в підбірці;
 *   guide     { href, label } — посилання на путівник під вступом (у en —
 *             лише якщо задано в topic.en.guide);
 *   parent    slug підбірки-батька — ще одна ланка хлібних крихт (сторінки
 *             країн під «Українським дітям за кордоном»);
 *   minItems  менше відкритих записів — сторінка віддає 404;
 *   groups    (items, lang) → { links, groups } — список розбитий на групи
 *             із заголовками замість пігулок (хаб діаспори: країни).
 * h1 лишається: його читають міські підбірки.
 */
/*
 * Фото підбірок — Unsplash, вільна ліцензія (дозволяє комерційне використання
 * без згадки автора). 900×600, поруч лежить .webp; сторінка підставляє
 * розширення сама, тож heroImage.src іде без нього.
 *
 * Додані 30.09.2026 на правило Марії «у підбірках завжди має бути картинка»:
 *   topic-onlain          photo-1623076189461-f7706b741c04
 *   topic-volonterstvo    photo-1544928938-6852c1925194
 *   topic-dopomoha        photo-1589169011402-8b2cbd1ee593
 *   topic-psykholohichna  photo-1560707856-3af2ff5ea652
 *   topic-diaspora        photo-1780844824578-d0b1a5b4b329
 *
 * Додано 02.10.2026 разом із підбіркою «Іноземні мови»:
 *   topic-movy            photo-1577896851231-70ef18881754
 */

/** Безкоштовне заняття — без огляду на те, онлайн воно чи ні. */
const hurtokBase = (o) =>
  o.cost_type === 'free' &&
  !o.aid_type &&
  (['club', 'course', 'workshop', 'educational_material'].includes(o.opportunity_type) ||
    has(o, /гурток|гуртк|курс|майстер-клас|секці|студі/i));

/**
 * Іноземна мова в назві запису. Української тут свідомо немає: суботні школи
 * діаспори мають власну підбірку, а ця відповідає на запит «курси англійської
 * для дітей». Олімпіади й конкурси з мови відсікає тип (LANGUAGE_TYPES) —
 * людина шукає, де вчити мову, а не де з неї змагатися.
 */
export const LANGUAGE_RE =
  /англійськ|німецьк|польськ|французьк|іспанськ|італійськ|чеськ|іноземн\S* мов|мовн\S* (?:клуб|курс|школ)|english|speaking/i;
const LANGUAGE_TYPES = ['course', 'club', 'workshop', 'study_program', 'educational_material', 'mentorship'];

export const TOPICS = {
  'bezkoshtovni-hurtky': {
    slug: 'bezkoshtovni-hurtky',
    nav: 'Гуртки та курси',
    navEn: 'Clubs & courses',
    h1: ['Безкоштовні гуртки та курси', 'для дітей'],
    heading: { lead: 'Безкоштовні', script: 'гуртки', tail: ' та курси для дітей' },
    title: 'Безкоштовні гуртки та курси для дітей у містах України',
    description:
      'Безкоштовні гуртки, курси й майстер-класи для дітей 0–18 років у містах України: програмування, мистецтво, мови, спорт, наука. Оновлюється щодня. Заняття, що проходять тільки онлайн, — в окремій підбірці.',
    intro:
      'Гуртки й курси, за які не треба платити: державні, від громадських організацій, університетів і бізнесу. Тут те, куди дитина ходить — у своєму місті або поруч; заняття, що працюють лише онлайн, зібрані в підбірці «Онлайн-заняття».',
    note:
      // Твердження про ручну перевірку прибрано 14.09.2026 на прохання Марії: записи проходять автоматичні ворота, людина дивиться лише сумнівні.
      'Платформа не бере комісії ні з організаторів, ні з родин: ми збираємо в одному місці те, що вже існує, і кожен запис веде на офіційну сторінку організатора.',
    // FAQ: видимий блок + FAQPage-схема. Питання — реальні запити з пошуку;
    // відповіді самодостатні, щоб AI-асистент міг процитувати їх дослівно.
    faq: [
      {
        q: 'Чи справді всі гуртки в цій підбірці безкоштовні?',
        a: 'Так. Сюди потрапляють лише гуртки, курси й майстер-класи з безкоштовною участю: державні програми, проєкти громадських організацій, університетів і бізнесу. Вартість визначаємо за текстом на сторінці організатора, і кожна картка веде саме туди — перевірте умови перед записом.',
      },
      {
        q: 'Чи можна займатися онлайн з іншого міста або з-за кордону?',
        a: 'Так. Частина гуртків і курсів працює онлайн — у каталозі це позначено форматом на картці. Долучитися можна з будь-якого міста України або з-за кордону.',
      },
      {
        q: 'Як записатися на безкоштовний гурток?',
        a: 'Кожна картка на платформі веде на офіційну сторінку організатора — запис відбувається саме там. Dityam.com.ua не бере комісії та не збирає заявок.',
      },
    ],
    // Англійська версія — не переклад, а своя сторінка під свої запити.
    // Українську писали під «безкоштовні гуртки для дітей»; англійською так
    // не шукають — шукають батьки, що виїхали, і формулюють через «online»
    // та «Ukrainian children», тож саме ці слова тут і несучі.
    en: {
      slug: 'free-clubs-and-courses',
      heroImage: { src: '/topic-hurtky', alt: 'Children gathered around a 3D printer in a class' },
      h1: ['Free clubs and courses', 'for children'],
      heading: { lead: 'Free', script: 'clubs', tail: ' and courses for children' },
      title: 'Free clubs and courses for Ukrainian children — online and in Ukraine',
      description:
        'Free clubs, courses and workshops for children aged 0–18: coding, art, languages, science. Online and across Ukraine, open to families abroad. Updated daily.',
      intro:
        'Clubs and courses that cost nothing: run by the state, by charities, universities and companies. Many are online, so a child can join from another city — or from another country.',
      note:
        'Dityam.com.ua takes no commission from organisers or families: we collect what already exists in one place, and every listing links to the organiser’s official page.',
      faq: [
        {
          q: 'Are these clubs really free?',
          a: 'Yes. Only clubs, courses and workshops with free participation are listed here: state programmes, projects by charities, universities and companies. We take the cost from the organiser’s own page, and every card links there — check the terms before signing up.',
        },
        {
          q: 'Can a child join online from abroad?',
          a: 'Yes. Many clubs and courses run online — the format is shown on each card. A child can join from anywhere in Ukraine or from another country.',
        },
        {
          q: 'How do I sign my child up?',
          a: 'Every card links to the organiser’s own page, and registration happens there. Dityam takes no commission and collects no applications — it is an open listing.',
        },
      ],
    },
    heroImage: { src: '/topic-hurtky', alt: 'Діти гуртом розглядають 3D-принтер на занятті' },
    // Головна сторінка — те, куди дитина ходить: онлайн звідси прибрано
    // 30.09.2026, бо title обіцяв «онлайн і в містах України», а окрема
    // сторінка онлайн-занять ловила б той самий запит.
    match: (o) => hurtokBase(o) && !isOnline(o),
    // А от на сторінці міста всеукраїнський онлайн-гурток лишається: батькам
    // у малому місті він доступний так само, як місцевий, і ховати його
    // означало б відповідати на запит гірше, ніж уміємо (див. коментар до
    // inCityOrNationwide у lib/city-topics.js).
    cityMatch: hurtokBase,
  },


  // Онлайн — найбільша тема, під яку сторінки не було. 30.09.2026 у базі 66
  // безкоштовних онлайн-занять, і всі вони лежали в «Гуртках», title яких
  // прямо обіцяв «онлайн і в містах України». Тобто одна сторінка ловила два
  // різні запити й жоден добре.
  //
  // Тепер «Гуртки» — те, куди дитина ходить, ця сторінка — те, до чого
  // під'єднується. Записи з «Гуртків» не вилучено: на міських сторінках
  // всеукраїнський онлайн-гурток лишається видимим (див. inCityOrNationwide у
  // lib/city-topics.js) — батькам у малому місті він доступний так само, як
  // місцевий, і ховати його означало б відповідати гірше, ніж уміємо.
  'bezkoshtovni-onlain-kursy': {
    slug: 'bezkoshtovni-onlain-kursy',
    nav: 'Онлайн-заняття',
    navEn: 'Online classes',
    h1: ['Безкоштовні онлайн-курси', 'та гуртки для дітей'],
    heading: { lead: 'Безкоштовні', script: 'онлайн-курси', tail: ' та гуртки для дітей' },
    title: 'Безкоштовні онлайн-курси та гуртки для дітей 2026 — з будь-якого міста',
    description:
      'Безкоштовні онлайн-курси, гуртки й мовні клуби для дітей і підлітків: програмування, мови, наука, мистецтво. Долучитись можна з будь-якого міста України та з-за кордону. Оновлюється щодня.',
    intro:
      'Заняття, до яких дитина під\u2019єднується з дому: онлайн-курси, мовні клуби, вебінари й навчальні платформи. Місто не має значення — це те, що працює і в селі, і за кордоном, коли поруч немає потрібного гуртка. Усе безкоштовне.',
    note:
      'Онлайн-заняття зазвичай не мають дедлайну, але мають розклад і набір у групи — місця розбирають швидше, ніж закінчується реєстрація. Формат кожного заняття вказано на картці: частина йде в прямому ефірі, частина записом.',
    faq: [
      {
        q: 'Де знайти безкоштовні онлайн-курси для дитини?',
        a: 'У цій підбірці зібрані онлайн-курси, гуртки й мовні клуби для дітей 0–18 років, за які не треба платити: від державних платформ, громадських організацій, університетів і бізнесу. Кожна картка веде на офіційну сторінку організатора, де відбувається запис.',
      },
      {
        q: 'Чи можна вчитися онлайн, якщо дитина за кордоном?',
        a: 'Так — це головна перевага онлайн-занять: місце проживання не має значення, потрібен лише інтернет. Українські онлайн-курси й мовні клуби доступні з будь-якої країни. Для родин, які вже живуть за кордоном, є ще й окрема підбірка з тим, що організують на місці.',
      },
      {
        q: 'Чим онлайн-заняття відрізняються від гуртків у місті?',
        a: 'Онлайн не залежить від міста й дороги, тож підходить там, де поруч немає потрібного напряму. Натомість гурток поруч дає живе спілкування й простіше тримає дитину в розкладі. Те, куди дитина ходить, зібрано в підбірці «Гуртки та курси».',
      },
    ],
    related: ['bezkoshtovni-hurtky', 'konkursy', 'ukrainskym-ditiam-za-kordonom'],
    en: {
      slug: 'free-online-courses',
      heroImage: { src: '/topic-onlain', alt: 'A girl in headphones following an online class on a laptop' },
      h1: ['Free online courses', 'and clubs for children'],
      heading: { lead: 'Free', script: 'online courses', tail: ' and clubs for children' },
      title: 'Free online courses and clubs for Ukrainian children 2026 — from anywhere',
      description:
        'Free online courses, clubs and language groups for children and teenagers: programming, languages, science, art. Open from any city in Ukraine and from abroad. Updated daily.',
      intro:
        'Classes a child joins from home: online courses, language clubs, webinars and learning platforms. Location does not matter — this is what works in a village or abroad, when the right club is nowhere nearby. All of it free.',
      note:
        'Online classes rarely have a deadline, but they do have a schedule and group intakes — places usually go before registration closes. The format is on each card: some run live, some are recorded.',
      faq: [
        {
          q: 'Where can we find free online courses for a child?',
          a: 'This collection holds online courses, clubs and language groups for children aged 0–18 that cost nothing: from state platforms, civic organisations, universities and business. Every card links to the organiser’s own page, where registration happens.',
        },
        {
          q: 'Can a child study online while abroad?',
          a: 'Yes — that is the point of online classes: where you live does not matter, only the internet does. Ukrainian online courses and language clubs are open from any country. Families already living abroad also have a separate collection of what is organised locally.',
        },
        {
          q: 'How is this different from clubs in a city?',
          a: 'Online does not depend on a city or a commute, so it works where the right subject is nowhere nearby. A local club, in turn, gives live contact and keeps a child to a schedule more easily. Places a child physically attends are in the “Clubs & courses” collection.',
        },
      ],
    },
    // Сторінки «онлайн у Києві» не буває: заняття не привʼязане до міста,
    // і така сторінка відповідала б на запит, якого ніхто не ставить.
    noCityPages: true,
    heroImage: { src: '/topic-onlain', alt: 'Дівчинка в навушниках слухає онлайн-заняття за ноутбуком' },
    match: (o) =>
      o.cost_type === 'free' &&
      !o.aid_type &&
      isOnline(o) &&
      (['club', 'course', 'workshop', 'educational_material', 'study_program', 'mentorship']
        .includes(o.opportunity_type)
        || has(o, /курс|гурток|гуртк|заняття|клуб|школа|вебінар/i)),
  },

  // Іноземні мови, 02.10.2026. Марія: «вистрілить вивчення мови для дітей».
  // До того мовні записи були розкидані по «Гуртках» і «Онлайн-заняттях», і
  // лише безкоштовні: платні школи не потрапляли в жодну підбірку. Ця —
  // перша, де платне стоїть поруч із безкоштовним: на запит «курси
  // англійської для дітей» людина чекає саме шкіл, а вартість видно на
  // картці й у фільтрі. Стоїть після безкоштовних підбірок, тож крихта
  // безкоштовного мовного клубу лишається «Онлайн-заняття» чи «Гуртки».
  'inozemni-movy': {
    slug: 'inozemni-movy',
    nav: 'Іноземні мови',
    navEn: 'Languages',
    h1: ['Курси іноземних мов', 'для дітей'],
    heading: { lead: 'Курси', script: 'іноземних мов', tail: ' для дітей' },
    title: 'Курси англійської та інших іноземних мов для дітей 2026 — онлайн і в містах',
    description:
      'Школи й курси іноземних мов для дітей і підлітків: англійська, німецька, польська, французька, іспанська. Онлайн-школи та школи у Києві, Дніпрі, Львові, Харкові й Одесі, безкоштовні й платні. Вік і вартість на кожній картці.',
    intro:
      'Школи й курси, де дитина вчить іноземну мову: англійську, німецьку, польську, французьку чи іспанську. Є онлайн-школи, до яких можна долучитися з будь-якого міста, і школи з класами у Києві, Дніпрі, Львові, Харкові та Одесі. Безкоштовні програми стоять поруч із платними курсами — вартість видно на кожній картці.',
    note:
      'Мовні школи набирають учнів протягом року, тому дедлайну в більшості карток немає. Багато шкіл починають із безкоштовного пробного уроку, на якому визначають рівень дитини. Ціну ми беремо зі сторінки школи в день перевірки — перед записом звірте її на сайті школи.',
    faq: [
      {
        q: 'Де знайти курси англійської для дитини?',
        a: 'У цій підбірці зібрані школи й курси англійської для дітей і підлітків: онлайн-школи з індивідуальними та груповими уроками і школи з класами у великих містах. На кожній картці вказані вік, формат і вартість, а посилання веде на сторінку школи, де відбувається запис.',
      },
      {
        q: 'Чи є безкоштовні курси іноземних мов для дітей?',
        a: 'Так. Безкоштовні програми стоять у цій самій підбірці поруч із платними: розмовні клуби, онлайн-платформи й курси від громадських організацій і фондів. Щоб побачити лише їх, позначте над списком «Лише безкоштовні».',
      },
      {
        q: 'З якого віку дитині починати вчити іноземну мову?',
        a: 'Частина шкіл із цієї підбірки бере дітей уже з трьох років: для дошкільнят заняття проходять у формі гри. Для школярів і підлітків є окремі групи, зокрема з підготовкою до міжнародних іспитів. Вік, на який розрахований курс, вказано на кожній картці.',
      },
    ],
    related: ['bezkoshtovni-onlain-kursy', 'bezkoshtovni-hurtky', 'prohramy-obminu'],
    en: {
      slug: 'language-courses',
      heroImage: { src: '/topic-movy', alt: 'A teacher at the blackboard and pupils with raised hands in a classroom with a map of Europe' },
      h1: ['Language courses', 'for children'],
      heading: { lead: 'Foreign', script: 'language courses', tail: ' for children' },
      title: 'English and other language courses for children in Ukraine 2026 — online and in cities',
      description:
        'Language schools and courses for children and teenagers: English, German, Polish, French, Spanish. Online schools and schools in Kyiv, Dnipro, Lviv, Kharkiv and Odesa, free and paid. Age and price on every card.',
      intro:
        'Schools and courses where a child learns a foreign language: English, German, Polish, French or Spanish. Some are online and open from any city; others have classrooms in Kyiv, Dnipro, Lviv, Kharkiv and Odesa. Free programmes sit next to paid courses — the price is on every card.',
      note:
        'Language schools enrol all year round, so most cards have no deadline. Many schools start with a free trial lesson where the child’s level is assessed. Prices come from the school’s own page on the day we checked it — confirm them with the school before enrolling.',
      faq: [
        {
          q: 'Where can we find an English course for a child?',
          a: 'This collection holds English schools and courses for children and teenagers: online schools with one-to-one and group lessons, and schools with classrooms in the big cities. Every card shows age, format and price, and links to the school’s own page, where enrolment happens.',
        },
        {
          q: 'Are there free language courses for children?',
          a: 'Yes. Free programmes are in this same collection next to the paid ones: speaking clubs, online platforms and courses run by civic organisations and charities. To see only those, tick “Free only” above the list.',
        },
        {
          q: 'At what age should a child start a foreign language?',
          a: 'Some schools in this collection take children from the age of three: for preschoolers the lessons are built around play. Schoolchildren and teenagers have their own groups, including preparation for international exams. The age each course is meant for is on its card.',
        },
      ],
    },
    heroImage: { src: '/topic-movy', alt: 'Вчителька біля дошки й учні з піднятими руками в класі з картою Європи' },
    match: (o) =>
      !o.aid_type &&
      LANGUAGE_TYPES.includes(o.opportunity_type) &&
      has(o, LANGUAGE_RE),
  },

  konkursy: {
    slug: 'konkursy',
    nav: 'Конкурси',
    navEn: 'Contests',
    h1: ['Конкурси для дітей', 'та підлітків'],
    heading: { lead: 'Конкурси для', script: 'дітей', tail: ' та підлітків' },
    title: 'Безкоштовні конкурси для дітей 2026 — творчі, наукові, міжнародні',
    description:
      'Конкурси для дітей і підлітків 0–18 років: творчі, наукові, ІТ, міжнародні. Здебільшого безкоштовна участь, актуальні дедлайни. Оновлюється щодня.',
    intro:
      'Конкурси — найшвидший спосіб для дитини спробувати себе поза школою: більшість не вимагає ні оплати, ні досвіду, лише заявки у строк. Тут і всеукраїнські творчі конкурси, і міжнародні наукові змагання.',
    note:
      'Стежте за дедлайнами: саме через них губиться найбільше можливостей — не тому, що не знали, а тому що відклали.',
    faq: [
      {
        q: 'Скільки коштує участь у дитячих конкурсах?',
        a: 'Більшість конкурсів у цій підбірці безкоштовні — потрібна лише заявка, подана у строк. Якщо участь платна, це прямо позначено на картці можливості.',
      },
      {
        q: 'Як не пропустити дедлайн конкурсу?',
        a: 'На кожній картці вказано останній день подачі заявки, а протерміновані конкурси автоматично позначаються як закриті. Свіжі можливості щодня виходять у Telegram-каналі Dityam.',
      },
      {
        q: 'Чи можуть брати участь діти, які зараз за кордоном?',
        a: 'Так. Онлайн-конкурси та міжнародні змагання доступні незалежно від місця проживання — формат участі позначено на картці кожного конкурсу.',
      },
    ],
    en: {
      slug: 'contests',
      heroImage: { src: '/topic-konkursy', alt: 'Boys wearing medals after a competition' },
      h1: ['Contests for children', 'and teenagers'],
      heading: { lead: 'Contests for', script: 'children', tail: ' and teenagers' },
      title: 'Free contests for children 2026 — creative, science and international',
      description:
        'Contests for children and teenagers aged 0–18: creative, science, IT, international. Mostly free to enter, with live deadlines. Updated daily.',
      intro:
        'A contest is the fastest way for a child to try something beyond school: most ask for no fee and no track record, only an entry sent in time. This list holds both nationwide creative contests and international science competitions.',
      note:
        'Watch the deadlines. That is where most opportunities are lost — not because nobody knew, but because it was left for later.',
      faq: [
        {
          q: 'How much does it cost to enter?',
          a: 'Most contests listed here are free — all they need is an entry submitted before the deadline. Where there is a fee, it is stated on the opportunity card.',
        },
        {
          q: 'How do I avoid missing a deadline?',
          a: 'Every card shows the last day to apply, and contests past their date are marked closed automatically. New opportunities are posted daily in the Dityam Telegram channel.',
        },
        {
          q: 'Can children currently abroad take part?',
          a: 'Yes. Online contests and international competitions are open regardless of where a child lives — the format is shown on each card.',
        },
      ],
    },
    heroImage: { src: '/topic-konkursy', alt: 'Хлопці з медалями після змагань' },
    match: (o) =>
      ['competition', 'hackathon'].includes(o.opportunity_type) ||
      has(o, /конкурс|змаганн|challenge|contest|хакатон/i),
  },

  'mizhnarodni-olimpiady': {
    slug: 'mizhnarodni-olimpiady',
    nav: 'Олімпіади',
    navEn: 'Olympiads',
    h1: ['Олімпіади для школярів', 'українські та міжнародні'],
    heading: { lead: 'Олімпіади для', script: 'школярів', tail: '\u00a0— українські та міжнародні' },
    guide: {
      href: '/olimpiady',
      label: 'Путівник: усі 24 предмети Всеукраїнських олімпіад 2026/2027, класи й дати етапів →',
    },
    title: 'Міжнародні олімпіади для школярів 2026 — математика, фізика, інформатика',
    description:
      'Олімпіади для школярів: математика, фізика, інформатика, біологія, лінгвістика. Українські відбори та міжнародні змагання 2026. Участь безкоштовна.',
    intro:
      'Олімпіади — єдиний шлях, який працює однаково для дитини зі столичного ліцею й зі школи в районному центрі: там дивляться на розв’язані задачі, а не на резюме. Перемога або призове місце відкриває стипендії та вступ за кордоном.',
    note:
      'Майже всі олімпіади безкоштовні. Відбір на міжнародні йде через всеукраїнський етап, тож починати треба зі шкільного.',
    faq: [
      {
        q: 'Як школяру потрапити на міжнародну олімпіаду?',
        a: 'Через всеукраїнський відбір: шкільний етап → районний → обласний → всеукраїнський. Переможці всеукраїнського етапу формують команду України на міжнародні олімпіади (IMO з математики, IOI з інформатики, IPhO з фізики та інші).',
      },
      {
        q: 'Чи безкоштовна участь в олімпіадах?',
        a: 'Так, участь у всеукраїнських і міжнародних предметних олімпіадах безкоштовна. Для міжнародних змагань витрати на поїздку зазвичай покриває держава або організатор.',
      },
      {
        q: 'Що дає перемога в олімпіаді?',
        a: 'Призери всеукраїнського етапу отримують пільги при вступі до українських університетів, а результати міжнародних олімпіад визнають університети за кордоном — це один із найсильніших пунктів заявки на стипендії.',
      },
    ],
    en: {
      slug: 'olympiads',
      heroImage: { src: '/topic-olimpiady', alt: 'High school students at their desks in class' },
      h1: ['Olympiads for school students', 'Ukrainian and international'],
      heading: { lead: 'Olympiads for school', script: 'students', tail: '\u00a0— Ukrainian and international' },
      title: 'International olympiads for school students 2026 — maths, physics, informatics',
      description:
        'Olympiads for school students: maths, physics, informatics, biology, linguistics. Ukrainian selection rounds and international competitions 2026. Free to enter.',
      intro:
        'Olympiads work the same way for a child from a capital-city lyceum and one from a district school: what counts is the problems solved, not the CV. A win or a place opens scholarships and university admission abroad.',
      note:
        'Almost every olympiad is free. Selection for international rounds runs through the national stage, so the school round is where it starts.',
      faq: [
        {
          q: 'How does a student reach an international olympiad?',
          a: 'Through the national selection: school round → district → regional → national. Winners of the national stage form the Ukrainian team for international olympiads (IMO in maths, IOI in informatics, IPhO in physics and others).',
        },
        {
          q: 'Is taking part free?',
          a: 'Yes, participation in national and international subject olympiads is free. For international competitions, travel is usually covered by the state or the organiser.',
        },
        {
          q: 'What does winning an olympiad give you?',
          a: 'Winners of the national stage get admission benefits at Ukrainian universities, and international olympiad results are recognised by universities abroad — one of the strongest lines in a scholarship application.',
        },
      ],
    },
    heroImage: { src: '/topic-olimpiady', alt: 'Старшокласники за партами на занятті' },
    match: (o) =>
      o.opportunity_type === 'olympiad' || has(o, /олімпіад|olympiad|\bioi\b|\biol\b|\bimo\b/i),
  },

  'prohramy-obminu': {
    slug: 'prohramy-obminu',
    nav: 'Програми обміну',
    navEn: 'Exchange programs',
    h1: ['Програми обміну', 'для школярів'],
    heading: { lead: 'Програми', script: 'обміну', tail: ' для школярів' },
    title: 'Програми обміну для школярів — навчання за кордоном безкоштовно',
    description:
      'Програми обміну та навчання за кордоном для українських школярів: FLEX, AFS, Erasmus+, Global UGRAD, Rotary. Стипендіальні та безкоштовні. Дедлайни 2026.',
    intro:
      'Обміни — це рік або семестр у школі за кордоном із приймаючою родиною. Найвідоміші програми стипендіальні: дорогу, навчання й проживання оплачує організатор, родина не платить нічого.',
    note:
      'У обмінів найжорсткіші дедлайни з усього каталогу — заявки часто закриваються за пів року до виїзду.',
    // Лише українською: англійського путівника поки немає.
    guide: { href: '/erasmus', label: 'Путівник по Erasmus+: хто з України може поїхати і як подати заявку →' },
    faq: [
      {
        q: 'Скільки коштує програма обміну для школяра?',
        a: 'Найвідоміші програми — стипендіальні: FLEX повністю оплачує дорогу, навчання і проживання в США, родина не платить нічого. Інші програми (AFS, Rotary) мають стипендії або часткове фінансування.',
      },
      {
        q: 'Коли подавати заявку на програму обміну?',
        a: 'За пів року — рік до виїзду: у обмінів найжорсткіші дедлайни з усіх дитячих можливостей. Набір на FLEX зазвичай відкривається восени, тож готуватися варто вже влітку.',
      },
      {
        q: 'Які програми обміну доступні українським школярам?',
        a: 'FLEX (рік у США, повна стипендія), AFS (семестр або рік у десятках країн), Rotary Youth Exchange, Erasmus+ для молоді, а також короткострокові обміни від європейських фондів. Актуальні набори — у цій підбірці.',
      },
    ],
    en: {
      slug: 'exchange-programs',
      heroImage: { src: '/topic-obmin', alt: 'A big group of smiling teenagers posing together' },
      h1: ['Exchange programmes', 'for school students'],
      heading: { lead: 'Exchange', script: 'programmes', tail: ' for school students' },
      title: 'Exchange programmes for Ukrainian students — study abroad for free',
      description:
        'Exchange and study-abroad programmes for Ukrainian school students: FLEX, AFS, Erasmus+, Global UGRAD, Rotary. Scholarship-funded and free. 2026 deadlines.',
      intro:
        'An exchange is a year or a semester at a school abroad with a host family. The best-known programmes are scholarship-funded: travel, tuition and accommodation are paid by the organiser and the family pays nothing.',
      note:
        'Exchanges have the tightest deadlines in the whole catalogue — applications often close six months before departure.',
      faq: [
        {
          q: 'How much does an exchange programme cost?',
          a: 'The best-known ones are scholarship-funded: FLEX covers travel, tuition and accommodation in the US in full, and the family pays nothing. Others (AFS, Rotary) offer scholarships or partial funding.',
        },
        {
          q: 'When should we apply?',
          a: 'Six months to a year before departure — exchanges have the tightest deadlines of any opportunity for children. FLEX usually opens in autumn, so preparing over the summer is sensible.',
        },
        {
          q: 'Which programmes are open to Ukrainian students?',
          a: 'FLEX (a year in the US, full scholarship), AFS (a semester or year in dozens of countries), Rotary Youth Exchange, Erasmus+ for young people, and short exchanges run by European foundations. Current intakes are in this list.',
        },
      ],
    },
    heroImage: { src: '/topic-obmin', alt: 'Велика група усміхнених підлітків фотографується разом' },
    match: isExchangeProgramme,
  },


  // --- Підбірки під пошук, 30.09.2026 -------------------------------------
  //
  // Органіку на сайті тримають саме підбірки: /konkursy 211 сесій за 28 днів,
  // /prohramy-obminu 145, /mizhnarodni-olimpiady 88. Сторінка-путівник
  // /olimpiady, зроблена тижнем раніше, за той самий час зібрала 59 — тобто
  // нова підбірка окупається швидко. Ці три закривають напрями, під які в нас
  // є записи, а сторінки не було зовсім.
  //
  // Перетини з наявними тут інші, ніж у випадку «за кордон» проти «обмінів»
  // (див. EXCHANGE_RE): там дві сторінки відповідали на той самий запит. Тут
  // розрізи ортогональні — географія (/za-kordon) й аудиторія
  // (/dity-zakhysnykiv) перетинають будь-яку тему за визначенням.

  volonterstvo: {
    slug: 'volonterstvo',
    nav: 'Волонтерство',
    navEn: 'Volunteering',
    h1: ['Волонтерство', 'для підлітків'],
    heading: { lead: 'Волонтерство для', script: 'підлітків', tail: '' },
    title: 'Волонтерство для підлітків 2026 — куди піти з 14, 16 і 18 років',
    description:
      'Волонтерські програми для підлітків і молоді: короткі проєкти на кілька днів, довгі на рік, міжнародні табори та наставництво. Здебільшого безкоштовні, з оплаченим проживанням. Вік і умови — на кожній картці.',
    intro:
      'Волонтерство — те, куди підліток може піти сам, без конкурсу й портфоліо. Тут короткі проєкти на кілька днів і довгі на рік, робота з дітьми, тваринами, довкіллям і культурною спадщиною. У більшості програм організатор покриває проживання й харчування, іноді й дорогу.',
    note:
      'Вік — головне обмеження: до 16 років програм значно менше, а міжнародні здебільшого починаються з 18. На кожній картці вік указано окремо, тож перевіряйте його раніше, ніж усе інше.',
    faq: [
      {
        q: 'З якого віку підліток може стати волонтером?',
        a: 'В Україні волонтерити офіційно можна з 14 років за письмовою згодою батьків, а окремі організації беруть із 16. Міжнародні програми — European Solidarity Corps, робочі табори SCI — здебільшого від 18 років, деякі мають напрям для 16–17. Вік кожної програми вказано на її картці.',
      },
      {
        q: 'Чи треба платити за волонтерську програму?',
        a: 'За саму участь — здебільшого ні, і організатор часто покриває проживання й харчування. Дорога буває за свій кошт, а в кількох міжнародних мережах є вступний внесок. Якщо участь платна, це позначено на картці.',
      },
      {
        q: 'Що волонтерство дає, крім досвіду?',
        a: 'Сертифікат участі, який зараховують у програмах обміну й при вступі за кордон, практику мови в міжнародних проєктах і зрозумілий рядок у резюме. Для багатьох підлітків це ще й перша поїздка без батьків.',
      },
    ],
    related: ['prohramy-obminu', 'za-kordon', 'konkursy'],
    en: {
      slug: 'volunteering',
      heroImage: { src: '/topic-volonterstvo', alt: 'Two smiling young volunteers with spades at a community project' },
      h1: ['Volunteering', 'for teenagers'],
      heading: { lead: 'Volunteering for', script: 'teenagers', tail: '' },
      title: 'Volunteering for Ukrainian teenagers 2026 — from age 14, 16 and 18',
      description:
        'Volunteering for teenagers and young people: short projects of a few days, long placements of up to a year, international workcamps and mentoring. Mostly free, with accommodation covered. Age limits are on every card.',
      intro:
        'Volunteering is one of the few things a teenager can join alone, with no contest and no portfolio. Short projects and year-long placements, work with children, animals, nature and heritage. Most organisers cover accommodation and meals, sometimes travel too.',
      note:
        'Age is the real limit: there is far less on offer below 16, and international programmes usually start at 18. Every card states its age range — check that before anything else.',
      faq: [
        {
          q: 'From what age can a teenager volunteer?',
          a: 'In Ukraine, formal volunteering starts at 14 with written parental consent, and some organisations take volunteers from 16. International programmes such as the European Solidarity Corps and SCI workcamps usually start at 18, with a few strands for 16–17. Each card states its age range.',
        },
        {
          q: 'Does volunteering cost money?',
          a: 'Participation itself is usually free, and the organiser often covers accommodation and meals. Travel may be at your own expense, and a few international networks charge a joining fee. Where there is a cost, it is stated on the card.',
        },
        {
          q: 'What does it give besides experience?',
          a: 'A certificate that exchange programmes and universities abroad recognise, real language practice in international projects, and a clear line on a CV. For many teenagers it is also a first trip without parents.',
        },
      ],
    },
    heroImage: { src: '/topic-volonterstvo', alt: 'Дві усміхнені дівчини-волонтерки з лопатами на спільній роботі' },
    match: (o) => !isExchangeProgramme(o)
      && (['volunteer', 'mentorship'].includes(o.opportunity_type) || has(o, /волонтер|volunteer/i)),
  },


  'dopomoha-rodynam': {
    slug: 'dopomoha-rodynam',
    nav: 'Виплати й допомога',
    navEn: 'Payments and aid',
    h1: ['Виплати й допомога', 'родинам з дітьми'],
    heading: { lead: 'Виплати й допомога', script: 'родинам', tail: ' з дітьми' },
    title: 'Виплати й допомога родинам з дітьми 2026 — державні, від фондів і громад',
    description:
      'Грошова допомога, пільги й гуманітарна підтримка родинам з дітьми: державні виплати, програми громад, допомога фондів і міжнародних організацій. Умови й хто має право — на кожній картці.',
    intro:
      'Тут те, що родина отримує грошима або речами, а не заняттями: державні виплати, рішення громад, допомога фондів і міжнародних організацій. Умови в кожної програми свої — статус родини, місце проживання, вік дитини, — тож перевіряйте їх на картці й на сторінці організатора.',
    note:
      'Перевіряйте дату: умови виплат змінюються частіше за будь-що інше на платформі, а суми переглядають щороку. На кожній картці є посилання на першоджерело — рішення, наказ або сторінку фонду.',
    faq: [
      {
        q: 'Які виплати на дитину є в Україні 2026 року?',
        a: 'Державні — допомога при народженні, на дітей одиноким матерям, на дітей під опікою, для родин ВПО. Крім них є рішення окремих громад і програми фондів. Кожна картка веде на офіційне джерело, де вказано суму й умови; ми їх не переказуємо своїми словами.',
      },
      {
        q: 'Чи можна отримати допомогу, якщо родина виїхала за кордон?',
        a: 'Частина українських виплат зберігається, частина ні, а в країнах перебування діють власні програми для родин з тимчасовим захистом. На картці позначено, де діє програма; можливості для родин, які вже живуть за кордоном, зібрані в окремій підбірці.',
      },
      {
        q: 'Чим ця підбірка відрізняється від «Дітям захисників»?',
        a: 'Тут — усе, що родина отримує грошима чи речами, незалежно від того, хто ця родина. У підбірці «Дітям захисників» — усе для дітей військових і ветеранів: і виплати, і табори, і навчання. Частина записів природно є в обох.',
      },
    ],
    related: ['dity-zakhysnykiv', 'ukrainskym-ditiam-za-kordonom', 'bezkoshtovni-tabory'],
    en: {
      slug: 'family-support',
      heroImage: { src: '/topic-dopomoha', alt: 'A mother hugging her laughing daughter on a sofa at home' },
      h1: ['Payments and aid', 'for families with children'],
      heading: { lead: 'Payments and aid', script: 'for families', tail: ' with children' },
      title: 'Payments and aid for Ukrainian families with children 2026',
      description:
        'Cash assistance, benefits and humanitarian support for families with children: state payments, local council programmes, charity and international aid. Eligibility is stated on every card.',
      intro:
        'What a family receives as money or goods rather than as an activity: state payments, decisions of local councils, help from foundations and international organisations. Conditions differ — family status, place of residence, the child’s age — so check them on the card and on the organiser’s page.',
      note:
        'Check the date. Payment rules change more often than anything else here, and amounts are revised yearly. Every card links to the primary source — the decision, order or foundation page.',
      faq: [
        {
          q: 'What payments exist for children in Ukraine in 2026?',
          a: 'State ones include birth assistance, support for single mothers, for children under guardianship and for displaced families. Beyond those are decisions of individual communities and foundation programmes. Every card links to the official source with the amount and conditions; we do not paraphrase them.',
        },
        {
          q: 'Can a family abroad still receive help?',
          a: 'Some Ukrainian payments continue and some do not, while host countries run their own programmes for families under temporary protection. Each card shows where the programme applies; opportunities for families already living abroad have their own collection.',
        },
        {
          q: 'How is this different from the collection for defenders’ children?',
          a: 'This one holds everything a family receives as money or goods, whoever the family is. The defenders’ collection holds everything for children of soldiers and veterans — payments, camps and study alike. Some records naturally appear in both.',
        },
      ],
    },
    heroImage: { src: '/topic-dopomoha', alt: 'Мама обіймає доньку, що сміється, на дивані вдома' },
    match: (o) => ['allowance', 'support_payment', 'humanitarian', 'shelter'].includes(o.opportunity_type)
      || o.aid_type === 'cash',
  },



  'psykholohichna-dopomoha': {
    slug: 'psykholohichna-dopomoha',
    nav: 'Психологічна допомога',
    navEn: 'Psychological help',
    h1: ['Безкоштовна психологічна', 'допомога дітям'],
    heading: { lead: 'Безкоштовна психологічна', script: 'допомога', tail: ' дітям' },
    title: 'Безкоштовна психологічна допомога дітям і підліткам 2026',
    description:
      'Де дитині чи підлітку отримати психологічну підтримку безкоштовно: онлайн-групи, індивідуальні консультації, реабілітація, допомога дітям військових і тим, хто втратив близьких. Умови — на кожній картці.',
    intro:
      'Сюди входить те, що стосується стану дитини, а не її занять: психологічні консультації та групи підтримки, реабілітація, допомога дітям, які втратили близьких або пережили поранення чи важку хворобу. Більшість програм безкоштовні, частина працює онлайн і доступна з будь-якого міста.',
    note:
      'Це не швидка допомога. Якщо дитина в кризовому стані просто зараз — телефонуйте на Лінію запобігання самогубствам 7333 (безкоштовно, цілодобово) або 112. Програми з цієї підбірки працюють за записом.',
    faq: [
      {
        q: 'Де отримати безкоштовного дитячого психолога?',
        a: 'Безкоштовні консультації дають фонди, громадські організації та окремі державні програми; частина з них працює онлайн, тож місто не має значення. Умови, вік дитини й спосіб запису вказано на картці кожної програми та на сторінці організатора.',
      },
      {
        q: 'Чи потрібна згода батьків?',
        a: 'Для дитини до 14 років — так, майже завжди. Підлітки від 14 у частині програм звертаються самі, особливо в онлайн-групах і чатах підтримки. Конкретні умови кожна організація описує на своїй сторінці.',
      },
      {
        q: 'Чи є допомога дітям військових і тим, хто втратив рідних?',
        a: 'Так, для них працюють окремі програми — онлайн-групи для дітей воїнів і для дітей зниклих безвісти, а також реабілітаційні збори. Ширший перелік усього, що є для цих родин, зібрано в підбірці «Дітям захисників».',
      },
    ],
    related: ['dity-zakhysnykiv', 'dopomoha-rodynam', 'bezkoshtovni-hurtky'],
    en: {
      slug: 'psychological-help',
      heroImage: { src: '/topic-psykholohichna', alt: 'A mother and daughter sitting close and smiling at each other' },
      h1: ['Free psychological help', 'for children'],
      heading: { lead: 'Free psychological help', script: 'for children', tail: '' },
      title: 'Free psychological help for Ukrainian children and teenagers 2026',
      description:
        'Where a child or teenager can get psychological support for free: online groups, individual counselling, rehabilitation, help for children of soldiers and for those who lost a relative. Conditions on every card.',
      intro:
        'This collection is about how a child is doing rather than what a child does: counselling and support groups, rehabilitation, help for children who lost someone close or went through injury or serious illness. Most programmes are free and many work online, so the city does not matter.',
      note:
        'This is not emergency care. If a child is in crisis right now, call the suicide prevention line 7333 (free, around the clock) or 112. The programmes listed here work by appointment.',
      faq: [
        {
          q: 'Where can we find a free child psychologist?',
          a: 'Free counselling is offered by foundations, civic organisations and some state programmes; many work online, so location does not matter. The conditions, the child’s age and how to book are stated on each card and on the organiser’s page.',
        },
        {
          q: 'Is parental consent required?',
          a: 'For a child under 14, almost always yes. From 14, teenagers can approach some services themselves, particularly online groups and support chats. Each organisation states its own rules.',
        },
        {
          q: 'Is there help for children of soldiers and the bereaved?',
          a: 'Yes — separate programmes run online groups for children of soldiers and of the missing, as well as rehabilitation retreats. A fuller list for these families is in the “Defenders’ children” collection.',
        },
      ],
    },
    heroImage: { src: '/topic-psykholohichna', alt: 'Мама й донька сидять поруч і всміхаються одна одній' },
    match: (o) => ['psychology', 'rehabilitation', 'medical_aid'].includes(o.opportunity_type),
  },

  'bezkoshtovni-tabory': {
    slug: 'bezkoshtovni-tabory',
    nav: 'Табори',
    navEn: 'Camps',
    h1: ['Безкоштовні табори', 'та путівки для дітей'],
    heading: { lead: 'Безкоштовні', script: 'табори', tail: ' та путівки для дітей' },
    title: 'Безкоштовні табори та путівки для дітей — літні й цілорічні',
    description:
      'Безкоштовні та пільгові табори для дітей 0–18 років: державні путівки, оздоровлення, християнські й тематичні табори. Категорії ВПО, УБД, діти з інвалідністю.',
    intro:
      'Сюди входять і державні путівки на оздоровлення, і табори від фондів та громад. Для пільгових категорій — дітей ВПО, ветеранів, з інвалідністю — путівка часто повністю безкоштовна.',
    note:
      'Пільгові путівки розподіляють через органи соцзахисту за місцем проживання, тож подаватись треба заздалегідь.',
    faq: [
      {
        q: 'Хто може отримати безкоштовну путівку в дитячий табір?',
        a: 'Насамперед діти пільгових категорій: ВПО, діти захисників і захисниць, діти з інвалідністю, з малозабезпечених і багатодітних родин. Для них держава оплачує путівку повністю. Окремо існують безкоштовні табори від фондів і громадських організацій — часто відкриті для всіх.',
      },
      {
        q: 'Як оформити державну путівку на оздоровлення?',
        a: 'Через органи соціального захисту за місцем проживання або через сервіси на кшталт київського порталу послуг. Подаватися треба заздалегідь — путівки розподіляють у порядку черги.',
      },
      {
        q: 'Коли починати шукати літній табір?',
        a: 'У лютому–травні: саме тоді відкривається більшість наборів на літні зміни. Влітку лишаються здебільшого останні місця, а державні путівки на той момент уже розподілені.',
      },
    ],
    en: {
      slug: 'free-camps',
      heroImage: { src: '/topic-tabory', alt: 'Children playing with a colourful parachute in a meadow' },
      h1: ['Free camps', 'and funded places for children'],
      heading: { lead: 'Free', script: 'camps', tail: ' and funded places for children' },
      title: 'Free camps for Ukrainian children — summer and year-round',
      description:
        'Free and subsidised camps for children aged 0–18: state-funded places, recovery camps, faith-based and themed camps. Priority for displaced families, veterans’ children and children with disabilities.',
      intro:
        'This covers both state-funded recovery places and camps run by foundations and local communities. For priority categories — displaced children, children of veterans, children with disabilities — a place is often free in full.',
      note:
        'Subsidised places are allocated through local social protection offices where the family is registered, so it is worth applying well ahead.',
      faq: [
        {
          q: 'Who can get a free place at a children’s camp?',
          a: 'Priority categories first: displaced children, children of veterans and of the fallen, children with disabilities, and children from low-income or large families. For them the state pays in full. Separately, foundations and charities run free camps that are often open to everyone.',
        },
        {
          q: 'How do we apply for a state-funded place?',
          a: 'Through the social protection office where the family is registered, or through municipal service portals such as the one in Kyiv. Apply early — places are allocated in order of application.',
        },
        {
          q: 'When should we start looking for a summer camp?',
          a: 'Between February and May, when most summer intakes open. By the summer itself mostly last places remain, and state-funded places have already been allocated.',
        },
      ],
    },
    heroImage: { src: '/topic-tabory', alt: 'Діти з кольоровим парашутом на галявині' },
    match: (o) =>
      o.cost_type === 'free' &&
      // rehabilitation свідомо НЕ включаємо: там інклюзивно-ресурсні центри
      // й реабілітація, а не табори.
      (['camp', 'summer_school'].includes(o.opportunity_type) ||
        has(o, /табір|табор|путівк|оздоровленн/i)),
  },
  'za-kordon': {
    slug: 'za-kordon',
    nav: 'За кордон',
    navEn: 'Going abroad',
    // Заголовок переписано 28.09.2026. Було «Дитина їде за кордон» — це
    // розповідь про ситуацію, а не запит: такого не набирає ніхто. Сусідня
    // підбірка обмінів починалась зі слів «навчання за кордоном» і забирала
    // весь трафік (205 входів проти 16).
    h1: ['Табори, конкурси й стипендії', 'за кордоном'],
    heading: { lead: 'Табори, конкурси й стипендії', script: 'за кордоном', tail: '' },
    title: 'Табори, конкурси й стипендії за кордоном для українських дітей 2026',
    description:
      'Міжнародні табори, конкурси, олімпіади й стипендії, куди українська дитина може поїхати за кордон. Більшість безкоштовні або стипендіальні. Дедлайни 2026. Програми обміну — в окремій підбірці.',
    intro:
      'Тут те, куди дитина їде за кордон НЕ на рік навчання: міжнародні табори й літні школи, конкурси й олімпіади, волонтерські проєкти, стипендії. Більшість стипендіальні — дорогу, участь і проживання оплачує організатор. Якщо шукаєте саме навчання — рік чи семестр у школі за FLEX, AFS, Erasmus+, — це сусідня підбірка «Програми обміну».',
    // Родина, яка вже живе за кордоном, шукає «за кордоном» і потрапляє сюди,
    // на поїздки. Дорога до її підбірки — одразу під вступом.
    guide: {
      href: '/ukrainskym-ditiam-za-kordonom',
      label: 'Уже живете за кордоном? Заняття, табори й підтримка для українських дітей у країні, де ви зараз →',
    },
    related: ['prohramy-obminu', 'bezkoshtovni-tabory', 'konkursy', 'mizhnarodni-olimpiady'],
    note:
      'Найважливіше тут — час: набори на табори, конкурси й волонтерські проєкти закриваються за місяці до виїзду. Правила виїзду неповнолітніх з України під час воєнного стану змінюються, тож перед подачею перевірте актуальні вимоги на сайті Державної прикордонної служби.',
    faq: [
      {
        q: 'Чи може підліток поїхати за кордон на програму сам, без батьків?',
        a: 'Так, більшість міжнародних таборів, літніх шкіл і волонтерських проєктів розраховані на самостійну поїздку підлітка 14–18 років: він живе в кампусі або в приймаючій родині під наглядом організатора. Без батьків дитина виїжджає з України лише з нотаріально засвідченою згодою батьків і в супроводі дорослого; актуальні правила перетину кордону під час воєнного стану уточнюйте в Державній прикордонній службі.',
      },
      {
        q: 'Скільки коштує поїздка дитини за кордон за програмою?',
        a: 'Більшість можливостей у цій підбірці безкоштовні або стипендіальні: організатор покриває участь, а часто ще дорогу й проживання. Якщо участь платна чи є організаційний внесок, це позначено на картці — вартість ми пишемо лише з офіційної сторінки організатора.',
      },
      {
        q: 'З якого віку дитина може поїхати за кордон на табір чи конкурс?',
        a: 'Найбільше можливостей для 14–18 років: волонтерські проєкти й літні школи здебільшого беруть від 15–16. Для молодших є міжнародні конкурси й олімпіади, зазвичай із супроводом дорослого. Вік учасників вказано на кожній картці. Рік чи семестр у школі за кордоном — у сусідній підбірці «Програми обміну».',
      },
    ],
    en: {
      slug: 'abroad',
      heroImage: { src: '/topic-za-kordon', alt: 'Three teenage girls smiling on a train' },
      h1: ['Camps, contests and scholarships', 'abroad'],
      heading: { lead: 'Camps, contests and scholarships', script: 'abroad', tail: '' },
      title: 'Camps, contests and scholarships abroad for Ukrainian children 2026',
      description:
        'International camps, contests, olympiads and scholarships a Ukrainian child can travel abroad for. Mostly free or scholarship-funded. 2026 deadlines. Exchange programmes have their own page.',
      intro:
        'Opportunities where a child travels abroad but not for a school year: international camps and summer schools, contests and olympiads, volunteering projects, scholarships. Most are scholarship-funded — travel, participation and accommodation are paid by the organiser. Looking for a term or a year at a school with FLEX, AFS or Erasmus+? That is the «Exchange programmes» page.',
      guide: {
        href: '/en/ukrainian-children-abroad',
        label: 'Already living abroad? Classes, camps and support for Ukrainian children in the country where you live →',
      },
      note:
        'Timing matters most here: camp, contest and volunteering intakes close months before departure. Rules for minors leaving Ukraine under martial law change, so check the current requirements with the State Border Guard Service before applying.',
      faq: [
        {
          q: 'Can a teenager go abroad on a programme without parents?',
          a: 'Yes. Most international camps, summer schools and volunteering projects are designed for a 14–18-year-old travelling alone: they live on campus or with a host family under the organiser’s supervision. A child leaves Ukraine without parents only with a notarised parental consent and an accompanying adult; check the current martial-law border rules with the State Border Guard Service.',
        },
        {
          q: 'How much does it cost?',
          a: 'Most opportunities here are free or scholarship-funded: the organiser covers participation and often travel and accommodation too. Where there is a fee or a contribution, it is stated on the card — we only publish a cost taken from the organiser’s own page.',
        },
        {
          q: 'From what age can a child go abroad to a camp or a contest?',
          a: 'Most opportunities are for ages 14–18: volunteering projects and summer schools usually start at 15–16. Younger children have international contests and olympiads, usually with an accompanying adult. The age range is shown on every card. A term or a year at a school abroad is on the «Exchange programmes» page.',
        },
      ],
    },
    // Міських сторінок «місто × за кордон» не буває: поїздка не привʼязана
    // до міста, а пʼять записів із київським організатором зробили б
    // сторінку «Дитина їде за кордон у Києві», яка нікому не відповідає.
    heroImage: { src: '/topic-za-kordon', alt: 'Три дівчини-підлітки усміхаються в потязі' },
    noCityPages: true,
    match: (o) => {
      // Для тих, хто вже живе за кордоном (lib/diaspora.js), — не поїздка:
      // табір для дітей біженців у Нідерландах мав міжнародну мітку й стояв
      // тут серед обмінів, хоча з України туди ніхто не їде.
      if (isDiaspora(o)) return false;
      // Обміни звідси прибрано 28.09.2026: вони живуть у /prohramy-obminu, а
      // стояли й там, і тут — 18 записів із 29. Дві сторінки про одне Google
      // не розрізняв і показував їх поспіль на той самий запит.
      if (isExchangeProgramme(o)) return false;
      const kw = /за кордон|закордон|abroad/i;
      // Онлайн — лише підготовка до вступу за кордон, і тільки за назвою:
      // онлайн-курс від ірландського організатора нікуди дитину не везе.
      if (isOnline(o)) return has(o, kw);
      const countries = o.countries || [];
      const foreign = countries.some((c) => String(c).toLowerCase() !== 'ua');
      // Сервіси для родин, які ВЖЕ за кордоном (гуртки в Ірландії, гуманітарна
      // допомога в Польщі), мають країну, але не позначені міжнародними — це
      // інший намір, «ми вже виїхали», і сюди він не потрапляє.
      if (foreign) return Boolean(o.is_international) && !ABROAD_EXCLUDE.has(o.opportunity_type);
      // Країна не проставлена (Erasmus, UWC, міжнародні олімпіади): міжнародна
      // й не дистанційна — але лише типи, за якими справді їдуть.
      return (!countries.length && Boolean(o.is_international) && ABROAD_TYPES.has(o.opportunity_type))
        || has(o, kw);
    },
  },
  /**
   * Діти захисників і захисниць.
   *
   * У копії сторінки слова «загиблих» немає — рішення Марії 11.09.2026.
   * Умова участі та сама, просто названа інакше: «захисники, які не
   * повернулися». У правилі добору нижче слово лишається, бо його пишуть
   * організатори у своїх оголошеннях, і без нього ці програми не знайти.
   *
   * Ця підбірка вужча за решту навмисно: сюди потрапляє лише те, де статус
   * родини — умова участі, а не побіжна згадка. Помилка тут коштує дорожче
   * за порожню сторінку: родина витрачає сили на програму, куди її не
   * візьмуть. Тому текстове правило вимагає звʼязки «діти/родини» + «ветерани
   * /загиблі/захисники», а не окремого слова «ветеран» будь-де в описі —
   * інакше сюди їхали 99 записів, де ветерани згадані мимохідь.
   *
   * Слово «бойових дій» у правилі стоїть лише у звʼязці «учасник(ів) бойових
   * дій». Без цього уточнення сюди потрапляли «діти з зон бойових дій» —
   * інша категорія: війна торкнулась усіх, статус захисника має не кожен.
   *
   * Один список із закріпленими нагорі (рішення Марії 14.09.2026; того ж дня
   * спершу були два окремі блоки — сторінка читалась як «купа блоків»).
   * Відкритих програм САМЕ для дітей
   * захисників мало: дослідження 14.09.2026 перебрало ~70 кандидатів і
   * знайшло кілька. Тому позначка чесна:
   *   exclusive — статус родини названо в НАЗВІ запису (виплата дітям
   *     загиблих, стипендія дітям захисників). Назву пише модератор, і саме
   *     назва каже батькові «це для вас», тож правило дивиться лише на неї;
   *   решта — діти захисників серед пріоритетних категорій (табори й
   *     держоздоровлення для кількох пільгових груп).
   * «військової агресії» у правило не потрапляє навмисно: «дітям, які
   * втратили батьків через війну» — ширше за дітей захисників.
   */
  'dity-zakhysnykiv': {
    slug: 'dity-zakhysnykiv',
    nav: 'Дітям захисників',
    navEn: 'Children of defenders',
    h1: ['Дітям захисників і захисниць', 'програми, табори, підтримка'],
    heading: { lead: 'Дітям', script: 'захисників', tail: ' і захисниць\u00a0— програми, табори, підтримка' },
    title: 'Дітям захисників і захисниць — програми, табори й підтримка 2026',
    description:
      'Можливості для дітей захисників і захисниць України — ветеранів, зниклих безвісти, полонених і тих, хто не повернувся: безкоштовні табори, освітні програми, психологічна підтримка, пільги при вступі.',
    // Хіро — два речення (рішення Марії 14.09.2026: «тексту менше, фото
    // більше»). Як влаштований список, каже вже intro — note його не
    // переказує (14.09.2026 Марія: «це ж не актуально»), а дає те, що
    // батькові справді треба знати. Пункт фільтра називати дослівно з
    // NEED_OPTS в app/OpportunitiesList.js.
    intro:
      'Виплати, стипендії, табори й підтримка для дітей захисників і захисниць України — одним списком. Нагорі — те, що лише для дітей захисників.',
    pinnedLabel: 'Лише для дітей захисників',
    note:
      'Окрім таборів і програм, тут є грошові виплати від міських і обласних рад дітям загиблих, зниклих безвісти й полонених захисників. Такі виплати ухвалює кожна громада окремо, тому розмір, хто має право, куди подавати й які документи потрібні — різні; усе це вказано на сторінці кожної програми. Якщо вашого міста чи області тут немає, це ще не означає, що виплати там немає: ми додаємо програму, щойно знаходимо офіційне рішення ради. Ширше коло можливостей — на головній, у фільтрі «Особлива потреба» → «Діти ветеранів».',
    faq: [
      {
        q: 'Хто вважається дитиною захисника чи захисниці?',
        a: 'Зазвичай це діти учасників бойових дій, осіб з інвалідністю внаслідок війни, тих, хто зник безвісти чи перебуває в полоні, а також тих, хто не повернувся з війни. Точний перелік залежить від конкретної програми — він завжди вказаний в умовах на сторінці організатора.',
      },
      {
        q: 'Які пільги має така дитина при вступі?',
        a: 'Держава щороку виділяє кошти на компенсацію контрактного навчання для дітей захисників і захисниць у закладах фахової передвищої та вищої освіти; окремо діють пільгові кредити на навчання, безкоштовні підручники й місце в гуртожитку. Умови на кожен навчальний рік ухвалює Кабінет Міністрів, тому актуальні правила й перелік документів уточнюйте в приймальній комісії закладу.',
      },
      {
        q: 'Чи можна безкоштовно оздоровити дитину?',
        a: 'Так. Діти пільгових категорій, зокрема діти захисників і захисниць, мають право на безкоштовні путівки за державною програмою оздоровлення, а частину таборів дають благодійні фонди. Такі програми є на цій сторінці; путівки за державною програмою оформлюють через службу у справах дітей за місцем проживання.',
      },
    ],
    en: {
      slug: 'children-of-veterans',
      heroImage: { src: '/topic-zakhysnyky', alt: 'Girls in embroidered shirts with Ukrainian flags at a celebration' },
      h1: ['Children of Ukraine\u2019s defenders', 'programmes, camps, support'],
      heading: { lead: 'Children of Ukraine\u2019s', script: 'defenders', tail: '\u00a0— programmes, camps, support' },
      title: 'Children of Ukraine\u2019s defenders — programmes, camps and support 2026',
      description:
        'Opportunities for children of Ukrainian defenders — veterans, those missing in action, held captive or who did not come home: free camps, educational programmes, psychological support, admission benefits.',
      intro:
        'Payments, scholarships, camps and support for children of Ukraine’s defenders — in one list. At the top: what is only for children of defenders.',
      pinnedLabel: 'Only for children of defenders',
      note:
        'Besides camps and programmes, this list includes cash payments from city and regional councils to children of defenders who were killed, went missing or are held captive. Each community adopts its own payment, so the amount, who qualifies, where to apply and which documents are needed differ — all of it is stated on each programme’s page. If your city or region is not here, that does not mean there is no payment there: we add a programme as soon as we find the council’s official decision. For a wider range, use the “Special needs” → “Veterans’ children” filter on the home page.',
      faq: [
        {
          q: 'Who counts as a child of a defender?',
          a: 'Usually children of combat participants, of people disabled as a result of the war, of those missing in action or held captive, and of those who did not come home. The exact list depends on the programme and is always stated in the organiser\u2019s conditions.',
        },
        {
          q: 'What admission benefits does such a child have?',
          a: 'The state allocates funds every year to cover tuition for children of defenders in vocational and higher education, alongside subsidised study loans, free textbooks and a place in a dormitory. The terms are set by the Cabinet of Ministers for each academic year, so check the current rules with the institution\u2019s admissions office.',
        },
        {
          q: 'Can the child get a free camp or recovery stay?',
          a: 'Yes. Children of protected categories, including children of defenders, are entitled to free places under the state recovery programme, and charities fund part of the camps. State places are arranged through the local children\u2019s services department.',
        },
      ],
    },
    // Статус не привʼязаний до міста: сторінка «дітям захисників у Львові» з
    // двох записів нікому не відповідає.
    noCityPages: true,
    // Фото в хіро: макет тематичної сторінки від початку двоколонковий, і
    // без знімка права колонка просто стояла порожня.
    heroImage: { src: '/topic-zakhysnyky', alt: 'Дівчата у вишиванках із українськими прапорцями на святі' },
    match: (o) => {
      if ((o.child_needs || []).includes('veteran_family')) return true;
      // Звʼязка «діти/родини» + «ветерани/загиблі/захисники» у назві чи описі.
      // Саме звʼязка: окреме слово «ветеран» ловило 99 записів, де воно стоїть
      // у переліку партнерів або в історії організації.
      const text = `${o.title || ''} ${o.summary || ''}`;
      return /(дітей|діти|дитин|родин|сім)[^.]{0,40}(ветеран|загибл|полегл|захисник|військовослужбовц|військових|УБД|учасник[а-яіїєґ]* бойових дій)|дітям героїв|діти героїв/i
        .test(text);
    },
    exclusive: (o) =>
      /(діт|дитин|сирот)[^.]{0,60}(загибл|полегл|захисник|захисниц|захищаючи|військовослужбовц|військових|ветеран|УБД|учасник[а-яіїєґ]* бойових дій|зниклих безвісти|полонених)|children of (fallen |ukrainian )?(defenders|heroes)/i
        .test(o.title || ''),
  },
  /**
   * Українським дітям за кордоном — для родин, які ВЖЕ живуть в іншій країні
   * (напрям Марії з 22.09.2026). Не плутати з «За кордон»: там поїздки з
   * України. Правило добору й поріг сторінок країн — у lib/diaspora.js.
   *
   * Хаб показує записи країнами: країни з власною сторінкою (Польща,
   * Німеччина — від MIN_COUNTRY записів) — посиланнями вгорі, решта — під
   * назвою країни. Порожньої країни не буває: група зʼявляється лише з
   * записом.
   *
   * Пункт меню «Живемо за кордоном», а не назва сторінки: у тому самому
   * списку стоїть «За кордон», і два «за кордоном» поруч читались би як одне.
   */
  'ukrainskym-ditiam-za-kordonom': {
    slug: 'ukrainskym-ditiam-za-kordonom',
    nav: 'Живемо за кордоном',
    navEn: 'Living abroad',
    h1: ['Українським дітям', 'за кордоном'],
    heading: { lead: 'Українським', script: 'дітям', tail: ' за кордоном' },
    title: 'Українським дітям за кордоном — заняття, табори, підтримка',
    description:
      'Можливості для дітей з України, які вже живуть за кордоном: заняття й табори для українських дітей, суботні школи, допомога з мовою та школою. За країнами.',
    intro:
      'Для родин, які вже живуть за кордоном: заняття, табори, українські суботні школи й допомога з мовою та школою — те, що є для дитини в країні, де ви зараз. Записи згруповано за країнами.',
    guide: {
      href: '/za-kordon',
      label: 'Дитина їде з України в табір, на конкурс чи волонтерство — це в підбірці «За кордон» →',
    },
    note:
      'Умови участі часто залежать від статусу родини в країні — тимчасового захисту, місця проживання чи школи, де навчається дитина, — тож перевіряйте їх на сторінці організатора. Мова занять буває різна: мова країни, українська або обидві. Для Польщі й Німеччини окрема сторінка зʼявляється, щойно в країні набирається щонайменше три відкриті можливості; записи інших країн стоять тут під назвою країни.',
    faq: [
      {
        q: 'Чим ця підбірка відрізняється від «За кордон»?',
        a: '«За кордон» — для дітей, які їдуть з України: табори, конкурси, олімпіади, волонтерство й стипендії з поїздкою (рік чи семестр у школі — у «Програмах обміну»). Тут — для тих, хто вже живе в іншій країні: заняття й табори, які організатори там відкривають для українських дітей, українські суботні школи, допомога з мовою та школою.',
      },
      {
        q: 'Які можливості потрапляють у цю підбірку?',
        a: 'Ті, що проходять за кордоном і прямо адресовані дітям з України, які там живуть: дітям біженців і родинам із тимчасовим захистом, новоприбулим учням, учням українських суботніх шкіл. Волонтерство, табори й обміни з виїздом з України сюди не потрапляють — вони в підбірках «За кордон» і «Програми обміну».',
      },
      {
        q: 'Як записатися?',
        a: 'Кожна картка веде на сторінку можливості на Dityam.com.ua, а звідти — на сайт організатора: запис, умови й мова занять — там. Dityam.com.ua не бере комісії та не збирає заявок.',
      },
    ],
    en: {
      slug: 'ukrainian-children-abroad',
      heroImage: { src: '/topic-diaspora', alt: 'A boy and a girl drawing together at a school desk' },
      h1: ['For Ukrainian children', 'living abroad'],
      heading: { lead: 'For Ukrainian', script: 'children', tail: ' living abroad' },
      title: 'Ukrainian children living abroad — classes, camps, support',
      description:
        'Opportunities for children from Ukraine who already live abroad: classes and camps for Ukrainian children, Saturday schools, help with language and school.',
      intro:
        'For families who already live outside Ukraine: classes, camps, Ukrainian Saturday schools and help with language and school — what there is for a child in the country where you live now. Listings are grouped by country.',
      guide: {
        href: '/en/abroad',
        label: 'A child travelling from Ukraine for a camp, a contest or volunteering? That is in “Going abroad” →',
      },
      note:
        'Eligibility often depends on the family’s status in the country — temporary protection, place of residence or the child’s school — so check it on the organiser’s page. The language of classes varies: the local language, Ukrainian, or both. Poland and Germany get their own page once the country has at least three open opportunities; other countries are listed here under the country’s name.',
      faq: [
        {
          q: 'How is this different from “Going abroad”?',
          a: '“Going abroad” is for children travelling from Ukraine: camps, contests, olympiads, volunteering and scholarships that involve a trip (a term or a year at school is on “Exchange programmes”). This collection is for those who already live in another country: classes and camps that local organisers open to Ukrainian children, Ukrainian Saturday schools, help with language and school.',
        },
        {
          q: 'Which opportunities are included?',
          a: 'Those that take place outside Ukraine and are addressed directly to children from Ukraine who live there: children of refugees and families with temporary protection, newly arrived pupils, pupils of Ukrainian Saturday schools. Volunteering, camps and exchanges that involve leaving Ukraine are not included — they are in “Going abroad” and “Exchange programmes”.',
        },
        {
          q: 'How do we sign up?',
          a: 'Every card leads to the opportunity’s page on Dityam.com.ua and from there to the organiser’s site, where registration, conditions and the language of classes are given. Dityam.com.ua takes no commission and collects no applications.',
        },
      ],
    },
    // Мешкання за кордоном не привʼязане до українського міста.
    noCityPages: true,
    // «Школа в країні» — права й процедури абзацом (lib/diaspora.js).
    schoolNotes: Object.keys(SCHOOL_NOTES),
    related: ['bezkoshtovni-hurtky', 'konkursy', 'za-kordon', 'mizhnarodni-olimpiady'],
    heroImage: { src: '/topic-diaspora', alt: 'Хлопчик і дівчинка разом малюють за шкільною партою' },
    match: isDiaspora,
    groups: (items, lang = 'uk') => {
      const pages = liveCountryPages(items);
      return {
        links: pages.map((p) => ({
          href: topicPath(DIASPORA_COUNTRY_TOPICS.find((t) => t.code === p.code), lang),
          label: countryName(p.code, lang),
          count: p.count,
        })),
        groups: hubGroups(items, pages.map((p) => p.code), lang).map((g) => ({
          id: `country-${g.code}`,
          title: g.name,
          items: g.items,
        })),
      };
    },
  },
};

export const DIASPORA_HUB = 'ukrainskym-ditiam-za-kordonom';

/**
 * Сторінки країн діаспори — теж підбірки, але не в TOPIC_LIST: у меню,
 * підвалі й «Підбірках» їх немає, бо сторінка існує лише від MIN_COUNTRY
 * відкритих записів. Шлях до них — із хаба, sitemap і llms.txt, і лише коли
 * поріг пройдено.
 */
function diasporaCountryTopic({ code, slug, slugEn }) {
  const where = inCountry(code);
  const whereEn = inCountry(code, 'en');
  const hub = TOPICS[DIASPORA_HUB];
  return {
    code,
    slug: `${DIASPORA_HUB}/${slug}`,
    nav: countryName(code),
    navEn: countryName(code, 'en'),
    parent: DIASPORA_HUB,
    h1: ['Українським дітям', where],
    heading: { lead: 'Українським дітям', script: where, tail: '' },
    title: `Українським дітям ${where} — заняття, табори, підтримка`,
    description:
      `Можливості для дітей з України, які вже живуть ${where}: заняття, табори й підтримка, які організатори в країні відкривають для українських дітей.`,
    intro:
      `Для родин, які вже живуть ${where}: заняття, табори й підтримка, які організатори в країні відкривають саме для українських дітей. Інші країни — у підбірці «${hub.nav}».`,
    guide: hub.guide,
    note:
      `Умови участі часто залежать від статусу родини ${where} — тимчасового захисту, місця проживання чи школи, де навчається дитина, — тож перевіряйте їх на сторінці організатора. Мова занять буває різна: мова країни, українська або обидві.`,
    faq: [hub.faq[0], hub.faq[2]],
    en: {
      slug: `${hub.en.slug}/${slugEn}`,
      h1: ['For Ukrainian children', `living ${whereEn}`],
      heading: { lead: 'For Ukrainian children', script: `living ${whereEn}`, tail: '' },
      title: `Ukrainian children ${whereEn} — classes, camps, support`,
      description:
        `Opportunities for children from Ukraine who already live ${whereEn}: classes, camps and support that organisers there open to Ukrainian children.`,
      intro:
        `For families who already live ${whereEn}: classes, camps and support that organisers in the country open specifically to Ukrainian children. Other countries are in “${hub.navEn}”.`,
      guide: hub.en.guide,
      note:
        `Eligibility often depends on the family’s status ${whereEn} — temporary protection, place of residence or the child’s school — so check it on the organiser’s page. The language of classes varies: the local language, Ukrainian, or both.`,
      faq: [hub.en.faq[0], hub.en.faq[2]],
      heroImage: { src: '/topic-diaspora', alt: `A boy and a girl drawing together at a school desk (${whereEn})` },
    },
    noCityPages: true,
    // Своє фото для кожної країни завело б у репозиторій два десятки
    // майже однакових знімків; беремо зображення батьківської підбірки, а
    // країну називає alt. Без картинки хіро малюється в одну колонку, і
    // сторінка віддає в соцмережі загальну заставку сайту замість своєї.
    heroImage: { src: '/topic-diaspora', alt: `Хлопчик і дівчинка разом малюють за шкільною партою (${where})` },
    schoolNotes: SCHOOL_NOTES[code] ? [code] : [],
    minItems: MIN_COUNTRY,
    related: [DIASPORA_HUB, 'za-kordon', 'bezkoshtovni-hurtky', 'konkursy'],
    match: (o) => inDiasporaCountry(o, code),
  };
}

export const DIASPORA_COUNTRY_TOPICS = DIASPORA_COUNTRIES.map(diasporaCountryTopic);

/**
 * Сторінки країн, що існують зараз: той самий поріг, що в TopicPage
 * (minItems). liveRows — уже без протермінованих (lib/audience.js isLive),
 * інакше sitemap пообіцяв би сторінку, яка віддає 404.
 */
export const qualifyingCountryTopics = (liveRows) =>
  DIASPORA_COUNTRY_TOPICS.filter((t) => liveRows.filter(t.match).length >= t.minItems);

/** Сторінка країни за останнім сегментом адреси (uk або en). */
export const diasporaCountryBySlug = (segment, lang = 'uk') =>
  DIASPORA_COUNTRY_TOPICS.find((t) =>
    (lang === 'en' ? t.en.slug : t.slug).split('/').pop() === segment);

export const TOPIC_LIST = Object.values(TOPICS);

/** Коротка назва для навігації між підбірками й у підвалі */
export const TOPIC_NAV = TOPIC_LIST.map((t) => ({
  slug: t.slug,
  slugEn: t.en.slug,
  label: t.nav,
  labelEn: t.navEn,
}));

/**
 * Шлях до підбірки потрібною мовою.
 *
 * Англійські слаги свої, а не префікс до українських: сторінка існує заради
 * пошуку, а «/en/bezkoshtovni-hurtky» не відповідає на жоден англійський
 * запит. Через це ж усі переходи мусять іти сюди, а не збиратись рядком на
 * місці — саме так на англійській головній і зʼявились посилання на
 * українські сторінки.
 */
export const topicPath = (t, lang = 'uk') =>
  lang === 'en' ? `/en/${t.slugEn || t.en.slug}` : `/${t.slug}`;

/** Сторінка зі списком усіх підбірок — середня ланка хлібних крихт. */
export const collectionsPath = (lang = 'uk') =>
  lang === 'en' ? '/en/collections' : '/pidbirky';

/** Підбірка за англійським слагом — для маршрутів під /en. */
export const topicByEnSlug = (slug) =>
  TOPIC_LIST.find((t) => t.en.slug === slug);

/**
 * Підбірка, до якої належить запис, — для хлібних крихт і «схожих» на
 * сторінці можливості (редизайн, 29.09.2026). Перша в порядку TOPICS, чиє
 * правило проходить: обмін за кордон потрапляє в «Програми обміну», а не в
 * «За кордон». null — жодна не підходить (тоді крихта лишається типом).
 */
export const topicOf = (item) => TOPIC_LIST.find((t) => {
  try { return Boolean(t.match(item)); } catch { return false; }
}) || null;
