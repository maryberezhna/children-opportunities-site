// easy.gov.ua — перший державний агрегатор можливостей для молоді
// API: https://api.easy.gov.ua/api/ (публічний REST, без авторизації)
//
// Логіка фільтрації:
//   - isPublished && status === 'Діюча'
//   - ageRanges має містити діапазон з minAge <= 17 (підлітки до 18 р.)
//   - виключаємо напрями тільки для дорослих: Ветерани, Житло
//   - age_from/age_to беремо з API, age_to кепуємо на 17
//
// УВАГА: платформа оновлюється — вік у кожного запису читається з API
// і НЕ хардкодиться. Scraper завжди перечитує актуальні дані.

export const name = 'easy.gov.ua — можливості для молоді';

const API = 'https://api.easy.gov.ua/api/opportunities';

// Напрями, які ігноруємо (суто для дорослих)
const SKIP_DIRECTIONS = new Set(['Ветерани', 'Житло', 'УНГІ']);

// Типи, які ігноруємо
const SKIP_TYPES = new Set(['Консультація']);

// Маппінг типів API → наші opportunity_type
const TYPE_MAP = {
  'Грант':                  'grant',
  'Грант (бізнес)':         'grant',
  'Фінансування проєкту':   'grant',
  'Конкурс':                'competition',
  'Стажування':             'internship',
  'Стипендія':              'scholarship',
  'Компенсація':            'allowance',
  'Програма':               'course',
  'Послуга (соціальна)':    'humanitarian',
  'Послуга (інша)':         'course',
  'Інше':                   'course',
  'Премія':                 'competition',
};

// Додатково уточнюємо тип по напряму
function resolveType(apiType, direction) {
  if (apiType === 'Послуга (соціальна)') {
    if (direction === 'Освіта') return 'course';
    if (direction === 'Соціальний') return 'allowance';
    if (direction === 'Спорт') return 'sport_event';
    return 'humanitarian';
  }
  if (apiType === 'Послуга (інша)') {
    if (direction === 'Освіта') return 'course';
    if (direction === 'Обміни') return 'exchange';
  }
  if (apiType === 'Інше') {
    if (direction === 'Спорт') return 'sport_tournament';
    if (direction === 'Культура') return 'festival';
  }
  if (apiType === 'Фінансування проєкту' && direction === 'Спорт') return 'sport_tournament';
  return TYPE_MAP[apiType] || 'course';
}

function resolveDeadline(item) {
  // Використовуємо applicationSubmissionEndDate якщо є, інакше dateClose
  const d = item.applicationSubmissionEndDate || item.dateClose;
  if (!d) return null;
  const date = new Date(d);
  if (isNaN(date.getTime())) return null;
  // Не повертаємо минулі дедлайни
  if (date < new Date()) return null;
  return date.toISOString().slice(0, 10);
}

function resolveCost(item) {
  const ft = item.financeType;
  if (ft === 'NONE' || !ft) return 'free';
  if (['GRANT', 'SCHOLARSHIP', 'FULL_FUNDING'].includes(ft)) return 'partially_free';
  if (['PARTIAL_FUNDING'].includes(ft)) return 'partially_free';
  return 'free';
}

function resolveNeeds(item) {
  const needs = [];
  if (item.idpStatusRequired === 'REQUIRED') needs.push('idp');
  if (item.disabilityRequired === 'REQUIRED') needs.push('disability');
  return needs;
}

export async function scrape() {
  const allItems = [];

  // Fetch всі сторінки
  let page = 1;
  while (true) {
    let res, data, meta;
    try {
      res = await fetch(`${API}?limit=100&page=${page}`, {
        headers: {
          'user-agent': 'Mozilla/5.0 (compatible; dityam-scraper/1.0; +https://dityam.com.ua)',
          'accept': 'application/json',
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      ({ data, meta } = await res.json());
    } catch (err) {
      console.warn(`  ${name}: page ${page} failed: ${err.message}`);
      break;
    }

    allItems.push(...(data || []));
    if (page >= (meta?.totalPages || 1)) break;
    page++;
    await new Promise(r => setTimeout(r, 500));
  }

  const rows = [];

  for (const item of allItems) {
    // Тільки опубліковані та активні
    if (!item.isPublished) continue;
    if (item.status?.name !== 'Діюча') continue;

    // Лише для жінок — поза межами нашого каталогу
    if (item.gender === 'FEMALE') continue;

    const direction = item.direction?.name || '';
    const typeName = item.type?.name || '';

    // Виключити за напрямом та типом
    if (SKIP_DIRECTIONS.has(direction)) continue;
    if (SKIP_TYPES.has(typeName)) continue;

    // Перевіряємо вікові діапазони — ключова умова
    const ranges = item.ageRanges || [];
    const youthRanges = ranges.filter(r => typeof r.minAge === 'number' && r.minAge <= 17);
    if (youthRanges.length === 0) continue;

    // Беремо найменший minAge та кепуємо maxAge на 17
    const age_from = Math.min(...youthRanges.map(r => r.minAge));
    const age_to = Math.min(17, Math.max(...youthRanges.map(r => r.maxAge ?? 17)));

    const url = item.descriptionLink || item.applicationFormLink || `https://easy.gov.ua/#${item.id}`;
    if (!url || url === `https://easy.gov.ua/#${item.id}`) continue; // немає реального посилання

    rows.push({
      title: item.name?.trim(),
      summary: (item.shortDescription || '').trim().slice(0, 500),
      age_from,
      age_to,
      opportunity_type: resolveType(typeName, direction),
      categories: [direction.toLowerCase()].filter(Boolean),
      child_needs: resolveNeeds(item),
      format: 'Онлайн / офлайн',
      cost_type: resolveCost(item),
      deadline: resolveDeadline(item),
      source_url: url,
      source: 'easy.gov.ua',
    });
  }

  return rows;
}
