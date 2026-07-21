// Zero-dependency CI checks for the tracker site. Run: npm run test:site
import fs from 'node:fs';
import path from 'node:path';
let failures = 0;
const SITE = 'public';
const sitePath = file => path.join(SITE, file);
const fail = m => { console.error('  FAIL ' + m); failures++; };
const ok = m => console.log('  ok ' + m);

// ---------- sets.js ----------
console.log('sets.js');
const setsSrc = fs.readFileSync(sitePath('sets.js'), 'utf8');
let SETS;
// This CI-only script evals the repo's own checked-in sets.js to validate its
// syntax, with zero external/network input; there's no dependency-free way to
// parse JS syntax in Node without a real parser package (same reasoning below).
try { SETS = new Function(setsSrc + '; return SETS;')(); ok('parses'); } // NOSONAR
catch (e) { fail('does not parse: ' + e.message); process.exit(1); }

const ids = Object.keys(SETS);
if (ids.length === 0) fail('no sets defined'); else ok(ids.length + ' active set(s)');

const allowedSetFields = new Set([
  'name', 'sheet', 'sheetGid', 'tcgSet', 'tcgdexSet', 'code', 'logo',
  'eyebrow', 'subtitle', 'imgTemplate', 'promoSet', 'cardmarketSet',
  'cardmarketUrl', 'homeGroup',
]);
const allowedHomeGroups = new Set(['sv', 'mega', 'misc']);
for (const [id, cfg] of Object.entries(SETS)) {
  if (/^\d+$/.test(id)) fail(`key "${id}" is purely numeric - JS reorders these; rename it`);
  if (!/^[a-z0-9-]+$/.test(id)) fail(`key "${id}" is not kebab-case (lowercase letters, digits, hyphens only) - rename it to match the other set ids`);
  if (!cfg.name) fail(`"${id}" has no name`);
  if (!cfg.cardmarketSet && !cfg.cardmarketUrl)
    fail(`"${id}" has no Cardmarket set code or collection URL`);
  if (cfg.cardmarketUrl && !/^https:\/\/www\.cardmarket\.com\/en\/Pokemon\/Species\/[A-Za-z0-9-]+$/.test(cfg.cardmarketUrl))
    fail(`"${id}" has an invalid Cardmarket collection URL`);
  if (!allowedHomeGroups.has(cfg.homeGroup))
    fail(`"${id}" has an invalid or missing homeGroup`);
  for (const [field, value] of Object.entries(cfg)) {
    if (!allowedSetFields.has(field))
      fail(`"${id}" has unknown field "${field}" - possible typo`);
    if (typeof value !== 'string')
      fail(`"${id}.${field}" must be a string`);
  }
  if (cfg.sheet && !/output=csv/.test(cfg.sheet)) fail(`"${id}" sheet link is not a CSV publish link`);
  if (cfg.sheetGid && !/^\d+$/.test(cfg.sheetGid)) fail(`"${id}" sheetGid must contain digits only`);
  if (cfg.sheetGid && !cfg.sheet?.includes(`gid=${cfg.sheetGid}&`))
    fail(`"${id}" generated sheet URL does not contain its sheetGid`);
  if (!fs.existsSync(sitePath(path.join('img', id, 'manifest.txt'))))
    fail(`"${id}" has no image manifest`);
}
const gids = Object.entries(SETS).flatMap(([id, c]) => {
  const m = (c.sheet || '').match(/gid=(\d+)/); return m ? [[id, m[1]]] : [];
});
const seen = {};
for (const [id, gid] of gids) {
  if (seen[gid]) fail(`"${id}" and "${seen[gid]}" share gid=${gid} - one tab feeding two sets`);
  seen[gid] = id;
}
if (gids.length && Object.keys(seen).length === gids.length) ok('sheet gids are unique');

// A successful scan upload is not the same as a passing server-side gate.
// Keep deployment blocked until SonarCloud has computed and passed the gate.
const workflow = fs.readFileSync('.github/workflows/ci-quality-deploy.yml', 'utf8');
if (!workflow.includes('-Dsonar.qualitygate.wait=true'))
  fail('SonarQube analysis does not wait for the Quality Gate');
else ok('SonarQube Quality Gate blocks the analysis job');

const workflowFiles = fs.readdirSync('.github/workflows')
  .filter(file => file.endsWith('.yml'));
for (const file of workflowFiles) {
  const source = fs.readFileSync(path.join('.github/workflows', file), 'utf8');
  const unpinned = [...source.matchAll(/uses:\s+([^\s@]+)@([^\s#]+)/g)]
    .filter(match => !/^[0-9a-f]{40}$/.test(match[2]));
  for (const match of unpinned) fail(`${file}: action ${match[1]} is not pinned to a commit SHA`);
}
if (!failures) ok('GitHub Actions are pinned to commit SHAs');

const renovate = JSON.parse(fs.readFileSync('.github/renovate.json', 'utf8'));
if (!(renovate.extends || []).includes('helpers:pinGitHubActionDigests'))
  fail('Renovate is not configured to maintain pinned GitHub Action digests');
else ok('Renovate tracks pinned GitHub Actions');

// ---------- HTML pages ----------
for (const file of ['index.html', 'tracker.html', '404.html']) {
  console.log(file);
  const html = fs.readFileSync(sitePath(file), 'utf8');

  // inline content inside <script src=...> is silently dead - regression test
  const deadInline = [...html.matchAll(/<script src="[^"]+">([\s\S]*?)<\/script>/g)]
    .filter(m => m[1].trim().length > 0);
  if (deadInline.length) fail('code inside a <script src> tag (it will never run)');
  else ok('no dead inline code in src script tags');

  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  if (scripts.length) fail('inline scripts found; move them to the page JavaScript file');
  const styles = [...html.matchAll(/<style>([\s\S]*?)<\/style>/gi)].map(match => match[1]);
  if (styles.length) fail('inline styles found; move them to the page stylesheet');

  const csp = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/i)?.[1];
  if (!csp) fail('Content Security Policy meta tag missing');
  else {
    if (!csp.includes("object-src 'none'") || !csp.includes("base-uri 'none'"))
      fail('CSP is missing object-src/base-uri restrictions');
    if (csp.includes('sha256-')) fail('CSP contains a stale inline-content hash');
    if (csp.includes("'unsafe-inline'")) fail("CSP must not allow 'unsafe-inline'");
    // Google published-sheet redirects use rotating doc-XX shards. Permit only
    // that scoped wildcard; all other CSP sources must remain exact hosts.
    if (csp.replace('https://*.googleusercontent.com','').includes('*'))
      fail('CSP must use exact hosts except for Google published-sheet shards');
    if (/img-src[^;]*\shttps:\s*(?:;|$)/.test(csp))
      fail('CSP image sources must use explicit hosts, not all HTTPS origins');
  }
  if (/\son[a-z]+\s*=/i.test(html)) fail('inline event handler blocked by CSP');
  if (/xlsx|cdnjs\.cloudflare\.com/i.test(html)) fail('legacy Excel/CDN dependency found');

  const requiredIds = file === 'index.html'
    ? ['sets', 'setSearch', 'noResults']
    : file === 'tracker.html'
      ? ['setLogo', 'eyebrowText', 'titleFallback', 'groupSel', 'missOnly', 'sortSel', 'viewSel', 'lightbox', 'notice', 'exportMissing', 'exportOwned']
      : [];
  let missing = false;
  for (const id of requiredIds) {
    if (!html.includes(`id="${id}"`)) { fail(`missing element id="${id}"`); missing = true; }
  }
  if (!missing) ok('required element ids present');
}

const indexHtml = fs.readFileSync(sitePath('index.html'), 'utf8');
for (const marker of ['name="description"', 'rel="canonical"', 'property="og:title"']) {
  if (!indexHtml.includes(marker)) fail(`index.html missing metadata ${marker}`);
}
for (const file of ['404.html', 'robots.txt', 'sitemap.xml']) {
  if (!fs.existsSync(sitePath(file))) fail('missing production file ' + file);
}
if (!fs.readFileSync(sitePath('robots.txt'), 'utf8').includes('sitemap.xml'))
  fail('robots.txt does not advertise sitemap.xml');
else ok('production metadata and crawler files present');

// ---------- local JavaScript ----------
for (const file of ['lib.js', 'index.js', 'tracker.js']) {
  console.log(file);
  try { new Function(fs.readFileSync(sitePath(file), 'utf8')); ok('syntax OK'); } // NOSONAR
  catch (e) { fail('syntax error: ' + e.message); }
}
for (const file of ['index.html', 'tracker.html']) {
  if (!fs.readFileSync(sitePath(file), 'utf8').includes('<script src="lib.js">')) fail(`${file} does not load lib.js`);
}

// ---------- PWA files ----------
console.log('pwa');
for (const f of ['manifest.json', 'sw.js', '404.html', 'assets/icon-192.png', 'assets/icon-512.png']) {
  if (!fs.existsSync(sitePath(f))) fail('missing ' + f);
}
try { JSON.parse(fs.readFileSync(sitePath('manifest.json'), 'utf8')); ok('manifest.json is valid JSON'); }
catch (e) { fail('manifest.json invalid: ' + e.message); }
// every local script and stylesheet used by the pages must be in the precache SHELL,
// or an offline-installed PWA opens a page whose scripts 404 (real bug once)
const swSrc = fs.readFileSync(sitePath('sw.js'), 'utf8');
if (!swSrc.includes("const IMAGE_CACHE = 'card-images-v1'"))
  fail('sw.js: persistent image cache is not configured');
if (!swSrc.includes('IMAGE_CACHE_LIMIT'))
  fail('sw.js: image cache is not bounded');
if (!/\.type\s*!==\s*['"]opaque['"]/.test(swSrc))
  fail('sw.js: opaque image responses are not excluded from the cache');
const shellM = swSrc.match(/const SHELL = \[([^\]]*)\]/);
if (!shellM) fail('sw.js: SHELL list not found');
else {
  const shell = new Set([...shellM[1].matchAll(/'([^']+)'/g)].map(m => m[1]));
  for (const page of ['index.html', 'tracker.html']) {
    const srcs = [...fs.readFileSync(sitePath(page), 'utf8').matchAll(/<script src="([^"]+)"/g)]
      .map(m => m[1]).filter(s => !/^https?:/.test(s));
    const stylesheets = [...fs.readFileSync(sitePath(page), 'utf8').matchAll(/<link rel="stylesheet" href="([^"]+)"/g)]
      .map(m => m[1]).filter(s => !/^https?:/.test(s));
    for (const asset of [...srcs, ...stylesheets]) {
      if (shell.has(asset)) ok(`${page}: ${asset} is precached`);
      else fail(`${page} loads ${asset} but sw.js SHELL doesn't precache it - offline PWA would break`);
    }
  }
}
try { new Function(fs.readFileSync(sitePath('sw.js'), 'utf8').replace(/\bself\./g,'__s.').replace(/\blocation\./g,'__l.').replace(/\bcaches\./g,'__c.')); ok('sw.js syntax OK'); } // NOSONAR
catch (e) { fail('sw.js syntax error: ' + e.message); }

console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
