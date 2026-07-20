#!/usr/bin/env python3
"""
Collection history backup — fetches every active set's published CSV and
writes it to backups/<set-id>.csv. Run by .github/workflows/backup.yml on
a weekly schedule; git history provides the versioning, so each week's
changes are a normal git diff.

Run manually any time:  python3 backup_sheets.py
"""
import sys, urllib.request
from pathlib import Path

from sets_js import parse_sets

entries = parse_sets(Path("sets.js").read_text(encoding="utf-8"))
sets = [(e["id"], e["sheet"]) for e in entries if e.get("sheet")]

if not sets:
    print("No sets with sheet links found in sets.js")
    sys.exit(0)

out = Path("backups"); out.mkdir(exist_ok=True)
UA = {"User-Agent": "Mozilla/5.0 (card-tracker-backup)"}
saved, failed = 0, []

for sid, url in sets:
    try:
        req = urllib.request.Request(url, headers=UA)
        with urllib.request.urlopen(req, timeout=30) as r:
            data = r.read().decode("utf-8")
        if data.lstrip().startswith("<"):
            raise ValueError("got a web page, not CSV (tab not published?)")
        (out / f"{sid}.csv").write_text(data, encoding="utf-8")
        rows = data.count("\n")
        print(f"  {sid}: {rows} rows")
        saved += 1
    except Exception as e:
        print(f"  {sid}: FAILED - {e}")
        failed.append(sid)

print(f"\n{saved}/{len(sets)} sets backed up to backups/")
if failed:
    print("Failed:", ", ".join(failed))
    sys.exit(1)   # fail the workflow so you notice a broken sheet link
