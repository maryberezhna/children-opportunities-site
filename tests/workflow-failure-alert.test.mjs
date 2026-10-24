// Червоний запуск будь-якого воркфлоу — в адмін-чат (24.10.2026, аудит процесів:
// нічний збір падав чотири ночі, а помітили лише під час звірки). GitHub
// вимагає перелік назв у workflows:, тож новий воркфлоу легко забути додати —
// цей тест не дає йому випасти.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const DIR = new URL('../.github/workflows/', import.meta.url);
const ALERT = 'workflow-failure-alert.yml';
// Не стежимо: за собою, за перевірками PR і за deploy-alert (у нього свій алерт).
const SKIP = new Set([ALERT, 'tests.yml', 'deploy-alert.yml']);

const nameOf = (text) => {
  const m = text.match(/^name:\s*(.+?)\s*$/m);
  return m ? m[1].replace(/^["']|["']$/g, '') : null;
};
const alertText = readFileSync(new URL(ALERT, DIR), 'utf8');
const listed = new Set([...alertText.matchAll(/^ {6}- "(.+)"$/gm)].map((m) => JSON.parse(`"${m[1]}"`)));

test('алерт стежить за кожним воркфлоу, крім винятків', () => {
  const missing = readdirSync(DIR).filter((f) => f.endsWith('.yml') && !SKIP.has(f))
    .map((f) => [f, nameOf(readFileSync(new URL(f, DIR), 'utf8'))])
    .filter(([, n]) => !listed.has(n));
  assert.deepEqual(missing, [], 'додай назву цих воркфлоу в workflows: у ' + ALERT);
});

test('лише справжні падіння, не PR, і не частіше разу на добу', () => {
  assert.match(alertText, /conclusion == 'failure'/);
  assert.match(alertText, /event != 'pull_request'/);
  assert.match(alertText, /lookup-only: true/);
  assert.match(alertText, /date -u \+%Y-%m-%d/);
});
