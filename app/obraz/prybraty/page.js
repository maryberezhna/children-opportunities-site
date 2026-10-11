import '@/app/styles/obraz.css';
import RemoveButton from './RemoveButton';

// «Прибрати малюнок з галереї» — посилання з листа батькам. Сама сторінка
// нічого не видаляє: лише кнопка (POST), бо поштові сканери відкривають
// посилання з листів автоматично.
export const metadata = { title: 'Прибрати малюнок з галереї', robots: { index: false, follow: false } };

export default function RemovePage({ searchParams }) {
  return (
    <main className="ob"><section className="ob-wrap ob-empty">
      <p className="ob-form-title">Прибрати малюнок з галереї?</p>
      <p className="ob-text">Малюнок зникне з галереї й зі своєї сторінки, а файл ми видалимо. Повернути його не вийде — лише надіслати знову.</p>
      <RemoveButton t={String(searchParams?.t || '')} />
    </section></main>
  );
}
