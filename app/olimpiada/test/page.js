import '@/app/styles/olimpiada.css';
import Footer from '../../Footer';
import { OLIMP, OPEN_TASK, levelByKey, diplomaNo, monthKey, monthName, accessExpired, accessUntil, kyivDateTime } from '@/lib/olimpiada';
import { getStore, validToken } from '@/lib/olimpiada-server';
import { PLUS_BOT } from '@/lib/plus';
import TestRunner from './TestRunner';
import WaitPayment from './WaitPayment';
import OpenTask from './OpenTask';
import PrintOrder from './PrintOrder';

// Сторінка тесту й результату. Доступ — за токеном із заявки: він у посиланні
// після оплати. Стани: оплата ще не підтверджена → тест → диплом.
export const dynamic = 'force-dynamic';

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
  const entry = store ? await store.get(t).catch(() => null) : null;

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
      <Message title="Чекаємо підтвердження оплати">
        <WaitPayment failed={Boolean(entry.wfp_last_status)} email={EMAIL} />
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
          until={entry.started_at ? null : kyivDateTime(accessUntil(entry.paid_at))}
        />
      </Shell>
    );
  }

  const level = levelByKey(entry.level);
  const diploma = `/api/olimpiada/diploma?t=${entry.token}`;
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
        <img className="ol-diploma" src={diploma} width={1754} height={1240} alt={`Диплом: ${entry.child_name}, ${level.label}, ${entry.score} з ${entry.max_score}`} />
        <div className="ol-actions ol-actions-center">
          <a href={`${diploma}&dl=1`} className="ol-btn ol-btn-main">Завантажити диплом</a>
          {entry.plus_token && (
            <a href={`https://t.me/${PLUS_BOT}?start=${entry.plus_token}`} className="ol-btn ol-btn-ghost" target="_blank" rel="noopener">
              Отримати диплом і Dityam+ у Telegram
            </a>
          )}
        </div>
        <p className="ol-note">Номер диплома: {diplomaNo(entry.token)}. Збережіть це посилання — диплом лишається доступним за ним.</p>
      </div>

      <div className="ol-panel ol-open">
        <p className="ol-kicker">Останнє завдання · приз місяця: {month}</p>
        <h2 className="ol-h2">{OPEN_TASK.title}</h2>
        <p className="ol-text">{OPEN_TASK.text}</p>
        <p className="ol-note">
          Саме це завдання вирішує, хто отримає приз місяця. Журі оцінює: {OPEN_TASK.criteria.join(', ')}.
          Таймера тут немає, на диплом воно не впливає.
        </p>
        <OpenTask token={entry.token} done={Boolean(entry.open_answer)} max={OPEN_TASK.maxLength} />
      </div>

      <div className="ol-panel ol-open">
        <p className="ol-kicker">За бажанням</p>
        <h2 className="ol-h2">Друкований диплом</h2>
        <p className="ol-text">Надрукуємо диплом і надішлемо Новою поштою по Україні — {OLIMP.printPrice} грн.</p>
        <PrintOrder token={entry.token} price={OLIMP.printPrice} paid={Boolean(entry.print_paid_at)} order={entry.print_order ? { city: entry.print_order.city, branch: entry.print_order.branch } : null} />
      </div>
    </Shell>
  );
}
