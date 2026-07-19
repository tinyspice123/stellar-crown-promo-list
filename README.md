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
- **Lightbox viewer** — Click any card to zoom; hi-res scans load where available; Esc or click to close
- **Two image APIs + fallback chain** — pokemontcg.io for older sets, TCGdex for newer ones (Mega era onward); each image tries its sources in order and heals itself if one is down
- **Custom images** — Per-row Image URLs in the sheet always win; an image downloader mirrors them into the repo
- **Offline fallback** — Optional local `.xlsx` per set if the sheet is unreachable

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
- **Zoom**: click any card image; Esc, ✕, or clicking closes
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
├── index.html              # Home page — set tiles w/ logos + progress
├── tracker.html            # Tracker template (all sets share it; never edited per set)
├── sets.js                 # ★ Set registry — the only file you edit to add sets
├── download_images.py      # Mirrors sheet Image URLs into img/<set-id>/
├── img/
│   └── stellar-crown/      # Per-set downloaded images
│       └── manifest.txt    # Card|Number|Variant → filename map
├── checklist.xlsx          # Optional local fallback data
└── README.md
```

---

## License & Credits

Provided as-is for the Pokémon TCG community. Not affiliated with The Pokémon Company; Pokémon and card images are © TPCi. Card images served via pokemontcg.io and TCGdex. Checklist data compiled from Bulbapedia, Serebii, PokéBeach, and community research.
