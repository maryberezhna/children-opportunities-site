import '@/app/styles/obraz.css';
import Link from 'next/link';
import Footer from '../../Footer';
import { OBRAZ, validToken, imageUrl, workPath, coverPrintPath, certificatePath } from '@/lib/obraz';
import { fabricFor } from '@/lib/obraz-cover';
import { obrazDb, entryByToken, syncPayment } from '@/lib/obraz-server';
import Cover from '../Cover';
import PayButton from './PayButton';
import PhotoReplace from './PhotoReplace';

// Сторінка заявки (посилання — секретний токен): превʼю обкладинки з
// іменем дитини й оплата оргвнеску; після оплати — «на перевірці»; якщо
// фото не підійшло — нове фото без доплати; після публікації — посилання.
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Твоя обкладинка', robots: { index: false, follow: false } };

export default async function EntryPage({ searchParams }) {
  const t = searchParams?.t;
  const db = validToken(t) ? obrazDb() : null;
  let w = db ? await entryByToken(db, t).catch(() => null) : null;
  // Людина повернулась з оплати раніше за колбек — звіряємо з WayForPay.
  if (db && w && !w.paid_at && w.wfp_order_reference) w = await syncPayment(db, w).catch(() => w);

  if (!w || w.status === 'removed') {
    return (
      <main className="ob"><section className="ob-wrap ob-empty">
        <p className="ob-form-title">{w ? 'Малюнок прибрано з галереї' : 'Заявку не знайдено'}</p>
        <p className="ob-text">{w ? 'Якщо це помилка, напишіть нам: hellodityam.com.ua@gmail.com' : 'Перевірте посилання з листа.'}</p>
        <Link href={`/${OBRAZ.slug}`} className="ob-btn ob-btn-main">До челенджу</Link>
      </section></main>
    );
  }

  const cover = (
    <Cover fabric={fabricFor(w.public_id, w.fabric)} title={w.title} name={w.child_name} age={w.age}
      designerWord={w.designer_word} preview={!w.paid_at} className="cv-lg">
      {w.status !== 'reupload' ? <img src={imageUrl(w.image_path)} alt={`Малюнок «${w.title}»`} /> : <span className="cv-empty">тут буде новий малюнок</span>}
    </Cover>
  );

  return (
    <>
      <main className="ob ob-mag">
        <section className="ob-wrap ob-entry">
          <div className="ob-entry-cover">{cover}</div>
          <div className="ob-entry-side">
            {!w.paid_at && w.status === 'unpaid' ? (
              <>
                <p className="ob-kicker">Крок 2 з 2</p>
                <h1 className="ob-h1 ob-h1-sm">Ось твоя обкладинка!</h1>
                <p className="ob-text">Після оплати оргвнеску ми переглянемо малюнок і поставимо обкладинку в галерею челенджу «{OBRAZ.title}». На пошту прийде обкладинка для друку А4 і сертифікат.</p>
                <PayButton t={w.token} price={Number(w.amount) || OBRAZ.price} />
                <p className="ob-small">Якщо фото не підійде (на ньому видно людину чи документ), ми попросимо інше — без доплати.</p>
                <PhotoReplace t={w.token} label="Замінити фото" />
              </>
            ) : null}
            {w.status === 'pending' ? (
              <>
                <p className="ob-kicker">Оплачено ✓</p>
                <h1 className="ob-h1 ob-h1-sm">Обкладинка на перевірці</h1>
                <p className="ob-text">Дякуємо! Ми переглянемо малюнок протягом 1–2 днів. Щойно обкладинка зʼявиться в галереї, на пошту прийде лист із посиланням, обкладинкою для друку й сертифікатом.</p>
              </>
            ) : null}
            {w.status === 'reupload' ? (
              <>
                <p className="ob-kicker">Потрібне інше фото</p>
                <h1 className="ob-h1 ob-h1-sm">Надішліть, будь ласка, інше фото</h1>
                <p className="ob-text">Цей знімок ми не можемо поставити на обкладинку: найчастіше на ньому видно людину, документ чи інші особисті дані. Сфотографуйте лише сам малюнок — <b>оплачувати вдруге не потрібно</b>.</p>
                <PhotoReplace t={w.token} />
              </>
            ) : null}
            {w.status === 'approved' ? (
              <>
                <p className="ob-kicker">Опубліковано ✓</p>
                <h1 className="ob-h1 ob-h1-sm">Обкладинка в галереї!</h1>
                {w.award ? <p className="ob-award">⭐ Відзнака «{w.award}»</p> : null}
                <div className="ob-actions">
                  <Link href={workPath(w.public_id)} className="ob-btn ob-btn-main">Сторінка обкладинки</Link>
                  <Link href={coverPrintPath(w.token)} className="ob-btn ob-btn-ghost">Друк А4</Link>
                  <Link href={certificatePath(w.token)} className="ob-btn ob-btn-ghost">Сертифікат</Link>
                </div>
              </>
            ) : null}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
