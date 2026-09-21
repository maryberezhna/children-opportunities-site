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
  parseCustomCities,
} from './plusProfile.js';
import { opportunitiesWord } from './plural.js';

export const FLOW_COST = [['any', 'Будь-які'], ['free_only', 'Лише безкоштовні']];

// Як часто надсилати добірку (колонка digest_subscribers.digest_freq).
// Нагадування про дедлайни від цього не залежать: пропущений дедлайн —
// це не «менше листів», а втрачена можливість.
//
// Варіанта «⚡ Щойно зʼявиться» (instant) більше немає — рішення Марії
// 21.09.2026: «зупини і видали поки». Він обіцяв «щойно зʼявиться», а
// добірка насправді йде раз на день, і розклад GitHub запізнюється на
// 4–5 годин. Старе значення instant у базі (і порожнє) читаємо як «раз на
// 2 дні» — тут через freqOf, у розсилці через personal_digest.freq_days.
export const FLOW_FREQ = [
  ['2days', '🗓 Раз на 2 дні'],
  ['weekly', '📆 Раз на тиждень'],
];
export const DEFAULT_FREQ = '2days';

/** Частота, яку показуємо й зберігаємо: невідоме чи старе instant → «раз на 2 дні». */
export const freqOf = (value) => (FLOW_FREQ.some(([v]) => v === value) ? value : DEFAULT_FREQ);

// Кнопки міст беремо з живої бази, а не зі списку в коді: список у коді
// застаріває, а кнопка міста, де в нас нічого немає, — порожня обіцянка.
const MIN_CITY_ITEMS = 20;
const MAX_CITY_BUTTONS = 8;
let cityCache = { at: 0, counts: new Map() };

// Скільки записів у кожному місті. Числа потрібні двічі: для кнопок і для
// чесної відповіді тому, хто вписав своє місто руками.
async function cityCounts(supabase) {
  if (Date.now() - cityCache.at < 60 * 60 * 1000 && cityCache.counts.size) return cityCache.counts;
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
  if (counts.size) cityCache = { at: Date.now(), counts };
  return counts;
}

async function cityOptions(supabase) {
  return [...(await cityCounts(supabase)).entries()]
    .filter(([, n]) => n >= MIN_CITY_ITEMS)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_CITY_BUTTONS)
    .map(([c]) => [c, c]);
}

// Вписане місто показуємо окремою кнопкою — щоб його було видно серед обраних
// і щоб зняти позначку можна було так само, як із будь-якого іншого міста.
const placeOptions = (cities, places) => {
  const known = new Set(cities.map(([v]) => v));
  const custom = (places || [])
    .filter((p) => p !== PLACE_ONLINE && p !== PLACE_ABROAD && p !== PLACE_OTHER && !known.has(p));
  return [
    ...cities,
    ...custom.map((c) => [c, c]),
    [PLACE_OTHER, 'Мого міста немає'],
    [PLACE_ONLINE, '💻 Онлайн'],
    [PLACE_ABROAD, '✈️ За кордоном'],
  ];
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

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

// Про кожну дитину питаємо з номером, щоб батьки не плутались, про яку дитину
// зараз відповідають. Коли кількість відома наперед — «Дитина 2 з 3».
const who = (child, mode, total = 0) => {
  if (total > 1) return `Дитина ${child.position} з ${total}. `;
  return child.position > 1 || mode === 'add' ? `Дитина ${child.position}. ` : '';
};

const Q = {
  // Спершу кількість дітей, а не вік: профіль створюється на кожну дитину
  // окремо, інакше добірка перетворюється на спільний список для всіх
  // (Марія, 19.09.2026).
  count: `👨‍👩‍👧 <b>Для скількох дітей шукаємо можливості?</b>\nДля кожної дитини заповнимо окремий профіль — тоді й добірка приходить під конкретну дитину, а не спільним списком. Ще одну дитину можна буде додати будь-коли.`,
  // Один діапазон: питання про одну конкретну дитину.
  age: (p) => `👶 <b>${p}Скільки років дитині?</b>\nОберіть діапазон.`,
  like: (p) => `🎯 <b>${p}Що подобається дитині?</b>\nОберіть кілька тем, тоді «Далі». Якщо цікаво все — просто «Далі».`,
  fmt: (p) => `🧩 <b>${p}Який формат підходить?</b>\nОберіть один або кілька, тоді «Далі». Підходить будь-який — просто «Далі».`,
  need: (p) => `🤝 <b>${p}Чи є в дитини особливі обставини?</b>\nНеобовʼязково. Питаємо лише для того, щоб показати програми з окремим набором саме для таких дітей. Нічого з цього — просто «Далі».`,
  place: '📍 <b>Де шукати можливості?</b>\nОберіть місто, онлайн чи за кордоном, можна кілька. Тоді «Далі». Підходить будь-де — просто «Далі».\nНемає вашого міста — натисніть «Мого міста немає» і впишіть його.',
  cost: '💳 <b>Показувати платні можливості чи лише безкоштовні?</b>',
  freq: '⏰ <b>Як часто надсилати добірку?</b>\nНагадування про дедлайни приходять окремо й завжди вчасно — хай яку частоту оберете.',
};

// Кнопок вісім — це міста, де записів найбільше. Решта України мала лише
// «Мого міста немає», і ми не знали, де саме живе родина. Тепер питаємо, але
// не обіцяємо зайвого: у маленькому місті можливостей може не бути зовсім.
const ASK_CITY = '✍️ <b>Напишіть своє місто</b> одним повідомленням — наприклад, «Ніжин». Можна кілька через кому.\n\n'
  + 'Скажемо чесно: саме у вашому місті можливостей може не бути. '
  + 'Тоді надсилатимемо те, що проходить по всій Україні й онлайн, — щоб ви не лишились ні з чим. '
  + 'Позначку «💻 Онлайн» ми вже поставили, зніміть її, якщо не треба.';

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

async function askChild(bot, chatId, step, child, mode, total = 0) {
  const p = who(child, mode, total);
  if (step === 'age') return bot.sendMessage(chatId, Q.age(p), singleKb('age', AGE_OPTIONS, 2));
  if (step === 'like') return bot.sendMessage(chatId, Q.like(p), multiKb('like', LIKE_OPTIONS, child.likes));
  if (step === 'fmt') return bot.sendMessage(chatId, Q.fmt(p), multiKb('fmt', FORMAT_OPTIONS, child.formats, 1));
  if (step === 'need') return bot.sendMessage(chatId, Q.need(p), multiKb('need', NEED_OPTIONS, child.needs));
  return null;
}

/** Скільки дітей — кнопки 1…MAX_CHILDREN. */
async function askCount(bot, chatId) {
  const options = Array.from({ length: MAX_CHILDREN }, (_, i) => [String(i + 1), String(i + 1)]);
  return bot.sendMessage(chatId, Q.count, singleKb('count', options, 3));
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
  await supabase.from('digest_subscribers').update({
    flow_step: 'count', flow_child_id: null, flow_mode: 'full', updated_at: new Date().toISOString(),
  }).eq('id', sub.id);
  await bot.sendMessage(chatId,
    '🧡 <b>Налаштуймо добірку</b>\n\n'
    + 'Профіль заповнюємо на <b>кожну дитину окремо</b>: вік, вподобання й формат у дітей різні, '
    + 'тож і можливості мають приходити різні. Потім одне питання про місто й вартість — воно спільне.\n\n'
    + 'Імені, прізвища, школи чи дати народження дитини не запитуємо.');
  await askCount(bot, chatId);
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

/** Змінити лише частоту — з меню підписника, без проходження анкети. */
export async function beginFreq(bot, supabase, chatId) {
  const sub = await loadSub(supabase, chatId);
  if (!sub) return;
  await supabase.from('digest_subscribers').update({
    flow_step: 'freq', flow_mode: 'freq', updated_at: new Date().toISOString(),
  }).eq('id', sub.id);
  await bot.sendMessage(chatId, Q.freq, singleKb('freq', FLOW_FREQ, 1));
}

/**
 * Перемикач нагадувань про дедлайни (digest_subscribers.deadline_reminders).
 *
 * Частота добірки (digest_freq) і нагадування — різні речі: людина може
 * хотіти тишу між добірками, але дедлайн не проґавити, або навпаки — стежити
 * за подачею самій. Тому це окремий вибір, а не наслідок частоти.
 *
 * Повертає новий стан (true — нагадування увімкнені) або null, якщо
 * підписника чи звʼязку з базою немає.
 */
export async function toggleReminders(supabase, chatId) {
  const sub = await loadSub(supabase, chatId);
  if (!sub) return null;
  const next = !remindersOn(sub);
  const { error } = await supabase.from('digest_subscribers')
    .update({ deadline_reminders: next, updated_at: new Date().toISOString() })
    .eq('id', sub.id);
  if (error) return null;
  return next;
}

// Порожнє значення читаємо як «увімкнені»: рядки, створені до появи колонки,
// нагадування отримували, і мовчати для них без вказівки людини не можна.
export function remindersOn(sub) {
  return (sub || {}).deadline_reminders !== false;
}

// Текст кнопки в меню: стан видно, не заходячи всередину.
export function remindersLabel(sub) {
  return remindersOn(sub)
    ? '🔔 Нагадування про дедлайни: увімкнені'
    : '🔕 Нагадування про дедлайни: вимкнені';
}

export function remindersToast(on) {
  return on
    ? 'Нагадуватимемо про дедлайни завчасно 🔔'
    : 'Більше не нагадуватимемо про дедлайни 🔕';
}

export async function finishFlow(bot, chatId, { active = true } = {}) {
  if (!active) {
    await bot.sendMessage(chatId, '🎉 <b>Профіль готовий!</b>\n\nЛишився останній крок — оформити підписку.');
    return;
  }
  await bot.sendMessage(chatId,
    '🎉 <b>Профіль готовий!</b>\n\n'
    + '• 🗓 надсилатимемо нові можливості з частотою, яку ви обрали, — під кожну дитину окремо\n'
    + '• ⏰ нагадаємо про дедлайн завчасно: за 2–4 тижні для стипендій і обмінів, за тиждень для гуртків\n'
    + '• 📝 допомога із заявкою — скоро\n\n'
    + 'Змінити відповіді — /start · Відписатися — /stop');
}

/**
 * Місто, вписане текстом на кроці «Де».
 *
 * Одразу кажемо, скільки записів у цьому місті є просто зараз. Обіцяти
 * «знайдемо щось саме у вас» ми не можемо, а порожнє місто краще показати до
 * оплати, ніж після неї. Написання звіряємо з базою: «київ» і «КИЇВ» стають
 * «Київ», інакше збіг за точною назвою не спрацює.
 */
export async function saveCustomCity(bot, supabase, chatId, sub, text) {
  const names = parseCustomCities(text);
  if (!names.length) {
    await bot.sendMessage(chatId,
      '✍️ Напишіть лише назву міста — наприклад, «Ніжин». Або оберіть варіант кнопкою вище.');
    return;
  }
  const counts = await cityCounts(supabase);
  const known = new Map([...counts.keys()].map((c) => [c.toLowerCase(), c]));
  const places = new Set(sub.places || []);
  const lines = [];
  let found = 0;
  for (const name of names) {
    const city = known.get(name.toLowerCase()) || name;
    const n = counts.get(city) || 0;
    found += n;
    places.add(city);
    lines.push(n
      ? `• <b>${esc(city)}</b> — зараз ${n} ${opportunitiesWord(n)}`
      : `• <b>${esc(city)}</b> — просто зараз можливостей немає`);
  }
  await supabase.from('digest_subscribers')
    .update({ places: [...places], updated_at: new Date().toISOString() }).eq('id', sub.id);
  await bot.sendMessage(chatId,
    `📍 <b>Записали:</b>\n${lines.join('\n')}\n\n`
    + (found
      ? 'Надсилатимемо і те, що проходить по всій Україні.'
      : 'Коли там зʼявиться можливість — надішлемо. А поки надсилатимемо те, що проходить по всій Україні й онлайн.')
    + '\n\nМожна дописати ще місто або натиснути «Далі ➡️» в питанні вище.');
}

const CHILD_STEPS = {
  age: { col: 'age_bands', options: AGE_OPTIONS, next: 'like', title: '👶 Вік', single: true },
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

  // Скільки дітей: одразу створюємо стільки рядків, далі йдемо по них за
  // позицією — «Дитина 1 з 3», «2 з 3», «3 з 3».
  if (step === 'count') {
    const n = Number(val);
    if (!Number.isInteger(n) || n < 1 || n > MAX_CHILDREN) { await bot.answerCallback(cbq.id); return { finished: false }; }
    await bot.answerCallback(cbq.id);
    await bot.editMessage(chatId, mid, `👨‍👩‍👧 Дітей у профілі: <b>${n}</b> ✅`);
    const { data: created } = await supabase.from('plus_children')
      .insert(Array.from({ length: n }, (_, i) => ({ subscriber_id: sub.id, position: i + 1 })))
      .select('*');
    const first = [...(created || [])].sort((a, b) => a.position - b.position)[0];
    if (!first) { await bot.sendMessage(chatId, 'Не вдалося почати анкету. Спробуйте /start ще раз.'); return { finished: false }; }
    await saveSub({ flow_step: 'age', flow_child_id: first.id, flow_mode: 'full' });
    await askChild(bot, chatId, 'age', first, 'full', n);
    return { finished: false };
  }

  if (CHILD_STEPS[step]) {
    const spec = CHILD_STEPS[step];
    const { data: child } = await supabase.from('plus_children').select('*')
      .eq('id', sub.flow_child_id).maybeSingle();
    if (!child) { await bot.answerCallback(cbq.id, 'Почніть з /start'); return { finished: false }; }
    const siblings = await loadChildren(supabase, sub.id);
    const total = sub.flow_mode === 'full' ? siblings.length : 0;
    const p = who(child, sub.flow_mode, total);

    // Вік — один діапазон на дитину: відповідь одразу веде до наступного кроку.
    if (spec.single) {
      if (!spec.options.some(([v]) => v === val)) { await bot.answerCallback(cbq.id); return { finished: false }; }
      await supabase.from('plus_children')
        .update({ [spec.col]: [val], updated_at: new Date().toISOString() }).eq('id', child.id);
      await bot.answerCallback(cbq.id);
      await bot.editMessage(chatId, mid, `${spec.title}: <b>${p}${labelOf(spec.options, val)}</b> ✅`);
      await saveSub({ flow_step: spec.next });
      await askChild(bot, chatId, spec.next, { ...child, [spec.col]: [val] }, sub.flow_mode, total);
      return { finished: false };
    }

    if (val === '__done') {
      if (spec.required && !(child[spec.col] || []).length) {
        await bot.answerCallback(cbq.id, 'Оберіть хоча б один вік');
        return { finished: false };
      }
      await bot.answerCallback(cbq.id);
      const chosen = listOf(spec.options, child[spec.col]) || 'будь-що';
      await bot.editMessage(chatId, mid, `${spec.title}: <b>${p}${chosen}</b> ✅`);
      if (spec.next !== 'more') {
        await saveSub({ flow_step: spec.next });
        await askChild(bot, chatId, spec.next, child, sub.flow_mode, total);
        return { finished: false };
      }
      // Кількість дітей відома наперед: замість «Є ще діти?» одразу беремось
      // за наступну, а коли всі пройдені — питаємо про місто й вартість.
      const next = sub.flow_mode === 'full'
        ? siblings.find((c) => c.position === child.position + 1) : null;
      if (next) {
        await saveSub({ flow_step: 'age', flow_child_id: next.id });
        await askChild(bot, chatId, 'age', next, 'full', total);
      } else if (sub.flow_mode === 'full') {
        await saveSub({ flow_step: 'place', flow_child_id: null });
        const cities = await cityOptions(supabase);
        await bot.sendMessage(chatId, Q.place, multiKb('place', placeOptions(cities, sub.places), sub.places || []));
      } else {
        await saveSub({ flow_step: 'more' });
        await askMore(bot, chatId, siblings);
      }
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
    await bot.sendMessage(chatId, Q.place, multiKb('place', placeOptions(cities, sub.places), sub.places || []));
    return { finished: false };
  }

  if (step === 'place') {
    const cities = await cityOptions(supabase);
    const options = placeOptions(cities, sub.places);
    if (val === '__done') {
      await bot.answerCallback(cbq.id);
      await bot.editMessage(chatId, mid, `📍 Де: <b>${listOf(options, sub.places) || 'будь-де'}</b> ✅`);
      await saveSub({ flow_step: 'cost' });
      await bot.sendMessage(chatId, Q.cost, singleKb('cost', FLOW_COST, 2));
      return { finished: false };
    }
    if (!options.some(([v]) => v === val)) { await bot.answerCallback(cbq.id); return { finished: false }; }
    const cur = new Set(sub.places || []);
    // «Мого міста немає» вмикає ще й онлайн: у малому місті офлайн-можливостей
    // може не бути зовсім. Позначку людина бачить у тій самій клавіатурі й
    // може зняти — на відміну від мовчазної підміни вибору.
    const askCity = val === PLACE_OTHER && !cur.has(PLACE_OTHER);
    cur.has(val) ? cur.delete(val) : cur.add(val);
    if (askCity) cur.add(PLACE_ONLINE);
    const arr = [...cur];
    await saveSub({ places: arr });
    await bot.answerCallback(cbq.id);
    await bot.editMessage(chatId, mid, Q.place, multiKb('place', placeOptions(cities, arr), arr));
    if (askCity) await bot.sendMessage(chatId, ASK_CITY);
    return { finished: false };
  }

  if (step === 'cost') {
    const c = val === 'free_only' ? 'free_only' : 'any';
    await saveSub({ cost_pref: c, flow_step: 'freq' });
    await bot.answerCallback(cbq.id);
    await bot.editMessage(chatId, mid, `💳 <b>${labelOf(FLOW_COST, c)}</b> ✅`);
    await bot.sendMessage(chatId, Q.freq, singleKb('freq', FLOW_FREQ, 1));
    return { finished: false };
  }

  if (step === 'freq') {
    // Кнопка «⚡ Щойно зʼявиться» могла лишитись у старому повідомленні
    // в чаті — натискання на неї зберігає «раз на 2 дні».
    const f = freqOf(val);
    await saveSub({
      digest_freq: f, flow_step: null, flow_child_id: null,
      consent_at: sub.consent_at || new Date().toISOString(),
      ...(sub.flow_mode === 'freq' ? {} : { flow_mode: null }),
    });
    await bot.answerCallback(cbq.id, 'Готово!');
    await bot.editMessage(chatId, mid, `⏰ <b>${labelOf(FLOW_FREQ, f)}</b> ✅`);
    // Зміна частоти з меню — не кінець анкети: «Профіль готовий!» тут зайве.
    if (sub.flow_mode === 'freq') {
      await saveSub({ flow_mode: null });
      await bot.sendMessage(chatId, 'Готово ✅ Змінити ще щось — /start');
      return { finished: false };
    }
    return { finished: true };
  }

  await bot.answerCallback(cbq.id);
  return { finished: false };
}
