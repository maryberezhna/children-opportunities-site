// Типи звернень контактної форми. Один список на три місця: селект у формі,
// валідація в API-роуті і фільтри в адмінці — щоб мітки ніде не розʼїхались.
export const CONTACT_TYPES = [
  {
    value: 'opportunity',
    emoji: '💡',
    label: 'Запропонувати можливість',
    hint: 'Знаєте гурток, табір, конкурс чи стипендію, яких немає в каталозі?',
    placeholder: 'Назва програми, для кого вона, коли дедлайн — і посилання, якщо є.',
    labelEn: 'Suggest an opportunity',
    hintEn: 'Know a club, camp, contest or scholarship that isn’t here yet?',
    placeholderEn: 'The name of the programme, who it’s for, the deadline — and a link if you have one.',
  },
  {
    value: 'error',
    emoji: '🐛',
    label: 'Помилка в даних або на сайті',
    hint: 'Прострочена програма, битий лінк, неправильний вік чи опис.',
    placeholder: 'Що саме не так і на якій сторінці ви це побачили.',
    labelEn: 'A mistake in the data or on the site',
    hintEn: 'An expired programme, a broken link, a wrong age or description.',
    placeholderEn: 'What exactly is wrong, and on which page you saw it.',
  },
  {
    value: 'complaint',
    emoji: '⚠️',
    label: 'Скарга',
    hint: 'Організатор бере гроші за «безкоштовне», програма виявилась не тим, що обіцяли.',
    placeholder: 'Опишіть, що сталося: яка програма, з ким мали справу, що пішло не так.',
    labelEn: 'A complaint',
    hintEn: 'An organiser charging for something billed as free, or a programme that turned out to be something else.',
    placeholderEn: 'Tell us what happened: which programme, who you dealt with, what went wrong.',
  },
  {
    value: 'partnership',
    emoji: '🤝',
    label: 'Співпраця чи партнерство',
    hint: 'Ви організація, фонд або школа і хочете співпрацювати.',
    placeholder: 'Хто ви і що пропонуєте.',
    labelEn: 'Partnership',
    hintEn: 'You’re an organisation, a foundation or a school and would like to work together.',
    placeholderEn: 'Who you are and what you propose.',
  },
  {
    value: 'media',
    emoji: '📰',
    label: 'Запит від медіа',
    hint: 'Інтервʼю, коментар, дані для матеріалу.',
    placeholder: 'Видання, тема матеріалу і дедлайн.',
    labelEn: 'Media request',
    hintEn: 'An interview, a comment, or data for a story.',
    placeholderEn: 'The outlet, the topic and your deadline.',
  },
  {
    value: 'other',
    emoji: '💬',
    label: 'Інше',
    hint: 'Питання, ідея або просто привітатися 🧡',
    placeholder: 'Пишіть як зручно.',
    labelEn: 'Something else',
    hintEn: 'A question, an idea, or just hello 🧡',
    placeholderEn: 'Write however suits you.',
  },
];

export const CONTACT_TYPE_MAP = Object.fromEntries(
  CONTACT_TYPES.map((t) => [t.value, t])
);

export const isValidContactType = (v) => Object.hasOwn(CONTACT_TYPE_MAP, v);
