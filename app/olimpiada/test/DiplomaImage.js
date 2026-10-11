'use client';

// Диплом малює сервер (next/og) — перший показ триває кілька секунд, і весь
// цей час на екрані була порожня синя рамка (Марія, 06.10.2026: «дуже довго
// грузиться диплом, постав якусь заглушку»). Тепер на його місці картка
// «Малюємо диплом…» того самого розміру, а сам диплом проявляється, щойно
// завантажився. Не вдалося — кнопка «Спробувати ще раз», без перезавантаження.
import { useEffect, useRef, useState } from 'react';
import { MonsterYellow } from '../Doodles';

// waitTitle / failTitle — для подяки педагогові (11.10.2026), там та сама заглушка.
export default function DiplomaImage({ src, alt, name, waitTitle = 'Малюємо диплом…', failTitle = 'Диплом не завантажився' }) {
  const [state, setState] = useState('loading'); // loading | done | error
  const [attempt, setAttempt] = useState(0);
  const ref = useRef(null);
  const url = attempt ? `${src}&r=${attempt}` : src;

  // Із кешу браузера картинка буває готова ще до гідрації — onLoad тоді не
  // прийде, і заглушка висіла б над готовим дипломом.
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth) setState('done');
  }, [url]);

  return (
    <div className={`ol-dipwrap${state === 'done' ? ' is-done' : ''}`}>
      {state !== 'done' && (
        <div className="ol-dipwait" role="status">
          <MonsterYellow className="ol-dipwait-monster" />
          {state === 'error' ? (
            <>
              <b>{failTitle}</b>
              <span>Так буває, коли зникає інтернет.</span>
              <button type="button" className="ol-btn ol-btn-main" onClick={() => { setState('loading'); setAttempt((n) => n + 1); }}>
                Спробувати ще раз
              </button>
            </>
          ) : (
            <>
              <b>{waitTitle}</b>
              <span>{name ? `${name}, ще кілька секунд` : 'Ще кілька секунд'}</span>
              <i className="ol-dipwait-bar" aria-hidden="true" />
            </>
          )}
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={ref} key={url} className="ol-diploma" src={url} width={1240} height={1754} alt={alt}
        onLoad={() => setState('done')} onError={() => setState('error')}
      />
    </div>
  );
}
