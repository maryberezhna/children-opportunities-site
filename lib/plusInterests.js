/**
 * Чим цікавляться ті, хто заповнив анкету Dityam+ (Марія, 24.10.2026:
 * «проаналізуй, чим цікавляться люди, які зареєструвались у Dityam+, і
 * виведи мені на головну сторінку»). Рахує /admin/today.
 *
 * Родина — рядок digest_subscribers, у якого є хоч одна дитина в
 * plus_children (тобто анкету дійшли до дітей). Вподобання, тип, вік і
 * обставини рахуються по дітях; місто, вартість і хто заповнює — по родинах.
 * Відсоток — від дітей чи родин відповідно; одна дитина може мати кілька
 * вподобань, тож сума відсотків більша за 100.
 *
 * Без аліасу `@/` і без мережі: модуль читають тести на голому node.
 */
import { AGE_OPTIONS, LIKE_OPTIONS, FORMAT_OPTIONS, NEED_OPTIONS, PLACE_ONLINE, PLACE_ABROAD, PLACE_OTHER } from './plusProfile.js';

const ROLE_LABELS = { parent: 'Батьки', teen: 'Підлітки самі', teacher: 'Педагоги' };
const PLACE_LABELS = { [PLACE_OTHER]: 'Мого міста немає в списку', [PLACE_ONLINE]: 'Онлайн', [PLACE_ABROAD]: 'За кордоном' };

function tally(values, options, base) {
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
  const label = new Map(options);
  return [...counts.entries()]
    .map(([key, n]) => ({ key, label: label.get(key) || key, n, pct: base ? Math.round((n / base) * 100) : 0 }))
    .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label, 'uk'));
}

export function plusInterests(subscribers, children) {
  const byId = new Map((subscribers || []).map((s) => [s.id, s]));
  const kids = (children || []).filter((c) => byId.has(c.subscriber_id));
  const familyIds = new Set(kids.map((c) => c.subscriber_id));
  const families = [...familyIds].map((id) => byId.get(id));
  const nKids = kids.length;
  const nFam = families.length;
  const flat = (key) => kids.flatMap((c) => c[key] || []);

  const places = families.flatMap((f) => f.places || []);
  const placeOptions = [...new Set(places)].map((p) => [p, PLACE_LABELS[p] || p]);

  return {
    families: nFam,
    kids: nKids,
    active: families.filter((f) => f.status === 'active').length,
    likes: tally(flat('likes'), LIKE_OPTIONS, nKids),
    formats: tally(flat('formats'), FORMAT_OPTIONS, nKids),
    ages: tally(flat('age_bands'), AGE_OPTIONS, nKids)
      .sort((a, b) => AGE_OPTIONS.findIndex(([k]) => k === a.key) - AGE_OPTIONS.findIndex(([k]) => k === b.key)),
    needs: tally(flat('needs'), NEED_OPTIONS, nKids),
    places: tally(places, placeOptions, nFam),
    freeOnly: families.filter((f) => f.cost_pref === 'free_only').length,
    roles: tally(families.map((f) => f.role || 'none'), [...Object.entries(ROLE_LABELS), ['none', 'Не вказано']], nFam),
  };
}
