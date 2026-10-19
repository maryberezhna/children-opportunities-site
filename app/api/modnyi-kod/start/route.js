// Заявка на «Модний код»: створюємо запис і одразу відкриваємо кабінет.
//
// 19.10.2026 Марія: «робимо модний код безкоштовним». Рахунка WayForPay тут
// більше немає — заявка веде прямо в кабінет, як в олімпіаді з логіки.
// adminTestPaid лишається: саме вона позначає запис відкритим (колонка
// paid_at — спадок платної версії, решта коду читає її як «кабінет доступний»).
import { cookies } from 'next/headers';
import { cleanMkEntry, MK, mkCabinet } from '@/lib/modnyi-kod';
import { mkDb, recentCount, createEntry, serverEvent, adminTestPaid } from '@/lib/modnyi-kod-server';
import { isAdmin } from '@/lib/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request) {
  let b;
  try { b = await request.json(); } catch { return json({ error: 'bad_request' }, 400); }
  if (b.website) return json({ ok: true });
  if (!MK.open) return json({ error: 'closed' }, 403);
  const { entry, error } = cleanMkEntry(b);
  if (error) return json({ error }, 400);
  const db = mkDb();
  if (!db) return json({ error: 'unavailable' }, 503);
  // Адмін (кука з /admin) проходить без оплати — тест усього шляху.
  const admin = isAdmin(cookies().get('dityam_admin')?.value);
  try {
    // Запобіжник від спаму лишається: безкоштовне не означає без меж.
    if (!admin && await recentCount(db, entry.parent_email) >= 5) {
      return json({ error: 'too_many' }, 429);
    }
    const row = await adminTestPaid(db, await createEntry(db, entry, admin ? 'admin_test' : b.source));
    if (!admin) await serverEvent(db, 'mk_paid', row.source || 'page');
    return json({ url: mkCabinet(row.token), t: row.token });
  } catch (e) {
    console.error('[mk/start]', e?.message || e);
    return json({ error: 'unavailable' }, 503);
  }
}
