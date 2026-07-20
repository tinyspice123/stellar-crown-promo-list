#!/usr/bin/env python3
"""
Collection history backup — fetches every active set's published CSV and
writes it to backups/<set-id>.csv. Run by .github/workflows/backup.yml on
a weekly schedule; git history provides the versioning, so each week's
changes are a normal git diff.

Run manually any time:  python3 backup_sheets.py
"""
import sys, urllib.parse, urllib.request
from pathlib import Path

from sets_js import parse_sets

UA = {"User-Agent": "Mozilla/5.0 (card-tracker-backup)"}
SHEET_DELIVERY_HOST = "doc-08-3o-sheets.googleusercontent.com"


def validate_delivery_host(source_url, final_url):
    """Fail clearly if Google moves a published sheet beyond the CSP allowlist."""
    source_host = urllib.parse.urlparse(source_url).hostname
    final_host = urllib.parse.urlparse(final_url).hostname
    allowed = {"docs.google.com", SHEET_DELIVERY_HOST}
    if source_host == "docs.google.com" and final_host not in allowed:
        raise ValueError(
            f"Google redirected to unexpected host {final_host!r}; update the "
            "Content Security Policy in public/index.html and public/tracker.html")


def backup(entries, out=Path("backups"), opener=urllib.request.urlopen):
    """Back up configured sheets and return 0 on success, 1 on failures."""
    sets = [(e["id"], e["sheet"]) for e in entries if e.get("sheet")]
    if not sets:
        print("No sets with sheet links found in sets.js")
        return 0

    out.mkdir(exist_ok=True)
    saved, failed = 0, []
    for sid, url in sets:
        try:
            req = urllib.request.Request(url, headers=UA)
            with opener(req, timeout=30) as response:
                data = response.read().decode("utf-8")
                geturl = getattr(response, "geturl", None)
                if callable(geturl):
                    validate_delivery_host(url, geturl())
            if data.lstrip().startswith("<"):
                raise ValueError("got a web page, not CSV (tab not published?)")
            (out / f"{sid}.csv").write_text(data, encoding="utf-8")
            print(f"  {sid}: {data.count(chr(10))} rows")
            saved += 1
        except Exception as exc:
            print(f"  {sid}: FAILED - {exc}")
            failed.append(sid)

    print(f"\n{saved}/{len(sets)} sets backed up to {out}/")
    if failed:
        print("Failed:", ", ".join(failed))
        return 1
    return 0


def main():
    entries = parse_sets(Path("public/sets.js").read_text(encoding="utf-8"))
    return backup(entries)


if __name__ == "__main__":
    sys.exit(main())
