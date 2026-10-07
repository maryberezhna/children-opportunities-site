// Лист-запрошення до тесту — одразу із сайту, в мить, коли оплату
// підтверджено. До 07.10.2026 його слав лише scraper/olimpiada_invites.py за
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
import { OLIMP, accessUntil, kyivDateTime, isEmail } from './olimpiada.js';

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
  const until = kyivDateTime(accessUntil(entry.paid_at));
  const subject = `Запрошення до онлайн-олімпіади з логіки — ${name}`;
  // Оплатили разом із друкованим дипломом (249 грн) — вдруге його не пропонуємо.
  const post = entry.print_paid_at
    ? 'диплом зʼявиться на тій самій сторінці одразу після тесту; друкований диплом ви вже оплатили — адресу доставки Новою поштою вкажете там само;'
    : `диплом зʼявиться на тій самій сторінці одразу після тесту; за бажанням його можна отримати Новою поштою — додатково ${OLIMP.printPrice} грн;`;
  const points = [
    `почати тест треба до ${until} за київським часом — це ${OLIMP.accessHours} години після оплати;`,
    `${OLIMP.questionCount} завдань і 1 відкрите, ${OLIMP.minutes} хвилин на все, 1 спроба; час піде після натискання «Почати»;`,
    // Яке саме відкрите завдання — секрет до тесту (Марія, 06.10.2026).
    'останнє завдання — відкрите: без варіантів, дитина пише свою відповідь; воно вирішує, хто отримає приз місяця;',
    `коли час вийде, буде ще ${OLIMP.overtimeSeconds / 60} хвилини, щоб дописати й відправити відповіді, — потім вони відправляться самі;`,
    post,
    `переможців місяця оголосимо до 7-го числа наступного місяця; якщо ${name} виграє, повідомимо вас окремим листом на цю адресу.`,
  ];
  const text = [
    'Добрий день!',
    '',
    `Оплату отримали — ${name} бере участь в онлайн-олімпіаді з логіки Dityam.com.ua.`,
    `Посилання на тест: ${link}`,
    '',
    'Що важливо:',
    ...points.map((p) => `• ${p}`),
    '',
    'Після початку тесту або коли час на проходження минув, внесок не повертається.',
    '',
    'Марія Шутяк, Dityam.com.ua',
    MAIL_FROM,
  ].join('\n');
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;color:#1c1c1c;max-width:560px">
<p>Добрий день!</p>
<p>Оплату отримали — <b>${esc(name)}</b> бере участь в онлайн-олімпіаді з логіки Dityam.com.ua.</p>
<p><a href="${esc(link)}" style="display:inline-block;padding:14px 28px;border-radius:999px;background:#f5a023;color:#16307a;font-weight:bold;text-decoration:none">Перейти до тесту</a></p>
<p>Що важливо:</p>
<ul>${points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
<p>Якщо кнопка не відкривається, скопіюйте посилання:<br><a href="${esc(link)}">${esc(link)}</a></p>
<p style="color:#6b6b6b;font-size:14px">Після початку тесту або коли час на проходження минув, внесок не повертається.</p>
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

async function send({ to, subject, text, html }) {
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
