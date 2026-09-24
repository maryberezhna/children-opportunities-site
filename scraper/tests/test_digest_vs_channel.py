"""Платна добірка не переказує безкоштовний канал (25.09.2026).

Марія: «розвести за змістом — те, що вийшло в каналі, не показувати в
персональній добірці як нове, або показувати з поміткою». Обрано друге:
канал читають не всі, і пропустити доречну можливість гірше, ніж побачити її
вдруге. Тож опубліковане йде нижче й із позначкою.
"""
import os
import sys
import unittest
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import personal_digest as pd  # noqa: E402

SUB = {"id": "s1", "telegram_chat_id": 1, "age_bands": [], "interests": [],
       "cost_pref": None, "places": [], "region_pref": None}


def opp(slug, created, posted=None, **kw):
    o = {"id": slug, "slug": slug, "title": slug, "summary": "", "age_from": 0, "age_to": 18,
         "cost_type": "free", "created_at": created, "deadline": None,
         "event_start_date": None, "event_end_date": None, "timing_kind": "one_time",
         "timing_assumed": False, "opportunity_type": "course", "format": "online",
         "cities": [], "countries": None, "is_international": False, "child_needs": [],
         "categories": [], "telegram_posted_at": posted, "_themes": set(),
         "_created": datetime.fromisoformat(created)}
    o.update(kw)
    return o


class OrderAndLabel(unittest.TestCase):
    def test_unpublished_comes_first(self):
        # Обидва підходять; той, що вже був у каналі, іде нижче.
        opps = [opp("був-у-каналі", "2026-09-25T10:00:00+00:00", posted="2026-09-25T14:00:00+00:00"),
                opp("новий", "2026-09-24T10:00:00+00:00")]
        picked = pd.pick_for(SUB, opps, children=[{"age": 12, "interests": []}])
        self.assertEqual([o["slug"] for o in picked], ["новий", "був-у-каналі"])

    def test_newer_first_within_the_same_group(self):
        opps = [opp("старіший", "2026-09-20T10:00:00+00:00"),
                opp("свіжіший", "2026-09-24T10:00:00+00:00")]
        picked = pd.pick_for(SUB, opps, children=[{"age": 12, "interests": []}])
        self.assertEqual([o["slug"] for o in picked], ["свіжіший", "старіший"])

    def test_published_one_is_labelled(self):
        meta = pd._meta(opp("x", "2026-09-25T10:00:00+00:00", posted="2026-09-25T14:00:00+00:00"))
        self.assertIn("було в каналі", meta)

    def test_unpublished_one_has_no_label(self):
        self.assertNotIn("було в каналі", pd._meta(opp("x", "2026-09-25T10:00:00+00:00")))

    def test_published_is_not_dropped(self):
        # Канал читають не всі: викидати доречну можливість не можна.
        opps = [opp("був-у-каналі", "2026-09-25T10:00:00+00:00", posted="2026-09-25T14:00:00+00:00")]
        picked = pd.pick_for(SUB, opps, children=[{"age": 12, "interests": []}])
        self.assertEqual([o["slug"] for o in picked], ["був-у-каналі"])


if __name__ == "__main__":
    unittest.main()
