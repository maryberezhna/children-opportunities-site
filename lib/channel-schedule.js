// Заплановані дописи й опитування в каналі @dityam_com_ua — на точний час.
//
// Навіщо окремо від GitHub Actions: cron GitHub запізнюється на 4–6 годин, і
// «ввечері в понеділок» перетворилось би на «десь уночі». Тут — cron Vercel
// (app/api/cron/channel-scheduled), він приходить вчасно.
//
// Додати допис = дописати рядок у SCHEDULE. Час — ISO в UTC, із приміткою
// за Києвом: Україна двічі на рік міняє зсув (у ніч на 25.10.2026 — з +3 на +2).
// key — унікальний назавжди: за ним таблиця channel_scheduled_sent не дає
// надіслати те саме двічі.
export const CHANNEL = '@dityam_com_ua';

export const SCHEDULE = [
  // За добу — превʼю в адмін-чат: той самий текст і перевірка, чи бот може
  // публікувати в каналі. Тоді зламаний токен чи права видно за день, а не в
  // мить публікації.
  { key: 'preview-poll-applied-2026-10', kind: 'preview', of: 'poll-applied-2026-10', at: '2026-10-25T17:00:00Z' },
  // Понеділок 26.10.2026, 19:00 за Києвом (вже зимовий час, UTC+2).
  { key: 'poll-applied-2026-10', kind: 'poll', poll: 'applied', at: '2026-10-26T17:00:00Z' },
];

// Якщо cron із якоїсь причини пропустив час — досилаємо лише в межах цього
// вікна. Опитування «цього місяця» через добу вже недоречне.
export const SEND_WINDOW_MS = 3 * 60 * 60 * 1000;

/** Що вже настав час надіслати: at ≤ now < at + вікно. Чиста функція — під тести. */
export function dueItems(schedule, now, windowMs = SEND_WINDOW_MS) {
  const t = now.getTime();
  return schedule.filter((it) => {
    const at = Date.parse(it.at);
    return Number.isFinite(at) && at <= t && t < at + windowMs;
  });
}
