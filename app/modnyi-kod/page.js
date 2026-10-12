import '@/app/styles/modnyi-kod.css';
import Link from 'next/link';
import Footer from '../Footer';
import { MK } from '@/lib/modnyi-kod';
import { lookSvg, DEFS } from '@/lib/modnyi-kod-looks';
import { SIA_AWARD } from '@/lib/awards';
import DeskCollage from './DeskCollage';
import Waitlist from './Waitlist';

// «Модний код» — сторінка олімпіади з моди, побудована як сторінка олімпіади з
// логіки (Марія, 12.10.2026: «в нас має бути така сторінка нормальна, як у
// олімпіади з логіки»): перший екран — «стіл дизайнера» (макет C), далі що
// отримує кожен, як це працює, які бувають завдання, обкладинка, ціна, участь,
// питання. Студія образу — окремо, /modnyi-kod/studiya (безкоштовно).
//
// SEO: «олімпіада з моди» майже не шукають; шукають «юний дизайнер», «тест
// який у мене стиль одягу», «мода для підлітків» — вони в title/description.

const SITE_URL = 'https://dityam.com.ua';
const URL = `${SITE_URL}/${MK.slug}`;
const STUDIO = `/${MK.slug}/studiya`;
const TITLE = `«${MK.title}» — онлайн-олімпіада з моди для дітей ${MK.ageFrom}–${MK.ageTo} років`;
const DESCRIPTION = `Онлайн-олімпіада з моди Dityam.com.ua для юного дизайнера: кольори, тканини, стилі й тренди. Безкоштовна студія образу, а нагорода олімпіади — обкладинка модного журналу з твоїм луком. Мода для підлітків без нудних тестів.`;

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: URL },
  openGraph: { title: TITLE, description: DESCRIPTION, url: URL, type: 'website', locale: 'uk_UA', siteName: 'Dityam.com.ua' },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
};

const COVER_LOOK = {
  base: 'set', top: 'oversize', bottom: 'pleat', outer: 'none', shoes: 'boots', acc: 'beret',
  f: { top: 'quilt', bottom: 'tartan', shoes: '#161616', acc: '#e2412b', legs: '#161616', base: 'polka', outer: 'hound', cover: 'tartan' },
};

const TOPICS = [
  ['🎨', 'Кольори', 'Який колір протилежний червоному на колірному колі? Що таке монохромний образ?'],
  ['🧵', 'Тканини', 'Хто «робить» шовк? З якої тканини шиють джинси?'],
  ['🔍', 'Візерунки', 'Шотландка, гусяча лапка, горох — упізнай за картинкою.'],
  ['👗', 'Стилі й слова моди', 'Що таке лук, капсульний гардероб, оверсайз, стрітвір?'],
  ['🔥', 'Тренди', 'Аутфіт, вайб, Y2K, «дарк академія» — про що це?'],
  ['🇺🇦', 'Українське вбрання', 'Коли День вишиванки? Що таке плахта?'],
  ['♻️', 'Свідома мода', 'Що означає значок на ярлику? Що таке апсайклінг?'],
  ['🧠', 'Модна логіка', 'З 3 футболок, 2 спідниць і 2 пар кедів — скільки образів?'],
];

const FAQ = [
  ['Студія справді безкоштовна?', 'Так. Збирати образи можна скільки завгодно разів, без реєстрації й без оплати. Образ зберігається в браузері.'],
  ['За що оргвнесок 99 грн?', `За олімпіаду «${MK.title}»: тест на 25 завдань із розбором відповідей, справжню обкладинку з балами для друку А4, сертифікат і місце в архіві обкладинок.`],
  ['Коли старт олімпіади?', 'Незабаром. Залиште email — повідомимо першими. А студія працює вже зараз.'],
  ['Для якого віку?', `Для дітей ${MK.ageFrom}–${MK.ageTo} років. Завдання з картинками, без нудної теорії.`],
  ['Чи є переможці?', 'Ні: обкладинку отримує кожен, хто пройшов олімпіаду. Бали показують, скільки ти вже знаєш про моду.'],
  ['Що з даними дитини?', 'На обкладинці й в архіві — лише імʼя та вік. Ні прізвища, ні міста, ні фото дитини.'],
];

export default function ModnyiKodPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: `${MK.title} — онлайн-олімпіада з моди`,
    description: DESCRIPTION,
    url: URL,
    eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    location: { '@type': 'VirtualLocation', url: URL },
    typicalAgeRange: `${MK.ageFrom}-${MK.ageTo}`,
    offers: { '@type': 'Offer', price: MK.price, priceCurrency: 'UAH', url: URL, availability: MK.open ? 'https://schema.org/InStock' : 'https://schema.org/PreOrder' },
    organizer: { '@type': 'Organization', name: 'Dityam.com.ua', url: SITE_URL },
  };
  const faqLd = {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
  };

  return (
    <>
      <main className="mk mk-land">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
        <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" dangerouslySetInnerHTML={{ __html: `<defs>${DEFS}</defs>` }} />

        <section className="mk-hero">
          <div className="mk-hero-grid">
            <div className="mk-hero-txt">
              <p className="mk-kick">Онлайн-олімпіада з моди · Dityam.com.ua · {MK.ageFrom}–{MK.ageTo} років</p>
              <h1 className="mk-h1">Створи свою першу <i>колекцію</i></h1>
              <p className="mk-lead">
                Збери свій образ в онлайн-студії — безкоштовно. Пройди олімпіаду «{MK.title}» про кольори, тканини, стилі й тренди —
                і твій лук стане обкладинкою модного журналу dityam.com.ua.
              </p>
              <div className="mk-actions">
                <Link href={STUDIO} className="mk-btn mk-btn-main">Відкрити студію — безкоштовно</Link>
                <a href="#uchast" className="mk-btn mk-btn-ghost">Олімпіада · {MK.price} грн</a>
              </div>
              <a className="mk-trust" href={SIA_AWARD.href} target="_blank" rel="noopener noreferrer" title={SIA_AWARD.full.uk}>🏆 {SIA_AWARD.short.uk}</a>
            </div>
            <DeskCollage />
          </div>
        </section>

        <section className="mk-wrap">
          <h2 className="mk-h2">Що отримує кожен</h2>
          <div className="mk-cards">
            <div className="mk-card"><b aria-hidden="true">✂️</b><h3>Студія образу</h3><p>Збирай луки з трендових речей і тканин скільки завгодно — безкоштовно.</p></div>
            <div className="mk-card"><b aria-hidden="true">📰</b><h3>Обкладинка</h3><p>Твій лук на обкладинці модного журналу dityam.com.ua — з іменем і балами, для друку А4.</p></div>
            <div className="mk-card"><b aria-hidden="true">💡</b><h3>Розбір відповідей</h3><p>Після тесту — пояснення: що ще варто знати про кольори, тканини й стилі.</p></div>
            <div className="mk-card"><b aria-hidden="true">📜</b><h3>Сертифікат</h3><p>Сертифікат учасника олімпіади — перший рядок у творчому портфоліо.</p></div>
          </div>
        </section>

        <section className="mk-wrap">
          <h2 className="mk-h2" id="yak">Як це працює</h2>
          <ol className="mk-steps">
            <li><b>Збери образ у студії</b><span>Онлайн, з телефона чи компʼютера. Безкоштовно.</span></li>
            <li><b>Пройди олімпіаду</b><span>25 завдань із картинками про моду. Оргвнесок — {MK.price} грн.</span></li>
            <li><b>Отримай обкладинку</b><span>Твій лук, імʼя й бали «{MK.title}: 21 з 25» — на обкладинці.</span></li>
            <li><b>Потрап в архів</b><span>Обкладинка зʼявиться в архіві на сайті, найсміливіші — в Instagram.</span></li>
          </ol>
        </section>

        <section className="mk-wrap">
          <h2 className="mk-h2">Які бувають завдання</h2>
          <p className="mk-p">Без нудної теорії: багато картинок, тканин і того, що ти бачиш у TikTok. Приклади:</p>
          <div className="mk-topics">
            {TOPICS.map(([i, t, q]) => <div key={t} className="mk-topic"><b aria-hidden="true">{i}</b><h3>{t}</h3><p>{q}</p></div>)}
          </div>
          <div className="mk-swrow" aria-hidden="true">
            {['tartan', 'hound', 'polka', 'leo', 'sequin', 'metal'].map((f) => (
              <svg key={f} viewBox="0 0 64 64" dangerouslySetInnerHTML={{ __html: `<rect width="64" height="64" fill="url(#${f})"/>` }} />
            ))}
          </div>
        </section>

        <section className="mk-wrap mk-coversec">
          <div className="mk-cv mk-cv-ex">
            <svg className="mk-cv-bg" viewBox="0 0 300 400" preserveAspectRatio="xMidYMid slice" dangerouslySetInnerHTML={{ __html: '<rect width="300" height="400" fill="url(#tartan)"/>' }} />
            <div className="mk-cv-in" />
            <div className="mk-cv-logo">dityam.com.ua</div>
            <div className="mk-cv-fig"><svg viewBox="0 0 200 440" dangerouslySetInnerHTML={{ __html: lookSvg(COVER_LOOK) }} /></div>
            <div className="mk-cv-title">Осінь у місті</div>
            <div className="mk-cv-badge">МОДНИЙ КОД<b>21/25</b></div>
            <div className="mk-cv-who"><small>Дизайнерка</small>Імʼя, вік</div>
            <span className="mk-cv-tag">Приклад</span>
          </div>
          <div>
            <h2 className="mk-h2">Обкладинка, яку хочеться повісити на стіну</h2>
            <p className="mk-p">Твій образ зі студії, назва луку, імʼя та бали — на обкладинці модного журналу dityam.com.ua. Її можна роздрукувати на А4, показати рідним і друзям.</p>
            <p className="mk-p">Без переможців і тих, хто програв: обкладинку отримує кожен, хто пройшов олімпіаду.</p>
          </div>
        </section>

        <section className="mk-wrap">
          <h2 className="mk-h2">Що безкоштовно, а що за {MK.price} грн</h2>
          <div className="mk-table">
            <div className="mk-col free">
              <p className="mk-col-h">Безкоштовно</p>
              <ul><li>Студія образу — скільки завгодно разів</li><li>Превʼю обкладинки з твоїм образом</li></ul>
              <Link href={STUDIO} className="mk-btn mk-btn-main mk-btn-sm">Відкрити студію</Link>
            </div>
            <div className="mk-col paid">
              <p className="mk-col-h">Олімпіада «{MK.title}» · {MK.price} грн</p>
              <ul>
                <li>Тест на 25 завдань із розбором</li>
                <li>Справжня обкладинка з балами, для друку А4</li>
                <li>Сертифікат учасника</li>
                <li>Місце в архіві обкладинок на сайті</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mk-wrap mk-join" id="uchast">
          <h2 className="mk-h2">Взяти участь в олімпіаді</h2>
          {MK.open ? null : (
            <>
              <p className="mk-p">А поки — збирайте образи в <Link href={STUDIO}>студії</Link>, це безкоштовно.</p>
              <div className="mk-join-box"><Waitlist /></div>
            </>
          )}
        </section>

        <section className="mk-wrap mk-faq">
          <h2 className="mk-h2">Питання й відповіді</h2>
          {FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
        </section>
      </main>
      <Footer />
    </>
  );
}
