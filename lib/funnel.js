/**
 * Воронка Dityam+: скільки людей лишається на кожному кроці від «відкрив
 * бота» до «оплатив».
 *
 * Навіщо. 29.09.2026 було видно, що продажів майже немає, але не було видно
 * ЧОМУ: чи люди не доходять до бота, чи кидають анкету, чи лякаються ціни.
 * Поради без цього — здогади. Числа на кожному переході показують місце
 * втрати, і тоді зрозуміло, що чинити.
 *
 * Чого тут немає. Перший крок — «людина на сайті побачила Dityam+» — живе в
 * GA4, а не в нашій базі, і сюди не потрапляє. Тому воронка починається з
 * бота: це та частина, яку ми бачимо в себе й на яку впливаємо кодом.
 */

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
export function plusFunnel({ subs = [], childIds = new Set() } = {}) {
  const has = (s) => childIds.has(s.id);
  const total = subs.length;
  const consented = subs.filter((s) => s.consent_at).length;
  // «Почав анкету» — є дитина або бот чекає відповіді на якомусь кроці.
  const started = subs.filter((s) => has(s) || s.flow_step).length;
  // «Заповнив» — дитина є, а крок уже не чекає відповіді.
  const filled = subs.filter((s) => has(s) && !s.flow_step).length;
  // Рахунок у WayForPay створено: людина натиснула «оформити».
  const toPay = subs.filter((s) => s.wfp_order_reference).length;
  const paid = subs.filter((s) => s.status === 'active').length;

  const out = [];
  out.push(step('bot', 'Відкрили бота', total, null, total, '/start у @DityamPlusBot'));
  out.push(step('consent', 'Погодились з офертою', consented, total, total));
  out.push(step('started', 'Почали анкету', started, consented, total, 'перше питання — скільки дітей'));
  out.push(step('filled', 'Заповнили анкету', filled, started, total));
  out.push(step('pay', 'Дійшли до оплати', toPay, filled, total, 'створено рахунок у WayForPay'));
  out.push(step('paid', 'Оплатили', paid, toPay, total));
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
