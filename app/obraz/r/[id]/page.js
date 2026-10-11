import '@/app/styles/obraz.css';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Footer from '../../../Footer';
import { OBRAZ, validPublicId, imageUrl, caption, workPath } from '@/lib/obraz';
import { obrazDb, workByPublicId } from '@/lib/obraz-server';
import { fabricFor, designerLabel } from '@/lib/obraz-cover';
import Cover from '../../Cover';
import ShareWork from './ShareWork';

// Сторінка однієї обкладинки — нею батьки діляться з рідними («мою дитину
// помітили»). Превʼю в месенджерах — сама обкладинка (opengraph-image.js).
// Пошуковикам ці сторінки не віддаємо (noindex): імена дітей у Google не
// потрібні; індексується архів.
export const dynamic = 'force-dynamic';

async function load(id) {
  if (!validPublicId(id)) return null;
  const db = obrazDb();
  if (!db) return null;
  return workByPublicId(db, id).catch(() => null);
}

export async function generateMetadata({ params }) {
  const w = await load(params.id);
  if (!w) return { title: 'Малюнок не знайдено', robots: { index: false, follow: false } };
  const who = [designerLabel(w), caption(w)].filter(Boolean).join(' ');
  const title = `«${w.title}» — обкладинка, ${who}`;
  const description = `Обкладинка модного журналу dityam.com.ua з челенджу «${OBRAZ.title}».`;
  return {
    title,
    description,
    robots: { index: false, follow: true },
    openGraph: { title, description, url: `https://dityam.com.ua${workPath(w.public_id)}`, locale: 'uk_UA', siteName: 'Dityam.com.ua' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function WorkPage({ params }) {
  const w = await load(params.id);
  if (!w) notFound();
  return (
    <>
      <main className="ob ob-mag">
        <section className="ob-wrap ob-work">
          <p className="ob-kicker"><Link href={`/${OBRAZ.slug}/halereya`}>← Архів обкладинок</Link></p>
          <div className="ob-work-cover">
            <Cover fabric={fabricFor(w.public_id, w.fabric)} title={w.title} name={w.child_name} age={w.age} designerWord={w.designer_word} className="cv-lg">
              <img src={imageUrl(w.image_path)} alt={`Малюнок «${w.title}»`} />
            </Cover>
          </div>
          <h1 className="ob-mh1 ob-mh1-sm">«{w.title}»</h1>
          <p className="ob-work-who">{[designerLabel(w), caption(w)].filter(Boolean).join(' ')}</p>
          {w.award ? <p className="ob-award">⭐ Відзнака «{w.award}»</p> : null}
          {w.story ? <p className="ob-text ob-work-story">{w.story}</p> : null}
          <ShareWork title={w.title} />
          <div className="ob-cta">
            <p className="ob-form-title">Хочеш свою обкладинку?</p>
            <p className="ob-text">Онлайн-челендж «{OBRAZ.title}» для дітей {OBRAZ.ageFrom}–{OBRAZ.ageTo} років: намалюй свій образ — і він стане обкладинкою модного журналу dityam.com.ua.</p>
            <Link href={`/${OBRAZ.slug}#uchast`} className="ob-btn ob-btn-dark">Хочу на обкладинку</Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
