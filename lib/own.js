// Власні записи Марії — не люди в метриках (Марія, 08.10.2026: «видаляй усюди,
// де бачиш @maryberezhna, з метрик»). Рядки в базі лишаються: це її справжня
// підписка й тестові заявки, — ми їх лише не рахуємо й не показуємо в
// статистиці. Адреси — memory dityam-maria-own-emails.
export const OWN_CHAT_IDS = new Set(['388954322']);
export const OWN_HANDLES = new Set(['maryberezhna']);
export const OWN_EMAILS = new Set(['mashaberezhna0209@gmail.com', 'maryberezhna@gmail.com']);

const handleOf = (h) => String(h || '').replace(/^@+/, '').toLowerCase();
const emailOf = (e) => String(e || '').trim().toLowerCase();

/** Рядок будь-якої з таблиць (підписники, списки очікування, заявки, оплати) належить Марії. */
export function isOwn(row) {
  if (!row) return false;
  if (row.telegram_chat_id != null && OWN_CHAT_IDS.has(String(row.telegram_chat_id))) return true;
  if (OWN_HANDLES.has(handleOf(row.telegram_handle)) || OWN_HANDLES.has(handleOf(row.telegram_username))) return true;
  return OWN_EMAILS.has(emailOf(row.email)) || OWN_EMAILS.has(emailOf(row.parent_email));
}

export const notOwn = (rows) => (rows || []).filter((r) => !isOwn(r));
