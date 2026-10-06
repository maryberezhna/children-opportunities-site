// Статистика онлайн-олімпіади для /admin/metrics (Марія, 06.10.2026:
// «виводь статистику в адмінку на метрики»). Чиста функція — її легко
// перевірити тестом. Тестові записи адміна (wfp_last_status = 'Test', без
// оплати) не рахуємо: інакше перевірки перед стартом виглядали б продажами.
import { LEVELS, OLIMP } from './olimpiada.js';

const DAY = 24 * 60 * 60 * 1000;

export function olimpStats({ waitlist = [], entries = [], now = new Date() } = {}) {
  const t = now.getTime();
  const since = (days) => (row) => row.created_at && t - new Date(row.created_at).getTime() <= days * DAY;
  const isTest = (e) => e.wfp_last_status === 'Test';
  const real = entries.filter((e) => !isTest(e));
  const paid = real.filter((e) => e.paid_at);
  const finished = paid.filter((e) => e.finished_at);
  const prints = paid.filter((e) => e.print_paid_at);

  const bySource = new Map();
  for (const w of waitlist) bySource.set(w.source || 'прямо', (bySource.get(w.source || 'прямо') || 0) + 1);
  const byLevel = new Map();
  for (const e of finished) byLevel.set(e.level, (byLevel.get(e.level) || 0) + 1);
  const scores = finished.map((e) => Number(e.score)).filter((n) => Number.isFinite(n));

  return {
    waitlist: waitlist.length,
    waitlist7: waitlist.filter(since(7)).length,
    waitlist1: waitlist.filter(since(1)).length,
    sources: [...bySource.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6),
    paid: paid.length,
    unpaid: real.filter((e) => !e.paid_at).length,
    started: paid.filter((e) => e.started_at).length,
    finished: finished.length,
    open: finished.filter((e) => e.open_answer_at).length,
    prints: prints.length,
    revenue: paid.reduce((s, e) => s + (Number(e.amount) || 0), 0) + prints.length * OLIMP.printPrice,
    avgScore: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null,
    levels: LEVELS.map((l) => [l.label, byLevel.get(l.key) || 0]).filter(([, n]) => n > 0),
    tests: entries.length - real.length,
  };
}
