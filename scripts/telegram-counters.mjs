/**
 * Живі числа для постів у канал.
 *
 * Навіщо. 13.09.2026 у готовому пості стояло «639 безкоштовних можливостей»
 * і окремим рядком обіцянка: «це не оцінка, а точне число з платформи на
 * сьогодні». Насправді того дня їх було 687. Число написали руками колись
 * раніше, і воно тихо застаріло — а обіцянка точності лишилась.
 *
 * Тому в текстах постів чисел більше немає. Є токени, які підставляються з
 * бази в момент відправки. Застаріти вони не можуть за побудовою.
 *
 * Токени:
 *   {{total}}        активних можливостей на сайті
 *   {{free}}         з них безкоштовних
 *   {{sources}}      різних джерел
 *   {{online}}       формат «онлайн»
 *   {{deadline14}}   із дедлайном у найближчі 14 днів
 *   {{topic:slug}}   скільки на сторінці підбірки (slug із lib/topics.js)
 *   {{soon3}}        три найближчі безкоштовні дедлайни, рядками
 *
 * Після токена можна дописати три форми слова через кому:
 * `{{deadline14|можливість,можливості,можливостей}}` дасть «31 можливість».
 * Без цього в каналі виходило б «31 можливостей» — саме та помилка, через
 * яку на сайті колись стояло «403 можливостей».
 *
 * Рахуємо ТОЧНО так, як рахує сайт: лише status='active' і без записів,
 * злитих у канонічний (`canonical_slug is null`). Інакше пост обіцяв би одне,
 * а сторінка показувала інше — рівно та розбіжність, через яку 722 у базі
 * перетворюються на 687 на екрані.
 */
import { createClient } from '@supabase/supabase-js';
import { TOPIC_LIST } from '../lib/topics.js';
import { plural } from '../lib/plural.js';

const MONTHS = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
  'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];

const dayMonth = (iso) => {
  const [, m, d] = iso.split('-');
  return `${Number(d)} ${MONTHS[Number(m) - 1]}`;
};

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Усі активні картки, посторінково: PostgREST віддає максимум 1000 за раз. */
async function fetchAll(sb, select) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from('opportunities')
      .select(select)
      .eq('status', 'active')
      .is('canonical_slug', null)
      .order('id')
      .range(from, from + 999);
    if (error) throw new Error(`Supabase: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < 1000) return rows;
  }
}

export function hasTokens(text) {
  return /\{\{[^}]+\}\}/.test(text);
}

/**
 * Підставляє токени. Невідомий токен — це помилка, а не порожній рядок:
 * друкарська помилка інакше пішла б у канал діркою в тексті.
 */
export async function resolveTokens(text, { url, key, today = new Date() } = {}) {
  if (!hasTokens(text)) return { text, used: [] };
  if (!url || !key) {
    throw new Error('У тексті є {{токени}}, але немає доступу до бази '
      + '(NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)');
  }
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const rows = await fetchAll(sb,
    'slug, title, source, cost_type, format, deadline, opportunity_type, '
    + 'age_from, age_to, cities, countries, is_international, child_needs, summary');

  const iso = today.toISOString().slice(0, 10);
  const plus14 = new Date(today.getTime() + 14 * 864e5).toISOString().slice(0, 10);
  const withDeadline = rows
    .filter((o) => o.deadline && o.deadline >= iso && o.deadline <= plus14)
    .sort((a, b) => a.deadline.localeCompare(b.deadline));

  const counters = {
    total: () => String(rows.length),
    free: () => String(rows.filter((o) => o.cost_type === 'free').length),
    sources: () => String(new Set(rows.map((o) => o.source).filter(Boolean)).size),
    online: () => String(rows.filter((o) => o.format === 'online').length),
    deadline14: () => String(withDeadline.length),
    soon3: () => withDeadline
      .filter((o) => o.cost_type === 'free')
      .slice(0, 3)
      .map((o) => `• <a href="https://dityam.com.ua/o/${o.slug}">${esc(o.title)}</a>`
        + ` — до ${dayMonth(o.deadline)}, ${o.age_from}–${o.age_to} р.`)
      .join('\n'),
  };

  const used = [];
  const withWord = (n, forms) => {
    if (!forms) return String(n);
    const parts = forms.split(',').map((x) => x.trim());
    if (parts.length !== 3) {
      throw new Error(`Потрібні рівно три форми слова через кому, `
        + `напр. |можливість,можливості,можливостей — а тут «${forms}»`);
    }
    return `${n} ${plural(n, ...parts)}`;
  };

  const out = text.replace(
    /\{\{\s*([a-z0-9_]+)(?::([a-z0-9-]+))?\s*(?:\|([^}]+?))?\s*\}\}/gi,
    (whole, name, arg, forms) => {
      const key2 = name.toLowerCase();
      let value;
      if (key2 === 'topic') {
        const topic = TOPIC_LIST.find((t) => t.slug === arg);
        if (!topic) throw new Error(`Невідома підбірка в ${whole}. `
          + `Є такі: ${TOPIC_LIST.map((t) => t.slug).join(', ')}`);
        value = withWord(rows.filter(topic.match).length, forms);
      } else {
        const fn = counters[key2];
        if (!fn) throw new Error(`Невідомий токен ${whole}. `
          + `Є такі: ${Object.keys(counters).map((k) => `{{${k}}}`).join(', ')}, {{topic:slug}}`);
        const v = fn();
        value = forms ? withWord(Number(v), forms) : v;
      }
      used.push(`${whole} → ${value.includes('\n') ? `${value.split('\n').length} рядки` : value}`);
      return value;
    });
  return { text: out, used };
}
