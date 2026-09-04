import Link from 'next/link';
import SuggestModal, { SuggestOpenButton } from './SuggestModal';

// Футер редизайну (вересень 2026): бренд + три колонки. Живі цифри переїхали
// в хіро головної — тут їх більше не дублюємо, щоб футер не сперечався зі
// сторінкою. Двомовність лишається: /en-сторінки передають lang="en".

const MONOBANK_URL = 'https://send.monobank.ua/jar/F72fDrV2c';
const TELEGRAM_URL = 'https://t.me/dityam_com_ua';
const INSTAGRAM_URL = 'https://www.instagram.com/dityam.com.ua';

const T = {
  uk: {
    about: 'Платформа безкоштовних і доступних програм для дітей 0–18 років '
      + 'в Україні та за кордоном. Зроблено на ентузіазмі, без реклами.',
    contact: "Зв'язок",
    telegram: 'Telegram-канал',
    instagram: 'Instagram',
    suggest: 'Запропонувати можливість',
    write: 'Написати нам',
    catalogue: 'Каталог',
    all: 'Всі можливості',
    categories: 'Всі категорії',
    verify: 'Як ми перевіряємо',
    press: 'Преса про нас',
    plus: 'Dityam+',
    support: 'Підтримати',
    donate: 'Донат на monobank',
    fuel: 'Ваша допомога — паливо для проєкту.',
    privacy: 'Конфіденційність',
    terms: 'Умови',
    made: "Зроблено з любов'ю в Україні 🇺🇦",
    hrefs: {
      all: '/', categories: '/kategorii', verify: '/yak-my-pereviriaiemo',
      press: '/press', plus: '/pidbirka', contacts: '/contacts',
      privacy: '/privacy', terms: '/terms',
    },
  },
  en: {
    about: 'A platform of free and affordable programs for children aged 0–18 '
      + 'in Ukraine and abroad. Built on enthusiasm, no ads.',
    contact: 'Contact',
    telegram: 'Telegram channel',
    instagram: 'Instagram',
    suggest: 'Suggest an opportunity',
    write: 'Write to us',
    catalogue: 'Catalogue',
    all: 'All opportunities',
    categories: 'All categories',
    verify: 'How we verify',
    press: 'Press about us',
    plus: 'Dityam+',
    support: 'Support',
    donate: 'Donate via monobank',
    fuel: 'Your help fuels the project.',
    privacy: 'Privacy',
    terms: 'Terms',
    made: 'Made with love in Ukraine 🇺🇦',
    hrefs: {
      all: '/en', categories: '/en/categories', verify: '/en/how-we-verify',
      press: '/en/press', plus: '/en/plus', contacts: '/en/contacts',
      privacy: '/en/privacy', terms: '/en/terms',
    },
  },
};

export default function Footer({ lang = 'uk' }) {
  const t = T[lang] || T.uk;
  const h = t.hrefs;

  return (
    <footer className="v2-footer">
      <div className="v2-footer-inner">
        <div className="v2-footer-grid">
          <div className="v2-footer-brand">
            <div className="v2-logo" style={{ gap: 10 }}>
              <span style={{ fontSize: 24 }} aria-hidden="true">🧡</span>
              <span className="v2-logo-script" style={{ fontSize: 34 }}>dityam.com.ua</span>
            </div>
            <p>{t.about}</p>
          </div>

          <div className="v2-footer-col">
            <span className="v2-footer-col-title">{t.contact}</span>
            <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer">{t.telegram}</a>
            <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">{t.instagram}</a>
            <SuggestOpenButton className="v2-footer-suggest">{t.suggest}</SuggestOpenButton>
            <Link href={h.contacts}>{t.write}</Link>
          </div>

          <div className="v2-footer-col">
            <span className="v2-footer-col-title">{t.catalogue}</span>
            <Link href={h.all}>{t.all}</Link>
            <Link href={h.categories}>{t.categories}</Link>
            <Link href={h.verify}>{t.verify}</Link>
            <Link href={h.press}>{t.press}</Link>
            <Link href={h.plus}>{t.plus}</Link>
          </div>

          <div className="v2-footer-col">
            <span className="v2-footer-col-title">{t.support}</span>
            <a href={MONOBANK_URL} target="_blank" rel="noopener noreferrer">{t.donate}</a>
            <p className="v2-footer-note">{t.fuel}</p>
          </div>
        </div>

        <div className="v2-footer-bottom">
          <span>© 2026 dityam.com.ua · <Link href={h.privacy} style={{ color: 'inherit' }}>{t.privacy}</Link> · <Link href={h.terms} style={{ color: 'inherit' }}>{t.terms}</Link></span>
          <span style={{ whiteSpace: 'nowrap' }}>{t.made}</span>
        </div>
      </div>

      {/* Поп-ап живе у футері, бо футер є на кожній сторінці — і кнопка
          «Запропонувати можливість» працює звідусіль. */}
      <SuggestModal lang={lang} />
    </footer>
  );
}
