/**
 * Вік у тексті опису проти полів age_from / age_to.
 *
 * Привід — картка конкурсу «Ось як це було…» 30.09.2026: пігулка «8–16
 * років» (з цитатою з положення), а в описі, взятому з добірки learning.ua,
 * «8–10, 11–13 і 14–18 років». Перевірка з цитатами виправила поле, опис
 * лишився чужий — і батько бачив на одній картці два різні віки. Марія:
 * «такого ніколи не має бути».
 *
 * Тут лише сигнал людині чи воротам автопублікації (lib/queue-risk.js,
 * scraper/auto_review.py — та сама логіка), не автоматична правка: що саме
 * хибне, поле чи опис, видно тільки зі сторінки джерела.
 *
 * Суперечність — коли опис ОБІЦЯЄ вік поза полем: у тексті 14–18, а поле
 * до 16. Опис вужчий за поле («курс для 12–17» при полі 7–18) не ловимо:
 * у записах із кількома групами він часто називає лише одну.
 */

// Одна пара: «8–16», «від 8 до 16», «5-7». Дефіс, тире й «до».
const PAIR = /(\d{1,2})\s*(?:[–—-]|до)\s*(\d{1,2})/g;
// Перелік груп «8–10, 11–13 і 14–18 років» чи «дітей 6–11, підлітків 11–13
// та 13–17 років»: слово «років» стоїть лише в кінці, тож беремо весь
// ланцюжок пар перед ним, дозволяючи між парами до двох слів.
const RUN = /(?:від\s*)?((?:\d{1,2}\s*(?:[–—-]|до)\s*\d{1,2})(?:\s*(?:,|;|і|та|або)?\s*(?:[^\s\d.;:,]+\s+){0,2}\d{1,2}\s*(?:[–—-]|до)\s*\d{1,2})*)\s*(?:рок|р\.)/g;
// «навчання 5–7 років», «тривалістю від 1 до 2 років», «досвід 1–2 роки» — тривалість, не вік.
const NOT_AGE_BEFORE = /(?:(?:навчанн|трива|протягом|курс|програм|досвід|стаж|термін)\S*|на)\s*$/i;
// Стеля сайту: «18–30 років» при полі 18–18 — не суперечність.
export const SITE_MAX_AGE = 18;

/** Найширший вік, який називає текст: { from, to } або null. */
export function summaryAgeRange(text = '') {
  const s = String(text || '');
  let lo = null;
  let hi = null;
  for (const run of s.matchAll(RUN)) {
    const before = s.slice(Math.max(0, run.index - 14), run.index);
    if (NOT_AGE_BEFORE.test(before)) continue;
    for (const m of run[1].matchAll(PAIR)) {
      const a = Number(m[1]);
      const b = Number(m[2]);
      if (a > b) continue;
      lo = lo === null ? a : Math.min(lo, a);
      hi = hi === null ? b : Math.max(hi, b);
    }
  }
  return lo === null ? null : { from: lo, to: hi };
}

/** Опис обіцяє вік поза полем — рядок для модератора, інакше null. */
export function ageConflict(row = {}) {
  const r = summaryAgeRange(row.summary);
  if (!r) return null;
  const { age_from: from, age_to: to } = row;
  if (from == null && to == null) return null;
  const textFrom = Math.min(r.from, SITE_MAX_AGE);
  const textTo = Math.min(r.to, SITE_MAX_AGE);
  const wider = (from != null && textFrom < from) || (to != null && textTo > to);
  if (!wider) return null;
  return `в описі ${r.from}–${r.to} років, а в полі ${from ?? '?'}–${to ?? '?'}`;
}
