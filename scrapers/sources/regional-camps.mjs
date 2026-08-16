import * as cheerio from 'cheerio';
import { fetchHtml } from '../lib/fetch.mjs';

export const name = 'Регіональні дитячі табори';

// Aggregator with summer camp listings across Ukrainian regions.
const LIST_URL = 'https://child.com.ua/dityachi-tabory/';

export async function scrape() {
  // Збій фетчу прокидаємо: run.mjs запише його в реєстр джерел як failure.
  const html = await fetchHtml(LIST_URL);

  const $ = cheerio.load(html);
  const rows = [];

  $('.camp-card, .tabir-item, article.camp, .listing-item').each((_, el) => {
    const $el = $(el);
    const title = $el.find('h2, h3, .title, a').first().text().trim();
    if (!title) return;

    const href = $el.find('a').first().attr('href');
    const url = href?.startsWith('http') ? href : href ? new URL(href, LIST_URL).toString() : LIST_URL;
    const region = $el.find('.region, .location').first().text().trim();
    const summary = $el.find('p, .desc, .excerpt').first().text().trim().slice(0, 280);

    rows.push({
      title,
      summary: summary || `Дитячий табір${region ? ` в ${region}` : ''} з повним пансіоном.`,
      age_from: 7,
      age_to: 16,
      opportunity_type: 'camp',
      categories: ['social'],
      child_needs: [],
      format: region ? `Офлайн, ${region}` : 'Офлайн',
      cost_type: 'paid_affordable',
      deadline: null,
      source_url: url,
      source: 'child.com.ua',
    });
  });

  // Нуль знахідок = зламані селектори; фолбеку немає свідомо — run.mjs
  // зафіксує збій, після 3 поспіль адмін отримає алерт у Telegram.
  return rows;
}
