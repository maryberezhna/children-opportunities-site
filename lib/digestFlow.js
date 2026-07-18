// Діалогова форма профілю дитини для Telegram-бота (age → interests → gender → cost).
// Незалежна від конкретного бота: приймає `bot` (обгортку над Bot API з певним
// токеном) і supabase-клієнт. Стан кроку — в digest_subscribers.flow_step.

export const FLOW_AGE = [['0-3', '0–3 р.'], ['4-6', '4–6 р.'], ['7-10', '7–10 р.'], ['11-14', '11–14 р.'], ['15-18', '15–18 р.']];
export const FLOW_INT = [
  ['format', 'Гуртки/курси'], ['stem', 'STEM/IT'], ['arts', 'Творчість'], ['sport', 'Спорт'],
  ['languages', 'Мови'], ['contests', 'Конкурси'], ['camps', 'Табори'], ['soft_skills', 'Soft skills'],
  ['career', "Кар'єра"], ['international', 'Міжнародні'], ['online', 'Онлайн'], ['nonformal', 'Позашкілля'],
];
export const FLOW_GENDER = [['any', 'Будь-хто'], ['boy', 'Хлопчик'], ['girl', 'Дівчинка']];
export const FLOW_COST = [['any', 'Будь-які'], ['free_only', 'Лише безкоштовні']];
const Q_AGE = '👶 <b>Скільки років дитині?</b>\nОбери один або кілька діапазонів, тоді «Далі».';
const Q_INT = '🎯 <b>Що цікавить дитину?</b>\nОбери кілька тем, тоді «Далі».';

const labelOf = (options, v) => (options.find((x) => x[0] === v) || [null, v])[1];

// Обгортка над Telegram Bot API для конкретного токена.
export function makeBot(token) {
  const TG = `https://api.telegram.org/bot${token}`;
  const post = (method, body) => fetch(`${TG}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }).catch(() => {});
  return {
    sendMessage: (chatId, text, replyMarkup) => post('sendMessage', {
      chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true,
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    }),
    editMessage: (chatId, messageId, text, replyMarkup) => post('editMessageText', {
      chat_id: chatId, message_id: messageId, text, parse_mode: 'HTML', disable_web_page_preview: true,
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    }),
    answerCallback: (id, text) => post('answerCallbackQuery', { callback_query_id: id, text, show_alert: false }),
  };
}

function multiKb(prefix, options, selected, rowSize = 2) {
  const sel = new Set(selected || []);
  const rows = []; let row = [];
  for (const [v, l] of options) {
    row.push({ text: (sel.has(v) ? '✅ ' : '') + l, callback_data: `flow:${prefix}:${v}` });
    if (row.length === rowSize) { rows.push(row); row = []; }
  }
  if (row.length) rows.push(row);
  rows.push([{ text: 'Далі ➡️', callback_data: `flow:${prefix}:__done` }]);
  return { inline_keyboard: rows };
}
function singleKb(prefix, options, rowSize = 3) {
  const rows = []; let row = [];
  for (const [v, l] of options) {
    row.push({ text: l, callback_data: `flow:${prefix}:${v}` });
    if (row.length === rowSize) { rows.push(row); row = []; }
  }
  if (row.length) rows.push(row);
  return { inline_keyboard: rows };
}

// Старт форми. handle — @username (опційно). Скидає age/interests для нового проходу.
export async function beginFlow(bot, supabase, chatId, handle) {
  await supabase.from('digest_subscribers').update({
    flow_step: 'age', age_bands: [], interests: [], updated_at: new Date().toISOString(),
    ...(handle ? { telegram_handle: handle } : {}),
  }).eq('telegram_chat_id', String(chatId));
  await bot.sendMessage(chatId, '🧡 <b>Налаштуймо підбірку</b>\n\nВідповідай на кілька питань — і надсилатимемо можливості саме для твоєї дитини. Ми не збираємо жодних точних даних дитини, лише вік та інтереси.');
  await bot.sendMessage(chatId, Q_AGE, multiKb('age', FLOW_AGE, []));
}

export async function finishFlow(bot, chatId) {
  await bot.sendMessage(chatId,
    '🎉 <b>Профіль готово!</b>\n\n• 📬 раз на 2 тижні — підбірка можливостей саме під твою дитину\n• 🎁 участь у розіграшах подарунків від партнерів\n\nЗмінити відповіді — /start · Відписатись — /stop');
}

// Обробка натискань кнопок форми (callback_data починається з "flow:").
export async function handleFlowCallback(bot, supabase, cbq) {
  const chatId = String(cbq.message.chat.id);
  const mid = cbq.message.message_id;
  const [, step, val] = (cbq.data || '').split(':');
  const { data: sub } = await supabase.from('digest_subscribers').select('*').eq('telegram_chat_id', chatId).maybeSingle();
  if (!sub) { await bot.answerCallback(cbq.id, 'Почни з /start'); return; }
  const save = (patch) => supabase.from('digest_subscribers').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', sub.id);

  if (step === 'age' || step === 'int') {
    const col = step === 'age' ? 'age_bands' : 'interests';
    const opts = step === 'age' ? FLOW_AGE : FLOW_INT;
    if (val === '__done') {
      if (!(sub[col] || []).length) { await bot.answerCallback(cbq.id, step === 'age' ? 'Обери хоча б один вік' : 'Обери хоча б один інтерес'); return; }
      await bot.answerCallback(cbq.id);
      if (step === 'age') {
        await save({ flow_step: 'interests' });
        await bot.editMessage(chatId, mid, `👶 Вік: <b>${(sub.age_bands || []).map((v) => labelOf(FLOW_AGE, v)).join(', ')}</b> ✅`);
        await bot.sendMessage(chatId, Q_INT, multiKb('int', FLOW_INT, sub.interests || []));
      } else {
        await save({ flow_step: 'gender' });
        await bot.editMessage(chatId, mid, `🎯 Інтереси: <b>${(sub.interests || []).map((v) => labelOf(FLOW_INT, v)).join(', ')}</b> ✅`);
        await bot.sendMessage(chatId, '👧 <b>Стать дитини?</b>\nВпливає мінімально — можна «Будь-хто».', singleKb('gender', FLOW_GENDER));
      }
      return;
    }
    const cur = new Set(sub[col] || []);
    cur.has(val) ? cur.delete(val) : cur.add(val);
    const arr = [...cur];
    await save({ [col]: arr });
    await bot.answerCallback(cbq.id);
    await bot.editMessage(chatId, mid, step === 'age' ? Q_AGE : Q_INT, multiKb(step, opts, arr));
    return;
  }

  if (step === 'gender') {
    const g = ['any', 'boy', 'girl'].includes(val) ? val : 'any';
    await save({ gender: g, flow_step: 'cost' });
    await bot.answerCallback(cbq.id);
    await bot.editMessage(chatId, mid, `👧 Стать: <b>${labelOf(FLOW_GENDER, g)}</b> ✅`);
    await bot.sendMessage(chatId, '💳 <b>Показувати платні можливості чи лише безкоштовні?</b>', singleKb('cost', FLOW_COST, 2));
    return;
  }

  if (step === 'cost') {
    const c = val === 'free_only' ? 'free_only' : 'any';
    await save({ cost_pref: c, flow_step: null, consent_at: new Date().toISOString() });
    await bot.answerCallback(cbq.id, 'Готово!');
    await bot.editMessage(chatId, mid, `💳 <b>${labelOf(FLOW_COST, c)}</b> ✅`);
    await finishFlow(bot, chatId);
    return;
  }

  await bot.answerCallback(cbq.id);
}
