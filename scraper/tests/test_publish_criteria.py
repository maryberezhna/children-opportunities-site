"""Python і JS читають lib/publish-criteria.json; приклади спільні з
tests/publish-criteria.test.mjs. Розійшлись — упаде хтось один."""
import json
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from normalizer import (  # noqa: E402
    PUBLISH_CRITERIA, REQUIRED_FIELDS, VALID_OPP_TYPES, PUBLISHABLE_COST_TYPES,
    PAYMENT_TYPES, missing_required, missing_required_keys,
)

_CASES = os.path.join(os.path.dirname(__file__), "..", "..", "tests", "fixtures",
                      "publish-criteria-cases.json")


class SharedCases(unittest.TestCase):

    def test_shared_cases_agree(self):
        with open(_CASES, encoding="utf-8") as f:
            cases = json.load(f)
        req = PUBLISH_CRITERIA["required"]
        for case in cases:
            with self.subTest(case["name"]):
                self.assertEqual(missing_required_keys(case["row"]), case["missing"])
                self.assertEqual(missing_required(case["row"]),
                                 [req[k]["label"] for k in case["missing"]])

    def test_dictionaries_come_from_the_spec(self):
        req = PUBLISH_CRITERIA["required"]
        self.assertEqual(REQUIRED_FIELDS,
                         tuple(req[k]["label"] for k in PUBLISH_CRITERIA["order"]))
        self.assertEqual(VALID_OPP_TYPES, set(req["type"]["allowed"]))
        self.assertEqual(PUBLISHABLE_COST_TYPES, set(req["cost"]["allowed"]))
        self.assertEqual(PAYMENT_TYPES, set(req["date"]["except_types"]))


if __name__ == "__main__":
    unittest.main()
