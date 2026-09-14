/**
 * Де організації оголошують набори для дітей захисників.
 *
 * Список для /admin/zakhysnyky. Зібрано 14.09.2026: кожне посилання відкрито
 * й звірено, що акаунт саме цієї організації і живий у 2026 році. Чого
 * перевірити не вдалося, того тут немає (null), навіть якщо пошук щось
 * підказував. Порядок — за користю: спершу ті, де дитячі анонси виходять
 * найчастіше.
 *
 * Свідомо не включено Український ветеранський фонд: він фінансує
 * ветеранський бізнес, програм для дітей не має.
 *
 * scraped: true — Telegram-канал уже читає scraper/scrapers/telegram_web.py.
 */
export const WATCH_CHECKED = '14.09.2026';

export const DEFENDERS_WATCH = [
  {
    org: 'Львівський центр надання послуг учасникам бойових дій',
    forChildren: 'Регулярні безкоштовні події для дітей захисників (океанаріум, майстер-класи); поширює набір на ретрит Rotary для дітей загиблих і зниклих безвісти.',
    site: 'https://veterany.city-adm.lviv.ua/',
    telegram: 'https://t.me/lcnpubd',
    instagram: null,
    facebook: null,
    announces: 'Telegram — дитячі анонси тут виходять найчастіше з усіх перевірених каналів. Здебільшого для Львова, ретрит Rotary — всеукраїнський.',
  },
  {
    org: 'Благодійний фонд «Голоси дітей»',
    forChildren: 'КЕМП+ — 21 день у Карпатах для родин, які втратили близьку людину на фронті; «Володар стихій» для підлітків; психологічні центри.',
    site: 'https://voices.org.ua/news/tsentry-kempy-onlayn-liniia-iak-pratsiuie-psykholohichna-dopomoha-u-fondi-holosy-ditey',
    telegram: 'https://t.me/voice_Kyiv',
    instagram: 'https://www.instagram.com/voices_of_children/',
    facebook: 'https://www.facebook.com/voicesofchildren.ua',
    announces: 'Регіональні Telegram-канали фонду: набір на КЕМП+ вийшов у t.me/voice_Kyiv 10.09.2026. Є ще канали Львова, Дніпра, Харкова, Миколаєва, Запоріжжя, Кривого Рогу.',
  },
  {
    org: 'ГО «Важливі»',
    forChildren: 'Безкоштовні онлайн-групи з психологом для дітей 7–15 років: «Діти воїнів», «Діти полеглих воїнів», «Діти зниклих безвісти воїнів».',
    site: 'https://important.org.ua/grupi-pidtrimki-dlya-ditey/ditu-voiniv',
    telegram: null,
    instagram: 'https://www.instagram.com/important.foundation/',
    facebook: 'https://www.facebook.com/important.foundation',
    announces: 'Постійна форма реєстрації на сайті. Telegram «ГО ВАЖЛИВІ» — це чат для батьків, а не канал з анонсами.',
  },
  {
    org: 'Міністерство у справах ветеранів України',
    forChildren: 'Разом із партнерами проводило табір для дітей загиблих захисників у Яремчі (2–9.08.2026).',
    site: 'https://mva.gov.ua/',
    telegram: 'https://t.me/MinveteranivUA',
    instagram: 'https://www.instagram.com/minveteraniv',
    facebook: 'https://www.facebook.com/mva.gov.ua/',
    announces: 'Реєстрацію на табір розсилали через сайти обласних адміністрацій (Google-форма). У Telegram міністерства дитячих анонсів мало.',
  },
  {
    org: 'Veteran Hub',
    forChildren: 'Зрідка — події для дітей загиблих (майстер-клас із риболовлі у Вінниці, 14.09.2026). Постійної дитячої програми немає.',
    site: 'https://veteranhub.com.ua/events/',
    telegram: 'https://t.me/VeteranHub',
    instagram: 'https://www.instagram.com/veteran_hub/',
    facebook: 'https://www.facebook.com/VeteranHubUa/',
    announces: 'Telegram «Ветеран Хаб на звʼязку» і сторінка подій. Переважно Вінниця й Київ.',
  },
  {
    org: 'Київ Мілітарі Хаб',
    forChildren: 'Мистецькі майстер-класи, планетарій, музеї й екскурсії для дітей захисників і родин загиблих.',
    site: 'https://kyivcity.gov.ua/veteranam_ta_khnim_rodinam/kiv_militari_khab/',
    telegram: 'https://t.me/CDUATO',
    instagram: 'https://www.instagram.com/kyiv_military_hub/',
    facebook: 'https://www.facebook.com/kyivCDUATO/',
    announces: 'Telegram і Facebook. Лише для киян.',
  },
  {
    org: 'Вінницька ОВА — Департамент ветеранської політики',
    forChildren: 'Відпочинок для дітей загиблих захисників за кордоном: Хорватія (14.08.2026), Чехія (08.07.2026).',
    site: 'https://www.vin.gov.ua/departament-veteranskoi-polityky',
    telegram: 'https://t.me/VinnytsiaODA',
    instagram: 'https://www.instagram.com/vinnytsia_oda/',
    facebook: null,
    announces: 'Стрічка новин департаменту на vin.gov.ua. Telegram — загальний канал ОВА. Лише для Вінниччини.',
  },
  {
    org: 'БФ «ТАПС» (TAPS Україна)',
    forChildren: 'TAPS Camp — реабілітаційний табір для дітей, які втратили близьких на війні.',
    site: 'https://taps.org.ua/projects/',
    telegram: null,
    instagram: 'https://www.instagram.com/taps.ukraine',
    facebook: 'https://www.facebook.com/ua.taps',
    announces: 'Розділ оголошень taps.org.ua/announcements. Дитячого набору у 2026 році там поки не було.',
  },
  {
    org: 'ГО Gen.Ukrainian — Gen.Camp',
    forChildren: '21-денна безкоштовна психологічна реабілітація, серед пріоритетів — діти, які втратили батьків.',
    site: 'https://genukrainian.com.ua/gencamp',
    telegram: null,
    instagram: 'https://www.instagram.com/gen.ukrainian/',
    facebook: 'https://www.facebook.com/gen.ukrainian/',
    announces: 'Постійна анкета на сайті або Direct в Instagram. Програма не лише для дітей захисників.',
  },
  {
    org: 'Благодійний фонд «Діти Героїв»',
    forChildren: 'Постійна підтримка дітей, які втратили батьків на війні, до повноліття; напрям «Психологія і соціалізація» з таборами.',
    site: 'https://childrenheroes.org/psyhologiya-i-soczializacziya/',
    telegram: null,
    instagram: 'https://www.instagram.com/children.heroes/',
    facebook: 'https://www.facebook.com/ChildrenofHeroes',
    announces: 'Публічних наборів немає: родина заповнює форму на сайті, табори — для підопічних фонду.',
  },
  {
    org: 'ГО «Українські мурахи» — «Канікули в горах»',
    forChildren: 'Відпочинок на Закарпатті для вдів із дітьми 6–18 років; родина платить лише за квитки на потяг.',
    site: 'https://kanikylu.uaants.com/',
    telegram: null,
    instagram: 'https://www.instagram.com/ua.ants/',
    facebook: 'https://www.facebook.com/groups/691532638684703/',
    announces: 'Постійна форма на сайті; у 2025 році дзвонили через кілька місяців після реєстрації. Дат на 2026 рік не знайдено.',
  },
  {
    org: 'Rotary International — «Здоровʼя дітей України»',
    forChildren: 'Безкоштовний 18-денний ретрит у Польщі для дітей 7–11 років, чиї батьки загинули або зникли безвісти після 01.01.2024.',
    site: 'https://veteran.com.ua/news/view/ditej-zahisnikiv-zaproshuyut-na-vidnovlyuvalnij-retrit-u-polshhi-yak-vzyati-uchast',
    telegram: null,
    instagram: null,
    facebook: null,
    announces: 'Власного каналу немає; набір поширює Львівський центр (t.me/lcnpubd). Уже є на сайті — заїзди до 17.12.2026.',
  },
  {
    org: 'AHEAD Foundation — Wonder Camp',
    forChildren: 'Реабілітаційний табір, де переважна частина учасників — діти загиблих захисників.',
    site: 'https://ahead.fund/',
    telegram: null,
    instagram: 'https://www.instagram.com/ahead.fund/',
    facebook: 'https://www.facebook.com/ahead.fund/',
    announces: 'Старти змін — у Facebook та Instagram. Відкритої реєстрації немає, діти потрапляють через бригади.',
  },
  {
    org: 'БФ «За майбутнє дітей» / школа «Оптіма»',
    forChildren: 'Стипендії на навчання в школі «Оптіма» для дітей, батьки яких загинули на війні, і дітей військових.',
    site: 'https://childrensfuture.org.ua/uk/our-projects/blahodijna-stypendialna-prohrama-dlya-ditej-batky-yakyx-zahynuly-na-vijni',
    telegram: null,
    instagram: 'https://www.instagram.com/tcf_childrensfuture',
    facebook: 'https://www.facebook.com/TCFchildrensfuture',
    announces: 'Новини на сайті фонду. Набору на 2026/2027 поки не знайдено.',
  },
  {
    org: 'Mountain Seed Foundation',
    forChildren: 'Скелелазіння для дітей родин військових у Дніпрі, Харкові, Києві, Львові; табори в Альпах для родин загиблих.',
    site: 'https://mountainseedfoundation.org/uk/',
    telegram: null,
    instagram: 'https://www.instagram.com/mountainseedfoundation',
    facebook: 'https://www.facebook.com/mountainseedfoundation',
    announces: 'Набирають через регіональних партнерів, публічних оголошень немає.',
  },
  {
    org: 'Тернопільська ОВА — Управління ветеранської політики',
    forChildren: 'Літній відпочинок і психологічне відновлення для дітей полеглих захисників (22.07.2026).',
    site: 'https://up-veteran.te.gov.ua/',
    telegram: null,
    instagram: null,
    facebook: 'https://www.facebook.com/oda.te.gov.ua',
    announces: 'Новини й анонси на сайті управління. Лише для Тернопільщини.',
  },
];
