import '@/app/styles/olimpiada.css';
import Footer from '../../Footer';
import { OLIMP, DIPLOMA_VERSION, TEACHER_THANKS_AT, teacherName, teacherThanksDate, validTeacherCode } from '@/lib/olimpiada';
import { getStore, thankTeacher } from '@/lib/olimpiada-server';
import { notifySig, checkNotifySig, NOTIFY_ACTION } from '@/lib/olimpiada-sign';
import DiplomaImage from '../test/DiplomaImage';
import TeacherShare from '../TeacherShare';

// Сторінка педагога (Марія, 11.10.2026): особисте посилання для учнів, готовий
// текст для чату класу, скільки учнів за посиланням уже пройшли олімпіаду, і
// подяка. Подяку видаємо один раз, після TEACHER_THANKS_AT учнів: до того —
// «Олімпіаду пройшли N з 5 учнів» і смужка поступу, після — сама подяка й
// «Завантажити подяку». Доступ — за кодом із посилання (?c=<код>), як і
// сторінка диплома за токеном. Email педагога тут не показуємо.
// ?notify=1&s=<підпис> — сюди веде «Так, повідомляйте мене» з листа: показуємо
// питання й кнопку. Сам перехід згоди не записує (сканери посилань у пошті
// відкривають його без людини) — лише POST кнопки на /api/olimpiada/teacher/notify.
// ?ok=1 — педагог щойно погодився на листи.
// Читаємо свіжим: Data Cache Next.js віддавав би старе число (див. коментар
// про freshFetch у lib/olimpiada-server.js, #723).
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export const metadata = {
  title: { absolute: 'Сторінка педагога — онлайн-олімпіада з логіки Dityam.com.ua' },
  robots: { index: false, follow: false },
};

// Кнопка згоди: звичайна HTML-форма, працює й без JavaScript.
function NotifyButton({ code, sig, className, children }) {
  return (
    <form method="post" action={NOTIFY_ACTION} className={className}>
      <input type="hidden" name="c" value={code} />
      <input type="hidden" name="s" value={sig} />
      {children}
    </form>
  );
}

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

export default async function TeacherPage({ searchParams }) {
  const code = searchParams?.c;
  const store = validTeacherCode(code) ? getStore() : null;
  let teacher = null;
  let count = 0;
  let failed = false;
  if (store) {
    try {
      teacher = await store.teacherByCode(code);
      if (teacher) count = await store.teacherFinished(code);
      // Учнів уже досить, а подяки немає — лист у мить 5-го учня не пішов
      // (Gmail не відповів). Видаємо зараз; thanks_sent_at не дасть двох листів.
      if (teacher && !teacher.thanks_sent_at && count >= TEACHER_THANKS_AT && await thankTeacher(store, code, teacher)) {
        teacher = (await store.teacherByCode(code)) || teacher;
      }
    } catch (e) {
      console.error('[olimpiada/pedagog]', e?.message || e);
      failed = !teacher;
    }
  }

  if (!teacher) {
    return (
      <Shell>
        <div className="ol-panel">
          <h1 className="ol-h2">{failed ? 'Сторінка тимчасово недоступна' : 'Сторінку не знайдено'}</h1>
          <p className="ol-text">
            {failed
              ? 'Спробуйте оновити сторінку за хвилину.'
              : 'Перевірте посилання з листа. Якщо воно загубилось, залиште свій email у блоці «Для педагогів» ще раз — покажемо те саме посилання.'}
          </p>
          <a className="ol-btn ol-btn-main" href="/olimpiada#pedagogam">До олімпіади</a>
        </div>
      </Shell>
    );
  }

  const name = teacherName(teacher.name) || '';
  const issued = Boolean(teacher.thanks_sent_at);
  const done = Math.min(count, TEACHER_THANKS_AT);
  // Подяка не змінюється, тож адреса стала: CDN малює її один раз.
  const img = `/api/olimpiada/diploma?kind=teacher&c=${code}&v=${DIPLOMA_VERSION}`;
  const notifyOk = Boolean(teacher.notify_ok_at);
  const sig = notifyOk ? null : notifySig(code);
  // Прийшли з листа за «Так, повідомляйте мене» — питання з кнопкою нагорі.
  const asking = Boolean(sig) && searchParams?.notify === '1' && checkNotifySig(code, searchParams?.s);
  const notifyAsk = 'Чи можна повідомляти вас і про інші олімпіади та конкурси для ваших учнів?';
  return (
    <Shell>
      <div className="ol-result">
        <p className="ol-kicker">Онлайн-олімпіада з логіки · для педагогів</p>
        <h1 className="ol-hand">{name}</h1>
        {(searchParams?.ok === '1' || searchParams?.notify === '1') && notifyOk && (
          <p className="ol-teach-ok" role="status">Дякуємо! Повідомлятимемо вас про олімпіади й конкурси для ваших учнів</p>
        )}
        {asking && (
          <NotifyButton code={code} sig={sig} className="ol-teach-ask">
            <p>{notifyAsk}</p>
            <button type="submit" className="ol-btn ol-btn-main">Так, повідомляйте мене</button>
          </NotifyButton>
        )}
        {searchParams?.notify === 'error' && (
          <p className="ol-teach-ok ol-teach-ok-err" role="status">Не вдалося зберегти. Спробуйте ще раз за хвилину.</p>
        )}
        {issued ? (
          <>
            <p className="ol-lead">
              За вашим посиланням олімпіаду пройшли: <b>{count}</b>
            </p>
            <DiplomaImage src={`${img}&s=screen`} waitTitle="Малюємо подяку…" failTitle="Подяка не завантажилась" alt={`Подяка педагогу: ${name}`} />
            <div className="ol-actions ol-actions-center">
              <a href={`${img}&dl=1`} className="ol-btn ol-btn-main">Завантажити подяку</a>
            </div>
            <p className="ol-note ol-note-light">
              Подяку видано: {teacherThanksDate(teacher.thanks_sent_at).toLowerCase()}. Діти можуть і далі проходити олімпіаду за вашим посиланням.
            </p>
          </>
        ) : (
          <div className="ol-teach-progress">
            <p className="ol-teach-progress-text">
              Олімпіаду пройшли <b>{done} з {TEACHER_THANKS_AT}</b> учнів
            </p>
            <div className="ol-teach-bar" role="progressbar" aria-valuemin={0} aria-valuemax={TEACHER_THANKS_AT} aria-valuenow={done}
              aria-label={`Олімпіаду пройшли ${done} з ${TEACHER_THANKS_AT} учнів`}>
              <span style={{ width: `${(done / TEACHER_THANKS_AT) * 100}%` }} />
            </div>
            <p className="ol-teach-progress-hint">
              Коли за вашим посиланням олімпіаду пройдуть {TEACHER_THANKS_AT} учнів, подяка від Dityam.com.ua зʼявиться тут, і ми надішлемо її вам листом.
            </p>
          </div>
        )}
      </div>

      <div className="ol-panel ol-teach-panel">
        <p className="ol-kicker">Ваше посилання</p>
        <h2 className="ol-h2">Надішліть посилання батькам учнів</h2>
        <p className="ol-text">
          Олімпіада безкоштовна, для дітей {OLIMP.groupLabel}. Заявку подає мама, тато чи опікун дитини — тому посилання
          варто надіслати в чат батьків класу. Учні, які пройдуть олімпіаду за ним, зараховуються вам.
        </p>
        <TeacherShare code={code} withMessage />
        <p className="ol-note">Збережіть цю сторінку: тут завжди свіже число учнів{issued ? ' і ваша подяка' : ''}.</p>
        {sig && !asking && (
          <NotifyButton code={code} sig={sig} className="ol-teach-optin">
            Хочете дізнаватися про інші олімпіади й конкурси для ваших учнів?{' '}
            <button type="submit">Так, повідомляйте мене</button>
          </NotifyButton>
        )}
      </div>

      {/* Амбасадори (Марія, 16.10.2026: «додай на цю сторінку ставайте
          амбасадором»). Педагог, який уже роздав посилання класу, робить те
          саме, що й амбасадор, — тож наступний крок тут доречний. Вигоди —
          дослівно зі сторінки /ambasadory, три з шести: нових не вигадувати. */}
      <div className="ol-panel ol-amb-cta">
        <p className="ol-kicker">Амбасадори Dityam.com.ua</p>
        <h2 className="ol-h2">Ставайте амбасадором</h2>
        <p className="ol-text">
          Вчителі, вихователі й керівники гуртків, які розповідають про можливості учням і колегам.
          Без квот і обовʼязків.
        </p>
        <ul className="ol-amb-list">
          <li>Першими дізнаєтесь про наші олімпіади й конкурси</li>
          <li>Сертифікат і подяка від Dityam.com.ua</li>
          <li>Розширений функціонал для вчителів</li>
        </ul>
        <div className="ol-actions">
          <a className="ol-btn ol-btn-main" href="/ambasadory">Стати амбасадором</a>
        </div>
      </div>
    </Shell>
  );
}
