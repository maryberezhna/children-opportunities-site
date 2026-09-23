/**
 * Чому запис лежить у черзі людини — і чи лежить там узагалі.
 *
 * Рішення Марії 22.09.2026: «черга людини за ризиком, не за сумнівом машини»,
 * не більше 15–20 карток на день. До того черга показувала все, що машина не
 * змогла опублікувати: і вразливу тему, де людина справді потрібна, і запис,
 * якому просто бракує цитати. Після воріт правди (#440) друге стало б
 * більшістю, і перше втопилось би в ньому.
 *
 * Тому тут дві відповіді:
 *   • queueReason(row) — ризик, через який картку має побачити людина
 *     (вразлива тема → суперечність → межа «для дітей» → рідкісне міжнародне);
 *   • waitingReason(row, trustTier) — чому запис чекає машину, а не людину:
 *     бракує поля або цитати. Такий запис лишається чернеткою, на сайт не йде
 *     і в щоденній роботі не показується.
 *
 * Рівень довіри джерела (23.09.2026). Раніше він був воротами в auto_review і
 * тримав геть усе: приплив дають телеграм-канали й discover-агент, тобто
 * третій рівень, — у зведенні стояло «на сайт 0, притримано 3». Тепер
 * підтверджене цитатою йде на сайт із будь-якого джерела, а рівень лишається
 * вагою: його дописуємо до причини очікування, щоб було видно і чого бракує,
 * і звідки запис.
 *
 * Правила — з lib/publish-criteria.json, звідти ж їх читає scraper/auto_review.py.
 */
import criteria from './publish-criteria.json' with { type: 'json' };
import { missingRequired, missingProof } from './required.js';
import { dateWarnings } from './date-warnings.js';

const RISK = criteria.risk;
const SENSITIVE_TYPES = new Set(RISK.sensitive_types);
const SENSITIVE_NEEDS = new Set(RISK.sensitive_needs);
// Джерела, чию сторінку робот прочитати не може (mon.gov.ua віддає 403
// і поза GitHub). Цитати зі сторінки там не буде ніколи, тож такий запис
// підтверджує людина — один раз, а не щоразу.
const UNREADABLE = new Set(RISK.unreadable_sources || []);

export const DAILY_CAP = RISK.daily_cap;
export const RISK_LABELS = RISK.labels;
export const TRUST_TIER_LABELS = RISK.trust_tier_labels;
export const DEFAULT_TRUST_TIER = RISK.trust_tier_default;

/** Підпис рівня джерела. Невідомий рівень читаємо як третій — так само,
 * як scraper/auto_review.tier_label. */
export function trustLabel(tier) {
  return TRUST_TIER_LABELS[String(tier)] || TRUST_TIER_LABELS[String(DEFAULT_TRUST_TIER)];
}

// Позначки конвеєра, з яких видно, що модель вагалась саме щодо «це для
// дитини?»: поріг впевненості й запис, проведений людиною через карантин.
const THRESHOLD_MARKS = [
  'низька впевненість',
  'людина прийняла з карантину',
  'схоже, учасник — дорослий',
];

// Суперечність «вік каже одне, текст інше»: у назві чи описі стоїть межа
// «18+», «для дорослих», «від 18», а в полі — дитячий діапазон.
const ADULT_IN_TEXT = /\b18\s*\+|для дорослих|від\s*18\s*(?:років|р\.)|повнолітн/i;

const text = (row) => `${row.title || ''} ${row.summary || ''}`;

/**
 * Чому запис чекає машину, а не людину. null — не чекає.
 * trustTier — рівень джерела з реєстру `sources`, якщо він відомий: тоді
 * в причині видно і чого бракує, і звідки запис (дзеркало auto_review._hold).
 */
export function waitingReason(row = {}, trustTier = null) {
  const withTier = (reason) => (trustTier == null ? reason : `${reason} · ${trustLabel(trustTier)}`);
  const missing = missingRequired(row);
  if (missing.length) return withTier(`бракує: ${missing.join(', ')}`);
  const noProof = missingProof(row);
  if (noProof.length) return withTier(`без цитати: ${noProof.join(', ')}`);
  return null;
}

/**
 * Ризик, через який картку має побачити людина: { key, label, rank } або null.
 * Вразлива тема переважає все інше — саме там помилка дорожча.
 */
export function queueReason(row = {}) {
  const reason = (key, detail) => ({
    key,
    rank: RISK.order.indexOf(key),
    label: detail ? `${RISK.labels[key]}: ${detail}` : RISK.labels[key],
  });

  if (SENSITIVE_TYPES.has(row.opportunity_type)) {
    return reason('sensitive', row.opportunity_type);
  }
  const needs = (row.child_needs || []).filter((n) => SENSITIVE_NEEDS.has(n));
  if (needs.length) return reason('sensitive', needs.join(', '));

  if (UNREADABLE.has(row.source)) return reason('unreadable', row.source);

  const warnings = dateWarnings(row);
  if (warnings.length) return reason('conflict', 'дати');
  if (ADULT_IN_TEXT.test(text(row)) && (row.age_to ?? 18) <= 18 && (row.age_from ?? 0) < 18) {
    return reason('conflict', 'у тексті «18+», а вік дитячий');
  }

  const marks = (row.admin_comment || '').toLowerCase();
  if (THRESHOLD_MARKS.some((m) => marks.includes(m))) return reason('threshold');

  if (row.is_international) return reason('rare');

  return null;
}

/**
 * Ділить чернетки на дві купи: що показати людині сьогодні (за ризиком, і не
 * більше ніж DAILY_CAP) і що чекає машину. Запис без ризику й без причини
 * чекати теж іде до людини: він готовий, і рішення за нею.
 *
 * tiers — необовʼязкова мапа «джерело → рівень довіри» з реєстру `sources`.
 * Є вона — у причині очікування видно ще й рівень; немає — поведінка та сама,
 * що й була (адмінка може її не передавати).
 */
export function splitQueue(drafts = [], tiers = null) {
  const forHuman = [];
  const waiting = [];
  for (const row of drafts) {
    const risk = queueReason(row);
    if (risk) { forHuman.push({ row, risk }); continue; }
    const wait = waitingReason(row, tiers ? tiers[row.source] ?? DEFAULT_TRUST_TIER : null);
    if (wait) { waiting.push({ row, wait }); continue; }
    forHuman.push({ row, risk: null });
  }
  // Ризик уперед, за вагою; усередині — новіші згори, як було в черзі.
  forHuman.sort((a, b) => (a.risk ? a.risk.rank : 99) - (b.risk ? b.risk.rank : 99));
  return { forHuman, waiting };
}
