// Онлайн-олімпіада Dityam.com.ua — налаштування й чиста логіка: порядок
// питань, підрахунок балів, рівень диплома, місяць конкурсу.
//
// Задум (Марія, 05.10.2026): дитина проходить тест онлайн і одразу отримує
// диплом і місяць Dityam+; щомісяця — призи за найкращі відповіді на відкрите
// завдання. Пілот — одна група, логіка.
//
// З 08.10.2026 участь БЕЗКОШТОВНА (Марія: «робимо її безкоштовною, але диплом
// можна надрукувати за 199 грн з включеною доставкою до відділення і
// поштомата»). Платне лише одне — друкований диплом після тесту
// (OLIMP.printPrice). До того: внесок 150 грн, з дипломом 249, доставка 120.
//
// Кількість завдань і час — тут, в одному місці. Було 30 і 40 хвилин; після
// власної спроби Марія скоротила: «питань багато, давай 25 і 35 хвилин».

// Перемикач продажу, як PLUS_SALES_OPEN у lib/plus.js. Поки false — сторінка
// є, але оплата закрита для всіх, крім адміна (вхід в адмінку): Марія
// проходить тест сама й вичитує завдання, перш ніж за нього хтось заплатить.
// Запуск = true: відкривається форма, сторінка потрапляє в sitemap, llms.txt
// і в індекс. Після запуску призи місяця вже не міняти (ЦК, ст. 1151).
export const OLIMP_OPEN = false;

// Сторінка відкрита для всіх і для пошуку ще до продажу (Марія, 06.10.2026:
// «відкрий сторінку і починай збирати імейли кому цікаво»): замість форми
// оплати — список очікування (olimpiada_waitlist), на старті кожному 1 лист.
export const OLIMP_PUBLIC = true;

export const OLIMP = {
  slug: 'lohika-9-11',
  title: 'Онлайн-олімпіада з логіки',
  groupLabel: '9–11 років',
  ageMin: 9,
  ageMax: 11,
  questionCount: 25,
  minutes: 35,
  // Участь безкоштовна (08.10.2026). Нуль, а не видалене поле: старі записи
  // з внеском лишаються в базі, і статистика відрізняє їх за amount.
  price: 0,
  // Скільки днів Dityam+ дістається кожному учасникові.
  giftDays: 30,
  // Хвилини — лише на завдання з варіантами. Відкрите завдання — без таймера
  // (Марія, 07.10.2026: «без таймера»); до того на нього лишались ті самі
  // хвилини плюс 2 хвилини табло «Відправити відповідь».
  // Запас на мережу після основного часу: відповіді з варіантами, що прийшли
  // пізніше, не зараховуємо.
  graceSeconds: 90,
  // Скільки годин після ОПЛАТИ було на те, щоб почати тест (05.10.2026).
  // Діє лише для старих платних заявок: безкоштовне посилання не згорає.
  accessHours: 72,
  // Друкований диплом з доставкою у відділення або поштомат Нової пошти —
  // за бажанням, після тесту (Марія, 08.10.2026: 199 грн, доставка включена;
  // до того 120 грн понад внесок).
  printPrice: 199,
  // Скільки заявок на одну пошту за добу: у родині кілька дітей, але
  // безкоштовна форма не має ставати способом засипати чужу скриньку листами.
  maxEntriesPerEmailDay: 5,
};

/**
 * Заявку оплачено разом із друкованим дипломом — так було до 08.10.2026
 * (внесок 249 грн). Нових таких немає; лишилось для старих записів.
 */
export const isBundle = (entry) => Number(entry?.amount) >= 249;

/** Участь була платною (до 08.10.2026). */
export const isPaidEntry = (entry) => Number(entry?.amount) > 0;

// Рівень диплома залежить лише від балів дитини, а не від чужих результатів,
// тому диплом готовий одразу. Пороги відомі заздалегідь і стоять у правилах.
export const LEVELS = [
  { key: 'gold', label: 'Золотий рівень', min: 22 },
  { key: 'silver', label: 'Срібний рівень', min: 17 },
  { key: 'bronze', label: 'Бронзовий рівень', min: 12 },
  { key: 'participant', label: 'Диплом учасника', min: 0 },
];

export function levelFor(score) {
  const n = Number(score) || 0;
  return LEVELS.find((l) => n >= l.min) || LEVELS[LEVELS.length - 1];
}

export const levelByKey = (key) => LEVELS.find((l) => l.key === key) || LEVELS[LEVELS.length - 1];

// Призи місяця за найкращі відповіді на відкрите завдання. Марія, 05–06.10.2026:
// «планшет не беремо», «конкретні картинки й точні назви», «без артикула»,
// «встав прямо картинками товари», «заміни щось на ручці, бо наче не весело».
// Товари справді продаються в Україні дешевше за неоподатковувану межу
// (2 161,75 грн у 2026 році): ціни 05.10.2026 — LEGO 31152 від 1 346 до
// 1 999 грн, «Каркасон» 1 200–1 250 грн, 4M «Вирощування кристалів» (від 10
// років) 684–867 грн. Micro:bit Марія зняла («заміни це на щось інше»), Znatok —
// теж («це іграшка від 5 до 9 років»). Фото — з магазинів (Епіцентр,
// desktopgames.com.ua, profi-toys.com.ua).
// Приз — істотна умова конкурсу (ЦК, ст. 1151): після початку місяця його
// не міняти, тому перед запуском ціни звірити ще раз.
// Версія дизайну диплома. Зразки на сторінці кешуються в браузері на добу,
// справжні дипломи — на годину: після зміни малюнка підняти число, інакше
// люди бачать старий диплом (Марія, 06.10.2026: «я не бачу дипломи»).
export const DIPLOMA_VERSION = 8;

export const PRIZES = [
  { place: 1, image: '/olimpiada/prize-lego.jpg', title: 'Конструктор LEGO Creator 3в1 «Космонавт»', note: '647 деталей, 3 моделі з одного набору' },
  { place: 2, image: '/olimpiada/prize-monopoliya.jpg', title: 'Настільна гра «Монополія: Дива України»', note: 'українське видання Rozum, від 2 до 6 гравців' },
  { place: 3, image: '/olimpiada/prize-krystaly.jpg', title: 'Набір дослідів 4M KidzLabs «Вирощування кристалів»', note: 'справжні кристали своїми руками, від 10 років' },
];

// Картка олімпіади в «Топ 3 цього тижня» — на головній, у підбірках і в
// смужці на телефоні (Марія, 06.10.2026: «помісти цю можливість у топ 3»).
// Олімпіада — наша сторінка, а не запис у базі, тому картку складено тут:
// веде на /olimpiada, а не на /o/<slug>. Стає після оплачених організаторами
// місць (lib/weekly-top.js), тож проданий топ вона не витісняє.
// Поки продаж закритий — підпис «Скоро старт» замість дати.
export const OLIMP_TOP = (OLIMP_OPEN || OLIMP_PUBLIC) ? [{
  id: 'dityam-olimpiada',
  slug: 'dityam-olimpiada',
  href: '/olimpiada',
  title: `${OLIMP.title} Dityam.com.ua`,
  label: OLIMP_OPEN ? null : 'Скоро старт',
  deadline: null,
  opportunity_type: 'olympiad',
  age_from: OLIMP.ageMin,
  age_to: OLIMP.ageMax,
  // Участь безкоштовна з 08.10.2026; друкований диплом — опція після тесту.
  cost_type: 'free',
  // Що дитина отримає — на самій картці (Марія, 07.10.2026: «на самій картці
  // написати, що дитина отримає»). Дослівно з умов: диплом з результатом
  // одразу після тесту, місяць Dityam+ кожному, призи за 3 найкращі відповіді.
  perk: 'диплом одразу, місяць Dityam+ і призи щомісяця',
}] : [];

// Підбірки, де стоїть блок олімпіади (app/OlimpPromo.js) — ті, куди приходять
// батьки дітей 9–11, яким цікаві змагання (Марія, 07.10.2026: «помісти на
// необхідні підбірки»). /olimpiady має свій такий самий блок. «Топ 3 цього
// тижня» з карткою олімпіади — і так у кожній підбірці (OLIMP_TOP).
// Табори й гуртки додано того ж дня: за 2 доби сторінку олімпіади відкрили 6
// разів — з картки «Топ 3» майже не клацають, а /olimpiady, де найбільше
// людей, — про шкільні олімпіади МОН для старших. Батьки молодших дітей
// приходять саме по табори й гуртки («це можна»).
export const OLIMP_HUBS = [
  'konkursy', 'mizhnarodni-olimpiady', 'ukrainskym-ditiam-za-kordonom',
  'bezkoshtovni-tabory', 'bezkoshtovni-hurtky',
];

/**
 * Чи підходить вибраний у каталозі фільтр під олімпіаду — тоді показуємо
 * попап (Марія, 06.10.2026: «попап, який одразу показує цю можливість, коли
 * хтось вибирає підходящий фільтр для дитини»). Вік перетинає 9–11 (пігулка
 * «7–11»), або тип «Олімпіади» без віку, що її виключає.
 */
export function olimpFilterMatch({ age = [], type = [] } = {}) {
  const ageHit = age.some((v) => {
    const [from, to] = String(v).split('-').map(Number);
    return Number.isFinite(from) && Number.isFinite(to) && from <= OLIMP.ageMax && to >= OLIMP.ageMin;
  });
  if (ageHit) return true;
  return type.includes('olympiad') && age.length === 0;
}

// Скільки родин за останній місяць на Dityam.com.ua — для сторінки олімпіади
// (Марія, 07.10.2026: «додамо більше статистики, типу 2000+ батьків
// щомісяця»; того ж дня — картки цифр прибрати, «залишити 3к родин і
// підкріпити це чимось» біля кнопки). Джерело — GA4, activeUsers: 30 днів
// 07.09–06.10.2026 — 3 080, з них 5 — власний трафік (Варшава, компʼютер);
// вересень 2026 — 2 245. Тому «за останній місяць», а не «щомісяця».
// Переглядати раз на місяць у /admin/metrics (медіакіт): опуститься нижче
// 3 000 — знизити число, підвищувати лише за фактом.
export const AUDIENCE_MONTHLY = '3 000+';

// Одне відкрите завдання на місяць — за нього змагаються за призи.
// Відкрите завдання — останній крок самого тесту, перед дипломом, а не окремо
// після нього (Марія, 06.10.2026). Таймера на ньому немає (07.10.2026: «без
// таймера»): хвилини — на завдання з варіантами, а своє питання дитина
// придумує без поспіху. Відповіді з варіантами фіксуються до нього.
// «Придумай власну логічну задачу» для 9–11 років заважке (Марія, 06.10.2026)
// → «Придумай питання до малюнка»: даємо картинку, дитина вигадує задачу до неї.
// Малюнок — content/olimpiada/open-task-art.js.
export const OPEN_TASK = {
  title: 'Придумай питання до малюнка',
  // «Напиши питання, відповідь і як до неї дійти» прибрано 06.10.2026 («що
  // писати, підказує поле»), а 07.10.2026 Марія попросила доповнити: критерій
  // журі «правильно й пояснено» без цього рядка читався як відповідь на чуже
  // питання, а не розвʼязок власної задачі.
  text: 'Подивись на малюнок і придумай до нього задачу для однолітків — таку, над якою треба подумати. Напиши й відповідь, і як до неї дійти.',
  // Критерії публічні (сторінка, правила, FAQ), тож без підказки, яке саме
  // завдання: воно секрет до тесту (Марія, 06.10.2026: «це має бути секретом»).
  // Кожен — назва й пояснення, що саме журі шукає (Марія: «опиши краще
  // критерії»); у рядок їх збирає criteriaText().
  criteria: [
    { name: 'Своя ідея', text: 'оригінальна й несподівана, а не повтор того, що дитина вже десь бачила' },
    { name: 'Правильно й пояснено', text: 'відповідь правильна, і видно, як до неї дійти крок за кроком' },
    { name: 'Зрозуміло', text: 'інша дитина прочитає й зрозуміє без підказок дорослих' },
  ],
  maxLength: 2000,
};

/** Критерії журі одним рядком: «своя ідея — …; правильно й пояснено — …; …». */
export const criteriaText = (criteria = OPEN_TASK.criteria) =>
  criteria.map((c) => `${c.name.toLowerCase()} — ${c.text}`).join('; ');

// Детермінований генератор: той самий токен дає той самий порядок питань,
// тож оновлення сторінки не перемішує тест посеред проходження.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFrom(text) {
  let h = 2166136261;
  for (const ch of String(text)) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function shuffled(list, rand) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Порядок для конкретної дитини: усі діти отримують ті самі завдання (інакше
// рівні дипломів не можна було б порівняти), але в різному порядку й з
// переставленими варіантами — щоб відповіді не переписували «1 — Б, 2 — В».
// Завдання мають рівень складності (tier 1–3): перемішуємо всередині рівня,
// щоб тест ішов від легких до складних і не починався з найважчого.
export function buildOrder(bank, token, count = OLIMP.questionCount) {
  const rand = mulberry32(seedFrom(token));
  const set = bank.slice(0, count);
  const tiers = [...new Set(set.map((q) => q.tier || 1))].sort((a, b) => a - b);
  const picked = tiers.flatMap((t) => shuffled(set.filter((q) => (q.tier || 1) === t), rand));
  return picked.map((q) => ({ id: q.id, options: shuffled(q.options.map((_, i) => i), rand) }));
}

// Варіант відповіді у банку — рядок або { art, text }: картинка (SVG-рядок,
// який склав сервер) і, за потреби, підпис.
const optionView = (o) => (o && typeof o === 'object' ? { art: o.art || null, text: o.text || null } : { text: String(o) });

// Те, що бачить браузер: без правильних відповідей (їх у банку й немає —
// ключі живуть у базі, див. loadKeys у lib/olimpiada-server.js).
export function publicQuestions(bank, order) {
  const byId = new Map(bank.map((q) => [q.id, q]));
  return order
    .map((o) => {
      const q = byId.get(o.id);
      if (!q) return null;
      return { id: q.id, q: q.q, art: q.art || null, options: o.options.map((i) => ({ id: i, ...optionView(q.options[i]) })) };
    })
    .filter(Boolean);
}

// answers: { [idПитання]: індексВаріанта }, keys: { [idПитання]: правильнийІндекс }.
// Рахуємо лише питання, видані цій дитині (order), щоб зайві ключі в запиті
// нічого не додали; питання без ключа правильним бути не може.
export function scoreAnswers(bank, order, answers, keys) {
  const byId = new Map(bank.map((q) => [q.id, q]));
  let score = 0;
  let max = 0;
  let answered = 0;
  for (const o of order || []) {
    const q = byId.get(o.id);
    if (!q) continue;
    max += 1;
    const given = answers ? answers[q.id] : undefined;
    if (given === undefined || given === null) continue;
    answered += 1;
    const right = keys ? keys[q.id] : undefined;
    if (Number.isInteger(right) && Number(given) === right) score += 1;
  }
  return { score, max, answered };
}

export function deadlineOf(startedAt, minutes = OLIMP.minutes) {
  return new Date(new Date(startedAt).getTime() + minutes * 60 * 1000);
}

// Після цього моменту відповіді з варіантами вже не приймаємо: основний час +
// запас на мережу. На відкрите завдання це не поширюється — воно без таймера.
export function acceptUntil(startedAt) {
  return new Date(deadlineOf(startedAt).getTime() + OLIMP.graceSeconds * 1000);
}

// Відповідь на відкрите завдання: що дитина встигла написати, без обрізаних пробілів.
export const cleanOpenAnswer = (text) => String(text || '').trim().slice(0, OPEN_TASK.maxLength);

// До якого моменту тест можна почати.
export function accessUntil(paidAt, hours = OLIMP.accessHours) {
  return new Date(new Date(paidAt).getTime() + hours * 60 * 60 * 1000);
}

// Оплатили, але за відведений час так і не почали. Розпочатий тест не
// «згорає»: його обмежує вже таймер.
export function accessExpired(entry, now = new Date()) {
  if (!entry?.paid_at || entry.started_at || !isPaidEntry(entry)) return false;
  return now.getTime() > accessUntil(entry.paid_at).getTime();
}

// «8 жовтня, 14:30» за київським часом — у запрошенні й на сторінці тесту.
export function kyivDateTime(date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Kyiv', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(date));
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return `${Number(get('day'))} ${MONTHS_GEN[Number(get('month')) - 1]}, ${get('hour')}:${get('minute')}`;
}

// Місяць конкурсу відкритих відповідей — за київським часом.
export function monthKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit' })
    .formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return `${get('year')}-${get('month')}`;
}

const MONTHS_GEN = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
const MONTHS_NOM = ['січень', 'лютий', 'березень', 'квітень', 'травень', 'червень', 'липень', 'серпень', 'вересень', 'жовтень', 'листопад', 'грудень'];

export function monthName(key, form = 'nom') {
  const m = Number(String(key).split('-')[1]);
  return (form === 'gen' ? MONTHS_GEN : MONTHS_NOM)[m - 1] || '';
}

// «5 жовтня 2026» — дата на дипломі, за київським часом.
export function diplomaDate(date) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date(date));
  const get = (type) => Number(parts.find((p) => p.type === type)?.value);
  return `${get('day')} ${MONTHS_GEN[get('month') - 1]} ${get('year')}`;
}

// Номер диплома — щоб його можна було назвати в листі чи звірити з базою.
export const diplomaNo = (token) => `ОЛ-${String(token || '').slice(0, 8).toUpperCase()}`;

// Імʼя дитини на дипломі: прибираємо зайві пробіли й обмежуємо довжину.
export function cleanName(raw) {
  return String(raw || '').replace(/\s+/g, ' ').trim().slice(0, 60);
}

// Дані для доставки друкованого диплома: хто отримує й куди. Повертає
// { order } або { error: 'назва поля' } — щоб форма показала, що виправити.
export function cleanPrintOrder(b) {
  const text = (v, max) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, max);
  const name = text(b?.name, 80);
  const phone = text(b?.phone, 24);
  const city = text(b?.city, 80);
  const branch = text(b?.branch, 80);
  if (name.length < 3) return { error: 'name' };
  if (phone.replace(/\D/g, '').length < 10) return { error: 'phone' };
  if (city.length < 2) return { error: 'city' };
  if (!branch) return { error: 'branch' };
  return { order: { name, phone, city, branch } };
}

export const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s || '').trim());

// Подарунковий місяць Dityam+ ще триває?
export function giftActive(sub, now = new Date()) {
  if (!sub || sub.billing_period !== 'gift' || !sub.gift_until) return false;
  return new Date(sub.gift_until).getTime() > now.getTime();
}

// Подарунок закінчився. Хто встиг оплатити підписку, той уже не «gift»:
// колбек оплати записує справжній період (місяць чи пів року).
export function giftExpired(sub, now = new Date()) {
  if (!sub || sub.billing_period !== 'gift') return false;
  return !giftActive(sub, now);
}
