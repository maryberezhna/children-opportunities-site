import Link from 'next/link';

export const metadata = {
  title: 'Немає звʼязку — dityam.com.ua',
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <div className="container">
      <article className="legal-page">
        <h1>Немає інтернету</h1>
        <p className="lead">
          Ця сторінка ще не завантажувалась, тож показати її offline не вийде.
        </p>
        <p>
          Сторінки, які ви вже відкривали, доступні і без звʼязку — спробуйте
          повернутись назад. Щойно інтернет зʼявиться, все запрацює як звичайно.
        </p>
        <p>
          <Link href="/">← До каталогу можливостей</Link>
        </p>
      </article>
    </div>
  );
}
