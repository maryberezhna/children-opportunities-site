import { cookies } from 'next/headers';
import { adminAccounts, adminConfigured, isAdmin } from '@/lib/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Вхід за спільним секретом. Кука зберігає сам токен (httpOnly), і всі
// сторінки та ручки адмінки звіряють її через isAdmin().
//
// Акаунтів два: ADMIN_TOKEN і ADMIN_TOKEN_2 (див. lib/adminAuth.js). Пароль
// у кожного свій, тож відкликати доступ одному можна, не міняючи інший.
// NOTE: надійність тримається на тому, що токени довгі й випадкові —
// обмеження спроб на цій ручці немає.
export async function POST(request) {
  if (!adminConfigured()) {
    return Response.json({ ok: false, error: 'not_configured' }, { status: 500 });
  }
  const { password } = await request.json().catch(() => ({}));
  if (!isAdmin(password)) {
    return Response.json({ ok: false }, { status: 401 });
  }
  const matched = adminAccounts().find((a) => a.token === password);
  cookies().set('dityam_admin', matched.token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return Response.json({ ok: true });
}
