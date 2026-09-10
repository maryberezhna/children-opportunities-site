import Link from 'next/link';
import SuggestModal, { SuggestOpenButton } from './SuggestModal';
import { TOPIC_NAV, topicPath } from '@/lib/topics';

// Футер (вересень 2026, другий підхід): чорна смуга на всю ширину, великий
// рукописний wordmark по центру, під ним чотири колонки посилань, ряд
// «Слідкувати» і копірайт. Живі цифри й опис проєкту тут не дублюємо —
// вони в хіро головної. Двомовність лишається: /en-сторінки передають
// lang="en", підбірки беруть адреси через topicPath, щоб з англійської
// не вести на українські сторінки.

const MONOBANK_URL = 'https://send.monobank.ua/jar/F72fDrV2c';
const TELEGRAM_URL = 'https://t.me/dityam_com_ua';
const INSTAGRAM_URL = 'https://www.instagram.com/dityam.com.ua';

const T = {
  uk: {
    markLabel: 'dityam.com.ua — на головну',
    opportunities: 'Можливості',
    all: 'Всі можливості',
    categories: 'Всі категорії',
    deadlines: 'Дедлайни',
    plus: 'Dityam+',
    topics: 'Підбірки',
    about: 'Про нас',
    aboutProject: 'Про проєкт',
    verify: 'Як ми перевіряємо',
    press: 'Преса про нас',
    write: 'Написати нам',
    support: 'Підтримати',
    donate: 'Донат на monobank',
    otherWays: 'Як ще допомогти',
    suggest: 'Запропонувати можливість',
    follow: 'Слідкувати',
    telegram: 'телеграм',
    instagram: 'інстаграм',
    privacy: 'Конфіденційність',
    terms: 'Умови',
    made: "Зроблено з любов'ю в Україні 🇺🇦",
    hrefs: {
      all: '/', categories: '/kategorii', deadlines: '/dedlainy', plus: '/pidbirka',
      about: '/about', verify: '/yak-my-pereviriaiemo', press: '/press',
      contacts: '/contacts', support: '/support',
      privacy: '/privacy', terms: '/terms',
    },
  },
  en: {
    markLabel: 'dityam.com.ua — home',
    opportunities: 'Opportunities',
    all: 'All opportunities',
    categories: 'All categories',
    deadlines: null,
    plus: 'Dityam+',
    topics: 'Collections',
    about: 'About',
    aboutProject: 'About the project',
    verify: 'How we verify',
    press: 'Press about us',
    write: 'Write to us',
    support: 'Support',
    donate: 'Donate via monobank',
    otherWays: 'Other ways to help',
    suggest: 'Suggest an opportunity',
    follow: 'Follow',
    telegram: 'telegram',
    instagram: 'instagram',
    privacy: 'Privacy',
    terms: 'Terms',
    made: 'Made with love in Ukraine 🇺🇦',
    hrefs: {
      all: '/en', categories: '/en/categories', deadlines: null, plus: '/en/plus',
      about: '/en/about', verify: '/en/how-we-verify', press: '/en/press',
      contacts: '/en/contacts', support: '/en/support',
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
        <Link href={h.all} className="v2-footer-mark" aria-label={t.markLabel}>
          dityam.com.ua
        </Link>

        <div className="v2-footer-grid">
          <div className="v2-footer-col">
            <span className="v2-footer-col-title">{t.opportunities}</span>
            <Link href={h.all}>{t.all}</Link>
            <Link href={h.categories}>{t.categories}</Link>
            {h.deadlines && <Link href={h.deadlines}>{t.deadlines}</Link>}
            <Link href={h.plus}>{t.plus}</Link>
          </div>

          <div className="v2-footer-col">
            <span className="v2-footer-col-title">{t.topics}</span>
            {TOPIC_NAV.map((topic) => (
              <Link key={topic.slug} href={topicPath(topic, lang)}>
                {lang === 'en' ? topic.labelEn : topic.label}
              </Link>
            ))}
          </div>

          <div className="v2-footer-col">
            <span className="v2-footer-col-title">{t.about}</span>
            <Link href={h.about}>{t.aboutProject}</Link>
            <Link href={h.verify}>{t.verify}</Link>
            <Link href={h.press}>{t.press}</Link>
            <Link href={h.contacts}>{t.write}</Link>
          </div>

          <div className="v2-footer-col">
            <span className="v2-footer-col-title">{t.support}</span>
            <a href={MONOBANK_URL} target="_blank" rel="noopener noreferrer">{t.donate}</a>
            <Link href={h.support}>{t.otherWays}</Link>
            <SuggestOpenButton>{t.suggest}</SuggestOpenButton>
          </div>
        </div>

        <div className="v2-footer-follow">
          <span className="v2-footer-col-title">{t.follow}</span>
          <div className="v2-footer-social">
            <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer">{t.telegram}</a>
            <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">{t.instagram}</a>
          </div>
        </div>

        <div className="v2-footer-bottom">
          <span>© dityam.com.ua 2026 · <Link href={h.privacy}>{t.privacy}</Link> · <Link href={h.terms}>{t.terms}</Link></span>
          <span style={{ whiteSpace: 'nowrap' }}>{t.made}</span>
        </div>
      </div>

      {/* Поп-ап живе у футері, бо футер є на кожній сторінці — і кнопка
          «Запропонувати можливість» працює звідусіль. */}
      <SuggestModal lang={lang} />
    </footer>
  );
}
