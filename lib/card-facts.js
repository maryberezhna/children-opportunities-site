// Факти для нової картки можливості (варіант B A/B-тесту, 29.09.2026): час,
// вартість, формат із місцем, організатор. Без React — щоб читалось тестами
// на голому node, як решта lib/.
//
// Правило «нічого не вигадувати»: чого немає в записі, того немає й на картці.
// Рядок без значення не рендериться. Дат немає і вид за часом невідомий —
// жодного «набір відкритий»: це припущення, а не факт із запису.
//
// Без емодзі: у бренд-кіті єдина емодзі — 🧡, а ⏰ ⏳ 📅 лишаються в старій
// картці (варіант A), поки тест не скінчиться.
import { whenState } from './timing.js';
import { itemFormatLabel, cityLabel, COST_LABELS } from './labels.js';
import { goesAbroad, realCities, isOnline } from './geo.js';
import { abroadPlaceText } from './place.js';
import { publicSource } from './source-link.js';
import { plural } from './plural.js';

const MONTHS = {
  uk: ['січ', 'лют', 'бер', 'квіт', 'трав', 'черв', 'лип', 'сер', 'вер', 'жовт', 'лист', 'груд'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

const COST = {
  uk: COST_LABELS,
  en: {
    free: 'Free',
    paid_affordable: 'Paid',
    paid_premium: 'Paid',
    ask_school: 'Ask the school about the price',
  },
};

export const CARD_LABELS = {
  uk: {
    deadline: 'Дедлайн', when: 'Коли', results: 'Результати', intake: 'Подача',
    cost: 'Вартість', format: 'Формат', organiser: 'Організатор',
    details: 'Детальніше ↗',
    today: 'сьогодні', tomorrow: 'завтра', running: 'триває',
    periodic: 'щорічно', permanent: 'набір відкритий', abroad: 'За кордоном', online: 'Онлайн',
    left: (n) => `${n} ${plural(n, 'день', 'дні', 'днів')}`,
    until: (d) => `До ${d}`,
  },
  en: {
    deadline: 'Deadline', when: 'When', results: 'Results', intake: 'Applications',
    cost: 'Cost', format: 'Format', organiser: 'Organiser',
    details: 'Details ↗',
    today: 'today', tomorrow: 'tomorrow', running: 'on now',
    periodic: 'every year', permanent: 'enrolment open', abroad: 'Abroad', online: 'Online',
    left: (n) => `${n} ${n === 1 ? 'day' : 'days'}`,
    until: (d) => `By ${d}`,
  },
};

const labels = (lang) => CARD_LABELS[lang] || CARD_LABELS.uk;

/** «3 жовт», а якщо рік не поточний — «3 жовт 2027». */
export function shortDate(iso, todayIso, lang = 'uk') {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  if (!m) return null;
  const months = MONTHS[lang] || MONTHS.uk;
  const year = m[1] === String(todayIso || '').slice(0, 4) ? '' : ` ${m[1]}`;
  return `${Number(m[3])} ${months[Number(m[2]) - 1]}${year}`;
}

/**
 * Рядок про час для блоку деталей і для нижнього рядка на телефоні.
 *
 *   { label, kind, text, foot }
 *   label — підпис рядка («Дедлайн», «Коли», «Результати», «Подача»);
 *   kind  — 'urgent' (≤ 7 днів до дедлайну), 'soon' (≤ 30), 'calm', 'event';
 *   text  — значення в блоці деталей («3 жовт · 4 дні», «15 жовт»);
 *   foot  — те саме для рядка внизу мобільної картки («До 3 жовт · 4 дні»).
 *
 * null — дат немає і вид за часом невідомий: рядок не показуємо.
 */
export function whenLabel(item, todayIso, lang = 'uk') {
  const t = labels(lang);
  const s = whenState(item, todayIso);
  if (s.state === 'deadline') {
    const date = shortDate(item.deadline, todayIso, lang);
    const left = s.days === 0 ? t.today : s.days === 1 ? t.tomorrow : t.left(s.days);
    if (s.days <= 30) {
      return {
        label: t.deadline,
        kind: s.days <= 7 ? 'urgent' : 'soon',
        text: `${date} · ${left}`,
        foot: `${t.until(date)} · ${left}`,
      };
    }
    // Далека дата — без лічильника днів: «через 140 днів» нічого не каже.
    return { label: t.deadline, kind: 'calm', text: date, foot: t.until(date) };
  }
  if (s.state === 'event') {
    const date = shortDate(s.date, todayIso, lang);
    return { label: t.when, kind: 'event', text: date, foot: date };
  }
  if (s.state === 'running') return { label: t.when, kind: 'event', text: t.running, foot: t.running };
  if (s.state === 'results') {
    const date = shortDate(s.date, todayIso, lang);
    return { label: t.results, kind: 'calm', text: date, foot: `${t.results}: ${date}` };
  }
  if (s.state === 'periodic') return { label: t.intake, kind: 'calm', text: t.periodic, foot: t.periodic };
  if (s.state === 'permanent') return { label: t.intake, kind: 'calm', text: t.permanent, foot: t.permanent };
  return null;
}

/** «Безкоштовно» / «Платно» / «Вартість уточнюйте в школі», інакше null. */
export function costLabel(item, lang = 'uk') {
  const map = COST[lang] || COST.uk;
  return map[item?.cost_type] || null;
}

/**
 * Рядок «формат · місце» — той самий, що вже стоїть унизу картки в каталозі
 * (placeText + itemFormatLabel в app/OpportunitiesList.js). Географію не
 * переробляємо (Марія, 29.09.2026: «залишаємо як ми робили, то просто
 * макет»): за кордоном — місто й країна з lib/place.js, інакше справжні
 * міста, а без них підпис «Вся Україна» чи «Онлайн» із самих даних.
 * Виплатам формат не показуємо (lib/labels.js), лишається місто.
 */
export function formatPlace(item, lang = 'uk') {
  if (!item) return null;
  const t = labels(lang);
  const format = itemFormatLabel(item, lang);
  let place = null;
  if (goesAbroad(item)) {
    place = abroadPlaceText(item, lang) || t.abroad;
  } else {
    const real = realCities(item);
    if (real.length) {
      place = real.slice(0, 2).map((c) => cityLabel(c, lang)).join(', ');
    } else if ((item.cities || []).some((c) => /вся україна/i.test(c))) {
      place = cityLabel('Вся Україна', lang);
    } else if (!format && isOnline(item)) {
      // Формату немає, але серед «міст» стоїть «Онлайн» — це і є відповідь.
      // Коли формат є, «Онлайн» поруч із «Онлайн і на місці» лише повторює.
      place = t.online;
    }
  }
  // Set: в онлайн-записів формат і «місто» однакові — без «Онлайн · Онлайн».
  const parts = [...new Set([format, place].filter(Boolean))];
  return parts.length ? parts.join(' · ') : null;
}

/** Назва організатора. Чужий Telegram-канал і канали-переказувачі — null
 *  (lib/source-link.js, рішення 27.09.2026). */
export function organiserName(item) {
  return publicSource(item).sourceName || null;
}

/** Усі факти картки разом. Кожне поле може бути null — тоді рядка немає. */
export function cardFacts(item, todayIso, lang = 'uk') {
  return {
    when: whenLabel(item, todayIso, lang),
    cost: costLabel(item, lang),
    format: formatPlace(item, lang),
    organiser: organiserName(item),
  };
}
