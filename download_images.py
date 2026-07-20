#!/usr/bin/env python3
"""
Download card images from Google Sheet and organize into img/ folder.

Usage:
  1. Export the set's sheet TAB as CSV (File → Download → CSV)
  2. Place the CSV file in this repo folder (e.g., sheet.csv)
  3. Run: python3 download_images.py sheet.csv <set-id>
     where <set-id> matches the key in sets.js, e.g.:
       python3 download_images.py stellar.csv stellar-crown
     Images land in img/<set-id>/ with img/<set-id>/manifest.txt

This will:
  - Read all Image column URLs from the CSV
  - Download each to img/[filename]
  - Create img/manifest.txt mapping card|number|variant→filename
  - Update index.html to use the local images

The tracker will now check:
  1. Image column URL (from sheet)
  2. img/[filename] (local cache)
  3. pokemontcg.io (fallback)
"""

import re
import sys
import csv
import urllib.request
import urllib.parse
import hashlib
from pathlib import Path

if len(sys.argv) < 2:
    print(__doc__)
    sys.exit(1)

csv_file = Path(sys.argv[1]).resolve()  # canonicalize before any validation or access
set_id = sys.argv[2] if len(sys.argv) > 2 else ""
# validate before it ever reaches a path join: a set id with a path
# separator or ".." would otherwise let img_dir escape img/ entirely
if set_id and not re.fullmatch(r"[\w.\-]+", set_id):
    print(f"✗ Invalid set id {set_id!r} — use letters, digits, dots and hyphens only "
          "(matches the sets.js key convention), no path separators.")
    sys.exit(1)
if not set_id:
    print("\u26a0 No set id given \u2014 using img/ directly. For the multi-set site, pass the")
    print("  sets.js key, e.g.:  python3 download_images.py sheet.csv stellar-crown\n")
if not csv_file.exists() or not csv_file.is_file():
    print(f"✗ File not found: {csv_file}")
    sys.exit(1)

print(f"[1/3] Reading {csv_file}...")
reader = csv.reader(open(csv_file, encoding="utf-8-sig"))
raw = list(reader)
if not raw:
    print("✗ Empty CSV"); sys.exit(1)

# --- auto-detect the header row and column names (case/spacing tolerant) ---
def norm(h): return h.strip().lower()
def find_col(headers, *keywords):
    for i, h in enumerate(headers):
        n = norm(h)
        if any(k in n for k in keywords):
            return i
    return None

header_row_idx = None
cols = {}
for ri, row in enumerate(raw[:5]):          # header should be in the first few rows
    c_card = find_col(row, "card")
    c_img  = find_col(row, "image", "img", "url", "photo", "picture")
    if c_card is not None and c_img is not None:
        header_row_idx = ri
        cols = {
            "card":    c_card,
            "num":     find_col(row, "number", "no.", "num", "#"),
            "variant": find_col(row, "variant", "finish", "stamp", "version", "type"),
            "img":     c_img,
        }
        break

if header_row_idx is None:
    print("✗ Couldn't find a header row containing a Card column and an Image/URL column.")
    print("  First row of your CSV was:")
    print("   ", raw[0])
    sys.exit(1)

headers = raw[header_row_idx]
print(f"✓ Header row {header_row_idx+1}: using columns —")
for k, i in cols.items():
    print(f"    {k:8s} → {'(not found)' if i is None else repr(headers[i])}")
if cols["variant"] is None:
    print("  ⚠ No variant-like column found — keys will be Card|Number only.")
if cols["num"] is None:
    print("  ⚠ No number-like column found — keys will be Card|Variant only.")

def cell(row, key):
    i = cols.get(key)
    return row[i].strip() if i is not None and i < len(row) else ""

rows = raw[header_row_idx+1:]
print(f"✓ Found {len(rows)} data rows")

# Create img folder
img_dir = Path("img") / set_id if set_id else Path("img")
img_dir.mkdir(parents=True, exist_ok=True)

# Extract unique Image URLs
urls_to_dl = {}  # url -> (card, variant, filename)
downloaded = set()

dupes = []
for row in rows:
    card = cell(row, "card")
    num = cell(row, "num")
    variant = cell(row, "variant")
    img_url = cell(row, "img")

    if not img_url or not card:
        continue

    # Key on card + number + variant so same-name cards can't collide
    key = (card, num, variant)
    if key in downloaded:
        dupes.append(key)
        continue

    # Filename: card name + number + short hash of the full key
    h = hashlib.md5(f"{card}|{num}|{variant}".encode()).hexdigest()[:6]
    ext = Path(urllib.parse.urlparse(img_url).path).suffix or ".jpg"
    numpart = num.split('/')[0].replace(' ', '').lower() or "x"
    filename = f"{card.lower().replace(' ', '_')}_{numpart}_{h}{ext}"

    urls_to_dl[key] = (card, num, variant, img_url, filename)
    downloaded.add(key)

if dupes:
    print(f"\n\u26a0 {len(dupes)} row(s) share an identical Card+Number+Variant with an")
    print("  earlier row and were skipped. If these should be distinct cards, make")
    print("  their Variant text differ in the sheet, then re-run:")
    for card, num, variant in dupes:
        print(f"    - {card} {num} ({variant})")

print(f"\n[2/3] Downloading {len(urls_to_dl)} image(s)...")
failed = []
failed_keys = set()
url_cache = {}  # url -> bytes, so a URL shared by several cards is fetched once
for i, (key, (card, num, variant, url, filename)) in enumerate(urls_to_dl.items(), 1):
    filepath = img_dir / filename
    try:
        pct = f"[{i}/{len(urls_to_dl)}]"
        print(f"  {pct} {card} {num} ({variant})", end=" → ", flush=True)
        if url not in url_cache:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=10) as response:
                url_cache[url] = response.read()
        filepath.write_bytes(url_cache[url])
        size_kb = filepath.stat().st_size / 1024
        print(f"{filename} ({size_kb:.1f} KB) ✓")
    except Exception as e:
        print(f"✗ {type(e).__name__}: {e}")
        failed.append((filename, str(e)))
        failed_keys.add(filename)
        if filepath.exists():
            filepath.unlink()

# Write manifest
print("\n[3/3] Creating manifest...")
mapfile = img_dir / "manifest.txt"
with open(mapfile, 'w') as f:
    written = 0
    for key, (card, num, variant, url, filename) in sorted(urls_to_dl.items()):
        if filename in failed_keys:
            continue  # don't map cards to images that didn't download
        f.write(f"{card}|{num}|{variant}|{filename}\n")
        written += 1
print(f"✓ Wrote {written} entries to {mapfile}")

# Summary
print("\n✅ Done!")
print(f"  Downloaded: {len(urls_to_dl)-len(failed)}/{len(urls_to_dl)} images")
if failed:
    print(f"  Failed: {len(failed)}")
    for fn, _ in failed:
        print(f"    - {fn}")
print("\n📁 Next steps:")
print(f"  1. Commit the {img_dir}/ folder to your repo")
print("  2. Push to GitHub")
print("  3. Your tracker will now load images from img/ first")
