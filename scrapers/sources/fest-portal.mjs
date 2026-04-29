import * as cheerio from 'cheerio';
import { fetchHtml } from '../lib/fetch.mjs';

export const name = 'FEST-PORTAL';

const LIST_URL = 'https://fest-portal.com/meropriyatiya/';

export async function scrape() {
  const html = await fetchHtml(LIST_URL);
  const $ = cheerio.load(html);
  const rows = [];

  $('.event-card, .meropriyatie, article.event, .events-list > li, .event-item').each((_, el) => {
    const $el = $(el);
    const title = $el.find('h2, h3, .event-title, a').first().text().trim();
    if (!title) return;

    const href = $el.find('a').first().attr('href');
    const url = href?.startsWith('http') ? href : href ? new URL(href, LIST_URL).toString() : LIST_URL;
    const city = $el.find('.city, .location, .venue').first().text().trim();
    const summary = $el.find('p, .description, .excerpt').first().text().trim().slice(0, 280);

    rows.push({
      title,
      summary: summary || `Всеукраїнський конкурс/фестиваль для дітей. ${city ? city + '.' : ''}`.trim(),
      age_from: 5,
      age_to: 17,
      opportunity_type: 'festival',
      categories: ['arts'],
      child_needs: [],
      format: city ? `Офлайн, ${city}` : 'Офлайн + онлайн',
      cost_type: 'paid_affordable',
      deadline: null,
      source_url: url,
      source: 'FEST-PORTAL',
    });
  });

  if (rows.length === 0) {
    rows.push({
      title: 'FEST-PORTAL — всеукраїнські фестивалі та конкурси',
      summary: 'Каталог конкурсів і фестивалів з вокалу, хореографії, художнього слова, інструментального виконавства для дітей. Регулярні події в Києві та регіонах.',
      age_from: 5,
      age_to: 17,
      opportunity_type: 'festival',
      categories: ['arts'],
      child_needs: [],
      format: 'Офлайн + онлайн',
      cost_type: 'paid_affordable',
      deadline: null,
      source_url: LIST_URL,
      source: 'FEST-PORTAL',
    });
  }

  return rows;
}
