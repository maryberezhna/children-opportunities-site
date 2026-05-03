import Link from 'next/link';

export const metadata = {
  title: 'Політика конфіденційності',
  description: 'Як dityam.com.ua обробляє ваші дані: аналітика, підписка, файли cookie, права користувача.',
  alternates: { canonical: 'https://dityam.com.ua/privacy' },
  robots: { index: true, follow: true },
};

const UPDATED = '3 травня 2026';

export default function PrivacyPage() {
  return (
    <div className="container">
      <nav className="opportunity-breadcrumbs">
        <Link href="/">← Усі можливості</Link>
      </nav>
      <article className="legal-page">
        <h1>Політика конфіденційності</h1>
        <p className="meta-line">Останнє оновлення: {UPDATED}</p>

        <h2>1. Хто ми</h2>
        <p>
          Сайт dityam.com.ua (далі — «Сайт») є некомерційним каталогом
          можливостей для дітей в Україні. Власник і адміністратор —
          Марія Бережна, контакт:{' '}
          <a href="mailto:maryberezhna@gmail.com">maryberezhna@gmail.com</a>.
        </p>

        <h2>2. Які дані ми збираємо</h2>
        <ul>
          <li>
            <strong>Аналітика (Google Analytics 4, Hotjar):</strong> анонімізована
            IP-адреса, тип пристрою, браузер, мова, шлях по сайту, тривалість
            сесії, події кліків. Дані використовуються для покращення сайту.
          </li>
          <li>
            <strong>Підписка на розсилку:</strong> якщо ви заповните форму
            підписки, ми зберігаємо вашу email-адресу в HubSpot з метою
            розсилки оновлень. Ви можете відписатись у будь-який момент через
            посилання у листі.
          </li>
          <li>
            <strong>Звернення на email:</strong> якщо ви напишете нам,
            зберігається ваша email-адреса і зміст листа в межах нашого
            поштового ящика.
          </li>
        </ul>

        <h2>3. Файли cookie</h2>
        <p>
          Ми використовуємо технічні cookie (для роботи сайту) та аналітичні
          cookie (Google Analytics, Hotjar). Ви можете заблокувати їх у
          налаштуваннях браузера — це не вплине на функціонал каталогу.
        </p>

        <h2>4. Передача даних третім сторонам</h2>
        <ul>
          <li>Google (Analytics) — оброблення відповідно до{' '}
            <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy Google</a>.
          </li>
          <li>Hotjar — оброблення відповідно до{' '}
            <a href="https://www.hotjar.com/legal/policies/privacy/" target="_blank" rel="noopener noreferrer">Privacy Policy Hotjar</a>.
          </li>
          <li>HubSpot (підписка) — оброблення відповідно до{' '}
            <a href="https://legal.hubspot.com/privacy-policy" target="_blank" rel="noopener noreferrer">Privacy Policy HubSpot</a>.
          </li>
          <li>Vercel (хостинг) — оброблення відповідно до{' '}
            <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">Privacy Policy Vercel</a>.
          </li>
          <li>Supabase (база даних) — оброблення відповідно до{' '}
            <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy Supabase</a>.
          </li>
        </ul>
        <p>Ми не продаємо і не передаємо ваші дані рекламним мережам.</p>

        <h2>5. Ваші права</h2>
        <p>
          Згідно з законодавством України про захист персональних даних та GDPR
          (для користувачів з ЄС) ви маєте право:
        </p>
        <ul>
          <li>отримати доступ до своїх даних, що зберігаються;</li>
          <li>вимагати виправлення або видалення даних;</li>
          <li>відкликати згоду на обробку у будь-який момент;</li>
          <li>подати скаргу до Уповноваженого з прав людини.</li>
        </ul>
        <p>
          Для реалізації прав напишіть{' '}
          <a href="mailto:maryberezhna@gmail.com">maryberezhna@gmail.com</a>.
        </p>

        <h2>6. Зміни до політики</h2>
        <p>
          Ми можемо оновлювати цю політику. Дата останнього оновлення вказана
          вгорі цієї сторінки.
        </p>
      </article>
    </div>
  );
}
