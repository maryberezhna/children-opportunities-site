// Промокоди Dityam+ (рішення Марії 19.09.2026).
//
// Чому не «поле промокоду на сторінці оплати»: WayForPay отримує вже готовий
// інвойс із сумою, яку порахували ми. Знижку тому застосовуємо ДО створення
// інвойса — у боті, і людина бачить нову ціну просто на кнопці оплати.
//
// Знижка діє лише на ПЕРШИЙ платіж: regularAmount у lib/wayforpay.js лишається
// повною ціною, інакше людину списували б по 1 грн щомісяця назавжди.
//
// Код `first`: перший місяць 1 грн замість 99, перший рік 499 замість 999.

// Коди пишемо одним словом без підкреслень: у діп-лінку `promo_<код>_<звідки>`
// підкреслення розділяє код і джерело.
export const CODE_RE = /^[a-z0-9-]{2,24}$/;

export function normalizeCode(raw) {
  const s = String(raw ?? '').trim().toLowerCase().replace(/^промокод[:\s]*/i, '');
  return CODE_RE.test(s) ? s : null;
}

// `/start promo_first_kanal` → { code: 'first', source: 'kanal' }
export function parseStartArg(startArg) {
  const m = String(startArg ?? '').match(/^promo[_-]([a-z0-9-]{2,24})(?:_(.+))?$/i);
  if (!m) return null;
  const code = normalizeCode(m[1]);
  return code ? { code, source: (m[2] || 'link').toLowerCase().slice(0, 40) } : null;
}

// Чи код ще живий. Чиста функція: `used` приходить ззовні, щоб правила
// перевіряв тест, а лічильник не жив окремим життям від таблиці використань.
export function promoUsable(row, { used = 0, todayIso = new Date().toISOString().slice(0, 10) } = {}) {
  if (!row) return { ok: false, reason: 'unknown' };
  if (row.valid_until && String(row.valid_until).slice(0, 10) < todayIso) return { ok: false, reason: 'expired' };
  if (row.max_uses != null && used >= row.max_uses) return { ok: false, reason: 'used_up' };
  return { ok: true };
}

// Повертає код разом із тим, скільки людей його вже ввели — щоб ліміт
// рахувався по реальних рядках, а не по лічильнику, який розходиться після
// будь-якої ручної правки.
export async function findPromo(supabase, code) {
  const c = normalizeCode(code);
  if (!c || !supabase) return null;
  const { data } = await supabase.from('plus_promo_codes').select('*').eq('code', c).maybeSingle();
  if (!data) return null;
  const { count } = await supabase.from('plus_promo_uses')
    .select('id', { count: 'exact', head: true }).eq('code', c);
  return { ...data, used: count || 0 };
}

// Записуємо ВВЕДЕННЯ коду, а не оплату: Марії треба бачити і тих, хто ввів і
// не заплатив, — інакше незрозуміло, код не спрацював чи ціна не вмовила.
// Один рядок на людину й код (унікальний індекс), повторне введення оновлює
// джерело й час.
export async function claimPromo(supabase, { code, chatId, handle, source }) {
  if (!supabase) return null;
  const { data } = await supabase.from('plus_promo_uses').upsert({
    code,
    telegram_chat_id: String(chatId),
    telegram_username: handle || null,
    source: source || 'typed',
    created_at: new Date().toISOString(),
  }, { onConflict: 'code,telegram_chat_id' }).select('*').maybeSingle();
  return data || null;
}

// Скільки разів код уже спрацював — рахуємо рядки використань, а не лічильник
// у коді: лічильник розходиться з реальністю після кожної ручної правки.
export async function promoStats(supabase, code) {
  const c = normalizeCode(code);
  if (!c || !supabase) return { entered: 0, paid: 0 };
  const [{ count: entered }, { count: paid }] = await Promise.all([
    supabase.from('plus_promo_uses').select('id', { count: 'exact', head: true }).eq('code', c),
    supabase.from('plus_promo_uses').select('id', { count: 'exact', head: true }).eq('code', c).not('paid_at', 'is', null),
  ]);
  return { entered: entered || 0, paid: paid || 0 };
}

// Оплату помічаємо за людиною, а не за номером замовлення: у чат летять ДВА
// інвойси (місяць і рік), і заздалегідь невідомо, який із них вона натисне.
// `is('paid_at', null)` робить виклик ідемпотентним — колбек WayForPay
// приходить і на поновлення теж.
export async function markPromoPaid(supabase, { code, chatId, orderReference, amount }) {
  if (!supabase || !code || !chatId) return null;
  const { data } = await supabase.from('plus_promo_uses')
    .update({
      paid_at: new Date().toISOString(),
      order_reference: orderReference || null,
      paid_amount: amount != null ? Number(amount) : null,
    })
    .eq('code', code).eq('telegram_chat_id', String(chatId)).is('paid_at', null)
    .select('*').maybeSingle();
  return data || null;
}
