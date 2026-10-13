// «Наші олімпіади» в боті Dityam+ (12.10.2026, Марія: «будувати все через
// телеграм»; «бот Dityam+ реєструє на ці можливості й має їх у своєму меню»).
// Підписник реєструє дитину на «Модний код» прямо в боті — без email і без
// оплати: участь входить у підписку. Спроб — скільки завгодно з 13.10.2026 (обкладинка з
// балами), тренування — без обмежень у кабінеті.
import { OLIMP } from './olimpiada.js';
import { olRows } from './olimpiada-bot.js';
import { MK, MK_NAME_PROMPT, cleanChildName, ageFromPrompt, mkCabinet } from './modnyi-kod.js';
import { mkDb, plusActive, plusEntries, createPlusEntry, SITE_URL } from './modnyi-kod-server.js';

const UTM = 'utm_source=telegram&utm_medium=social&utm_campaign=dityam_plus&utm_content=modnyi_kod';
const cabinetUrl = (token) => `${SITE_URL}${mkCabinet(token)}&${UTM}`;
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Екран «Наші олімпіади»: діти, що вже беруть участь, і кнопка додати. */
// active — чи це підписник Dityam+: «Модний код» у підписці лише для них, решті
// — сторінка з оплатою; олімпіада з логіки — для всіх, просто в боті (13.10.2026).
export async function sendOlympiads(bot, chatId, { active = true } = {}) {
  const db = mkDb();
  const kids = db && active ? await plusEntries(db, chatId).catch(() => []) : [];
  const rows = kids.map((k) => [{ text: `👗 ${k.child_name}: ${k.look_at ? `обкладинка · ${k.score}/${k.max_score}` : k.finished_at ? 'студія образу' : 'тест'}`, url: cabinetUrl(k.token) }]);
  rows.push([active
    ? { text: kids.length ? '👗 Записати ще дитину на «Модний код»' : '👗 Записати дитину на «Модний код»', callback_data: 'mk:start' }
    : { text: '👗 «Модний код» на сайті', url: `${SITE_URL}/modnyi-kod?${UTM}` }]);
  rows.push(...await olRows(chatId));
  await bot.sendMessage(chatId, [
    // Без 🏆 у тексті: Telegram показував його як \uD83C\uDFC6 (Марія, 13.10.2026,
    // як 🎟 19.09.2026). На кнопках емодзі малюються нормально.
    '<b>Олімпіади</b>',
    '',
    // Обидві олімпіади (Марія, 13.10.2026: «отут опиши 2 олімпіади»). Числа — з MK і OLIMP.
    // Один зразок для обох (Марія, 13.10.2026: «чому тут підпис не однаковий»):
    // назва — олімпіада з чого для якого віку: завдання й час, що далі. Кнопки
    // теж однакові: «Записати дитину на …».
    `👗 <b>«${MK.title}»</b> — олімпіада з моди для ${MK.ageFrom}–${MK.ageTo} років: 25 завдань за ${MK.minutes} хвилин, далі студія образу й обкладинка модного журналу з балами дитини. Для підписників Dityam+ участь <b>уже в підписці</b>, тест можна проходити скільки завгодно разів.`,
    '',
    `🧩 <b>${OLIMP.title}</b> — для ${OLIMP.ageMin}–${OLIMP.ageMax} років: ${OLIMP.questionCount} завдань за ${OLIMP.minutes} хвилин і 1 відкрите завдання без таймера, далі диплом із результатом одразу після тесту. Проходити можна онлайн у зручний час.`,
  ].join('\n'), { inline_keyboard: rows });
}

/** Колбеки mk:… — true, якщо оброблено. */
export async function handleMkCallback(bot, cbq) {
  const data = cbq.data || '';
  if (!data.startsWith('mk:')) return false;
  const chatId = String(cbq.message.chat.id);
  const db = mkDb();
  if (!db || !(await plusActive(db, chatId))) { await bot.answerCallback(cbq.id, 'Це для підписників Dityam+ — /start'); return true; }
  await bot.answerCallback(cbq.id);
  if (data === 'mk:start') {
    const ages = Array.from({ length: MK.ageTo - MK.ageFrom + 1 }, (_, i) => MK.ageFrom + i);
    await bot.sendMessage(chatId, 'Скільки років дитині?', { inline_keyboard: [ages.map((a) => ({ text: String(a), callback_data: `mk:age:${a}` }))] });
    return true;
  }
  const age = Number((data.match(/^mk:age:(\d+)$/) || [])[1]);
  if (age >= MK.ageFrom && age <= MK.ageTo) {
    // Вік — у тексті підказки: відповідь на неї прийде з ним (reply_to_message).
    await bot.sendMessage(chatId, `${MK_NAME_PROMPT} (${age} років)\n\nЛише імʼя, без прізвища — його побачать на обкладинці.`,
      { force_reply: true, input_field_placeholder: 'Імʼя дитини' });
    return true;
  }
  return false;
}

/** Відповідь на питання про імʼя → реєстрація й посилання на кабінет. true — оброблено. */
export async function handleMkReply(bot, msg) {
  const prompt = msg?.reply_to_message?.text || '';
  if (!prompt.startsWith(MK_NAME_PROMPT)) return false;
  const chatId = String(msg.chat.id);
  const db = mkDb();
  if (!db || !(await plusActive(db, chatId))) { await bot.sendMessage(chatId, 'Це для підписників Dityam+ — /start'); return true; }
  const age = ageFromPrompt(prompt);
  const name = cleanChildName(msg.text);
  if (!age || name.length < 2) { await bot.sendMessage(chatId, 'Не вийшло прочитати імʼя. Натисніть «👗 Записати дитину на «Модний код»» ще раз.'); return true; }
  const row = await createPlusEntry(db, { chatId, name, age });
  await bot.sendMessage(chatId, [
    `✅ <b>${esc(name)}</b> бере участь у «${MK.title}»!`,
    '',
    `Тест — 25 завдань, ${MK.minutes} хвилин. Проходити можна скільки завгодно разів — на обкладинку йде кращий результат.`,
    'Кабінет завжди тут: меню → «Олімпіади».',
  ].join('\n'), { inline_keyboard: [[{ text: '👗 Відкрити кабінет', url: cabinetUrl(row.token) }]] });
  return true;
}
