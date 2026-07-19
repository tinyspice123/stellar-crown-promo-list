// Zero-dependency CI checks for the tracker site. Run: node tests/ci_checks.mjs
import fs from 'fs';
let failures = 0;
const fail = m => { console.error('  FAIL ' + m); failures++; };
const ok = m => console.log('  ok ' + m);

// ---------- sets.js ----------
console.log('sets.js');
const setsSrc = fs.readFileSync('sets.js', 'utf8');
let SETS;
try { SETS = new Function(setsSrc + '; return SETS;')(); ok('parses'); }
catch (e) { fail('does not parse: ' + e.message); process.exit(1); }

const ids = Object.keys(SETS);
if (ids.length === 0) fail('no sets defined'); else ok(ids.length + ' active set(s)');

for (const [id, cfg] of Object.entries(SETS)) {
  if (/^\d+$/.test(id)) fail(`key "${id}" is purely numeric - JS reorders these; rename it`);
  if (!cfg.name) fail(`"${id}" has no name`);
  if (cfg.sheet && !/output=csv/.test(cfg.sheet)) fail(`"${id}" sheet link is not a CSV publish link`);
  if (cfg.sheet && /PASTE_TAB_GID/.test(cfg.sheet)) fail(`"${id}" still contains PASTE_TAB_GID - comment the sheet line out or paste the real gid`);
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

// ---------- HTML pages ----------
for (const file of ['index.html', 'tracker.html']) {
  console.log(file);
  const html = fs.readFileSync(file, 'utf8');

  // inline content inside <script src=...> is silently dead - regression test
  const deadInline = [...html.matchAll(/<script src="[^"]+">([\s\S]*?)<\/script>/g)]
    .filter(m => m[1].trim().length > 0);
  if (deadInline.length) fail('code inside a <script src> tag (it will never run)');
  else ok('no dead inline code in src script tags');

  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  if (!scripts.length) fail('no inline script found');
  scripts.forEach((s, i) => {
    try {
      new Function(s.replace(/\bdocument\./g, '__d.').replace(/\blocation\./g, '__l.').replace(/\bwindow\./g, '__w.'));
      ok(`inline script ${i + 1} syntax OK`);
    } catch (e) { fail(`inline script ${i + 1} syntax error: ${e.message}`); }
  });

  const requiredIds = file === 'index.html'
    ? ['sets', 'setSearch', 'noResults']
    : ['setLogo', 'eyebrowText', 'titleFallback', 'groupSel', 'missOnly', 'sortSel', 'lightbox', 'notice'];
  let missing = false;
  for (const id of requiredIds) {
    if (!html.includes(`id="${id}"`)) { fail(`missing element id="${id}"`); missing = true; }
  }
  if (!missing) ok('required element ids present');
}

console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
