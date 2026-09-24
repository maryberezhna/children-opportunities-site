import crypto from 'crypto';

// Constant-time comparison of two secrets. Hash both first so length differences
// don't leak and timingSafeEqual always gets equal-length buffers.
export function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a ?? '')).digest();
  const hb = crypto.createHash('sha256').update(String(b ?? '')).digest();
  return crypto.timingSafeEqual(ha, hb);
}

// Адмінку відкриває не лише Марія: з 24.09.2026 людина, яка розбирає чергу
// модерації, має власний токен. Кожен вхід — окремий секрет, тож відкликати
// доступ одній людині можна, не міняючи пароль решті.
//
// ADMIN_TOKEN       — основний (Марія), лишається як був;
// ADMIN_TOKEN_2     — другий адміністратор;
// ADMIN_TOKEN_2_NAME — підпис у журналі, якщо колись знадобиться.
export function adminAccounts() {
  return [
    { name: process.env.ADMIN_TOKEN_NAME || 'основний', token: process.env.ADMIN_TOKEN },
    { name: process.env.ADMIN_TOKEN_2_NAME || 'другий', token: process.env.ADMIN_TOKEN_2 },
  ].filter((a) => typeof a.token === 'string' && a.token.length > 0);
}

// Чи адмінка взагалі налаштована — хоч один токен заданий.
export function adminConfigured() {
  return adminAccounts().length > 0;
}

// Кука зберігає сам токен; порівнюємо з кожним налаштованим. Перебираємо всі
// до кінця, щоб час відповіді не підказував, який саме збігся.
export function isAdmin(value) {
  if (typeof value !== 'string' || !value) return false;
  return adminAccounts().reduce((ok, a) => (safeEqual(value, a.token) ? true : ok), false);
}

// Хто саме увійшов — для підпису дій у журналі модерації.
export function adminName(value) {
  if (typeof value !== 'string' || !value) return null;
  const hit = adminAccounts().find((a) => safeEqual(value, a.token));
  return hit ? hit.name : null;
}
