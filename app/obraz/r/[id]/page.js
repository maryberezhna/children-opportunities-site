import '@/app/styles/obraz.css';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Footer from '../../../Footer';
import { OBRAZ, validPublicId, imageUrl, caption, workPath } from '@/lib/obraz';
import { obrazDb, workByPublicId } from '@/lib/obraz-server';
import ShareWork from './ShareWork';

// Сторінка одного малюнка — нею батьки діляться з рідними («мою дитину
// помітили»). Превʼю в месенджерах — сам малюнок. Пошуковикам ці сторінки не
// віддаємо (noindex): імена дітей у Google не потрібні; індексується галерея.
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
  const title = `«${w.title}» — ${caption(w)}`;
  const description = `Малюнок у галереї челенджу «${OBRAZ.title}» на Dityam.com.ua.`;
  const img = imageUrl(w.image_path);
  return {
    title,
    description,
    robots: { index: false, follow: true },
    openGraph: { title, description, url: `https://dityam.com.ua${workPath(w.public_id)}`, images: img ? [{ url: img }] : undefined, locale: 'uk_UA', siteName: 'Dityam.com.ua' },
    twitter: { card: 'summary_large_image', title, description, images: img ? [img] : undefined },
  };
}

export default async function WorkPage({ params }) {
  const w = await load(params.id);
  if (!w) notFound();
  return (
    <>
      <main className="ob">
        <section className="ob-wrap ob-work">
          <p className="ob-kicker"><Link href={`/${OBRAZ.slug}/halereya`}>← Галерея «{OBRAZ.title}»</Link></p>
          <figure className="ob-work-fig">
            <img src={imageUrl(w.image_path)} alt={`Малюнок «${w.title}»`} />
          </figure>
          <h1 className="ob-h1 ob-h1-sm">{w.title}</h1>
          <p className="ob-work-who">{caption(w)}</p>
          {w.award ? <p className="ob-award">⭐ Відзнака «{w.award}»</p> : null}
          {w.story ? <p className="ob-text ob-work-story">{w.story}</p> : null}
          <ShareWork title={w.title} />
          <div className="ob-cta">
            <p className="ob-form-title">Хочеш, щоб і твій малюнок був тут?</p>
            <p className="ob-text">Онлайн-челендж «{OBRAZ.title}» для дітей {OBRAZ.ageFrom}–{OBRAZ.ageTo} років. Безкоштовно.</p>
            <Link href={`/${OBRAZ.slug}#uchast`} className="ob-btn ob-btn-main">Намалювати свій образ</Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
