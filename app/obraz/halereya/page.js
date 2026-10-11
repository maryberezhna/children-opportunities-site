import '@/app/styles/obraz.css';
import Link from 'next/link';
import Footer from '../../Footer';
import { OBRAZ, AGE_GROUPS, ageGroup, imageUrl, caption, workPath } from '@/lib/obraz';
import { obrazDb, approvedWorks } from '@/lib/obraz-server';
import { fabricFor } from '@/lib/obraz-cover';
import Cover from '../Cover';
import { FabricDefs, Look, EXAMPLE_LOOKS } from '../Looks';

// Архів обкладинок челенджу «Твій образ на обкладинці». Без лайків, коментарів
// і сортування «найкращі» — лише свіжі зверху й фільтр за віком.
export const dynamic = 'force-dynamic';

const SITE_URL = 'https://dityam.com.ua';
const URL = `${SITE_URL}/${OBRAZ.slug}/halereya`;
const TITLE = `Архів обкладинок «${OBRAZ.title}»`;
const DESCRIPTION = `Архів обкладинок челенджу Dityam.com.ua: діти ${OBRAZ.ageFrom}–${OBRAZ.ageTo} років малюють свій образ, і він стає обкладинкою модного журналу. Без переможців — обкладинку отримує кожен.`;

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
      <main className="ob ob-mag">
        <FabricDefs />
        <section className="ob-wrap ob-gallery-head">
          <p className="ob-kicker"><Link href={`/${OBRAZ.slug}`}>Челендж «{OBRAZ.title}»</Link></p>
          <h1 className="ob-mh1 ob-mh1-sm">Архів <i>обкладинок</i></h1>
          <p className="ob-text">Кожна обкладинка тут — без місць і рейтингів. На обкладинці лише імʼя та вік дизайнера.</p>
          <nav className="ob-filter" aria-label="Вік">
            <Link href={base} className={group ? '' : 'is-on'}>Усі</Link>
            {AGE_GROUPS.map((g) => (
              <Link key={g.key} href={`${base}?vik=${g.key}`} className={group?.key === g.key ? 'is-on' : ''}>{g.label}</Link>
            ))}
          </nav>
        </section>
        <section className="ob-wrap">
          {failed ? <p className="ob-text">Галерея тимчасово не відкрилась. Онови сторінку за хвилину.</p> : null}
          {!failed && !works.length && !group ? (
            <>
              <div className="ob-covers">
                {EXAMPLE_LOOKS.map((ex) => (
                  <Cover key={ex.key} fabric={ex.fabric} title={ex.title} example><Look look={ex.key} className="cv-look" /></Cover>
                ))}
              </div>
              <div className="ob-empty">
                <p className="ob-text">Це приклади від команди Dityam.com.ua. Перші справжні обкладинки зʼявляться тут зовсім скоро.</p>
                <Link href={`/${OBRAZ.slug}#uchast`} className="ob-btn ob-btn-dark">Хочу на обкладинку</Link>
              </div>
            </>
          ) : null}
          {!failed && !works.length && group ? <p className="ob-text">Обкладинок у цій віковій групі ще немає.</p> : null}
          <div className="ob-covers">
            {works.map((w) => (
              <Link key={w.public_id} href={workPath(w.public_id)} className="ob-cover-link" aria-label={`Обкладинка «${w.title}», ${caption(w)}`}>
                <Cover fabric={fabricFor(w.public_id, w.fabric)} title={w.title} name={w.child_name} age={w.age} designerWord={w.designer_word}>
                  <img src={imageUrl(w.image_path)} alt="" loading="lazy" />
                </Cover>
                {w.award ? <span className="ob-cover-award">⭐ {w.award}</span> : null}
              </Link>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
