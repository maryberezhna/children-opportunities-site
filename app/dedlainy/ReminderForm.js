'use client';
import { trackConversion } from '@/lib/track';
import { PLUS_SALES_OPEN, PLUS_WAITLIST_URL, plusBotUrl } from '@/lib/plus';

/**
 * Нагадування про дедлайни — це Dityam+, і приходять вони лише в Telegram.
 *
 * До 15.09.2026 тут була форма з імейлом: вона записувала в список очікування
 * й обіцяла «нагадаємо за три дні» — листом, якого ніхто не надсилав. Листів
 * Dityam+ більше не шле (рішення Марії 15.09.2026), тож пошту не просимо.
 *
 * Свідомо НЕ гейт: сам календар відкритий. Ховати його означало б сховати від
 * Google рівно ту сторінку, яка має приводити людей — а органіка зараз головне
 * джерело трафіку. Тож віддаємо все, а кнопка веде до того, чого на сторінці
 * немає: нагадати особисто, поки не пізно.
 */
export default function ReminderForm() {
  const href = PLUS_SALES_OPEN ? plusBotUrl('deadlines_calendar') : PLUS_WAITLIST_URL;
  const track = () => trackConversion(
    PLUS_SALES_OPEN ? 'plus_bot_click' : 'plus_waitlist_tg_click',
    { event_label: 'deadlines_calendar' },
  );

  return (
    <div className="dl-remind">
      <div className="dl-remind-text">
        <strong>Не тримайте дати в голові</strong>
        <span>
          Dityam+ нагадує в Telegram про дедлайни, що підходять вашій дитині: за 4 тижні
          для стипендій і обмінів, за тиждень для гуртків.
        </span>
      </div>
      <div className="dl-remind-row">
        <a className="dl-remind-btn" href={href} onClick={track}>
          {PLUS_SALES_OPEN ? 'Оформити в Telegram' : 'Стати в список у Telegram'}
        </a>
      </div>
    </div>
  );
}
