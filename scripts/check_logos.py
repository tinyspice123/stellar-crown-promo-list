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

UA = {"User-Agent": "Mozilla/5.0 (card-tracker-logo-check)"}

def reachable(url, opener=urllib.request.urlopen):
    # GET rather than HEAD: some of these CDNs don't support HEAD reliably.
    # download_assets.py uses the same check (tiny responses are usually
    # error pages, not a real logo).
    req = urllib.request.Request(url, headers=UA)
    try:
        with opener(req, timeout=15) as r:
            return len(r.read()) >= 100
    except Exception:
        return False


def candidates(entry):
    """Return logo candidates in the same preference order as the site."""
    cands = []
    if entry.get("logo"): cands.append(entry["logo"])
    if entry.get("tcgSet"):
        cands.append(f"https://images.pokemontcg.io/{entry['tcgSet']}/logo.png")
    if entry.get("tcgdexSet"):
        serie = re.match(r"[a-z]+", entry["tcgdexSet"], re.I)
        if serie:
            cands.append(
                f"https://assets.tcgdex.net/en/{serie.group(0).lower()}/"
                f"{entry['tcgdexSet']}/logo.png")
    return cands


def check(entries, is_reachable=reachable):
    ok, broken, skipped = 0, [], 0
    for entry in entries:
        cands = candidates(entry)

        if not cands:
            skipped += 1
            continue

        print(f"{entry['id']}:", end=" ", flush=True)
        working = next((url for url in cands if is_reachable(url)), None)
        if working:
            print(f"ok ({working})")
            ok += 1
        else:
            print(f"BROKEN - none of {len(cands)} candidate(s) resolved")
            for url in cands:
                print(f"    tried: {url}")
            broken.append(entry["id"])

    print(f"\n{ok}/{len(entries)-skipped} set(s) with a logo source have a working candidate"
          f" ({skipped} skipped - no logo/tcgSet/tcgdexSet configured)")
    if broken:
        print("Broken:", ", ".join(broken))
        return 1
    return 0


def main():
    entries = parse_sets(Path("public/sets.js").read_text(encoding="utf-8"))
    return check(entries)


if __name__ == "__main__":
    sys.exit(main())
