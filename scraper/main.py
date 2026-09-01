"""main.py — запуск скраперів для dityam.com.ua

Запуск:
    python main.py                       # усі скрапери
    python main.py --only man            # тільки один (підрядок у назві)
    python main.py --skip unicef,erasmus # всі крім цих
    python main.py --ukrainian           # тільки українські
    python main.py --thematic            # тільки тематичні
    python main.py --diaspora            # тільки діаспорні (закордон)
"""
import argparse
import asyncio
import os
import sys
import time
from datetime import datetime, timedelta, timezone

import dedup_judge
import hubs
import link_check
import notifier
import raw_store
import ttl_requeue
from db import (due_at, find_active_by_canonical, get_client, get_health_stats,
                get_new_today, get_source_configs, get_source_registry,
                record_crawl_result, upsert_opportunity)
from normalizer import Normalizer, NormalizeError
from scrapers import (
    acmodasi,
    american_councils,
    british_council,
    cprs_kyiv,
    diaspora_schools,
    diia_osvita,
    easy_gov,
    erasmus,
    eurodesk,
    facebook_pages,
    firstpalace_kharkiv,
    gordiy_zp,
    gurtok,
    ocnttum_if,
    palats_dp,
    presidentfund,
    pum_lutsk,
    house_of_europe,
    instagram_graph,
    man_contests,
    mon_olympiads,
    prometheus,
    rss_feeds,
    save_the_children,
    shkolyar,
    space_dobrodiy,
    telegram_web,
    unicef,
)

SCRAPERS = [
    # Українські джерела
    ("MAN", man_contests, "ukrainian"),
    ("Prometheus", prometheus, "ukrainian"),
    ("МОН олімпіади", mon_olympiads, "ukrainian"),
    ("Дія.Освіта", diia_osvita, "ukrainian"),
    ("easy.gov.ua", easy_gov, "ukrainian"),
    ("Erasmus+ UA", erasmus, "ukrainian"),
    ("House of Europe", house_of_europe, "ukrainian"),
    ("Місце Сили (Клуб Добродіїв)", space_dobrodiy, "ukrainian"),
    ("RSS-стрічки", rss_feeds, "ukrainian"),
    # Дефіцитні категорії (рішення Марії 01.09: гуртки стоп, шукаємо складне —
    # стипендії, гранти, обміни). Обидва — першоджерела зі стандартним
    # запобіжником свіжості.
    ("Фонд Президента України (presidentfund.gov.ua)", presidentfund, "ukrainian"),
    ("American Councils Ukraine (americancouncils.org.ua)", american_councils, "ukrainian"),
    # Переліки гуртків. Найслабша наша категорія: постійний набір поруч
    # із домом — саме те, що шукає батько на початку навчального року.
    # Це агрегатори, не першоджерела, тож у sources їм ставимо trust_tier=3.
    ("Гурток (gurtok.org)", gurtok, "ukrainian"),
    ("Школяр (shkolyar.org.ua)", shkolyar, "ukrainian"),
    ("ЦПР Святошинського району (cprs.kiev.ua)", cprs_kyiv, "ukrainian"),
    # Палаци творчості — ПЕРШОДЖЕРЕЛА (комунальні заклади зі сторінкою на
    # кожен гурток), на відміну від агрегаторів вище. Обидва зі вбудованим
    # запобіжником свіжості: сайт без згадок поточного/минулого року не
    # скрапиться, а попереджає в лог (урок 01.09.2026 — застаріле джерело
    # гірше за порожнє місто).
    ("Харківський обласний ПДЮТ (firstpalace.kh.ua)", firstpalace_kharkiv, "ukrainian"),
    ("Запорізький міський ПДЮТ (gordiy.zp.ua)", gordiy_zp, "ukrainian"),
    ("Івано-Франківський ОДЦНТТУМ (ocnttum.if.ua)", ocnttum_if, "ukrainian"),
    ("Палац учнівської молоді Луцька (pum-lutsk.org)", pum_lutsk, "ukrainian"),
    ("Палац творчості дітей та юнацтва Дніпра (palats.dp.ua)", palats_dp, "ukrainian"),
    # Діаспора — українські родини за кордоном
    ("Освітній Всесвіт (МІОК)", diaspora_schools, "diaspora"),
    # Тематичні / міжнародні
    ("UNICEF", unicef, "thematic"),
    # Потребує браузера: сайт малюється на клієнті (див. модуль).
    ("Eurodesk", eurodesk, "thematic"),
    ("Save the Children", save_the_children, "thematic"),
    ("British Council", british_council, "thematic"),
    # Соціальні мережі
    ("ACMODASI", acmodasi, "ukrainian"),             # кастинги/набори для дітей
    ("Telegram (веб)", telegram_web, "social"),      # без API-ключів (t.me/s/)
    ("Instagram", instagram_graph, "social"),
    ("Facebook", facebook_pages, "social"),
]


# No single async scraper may hang the pipeline (protects the end-of-run email).
# NB: only interrupts at await points — sync-blocking scrapers must fail fast
# on their own.
SCRAPER_TIMEOUT = 300  # seconds


async def run_scraper(name, module, sb_client):
    """Етап А: лише видобування. Знахідки лягають у raw_items (хеш-гейт:
    уже бачений вміст не дублюється), LLM тут не викликається — екстракція
    йде окремим етапом по спільній черзі."""
    print(f"\n{'=' * 70}\n▶️  {name}\n{'=' * 70}")
    start = time.time()
    try:
        raw_items = await asyncio.wait_for(module.fetch_all(), timeout=SCRAPER_TIMEOUT)
    except asyncio.TimeoutError:
        record_crawl_result(sb_client, name, ok=False, new_items=0)
        return {"name": name, "status": "error",
                "error": f"timeout >{SCRAPER_TIMEOUT}s", "count": 0,
                "duration": time.time() - start}
    except Exception as e:
        record_crawl_result(sb_client, name, ok=False, new_items=0)
        return {"name": name, "status": "error",
                "error": f"{type(e).__name__}: {e}"[:200],
                "count": 0, "duration": time.time() - start}

    if not raw_items:
        record_crawl_result(sb_client, name, ok=True, new_items=0)
        return {"name": name, "status": "empty", "count": 0,
                "duration": time.time() - start}

    new_raw = raw_store.store_raw_items(sb_client, name, raw_items)
    record_crawl_result(sb_client, name, ok=True, new_items=new_raw)

    duration = time.time() - start
    print(f"✅ {name}: {new_raw} нових із {len(raw_items)} знайдених за {duration:.1f}с")
    return {"name": name, "status": "success", "count": new_raw,
            "total_found": len(raw_items), "duration": duration}


def _fresh_duplicate(sb_client, item):
    """Чи веде цей сирець на можливість, яка вже є в базі і ще не протухла.

    Повертає рядок можливості (пропускаємо екстракцію) або None (екстрагуємо).
    Свіжість міряємо тим самим TTL, що й переверифікація, — щоб ворота ніколи
    не з'їли запис, який саме прийшов на плановий перегляд.
    """
    canonical = (item.get("canonical_url") or "").strip()
    if not canonical or hubs.is_hub(canonical):
        return None
    existing = find_active_by_canonical(sb_client, canonical)
    if not existing:
        return None
    ttl = ttl_requeue.TTL_DAYS.get(existing.get("opportunity_type"),
                                   ttl_requeue.DEFAULT_TTL)
    updated = existing.get("updated_at") or ""
    try:
        age = datetime.now(timezone.utc) - datetime.fromisoformat(
            updated.replace("Z", "+00:00"))
    except ValueError:
        return None  # незрозуміла дата — краще екстрагувати, ніж загубити
    return existing if age <= timedelta(days=ttl) else None


# Скільки часу відводимо на екстракцію. Черга живе в базі й нікуди не
# дінеться, тож зупинитися самим краще, ніж бути вбитим по таймауту job'а:
# 30.08 прогін помер посеред екстракції, і разом із ним пропали і підсумок,
# і звіт у чат — ми навіть не знали, скільки записів устигло обробитись.
EXTRACT_BUDGET_SEC = int(os.environ.get("EXTRACT_BUDGET_SEC", "2100"))


def process_pending(normalizer, sb_client, limit=500):
    """Етап Б: LLM-екстракція спільної черги raw_items — включно з сирцем,
    що лишився з минулих запусків після збоїв. 5 послідовних збоїв API —
    зупиняємось: черга нікуди не дінеться, а спроби палити нема сенсу.
    Так само зупиняємось, коли вичерпано бюджет часу."""
    queue = raw_store.fetch_pending(sb_client, limit=limit)
    # Налаштування джерел читаємо один раз на прогін, не на кожен запис.
    source_configs = get_source_configs(sb_client)

    stats = {"queued": len(queue), "processed": 0, "rejected": 0,
             "retry": 0, "failed": 0, "closed": 0, "drafts": 0, "skipped_dup": 0,
             "out_of_time": 0}
    if not queue:
        return stats

    print(f"\n{'=' * 70}\n🧠 ЕКСТРАКЦІЯ: {len(queue)} у черзі "
          f"(бюджет {EXTRACT_BUDGET_SEC // 60} хв)\n{'=' * 70}")
    consecutive_errors = 0
    started = time.time()
    for idx, item in enumerate(queue):
        spent = time.time() - started
        if spent > EXTRACT_BUDGET_SEC:
            stats["out_of_time"] = len(queue) - idx
            print(f"⏱  Бюджет вичерпано за {spent / 60:.1f} хв — зупиняюсь. "
                  f"{stats['out_of_time']} записів лишились у черзі "
                  f"до наступного запуску.")
            break
        # ── Ворота перед LLM ────────────────────────────────────────────
        # Дедуплікація донедавна стояла ПІСЛЯ екстракції: Haiku відпрацьовував,
        # і аж тоді ставало ясно, що така можливість уже в базі. Токени за
        # такий сирець уже сплачені. Тепер перевіряємо до виклику — за
        # canonical_url, який скрапер порахував ще на етапі складання черги.
        #
        # Кого НЕ пропускаємо повз екстракцію:
        #   • хаби — там на одному URL багато різних можливостей;
        #   • записи, яким настав TTL: повторна екстракція і є той механізм,
        #     що ловить «набір завершено» на сторінках без дедлайну. Такий
        #     запис уже прострочив свій TTL, тож умова свіжості його не ловить.
        #   • сезонні перевірки: вони стосуються записів зі статусом closed,
        #     а шукаємо ми лише active.
        dup = _fresh_duplicate(sb_client, item)
        if dup:
            raw_store.mark(sb_client, item["id"], "rejected",
                           error=f"duplicate: вже є {dup['id']}",
                           opportunity_id=dup["id"])
            stats["skipped_dup"] += 1
            continue

        try:
            normalized = normalizer.normalize(
                raw_text=item.get("raw_text", ""),
                source=item.get("source_name", ""),
                source_url=item.get("source_url") or "",
                raw_title=item.get("raw_title"),
            )
            consecutive_errors = 0
        except NormalizeError as e:
            raw_store.bump_attempt(sb_client, item, str(e))
            attempts = (item.get("attempts") or 0) + 1
            stats["failed" if attempts >= raw_store.MAX_ATTEMPTS else "retry"] += 1
            consecutive_errors += 1
            if consecutive_errors >= 5:
                print("🛑 5 збоїв API поспіль — зупиняю екстракцію, "
                      "решта черги дочекається наступного запуску")
                break
            continue

        if not normalized:
            # Причину бере з нормалізатора: без неї відхилення непрозорі —
            # неможливо ні довести, що фільтр працює, ні побачити, коли він
            # почне різати живе.
            reason = getattr(normalizer, "last_reject_reason", None)
            raw_store.mark(sb_client, item["id"], "rejected",
                           error=reason or "відхилено екстракцією (причина не вказана)")
            stats["rejected"] += 1
            continue

        # Вхідні ворота для НОВИХ записів: мертвий лінк не публікується.
        # Наявні записи не чіпаємо — їх щодня переперевіряє verify-links.
        existing = (
            sb_client.table("opportunities").select("id")
            .eq("content_hash", normalized.get("content_hash", "")).limit(1)
            .execute().data
        )
        if not existing:
            alive, reason = link_check.is_alive(normalized.get("source_url", ""))
            if not alive:
                raw_store.mark(sb_client, item["id"], "rejected",
                               error=f"dead link: {reason}")
                stats["rejected"] += 1
                print(f"  🔗✗ мертвий лінк ({reason}): "
                      f"{normalized.get('source_url', '')[:80]}")
                continue

        # Місто з налаштувань джерела. У фізично прив'язаних джерел воно
        # завжди те саме (простір у Києві, центр у Житомирі), але модель його
        # регулярно не витягує: у «Місця Сили» 15 записів із 15 приїхали без
        # міста, хоч у тексті стоїть «Київ». Місто — головний фільтр на сайті,
        # тож без нього запис для людини з іншого міста просто не існує.
        # Онлайн не чіпаємо: там відсутність міста і є правильна відповідь.
        if not normalized.get("cities"):
            fmt = (normalized.get("format") or "").lower()
            is_online = "онлайн" in fmt or "online" in fmt or "дистанц" in fmt
            if is_online:
                # «Онлайн» — теж відповідь на питання «де», і сайт уміє її
                # читати: фільтр міст розпізнає «Онлайн» у cities. Без цього
                # онлайн-можливості випадали з фільтра зовсім — людина, яка
                # обрала своє місто, їх не бачила, хоч вони доступні звідусіль.
                normalized["cities"] = ["Онлайн"]
            else:
                default_city = (source_configs.get(item.get("source_name")) or {}).get("default_city")
                if default_city:
                    normalized["cities"] = [default_city]

        saved = upsert_opportunity(sb_client, normalized)
        if saved:
            raw_store.mark(sb_client, item["id"], "processed",
                           opportunity_id=saved.get("id"))
            stats["processed"] += 1
            if normalized.get("status") == "closed":
                stats["closed"] += 1
            elif normalized.get("status") == "draft":
                stats["drafts"] += 1
        else:
            raw_store.bump_attempt(sb_client, item, "upsert failed")
            stats["retry"] += 1

    if stats.get("out_of_time"):
        print(f"↩️  Не дійшла черга до {stats['out_of_time']} записів — вони pending.")
    print(f"✅ Екстракція: {stats['processed']} збережено "
          f"({stats['closed']} закритих за текстом, {stats['drafts']} чернеток), "
          f"{stats['skipped_dup']} пропущено до LLM (вже є), "
          f"{stats['rejected']} відхилено, {stats['retry']} на повтор, "
          f"{stats['failed']} вичерпали спроби")
    return stats


def print_summary(results, stats):
    print(f"\n\n{'=' * 70}\n📊 ФІНАЛЬНИЙ ЗВІТ\n{'=' * 70}")
    success = [r for r in results if r["status"] == "success"]
    errors = [r for r in results if r["status"] == "error"]
    empty = [r for r in results if r["status"] == "empty"]
    disabled = [r for r in results if r["status"] == "disabled"]
    total_new = sum(r.get("count", 0) for r in results)
    total_time = sum(r.get("duration", 0) for r in results)

    print(f"✅ Успішно: {len(success)}/{len(results)}")
    print(f"⚠️  Порожні:  {len(empty)}")
    print(f"⏸  Вимкнені в реєстрі: {len(disabled)}")
    print(f"❌ Помилки: {len(errors)}")
    print(f"🆕 Нового сирцю: {total_new}")
    print(f"🧠 Екстракція: {stats.get('processed', 0)} збережено, "
          f"{stats.get('rejected', 0)} відхилено, {stats.get('retry', 0)} на повтор")
    print(f"⏱️  Загальний час: {total_time:.1f}с ({total_time / 60:.1f} хв)\n")

    for r in results:
        icon = {"success": "✅", "error": "❌", "empty": "⚠️ ",
                "disabled": "⏸ ", "scheduled": "⏭ "}[r["status"]]
        print(f"  {icon} {r['name']:25s} {r.get('count', 0):3d} нових  "
              f"{r.get('duration', 0):5.1f}s")

    if errors:
        print("\n❌ Помилки детально:")
        for r in errors:
            print(f"  • {r['name']}: {r.get('error', 'Unknown')}")


def parse_args():
    p = argparse.ArgumentParser(description="Скрапери dityam.com.ua")
    p.add_argument("--only", help="Підрядок у назві скрапера")
    p.add_argument("--skip", help="Через кому, які пропустити")
    p.add_argument("--ukrainian", action="store_true")
    p.add_argument("--thematic", action="store_true")
    p.add_argument("--social", action="store_true",
                   help="Тільки соцмережі (Telegram, Instagram, Facebook)")
    p.add_argument("--diaspora", action="store_true",
                   help="Тільки діаспорні джерела (українські родини за кордоном)")
    return p.parse_args()


def filter_scrapers(scrapers, args):
    out = scrapers
    if args.only:
        needle = args.only.lower()
        out = [s for s in out if needle in s[0].lower()]
        if not out:
            print(f"❌ Не знайдено '{args.only}'. Доступні: "
                  f"{[s[0] for s in scrapers]}")
            sys.exit(1)
    if args.skip:
        skip = [s.strip().lower() for s in args.skip.split(",")]
        out = [s for s in out
               if not any(n in s[0].lower() for n in skip)]
    if args.ukrainian:
        out = [s for s in out if s[2] == "ukrainian"]
    elif args.thematic:
        out = [s for s in out if s[2] == "thematic"]
    elif args.social:
        out = [s for s in out if s[2] == "social"]
    elif args.diaspora:
        out = [s for s in out if s[2] == "diaspora"]
    return out


async def amain():
    args = parse_args()
    start = datetime.now()
    print(f"\n🕷️  DITYAM SCRAPERS\n📅 Старт: {start:%Y-%m-%d %H:%M:%S}")

    scrapers = filter_scrapers(SCRAPERS, args)
    print(f"🎯 Запуск {len(scrapers)} скраперів:")
    for name, _, tag in scrapers:
        print(f"  • {name} [{tag}]")

    normalizer = Normalizer()
    sb_client = get_client()
    hubs.prime(sb_client)  # єдине джерело правди — таблиця dedup_hub_urls

    # Реєстр джерел: вимкнене в sources (enabled=false) пропускається без
    # деплою. Якщо таблиці ще нема — реєстр порожній і все вважається
    # увімкненим (реєстр не сміє зупинити скрапінг власною недоступністю).
    registry = get_source_registry(sb_client, "python")

    from datetime import timezone as _tz

    results = []
    for name, module, tag in scrapers:
        reg_row = registry.get(name)
        if reg_row is not None and not reg_row.get("enabled", True):
            print(f"\n⏸  {name}: вимкнено в реєстрі джерел — пропускаю")
            results.append({"name": name, "status": "disabled", "count": 0,
                            "duration": 0, "tag": tag})
            continue
        # Адаптивний розклад: джерело ще не «дозріло» — пропускаємо (крім
        # явних запусків --only, де людина просить саме це джерело зараз).
        # Дату беремо через due_at: він перераховує її з множником ПОТОЧНОГО
        # місяця, інакше вересневе підсилення не діяло б на дати, поставлені
        # ще в серпні.
        if reg_row and not args.only:
            due = due_at(sb_client, reg_row)
            if due and due > datetime.now(_tz.utc):
                print(f"\n⏭  {name}: за розкладом наступний обхід "
                      f"{due:%d.%m %H:%M} — пропускаю")
                results.append({"name": name, "status": "scheduled",
                                "count": 0, "duration": 0, "tag": tag})
                continue
        result = await run_scraper(name, module, sb_client)
        result["tag"] = tag
        results.append(result)
        await asyncio.sleep(2)

    # TTL: старі записи без дедлайну — на переверифікацію (потрапляють у ту
    # саму чергу екстракції нижче, тож рішення про «закрито» приходить
    # цим же запуском).
    ttl_stats = {}
    if not args.only and not args.skip:
        ttl_stats = ttl_requeue.run(sb_client)

    # Етап Б: LLM-екстракція спільної черги (нове + недороблене з минулих днів).
    stats = process_pending(normalizer, sb_client)

    # Етап В: суддя неточних дублів (лише повні запуски — не --only/--skip).
    if not args.only and not args.skip:
        dd = dedup_judge.run_sweep(sb_client)
        if dd["candidates"]:
            print(f"\n🔍 Дедуплікація: {dd['candidates']} пар-кандидатів, "
                  f"злито {dd['merged']}, різних {dd['distinct']}, "
                  f"збоїв {dd['errors']}")

    # Expiry/archiving is handled by scripts/check-deadlines.mjs (its own daily cron).
    print_summary(results, stats)

    end = datetime.now()
    total = (end - start).total_seconds()
    print(f"\n🏁 Фініш: {end:%Y-%m-%d %H:%M:%S}")
    print(f"⏱️  Всього: {total:.1f}с ({total / 60:.1f} хв)")

    # health check + daily email (only on full runs, not --only / --skip)
    if not args.only and not args.skip:
        print("\n📊 Перевірка бази...")
        new_today = get_new_today(sb_client)
        health = get_health_stats(sb_client)
        print(f"   Нових сьогодні: {len(new_today)}")
        print(f"   Активних у базі: {health.get('total_active', 0)}")
        print(f"   Архівованих: {health.get('total_archived', 0)}")
        print(f"   Без дедлайну: {health.get('no_deadline', 0)}")
        # Кеш промпта нормалізатора: read має рости з другого виклику запуску.
        # Нуль read при сотнях викликів = кеш зламався (змінився префікс або
        # він став коротшим за мінімум моделі) — платимо повну ціну знову.
        total_in = (normalizer.cache_read_tokens + normalizer.cache_write_tokens
                    + normalizer.uncached_input_tokens)
        if total_in:
            hit = normalizer.cache_read_tokens * 100 // total_in
            print(f"   💾 Кеш промпта LLM: read {normalizer.cache_read_tokens:,} · "
                  f"write {normalizer.cache_write_tokens:,} · "
                  f"без кешу {normalizer.uncached_input_tokens:,} ({hit}% hit)")
        llm_alert = None
        if normalizer.api_failures:
            llm_alert = {
                "failures": normalizer.api_failures,
                "last_error": normalizer.last_api_error or "",
                "is_billing": "credit balance" in (normalizer.last_api_error or "").lower(),
            }
            print(f"   ⚠️ Помилок нормалізації (LLM): {normalizer.api_failures}")
        sent = notifier.send_daily_report(new_today, health, results,
                                          stats.get("closed", 0),
                                          llm_alert=llm_alert)
        # send_daily_report повертає канал ('telegram'/'email') або False —
        # старий підпис «Email ✅» брехав, коли звіт ішов у бот.
        channel = {'telegram': 'Telegram-бот', 'email': 'Email (запасний)'}.get(sent)
        print(f"📨 Звіт: {'надіслано у ' + channel + ' ✅' if channel else 'не надіслано ❌'}")
    if any(r["status"] == "error" for r in results):
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(amain())
