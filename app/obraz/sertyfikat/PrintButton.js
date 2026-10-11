'use client';
export default function PrintButton() {
  return <button type="button" className="ob-btn ob-btn-main" onClick={() => window.print()}>Роздрукувати чи зберегти PDF</button>;
}
