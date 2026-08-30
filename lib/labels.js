// Українські підписи для машинних значень з `opportunities`.
// Жили копіями в OpportunitiesList.js та o/[slug]/page.js; тепер ще й OG-картинки
// їх потребують, тож винесено сюди, щоб три копії не розʼїхались.

export const TYPE_LABELS = {
  course: 'Курс',
  workshop: 'Майстер-клас',
  summer_school: 'Літня школа',
  study_program: 'Навчальна програма',
  mentorship: 'Менторство',
  club: 'Гурток',
  camp: 'Табір',
  olympiad: 'Олімпіада',
  competition: 'Конкурс',
  hackathon: 'Хакатон',
  sport_tournament: 'Спорт. турнір',
  festival: 'Фестиваль',
  award: 'Премія',
  exchange: 'Обмін',
  excursion: 'Екскурсія',
  residency: 'Резиденція',
  scholarship: 'Стипендія',
  grant: 'Грант',
  allowance: 'Виплата',
  support_payment: 'Соц. виплата',
  internship: 'Стажування',
  volunteer: 'Волонтерство',
  conference: 'Конференція',
  medical_aid: 'Мед. допомога',
  psychology: 'Психологія',
  rehabilitation: 'Реабілітація',
  humanitarian: 'Гум. допомога',
  legal_aid: 'Правова допомога',
  shelter: 'Прихисток',
  educational_material: 'Навч. матеріали',
  // legacy aliases
  study_abroad: 'Навчання за кордоном',
  sport_event: 'Спорт',
};

// Англійські підписи типів — для /en, де картки показують справжні записи
// з бази: назва й опис лишаються українськими (це самі дані), а рамка
// картки має читатись, інакше іноземцю не зрозуміти навіть, що це за річ.
export const TYPE_LABELS_EN = {
  course: 'Course',
  workshop: 'Workshop',
  summer_school: 'Summer school',
  study_program: 'Study program',
  mentorship: 'Mentorship',
  club: 'Club',
  camp: 'Camp',
  olympiad: 'Olympiad',
  competition: 'Competition',
  hackathon: 'Hackathon',
  sport_tournament: 'Sports tournament',
  festival: 'Festival',
  award: 'Award',
  exchange: 'Exchange',
  excursion: 'Excursion',
  residency: 'Residency',
  scholarship: 'Scholarship',
  grant: 'Grant',
  allowance: 'Allowance',
  support_payment: 'Support payment',
  internship: 'Internship',
  volunteer: 'Volunteering',
  conference: 'Conference',
  medical_aid: 'Medical aid',
  psychology: 'Psychological support',
  rehabilitation: 'Rehabilitation',
  humanitarian: 'Humanitarian aid',
  legal_aid: 'Legal aid',
  shelter: 'Shelter',
  educational_material: 'Learning materials',
  study_abroad: 'Study abroad',
  sport_event: 'Sport',
};

export const AID_TYPE_LABELS = {
  cash: 'держвиплата',
  scholarship: 'соц. стипендія',
  recreation: 'оздоровлення',
  free_activities: 'безкоштовна секція',
  vocational: 'проф. навчання',
};

// Типи, що відкриваються щороку: минулий дедлайн для них не означає «більше ніколи».
// Використовує і каталог (не ховати їх), і сторінка можливості (текст плашки).
export const ANNUAL_TYPES = new Set([
  'olympiad',
  'competition',
  'exchange',
  'scholarship',
  'festival',
  'camp',
  'grant',
  'study_abroad',
]);

export const COST_LABELS = {
  free: 'Безкоштовно',
  partially_free: 'З фінансуванням',
  paid_affordable: 'Доступно',
};

// «7-11 років» / «0-18 років» — та сама логіка, що на картці каталогу.
export function ageLabel(from, to) {
  if (from === to) return `${from} років`;
  if (from === 0 && to >= 17) return '0-18 років';
  return `${from}-${to} років`;
}

// Типи, де дата в полі deadline — це день, коли подія відбувається, а не
// останній день подачі. Для них «Дедлайн» — брехня: подія не закривається,
// вона просто настає.
//
// ⚠️ Це визначення читають І сайт, І бот (scripts/check-deadlines.mjs,
// scripts/post-to-telegram.mjs). Тримати його тут — єдиний спосіб не
// отримати знову ситуацію, коли бот пише «Коли», а картка на сайті поруч
// пише «Дедлайн» про ту саму подію.
//
// competition сюди свідомо НЕ входить: у конкурсів дата майже завжди
// означає останній день подачі роботи.
export const EVENT_TYPES = new Set([
  'camp', 'festival', 'excursion', 'conference', 'hackathon',
  'workshop', 'sport_tournament', 'summer_school',
]);

// Заповнений event_end_date — пряма ознака датованої події, хоч би який тип.
export const isEvent = (item) =>
  EVENT_TYPES.has(item?.opportunity_type) || Boolean(item?.event_end_date);

// Підпис до дати на картці й у пості.
export const dateLabel = (item) => (isEvent(item) ? 'Коли' : 'Дедлайн');

// Формат у базі лежить як прийшов від екстракції: поруч живуть «Онлайн»,
// «offline», «Гібрид» і навіть сміття на кшталт «club» чи назви джерела.
// Показувати це людині сирим не можна, тож зводимо до трьох зрозумілих
// станів, а нерозпізнане ховаємо — краще нічого, ніж «gurtok.org».
export function formatLabel(raw, lang = 'uk') {
  const v = String(raw || '').toLowerCase().trim();
  if (!v) return null;
  const en = lang === 'en';
  const online = /онлайн|online|дистанц/.test(v);
  const offline = /офлайн|offline|наживо/.test(v);
  if (online && offline) return en ? 'Online and in person' : 'Онлайн і наживо';
  if (/гібрид|hybrid/.test(v)) return en ? 'Online and in person' : 'Онлайн і наживо';
  if (online) return en ? 'Online' : 'Онлайн';
  if (offline) return en ? 'In person' : 'Наживо';
  return null;
}

// Англійські підписи для решти довідників. Тримаємо їх поруч з українськими:
// власна копія списку вже одного разу розійшлася з оригіналом і в англійський
// футер протекли «Конкурси».
export const AID_TYPE_LABELS_EN = {
  cash: 'state payment',
  scholarship: 'social scholarship',
  recreation: 'recreation',
  free_activities: 'free activity',
  vocational: 'vocational training',
};

export const NEED_LABELS_EN = {
  gifted: 'gifted',
  disability: 'disability',
  autism: 'autism',
  idp: 'displaced',
  veteran_family: 'veterans’ and fallen soldiers’ children',
  de_occupied: 'from de-occupied areas',
  frontline: 'from front-line areas',
  oncology: 'cancer patients',
  rare_disease: 'rare diseases',
  low_income: 'low income',
  orphan: 'orphans',
  large_family: 'large families',
  rural: 'rural areas',
};

// Міст у базі всього десяток, і майже всі — не міста, а зони охоплення
// («Вся Україна», «Онлайн»). Тож словник, а не транслітератор; для нового
// значення лишається оригінал, і це видно одразу.
export const CITY_EN = {
  'Онлайн': 'Online',
  'Вся Україна': 'All of Ukraine',
  'Міжнародні': 'International',
  'Київ': 'Kyiv',
  'Львів': 'Lviv',
  'Харків': 'Kharkiv',
  'Одеса': 'Odesa',
  'Дніпро': 'Dnipro',
  'Житомир': 'Zhytomyr',
  'Хмельницький': 'Khmelnytskyi',
  'Вінниця': 'Vinnytsia',
  'Полтава': 'Poltava',
  'Чернігів': 'Chernihiv',
  'Черкаси': 'Cherkasy',
  'Суми': 'Sumy',
  'Рівне': 'Rivne',
  'Луцьк': 'Lutsk',
  'Тернопіль': 'Ternopil',
  'Ужгород': 'Uzhhorod',
  'Чернівці': 'Chernivtsi',
  'Івано-Франківськ': 'Ivano-Frankivsk',
  'Кропивницький': 'Kropyvnytskyi',
  'Миколаїв': 'Mykolaiv',
  'Запоріжжя': 'Zaporizhzhia',
  'Кривий Ріг': 'Kryvyi Rih',
  'Херсон': 'Kherson',
};

// Області окремо: прикметникова форма («Полтавська») не збігається з назвою
// міста («Полтава»), тож вивести одну з одної не можна — потрібен свій список.
// Він повний: двадцять чотири області й Крим, більше не буде.
export const REGION_EN = {
  'Вінницька': 'Vinnytsia',
  'Волинська': 'Volyn',
  'Дніпропетровська': 'Dnipropetrovsk',
  'Донецька': 'Donetsk',
  'Житомирська': 'Zhytomyr',
  'Закарпатська': 'Zakarpattia',
  'Запорізька': 'Zaporizhzhia',
  'Івано-Франківська': 'Ivano-Frankivsk',
  'Київська': 'Kyiv',
  'Кіровоградська': 'Kirovohrad',
  'Луганська': 'Luhansk',
  'Львівська': 'Lviv',
  'Миколаївська': 'Mykolaiv',
  'Одеська': 'Odesa',
  'Полтавська': 'Poltava',
  'Рівненська': 'Rivne',
  'Сумська': 'Sumy',
  'Тернопільська': 'Ternopil',
  'Харківська': 'Kharkiv',
  'Херсонська': 'Kherson',
  'Хмельницька': 'Khmelnytskyi',
  'Черкаська': 'Cherkasy',
  'Чернівецька': 'Chernivtsi',
  'Чернігівська': 'Chernihiv',
  'Автономна Республіка Крим': 'Crimea',
};

/** Місто чи область мовою сторінки. Незнайоме значення лишається як є. */
export function cityLabel(city, lang) {
  if (lang !== 'en') return city;
  const v = String(city || '').trim();
  if (CITY_EN[v]) return CITY_EN[v];
  const m = /^(.+?)\s+(?:область|обл\.?)$/.exec(v);
  if (m && REGION_EN[m[1]]) return `${REGION_EN[m[1]]} region`;
  return city;
}

/** Підпис дати: у події — «коли», у заявки — «дедлайн». */
export const dateLabelEn = (item) => (isEvent(item) ? 'When' : 'Deadline');
