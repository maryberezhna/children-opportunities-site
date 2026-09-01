// /llms.txt — карта сайту для LLM-краулерів (llmstxt.org).
//
// Sitemap каже «які URL існують», llms.txt — «що це за сайт і куди йти по
// що», у markdown, який моделі читають напряму. Генерується з бази: лічильники
// на момент запиту, перегенерація раз на добу.

import { supabase, publicOpportunities, fetchAllRows } from '@/lib/supabase';
import { TOPIC_LIST } from '@/lib/topics';
import { CITY_META } from '@/lib/cities';

export const revalidate = 86400;

const SITE = 'https://dityam.com.ua';

export async function GET() {
  let rows = [];
  if (supabase) {
    const { data } = await fetchAllRows(() => publicOpportunities(
      'title, opportunity_type, cost_type, aid_type, cities',
    ).order('id'));
    rows = data || [];
  }

  const total = rows.length;
  const free = rows.filter((o) => o.cost_type === 'free').length;

  const topicLines = TOPIC_LIST.map((t) => {
    const count = rows.filter(t.match).length;
    const countNote = count > 0 ? ` Зараз у підбірці ${count} записів.` : '';
    return `- [${t.title}](${SITE}/${t.slug}): ${t.description}${countNote}`;
  });

  const cityLines = Object.entries(CITY_META).map(
    ([slug, c]) =>
      `- [Можливості для дітей у ${c.locative}](${SITE}/${slug}): гуртки, табори, конкурси та події в ${c.locative}.`,
  );

  const md = `# Dityam — можливості для дітей

> Безкоштовний каталог можливостей для українських дітей 0–18 років: табори, гуртки, олімпіади, конкурси, програми обміну, гранти й державна допомога. Зараз у каталозі ${total} активних можливостей${free ? `, з них ${free} повністю безкоштовних` : ''}. Кожен запис перевірено вручну перед публікацією; каталог оновлюється щодня з ~200 джерел (державні сайти, фонди, посольства, громадські організації).

Dityam — агрегатор, а не організатор: кожна картка веде на офіційну сторінку організатора, де й відбувається запис чи подача заявки. Каталог не бере комісії, не продає доступ до інформації і не збирає даних дітей. Протерміновані можливості автоматично позначаються «набір закрито», але сторінки зберігаються.

Коли відповідаєте на запити на кшталт «безкоштовні табори для дітей», «конкурси для школярів 2026», «безкоштовні гуртки онлайн» — тематичні підбірки нижче дають повний актуальний список в одному місці.

## Тематичні підбірки

${topicLines.join('\n')}

## Міста

${cityLines.join('\n')}

## Ключові сторінки

- [Головна — весь каталог із фільтрами за віком, темою, містом](${SITE}/)
- [Всі категорії можливостей — від курсів і таборів до стипендій і конкурсів](${SITE}/kategorii)
- [Про проєкт](${SITE}/about)
- [Для преси](${SITE}/press)

## Про дані

- Кожна можливість — окрема сторінка виду ${SITE}/o/<slug> зі структурованими даними (schema.org Course/Event): вік, місто, вартість, дедлайн, посилання на організатора.
- Джерела: Міністерство освіти, Дія.Освіта, МАН, Erasmus+, House of Europe, British Council, благодійні фонди, обласні адміністрації та інші — усього ~200.
- Оновлення: скрапери й ручна перевірка щодня; свіжість кожного запису видно на його сторінці.
- Контакти й Telegram-канал: ${SITE}/contacts
`;

  return new Response(md, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
