// Ланцюг «людина питає → адмін відповідає реплаєм» (27.09.2026).
//
// Ланцюг зшитий текстом: @DityamPlusBot кладе питання в адмінський чат, а
// webhook впізнає відповідь адміна за ПОЧАТКОМ процитованого повідомлення й
// витягає з нього chat_id людини. Тобто заголовок — це протокол, і будь-яка
// змінна всередині нього тихо рве відповідь.
//
// Саме це й сталось: у заголовок додали статус («Питання ще не оплаченого
// Dityam+»), і відповідь перестала б ходити рівно до тих, хто не дійшов до
// оплати, — тобто до людей, яким написати найважливіше.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { PLUS_QUESTION_HEAD, PLUS_QUESTION_MATCH, PLUS_QUESTION_MATCH_OLD } =
  await import('../lib/plus.js');

// Те, що Telegram віддає в reply_to_message.text: теги зняті.
const asPlainText = (html) => html.replace(/<[^>]+>/g, '');

// Перший рядок сповіщення — точно як його будує app/api/telegram/plus/route.js.
const head = (handle, state, chatId) =>
  `${PLUS_QUESTION_HEAD} ${handle} · ${state} <code>${chatId}</code>:`;

// Як його читає app/api/telegram/webhook/route.js.
const targetOf = (quoted) => quoted.split('\n')[0].match(/(-?\d+):\s*$/)?.[1];
const recognised = (quoted) => quoted.startsWith(PLUS_QUESTION_MATCH)
  || quoted.startsWith(PLUS_QUESTION_MATCH_OLD);

test('заголовок не містить нічого змінного', () => {
  // Якщо сюди колись знову втече статус чи хендл — впаде тут, а не в проді.
  assert.equal(PLUS_QUESTION_HEAD, '📝 <b>Питання Dityam+</b>');
  assert.equal(asPlainText(PLUS_QUESTION_HEAD), PLUS_QUESTION_MATCH);
});

test('відповідь знаходить людину в будь-якому стані', () => {
  for (const state of ['підписка активна', 'ще не оплачено', 'призупинено',
    'скасовано', 'відписалась', 'новий контакт']) {
    const quoted = asPlainText(head('@ttanyaost', state, '1874951215'));
    assert.ok(recognised(quoted), state);
    assert.equal(targetOf(quoted), '1874951215', state);
  }
});

test('цифри в хендлі не плутаються з chat_id', () => {
  // @Olka666 — справжній хендл однієї з тих, кому це писали.
  const quoted = asPlainText(head('@Olka666', 'ще не оплачено', '459685392'));
  assert.equal(targetOf(quoted), '459685392');
});

test('порожній хендл не ламає розбір', () => {
  const quoted = asPlainText(head('', 'ще не оплачено', '459685392'));
  assert.ok(recognised(quoted));
  assert.equal(targetOf(quoted), '459685392');
});

test('старі повідомлення в чаті лишаються відповідними', () => {
  const quoted = '📝 Питання підписника Dityam+ @someone 12345:';
  assert.ok(recognised(quoted));
  assert.equal(targetOf(quoted), '12345');
});

test('чуже повідомлення в адмін-чаті не вважається питанням', () => {
  for (const quoted of ['🚀 Dityam+ — новий у списку очікування @x',
    'Промокод FIRST ввів @x', '🚨 WayForPay REMOVE не пройшов', '']) {
    assert.ok(!recognised(quoted), quoted);
  }
});
