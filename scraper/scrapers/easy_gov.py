"""Скрапер easy.gov.ua — державний агрегатор можливостей для молоді.

Публічний REST API без авторизації: https://api.easy.gov.ua/api/opportunities
Фільтр: isPublished + status='Діюча' + ageRanges з minAge <= 17.
"""
import asyncio
import logging
from datetime import date, datetime, timezone

import httpx

logger = logging.getLogger(__name__)

SOURCE_NAME = "easy.gov.ua"
API_URL = "https://api.easy.gov.ua/api/opportunities"

_SKIP_DIRECTIONS = {"Ветерани", "Житло", "УНГІ"}
_SKIP_TYPES = {"Консультація"}

# Ключові слова в назві/описі, що вказують на програми для дорослих
_ADULT_KEYWORDS = [
    "учасник бойових", "ветеран", "безробіт", "ваучер на навчан",
    "підприємниц", "підприємець", "стартап",
    "кооперація в науці", "дослідник", "інноватор",
    "для жінок", "for women",
    "молодіжна робота",   # програми для молодіжних працівників (не для дітей)
    "активні парки",      # спортивні клуби для всіх вікових категорій
    "скандинавська ходьба", "бігові клуби",
    "адаптивний спорт",   # для осіб з інвалідністю (без вікового обмеження)
]

_TYPE_MAP = {
    "Грант": "grant",
    "Грант (бізнес)": "grant",
    "Фінансування проєкту": "grant",
    "Конкурс": "competition",
    "Стажування": "internship",
    "Стипендія": "scholarship",
    "Компенсація": "allowance",
    "Програма": "course",
    "Послуга (соціальна)": "humanitarian",
    "Послуга (інша)": "course",
    "Інше": "course",
    "Премія": "competition",
}


def _resolve_type(api_type: str, direction: str) -> str:
    if api_type == "Послуга (соціальна)":
        return {"Освіта": "course", "Соціальний": "allowance", "Спорт": "sport_tournament"}.get(direction, "humanitarian")
    if api_type == "Послуга (інша)" and direction == "Обміни":
        return "exchange"
    if api_type == "Інше":
        return {"Спорт": "sport_tournament", "Культура": "festival"}.get(direction, "course")
    return _TYPE_MAP.get(api_type, "course")


def _resolve_deadline(item: dict) -> str | None:
    raw = item.get("applicationSubmissionEndDate") or item.get("dateClose")
    if not raw:
        return None
    try:
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        if dt.date() < date.today():
            return None
        return dt.date().isoformat()
    except Exception:
        return None


async def fetch_all() -> list[dict]:
    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; dityam-scraper/1.0; +https://dityam.com.ua)",
        "Accept": "application/json",
    }

    all_items: list[dict] = []
    async with httpx.AsyncClient(headers=headers, timeout=30.0, follow_redirects=True) as client:
        page = 1
        while True:
            try:
                r = await client.get(API_URL, params={"limit": 100, "page": page})
                r.raise_for_status()
                payload = r.json()
                batch = payload.get("data") or []
                all_items.extend(batch)
                total_pages = (payload.get("meta") or {}).get("totalPages", 1)
                if page >= total_pages:
                    break
                page += 1
                await asyncio.sleep(0.5)
            except Exception as e:
                logger.warning(f"easy.gov.ua page {page} failed: {e}")
                break

    logger.info(f"easy.gov.ua: {len(all_items)} total from API")

    results = []
    for item in all_items:
        if not item.get("isPublished"):
            continue
        status_name = (item.get("status") or {}).get("name", "")
        if status_name != "Діюча":
            continue
        if item.get("gender") == "FEMALE":
            continue

        direction = (item.get("direction") or {}).get("name", "")
        type_name = (item.get("type") or {}).get("name", "")
        if direction in _SKIP_DIRECTIONS or type_name in _SKIP_TYPES:
            continue

        # Filter out adult-focused content by keywords in title + description
        title_check = (item.get("name") or "").lower()
        desc_check = (item.get("shortDescription") or "").lower()
        combined_check = title_check + " " + desc_check
        if any(kw in combined_check for kw in _ADULT_KEYWORDS):
            continue

        # Only youth-eligible age ranges — require at least one range where maxAge <= 21
        # (prevents "youth 14-35" programs that are really for adults)
        all_ranges = item.get("ageRanges") or []
        youth_ranges = [
            r for r in all_ranges
            if isinstance(r.get("minAge"), (int, float))
            and r["minAge"] <= 17
            and (r.get("maxAge") is None or r["maxAge"] <= 21)
        ]
        # Fallback: accept if minAge <= 14 even with wider range (school-age start)
        if not youth_ranges:
            youth_ranges = [
                r for r in all_ranges
                if isinstance(r.get("minAge"), (int, float)) and r["minAge"] <= 14
            ]
        if not youth_ranges:
            continue

        age_from = int(min(r["minAge"] for r in youth_ranges))
        age_to_raw = max(r.get("maxAge") or 17 for r in youth_ranges)
        age_to = 18 if age_to_raw > 17 else int(age_to_raw)

        url = item.get("descriptionLink") or item.get("applicationFormLink")
        if not url:
            continue

        title = (item.get("name") or "").strip()
        if not title:
            continue

        short_desc = (item.get("shortDescription") or "").strip()[:500]
        opp_type = _resolve_type(type_name, direction)
        deadline = _resolve_deadline(item)

        results.append({
            "source": SOURCE_NAME,
            "source_url": url,
            "raw_title": title,
            "raw_text": (
                f"Державна програма для молоді. Платформа easy.gov.ua.\n"
                f"Напрям: {direction}. Тип: {type_name}.\n\n{short_desc}"
            ),
        })

    logger.info(f"easy.gov.ua: {len(results)} youth-eligible opportunities")
    return results
