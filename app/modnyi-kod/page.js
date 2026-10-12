import '@/app/styles/modnyi-kod.css';
import Footer from '../Footer';
import { MK } from '@/lib/modnyi-kod';
import Studio from './Studio';

// «Модний код» — онлайн-студія образу (безкоштовно) і олімпіада з моди
// (оргвнесок 99 грн) для дітей 10–14 років. Рішення Марії 12.10.2026.
// SEO: «олімпіада з моди» майже не шукають; шукають «юний дизайнер», «тест
// який у мене стиль одягу», «мода для підлітків» — ці слова в title/description.

const SITE_URL = 'https://dityam.com.ua';
const URL = `${SITE_URL}/${MK.slug}`;
const TITLE = `«${MK.title}»: онлайн-студія образу для юного дизайнера ${MK.ageFrom}–${MK.ageTo} років`;
const DESCRIPTION = `Безкоштовна онлайн-студія від Dityam.com.ua: дитина збирає свій образ із трендових речей і тканин і бачить його на обкладинці модного журналу. Мода для підлітків, кольори, тканини, стилі — і олімпіада з моди «${MK.title}».`;

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: URL },
  openGraph: { title: TITLE, description: DESCRIPTION, url: URL, type: 'website', locale: 'uk_UA', siteName: 'Dityam.com.ua' },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
};

const FAQ = [
  ['Студія справді безкоштовна?', 'Так. Збирати образи можна скільки завгодно разів, без реєстрації й без оплати. Образ зберігається в цьому браузері.'],
  ['За що оргвнесок 99 грн?', `За олімпіаду «${MK.title}»: тест на 25 завдань про кольори, тканини, стилі й тренди з розбором відповідей, справжню обкладинку з балами для друку А4, сертифікат і місце в архіві обкладинок на сайті.`],
  ['Коли старт олімпіади?', 'Незабаром. Залиште email у студії після кнопки «Готово» — повідомимо першими.'],
  ['Що з даними дитини?', 'На обкладинці й у архіві — лише імʼя та вік. Ні прізвища, ні міста, ні фото дитини. Студія не потребує жодних даних.'],
];

export default function ModnyiKodPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: `${MK.title} — онлайн-студія образу`,
    url: URL,
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'Web',
    inLanguage: 'uk',
    isAccessibleForFree: true,
    audience: { '@type': 'PeopleAudience', suggestedMinAge: MK.ageFrom, suggestedMaxAge: MK.ageTo },
    offers: { '@type': 'Offer', price: 0, priceCurrency: 'UAH' },
    publisher: { '@type': 'Organization', name: 'Dityam.com.ua', url: SITE_URL },
  };
  const faqLd = {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
  };
  return (
    <>
      <main className="mk">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
        <header className="mk-head">
          <p className="mk-kick">{MK.title} · студія юного дизайнера · онлайн · {MK.ageFrom}–{MK.ageTo} років</p>
          <h1>Створи свій <i>образ</i></h1>
        </header>

        <Studio />

        <section className="mk-wrap">
          <h2>Що безкоштовно, а що за {MK.price} грн</h2>
          <div className="mk-table">
            <div className="mk-col free">
              <p className="mk-col-h">Безкоштовно</p>
              <ul><li>Студія образу — скільки завгодно разів</li><li>Превʼю обкладинки з твоїм образом</li></ul>
            </div>
            <div className="mk-col paid">
              <p className="mk-col-h">Олімпіада «{MK.title}» · {MK.price} грн</p>
              <ul>
                <li>Тест на 25 завдань: кольори, тканини, стилі, тренди — з розбором</li>
                <li>Справжня обкладинка з балами, для друку А4</li>
                <li>Сертифікат учасника</li>
                <li>Місце в архіві обкладинок на сайті</li>
              </ul>
              {MK.open ? null : <p className="mk-soon">Олімпіада стартує незабаром — залиште email у студії після «Готово».</p>}
            </div>
          </div>
        </section>

        <section className="mk-wrap mk-faq">
          <h2>Часті питання</h2>
          {FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
        </section>
      </main>
      <Footer />
    </>
  );
}
