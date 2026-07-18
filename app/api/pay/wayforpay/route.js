// Службовий колбек WayForPay: підтверджує оплату й керує статусом підписки.
// Approved → active + запуск форми в боті; Declined/Expired/... → paused.
import { createClient } from '@supabase/supabase-js';
import { makeBot, beginFlow } from '@/lib/digestFlow';
import { verifyCallback, acceptResponse, tokenFromOrderRef } from '@/lib/wayforpay';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PLUS_TOKEN = process.env.TELEGRAM_PLUS_BOT_TOKEN;
const FAILED = ['Declined', 'Expired', 'Refunded', 'Voided', 'RefundInProcessing'];

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
      const { data: sub } = await supabase.from('digest_subscribers')
        .update({ status: 'active', plan: 'premium', updated_at: now })
        .eq('unsub_token', token).select('*').maybeSingle();
      if (sub?.telegram_chat_id && PLUS_TOKEN) {
        const bot = makeBot(PLUS_TOKEN);
        await bot.sendMessage(sub.telegram_chat_id, '✅ Оплата пройшла — дякуємо! 🧡 Тепер налаштуймо профіль дитини:');
        await beginFlow(bot, supabase, sub.telegram_chat_id, null);
      }
    } else if (FAILED.includes(b.transactionStatus)) {
      await supabase.from('digest_subscribers').update({ status: 'paused', updated_at: now }).eq('unsub_token', token);
    }
  }

  // Обовʼязкова відповідь WayForPay, що колбек прийнято.
  return Response.json(acceptResponse(b.orderReference));
}
