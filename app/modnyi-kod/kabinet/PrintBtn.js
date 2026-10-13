'use client';
// Друк лише обкладинки на 1 аркуш A4 (Марія, 13.10.2026: «чи можна роздрукувати
// і щоб воно гарно лягало на 1 сторінку… без сторінки сайту»). Звичайний
// window.print() брав шапку сайту, плаваючі кнопки й давав 3 сторінки. Тепер
// копія обкладинки (разом із візерунками — без них шотландка не друкується)
// стає єдиним видимим блоком сторінки на час друку.
export function printCover() {
  const cover = document.querySelector('.mkK-cover .vc');
  if (!cover) { window.print(); return; }
  const defs = document.querySelector('main.mkK > svg');
  const box = document.createElement('div');
  box.id = 'mk-print';
  box.innerHTML = (defs ? defs.outerHTML : '') + cover.outerHTML;
  document.body.appendChild(box);
  document.documentElement.classList.add('mk-printing');
  const done = () => {
    document.documentElement.classList.remove('mk-printing');
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
