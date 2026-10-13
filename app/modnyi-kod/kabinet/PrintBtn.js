'use client';
export default function PrintBtn() {
  return <button type="button" className="mk-btn-y" onClick={() => window.print()}>Роздрукувати чи зберегти PDF</button>;
}
