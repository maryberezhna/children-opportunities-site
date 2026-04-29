import * as cheerio from 'cheerio';
import { fetchHtml } from '../lib/fetch.mjs';

export const name = 'Регіональні мовні школи';

// Alliance Française has a network of schools across Ukrainian cities — we
// emit it as a single opportunity that covers the whole network.
const LIST_URL = 'https://www.afukraine.org/uk/network';
const FALLBACK_URL = 'https://www.afukraine.org/';
const FALLBACK_CITIES = ['Київ', 'Львів', 'Одеса', 'Харків', 'Дніпро', 'Запоріжжя'];

async function discoverCities() {
  try {
    const html = await fetchHtml(LIST_URL);
    const $ = cheerio.load(html);
    const cities = new Set();
    $('.alliance-card, .network-item, .branch, article').each((_, el) => {
      const city = $(el).find('h2, h3, .city').first().text().trim();
      if (city) cities.add(city);
    });
    if (cities.size > 0) return { cities: [...cities], url: LIST_URL };
  } catch {}
  return { cities: FALLBACK_CITIES, url: FALLBACK_URL };
}

export async function scrape() {
  const { cities, url } = await discoverCities();
  const cityList = cities.join(', ');

  return [{
    title: 'Alliance Française — курси французької для дітей',
    summary: `Альянс Франсез: мережа центрів вивчення французької мови по містах України (${cityList}). Курси для дітей і підлітків, розмовні клуби, підготовка до DELF Junior, культурні події, кінопокази.`,
    age_from: 7,
    age_to: 17,
    opportunity_type: 'course',
    categories: ['languages', 'education'],
    child_needs: [],
    format: `Офлайн, ${cityList}`,
    cost_type: 'paid_affordable',
    deadline: null,
    source_url: url,
    source: 'Alliance Française Ukraine',
  }];
}
