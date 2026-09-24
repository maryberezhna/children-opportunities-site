import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { isAdmin } from '@/lib/adminAuth';
import { canonicalUrl } from '@/lib/canonical.mjs';
import {
  STUB_MARK, slugFromTitle, contentHash, ORIGINS, originOf, sourceFor,
} from '@/lib/suggestions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Дві дії над пропозицією можливості в /admin/messages.
 *
 *   add    — «Додати на сайт»: чернетка в черзі модерації з назвою й
 *            посиланням. Сайт її ще не показує: форма правки, куди адмінка
 *            переходить одразу, не дасть опублікувати без пʼяти обовʼязкових
 *            полів. Якщо така сторінка в базі вже є — нового запису не
 *            робимо, відкриваємо наявний.
 *   reject — «Відхилити»: пропозицію закрито, на сайт вона не піде. Листа
 *            відправнику не шлемо: для відповіді є кнопка «Відповісти».
 *
 * До 21.09.2026 для пропозицій була лише «Опрацьовано» — і пропозиція, яку
 * автоматика не змогла розібрати, лишалась без жодного способу потрапити на
 * сайт, крім як переписати її руками в базу.
 */
export async function POST(request) {
  const cookie = cookies().get('dityam_admin')?.value;
  if (!isAdmin(cookie)) {
    return Response.json({ ok: false }, { status: 403 });
  }

  const { id, action } = await request.json().catch(() => ({}));
  if (!id || !['add', 'reject'].includes(action)) {
    return Response.json({ ok: false, error: 'bad_request' }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return Response.json({ ok: false, error: 'server' }, { status: 500 });
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data: s } = await supabase.from('opportunity_suggestions')
    .select('*').eq('id', id).maybeSingle();
  if (!s) return Response.json({ ok: false, error: 'not_found' }, { status: 404 });

  if (action === 'reject') {
    const { error } = await supabase.from('opportunity_suggestions')
      .update({ status: 'dismissed' }).eq('id', id);
    if (error) return Response.json({ ok: false, error: 'server' }, { status: 500 });
    return Response.json({ ok: true, status: 'dismissed' });
  }

  const source = String(s.url || '').trim();
  if (!/^https?:\/\//i.test(source)) {
    return Response.json({ ok: false, error: 'no_url' }, { status: 422 });
  }
  const canon = canonicalUrl(source);

  // Така сторінка вже в базі (автоматика її імпортувала, або кнопку натиснули
  // вдруге) — відкриваємо наявний запис, а не кладемо поряд дубль.
  for (const [column, value] of [['canonical_url', canon], ['source_url', source]]) {
    if (!value) continue;
    const { data: found } = await supabase.from('opportunities')
      .select('id').eq(column, value).is('canonical_slug', null).limit(1);
    if (found && found.length) {
      await supabase.from('opportunity_suggestions').update({ status: 'added' }).eq('id', id);
      return Response.json({ ok: true, status: 'added', opportunityId: found[0].id, existed: true });
    }
  }

  const { data: hubs } = await supabase.from('dedup_hub_urls').select('url_prefix');
  const isHub = (hubs || []).some((h) => h.url_prefix && canon && canon.startsWith(h.url_prefix));

  const title = String(s.title || '').trim().slice(0, 300) || source;
  const popup = originOf(s) === 'popup';
  const trace = [
    `${ORIGINS[originOf(s)].trace}, додано вручну в адмінці`,
    s.contact ? `${popup ? 'контакт' : 'організатор'}: ${s.contact}` : null,
    s.comment ? `коментар: ${String(s.comment).slice(0, 200)}` : null,
    STUB_MARK,
  ].filter(Boolean).join(' · ');

  const { data: created, error } = await supabase.from('opportunities').insert({
    title,
    slug: slugFromTitle(title, source),
    source: sourceFor(s, 'Пропозиція від людей'),
    source_url: source,
    canonical_url: canon,
    content_hash: contentHash(title, source, isHub),
    status: 'draft',
    // Технічна заглушка: база не приймає запис без типу й віку. Поки стоїть
    // STUB_MARK, форма показує їх порожніми й публікацію не пускає.
    opportunity_type: 'course',
    age_from: 0,
    age_to: 18,
    admin_comment: trace,
  }).select('id').single();
  if (error || !created) {
    return Response.json({ ok: false, error: error?.message || 'server' }, { status: 500 });
  }

  await supabase.from('opportunity_suggestions').update({ status: 'added' }).eq('id', id);
  return Response.json({ ok: true, status: 'added', opportunityId: created.id, existed: false });
}
