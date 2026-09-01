/**
 * ISO-тиждень одним рядком: «2026-W36».
 *
 * Потрібен і сайту (чи показувати позначку «Топ тижня»), і скриптові, що цю
 * трійку обирає. Якби кожен рахував по-своєму, вони розійшлися б на межі року
 * — саме там, де тиждень 1 січня може належати минулому році.
 *
 * Рахуємо за Києвом: тиждень має починатися тоді ж, коли він починається в
 * тих, хто читає сайт, а не о третій ночі за Гринвічем.
 */
export function isoWeek(date = new Date()) {
  // Дата в київському поясі, далі рахуємо як UTC — так само в браузері й на сервері.
  const kyiv = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
  const [y, m, d] = kyiv.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  // Четвер поточного тижня визначає рік за ISO 8601.
  const day = t.getUTCDay() || 7;          // неділя = 7, а не 0
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t - yearStart) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
