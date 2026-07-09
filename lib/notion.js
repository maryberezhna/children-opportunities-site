// Mirror a moderation decision/comment into the Notion «Модерація» database.
// No-op unless NOTION_TOKEN + NOTION_MODERATION_DB are set, so the admin flow
// keeps working even before Notion is wired up.
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_DB = process.env.NOTION_MODERATION_DB;

const rich = (s) => (s ? [{ text: { content: String(s).slice(0, 1900) } }] : []);

export async function pushModeration({ title, comment, decision, type, url, source }) {
  if (!NOTION_TOKEN || !NOTION_DB) return { ok: false, skipped: true };
  try {
    const properties = {
      'Можливість': { title: rich(title || '—') },
      'Коментар': { rich_text: rich(comment) },
      'Тип': { rich_text: rich(type) },
      'Джерело': { rich_text: rich(source) },
    };
    if (decision) properties['Рішення'] = { select: { name: decision } };
    if (url) properties['Посилання'] = { url };

    const res = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ parent: { database_id: NOTION_DB }, properties }),
    });
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}
