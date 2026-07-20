const main=document.getElementById('sets');

async function progress(cfg){
  if(!cfg.sheet) return null;
  const res=await fetch(cfg.sheet,{cache:"no-store"});
  if(!res.ok) throw new Error('sheet fetch failed: '+res.status);
  const text=await res.text();
  if(/^\s*</.test(text)) throw new Error('got a web page, not CSV');
  const rows=csvToRows(text);
  // find header row: needs a "card"-ish and "have"-ish column
  let hi=-1,ci=-1,haveI=-1;
  for(let r=0;r<Math.min(rows.length,5);r++){
    const low=rows[r].map(x=>x.trim().toLowerCase());
    const c=low.findIndex(h=>h.includes("card"));
    const hv=low.findIndex(h=>h.includes("have")||h.includes("own")||h.includes("qty"));
    if(c>-1&&hv>-1){hi=r;ci=c;haveI=hv;break;}
  }
  if(hi<0) return null;
  let total=0,owned=0;
  for(let r=hi+1;r<rows.length;r++){
    const card=(rows[r][ci]||"").trim();
    if(!card) continue;           // group header / blank rows
    total++;
    if(parseHaveQty(rows[r][haveI])>0) owned++;
  }
  return {owned,total};
}

// ---- cache last-seen progress per set so returning visitors see numbers
// instantly instead of a "…" flash while every set's sheet re-fetches ----
function getCachedProgress(id){
  try{ return JSON.parse(localStorage.getItem('progress:'+id)||'null'); }catch(e){ return null; }
}
function setCachedProgress(id,p){
  try{ localStorage.setItem('progress:'+id, JSON.stringify(p)); }catch(e){}
}
function paintProgress(a,p){
  const t=a.querySelector('[data-prog]'), b=a.querySelector('[data-bar]');
  t.textContent=`${p.owned} / ${p.total} owned`;
  b.style.width=(p.total? (100*p.owned/p.total):0)+'%';
}

Object.entries(SETS).forEach(([id,cfg])=>{
  const a=document.createElement(cfg.sheet?'a':'article');
  a.className='setcard';
  if(cfg.sheet) a.href='tracker.html?set='+encodeURIComponent(id);
  else{
    a.classList.add('unconfigured');
    a.setAttribute('aria-disabled','true');
  }
  const logoCands=['assets/logos/'+id+'.png'];
  if(cfg.logo) logoCands.push(cfg.logo);
  if(cfg.tcgSet) logoCands.push('https://images.pokemontcg.io/'+cfg.tcgSet+'/logo.png');
  const sm=(cfg.tcgdexSet||'').match(/^[a-z]+/i);
  if(sm) logoCands.push('https://assets.tcgdex.net/en/'+sm[0].toLowerCase()+'/'+cfg.tcgdexSet+'/logo.png');
  a.innerHTML=`
    <img alt="${esc(cfg.name)}"
      data-alts="${esc(logoCands.slice(1).join('|'))}">
    <div class="meta"><span class="code">${esc(cfg.tcgSet||cfg.code||"")}</span><span class="prog" data-prog>…</span></div>
    <div class="bar"><i data-bar></i></div>`;
  const logoImg=a.querySelector('img');
  logoImg.addEventListener('error',function(){
    const alternatives=(this.dataset.alts||'').split('|').filter(Boolean);
    if(alternatives.length){
      this.dataset.alts=alternatives.slice(1).join('|');
      if(!setSafeImageSource(this,alternatives[0],document.baseURI)) this.dispatchEvent(new Event('error'));
    }else{
      this.replaceWith(Object.assign(document.createElement('div'),
        {className:'noimg',textContent:cfg.name}));
    }
  });
  setSafeImageSource(logoImg,logoCands[0]||'',document.baseURI);
  a.dataset.search=(id+" "+cfg.name+" "+(cfg.tcgSet||"")+" "+(cfg.code||"")+" "+(cfg.tcgdexSet||"")).toLowerCase();
  main.appendChild(a);
  if(!cfg.sheet){
    a.querySelector('[data-prog]').textContent='Not configured';
  } else {
    const cached=getCachedProgress(id);
    if(cached) paintProgress(a,cached);
    progress(cfg).then(p=>{
      if(!p) return; // keep showing the cached value (or "…") rather than blanking
      paintProgress(a,p);
      setCachedProgress(id,p);
    }).catch(()=>{ if(!cached) a.querySelector('[data-prog]').textContent=''; });
  }
});

document.getElementById('setSearch').addEventListener('input', e=>{
  const q=e.target.value.trim().toLowerCase();
  let visible=0;
  document.querySelectorAll('.setcard').forEach(card=>{
    const hit=!q || card.dataset.search.includes(q);
    card.classList.toggle('hidden', !hit);
    if(hit) visible++;
  });
  document.getElementById('noResults').style.display = visible? 'none':'block';
});

if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
