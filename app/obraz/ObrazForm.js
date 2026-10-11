'use client';

// Форма челенджу «Твій образ на обкладинці» для батьків. Фото малюнка
// стискається в браузері (./jpeg.js); після відправки людина одразу
// переходить на сторінку заявки — там превʼю обкладинки й оплата оргвнеску.
import { useState } from 'react';
import { OBRAZ, entryPath } from '@/lib/obraz';
import { toJpeg } from './jpeg';

const ERRORS = {
  name: 'Вкажіть імʼя дитини — лише імʼя, без прізвища.',
  age: `Оберіть вік: челендж для дітей ${OBRAZ.ageFrom}–${OBRAZ.ageTo} років.`,
  title: 'Придумайте назву образу — хоч 2 слова.',
  email: 'Перевірте email — туди прийде лист, коли малюнок зʼявиться в галереї.',
  consent: 'Потрібна ваша згода як батьків чи опікуна.',
  file: 'Додайте фото малюнка (JPG, PNG чи HEIC з телефона).',
  file_big: 'Фото завелике. Спробуйте інше або зробіть знімок ще раз.',
  designer: 'Оберіть, як підписати обкладинку: дизайнер чи дизайнерка.',
  too_many: 'З цієї пошти сьогодні вже 3 малюнки. Наступний можна надіслати завтра.',
  closed: 'Прийом малюнків на цю тему завершено. Нову тему оголосимо в Telegram-каналі.',
  unavailable: 'Не вдалося надіслати. Спробуйте за кілька хвилин.',
};

export default function ObrazForm({ open, channelUrl }) {
  const [state, setState] = useState('idle'); // idle | sending
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [jpeg, setJpeg] = useState(null);

  async function pick(e) {
    const file = e.target.files?.[0];
    setError('');
    setJpeg(null);
    setPreview(null);
    if (!file) return;
    try {
      const blob = await toJpeg(file);
      if (!blob) throw new Error('no blob');
      setJpeg(blob);
      setPreview(URL.createObjectURL(blob));
    } catch {
      setError('Цей файл не відкривається. Спробуйте інше фото (JPG чи PNG).');
    }
  }

  async function submit(e) {
    e.preventDefault();
    if (!jpeg) { setError(ERRORS.file); return; }
    const f = new FormData(e.currentTarget);
    if (!f.get('designer')) { setError(ERRORS.designer); return; }
    f.delete('image_pick');
    f.set('image', jpeg, 'malyunok.jpg');
    f.set('source', new URLSearchParams(window.location.search).get('utm_source') || '');
    setState('sending');
    setError('');
    try {
      const r = await fetch('/api/obraz/submit', { method: 'POST', body: f });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok || !j.t) {
        setError(ERRORS[j.error] || ERRORS.unavailable);
        setState('idle');
        return;
      }
      if (typeof window !== 'undefined' && window.gtag) window.gtag('event', 'obraz_submit');
      // Далі — превʼю обкладинки й оплата.
      window.location.href = entryPath(j.t);
    } catch {
      setError(ERRORS.unavailable);
      setState('idle');
    }
  }

  if (!open) {
    return (
      <div className="ob-form ob-form-done">
        <p className="ob-form-title">Прийом робіт на цей сезон завершено</p>
        <p>Нову тему оголосимо в <a href={channelUrl}>Telegram-каналі Dityam.com.ua</a>.</p>
      </div>
    );
  }

  return (
    <form className="ob-form" onSubmit={submit} noValidate>
      <label className="ob-file">
        <span className="ob-label">Фото малюнка</span>
        <input type="file" name="image_pick" accept="image/*" onChange={pick} />
        {preview
          ? <img src={preview} alt="Ваш малюнок" className="ob-file-preview" />
          : <span className="ob-file-hint">Натисніть, щоб вибрати фото. На знімку — лише малюнок, без людей і документів.</span>}
      </label>

      <div className="ob-row">
        <label>
          <span className="ob-label">Імʼя дитини</span>
          <input name="name" autoComplete="off" maxLength={30} placeholder="Соломія" required />
          <span className="ob-help">Лише імʼя — прізвища на сайті не буде.</span>
        </label>
        <label>
          <span className="ob-label">Вік</span>
          <select name="age" defaultValue="" required>
            <option value="" disabled>Оберіть</option>
            {Array.from({ length: OBRAZ.ageTo - OBRAZ.ageFrom + 1 }, (_, i) => OBRAZ.ageFrom + i).map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="ob-radio">
        <legend className="ob-label">Як підписати обкладинку</legend>
        <label><input type="radio" name="designer" value="дизайнерка" /> <span>Дизайнерка</span></label>
        <label><input type="radio" name="designer" value="дизайнер" /> <span>Дизайнер</span></label>
      </fieldset>

      <label>
        <span className="ob-label">Назва образу</span>
        <input name="title" maxLength={OBRAZ.titleMax} placeholder="Сукня для прогулянки під дощем" required />
      </label>

      <label>
        <span className="ob-label">Що намальовано і чому саме так? <span className="ob-opt">(не обовʼязково)</span></span>
        <textarea name="story" maxLength={OBRAZ.storyMax} rows={3} placeholder="Словами дитини: кілька речень про образ." />
      </label>

      <label>
        <span className="ob-label">Email батьків</span>
        <input name="email" type="email" autoComplete="email" required />
        <span className="ob-help">На сайті його не видно. Туди прийде обкладинка для друку й сертифікат.</span>
      </label>

      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="ob-hp" aria-hidden="true" />

      <label className="ob-check">
        <input type="checkbox" name="consent" required />
        <span>Я один з батьків чи опікун дитини. Дозволяю показати малюнок з іменем і віком дитини на обкладинці в онлайн-галереї Dityam.com.ua. Прибрати його можна будь-коли за посиланням з листа. Оргвнесок — {OBRAZ.price} грн; якщо фото не підійде, ми попросимо інше без доплати.</span>
      </label>
      <label className="ob-check">
        <input type="checkbox" name="instagram" />
        <span>Можна показати малюнок і в Instagram Dityam.com.ua (так само: лише імʼя та вік).</span>
      </label>

      {error ? <p className="ob-error" role="alert">{error}</p> : null}

      <button type="submit" className="ob-btn ob-btn-main" disabled={state === 'sending'}>
        {state === 'sending' ? 'Готуємо обкладинку…' : 'Далі: побачити свою обкладинку'}
      </button>
    </form>
  );
}
