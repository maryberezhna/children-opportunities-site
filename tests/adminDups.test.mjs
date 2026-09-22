import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeDraftDups } from '../lib/adminDups.js';

test('чернетка без прапорця отримує найсхожіший активний запис', () => {
  const out = mergeDraftDups(
    [{ id: 'a', title: 'EPAS' }],
    [{ draft_id: 'a', match_slug: 'epas-1', sim: 1 }],
  );
  assert.equal(out[0].dup_of, 'epas-1');
  assert.equal(out[0].dup_score, 1);
});

test('з кількох збігів береться найсхожіший', () => {
  const out = mergeDraftDups(
    [{ id: 'a' }],
    [{ draft_id: 'a', match_slug: 'weak', sim: 0.4 }, { draft_id: 'a', match_slug: 'strong', sim: 0.9 }],
  );
  assert.equal(out[0].dup_of, 'strong');
});

test('прапорець discover_agent не перебивається', () => {
  const out = mergeDraftDups(
    [{ id: 'a', dup_of: 'agent-pick', dup_score: 0.7 }],
    [{ draft_id: 'a', match_slug: 'other', sim: 0.9 }],
  );
  assert.equal(out[0].dup_of, 'agent-pick');
  assert.equal(out[0].dup_score, 0.7);
});

test('без збігів і без відповіді функції чернетки не змінюються', () => {
  const drafts = [{ id: 'a' }, { id: 'b' }];
  assert.deepEqual(mergeDraftDups(drafts, null), drafts);
  assert.deepEqual(mergeDraftDups(drafts, [{ draft_id: 'zzz', match_slug: 'x', sim: 0.5 }]), drafts);
});
