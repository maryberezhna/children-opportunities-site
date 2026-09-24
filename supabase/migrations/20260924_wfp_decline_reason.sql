-- Чому не пройшла оплата Dityam+.
--
-- 24.09.2026 перша людина дійшла до кінця анкети й не оплатила: у WayForPay
-- стоїть DECLINE на 119 грн, а в нашій базі — лише status='paused'. Колбек
-- приносить reasonCode і reason (недостатньо коштів, 3-D Secure, прострочена
-- картка), але ми їх читали тільки для перевірки підпису й викидали. Єдиним
-- місцем із причиною був кабінет WayForPay.
--
-- Тепер причина лежить поруч із підпискою: видно в /admin/plus і приходить
-- у адмін-чат одразу, а не через ручний похід у кабінет.
alter table digest_subscribers
  add column if not exists wfp_last_status      text,        -- Declined | Expired | Refunded | Voided | RefundInProcessing
  add column if not exists wfp_last_reason      text,        -- текст причини від WayForPay, як прийшов
  add column if not exists wfp_last_reason_code integer,     -- код з https://wiki.wayforpay.com/en/view/852131
  add column if not exists wfp_last_failed_at   timestamptz;
