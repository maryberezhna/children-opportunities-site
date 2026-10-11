'use client';
// Фото малюнка → JPEG ≤1600 px на полотні браузера: файл стає легким, а
// метадані з GPS зникають ще до відправки (сервер вирізає їх удруге).
import { OBRAZ } from '@/lib/obraz';

export async function toJpeg(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const scale = Math.min(1, OBRAZ.maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; // прозорий PNG — на білому, а не на чорному
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.86));
  } finally {
    URL.revokeObjectURL(url);
  }
}
