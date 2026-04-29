import * as cheerio from 'cheerio';
import { fetchHtml } from '../lib/fetch.mjs';

export const name = 'Міжнародні конкурси та олімпіади';

// Society for Science events index — covers Regeneron ISEF, Broadcom MASTERS,
// Thermo Fisher JIC, etc. Stable structure (event tiles).
const LIST_URL = 'https://www.societyforscience.org/competitions/';

export async function scrape() {
  let html;
  try {
    html = await fetchHtml(LIST_URL);
  } catch (err) {
    console.warn(`  ${name}: list fetch failed (${err.message}) — using curated fallback`);
    return curatedFallback();
  }

  const $ = cheerio.load(html);
  const rows = [];

  $('article, .competition-card, .program-card, .card').each((_, el) => {
    const $el = $(el);
    const title = $el.find('h2, h3').first().text().trim();
    if (!title || title.length < 4) return;

    const href = $el.find('a').first().attr('href');
    const url = href?.startsWith('http') ? href : href ? new URL(href, LIST_URL).toString() : LIST_URL;
    const summary = $el.find('p').first().text().trim().slice(0, 280);

    rows.push({
      title: `${title} — Society for Science`,
      summary: summary
        ? `${summary} Українські школярі можуть подаватись напряму або через МАН.`
        : 'Міжнародний науковий конкурс від Society for Science. Українські школярі подаються напряму або через МАН.',
      age_from: 13,
      age_to: 17,
      opportunity_type: 'competition',
      categories: ['STEM','education'],
      child_needs: ['gifted'],
      format: 'Онлайн + США',
      cost_type: 'free',
      deadline: null,
      source_url: url,
      source: 'Society for Science',
    });
  });

  return rows.length > 0 ? rows : curatedFallback();
}

function curatedFallback() {
  return [
    {
      title: 'European Union Contest for Young Scientists (EUCYS)',
      summary: 'Європейський конкурс молодих учених для школярів 14-20 років. Українські переможці МАН представляють країну. Гранти, стипендії, презентація проєктів європейським вченим.',
      age_from: 14, age_to: 17, opportunity_type: 'competition',
      categories: ['STEM','education'], child_needs: ['gifted'],
      format: 'Офлайн, ЄС', cost_type: 'free', deadline: null,
      source_url: 'https://eucys.eu/', source: 'EUCYS',
    },
    {
      title: 'International Olympiad in Informatics (IOI)',
      summary: 'Найпрестижніша олімпіада з програмування для школярів. Збірна України відбирається через всеукраїнську олімпіаду МОН. Призи, медалі, портал у топ-університети.',
      age_from: 14, age_to: 17, opportunity_type: 'olympiad',
      categories: ['STEM'], child_needs: ['gifted'],
      format: 'Офлайн, різні країни', cost_type: 'free', deadline: null,
      source_url: 'https://ioinformatics.org/', source: 'IOI',
    },
    {
      title: 'International Linguistics Olympiad (IOL)',
      summary: 'Олімпіада з лінгвістики для старшокласників. 200+ учасників із 50 країн. Команда України виборює медалі останні роки. Відбір через всеукраїнський тур.',
      age_from: 14, age_to: 17, opportunity_type: 'olympiad',
      categories: ['languages','education'], child_needs: ['gifted'],
      format: 'Офлайн, різні країни', cost_type: 'free', deadline: null,
      source_url: 'https://ioling.org/', source: 'IOL',
    },
  ];
}
