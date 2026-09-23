/**
 * Чому ця картка лежить перед людиною — одним рядком людською мовою.
 *
 * Марія 23.09.2026: «мені треба щоб ти переробив процес і візуал в адмінці,
 * бо абсолютно нічого не зрозуміло». На папері вона намалювала дві купи:
 * «Потребує рішення» — і показувати, ЧОМУ саме цей запис сюди потрапив, що
 * саме не вистачає, сортувати за найближчим дедлайном; «Активні» — те, що
 * зараз на сайті, просто продивлятися.
 *
 * До того причина була розсипана по картці: ризик стояв сірим рядком над
 * карткою, «бракує» — червоною плашкою в середині, дубль — жовтою нижче, а
 * мертве посилання не показувалось узагалі. Людина мусила зібрати відповідь
 * сама з чотирьох місць. Тут вона збирається один раз — і тим самим порядком,
 * яким її збирає конвеєр (scraper/auto_review.py → mechanical()):
 *   дубль → мертве посилання → ризик → бракує поля → немає цитати → готово.
 *
 * Нових причин тут немає: ключі беруться з lib/queue-risk.js (вони ж —
 * lib/publish-criteria.json → risk.order), перелік полів — з lib/required.js,
 * дубль і link_status — ті самі колонки, які вже читає конвеєр. Цей файл лише
 * перекладає їх людською й не має жодного знання, якого немає деінде.
 *
 * Функції чисті й без мережі: їх читають тести на голому node
 * (tests/decision-reason.test.mjs).
 */
import { queueReason } from './queue-risk.js';
import { missingRequired, missingProof } from './required.js';
import { TYPE_LABELS } from './labels.js';
import { NEED_OPTIONS } from './plusProfile.js';
import { daysUntil, formatDate } from './dates.js';
import { plural } from './plural.js';

const NEED_LABELS = Object.fromEntries(NEED_OPTIONS);

// Тон визначає колір рамки й нічого більше: зміст має читатися й без кольору
// (те саме правило, що в «За критеріями» карантину).
export const TONES = { stop: 'stop', check: 'check', ready: 'ready' };

// Людські підписи типу й обставини. queueReason віддає детальність сирою
// («psychology», «veteran_family»), бо її ж читає Python; показувати людині
// машинний ключ не можна.
const human = (row) => {
  if (TYPE_LABELS[row.opportunity_type]) return TYPE_LABELS[row.opportunity_type].toLowerCase();
  return row.opportunity_type || '';
};
const humanNeeds = (row) => (row.child_needs || [])
  .map((n) => NEED_LABELS[n])
  .filter(Boolean)
  .join(', ')
  .toLowerCase();

// Один рядок на кожен ключ. Формулювання — Марії 23.09.2026 («Не вистачає:
// вік, вартість», «Посилання не відкривається», «Схоже на дубль»); підстави —
// з коду, слово в слово з тих самих переліків, що читає конвеєр.
const TEXT = {
  dup: () => 'Схоже на дубль — порівняй із тим, що вже в базі',
  link: (row) => (row.source_url
    ? 'Посилання не відкривається — перевір сторінку джерела'
    : 'Немає посилання на джерело'),
  sensitive: (row) => {
    const what = humanNeeds(row) || human(row);
    return `Чутлива тема${what ? ` (${what})` : ''} — потрібна людина`;
  },
  unreadable: (row) => (row.source
    ? `Джерело «${row.source}» робот не читає — підтвердь один раз`
    : 'Джерело робот не читає — підтвердь один раз'),
  conflict: () => 'Суперечність у записі — звір дати й тип із джерелом',
  threshold: () => 'Модель не впевнена, що це для дитини',
  rare: () => 'Рідкісне міжнародне — такі дивиться людина',
  missing: (row, detail) => `Не вистачає: ${detail}`,
  noproof: (row, detail) => `Модель не знайшла в тексті: ${detail}`,
  ready: () => 'Усе на місці — лишилось рішення',
};

const TONE_OF = {
  dup: 'stop', link: 'stop', missing: 'stop',
  sensitive: 'check', unreadable: 'check', conflict: 'check',
  threshold: 'check', rare: 'check', noproof: 'check',
  ready: 'ready',
};

const make = (row, key, detail) => ({ key, tone: TONE_OF[key], text: TEXT[key](row, detail) });

/**
 * Чого запису бракує, щоб він міг піти на сайт сам: { key, text, tone } або
 * null, якщо не бракує нічого. Окремо від decisionReason, бо в списку
 * «Неповні на сайті» питання рівно одне — яких полів немає, — і ризик чи
 * рідкісність там не відповідь.
 */
export function gapReason(row = {}) {
  const missing = missingRequired(row);
  if (missing.length) return make(row, 'missing', missing.join(', '));
  const noProof = missingProof(row);
  if (noProof.length) return make(row, 'noproof', noProof.join(', '));
  return null;
}

/**
 * Причина, з якої запис лежить перед людиною: { key, text, tone, gap }.
 * Завжди повертає щось — картка без причини не буває (тоді це «готово»).
 *
 * `gap` — другий, тихіший рядок: чого бракує, коли головна причина інша.
 * Без нього виходила пастка: запис стояв із «Модель не впевнена, що це для
 * дитини», кнопка «Додати на сайт» була сіра, а чому саме — не сказано ніде.
 */
export function decisionReason(row = {}) {
  const gap = gapReason(row);
  const withGap = (r) => (r.key === gap?.key ? r : { ...r, gap: gap?.text || null });

  // Порядок — конвеєрний: спершу те, що знімає питання одним кліком.
  if (row.dup_of) return withGap(make(row, 'dup'));
  // link_status: ok | suspect | dead (міграція 20260817). Конвеєр на не-ok
  // одразу каже «лінк не живий», а в черзі це не було видно ніде.
  if ((row.link_status || 'ok') !== 'ok' || !row.source_url) return withGap(make(row, 'link'));

  const risk = queueReason(row);
  if (risk && TEXT[risk.key]) return withGap(make(row, risk.key));

  return gap || make(row, 'ready');
}

/**
 * Дедлайн словами: «до 5 жовтня 2026 · 12 днів». null — дедлайну немає.
 * `todayIso` приходить пропом із сервера (kyivToday), бо доба має
 * закінчуватись тоді ж, коли в тих, хто подає, — див. lib/dates.js.
 */
export function deadlineNote(row = {}, todayIso) {
  if (!row.deadline) return null;
  const days = daysUntil(row.deadline, todayIso);
  const date = formatDate(row.deadline);
  if (days === null) return { text: `до ${date}`, days: null, past: false };
  const word = (n) => `${n} ${plural(n, 'день', 'дні', 'днів')}`;
  const left = days < 0 ? `минув ${word(-days)} тому`
    : days === 0 ? 'сьогодні останній день'
      : days === 1 ? 'завтра останній день'
        : `лишилось ${word(days)}`;
  return { text: `до ${date} · ${left}`, days, past: days < 0 };
}

/**
 * Сортування черги: спершу те, у чого є дедлайн, найближчий згори; без
 * дедлайну — після них (Марія 23.09.2026, «сортувати за найближчим
 * дедлайном»). Сортування стабільне, тож усередині «без дедлайну»
 * зберігається порядок, у якому прийшов список (у черзі — за вагою ризику
 * з lib/queue-risk.js).
 */
/**
 * Чи запис уже прострочений: остання з його дат у минулому.
 *
 * Марія 23.09.2026: «те що прострочене прибирай вже». Вночі такий запис і так
 * закриє auto_review (червоний коридор, «дата в минулому»), але до ночі він
 * стояв першим у черзі — бо найближчий дедлайн сортується вгору, а минулий
 * дедлайн «найближчий» за означенням. Показувати людині те, що машина ось-ось
 * закриє, — марна робота.
 *
 * Постійні й періодичні записи без дат простроченими не бувають: там нічого
 * не минуло.
 */
export function isOverdue(row = {}, todayIso) {
  const dates = [row.deadline, row.event_end_date, row.event_start_date, row.results_date]
    .filter(Boolean)
    .map((d) => String(d).slice(0, 10));
  if (!dates.length) return false;
  const last = dates.sort().at(-1);
  return last < String(todayIso).slice(0, 10);
}

export function sortByDeadline(list = [], deadlineOf = (x) => x?.deadline) {
  return [...list].sort((a, b) => {
    const da = deadlineOf(a) || '';
    const db = deadlineOf(b) || '';
    if (da && db) return da < db ? -1 : da > db ? 1 : 0;
    if (da) return -1;
    if (db) return 1;
    return 0;
  });
}
