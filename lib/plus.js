// Перемикач продажу Dityam+ на сайті.
//
// false — /plus, блоки Dityam+ на сторінках і бот @DityamComUABot (?start=plus)
// ведуть у список очікування. true — ведуть в @DityamPlusBot, де анкета й оплата.
//
// Вмикати ЛИШЕ за рішенням Марії (14.09.2026: «підготувати, старт скажу я»).
// Разом із перемиканням запустити воркфлоу «Dityam+ — launch to waitlist»
// (.github/workflows/plus-launch.yml): список очікування має дізнатись першим
// і отримати обіцяну знижку — перший місяць за 89 грн.
export const PLUS_SALES_OPEN = false;

export const PLUS_BOT = 'DityamPlusBot';

// start-параметр видно в аналітиці бота: звідки прийшла людина.
export const plusBotUrl = (start = 'site') => `https://t.me/${PLUS_BOT}?start=${start}`;
