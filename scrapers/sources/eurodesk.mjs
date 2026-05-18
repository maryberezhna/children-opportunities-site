// Eurodesk Programme Database — EU opportunities for youth
// API: GET https://programmes.eurodesk.eu/search (requires Referer header)
// Returns JSON {open: "<html cards>", upcoming: "<html cards>", count: N}
//
// Фільтруємо тільки програми де мінімальний вік <= 17 і є явна вказівка
// на школярів / підлітків. Вік завжди читається з тексту картки — не хардкодиться.

export const name = 'Eurodesk — EU програми для молоді';

const API = 'https://programmes.eurodesk.eu/search';
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

function parseCards(html) {
  const parts = html.split('<div data-role="card"');
  const cards = [];

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];

    const title = /data-role="title"[^>]*>\s*([\s\S]*?)\s*<\/div>/.exec(part)?.[1]
      ?.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#039;/g, "'").trim() || '';
    const desc = /group-hover:block[^>]*>\s*([\s\S]*?)\s*<\/div>/.exec(part)?.[1]
      ?.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#039;/g, "'").trim() || '';
    const deadlineRaw = /font-bold uppercase">([\d\/]+|ongoing)<\/span>/.exec(part)?.[1] || null;
    const id = /value="(\d+)-[a-z]/.exec(part)?.[1];
    const colorMatch = /data-color="([^"]+)"/.exec(part);
    const color = colorMatch?.[1] || 'blue';

    if (!id || !title) continue;
    cards.push({ id, title, desc, deadlineRaw, color });
  }
  return cards;
}

export async function scrape() {
  let html = '';
  try {
    const res = await fetch(API, {
      headers: {
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'referer': 'https://programmes.eurodesk.eu/programmes',
        'origin': 'https://programmes.eurodesk.eu',
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'en-US,en;q=0.9,uk;q=0.8',
        'accept-encoding': 'gzip, deflate, br',
        'x-requested-with': 'XMLHttpRequest',
        'sec-fetch-site': 'same-origin',
        'sec-fetch-mode': 'cors',
        'sec-fetch-dest': 'empty',
        'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    html = (json.open || '') + (json.upcoming || '');
  } catch (err) {
    console.warn(`  ${name}: fetch failed (${err.message})`);
    return [];
  }

  const cards = parseCards(html);
  const rows = [];

  for (const { id, title, desc, deadlineRaw, color } of cards) {
    if (!isYouthRelevant(title, desc)) continue;

    const deadline = parseDeadline(deadlineRaw);

    // Age from description if available; otherwise derive from keywords
    const age = parseAge(desc);
    let age_from, age_to;
    if (age && age.min <= 17) {
      age_from = age.min;
      age_to = Math.min(17, age.max);
    } else if (age && age.min > 17) {
      continue; // 18+ тільки — пропускаємо
    } else {
      // Дефолт по контексту
      const t = `${title} ${desc}`.toLowerCase();
      if (/high.?school|secondary|школяр|high school|17|16/.test(t)) {
        age_from = 15; age_to = 17;
      } else if (/13|14|15/.test(t) || /junior|young person/.test(t)) {
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
      opportunity_type: COLOR_TYPE[color] || 'exchange',
      categories: ['eu', 'international'],
      child_needs: [],
      format: 'Онлайн / офлайн',
      cost_type: 'free',
      deadline,
      source_url: `${BASE}/${id}`,
      source: 'Eurodesk',
    });
  }

  return rows;
}
