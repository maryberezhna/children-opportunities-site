-- Пароль застосунку пошти проєкту для листів олімпіади із сайту.
--
-- Запрошення до тесту сайт тепер шле сам у мить оплати (lib/olimpiada-mail.js):
-- розклад GitHub запізнювався на 3–7 годин. Пароль Gmail був лише в секретах
-- GitHub, а змінних оточення Vercel звідси не задати, тож воркфлоу
-- «Олімпіада — пароль пошти для сайту» кладе його в Supabase Vault
-- (зашифровано), а сайт читає сервісним ключем. Рішення Марії 07.10.2026:
-- «скопіюй сам».
--
-- Обидві функції — лише для service_role: anon і authenticated їх не бачать.

create or replace function public.olimp_mail_password()
returns text
language sql
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets
  where name = 'dityam_gmail_app_password'
  limit 1
$$;

create or replace function public.olimp_mail_password_set(p text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  sid uuid;
begin
  if p is null or length(trim(p)) < 8 then
    raise exception 'empty password';
  end if;
  select id into sid from vault.secrets where name = 'dityam_gmail_app_password';
  if sid is null then
    perform vault.create_secret(p, 'dityam_gmail_app_password',
      'Пароль застосунку hellodityam.com.ua@gmail.com — листи олімпіади із сайту');
  else
    perform vault.update_secret(sid, p);
  end if;
end
$$;

revoke all on function public.olimp_mail_password() from public, anon, authenticated;
revoke all on function public.olimp_mail_password_set(text) from public, anon, authenticated;
grant execute on function public.olimp_mail_password() to service_role;
grant execute on function public.olimp_mail_password_set(text) to service_role;
