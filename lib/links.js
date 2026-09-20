// Чи подача (або сама подія) ще попереду.
//
// Мертвий лінк у такого запису — привід для людини, а не для закриття:
// 20.09.2026 так закрився живий NASA Space Apps Challenge. Сайт віддає 403
// саме на IP GitHub Actions, з мака та сама адреса відкривається, — а запис
// зник із каталогу за три тижні до хакатону 14–15 листопада.
export function stillAhead(row, todayIso = new Date().toISOString().slice(0, 10)) {
  return ['deadline', 'event_start_date', 'event_end_date']
    .some((k) => row?.[k] && String(row[k]) >= todayIso);
}
