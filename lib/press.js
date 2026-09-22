import { supabase, publicOpportunities, fetchAllRows } from '@/lib/supabase';

// Публікації про проєкт. Порядок — як виходили; ШоТам були перші.
// Облік ведеться в Notion «Про нас пишуть — медіатека», сюди переносимо руками.
//
// date — для української сторінки, iso — щоб /en показувала дату англійською,
// outletEn — латинська назва для /en там, де оригінал кирилицею.
// logo — файл із public/press/logos. Розміри вказані справжні: без них браузер
// не знає висоту рядка до завантаження картинки і сторінка смикається.
// Форму логотипа визначає logoClass нижче: емблеми й написи у два рядки
// показуємо вищими, інакше поряд із широкими написами вони губляться.
export const MENTIONS = [
  {
    outlet: 'ШоТам',
    outletEn: 'ShoTam',
    logo: { src: '/press/logos/shotam.svg', width: 256, height: 45 },
    date: '17 серпня 2026',
    iso: '2026-08-17',
    title:
      'Усі можливості в одному місці: українка запустила безплатний каталог активностей для дітей',
    url: 'https://shotam.info/usi-mozhlyvosti-v-odnomu-mistsi-ukrainka-zapustyla-bezplatnyy-kataloh-aktyvnostey-dlia-ditey/',
  },
  {
    outlet: 'Дон Патріот',
    outletEn: 'Don Patriot',
    logo: { src: '/press/logos/donpatriot.png', width: 70, height: 70 },
    date: '17 серпня 2026',
    iso: '2026-08-17',
    title:
      'Можливості для кожної дитини: в Україні зʼявився єдиний агрегатор дитячих ініціатив і виплат',
    url: 'https://donpatriot.news/mozhlyvosti-dlya-kozhnoyi-dytyny-v-ukrayini-zyavyvsya-yedynyj-agregator-dytyachyh-inicziatyv-i-vyplat',
  },
  {
    outlet: 'Українки',
    outletEn: 'Ukrainky',
    logo: { src: '/press/logos/ukrainky.png', width: 200, height: 200 },
    date: '18 серпня 2026',
    iso: '2026-08-18',
    title:
      'Українка Марія Бережна створила безплатний каталог можливостей для дітей',
    url: 'https://ukrainky.com.ua/ukrayinka-mariya-berezhna-stvoryla-bezplatnyj-katalog-mozhlyvostej-dlya-ditej/',
  },
  {
    outlet: 'Ти Київ',
    outletEn: 'Ty Kyiv',
    logo: { src: '/press/logos/tykyiv.svg', width: 143, height: 25 },
    date: '18 серпня 2026',
    iso: '2026-08-18',
    title:
      'Українка створила безплатний каталог активностей для дітей по всій Україні: що в ньому є',
    url: 'https://tykyiv.com/news/ukrayinka-stvorila-bezplatnii-katalog-aktivnostei-dlia-ditei-po-vsii-ukrayini-shcho-v-nomu-ie/',
  },
  {
    outlet: 'WoMo',
    logo: { src: '/press/logos/womo.png', width: 440, height: 81 },
    date: '18 серпня 2026',
    iso: '2026-08-18',
    title: 'Можливості для дітей: безплатна платформа Dityam.com.ua',
    url: 'https://womo.ua/ukrayinka-stvoryla-bezplatnyj-katalog-mozhlyvostej-dlya-ditej/',
  },
  {
    outlet: 'Happy Monday',
    logo: { src: '/press/logos/happymonday.svg', width: 90, height: 51 },
    date: '3 вересня 2026',
    iso: '2026-09-03',
    title:
      'Фестиваль думок, стажування в Канаді та вебінар про тихе звільнення: актуальні можливості тижня',
    url: 'https://happymonday.ua/aktualni-podiyi-tyzhnya-03-09-26',
  },
  {
    outlet: 'Ветеран',
    outletEn: 'Veteran',
    logo: { src: '/press/logos/veteran.svg', width: 224, height: 71 },
    date: '21 вересня 2026',
    iso: '2026-09-21',
    title: 'Що доступно дітям захисників у 2026 році, крім державних пільг: як скористатися',
    url: 'https://veteran.com.ua/news/view/shho-dostupno-dityam-zahisnikiv-u-2026-rotsi-krim-derzhavnih-pilg-yak-skoristatisya',
  },
  {
    outlet: 'Politeka',
    logo: { src: '/press/logos/politeka.png', width: 244, height: 60 },
    date: '21 вересня 2026',
    iso: '2026-09-21',
    title: 'Безкоштовні програми для військових: що доступно дітям захисників',
    url: 'https://kiev.politeka.net/478136-bezkoshtovni-programi-dlya-viyskovih-shcho-dostupno-dityam-zahisnikiv',
  },
];

// Логотипи стоять рядком спільної висоти, і висота, зручна широкому напису,
// не годиться решті:
// - квадратна емблема (Дон Патріот, Українки) без ширини виходить утричі
//   дрібнішою;
// - напис у два рядки (Happy Monday, 90×51) ділить висоту навпіл, і кожен
//   рядок стає вдвічі нижчим за сусідні написи.
// Обом формам CSS дає більшу висоту.
export function logoClass({ width, height }) {
  const ratio = width / height;
  if (ratio < 1.5) return 'is-square';
  if (ratio < 3) return 'is-stacked';
  return undefined;
}

// Цифри тягнемо живими: журналіст цитує те, що бачить, тож застаріле «280+»
// у статичному тексті рано чи пізно стало б помилкою в чужій публікації.
export async function pressStats() {
  if (!supabase) return null;
  const { data, error } = await fetchAllRows(() => publicOpportunities(
    'cost_type, source, opportunity_type, cities, child_needs',
  ).order('id'));
  if (error || !data) return null;

  const cities = new Set();
  const needs = new Set();
  data.forEach((o) => {
    (o.cities || []).forEach((c) => cities.add(c));
    (o.child_needs || []).forEach((n) => needs.add(n));
  });

  return {
    total: data.length,
    free: data.filter((o) => o.cost_type === 'free').length,
    sources: new Set(data.map((o) => o.source).filter(Boolean)).size,
    types: new Set(data.map((o) => o.opportunity_type).filter(Boolean)).size,
    cities: cities.size,
    needs: needs.size,
  };
}
