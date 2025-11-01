// === modes/goodjunk.js — DOM-spawn icons + Fever hooks + Shield/Star (stable, quest-gold + penalty) ===
export const name = 'goodjunk';

const GOOD  = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🍆','🥬','🥝','🍍','🍐','🍑'];
const JUNK  = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍗','🍖','🍫','🥓','🍿','🧈','🧂'];
const POWERS= ['star','shield']; // star = burst points, shield = ignore next miss

let host=null, alive=false;
let diff='Normal';
let iconSizeBase=48;

// spawn pacing (seconds per spawn)
let spawnIntervalS = 0.70;
let lifeS          = 1.60;
let _accum = 0;

// fever & shield
let fever=false, allowMiss=0;

// crowd control per difficulty (limit concurrent icons)
let maxAlive = 9;

export function start(cfg){
  ensureHost();
  clearHost();
  alive=true;

  diff = String((cfg && cfg.difficulty) || 'Normal');
  if (diff==='Easy'){  spawnIntervalS=0.82; lifeS=1.90; iconSizeBase=54; maxAlive=7; }
  else if (diff==='Hard'){ spawnIntervalS=0.56; lifeS=1.40; iconSizeBase=40; maxAlive=12; }
  else { spawnIntervalS=0.70; lifeS=1.60; iconSizeBase=48; maxAlive=9; }

  _accum=0; fever=false; allowMiss=0;
}

export function stop(){ alive=false; clearHost(); }

export function setFever(on){ fever = !!on; }
export function grantShield(n){ allowMiss += (n|0); }
function consumeShield(){ if(allowMiss>0){ allowMiss--; return true; } return false; }

function ensureHost(){
  host = document.getElementById('spawnHost');
  if (!host){
    host = document.createElement('div');
    host.id='spawnHost';
    host.style.cssText='position:fixed;inset:0;pointer-events:auto;z-index:5;';
    document.body.appendChild(host);
  }
}
function clearHost(){ try{ if(host) host.innerHTML=''; }catch(e){} }

function spawnOne(glyph, isGood, isGolden, bus){
  const d=document.createElement('button');
  d.className='spawn-emoji';
  d.type='button';
  d.textContent=glyph;

  const size = isGolden ? (iconSizeBase+8) : iconSizeBase;
  Object.assign(d.style,{
    position:'absolute', border:'0', background:'transparent',
    fontSize:size+'px', transform:'translate(-50%,-50%)',
    filter:'drop-shadow(0 6px 16px rgba(0,0,0,.55))',
    cursor:'pointer'
  });

  const pad=56, W=innerWidth, H=innerHeight;
  const x = Math.floor(pad + Math.random()*(W - pad*2));
  const y = Math.floor(pad + Math.random()*(H - pad*2 - 140));
  d.style.left = x+'px';
  d.style.top  = y+'px';

  // lifetime
  const lifeMs = Math.floor((lifeS + (isGolden?0.25:0))*1000);
  const killto = setTimeout(function(){ try{ d.remove(); }catch(e){}; onMiss(bus, {reason:'timeout'}); }, lifeMs);

  d.addEventListener('click', function(ev){
    clearTimeout(killto);
    explodeAt(x,y);
    try{ d.remove(); }catch(e){}
    if (isGood){
      const perfect = isGolden || Math.random()<0.22;
      const basePts = perfect ? 200 : 100;
      const mult    = fever ? 1.5 : 1.0;
      const pts     = Math.round(basePts*mult);

      var meta = { perfect: !!perfect };
      if (isGolden) meta.gold = true; // ✅ tag for golden quest

      if (bus && typeof bus.hit==='function'){
        bus.hit({ kind: (perfect?'perfect':'good'), points: pts, ui:{x:ev.clientX,y:ev.clientY}, meta: meta });
      }
      try{
        if (perfect && bus && bus.sfx && typeof bus.sfx.perfect==='function') bus.sfx.perfect();
        else if (bus && bus.sfx && typeof bus.sfx.good==='function') bus.sfx.good();
      }catch(e){}
    } else {
      onMiss(bus, {reason:'junkClick', ui:{x:ev.clientX,y:ev.clientY}});
    }
  }, { passive:true });

  host.appendChild(d);
}

function spawnPower(kind, bus){
  const d=document.createElement('button');
  d.className='spawn-emoji power';
  d.type='button';
  d.textContent=(kind==='shield'?'🛡️':'⭐');
  Object.assign(d.style,{
    position:'absolute', border:'0', background:'transparent',
    fontSize:iconSizeBase+'px', transform:'translate(-50%,-50%)',
    filter:'drop-shadow(0 8px 18px rgba(10,120,220,.55))', cursor:'pointer'
  });

  const pad=56, W=innerWidth, H=innerHeight;
  const x = Math.floor(pad + Math.random()*(W - pad*2));
  const y = Math.floor(pad + Math.random()*(H - pad*2 - 140));
  d.style.left=x+'px';
  d.style.top =y+'px';

  const killto=setTimeout(function(){ try{d.remove();}catch(e){}; }, Math.floor((lifeS+0.25)*1000));

  d.addEventListener('click', function(ev){
    clearTimeout(killto);
    try{ d.remove(); }catch(e){}
    if (kind==='shield'){
      grantShield(1);
      try{ if(bus && typeof bus.power==='function') bus.power('shield'); }catch(e){}
    } else {
      // star = instant points + quest gold flag
      if (bus && typeof bus.hit==='function'){
        bus.hit({ kind:'perfect', points:150, ui:{x:ev.clientX,y:ev.clientY}, meta:{gold:true, power:'star'} });
      }
    }
  }, { passive:true });

  host.appendChild(d);
}

function onMiss(bus, info){
  if (consumeShield()){
    try{ if(bus && bus.sfx && typeof bus.sfx.power==='function') bus.sfx.power(); }catch(e){}
    return;
  }
  try{ if(bus && typeof bus.miss==='function') bus.miss(info||{}); }catch(e){}
  try{ if(bus && bus.sfx && typeof bus.sfx.bad==='function') bus.sfx.bad(); }catch(e){}
}

export function update(dt, bus){
  if(!alive) return;

  // limit overcrowding
  try{
    const aliveNow = host ? host.querySelectorAll('.spawn-emoji').length : 0;
    if (aliveNow > maxAlive) { return; }
  }catch(e){}

  _accum += dt;
  while (_accum >= spawnIntervalS) {
    _accum -= spawnIntervalS;

    // 10% power, ที่เหลือดี/ขยะ
    const r = Math.random();
    if (r < 0.10){
      const kind = POWERS[(Math.random()*POWERS.length)|0];
      spawnPower(kind, bus);
    } else {
      const isGolden = Math.random() < 0.12;
      const isGood   = isGolden || (Math.random() < 0.70);
      const glyph    = isGolden ? '🌟' : (isGood ? GOOD[(Math.random()*GOOD.length)|0] : JUNK[(Math.random()*JUNK.length)|0]);
      spawnOne(glyph, isGood, isGolden, bus);
    }
  }
}

// simple particle burst
function explodeAt(x,y){
  const n=8+((Math.random()*6)|0);
  for(let i=0;i<n;i++){
    const p=document.createElement('div');
    p.textContent='✦';
    Object.assign(p.style,{
      position:'fixed', left:x+'px', top:y+'px', transform:'translate(-50%,-50%)',
      font:'900 16px ui-rounded,system-ui', color:'#a7c8ff', textShadow:'0 2px 12px #4ea9ff',
      transition:'transform .7s ease-out, opacity .7s ease-out', opacity:'1', zIndex:1200, pointerEvents:'none'
    });
    document.body.appendChild(p);
    const dx=(Math.random()*120-60), dy=(Math.random()*120-60), s=0.6+Math.random()*0.6;
    requestAnimationFrame(function(){ p.style.transform='translate('+dx+'px,'+dy+'px) scale('+s+')'; p.style.opacity='0'; });
    setTimeout(function(){ try{p.remove();}catch(e){}; }, 720);
  }
}

/* ---- Compatibility helper for main.js styles (create/start/update) ---- */
export function create(){
  return {
    start: function(cfg){ start(cfg||{}); },
    update: function(dt,bus){ update(dt,bus); },
    cleanup: function(){ stop(); }
  };
}
