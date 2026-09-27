// Номер телефону, написаний руками.
//
// Навіщо. Бот приймав номер ЛИШЕ кнопкою «Поділитися номером»
// (msg.contact), а на текст не реагував узагалі: гілка «питання в підтримку»
// спрацьовує тільки для активних підписників, тож людина зі статусом pending
// писала номер і не отримувала нічого. 27.09.2026 на цьому кроці стояли двоє,
// обидві з заповненою анкетою (Марія: «подумай, чому тут зупиняється процес»).
//
// Формати, які люди пишуть насправді: +380 67 123 45 67, 380671234567,
// 0671234567, (067) 123-45-67. Усі зводимо до +380XXXXXXXXX — саме такий
// формат любить WayForPay.

/** Текст → +380XXXXXXXXX або null, якщо це не схоже на український номер. */
export function parsePhone(text) {
  const raw = String(text ?? '').trim();
  // Літери означають, що це слово, а не номер: «дякую», промокод, питання.
  if (/[a-zA-Zа-яА-ЯіїєґІЇЄҐ]/.test(raw)) return null;
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  // 380671234567 → як є; 0671234567 → додаємо 38; 671234567 → додаємо 380.
  let national;
  if (digits.length === 12 && digits.startsWith('380')) national = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('80')) national = digits.slice(1);
  else if (digits.length === 10 && digits.startsWith('0')) national = digits;
  // Дев'ять цифр — номер без нуля й без коду країни (671234567). Але якщо
  // вони починаються з 380 чи 80, це обрізаний міжнародний: людина не
  // дописала номер, і склеювати з нього «валідний» не можна.
  else if (digits.length === 9 && !digits.startsWith('380') && !digits.startsWith('80')) national = `0${digits}`;
  else return null;
  // Другий знак коду оператора в Україні — завжди 3, 4, 5, 6, 7 або 9
  // (039, 050, 063, 066, 067, 068, 073, 091…099). Це відсікає роки, суми
  // й порядкові числа, які випадково мають ту саму довжину.
  if (!/^0[2-9]\d{8}$/.test(national)) return null;
  return `+38${national}`;
}

/** Чи текст схожий на спробу дати номер (щоб відповісти, а не мовчати). */
export function looksLikePhoneAttempt(text) {
  const digits = String(text ?? '').replace(/\D/g, '');
  return digits.length >= 9 && digits.length <= 13 && !/[a-zA-Zа-яА-ЯіїєґІЇЄҐ]{3,}/.test(String(text ?? ''));
}
