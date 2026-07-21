# Ultimate Pokémon Card Tracker

A static, multi-set Pokémon card collection tracker backed by published Google
Sheets. The home page lists configured sets and their completion; each set opens
the same reusable tracker with filtering, ownership totals, prices, exports,
offline caching, local card images, and marketplace search links.

The site has no production build step. Everything inside `public/` is deployed
unchanged to GitHub Pages.

## Quick start

Requirements:

- Node.js 24 for checks and browser tests
- Python 3.14 for maintenance scripts and their tests

Install the development dependencies:

```bash
npm ci
```

Run the site locally:

```bash
node tests/e2e/static-server.mjs public
```

Then open <http://127.0.0.1:4173/>. The local server is deliberately small and
serves only `public/`, matching the files deployed by GitHub Pages.

## Add or edit a set

Set configuration lives in [`public/sets.js`](public/sets.js). Add one entry to
the `SETS` object:

```js
"stellar-crown": {
  name: "Stellar Crown",
  code: "SV7",
  sheetGid: "123",
  tcgSet: "sv7",
  tcgdexSet: "sv07",
  subtitle: "English master set",
},
```

Rules:

- Use a unique, kebab-case key such as `stellar-crown`.
- Publish the spreadsheet as CSV and store only the tab's numeric `sheetGid`.
- Keep the shared publication URL in `SHEET_BASE_URL` and make sure each
  configured set uses a different `sheetGid`.
- `tcgSet` is the Pokémon TCG API set code; `tcgdexSet` is the TCGdex code.
- Optional fields include `logo`, `eyebrow`, `subtitle`, `imgTemplate`,
  `promoSet`, and `cardmarketSet`.

After editing the registry, run:

```bash
npm run test:site
python scripts/check_logos.py
```

The first command catches malformed configuration and missing site assets. The
second checks external logo fallbacks and therefore needs internet access.

## Prepare the Google Sheet

Import [`docs/template.csv`](docs/template.csv) into a new sheet tab and replace
the example rows. The tracker recognises these columns:

| Column | Purpose |
| --- | --- |
| Group | Section heading used by the group filter |
| Card | Displayed card name |
| Number | Collector number, for example `107/142` or `SVP 134` |
| Variant / Stamp | Finish, promo source, stamp, or other distinction |
| Source | Optional source or product note |
| Status | Optional checklist status |
| Price | Estimated value of one copy |
| Have | Owned quantity, `x`, or `TRUE` |
| Image URL | Optional exact image override |

Publish that tab with **File → Share → Publish to web**, select the tab and CSV,
then paste its generated URL into `public/sets.js`.

## Local logos and card images

The site first uses files committed under `public/assets/` and `public/img/`, so
important artwork remains stable even if an external API changes.

Download or refresh all configured set logos:

```bash
python scripts/download_assets.py
```

Download exact card variants referenced by a CSV export:

```bash
python scripts/download_images.py path/to/sheet.csv stellar-crown
```

If card/variant wording changes later, synchronize the existing manifest keys
without downloading the images again:

```bash
python scripts/sync_manifest.py path/to/sheet.csv stellar-crown
```

Use `--check` to report drift without editing the manifest. Cosmetic case and
punctuation changes are already ignored by runtime lookup; the sync command
handles unambiguous wording changes and refuses uncertain matches.
The scheduled backup workflow runs this synchronization automatically before
validating and committing refreshed sheet backups.

That command writes images and a lookup manifest to
`public/img/stellar-crown/`. Commit both the images and `manifest.txt`.
An Image URL in the sheet takes priority over the local file, followed by the
configured API fallbacks.

## Back up collection data

Run this manually to snapshot every configured sheet into `backups/`:

```bash
python scripts/backup_sheets.py
```

The scheduled backup workflow runs the same command weekly and commits only
when sheet data changed.

Validate every configured backup and exact-variant image mapping offline with:

```bash
python scripts/validate_data.py
```

The validator rejects malformed sheet columns, missing collector numbers,
duplicate card variants, invalid quantities, stale manifest mappings, missing
image files, and orphaned local images.

## Tests

Run each test layer from the repository root:

```bash
npm run test:site
npm run test:coverage
npm run test:e2e
npm run test:python
```

- `tests/site/` validates configuration, HTML, CSP, JavaScript syntax, and PWA
  precaching without installing extra packages.
- `tests/unit/` exercises shared JavaScript and service-worker behavior.
- `tests/python/` tests the maintenance scripts without real network calls.
- `tests/e2e/` runs the tracker in desktop and mobile Chrome with deterministic
  mocked sheet data.

JavaScript coverage is written to `coverage/`; Playwright failures are written
to `test-results/`. Both are generated and ignored by Git.

## CI and deployment

On pushes to `main` and pull requests, GitHub Actions runs:

1. Site checks and JavaScript unit coverage.
2. Python unit coverage.
3. Desktop and mobile Playwright tests.
4. SonarQube analysis and Quality Gate validation.
5. A GitHub Pages upload of `public/` when the checks pass on `main`.
6. Post-deployment smoke checks for the home page, tracker, manifest, and
   service worker.

### Maintenance mode

To replace the site temporarily with its maintenance page, open **Actions →
Toggle maintenance mode → Run workflow**, choose `enable`, and run it. Choose
`disable` to redeploy the current site from `public/`. A later successful normal
deployment also replaces maintenance mode with the live site.

For rollback, sheet restoration, outage and image-repair procedures, see the
[recovery runbook](docs/RECOVERY.md).

The workflow uses least-privilege job permissions. Pages deployment requires
`pages: write` and `id-token: write`; SonarQube authentication also uses an OIDC
token.

## Project structure

```text
.
├── public/                 # Entire GitHub Pages site; URLs are rooted here
│   ├── index.html          # Set selection page
│   ├── tracker.html        # Shared tracker page for every set
│   ├── index.js/css        # Home-page behavior and styles
│   ├── tracker.js/css      # Tracker behavior and styles
│   ├── lib.js              # Shared, testable data and image logic
│   ├── sets.js             # Set registry and sheet URLs
│   ├── sw.js               # Offline service worker
│   ├── manifest.json       # PWA metadata
│   ├── assets/             # Icons and locally mirrored set logos
│   └── img/<set-id>/       # Local card variants and manifest
├── scripts/                # Download, validation, and backup tools
├── tests/
│   ├── site/               # Static repository/site checks
│   ├── unit/               # JavaScript unit tests
│   ├── python/             # Python script tests
│   └── e2e/                # Playwright tests and local static server
├── docs/template.csv       # Example sheet tab to import
├── backups/                # Versioned collection snapshots
├── playwright.config.mjs
├── sonar-project.properties
└── package.json
```

Root-level files are limited to project configuration and documentation. Runtime
files belong in `public/`; test fixtures belong with their test layer.

## Troubleshooting

**The page is blank locally** — serve `public/` with the command in Quick start.
Opening the HTML directly with a `file://` URL prevents normal fetch and service
worker behavior.

**A set does not appear** — run `npm run test:site` and check its entry in
`public/sets.js`. The key must be kebab-case and the sheet URL must end with a
published CSV output parameter.

**Sheet data does not load** — confirm the individual tab is published to the
web and that its URL contains `output=csv`. A normal edit/share URL is not a CSV
endpoint.

**A local card image does not appear** — check that its file and manifest are in
`public/img/<set-id>/`, and that the manifest's card, number, and variant exactly
match the sheet. Clear the sheet's Image URL if you want the local image to win.

**A logo is missing** — run `python scripts/download_assets.py`, then commit the
new file under `public/assets/logos/`.

**Changes look stale** — reload once while online. The service worker uses a
network-first strategy for pages and configuration, but an already-open tab can
still display its previously loaded version until refreshed.
