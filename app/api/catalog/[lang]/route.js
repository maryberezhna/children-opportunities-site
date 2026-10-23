import { NextResponse } from 'next/server';
import { supabase, publicOpportunities, fetchAllRows, rowsOrThrow } from '@/lib/supabase';
import { clientRows } from '@/lib/client-rows';
import { DETAIL_FIELDS } from '@/lib/catalog-split';

// Тексти карток каталогу, які головна не везе в HTML (lib/catalog-split.js):
// список довантажує їх одразу після показу сторінки. Статичний файл із
// перебудовою раз на 5 хвилин — як і сама головна, тож запитів у базу від
// відвідувачів немає: їх віддає CDN.
//
// Помилка бази кидається (rowsOrThrow), а не стає порожнім списком: інакше
// закешувався б файл без текстів і картки так і лишились би заглушками.
export const revalidate = 300;
export const dynamicParams = false;

export function generateStaticParams() {
  return [{ lang: 'uk' }, { lang: 'en' }];
}

export async function GET(_request, { params }) {
  const en = params.lang === 'en';
  if (!supabase) return NextResponse.json({ rows: [] });
  // summary_en — лише англійській сторінці: на українській він подвоїв би файл.
  const fields = ['id', ...DETAIL_FIELDS.filter((f) => en || f !== 'summary_en')].join(', ');
  const rows = rowsOrThrow(await fetchAllRows(() =>
    publicOpportunities(fields).order('created_at', { ascending: false }).order('id')), 'catalog-details');
  return NextResponse.json({ rows: clientRows(rows, en ? 'en' : 'uk') });
}
