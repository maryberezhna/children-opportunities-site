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
