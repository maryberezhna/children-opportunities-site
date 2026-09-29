// Пошук місця у фільтрі «Де» (Марія 27.09.2026: «оце треба переробити на
// зручний ручний ввід»). Замість рідного випадного списку з десятками міст —
// поле, у яке місто вписують, а підказки звужуються з кожною літерою.
//
// Тут лише чиста логіка без React: нормалізація, відбір і порядок підказок.
// Сам компонент — app/PlaceCombobox.js, тести — tests/place-search.test.mjs.

// Види місця — три чипи в мобільній шторці. Значення ті самі, що в `place`
// і в URL (?city=abroad), тож нічого нового фільтр не вчить.
export const PLACE_KINDS = ['abroad', 'ukraine', 'online'];

// Країна за кордоном — окреме значення «Де» (Марія 29.09.2026: «якщо
// закордон — має бути змога вибрати певну країну»). У URL: ?city=country:de.
export const COUNTRY_PREFIX = 'country:';
export const isCountryValue = (v) => String(v).startsWith(COUNTRY_PREFIX);
export const countryValue = (code) => `${COUNTRY_PREFIX}${code}`;

/**
 * Вибір у «Де». Решта місць додається до обраних («або»), але країна
 * звужує закордон: «За кордоном» + «Німеччина» мало б означати Німеччину,
 * а «або» дало б увесь закордон. Тому країна заміняє «За кордоном», а
 * «За кордоном» — вибрані країни. Повторний вибір знімає.
 */
export function pickPlace(list, v) {
  if (list.includes(v)) return list.filter((x) => x !== v);
  if (isCountryValue(v)) return [...list.filter((x) => x !== 'abroad'), v];
  if (v === 'abroad') return [...list.filter((x) => !isCountryValue(x)), v];
  return [...list, v];
}

// Чим ще людина може назвати вид місця, крім підпису. Шукаємо обома мовами
// незалежно від мови сторінки: хтось друкує «online» і на українській.
// «Міжнародні» — стара назва закордону в URL (?city=Міжнародні).
export const KIND_TERMS = {
  abroad: ['За кордоном', 'Закордон', 'Abroad', 'Міжнародні', 'International'],
  ukraine: ['Україна', 'Вся Україна', 'Ukraine'],
  online: ['Онлайн', 'Online', 'Дистанційно'],
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
    const abroadMode = exclude.some((v) => v === 'abroad' || isCountryValue(v));
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
