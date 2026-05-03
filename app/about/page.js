import Link from 'next/link';

export const metadata = {
  title: 'Про проєкт — як народився dityam.com.ua',
  description: 'Каталог можливостей для дітей 0-18 років в Україні. Безкоштовно, без реклами, з ентузіазму. Команда, мета і як долучитися.',
  alternates: { canonical: 'https://dityam.com.ua/about' },
};

export default function AboutPage() {
  return (
    <div className="container">
      <nav className="opportunity-breadcrumbs">
        <Link href="/">← Усі можливості</Link>
      </nav>
      <article className="legal-page">
        <h1>Про проєкт</h1>

        <p className="lead">
          dityam.com.ua — це каталог перевірених можливостей для українських
          дітей віком 0-18 років. Курси, олімпіади, табори, стипендії, медична
          допомога, виплати ВПО — все в одному місці, безкоштовно і без реклами.
        </p>

        <h2>Чому ми</h2>
        <p>
          Я Маша Бережна. Вірю, що кожна дитина в Україні має знати про свої
          можливості — від безкоштовного гуртка у своєму місті до стипендії за
          кордон. Інформація про програми розкидана по десятках сайтів,
          написана складною мовою, а батькам нема часу шукати. Цей сайт — спроба
          зібрати все в один зрозумілий каталог.
        </p>

        <h2>Як ми перевіряємо програми</h2>
        <ul>
          <li>Кожна можливість має офіційне джерело-посилання</li>
          <li>Перевіряємо актуальність дедлайнів щотижня</li>
          <li>Додаємо тільки безкоштовні або доступні програми</li>
          <li>Прострочені одноразові події автоматично приховуються</li>
        </ul>

        <h2>Як долучитися</h2>
        <p>
          Знаєте програму, якої тут немає? Помітили помилку?
          {' '}<a href="mailto:maryberezhna@gmail.com">Напишіть нам</a>{' '}
          або{' '}<a href="https://www.instagram.com/dityam.com.ua" target="_blank" rel="noopener noreferrer">в Instagram</a>.
        </p>

        <h2>Підтримати</h2>
        <p>
          Сайт створений на ентузіазмі, без реклами і без монетизації. Якщо маєте
          змогу підтримати — донат на{' '}
          <a href="https://send.monobank.ua/jar/F72fDrV2c" target="_blank" rel="noopener noreferrer">monobank-банку</a>{' '}
          або{' '}
          <a href="https://base.monobank.ua/5QKZeVxPVjZEx7" target="_blank" rel="noopener noreferrer">Підписку Base</a>{' '}
          допомагає додавати нові програми, утримувати домен і хостинг,
          і залишатися незалежними.
        </p>

        <h2>Партнери</h2>
        <p>
          Сайт розроблено за технологічної підтримки{' '}
          <a href="https://dot-hub.club/" target="_blank" rel="noopener noreferrer">.HUB</a>{' '}
          (HubSpot Partner).
        </p>
      </article>
    </div>
  );
}
