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
    title: '🎓 Освіта',
    items: [
      { label: 'Безкоштовні онлайн-курси', href: url({ type: 'course', cost: 'free' }), match: (o) => t(o, 'course') && o.cost_type === 'free' },
      { label: 'Мовні курси', href: url({ type: 'course', q: 'мовн' }), match: (o) => t(o, 'course') && q(o, 'мовн') },
      { label: 'Програмування та IT', href: url({ q: 'програмуванн' }), match: (o) => q(o, 'програмуванн') },
      { label: 'Дизайн і творчі курси', href: url({ type: 'course,workshop', q: 'дизайн' }), match: (o) => t(o, 'course', 'workshop') && q(o, 'дизайн') },
      { label: 'Фінансова грамотність', href: url({ q: 'фінансов' }), match: (o) => q(o, 'фінансов') },
      { label: 'Підприємництво', href: url({ q: 'підприємниц' }), match: (o) => q(o, 'підприємниц') },
      { label: 'Лідерські програми', href: url({ q: 'лідер' }), match: (o) => q(o, 'лідер') },
      { label: 'Літні освітні школи', href: url({ type: 'summer_school' }), match: (o) => t(o, 'summer_school') },
      { label: 'Олімпіади та предметні конкурси', href: '/mizhnarodni-olimpiady' },
      { label: 'Безкоштовні гуртки', href: '/bezkoshtovni-hurtky' },
    ],
  },
  {
    title: '🏕️ Табори та обміни',
    items: [
      { label: 'Табори та путівки', href: '/bezkoshtovni-tabory' },
      { label: 'Спортивні табори', href: url({ type: 'camp', q: 'спорт' }), match: (o) => t(o, 'camp') && q(o, 'спорт') },
      { label: 'Мовні табори', href: url({ type: 'camp', q: 'мовн' }), match: (o) => t(o, 'camp') && q(o, 'мовн') },
      { label: 'Творчі табори', href: url({ type: 'camp', q: 'творч' }), match: (o) => t(o, 'camp') && q(o, 'творч') },
      { label: 'Табори за кордоном', href: url({ type: 'camp', q: 'кордон' }), match: (o) => t(o, 'camp') && q(o, 'кордон') },
      { label: 'Програми обміну', href: '/prohramy-obminu' },
      { label: 'Культурні обміни', href: url({ type: 'exchange', q: 'культур' }), match: (o) => t(o, 'exchange') && q(o, 'культур') },
      { label: 'Волонтерські табори', href: url({ type: 'volunteer', q: 'табір' }), match: (o) => t(o, 'volunteer') && q(o, 'табір') },
    ],
  },
  {
    title: '💰 Фінансова підтримка',
    items: [
      { label: 'Стипендії', href: url({ type: 'scholarship' }), match: (o) => t(o, 'scholarship') },
      { label: 'Освітні гранти', href: url({ type: 'grant' }), match: (o) => t(o, 'grant') },
      { label: 'Гранти на творчі проєкти', href: url({ type: 'grant', q: 'творч' }), match: (o) => t(o, 'grant') && q(o, 'творч') },
      { label: 'Путівки та оздоровлення', href: url({ q: 'путівк' }), match: (o) => q(o, 'путівк') },
      { label: 'Підтримка малозабезпечених родин', href: url({ need: 'low_income' }), match: (o) => (o.child_needs || []).includes('low_income') },
      { label: 'Державні виплати', href: url({ type: 'gov_aid' }), match: (o) => Boolean(o.aid_type) },
    ],
  },
  {
    title: '🌍 Міжнародні можливості',
    items: [
      { label: 'Навчання за кордоном', href: url({ q: 'за кордоном' }), match: (o) => q(o, 'за кордоном') },
      { label: 'Міжнародні табори', href: url({ type: 'camp', q: 'міжнародн' }), match: (o) => t(o, 'camp') && q(o, 'міжнародн') },
      { label: 'Міжнародні конкурси', href: url({ type: 'competition', q: 'міжнародн' }), match: (o) => t(o, 'competition') && q(o, 'міжнародн') },
      { label: 'Міжнародні олімпіади', href: '/mizhnarodni-olimpiady' },
      { label: 'Молодіжні конференції', href: url({ type: 'conference' }), match: (o) => t(o, 'conference') },
      { label: 'Програми Erasmus+', href: url({ q: 'erasmus' }), match: (o) => q(o, 'erasmus') },
      { label: 'Міжнародне волонтерство', href: url({ type: 'volunteer', q: 'міжнародн' }), match: (o) => t(o, 'volunteer') && q(o, 'міжнародн') },
    ],
  },
  {
    title: '🏆 Конкурси та досягнення',
    items: [
      { label: 'Конкурси', href: '/konkursy' },
      { label: 'Наукові конкурси', href: url({ type: 'competition', q: 'наук' }), match: (o) => t(o, 'competition') && q(o, 'наук') },
      { label: 'Хакатони', href: url({ type: 'hackathon' }), match: (o) => t(o, 'hackathon') },
      { label: 'Дебатні турніри', href: url({ q: 'дебат' }), match: (o) => q(o, 'дебат') },
      { label: 'Конкурси есе', href: url({ q: 'есе' }), match: (o) => q(o, ' есе') || q(o, 'есе ') },
      { label: 'Мистецькі конкурси', href: url({ type: 'competition', q: 'мистец' }), match: (o) => t(o, 'competition') && q(o, 'мистец') },
      { label: 'Музичні конкурси', href: url({ type: 'competition', q: 'музи' }), match: (o) => t(o, 'competition') && q(o, 'музи') },
      { label: 'Спортивні змагання', href: url({ type: 'sport_tournament' }), match: (o) => t(o, 'sport_tournament') },
      { label: 'Конкурси стартапів', href: url({ q: 'стартап' }), match: (o) => q(o, 'стартап') },
    ],
  },
  {
    title: '🤝 Волонтерство та соціальні проєкти',
    items: [
      { label: 'Волонтерські програми', href: url({ type: 'volunteer' }), match: (o) => t(o, 'volunteer') },
      { label: 'Соціальні проєкти', href: url({ q: 'соціальн' }), match: (o) => q(o, 'соціальн') },
      { label: 'Екологічні ініціативи', href: url({ q: 'еколог' }), match: (o) => q(o, 'еколог') },
      { label: 'Менторські програми', href: url({ type: 'mentorship' }), match: (o) => t(o, 'mentorship') },
    ],
  },
  {
    title: '💻 Кар’єра та майбутнє',
    items: [
      { label: 'Профорієнтація', href: url({ q: 'профорієнтац' }), match: (o) => q(o, 'профорієнтац') },
      { label: 'Стажування для підлітків', href: url({ type: 'internship' }), match: (o) => t(o, 'internship') },
      { label: 'Академії від компаній', href: url({ q: 'академі' }), match: (o) => q(o, 'академі') },
      { label: 'IT для школярів', href: url({ q: 'програмуванн' }), match: (o) => q(o, 'програмуванн') },
    ],
  },
  {
    title: '🎭 Для талантів',
    items: [
      { label: 'Музичні можливості', href: url({ q: 'музи' }), match: (o) => q(o, 'музи') },
      { label: 'Спортивні стипендії', href: url({ type: 'scholarship', q: 'спорт' }), match: (o) => t(o, 'scholarship') && q(o, 'спорт') },
      { label: 'Арт-резиденції', href: url({ type: 'residency' }), match: (o) => t(o, 'residency') },
      { label: 'Театр і сцена', href: url({ q: 'театр' }), match: (o) => q(o, 'театр') },
      { label: 'Фестивалі', href: url({ type: 'festival' }), match: (o) => t(o, 'festival') },
    ],
  },
];
