// 21.10.2026: вибачення за «оплату» йде лише тим, кого зачепив cron nudge-stuck
// після 13:18 UTC або кому підписку ввімкнено безкоштовно; Марію не чіпаємо.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('plus_sorry: воркфлоу з confirm=SEND і превʼю, тексти без ціни й без «живе без реклами»', () => {
  const wf = read('.github/workflows/plus-sorry.yml');
  assert.match(wf, /plus_sorry\.py --send/);
  assert.match(wf, /--preview/);
  const py = read('scraper/plus_sorry.py');
  assert.match(py, /OWN_CHAT_IDS = \{"388954322"\}/);
  assert.doesNotMatch(py, /грн|без реклами/);
  assert.match(py, /Марія, Dityam\.com\.ua/);
  // хто прийшов після деплою виправлення, оплати не бачив — йому не пишемо
  assert.match(py, /FIXED_AT = "2026-10-21T15:26/);
});
