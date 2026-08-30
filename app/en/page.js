import Link from 'next/link';
import { supabase, publicOpportunities, CARD_FIELDS, countActiveOpportunities, countActiveSources, FALLBACK } from '@/lib/supabase';
import { TOPIC_NAV } from '@/lib/topics';
import { TYPE_LABELS_EN, isEvent } from '@/lib/labels';
import Footer from '../Footer';

const SITE_URL = 'https://dityam.com.ua';

export const revalidate = 3600;

// Опис теж рахуємо з бази, як у layout: тут стояло зашите «500+», хоча в
// базі 449 — і саме цей текст показував Google. Округлюємо вниз до
// півсотні, щоб число ніколи не обіцяло більше, ніж є.
export async function generateMetadata() {
  const count = await countActiveOpportunities().catch(() => null);
  const n = count && count >= 50 ? Math.floor(count / 50) * 50 : 400;
  return {
  title: 'Dityam — opportunities for Ukrainian children worldwide',
  description:
    `A free platform with ${n}+ verified opportunities for Ukrainian children aged 0–18 — in Ukraine and abroad: camps, scholarships, olympiads, exchange programs, grants and aid. Updated daily, every link checked nightly.`,
  alternates: {
    canonical: `${SITE_URL}/en`,
    languages: { uk: `${SITE_URL}/`, en: `${SITE_URL}/en` },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: `${SITE_URL}/en`,
    siteName: 'Dityam',
    title: 'Dityam — opportunities for Ukrainian children worldwide',
    description:
      'Free platform with verified opportunities for Ukrainian children 0–18, in Ukraine and abroad. Updated daily.',
  },
  };
}

async function getStats() {
  try {
    if (!supabase) return {};
    const [active, sources] = await Promise.all([
      countActiveOpportunities(),
      countActiveSources(),
    ]);
    return { active, sources };
  } catch {
    return {};
  }
}

// Сторінка розповідала про записи, але жодного не показувала: людина мала
// повірити на слово й піти в каталог наосліп.
//
// Беремо по одній свіжій можливості на кожен рядок списку «What's inside»,
// а не шість найновіших: найновіші — це шість однакових гуртків з одного
// агрегатора, і замість обіцяної широти виходив би доказ протилежного.
const SHOWCASE_TYPES = ['camp', 'course', 'olympiad', 'exchange', 'scholarship', 'grant'];

async function getShowcase() {
  try {
    if (!supabase) return [];
    const rows = await Promise.all(
      SHOWCASE_TYPES.map(async (type) => {
        const { data } = await publicOpportunities(CARD_FIELDS)
          .eq('opportunity_type', type)
          .order('created_at', { ascending: false })
          .limit(1);
        return data?.[0] || null;
      }),
    );
    return rows.filter(Boolean);
  } catch {
    return [];
  }
}

function ageLabel(item) {
  const from = item.age_from;
  const to = item.age_to;
  if (from == null && to == null) return null;
  if (from != null && to != null) return `${from}–${to} yrs`;
  if (from != null) return `${from}+ yrs`;
  return `up to ${to} yrs`;
}

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function shortDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCDate()} ${MONTHS_EN[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

const WHAT = [
  { icon: '🏕️', en: 'Camps & recreation', note: 'free and subsidised, in Ukraine and abroad' },
  { icon: '🎓', en: 'Courses & clubs', note: 'from coding to arts, many online' },
  { icon: '🏆', en: 'Olympiads & competitions', note: 'national and international' },
  { icon: '✈️', en: 'Exchange programs', note: 'FLEX, AFS, Erasmus+ and more' },
  { icon: '💰', en: 'Scholarships & grants', note: 'including full-funding programs' },
  { icon: '🤝', en: 'Aid & support', note: 'for displaced families, veterans’ children, children with disabilities' },
];

// Ті самі підбірки, що й на головній, тими самими чипами. У попередній версії
// вони були зшиті в один абзац дрібним текстом наприкінці сторінки —
// найкоротший шлях до можливостей виглядав як виноска.

export default async function EnglishPage() {
  const [{ active, sources }, showcase] = await Promise.all([getStats(), getShowcase()]);

  return (
    <div className="container en-page" lang="en">
      <div className="hero">
        <div className="hero-copy">
          <div className="hero-badges">
            <div className="hero-badge">Free · updated daily</div>
          </div>
          <h1>
            Opportunities for Ukrainian children —
            <br />
            <span className="accent">wherever they are</span>
          </h1>
          <p>
            Dityam is a free, ad-free platform that gathers verified
            opportunities for Ukrainian children aged 0–18 — those still in
            Ukraine and those scattered across the world by the war. Camps,
            scholarships, olympiads, exchanges, grants and aid programs:
            collected from {sources ?? FALLBACK.sources} sources, checked
            daily, all in one place.
          </p>
          <div className="stats">
            <div className="stat">
              <span className="stat-num">{active ?? FALLBACK.opportunities}</span>
              <span className="stat-label">verified opportunities</span>
            </div>
            <div className="stat">
              <span className="stat-num">{sources ?? FALLBACK.sources}</span>
              <span className="stat-label">sources, updated daily</span>
            </div>
            <div className="stat">
              <span className="stat-num">0–18</span>
              <span className="stat-label">years old, free for families</span>
            </div>
          </div>
        </div>

        {/* Праворуч від тексту — те саме фото, що й на головній. Без нього
            права колонка сітки героя лишалась порожньою: 440 порожніх
            пікселів, через які сторінка виглядала недовантаженою. */}
        <div className="hero-photo">
          <picture>
            <source srcSet="/hero-kids.webp" type="image/webp" />
            <img
              src="/hero-kids.jpg"
              width={880}
              height={543}
              alt="Smiling children on a playground"
              fetchPriority="high"
            />
          </picture>
        </div>
      </div>

      <nav className="topic-chips" aria-label="Popular collections">
        <span className="topic-chips-label">Popular:</span>
        {TOPIC_NAV.map((t) => (
          <Link key={t.slug} href={`/${t.slug}`} className="topic-chip">
            {t.labelEn || t.label}
          </Link>
        ))}
      </nav>

      <section className="topic-faq">
        <h2>What’s inside</h2>
        {WHAT.map((w) => (
          <div key={w.en} className="en-what-row">
            <span className="en-what-icon" aria-hidden="true">{w.icon}</span>
            <div>
              <b>{w.en}</b>
              <span className="en-what-note"> — {w.note}</span>
            </div>
          </div>
        ))}
      </section>

      {showcase.length ? (
        <section className="en-latest">
          <h2>What a listing looks like</h2>
          <p>
            One live opportunity from each category above — exactly the cards
            you’ll find in the catalogue.
          </p>
          <div className="grid en-grid">
            {showcase.map((item) => (
              <article key={item.id} className="card">
                <div className="chips">
                  <span className="chip chip-type">
                    {TYPE_LABELS_EN[item.opportunity_type] || item.opportunity_type}
                  </span>
                  {ageLabel(item) ? <span className="chip chip-age">{ageLabel(item)}</span> : null}
                  {item.cost_type === 'free' ? <span className="chip chip-free">free</span> : null}
                  {item.cost_type === 'partially_free' ? <span className="chip chip-paid">funded</span> : null}
                  {item.cost_type === 'paid_affordable' ? <span className="chip chip-paid">affordable</span> : null}
                </div>

                {/* Назва й опис — українською: це самі дані, і саме на них
                    видно, що доведеться перекладати. Рамка картки при цьому
                    англійська, тож зрозуміло, що це за річ і для кого. */}
                <h3 lang="uk">
                  <Link href={`/o/${item.slug}`} className="card-title-link">
                    {item.title}
                  </Link>
                </h3>
                {item.summary ? <p className="card-summary" lang="uk">{item.summary}</p> : null}

                <div className="meta">
                  {(item.cities || []).length ? (
                    <div className="meta-row">
                      <span className="meta-label">City</span>
                      <span className="meta-val" lang="uk">{item.cities.slice(0, 2).join(', ')}</span>
                    </div>
                  ) : null}
                  {item.deadline && shortDate(item.deadline) ? (
                    <div className="meta-row">
                      {/* Той самий поділ, що на сайті й у боті: у події —
                          дата, дедлайн лише там, де справді подають заявку. */}
                      <span className="meta-label">{isEvent(item) ? 'When' : 'Deadline'}</span>
                      <span className="meta-val">{shortDate(item.deadline)}</span>
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h2>Listings are in Ukrainian</h2>
        <p>
          Listings are written in Ukrainian — the language of the families we
          serve. Titles, descriptions and cities stay in the original, because
          that’s how the organisers publish them. Your browser translates the
          whole site in one click:
        </p>
        <ul className="en-howto">
          <li>
            <b>Chrome, Edge, Brave</b> — right-click anywhere on the page and choose
            <i> Translate to English</i>, or press the translate icon in the address bar.
          </li>
          <li>
            <b>Safari on a Mac</b> — press the translate icon in the address bar,
            then <i>Translate to English</i>.
          </li>
          <li>
            <b>Firefox</b> — press the translate icon in the address bar and pick English.
          </li>
          <li>
            <b>On a phone</b> — Chrome shows a <i>Translate</i> bar at the bottom;
            in Safari tap <i>Aa</i> next to the address, then <i>Translate to English</i>.
          </li>
        </ul>
        <p>
          Links, filters and the search box keep working while translated — only
          the words change.
        </p>
        <div className="en-actions">
          <Link href="/" className="opportunity-cta">
            Browse opportunities →
          </Link>
          <Link href="/yak-my-pereviriaiemo" className="cal-btn">
            How we verify data
          </Link>
        </div>
      </section>

      <section>
        <h2>Press, partners &amp; support</h2>
        <p>
          Dityam is an independent solo-founder project from Ukraine. To
          support the project — <Link href="/support">donation options</Link>;
          for press and partnerships write to{' '}
          <a href="mailto:maryberezhna@gmail.com?subject=Dityam%20partnership">
            maryberezhna@gmail.com
          </a>.
        </p>
      </section>

      <Footer lang="en" />
    </div>
  );
}
