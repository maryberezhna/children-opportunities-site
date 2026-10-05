// Онлайн-олімпіада Dityam.com.ua — налаштування й чиста логіка: порядок
// питань, підрахунок балів, рівень диплома, місяць конкурсу.
//
// Задум (Марія, 05.10.2026): дитина проходить тест онлайн, батьки платять
// 150 грн і одразу отримують диплом і місяць Dityam+; щомісяця — призи за
// найкращі відповіді на відкрите завдання. Пілот — одна група, логіка.
//
// Кількість завдань і час — тут, в одному місці («30 завдань і 40 хвилин»).

// Перемикач продажу, як PLUS_SALES_OPEN у lib/plus.js. Поки false — сторінка
// є, але оплата закрита для всіх, крім адміна (вхід в адмінку): Марія
// проходить тест сама й вичитує завдання, перш ніж за нього хтось заплатить.
// Запуск = true: відкривається форма, сторінка потрапляє в sitemap, llms.txt
// і в індекс. Після запуску призи місяця вже не міняти (ЦК, ст. 1151).
export const OLIMP_OPEN = false;

export const OLIMP = {
  slug: 'lohika-9-11',
  title: 'Онлайн-олімпіада з логіки',
  groupLabel: '9–11 років',
  ageMin: 9,
  ageMax: 11,
  questionCount: 30,
  minutes: 40,
  price: 150,
  // Скільки днів Dityam+ дістається кожному учасникові.
  giftDays: 30,
  // Запас на мережу: відповіді, надіслані трохи після сигналу таймера.
  graceSeconds: 90,
};

// Рівень диплома залежить лише від балів дитини, а не від чужих результатів,
// тому диплом готовий одразу. Пороги відомі заздалегідь і стоять у правилах.
export const LEVELS = [
  { key: 'gold', label: 'Золотий рівень', min: 26 },
  { key: 'silver', label: 'Срібний рівень', min: 20 },
  { key: 'bronze', label: 'Бронзовий рівень', min: 14 },
  { key: 'participant', label: 'Диплом учасника', min: 0 },
];

export function levelFor(score) {
  const n = Number(score) || 0;
  return LEVELS.find((l) => n >= l.min) || LEVELS[LEVELS.length - 1];
}

export const levelByKey = (key) => LEVELS.find((l) => l.key === key) || LEVELS[LEVELS.length - 1];

// Призи місяця за найкращі відповіді на відкрите завдання — як назвала
// Марія 05.10.2026. Приз — істотна умова конкурсу (ЦК, ст. 1151): після
// початку місяця його не міняти. Планшет дорожчий за неоподатковувану межу
// (2 161,75 грн у 2026 році) — з нього організатор платить ПДФО й військовий збір.
export const PRIZES = [
  { place: 1, title: 'Планшет для дитини' },
  { place: 2, title: 'Набір для навчання' },
  { place: 3, title: 'Набір для творчості' },
];

// Одне відкрите завдання на місяць — за нього змагаються за призи.
export const OPEN_TASK = {
  title: 'Придумай власну логічну задачу',
  text: 'Придумай логічну задачу для своїх однолітків і напиши її розвʼязок. Задача має бути твоя, а не з книжки чи інтернету.',
  criteria: ['оригінальність задачі', 'правильний і повний розвʼязок', 'зрозумілий виклад'],
  maxLength: 2000,
};

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
// Банк іде від легких до складних, і цей хід зберігаємо: перемішуємо лише
// всередині третин, щоб тест не починався з найважчого завдання.
export function buildOrder(bank, token, count = OLIMP.questionCount) {
  const rand = mulberry32(seedFrom(token));
  const set = bank.slice(0, count);
  const tier = Math.ceil(set.length / 3);
  const picked = [0, 1, 2].flatMap((i) => shuffled(set.slice(i * tier, (i + 1) * tier), rand));
  return picked.map((q) => ({ id: q.id, options: shuffled(q.options.map((_, i) => i), rand) }));
}

// Те, що бачить браузер: без правильних відповідей.
export function publicQuestions(bank, order) {
  const byId = new Map(bank.map((q) => [q.id, q]));
  return order
    .map((o) => {
      const q = byId.get(o.id);
      if (!q) return null;
      return { id: q.id, q: q.q, options: o.options.map((i) => ({ id: i, text: q.options[i] })) };
    })
    .filter(Boolean);
}

// answers: { [idПитання]: індексВаріанта }. Рахуємо лише питання, видані
// цій дитині (order), щоб зайві ключі в запиті нічого не додали.
export function scoreAnswers(bank, order, answers) {
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
    if (Number(given) === q.answer) score += 1;
  }
  return { score, max, answered };
}

export function deadlineOf(startedAt, minutes = OLIMP.minutes) {
  return new Date(new Date(startedAt).getTime() + minutes * 60 * 1000);
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
