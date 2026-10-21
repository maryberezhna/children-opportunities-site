// Олімпіада з логіки через Telegram (Марія, 13.10.2026: «щоб в телеграм боті
// можна було пройти безкоштовну олімпіаду… бо з імейлами проблема, перенеси
// все туди»; листи з запрошеннями й дипломами масово повертались).
//
// Шлях: посилання з сайту @DityamPlusBot?start=olimp[_<код педагога>] або
// меню «Олімпіади» → згода з правилами → імʼя дитини (force_reply) → запис у
// olimpiada_entries з telegram_chat_id, без пошти → кнопка «Почати олімпіаду».
// Після тесту диплом приходить у той самий чат (sendOlDiploma з /submit).
// Підписка не потрібна: олімпіада безкоштовна для всіх.
import { OLIMP, cleanName, levelFor, validTeacherCode, DIPLOMA_VERSION } from './olimpiada.js';
import { getStore, markPaid, teacherForEntry, SITE_URL, esc } from './olimpiada-server.js';
import { mkDb, plusEntries } from './modnyi-kod-server.js';
import { createClient } from '@supabase/supabase-js';
import { makeBot } from './digestFlow.js';
import { PLUS_BOT, PLUS_FREE } from './plus.js';
import { PRICE, PRICE_FIRST, introPriceFor } from './wayforpay.js';
import { fbRatingKeyboard, fbQuestionText } from './feedback.js';

export const OL_NAME_PROMPT = 'Як звати дитину для диплома олімпіади з логіки?';
const UTM = 'utm_source=telegram&utm_medium=social&utm_campaign=dityam_plus&utm_content=olimpiada';
export const olTestUrl = (token) => `${SITE_URL}/olimpiada/test?t=${token}&${UTM}`;

/** /start olimp або olimp_<код педагога> → { teacher } ; інше → null. */
export function olStartArg(arg) {
  const m = String(arg || '').match(/^olimp(?:_([A-Za-z0-9]+))?$/i);
  if (!m) return null;
  return { teacher: validTeacherCode(m[1]) ? m[1] : null };
}

/** Код класу останньої дитини з цього чату, записаної за посиланням педагога. */
export const lastTeacherCode = (kids) => {
  for (let i = (kids || []).length - 1; i >= 0; i -= 1) {
    if (validTeacherCode(kids[i]?.teacher_code)) return kids[i].teacher_code;
  }
  return null;
};

/** Код педагога з тексту підказки (рядок «Код класу: …»). */
export const teacherFromPrompt = (prompt) => {
  const c = (String(prompt || '').match(/Код класу: (\S+)/) || [])[1];
  return validTeacherCode(c) ? c : null;
};

function db() {
  const store = getStore();
  return store && !store.dev ? store : null;
}

// cache: 'no-store' — Next кешує GET-запити Supabase навіть у динамічних
// маршрутах (так було з олімпіадою 06.10.2026), а тут потрібен свіжий стан.
const freshFetch = (url, opts) => fetch(url, { ...opts, cache: 'no-store' });
async function sb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false }, global: { fetch: freshFetch } });
}

async function entriesForChat(chatId) {
  const client = await sb();
  if (!client) return [];
  const { data } = await client.from('olimpiada_entries')
    .select('token, child_name, started_at, finished_at, score, max_score, level, created_at, teacher_code')
    .eq('telegram_chat_id', String(chatId)).eq('olimp', OLIMP.slug)
    .order('created_at', { ascending: true }).limit(200);
  return data || [];
}

// Кроки воронки з бота — у site_events, як і з сайту (13.10.2026, «повісь
// аналітику тут»). Лише назва кроку й звідки, без даних людини. Не кидає.
export async function olEvent(name, source = null) {
  try {
    const client = await sb();
    if (client) await client.from('site_events').insert(source ? { name, source } : { name });
  } catch { /* лічильник — не привід падати */ }
}

/** Рядки кнопок для екрана «Олімпіади»: діти, що вже записані, + «Записати». */
export async function olRows(chatId) {
  const kids = await entriesForChat(chatId).catch(() => []);
  // Вчитель може записати клас — у меню лише 10 останніх, щоб не стіна кнопок.
  const rows = kids.slice(-10).map((k) => [{
    text: `🧩 ${k.child_name}: ${k.finished_at ? `диплом · ${k.score}/${k.max_score}` : k.started_at ? 'тест розпочато' : 'тест'}`,
    url: olTestUrl(k.token),
  }]);
  rows.push([{ text: kids.length ? '🧩 Записати ще дитину на олімпіаду з логіки' : '🧩 Записати дитину на олімпіаду з логіки', callback_data: 'ol:start' }]);
  return rows;
}

/** Перший екран після /start olimp: що це, згода, кнопка. */
export async function sendOlIntro(bot, chatId, teacher = null) {
  await olEvent('olimp_bot_start', teacher ? 'teacher' : 'page');
  await bot.sendMessage(chatId, [
    `🧩 <b>Онлайн-олімпіада з логіки</b> для дітей ${OLIMP.groupLabel}`,
    '',
    `Безкоштовно. ${OLIMP.questionCount} завдань із варіантами відповідей за ${OLIMP.minutes} хвилин і 1 відкрите завдання без таймера, онлайн у зручний час. Диплом з результатом надішлемо сюди одразу після тесту.`,
    '',
    'Дитину записують батьки чи вчитель: натисніть кнопку нижче й напишіть імʼя. Вчитель може записати весь клас — кожного учня по черзі.',
    '',
    `<i>Натискаючи «Записати дитину», ви погоджуєтесь із <a href="${SITE_URL}/olimpiada#pravyla">правилами олімпіади</a> й <a href="${SITE_URL}/privacy">політикою конфіденційності</a>.</i>`,
  ].join('\n'), { inline_keyboard: [[{ text: '🧩 Записати дитину', callback_data: teacher ? `ol:start:${teacher}` : 'ol:start' }]] });
}

/** Колбеки ol:… — true, якщо оброблено. */
// Імʼя без «Відповісти» (14.10.2026). Бот питає імʼя з force_reply, але
// Telegram (особливо на компʼютері) часто не чіпляє відповідь до питання —
// людина просто пише «Даніїл Писарєв» у чат. Раніше такий текст ішов адміну
// «Питанням Dityam+» (13.10.2026: мама написала імʼя 4 рази, і щоразу —
// «Отримали, відповімо»). Тепер текст, схожий на імʼя, бот перепитує
// кнопкою «Записати на олімпіаду»; імʼя їде в callback_data (до 64 байтів).
const NAME_WORD = "\\p{Lu}[\\p{L}ʼ'’-]+";
const NAME_RE = new RegExp(`^${NAME_WORD}(?:\\s+${NAME_WORD}){0,2}$`, 'u');
const NOT_NAMES = new Set(['Дякую', 'Привіт', 'Добрий', 'Так', 'Ні', 'Добре', 'Ок', 'Окей', 'Вітаю', 'Здравствуйте', 'Hello', 'Hi', 'Ok', 'Stop', 'Старт']);
export const OL_NAME_CB = 'ol:nm:';

/** Схоже на імʼя дитини (1–3 слова з великої літери), і влазить у кнопку. */
export function looksLikeChildName(text) {
  const t = cleanName(text);
  if (t.length < 2 || t.length > 40 || !NAME_RE.test(t)) return false;
  if (NOT_NAMES.has(t.split(' ')[0])) return false;
  return Buffer.byteLength(OL_NAME_CB + t, 'utf8') <= 64;
}

/**
 * «Просто імʼя» в чаті (без «Відповісти» на питання бота) — записуємо одразу,
 * без перепитування кнопкою: «Записати Максима?» після «Записати дитину» був
 * зайвий крок (Марія, 14.10.2026: «2чі питається... це зайвий степ»).
 * looksLikeChildName відсіює не-імена, а межі спроб тримає handleOlReply.
 */
export async function registerOlName(bot, chatId, text, { ensureSub } = {}) {
  const fake = { chat: { id: chatId }, text, reply_to_message: { text: OL_NAME_PROMPT } };
  await handleOlReply(bot, fake, { ensureSub });
}

/** Імена дітей, яких цей чат уже записував, — олімпіада + «Модний код». */
export async function olKnownNames(chatId) {
  const kids = await entriesForChat(chatId).catch(() => []);
  const seen = new Map(); // імʼя без регістру → { name, count, unfinished }
  for (const k of kids) {
    const key = k.child_name.toLocaleLowerCase('uk');
    const s = seen.get(key) || { name: k.child_name, count: 0, unfinished: false };
    s.count += 1;
    if (!k.finished_at) s.unfinished = true;
    seen.set(key, s);
  }
  // Імʼя, що вже вичерпало спроби і не має відкритого тесту, не пропонуємо —
  // кнопка відповіла б лише «це максимум».
  const names = [...seen.values()]
    .filter((s) => s.unfinished || s.count < OLIMP.maxEntriesPerEmail)
    .map((s) => s.name);
  try {
    const db = mkDb();
    const mkKids = db ? await plusEntries(db, chatId) : [];
    for (const k of mkKids) {
      const key = k.child_name.toLocaleLowerCase('uk');
      if (!seen.has(key)) { names.push(k.child_name); seen.set(key, { name: k.child_name }); }
    }
  } catch { /* без «Модного коду» — лише олімпіадні */ }
  // looksLikeChildName заразом гарантує, що імʼя влазить у callback_data.
  return names.filter((n) => looksLikeChildName(n)).slice(0, 4);
}

export async function handleOlCallback(bot, cbq, { ensureSub } = {}) {
  const data = cbq.data || '';
  if (!data.startsWith('ol:')) return false;
  const chatId = String(cbq.message.chat.id);
  await bot.answerCallback(cbq.id);
  if (data.startsWith(OL_NAME_CB)) {
    // Той самий шлях, що й відповідь на питання про імʼя.
    await registerOlName(bot, chatId, data.slice(OL_NAME_CB.length), { ensureSub });
    return true;
  }
  const m = data.match(/^ol:(start|ask)(?::([A-Za-z0-9]+))?$/);
  if (!m) return true;
  const teacher = validTeacherCode(m[2]) ? m[2] : null;
  // Відомих дітей пропонуємо кнопками, щоб не вводити імʼя вдруге (Марія,
  // 14.10.2026: «пропонуй одразу вставити дані, які поділилися»). «ol:ask» —
  // кнопка «Інша дитина» з цього ж екрана; з кодом педагога одразу поле
  // вводу: клас записують новими іменами по черзі.
  if (m[1] === 'start' && !teacher) {
    const known = await olKnownNames(chatId).catch(() => []);
    if (known.length) {
      await bot.sendMessage(chatId, 'Кого записуємо на олімпіаду з логіки? Оберіть дитину — або додайте іншу.', {
        inline_keyboard: [
          ...known.map((n) => [{ text: `🧩 ${n}`, callback_data: OL_NAME_CB + n }]),
          [{ text: '✏️ Інша дитина', callback_data: 'ol:ask' }],
        ],
      });
      return true;
    }
  }
  await bot.sendMessage(chatId,
    `${OL_NAME_PROMPT}${teacher ? `\nКод класу: ${teacher}` : ''}\n\nНапишіть у відповідь імʼя (можна з прізвищем) — так воно буде в дипломі.`,
    { force_reply: true, input_field_placeholder: 'Імʼя дитини' });
  return true;
}

/**
 * Відповідь на питання про імʼя → запис і кнопка «Почати олімпіаду».
 * ensureSub — колбек бота: заводить рядок digest_subscribers із джерелом
 * «olimpiada», щоб після тесту Dityam+ був за 1 грн (introPriceFor).
 */
export async function handleOlReply(bot, msg, { ensureSub } = {}) {
  const prompt = msg?.reply_to_message?.text || '';
  if (!prompt.startsWith(OL_NAME_PROMPT)) return false;
  const chatId = String(msg.chat.id);
  const store = db();
  if (!store) { await bot.sendMessage(chatId, 'Не вдалося записати. Спробуйте за хвилину: меню → «Олімпіади».'); return true; }
  const name = cleanName(msg.text);
  if (name.length < 2) { await bot.sendMessage(chatId, 'Не вийшло прочитати імʼя. Натисніть «🧩 Записати дитину» ще раз.'); return true; }

  const kids = await entriesForChat(chatId).catch(() => []);
  // Ліміти (13.10.2026, батьки чи вчитель із класом): одну дитину — не більше
  // OLIMP.maxEntriesPerEmail разів (правило Марії 12.10.2026 «не більше 2
  // разів»), а дітей з одного чату — до maxEntriesPerTeacherDay за добу.
  const sameName = kids.filter((k) => k.child_name.toLocaleLowerCase('uk') === name.toLocaleLowerCase('uk'));
  const same = sameName.find((k) => !k.finished_at);
  let entry = same ? await store.get(same.token) : null;
  if (!entry) {
    if (sameName.length >= OLIMP.maxEntriesPerEmail) {
      await bot.sendMessage(chatId, `<b>${esc(name)}</b>: цю дитину вже записано на олімпіаду ${OLIMP.maxEntriesPerEmail} рази — це максимум. Дипломи — меню → «Олімпіади».`);
      return true;
    }
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    if (kids.filter((k) => Date.parse(k.created_at) > dayAgo).length >= OLIMP.maxEntriesPerTeacherDay) {
      await bot.sendMessage(chatId, 'Сьогодні з цього Telegram уже записано багато дітей. Спробуйте завтра або напишіть нам сюди.');
      return true;
    }
    // Код класу: з підказки («Код класу: …», посилання педагога) або від
    // попередньої дитини з цього ж чату. 20.10.2026 вчителька записала
    // першу дитину за своїм посиланням, а решту — кнопкою «Записати ще» і
    // просто іменем у чаті: код губився, і діти не зараховувались до її
    // класу («чому мені як вчителю не зарахували цю дитину»).
    const code = teacherFromPrompt(prompt) || lastTeacherCode(kids);
    const teacher = code ? await teacherForEntry(store, code) : null;
    entry = await store.create({
      olimp: OLIMP.slug, child_name: name, parent_email: null,
      consent_at: new Date().toISOString(), amount: 0, source: 'telegram',
      telegram_chat_id: chatId,
      ...(teacher ? { teacher_code: teacher.code } : {}),
    });
    entry = await markPaid(store, entry, { free: true });
    await olEvent('olimp_bot_reg', teacher ? 'teacher' : null);
    if (ensureSub) await ensureSub().catch(() => {});
  }
  await bot.sendMessage(chatId, [
    `✅ <b>${esc(name)}</b> — учасник олімпіади з логіки!`,
    '',
    `Тест — ${OLIMP.questionCount} завдань за ${OLIMP.minutes} хвилин і 1 відкрите завдання без таймера. Час піде, щойно дитина натисне «Почати» на сторінці тесту, тож відкривайте, коли буде зручно.`,
    'Диплом з результатом надішлемо сюди. Посилання на тест завжди тут: меню → «Олімпіади».',
  ].join('\n'), { inline_keyboard: [[{ text: '🧩 Почати олімпіаду', url: olTestUrl(entry.token) }]] });
  return true;
}

/**
 * Диплом у Telegram одразу після тесту (з /api/olimpiada/submit). Не кидає:
 * збій Telegram не має ламати здачу тесту. offerPlus — чи пропонувати
 * Dityam+ за 1 грн (не активним підписникам).
 */
export async function sendOlDiploma(entry, { score, max } = {}) {
  try {
    const token = process.env.TELEGRAM_PLUS_BOT_TOKEN;
    if (!token || !entry?.telegram_chat_id) return false;
    const bot = makeBot(token);
    await olEvent('olimp_bot_done');
    const level = levelFor(score);
    // Dityam+ пропонуємо тим, хто ще не підписник; ціна — та, що реально буде на
    // кнопці оплати (introPriceFor), щоб текст не обіцяв 1 грн, якої не буде.
    const client = await sb();
    const { data: sub } = client
      ? await client.from('digest_subscribers').select('status, source, created_at, wfp_order_reference').eq('telegram_chat_id', String(entry.telegram_chat_id)).maybeSingle()
      : { data: null };
    const offerPlus = sub?.status !== 'active';
    const first = offerPlus && !sub?.wfp_order_reference && introPriceFor(sub) ? PRICE_FIRST : null;
    const photo = `${SITE_URL}/api/olimpiada/diploma?t=${entry.token}&v=${DIPLOMA_VERSION}`;
    await bot.sendPhoto(entry.telegram_chat_id, photo,
      `🧩 Диплом олімпіади з логіки: <b>${esc(entry.child_name)}</b> — ${score} з ${max} · ${esc(level.label)}`);
    const rows = [[{ text: '📄 Розбір і друкований диплом', url: olTestUrl(entry.token) }]];
    if (offerPlus) rows.push([{ text: PLUS_FREE ? 'Підключити Dityam+ безкоштовно' : (first ? `Спробувати Dityam+ за ${first} грн` : `Dityam+ за ${PRICE} грн/міс`), url: `https://t.me/${PLUS_BOT}?start=from_olimpiada` }]);
    await bot.sendMessage(entry.telegram_chat_id, [
      'Диплом можна зберегти, переслати чи надрукувати. На сторінці результату — розбір завдань і друкований диплом з доставкою.',
      ...(offerPlus ? ['', `<b>Що далі?</b> Dityam+ щодня добирає конкурси, олімпіади й інші можливості під вік та інтереси дитини і завчасно нагадує про дедлайни. ${PLUS_FREE ? 'Підключити можна безкоштовно, одразу тут' : (first ? `Dityam+ на місяць за ${first} грн замість ${PRICE} грн, далі ${PRICE} грн/міс, скасувати можна будь-коли` : `${PRICE} грн/міс, скасувати можна будь-коли`)}.`] : []),
    ].join('\n'), { inline_keyboard: rows });
    // Відгук одним натиском (14.10.2026) — одразу після диплома: «наступного
    // дня» залежало б від розкладу GitHub, а він запізнюється на години.
    await bot.sendMessage(entry.telegram_chat_id, fbQuestionText('ol'), { inline_keyboard: fbRatingKeyboard('ol', entry.token) });
    return true;
  } catch (e) {
    console.error('[olimpiada/tg] diploma:', e?.message || e);
    return false;
  }
}
