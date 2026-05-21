// Eurodesk Programme Database — EU opportunities for youth
// Primary: RSS feed at /rss (558 items, parsed + filtered)
// Fallback: curated static list when Cloudflare blocks the RSS on CI
//
// Cloudflare blocks GitHub Actions IPs — both /search and /rss return 403.
// In that case the static CURATED list is used so the scraper always produces output.

export const name = 'Eurodesk — EU програми для молоді';

const RSS = 'https://programmes.eurodesk.eu/rss';
const BASE = 'https://programmes.eurodesk.eu';

// Curated specific programmes for individual Ukrainian youth 14-17.
// Rule: concrete program with known application process — NOT aggregators,
// catalogs, organizational grants, or duplicates from other scrapers.
const CURATED = [
  { id: '19593', title: 'Euroscola', age_from: 16, age_to: 17, type: 'exchange',
    summary: 'Занурення в Європейський Парламент для учнів старшої школи. Учні з країн ЄС та партнерів спілкуються з депутатами ЄП і дебатують актуальні теми. Щорічний набір через партнерські школи.' },
  { id: '19824', title: 'Erasmus+ Youth Exchanges', age_from: 13, age_to: 17, type: 'exchange',
    summary: 'Фінансовані ЄС короткі (7–21 день) молодіжні обміни між школами та НГО. Українська молодь може брати участь через організацію-партнера з будь-якої країни ЄС. Харчування і проїзд покриті.' },
  { id: '19693', title: 'Juvenes Translatores — конкурс перекладачів ЄС', age_from: 17, age_to: 17, type: 'competition',
    summary: 'Щорічний конкурс перекладу від Генерального директорату ЄС. Учасники — учні 17 років, перекладають на рідну мову з однієї з 24 мов ЄС. Переможці запрошуються до Брюсселя.' },
  { id: '19700', title: 'European Charlemagne Youth Prize', age_from: 16, age_to: 17, type: 'competition',
    summary: 'Щорічна нагорода для молодіжних проєктів, що підтримують єдність Європи. Вік 16–30 років. Переможці отримують €5000 та запрошення до Европарламенту. Подача безпосередньо на сайті.' },
  { id: '23235', title: 'YCE Exchange Youth — культурний обмін', age_from: 16, age_to: 17, type: 'exchange',
    summary: 'Програма культурного обміну для підлітків 16–22 років. Пожити за кордоном у приймаючій родині, вивчити мову та культуру. Застосовуються безпосередньо через YCE.' },
  { id: '20152', title: 'European Parliament Ambassador School (EPAS)', age_from: 14, age_to: 17, type: 'course',
    summary: 'Безкоштовна однорічна шкільна програма ЄС. Учні вивчають роботу Европарламенту, беруть участь у симуляціях і відвідують ЄП. Школи реєструються безпосередньо на сайті ЄП.' },
  { id: '22310', title: 'Girls Go Circular Student Challenge', age_from: 14, age_to: 17, type: 'competition',
    summary: 'Конкурс ЄС для учениць: проєкти на тему циркулярної економіки та STEM. Фіналістки запрошуються на форум у Брюсселі. Реєстрація команд через школу.' },
  { id: '22130', title: 'International Chemistry Competition (IChO)', age_from: 15, age_to: 17, type: 'competition',
    summary: 'Міжнародна олімпіада з хімії для учнів старшої школи. Теоретичні та практичні задачі, змагання серед 80+ країн. Участь через Українське хімічне товариство.' },
  { id: '22131', title: 'International Astronomy and Astrophysics Competition', age_from: 15, age_to: 17, type: 'competition',
    summary: 'Онлайн-конкурс з астрономії та астрофізики для школярів. Три раунди, безкоштовно, індивідуальна участь. Переможці отримують золоті, срібні та бронзові нагороди.' },
  { id: '20960', title: 'Plural+ Youth Video Festival', age_from: 14, age_to: 17, type: 'competition',
    summary: 'Конкурс відеороликів від ООН та UNAOC для молоді 9–25 років. Теми: міграція, різноманітність. Відео до 5 хв. Переможці запрошуються на церемонію нагородження в Нью-Йорку.' },
  { id: '19667', title: 'World Bank International Essay Competition', age_from: 14, age_to: 17, type: 'competition',
    summary: 'Щорічний конкурс есе Світового банку для молоді 14–18 років. Тема щороку нова. Призи та міжнародне визнання. Подача безпосередньо на сайті Worldbank.' },
  { id: '20861', title: 'European Space Camp', age_from: 17, age_to: 17, type: 'camp',
    summary: 'Тижневий літній табір в Норвегії для молоді 17–20 років: ракетобудування, астрономія, космічні технології. Обмежена кількість місць, відбір за мотиваційним листом.' },
  { id: '22037', title: 'Young European Ambassador (YEA)', age_from: 16, age_to: 17, type: 'volunteer',
    summary: 'Програма ЄС для молоді 16–26 років з країн Східного партнерства, включаючи Україну. Учасники просувають цінності ЄС у своїх громадах. Онлайн-навчання + реальні проєкти.' },
  { id: '21700', title: 'UNESCO Global Youth Hackathon', age_from: 14, age_to: 17, type: 'competition',
    summary: 'Глобальний хакатон ЮНЕСКО для молоді: командні рішення проблем цифрових прав та онлайн-простору. Переможці представляють проєкти на Інтернет-форумі ООН.' },
  { id: '22558', title: 'Young Inventors Prize', age_from: 14, age_to: 17, type: 'competition',
    summary: 'Нагорода ЄС молодим інноваторам: рішення у сфері сталого розвитку та технологій. Переможці отримують фінансування і публічне визнання на рівні ЄС.' },
  { id: '22900', title: 'Young Champions of the Earth', age_from: 14, age_to: 17, type: 'competition',
    summary: 'Програма ЮНЕП ООН для молодих екологічних лідерів. 6 переможців на рік отримують $15 000 на реалізацію проєкту + менторство + медійна підтримка ООН.' },
  { id: '23100', title: 'beVisioneers Fellowship — Sustainability', age_from: 14, age_to: 17, type: 'grant',
    summary: 'Стипендіальна програма BMW Foundation: онлайн-навчання, ментори, мережа лідерів із 170+ країн. Фокус на кліматі та технологіях. Подача без обмежень по країні.' },
  { id: '19713', title: 'WSA Young Innovators', age_from: 14, age_to: 17, type: 'competition',
    summary: 'Нагорода WSA для молодих соціальних інноваторів, які використовують ІКТ для досягнення Цілей ООН. Номінації від країн-партнерів, включаючи Україну.' },
];

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

function buildRowFromItem({ id, url, title, desc, age_from, age_to, type }) {
  return {
    title,
    summary: (desc || '').slice(0, 500),
    age_from,
    age_to,
    opportunity_type: type || 'exchange',
    categories: ['eu', 'international'],
    child_needs: [],
    format: 'Онлайн / офлайн',
    cost_type: 'free',
    deadline: null,
    source_url: url || `${BASE}/${id}`,
    source: 'Eurodesk',
  };
}

export async function scrape() {
  // Try RSS (blocked by Cloudflare on GitHub Actions IPs)
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
    console.warn(`  ${name}: RSS blocked (${err.message}) — using curated fallback`);
  }

  if (xml) {
    // Live RSS parse
    const items = parseRss(xml);
    const rows = [];
    for (const { id, url, title, desc } of items) {
      if (!isYouthRelevant(title, desc)) continue;
      const age = parseAge(desc);
      let age_from, age_to;
      if (age && age.min <= 17) { age_from = age.min; age_to = Math.min(17, age.max); }
      else if (age && age.min > 17) continue;
      else {
        const t = `${title} ${desc}`.toLowerCase();
        if (/high.?school|secondary|16|17/.test(t)) { age_from = 15; age_to = 17; }
        else if (/13|14|15|junior|young person/.test(t)) { age_from = 13; age_to = 17; }
        else { age_from = 14; age_to = 17; }
      }
      rows.push(buildRowFromItem({ id, url, title, desc, age_from, age_to }));
    }
    return rows;
  }

  // Static curated fallback
  return CURATED.map(({ id, title, age_from, age_to, type, summary }) =>
    buildRowFromItem({ id, url: `${BASE}/${id}`, title, desc: summary, age_from, age_to, type })
  );
}
