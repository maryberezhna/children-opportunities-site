// Куди відповісти людині, що написала через форму (/contacts).
//
// З 07.10.2026 — лише email або нік у Telegram, без телефону (Марія). Привід:
// Наталія спитала, як подати заявку в «Дитячу студію Театру Франка», і лишила
// тільки номер. Відповісти з пошти проєкту чи з Telegram на номер нема як:
// дзвонити незнайомій людині ми не будемо, а повідомлення на номер не дійде.
//
// Нік приймаємо лише з @ або як посилання t.me/…: голе слово латиницею — це
// часто просто ім'я («Natalia»), і за ним нікого не знайти.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Правила Telegram: 5–32 символи, латиниця, цифри й _, першою — літера.
const TG_NICK = /^[A-Za-z][A-Za-z0-9_]{4,31}$/;
const TG_LINK = /^(?:https?:\/\/)?(?:www\.)?(?:t|telegram)\.me\/([^/?#\s]+)\/?$/i;

/**
 * Розбирає те, що людина вписала в поле «контакт».
 * @returns {{ kind: 'email' | 'telegram', value: string } | null}
 *   value — нормалізоване: пошта як є, нік завжди у вигляді «@nick».
 */
export function parseContact(raw) {
  const v = String(raw ?? '').trim();
  if (!v) return null;
  if (EMAIL.test(v)) return { kind: 'email', value: v };

  const link = v.match(TG_LINK);
  const nick = link ? link[1] : v.startsWith('@') ? v.slice(1) : null;
  if (nick && TG_NICK.test(nick)) return { kind: 'telegram', value: `@${nick}` };

  return null;
}

/** Посилання, за яким модератор відкриє чат або лист одним дотиком. */
export function contactHref(c) {
  if (!c) return null;
  return c.kind === 'email' ? `mailto:${c.value}` : `https://t.me/${c.value.slice(1)}`;
}
