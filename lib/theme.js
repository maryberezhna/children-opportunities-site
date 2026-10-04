/**
 * Нічний режим (Марія, 04.10.2026: «зробити нічний режим на сайті»).
 *
 * Три стани, а не два:
 *   'auto'  — як у системі (за замовчуванням). Увечері телефон сам перемикає
 *             сайт, і людині не треба нічого шукати;
 *   'dark'  — завжди темний;
 *   'light' — завжди світлий, навіть якщо система темна.
 *
 * «Як у системі» — саме стан, а не відсутність вибору: інакше людина, яка
 * один раз натиснула «світлий», лишилась би зі світлим назавжди й не мала б
 * чим повернути автоматику.
 *
 * Атрибут вішаємо на <html> (data-theme) — так само, як режим «Підліткам».
 * У стані 'auto' атрибута немає зовсім: тоді працює @media
 * (prefers-color-scheme: dark) у styles/night.css.
 */
export const THEME_KEY = 'dityam-theme';
export const THEMES = ['auto', 'light', 'dark'];

export const isTheme = (v) => THEMES.includes(v);

/** Що поставити в data-theme: null означає «атрибута немає». */
export function themeAttr(theme) {
  return theme === 'dark' || theme === 'light' ? theme : null;
}

/**
 * Скрипт, що виставляє тему ДО першої промальовки.
 *
 * Без нього темний сайт на мить блимає білим: React ставить атрибут уже
 * після гідрації. Той самий прийом, що в AB_CARD_BOOT_SCRIPT.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{
var t=localStorage.getItem('${THEME_KEY}');
if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t)}
}catch(e){}})();`;
