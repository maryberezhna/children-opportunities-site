const COLUMNS = [
  'title', 'slug', 'summary', 'age_from', 'age_to', 'opportunity_type',
  'categories', 'child_needs', 'format', 'cost_type', 'deadline',
  'source_url', 'source', 'content_hash',
];

function escapeCell(value) {
  if (value == null) return '';
  if (Array.isArray(value)) value = JSON.stringify(value);
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCsv(rows) {
  const header = COLUMNS.join(',');
  const lines = rows.map((r) => COLUMNS.map((c) => escapeCell(r[c])).join(','));
  return [header, ...lines].join('\n') + '\n';
}
