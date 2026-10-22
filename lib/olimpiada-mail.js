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
import { OLIMP, isEmail, teacherLink, teacherPagePath, TEACHER_THANKS_AT } from './olimpiada.js';
import { teacherGreeting, GREETING_FALLBACK } from './teacher-greeting.js';
import { notifyPath } from './olimpiada-sign.js';
import { PRICE, PRICE_FIRST } from './wayforpay.js';
import { PLUS_FREE } from './plus.js';

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

export async function send({ to, subject, text, html, attachments, fromName = 'Dityam.com.ua' }) {
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
    from: { name: fromName, address: MAIL_FROM }, to, replyTo: MAIL_FROM, subject, text, html,
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
  + (PLUS_FREE
    ? 'Підключити можна безкоштовно, одразу в боті.'
    : `Перший місяць — ${PRICE_FIRST} грн замість ${PRICE} грн, далі ${PRICE} грн/міс, скасувати можна будь-коли.`);

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
  const plusHtml = `<p><b>Що далі після олімпіади?</b><br>${esc(plus)}</p>\n${btn(PLUS_LINK, PLUS_FREE ? 'Підключити Dityam+ безкоштовно' : `Спробувати Dityam+ за ${PRICE_FIRST} грн`, '#16307a', '#ffffff')}`;
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
// Педагог залишив імʼя та email на /olimpiada — 1 особистий лист від Марії з
// посиланням для класу (Марія, 11.10.2026: замість «роботного» листа — її
// власний текст, слово в слово; лист один, не два). Коли за посиланням
// олімпіаду пройде TEACHER_THANKS_AT учнів — 1 лист із подякою у вкладенні.
// Обидва — зі скриньки проєкту, тож відповіді педагогів приходять туди.
// Звертання — у кличному відмінку (lib/teacher-greeting.js), а якщо певності
// немає — «Добрий день!». Імен дітей у листах педагогові немає.
// Запасного скрипта для них немає: не вдалося надіслати подяку — позначку
// знімаємо, і лист спробує наступний учень або сторінка педагога.

const letterHtml = (body) => `<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#1c1c1c;max-width:600px">\n${body}</div>`;
const para = (html) => `<p style="margin:0 0 16px">${html}</p>\n`;
const ahref = (href, label = href) => `<a href="${esc(href)}" style="color:#c8501a">${esc(label)}</a>`;
const SITE_HOST = SITE_URL.replace(/^https?:\/\//, '');
const signText = ['З повагою,', 'Марія Шутяк', 'засновниця Dityam.com.ua', `${MAIL_FROM} · ${SITE_HOST}`];
// Листи педагогам — особисті, від Марії: її імʼя у відправнику, адреса та сама.
const FROM_MARIA = 'Марія Шутяк, Dityam.com.ua';
const signHtml = para(`З повагою,<br>Марія Шутяк<br>засновниця Dityam.com.ua<br>${ahref(`mailto:${MAIL_FROM}`, MAIL_FROM)} · ${ahref(SITE_URL, SITE_HOST)}`);

/**
 * Лист Марії новому педагогові. greeting — «Олено Петрівно, добрий день!»
 * (рахує sendTeacherWelcome за lib/teacher-greeting.js).
 * notifyUrl — підписане посилання на сторінку-підтвердження «Так, повідомляйте
 * мене» (сам перехід згоди не записує); null — абзацу немає.
 */
export function buildTeacherWelcome(teacher, { greeting = GREETING_FALLBACK, notifyUrl } = {}) {
  const link = teacherLink(teacher.code, SITE_URL);
  const page = `${SITE_URL}${teacherPagePath(teacher.code)}`;
  const notifyRel = notifyUrl === undefined ? notifyPath(teacher.code) : notifyUrl;
  const notify = notifyRel ? (notifyRel.startsWith('http') ? notifyRel : `${SITE_URL}${notifyRel}`) : null;
  const subject = 'Дякую, що долучилися до олімпіади';
  const p1 = 'Дякую, що хочете запросити свій клас на нашу олімпіаду. Саме педагоги першими помічають, що дитині щось '
    + 'цікаво, і найчастіше саме від вас діти дізнаються про олімпіади й конкурси. Тому мені важливо написати вам особисто.';
  const p2 = 'Я Марія Шутяк, засновниця Dityam.com.ua — платформи можливостей для дітей 0–18 років. Ми намагаємося '
    + 'зробити так, щоб можливості були рівними для всіх дітей. Тому публікуємо українські й закордонні можливості, '
    + 'а також створюємо власні. Онлайн-олімпіада з логіки — одна з них: безкоштовна, для дітей '
    + `${OLIMP.groupLabel}, ${OLIMP.questionCount} завдань за ${OLIMP.minutes} хвилин, диплом одразу після тесту.`;
  // «5 учнів»: при іншому порозі перевірити відмінок («2 учні»).
  const when = `Коли за ним олімпіаду пройдуть ${TEACHER_THANKS_AT} учнів, ми надішлемо вам подяку від Dityam.com.ua.`;
  const pageLabel = 'Ваша сторінка педагога:';
  const ask = 'Чи можна повідомляти вас і про інші олімпіади та конкурси для ваших учнів?';
  const yes = 'Так, повідомляйте мене';
  const p4 = 'Мені дуже цікаво, як ви працюєте з олімпіадами й конкурсами: звідки про них дізнаєтесь, чого бракує, '
    + 'що заважає. Якщо знайдете хвилинку, напишіть мені у відповідь на цей лист.';
  const text = [
    greeting,
    '',
    p1,
    '',
    p2,
    '',
    'Посилання для вашого класу:',
    link,
    when,
    '',
    `${pageLabel} ${page}`,
    ...(notify ? ['', ask, `${yes}: ${notify}`] : []),
    '',
    p4,
    '',
    ...signText,
  ].join('\n');
  const html = letterHtml(
    para(esc(greeting))
    + para(esc(p1))
    + para(esc(p2))
    + para(`Посилання для вашого класу:<br><b>${ahref(link)}</b><br>${esc(when)}`)
    + para(`${esc(pageLabel)}<br>${ahref(page)}`)
    + (notify ? para(`${esc(ask)}<br><a href="${esc(notify)}" style="display:inline-block;margin-top:8px;padding:8px 18px;border:1px solid #c8501a;border-radius:8px;color:#c8501a;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;text-decoration:none">${esc(yes)}</a>`) : '')
    + para(esc(p4))
    + signHtml,
  );
  return { subject, text, html };
}

/**
 * Лист із подякою (після TEACHER_THANKS_AT учнів). attached — картинка подяки
 * у вкладенні; не вдалося намалювати — лише посилання на сторінку педагога.
 */
export function buildTeacherThanks(teacher, { greeting = GREETING_FALLBACK, attached = true } = {}) {
  const link = teacherLink(teacher.code, SITE_URL);
  const page = `${SITE_URL}${teacherPagePath(teacher.code)}`;
  const subject = 'Ваша подяка від Dityam.com.ua';
  const lead = `За вашим посиланням онлайн-олімпіаду з логіки пройшли вже ${TEACHER_THANKS_AT} учнів. Дякую вам за це!`;
  const get = attached
    ? 'Подяку від Dityam.com.ua додаю до листа, її також можна завантажити на вашій сторінці:'
    : 'Подяку від Dityam.com.ua можна переглянути й завантажити на вашій сторінці:';
  const more = 'Діти можуть і далі проходити олімпіаду за тим самим посиланням:';
  // Запрошення в амбасадори (Марія, 15.10.2026: «запрошуй таких до
  // амбасадорів», «і заклик якийсь»): педагог, що привів клас, — саме той,
  // кого шукає /ambasadory. Обіцянки й дія — лише те, що є на сторінці:
  // заповнити коротку форму. Кнопка — як у листі з дипломом.
  const inviteHead = 'Станьте амбасадоркою чи амбасадором Dityam.com.ua';
  const invite = 'Ви вже робите те, що роблять амбасадори: показуєте дітям можливості. Амбасадори першими дізнаються про наші олімпіади й конкурси, отримують сертифікат, розширений функціонал для вчителів і подарунки від партнерів і впливають на розвиток наших продуктів.';
  const inviteCta = 'Заповніть коротку форму на сторінці:';
  const ambasadory = `${SITE_URL}/ambasadory`;
  const text = [
    greeting,
    '',
    `${lead} ${get} ${page}`,
    '',
    `${more} ${link}`,
    '',
    `${inviteHead}. ${invite} ${inviteCta} ${ambasadory}`,
    '',
    ...signText,
  ].join('\n');
  const btn = (href, label) => `<p><a href="${esc(href)}" style="display:inline-block;padding:14px 28px;border-radius:999px;background:#f5a023;color:#16307a;font-weight:bold;text-decoration:none">${label}</a></p>\n`;
  const html = letterHtml(
    para(esc(greeting))
    + para(`${esc(lead)} ${esc(get)} ${ahref(page)}`)
    + para(`${esc(more)} ${ahref(link)}`)
    + para(`<b>${esc(inviteHead)}</b><br>${esc(invite)} ${esc(inviteCta)}`)
    + btn(ambasadory, 'Стати амбасадором')
    + signHtml,
  );
  return { subject, text, html };
}

/**
 * Лист Марії новому педагогові. Ніколи не кидає. Локально (`next dev`) не
 * шле, а лише пише в консоль тему й звертання.
 */
export async function sendTeacherWelcome(store, teacher) {
  try {
    if (!store || !isEmail(teacher?.email)) return false;
    const greeting = teacherGreeting(teacher.name);
    const mail = buildTeacherWelcome(teacher, { greeting });
    if (store.dev) {
      console.info('[olimpiada/mail] dev, лист педагогу не надсилаємо:', mail.subject, '|', greeting);
      return false;
    }
    if (!(await mailPassword())) return false;
    await send({ to: teacher.email, fromName: FROM_MARIA, ...mail });
    return true;
  } catch (e) {
    console.error('[olimpiada/mail] teacher welcome:', e?.message || e);
    return false;
  }
}

/**
 * Видати подяку: «бронюємо» thanks_sent_at (лише там, де його ще немає), щоб
 * двоє учнів, що завершили тест в одну мить, не дали двох листів; малюємо
 * картинку з датою цієї позначки (render) і шлемо її вкладенням. Не вдалося
 * надіслати — позначку знімаємо: подяки ще немає, наступна спроба видасть її
 * заново. Локально (`next dev`) позначку ставимо, а листа не шлемо — щоб
 * сторінку педагога з подякою можна було перевірити. Ніколи не кидає.
 */
export async function sendTeacherThanks(store, teacher, { render } = {}) {
  try {
    if (!store || !isEmail(teacher?.email)) return false;
    if (store.dev) {
      const row = await store.claimTeacherThanks(teacher.code);
      if (!row) return false;
      // Картинку для вкладення малюємо й тут — щоб локально бачити, що вона виходить.
      const png = render ? await render(row).catch((e) => { console.error('[olimpiada/mail] dev image:', e?.message || e); return null; }) : null;
      console.info('[olimpiada/mail] dev, подяку видано, листа не надсилаємо:', teacher.code,
        png ? `вкладення ${Math.round(png.length / 1024)} КБ` : 'без вкладення', '|', teacherGreeting(row.name));
      return true;
    }
    if (!(await mailPassword())) return false;
    const claimed = await store.claimTeacherThanks(teacher.code);
    if (!claimed) return false;
    try {
      let png = null;
      try { png = render ? await render(claimed) : null; } catch (e) {
        console.error('[olimpiada/mail] teacher thanks image:', e?.message || e);
      }
      const greeting = teacherGreeting(claimed.name);
      await send({
        to: claimed.email, fromName: FROM_MARIA,
        ...buildTeacherThanks(claimed, { greeting, attached: Boolean(png) }),
        ...(png ? { attachments: [{ filename: 'podyaka-pedagogu-dityam.png', content: png, contentType: 'image/png' }] } : {}),
      });
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
