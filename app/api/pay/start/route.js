// Перехід на оплату Dityam+: створює рахунок у мить натискання й веде на WayForPay.
//
// Навіщо окремий крок. До 24.09.2026 кнопка в @DityamPlusBot несла готовий
// invoiceUrl, зроблений тоді ж, коли надсилалось повідомлення. Рахунок
// WayForPay живе годину («Valid to» в кабінеті), а повідомлення лишається в
// чаті назавжди — тож будь-хто, хто відкрив бота пізніше, тиснув мертву
// кнопку й бачив «посилання застаріло». Тепер кнопка веде сюди.
//
// Заразом: /start більше не створює наосліп два рахунки (місяць + рік) на
// кожен свій виклик, а промокод і ціна беруться на момент кліку, а не на
// момент показу.
import { createClient } from '@supabase/supabase-js';
import { createInvoice, wayforpayConfigured } from '@/lib/wayforpay';
import { findPromo, promoUsable } from '@/lib/promo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Людина натиснула «Оформити» — сторінка продажу їй уже нічого не пояснить.
// Тому на будь-якій поломці ведемо назад у бота, де є і підтримка, і кнопка
// спробувати ще раз, а причину лишаємо в лозі Vercel.
const backToBot = (why) => {
  console.error(`[pay/start] ${why}`);
  return Response.redirect('https://t.me/DityamPlusBot', 302);
};

export async function GET(request) {
  if (!wayforpayConfigured) return backToBot('wayforpay not configured');
  if (!SUPABASE_URL || !SERVICE_ROLE) return backToBot('supabase not configured');

  const { searchParams } = new URL(request.url);
  const token = searchParams.get('t');
  const plan = searchParams.get('plan') === 'yearly' ? 'yearly' : 'monthly';
  if (!token) return backToBot('no token');

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const { data: sub } = await supabase.from('digest_subscribers')
    .select('*').eq('unsub_token', token).maybeSingle();
  if (!sub) return backToBot('subscriber not found');

  // Знижка рахується тут, а не при показі кнопки: між показом і натисканням
  // код могли ввести, вичерпати або він міг протермінуватись.
  const promo = sub.promo_code ? await findPromo(supabase, sub.promo_code) : null;
  const promoOk = promo && promoUsable(promo, { used: promo.used }).ok && !sub.wfp_order_reference;
  const firstRaw = plan === 'yearly' ? promo?.yearly_amount : promo?.first_amount;
  const firstAmount = promoOk && firstRaw != null ? Number(firstRaw) : null;

  const inv = await createInvoice(sub, plan, { firstAmount });
  if (!inv.url) return backToBot(`createInvoice failed: ${inv.error || 'no url'}`);
  return Response.redirect(inv.url, 302);
}

export async function HEAD() {
  // Telegram і месенджери інколи «простукують» посилання перед відкриттям.
  // Рахунок на таке не створюємо — інакше в кабінеті WayForPay плодяться
  // порожні INVOICE, яких ніхто не відкривав.
  return new Response(null, { status: 200, headers: { 'Cache-Control': 'no-store' } });
}
