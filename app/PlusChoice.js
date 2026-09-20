import { formatDate } from '@/lib/dates';
import { soonestDeadlines } from '@/lib/timing';
import { PRICE } from '@/lib/wayforpay';
import { PLUS_SALES_OPEN, PLUS_WAITLIST_URL, plusBotUrl } from '@/lib/plus';

// Заклик наприкінці сторінки Dityam+: кава чи можливість для дитини (ідея
// Марії 19.09.2026). До 20.09.2026 блок стояв у кінці головної — Марія
// перенесла його туди, де людина вже читає про саму підписку.
//
// Дві умови, які тут важливі:
// 1. Праворуч крутяться СПРАВЖНІ записи з найближчими дедлайнами, а не
//    вигадані приклади — інакше блок обіцяє те, чого в базі може не бути.
// 2. Порівняння з кавою — про місяць проти однієї чашки, без тижневої
//    арифметики в голові читача: 119 грн/міс приблизно дорівнюють одній каві
//    на кокосовому молоці (формулювання Марії 20.09.2026).
//
// Анімація — лише CSS (три картки по черзі), тож блок серверний і нічого не
// важить для JS. Під prefers-reduced-motion рух вимикається, видно першу картку.

const T = {
  uk: {
    eyebrow: 'Вибір очевидний',
    title: 'Кава чи можливість ',
    script: 'для дитини',
    text: (price) => `Dityam+ коштує ${price} грн на місяць — як 1 кава на кокосовому молоці. `
      + 'Щодня добираємо можливості окремо для кожної вашої дитини й нагадуємо про дедлайни, '
      + 'поки ще є час подати заявку.',
    cupLabel: 'Кава з собою',
    cupNote: 'Закінчується за 15 хвилин',
    listLabel: (price) => `Dityam+ · ${price} грн/міс`,
    listNote: 'Приходить у Telegram щодня',
    btnOpen: 'Спробувати Dityam+',
    btnWait: 'Хочу першим',
    note: 'Платформа лишається безкоштовною для всіх',
    deadline: (d) => `заявки до ${d}`,
    soon: 'скоро',
  },
  en: {
    eyebrow: 'An easy choice',
    title: 'A coffee, or an opportunity ',
    script: 'for your child',
    text: (price) => `Dityam+ costs UAH ${price} a month — like one coconut-milk coffee. `
      + 'Every day we match opportunities to each of your children and remind you about '
      + 'deadlines while there is still time to apply.',
    cupLabel: 'Coffee to go',
    cupNote: 'Gone in 15 minutes',
    listLabel: (price) => `Dityam+ · UAH ${price}/mo`,
    listNote: 'Arrives on Telegram every day',
    btnOpen: 'Try Dityam+',
    btnWait: 'Join the first list',
    note: 'The platform stays free for everyone',
    deadline: (d) => `apply by ${d}`,
    soon: 'soon',
  },
};

export default function PlusChoice({ opportunities, today, lang = 'uk' }) {
  const t = T[lang] || T.uk;
  const picks = soonestDeadlines(opportunities, today);
  if (!picks.length) return null;      // немає чим підтвердити — блоку немає

  const href = PLUS_SALES_OPEN ? plusBotUrl('choice') : PLUS_WAITLIST_URL;

  return (
    <section className="v2-choice" aria-labelledby="v2-choice-title">
      <div className="v2-choice-text">
        <span className="v2-choice-eyebrow">{t.eyebrow}</span>
        <h2 id="v2-choice-title">
          {t.title}<span className="v2-script">{t.script}</span>?
        </h2>
        <p>{t.text(PRICE)}</p>
        <div className="v2-panel-actions">
          <a href={href} target="_blank" rel="noopener noreferrer" className="v2-btn-dark">
            {PLUS_SALES_OPEN ? t.btnOpen : t.btnWait}
          </a>
          <span className="v2-panel-note">{t.note}</span>
        </div>
      </div>

      <div className="v2-choice-scene" aria-hidden="true">
        <figure className="v2-cup">
          <div className="v2-cup-steam"><span /><span /><span /></div>
          <div className="v2-cup-body"><div className="v2-cup-fill" /></div>
          <div className="v2-cup-saucer" />
          <figcaption>
            <strong>{t.cupLabel}</strong>
            <span>{t.cupNote}</span>
          </figcaption>
        </figure>

        <figure className="v2-choice-feed">
          <div className="v2-feed-window">
            {picks.map((o, i) => (
              <article key={o.id || i} className="v2-feed-card" style={{ '--i': i }}>
                <span className="v2-feed-title">{(lang === 'en' && o.title_en) || o.title}</span>
                <span className="v2-feed-date">
                  {t.deadline(formatDate(o.deadline, lang) || t.soon)}
                </span>
              </article>
            ))}
          </div>
          <figcaption>
            <strong>{t.listLabel(PRICE)}</strong>
            <span>{t.listNote}</span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
