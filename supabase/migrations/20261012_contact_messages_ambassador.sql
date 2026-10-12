-- Тип звернення «Стати амбасадором» (/ambasadory, 12.10.2026).
--
-- Заодно дописуємо 'story' і 'olimpiada': їх додали в lib/contactTypes.js
-- (29.09 і 06.10.2026), а перевірку в базі — ні. Станом на 12.10.2026 жива
-- contact_messages_type_chk пускала лише шість перших типів, тож форма
-- «Розповісти, куди потрапила дитина» і форма внизу /olimpiada отримували
-- від бази відмову, а людина бачила «Не вдалося надіслати».
--
-- Список має збігатися з CONTACT_TYPES у lib/contactTypes.js.
alter table contact_messages drop constraint if exists contact_messages_type_chk;
alter table contact_messages add constraint contact_messages_type_chk check (type in
  ('opportunity','story','error','complaint','partnership','media','olimpiada','ambassador','other'));

comment on column contact_messages.publish_consent is
  'Людина дозволила показати її на сайті: історію з іменем (тип story) або імʼя та місто на сторінці амбасадорів (тип ambassador).';
