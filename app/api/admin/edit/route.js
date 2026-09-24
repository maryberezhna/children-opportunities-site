import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { isAdmin } from '@/lib/adminAuth';
import { isoWeek } from '@/lib/week';
import { missingRequired } from '@/lib/required';
import { STUB_MARK, withoutStubMark } from '@/lib/suggestions';
import { TRACKED_FIELDS, correctionRows } from '@/lib/corrections';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COST = ['free', 'partially_free', 'paid_affordable', 'paid_premium', 'subsidized'];
const TYPES = [
  'course', 'workshop', 'summer_school', 'mentorship', 'club', 'camp', 'study_program',
  'olympiad', 'competition', 'hackathon', 'sport_tournament', 'festival', 'award',
  'exchange', 'excursion', 'residency', 'scholarship', 'grant', 'allowance',
  'support_payment', 'internship', 'volunteer', 'conference', 'medical_aid',
  'psychology', 'rehabilitation', 'humanitarian', 'legal_aid', 'shelter', 'educational_material',
];
const FORMATS = ['online', 'offline', 'hybrid'];
const RECURRENCE = ['annual', 'ongoing'];
const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const clampAge = (v, d) => {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? d : Math.max(0, Math.min(18, n));
};

export async function POST(request) {
  const cookie = cookies().get('dityam_admin')?.value;
  if (!isAdmin(cookie)) {
    return Response.json({ ok: false }, { status: 403 });
  }

  const b = await request.json().catch(() => ({}));
  if (!b.id) return Response.json({ ok: false, error: 'bad_request' }, { status: 400 });

  const patch = { updated_at: new Date().toISOString() };
  if (typeof b.title === 'string' && b.title.trim()) patch.title = b.title.trim().slice(0, 300);
  if (typeof b.summary === 'string') patch.summary = b.summary.trim().slice(0, 400);
  if (b.deadline === '' || b.deadline == null) patch.deadline = null;
  else if (typeof b.deadline === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.deadline)) patch.deadline = b.deadline;
  // Порожній вік приходить лише з чернетки, створеної з пропозиції (форма
  // показує заглушку 0–18 порожньою). Тоді вік не пишемо зовсім — і публікація
  // нижче спіткнеться об «бракує: вік», а не пропустить заглушку як факт.
  const hasAges = ![b.age_from, b.age_to].some((v) => v === '' || v == null);
  if (hasAges) {
    patch.age_from = clampAge(b.age_from, 0);
    patch.age_to = clampAge(b.age_to, 18);
    if (patch.age_from > patch.age_to) { patch.age_from = 0; patch.age_to = 18; }
  }
  patch.cost_type = COST.includes(b.cost_type) ? b.cost_type : null;
  patch.event_start_date = isDate(b.event_start_date) ? b.event_start_date : null;
  patch.event_end_date = isDate(b.event_end_date) ? b.event_end_date : null;
  patch.results_date = isDate(b.results_date) ? b.results_date : null;
  patch.recurrence = RECURRENCE.includes(b.recurrence) ? b.recurrence : null;
  patch.format = FORMATS.includes(b.format) ? b.format : null;
  // Міста приходять рядком через кому — так їх і вводять руками.
  if (typeof b.cities === 'string') {
    patch.cities = b.cities.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 20);
  }
  if (TYPES.includes(b.opportunity_type)) patch.opportunity_type = b.opportunity_type;
  if (typeof b.price_note === 'string') patch.price_note = b.price_note.trim().slice(0, 200) || null;
  if (typeof b.details === 'string') patch.details = b.details.trim().slice(0, 20000) || null;
  // Посилання на подачу приймаємо лише як http(s): «дивись у пості» чи назва
  // форми — не адреса, і кнопка з таким href веде в нікуди.
  if (typeof b.apply_url === 'string') {
    const url = b.apply_url.trim();
    patch.apply_url = url.startsWith('http') ? url.slice(0, 500) : null;
  }
  // Ручний топ тижня. Пишемо не прапорець, а сам тиждень: знята галочка
  // гасить позначку одразу, а забута — сама в понеділок.
  if (typeof b.featured === 'boolean') patch.featured_week = b.featured ? isoWeek() : null;
  // Дата, тип, вік, вартість і місце-або-формат обовʼязкові перед виходом на
  // сайт (вимога Марії 11.09.2026). Рахуємо по тому, що людина щойно ввела,
  // разом із полями, яких у формі немає (країни, позначка міжнародної).
  if (b.publish) {
    const missing = missingRequired({
      ...patch,
      countries: b.countries || null,
      is_international: b.is_international || false,
    });
    if (missing.length) {
      return Response.json({ ok: false, error: 'missing_required', missing }, { status: 422 });
    }
    patch.status = 'active';
    patch.verified_at = new Date().toISOString();
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return Response.json({ ok: false, error: 'server' }, { status: 500 });
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // Значення ДО збереження. 23.09.2026: ми не зберігали, ЩО саме виправила
  // людина, тож конвеєр повторював ті самі помилки — після update старе
  // значення зникає назавжди, і прочитати його можна лише тут.
  const { data: cur } = await supabase.from('opportunities')
    .select(`admin_comment, ${TRACKED_FIELDS.join(', ')}`)
    .eq('id', b.id).maybeSingle();

  // Людина сама обрала тип і вік — заглушка з пропозиції стала фактом, знімаємо
  // позначку, і форма далі показує збережені значення.
  if (hasAges && TYPES.includes(b.opportunity_type)
      && cur && String(cur.admin_comment || '').includes(STUB_MARK)) {
    patch.admin_comment = withoutStubMark(cur.admin_comment);
  }

  const { error } = await supabase.from('opportunities').update(patch).eq('id', b.id).select('id').maybeSingle();
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  // Телеметрія навчання: один рядок на кожне змінене поле, разом із «модель не
  // знайшла — людина знайшла». Пишемо ПІСЛЯ вдалого збереження (не зберегли —
  // не було й виправлення) і мовчки: таблиці може ще не бути (міграція
  // 20260923_moderation_corrections.sql), а правка людини цінніша за лічильник.
  // Без `cur` не пишемо зовсім: читання могло не вдатись, і тоді вийшло б, що
  // людина «заповнила» весь запис із порожнечі — вигадана закономірність.
  if (cur) {
    try {
      const rows = correctionRows(b.id, cur, patch, 'edit');
      if (rows.length) await supabase.from('moderation_corrections').insert(rows);
    } catch { /* телеметрія мовчить і нічого не ламає */ }
  }

  return Response.json({ ok: true, published: !!b.publish });
}
