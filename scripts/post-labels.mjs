// Підписи для постів: дата подачі, вартість, посилання на сторінку.
// Окремим модулем, щоб їх можна було перевірити тестом — check-deadlines.mjs,
// post-to-telegram.mjs і content-agent.mjs при імпорті одразу йдуть у базу.
import { plural } from '../lib/plural.js';

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
