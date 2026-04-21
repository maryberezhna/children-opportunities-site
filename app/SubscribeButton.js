'use client';
import { OPEN_SUBSCRIBE_EVENT } from './SubscribePopup';

export default function SubscribeButton({ className, children, ariaLabel, source = 'footer' }) {
  const handleClick = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(OPEN_SUBSCRIBE_EVENT, {
        detail: { source }
      }));
    }
  };

  return (
    <button
      type="button"
      className={className}
      onClick={handleClick}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
}
