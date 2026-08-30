/**
 * Таксономія категорій для сторінки /kategorii.
 *
 * Джерело: Notion-таска «передивитися і організувати пошук по таким
 * категоріям» (16.08.2026) — список того, що може бути на сайті.
 *
 * Кожна підкатегорія — НЕ окрема сторінка, а посилання у відфільтрований
 * каталог (?type=&cost=&need=&q=). match() навмисно дзеркалить предикати
 * OpportunitiesList (точний type/cost/need, substring q по title+summary+
 * source) — щоб лічильник на хабі збігався з тим, що людина побачить після
 * кліку. Порожні підкатегорії на сторінці ховаються: каталог росте, і вони
 * з'являться самі, коли будуть записи.
 *
 * Кілька підкатегорій ведуть на наявні тематичні сторінки (topic pages) —
 * там більше контенту й FAQ, і саме вони ранжуються в органіці.
 */

import { TOPIC_LIST } from '@/lib/topics';

const q = (o, needle) =>
  `${o.title || ''} ${o.summary || ''} ${o.source || ''}`
    .toLowerCase()
    .includes(needle.toLowerCase());

const t = (o, ...types) => types.includes(o.opportunity_type);

// href-хелпери: ті самі параметри читає OpportunitiesList при mount.
const url = (params) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) p.set(k, v);
  return `/?${p.toString()}`;
};

export const CATEGORY_GROUPS = [
  {
    title: '🎓 Освіта', titleEn: '🎓 Education',
    items: [
      { label: 'Безкоштовні онлайн-курси', labelEn: 'Free online courses', href: url({ type: 'course', cost: 'free' }), match: (o) => t(o, 'course') && o.cost_type === 'free' },
      { label: 'Мовні курси', labelEn: 'Language courses', href: url({ type: 'course', q: 'мовн' }), match: (o) => t(o, 'course') && q(o, 'мовн') },
      { label: 'Програмування та IT', labelEn: 'Coding and IT', href: url({ q: 'програмуванн' }), match: (o) => q(o, 'програмуванн') },
      { label: 'Дизайн і творчі курси', labelEn: 'Design and creative courses', href: url({ type: 'course,workshop', q: 'дизайн' }), match: (o) => t(o, 'course', 'workshop') && q(o, 'дизайн') },
      { label: 'Фінансова грамотність', labelEn: 'Financial literacy', href: url({ q: 'фінансов' }), match: (o) => q(o, 'фінансов') },
      { label: 'Підприємництво', labelEn: 'Entrepreneurship', href: url({ q: 'підприємниц' }), match: (o) => q(o, 'підприємниц') },
      { label: 'Лідерські програми', labelEn: 'Leadership programmes', href: url({ q: 'лідер' }), match: (o) => q(o, 'лідер') },
      { label: 'Літні освітні школи', labelEn: 'Summer schools', href: url({ type: 'summer_school' }), match: (o) => t(o, 'summer_school') },
      { label: 'Олімпіади та предметні конкурси', labelEn: 'Olympiads and subject contests', href: '/mizhnarodni-olimpiady' },
      { label: 'Безкоштовні гуртки', labelEn: 'Free clubs', href: '/bezkoshtovni-hurtky' },
    ],
  },
  {
    title: '🏕️ Табори та обміни', titleEn: '🏕️ Camps and exchanges',
    items: [
      { label: 'Табори та путівки', labelEn: 'Camps and funded places', href: '/bezkoshtovni-tabory' },
      { label: 'Спортивні табори', labelEn: 'Sports camps', href: url({ type: 'camp', q: 'спорт' }), match: (o) => t(o, 'camp') && q(o, 'спорт') },
      { label: 'Мовні табори', labelEn: 'Language camps', href: url({ type: 'camp', q: 'мовн' }), match: (o) => t(o, 'camp') && q(o, 'мовн') },
      { label: 'Творчі табори', labelEn: 'Creative camps', href: url({ type: 'camp', q: 'творч' }), match: (o) => t(o, 'camp') && q(o, 'творч') },
      { label: 'Табори за кордоном', labelEn: 'Camps abroad', href: url({ type: 'camp', q: 'кордон' }), match: (o) => t(o, 'camp') && q(o, 'кордон') },
      { label: 'Програми обміну', labelEn: 'Exchange programmes', href: '/prohramy-obminu' },
      { label: 'Культурні обміни', labelEn: 'Cultural exchanges', href: url({ type: 'exchange', q: 'культур' }), match: (o) => t(o, 'exchange') && q(o, 'культур') },
      { label: 'Волонтерські табори', labelEn: 'Volunteer camps', href: url({ type: 'volunteer', q: 'табір' }), match: (o) => t(o, 'volunteer') && q(o, 'табір') },
    ],
  },
  {
    title: '💰 Фінансова підтримка', titleEn: '💰 Financial support',
    items: [
      { label: 'Стипендії', labelEn: 'Scholarships', href: url({ type: 'scholarship' }), match: (o) => t(o, 'scholarship') },
      { label: 'Освітні гранти', labelEn: 'Education grants', href: url({ type: 'grant' }), match: (o) => t(o, 'grant') },
      { label: 'Гранти на творчі проєкти', labelEn: 'Grants for creative projects', href: url({ type: 'grant', q: 'творч' }), match: (o) => t(o, 'grant') && q(o, 'творч') },
      { label: 'Путівки та оздоровлення', labelEn: 'Funded places and recovery stays', href: url({ q: 'путівк' }), match: (o) => q(o, 'путівк') },
      { label: 'Підтримка малозабезпечених родин', labelEn: 'Support for low-income families', href: url({ need: 'low_income' }), match: (o) => (o.child_needs || []).includes('low_income') },
      // aid_type — не тип можливості, а вид держдопомоги (labels.js: cash =
      // «держвиплата»). Посилання фільтрувало по opportunity_type = 'gov_aid',
      // якого в базі немає жодного запису, а лічильник рахував будь-який
      // aid_type: чип обіцяв 31 запис і відкривав порожню видачу. Тепер обидва
      // дивляться на одне й те саме поле, як і решта підкатегорій.
      { label: 'Державні виплати', labelEn: 'State payments', href: url({ aid: 'cash' }), match: (o) => o.aid_type === 'cash' },
    ],
  },
  {
    title: '🌍 Міжнародні можливості', titleEn: '🌍 International opportunities',
    items: [
      { label: 'Навчання за кордоном', labelEn: 'Studying abroad', href: url({ q: 'за кордоном' }), match: (o) => q(o, 'за кордоном') },
      { label: 'Міжнародні табори', labelEn: 'International camps', href: url({ type: 'camp', q: 'міжнародн' }), match: (o) => t(o, 'camp') && q(o, 'міжнародн') },
      { label: 'Міжнародні конкурси', labelEn: 'International contests', href: url({ type: 'competition', q: 'міжнародн' }), match: (o) => t(o, 'competition') && q(o, 'міжнародн') },
      { label: 'Міжнародні олімпіади', labelEn: 'International olympiads', href: '/mizhnarodni-olimpiady' },
      { label: 'Молодіжні конференції', labelEn: 'Youth conferences', href: url({ type: 'conference' }), match: (o) => t(o, 'conference') },
      { label: 'Програми Erasmus+', labelEn: 'Erasmus+ programmes', href: url({ q: 'erasmus' }), match: (o) => q(o, 'erasmus') },
      { label: 'Міжнародне волонтерство', labelEn: 'International volunteering', href: url({ type: 'volunteer', q: 'міжнародн' }), match: (o) => t(o, 'volunteer') && q(o, 'міжнародн') },
    ],
  },
  {
    title: '🏆 Конкурси та досягнення', titleEn: '🏆 Contests and achievements',
    items: [
      { label: 'Конкурси', labelEn: 'Contests', href: '/konkursy' },
      { label: 'Наукові конкурси', labelEn: 'Science contests', href: url({ type: 'competition', q: 'наук' }), match: (o) => t(o, 'competition') && q(o, 'наук') },
      { label: 'Хакатони', labelEn: 'Hackathons', href: url({ type: 'hackathon' }), match: (o) => t(o, 'hackathon') },
      { label: 'Дебатні турніри', labelEn: 'Debate tournaments', href: url({ q: 'дебат' }), match: (o) => q(o, 'дебат') },
      { label: 'Конкурси есе', labelEn: 'Essay contests', href: url({ q: 'есе' }), match: (o) => q(o, ' есе') || q(o, 'есе ') },
      { label: 'Мистецькі конкурси', labelEn: 'Art contests', href: url({ type: 'competition', q: 'мистец' }), match: (o) => t(o, 'competition') && q(o, 'мистец') },
      { label: 'Музичні конкурси', labelEn: 'Music contests', href: url({ type: 'competition', q: 'музи' }), match: (o) => t(o, 'competition') && q(o, 'музи') },
      { label: 'Спортивні змагання', labelEn: 'Sports competitions', href: url({ type: 'sport_tournament' }), match: (o) => t(o, 'sport_tournament') },
      { label: 'Конкурси стартапів', labelEn: 'Startup contests', href: url({ q: 'стартап' }), match: (o) => q(o, 'стартап') },
    ],
  },
  {
    title: '🤝 Волонтерство та соціальні проєкти', titleEn: '🤝 Volunteering and social projects',
    items: [
      { label: 'Волонтерські програми', labelEn: 'Volunteer programmes', href: url({ type: 'volunteer' }), match: (o) => t(o, 'volunteer') },
      { label: 'Соціальні проєкти', labelEn: 'Social projects', href: url({ q: 'соціальн' }), match: (o) => q(o, 'соціальн') },
      { label: 'Екологічні ініціативи', labelEn: 'Environmental initiatives', href: url({ q: 'еколог' }), match: (o) => q(o, 'еколог') },
      { label: 'Менторські програми', labelEn: 'Mentoring programmes', href: url({ type: 'mentorship' }), match: (o) => t(o, 'mentorship') },
    ],
  },
  {
    title: '💻 Кар’єра та майбутнє', titleEn: '💻 Careers and the future',
    items: [
      { label: 'Профорієнтація', labelEn: 'Career guidance', href: url({ q: 'профорієнтац' }), match: (o) => q(o, 'профорієнтац') },
      { label: 'Стажування для підлітків', labelEn: 'Internships for teenagers', href: url({ type: 'internship' }), match: (o) => t(o, 'internship') },
      { label: 'Академії від компаній', labelEn: 'Company academies', href: url({ q: 'академі' }), match: (o) => q(o, 'академі') },
      { label: 'IT для школярів', labelEn: 'IT for school students', href: url({ q: 'програмуванн' }), match: (o) => q(o, 'програмуванн') },
    ],
  },
  {
    title: '🎭 Для талантів', titleEn: '🎭 For creative talents',
    items: [
      { label: 'Музичні можливості', labelEn: 'Music opportunities', href: url({ q: 'музи' }), match: (o) => q(o, 'музи') },
      { label: 'Спортивні стипендії', labelEn: 'Sports scholarships', href: url({ type: 'scholarship', q: 'спорт' }), match: (o) => t(o, 'scholarship') && q(o, 'спорт') },
      { label: 'Арт-резиденції', labelEn: 'Art residencies', href: url({ type: 'residency' }), match: (o) => t(o, 'residency') },
      { label: 'Театр і сцена', labelEn: 'Theatre and stage', href: url({ q: 'театр' }), match: (o) => q(o, 'театр') },
      { label: 'Фестивалі', labelEn: 'Festivals', href: url({ type: 'festival' }), match: (o) => t(o, 'festival') },
    ],
  },
];

/**
 * Посилання категорії потрібною мовою.
 *
 * Категорія веде або у відфільтрований каталог (`/?type=…`), або на тематичну
 * сторінку. Обидва випадки мовно різні: каталог має англійський двійник /en,
 * а в тем свої англійські слаги. Складання шляху рядком на місці вже одного
 * разу привело до англійських підписів, що вели на українські сторінки, — тож
 * усі переходи йдуть сюди.
 */
const EN_TOPIC = Object.fromEntries(
  TOPIC_LIST.map((t) => [`/${t.slug}`, `/en/${t.en.slug}`]),
);

export const categoryHref = (href, lang = 'uk') => {
  if (lang !== 'en') return href;
  if (EN_TOPIC[href]) return EN_TOPIC[href];
  return href.startsWith('/?') ? `/en${href.slice(1)}` : href;
};
