// Обрізання назв для повідомлень у Telegram.
//
// Привід: назва «Онлайн-консультація «Діалог українських дітей з Радою
// Європи»» має рівно 61 символ, а пітч Dityam+ різав на 60 — у пості
// лишилась відкрита лапка без пари й жодного знаку, що назву обрізано
// (скриншот Марії 19.09.2026). Читач бачить не довгу назву, а поламаний рядок.
//
// Правила: ріжемо по межі слова, лишаємо трикрапку і закриваємо лапку,
// якщо обрізали всередині цитати.
export function cutTitle(title, max = 60) {
  const s = String(title ?? '').trim();
  if (s.length <= max) return s;
  const head = s.slice(0, max);
  // Межа слова, але не ціною половини назви: якщо слово довге, ріжемо як є.
  const atWord = head.replace(/[\s,;:.!?—–-]+\S*$/, '');
  const body = (atWord.length >= max / 2 ? atWord : head).replace(/[\s,;:.!?—–-]+$/, '');
  const opened = (body.match(/«/g) || []).length;
  const closed = (body.match(/»/g) || []).length;
  return opened > closed ? `${body}…»` : `${body}…`;
}
