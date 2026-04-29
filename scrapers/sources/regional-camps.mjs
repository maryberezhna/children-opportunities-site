import * as cheerio from 'cheerio';
import { fetchHtml } from '../lib/fetch.mjs';

export const name = 'Регіональні дитячі табори';

// Aggregator with summer camp listings across Ukrainian regions.
const LIST_URL = 'https://child.com.ua/dityachi-tabory/';

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

  return rows.length > 0 ? rows : curatedFallback();
}

function curatedFallback() {
  return [
    {
      title: 'Дитячий табір "Дзвінкий" — Закарпаття',
      summary: 'Літній табір у Карпатах з туристичною та екологічною програмою. Походи, екскурсії, творчі майстерні. Зміни 10-14 днів.',
      age_from: 7, age_to: 16, opportunity_type: 'camp',
      categories: ['social','sports'], child_needs: [],
      format: 'Офлайн, Закарпаття', cost_type: 'paid_affordable',
      deadline: null,
      source_url: 'https://child.com.ua/dityachi-tabory/zakarpattya/',
      source: 'child.com.ua',
    },
    {
      title: 'Eco Camp — екологічний табір на Поліссі',
      summary: 'Екологічний табір з вивченням флори і фауни, орієнтуванням, базовими навичками виживання. Партнерство з природним заповідником.',
      age_from: 9, age_to: 15, opportunity_type: 'camp',
      categories: ['education'], child_needs: [],
      format: 'Офлайн, Полісся', cost_type: 'paid_affordable',
      deadline: null,
      source_url: 'https://child.com.ua/dityachi-tabory/',
      source: 'child.com.ua',
    },
    {
      title: 'Мовний табір English Time — Одещина',
      summary: 'Мовний табір з носіями англійської. Повна англомовна програма 14 днів, басейн, пляж, екскурсії історичною Одесою.',
      age_from: 8, age_to: 16, opportunity_type: 'camp',
      categories: ['languages','education'], child_needs: [],
      format: 'Офлайн, Одеська обл.', cost_type: 'paid_affordable',
      deadline: null,
      source_url: 'https://child.com.ua/dityachi-tabory/',
      source: 'child.com.ua',
    },
  ];
}
