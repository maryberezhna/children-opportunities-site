"""LLM-суддя неточних дублів (Фаза 3 конвеєра).

Кандидатів дає find_dup_candidates() у Postgres (pg_trgm по назвах, поріг
свідомо низький). Суддя дивиться на обидва записи цілком — назву, опис, тип,
дедлайн, джерело, URL — і вирішує: та сама це можливість чи різні.

Чому не поріг схожості: виміряно (див. normalizer.py), що справжні дублі
дають 0.32–0.87, а різні можливості 0.42–0.94 — діапазони перекриваються,
жоден поріг не розділяє. «Олімпіада з біології» vs «з екології» — 0.94 і це
РІЗНЕ. Тому тригram лише збирає підозрілих, а рішення — за моделлю.

Кожна пара судиться РІВНО ОДИН РАЗ: вердикт (duplicate/distinct) лягає в
dedup_judgments, і наступні запуски цю пару більше не оплачують.

Дубль зливається як у Фазі 1: лишається запис із verified_at (або старший),
дубль отримує status='closed' і canonical_slug оригіналу — сторінка 301-ить,
SEO-сигнали склеюються.
"""
import logging
import os

import anthropic

logger = logging.getLogger(__name__)

MODEL = os.environ.get("DEDUP_JUDGE_MODEL", "claude-haiku-4-5-20251001")
MAX_PAIRS_PER_RUN = int(os.environ.get("DEDUP_MAX_PAIRS", "30"))

JUDGE_TOOL = {
    "name": "judge_pair",
    "description": "Вердикт: чи це та сама можливість",
    "input_schema": {
        "type": "object",
        "properties": {
            "verdict": {
                "type": "string",
                "enum": ["duplicate", "distinct"],
                "description": "duplicate — ТА САМА можливість (той самий "
                               "організатор і та сама програма/подія, хай і "
                               "описана різними словами чи з різних джерел). "
                               "distinct — різні можливості, навіть якщо схожі "
                               "(різні предмети олімпіад, різні зміни таборів, "
                               "різні міста, різні роки набору).",
            },
        },
        "required": ["verdict"],
    },
}

FIELDS = "id, slug, title, summary, opportunity_type, deadline, source, source_url, verified_at, created_at"


def _fmt(rec: dict) -> str:
    return (f"Назва: {rec.get('title')}\n"
            f"Опис: {(rec.get('summary') or '')[:400]}\n"
            f"Тип: {rec.get('opportunity_type')} · Дедлайн: {rec.get('deadline') or '—'}\n"
            f"Джерело: {rec.get('source')} · URL: {rec.get('source_url')}")


def _judge(client: anthropic.Anthropic, a: dict, b: dict) -> str:
    msg = (f"Запис А:\n{_fmt(a)}\n\nЗапис Б:\n{_fmt(b)}\n\n"
           "Це та сама можливість для дитини чи різні? Відповідай через judge_pair.")
    response = client.messages.create(
        model=MODEL,
        max_tokens=100,
        system="Ти порівнюєш записи каталогу дитячих можливостей і вирішуєш, "
               "чи це дублікати. Будь обережним: сумнів → distinct (краще "
               "лишити два записи, ніж злити різні можливості).",
        tools=[JUDGE_TOOL],
        tool_choice={"type": "tool", "name": "judge_pair"},
        messages=[{"role": "user", "content": msg}],
    )
    tool_use = next((blk for blk in response.content if blk.type == "tool_use"), None)
    return (tool_use.input.get("verdict") if tool_use else None) or "distinct"


def _pick_keeper(a: dict, b: dict) -> tuple:
    """Переможець: перевірений модератором, інакше старший."""
    def key(r):
        return (r.get("verified_at") is None, r.get("created_at") or "")
    return (a, b) if key(a) <= key(b) else (b, a)


def run_sweep(sb_client, max_pairs: int = MAX_PAIRS_PER_RUN) -> dict:
    """Один прохід судді. Повертає статистику; ніколи не кидає виняток —
    дедуплікація не сміє завалити нічний скрап."""
    stats = {"candidates": 0, "merged": 0, "distinct": 0, "errors": 0}
    try:
        llm = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
        pairs = (sb_client.rpc("find_dup_candidates",
                               {"sim_threshold": 0.35, "max_pairs": max_pairs})
                 .execute().data or [])
        stats["candidates"] = len(pairs)
        if not pairs:
            return stats

        for pair in pairs:
            try:
                rec = {}
                for key_name, rec_id in (("a", pair["id_a"]), ("b", pair["id_b"])):
                    rows = (sb_client.table("opportunities").select(FIELDS)
                            .eq("id", rec_id).limit(1).execute().data)
                    rec[key_name] = rows[0] if rows else None
                if not rec["a"] or not rec["b"]:
                    continue

                verdict = _judge(llm, rec["a"], rec["b"])

                if verdict == "duplicate":
                    keeper, loser = _pick_keeper(rec["a"], rec["b"])
                    (sb_client.table("opportunities").update({
                        "status": "closed",
                        "canonical_slug": keeper["slug"],
                        "dup_of": keeper["slug"],
                        "dup_score": pair.get("sim"),
                        "admin_comment": ("auto: неточний дубль (LLM-суддя), "
                                          f"оригінал {keeper['slug']}"),
                    }).eq("id", loser["id"]).execute())
                    stats["merged"] += 1
                    logger.info("  🔗 дубль: «%s» → %s",
                                loser["title"][:50], keeper["slug"])
                else:
                    stats["distinct"] += 1

                sb_client.table("dedup_judgments").insert({
                    "id_a": pair["id_a"], "id_b": pair["id_b"],
                    "verdict": verdict, "sim": pair.get("sim"),
                }).execute()
            except Exception as e:
                stats["errors"] += 1
                logger.error("  dedup pair failed: %s", e)
                if stats["errors"] >= 3:
                    break
    except Exception as e:
        logger.error("dedup sweep failed entirely: %s", e)
    return stats
