import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { isAdmin, adminName } from '@/lib/adminAuth';
import { pushModeration } from '@/lib/notion';
import { missingRequired } from '@/lib/required';
import { DECISION_FIELD } from '@/lib/corrections';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// action → { patch applied to the row, Notion decision label }
const ACTIONS = {
  approve: { status: 'active', decision: 'Додано на сайт', verify: true },   // draft → live
  skip:    { status: 'closed', decision: 'Пропущено' },                       // draft → hidden
  verify:  { decision: 'Перевірено', verify: true },                          // active link ok
  remove:  { status: 'closed', decision: 'Прибрано' },                        // active → hidden
  comment: { decision: 'Коментар' },                                          // note only, stays in queue
};

export async function POST(request) {
  const cookie = cookies().get('dityam_admin')?.value;
  if (!isAdmin(cookie)) {
    return Response.json({ ok: false }, { status: 403 });
  }

  const { id, action, comment } = await request.json().catch(() => ({}));
  const spec = ACTIONS[action];
  if (!id || !spec) {
    return Response.json({ ok: false, error: 'bad_request' }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return Response.json({ ok: false, error: 'server' }, { status: 500 });
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // Дата, тип, вік, вартість і місце-або-формат обовʼязкові перед виходом на
  // сайт (вимога Марії 11.09.2026) — і кнопка в черзі тут не виняток.
  // Перевіряємо на сервері, а не лише в інтерфейсі: кнопка може бути
  // застарілою, запис міг змінитись, а помилку платить родина.
  if (spec.status === 'active') {
    const { data: row } = await supabase
      .from('opportunities')
      .select('age_from, age_to, deadline, event_start_date, event_end_date, results_date, recurrence, cost_type, opportunity_type, format, cities, countries, is_international')
      .eq('id', id)
      .maybeSingle();
    const missing = row ? missingRequired(row) : [];
    if (missing.length) {
      return Response.json(
        { ok: false, error: 'missing_required', missing },
        { status: 422 },
      );
    }
  }

  const text = typeof comment === 'string' ? comment.trim().slice(0, 2000) : '';
  if (action === 'comment' && !text) {
    return Response.json({ ok: false, error: 'empty_comment' }, { status: 400 });
  }

  // Коментар людини йде в moderation_notes, а не в admin_comment: там
  // позначки конвеєра, і людський текст або затирав їх, або тонув серед них
  // (22.09.2026). «Лише коментар» — питання без рішення, лишається
  // відкритим, доки його не оброблять; коментар до рішення — його причина.
  // Статус ДО рішення. 23.09.2026: «пропустити» й «прибрати» — теж сигнал
  // моделі («принесла не те»), а ми його не зберігали; після update статус уже
  // 'closed', і чим він був — чернеткою чи живим записом — не дізнатись.
  const isDecision = action === 'skip' || action === 'remove';
  let statusBefore = null;
  if (isDecision) {
    const { data: cur } = await supabase
      .from('opportunities').select('status').eq('id', id).maybeSingle();
    statusBefore = cur?.status ?? null;
  }

  const patch = { updated_at: new Date().toISOString() };
  if (spec.status) patch.status = spec.status;
  if (spec.verify) patch.verified_at = new Date().toISOString();

  const cols = 'title, source, source_url, opportunity_type';
  const { data, error } = action === 'comment'
    ? await supabase.from('opportunities').select(cols).eq('id', id).maybeSingle()
    : await supabase.from('opportunities').update(patch).eq('id', id).select(cols).maybeSingle();

  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  if (!data) return Response.json({ ok: false, error: 'not_found' }, { status: 404 });

  let note = null;
  if (text) {
    const { data: saved, error: noteError } = await supabase
      .from('moderation_notes')
      .insert({
        opportunity_id: id,
        body: text,
        action,
        resolved_at: action === 'comment' ? null : new Date().toISOString(),
      })
      .select('id, body, created_at')
      .single();
    // Рішення вже записане; коментар до нього — ні. Кажемо про це прямо,
    // щоб людина не думала, що її питання хтось побачить.
    if (noteError) return Response.json({ ok: false, error: 'note_not_saved' }, { status: 500 });
    note = saved;
  }

  // Телеметрія навчання: рішення людини поруч із виправленнями полів. Причину
  // кладемо в той самий рядок — без неї «прибрано» не пояснює нічого, а за
  // парою before→after рахується закономірність («на сайті → прибрати ×14»).
  // Мовчки: таблиці може ще не бути, а рішення вже записане.
  if (isDecision) {
    try {
      await supabase.from('moderation_corrections').insert({
        opportunity_id: id,
        field: DECISION_FIELD,
        before: statusBefore,
        after: text ? { action, comment: text } : { action },
        source: 'review',
      });
    } catch { /* телеметрія мовчить і нічого не ламає */ }
  }

  // Журнал: хто саме натиснув. Досі цього не було ніде — moderation_notes
  // зберігає лише коментарі, moderation_corrections лише «пропустити» й
  // «прибрати», і обидві без імені. З 24.09.2026 чергу розбирає не одна
  // людина, тож і статистика роботи, і відповідь на «хто це опублікував»
  // беруться звідси. Мовчки: рішення вже записане, і збій журналу не привід
  // його скасовувати.
  try {
    await supabase.from('moderation_actions').insert({
      opportunity_id: id,
      action,
      actor: adminName(cookie) || 'невідомий',
    });
  } catch { /* журнал мовчить і нічого не ламає */ }

  // Mirror to Notion (best-effort; no-op if not configured).
  await pushModeration({
    title: data.title,
    comment: text,
    decision: spec.decision,
    type: data.opportunity_type,
    url: data.source_url,
    source: data.source,
  });

  return Response.json({ ok: true, action, note });
}
