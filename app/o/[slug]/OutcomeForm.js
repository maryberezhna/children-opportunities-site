'use client';
import { useEffect, useState } from 'react';

// «Я подався» / «Мене взяли» під можливістю. Форма навмисне мінімальна:
// жодних обовʼязкових полів, крім самого факту. Що менше просимо — то більше
// родин доходить до кінця, а нам для метрики й пітчу достатньо факту.
export default function OutcomeForm({ opportunityId, title }) {
  const [stage, setStage] = useState(null);      // 'applied' | 'accepted'
  const [story, setStory] = useState('');
  const [city, setCity] = useState('');
  const [contact, setContact] = useState('');
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState('');    // honeypot
  const [state, setState] = useState('idle');    // idle | sending | done | error
  const [alreadySent, setAlreadySent] = useState(false);

  const storageKey = `outcome:${opportunityId}`;

  useEffect(() => {
    try {
      if (localStorage.getItem(storageKey)) setAlreadySent(true);
    } catch {}
  }, [storageKey]);

  const submit = async (e) => {
    e.preventDefault();
    if (!stage || state === 'sending') return;
    setState('sending');
    try {
      const res = await fetch('/api/outcomes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunity_id: opportunityId,
          stage,
          story,
          city,
          contact,
          contact_consent: consent,
          website,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!json.ok) throw new Error(json.error || 'failed');
      try { localStorage.setItem(storageKey, stage); } catch {}
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', 'opportunity_outcome', {
          event_category: 'engagement',
          event_label: title,
          stage,
        });
      }
      setState('done');
    } catch {
      setState('error');
    }
  };

  if (alreadySent || state === 'done') {
    return (
      <section className="outcome-box outcome-box-done">
        <p>
          Дякуємо, що поділились 💛 Такі історії допомагають нам показати, що
          каталог справді працює.
        </p>
      </section>
    );
  }

  return (
    <section className="outcome-box">
      <h2 className="outcome-title">Подавались на цю можливість?</h2>
      <p className="outcome-sub">
        Розкажіть — це анонімно. Ми не питаємо ні імені дитини, ні віку, ні школи.
      </p>

      <form onSubmit={submit}>
        <div className="outcome-stages">
          <button
            type="button"
            className={`outcome-stage ${stage === 'applied' ? 'active' : ''}`}
            onClick={() => setStage('applied')}
          >
            Я подався / подалась
          </button>
          <button
            type="button"
            className={`outcome-stage ${stage === 'accepted' ? 'active' : ''}`}
            onClick={() => setStage('accepted')}
          >
            Нас взяли 🎉
          </button>
        </div>

        {stage ? (
          <div className="outcome-details">
            <label className="outcome-label" htmlFor="outcome-story">
              Кілька слів про досвід (необовʼязково)
            </label>
            <textarea
              id="outcome-story"
              className="outcome-textarea"
              rows={3}
              maxLength={1200}
              value={story}
              onChange={(e) => setStory(e.target.value)}
              placeholder="Як проходив відбір, що було складно, що порадите іншим…"
            />

            <label className="outcome-label" htmlFor="outcome-city">
              Місто (необовʼязково)
            </label>
            <input
              id="outcome-city"
              className="outcome-input"
              type="text"
              maxLength={80}
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Львів"
            />

            <label className="outcome-checkbox">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <span>
                Можна звʼязатися зі мною, якщо історію захочуть розповісти в медіа
              </span>
            </label>

            {consent ? (
              <>
                <label className="outcome-label" htmlFor="outcome-contact">
                  Email або @телеграм для звʼязку
                </label>
                <input
                  id="outcome-contact"
                  className="outcome-input"
                  type="text"
                  maxLength={160}
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="mail@example.com"
                />
              </>
            ) : null}

            {/* honeypot — приховане поле, справжні люди його не заповнюють */}
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              className="outcome-hp"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              aria-hidden="true"
            />

            <button type="submit" className="outcome-submit" disabled={state === 'sending'}>
              {state === 'sending' ? 'Надсилаємо…' : 'Надіслати'}
            </button>

            {state === 'error' ? (
              <p className="outcome-error">Не вдалося надіслати. Спробуйте ще раз.</p>
            ) : null}
          </div>
        ) : null}
      </form>
    </section>
  );
}
