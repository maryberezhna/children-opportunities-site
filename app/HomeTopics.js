import Link from 'next/link';
import { TOPICS, topicPath } from '@/lib/topics';

// Шість плиток тем із фото (редизайн головної, макет Main.dc.html): у hero
// на десктопі під пошуком, на телефоні — окремим блоком «Або оберіть тему»
// після списку. Фото й підписи — ті самі, що в самих підбірок (lib/topics.js),
// нових слів не вигадуємо.
const SLUGS = [
  'mizhnarodni-olimpiady', 'konkursy', 'bezkoshtovni-tabory',
  'bezkoshtovni-hurtky', 'za-kordon', 'dity-zakhysnykiv',
];

const T = {
  uk: { title: 'Або оберіть тему', aria: 'Підбірки за темами' },
  en: { title: 'Or pick a topic', aria: 'Collections by topic' },
};

export default function HomeTopics({ lang = 'uk', variant = 'hero' }) {
  const t = T[lang] || T.uk;
  const tiles = SLUGS.map((slug) => TOPICS[slug]).filter(Boolean).map((topic) => {
    const c = lang === 'en' ? topic.en : topic;
    return {
      slug: topic.slug,
      href: topicPath({ slug: topic.slug, slugEn: topic.en.slug }, lang),
      label: lang === 'en' ? topic.navEn : topic.nav,
      img: c.heroImage || topic.heroImage || null,
    };
  });

  const list = (
    <div className="v2-tiles">
      {tiles.map((tile) => (
        <Link key={tile.slug} href={tile.href} className="v2-tile">
          {tile.img ? (
            <picture>
              <source srcSet={`${tile.img.src}.webp`} type="image/webp" />
              <img src={`${tile.img.src}.jpg`} alt="" width="300" height="200" loading={variant === 'hero' ? 'eager' : 'lazy'} />
            </picture>
          ) : null}
          <span className="v2-tile-label">{tile.label} →</span>
        </Link>
      ))}
    </div>
  );

  if (variant === 'mobile') {
    return (
      <section className="v2-topics-mobile" aria-labelledby="v2-topics-mobile-title">
        <h2 id="v2-topics-mobile-title">{t.title}</h2>
        {list}
      </section>
    );
  }
  return <nav className="v2-tiles-hero" aria-label={t.aria}>{list}</nav>;
}
