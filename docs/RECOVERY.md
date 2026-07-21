# Recovery runbook

This runbook covers the failures most likely to affect the static tracker. It
assumes repository access and permission to run GitHub Actions deployments.

## Put the site into maintenance mode

1. Open **GitHub → Actions → Toggle maintenance mode → Run workflow**.
2. Select `enable` and run the workflow from `main`.
3. Verify the Pages URL shows the maintenance screen and that a direct URL such
   as `tracker.html` also leads to it.

To restore service, run the same workflow with `disable`. A successful normal
deployment from `main` also replaces maintenance mode with the live site.

## Roll back a bad release

1. Find the last known-good commit in **Actions → Tests / Security / Deploy**.
2. Revert the bad commit with a new commit; do not rewrite or force-push `main`.
3. Push the revert and wait for every required test and the SonarQube Quality
   Gate to pass.
4. Confirm the deployment smoke test succeeds, then open the home page and one
   configured tracker page in a private browser window.

If the normal pipeline cannot run, enable maintenance mode while diagnosing it.
Disable maintenance only after a full site artifact has deployed successfully.

## Restore collection data

Published Google Sheets are the live source. Versioned snapshots are stored as
`backups/<set-id>.csv` by the weekly backup workflow.

1. Identify the last good CSV using Git history.
2. Download that revision of the backup.
3. Import it into the matching Google Sheets tab, checking that columns align.
4. Run **Actions → Backup collection sheets** manually.
5. Confirm its validation step passes before relying on the restored sheet.

Never restore one set's CSV into another tab: the sheet `gid` identifies the tab
but does not validate its contents.

## Respond to a sheet outage

1. Open the configured CSV URL from `public/sets.js` directly.
2. Confirm it returns CSV rather than a Google sign-in or HTML error page.
3. In Google Sheets, use **Share → Publish to web**, choose the individual tab
   and CSV, then compare the resulting URL with `sets.js`.
4. If the delivery hostname changes, update the CSP only after verifying that
   the redirect belongs to Google and update `scripts/backup_sheets.py` with the
   same allowlisted host.
5. Run the site, Python, and browser checks before deployment.

## Repair missing or incorrect images

1. Check the row's Card, Number, and Variant text against
   `public/img/<set-id>/manifest.txt`; matching is exact apart from case.
2. Correct the sheet wording or regenerate overrides with
   `scripts/download_images.py`.
3. If only labels changed, run
   `python scripts/sync_manifest.py path/to/sheet.csv <set-id>` to re-key the
   existing images without downloading them again.
4. Run `python scripts/validate_data.py`. It detects missing files, duplicate or
   stale mappings, unsafe filenames, and unreferenced images.
5. Open the affected card in both card and table views after deployment.

## Clear a stale browser release

The service worker updates automatically, but an already-open tab may still be
running an earlier release. Close all tracker tabs and reopen the site. If that
does not work, remove the site's stored data/service worker in browser developer
tools and reload. Do this only on the affected browser; it is not a server-side
rollback procedure.

## Final recovery checks

- Home page, tracker page, manifest and service worker return successful HTTP
  responses.
- A configured sheet loads and progress totals appear.
- One exact promo/variant override displays its local image.
- Missing/owned exports work.
- The latest deployment smoke test and scheduled backup validation are green.
