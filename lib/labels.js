// Українські підписи для машинних значень з `opportunities`.
// Жили копіями в OpportunitiesList.js та o/[slug]/page.js; тепер ще й OG-картинки
// їх потребують, тож винесено сюди, щоб три копії не розʼїхались.

export const TYPE_LABELS = {
  course: 'Курс',
  workshop: 'Майстер-клас',
  summer_school: 'Літня школа',
  study_program: 'Навчальна програма',
  mentorship: 'Менторство',
  club: 'Гурток',
  camp: 'Табір',
  olympiad: 'Олімпіада',
  competition: 'Конкурс',
  hackathon: 'Хакатон',
  sport_tournament: 'Спорт. турнір',
  festival: 'Фестиваль',
  award: 'Премія',
  exchange: 'Обмін',
  excursion: 'Екскурсія',
  residency: 'Резиденція',
  scholarship: 'Стипендія',
  grant: 'Грант',
  allowance: 'Виплата',
  support_payment: 'Соц. виплата',
  internship: 'Стажування',
  volunteer: 'Волонтерство',
  conference: 'Конференція',
  medical_aid: 'Мед. допомога',
  psychology: 'Психологія',
  rehabilitation: 'Реабілітація',
  humanitarian: 'Гум. допомога',
  legal_aid: 'Правова допомога',
  shelter: 'Прихисток',
  educational_material: 'Навч. матеріали',
  // legacy aliases
  study_abroad: 'Навчання за кордоном',
  sport_event: 'Спорт',
};

export const AID_TYPE_LABELS = {
  cash: 'держвиплата',
  scholarship: 'соц. стипендія',
  recreation: 'оздоровлення',
  free_activities: 'безкоштовна секція',
  vocational: 'проф. навчання',
};

// Типи, що відкриваються щороку: минулий дедлайн для них не означає «більше ніколи».
// Використовує і каталог (не ховати їх), і сторінка можливості (текст плашки).
export const ANNUAL_TYPES = new Set([
  'olympiad',
  'competition',
  'exchange',
  'scholarship',
  'festival',
  'camp',
  'grant',
  'study_abroad',
]);

export const COST_LABELS = {
  free: 'Безкоштовно',
  partially_free: 'З фінансуванням',
  paid_affordable: 'Доступно',
};

// «7-11 років» / «0-18 років» — та сама логіка, що на картці каталогу.
export function ageLabel(from, to) {
  if (from === to) return `${from} років`;
  if (from === 0 && to >= 17) return '0-18 років';
  return `${from}-${to} років`;
}

// Типи, де дата в полі deadline — це день, коли подія відбувається, а не
// останній день подачі. Для них «Дедлайн» — брехня: подія не закривається,
// вона просто настає.
//
// ⚠️ Це визначення читають І сайт, І бот (scripts/check-deadlines.mjs,
// scripts/post-to-telegram.mjs). Тримати його тут — єдиний спосіб не
// отримати знову ситуацію, коли бот пише «Коли», а картка на сайті поруч
// пише «Дедлайн» про ту саму подію.
//
// competition сюди свідомо НЕ входить: у конкурсів дата майже завжди
// означає останній день подачі роботи.
export const EVENT_TYPES = new Set([
  'camp', 'festival', 'excursion', 'conference', 'hackathon',
  'workshop', 'sport_tournament', 'summer_school',
]);

// Заповнений event_end_date — пряма ознака датованої події, хоч би який тип.
export const isEvent = (item) =>
  EVENT_TYPES.has(item?.opportunity_type) || Boolean(item?.event_end_date);

// Підпис до дати на картці й у пості.
export const dateLabel = (item) => (isEvent(item) ? 'Коли' : 'Дедлайн');

// Формат у базі лежить як прийшов від екстракції: поруч живуть «Онлайн»,
// «offline», «Гібрид» і навіть сміття на кшталт «club» чи назви джерела.
// Показувати це людині сирим не можна, тож зводимо до трьох зрозумілих
// станів, а нерозпізнане ховаємо — краще нічого, ніж «gurtok.org».
export function formatLabel(raw) {
  const v = String(raw || '').toLowerCase().trim();
  if (!v) return null;
  const online = /онлайн|online|дистанц/.test(v);
  const offline = /офлайн|offline|наживо/.test(v);
  if (online && offline) return 'Онлайн і наживо';
  if (/гібрид|hybrid/.test(v)) return 'Онлайн і наживо';
  if (online) return 'Онлайн';
  if (offline) return 'Наживо';
  return null;
}
