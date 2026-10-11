// «Так, повідомляйте мене» (Марія, 11.10.2026): згода педагога на листи про
// інші олімпіади й конкурси для учнів.
//
// Згоду записує лише POST — кнопка на сторінці педагога (форма з полями c і
// s). Посилання з листа веде на сторінку з цією кнопкою, а не сюди: сканери
// посилань у корпоративній пошті відкривають GET самі, і без кнопки вони б
// «погоджувались» за педагога. GET сюди (старе посилання, ручний перехід)
// лише веде на ту саму сторінку-підтвердження.
//
// Підпис (lib/olimpiada-sign.js) обовʼязковий: код педагога напівпублічний —
// він у посиланні для батьків, — і сам по собі згоди не дає. notify_ok_at
// ставимо лише раз; повторне натискання першої дати не міняє.
// Самих розсилок ще немає — лише записана згода.
import { validTeacherCode, teacherPagePath } from '@/lib/olimpiada';
import { getStore } from '@/lib/olimpiada-server';
import { checkNotifySig } from '@/lib/olimpiada-sign';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const go = (request, path) => new Response(null, {
  status: 303,
  headers: { Location: new URL(path, request.url).toString(), 'Cache-Control': 'no-store' },
});

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('c');
  if (!validTeacherCode(code)) return go(request, '/olimpiada#pedagogam');
  const s = searchParams.get('s');
  // Нічого не записуємо — лише показуємо кнопку підтвердження.
  return go(request, s && checkNotifySig(code, s)
    ? `${teacherPagePath(code)}&notify=1&s=${encodeURIComponent(s)}` : teacherPagePath(code));
}

export async function POST(request) {
  let form;
  try { form = await request.formData(); } catch { return go(request, '/olimpiada#pedagogam'); }
  const code = String(form.get('c') || '');
  const s = String(form.get('s') || '');
  if (!validTeacherCode(code)) return go(request, '/olimpiada#pedagogam');
  // Зіпсований підпис — на сторінку педагога без позначки.
  if (!checkNotifySig(code, s)) return go(request, teacherPagePath(code));
  const store = getStore();
  if (!store?.setTeacherNotify) return go(request, teacherPagePath(code));
  try {
    const teacher = await store.setTeacherNotify(code);
    if (!teacher) return go(request, '/olimpiada#pedagogam');
  } catch (e) {
    console.error('[olimpiada/teacher/notify]', e?.message || e);
    return go(request, `${teacherPagePath(code)}&notify=error`);
  }
  return go(request, `${teacherPagePath(code)}&ok=1`);
}
