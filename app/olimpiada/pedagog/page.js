import '@/app/styles/olimpiada.css';
import Footer from '../../Footer';
import { OLIMP, DIPLOMA_VERSION, teacherName, validTeacherCode } from '@/lib/olimpiada';
import { getStore } from '@/lib/olimpiada-server';
import DiplomaImage from '../test/DiplomaImage';
import TeacherShare from '../TeacherShare';

// Сторінка педагога (Марія, 11.10.2026): особисте посилання для учнів, готовий
// текст для чату класу, скільки учнів за посиланням уже пройшли олімпіаду, і
// подяка — з першого учня. Доступ — за кодом із посилання (?c=<код>), як і
// сторінка диплома за токеном. Email педагога тут не показуємо.
// Читаємо свіжим: Data Cache Next.js віддавав би старе число (див. коментар
// про freshFetch у lib/olimpiada-server.js, #723).
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export const metadata = {
  title: { absolute: 'Сторінка педагога — онлайн-олімпіада з логіки Dityam.com.ua' },
  robots: { index: false, follow: false },
};

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
    } catch (e) {
      console.error('[olimpiada/pedagog]', e?.message || e);
      failed = true;
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
  // &n=<число> — нове число дає нову адресу, і браузер не покаже подяку з кешу.
  const img = `/api/olimpiada/diploma?kind=teacher&c=${code}&n=${count}&v=${DIPLOMA_VERSION}`;
  return (
    <Shell>
      <div className="ol-result">
        <p className="ol-kicker">Онлайн-олімпіада з логіки · для педагогів</p>
        <h1 className="ol-hand">{name}</h1>
        <p className="ol-lead">
          За вашим посиланням олімпіаду пройшли: <b>{count}</b>
        </p>
        {count > 0 ? (
          <>
            <DiplomaImage src={`${img}&s=screen`} waitTitle="Малюємо подяку…" failTitle="Подяка не завантажилась" alt={`Подяка педагогу: ${name}. Олімпіаду пройшли учні: ${count}`} />
            <div className="ol-actions ol-actions-center">
              <a href={`${img}&dl=1`} className="ol-btn ol-btn-main">Завантажити подяку</a>
            </div>
            <p className="ol-note">
              Число учнів на подяці оновлюється, коли за вашим посиланням проходять нові. Завантажте подяку ще раз, щоб отримати свіже.
            </p>
          </>
        ) : (
          <p className="ol-teach-wait">
            Подяка зʼявиться тут, щойно перший учень за вашим посиланням пройде олімпіаду.
          </p>
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
        <p className="ol-note">Збережіть цю сторінку: тут завжди свіже число учнів і ваша подяка.</p>
      </div>
    </Shell>
  );
}
