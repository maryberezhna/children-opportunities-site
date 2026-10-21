import { liveStats } from '@/lib/supabase';

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
  {
    outlet: 'Social Impact Award Ukraine',
    outletEn: 'Social Impact Award Ukraine',
    logo: { src: '/press/logos/sia.svg', width: 150, height: 136 },
    date: '8 жовтня 2026',
    iso: '2026-10-08',
    title:
      'Кібербезпека для підлітків, можливості для дітей та шкільний бізнес: оголосили переможців SIA Ukraine 2026',
    url: 'https://ukraine.socialimpactaward.net/article/%d0%ba%d1%96%d0%b1%d0%b5%d1%80%d0%b1%d0%b5%d0%b7%d0%bf%d0%b5%d0%ba%d0%b0-%d0%b4%d0%bb%d1%8f-%d0%bf%d1%96%d0%b4%d0%bb%d1%96%d1%82%d0%ba%d1%96%d0%b2-%d0%bc%d0%be%d0%b6%d0%bb%d0%b8%d0%b2%d0%be%d1%81/',
  },  {
    // Другий матеріал Ветерана — уже про саму платформу (розділ «Дітям
    // захисників», перемога SIA, обидві олімпіади); 4 активні посилання.
    outlet: 'Ветеран',
    outletEn: 'Veteran',
    logo: { src: '/press/logos/veteran.svg', width: 224, height: 71 },
    date: '17 жовтня 2026',
    iso: '2026-10-17',
    title:
      'Гроші, оздоровлення та психологічна допомога: як працює єдиний каталог можливостей для дітей військових та ветеранів',
    url: 'https://veteran.com.ua/news/view/groshi-ozdorovlennya-ta-psihologichna-dopomoga-yak-pratsyue-edinij-katalog-mozhlivostej-dlya-ditej-vijskovih-ta-veteraniv',
  },
  {
    // Європейська Бізнес Асоціація про переможців SIA Ukraine 2026 (SAP —
    // партнер програми). Заголовок і дата — з метаданих сторінки 21.10.2026;
    // сам текст закритий Cloudflare, тож чи є в ньому активне посилання на
    // сайт, не перевірено. Логотип — Wikimedia Commons, File:EBA logo.png.
    outlet: 'Європейська Бізнес Асоціація',
    outletEn: 'European Business Association',
    logo: { src: '/press/logos/eba.png', width: 413, height: 240 },
    date: '20 жовтня 2026',
    iso: '2026-10-20',
    title:
      'SAP підтримує молодих соціальних підприємців в Україні: оголосили переможців Social Impact Award Ukraine 2026',
    url: 'https://eba.com.ua/ua-sap-pidtrymuye-molodyh-sotsialnyh-pidpryyemtsiv-v-ukrayini-ogolosyly-peremozhtsiv-social-impact-award-ukraine-2026/',
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
// Рахує спільний liveStats() — те саме число, що на головній.
export async function pressStats() {
  return liveStats();
}
