// Розкладка «правила збоку від списку» — спільна для «Черги» (AdminList)
// і «Карантину». Список стоїть рівно там, де й на інших сторінках адмінки
// (980 px по центру), а правила — у порожньому полі ліворуч. Коли поля
// бракує, уся пара центрується; на вузькому екрані правила згортаються
// над списком. Звичайний модуль, не 'use client': його бере й серверна
// сторінка карантину.
export const QUEUE_LAYOUT_CSS = `
.adm-queue { display: grid; column-gap: 28px; padding: 0 18px;
  grid-template-columns: minmax(0, 1fr) minmax(0, 980px) minmax(0, 1fr);
  /* Зайву висоту правил бере рядок списку, а не шапка: інакше при
     короткому списку між заголовком і вкладками зʼявляється діра. */
  grid-template-rows: auto 1fr;
  grid-template-areas: "rules head ." "rules body ."; }
.adm-queue-head { grid-area: head; min-width: 0; }
.adm-queue-body { grid-area: body; min-width: 0; }
.adm-queue-rules { grid-area: rules; justify-self: end; align-self: start; box-sizing: border-box;
  /* Знизу лишаємо ~100 px: там плаваюча кнопка «око», яка інакше закриває
     останній рядок правил. */
  width: 100%; max-width: 400px; position: sticky; top: 16px; max-height: calc(100vh - 110px);
  overflow-y: auto; background: #fff; border: 1px solid #e2e8f2; border-radius: 14px; padding: 18px 20px; }
@media (max-width: 1679px) {
  .adm-queue { grid-template-columns: 340px minmax(0, 980px); justify-content: center;
    grid-template-areas: "rules head" "rules body"; }
  .adm-queue-rules { max-width: none; }
}
/* Стек — уже від 1280 px: із 340 px правил і 980 px списку у вужче не
   вміщалось, і картки стискались до ~700 px. */
@media (max-width: 1279px) {
  .adm-queue { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto;
    grid-template-areas: "head" "rules" "body"; }
  .adm-queue-rules { position: static; max-height: none; margin-top: 16px; }
}
`;
