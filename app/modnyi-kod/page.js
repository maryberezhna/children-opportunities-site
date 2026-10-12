import '@/app/styles/modnyi-kod.css';
import Link from 'next/link';
import Footer from '../Footer';
import { MK } from '@/lib/modnyi-kod';
import { lookSvg, DEFS } from '@/lib/modnyi-kod-looks';
import { SIA_AWARD } from '@/lib/awards';
import DeskCollage from './DeskCollage';
import Waitlist from './Waitlist';
import ContactForm from '../contacts/ContactForm';

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


const GETS = [
  ['Студія образу', 'Збирай луки з трендових речей і тканин — безкоштовно.'],
  ['Обкладинка', 'Твій лук на обкладинці модного журналу з іменем і балами.'],
  ['Розбір відповідей', 'Що ще варто знати про кольори, тканини й стилі.'],
  ['Сертифікат', 'Сертифікат учасника — у творче портфоліо.'],
];
const COVERS = [
  { fabric: 'tartan', title: 'Осінь у місті', score: '21/25', look: { base: 'set', top: 'oversize', bottom: 'pleat', outer: 'none', shoes: 'boots', acc: 'beret', f: { top: 'quilt', bottom: 'tartan', shoes: '#161616', acc: '#e2412b', legs: '#161616', base: 'polka', outer: 'hound', cover: 'tartan' } } },
  { fabric: 'polka', title: 'Блиск', score: '18/25', look: { base: 'dress1', top: 'tee', bottom: 'skirt', outer: 'none', shoes: 'block', acc: 'headphones', f: { base: 'sequin', top: 'tee', bottom: 'tartan', shoes: '#ffffff', acc: '#d6336c', legs: '#f3d3b8', outer: 'hound', cover: 'polka' } } },
  { fabric: 'breton', title: 'Стрітвір', score: '24/25', look: { base: 'set', top: 'jersey', bottom: 'balloon', outer: 'bomber', shoes: 'sneak', acc: 'beanie', f: { top: '#7a1f2b', bottom: 'denim', outer: '#6b2d5c', shoes: '#161616', acc: '#f5c518', legs: '#161616', base: 'polka', cover: 'breton' } } },
];
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
          <h2 className="mk-h2">Що отримує кожен учасник</h2>
          <div className="mk-gets">
            {GETS.map(([t, x], i) => <article key={t} className="mk-get"><span className="mk-num">{i + 1}</span><h3>{t}</h3><p>{x}</p></article>)}
          </div>
        </section>

        <section className="mk-wrap">
          <h2 className="mk-h2" id="yak">Як це працює</h2>
          <ul className="mk-facts">
            <li><b>25</b><span>завдань із картинками</span></li>
            <li><b>{MK.ageFrom}–{MK.ageTo}</b><span>років</span></li>
            <li><b>{MK.price} грн</b><span>оргвнесок</span></li>
            <li><b>онлайн</b><span>з телефона чи компʼютера</span></li>
          </ul>
          <ol className="mk-steps2">
            <li><span className="mk-num">1</span><div><b>Збери образ у студії</b><p>Безкоштовно, скільки завгодно разів.</p><Link href={STUDIO}>Відкрити студію →</Link></div></li>
            <li><span className="mk-num">2</span><div><b>Подай заявку</b><p>Батьки вказують імʼя дитини й email та сплачують оргвнесок.</p></div></li>
            <li><span className="mk-num">3</span><div><b>Пройди тест</b><p>25 завдань про кольори, тканини, стилі й тренди — у зручний день.</p></div></li>
            <li><span className="mk-num">4</span><div><b>Отримай обкладинку</b><p>Твій лук, імʼя й бали — на обкладинці, плюс розбір відповідей і сертифікат.</p></div></li>
          </ol>
        </section>

        <section className="mk-wrap">
          <h2 className="mk-h2">Які бувають завдання</h2>
          <p className="mk-p">Про моду без нудної теорії — майже кожне з картинкою. Ось 2 зразки, у самому тесті завдання інші.</p>
          <div className="mk-samples">
            <article className="mk-q">
              <svg viewBox="0 0 120 90" className="mk-q-pic" dangerouslySetInnerHTML={{ __html: '<rect width="120" height="90" rx="8" fill="url(#hound)"/>' }} />
              <p>Як називається цей візерунок?</p>
              <ul className="mk-ans"><li>шотландка</li><li className="ok">гусяча лапка <em>правильно</em></li><li>віші</li><li>горох</li></ul>
            </article>
            <article className="mk-q">
              <svg viewBox="40 30 120 180" className="mk-q-pic" dangerouslySetInnerHTML={{ __html: lookSvg(OVERSIZE_LOOK) }} />
              <p>Як називається светр навмисно більшого розміру?</p>
              <ul className="mk-ans"><li>лонгслів</li><li>худі</li><li className="ok">оверсайз <em>правильно</em></li><li>кроп</li></ul>
            </article>
          </div>
        </section>

        <section className="mk-wrap">
          <h2 className="mk-h2">Обкладинка, яку хочеться повісити на стіну</h2>
          <p className="mk-p">Твій лук зі студії, назва, імʼя та бали — на обкладинці модного журналу dityam.com.ua. Для друку А4.</p>
          <ul className="mk-covers3">
            {COVERS.map((c) => (
              <li key={c.fabric}>
                <div className="mk-cv">
                  <svg className="mk-cv-bg" viewBox="0 0 300 400" preserveAspectRatio="xMidYMid slice" dangerouslySetInnerHTML={{ __html: `<rect width="300" height="400" fill="url(#${c.fabric})"/>` }} />
                  <div className="mk-cv-in" />
                  <div className="mk-cv-logo">dityam.com.ua</div>
                  <div className="mk-cv-fig"><svg viewBox="0 0 200 440" dangerouslySetInnerHTML={{ __html: lookSvg(c.look) }} /></div>
                  <div className="mk-cv-title">{c.title}</div>
                  <div className="mk-cv-badge">МОДНИЙ КОД<b>{c.score}</b></div>
                  <span className="mk-cv-tag">Приклад</span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="mk-wrap mk-pub">
          <h2 className="mk-h2">Публікуємо на сайті й у соцмережах</h2>
          <p className="mk-p">Обкладинки учасників зʼявляються на сайті й у соцмережах Dityam.com.ua — лише з імʼям і віком, без прізвища й фото дитини.</p>
        </section>

        <section className="mk-wrap mk-join" id="uchast">
          <h2 className="mk-h2">Взяти участь</h2>
          {MK.open ? null : <div className="mk-join-box"><Waitlist /></div>}
        </section>

        <section className="mk-wrap mk-faq">
          <h2 className="mk-h2">Питання й відповіді</h2>
          {FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
        </section>

        <section className="mk-wrap mk-contact">
          <h2 className="mk-h2">Залишилися питання? Напишіть нам</h2>
          <ContactForm defaultType="olimpiada" fixedType />
        </section>
      </main>
      <Footer />
    </>
  );
}
