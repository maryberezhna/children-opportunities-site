// Причини «Не підходить» — з lib/reject-reasons.json, який читає й пошук
// (scraper/rejections.py). Тут лише перевірка й текст для журналу.
import data from './reject-reasons.json' with { type: 'json' };

export const REJECT_REASONS = data.reasons;

const BY_CODE = new Map(REJECT_REASONS.map((r) => [r.code, r]));

export const rejectReason = (code) => BY_CODE.get(code) || null;

/**
 * Статус після «Не підходить» — за причиною, не один на всіх (19.10.2026).
 * До того будь-яка відмова ставила archived, а archived — це 307 на головну
 * й зникнення із sitemap: так 12–13.10 зникли FLEX Global з дедлайном за
 * тиждень і перелік олімпіад МОН — лише через «немає цитати на вік».
 */
export const rejectStatus = (code) => rejectReason(code)?.status || 'archived';

/** Чого бракує, щоб відхилити: null — усе гаразд, інакше код помилки. */
export function rejectProblem(code, text = '') {
  const r = rejectReason(code);
  if (!r) return 'bad_reason';
  if (r.needs_text && !String(text || '').trim()) return 'reason_text_required';
  return null;
}

/** Рядок для moderation_notes: людина читає його в журналі й у зведенні. */
export function rejectNoteBody(code, text = '') {
  const r = rejectReason(code);
  const extra = String(text || '').trim();
  return `Не підходить: ${r ? r.label : code}${extra ? `. ${extra}` : ''}`.slice(0, 2000);
}
