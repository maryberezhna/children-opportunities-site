import { SuggestOpenButton } from './SuggestModal';
import TelegramCard from './TelegramCard';

// Два нижні блоки головної: Telegram-підписка і «Запропонувати можливість».
// Серверний компонент — уся інтерактивність (поп-ап) живе в SuggestModal.
//
// Блок каналу говорить спільними словами (lib/social.js). До 27.09.2026 тут
// стояло «Одне повідомлення на день… Без реклами»: формат каналу ще змінюється,
// а організаторам ми продаємо пост у каналі, тож «без реклами» — вже неправда.
//
// 01.10.2026 з блоку пропозиції прибрано «або написати в Telegram» (Марія):
// пропозиція має йти формою на сайті. У Telegram вона падає в особисті
// повідомлення, звідки не потрапляє ні в opportunity_suggestions, ні в чергу —
// тобто губиться. Сам блок каналу стоїть поруч і нікуди не дівся.

const T = {
  uk: {
    sgTitle: 'Знаєте можливість, якої тут немає?',
    sgText: 'Надішліть посилання — перевіримо і додамо за 1–3 дні. Розміщення безкоштовне.',
    sgBtn: 'Запропонувати можливість',
  },
  en: {
    sgTitle: 'Know an opportunity we are missing?',
    sgText: 'Send a link — we will verify and add it within 1–3 days. Placement is free.',
    sgBtn: 'Suggest an opportunity',
  },
};

export default function HomeBlocks({ lang = 'uk' }) {
  const t = T[lang] || T.uk;
  return (
    <section className="v2-bottom">
      {/* Той самий компонент, що й між картками: один заклик — один вигляд.
          Раніше тут була власна верстка з тими самими словами. */}
      <TelegramCard lang={lang} place="home_bottom" variant="panel" />
      <div className="v2-panel">
        <h2>{t.sgTitle}</h2>
        <p>{t.sgText}</p>
        <div className="v2-panel-actions">
          <SuggestOpenButton className="v2-btn-outline">{t.sgBtn}</SuggestOpenButton>
        </div>
      </div>
    </section>
  );
}
