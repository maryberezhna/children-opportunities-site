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
# Форма подачі — НЕ джерело. Вона не описує можливість (Google Forms узагалі
# віддає порожню сторінку без JS), а її місце — поле apply_url, яке
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


def _host(url: str) -> str:
    try:
        return (urlparse(url).hostname or "").lower().removeprefix("www.")
    except ValueError:
        return ""


def _is(url: str, hosts: tuple) -> bool:
    host = _host(url)
    return any(host == h or host.endswith("." + h) for h in hosts)


def is_form(url: str) -> bool:
    """Форма подачі: її адреса належить apply_url, а не source_url."""
    if _is(url, _FORM_HOSTS):
        return True
    path = (urlparse(url).path or "").lower()
    return _is(url, ("docs.google.com",)) and any(p in path for p in _FORM_PATHS)


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


def pick(links, skip_hosts: tuple = ()) -> str | None:
    """Куди йти за першоджерелом: перша звичайна сторінка, інакше нікуди.

    `skip_hosts` — домени, які вже пройдено: інакше сторінка-переказ вела б
    сама на себе (на znayshov.com кожна стаття має десяток внутрішніх посилань).
    """
    pages = [u for u in external_links(links)
             if not _is(u, _MEDIA_HOSTS) and not _is(u, tuple(skip_hosts))]
    return pages[0] if pages else None


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


def usable_destination(final_url: str) -> bool:
    """Куди ми зрештою прийшли — перевірка ПІСЛЯ редиректів.

    Скорочувач (clipr.cc, bit.ly) веде куди завгодно: часом на сайт, часом на
    ту саму форму чи в інстаграм. Тому адресу з відповіді звіряємо ще раз.
    """
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
