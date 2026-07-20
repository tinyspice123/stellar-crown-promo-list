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
function csvToRows(text){
  if(text.charCodeAt(0)===0xFEFF) text=text.slice(1);
  const rows=[]; let row=[], field="", inQ=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(inQ){
      if(c==='"'){ if(text[i+1]==='"'){field+='"';i++;} else inQ=false; }
      else field+=c;
    }else{
      if(c==='"') inQ=true;
      else if(c===','){ row.push(field); field=""; }
      else if(c==='\n'||c==='\r'){
        if(c==='\r'&&text[i+1]==='\n') i++;
        row.push(field); rows.push(row); row=[]; field="";
      }
      else field+=c;
    }
  }
  if(field!==""||row.length){ row.push(field); rows.push(row); }
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
const HAVE_NO_VALUES=["false","no","n","-","–","0"];
function parseHaveQty(haveRaw){
  const have=String(haveRaw||"").trim().toLowerCase();
  if(/^\d+$/.test(have)) return parseInt(have,10);
  if(have && !HAVE_NO_VALUES.includes(have)) return 1;
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
    const n=parseInt(m[1],10), n3=String(n).padStart(3,"0");
    if(cfg.imgTemplate) out.push(cfg.imgTemplate.replace("{num3}",n3).replace("{num}",String(n)));
    if(cfg.tcgSet) out.push(`https://images.pokemontcg.io/${cfg.tcgSet}/${n}.png`);
    const dex=tcgdexBaseFor(cfg);
    if(dex){ out.push(`${dex}/${n3}/high.webp`, `${dex}/${n}/high.webp`); }
  }
  if(p) out.push(`https://images.pokemontcg.io/${cfg.promoSet||"svp"}/${parseInt(p[1],10)}.png`);
  return out;
}
