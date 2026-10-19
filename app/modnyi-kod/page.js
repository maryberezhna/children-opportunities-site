import '@/app/styles/modnyi-kod.css';
import Link from 'next/link';
import Footer from '../Footer';
import { MK } from '@/lib/modnyi-kod';
import { PRICE, PRICE_FIRST } from '@/lib/wayforpay';
import { lookSvg, DEFS, cleanLook } from '@/lib/modnyi-kod-looks';
import { mkDb } from '@/lib/modnyi-kod-server';
import { monthName } from '@/lib/olimpiada';
import { SIA_AWARD } from '@/lib/awards';
import DeskCollage from './DeskCollage';
import Waitlist from './Waitlist';
import JoinForm from './JoinForm';
import MkTrack from './MkTrack';
import VogueCover from './VogueCover';
import ContactForm from '../contacts/ContactForm';

// «Модний код» — сторінка олімпіади з моди. Порядок і ритм — як /olimpiada
// (Марія, 12.10.2026: «у схожому форматі, але не дизайну»), і вся сторінка в
// одній темі, як «космос» у логіки («дизайну як такого сторінка не має —
// подивись, як красиво з олімпіадою з логіки, вся сторінка в 1 темі»).
// Тема — «ательє»: заголовок літерами з тканин, сливові смуги зі «стібками»,
// краї як після фігурних ножиць, рукописні заголовки, картки на скотчі,
// ножиці й котушки по краях, кнопка після кожного блоку. Не бежевий фон.
//
// 19.10.2026 Марія: «робимо модний код безкоштовним». Оргвнеску 99 грн
// більше немає — студія, тест і обкладинка безкоштовні для всіх, як в
// олімпіаді з логіки (публікація — лише «Обкладинці місяця», 13.10.2026).
// На сторінці лишається відео процесу (public/modnyi-kod-demo.mp4): воно
// показує, що саме дитина робитиме в студії.
//
// Говоримо про це як про НОВУ МОЖЛИВІСТЬ, а не як про зниження ціни (Марія,
// 19.10.2026: «уникай тепер — це нова можливість, про неї майже ніхто не
// знав»): ніде не пишемо «тепер безкоштовно» чи «стало безкоштовним».

const SITE_URL = 'https://dityam.com.ua';
const EMAIL = 'hellodityam.com.ua@gmail.com';
const URL = `${SITE_URL}/${MK.slug}`;
const TITLE = `«${MK.title}» — онлайн-олімпіада з моди для дітей ${MK.ageFrom}–${MK.ageTo} років`;
// SEO (13.10.2026, «чи оптимізовані ці олімпіади під пошук і агентів»): назва
// сайту в заголовку, як у /olimpiada; опис до ~160 знаків і без «без нудних
// тестів» — тест на сторінці є.
const DESCRIPTION = `Безкоштовна онлайн-олімпіада з моди для дітей ${MK.ageFrom}–${MK.ageTo} років: тест про кольори, тканини й стилі, студія образу й обкладинка модного журналу з балами.`;
const START_DATE = '2026-10-12';

export const metadata = {
  title: { absolute: `${TITLE} — Dityam.com.ua` },
  description: DESCRIPTION,
  alternates: { canonical: URL },
  openGraph: { title: `${TITLE} — Dityam.com.ua`, description: DESCRIPTION, url: URL, type: 'website', locale: 'uk_UA', siteName: 'Dityam.com.ua' },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
};

const GETS = [
  ['Студія образу', 'Збирай свій лук із трендових речей і тканин — онлайн, з телефона чи компʼютера.'],
  ['Обкладинка', 'Твій лук на обкладинці модного журналу dityam.com.ua з іменем і балами, для друку А4.'],
  ['Розбір відповідей', 'Що ще варто знати про кольори, тканини й стилі — з підказками, як міркувати.'],
  // Публікації для всіх немає (Марія, 13.10.2026: «це не входить»); публікують
  // лише «Обкладинку місяця» — переможця (там само: «щомісяця визначаємо переможця»).
  ['Шанс на «Обкладинку місяця»', 'Щомісяця журі обирає найкращий образ серед найвищих балів — його обкладинку публікуємо на сайті й у соцмережах Dityam.com.ua.'],
];
const FACTS = [['10–14 років', 'вік учасників'], ['25 завдань', `${MK.minutes} хвилин на спробу`], ['онлайн', 'з телефона чи компʼютера'], ['безкоштовно', 'участь і обкладинка']];
const STEPS = [
  ['Заявка', 'Батьки вказують імʼя дитини й email — і кабінет учасника відкривається одразу.'],
  ['Тест', `25 завдань за ${MK.minutes} хвилин про кольори, тканини, стилі й тренди — у зручний день.`],
  ['Студія', 'Дитина збирає свій лук: речі, тканини, назва образу — як на відео вище.'],
  ['Обкладинка', 'Лук, імʼя й бали — на обкладинці. Плюс розбір відповідей.'],
];
const COVERS = [
  { theme: 'pink', motto: 'Сміливість\u00A0— головний тренд сезону', title: 'Осінь у місті', score: '21/25', name: 'Соломія', age: 11, word: 'Дизайнерка', look: { base: 'set', top: 'oversize', bottom: 'pleat', outer: 'none', shoes: 'loafer', acc: 'beret', f: { top: 'quilt', bottom: 'tartan', shoes: '#161616', acc: '#b0003a', legs: '#161616', base: 'polka', outer: 'hound', cover: 'tartan' } } },
  { theme: 'lavender', motto: 'Колір\u00A0— це настрій, який видно', title: 'Блиск', score: '18/25', name: 'Вероніка', age: 12, word: 'Дизайнерка', look: { base: 'dress1', top: 'tee', bottom: 'skirt', outer: 'bomber', shoes: 'block', acc: 'headphones', f: { base: 'sequin', outer: 'metal', shoes: '#161616', acc: '#ffffff', legs: '#161616', top: 'tee', bottom: 'tartan', cover: 'polka' } } },
  { theme: 'blue', motto: 'Мій стиль\u00A0— мої правила', title: 'Стрітвір', score: '24/25', name: 'Марко', age: 13, word: 'Дизайнер', look: { base: 'set', top: 'jersey', bottom: 'balloon', outer: 'none', shoes: 'sneak', acc: 'beanie', f: { top: '#7a1f2b', bottom: 'denim', outer: '#6b2d5c', shoes: '#161616', acc: 'knit', legs: '#161616', base: 'polka', cover: 'breton' } } },
];
const OVERSIZE_LOOK = {
  base: 'set', top: 'oversize', bottom: 'skirt', outer: 'none', shoes: 'sneak', acc: 'none',
  f: { top: '#1fa5a0', bottom: '#161616', shoes: '#161616', acc: '#e2412b', legs: '#161616', base: 'polka', outer: 'hound', cover: 'tartan' },
};
const FAQ = [
  ['Скільки це коштує?', `Нічого. Безкоштовні всі частини: студія образу, тест на 25 завдань із розбором відповідей, обкладинка з балами для друку А4 і шанс стати «Обкладинкою місяця». А ще після олімпіади можна оформити Dityam+ на місяць за ${PRICE_FIRST} грн замість ${PRICE} грн.`],
  ['Коли можна пройти?', `Будь-коли: одразу після заявки відкриється кабінет учасника, посилання продублюємо на пошту. Тест — ${MK.minutes} хвилин, почати можна в зручний день.`],
  // Марія, 13.10.2026: «чи можна перепроходити олімпіаду — напиши так»; ліміту немає.
  ['Чи можна пройти тест ще раз?', 'Так, скільки завгодно разів — кнопка «Пройти тест ще раз» є в кабінеті. Образ і обкладинка лишаються, а на обкладинці — кращий результат.'],
  ['Як обирають «Обкладинку місяця»?', 'Щомісяця журі Dityam.com.ua дивиться на учасників із найвищими балами за місяць і серед них обирає найкращий образ. Переможець отримує титул «Обкладинка місяця», а його обкладинку публікуємо на сайті й у соцмережах Dityam.com.ua — лише з імʼям і віком. Оголошуємо до 7-го числа наступного місяця.'],
  ['Що з даними дитини?', 'На обкладинці, на сайті й у соцмережах — лише імʼя та вік. Ні прізвища, ні міста, ні фото дитини.'],
];

// Край смуги — як після фігурних ножиць (у логіки — хвиля).
function Pinking({ flip = false }) {
  const teeth = Array.from({ length: 80 }, (_, i) => `L${i * 25 + 12.5} 0 L${i * 25 + 25} 18`).join(' ');
  return (
    <svg className={`mkT-pink${flip ? ' flip' : ''}`} viewBox="0 0 2000 18" preserveAspectRatio="none" aria-hidden="true">
      <path d={`M0 18 ${teeth} L2000 18 Z`} />
    </svg>
  );
}
// Декор по краях — як ракета й планета в логіки.
const Scissors = ({ className }) => (
  <svg className={className} viewBox="0 0 120 90" aria-hidden="true">
    <path d="M40 46 L118 18 M40 46 L118 70" stroke="#d9dde3" strokeWidth="7" strokeLinecap="round" />
    <circle cx="22" cy="28" r="14" fill="none" stroke="#f5c518" strokeWidth="7" /><circle cx="22" cy="64" r="14" fill="none" stroke="#f5c518" strokeWidth="7" />
  </svg>
);
const Spool = ({ className, c = '#ff6b9d' }) => (
  <svg className={className} viewBox="0 0 46 64" aria-hidden="true">
    <rect x="2" y="2" width="42" height="9" rx="2" fill="#e9cf9f" /><rect x="2" y="53" width="42" height="9" rx="2" fill="#e9cf9f" />
    <rect x="7" y="11" width="32" height="42" fill={c} />
    <path d="M7 18 h32 M7 26 h32 M7 34 h32 M7 42 h32" stroke="rgba(255,255,255,.4)" strokeWidth="2" />
  </svg>
);
const SewButton = ({ className }) => (
  <svg className={className} viewBox="0 0 40 40" aria-hidden="true">
    <circle cx="20" cy="20" r="17" fill="#ff6b9d" stroke="#1a1a1a" strokeWidth="2.5" />
    <circle cx="15" cy="15" r="2.6" fill="#1a1a1a" /><circle cx="25" cy="15" r="2.6" fill="#1a1a1a" /><circle cx="15" cy="25" r="2.6" fill="#1a1a1a" /><circle cx="25" cy="25" r="2.6" fill="#1a1a1a" />
  </svg>
);

function Cta({ light = false, note }) {
  return (
    <div className="mkT-cta">
      <a href="#uchast" className="mk-btn-y">Взяти участь</a>
      <span className={light ? 'on-dark' : ''}>безкоштовно{note ? ` · ${note}` : ''}</span>
    </div>
  );
}

const wordCap = (w) => (w === 'дизайнерка' ? 'Дизайнерка' : w === 'дизайнер' ? 'Дизайнер' : '');

// «Обкладинки місяця» — переможці (winner_month ставить адмін). Збій бази —
// просто без блоку: сторінка олімпіади не має падати через нього.
export const revalidate = 3600;
async function loadWinners() {
  try {
    const db = mkDb();
    if (!db) return [];
    const { data } = await db.from('mk_entries')
      .select('child_name, child_age, designer_word, look, look_title, cover_theme, score, max_score, winner_month')
      .not('winner_month', 'is', null).is('refunded_at', null)
      .order('winner_month', { ascending: false }).limit(6);
    return data || [];
  } catch { return []; }
}

export default async function ModnyiKodPage() {
  const winners = await loadWinners();
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: `${MK.title} — онлайн-олімпіада з моди`,
    description: DESCRIPTION,
    url: URL,
    startDate: START_DATE,
    image: `${URL}/opengraph-image`,
    inLanguage: 'uk',
    isAccessibleForFree: false,
    eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    location: { '@type': 'VirtualLocation', url: URL },
    typicalAgeRange: `${MK.ageFrom}-${MK.ageTo}`,
    offers: { '@type': 'Offer', price: 0, priceCurrency: 'UAH', url: URL, validFrom: START_DATE, availability: MK.open ? 'https://schema.org/InStock' : 'https://schema.org/PreOrder' },
    organizer: { '@type': 'Organization', name: 'Dityam.com.ua', url: SITE_URL },
  };
  const faqLd = {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
  };

  return (
    <>
      <main className="mk mkT">
        <MkTrack />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org', '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Головна', item: SITE_URL },
            { '@type': 'ListItem', position: 2, name: `«${MK.title}» — олімпіада з моди`, item: URL },
          ],
        }) }} />
        <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" dangerouslySetInnerHTML={{ __html: `<defs>${DEFS}</defs>` }} />

        {/* Перший екран: назва літерами з тканин + стіл дизайнера */}
        <section className="mkT-hero">
          <div className="mkT-wrap mkT-hero-grid">
            <div>
              <h1 className="mkT-word">
                <span className="mkT-sr">Модний код — онлайн-олімпіада з моди для дітей {MK.ageFrom}–{MK.ageTo} років від Dityam.com.ua</span>
                <svg viewBox="0 0 620 250" aria-hidden="true">
                  <text x="4" y="112" className="w1">МОДНИЙ</text>
                  <text x="4" y="232" className="w2">КОД</text>
                </svg>
              </h1>
              <p className="mkT-sub">від <span className="mkT-brand">dityam.com.ua</span><br />олімпіада з моди, для {MK.ageFrom}–{MK.ageTo} років</p>
              <p className="mkT-lead">Пройди олімпіаду про кольори, тканини, стилі й тренди, збери свій лук в онлайн-студії — і він стане обкладинкою модного журналу. Участь безкоштовна.</p>
              <div className="mkT-actions">
                <a href="#uchast" className="mk-btn-y">Взяти участь безкоштовно</a>
                <a href="#video" className="mk-btn-o">Подивитися, як це працює</a>
              </div>
              <a className="mkT-trust" href={SIA_AWARD.href} target="_blank" rel="noopener noreferrer" title={SIA_AWARD.full.uk}>
                <span className="mkT-medal">SIA<i>2026</i></span><b>{SIA_AWARD.short.uk}</b>
              </a>
            </div>
            <DeskCollage />
          </div>
        </section>

        {/* Обкладинки — одразу після першого екрана (Марія, 13.10.2026: «оце дуже
            продає, може вище поставити»). Нижче — «Обкладинки місяця», щойно
            журі обере першого переможця. */}
        <section className="mkT-wrap mkT-sec mkT-covers-sec">
            <h2 className="mkT-hand ink">Обкладинка, яку хочеться повісити на стіну</h2>
            <p className="mkT-text">Як у справжньому модному журналі: твій лук, назва, речі з образу, імʼя й бали — на обкладинці dityam.com.ua. Для друку А4. А найкращу обкладинку місяця публікуємо на сайті й у соцмережах.</p>
            <ul className="mkT-covers">{COVERS.map((c) => <li key={c.theme}><VogueCover look={c.look} theme={c.theme} title={c.title} score={c.score} name={c.name} age={c.age} word={c.word} motto={c.motto} example /></li>)}</ul>
          {winners.length ? (
            <>
              <h2 className="mkT-hand ink mkT-gap">Обкладинки місяця</h2>
              <p className="mkT-text">Переможці «Модного коду»: журі обирає найкращий образ серед найвищих балів місяця.</p>
              <ul className="mkT-covers">{winners.map((w) => <li key={`${w.winner_month}-${w.child_name}`}><VogueCover look={cleanLook(w.look)} theme={w.cover_theme || 'pink'} title={w.look_title} score={`${w.score}/${w.max_score}`} name={w.child_name} age={w.child_age} word={wordCap(w.designer_word)} winner={`${monthName(w.winner_month)} ${w.winner_month.slice(0, 4)}`} /></li>)}</ul>
            </>
          ) : null}
        </section>

        {/* Відео: як дитина збирає лук у студії й отримує обкладинку */}
        <section className="mkT-wrap mkT-video" id="video">
          <div className="mkT-video-txt">
            <h2 className="mkT-hand ink">Як це виглядає</h2>
            {/* Спершу тест, потім студія — у тому порядку, що й у кабінеті (Марія,
                13.10.2026: «тут нема інформації про тест»). */}
            <p className="mkT-text"><b>Спершу тест:</b> 25 завдань про кольори, тканини, візерунки, стилі й тренди — {MK.minutes} хвилин, можна перепроходити. <b>Потім студія:</b> дитина обирає речі, фарбує їх тканинами з тесту, дає образу назву — і бачить свою обкладинку з балами. Усе онлайн, з телефона чи компʼютера.</p>
            <ul className="mkT-incl">
              <li>тест: 25 завдань, {MK.minutes} хвилин</li><li>розбір відповідей</li><li>студія образу</li><li>обкладинка для друку А4</li><li>шанс на «Обкладинку місяця»</li>
            </ul>
            <p className="mkT-price">Усе це — <b>безкоштовно</b></p>
          </div>
          <div className="mkT-phone">
            <video src="/modnyi-kod-demo.mp4" poster="/modnyi-kod-demo.jpg" autoPlay muted loop playsInline preload="metadata" aria-label="Відео: дитина збирає образ у студії «Модний код» і отримує обкладинку" />
          </div>
        </section>

        {/* Сливова смуга: що отримує кожен + як це працює */}
        <section className="mkT-band">
          <Pinking />
          <Scissors className="mkT-doodle d-sc" />
          <div className="mkT-wrap">
            <h2 className="mkT-hand">Що отримує кожен учасник</h2>
            <div className="mkT-cards">
              {GETS.map(([t, x], i) => (
                <article key={t} className="mkT-card"><i className="mkT-tape" /><span className="mkT-num">{i + 1}</span><h3>{t}</h3><p>{x}</p></article>
              ))}
            </div>
            <Cta light note="усе включено · доплат немає" />

            <h2 id="yak" className="mkT-hand mkT-gap">Як це працює</h2>
            <ul className="mkT-facts">{FACTS.map(([b, s]) => <li key={b}><b>{b}</b><span>{s}</span></li>)}</ul>
            <ol className="mkT-steps">
              {STEPS.map(([t, x], i) => (
                <li key={t}><span className="mkT-num">{i + 1}</span><div><b>{t}</b><p>{x}</p></div></li>
              ))}
            </ol>
            <Cta light note="25 завдань з картинками · з телефона чи компʼютера" />
          </div>
          <Spool className="mkT-doodle d-sp" c="#f5c518" />
          <Pinking flip />
        </section>

        {/* Біла частина: завдання й обкладинки */}
        <section className="mkT-wrap mkT-sec">
          <h2 className="mkT-hand ink">Які бувають завдання</h2>
          <p className="mkT-text">Про моду без нудної теорії — майже кожне з картинкою. Ось 2 зразки, у самому тесті завдання інші.</p>
          <div className="mkT-samples">
            <article className="mkT-q">
              <svg viewBox="0 0 120 90" className="mkT-q-pic" dangerouslySetInnerHTML={{ __html: '<rect width="120" height="90" rx="8" fill="url(#hound)"/>' }} />
              <p>Як називається цей візерунок?</p>
              <ul><li>шотландка</li><li className="ok">гусяча лапка <em>правильно</em></li><li>віші</li><li>горох</li></ul>
            </article>
            <article className="mkT-q">
              <svg viewBox="40 30 120 180" className="mkT-q-pic" dangerouslySetInnerHTML={{ __html: lookSvg(OVERSIZE_LOOK) }} />
              <p>Як називається светр навмисно більшого розміру?</p>
              <ul><li>лонгслів</li><li>худі</li><li className="ok">оверсайз <em>правильно</em></li><li>кроп</li></ul>
            </article>
          </div>
          <Cta note="у тесті — 25 таких завдань, від легких до хитрих" />

          <SewButton className="mkT-doodle d-bt" />
        </section>

        {/* Сливова смуга: участь */}
        <section className="mkT-band mkT-band-2" id="uchast">
          <Pinking />
          {/* 2 рівні колонки гридом: ліворуч заголовок, текст і примітка для
              підписників, праворуч форма; верх колонок на одній лінії (Марія,
              13.10.2026: «розташуй блоки рівно, використовуй флекс чи грід»). */}
          <div className="mkT-wrap mkT-join">
            <div className="mkT-join-txt">
              <h2 className="mkT-hand">Взяти участь</h2>
              <p className="mkT-text on-dark">Участь безкоштовна: тест, студія образу й обкладинка. Кабінет учасника відкриється одразу, посилання продублюємо на пошту.</p>
              <p className="mkT-text on-dark mkT-plusnote">Ви підписник Dityam+? Реєструйте дитину просто в боті — «🏆 Олімпіади», — і тренуйтеся скільки завгодно разів.</p>
            </div>
            <div className="mkT-joinbox">{MK.open ? <JoinForm /> : <Waitlist />}</div>
          </div>
          <Pinking flip />
        </section>

        {/* Правила — завжди відкриті, як в олімпіади з логіки (Марія, 12.10.2026:
            «тут не вистачає положення про олімпіаду»). Лише те, що вирішено;
            30 хвилин (13.10.2026; було 25), спроб скільки завгодно (13.10.2026; було 1), повернення до початку тесту — рішення Марії. */}
        <section className="mkT-wrap mkT-sec" id="pravyla">
          <h2 className="mkT-hand ink">Правила олімпіади</h2>
          <ol className="mkT-rules">
            <li>Організатор — платформа Dityam.com.ua, ФОП Шутяк Марія Олександрівна. Звʼязок: {EMAIL}.</li>
            <li>Учасники — діти {MK.ageFrom}–{MK.ageTo} років. Заявку подає мама, тато чи опікун.</li>
            <li>Участь безкоштовна: онлайн-студія образу, тест, розбір відповідей і обкладинка для друку А4. Платити не треба ні за що.</li>
            <li>Тест — 25 завдань із 4 варіантами відповіді про кольори, тканини, візерунки, стилі, тренди, українське вбрання й свідому моду, {MK.minutes} хвилин на спробу. Проходити можна скільки завгодно разів — на обкладинці лишається кращий результат. Дитина відповідає самостійно. Бали — кількість правильних відповідей із 25.</li>
            <li>Студія образу — онлайн: дитина обирає речі й тканини та дає образу назву. Фото дитини й малюнки не потрібні.</li>
            <li>Обкладинка — з образом зі студії, назвою образу, імʼям і віком дитини та її балами. Обкладинку отримує кожен учасник.</li>
            <li>«Обкладинка місяця»: щомісяця журі Dityam.com.ua серед учасників із найвищими балами за місяць обирає найкращий образ. Переможця оголошуємо до 7-го числа наступного місяця в Telegram-каналі й на цій сторінці. Переможець отримує титул «Обкладинка місяця», а його обкладинку публікуємо на сайті й у соцмережах Dityam.com.ua — лише з імʼям і віком дитини, без прізвища, міста й фото; перед публікацією переглядаємо назву образу. Батьки можуть відмовитися від публікації або попросити прибрати обкладинку, написавши на {EMAIL}.</li>
            <li>Дані: імʼя й вік дитини потрібні для обкладинки, email — для звʼязку з вами. Деталі — в <a href="/privacy">Політиці конфіденційності</a> та <a href="/terms">Умовах</a>.</li>
            <li>Підписники Dityam+ можуть зареєструвати дитину просто в боті @DityamPlusBot (меню «Олімпіади») і тренуватися без обмежень.</li>
            <li>Олімпіада незалежна: вона не є учнівською олімпіадою МОН і не дає пільг при вступі.</li>
          </ol>
        </section>

        <section className="mkT-wrap mkT-sec">
          <h2 className="mkT-hand ink">Питання й відповіді</h2>
          <div className="mkT-faq">{FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div>

          <h2 className="mkT-hand ink mkT-gap">Залишилися питання? Напишіть нам</h2>
          <div className="mkT-contact"><ContactForm defaultType="olimpiada" fixedType /></div>
        </section>
      </main>
      <Footer />
    </>
  );
}
