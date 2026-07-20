#!/usr/bin/env python3
"""
Logo reachability check — reads sets.js and, for every set with a `logo`,
`tcgSet`, or `tcgdexSet` field, walks the same candidate chain the site
itself uses (custom logo -> pokemontcg.io -> TCGdex) and confirms at least
one candidate resolves. Catches a wrong/unverified set code (see the
`// VERIFY` comments in sets.js) before a user sees a blank logo tile.

This only reads URLs — it never writes anything (see download_assets.py
for the script that mirrors logos into the repo). Run by the weekly
.github/workflows/backup.yml action; run manually any time:
  python3 check_logos.py
"""
import re, sys, urllib.request
from pathlib import Path

from sets_js import parse_sets

entries = parse_sets(Path("sets.js").read_text(encoding="utf-8"))

UA = {"User-Agent": "Mozilla/5.0 (card-tracker-logo-check)"}

def reachable(url):
    # GET rather than HEAD: some of these CDNs don't support HEAD reliably.
    # download_assets.py uses the same check (tiny responses are usually
    # error pages, not a real logo).
    req = urllib.request.Request(url, headers=UA)
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return len(r.read()) >= 100
    except Exception:
        return False

ok, broken, skipped = 0, [], 0
for e in entries:
    cands = []
    if e.get("logo"): cands.append(e["logo"])
    if e.get("tcgSet"): cands.append(f"https://images.pokemontcg.io/{e['tcgSet']}/logo.png")
    if e.get("tcgdexSet"):
        serie = re.match(r"[a-z]+", e["tcgdexSet"], re.I)
        if serie:
            cands.append(f"https://assets.tcgdex.net/en/{serie.group(0).lower()}/{e['tcgdexSet']}/logo.png")

    if not cands:
        skipped += 1
        continue

    print(f"{e['id']}:", end=" ", flush=True)
    working = next((u for u in cands if reachable(u)), None)
    if working:
        print(f"ok ({working})")
        ok += 1
    else:
        print(f"BROKEN - none of {len(cands)} candidate(s) resolved")
        for u in cands:
            print(f"    tried: {u}")
        broken.append(e["id"])

print(f"\n{ok}/{len(entries)-skipped} set(s) with a logo source have a working candidate"
      f" ({skipped} skipped - no logo/tcgSet/tcgdexSet configured)")
if broken:
    print("Broken:", ", ".join(broken))
    sys.exit(1)
