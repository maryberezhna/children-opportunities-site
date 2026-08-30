/**
 * Один опис того, кого ми вважаємо україномовним.
 *
 * Ним користуються двоє: середник (за заголовком Accept-Language) вирішує,
 * чи відправляти людину на /en, і банер LangSuggest (за navigator.languages)
 * вирішує, чи пропонувати англійську. Доки визначення було в кожного своє,
 * вони суперечили одне одному: середник міг забрати людину на англійську
 * сторінку, а банер на ній — запропонувати те саме ще раз.
 *
 * Дивимось увесь список, а не лише перший запис: у діаспори браузер часто
 * встановлений мовою країни («pl-PL,pl,uk»), і українська стоїть третьою.
 * Саме таких людей редірект не має чіпати.
 */
export function readsUkrainian(tags) {
  return (tags || []).some((tag) => {
    const t = String(tag || '').toLowerCase().trim();
    return t === 'uk' || t.startsWith('uk-') || t === 'ru' || t.startsWith('ru-');
  });
}

/** Accept-Language → перелік мовних тегів, без тих, від яких браузер відмовився (q=0). */
export function acceptLanguageTags(header) {
  return String(header || '')
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.split(';');
      const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
      return { tag: tag.trim(), q: q ? Number(q.slice(2)) : 1 };
    })
    .filter((x) => x.tag && Number.isFinite(x.q) && x.q > 0)
    .map((x) => x.tag);
}
