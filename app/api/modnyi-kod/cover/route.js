// Обкладинка картинкою (PNG 1080×1440) — щоб поділитися в Instagram, Telegram,
// Viber чи зберегти (Марія, 13.10.2026: «нема кнопки поділитися, бажано одразу
// у чат чи соцмережі»). Доступ — лише за токеном кабінету: картинку бачить той,
// хто має посилання з листа. Ділимося самою картинкою й сторінкою олімпіади,
// а не приватним кабінетом. Розміри — ті самі пропорції, що й у VogueCover
// (1cqw = 10.8px).
import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { validMkToken, MK } from '@/lib/modnyi-kod';
import { DEFS, lookSvg, cleanLook } from '@/lib/modnyi-kod-looks';
import { mkDb, entryByToken } from '@/lib/modnyi-kod-server';
import { COVER_THEMES, inLook, mottoFor } from '@/app/modnyi-kod/VogueCover';
import { monthName } from '@/lib/olimpiada';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const W = 1080;
const H = 1440;
const cq = (n) => Math.round(n * W / 100);
const BARS = [3, 2, 2, 4, 2, 3, 2, 2, 4, 3, 2, 2, 3, 4, 2, 2, 3, 2, 4, 2, 3, 2, 2, 3, 4, 2, 2, 3, 2, 3];
const fontDir = path.join(process.cwd(), 'public', 'fonts');
const wordCap = (w) => (w === 'дизайнерка' ? 'Дизайнерка' : w === 'дизайнер' ? 'Дизайнер' : '');

export async function GET(req) {
  const t = new URL(req.url).searchParams.get('t');
  if (!validMkToken(t)) return new Response('not found', { status: 404 });
  const row = await entryByToken(mkDb(), t).catch(() => null);
  if (!row || !row.look_at || row.refunded_at) return new Response('not found', { status: 404 });

  const [caveat, lora, manrope] = await Promise.all(
    ['Caveat-Bold.ttf', 'Lora-SemiBold.ttf', 'Manrope-Bold.ttf'].map((f) => readFile(path.join(fontDir, f))),
  );
  const theme = COVER_THEMES[row.cover_theme] || COVER_THEMES.pink;
  const look = cleanLook(row.look);
  const score = `${row.score}/${row.max_score}`;
  const title = row.look_title || 'Твій образ';
  const word = wordCap(row.designer_word);
  const fig = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="20 -6 160 438"><defs>${DEFS}</defs>${lookSvg(look)}</svg>`;
  const figH = Math.round(H * 0.75);
  const figW = Math.round(figH * 160 / 438);
  const small = { fontFamily: 'Manrope', fontSize: cq(2.1), letterSpacing: '0.22em', textTransform: 'uppercase' };
  const kick = { ...small, fontSize: cq(1.9), color: theme.acc, marginBottom: cq(1) };

  return new ImageResponse(
    (
      <div style={{
        width: W, height: H, display: 'flex', position: 'relative', color: '#161616', fontFamily: 'Lora',
        backgroundColor: theme.bg,
        backgroundImage: 'radial-gradient(ellipse 70% 55% at 50% 45%, rgba(255,255,255,.55), rgba(255,255,255,0) 70%)',
      }}>
        <div style={{ ...small, position: 'absolute', top: cq(3.4), left: cq(5), right: cq(5), display: 'flex', justifyContent: 'space-between', borderBottom: `${cq(0.25)}px solid #161616`, paddingBottom: cq(1.2) }}>
          <span>Випуск №1</span><span>{MK.season}</span><span>{MK.title}</span>
        </div>
        <div style={{ position: 'absolute', top: cq(7.5), left: 0, right: 0, display: 'flex', justifyContent: 'center', fontFamily: 'Caveat', fontSize: cq(18.5), lineHeight: 0.82, letterSpacing: '-0.02em' }}>dityam.com.ua</div>
        <div style={{ position: 'absolute', left: '30%', right: '30%', bottom: '11.4%', height: '3.2%', borderRadius: '50%', backgroundImage: 'radial-gradient(rgba(0,0,0,.22), rgba(0,0,0,0) 70%)' }} />
        <img src={`data:image/svg+xml;base64,${Buffer.from(fig).toString('base64')}`} width={figW} height={figH}
          style={{ position: 'absolute', left: Math.round((W - figW) / 2), bottom: Math.round(H * 0.124) }} />
        {row.winner_month ? (
          <div style={{ position: 'absolute', left: cq(5), top: cq(31), display: 'flex', backgroundColor: theme.acc, color: '#fff', fontFamily: 'Manrope', fontSize: cq(2.3), letterSpacing: '0.08em', textTransform: 'uppercase', padding: `${cq(1)}px ${cq(2.2)}px`, borderRadius: 99 }}>
            {`Обкладинка місяця · ${monthName(row.winner_month)} ${row.winner_month.slice(0, 4)}`}
          </div>
        ) : null}
        <div style={{ position: 'absolute', top: cq(44), left: cq(5), width: cq(24), display: 'flex', flexDirection: 'column' }}>
          <span style={kick}>Лук сезону</span>
          <span style={{ fontSize: cq(5.6), lineHeight: 1.05, marginBottom: cq(4.4) }}>{`«${title}»`}</span>
          <span style={kick}>У луку</span>
          <span style={{ fontSize: cq(3.6), lineHeight: 1.2 }}>{inLook(look)}</span>
        </div>
        <div style={{ position: 'absolute', top: cq(44), right: cq(5), width: cq(24), display: 'flex', flexDirection: 'column', alignItems: 'flex-end', textAlign: 'right' }}>
          <span style={kick}>{MK.title}</span>
          <span style={{ fontSize: cq(10.5), lineHeight: 0.95, letterSpacing: '-0.02em', color: theme.acc, marginBottom: cq(4.4) }}>{score}</span>
          <span style={{ fontSize: cq(3.8), lineHeight: 1.15, borderTop: `${cq(0.25)}px solid #161616`, paddingTop: cq(2) }}>{mottoFor(`${row.child_name || ''}|${row.look_title || ''}`)}</span>
        </div>
        <div style={{ position: 'absolute', left: cq(5), bottom: cq(5), display: 'flex', flexDirection: 'column' }}>
          {word ? <span style={{ ...kick, fontSize: cq(2), marginBottom: cq(1.2) }}>{word}</span> : null}
          <span style={{ fontSize: cq(9), lineHeight: 0.95, letterSpacing: '-0.02em' }}>{`${row.child_name}, ${row.child_age}`}</span>
        </div>
        <div style={{ position: 'absolute', right: cq(5), bottom: cq(5), display: 'flex', flexDirection: 'column', alignItems: 'center', backgroundColor: '#fff', padding: `${cq(1.1)}px ${cq(1.4)}px` }}>
          {/* Штрихкод смужками: repeating-linear-gradient картинка не вміє. */}
          <div style={{ display: 'flex', width: cq(14), height: cq(6), overflow: 'hidden' }}>
            {BARS.map((w, k) => <div key={k} style={{ width: w, height: '100%', marginRight: k % 3 === 2 ? 4 : 2, backgroundColor: '#111' }} />)}
          </div>
          <span style={{ fontFamily: 'Manrope', fontSize: cq(1.6), marginTop: cq(0.5), letterSpacing: '0.06em' }}>№1 · осінь 2026</span>
        </div>
      </div>
    ),
    {
      width: W, height: H,
      fonts: [
        { name: 'Caveat', data: caveat, weight: 700, style: 'normal' },
        { name: 'Lora', data: lora, weight: 600, style: 'normal' },
        { name: 'Manrope', data: manrope, weight: 700, style: 'normal' },
      ],
      headers: { 'Cache-Control': 'private, no-store' },
    },
  );
}
