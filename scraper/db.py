"""Підключення до Supabase."""
import os
import logging
from typing import Optional
from supabase import create_client, Client

logger = logging.getLogger(__name__)


def get_client() -> Client:
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_KEY"]
    return create_client(url, key)


def upsert_opportunity(client: Client, data: dict) -> Optional[dict]:
    from datetime import datetime, timezone
    # Always stamp updated_at so get_processed_today() can find today's activity.
    # created_at is NOT included here — Supabase keeps the original value on conflict.
    now = datetime.now(timezone.utc).isoformat()
    record = {**data, "updated_at": now}
    try:
        content_hash = record.get("content_hash")
        if content_hash:
            existing = (
                client.table("opportunities")
                .select("id, verified_at")
                .eq("content_hash", content_hash)
                .limit(1)
                .execute()
            )
            if existing.data and existing.data[0].get("verified_at"):
                # A moderator has reviewed (and possibly hand-edited) this record.
                # Only bump updated_at as a "source still publishes this" signal —
                # a full upsert would clobber their edits with re-extracted text.
                result = (
                    client.table("opportunities")
                    .update({"updated_at": now})
                    .eq("id", existing.data[0]["id"])
                    .execute()
                )
                return result.data[0] if result.data else None
        result = client.table("opportunities").upsert(
            record,
            on_conflict="content_hash"
        ).execute()
        return result.data[0] if result.data else None
    except Exception as e:
        logger.error(f"Supabase upsert failed: {e}")
        return None


def get_new_today(client: Client) -> list[dict]:
    """Return all opportunities processed (inserted or updated) today (UTC).

    Uses updated_at rather than created_at so that recurring upserts of
    existing records (e.g. daily MAN contests refresh) are included.
    """
    from datetime import datetime, timezone
    today = datetime.now(timezone.utc).date().isoformat()
    try:
        result = (
            client.table("opportunities")
            .select("title, source, source_url, opportunity_type, age_from, age_to, deadline, cost_type")
            .gte("updated_at", today)
            .eq("status", "active")
            .order("source")
            .execute()
        )
        return result.data or []
    except Exception as e:
        logger.error(f"get_new_today failed: {e}")
        return []


# A missing deadline is only a real gap for one-off, time-bound opportunities.
# Two groups legitimately lack one and are excluded from the health metric:
#   • ongoing/rolling — courses, clubs, state payments (no deadline ever)
#   • annual/recurring — olympiads, competitions, camps… shown as «щорічно»
#     on the site; the next cycle's date missing isn't a data defect.
ONGOING_TYPES = [
    "course", "club", "allowance", "humanitarian", "medical_aid", "volunteer",
    "psychology", "rehabilitation", "mentorship", "shelter", "educational_material",
    "olympiad", "competition", "exchange", "scholarship", "festival", "camp",
    "grant", "study_abroad",
]


def get_health_stats(client: Client) -> dict:
    """Return aggregate health statistics for the opportunities table.

    `no_deadline` counts only deadline-bearing types (competitions, olympiads,
    grants, camps…) missing a deadline. Ongoing types (courses, clubs, state
    payments) are excluded — they legitimately have no deadline, so counting
    them just inflated the number and cried wolf.
    """
    try:
        active = client.table("opportunities").select("id", count="exact").eq("status", "active").execute()
        # The status CHECK constraint allows active|closed|draft — expired records
        # are marked 'closed' by scripts/check-deadlines.mjs ('archived' doesn't exist).
        archived = client.table("opportunities").select("id", count="exact").eq("status", "closed").execute()
        deadline_bearing = (
            client.table("opportunities")
            .select("id", count="exact")
            .eq("status", "active")
            .not_.in_("opportunity_type", ONGOING_TYPES)
            .execute()
        )
        no_dl = (
            client.table("opportunities")
            .select("id", count="exact")
            .eq("status", "active")
            .is_("deadline", "null")
            .not_.in_("opportunity_type", ONGOING_TYPES)
            .execute()
        )
        return {
            "total_active": active.count or 0,
            "total_archived": archived.count or 0,
            "no_deadline": no_dl.count or 0,
            "deadline_bearing": deadline_bearing.count or 0,
        }
    except Exception as e:
        logger.error(f"get_health_stats failed: {e}")
        return {"total_active": 0, "total_archived": 0, "no_deadline": 0, "deadline_bearing": 0}


# Expiry is owned solely by scripts/check-deadlines.mjs (daily cron): annual types
# get their stale deadline nulled, one-off types go to status='closed'. The old
# archive_expired() here wrote status='archived' — a value the CHECK constraint
# rejects — so it silently failed on every run and always reported 0.
