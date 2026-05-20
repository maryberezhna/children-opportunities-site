import { fetchHtml, politeBatch } from '../lib/fetch.mjs';

export const name = 'Дія.Освіта — курси для молоді';

const BASE = 'https://osvita.diia.gov.ua';
const TOTAL_PAGES = 21;

// Ключові слова, що вказують на релевантність для дітей/підлітків 10-18 р.
const YOUTH_KEYWORDS = [
  'молод', 'підліток', 'підлітк', 'школяр', 'учн', 'нмт', 'зно',
  'youth', 'teen', 'school', 'студент', 'абітурієнт',
  'кібербезпека для молоді', 'кібергігієна для молоді',
  'політична освіта для молоді', 'підготовка до нмт',
];

// Ключові слова, що виключають курс (для дорослих/організацій)
const ADULT_EXCLUDE = [
  'dpo', 'держслужб', 'поліц', 'ветеран', 'чизмонгер',
  'готельн', 'туристичн', 'торговельн', 'бухгалтер', 'нотаріус',
  'прокурор', 'суддя', 'адвокат', 'черліденг: тренерств',
  'тьюторинг у школі',   // для тьюторів, не учнів
  'цифрові навички для вчителів',
  'карантин: онлайн-сервіси для вчителів',
  'організація стажування молоді',
  'молодіжна робота',    // для молодіжних працівників (дорослих)
  'інклюзивна молодіжна',
  'як стати ментором',
  'наставництво: що',
  'публічна служба без',
  'covid',
  'вишивальник',
  'апарати штучної вентиляції',
];

function isYouthRelevant(title, description = '') {
  const text = `${title} ${description}`.toLowerCase();
  if (ADULT_EXCLUDE.some((kw) => text.includes(kw))) return false;
  return YOUTH_KEYWORDS.some((kw) => text.includes(kw));
}

// Парсить картки курсів зі сторінки.
// Структура: <a href="/courses/SLUG" class="...category-card...">
//   ...<h5 class="...category-card-full__title--md">TITLE</h5>
//   ...<div class="...category-card-full__description...">DESC</div>
function parseCourses(html) {
  const courses = [];
  // Витягуємо кожну <a href="/courses/..."> з її внутрішнім вмістом
  const cardRe = /<a\s+href="(\/courses\/[a-z0-9-]+)"[^>]*>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = cardRe.exec(html)) !== null) {
    const path = m[1];
    const inner = m[2];
    const titleMatch = /category-card-full__title--md[^>]*>([^<]+)<\/h5>/i.exec(inner);
    if (!titleMatch) continue;
    const title = titleMatch[1].replace(/\s+/g, ' ').trim();
    const descMatch = /category-card-full__description[^>]*>([^<]*)<\/div>/i.exec(inner);
    const desc = descMatch ? descMatch[1].replace(/\s+/g, ' ').trim() : '';
    if (title.length > 3) courses.push({ path, title, desc });
  }
  return courses;
}

// Отримати опис курсу з його сторінки
async function fetchDescription(path) {
  try {
    const html = await fetchHtml(`${BASE}${path}`);
    // шукаємо мета-опис або перший параграф
    const metaDesc = /<meta[^>]+name="description"[^>]+content="([^"]{10,})"/i.exec(html);
    if (metaDesc) return metaDesc[1].trim();
    const og = /<meta[^>]+property="og:description"[^>]+content="([^"]{10,})"/i.exec(html);
    if (og) return og[1].trim();
    const p = /<p[^>]*>([^<]{30,300})<\/p>/i.exec(html);
    if (p) return p[1].replace(/\s+/g, ' ').trim();
  } catch {}
  return '';
}

export async function scrape() {
  console.log(`  Fetching ${TOTAL_PAGES} pages...`);
  const pages = Array.from({ length: TOTAL_PAGES }, (_, i) => i + 1);

  // path → { title, desc }
  const allCourses = new Map();

  await politeBatch(pages, async (page) => {
    try {
      const url = page === 1 ? `${BASE}/courses` : `${BASE}/courses?page=${page}`;
      const html = await fetchHtml(url);
      for (const { path, title, desc } of parseCourses(html)) {
        if (!allCourses.has(path)) allCourses.set(path, { title, desc });
      }
    } catch (err) {
      console.warn(`  page ${page} failed: ${err.message}`);
    }
  }, { concurrency: 3, delayMs: 500 });

  console.log(`  Found ${allCourses.size} courses total, filtering for youth...`);

  const candidates = [];
  for (const [path, { title, desc }] of allCourses) {
    if (isYouthRelevant(title, desc)) candidates.push({ path, title, desc });
  }

  const rows = [];
  for (const { path, title, desc: cardDesc } of candidates) {
    const desc = cardDesc || await fetchDescription(path);
    if (!isYouthRelevant(title, desc)) continue;

    // Визначаємо вік по вмісту
    let age_from = 14;
    let age_to = 17;
    const combined = `${title} ${desc}`.toLowerCase();
    if (/дошкільн|садок|малюк|0.{0,3}[36]/.test(combined)) { age_from = 4; age_to = 6; }
    else if (/молодш|початков|1.{0,3}4.{0,5}клас/.test(combined)) { age_from = 7; age_to = 11; }
    else if (/середн|5.{0,3}9.{0,5}клас/.test(combined)) { age_from = 10; age_to: 15; }
    else if (/нмт|зно|абітурієнт|11.{0,3}клас/.test(combined)) { age_from = 15; age_to = 17; }

    rows.push({
      title,
      summary: desc.slice(0, 500) || `Безкоштовний курс на платформі Дія.Освіта. Тема: ${title}.`,
      age_from,
      age_to,
      opportunity_type: 'course',
      categories: ['digital', 'education'],
      child_needs: [],
      format: 'Онлайн',
      cost_type: 'free',
      deadline: null,
      source_url: `${BASE}${path}`,
      source: 'Дія.Освіта',
    });
  }

  return rows;
}
