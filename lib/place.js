// Де відбувається закордонний запис — словами, з країною (29.09.2026).
//
// До того картка про будь-що поза Україною писала лише «За кордоном», навіть
// коли в записі були місто й країна, а сторінка можливості — «Місто: Прага»
// без країни. Родині, яка живе в Чехії, «Прага, Чехія» відповідає на питання,
// «За кордоном» — ні.
import { abroadCountries, realCities } from './geo.js';
import { countryName } from './diaspora.js';
import { cityLabel } from './labels.js';

const JUNK_CITY = /за\s+кордон/i;

/** Коди закордонних країн запису, без повторів. */
export const abroadCodes = (o) =>
  [...new Set(abroadCountries(o).map((c) => String(c).toLowerCase().trim()).filter(Boolean))];

/** Запис лише за кордоном: є закордонна країна й немає України. */
export const foreignOnly = (o) =>
  abroadCodes(o).length > 0
  && !(o.countries || []).some((c) => String(c).toLowerCase().trim() === 'ua');

/** Назви закордонних країн: «Чехія» / «Czechia». */
export const abroadCountryNames = (o, lang = 'uk') =>
  abroadCodes(o).map((c) => countryName(c, lang));

/** Рядок «Країна» на сторінці можливості: лише коли є закордонна країна,
 *  і тоді всі країни запису — з Україною, інакше «Країна: Греція, Місто:
 *  Київ» каже, що Київ у Греції. */
export function detailCountries(o, lang = 'uk') {
  if (!abroadCodes(o).length) return [];
  const all = [...new Set((o.countries || []).map((c) => String(c).toLowerCase().trim()).filter(Boolean))];
  return all.map((c) => (c === 'ua' ? (lang === 'en' ? 'Ukraine' : 'Україна') : countryName(c, lang)));
}

/** Міста для рядка «Місто» на сторінці можливості. «за кордоном» — не
 *  місто, а «Міжнародні» поруч із рядком «Країна» нічого не додає. */
export const detailCities = (o) => (o.cities || []).filter((c) => c
  && !JUNK_CITY.test(c)
  && !(abroadCodes(o).length && String(c).toLowerCase().trim() === 'міжнародні'));

/**
 * «Прага, Чехія» · «Чехія» · «Польща, Німеччина» · «Дублін». null — якщо
 * ні міста, ні країни немає і лишається загальне «За кордоном».
 */
export function abroadPlaceText(o, lang = 'uk') {
  const names = abroadCountryNames(o, lang);
  const cities = realCities(o).filter((c) => !JUNK_CITY.test(c)).slice(0, 2)
    .map((c) => cityLabel(c, lang));
  // Україна серед країн: місто українське, і «Київ, Греція» збрехало б, що
  // Київ у Греції (Економічна олімпіада, 29.09.2026).
  if (cities.length && !foreignOnly(o)) return `${cities.join(', ')} ${lang === 'en' ? 'and abroad' : 'і за кордоном'}`;
  if (cities.length && names.length === 1) return `${cities.join(', ')}, ${names[0]}`;
  if (cities.length) return cities.join(', ');
  if (names.length) return names.slice(0, 2).join(', ');
  return null;
}
