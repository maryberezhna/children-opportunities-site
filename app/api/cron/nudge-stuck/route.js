import { createClient } from '@supabase/supabase-js';
import { makeBot } from '@/lib/digestFlow';
import { STALL_MINUTES, stallStage, shouldNudge, nudgeText } from '@/lib/nudge';

/**
 * Написати тому, хто завис до оплати або на ній.
 *
 * Марія, 28.09.2026: «треба автоматично через 5 хв, якщо людина зависла до чи
 * на етапі оплати».
 *
 * Чому Vercel, а не GitHub Actions: тамтешній cron запізнюється на 4–5 годин
 * (перевірено не раз), і «через пʼять хвилин» там неможливе в принципі.
 *
 * Чому окремий маршрут, а не таймер у самому боті: вебхук — serverless, він
 * завершується разом із відповіддю Telegram, і жоден setTimeout на пʼять
 * хвилин там не доживе.
 *
 * Пишемо РІВНО ОДИН раз на людину (позначка stuck_notice_at) і лише після
 * того, як Telegram прийняв повідомлення: інакше людина лишилась би і без
 * листа, і поза наступною вибіркою. Друге нагадування про те саме — це вже
 * не турбота, а те, від чого блокують.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PLUS_TOKEN = process.env.TELEGRAM_PLUS_BOT_TOKEN;
const CRON_SECRET = process.env.CRON_SECRET;

// Скільки людей за один прохід. Вибірка завжди крихітна (ті, хто завис за
// останні хвилини), але межа рятує від розсилки, якщо щось піде не так із
// позначкою.
const MAX_PER_RUN = 20;

export async function GET(request) {
  // Vercel шле свій секрет у заголовку. Без нього маршрут відкритий для
  // будь-кого, а він пише людям — тож закрито наглухо.
  if (CRON_SECRET) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${CRON_SECRET}`) {
      return Response.json({ error: 'forbidden' }, { status: 401 });
    }
  }
  if (!SB_URL || !SB_KEY || !PLUS_TOKEN) {
    return Response.json({ error: 'missing env' }, { status: 500 });
  }

  const supabase = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
  const edge = new Date(Date.now() - STALL_MINUTES * 60 * 1000).toISOString();

  const { data: rows, error } = await supabase.from('digest_subscribers')
    .select('id, telegram_chat_id, telegram_handle, status, flow_step, consent_at, '
      + 'phone, stuck_notice_at, updated_at, created_at, admin_comment')
    // Активним писати нема про що, а хто сам сказав /stop — тим поготів:
    // «ви зупинились» після свідомої відмови читається як неповага.
    .not('status', 'in', '(active,unsubscribed,cancelled)')
    .is('stuck_notice_at', null)
    .not('telegram_chat_id', 'is', null)
    .lt('updated_at', edge)
    .limit(MAX_PER_RUN);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!rows?.length) return Response.json({ checked: 0, sent: 0 });

  // Чи заповнена анкета — по дітях: саме цим 'pay' відрізняється від 'form'.
  const ids = rows.map((r) => r.id);
  const { data: kids } = await supabase.from('plus_children')
    .select('subscriber_id').in('subscriber_id', ids);
  const withChild = new Set((kids || []).map((k) => k.subscriber_id));

  const bot = makeBot(PLUS_TOKEN);
  const sent = [];
  const skipped = [];
  for (const sub of rows) {
    const hasChild = withChild.has(sub.id);
    if (!shouldNudge(sub, { hasChild })) { skipped.push(sub.telegram_handle); continue; }
    const stage = stallStage(sub, { hasChild });
    const text = nudgeText(stage);
    if (!text) { skipped.push(sub.telegram_handle); continue; }

    const res = await bot.sendMessage(sub.telegram_chat_id, text);
    const body = typeof res?.json === 'function' ? await res.json().catch(() => ({})) : {};
    if (body.ok) {
      await supabase.from('digest_subscribers')
        .update({ stuck_notice_at: new Date().toISOString() }).eq('id', sub.id);
      sent.push({ handle: sub.telegram_handle, stage });
    } else if (/blocked|deactivated|chat not found/i.test(body.description || '')) {
      // Людина заблокувала бота або видалила акаунт — писати нікуди й ніколи.
      // Позначку СТАВИМО, інакше cron кожні пʼять хвилин довіку стукав би в
      // стіну: троє таких у базі вже є (24–27.09.2026).
      await supabase.from('digest_subscribers').update({
        stuck_notice_at: new Date().toISOString(),
        admin_comment: `${sub.admin_comment ? `${sub.admin_comment} · ` : ''}`
          + `Нагадування не доставлено ${new Date().toISOString().slice(0, 10)}: `
          + `${body.description}. Більше не пробуємо.`,
      }).eq('id', sub.id);
      skipped.push(`${sub.telegram_handle}: ${body.description}`);
    } else {
      // Тимчасовий збій (мережа, ліміт Telegram) — позначку не ставимо,
      // наступний прохід спробує ще раз.
      skipped.push(`${sub.telegram_handle}: ${body.description || 'не прийнято'}`);
    }
  }

  return Response.json({ checked: rows.length, sent, skipped });
}
