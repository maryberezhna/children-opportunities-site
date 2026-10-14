// Відгук одним натиском (Марія, 14.10.2026: «нам треба простіше, і щоб їм
// було не важко нажати, що сподобалося, а що ні»; «хоч люди й не люблять, нам
// треба живий зворотний звʼязок»).
//
// Після диплома в Telegram бот питає «Як вам олімпіада з логіки?» — 3 кнопки.
// Перший натиск зберігається одразу (product_feedback) і йде в адмін-чат
// «⭐ Відгук …»; на це сповіщення можна відповісти реплаєм — відповідь піде
// людині від @DityamPlusBot (app/api/telegram/webhook). Далі — необовʼязкові
// теги «Що саме?»: кожен натиск теж зберігається одразу, «Готово» не треба.
// Текст людина може просто написати в чат — він і так приходить адміну.
//
// Емодзі — лише на кнопках: у тексті бота частина з них показується кодом.

export const FB_RATINGS = {
  good: '😍 Сподобалось',
  meh: '😐 Так собі',
  bad: '🙁 Не сподобалось',
};

export const FB_TAGS = {
  tasks: 'Завдання',
  level: 'Складність',
  diploma: 'Диплом',
  time: 'Час',
  other: 'Інше',
};

// Короткий код продукту в callback_data (до 64 байтів разом із токеном).
export const FB_PRODUCTS = {
  ol: { key: 'olimpiada', name: 'олімпіада з логіки', question: 'Як вам олімпіада з логіки?' },
};

export const FB_ADMIN_HEAD = '⭐ Відгук';

const TOKEN_RE = /^[a-f0-9]{16,64}$/i;

export function fbRatingKeyboard(code, token) {
  return [Object.entries(FB_RATINGS).map(([v, text]) => ({ text, callback_data: `fb:r:${code}:${token}:${v}` }))];
}

export function fbTagsKeyboard(code, token, chosen = []) {
  const btn = ([v, label]) => ({ text: chosen.includes(v) ? `✓ ${label}` : label, callback_data: `fb:t:${code}:${token}:${v}` });
  const all = Object.entries(FB_TAGS);
  return [all.slice(0, 3).map(btn), all.slice(3).map(btn)];
}

/** fb:r:ol:<token>:good → { kind, code, product, token, value } або null. */
export function parseFbData(data) {
  const m = String(data || '').match(/^fb:([rt]):([a-z]+):([^:]+):([a-z]+)$/);
  if (!m) return null;
  const [, kind, code, token, value] = m;
  const product = FB_PRODUCTS[code];
  if (!product || !TOKEN_RE.test(token)) return null;
  if (kind === 'r' && !FB_RATINGS[value]) return null;
  if (kind === 't' && !FB_TAGS[value]) return null;
  return { kind, code, product, token, value };
}

export const fbQuestionText = (code) =>
  `${FB_PRODUCTS[code].question}\n\nОдин натиск — і ми знатимемо, що робити краще.`;

export const fbTagsText = (rating) =>
  `Дякуємо! Записали: ${FB_RATINGS[rating]}\n\nЩо саме? Можна обрати кілька — або нічого.\nЯкщо хочете, напишіть кількома словами в чат — ми прочитаємо кожне.`;

/** Перший рядок сповіщення закінчується chat id — за ним webhook шле реплай. */
export const fbAdminText = ({ product, childName, rating, chatId }) =>
  `${FB_ADMIN_HEAD} · ${product.name} · ${chatId}:\n${childName || '—'} · ${FB_RATINGS[rating]}\n\n↩️ Відповідайте реплаєм — відповідь піде людині від @DityamPlusBot.`;

/**
 * Натиск на кнопку відгуку. true — оброблено.
 * deps: { supabase, notifyAdmin(text) }.
 */
export async function handleFeedbackCallback(bot, cbq, { supabase, notifyAdmin } = {}) {
  const parsed = parseFbData(cbq?.data);
  if (!parsed) return false;
  const chatId = String(cbq.message.chat.id);
  const messageId = cbq.message.message_id;
  const { kind, code, product, token, value } = parsed;
  if (!supabase) { await bot.answerCallback(cbq.id, 'Спробуйте за хвилину'); return true; }

  if (kind === 'r') {
    const { data: entry } = await supabase.from('olimpiada_entries')
      .select('child_name, telegram_chat_id').eq('token', token).maybeSingle();
    // Кнопку надсилали в чат цього запису — чужий токен не приймаємо.
    if (!entry || String(entry.telegram_chat_id || '') !== chatId) { await bot.answerCallback(cbq.id); return true; }
    await supabase.from('product_feedback').upsert({
      product: product.key, entry_token: token, telegram_chat_id: chatId,
      child_name: entry.child_name, rating: value, updated_at: new Date().toISOString(),
    }, { onConflict: 'product,entry_token' });
    await bot.answerCallback(cbq.id, 'Дякуємо!');
    await bot.editMessage(chatId, messageId, fbTagsText(value), fbTagsKeyboard(code, token));
    if (notifyAdmin) await notifyAdmin(fbAdminText({ product, childName: entry.child_name, rating: value, chatId })).catch(() => {});
    return true;
  }

  // Тег: натиск додає, повторний — знімає. Без рядка з оцінкою тег не пишемо.
  const { data: row } = await supabase.from('product_feedback')
    .select('id, tags, rating, telegram_chat_id').eq('product', product.key).eq('entry_token', token).maybeSingle();
  if (!row || String(row.telegram_chat_id || '') !== chatId) { await bot.answerCallback(cbq.id); return true; }
  const tags = row.tags || [];
  const next = tags.includes(value) ? tags.filter((t) => t !== value) : [...tags, value];
  await supabase.from('product_feedback').update({ tags: next, updated_at: new Date().toISOString() }).eq('id', row.id);
  await bot.answerCallback(cbq.id, next.includes(value) ? 'Записали' : 'Прибрали');
  await bot.editMessage(chatId, messageId, fbTagsText(row.rating), fbTagsKeyboard(code, token, next));
  return true;
}
