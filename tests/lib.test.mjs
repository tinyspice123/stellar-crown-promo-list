// Behavioral tests for lib.js's pure functions - run: node tests/lib.test.mjs
// lib.js is a plain classic script (no import/export, by design — see its
// header comment), so it's loaded here the same way ci_checks.mjs loads
// sets.js: eval the source, then grab the functions off the returned object.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const libSrc = fs.readFileSync(new URL('../lib.js', import.meta.url), 'utf8');
const {csvToRows, priceMid, parseHaveQty, detectColumns, rowsToItems, imgCandidatesPure,
       esc, sortItems, exportText, exportCsv, csvEscape} =
  new Function(libSrc + `
    return {csvToRows, priceMid, parseHaveQty, detectColumns, rowsToItems, imgCandidatesPure,
            esc, sortItems, exportText, exportCsv, csvEscape};
  `)();

test('csvToRows: simple rows', () => {
  assert.deepStrictEqual(csvToRows('a,b\n1,2'), [['a','b'],['1','2']]);
});
test('csvToRows: CRLF line endings', () => {
  assert.deepStrictEqual(csvToRows('a,b\r\n1,2\r\n'), [['a','b'],['1','2']]);
});
test('csvToRows: strips leading BOM', () => {
  assert.deepStrictEqual(csvToRows('﻿a,b\n1,2'), [['a','b'],['1','2']]);
});
test('csvToRows: quoted commas, escaped quotes, embedded newline', () => {
  assert.deepStrictEqual(
    csvToRows('"hello, world","she said ""hi""\nnext line"'),
    [['hello, world','she said "hi"\nnext line']]);
});

test('priceMid: single price', () => { assert.equal(priceMid('£1.20'), 1.2); });
test('priceMid: range is averaged', () => { assert.equal(priceMid('~£4-11'), 7.5); });
test('priceMid: empty string -> null', () => { assert.equal(priceMid(''), null); });
test('priceMid: no digits -> null', () => { assert.equal(priceMid('TBD'), null); });

test('parseHaveQty: numeric string', () => { assert.equal(parseHaveQty('3'), 3); });
test('parseHaveQty: TRUE -> 1', () => { assert.equal(parseHaveQty('TRUE'), 1); });
test('parseHaveQty: x -> 1', () => { assert.equal(parseHaveQty('x'), 1); });
test('parseHaveQty: blank -> 0', () => { assert.equal(parseHaveQty(''), 0); });
test('parseHaveQty: "0" -> 0', () => { assert.equal(parseHaveQty('0'), 0); });
test('parseHaveQty: hyphen -> 0', () => { assert.equal(parseHaveQty('-'), 0); });
test('parseHaveQty: en dash -> 0 (regression: index.html used to miss this)', () => {
  assert.equal(parseHaveQty('–'), 0);
});
test('parseHaveQty: false -> 0', () => { assert.equal(parseHaveQty('false'), 0); });
test('parseHaveQty: no -> 0', () => { assert.equal(parseHaveQty('no'), 0); });

test('detectColumns: documented sheet header maps to the right column indices', () => {
  // tracker.html matches header text by simple substring ("number", "variant",
  // "image", ...) - this is the sheet layout template.csv and the README document.
  const header = ['Group','Card','Number','Variant','Source','Status','Price','Have','Image'];
  assert.deepStrictEqual(detectColumns(header),
    {cGroup:0,cCard:1,cNum:2,cVar:3,cSrc:4,cStatus:5,cPrice:6,cHave:7,cImg:8});
});

test('rowsToItems: group-header and blank-card rows are excluded from items', () => {
  const rows = [
    ['Group','Card','Number','Variant','Source','Status','Price','Have','Image'],
    ['Base Set (001-142)','','','','','','','',''],
    ['','Venusaur ex','001/142','Regular','Double Rare','','£1.20','1',''],
    ['','Ledyba','002/142','Reverse holo','','','£0.15','',''],
    ['','','','','','','','',''], // blank Card row is skipped
  ];
  const items = rowsToItems(rows);
  assert.equal(items.length, 2);
  assert.deepStrictEqual(items[0], {group:'Base Set (001-142)', card:'Venusaur ex', num:'001/142',
    variant:'Regular', src:'Double Rare', price:'£1.20', status:'', qty:1, img:''});
  assert.equal(items[1].qty, 0, 'Reverse holo row with blank Have is not owned');
});

test('imgCandidatesPure: tcgSet candidate for a plain NNN/MMM number', () => {
  const cfg = {tcgSet:'sv7', tcgdexSet:'me03', promoSet:'svp'};
  const it = {card:'Crispin', num:'133/142', variant:'Regular', img:''};
  const cands = imgCandidatesPure(it, cfg, 'stellar-crown', new Map());
  assert.equal(cands[0], 'https://images.pokemontcg.io/sv7/133.png');
});
test('imgCandidatesPure: sheet Image URL always wins', () => {
  const cfg = {tcgSet:'sv7', tcgdexSet:'me03', promoSet:'svp'};
  const it = {card:'Crispin', num:'133/142', variant:'Regular', img:'https://example.com/photo.jpg'};
  assert.equal(imgCandidatesPure(it, cfg, 'stellar-crown', new Map())[0], 'https://example.com/photo.jpg');
});
test('imgCandidatesPure: local manifest file beats API candidates', () => {
  const cfg = {tcgSet:'sv7', tcgdexSet:'me03', promoSet:'svp'};
  const it = {card:'Crispin', num:'133/142', variant:'Regular', img:''};
  const withLocal = imgCandidatesPure(it, cfg, 'stellar-crown',
    new Map([['Crispin|133/142|Regular','crispin_133_abc.jpg']]));
  assert.equal(withLocal[0], 'img/stellar-crown/crispin_133_abc.jpg');
});
test('imgCandidatesPure: tcgdex tries both zero-padded and bare number', () => {
  const it = {card:'Crispin', num:'7/142', variant:'Regular', img:''};
  const dexOnly = imgCandidatesPure(it, {tcgdexSet:'me03'}, 'perfect-order', new Map());
  assert.deepStrictEqual(dexOnly, [
    'https://assets.tcgdex.net/en/me/me03/007/high.webp',
    'https://assets.tcgdex.net/en/me/me03/7/high.webp',
  ]);
});
test('imgCandidatesPure: SVP promo number resolves via promoSet', () => {
  const cfg = {tcgSet:'sv7', tcgdexSet:'me03', promoSet:'svp'};
  const it = {card:'Ledian', num:'SVP 133', variant:'Prerelease promo', img:''};
  assert.equal(imgCandidatesPure(it, cfg, 'stellar-crown', new Map())[0],
    'https://images.pokemontcg.io/svp/133.png');
});

test('esc: escapes all five HTML-sensitive chars', () => {
  assert.equal(esc('<b>&"\''), '&lt;b&gt;&amp;&quot;&#39;');
});
test('esc: plain text passes through', () => {
  assert.equal(esc('Pikachu 025/191'), 'Pikachu 025/191');
});

test('sortItems', async (t) => {
  const cards=[
    {card:'Beta', num:'10', price:'£2'},
    {card:'Alpha', num:'2', price:''},
    {card:'Alpha', num:'10', price:'£5'},
  ];
  await t.test('empty mode returns sheet order (same array)', () => {
    assert.deepStrictEqual(sortItems(cards,''), cards);
  });
  await t.test('name sort is numeric-aware on the number', () => {
    assert.deepStrictEqual(sortItems(cards,'name').map(c=>c.card+' '+c.num),
      ['Alpha 2','Alpha 10','Beta 10']);
  });
  await t.test('price desc, unpriced card sinks to the bottom', () => {
    assert.deepStrictEqual(sortItems(cards,'price-desc').map(c=>c.card), ['Alpha','Beta','Alpha']);
  });
  await t.test('price asc, unpriced card still last', () => {
    assert.deepStrictEqual(sortItems(cards,'price-asc').map(c=>c.price), ['£2','£5','']);
  });
  await t.test('input array is not mutated', () => {
    assert.equal(cards[0].card, 'Beta');
  });
});

test('exportText', async (t) => {
  const exList=[
    {card:'Pikachu', num:'025', variant:'Regular', group:'Base', price:'£1.20', qty:0},
    {card:'Eevee', num:'133', variant:'Reverse holo', group:'Base', price:'', qty:3},
  ];
  await t.test('regular variant omitted, price appended, singular "card"', () => {
    assert.equal(exportText('Stellar Crown','missing',[exList[0]]),
      'Stellar Crown — missing (1 card)\n- Pikachu 025 — £1.20');
  });
  await t.test('non-regular variant and qty>1 shown for owned', () => {
    assert.equal(exportText('Stellar Crown','owned',[exList[1]]),
      'Stellar Crown — owned (1 card)\n- Eevee 133 (Reverse holo) ×3');
  });
});

test('exportCsv / csvEscape', async (t) => {
  await t.test('no quoting when unneeded', () => { assert.equal(csvEscape('plain'), 'plain'); });
  await t.test('comma triggers quoting', () => { assert.equal(csvEscape('a,b'), '"a,b"'); });
  await t.test('embedded quotes doubled', () => { assert.equal(csvEscape('say "hi"'), '"say ""hi"""'); });

  const csv = exportCsv('owned',[{card:'Mr. Mime, Jr.', num:'12', variant:'Regular', group:'Base', price:'£3', qty:2}]);
  await t.test('owned export gains Have column', () => {
    assert.equal(csv.split('\n')[0], 'Card,Number,Variant,Group,Price,Have');
  });
  await t.test('comma in card name is quoted', () => {
    assert.equal(csv.split('\n')[1], '"Mr. Mime, Jr.",12,Regular,Base,£3,2');
  });
  await t.test('missing export has no Have column', () => {
    const missing = exportCsv('missing',[{card:'Pikachu', num:'025', variant:'Regular', group:'Base', price:'£1.20', qty:0}]);
    assert.equal(missing.split('\n')[0], 'Card,Number,Variant,Group,Price');
  });
});
