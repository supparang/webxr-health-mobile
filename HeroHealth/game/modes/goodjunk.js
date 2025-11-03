// === /webxr-health-mobile/HeroHealth/game/modes/goodjunk.js
// v3 "Balanced Spawn Flow"
// - No prefill; first spawn after ~0.55s (after GO!)
// - Randomized spawn interval (±30% jitter) to avoid burst-waves
// - Hard cap on on-screen icons (desktop 10, mobile 8)
// - Soft fade-out on timeout (and on click) to reduce visual clutter
// - MISS only when a GOOD item times out (shield can absorb)
// - Keeps API: start(cfg), update(dt,bus), stop(), cleanup(), setFever(on), restart(), name

export const name = 'goodjunk';

const GOOD  = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍇','🍓','🍊','🍅','🥬','🥛','🍞','🍚','🍅','🍆','🥝','🍍','🍐'];
const JUNK  = ['🍔','🍟','🍕','🍩','🍪','🍫','🥤','🧋','🌭','🍰','🍿','🧈','🧂'];
const POWERS = ['gold','shield'];

let host = null, alive = false, fever = false, diff = 'Normal';
let allowMiss = 0;

// Tunables (adjusted by diff in start())
let iconSizeBase = 52;
let lifeBaseS = 1.60;           // base life (before jitter)
let spawnBaseS = 0.70;          // base interval (before jitter)
let jitter = 0.30;              // ±30% interval jitter
let firstDelayS = 0.55;         // delay of first spawn after GO

// Runtime
let _bus = null;
let _nextSpawnS = 0;            // countdown to next spawn
let _activeCount = 0;
const _pos = new Map();         // el -> {x,y}
const _cap = ()=> ((matchMedia?.('(pointer:coarse)').matches || innerWidth<900) ? 8 : 10);

// ---------------- API ----------------
export function start(cfg = {}) {
  ensureHost();
  clearHost();
  alive = true;
  _bus = null;
  _pos.clear();
  _activeCount = 0;
  fever = !!cfg.fever;
  diff  = String(cfg.difficulty || 'Normal');

  if (diff === 'Easy'){   spawnBaseS = 0.90; lifeBaseS = 2.00; iconSizeBase = 58; }
  else if (diff==='Hard'){spawnBaseS = 0.58; lifeBaseS = 1.30; iconSizeBase = 46; }
  else {                  spawnBaseS = 0.72; lifeBaseS = 1.60; iconSizeBase = 52; }

  allowMiss = 0;
  // no prefill; wait a moment after GO
  _nextSpawnS = firstDelayS;
}

export function update(dt, bus){
  if (!alive) return;
  _bus = bus || _bus;

  _nextSpawnS -= dt;
  if (_nextSpawnS <= 0){
    if (_activeCount < _cap()){
      spawnRandom(bus);
      _nextSpawnS = jittered(spawnBaseS, jitter);
    }else{
      // too dense: check again soon but don’t spawn
      _nextSpawnS = 0.12;
    }
  }
}

export function stop(){ alive = false; try{ host && (host.innerHTML=''); }catch{} _activeCount = 0; _pos.clear(); }
export function cleanup(){ stop(); }
export function setFever(on){ fever = !!on; }
export function restart(){ stop(); start({ difficulty: diff, fever }); }

// ---------------- Internals ----------------
function ensureHost(){
  host = document.getElementById('spawnHost');
  if(!host){
    host = document.createElement('div');
    host.id='spawnHost';
    host.style.cssText='position:fixed;inset:0;z-index:5000;pointer-events:auto';
    document.body.appendChild(host);
  }else{
    host.style.zIndex='5000'; host.style.pointerEvents='auto';
  }
}
function clearHost(){ try{ host && (host.innerHTML=''); }catch{} }

function jittered(base, j=0.3){
  const f = 1 + (Math.random()*2*j - j); // 1 ± j
  return Math.max(0.05, base * f);
}

function pick(arr){ return arr[(Math.random()*arr.length)|0]; }

function isOverCap(){ return _activeCount >= _cap(); }

function consumeShield(){
  if (allowMiss>0){ allowMiss--; return true; }
  return false;
}

function onMissGood(bus){
  if (consumeShield()){ try{ bus?.power?.('shield'); }catch{}; return; }
  try{ bus?.miss?.({ source:'good-timeout' }); }catch{}
}

function spawnRandom(bus){
  const r = Math.random();
  if (r < 0.10) { spawnPower(pick(POWERS), bus); return; }

  const isGolden = Math.random() < 0.10;
  const isGood   = isGolden || (Math.random() < 0.68);
  const glyph    = isGolden ? '🌟' : (isGood ? pick(GOOD) : pick(JUNK));
  spawnOne(glyph, isGood, isGolden, bus);
}

function spawnOne(glyph,isGood,isGolden,bus){
  if (isOverCap()) return;

  const d=document.createElement('button');
  d.className='spawn-emoji'; d.type='button'; d.textContent=glyph;

  const size=isGolden?(iconSizeBase+8):iconSizeBase;
  const {x,y} = placeNonOverlap();

  Object.assign(d.style,{
    position:'absolute',left:x+'px',top:y+'px',transform:'translate(-50%,-50%) scale(.85)',
    border:'0',background:'transparent',cursor:'pointer',
    fontSize:size+'px',filter:'drop-shadow(0 6px 16px rgba(0,0,0,.55))',
    zIndex:'5500',opacity:'0',transition:'transform .18s ease, opacity .35s ease'
  });

  host.appendChild(d);
  _pos.set(d,{x,y}); _activeCount++;
  requestAnimationFrame(()=>{ d.style.opacity='1'; d.style.transform='translate(-50%,-50%) scale(1)'; });

  const lifeMs = Math.floor((lifeBaseS + (isGolden?0.28:0)) * 1000 * (0.9 + Math.random()*0.2));
  const kill = setTimeout(()=>{
    // soft fade-out
    try{
      d.style.opacity='0'; d.style.transform='translate(-50%,-50%) scale(.92)';
      setTimeout(()=>{ try{ d.remove(); }catch{}; _pos.delete(d); _activeCount=Math.max(0,_activeCount-1); }, 220);
    }catch{}
    if (isGood) onMissGood(bus);
  }, lifeMs);

  d.addEventListener('click',(ev)=>{
    clearTimeout(kill);
    // soft remove
    try{
      d.style.opacity='0'; d.style.transform='translate(-50%,-50%) scale(1.08)';
      setTimeout(()=>{ try{ d.remove(); }catch{}; _pos.delete(d); _activeCount=Math.max(0,_activeCount-1); }, 140);
    }catch{}

    if(isGood){
      const perfect = isGolden || Math.random() < 0.22;
      const pts = Math.round((perfect?200:100)*(fever?1.5:1));
      try{
        bus?.hit?.({
          kind:(isGolden?'perfect':(perfect?'perfect':'good')),
          points:pts, ui:{x:ev.clientX,y:ev.clientY},
          meta:{good:1, golden:(isGolden?1:0)}
        });
        if(perfect) bus?.sfx?.perfect?.(); else bus?.sfx?.good?.();
      }catch{}
    }else{
      try{ bus?.bad?.({source:'junk-click'}); bus?.sfx?.bad?.(); }catch{}
    }
    window.__notifySpawn?.();
  }, {passive:true});
}

function spawnPower(kind,bus){
  if (isOverCap()) return;

  const d=document.createElement('button');
  d.className='spawn-emoji power'; d.type='button';
  d.textContent=(kind==='shield'?'🛡️':'⭐');

  const size = iconSizeBase+6;
  const {x,y} = placeNonOverlap();

  Object.assign(d.style,{
    position:'absolute',left:x+'px',top:y+'px',transform:'translate(-50%,-50%) scale(.85)',
    border:'0',background:'transparent',cursor:'pointer',
    fontSize:size+'px',filter:'drop-shadow(0 8px 18px rgba(10,120,220,.55))',
    zIndex:'5550',opacity:'0',transition:'transform .18s ease, opacity .35s ease'
  });

  host.appendChild(d);
  _pos.set(d,{x,y}); _activeCount++;
  requestAnimationFrame(()=>{ d.style.opacity='1'; d.style.transform='translate(-50%,-50%) scale(1)'; });

  const lifeMs = Math.floor((lifeBaseS+0.35) * 1000 * (0.9 + Math.random()*0.2));
  const kill = setTimeout(()=>{
    try{
      d.style.opacity='0'; d.style.transform='translate(-50%,-50%) scale(.92)';
      setTimeout(()=>{ try{ d.remove(); }catch{}; _pos.delete(d); _activeCount=Math.max(0,_activeCount-1); }, 220);
    }catch{}
  }, lifeMs);

  d.addEventListener('click',(ev)=>{
    clearTimeout(kill);
    try{
      d.style.opacity='0'; d.style.transform='translate(-50%,-50%) scale(1.1)';
      setTimeout(()=>{ try{ d.remove(); }catch{}; _pos.delete(d); _activeCount=Math.max(0,_activeCount-1); }, 140);
    }catch{}

    if(kind==='shield'){
      allowMiss++;
      try{ bus?.power?.('shield'); bus?.sfx?.power?.(); }catch{}
    }else{
      const pts = Math.round(150*(fever?1.5:1));
      try{
        bus?.hit?.({ kind:'perfect', points:pts, ui:{x:ev.clientX,y:ev.clientY}, meta:{gold:1,power:'gold'} });
        bus?.power?.('gold'); bus?.sfx?.power?.();
      }catch{}
    }
    window.__notifySpawn?.();
  }, {passive:true});
}

// ---------- layout helper: try to avoid clumps ----------
function placeNonOverlap(){
  const pad=56, topPad=84, bottomPad=160;
  const minD = 90;                // minimum distance between centers
  const tries = 22;

  for(let k=0;k<tries;k++){
    const x = Math.floor(pad + Math.random()*(innerWidth  - pad*2));
    const y = Math.floor(topPad + Math.random()*(innerHeight - (topPad+bottomPad)));
    let ok = true;
    for (const {x:ox,y:oy} of _pos.values()){
      const dx=x-ox, dy=y-oy;
      if ((dx*dx + dy*dy) < (minD*minD)){ ok=false; break; }
    }
    if (ok) return {x,y};
  }
  // fallback (accept last try)
  const x = Math.floor(pad + Math.random()*(innerWidth  - pad*2));
  const y = Math.floor(topPad + Math.random()*(innerHeight - (topPad+bottomPad)));
  return {x,y};
}

// Convenience create() for factory-style usage (kept for compatibility)
export function create(){
  return { start:(cfg)=>start(cfg), update:(dt,bus)=>update(dt,bus),
           cleanup:()=>stop(), setFever:(on)=>setFever(on), restart:()=>restart() };
}
