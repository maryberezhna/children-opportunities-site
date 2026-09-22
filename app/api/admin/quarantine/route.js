import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { safeEqual } from '@/lib/adminAuth';
import { verdictPatch } from '@/lib/quarantine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Рішення людини по сирій знахідці — вкладка «Знахідки» в /admin.
 *
 *   accept — «Завести можливість»: сирець повертається в чергу розбору з
 *            review_verdict='accept'. Нічний розбір (scraper/main.py) створює
 *            можливість тією ж моделлю, але без порогу впевненості. Поля
 *            заповнює модель, а не людина вручну; пʼять обовʼязкових полів
 *            діють як завжди — чого бракує, те піде чернеткою.
 *   reject — «Відхилити»: підтверджена відмова. review_verdict — дані для
 *            тюнінгу порога карантину.
 */
export async function POST(request) {
  const token = process.env.ADMIN_TOKEN;
  const cookie = cookies().get('dityam_admin')?.value;
  if (!token || !cookie || !safeEqual(cookie, token)) {
    return Response.json({ ok: false }, { status: 403 });
  }

  const { id, action } = await request.json().catch(() => ({}));
  const patch = verdictPatch(action);
  if (!id || !patch) return Response.json({ ok: false, error: 'bad_request' }, { status: 400 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return Response.json({ ok: false, error: 'server' }, { status: 500 });
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // Лише записи, що справді в карантині: повторне натискання чи стара вкладка
  // не повинні повернути в чергу вже розібране.
  const { data, error } = await supabase.from('raw_items').update(patch)
    .eq('id', id).eq('status', 'review').select('id');
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  if (!data || !data.length) return Response.json({ ok: false, error: 'not_in_review' }, { status: 409 });
  return Response.json({ ok: true, status: patch.status });
}
