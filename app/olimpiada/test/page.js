import '@/app/styles/olimpiada.css';
import Footer from '../../Footer';
import { OLIMP, OPEN_TASK, criteriaText, DIPLOMA_VERSION, levelByKey, diplomaNo, monthKey, monthName, accessExpired, accessUntil, kyivDateTime, isPaidEntry, missedQuestions, publicQuestions } from '@/lib/olimpiada';
import { getStore, validToken, syncPayment, syncPrint, loadKeys } from '@/lib/olimpiada-server';
import { BANK } from '@/content/olimpiada/lohika-9-11';
import { HINTS } from '@/content/olimpiada/hints';
import { PLUS_BOT, PLUS_FREE } from '@/lib/plus';
import { PRICE, PRICE_FIRST } from '@/lib/wayforpay';
import TestRunner from './TestRunner';
import { OPEN_TASK_ART } from '@/content/olimpiada/open-task-art';
import WaitPayment from './WaitPayment';
import PrintOrder from './PrintOrder';
import ShareDiploma from './ShareDiploma';
import InstagramShare from './InstagramShare';
import DiplomaMailer from './DiplomaMailer';
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
  // Розбір: завдання, де дитина помилилась чи не відповіла, з підказками без
  // відповідей. Список зберігає сервер у мить здачі; для тих, хто пройшов тест
  // до 09.10.2026, складаємо його тут, поки є ключі. Сторінка серверна — ні
  // ключі, ні підказки до інших завдань у браузер не йдуть.
  let missed = Array.isArray(entry.missed_questions) ? entry.missed_questions : null;
  if (!missed && entry.answers) {
    const keys = await loadKeys(OLIMP.slug).catch(() => null);
    missed = keys ? missedQuestions(BANK, entry.question_order, entry.answers, keys, HINTS) : [];
  }
  const review = (missed || []).map((m) => {
    const o = (entry.question_order || []).find((x) => x.id === m.id);
    return { ...m, view: o ? publicQuestions(BANK, [o])[0] : null };
  });
  // Диплом заблоковано (Марія, 15.10.2026): сторінка лишається доступною за
  // посиланням, але зникають саме зображення диплома, завантаження,
  // «поділитися» й замовлення друку. Картинку за прямою адресою теж не
  // віддаємо (app/api/olimpiada/diploma).
  if (entry.blocked_at) {
    return (
      <Shell>
        <div className="ol-result">
          <p className="ol-kicker">Онлайн-олімпіада з логіки · {OLIMP.groupLabel}</p>
          <h1 className="ol-hand">Упс…</h1>
          <div className="ol-blocked">
            <p className="ol-blocked-lead">Ваш диплом заблоковано й анульовано через порушення правил етики.</p>
            {/* Дослівна цитата того, за що заблоковано (Марія, 15.10.2026:
                «та прям додай прямий текст»). Беремо blocked_quote — саме той
                текст, що став приводом: іноді це відкрите завдання, іноді
                відгук після диплома. Якщо його не задали, показуємо відкрите
                завдання, як було до 16.10.2026. */}
            {(entry.blocked_quote || entry.open_answer) ? (
              <blockquote className="ol-blocked-quote">
                {entry.blocked_quote || entry.open_answer}
              </blockquote>
            ) : null}
            <p className="ol-text">
              Олімпіада — про власну роботу й чесну гру. Ми не платимо за участь
              і не видаємо дипломи на вимогу.
            </p>
            {/* Марія, 16.10.2026: «напиши краще повідомлення… щоб це трохи
                налякало тих бешкетників». Рядок-штамп + те, що справді
                зберігається в базі: текст, імʼя і час. */}
            <p className="ol-blocked-stamp">Запит передано у Міністерство етики і комунікацій</p>
            <p className="ol-text">
              Випадок зафіксовано: текст відповіді, імʼя учасника та час
              збережені. Диплом за цим посиланням більше не видається.
            </p>
            <p className="ol-text">
              Якщо вважаєте, що це помилка, напишіть нам — розберемось:{' '}
              <a href="mailto:hellodityam.com.ua@gmail.com">hellodityam.com.ua@gmail.com</a>.
            </p>
          </div>
        </div>
      </Shell>
    );
  }

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
          Номер диплома: {diplomaNo(entry.token)}. {entry.telegram_chat_id
            ? 'Диплом ми надіслали й у Telegram — у чат, де записували дитину.'
            : 'Посилання на цю сторінку з дипломом надішлемо й на email із заявки.'} Збережіть це посилання — диплом лишається доступним за ним.
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

      {/* Лист із дипломом — одразу, а не за розкладом GitHub (09.10.2026). */}
      {!entry.diploma_sent_at ? <DiplomaMailer token={entry.token} /> : null}
      <div className="ol-result ol-result-share">
        <ShareDiploma name={entry.child_name} score={entry.score} max={entry.max_score} diplomaUrl={diploma} />
      </div>

      {/* Розбір (Марія, 09.10.2026: «публікуємо вже на сторінці диплому і в
          імейлі там, де дитина помилилася»). Лише після тесту, лише ці завдання,
          і без правильних відповідей — «підказка без відповіді». Сюди веде
          кнопка з листа (#rozbir). */}
      {review.length ? (
        <div className="ol-panel ol-review" id="rozbir">
          <p className="ol-kicker">Розбір</p>
          <h2 className="ol-h2">Над чим варто ще подумати</h2>
          <p className="ol-text">
            Тут завдання, де відповідь не зарахована. Готових відповідей немає — так задумано:
            до кожного є підказка, з чого почати. Спробуй розвʼязати ще раз, на папері й без поспіху.
          </p>
          {review.map((m) => (
            <article key={m.id} className="ol-review-item">
              <p className="ol-review-num">Завдання {m.num}</p>
              {m.view?.art ? <div className="ol-q-art" dangerouslySetInnerHTML={{ __html: m.view.art }} /> : null}
              <p className="ol-review-q">{m.q}</p>
              {m.view ? (
                <div className={`ol-options${m.view.options.some((op) => op.art) ? ' is-pics' : ''}`}>
                  {m.view.options.map((op) => (
                    <div key={op.id} className={`ol-option is-static${op.art ? ' is-pic' : ''}${op.id === m.given ? ' is-given' : ''}`}>
                      {op.art ? <span className="ol-option-art" dangerouslySetInnerHTML={{ __html: op.art }} /> : null}
                      {op.text ? <span>{op.text}</span> : null}
                      {op.id === m.given ? <span className="ol-review-mine">твоя відповідь</span> : null}
                    </div>
                  ))}
                </div>
              ) : null}
              {m.given === null ? <p className="ol-note">На це завдання відповіді не було.</p> : null}
              {m.hint ? <p className="ol-review-hint"><b>Як міркувати.</b> {m.hint}</p> : null}
            </article>
          ))}
        </div>
      ) : null}

      {/* Наприкінці, після розбору (Марія, 13.10.2026: «також в кінці висвітлюй
          після розбору замовити друковану версію, поділитися в інстаграм»). */}
      <div className="ol-panel ol-end-cta">
        <p className="ol-kicker">Що ще можна зробити</p>
        <h2 className="ol-h2">Диплом — на стіну й у сторіс</h2>
        <div className="ol-actions">
          {entry.print_paid_at
            ? <a href="#dostavka" className="ol-btn ol-btn-main">Друкований диплом: доставка</a>
            : <a href="#dostavka" className="ol-btn ol-btn-main">Замовити друкований диплом — {OLIMP.printPrice} грн</a>}
          <InstagramShare diplomaUrl={diploma} />
        </div>
      </div>

      {/* Dityam+ після тесту — перший місяць за 1 грн (Марія, 08.10.2026: «усім,
          хто проходить онлайн-олімпіаду, Dityam+ перший місяць за 1 грн, показуй
          і тут, і в імейлі»; замість подарункового місяця). Мітка from_olimpiada —
          щоб в /admin/plus було видно, що людина прийшла з олімпіади. */}
      <div className="ol-panel ol-plus-offer">
        <p className="ol-kicker">Dityam+ на місяць за {PRICE_FIRST} грн замість {PRICE} грн</p>
        <h2 className="ol-h2">Що далі після олімпіади?</h2>
        <p className="ol-text">
          Dityam+ щодня добирає конкурси, олімпіади й інші можливості під вік та інтереси дитини
          і завчасно нагадує про дедлайни — у Telegram. А ще підписники першими дізнаються про наші нові
          олімпіади й конкурси. {PLUS_FREE ? 'Підключити можна безкоштовно, одразу в боті.' : `Перший місяць — ${PRICE_FIRST} грн замість ${PRICE} грн, далі ${PRICE} грн/міс, скасувати можна будь-коли.`}
        </p>
        <a href={`https://t.me/${PLUS_BOT}?start=from_olimpiada`} className="ol-btn ol-btn-main" target="_blank" rel="noopener">
          Спробувати Dityam+ за {PRICE_FIRST} грн
        </a>
      </div>

      {/* Відкрите завдання — останній крок тесту, без таймера (07.10.2026). Тут
          лише підтвердження, що журі отримало відповідь. Дописати пропущене на
          цій сторінці більше не можна (Марія, 08.10.2026: «нащо оце, видалити»):
          «Пропустити» в тесті — остаточно. */}
      {entry.open_answer ? (
        <div className="ol-panel ol-open">
          <p className="ol-kicker">Відкрите завдання · приз місяця: {month}</p>
          <h2 className="ol-h2">{OPEN_TASK.title}</h2>
          <p className="ol-ok" role="status">
            Відповідь отримали. Журі оцінює: {criteriaText()}. Переможців за {month} оголосимо
            до 7-го числа наступного місяця в Telegram-каналі Dityam.com.ua й окремо напишемо їм {entry.telegram_chat_id ? 'у Telegram' : 'на email із заявки'}.
          </p>
          <blockquote className="ol-quote">{entry.open_answer}</blockquote>
        </div>
      ) : null}

    </Shell>
  );
}
