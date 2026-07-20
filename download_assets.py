#!/usr/bin/env python3
"""
Mirror set logos into the repo so the site doesn't depend on external
image APIs for its chrome.

Usage:  python3 download_assets.py

Reads sets.js, then for every set tries (in order): the custom `logo`
URL, pokemontcg.io (via tcgSet), TCGdex (via tcgdexSet), and saves the
first success to assets/logos/<set-id>.png. The pages check that local
path first, so once committed, logos load from your own repo.

Re-run after adding sets. Requires Python 3, no packages.
"""
import json, re, sys, urllib.request
from pathlib import Path

from sets_js import parse_sets

entries = parse_sets(Path("sets.js").read_text(encoding="utf-8"))

if not entries:
    print("No active sets found in sets.js"); sys.exit(1)

out = Path("assets/logos"); out.mkdir(parents=True, exist_ok=True)
UA = {"User-Agent": "Mozilla/5.0"}

def fetch(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=15) as r:
        return r.read()

got, missed = 0, []
for e in entries:
    cands = []
    if e.get("logo"): cands.append(e["logo"])
    if e.get("tcgSet"): cands.append(f"https://images.pokemontcg.io/{e['tcgSet']}/logo.png")
    if e.get("tcgdexSet"):
        serie = re.match(r"[a-z]+", e["tcgdexSet"], re.I)
        if serie:
            cands.append(f"https://assets.tcgdex.net/en/{serie.group(0).lower()}/{e['tcgdexSet']}/logo.png")
    dest = out / f"{e['id']}.png"
    print(f"{e['id']}:", end=" ", flush=True)
    for url in cands:
        try:
            data = fetch(url)
            if len(data) < 100: raise ValueError("suspiciously small")
            dest.write_bytes(data)
            print(f"saved ({len(data)//1024} KB) from {url.split('/')[2]}")
            got += 1
            break
        except Exception:
            continue
    else:
        print("no source worked" + ("" if cands else " (no logo/tcgSet/tcgdexSet)"))
        missed.append(e["id"])

print(f"\n{got}/{len(entries)} logos saved to assets/logos/")
if missed:
    print("Missing:", ", ".join(missed))
print("Commit the assets/ folder; the site prefers these local copies automatically.")
