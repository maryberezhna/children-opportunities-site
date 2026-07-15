import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const page = (title, body) => new Response(
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
   <title>${title}</title>
   <div style="max-width:520px;margin:80px auto;padding:0 20px;font-family:system-ui,sans-serif;color:#131b28;text-align:center">
     <h1 style="font-size:24px">${title}</h1><p style="font-size:16px;color:#54617a;line-height:1.6">${body}</p>
     <p><a href="https://dityam.com.ua" style="color:#1e4fd6;font-weight:600">← На Dityam.com.ua</a></p>
   </div>`,
  { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
);

export async function GET(request) {
  const token = new URL(request.url).searchParams.get('t');
  if (!token) return page('Невірне посилання', 'Токен відписки відсутній.');

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return page('Помилка', 'Сервіс тимчасово недоступний.');
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data, error } = await supabase.from('digest_subscribers')
    .update({ status: 'unsubscribed', updated_at: new Date().toISOString() })
    .eq('unsub_token', token).select('id').maybeSingle();

  if (error || !data) return page('Не знайдено', 'Можливо, ви вже відписались.');
  return page('Відписано ✅', 'Ви більше не отримуватимете персональну підбірку. Повернутись можна будь-коли на сайті.');
}
