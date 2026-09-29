// Поле «Країна» у формі правки (Марія, 29.09.2026: «Країна, Місто, а за
// кордон — окремою опцією»). До того було одне поле «Міста» з підказкою
// «порожньо, якщо за кордоном» — і модератор вписував туди Ньюкасл-апон-Тайн,
// не маючи куди поставити країну.
//
// Одна країна — один код у countries. «За кордоном, різні країни» — це AFS,
// Erasmus і подібні, де країна залежить від набору: countries порожній,
// is_international = true (так їх читає goesAbroad у lib/geo.js). Запис із
// кількома країнами одним вибором не опишеш — його лишаємо як є.
import { KNOWN_COUNTRIES, countryName } from './diaspora.js';

export const ABROAD = 'abroad';
export const MULTI = 'multi';

const codes = (opp) =>
  (opp.countries || []).map((c) => String(c).toLowerCase().trim()).filter(Boolean);

/** Значення селекта для запису. */
export function countryFieldValue(opp = {}) {
  const list = [...new Set(codes(opp))];
  if (list.length === 1) return list[0];
  if (list.length > 1) return MULTI;
  return opp.is_international ? ABROAD : '';
}

/** Пункти селекта: Україна, «за кордоном» окремо, далі країни за абеткою. */
export function countryOptions(opp = {}) {
  const list = [...new Set(codes(opp))];
  const opts = [
    ['', '— не визначено —'],
    ['ua', 'Україна'],
    [ABROAD, 'За кордоном — різні країни'],
    ...KNOWN_COUNTRIES.map(({ code, name }) => [code, name]),
  ];
  // Країна запису, якої немає в нашому списку (uz, is…), мусить лишитись вибраною.
  if (list.length === 1 && !opts.some(([v]) => v === list[0])) {
    opts.push([list[0], countryName(list[0])]);
  }
  if (list.length > 1) {
    opts.splice(1, 0, [MULTI, `Кілька: ${list.map((c) => countryName(c)).join(', ')}`]);
  }
  return opts;
}

/** Що записати в базу за вибором. null — не чіпати. */
export function countryPatch(value) {
  if (typeof value !== 'string' || value === MULTI) return null;
  if (value === ABROAD) return { countries: [], is_international: true };
  if (value === '') return { countries: [] };
  if (!/^[a-z]{2}$/.test(value)) return null;
  return { countries: [value] };
}
