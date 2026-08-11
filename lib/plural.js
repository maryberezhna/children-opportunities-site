// Українське узгодження числівників.
//
// На сайті було «403 можливостей» — неправильно: 403 закінчується на 3, тож
// «403 можливості». Правило залежить від останніх двох цифр, а не від однієї:
// 11-14 завжди беруть форму множини («11 можливостей»), хоча 1 і 4 самі по
// собі беруть інші форми.
//
//   one   — 1, 21, 31…  (крім 11)
//   few   — 2-4, 22-24… (крім 12-14)
//   many  — 0, 5-20, 25-30…
export function plural(n, one, few, many) {
  const abs = Math.abs(Math.trunc(n));
  const lastTwo = abs % 100;
  if (lastTwo >= 11 && lastTwo <= 14) return many;
  const last = abs % 10;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

export const opportunitiesWord = (n) =>
  plural(n, 'можливість', 'можливості', 'можливостей');

export const sourcesWord = (n) => plural(n, 'джерело', 'джерела', 'джерел');

export const freeWord = (n) =>
  plural(n, 'безкоштовна', 'безкоштовні', 'безкоштовних');
