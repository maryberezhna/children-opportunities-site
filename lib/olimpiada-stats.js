// Статистика онлайн-олімпіади для /admin/metrics (Марія, 06.10.2026:
// «виводь статистику в адмінку на метрики»). Чиста функція — її легко
// перевірити тестом. Тестові записи адміна (wfp_last_status = 'Test', без
// оплати) не рахуємо: інакше перевірки перед стартом виглядали б продажами.
import { LEVELS, OLIMP, isBundle } from './olimpiada.js';

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
    // Заявка «з дипломом» (OLIMP.bundlePrice) уже містить доставку в amount —
    // окремо додаємо лише дипломи, замовлені після тесту.
    revenue: paid.reduce((s, e) => s + (Number(e.amount) || 0), 0)
      + prints.filter((e) => !isBundle(e)).length * OLIMP.printPrice,
    bundles: paid.filter(isBundle).length,
    avgScore: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null,
    levels: LEVELS.map((l) => [l.label, byLevel.get(l.key) || 0]).filter(([, n]) => n > 0),
    tests: entries.length - real.length,
  };
}

const pct = (part, total) => (total ? Math.round((part / total) * 100) : null);

const tally = (rows) => {
  const m = new Map();
  for (const r of rows) m.set(r.source || '—', (m.get(r.source || '—') || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};

/**
 * Трафік сторінки олімпіади й попапу (Марія, 06.10.2026: «чітко трекай
 * статистику на цій сторінці»). events — рядки site_events з назвами olimp_*
 * (lib/site-events.js), waitlist — olimpiada_waitlist. Email із попапу мають
 * source 'popup-…', решта — зі сторінки (utm, 'page' чи порожньо).
 */
export function olimpTraffic({ events = [], waitlist = [], now = new Date() } = {}) {
  const t = now.getTime();
  const within = (days) => (r) => r.created_at && t - new Date(r.created_at).getTime() <= days * DAY;
  const of = (name) => events.filter((e) => e.name === name);
  const views = of('olimp_view');
  const shows = of('olimp_popup_show');
  const fromPopup = waitlist.filter((w) => String(w.source || '').startsWith('popup'));
  const fromPage = waitlist.filter((w) => !String(w.source || '').startsWith('popup'));
  return {
    views: views.length,
    views7: views.filter(within(7)).length,
    views1: views.filter(within(1)).length,
    viewSources: tally(views).slice(0, 8),
    cta: of('olimp_cta').length,
    ctaSpots: tally(of('olimp_cta')),
    top: of('olimp_top_click').length,
    popupShow: shows.length,
    popupMore: of('olimp_popup_more').length,
    popupClose: of('olimp_popup_close').length,
    popupEmails: fromPopup.length,
    pageEmails: fromPage.length,
    pageRate: pct(fromPage.length, views.length),
    popupRate: pct(fromPopup.length, shows.length),
  };
}
