/**
 * Амбасадори в адмінці (23.10.2026, Марія: «додай у таблицю амбасадорів в
 * адмінці» і «а ти перевірив, чи вона зареєстрована? і чи є вона у Dityam+»).
 *
 * Заявка — рядок contact_messages з type 'ambassador' (app/ambasadory/
 * AmbassadorForm.js пише роль, місто й «про себе» рядками в message). Тут її
 * розбираємо й зводимо з тим, що людина вже робить у нас: педагог олімпіади
 * (olimpiada_teachers за поштою, учні — olimpiada_entries за кодом класу) і
 * Dityam+ (digest_subscribers за поштою або ніком у Telegram).
 *
 * Лише читання: звернення не змінюємо (правило «Звернення не чіпати»).
 */

const lower = (s) => String(s || '').trim().toLowerCase();
const nick = (s) => lower(s).replace(/^@+/, '');

/** «Роль: Педагог\nМісто чи країна: Іллінці\nПро себе: …» → поля. */
export function parseAmbassador(message) {
  const text = String(message || '');
  const field = (label) => {
    const m = new RegExp(`^${label}:\\s*(.*)$`, 'm').exec(text);
    return m ? m[1].trim() : '';
  };
  return { role: field('Роль'), city: field('Місто чи країна'), about: field('Про себе') };
}

/**
 * @returns рядки від найновішої заявки: { id, at, name, contact, email, handle,
 *   role, city, about, consent, status, teacher: { code, name, pupils, finished,
 *   thanksSent } | null, plus: status | null }
 */
export function buildAmbassadors({ messages = [], teachers = [], entries = [], subs = [] } = {}) {
  return messages
    .filter((m) => m.type === 'ambassador')
    .map((m) => {
      const contact = String(m.contact || '').trim();
      const email = contact.includes('@') && !contact.startsWith('@') ? lower(contact) : null;
      const handle = contact.startsWith('@') ? nick(contact) : null;
      const t = email ? teachers.find((x) => lower(x.email) === email) : null;
      const pupils = t ? entries.filter((e) => e.teacher_code === t.code && e.wfp_last_status !== 'Test') : [];
      const sub = subs.find((s) => (email && lower(s.email) === email) || (handle && nick(s.telegram_handle) === handle));
      return {
        id: m.id,
        at: m.created_at,
        name: m.name || null,
        contact,
        email,
        handle,
        ...parseAmbassador(m.message),
        consent: Boolean(m.publish_consent),
        status: m.status || 'new',
        teacher: t ? {
          code: t.code,
          name: t.name || null,
          pupils: pupils.length,
          finished: pupils.filter((e) => e.finished_at).length,
          thanksSent: Boolean(t.thanks_sent_at),
        } : null,
        plus: sub ? sub.status : null,
      };
    })
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}
