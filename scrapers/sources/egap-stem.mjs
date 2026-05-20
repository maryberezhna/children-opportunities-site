// EGAP — STEM-освіта в школах України
// Сайт: egap.in.ua
// Програми впроваджуються через школи (не індивідуальна реєстрація) — тому
// це статичний скрейпер. Посилання ведуть на сторінки програм, де школа
// може звернутися для участі.

export const name = 'EGAP — STEM-освіта';

const PROGRAMS = [
  {
    title: 'STEM-класи EGAP — обладнані навчальні лабораторії',
    summary: 'Програма EGAP оснащує школи STEM-лабораторіями: інтерактивні панелі, цифрові мікроскопи, метеостанції, набори датчиків. Наразі 11 шкіл мають розширені комплекти. Спрямовано на сільські та малі міста, щоб зробити технологічну освіту доступною кожній дитині.',
    opportunity_type: 'course',
    source_url: 'https://egap.in.ua/project/stem_klasi',
  },
  {
    title: 'Робототехніка в школах EGAP (Arduino та Lego)',
    summary: 'EGAP забезпечує школи обладнанням для робототехніки: 21 школа з наборами Arduino, 12 шкіл з Lego Mindstorms. Учні конструюють та програмують роботів, беруть участь у змаганнях і фестивалях. Щорічні змагання серед шкіл.',
    opportunity_type: 'club',
    source_url: 'https://egap.in.ua/project/robototexnika',
  },
  {
    title: '3D-моделювання у школах EGAP',
    summary: 'Програма впровадження 3D-моделювання та інженерного дизайну у 21 школі. Учні вивчають принципи проектування, створюють 3D-моделі та розвивають просторове мислення.',
    opportunity_type: 'course',
    source_url: 'https://egap.in.ua/project/3d_modelyuvannya',
  },
  {
    title: 'Цифрові амбасадори EGAP — навчання цифровим навичкам',
    summary: 'Мережа тренерів EGAP проводить навчання цифровим технологіям у громадах: від базового смартфона до е-послуг. Доступно для школярів, батьків та вчителів.',
    opportunity_type: 'course',
    source_url: 'https://egap.in.ua/project/cifrovi_ambasadori',
  },
];

export function scrape() {
  return PROGRAMS.map((p) => ({
    ...p,
    age_from: 7,
    age_to: 17,
    categories: ['stem', 'digital'],
    child_needs: [],
    format: 'Офлайн (школи-партнери)',
    cost_type: 'free',
    deadline: null,
    source: 'EGAP',
  }));
}
