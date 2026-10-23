// Амбасадори в адмінці (23.10.2026): заявка + чи вже педагог олімпіади й чи в Dityam+.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const { parseAmbassador, buildAmbassadors } = await import('../lib/ambassadors.js');
const { buildPeople } = await import('../lib/people.js');

const MSG = { id: 7, type: 'ambassador', name: 'Тетяна Пупкова', contact: 'Tatianka.Pypkova@gmail.com', message: 'Роль: Педагог\nМісто чи країна: Іллінці\nПро себе: Чат класу, колеги', publish_consent: false, status: 'new', created_at: '2026-10-22T17:41:15Z' };
const TEACHER = { name: 'Тетяна Анатоліївна Пупкова', email: 'tatianka.pypkova@gmail.com', code: 'stjdjw3z', created_at: '2026-10-22T17:36:09Z', thanks_sent_at: null };

test('заявка розбирається на роль, місто й «про себе»', () => {
  assert.deepEqual(parseAmbassador(MSG.message), { role: 'Педагог', city: 'Іллінці', about: 'Чат класу, колеги' });
  assert.deepEqual(parseAmbassador(''), { role: '', city: '', about: '' });
});

test('амбасадор зводиться з педагогом олімпіади, учнями й Dityam+', () => {
  const entries = [
    { teacher_code: 'stjdjw3z', finished_at: '2026-10-22T18:00:00Z' },
    { teacher_code: 'stjdjw3z', finished_at: null },
    { teacher_code: 'stjdjw3z', finished_at: '2026-10-22T18:00:00Z', wfp_last_status: 'Test' },
    { teacher_code: 'other', finished_at: '2026-10-22T18:00:00Z' },
  ];
  const [a] = buildAmbassadors({ messages: [MSG, { type: 'other' }], teachers: [TEACHER], entries, subs: [] });
  assert.equal(a.email, 'tatianka.pypkova@gmail.com');
  assert.deepEqual(a.teacher, { code: 'stjdjw3z', name: TEACHER.name, pupils: 2, finished: 1, thanksSent: false });
  assert.equal(a.plus, null);
  assert.equal(a.consent, false);
  const [b] = buildAmbassadors({ messages: [{ ...MSG, contact: '@olena_k' }], teachers: [TEACHER], subs: [{ telegram_handle: 'Olena_K', status: 'active' }] });
  assert.equal(b.teacher, null);
  assert.equal(b.plus, 'active');
});

test('у «Користувачах» амбасадор — та сама людина, що й педагог, з фільтром', () => {
  const [a] = buildAmbassadors({ messages: [MSG], teachers: [TEACHER] });
  const rows = buildPeople({ teachers: [TEACHER], ambassadors: [a] });
  assert.equal(rows.length, 1);
  assert.ok(rows[0].notes.includes('📣 Амбасадор · Педагог · Іллінці'));
  const page = fs.readFileSync(new URL('../app/admin/korystuvachi/page.js', import.meta.url), 'utf8');
  assert.match(page, /\['amb', 'Амбасадори'\]/);
  assert.match(page, /id="ambasadory"/);
  assert.match(page, /eq\('type', 'ambassador'\)/);
  // Лише читання: «Звернення не чіпати».
  assert.doesNotMatch(page, /contact_messages'\)\.(update|delete|upsert)/);
  assert.match(fs.readFileSync(new URL('../app/admin/messages/MessageList.js', import.meta.url), 'utf8'), /korystuvachi\?f=amb#ambasadory/);
});
