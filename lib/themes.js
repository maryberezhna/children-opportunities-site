// 12 тематичних категорій для фільтра-пошуку на сайті. Збіг — підрядковий,
// регістронезалежний, по назві + опису можливості. Ключі-стеми (напр. "олімпіад",
// "малюванн") ловлять українські відмінки. Тримається в синхроні зі
// scraper/keywords.py (джерело того ж словника для скраперів).

export const THEME_CATEGORIES = {
  format: [
    'гурток', 'гуртк', 'студія', 'студії', 'секці', 'курс', 'майстер-клас',
    'воркшоп', 'інтенсив', 'буткемп', 'факультатив', 'спецкурс', 'майстерн',
    'дитяча академія', 'розвивальні заняття', 'ранній розвиток', 'підготовка до школи',
  ],
  stem: [
    'stem', 'steam', 'робототехн', 'програмуванн', 'coding', 'scratch',
    'python', 'дитяче it', 'юний технік', 'винахідник', 'наука для дітей',
    'науковий гурток', 'астроном', 'біотех', 'дрон', 'інженер',
  ],
  arts: [
    'арт-студія', 'малюванн', 'живопис', 'керамік', 'гончар', 'музична школа',
    'вокал', 'хоровий', 'театр', 'акторськ', 'танц', 'хореограф', 'дизайн',
    'анімаці', 'мультипліка', 'фотошкол', 'фотограф', 'креативн', 'мистецьк',
  ],
  sport: [
    'спортивна секці', 'спортивна школа', 'дюсш', 'плаванн', 'гімнастик',
    'єдиноборств', 'скелелазінн', 'фізична активн', 'адаптивн спорт',
    'інклюзивний спорт', 'футбол', 'баскетбол', 'шахи',
  ],
  languages: [
    'мовна школа', 'англійськ', 'розмовний клуб', 'language club',
    'білінгвальн', 'cambridge', 'ielts', 'друга іноземна', 'мовний табір',
    'німецьк', 'французьк', 'іспанськ',
  ],
  soft_skills: [
    'soft skills', 'лідерств', 'публічні виступи', 'ораторськ', 'дебати',
    'критичне мисленн', 'емоційний інтелект', 'тайм-менеджмент',
    'фінансова грамотн', 'особистісний розвиток',
  ],
  contests: [
    'олімпіад', 'конкурс', 'турнір', 'змаганн', 'хакатон', 'челендж',
    'вікторин', 'кастинг', 'open call', 'конкурс проєктів', 'конкурс есе',
    'конкурс малюнків',
  ],
  camps: [
    'табір', 'табор', 'stem-camp', 'кемп', ' camp', 'літня школа',
    'зимова школа', 'виїзний інтенсив', 'оздоровленн',
  ],
  career: [
    'профорієнтац', 'career', 'стажуванн', 'internship', 'job shadowing',
    'підприємництв', 'стартап', 'акселератор', 'менторств', 'наставництв',
    'mentorship',
  ],
  international: [
    'exchange', 'обмін', 'flex', 'erasmus', 'uwc', 'issos', 'summer school',
    'scholarship', 'стипенді', 'youth program', 'international', 'mobility',
    'upshift', 'за кордон',
  ],
  online: [
    'онлайн-курс', 'онлайн-школа', 'онлайн курс', 'вебінар', 'дистанційн',
    'освітня платформа', 'self-paced', 'безкоштовний онлайн',
  ],
  nonformal: [
    'позашкільн', 'неформальна освіта', 'додаткова освіта', 'проєктне навчання',
    'освітній хаб', 'дитячий простір',
  ],
  // Чотири теми додано 19.09.2026 для анкети Dityam+ (LIKE_OPTIONS у
  // lib/plusProfile.js): у списку з шести тем не було природи, медицини,
  // історії й підприємництва, хоч записи такі в базі є. У фільтр на сайті
  // (THEME_OPTIONS) їх поки не додаємо — це окреме рішення про верстку.
  nature: [
    'екологі', 'довкілл', 'природознавств', 'натураліст', 'тварин',
    'зоопарк', 'ботаніч', 'кліматичн', 'сталий розвиток', 'заповідник',
  ],
  health: [
    'медицин', 'медичн', 'перша допомога', 'домедичн', 'анатомі',
    'здоровий спосіб життя', 'ментальне здоров', 'психолог', 'нутриціолог',
    'фармаці', 'реабілітац',
  ],
  history: [
    'краєзнавч', 'краєзнавств', 'археолог', 'музе', 'екскурс', 'спадщин',
    'етнограф', 'фольклор', 'історія україни', 'історичн',
  ],
  business: [
    'підприємництв', 'стартап', 'бізнес', 'економік', 'акселератор',
    'маркетинг', 'фінансова грамотн',
  ],
};

/**
 * Категорії, які прийшли з джерела (opportunities.categories), зведені до наших тем.
 *
 * Поле categories заповнює модель при екстракції, і словника там немає: у базі
 * ~500 різних значень трьома мовами й у різному регістрі — «танець», «танці»,
 * «dance», «Танець». Просто взяти їх як теми не можна, але й викидати шкода:
 * саме вони описують запис, назва якого нічого не каже («Зразковий колектив
 * „Дивосвіт“»).
 *
 * Тому два проходи: спершу ті самі ключові слова по тексту категорій (вони
 * ловлять українські написання), а потім ця мапа — для англомовних і
 * абстрактних значень, яких серед ключових слів немає.
 *
 * Значення нормалізуємо: нижній регістр, «_» і «-» як пробіл.
 */
export const CATEGORY_THEMES = {
  arts: [
    'arts', 'art', 'creative', 'creativity', 'crafts', 'craft', 'handicraft',
    'handicrafts', 'handcrafts', 'needlework', 'music', 'musik', 'singing',
    'vocal', 'choir', 'dance', 'design', 'photography', 'animation', 'film',
    'video', 'visual arts', 'performing arts', 'artistic creativity', 'ceramics',
    'drawing', 'sewing', 'acting', 'modeling', 'circus arts', 'folk art',
    'traditional crafts', 'traditional arts', 'folk instruments', 'clothing',
    'мистецтво', 'творчість', 'музика', 'танець', 'рукоділля', 'ремесло',
    'ремесла', 'кераміка', 'спів', 'хор', 'мода', 'кіно', 'медіа',
  ],
  sport: [
    'sport', 'sports', 'fitness', 'swimming', 'football', 'chess', 'climbing',
    'cycling', 'triathlon', 'martial arts', 'physical activity', 'roller skating',
    'фітнес', 'бойові мистецтва', 'карате', 'дзюдо', 'бокс', 'боротьба',
    'акробатика', 'самбо', 'хортинг', 'тхеквондо', 'таеквон до', 'кікбоксинг',
    'велоспорт', 'тенніс', 'бадмінтон', 'йога', 'аеробіка', 'фізкультура',
    'фізична культура', 'фізична підготовка', 'фізичний розвиток', 'туризм',
    'спорт', 'стрільба', 'автоспорт', 'верхова їзда', 'кінна справа', 'орієнтування', 'силовий спорт', 'волейбол', 'фізична активність',
  ],
  stem: [
    'stem', 'science', 'sciences', 'technology', 'tech', 'it', 'digital',
    'digital skills', 'digital literacy', 'programming', 'robotics',
    'computer science', 'engineering', 'mathematics', 'physics', 'chemistry',
    'biology', 'ai', 'game development', 'web development', '3d design',
    'innovation', 'research', 'наука', 'науки', 'технології', 'техніка',
    'математика', 'хімія', 'біологія', 'фізика', 'штучний інтелект',
    'кібербезпека', 'радіотехніка', 'конструювання', 'моделювання',
    'дослідження', 'технічна творчість', 'веб дизайн',
  ],
  languages: [
    'languages', 'language', 'language learning', 'english', 'speaking',
    'ukrainian language', 'мови', 'мова', 'англійська', 'іноземна мова',
    'іноземні мови', 'мовні курси', 'мовна практика', 'лінгвістика',
    'мовлення', 'розвиток мовлення', 'культура мовлення',
  ],
  soft_skills: [
    'leadership', 'teamwork', 'team building', 'communication', 'communications',
    'debates', 'soft skills', 'life skills', 'skills', 'skills development',
    'skill development', 'personal development', 'self development',
    'self expression', 'etiquette', 'лідерство', 'комунікація', 'навички',
    'саморозвиток', 'самопізнання', 'самоорганізація', 'командна робота',
    'соціальні навички', 'навички спілкування', 'комунікативні навички',
    'media literacy', 'медіаграмотність', 'розвиток навичок', 'переговори', 'дипломатія',
  ],
  international: [
    'international', 'eu', 'erasmus', 'erasmus+', 'exchange', 'youth exchange',
    'volunteer exchange', 'mobility', 'єс', 'еразмус+', 'обміни',
    'молодіжний обмін', 'молодіжні обміни', 'міжнародна мобільність',
    'міжнародна програма', 'міжнародні змагання',
  ],
  nature: [
    'nature', 'environment', 'ecology', 'animals', 'природа', 'природознавство',
    'натуралістика', 'квітникарство', 'флористика', 'ветеринарія', 'конярство',
  ],
  health: [
    'health', 'psychology', 'medical', 'mental health', 'rehabilitation',
    'wellness', 'care', 'safety', 'здоров\'я', 'безпека', 'логопедія',
    'іппотерапія', 'арт терапія', 'адаптивна фізкультура', 'інклюзія',
  ],
  history: [
    'history', 'culture', 'cultural education', 'heritage', 'folk art',
    'traditional skills', 'literature', 'writing', 'humanities', 'історія',
    'культура', 'традиції', 'українська культура', 'народне мистецтво',
    'література', 'письменництво', 'поезія', 'писанкарство', 'релігія',
  ],
  business: [
    'business', 'entrepreneurship', 'economics', 'finance', 'marketing',
    'startups', 'бізнес', 'економіка', 'підприємництво',
  ],
  career: [
    'vocational', 'vocational training', 'vocational guidance', 'professional',
    'career development', 'paid work', 'profession', 'профорієнтація',
  ],
  contests: [
    'competition', 'competitions', 'olympiad', 'olympiad preparation',
    'конкурс', 'олімпіади', 'дебати',
  ],
  camps: ['camp', 'summer', 'recreation', 'оздоровлення', 'рекреація', 'літні курси'],
  online: ['online', 'онлайн', 'дистанційно', 'video lessons'],
  nonformal: [
    'club', 'clubs', 'hobby', 'гурток', 'гуртки', 'дитячі гуртки', 'клуб',
    'дозвілля', 'позашкільна освіта', 'скаутизм', 'скаутинг', 'скаут',
    'волонтерство', 'volunteering', 'volunteer', 'community service',
    'civic engagement', 'civic education', 'громадянська освіта',
    'патріотичне виховання', 'громадська активність',
  ],
};

// Зворотний індекс: нормалізоване значення категорії → набір тем.
const CATEGORY_INDEX = (() => {
  const idx = new Map();
  for (const theme in CATEGORY_THEMES) {
    for (const raw of CATEGORY_THEMES[theme]) {
      const key = normalizeCategory(raw);
      if (!idx.has(key)) idx.set(key, new Set());
      idx.get(key).add(theme);
    }
  }
  return idx;
})();

export function normalizeCategory(value) {
  return String(value || '').toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Теми можливості: ключові слова по назві, опису Й категоріях, плюс мапа
 * категорій. Це те, з чим звіряються вподобання дитини в Dityam+ і що показує
 * підпис у добірці, тож чим менше записів лишається без теми, тим менше
 * можливостей не доходить до родини.
 */
export function themesOf(o) {
  const cats = Array.isArray(o?.categories) ? o.categories : [];
  const text = `${o?.title || ''} ${o?.summary || ''} ${cats.join(' ')}`;
  const out = new Set(matchThemes(text));
  for (const c of cats) {
    const hit = CATEGORY_INDEX.get(normalizeCategory(c));
    if (hit) for (const t of hit) out.add(t);
  }
  return out;
}

// Order & labels for the filter row (user-facing).
export const THEME_OPTIONS = [
  { label: 'Усі', en: 'All', value: 'all' },
  { label: 'Гуртки/курси', en: 'Clubs & courses', value: 'format' },
  { label: 'STEM / IT', en: 'STEM / IT', value: 'stem' },
  { label: 'Творчість', en: 'Arts', value: 'arts' },
  { label: 'Спорт', en: 'Sport', value: 'sport' },
  { label: 'Мови', en: 'Languages', value: 'languages' },
  { label: 'Конкурси/олімпіади', en: 'Contests & olympiads', value: 'contests' },
  { label: 'Табори', en: 'Camps', value: 'camps' },
  { label: 'Soft skills', en: 'Soft skills', value: 'soft_skills' },
  { label: "Кар'єра", en: 'Career', value: 'career' },
  { label: 'Міжнародні', en: 'International', value: 'international' },
  // «Онлайн» переїхав у фільтр «Тип»: це формат участі, а не тема. Ключі
  // THEME_CATEGORIES.online лишаються — ними користується digest-флоу.
];

// Returns the list of theme keys a piece of text matches.
export function matchThemes(text) {
  const low = (text || '').toLowerCase();
  const out = [];
  for (const key in THEME_CATEGORIES) {
    if (THEME_CATEGORIES[key].some((kw) => low.includes(kw))) out.push(key);
  }
  return out;
}
