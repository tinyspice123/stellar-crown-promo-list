# Pokemon Card Tracker

A multi-set, template-driven card checklist site. A home page lists your sets with live completion bars; each set gets its own tracker page fed from a tab in one Google Spreadsheet. Set pages can mix the master base set, reverse holos, secret rares, and promos/variants in one list. Adding a set means adding one sheet tab and one entry in `sets.js` — nothing else.

---

## Features

- **Multi-set template** — One tracker page serves every set via `tracker.html?set=<id>`; the home page shows each set's official logo and a live progress bar
- **Live Google Sheets sync** — Edit the sheet; the site updates within ~5 minutes (no republish needed)
- **Quantity tracking** — The Have column takes numbers (`3` shows as ×3 and counts in total copies), plus `TRUE`/`x`/`yes` for simple ownership
- **Reverse holo rendering** — Rows whose Variant contains "Reverse holo" get a rainbow foil sheen and REV HOLO badge automatically, in the grid and the lightbox, for every set
- **Price stats in £** — Value owned and cost of gaps from the Price column; ranges like `~£4-11` are averaged
- **Sorting** — Sheet order, name A–Z, or price high↔low (within each group; unpriced cards sink)
- **Filtering** — Search, group dropdown, Missing Only toggle
- **Export missing / owned** — Copy a plain-text want/have list to the clipboard, or download it as CSV; respects the active search and group filter
- **Lightbox viewer** — Click any card to zoom; hi-res scans load where available; Esc or click to close
- **Two image APIs + fallback chain** — pokemontcg.io for older sets, TCGdex for newer ones (Mega era onward); each image tries its sources in order and heals itself if one is down
- **Custom images** — Per-row Image URLs in the sheet always win; an image downloader mirrors them into the repo
- **Offline fallback** — Optional local `.xlsx` per set if the sheet is unreachable
- **Optional write-back** — With a small Apps Script deployed on the spreadsheet, +/− buttons on each card edit the Have column from the website
- **Self-hosted assets** — `download_assets.py` mirrors set logos into the repo; the site prefers local copies
- **Collapsible groups** — Click any group header to fold/unfold it; state remembered per set
- **Keyboard shortcuts** — `/` focuses search, `m` toggles Missing only, ←/→ browse cards in the lightbox, Esc closes
- **Installable PWA** — Add to home screen on mobile; pages and images cached for offline browsing (sheet data still needs a connection to refresh)
- **Weekly collection history** — A scheduled Action snapshots every sheet into `backups/`; git history gives diffable, restorable records of your collection over time
- **CI** — GitHub Actions runs site checks (sets.js validity, HTML script sanity) and Python unit tests on every push/PR

---

## Getting Started (hosting your own)

1. **Fork the repo** and enable GitHub Pages (Settings → Pages → deploy from `main`)
2. **Create a Google Spreadsheet** with one tab per set, columns:
   `Group, Card, Number, Variant, Source, Status, Price, Have, Image`
3. **Publish each tab**: File → Share → Publish to web → select the tab → CSV → copy the link
4. **Edit `sets.js`** — add an entry per set (see below). That's the only file you configure.

---

## Adding a New Set

1. **Add a tab** to the spreadsheet with the same columns
2. **Publish that tab** to web as CSV (each tab has its own `gid=` in the link — make sure you pick the right tab, not "entire document")
3. **Add an entry to `sets.js`**:

   ```javascript
   // A set covered by pokemontcg.io (anything up to ~2025):
   "paradox-rift": {
     name: "Paradox Rift",
     sheet: "https://docs.google.com/.../pub?gid=TAB_GID&single=true&output=csv",
     tcgSet: "sv4",        // pokemontcg.io code → card images + set logo
   },

   // A newer set pokemontcg.io lacks (Mega Evolution era onward):
   "perfect-order": {
     name: "Perfect Order",
     code: "ME03",          // shown on the home tile
     sheet: "https://docs.google.com/.../pub?gid=TAB_GID&single=true&output=csv",
     tcgdexSet: "me03",     // TCGdex id → card images + set logo
   },
   ```

4. Commit & push. The set appears on the home page with logo and progress bar; its tracker lives at `tracker.html?set=<id>`. The tracker itself never needs editing.

Common `tcgSet` codes: `sv1` S&V base · `sv2` Paldea Evolved · `sv3` Obsidian Flames · `sv3pt5` 151 · `sv4` Paradox Rift · `sv4pt5` Paldean Fates · `sv5` Temporal Forces · `sv6` Twilight Masquerade · `sv6pt5` Shrouded Fable · `sv7` Stellar Crown · `sv8` Surging Sparks · `sv8pt5` Prismatic Evolutions. Verify any code by opening `https://images.pokemontcg.io/<code>/logo.png` in a browser. For TCGdex ids, check the set's page on tcgdex.net.

Optional per-set fields: `logo` (custom logo URL, overrides both APIs), `imgTemplate` (fully custom image URL with `{num}`/`{num3}` placeholders), `promoSet` (pokemontcg.io code for `SVP NNN` rows, default `svp`), `subtitle`, `eyebrow`, `file` + `tab` (local xlsx fallback).

---

## Sheet Structure

| Column | Example | Notes |
|--------|---------|-------|
| **Group** | `Base Set (001–142)` | Section headers: fill Group, leave Card empty |
| **Card** | `Crispin` | Pokémon or Trainer name |
| **Number** | `133/142` or `SVP 133` | Drives auto images; any `NNN/MMM` works |
| **Variant** | `Regular` / `Reverse holo` / `STAFF stamp` | What makes this row unique. "Reverse holo" triggers the foil sheen |
| **Source** | `Prize Pack Series 6 & 7` | Where it's from / rarity — free text |
| **Status** | `Verify` or empty | Shows a verify badge |
| **Price** | `£1.50` or `~£4-11` | Plain £ text; ranges averaged; blank = excluded from value stats |
| **Have** | `1`, `2`, `TRUE`, `x`, or empty | Number = quantity owned; empty/`FALSE`/`0` = need it |
| **Image** | `https://...` | Direct photo URL — always wins over API images |

Duplicate card names are fine (both Meditite prints, regular + reverse rows): rows are identified by Card + Number + Variant together.

---

## Image Sources (priority order)

1. **Sheet Image column** — your own photo URLs
2. **`img/<set-id>/` folder** — repo-hosted copies (see downloader below)
3. **`imgTemplate`** — custom source, if configured
4. **pokemontcg.io** — via `tcgSet`
5. **TCGdex** — via `tcgdexSet` (both number paddings tried)
6. Crystal placeholder

Each image walks this chain on error, so a missing card or API outage degrades gracefully. Set logos chain the same way (custom → pokemontcg.io → TCGdex → text title).

Reverse holos: no API hosts true RH scans, so RH rows render the regular art with a foil-sheen overlay. Your own photos via the Image column display as-is.

---

## Template Sheet

`template.csv` shows exactly what a set tab should look like — import it into a new tab (File → Import → Insert new sheet) and replace the example rows. It demonstrates group headers, regular + reverse holo pairs, quantities vs. TRUE, the Verify status, a promo with an SVP number, and a custom Image URL.

---

## Editing Quantities from the Website (optional)

By default the site is read-only. To enable the +/− buttons on cards:

1. Open the spreadsheet → Extensions → Apps Script → paste `apps-script/Code.gs`
2. Deploy → New deployment → Web app → *Execute as: Me* · *Access: Anyone*
3. Copy the web-app URL into `WRITE_URL` at the top of `sets.js` (un-comment the line)
4. In the Apps Script editor: Project Settings (⚙) → **Script properties** → add property `WRITE_PIN` with your PIN — a word or short phrase beats 4 digits
5. Ensure every set entry's `tab` matches its exact Google tab name

**Security model.** `sets.js` is served as a plain static file, so `WRITE_URL` is public by definition — anyone can view-source it, and that's fine. The secret is the **PIN**: it lives only in Script properties (server side, never in the repo), the site asks each visitor for it once and remembers it in that browser's `localStorage`, and the server refuses any write without it. Ten wrong PINs lock all writes for 10 minutes, so it can't be brute-forced. Even a correct PIN can only change the Have column of existing rows. Wrong-PIN edits roll back on screen with a toast; the *Forget / change PIN* link in the page footer clears the stored PIN. Revoke everything by deleting the deployment.

Edits are optimistic (instant on screen) and confirmed against the server's response; the Google publish cache still means a page *reload* can show values up to ~5 min old.

---

## Self-Hosting Assets (`download_assets.py`)

`python3 download_assets.py` reads sets.js and saves each active set's logo to `assets/logos/<set-id>.png`, trying your custom `logo`, then pokemontcg.io, then TCGdex. Commit the folder; both pages check the local path before any API. Re-run after adding sets. Card *artwork* still comes from the APIs (mirroring thousands of card images into a repo isn't practical) — for specific cards you want pinned locally, use the Image column + `download_images.py`.

`python3 check_logos.py` is the read-only counterpart: it walks the same logo/tcgSet/tcgdexSet candidate chain without downloading anything, and fails if none of a set's candidates resolve. Useful right after adding a `tcgSet`/`tcgdexSet` code you haven't verified yet (see the `// VERIFY` comments in `sets.js`) — it also runs weekly in CI (see below).

---

## CI

`.github/workflows/static.yml` is a single pipeline — tests, then deploy. On every push to `main` and every PR:
- **Site checks** (`tests/ci_checks.mjs`, zero dependencies): sets.js parses; set ids aren't purely numeric and are kebab-case; sheet links are CSV links with no leftover `PASTE_TAB_GID`; no two sets share a gid; inline scripts in both pages are syntactically valid; no code trapped inside `<script src>` tags; required element ids exist
- **`lib.js` unit tests** (`tests/lib.test.mjs`): CSV parsing edge cases, price-range averaging, Have/qty parsing, column auto-detection, the image fallback chain
- **Python tests** (`tests/test_download_images.py`): header auto-detection, manifest format, duplicate reporting, failed-download exclusion, shared-URL handling
- **Deploy** publishes the repo to GitHub Pages **only if all test jobs pass** (skipped on PRs), so a broken commit can't take the live site down

`.github/workflows/backup.yml` also runs `check_logos.py` weekly alongside the sheet backup — it isn't in the deploy pipeline because it depends on third-party CDNs and shouldn't be able to block (or flake out) a deploy.

Run locally: `node tests/ci_checks.mjs`, `node tests/lib.test.mjs`, and `python3 -m unittest discover -s tests`.

---

## Image Downloader (`download_images.py`)

Mirrors every Image-column URL into the repo so GitHub Pages serves them (faster, immune to link rot).

```bash
# 1. Export the set's tab as CSV: File → Download → CSV
# 2. From the repo folder:
python3 download_images.py sheet.csv stellar-crown    # <set-id> from sets.js
# 3. Commit:
git add img/ && git commit -m "Mirror card images" && git push
```

- Auto-detects header names (`No.`, `Variant / Stamp`, `Image URL` etc. all work) and prints what it matched
- Writes `img/<set-id>/manifest.txt` mapping `Card|Number|Variant|filename`
- Failed downloads are reported and never enter the manifest
- Duplicate Card+Number+Variant rows are flagged instead of silently skipped
- Requires Python 3, no packages; re-running is safe

---

## Using the Tracker

- **Track**: edit the Have column in the sheet — the site is read-only by design and re-syncs within ~5 minutes
- **Sort**: dropdown in the toolbar — sheet order / name / price ↑↓, applied within each group
- **Filter**: search box, group dropdown, Missing Only
- **Export**: ⤓ Missing / ⤓ Owned buttons — Copy list (forum/eBay-ready text) or Download CSV; search and group filters apply, the Missing-only toggle doesn't
- **Zoom**: click any card image; ←/→ step between cards, Esc/✕/click closes
- **Fold**: click a group header to collapse it (remembered next visit)
- **Keys**: `/` → search, `m` → missing-only toggle
- **Stats**: completion ring, owned/missing, total copies, £ value owned, £ cost of gaps

---

## Troubleshooting

**"Got a web page, not CSV" warning** — the published link is the HTML view. Re-copy from File → Share → Publish to web with the tab + CSV selected.

**New set shows another set's cards** — the sheet link reuses the wrong tab's `gid`. Each tab has its own; re-publish selecting the right tab.

**No images for a new set** — pokemontcg.io stopped updating before the Mega era. Use `tcgdexSet` instead of `tcgSet` for those sets. If TCGdex placeholders persist, confirm the set id on tcgdex.net.

**Local img/ images not showing** — check `img/<set-id>/manifest.txt` exists and its `Card|Number|Variant` values match the sheet exactly; the sheet's Image URL wins, so clear that cell to see the local copy; re-run the downloader after renames.

**Sheet edits not appearing** — Google's publish cache is ~5 minutes; hard-refresh (Ctrl+Shift+R).

**Wrong set opens from a link** — a missing or typo'd `?set=` id falls back to the first set in `sets.js`.

---

## Project Structure

```
repo/
├── index.html              # Home page — set tiles w/ logos, search, progress
├── tracker.html            # Tracker template (all sets share it; never edited per set)
├── sets.js                 # ★ Set registry + WRITE_URL — the only file you configure
├── lib.js                  # Shared pure logic (CSV parsing, price/qty math, image fallback chain)
├── template.csv            # Example sheet tab to copy for new sets
├── download_images.py      # Mirrors sheet Image URLs into img/<set-id>/
├── download_assets.py      # Mirrors set logos into assets/logos/
├── check_logos.py          # Read-only check that every set's logo source resolves
├── apps-script/Code.gs     # Optional write-back endpoint (paste into Apps Script)
├── tests/                  # CI checks + lib.js unit tests (node) + script unit tests (python)
├── renovate.json           # Automated dependency updates (Renovate)
├── .github/workflows/static.yml   # tests → deploy pipeline
├── .github/workflows/backup.yml   # weekly sheet snapshots + logo reachability check
├── backup_sheets.py        # fetches all sheets into backups/ (used by the Action)
├── manifest.json           # PWA manifest
├── sw.js                   # service worker (offline caching)
├── img/<set-id>/           # Per-set downloaded card images + manifest.txt
├── assets/logos/           # Self-hosted set logos
├── checklist.xlsx          # Optional local fallback data
└── README.md
```

---

## License & Credits

Provided as-is for the Pokémon TCG community. Not affiliated with The Pokémon Company; Pokémon and card images are © TPCi. Card images served via pokemontcg.io and TCGdex. Checklist data compiled from Bulbapedia, Serebii, PokéBeach, and community research.
