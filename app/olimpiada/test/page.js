import '@/app/styles/olimpiada.css';
import Footer from '../../Footer';
import { OLIMP, OPEN_TASK, criteriaText, DIPLOMA_VERSION, levelByKey, diplomaNo, monthKey, monthName, accessExpired, accessUntil, kyivDateTime, isPaidEntry } from '@/lib/olimpiada';
import { getStore, validToken, syncPayment, syncPrint } from '@/lib/olimpiada-server';
import { PLUS_BOT } from '@/lib/plus';
import TestRunner from './TestRunner';
import { OPEN_TASK_ART } from '@/content/olimpiada/open-task-art';
import WaitPayment from './WaitPayment';
import PrintOrder from './PrintOrder';
import OpenTaskLate from './OpenTaskLate';
import ShareDiploma from './ShareDiploma';
import DiplomaImage from './DiplomaImage';

// Сторінка тесту й результату. Доступ — за токеном із заявки: він у посиланні
// з форми й у листі. Стани: тест → диплом. З 08.10.2026 участь безкоштовна й
// доступ відкривається одразу; «чекаємо оплату» лишилось для старих платних заявок.
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export const metadata = {
  title: { absolute: 'Тест — онлайн-олімпіада з логіки Dityam.com.ua' },
  robots: { index: false, follow: false },
};

const EMAIL = 'hellodityam.com.ua@gmail.com';

function Shell({ children }) {
  return (
    <div className="v2-page ol-page">
      <main className="ol-space ol-space-full">
        <div className="ol-wrap ol-test-main">{children}</div>
      </main>
      <Footer />
    </div>
  );
}

function Message({ title, children }) {
  return (
    <Shell>
      <div className="ol-panel">
        <h1 className="ol-h2">{title}</h1>
        {children}
      </div>
    </Shell>
  );
}

export default async function TestPage({ searchParams }) {
  const t = searchParams?.t;
  const store = validToken(t) ? getStore() : null;
  let entry = store ? await store.get(t).catch(() => null) : null;
  // Оплату ще не підтверджено — питаємо WayForPay самі, не чекаючи колбека.
  let payState = 'paid';
  if (entry && !entry.paid_at) {
    const sync = await syncPayment(store, entry).catch(() => ({ entry, state: 'pending' }));
    entry = sync.entry;
    payState = sync.state;
  }

  if (!entry) {
    return (
      <Message title="Не знайшли вашу заявку">
        <p className="ol-text">Перевірте посилання або подайте заявку ще раз.</p>
        <a href="/olimpiada#uchast" className="ol-btn ol-btn-main">До олімпіади</a>
      </Message>
    );
  }

  if (!entry.paid_at) {
    return (
      <Message title={payState === 'pending' ? 'Чекаємо підтвердження оплати' : 'Оплату не завершено'}>
        <WaitPayment
          token={entry.token}
          state={payState}
          email={EMAIL}
          price={Number(entry.amount) || 0}
        />
      </Message>
    );
  }

  if (accessExpired(entry)) {
    return (
      <Message title="Час на проходження минув">
        <p className="ol-text">
          Почати тест можна було протягом {OLIMP.accessHours} годин після оплати — до {kyivDateTime(accessUntil(entry.paid_at))}.
          Якщо сталося щось непередбачене, напишіть на {EMAIL}.
        </p>
        <a href="/olimpiada" className="ol-btn ol-btn-main">До олімпіади</a>
      </Message>
    );
  }

  if (!entry.finished_at) {
    return (
      <Shell>
        <TestRunner
          token={entry.token}
          name={entry.child_name}
          started={Boolean(entry.started_at)}
          count={OLIMP.questionCount}
          minutes={OLIMP.minutes}
          openTask={OPEN_TASK}
          openArt={OPEN_TASK_ART}
          // Строк на початок — лише для старих платних заявок; безкоштовна не згорає.
          until={entry.started_at || !isPaidEntry(entry) ? null : kyivDateTime(accessUntil(entry.paid_at))}
          email={entry.parent_email}
          invited={Boolean(entry.invite_sent_at)}
        />
      </Shell>
    );
  }

  // Доставку диплома оплачували окремим рахунком — звіряємо так само.
  const print = await syncPrint(store, entry).catch(() => ({ entry, pending: false }));
  entry = print.entry;
  const level = levelByKey(entry.level);
  const diploma = `/api/olimpiada/diploma?t=${entry.token}&v=${DIPLOMA_VERSION}`;
  const month = monthName(entry.month_key || monthKey());
  return (
    <Shell>
      <div className="ol-result">
        <p className="ol-kicker">Онлайн-олімпіада з логіки · {OLIMP.groupLabel}</p>
        <h1 className="ol-hand">{entry.child_name}, вітаємо!</h1>
        <p className="ol-lead">
          Результат: <b>{entry.score} з {entry.max_score}</b> · {level.label}.
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <DiplomaImage src={`${diploma}&s=screen`} name={entry.child_name} alt={`Диплом: ${entry.child_name}, ${level.label}, ${entry.score} з ${entry.max_score}`} />
        <div className="ol-actions ol-actions-center">
          <a href={`${diploma}&dl=1`} className="ol-btn ol-btn-main">Завантажити диплом</a>
          {entry.plus_token && (
            <a href={`https://t.me/${PLUS_BOT}?start=${entry.plus_token}`} className="ol-btn ol-btn-ghost" target="_blank" rel="noopener">
              Отримати диплом і Dityam+ у Telegram
            </a>
          )}
        </div>
        <p className="ol-note">
          Номер диплома: {diplomaNo(entry.token)}. Диплом також надішлемо на email із заявки. Збережіть це посилання — диплом лишається доступним за ним.
        </p>
      </div>

      {/* #dostavka — сюди веде лист із дипломом («Бажаєте отримати диплом Новою поштою?»).
          Одразу під дипломом, а не в кінці сторінки (Марія, 06.10.2026: «постав
          вище, щоб одразу було видно, як диплом завантажиться»). */}
      <div className="ol-panel ol-open" id="dostavka">
        {entry.print_paid_at && !entry.print_order ? (
          <>
            <p className="ol-kicker">Оплачено разом з участю</p>
            <h2 className="ol-h2">Куди надіслати друкований диплом?</h2>
            <p className="ol-text">Доставку Новою поштою ви вже оплатили. Вкажіть отримувача й відділення чи поштомат — надрукуємо диплом і надішлемо.</p>
          </>
        ) : (
          <>
            <p className="ol-kicker">За бажанням</p>
            <h2 className="ol-h2">Бажаєте друкований диплом?</h2>
            <p className="ol-text">Надрукуємо диплом і надішлемо у відділення або поштомат Нової пошти по Україні — {OLIMP.printPrice} грн, доставка включена.</p>
          </>
        )}
        <PrintOrder token={entry.token} price={OLIMP.printPrice} paid={Boolean(entry.print_paid_at)} pending={print.pending} order={entry.print_order ? { city: entry.print_order.city, branch: entry.print_order.branch } : null} />
      </div>

      <div className="ol-result ol-result-share">
        <ShareDiploma name={entry.child_name} score={entry.score} max={entry.max_score} diplomaUrl={diploma} />
      </div>

      {/* Відкрите завдання — останній крок тесту, без таймера (07.10.2026). Тут
          показуємо, що журі отримало, а якщо дитина його пропустила чи закрила
          вкладку на цьому кроці — даємо дописати. */}
      <div className="ol-panel ol-open">
        <p className="ol-kicker">Відкрите завдання · приз місяця: {month}</p>
        <h2 className="ol-h2">{OPEN_TASK.title}</h2>
        {entry.open_answer ? (
          <>
            <p className="ol-ok" role="status">
              Відповідь отримали. Журі оцінює: {criteriaText()}. Переможців за {month} оголосимо
              до 7-го числа наступного місяця в Telegram-каналі Dityam.com.ua й окремо напишемо їм на email із заявки.
            </p>
            <blockquote className="ol-quote">{entry.open_answer}</blockquote>
          </>
        ) : (
          <>
            <p className="ol-text">
              Відповідь ще не надіслано — її можна дописати тут, таймера немає. Саме за відкритим завданням журі обирає призерів місяця. Диплом від цього не залежить.
            </p>
            {OPEN_TASK_ART && <div className="ol-q-art" dangerouslySetInnerHTML={{ __html: OPEN_TASK_ART }} />}
            <p className="ol-text">{OPEN_TASK.text}</p>
            <OpenTaskLate token={entry.token} maxLength={OPEN_TASK.maxLength} />
          </>
        )}
      </div>

    </Shell>
  );
}
