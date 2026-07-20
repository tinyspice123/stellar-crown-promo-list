#!/usr/bin/env python3
"""
Mirror set logos into the repo so the site doesn't depend on external
image APIs for its chrome.

Usage:  python3 download_assets.py

Reads public/sets.js, then for every set tries (in order): the custom `logo`
URL, pokemontcg.io (via tcgSet), TCGdex (via tcgdexSet), and saves the
first success to public/assets/logos/<set-id>.png. The pages check that local
path first, so once committed, logos load from your own repo.

Re-run after adding sets. Requires Python 3, no packages.
"""
import re, sys, urllib.request
from pathlib import Path

from sets_js import parse_sets

UA = {"User-Agent": "Mozilla/5.0"}

def fetch(url, opener=urllib.request.urlopen):
    req = urllib.request.Request(url, headers=UA)
    with opener(req, timeout=15) as r:
        return r.read()


def candidates(entry):
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


def download(entries, out=Path("public/assets/logos"), fetcher=fetch):
    if not entries:
        print("No active sets found in sets.js")
        return 1

    out.mkdir(parents=True, exist_ok=True)
    got, missed = 0, []
    for entry in entries:
        cands = candidates(entry)
        dest = out / f"{entry['id']}.png"
        print(f"{entry['id']}:", end=" ", flush=True)
        for url in cands:
            try:
                data = fetcher(url)
                if len(data) < 100:
                    raise ValueError("suspiciously small")
                dest.write_bytes(data)
                print(f"saved ({len(data)//1024} KB) from {url.split('/')[2]}")
                got += 1
                break
            except Exception:
                continue
        else:
            suffix = "" if cands else " (no logo/tcgSet/tcgdexSet)"
            print("no source worked" + suffix)
            missed.append(entry["id"])

    print(f"\n{got}/{len(entries)} logos saved to {out}/")
    if missed:
        print("Missing:", ", ".join(missed))
    print("Commit the assets/ folder; the site prefers these local copies automatically.")
    return 0


def main():
    entries = parse_sets(Path("public/sets.js").read_text(encoding="utf-8"))
    return download(entries)


if __name__ == "__main__":
    sys.exit(main())
