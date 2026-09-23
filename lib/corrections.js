/**
 * Що саме людина виправила за моделлю.
 *
 * Привід (23.09.2026): ми не зберігали, ЩО саме виправила людина. Модератор
 * міняв у /admin/edit тип із «Курс» на «Табір» чи вартість із «Безкоштовно»
 * на «Платно» — старе значення зникало назавжди. Тому конвеєр повторював ті
 * самі помилки, а правила в промпт доводилось вписувати руками: порахувати,
 * де модель хибить систематично, не було з чого.
 *
 * Тут лише арифметика — ні мережі, ні аліасу `@/`. Так її читають і тести на
 * голому node, і тижневий звіт (scripts/corrections-digest.mjs), і адмінка:
 * одна функція, а не три копії, що розʼїдуться.
 */

/**
 * Поля, які може змінити форма /admin/edit. Рівно вони й ідуть у телеметрію:
 * службове (updated_at, status, verified_at, featured_week) — не виправлення
 * людини, а наслідок кнопки.
 */
export const TRACKED_FIELDS = [
  'title', 'summary',
  'deadline', 'event_start_date', 'event_end_date', 'results_date',
  'age_from', 'age_to',
  'opportunity_type', 'cost_type', 'format', 'recurrence',
  'cities', 'price_note', 'apply_url', 'details',
];

/** Рішення людини в черзі — не поле запису, тож назва з підкресленнями. */
export const DECISION_FIELD = '__decision';

/** Українські підписи полів — для звіту й будь-чого іншого, що це показує. */
export const FIELD_LABELS = {
  title: 'Назва',
  summary: 'Опис',
  deadline: 'Дедлайн подачі',
  event_start_date: 'Початок події',
  event_end_date: 'Завершення події',
  results_date: 'Результати',
  age_from: 'Вік від',
  age_to: 'Вік до',
  opportunity_type: 'Тип',
  cost_type: 'Вартість',
  format: 'Формат',
  recurrence: 'Періодичність',
  cities: 'Міста',
  price_note: 'Вартість словами',
  apply_url: 'Посилання на подачу',
  details: 'Розгорнутий матеріал',
  [DECISION_FIELD]: 'Рішення в черзі',
};

/**
 * Приводить значення до вигляду, у якому їх можна чесно порівняти.
 *
 * Порожнє — це завжди null: форма шле '', база тримає null, і без цього
 * кожне збереження «виправляло» пів запису з нічого в ніщо. А от 0 (вік від)
 * і false — справжні значення, їх не чіпаємо.
 */
export function normalizeValue(value) {
  if (value === undefined || value === null) return null;
  if (Array.isArray(value)) {
    const list = value.map((v) => String(v).trim()).filter(Boolean);
    return list.length ? list : null;
  }
  if (typeof value === 'number') return Number.isNaN(value) ? null : value;
  if (typeof value === 'boolean') return value;
  const text = String(value).trim();
  return text === '' ? null : text;
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Перелік полів, які людина справді змінила.
 *
 * Дивимось лише на те, що є в `after`: патч форми не несе полів, яких вона не
 * чіпала (вік із чернетки-заглушки, тип поза словником), і їхню відсутність
 * не можна читати як «людина стерла».
 *
 * Порожнє → заповнене рахується теж: модель не знайшла, людина знайшла — це
 * рівно та сама помилка конвеєра, що й невірне значення.
 */
export function changedFields(before, after, fields = TRACKED_FIELDS) {
  if (!after) return [];
  const out = [];
  for (const field of fields) {
    if (!Object.prototype.hasOwnProperty.call(after, field)) continue;
    const was = normalizeValue(before ? before[field] : null);
    const now = normalizeValue(after[field]);
    if (same(was, now)) continue;
    out.push({ field, before: was, after: now });
  }
  return out;
}

/** Готові рядки для moderation_corrections — щоб роут лишався тонким. */
export function correctionRows(opportunityId, before, after, source = 'edit', fields = TRACKED_FIELDS) {
  return changedFields(before, after, fields).map((c) => ({
    opportunity_id: opportunityId,
    field: c.field,
    before: c.before,
    after: c.after,
    source,
  }));
}

/**
 * Для пари before→after важлива сама дія, а не її причина: інакше кожен
 * коментар робив би пару унікальною, і закономірність «на сайті → прибрати
 * ×14» не склалась би жодного разу.
 */
export function pairValue(value) {
  if (value && typeof value === 'object' && !Array.isArray(value) && 'action' in value) {
    return value.action;
  }
  return value;
}

/**
 * Групування для тижневого звіту: поле → скільки разів виправляли, які пари
 * before→after повторюються і кілька прикладів.
 *
 * Пару беремо лише якщо вона траплялась двічі й більше: одна заміна — випадок,
 * дві однакові — закономірність, яку вже можна нести в промпт. Для вільного
 * тексту (назва, опис) пари не повторяться ніколи, і сигналом лишається сама
 * кількість.
 */
export function groupCorrections(rows, { maxPairs = 3, maxExamples = 3 } = {}) {
  const groups = new Map();
  for (const row of rows || []) {
    if (!row || !row.field) continue;
    if (!groups.has(row.field)) groups.set(row.field, []);
    groups.get(row.field).push(row);
  }

  const out = [];
  for (const [field, items] of groups) {
    const pairs = new Map();
    for (const item of items) {
      const before = pairValue(item.before);
      const after = pairValue(item.after);
      const key = JSON.stringify([before, after]);
      const seen = pairs.get(key);
      if (seen) seen.count += 1;
      else pairs.set(key, { before, after, count: 1 });
    }
    out.push({
      field,
      count: items.length,
      pairs: [...pairs.values()]
        .filter((p) => p.count > 1)
        .sort((a, b) => b.count - a.count || JSON.stringify(a).localeCompare(JSON.stringify(b)))
        .slice(0, maxPairs),
      examples: items.slice(0, maxExamples).map((item) => ({
        id: item.opportunity_id ?? null,
        title: item.title ?? item.opportunities?.title ?? null,
        slug: item.slug ?? item.opportunities?.slug ?? null,
        before: item.before ?? null,
        after: item.after ?? null,
      })),
    });
  }

  // Найчастіше виправлюване — нагору; за однакової кількості сортуємо за
  // назвою поля, щоб звіт не стрибав між запусками з тими самими даними.
  return out.sort((a, b) => b.count - a.count || a.field.localeCompare(b.field));
}
