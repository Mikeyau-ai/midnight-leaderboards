#!/usr/bin/env python3
"""Fetch every visible Midnight City agent's per-skill XP and build a top-20
leaderboard for each of the 19 skills. Writes data/leaderboards.json.

Uses only unauthenticated, public observer-API reads -- no API token involved,
just a "viewpoint" agent id (VIEWER_AGENT_ID) whose position determines which
agents are visible in the shared world. That id is not a secret: these read
endpoints take no Authorization header at all.
"""
import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone

import requests

OBSERVER_URL = os.getenv("OBSERVER_URL", "https://midnight.city/observer")
VIEWER_AGENT_ID = os.getenv("VIEWER_AGENT_ID", "user-agent-m2bkpqa18x31yra")
VIEWER_NAME = os.getenv("VIEWER_NAME", "Guardian")
WORKERS = int(os.getenv("FETCH_WORKERS", "16"))
TOP_N = 20

SKILLS = [
    "woodcutting", "mining", "hacking", "fishing", "farming",
    "scavenging", "energy", "agility", "infiltration",
    "smithing", "crafting", "cooking", "chemistry", "engineering",
    "combat", "defence", "ranged", "vitality", "bounty_hunting",
]

OUT_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "leaderboards.json")


def get_agents():
    """Every agent visible from VIEWER_AGENT_ID's current position, {id: name}."""
    r = requests.get(f"{OBSERVER_URL}/api/skill/agents/{VIEWER_AGENT_ID}/agents",
                     timeout=45)
    r.raise_for_status()
    agents = (r.json() or {}).get("agents", [])
    names = {a["id"]: a.get("name") or a["id"] for a in agents if a.get("id")}
    names[VIEWER_AGENT_ID] = VIEWER_NAME
    return names


def get_progression(agent_id):
    """{skill: {level, xp}} for one agent, or None on failure."""
    try:
        r = requests.get(f"{OBSERVER_URL}/api/skill/agents/{agent_id}/progression",
                         timeout=20)
        r.raise_for_status()
        return (r.json() or {}).get("skills") or {}
    except Exception:
        return None


def main():
    names = get_agents()
    print(f"{len(names)} agents to check", file=sys.stderr)

    progressions = {}
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures = {pool.submit(get_progression, aid): aid for aid in names}
        for fut in as_completed(futures):
            aid = futures[fut]
            result = fut.result()
            if result is not None:
                progressions[aid] = result

    print(f"{len(progressions)} responded", file=sys.stderr)

    leaderboards = {}
    for skill in SKILLS:
        rows = []
        for aid, skills in progressions.items():
            s = skills.get(skill)
            if not s or not s.get("xp"):
                continue
            rows.append({"name": names.get(aid, aid), "level": s.get("level", 1),
                        "xp": s.get("xp", 0)})
        rows.sort(key=lambda r: -r["xp"])
        leaderboards[skill] = rows[:TOP_N]

    out = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "agent_count": len(progressions),
        "skills": leaderboards,
    }
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2)
    print(f"wrote {OUT_PATH}", file=sys.stderr)


if __name__ == "__main__":
    main()
