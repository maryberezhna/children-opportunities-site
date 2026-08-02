import Link from 'next/link';

// Дефолтна сторінка Next віддавала «404 | This page could not be found» —
// англійською і без жодного шляху назад. Для батьків, що прийшли з посилання
// в Telegram, це глухий кут.
export const metadata = {
  title: 'Сторінку не знайдено — dityam.com.ua',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="container">
      <article className="legal-page">
        <h1>Такої сторінки немає</h1>
        <p className="lead">
          Можливо, посилання застаріло або в адресі закралася помилка.
        </p>
        <p>
          Якщо ви прийшли з допису в Telegram — можливість могли вже закрити.
          Схожі програми майже напевно є в каталозі.
        </p>
        <ul>
          <li><Link href="/">Усі можливості</Link> — каталог із фільтрами за віком і регіоном</li>
          <li><Link href="/pidbirka">Персональна підбірка</Link> — надсилаємо те, що підходить саме вашій дитині</li>
          <li><Link href="/contacts">Контакти</Link> — напишіть, якщо щось не працює</li>
        </ul>
      </article>
    </div>
  );
}
