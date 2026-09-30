// Олімпіади МОН у стрічці каталогу — однією карткою (редизайн головної,
// PR 4, 29.09.2026). Ознака надійна: та сама isMonOlympiad за назвою
// «Всеукраїнська олімпіада…», якою живе путівник /olimpiady. Без React — щоб
// читалось тестами на голому node.
//
// Група стає на місце найближчої з олімпіад (стрічка вже відсортована за
// дедлайном), решта зникає зі стрічки, але лишається в лічильнику
// «Знайдено N»: це записи, а не картки. Одна олімпіада групою не стає.
import { isMonOlympiad } from './olympiads.js';

export const MON_GROUP = 'mon-olympiads';

export function groupMonOlympiads(items) {
  const list = items || [];
  const mon = list.filter(isMonOlympiad);
  if (mon.length < 2) return list;
  const out = [];
  let placed = false;
  for (const o of list) {
    if (isMonOlympiad(o)) {
      if (!placed) { out.push({ group: MON_GROUP, id: MON_GROUP, items: mon }); placed = true; }
      continue;
    }
    out.push(o);
  }
  return out;
}

/** «Всеукраїнська олімпіада з фізики» → «з фізики»: підпис чипа під заголовком групи. */
export function subjectLabel(o) {
  return String(o?.title || '').replace(/^Всеукраїнська олімпіада\s+/i, '').trim();
}
