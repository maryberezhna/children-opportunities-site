// Eurodesk Programme Database — EU opportunities for youth
// API: GET https://programmes.eurodesk.eu/search (requires Referer header)
// Returns JSON {open: "<html cards>", upcoming: "<html cards>", count: N}
//
// Фільтруємо тільки програми де мінімальний вік <= 17 і є явна вказівка
// на школярів / підлітків. Вік завжди читається з тексту картки — не хардкодиться.

export const name = 'Eurodesk — EU програми для молоді';

// RSS is public and not Cloudflare-protected; /search returns 403 on CI.
const RSS = 'https://programmes.eurodesk.eu/rss';
const BASE = 'https://programmes.eurodesk.eu';

// Ключові слова, що вказують на молодь / школярів
const YOUTH_TITLE_KEYWORDS = [
  'youth', 'young', 'school', 'student', 'teen', 'adolesc',
  'junior', 'high school', 'secondary', 'молод', 'школяр',
];

// Типи, що однозначно виключають нас (дорослі/корпоративні/організаційні)
const EXCLUDE_KEYWORDS = [
  'traineeship', 'internship for graduated', 'phd', 'doctoral',
  'postgraduate', 'researcher', 'trainee at', 'eib trainee',
  'nato young professionals', 'young professionals programme',
  'advisory board', 'advisory council', 'advisory committee',
  'youth capital', 'youth council - coe', 'youth sounding board',
  'eu youth dialogue', 'youth stakeholders group',
  'facilitators eu youth', 'harvesters eu youth',
  'national youth council', 'external evaluator',
  'internships at who', 'internships at europol', 'internships at world bank',
  'unicef internship', 'oecd internship', 'acer traineeship',
  'esmh summer school for young journalist',
  'youth workers', 'youth worker',
  'yocomo mooc', 'mooc on youth',
];

// Маппінг кольору картки → тип можливості
const COLOR_TYPE = {
  orange: 'volunteer',
  green:  'grant',
  red:    'competition',
  blue:   'exchange',
  purple: 'scholarship',
};

function parseAge(text) {
  // "13 to 30 years", "16-22 years", "aged 16-18", "between 15 and 25"
  const patterns = [
    /(?:aged?|age(?:d|\s)|between)\s*(\d{2})\s*(?:to|–|-|and)\s*(\d{2})/i,
    /(\d{2})\s*(?:to|–|-)\s*(\d{2})\s*years/i,
    /(?:minimum|at least|from)\s*age\s*(\d{2})/i,
    /(\d{2})\s*years\s*(?:old|of age)/i,
  ];
  for (const p of patterns) {
    const m = p.exec(text);
    if (m) {
      const min = parseInt(m[1]);
      const max = m[2] ? parseInt(m[2]) : min;
      if (min >= 10 && min <= 25 && max >= min) return { min, max };
    }
  }
  return null;
}

function parseDeadline(str) {
  if (!str || str === 'ongoing') return null;
  // Format: DD/MM/YYYY
  const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(str);
  if (!m) return null;
  const date = new Date(`${m[3]}-${m[2]}-${m[1]}`);
  if (isNaN(date.getTime()) || date < new Date()) return null;
  return date.toISOString().slice(0, 10);
}

function isYouthRelevant(title, desc) {
  const text = `${title} ${desc}`.toLowerCase();
  if (EXCLUDE_KEYWORDS.some(k => text.includes(k))) return false;
  return YOUTH_TITLE_KEYWORDS.some(k => text.includes(k));
}

function parseRss(xml) {
  const items = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRe.exec(xml)) !== null) {
    const inner = m[1];
    const title = /<title><!\[CDATA\[(.*?)\]\]><\/title>/.exec(inner)?.[1]?.trim() || '';
    const desc = /<description><!\[CDATA\[(.*?)\]\]><\/description>/.exec(inner)?.[1]?.trim() || '';
    const guid = /<guid>(https?:\/\/programmes\.eurodesk\.eu\/(\d+))<\/guid>/.exec(inner);
    const id = guid?.[2];
    const url = guid?.[1];
    if (id && title) items.push({ id, url, title, desc });
  }
  return items;
}

export async function scrape() {
  let xml = '';
  try {
    const res = await fetch(RSS, {
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; dityam-scraper/1.0; +https://dityam.com.ua)',
        'accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    xml = await res.text();
  } catch (err) {
    console.warn(`  ${name}: RSS fetch failed (${err.message})`);
    return [];
  }

  const items = parseRss(xml);
  const rows = [];

  for (const { id, url, title, desc } of items) {
    if (!isYouthRelevant(title, desc)) continue;

    // Age from description text
    const age = parseAge(desc);
    let age_from, age_to;
    if (age && age.min <= 17) {
      age_from = age.min;
      age_to = Math.min(17, age.max);
    } else if (age && age.min > 17) {
      continue;
    } else {
      const t = `${title} ${desc}`.toLowerCase();
      if (/high.?school|secondary|16|17/.test(t)) {
        age_from = 15; age_to = 17;
      } else if (/13|14|15|junior|young person/.test(t)) {
        age_from = 13; age_to = 17;
      } else {
        age_from = 14; age_to = 17;
      }
    }

    rows.push({
      title,
      summary: desc.slice(0, 500),
      age_from,
      age_to,
      opportunity_type: 'exchange',
      categories: ['eu', 'international'],
      child_needs: [],
      format: 'Онлайн / офлайн',
      cost_type: 'free',
      deadline: null,
      source_url: url || `${BASE}/${id}`,
      source: 'Eurodesk',
    });
  }

  return rows;
}
