/**
 * Pokemon Card Tracker — write-back endpoint.
 *
 * Lets the website update the Have column when you tap +/− on a card.
 *
 * SETUP (one time, ~3 minutes):
 *  1. Open your tracking spreadsheet
 *  2. Extensions → Apps Script → delete any code → paste this file
 *  3. Deploy → New deployment → type: Web app
 *       - Execute as: Me
 *       - Who has access: Anyone
 *  4. Copy the web app URL (https://script.google.com/macros/s/…/exec)
 *  5. Paste it into WRITE_URL at the top of sets.js
 *
 *  6. Project Settings (gear icon) -> Script properties -> Add:
 *       Property: WRITE_PIN   Value: your PIN (a word or phrase is
 *       stronger than 4 digits). Writes are refused until it's set.
 *
 * SECURITY: the web-app URL is PUBLIC by nature (it ships in sets.js,
 * which anyone can view-source on GitHub Pages) - so the URL is NOT
 * the secret. The PIN is. It lives only in Script properties (server
 * side, never in the repo) and every write must include it. Ten wrong
 * PINs in a row lock all writes for 10 minutes. Even with the right
 * PIN, writes can only touch the Have column of existing rows. To
 * revoke everything, delete the deployment in Apps Script.
 *
 * Each set entry in sets.js needs `tab` set to the EXACT name of its
 * tab in this spreadsheet, e.g. tab: "stellar_crown".
 */

function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents);

    var pinErr = checkPin_(d);
    if (pinErr) return out_({ok: false, error: pinErr});

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(d.tab);
    if (!sh) return out_({ok: false, error: "no tab named " + d.tab});

    var values = sh.getDataRange().getValues();

    var hdr = findHeader_(values);
    if (!hdr) return out_({ok: false, error: "no header row found"});

    var rowIdx = findRow_(values, hdr, d);
    if (rowIdx < 0) return out_({ok: false, error: "row not found: " + d.card + " " + d.num + " " + d.variant});

    var qty = Math.max(0, parseInt(d.qty, 10) || 0);
    sh.getRange(rowIdx + 1, hdr.cHave + 1).setValue(qty === 0 ? "" : qty);
    return out_({ok: true, row: rowIdx + 1, qty: qty});
  } catch (err) {
    return out_({ok: false, error: String(err)});
  }
}

// PIN gate (the URL is public; this is the real lock). Returns an error
// string, or null when the write may proceed. Ten wrong PINs in a row
// lock all writes for 10 minutes.
function checkPin_(d) {
  var pin = PropertiesService.getScriptProperties().getProperty('WRITE_PIN') || '';
  if (!pin) return 'writes disabled: set WRITE_PIN in Script properties';
  var cache = CacheService.getScriptCache();
  if (cache.get('pin_lock')) return 'locked: too many wrong PINs, try again in ~10 min';
  if (String(d.pin || '') !== pin) {
    var fails = (parseInt(cache.get('pin_fails'), 10) || 0) + 1;
    cache.put('pin_fails', String(fails), 600);
    if (fails >= 10) cache.put('pin_lock', '1', 600);
    return 'bad pin';
  }
  cache.remove('pin_fails');
  return null;
}

// Find the header row (within the first 5) and its column indices.
function findHeader_(values) {
  for (var r = 0; r < Math.min(values.length, 5); r++) {
    var low = values[r].map(function (x) { return String(x).trim().toLowerCase(); });
    var ci = findCol_(low, ["card"]);
    var hi = findCol_(low, ["have", "own", "qty"]);
    if (ci > -1 && hi > -1) {
      return {
        hdrRow: r, cCard: ci, cHave: hi,
        cNum: findCol_(low, ["number", "no.", "num", "#"]),
        cVar: findCol_(low, ["variant", "finish", "stamp", "version"])
      };
    }
  }
  return null;
}

// Find the row matching card (+ number + variant when those columns exist).
// Returns the 0-based index into values, or -1.
function findRow_(values, hdr, d) {
  for (var r = hdr.hdrRow + 1; r < values.length; r++) {
    var row = values[r];
    if (String(row[hdr.cCard]).trim() !== d.card) continue;
    if (hdr.cNum > -1 && String(row[hdr.cNum]).trim() !== d.num) continue;
    if (hdr.cVar > -1 && String(row[hdr.cVar]).trim() !== d.variant) continue;
    return r;
  }
  return -1;
}

function doGet() { return out_({ok: true, service: "card-tracker write-back"}); }

function findCol_(low, keys) {
  for (var i = 0; i < low.length; i++)
    for (var k = 0; k < keys.length; k++)
      if (low[i].indexOf(keys[k]) > -1) return i;
  return -1;
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
