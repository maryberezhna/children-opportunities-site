// Підписи для постів у Telegram: дата подачі й вартість.
// Окремим модулем, щоб їх можна було перевірити тестом — check-deadlines.mjs
// і post-to-telegram.mjs при імпорті одразу йдуть у базу.
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
