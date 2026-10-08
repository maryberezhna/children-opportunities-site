// Одна таблиця людей Dityam+ для /admin/plus (Марія, 08.10.2026: «чи можна
// зробити одну таблицю: статус — юзер — що сталося — звідки прийшов»).
//
// До того на сторінці було три таблиці про тих самих людей: «Потребує уваги»
// (паузи й застряглі — підмножина підписників), «Підписники» і «Список
// очікування». Одна людина стояла у двох-трьох місцях одразу. Тепер кожна
// людина — один рядок, найсвіжіші зверху.
//
// Список очікування закрито: з PLUS_SALES_OPEN = true бот нікого туди не
// записує, а розсилка про запуск пішла 28.09.2026. Ті, хто так і не відкрив
// @DityamPlusBot, лишаються рядками цієї ж таблиці зі статусом «Чекали запуску».
import { describeFailure } from './wayforpay.js';
import { sourceLabel } from './plusSources.js';

// Кроки анкети в @DityamPlusBot (lib/digestFlow.js і /api/telegram/plus).
const STEP = {
  age: 'анкета: вік',
  like: 'анкета: інтереси',
  fmt: 'анкета: формат',
  need: 'анкета: особливі потреби',
  more: 'анкета: ще дитина?',
  place: 'анкета: місто',
  cost: 'анкета: вартість',
  phone: 'телефон для оплати',
};

// Звідки записувались у список очікування (plus_waitlist.source).
const WAIT_FROM = {
  'plus_bot:site': 'Сайт · «Хочу першим»',
  'plus_bot:detail_page': 'Сторінка можливості · «Хочу першим»',
  telegram_post: 'Канал · анонс Dityam+',
};

export const STATUS = {
  active: { label: '✅ Активна', tone: 'green' },
  pending: { label: '⏳ Оформлює', tone: 'amber' },
  paused: { label: '⚠️ Пауза', tone: 'accent' },
  unsubscribed: { label: 'Відписався', tone: 'muted' },
  gift: { label: '🎁 Подарунок', tone: 'amber' },
  waitlist: { label: '📋 Чекали запуску', tone: 'muted' },
};

// І digest_subscribers.telegram_handle, і plus_waitlist.telegram_username
// лежать у базі вже з «собакою» — друга робила з них «@@name».
export const at = (handle) => `@${String(handle).replace(/^@+/, '')}`;

// Без Telegram (подарунок за олімпіаду, ще не привʼязаний до чату) є лише
// пошта з форми оплати — показуємо її, а не «—».
export function who(s) {
  if (s?.telegram_handle) return at(s.telegram_handle);
  if (s?.telegram_chat_id) return `Telegram · …${String(s.telegram_chat_id).slice(-4)}`;
  return s?.email ? `📧 ${s.email}` : '—';
}

export function whereStuck(s) {
  if (s.status !== 'pending') return null;
  // Подарунковий місяць за олімпіаду (lib/olimpiada-server.js, createGift):
  // рядок чекає, доки людина відкриє бота за посиланням з листа. Ні оферти, ні
  // анкети вона ще не бачила — «не погодився з офертою» тут було б неправдою.
  if (s.billing_period === 'gift') return 'подарунок за олімпіаду — бота ще не відкрили';
  if (s.flow_step) return `зупинився: ${STEP[s.flow_step] || s.flow_step}`;
  if (!s.consent_at) return 'зупинився: не погодився з офертою';
  return 'зупинився: дійшов до оплати';
}

// Рядки, що стали paused до 24.09.2026, причини не мають — там describeFailure
// поверне загальне «оплата не пройшла».
export function failure(s) {
  return describeFailure({ status: s.wfp_last_status, reasonCode: s.wfp_last_reason_code, reason: s.wfp_last_reason });
}

const PERIOD = { halfyear: 'пів року', yearly: 'рік', gift: 'подарунок за олімпіаду' };

function whatHappened(s, kids) {
  if (s.status === 'active') {
    return `${s.billing_period === 'gift' ? PERIOD.gift : `оплачено · ${PERIOD[s.billing_period] || 'місяць'}`} · дітей ${kids}`;
  }
  if (s.status === 'paused') return failure(s);
  if (s.status === 'unsubscribed') return 'відписався';
  return whereStuck(s) || '—';
}

const time = (iso) => (iso ? new Date(iso).getTime() : 0);

/**
 * Усі люди Dityam+ одним списком, найсвіжіші зверху. `attention` — кому, можливо,
 * варто написати: пауза або застряг в оформленні понад добу.
 */
export function peopleRows({ subs = [], waitlist = [], kidsBySub = {}, now = Date.now() } = {}) {
  const DAY = 86400000;
  const chats = new Set(subs.map((s) => String(s.telegram_chat_id || '')).filter(Boolean));
  const waitByChat = new Map(waitlist.filter((w) => w.telegram_chat_id).map((w) => [String(w.telegram_chat_id), w]));

  const rows = subs.map((s) => {
    const gift = s.billing_period === 'gift' && s.status === 'pending';
    const date = s.updated_at || s.created_at;
    const waited = s.telegram_chat_id && waitByChat.get(String(s.telegram_chat_id));
    return {
      key: `s-${s.id}`,
      status: gift ? 'gift' : s.status,
      who: who(s),
      what: whatHappened(s, kidsBySub[s.id] || 0),
      from: s.source === 'olimpiada' ? 'Олімпіада' : sourceLabel(s.source)
        + (waited ? ' · був у списку очікування' : ''),
      date,
      attention: !gift && (s.status === 'paused' || (s.status === 'pending' && time(date) < now - DAY)),
    };
  });

  for (const w of waitlist) {
    if (w.telegram_chat_id && chats.has(String(w.telegram_chat_id))) continue;
    rows.push({
      key: `w-${w.id}`,
      status: 'waitlist',
      who: w.telegram_username ? at(w.telegram_username) : w.telegram_chat_id ? 'Telegram' : `📧 ${w.email || '—'}`,
      what: w.telegram_chat_id
        ? 'після запуску в @DityamPlusBot не заходили'
        : 'лише пошта — без Telegram, написати нема як',
      from: WAIT_FROM[w.source] || (String(w.source || '').startsWith('catalog_slot') ? 'Сайт · форма пошти' : w.source || '—'),
      date: w.created_at,
      attention: false,
    });
  }

  return rows.sort((a, b) => time(b.date) - time(a.date));
}
