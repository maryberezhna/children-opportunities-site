import { redirect } from 'next/navigation';

// «Люди» стали «Користувачами» за ескізом Марії (11.10.2026): одне місце в
// адмінці — /admin/korystuvachi. Стара адреса лишається переадресацією, бо на
// неї посилаються старі закладки й коментарі в коді.
export const dynamic = 'force-dynamic';

export default function PeopleRedirect() {
  redirect('/admin/korystuvachi');
}
