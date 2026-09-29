/**
 * «Українським дітям за кордоном» — правило добору для хаба й сторінок країн.
 *
 * Аудиторія (Марія, 22.09.2026): родини з України, які ВЖЕ живуть у Польщі,
 * Німеччині чи іншій країні й шукають, що є для дитини там. Це не «дитина
 * їде за кордон» (/za-kordon): обміни, стипендії, олімпіади й табори, куди
 * їдуть з України, сюди не потрапляють.
 *
 * Жодного нового поля в базі (рішення Марії: «це просто буде підбірка»).
 * Правило читає те, що вже є:
 *   1) країна поза Україною в `countries`;
 *   2) ознака в НАЗВІ чи SUMMARY, що запис для тих, хто там живе.
 * Опис (details) не читаємо: він не їде на сторінки підбірок, а правило має
 * рахувати однаково на підбірці, у хабі підбірок, у sitemap і в llms.txt.
 * Тому для діаспори в summary треба прямо писати, для кого запис.
 *
 * Ознаки двох сил.
 *   Сильні — достатньо самих: «які проживають у Словаччині», діти біженців,
 *   тимчасовий захист, новоприбулі, діти іноземців, суботня/недільна
 *   українська школа, діаспора. Так пишуть лише про тих, хто вже в країні.
 *   Слабкі — «для українських дітей / родин», «українцям у Нідерландах».
 *   Так само пишуть і про поїздку з України (тенісний табір в Іспанії «для
 *   українських дітей», обмін «для українських і німецьких підлітків у
 *   Берліні»), тож слабкої ознаки досить лише для типів, за якими нікуди не
 *   їдуть: гуртки, курси, заняття, допомога, психолог.
 * Обміни, волонтерство, стажування й резиденції — поїздка за визначенням,
 * а ознаки поїздки в тексті (закордонний паспорт, віза, переліт) скасовують
 * усе інше.
 *
 * Точність заміряно 28.09.2026 на живій базі (51 запис із закордонною
 * країною): правило бере 11, усі — для тих, хто вже за кордоном; решта 40 —
 * поїздки. Приклади з обох боків — у tests/diaspora.test.mjs.
 *
 * Цей модуль читають тести на голому node — лише відносні імпорти.
 */
import { abroadCountries } from './geo.js';

/**
 * Назви країн: називний (заголовок групи), місцевий («у Польщі») і
 * англійська. Ті, що трапляються в базі, і сусіди, куди найбільше виїхали;
 * невідомий код підпише Intl.
 */
const COUNTRY_NAMES = {
  pl: ['Польща', 'Польщі', 'Poland'],
  de: ['Німеччина', 'Німеччині', 'Germany'],
  cz: ['Чехія', 'Чехії', 'Czechia'],
  sk: ['Словаччина', 'Словаччині', 'Slovakia'],
  ie: ['Ірландія', 'Ірландії', 'Ireland'],
  nl: ['Нідерланди', 'Нідерландах', 'the Netherlands'],
  it: ['Італія', 'Італії', 'Italy'],
  es: ['Іспанія', 'Іспанії', 'Spain'],
  ro: ['Румунія', 'Румунії', 'Romania'],
  md: ['Молдова', 'Молдові', 'Moldova'],
  hu: ['Угорщина', 'Угорщині', 'Hungary'],
  at: ['Австрія', 'Австрії', 'Austria'],
  ch: ['Швейцарія', 'Швейцарії', 'Switzerland'],
  fr: ['Франція', 'Франції', 'France'],
  be: ['Бельгія', 'Бельгії', 'Belgium'],
  gb: ['Велика Британія', 'Великій Британії', 'the United Kingdom'],
  lt: ['Литва', 'Литві', 'Lithuania'],
  lv: ['Латвія', 'Латвії', 'Latvia'],
  ee: ['Естонія', 'Естонії', 'Estonia'],
  se: ['Швеція', 'Швеції', 'Sweden'],
  no: ['Норвегія', 'Норвегії', 'Norway'],
  dk: ['Данія', 'Данії', 'Denmark'],
  fi: ['Фінляндія', 'Фінляндії', 'Finland'],
  pt: ['Португалія', 'Португалії', 'Portugal'],
  bg: ['Болгарія', 'Болгарії', 'Bulgaria'],
  gr: ['Греція', 'Греції', 'Greece'],
  tr: ['Туреччина', 'Туреччині', 'Türkiye'],
  us: ['США', 'США', 'the United States'],
  ca: ['Канада', 'Канаді', 'Canada'],
};

/** Країни для вибору у формі правки (lib/country-field.js), за абеткою. */
export const KNOWN_COUNTRIES = Object.entries(COUNTRY_NAMES)
  .map(([code, [name]]) => ({ code, name }))
  .sort((a, b) => a.name.localeCompare(b.name, 'uk'));

/** Типи, за якими нікуди не їдуть: тут вистачає слабкої ознаки. */
const LOCAL_TYPES = new Set([
  'club', 'course', 'workshop', 'mentorship', 'educational_material',
  'humanitarian', 'psychology', 'medical_aid', 'legal_aid', 'shelter',
]);

/** Поїздка за визначенням: такий запис — на /za-kordon, хай що в тексті. */
const MOBILITY_TYPES = new Set(['exchange', 'volunteer', 'internship', 'residency']);

const L = '[а-яіїєґʼ’\']';

// «у Польщі», «у Великій Британії», «у країнах ЄС», «за кордоном».
const PLACE_ABROAD = `(?:(?:у|в|на)\\s+(?:${[
  ...Object.values(COUNTRY_NAMES).map(([, loc]) => loc.replace(/\s+/g, '\\s+')),
  `країн${L}*`, 'Європі', 'ЄС',
].join('|')})|за\\s+кордоном)`;

// Сильні ознаки: той, для кого запис, уже живе в країні.
const STRONG = new RegExp([
  // «дітей, які проживають у Словаччині». Лише з назвою країни: «учасники,
  // які проживають у Львівській області» — про інше.
  `(?:які|що)\\s+(?:зараз\\s+|нині\\s+|тимчасово\\s+|вже\\s+|постійно\\s+)?(?:проживають|мешкають|перебувають|живуть)\\s+${PLACE_ABROAD}`,
  `(?:які|що)\\s+(?:вимушено\\s+)?виїхал${L}*`,
  // «для дітей біженців», «дітей-біженців», «українських біженців». Саме
  // слово «біженці» не годиться: «волонтерство з допомоги біженцям» — поїздка.
  `(?:діт|дитин|родин|сім|підлітк|школяр|учн)${L}*[\\s-]+біженц${L}*`,
  `(?:для|українськ${L}*)\\s+біженц${L}*`,
  `біженц${L}*\\s+з\\s+україни`,
  `тимчасов${L}*\\s+захист${L}*`,
  `новоприбул${L}*`,
  `дітей\\s+іноземців`,
  `діт${L}*\\s+мігрант${L}*`,
  `з\\s+іншою\\s+рідною\\s+мовою`,
  `діаспор${L}*`,
  `(?:суботн|недільн)${L}*\\s+(?:українськ${L}*\\s+)?школ${L}*`,
  `українськ${L}*\\s+(?:суботн|недільн)${L}*\\s+школ${L}*`,
  'рідна\\s+школа',
].join('|'), 'i');

// Слабкі ознаки: адресовано українським дітям чи родинам — але так пишуть і
// про поїздки. «українським та румунським школярам» — теж.
const WEAK = new RegExp([
  `українц${L}*`,
  `українськ${L}*(?:\\s+(?:та|і|й)\\s+${L}+ськ${L}*)?\\s+(?:діт|дитин|родин|сім|школяр|учн|підлітк|молод)${L}*`,
  `(?:діт|родин|сім|школяр|учн|підлітк)${L}*\\s+з\\s+україни`,
].join('|'), 'i');

// Ознаки поїздки з України. Такий запис — на /za-kordon, навіть коли в ньому
// стоїть «для українських дітей».
const TRIP = new RegExp([
  `закордонн${L}*\\s+паспорт${L}*`,
  `віз(?:а|и|у|ою)(?![а-яіїєґ])`,
  `переліт${L}*`,
  `авіаквит${L}*`,
  `з\\s+україни\\s+до\\s`,
  `виїзд${L}*\\s+з\\s+україни`,
  `(?:поїздк|подорож)${L}*\\s+(?:до|в|у)\\s`,
  `літн${L}*\\s+мовн${L}*\\s+(?:школ|курс)${L}*`,
].join('|'), 'i');

const textOf = (o) => `${o.title || ''} ${o.summary || ''}`;

/** Країни запису поза Україною, нижній регістр, без повторів. */
export const diasporaCountries = (o) =>
  [...new Set(abroadCountries(o).map((c) => String(c).toLowerCase()))];

/**
 * Чому запис потрапляє (або ні) — для тестів і звіту про точність.
 * Повертає 'strong' | 'weak' | null.
 */
export function diasporaReason(o) {
  if (!diasporaCountries(o).length) return null;
  if (MOBILITY_TYPES.has(o.opportunity_type)) return null;
  const text = textOf(o);
  if (TRIP.test(text)) return null;
  if (STRONG.test(text)) return 'strong';
  if (WEAK.test(text) && LOCAL_TYPES.has(o.opportunity_type)) return 'weak';
  return null;
}

/** Запис — для українських дітей, які вже живуть у країні поза Україною. */
export const isDiaspora = (o) => diasporaReason(o) !== null;

/**
 * Країни, які мають право на власну сторінку (рішення Марії 22.09.2026:
 * Польща, Німеччина, решта — «інші країни»). Сторінка існує лише від
 * MIN_COUNTRY відкритих записів; нижче — 404, її немає ні в хабі, ні в
 * sitemap, а записи країни стоять у хабі під її назвою.
 *
 * slug — транслітерація за постановою КМУ № 55, як решта адрес сайту
 * (dity-zakhysnykiv, prohramy-obminu).
 */
export const MIN_COUNTRY = 3;

export const DIASPORA_COUNTRIES = [
  { code: 'pl', slug: 'polshcha', slugEn: 'poland' },
  { code: 'de', slug: 'nimechchyna', slugEn: 'germany' },
];

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** Назва країни для заголовка групи: «Ірландія» / «Ireland». */
export function countryName(code, lang = 'uk') {
  const known = COUNTRY_NAMES[String(code).toLowerCase()];
  if (known) return lang === 'en' ? cap(known[2].replace(/^the /, '')) : known[0];
  try {
    return new Intl.DisplayNames([lang === 'en' ? 'en' : 'uk'], { type: 'region' })
      .of(String(code).toUpperCase());
  } catch {
    return String(code).toUpperCase();
  }
}

/** «у Польщі» / «in Poland». */
export function inCountry(code, lang = 'uk') {
  const known = COUNTRY_NAMES[String(code).toLowerCase()];
  if (lang === 'en') return `in ${known ? known[2] : countryName(code, 'en')}`;
  return known ? `у ${known[1]}` : `у країні ${countryName(code)}`;
}

/** Записи, що стоять на сторінці країни. */
export const inDiasporaCountry = (o, code) =>
  isDiaspora(o) && diasporaCountries(o).includes(code);

/**
 * Які сторінки країн існують зараз: скільки записів у кожної з
 * DIASPORA_COUNTRIES і чи дотягує до порогу. rows — уже живі записи.
 */
export function liveCountryPages(rows) {
  return DIASPORA_COUNTRIES
    .map((c) => ({ ...c, count: rows.filter((o) => inDiasporaCountry(o, c.code)).length }))
    .filter((c) => c.count >= MIN_COUNTRY);
}

/**
 * Групи для хаба: записи країн, що НЕ мають власної сторінки, під назвою
 * країни. Запис кількох країн стоїть у першій із них, що без сторінки; якщо
 * всі його країни мають сторінки — у хабі його немає, він там.
 * Порядок: більші групи вище, далі за абеткою.
 */
export function hubGroups(items, pageCodes, lang = 'uk') {
  const withPage = new Set(pageCodes);
  const groups = new Map();
  for (const o of items) {
    const code = diasporaCountries(o).find((c) => !withPage.has(c));
    if (!code) continue;
    if (!groups.has(code)) groups.set(code, []);
    groups.get(code).push(o);
  }
  return [...groups.entries()]
    .map(([code, list]) => ({ code, name: countryName(code, lang), items: list }))
    .sort((a, b) => b.items.length - a.items.length
      || a.name.localeCompare(b.name, lang === 'en' ? 'en' : 'uk'));
}

/**
 * Школа в країні — права й процедури, а не можливості (Марія, 28.09.2026:
 * запис до школи, підготовчі класи, перекладачі — не картки, а короткий абзац
 * на хабі й на сторінці країни). Кожне речення — з офіційної сторінки, яку
 * звірено 28.09.2026; посилання стоїть поруч. Італії абзацу немає: власної
 * сторінки в неї не буде, а перевіреного джерела ми не маємо.
 */
export const SCHOOL_NOTES = {
  pl: {
    uk: 'З 1 вересня 2026 року учні з України навчаються в Польщі за загальними правилами для дітей-іноземців. Школа дає безкоштовні додаткові уроки польської — щонайменше 2 години на тиждень, до 24 місяців — і вирівнювальні заняття до 12 місяців; може відкрити підготовчий клас і взяти міжкультурного асистента.',
    en: 'From 1 September 2026, pupils from Ukraine in Poland are taught under the general rules for foreign pupils. Schools provide free extra Polish lessons — at least 2 hours a week for up to 24 months — and catch-up classes for up to 12 months; a school may open a preparatory class and employ an intercultural assistant.',
    source: 'https://www.kuratorium.opole.pl/zmiany-w-zasadach-organizacji-ksztalcenia-i-wsparcia-uczniow-z-ukrainy-od-1-wrzesnia-2026-r/',
  },
  de: {
    uk: 'Навчання в школі в Німеччині обовʼязкове для всіх дітей — зазвичай з року, коли дитині виповнюється шість, і переважно девʼять років. Для тих, хто ще не знає німецької, є класи для новоприбулих: у Берліні на початку 2025 року в «Willkommensklassen» навчалася майже третина з 8 551 учня з України.',
    en: 'School is compulsory in Germany for all children — usually from the year a child turns six, mostly for nine years. Children who do not yet speak German can start in classes for newcomers: in early 2025 almost a third of Berlin’s 8,551 pupils from Ukraine were in “Willkommensklassen”.',
    source: 'https://www.germany4ukraine.de/DE/bildung-und-forschung/schule/seite_node.html',
  },
  cz: {
    uk: 'Вступники з тимчасовим захистом у 2026/27 навчальному році автоматично отримують на 25% більше часу на письмовий іспит — просити про це не треба. Школам допомагає Національний педагогічний інститут: письмовий і усний переклад, адаптаційні координатори для новоприбулих дітей.',
    en: 'Applicants with temporary protection automatically get 25% more time for the written entrance exam in 2026/27 — no request needed. Schools are supported by the National Pedagogical Institute: translation, interpreting and adaptation coordinators for newly arrived children.',
    source: 'https://edu.gov.cz/metodicke_materialy/uprava-prijimaciho-rizeni-pro-ukrajinske-zaky-ve-skolnim-roce-2026-2027/',
  },
  nl: {
    uk: 'Діти з України мають право на освіту в Нідерландах. Батьки самі записують дитину до обраної школи; громада допомагає, якщо родина живе в центрі прийому. Навчання може початися в класі для новоприбулих, і уроки нідерландської там є завжди.',
    en: 'Children from Ukraine have the right to education in the Netherlands. Parents register their child at the school of their choice; the municipality helps if the family lives in a reception centre. Education may start in a class for newcomers, which always includes Dutch lessons.',
    source: 'https://www.government.nl/themes/migration-and-travel/reception-of-refugees-from-ukraine/education',
  },
  ie: {
    uk: 'В Ірландії місце в школі дітям з України допомагають знайти регіональні освітні й мовні команди (REALT) при 16 освітніх радах (ETB); вони ж підтримують школи, куди приходять українські діти.',
    en: 'In Ireland, Regional Education and Language Teams (REALT) at the 16 education and training boards (ETBs) help children from Ukraine find a school place and support the schools they join.',
    source: 'https://www.gov.ie/en/department-of-education/press-releases/minister-foley-announces-establishment-of-regional-education-and-language-teams-for-ukraine/',
  },
  es: {
    uk: 'В Іспанії освіта обовʼязкова з 6 до 16 років, а початкова школа в державних закладах безкоштовна. Школами опікується кожна з 17 автономних спільнот, тож порядок залежить від регіону, де живе родина.',
    en: 'In Spain, education is compulsory from 6 to 16, and primary school is free in public schools. Schools are run by each of the 17 autonomous communities, so the procedure depends on the region where the family lives.',
    source: 'https://ucraniaurgente.inclusion.gob.es/w/escolarizacion-desplazados-ucrania',
  },
};

/** Абзаци «школа в країні» для сторінки: хаб — усі країни, сторінка країни — своя. */
export function schoolNotes(codes, lang = 'uk') {
  return codes
    .filter((code) => SCHOOL_NOTES[code])
    .map((code) => ({
      code,
      country: countryName(code, lang),
      text: SCHOOL_NOTES[code][lang === 'en' ? 'en' : 'uk'],
      source: SCHOOL_NOTES[code].source,
    }));
}
