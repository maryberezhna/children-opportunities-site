'use client';
import { useState, useMemo } from 'react';
// Той самий перелік, що й у конвеєрі: модератор бачить у черзі рівно те
// формулювання, яким нормалізатор позначив запис.
import { missingRequired, CRITERIA } from '@/lib/required';
import { splitQueue, DAILY_CAP } from '@/lib/queue-risk';
import { decisionReason, gapReason, deadlineNote, sortByDeadline } from '@/lib/decision-reason';
import { formatDate, formatEventDates } from '@/lib/dates';
import { dateWarnings } from '@/lib/date-warnings';
import { TYPE_LABELS } from '@/lib/labels';
import ModerationRules from './ModerationRules';
import QuarantineList from './QuarantineList';
import { QUEUE_LAYOUT_CSS, ADMIN_CARD_CSS } from './queueLayout';

function ageLabel(o) {
  if (o.age_from == null && o.age_to == null) return '';
  if (o.age_from === 0 && o.age_to >= 17) return '0–18 р.';
  if (o.age_from === o.age_to) return `${o.age_from} р.`;
  return `${o.age_from}–${o.age_to} р.`;
}

// Вартість на сайті буває лише двох видів (рішення Марії 13.09.2026): родина
// платить хоч щось — «платно», не платить нічого — «безкоштовно».
function costLabel(o) {
  if (!o.cost_type) return null;
  return o.cost_type === 'free' ? 'безкоштовно' : 'платно';
}

const WHY_ICON = { stop: '⛔', check: '⚠️', ready: '✅' };

function MiniCol({ label, item, accent }) {
  const meta = [
    ageLabel(item),
    item.cost_type === 'free' ? 'безкоштовно' : null,
    formatEventDates(item) ? `📅 ${formatEventDates(item)}`
      : item.deadline ? `⏰ до ${formatDate(item.deadline)}`
      : item.recurrence === 'annual' ? '🔁 щорічна'
      : item.recurrence === 'ongoing' ? '♾ постійна'
      : '⚠️ без дати',
  ].filter(Boolean).join(' · ');
  return (
    <div style={{ background: '#fff', border: `1px solid ${accent || '#d3dbe9'}`, borderRadius: 8, padding: '8px 10px' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: accent || '#54617a', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.3, marginBottom: 4 }}>{item.title}</div>
      <div style={{ fontSize: 14, color: '#54617a', marginBottom: meta ? 5 : 0 }}>
        {item.source || '—'}{meta ? ` · ${meta}` : ''}
      </div>
      {item.source_url
        ? <a href={item.source_url} target="_blank" rel="noreferrer" style={{ fontSize: 14, color: '#1e4fd6', fontWeight: 600 }}>🔗 відкрити ↗</a>
        : null}
    </div>
  );
}

/**
 * Картка читається згори вниз одним рухом (Марія, 23.09.2026: «абсолютно
 * нічого не зрозуміло»):
 *   1. ЧОМУ вона тут — один рядок, найбільший на картці;
 *   2. ЩО це за можливість — назва й один рядок фактів;
 *   3. ЩО зробити — кнопки.
 * Усе службове (цитати зі сторінки, позначки конвеєра) — під «Що знайшла
 * машина»: воно потрібне, коли щось не сходиться, і заважає, коли сходиться.
 */
function Card({ o, mode, reason, today, onAction, match, notes = [] }) {
  // Поле — лише для нового коментаря людини. Позначки конвеєра
  // (admin_comment) показуємо окремо й не даємо затерти (22.09.2026).
  const [comment, setComment] = useState('');
  const [openNotes, setOpenNotes] = useState(notes);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null); // 'approved'|'skipped'|'verified'|'removed'

  async function act(action) {
    setBusy(true);
    const res = await onAction(o.id, action, comment);
    setBusy(false);
    if (!res.ok) {
      alert(res.error === 'note_not_saved'
        ? 'Рішення збережено, а коментар — ні. Натисни ще раз.'
        : 'Не вдалося. Спробуй ще раз або перезайди.');
      return;
    }
    if (action === 'comment') {
      if (res.note) setOpenNotes((list) => [...list, res.note]);
      setComment('');
      return;
    }
    setDone({ approve: 'approved', skip: 'skipped', verify: 'verified', remove: 'removed' }[action]);
  }

  // Дата, тип, вік, вартість і місце-або-формат обовʼязкові перед виходом на
  // сайт (вимога Марії 11.09.2026).
  const missing = missingRequired(o);
  // Цитати зі сторінки — доказ, що поле не вигадане. Тут вони не на видноті:
  // коли все підтверджено, дивитись на них нема потреби.
  const quotes = mode === 'drafts'
    ? CRITERIA.order.filter((k) => o.evidence?.[k]).map((k) => [CRITERIA.required[k].label, o.evidence[k]])
    : [];
  const warnings = dateWarnings(o);
  const when = formatEventDates(o);
  const dl = deadlineNote(o, today);
  const gone = done === 'approved' || done === 'skipped' || done === 'removed';

  return (
    <article className={`adm-card${gone ? ' gone' : ''}${done === 'approved' || done === 'verified' ? ' ok' : ''}${done === 'skipped' || done === 'removed' ? ' off' : ''}`}>
      {reason ? (
        <p className={`adm-why ${reason.tone}`}>
          <span aria-hidden="true">{WHY_ICON[reason.tone]}</span>
          <span>
            {reason.text}
            {/* Другий рядок — чого бракує, коли головна причина інша: без
                нього людина бачила сіру кнопку «Додати на сайт» і не знала,
                чому вона сіра. */}
            {reason.gap ? <span className="gap">{reason.gap}</span> : null}
          </span>
        </p>
      ) : null}

      <h3 className="adm-title">
        <a href={`/admin/edit/${o.id}`}>{o.title}</a>
      </h3>

      {/* Один рядок фактів: тип, вік, вартість, коли, дедлайн зі строком.
          Раніше ці самі факти стояли в трьох місцях картки. */}
      <p className="adm-facts">
        <span className="chip">{TYPE_LABELS[o.opportunity_type] || o.opportunity_type || 'тип не вказано'}</span>
        {/* Вік без цитати зі сторінки — не факт, а здогад машини, і читався
            він тут так само впевнено, як прочитаний у тексті (Марія,
            23.09.2026). Тепер на його місці стоїть правда. */}
        {mode === 'drafts' && !o.evidence?.age
          ? <span className="soft">вік у джерелі не названий</span>
          : ageLabel(o) ? <span>{ageLabel(o)}</span> : null}
        {costLabel(o) ? <span className={o.cost_type === 'free' ? 'good' : ''}>{costLabel(o)}</span> : null}
        {/* Коли відбувається і до коли подати — два різні факти й два підписи
            (17.09.2026). */}
        {when ? <span>коли: {when}</span> : null}
        {dl ? <span className={dl.past || dl.days <= 7 ? 'hot' : ''}>подача {dl.text}</span> : null}
        {!when && !dl && o.recurrence === 'annual' ? <span className="soft">щорічна</span> : null}
        {!when && !dl && o.recurrence === 'ongoing' ? <span className="soft">постійна</span> : null}
        {mode === 'active' && o.verified_at ? <span className="good">✓ перевірено</span> : null}
      </p>

      {o.summary ? <p className="adm-sum">{o.summary}</p> : null}

      <p className="adm-src">
        {o.source ? <span>{o.source}</span> : null}
        {o.source_url
          ? <a href={o.source_url} target="_blank" rel="noreferrer">🔗 відкрити джерело ↗</a>
          : <span>⚠ немає посилання</span>}
      </p>

      {/* Те, що людина має звірити руками. Заголовок не дублює причину:
          вона вже сказана вгорі, тут — самі факти для порівняння. */}
      {o.dup_of ? (
        <div className="adm-note warn">
          <div className="h">Порівняй обидва{o.dup_score ? ` (схожість ~${Math.round(o.dup_score * 100)}%)` : ''}:</div>
          <div className="adm-pair">
            <MiniCol label="Ця" item={o} accent="#b4530a" />
            {match
              ? <MiniCol label="Схожа (вже в базі)" item={match} />
              : <div style={{ alignSelf: 'center', padding: '0 4px' }}>
                  <a href={`/o/${o.dup_of}`} target="_blank" rel="noreferrer">переглянути схожу ↗</a>
                </div>}
          </div>
        </div>
      ) : null}

      {warnings.length ? (
        <div className="adm-note warn">
          {warnings.map((w) => <div key={w} style={{ marginBottom: 5 }}>{w}</div>)}
        </div>
      ) : null}

      {/* На сайті причина не показується (там просто дивляться), тож
          неповноту такого запису кажемо окремим рядком. */}
      {!reason && missing.length ? (
        <div className="adm-note warn">
          <div className="h">⛔ Уже на сайті, але неповна — бракує: {missing.join(', ')}</div>
          <a href={`/admin/edit/${o.id}`}>дозаповнити →</a>
        </div>
      ) : null}

      {openNotes.length ? (
        <div className="adm-note info">
          <div className="h">💬 Коментар чекає на обробку</div>
          {openNotes.map((n) => (
            <div key={n.id}>
              <span style={{ color: '#54617a' }}>{formatDate(String(n.created_at).slice(0, 10))}:</span> {n.body}
            </div>
          ))}
        </div>
      ) : null}

      {quotes.length || o.admin_comment ? (
        <details className="adm-more">
          <summary>Що знайшла машина</summary>
          <div className="in">
            {quotes.map(([label, q]) => (
              <div key={label}><b>{label}:</b> «{q}»</div>
            ))}
            {o.admin_comment ? <div><b>Позначки конвеєра:</b> {o.admin_comment}</div> : null}
          </div>
        </details>
      ) : null}

      {done ? (
        <p className="adm-done">
          {{ approved: '✅ Додано на сайт', skipped: '❌ Пропущено', verified: '✓ Перевірено',
             removed: '🗑 Прибрано' }[done]}
        </p>
      ) : (
        <>
          <textarea
            className="adm-ta"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Коментар: питання, сумнів або причина рішення…"
            rows={2}
          />
          <div className="adm-acts">
            {mode === 'drafts' ? (
              <>
                <button type="button" className="adm-btn go" onClick={() => act('approve')} disabled={busy || missing.length > 0}>✅ Додати на сайт</button>
                <button type="button" className="adm-btn" onClick={() => act('skip')} disabled={busy}>❌ Пропустити</button>
              </>
            ) : (
              <>
                <button type="button" className="adm-btn go" onClick={() => act('verify')} disabled={busy}>🔗 Посилання робоче</button>
                <button type="button" className="adm-btn del" onClick={() => act('remove')} disabled={busy}>🗑 Прибрати</button>
              </>
            )}
            {/* Редагування жило лише під назвою картки, і знайти його було
                неможливо (22.09.2026). */}
            <a className="adm-btn" href={`/admin/edit/${o.id}`}>✏️ Редагувати</a>
            {/* Питання без рішення: запис лишається в черзі, коментар — у
                moderation_notes відкритим, доки його не оброблять; його
                показує ранкове зведення (Марія, 22.09.2026). */}
            <button type="button" className="adm-btn" onClick={() => act('comment')} disabled={busy || !comment.trim()}>💬 Залишити коментар</button>
          </div>
        </>
      )}
    </article>
  );
}

// Два розділи, як Марія намалювала на папері 23.09.2026: «Потребує рішення»
// (і показувати, ЧОМУ саме цей запис сюди потрапив) і «Активні» — те, що
// зараз на сайті, просто продивлятися. Решта — знахідки скраперів, те, що
// чекає машину, і неповні записи на сайті — нікуди не поділась: вона одним
// кліком у рядку під заголовком. Вкладок було пʼять, і людина мусила
// тримати в голові, чим вони відрізняються.
const MAIN = ['decision', 'active'];
const ALSO = [
  { key: 'raw', label: 'Знахідки скраперів' },
  { key: 'waiting', label: 'Чекає машину' },
  { key: 'incomplete', label: 'Неповні на сайті' },
];
const ALL = [...MAIN, ...ALSO.map((x) => x.key)];
// Старі адреси: /admin/quarantine → ?tab=raw, а закладка на ?tab=drafts
// (колишня «До рішення») має відкривати той самий список.
const ALIAS = { drafts: 'decision' };

export default function AdminList({
  drafts, actives, raw = [], matches = {}, notes = {}, today, initialTab, children,
}) {
  const start = ALIAS[initialTab] || initialTab;
  const [tab, setTab] = useState(ALL.includes(start) ? start : 'decision');
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);

  async function onAction(id, action, comment) {
    try {
      const res = await fetch('/api/admin/review', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, comment }),
      });
      const json = await res.json().catch(() => ({}));
      return { ok: res.ok && json.ok !== false, error: json.error, note: json.note };
    } catch { return { ok: false }; }
  }

  const activeFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q
      ? actives.filter((o) => (o.title || '').toLowerCase().includes(q) || (o.source || '').toLowerCase().includes(q))
      : actives;
    // Possible duplicates first, so they're easy to review.
    return [...base].sort((a, b) => (b.dup_of ? 1 : 0) - (a.dup_of ? 1 : 0));
  }, [actives, search]);

  const flaggedCount = useMemo(() => actives.filter((o) => o.dup_of).length, [actives]);

  // Черга людини — за ризиком, а не за сумнівом машини (Марія, 22.09.2026).
  // Усе, чому просто бракує поля чи цитати, чекає машину.
  const { forHuman, waiting } = useMemo(() => splitQueue(drafts), [drafts]);

  // А всередині черги порядок задає дедлайн (Марія, 23.09.2026: «сортувати
  // за найближчим дедлайном»): спершу те, у чого дата горить, потім усе інше
  // — у тому ж порядку ваги ризику, бо сортування стабільне.
  const queue = useMemo(() => sortByDeadline(forHuman, (x) => x.row.deadline), [forHuman]);
  const waitingSorted = useMemo(() => sortByDeadline(waiting, (x) => x.row.deadline), [waiting]);

  // Окремий список для того, що вже на сайті, але без обовʼязкового мінімуму.
  // Ворота конвеєра тримають нові записи, а ці лишились з часу, коли правила
  // ще не було, — і знайти їх інакше нічим (11.09.2026).
  const incomplete = useMemo(
    () => actives.filter((o) => missingRequired(o).length > 0),
    [actives],
  );

  const counts = {
    decision: queue.length, active: actives.length,
    raw: raw.length, waiting: waitingSorted.length, incomplete: incomplete.length,
  };

  const go = (id) => { setTab(id); setShowAll(false); };
  const sec = (id, label) => (
    <button type="button" className="adm-sec" aria-pressed={tab === id} onClick={() => go(id)}>
      {label} <span className="n">({counts[id]})</span>
    </button>
  );

  const shown = showAll ? queue : queue.slice(0, DAILY_CAP);

  return (
    <div className="adm-queue">
      <style dangerouslySetInnerHTML={{ __html: QUEUE_LAYOUT_CSS + ADMIN_CARD_CSS }} />
      <div className="adm-queue-head">
        {children}
        {/* Рядок під заголовком: усе, що пішло з головного ряду вкладок. */}
        <p className="adm-also">
          <span className="lbl">Також:</span>
          {ALSO.map((x) => (
            <button key={x.key} type="button" aria-pressed={tab === x.key} onClick={() => go(x.key)}>
              {x.label} <span className="n">({counts[x.key]})</span>
            </button>
          ))}
        </p>
      </div>
      <aside className="adm-queue-rules" aria-label="Правила модерації">
        <ModerationRules section={tab} />
      </aside>
      <div className="adm-queue-body" style={{ marginTop: 22 }}>
        <div className="adm-secs">
          {sec('decision', '🙋 Потребує рішення')}
          {sec('active', '🌍 На сайті')}
        </div>

        {tab === 'decision' ? (
          queue.length === 0 ? (
            <p className="adm-lead">Нічого не чекає рішення. Нові кандидати прийдуть після нічного прогону.</p>
          ) : (
            <>
              <p className="adm-lead">
                Кожна картка починається з рядка, <b>чому вона тут</b>. Спершу те, у чого
                найближчий дедлайн; без дедлайну — нижче, за вагою ризику.
              </p>
              {shown.map(({ row }) => (
                <Card key={row.id} o={row} mode="drafts" reason={decisionReason(row)}
                  today={today} onAction={onAction} match={matches[row.dup_of]} notes={notes[row.id]} />
              ))}
              {/* Межа в добу лишається підказкою «на сьогодні вистачить», а
                  не ситом: решта відкривається одним кліком, нічого не
                  зникає (Марія, 22.09.2026 — не більше 15–20 на день). */}
              {!showAll && queue.length > DAILY_CAP ? (
                <p style={{ marginTop: 14 }}>
                  <button type="button" className="adm-btn" onClick={() => setShowAll(true)}>
                    Показати решту ({queue.length - DAILY_CAP})
                  </button>
                </p>
              ) : null}
            </>
          )
        ) : tab === 'active' ? (
          <>
            <input
              className="adm-search"
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Пошук за назвою або джерелом…"
            />
            <p className="adm-lead">
              Те, що зараз на сайті. Показано {activeFiltered.length} із {actives.length}.
              {flaggedCount > 0 ? <> <b>⚠ {flaggedCount} можливих дублікатів</b> — вгорі списку.</> : null}
            </p>
            {activeFiltered.slice(0, 150).map((o) => (
              <Card key={o.id} o={o} mode="active" reason={null} today={today}
                onAction={onAction} match={matches[o.dup_of]} notes={notes[o.id]} />
            ))}
            {activeFiltered.length > 150
              ? <p className="adm-lead" style={{ marginTop: 14 }}>Показано перші 150 — звузь пошук, щоб побачити решту.</p>
              : null}
          </>
        ) : tab === 'raw' ? (
          <>
            <p className="adm-lead">
              Сирий текст зі скраперів, де модель не певна, що це можливість для дитини.
              Одне питання: <b>це для дітей?</b> «Завести можливість» віддає текст у нічний
              розбір — модель заповнить поля, і запис прийде в «Потребує рішення».
              «Відхилити» — назавжди.
            </p>
            <QuarantineList rows={raw} />
          </>
        ) : tab === 'waiting' ? (
          waitingSorted.length === 0 ? (
            <p className="adm-lead">Нічого не чекає машину.</p>
          ) : (
            <>
              <p className="adm-lead">
                Ці записи <b>не на сайті й не в щоденній черзі</b>: їм бракує поля або
                цитати зі сторінки. Машина щоночі перечитує до 20 таких сторінок — і коли
                на сторінці зʼявиться потрібна фраза, запис вийде на сайт сам. Заглядай
                сюди, коли є час.
              </p>
              {waitingSorted.slice(0, 150).map(({ row }) => (
                <Card key={row.id} o={row} mode="drafts" reason={decisionReason(row)}
                  today={today} onAction={onAction} match={matches[row.dup_of]} notes={notes[row.id]} />
              ))}
              {waitingSorted.length > 150
                ? <p className="adm-lead" style={{ marginTop: 14 }}>Показано перші 150 зі {waitingSorted.length}.</p>
                : null}
            </>
          )
        ) : (
          incomplete.length === 0 ? (
            <p className="adm-lead">Усі записи на сайті мають дату, тип, вік, вартість і місце.</p>
          ) : (
            <>
              <p className="adm-lead">
                Ці записи вже на сайті, але без обовʼязкового мінімуму. Нові такими
                не стають — ворота конвеєра їх не пускають.
              </p>
              {incomplete.slice(0, 150).map((o) => (
                <Card key={o.id} o={o} mode="active" reason={gapReason(o)} today={today}
                  onAction={onAction} match={matches[o.dup_of]} notes={notes[o.id]} />
              ))}
            </>
          )
        )}
      </div>
    </div>
  );
}
