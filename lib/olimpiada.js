// Онлайн-олімпіада Dityam.com.ua — налаштування й чиста логіка: порядок
// питань, підрахунок балів, рівень диплома, місяць конкурсу.
//
// Задум (Марія, 05.10.2026): дитина проходить тест онлайн, батьки платять
// 150 грн і одразу отримують диплом і місяць Dityam+; щомісяця — призи за
// найкращі відповіді на відкрите завдання. Пілот — одна група, логіка.
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
  price: 150,
  // Скільки днів Dityam+ дістається кожному учасникові.
  giftDays: 30,
  // Коли час вийшов — ще 2 хвилини на табло «Відправити відповідь» з
  // відліком: дописати відкрите завдання й надіслати; потім усе йде само
  // (Марія, 06.10.2026). Відповіді з варіантами в цей час уже не міняються.
  overtimeSeconds: 120,
  // Запас на мережу після цих 2 хвилин: що прийшло пізніше, не зараховуємо.
  graceSeconds: 90,
  // Скільки годин після оплати є на те, щоб почати тест («є 72 години до
  // проходження», Марія 05.10.2026). Потім доступ закривається, а внесок не
  // повертається — як і після початку тесту.
  accessHours: 72,
  // Друкований диплом із доставкою Новою поштою — за бажанням («за додаткові
  // 100 грн», Марія 05.10.2026).
  printPrice: 120,
};

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
export const DIPLOMA_VERSION = 7;

export const PRIZES = [
  { place: 1, image: '/olimpiada/prize-lego.jpg', title: 'Конструктор LEGO Creator 3в1 «Космонавт»', note: '647 деталей, 3 моделі з одного набору' },
  { place: 2, image: '/olimpiada/prize-monopoliya.jpg', title: 'Настільна гра «Монополія: Дива України»', note: 'українське видання Rozum, від 2 до 6 гравців' },
  { place: 3, image: '/olimpiada/prize-krystaly.jpg', title: 'Набір дослідів 4M KidzLabs «Вирощування кристалів»', note: 'справжні кристали своїми руками, від 10 років' },
];

// Одне відкрите завдання на місяць — за нього змагаються за призи.
// Відкрите завдання — останній крок самого тесту, у тих самих хвилинах
// (Марія, 06.10.2026: «у тих самих хвилинах»), а не окремо після диплома.
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

// Після цього моменту відповіді вже не приймаємо: основний час + 2 хвилини
// табло «Відправити відповідь» + запас на мережу.
export function acceptUntil(startedAt) {
  return new Date(deadlineOf(startedAt).getTime() + (OLIMP.overtimeSeconds + OLIMP.graceSeconds) * 1000);
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
  if (!entry?.paid_at || entry.started_at) return false;
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
