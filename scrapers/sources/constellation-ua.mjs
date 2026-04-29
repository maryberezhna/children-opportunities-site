import * as cheerio from 'cheerio';
import { fetchHtml } from '../lib/fetch.mjs';

export const name = 'Constellation Ukraine';

const LIST_URL = 'https://constellation.org.ua/';

const MONTHS = {
  січня:0,лютого:1,березня:2,квітня:3,травня:4,червня:5,липня:6,
  серпня:7,вересня:8,жовтня:9,листопада:10,грудня:11,
};

function parseUkrDate(text) {
  const m = text.toLowerCase().match(/(\d{1,2})\s+([а-яіїєґ]+)\s*(\d{4})?/);
  if (!m) return null;
  const day = +m[1];
  const month = MONTHS[m[2]];
  if (month == null) return null;
  const year = m[3] ? +m[3] : new Date().getFullYear();
  return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
}

export async function scrape() {
  const html = await fetchHtml(LIST_URL);
  const $ = cheerio.load(html);
  const rows = [];

  $('article, .event, .competition, .post').each((_, el) => {
    const $el = $(el);
    const title = $el.find('h1, h2, h3').first().text().trim();
    if (!title || title.length < 8) return;

    const href = $el.find('a').first().attr('href');
    const url = href?.startsWith('http') ? href : href ? new URL(href, LIST_URL).toString() : LIST_URL;
    const summary = $el.find('p').first().text().trim().slice(0, 280);
    const dateText = $el.text();
    const deadline = parseUkrDate(dateText);

    rows.push({
      title: title.length > 120 ? title.slice(0, 117) + '...' : title,
      summary: summary || 'Міжнародний онлайн-конкурс мистецтв для дітей від Constellation Ukraine.',
      age_from: 4,
      age_to: 17,
      opportunity_type: 'competition',
      categories: ['arts'],
      child_needs: [],
      format: 'Онлайн',
      cost_type: 'paid_affordable',
      deadline,
      source_url: url,
      source: 'Constellation Ukraine',
    });
  });

  if (rows.length === 0) {
    rows.push({
      title: 'Constellation Ukraine — міжнародні конкурси мистецтв',
      summary: 'Платформа з регулярними онлайн-конкурсами для творчих дітей: вокал, фортепіано, танець, образотворче мистецтво, авторські вірші. Дипломи, сертифікати міжнародного зразка.',
      age_from: 4,
      age_to: 17,
      opportunity_type: 'competition',
      categories: ['arts'],
      child_needs: [],
      format: 'Онлайн',
      cost_type: 'paid_affordable',
      deadline: null,
      source_url: LIST_URL,
      source: 'Constellation Ukraine',
    });
  }

  return rows;
}
