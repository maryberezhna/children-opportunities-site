// Підписи для постів: дата подачі, вартість, посилання на сторінку.
// Окремим модулем, щоб їх можна було перевірити тестом — check-deadlines.mjs,
// post-to-telegram.mjs і content-agent.mjs при імпорті одразу йдуть у базу.
import { plural } from '../lib/plural.js';
import { abroadCountries, goesAbroad, isOnline, realCities } from '../lib/geo.js';

const MONTHS = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
  'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];

export function formatDeadlineDate(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

// Що стоїть після «⏰ Заявки до:». Завжди сама дата — її вписують у календар, —
// а скільки лишилось, окремо після неї. До 21.09.2026 замість дати друкувалось
// «за 32 дн.», і в каналі вийшло «Заявки до: за 32 дн.».
export function deadlineTag(deadline, daysLeft) {
  const date = formatDeadlineDate(deadline);
  if (!date) return null;
  if (daysLeft == null || daysLeft < 0) return `<b>${date}</b>`;
  const left = daysLeft === 0 ? 'сьогодні останній день'
    : daysLeft === 1 ? 'завтра останній день'
      : `ще ${daysLeft} ${plural(daysLeft, 'день', 'дні', 'днів')}`;
  return `<b>${date}</b> · ${left}`;
}

// Вартість — лише «Безкоштовно» або «Платно» (рішення Марії 13.09.2026).
// Проміжні partially_free / subsidized не відповідають, чи платити родині, —
// для них рядка немає зовсім, а не «З фінансуванням» чи «Субсидовано».
const COST = { free: 'Безкоштовно', paid_affordable: 'Платно', paid_premium: 'Платно' };

export function costLabel(costType) {
  return COST[costType] || null;
}

// Чернетка поста веде на сторінку САМЕ цієї можливості, а не на головну
// (Марія, 21.09.2026, про чернетку «Erasmus+ WITHIN»: «отут можна прям
// посилання на сторінку можливості»). Модель інколи пише голий домен — тоді
// міняємо його в короткому рядку-заклику наприкінці. Довгі рядки не чіпаємо:
// там «Dityam.com.ua» — назва платформи в тексті, а не посилання.
const BARE_DOMAIN = /(?:https?:\/\/)?(?:www\.)?dityam\.com\.ua\/?(?=$|[\s.,!?;:)»"'])/i;
const CTA_MAX = 80;

export function withPageLink(post, slug) {
  const text = String(post || '');
  if (!slug || text.includes(`/o/${slug}`)) return text;
  const url = `dityam.com.ua/o/${slug}`;
  const lines = text.split('\n');
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (lines[i].length <= CTA_MAX && BARE_DOMAIN.test(lines[i])) {
      lines[i] = lines[i].replace(BARE_DOMAIN, url);
      return lines.join('\n');
    }
  }
  // Заклику немає зовсім — ставимо його перед хештегами.
  const link = `Деталі — ${url}`;
  const tags = lines.findIndex((l) => /^\s*#[^\s#]/.test(l));
  if (tags === -1) return `${text.trimEnd()}\n\n${link}`;
  lines.splice(tags, 0, link, '');
  return lines.join('\n');
}

// ── Мова ────────────────────────────────────────────────────────────────
// У канал — лише українською (Марія, 22.09.2026: «ніколи не пиши в телеграм
// канал англійською — тільки переклад або чисто укр»). Того дня «Нова
// можливість» вийшла про WWOOF з назвою «Volunteer in organic farms» і
// англійським описом: запис прийшов з Eurodesk англійською, пост узяв як є.
// Назва мусить мати хоч одне українське слово (імʼя програми — «Erasmus+»,
// «WWOOF» — лишається, але поруч українське пояснення), опис — переважно
// кирилицею. Не проходить — запис у пост не бере, доки його не перекладуть.
const letters = (t) => [...String(t || '')].filter((c) => /\p{L}/u.test(c));
const cyrillicShare = (t) => {
  const all = letters(t);
  return all.length ? all.filter((c) => /[\u0400-\u04FF]/.test(c)).length / all.length : 0;
};

export function isUkrainianPost(r) {
  if (!/[\u0400-\u04FF]{3,}/.test(r?.title || '')) return false;
  return !r.summary || cyrillicShare(r.summary) >= 0.5;
}

// ── Де ──────────────────────────────────────────────────────────────────
// Одне з пʼяти обовʼязкових полів, а в пості «Нова можливість» його не було
// зовсім (22.09.2026: «чому не зрозуміло, до якої країни відноситься ця
// можливість»). Країни — українською з кодів через Intl, без власного
// словника. Міжнародна програма без конкретної країни (WWOOF, обміни, де
// країна залежить від набору) — «у різних країнах», а не вигадана країна.
const REGION = new Intl.DisplayNames(['uk'], { type: 'region' });
const countryName = (code) => {
  try { return REGION.of(String(code).toUpperCase()); } catch { return null; }
};

export function placeText(r) {
  const countries = abroadCountries(r).map(countryName).filter(Boolean);
  if (countries.length) return countries.slice(0, 3).join(', ');
  // Місто раніше за «у різних країнах»: фестиваль у Львові з іноземними
  // учасниками теж «міжнародний», але відбувається у Львові.
  const cities = realCities(r);
  const hybrid = /hybrid|змішан/i.test(r.format || '');
  if (cities.length) return cities.slice(0, 2).join(', ') + (hybrid ? ' і онлайн' : '');
  if (goesAbroad(r)) return 'у різних країнах';
  if (isOnline(r)) return 'онлайн';
  if (hybrid) return 'онлайн і наживо';
  if ((r.cities || []).some((c) => /вся україна/i.test(c))) return 'по всій Україні';
  return null;
}
