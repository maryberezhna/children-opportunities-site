// Підпис посилання «Так, повідомляйте мене» з листа педагогу (Марія,
// 11.10.2026). Посилання веде на сторінку-підтвердження з кнопкою; згоду
// записує лише POST цієї кнопки — сканери посилань у пошті (Outlook Safe
// Links тощо) відкривають GET самі, і перехід за посиланням згодою не є. Сам код педагога напівпублічний — він у посиланні, яке педагог
// розсилає батькам, — тож його одного замало, щоб записати згоду на листи:
// потрібен ще підпис, який знає лише сервер.
//
// Підпис — HMAC-SHA256 від коду, перші 16 знаків base64url (96 біт). Ключ —
// сервісний ключ Supabase: він і так є на сервері, нової змінної у Vercel не
// треба. Зміниться ключ — старі посилання з листів перестануть діяти (на
// сторінці педагога кнопка з новим підписом лишиться).
import crypto from 'node:crypto';

const PURPOSE = 'olimp-teacher-notify:';
const SIG_LEN = 16;

// Локально сервісного ключа немає — сталий ключ лише для `next dev`. У
// продакшні без ключа підпису немає взагалі, і кнопку не показуємо.
export function notifyKey(env = process.env) {
  if (env.SUPABASE_SERVICE_ROLE_KEY) return env.SUPABASE_SERVICE_ROLE_KEY;
  return env.NODE_ENV === 'production' ? null : 'dev-only-olimp-notify';
}

export function notifySig(code, key = notifyKey()) {
  if (!key || !code) return null;
  return crypto.createHmac('sha256', key).update(PURPOSE + String(code)).digest('base64url').slice(0, SIG_LEN);
}

export function checkNotifySig(code, sig, key = notifyKey()) {
  const want = notifySig(code, key);
  const got = String(sig || '');
  if (!want || got.length !== want.length) return false;
  return crypto.timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

// Сторінка педагога з підтвердженням «Так, повідомляйте мене» — сюди веде
// посилання з листа; null — підписати нічим.
export function notifyPath(code, key = notifyKey()) {
  const sig = notifySig(code, key);
  return sig ? `/olimpiada/pedagog?c=${code}&notify=1&s=${sig}` : null;
}

// Куди кнопка підтвердження надсилає POST (поля c і s).
export const NOTIFY_ACTION = '/api/olimpiada/teacher/notify';
