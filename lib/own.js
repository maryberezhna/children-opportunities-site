// Власні записи Марії — не люди в метриках (Марія, 08.10.2026: «видаляй усюди,
// де бачиш @maryberezhna, з метрик»). Рядки в базі лишаються: це її справжня
// підписка й тестові заявки, — ми їх лише не рахуємо й не показуємо в
// статистиці.
//
// Пошти й chat_id — у змінних оточення OWN_EMAILS / OWN_CHAT_IDS (через кому),
// а не в коді: з 22.10.2026 репозиторій публічний, і особиста пошта Марії не
// має лежати на виду (Марія: «чи максимально закриті мої дані»). Нік лишився в
// коді — він і так публічний, на /about. Без змінних isOwn просто нікого не
// впізнає за поштою: метрики порахують Марію, але нічого не зламається.
const listFromEnv = (name) => new Set(String(process.env[name] || '')
  .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean));
export const OWN_CHAT_IDS = listFromEnv('OWN_CHAT_IDS');
export const OWN_HANDLES = new Set(['maryberezhna']);
export const OWN_EMAILS = listFromEnv('OWN_EMAILS');

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
