"""Перевірка живості лінка перед ПЕРШОЮ публікацією запису (Фаза 3).

Закриває стару діру: Python-пайплайн публікував записи без жодної перевірки
URL — усе, що витягнув Haiku, одразу йшло в каталог. Тепер новий запис із
мертвим лінком не публікується (сирець позначається rejected із причиною).

Семантика збігається зі scripts/verify-links.mjs: 403/429 = живий
(бот-захист, не мертвий лінк); 404/410/мережевий збій = мертвий. Уже
опубліковані записи щодня переперевіряє verify-links — тут лише вхідні ворота.
"""
import logging

import httpx

logger = logging.getLogger(__name__)

TIMEOUT = 10.0
UA = "Mozilla/5.0 (compatible; DityamLinkCheck/1.0; +https://dityam.com.ua)"


def is_alive(url: str) -> tuple[bool, str]:
    """→ (alive, reason). Помилки на нашому боці трактуються на користь
    запису: сумнівний лінк доб'є щоденний verify-links, а от втратити
    справжню можливість через таймаут — гірше."""
    if not url or not url.startswith("http"):
        return False, "no url"
    headers = {"User-Agent": UA, "Accept-Language": "uk,en;q=0.8"}
    try:
        with httpx.Client(timeout=TIMEOUT, follow_redirects=True,
                          headers=headers) as client:
            try:
                r = client.head(url)
                if r.status_code in (403, 405, 501) or r.status_code >= 500:
                    r = client.get(url)
            except httpx.HTTPError:
                r = client.get(url)
        if r.status_code in (403, 429):
            return True, f"bot-protected {r.status_code}"
        if r.status_code in (404, 410):
            return False, f"http {r.status_code}"
        if r.status_code >= 400:
            return False, f"http {r.status_code}"
        return True, f"http {r.status_code}"
    except httpx.HTTPError as e:
        return False, f"network: {type(e).__name__}"
    except Exception as e:  # ніколи не валимо конвеєр через перевірку лінка
        logger.warning("link check error for %s: %s", url, e)
        return True, "check error — пропущено"
