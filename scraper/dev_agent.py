"""dev_agent.py — Anthropic-powered developer agent for the dityam scraper project.

Usage:
    python dev_agent.py "fix the erasmus scraper"
    python dev_agent.py "add a new scraper for mon.gov.ua"
    python dev_agent.py "why is british_council returning empty results?"
    python dev_agent.py          # default: status overview of all scrapers
"""
import json
import os
import subprocess
import sys
from pathlib import Path

import anthropic

PROJECT_ROOT = Path(__file__).parent

SYSTEM_PROMPT = """You are a senior Python developer working on the dityam.com.ua \
children-opportunities scraper project.

## Project layout
- main.py                — entry point; runs all scrapers sequentially, exits 1 if any error
- db.py                  — Supabase: get_client(), upsert_opportunity(), archive_expired()
- normalizer.py          — sends raw_text to Claude Haiku; extracts structured opportunity data
- scrapers/
  - man_contests.py      — МАН contests (parses __NEXT_DATA__ embedded JSON, ~28 contests)
  - prometheus.py        — Prometheus free online courses
  - erasmus.py           — Erasmus+ Ukraine grants/exchanges
  - house_of_europe.py   — House of Europe creative programmes
  - unicef.py            — UNICEF Ukraine programmes
  - save_the_children.py — Save the Children Ukraine
  - british_council.py   — British Council Ukraine
- requirements.txt       — httpx, beautifulsoup4, lxml, anthropic, supabase, pydantic,
                           python-slugify, tenacity
- .github/workflows/scrape.yml — daily cron 06:00 UTC on main branch

## Scraper contract
Each module must export:  async def fetch_all() -> list[dict]
Each dict must contain:   source, source_url, raw_text
Optional:                 raw_title

## DB constraints (hard — violating these crashes the run)
cost_type CHECK: free | partially_free | paid_affordable | paid_premium | subsidized
  ← NEVER set cost_type to "closed", "archived", or anything else
status:  active | archived
  ← archive_expired() sets status="archived" for past-deadline rows

## Your workflow
1. Always read the relevant file(s) before editing.
2. Make focused, minimal changes — no refactors unless asked.
3. Verify syntax after edits:  python -m py_compile scrapers/foo.py
4. Prefer httpx + BeautifulSoup for new scrapers; use tenacity for retries.
5. Never hard-code secrets — they come from env vars (SUPABASE_URL, SUPABASE_SERVICE_KEY,
   ANTHROPIC_API_KEY).
"""


# ── tool implementations ──────────────────────────────────────────────────────

def _safe_path(path: str) -> Path:
    full = (PROJECT_ROOT / path).resolve()
    if not str(full).startswith(str(PROJECT_ROOT.resolve())):
        raise ValueError(f"Path {path!r} escapes project root")
    return full


def read_file(path: str) -> str:
    p = _safe_path(path)
    if not p.exists():
        return f"Error: {path} not found"
    try:
        return p.read_text(encoding="utf-8")
    except Exception as e:
        return f"Error reading {path}: {e}"


def write_file(path: str, content: str) -> str:
    p = _safe_path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding="utf-8")
    return f"Wrote {len(content)} chars to {path}"


def run_bash(command: str) -> str:
    try:
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            cwd=str(PROJECT_ROOT),
            timeout=60,
        )
        out = result.stdout[-3000:] if len(result.stdout) > 3000 else result.stdout
        err = result.stderr[-1500:] if len(result.stderr) > 1500 else result.stderr
        combined = out
        if err.strip():
            combined += "\n--- stderr ---\n" + err
        return combined.strip() or f"(exit {result.returncode}, no output)"
    except subprocess.TimeoutExpired:
        return "Error: command timed out after 60s"
    except Exception as e:
        return f"Error: {e}"


def list_files(directory: str = ".") -> str:
    try:
        p = _safe_path(directory)
        if not p.exists():
            return f"Error: {directory} not found"
        items = sorted(p.iterdir(), key=lambda x: (x.is_file(), x.name))
        return "\n".join(
            (f.name + "/" if f.is_dir() else f.name)
            for f in items
            if not f.name.startswith(".")
        )
    except Exception as e:
        return f"Error: {e}"


# ── tool schemas ──────────────────────────────────────────────────────────────

TOOLS = [
    {
        "name": "read_file",
        "description": (
            "Read a project file. Path is relative to the project root."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "e.g. 'scrapers/unicef.py' or 'db.py'",
                }
            },
            "required": ["path"],
        },
    },
    {
        "name": "write_file",
        "description": (
            "Overwrite a project file with new content. "
            "Always read the file first so you don't lose existing code."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string"},
                "content": {
                    "type": "string",
                    "description": "Complete new file content",
                },
            },
            "required": ["path", "content"],
        },
    },
    {
        "name": "run_bash",
        "description": (
            "Run a shell command in the project root (60s timeout). "
            "Good for: python -m py_compile, grep, git diff, pip install, "
            "python -c 'import scrapers.foo; import asyncio; asyncio.run(scrapers.foo.fetch_all())'."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "command": {"type": "string", "description": "Shell command"}
            },
            "required": ["command"],
        },
    },
    {
        "name": "list_files",
        "description": "List files and directories (non-hidden) inside a directory.",
        "input_schema": {
            "type": "object",
            "properties": {
                "directory": {
                    "type": "string",
                    "description": "Relative path (default '.')",
                }
            },
        },
    },
]

TOOL_FNS = {
    "read_file": lambda i: read_file(i["path"]),
    "write_file": lambda i: write_file(i["path"], i["content"]),
    "run_bash": lambda i: run_bash(i["command"]),
    "list_files": lambda i: list_files(i.get("directory", ".")),
}


# ── agent loop ────────────────────────────────────────────────────────────────

def run_agent(task: str) -> None:
    client = anthropic.Anthropic()
    messages: list = [{"role": "user", "content": task}]

    print(f"\n🤖  Dev Agent\n📋  {task}\n{'─' * 60}")

    for iteration in range(1, 25):
        with client.messages.stream(
            model="claude-opus-4-8",
            max_tokens=16000,
            thinking={"type": "adaptive"},
            system=[
                {
                    "type": "text",
                    "text": SYSTEM_PROMPT,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            tools=TOOLS,
            messages=messages,
        ) as stream:
            response = stream.get_final_message()

        # Print any text output (skip thinking blocks — they're internal)
        for block in response.content:
            if block.type == "text" and block.text.strip():
                print(f"\n{block.text}")

        if response.stop_reason == "end_turn":
            print("\n✅  Done.")
            break

        if response.stop_reason != "tool_use":
            print(f"\n⚠️   Unexpected stop_reason: {response.stop_reason}")
            break

        # Execute all requested tools
        messages.append({"role": "assistant", "content": response.content})
        results = []

        for block in response.content:
            if block.type != "tool_use":
                continue

            preview = json.dumps(block.input, ensure_ascii=False)
            if len(preview) > 120:
                preview = preview[:120] + "…"
            print(f"\n🔧  {block.name}({preview})")

            try:
                output = TOOL_FNS[block.name](block.input)
            except Exception as e:
                output = f"Error: {e}"

            # Compact display for the console
            lines = str(output).splitlines()
            shown = "\n    ".join(lines[:6])
            if len(lines) > 6:
                shown += f"\n    … ({len(lines) - 6} more lines)"
            print(f"    → {shown}")

            results.append({
                "type": "tool_result",
                "tool_use_id": block.id,
                "content": str(output),
            })

        messages.append({"role": "user", "content": results})
    else:
        print("\n⚠️   Reached 24-iteration safety limit.")


# ── entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    if not os.getenv("ANTHROPIC_API_KEY"):
        print("Error: ANTHROPIC_API_KEY is not set.", file=sys.stderr)
        sys.exit(1)

    task = " ".join(sys.argv[1:]).strip()
    if not task:
        task = (
            "Give a brief status of each scraper: "
            "check the code and flag any obvious issues."
        )

    run_agent(task)
