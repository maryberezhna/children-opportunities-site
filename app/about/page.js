import Link from 'next/link';
import Footer from '../Footer';
import PressLogos from '../PressLogos';
import { pressStats } from '@/lib/press';

export const metadata = {
  title: 'Про проєкт — Dityam.com.ua',
  description: 'Dityam.com.ua — платформа перевірених можливостей для українських дітей 0–18 років, в Україні та за кордоном. Безкоштовно для родини й без реєстрації. Засновниця — Марія Шутяк.',
  alternates: {
    canonical: 'https://dityam.com.ua/about',
    // Взаємність обовʼязкова: односторонню анотацію Google ігнорує.
    languages: { uk: 'https://dityam.com.ua/about', en: 'https://dityam.com.ua/en/about' },
  },
};

// Цифри живі, як на сторінці для медіа: застарілі числа в тексті рано чи
// пізно стають помилкою в чужій публікації.
export const revalidate = 3600;

const EMAIL = 'hellodityam.com.ua@gmail.com';

// 1 джерело · 2 джерела · 5 джерел; 11–14 — завжди третя форма.
function plural(n, one, few, many) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

export default async function AboutPage() {
  const stats = await pressStats();
  const tiles = stats ? [
    [stats.total, plural(stats.total, 'можливість на платформі', 'можливості на платформі', 'можливостей на платформі')],
    [stats.free, plural(stats.free, 'безкоштовна для родини', 'безкоштовні для родини', 'безкоштовних для родини')],
    [stats.sources, plural(stats.sources, 'офіційне джерело', 'офіційні джерела', 'офіційних джерел')],
    [stats.cities, plural(stats.cities, 'місто чи регіон', 'міста й регіони', 'міст і регіонів')],
  ] : [];

  return (
    <div className="v2-page">
      <main className="v2-container ab-page">
        <section className="v2-hero pk-hero">
          <div className="v2-hero-copy">
            <div className="v2-hero-status">
              <span className="v2-dot" aria-hidden="true" />
              Про проєкт
            </div>
            <h1>
              Кожна дитина має знати про свої <span className="v2-script">можливості</span>
            </h1>
            <p className="v2-hero-sub">
              Dityam.com.ua — платформа перевірених можливостей для українських дітей
              0–18 років. Курси, олімпіади, табори, стипендії, гуртки, медична
              й психологічна допомога, державні виплати — в одному місці,
              перевірені й оновлені щодня. Безкоштовно для родини й без реєстрації.
            </p>
            <div className="pk-actions">
              <Link href="/" className="v2-btn-dark">Дивитися можливості</Link>
              <a href={`mailto:${EMAIL}`} className="v2-btn-outline">Написати нам</a>
            </div>
          </div>
        </section>

        {tiles.length ? (
          <section className="ab-section" aria-label="Цифри проєкту">
            <div className="pk-stats ab-stats">
              {tiles.map(([num, label]) => (
                <div className="pk-stat" key={label}>
                  <span className="pk-stat-num">{num.toLocaleString('uk-UA')}</span>
                  <span className="pk-stat-label">{label}</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="ab-story" aria-labelledby="ab-why">
          <h2 id="ab-why">Чому я це роблю</h2>
          <div className="ab-story-text">
            <p>
              Я Марія Шутяк. Вірю, що кожна українська дитина має знати про свої
              можливості — від безкоштовного гуртка у своєму місті до стипендії
              за кордон.
            </p>
            <p>
              Але можливості розкидані по сотнях сайтів і каналів, написані мовою
              заявок, а не людей, і доходять до тих родин, у яких є час, швидкий
              інтернет і потрібні контакти. Через це виграє не та дитина, якій
              потрібніше, а та, чиї батьки встигли знайти.
            </p>
            <p className="ab-signature">
              <span className="v2-script">Марія</span>Шутяк, засновниця Dityam.com.ua
            </p>
          </div>
        </section>

        <section className="ab-section" aria-labelledby="ab-mission">
          <h2 id="ab-mission">Що ми робимо для родини</h2>
          <p className="ab-intro">
            Наша місія — щоб доступ дитини до розвитку не залежав від міста,
            статків і того, чи вміють батьки шукати. Знайти можливість — лише
            перший крок, і ми йдемо з родиною далі.
          </p>
          <ol className="ab-cards">
            <li className="ab-card">
              <span className="ab-card-n">01</span>
              <h3>Показати, що існує</h3>
              <p>Одне місце замість сотні джерел — з фільтрами за віком, містом, вартістю й дедлайном.</p>
            </li>
            <li className="ab-card">
              <span className="ab-card-n">02</span>
              <h3>Допомогти обрати своє</h3>
              <p>Не список із сотень карток, а те, що підходить конкретній дитині — за віком, інтересами й станом родини.</p>
            </li>
            <li className="ab-card">
              <span className="ab-card-n">03</span>
              <h3>Не дати пропустити</h3>
              <p>Дедлайни спливають тихо. Нагадуємо завчасно, поки ще можна встигнути подати.</p>
            </li>
            <li className="ab-card">
              <span className="ab-card-n">04</span>
              <h3>Підтримати далі</h3>
              <p>Розвиток дитини — не разове заняття. І батькам поруч теж потрібна опора: як обирати й як говорити про це з дитиною.</p>
            </li>
          </ol>
        </section>

        <section className="ab-section ab-focus" aria-labelledby="ab-focus">
          <h2 id="ab-focus">Окрема увага — родинам, яким найважче</h2>
          <p className="ab-intro">
            Для дітей ВПО, дітей захисників і захисниць, дітей з інвалідністю,
            онкохворих дітей і сиріт держава й фонди мають окремі програми, але
            шукати їх доводиться там само, де й усім. У нас це окремий фільтр
            «Особлива потреба», а для дітей захисників і захисниць — окрема{' '}
            <Link href="/dity-zakhysnykiv">підбірка</Link>.
          </p>
        </section>

        <section className="ab-section" aria-labelledby="ab-checks">
          <h2 id="ab-checks">Як ми перевіряємо програми</h2>
          <ul className="ab-checks">
            <li>Кожна можливість має посилання на офіційне джерело</li>
            <li>Щодня перевіряємо, чи живі посилання: мертве три дні поспіль — запис закривається</li>
            <li>Коли дедлайн минає, запис зникає зі списків, а його сторінка лишається з позначкою «завершилась»</li>
            <li>Можливості без дедлайну регулярно перечитуємо — чи набір ще триває</li>
            <li>Платні програми позначаємо платними, а безкоштовні можна відфільтрувати окремо</li>
          </ul>
          <p className="ab-more"><Link href="/yak-my-pereviriaiemo">Докладно — як ми перевіряємо →</Link></p>
        </section>

        <section className="ab-section" aria-labelledby="ab-press">
          <h2 id="ab-press">Про нас пишуть</h2>
          <PressLogos />
          <p className="ab-more">
            <Link href="/press">Усі публікації й матеріали для журналістів →</Link>
          </p>
        </section>

        <section className="v2-bottom">
          <div className="v2-panel">
            <h2>Долучитися</h2>
            <p>
              Знаєте програму, якої тут немає? Помітили помилку? Напишіть —
              перевіримо й виправимо.
            </p>
            <div className="v2-panel-actions">
              <a href={`mailto:${EMAIL}`} className="v2-btn-dark">{EMAIL}</a>
              <a href="https://www.instagram.com/dityam.com.ua" target="_blank" rel="noopener noreferrer" className="v2-btn-outline">Instagram</a>
            </div>
          </div>
          <div className="v2-panel">
            <h2>Підтримати</h2>
            <p>
              Платформа безкоштовна для родин — назавжди. Розвиватися
              їй допомагає підписка Dityam+ (зараз відкритий список очікування),
              а донат — додавати нові джерела й утримувати домен і хостинг.
            </p>
            <div className="v2-panel-actions">
              <Link href="/plus" className="v2-btn-dark">Dityam+</Link>
              <a href="https://send.monobank.ua/jar/F72fDrV2c" target="_blank" rel="noopener noreferrer" className="v2-btn-outline">Донат на monobank</a>
            </div>
          </div>
        </section>

        <p className="ab-partners">
          Сайт розроблено за технологічної підтримки{' '}
          <a href="https://dot-hub.club/" target="_blank" rel="noopener noreferrer">.HUB</a>{' '}
          (HubSpot Partner).
        </p>
      </main>
      <Footer />
    </div>
  );
}
