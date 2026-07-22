#!/usr/bin/env python3
"""
Collection history backup — fetches every active set's published CSV and
writes it to backups/<set-id>.csv. Run by .github/workflows/backup.yml on
a daily schedule; git history provides the versioning, so each snapshot's
changes are a normal git diff.

Run manually any time:  python3 backup_sheets.py
"""
import sys, time, urllib.error, urllib.parse, urllib.request
from pathlib import Path

from sets_js import parse_sets

UA = {"User-Agent": "Mozilla/5.0 (card-tracker-backup)"}
SHEET_DELIVERY_HOST = "doc-08-3o-sheets.googleusercontent.com"
REQUEST_TIMEOUT = 45
MAX_ATTEMPTS = 3
REQUEST_PACE_SECONDS = 0.5


def validate_delivery_host(source_url, final_url):
    """Fail clearly if Google moves a published sheet beyond the CSP allowlist."""
    source_host = urllib.parse.urlparse(source_url).hostname
    final_host = urllib.parse.urlparse(final_url).hostname
    allowed = {"docs.google.com", SHEET_DELIVERY_HOST}
    if source_host == "docs.google.com" and final_host not in allowed:
        raise ValueError(
            f"Google redirected to unexpected host {final_host!r}; update the "
            "Content Security Policy in public/index.html and public/tracker.html")


def fetch_csv(url, opener, sleeper, attempts=MAX_ATTEMPTS):
    """Fetch one sheet, retrying only temporary network/HTTP failures."""
    request = urllib.request.Request(url, headers=UA)
    for attempt in range(1, attempts + 1):
        try:
            with opener(request, timeout=REQUEST_TIMEOUT) as response:
                data = response.read().decode("utf-8")
                geturl = getattr(response, "geturl", None)
                if callable(geturl):
                    validate_delivery_host(url, geturl())
            return data
        except urllib.error.HTTPError as exc:
            if exc.code not in {408, 425, 429} and exc.code < 500:
                raise
            error = exc
        except OSError as exc:
            error = exc
        if attempt == attempts:
            raise error
        delay = 2 ** attempt
        print(f"    temporary fetch failure ({error}); retrying in {delay}s")
        sleeper(delay)
    raise RuntimeError("unreachable")


def backup(entries, out=Path("backups"), opener=urllib.request.urlopen,
           sleeper=time.sleep, pace_seconds=REQUEST_PACE_SECONDS):
    """Back up configured sheets and return 0 on success, 1 on failures."""
    sets = [(e["id"], e["sheet"]) for e in entries if e.get("sheet")]
    if not sets:
        print("No sets with sheet links found in sets.js")
        return 0

    out.mkdir(exist_ok=True)
    saved, failed = 0, []
    for index, (sid, url) in enumerate(sets):
        try:
            data = fetch_csv(url, opener, sleeper)
            if data.lstrip().startswith("<"):
                raise ValueError("got a web page, not CSV (tab not published?)")
            lf_data = data.replace("\r\n", "\n").replace("\r", "\n")
            normalized_data = "\n".join(line.rstrip() for line in lf_data.split("\n"))
            (out / f"{sid}.csv").write_text(
                normalized_data, encoding="utf-8", newline="\n"
            )
            print(f"  {sid}: {data.count(chr(10))} rows")
            saved += 1
        except Exception as exc:
            print(f"  {sid}: FAILED - {exc}")
            failed.append(sid)
        if pace_seconds and index < len(sets) - 1:
            sleeper(pace_seconds)

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
