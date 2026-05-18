// Eurodesk Programme Database — EU opportunities for youth
// Primary: RSS feed at /rss (558 items, parsed + filtered)
// Fallback: curated static list when Cloudflare blocks the RSS on CI
//
// Cloudflare blocks GitHub Actions IPs — both /search and /rss return 403.
// In that case the static CURATED list is used so the scraper always produces output.

export const name = 'Eurodesk — EU програми для молоді';

const RSS = 'https://programmes.eurodesk.eu/rss';
const BASE = 'https://programmes.eurodesk.eu';

// Curated top programmes for Ukrainian youth 14-17 years old
const CURATED = [
  { id: '19593', title: 'Euroscola', age_from: 16, age_to: 17, type: 'exchange',
    summary: 'Занурення в Європейський Парламент для учнів старшої школи. Учні з країн ЄС та партнерів спілкуються з депутатами ЄП і дебатують актуальні теми.' },
  { id: '19824', title: 'Erasmus+ Youth Exchanges', age_from: 13, age_to: 17, type: 'exchange',
    summary: 'Підтримка організацій та молодих людей у проведенні молодіжних обмінів. Українська молодь може брати участь як члени партнерської організації.' },
  { id: '19693', title: 'Juvenes Translatores — конкурс перекладачів ЄС', age_from: 17, age_to: 17, type: 'competition',
    summary: 'Щорічний конкурс перекладу для учнів 17 років від Генерального директорату ЄС з перекладу. Переможці запрошуються до Брюсселя.' },
  { id: '19700', title: 'European Charlemagne Youth Prize', age_from: 16, age_to: 17, type: 'grant',
    summary: 'Нагорода для молодіжних проєктів, що підтримують демократію та єднання в Європі. Для молоді від 16 до 30 років.' },
  { id: '23235', title: 'YCE Exchange Youth — культурний обмін', age_from: 16, age_to: 17, type: 'exchange',
    summary: 'Можливості культурного обміну за кордоном для молоді. Програма для підлітків 16–22 років.' },
  { id: '19713', title: 'WSA Young Innovators', age_from: 14, age_to: 17, type: 'competition',
    summary: 'Визнання молодих соціальних підприємців, які використовують ІКТ для досягнення Цілей сталого розвитку ООН.' },
  { id: '20149', title: 'AFS Exchange Programmes', age_from: 15, age_to: 17, type: 'exchange',
    summary: 'Програми навчання за кордоном для учнів середньої школи у понад 99 країнах. Один із найбільших молодіжних обмінів у світі.' },
  { id: '20152', title: 'European Parliament Ambassador School (EPAS)', age_from: 14, age_to: 17, type: 'course',
    summary: 'Безкоштовна шкільна програма про ЄС, що фінансується Європейським Парламентом для учнів та студентів по всій Европі.' },
  { id: '22310', title: 'Girls Go Circular Student Challenge', age_from: 14, age_to: 17, type: 'competition',
    summary: 'Можливість для учениць відвідати форум STEM у Брюсселі. Конкурс для дівчат, зацікавлених у STEM та циркулярній економіці.' },
  { id: '22130', title: 'International Chemistry Competition (IChO)', age_from: 15, age_to: 17, type: 'competition',
    summary: 'Грошові призи для учнів старшої школи, захоплених хімією. Міжнародний конкурс для школярів.' },
  { id: '22131', title: 'International Astronomy and Astrophysics Competition', age_from: 15, age_to: 17, type: 'competition',
    summary: 'Астрономічний виклик для учнів старшої школи та студентів університетів з усього світу.' },
  { id: '20960', title: 'Plural+ Youth Video Festival', age_from: 14, age_to: 17, type: 'competition',
    summary: 'Запрошує молодь подавати короткометражні фільми на соціальні теми: міграція, різноманітність, соціальна єдність.' },
  { id: '21890', title: 'Pitch Your Project — Alpine Region', age_from: 16, age_to: 17, type: 'grant',
    summary: 'Молодь 16–29 років може подати ідеї для сталого розвитку Альпійського регіону та виграти фінансування.' },
  { id: '22960', title: 'Youth Empowerment Forum', age_from: 16, age_to: 17, type: 'course',
    summary: 'Форум для молоді від 16 років, готової зробити реальний вплив та поспілкуватися з натхненними лідерами по всьому світу.' },
  { id: '19667', title: 'World Bank International Essay Competition', age_from: 14, age_to: 17, type: 'competition',
    summary: 'Конкурс есе "Формуючи місто твоєї мрії" для молоді від 14 до 18 років з усього світу.' },
  { id: '20861', title: 'European Space Camp', age_from: 17, age_to: 17, type: 'camp',
    summary: 'Літній табір для молоді 17–20 років, де учасники вчаться ракетобудування, астрономії та космічних технологій.' },
  { id: '22037', title: 'Young European Ambassador (YEA)', age_from: 16, age_to: 17, type: 'volunteer',
    summary: 'Програма для молоді від 16 до 26 років, захопленої співпрацею між ЄС та країнами Східного партнерства.' },
  { id: '21912', title: 'EYF Special Call for Ukraine', age_from: 14, age_to: 17, type: 'grant',
    summary: 'Фінансова підтримка молодіжних організацій в Україні від Європейського молодіжного фонду Ради Європи.' },
  { id: '22345', title: 'EUteens4Green — Youth Climate Action', age_from: 14, age_to: 17, type: 'grant',
    summary: 'Фінансова підтримка для молодіжних ініціатив у сфері зеленого переходу. Від 14 до 30 років.' },
  { id: '21700', title: 'UNESCO Global Youth Hackathon', age_from: 14, age_to: 17, type: 'competition',
    summary: 'Молодь з усього світу запрошується створювати рішення для вирішення онлайн-проблем та дотримання прав людини.' },
  { id: '22558', title: 'Young Inventors Prize', age_from: 14, age_to: 17, type: 'competition',
    summary: 'Нагорода молодим інноваторам, які розробляють рішення в рамках Цілей сталого розвитку ООН.' },
  { id: '22900', title: 'Young Champions of the Earth', age_from: 14, age_to: 17, type: 'competition',
    summary: 'Програма ООН для молоді з видатними ідеями щодо захисту та відновлення навколишнього середовища.' },
  { id: '23100', title: 'beVisioneers Fellowship — Sustainability', age_from: 14, age_to: 17, type: 'grant',
    summary: 'Підтримка молодих інноваторів зі стійкими ідеями або проєктами, що сприяють сталому розвитку.' },
  { id: '22800', title: 'Global Study Fair — Study Abroad', age_from: 15, age_to: 17, type: 'exchange',
    summary: 'Онлайн ярмарок навчання для школярів, які бажають вчитися за кордоном. Прямий доступ до університетів з усього світу.' },
  { id: '22700', title: 'Rotary Youth Exchange Programme', age_from: 15, age_to: 17, type: 'exchange',
    summary: 'Долучайтесь до програми Ротарі та приймайте участь у позитивних змінах по всьому світу. Обміни для учнів 15–19 років.' },
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
