// Реєстрація педагога (Марія, 11.10.2026): імʼя та email → особисте посилання
// для учнів /olimpiada?vid=<код> і 1 лист із ним. Той самий email удруге —
// той самий код і без нового листа: форму можна заповнити ще раз, якщо лист
// загубився, а чужу скриньку так не засипати.
// Окремого ліміту за IP немає, як і в інших формах олімпіади: від ботів —
// приманка website, від повторів — один рядок і один лист на email.
import { isEmail, teacherName } from '@/lib/olimpiada';
import { getStore, registerTeacher, json } from '@/lib/olimpiada-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  let b;
  try { b = await request.json(); } catch { return json({ error: 'bad_request' }, 400); }
  // Приманка для ботів: людина цього поля не бачить.
  if (b.website) return json({ ok: true });

  const name = teacherName(b.name);
  const email = String(b.email || '').trim().toLowerCase();
  if (!name) return json({ error: 'name' }, 400);
  if (!isEmail(email) || email.length > 200) return json({ error: 'email' }, 400);
  if (b.consent !== true) return json({ error: 'consent' }, 400);

  const store = getStore();
  if (!store) return json({ error: 'unavailable' }, 503);

  try {
    const { teacher, created, mailed = false } = await registerTeacher(store, {
      name, email, source: String(b.source || '').slice(0, 60) || null,
    });
    return json({ ok: true, code: teacher.code, already: !created, mailed });
  } catch (e) {
    console.error('[olimpiada/teacher]', e);
    return json({ error: 'unavailable' }, 503);
  }
}
