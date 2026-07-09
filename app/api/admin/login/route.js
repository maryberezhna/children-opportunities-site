import { cookies } from 'next/headers';
import { safeEqual } from '@/lib/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Simple shared-secret login for the solo admin. The cookie stores the token
// itself (httpOnly), which /admin and /api/admin/review compare to ADMIN_TOKEN.
// NOTE: security depends on ADMIN_TOKEN being a long, random value (there is no
// per-IP rate limiting on this endpoint).
export async function POST(request) {
  const token = process.env.ADMIN_TOKEN;
  if (!token) {
    return Response.json({ ok: false, error: 'not_configured' }, { status: 500 });
  }
  const { password } = await request.json().catch(() => ({}));
  if (!password || !safeEqual(password, token)) {
    return Response.json({ ok: false }, { status: 401 });
  }
  cookies().set('dityam_admin', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return Response.json({ ok: true });
}
