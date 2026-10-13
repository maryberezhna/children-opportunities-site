'use client';
// Заявка на «Модний код» → одразу оплата 99 грн (WayForPay). Подія mk_cta —
// коли людина вперше торкнулась форми (скільки з тих, хто зайшов, почали).
import { useRef, useState } from 'react';
import { sendSiteEvent, SITE_EVENTS } from '@/lib/site-events';
import { MK } from '@/lib/modnyi-kod';

const ERR = {
  name: 'Вкажіть імʼя дитини — лише імʼя, без прізвища.',
  age: `Олімпіада для дітей ${MK.ageFrom}–${MK.ageTo} років.`,
  email: 'Перевірте email — туди прийде посилання на кабінет учасника.',
  consent: 'Потрібна згода батьків чи опікуна з правилами.',
  too_many: 'З цієї пошти сьогодні вже багато заявок. Напишіть нам, якщо щось пішло не так.',
  pay: 'Оплата не відкрилась. Спробуйте ще раз за хвилину.',
  closed: 'Реєстрацію тимчасово закрито.',
  unavailable: 'Не вдалося надіслати. Спробуйте за хвилину.',
};

export default function JoinForm() {
  const [state, setState] = useState('idle');
  const [error, setError] = useState('');
  const touched = useRef(false);
  const touch = () => { if (!touched.current) { touched.current = true; sendSiteEvent(SITE_EVENTS.MK_CTA, 'form'); } };

  async function submit(e) {
    e.preventDefault();
    touch();
    const f = new FormData(e.currentTarget);
    const body = {
      name: f.get('name'), age: Number(f.get('age')), email: f.get('email'), designer: f.get('designer'),
      consent: f.get('consent') === 'on', website: f.get('website'),
      source: new URLSearchParams(window.location.search).get('utm_source') || 'page',
    };
    setState('sending'); setError('');
    try {
      const r = await fetch('/api/modnyi-kod/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (j.url) {
        try { window.localStorage.setItem('mk_entry', j.t); } catch { /* ок */ }
        // Адмінський тест веде одразу в кабінет — це не покупка.
        if (!j.url.includes('/kabinet') && typeof window.gtag === 'function') window.gtag('event', 'begin_checkout', { value: MK.price, currency: 'UAH', item_name: 'modnyi_kod' });
        window.location.assign(j.url);
        return;
      }
      setError(ERR[j.error] || ERR.unavailable); setState('idle');
    } catch { setError(ERR.unavailable); setState('idle'); }
  }

  return (
    <form className="mkJ" onSubmit={submit} onFocus={touch} noValidate>
      <div className="mkJ-row">
        <label><span>Імʼя дитини</span><input name="name" maxLength={30} placeholder="Соломія" autoComplete="off" required /></label>
        <label><span>Вік</span>
          <select name="age" defaultValue="" required>
            <option value="" disabled>—</option>
            {Array.from({ length: MK.ageTo - MK.ageFrom + 1 }, (_, i) => MK.ageFrom + i).map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
      </div>
      <fieldset className="mkJ-radio"><legend>На обкладинці</legend>
        <label><input type="radio" name="designer" value="дизайнерка" defaultChecked /> Дизайнерка</label>
        <label><input type="radio" name="designer" value="дизайнер" /> Дизайнер</label>
      </fieldset>
      <label><span>Email батьків</span><input name="email" type="email" autoComplete="email" required /></label>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="mk-hp" aria-hidden="true" />
      <label className="mkJ-check"><input type="checkbox" name="consent" required /> <span>Я мама, тато чи опікун дитини й погоджуюсь із <a href="#pravyla">правилами олімпіади</a>.</span></label>
      {error ? <p className="mkJ-err" role="alert">{error}</p> : null}
      <button type="submit" className="mk-btn-y" disabled={state === 'sending'}>{state === 'sending' ? 'Відкриваємо оплату…' : `Оплатити ${MK.price} грн і взяти участь`}</button>
      <p className="mkJ-note">Оплата карткою через WayForPay. Після оплати на пошту прийде посилання на кабінет: тест, студія, обкладинка.</p>
    </form>
  );
}
