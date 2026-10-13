'use client';
// Друк лише обкладинки на 1 аркуш A4 (Марія, 13.10.2026: «чи можна роздрукувати
// і щоб воно гарно лягало на 1 сторінку… без сторінки сайту»). Звичайний
// window.print() брав шапку сайту, плаваючі кнопки й давав 3 сторінки. Тепер
// копія обкладинки (разом із візерунками — без них шотландка не друкується)
// стає єдиним видимим блоком сторінки на час друку.
export function printCover() {
  const cover = document.querySelector('.mkK-cover .vc');
  if (!cover) { window.print(); return; }
  // Візерунки (шотландка, ромби…) переносимо, а не копіюємо: з копією id
  // двоїлись, і браузер брав візерунок із прихованої сторінки — одяг
  // друкувався білим. Після друку повертаємо на місце.
  const defs = document.querySelector('main.mkK > svg');
  const home = defs ? { parent: defs.parentNode, next: defs.nextSibling } : null;
  const box = document.createElement('div');
  box.id = 'mk-print';
  if (defs) box.appendChild(defs);
  box.insertAdjacentHTML('beforeend', cover.outerHTML);
  document.body.appendChild(box);
  document.documentElement.classList.add('mk-printing');
  const done = () => {
    document.documentElement.classList.remove('mk-printing');
    if (defs && home) home.parent.insertBefore(defs, home.next);
    box.remove();
    window.removeEventListener('afterprint', done);
  };
  window.addEventListener('afterprint', done);
  window.print();
  // Safari на телефоні не завжди шле afterprint — прибираємо й за таймером.
  setTimeout(() => { if (document.getElementById('mk-print')) done(); }, 60000);
}

export default function PrintBtn() {
  return <button type="button" className="mk-btn-y" onClick={printCover}>Роздрукувати чи зберегти PDF</button>;
}
