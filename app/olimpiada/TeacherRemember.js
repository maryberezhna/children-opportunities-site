'use client';

// Сайт памʼятає педагога в цьому браузері (Марія, 22.10.2026): педагогиня
// зареєструвалась, не зберегла посилання — і сторінки вже не знайти. Тепер код
// сторінки лишається тут після форми й після відкриття самої сторінки, а блок
// «Для педагогів» показує «Ваша сторінка педагога →». Окремий ключ, не
// olimp_teacher_ref: той ставлять батьки, що прийшли за посиланням педагога.
import { useEffect } from 'react';
import { validTeacherCode } from '@/lib/olimpiada';

const KEY = 'olimp_teacher_page';

export function rememberTeacher(code, name) {
  if (!validTeacherCode(code)) return;
  try { window.localStorage.setItem(KEY, JSON.stringify({ c: code, name: name || '' })); } catch { /* приватний режим */ }
}

export function savedTeacher() {
  try {
    const v = JSON.parse(window.localStorage.getItem(KEY) || 'null');
    return v && validTeacherCode(v.c) ? { code: v.c, name: String(v.name || '') } : null;
  } catch {
    return null;
  }
}

// На сторінці педагога: відкрили її з листа — запамʼятали й тут.
export default function RememberTeacher({ code, name }) {
  useEffect(() => { rememberTeacher(code, name); }, [code, name]);
  return null;
}
