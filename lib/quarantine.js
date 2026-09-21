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

const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

/**
 * Те, за чим людина вирішує за секунду: вік, хто може подаватись, суть.
 * Текст сирця довгий (у Eurodesk — 2–3 тис. символів), тож показуємо
 * витяг, а повний текст — під спойлером.
 */
export function quarantineSnippet(rawText) {
  const text = clean(rawText);
  const age = text.match(/\bAge:\s*(\d+\s*to\s*\d+)/i)?.[1]
    || text.match(/(\d{1,2})\s*[–—-]\s*(\d{1,2})\s*(?:років|рок)/)?.[0]
    || null;
  const who = text.match(/Who can apply:?\s*([^.;]{5,220})/i)?.[1]
    || text.match(/(?:Хто може|Для кого)[^.:]*:\s*([^.;]{5,220})/i)?.[1]
    || null;
  const lead = text.slice(0, 280) + (text.length > 280 ? '…' : '');
  return { age: age ? clean(age) : null, who: who ? clean(who) : null, lead };
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
