/**
 * План Telegram-каналу: своя тема на кожен день.
 *
 * Навіщо. До 16.09.2026 канал жив за шаблоном тижня: ті самі сім форматів у
 * ті самі дні, мінялись лише можливості всередині. Марія: «чому план не
 * унікальний взагалі». За останні 20 постів шість можливостей вийшли двічі —
 * майже всі в «⏰ Дедлайн наближається» у сусідні дні.
 *
 * Тепер — ротація. Кожен день бере наступний запис зі списку нижче, і жодна
 * тема не повторюється, доки не пройде весь цикл: 46 днів, з 16.09 по 31.10
 * 2026, далі по колу. Поруч не стоять схожі теми чи та сама аудиторія.
 * Можливості, що вже виходили в каналі, не повторюються 30 днів —
 * див. REPEAT_DAYS у check-deadlines.mjs.
 *
 * Теми взято з того, що вже є на сайті, і посилання веде туди, де людина
 * побачить ті самі записи: тематичні підбірки (lib/topics.js), категорії
 * (фільтри нижче дзеркалять lib/categories.js — той файл імпортує через
 * аліас @/, недоступний у node), особливі потреби, вік, міста.
 *
 * Звірено з базою 15.09.2026: у кожній темі-дайджесті щонайменше 11 відкритих
 * записів, у темі-історії — щонайменше 3. Свідомо не взято: «путівки» (0
 * записів), «спорт» (пошук за словом ловить «паспорт»), «академії від
 * компаній» (ловить Малу академію наук — заголовок збрехав би).
 *
 * Формати:
 *   digest    — заголовок теми + до трьох можливостей + посилання;
 *   story     — одна можливість розгорнуто;
 *   deadlines — дедлайни найближчих двох тижнів;
 *   situation — життєва ситуація (SITUATIONS у check-deadlines.mjs);
 *   number    — цифра дня (картки в buildNumberPost);
 *   file      — готовий текст із content/telegram/ з живими числами.
 */
import { TOPICS } from '../lib/topics.js';

export const PLAN_START = '2026-09-16';

const SITE = 'https://dityam.com.ua';

const home = (params) => `${SITE}/?${new URLSearchParams(params)}`;

const topic = (slug) => {
  const found = Object.values(TOPICS).find((x) => x.slug === slug);
  if (!found) throw new Error(`Немає підбірки ${slug} у lib/topics.js`);
  return { match: found.match, link: `${SITE}/${slug}` };
};

// Ті самі предикати, що в lib/categories.js: підрядок у назві, описі й джерелі.
const q = (o, needle) =>
  `${o.title || ''} ${o.summary || ''} ${o.source || ''}`.toLowerCase().includes(needle);
const t = (o, ...types) => types.includes(o.opportunity_type);
const need = (n) => (o) => (o.child_needs || []).includes(n);
const age = (from, to) => (o) =>
  o.age_from != null && o.age_to != null && o.age_from <= to && o.age_to >= from;
const city = (name) => (o) => (o.cities || []).includes(name);

export const FALLBACK_TOPIC = {
  key: 'free',
  kind: 'digest',
  heading: '🎁 Безкоштовні можливості',
  description: 'Програми, за які не треба платити.',
  match: (o) => o.cost_type === 'free',
  link: home({ cost: 'free' }),
};

// Тексти життєвих ситуацій. Лежать тут, а не в check-deadlines.mjs, бо їх
// читають двоє: сам бот (додає до них фільтр і добирає записи) і адмінка —
// у картці «Telegram-канал» має стояти, про що буде пост, а не службове
// слово «життєва ситуація». Порядок = поле situation у ROTATION.
export const SITUATION_TEXTS = [
  '«Дитині 15, хоче спробувати щось своє, а грошей на гуртки зараз немає»',
  '«Переїхали в іншу область, дитина ні з ким не знайома і сидить у телефоні»',
  '«Дитина здібна до математики, а в нашій школі це нікому не потрібно»',
  '«Хочемо, щоб дитина побачила світ, але бюджету на поїздки немає»',
  '«Щойно народилась дитина — і незрозуміло, що взагалі належить родині»',
  '«Дитина цілий день малює, а куди з цим піти — не знаємо»',
];

export const ROTATION = [
  { key: 'deadlines', kind: 'deadlines',
    heading: '⏰ Дедлайни найближчих двох тижнів',
    description: 'Подати заявку ще можна, але зволікати не варто.',
    link: `${SITE}/dedlainy` },
  { key: 'situation-15', kind: 'situation', situation: 0 },
  { key: 'kids-0-6', kind: 'digest',
    heading: '🧸 Для малюків до 6 років',
    description: 'Розвивальні заняття, гуртки й підтримка для найменших.',
    // Верхня межа 8, а не 18: інакше сюди йдуть програми «0–18», і малюків у
    // пості не видно (так само було в тижневому шаблоні до 16.09.2026).
    match: (o) => o.age_from != null && o.age_to != null && o.age_from <= 6 && o.age_to <= 8,
    link: home({ age: '0-3,4-6' }) },
  { key: 'file-obminy', kind: 'file', file: 'obminy.html' },
  { key: 'it', kind: 'digest',
    heading: '💻 Програмування та IT',
    description: 'Курси, гуртки й конкурси для тих, кого цікавить код.',
    match: (o) => q(o, 'програмуванн'),
    link: home({ q: 'програмуванн' }) },
  { key: 'need-idp', kind: 'digest',
    heading: '🏠 Для дітей переселених родин',
    description: 'Можливості, позначені на платформі для дітей ВПО.',
    match: need('idp'),
    link: home({ need: 'idp' }) },
  { key: 'number-free', kind: 'number', card: 0 },
  { key: 'konkursy', kind: 'digest',
    heading: '🏆 Конкурси',
    description: 'Творчі, наукові й міжнародні конкурси для дітей і підлітків.',
    ...topic('konkursy') },
  { key: 'scholarships', kind: 'digest',
    heading: '🎓 Стипендії',
    description: 'Гроші на навчання й розвиток, які не треба повертати.',
    match: (o) => t(o, 'scholarship'),
    link: home({ type: 'scholarship' }) },
  { key: 'situation-moved', kind: 'situation', situation: 1 },
  { key: 'music', kind: 'digest',
    heading: '🎵 Музика',
    description: 'Студії, гуртки, конкурси й фестивалі для тих, хто співає або грає.',
    match: (o) => q(o, 'музи'),
    link: home({ q: 'музи' }) },
  { key: 'file-dity-zakhysnykiv', kind: 'file', file: 'dity-zakhysnykiv.html' },
  // Історія — лише за типом запису: підрядок тут бреше. «Дебати» за словом в
  // описі 15.09.2026 підняли курс англійської, де дебати згадані мимохідь.
  { key: 'internships', kind: 'story',
    heading: '💼 <b>Стажування</b>',
    match: (o) => t(o, 'internship'),
    link: home({ type: 'internship' }) },
  { key: 'tabory', kind: 'digest',
    heading: '⛺ Безкоштовні табори',
    description: 'Табори й оздоровлення, за які родині не треба платити.',
    ...topic('bezkoshtovni-tabory') },
  { key: 'need-gifted', kind: 'digest',
    heading: '⭐ Для обдарованих дітей',
    description: 'Програми, позначені на платформі для здібних і обдарованих.',
    match: need('gifted'),
    link: home({ need: 'gifted' }) },
  { key: 'hackathons', kind: 'story',
    heading: '💡 <b>Хакатон</b>',
    match: (o) => t(o, 'hackathon'),
    link: home({ type: 'hackathon' }) },
  { key: 'file-olimpiady', kind: 'file', file: 'olimpiady.html' },
  { key: 'age-7-11', kind: 'digest',
    heading: '📚 Для дітей 7–11 років',
    description: 'Гуртки, курси й конкурси для молодших школярів.',
    match: age(7, 11),
    link: home({ age: '7-11' }) },
  { key: 'number-sources', kind: 'number', card: 1 },
  { key: 'grants', kind: 'digest',
    heading: '💰 Гранти',
    description: 'Гроші на проєкти й ідеї дітей і молоді.',
    match: (o) => t(o, 'grant'),
    link: home({ type: 'grant' }) },
  { key: 'situation-math', kind: 'situation', situation: 2 },
  { key: 'theatre', kind: 'digest',
    heading: '🎭 Театр і сцена',
    description: 'Театральні студії, конкурси й фестивалі.',
    match: (o) => q(o, 'театр'),
    link: home({ q: 'театр' }) },
  { key: 'need-disability', kind: 'digest',
    heading: '🤝 Для дітей з інвалідністю',
    description: 'Можливості, позначені на платформі для дітей з інвалідністю.',
    match: need('disability'),
    link: home({ need: 'disability' }) },
  { key: 'file-onlain', kind: 'file', file: 'onlain.html' },
  { key: 'leadership', kind: 'digest',
    heading: '🧭 Лідерські програми',
    description: 'Лідерські школи й програми для дітей і молоді.',
    match: (o) => q(o, 'лідер'),
    link: home({ q: 'лідер' }) },
  { key: 'file-dedlainy', kind: 'file', file: 'dedlainy-dva-tyzhni.html' },
  // Той самий фільтр, що в пігулки «Виплати» на головній (OpportunitiesList,
  // type=payments). Параметр ?aid=cash головна не читає — посилання вело б на
  // нефільтрований список.
  { key: 'cash', kind: 'digest',
    heading: '💳 Виплати на дітей',
    description: 'Грошова допомога родинам: державні й місцеві програми.',
    match: (o) => t(o, 'allowance', 'support_payment') || o.aid_type === 'cash',
    link: home({ type: 'payments' }) },
  { key: 'situation-world', kind: 'situation', situation: 3 },
  { key: 'science-contests', kind: 'digest',
    heading: '🔬 Наукові конкурси',
    description: 'Для тих, хто любить досліджувати й винаходити.',
    match: (o) => t(o, 'competition') && q(o, 'наук'),
    link: home({ type: 'competition', q: 'наук' }) },
  { key: 'city-kyiv', kind: 'digest',
    heading: '📍 Київ',
    description: 'Гуртки, курси й події для дітей у Києві.',
    match: city('Київ'),
    link: `${SITE}/kyiv` },
  { key: 'number-needs', kind: 'number', card: 2 },
  { key: 'age-12-14', kind: 'digest',
    heading: '🎒 Для 12–14 років',
    description: 'Гуртки, конкурси й програми для учнів середньої школи.',
    match: age(12, 14),
    link: home({ age: '12-14' }) },
  { key: 'file-za-kordonom', kind: 'file', file: 'za-kordonom.html' },
  { key: 'psychology', kind: 'digest',
    heading: '🫶 Психологічна підтримка',
    description: 'Консультації й групи підтримки для дітей і підлітків.',
    match: (o) => t(o, 'psychology') || q(o, 'психолог'),
    link: home({ q: 'психолог' }) },
  { key: 'situation-newborn', kind: 'situation', situation: 4 },
  { key: 'intl-contests', kind: 'digest',
    heading: '🌍 Міжнародні конкурси',
    description: 'Міжнародні конкурси для дітей і підлітків.',
    match: (o) => t(o, 'competition') && q(o, 'міжнародн'),
    link: home({ type: 'competition', q: 'міжнародн' }) },
  { key: 'volunteer', kind: 'story',
    heading: '🤲 <b>Волонтерство</b>',
    match: (o) => t(o, 'volunteer'),
    link: home({ type: 'volunteer' }) },
  { key: 'need-orphan', kind: 'digest',
    heading: '🧡 Для дітей-сиріт і дітей під опікою',
    description: 'Можливості, позначені на платформі для дітей без батьківського піклування.',
    match: need('orphan'),
    link: home({ need: 'orphan' }) },
  { key: 'entrepreneurship', kind: 'digest',
    heading: '🚀 Підприємництво',
    description: 'Програми й школи підприємництва для підлітків.',
    match: (o) => q(o, 'підприємниц'),
    link: home({ q: 'підприємниц' }) },
  { key: 'situation-drawing', kind: 'situation', situation: 5 },
  { key: 'age-15-17', kind: 'digest',
    heading: '📘 Для 15–17 років',
    description: 'Конкурси, програми й можливості для старшокласників.',
    match: age(15, 17),
    link: home({ age: '15-17' }) },
  { key: 'eco', kind: 'digest',
    heading: '🌱 Екологія',
    description: 'Екологічні конкурси, проєкти й ініціативи.',
    match: (o) => q(o, 'еколог'),
    link: home({ q: 'еколог' }) },
  { key: 'festivals', kind: 'digest',
    heading: '🎪 Фестивалі',
    description: 'Фестивалі для дітей і підлітків.',
    match: (o) => t(o, 'festival'),
    link: home({ type: 'festival' }) },
  { key: 'city-kharkiv', kind: 'digest',
    heading: '📍 Харків',
    description: 'Гуртки, курси й події для дітей у Харкові.',
    match: city('Харків'),
    link: `${SITE}/kharkiv` },
  { key: 'hurtky', kind: 'digest',
    heading: '✏️ Безкоштовні гуртки й курси',
    description: 'Онлайн і в містах України.',
    ...topic('bezkoshtovni-hurtky') },
  { key: 'finance', kind: 'digest',
    heading: '💵 Фінансова грамотність',
    description: 'Курси й конкурси про гроші для дітей і підлітків.',
    match: (o) => q(o, 'фінансов'),
    link: home({ q: 'фінансов' }) },
];

const DAY_MS = 86400000;

export const addDays = (iso, n) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);

/** Сьогоднішня дата за Києвом: запуск на GitHub іде в UTC. */
export const kyivIso = (date = new Date()) =>
  date.toLocaleDateString('en-CA', { timeZone: 'Europe/Kyiv' });

/** Запис плану на дату. До PLAN_START і після кінця циклу — по колу. */
export function planEntryFor(dateIso) {
  const n = ROTATION.length;
  const days = Math.round((Date.parse(`${dateIso}T00:00:00Z`) - Date.parse(`${PLAN_START}T00:00:00Z`)) / DAY_MS);
  const index = ((days % n) + n) % n;
  return { ...ROTATION[index], index };
}
