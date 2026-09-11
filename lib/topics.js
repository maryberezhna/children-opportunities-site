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

const has = (o, re) =>
  new RegExp(`(?<![а-яіїєґa-z])(?:${re.source})`, re.flags).test(o.title || '');

/** Типи, за якими дитина фізично їде: для записів без країни. */
const ABROAD_TYPES = new Set([
  'exchange', 'study_program', 'scholarship', 'summer_school', 'residency',
  'internship', 'camp', 'conference', 'olympiad', 'competition', 'volunteer',
  'festival', 'hackathon',
]);
/** І навпаки: типи, які навіть із країною не є поїздкою. */
const ABROAD_EXCLUDE = new Set(['humanitarian', 'club', 'workshop', 'grant', 'educational_material']);

export const TOPICS = {
  'bezkoshtovni-hurtky': {
    slug: 'bezkoshtovni-hurtky',
    nav: 'Гуртки та курси',
    navEn: 'Clubs & courses',
    h1: ['Безкоштовні гуртки та курси', 'для дітей'],
    title: 'Безкоштовні гуртки та курси для дітей — онлайн і в містах України',
    description:
      'Безкоштовні гуртки, курси й майстер-класи для дітей 0–18 років: програмування, мистецтво, мови, наука. Онлайн і офлайн по Україні. Оновлюється щодня.',
    intro:
      'Гуртки й курси, за які не треба платити: державні, від громадських організацій, університетів і бізнесу. Частина працює онлайн, тож долучитись можна з будь-якого міста або з-за кордону.',
    note:
      'Каталог не бере комісії й нічого не продає — ми лише збираємо в одному місці те, що вже існує, і перевіряємо кожен запис вручну.',
    // FAQ: видимий блок + FAQPage-схема. Питання — реальні запити з пошуку;
    // відповіді самодостатні, щоб AI-асистент міг процитувати їх дослівно.
    faq: [
      {
        q: 'Чи справді всі гуртки в цій підбірці безкоштовні?',
        a: 'Так. Сюди потрапляють лише гуртки, курси й майстер-класи з безкоштовною участю: державні програми, проєкти громадських організацій, університетів і бізнесу. Кожен запис перевірено вручну перед публікацією.',
      },
      {
        q: 'Чи можна займатися онлайн з іншого міста або з-за кордону?',
        a: 'Так. Частина гуртків і курсів працює онлайн — у каталозі це позначено форматом на картці. Долучитися можна з будь-якого міста України або з-за кордону.',
      },
      {
        q: 'Як записатися на безкоштовний гурток?',
        a: 'Кожна картка в каталозі веде на офіційну сторінку організатора — запис відбувається саме там. Dityam не бере комісії та не збирає заявок: це відкритий каталог.',
      },
    ],
    // Англійська версія — не переклад, а своя сторінка під свої запити.
    // Українську писали під «безкоштовні гуртки для дітей»; англійською так
    // не шукають — шукають батьки, що виїхали, і формулюють через «online»
    // та «Ukrainian children», тож саме ці слова тут і несучі.
    en: {
      slug: 'free-clubs-and-courses',
      h1: ['Free clubs and courses', 'for children'],
      title: 'Free clubs and courses for Ukrainian children — online and in Ukraine',
      description:
        'Free clubs, courses and workshops for children aged 0–18: coding, art, languages, science. Online and across Ukraine, open to families abroad. Updated daily.',
      intro:
        'Clubs and courses that cost nothing: run by the state, by charities, universities and companies. Many are online, so a child can join from another city — or from another country.',
      note:
        'Dityam takes no commission and sells nothing. We collect what already exists in one place and check every listing by hand.',
      faq: [
        {
          q: 'Are these clubs really free?',
          a: 'Yes. Only clubs, courses and workshops with free participation are listed here: state programmes, projects by charities, universities and companies. Every listing is checked by hand before it is published.',
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
    match: (o) =>
      o.cost_type === 'free' &&
      !o.aid_type &&
      (['club', 'course', 'workshop', 'educational_material'].includes(o.opportunity_type) ||
        has(o, /гурток|гуртк|курс|майстер-клас|секці|студі/i)),
  },

  konkursy: {
    slug: 'konkursy',
    nav: 'Конкурси',
    navEn: 'Contests',
    h1: ['Конкурси для дітей', 'та підлітків'],
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
      h1: ['Contests for children', 'and teenagers'],
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
    match: (o) =>
      ['competition', 'hackathon'].includes(o.opportunity_type) ||
      has(o, /конкурс|змаганн|challenge|contest|хакатон/i),
  },

  'mizhnarodni-olimpiady': {
    slug: 'mizhnarodni-olimpiady',
    nav: 'Олімпіади',
    navEn: 'Olympiads',
    h1: ['Олімпіади для школярів', 'українські та міжнародні'],
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
      h1: ['Olympiads for school students', 'Ukrainian and international'],
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
    match: (o) =>
      o.opportunity_type === 'olympiad' || has(o, /олімпіад|olympiad|\bioi\b|\biol\b|\bimo\b/i),
  },

  'prohramy-obminu': {
    slug: 'prohramy-obminu',
    nav: 'Програми обміну',
    navEn: 'Exchange programs',
    h1: ['Програми обміну', 'для школярів'],
    title: 'Програми обміну для школярів — навчання за кордоном безкоштовно',
    description:
      'Програми обміну та навчання за кордоном для українських школярів: FLEX, AFS, Erasmus+, Global UGRAD, Rotary. Стипендіальні та безкоштовні. Дедлайни 2026.',
    intro:
      'Обміни — це рік або семестр у школі за кордоном із приймаючою родиною. Найвідоміші програми стипендіальні: дорогу, навчання й проживання оплачує організатор, родина не платить нічого.',
    note:
      'У обмінів найжорсткіші дедлайни з усього каталогу — заявки часто закриваються за пів року до виїзду.',
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
      h1: ['Exchange programmes', 'for school students'],
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
    match: (o) =>
      ['exchange', 'study_program', 'internship', 'residency'].includes(o.opportunity_type) ||
      has(o, /обмін|exchange|\bflex\b|\bafs\b|ugrad|erasmus|rotary/i),
  },

  'bezkoshtovni-tabory': {
    slug: 'bezkoshtovni-tabory',
    nav: 'Табори',
    navEn: 'Camps',
    h1: ['Безкоштовні табори', 'та путівки для дітей'],
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
        a: 'Насамперед діти пільгових категорій: ВПО, діти ветеранів і загиблих захисників, діти з інвалідністю, з малозабезпечених і багатодітних родин. Для них держава оплачує путівку повністю. Окремо існують безкоштовні табори від фондів і громадських організацій — часто відкриті для всіх.',
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
      h1: ['Free camps', 'and funded places for children'],
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
    match: (o) =>
      ['free', 'partially_free'].includes(o.cost_type) &&
      // rehabilitation свідомо НЕ включаємо: там інклюзивно-ресурсні центри
      // й реабілітація, а не табори.
      (['camp', 'summer_school'].includes(o.opportunity_type) ||
        has(o, /табір|табор|путівк|оздоровленн/i)),
  },
  'za-kordon': {
    slug: 'za-kordon',
    nav: 'За кордон',
    navEn: 'Going abroad',
    h1: ['Дитина їде за кордон', 'обміни, стипендії, табори'],
    title: 'Дитина їде за кордон — обміни, стипендії й табори для школярів 2026',
    description:
      'Усі можливості для українських дітей і підлітків поїхати за кордон: програми обміну, стипендії в закордонні школи, міжнародні табори, олімпіади й стажування. Більшість безкоштовні. Дедлайни 2026.',
    intro:
      'Тут зібрано лише те, де дитина справді їде за межі України: рік у школі США за FLEX, семестр в Європі, стипендії UWC і Ukraine Global Scholars, міжнародні олімпіади, табори й молодіжні обміни Erasmus+. Більшість програм стипендіальні — дорогу, навчання і проживання оплачує організатор.',
    note:
      'Найважливіше тут — час: набори на обміни й стипендії закриваються за пів року до виїзду. Правила виїзду неповнолітніх з України під час воєнного стану змінюються, тож перед подачею перевірте актуальні вимоги на сайті Державної прикордонної служби.',
    faq: [
      {
        q: 'Чи може підліток поїхати за кордон на програму сам, без батьків?',
        a: 'Так, більшість програм обміну й стипендій розраховані на самостійну поїздку підлітка 14–18 років: він живе в приймаючій родині або в кампусі під наглядом організатора. Без батьків дитина виїжджає з України лише з нотаріально засвідченою згодою батьків і в супроводі дорослого; актуальні правила перетину кордону під час воєнного стану уточнюйте в Державній прикордонній службі.',
      },
      {
        q: 'Скільки коштує поїздка дитини за кордон за програмою?',
        a: 'Більшість програм у цій підбірці стипендіальні: FLEX, UWC, Ukraine Global Scholars, молодіжні обміни Erasmus+ покривають дорогу, навчання й проживання повністю або майже повністю. Якщо участь платна або є внесок, це позначено на картці можливості.',
      },
      {
        q: 'З якого віку дитина може поїхати за кордон на навчання чи обмін?',
        a: 'Найбільше програм для 14–18 років: обміни й стипендії в закордонні школи беруть учнів 8–11 класів. Для молодших дітей є міжнародні табори й олімпіади, зазвичай із супроводом дорослого. Вік учасників вказано на кожній картці.',
      },
    ],
    en: {
      slug: 'abroad',
      h1: ['Going abroad', 'exchanges, scholarships, camps'],
      title: 'Ukrainian children going abroad — exchanges, scholarships and camps 2026',
      description:
        'Every opportunity for a Ukrainian child or teenager to go abroad: exchange programmes, scholarships to schools abroad, international camps, olympiads and internships. Mostly free. 2026 deadlines.',
      intro:
        'Only opportunities where a child actually travels outside Ukraine: a year at a US school with FLEX, a semester in Europe, UWC and Ukraine Global Scholars scholarships, international olympiads, camps and Erasmus+ youth exchanges. Most are scholarship-funded — travel, tuition and accommodation are paid by the organiser.',
      note:
        'Timing matters most here: exchange and scholarship intakes close about six months before departure. Rules for minors leaving Ukraine under martial law change, so check the current requirements with the State Border Guard Service before applying.',
      faq: [
        {
          q: 'Can a teenager go abroad on a programme without parents?',
          a: 'Yes. Most exchange and scholarship programmes are designed for a 14–18-year-old travelling alone: they live with a host family or on campus under the organiser’s supervision. A child leaves Ukraine without parents only with a notarised parental consent and an accompanying adult; check the current martial-law border rules with the State Border Guard Service.',
        },
        {
          q: 'How much does it cost?',
          a: 'Most programmes here are scholarship-funded: FLEX, UWC, Ukraine Global Scholars and Erasmus+ youth exchanges cover travel, tuition and accommodation in full or almost in full. Where there is a fee or a contribution, it is stated on the opportunity card.',
        },
        {
          q: 'From what age can a child go abroad to study or on an exchange?',
          a: 'Most programmes are for ages 14–18: exchanges and scholarships to schools abroad take students in grades 8–11. Younger children have international camps and olympiads, usually with an accompanying adult. The age range is shown on every card.',
        },
      ],
    },
    // Міських сторінок «місто × за кордон» не буває: поїздка не привʼязана
    // до міста, а пʼять записів із київським організатором зробили б
    // сторінку «Дитина їде за кордон у Києві», яка нікому не відповідає.
    noCityPages: true,
    match: (o) => {
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
   * Діти ветеранів, загиблих і зниклих безвісти захисників.
   *
   * Ця підбірка вужча за решту навмисно: сюди потрапляє лише те, де статус
   * родини — умова участі, а не побіжна згадка. Помилка тут коштує дорожче
   * за порожню сторінку: родина витрачає сили на програму, куди її не
   * візьмуть. Тому текстове правило вимагає звʼязки «діти/родини» + «ветерани
   * /загиблі/захисники», а не окремого слова «ветеран» будь-де в описі —
   * інакше сюди їхали 99 записів, де ветерани згадані мимохідь.
   *
   * Станом на 11.09.2026 таких записів 11. Це чесне число, і сторінка
   * показує саме його: вона росте разом із базою.
   */
  'dity-veteraniv': {
    slug: 'dity-veteraniv',
    nav: 'Дітям ветеранів',
    navEn: 'Children of veterans',
    h1: ['Дітям ветеранів і загиблих захисників', 'програми, табори, підтримка'],
    title: 'Дітям ветеранів і загиблих захисників — програми, табори й підтримка 2026',
    description:
      'Можливості для дітей ветеранів, загиблих і зниклих безвісти захисників України: безкоштовні табори, освітні програми, психологічна підтримка, пільги при вступі. Перевірені програми з дедлайнами.',
    intro:
      'Тут зібрано те, де статус родини — умова участі: безкоштовні табори й оздоровлення для дітей пільгових категорій, психологічна підтримка родинам військових, освітні та профорієнтаційні програми. Окрім цієї сторінки, дитині доступне все інше на платформі — фільтр «Особлива потреба» у каталозі має окремий пункт «Діти ветеранів».',
    note:
      'Майже скрізь статус підтверджують документом: посвідчення члена родини загиблого, посвідчення дитини учасника бойових дій або довідка з військової частини. Складіть скан-копії заздалегідь — у програм із коротким набором це вирішує, встигнете ви чи ні. Пільги при вступі до коледжу чи університету (компенсація контрактного навчання, гуртожиток, підручники) оформлює сам заклад освіти — по них звертайтесь у приймальну комісію.',
    faq: [
      {
        q: 'Хто вважається дитиною ветерана або загиблого захисника?',
        a: 'Зазвичай це діти учасників бойових дій, осіб з інвалідністю внаслідок війни, загиблих або померлих захисників і захисниць, а також тих, хто зник безвісти чи перебуває в полоні. Точний перелік залежить від конкретної програми — він завжди вказаний в умовах на сторінці організатора.',
      },
      {
        q: 'Які пільги має така дитина при вступі?',
        a: 'Держава щороку виділяє кошти на компенсацію контрактного навчання для дітей ветеранів і загиблих захисників у закладах фахової передвищої та вищої освіти; окремо діють пільгові кредити на навчання, безкоштовні підручники й місце в гуртожитку. Умови на кожен навчальний рік ухвалює Кабінет Міністрів, тому актуальні правила й перелік документів уточнюйте в приймальній комісії закладу.',
      },
      {
        q: 'Чи можна безкоштовно оздоровити дитину?',
        a: 'Так. Діти пільгових категорій, зокрема діти ветеранів і загиблих захисників, мають право на безкоштовні путівки за державною програмою оздоровлення, а частину таборів дають благодійні фонди. Такі програми є на цій сторінці; путівки за державною програмою оформлюють через службу у справах дітей за місцем проживання.',
      },
    ],
    en: {
      slug: 'children-of-veterans',
      h1: ['Children of veterans and fallen defenders', 'programmes, camps, support'],
      title: 'Children of Ukrainian veterans and fallen defenders — programmes and support 2026',
      description:
        'Opportunities for children of Ukrainian veterans, fallen and missing defenders: free camps, educational programmes, psychological support, admission benefits. Verified programmes with deadlines.',
      intro:
        'Programmes where the family status is a condition of entry: free camps and recovery stays for children of protected categories, psychological support for military families, educational and career-guidance programmes. Everything else on the platform is open to these children too — the catalogue filter has a separate option for children of veterans.',
      note:
        'Almost every programme asks for a document confirming the status. Prepare the scans in advance: for programmes with a short intake it decides whether you make it. Admission benefits at colleges and universities are arranged by the institution itself — ask its admissions office.',
      faq: [
        {
          q: 'Who counts as a child of a veteran or a fallen defender?',
          a: 'Usually children of combat participants, of people disabled as a result of the war, of fallen defenders, and of those missing in action or held captive. The exact list depends on the programme and is always stated in the organiser\u2019s conditions.',
        },
        {
          q: 'What admission benefits does such a child have?',
          a: 'The state allocates funds every year to cover tuition for children of veterans and fallen defenders in vocational and higher education, alongside subsidised study loans, free textbooks and a place in a dormitory. The terms are set by the Cabinet of Ministers for each academic year, so check the current rules with the institution\u2019s admissions office.',
        },
        {
          q: 'Can the child get a free camp or recovery stay?',
          a: 'Yes. Children of protected categories, including children of veterans and fallen defenders, are entitled to free places under the state recovery programme, and charities fund part of the camps. State places are arranged through the local children\u2019s services department.',
        },
      ],
    },
    // Статус не привʼязаний до міста: сторінка «дітям ветеранів у Львові» з
    // двох записів нікому не відповідає.
    noCityPages: true,
    match: (o) => {
      if ((o.child_needs || []).includes('veteran_family')) return true;
      // Звʼязка «діти/родини» + «ветерани/загиблі/захисники» у назві чи описі.
      // Саме звʼязка: окреме слово «ветеран» ловило 99 записів, де воно стоїть
      // у переліку партнерів або в історії організації.
      const text = `${o.title || ''} ${o.summary || ''}`;
      return /(дітей|діти|дитин|родин|сім)[^.]{0,40}(ветеран|загибл|полегл|захисник|військовослужбовц|військових|УБД|бойових дій)|дітям героїв|діти героїв/i
        .test(text);
    },
  },
};

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

/** Підбірка за англійським слагом — для маршрутів під /en. */
export const topicByEnSlug = (slug) =>
  TOPIC_LIST.find((t) => t.en.slug === slug);
