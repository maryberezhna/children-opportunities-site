'use client';
import { useEffect, useState } from 'react';

// «Я подався» / «Мене взяли» під можливістю. Форма навмисне мінімальна:
// жодних обовʼязкових полів, крім самого факту. Що менше просимо — то більше
// родин доходить до кінця, а нам для метрики й пітчу достатньо факту.
const L = {
  uk: {
    done: 'Дякуємо, що поділились 💛 Такі історії допомагають нам показати, що платформа справді працює.',
    title: 'Подавались на цю можливість?',
    sub: 'Розкажіть — це анонімно. Ми не питаємо ні імені дитини, ні віку, ні школи.',
    applied: 'Я подався / подалась',
    accepted: 'Нас взяли 🎉',
    storyLabel: 'Кілька слів про досвід (необовʼязково)',
    storyPlaceholder: 'Як проходив відбір, що було складно, що порадите іншим…',
    cityLabel: 'Місто (необовʼязково)',
    cityPlaceholder: 'Львів',
    consent: 'Можна звʼязатися зі мною, якщо історію захочуть розповісти в медіа',
    contactLabel: 'Email або @телеграм для звʼязку',
    sending: 'Надсилаємо…',
    submit: 'Надіслати',
    error: 'Не вдалося надіслати. Спробуйте ще раз.',
  },
  en: {
    done: 'Thank you for sharing 💛 Stories like this help us show that the platform really works.',
    title: 'Did you apply for this?',
    sub: 'Tell us — it’s anonymous. We don’t ask for the child’s name, age or school.',
    applied: 'I applied',
    accepted: 'We got in 🎉',
    storyLabel: 'A few words about it (optional)',
    storyPlaceholder: 'How the selection went, what was hard, what you’d tell others…',
    cityLabel: 'City (optional)',
    cityPlaceholder: 'Lviv',
    consent: 'You may contact me if media want to tell this story',
    contactLabel: 'Email or @telegram to reach you',
    sending: 'Sending…',
    submit: 'Send',
    error: 'Could not send. Please try again.',
  },
};

export default function OutcomeForm({ opportunityId, title, lang = 'uk' }) {
  const t = L[lang] || L.uk;
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
        <p>{t.done}</p>
      </section>
    );
  }

  return (
    <section className="outcome-box">
      <h2 className="outcome-title">{t.title}</h2>
      <p className="outcome-sub">{t.sub}</p>

      <form onSubmit={submit}>
        <div className="outcome-stages">
          <button
            type="button"
            className={`outcome-stage ${stage === 'applied' ? 'active' : ''}`}
            onClick={() => setStage('applied')}
          >
            {t.applied}
          </button>
          <button
            type="button"
            className={`outcome-stage ${stage === 'accepted' ? 'active' : ''}`}
            onClick={() => setStage('accepted')}
          >
            {t.accepted}
          </button>
        </div>

        {stage ? (
          <div className="outcome-details">
            <label className="outcome-label" htmlFor="outcome-story">
              {t.storyLabel}
            </label>
            <textarea
              id="outcome-story"
              className="outcome-textarea"
              rows={3}
              maxLength={1200}
              value={story}
              onChange={(e) => setStory(e.target.value)}
              placeholder={t.storyPlaceholder}
            />

            <label className="outcome-label" htmlFor="outcome-city">
              {t.cityLabel}
            </label>
            <input
              id="outcome-city"
              className="outcome-input"
              type="text"
              maxLength={80}
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder={t.cityPlaceholder}
            />

            <label className="outcome-checkbox">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <span>
                {t.consent}
              </span>
            </label>

            {consent ? (
              <>
                <label className="outcome-label" htmlFor="outcome-contact">
                  {t.contactLabel}
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
              {state === 'sending' ? t.sending : t.submit}
            </button>

            {state === 'error' ? (
              <p className="outcome-error">{t.error}</p>
            ) : null}
          </div>
        ) : null}
      </form>
    </section>
  );
}
