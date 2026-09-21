import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STUB_MARK, isStubDraft, withoutStubMark, slugFromTitle, contentHash,
  broughtBy, originOf, repliesByEmail, sourceFor, letterNote,
} from '../lib/suggestions.js';

// «Додати на сайт» у /admin/messages: чернетка з пропозиції.

test('чернетка з пропозиції впізнається за позначкою', () => {
  const comment = `💡 пропозиція з форми на сайті · ${STUB_MARK}`;
  assert.equal(isStubDraft({ status: 'draft', admin_comment: comment }), true);
  // Опублікований запис — уже не заглушка, хай би що лишилось у коментарі.
  assert.equal(isStubDraft({ status: 'active', admin_comment: comment }), false);
  assert.equal(isStubDraft({ status: 'draft', admin_comment: 'звичайна чернетка' }), false);
});

test('позначка знімається, решта коментаря лишається', () => {
  const comment = `💡 пропозиція · контакт: a@b.ua · ${STUB_MARK}`;
  assert.equal(withoutStubMark(comment), '💡 пропозиція · контакт: a@b.ua');
  assert.equal(withoutStubMark(STUB_MARK), null);
});

test('слаг — за тією самою таблицею, що в Python-нормалізаторі', () => {
  const slug = slugFromTitle('6 000 грн щомісяця дітям полонених захисників (Рівне)', 'https://x');
  assert.match(slug, /^6-000-hrn-shchomisiatsia-ditiam-polonenykh-zakhysnykiv-rivne-[0-9a-f]{6}$/);
  // «зг» — окреме правило, як у Python: «Згурівка» → «zghurivka».
  assert.match(slugFromTitle('Згурівка'), /^zghurivka-/);
  // Той самий запис — той самий слаг.
  assert.equal(slugFromTitle('Табір', 'u'), slugFromTitle('Табір', 'u'));
});

test('ключ дублів збігається з hubs.content_hash у Python', () => {
  // Звірено з Python 21.09.2026: hashlib.sha256(url)[:16] і для хабів
  // sha256(«нормалізована назва|url»)[:16].
  assert.equal(contentHash('x', 'https://rivnesoc.gov.ua/participants-of-ato-and-cab/'), '3b69cd119a18dc83');
  assert.equal(contentHash('Олімпіада з біології — 2026!', 'https://mon.gov.ua/x', true), 'e35bfe2954b4fbd3');
});

// Хто приніс пропозицію (колонка origin, 21.09.2026). AI Kids Academy принесла
// Марія, а адмінка показувала Facebook організації як людину з поп-апа.

test('поп-ап: у рядку — контакт людини й канал', () => {
  assert.equal(broughtBy({ origin: 'popup', contact: 'apply@seniv.studio' }),
    '👤 apply@seniv.studio · через поп-ап на сайті');
  assert.equal(broughtBy({ contact: null }),
    'без контактів — відповісти не вийде · через поп-ап на сайті');
});

test('внесене вручну — Марія чи дослідження, а contact — організатор', () => {
  assert.equal(broughtBy({ origin: 'maria', contact: null }), '👤 Марія, внесено вручну');
  assert.equal(broughtBy({ origin: 'research', contact: 'info@fund.org' }),
    '🔎 наше дослідження, внесено вручну · організатор: info@fund.org');
  // Невідоме значення не вигадує автора — це поп-ап, як дефолт у базі.
  assert.equal(originOf({ origin: 'щось' }), 'popup');
});

test('«лист відправнику пішов» — лише пошті людини з поп-апа', () => {
  assert.equal(repliesByEmail({ origin: 'popup', contact: 'apply@seniv.studio' }), true);
  assert.equal(repliesByEmail({ origin: 'popup', contact: 'https://t.me/kidsrightsplatform' }), false);
  assert.equal(repliesByEmail({ origin: 'research', contact: 'info@fund.org' }), false);
});

test('джерело на картці: для внесеного вручну — домен, не «пропозиція від людей»', () => {
  const url = 'https://www.rada-poltava.gov.ua/ua/news/x';
  assert.equal(sourceFor({ origin: 'research', url }, 'Пропозиція від людей'), 'rada-poltava.gov.ua');
  assert.equal(sourceFor({ origin: 'popup', url }, 'Пропозиція від людей'), 'Пропозиція від людей');
  assert.equal(sourceFor({ origin: 'maria', url: 'не адреса' }, 'Пропозиція від людей'), 'Пропозиція від людей');
});

test('адмінка пише «лист пішов» лише тоді, коли він справді пішов', () => {
  const popup = { origin: 'popup', contact: 'apply@seniv.studio' };
  // Дубль чернетки: посилання віддало б 404, лист чекає публікації.
  assert.equal(letterNote({ ...popup, status: 'duplicate' }), 'лист відправнику піде, щойно запис опублікуємо');
  assert.equal(letterNote({ ...popup, status: 'duplicate', published_letter_at: '2026-09-21' }), 'лист відправнику пішов');
  assert.equal(letterNote({ ...popup, status: 'imported' }), 'лист відправнику пішов, другий — після публікації');
  assert.equal(letterNote({ ...popup, status: 'imported', published_letter_at: '2026-09-21' }), 'опубліковано — відправнику пішли обидва листи');
  assert.equal(letterNote({ ...popup, status: 'added' }), 'лист відправнику піде після публікації');
  // Без пошти або внесене нами — листів немає й не буде.
  assert.equal(letterNote({ origin: 'research', contact: 'info@fund.org', status: 'imported' }), null);
  assert.equal(letterNote({ origin: 'popup', contact: 'https://t.me/x', status: 'duplicate' }), null);
  assert.equal(letterNote({ ...popup, status: 'dismissed' }), null);
});
