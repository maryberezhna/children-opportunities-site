-- Згода педагога на листи про інші олімпіади й конкурси для учнів (Марія,
-- 11.10.2026): кнопка «Так, повідомляйте мене» в першому листі й на сторінці
-- педагога. Посилання підписане (lib/olimpiada-sign.js) і веде на
-- /api/olimpiada/teacher/notify — він ставить notify_ok_at лише раз.
-- Окремий файл: 20261011_olimpiada_teachers.sql уже застосовано.
-- Самих розсилок ще немає — поки лише записуємо згоду.
alter table public.olimpiada_teachers
  add column if not exists notify_ok_at timestamptz;

comment on column public.olimpiada_teachers.notify_ok_at is 'Коли педагог погодився на листи про інші олімпіади й конкурси для учнів (кнопка «Так, повідомляйте мене»).';

-- Подяку тепер видаємо один раз — після 5 учнів (TEACHER_THANKS_AT), а не з першого.
comment on table public.olimpiada_teachers is 'Педагоги онлайн-олімпіади: особисте посилання /olimpiada?vid=<code> і одна подяка, коли за ним олімпіаду пройдуть 5 учнів (з 11.10.2026).';
comment on column public.olimpiada_teachers.thanks_sent_at is 'Коли подяку видано (5-й учень пройшов тест) і надіслано листом; місяць і рік цієї дати — на самій подяці.';
