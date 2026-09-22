// Дублі в «Черзі»: плашку «Можливий дублікат» ставить система, не людина
// (Марія, 22.09.2026: «це не має перевіряти людина, система має сама
// показувати можливі дублікати»). Джерел прапорця два: dup_of, який
// discover_agent записав при знахідці, і живий пошук find_draft_dups при
// відкритті черги — він покриває кандидатів з усіх шляхів (скрапери,
// карантин, пропозиції). Прапорець агента не перебиваємо: він порівнював
// ще й посилання, а не лише назву.
export function mergeDraftDups(drafts, pairs) {
  const best = new Map();
  for (const p of pairs || []) {
    if (!p || !p.draft_id || !p.match_slug) continue;
    const prev = best.get(p.draft_id);
    if (!prev || (p.sim ?? 0) > (prev.sim ?? 0)) best.set(p.draft_id, p);
  }
  return (drafts || []).map((o) => {
    if (o.dup_of) return o;
    const p = best.get(o.id);
    return p ? { ...o, dup_of: p.match_slug, dup_score: p.sim ?? null } : o;
  });
}
