import '@/app/styles/modnyi-kod.css';
import Link from 'next/link';
import Footer from '../../Footer';
import { BANK } from '@/content/modnyi-kod/bank';
import { HINTS } from '@/content/modnyi-kod/hints';
import { MK, validMkToken } from '@/lib/modnyi-kod';
import { DEFS, cleanLook } from '@/lib/modnyi-kod-looks';
import { monthName } from '@/lib/olimpiada';
import { mkDb, entryByToken, syncPayment } from '@/lib/modnyi-kod-server';
import VogueCover from '../VogueCover';
import Studio from '../Studio';
import Runner from './Runner';
import PrintBtn from './PrintBtn';
import ShareCover from './ShareCover';
import { PLUS_BOT } from '@/lib/plus';
import { PRICE, PRICE_FIRST } from '@/lib/wayforpay';
import RetakeButton from './RetakeButton';

// Кабінет учасника «Модного коду» (посилання з листа, секретний токен):
// заявка → тест 30 хв → студія образу → обкладинка з балами (вона ж сертифікат), розбір.
export const dynamic = 'force-dynamic';
export const metadata = { title: `Кабінет учасника «${MK.title}»`, robots: { index: false, follow: false } };

const wordCap = (w) => (w === 'дизайнерка' ? 'Дизайнерка' : w === 'дизайнер' ? 'Дизайнер' : '');

export default async function Cabinet({ searchParams }) {
  const t = searchParams?.t;
  const db = validMkToken(t) ? mkDb() : null;
  let row = db ? await entryByToken(db, t).catch(() => null) : null;
  if (db && row && !row.paid_at) row = await syncPayment(db, row).catch(() => row);

  // narrow — тест: вузька колонка по центру й ближче до верху (Марія, 13.10.2026:
  // «чому сам тест наче зміщений вліво і по висоті»).
  const shell = (body, narrow = false) => (
    <>
      <main className="mk mkT mkK">
        <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" dangerouslySetInnerHTML={{ __html: `<defs>${DEFS}</defs>` }} />
        <section className={`mkT-wrap mkT-sec${narrow ? ' mkK-narrow' : ''}`}>
          <p className="mk-kick"><Link href={`/${MK.slug}`}>{MK.title}</Link> · кабінет учасника</p>
          {body}
        </section>
      </main>
      <Footer />
    </>
  );

  if (!row) return shell(<><h1 className="mkT-hand ink">Кабінет не знайдено</h1><p className="mkT-text">Перевірте посилання з листа або напишіть нам: hellodityam.com.ua@gmail.com</p></>);
  if (row.refunded_at) return shell(<><h1 className="mkT-hand ink">Участь скасовано</h1><p className="mkT-text">Якщо це помилка — напишіть нам: hellodityam.com.ua@gmail.com</p></>);
  // paid_at з 19.10.2026 ставиться одразу при заявці (участь безкоштовна), тож
  // сюди потрапляють хіба давні записи, створені до скасування оргвнеску.
  if (!row.paid_at) {
    return shell(<>
      <h1 className="mkT-hand ink">{row.child_name}, кабінет ще не відкрився</h1>
      <p className="mkT-text">Оновіть сторінку за хвилину. Якщо не допоможе — напишіть нам: hellodityam.com.ua@gmail.com, відкриємо вручну. Участь безкоштовна, платити не треба.</p>
    </>);
  }
  if (!row.finished_at) {
    return shell(<>
      <h1 className="mkT-hand ink">{row.child_name}, вітаємо в «Модному коді»!</h1>
      <Runner token={row.token} started={Boolean(row.started_at)} minutes={MK.minutes} attempt={Number(row.attempts) || 1} />
    </>, true);
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
      <div className="mkK-cover"><VogueCover look={cleanLook(row.look)} theme={row.cover_theme || 'pink'} title={row.look_title} score={score} name={row.child_name} age={row.child_age} word={wordCap(row.designer_word)} winner={row.winner_month ? `${monthName(row.winner_month)} ${row.winner_month.slice(0, 4)}` : null} /></div>
      <div>
        <p className="mkT-text">Модний код: <b>{score}</b>. Обкладинку можна роздрукувати на А4 чи зберегти PDF. Щомісяця журі обирає «Обкладинку місяця» серед найвищих балів — її публікуємо на сайті й у соцмережах Dityam.com.ua, лише з імʼям і віком.</p>
        <PrintBtn />
        {/* Окремого сертифіката немає: обкладинка і є він (Марія, 13.10.2026:
            «нашо тут сертифікат якщо обкладинка і є він»). */}
        <ShareCover token={row.token} name={row.child_name} score={score} />
        {Number(row.attempts) > 1 && row.last_score != null && row.last_score !== row.score
          ? <p className="mkT-text mkK-last">Остання спроба: {row.last_score}/{row.max_score}. На обкладинці — кращий результат.</p> : null}
        <RetakeButton t={row.token} />
      </div>
    </div>
    {/* Окремого «Тренування» для підписників більше немає: тест можна
        перепроходити всім і скільки завгодно (13.10.2026), кнопка — біля обкладинки. */}
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
    {/* Dityam+ за 1 грн — учасникам олімпіади (Марія, 13.10.2026: «тут можна
        рекламу Dityam+ для учасників олімпіади за 1 грн»). Мітка from_modnyi_kod
        дає ціну першого місяця в боті (introPriceFor) і рядок в /admin/plus.
        Підписникам, що прийшли з бота, не показуємо. */}
    {row.source !== 'dityam_plus' ? (
      <section className="mkK-review mkK-plus">
        <p className="mk-kick">Dityam+ на місяць за {PRICE_FIRST} грн замість {PRICE} грн</p>
        <h2 className="mkT-hand ink">Що далі після «Модного коду»?</h2>
        <p className="mkT-text">Dityam+ щодня добирає конкурси, олімпіади й інші можливості під вік та інтереси дитини і завчасно нагадує про дедлайни — у Telegram. А ще підписники першими дізнаються про наші нові олімпіади й конкурси. Перший місяць — {PRICE_FIRST} грн замість {PRICE} грн, далі {PRICE} грн/міс, скасувати можна будь-коли.</p>
        <a className="mk-btn-y" href={`https://t.me/${PLUS_BOT}?start=from_modnyi_kod`} target="_blank" rel="noopener">Спробувати Dityam+ за {PRICE_FIRST} грн</a>
      </section>
    ) : null}
  </>);
}
