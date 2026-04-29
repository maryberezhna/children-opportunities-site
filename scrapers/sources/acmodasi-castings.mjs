import * as cheerio from 'cheerio';
import { fetchHtml } from '../lib/fetch.mjs';

export const name = 'ACMODASI Castings';

const LIST_URL = 'https://www.acmodasi.com.ua/castings/for_actors/';

export async function scrape() {
  const html = await fetchHtml(LIST_URL);
  const $ = cheerio.load(html);
  const rows = [];

  $('.castings-list .casting-item, article.casting, .b-castings__item').each((_, el) => {
    const $el = $(el);
    const title = $el.find('h2, h3, .casting-title, a').first().text().trim();
    if (!title) return;

    const href = $el.find('a').first().attr('href');
    const url = href?.startsWith('http') ? href : href ? new URL(href, LIST_URL).toString() : LIST_URL;
    const summary = $el.find('p, .casting-desc, .description').first().text().trim().slice(0, 280);
    const region = $el.find('.region, .city, .location').first().text().trim();

    rows.push({
      title,
      summary: summary || `Кастинг для дітей з порталу ACMODASI${region ? `. ${region}` : ''}.`,
      age_from: 5,
      age_to: 17,
      opportunity_type: 'competition',
      categories: ['arts'],
      child_needs: [],
      format: region ? `Офлайн, ${region}` : 'Україна',
      cost_type: 'free',
      deadline: null,
      source_url: url,
      source: 'ACMODASI',
    });
  });

  // Fallback: emit the portal entry if no items parsed (selectors may have changed)
  if (rows.length === 0) {
    console.warn('  acmodasi: no items parsed — emitting portal index entry');
    rows.push({
      title: 'ACMODASI — портал кастингів для акторів',
      summary: 'Великий портал з десятками кастингів щодня. Розділи для дітей: зйомки у фільмах, серіалах, рекламі, музичних кліпах.',
      age_from: 5,
      age_to: 17,
      opportunity_type: 'competition',
      categories: ['arts'],
      child_needs: [],
      format: 'Онлайн, Україна',
      cost_type: 'free',
      deadline: null,
      source_url: LIST_URL,
      source: 'ACMODASI',
    });
  }

  return rows;
}
