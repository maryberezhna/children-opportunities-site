// Перемикач продажу Dityam+ на сайті.
//
// false — /plus, блоки Dityam+ на сторінках і кнопки «Хочу першим» ведуть у
// список очікування в @DityamPlusBot. true — туди ж, але вже до анкети й оплати.
//
// Вмикати ЛИШЕ за рішенням Марії (14.09.2026: «підготувати, старт скажу я»).
// Разом із перемиканням запустити воркфлоу «Dityam+ — launch to waitlist»
// (.github/workflows/plus-launch.yml): список очікування має дізнатись першим
// і отримати обіцяне — перший місяць безкоштовно (технічно 1 грн: платіжний
// сервіс не проводить 0 грн), далі 99 грн/міс.
export const PLUS_SALES_OPEN = false;

export const PLUS_BOT = 'DityamPlusBot';

// start-параметр видно в аналітиці бота: звідки прийшла людина.
export const plusBotUrl = (start = 'site') => `https://t.me/${PLUS_BOT}?start=${start}`;

// Список очікування — платний бот: /start waitlist записує chat_id у
// plus_waitlist (joinWaitlist у app/api/telegram/plus). До 15.09.2026 список
// жив в основному боті @DityamComUABot, але той зветься «Dityam Адмінка 🛠», і
// людина, що хотіла дізнатись про Dityam+, отримувала відповідь від «адмінки»
// (Марія: «сподіваюся, не адмінка їм пише»). Імейлом у список не записуємо.
export const PLUS_WAITLIST_URL = plusBotUrl('waitlist');
