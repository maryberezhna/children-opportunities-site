import '@/app/styles/modnyi-kod.css';
import Link from 'next/link';
import Footer from '../../Footer';
import { BANK } from '@/content/modnyi-kod/bank';
import { HINTS } from '@/content/modnyi-kod/hints';
import { MK, validMkToken } from '@/lib/modnyi-kod';
import { DEFS, cleanLook } from '@/lib/modnyi-kod-looks';
import { mkDb, entryByToken, syncPayment } from '@/lib/modnyi-kod-server';
import VogueCover from '../VogueCover';
import Studio from '../Studio';
import Runner from './Runner';
import RepayButton from './RepayButton';
import PrintBtn from './PrintBtn';
import Practice from './Practice';

// Кабінет учасника «Модного коду» (посилання з листа, секретний токен):
// оплата → тест 25 хв → студія образу → обкладинка з балами, розбір, сертифікат.
export const dynamic = 'force-dynamic';
export const metadata = { title: `Кабінет учасника «${MK.title}»`, robots: { index: false, follow: false } };

const wordCap = (w) => (w === 'дизайнерка' ? 'Дизайнерка' : w === 'дизайнер' ? 'Дизайнер' : '');

export default async function Cabinet({ searchParams }) {
  const t = searchParams?.t;
  const db = validMkToken(t) ? mkDb() : null;
  let row = db ? await entryByToken(db, t).catch(() => null) : null;
  if (db && row && !row.paid_at) row = await syncPayment(db, row).catch(() => row);

  const shell = (body) => (
    <>
      <main className="mk mkT mkK">
        <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" dangerouslySetInnerHTML={{ __html: `<defs>${DEFS}</defs>` }} />
        <section className="mkT-wrap mkT-sec">
          <p className="mk-kick"><Link href={`/${MK.slug}`}>{MK.title}</Link> · кабінет учасника</p>
          {body}
        </section>
      </main>
      <Footer />
    </>
  );

  if (!row) return shell(<><h1 className="mkT-hand ink">Кабінет не знайдено</h1><p className="mkT-text">Перевірте посилання з листа або напишіть нам: hellodityam.com.ua@gmail.com</p></>);
  if (row.refunded_at) return shell(<><h1 className="mkT-hand ink">Участь скасовано</h1><p className="mkT-text">Оргвнесок повернуто. Якщо це помилка — напишіть нам: hellodityam.com.ua@gmail.com</p></>);
  if (!row.paid_at) {
    return shell(<>
      <h1 className="mkT-hand ink">{row.child_name}, майже готово!</h1>
      <p className="mkT-text">Оплату ще не отримали. Якщо ви щойно оплатили — оновіть сторінку за хвилину. Якщо ні — оплатіть оргвнесок, і кабінет відкриється.</p>
      <RepayButton t={row.token} price={Number(row.amount) || MK.price} />
    </>);
  }
  if (!row.finished_at) {
    return shell(<>
      <h1 className="mkT-hand ink">{row.child_name}, вітаємо в «Модному коді»!</h1>
      <Runner token={row.token} started={Boolean(row.started_at)} minutes={MK.minutes} />
    </>);
  }
  const score = `${row.score}/${row.max_score}`;
  if (!row.look_at) {
    return shell(<>
      <h1 className="mkT-hand ink">Тест пройдено: {score}!</h1>
      <p className="mkT-text">Тепер найцікавіше — збери свій образ. Обери речі й тканини, дай образу назву — і він стане обкладинкою.</p>
      <Studio token={row.token} score={score} name={row.child_name} age={row.child_age} word={wordCap(row.designer_word)} />
    </>);
  }
  const missed = Array.isArray(row.missed_questions) ? row.missed_questions : [];
  const byId = new Map(BANK.map((q) => [q.id, q]));
  return shell(<>
    <h1 className="mkT-hand ink">{row.child_name}, твоя обкладинка готова!</h1>
    <div className="mkK-grid">
      <div className="mkK-cover"><VogueCover look={cleanLook(row.look)} theme={row.cover_theme || 'pink'} title={row.look_title} score={score} name={row.child_name} age={row.child_age} word={wordCap(row.designer_word)} /></div>
      <div>
        <p className="mkT-text">Модний код: <b>{score}</b>. Обкладинку можна роздрукувати на А4 чи зберегти PDF. Після перевірки назви ми опублікуємо її на сайті й у соцмережах Dityam.com.ua — лише з імʼям і віком.</p>
        <PrintBtn />
        <div className="mkK-cert">
          <p className="mk-kick">Сертифікат</p>
          <p className="mkK-cert-name">{row.child_name}</p>
          <p className="mkT-text">учасник(ця) онлайн-олімпіади з моди «{MK.title}» Dityam.com.ua · {MK.season} · результат {score}</p>
        </div>
      </div>
    </div>
    {row.source === 'dityam_plus' ? <section className="mkK-review"><h2 className="mkT-hand ink">Тренування</h2><Practice token={row.token} /></section> : null}
    {missed.length ? (
      <section className="mkK-review">
        <h2 className="mkT-hand ink">Що ще варто дізнатися</h2>
        <p className="mkT-text">Завдання, де відповідь не зарахована, — з підказкою, як міркувати. Готових відповідей тут немає навмисно.</p>
        {missed.map((m) => {
          const q = byId.get(m.id);
          return q ? <article key={m.id} className="mkK-miss"><b>Завдання {m.num}.</b> {q.q}<p>💡 {HINTS[m.id]}</p></article> : null;
        })}
      </section>
    ) : <p className="mkT-text">Усі 25 — правильно! Справжній модний код 🎉</p>}
  </>);
}
