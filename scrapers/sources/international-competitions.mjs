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
    // Збій фетчу — чесний збій: без фолбеку, реєстр джерел його зафіксує.
    throw err;
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

  // Нуль знахідок = зламані селектори; фолбеку немає свідомо.
  return rows;
}
