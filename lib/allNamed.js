/**
 * Promise.all, але іменами замість позицій.
 *
 * 29.09.2026 на /admin/metrics два нові запити були вставлені в середину
 * масиву Promise.all, а розбиралися в кінці списку — кожен результат після них
 * поїхав на одну позицію: у promoRes лягли діти, у snapshotsRes — підписники.
 * Сторінка впала в проді («Application error», Digest 1465329057), і саме
 * там, куди автотест не заглядає: без адмін-куки сторінка малює форму входу й
 * до запитів не доходить.
 *
 * З іменами такий збій неможливий: назва їде разом зі значенням.
 */
export async function allNamed(obj) {
  const keys = Object.keys(obj);
  const values = await Promise.all(keys.map((k) => obj[k]));
  return Object.fromEntries(keys.map((k, i) => [k, values[i]]));
}
