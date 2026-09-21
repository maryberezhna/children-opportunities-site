import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STUB_MARK, isStubDraft, withoutStubMark, slugFromTitle, contentHash,
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
