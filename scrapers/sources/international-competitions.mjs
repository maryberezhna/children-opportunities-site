import { fetchHtml } from '../lib/fetch.mjs';

export const name = 'Міжнародні конкурси та олімпіади';

// Society for Science проводить три конкурси, відкриті для школярів з України
// (напряму або через афілійовані відбори, зокрема МАН). Індексної сторінки з
// картками більше немає — з 2026 це лонгрід-модулі, тому старі селектори
// (article/.card) давали нуль рядків кожного запуску. Натомість ходимо на самі
// сторінки конкурсів: кожен фетч — реальна перевірка живості, а якщо сторінка
// зникне, адаптер чесно впаде і реєстр джерел це зафіксує.
const COMPETITIONS = [
  {
    path: 'isef',
    fallbackTitle: 'Regeneron International Science and Engineering Fair (ISEF)',
    summary:
      'Найбільша у світі наукова виставка для старшокласників: учасники з понад 60 країн '
      + 'змагаються у 21 напрямі STEM, призовий фонд — близько $8 млн. Українські школярі '
      + 'потрапляють через національний відбір (МАН).',
    age_from: 14,
    age_to: 17,
  },
  {
    path: 'broadcom-masters',
    fallbackTitle: 'Broadcom MASTERS — конкурс для молодших школярів',
    summary:
      'Науково-інженерний конкурс для учнів середньої школи (6–8 класи): дослідницькі '
      + 'проєкти, командні STEM-завдання, стипендії переможцям. Відбір — через афілійовані '
      + 'наукові ярмарки.',
    age_from: 11,
    age_to: 14,
  },
  {
    path: 'regeneron-sts',
    fallbackTitle: 'Regeneron Science Talent Search',
    summary:
      'Найстаріший науковий конкурс США для випускних класів: оригінальне дослідження, '
      + 'фінал у Вашингтоні, призи до $250 000. Для школярів останнього року навчання.',
    age_from: 16,
    age_to: 17,
  },
];

const BASE = 'https://www.societyforscience.org';

/** Офіційна назва зі сторінки: <title> без хвоста « - Society for Science». */
function titleFrom(html, fallback) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return fallback;
  const t = m[1]
    .replace(/<[^>]+>/g, '')
    .replace(/\s*[-|–]\s*Society for Science.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  return t.length > 5 ? t : fallback;
}

export async function scrape() {
  const rows = [];

  for (const c of COMPETITIONS) {
    const url = `${BASE}/${c.path}/`;
    // Помилку фетчу НЕ ковтаємо: якщо всі три сторінки лягли, rows лишиться
    // порожнім і run.mjs запише збій — саме та поведінка, якої ми хочемо.
    let html;
    try {
      html = await fetchHtml(url);
    } catch (err) {
      console.warn(`  ⚠ ${name}: ${url} — ${err.message}`);
      continue;
    }

    rows.push({
      title: `${titleFrom(html, c.fallbackTitle)} — Society for Science`,
      summary: `${c.summary} Участь безкоштовна.`,
      age_from: c.age_from,
      age_to: c.age_to,
      opportunity_type: 'competition',
      categories: ['STEM', 'education'],
      child_needs: ['gifted'],
      format: 'Онлайн + США',
      cost_type: 'free',
      deadline: null,
      source_url: url,
      source: 'Society for Science',
    });
  }

  return rows;
}
