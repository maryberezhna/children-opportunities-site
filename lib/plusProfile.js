/**
 * Профіль Dityam+ і добір можливостей під нього.
 *
 * Навіщо окремий модуль. Добирають у трьох місцях: бот на кнопку «Останні
 * можливості», дайджест раз на два тижні і нагадування про дедлайни. Перші
 * одне на JS, два інші на Python (`scraper/plus_profile.py`). Коли логіка
 * жила копіями в кожному, вони розходились. Тепер правила тут, а Python-
 * дзеркало тримається тими самими тестами (tests/plusProfile.test.mjs і
 * scraper/tests/test_plus_profile.py).
 *
 * Модель (14.09.2026):
 *   родина — де шукати (places) і чи показувати платне (cost_pref);
 *   кожна дитина — вік, вподобання, формат участі й особливі обставини.
 *
 * Модуль без аліасу `@/` і без мережі: його читають тести на голому node.
 */

export const MAX_CHILDREN = 6;

export const AGE_OPTIONS = [
  ['0-3', '0–3 р.'], ['4-6', '4–6 р.'], ['7-10', '7–10 р.'],
  ['11-14', '11–14 р.'], ['15-18', '15–18 р.'],
];
const AGE_RANGES = {
  '0-3': [0, 3], '4-6': [4, 6], '7-10': [7, 10], '11-14': [11, 14], '15-18': [15, 18],
};

// Вподобання — лише теми. Формат участі й місце питаємо окремо: раніше вони
// лежали в одному списку з «Творчістю», і «Табори» означали і тему, і формат.
export const LIKE_OPTIONS = [
  ['stem', 'STEM/IT'], ['arts', 'Творчість'], ['sport', 'Спорт'],
  ['languages', 'Мови'], ['soft_skills', 'Soft skills'], ['career', "Кар'єра"],
  // Додано 19.09.2026: шести тем не вистачало на те, що реально є в базі.
  ['nature', 'Природа й тварини'], ['health', "Медицина й здоровʼя"],
  ['history', 'Історія й культура'], ['business', 'Підприємництво'],
];

export const FORMAT_OPTIONS = [
  ['clubs', 'Гуртки й курси'],
  ['camps', 'Табори й літні школи'],
  ['contests', 'Конкурси й олімпіади'],
  ['grants', 'Стипендії, гранти й обміни'],
  // Додано 19.09.2026. До того чотири формати не покривали 66 активних
  // записів (виплати, психологія, реабілітація, медична й гуманітарна
  // допомога, волонтерство, стажування, прихисток, навчальні матеріали):
  // людина, яка обрала хоч один формат, не отримувала їх узагалі.
  ['support', 'Психолог, реабілітація, здоровʼя'],
  ['family_aid', 'Виплати й допомога родині'],
  ['volunteering', 'Волонтерство й стажування'],
];

// Формат визначаємо насамперед за типом запису. Тема з ключових слів —
// запасний шлях: тип проставляє модель, і «табір» іноді лежить як інший тип.
export const FORMAT_TYPES = {
  clubs: ['club', 'course', 'workshop', 'study_program', 'mentorship', 'educational_material'],
  camps: ['camp', 'summer_school', 'excursion'],
  contests: ['competition', 'olympiad', 'hackathon', 'sport_tournament', 'festival', 'award', 'conference', 'sport_event'],
  grants: ['scholarship', 'grant', 'exchange', 'residency', 'study_abroad'],
  support: ['psychology', 'rehabilitation', 'medical_aid'],
  family_aid: ['allowance', 'support_payment', 'humanitarian', 'shelter', 'legal_aid'],
  volunteering: ['volunteer', 'internship'],
};
const FORMAT_THEMES = {
  clubs: ['format', 'nonformal'], camps: ['camps'], contests: ['contests'], grants: [],
  support: [], family_aid: [], volunteering: [],
};

// Назви — ті самі, що в мітках на картці можливості (app/o/shared.js).
// Лише ті обставини, якими конвеєр реально позначає записи.
export const NEED_OPTIONS = [
  ['gifted', 'Обдаровані'],
  ['disability', 'Інвалідність'],
  ['idp', 'ВПО'],
  ['veteran_family', 'Діти захисників і захисниць'],
  ['frontline', 'З прифронтових'],
  ['orphan', 'Сироти'],
  ['low_income', 'Малозабезпечені'],
  ['large_family', 'Багатодітні'],
  ['oncology', 'Онкохворі'],
];

export const PLACE_ONLINE = 'online';
export const PLACE_ABROAD = 'abroad';
export const PLACE_OTHER = '__other';     // «мого міста немає в списку»
export const PSEUDO_CITIES = new Set(['Онлайн', 'Вся Україна', 'Міжнародні']);

export function ageOverlap(from, to, bands) {
  if (!bands || !bands.length) return true;
  return bands.some((b) => {
    const r = AGE_RANGES[b];
    return Boolean(r) && from <= r[1] && to >= r[0];
  });
}

export function formatsOf(o, themes) {
  const out = new Set();
  for (const [key, types] of Object.entries(FORMAT_TYPES)) {
    if (types.includes(o.opportunity_type) || FORMAT_THEMES[key].some((t) => themes.has(t))) {
      out.add(key);
    }
  }
  return out;
}

/**
 * Чи підходить місце. Порожній вибір — будь-де.
 * «Вся Україна» підходить кожному, хто шукає в Україні, хай яке місто обрав.
 * Запис без жодної позначки місця при непорожньому виборі НЕ підходить:
 * вгадувати, де він, ми не будемо.
 */
export function placeOk(o, places) {
  if (!places || !places.length) return true;
  const want = new Set(places);
  const cities = o.cities || [];
  if (want.has(PLACE_ONLINE)
      && (o.format === 'online' || o.format === 'hybrid' || cities.includes('Онлайн'))) return true;
  if (want.has(PLACE_ABROAD)
      && (o.is_international
        || (o.countries || []).some((c) => c && c !== 'ua')
        || cities.includes('Міжнародні'))) return true;
  const real = places.filter((p) => p !== PLACE_ONLINE && p !== PLACE_ABROAD && p !== PLACE_OTHER);
  if ((real.length || want.has(PLACE_OTHER)) && cities.includes('Вся Україна')) return true;
  return real.some((c) => cities.includes(c));
}

/**
 * Чи підходить запис дитині: null — ні, 'need' — через особливу обставину,
 * 'profile' — через вподобання й формат.
 *
 * Особлива обставина відкриває запис навіть поза вподобаннями: програма
 * реабілітації чи виплата ВПО не має теми «STEM», але саме її батьки й
 * чекають, коли вказали обставину. Вік при цьому перевіряємо завжди.
 */
export function childMatch(child, o, themes) {
  if (!ageOverlap(o.age_from, o.age_to, child.age_bands)) return null;
  const needs = child.needs || [];
  if (needs.length && (o.child_needs || []).some((n) => needs.includes(n))) return 'need';
  const likes = child.likes || [];
  if (likes.length && !likes.some((l) => themes.has(l))) return null;
  const formats = child.formats || [];
  if (formats.length) {
    const has = formatsOf(o, themes);
    if (!formats.some((f) => has.has(f))) return null;
  }
  return 'profile';
}

const EMPTY_CHILD = { position: 1, age_bands: [], likes: [], formats: [], needs: [] };

/**
 * Діти підписника. Якщо окремих профілів ще немає, а в самому рядку є старі
 * вік та інтереси — будуємо з них одну дитину. Так працюють підписники, які
 * пройшли анкету до 14.09.2026, і вебформа, що пише ще у старі поля.
 */
export function childrenOf(sub, rows) {
  const own = (rows || [])
    .filter((r) => r.subscriber_id === sub.id)
    .sort((a, b) => a.position - b.position);
  if (own.length) return own;
  const interests = sub.interests || [];
  const bands = sub.age_bands || [];
  if (!bands.length && !interests.length) return [EMPTY_CHILD];
  const likeKeys = new Set(LIKE_OPTIONS.map(([k]) => k));
  const formats = [];
  if (interests.some((i) => i === 'format' || i === 'nonformal')) formats.push('clubs');
  if (interests.includes('camps')) formats.push('camps');
  if (interests.includes('contests')) formats.push('contests');
  return [{
    position: 1, age_bands: bands, likes: interests.filter((i) => likeKeys.has(i)), formats, needs: [],
  }];
}

/** «Дитина 2 (11–18 р.)». Для єдиної дитини підпис не потрібен. */
export function childLabel(child, count) {
  if (count <= 1) return '';
  const ranges = (child.age_bands || []).map((b) => AGE_RANGES[b]).filter(Boolean);
  const span = ranges.length
    ? `${Math.min(...ranges.map((r) => r[0]))}–${Math.max(...ranges.map((r) => r[1]))} р.`
    : '';
  return `Дитина ${child.position}${span ? ` (${span})` : ''}`;
}

/**
 * Усі записи, що підходять хоч одній дитині родини. Кожен — один раз, із
 * переліком дітей, яким підходить. Порядок вхідного списку зберігається,
 * лише записи через особливу обставину піднімаються нагору.
 */
export function matchFamily(sub, children, opps, themesOf) {
  const kids = children && children.length ? children : [EMPTY_CHILD];
  const freeOnly = sub.cost_pref === 'free_only';
  const byNeed = [];
  const rest = [];
  for (const o of opps) {
    if (freeOnly && o.cost_type !== 'free') continue;
    if (!placeOk(o, sub.places)) continue;
    const themes = themesOf(o);
    const hits = [];
    let viaNeed = false;
    for (const k of kids) {
      const m = childMatch(k, o, themes);
      if (m) {
        hits.push(k);
        if (m === 'need') viaNeed = true;
      }
    }
    if (hits.length) (viaNeed ? byNeed : rest).push({ o, kids: hits, viaNeed });
  }
  return [...byNeed, ...rest];
}

/**
 * Скільки влізе в одне повідомлення — ділимо по черзі між дітьми. Інакше
 * дитина з ширшими вподобаннями забирала б усі місця, а друга не отримала б
 * нічого.
 */
export function pickFair(matches, children, max) {
  if (!children || children.length <= 1) return matches.slice(0, max);
  const queues = children.map((c) => matches.filter((m) => m.kids.includes(c)));
  const taken = new Set();
  const out = [];
  let progressed = true;
  while (out.length < max && progressed) {
    progressed = false;
    for (const q of queues) {
      if (out.length >= max) break;
      while (q.length && taken.has(q[0])) q.shift();
      const m = q.shift();
      if (m) {
        taken.add(m);
        out.push(m);
        progressed = true;
      }
    }
  }
  return out;
}
