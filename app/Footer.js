import Link from 'next/link';
import SubscribeButton from './SubscribeButton';
import { TOPIC_NAV, topicPath } from '@/lib/topics';
import { countActiveOpportunities, countActiveSources, FALLBACK } from '@/lib/supabase';

// Живі цифри довіри: ті самі, що на /press — тягнуться з бази, щоб число
// ніколи не застаріло в футері. Збій запиту → занижений фолбек із lib.
async function getProof() {
  try {
    const [active, sources] = await Promise.all([
      countActiveOpportunities(),
      countActiveSources(),
    ]);
    return { active, sources };
  } catch {
    return { active: null, sources: null };
  }
}

// Футер двомовний, бо /en його не мала зовсім: англійська сторінка просто
// обривалась після останнього абзацу — ні навігації, ні контактів, ні цифр,
// ні юридичних сторінок. Дублювати компонент не можна: у ньому живі цифри й
// два десятки посилань, і копія розійшлася б із оригіналом за місяць.
// Там, де англійська сторінка існує, посилання веде на неї. Решта — на
// українську: краще чесно привести на існуючу сторінку, ніж на 404.
const HREF = {
  uk: {
    home: '/', categories: '/kategorii', verify: '/yak-my-pereviriaiemo',
    about: '/about', press: '/press', support: '/support',
    contacts: '/contacts', privacy: '/privacy', terms: '/terms',
    plus: '/pidbirka',
  },
  en: {
    home: '/en', categories: '/en/categories', verify: '/en/how-we-verify',
    about: '/en/about', press: '/en/press', support: '/en/support',
    contacts: '/en/contacts', privacy: '/en/privacy', terms: '/en/terms',
    plus: '/en/plus',
  },
};

const STRINGS = {
  uk: {
    write: 'Написати',
    writeAria: 'Написати нам',
    writeSubject: 'Зауваження%20до%20dityam.com.ua',
    subscribe: 'Підписатись',
    subscribeAria: 'Підписатись на розсилку',
    plus: 'Dityam+ early list',
    tag: 'Можливості для кожної дитини',
    about: 'Всі можливості для українських дітей 0–18 років — в одному місці. Безкоштовно, без реклами.',
    proofOpps: 'перевірених можливостей',
    proofSources: 'джерел · оновлюється щодня',
    proofLinks: 'лінки перевіряються щоночі ✓',
    catalogue: 'Каталог',
    allOpps: 'Всі можливості',
    allCategories: 'Всі категорії',
    parents: 'Батькам',
    plusLink: 'Dityam+ — персональна добірка',
    telegram: 'Telegram-канал',
    suggest: 'Запропонувати можливість',
    suggestSubject: 'Додати%20можливість%20на%20dityam.com.ua',
    verify: 'Як ми перевіряємо дані',
    project: 'Проєкт',
    aboutUs: 'Про нас',
    press: 'Для преси',
    support: 'Підтримати проєкт',
    donate: 'Донат на monobank',
    contacts: 'Написати нам · контакти',
    privacy: 'Конфіденційність',
    terms: 'Оферта · Повернення',
    copy: '© 2026 dityam.com.ua · Зроблено з любов’ю в Україні 🇺🇦',
  },
  en: {
    write: 'Write to us',
    writeAria: 'Write to us',
    writeSubject: 'Feedback%20on%20dityam.com.ua',
    subscribe: 'Subscribe',
    subscribeAria: 'Subscribe to the newsletter',
    plus: 'Dityam+ early list',
    tag: 'Opportunities for every child',
    about: 'Every opportunity for Ukrainian children aged 0–18 in one place. Free, no ads.',
    proofOpps: 'verified opportunities',
    proofSources: 'sources · updated daily',
    proofLinks: 'links checked nightly ✓',
    catalogue: 'Catalogue',
    allOpps: 'All opportunities',
    allCategories: 'All categories',
    parents: 'For parents',
    plusLink: 'Dityam+ — a personal selection',
    telegram: 'Telegram channel',
    suggest: 'Suggest an opportunity',
    suggestSubject: 'Add%20an%20opportunity%20to%20dityam.com.ua',
    verify: 'How we verify data',
    project: 'Project',
    aboutUs: 'About us',
    press: 'For press',
    support: 'Support the project',
    donate: 'Donate via monobank',
    contacts: 'Contact us',
    privacy: 'Privacy',
    terms: 'Terms · Refunds',
    copy: '© 2026 dityam.com.ua · Made with love in Ukraine 🇺🇦',
  },
};

// Підбірки ведуть на українські сторінки, але підпис у списку має читатись:
// колонка з незрозумілих слів на англійській сторінці — та сама поламаність,
// що й порожня колонка в героєві. Підпис беремо з lib/topics.js, де він
// лежить поруч з українським: власна копія списку тут уже одного разу
// розійшлася з оригіналом і в англійський футер протекли «Конкурси».
export default async function Footer({ lang = 'uk' }) {
  const { active: activeCount, sources: sourceCount } = await getProof();
  const t = STRINGS[lang] || STRINGS.uk;
  const href = HREF[lang] || HREF.uk;
  const topicLabel = (item) =>
    (lang === 'en' && item.labelEn) || item.label;

  return (
    <footer className="site-footer" lang={lang}>
      <div className="footer-actions">
        <a
          href={`mailto:maryberezhna@gmail.com?subject=${t.writeSubject}`}
          className="footer-action-btn footer-action-write"
          aria-label={t.writeAria}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
            <polyline points="22,6 12,13 2,6"></polyline>
          </svg>
          <span>{t.write}</span>
        </a>

        <SubscribeButton
          className="footer-action-btn footer-action-subscribe"
          ariaLabel={t.subscribeAria}
          source="footer"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          <span>{t.subscribe}</span>
        </SubscribeButton>

        <a
          href="https://www.instagram.com/dityam.com.ua"
          target="_blank"
          rel="noopener noreferrer"
          className="footer-action-btn footer-action-insta"
          aria-label="Instagram"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
          </svg>
          <span>Instagram</span>
        </a>

        <Link
          href={href.plus}
          className="footer-action-btn footer-action-donate"
          aria-label="Dityam+ early list"
        >
          <span className="footer-action-heart">🚀</span>
          <span>{t.plus}</span>
        </Link>
      </div>

      <div className="footer-content">
        <div className="footer-section footer-section-brand">
          <div className="footer-brand">
            <span className="footer-logo">🧡</span>
            <div>
              <div className="footer-brand-name">
                <span>dityam.com.ua</span>
              </div>
              <div className="footer-brand-tag">{t.tag}</div>
            </div>
          </div>
          <p className="footer-about">{t.about}</p>
          <div className="footer-proof">
            <span><b>{activeCount ?? FALLBACK.opportunities}</b> {t.proofOpps}</span>
            <span><b>{sourceCount ?? FALLBACK.sources}</b> {t.proofSources}</span>
            <span>{t.proofLinks}</span>
          </div>
        </div>

        <div className="footer-section">
          <div className="footer-title">{t.catalogue}</div>
          <Link href={href.home} className="footer-link"><span>{t.allOpps}</span></Link>
          <Link href={href.categories} className="footer-link"><span>{t.allCategories}</span></Link>
          {TOPIC_NAV.map((item) => (
            <Link key={item.slug} href={topicPath(item, lang)} className="footer-link">
              <span>{topicLabel(item)}</span>
            </Link>
          ))}
          {/* Лише українською: англійської версії календаря ще немає, а вести
              англомовного читача на українську сторінку гірше, ніж не вести. */}
          {lang !== 'en' && (
            <Link href="/dedlainy" className="footer-link"><span>Календар дедлайнів</span></Link>
          )}
        </div>

        <div className="footer-section">
          <div className="footer-title">{t.parents}</div>
          <Link href={href.plus} className="footer-link"><span>{t.plusLink}</span></Link>
          <a
            href="https://t.me/dityam_com_ua"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-link"
          >
            <span>{t.telegram}</span>
          </a>
          <a
            href={`mailto:maryberezhna@gmail.com?subject=${t.suggestSubject}`}
            className="footer-link"
          >
            <span>{t.suggest}</span>
          </a>
          <Link href={href.verify} className="footer-link">
            <span>{t.verify}</span>
          </Link>
        </div>

        <div className="footer-section">
          <div className="footer-title">{t.project}</div>
          <Link href={href.about} className="footer-link"><span>{t.aboutUs}</span></Link>
          <Link href={href.press} className="footer-link"><span>{t.press}</span></Link>
          <Link href={href.support} className="footer-link"><span>{t.support}</span></Link>
          <a
            href="https://send.monobank.ua/jar/F72fDrV2c"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-link"
          >
            <span>{t.donate}</span>
          </a>
          <Link href={href.contacts} className="footer-link"><span>{t.contacts}</span></Link>
          <Link href={href.privacy} className="footer-link"><span>{t.privacy}</span></Link>
          <Link href={href.terms} className="footer-link"><span>{t.terms}</span></Link>
        </div>
      </div>

      <div className="footer-bottom">
        <div className="footer-copy">{t.copy}</div>
        <div className="footer-social">
          <a href="https://t.me/dityam_com_ua" target="_blank" rel="noopener noreferrer" className="footer-social-link">Telegram</a>
          <a href="https://www.instagram.com/dityam.com.ua" target="_blank" rel="noopener noreferrer" className="footer-social-link">Instagram</a>
        </div>
      </div>
    </footer>
  );
}
