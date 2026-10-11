// Лист-запрошення до тесту — одразу із сайту, в мить заявки (з 08.10.2026
// участь безкоштовна; до того — коли оплату підтверджено). До 07.10.2026 його слав лише scraper/olimpiada_invites.py за
// розкладом GitHub, а розклад запізнюється на 3–7 годин: хто закрив вкладку
// оплати чи платив у браузері Instagram, годинами лишався без посилання на
// тест (Марія: «оце не дуже»). Скрипт лишається запасним шляхом: що не пішло
// звідси (немає пароля, Gmail не відповів), він надішле сам.
//
// Пошта — та сама скринька проєкту, Gmail SMTP. Пароль застосунку — змінна
// оточення DITYAM_GMAIL_APP_PASSWORD, а якщо її немає у Vercel, — Supabase
// Vault (функція olimp_mail_password, лише для сервісного ключа; туди його
// кладе воркфлоу «Олімпіада — пароль пошти для сайту» із секретів GitHub).
import { createClient } from '@supabase/supabase-js';
import { OLIMP, isEmail, teacherLink, teacherPagePath } from './olimpiada.js';
import { PRICE, PRICE_FIRST } from './wayforpay.js';

const SITE_URL = process.env.SITE_URL || 'https://dityam.com.ua';
export const MAIL_FROM = process.env.DITYAM_GMAIL_FROM || 'hellodityam.com.ua@gmail.com';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Тема, текст і HTML запрошення — слово в слово як build_message у
 * scraper/olimpiada_invites.py (звіряє tests/olimpiada-mail.test.mjs).
 */
export function buildInvite(entry) {
  const name = String(entry?.child_name || '').trim() || 'ваша дитина';
  const link = `${SITE_URL}/olimpiada/test?t=${entry.token}`;
  const subject = `Запрошення до онлайн-олімпіади з логіки — ${name}`;
  // З 08.10.2026 участь безкоштовна: ні строку «72 години після оплати», ні
  // рядка про неповернення внеску. Друкований диплом — опція після тесту.
  const points = [
    `тест можна пройти в зручний час: ${OLIMP.questionCount} завдань із варіантами за ${OLIMP.minutes} хвилин, 1 спроба; час піде після натискання «Почати»;`,
    // Яке саме відкрите завдання — секрет до тесту (Марія, 06.10.2026).
    'останнє завдання — відкрите: без варіантів і без таймера, дитина пише свою відповідь; воно вирішує, хто отримає приз місяця;',
    'коли час на завдання з варіантами вийде, відповіді на них відправляться самі, а відкрите завдання можна дописати без поспіху;',
    `диплом зʼявиться на тій самій сторінці одразу після тесту; за бажанням можна замовити друкований — ${OLIMP.printPrice} грн, доставка у відділення або поштомат Нової пошти включена;`,
    `переможців місяця оголосимо до 7-го числа наступного місяця; якщо ${name} виграє, повідомимо вас окремим листом на цю адресу.`,
  ];
  const text = [
    'Добрий день!',
    '',
    `Заявку отримали — ${name} бере участь в онлайн-олімпіаді з логіки Dityam.com.ua. Участь безкоштовна.`,
    `Посилання на тест: ${link}`,
    '',
    'Що важливо:',
    ...points.map((p) => `• ${p}`),
    '',
    'Марія Шутяк, Dityam.com.ua',
    MAIL_FROM,
  ].join('\n');
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;color:#1c1c1c;max-width:560px">
<p>Добрий день!</p>
<p>Заявку отримали — <b>${esc(name)}</b> бере участь в онлайн-олімпіаді з логіки Dityam.com.ua. Участь безкоштовна.</p>
<p><a href="${esc(link)}" style="display:inline-block;padding:14px 28px;border-radius:999px;background:#f5a023;color:#16307a;font-weight:bold;text-decoration:none">Перейти до тесту</a></p>
<p>Що важливо:</p>
<ul>${points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
<p>Якщо кнопка не відкривається, скопіюйте посилання:<br><a href="${esc(link)}">${esc(link)}</a></p>
<p>Марія Шутяк, Dityam.com.ua<br><a href="mailto:${esc(MAIL_FROM)}">${esc(MAIL_FROM)}</a></p>
</div>`;
  return { subject, text, html };
}

// Пароль читаємо раз на 10 хвилин: Vault — це ще один запит до бази.
const cache = (globalThis.__olimpMailPass ||= { value: null, at: 0 });
async function mailPassword() {
  if (process.env.DITYAM_GMAIL_APP_PASSWORD) return process.env.DITYAM_GMAIL_APP_PASSWORD;
  if (cache.value && Date.now() - cache.at < 10 * 60 * 1000) return cache.value;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const supabase = createClient(url, key, {
    auth: { persistSession: false },
    global: { fetch: (i, init) => fetch(i, { ...init, cache: 'no-store' }) },
  });
  const { data, error } = await supabase.rpc('olimp_mail_password');
  if (error) { console.error('[olimpiada/mail] password:', error.message); return null; }
  if (data) Object.assign(cache, { value: data, at: Date.now() });
  return data || null;
}

async function send({ to, subject, text, html, attachments }) {
  const pass = await mailPassword();
  if (!pass) return { error: 'no_password' };
  const { default: nodemailer } = await import('nodemailer');
  const smtp = nodemailer.createTransport({
    host: 'smtp.gmail.com', port: 465, secure: true,
    auth: { user: MAIL_FROM, pass },
    // Колбек WayForPay чекає на відповідь — довго висіти на пошті не можна.
    connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 12000,
  });
  await smtp.sendMail({
    from: { name: 'Dityam.com.ua', address: MAIL_FROM }, to, replyTo: MAIL_FROM, subject, text, html,
    ...(attachments ? { attachments } : {}),
  });
  return { ok: true };
}

/**
 * Запрошення одразу після оплати. Спершу «бронюємо» запис (invite_sent_at
 * лише там, де його ще немає), щоб запасний скрипт у ту саму мить не
 * надіслав другий лист; не вдалося надіслати — знімаємо позначку, і лист
 * піде скриптом. Ніколи не кидає: оплата важливіша за лист.
 */
export async function sendInvite(store, entry) {
  try {
    if (!store || store.dev || !entry?.paid_at || entry.invite_sent_at || entry.finished_at) return false;
    if (!isEmail(entry.parent_email)) return false;
    if (!(await mailPassword())) return false;
    if (!(await store.claim(entry.token, 'invite_sent_at', { invite_sent_at: new Date().toISOString() }))) return false;
    try {
      await send({ to: entry.parent_email, ...buildInvite(entry) });
      return true;
    } catch (e) {
      console.error('[olimpiada/mail] invite:', e?.message || e);
      await store.update(entry.token, { invite_sent_at: null }).catch(() => {});
      return false;
    }
  } catch (e) {
    console.error('[olimpiada/mail]', e?.message || e);
    return false;
  }
}

// ── Лист із дипломом ────────────────────────────────────────────────────────
// Марія, 09.10.2026: «а можеш їх завжди відправляти одразу?». До того диплом
// листом слав лише scraper/olimpiada_invites.py за розкладом GitHub — і він
// приходив через 2–3 години після тесту, а то й наступного ранку. Тепер лист
// іде із сайту, щойно відкривається сторінка результату; скрипт лишається
// запасним. Текст — слово в слово як build_diploma_message у скрипті (звіряє
// tests/olimpiada-diploma-mail.test.mjs).

const PLUS_LINK = 'https://t.me/DityamPlusBot?start=from_olimpiada';
const plusText = () => 'Dityam+ щодня добирає конкурси, олімпіади й інші можливості під вік та інтереси дитини '
  + 'і завчасно нагадує про дедлайни — у Telegram. '
  + 'А ще підписники першими дізнаються про наші нові олімпіади й конкурси. '
  + `Перший місяць — ${PRICE_FIRST} грн, далі ${PRICE} грн/міс, скасувати можна будь-коли.`;

export function buildDiploma(entry) {
  const name = String(entry?.child_name || '').trim() || 'ваша дитина';
  const link = `${SITE_URL}/olimpiada/test?t=${entry.token}`;
  const competes = Boolean(String(entry?.open_answer || '').trim());
  const winner = `Переможців оголосимо до 7-го числа наступного місяця; якщо ${name} виграє, `
    + 'повідомимо вас окремим листом на цю адресу.';
  const offerPost = !entry?.print_paid_at;
  const needAddress = Boolean(entry?.print_paid_at) && !entry?.print_order;
  const postLink = `${link}#dostavka`;
  const postOffer = 'Надрукуємо диплом і надішлемо у відділення або поштомат Нової пошти по Україні — '
    + `${OLIMP.printPrice} грн, доставка включена.`;
  const addressAsk = 'Друкований диплом ви оплатили разом з участю. Вкажіть, куди його надіслати: '
    + 'отримувач, телефон, місто й відділення чи поштомат Нової пошти.';
  const plus = plusText();
  // Розбір у лист не кладемо (Марія, 11.10.2026: «розбір має бути видно тільки
  // на сторінці результатів»): у листі — диплом, друк і Dityam+, розбір чекає
  // на сторінці за кнопкою «Відкрити диплом».
  const subject = `Диплом онлайн-олімпіади з логіки — ${name}`;
  const text = [
    'Добрий день!',
    '',
    `${name} пройшов або пройшла онлайн-олімпіаду з логіки Dityam.com.ua: результат ${entry.score} з ${entry.max_score} балів.`,
    // Без вкладення (Марія, 11.10.2026): лише посилання — на сторінці диплома
    // стоїть і пропозиція друкованого диплома, якої з вкладенням не бачили.
    `Диплом чекає на сторінці з результатом — там його можна переглянути й завантажити: ${link}`,
    ...(competes ? ['', `Відкрите завдання отримали — воно бере участь у конкурсі на приз місяця. ${winner}`] : []),
    ...(offerPost ? ['', 'Бажаєте друкований диплом?', `${postOffer} Замовити: ${postLink}`] : []),
    ...(needAddress ? ['', `${addressAsk} ${postLink}`] : []),
    '',
    'Що далі після олімпіади?',
    `${plus} Спробувати за ${PRICE_FIRST} грн: ${PLUS_LINK}`,
    '',
    'Марія Шутяк, Dityam.com.ua',
    MAIL_FROM,
  ].join('\n');
  const btn = (href, label, bg = '#f5a023', fg = '#16307a') => `<p><a href="${esc(href)}" style="display:inline-block;padding:14px 28px;border-radius:999px;background:${bg};color:${fg};font-weight:bold;text-decoration:none">${label}</a></p>\n`;
  const prizeHtml = competes ? `<p>Відкрите завдання отримали — воно бере участь у конкурсі на приз місяця. ${esc(winner)}</p>\n` : '';
  let postHtml = offerPost ? `<p><b>Бажаєте друкований диплом?</b><br>${esc(postOffer)}</p>\n${btn(postLink, `Замовити друкований диплом · ${OLIMP.printPrice} грн`)}` : '';
  if (needAddress) postHtml = `<p><b>Куди надіслати друкований диплом?</b><br>${esc(addressAsk)}</p>\n${btn(postLink, 'Вказати адресу доставки')}`;
  const plusHtml = `<p><b>Що далі після олімпіади?</b><br>${esc(plus)}</p>\n${btn(PLUS_LINK, `Спробувати Dityam+ за ${PRICE_FIRST} грн`, '#16307a', '#ffffff')}`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;color:#1c1c1c;max-width:560px">
<p>Добрий день!</p>
<p><b>${esc(name)}</b> пройшов або пройшла онлайн-олімпіаду з логіки Dityam.com.ua: результат <b>${esc(String(entry.score))} з ${esc(String(entry.max_score))}</b> балів.</p>
<p>Диплом чекає на сторінці з результатом — там його можна переглянути й завантажити.</p>
${btn(link, 'Відкрити диплом')}${prizeHtml}${postHtml}${plusHtml}<p>Марія Шутяк, Dityam.com.ua<br><a href="mailto:${esc(MAIL_FROM)}">${esc(MAIL_FROM)}</a></p>
</div>`;
  return { subject, text, html };
}

/**
 * Лист із дипломом одразу після тесту. Як і запрошення: спершу «бронюємо»
 * diploma_sent_at, не вийшло надіслати — знімаємо позначку, і лист піде
 * запасним скриптом. Ніколи не кидає.
 */
export async function sendDiploma(store, entry) {
  try {
    if (!store || store.dev || !entry?.finished_at || entry.diploma_sent_at) return false;
    if (!isEmail(entry.parent_email)) return false;
    if (!(await mailPassword())) return false;
    if (!(await store.claim(entry.token, 'diploma_sent_at', { diploma_sent_at: new Date().toISOString() }))) return false;
    try {
      await send({ to: entry.parent_email, ...buildDiploma(entry) });
      return true;
    } catch (e) {
      console.error('[olimpiada/mail] diploma:', e?.message || e);
      await store.update(entry.token, { diploma_sent_at: null }).catch(() => {});
      return false;
    }
  } catch (e) {
    console.error('[olimpiada/mail]', e?.message || e);
    return false;
  }
}

// ── Листи педагогам (11.10.2026) ────────────────────────────────────────────
// Педагог залишив імʼя та email на /olimpiada — 1 лист із його посиланням.
// Перший учень за посиланням пройшов олімпіаду — 1 лист із подякою. Запасного
// скрипта для них немає: не вдалося надіслати — позначку знімаємо, і лист
// спробує наступний учень. Імені дитини в листах педагогові немає — лише число.

const btnHtml = (href, label) => `<p><a href="${esc(href)}" style="display:inline-block;padding:14px 28px;border-radius:999px;background:#f5a023;color:#16307a;font-weight:bold;text-decoration:none">${label}</a></p>\n`;
const signText = ['Марія Шутяк, Dityam.com.ua', MAIL_FROM];
const signHtml = `<p>Марія Шутяк, Dityam.com.ua<br><a href="mailto:${esc(MAIL_FROM)}">${esc(MAIL_FROM)}</a></p>`;
const wrapHtml = (body) => `<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;color:#1c1c1c;max-width:560px">\n${body}</div>`;

export function buildTeacherWelcome(teacher) {
  const link = teacherLink(teacher.code, SITE_URL);
  const page = `${SITE_URL}${teacherPagePath(teacher.code)}`;
  const subject = 'Ваше посилання для учнів — онлайн-олімпіада з логіки Dityam.com.ua';
  const about = `Олімпіада безкоштовна, для дітей ${OLIMP.groupLabel}: ${OLIMP.questionCount} завдань на кмітливість `
    + `за ${OLIMP.minutes} хвилин у зручний час, диплом — одразу після тесту. Заявку подає мама, тато чи опікун дитини.`;
  const thanks = 'Щойно перший учень за цим посиланням пройде олімпіаду, ви отримаєте від нас подяку. '
    + 'На ній — кількість учнів, які пройшли олімпіаду за вашим посиланням: число оновлюється, коли проходять нові.';
  const pageText = 'На вашій сторінці педагога — посилання, готовий текст для чату класу, кількість учнів і подяка.';
  const text = [
    'Добрий день!',
    '',
    'Дякуємо, що хочете розповісти учням про онлайн-олімпіаду з логіки Dityam.com.ua.',
    about,
    '',
    `Ваше особисте посилання для учнів: ${link}`,
    '',
    thanks,
    '',
    `${pageText} ${page}`,
    '',
    ...signText,
  ].join('\n');
  const html = wrapHtml(`<p>Добрий день!</p>
<p>Дякуємо, що хочете розповісти учням про онлайн-олімпіаду з логіки Dityam.com.ua. ${esc(about)}</p>
<p>Ваше особисте посилання для учнів:<br><a href="${esc(link)}"><b>${esc(link)}</b></a></p>
<p>${esc(thanks)}</p>
<p>${esc(pageText)}</p>
${btnHtml(page, 'Відкрити сторінку педагога')}${signHtml}
`);
  return { subject, text, html };
}

export function buildTeacherThanks(teacher, count) {
  const page = `${SITE_URL}${teacherPagePath(teacher.code)}`;
  const subject = 'Перший учень за вашим посиланням пройшов олімпіаду — ось ваша подяка';
  const lead = `Перший учень за вашим посиланням пройшов онлайн-олімпіаду з логіки Dityam.com.ua. Дякуємо!`;
  // Двоє могли завершити тест майже одночасно — тоді кажемо чесне число.
  const now = count > 1 ? ` Учнів, які вже пройшли олімпіаду за вашим посиланням: ${count}.` : '';
  const how = 'Подяка чекає на вашій сторінці педагога — там її можна переглянути й завантажити. '
    + 'Число учнів на ній оновлюється, коли за вашим посиланням проходять нові.';
  const text = [
    'Добрий день!',
    '',
    `${lead}${now}`,
    '',
    `${how} ${page}`,
    '',
    ...signText,
  ].join('\n');
  const html = wrapHtml(`<p>Добрий день!</p>
<p>${esc(lead)}${esc(now)}</p>
<p>${esc(how)}</p>
${btnHtml(page, 'Отримати подяку')}${signHtml}
`);
  return { subject, text, html };
}

/** Лист із посиланням новому педагогові. Ніколи не кидає. */
export async function sendTeacherWelcome(store, teacher) {
  try {
    if (!store || store.dev || !isEmail(teacher?.email)) return false;
    if (!(await mailPassword())) return false;
    await send({ to: teacher.email, ...buildTeacherWelcome(teacher) });
    return true;
  } catch (e) {
    console.error('[olimpiada/mail] teacher welcome:', e?.message || e);
    return false;
  }
}

/**
 * Лист «перший учень пройшов олімпіаду». Спершу «бронюємо» thanks_sent_at
 * (лише там, де його ще немає), щоб двоє учнів, що завершили тест в одну
 * мить, не дали двох листів. Не вдалося надіслати — знімаємо позначку.
 */
export async function sendTeacherThanks(store, teacher, count) {
  try {
    if (!store || store.dev || !isEmail(teacher?.email)) return false;
    if (!(await mailPassword())) return false;
    if (!(await store.claimTeacherThanks(teacher.code))) return false;
    try {
      await send({ to: teacher.email, ...buildTeacherThanks(teacher, count) });
      return true;
    } catch (e) {
      console.error('[olimpiada/mail] teacher thanks:', e?.message || e);
      await store.releaseTeacherThanks(teacher.code).catch(() => {});
      return false;
    }
  } catch (e) {
    console.error('[olimpiada/mail]', e?.message || e);
    return false;
  }
}
