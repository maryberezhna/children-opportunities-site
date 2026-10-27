'use client';
import { useEffect, useState } from 'react';
import { overlayQueue } from '@/lib/overlay-queue';

/**
 * Місце вікна в черзі (lib/overlay-queue.js). wants — вікно хоче бути
 * показаним; повертає true, коли настала його черга. Закрили (wants=false)
 * або компонент зник — місце звільняється.
 */
export default function useOverlaySlot(name, wants, { force = false } = {}) {
  const [active, setActive] = useState(null);

  useEffect(() => {
    const q = overlayQueue();
    if (!q) return undefined;
    setActive(q.active);
    return q.subscribe(setActive);
  }, []);

  useEffect(() => {
    const q = overlayQueue();
    if (!q) return;
    if (wants) q.request(name, { force });
    else q.release(name);
  }, [name, wants, force]);

  useEffect(() => () => overlayQueue()?.release(name), [name]);

  return Boolean(wants) && active === name;
}
