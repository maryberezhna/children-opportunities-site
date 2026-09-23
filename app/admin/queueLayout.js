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

/**
 * Вигляд картки й двох розділів (23.09.2026).
 *
 * Марія: «мені треба щоб ти переробив процес і візуал в адмінці, бо абсолютно
 * нічого не зрозуміло». Картка була складена з інлайнових стилів і читалась
 * згори вниз так: пʼять службових плашок — і аж потім назва можливості. Тепер
 * порядок людський: ЧОМУ вона тут → ЩО це за можливість → ЩО зробити, а
 * службове ховається під «Що знайшла машина».
 *
 * Класами, а не інлайном: інлайн не вміє :hover, фокус і вузький екран, і
 * саме через нього картка розповзлась. Розміри — за правилом 55+: нічого
 * дрібнішого за 14 px, основний текст темний (#131b28).
 */
export const ADMIN_CARD_CSS = `
.adm-card { border: 1px solid #e2e8f2; border-radius: 14px; background: #fff;
  padding: 16px 18px; box-shadow: 0 1px 2px rgba(20, 30, 60, .05); color: #131b28;
  font-size: 15px; line-height: 1.5; transition: opacity .3s, background .2s; }
.adm-card + .adm-card { margin-top: 14px; }
.adm-card.gone { opacity: .55; }
.adm-card.ok { background: #e7f6ec; }
.adm-card.off { background: #f3f4f6; }
.adm-done { font-size: 16px; font-weight: 700; color: #131b28; margin: 0; }

/* Причина — перше й найбільше. Колір дає смужка збоку, а текст лишається
   темним: кольоровий текст на кольоровому тлі читався гірше за все. */
.adm-why { display: flex; gap: 10px; align-items: baseline; margin: 0 0 13px;
  padding: 11px 13px; border-radius: 10px; font-size: 17px; font-weight: 700;
  line-height: 1.35; color: #131b28; }
.adm-why.stop { background: #fdecec; box-shadow: inset 3px 0 0 #a11b1b; }
.adm-why.check { background: #fef1e2; box-shadow: inset 3px 0 0 #b4530a; }
.adm-why.ready { background: #e7f6ec; box-shadow: inset 3px 0 0 #15803d; }
.adm-why span[aria-hidden] { flex: none; }
.adm-why .gap { display: block; margin-top: 3px; font-size: 15px; font-weight: 600; color: #54617a; }

.adm-title { margin: 0 0 7px; font-size: 19px; font-weight: 700; line-height: 1.3; }
.adm-title a { color: inherit; text-decoration: none; }
.adm-title a:hover { text-decoration: underline; }

/* Один рядок фактів замість трьох: тип, вік, вартість, коли, дедлайн. */
.adm-facts { display: flex; flex-wrap: wrap; gap: 5px 12px; align-items: baseline;
  margin: 0 0 9px; font-size: 15px; color: #131b28; }
.adm-facts .chip { background: #f0e9fd; color: #4c3d8c; padding: 2px 11px;
  border-radius: 20px; font-size: 14px; font-weight: 600; }
.adm-facts .soft { color: #54617a; }
.adm-facts .good { color: #15803d; font-weight: 600; }
.adm-facts .hot { color: #a11b1b; font-weight: 700; }

.adm-sum { margin: 0 0 9px; font-size: 15px; color: #54617a; line-height: 1.55; }
.adm-src { display: flex; gap: 12px; flex-wrap: wrap; margin: 0 0 13px;
  font-size: 14px; color: #54617a; }
.adm-src a { color: #1e4fd6; font-weight: 600; }

.adm-note { border-radius: 10px; padding: 10px 12px; margin: 0 0 12px;
  font-size: 15px; line-height: 1.5; color: #131b28; }
.adm-note.warn { background: #fef1e2; border: 1px solid #f3d3ad; }
.adm-note.info { background: #eef4ff; border: 1px solid #cddcfb; }
.adm-note .h { font-weight: 700; margin-bottom: 5px; }
.adm-note a { color: #1e4fd6; font-weight: 600; }
.adm-pair { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 8px; }

/* Службове — під розкриттям: потрібне, коли щось не сходиться, і заважає,
   коли все зрозуміло з першого погляду. */
.adm-more { margin: 0 0 13px; font-size: 14px; color: #54617a; }
.adm-more summary { cursor: pointer; font-weight: 600; color: #54617a; }
.adm-more .in { padding: 9px 0 0; line-height: 1.5; }
.adm-more b { color: #131b28; }

.adm-ta { width: 100%; box-sizing: border-box; font: inherit; font-size: 15px;
  padding: 9px 12px; border-radius: 9px; border: 1px solid #d3dbe9;
  resize: vertical; margin: 0 0 10px; color: #131b28; }
.adm-acts { display: flex; gap: 9px; flex-wrap: wrap; align-items: center; }
.adm-btn { font: inherit; font-size: 15px; font-weight: 600; padding: 10px 17px;
  border-radius: 9px; border: 1px solid #d3dbe9; background: #fff; color: #54617a;
  cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; }
.adm-btn:hover { background: #f1f4f9; }
.adm-btn[disabled] { opacity: .5; cursor: default; }
.adm-btn.go { background: #15803d; border-color: #15803d; color: #fff; }
.adm-btn.del { background: #d92c2c; border-color: #d92c2c; color: #fff; }

/* Два розділи: що від мене хочуть і що вже живе. */
.adm-secs { display: flex; gap: 10px; flex-wrap: wrap; margin: 0 0 14px; }
.adm-sec { font: inherit; font-size: 17px; font-weight: 700; padding: 12px 20px;
  border-radius: 11px; border: 1px solid #d3dbe9; background: #fff; color: #131b28;
  cursor: pointer; }
.adm-sec[aria-pressed="true"] { background: #131b28; border-color: #131b28; color: #fff; }
.adm-sec .n { font-variant-numeric: tabular-nums; font-weight: 600; opacity: .8; }

/* Решта — не окремі розділи, а один рядок під заголовком: воно нікуди не
   поділось, але й не змагається за увагу з двома головними купами. */
.adm-also { display: flex; gap: 6px 16px; flex-wrap: wrap; align-items: baseline;
  margin: 12px 0 0; font-size: 15px; line-height: 1.5; color: #54617a; }
.adm-also .lbl { color: #6b6b6b; }
.adm-also button { font: inherit; font-size: 15px; background: none; border: 0;
  padding: 0; color: #1e4fd6; cursor: pointer; text-decoration: underline; }
.adm-also button[aria-pressed="true"] { color: #131b28; font-weight: 700; text-decoration: none; }
.adm-also .n { font-variant-numeric: tabular-nums; }

.adm-lead { margin: 0 0 14px; font-size: 15px; line-height: 1.55; color: #54617a; }
.adm-lead b { color: #131b28; }
.adm-search { width: 100%; box-sizing: border-box; font: inherit; font-size: 16px;
  padding: 11px 14px; border-radius: 10px; border: 1px solid #d3dbe9; margin: 0 0 14px; }
`;
