import test from 'node:test';
import assert from 'node:assert/strict';
import { costLabel, deadlineTag, withPageLink } from '../scripts/post-labels.mjs';

// 21.09.2026 у каналі вийшло «⏰ Заявки до: за 32 дн.» — «до» і «за N дн.»
// разом. Після «Заявки до:» завжди стоїть дата, а скільки лишилось — окремо.

test('дата подачі і скільки лишилось, з правильним відмінком', () => {
  assert.equal(deadlineTag('2026-10-23', 32), '<b>23 жовтня 2026</b> · ще 32 дні');
  assert.equal(deadlineTag('2026-10-12', 21), '<b>12 жовтня 2026</b> · ще 21 день');
  assert.equal(deadlineTag('2026-10-02', 11), '<b>2 жовтня 2026</b> · ще 11 днів');
  assert.equal(deadlineTag('2026-09-26', 5), '<b>26 вересня 2026</b> · ще 5 днів');
});

test('сьогодні й завтра — останній день, а не «за 0 дн.»', () => {
  assert.equal(deadlineTag('2026-09-21', 0), '<b>21 вересня 2026</b> · сьогодні останній день');
  assert.equal(deadlineTag('2026-09-22', 1), '<b>22 вересня 2026</b> · завтра останній день');
});

test('без лічильника — лише дата', () => {
  assert.equal(deadlineTag('2026-10-23', null), '<b>23 жовтня 2026</b>');
  assert.equal(deadlineTag('2026-09-01', -3), '<b>1 вересня 2026</b>');
  assert.equal(deadlineTag(null, 5), null);
});

test('вартість — лише «Безкоштовно» або «Платно»', () => {
  assert.equal(costLabel('free'), 'Безкоштовно');
  assert.equal(costLabel('paid_affordable'), 'Платно');
  assert.equal(costLabel('paid_premium'), 'Платно');
  // Проміжні не кажуть, чи платить родина, — рядка немає.
  assert.equal(costLabel('partially_free'), null);
  assert.equal(costLabel('subsidized'), null);
  assert.equal(costLabel(null), null);
});

// Чернетки постів ведуть на сторінку можливості, а не на головну (21.09.2026).
const SLUG = 'molodizhnyi-obmin-erasmus-within-abc123';
const WITHIN = [
  'Тобі 18 і тема психічного здоровʼя відгукується більше, ніж будь-яка інша?',
  '',
  'Участь безкоштовна. Реєстрація до 25 вересня — залишилось 4 дні.',
  '',
  'Деталі — dityam.com.ua',
  '',
  '#Erasmus #молодіжнийобмін #Іспанія',
].join('\n');

test('голий домен у рядку-заклику стає адресою сторінки', () => {
  const out = withPageLink(WITHIN, SLUG);
  assert.match(out, new RegExp(`^Деталі — dityam\\.com\\.ua/o/${SLUG}$`, 'm'));
  assert.equal(out.split('\n').length, WITHIN.split('\n').length);
  assert.equal(withPageLink('Більше на https://dityam.com.ua/', SLUG), `Більше на dityam.com.ua/o/${SLUG}`);
});

test('назва платформи в довгому реченні лишається назвою', () => {
  const body = 'Платформа Dityam.com.ua збирає перевірені можливості для українських дітей і нагадує про дедлайни вчасно.';
  const out = withPageLink(`${body}\n\n#діти`, SLUG);
  assert.ok(out.startsWith(body));
  assert.match(out, new RegExp(`Деталі — dityam\\.com\\.ua/o/${SLUG}\\n\\n#діти$`));
});

test('заклику немає — рядок з посиланням стає перед хештегами', () => {
  assert.equal(withPageLink('Текст поста.\n\n#теги', SLUG),
    `Текст поста.\n\nДеталі — dityam.com.ua/o/${SLUG}\n\n#теги`);
  assert.equal(withPageLink('Текст без тегів.', SLUG), `Текст без тегів.\n\nДеталі — dityam.com.ua/o/${SLUG}`);
});

test('посилання вже веде на сторінку чи інший розділ — не чіпаємо чужого', () => {
  const ok = `Деталі — dityam.com.ua/o/${SLUG}`;
  assert.equal(withPageLink(ok, SLUG), ok);
  const plus = 'Нагадаємо — dityam.com.ua/plus';
  assert.equal(withPageLink(plus, SLUG), `${plus}\n\nДеталі — dityam.com.ua/o/${SLUG}`);
});
