import { SuggestOpenButton } from './SuggestModal';

// Два нижні блоки головної: Telegram-підписка і «Запропонувати можливість».
// Серверний компонент — уся інтерактивність (поп-ап) живе в SuggestModal.

const TELEGRAM_URL = 'https://t.me/dityam_com_ua';

const T = {
  uk: {
    tgLead: 'Нові можливості — ',
    tgScript: 'раз на день',
    tgTail: ' у Telegram',
    tgText: 'Одне повідомлення на день: що додалось і які дедлайни закриваються. Без реклами.',
    tgBtn: 'Підписатись у Telegram →',
    sgTitle: 'Знаєте можливість, якої тут немає?',
    sgText: 'Надішліть посилання — перевіримо і додамо за 1–3 дні. Організації не платять за розміщення, у цьому вся суть.',
    sgBtn: 'Запропонувати можливість',
    sgAlt: 'або написати в Telegram',
  },
  en: {
    tgLead: 'New opportunities — ',
    tgScript: 'once a day',
    tgTail: ' on Telegram',
    tgText: 'One message a day: what was added and which deadlines are closing. No ads.',
    tgBtn: 'Subscribe on Telegram →',
    sgTitle: 'Know an opportunity we are missing?',
    sgText: 'Send a link — we will verify and add it within 1–3 days. Organisations never pay for placement; that is the whole point.',
    sgBtn: 'Suggest an opportunity',
    sgAlt: 'or write on Telegram',
  },
};

export default function HomeBlocks({ lang = 'uk' }) {
  const t = T[lang] || T.uk;
  return (
    <section className="v2-bottom">
      <div className="v2-panel">
        <h2>
          {t.tgLead}<span className="v2-script">{t.tgScript}</span>{t.tgTail}
        </h2>
        <p>{t.tgText}</p>
        <div className="v2-panel-actions">
          <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className="v2-btn-dark">
            {t.tgBtn}
          </a>
          <span className="v2-panel-note">@dityam_com_ua</span>
        </div>
      </div>
      <div className="v2-panel">
        <h2>{t.sgTitle}</h2>
        <p>{t.sgText}</p>
        <div className="v2-panel-actions">
          <SuggestOpenButton className="v2-btn-outline">{t.sgBtn}</SuggestOpenButton>
          <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className="v2-panel-link">
            {t.sgAlt}
          </a>
        </div>
      </div>
    </section>
  );
}
