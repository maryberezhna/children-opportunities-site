// Один підпис «де» замість трьох полів, у яких зараз лежить географія.
//
// Дані розкидані: cities містить і справжні міста, і «Онлайн», і «Вся
// Україна», і «Міжнародні»; countries — країну фізичного перебування;
// is_international — рівень можливості незалежно від формату.
//
// Пріоритет підпису — від найважливішого для батька до найзагальнішого:
// чи треба кудись їхати → куди саме → чи можна з дому → чи це всюди.
// «За кордоном» стоїть першим свідомо: це єдина відповідь, яка змінює
// планування родини на місяці вперед.

const PSEUDO_CITIES = new Set(['онлайн', 'вся україна', 'міжнародні', 'україна']);

const isOnline = (o) =>
  /онлайн|online|дистанц/i.test(o.format || '')
  || (o.cities || []).some((c) => /онлайн|online/i.test(c));

const realCities = (o) =>
  (o.cities || []).filter((c) => !PSEUDO_CITIES.has(String(c).toLowerCase().trim()));

const abroadCountries = (o) =>
  (o.countries || []).filter((c) => String(c).toLowerCase() !== 'ua');

/** Чи дитина фізично їде за межі України. */
export function goesAbroad(o) {
  if (abroadCountries(o).length) return true;
  // Країна не проставлена, але можливість міжнародна й не дистанційна —
  // це AFS, Erasmus та подібні, де країна залежить від конкретного набору.
  return Boolean(o.is_international) && !isOnline(o);
}

/** Короткий підпис місця для картки й списку. */
export function placeLabel(o) {
  if (goesAbroad(o)) return 'За кордоном';
  const cities = realCities(o);
  if (cities.length) return cities.slice(0, 2).join(', ');
  if (isOnline(o)) return 'Онлайн';
  if ((o.cities || []).some((c) => /вся україна/i.test(c))) return 'Вся Україна';
  return null;
}

/** Мітка «Міжнародна» показується й тоді, коли їхати нікуди не треба:
 *  онлайн-конкурс від закордонного організатора лишається міжнародним. */
export const isInternational = (o) => Boolean(o.is_international) || goesAbroad(o);
