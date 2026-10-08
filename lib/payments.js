// Журнал оплат — таблиця payments (міграція 20261008_payments.sql).
//
// Марія, 08.10.2026: «мені треба своя сторінка в адмінці, щоб бачити, хто і
// скільки разів щось купував». Кожна успішна оплата — окремий рядок; сторінка
// /admin/lyudy складає з них історію людини. Пишемо з тих самих місць, де
// оплату вже підтверджують: колбек WayForPay для Dityam+, markPaid і
// markPrintPaid для олімпіади. Збій запису журналу не має ламати саму оплату —
// тому recordPayment ніколи не кидає помилку.
import { periodFromOrderRef } from './wayforpay.js';

export const PRODUCT_LABELS = {
  plus_monthly: 'Dityam+ · місяць',
  plus_halfyear: 'Dityam+ · пів року',
  plus_yearly: 'Dityam+ · рік',
  olimp_entry: 'Олімпіада · участь',
  olimp_print: 'Олімпіада · друкований диплом',
};

/** Що саме оплачено — за номером замовлення (формати з lib/wayforpay.js і lib/olimpiada-server.js). */
export function productOf(orderReference, amount) {
  const ref = String(orderReference || '');
  if (ref.startsWith('olimp-d-')) return 'olimp_print';
  if (ref.startsWith('olimp-')) return 'olimp_entry';
  return `plus_${periodFromOrderRef(ref, amount)}`;
}

/**
 * Ключ однієї оплати. Регулярне списання Dityam+ може прийти з тим самим
 * номером замовлення, що й перший платіж, — тож до номера додаємо дату
 * обробки з колбека. Повтор того самого колбека має ту саму дату й не
 * задвоюється. Без дати — день: два колбеки одного списання за добу.
 */
export function txKey(orderReference, processedAt) {
  const when = processedAt ? String(processedAt) : new Date().toISOString().slice(0, 10);
  return `${orderReference}|${when}`;
}

/** Дата оплати з колбека WayForPay (processingDate / createdDate — секунди Unix). */
export function paidAtOf(b) {
  const sec = Number(b?.processingDate || b?.createdDate);
  return Number.isFinite(sec) && sec > 0 ? new Date(sec * 1000).toISOString() : new Date().toISOString();
}

export async function recordPayment(supabase, row) {
  if (!supabase || !row?.order_reference || !(Number(row.amount) > 0)) return null;
  try {
    const { error } = await supabase.from('payments').upsert({
      currency: 'UAH', source: 'callback', ...row,
      product: row.product || productOf(row.order_reference, row.amount),
      tx_key: row.tx_key || txKey(row.order_reference, row.processed_at),
      processed_at: undefined,
    }, { onConflict: 'tx_key', ignoreDuplicates: true });
    if (error) console.error('[payments]', error.message);
    return !error;
  } catch (e) {
    console.error('[payments]', e);
    return null;
  }
}
