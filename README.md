# Pokemon Card Tracker

A multi-set, template-driven card checklist site — each set page can mix the master base set and its promos/variants in one list. A home page lists your sets; each set gets its own tracker page fed live from a tab in one Google Spreadsheet. Adding a set means adding one sheet tab and one entry in `sets.js` — nothing else.

**Live site:** https://tinyspice123.github.io/stellar-crown-promo-list/

---

## Features

- **Multi-set template** — One tracker page serves every set via `tracker.html?set=<id>`; the home page shows all sets with live completion bars
- **Live Google Sheets sync** — Update your checklist in the sheet; changes appear on the site within ~5 minutes (no republish needed)
- **Track what you own** — Checkbox or number each card you have; automatically counts owned vs. missing
- **Price estimates** — See the total value of cards you own and cost to complete your collection (all prices in £)
- **Smart filtering** — Search by card name, filter by category (Prerelease, ETB, etc.), or toggle "Missing Only" view
- **High-resolution card viewer** — Click any card image to open a lightbox; automatically loads hi-res scans from pokemontcg.io
- **Custom images** — Add an "Image" column to your sheet and paste direct URLs for variant photos (staff stamps, retailer exclusives, etc.)
- **Works offline** — Falls back to local `.xlsx` file if the sheet is unreachable
- **Image downloader tool** — One script mirrors every Image URL from the sheet into the repo's `img/` folder for faster, self-hosted loading

---

## Getting Started

### Option A: Use the Live Site (Easiest)

1. Go to https://tinyspice123.github.io/stellar-crown-promo-list/
2. The tracker reads from the public Google Sheet and displays it immediately
3. To add/edit cards, contact the sheet owner or fork this repo (see below)

### Option B: Host Your Own Copy

#### Prerequisites
- A Google account (free)
- GitHub account (free) to fork and deploy
- Basic familiarity with Google Sheets and GitHub Pages

#### Steps

1. **Fork the repo**
   ```
   https://github.com/tinyspice123/stellar-crown-promo-list
   ```

2. **Create your own Google Sheet**
   - Copy the structure: columns for `Group`, `Card`, `Number`, `Variant`, `Source`, `Status`, `Price`, `Have`, `Image`
   - Add your cards and pricing
   - Go to **File → Share → Publish to web** → select the sheet tab → publish
   - Copy the published CSV URL (format: `https://docs.google.com/spreadsheets/.../pub?gid=...&output=csv`)

3. **Update the config in `index.html`**
   - Open `index.html` in a text editor
   - Find this line (around line 175):
     ```javascript
     const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/...";
     ```
   - Replace with your published sheet URL
   - Adjust the exchange rate if needed:
     ```javascript
     const USD_TO_LOCAL = 0.75; // change this to your rate
     const CURRENCY = "£"; // or "$" for USD
     ```

4. **Push to GitHub and enable Pages**
   - Commit and push your changes
   - Go to repo **Settings → Pages → Source: Deploy from branch → main**
   - Your site goes live at `https://[yourname].github.io/stellar-crown-promo-list/`

5. **Keep the sheet updated**
   - Edit your Google Sheet anytime
   - The site auto-syncs within ~5 minutes

---

## Adding a New Set

1. **Add a tab** to your Google Spreadsheet with the same columns as the existing one
2. **Publish that tab**: File → Share → Publish to web → select the tab → CSV → copy the link (each tab has its own `gid=` in the URL)
3. **Add an entry to `sets.js`**:
   ```javascript
   "paradox-rift": {
     name: "Paradox Rift",
     sheet: "https://docs.google.com/.../pub?gid=YOUR_TAB_GID&single=true&output=csv",
     tcgSet: "sv4",   // pokemontcg.io set code (used for card images + logo)
   },
   ```
4. Commit & push. The set appears on the home page with its own progress bar, and its tracker lives at `tracker.html?set=paradox-rift`.

Common `tcgSet` codes: `sv7` Stellar Crown · `sv4` Paradox Rift · `sv8` Surging Sparks · `sv3pt5` 151 · full list at pokemontcg.io/sets.

---

## Sheet Structure

Create columns with these exact header names:

| Column | Example | Notes |
|--------|---------|-------|
| **Group** | `Play! Pokémon Prize Pack Series 6` | Section headers (leave Card empty for group rows) |
| **Card** | `Crispin` | Pokémon or Trainer name |
| **Number** | `133/142` or `SVP 133` | Set number or SVP code |
| **Variant** | `Non-holo` | What makes it unique (Cosmos holo, STAFF stamp, etc.) |
| **Source** | `Prize Pack Series 6 & 7` | Where to find it |
| **Status** | `Verify` or empty | Optional flag for cards needing confirmation |
| **Price** | `~$2-3` or `£1.50` | Estimate or range; `$` prices auto-convert |
| **Have** | `1`, `yes`, `true`, `x`, or empty | How many you own (empty = need it) |
| **Image** | `https://...` | Direct URL to a card photo (overrides auto-fetch) |

**Pricing tips:**
- Write prices with `$` in USD; they convert to your `CURRENCY` at the `USD_TO_LOCAL` rate
- Write prices with your local symbol (e.g., `£3.50`) to skip conversion
- Ranges are averaged: `~$5-15` → midpoint ~$10 → ~£7.50
- Leave blank to exclude from value calculations

---

## Using the Tracker

### Main View
- **Cards grid** — Click an image to zoom in and see hi-res scans
- **Stats ring** — Top-left: % complete, owned/missing count, total value
- **Filters** — Search box, group dropdown, "Missing Only" toggle

### Tracking Cards
- **Checkbox** — Click the OWNED/NEED label to toggle one card
- **Quantity** — Click a card's `×N` tag to edit how many you own
- **Bulk edit** — Directly edit the Google Sheet; changes sync automatically

### Images
Images resolve in this priority order:
1. **Sheet's Image column** — a URL there always wins (staff stamps, retailer exclusives, your own scans)
2. **`img/` folder** — local copies downloaded by the image downloader tool (see below)
3. **pokemontcg.io** — base card art auto-loaded by card number
4. **Placeholder** — cards with no image show their initials in a crystal bubble

Click any image to open it in the lightbox viewer (hi-res where available).

---

## Customization

### Prices
All prices are plain £ text (e.g. `£3.50` or `~£4-11`). Ranges are averaged for the
value stats. There is no currency conversion — write what you'd actually pay.

### Data Source
**Option 1: Google Sheets (live)**
```javascript
const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/.../pub?gid=1801512098&single=true&output=csv";
```
Changes sync within ~5 minutes. No republish needed.

**Option 2: Local Excel file (offline)**
```javascript
const SHEET_URL = "";  // leave empty
const FILE = "checklist.xlsx";
```
Place `checklist.xlsx` in the same folder as `index.html`.

### Card Image URLs
The tracker uses pokemontcg.io by default:
- Set cards: `https://images.pokemontcg.io/sv7/NNN.png` (sv7 = Stellar Crown, NNN = card number)
- SVP promos: `https://images.pokemontcg.io/svp/NNN.png`

To use your own scans, add Image URLs in the sheet.

---

## Image Downloader (`download_images.py`)

A helper script that mirrors every image linked in your sheet's **Image** column into the repo, so the tracker serves them from GitHub Pages instead of hotlinking external sites (faster, and immune to link rot if a listing photo disappears).

### Usage

```bash
# 1. Export your Google Sheet as CSV: File → Download → Comma Separated Values (.csv)
# 2. From the repo folder, run:
python3 download_images.py sheet.csv stellar-crown   # <set-id> from sets.js

# 3. Commit the results:
git add img/ && git commit -m "Mirror card images" && git push
```

### What it does

- Downloads each unique Image URL to `img/` with a stable filename (`cardname_hash.ext`)
- Writes `img/manifest.txt` mapping `Card|Number|Variant|filename` — this is how `index.html` finds local copies
- Skips rows without an Image URL; reports any failed downloads at the end

### Notes

- Requires Python 3 (no extra packages)
- Re-run it any time you add new Image URLs to the sheet; existing files are simply re-downloaded
- The sheet's Image URL still takes priority on the live site — the `img/` folder is the fallback, so deleting a URL from the sheet makes the tracker use the mirrored copy
- If no `img/` folder or manifest exists, the tracker behaves as before (no errors)

---

## Troubleshooting

**"HTML detection" yellow warning**
- Your Google Sheet published URL is returning a web page instead of CSV
- Solution: Go to **File → Share → Publish to web**, ensure "Entire spreadsheet" or your sheet tab is selected, copy the CSV URL (not the HTML URL)

**Prices not converting**
- Check that prices start with `$` in the sheet (e.g., `~$5-15`)
- Verify `USD_TO_LOCAL` is set correctly
- GBP-only prices (no `$`) pass through unchanged

**Images not loading**
- pokemontcg.io may be temporarily down; wait a moment and refresh
- Try adding a custom Image URL for that card in the sheet
- Check browser console (F12) for errors

**Sheet updates not showing**
- Google Sheets publish has a ~5 minute cache delay
- Try a hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
- If using a local file, edit `.xlsx` and reload

**Local img/ images not showing**
- Check `img/manifest.txt` exists and its `Card|Number|Variant` values match the sheet exactly (case and spacing matter)
- Remember the sheet's Image URL wins — clear that cell to see the local copy
- Re-run `python3 download_images.py sheet.csv` after renaming cards or variants

**Card numbers aren't being recognized**
- Format as `NNN/142` (set cards) or `SVP NNN` (promos) to match pokemontcg.io URLs
- Custom Image URLs override auto-detection

---

## Project Structure

```
stellar-crown-promo-list/
├── index.html              # Home page — lists all sets w/ progress
├── tracker.html            # Tracker template (all sets share it)
├── sets.js                 # ★ Set registry — the only file you edit to add sets
├── checklist.xlsx          # Optional local fallback data
├── download_images.py      # Mirrors sheet Image URLs into img/<set-id>/
├── img/
│   └── stellar-crown/      # Per-set downloaded images
│       └── manifest.txt    # Card|Number|Variant → filename map
└── README.md               # This file
```

All data lives in Google Sheets; `index.html` is the only file needed to display it.

---

## Stellar Crown Promo Checklist

This tracker covers:
- **Prerelease promos** — SVP Black Star stamps (staff & regular)
- **Build & Battle Box exclusives** — Non-holo versions (Ledian, Bouffalant, Archaludon)
- **ETB promos** — Pokémon Center versions with stamps
- **Retailer exclusives** — GameStop, Best Buy, EB Games, European regional
- **Cosmos holo products** — Armarouge ex Box, Iron Valiant ex Box, Stage 1 blisters, etc.
- **Holiday & event cards** — Holiday Calendar, Trick or Trade, Battle Academy deck-numbered variants
- **Play! Pokémon Prize Packs** — Series 6, 7, & 8 stamped cards
- **Battle Box league distribution** — April 2026 non-holo variants

Across multiple finishes (non-holo, cosmos holofoil, STAFF stamps, Play! stamps) tracked individually.

---

## Contributing

Found a missing card, pricing error, or image link?
- **Fork and submit a PR** with updates to `index.html` config or the checklist structure
- **File an issue** on GitHub with details
- **Update the Google Sheet** directly if you have edit access

---

## License

This project and checklist are provided as-is for the Pokémon TCG community. Pokémon and Pokémon card images are © The Pokémon Company International, Inc. Card images hosted via pokemontcg.io.

---

## Credits

- **Data source** — Bulbapedia, PokéBeach, TCG Collector, eBay community research
- **Card images** — pokemontcg.io API
- **Exchange rate** — Manually set; update as needed

---

**Last updated:** July 2026  
**Current scope:** Stellar Crown SV7, covering ~180+ promo & variant cards
