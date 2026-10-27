// Пошук місця у фільтрі «Де» (Марія 27.09.2026: «оце треба переробити на
// зручний ручний ввід»). Замість рідного випадного списку з десятками міст —
// поле, у яке місто вписують, а підказки звужуються з кожною літерою.
//
// Тут лише чиста логіка без React: нормалізація, відбір і порядок підказок.
// Сам компонент — app/PlaceCombobox.js, тести — tests/place-search.test.mjs.

// Види місця — чотири групи «для кого за місцем» (lib/reach.js, рішення
// Марії 27.10.2026). Значення ті самі, що в `place` і в URL (?city=diaspora).
export const PLACE_KINDS = ['ukraine', 'online', 'diaspora', 'travel'];

// Дві закордонні групи: їх звужує вибрана країна.
export const ABROAD_KINDS = ['diaspora', 'travel'];

// Країна за кордоном — окреме значення «Де» (Марія 29.09.2026: «якщо
// закордон — має бути змога вибрати певну країну»). У URL: ?city=country:de.
export const COUNTRY_PREFIX = 'country:';
export const isCountryValue = (v) => String(v).startsWith(COUNTRY_PREFIX);
export const countryValue = (code) => `${COUNTRY_PREFIX}${code}`;

/**
 * Старі адреси: до 27.10.2026 закордон був одним видом — ?city=abroad, а ще
 * раніше ?city=Міжнародні. Тепер це дві групи: «Живемо за кордоном» і
 * «Поїхати за кордон». Посилання з постів і закладок мусять працювати далі.
 */
export function expandLegacyPlace(list) {
  const out = [];
  for (const v of list) {
    const next = v === 'abroad' || v === 'Міжнародні' ? ABROAD_KINDS : [v];
    next.forEach((x) => { if (!out.includes(x)) out.push(x); });
  }
  return out;
}

/** Вибір у «Де»: повторний вибір знімає, решта додається до обраних. */
export function pickPlace(list, v) {
  if (list.includes(v)) return list.filter((x) => x !== v);
  return [...list, v];
}

/**
 * Чи підходить запис під вибране «Де».
 *   reach — група запису (reachOf), codes — його закордонні країни,
 *   cityMatch(v) — чи підходить місто v (логіка міст лишається в списку).
 * Групи й міста між собою — «або». Країна звужує вибрані закордонні групи:
 * «Живемо за кордоном» + «Польща» — діаспора в Польщі, а не вся діаспора
 * плюс поїздки до Польщі. Країна без групи — усе, що в цій країні.
 */
export function placeMatches(place, { reach, codes = [], cityMatch = () => false }) {
  if (!place || !place.length) return true;
  const kinds = expandLegacyPlace(place.filter((v) => PLACE_KINDS.includes(v) || v === 'abroad'));
  const countries = place.filter(isCountryValue).map((v) => v.slice(COUNTRY_PREFIX.length));
  const cities = place.filter((v) => !PLACE_KINDS.includes(v) && v !== 'abroad' && !isCountryValue(v));
  if (cities.some(cityMatch)) return true;
  if (countries.length) {
    const abroad = kinds.filter((k) => ABROAD_KINDS.includes(k));
    if (countries.some((c) => codes.includes(c)) && (!abroad.length || abroad.includes(reach))) return true;
    return kinds.filter((k) => !ABROAD_KINDS.includes(k)).includes(reach);
  }
  return kinds.includes(reach);
}

// Чим ще людина може назвати вид місця, крім підпису. Шукаємо обома мовами
// незалежно від мови сторінки: хтось друкує «online» і на українській.
export const KIND_TERMS = {
  ukraine: ['В Україні', 'Україна', 'Вся Україна', 'In Ukraine', 'Ukraine'],
  online: ['Онлайн для всіх', 'Онлайн', 'Online', 'Дистанційно'],
  diaspora: ['Живемо за кордоном', 'Living abroad', 'Діаспора', 'Diaspora', 'За кордоном', 'Abroad'],
  travel: ['Поїхати за кордон', 'Going abroad', 'Закордон', 'Поїздка', 'Міжнародні', 'International', 'Abroad'],
};

// Апострофи окремо: «ʼ» (U+02BC) Юнікод вважає літерою.
const APOSTROPHE = /['ʼ’‘`´ʹ]/u;
const LETTER = /[\p{L}\p{N}]/u;
const SPACE = /[\s\-‐-―_/.,]/u;

// Нормалізований текст і для кожного його символу — індекс у вихідному
// рядку (щоб підсвітити збіг у підписі, де є емодзі й апострофи).
function normalizeWithMap(value) {
  const src = String(value ?? '');
  let text = '';
  const map = [];
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (APOSTROPHE.test(ch)) continue;
    if (LETTER.test(ch)) {
      const low = ch.toLowerCase();
      for (let k = 0; k < low.length; k += 1) {
        text += low[k];
        map.push(i);
      }
    } else if (SPACE.test(ch)) {
      // Пробіл, дефіс і схожі — один пробіл: «Івано-Франківськ» знаходиться
      // і як «івано франк», і як «франк».
      if (text && !text.endsWith(' ')) {
        text += ' ';
        map.push(i);
      }
    }
    // Решта — апострофи (ʼ ' ’), емодзі, прапорці — зникає: «Камʼянське»,
    // «Кам'янське» і «Камянське» однакові.
  }
  if (text.endsWith(' ')) {
    text = text.slice(0, -1);
    map.pop();
  }
  return { text, map };
}

/** Рядок для порівняння: малі літери, без апострофів, емодзі й зайвих пробілів. */
export function normalizePlace(value) {
  return normalizeWithMap(value).text;
}

/**
 * Де у підписі стоїть введене — [початок, кінець) у вихідному рядку, або
 * null. Потрібно лише для підсвітки: збіг міг статися й за англійською
 * назвою, якої в підписі немає, — тоді просто без підсвітки.
 */
export function matchRange(label, query) {
  const q = normalizePlace(query);
  if (!q) return null;
  const { text, map } = normalizeWithMap(label);
  const at = text.indexOf(q);
  if (at < 0) return null;
  return [map[at], map[at + q.length - 1] + 1];
}

// 0 — назва вписана повністю, 1 — назва починається з введеного, 2 — з нього
// починається одне зі слів («кордон» → «За кордоном»), 3 — просто входить у
// назву. null — не підходить.
function rankTerm(term, q) {
  const n = normalizePlace(term);
  if (!n) return null;
  if (n === q) return 0;
  if (n.startsWith(q)) return 1;
  if (n.includes(` ${q}`)) return 2;
  if (n.includes(q)) return 3;
  return null;
}

/**
 * Підказки для поля «Де».
 *
 * options — [{ value, label, terms, kind }]: label — підпис мовою сторінки,
 * terms — усі назви, за якими місце шукається (українська й англійська),
 * kind — вид місця (закордон / Україна / онлайн), а не місто.
 *
 * Порожнє поле — усе одразу, щоб поле лишалось і звичайним списком: спершу
 * види місця (якщо kindsWhenEmpty), далі міста від найбільшої кількості
 * можливостей. З текстом — лише те, що підходить: спершу назва, вписана
 * повністю, далі збіг із початку назви, з початку слова, всередині; при
 * рівності — де більше можливостей, далі за абеткою.
 */
export function filterPlaces(options, query, {
  counts = {}, exclude = [], kindsWhenEmpty = true,
} = {}) {
  const skip = new Set(exclude);
  const pool = (options || []).filter((o) => !skip.has(o.value));
  const count = (o) => counts[o.value] || 0;
  const byCount = (a, b) => (count(b) - count(a))
    || String(a.label).localeCompare(String(b.label), 'uk');
  const q = normalizePlace(query);

  if (!q) {
    const kinds = kindsWhenEmpty ? pool.filter((o) => o.kind) : [];
    // Обрано закордон чи країну — далі людина вибирає країну: країни йдуть
    // першими, а не після сотні київських записів.
    const abroadMode = exclude.some((v) => ABROAD_KINDS.includes(v) || isCountryValue(v));
    const countries = abroadMode ? pool.filter((o) => o.country).sort(byCount) : [];
    const rest = pool.filter((o) => !o.kind && !(abroadMode && o.country)).sort(byCount);
    return [...kinds, ...countries, ...rest];
  }

  const ranked = [];
  for (const o of pool) {
    let best = null;
    for (const term of [o.label, ...(o.terms || [])]) {
      const r = rankTerm(term, q);
      if (r !== null && (best === null || r < best)) best = r;
      if (best === 0) break;
    }
    if (best !== null) ranked.push([best, o]);
  }
  ranked.sort(([ra, a], [rb, b]) => (ra - rb) || byCount(a, b));
  return ranked.map(([, o]) => o);
}

/**
 * Опція для filterPlaces з пари назв. Для видів місця до назв додаються
 * синоніми з KIND_TERMS.
 */
export function placeOption(value, uk, en, lang = 'uk') {
  const kind = PLACE_KINDS.includes(value);
  return {
    value,
    label: lang === 'en' ? en : uk,
    terms: [uk, en, ...(kind ? KIND_TERMS[value] : [])].filter(Boolean),
    kind,
    country: isCountryValue(value),
  };
}

/**
 * Що показувати в полі під видами місця: нічого, міста, країни чи все.
 *
 * Правило Марії (30.09.2026): спершу вид місця, і лише після «В Україні» чи
 * закордонної групи — поле вибору. «В Україні» → міста, «Живемо за кордоном»
 * чи «Поїхати за кордон» → країни. Онлайн поля не відкриває.
 *
 * `place` — обрані значення фільтра (види місця, міста, `country:<код>`).
 */
export function placeFieldMode(place = []) {
  const abroad = place.some((v) => ABROAD_KINDS.includes(v) || v === 'abroad');
  const ukraine = place.includes('ukraine');
  const picked = place.some((v) => !PLACE_KINDS.includes(v) && v !== 'abroad');
  if (abroad && !ukraine) return 'country';
  if (ukraine && !abroad) return 'city';
  // Обидва разом — показуємо все; те саме, коли місто вже обрано (сторінка
  // міста чи посилання з фільтром), інакше зняти його було б нічим.
  if (abroad || ukraine || picked) return 'both';
  return null;
}
