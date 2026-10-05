import { redirect } from 'next/navigation';

// /stem-talant — адреса конкурсу для дітей і батьків. До грудня 2026, поки
// реєстрація не відкрита, веде на сторінку партнерів (redirect — тимчасовий,
// 307), щоб посилання в постах і листах не вели в нікуди. У грудні тут буде
// сторінка для дітей; тоді прибрати redirect.
export default function StemTalantRedirect() {
  redirect('/stem-partnery');
}
