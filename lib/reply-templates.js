/**
 * Шаблони відповідей, які схвалила Марія (з 23.10.2026).
 *
 * Марія: «все, що я апрувлю — які темплейти — і що ти, записуй у
 * автоматичний процес». Тобто лист, який вона одного разу схвалила, вдруге не
 * пишемо з нуля і не несемо їй на погодження: він іде сам.
 *
 * Як це працює:
 * - approved — дата, коли Марія схвалила текст. Поки null, шаблон лише
 *   чернетка: автоматично нічого не йде;
 * - auto — тип звернення з контактної форми (lib/contactTypes.js), на яке
 *   шаблон відповідає сам, щойно звернення збережено (app/api/contact);
 *   null — шаблон для ручних відповідей (лист прийшов на пошту, а не з форми);
 * - build({ name, message, teacher }) → { subject, text, html }; teacher —
 *   запис olimpiada_teachers за поштою людини ({ name, code }) або null.
 *
 * Правило листів (Марія 22.10.2026, «простіше», «бо ти відлякуєш людину»):
 * коротко, без вимог і процедур — «так», одне посилання, одна дія.
 * Змінюєш текст схваленого шаблону — approved = null, доки Марія не подивиться.
 */
import { teacherGreeting } from './teacher-greeting.js';

const SITE = 'https://dityam.com.ua';
const MAIL = 'hellodityam.com.ua@gmail.com';
const PHONE = '+380 63 476 3998';
const TELEGRAM = 'https://t.me/dityam_com_ua';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const a = (href, label = href) => `<a href="${esc(href)}">${esc(label)}</a>`;

// Підпис за правилом листів: імʼя, «Засновниця платформи Dityam.com.ua»,
// сайт, пошта, телефон; Dityam.com.ua — завжди посиланням.
const SIGN_TEXT = ['З повагою,', 'Марія Шутяк', 'Засновниця платформи Dityam.com.ua', SITE, `${MAIL} · ${PHONE}`];
const SIGN_HTML = `З повагою,<br>Марія Шутяк<br>Засновниця платформи ${a(SITE, 'Dityam.com.ua')}<br>${a(SITE)}<br>${esc(MAIL)} · ${esc(PHONE)}`;

/** Абзаци: [{ text, html }] → лист. Порожній рядок між абзацами, як пише людина. */
function letter(subject, paras) {
  const text = [...paras.map((p) => p.text), SIGN_TEXT.join('\n')].join('\n\n');
  const body = [...paras.map((p) => p.html), SIGN_HTML].map((h) => `<div>${h}</div>`).join('<div><br></div>');
  const html = `<div dir="ltr" style="font-family:Arial,Helvetica,sans-serif;line-height:1.5;color:#1a1a1a;max-width:640px">${body}</div>`;
  return { subject, text, html };
}

const plain = (t) => ({ text: t, html: esc(t) });

/** Роль з тексту заявки амбасадора («Роль: Педагог» — app/ambasadory/AmbassadorForm.js). */
export function ambassadorRole(message) {
  const m = /^Роль:\s*(.+)$/m.exec(String(message || ''));
  return m ? m[1].trim() : '';
}

function buildAmbassadorWelcome({ name, teacher: registered = null }) {
  // Текст Марії дослівно (23.10.2026), лише «у розрізи» → «у розрізі»;
  // «Ми обов’язково вас повідомимо» — її ж доповнення того дня.
  // Перший варіант (олімпіада для класу, канал) вона відхилила: «ні».
  // Звертання — з повного імені, якщо людина вже педагог олімпіади
  // (там є по батькові): «Тетяно Анатоліївно».
  return letter('Дякую, що хочете стати амбасадором Dityam.com.ua', [
    plain(teacherGreeting(registered?.name || name)),
    {
      text: 'Дякую, що хочете стати амбасадором Dityam.com.ua. Ми підготовлюємо інформацію для амбасадорів. Ми обов’язково вас повідомимо.',
      html: `Дякую, що хочете стати амбасадором ${a(SITE, 'Dityam.com.ua')}. Ми підготовлюємо інформацію для амбасадорів. Ми обов’язково вас повідомимо.`,
    },
    plain('Підкажіть, будь ласка, які проблеми наразі у розрізі освіти для дітей ви бачите?'),
  ]);
}

// Організатор пише на пошту, що хоче додати свою програму (School Svit,
// 22.10.2026). Лист приходить у Gmail, не з форми, тож auto: null —
// шаблон для ручної відповіді.
function buildOrganizerAdd({ name, program }) {
  const form = `${SITE}/#zaproponuvaty`;
  return letter('Dityam.com.ua — як додати вашу програму', [
    plain(teacherGreeting(name)),
    {
      text: `Так, ${program || 'вашу програму'} можна додати на dityam.com.ua, це безкоштовно. Заповніть, будь ласка, коротку форму: ${form}`,
      html: `Так, ${esc(program || 'вашу програму')} можна додати на ${a(SITE, 'dityam.com.ua')}, це безкоштовно. Заповніть, будь ласка, коротку форму: ${a(form)}`,
    },
    plain('У ній лише назва, посилання, вік дітей і ваш email. Для постійних занять відмітьте «Можливість доступна завжди».'),
    {
      text: `Окремо пропоную пілотне платне розміщення: за 500 грн ваша програма 2 тижні буде першою в «Топ тижня» на головній і отримає 2 пости в нашому Telegram-каналі (${TELEGRAM}). Якщо цікаво, просто відповідайте на цей лист.`,
      html: `Окремо пропоную пілотне платне розміщення: за 500 грн ваша програма 2 тижні буде першою в «Топ тижня» на головній і отримає 2 пости в нашому ${a(TELEGRAM, 'Telegram-каналі')}. Якщо цікаво, просто відповідайте на цей лист.`,
    },
  ]);
}

export const REPLY_TEMPLATES = {
  ambassador_welcome: {
    title: 'Заявка амбасадора',
    auto: 'ambassador',
    // Текст написала сама Марія 23.10.2026 — це і є схвалення.
    approved: '2026-10-23',
    build: buildAmbassadorWelcome,
  },
  organizer_add: {
    title: 'Організатор хоче додати свою програму',
    auto: null,
    approved: null,
    build: buildOrganizerAdd,
  },
};

/** Схвалений шаблон, що сам відповідає на цей тип звернення, або null. */
export function autoReplyFor(type) {
  const found = Object.entries(REPLY_TEMPLATES).find(([, t]) => t.auto === type && t.approved);
  return found ? { id: found[0], ...found[1] } : null;
}
