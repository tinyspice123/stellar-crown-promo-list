// =====================================================================
//  Shared pure logic for the tracker — CSV parsing, row → item mapping,
//  price math, image fallback chains. Loaded as a plain classic script
//  (no import/export) so index.html and tracker.html can both use it
//  as globals, and tests/lib.test.mjs can eval it directly in Node.
//  Keep every function here side-effect-free (no DOM, no fetch) so it
//  stays easy to test.
// =====================================================================

// Quote-aware CSV parser: handles quoted fields, embedded commas/newlines,
// escaped quotes (""), CRLF/LF line endings, and a leading BOM.
// Reads a quoted CSV field starting just after the opening quote.
// Handles escaped quotes ("") and unterminated quotes (rest of input).
// Returns the field text and the index of the first unconsumed char.
function readQuotedCsvField(text, start){
  let out="", i=start;
  while(i<text.length){
    const c=text[i];
    if(c==='"'){
      if(text[i+1]==='"'){ out+='"'; i+=2; continue; }  // escaped quote
      return {text:out, next:i+1};                       // closing quote
    }
    out+=c; i++;
  }
  return {text:out, next:i};  // unterminated: take everything to the end
}

function csvToRows(text){
  if(text.codePointAt(0)===0xFEFF) text=text.slice(1);
  const rows=[]; let row=[], field="";
  const endField=()=>{ row.push(field); field=""; };
  const endRow=()=>{ endField(); rows.push(row); row=[]; };
  let i=0;
  while(i<text.length){
    const c=text[i];
    if(c==='"'){ const q=readQuotedCsvField(text,i+1); field+=q.text; i=q.next; continue; }
    if(c===','){ endField(); i++; continue; }
    if(c==='\n'||c==='\r'){ if(c==='\r'&&text[i+1]==='\n'){ i++; } endRow(); i++; continue; }
    field+=c; i++;
  }
  if(field!==""||row.length){ endRow(); }
  return rows;
}

// Average of the numbers in a price string: "£1.20" -> 1.2, "~£4-11" -> 7.5,
// "" / no digits -> null (excluded from value stats).
function priceMid(p){
  const nums=(String(p||"").match(/\d+(?:\.\d+)?/g)||[]).map(Number);
  if(!nums.length) return null;
  return nums.length>1 ? (nums[0]+nums[1])/2 : nums[0];
}

// The Have column takes a bare quantity ("3"), a truthy marker (TRUE/x/yes),
// or a "not owned" marker (blank/false/no/n/-/–/0). Returns the quantity.
const HAVE_NO_VALUES=new Set(["false","no","n","-","–","0"]);
function parseHaveQty(haveRaw){
  const have=String(haveRaw||"").trim().toLowerCase();
  if(/^\d+$/.test(have)) return Number.parseInt(have,10);
  if(have && !HAVE_NO_VALUES.has(have)) return 1;
  return 0;
}

// Finds each known column by header text (case-insensitive substring match)
// so sheet columns can be reordered/removed freely.
function detectColumns(headerRow){
  const hdr=(headerRow||[]).map(h=>String(h).toLowerCase());
  const col=name=>hdr.findIndex(h=>h.includes(name));
  return {
    cGroup: Math.max(col("group"),0),
    cCard: col("card")>-1 ? col("card") : 1,
    cNum: col("number"), cVar: col("variant"), cSrc: col("source"),
    cPrice: col("price"), cStatus: col("status"), cHave: col("have"),
    cImg: col("image"),
  };
}

// Turns raw sheet rows (row 0 = header) into tracker items. Rows with a
// Group but no Card are section headers (they set the running group for
// subsequent rows); rows with no Card are skipped.
function rowsToItems(rows){
  const cols=detectColumns(rows[0]);
  const get=(r,c)=>c>-1 ? String(r[c]||"").trim() : "";
  const items=[]; let group="Ungrouped";
  for(let i=1;i<rows.length;i++){
    const r=rows[i];
    const g=get(r,cols.cGroup), card=get(r,cols.cCard);
    if(g && !card){ group=g; continue; }
    if(!card) continue;
    items.push({
      group, card, num:get(r,cols.cNum), variant:get(r,cols.cVar),
      src:get(r,cols.cSrc), price:get(r,cols.cPrice), status:get(r,cols.cStatus),
      qty:parseHaveQty(get(r,cols.cHave)), img:get(r,cols.cImg),
    });
  }
  return items;
}

// TCGdex asset base URL for a set: the "serie" is the leading letters of
// the set id (me03 -> me, sv10.5b -> sv).
function tcgdexBaseFor(cfg){
  const s=(cfg.tcgdexSet||"").match(/^[a-z]+/i);
  return s ? `https://assets.tcgdex.net/en/${s[0].toLowerCase()}/${cfg.tcgdexSet}` : null;
}

// Ordered list of image URLs to try for a card: sheet Image column, local
// img/<setId>/ copy, imgTemplate, pokemontcg.io, TCGdex (both paddings),
// then an SVP promo lookup. Callers render the first URL and fall back
// through the rest on error.
function imgCandidatesPure(it, cfg, setId, imgMap){
  const out=[];
  if(it.img && /^https?:\/\//i.test(it.img)) out.push(it.img);
  const localFile = imgMap ? imgMap.get(`${it.card}|${it.num}|${it.variant}`) : null;
  if(localFile) out.push("img/"+setId+"/"+localFile);
  const m=it.num.match(/^(\d+)\s*\//);   // any NNN/MMM number
  const p=it.num.match(/^SVP\s*(\d+)/i);
  if(m){
    const n=Number.parseInt(m[1],10), n3=String(n).padStart(3,"0");
    if(cfg.imgTemplate) out.push(cfg.imgTemplate.replace("{num3}",n3).replace("{num}",String(n)));
    if(cfg.tcgSet) out.push(`https://images.pokemontcg.io/${cfg.tcgSet}/${n}.png`);
    const dex=tcgdexBaseFor(cfg);
    if(dex){ out.push(`${dex}/${n3}/high.webp`, `${dex}/${n}/high.webp`); }
  }
  if(p) out.push(`https://images.pokemontcg.io/${cfg.promoSet||"svp"}/${Number.parseInt(p[1],10)}.png`);
  return out;
}

// HTML-escape for text interpolated into innerHTML templates.
function esc(s){
  return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// Resolve an image candidate while rejecting executable/data URL schemes.
// HTTPS is allowed externally; plain HTTP is allowed only for same-origin
// local development. CSP applies the narrower production host allowlist.
function safeImageUrl(candidate, baseUrl){
  try{
    const base=new URL(baseUrl);
    const url=new URL(String(candidate),base);
    if(url.protocol==='https:' || (url.protocol==='http:' && url.origin===base.origin)){
      return url.href;
    }
  }catch{ /* malformed URLs are rejected below */ }
  return '';
}

function setSafeImageSource(image,candidate,baseUrl){
  const safe=safeImageUrl(candidate,baseUrl);
  if(!safe) return false;
  image.src=safe;
  return true;
}

// Sort a list of items by mode: "" = sheet order (returns the list as-is),
// "name" = card name then numeric-aware number, "price-asc"/"price-desc" =
// by priceMid with unpriced cards always sinking to the bottom.
function sortItems(list, mode){
  if(!mode) return list;
  const arr=[...list];
  if(mode==='name'){
    arr.sort((a,b)=> a.card.localeCompare(b.card) || a.num.localeCompare(b.num,undefined,{numeric:true}));
  }else{
    const dir = mode==='price-desc' ? -1 : 1;
    arr.sort((a,b)=>{
      const pa=priceMid(a.price), pb=priceMid(b.price);
      if(pa==null && pb==null) return 0;
      if(pa==null) return 1;           // unpriced cards sink to the bottom
      if(pb==null) return -1;
      return (pa-pb)*dir;
    });
  }
  return arr;
}

// Plain-text export: "<set> — missing (3 cards)" header + one "- Card Num" line
// per item, with variant / ×qty (owned only) / price appended when present.
function exportText(setName, kind, list){
  const head=`${setName} \u2014 ${kind} (${list.length} card${list.length===1?'':'s'})`;
  const lines=list.map(it=>{
    let l=`- ${it.card} ${it.num}`;
    if(it.variant && it.variant.toLowerCase()!=='regular') l+=` (${it.variant})`;
    if(kind==='owned' && it.qty>1) l+=` \u00d7${it.qty}`;
    if(it.price) l+=` \u2014 ${it.price}`;
    return l;
  });
  return head+"\n"+lines.join("\n");
}

// RFC-4180-style CSV field quoting: wrap in quotes when the value contains
// a quote, comma or newline; double any embedded quotes.
function csvEscape(v){
  const s=String(v);
  return /["\n,]/.test(s) ? '"'+s.replaceAll('"','""')+'"' : s;
}

// CSV export; owned exports gain a Have column with quantities.
function exportCsv(kind, list){
  const rows=[["Card","Number","Variant","Group","Price"].concat(kind==='owned'?["Have"]:[])];
  list.forEach(it=>rows.push(
    [it.card,it.num,it.variant,it.group,it.price].concat(kind==='owned'?[it.qty]:[])));
  return rows.map(r=>r.map(csvEscape).join(",")).join("\n");
}

// Marketplace search URLs stay useful when listings change, unlike links to
// individual offers. Generic variants add no search value and are omitted.
function marketplaceSearchUrls(it,cardmarketSet=''){
  const variant=/^(?:regular|standard|normal)$/i.test((it.variant||'').trim())
    ? '' : (it.variant||'').trim();
  const number=String(it.num||'').trim();
  const promo=/^[A-Za-z][A-Za-z0-9-]*\s+\d+$/.test(number);
  const regular=number.match(/^(\d+)(?:\/\d+)?$/);
  let cardmarketNumber='';
  if(promo) cardmarketNumber=number;
  else if(cardmarketSet && regular) cardmarketNumber=`${cardmarketSet} ${regular[1]}`;
  const cardmarketQuery=[it.card,cardmarketNumber]
    .map(v=>String(v||'').trim()).filter(Boolean).join(' ');
  const ebayQuery=[it.card,number,variant]
    .map(v=>String(v||'').trim()).filter(Boolean).join(' ');
  return {
    cardmarket:`https://www.cardmarket.com/en/Pokemon/Products/Search?searchString=${encodeURIComponent(cardmarketQuery)}`,
    ebay:`https://www.ebay.co.uk/sch/i.html?_nkw=${encodeURIComponent(ebayQuery)}`,
  };
}

// Expose the pure helpers to Node's test runner. In browsers `module` is not
// defined, so lib.js continues to behave as a classic script with globals.
if(typeof module!=="undefined" && module.exports){
  module.exports={
    csvToRows,priceMid,parseHaveQty,detectColumns,rowsToItems,imgCandidatesPure,
    esc,safeImageUrl,setSafeImageSource,sortItems,exportText,exportCsv,csvEscape,
    marketplaceSearchUrls
  };
}
