import test from 'node:test';
import assert from 'node:assert/strict';
import { saveCustomCity } from '../lib/digestFlow.js';

// Крок «Де» в анкеті Dityam+: місто, якого немає серед кнопок, людина пише
// текстом. Перевіряємо головне — що бот не обіцяє можливостей там, де їх
// немає, і що місто справді лягає в профіль.

const OPPS = [
  { cities: ['Ніжин'] },
  { cities: ['Ніжин', 'Вся Україна'] },
  { cities: ['Київ'] },
];

// Мінімальний Supabase: ланцюжок select().eq().is().order().range() для міст
// і update().eq() для профілю.
function fakeSupabase(saved) {
  return {
    from(table) {
      if (table === 'opportunities') {
        const q = {
          select: () => q, eq: () => q, is: () => q, order: () => q,
          range: (from) => Promise.resolve({ data: from === 0 ? OPPS : [], error: null }),
        };
        return q;
      }
      return {
        update: (patch) => ({ eq: (_, id) => { saved.push({ id, patch }); return Promise.resolve({}); } }),
      };
    },
  };
}

function fakeBot(sent) {
  return { sendMessage: (chatId, text) => { sent.push(text); return Promise.resolve(); } };
}

const sub = { id: 7, places: ['__other', 'online'] };

test('місто з бази: кажемо, скільки там записів, і додаємо в профіль', async () => {
  const sent = []; const saved = [];
  await saveCustomCity(fakeBot(sent), fakeSupabase(saved), '42', sub, 'ніжин');
  assert.deepEqual(saved[0].patch.places, ['__other', 'online', 'Ніжин']);
  assert.match(sent[0], /Ніжин/);
  assert.match(sent[0], /2 можливості/);
});

test('міста без записів: чесно кажемо, що поки нічого немає', async () => {
  const sent = []; const saved = [];
  await saveCustomCity(fakeBot(sent), fakeSupabase(saved), '42', sub, 'Самбір');
  assert.deepEqual(saved[0].patch.places, ['__other', 'online', 'Самбір']);
  assert.match(sent[0], /можливостей немає/);
  assert.match(sent[0], /по всій Україні/);
});

test('не місто: нічого не зберігаємо', async () => {
  const sent = []; const saved = [];
  await saveCustomCity(fakeBot(sent), fakeSupabase(saved), '42', sub, 'дякую!!! 12345');
  assert.equal(saved.length, 0);
  assert.match(sent[0], /Напишіть лише назву міста/);
});
