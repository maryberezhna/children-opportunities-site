/**
 * Джерела-кандидати: домен із посилання й перелік рішень людини.
 *
 * Розвідник джерел (scraper/discover_sources.py) щодня складає кандидатів у
 * таблицю source_candidates і сам нічого не вмикає: «У каталог звідси не
 * потрапляє НІЧОГО. Джерело заводить людина». Доти ці кандидати не було
 * видно ніде — 19.10.2026 їх назбиралось 22, і жодного з них ніхто не бачив.
 *
 * Функції чисті й без мережі — їх читають і сторінка, і тести.
 */

// Рішення людини над кандидатом. «Беремо» — не «увімкнули»: під кожен сайт
// потрібен окремий зчитувач у коді (scrapers/organizer_sites.py,
// scrapers/diaspora_sites.py), і кнопка, яка вдавала б запуск обходу, була б
// порожньою обіцянкою.
import { isSharedHost } from './source-link.js';

export const CANDIDATE_ACTIONS = {
  take: 'approved',
  skip: 'rejected',
  back: 'pending',
};

/**
 * Домен із посилання — у тому ж вигляді, що пише розвідник: без www,
 * малими літерами, без порту й шляху. null — якщо це не посилання.
 */
export function domainOf(url) {
  try {
    const h = new URL(String(url).trim()).hostname.toLowerCase();
    return h.replace(/^www\./, '') || null;
  } catch {
    return null;
  }
}

/**
 * Чи варто заводити кандидата з цього посилання. Наші власні сторінки й
 * агрегатори соцмереж джерелом не бувають: першоджерело — сторінка
 * організатора (lib/first-source правило «джерело — сторінка, не допис»).
 */
// Соцмережі, форми, документи й Telegram — один список із source-link.js
// (там він відмовляє таким адресам у полі «джерело»): m.facebook.com,
// forms.gle, drive.google.com тощо — все, де сторінка належить не
// організатору, а сервісу.
const NOT_A_SOURCE = new Set(['dityam.com.ua']);

export function candidateDomain(url) {
  const d = domainOf(url);
  if (!d || NOT_A_SOURCE.has(d) || isSharedHost(url)) return null;
  return d;
}
