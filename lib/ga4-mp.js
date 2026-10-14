// Подія в GA4 із сервера (Measurement Protocol). Для того, що браузер не
// побачить напевно: оплата підтверджується колбеком WayForPay, а сторінку
// подяки людина може й не відкрити. Без GA4_API_SECRET мовчки нічого не шле.
const GA4_MEASUREMENT_ID = process.env.GA4_MEASUREMENT_ID || 'G-KPLE8LGH91';

export function ga4EventBody(clientId, name, params = {}) {
  return {
    client_id: clientId,
    user_id: clientId,
    events: [{ name, params }],
  };
}

export async function sendGa4ServerEvent(clientId, name, params = {}) {
  const secret = process.env.GA4_API_SECRET;
  if (!secret || !clientId) return;
  const url = `https://www.google-analytics.com/mp/collect?measurement_id=${GA4_MEASUREMENT_ID}&api_secret=${secret}`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ga4EventBody(clientId, name, params)),
  }).catch(() => {});
}
