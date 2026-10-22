// Факти сторінки можливості (редизайн, PR 2, 29.09.2026): статус прийому
// заявок для картки дії, сітка ключових фактів, «де», «хто може подати».
// Без React — щоб читалось тестами на голому node, як решта lib/.
//
// Правило «нічого не вигадувати»: чого немає в записі, того немає й на
// сторінці. Дат немає і вид за часом невідомий — статусу немає, блок не
// показується; «Хто може подати заявку» без обставин і вимог — теж.
import { whenState, isExpired } from './timing.js';
import { daysUntil, formatDate, formatEventDates } from './dates.js';
import {
  ageRangeLabel, itemFormatLabel, cityLabel, NEED_LABELS, NEED_LABELS_EN,
} from './labels.js';
import { detailCountries, detailCities } from './place.js';
import { isOnline, isInternational } from './geo.js';
import { publicSource } from './source-link.js';
import { costLabel } from './card-facts.js';

const T = {
  uk: {
    intake: 'Прийом заявок', deadline: 'Заявки до', when: 'Коли', results: 'Результати',
    closed: 'Подачу закрито', annual: 'Щорічно', annualNote: 'стежте за новим набором',
    ongoing: 'Постійно відкритий', running: 'триває',
    age: 'Вік', cost: 'Вартість', format: 'Формат', where: 'Де', organiser: 'Організатор',
    online: 'Онлайн', who: 'Хто може подати',
    elig: {
      from_ukraine: 'Так, можна подати з України',
      abroad_only: 'З України — ні. Можуть діти, які живуть за кордоном',
      none: 'З України — ні. Лише громадяни або резиденти іншої країни',
      unknown: 'Не вказано, чи можна з України — уточнюйте в організатора',
    },
    eligNo: 'З України — ні', eligFor: 'Для кого',
    today: 'сьогодні', tomorrow: 'завтра',
    ageCond: (a) => `Вік ${a}`,
  },
  en: {
    intake: 'Applications', deadline: 'Apply by', when: 'When', results: 'Results',
    closed: 'Applications closed', annual: 'Every year', annualNote: 'watch for the next intake',
    ongoing: 'Always open', running: 'on now',
    age: 'Age', cost: 'Cost', format: 'Format', where: 'Where', organiser: 'Organiser',
    online: 'Online', who: 'Who can apply',
    elig: {
      from_ukraine: 'Yes, children living in Ukraine can apply',
      abroad_only: 'Not from Ukraine. Children living abroad can apply',
      none: 'Not from Ukraine. Citizens or residents of another country only',
      unknown: 'Not stated whether children from Ukraine can apply — check with the organiser',
    },
    eligNo: 'Not from Ukraine', eligFor: 'Who',
    today: 'today', tomorrow: 'tomorrow',
    ageCond: (a) => `Age ${a}`,
  },
};
const tt = (lang) => T[lang] || T.uk;

/**
 * Хто може подати закордонну можливість (Марія, 22.10.2026: «для всіх
 * закордонних можливостей має бути точно вказано, чи може дитина з України
 * подати заявку, якщо ні — чи з діаспори»). Лише для закордонного й
 * міжнародного (lib/geo.js isInternational) або коли поле вже заповнене.
 * Не перевірено (NULL) для закордонного = «не вказано», а не мовчання:
 * батьки мають бачити, що це питання треба уточнити.
 */
export function uaEligibilityText(item, lang = 'uk') {
  const t = tt(lang);
  const v = item?.ua_eligibility || null;
  if (!v && !isInternational(item || {})) return null;
  const base = t.elig[v] || t.elig.unknown;
  const note = String(item?.ua_eligibility_note || '').trim();
  if (!note || !t.elig[v] || v === 'unknown') return base;
  // «З України — ні. Для кого: громадяни або резиденти США» — пояснення
  // замінює загальне «іншої країни», а не дописується до нього.
  return v === 'from_ukraine' ? `${base}. ${note}` : `${t.eligNo}. ${t.eligFor}: ${note}`;
}

/**
 * Статус прийому заявок — для великого рядка в картці дії й для блоку під
 * назвою на телефоні.
 *
 *   { kind, label, value, note?, urgent? }
 *   kind  — 'closed' | 'deadline' | 'event' | 'results' | 'periodic' | 'permanent'
 *   label — надпис («Заявки до», «Прийом заявок», «Коли»)
 *   value — великим («30 вересня 2026», «Постійно відкритий»)
 *   note  — дрібним поруч («сьогодні», «завтра», «триває»)
 *
 * null — дат немає і вид невідомий.
 */
export function intakeStatus(item, todayIso, lang = 'uk') {
  const t = tt(lang);
  // Протерміноване закрите ВІДРАЗУ, не з опівночі наступного дня. Статус у
  // базі міняє нічний lifecycle (05:10 UTC), а GitHub запускає розклад із
  // запізненням до 5–6 годин — тобто щоранку було вікно, коли сторінка
  // показувала «Подати заявку» туди, куди вже не подати (Марія, 01.10.2026).
  //
  // Найгірший випадок — подача минула, а подія попереду: whenState казав
  // «Коли 15–22 листопада», і сторінка виглядала цілком відкритою.
  if (item?.status === 'closed' || isExpired(item, todayIso)) {
    return { kind: 'closed', label: t.intake, value: t.closed };
  }
  const s = whenState(item, todayIso);
  if (s.state === 'deadline') {
    // Лічильника «163 дні» під датою немає: він збивав — читався як тривалість
    // програми, а не час до дедлайну (Марія, 03.10.2026). Лишились тільки
    // «сьогодні» й «завтра»: це слова, не відлік.
    const note = s.days === 0 ? t.today : s.days === 1 ? t.tomorrow : undefined;
    return {
      kind: 'deadline', label: t.deadline, value: formatDate(item.deadline, lang),
      ...(note ? { note } : {}), urgent: s.days <= 7,
    };
  }
  if (s.state === 'event') return { kind: 'event', label: t.when, value: formatEventDates(item, lang) };
  if (s.state === 'running') return { kind: 'event', label: t.when, value: formatEventDates(item, lang), note: t.running };
  if (s.state === 'results') return { kind: 'results', label: t.results, value: formatDate(item.results_date, lang) };
  if (s.state === 'periodic') return { kind: 'periodic', label: t.intake, value: t.annual, note: t.annualNote };
  if (s.state === 'permanent') return { kind: 'permanent', label: t.intake, value: t.ongoing };
  return null;
}

/** «Прага, Чехія» · «Київ» · «Вся Україна» · «Онлайн», інакше null. */
export function whereText(item, lang = 'uk') {
  if (!item) return null;
  const t = tt(lang);
  const countries = detailCountries(item, lang);
  const cities = detailCities(item).map((c) => cityLabel(c, lang));
  if (countries.length) return [...cities, ...countries].join(', ');
  if (cities.length) return cities.join(', ');
  if (isOnline(item)) return t.online;
  return null;
}

/**
 * Сітка ключових фактів: вік, вартість, прийом заявок, формат, де,
 * організатор — і, коли є, дати проведення поруч із дедлайном та дата
 * результатів. Порожні пропускаються.
 */
export function pageFacts(item, todayIso, lang = 'uk') {
  const t = tt(lang);
  const status = intakeStatus(item, todayIso, lang);
  const cost = [costLabel(item, lang), item?.price_note].filter(Boolean).join(' — ');
  const eventDates = formatEventDates(item, lang);
  const facts = [
    { key: 'age', label: t.age, value: ageRangeLabel(item, lang) },
    { key: 'cost', label: t.cost, value: cost || null },
    status ? {
      key: 'intake', label: status.label, value: status.value, note: status.note || null, urgent: Boolean(status.urgent),
    } : null,
    // Подача й проведення — дві різні дати; коли є обидві, показуємо обидві.
    status && status.kind === 'deadline' && eventDates
      ? { key: 'when', label: t.when, value: eventDates } : null,
    status && status.kind !== 'results' && item?.results_date && daysUntil(item.results_date, todayIso) >= 0
      ? { key: 'results', label: t.results, value: formatDate(item.results_date, lang) } : null,
    { key: 'format', label: t.format, value: itemFormatLabel(item, lang) },
    { key: 'where', label: t.where, value: whereText(item, lang) },
    { key: 'who', label: t.who, value: uaEligibilityText(item, lang) },
    // Організатор — завжди з посиланням на його сторінку (Марія, 19.10.2026:
    // «даємо посилання і назву організації, їх сайт»). publicSource ховає
    // назву й адресу чужого каналу-переказувача — тоді рядка просто немає.
    {
      key: 'organiser',
      label: t.organiser,
      value: publicSource(item).sourceName || null,
      href: publicSource(item).sourceUrl || null,
    },
  ];
  return facts.filter((f) => f && f.value);
}

/**
 * «Хто може подати заявку» — лише з наявних полів: вік, обставини дитини
 * (child_needs), вимога для підлітка (teen_requirement). Сам вік уже стоїть
 * у фактах, тож без обставин і вимог список порожній і блок не показується.
 */
export function applicantConditions(item, lang = 'uk') {
  const t = tt(lang);
  const labels = lang === 'en' ? NEED_LABELS_EN : NEED_LABELS;
  const needs = (item?.child_needs || []).map((n) => labels[n]).filter(Boolean);
  const requirement = String(item?.teen_requirement || '').trim();
  if (!needs.length && !requirement) return [];
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const ageLabel = ageRangeLabel(item, lang);
  return [
    // Вік-сентинель (0–18) підпису не має — рядок «Вік » не показуємо.
    ...(ageLabel ? [t.ageCond(ageLabel)] : []),
    ...needs.map(cap),
    ...(requirement ? [cap(requirement)] : []),
  ];
}
