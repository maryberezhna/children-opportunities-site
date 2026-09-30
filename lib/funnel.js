/**
 * Воронка Dityam+: скільки людей лишається на кожному кроці від «відкрив
 * бота» до «оплатив».
 *
 * Навіщо. 29.09.2026 було видно, що продажів майже немає, але не було видно
 * ЧОМУ: чи люди не доходять до бота, чи кидають анкету, чи лякаються ціни.
 * Поради без цього — здогади. Числа на кожному переході показують місце
 * втрати, і тоді зрозуміло, що чинити.
 *
 * Верхні кроки — із site_events: сесія на сайті, відкрита сторінка Dityam+,
 * натиснуте посилання в бота. Спершу воронка починалась аж із бота, і на
 * головне питання — де з двох тисяч відвідувачів лишаються одиниці — не
 * відповідала. Поки подій сайту немає, вона так і починається з бота.
 */

// Кроки бота, що йдуть уже після питань анкети.
const POST_STEPS = new Set(['phone']);

/** Крок воронки: скільки лишилось і скільки втратили проти попереднього. */
function step(key, label, n, prev, first, hint) {
  const drop = prev == null ? null : Math.max(prev - n, 0);
  return {
    key, label, n, hint,
    // Частка від першого кроку — щоб бачити наскрізну конверсію, а не лише
    // сусідній перехід.
    share: first ? Math.round((n / first) * 100) : 0,
    drop,
    dropShare: prev ? Math.round(((prev - n) / prev) * 100) : null,
  };
}

/**
 * `subs` — рядки digest_subscribers, `childIds` — Set id підписників, у яких
 * є хоч одна дитина в plus_children.
 */
export function plusFunnel({ subs = [], childIds = new Set(), site = {} } = {}) {
  const has = (s) => childIds.has(s.id);
  const total = subs.length;
  const consented = subs.filter((s) => s.consent_at).length;
  // «Почав анкету» — є дитина або бот чекає відповіді на якомусь кроці.
  const started = subs.filter((s) => has(s) || s.flow_step).length;
  // «Заповнив» — дитина є, а крок уже не чекає відповіді на питання анкети.
  // «phone» — крок ПІСЛЯ анкети (старий запит номера перед оплатою, знятий
  // 28.09.2026, але в базі ще є люди, що стоять на ньому): анкету вони
  // заповнили. 30.09.2026 Марія побачила розрив «почали 6 → заповнили 4» при
  // заповнених анкетах — саме ці двоє й випадали.
  const filled = subs.filter((s) => has(s) && (!s.flow_step || POST_STEPS.has(s.flow_step))).length;
  // Рахунок у WayForPay створено: людина натиснула «оформити».
  const toPay = subs.filter((s) => s.wfp_order_reference).length;
  const paid = subs.filter((s) => s.status === 'active').length;

  // Верхні кроки — з site_events (lib/site-events.js). Якщо їх ще немає,
  // воронка починається з бота, як і до 29.09.2026.
  const visits = Number(site.visit || 0);
  const plusViews = Number(site.plus_view || 0);
  const plusClicks = Number(site.plus_click || 0);
  const first = visits || total;

  const out = [];
  if (visits) {
    out.push(step('visit', 'Зайшли на сайт', visits, null, first, 'сесій, без Марії й модераторів'));
    out.push(step('plus_view', 'Відкрили сторінку Dityam+', plusViews, visits, first, '/plus'));
    out.push(step('plus_click', 'Натиснули «в бота»', plusClicks, plusViews, first, 'посилання на @DityamPlusBot з будь-якого місця сайту'));
  }
  out.push(step('bot', 'Відкрили бота', total, visits ? plusClicks : null, first, '/start у @DityamPlusBot'));
  out.push(step('consent', 'Погодились з офертою', consented, total, first));
  out.push(step('started', 'Почали анкету', started, consented, first, 'перше питання — скільки дітей'));
  out.push(step('filled', 'Заповнили анкету', filled, started, first));
  out.push(step('pay', 'Дійшли до оплати', toPay, filled, first, 'створено рахунок у WayForPay'));
  out.push(step('paid', 'Оплатили', paid, toPay, first));
  return out;
}

/** Звідки приходять — і чи ті самі джерела дають тих, хто платить. */
export function plusSources(subs = []) {
  const by = new Map();
  for (const s of subs) {
    const k = s.source || '—';
    const row = by.get(k) || { source: k, all: 0, paid: 0 };
    row.all += 1;
    if (s.status === 'active') row.paid += 1;
    by.set(k, row);
  }
  return [...by.values()].sort((a, b) => b.paid - a.paid || b.all - a.all);
}
