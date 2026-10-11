import '@/app/styles/obraz.css';
import { OBRAZ, validToken, imageUrl } from '@/lib/obraz';
import { obrazDb, entryByToken } from '@/lib/obraz-server';
import PrintButton from './PrintButton';

// Сертифікат участі — посилання з листа «малюнок уже в галереї». Відкривається
// за секретним токеном, роздруковується з браузера (A4 альбомно).
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Сертифікат участі', robots: { index: false, follow: false } };

const MONTHS = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
const longDate = (iso) => {
  const d = new Date(new Date(iso).toLocaleString('en-US', { timeZone: 'Europe/Kyiv' }));
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()} року`;
};

export default async function CertificatePage({ searchParams }) {
  const t = searchParams?.t;
  const db = validToken(t) ? obrazDb() : null;
  const w = db ? await entryByToken(db, t).catch(() => null) : null;
  if (!w || w.status !== 'approved') {
    return (
      <main className="ob"><section className="ob-wrap ob-empty">
        <p className="ob-form-title">{w && w.status === 'pending' ? 'Малюнок ще на перевірці' : 'Сертифікат не знайдено'}</p>
        <p className="ob-text">{w && w.status === 'pending' ? 'Щойно він зʼявиться в галереї, сертифікат відкриється за цим самим посиланням.' : 'Перевірте посилання з листа.'}</p>
      </section></main>
    );
  }
  return (
    <main className="ob ob-cert-page">
      <div className="ob-cert">
        <p className="ob-cert-brand">dityam.com.ua</p>
        <p className="ob-cert-kind">Сертифікат юного дизайнера</p>
        <p className="ob-cert-name">{w.child_name}</p>
        <p className="ob-cert-text">за участь в онлайн-челенджі «{OBRAZ.title}»<br />з образом «{w.title}» · {OBRAZ.season}</p>
        {w.award ? <p className="ob-cert-award">⭐ Відзнака «{w.award}»</p> : null}
        <img className="ob-cert-img" src={imageUrl(w.image_path)} alt="" />
        <div className="ob-cert-foot">
          <span>{longDate(w.reviewed_at || w.created_at)}</span>
          <span>Марія Шутяк, засновниця Dityam.com.ua</span>
        </div>
      </div>
      <p className="ob-noprint"><PrintButton /></p>
    </main>
  );
}
