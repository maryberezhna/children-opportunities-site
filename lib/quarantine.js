/**
 * Карантин сирих записів (raw_items зі status='review').
 *
 * Туди потрапляє «сіра смуга»: модель не впевнена (0.25–0.55), чи це
 * можливість для дитини. До 21.09.2026 розібрати карантин було нічим — 78
 * записів і ~7 нових на добу, переглянуто нуль. Тепер на /admin/quarantine
 * дві кнопки: «Завести можливість» (запис повертається в чергу розбору з
 * позначкою, що людина підтвердила, і нічний розбір створює можливість без
 * порогу впевненості) і «Відхилити».
 *
 * Модуль без аліасу `@/` і без мережі: його читають тести на голому node.
 */
import { CITY_META } from './cities.js';

const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

/**
 * Те, за чим людина вирішує за секунду: вік, хто може подаватись, суть.
 * Текст сирця довгий (у Eurodesk — 2–3 тис. символів), тож показуємо
 * витяг, а повний текст — під спойлером.
 */
export function quarantineSnippet(rawText) {
  const text = clean(rawText);
  const age = ageOf(text);
  const who = text.match(/Who can apply:?\s*([^.;]{5,220})/i)?.[1]
    || text.match(/(?:Хто може|Для кого)[^.:]*:\s*([^.;]{5,220})/i)?.[1]
    || null;
  const lead = text.slice(0, 280) + (text.length > 280 ? '…' : '');
  return { age, who: who ? clean(who) : null, lead };
}

function ageOf(text) {
  // Eurodesk пише відкритий вік як «Age: 18 to -».
  const from = text.match(/\bAge:\s*(\d+)\s*to\s*-/i)?.[1];
  const age = text.match(/\bAge:\s*(\d+\s*to\s*\d+)/i)?.[1]
    || text.match(/(\d{1,2})\s*[–—-]\s*(\d{1,2})\s*(?:років|рок)/)?.[0]
    || (from ? `від ${from}` : null)
    || text.match(/від\s+\d{1,2}\s+(?:до\s+\d{1,2}\s+)?(?:років|рок)/i)?.[0]
    || text.match(/\d{1,2}\s*[–—-]\s*\d{1,2}\s*клас/i)?.[0]
    || null;
  return age ? clean(age) : null;
}

// ── За критеріями ────────────────────────────────────────────────────────
// Марія, 22.09.2026: на карантині показати запис «по основним нашим
// критеріям» — актуальна, повна, конкретна, українською (ті самі, що в
// правилах на «Черзі», app/admin/ModerationRules.js). У карантині профілю
// ще немає — його заповнить нічний розбір після «Завести можливість». Тож
// тут не вердикт, а що з головного видно в самому тексті. Чого скрипт не
// знайшов, того може не бути в тексті, але бути на сторінці джерела —
// тому «не знайдено», а не «немає». «Конкретна» скрипт не оцінює взагалі:
// це рішення людини.

const MONTHS_UK = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
  'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
const MONTHS_EN = ['january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december'];
const UK_RE = MONTHS_UK.join('|');
const EN_RE = MONTHS_EN.join('|');

const pad = (n) => String(n).padStart(2, '0');
const dmy = (iso) => iso.split('-').reverse().join('.');

function isoOf(y, m, d) {
  const [yy, mm, dd] = [Number(y), Number(m), Number(d)];
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  return `${yy}-${pad(mm)}-${pad(dd)}`;
}

/**
 * Дати з тексту сирця. Дата публікації поста — не дата подачі й не дата
 * події, її відрізаємо. Діапазон «24–27 вересня 2026» дає останній день:
 * поки подія триває, вона актуальна. Дата без року лишається без року —
 * вгадувати його не беремося.
 */
export function textDates(rawText) {
  const text = clean(rawText).replace(/Дата публікації:\s*\d{4}-\d{2}-\d{2}/g, ' ');
  const dated = new Map();
  const undated = [];
  const add = (iso) => { if (iso && !dated.has(iso)) dated.set(iso, dmy(iso)); };
  let m;

  const iso = /\b(20\d\d)-(\d\d)-(\d\d)\b/g;
  while ((m = iso.exec(text))) add(isoOf(m[1], m[2], m[3]));
  // Eurodesk і більшість європейських сайтів — день/місяць/рік.
  const num = /\b(\d{1,2})[./](\d{1,2})[./](20\d\d)\b/g;
  while ((m = num.exec(text))) add(isoOf(m[3], m[2], m[1]));

  const uk = new RegExp(`(\\d{1,2})(?:\\s*[–—-]\\s*(\\d{1,2}))?\\s+(${UK_RE})(?:\\s+(20\\d\\d))?`, 'gi');
  while ((m = uk.exec(text))) {
    const month = MONTHS_UK.indexOf(m[3].toLowerCase()) + 1;
    const day = m[2] || m[1];
    if (m[4]) add(isoOf(m[4], month, day));
    else undated.push(clean(m[0]));
  }
  const enDay = new RegExp(`(\\d{1,2})(?:\\s*[–-]\\s*(\\d{1,2}))?\\s+(${EN_RE})\\s+(20\\d\\d)`, 'gi');
  while ((m = enDay.exec(text))) add(isoOf(m[4], MONTHS_EN.indexOf(m[3].toLowerCase()) + 1, m[2] || m[1]));
  const enMonth = new RegExp(`(${EN_RE})\\s+(\\d{1,2})(?:\\s*[–-]\\s*(\\d{1,2}))?,?\\s+(20\\d\\d)`, 'gi');
  while ((m = enMonth.exec(text))) add(isoOf(m[4], MONTHS_EN.indexOf(m[1].toLowerCase()) + 1, m[3] || m[2]));

  const ongoing = /\bONGOING\b|постійн(?:ий|о)\s+набір|набір\s+триває\s+постійно/i.test(text);
  return {
    dated: [...dated.entries()].map(([d, label]) => ({ iso: d, label })).sort((a, b) => a.iso.localeCompare(b.iso)),
    undated: [...new Set(undated)],
    ongoing,
  };
}

function costOf(text) {
  const free = /безкоштовн|безоплатн|без оплати|\bfree\b/i.test(text);
  const price = /\d[\d\s.,]*\s?(?:грн|₴|€|євро|\$|usd\b|eur\b|доларів)|(?:₴|€|\$)\s?\d/i.test(text);
  if (free && price) return 'і «безкоштовно», і ціна — звір';
  if (free) return 'безкоштовно';
  if (price) return 'є ціна';
  return null;
}

const CITY_RE = new RegExp(
  `(?<!\\p{L})(${Object.values(CITY_META).flatMap((c) => [c.ua, c.locative]).join('|')})(?!\\p{L})`, 'u');

function placeOf(text) {
  const out = [];
  if (/онлайн|online|дистанційн|вебінар|webinar|\bzoom\b/i.test(text)) out.push('онлайн');
  const city = text.match(CITY_RE)?.[1];
  const meta = city && Object.values(CITY_META).find((c) => c.ua === city || c.locative === city);
  if (meta) out.push(meta.ua);
  else {
    // «Де: Буковель Коли: …» — беремо до наступної мітки чи розділового знака.
    const where = text.match(/(?:^|\s)Де:\s*([^.;•|]{2,60})/)?.[1]
      ?.split(/\s(?:Коли|Дедлайн|Вік|Для кого|Вартість|Реєстрація)\s*:/)[0];
    if (where && !/онлайн|online/i.test(where)) out.push(clean(where).slice(0, 40));
  }
  return out.length ? out.join(', ') : null;
}

// Той самий критерій, що й у пості каналу (scripts/post-labels.mjs,
// isUkrainianPost) і в scraper/ukrainize.py: у назві є українське слово,
// а текст здебільшого кирилицею. Змінювати разом.
const letters = (t) => [...String(t || '')].filter((c) => /\p{L}/u.test(c));
function cyrillicShare(t) {
  const all = letters(t);
  return all.length ? all.filter((c) => /[Ѐ-ӿ]/.test(c)).length / all.length : 0;
}

/**
 * Що з головного видно в тексті сирця — по чотирьох критеріях.
 * Чиста функція: `today` — параметр, щоб тести не залежали від дати.
 */
export function quarantineCriteria(rawTitle, rawText, today = new Date()) {
  const title = clean(rawTitle);
  const text = clean(rawText);
  const todayIso = today.toISOString().slice(0, 10);

  const { dated, undated, ongoing } = textDates(text);
  const future = dated.filter((d) => d.iso >= todayIso).map((d) => d.label);
  const past = dated.filter((d) => d.iso < todayIso).map((d) => d.label);
  // «ONGOING», а в тексті лише минулі дати (конференція 24–27.09.2025 у
  // Eurodesk) — суперечність: не ✓, а «звір у джерелі».
  const conflict = ongoing && !future.length && past.length > 0;
  const actual = future.length || (ongoing && !conflict) ? 'yes'
    : conflict ? 'unknown' : past.length ? 'no' : 'unknown';

  const found = {
    age: ageOf(text),
    date: dated.length > 0 || undated.length > 0 || ongoing,
    cost: costOf(text),
    place: placeOf(text),
  };

  // Пост каналу, де назва — рубрика («#освіта», «Київ» над «# Київ»):
  // під нею часто кілька можливостей одразу. Сигнал, а не вердикт.
  const rubric = /^#/.test(title)
    || (title.split(' ').length <= 2 && text.includes(`# ${title}`));
  // Eurodesk прямо пише, для кого програма.
  const orgsOnly = /available for:\s*Organisations\b(?!\s*,?\s*Young people)/i.test(text);

  return {
    actual, future, past, undated, ongoing, conflict,
    found,
    rubric,
    orgsOnly,
    ukrainian: /[Ѐ-ӿ]{3,}/.test(title) && cyrillicShare(text) >= 0.5,
  };
}

/** Патч до raw_items за рішенням людини. Чиста функція — під тест. */
export function verdictPatch(action, now = new Date()) {
  const at = now.toISOString();
  if (action === 'accept') {
    // Назад у чергу: нічний розбір створить можливість тією ж моделлю, але
    // без порогу впевненості — людина вже сказала, що це для дітей.
    return {
      status: 'pending', attempts: 0, review_verdict: 'accept', reviewed_at: at,
      last_error: null,
    };
  }
  if (action === 'reject') {
    return { status: 'rejected', review_verdict: 'reject', reviewed_at: at };
  }
  return null;
}
