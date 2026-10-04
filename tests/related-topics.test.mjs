// «Інші підбірки» — завжди 4 картки (Марія, 04.10.2026: «треба 4»).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pickRelated, TOPICS } from '../lib/topics.js';

const o = (slug, count) => ({ topic: { slug }, count });

test('3 задані related добираються до 4 найбільшою з інших', () => {
  const others = [o('a', 5), o('b', 50), o('c', 7), o('d', 30), o('e', 0)];
  const got = pickRelated(['a', 'c', 'e'], others).map((r) => r.topic.slug);
  assert.deepEqual(got, ['a', 'c', 'e', 'b']);
});

test('без related — 4 найбільші, порожні не добираються', () => {
  const others = [o('a', 1), o('b', 0), o('c', 9), o('d', 4), o('e', 2)];
  assert.deepEqual(pickRelated(undefined, others).map((r) => r.topic.slug), ['c', 'd', 'e', 'a']);
  assert.equal(pickRelated([], [o('x', 0), o('y', 3)]).length, 1);
});

test('кожна підбірка з related має щонайменше 4 кандидати', () => {
  const all = Object.values(TOPICS);
  for (const t of all.filter((x) => x.related)) {
    const others = all.filter((x) => x.slug !== t.slug).map((x) => o(x.slug, 1));
    assert.equal(pickRelated(t.related, others).length, 4, t.slug);
  }
});

test('сторінки підбірки й Erasmus беруть pickRelated', () => {
  for (const f of ['app/TopicPage.js', 'app/erasmus/page.js']) {
    assert.ok(readFileSync(new URL(`../${f}`, import.meta.url), 'utf8').includes('pickRelated('), f);
  }
});
