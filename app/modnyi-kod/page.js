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

const STUDIO_LOOK = {
  base: 'set', top: 'jersey', bottom: 'balloon', outer: 'none', shoes: 'sneak', acc: 'headphones',
  f: { top: '#7a1f2b', bottom: 'denim', shoes: '#161616', acc: '#f5c518', legs: '#161616', base: 'polka', outer: 'hound', cover: 'tartan' },
};
const OVERSIZE_LOOK = {
  base: 'set', top: 'oversize', bottom: 'skirt', outer: 'none', shoes: 'sneak', acc: 'none',
  f: { top: '#1fa5a0', bottom: '#161616', shoes: '#161616', acc: '#e2412b', legs: '#161616', base: 'polka', outer: 'hound', cover: 'tartan' },
};

const FAQ = [
  ['Студія справді безкоштовна?', 'Так. Збирати образи можна скільки завгодно разів, без реєстрації й без оплати. Образ зберігається в браузері.'],
  ['За що оргвнесок 99 грн?', `За олімпіаду «${MK.title}»: тест на 25 завдань із розбором відповідей, справжню обкладинку з балами для друку А4, сертифікат — і публікуємо обкладинку на сайті й у соцмережах Dityam.com.ua.`],
  ['Коли старт олімпіади?', 'Незабаром. Залиште email — повідомимо першими. А студія працює вже зараз.'],
  ['Що з даними дитини?', 'На обкладинці, на сайті й у соцмережах — лише імʼя та вік. Ні прізвища, ні міста, ні фото дитини.'],
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
          <h2 className="mk-h2" id="yak">Як це працює</h2>
          <div className="mk-flow">
            <Link href={STUDIO} className="mk-fstep pink">
              <div className="mk-fart mk-fart-grid">
                <svg viewBox="0 0 200 440" className="mk-fart-fig" dangerouslySetInnerHTML={{ __html: lookSvg(STUDIO_LOOK) }} />
                {['tartan', 'leo', 'polka'].map((f, i) => (
                  <svg key={f} viewBox="0 0 60 60" className={`mk-fart-sw s${i}`} dangerouslySetInnerHTML={{ __html: `<rect width="60" height="60" fill="url(#${f})"/>` }} />
                ))}
              </div>
              <p><b>1</b> Збери образ у студії <span>безкоштовно</span></p>
            </Link>
            <div className="mk-fstep yellow">
              <div className="mk-fart">
                <div className="mk-q mk-q-mini">
                  <svg viewBox="0 0 60 60" className="mk-q-pic" dangerouslySetInnerHTML={{ __html: '<rect width="60" height="60" fill="url(#hound)"/>' }} />
                  <p>Як називається цей візерунок?</p>
                  <div className="mk-opts"><span>шотландка</span><span>гусяча лапка</span><span>горох</span></div>
                </div>
              </div>
              <p><b>2</b> Пройди олімпіаду <span>{MK.price} грн</span></p>
            </div>
            <div className="mk-fstep mint">
              <div className="mk-fart">
                <div className="mk-cv mk-cv-mini">
                  <svg className="mk-cv-bg" viewBox="0 0 300 400" preserveAspectRatio="xMidYMid slice" dangerouslySetInnerHTML={{ __html: '<rect width="300" height="400" fill="url(#tartan)"/>' }} />
                  <div className="mk-cv-in" />
                  <div className="mk-cv-logo">dityam.com.ua</div>
                  <div className="mk-cv-fig"><svg viewBox="0 0 200 440" dangerouslySetInnerHTML={{ __html: lookSvg(COVER_LOOK) }} /></div>
                  <div className="mk-cv-badge">МОДНИЙ КОД<b>21/25</b></div>
                </div>
              </div>
              <p><b>3</b> Отримай обкладинку <span>з балами</span></p>
            </div>
          </div>
        </section>

        <section className="mk-wrap">
          <h2 className="mk-h2">Приклади завдань</h2>
          <div className="mk-qs">
            <div className="mk-q">
              <svg viewBox="0 0 120 90" className="mk-q-pic" dangerouslySetInnerHTML={{ __html: '<rect width="120" height="90" rx="8" fill="url(#tartan)"/>' }} />
              <p>Як називається ця тканина?</p>
              <div className="mk-opts"><span>віші</span><span>шотландка</span><span>гусяча лапка</span><span>горох</span></div>
            </div>
            <div className="mk-q">
              <svg viewBox="0 0 120 90" className="mk-q-pic" dangerouslySetInnerHTML={{ __html: '<circle cx="60" cy="45" r="34" fill="#e2412b" stroke="#1a1a1a" stroke-width="2.5"/>' }} />
              <p>Який колір протилежний червоному на колірному колі?</p>
              <div className="mk-opts mk-dots">{['#2f9e44', '#2b4a8f', '#f5c518', '#7a3fbf'].map((c) => <i key={c} style={{ background: c }} />)}</div>
            </div>
            <div className="mk-q">
              <svg viewBox="40 30 120 180" className="mk-q-pic" dangerouslySetInnerHTML={{ __html: lookSvg(OVERSIZE_LOOK) }} />
              <p>Як називається такий светр?</p>
              <div className="mk-opts"><span>лонгслів</span><span>оверсайз</span><span>худі</span><span>кроп</span></div>
            </div>
          </div>
        </section>

        <section className="mk-wrap mk-join" id="uchast">
          <div className="mk-prices">
            <Link href={STUDIO} className="mk-price free"><b>Студія</b><span>безкоштовно</span></Link>
            <div className="mk-price paid"><b>Олімпіада</b><span>{MK.price} грн</span></div>
          </div>
          {MK.open ? null : <div className="mk-join-box"><Waitlist /></div>}
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
