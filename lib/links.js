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

/**
 * Що означає код відповіді для долі запису.
 *
 * Три різні відповіді, а не дві:
 *   alive   — сторінка на місці;
 *   dead    — сторінки немає (404/410) чи адреса зламана;
 *   unknown — ми не дізнались нічого: сервер лежить (5xx), боронить себе або
 *             мовчить саме для нас.
 *
 * Навіщо третя (02.10.2026). Перевірка ходить з IP GitHub Actions, і частина
 * сайтів — особливо державних — рве зʼєднання саме для них. Доти «не
 * достукались» рахувалось як «мертвий»: за три ночі запис ставав dead, а то й
 * закривався. З 13 позначених мертвими 11 відповідали 200 зі звичайної
 * адреси — тобто справжні два биті лінки губились серед дев'яти вигаданих.
 */
export function verdictForStatus(status) {
  if (status === 403 || status === 429) return { alive: true, reason: `bot-protected ${status}` };
  if (status === 404 || status === 410) return { alive: false, reason: `http ${status}` };
  if (status >= 500) return { unknown: true, reason: `http ${status}` };
  if (status >= 400) return { alive: false, reason: `http ${status}` };
  return { alive: true, reason: `http ${status}` };
}
