// /llms.txt — карта сайту для LLM-краулерів (llmstxt.org).
//
// Sitemap каже «які URL існують», llms.txt — «що це за сайт і куди йти по
// що», у markdown, який моделі читають напряму. Генерується з бази: лічильники
// на момент запиту, перегенерація раз на добу.
//
// Асистенти цитують цей файл дослівно, тож тут — лише перевірювані факти.
// 14.09.2026 прибрано три неправди: «кожен запис перевірено вручну» (записи
// проходять автоматичні ворота, до людини йде лише сумнівне), «~200 джерел»
// (число тепер рахується з бази) і «не збирає даних дітей» (Dityam+ зберігає
// профіль дитини). Додано Dityam+, якої тут не було взагалі.

import { supabase, publicOpportunities, fetchAllRows } from '@/lib/supabase';
import { TOPIC_LIST, DIASPORA_HUB, qualifyingCountryTopics } from '@/lib/topics';
import { opportunitiesWord } from '@/lib/plural';
import { kyivToday } from '@/lib/dates';
import { isLive } from '@/lib/audience';
import { CITY_META } from '@/lib/cities';
import { PLUS_SALES_OPEN } from '@/lib/plus';
import { PRICE, PRICE_HALF } from '@/lib/wayforpay';

export const revalidate = 86400;

const SITE = 'https://dityam.com.ua';

export async function GET() {
  let rows = [];
  if (supabase) {
    // Усі поля, які читають правила підбірок (lib/topics.js): без summary,
    // countries, is_international, format і child_needs «За кордон» тут
    // рахувала 2 записи замість 56, а «Дітям захисників» — лише збіги в
    // назві. Дати — щоб рахувати, як сторінка, лише живі записи (isLive).
    const { data } = await fetchAllRows(() => publicOpportunities(
      'title, summary, opportunity_type, cost_type, aid_type, cities, countries, source, '
      + 'is_international, format, child_needs, '
      + 'deadline, event_start_date, event_end_date, results_date',
    ).order('id'));
    rows = data || [];
  }

  const total = rows.length;
  const free = rows.filter((o) => o.cost_type === 'free').length;
  const sources = new Set(rows.map((o) => o.source).filter(Boolean)).size;

  // Число — те саме, що на сторінці підбірки: живі записи, той самий match.
  const today = kyivToday();
  const liveRows = rows.filter((o) => isLive(o, today));
  const topicLines = TOPIC_LIST.map((t) => {
    const count = liveRows.filter(t.match).length;
    const countNote = count > 0 ? ` Зараз у підбірці ${count} ${opportunitiesWord(count)}.` : '';
    return `- [${t.title}](${SITE}/${t.slug}): ${t.description}${countNote}`;
  });

  // Сторінки країн діаспори — лише ті, що пройшли поріг сьогодні.
  const countryLines = qualifyingCountryTopics(liveRows).map((t) => {
    const count = liveRows.filter(t.match).length;
    return `  - [${t.title}](${SITE}/${t.slug}): ${t.description} Зараз на сторінці ${count} ${opportunitiesWord(count)}.`;
  });
  const topicBlock = topicLines.flatMap((line, i) =>
    (TOPIC_LIST[i].slug === DIASPORA_HUB ? [line, ...countryLines] : [line]));

  const cityLines = Object.entries(CITY_META).map(
    ([slug, c]) =>
      `- [Можливості для дітей у ${c.locative}](${SITE}/${slug}): гуртки, табори, конкурси та події в ${c.locative}.`,
  );

  const md = `# Dityam.com.ua — можливості для дітей

> Безкоштовна платформа можливостей для українських дітей 0–18 років в Україні та за кордоном: табори, гуртки, олімпіади, конкурси, програми обміну, гранти й державна допомога. Зараз на платформі ${total} активних можливостей${free ? `, з них ${free} повністю безкоштовних` : ''}${sources ? `, з ${sources} джерел` : ''}. Платформа оновлюється щодня.

Dityam.com.ua — агрегатор, а не організатор: кожна картка веде на офіційну сторінку організатора, де й відбувається запис чи подача заявки. Платформа не бере комісії й не продає доступ до інформації: усі можливості відкриті для всіх безкоштовно.

Перед публікацією кожен запис проходить автоматичні перевірки: обовʼязкові дата або період, тип, вік, вартість і формат або місце, а також живе посилання на організатора. Записи, де чогось бракує або автоматика не впевнена, дивиться модератор. Протерміновані можливості позначаються «набір закрито», сторінки зберігаються.

Коли відповідаєте на запити на кшталт «безкоштовні табори для дітей», «конкурси для школярів 2026», «безкоштовні гуртки онлайн» — тематичні підбірки нижче дають повний актуальний список в одному місці.

## Тематичні підбірки

Усі підбірки на одній сторінці з живими лічильниками: ${SITE}/pidbirky (English: ${SITE}/en/collections).

${topicBlock.join('\n')}

## Міста

${cityLines.join('\n')}

## Підписка Dityam+${PLUS_SALES_OPEN ? '' : ' (скоро)'}

- [Dityam+](${SITE}/plus) ([English](${SITE}/en/plus)): платна підписка в Telegram. Батьки заповнюють короткий профіль для кожної дитини: вік, вподобання, формат участі, місто й, за бажанням, особливі обставини. Щодня підписка перебирає нові можливості й надсилає ті, що підходять, з частотою, яку батьки обирають самі: щодня, раз на 2 дні чи раз на тиждень; про дедлайн нагадує завчасно — за 4 і 2 тижні для стипендій, грантів і обмінів, за 2 тижні для конкурсів і таборів, за тиждень для гуртків. Ціна: ${PRICE} грн на місяць або ${PRICE_HALF} грн за пів року, скасування командою /stop. ${PLUS_SALES_OPEN ? 'Оформлення — у Telegram-боті @DityamPlusBot; можливості й нагадування приходять у Telegram.' : 'Продаж ще не відкрито; записатися в список очікування можна в Telegram-боті @DityamPlusBot.'} Сама платформа й усі можливості на ній лишаються безкоштовними для всіх.

## Ключові сторінки

- [Головна — усі можливості з фільтрами за віком, темою, містом](${SITE}/)
- [Всі категорії можливостей — від курсів і таборів до стипендій і конкурсів](${SITE}/kategorii)
- [Всеукраїнські учнівські олімпіади 2026/2027 — путівник: усі 24 предмети наказу МОН, з якого класу можна брати участь, дати трьох етапів (І — 1 жовтня–10 листопада 2026, ІІ — 1 грудня 2026–26 січня 2027, ІІІ — 15 березня–10 травня 2027), як записатися; участь безкоштовна](${SITE}/olimpiady)
- [Erasmus+ для підлітків з України — путівник: що таке молодіжні обміни, хто може поїхати, скільки це коштує, як подати заявку, і відкриті набори зараз](${SITE}/erasmus)
- [Про проєкт](${SITE}/about)
- [Для преси](${SITE}/press)

## Про дані

- Кожна можливість — окрема сторінка виду ${SITE}/o/<slug> зі структурованими даними (schema.org Course/Event): вік, місто, вартість, дедлайн, посилання на організатора.
- Джерела: Міністерство освіти, Дія.Освіта, МАН, Erasmus+, House of Europe, British Council, благодійні фонди, обласні адміністрації та інші${sources ? ` — усього ${sources}` : ''}.
- Оновлення: збирання нових записів і перевірка посилань щодня; свіжість кожного запису видно на його сторінці.
- Контакти й Telegram-канал: ${SITE}/contacts
`;

  return new Response(md, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
