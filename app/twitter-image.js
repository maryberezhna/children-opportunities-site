// Та сама обкладинка, що й для Open Graph. Окремий файл потрібен, бо Next
// шукає twitter-image за іменем: без нього Twitter/X бере статичний
// public/og-image.png, який оновлюється руками й тому відстає.
//
// runtime і revalidate — літералами, а не реекспортом: Next читає ці поля
// статично й на реекспорт лається попередженням.
export { default, size, contentType, alt } from './opengraph-image';

export const runtime = 'nodejs';
export const revalidate = 86400;
