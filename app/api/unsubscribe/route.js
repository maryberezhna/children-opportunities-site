import { createClient } from '@supabase/supabase-js';
import { removeRecurring } from '@/lib/wayforpay';

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

  const { data: sub } = await supabase.from('digest_subscribers')
    .select('id, wfp_order_reference').eq('unsub_token', token).maybeSingle();
  if (!sub) return page('Не знайдено', 'Можливо, ви вже відписались.');

  // Спершу зупиняємо гроші, потім розсилку. Якщо WayForPay не відповів —
  // не кажемо «відписано», інакше людина піде спокійною, а списання триватиме.
  if (sub.wfp_order_reference) {
    const r = await removeRecurring(sub.wfp_order_reference);
    if (!r.ok) {
      console.error('WayForPay REMOVE failed', sub.wfp_order_reference, r);
      return page(
        'Не вдалося скасувати списання',
        'Розсилку зупинимо, але автоматично скасувати платіж не вийшло. Напишіть на maryberezhna@gmail.com — скасуємо вручну сьогодні ж, гроші не спишуться.',
      );
    }
  }

  const { data, error } = await supabase.from('digest_subscribers')
    .update({ status: 'unsubscribed', plan: 'free', updated_at: new Date().toISOString() })
    .eq('unsub_token', token).select('id').maybeSingle();

  if (error || !data) return page('Не знайдено', 'Можливо, ви вже відписались.');
  return page('Відписано ✅', sub.wfp_order_reference
    ? 'Ви більше не отримуватимете персональну підбірку, а списання скасовано — більше нічого не знімемо.'
    : 'Ви більше не отримуватимете персональну підбірку. Повернутись можна будь-коли на сайті.');
}
