// Рендер поля `details` — розгорнутого матеріалу під сторінку можливості.
//
// Свідомо НЕ підключаю markdown-бібліотеку: потрібні рівно чотири конструкції,
// а будь-який парсер тягне в бандл десятки кілобайт і відкриває шлях довільному
// HTML у тексті, який редагується через адмінку.
//
// Підтримується: ## заголовок, - список, 1. нумерований список, **жирний**,
// [текст](посилання), порожній рядок = новий абзац.

function inline(text, keyPrefix) {
  const out = [];
  // Розбираємо на **жирний** і [посилання](url) за один прохід.
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
  let last = 0;
  let m;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) {
      out.push(<strong key={`${keyPrefix}-b${i}`}>{m[1]}</strong>);
    } else {
      out.push(
        <a key={`${keyPrefix}-a${i}`} href={m[3]} target="_blank" rel="noopener noreferrer nofollow">
          {m[2]}
        </a>,
      );
    }
    last = m.index + m[0].length;
    i += 1;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export default function Details({ text }) {
  if (!text || !text.trim()) return null;

  const blocks = [];
  let list = null;      // { ordered: bool, items: [] }

  const flush = () => {
    if (!list) return;
    const Tag = list.ordered ? 'ol' : 'ul';
    blocks.push(
      <Tag key={`l${blocks.length}`} className="details-list">
        {list.items.map((it, i) => <li key={i}>{inline(it, `l${blocks.length}-${i}`)}</li>)}
      </Tag>,
    );
    list = null;
  };

  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) { flush(); continue; }

    if (line.startsWith('## ')) {
      flush();
      blocks.push(<h2 key={`h${blocks.length}`} className="details-h">{line.slice(3)}</h2>);
      continue;
    }
    const ordered = /^\d+\.\s+/.test(line);
    if (line.startsWith('- ') || ordered) {
      const item = ordered ? line.replace(/^\d+\.\s+/, '') : line.slice(2);
      if (!list || list.ordered !== ordered) { flush(); list = { ordered, items: [] }; }
      list.items.push(item);
      continue;
    }
    flush();
    blocks.push(<p key={`p${blocks.length}`}>{inline(line, `p${blocks.length}`)}</p>);
  }
  flush();

  return <div className="opportunity-details">{blocks}</div>;
}
