"""ladder.py — «наступна сходинка» в добірці Dityam+ (рішення Марії 27.09.2026).

Родина позначила програму кнопкою «✍️ подаюсь» (plus_applications). Якщо для
неї є ПІДТВЕРДЖЕНИЙ людиною звʼязок «після X → Y» (opportunity_ladder), добірка
показує Y окремим блоком: це і є відповідь «так» на питання, чи веде платформа
дитину по драбині.

Звʼязки пропонує модель (ladder_propose.py), вирішує людина в адмін-боті.
Непідтверджене сюди не потрапляє ніколи: хибна сходинка гірша за відсутню.

Модуль не шле й не пише сам — лише читає й добирає; запис «показали» робить
personal_digest після успішної відправки.
"""
import plus_profile

# Після чого пропонуємо наступну сходинку. 'skipped' — родина передумала:
# будувати драбину від програми, куди дитина не пішла, було б вигадкою за неї.
ACTIVE_STAGES = ("applying", "applied", "accepted")
MAX_IN_DIGEST = 2

# Як назвати позначку родини в підказці — дослівно за стадією, без
# перебільшення: «подаєтесь» не те саме, що «дитину взяли».
AFTER_PHRASE = {
    "applying": "на яку ви подаєтесь",
    "applied": "на яку ви подались",
    "accepted": "куди дитину взяли",
}


def load_confirmed(client, from_ids) -> dict:
    """{from_id: [рядок звʼязку]} — лише підтверджені людиною."""
    ids = sorted({str(i) for i in from_ids if i})
    if not ids:
        return {}
    rows = (client.table("opportunity_ladder").select("id, from_id, to_id")
            .eq("status", "confirmed").in_("from_id", ids).execute().data or [])
    out = {}
    for r in rows:
        out.setdefault(str(r["from_id"]), []).append(r)
    return out


def load_titles(client, ids) -> dict:
    """Назви програм, після яких пропонуємо сходинку. Окремим запитом: сама
    програма X могла вже закритись і в пул активних не входить."""
    ids = sorted({str(i) for i in ids if i})
    if not ids:
        return {}
    rows = (client.table("opportunities").select("id, title")
            .in_("id", ids).execute().data or [])
    return {str(r["id"]): r["title"] for r in rows}


def load_sent(client, subs) -> dict:
    """{subscriber_id: {ladder_id}} — що кому вже показали."""
    ids = [s["id"] for s in subs if s.get("id")]
    if not ids:
        return {}
    rows = (client.table("plus_ladder_sent").select("subscriber_id, ladder_id")
            .in_("subscriber_id", ids).execute().data or [])
    out = {}
    for r in rows:
        out.setdefault(str(r["subscriber_id"]), set()).add(str(r["ladder_id"]))
    return out


def fits_family(sub: dict, kids: list, o: dict) -> list:
    """Діти родини, яким Y підходить. Вподобання тут не питаємо: інтерес уже
    показала сама родина, позначивши попередню сходинку. Вік, вартість і місце
    — так само, як у звичайній добірці."""
    if sub.get("cost_pref") == "free_only" and o.get("cost_type") != "free":
        return []
    if not plus_profile.place_ok(o, sub.get("places") or []):
        return []
    kids = kids or [dict(plus_profile.EMPTY_CHILD)]
    return [k for k in kids
            if plus_profile.age_overlap(o.get("age_from") or 0, o.get("age_to") or 18,
                                        k.get("age_bands") or [])]


def next_steps(sub: dict, kids: list, marked: dict, confirmed: dict, pool_by_id: dict,
               titles: dict, sent: set, skip: set, limit: int = MAX_IN_DIGEST) -> list:
    """Сходинки для однієї родини.

    marked      — {opportunity_id: stage}: що родина позначила;
    confirmed   — {from_id: [звʼязок]} з load_confirmed;
    pool_by_id  — активні записи, які добірка взагалі може надіслати (дедлайн
                  не ближче MIN_LEAD_DAYS, не «набір постійний» як припущення);
    sent        — id звʼязків, уже показаних цій родині;
    skip        — те, що родина відкинула 👎 або вже позначила.

    Повертає копії записів Y з полями _ladder_id, _after (назва X), _stage і
    _for (кому, якщо дітей кілька)."""
    out, seen = [], set()
    for from_id, stage in marked.items():
        if stage not in ACTIVE_STAGES:
            continue
        for row in confirmed.get(str(from_id), []):
            to_id = str(row["to_id"])
            if str(row["id"]) in sent or to_id in skip or to_id in seen:
                continue
            o = pool_by_id.get(to_id)
            if not o:
                continue
            hits = fits_family(sub, kids, o)
            if not hits:
                continue
            seen.add(to_id)
            for_line = plus_profile.for_line({"kids": hits}, len(kids or []))
            out.append(dict(o, _ladder_id=str(row["id"]), _after=titles.get(str(from_id), ""),
                            _stage=stage, _for=for_line))
            if len(out) >= limit:
                return out
    return out


def after_line(o: dict) -> str:
    """«Після «X», на яку ви подаєтесь.» — звідки взялась ця сходинка."""
    phrase = AFTER_PHRASE.get(o.get("_stage"), AFTER_PHRASE["applying"])
    title = o.get("_after") or "попередньої програми"
    return f"Після «{title}», {phrase}."
