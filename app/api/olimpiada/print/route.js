// Замовлення друкованого диплома з доставкою Новою поштою (199 грн) вимкнено
// 27.10.2026 — Марія: «виключи і видали з усіх сторінок і шаблонів друк
// диплома за 199 грн». За весь час його не замовив ніхто. Маршрут лишаємо, щоб
// старе посилання чи відкрита вкладка отримали зрозумілу відповідь, а не 404.
import { json } from '@/lib/olimpiada-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  return json({ error: 'print_disabled' }, 410);
}
