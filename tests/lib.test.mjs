// Behavioral tests for lib.js's pure functions - run: node tests/lib.test.mjs
// lib.js is a plain classic script (no import/export, by design — see its
// header comment), so it's loaded here the same way ci_checks.mjs loads
// sets.js: eval the source, then grab the functions off the returned object.
import fs from 'fs';

const libSrc = fs.readFileSync(new URL('../lib.js', import.meta.url), 'utf8');
const {csvToRows, priceMid, parseHaveQty, detectColumns, rowsToItems, imgCandidatesPure,
       esc, sortItems, exportText, exportCsv, csvEscape} =
  new Function(libSrc + `
    return {csvToRows, priceMid, parseHaveQty, detectColumns, rowsToItems, imgCandidatesPure,
            esc, sortItems, exportText, exportCsv, csvEscape};
  `)();

let failures = 0;
// Plain JSON.stringify compares object key order, not just key/value pairs -
// sorting keys makes this an actual deep-equality check instead of failing
// whenever a source object's property declaration order changes.
function stableStringify(v){
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  if (v && typeof v === 'object') {
    return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + stableStringify(v[k])).join(',') + '}';
  }
  return JSON.stringify(v);
}
function eq(actual, expected, label){
  const a = stableStringify(actual), e = stableStringify(expected);
  if (a === e) { console.log('  ok ' + label); }
  else { console.error(`  FAIL ${label}\n    expected ${e}\n    got      ${a}`); failures++; }
}

console.log('csvToRows');
eq(csvToRows('a,b\n1,2'), [['a','b'],['1','2']], 'simple rows');
eq(csvToRows('a,b\r\n1,2\r\n'), [['a','b'],['1','2']], 'CRLF line endings');
eq(csvToRows('﻿a,b\n1,2'), [['a','b'],['1','2']], 'strips leading BOM');
eq(csvToRows('"hello, world","she said ""hi""\nnext line"'), [['hello, world','she said "hi"\nnext line']], 'quoted commas, escaped quotes, embedded newline');

console.log('priceMid');
eq(priceMid('£1.20'), 1.2, 'single price');
eq(priceMid('~£4-11'), 7.5, 'range is averaged');
eq(priceMid(''), null, 'empty string -> null');
eq(priceMid('TBD'), null, 'no digits -> null');

console.log('parseHaveQty');
eq(parseHaveQty('3'), 3, 'numeric string');
eq(parseHaveQty('TRUE'), 1, 'TRUE -> 1');
eq(parseHaveQty('x'), 1, 'x -> 1');
eq(parseHaveQty(''), 0, 'blank -> 0');
eq(parseHaveQty('0'), 0, '"0" -> 0');
eq(parseHaveQty('-'), 0, 'hyphen -> 0');
eq(parseHaveQty('–'), 0, 'en dash -> 0 (regression: index.html used to miss this)');
eq(parseHaveQty('false'), 0, 'false -> 0');
eq(parseHaveQty('no'), 0, 'no -> 0');

console.log('detectColumns / rowsToItems');
{
  // tracker.html matches header text by simple substring ("number", "variant",
  // "image", ...) - this is the sheet layout template.csv and the README document.
  const header = ['Group','Card','Number','Variant','Source','Status','Price','Have','Image'];
  const cols = detectColumns(header);
  eq(cols, {cGroup:0,cCard:1,cNum:2,cVar:3,cSrc:4,cStatus:5,cPrice:6,cHave:7,cImg:8}, 'documented sheet header maps to the right column indices');

  const rows = [
    header,
    ['Base Set (001-142)','','','','','','','',''],
    ['','Venusaur ex','001/142','Regular','Double Rare','','£1.20','1',''],
    ['','Ledyba','002/142','Reverse holo','','','£0.15','',''],
    ['','','','','','','','',''], // blank Card row is skipped
  ];
  const items = rowsToItems(rows);
  eq(items.length, 2, 'group-header and blank-card rows are excluded from items');
  eq(items[0], {group:'Base Set (001-142)', card:'Venusaur ex', num:'001/142', variant:'Regular', src:'Double Rare', price:'£1.20', status:'', qty:1, img:''}, 'group carries forward onto following rows');
  eq(items[1].qty, 0, 'Reverse holo row with blank Have is not owned');
}

console.log('imgCandidatesPure');
{
  const cfg = {tcgSet:'sv7', tcgdexSet:'me03', promoSet:'svp'};
  const it = {card:'Crispin', num:'133/142', variant:'Regular', img:''};
  const cands = imgCandidatesPure(it, cfg, 'stellar-crown', new Map());
  eq(cands[0], 'https://images.pokemontcg.io/sv7/133.png', 'tcgSet candidate for a plain NNN/MMM number');

  const withSheetImg = imgCandidatesPure({...it, img:'https://example.com/photo.jpg'}, cfg, 'stellar-crown', new Map());
  eq(withSheetImg[0], 'https://example.com/photo.jpg', 'sheet Image URL always wins');

  const withLocal = imgCandidatesPure(it, cfg, 'stellar-crown', new Map([['Crispin|133/142|Regular','crispin_133_abc.jpg']]));
  eq(withLocal[0], 'img/stellar-crown/crispin_133_abc.jpg', 'local manifest file beats API candidates');

  const dexOnly = imgCandidatesPure({...it, num:'7/142'}, {tcgdexSet:'me03'}, 'perfect-order', new Map());
  eq(dexOnly, ['https://assets.tcgdex.net/en/me/me03/007/high.webp','https://assets.tcgdex.net/en/me/me03/7/high.webp'], 'tcgdex tries both zero-padded and bare number');

  const promo = imgCandidatesPure({card:'Ledian', num:'SVP 133', variant:'Prerelease promo', img:''}, cfg, 'stellar-crown', new Map());
  eq(promo[0], 'https://images.pokemontcg.io/svp/133.png', 'SVP promo number resolves via promoSet');
}

console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed');
console.log('esc');
eq(esc('<b>&"\''), '&lt;b&gt;&amp;&quot;&#39;', 'escapes all five HTML-sensitive chars');
eq(esc('Pikachu 025/191'), 'Pikachu 025/191', 'plain text passes through');

console.log('sortItems');
const cards=[
  {card:'Beta', num:'10', price:'£2'},
  {card:'Alpha', num:'2', price:''},
  {card:'Alpha', num:'10', price:'£5'},
];
eq(sortItems(cards,''), cards, 'empty mode returns sheet order (same array)');
eq(sortItems(cards,'name').map(c=>c.card+' '+c.num),
   ['Alpha 2','Alpha 10','Beta 10'], 'name sort is numeric-aware on the number');
eq(sortItems(cards,'price-desc').map(c=>c.card),
   ['Alpha','Beta','Alpha'], 'price desc, unpriced card sinks to the bottom');
eq(sortItems(cards,'price-asc').map(c=>c.price),
   ['£2','£5',''], 'price asc, unpriced card still last');
eq(cards[0].card, 'Beta', 'input array is not mutated');

console.log('exportText');
const exList=[
  {card:'Pikachu', num:'025', variant:'Regular', group:'Base', price:'£1.20', qty:0},
  {card:'Eevee', num:'133', variant:'Reverse holo', group:'Base', price:'', qty:3},
];
eq(exportText('Stellar Crown','missing',[exList[0]]),
   'Stellar Crown \u2014 missing (1 card)\n- Pikachu 025 \u2014 £1.20',
   'regular variant omitted, price appended, singular "card"');
eq(exportText('Stellar Crown','owned',[exList[1]]),
   'Stellar Crown \u2014 owned (1 card)\n- Eevee 133 (Reverse holo) \u00d73',
   'non-regular variant and qty>1 shown for owned');

console.log('exportCsv / csvEscape');
eq(csvEscape('plain'), 'plain', 'no quoting when unneeded');
eq(csvEscape('a,b'), '"a,b"', 'comma triggers quoting');
eq(csvEscape('say "hi"'), '"say ""hi"""', 'embedded quotes doubled');
const csv=exportCsv('owned',[{card:'Mr. Mime, Jr.', num:'12', variant:'Regular', group:'Base', price:'£3', qty:2}]);
eq(csv.split('\n')[0], 'Card,Number,Variant,Group,Price,Have', 'owned export gains Have column');
eq(csv.split('\n')[1], '"Mr. Mime, Jr.",12,Regular,Base,£3,2', 'comma in card name is quoted');
eq(exportCsv('missing',[exList[0]]).split('\n')[0],
   'Card,Number,Variant,Group,Price', 'missing export has no Have column');


process.exit(failures ? 1 : 0);
