import '@/app/styles/obraz.css';
import { validToken, imageUrl } from '@/lib/obraz';
import { fabricFor } from '@/lib/obraz-cover';
import { obrazDb, entryByToken } from '@/lib/obraz-server';
import Cover from '../Cover';
import PrintButton from '../sertyfikat/PrintButton';

// Обкладинка для друку (А4, книжкова) — посилання з листа після публікації.
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Обкладинка для друку', robots: { index: false, follow: false } };

export default async function CoverPrintPage({ searchParams }) {
  const t = searchParams?.t;
  const db = validToken(t) ? obrazDb() : null;
  const w = db ? await entryByToken(db, t).catch(() => null) : null;
  if (!w || w.status !== 'approved') {
    return <main className="ob"><section className="ob-wrap ob-empty"><p className="ob-form-title">Обкладинка ще не готова</p><p className="ob-text">Щойно ми її опублікуємо, вона відкриється за цим посиланням.</p></section></main>;
  }
  return (
    <main className="ob ob-print-page">
      <div className="ob-print-a4">
        <Cover fabric={fabricFor(w.public_id, w.fabric)} title={w.title} name={w.child_name} age={w.age} designerWord={w.designer_word}>
          <img src={imageUrl(w.image_path)} alt={`Малюнок «${w.title}»`} />
        </Cover>
      </div>
      <p className="ob-noprint"><PrintButton /></p>
    </main>
  );
}
