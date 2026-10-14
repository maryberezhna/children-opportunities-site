// Повернення зі сторінки оплати Dityam+. WayForPay веде людину на returnUrl
// POST-запитом, а сторінка Next (/dyakuyu) на POST відповідає 405 — до
// 14.10.2026 кожен, хто оплатив Dityam+, бачив сторінку помилки замість
// «Оплата пройшла». 303 перетворює POST на звичайний перехід (як у
// /api/olimpiada/return).
export const dynamic = 'force-dynamic';

const SITE_URL = process.env.SITE_URL || 'https://dityam.com.ua';

function back() {
  return Response.redirect(`${SITE_URL}/dyakuyu?paid=1`, 303);
}

export const GET = back;
export const POST = back;
