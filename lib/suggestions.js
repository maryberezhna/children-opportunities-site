/**
 * Пропозиція можливості → чернетка в адмінці.
 *
 * Кнопка «Додати на сайт» на /admin/messages створює чернетку з того, що
 * людина принесла: назва й посилання. Типу й віку ми не знаємо, а база без
 * них запис не прийме (NOT NULL). Тож кладемо технічну заглушку й ставимо
 * позначку STUB_MARK: поки вона є, форма правки показує тип і вік порожніми,
 * і опублікувати запис не вийде, доки людина не обере їх сама. Порожнє поле
 * краще за правдоподібне — «Курс, 0–18» у формі виглядали б як факт.
 *
 * Модуль без аліасу `@/` і без мережі: його читають тести на голому node.
 */
import { createHash } from 'node:crypto';

export const STUB_MARK = 'тип і вік ще не визначено';

/** Чернетка з пропозиції, у якої тип і вік — ще заглушка. */
export const isStubDraft = (opp) =>
  Boolean(opp) && opp.status === 'draft' && String(opp.admin_comment || '').includes(STUB_MARK);

// Хто приніс пропозицію — колонка opportunity_suggestions.origin. До
// 21.09.2026 її не було, і адмінка кожен рядок підписувала «з поп-апа», а в
// 👤 показувала contact. AI Kids Academy, яку принесла Марія, виглядала так,
// ніби її приніс Facebook організації.
export const ORIGINS = {
  popup: { who: null, trace: '💡 пропозиція з форми на сайті' },
  maria: { who: '👤 Марія, внесено вручну', trace: '💡 принесла Марія' },
  research: { who: '🔎 наше дослідження, внесено вручну', trace: '🔎 з нашого дослідження, не з форми' },
};

export const originOf = (s) => (ORIGINS[s?.origin] ? s.origin : 'popup');

// Та сама перевірка, що EMAIL_RE у scraper/process_suggestions.py.
const EMAIL_RE = /^[^@\s]+@[^@\s.]+\.[^@\s]{2,}$/;

/**
 * Чи відповідали ми листом. Лише людині з поп-апа, яка лишила пошту: в
 * рядку, внесеному вручну, contact — це організатор, і лист «дякуємо, що
 * надіслали» йому був би неправдою.
 */
export const repliesByEmail = (s) =>
  originOf(s) === 'popup' && EMAIL_RE.test(String(s?.contact || '').trim());

/**
 * Які листи пішли відправнику — хвіст до підсумку пропозиції в адмінці.
 * published_letter_at (з 21.09.2026) — коли пішов лист «опубліковано» або
 * «уже є на платформі». Дубль чернетки листа одразу не отримує: чернетку сайт
 * не показує, посилання віддало б 404 — лист прийде після публікації.
 */
export function letterNote(s) {
  if (!repliesByEmail(s)) return null;
  const published = Boolean(s.published_letter_at);
  if (s.status === 'duplicate') {
    return published ? 'лист відправнику пішов' : 'лист відправнику піде, щойно запис опублікуємо';
  }
  if (s.status === 'imported') {
    return published
      ? 'опубліковано — відправнику пішли обидва листи'
      : 'лист відправнику пішов, другий — після публікації';
  }
  if (s.status === 'added') {
    return published ? 'опубліковано, лист відправнику пішов' : 'лист відправнику піде після публікації';
  }
  return null;
}

/** Рядок «хто приніс» для /admin/messages. */
export function broughtBy(s) {
  const origin = originOf(s);
  const contact = String(s?.contact || '').trim();
  if (origin === 'popup') {
    return contact
      ? `👤 ${contact} · через поп-ап на сайті`
      : 'без контактів — відповісти не вийде · через поп-ап на сайті';
  }
  return [ORIGINS[origin].who, contact ? `організатор: ${contact}` : null].filter(Boolean).join(' · ');
}

/**
 * «Джерело» запису на сайті. Воно публічне: «Пропозиція від людей» на
 * виплаті міськради, яку знайшло наше дослідження, — неправда. Для внесеного
 * вручну джерело — домен сторінки, як в інших записах дослідження.
 */
export function sourceFor(s, fallback) {
  if (originOf(s) === 'popup') return fallback;
  try {
    return new URL(String(s?.url || '')).hostname.replace(/^www\./, '') || fallback;
  } catch {
    return fallback;
  }
}

/** Зняти позначку, коли людина сама обрала тип і вік. */
export function withoutStubMark(comment) {
  return String(comment || '')
    .split(' · ')
    .filter((part) => !part.includes(STUB_MARK))
    .join(' · ')
    .trim() || null;
}

// Та сама таблиця, що в scraper/normalizer.py (_UK2LAT): слаг — це живий URL,
// і однаковий запис має отримувати однаковий слаг, хай хто його створив.
const UK2LAT = [
  ['зг', 'zgh'],
  ['а', 'a'], ['б', 'b'], ['в', 'v'], ['г', 'h'], ['ґ', 'g'],
  ['д', 'd'], ['е', 'e'], ['є', 'ie'], ['ж', 'zh'], ['з', 'z'],
  ['и', 'y'], ['і', 'i'], ['ї', 'i'], ['й', 'i'], ['к', 'k'],
  ['л', 'l'], ['м', 'm'], ['н', 'n'], ['о', 'o'], ['п', 'p'],
  ['р', 'r'], ['с', 's'], ['т', 't'], ['у', 'u'], ['ф', 'f'],
  ['х', 'kh'], ['ц', 'ts'], ['ч', 'ch'], ['ш', 'sh'], ['щ', 'shch'],
  ['ь', ''], ['ю', 'iu'], ['я', 'ia'], ["'", ''], ['ʼ', ''], ['’', ''],
];

/** «Літня школа МАН» → «litnia-shkola-man-3f9a1c». */
export function slugFromTitle(title, salt = '') {
  let s = String(title || '').toLowerCase();
  for (const [from, to] of UK2LAT) s = s.split(from).join(to);
  s = s.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (s.length > 80) s = s.slice(0, 80).replace(/-[^-]*$/, '');
  const short = createHash('md5').update(`${title}${salt}`).digest('hex').slice(0, 6);
  return `${s || 'mozhlyvist'}-${short}`;
}

/**
 * Ключ дедуплікації — та сама формула, що hubs.content_hash у Python:
 * від URL, а для сторінок-хабів ще й від назви. Без нього нічний скрап,
 * натрапивши на ту саму сторінку, поклав би поряд другий запис.
 */
export function contentHash(title, url, isHub = false) {
  if (isHub) {
    const normalized = String(title || '').toLowerCase()
      .replace(/[^\p{L}\p{N}_\s]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
    return createHash('sha256').update(`${normalized}|${url}`).digest('hex').slice(0, 16);
  }
  return createHash('sha256').update(String(url || '')).digest('hex').slice(0, 16);
}
