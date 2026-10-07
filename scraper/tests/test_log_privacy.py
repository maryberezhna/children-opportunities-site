"""Журнали GitHub Actions публічні: email і імена дітей туди не потрапляють (07.10.2026)."""
import pathlib
import re

from log_privacy import mask_email, short_id

ROOT = pathlib.Path(__file__).resolve().parents[1]


def test_mask_email():
    assert mask_email("mama.petrenko@gmail.com") == "ma***@gmail.com"
    assert mask_email("a@ukr.net") == "a***@ukr.net"
    assert mask_email("") == "—"
    assert mask_email(None) == "—"


def test_short_id():
    assert short_id("3ce24b6c-8ded-47e9-866c-5fd45cd09992") == "3ce24b6c"
    assert short_id(None) == "—"


def test_scripts_do_not_log_raw_emails_or_child_names():
    pattern = re.compile(
        r"(logger\.\w+|print)\(.*(r\.get\(\"parent_email\"\)|r\[\"email\"\]|r\.get\(\"email\"\)"
        r"|letter\['email'\]|child_name)")
    for name in ("olimpiada_invites.py", "olimpiada_launch.py", "process_suggestions.py"):
        for n, line in enumerate((ROOT / name).read_text(encoding="utf-8").splitlines(), 1):
            if pattern.search(line):
                assert "mask_email(" in line and "child_name" not in line, f"{name}:{n}: {line.strip()}"
