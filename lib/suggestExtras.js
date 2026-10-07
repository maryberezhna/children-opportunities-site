// Вік і дати у формі «Запропонувати можливість» (Марія, 07.10.2026: «вік
// учасників і початок або кінець, або можливість доступна завжди»).
//
// Навіщо. З 03.10.2026 запис на сайт не пускає лише одне — брак дати в
// програми з датами (lib/publish-gate.js). Пропозиція без віку й дат лягала
// чернеткою-заглушкою, і модератор дошукував їх сам. Організатор знає це
// напевно, тож питаємо його одразу.
//
// Окремих колонок в opportunity_suggestions немає: відповіді лягають рядками
// в коментар — їх бачать «Звернення», сповіщення адміну й чернетка. На сайт
// вони самі не потрапляють: вік і дати в записі — лише зі сторінки
// організатора, як і раніше.

const AGE_MAX = 99;

const readAge = (v) => {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isInteger(n) && n >= 0 && n <= AGE_MAX ? n : NaN;
};

const readDate = (v) => {
  const s = String(v ?? '').trim();
  if (!s) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) ? s : NaN;
};

/** Поля з тіла запиту чи стану форми — у перевірений вигляд. */
export function readExtras(b = {}) {
  const always = b.always === true;
  return {
    ageFrom: readAge(b.ageFrom),
    ageTo: readAge(b.ageTo),
    // Доступна завжди — дати не потрібні й не зберігаються.
    start: always ? null : readDate(b.start),
    end: always ? null : readDate(b.end),
    always,
  };
}

/**
 * Чого бракує: 'age', 'dates' або null.
 * Вік — хоч одна межа. Дати — початок або кінець, або «доступна завжди».
 */
export function extrasProblem(x) {
  if (Number.isNaN(x.ageFrom) || Number.isNaN(x.ageTo)) return 'age';
  if (x.ageFrom === null && x.ageTo === null) return 'age';
  if (x.ageFrom !== null && x.ageTo !== null && x.ageFrom > x.ageTo) return 'age';
  if (x.always) return null;
  if (Number.isNaN(x.start) || Number.isNaN(x.end)) return 'dates';
  if (x.start === null && x.end === null) return 'dates';
  if (x.start && x.end && x.start > x.end) return 'dates';
  return null;
}

const uaDate = (iso) => iso.split('-').reverse().join('.');

/** Рядки для коментаря пропозиції. */
export function extrasLines(x) {
  const age = x.ageFrom !== null && x.ageTo !== null
    ? `${x.ageFrom}–${x.ageTo}`
    : x.ageFrom !== null ? `від ${x.ageFrom}` : `до ${x.ageTo}`;
  const when = x.always
    ? 'доступна завжди'
    : [x.start ? `початок ${uaDate(x.start)}` : null, x.end ? `кінець ${uaDate(x.end)}` : null]
      .filter(Boolean).join(', ');
  return [`👧 Вік учасників: ${age}`, `📅 Коли: ${when}`];
}
