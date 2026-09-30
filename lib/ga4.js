/**
 * GA4 Data API з сервера — для блоку «Медіакіт» в адмінці (30.09.2026).
 *
 * Марія: «перевір, чи збираємо ми такі показники; збирай в адмінці, якщо ні».
 * Показники в GA4 є, але сервер сам туди не ходив — цифри дивились очима в
 * інтерфейсі. Тут — мінімальний клієнт без бібліотек: сервісний акаунт
 * підписує JWT (RS256, вбудований crypto), обмінює його на токен і кличе
 * runReport через REST.
 *
 * Налаштування (Vercel → Environment Variables):
 *   GA4_PROPERTY_ID          — 533756602 (властивість «Opportunities for children»);
 *   GA4_SERVICE_ACCOUNT_JSON — увесь JSON ключа сервісного акаунта одним рядком.
 * Сервісному акаунту потрібна роль «Переглядач» у самій властивості GA4
 * (Адміністратор → Керування доступом до властивості → додати e-mail акаунта).
 * Без цих змінних mediaKit() повертає configured: false, а адмінка показує
 * інструкцію замість цифр.
 */
import { createSign } from 'node:crypto';

const SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

export function ga4Configured() {
  return Boolean(process.env.GA4_PROPERTY_ID && process.env.GA4_SERVICE_ACCOUNT_JSON);
}

const b64url = (input) => Buffer.from(input).toString('base64url');

let cached = { token: null, exp: 0 };

async function accessToken() {
  if (cached.token && Date.now() < cached.exp - 60_000) return cached.token;
  const sa = JSON.parse(process.env.GA4_SERVICE_ACCOUNT_JSON);
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({
    iss: sa.client_email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600,
  }));
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  const signature = signer.sign(sa.private_key, 'base64url');
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claims}.${signature}`,
    }),
  });
  if (!res.ok) throw new Error(`GA4 token: ${res.status} ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  cached = { token: data.access_token, exp: Date.now() + (data.expires_in || 3600) * 1000 };
  return cached.token;
}

/**
 * Один звіт. Поля — як у REST-документації Data API (camelCase):
 * dateRanges, dimensions, metrics, dimensionFilter, orderBys, limit.
 * Повертає масив рядків { <dimension>: string, <metric>: number }.
 */
export async function runReport(body) {
  const token = await accessToken();
  const id = String(process.env.GA4_PROPERTY_ID).replace(/^properties\//, '');
  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${id}:runReport`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
    // Кеш Next для fetch тут ні до чого: сторінка force-dynamic.
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`GA4 runReport: ${res.status} ${(await res.text()).slice(0, 300)}`);
  return flattenReport(await res.json());
}

/** Відповідь Data API → плоскі рядки. Винесено окремо заради тестів. */
export function flattenReport(report) {
  const dims = (report.dimensionHeaders || []).map((h) => h.name);
  const mets = (report.metricHeaders || []).map((h) => h.name);
  return (report.rows || []).map((row) => {
    const out = {};
    dims.forEach((d, i) => { out[d] = row.dimensionValues?.[i]?.value ?? ''; });
    mets.forEach((m, i) => { out[m] = Number(row.metricValues?.[i]?.value ?? 0); });
    return out;
  });
}
