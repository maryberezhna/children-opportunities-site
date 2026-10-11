import '@/app/styles/obraz.css';
import Link from 'next/link';
import Footer from '../Footer';
import { TELEGRAM_URL } from '@/lib/social';
import { kyivToday } from '@/lib/dates';
import { OBRAZ, themeOpen, imageUrl, caption, workPath } from '@/lib/obraz';
import { fabricFor } from '@/lib/obraz-cover';
import { obrazDb, approvedWorks } from '@/lib/obraz-server';
import ObrazForm from './ObrazForm';
import Cover from './Cover';
import { FabricDefs, Look, EXAMPLE_LOOKS } from './Looks';

// Челендж «Твій образ на обкладинці» (11.10.2026, Марія обрала варіант
// «Обкладинка» з трьох макетів): дитина малює свій образ, а малюнок стає
// обкладинкою модного журналу dityam.com.ua з її іменем. Без переможців —
// обкладинку отримує кожен; оргвнесок 99 грн. Логіка — lib/obraz.js.
//
// Приклади на сторінці — модні ескізи команди з позначкою «Приклад», без
// вигаданих імен: батьки платять, дивлячись на галерею, тож видавати
// згенероване за роботи дітей не можна.

export const dynamic = 'force-dynamic';

const SITE_URL = 'https://dityam.com.ua';
const URL = `${SITE_URL}/${OBRAZ.slug}`;
const TITLE = `${OBRAZ.title}: онлайн-челендж для дітей ${OBRAZ.ageFrom}–${OBRAZ.ageTo} років`;
const DESCRIPTION = `Онлайн-челендж Dityam.com.ua: дитина малює свій образ, а малюнок стає обкладинкою модного журналу з її іменем. Без переможців — обкладинка, сторінка в галереї й сертифікат кожному. Оргвнесок ${OBRAZ.price} грн.`;

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: URL },
  openGraph: { title: TITLE, description: DESCRIPTION, url: URL, type: 'website', locale: 'uk_UA', siteName: 'Dityam.com.ua' },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
};

const MONTHS = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
const dayMonth = (iso) => { const [, m, d] = iso.split('-').map(Number); return `${d} ${MONTHS[m - 1]}`; };

function ExampleCover({ ex, className }) {
  return (
    <Cover fabric={ex.fabric} title={ex.title} example className={className}>
      <Look look={ex.key} className="cv-look" />
    </Cover>
  );
}

export default async function ObrazPage() {
  const open = themeOpen(kyivToday());
  const db = obrazDb();
  let works = [];
  if (db) works = await approvedWorks(db, { limit: 8 }).catch(() => []);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: `${OBRAZ.title}: ${OBRAZ.theme.title}`,
    description: DESCRIPTION,
    url: URL,
    eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    endDate: OBRAZ.theme.until,
    isAccessibleForFree: false,
    offers: { '@type': 'Offer', price: OBRAZ.price, priceCurrency: 'UAH', url: URL, availability: 'https://schema.org/InStock' },
    typicalAgeRange: `${OBRAZ.ageFrom}-${OBRAZ.ageTo}`,
    location: { '@type': 'VirtualLocation', url: URL },
    organizer: { '@type': 'Organization', name: 'Dityam.com.ua', url: SITE_URL },
  };

  return (
    <>
      <main className="ob ob-mag">
        <FabricDefs />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

        <section className="ob-mhero">
          <div className="ob-wrap ob-mhero-grid">
            <div className="ob-mhero-txt">
              <p className="ob-kicker-o">Онлайн-челендж Dityam.com.ua · {OBRAZ.ageFrom}–{OBRAZ.ageTo} років · {OBRAZ.season}</p>
              <h1 className="ob-mh1">Твій образ —<br />на <i>обкладинці</i></h1>
              <p className="ob-lead">
                Намалюй свій образ — а ми зробимо з нього обкладинку модного журналу з твоїм іменем.
                Справжню: її можна роздрукувати, повісити на стіну й показати всім. Без журі й місць — обкладинку отримує кожен.
              </p>
              <div className="ob-actions">
                <a href="#uchast" className="ob-btn ob-btn-dark">{open ? 'Хочу на обкладинку' : 'Подивитися архів'}</a>
                <Link href={`/${OBRAZ.slug}/halereya`} className="ob-btn ob-btn-ghost">Архів обкладинок</Link>
              </div>
            </div>
            <div className="ob-stack" aria-hidden="true">
              <ExampleCover ex={EXAMPLE_LOOKS[0]} className="ob-stack-1" />
              <ExampleCover ex={EXAMPLE_LOOKS[1]} className="ob-stack-2" />
              <ExampleCover ex={EXAMPLE_LOOKS[2]} className="ob-stack-3" />
            </div>
          </div>
        </section>

        <section className="ob-wrap">
          <div className="ob-theme">
            <p className="ob-eyebrow">Тема сезону {open ? `· до ${dayMonth(OBRAZ.theme.until)} включно` : '· прийом завершено'}</p>
            <h2 className="ob-h2">«{OBRAZ.theme.title}»</h2>
            <p className="ob-text">{OBRAZ.theme.task}</p>
          </div>
        </section>

        <section className="ob-wrap">
          <h2 className="ob-h2">Як потрапити на обкладинку</h2>
          <ol className="ob-steps">
            <li><b>Намалюй свій образ</b> — одяг, взуття, аксесуари. Олівцями, фарбами, фломастерами чи на планшеті.</li>
            <li><b>Сфотографуйте малюнок</b> — лише малюнок, без людей і документів у кадрі.</li>
            <li><b>Батьки заповнюють форму</b> — і одразу бачать обкладинку з іменем дитини.</li>
            <li><b>Оргвнесок {OBRAZ.price} грн</b> — і за 1–2 дні обкладинка в архіві, а на пошті — версія для друку й сертифікат.</li>
          </ol>
        </section>

        <section className="ob-wrap">
          <div className="ob-sec-head">
            <h2 className="ob-h2">{works.length ? 'Архів обкладинок' : 'Такою буде твоя обкладинка'}</h2>
            <Link href={`/${OBRAZ.slug}/halereya`} className="ob-link">Увесь архів →</Link>
          </div>
          <div className="ob-covers">
            {works.length ? works.map((w) => (
              <Link key={w.public_id} href={workPath(w.public_id)} className="ob-cover-link" aria-label={`Обкладинка «${w.title}», ${caption(w)}`}>
                <Cover fabric={fabricFor(w.public_id, w.fabric)} title={w.title} name={w.child_name} age={w.age} designerWord={w.designer_word}>
                  <img src={imageUrl(w.image_path)} alt="" loading="lazy" />
                </Cover>
              </Link>
            )) : EXAMPLE_LOOKS.map((ex) => <ExampleCover key={ex.key} ex={ex} />)}
          </div>
          {!works.length ? <p className="ob-small">Це приклади від команди Dityam.com.ua. На обкладинці твоєї дитини буде її власний малюнок, імʼя та вік.</p> : null}
        </section>

        <section className="ob-wrap">
          <h2 className="ob-h2">Що отримує дитина</h2>
          <div className="ob-why">
            <div><span aria-hidden="true">📰</span><b>Свою обкладинку</b><p>З її малюнком, назвою образу й підписом «Дизайнерка Соломія, 9» — версія для друку А4.</p></div>
            <div><span aria-hidden="true">👀</span><b>Її помітять</b><p>Обкладинка в архіві на справжньому сайті — посиланням можна похвалитися бабусі й друзям.</p></div>
            <div><span aria-hidden="true">💛</span><b>Віра у свій смак</b><p>Без оцінок «краще чи гірше». Відзнаки за сміливість, історію, кольори — їх отримують багато дітей.</p></div>
            <div><span aria-hidden="true">📜</span><b>Сертифікат</b><p>Перший рядок у творчому портфоліо — роздрукуйте чи збережіть.</p></div>
          </div>
        </section>

        <section className="ob-wrap ob-safe">
          <h2 className="ob-h2">Безпека дитини — передусім</h2>
          <div className="ob-safe-grid">
            <div>
              <p className="ob-safe-head">На обкладинці й на сайті</p>
              <ul><li>імʼя дитини, без прізвища</li><li>вік</li><li>малюнок і назва образу</li></ul>
            </div>
            <div>
              <p className="ob-safe-head">Ніколи не показуємо</p>
              <ul><li>прізвище, місто, школу, email</li><li>фото дитини — лише малюнок</li><li>лайки й коментарі — щоб не було рейтингу</li></ul>
            </div>
          </div>
          <p className="ob-text ob-small">
            Кожен малюнок ми переглядаємо, перш ніж опублікувати. Приховані дані з фото (зокрема координати місця зйомки) видаляємо автоматично.
            Прибрати обкладинку з архіву можна будь-коли — за посиланням з листа.
          </p>
        </section>

        <section className="ob-wrap" id="uchast">
          <h2 className="ob-h2">Хочу на обкладинку</h2>
          <p className="ob-text">Оргвнесок — <b>{OBRAZ.price} грн</b>. Спершу ви побачите обкладинку з іменем дитини, а платите вже потім.</p>
          <ObrazForm open={open} channelUrl={TELEGRAM_URL} />
        </section>
      </main>
      <Footer />
    </>
  );
}
