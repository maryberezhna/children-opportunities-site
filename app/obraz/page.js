import '@/app/styles/obraz.css';
import Link from 'next/link';
import Footer from '../Footer';
import { TELEGRAM_URL } from '@/lib/social';
import { kyivToday } from '@/lib/dates';
import { OBRAZ, themeOpen, imageUrl, caption, workPath } from '@/lib/obraz';
import { obrazDb, approvedWorks } from '@/lib/obraz-server';
import ObrazForm from './ObrazForm';

// Сторінка челенджу «Намалюй свій образ» (11.10.2026): тема, як узяти участь,
// що отримує кожен, правила безпеки, форма і свіжі малюнки з галереї.
// Логіка й рішення Марії — у lib/obraz.js.

export const dynamic = 'force-dynamic';

const SITE_URL = 'https://dityam.com.ua';
const URL = `${SITE_URL}/${OBRAZ.slug}`;
const TITLE = `${OBRAZ.title}: онлайн-челендж для дітей ${OBRAZ.ageFrom}–${OBRAZ.ageTo} років`;
const DESCRIPTION = `Безкоштовний онлайн-челендж Dityam.com.ua: дитина малює свій образ, а малюнок зʼявляється в онлайн-галереї. Без переможців — сертифікат кожному, відзнаки замість місць. Тема: «${OBRAZ.theme.title}».`;

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: URL },
  openGraph: { title: TITLE, description: DESCRIPTION, url: URL, type: 'website', locale: 'uk_UA', siteName: 'Dityam.com.ua' },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
};

const MONTHS = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
const dayMonth = (iso) => { const [, m, d] = iso.split('-').map(Number); return `${d} ${MONTHS[m - 1]}`; };

export default async function ObrazPage() {
  const open = themeOpen(kyivToday());
  const db = obrazDb();
  // Галерея на сторінці — приємний бонус: збій бази форму не ховає.
  let works = [];
  if (db) works = await approvedWorks(db, { limit: 8 }).catch(() => []);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: `${OBRAZ.title}: ${OBRAZ.theme.title}`,
    description: DESCRIPTION,
    url: URL,
    eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    endDate: OBRAZ.theme.until,
    isAccessibleForFree: true,
    typicalAgeRange: `${OBRAZ.ageFrom}-${OBRAZ.ageTo}`,
    location: { '@type': 'VirtualLocation', url: URL },
    organizer: { '@type': 'Organization', name: 'Dityam.com.ua', url: SITE_URL },
  };

  return (
    <>
      <main className="ob">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <section className="ob-hero">
          <div className="ob-wrap">
            <p className="ob-kicker">Онлайн-челендж Dityam.com.ua · {OBRAZ.ageFrom}–{OBRAZ.ageTo} років · безкоштовно</p>
            <h1 className="ob-h1">{OBRAZ.title}</h1>
            <p className="ob-lead">
              Дитина малює одяг, у якому їй було б найкраще, — а ми вішаємо малюнок в онлайн-галерею.
              Тут немає переможців і тих, хто програв: <b>кожен малюнок помітять</b>.
            </p>
            <div className="ob-actions">
              <a href="#uchast" className="ob-btn ob-btn-main">{open ? 'Надіслати малюнок' : 'Подивитися галерею'}</a>
              <Link href={`/${OBRAZ.slug}/halereya`} className="ob-btn ob-btn-ghost">Галерея</Link>
            </div>
          </div>
        </section>

        <section className="ob-wrap">
          <div className="ob-theme">
          <p className="ob-eyebrow">Тема {open ? `· до ${dayMonth(OBRAZ.theme.until)} включно` : '· прийом завершено'}</p>
          <h2 className="ob-h2">«{OBRAZ.theme.title}»</h2>
          <p className="ob-text">{OBRAZ.theme.task}</p>
          </div>
        </section>

        <section className="ob-wrap">
          <h2 className="ob-h2">Як узяти участь</h2>
          <ol className="ob-steps">
            <li><b>Намалюй свій образ</b> — олівцями, фарбами, фломастерами чи на планшеті.</li>
            <li><b>Сфотографуйте малюнок</b> — лише малюнок, без людей і документів у кадрі.</li>
            <li><b>Батьки надсилають</b> його через форму нижче: імʼя, вік і назва образу.</li>
            <li><b>За 1–2 дні</b> малюнок зʼявиться в галереї, а на пошту прийде лист із посиланням і сертифікатом.</li>
          </ol>
        </section>

        <section className="ob-wrap">
          <h2 className="ob-h2">Що отримує кожен</h2>
          <div className="ob-cards">
            <div className="ob-card"><span className="ob-card-icon" aria-hidden="true">🖼</span><b>Місце в галереї</b><span>Свою сторінку з малюнком — нею можна поділитися з рідними.</span></div>
            <div className="ob-card"><span className="ob-card-icon" aria-hidden="true">📜</span><b>Сертифікат участі</b><span>Можна роздрукувати чи зберегти.</span></div>
            <div className="ob-card"><span className="ob-card-icon" aria-hidden="true">⭐</span><b>Шанс на відзнаку</b><span>Не місця, а відзнаки: «найсміливіше поєднання», «найкраща історія» — їх буде багато.</span></div>
          </div>
        </section>

        <section className="ob-wrap ob-safe">
          <h2 className="ob-h2">Безпека дитини — передусім</h2>
          <div className="ob-safe-grid">
            <div>
              <p className="ob-safe-head">Під малюнком на сайті</p>
              <ul><li>імʼя дитини, без прізвища</li><li>вік</li><li>назва образу й кілька слів дитини</li></ul>
            </div>
            <div>
              <p className="ob-safe-head">Ніколи не показуємо</p>
              <ul><li>прізвище, місто, школу, email</li><li>фото дитини — лише малюнок</li><li>лайки й коментарі — щоб не було рейтингу</li></ul>
            </div>
          </div>
          <p className="ob-text ob-small">
            Кожен малюнок ми переглядаємо, перш ніж опублікувати. Приховані дані з фото (зокрема координати місця зйомки) видаляємо автоматично.
            Прибрати малюнок з галереї можна будь-коли — за посиланням з листа.
          </p>
        </section>

        <section className="ob-wrap" id="uchast">
          <h2 className="ob-h2">Надіслати малюнок</h2>
          <ObrazForm open={open} channelUrl={TELEGRAM_URL} />
        </section>

        {works.length ? (
          <section className="ob-wrap">
            <h2 className="ob-h2">Свіжі малюнки</h2>
            <div className="ob-grid">
              {works.map((w) => (
                <Link key={w.public_id} href={workPath(w.public_id)} className="ob-tile">
                  <img src={imageUrl(w.image_path)} alt={`Малюнок «${w.title}»`} loading="lazy" />
                  <span className="ob-tile-cap"><b>{w.title}</b>{caption(w)}</span>
                </Link>
              ))}
            </div>
            <p><Link href={`/${OBRAZ.slug}/halereya`} className="ob-link">Уся галерея →</Link></p>
          </section>
        ) : null}
      </main>
      <Footer />
    </>
  );
}
