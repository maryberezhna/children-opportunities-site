// Розкласти довгий пост каналу на кілька повідомлень (Марія, 26.10.2026: «треба
// публікувати всі записи з потрібним дедлайном»). До того «⏰ Дедлайни цього тижня»
// брали до 6 записів і відкидали решту, щоб умістити 4096 знаків Telegram, — а
// тижнів із 10–15 дедлайнами в жовтні–листопаді більшість.
//
// Чиста функція, без мережі й бази: її читають тести на голому node.

const visible = (lines) => lines.join('\n').replace(/<[^>]+>/g, '').length;

/**
 * sections: [{ heading, contHeading, rows }] — рядки кожного розділу йдуть по
 * порядку; footer — рядки в кінець останнього повідомлення.
 * Повертає масив повідомлень, кожне — масив рядків. Жоден рядок не губиться:
 * не вміщається — переноситься в наступне повідомлення з contHeading.
 */
export function chunkPost(sections, footer = [], limit = 3900) {
  const footerLen = footer.length ? visible(['', ...footer]) : 0;
  const messages = [];
  let cur = [];
  const close = () => { if (cur.length) messages.push(cur); cur = []; };
  for (const s of sections) {
    if (!s.rows.length) continue;
    let started = false;
    for (const row of s.rows) {
      const head = started ? null : s.heading;
      const add = [...(cur.length ? [''] : []), ...(head ? [head, ''] : []), row];
      if (cur.length && visible([...cur, ...add]) + footerLen > limit) {
        close();
        cur.push(started ? s.contHeading : s.heading, '', row);
      } else {
        cur.push(...add);
      }
      started = true;
    }
  }
  // Місце під футер зарезервоване під час складання, тож він завжди лягає в
  // останнє повідомлення.
  if (!cur.length) return messages;
  if (footer.length) cur.push('', ...footer);
  messages.push(cur);
  return messages;
}
