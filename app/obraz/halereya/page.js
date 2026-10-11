import '@/app/styles/obraz.css';
import Link from 'next/link';
import Footer from '../../Footer';
import { OBRAZ, AGE_GROUPS, ageGroup, imageUrl, caption, workPath } from '@/lib/obraz';
import { obrazDb, approvedWorks } from '@/lib/obraz-server';

// Онлайн-галерея челенджу «Намалюй свій образ». Без лайків, коментарів і
// сортування «найкращі» — лише свіжі зверху й фільтр за віком.
export const dynamic = 'force-dynamic';

const SITE_URL = 'https://dityam.com.ua';
const URL = `${SITE_URL}/${OBRAZ.slug}/halereya`;
const TITLE = `Галерея дитячих малюнків «${OBRAZ.title}»`;
const DESCRIPTION = `Онлайн-галерея челенджу Dityam.com.ua: діти ${OBRAZ.ageFrom}–${OBRAZ.ageTo} років малюють свій образ. Без переможців — кожен малюнок у галереї.`;

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: URL },
  openGraph: { title: TITLE, description: DESCRIPTION, url: URL, type: 'website', locale: 'uk_UA', siteName: 'Dityam.com.ua' },
};

export default async function GalleryPage({ searchParams }) {
  const group = ageGroup(searchParams?.vik);
  const db = obrazDb();
  let works = [];
  let failed = !db;
  if (db) {
    try { works = await approvedWorks(db, { from: group?.from, to: group?.to }); } catch { failed = true; }
  }
  const base = `/${OBRAZ.slug}/halereya`;
  return (
    <>
      <main className="ob">
        <section className="ob-wrap ob-gallery-head">
          <p className="ob-kicker"><Link href={`/${OBRAZ.slug}`}>Челендж «{OBRAZ.title}»</Link></p>
          <h1 className="ob-h1 ob-h1-sm">Галерея</h1>
          <p className="ob-text">Кожен малюнок тут — без місць і рейтингів. Під малюнком лише імʼя та вік автора.</p>
          <nav className="ob-filter" aria-label="Вік">
            <Link href={base} className={group ? '' : 'is-on'}>Усі</Link>
            {AGE_GROUPS.map((g) => (
              <Link key={g.key} href={`${base}?vik=${g.key}`} className={group?.key === g.key ? 'is-on' : ''}>{g.label}</Link>
            ))}
          </nav>
        </section>
        <section className="ob-wrap">
          {failed ? <p className="ob-text">Галерея тимчасово не відкрилась. Онови сторінку за хвилину.</p> : null}
          {!failed && !works.length ? (
            <div className="ob-empty">
              <p className="ob-form-title">Тут скоро зʼявляться перші малюнки</p>
              <p><Link href={`/${OBRAZ.slug}#uchast`} className="ob-btn ob-btn-main">Надіслати свій</Link></p>
            </div>
          ) : null}
          <div className="ob-grid">
            {works.map((w) => (
              <Link key={w.public_id} href={workPath(w.public_id)} className="ob-tile">
                <img src={imageUrl(w.image_path)} alt={`Малюнок «${w.title}»`} loading="lazy" />
                <span className="ob-tile-cap"><b>{w.title}</b>{caption(w)}{w.award ? <em>⭐ {w.award}</em> : null}</span>
              </Link>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
