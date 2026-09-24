// Службовий колбек WayForPay: підтверджує оплату й керує статусом підписки.
// Approved → active + запуск форми в боті; Declined/Expired/... → paused.
import { createClient } from '@supabase/supabase-js';
import { makeBot, beginFlow, finishFlow } from '@/lib/digestFlow';
import {
  verifyCallback, acceptResponse, tokenFromOrderRef, periodFromOrderRef,
  FAILED_STATUSES, describeFailure,
} from '@/lib/wayforpay';
import { markPromoPaid } from '@/lib/promo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PLUS_TOKEN = process.env.TELEGRAM_PLUS_BOT_TOKEN;
const MAIN_TOKEN = process.env.TELEGRAM_BOT_TOKEN;           // сповіщення адміну
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;
const FAILED = Object.keys(FAILED_STATUSES);
const SITE_URL = process.env.SITE_URL || 'https://dityam.com.ua';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// WayForPay шле JSON — інколи як raw body, інколи як єдиний ключ форми.
async function parseBody(request) {
  const raw = await request.text().catch(() => '');
  try { return JSON.parse(raw); } catch { /* try form */ }
  try {
    const first = [...new URLSearchParams(raw).keys()][0];
    return JSON.parse(first);
  } catch { return null; }
}

export async function POST(request) {
  const b = await parseBody(request);
  if (!b || !b.orderReference) return new Response('bad request', { status: 400 });
  if (!verifyCallback(b)) return new Response('bad signature', { status: 403 });

  if (SUPABASE_URL && SERVICE_ROLE) {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
    const token = tokenFromOrderRef(b.orderReference);
    const now = new Date().toISOString();

    if (b.transactionStatus === 'Approved') {
      const { data: existing } = await supabase.from('digest_subscribers')
        .select('consent_at, status, wfp_order_reference').eq('unsub_token', token).maybeSingle();
      // Щомісячне (щорічне) списання приходить тим самим колбеком. Тоді це
      // продовження, а не нова підписка: номер ПЕРШОГО замовлення не
      // перезаписуємо — саме за ним WayForPay скасовує регулярне списання
      // (REMOVE у /stop), — і не шлемо щоразу «Оплата пройшла, профіль готовий».
      const renewal = existing?.status === 'active' && Boolean(existing?.wfp_order_reference);
      const patch = { status: 'active', plan: 'premium', updated_at: now };
      if (!renewal) {
        // orderReference зберігаємо обовʼязково — без нього неможливо скасувати
        // рекурентне списання, коли людина відпишеться.
        patch.wfp_order_reference = b.orderReference;
        patch.billing_period = periodFromOrderRef(b.orderReference, b.amount);
      }
      // Оплата = прийняття оферти. Бот питає згоду перед анкетою, але рядок,
      // створений до 14.09.2026, міг її не мати.
      if (!existing?.consent_at) patch.consent_at = now;

      const { data: sub } = await supabase.from('digest_subscribers')
        .update(patch).eq('unsub_token', token).select('*').maybeSingle();

      // Промокод: оплату зараховуємо лише на ПЕРШОМУ платежі — знижка діє
      // один раз, а колбек приходить і на кожне поновлення.
      if (!renewal && sub?.promo_code && sub?.telegram_chat_id) {
        const use = await markPromoPaid(supabase, {
          code: sub.promo_code,
          chatId: sub.telegram_chat_id,
          orderReference: b.orderReference,
          amount: b.amount,
        });
        if (use && MAIN_TOKEN && ADMIN_CHAT_ID) {
          await makeBot(MAIN_TOKEN).sendMessage(ADMIN_CHAT_ID,
            `💳 <b>Оплата за промокодом ${String(sub.promo_code).toUpperCase()}</b>\n`
            + `${sub.telegram_handle || sub.telegram_chat_id} · ${b.amount} грн · джерело: ${use.source || '—'}`);
        }
      }

      if (sub?.telegram_chat_id && PLUS_TOKEN && !renewal) {
        const bot = makeBot(PLUS_TOKEN);
        // З 14.09.2026 анкету проходять до оплати. Тому після оплати профіль
        // зазвичай уже є — і перепитувати його було б дивно.
        const { count } = await supabase.from('plus_children')
          .select('id', { count: 'exact', head: true }).eq('subscriber_id', sub.id);
        if ((count || 0) > 0 || (sub.age_bands || []).length) {
          await bot.sendMessage(sub.telegram_chat_id, '✅ Оплата пройшла — дякуємо! 🧡');
          await finishFlow(bot, sub.telegram_chat_id, { active: true });
        } else {
          await bot.sendMessage(sub.telegram_chat_id, '✅ Оплата пройшла — дякуємо! 🧡 Тепер налаштуймо профіль дітей:');
          await beginFlow(bot, supabase, sub.telegram_chat_id, null);
        }
      }
    } else if (FAILED.includes(b.transactionStatus)) {
      // План знижуємо разом зі статусом, інакше в базі лишається paused+premium
      // і статистика рахує таку людину як платну.
      //
      // Причину зберігаємо тут і ніде більше: reasonCode приходить лише в
      // цьому колбеку. Загубимо його — і «чому не оплатила» доведеться шукати
      // руками в кабінеті WayForPay (саме так було 24.09.2026).
      const failure = {
        status: b.transactionStatus,
        reasonCode: Number(b.reasonCode) || null,
        reason: b.reason ? String(b.reason) : null,
      };
      const { data: sub } = await supabase.from('digest_subscribers')
        .update({
          status: 'paused',
          plan: 'free',
          updated_at: now,
          wfp_last_status: failure.status,
          wfp_last_reason: failure.reason,
          wfp_last_reason_code: failure.reasonCode,
          wfp_last_failed_at: now,
        })
        .eq('unsub_token', token)
        .select('telegram_handle, telegram_chat_id')
        .maybeSingle();

      // Сповіщення адміну: людина щойно дійшла до кінця анкети й лишилась без
      // підписки. Без цього рядок мовчки висить у «Потребує уваги».
      if (sub && MAIN_TOKEN && ADMIN_CHAT_ID) {
        await makeBot(MAIN_TOKEN).sendMessage(ADMIN_CHAT_ID,
          '⚠️ <b>Оплата Dityam+ не пройшла</b>\n'
          + `${esc(sub.telegram_handle || sub.telegram_chat_id || '—')} · ${esc(b.amount)} ${esc(b.currency || 'UAH')}\n`
          + `${esc(describeFailure(failure))}\n`
          + `<a href="${SITE_URL}/admin/plus">Хто саме →</a>`);
      }
    }
  }

  // Обовʼязкова відповідь WayForPay, що колбек прийнято.
  return Response.json(acceptResponse(b.orderReference));
}
