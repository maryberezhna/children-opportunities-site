// Діалогова анкета Dityam+ у Telegram-боті.
//
// З 14.09.2026 — профіль для кожної дитини окремо:
//   про кожну дитину: вік → що подобається → формат → особливі обставини
//   → «додати ще дитину?»
//   один раз на родину: де шукати → чи показувати платне.
//
// Чому так. Раніше був один профіль на родину, і родина з дитиною 6 і
// підлітком 15 отримувала обмін для старшокласників на малюка. Місце й
// вартість питаємо один раз: живе родина в одному місці, бюджет теж один.
//
// Стать дитини питали колись давно, але нею ніде не користувались — питання
// прибрано. Імені й школи не питаємо: дітей розрізняємо за номером.
//
// Незалежна від конкретного бота: приймає `bot` (обгортку над Bot API) і
// supabase-клієнт. Стан — у digest_subscribers.flow_step / flow_child_id /
// flow_mode. handleFlowCallback повертає { finished }, а що робити далі
// (оплата чи меню) вирішує бот, який знає статус підписки.

import {
  AGE_OPTIONS, LIKE_OPTIONS, FORMAT_OPTIONS, NEED_OPTIONS, MAX_CHILDREN,
  PSEUDO_CITIES, PLACE_ONLINE, PLACE_ABROAD, PLACE_OTHER, childLabel,
} from './plusProfile.js';

export const FLOW_COST = [['any', 'Будь-які'], ['free_only', 'Лише безкоштовні']];

// Кнопки міст беремо з живої бази, а не зі списку в коді: список у коді
// застаріває, а кнопка міста, де в нас нічого немає, — порожня обіцянка.
const MIN_CITY_ITEMS = 20;
const MAX_CITY_BUTTONS = 8;
let cityCache = { at: 0, list: [] };

async function cityOptions(supabase) {
  if (Date.now() - cityCache.at < 60 * 60 * 1000 && cityCache.list.length) return cityCache.list;
  const counts = new Map();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('opportunities')
      .select('cities').eq('status', 'active').is('canonical_slug', null)
      .order('id').range(from, from + 999);
    if (error || !data) break;
    for (const r of data) {
      for (const c of r.cities || []) {
        if (!PSEUDO_CITIES.has(c)) counts.set(c, (counts.get(c) || 0) + 1);
      }
    }
    if (data.length < 1000) break;
  }
  const list = [...counts.entries()]
    .filter(([, n]) => n >= MIN_CITY_ITEMS)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_CITY_BUTTONS)
    .map(([c]) => [c, c]);
  cityCache = { at: Date.now(), list };
  return list;
}

const placeOptions = (cities) => [
  ...cities,
  [PLACE_OTHER, 'Мого міста немає'],
  [PLACE_ONLINE, '💻 Онлайн'],
  [PLACE_ABROAD, '✈️ За кордоном'],
];

const labelOf = (options, v) => (options.find((x) => x[0] === v) || [null, v])[1];
const listOf = (options, values) => (values || []).map((v) => labelOf(options, v)).join(', ');

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

function singleKb(prefix, options, rowSize = 2) {
  const rows = []; let row = [];
  for (const [v, l] of options) {
    row.push({ text: l, callback_data: `flow:${prefix}:${v}` });
    if (row.length === rowSize) { rows.push(row); row = []; }
  }
  if (row.length) rows.push(row);
  return { inline_keyboard: rows };
}

// Про другу й наступних дітей питаємо з номером, щоб батьки не плутались,
// про яку дитину зараз відповідають.
const who = (child, mode) => (child.position > 1 || mode === 'add' ? `Дитина ${child.position}. ` : '');

const Q = {
  age: (p) => `👶 <b>${p}Скільки років дитині?</b>\nОберіть один або кілька діапазонів, тоді «Далі».`,
  like: (p) => `🎯 <b>${p}Що подобається дитині?</b>\nОберіть кілька тем, тоді «Далі». Якщо цікаво все — просто «Далі».`,
  fmt: (p) => `🧩 <b>${p}Який формат підходить?</b>\nОберіть один або кілька, тоді «Далі». Підходить будь-який — просто «Далі».`,
  need: (p) => `🤝 <b>${p}Чи є в дитини особливі обставини?</b>\nНеобовʼязково. Питаємо лише для того, щоб показати програми з окремим набором саме для таких дітей. Нічого з цього — просто «Далі».`,
  place: '📍 <b>Де шукати можливості?</b>\nОберіть місто, онлайн чи за кордоном, можна кілька. Тоді «Далі». Підходить будь-де — просто «Далі».',
  cost: '💳 <b>Показувати платні можливості чи лише безкоштовні?</b>',
};

async function loadSub(supabase, chatId) {
  const { data } = await supabase.from('digest_subscribers').select('*')
    .eq('telegram_chat_id', String(chatId)).maybeSingle();
  return data;
}

async function loadChildren(supabase, subId) {
  const { data } = await supabase.from('plus_children').select('*')
    .eq('subscriber_id', subId).order('position');
  return data || [];
}

async function askChild(bot, chatId, step, child, mode) {
  const p = who(child, mode);
  if (step === 'age') return bot.sendMessage(chatId, Q.age(p), multiKb('age', AGE_OPTIONS, child.age_bands));
  if (step === 'like') return bot.sendMessage(chatId, Q.like(p), multiKb('like', LIKE_OPTIONS, child.likes));
  if (step === 'fmt') return bot.sendMessage(chatId, Q.fmt(p), multiKb('fmt', FORMAT_OPTIONS, child.formats, 1));
  if (step === 'need') return bot.sendMessage(chatId, Q.need(p), multiKb('need', NEED_OPTIONS, child.needs));
  return null;
}

async function askMore(bot, chatId, children) {
  const last = children[children.length - 1];
  const buttons = [];
  if (children.length < MAX_CHILDREN) buttons.push([{ text: '➕ Додати ще дитину', callback_data: 'flow:more:add' }]);
  buttons.push([{ text: 'Далі ➡️', callback_data: 'flow:more:__done' }]);
  const name = children.length > 1 ? childLabel(last, children.length) : 'дитини';
  await bot.sendMessage(chatId,
    `✅ <b>Профіль ${children.length > 1 ? `«${name}»` : name} готовий.</b>\nЄ ще діти, для яких шукати можливості?`,
    { inline_keyboard: buttons });
}

async function newChild(supabase, sub, position, mode) {
  const { data: child, error } = await supabase.from('plus_children')
    .insert({ subscriber_id: sub.id, position }).select('*').single();
  if (error || !child) return null;
  await supabase.from('digest_subscribers').update({
    flow_step: 'age', flow_child_id: child.id, flow_mode: mode, updated_at: new Date().toISOString(),
  }).eq('id', sub.id);
  return child;
}

// Повна анкета з нуля: стирає дітей і відповіді про місце.
export async function beginFlow(bot, supabase, chatId, handle) {
  const sub = await loadSub(supabase, chatId);
  if (!sub) return;
  await supabase.from('plus_children').delete().eq('subscriber_id', sub.id);
  await supabase.from('digest_subscribers').update({
    places: [], age_bands: [], interests: [], updated_at: new Date().toISOString(),
    ...(handle ? { telegram_handle: handle } : {}),
  }).eq('id', sub.id);
  const child = await newChild(supabase, sub, 1, 'full');
  if (!child) { await bot.sendMessage(chatId, 'Не вдалося почати анкету. Спробуйте /start ще раз.'); return; }
  await bot.sendMessage(chatId,
    '🧡 <b>Налаштуймо добірку</b>\n\n'
    + 'Кілька коротких питань про дитину, потім про місто й вартість. '
    + 'Якщо дітей кілька — після першої запропоную додати наступну.\n\n'
    + 'Імені дитини й школи не питаємо.');
  await askChild(bot, chatId, 'age', child, 'full');
}

// Додати ще одну дитину до готового профілю, не чіпаючи решти.
export async function beginAddChild(bot, supabase, chatId) {
  const sub = await loadSub(supabase, chatId);
  if (!sub) return;
  const children = await loadChildren(supabase, sub.id);
  if (children.length >= MAX_CHILDREN) {
    await bot.sendMessage(chatId, `У профілі вже ${MAX_CHILDREN} дітей — це максимум.`);
    return;
  }
  const position = (children[children.length - 1]?.position || 0) + 1;
  const child = await newChild(supabase, sub, position, 'add');
  if (!child) { await bot.sendMessage(chatId, 'Не вдалося додати дитину. Спробуйте ще раз.'); return; }
  await askChild(bot, chatId, 'age', child, 'add');
}

export async function finishFlow(bot, chatId, { active = true } = {}) {
  if (!active) {
    await bot.sendMessage(chatId, '🎉 <b>Профіль готовий!</b>\n\nЛишився останній крок — оформити підписку.');
    return;
  }
  await bot.sendMessage(chatId,
    '🎉 <b>Профіль готовий!</b>\n\n'
    + '• ⚡ надішлемо можливість, щойно вона зʼявиться, — під кожну дитину окремо\n'
    + '• ⏰ нагадаємо про дедлайн завчасно: за 2–4 тижні для стипендій і обмінів, за тиждень для гуртків\n'
    + '• 📝 допоможемо із заявкою — просто напишіть сюди\n\n'
    + 'Змінити відповіді — /start · Відписатися — /stop');
}

const CHILD_STEPS = {
  age: { col: 'age_bands', options: AGE_OPTIONS, next: 'like', title: '👶 Вік', required: true },
  like: { col: 'likes', options: LIKE_OPTIONS, next: 'fmt', title: '🎯 Подобається' },
  fmt: { col: 'formats', options: FORMAT_OPTIONS, next: 'need', title: '🧩 Формат', rowSize: 1 },
  need: { col: 'needs', options: NEED_OPTIONS, next: 'more', title: '🤝 Обставини' },
};

// Обробка натискань кнопок анкети (callback_data починається з "flow:").
// Повертає { finished: true }, коли анкету завершено.
export async function handleFlowCallback(bot, supabase, cbq) {
  const chatId = String(cbq.message.chat.id);
  const mid = cbq.message.message_id;
  const [, step, ...rest] = (cbq.data || '').split(':');
  const val = rest.join(':');
  const sub = await loadSub(supabase, chatId);
  if (!sub) { await bot.answerCallback(cbq.id, 'Почніть з /start'); return { finished: false }; }
  const saveSub = (patch) => supabase.from('digest_subscribers')
    .update({ ...patch, updated_at: new Date().toISOString() }).eq('id', sub.id);

  // Кнопка зі старої анкети або з уже пройденого кроку.
  if (sub.flow_step !== step) {
    await bot.answerCallback(cbq.id, 'Ця анкета вже неактуальна — надішліть /start');
    return { finished: false };
  }

  if (CHILD_STEPS[step]) {
    const spec = CHILD_STEPS[step];
    const { data: child } = await supabase.from('plus_children').select('*')
      .eq('id', sub.flow_child_id).maybeSingle();
    if (!child) { await bot.answerCallback(cbq.id, 'Почніть з /start'); return { finished: false }; }
    const p = who(child, sub.flow_mode);

    if (val === '__done') {
      if (spec.required && !(child[spec.col] || []).length) {
        await bot.answerCallback(cbq.id, 'Оберіть хоча б один вік');
        return { finished: false };
      }
      await bot.answerCallback(cbq.id);
      const chosen = listOf(spec.options, child[spec.col]) || 'будь-що';
      await bot.editMessage(chatId, mid, `${spec.title}: <b>${p}${chosen}</b> ✅`);
      await saveSub({ flow_step: spec.next });
      if (spec.next === 'more') await askMore(bot, chatId, await loadChildren(supabase, sub.id));
      else await askChild(bot, chatId, spec.next, child, sub.flow_mode);
      return { finished: false };
    }

    if (!spec.options.some(([v]) => v === val)) { await bot.answerCallback(cbq.id); return { finished: false }; }
    const cur = new Set(child[spec.col] || []);
    cur.has(val) ? cur.delete(val) : cur.add(val);
    const arr = [...cur];
    await supabase.from('plus_children')
      .update({ [spec.col]: arr, updated_at: new Date().toISOString() }).eq('id', child.id);
    await bot.answerCallback(cbq.id);
    const text = Q[step](p);
    await bot.editMessage(chatId, mid, text, multiKb(step, spec.options, arr, spec.rowSize || 2));
    return { finished: false };
  }

  if (step === 'more') {
    await bot.answerCallback(cbq.id);
    const children = await loadChildren(supabase, sub.id);
    if (val === 'add') {
      if (children.length >= MAX_CHILDREN) {
        await bot.editMessage(chatId, mid, `У профілі вже ${MAX_CHILDREN} дітей — це максимум.`);
      } else {
        await bot.editMessage(chatId, mid, '➕ Додаємо ще дитину');
        const child = await newChild(supabase, sub, children[children.length - 1].position + 1, sub.flow_mode);
        if (child) await askChild(bot, chatId, 'age', { ...child }, 'add');
      }
      return { finished: false };
    }
    await bot.editMessage(chatId, mid, `👧 Дітей у профілі: <b>${children.length}</b> ✅`);
    // «Додати дитину» з меню: місце й вартість уже відомі, не перепитуємо.
    if (sub.flow_mode === 'add') {
      await saveSub({ flow_step: null, flow_child_id: null, flow_mode: null });
      return { finished: true };
    }
    await saveSub({ flow_step: 'place', flow_child_id: null });
    const cities = await cityOptions(supabase);
    await bot.sendMessage(chatId, Q.place, multiKb('place', placeOptions(cities), sub.places || []));
    return { finished: false };
  }

  if (step === 'place') {
    const options = placeOptions(await cityOptions(supabase));
    if (val === '__done') {
      await bot.answerCallback(cbq.id);
      await bot.editMessage(chatId, mid, `📍 Де: <b>${listOf(options, sub.places) || 'будь-де'}</b> ✅`);
      await saveSub({ flow_step: 'cost' });
      await bot.sendMessage(chatId, Q.cost, singleKb('cost', FLOW_COST, 2));
      return { finished: false };
    }
    if (!options.some(([v]) => v === val)) { await bot.answerCallback(cbq.id); return { finished: false }; }
    const cur = new Set(sub.places || []);
    cur.has(val) ? cur.delete(val) : cur.add(val);
    const arr = [...cur];
    await saveSub({ places: arr });
    await bot.answerCallback(cbq.id);
    await bot.editMessage(chatId, mid, Q.place, multiKb('place', options, arr));
    return { finished: false };
  }

  if (step === 'cost') {
    const c = val === 'free_only' ? 'free_only' : 'any';
    await saveSub({
      cost_pref: c, flow_step: null, flow_child_id: null, flow_mode: null,
      consent_at: sub.consent_at || new Date().toISOString(),
    });
    await bot.answerCallback(cbq.id, 'Готово!');
    await bot.editMessage(chatId, mid, `💳 <b>${labelOf(FLOW_COST, c)}</b> ✅`);
    return { finished: true };
  }

  await bot.answerCallback(cbq.id);
  return { finished: false };
}
