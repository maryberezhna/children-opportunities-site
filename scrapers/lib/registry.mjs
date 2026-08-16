// Реєстр джерел (таблиця sources) для Node-пайплайна.
//
// Та сама логіка, що в scraper/db.py для Python: реєстр вмикає/вимикає джерела
// без деплою і накопичує історію здоров'я. Якщо таблиця недоступна — все
// вважається увімкненим: реєстр не сміє зупинити скрапінг власним збоєм.

export async function loadRegistry(supabase, pipeline) {
  if (!supabase) return {};
  try {
    const { data, error } = await supabase
      .from('sources')
      .select('name, enabled, consecutive_failures')
      .eq('pipeline', pipeline);
    if (error) throw new Error(error.message);
    return Object.fromEntries((data || []).map((r) => [r.name, r]));
  } catch (err) {
    console.warn(`registry load failed (${err.message}) — усі джерела увімкнені`);
    return {};
  }
}

export async function recordCrawl(supabase, name, ok) {
  if (!supabase) return;
  try {
    const { data } = await supabase
      .from('sources')
      .select('consecutive_failures, checks_count')
      .eq('name', name)
      .limit(1);
    if (!data?.length) return;
    const row = data[0];
    const now = new Date().toISOString();
    const patch = {
      last_crawled_at: now,
      checks_count: (row.checks_count || 0) + 1,
      consecutive_failures: ok ? 0 : (row.consecutive_failures || 0) + 1,
    };
    if (ok) patch.last_success_at = now;
    await supabase.from('sources').update(patch).eq('name', name);
  } catch (err) {
    console.warn(`recordCrawl failed for ${name}: ${err.message}`);
  }
}

// Чесний алерт замість «кураторських фолбеків»: джерело, що ламається кілька
// запусків поспіль, більше не прикидається робочим — адмін дізнається в Telegram.
export async function alertBrokenSources(supabase, pipeline, threshold = 3) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!supabase || !token || !chatId) return;
  try {
    const { data } = await supabase
      .from('sources')
      .select('name, consecutive_failures, notes')
      .eq('pipeline', pipeline)
      .eq('enabled', true)
      .gte('consecutive_failures', threshold);
    if (!data?.length) return;
    const lines = data.map(
      (s) => `• ${s.name} — ${s.consecutive_failures} збоїв поспіль`,
    );
    const text = [
      `🔧 Скрапери (${pipeline}) ламаються кілька запусків поспіль:`,
      ...lines,
      '',
      'Ймовірно, змінилась розмітка джерела. Полагодити — або вимкнути в таблиці sources (enabled=false), щоб не шуміло.',
    ].join('\n');
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch (err) {
    console.warn(`alertBrokenSources failed: ${err.message}`);
  }
}
