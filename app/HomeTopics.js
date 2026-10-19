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

// Ширина плитки: шоста частина ряду на моніторі, третина екрана на телефоні.
const TILE_SIZES = '(max-width: 700px) 33vw, 200px';

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
              {/* Файл 900px на плитку ~200px (на телефоні — третину екрана):
                  Lighthouse 19.10.2026 рахував ~230 КБ зайвого. 450px вистачає
                  і на 2× екран; 900 лишаємо для широких моніторів. */}
              <source srcSet={`${tile.img.src}-450.webp 450w, ${tile.img.src}.webp 900w`} sizes={TILE_SIZES} type="image/webp" />
              {/* Завжди lazy (07.10.2026, «швидкість понад усе»). У хіро було
                  eager — і телефон, де цей блок схований CSS, усе одно тягнув
                  шість фото (~370 КБ) разом із текстом і шрифтами, забираючи
                  канал у першого екрана. На комп'ютері головне на екрані —
                  заголовок, а фото, що вже в полі зору, lazy вантажить одразу. */}
              <img src={`${tile.img.src}-450.jpg`} srcSet={`${tile.img.src}-450.jpg 450w, ${tile.img.src}.jpg 900w`} sizes={TILE_SIZES} alt="" width="300" height="200" loading="lazy" decoding="async" />
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
