/**
 * Чи можливість онлайн — для чипа «Онлайн» і лічильників фільтра «Де».
 *
 * Жила в app/OpportunitiesList.js; винесено 07.10.2026, бо тепер те саме
 * рахує й сервер (lib/catalog-split.js): легкий запис головної їде в браузер
 * без опису, і слово «онлайн» з опису сервер переносить у позначку
 * `online_text`. Без неї чип «Онлайн» недорахувався б записів, у яких про
 * формат сказано лише в описі.
 */
export const ONLINE_RE = /(онлайн|online|дистанц|гібрид|hybrid|zoom|вебінар)/i;

export const isOnline = (item) =>
  ONLINE_RE.test(item.format || '')
  || (item.cities || []).some((c) => ONLINE_RE.test(c))
  || Boolean(item.online_text)
  || ONLINE_RE.test(`${item.title || ''} ${item.summary || ''}`);
