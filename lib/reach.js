/**
 * Для кого можливість за місцем — чотири групи (рішення Марії 27.10.2026:
 * «нам треба чітко розділити діаспору / рівні онлайн можливості / і локальні
 * можливості в україні»; «Позначка групи в постах, щоб людина одразу бачила,
 * чи це для неї»).
 *
 *   ukraine  — 🇺🇦 В Україні: подія в українському місті чи по всій Україні;
 *   online   — 💻 Онлайн для всіх: нікуди їхати не треба, звідки завгодно;
 *   diaspora — 🌍 Живемо за кордоном: для дітей, що ВЖЕ живуть в іншій країні
 *              (суботні школи, місцева допомога, програми країни);
 *   travel   — ✈️ Поїхати за кордон: обміни, стипендії, табори, куди їдуть
 *              з України.
 *
 * Назви груп на сайті ті самі, що вже стоять у меню: «За кордон» (/za-kordon)
 * і «Живемо за кордоном» (/ukrainskym-ditiam-za-kordonom).
 *
 * Жодної нової колонки — лише поля, що вже є: format, is_international,
 * countries, cities, ua_eligibility. Текст не читаємо: правило мусить рахувати
 * однаково на сайті, у каналі, в Instagram і в Dityam+ (бот на Python —
 * scraper/reach.py, приклади спільні: tests/fixtures/reach-cases.json).
 *
 * Порядок перевірок — від найконкретнішого:
 *   1) abroad_only — подати можуть лише ті, хто живе там (поле ua_eligibility,
 *      lib/opportunity-facts.js):
 *      діаспора, хай що в інших полях;
 *   2) місцева програма іншої країни (не міжнародна, країна без України) —
 *      теж діаспора: з України туди не подаються;
 *   3) онлайн — для всіх;
 *   4) фізично за кордон — поїздка (lib/geo.js goesAbroad);
 *   5) українське місто, «Вся Україна» чи країна Україна — В Україні;
 *   6) решта — null: місця в записі немає, групу не вгадуємо.
 *
 * Цей модуль читають тести на голому node — лише відносні імпорти.
 */
import { abroadCountries, goesAbroad, realCities } from './geo.js';

export const REACH = ['ukraine', 'online', 'diaspora', 'travel'];

/** Підписи груп. emoji окремо — для чипів і постів, де місця мало. */
export const REACH_LABELS = {
  ukraine: { emoji: '🇺🇦', uk: 'В Україні', en: 'In Ukraine' },
  online: { emoji: '💻', uk: 'Онлайн для всіх', en: 'Online for all' },
  diaspora: { emoji: '🌍', uk: 'Живемо за кордоном', en: 'Living abroad' },
  travel: { emoji: '✈️', uk: 'Поїхати за кордон', en: 'Going abroad' },
};

/** «🇺🇦 В Україні». Невідома група — порожній рядок. */
export function reachLabel(reach, lang = 'uk') {
  const l = REACH_LABELS[reach];
  return l ? `${l.emoji} ${lang === 'en' ? l.en : l.uk}` : '';
}

const hasUa = (o) => (o.countries || []).some((c) => String(c).toLowerCase() === 'ua');
const allUkraine = (o) => (o.cities || []).some((c) => /вся україна/i.test(c));

/** Онлайн: формат «online» чи «Онлайн» серед міст. Гібрид без жодного місця
 *  (ні міста, ні країни) — теж онлайн: офлайн-частину нікуди прив'язати. */
function online(o) {
  if (/онлайн|online|дистанц/i.test(o.format || '')) return true;
  if ((o.cities || []).some((c) => /онлайн|online/i.test(c))) return true;
  return o.format === 'hybrid' && !realCities(o).length && !(o.countries || []).length;
}

/** Місцева програма іншої країни: не міжнародна, країна є, України серед них
 *  немає. Те саме, що isLocalAbroad у Dityam+ (lib/plusProfile.js). */
export const localAbroad = (o) =>
  !o.is_international && abroadCountries(o).length > 0 && !hasUa(o);

/** Типи, за якими нікуди не їдуть: гурток чи курс в іншій країні — для тих,
 *  хто там живе, навіть коли модель поставила «міжнародна» (27.10.2026:
 *  «Українська суботня школа при храмі Святого Стефана» з is_international
 *  інакше стояла б серед поїздок). Ті самі, що LOCAL_TYPES у lib/diaspora.js. */
const LOCAL_TYPES = new Set([
  'club', 'course', 'workshop', 'mentorship', 'educational_material',
  'humanitarian', 'psychology', 'medical_aid', 'legal_aid', 'shelter',
]);

/** 'ukraine' | 'online' | 'diaspora' | 'travel' | null. */
export function reachOf(o) {
  if (!o) return null;
  if (o.ua_eligibility === 'abroad_only') return 'diaspora';
  const foreign = abroadCountries(o).length > 0;
  if (o.ua_eligibility !== 'from_ukraine' && foreign) {
    if (localAbroad(o)) return 'diaspora';
    if (LOCAL_TYPES.has(o.opportunity_type) && !online(o)) return 'diaspora';
  }
  if (online(o)) return 'online';
  if (goesAbroad(o)) return 'travel';
  if (hasUa(o) || realCities(o).length || allUkraine(o)) return 'ukraine';
  return null;
}

/**
 * Чому групу варто перевірити людині. null — сумнівів немає.
 *   'eligibility' — місцева програма іншої країни, але «чи можна з України»
 *                   ніхто не підтвердив цитатою (unknown чи порожньо);
 *   'no_place'    — у записі немає ні міста, ні країни, ні формату онлайн;
 *   'mixed'       — поїздка лише за прапорцем «міжнародна», а місце — «Вся
 *                   Україна»: так записано і ЄСК (справді возить у ЄС), і
 *                   Премію Президента за міжнародні олімпіади (нікуди не везе).
 */
export function reachDoubt(o) {
  const r = reachOf(o);
  if (r === null) return 'no_place';
  if (r === 'diaspora' && o.ua_eligibility !== 'abroad_only') return 'eligibility';
  if (r === 'travel' && !abroadCountries(o).length && allUkraine(o)) return 'mixed';
  return null;
}
