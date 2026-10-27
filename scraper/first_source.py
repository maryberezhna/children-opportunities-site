"""Джерелом запису має бути сторінка можливості, а не допис, який її переказує.

Привід (Марія, 24.09.2026): «дивлюся цю можливість і посилання на телеграм
канал, а насправді телеграм канал посилається сюди… ти маєш переходити на
першоджерело завжди і його брати».

Показовий випадок — відеокурс Чілдрен Кінофесту та ЮНІСЕФ. Допис @novashkola
має два речення й жодної дати; сторінка, на яку він посилається, — вік «від 6
до 14 років», дедлайн 20 жовтня і показ 20 листопада. Тобто перехід дає не
лише чесну адресу «відкрити джерело», а й цитати на обовʼязкові поля, яких у
дописі немає взагалі.

У базі 169 записів мають адресою t.me, з них 47 активних: людина тисне
«відкрити джерело» і потрапляє в канал замість опису можливості.

Модуль чистий і синхронний у своїй логіці (вибір посилання) — мережа окремо,
щоб вибір можна було тестувати без інтернету.
"""
from __future__ import annotations

import html as _html
import logging
import re
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

# Сторінка допису — не джерело: за тижні канал прокручується, а /s/ віддає
# лише останні дописи.
_SOCIAL_HOSTS = (
    "t.me", "telegram.me", "telegram.org", "telesco.pe",
    "instagram.com", "facebook.com", "fb.com", "fb.me", "m.facebook.com",
    "x.com", "twitter.com", "tiktok.com", "linkedin.com",
    # Запрошення в чат — не сторінка можливості. У підвалі znayshov.com
    # стоять viber і facebook, і без цього рядка ланцюг ішов саме туди.
    "invite.viber.com", "viber.com", "chat.whatsapp.com", "wa.me", "discord.gg",
)
# Службові адреси всередині дописів: у кожному другому пості @tviyspace
# першим стоїть telegraph.controller.bot/files/… — це картинка допису, і вона
# віддає 403. Раніше ми б пішли саме за нею.
_TECH_HOSTS = ("telegraph.controller.bot", "controller.bot")
# Форма подачі — НЕ джерело, якщо є сторінка організатора: її місце — поле
# apply_url (виняток — Google-форма з повним описом, див. FORM_MIN_TEXT), яке
# нормалізатор заповнює окремо. У дописах @tviyspace форма трапляється
# частіше за сайт організатора, тож без цього правила ми б систематично
# міняли живий допис на порожню форму.
_FORM_HOSTS = (
    "forms.gle", "forms.office.com", "typeform.com", "jotform.com",
    "hsforms.com", "share-eu1.hsforms.com", "zohopublic.eu", "zohopublic.com",
    "surveymonkey.com", "airtable.com",
)
_FORM_PATHS = ("/forms/", "/form/")
# Відео, теки й документи — сам матеріал, а не сторінка з умовами. Джерелом
# не стають навіть за браком іншого: живий прогін 24.09.2026 підмінив два
# дописи текою Google Drive і Google-документом, і обидва як «відкрити
# джерело» гірші за сам допис. Їхнє місце — apply_url або текст запису.
_MEDIA_HOSTS = ("youtube.com", "youtu.be", "vimeo.com", "drive.google.com",
                "docs.google.com")
# Картинка чи відео за прямою адресою — теж не сторінка. Живий прогін
# 24.10.2026: svitloschool.com «переказує», і крок глибше вів на
# cdn…website-files.com/…photo_2026-05-04.jpg. PDF лишаємо: положення
# конкурсу часто живе саме в PDF.
_FILE_EXT = re.compile(r"\.(?:jpe?g|png|gif|webp|svg|heic|mp4|mov|webm|mp3|m4a|zip)$", re.I)


def _is_file(url: str) -> bool:
    try:
        return bool(_FILE_EXT.search(urlparse(url).path or ""))
    except ValueError:
        return False


def _host(url: str) -> str:
    try:
        return (urlparse(url).hostname or "").lower().removeprefix("www.")
    except ValueError:
        return ""


def _is(url: str, hosts: tuple) -> bool:
    host = _host(url)
    return any(host == h or host.endswith("." + h) for h in hosts)


# ── Чужі Telegram-канали (Марія, 27.09.2026) ──────────────────────────────
# «Ми ніколи не показуємо інші телеграм канали у першоджерелі, щоб люди не
# йшли до конкурентів». За місяць із карток сайту на дописи @Mozhlyvosti і
# @tviyspace пішло більше людей, ніж на наш канал. Допис лишається в базі
# слідом (source_url), але сайт його не показує (lib/source-link.js — те саме
# правило в JS), а запис, у якому окрім допису нема куди вести людину, сам не
# публікується (auto_review.mechanical).
_TELEGRAM_HOSTS = ("t.me", "telegram.me", "telegram.dog", "telesco.pe")
_OWN_TELEGRAM = {"dityam_com_ua", "dityamplusbot"}


def is_foreign_telegram(url) -> bool:
    """Посилання веде в Telegram, але не в наш канал чи бот Dityam+."""
    if not url:
        return False
    s = str(url).strip()
    if s.lower().startswith("tg:"):
        return True
    if not _is(s, _TELEGRAM_HOSTS):
        return False
    parts = [p for p in urlparse(s).path.split("/") if p]
    name = (parts[1] if parts and parts[0] == "s" and len(parts) > 1 else (parts[0] if parts else ""))
    return name.lower() not in _OWN_TELEGRAM


# ── Каталоги — не першоджерело ─────────────────────────────────────────────
# Сторінка програми в каталозі Eurodesk переказує організатора й посилається
# на нього; масовий прохід 28.09.2026 закрив такі записи разом із дописами
# каналів («Eurodesk — теж каталог»). Дзеркало isCatalog у lib/source-rules.js.
_CATALOG_HOSTS = ("eurodesk.eu",)


def is_catalog(url) -> bool:
    """Адреса веде в каталог чужих можливостей, а не до організатора."""
    return bool(url) and _is(str(url).strip(), _CATALOG_HOSTS)


# ── Медіа й агрегатори — знахідка, а не можливість (Марія, 11.10.2026) ────
# «Анонс чогось у медіа — це не можливість, але вже знахідка; треба йти на
# першоджерело». Список один на JS і Python — lib/publish-criteria.json.
def _not_primary_hosts() -> tuple:
    try:
        from proof import PUBLISH_CRITERIA
        return tuple(PUBLISH_CRITERIA.get("not_primary_hosts", {}).get("hosts", ()))
    except Exception:                                        # noqa: BLE001
        return _CATALOG_HOSTS


_NOT_PRIMARY_HOSTS = _not_primary_hosts()


def is_retelling_site(url) -> bool:
    """Адреса веде в медіа чи агрегатор, який переказує чужу можливість."""
    return bool(url) and _is(str(url).strip(), _NOT_PRIMARY_HOSTS)


def _organizer_apply(url) -> bool:
    """Посилання на подачу веде до організатора: не медіа, не каталог, не чужий канал."""
    u = (url or "").strip()
    return (u.lower().startswith(("http://", "https://")) and not is_retelling_site(u)
            and not is_catalog(u) and not is_foreign_telegram(u))


def source_problem(row: dict) -> str:
    """Чому джерело запису не можна показувати — або порожній рядок.

    Дзеркало sourceProblem у lib/source-rules.js: ті самі ворота стоять на
    кнопках адмінки, і до 04.10.2026 auto_review був мʼякшим за них — пускав
    допис чужого каналу, якщо в записі була форма подачі. Форма — не
    першоджерело (правило 24.09.2026), а запис без першоджерела не
    публікується (27.09.2026)."""
    url = row.get("source_url")
    if is_foreign_telegram(url):
        return "джерело — допис чужого Telegram-каналу; потрібна сторінка організатора"
    if is_catalog(url):
        return "джерело — каталог Eurodesk; потрібна сторінка організатора"
    # Медіа — знахідка; але форма чи документ організатора в apply_url ведуть
    # людину туди, де записуються, — тоді публікувати можна (Марія, 11.10.2026).
    if is_retelling_site(url) and not _organizer_apply(row.get("apply_url")):
        return (f"джерело — медіа чи агрегатор ({_host(url)}): це знахідка, "
                "потрібна сторінка організатора, форма чи контакт")
    # Посилання обовʼязкове (Марія, 09.10.2026). Порожнє джерело проходило
    # всі ворота, а сторінка без посилання — це «хочу подати, а лінку нема».
    if not public_link(row):
        return "немає посилання: ні сторінки організатора, ні форми подачі"
    return ""


def public_link(row: dict) -> str:
    """Куди сайт поведе людину: форма подачі, інакше джерело. Чужий Telegram
    сайт не показує — дзеркало publicSource().primaryUrl у lib/source-link.js."""
    for key in ("apply_url", "source_url"):
        url = (row.get(key) or "").strip()
        if url and not is_foreign_telegram(url):
            return url
    return ""


def only_foreign_telegram(row: dict) -> bool:
    """Джерело — допис чужого каналу, і власного посилання на подачу немає:
    на сайті такому запису нікуди вести людину."""
    if not is_foreign_telegram(row.get("source_url")):
        return False
    apply = row.get("apply_url")
    return not apply or is_foreign_telegram(apply)


def is_form(url: str) -> bool:
    """Форма подачі: її адреса належить apply_url, а не source_url."""
    if _is(url, _FORM_HOSTS):
        return True
    path = (urlparse(url).path or "").lower()
    return _is(url, ("docs.google.com",)) and any(p in path for p in _FORM_PATHS)


# Google-форма з повним описом — теж першоджерело (Марія, 27.10.2026: «так,
# обовʼязково»). Привід — Urban Detectives у @tviyspace: у дописі лише форма,
# сайт організатора прострочений, а сама форма має все — організатора, дати,
# для кого, дедлайн. Правило «форма віддає порожню сторінку без JS» для
# Google Forms хибне: опис лежить у HTML (FB_PUBLIC_LOAD_DATA_). Форму беремо
# лише за браком звичайної сторінки й лише тоді, коли опис змістовний.
FORM_MIN_TEXT = 300


def is_google_form(url: str) -> bool:
    if _is(url, ("forms.gle",)):
        return True
    path = (urlparse(url).path or "").lower()
    return _is(url, ("docs.google.com",)) and "/forms/" in path


def google_form_text(page_html: str) -> str:
    """Назва й опис Google-форми з HTML (без JS) або порожньо. Чиста функція."""
    m = re.search(r"FB_PUBLIC_LOAD_DATA_\s*=\s*(.*?);\s*</script>", page_html or "", re.S)
    if not m:
        return ""
    try:
        import json
        data = json.loads(m.group(1))
        info = data[1]
        title = (info[8] if len(info) > 8 and isinstance(info[8], str) else "") or (
            data[3] if isinstance(data[3], str) else "")
        desc = info[0] if isinstance(info[0], str) else ""
    except Exception:                                        # noqa: BLE001
        return ""
    return "\n".join(x.strip() for x in (title, desc) if x and x.strip())


def google_form_target(page_html: str) -> str:
    """Адреса самої форми в проміжній сторінці forms.gle або порожньо.

    З GitHub Actions forms.gle відповідає 200 зі сторінкою-переходом, а не
    редиректом, як із Мака (27.10.2026) — тоді опису в ній немає, і форму
    треба відкрити за адресою docs.google.com/forms зі сторінки."""
    m = re.search(r"https://docs\.google\.com/forms/d/e/[A-Za-z0-9_-]+/viewform[^\"'<>\s]*",
                  _html.unescape(page_html or ""))
    return m.group(0) if m else ""


def form_is_source(text: str) -> bool:
    """Чи опису форми досить, щоб вона була джерелом, а не лише подачею."""
    return len((text or "").strip()) >= FORM_MIN_TEXT


def strip_tracking(url: str) -> str:
    """Чиста адреса: без HTML-екранування й без рекламних хвостів.

    `&amp;` у href — не дрібниця: посилання skvot.io з допису @Mozhlyvosti
    приходило як «…?utm_source=tg&amp;utm_term=…», і сторінка просто не
    відкривалась. Спершу розекрановуємо, потім зрізаємо utm — та сама
    сторінка не має ставати двома записами через мітку кампанії.
    """
    clean = _html.unescape(url or "")
    return re.sub(r"[?&](utm_[^=]+|fbclid|gclid)=[^&]*", "", clean).rstrip("?&")


def external_links(links) -> list[str]:
    """Посилання з допису, придатні як адреса джерела, у порядку появи.

    Чиста функція — під тести. Відкидає соцмережі, службові адреси ботів,
    форми подачі, якорі й не-http.
    """
    out, seen = [], set()
    for raw in links or []:
        url = strip_tracking((raw or "").strip())
        if not url.startswith(("http://", "https://")):
            continue
        if url in seen or _is(url, _SOCIAL_HOSTS) or _is(url, _TECH_HOSTS) or is_form(url):
            continue
        seen.add(url)
        out.append(url)
    return out


def pick(links, skip_hosts: tuple = (), allow_forms: bool = False) -> str | None:
    """Куди йти за першоджерелом: перша звичайна сторінка, інакше нікуди.

    `skip_hosts` — домени, які вже пройдено: інакше сторінка-переказ вела б
    сама на себе (на znayshov.com кожна стаття має десяток внутрішніх посилань).
    `allow_forms` — за браком звичайної сторінки повернути Google-форму: її
    опис перевіряє той, хто читає сторінку (form_is_source).
    """
    pages = [u for u in external_links(links)
             if not _is(u, _MEDIA_HOSTS) and not _is(u, tuple(skip_hosts)) and not _is_file(u)]
    if pages:
        return pages[0]
    if allow_forms:
        for raw in links or []:
            url = strip_tracking((raw or "").strip())
            if url.startswith(("http://", "https://")) and is_google_form(url):
                return url
    return None


# Сторінка-переказ підписує, звідки взяла матеріал. Це і є ознака, що ми ще
# не на першоджерелі: znayshov.com підписує «Джерело: НУШ», НУШ — своє.
_RETELLING = re.compile(r"джерел[оа]\s*:|источник\s*:|\bsource\s*:|оригінал\s*:", re.I)

# Скільки разів дозволено піти глибше від сторінки, на яку привів допис.
# Двох досить: реальний ланцюг допису @novashkola — канал → znayshov (переказ)
# → childrenkinofest (організатор). Більше — і ми починаємо блукати по
# посиланнях у підвалі сайту.
MAX_HOPS = 2


def is_retelling(page_text: str) -> bool:
    """Чи ця сторінка сама переказує чужу публікацію."""
    return bool(_RETELLING.search(page_text or ""))


def deeper_link(page_text: str, links, visited_hosts: tuple) -> str | None:
    """Наступний крок ланцюга, якщо сторінка — переказ.

    Беремо НЕ посилання під написом «Джерело»: на znayshov.com воно веде на
    НУШ, тобто на ще один переказ. Беремо те саме, що й з допису — першу
    звичайну сторінку чужого домену: у статті про відеокурс це
    childrenkinofest.com, сайт організатора, який стоїть у тексті двічі.
    """
    if not is_retelling(page_text):
        return None
    return pick(links, skip_hosts=visited_hosts)


def host_of(url: str) -> str:
    return _host(url)


def usable_destination(final_url: str, allow_form: bool = False) -> bool:
    """Куди ми зрештою прийшли — перевірка ПІСЛЯ редиректів.

    Скорочувач (clipr.cc, bit.ly) веде куди завгодно: часом на сайт, часом на
    ту саму форму чи в інстаграм. Тому адресу з відповіді звіряємо ще раз.
    """
    if allow_form and is_google_form(final_url):
        return True
    return not (_is(final_url, _SOCIAL_HOSTS) or _is(final_url, _TECH_HOSTS)
                or is_form(final_url))


def looks_like_page(text: str) -> bool:
    """Чи завантажене справді сторінка з текстом, а не заглушка.

    200 знаків — та сама межа, що у плановій перевірці (recheck_dates):
    нижче неї сторінка порожня або нас зустріла капча.
    """
    return bool(text) and len(text) >= 200


def mentioned_links(links, skip_hosts: tuple = (), limit: int = 3) -> list[str]:
    """Адреси зі сторінки, які варто показати моделі окремим рядком.

    Текст сторінки не містить URL — вони живуть у href. Через це модель не
    бачила ні форми подачі, ні сайту організатора: на сторінці про відеокурс
    childrenkinofest.com згадано двічі, але тільки посиланням. Форми тут
    ПОТРІБНІ (це й є apply_url), тож фільтруємо лише соцмережі та службове.
    """
    out = []
    for raw in links or []:
        url = strip_tracking((raw or "").strip())
        if not url.startswith(("http://", "https://")):
            continue
        if _is(url, _SOCIAL_HOSTS) or _is(url, _TECH_HOSTS) or _is(url, tuple(skip_hosts)):
            continue
        if url not in out:
            out.append(url)
        if len(out) >= limit:
            break
    return out


def merge_text(post_text: str, page_text: str, page_url: str,
               links: list | None = None) -> str:
    """Текст для екстракції: сторінка джерела + допис, який її знайшов.

    Допис лишаємо, бо в ньому інколи є те, чого на сторінці немає (дата
    публікації каналу, уточнення). Але першим іде текст сторінки: саме з ним
    звіряються цитати, і саме він має бути «текстом джерела».
    """
    page = (page_text or "").strip()
    post = (post_text or "").strip()
    if not page:
        return post
    tail = f"{page}\n\n— — —\nЗ допису, який привів на цю сторінку ({page_url}):\n{post}"
    if links:
        tail += "\nПосилання зі сторінки: " + ", ".join(links)
    return tail
