import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// «👍 Цікаво / 👎 Не цікаво» з листа Dityam+ (scraper/personal_digest.py →
// feedback_url).
//
// Голос ставить лише POST. Сканери посилань у поштових сервісах відкривають
// посилання заздалегідь — якби голос ставив GET, лист «голосував» би сам.
// Тому GET віддає сторінку, яка одразу відправляє форму; без JavaScript
// людина просто натискає кнопку.
//
// Позначки лежать там само, де й від кнопок у Telegram: opportunity_feedback
// за Telegram-id. Підписник Dityam+ завжди оформлюється в @DityamPlusBot, тож
// chat_id у нього є, навіть коли добірки йдуть на імейл.

const LABEL = { yes: '👍 Цікаво', no: '👎 Не цікаво' };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const page = (title, body, extra = '') => new Response(
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
   <meta name="robots" content="noindex">
   <title>${esc(title)}</title>
   <div style="max-width:520px;margin:80px auto;padding:0 20px;font-family:system-ui,sans-serif;color:#131b28;text-align:center">
     <h1 style="font-size:24px">${esc(title)}</h1><p style="font-size:16px;color:#54617a;line-height:1.6">${body}</p>
     ${extra}
     <p><a href="https://dityam.com.ua" style="color:#1e4fd6;font-weight:600">← На Dityam.com.ua</a></p>
   </div>`,
  { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } },
);

const valid = ({ t, o, v }) => Boolean(t) && UUID.test(o || '') && Object.hasOwn(LABEL, v || '');

export async function GET(request) {
  const q = new URL(request.url).searchParams;
  const input = { t: q.get('t'), o: q.get('o'), v: q.get('v') };
  if (!valid(input)) return page('Невірне посилання', 'Спробуйте натиснути кнопку в листі ще раз.');
  if (input.t === 'demo') {
    return page('Це пробний лист', 'У пробному листі позначки не зберігаються. У справжній добірці ця кнопка запамʼятає вашу відповідь.');
  }
  const form = `
    <form id="f" method="post" action="/api/plus/feedback">
      <input type="hidden" name="t" value="${esc(input.t)}">
      <input type="hidden" name="o" value="${esc(input.o)}">
      <input type="hidden" name="v" value="${esc(input.v)}">
      <button type="submit" style="font-size:16px;padding:12px 22px;border-radius:9999px;border:0;background:#c8501a;color:#fff;font-weight:700;cursor:pointer">
        Позначити: ${LABEL[input.v]}
      </button>
    </form>
    <script>document.getElementById('f').submit()</script>`;
  return page('Зберігаємо відповідь…', 'Якщо сторінка не оновилась сама, натисніть кнопку.', form);
}

export async function POST(request) {
  const f = await request.formData();
  const input = { t: f.get('t'), o: f.get('o'), v: f.get('v') };
  if (!valid(input)) return page('Невірне посилання', 'Спробуйте натиснути кнопку в листі ще раз.');

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return page('Помилка', 'Сервіс тимчасово недоступний. Спробуйте трохи пізніше.');
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data: sub } = await supabase.from('digest_subscribers')
    .select('telegram_chat_id').eq('unsub_token', input.t).maybeSingle();
  if (!sub) return page('Не знайдено', 'Можливо, ви вже відписались від Dityam+.');
  if (!sub.telegram_chat_id) {
    return page('Не вдалося зберегти', 'Напишіть нам на hellodityam.com.ua@gmail.com — позначимо вручну.');
  }

  const { data: opp } = await supabase.from('opportunities')
    .select('title, slug').eq('id', input.o).maybeSingle();
  if (!opp) return page('Не знайдено', 'Цієї можливості вже немає на платформі.');

  const { error } = await supabase.from('opportunity_feedback').upsert({
    opportunity_id: input.o,
    telegram_user_id: Number(sub.telegram_chat_id),
    value: input.v,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'opportunity_id,telegram_user_id' });
  if (error) {
    console.error('plus feedback upsert failed', error.message);
    return page('Не вдалося зберегти', 'Спробуйте натиснути кнопку в листі ще раз трохи пізніше.');
  }

  const link = `<p><a href="https://dityam.com.ua/o/${esc(opp.slug)}" style="color:#1e4fd6">Відкрити можливість</a></p>`;
  return input.v === 'yes'
    ? page('Позначили: цікаво 👍', `«${esc(opp.title)}» — дякуємо за відповідь.`, link)
    : page('Позначили: не цікаво 👎', `«${esc(opp.title)}» більше не надсилатимемо ні в добірках, ні в нагадуваннях.`);
}
