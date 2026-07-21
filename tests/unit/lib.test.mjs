// Behavioral tests for public/lib.js's pure functions - run: npm run test:coverage
// lib.js remains a plain classic script for browsers and exposes its pure
// helpers through CommonJS when loaded by Node's test runner.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

// Load the real file so V8/c8 attributes executed lines to lib.js. Evaluating
// its source through new Function creates an anonymous script whose coverage
// SonarQube cannot match to the repository file.
const require = createRequire(import.meta.url);
const {csvToRows, priceMid, matchesQuery, parseHaveQty, detectColumns, rowsToItems, imgCandidatesPure,
       esc, safeImageUrl, setSafeImageSource, sortItems, exportText, exportCsv,
       csvEscape, marketplaceSearchUrls} = require('../../public/lib.js');

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
test('priceMid: thousands separator stays within one number', () => {
  assert.equal(priceMid('GBP 1,200'), 1200);
});

test('matchesQuery includes Source and handles empty fields', () => {
  const card={card:'Pikachu',num:'025',variant:'Regular',src:'Build & Battle Box'};
  assert.equal(matchesQuery(card,'battle box'),true);
  assert.equal(matchesQuery(card,'eevee'),false);
  assert.equal(matchesQuery({...card,src:null},''),true);
});

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
  // "image", ...) - this is the docs/template.csv layout documented in README.
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

test('safeImageUrl permits images without permitting executable URLs', () => {
  const base='https://tracker.test/path/index.html';
  assert.equal(safeImageUrl('img/card.png',base),'https://tracker.test/path/img/card.png');
  assert.equal(safeImageUrl('https://images.example/card.png',base),'https://images.example/card.png');
  assert.equal(safeImageUrl('javascript:alert(1)',base),'');
  assert.equal(safeImageUrl('data:text/html,<script>alert(1)</script>',base),'');
  assert.equal(safeImageUrl('http://images.example/card.png',base),'');
  const image={};
  assert.equal(setSafeImageSource(image,'/card.png',base),true);
  assert.equal(image.src,'https://tracker.test/card.png');
  assert.equal(setSafeImageSource(image,'javascript:alert(1)',base),false);
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

test('marketplaceSearchUrls', async (t) => {
  await t.test('encodes identifying card details and omits a generic variant', () => {
    const urls=marketplaceSearchUrls(
      {card:'Mr. Mime & Friends',num:'12/100',variant:'Regular'});
    const ebay=new URL(urls.ebay);
    const cardmarket=new URL(urls.cardmarket);
    assert.equal(ebay.hostname,'www.ebay.co.uk');
    assert.equal(ebay.searchParams.get('_nkw'),
      'Mr. Mime & Friends 12/100');
    assert.equal(cardmarket.searchParams.get('searchString'),'Mr. Mime & Friends');
  });
  await t.test('uses a Cardmarket set code for regular collector numbers', () => {
    const urls=marketplaceSearchUrls(
      {card:'Archaludon',num:'107/142',variant:'Galaxy holo + GameStop stamp'}, 'SCR');
    const cardmarket=new URL(urls.cardmarket);
    assert.equal(cardmarket.hostname,'www.cardmarket.com');
    assert.equal(cardmarket.searchParams.get('searchString'),
      'Archaludon SCR 107');
    assert.equal(new URL(urls.ebay).searchParams.get('_nkw'),
      'Archaludon 107/142 Galaxy holo + GameStop stamp');
  });
  await t.test('keeps recognized promo prefixes without a set code', () => {
    const urls=marketplaceSearchUrls(
      {card:'Crabominable',num:'SVP 134',variant:'STAFF stamp'});
    assert.equal(new URL(urls.cardmarket).searchParams.get('searchString'),
      'Crabominable SVP 134');
  });
});
