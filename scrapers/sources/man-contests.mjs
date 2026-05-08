import { fetchHtml } from '../lib/fetch.mjs';

export const name = 'МАН — конкурси та олімпіади';

const LIST_URL = 'https://man.gov.ua/contests';

// MAN's index page embeds all contest data in a JS object literal inside a
// Next.js __NEXT_DATA__ payload. Each contest has at minimum slug + title.
// We extract them with regex (full JS-literal parser is overkill here) and
// build proper deep-link URLs to /contests/<slug>.
//
// Some entries belong under /contests/olympiad/<slug> instead of /contests/<slug>;
// we follow each candidate to confirm the canonical URL (HEAD with redirect).

const TYPE_BY_KEYWORD = [
  [/олімпіад/i, 'olympiad'],
  [/конкурс/i, 'competition'],
  [/виставк/i, 'competition'],
  [/змаганн/i, 'competition'],
  [/турнір/i, 'competition'],
  [/фестивал/i, 'festival'],
  [/проєкт|проект/i, 'competition'],
  [/шоу/i, 'competition'],
];

function inferType(title) {
  for (const [pat, t] of TYPE_BY_KEYWORD) {
    if (pat.test(title)) return t;
  }
  return 'competition';
}

function cleanTitle(raw) {
  return raw
    .replace(/\\n/g, ' ')
    .replace(/\\"/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

async function resolveCanonicalUrl(slug) {
  // try /contests/olympiad/<slug> first if title implies olympiad — actually we don't
  // know type yet from URL alone. Try plain /contests/<slug>; on 404 try /contests/olympiad/<slug>.
  const candidates = [
    `https://man.gov.ua/contests/${slug}`,
    `https://man.gov.ua/contests/olympiad/${slug}`,
  ];
  for (const url of candidates) {
    try {
      const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
      if (res.status >= 200 && res.status < 400) return res.url || url;
    } catch {}
  }
  return null;
}

export async function scrape() {
  let html;
  try {
    html = await fetchHtml(LIST_URL);
  } catch (err) {
    console.warn(`  ${name}: list fetch failed (${err.message})`);
    return [];
  }

  // Match: slug:"X",[startDate:Y,]endDate:Z,title:"T"
  // Accept escaped quotes/backslashes inside title.
  const entries = new Map();
  const pattern = /slug:"([a-z0-9-]+)"[^}]*?title:"((?:\\.|[^"\\])+)"/g;
  let m;
  while ((m = pattern.exec(html)) !== null) {
    const slug = m[1];
    const title = cleanTitle(m[2]);
    if (!entries.has(slug) && title.length > 5) {
      entries.set(slug, title);
    }
  }

  if (entries.size === 0) {
    console.warn(`  ${name}: no contests parsed from list`);
    return [];
  }

  const rows = [];
  for (const [slug, title] of entries) {
    const url = await resolveCanonicalUrl(slug);
    if (!url) {
      console.warn(`  ${name}: no live URL for "${title}"`);
      continue;
    }
    rows.push({
      title,
      summary: `Конкурс/олімпіада від Малої академії наук України. Подробиці й умови участі — на офіційному сайті МАН.`,
      age_from: 10,
      age_to: 17,
      opportunity_type: inferType(title),
      categories: ['stem', 'science'],
      child_needs: [],
      format: 'Україна / онлайн',
      cost_type: 'free',
      deadline: null,
      source_url: url,
      source: 'Мала академія наук України',
    });
  }

  return rows;
}
